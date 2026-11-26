# Eval の呼び出し計画: 実行せずに有料ゲートの費用を見積もる

有料ゲート(ベンチマーク、eval のスモークテスト、モデルプロバイダーに課金される呼び出しを含むコマンド)は、誰かが承認する前に費用を見積もります。gstack はゲートや、その他のリポジトリのコマンドを、費用を知るために実行することはありません。代わりにリポジトリは **呼び出し計画ファイル(call-plan file)** をコミットします。これは素のデータで、正確なゲートコマンド、その計算元になったコミットと入力、そして呼び出しの目的ごとに 1 行ずつのモデルとトークン数を記述します。`gstack-eval-plan price-gate` はこのファイルを読み、それがまだ承認対象の内容を正しく表しているかを確認し、`lib/pricing.ts` を使って価格を計算して、レシートを書き出します。計画: フィールドウェーブ CD2(`docs/designs/GSTACK_FIELD_WAVE_2026_10_12.md`、ゲートの決定 d5b を修正したもの)。

```bash
gstack-eval-plan price-gate --gate-file <file> --cap-usd 20 [--smoke-cap-usd 2] [--plan-file <file>]
```

`--gate-file` はゲートの正確なコマンドをファイルから読みます(末尾の改行 1 つは除かれます)。そのため、引用符や `$` を含むコマンドがシェルの文字列を経由することはありません。`--gate "<command>"` ではインラインで指定できます。どちらか一方を指定してください。

## 計画ファイルの出どころ

1. `--plan-file <file>`: オペレーターが指定したファイルで、ディスクから読みます。
2. それ以外の場合は、`origin/<base>` にコミットされている `.gstack/pregate.json` の `price_file` です(`--base`、デフォルトは origin/HEAD のブランチ)。これはリポジトリ相対のパスで、そのバイト列は作業ツリーからではなく **HEAD コミット**(`git show HEAD:<path>`)から読みます。

ファイル内の何も実行されません。ゲートのコマンド、前提条件、入力パスのいずれも実行されません。ファイルは単なるテキストとして解析されます。

## ファイル形式、ワイヤーバージョン v1

```
# gstack eval call plan, wire format v1 (docs/eval-calls.md); priced by `gstack-eval-plan price-gate`, never executed
GSTACK_EVAL_GATE v1: bun run eval:synopsis --questions 50 --arms opus,sol
GSTACK_EVAL_HEAD v1: 0123456789abcdef0123456789abcdef01234567
GSTACK_EVAL_INPUT v1: sha256=<64 hex> path=evals/synopsis/questions.jsonl
GSTACK_EVAL_PRECONDITION: ANTHROPIC_API_KEY and OPENAI_API_KEY set at run time
GSTACK_EVAL_CALLS v1: purpose=answer model=anthropic/claude-opus-5-5 calls=100 in_tokens=400000 out_tokens=200000 max_out_tokens=8192 scope=full
GSTACK_EVAL_CALLS v1: purpose=judge model=gpt-6.1-sol calls=100 in_tokens=300000 out_tokens=50000 max_out_tokens=2048 scope=full
GSTACK_EVAL_CALLS v1 end: lines=2
```

| 行 | 件数 | 意味 |
|---|---|---|
| `GSTACK_EVAL_GATE v1: <command>` | ちょうど 1 | この計画が価格を付けるゲートの正確なコマンド。`--gate` と文字列の完全一致で比較される |
| `GSTACK_EVAL_HEAD v1: <sha>` | ちょうど 1 | 計画を計算したときのコミットの完全な sha |
| `GSTACK_EVAL_INPUT v1: sha256=<hex> path=<path>` | 0 個以上 | 件数の元になった各入力(行、データセット、プロンプト)。リポジトリ相対で、`..` は不可 |
| `GSTACK_EVAL_PRECONDITION: <text>` | 0 個以上 | 実行時に成り立っている必要があること。各行は `GATE_PRECONDITION:` としてそのまま出力される |
| `GSTACK_EVAL_CALLS v1: …` | 0 個以上 | 呼び出しの目的ごとに 1 行(`purpose` と `model` の組が一意) |
| `GSTACK_EVAL_CALLS v1 end: lines=<n>` | ちょうど 1 つ、最後の行 | `n` は呼び出し行の数。終端行がない、または件数が合わない場合は、部分的に書かれたファイルとみなして拒否される |

空行と `#` で始まる行は無視されます。それ以外の行は、上記のいずれかでなければなりません。未知の種類、未知のバージョン(`v2`)、欠けている、または余分なキー、重複したキー、整数でない件数、`calls=0`、終端行の後にある内容は、どれも `EVAL_DRY_RUN_FAILED` で拒否され、該当する行を示します。

### 呼び出し行のキー

| Key | Meaning |
|---|---|
| `purpose` | 呼び出しの目的の名前(`[A-Za-z0-9._:-]+`)。例: `answer`、`judge`、`embed` |
| `model` | モデル ID。プロバイダーの接頭辞(`anthropic/`、`openai:`、`voyage:`)は受け付ける |
| `calls` | この目的の呼び出し回数(1 以上) |
| `in_tokens` | この目的のすべての呼び出しにわたる **合計** の入力トークン |
| `out_tokens` | この目的のすべての呼び出しにわたる **合計** の想定出力トークン |
| `max_out_tokens` | **1 回の呼び出しあたり** の出力の確保量(呼び出しが送る `max_tokens`) |
| `scope` | `full`(本番の計測実行)または `smoke`(小さな事前確認) |

合計値は、その目的にかかると想定される費用です。`usd = price(in_tokens, out_tokens)`。1 回あたりの確保量は、1 回の呼び出しで最大いくらかかりうるかを表し、プロバイダーや支出台帳が確保する金額です。`reservation_usd = price(ceil(in_tokens / calls), max_out_tokens)`。

## 拘束チェック(`EVAL_PLAN_STALE`)

計画が、承認対象の内容をもう表していない場合、レシートを出さずに拒否します。

- `GSTACK_EVAL_GATE` のコマンドが `--gate` と 1 文字でも違う
- `GSTACK_EVAL_HEAD` のコミットが HEAD ではなく、かつ計画ファイル自身以外のファイルが両者の間で変更されている(コミット済みの計画ファイルは、計算元の head の 1 コミット上に乗るので、そのコミット自体は許可される)
- 入力の HEAD コミット上のバイト列の sha256 が、その `GSTACK_EVAL_INPUT` 行と一致しない、またはその入力が HEAD にない
- ベースのポリシーが宣言する `price_file` が HEAD コミットにない

`--allow-unpriced` でもこれらは上書きできません。計画がまったく宣言されていないゲート、または呼び出し行がゼロの計画だけが「価格なし」になります。

## 価格計算の結果

```
GATE_PLAN: file=evals/gate.calls source=price_file sha256=<hex> head=<sha12> inputs=1 verified
GATE_PRECONDITION: ANTHROPIC_API_KEY and OPENAI_API_KEY set at run time
GATE_CALLS: purpose=answer model=anthropic/claude-opus-5-5 calls=100 usd=5.6 reservation_usd=0.17984 scope=full
GATE_CALLS: purpose=judge model=gpt-6.1-sol calls=100 usd=1.1 reservation_usd=0.02648 scope=full
CHECK: reservation-fits-cap ok (largest one-call reservation $0.1798)
GATE_PRICE: total=6.7 calls=200 purposes=answer,judge receipt=.gstack/tmp/price-gate/price-gate-<gate12>-<head12>.json
```

| 結果 | 終了コード | コード |
|---|---|---|
| 価格が付き、上限内に収まる | 0 | — |
| `lib/pricing.ts` に行がないモデル。その行と合計は `unknown` と表示され、ゼロにはならない | 1 | `EVAL_PRICE_MISSING` |
| 合計が `--cap-usd` を超える | 1 | `EVAL_GATE_OVER_CAP` |
| 1 回の呼び出しの確保量が `--cap-usd` を超える、または `scope=smoke` の行で `--smoke-cap-usd` を超える(`CHECK: reservation-fits-cap exceeds (…)`) | 1 | `EVAL_GATE_OVER_CAP` |
| 計画が宣言されていない(`--plan-file` も `price_file` キーもない)、または呼び出し行がゼロのファイル | 1 | `EVAL_GATE_UNPRICED` |
| 同じ状況で `--allow-unpriced "<reason>"` を指定した場合 | 0 | `GATE_UNPRICED_OVERRIDE: <reason> (owner-authorized override; not authorization to spend)` を出力して記録する |
| 不正または部分的なファイル | 1 | `EVAL_DRY_RUN_FAILED` |
| 古い拘束、または宣言された `price_file` が HEAD にない(上書き不可) | 1 | `EVAL_PLAN_STALE` |
| `price_file` を読む際に `origin/<base>` を解決できない | 3 | `POLICY_SOURCE_UNAVAILABLE` |
| ベース上の `.gstack/pregate.json` が無効 | 3 | `PREGATE_CONFIG_INVALID` |
| 未知のフラグ、または `--gate` の欠落 | 2 | 使い方のエラー |

価格は見積もりです。この表は標準のテキストトークンで計算し、`lib/pricing.ts` に列挙された課金カテゴリ(キャッシュの書き込み、ツール利用料、サービス階層、長文コンテキストの割増、メディアトークン、シート課金の実行)は含みません。

## レシート

拘束チェックを通過したすべての結果は、JSON のレシートを `--out`(デフォルトは `<repo>/.gstack/tmp/price-gate/`)に書き出します。ファイル名は `price-gate-<gate sha256 12>-<head 12>.json` で、そのパスを `GATE_PRICE:` の行に表示します。`--json` を指定すると、行の代わりにレシート(および `receipt_path`)を出力します。

| Field | Meaning |
|---|---|
| `schema_version` | `1` |
| `kind` | `gstack-eval-price-gate` |
| `created_at`, `gstack_revision` | いつ、どの gstack(VERSION とコミット)で価格を計算したか |
| `gate_command`, `gate_sha256` | 承認されたコマンドとその sha256 |
| `head_sha` | 価格を計算した時点の HEAD |
| `plan` | `file`、`source`(`flag`、`price_file`、`none`)、計画ファイルのバイト列の `sha256`、`declared_head` |
| `inputs` | 各 `{ path, sha256 }`。HEAD で検証済み |
| `preconditions` | すべての前提条件の行 |
| `rows` | 各呼び出し行に `usd` と `reservation_usd` を加えたもの(価格がない場合は `null`) |
| `total_usd`, `calls`, `purposes` | 合計。`total_usd` は不明な場合 `null` |
| `cap_usd`, `smoke_cap_usd` | 渡された上限、または `null` |
| `result`, `code` | `priced`、`price_missing`、`over_cap`、`unpriced`、`unpriced_override`、および結果コード |
| `unpriced_reason`, `unpriced_override` | ゲートが価格なしである理由と、オーナーによる上書きの理由 |
| `excluded_billing` | 見積もりから除外した課金カテゴリ |

## リファレンスの出力ツール

リポジトリを利用する側は、呼び出しを組み立てるのと同じコードから計画ファイルを書き出すので、件数が実行と食い違うことがありません。`lib/eval-plan.ts` の `formatEvalCalls` がリファレンスです。これをコピーして使ってください。

```ts
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const KEYS = ['purpose', 'model', 'calls', 'in_tokens', 'out_tokens', 'max_out_tokens', 'scope'] as const;
type Row = { purpose: string; model: string; calls: number; in_tokens: number; out_tokens: number; max_out_tokens: number; scope: 'full' | 'smoke' };

export function formatEvalCalls(p: { gate: string; head: string; inputs: { path: string; sha256: string }[]; preconditions: string[]; rows: Row[] }): string {
  return [
    '# gstack eval call plan, wire format v1 (docs/eval-calls.md); priced by `gstack-eval-plan price-gate`, never executed',
    `GSTACK_EVAL_GATE v1: ${p.gate}`,
    `GSTACK_EVAL_HEAD v1: ${p.head}`,
    ...p.inputs.map(i => `GSTACK_EVAL_INPUT v1: sha256=${i.sha256} path=${i.path}`),
    ...p.preconditions.map(t => `GSTACK_EVAL_PRECONDITION: ${t}`),
    ...p.rows.map(r => `GSTACK_EVAL_CALLS v1: ${KEYS.map(k => `${k}=${r[k]}`).join(' ')}`),
    `GSTACK_EVAL_CALLS v1 end: lines=${p.rows.length}`,
  ].join('\n') + '\n';
}

// Count tokens the way the run will, without calling a provider, then:
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const input = 'evals/synopsis/questions.jsonl';
const sha256 = createHash('sha256').update(readFileSync(input)).digest('hex');
// writeFileSync('evals/gate.calls', formatEvalCalls({ gate, head, inputs: [{ path: input, sha256 }], preconditions, rows }));
```

入力は HEAD にコミットされている状態でハッシュし、クリーンな HEAD で計画を作成し、計画ファイルを単独のコミットとしてコミットします。そのうえで `.gstack/pregate.json` に `"price_file": "evals/gate.calls"` を設定します。

## 関連

- `gstack-eval-plan dry-run --cap <usd>` は、eval のアームについて同じ「確保量が上限内に収まるか」のチェックを行います。対象は 1 回の呼び出し(最も大きい行の入力と出力の予算)で、価格を計算し、上限内に収まる必要があります。
- 結果コード: [EVAL_GATE_UNPRICED](troubleshooting.md#eval-gate-unpriced)、[EVAL_GATE_OVER_CAP](troubleshooting.md#eval-gate-over-cap)、[EVAL_PLAN_STALE](troubleshooting.md#eval-plan-stale)、[EVAL_PRICE_MISSING](troubleshooting.md#eval-price-missing)、[EVAL_DRY_RUN_FAILED](troubleshooting.md#eval-dry-run-failed)。
