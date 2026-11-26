# 棚卸し(census)で赤が出た

定期的な棚卸し(`evals-periodic.yml`: 毎週の定期レーンと gate の棚卸し)や marathon 実行は、赤になった判定をそれぞれ 1 行で報告します。このページでは、その赤い 1 行を、無料のコマンドを優先して診断までたどります。有料の実行は、修正を行った後にのみ許されます。

報告の場所:

- **main**(毎週の定期実行、または main 上でのディスパッチ): 「Weekly periodic evals: red lane needs triage」という、開いている issue へのコメント(marathon の場合は「Weekly marathon evals: red lane needs triage」)。
- **任意のブランチ**: 実行のステップサマリーと、`census-report-a<attempt>` というアーティファクト(marathon の場合は `marathon-report-a<attempt>`)。ブランチの棚卸しが main の issue にコメントしたり、それを閉じたりすることはありません。

## 前提条件

- `bun install` を済ませた、棚卸しのブランチのチェックアウト。テスト済みの Bun のバージョンは 1.4.2 です。
- Actions の読み取り権限を持つ、認証済みの `gh`(または `GH_TOKEN` の設定)。`eval:pass-rates` は REST の zip ルートでアーティファクトをダウンロードします。このルートは、`gh run download` がブロックされている環境でも動きます。
- 実行 ID。報告の一行目にある実行 URL の末尾の数字です。

## 1. 赤い行を読む

棚卸しの報告にある赤い行は次のような形です(一行で、行動パネルで失敗が 1 回だった場合の例です)。

```
✗ plan-review-prosons-neutral-neg  behavior  FAIL 1/3 (✗✗✓)  t1: assertion (session completed; check failed) — expect(received).not.toMatch(expected)  · cause assertion: session completed; check failed  Expected: not /taste call/i · Received: "a taste call"; t2: assertion  [t1@slice 7, t2@slice 9, t3@slice 9, attempt 1]  evidence: paid-slice-7-a1/shards/skill-e2e-plan-prosons--plan-review-prosons-neutral-neg.t1 (fetch: bun run eval:pass-rates --run 37193478719 --case plan-review-prosons-neutral-neg)  after a repair: bun run scripts/test-paid-shards.ts --tier periodic --case plan-review-prosons-neutral-neg --trials 3
```

| フィールド | 内容 |
|---|---|
| case, kind, verdict | レジストリの ID、その種類(`rule`、`behavior`、`judge`)、各試行の結果を含む判定。括弧は各試行のスライスと試行回数を示す |
| `failure_class` | 判定が読み取るクラス: `assertion`、`contract`、`timeout`、`infra` のいずれか |
| `cause` | 機械が観測した内容(`failure_cause`。用語集は [TESTING_INTERNALS](../TESTING_INTERNALS.md#failure-causes))と、その証拠の行 |
| Expected / Received | 失敗したマッチャーの値。judge の場合は、失敗した各ディメンションのゲートの中央値(EVAL_POLICY v3 より前は平均)、しきい値、サンプル数、最も低い根拠 |
| `evidence:` | 文字起こしを含む、スライスのアーティファクトとシャードのディレクトリ |
| `after a repair:` | 修正が存在するようになったら、このケースだけを実行するコマンド |

原因はラベルにすぎません。EVAL_POLICY v1 のもとでは、原因が判定を変えることはありません。`provider_stall` や `refusal` であっても、その試行は失敗のままです。アサーションの失敗が、検出器、ハーネス、プロダクトのいずれの不具合によるものかは、機械の原因ではなく、あなたが行う診断です。

## 2. 証拠を確認する(無料)

```bash
bun run eval:pass-rates --run <run-id>                 # every red of that census
bun run eval:pass-rates --run <run-id> --case <id>     # one case
```

期待される出力: 赤ごとに一つのブロック。履歴とローカルの証拠のパスを含みます。

```
run 37198445662 (main @ 1a2b3c4d5, 2026-10-04T11:29:00Z): 2 verdict red(s)
✗ qa-only/SKILL.md workflow  periodic/full  FAIL  (history: 7/8 verdicts green)
    t1: assertion / cause assertion: session completed; check failed  clarity 3.67 < 4 (3 samples) "…"
    evidence: ~/.gstack/eval-pass-rates-cache/garrytan-gstack/37198445662/paid-slice-5-a1/shards/skill-llm-eval
```

ダウンロードされるのは、赤が指すスライスだけです。保存先は `<state root>/eval-pass-rates-cache/<owner>-<repo>/<run-id>/` です。シャードのディレクトリには eval の記録 JSON(文字起こし、judge のスコア)、`junit.xml`、そして session ledger が導入された後の実行では `session-ledger.jsonl`(各セッションに割り当てられた予算、経過時間、終了理由、生存状況の要約)が入ります。サイズが 64 MB を超えるスライスのアーティファクトは `too large to fetch` と報告されます。その場合は、実行のページから、または `gh api repos/<owner>/<repo>/actions/artifacts/<id>/zip > slice.zip` でダウンロードしてください。

## 3. 文脈に置く(無料)

```bash
bun run eval:pass-rates --reds --runs 10 --branch <branch>      # reds per census by class and cause, all-green probability
bun run eval:pass-rates --headroom --runs 10 --branch <branch>  # slowest session per case vs its armed budget
bun run eval:pass-rates --case <id> --runs 10                   # the case's pass rate per input series
```

`--reds` の最後には、全部緑になる確率が出ます。最新の棚卸しのケース全体について Π(1 − p_i) で計算し、ケースごとの赤の割合は全体の割合に向けて縮小します。これは近似です(判定が独立であることは証明されていません)。複数の棚卸しで赤になるケースは、常習犯です。その修正は構造的なもの(リプレイのコーパス、構造化されたシグナル、または高速化)であり、一度限りの文言の修正ではありません。

不完全なデータが何を意味するかは次のとおりです。

| 表示 | 意味 |
|---|---|
| headroom `unknown (no session ledger)` | 試行が session ledger より前のものか、ランナーがそれを書かなかった。隣に表示されるケースの実時間は上限であり、セッションの時計ではない |
| headroom `insufficient` | セッションのサンプルが 3 未満。決して合格とは読まない |
| headroom `censored` | サンプルがタイムアウトした。実際の所要時間は少なくとも予算以上 |
| cause `unrecorded` | 試行が `failure_cause` の導入前に書かれた |
| cause `unknown` | 試行が、他のどの原因の証拠もないまま失敗した |
| `cost unknown` | ハーネス(PTY、Codex)が課金を記録しない。わかっている合計だけを表示する |
| `history unavailable (...)` | GitHub の履歴を読めなかった。`--gate` は閉じた側で失敗する |

## 4. リプレイと修正(無料)

コードを変更する前に診断します。プロダクトの不具合か、テストや検出器の不具合か、ハーネスの不具合か、インフラか。そのうえで、最も小さい無料のチェックで再現します。

```bash
bun test test/detector-corpus-<case>.test.ts      # cases with a replay corpus
bun run eval:pass-rates --reds --dir <evidence dir>   # re-read downloaded artifacts offline
```

修正には、修正前に失敗し修正後に成功する、無料の回帰テストを添えてください(`AGENTS.md` の「Validation discipline」)。

## 5. 修正の後: 有料の実行を一回

行の `after a repair:` にあるコマンドを実行します。これはそのケースだけを選択します。

```bash
bun run scripts/test-paid-shards.ts --tier periodic --case <id>              # a rule case: one diagnostic trial
bun run scripts/test-paid-shards.ts --tier periodic --case <id> --trials 3   # a behavior case: its 3-trial panel
```

judge の場合は、代わりに `EVALS_JUDGE_SELECTION_JSON=... bun test <file> -t '<pattern>'` というコマンドが表示されます。変更された judge には、3 サンプルのパネルが一つ割り当てられます。

ルール(詳しくは [TESTING_INTERNALS](../TESTING_INTERNALS.md#eval-verdict-policy)):

- 有料の実行は、具体的な修正に続けてのみ行います。赤になった棚卸しを、入力が変わっていないまま再実行することはありません。
- 診断のための実行が判定を下すことはありません。修正されたヘッドでの次の棚卸しが判定します。
- すべての赤が機械によって INFRA または INCOMPLETE に分類された棚卸しは、一度だけ自動的に再ディスパッチされます。両方の実行は報告に残ります。
- 解決されていない赤は、名前付きの赤として、その診断とともに一覧にします。ケースが `CASE_QUARANTINE` に入るのは、そのエントリールールの下にある場合だけです。プロダクトの不具合が隔離されることはありません。
