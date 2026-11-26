# gstack へのコントリビュート

gstack をより良くしようとしてくださってありがとうございます。スキルのプロンプトの誤字を直す場合でも、まったく新しいワークフローを作る場合でも、このガイドで素早く始められます。

## クイックスタート

gstack のスキルは、Claude Code が `skills/` ディレクトリから見つける Markdown ファイルです。通常は `~/.claude/skills/gstack/`(グローバルインストール)に置かれています。しかし gstack 自体を開発しているときは、Claude Code に**作業ツリーの**スキルを使ってほしい場合があります。そうすれば、コピーやデプロイをせずに、編集がすぐに反映されます。

それを行うのが開発モードです。リポジトリを、ローカルの `.claude/skills/` ディレクトリにシンボリックリンクします。そうすると Claude Code は、チェックアウトから直接スキルを読み込みます。

```bash
git clone https://github.com/garrytan/gstack.git && cd gstack
bun install                    # install dependencies
bin/dev-setup                  # activate dev mode
```

> **フルクローンと浅いクローン。** README のユーザー向けインストールは、速さのために `--depth 1` を使います。コントリビューターとしては、フルクローン(`--depth` フラグなし)を使ってください。`git log`、`git blame`、`git bisect`、以前のバージョンに対する PR のレビューには履歴が必要です。README に従って `--depth 1` のクローンをすでに持っている場合は、`git fetch --unshallow` でフルクローンに変えてください。

### 最初の無料のチェック(API キーもブラウザも不要)

```bash
bun install --frozen-lockfile
bun run typecheck        # expect no output and exit 0 (about a second)
bun run typecheck:test   # expect "test typecheck ratchet: N known diagnostics, none new."
```

`typecheck` は製品のコード(`browse/src`、`lib`、`scripts`、`bin`、`hosts`、および `tsconfig.json` の他のエントリ)を対象とし、エラーをゼロに保つ必要があります。`typecheck:test` は、テストのコードを、コミット済みの `scripts/typecheck-test-baseline.json` に照らして確認します。新しい診断、または繰り返しの診断は、ファイル名、TS のコード、メッセージを示して失敗します。診断を減らした場合も、`bun run typecheck:test --write-baseline` で小さくなった許容数を固定するまでは失敗します。`lib/cso/*.ts` を編集している場合は、コミット前に `bun run format:cso` を実行してください。CI は `format:cso:check` を実行します。これら 3 つはすべて、必須の `free-tests` チェックで実行されます。

それでは任意の `SKILL.md` を編集し、Claude Code で呼び出してください(例: `/review`)。変更がすぐに反映されるのを確認できます。開発が終わったら:

```bash
bin/dev-teardown               # deactivate — back to your global install
```

## 運用上の自己改善

gstack は失敗から自動的に学びます。スキルのセッションが終わるたびに、エージェントは何がうまくいかなかったかを振り返ります(CLI のエラー、誤ったアプローチ、プロジェクト固有の癖)。そして運用上の学びを `~/.gstack/projects/{slug}/learnings.jsonl` に記録します。今後のセッションでは、この学びが自動的に表示されるため、時間とともに gstack があなたのコードベースをより理解していきます。

設定は不要です。学びは自動的に記録されます。`/learn` で確認できます。

### コントリビューターの作業の流れ

1. **gstack を普段どおり使う** ― 運用上の学びは自動的に記録されます
2. **学びを確認する:** `/learn` または `ls ~/.gstack/projects/*/learnings.jsonl`
3. **gstack をフォークしてクローンする**(まだの場合)
4. **フォークを、バグに遭遇したプロジェクトにシンボリックリンクする**:
   ```bash
   # In your core project (the one where gstack annoyed you)
   ln -sfn /path/to/your/gstack-fork .claude/skills/gstack
   cd .claude/skills/gstack && bun install && bun run build && ./setup
   ```
   setup は、スキルごとのディレクトリを作り、その中に SKILL.md のシンボリックリンクを置きます(`qa/SKILL.md -> gstack/qa/SKILL.md`)。
   また、各スキルのランタイム用のアセット(sections/、テンプレート、チェックリスト ― SKILL.md、テスト、ビルドの出力、`.tmpl` のソース以外のすべて)もそれぞれリンクし、接頭辞の希望を尋ねます。
   `--no-prefix` を付けると、尋ねずに短い名前を使います。
5. **問題を修正する** ― 変更はこのプロジェクトですぐに反映されます
6. **実際に gstack を使ってテストする** ― 困らせていたことを実際にやってみて、直ったことを確認します
7. **フォークから PR を開く**

これは最も良いコントリビュートの方法です。実際の作業をしながら gstack を修正し、本当に困ったプロジェクトで直すのです。

**フォークの PR で CI が行うこと。** GitHub は、フォークの PR にこのリポジトリのシークレットを決して渡しません。そのため CI は、シークレットを必要としないものをすべて実行します。必須の `free-tests` チェック(Linux の無料スイート、typecheck、macOS と Windows のゲート)、Windows Free Tests、Skill Docs Freshness、Workflow Lint、Version Gate、Quality gate、make-pdf のゲート、そして変更が触れるパス依存のゲートです。E2E Evals は、`Dockerfile.ci` から CI イメージをビルドしますが、公開はしません。また、プロバイダーの API キーを必要とする有料の eval ジョブはスキップします。このスキップは想定どおりで、PR をブロックしません。ただし、それは合格ではありません。マージの前に、メンテナーがこのリポジトリのブランチから有料の eval を実行します。初めてのコントリビューターの実行は、メンテナーが承認するまで待機します。

### セッションの認識

gstack のセッションを 3 つ以上同時に開いているとき、すべての質問は、どのプロジェクトか、どのブランチか、何が起きているかを示します。「どのウィンドウの質問だっけ」と考え込むことはなくなります。形式はすべてのスキルで一貫しています。

## gstack リポジトリの中で gstack を操作する

gstack のスキルを編集し、gstack を同じリポジトリの中で実際に使ってテストしたい場合は、`bin/dev-setup` が設定を行います。これは、作業ツリーを指す `.claude/skills/` のシンボリックリンク(gitignore 済み)を作成します。そのため Claude Code は、グローバルインストールではなく、ローカルの編集を使います。

```
gstack/                          <- your working tree
├── .claude/skills/              <- created by dev-setup (gitignored)
│   ├── gstack -> ../../         <- symlink back to repo root
│   ├── review/                  <- real directory (short name, default)
│   │   └── SKILL.md -> gstack/review/SKILL.md
│   ├── ship/                    <- or gstack-review/, gstack-ship/ if --prefix
│   │   └── SKILL.md -> gstack/ship/SKILL.md
│   └── ...                      <- one directory per skill
├── review/
│   └── SKILL.md                 <- edit this, test with /review
├── ship/
│   └── SKILL.md
├── browse/                      <- /browse skill + gstack's own browser engine (the fallback)
│   ├── src/                     <- TypeScript source
│   └── dist/                    <- compiled binary (gitignored)
├── lib/
│   ├── aside-render.ts          <- local-HTML rendering: Aside first, browse engine fallback
│   └── design-catalog.ts        <- typed design anti-pattern catalog; review/design-checklist.md is generated from it
├── bin/
│   └── gstack-render.ts         <- the CLI skills call to render a local HTML file
└── ...
```

setup は、トップレベルに実際のディレクトリを作り(シンボリックリンクではありません)、その中に SKILL.md のシンボリックリンクを置きます。さらに、各スキルのランタイム用のアセット(sections/、テンプレート、チェックリスト)へのリンクも作ります。エイリアスのスキル(`_gstack-command`、`connect-chrome`)は、シンボリックリンクではなく、書き換えたコピーとしてインストールされます。シンボリックリンクを編集すると、生成元のソースが壊れるためです。これにより、Claude はそれらを `gstack/` の下に入れ子にされたものではなく、トップレベルのスキルとして見つけます。名前は接頭辞の設定(`~/.gstack/config.yaml`)によって変わります。短い名前(`/review`、`/ship`)が既定です。名前空間付きの名前(`/gstack-review`、`/gstack-ship`)を好む場合は、`./setup --prefix` を実行してください。

## 日々の作業の流れ

```bash
# 1. Enter dev mode
bin/dev-setup

# 2. Edit a skill template (SKILL.md files are generated — edit the .tmpl)
vim review/SKILL.md.tmpl
bun run gen:skill-docs   # or: bun run dev:skill (watch mode, auto-regen on change)

# 3. Test it in Claude Code — changes are live
#    > /review

# 4. Editing browse source? Rebuild the binary
bun run build

# 5. Done for the day? Tear down
bin/dev-teardown
```

### 開発ワークスペースでの brain を意識したブロック(gbrain がインストールされている場合)

gbrain がインストールされ、使用可能である場合(`bin/gstack-gbrain-detect --is-ok` が 0 で終了する場合)、`bin/dev-setup` は、Git で追跡している SKILL.md ファイルを正規の状態に保ちます。そして、brain を意識したバリアント(`GBRAIN_CONTEXT_LOAD` / `GBRAIN_SAVE_RESULTS` のブロック)を `.claude/gstack-rendered/`(gitignore 済み、ワークスペースごと)に描画します。その後、ワークスペースの SKILL.md のシンボリックリンクを、その描画結果を指すように付け替えます。そのため、Claude のセッションは gbrain の機能をフルに使えますが、`git status` はクリーンなままです。内部では、dev-setup が入れ子の `./setup` に `GSTACK_SKIP_GBRAIN_REGEN=1` をインラインで渡します(追跡対象のソースを決して汚しません)。そして `gen:skill-docs:user --out-dir .claude/gstack-rendered` を実行します。これは、セクションのベースパスだけを描画結果を指すように書き換えます。`bin/dev-teardown` は描画結果を削除します。ブロックを*他の*プロジェクトの Claude セッションでも有効にするには、`gstack-config gbrain-refresh` を実行してください。これは、ユーザー用の描画ディレクトリ(`${GSTACK_USER_RENDER_DIR:-~/.gstack/render/claude}`。描画が成功したときだけ入れ替えられます)に描画し、`gstack-relink` によってインストール済みのスキルをそこに向けます。グローバルインストールのチェックアウトは git 上でクリーンなままです。さらに、この更新は、シンボリックリンクされていないディレクトリや、gstack 以外のディレクトリには決して触れないよう保護されています。

<a id="testing--evals"></a>
## テストと eval

Codex の eval と GPT のベンチマークのアダプターは、既定で `gpt-6-astra` を使います。優先順位は、明示的なモデル > `GSTACK_CODEX_MODEL` > 既定値です。テスト対象の Claude モデル(キャプチャ)の既定は `claude-opus-5-5`、審査員は `claude-fable-5-1` で、`lib/eval-model.ts` を通じて解決されます。審査員は、テスト対象のモデルが変わっても変わりません。審査員のキャリブレーション用のフィクスチャがそれに紐づいているためです。

- Claude のセッション、PTY、Agent SDK の eval ランナー、および Claude のベンチマークアダプター: 明示的なモデル > `EVALS_MODEL` > `GSTACK_EVAL_MODEL_CAPTURE` > `GSTACK_EVAL_MODEL` > 既定値。
- 共有の審査員の呼び出し(ベンチマークの品質の採点を含む): 明示的なモデル > `GSTACK_EVAL_MODEL_JUDGE` > `GSTACK_EVAL_MODEL` > 既定値。`EVALS_MODEL` はキャプチャのランナーに適用され、審査員には適用されません。

ウォームアップは `claude-haiku-4-5` のままです。蒸留(distill)は `claude-haiku-4-5-20251001` のままです。明示的なテストのモデルや、過去のベンチマークのモデルの選択は、これまでどおり優先されます。これらの eval の既定値は、[ランタイムのモデル階層](docs/model-policy.md)とは独立に固定されています。モデル階層の鮮度を確認するワークフローは、評価用のモデルを自動的に探したり変更したりしません。以下に示す有料の実行のコストは、この既定値の変更より前の、過去の見積もりです。新しい既定値の測定結果ではありません。

<a id="which-command-do-i-run"></a>
### どのコマンドを実行すればよいか

| やりたいこと | コマンド | コスト / 時間 | 必要なもの |
|---|---|---|---|
| 通常の編集をすばやく確認する | `bun run test:quick` | 無料、約 1 分 | Bun 1.4.2 |
| 修正中に無料のテストファイルを 1 つ実行する | `bun test <file>` | 無料、数秒 | スイート全体に素の `bun test` は使わない |
| 公開前に無料の受け入れテストを全件実行する | `bun run test` | 無料、数分 | Bun 1.4.2 |
| 小さなマシンから無料のテストを全件実行する | `bun run test:ubicloud` | 課金される 16 vCPU の VM での無料スイート全件、約 5 分 | `UBICLOUD_API_KEY` |
| 8 コア未満のマシンで pregate のテストティアを通す([リモートゲート](docs/pregate.md#remote-gate)) | `gstack-pregate --stage tests --remote --spend-cap 2 --timeout 2700 --allow-repo-commands`(鍵の有無を問わず同じコマンド) | 鍵あり: 課金される 16 vCPU の VM を 1 台、約 7 分、無料のティア全体で $0.06、最悪の場合 $0.38。鍵なし: 無料、ローカルの並列シャード。小さな選択にのみ実用的(4 コアで 98 ファイルに 103 秒) | 鍵あり: `UBICLOUD_API_KEY`。鍵なし: なし |
| Windows で安全なテストのサブセットを実行する | `bun run test:windows`(CI: six `windows-latest` jobs) | 無料 | Windows、Git Bash |
| Windows の期間シードを更新する | `gh workflow run windows-free-tests.yml --ref <branch> -f record_durations=true`。その後 `free-test-durations-windows` のアーティファクトをコミットする | 無料の CI ランナー | push 済みのブランチ、ワークフローの権限を持つ `gh` |
| ネイティブの Windows または Dia の検証キャンペーンを実行する | `gh workflow run native-qualification.yml --ref <branch> -f mode=<mode>`([モード](docs/TESTING_INTERNALS.md#windows-free-lane)) | 無料の CI ランナー | push 済みのブランチ、ワークフローの権限を持つ `gh` |
| 自分の差分が選ぶ有料ケースをプレビューする | `bun run eval:select`(PR プロファイル。素のタッチファイル選択は `--profile full`) | 無料 | — |
| CI の有料シャードの計画をプレビューする | `bun run scripts/test-paid-shards.ts --tier periodic --list --slice-budget 420 --jobs 2`(差分で選択。`EVALS_ALL=1` で全件を一覧) | 無料 | — |
| 自分の変更に対する有料のカバレッジを実行する(エージェント: デタッチして実行) | `bun run eval:bg:pr`(フォアグラウンド: `bun run test:pr`) | 選択されたケースの API の費用のみ。CI にディスパッチした場合は約 10 分 | ディスパッチ: クリーンで push 済みの HEAD と `gh`。ローカルのフォールバック: `ANTHROPIC_API_KEY`、Claude Code CLI、普通のターミナル |
| リリース前に、フルゲートと periodic の調査を実行する | `bun run eval:bg:release`(フォアグラウンド: `bun run test:release`) | 最も大きい API の費用。ローカルの実行は最大 4 時間 | 上と同じ |
| 1 つの有料ティアを実行する | `bun run test:gate:sharded` / `bun run test:periodic:sharded`(デタッチ: `eval:bg:gate` / `eval:bg:periodic`) | そのティアの API の費用 | 上と同じ |
| 1 つの有料ケースを CI のパネルとして実行する | `bun run scripts/test-paid-shards.ts --tier <tier> --case <case-id> --trials 3` | そのケースの API の費用 | 上と同じ |
| ブランチ上のゲートのケースを CI で検証する | `gh workflow run evals.yml --ref <branch> -f evals_all=true` | CI ランナー + API の費用 | push 済みのブランチ、ワークフローの権限を持つ `gh` |
| ブランチ上の periodic のケースを CI で検証する | `gh workflow run evals-periodic.yml --ref <branch>`(periodic のレーンのみ) | CI ランナー + API の費用 | push 済みのブランチ、ワークフローの権限を持つ `gh` |
| ブランチ上の periodic のケースと、週次のゲートの調査を検証する | `gh workflow run evals-periodic.yml --ref <branch> -f include_gate_census=true` | CI ランナー + API の費用 | push 済みのブランチ、ワークフローの権限を持つ `gh` |
| オプトインの ML、gitleaks、Swift のチェックを実行する | `gh workflow run platform-qualification.yml --ref <branch>` | 無料の CI ランナー | push 済みのブランチ、ワークフローの権限を持つ `gh` |
| 過去のローカルの eval 実行を確認する | `bun run eval:list` / `eval:compare` / `eval:summary` | 無料 | ローカルの eval の履歴 |
| 直近の週次実行にわたる、あるケースの合格率を見る | `bun run eval:pass-rates --case <case-id>` | 無料 | リポジトリの読み取りアクセスを持つ `gh` |
| 赤くなった 1 つのケースを単独で測定し、出荷の基準(10 回中 MEETS 9)と照らす | `bun run scripts/ship-measure.ts measure --case <case-id> --round baseline`([基準](docs/TESTING_INTERNALS.md#ship-measure)) | 10 回の試行の API の費用(振る舞いは 12 回)。1 試行あたり $2 を超えると確認を求め、ケースごとに $25 で停止 | 有料のカバレッジと同じ |
| main で最もフレーキーなゲートのケースを測定する(週次のスイープ) | `gh workflow run eval-sweep.yml --ref main [-f k=5] [-f cap_usd=150] [-f dry_run=true]`、またはローカルでは `bun run scripts/ship-measure.ts sweep --dry-run`([スイープ](docs/TESTING_INTERNALS.md#ship-measure-sweep)) | 7 日あたり最大 $150 の API の費用(`ship_measure_sweep_budget_usd`)。`--dry-run` は無料 | リポジトリの読み取りアクセスを持つ `gh`。CI のディスパッチにはワークフローの権限が必要 |
| 有料ゲートの費用と、各選択または訓練ポリシーがいくらかかったかを再生する([リプレイ](docs/TESTING_INTERNALS.md#replay-gate-cost)) | `bun run scripts/gate-cost-replay.ts --runs <full-gate run ids> --since <date> --until <date>`(スクリーニングの数値は screen-provisional として表示され、T2 が入るまでは概算) | 無料。`gh` の読み取りで、`.context/gate-cost-cache` にキャッシュ | リポジトリの読み取りアクセスを持つ `gh` |
| 監査の成功指標と週次の健全性を確認する | `bun run test:health [--since-days 7] [--json] [--enforce]` | 無料。5〜20 分の `gh` の読み取り | リポジトリの読み取りアクセスを持つ `gh` |

古いコマンド名は、[廃止されたコマンド](#retired-commands)に一覧があります。

### セットアップ

開発とテストには Bun 1.4.2 以上が必要です。CI は 1.4.2 に固定され、そのバージョンでテストします。それより古い Linux の Bun は、サブプロセスのガベージコレクションの最中に、無関係な生きたファイルディスクリプタを閉じてしまうことがあります。その結果、ブラウザや HTTP のフィクスチャが断続的に失敗します([上流の原因分析](https://github.com/oven-sh/bun/issues/34785#issuecomment-5020318035))。

```bash
# 1. Copy .env.example and add your API key
cp .env.example .env
# Edit .env → set ANTHROPIC_API_KEY=sk-ant-...

# 2. Install deps (if you haven't already)
bun install
```

Bun は `.env` を自動で読み込みます。追加の設定は不要です。Conductor のワークスペースは、メインのワークツリーから `.env` を自動的に引き継ぎます(下の「Conductor workspaces」を参照)。

<a id="test-tiers"></a>
### テストのティア

機能の QA の変更には、ネイティブのフィクスチャによる証明も必要です。宣言された CLI またはループバックの API/ワーカーの契約を、このチェックアウトの外にある一時的なリポジトリで追加して実行してください。成功のパスと失敗のパスの両方、永続的な影響、セットアップの失敗を検証します。レポートのみの評価では、変更が可能なツールを利用可能なままにし、禁止された書き込みを独立して検出しなければなりません。後で元に戻された編集も含みます。最終的な差分がきれいであるだけでは不十分です。有料の実行の前に、わざと悪いコントロールを使って観測者を検証してください。

探索的な回帰の場合は、修正前の失敗の実際の状態、修正後の合格、元のプローブ、隣接する正常系を保存してください。自動的な呼び出し元のテストは、review/ship を通って入る必要があります。エージェントに、テスト対象のコンポーネントを実行するよう指示してはいけません。ドキュメントのテストでは、公開の前に、実際の子プロセスが完了し、親がその結果を使ったことを証明しなければなりません。既存のディスパッチ専用のテストは、より狭い証拠にすぎません。新しいケースと、消費されるすべてのセクション/リゾルバーの入力は、touchfiles、tiers、PR プロファイルに登録して、実行されるようにしてください。問題を報告する際は、サニタイズされた再現コマンドとフィクスチャの証拠を共有してください。認証情報、非公開のペイロード、確認していないエージェントのトランスクリプト全体は、決して共有しないでください。

| ティア | 実行経路 | 何をテストするか |
|------|--------------|---------------|
| 1 — 静的 | `bun run test`(無料) | コマンドの検証、スナップショットのフラグ、Aside の契約の固定、描画ラッパーのオプションの対応、SKILL.md の正しさ、TODOS-format.md の参照、可観測性の単体テスト |
| 2 — E2E | シャード化された有料ランナー(`bun run eval:bg:pr`、`eval:bg:release`) | `claude -p`、PTY、Agent SDK のセッションによるスキルの完全な実行 |
| 3 — LLM eval | 同じランナー。`test/skill-llm-eval*.test.ts` | 生成された SKILL.md ドキュメントの LLM-as-judge による採点 |

コマンドは [どのコマンドを実行すればよいか](#which-command-do-i-run) から選んでください。

有料の PR ゲートは、明示的な短い振る舞いのプロファイルを使います。選択されたすべての品質審査員は含まれたままです。マニフェストでは、延期された振る舞いを、合格とは別に一覧します。解決できない依存関係があると、ゲートはフルに戻ります。ジョブのサマリーには、その原因となった各ファイルと修正方法が示されます([PR の有料レーンのフォールバック](docs/TESTING_INTERNALS.md#pr-paid-lane-fallback))。登録されていないカバレッジの新しいプロンプトは、プランニングで失敗します。既知の広範な振る舞いは、プロンプトが変わった場合に目に見える形で延期されたままになります。それらは、黙って PR の合格を得ることはありません。フルゲートと periodic の調査は、毎週と、`evals-periodic.yml` の手動ディスパッチで新たに実行されます。`bun run eval:bg:release` は両方を実行します。そのため、広範な振る舞いの失敗の一部は、PR ゲートの後で見つかることになります。

ブロッキングする有料レーン(PR ゲートと、週次の periodic + ゲートの調査)は、セットアップを含めて中央値が約 10 分になるよう目指しています。プランナーは、ティアごとに記録された実行時間(`scripts/paid-test-durations.json`)を使い、必要な数だけ 7 分(420 秒)のランナーに詰め込みます。ファイル 1 つ、またはきつく詰めたグループ 1 つずつです。ケースは短いが合計が長いファイルは、ランナーごとに 1 ケースずつ実行します。マトリクスのサイズと各ランナーのジョブのタイムアウトは、このプランから決まります。そのため、ハングしたランナーは、自身の上限の中で失敗します。`bun run scripts/test-paid-shards.ts --tier periodic --list --slice-budget 420 --jobs 2` で無料でプレビューできます。最初から最後までの完全なフローは `marathon` ティア(`describeE2ETier('marathon')`)に属します。これは、ブロッキングしない `evals-marathon.yml` のレーンでのみ実行され(週次と、ディスパッチ時)、マージをブロックすることは決してありません。

判定: 有料の eval は決して再試行しません。例外は、ゲートが赤くなったケースの判定を、同じ HEAD で 1 回だけフレーキーとして再実行する場合です([フレーキーの再実行](docs/TESTING_INTERNALS.md#flaky-reruns))。各ケースの種類は `E2E_KINDS`(`test/helpers/touchfiles-data.ts`)で決まります。試行の回数は、実行の前に `EVAL_POLICY`(`test/helpers/periodic-exclude-data.ts`)の定数から固定されます:

- `rule`(既定): 試行は 1 回です。アサーションが 1 つでも失敗すれば、そのケースは失敗です。判定を決める確率的な要素がない場合や、判定が製品が毎回満たすべき契約を確認する場合(プランモードでの書き込みなし、決定の前の質問、スキルが必須とするステップ、秘密情報の漏えいなし)に使います。
- `behavior`: 3 つの独立した試行のパネルを、並列のケースシャードとして実行します。契約違反がなく 2 回以上合格すると PASS です(`expectContract()`)。ライブのモデルの選択が判定を決め、まれな逸脱が製品の振る舞いとして許容できる場合にのみ使います。理由は 1 行で `BEHAVIOR_WHY` に書きます。
- `judge`: 固定された入力を LLM の審査員が採点します。同じプロンプトで、ちょうど 3 つのサンプルを取ります。各観点は中央値で判定し、3 つのうち少なくとも 2 つのサンプルで、変更されていないしきい値と照らします(真偽値は多数決、平均は報告のみ)。エラーを返したサンプルがあると、パネルは失敗となり、再サンプリングはしません。

タイムアウト、クラッシュ、またはインフラの失敗が起きた試行は、失敗した試行として数え、その種類とともに報告されます。試行が欠けている場合、ケースは INCOMPLETE となり、レーンは失敗します。3 回中 2 回の合格は `PASS 2/3` と、失敗した試行の原因とともに報告されます。クリーンな合格として報告されることはありません。このポリシーによって、ケースの予算やしきい値が変わることはありません。隔離(`CASE_QUARANTINE`)と履歴は `docs/TESTING_INTERNALS.md` に書かれています。`bun run eval:pass-rates --case <id>` は、ケースごとの試行の合格率と、その Wilson 区間を示します。

**調査が赤くなったら?** [docs/evals/census-red.md](docs/evals/census-red.md) に従ってください。赤い行を読み、`bun run eval:pass-rates --run <id>` でその証拠を確認し、`--reds` と `--headroom` を確認し、無料の回帰テストで修正してから、初めて行の `after a repair:` にあるコマンドで有料の実行を 1 回だけ行います。`main` 上の赤い調査は、週次の追跡 Issue に報告されます。ブランチでディスパッチされた調査は、同じレポートをその実行のサマリーと `census-report` のアーティファクトに書き出します。

CI は、同じ PR の中で 24 時間の間、16 個のワークフロー品質審査員について、検証済みの初回の結果の再利用を有効にします。Cookie のワークフローのカスタム入力と、他の 11 個の品質ケースは、毎回新しく実行されます。PR プロファイルの E2E シャードのうち 1 回だけ実行されるもの(再試行なし。そのため合格は初回の試行だと証明できます)は、消費されるすべての入力がバイト単位で同一であれば、同じ PR の合格を再利用します。入力とは、テストの import の閉包、登録されたケースのタッチファイルが指すすべての追跡ファイル、グローバルのタッチファイル、ランナーとワークフロー、子プロセスの EVALS_/GSTACK_/CLAUDE_/ANTHROPIC_ の環境変数(シークレットの有無のみ)、CI イメージと Claude CLI のバージョンです(`scripts/e2e-shard-reuse.ts`)。計算で決まるケースの登録や、何にも一致しないタッチファイルのパターンがあると、シャードは新鮮なままです。週次の調査、marathon、リリースのレーンでは、再利用は行いません。ローカルの実行は、スコープ付きのキャッシュと実行時の設定が完全に提供されない限り、新鮮なままです。キーには、プロンプトの完全なバイト列、生成された入力、フィクスチャ、ランナーと採点基準のコード、インストールされた依存関係、モデルの設定、ランタイムが含まれます。
再利用された採点は、現在のアサーションで改めて検証されます。記録には、元の実行、リビジョン、時刻が保持されます。再利用によって時刻が更新されることはありません。失敗した結果、再試行された結果、部分的な結果、入力が不明な結果は、再利用できません。
`EVALS_FRESH=1` で再利用をバイパスできます。periodic と release の実行は、常にバイパスします。

所要時間の目標は、編集のフィードバックで 1 分未満、一般的な PR チェックで 3〜5 分、無料のテスト全体の実行で、独立した CI マシン上で 60〜90 秒です。これらは目標であり、タイムアウトの短縮や保証ではありません。ローカルの完全なスイートは、利用可能な CPU のアフィニティを使い、Linux では最大 16 ワーカー、macOS と Windows では 6 ワーカーを使います。短い編集のループには `test:quick` を使ってください。小さな開発マシン、コンテナ、クラウドのサンドボックスでは、`bun run test:ubicloud` を使うと、CI レーンの環境を持つ新しい 16 vCPU の Ubicloud VM で完全なスイートを実行します(VM の起動とセットアップを含めて、端から端まで約 4 分半)。以下にある過去の 6 ワーカーの結果と、[4 CPU のポートフォリオ比較](docs/TEST_PORTFOLIO.md#measurement-contract)は、特定のマシンでの測定値です。CI のセットアップ、ビルド、キューの時間は別に報告されます。測定値を更新するには、`bun run test:ubicloud --record-durations` を使ってください(ノートパソコンでの記録は許容されません。[無料スイートの期間シード](docs/TESTING_INTERNALS.md#free-suite-duration-seed)を参照してください)。公開の前には、その シードと既存の `QUICK_CORE` のリストを使って、新しいリグレッションを素早いフィードバック用に分類してください。未知のファイルを速いと分類したり、クイックの結果を本番の受け入れに使ったりしてはいけません。ランナーは完全なログを `.context/free-test-logs/` に保存し、失敗時には次の修正の手順を説明します。詳細は [free-runner recovery](docs/TESTING_INTERNALS.md) を参照してください。完全な受け入れでは、必須の無料の CI レーンが、完全なインベントリを独立したランナーに分散させ、成功を報告する前にすべてのシャードの受領書を確認します。ローカルのワーカー数は、ブラウザやプロセスの競合を避けるために制限されたままです。

2026-09-21 の過去の測定:

| 実行 | 対象 | 所要時間 |
|---|---|---|
| ローカルの編集フィードバック | 無料のテストファイル 993 件のうち 861 件 | 38 秒 |
| ローカルの無料スイート全体 | 993 ファイルすべて、6 ワーカー | 4 分 35 秒 |
| Linux の CI 全体 | 993 ファイルすべて、独立した 20 台のランナー | テストステップで 1 分 40 秒、セットアップと集約を含めて 3 分 7 秒 |

2026-09-29 のテスト監査の後([根拠](docs/test-audit-2026-09.md)):

| 実行 | 対象 | 所要時間 |
|---|---|---|
| 無料のスイート全体。`bun run test:ubicloud`(standard-16) | 857 ファイルすべて、20,302 件の合格したテスト | VM 上で 136 秒。記録された直列のテスト時間は 1,738 秒 |

[Linux の CI の実行](https://github.com/garrytan/gstack/actions/runs/35642667809)は、`25030d68` 上で、記録された 1 回の成功した再試行を含みました。最も遅いテストステップは 77 秒でした。開始時刻をずらしたため、テスト全体の期間はそれより長くなりました。小さな変更での、典型的な PR の有料ゲートの所要時間は、まだ測定が必要です。有料の作業を必要としないのは、無料のランナーの変更だけを明示的に免除したものです。マッピングされた依存関係が優先され、未知の依存関係は広範なフォールバックを維持します。[カバレッジの境界](docs/TEST_PORTFOLIO.md#repeated-work-removed)を参照してください。

有料の eval が失敗したら、製品またはハーネスを修正し、捕捉したケースを、検出器の所有者テストに 1 行として追加してください(検出器から所有者への表は [TEST_PORTFOLIO.md](docs/TEST_PORTFOLIO.md#detector-owner-tests) にあります)。新しいファイルを、インシデントごとに追加してはいけません。1 行とは、既存のものの隣にある 1 つの `describe` ブロックまたは表のエントリのことです。例えば、`test/eng-first-review.test.ts` に新しい `describe('eng-cache-writes-at', …)` を追加し、そのフィクスチャを読み込んで、捕捉された呼び出しに対して `engFirstReviewAUQ` をアサートします。`bun test <owner-test>` を実行し、次に `bun test test/test-of-test-ratchet.test.ts` を実行してください。この ratchet は、`test/` のコードだけを import する新しいテストファイルや、有料のテストファイルのソースを読んでスライスする新しいテストファイルがあると失敗し、代わりに使うべき所有者テストを示します。

テンプレートと生成された SKILL.md に対するテストでは、`test/helpers/prompt-structure.ts`(`between`、`expectTokens`、`expectAbsent`、`expectOrdered`、`expectMentions`)を使います。機械が読むトークンとステップの順序は正確に、安全に関するルールは 1 つの文の中での大文字小文字を区別しないキーワードの同時出現で確認します。英語の文を固定してはいけません。[テストの価値の基準](docs/test-value-bar.md)を参照してください。

[AGENTS.md の検証の規律](AGENTS.md#validation-discipline)に従ってください。既知の失敗は集中したチェックで再現し、隣接するソースと生成の契約を検証し、その後に影響を受ける残りの必須の選択的な評価を実行してください。レビューの修正とリリースの準備を終えてから、凍結したコードに対して無料のスイート全体を 1 回実行してください。修正の作業中は、コミットのたびにスイート全体を実行する代わりに、集中したチェックを使ってください。

### ティア 1: 静的検証(無料)

`bun run test` で実行されます。これは `scripts/test-free-shards.ts` を経由し、N 個の並行するシャードのプロセスを、厳密な出力の契約のもとで実行します。bun 自身の終了時の要約行を出さずに終了したシャードや、クラッシュしたワーカーは、実行全体を失敗させます。そのため、静かな打ち切りが緑のまま報告されることはありません。完全な子プロセスの出力を見るには `--verbose` を、シャードごとの強制終了の期限を上書きするには `--wall-timeout <secs>` を指定します。`GSTACK_FREE_JOBS=<n>` は、シャードの数を上書きします(数字のみ。無効な値には大きなエラーを出します)。`GSTACK_FREE_RETRY_FLAKY=1` は、システムコールを監視するサンドボックス向けに、直列の再試行を 1 回追加するオプションです(ローカルでは既定で無効です。開発マシンではフレーキーさを見えるようにすべきです。必須の CI の無料レーンではこれを有効にし、フレーキーな各合格を `flake-ledger-<shard>` の JSONL アーティファクトに保存します。週次の健全性テストは、main の実行の 5% を超えてファイルがフレーキーになったときに失敗します。[フレーキーの台帳](docs/TESTING_INTERNALS.md#flake-ledger)を参照してください)。
クラウドのサンドボックスで作業していますか? ブートごとに一度 `scripts/sandbox-doctor.sh` を実行すると、スイートが緑で通ります(詳細は [docs/TESTING_INTERNALS.md](docs/TESTING_INTERNALS.md))。または、`bun run test:ubicloud` でサンドボックスの制限を完全に回避できます。
スイート全体に素の `bun test` を使ってはいけません。リポジトリ全体を走査し、有料の eval ファイルを読み込み、厳密な分類器をすり抜けてしまいます。API キーは不要です。

- **スキルのパーサーのテスト**(`test/skill-parser.test.ts`) ― SKILL.md のbash コードブロックからすべての `$B` コマンドを抽出し、`browse/src/commands.ts` のコマンドレジストリに照らして検証します。誤字、削除されたコマンド、無効なスナップショットのフラグを検出します。
- **スキルの検証テスト**(`test/skill-validation.test.ts`) ― SKILL.md ファイルが実在するコマンドとフラグだけを参照していること、コマンドの説明が品質のしきい値を満たしていることを検証します。また、AGENTS.md と docs/skills.md のスキルの一覧とも突き合わせます。
- **Aside のドライバー契約**(`test/aside-driver.test.ts`) ― スキルのブラウザの振る舞いは `scripts/resolvers/aside.ts`(`{{ASIDE_SETUP}}`)に対して書かれており、Mac 上の Aside CLI に対してライブで検証されています。CI では Aside を実行できないため、`aside` がインストールされていない場所では Aside の E2E テストは自動的にスキップされます。CI が証明するのは、静的な固定(検出、フォールバックの引き渡し、同意、認証情報、スクリプトごとに 1 フロー、番兵)です。
- **Aside の描画ラッパー**(`test/aside-render.test.ts`) ― `lib/aside-render.ts` のオプションの対応と生成されるスクリプトをどこでも固定し、偽の `aside` / `browse` の実行ファイルを使って両方のエンジンをhermetic に動かします(プローブの分類、標準出力の契約、ループバックサーバーのポリシー、失敗のパス、タイムアウトによる強制終了、エンジンの選択、実行途中のフォールバック)。本物の描画(本物の Aside による PDF とスクリーンショット)は、Aside が開いている場所でのみ実行され、それ以外では自動的にスキップされます。make-pdf の描画ゲート(`make-pdf/test/e2e/*-gate.test.ts`)と `test/skill-e2e-diagram.test.ts` は、エンジンに依存しません。解決されたどのエンジン(`browserAvailable()` ― Aside、または `bun run build:gates` がコンパイルする browse バイナリ。Linux の CI がこれを使います)でも実行され、どちらも存在しない場合のみスキップされます。
- **描画の CLI**(`test/gstack-render-cli.test.ts`) ― 偽のデーモン(`GSTACK_SKIP_ASIDE=1` + `GSTACK_BROWSE_BIN`)に対して `bin/gstack-render.ts` を固定します。引数のガードは使用法の 1 行とともに終了コード 1 で終了し、`--help` は 0 で終了し、`ENGINE=` が最初に出て、次に `OK <path>`、そしてフェンス付きの `EVAL` / `PAGE_ERRORS` が続きます。`--serve-root` の封じ込め、ブラウザがない場合の最初の行、描画が成功した後のプロンプトの終了も含みます。`make-pdf/test/cli-exit-codes.test.ts` と `make-pdf/test/setup-smoke.test.ts` は、`pdf` バイナリのエラーから終了コードへの対応表と、`$P setup` のエンジンの報告を固定します。
- **ジェネレーターのテスト**(`test/gen-skill-docs.test.ts`) ― テンプレートのシステムを検証します。プレースホルダーが正しく解決されること、出力にフラグの値のヒントが含まれること(例: `-d` だけでなく `-d <N>`)、主要なコマンドの説明が充実していること(例: `is` は有効な状態を列挙し、`press` はキーの例を列挙する)を確認します。
- **デザインの検出器、カタログ、DESIGN.md**(`test/gstack-design-detect.test.ts`、`test/design-detect-contract.test.ts`、`test/design-catalog.test.ts`、`test/design-checklist-sync.test.ts`、`test/design-md.test.ts`、`test/frontend-scope.test.ts`、`test/impeccable-fixtures.test.ts`) ― `test/fixtures/fake-impeccable.ts` の偽のエンジンを通じて `bin/gstack-design-detect.ts` を駆動します(プローブの順序、リポジトリのファイルを決して実行しないというルール、`--changed` の対象の許可リスト、`design_detector: off`、分析の行、出力のサニタイズ)。カタログの不変条件と、生成された `review/design-checklist.md` を固定し、オープンな DESIGN.md のリーダーとライターを往復させ、実際のエンジンのキャプチャ(`test/fixtures/impeccable-*.json`、エンジン 0.1.3)を契約に照らして確認します。`test/dom-dump-hygiene.test.ts` は、`lib/dom-dump.js` を browse バイナリを通じて実際の Chromium のページで実行します。バイナリがなければ自動的にスキップされ、CI の外ではオプトイン(`GSTACK_DOM_DUMP_HYGIENE=1`)です。
- **ティアの整合性の不変条件**(`test/e2e-tier-alignment.test.ts`) ― touchfiles の依存リストに名前がある、自己ゲートされた `test/skill-e2e-*.test.ts` のそれぞれについて、そのファイルの `EVALS_TIER` の自己ゲートは、`E2E_TIERS` で宣言されたティアと一致しなければなりません。これは「効果のない降格」を防ぎます。テストが `touchfiles.ts` で別のティアに移されても、ファイルが古いティアでゲートされたままで、間違ったレーンで実行され続けるという問題です。マッピングのないファイルや、ティアが混在したファイルは、黙ってスキップせず報告します。
- **カタログの予算**(`test/catalog-budget.test.ts`) ― 検出の対象となる表面の合計を制限します。すべてのスキルの frontmatter の `name` と `description` の合計(すべてのホストが、すべてのセッションで検出時に読み込むもの)は、1,171 トークン相当を下回らなければならず、スキルごとに 260 バイトの上限があります。数え方は `test/helpers/skill-census.ts` の共有の集計を通じて行われます(物理ファイル、認可されたスキル、レジストリのエントリ ― 意図的に異なる 3 つの数)。スキルを追加する場合は? 失敗のメッセージに、再測定と ratchet の手順が書かれています。
- **コンテキスト予算の ratchet**(`test/context-budget-ratchet.test.ts`) ― カタログの予算が対象にしない 2 つのトークンの台帳に、CI の上限を設けます。常時有効な完全な frontmatter の合計と、スキルごとの呼び出し時の即時トークン(SKILL.md と強制的に読まれる参照)です。`lib/context-bill.ts` を通じて `test/fixtures/context-budget.json` に照らして採点されます。新しいスキルは、上限を持つまで失敗します。削除されたスキルの上限は取り除かなければなりません。正当な増加や削減を反映するには、`bun test/helpers/capture-context-budget.ts` を再実行し、更新したフィクスチャを同じコミットでコミットしてください。こうすると、この変更が差分の中で目に見える判断になります。
- **依存関係のセキュリティの回帰**(`test/dependency-security.test.ts`) ― `bun test test/dependency-security.test.ts` を実行すると、解決された `sharp` と `adm-zip` のバージョンの下限を確認し、Sharp を読み込み、通常の ZIP の展開を確かめ、展開先のファイルとディレクトリのシンボリックリンクを経由した展開を拒否します。シンボリックリンクのケースは Windows ではスキップされます。これらのチェックは OSV のスキャンを補うものであり、その既存の例外は変更しません。

### ティア 2: `claude -p` による E2E

`claude -p` をサブプロセスとして `--output-format stream-json --verbose` で起動し、リアルタイムの進捗のために NDJSON をストリームし、browse のエラーをスキャンします。これは「このスキルは実際に端から端まで動くか?」に最も近い確認です。

```bash
# Must run from a plain terminal — can't nest inside Claude Code or Conductor
EVALS_RUN_ID="local-$(bun -e 'console.log(crypto.randomUUID())')" EVALS=1 bun test test/skill-e2e-*.test.ts
```

- `EVALS=1` 環境変数でゲートされています(誤って高額な実行をしないためです)
- Claude Code の中では自動的にスキップされます(`claude -p` は入れ子にできません)
- API の接続の事前チェック ― 予算を使う前に ConnectionRefused で素早く失敗します
- 標準エラーへのリアルタイムの進捗: `[Ns] turn T tool #C: Name(...)`
- NDJSON の完全なトランスクリプトと、失敗時の JSON を保存して、デバッグに使えます
- テストは `test/skill-e2e-*.test.ts` にカテゴリごとに分かれています。ランナーのロジックは `test/helpers/session-runner.ts` にあります

呼び出しごとに新しい `EVALS_RUN_ID` を指定してください。デタッチした実行(下記)も同様です。
機能の QA とドキュメントのケースは、それがなければ受け入れを拒否します。CI は独自の実行、試行、ジョブ、スライスの識別子を提供します。保持されるネイティブのキャプチャのアーティファクトについては、[テストの内部構造](docs/TESTING_INTERNALS.md) を参照してください。

**既定でhermetic です。** すべての E2E ランナー(claude -p、実際の PTY のプランモードのランナー、Agent SDK のランナー、さらに codex と gemini のランナー)は、子プロセスを `test/helpers/hermetic-env.ts` を通じて起動します。許可リストで環境変数を絞り込み、新たにシードされた `CLAUDE_CONFIG_DIR`、一時的な `GSTACK_HOME`、`--strict-mcp-config` を使います。オペレーターの `~/.claude` の設定、MCP サーバー(gbrain、Conductor)、スキル、`~/.gstack` の決定ログ、`CONDUCTOR_*` の環境変数は、子プロセスに決して漏れません。`GITHUB_` と `EVALS_` の接頭辞のルールは、CI のメタデータを保持しますが、`GITHUB_TOKEN`、`GITHUB_PERSONAL_ACCESS_TOKEN`、`GITHUB_APP_PRIVATE_KEY` のような認証情報らしい名前は拒否します。スクリーンはアンダースコアで区切られたすべての部分を読むため、末尾の修飾子によって名前がすり抜けることはありません(`GITHUB_APP_PRIVATE_KEY_BASE64`、`GITHUB_TOKEN_1`)。一方、認証情報の単語を含むだけの部分はメタデータのままです(`GITHUB_PATH`、`GITHUB_TOKENIZER`)。名前付きのプロバイダーの認証、ランナーの `extraAllow` のエントリ、テストごとの上書きは意図的な例外です。名前のルールでは、任意のメタデータ名に割り当てられた秘密情報を特定できないためです。これにより、ローカルの eval のシグナルは、テスト対象のコードとは無関係な理由で CI と食い違うことがなくなり、CI と揃います。hermetic な `CLAUDE_CONFIG_DIR` は、既定ではスキルをシードしません。`/skill` のスラッシュコマンドを入力する PTY テストは、PTY ランナーに `seedSkills: true` を渡します。すると、`hermeticSkillsConfigDir()` に切り替わります。これは、ライブの作業ツリーの SKILL.md ファイルにシンボリックリンクを張るシードされたスキルのレジストリです(意図的な設計です。スキルがテストの対象なので、スナップショットでは古いコピーを測ることになってしまいます)。オペレーターの実際の状態に対してデバッグするには `EVALS_HERMETIC=0` を設定します(これは `--strict-mcp-config` も外します)。この配線は、`test/hermetic-wiring.test.ts`(無料の静的な番兵)、`test/skill-e2e-hermetic-canary.test.ts` のゲートティアの隔離のカナリア 2 つ、そして `test/hermetic-skills-seeding.test.ts` と `test/pty-skill-seeding-wiring.test.ts` のスキルのシードの番兵によって固定されています。

### E2E の可観測性

E2E テストを実行すると、`~/.gstack-dev/` に機械可読なアーティファクトが生成されます:

| アーティファクト | パス | 目的 |
|----------|------|---------|
| ハートビート | `e2e-live.json` | 現在のテストの状態(ツール呼び出しごとに更新) |
| 部分的な結果 | `evals/_partial-e2e.json` | 完了したテスト(強制終了後も残る) |
| 進捗ログ | `e2e-runs/{runId}/progress.log` | 追記専用のテキストログ |
| NDJSON のトランスクリプト | `e2e-runs/{runId}/{test}.ndjson` | テストごとの生の `claude -p` の出力 |
| 失敗時の JSON | `e2e-runs/{runId}/{test}-failure.json` | 失敗時の診断データ |

**ライブの進捗:** `~/.gstack-dev/eval-runs/` の下にあるデタッチした実行のログには、各シャードの結果が届くたびに流れます。CI の実行には `gh run watch <run-id>` を使ってください。テストごとの進捗は、各シャードの `progress.log` にあります。

**eval の履歴ツール:**

```bash
bun run eval:list            # list all eval runs (turns, duration, cost per run)
bun run eval:compare         # compare two runs — shows per-test deltas + Takeaway commentary
bun run eval:summary         # aggregate stats + per-test efficiency averages across runs
bun run eval:pass-rates      # per-case trial pass rates + Wilson intervals from recent weekly runs (--case, --runs, --dir, --backfill, --json, --gate)
bun run eval:pass-rates --reds       # verdict reds per census by failure class and cause, all-green probability
bun run eval:pass-rates --headroom   # slowest session per case vs its armed budget (alarm above 85% in --gate)
bun run eval:pass-rates --run <id>   # one census's reds with their values and fetched transcript evidence
```

**長い eval のためのデタッチした実行。** エージェント(あるいは、見守りたくない実行をするあなた)が長い eval を起動するときは、`eval:bg:*` のスクリプト(`scripts/eval-bg.ts`)を使います。各スクリプトはバックエンドを選び、それを表示します:

- **dispatch**(garrytan/gstack に push された、クリーンな HEAD で、`gh` がある場合): そのレーンを、その正確なリビジョンで CI 上で実行し、ローカルのログから追跡します。
- **local**(それ以外の場合、または `--local` の場合): このマシン上でシャード化された有料ランナーを実行します。上限は ceil(1.5 × 計画された直列の秒数 / `EVALS_JOBS`) + 20 分で、最大 4 時間です(`--timeout SECS` で上書きできます)。

どちらも `bin/gstack-detach` の下で実行されます。これは、ターンの境界の SIGTERM を逃れる新しいセッション、アイドル時のスリープを防ぐ `caffeinate` のラッパー、マシン全体の `gstack-evals` ロック(並行する作業ツリーが直列に待ち、モデル API を飽和させないため)、`~/.gstack-dev/eval-runs/` 配下の実行ごとのログ、そして必ず出力される `### gstack-detach EXIT=<code> ###` のセンチネルです。これにより、ポーリングしている側が沈黙を成功と取り違えることはありません。`bun run scripts/eval-bg.ts --help` でフラグを一覧できます。`bun run scripts/eval-bg.ts status <log-or-run-id>` で実行に再接続できます。

```bash
bun run eval:bg:pr           # changed coverage (CI: evals.yml, evals_all=false)
bun run eval:bg:release      # fresh full gate + periodic (CI: both workflows)
bun run eval:bg:gate         # gate tier (CI: evals.yml, evals_all=true)
bun run eval:bg:periodic     # periodic tier (CI: evals-periodic.yml)
```

ローカルのバックエンドは、シャード化された有料ランナー(`scripts/test-paid-shards.ts`。`bun run test:gate:sharded` / `bun run test:periodic:sharded` として直接使うこともできます)を通じて実行されます。テストファイルごとに 1 つの Bun プロセス、シャードのプロセスグループ全体(迷子の `claude`/`codex` の孫プロセスも含む)を強制終了する外部の経過時間のタイムアウト、シャードごとの eval ディレクトリ(`GSTACK_EVAL_DIR=<evalDir>/shards/<slug>/`)、そして、失敗、タイムアウト、未開始のシャードを区別する集計を持ちます。ランナーは差分によってもテストを選びます。ブランチが触れていないシャードは skipped-by-diff として報告され、理由を示す選択のバナーが表示されます(`EVALS_ALL=1` で全件を強制できます)。`EVALS_JOBS` は同時に実行されるシャードのプロセス数を設定します(既定 8。`test:pr` は 2 に設定します)。`EVALS_CONCURRENCY` は、シャードの内部での bun の同時実行数です(既定 2)。この 2 つは意図的に別のつまみです。`eval:list`、`eval:compare`、`eval:summary`、`eval:pass-rates` はシャードを認識します。自分のターミナルで `bun run test:pr` をフォアグラウンドで実行する人は、これを必要としません。そこでは Ctrl-C が想定された操作です。

**評価結果の比較コメント:** `eval:compare` は、実行間で何が変わったかを解釈する自然言語の Takeaway セクションを生成します。回帰の指摘、改善点の指摘、効率面の向上(ターン数の減少、高速化、低コスト化)の明示、全体の要約を行います。これは `eval-store.ts` の `generateCommentary()` によって生成されます。

アーティファクトは一切自動削除されません。事後分析やトレンド分析のために `~/.gstack-dev/` に蓄積されます。

### Tier 3: LLM-as-judge(LLM による判定)

デフォルトで `claude-fable-5-1` を使い、生成された SKILL.md ドキュメントを3つの観点で採点します。
実行ごとに judge モデルを上書きするには `GSTACK_EVAL_MODEL_JUDGE` を使います:

- **Clarity(明確さ)** — AI エージェントが曖昧さなく指示を理解できるか?
- **Completeness(網羅性)** — すべてのコマンド、フラグ、利用パターンが文書化されているか?
- **Actionability(実行可能性)** — ドキュメントに書かれた情報だけで、エージェントがタスクを実行できるか?

各観点は、同じプロンプトに対する3サンプルのパネルによって1〜5点で採点されます。サンプルは並行して取得されます。各観点のパネル中央値(3サンプル中少なくとも2つ)が、その judge の閾値を満たす必要があります(ほとんどの観点では ≥ 4。ケースごとの詳細は各ケースを参照)。エラーになったサンプルがあればパネルは失敗します。また、生成されたドキュメントを `origin/main` の手書きベースラインと比較する回帰テストもあります。生成されたドキュメントのスコアは、同等以上でなければなりません。

`.env` に `ANTHROPIC_API_KEY` が必要です。judge のファイルは、すべての有料レーンで実行されます(`bun run eval:bg:pr` は差分に関係するものだけを選びます)。

- judge モデルは `lib/eval-model.ts` を通じて解決され、上記の上書き順に従います
- テストは `test/skill-llm-eval.test.ts` にあります
- Anthropic API を直接呼び出します(`claude -p` は使いません)。そのため、Claude Code の内部を含め、どこからでも動作します

### 有償テストの touchfile

`test/helpers/touchfiles-data.ts` は、各有料ケースを、そのケースを選択するファイルにマッピングします。無料の `*.test.ts` ファイルは一切記載されません。つまり、無料テストを編集しても有料 eval は実行されません。`test/touchfiles.test.ts` は、各有料ファイルの静的な `test/helpers` / `test/fixtures` の import 閉包と、文字列リテラルで名前が挙がっている fixture・helper のパスを導出し、その閉包がケースのキーでカバーされていないと失敗します。失敗したら、指摘されたパスを指定のキーに追加し、次のコマンドで選択結果を確認してください: `bun run scripts/test-paid-shards.ts --tier gate --profile pr --list`。このルールは下限です。テストが実行時に組み立てる fixture のパスはテストから見えないので、そのようなパスは手動でキーに追加してください。

### 有料 eval を追加する

1. **テストファイル。** 有料テストファイルにケースを書き、リテラル名で登録します(`testIfSelected('<case-id>', ...)`)。ステップそのものが契約である場合を除き、文言ではなく結果(ファイル、git の状態、ネイティブの質問、終了ステータス)を評価してください。契約上のアサーションは `expectContract()` で囲みます。
2. **Touchfiles。** `E2E_TOUCHFILES` に `'<case-id>': [...]` を追加します。不足している閉包のパスがあれば、`bun test test/touchfiles.test.ts` が指摘してくれます。
3. **Tier。** `E2E_TIERS` に追加します。すべての PR が必要とする安価な契約は `gate`、長時間かかるケースやモデルの品質に関するケースは `periodic`、完全なフローは `marathon` にします。
4. **Kind。** `E2E_KINDS` に追加します(ライブのモデルの選択が逸脱しても許容される場合を除き `rule`。許容される場合は `behavior` と `BEHAVIOR_WHY` の行を加えます)。`bun test test/eval-kinds.test.ts` が、追加すべきリテラルを表示します。
5. **PR プロファイル。** PR で実行すべきなら `scripts/test-pr-profile.ts` に追加し、`bun run scripts/test-paid-shards.ts --tier gate --profile pr --list` で確認します。
6. **ローカルでパネルを試す。** push の前に `bun run scripts/test-paid-shards.ts --tier <tier> --case <case-id> --trials 3` を実行すると、CI と同じパネルが動きます。

<a id="retired-commands"></a>
### 廃止されたコマンド

以下のパッケージスクリプトは、1リリースの間だけ残るスタブです。実行すると代替コマンドを表示し、終了コード 1 で終わります(`scripts/retired-command.ts`)。次のリリースで削除される予定です。

| 廃止されたコマンド | 代わりに使うもの | 廃止の理由 |
|---|---|---|
| `test:evals` | `bun run eval:bg:pr` | Tier の指定がなく、Tier でゲートされた有料ファイルをすべてスキップしていた |
| `test:evals:all` | `bun run eval:bg:release` | Tier の指定がなく、Tier でゲートされた有料ファイルをすべてスキップしていた |
| `test:e2e` | `bun run eval:bg:pr` | Tier の指定がなく、Tier でゲートされた有料ファイルをすべてスキップしていた |
| `test:e2e:all` | `bun run eval:bg:release` | Tier の指定がなく、Tier でゲートされた有料ファイルをすべてスキップしていた |
| `test:gate` | `bun run test:gate:sharded` | 単一プロセスの fan-out は一度も完了しなかった |
| `test:periodic` | `bun run test:periodic:sharded` | 単一プロセスの fan-out は一度も完了しなかった |
| `test:codex` | `bun run test:periodic:sharded` | `EVALS_TIER` を設定しておらず、periodic Tier の Codex ファイル2つがどちらも 0 件しか実行されなかった |
| `test:codex:all` | `bun run test:periodic:sharded` | `test:codex` と同じ |
| `eval:bg` | `bun run eval:bg:pr` | 廃止された `test:evals` をデタッチ実行していた |
| `eval:bg:all` | `bun run eval:bg:release` | 廃止された `test:evals:all` をデタッチ実行していた |
| `eval:flake-rank` | `bun run eval:pass-rates` | 同じスクリプトの別名 |
| `eval:watch` | `gstack-detach` のログを tail する、または `gh run watch <run-id>` | 非シャードのランナーだけが書くファイルを読んでいたため、シャード実行では何も表示されなかった |
| `test:audit` | `bun run test` | `test/audit-compliance.test.ts` は無料スイートで既に実行されている |

### CI

GitHub Action(`.github/workflows/skill-docs.yml`)は、main への push と PR のたびにすべてのホスト向けの生成を行い、追跡対象の差分と、無視されていない未追跡の出力を拒否します。生成時のエラーもジョブを失敗させます。省略可能で無視されるホストのキャッシュは Git と比較されません。

これと並行して、サプライチェーンのゲートも動作します:

- **品質ゲート**(`.github/workflows/quality-gate.yml`、すべての PR と push) — 差分で追加された行を、gstack 自身の redact エンジン(`.github/scripts/gate-secret-scan.mjs`)で認証情報がないかスキャンします。HIGH の検出はジョブを失敗させ、MEDIUM の検出は助言的な件数として表示されます。スキャンがレポートを作れない場合は fail closed します。setup とビルドの境界では ShellCheck も実行します。
- **依存関係レビュー**(`.github/workflows/dependency-review.yml`) — `package.json` または `bun.lock` を変更する PR で依存関係の変更をレビューし、high または critical の脆弱性勧告があれば失敗させます。これと週次の OSV スキャンが依存関係のゲートです。
- **OSV スキャナー**(`.github/workflows/osv-scanner.yml`) — OSV データベースに対して週次で脆弱性スキャンを行います。設定は `.osv-scanner.toml` にあり、明示的な `--config` フラグで読み込まれます(OSV はこのファイル名を自動検出しません)。無視エントリはすべて理由と `ignoreUntil` の期限が必要で、これは `test/osv-config-wiring.test.ts` が強制します。main の定期スキャンが失敗すると、追跡用 Issue「OSV scanner: vulnerable dependency needs triage」が作成・更新されます。スキャンがクリーンになると、その Issue はクローズされます。`test/osv-ignore-expiry.test.ts` は、どの `ignoreUntil` の14日前にも失敗するので、期限切れの抑制が PR の中で表面化します。
- **週次のテストヘルスチェック**(`.github/workflows/test-health.yml`、毎週月曜と手動実行) — `bun run test:health --since-days 7 --enforce` を実行します。main での少なくとも20回の実行のうち、無料テストファイルが5%を超えて不安定だった場合、または無料ファイル5件を超えて duration seed から欠けている場合に失敗します。失敗時は追跡用 Issue を1件作成・更新し、以前失敗していたチェックがすべて証拠付きで合格した場合のみクローズします。読み取れないメトリクスは「unavailable: <理由>; next: <次の手順>」と表示され、実行を失敗させることはありません。
- **Dependabot**(`.github/dependabot.yml`) — 依存関係の更新 PR をグループ化します。
- **OpenSSF Scorecard**(`.github/workflows/scorecard.yml`) — 週次と main への push ごとに実行します。結果はセキュリティタブと api.scorecard.dev で見られます。

- **プラットフォーム適格性チェック**(`.github/workflows/platform-qualification.yml`、手動実行と四半期ごと) — 他のどのレーンも前提条件を満たせないオプトインのテストを実行します。対象は ML のプロンプトインジェクション分類器(`SECURITY_BENCH=1`)、実際の gitleaks を使ったメモリの取り込み(`GSTACK_TEST_GITLEAKS`)、DebugBridge の Swift ビルド(`GSTACK_TEST_SWIFT=1`、macOS)です。`test/platform-qualification-workflow.test.ts` が、各ゲートが対応するジョブに固定されていることを確認します。

すべてのワークフローは、サードパーティ製のアクションを コミット SHA に固定しています(`test/workflow-action-pins.test.ts`)。PR テンプレート(`.github/PULL_REQUEST_TEMPLATE.md`)は、約束ではなく証拠(実行したテスト、eval の出力)を求めます。

テストは browse バイナリに対して直接実行され、dev モードは必要ありません。Aside 本体を必要とするもの(`test/skill-e2e-aside.test.ts`、Aside の qa/design ケース、`test/aside-render.test.ts` のライブレンダリング)は、Aside アプリを開いた Mac でのみ実行され、それ以外では自動的にスキップされます。make-pdf のレンダリングゲートと `/diagram` の E2E は、どのエンジンが解決されても実行されます。CI では `bun run build:gates` でビルドした browse バイナリで実行されます。

## SKILL.md ファイルを編集する

SKILL.md ファイルは `.tmpl` テンプレートから**生成**されます。`.md` を直接編集しないでください。次のビルドで変更は上書きされます。

```bash
# 1. Edit the template
vim SKILL.md.tmpl              # or browse/SKILL.md.tmpl

# 2. Regenerate for all hosts
bun run gen:skill-docs --host all

# 3. Check health (reports all hosts)
bun run skill:check

# Or use watch mode — auto-regenerates on save
bun run dev:skill
```

`skill:check` は、正規のコンテンツパスとホストのデフォルトを使って、すべてのホストを一時ストレージにレンダリングし、生成された内容全体を検証し、想定される追跡対象の成果物をチェックアウトと比較します。欠けている、変更されている、または無視されていない未追跡の出力があると失敗します。無視されているローカルのホストキャッシュ(シンボリックリンクのキャッシュを含む)には手を付けず、チェッカーはそれらがなくても動作します。生成が失敗した場合、部分的な出力が成功としてチェックされることはありません。

テンプレート作成のベストプラクティス(bash 特有の書き方より自然言語を使う、ブランチを動的に検出する、`{{BASE_BRANCH_DETECT}}` の使い方)については、CLAUDE.md の「Writing SKILL templates」セクションを参照してください。

skill 内のブラウザ操作は `aside repl` スクリプトで、`scripts/resolvers/aside.ts` のクックブックに従います。それぞれにフォールバックエンジン用の `$B` 版が対になっています。コミット前に、Aside 側の書き方を Aside CLI で実行して確認してください。ブラウズコマンドを追加するには `browse/src/commands.ts` に追加します。スナップショットのフラグを追加するには `browse/src/snapshot.ts` の `SNAPSHOT_FLAGS` に追加します。その後、再ビルドしてください。

**レンダリングは `lib/aside-render.ts` 経由で行い、skill に puppeteer/Chromium を同梱しないでください。** 自前の HTML/JSON をラスタライズまたは印刷する必要がある skill(図、カード、og-image、PDF)は、テンプレートから `bin/gstack-render.ts`(`--screenshot`、`--pdf`、`--eval JS --out FILE`)を呼び出すか、TypeScript で `lib/aside-render.ts` の `render` を import します(`renderWithAside` / `renderWithBrowse` はエンジンごとの実装で、`render` がどちらかを選び、Aside の CLI が起動できない場合や実行途中で CDP ブリッジを失った場合は、browse エンジンで1回だけ再試行します)。ラッパーは Aside が開いていればそれで印刷し、開いていなければ `browse` デーモンで印刷します(`newtab --json`、ループバック URL への `goto`、`js` による準備完了のポーリング、`pdf --from-file`、`viewport` + `screenshot`、`js --out`、`closetab`)。これにより、マシン全体で Chromium は1つだけ共有され、同じフラグと `OK <path>` の行が出力されます。`ENGINE=aside|browse` は実際にどちらがレンダリングしたかを示し、`EVAL` / `PAGE_ERRORS` の行は信頼できない Web コンテンツとして囲まれます。ループバックサーバーは、レンダリングごとに1つの秘密の URL を提供し、そのディレクトリの外へシンボリックリンクをたどることは決してありません。サイズを指定したスクリーンショットは、フォールバック時は 1x(Aside では 2x)です。JPEG の品質と `pageRanges`/`scale` は Aside 専用です。`--landscape` は用紙の寸法を入れ替えます。`npm i puppeteer` は決して行わず、バージョンが合わなくなる2つ目の Chromium を決してダウンロードせず、レンダラーをウェブサイトに向けることも決してしないでください。ラッパーに必要なオプションがなければ、`lib/aside-render.ts` に追加してください(`test/aside-render.test.ts` で固定し、CLI フラグなら `test/gstack-render-cli.test.ts` でも固定します)。そうすれば、すべての呼び出し元が両方のパスでそれを利用できます。テスト用の公開シームは次のとおりです: `pickEngine(fresh, deps)`(プローブとバイナリのリゾルバを注入)、`serveDir(root, nonce)`、`SAFE_TMP_DIR`、`PAGE_NUMBER_FOOTER`(make-pdf、`gstack-render`、browse の `pdf` コマンドが共有する、唯一のページ番号フッター)。

## フロンティアモデルのリリースごとのプロンプト監査

新しいフロンティアの Claude モデルが出たら、モデルが読むテキストを監査し、新しいモデルが過剰に適用している、またはもう必要としない指示を洗い出します。この監査は Anthropic の `/claude-api prompt-audit` で行います。これは、あなた自身の Claude Code セッションで実行する Claude Code スキルです。gstack は、それに何を渡せばよいかを表示するだけです。

```bash
bun run audit:manifest   # slices of templates, resolvers, overlays, CLAUDE.md and wording-pinning tests (--json for a machine-readable list)
```

1. Claude Code で、新しいモデルを対象にして `/claude-api prompt-audit` を実行します。スライスは1つずつ、そのスライスのファイル一覧を渡して実行します。`s01` は、すべての skill が読む共有テキスト(CLAUDE.md、モデルのオーバーレイ、プリアンブルのリゾルバ)です。skill のテンプレートとそのセクションは1つのスライスを共有します。
2. 指摘事項は、生成済みの SKILL.md ではなく、テンプレートとリゾルバで修正してから、`bun run gen:skill-docs --host all` を実行します。
3. 安全ルールは、そのまま守られているものとして扱います。モデルが変更前と変更後の両方で従うことを eval が示した場合にのみ、言い換えてください。
4. 「skill の文言を固定するテスト」のスライスは最後に扱います。文章を変えた場合は、完全一致の文言の固定を、構造や意味のチェックに置き換えてください(CLAUDE.md のテストセクションにあるプロンプトバイトのルール)。
5. `test/archaeology-lint.test.ts` は、Issue 番号やインシデントの経緯が生成されたテキストに混入するのを防ぎます。失敗時には、修正すべきソースファイルが表示されます。

## 用語リスト(V1 の文章スタイル)

gstack の文章スタイルのセクション(Tier 2 以上のすべての skill のプリアンブルに注入される)は、skill の呼び出しごとに初出の技術用語に注釈を付けます。注釈の対象となる用語のリストは `scripts/jargon-list.json` にあり、キュレーションされた約50の高頻度用語(idempotent、race condition、N+1、backpressure など)を含みます。このリストにない用語は、平易な英語として扱われます。

**用語の追加・削除:** `scripts/jargon-list.json` を編集する PR を出してください。編集後に `bun run gen:skill-docs` を実行してください。用語は生成時にすべての生成済み SKILL.md に埋め込まれるため、再生成するまで変更は反映されません。実行時の読み込みはなく、ユーザー側での上書きもできません。リポジトリのリストが唯一の正です。

追加候補として適しているのは、レビューの出力でも文脈なしには読めない、非技術系ユーザーが頻繁に目にする用語です(データベースや並行処理の基本用語、セキュリティ用語、フロントエンドのフレームワークの概念など)。1つか2つのニッチな skill にしか出てこない用語は追加しないでください。レビューの手間に見合いません。

## マルチホスト開発

gstack は、1セットの `.tmpl` テンプレートから、10 のホスト向けに SKILL.md ファイルを生成します。各ホストは `hosts/*.ts` にある型付きの設定です。ジェネレーターはこれらの設定を読み、ホストに合った出力を作ります(フロントマター、パス、ツール名が異なります)。

**対応ホスト:** Claude(主要)、Codex、Factory、Kiro、OpenCode、Slate、Cursor、OpenClaw、Hermes、GBrain。

### すべてのホストを生成する

```bash
# Generate for a specific host
bun run gen:skill-docs                    # Claude (default)
bun run gen:skill-docs --host codex       # Codex
bun run gen:skill-docs --host opencode    # OpenCode
bun run gen:skill-docs --host all         # All 10 hosts

# Or use build, which does all hosts + compiles binaries
bun run build
```

### ホストごとに違うもの

各ホストの設定(`hosts/*.ts`)が制御するのは次の項目です:

| 項目 | 例(Claude と Codex の比較) |
|------|---------------------------|
| 出力ディレクトリ | `{skill}/SKILL.md` と `.agents/skills/gstack-{skill}/SKILL.md` |
| フロントマター | 完全版(name、description、hooks、version)と最小版(name + description) |
| パス | `~/.claude/skills/gstack` と `$GSTACK_ROOT` |
| ツール名 | 「Bash ツールを使う」と、同じ(Factory は「このコマンドを実行する」に書き換える) |
| Hook 付き skill | `hooks:` フロントマターと、インラインの安全性に関する注意書き |
| 抑制されるセクション | GBrain のブロック と、GBrain のブロック + Review Army。Codex は Claude Code にルーティングされる外部レビューのセクションを残す |
| モデルのオーバーレイ | `claude` と `gpt`(ホストごとの `defaultModel`。`--model`、またはセットアップ時の Codex の `config.toml` のモデルで上書きされる) |

`HostConfig` インターフェースの全体は `scripts/host-config.ts` を参照してください。

### ホストの出力をテストする

```bash
# Run all static tests (includes parameterized smoke tests for all hosts)
bun run test

# Check freshness for all hosts
bun run gen:skill-docs --host all --dry-run

# Health dashboard covers all hosts
bun run skill:check
```

### 新しいホストを追加する

詳しくは [docs/ADDING_A_HOST.md](docs/ADDING_A_HOST.md) を参照してください。要点は次のとおりです:

1. `hosts/myhost.ts` を作成します(`hosts/opencode.ts` からコピーし、その `tier` と `capabilities` を含めます)
2. `hosts/index.ts` に追加します
3. `.gitignore` に `.myhost/` を追加します
4. `bun run gen:skill-docs --host myhost` を実行します
5. `bun run test` を実行します(パラメータ化されたテストが自動的にカバーします)

レンダリングにはジェネレーターのコード変更は不要です。ただし、インストールには必要です。インストール可能なホストには、setup のインストール用の分岐、`bin/gstack-install-registry.sh` の `gstack_host_tier` の行、README のホストマトリクスの行、適合性キット(`test/host-conformance.test.ts`)が必要です。日付付きの認証記録が存在するまでは `experimental` として提供されます。詳細はガイドの「Certify your host」とインストールの所有権ルールを参照してください。

### 新しい skill を追加する

新しい skill テンプレートを追加すると、すべてのホストが自動的にそれを取得します:
1. `{skill}/SKILL.md.tmpl` を作成します
2. `bun run gen:skill-docs --host all` を実行します
3. 動的なテンプレート探索が検出するので、静的な一覧を更新する必要はありません
4. 予算を設定します: `bun test/helpers/capture-context-budget.ts` を実行し、更新された `test/fixtures/context-budget.json` をコミットします。コンテキスト予算の ratchet は、上限が設定されていない skill を失敗させます
5. `{skill}/SKILL.md` をコミットします。外部ホストの出力はセットアップ時に生成され、gitignore されています

<a id="conductor-workspaces"></a>
## Conductor のワークスペース

[Conductor](https://conductor.build) を使って複数の Claude Code セッションを並行して動かしている場合、`conductor.json` がワークスペースのライフサイクルを自動的につなぎます:

| フック | スクリプト | 内容 |
|------|--------|-------------|
| `setup` | `bin/dev-setup` | メインのワークツリーから `.env` をコピーし、依存関係をインストールし、skill をシンボリックリンクし、`./setup` を非対話で実行します。また(gbrain がインストールされていれば)ブレイン対応のブロックを、追跡対象のソースを汚さずに `.claude/gstack-rendered/` にレンダリングします |
| `archive` | `bin/dev-teardown` | skill のシンボリックリンク、`.claude/gstack-rendered/` のレンダリング結果を削除し、`.claude/` ディレクトリをクリーンアップします |

Conductor で新しいワークスペースを作成すると、`bin/dev-setup` が自動的に実行されます。`git worktree list` でメインのワークツリーを特定し、`.env` をコピーして API キーを引き継ぎ、dev モードを設定します。手作業は不要です。

`bin/dev-setup` は `./setup` を完全に非対話で実行します(`--plan-tune-hooks=prompt` を渡し、stdin を閉じます)。そのため、転送された Conductor の TTY が、見えないセットアップのプロンプトで止まることはありません。また、plan-tune の Claude Code フックは決してインストールしません。これにより、使い捨てのワークスペースが、一時的なワークツリーのパスを指すようにグローバルの `~/.claude/settings.json` を書き換えることもできません。plan-tune のフックを意図的にインストールするには、dev-setup の外で `./setup --plan-tune-hooks` を実行するか(または `gstack-config set plan_tune_hooks yes`)を使ってください。明示的なフラグは、明確な判断として扱われます。setup の Conductor による AskUserQuestion フックの自動オプトインは、フラグがなく、`GSTACK_PLAN_TUNE_HOOKS` 環境変数もなく、`plan_tune_hooks` キーも設定に存在しない(`gstack-config has` で確認)純粋な自動フォールスルーの場合にのみ発動します。そのため、dev-setup が勝手にフックをインストールすることは決してありません。1つだけ明示された修復の例外があります。setup の heal-first パス(`gstack-settings-hook prune-stale --repoint`)は、死んだ gstack のフックエントリを削除し、既存のエントリを安定した `~/.claude/skills/gstack` インストールに向け直すことがあります。これは厳密に収束させる修復であり、新しい登録ではありません。登録自体は正規のパスにのみ行われるので、一時的なツリーのパスが settings.json に埋め込まれることは決してありません。

**初回のセットアップ:** メインリポジトリの `.env` に `ANTHROPIC_API_KEY` を設定してください(`.env.example` を参照)。Conductor のワークスペースはすべて、それを自動的に引き継ぎます。

**`GSTACK_*` 環境変数の接頭辞(Conductor が注入するキー)。** Conductor は、すべてのワークスペースのプロセス環境から `ANTHROPIC_API_KEY` と `OPENAI_API_KEY` を明示的に取り除きます。`.env` のコピーのパスでもそれらは復元されません。取り除きは環境の継承の後に行われるためです。有料 eval、`/sync-gbrain` の埋め込み、`claude-agent-sdk` の呼び出しを Conductor のワークスペースで動かしたい場合は、Conductor のワークスペースの環境設定で `GSTACK_ANTHROPIC_API_KEY` と `GSTACK_OPENAI_API_KEY` を設定してください。Conductor はそれらをそのまま通します。gstack 側では、TS のエントリポイントが副作用として `lib/conductor-env-shim.ts` を import します。この shim は、正規の名前が空のときに `GSTACK_FOO_API_KEY` を `FOO_API_KEY` に昇格させます。有料 API を呼び出す新しい TS のエントリポイントを追加する場合は、ファイルの先頭に `import "../lib/conductor-env-shim";` を追加してください。現時点では、shim は `bin/gstack-gbrain-sync.ts`、`bin/gstack-model-benchmark`、`scripts/preflight-agent-sdk.ts`、`test/helpers/e2e-helpers.ts` から import されています。

## 知っておくべきこと

- **SKILL.md ファイルは生成されます。** `.md` ではなく `.tmpl` テンプレートを編集してください。`bun run gen:skill-docs` で再生成します。同じ実行で `lib/design-catalog.ts` から `review/design-checklist.md` が、`lib/dom-dump-script.ts` から `lib/dom-dump.js` が生成されます。それらのソースを編集し、生成されたファイルは決して直接編集しないでください(`test/design-checklist-sync.test.ts` が乖離を検出すると失敗します)。
- **TODOS.md は統合されたバックログです。** skill・コンポーネントごとに、P0〜P4 の優先度で整理されています。`/ship` は完了した項目を自動検出します。計画・レビュー・振り返りの skill はすべて、文脈としてこれを読みます。
- **Browse、make-pdf、design、`lib/` のソースを変更したら再ビルドが必要です。** `browse/src/*.ts`、`make-pdf/src/*.ts`、`design/src/*.ts`、または `lib/` 配下のもの(バイナリに埋め込まれる正規の `claude-bin.ts`、`error-handling.ts`、`aside-render.ts`、および design バイナリのモックアッププロンプトが埋め込む `MOCKUP_NEVER_NAMES` を持つ `design-catalog.ts`。`browse/src` は最初の3つを再エクスポートします)を変更した場合は、`bun run build` を実行してください。`./setup` も同じ判断を自動で行います。3つのバイナリのいずれかが欠けている場合、またはそれらのソース、`package.json`、`bun.lock` が browse バイナリより新しい場合は再ビルドします(`test/setup-needs-build.test.ts` がこの判断を固定しています)。
- **dev モードはグローバルのインストールを覆い隠します。** プロジェクトローカルの skill が `~/.claude/skills/gstack` より優先されます。`bin/dev-teardown` でグローバルのものに戻せます。
- **Conductor のワークスペースは互いに独立しています。** 各ワークスペースは独自の git ワークツリーです。`bin/dev-setup` は `conductor.json` を通じて自動的に実行されます。
- **`.env` はワークツリー間で引き継がれます。** メインリポジトリで一度設定すれば、すべての Conductor のワークスペースがそれを受け取ります。
- **`.claude/skills/` は gitignore されています。** シンボリックリンクがコミットされることはありません。
- **`setup` に生の `ln -snf` を書かないでください。** `setup` のすべてのリンク箇所は、`IS_WINDOWS` の検出付近にある `_link_or_copy SRC DST` ヘルパーを経由しなければなりません。このヘルパーは Unix では `ln -snf` を維持し、開発者モードのない Windows では `cp -R` / `cp -f` に切り替えます。Windows で素の `ln -snf` を使うと、`git pull` で更新されない凍結されたファイルのコピーができてしまうためです。`test/setup-windows-fallback.test.ts` が静的な不変条件でこれを強制します。ヘルパーの本体の外にある生の `ln` 呼び出しが1つでもあれば CI が失敗します。
- **同期的なサブエージェントの起動では、フラグを明示してください。** Claude Code は、Agent ツールのサブエージェントをデフォルトでバックグラウンド実行します(v2.1.198 以降)。そのため、サブエージェントを起動してその出力を消費するテンプレートのステップには、必ず `run_in_background: false` を付ける必要があります。ガイダンスを手書きせず、`{{FOREGROUND_DISPATCH_NOTE}}` プレースホルダー(`scripts/resolvers/constants.ts`)を使ってください。さらに、生成されたキャリアファイルを、同じコミットで `test/run-in-background-guidance.test.ts` の `GENERATED_WITH_GUIDANCE` に追加してください。その構造スキャナーは、フラグのない生成済みの起動の命令を見つけると CI を失敗させます。
- **`setup` が所有を証明できない skill のエントリは、削除もリンクの上書きもしないでください。** `setup` のすべての破壊的な箇所(リンカー、エイリアスのインストーラー、両方の接頭辞切り替えのクリーンアップ)と `bin/gstack-relink` は、所有権のヘルパーを経由しなければなりません。`setup` では `_claude_entry_is_ours` / `_claude_entry_owned_strongly`、relink では `_entry_is_ours` / `_entry_owned_strongly` です。古くなった skill の削除(`_prune_stale_generated`)も、強い/弱いの区別を同じように、独自のゲートを通して適用します。実ホストのディレクトリは、その SKILL.md に生成バナーが含まれている場合にのみ候補になります(`_owned_for_windows_refresh`)。ホストのシンボリックリンクは、gstack の中を指している場合にのみ削除されます(`_gstack_target_is_ours`)。バナー付きの実ディレクトリは `_cleanup_weak_dir` で掃除されます。レンダリングツリー内のシンボリックリンクは決してたどられません。gstack を指すシンボリックリンク、または `.gstack-owned` マーカーは、ディレクトリ全体を証明します。バイト単位で同一の、またはバナー付きの SKILL.md は、そのファイルだけを証明します。異なる SKILL.md は、まず `~/.gstack/backups/skills/<ts>/` に移動されます。`test/setup-link-ownership.test.ts`、`test/setup-cleanup-orphans.test.ts`、`test/setup-prune-stale-generated.test.ts`、`test/relink.test.ts` がこれを固定しています。このルールは、共有ヘルパーの TODOS.md 項目が入るまで2つのスクリプトに重複して書かれています。変更するときは両方を変更してください。ホストのレンダリングの掃除(`bin/gstack-host-renders.sh` の `gstack_prune_host_renders`、#1694)も、チェックアウトが提供していないホストのレンダリングディレクトリに対して同じ区別を適用します。チェックアウトを指すリンクは削除され、生成されたと証明されたファイルは `~/.gstack/backups/host-renders/<ts>-<id>/` に移動され、それ以外は残されます。空になったディレクトリだけが削除されます(`test/host-renders-prune.test.ts`)。
- **`./setup` は Chromium で決して失敗しません。** Playwright のブートストラップ(`setup` の `# 2` セクション)はベストエフォートで、時間制限があります。すべての失敗は理由コード(`skipped`、`chromium-install`、`chromium-install-timeout`、`chromium-install-locked`、`windows-no-node`、`windows-node-modules`、`post-install-launch`)になり、最後の要約でブラウザに依存する skill と一緒に表示されます。skill の登録は必ず実行されます。`GSTACK_PLAYWRIGHT_INSTALL_TIMEOUT=<秒>`(デフォルトは 600)でダウンロードの時間を制限します。`GSTACK_SKIP_PLAYWRIGHT=1` はそれをスキップします。ブラウザのない環境や、セットアップだけを回すテストのループで使う正しいつまみです。`GSTACK_SKIP_ASIDE=1` は、ブラウザの要約(skill のプローブやレンダラーと同様)で Aside を存在しないものとして扱います。そのため、要約がブートストラップが提供できなかったフォールバックを約束することはありません(`test/setup-browser-hint.test.ts`)。ブートストラップの後に追加するものは、ブラウザに依存しない必要があります。`test/setup-playwright-best-effort.test.ts` がこのブロックを固定しています。

## 実際のプロジェクトで変更をテストする

**これは gstack を開発するための推奨の方法です。** gstack のチェックアウトを、実際に使っているプロジェクトにシンボリックリンクしてください。そうすると、実際の作業を行いながら変更がライブで反映されます。

### ステップ 1: チェックアウトをシンボリックリンクする

```bash
# In your core project (not the gstack repo)
ln -sfn /path/to/your/gstack-checkout .claude/skills/gstack
```

### ステップ 2: setup を実行して skill ごとのシンボリックリンクを作る

`gstack` のシンボリックリンクだけでは不十分です。Claude Code は、`gstack/` ディレクトリそのものではなく、個々のトップレベルのディレクトリ(`qa/SKILL.md`、`ship/SKILL.md` など)を通して skill を見つけます。`./setup` を実行して作成してください:

```bash
cd .claude/skills/gstack && bun install && bun run build && ./setup
```

setup は、短い名前(`/qa`)にするか、名前空間付き(`/gstack-qa`)にするかを尋ねます。選択は `~/.gstack/config.yaml` に保存され、次回以降も覚えられます。プロンプトを飛ばすには、`--no-prefix`(短い名前)か `--prefix`(名前空間付き)を渡してください。

### ステップ 3: 開発する

テンプレートを編集して `bun run gen:skill-docs` を実行すれば、次の `/review` や `/qa` の呼び出しですぐに反映されます。再起動は不要です。

### 安定したグローバルのインストールに戻る

プロジェクトローカルのシンボリックリンクを削除します。Claude Code は `~/.claude/skills/gstack/` にフォールバックします:

```bash
rm .claude/skills/gstack
```

skill ごとのディレクトリ(`qa/`、`ship/` など)には、`gstack/...` を指す SKILL.md のシンボリックリンクが入っているので、自動的にグローバルのインストールに解決されます。

### 接頭辞モードを切り替える

gstack をある接頭辞の設定でインストールし、それを変えたい場合:

```bash
cd .claude/skills/gstack && ./setup --no-prefix   # switch to /qa, /ship
cd .claude/skills/gstack && ./setup --prefix       # switch to /gstack-qa, /gstack-ship
```

setup は古いシンボリックリンクを自動的に片付けます。手作業のクリーンアップは不要です。削除されるのは gstack が作成したエントリだけです。同じ名前の自作の skill(たとえば手書きの `qa/`)は残され、setup の最後の要約で名前が挙がります。

### 代替案: グローバルのインストールを特定のブランチに向ける

プロジェクトごとのシンボリックリンクを使いたくない場合は、グローバルのインストールを切り替えられます:

```bash
cd ~/.claude/skills/gstack
git fetch origin
git checkout origin/<branch>
bun install && bun run build && ./setup
```

これはすべてのプロジェクトに影響します。元に戻すには `git checkout main && git pull && bun run build && ./setup` を実行します。

## コミュニティ PR のトリアージ(ウェーブ方式)

コミュニティからの PR がたまってきたら、テーマごとのウェーブにまとめます:

1. **分類する** — テーマごとにグループ化します(セキュリティ、機能、インフラ、ドキュメント)
2. **重複を除く** — 2つの PR が同じことを直している場合は、変更行数が少ない方を選びます。もう一方は、勝者を指すコメントを付けて閉じます。
3. **収集用のブランチ** — `pr-wave-N` を作成し、問題なくマージできる PR を取り込み、競合のある PR は解決して、`bun run test && bun run build` で検証します
4. **文脈を添えて閉じる** — 閉じるすべての PR に、理由と、(あれば)それを置き換える PR を説明するコメントを付けます。貢献者は実際に作業をしてくれています。明確なコミュニケーションでそれに報いてください。
5. **1つの PR にまとめて出す** — すべての帰属をマージコミットに残したまま、1つの PR として main に出します。何がマージされ、何が閉じられたかを示す要約の表を含めてください。

最初のウェーブの例として [PR #205](../../pull/205)(v0.8.3)を参照してください。

## アップグレードのマイグレーション

リリースで、`./setup` だけでは直せない形でディスク上の状態(ディレクトリ構造、設定の形式、古くなったファイル)が変わる場合は、既存のユーザーがきれいにアップグレードできるように、マイグレーションスクリプトを追加してください。

### マイグレーションを追加するとき

- skill ディレクトリの作り方を変えた(シンボリックリンクか実ディレクトリか)
- `~/.gstack/config.yaml` の設定キーの名前を変えた、または移動した
- 前のバージョンの孤立したファイルを削除する必要がある
- `~/.gstack/` の状態ファイルの形式を変えた

次の場合はマイグレーションを追加しないでください: 新機能(ユーザーは自動的に得られる)、新しい skill(setup が検出する)、コードだけの変更(ディスク上の状態がない)。

### 追加の方法

1. `gstack-upgrade/migrations/v{VERSION}.sh` を作成します。`{VERSION}` は、その修正が必要なリリースの VERSION ファイルと一致させてください。
2. 実行可能にします: `chmod +x gstack-upgrade/migrations/v{VERSION}.sh`
3. スクリプトは**冪等**(何度実行しても安全)で、**非致命的**(失敗はログに残るが、アップグレードを止めない)でなければなりません。
4. 先頭にコメントブロックを置き、何が変わったのか、なぜマイグレーションが必要なのか、どのユーザーが影響を受けるのかを説明してください。

例:

```bash
#!/usr/bin/env bash
# Migration: v0.15.2.0 — Fix skill directory structure
# Affected: users who installed with --no-prefix before v0.15.2.0
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
"$SCRIPT_DIR/bin/gstack-relink" 2>/dev/null || true
```

### 実行の仕組み

`/gstack-upgrade` の実行中、`./setup` の完了後(Step 4.75)に、アップグレードの skill が `gstack-upgrade/migrations/` を走査し、ユーザーの古いバージョンより新しいバージョンの `v*.sh` スクリプトをすべて実行します。スクリプトはバージョンの順に実行されます。失敗はログに残りますが、アップグレードを止めることはありません。

### マイグレーションのテスト

マイグレーションは `bun run test`(tier 1、無料)の一部としてテストされます。テストスイートは、`gstack-upgrade/migrations/` 内のすべてのマイグレーションスクリプトが実行可能で、構文エラーなく解析できることを確認します。

## 変更を出荷する

skill の編集が終わったら:

```bash
/ship
```

これでテストが実行され、差分がレビューされ、Greptile のコメントが(2段階のエスカレーションで)仕分けされ、TODOS.md が管理され、バージョンが上がり、PR が開かれます。ワークフロー全体は `ship/SKILL.md` を参照してください。
