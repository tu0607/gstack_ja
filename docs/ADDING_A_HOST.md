# gstack に新しいホストを追加する

gstack は宣言的なホスト設定の仕組みを使っています。対応している各 AI コーディングエージェント
(Claude, Codex, Factory, Kiro, OpenCode, Slate, Cursor, OpenClaw, Hermes,
GBrain, Copilot, Antigravity) は、`defineHost()` ファクトリで作られる型付きの TypeScript 設定オブジェクトとして定義されています。
新しいホストをレンダリングするには、ファイルを 1 つ作って再エクスポートするだけです。ジェネレーター、テスト、検証はそれを自動的に拾います。
ただし、インストールには手間がかかります。セットアップにはインストール可能なホストごとに 1 つのインストール分岐が必要 (下の
「setup が何をディスクに書き込むか」を参照) なので、インストール可能なホストには、セットアップの分岐、
インストールレジストリのティア表へのエントリ、そして `full` のラベルを付ける前の認定実行も必要です。

## インストールの所有権ルール

以下のルールは、すべてのホスト、すべてのスコープ、すべてのアップグレード経路 (`./setup`、`./setup --refresh-registered`、`/gstack-upgrade`、
チームモードの自動更新) に適用されます。各拒否は、何が手つかずのまま残されたか、どのルールが適用されたか、
そして先に進むための正確なコマンドを示します。

1. **プロジェクトローカルのセットアップが、グローバルインストールを黙って置き換えることはありません。** プロジェクトにベンダリングされたコピーから、
   またはグローバルインストールがリンクしているチェックアウト以外のチェックアウトから setup を実行した場合、そのグローバルインストールには手を付けず、
   意図的に置き換える方法として `./setup --global` を表示します。(Codex:
   `setup:186-207`、#2879。Claude: グローバルの `~/.claude/skills/gstack` リンク。)
2. **明示的な `--host X` が、別のホストを変更することはありません。** `--host codex` が書き込むのは、Codex のスキルディレクトリと
   チェックアウト自身の `.agents/` のレンダリングだけです。`settings.json` 内の Claude Code フックを修復、登録、削除することはなく、
   Claude 向けの gbrain のレンダリングにも触れません (#2347)。
   例外が 1 つあります。一度だけ行う `/claude` → `/claude-code` の名前変更修復 (`bin/gstack-migrate-claude-code`) は、
   同じチェックアウトを共有するすべてのインストールで、gstack が所有するエントリの名前を変更します。
3. **アップグレードは、登録済みのインストールだけを更新します。** セットアップが有効化したインストールはすべて、インストールレジストリに記録されます。
   アップグレードは `./setup --refresh-registered` を実行します。これは、そのチェックアウトに登録されたホストごとに一度 setup を実行し
   (実行前にソースを表示します)、それ以外は何もしません。別のチェックアウトが所有するインストールや、別のプロジェクトのプロジェクトインストールは、
   そこを更新するためのコマンドとともに一覧表示されます。それらが別のものに向け直されることはありません (#1925)。
4. **ユーザーが所有するファイルは残ります。** セットアップ、`gstack-relink`、`gstack-uninstall` がエントリを削除したりその上にリンクしたりするのは、
   gstack がそれを作成したという証明がある場合だけです (#2119 の所有権ゲート)。それ以外のものは報告されるだけで、そのまま残されます。

### インストールレジストリ

`$GSTACK_STATE_ROOT/installs.tsv` (モード 0600) が、インストールの唯一の記録です。書き込みを行うのは `bin/gstack-install-registry.sh` だけで、
アトミックなリネームを伴うロックディレクトリの下で行われます。列は次のとおりです: ホスト、スコープ (`global`/`project`)、プロジェクト、
宛先 (ホストが検出するスキルディレクトリ)、インストールルート、ソースの realpath、バージョン、prefix 設定、レンダリング、更新日時。
行が公開されるのは、ホストの分岐が有効化を終えた後だけです。インストールルートが消えている行は、
どの更新処理や `gstack-uninstall` でも削除されます (`gstack_install_registry_reconcile`)。そのため、アップグレードによって
アンインストール済みのホストが復活することはありません。

`./setup --status` は、インストールごとに 1 行 (ホスト、ティア、スコープ、結果、
バージョン、宛先、ソース) を表示します。何もビルドせず、何も書き込みません。ディスク上で見つかったレジストリ導入前のインストールも表示し、
それには `unregistered` のラベルと、登録するためのコマンドを付けます。プロジェクトベンダリングされたコピー (#2879) によって取り込まれた Codex インストールは、
向け直されるのではなく、両方の選択肢とともに報告されます。セットアップの要約、`/gstack-upgrade` の要約、`--status` は、
同じレンダラー (`gstack_install_registry_render`) を共有します。

### マイグレーション

`gstack-upgrade/migrations/v*.sh` は、state root のマイグレーションです。そのマーカーは
`$GSTACK_STATE_ROOT/.last-setup-version` です (`~/.gstack` から一度だけ読み込みます。移動前のインストール向けです)。
マーカーが進むのは、成功したマイグレーションを過ぎたときだけです。失敗したマイグレーションは連鎖を止め、再試行コマンドを添えた `failed` の行を表示し、
次の `./setup` でもう一度実行されます。インストールごとのマイグレーションとホストごとのマイグレーションは、
レジストリ行のバージョンで追跡されます。

### setup が何をディスクに書き込むか

フェーズごとに、setup の副作用をすべて一覧にしました (行番号はおおよその値です)。

| フェーズ | 書き込み先 | スコープ |
|---|---|---|
| Build | ソースチェックアウト内の `browse/dist`、`design/dist`、`make-pdf/dist`、`bin/gstack-cso-*` | ソース |
| Hosts record | ソースチェックアウト内の `.gstack-installed-hosts`: setup がそこからインストールしたホストすべて。追加のみ (#1694) | ソース |
| Generation | 記録されたホストだけのレンダリング (`.agents/`、`.kiro/`、`.factory/`、`.opencode/`、`.cursor/`、`.copilot/`、`.agy/`) をソースチェックアウト内に作成。`gstack-patch-names` が Claude の `name:` フィールドをその場で書き換える | ソース |
| Render prune | 記録に含まれないホストのレンダリング: チェックアウトへのリンクは削除、生成ファイルは `$GSTACK_STATE_ROOT/backups/host-renders/<ts>-<id>/` に移動、その他のファイルは保持 | ソース / state root |
| Chromium | Playwright のキャッシュ (`~/.cache/ms-playwright`)、state root 配下のロック | マシン |
| Config | `$GSTACK_STATE_ROOT/config.yaml` の `skill_prefix`、`timeline_stop_hook`、チームモードのキー | state root |
| Claude arm | `~/.claude/skills/gstack` のリンク、`SKILL.md` へのリンクを持つスキルごとのディレクトリ、エイリアスのコピー | 選択されたホスト |
| Codex arm | `${CODEX_HOME:-~/.codex}/skills/gstack` のランタイムルート、`.agents/skills` への `gstack-*` リンク、`.agents/skills/gstack` のサイドカー | 選択されたホスト |
| Kiro、Factory、OpenCode、Cursor、Copilot、Antigravity の分岐 | そのホストの `skills/gstack` ランタイムルート (稼働中のものの横にビルドされ、差し替えられる) と `gstack-*` のリンク | 選択されたホスト |
| OpenCode commands | `~/.config/opencode/commands/gstack-*.md` (管理マーカー付き, #2629)。ユーザーのコマンドファイルには決して触れない | 選択されたホスト |
| Registry | `installs.tsv` に、有効化されたインストールごとに 1 行 | state root |
| Migrations | 各 `v*.sh` が修復する内容。マーカーは state root にある | state root |
| Claude hooks | `~/.claude/settings.json` (heal、SessionStart、plan-tune、Stop)。Claude が選択されている場合のみ | Claude |
| gbrain | `gbrain-detection.json`。Claude のレンダリングは `$GSTACK_STATE_ROOT/render/claude`。Claude が選択されている場合のみ | state root / Claude |

現時点での有効化: macOS と Linux では、すべてのインストールはソースチェックアウトへのシンボリックリンクの集まりです。
そのため `git pull` は、setup が走る前に有効なペイロードを変えてしまいます。「以前のペイロードを残す」とは「以前のチェックアウトを残す」という意味になり、
アップグレードスキルはベンダリングされたパスでは `.bak` からの復元によってそれを行い、git のパスでは `PRE_UPGRADE_COMMIT` に記録します。
リンクではなくコピーを行う Windows では、すべてのコピーは `<dst>.gstack-new.<pid>` としてステージされ、完了したときだけ差し替えられます。
中断された差し替えは次回の実行で修復されます (宛先が欠けている場合は `<dst>.gstack-old.<pid>` から復元されます)。
シンボリックリンクを使うプラットフォーム向けのバージョン付きペイロードディレクトリは、まだビルドされていません。

### インストールコンテキストのレンダリング契約

コミット済みのレンダリングは、各ホストのデフォルトのインストールルートを指しています。それ以外のルート (プロジェクトインストール、`CLAUDE_CONFIG_DIR`、名前を変えたチェックアウト) 向けのレンダリングは、
`gen-skill-docs --host <h> --install-root <abs path> --out-dir <tmp>
--link-root <dir>` で作られます。デフォルトルートのパスはすべて指定されたルートに置き換えられ、
リゾルバーからは `TemplateContext.installRoot` として見えます (null の場合はコミット済みのバイト列がそのまま使われます)。
インストールごとのレンダリングは `$GSTACK_STATE_ROOT/render/installs/<host>-<id>/` に置かれます (`<id>` はルートの realpath から決まります)。
そしてレジストリのレンダリング列に記録されます。セットアップは、`~/.claude/skills/gstack` 以外の場所にある Claude のインストール
(名前を変えたチェックアウト、プロジェクトにベンダリングされたコピー、`CLAUDE_CONFIG_DIR`) と、
`~/.codex/skills/gstack` 以外の場所にあるグローバルな Codex のインストール (`CODEX_HOME`) のために、それぞれ 1 つ作ります。
リポジトリローカルの Codex インストールは、実行時にルートを解決します。プレーンなパスではないルート (空白やシェルのメタ文字を含むもの) は、
`<host>-<id>.root` というエイリアスのシンボリックリンクを通して指定されます。ワークツリーを分離した Claude Code は、
どの引用符付けでも、スペースを含むコマンドパスを拒否するためです。

### インストール内のホストのレンダリング (#1694)

チェックアウトは、そこからインストールされたホストに対してのみスキルをレンダリングします。
`bin/gstack-host-renders.sh` が記録を管理します。記録とは、チェックアウト内の `.gstack-installed-hosts` のことです。setup は、
インストールしたホストを必ず追加し、削除することはありません。そのため `./setup --host codex` を実行しても、`--host factory` のレンダリングは残ります。
アップグレード後の最初の実行では、記録は、そのチェックアウトがすでに提供しているホストから初期化されます (
レジストリの行、そのチェックアウトに解決されるインストールルート、そのレンダリングにリンクしているホストのスキル、ランタイムルートを持たない旧式のコピー)。
`scripts/build.sh` は claude と記録されたホストをレンダリングし、どのホストをなぜレンダリングしたかを表示します。記録のない
チェックアウト (開発用のチェックアウト) や `GSTACK_RENDER_HOSTS=all` の場合は、すべてのホストをレンダリングします。

その後、setup を実行するたびに、記録に含まれないホストのレンダリングを、`bin/gstack-relink` の証明ルールに従って削除します。
チェックアウトへのシンボリックリンク (強い証明) は削除されます。生成されたものだと証明されたファイル (弱い証明: gen-skill-docs のバナー、
ジェネレーターの正確な `openai.yaml` の形、チェックアウトとのバイト単位での一致) は、
`$GSTACK_STATE_ROOT/backups/host-renders/<ts>-<id>/` に移動されます。その他のファイルはそのままの場所に残り、
空になったディレクトリだけが削除されます。バックアップの `prune.log` には、すべてのパスが記録されます。gstack-upgrade のマイグレーションは、
setup を実行せずにアップグレードされたインストールに対して、同じ削除処理を行います。指示のみで提供されるホスト (instruction-only: Hermes、OpenClaw、GBrain) は、
setup によって決してインストールされません。そのため、インストール内で手作業でそれらをレンダリングするユーザーは、先に記録へその名前を追加する必要があります。

## ホストのティアと機能

すべてのホストは `tier` と `capabilities` を宣言します (`scripts/host-config.ts`)。
語彙は 1 つに統一されています。`./setup --help`、setup と `--status` の行、ホストのエラー、README のホスト一覧のすべてで使われ、
`test/host-config.test.ts` が `hosts/index.ts` と照合します。

| ティア | 意味 |
|---|---|
| `full` | インストールされ、レンダリングされ、適合キットに合格し、下に日付入りの認定記録がある。 |
| `experimental` | インストールされ、レンダリングされ、適合キットに合格する。認定記録はまだない。 |
| `instruction-only` | インストールの分岐はない。`./setup --host X` は、コピーすべきものを表示するだけで、何も変更しない。 |

レンダリングだけでは `full` の認定にはなりません。

| 機能 | 値 | 用途 |
|---|---|---|
| `toolExecution` | boolean | プリアンブルと `bin/` のヘルパーが実行される |
| `questions` | `native` / `prose` | 構造化された質問ツールか、平文の質問か |
| `planMode` | boolean | プランモードへの移行。`false` の場合、プリアンブルのプランモードの節を省略する |
| `delegation` | boolean | サブエージェント |
| `browser` | boolean (`toolExecution` が必要) | gstack のブラウザ |
| `safetyHooks` | `enforced` / `advisory` | `/careful`、`/freeze`、`/guard` がブロックする (Claude) か、警告するだけか |

`safetyHooks` が `'advisory'` のホストでは、`/careful`、`/freeze`、`/guard` の先頭に 1 行表示されます。
「not enforced on <host>: advisory, not blocked」(<host> では強制されない: 助言のみで、ブロックされない) という内容です。

<a id="certify-your-host"></a>
## ホストを認定する

1. 適合キットに合格する: `bun test test/host-conformance.test.ts` は、インストール可能なすべてのホストを一時的な HOME にインストールし、
   検出ディレクトリ、他のホストの変種がないこと、重複がないこと、`./setup --status`、そして前のリリースのインストールレイアウトからのアップグレードを確認します。
2. 実際のワークフローを、そのホストで 1 つ実行する (例: 小さな diff に対する `/review`)。さらに、既存のインストールからのアップグレードも行う。
3. 下の表に行を追加する。日付、ホストのバージョン、gstack のバージョン、トランスクリプトの保存場所を書き、その後 `tier: 'full'` を設定する。

| ホスト | 日付 | ホストのバージョン | gstack のバージョン | 証拠 |
|---|---|---|---|---|
| claude | 2026-10-02 | Claude Code 2.1.284 (CI イメージの固定版) | v1.91.13.0 (1c54555) | gate ティアの eval、実際の Claude Code セッション: https://github.com/garrytan/gstack/actions/runs/37033755821 |

Codex は、CI イメージに固定された Codex CLI で周期的なケース (`codex-discover-skill`、
`codex-review`) が合格し、行が追加されるまで `experimental` のままです。

## GitHub Copilot CLI への対応 (#393)

`experimental` として出荷 (`hosts/copilot.ts`、`./setup --host copilot`):
スキルは `~/.copilot/skills/gstack-*` に置かれ、ランタイムルートは `~/.copilot/skills/gstack` で、
`.source-path` マーカーを持ちます。これにより `/gstack-upgrade` がチェックアウトを見つけられます。名前は `gstack-` で始まり
(そうしないと Copilot 組み込みの `/review` が優先されてしまいます)、機微なスキルには `disable-model-invocation: true` を付け、
プリアンブルの STATUS ルールの前に、ツール名の用語集 (`ask_user`、`exit_plan_mode`、`task`、`view`、`skill`) を 1 段落挿入します。
共有ディレクトリでは不十分でした。Copilot CLI は 1.0.36 から `~/.claude/skills` を読まなくなり、gstack は `~/.agents/skills` に書き込まず、
Codex のレンダリングには Codex のパスと Codex のモデル設定が含まれているためです。

コミュニティによる試みの扱い:

| PR | 判断 | 理由 |
|---|---|---|
| #2323 (@andrey-esipov) | 一部を再利用 (クレジット付き) | 採用: `~/.copilot/skills` と `.github/skills` のルート、`copilot` バイナリの検出、`.source-path`、`gstack-` のプレフィックス、1024 文字の説明文の制限、アンインストールの対象範囲。不採用: 新しいスキーマのフィールドとジェネレーターの変更 (`defineHost()` より前のもの)、ランタイムルートへの保護のない `rm -rf` (#2142)、再帰的にスキャンされるディレクトリ内の setup/scripts/Claude ソースへのリンク、setup 内のテスト専用のインストール用の裏口、AskUserQuestion → `ask_user` への一律の書き換え。 |
| #396 (@ridermw) | 却下 | Codex の出力を共有の `.agents/skills` に sed で書き換える。E2E ランナーは、実際の `~/.copilot` の認証情報を一時的な HOME にコピーする。そのセッションスキャナーは、後の `/retro global` の変更候補になりうる。 |
| #487 (@ridermw) | 却下 | Copilot CLI がもう読まない `~/.claude/skills` に依存している。 |
| #1852 (@lolisaigao1234) | 却下 | `copilot` ではなく `gh` を検出する。Copilot がスキャンしないディレクトリにインストールする。`lib` を含まずに `bin` をリンクする。 |

実際の Copilot CLI がない状態で未検証の点 (`full` ではない理由): autopilot が `ask_user` に自分で答えてしまうかもしれない、
プランモードは変更を伴うシェルコマンドをブロックする、シンボリックリンクされたスキルディレクトリには Copilot CLI 1.0.62 以降が必要、
`~/.copilot` 以外の `COPILOT_HOME` は今のところ拒否される。

## Antigravity CLI

Google の Antigravity CLI 向けに `experimental` として出荷 (`hosts/agy.ts`、`./setup --host agy`、エイリアス
`--host antigravity`)。このホストは `agy` バイナリにちなんで名付けられています。より長い名前にすると、
プロセスごとのランタイムのプレリュードが 408 バイトになり、400 バイトの予算を超えてしまいました (グローバルルートが長いため)。
`agy` は正確に 400 でレンダリングされるので、そのプレリュードに次のバイトを加えるなら、予算の変更を伴わなければなりません。
2026-10-08 に Google のドキュメントで検証:

| 事実 | 値 | 出典 |
|---|---|---|
| グローバルのスキル | `~/.gemini/antigravity-cli/skills/<skill>/SKILL.md` | [Agent skills](https://antigravity.google/docs/skills/) (CLI の節)、[Plugins & skills](https://antigravity.google/docs/cli/plugins/)、[Migrating from Gemini CLI](https://antigravity.google/docs/cli/gcli-migration/) |
| ワークスペースのスキル | `.agents/skills/<skill>/SKILL.md` | 同じページ |
| フロントマター | `name` (任意。デフォルトはディレクトリ名)、`description` (必須) | [Agent skills](https://antigravity.google/docs/skills/) |
| 説明文の上限 | 1024 文字 (Agent Skills 形式) | [What are Agent Skills?](https://cloud.google.com/discover/ai-agent-skills) |
| ツール名 | `run_command`、`view_file`、`write_to_file`、`replace_file_content`、`multi_replace_file_content`、`grep_search`、`find_by_name`、`invoke_subagent`、`ask_question` | [Hooks: supported tools](https://antigravity.google/docs/hooks/) |
| プランモード | `agy --mode=plan` / `/plan`。終了用のツールはない | [Execution modes](https://antigravity.google/docs/cli/modes/) |
| バイナリ | `agy`。`~/.local/bin/agy` にインストールされ、設定は `~/.gemini/antigravity-cli/` にある | [Installation](https://antigravity.google/docs/cli/install/)、[Settings](https://antigravity.google/docs/cli/settings/) |

このホストの動作: スキルは `~/.gemini/antigravity-cli/skills/gstack-*` に置かれ、
ランタイムルートは `~/.gemini/antigravity-cli/skills/gstack` で、`/gstack-upgrade` のための `.source-path` を持ちます。`name:` は `gstack-<skill>` のディレクトリと同じにします (
CLI は各名前をスラッシュコマンドに変換し、`/plan`、`/diff`、`/skills` などの組み込みコマンドがあるため)。フロントマターは `name` と `description` に限定し、
Gemini のモデルのオーバーレイと、プリアンブルの STATUS ルールの前に置く 1 段落のツール用語集を付けます。
用語集はまた、`view_file` が長い SKILL.md の一部しか返さない場合に、読み込みを続けるようエージェントに指示します。
ユーザーからは、最初の読み込みが 800 行で止まるという報告があります ([forum](https://discuss.ai.google.dev/t/make-the-800-line-forced-first-read-in-view-file-configurable-or-opt-out/172257))。
ただし Google のドキュメントにはその数字は書かれていないため、レンダリングされたテキストには数字を書いていません。

**`~/.gemini` の共有。** Antigravity CLI と Gemini CLI は、どちらも `~/.gemini` の下にあります。Gemini CLI は `~/.gemini/skills` (と `~/.agents/skills`) を読み、
Antigravity CLI は `~/.gemini/antigravity-cli/skills` を読みます。setup が書き込むのは後者の中の gstack のエントリだけで、
アンインストールも後者の中の gstack が管理するエントリだけを削除し、`--host auto` は `agy` が `PATH` にあるか既存の
`~/.gemini/antigravity-cli` がある場合にだけ Antigravity を選び、素の `~/.gemini` では選びません。
`test/setup-install-registry.test.ts` が両方向を検証します。Gemini CLI は、ホストとしてはサポートされていません。重なりは 2 つ残っています。
ワークスペースの `.agents/skills` は、プロジェクトローカルの Codex インストールが Codex 向けの `gstack-*` スキルを置く場所でもあるため、
Antigravity はそのリポジトリでそれらを一覧表示します。また、Antigravity 2.0 のアプリと IDE は `~/.gemini/config/skills` を読みますが、
このホストはそこにはインストールしません (Google のコードラボでは、そのディレクトリも CLI に届くと書かれていますが、CLI のドキュメントにはそうは書かれていません。
そのため setup は CLI のドキュメントに従っています)。

コミュニティによる試みの扱い:

| PR | 判断 | 理由 |
|---|---|---|
| #2134 (@0xshae) | 一部を再利用 (クレジット付き) | 採用: ホスト名およびバイナリとしての `agy`、ワークスペースのルートとしての `.agents/skills`、Codex の `.agents` とは別の `.agy` レンダリングディレクトリ。不採用: 手書きの設定 (`defineHost()` より前のもの)、CLI のルートとしての `~/.gemini/config/skills`、所有権ゲートのない setup の分岐。 |
| #2893 (@ManchalaSashank) | 一部を再利用 (クレジット付き) | 採用: setup とレンダリングにおけるホスト名およびエイリアスとしての `agy`/`antigravity`、Gemini のオーバーレイ、アンインストールの対象範囲。不採用: `~/.gemini/config/skills`、素の `~/.gemini` での自動検出 (Gemini CLI のディレクトリ)、レンダリングディレクトリとしての `.gemini`、リポジトリローカルの `.gemini/skills` のサイドカー。 |
| #2726 (@voipexpert) | 一部を再利用 (クレジット付き) | 採用: Antigravity 自身のドキュメントにあるツール名、および `manage_task` (バックグラウンドプロセス) が to-do ツールではないこと。不採用: 一律のツール名の書き換え (プリアンブルの用語集が代わりを務める)、シェル経由で実行される外部レビューの抑制。 |
| #2244 (@KiDDarn) | 一部を再利用 (クレジット付き) | 採用: スキルが 1 つもリンクされなかった場合にインストールを失敗させる。不採用: `~/.gemini/config/plugins` のプラグインレイアウト (CLI のプラグインは `~/.gemini/antigravity-cli/plugins` の下にあり、`agy plugin install` でインストールされる)、ベンチマークのプロバイダー作業、追加のフロントマターのフィールド。 |
| #413 (@jnMetaCode) | 却下 | `~/.gemini/skills` にインストールし、`gemini` を検出する。これは Gemini CLI のもの。そこへのコメント (@doogiehowzer) は、現在の用語集が扱う部分的な `view_file` の読み込みを報告していた。 |
| #2079 (@FACUTUCCI10) | 却下 | Gemini CLI のパス (`~/.gemini/skills`)。 |
| #2187 (@NotArsal) | 却下 | setup のない #2134 の重複。 |
| #1490 (@7H0M45-4N70NY) | 却下 | `~/.antigravity/skills`。Antigravity のどの画面も読まない。 |
| #565 (@ChetanTekur) | 却下 | Gemini CLI の `GEMINI.md` 対応。Gemini CLI は対象外。 |

実際の Antigravity CLI がない状態で未検証の点 (`full` ではない理由): CLI が
シンボリックリンクされたスキルディレクトリをたどるかどうか、ランタイムルートの追加の Markdown ファイル (`ETHOS.md`、`review/*.md`) を
スキルとして取り込まないかどうか、長いスキルに対する `view_file` の部分読み込みの挙動、`ask_question` のオプションの扱い、
既存のインストールからのアップグレード。

## 指示のみのホスト (instruction-only)

OpenClaw、Hermes、Slate、GBrain にはインストールの分岐がありません。Hermes は、誰かがネイティブのインストールを認定するまで指示のみのまま (instruction-only) です (#2826 は Hermes 0.21.0 で測定しました)。
`./setup --host hermes` は、ダイジェストのパスとジェネレーターのコマンドを表示します。また、Hermes のレンダリングは `name: gstack-<skill>` を書き込むので、
フロントマターの名前でスキルを索引する Hermes が、それらを隠してしまうことはありません (#2825)。

## 仕組み

```
hosts/
├── define-host.ts   # defineHost() factory: shared defaults + derived fields
├── claude.ts        # Primary host
├── codex.ts         # OpenAI Codex CLI
├── factory.ts       # Factory Droid
├── kiro.ts          # Amazon Kiro
├── opencode.ts      # OpenCode
├── slate.ts         # Slate (Random Labs)
├── cursor.ts        # Cursor
├── openclaw.ts      # OpenClaw
├── hermes.ts        # Hermes (Nous Research)
├── gbrain.ts        # GBrain
├── copilot.ts       # GitHub Copilot CLI
├── agy.ts           # Google Antigravity CLI
└── index.ts         # Registry: imports all, derives Host type
```

各設定ファイルは `defineHost()` を呼び出し、結果の `HostConfig` オブジェクトを export します。これがジェネレーターに次のことを伝えます:
- 生成されたスキルを置く場所 (パス)
- フロントマターの変換方法 (許可リスト/拒否リストのフィールド)
- 書き換える Claude 固有の参照 (パス、ツール名)
- 自動インストールのために検出するバイナリ
- 抑制するリゾルバーのセクション
- インストール時にシンボリックリンクするアセット

ジェネレーター、セットアップスクリプト、プラットフォーム検出、アンインストール、ヘルスチェック、ワークツリーのコピー、テストはすべてこれらの設定を読みます。
ホストごとの個別コードは一切ありません。

## 手順: 新しいホストを追加する

### 1. 設定ファイルを作る

設定は `hosts/define-host.ts` の `defineHost()` ファクトリで作ります。
外部ホストの共通デフォルトと異なるフィールドだけを書けば十分です。残りはホスト名から導出されます。デフォルトのみのホストは
フィールド 2 つで済みます (`hosts/slate.ts` または `hosts/cursor.ts` を参照):

```typescript
import { defineHost } from './define-host';

const myhost = defineHost({
  name: 'myhost',
  displayName: 'MyHost',
});

export default myhost;
```

これは、次のデフォルト値を持つ完全な `HostConfig` に展開されます:

- `cliCommand: 'myhost'` (名前そのもの。`command -v` による検出用のバイナリ)
- `cliAliases: []`
- `defaultModel: 'claude'` (明示的な `--model` が渡されなかった場合に使われるモデルのオーバーレイ。codex は `'gpt'` に上書きする)
- `globalRoot` / `localSkillRoot`: `.myhost/skills/gstack`、`hostSubdir`: `.myhost`
- `usesEnvVars: true` (Claude のみ false。Claude は `~` の文字どおりのパスを使う)
- `frontmatter`: `name` と `description` を残す許可リスト。説明文の長さ制限なし
- `generation`: メタデータファイルなし、`skipSkills: []` (外部レビューのスキルは両方とも有効。Claude と Codex は自分のラッパーを明示的に省く)
- `pathRewrites`: 解決済みのパスから導出される標準の三つ組
  (`~/.claude/skills/gstack` → `~/{globalRoot}`、`.claude/skills/gstack` →
  `{localSkillRoot}`、`.claude/skills` → `{hostSubdir}/skills`)
- `suppressedResolvers`: GBrain の組 (`GBRAIN_CONTEXT_LOAD`、`GBRAIN_SAVE_RESULTS`)
- `runtimeRoot`: `sharedRuntimeRoot()`。スキルが `$GSTACK_ROOT/<path>` として実行または読み込むすべてのファイル
  (`bin`、`lib`、コンパイル済みのツール、`freeze/bin`、レビューのチェックリストと専門家、用語リストと質問レジストリ、
  AskUserQuestion のドキュメント、DX Hall of Fame、`VERSION`、office-hours と plan-design-review の `SKILL.md` のコピー)。
  これは setup の `_link_runtime_dists` と `_copy_runtime_skill_refs` を写したものです。
  `test/runtime-root-assets.test.ts` が、ステージされた各ルートをディスク上で検証します。追加のアセットを持つホストは、それを渡します:
  `sharedRuntimeRoot(['qa/templates'])`。
- `install`: `{ linkingStrategy: 'symlink-generated' }`
- `learningsMode: 'basic'`

`defineHost()` にフィールドを渡せば、どのフィールドも上書きできます。パスの書き換えオプションは 2 つあります:

- `extraPathRewrites`: 導出された三つ組の後ろに追加されます (例: kiro の codex パスのクリーンアップ、または AGENTS.md を使うホスト向けの `{ from: 'CLAUDE.md', to: 'AGENTS.md' }`)。標準の三つ組は正しいが、さらに必要な場合に使います。
- `pathRewrites`: 導出されたリストを完全に置き換えます。機械的に処理できないケースにだけ使います。codex と factory は、グローバルパスを `$GSTACK_ROOT` に書き換え、さらにレビューパスの書き換えを 1 つ追加します。claude は空のリストを持ちます。

この 2 つは互いに排他的です (両方を渡すとファクトリが例外を投げます)。

`define-host.ts` から export される共有定数は、スプレッドによる合成に使います。
`CROSS_MODEL_RESOLVERS` (外部プロバイダーのレビューのリゾルバーと Review Army。オプトアウトしたホストでは抑制される。Codex は外部レビューを残し、Review Army を抑制する)、
`GBRAIN_RESOLVERS` (デフォルトの抑制の組)、`EXEC_STYLE_TOOL_REWRITES` (openclaw と gbrain が共有する、OpenClaw 形式の小文字のツール書き換え)。

良い例: `hosts/opencode.ts` (パス + 追加のランタイムアセット)、
`hosts/factory.ts` (ツールの書き換えと条件付きのフィールド)、`hosts/hermes.ts`
(ツールの書き換えとリゾルバーの合成を備えた AGENTS.md ホスト)。

### 2. インデックスに登録する

`hosts/index.ts` を編集します:

```typescript
import myhost from './myhost';

// Add to ALL_HOST_CONFIGS array:
export const ALL_HOST_CONFIGS: HostConfig[] = [
  claude, codex, factory, kiro, opencode, slate, cursor, openclaw, hermes, gbrain, myhost
];

// Add to re-exports:
export { claude, codex, factory, kiro, opencode, slate, cursor, openclaw, hermes, gbrain, myhost };
```

### 3. .gitignore とレンダリング表に追加する

`.myhost/` を `.gitignore` に追加します (生成されたスキルのドキュメントは gitignore されています)。また、
`bin/gstack-host-renders.sh` の `GSTACK_HOST_RENDER_DIRS` に `myhost:.myhost` を追加します。
そうすればインストールは、インストールされているときだけそのホストをレンダリングし、そうでなければ削除します
(#1694。`test/host-renders.test.ts` が、この表を `hosts/*.ts` と照合します)。

### 4. 生成して検証する

```bash
# Generate skill docs for the new host
bun run gen:skill-docs --host myhost

# Verify output exists
ls .myhost/skills/gstack-*/SKILL.md

# Generate for all hosts (includes the new one)
bun run gen:skill-docs --host all

# Validate all host content and tracked output freshness, including the new host
bun run skill:check
# Claude install paths are rejected in prose; legitimate Bash fallbacks are allowed.
```

### 5. テストを実行する

```bash
bun test test/gen-skill-docs.test.ts
bun test test/host-config.test.ts
```

パラメータ化されたスモークテストは、新しいホストを自動的に拾います。それらは次のことを検証します: 出力が存在すること、パスの漏えいがないこと、フロントマターが有効なこと、
鮮度チェックに合格すること、そして外部レビューのスキルが各ホストの除外設定と一致すること。

### 6. README.md を更新する

適切なセクションに、新しいホストのインストール手順を追加します。

## 設定フィールドのリファレンス

すべてのフィールドの JSDoc コメント付きの完全な `HostConfig` インターフェースは、`scripts/host-config.ts` を参照してください。

主要なフィールド:

| フィールド | 用途 |
|-------|---------|
| `tier` | `full`、`experimental`、`instruction-only` のいずれか (ホストのティアを参照) |
| `capabilities` | ホストのランタイムが提供するもの。レンダリングとドキュメントは、これより多くを主張してはならない |
| `frontmatter.nameMatchesDirectory` | フロントマターの名前で索引するホストのために、`name:` に `gstack-<skill>` を書き込む |
| `defaultModel` | 明示的なモデルが生成時に渡されなかった場合にレンダリングされるモデルのオーバーレイ (`scripts/models.ts` の `ALL_MODEL_NAMES` に対して検証される) |
| `frontmatter.mode` | `allowlist` (列挙したものだけを残す) または `denylist` (列挙したものを取り除く) |
| `frontmatter.descriptionLimit` | 最大文字数。制限なしの場合は `null` |
| `frontmatter.descriptionLimitBehavior` | `error` (ビルドを失敗させる)、`truncate` (切り詰める)、`warn` (警告する) |
| `frontmatter.conditionalFields` | テンプレートの値に基づいてフィールドを追加する (例: sensitive → disable-model-invocation) |
| `frontmatter.renameFields` | テンプレートのフィールドの名前を変更する (例: voice-triggers → triggers) |
| `pathRewrites` | 内容に対するリテラルの replaceAll。順序が重要。導出された三つ組を置き換える |
| `extraPathRewrites` | (defineHost の入力のみ) 導出された三つ組の後ろに追加される |
| `toolRewrites` | Claude のツール名を書き換える (例: "use the Bash tool" → "run this command") |
| `suppressedResolvers` | このホストでは空を返すリゾルバー関数 |
| `coAuthorTrailer` | コミットの共同作成者の文字列 |
| `boundaryInstruction` | クロスモデル呼び出しのためのプロンプトインジェクション対策の警告 |

## 検証

`scripts/host-config.ts` の `validateHostConfig()` 関数は次の点を確認します:
- 名前: 小文字の英数字とハイフン
- CLI コマンド: 英数字とハイフン/アンダースコア
- `defaultModel`: `scripts/models.ts` の `ALL_MODEL_NAMES` にある既知のモデルファミリーであること
- パス: 安全な文字のみ (英数字、`.`、`/`、`$`、`{}`、`~`、`-`、`_`)
- 設定間で name、hostSubdir、globalRoot が重複していないこと

すべての設定を検証するには `bun run scripts/host-config-export.ts validate` を実行します。
