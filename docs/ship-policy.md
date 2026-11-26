# リポジトリの ship ポリシー: `.gstack/ship-policy.json`

`/ship` は、リポジトリごとに一つの機械可読なファイルを読みます。そこには、リリースのスタンプの付け方とマージの方法が書かれています。バンプのレベル、キューのモード、リポジトリ独自のリリースツール、バージョンへの言及を書き換える場所、CHANGELOG、対になるミラー、履歴のポリシー、事前登録された評価が含まれます。このファイルがなければ何も変わりません。すべてのキーには、今日の動作を再現する既定値があります。

このファイルは、**ベースブランチにコミットされた版**(`origin/<base>`)から読まれ、PR の作業ツリーからは読まれません。そのため、PR が自分自身のゲートにコマンドを忍び込ませることはできません。**ファイルがあるだけでは実行は許可されません。** `gstack-restamp` は、`/ship` の下でのみ、または `--allow-repo-commands` を付けた場合にのみ `release_tool` を実行します。単独で実行した場合は、コマンドを一覧表示して、`repo commands not executed (pass --allow-repo-commands)` と表示し、終了コード 3 で終わります。ポリシーを導入または変更する PR は、レビュー済みのブートストラップ経路(`--policy-from head --allow-repo-commands`)の下で実行され、その受領書には `policy: head (unreviewed)` と書かれます。

ツール: `gstack-ship-policy init|validate|show-effective|check-history`、`gstack-restamp`、`gstack-tree-receipt`、`gstack-ship-receipt`、`gstack-ship-queue`([共有マージキュー](#run-a-shared-merge-queue)、[マージトレイン](#run-a-merge-train))、`gstack-evidence bundle|ancestor`。これらは終了コードの表を共有します(`0` 成功、`1` 失敗、`2` 使い方の誤り、`3` 拒否またはフラグが必要)。すべてのエラー行は、[troubleshooting.md](troubleshooting.md#queue-aware-ship-policy-restamp-tree-receipt-ship-receipt) のコードで終わります。

<a id="schema-v1"></a>
## スキーマ v1

`gstack-ship-policy init` は、すべてのキーを既定値で書き出します。`init --explain` は、この表を表示します。JSON にはコメントを書けないため、例は `.gstack/ship-policy.example.json` にあります。未知のキーはエラーになります。拡張の仕組みはありません。新しい gstack のキー、または綴りを間違えたキーは、無視されるのではなく、安全側に倒れて失敗します(`POLICY_INVALID`)。すべてのキーには導入されたバージョンがあります(`init --explain` と `validate` が表示します)。1.91.98.0 より新しいキーを既定以外の値に設定する場合は、少なくともそのキーの導入バージョン以上の `min_gstack_version` が必要です。`min_gstack_version` より古い gstack は、そのファイルを拒否します(`POLICY_GSTACK_TOO_OLD`)。`validate` は最後に `MIN_READER: gstack <version>` を表示します。これは、そのポリシーを読むすべてのレーンが必要とする最低バージョンです。

| キー | 値 | 既定値 | 意味 |
| --- | --- | --- | --- |
| `bump` | `patch` \| `ask` | `ask` | `patch` は `/ship` のステップ12の MINOR/MAJOR の確認を省略し、`gstack-restamp --next` は PATCH を上げます。`ask` は確認を残します。 |
| `queue_mode` | `claim-at-open` \| `stamp-at-merge` | `claim-at-open` | [stamp-at-merge](#stamp-at-merge) を参照してください。`claim-at-open` は今日のキューです(`gstack-next-version` は PR を開いたときに枠を確保します)。 |
| `release_tool` | コマンドまたは `null` | `null` | リポジトリ独自のリリースコマンド(`bun run release:restamp`)。[リリースツールの契約](#release-tool-contract) の下で、分離されたステージング用の worktree で実行されます。 |
| `release_outputs` | グロブ | `[]` | バージョンのファイル、ロックファイル、CHANGELOG、`stamp_paths` 以外に、リリースツールが書き込んでよいパス。それ以外は `RESTAMP_OUTPUT_OUTSIDE_ALLOWED` になります。 |
| `stamp_paths` | グロブ | `[]` | 再スタンプの際に、ブランチの暫定バージョンに対する、正確な `(was X)`、`since: X`、`vX` の言及を書き換える場所。 |
| `changelog` | パスまたは `null` | `CHANGELOG.md` | 再スタンプの際に見出しを付け直します。PR の `## [Unreleased]`(または古いバージョン)のセクションが、`## [<version>] - <date>` として先頭に移動します。 |
| `mirror` | 相対パスまたは `null` | `null` | 同じ方法で再スタンプされる、対になったチェックアウト(第2階層: 現状は検証と閉じ込めのみ、まだ実行されません)。 |
| `history` | `merge-only` \| `squash-ok` | `squash-ok` | `merge-only` は、`/ship` が squash や rebase の計画を拒否するようにします。`gstack-ship-policy check-history` は、書き換えられたブランチを報告します(`HISTORY_POLICY_VIOLATION`)。 |
| `preregistration_shas` | コミット ID | `[]` | プッシュの前に、それぞれが HEAD の祖先でなければなりません: `gstack-evidence ancestor --from-policy`。ship の受領書にその結果が記録されます。 |
| `stamp_sensitive_gates` | 証拠のラベル | `[]` | VERSION または生成されたバイト列を読むゲート(gstack の `tests` レーンは、agents-digest の鮮度テストを通してこれを読みます)。ツリーの受領書がこれを再利用可能とマークすることはありません。 |
| `pr_count` | `{ default_pr_count, split_requires_owner }` | `{1, true}` | 計画レビューの PR 数の行。 |
| `maintainers` | GitHub のログイン名 | `[]` | `/review` のコントリビューターモードのためのメンテナーの集合。空の場合は、リポジトリへのプッシュ権限を持つ人を指します。 |
| `stamp_files` | グロブ | `[]` | リポジトリのスタンプのルール。設定されている場合、スタンプによって違いが生じてよいのは、これらのファイルだけです(バージョンのファイル、マニフェスト、プラグインツリー、PR 自身の `since:` の行を保持するファイルを列挙します)。これは他のすべてのスタンプのルールより前に適用されるため、その外側にある文書の `vX` の言及は違いになります。 |
| `stamp_patterns` | 文字通りのテンプレート | `[]` | 最大16個のテンプレートで、それぞれ最大128文字。`{version}` のスロットをちょうど一つ持ちます(`"version": "{version}"`、`since: '{version}'`、`<!-- x-stamp: {version} -->`)。バージョンの境界で文字通りに一致し、正規表現としては扱いません。再スタンプの書き込み処理とツリーの受領書は、組み込みの形式と並べてこれを使います。 |
| `restamp_command` | コマンドまたは `null` | `null` | リポジトリ独自の再スタンプ。ステージング用の worktree で最初に実行されます。[restamp_command](#restamp-command) を参照してください。 |
| `migrations` | `{ dir, id }` または `null` | `null` | マイグレーションのディレクトリと、ファイル名の中の番号を取り出すための、キャプチャグループをちょうど一つ持つ正規表現(`"^v(\\d+)-"`)。`gstack-pregate regate` は `MIGRATION_COLLISION` を報告します。 |
| `gate_command` | コマンドまたは `null` | `null` | リポジトリの完全なマージ前ゲート。`gstack-ship-queue gate-ahead` と `ready` は、呼び出し元が実行できるようにこれを表示します(バックグラウンドまたは CI で)。gstack がこれを実行することはありません。`min_gstack_version` が必要です。 |
| `full_e2e` | `true` \| `false` | `false` | `true` の場合、すべてのマージには、マージ対象のツリーと、スタンプを除いて等しいツリーに紐付いた、完全ゲートの合格結果が必要です。`gstack-ship-queue ready`、`stamp`、`verify` は、それがなければ拒否します(`QUEUE_GATE_MISSING`)。必要なものは、gate-ahead の記録、またはゲートされた head でのレーンの実行結果である `--gate-exit 0 --gate-log <file>` です。`min_gstack_version` が必要です。 |
| `min_gstack_version` | バージョンまたは `null` | `null` | このファイルを読んでもよい最も古い gstack。上の互換性のルールを参照してください。 |
| `train` | `{ gate_workflow, free_workflow, full_gate_check, record_artifact, max_size, fill_hours, screen_selection, trial_reservation_usd }` または `null` | `null` | [マージトレイン](#run-a-merge-train) を有効にします。ベースのリビジョンからのみ読まれます。すべてのフィールドが必須で、未知のフィールドは `POLICY_INVALID` になります。`max_size` は 1〜6、`fill_hours` は 0 より大きく最大24、`screen_selection` は `gstack-paid` \| `none`、`trial_reservation_usd` は 0 より大きく最大100です。`null` の場合は、PR ごとのキューがそのまま保たれます。`min_gstack_version` が必要です。 |

封じ込め。`validate` と、書き込み時にもう一度確認されます。パスとグロブは、リポジトリからの相対パスで、`..` のセグメントを含まず、256文字未満でなければなりません。リストごとに最大64個で、グロブの正規表現展開は512文字未満です。`release_tool` は512文字未満で、改行を含みません。シンボリックリンクを通してリポジトリの外側に解決される、一致したファイルは拒否されます(`POLICY_CONTAINMENT`)。ミラーは `..` から始まっても構いません(隣接するチェックアウト)が、途中に `..` を含むことはできません。ミラーへの書き込みは、そのディレクトリに限定されます。

## gstack 自身のファイル

gstack のポリシー(`.gstack/ship-policy.json`。`generated.json` と `pregate.json` と並んで、無視されている `.gstack/` の下で追跡されます)は、リポジトリを stamp-at-merge で運用します。バージョンは一度だけ割り当てられます。それは、PR がキューの次になったときに、ベースブランチのその時点のバージョンから決まります。すべてのバンプは PATCH です。`/review` は、ポリシーのファイルからメンテナーの集合を読みます。このポリシーには、以前 `gstack-version-bump --regen-digest` がハードコードしていた、リリースツールの名前が書かれています。

```json
{
  "bump": "patch",
  "queue_mode": "stamp-at-merge",
  "release_tool": "bun scripts/gen-agents-digest.ts",
  "release_outputs": ["agents-digest/gstack-AGENTS.md"],
  "stamp_paths": [],
  "changelog": "CHANGELOG.md",
  "history": "squash-ok",
  "stamp_sensitive_gates": ["tests"]
}
```

`.gstack/ship-policy.example.json` は、直列にマージするリポジトリで、リリーススクリプト、ドキュメントの言及、ミラーを持つ場合に、すべてのキーをどう設定するかを示しています。

### gstack のためのキュー側の手順

stamp-at-merge の下で、PR の作成者と、マージキューを実行するスレッドが、それぞれ何をするか。

1. **開く。** ブランチには、ベースのバージョンに PATCH を加えた暫定のスタンプが付いています(`gstack-version-bump write --version <base+patch> --regen-digest`)。また、その CHANGELOG のセクションは、そのバージョンの見出しで `# Changelog` の直下に置かれます。`## [Unreleased]` も受け付けられます。何も確保されず、`gstack-next-version` は参照されません。暫定のバージョンは、一般的なケースを無料にするための推測にすぎません。CI は、通常どおりこの head で実行されます。
2. **登録する。** キューは PR と、意図された順序を記録します。
3. **次になったらスタンプする。** 現在の head ですべてのチェックが緑で、`origin/main` がキューの想定した SHA にあるとき、PR の所有者(キューではない)がブランチ上で次を実行します: `gstack-restamp --next --base main --allow-repo-commands --pr <n> --expect-base <main-sha> --expect-order <pr,...>`。ベースが暫定のスタンプを越えて動いていない場合は、`RESTAMP: X -> X (noop)` と `FILES: (none)` を表示します。このとき、緑の head がマージ候補になり、それ以上の CI は不要です。ベースが動いていた場合は、ベース + PATCH をスタンプし、CHANGELOG をベースの最上位のエントリより上に付け直し、リリースツールを再実行して、`STAMP_VERSION: <X>` とスタンプの差分を表示します。`--expect-base` が読まれた後に、ベースまたは順序が動いていた場合は、何も書き込まずに `QUEUE_STALE` で拒否します。所有者はスタンプのコミットをプッシュし、その上で CI を実行させ、`READY #<n> <sha> STAMP_VERSION=<X>` を報告します。
4. **マージ。** キューは、その正確な SHA で検証します。`VERSION` が `STAMP_VERSION` と等しいこと。CHANGELOG の最上位の見出しが `[<X>]` で、その直下の見出しがベースの現在のバージョンであること。その SHA上のすべてのチェックが緑であること。そして、スタンプのコミットがプッシュされた場合、それが変更したのは `VERSION`、`package.json`、`CHANGELOG.md`、およびリリースの出力だけであること(`gstack-tree-receipt --gated <green-head> --current <sha>` がファイルごとの判定を表示します)。その後、マージ API の期待される head の `sha` をその SHA に設定して、squash でマージします。そのため、遅れたプッシュはサーバーによって拒否されます。「VERSION が main より上」は、「マージされる SHA の上で VERSION が再スタンプの STAMP_VERSION と等しく、そのバージョンがマージ時点でベース + PATCH であること」に置き換えられます。
5. **次ではない。** 別の PR の後ろで待っている PR は、`gstack-restamp --after <predecessor-pr>` でローカルにゲートを先行させることができます。何もプッシュしません。前の PR が着地したら、待っていた PR は `origin/main` をマージして取り込みます(リベースはしません)。自分の CHANGELOG のセクションは、新しくマージされたセクションの上に残します。その後、ステップ3が実行されます。

このポリシーが `origin/main` に入るまでは、`gstack-restamp --next` はベースの `bump: ask` を読み、MICRO のバンプにフォールバックします。ベースがそれ以前のものである場合は、ポリシーが切り替わった後にスタンプされる最初の PR で `--bump patch` を渡してください。

<a id="run-a-shared-merge-queue"></a>
## 共有マージキューを運用する

`gstack-ship-queue` は、`gstack-restamp`、`gstack-tree-receipt`、ship の受領書を、コーディネーターのプロトコルにまとめます。そのため、スタンプの差分を手で証明する人はいません。レーンは自分の PR を所有し、決してマージしません。コーディネーターは順序とすべてのマージを所有します。各ステップは、相手が動くための行で終わり、その後に `GSTACK_RESULT: skill=ship-queue status=complete|refused run=<path>` が続きます。ここでは何もプッシュしません。

**1. レーン: 準備完了を報告する(未スタンプ)。** ゲートと pregate がプッシュされた head で通った後:

```bash
gstack-pregate run --allow-repo-commands
git push
gstack-ship-queue ready --pr 42
```

```
READY #42 <head> STAMP_VERSION=unstamped
pr: https://github.com/<owner>/<repo>/pull/42
head: <head>
version: unstamped
base: origin/main@<sha>
ci: green at <head12> (passed=31 failed=0 pending=0 skipped=2)
PREGATE: pass tree=<tree12> head=<head12> checks=6
gate: command="<gate_command>" full_e2e=no gate-ahead=none
SHIP_RECEIPT: pr=42 head=<head12> …
```

次の場合は拒否します(`QUEUE_NOT_READY`)。作業ツリーに追跡されている編集がある場合、HEAD が PR のプッシュされた head ではない場合、その正確な head での CI が緑ではない場合、または pregate の結果が現在の合格ではない場合です。表示されたブロックは、そのまま送ってください。

**2. 別の PR の後ろにいるレーン: ゲートを先行させる。** 前の PR がまだ開いている間に、前の PR が着地した後のキューのツリーをゲートします。

```bash
git fetch origin pull/41/head
gstack-ship-queue gate-ahead --after 41 --pr 42 --predecessor-ref FETCH_HEAD --allow-repo-commands
```

次の行を表示します。`GATE_AHEAD: pr=42 attempt=<id> gated=<sha> tree=<tree> merge_tree=<tree> predecessor=#41@<sha12> version=<N+1>`。さらに、その試行専用の `worktree:`、その `record:` ファイル、`GATE_COMMAND:`(ポリシーの `gate_command`)、そして正確な `next:` の行を表示します。そこでゲートを実行し(バックグラウンドまたは CI で)、その後に結果を結び付けます。

```bash
(cd <worktree> && <gate command>) > gate.log 2>&1
gstack-ship-queue gate-ahead --record --pr 42 --attempt <id> --exit $? --log gate.log
```

`GATE_RECORD: pr=42 attempt=<id> exit=0 gated_tree=<tree> log_sha256=<sha256> current=yes`。記録はログを保持し、その試行の worktree だけを削除します。ただし、worktree がゲートされた commit を保持していなければ、拒否します(`GATE_AHEAD_ATTEMPT_INVALID`)。前の PR が動いた場合は、新しい試行を準備してください。試行どうしは worktree を共有せず、最新のものが現在の試行です。古いものを後から記録すると、`current=no (superseded by <id>)` と表示されます。`gate-ahead --list --pr 42` で、すべての試行を表示できます。記録ファイルは READY と一緒に送ってください。

**3. コーディネーター: 枠を指定する。** バージョン、ベースの sha、順序を指定します: 「#42 は 1.2.7.0 で次、ベース `<sha>`、順序 41,42」。

**4. レーン: スタンプする。** ゲート先行のレーンは、まず `origin/main`(前の PR を含む)を自分のブランチにマージします(リベースはしません)。その後、次を実行します。

```bash
gstack-ship-queue stamp --pr 42 --version 1.2.7.0 --expect-gated <gated> \
  --expect-base <sha> --expect-order 41,42 --allow-repo-commands
```

`<gated>` は、ゲートが実行された head です。レーンがゲートしたプッシュ済みの head、またはゲート先行の後の記録の `gated=` です。事前チェックは、スタンプするツリーがゲートされたものとスタンプを除いて等しいこと、ベースが `<sha>` であること、そして `full_e2e` の下では、ゲートされた head に紐付いた合格のゲート結果があることを確認できない限り、何も書き込まずに拒否します。その後、再スタンプを実行し、コミットし、ツリーの受領書を再実行して、次を表示します。

```
QUEUE_STAMP: 42 1.2.7.0 head=<sha> gated=<sha> tree=same-modulo-stamps receipt=<sha256>
```

各ステージは `.gstack/tmp/ship-queue/stamp-42.json` に記録されます。同じコマンドを再実行すると、最初の未完了のステージから再開するか、すでに完了している場合は保存された `QUEUE_STAMP` を返します。拒否された場合は `QUEUE_STAMP_REFUSED: 42 head=<sha> committed=no|yes <sha> stage=<stage>` と、コード付きの行を表示します(`QUEUE_STALE` は `recompute:` コマンドを伴います)。スタンプのコミットをプッシュし、その上の CI を待ち、再度 `ready` を実行します(`READY #42 <head> STAMP_VERSION=1.2.7.0`)。そして `QUEUE_STAMP` の行と一緒に送ります。

**5. コーディネーター: 検証してからマージする。** コーディネーター自身のクローンから:

```bash
gstack-ship-queue verify --pr 42 --gated <gated> --receipt <sha256> --expect-head <head> [--gate-exit 0 --gate-log <file>]
gstack-ship-queue verify --pr 42 --record <gate-ahead record> --receipt <sha256> --expect-head <head>
```

`refs/pull/42/head` を取得し、そこでツリーの受領書を再実行します。そのため、`QUEUE_STAMP` は貼り付けられた主張として扱われることはありません。結果は `VERIFY: 42 1.2.7.0 head=<sha> gated=<sha> tree=same-modulo-stamps receipt=<same sha256>` です。`full_e2e` の下では、`--gated` はそのレーンの、その head での合格のゲートログも必要です(`--gate-exit 0 --gate-log <file>`)。ない場合は `QUEUE_GATE_MISSING` になります。ゲート先行の記録がある場合、ゲートされた commit はレーンのマシンを離れていないため、まず `git merge-tree --write-tree <branch head> <predecessor head>` でマージを再計算し、記録されたマージのツリーと比較します。記録されたスタンプのパッチからゲートされたツリーを再構築し、記録された `gated_tree` と比較します。そのパッチがスタンプのみであることを証明し、前の PR が動いていないことを確認して、`merge_tree:`、`gated_tree:`、`gate:` の行を表示します。最後の行は `MERGE_CONDITION: sha=<head>` で、この期待される head でマージします。`QUEUE_VERIFY_MISMATCH` が出た場合は、マージしてはいけません。

**`gate_command` と `full_e2e` の段階的な導入。** それらを(`min_gstack_version` を、`init --explain` が表示する導入バージョンに設定して)コミットするのは、すべてのレーンの gstack が少なくともそのバージョンになってからにしてください。これはクルーのインストールの下限(`GSTACK_MIN_REVISION`)です。古い gstack のレーンは、ポリシーを読み違えるのではなく、名前を挙げてそのポリシーを拒否します。

<a id="run-a-merge-train"></a>
## マージトレインを運用する

マージトレインは、複数の READY の PR を、それぞれにゲートをかけるのではなく、一回の完全なゲートでまとめてゲートします。コーディネーターは、固定された未スタンプの PR の head を、スロットの順序で一時的な worktree の main にマージし、各プレフィックスのツリー(T0 が main、Tk がトレインの head)を記録します。そして、無料のテストを実行してから、トレインの head に対して完全ゲートを一回実行します。PR は一つずつマージされ、main のツリーがゲートされたプレフィックスとスタンプを除いて等しい場合にだけ、そのマージが進みます。赤いトレインは、赤いケースだけを対象に二分探索されます。

この機能は、ベースのリビジョンの `.gstack/ship-policy.json` が `train` ブロックを宣言していない限り無効です。ブロックがない場合、`train …` と `verify --train` は `QUEUE_TRAIN_OFF` で拒否されます。`ready --pr <n>` は、上の PR ごとの READY ブロックをそのまま表示します(`--screen`、`--no-screen`、`--broad` は、stderr に警告を出して無視されます)。gstack 自身のポリシーでは、次のように書かれます。

```json
"train": {
  "gate_workflow": "evals.yml", "free_workflow": "free-tests.yml",
  "full_gate_check": "gstack/full-gate", "record_artifact": "gstack-train-record",
  "max_size": 5, "fill_hours": 3, "screen_selection": "gstack-paid",
  "trial_reservation_usd": 1.5
},
"min_gstack_version": "<the version that introduced train>"
```

gstack 自身のポリシーにはこのブロックがあります。これが有効になったのは、ワークフロー側(train-nonce の記録、`cases` と `prefix_shas` の入力、dispatch されるスクリーン)がマージされ、ドライランのトレインが一度成功した後です。そのドライランは、スクラッチのベースの上の、スクラッチの未スタンプの docs の PR 2 つで行われました。そのベースの `route` ステップは、既定のブランチではなく、そのベースからポリシーを読みました。`gate_workflow` は `evals_all`、`expected_sha`、`nonce` を付けて dispatch されます(二分探索では `cases` と `prefix_shas` を追加し、スクリーンでは `screen_pr`、`screen_merge_sha`、`screen_policy` を追加します)。その実行は、完全性の集計(census)が完全で緑の場合にのみ、トレインの head にチェックの実行として `full_gate_check` を公開し、トレインの記録を `record_artifact` のアーティファクトとして公開します。gstack はその両方を読みますが、チェックを書くことはありません。`screen_selection: gstack-paid` は、スクリーンの推奨のために gstack の有料ケースの選択を計算します。`none` の場合は、選択をレーンに任せます。`trial_reservation_usd` は、コストのデータがない試行のために、二分探索が予約する額です。

すべてのコマンドは、その行を表示し、stderr にコード付きのエラー行を出し、その後に `NEXT: <command>` と `GSTACK_RESULT: skill=ship-queue status=… run=<record>` を表示します。記録は `$GSTACK_STATE_ROOT/ship-queue/` の下にあります(`trains/<nonce>/train.json` には、dispatch ごとに一つの試行記録があり、`ready/` には受領書、`freeze/` にはフリーズの記録があります)。それらは、リモートへの作用の前に、git notes として `refs/notes/gstack-trains` に origin へミラーされます。そのため、マシンを失っても何も失われず、クリーンなステートルートでの `train status` が記録を再構築します。`GSTACK_SHIP_QUEUE_NOW` は、テストのためにクロックを固定します。

**1. レーン: スクリーンの選択を付けて READY にする。** トレインのポリシーの下では、READY には明示的な選択が必要です。

```bash
gstack-ship-queue ready --pr 42                    # prints SCREEN: lines and the recommendation, refuses
gstack-ship-queue ready --pr 42 --no-screen        # READY receipt; the PR rides unscreened
gstack-ship-queue ready --pr 42 --screen [--broad] # dispatches one paid screen on the PR's merge SHA
```

選択がない場合は、`SCREEN:` の選択(`screen_selection: gstack-paid` の場合、スキル自身のケースと、スクリーンがスキル自身のケースを選ぶときの `recommend --screen` または `--no-screen`)を表示し、`READY_SCREEN_CHOICE_REQUIRED` で拒否します。価格の行は、ドル額がコストの再生を待っていることを示します。再生が完了するまで、`SCREEN:` はケースの数と推奨だけを表示します。ローカルで集中したケースを実行したレーンは、それを READY のブロックに記し、`--no-screen` を渡してもかまいません。`--screen` は、`gate_workflow` を `screen_pr`、`screen_merge_sha`(`refs/pull/<n>/merge` の SHA)、`screen_policy`(`narrow`、または `--broad` を指定した場合の `broad`。今日の PR の完全な選択です)付きで dispatch します。nonce のキーには目的とポリシーが含まれるため、繰り返しは同じ実行に従い、broad のスクリーンが narrow の実行を採用することはありません。READY のブロックには `screen: …` が追加され、受領書はローカルと notes の ref の両方に書かれます。`--dry-run` は、送信せずに dispatch を表示します。

**2. コーディネーター: 組み立てる。** 名前はすべて、READY が報告したとおりの固定値で指定します。

```bash
gstack-ship-queue train build --prs 41@<sha>,42@<sha>,43@<sha> --dry-run
gstack-ship-queue train build --prs 41@<sha>,42@<sha>,43@<sha>
```

`ORDER:`(告知するスロットの順序。スクリーンされた PR を READY の順序で先に並べ、その後にスクリーンされていないものを並べます。`max_size` 以上のスクリーンされていない PR が待っている場合は、それらが独自のトレインになり、`HELD:` にそれらが一覧表示されます)、プレフィックスごとの `PREFIX: T<i> <commit> tree=<tree>`、PR ごとの `SLOT:` を表示します。`--dry-run` は `ESTIMATE:` の行を追加し、何も書き込まず、プッシュせず、dispatch もしません。それ以外の場合は、`train.json` を書き込み、`train/<nonce>` をプッシュし、そこで `free_workflow` を dispatch して、その正確な SHA 上の緑の `workflow_dispatch` の実行を待ちます(`--free-timeout <s>`、デフォルトは2700)。その後、eval-bg の nonce を通して完全ゲートを dispatch します。`max_size` を下回るトレインは、最も古い READY が `fill_hours` 待つ(`QUEUE_TRAIN_WAITING`)まで待ちます。`--urgent` は、一つの PR だけのトレインを直ちに dispatch します。同じベース上の同じ固定値は、二つ目を作る代わりに生きているトレインを返します。`train build --train <nonce>` は、その記録からトレインを再開します。事前の拒否は、いずれも支出の前に行われます。`QUEUE_TRAIN_UNTRUSTED`(フォークの head)、`QUEUE_TRAIN_MOVED`(head が固定値から動いた)、`QUEUE_NOT_READY`(その head の READY の受領書がない)、`QUEUE_TRAIN_CONFLICT`(表示された `QUEUE_TRAIN_CONFLICT: train <id> stopped at #<pr> (conflicts: <files>) after merging #<a>,#<b>; nothing dispatched, no branch pushed; fix: …` の行が、その PR を除いた組み立てを名指しします)、`QUEUE_TRAIN_FREE_RED`(無料のテストが赤、欠落、キャンセル、または別の SHA 上にある)。マージでは、バージョンのファイルはプレフィックスの側を取り、CHANGELOG はセクションごとにマージされます。マージ時のスタンプが両方を書き換えるためです。

**3. コーディネーター: 状態と判定。**

```bash
gstack-ship-queue train status [--train <nonce>]
gstack-ship-queue train verdict --train <nonce>
```

`status` は決して支出しません。dispatch が試みられたのに実行が現れなかった場合(`QUEUE_TRAIN_DISPATCH_UNKNOWN`)、ワークフローの dispatch の実行を一覧表示し、nonce を持つ実行を採用するか、dispatch を `absent` とマークします。`absent` の dispatch だけが、同じ nonce の下で `train build --train <nonce>` により再送されます。`verdict` は、実行、その記録、`full_gate_check` のチェックを読みます。`GREEN` は、nonce、head、ツリーに紐付いた完全性の集計の場合のみです。実行中は `QUEUE_TRAIN_PENDING`、INFRA または INCOMPLETE のパネル、紐付いていない、部分的、またはキャンセルされたシャード、アップロード前に殺されたスライス、または記録がない場合は `QUEUE_TRAIN_INCOMPLETE`(決して緑にはなりません)、赤いケースを伴う `QUEUE_TRAIN_RED` です。

**4. 赤いトレイン: 二分探索し、再構築は最大一回。**

```bash
gstack-ship-queue train bisect --train <nonce> --spend-cap 5 --dry-run
gstack-ship-queue train bisect --train <nonce> --spend-cap 5
gstack-ship-queue train rebuild --train <nonce>
```

二分探索は、赤いケース(`cases`)を、すべてのプレフィックス T0..Tk(`prefix_shas`)に対して dispatch し、プレフィックスごとに一回の試行を行います。その前に、すべてのプレフィックスが `train/<nonce>` の祖先であることを確認します(`QUEUE_TRAIN_PREFIX_INVALID`)。すべてのケース×プレフィックスの試行を予約します(コストが不明なものは `trial_reservation_usd` で)。そして、上限に収まるプレフィックスだけを起動します(`QUEUE_TRAIN_BISECT_CAPPED`。完了したプレフィックスは保持され、より高い上限で再実行すると残りだけが実行されます)。結果を読むには再実行します。パターンが判定を下します。`ATTRIBUTED #<pr>` は単調な場合(その PR より前は緑、そこから赤)だけで、`NEXT:` はそれを除いたトレインを組み立てます。T0 を含むすべてのプレフィックスで赤なら `QUEUE_TRAIN_RED_ON_MAIN`(まず main を前進修正する)。それ以外は `QUEUE_TRAIN_UNATTRIBUTED` です。すべて緑だった二分探索は、変更のない再構築を一回だけ許可します(`train rebuild`。両方の実行を報告します)。単調でないパターンでは再構築は認められず、修復のレーンに回されます。その他の再構築はすべて `QUEUE_TRAIN_REBUILD_REFUSED` で、二回目の赤は赤のままです。INFRA/INCOMPLETE のみの完全性の集計は、EVAL_POLICY.infraRedispatch が許可する一回の再 dispatch を受けられます(`train rebuild --train <nonce> --infra`)。一回だけ再構築するルールは、EVAL_POLICY に記録されるまで、その定数の横にあるトレインのモジュールにあります。二分探索の結果が、トレインを緑にすることはありません。

**スロットをスタンプする。** スロットが呼ばれたら、レーンは main に PATCH を加えた版でスタンプします。スロット1のピンは main にきれいに適用されます。スロット2以降では、main にはすでに前のスロットのスタンプが入っているため、ピンは CHANGELOG.md で競合し、GitHub はそれをマージできません。レーンは、まず main をピンにマージしてから、スタンプします。

```bash
git fetch origin main
git merge --no-ff --no-commit origin/main        # expect a CHANGELOG.md conflict only
bun --no-env-file --config=/dev/null -e "import { mergeChangelogs } from './lib/changelog-check'; import { spawnSync } from 'node:child_process'; import { writeFileSync } from 'node:fs'; const s = (n) => spawnSync('git', ['show', ':' + n + ':CHANGELOG.md'], { encoding: 'utf8', maxBuffer: 1 << 26, timeout: 30000 }).stdout; const m = mergeChangelogs(s(2), s(3)); if (!m) { console.error('CHANGELOG needs a hand merge'); process.exit(1); } writeFileSync('CHANGELOG.md', m);"
git add CHANGELOG.md && git commit --no-edit
gstack-restamp --next --base main --pr 42 --expect-base <main sha> --expect-order <order> --allow-repo-commands
git add CHANGELOG.md VERSION package.json <release outputs> && git commit -m "v<X> stamp" && git push
```

CHANGELOG.md 以外のファイルでの競合は、そのマージがトレインのプレフィックスではないことを意味します。停止して報告してください。`verify` は、結果の head を、ツリーが T<i> とスタンプを除いて等しい限り受け付けます。`head:` の行には「main をマージした T<i>」と表示されます。

**5. コーディネーター: 検証、マージ、再検証。** スロットごとに、順番に:

```bash
gstack-ship-queue verify --pr 41 --train <nonce>   # MERGE_CONDITION: sha=<head>
# merge #41 with that expected head; gstack-restamp stamps it at merge
gstack-ship-queue verify --pr 41 --train <nonce>   # VERIFY_TRAIN: #41 merged; main's tree is T1 …
```

マージの前に、main のツリーはスタンプを除いて、その PR の前のプレフィックスと等しくなければなりません。また、PR は固定値(スタンプを除く)にあるか、スタンプを除いて T<i>(main をマージした固定値)になければなりません。マージの後には、main のツリーはその後のプレフィックスと等しくなければなりません。それ以外は `QUEUE_TRAIN_TREE_MISMATCH`(または `QUEUE_TRAIN_MOVED`)です。トレインの何もまだマージされていない場合は、単純な拒否です。現在の main の上に新しいトレインを組み立ててください。すでに前のスロットがマージされている場合、main には、どのゲートも単独ではカバーしていないプレフィックスがあるため、verify はキューをフリーズします。フリーズは、まずローカルの状態と notes の ref に書かれ、その後、main の SHA で完全ゲートがすぐに dispatch されます(バックストップ)。`QUEUE_TRAIN_FROZEN:` の行は、マージされた PR、main のツリー、バックストップの実行を一覧表示します。フリーズ中は、通常のトレインと他のトレインのマージは拒否されます(`QUEUE_TRAIN_FROZEN`)。修復用の PR を、その正確な head で一つだけ受け入れます。

```bash
gstack-ship-queue train build --repair --prs 44@<sha>
```

これは、main と修復の上で、通常の無料テスト、完全ゲート、検証を実行します。verify が修復のマージを確認すると、`FREEZE: cleared` を表示し、`NEXT:` はまだマージされていない PR のトレインを組み立てます。

**6. 後片付け。** `gstack-ship-queue train prune [--train <nonce>] [--dry-run]` は、マージ済み、置き換え済み、破棄されたトレインの `train/<nonce>` ブランチを削除します(`WOULD-DELETE:`、`DELETED:`、`GONE:`)。

**脱出口。** ベースブランチの `train` ブロックを削除すると、すべてのレーンが一度に PR ごとのキューに戻ります。`--urgent` は一つの PR を単独で出荷します。`--no-screen` は有料スクリーンを省略します。`--broad` はそれを今日の選択まで広げます。`train build --prs <list without it>` は、どの段階でも PR を除外します。

<a id="ship"></a>
## `/ship` がこれから読むもの

`/ship` のステップ3は `show-effective --base <base>` を実行し、その `ship:` の行に従います。これらの行は、スキルの説明文が別途書くはずだったワークフロー上の影響を伝えます。

| 行 | 効果 |
|---|---|
| `ship: history merge-only: …` | 決してリベース、squash、強制プッシュしない。`check-history --plan <merge\|squash\|rebase>` は、書き換えの計画を拒否します(`HISTORY_POLICY_VIOLATION`、終了コード 3) |
| `ship: queue_mode stamp-at-merge: …` | PR が次のときは、ステップ12の項目1〜4が `gstack-restamp --next --base <base> --pr <n> --expect-base <sha>` に置き換えられます。次でないときは `--after <predecessor-pr>` です。再スタンプ自身の `next:` の行が、その後に続くものを示します(NEW_VERSION、CHANGELOG のエントリのテキストだけ、マージの期待される head) |
| `ship: shared merge queue: …` | コーディネーターが実行するキューでは、`gstack-ship-queue ready`、`gate-ahead`、`stamp` が、再スタンプの呼び出しに置き換わります。[共有マージキューを運用する](#run-a-shared-merge-queue) を参照してください |
| `ship: gate-ahead: …` | `.gstack/tmp/gate-ahead.json` があると、ステップ16は、`gstack-tree-receipt … --json > .gstack/tmp/tree-receipt.json` が再利用可能とマークしたレーンだけを再利用します。スタンプに敏感なレーンと、対象外のレーンはライブで実行されます。`--force-gate <reason>` は、コーディネーターの判断です |
| `ship: bump patch: …` | ステップ12は、MINOR や MAJOR を決して尋ねません。サイズに応じて PATCH または MICRO を使います |
| `ship: preregistration: …` | プッシュの前に、`gstack-evidence ancestor --from-policy --base <base>` が `ANCESTOR: ok` だけを出力しなければなりません |
| `ship: release_tool: …` | このコマンドは `gstack-restamp` の内側でだけ実行されます(ステージング用の worktree、出力は `release_outputs` に限定) |

PR 本文の最初のセクションは ship の受領書です(`gstack-ship-receipt write … --body`)。これは、本文が作成された後に、`/ship` の pr-body セクションによって書かれます。

<a id="stamp-at-merge"></a>
## `queue_mode: stamp-at-merge`

stamp-at-merge の下では、PR を開いたときには何も確保されません。スタンプは、PR が次になったときに、その時点のベースブランチのバージョンから、リポジトリ自身のリリースツールを通して、すべてのスタンプの場所に同時に行われます。

```bash
gstack-restamp --next --base main --allow-repo-commands --pr 42 \
  --expect-base <sha of origin/main the queue assumed> --expect-order 40,41,42
```

この結果は `ship, next in queue at <version>`、`STAMP_VERSION: <version>`、ステージごとの一行、スタンプのファイルに限定された差分、`MERGE_CONDITION: sha=<head>`(マージ API の期待される head の `sha` に渡し、チェックからマージまでの競合をサーバーが拒否できるようにします)、そして `GSTACK_RESULT:` の行を表示します。`claims: ignored (stamp-at-merge)` は、従来の確保の読み取りが参照されなかったことを示します。ベースまたは順序が動いていた場合は、正確な `recompute` コマンドとともに `QUEUE_STALE`(終了コード 3)を返します。何も書き込まれません。

ステージ。それぞれ `.gstack/tmp/restamp-journal.json` に記録されます。

0. **restamp_command**(ポリシーがそれを設定している場合のみ): リポジトリ自身の再スタンプ。[restamp_command](#restamp-command) を参照してください。
1. **version**: ステージング用の worktree での `gstack-version-bump write --version <X>`(VERSION、マニフェスト、npm のロックファイル)。`restamp_command` がバージョンを管理している場合は省略されます。
2. **release_tool**: 以下の契約の下で、ポリシーのコマンドを実行します。
3. **changelog**: PR の `[Unreleased]` または古いバージョンのセクションが、`<X>` の下で先頭に移動します。その前任者のエントリの上に置かれます。見出しの重複(`CHANGELOG_DUPLICATE_HEADING`)と、最上位のエントリが `<X>` でない場合(`CHANGELOG_TOP_MISMATCH`)はエラーです。
4. **stamp_paths**: 正確な `(was X)`、`since: X`、`vX` の書き換えと、`stamp_paths` と `stamp_files` の範囲内にあるすべての `stamp_patterns` のテンプレート。`X` はブランチ自身の暫定スタンプです(その VERSION が base を越えて動いている場合)。そうでなければ `--was <X>`、それもなければ、スタンプのないブランチが次に取るはずのバージョン(`base + bump`)です。ベースが一度もリリースしていないバージョンへの言及(ベースの CHANGELOG の見出しでもタグでもないもの)も書き換えられます。そのため、キューの並べ替えでベースが動いても、ブランチの `since:` のフィールドは見つかります。リポジトリ自身のバージョンの幅だけが対象になるので、4桁のリポジトリにある3桁の依存関係の固定は、決して候補にはなりません。
5. **mirror**: 第2階層。宣言され、検証されていますが、実行されたとは報告されません。
6. **apply**: すべてのステージが、各々の既知のプリイメージに対して検証された後に限り、変更されたファイルがブランチに書き込まれます。その間にファイルが編集されていれば `RESTAMP_CONFLICT` となり、適用された書き込みはロールバックされます(ロールバックは、記録されたポストイメージとバイト列が異なるファイルを上書きしません)。

冪等です。同じバージョンで二回目を実行すると `noop` になります。`--dry-run` は、完全な差分を表示し、何も書き込みません(ジャーナルも含めて)。`--version <X>` は正確に X をスタンプします。`--bump` はレベルを上書きします。`--queue-mode` はポリシーを上書きします。

### ゲート先行: `--after <pr>`

並べ替えは、前任者がマージされる前にゲートを実行できる場合にだけ安く済みます。`gstack-restamp --after <pr> --predecessor-ref <ref>` は、一時的な worktree(`.gstack/tmp/gate-ahead-worktree`)で HEAD と前任者の head をマージします。解決するのは、バージョンのファイルと CHANGELOG の順序の競合だけです。そこで、前任者のバージョンに対して N+1 をスタンプし、commit し、`.gstack/tmp/gate-ahead.json`(`predecessor_head`、`branch_head`、`gated_head`、`gated_tree`、`version`、`evidence_branch_key`)を記録します。PR のブランチの履歴には決して触れないため、squash 履歴の PR もきれいなままです。ゲートはその worktree で実行されます。そこで `gstack-evidence bundle` が証拠をエクスポートします。

<a id="release-tool-contract"></a>
### リリースツールの契約

リリースツールは、作業ツリーのコンテンツのフィンガープリント(`gstack-wtree`)から種付けされた、分離されたステージング用の worktree で実行されます。リポジトリの無視されている `node_modules` がリンクされます。その出力は列挙されています。バージョンのファイル、ロックファイル、CHANGELOG、`stamp_paths`、`release_outputs` です。その集合の外への書き込みは、再スタンプ全体を、ブランチに何も届く前に拒否します(`RESTAMP_OUTPUT_OUTSIDE_ALLOWED`)。非ゼロの終了は `RESTAMP_RELEASE_TOOL_FAILED` です。すべての書き込みのプリイメージとポストイメージはジャーナルに記録されます。コマンドの文字列を固定しても、その実装は固定されません(`bun run release:restamp` は、PR のパッケージスクリプトをそのまま実行します)。そのため、受領書にはポリシーのリビジョン、コマンド、その作業ディレクトリ、信頼の範囲(`policy: base origin/main@<sha>` または `head (unreviewed)`)が記されます。

<a id="restamp-command"></a>
### `restamp_command`: リポジトリがスタンプを所有する

自身のツールがスタンプの場所を知っているリポジトリは、`restamp_command` を設定します。`gstack-restamp` は、それをステージング用の worktree の最初のステージとして実行します。この worktree は HEAD のクリーンなチェックアウトで、割り当てられたバージョンを最後の引数として、また `GSTACK_RESTAMP_VERSION` の中で受け取ります。呼び出し元の HEAD、インデックス、作業ツリーは、まずクリーンでなければなりません(`RESTAMP_CONFLICT`、何も書き込まれません)。一般的な経路は、作業ツリーのフィンガープリントの種付けを維持します。ステージング用の worktree でコマンドがステージングまたはコミットしたものは、通常の編集として取り込まれます。その後は、リリースツールと同様に出力の閉じ込めが適用されます(`RESTAMP_OUTPUT_OUTSIDE_ALLOWED`)。バージョンのファイルは対象のバージョンを保持していなければなりません(`RESTAMP_VERSION_SOURCE`)。非ゼロの終了は `RESTAMP_RELEASE_TOOL_FAILED` です。どの失敗でも、ブランチには何も届きません。gstack のバージョン書き込み処理は省略されます。CHANGELOG と `stamp_paths` のステージは引き続き実行されます(ツールがすでに作業を済ませていれば何もしません)。ベースブランチから読まれ、`--allow-repo-commands` を付けた場合にのみ、`release_tool` と同様に実行されます。フェッチする、ベースブランチをマージする、または独自に選んだバージョンを必要とするツールは、ここでは実行できません。バージョンを受け取り、スタンプだけを書くモードを用意してください。

<a id="tree-receipt"></a>
## ツリーの受領書

```bash
gstack-tree-receipt --from .gstack/tmp/gate-ahead.json --predecessor-pr 41 --bundle evidence-bundle.json
gstack-tree-receipt --gated <sha> --current HEAD --json
```

二つのコミットされた head を比較します(作業ツリーのフィンガープリントは、ゲートの VM が消えると到達できなくなるオブジェクトを指すことがあるためです)。ゲートされた head と現在の head、両方のツリー ID、バージョンの組、ゲートが想定した前任者、スタンプのファイルに限定された差分、ルールと判定を伴うファイルごとの一行、ゲートごとの一行を表示し、その後に二つの判定の行を表示します。

```
TREE: same-modulo-stamps | changed (<residual paths>)
gate-reuse: eligible (reusable: tests; rerun: digest) | not-eligible (<what changed>) — fix: <rerun command> (GATE_REUSE_NOT_ELIGIBLE)
```

変更はファイルの種類ごとに分類されます。バージョンのファイル(古い → 新しい、だけ)、マニフェスト(`version` キーだけ)、npm と bun のロックファイル(ルートの `version` キーだけ。`gstack-version-bump` が書く箇所。依存関係のエントリは `changed`)、CHANGELOG(見出しの移動や付け直し。エントリの順序に依存しない多重集合として比較)、`stamp_paths` と `release_outputs`(削除と追加の各ペアは、正確な `(was X)` / `since: X` / `vX` の書き換えでなければならず、X はゲートされたバージョン、置き換えは現在のバージョンです。そのため、古いバージョンと偶然等しい依存関係の固定は `changed` になります。`stamp_patterns` のテンプレートも、スタンプの形式として数えられます)。`stamp_files` が設定されている場合、その外側にあるファイルは、どんな差分であっても `changed (stamp_files: not in the repo's stamp_files allowlist)` になります。それ以外のバイトはすべて変更です。

同等性はゲートごとに決まります。`stamp_sensitive_gates` にあるレーンは、常に `rerun` になります。検証済みのレーンが `reusable` になるのは、ツリーがスタンプを除いて同じで、かつバンドル内の実行の識別情報が現在のものと等しい場合だけです。その識別情報とは、Bun と Node のバージョン、OS とアーキテクチャ、すべてのロックファイルの識別情報(ルートの version は正規化して除外)、`.github/workflows` のツリー ID、ランタイムの固定ファイル、`package.json#engines`、そして両側が知っている場合のランナーのイメージです。バンドルがない場合、識別情報は不明となり、受領書は `not-eligible` になります。記録された前任者の head が、もはや前任者の PR の head ではない場合(`--predecessor-ref` または `gh pr view --predecessor-pr` で確認)、受領書は `PREDECESSOR MOVED <old> -> <new> — fix: gstack-restamp --after <pr> again (RESTAMP_PREDECESSOR_MOVED)` を表示し、`eligible` は拒否します。
