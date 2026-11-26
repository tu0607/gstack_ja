# gstack 開発

## コマンド

```bash
bun install          # install dependencies
bun run dev <cmd>    # run CLI in dev mode, e.g. bun run dev goto https://example.com
bun run typecheck    # strict tsc over product code (zero errors required)
bun run typecheck:test  # test-code type-debt ratchet
bun run build        # gen docs + compile binaries
bun run gen:skill-docs  # regenerate SKILL.md files from templates
bun run skill:check  # health dashboard for all skills
bun run dev:skill    # watch mode: auto-regen + validate on change
bun run slop          # full slop-scan report (all files)
bun run slop:diff     # slop findings in files changed on this branch only
bun run audit:manifest  # file slices for /claude-api prompt-audit; rerun it at each frontier-model release (CONTRIBUTING.md)
```

テストと eval のコマンド、そのコスト、必要な条件は、1 つの表にまとめられています:
[Which command do I run?](CONTRIBUTING.md#which-command-do-i-run)。最もよく使うのは `bun run test`(無料の受け入れテスト)と `bun run eval:bg:pr`(有料、変更箇所のカバレッジ)の 2 つです。`test:evals` や `test:e2e` などの廃止された名前は、置き換え先を表示して終了コード 1 で終わります。

有料の eval には `ANTHROPIC_API_KEY` が必要です。Codex の E2E テスト(`test/codex-e2e.test.ts`、`test/codex-e2e-sol-scope.test.ts`)は Codex 自身の認証を使います。hermetic なランナーは `${CODEX_HOME:-~/.codex}` から `auth.json` だけをコピーし、子プロセスの環境で `CODEX_HOME` を固定します。`OPENAI_API_KEY` 環境変数は不要です。

**Hermetic な E2E と環境変数のキー:** すべての E2E ランナーは、子プロセスを `test/helpers/hermetic-env.ts` 経由で起動します(許可リストで環境変数を絞り込み、新たにシードされた `CLAUDE_CONFIG_DIR`、一時的な `GSTACK_HOME`、`--strict-mcp-config`)。テストごとの `env:` の上書きは、完全な hermetic 環境の最後にマージされるため、安全に使えます。`/skill` コマンドを入力する PTY テストは、`seedSkills: true` を指定する必要があります。実際のオペレーターの状態に対してデバッグするには `EVALS_HERMETIC=0` を使います。詳細(env-shim、シードの番兵、配線のテスト):
[docs/TESTING_INTERNALS.md](docs/TESTING_INTERNALS.md)。

**テストの選択とティア:** 有料のシャード化されたランナー(`test:pr`、`eval:bg:pr`、`test:gate:sharded`)は、`test/helpers/touchfiles.ts` の依存リストを通じて `git diff` からテストを選びます(`EVALS_ALL=1` で全件を強制、`eval:select` で PR プロファイルを確認、`--profile full` で素のタッチファイル選択を確認できます)。新しい E2E テストは、必ず `E2E_TIERS` で分類してください。安全上のガードレールや決定的な機能テストは `gate`、品質のベンチマーク、Opus モデルのテスト、非決定的なテスト、外部サービス(Codex、Gemini)は `periodic` です。`test/e2e-tier-alignment.test.ts` がティアを強制します。CI のレーンと periodic からの除外:
[docs/TESTING_INTERNALS.md](docs/TESTING_INTERNALS.md#test-selection-and-tiers)。

## テスト

```bash
bun run test         # final full free acceptance after focused repairs and source freeze
bun run eval:bg:pr   # required changed PR coverage, with explicit deferrals
```

[AGENTS.md の検証の規律](AGENTS.md#validation-discipline)に従ってください。まず集中したチェックで修正を証明し、必要な選択的な評価を完了させ、最終的に統合したコードに対して無料の全件テストを 1 回実行します。修正の作業中は、コミットのたびに全件テストを回すのではなく、集中したチェックで代えてください。

`bun run test` は `scripts/test-free-shards.ts` を経由します。このスクリプトは、シャードごとに厳密な判定を行い、bun の要約行がないシャードを失敗扱いにします。`TREE_MUTATING` には、独立した末尾の直列シャードで実行されるファイルが列挙されています(現在は `test/bootstrap-retention.test.ts` のみ)。スイート全体に素の `bun test` を使わないでください。リポジトリ全体を走査し、有料の eval ファイルを読み込み、厳密な判定をすり抜けてしまいます。`bun run test:pr` は、選択された短いライブの動作テストと品質の審査員を実行し、広範なカバレッジの延期を報告します。無料の全件テストと必須の PR チェックは、公開前にすべて通っている必要があります。コマンドと測定の目標は[テスト方針](CONTRIBUTING.md#test-tiers)を参照してください。Aside 自体が必要なテストは、Mac で Aside アプリが開いていない限り自動的にスキップされます。シャードのパッキング、審査員の再利用、エンジンのスキップ:
[docs/TESTING_INTERNALS.md](docs/TESTING_INTERNALS.md#free-suite-runner-judge-reuse-and-engine-skips)。

新規または変更したテストは、[テストの価値の基準](docs/test-value-bar.md)に従ってください。各テストは、実際の回帰で壊れうる振る舞いを守るものでなければなりません。契約テスト(SKILL.md のゴールデンファイル、および下で定義する「プロンプトのバイト列の契約」)は残します。この基準の定義元は `scripts/resolvers/test-value.ts` です。

このリポジトリでは、プロンプトのバイト列が契約になるのは、ソフトウェアがそれを読む場合(パーサー、フック、審査員、または別のスキルが正確なテキストを消費する場合)か、記録された eval によって言い回しが結果に影響することが示されている場合だけです。スキルのテンプレートと生成された SKILL.md に対するテストでは、構造、ステップの順序、ルーティングの表、機械が読むマーカー、安全に関わる行を固定します。安全に関わる行は、大文字と小文字を区別せず、表記ではなく意味で確認します。振る舞いは E2E のケースと審査員に任せてください。強調、大文字小文字、Issue の番号、振る舞いの確認ですでにカバーされている文を固定しないでください。書き換えで固定した文が変わる場合は、新しい文を固定するのではなく、構造的または意味レベルのチェックに置き換えてください。用語の定義は [docs/test-value-bar.md](docs/test-value-bar.md)(「Prompt-byte contract」「Sentence pin」)にあります。テンプレートや SKILL.md のチェックには `test/helpers/prompt-structure.ts`(`between`、`expectTokens`、`expectAbsent`、`expectOrdered`、`expectMentions`)を使ってください。トークンと順序は完全一致、安全に関するルールは、1 つの文の中での大文字小文字を区別しないキーワードの同時出現で確認します。
プロジェクトは、`/ship` のカバレッジゲートを、任意の CLAUDE.md の `## Test Coverage` キーで調整できます。既定ではすべて未設定です: `Minimum:`、`Target:`、`Generation cap:`(既定 5)、`Base control:`(`auto` または `off`)、`Base control budget:`(秒単位、既定 90)、`Star rating:`(`auto` または `off`)。

## プロジェクト構成

完全な注釈付きのツリーは [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) にあります。
概要: `browse/` は gstack 独自のヘッドレスブラウザ CLI(フォールバックのエンジン)で、`/browse` スキルを含みます。`design/` はデザインのバイナリ、`make-pdf/` は PDF のバイナリ、`hosts/` は型付きのホスト設定です。`scripts/` はビルドと開発者体験のツールです(gen-skill-docs、リゾルバー。`resolvers/aside.ts` が Aside の契約です)。`test/` は検証と eval、`lib/` は共有ライブラリです(`aside-render.ts` はローカルの HTML を Aside で描画し、失敗時はエンジンにフォールバックします。`design-catalog.ts` は、すべてのデザインスキルが描画に使う型付きのデザインのアンチパターンのカタログです)。`bin/` は CLI ユーティリティです(`gstack-render.ts` はスキルが呼び出す描画 CLI、`gstack-design-detect.ts` と `gstack-design-md.ts` はデザインの検出ツールと open-DESIGN.md のツールです)。`extension/` は Chrome 拡張機能、スキルごとに 1 つのディレクトリ(`ship/`、`review/`、`qa/` など)、`.github/` は CI、`contrib/` は貢献者向けのツール、`docs/designs/` は設計ドキュメントです。

## SKILL.md のワークフロー

SKILL.md ファイルは `.tmpl` テンプレートから**生成**されます。ドキュメントを更新するには:

1. `.tmpl` ファイルを編集します(例: `SKILL.md.tmpl` や `browse/SKILL.md.tmpl`)
2. `bun run gen:skill-docs` を実行します(`bun run build` を実行すると自動的に行われます)
3. `.tmpl` と生成された `.md` ファイルの両方をコミットします

同じ `gen:skill-docs` の実行で、`lib/` から 2 つの生成ファイルも書き出されます。`review/design-checklist.md`(`lib/design-catalog.ts` から、`scripts/resolvers/design-checklist.ts` を経由して生成)と `lib/dom-dump.js`(`lib/dom-dump-script.ts` から生成)です。カタログまたはスクリプトのソースを編集し、再生成して、両方をコミットしてください。生成されたファイルを直接編集してはいけません(`test/design-checklist-sync.test.ts` がずれを検出して失敗します)。

生成では、`--model` が明示されていない限り、各ホストの `defaultModel` を使います(ほとんどのホストは `claude`、Codex は `gpt`、Antigravity の `agy` は `gemini`)。Codex のインストールでは、`${CODEX_HOME:-~/.codex}/config.toml` のトップレベルのモデルも読み込みます。このモデルを変更したら `./setup --host codex` を再実行してください。注意: `bun run build` と、素の `gen:skill-docs --host codex` は、ホストの既定(gpt)で描画します。Codex の config.toml で別のモデルを指定している場合は、プロファイルを復元するために `./setup --host codex` を再実行してください(単一の所有者による永続化は TODOS.md に登録されています)。

スキル内のブラウザ操作は、`scripts/resolvers/aside.ts` に従う `aside repl` スクリプトです。それぞれにフォールバックのエンジン用の `$B` による同等の処理が付きます。ブラウザコマンドを追加するには、`browse/src/commands.ts` に追加して再ビルドします。スナップショットのフラグを追加するには、`browse/src/snapshot.ts` の `SNAPSHOT_FLAGS` に追加して再ビルドします。スキルのテンプレートでのローカル HTML の描画は、`bun run ~/.claude/skills/gstack/bin/gstack-render.ts` の呼び出しで行います。新しい描画オプションは、(フォールバックを処理する) `lib/aside-render.ts` に追加してください。スキル独自の bash に書いてはいけません。

**サイズの予算:** 生成された SKILL.md は 160KB(約 40K トークン)を超えると警告を出します。`test/catalog-budget.test.ts` は、常に読み込まれるスキルのカタログを `CATALOG_BUDGET_TOKEN_EQUIVALENTS`(現在 1,475、スキルを追加するたびに引き上げる)で上限設定します。`test/context-budget-ratchet.test.ts` は、スキルごとのトークン上限を `test/fixtures/context-budget.json` に対して固定します(正当な増加や削減を反映するには、`bun test/helpers/capture-context-budget.ts` を再実行し、更新したフィクスチャを同じコミットでコミットしてください)。理由と手順:
[docs/CONTRIBUTOR_REFERENCE.md](docs/CONTRIBUTOR_REFERENCE.md#skill-size-budgets)。

**SKILL.md ファイルのマージコンフリクト:** 生成された SKILL.md ファイルのコンフリクトを、どちらか一方を採用して解決してはいけません。代わりに、(1) `.tmpl` テンプレートと `scripts/gen-skill-docs.ts`(真の情報源)のコンフリクトを解決し、(2) `bun run gen:skill-docs` を実行してすべての SKILL.md を再生成し、(3) 再生成したファイルをステージしてください。片方の生成結果を採用すると、もう一方のテンプレートの変更が黙って失われます。

## プラットフォームに依存しない設計

スキルは、フレームワーク固有のコマンド、ファイルのパターン、ディレクトリ構造を**決してハードコードしてはいけません**。代わりに次のようにします:

1. プロジェクト固有の設定(テストコマンド、eval コマンドなど)は **CLAUDE.md を読みます**
2. 無ければ **AskUserQuestion** で尋ねます。ユーザーに教えてもらうか、gstack にリポジトリを探索させます
3. 答えを **CLAUDE.md に保存**して、二度と尋ねなくて済むようにします

これはテストコマンド、eval コマンド、デプロイコマンド、その他のプロジェクト固有の振る舞いすべてに当てはまります。設定はプロジェクトが持ち、gstack がそれを読みます。

## SKILL テンプレートの書き方

SKILL.md.tmpl ファイルは、Claude が読む**プロンプトのテンプレート**であり、シェルスクリプトではありません。bash のコードブロックはそれぞれ別のシェルで実行されるため、変数はブロック間で引き継がれません。

ルール:
- **ロジックと状態は自然言語で扱います。** シェル変数を使ってコードブロック間で状態を受け渡してはいけません。代わりに、Claude に覚えておくべき内容を伝え、それを散文の中で参照します(例: 「ステップ 0 で検出したベースブランチ」)。
- **ブランチ名をハードコードしないでください。** `main`/`master` などは `gh pr view` や `gh repo view` で動的に検出します。PR を対象とするスキルでは `{{BASE_BRANCH_DETECT}}` を使います。散文では「ベースブランチ」と書き、コードブロックのプレースホルダーでは `<base>` を使います。
- **bash のコードブロックは自己完結させます。** 各コードブロックは単独で動くべきです。ブロックが前のステップの文脈を必要とする場合は、その直前の散文で改めて書いてください。
- **条件分岐は英語で表現します。** bash で入れ子の `if/elif/else` を書く代わりに、番号付きの判断ステップとして書きます: 「1. X なら Y を行う。 2. そうでなければ Z を行う。」

## 文章スタイル(V1)

tier 2 以上のすべてのスキルの既定の出力は、`scripts/resolvers/preamble/generate-writing-style.ts` の文章スタイルのセクションに従います。初めて出てくる専門用語には注釈を付けます(厳選されたリストは `scripts/jargon-list.json` にあり、スキルは最初の専門用語に出会った時点で実行時にそれを読みます)。質問は、実装の用語ではなく、結果の観点で組み立てます(例: 「これが間違っていた場合、ユーザーに何が起きますか」)。文は短くし、判断はユーザーへの影響で締めくくります。より簡潔な V0 の文体を求めるパワーユーザーは `gstack-config set explain_level terse` を設定できます(中間のモードはない二択のスイッチです)。設計の背景は `docs/designs/PLAN_TUNING_V1.md` を参照してください。writing-style と同時に進める予定だったレビューのペース配分の改修は V1.1 に切り出されました。`docs/designs/PACING_UPDATES_V0.md` を参照してください。

## ブラウザの操作

gstack は、まず Aside AI ブラウザ(macOS 15 以降)を使い、Aside がない場合は独自のブラウザエンジンにフォールバックします。ブラウザを操作する必要がある場合(QA、ドッグフーディング、ページの確認)は、`/browse` スキルを使ってください。このスキルは Aside の有無を確認し、`READY` であれば Aside を駆動します。Aside はユーザーの実際のブラウザで、実際のセッションを使います。操作は `scripts/resolvers/aside.ts`(`{{ASIDE_SETUP}}`)の契約に従う `aside repl` スクリプトで行います。すべてのブラウザ系スキル(`/qa`、`/qa-only`、`/design-review`、`/canary`、`/benchmark`、`/scrape`)も同じ方法で動きます。スキル内の Web 調査は、WebSearch ツールより先に Aside のエージェント(`{{ASIDE_RESEARCH}}`)を通します。プローブが `NEEDS_ASIDE` または `ASIDE_NOT_RUNNING`(Linux、Windows、Aside アプリが閉じている場合)を返すと、スキルは `{{BROWSE_FALLBACK}}` に従って `$B` を解決し、代わりに browse バイナリを実行します。この文脈では `$B <command>` は正当なツールです。Cookie のインポート、GStack Browser のヘッドモード、`/pair-agent`、browser-skills/`/skillify` はこの場面に属します。スキル自身が生成したローカルの HTML(make-pdf、diagram、デザインのプレビュー)は、`bin/gstack-render.ts` / `lib/aside-render.ts` を通して描画されます。これらはループバック上でファイルを配信し、Aside で印刷またはスクリーンショットを撮ります。Aside がない場合はエンジンで処理します。描画ツールをサイトに向けてはいけません。`mcp__claude-in-chrome__*` ツールは決して使わないでください。遅く、信頼性が低く、このプロジェクトで使うものではありません。

**サーバー / サイドバー / 拡張機能の内部:** `browse/src/server.ts`、`extension/`、サイドバーの PTY、SSE エンドポイント、CDP セッションのコードを編集する前に、[docs/BROWSER_INTERNALS.md](docs/BROWSER_INTERNALS.md) を読んでください。サイドバーのメッセージの流れ、WebSocket の認証、トンネルのデュアルリスナーのルール、出力時の Unicode のサニタイズ、SSE/CDP のヘルパー、セットアップのシンボリックリンクの強化、サイドバーのセキュリティ構成がすべて書かれており、それぞれ CI の番兵テストで固定されています。

**マシン外へのすべての送信先での送信記録(egress receipts)**(v1.63.0.0 以降)。gstack が起動するマシン外への送信はすべて、送信の**前に**記録を書かなければなりません。TypeScript の呼び出し元は `lib/egress-receipt.ts` の `writeReceipt` を使います。シェルスクリプトは `bin/gstack-egress-lib.sh` を読み込み、`_receipted_curl` / `_receipted_git` を使います。`test/egress-receipt-wiring.test.ts` は、記録のない新しい送信先があると CI を失敗させます。失敗時の扱い、スキャナーの除外、`_aside_exec` ラッパーについては、[docs/CONTRIBUTOR_REFERENCE.md](docs/CONTRIBUTOR_REFERENCE.md#egress-receipts) を参照してください。

## 開発時のシンボリックリンクに関する注意

gstack を開発する際、`.claude/skills/gstack` はこの作業ディレクトリへのシンボリックリンクになっている場合があります(gitignore 済み)。その場合、スキルの変更は**即座に反映されます**。素早く反復する場合には便利ですが、大規模なリファクタリングでは、書きかけのスキルが同時に動いている他の Claude Code セッションを壊すおそれがあり危険です。

**セッションごとに一度確認してください:** `ls -la .claude/skills/gstack` を実行して、シンボリックリンクか実体のコピーかを確認します。作業ディレクトリへのシンボリックリンクである場合は、次の点に注意してください:
- テンプレートの変更と `bun run gen:skill-docs` は、gstack のすべての呼び出しに即座に影響します
- SKILL.md.tmpl ファイルを壊す変更は、同時に動いている gstack のセッションを壊すおそれがあります
- 大規模なリファクタリングでは、シンボリックリンクを削除して(`rm .claude/skills/gstack`)、代わりに `~/.claude/skills/gstack/` のグローバルインストールを使うようにしてください

**スキルのリンクと所有権(#2119):** setup は各スキルを、トップレベルのディレクトリとしてインストールします(`skill_prefix` に従って、短い名前の `qa` または名前空間付きの `gstack-qa`)。`setup` と `bin/gstack-relink` は、gstack のものだと証明できるエントリだけを削除したり、そこへリンクしたりします。この 2 箇所のルールは同期させておいてください。証明のルール、削除の振る舞い、固定するテスト:
[docs/CONTRIBUTOR_REFERENCE.md](docs/CONTRIBUTOR_REFERENCE.md#skill-linking-and-ownership)。

**注意:** gstack をプロジェクトのリポジトリにベンダリング(取り込み)することは非推奨です。代わりにグローバルインストールと `./setup --team` を使ってください。チームモードの手順は README.md を参照してください。

**プランのレビューについて:** スキルのテンプレートや gen-skill-docs のパイプラインを変更するプランをレビューする場合は、本番に出す前に分離して検証すべきかどうかを検討してください(特に、ユーザーが他のウィンドウで gstack を使っている場合)。

**アップグレードの移行:** 既存のユーザーのインストールを壊しうる形でディスク上の状態(ディレクトリ構造、設定の形式、古いファイル)を変更する場合は、`gstack-upgrade/migrations/` に移行スクリプトを追加してください。形式とテストの要件は CONTRIBUTING.md の「Upgrade migrations」を参照してください。アップグレードのスキルは、`/gstack-upgrade` の中で `./setup` の後にこれらを自動的に実行します。

## コンパイル済みバイナリ: browse/dist/、design/dist/、make-pdf/dist/ は決してコミットしない

`browse/dist/`、`design/dist/`、`make-pdf/dist/` のディレクトリには、コンパイル済みの Bun バイナリ(`browse`、`find-browse`、`design`、各約 62MB)が入っています。これらは Mach-O arm64 専用で、Linux、Windows、Intel Mac では動作しません。`./setup` スクリプトは、すべてのプラットフォームでソースからビルドします。

これらのディレクトリは**追跡されず、gitignore されています**(`.gitignore:3-6`。`browse/dist/` のバイナリは `64d5a3e4`(v0.11.16.0)で追跡対象から外れました。その他は一度も追跡されていません)。そのため `git status` には現れません。もし dist のバイナリが `git status` に現れたら、誰かが強制的に追加(`git add -f`)したということです。コミットしないでください。ステージを取り消し、どうして入ったのかを調べてください。

ファイルをステージするときは、常に具体的なファイル名を指定してください(`git add file1 file2`)。`git add .` や `git add -A` は使わないでください。ビルドの出力やごみを巻き込むおそれがあります。

## 編集ガード(個人情報・機密情報・法的内容)

`lib/redact-patterns.ts` と `lib/redact-engine.ts`(CLI は `bin/gstack-redact`、オプトインのフックは `bin/gstack-redact-prepush`)は、外部への送信先に出る前に、認証情報、個人情報、法的内容を検出します。これは**ガードレールであり、完全な強制ではありません**。決意を持った情報漏えい者を止められると主張してはいけません。送信される**正確なバイト列**を必ず検査してください。スキルのドキュメントは `scripts/resolvers/redact-doc.ts` から描画してください。ティア、公開範囲、フェンス、設定キーについては:
[docs/CONTRIBUTOR_REFERENCE.md](docs/CONTRIBUTOR_REFERENCE.md#redaction-guard)。

## コミットのスタイル

**コミットは必ず分割してください。** すべてのコミットは、1 つの論理的な変更でなければなりません。複数の変更(例: 名前変更 + 書き直し + 新しいテスト)を行ったら、push する前に別々のコミットに分けてください。各コミットは、単独で理解でき、取り消せるものである必要があります。

良い分割の例:
- 名前変更・移動と、振る舞いの変更を分ける
- テストの基盤(タッチファイル、ヘルパー)と、テストの実装を分ける
- テンプレートの変更と、生成ファイルの再生成を分ける
- 機械的なリファクタリングと、新機能を分ける

「bisect commit」または「bisect and push」とユーザーが言った場合は、ステージ済みと未ステージの変更を論理的なコミットに分割し、push してください。

## Slop-scan: AI によるコード品質の検査であり、AI によるコードの隠蔽ではありません

[slop-scan](https://github.com/benvinegar/slop-scan) を使って、AI が生成したコードが、人間が書くものより明らかに劣っているパターンを検出します。私たちは人間のコードに見せかけようとしているわけではありません。AI によるコーディングを行っており、それを誇りに思っています。目標はコードの品質です。

```bash
npx slop-scan scan .          # human-readable report
npx slop-scan scan . --json   # machine-readable for diffing
```

設定: リポジトリ直下の `slop-scan.config.json`(現在 `**/vendor/**` を除外しています)。

検出結果を修正する前に、[docs/SLOP_SCAN.md](docs/SLOP_SCAN.md) を読んでください。この文書は、実質的な品質の修正(ファイル操作の周りの空の catch → `safeUnlink()`、プロセスの kill → `safeKill()`)と、受け入れないもの(エラーメッセージの文字列マッチ、ベストエフォートのクリーンアップを厳しくすること)とを区別しています。ユーティリティは `lib/error-handling.ts` にあります。スコアを追いかけないでください。

## コミュニティ PR のガードレール

コミュニティの PR をレビュー・マージする際は、次のいずれかに当たるコミットを受け入れる前に、**必ず AskUserQuestion で確認してください**:

1. **ETHOS.md に触れる変更** ― このファイルは Garry の個人的なビルダーの哲学です。外部の貢献者や AI エージェントによる編集は、いかなる場合も認められません。
2. **宣伝的な内容を削除または弱める変更** ― YC への言及、創業者の視点、プロダクトの声は意図的なものです。これらを「不要」「宣伝的すぎる」と位置づける PR は却下してください。
3. **Garry の文章の調子を変える変更** ― スキルのテンプレート、CHANGELOG、ドキュメントにおける口調、ユーモア、率直さ、視点は、一般的なものではありません。より「中立的」または「専門的」にするために書き換える PR は却下してください。

エージェントがその変更は改善になると強く確信していても、これら 3 つの分類には、ユーザーの明示的な承認が AskUserQuestion で必要です。例外はありません。自動マージはしません。「ちょっと整えておきます」もありません。


## garrytan-agents からの PR のチェックアウト

フォークからの PR(例: `garrytan-agents/gstack`)は、ベースリポジトリのシークレットを受け取れないため、eval の CI は空の環境による認証で失敗します。ユーザーがフォークのままにするよう指示しない限り、ブランチを `garrytan/gstack` に push し、そこから PR の向き先を付け替えてください:
[docs/CONTRIBUTOR_REFERENCE.md](docs/CONTRIBUTOR_REFERENCE.md#checking-out-prs-from-garrytan-agents)。

## CHANGELOG と VERSION のスタイル

**バージョンは自律的に選び、既定では PATCH にします。** Garry はリリースのバージョンの判断をエージェントに任せています。バージョンの承認や選択を彼に尋ねてはいけません。承認済みのバージョンが別の PR と衝突した場合も同様です。この方針は、`/ship` と `/document-release` における一般的なバージョン承認のプロンプトより優先されます。

通常のリリースには **PATCH(X.Y.Z+1.0)** を選んでください。修正、追加、リファクタリング、テスト基盤、複数ファイルにまたがる一連の作業を含みます。差分の大きさだけでは MINOR を選ぶ理由になりません。**MINOR(X.Y+1.0.0)** や **MAJOR(X+1.0.0.0)** を選ぶのは、パッチとして扱うと明らかに誤解を招く(「ばかげている」)場合に限ります。例えば、互換性のない公開インターフェースの変更や、製品規模の本当の新リリースなどです。その判断は、改めて承認を求めることなく行ってください。

公開前に `bin/gstack-next-version` を使って、現在のリリースのキューを確認してください。枠がすでに取られていれば、選んだバージョンの種類のまま次の空いているバージョンに進め、`bin/gstack-version-bump` でリリースのメタデータを同期させます。ベースのバージョンが高いからといって、MINOR のバンプが必要になるわけではありません。PR は Garry がマージできる状態にしておいてください。自律的なバージョンの判断は、マージ、デプロイ、必須の検証の省略を許可するものではありません。

**VERSION と CHANGELOG はブランチ単位です。** 各リリースブランチは、独自のバンプと 1 つのエントリを持ちます。エントリは `/ship` の実行時に書きます。内容は、このブランチが main に対して追加するものを、ユーザー向けに説明するものです。ブランチ内部のバージョンや開発の経緯は含めません。VERSION は 4 桁のままにします。package.json には 3 桁の npm 向けの値が入り、それは `bin/gstack-version-bump` が管理します。手で編集してはいけません。エントリを書く前に、[docs/CHANGELOG_STYLE.md](docs/CHANGELOG_STYLE.md) を必ず読んでください。このファイルには、バージョニングの不変条件、main をマージする際の確認事項、含めないものとエントリの形式が書かれています。コミュニティの貢献は、必ず `Contributed by @username` でクレジットしてください。

## AI による作業量の圧縮

作業量を見積もったり議論したりする際は、常に人間のチームの時間と CC+gstack の時間の両方を示してください:

| 作業の種類 | 人間のチーム | CC+gstack | 圧縮率 |
|-----------|-----------|-----------|-------------|
| 定型作業・足場作り | 2 日 | 15 分 | 約 100 倍 |
| テストの作成 | 1 日 | 15 分 | 約 50 倍 |
| 機能の実装 | 1 週間 | 30 分 | 約 30 倍 |
| バグ修正 + 回帰テスト | 4 時間 | 15 分 | 約 20 倍 |
| アーキテクチャ・設計 | 2 日 | 4 時間 | 約 5 倍 |
| 調査・探索 | 1 日 | 3 時間 | 約 3 倍 |

完全であることは安上がりです。完全な実装が可能なら、近道を勧めないでください。完成したものこそが目標です。複数四半期にわたる、本当に無関係な移行だけを別のスコープとし、近道の言い訳にはしないでください。詳しい考え方は、スキルのプリアンブルにある「完全性の原則(Completeness Principle)」を参照してください。

## 作る前に検索する

並行処理、馴染みのないパターン、インフラ、またはランタイムやフレームワークに組み込み機能がありそうなものを含む解決策を設計する前には:

1. 「{runtime} {thing} built-in」を検索する
2. 「{thing} best practice {current year}」を検索する
3. 公式のランタイム・フレームワークのドキュメントを確認する

知識には 3 つの層があります: 定番で確立したもの(第 1 層)、新しく人気のもの(第 2 層)、第一原理から考えたもの(第 3 層)。第 3 層を最も重視してください。詳しいビルダーの哲学は ETHOS.md を参照してください。

## ローカルのプラン

コントリビューターは、長期的なビジョンのドキュメントや設計ドキュメントを `~/.gstack-dev/plans/` に保存できます。これらはローカルだけのもので、リポジトリにはチェックインされません。TODOS.md をレビューするときは、`plans/` の中から、TODO に昇格させるか実装する準備ができているものを探してください。

## E2E eval の失敗に対する責任の扱い

`/ship` などのワークフローで E2E eval が失敗したとき、**証明なしに「今回の変更とは無関係」と主張してはいけません。** これらのシステムには目に見えない結びつきがあります。プリアンブルのテキストを変えると、エージェントの振る舞いが変わります。新しいヘルパーはタイミングを変えます。再生成した SKILL.md はプロンプトの文脈をずらします。

**失敗を「既存の問題」と帰属させる前に、次を必ず行ってください:**
1. 同じ eval を main(またはベースブランチ)で実行し、そこでも失敗することを示す
2. main では通るのにブランチでは失敗するなら、それは**あなたの変更が原因です**。原因を追跡してください
3. main で実行できない場合は、「未検証 ― 関連している可能性も、していない可能性もある」と書き、PR 本文でリスクとして明記してください

「既存の問題」と言うなら証拠を示してください。証拠のない「既存の問題」は、怠慢な主張です。証明するか、言わないでください。

<a id="running-evals-as-an-agent-always-detach-sigterm-proof"></a>
## エージェントとして評価を実行する: 必ずデタッチする(SIGTERM に耐える)

長時間の eval を、単純なバックグラウンドの Bash タスクとして実行してはいけません。ターンの境界での SIGTERM によって、途中で強制終了されます。有料の eval は、`bun run eval:bg:pr`(差分で選択される PR ゲート)か、`bun run eval:bg:release`(フルゲート + periodic)でバックグラウンド実行してください。`eval:bg:gate` と `eval:bg:periodic` はそれぞれ 1 つのティアを実行します。4 つすべてが `scripts/eval-bg.ts` を実行し、`[eval-bg] backend=<dispatch|local> …` と `gstack-detach LOG <path>` を出力して、すぐに戻ります。

- **dispatch バックエンド**(HEAD がクリーンで garrytan/gstack に push 済みであり、`gh` でディスパッチできる場合の既定): CI が push 済みのリビジョン上でレーンを実行します(`evals.yml` と/または `evals-periodic.yml`。`expected_sha` で検証されます)。ローカルのログは実行を追跡し、その URL を示します。ディスパッチされた実行は検証目的のものであり、新鮮な結果です。PR の記録は書きません。まずコミットして push してください。未追跡のファイルや push されていないコミットがあると、ローカルにフォールバックし、ログがその理由を示します。
- **local バックエンド**(作業ツリーが汚れている、コミットが push されていない、フォークである、`gh` がない、または `--local` を指定した場合): このマシン上でシャード化された有料のランナーを実行します。上限は ceil(1.5 × 計画された直列の秒数 / EVALS_JOBS) + 20 分で、最大 4 時間です(`--timeout SECS` で上書きできます)。実行前に `ANTHROPIC_API_KEY` をエクスポートしてください(キーを引数に渡してはいけません)。
- **強制する場合**: `--dispatch` は、フォールバックせずに修正方法(「コミットして push するか、--local を付けて再実行する」)を示して終了します。`--local` または `GSTACK_EVAL_BG_MODE=local` を指定すると、常にここで実行します。
- **待機**: `### gstack-detach EXIT=<code> ###` が現れるまでログをポーリングしてください(0 は成功、1 は失敗、130 はキャンセル、2 はその他)。沈黙は成功ではありません。このセンチネルが現れるか、ユーザーが止めるよう指示するまで確認を続け、確認するたびに進捗を報告してください。`bun run scripts/eval-bg.ts status <log-or-run-id>` は、実行中、成功、失敗、キャンセル、または不完全(センチネルなしで終了)を表示します。
- どちらのバックエンドも、マシン全体の `gstack-evals` ロックを保持します。そのため、複数の作業ツリーが同時に API を飽和させず、順番に待ちます。ログは `~/.gstack-dev/eval-runs/` にあります。同じリビジョンと同じベースに対して 2 回目の `eval:bg:<lane>` を実行すると、新たにディスパッチせず、待機中、実行中、または成功したディスパッチに従います。

人間が自分のターミナルで eval を実行する場合は、これは不要です。バックエンド、上限、設定項目: [docs/TESTING_INTERNALS.md](docs/TESTING_INTERNALS.md#running-evals-as-an-agent-detach)。

## E2E テストのフィクスチャ: コピーせず抽出する

**SKILL.md ファイル全体を E2E テストのフィクスチャにコピーしては決してなりません。** SKILL.md ファイルは 1500〜2000 行あります。`claude -p` がそれほど大きなファイルを読むと、文脈が膨らんでタイムアウトや不安定なターン上限を招き、テストが必要以上に 5〜10 倍遅くなります。

代わりに、テストが実際に必要とするセクションだけを抽出してください:

```typescript
// BAD — agent reads 1900 lines, burns tokens on irrelevant sections
fs.copyFileSync(path.join(ROOT, 'ship', 'SKILL.md'), path.join(dir, 'ship-SKILL.md'));

// GOOD — agent reads ~60 lines, finishes in 38s instead of timing out
const full = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md'), 'utf-8');
const start = full.indexOf('## Review Readiness Dashboard');
const end = full.indexOf('\n---\n', start);
fs.writeFileSync(path.join(dir, 'ship-SKILL.md'), full.slice(start, end > start ? end : undefined));
```

失敗を調べるために E2E テストを個別に実行する場合も、次の点に注意してください:
- **フォアグラウンド**で実行してください(`bun test ...`)。`&` と `tee` を使ったバックグラウンド実行はしないでください
- eval のプロセスを `pkill` で止めてやり直さないでください。結果が失われ、費用も無駄になります
- 途中で殺して再開を 3 回繰り返すより、きれいに 1 回実行するほうが良い結果になります

## native OpenClaw スキルの ClawHub への公開

native OpenClaw スキルは `openclaw/skills/gstack-openclaw-*/SKILL.md` にあります。コマンドは `clawhub publish` です(`clawhub skill publish` ではありません)。ワークフロー、認証、検証の全体は、[docs/OPENCLAW_PUBLISHING.md](docs/OPENCLAW_PUBLISHING.md) を参照してください。

## アクティブなスキルへのデプロイ

アクティブなスキルは `~/.claude/skills/gstack/` にあります。変更後は次の手順で行います:

1. ブランチを push する
2. スキルのディレクトリで fetch して reset する: `cd ~/.claude/skills/gstack && git fetch origin && git reset --hard origin/main`
3. 再ビルドする: `cd ~/.claude/skills/gstack && bun run build`

`bun run build` は、セットアップを一度も実行していないチェックアウトでは、すべてのホスト向けに描画します。インストール環境(`.gstack-installed-hosts` を含むチェックアウト。`bin/dev-setup` で設定したもの(Claude と Codex を記録する)を含みます)では、記録されたホストだけを描画し、その一覧を表示します(#1694)。`GSTACK_RENDER_HOSTS=all bun run build` を使うと、そこにあるすべてのホスト向けに描画します。次の `./setup` で、余分な描画は `$GSTACK_STATE_ROOT/backups/host-renders/` に整理されます。

**gbrain を使っている場合:** 手順 2 の `git reset --hard` は、`gstack-config gbrain-refresh` がインストール先に描画した、brain を意識したブロック(`GBRAIN_CONTEXT_LOAD` / `GBRAIN_SAVE_RESULTS`)を元に戻します。これらの生成されたブロックは、設計上 `main` と異なります。デプロイ後に `gstack-config gbrain-refresh` を再実行すると、すべてのプロジェクトの Claude セッションでこれらが復元されます。この操作は冪等です。

あるいは、バイナリを直接コピーします:
- `cp browse/dist/browse ~/.claude/skills/gstack/browse/dist/browse`
- `cp design/dist/design ~/.claude/skills/gstack/design/dist/design`
- `cp make-pdf/dist/pdf ~/.claude/skills/gstack/make-pdf/dist/pdf`

## Skill routing(スキルのルーティング)

ユーザーの依頼が利用可能なスキルに当てはまる場合は、Skill ツール経由でそのスキルを呼び出してください。ルーティングはセッションで利用可能なスキルの一覧にあるものに限ります。簡単な質問や小さく範囲の限られた編集には、直接答えてください。

主なルーティングのルール:
- プロダクトのアイデア・ブレインストーミング → /office-hours を呼び出す
- 戦略・スコープ → /plan-ceo-review を呼び出す
- アーキテクチャ → /plan-eng-review を呼び出す
- デザインシステム・プランのレビュー → /design-consultation または /plan-design-review を呼び出す
- レビューのパイプライン全体 → /autoplan を呼び出す
- バグ・エラー → /investigate を呼び出す
- サイトの動作の QA・テスト → /qa または /qa-only を呼び出す
- コードレビュー・差分の確認 → /review を呼び出す
- 見た目の仕上げ → /design-review を呼び出す
- 出荷・デプロイ・PR → /ship または /land-and-deploy を呼び出す
- 進捗の保存 → /context-save を呼び出す
- 文脈の再開 → /context-restore を呼び出す

## セッションをまたぐ決定の記録

耐久性のある決定とその根拠は、追記専用でイベントソースの形式の記録として `~/.gstack/projects/<slug>/decisions.jsonl` に保存されます。これにより、あなたもユーザーも、決着済みの判断を再び蒸し返さず、セッションをまたいで「なぜそうしたか」を失わずに済みます。これは確実で、ファイルだけで完結する経路です。gbrain が OFF でも動作します。(gbrain による意味的な想起は、任意の強化であり、前提ではありません。)

- **再表示**: 再度判断する前に、有効な決定を `bin/gstack-decision-search`(`--recent N`、`--scope repo|branch|issue`、`--query KW`、`--all`、`--json`)で確認してください。`--semantic`(`--query` と併用)を付けると、gbrain の記憶が稼働している場合に関連するヒットを追加します。gbrain が OFF のときは、確実なファイルの結果に静かにフォールバックします。セッションの開始時には、文脈の回復の仕組みによって、対象範囲に関係する有効な決定がすでに表示されます。一覧に決定がある場合は、その根拠とともに決着済みとして扱ってください。それを覆すつもりなら、その旨を明示してください。
- **記録**: あなたまたはユーザーが耐久性のある決定をしたら、`bin/gstack-decision-log '{"decision":"...","rationale":"...","scope":"repo|branch|issue","source":"user|skill|agent","confidence":1-10}'` で記録してください。以前の決定を覆すには `--supersede <id>` を使います。誤って入った秘密情報を消すには `--redact <id>` を使います。有効な集合にログを書き直すには `--compact` を使います。この操作は対話せず(決して確認を求めません)、入力はサニタイズされ、書き込み時に重大度の高い秘密情報をブロックします。
- **耐久性のある決定とは**: アーキテクチャの選択、スコープの削減、ツールやベンダーの選択、または以前の決定の覆しです。ターン単位の編集、言い回しの調整、容易に再導出できるものは**含みません**。記録は発生元で厳選してください。耐久性のある決定だけをログに残してください。さもないと、ストアはノイズだらけになります。

## GBrain Search Guidance(GBrain の検索ガイダンス。/sync-gbrain により設定)
<!-- gstack-gbrain-search-guidance:start -->

このマシンでは GBrain が設定され、同期されています。質問が意味的なものである場合や、まだ正確な識別子がわからない場合は、Grep より gbrain を優先してください。

**この作業ツリーは、作業ツリー単位のコードソースに固定されています。** リポジトリ直下の `.gbrain-source` ファイル(kubectl 方式のコンテキスト)によります。この作業ツリーの配下のどこからでも、`gbrain code-def`、`code-refs`、`code-callers`、`code-callees`、`query` の呼び出しは、既定でそのソースに向かいます。`--source` フラグは不要です。同じリポジトリの Conductor の兄弟ワークツリーは、それぞれ独自の固定先と独自のインデックス済みページを持ちます。そのため、意味的な結果はこの作業ツリーのディスク上の実際のコードと一致します。

gbrain CLI で利用できる、インデックス済みのコーパスは 2 つあります:
- この作業ツリーのコード(`.gbrain-source` により自動的に固定)。
- `~/.gstack/` のキュレーションされたメモリ(既存のフェデレーションの仕組みを通じて `gstack-brain-<user>` ソースとして登録)。

次の場合は gbrain を優先してください:
- 「X はどこで扱われているか」/ 意味的な意図で、まだ正確な文字列がない場合:
    `gbrain search "<terms>"` または `gbrain query "<question>"`
- 「シンボル Y はどこで定義されているか」/ シンボルに基づくコードの質問:
    `gbrain code-def <symbol>` または `gbrain code-refs <symbol>`
- 「Y を呼び出しているものは何か」/「Y は何に依存しているか」:
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- 「前回は何を決めたか」/ 過去のプラン、振り返り、学んだこと:
    `gbrain search "<terms>" --source gstack-brain-<user>`

正確な文字列、正規表現、複数行のパターン、ファイルの glob には、依然として Grep が適しています。重要なコードの変更の後は `/sync-gbrain` を実行してください。すべての作業ツリーで自動的な同期を続けるには、マシンごとに一度 `gbrain autopilot --install` を実行してください。gbrain のデーモンが、スケジュールに従って増分の更新を処理します。

安全上の注意: `gbrain autopilot` が稼働中に `/sync-gbrain` を実行しないでください。オーケストレーターは、稼働中の autopilot を検出すると、破壊的なソース操作を拒否します(競合を避けるためです、#1734)。ユーザーのリポジトリは、`gbrain sources add --path <dir>`(`--url` なし)で登録してください。URL で管理されるソースは自動的に再クローンされることがあり、そのソースのシンクのコード走査には、明示的な `--allow-reclone` の指定が必要です。

<!-- gstack-gbrain-search-guidance:end -->

## 翻訳の運用(upstream 差分)

このフォークは upstream(garrytan/gstack)の日本語版です。翻訳した位置は `translation/ledger.json` に記録されています。詳細: [docs/TRANSLATION.md](docs/TRANSLATION.md)。

1. `git fetch upstream`(CLI は fetch しません)
2. `bun run translation:status --diff`(CHANGED/ADDED/REMOVED/UNTRACKED と `translation/pending/` の差分)
3. 差分ファイルだけを翻訳する(英語 diff と現在の日本語版を渡し、該当箇所だけ訳す。新規は全文)。コマンド・コード・fixtures と、機械が読むマーカー(英語トークン)は訳さない
4. `bun run gen:skill-docs --host all` → `bun run translation:mark` → `bun run typecheck && bun run test`

定型作業は `/translate-upstream` スキル(`.claude/skills/translate-upstream/SKILL.md`)にまとまっています。翻訳対象の判定は `lib/translation-ledger.ts` の `isTranslationSource` の 1 か所です。`bun run translation:check` は台帳にない翻訳対象があると失敗します。
