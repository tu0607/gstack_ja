# gstack v2 — 最も軽量な、意見の明確なスキルパック

## 背景

gstack には、外部で広く知られている「重い」という評判があります。サードパーティのレビュー(dev.to、2026 年 5 月)は、gstack について、「すべてのロールを有効にすると膨れ上がりやすく……実際のコードが書かれる前に 10K トークン以上を消費しうる。日常的な利用ではトークンの消費が速く……簡単な作業でも動作が重く、冗長に感じられる」と明言しています。また Anthropic 自身の標準的な Skills のガイダンスは、「段階的開示」のパターン(`SKILL.md` の骨格 + オンデマンドで読み込まれる `references/`)を推奨していますが、gstack はこれから外れています。

数字もその批判を裏付けています。

- 31 のスキル、生成される SKILL.md の総量は 2.1MB
- 31 のうち 28 のスキルが 40KB のソフトな上限(約 10K トークン/スキル)を超えている
- ship.md は 164KB(約 41K トークン)。一方 ship.md.tmpl はわずか 48KB です。**115KB はリゾルバによって注入されており**、最も効果の大きい圧縮の対象です
- 常時読み込まれるシステムプロンプトのカタログには、50 を超えるスキルの、複数段落にわたる説明、音声トリガー、提案の段落が含まれています

本計画は、gstack v2 を 2 つの連携したリリースで出荷するものです。v1.45.0.0 では基盤と低リスクの改善を提供し、その 2〜4 週間後に v2.0.0.0 で、アーキテクチャの破壊的変更とマーケティングを重視したリポジトリの再定義を出します。この分割は、クロスモデルのレビューから生まれました。Codex は、v2 は実質的な破壊的変更を伴わないポーズにすぎないと主張しました。このハイブリッドな形は、本当に破壊的な `sections/` のパターンにメジャーバージョンアップを与えると同時に、リスクのない改善は直ちに出荷させるものです。

## リリースの形

```
v1.45.0.0 (Foundation Release)          v2.0.0.0 (gstack v2 Launch)
─────────────────────────────           ─────────────────────────────
~1-2 weeks of CC work                   2-4 weeks later, coordinated
                                        
Phase 0: Eval coverage matrix           Phase B: sections/ pattern
  gate + periodic for all 31 skills       on 5 heavyweights
                                          (ship, plan-ceo, office-hours,
Phase A: Build-time compression           plan-eng, plan-design)
  conditional resolver injection
  jargon dedup                          Phase C: Eval annotations
  terse-mode actually compresses          + CI orphan check (WARN→FAIL)
                                        
Catalog trim (Codex high-leverage win)  Lighter-touch migration
  one-line skill descriptions             release note + auto-regenerate
  drop voice triggers/proactive blocks    on /gstack-upgrade
                                        
Hard token budgets defined              Marketing-grade CHANGELOG
  enforced via budget-regression          v1 vs v2 numbers table
                                          README v2 banner
Normal release voice                      "lightest opinionated skill pack"
```

## 前提の確認(Step 0A の結果)

1. **これは正しい問題か?** はい。外部からも裏付けられています。肥大化への批判は引用しやすく、実際のユーザーの痛み(トークンのコスト、遅いセッション)を表しています。何もしなければ、「より軽い」という評判を持つ Cursor や Codex にユーザーを奪われます。
2. **何もしない場合:** 批判は積み重なります。最近のリリース(v1.38 → v1.44)はすべて機能を追加しており、逆方向に進んだリリースはありません。明示的な方向転換がなければ、その評判は固定化します。
3. **実行するリスク:** 遅延セクションのパターンは、新しい種類の、静かな振る舞いの喪失という失敗クラスを持ち込みます。評価を先行させた基盤、機械的な強制、カナリア展開によって緩和します(Phase B の完全性のセクションを参照)。

## 既存のものの再利用(再利用優先の監査)

| 資産 | 再利用 |
|---|---|
| `scripts/gen-skill-docs.ts` の 439-450 行 | すでに文字列の置換とホストごとの抑制を行っている。`appliesTo` のリゾルバゲートで拡張する(約 15 LOC) |
| `scripts/resolvers/types.ts` | `ResolverEntry` の共用体型を追加する |
| `scripts/resolvers/preamble.ts` | すでにティアに応じた合成(1〜4)を行っている。リゾルバごとのゲートを追加する |
| `scripts/jargon-list.json` | すでに単一のファイル。37 回インライン化するのをやめるだけでよい |
| `test/skill-e2e-budget-regression.test.ts`(既存の gate ティア) | スキルごとのハードな予算で拡張する |
| v1.13.2.0 の実 PTY ハーネス | 振る舞いの契約を評価するために再利用する(約 $0.50/評価) |
| SDK ハーネス | 安価な形状の評価に再利用する(可能な限り約 $0/評価) |
| `gstack-upgrade/migrations/` | 状態形式の移行のためのパターンがすでにある。v2 の自動再生成に再利用する |
| `~/.gstack/analytics/skill-usage.jsonl` | すでに収集されている。後回しにした `gstack budget` CLI を支える |

私たちは、新しいパターンを発明しているのではなく、Anthropic の標準的な Skills のパターンに追いついているのです。

## ドリーム状態の差分

```
TODAY                              v1.45.0.0                         v2.0.0.0
──────                             ─────────                         ────────
2.1MB corpus                       ~1.3MB corpus (-40%)              ~700KB corpus (-67%)
ship.md: 164KB                     ship.md: ~80KB (-50%)             ship.md: ~15KB skeleton
                                                                     + 5×~5KB sections
28/31 over 40KB ceiling            ~10/31 over ceiling                ~3/31 over ceiling
                                                                     (cso, document-release,
                                                                      design-consultation
                                                                      kept as monoliths)
Catalog: multi-paragraph           Catalog: one-line per skill        Catalog: one-line per skill
descriptions, voice triggers       (~70% catalog cut)                 (same)
No eval coverage matrix            Every skill: ≥1 gate eval          Section-level eval
                                   + ≥1 periodic eval                 annotations + CI orphan check
"Fat" reputation in third-party    "Compressed, eval-protected"       "Lightest opinionated skill
reviews                            internally measured                pack" externally measured
```

## Phase 0 — 評価のカバレッジ行列(v1.45.0.0)

**目標:** gstack のすべてのスキルが、必須の振る舞いを検証する、少なくとも 1 つの gate ティアの評価と 1 つの periodic ティアの評価を持つこと。評価スイートが設計仕様になる。これが本計画の、重要な主張です。最初に行わなければなりません。

**クロスモデルの緊張関係に注意:** Codex は、これは先延ばしの罠であり、形状のアサーションは浅いと主張しました。ユーザーは、とにかく完全な階層的カバレッジを選びました(D9 = A)。理由は「評価スイートこそが設計仕様である。その約束こそ、計画全体の重要な主張である」というものです。私たちは、より大きな先行投資を受け入れます。

**Codex の「形状と品質」の批判への対応:** オーケストレーション/判断型のスキル(plan-ceo、office-hours、autoplan)については、必須の振る舞いは決定論的な出力ではなく、構造的な準拠です。適切なタイミングで AskUserQuestion を呼んでいるか。セクションの順序に従っているか。成果物を保存しているか。評価は、出力の内容ではなく、構造的な契約を捉えなければなりません。構造的な評価が不可能な場合、そのセクションは「判断に依存し、評価では保護されていない」と明記します。Codex の 2 番目の批判は、保護されていない判断の文章を、それゆえに削除しないことで尊重されます。

**現在、専用の E2E カバレッジがないスキル**(評価を書く対象):

| スキル | gate 評価(目標) | periodic 評価(目標) | 推定コスト/実行 |
|---|---|---|---|
| qa-only | report-only フラグが動作する | 修正ループを無効にした完全な QA フロー | $0.30 / $1.50 |
| retro | 週次の集計がエラーなしで動く | 完全な retro がランク付けされた出力を生成する | $0.20 / $2.00 |
| document-release | CHANGELOG を読み、Diataxis のマップを生成する | リリース後の完全な文書更新 | $0.30 / $1.80 |
| document-generate | プロンプトから 4 種類の文書を生成する | E2E の生成が品質基準を満たす | $0.30 / $2.00 |
| context-save | 期待されるパスに状態を保存する | 往復の復元で文脈が保たれる | $0.10 / $0.50 |
| context-restore | 最新の保存を読み、セッションに適用する | ワークスペースをまたぐ復元が動く | $0.10 / $0.50 |
| gstack-upgrade | インストールの種類を検出し、アップグレードを実行する | 完全なアップグレードと移行の往復 | $0.20 / $1.00 |
| sync-gbrain | エラーなしでインデックスを更新する | 完全な同期で検索可能なコーパスが生成される | $0.20 / $1.50 |
| setup-gbrain | パス 1〜4 の検出が動く | 各パスのエンドツーエンドのセットアップ | $0.20 / $2.00 |
| setup-browser-cookies | ピッカー UI がエラーなしで読み込まれる | Cookie の取り込みの往復 | $0.20 / $1.00 |
| setup-deploy | 設定を検出し、期待されるファイルを書き出す | 完全なデプロイ設定のセットアップ | $0.20 / $1.00 |
| design-consultation | DESIGN.md のテンプレートがレンダリングされる | 完全なデザインシステムの生成 | $0.30 / $2.50 |
| design-shotgun | バリアントが生成され、保存される | 完全な複数バリアントの探索 | $0.30 / $2.00 |
| open-gstack-browser | エラーなしでブラウザが起動する | サイドバーが接続され、アクティビティを表示する | $0.20 / $0.80 |
| pair-agent | セットアップのキーが生成され、手順が表示される | 2 番目のエージェントとの完全なペアリングのフロー | $0.20 / $1.50 |
| land-and-deploy | マージのゲートが正しく確認する | マージ → デプロイ → カナリアの完全なフロー | $0.30 / $3.00 |
| canary | デプロイ後のループが動き、きれいに終了する | アラートのシミュレーションを含む完全なカナリアのサイクル | $0.20 / $1.50 |
| benchmark | 実行され、スコアを生成する | 完全な回帰の検出 | $0.20 / $2.00 |
| plan-devex-review | モードのルーティングが動く | スコアリングを含む完全な DX レビュー | $0.40 / $3.00 |
| devex-review | ライブの DX 監査がスコアカードを生成する | DX の計測を計画のベースラインと比較する E2E | $0.40 / $2.50 |

追加される CI コストの見積もり: **gate で約 $5/実行、periodic で約 $30/実行**。既存の E2E スイート(gate で約 $15、periodic で約 $30)と合わせて、合計は gate(すべての PR)で約 $20、periodic(週次)で約 $60 です。許容範囲です。

**評価の行列の場所:** `test/helpers/skill-coverage-matrix.ts`。スキルごとの gate と periodic の評価テストファイルを対応付ける、唯一の情報源です。`test/skill-coverage-matrix.test.ts` の CI チェックは、いずれかのスキルにエントリがない場合にビルドを失敗させます。

**追加が必要な重要ファイル:**
- `test/skill-coverage-matrix.ts` — スキルから評価のパスへの登録
- `test/skill-e2e-*.test.ts` — 新しいテストファイル 20 本(gate ティアのサブセットは gate の設定に、periodic ティアのサブセットは periodic の設定に入る)
- `test/helpers/touchfiles.ts` — 差分ベースの選択のために新しいテストを登録する

## Phase A — ビルド時の圧縮(v1.45.0.0)

**A.1 条件付きのリゾルバ注入** — `scripts/gen-skill-docs.ts` と `scripts/resolvers/` を拡張する:

```ts
// scripts/resolvers/types.ts
export type ResolverFn = (ctx: TemplateContext, args?: string[]) => string;
export type ResolverEntry = ResolverFn | {
  resolve: ResolverFn;
  appliesTo?: (ctx: TemplateContext) => boolean;
};
```

```ts
// scripts/resolvers/index.ts — gate the heavy ones
QUESTION_TUNING: {
  resolve: generateQuestionTuning,
  appliesTo: (ctx) => ['plan-ceo-review','plan-eng-review','office-hours'].includes(ctx.skillName),
},
REVIEW_ARMY: {
  resolve: generateReviewArmy,
  appliesTo: (ctx) => ['ship','review'].includes(ctx.skillName),
},
REVIEW_DASHBOARD: {
  resolve: generateReviewDashboard,
  appliesTo: (ctx) => ['ship','plan-ceo-review','plan-eng-review','plan-design-review','plan-devex-review','devex-review'].includes(ctx.skillName),
},
// ... audit all 21 resolvers, gate per actual usage
```

```ts
// scripts/gen-skill-docs.ts (~line 444) — check the gate
const entry = RESOLVERS[resolverName];
const resolver = typeof entry === 'function' ? entry : entry.resolve;
const gate = typeof entry === 'function' ? undefined : entry.appliesTo;
if (gate && !gate(ctx)) return '';
return args.length > 0 ? resolver(ctx, args) : resolver(ctx);
```

**A.2 jargon リストの重複排除** — 現在 `scripts/resolvers/preamble/generate-writing-style.ts` は、約 1.8KB の jargon 用語集を 37 スキルにインラインで埋め込んでいます。インラインの代わりに参照に置き換えます: 「jargon の正式な一覧は、初回の使用時に `~/.claude/skills/gstack/scripts/jargon-list.json` を Read してください。」これでコーパス全体で約 66KB 削減されます。

**A.3 terse モードを実際に圧縮する** — `gen-skill-docs.ts` で `~/.gstack/config.yaml` を一度読み、`explainLevel` を `TemplateContext` に渡します。`generate-writing-style.ts`、`generate-completeness.ts`、`generate-confusion-protocol.ts`、`generate-context-health.ts` は terse のとき `''` を返すようにします。現在は、設定にかかわらずバイト列が出荷されており、このフラグは実行時のモデルの振る舞いだけを変えています。ベンチマーク用に `--explain-level=terse` のビルドフラグを追加します。

**A.4 カタログの削減**(Codex #6 に従い前倒し) — 常時読み込まれるシステムプロンプト内のスキルの説明を、スキルごとに 1 行に短くします。音声トリガーはカタログの説明から、スキル内のコンテンツへ移します。提案の段落は、ルーティングのガイダンスが必要なときだけ読み込まれる別ファイル `~/.claude/skills/gstack/scripts/proactive-suggestions.json` に移します。スキルごとの説明の形式は次のとおりです。

```
- <skill-name>: <one-line outcome description, ≤80 chars> (gstack)
```

推定されるカタログの削減: 約 70%(常時読み込まれる最大の単一の削減)。

**A.5 cso/ の対象を絞った圧縮**(Codex #9) — cso はリゾルバの重複排除とカタログの削減を受けます。セキュリティのガイダンスの文章は、Phase B の監査で特定のセクションを評価付きで sections/ に安全に移せると示されるまで、モノリシックのまま圧縮しません。「除外」ではなく、単に最後に回すだけです。

**A.6 ハードなトークン予算**(Codex #10) — `test/skill-e2e-budget-regression.test.ts` で定義して強制します。

| 予算 | v1.44 の実測 | v1.45 の目標 | v2.0 の目標 |
|---|---|---|---|
| カタログの最大トークン数(システムプロンプト) | 約 25K | 約 8K | 約 6K |
| スキルごとの SKILL.md の最大サイズ | 164KB(ship) | 100KB | 30KB(重量級) |
| コーパス全体の最大サイズ | 2.1MB | 1.3MB | 700KB |
| 重量級スキルの初回呼び出しの最大レイテンシ | ほぼ即時 | ほぼ即時 | セクションの読み込み 500ms 未満 |

いずれかの予算を超えると CI が失敗します。既存の予算回帰の jsonl で時系列に追跡します。

## Phase B — 重量級スキルの sections/ パターン(v2.0.0.0)

5 つの重量級スキルを、Anthropic の標準的な骨格 + `sections/*.md` に変換します。

```
ship/
├── SKILL.md              # 12-15KB decision-tree skeleton + section manifest
├── SKILL.md.tmpl         # source for the skeleton
├── sections/
│   ├── manifest.json     # NEW: structured section registry (Codex #3 mitigation)
│   ├── version-bump.md
│   ├── changelog.md
│   ├── review-army.md
│   ├── todos-cleanup.md
│   ├── pr-body.md
│   └── ...
```

**サイレントな振る舞いの喪失への対策**(Codex #3) — 自己チェックだけでなく、多層の防御とします。

1. **セクションのマニフェスト**(`sections/manifest.json`) — 構造化されたレジストリ: `{section_file, applies_when, required_for}`。判断ツリーの骨格は、自由記述の文章ではなく、ID でエントリを参照します。
2. **命令形の骨格の表現** — 「STOP. バージョンの計算の前に `sections/version-bump.md` を Read してください。」「詳細は…を参照」ではない。
3. **ファイル先頭のセクションの索引表** — 状況からセクションのファイルへの対応。
4. **スキル終了時の自己チェック** — 「判断ツリーが示したセクションをすべて Read したことを確認し、一覧にしてください。」(最も弱い層で、フォールバックとして残す)。
5. **評価ハーネスの `requiredReads` 宣言** — E2E テストが、与えられたフィクスチャに対してどのセクションがトランスクリプトの Read 呼び出しに現れなければならないかを検証します。プロンプトの層だけでなく、テストの層で機械的に強制します。
6. **カナリアのコホートでのトランスクリプトの検査** — 出荷後の最初の週に、実際のセッションでどのセクションが読まれたかを記録し、必須と印の付いたセクションの読み取り漏れがあれば警告します。

**変換の順序**(一度に 1 つずつ、次に進む前に検証する):
1. `ship/` — 呼び出しが最も多く、コストが最も大きく、最もリスクが高い。単独で入れ、1 週間観察する。
2. `plan-ceo-review/` — 会話的で、フローを壊すリスクがある。2 番目に入れ、注意深く観察する。
3. `office-hours/` — 最も会話的。1 と 2 がうまくいった場合にのみ 3 番目に入れる。
4. `plan-eng-review/` と `plan-design-review/` — 形が似ているので、まとめて扱う。

**変換しない**(後で明示的に承認されない限り): `autoplan`(すでにスキルを連鎖させているオーケストレーター)、`design-review`(UI のフローはすでに締まっている)、`qa`(単一目的)、`investigate`(単一目的)。

## Phase C — 評価の注釈と CI の孤立チェック(v2.0.0.0)

Codex #4 に従い、即時に厳格なゲートにするのではなく、警告から失敗へ段階的に移行します。

```md
<!-- eval: test/skill-e2e-ship-version-bump.test.ts -->
<!-- coverage: asserts the queue-aware bump picks the next available version when the claimed version is taken -->
```

注釈には、Codex #5 に従い、パスだけでなく**カバレッジの意味**(どの振る舞いが保護されているか)を含めます。パスだけでは、見せかけの安心になります。

`gen-skill-docs.ts` のウォーカーにおける CI チェック:
- v2.0.0.0 は WARN モードで出荷します。孤立したものは PR のサマリーに記録されますが、ビルドは通ります。
- v2.1.0.0(または v2.0 の後 2 回のリリースサイクル)で、WARN を FAIL に格上げします。
- 免除: `<!-- eval: none — accept loss, reviewed YYYY-MM-DD by @user -->`

これにより、意味のない必須の注釈という「メンテナンスの見せかけ」を避け、ユーザーに移行の猶予を与えます。

## 移行の方針(v2.0.0.0、D11 により、より軽いタッチ)

- v2.0.0.0 の CHANGELOG のリリースノートで、sections/ の形式の変更と、具体的なユーザーへの影響を説明します。フォーク、またはコピーされた SKILL.md ファイルは再取得が必要になります。重量級スキルの初回呼び出しでは、約 200〜500ms のセクション読み取りのレイテンシが追加されます。
- `/gstack-upgrade` は、次の呼び出しで自動的に再生成します。対話的な移行プロンプトはありません。
- ベンダリングされたインストールは、v2 に初めて触れたセッションの開始時に、1 行の警告を一度だけ受けます(既存のベンダリングされたインストールの警告パターンを、スキルの preamble で再利用します)。
- 完全な説明を必要とするユーザーのために、`gstack-upgrade --explain-v2` フラグを用意します。

## フォークとカスタマイズの互換性(Codex #11)

v2.0.0.0 のリリースノートに記載します。

- 重量級スキルの SKILL.md を読む、コピーする、直接編集する人: ファイルは骨格になり、振る舞いは `sections/*.md` に入ります。スキルをブラックボックスとして扱うか(推奨)、`sections/` を含む `skill/` ディレクトリ全体をフォークする必要があります。
- フォーク側で SKILL.md.tmpl をローカル編集している人: テンプレートは小さくなり、再生成で競合が起きやすくなります。フォークのドキュメントに移行のガイダンスを追加します。
- 生成された SKILL.md の特定の行にリンクしているドキュメントやブログ記事: 行番号がずれます。行番号ではなく、テンプレートとセクション名にリンクすることを推奨します。

## ロールアウトの戦略(Codex #12)

v1.45.0.0:
- 1 つの PR で入れます。既存の予算回帰テストが、スキルごとのサイズの退行を検出し、評価の行列の CI チェックが、評価のないスキルを検出します。
- ドッグフーディング: 告知の前に、Garry のすべてのワークスペースで 1 週間実際に使います。

v2.0.0.0:
- **カナリアのコホート**: v2.0.0-rc.1 のタグを使って、まずドッグフーディングのユーザー(Garry と、アクティブなエージェント)に出します。実 PTY ハーネスは、上位 5 つのワークフロー(`/ship`、`/qa`、`/review`、`/plan-ceo-review`、`/autoplan`)のセクションの読み取りを記録し、必須セクションの読み取り漏れに警告を出します。
- **手動での検証**: v2.0.0.0 の最終版をタグ付けする前に、上位 5 つのワークフローを手動で実行し、変更前後のトランスクリプトを保存して評価のベースラインにします。
- **回帰のダッシュボード**: 既存の `bun run eval:summary` を、スキルごとのトークン数と振る舞いの準拠について v1 と v2 を比較するように拡張します。
- **ロールバック**: PR を revert し、`bun run gen:skill-docs` で古い形式を再生成します。CONTRIBUTING.md に文書化します。

## レビューのセクションの指摘(セクション 1〜11、要約)

| セクション | 指摘 | 状態 |
|---|---|---|
| 1. アーキテクチャ | 遅延セクションによる静かな喪失のリスク。6 層の防御で緩和 | 計画に反映済み |
| 2. エラーと救済 | gen-skill-docs のゲート失敗は大きく通知する。セクションの欠落はスケルトンにフォールバックする。CI の孤立チェックは大きく通知する | 反映済み |
| 3. セキュリティ | cso は全面的な除外ではなく、対象を絞った重複排除(Codex #9)。移行スクリプトは、既存の移行と同じユーザーのシェルの信頼境界で動く | 反映済み |
| 4. データ/UX のエッジケース | v1 から v2 への操作の癖の変化はリリースノートで警告。ベンダリングされたインストールは 1 行の警告。並行する開発用シンボリックリンクのセッションのリスクは、既存の CLAUDE.md の注意事項 | 反映済み |
| 5. コード品質 | gen-skill-docs/types/index にまたがって約 150 LOC の追加。新しい評価テストファイル約 20 本。sections/ の抽出は機械的 | 問題なし |
| 6. テスト | Phase 0 がテスト計画そのもの。カバレッジ行列の CI ゲートで、すべてのスキルに評価があることを強制する | 反映済み |
| 7. パフォーマンス | ビルド時間は現在の 2 倍未満。セクションの重量級スキルの実行時は初回呼び出しで 200〜500ms 追加。カタログの削減で、すべてのセッションで常時読み込まれるプロンプトのサイズが縮小する | 記録済み |
| 8. 可観測性 | 予算回帰のテストは既存。Phase B のカナリアのコホートでトランスクリプトのセクション読み取りを記録。移行の結果は ~/.gstack/analytics/migrations.jsonl に記録 | 反映済み |
| 9. デプロイ | 2 つのリリースへの分割 + 警告から失敗への段階的移行の評価注釈 + revert によるロールバック | 反映済み |
| 10. 長期的な方向性 | 可逆性 3/5。sections/ のパターンは今後のスキルのテンプレートになる。延期された TODO が v2.1 以降の物語を拡張する | 問題なし |
| 11. デザイン/UX | README の v2 バナーと CHANGELOG の数値の表を v2.0.0.0 に含める。具体的な数値、gstack の声、AI 特有の空虚な表現はなし | 問題なし |

## 対象外

- **スキルの削除。** ユーザーは「すべての機能を残す」と言いました。qa-only、design-shotgun、pair-agent、open-gstack-browser はすべて残ります。他と同じく、評価とカタログの削減を受けます。
- **スキルの名前変更。** `qa` → `qa-fix` のような統合はしません。CLI の表面は安定させます。
- **gstack の lite/pro インストールプロファイル。** v2 の後の TODO に延期します。
- **gstack budget CLI。** v2 の後の TODO に延期します。
- **README のスキルごとの評価カバレッジのバッジ。** TODO に延期します。
- **クロスツールの移植性のテスト/デモ(Codex/Cursor の互換性)。** TODO に延期します。
- **スキル呼び出し時のトークンコストのプレビュー。** TODO に延期します。
- **スキルの自動ロードのテレメトリ。** TODO に延期します。
- **gstack の diff の PR コメント。** TODO に延期します。

## TODOS.md の更新(延期された項目。マージ後にまとめて追加することを推奨)

| TODO | 優先度 | 工数(人/CC) | 依存先 |
|---|---|---|---|
| `gstack lite` インストールプロファイル(5 スキルのコア) | P2 | 2 日 / 3〜4 時間 | v2.0.0.0 |
| `gstack pro` のオプトインのアップグレードの道筋 | P2 | 1 日 / 1 時間 | gstack lite |
| `gstack budget` CLI(スキルごとのトークン使用量のテレメトリ) | P2 | 1 日 / 1 時間 | v1.45.0.0 |
| `gstack-skills list` と README のスキルごとの評価カバレッジのバッジ | P3 | 1 日 / 1 時間 | Phase 0 |
| クロスツールの移植性のテスト/デモ(Codex CLI、Cursor) | P3 | 2 日 / 2 時間 | v2.0.0.0 |
| スキル呼び出し時のトークンコストのプレビュー | P3 | 1 日 / 1 時間 | gstack budget CLI |
| スキルの自動ロードのテレメトリ(使われていないスキルの検出) | P3 | 2 日 / 2 時間 | v1.45.0.0 |
| `gstack diff` の PR コメント(PR ごとの予算の差分) | P3 | 1 日 / 1 時間 | 予算回帰の拡張 |
| ユーザーに見えるセクション単位の評価の注釈(信頼度のシグナル) | P3 | 半日 / 30 分 | Phase C |

## 重要ファイル

| パス | 変更 | Phase |
|---|---|---|
| `scripts/gen-skill-docs.ts` | リゾルバのゲートのチェックを追加(約 444 行目)。config から explain_level を読む。CI の孤立ウォーカーを追加 | A、C |
| `scripts/resolvers/types.ts` | `ResolverEntry` の共用体型を追加 | A |
| `scripts/resolvers/index.ts` | 重いリゾルバを `appliesTo` の述語で包む(21 個すべてを監査) | A |
| `scripts/resolvers/preamble/generate-writing-style.ts` | インラインの jargon を置き換える。terse のとき `''` を返す | A |
| `scripts/resolvers/preamble/generate-completeness.ts` | terse のとき `''` を返す | A |
| `scripts/resolvers/preamble/generate-confusion-protocol.ts` | terse のとき `''` を返す | A |
| `scripts/resolvers/preamble/generate-context-health.ts` | terse のとき `''` を返す | A |
| `scripts/skill-catalog.ts`(新規。または gen-skill-docs の中) | 1 行のカタログの生成器と、音声トリガーの JSON への分割 | A.4 |
| `scripts/proactive-suggestions.json`(新規) | 音声トリガーと提案。オンデマンドでのみ読み込む | A.4 |
| `test/skill-coverage-matrix.ts`(新規) | 唯一の情報源となる評価のレジストリ | Phase 0 |
| `test/skill-coverage-matrix.test.ts`(新規) | CI のゲート: すべてのスキルにエントリがあること | Phase 0 |
| `test/skill-e2e-*.test.ts`(約 20 の新規ファイル) | カバレッジのないスキルの新しい評価 | Phase 0 |
| `test/skill-e2e-budget-regression.test.ts` | スキルごとのハードな予算で拡張 | A.6 |
| `test/helpers/touchfiles.ts` | 差分ベースの選択のために新しいテストを登録 | Phase 0 |
| `ship/SKILL.md.tmpl` → `ship/sections/manifest.json` + `ship/sections/*.md` | 骨格の抽出 | B |
| `plan-ceo-review/SKILL.md.tmpl` → sections/ | 骨格の抽出 | B |
| `office-hours/SKILL.md.tmpl` → sections/ | 骨格の抽出 | B |
| `plan-eng-review/SKILL.md.tmpl` → sections/ | 骨格の抽出 | B |
| `plan-design-review/SKILL.md.tmpl` → sections/ | 骨格の抽出 | B |
| `gstack-upgrade/migrations/v2.0.0.0.sh`(新規) | 自動再生成 + ベンダリングされたインストールの警告 | B |
| `CHANGELOG.md` | v1.45.0.0 のエントリ(通常の文体)、v2.0.0.0 のエントリ(数値の表を伴うマーケティング向け) | A、B |
| `README.md` | v2.0.0.0 のバナー。「最も軽量な、意見の明確なスキルパック」という位置づけ | B |
| `CONTRIBUTING.md` | sections/ パターンとロールバックの手順を文書化 | B |

## 検証

**v1.45.0.0:**
1. `bun run gen:skill-docs` がエラーなしで成功する
2. `bun test` が通る(skill-validation、gen-skill-docs.test.ts、browse の統合、新規の skill-coverage-matrix.test.ts)
3. `bun run test:evals` が通る。新しい gate 評価がすべて緑で、既存の評価に退行がない
4. `bun run test:evals:periodic` が通る。新しい periodic 評価がすべて緑
5. カタログのシステムプロンプトのサイズを計測する。目標は 8K トークン以下(現在は約 25K)。修正前後を PR 本文に記録する
6. SKILL.md コーパス全体のバイト数。目標は 1.3MB 以下(現在は 2.1MB)。PR 本文に記録する
7. 最も重いスキル上位 3 つが 100KB 未満
8. 手動のスモークテスト: 新しい Claude Code のセッションで `/ship`、`/plan-ceo-review`、`/office-hours` を呼び出し、欠けている振る舞いがないことを確認する。トランスクリプトを v1.45 のベースラインとして保存する

**v2.0.0.0:**
1. v1.45 のすべてのチェックが通る
2. セクション化されたスキル: コーパス全体が 700KB 以下、重量級の骨格はそれぞれ 30KB 以下
3. `test/skill-e2e-ship-section-loading.test.ts`(新規): `/ship` が判断ツリーどおりに期待されるセクションを読むことを検証する
4. カナリアのコホート: v2.0.0-rc.1 で 1 週間ドッグフーディングし、トランスクリプトを記録する。必須と印の付いたセクションの読み取り漏れがゼロ
5. 上位 5 つのワークフローを手動で検証し、トランスクリプトを v1.45 のベースラインと比較する
6. 移行: v1.45 のインストールに対して `gstack-upgrade` を実行すると、プロンプトなしで正しく再生成される。ベンダリングされたインストールには警告が 1 回だけ出る
7. CHANGELOG の数値の表が、実測の結果と一致する
8. WARN モードの孤立チェック: PR のサマリーに孤立したリストが表示され、ビルドは通る

## 採用した、クロスモデルの合意事項

Codex のレビューから受け入れ、上で取り込んだ項目:

- #4 警告から失敗への段階的な評価の注釈(Phase C)
- #5 パスだけでなく、注釈コメントにカバレッジの意味を含める
- #6 カタログの削減を Phase A に前倒し(以前は sections/ の後ろに埋もれていた)
- #9 cso はリゾルバの重複排除とカタログの削減を受ける(全面的な除外ではない)
- #10 ハードなトークン予算を定義し、強制する(Phase A.6)
- #11 フォークとカスタマイズの互換性を文書化する(移行のセクション)
- #12 カナリアのコホートと、上位 5 つのワークフローの手動検証を含むロールアウトの戦略(ロールアウトのセクション)

ユーザーが明示的に却下した、Codex のレビューの項目(D9、D10):
- #1 評価を先行させる範囲: ユーザーは階層的なカバレッジを完全に残しました。構造的な評価のガイダンス(出力の内容ではなく、孤立したスキルや判断のスキルのための)で緩和します。
- #7 v2.0.0.0 と v1.x の選択: ユーザーはハイブリッドを選びました。v1.45 が低リスクの改善を取り込み、v2.0.0.0 が本当に破壊的な sections/ の変更を担います。

ユーザーが、元の選択肢より Codex の案を受け入れた項目:
- #8 移行の方針: 低リスクの作業を v1.45 が取り込んだ後、ユーザーはハードカット(D7)から、より軽いタッチ(D11)へ移りました。

## 実装タスク

このレビューの指摘から統合。各タスクは、上記の Phase/指摘のいずれかに由来します。T1〜T8 は v1.45.0.0 に入り、T9〜T16 は v2.0.0.0 に入ります。

- [ ] **T1 (P1, 人: 約 3 日 / CC: 約 7 時間)** — Phase 0 / カバレッジ行列 — カバレッジのない 20 スキルすべてに gate + periodic の評価を書く
  - 由来: Phase 0 のセクション
  - ファイル: `test/skill-coverage-matrix.ts`、`test/skill-coverage-matrix.test.ts`、新規の約 20 本の `test/skill-e2e-*.test.ts`、`test/helpers/touchfiles.ts`
  - 検証: `bun test test/skill-coverage-matrix.test.ts` と `bun run test:evals` の両方が、新しい評価とともに通る
- [ ] **T2 (P1, 人: 約 1 日 / CC: 約 1 時間)** — A.1 条件付きのリゾルバ注入 — `appliesTo` のゲートを追加
  - 由来: Phase A のセクション、Codex #10(アーキテクチャの前に計測)
  - ファイル: `scripts/resolvers/types.ts`、`scripts/gen-skill-docs.ts:444`、`scripts/resolvers/index.ts`
  - 検証: `bun run gen:skill-docs` でより小さな SKILL.md が生成される。`bun test` が通る
- [ ] **T3 (P1, 人: 約半日 / CC: 約 30 分)** — A.2 + A.3 jargon の重複排除 + ビルド時の terse モードの圧縮
  - 由来: Phase A のセクション
  - ファイル: `scripts/resolvers/preamble/generate-writing-style.ts`、`generate-completeness.ts`、`generate-confusion-protocol.ts`、`generate-context-health.ts`
  - 検証: jargon リストが生成された SKILL.md にインラインで現れない。`gstack-config set explain_level terse && bun run gen:skill-docs` でより短いファイルが生成される
- [ ] **T4 (P1, 人: 約 1 日 / CC: 約 2 時間)** — A.4 カタログの削減 — スキルごとに 1 行の説明。音声トリガーと提案の段落を JSON に移す
  - 由来: Codex #6(最も効果が大きい)、Phase A.4
  - ファイル: `scripts/skill-catalog.ts`(新規)、`scripts/proactive-suggestions.json`(新規)、スキルごとの `SKILL.md.tmpl` のフロントマターの 1 行説明フィールド
  - 検証: カタログのシステムプロンプトのサイズが 8K トークン未満。音声トリガーによる呼び出しが引き続き動く
- [ ] **T5 (P1, 人: 約半日 / CC: 約 30 分)** — A.6 予算回帰でのハードなトークン予算
  - 由来: Codex #10
  - ファイル: `test/skill-e2e-budget-regression.test.ts`
  - 検証: テスト用の SKILL.md を人為的に膨らませると、予算回帰が失敗する
- [ ] **T6 (P1, 人: 約 1 日 / CC: 約 1 時間)** — A.5 cso のリゾルバの重複排除 + カタログの削減(より広い圧縮ではない)
  - 由来: Codex #9
  - ファイル: `cso/SKILL.md.tmpl`(構造の変更はなし。リゾルバのゲートの監査のみ)
  - 検証: cso の SKILL.md のサイズが 20〜30% 減る。cso の E2E 評価が引き続き通る
- [ ] **T7 (P1, 人: 約 1 日 / CC: 約 1 時間)** — すべての SKILL.md を一括で再生成し、計測する
  - 由来: Phase A
  - ファイル: すべての `*/SKILL.md` を再生成
  - 検証: PR 本文に、修正前後のコーパスのサイズ、サイズ上位 10 のスキル、カタログのサイズを含める。予算回帰で目標が達成されたことを確認する
- [ ] **T8 (P2, 人: 約半日 / CC: 約 30 分)** — v1.45.0.0 の CHANGELOG のエントリ(通常の文体。Phase 0 と Phase A が入ったことを記す)
  - 由来: リリースの形のセクション
  - ファイル: `CHANGELOG.md`、`VERSION`
  - 検証: CHANGELOG がリントを通る。新しい順の並びが保たれる。エントリが差分を網羅している

- [ ] **T9 (P1, 人: 約 2 日 / CC: 約 3 時間)** — Phase B.1 ship/ を骨格 + sections/ に変換
  - 由来: Phase B のセクション
  - ファイル: `ship/SKILL.md.tmpl` → 骨格。`ship/sections/manifest.json` + `ship/sections/*.md`
  - 検証: 新規の `test/skill-e2e-ship-section-loading.test.ts` が、判断ツリーごとに期待される Read を検証する。既存の ship の評価が通る。ship.md の骨格が 15KB 未満
- [ ] **T10 (P1, 人: 約 1 日 / CC: 約 1 時間)** — ship/ のカナリアのコホート(v2.0-rc.1 で 1 週間ドッグフーディング)
  - 由来: ロールアウトの戦略のセクション、Codex #12
  - ファイル: `test/helpers/transcript-section-logger.ts`(新規)
  - 検証: ドッグフーディングのトランスクリプトで、必須と印の付いたセクションの読み取り漏れがゼロ
- [ ] **T11 (P1, 人: 約 2 日 / CC: 約 3 時間)** — Phase B.2 plan-ceo-review/ を変換(ship/ の実績の後)
  - 由来: Phase B のセクション
  - ファイル: `plan-ceo-review/SKILL.md.tmpl` + `plan-ceo-review/sections/`
  - 検証: セクション読み込みのテストが緑。plan-ceo の評価が通る
- [ ] **T12 (P2, 人: 約 3 日 / CC: 約 4 時間)** — Phase B.3 + B.4 office-hours/、plan-eng-review/、plan-design-review/ を変換
  - 由来: Phase B のセクション
  - ファイル: それぞれの `SKILL.md.tmpl` + `sections/` ディレクトリ
  - 検証: セクション読み込みのテストが緑。それぞれの評価が通る
- [ ] **T13 (P1, 人: 約 1 日 / CC: 約 1 時間)** — Phase C の評価の注釈と、WARN モードの CI 孤立チェック
  - 由来: Phase C のセクション、Codex #4 + #5
  - ファイル: `scripts/gen-skill-docs.ts`(孤立のウォーカー)、すべての `sections/*.md`(カバレッジの意味を持つ注釈)
  - 検証: 孤立チェックが PR のサマリーで正しく報告する。WARN モードでビルドが通る
- [ ] **T14 (P1, 人: 約半日 / CC: 約 30 分)** — `gstack-upgrade/migrations/v2.0.0.0.sh` より軽いタッチの自動再生成
  - 由来: 移行の方針のセクション
  - ファイル: `gstack-upgrade/migrations/v2.0.0.0.sh`
  - 検証: v1.45 のインストールからのアップグレードで、プロンプトなしに正しい v2 の状態になる。ベンダリングされたインストールは 1 行の警告を受ける
- [ ] **T15 (P1, 人: 約半日 / CC: 約 1 時間)** — 数値の表を伴う、v2.0.0.0 のマーケティング向けの CHANGELOG
  - 由来: D5、リリースの形、Codex #7(実際の破壊的変更を文書化する)
  - ファイル: `CHANGELOG.md`、`VERSION`、`README.md`(v2 のバナー)
  - 検証: 数値の表が計測されたコーパスと一致する。リリースノートが、具体的な破壊的変更を文書化する(sections/ の形式の変更、初回呼び出しのレイテンシ、ベンダリングされたインストールの非推奨)。位置づけは、肥大化という評判を過去のものとして扱う
- [ ] **T16 (P2, 人: 約 1 日 / CC: 約 1 時間)** — 延期された 9 件の TODO を TODOS.md にまとめて追加(gstack lite、gstack budget など)
  - 由来: TODOS.md の更新のセクション
  - ファイル: `TODOS.md`
  - 検証: TODOS の形式が `.claude/skills/review/TODOS-format.md` と一致する

## 失敗モードの登録簿

| コードパス | 失敗モード | 救済されたか | テストがあるか | ユーザーに見えるもの | 記録 |
|---|---|---|---|---|---|
| gen-skill-docs.ts のゲートのチェック | リゾルバの `appliesTo` が例外を投げる | はい — try/catch でログを出し、リゾルバをスキップする | はい(test/gen-skill-docs.test.ts を拡張) | ビルドの出力に「resolver X errored, skipped」 | stderr |
| sections/ の実行時の読み取り | セクションのファイルがない | はい — エージェントは骨格だけの振る舞いにフォールバックする | はい(test/skill-e2e-ship-section-loading.test.ts) | エージェントの文章に警告 | セッションのトランスクリプト |
| CI の孤立ウォーカー | sections/*.md に評価の注釈がない | v2.0 は WARN モード。v2.1 以降は FAIL | はい(test/skill-coverage-matrix.test.ts) | PR のサマリーに孤立の一覧 | PR コメント |
| 移行スクリプト v2.0.0.0.sh | 壊れたインストールで再生成が失敗する | はい — スクリプトは中断し、修復の手順を表示する | はい(移行のテスト) | 明確なエラーと修復の手順 | ~/.gstack/analytics/migrations.jsonl |
| カタログの 1 行の生成器 | スキルのフロントマターに 1 行の説明がない | はい — gen-skill-docs がビルドを大きく失敗させる | はい(gen-skill-docs.test.ts を拡張) | ビルドエラー | stderr |
| カナリアのセクション読み取りのロガー | 重量級スキルのロガーがない | はい — 黙ってスキップされ、ギャップはダッシュボードに見える | はい(トランスクリプトのロガーのテスト) | 直接は何もない。カナリアのダッシュボードで表面化する | ~/.gstack/analytics/section-reads.jsonl |

重大なギャップはありません。すべての失敗モードに救済、テスト、可視性があります。

## 図

システムアーキテクチャ(ビルドのパイプライン):
```
  CONFIG (~/.gstack/config.yaml)
     |
     v
  +-----------------+      +--------------------+
  | gen-skill-docs  | <--- | resolvers/*.ts     |
  | (with gate)     |      | (w/ appliesTo)     |
  +-----------------+      +--------------------+
     |
     v
  +--------------------------+
  | SKILL.md.tmpl per skill  |
  | + sections/manifest.json | (heavyweights only, v2)
  | + sections/*.md          | (heavyweights only, v2)
  +--------------------------+
     |
     v
  +--------------------+         +--------------------------+
  | generated SKILL.md | <-----> | scripts/jargon-list.json |
  | (skeleton for      |         | (referenced, not inlined)|
  |  heavyweights v2)  |         +--------------------------+
  +--------------------+
     |
     v
  +-------------------+      +----------------------+
  | catalog (system   | <--- | proactive-suggestions|
  |  prompt, one-line |      | .json (loaded on     |
  |  per skill)       |      |  demand only)        |
  +-------------------+      +----------------------+
```

セクション読み取りのフロー(v2 の実行時):
```
  USER /ship
     |
     v
  +-----------------------+
  | ship/SKILL.md         |
  | (12-15KB skeleton)    |
  | reads:                |
  |  - manifest.json      |
  |  - decision tree      |
  +-----------------------+
     |
     v  Agent walks decision tree, identifies which sections apply
     |
     +-----> Read sections/version-bump.md   (if bumping)
     +-----> Read sections/changelog.md      (if writing entry)
     +-----> Read sections/review-army.md    (if pre-ship review)
     +-----> ... only sections that apply
     |
     v
  +-------------------------+
  | end-of-skill self-check |
  | "list sections I read"  |
  +-------------------------+
     |
     v  Canary cohort: transcript-section-logger compares
     |  actual Reads vs manifest's required_for declarations
     |  alerts on miss
```

## 古くなった図の点検

CLAUDE.md / ARCHITECTURE.md にある ASCII 図のうち、この計画が影響するもの:

| 図 | ファイル | v2 の後も正確か |
|---|---|---|
| サイドバーのメッセージフロー | `docs/designs/SIDEBAR_MESSAGE_FLOW.md` | はい(無関係のサブシステム) |
| デュアルリスナーのトンネルのアーキテクチャ | `ARCHITECTURE.md` | はい(無関係) |
| サーバーの出口での Unicode のサニタイズ | `ARCHITECTURE.md` | はい(無関係) |
| (スキルのビルドパイプラインの図はない) | — | 上の新しい図は更新ではなく新規 |

古くなった図はありません。

## 完了の要約

```
+====================================================================+
|            MEGA PLAN REVIEW — COMPLETION SUMMARY                   |
+====================================================================+
| Mode selected        | SCOPE EXPANSION                              |
| System Audit         | bloat externally documented; prior design   |
|                      | doc unrelated; budget-regression infra exists|
| Step 0               | EXPANSION + Approach C + eval-first +       |
|                      | hybrid v1.45/v2.0 split + lighter migration |
| Section 1  (Arch)    | 1 finding — silent-loss risk, 6-layer mit   |
| Section 2  (Errors)  | 6 failure modes mapped, 0 CRITICAL GAPS     |
| Section 3  (Security)| cso targeted dedup (Codex #9 absorbed)      |
| Section 4  (Data/UX) | v1→v2 muscle memory warned, vendored noted  |
| Section 5  (Quality) | ~150 LOC additive, mechanical extraction    |
| Section 6  (Tests)   | Phase 0 IS the test plan                    |
| Section 7  (Perf)    | <2× build time; +200-500ms first-invoke v2  |
| Section 8  (Observ)  | budget-regression + canary + migrations.log |
| Section 9  (Deploy)  | 2-release split + warn-before-fail + revert |
| Section 10 (Future)  | Reversibility 3/5; sections/ becomes template|
| Section 11 (Design)  | README banner + numbers table              |
+--------------------------------------------------------------------+
| NOT in scope         | written (9 items deferred)                   |
| What already exists  | written (9 reuse points)                    |
| Dream state delta    | written (TODAY / v1.45 / v2.0)              |
| Error/rescue registry| 6 modes, 0 CRITICAL GAPS                    |
| Failure modes        | covered in registry                         |
| TODOS.md updates     | 9 items, bulk-add post-merge                |
| Scope proposals      | 3 surfaced, 1 accepted (launch positioning) |
| CEO plan             | this plan IS the CEO plan                   |
| Outside voice        | ran (codex); 3 tensions surfaced            |
| Lake Score           | 11/11 recommendations chose complete option |
| Diagrams produced    | 2 (build pipeline, section-read flow)       |
| Stale diagrams found | 0                                           |
| Unresolved decisions | 0                                           |
+====================================================================+
```

## エンジニアレビューの追記(/plan-eng-review のセッションから)

### 確定したアーキテクチャの決定

- **D1(マニフェストの形式):** `sections/manifest.json` は、重量級スキルごとの構造化されたレジストリです(JSON。gen-skill-docs の CI チェックが機械的に読めるように)。SKILL.md の骨格は、Markdown の見出しと命令形の文章のブロックです(「STOP. X の場合は、`sections/Y.md` を Read する」)。Anthropic が文書化している `references/` のスタイルに合わせます。独自の DSL は作りません。
- **D2(ドリフトの制御):** `sections/*.md.tmpl` が正式なソースで、`sections/*.md` は生成されます。gen-skill-docs は `<skill>/sections/*.tmpl` を走査し、SKILL.md と同じリゾルバのパイプラインを使って `<skill>/sections/*.md` を書き出します。コストは `scripts/gen-skill-docs.ts` で約 30 LOC です。これにより、`test/ship-version-sync.test.ts` がすでに抱えているドリフトのクラスを解消します(TODOS:1120)。
- **D3(CI のコスト上限):** `EVALS_BUDGET_HARD_CAP=$30` の環境変数を `test/skill-e2e-budget-regression.test.ts` が強制し、1 回の実行がこれを超えるとビルドが失敗します。セクション読み込みのテスト(Phase B)は、最小限の bash のフィクスチャ(約 $0.30 each)を使います。出力の品質ではなく、構造的な振る舞い(正しいファイルを Read したか)を検証するからです。

### 隣接する TODO(情報提供のみ。ブロックはしない)

- **TODOS:161** — ブラウザスキル向けの「セッション開始時のリゾルバ注入」を計画中(P2)。この計画の `appliesTo` の述語と、設計上の重なりがあります。判断: 当面は別々に保つ。ブラウザスキルのリゾルバ注入は実行時(セッション開始時のホスト名の照合)で、我々の `appliesTo` はビルド時(gen-skill-docs.ts)です。ライフサイクルも関心事も違うためです。ブラウザスキルの作業が同じ述語の形を必要とする場合にのみ見直す。
- **TODOS:1120** — `test/ship-version-sync.test.ts` は、ship/SKILL.md.tmpl の Step 12 の bash を再実装しています。D2(sections/*.md.tmpl のパイプライン)が構造的な修正です。Phase B の作業でこの TODO は不要になります。ship の抽出が入ったら解決済みとしてマークする。
- **TODOS:1136** — ship/SKILL.md.tmpl の Step 12 の 409 行目にある `git show` のフォールバック。Phase B はこれに触れるため、バージョン上げのセクションの抽出に `git rev-parse --verify` の修正をまとめる。

### テストプラン成果物

テストプランは `~/.gstack/projects/garrytan-gstack/garrytan-garrytan-slim-skill-tokens-eng-review-test-plan-<timestamp>.md` に書き出されます。`/qa` と `/qa-only` は、これを主要なテスト入力として使用します。対象は、フェーズごとのテストカバレッジ目標、セクション読み込みテスト用のフィクスチャ設計、CI の予算強制チェック、マイグレーションのラウンドトリップテストです。

### 失敗モードの追加

§Failure Modes の登録簿(すでに完了)に追加します(新しい行のみ):

| 処理経路 | 失敗モード | 救済? | テスト? | ユーザーに見える内容 | ログ記録 |
|---|---|---|---|---|---|
| sections/*.md.tmpl ジェネレーター | テンプレートが存在しないリゾルバを参照する | Y — gen-skill-docs がビルドで大きく失敗する | Y (gen-skill-docs.test.ts を拡張) | ビルドエラー | stderr |
| マニフェストとファイルシステムの整合性 | マニフェストが存在しない sections ファイルを参照する | Y — CI チェックが失敗する | Y (新規 `test/section-manifest-consistency.test.ts`) | ビルドエラー | PR サマリー |
| マニフェストとファイルシステムの整合性 | sections ファイルは存在するが、マニフェストに含まれない(孤立) | v2.0 では WARN、v2.1 以降は FAIL | Y (同じテスト) | PR サマリー | PR コメント |
| 予算上限の超過 | 単一のテストまたは合計が `EVALS_BUDGET_HARD_CAP` を超える | Y — CI が失敗する | Y (budget-regression を拡張) | コストの内訳付きのビルドエラー | stderr |

重大なギャップは依然として 0 件です。新しい失敗モードはすべて、救済・テスト・可視化を備えています。

### 実行順序(v1.45 は順次、v2.0 は統合ブランチ)

v1.45 は単一ブランチで**順次**実行し、T1 → T8 の順に進めます。並列化マップは、codex の 2 回目のレビューで、T2(gen-skill-docs.ts の TemplateContext 変更)と T4(カタログの frontmatter 追加)がコンパイル時にほぼ確実に互いに影響すると指摘されたため、再検討しました。どちらのブランチも単独では通るのに、統合時に失敗するおそれがあるためです。順次実行のほうがきれいに着地し、3 方向マージによる想定外の事態を避けられます。AI による圧縮があるので、順次実行の実時間コストは許容できます。

| ステップ | 触れるモジュール | 依存先 |
|---|---|---|
| T1 フェーズ 0 の評価(約 20 ファイル) | `test/skill-e2e-*.test.ts`, `test/skill-coverage-matrix.ts`, `test/helpers/touchfiles.ts` | — |
| T2 条件付きリゾルバゲート | `scripts/gen-skill-docs.ts`, `scripts/resolvers/types.ts`, `scripts/resolvers/index.ts` | T1 |
| T3 用語の重複排除と簡潔化の圧縮 | `scripts/resolvers/preamble/*` | T2 |
| T4 カタログの削減 | `scripts/skill-catalog.ts`, `scripts/proactive-suggestions.json`, すべての SKILL.md.tmpl の frontmatter | T2 |
| T5 厳格なトークン予算とオーバーライド経路 | `test/skill-e2e-budget-regression.test.ts`(スイートごとの上限 + `EVALS_BUDGET_OVERRIDE_REASON`) | T1 |
| T6 cso の対象を絞った重複排除 | `cso/SKILL.md.tmpl` | T2, T3 |
| T7 すべての SKILL.md をアトミックに再生成 | すべての `*/SKILL.md` | T1-T6 |
| T8 v1.45 の CHANGELOG | `CHANGELOG.md`, `VERSION` | T7 |
| **— v1.45.0.0 リリース境界 —** | | |
| T9 ship/ の sections/ 抽出 | `ship/SKILL.md.tmpl`, `ship/sections/*`, gen-skill-docs(TemplateContext 契約を持つ sections パイプライン) | T8 + sections パイプライン(T2/D2) |
| T10 ship/ のカナリアコホート | `test/helpers/transcript-section-logger.ts` | T9 |
| T11 plan-ceo-review の sections/ | `plan-ceo-review/SKILL.md.tmpl` + sections | T10(ship/ で実証済み) |
| T12 office-hours・plan-eng・plan-design の sections/ | 各ディレクトリ | T11 |
| T13 フェーズ C の評価アノテーションと 3 段階の孤立チェック | gen-skill-docs.ts の孤立ファイル探索、すべての sections/*.md | T9-T12 |
| T14 マイグレーションスクリプト | `gstack-upgrade/migrations/v2.0.0.0.sh` | T13 |
| T15 v2.0.0.0 の CHANGELOG と README バナー | `CHANGELOG.md`, `README.md`, `VERSION` | T14 |
| T16 TODOS の一括追加 | `TODOS.md` | — いつでも |

**実行の推奨:** v1.45(T1→T8)と v2.0(T9→T15)の両方について、単一のワークツリーで順次実行します。T16 はいつ入れてもかまいません。CC による高速化は並列ブランチによるものではなく、各ステップの圧縮(各ステップ約 1 時間。人間なら数日かかる作業に相当)から来ます。

## Codex 相談の追加事項(2 回目、eng-review 後)

### Cathedral パリティ評価スイート(フェーズ 0 の追加項目、「11」に拡張)

ユーザーは「10 ではなく 11 にして。目一杯、さらにその先までやって」と言いました。最大化したスコープは次のとおりです。

- **全 31 スキル**にゴールデンベースラインのトランスクリプトを取得(上位 5 件だけではない)
- **スキルごとに複数のフィクスチャ**(代表的な呼び出し経路を 3〜5 件ずつ)
- **定量と定性の両方の採点:** LLM 判定による類似度スコア(1〜10)と、トランスクリプトの差分のハイライト(追加・削除されたセクション、欠けているニュアンス)
- **トークン効率の比率を測定:** 品質あたりのトークン効率 = 判定スコア / 消費トークン数(v2 が単に小さくなるだけでなく、測定可能な形で効率的になることを強制する)
- **トークン予算と並ぶ「品質予算」:** 両方を CI で強制する。サイズを半分に圧縮しても品質が 9/10 から 6/10 に落ちた v2 のスキルはゲートで失敗する
- **並べて比較する PR コメント:** 重量級スキルに触れるすべての PR で、v1.45 ベースラインと現在のパリティ比較を PR サマリーに自動投稿する
- **公開ベンチマークページ:** 新規の `gstack.benchmarks.md` を継続的に更新する。引用できる文言の例: 「v2 の平均パリティスコア: 9.2/10、平均トークン削減率: 67%」
- **継続監視:** パリティスイートを main で週次実行し、いずれかのスキルがベースラインを下回った場合にアラートを出す(Discord の Webhook など)
- **ベースライン取得スクリプト:** `test/helpers/capture-parity-baseline.ts`。フェーズ A の作業が入る前に、v1.44 の HEAD で一度実行してゴールデンのトランスクリプトを固定する

工数: 人間で約 3〜4 日 / CC で一度きり約 6〜8 時間 + 継続監視に週あたり約 $30。コストは正当化できます。これは、セクション読み込みテストも予算テストも取りこぼす「見た目は緑、でも体感は悪化」という静かな回帰を捕まえられる唯一の仕組みだからです。T1 の前に、新しいタスク T0a(ベースライン取得)と T0b(パリティ評価ハーネス)を追加します。

### Codex 相談から取り込んだ改善(ユーザーの追加判断は不要)

1. **sections パイプラインの TemplateContext 契約(codex D2 の指摘):** T9 で明示的な仕様が必要。sections の生成には、SKILL.md の生成と同じ `TemplateContext` を使う。同じ `skillName`、同じホスト抑制、同じ `explainLevel`、同じ階層ゲート。コードのコメントに記録し、`test/template-context-parity.test.ts`(新規)で検証する。
2. **3 段階の孤立分類(codex の孤立の意味づけに関する指摘):** CI チェック(T13)は次を区別する:
   - **生成済みの孤立ファイル**(`sections/foo.md` は存在するが `sections/foo.md.tmpl` がない) → すべてのリリースで即座に FAIL
   - **マニフェストの孤立**(`sections/foo.md.tmpl` は存在するが `manifest.json` に含まれない) → v2.0 では WARN、v2.1 以降は FAIL
   - **手で編集された生成ファイル**(`sections/foo.md` が、再生成で得られる内容と食い違う) → 「this file is generated, edit `.tmpl` instead」(このファイルは生成されたものです。代わりに `.tmpl` を編集してください)というメッセージとともに即座に FAIL
3. **予算上限のオーバーライド経路(codex D3 の指摘):** `EVALS_BUDGET_HARD_CAP=$30` をデフォルトにする。スイートごとの上限は `EVALS_BUDGET_HARD_CAP_GATE=$25` と `EVALS_BUDGET_HARD_CAP_PERIODIC=$70` で指定する。上限を超えるには `EVALS_BUDGET_OVERRIDE_REASON="<text>"` 環境変数が必要(CI はビルド出力に理由を表示し、監査証跡とする)。既存の分析(`~/.gstack/analytics/skill-usage.jsonl` の集計)で、組織全体の 1 日あたりの支出アラートも出す。
4. **マニフェストは受動データとして扱う(codex D1 の指摘):** `manifest.json` のフィールドは ID、ファイルパス、人が読めるトリガーの文言だけにする。`applies_when` のような述語は入れない。「いつ X を読むか」を決めるのは、スキルのスケルトンにある判断ツリーの文章だけにする。階層ゲート、`appliesTo`、`requiredReads` に加えて第 4 の条件言語を作らないため。
5. **T7 を統合ブランチのフローとする案(codex の並列化に関する指摘。順次実行により不要):** 順次実行なので、T7 は単に「単一の v1.45 ブランチ内でアトミックに再生成する」ことになる。codex の指摘の意図(3 方向マージの想定外の事態を避ける)は、順次実行に集約することで満たされる。

### 新しい失敗モード(登録簿への追加)

| 処理経路 | 失敗モード | 救済? | テスト? | ユーザーに見える内容 | ログ記録 |
|---|---|---|---|---|---|
| Sections パイプラインの TemplateContext | 食い違ったコンテキストで sections が生成される(例: 誤った skillName) | Y — パリティテストが失敗する | Y (`test/template-context-parity.test.ts`) | ビルドエラー | stderr |
| 手で編集された生成済みセクション | ユーザーが `.tmpl` ではなく `sections/foo.md` を直接編集する | Y — 明示的なメッセージとともに CI が失敗する | Y (3 段階の孤立分類チェック) | 「this file is generated, edit `.tmpl` instead」(このファイルは生成されたものです。代わりに `.tmpl` を編集してください) | PR サマリー |
| 品質予算の超過 | v2 のスキルは圧縮されたが、LLM 判定のパリティで 2 点超低下した | Y — CI が失敗する | Y (パリティ評価スイート) | 「v2 X.md は v1.45 ベースラインに対して 9.2 から 6.4 に低下」 | diff 付きの PR コメント |
| 予算上限オーバーライドの監査 | EVALS_BUDGET_OVERRIDE_REASON が使用された | N(意図的な逃げ道) | Y (監査ログのテスト) | 理由が CI の出力に表示され、spend-audit jsonl に記録される | analytics/spend-overrides.jsonl |
| main でのパリティベースラインのずれ | 週次の継続監視が回帰を検出する | Y — Discord アラート + チケット | Y (継続監視のテスト) | チームチャンネルにアラート | analytics/parity-drift.jsonl |

重大なギャップは依然として 0 件です。

## v2 ローンチ用コピーの仕様(/plan-devex-review より)

以下の草案が v2.0.0.0 ローンチのトーンの正とされます。T15 では、作業中に実測でより良い案が得られない限り、これをそのまま実装します。より良い案が得られた場合は、計画と実装の両方を同時に更新します。

### JUST_UPGRADED 通知(ペルソナ A — 既存ユーザーのアップグレード)

`gstack-update-check` が `JUST_UPGRADED v1.x v2.0.0.0` を表示したときに発動します。v1 の汎用メッセージ「Running gstack v{to} (just updated!)」を、体感速度の改善を示し、かつ「あなたの手癖は今も使えます」と伝えるペルソナ A 向けの文言に置き換えます。

```
Running gstack v2.0.0.0 (just updated!) — your sessions are now ~67% lighter.
Heavyweight skills load only the sections they need; the catalog dropped to
one line per skill. Everything still works the same way — your /ship, /qa,
/review commands haven't changed. Run `/gstack-upgrade --explain-v2` for the
full migration story, or just keep working.
```

守った文体ルール: 冒頭に成果を置く(「67% 軽量」)、具体的な数値、ワークフローは変わらないという安心感(「everything still works the same way」)、逃げ道(`--explain-v2`)。エムダッシュは使わない。5 秒で読めることを狙う。

実装: `~/.claude/skills/gstack/gstack-upgrade/SKILL.md.tmpl` のインラインアップグレードフローを、v2 に対応したメッセージに更新します。既存の `JUST_UPGRADED <from> <to>` 検出が、スキルのプリアンブルで発火します。

### CHANGELOG の数値表(ペルソナ A の「魔法の瞬間」とペルソナ B の評価根拠)

CHANGELOG.md の `## [v2.0.0.0]` エントリに、見出しのすぐ下で掲載します。フェーズ A の開始前に `test/helpers/capture-parity-baseline.ts` で取得したベースラインの v1.44 実測値と、v2.0.0.0 の実測値を比較します。数値は推定ではなく実測値でなければならず、T15 でプレースホルダーを置き換えます。

| 指標 | v1.44.1(ベースライン) | v2.0.0.0(実測) | Δ |
|---|---|---|---|
| SKILL.md 全体のコーパス | 2.1 MB | 約 700 KB | **−67%** |
| ship.md(最も重い) | 164 KB | 約 15 KB のスケルトン + 約 5 KB の sections × 5 | **初回読み込みで −76%** |
| plan-ceo-review.md | 131 KB | 約 12 KB のスケルトン + 必要に応じて sections | **初回読み込みで −68%** |
| office-hours.md | 111 KB | 約 10 KB のスケルトン + 必要に応じて sections | **初回読み込みで −71%** |
| カタログのトークン数(常時読み込まれるシステムプロンプト) | 約 25K トークン | 約 6K トークン | **−76%** |
| 呼び出しごとのトークン数(典型的な /ship セッション) | 約 41K | 約 14K のスケルトン + 必要に応じて sections | **約 60% 減** |
| 評価カバレッジ(E2E で保護されたスキル) | 31 件中約 16 件 | **31 件中 31 件 + パリティベースライン** | 品質ゲートを有効化 |
| v1.44 ベースラインに対するパリティスコア(LLM 判定、全 31 スキル) | — | **9.0/10 以上の下限** | (CI で強制。パリティ評価スイートを参照) |

表の下に、gstack の語り口で一段落を入れます: 「v1 は最も重量級の、意見の強いスキル集でした。v2 は最も軽量です。圧縮はタダではありません。すべてのスキルが gate 層と periodic 層の両方の E2E 評価を備え、継続的なパリティ監視が静かな品質低下を捕まえます。上記の数値は `test/helpers/parity-baseline-v1.44.1/` を基準に測定したもので、`bun run eval:parity` で再現できます。」

### README の v2 バナー

配置: README.md の先頭、既存の Karpathy のプルクオートの直下、「When I heard Karpathy say this...」の上。ローンチ後 60 日間はこの位置に残し、その後はクイックスタートセクションの「v2 released May 2026」という 1 行の記載に畳みます。

```markdown
> **gstack v2.0.0.0 — the lightest opinionated skill pack (May 2026)**
>
> Heavyweight skills now load only the sections they need. Total SKILL.md
> corpus dropped from 2.1 MB to ~700 KB. Every skill ships with E2E eval
> protection and a continuous parity-monitor against v1.44 baselines.
> See the [v2.0.0.0 release notes](CHANGELOG.md) for per-skill numbers and
> the migration story. Existing users: `/gstack-upgrade` auto-regenerates.
```

守った文体ルール: 立場を冒頭に置く(「the lightest opinionated skill pack」)、具体的な数値(2.1 MB → 700 KB)、厳密さの証拠(E2E 評価による保護とパリティ監視)、明示的な移行経路。エムダッシュは使わない。10 秒で読めることを狙う。

### 実装上の注意(T15 向け)

- フェーズ A の再生成が始まる前に、実際の v1.44 ベースライン数値を `test/helpers/parity-baseline-v1.44.1/` に固定してください。「v1 と v2 の差分」が正確に引用できるのは、v1.44 が同じ単位(tiktoken によるトークン数、`wc -c` によるバイト数、`test/skill-coverage-matrix.ts` による評価カバレッジ)で測定されている場合だけです。
- 実測の v2 数値が上の草案より見劣りする場合(例: ship.md が 15 KB ではなく 25 KB になる)、草案を実態に合わせて更新してください。数値を捏造してはいけません。読者が `wc -c` で反証できる数値を見つけた瞬間に、マーケティング向けの「ここぞ」の場面は台無しになります。
- JUST_UPGRADED 通知は、既存の `gstack-upgrade` 検出によって自動的に発火します。新たな仕組みは不要です。
- 既存の Karpathy の引用より上に README バナーを置くのは意図的です。ペルソナ B(新規の評価者)は、Karpathy の枠組みより前に v2 の成果を目にし、「これは 2026 年 5 月時点で最新の gstack だ」という印象を持てます。

## GSTACK レビューレポート

| レビュー | トリガー | 目的 | 実行回数 | ステータス | 指摘事項 |
|---|---|---|---|---|---|
| CEO レビュー | `/plan-ceo-review` | スコープと戦略 | 1 | CLEAR | SCOPE_EXPANSION モード。拡張案 3 件(1 件採用: v2 ローンチの位置づけ、2 件保留: gstack lite、gstack budget)。11/11 セクションをレビュー。重大なギャップ 0 件 |
| Codex レビュー | `/codex review` | 独立したセカンドオピニオン(外部の視点) | 1 | issues_found | 指摘 12 件。うち 7 件を計画に反映(#4, #5, #6, #9, #10, #11, #12)。3 件をユーザー判断に回した(#1 ユーザーは元の選択を維持、#7 ハイブリッド分割を採用、#8 ユーザーが codex の案を受け入れ) |
| Eng レビュー | `/plan-eng-review` | アーキテクチャとテスト(必須) | 1 | CLEAR | アーキテクチャ上の決定を 3 件確定(D1 JSON マニフェスト、D2 sections/*.md.tmpl パイプライン、D3 CI のコスト上限)。新たな失敗モードを 4 件追加(すべて救済・テスト済み)。テストプラン成果物を作成。並列化マップを作成(v1.45 は 3 レーンで並列、v2.0 は順次)。重大なギャップ 0 件、未解決の決定 0 件 |
| Codex 相談(2 回目) | `/codex`(eng-review の追加事項について相談) | D1/D2/D3 と並列化の独立した検証 | 1 | issues_found | eng-review の追加事項に対する追加指摘 7 件。うち 5 件を反映(TemplateContext の契約、3 段階の孤立分類、予算上限のオーバーライド経路、マニフェストは述語ではなく受動データとして扱う、T7 の統合フローは順次実行により不要に)。2 件をユーザー判断に回した(注意機構のリスク → 「11」として cathedral パリティ評価スイートを追加、並列化は codex の指摘どおり v1.45 の順次実行に集約) |
| デザインレビュー | `/plan-design-review` | UI/UX のギャップ | 0 | — | 不要(重要な UI の範囲はなし。README/CHANGELOG のみ) |
| DX レビュー | `/plan-devex-review` | 開発者体験のギャップ | 1 | CLEAR | DX POLISH モード。製品の種類 = Claude Code Skill。2 つのペルソナを同等に追跡(既存ユーザーのアップグレード者と新規の評価者)。ローンチ用コピーの仕様を計画に追加したことで、初期 7.9/10 → 9.0/10 に改善(JUST_UPGRADED 通知、CHANGELOG の数値表、README v2 バナーをすべて T15 の成果物として草案化)。8 つのパスをすべて評価し、スキルの DX チェックリストに合格 |

**CODEX:** 1 回目(CEO): 指摘 12 件、7 件を反映、3 件をクロスモデルでユーザー判断、2 件をタスクに組み込み。2 回目(eng-review 後): 指摘 7 件(D1/D2/D3 の追加事項について)、5 件を反映、2 件をユーザー判断。両方の回を監査証跡として残しています。codex の指摘は計 19 件で、12 件は問題なく反映、両回で計 5 件をユーザー判断、2 件を使い勝手の改善としてタスクに組み込みました。DX レビューでは新たな codex の回を省略しました(それ以前の 3 回で構造上の盲点は網羅済みで、残る DX 作業はコピーの書き方が中心です。ここでは codex よりユーザーの好みのほうが価値があります)。

**CROSS-MODEL:** (a) フェーズ分割、(b) 計測ファースト(厳格なトークン予算とオーバーライドの監査証跡)、(c) フォーク・ロールアウト戦略の欠落について、強い一致が見られました。全パスを通じた対立点は次のように解決しました: 評価ファーストのスコープ(ユーザーが維持)、v2 と v1.x(ハイブリッドを採用)、移行の重さ(軽めの対応を採用)、並列化(ユーザーが codex の順次実行の指摘を受け入れ)、注意機構のリスク(ユーザーがスコープを拡張し、トークン予算と並べて品質予算を持つ、全 31 スキルを対象とした cathedral パリティ評価スイートを追加)、ローンチ用コピーの成果物(ユーザーが 3 つすべてを計画に草案化し、T15 の実装に回さず)。

**UNRESOLVED:** 5 件すべてのレビューを通じて、未解決の決定は 0 件です。

**VERDICT:** CEO + ENG + CODEX×2 + DX が CLEAR — 実装可能です。v1.45/v2.0 のハイブリッド分割により、「重量級」という評判の問題を抑えられます。sections/*.md.tmpl パイプライン(D2)は乖離を防ぎます。CI のコスト上限と監査付きオーバーライド(D3 と codex の取り込み改善)は、評価費用の暴走を防ぎます。cathedral パリティ評価スイート(codex の 2 回目)は、セクション読み込みとトークン予算のテストだけでは取りこぼす、注意機構の静かな回帰を捕まえます。codex の指摘を受けて順次実行とした v1.45 は、統合の安全性と引き換えに実時間を犠牲にします。v2 のローンチ用コピーの仕様(DX レビュー)により、既存のアップグレード者(ペルソナ A)と新規の評価者(ペルソナ B)の両方に、マーケティング向けの「ここぞ」の場面が伝わります。計画は実行可能な状態になりました。
