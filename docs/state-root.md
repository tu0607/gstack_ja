# gstack が状態を保存する場所

gstack は、設定、分析データ、セッション、プロジェクト、学習内容、レビューログ、egress 台帳、trust-policy ストア、フックのエラーログなど、覚えておくべきものをすべて 1 つのディレクトリ(**state root**)の下に保存します。既定では `~/.gstack` です。別の場所にしたい場合は `GSTACK_HOME` を設定してください。

ルートを選ぶ規則は 1 つだけで、gstack のすべてのスクリプト、フック、スキルがこれを使います。この規則は 2 つの所有者ファイルにあり、パリティテストによって両者は同一に保たれています。`bin/gstack-state-root.sh` (bash) と `lib/state-root.ts` (TypeScript) です。

## ルートの選ばれ方

下の一覧で最初に空でない値を持つ変数が採用されます。空の値は未設定として扱います。

| 順位 | 変数 | 使いどころ |
|------:|--------|----------------|
| 1 | `GSTACK_STATE_ROOT` | `gstack-paths` 自身の出力です。入力としても読まれるため、同じ環境で再度読めば同じルートが返ります。手で設定しないでください。 |
| 2 | `GSTACK_HOME` | 状態を `~/.gstack` 以外に置きたいときに**設定すべき唯一の変数**です。 |
| 3 | `GSTACK_STATE_DIR` | 互換性のために受け付ける旧来の別名です。 |
| 4 | `CLAUDE_PLUGIN_DATA` | `CLAUDE_PLUGIN_ROOT` に `gstack` (大文字小文字は問わない) が含まれる場合に限ります。これにより、他のプラグインのデータディレクトリが gstack の状態を取り込むことがなくなります。 |
| 5 | `$HOME/.gstack` | 既定値です。Windows のシェルでは、`HOME` が未設定の場合に `USERPROFILE` が代わりになります。 |
| 6 | `.gstack` | ホームディレクトリがまったくない環境 (一部のコンテナなど) の最後の手段です。 |

## どのルートが使われているか確認する

```bash
~/.claude/skills/gstack/bin/gstack-paths --explain
```

`GSTACK_HOME` を設定していても、`~/.gstack` に古い状態がまだ残っている場合の実際の出力は次のとおりです。

```
state root: /home/you/work-state (selected by GSTACK_HOME)
chain (first non-empty wins):
  GSTACK_STATE_ROOT    unset
  GSTACK_HOME          /home/you/work-state  selected
  GSTACK_STATE_DIR     unset
  CLAUDE_PLUGIN_DATA   unset
  default              /home/you/.gstack  ignored
default root /home/you/.gstack also holds gstack state: yes
merged privacy keys (most restrictive value across roots wins):
  telemetry:        off (from /home/you/.gstack/config.yaml)
  memorable_recall: not set (default applies)
  codex_reviews:    not set (default applies)
  update_check:     not set (default applies)
docs: https://github.com/garrytan/gstack/blob/main/docs/state-root.md
```

`--explain` は読み取るだけで、何も書き込まず、終了コード 0 で終わります。`gstack-config list` も、`GSTACK_STATE_ROOT`、`GSTACK_HOME`、`GSTACK_STATE_DIR` が異なるディレクトリを指している場合には、その旨を 1 行で表示します。

## 状態を移動する

gstack が状態を勝手に移動することはありません。移動したい場合は次のとおりにします。

```bash
cp -a ~/.gstack /new/place/gstack-state
export GSTACK_HOME=/new/place/gstack-state   # add this to your shell profile
~/.claude/skills/gstack/bin/gstack-paths --explain   # confirm: selected by GSTACK_HOME
```

新しいルートが正しく動くことを確認したら、古い `~/.gstack` は残すか削除してください。削除するまでは、次のセクションで説明するプライバシー設定が引き続き有効です。

## ルートを移してもプライバシー設定が緩くなることはない

4 つの設定キーはオプトアウト型です。`telemetry` (off < anonymous < community)、`memorable_recall` (off < on)、`codex_reviews` (disabled < enabled)、`update_check` (false < true) です。gstack は、各キーを解決済みのルートと `~/.gstack` の両方から読み、最も制限的な値を採用します。そのため、`~/.gstack` で一度 telemetry をオフにしておけば、`GSTACK_HOME` を設定した後もオフのままです。ほかのキー(proactive と founder_resources を含む)は、解決済みのルートだけを読みます。

`gstack-config set` が統合対象のキーを書き込んだとき、もう一方のルートにより制限的な値が残っている場合は、どちらのルートがその値を上書きしているかを表示し、そのルートを変更するためのコマンドを示します。例えば次のとおりです。

```bash
GSTACK_STATE_ROOT='/home/you/.gstack' ~/.claude/skills/gstack/bin/gstack-config set codex_reviews enabled
```

`gstack-config list` は、統合対象のキーについて勝っているルートを表示します。例: `telemetry: off (set, /home/you/.gstack)`。

trust-policy の拒否ティアも同じように統合されます。`~/.gstack/gbrain-repo-policy.json` にある `deny` または `read-only` のエントリは、解決済みのルートが別の場所にあっても引き続き有効です。また、もう一方のルートに何かが書き込まれることは決してありません。

## プロジェクトのバケット

プロジェクトごとの状態 (チェックポイント、学習内容、タイムライン、質問の設定) は `projects/<slug>/` に保存されます。スラッグは `bin/gstack-slug` が git の `origin` リモートから決めます。

- 2 セグメントのリモート (`github.com/owner/repo`) は `owner-repo` に入ります。
- パスのセグメントが 3 つ以上あるリモート (GitLab のネストしたグループ、例: `gitlab.com/customer-a/product/repo`、Azure DevOps) は `product-repo-<16 hex>` に入ります。16 進数の部分は正規化されたリモートのダイジェストなので、`customer-a/product/repo` と `customer-b/product/repo` は別々のバケットになります。また、ssh、https、ポート付き ssh の表記が同じリポジトリを指す場合は同じバケットになります。
- リモートがない場合は、プロジェクトルートのディレクトリ名が使われます。

あるディレクトリで gstack が最初に解決したスラッグは固定されます (`slug-cache/` の下にキャッシュされます)。そのため、後からリモートを追加してもプロジェクトは同じバケットを使い続けます。

**ネストしたグループを 1 つのバケットにまとめていたバージョンからのアップグレード。** 以前のバージョンでは、`<group>/product/repo` をすべて `product-repo` に入れていました。この旧バケットはそのまま残ります。gstack がそれを移動したり削除したりすることはありません。gstack が新しいスラッグを初めて解決するとき、両方のバケットの名前を挙げた通知を 1 回表示します。旧バケットにまだチェックポイントが残っている間は、`/context-restore` がその旧バケットを報告します。以前のファイルを新しい場所へ移すには、プロジェクトで次を実行します。

```bash
~/.claude/skills/gstack/bin/gstack-slug --adopt-legacy
```

このコマンドは、旧バケットにあるすべてのファイルを一覧表示します。チェックポイントには、このプロジェクトに一致する、別のプロジェクトに属する (コピーは決してされない)、または不明 (チェックポイントがプロジェクトを記録する前に保存されたもの) のいずれかのマークが付きます。プロジェクトの識別情報を持たないファイル (質問の設定、学習内容、タイムライン) は、同じバケットを共有していた任意のプロジェクトに属する可能性があるため、一覧に出され、どれをコピーするかはあなたが決めます。ターミナルでは 1 ファイルごとに確認されます。ターミナル以外では `gstack-slug --adopt-legacy --copy <path> [<path>...]` で選んだファイルをコピーします。確認なしにコピーされることはなく、新しいバケット内のものが上書きされることもありません。

**スラッグの固定。** `GSTACK_PROJECT_SLUG=<name>` を設定すると、バケットを自分で選べます。例えばプロジェクトの `.claude/settings.local.json` に設定します (`"env": {"GSTACK_PROJECT_SLUG": "<name>"}`)。ssh のホストエイリアス (`git@work-gitlab:group/sub/repo`) が https のリモートとは別のホストを指している場合や、独立したプロジェクトとして扱いたいベンダリングされたサブリポジトリの場合に使います。この固定は実行ごとに適用され、キャッシュされることはありません。

<a id="ephemeral-machines"></a>
## 使い捨てのマシン

Capy のクラウドマシン、CI ランナー、使い捨ての VM は、実行が終わるとディスクが失われます。それに伴い、既定のルートの下に gstack が書き込んだ学習内容、判断、レビューログの行、タイミング記録もすべて失われます。gstack はパスからこの状態を推測しません (tmpfs とホームディレクトリは見た目が似ているためです)。代わりに、ホストが 1 つの環境変数でそれを宣言します。

```
GSTACK_EPHEMERAL=1
```

このマーカーによって変わる点は次のとおりです。

- `gstack-doctor` と `gstack-doctor --check` は、`state root` の行を `durable=no` として報告します (ダッシュボードは警告しますが、チェックは通ります。一時的なルートは事実であって、壊れたインストールではないためです)。
- 無人セッションでは、`learnings: skipped (state root is ephemeral; set GSTACK_STATE_ROOT)` と表示されます。消えるディスクに黙って書き込むことはありません。

永続的なルートは、オーナーが自分で選ぶ場合に限られます。マシンより長く残るディレクトリを `GSTACK_STATE_ROOT` (または `GSTACK_HOME`) に設定します。インストーラーが勝手に選ぶことはありません。Capy では、ドライブは Capy 自身のドライブポリシーによって管理されます。そのポリシーはメモリと検証の証跡を除外するため、`bin/gstack-capy-install` はそのオプションを表示するだけで、そこには決して書き込みません。

子シェルでの `export` は、親の後続のコマンドを設定できません (`lib/state-root.ts` は各プロセス自身の環境変数を読みます)。そのため、インストーラーは最後に、親が起動するすべての gstack コマンドに渡す 1 行の機械可読な出力を表示します。

```
GSTACK_LAUNCH: GSTACK_SESSION_KIND=unattended GSTACK_STATE_ROOT=<path> GSTACK_EPHEMERAL=1
```

各コマンドの前に、これらの代入を付けるか (`export` で一度設定します)、それを実行するシェルで設定してください。詳しくは [docs/capy-install.md](capy-install.md) を参照してください。

## アンインストール

`gstack-uninstall` が状態を削除するのは `~/.gstack` の場合だけです。

- `~/.gstack` の解決結果 (シンボリックリンクをたどった先) が `/`、ホームディレクトリまたはその親、gstack のチェックアウト、現在の git リポジトリ、またはそれらの親のいずれかである場合は、まず拒否されます (終了コード 2)。メッセージには理由と `fix:` 行が示されます。
- 解決されたルートが別の場所にある場合 (例: `GSTACK_HOME` を設定した場合)、アンインストールはそれを残し、`left in place: <path> (selected by <VAR>=<value>)` と、中身を確認した後に実行すべき正確な `rm -rf -- '<path>'` コマンドを表示します。
- `--keep-state` は状態を一切削除しません。`--force` は確認プロンプトを省くだけです。

## gstack-paths がない場合

スキルのブロックは、次の方法でルートを解決します。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
```

(`eval` は使っていません。worktree で分離された Claude Code セッションは `eval` を拒否するためです。)

後半の部分は、リゾルバーが壊れている場合に `/` の下へ書き込んでしまうのを防ぎ、ブロックを停止させます。`gstack-paths failed` または `cannot resolve the gstack state root` と表示された場合は、再インストールしてください。gstack のチェックアウトで `./setup` を実行するか、`/gstack-upgrade` を使います。

## Claude Code プラグインでのインストール

gstack は現在、公式の Claude Code プラグインとしては配布していません (`.claude-plugin` のマニフェストが `main` に入ったことはありません。一部のフォークが公開しています)。また、telemetry はプラグイン形式のインストールを報告しません。gstack がプラグインとして動く場合、`CLAUDE_PLUGIN_ROOT` が gstack を指し、状態は `CLAUDE_PLUGIN_DATA` に置かれます。一方、プラグインセッションの外でのターミナル実行は `~/.gstack` を使います。これは 2 つの異なるルートです。どちらが有効かは、それぞれの環境で `gstack-paths --explain` を実行して確認してください。環境をまたぐサポート (`~/.gstack` からプラグインのルートへのポインタ) は、プラグイン配布が存在するようになるまで見送られています。

## コントリビューター向け

- Bash: 実行ファイルは隣の `bin/gstack-state-root.sh` を source し、`gstack_state_root_select` を呼び出します (`$_gstack_sr_root` が設定されます)。あるいは、前述のガード付きで gstack-paths を `eval` します。フックは対になるファイルを source しなければならず、フックから gstack-paths を起動してはいけません。
- TypeScript: `lib/state-root.ts` の `resolveStateRoot()` と `readConfigKey()` を使います。
- `test/state-root-ratchet.test.ts` は、手書きのチェーン、テンプレートの bash ブロック内の実行可能な `~/.gstack`、ガードのない gstack-paths の `eval`、または文章中の `export GSTACK_STATE_ROOT` が見つかると失敗します。その許可リスト (`test/state-root-ratchet.allowlist.json`) では、各エントリに理由が必要です。
