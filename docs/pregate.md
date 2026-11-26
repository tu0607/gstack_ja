# 事前ゲート: 生成ファイル、軽量チェック、issue リンク

`/ship` のステップ5は、`gstack-pregate` から始まります。これは、マルチエージェントの作業で何度もリモートゲートに払っていた確認を、無料で先に行うものです。古くなった生成ファイル、リポジトリのルートに置かれた作業用スクリプト、古い定数をまだ検証しているナイトリー専用のテスト、Windows 専用の変更がレーンを実行されないままマージされたケース、`| tail` によって隠された失敗などを検出します。計画は `docs/designs/MULTI_AGENT_WAVE_2026_10_10.md` の C4、C6、C8 にあります。結果コードは [docs/troubleshooting.md](troubleshooting.md#pre-gate-generated-file-registry-gstack-pregate-issue-links) を参照してください。

すべて `lib/` の上に作られた三つのバイナリがあります。

| バイナリ | ピン留めファイル(`origin/<base>` から読み込み) | 役割 |
|---|---|---|
| `gstack-regen` | `.gstack/generated.json` | 生成ファイルは再生成し、手でマージすることはしない |
| `gstack-pregate` | `.gstack/pregate.json` | 二段階の軽量ゲート、`pregate.json` の記録、公開チェック |
| `gstack-issue-links` | — | `Fixes #N` は明示的に閉じる意図がある場合のみ付与。関連 PR と検証済みの flake issue を扱う |

## 信頼の境界

ピン留めファイルはコマンドを指定します。ただし、ファイルが存在するだけでは実行は許可されません。どちらのツールも、`origin/<base>` にコミットされた版を読み込みます。これにより、PR が自分自身のゲートにコマンドを忍び込ませることはできません。コマンドは `--allow-repo-commands` を付けた場合にのみ実行されます。`/ship` はこのフラグを渡します。単独で実行した場合、`gstack-regen check` はコマンドを一覧表示して終了コード 3(`REPO_COMMANDS_NOT_ALLOWED`)で終わります。`gstack-pregate` は `regen` と `lanes` を `pass` ではなく `incomplete` とマークします。`--policy-from head`(ピン留めファイルを導入または変更する PR)は、`--allow-repo-commands` を付けた場合にのみ受け付けられ、記録には `policy head (unreviewed)` と書かれます。ベースを解決できない場合は、終了コード 3 と `POLICY_SOURCE_UNAVAILABLE` で終わります。グロブはリポジトリからの相対パスでなければなりません(`..` や絶対パスは不可、リストごとに最大64個)。コマンドは1行で、512バイト未満です。

<a id="generated"></a>
## `.gstack/generated.json`(generated-v1)

```json
{ "$schema": "https://github.com/garrytan/gstack/docs/pregate.md#generated-v1",
  "entries": [ { "id": "skill-docs", "command": "bun run gen:skill-docs --host all",
                 "outputs": ["*/SKILL.md", "*/sections/*.md"], "inputs": ["*/SKILL.md.tmpl", "hosts/**"] } ] }
```

- `gstack-regen check` は、すべてのエントリを再生成します(`--only <id>` で指定した一つ、または `--touched <paths>` で入力か出力が交わるもののみ)。再生成は、作業ツリーから作られた一時的な `git worktree` で行われ、`node_modules` はコピーではなくリンクされます。ツリーには触れず、古くなった出力を `REGEN_STALE`(終了コード 1)として報告します。出力は異なるものの、`package.json` に依存関係が宣言されていて `node_modules` がない場合は、古いとは扱わず、そのエントリを `REGEN_DEPS_MISSING`(インストールしてから再実行)とします。`command` のないエントリは追跡のみです(別のエントリが生成するゴールデンファイルなど)。
- `gstack-regen write` は、その場で再生成を行います。`gstack-restamp` とステップ3の競合ルールはこれを使います。登録された出力で競合した場合は、どちらか一方を採用してから `gstack-regen write` を実行してください。エージェントが生成ファイルを手でマージすることはありません。
- `list`、`validate`、`init [--explain] [--force]`。

gstack のエントリは次の二つです。`skill-docs`(すべてのホスト向けのレンダリング、エージェントダイジェスト、llms.txt、doctor のコンポーネント表)と `ship-goldens`(`bun scripts/gen-ship-goldens.ts`、`test/fixtures/golden/` にあるバイト単位で固定された `/ship` のレンダリング)です。

<a id="pregate-v1"></a>
## `.gstack/pregate.json`(pregate-v1)

| キー | 意味 |
|---|---|
| `runner` | `{files}` を含むローカルのテストコマンド(gstack では `bun test {files}`)。未設定の場合は自動検出されます(bun、vitest、jest、pytest、`node --test`、そして Dart パッケージのルートごとの `flutter test`/`dart test`。そのパッケージまたは祖先が `.fvmrc` または `.fvm/fvm_config.json` で固定していて、fvm が PATH にあれば fvm 経由で実行)。何も検出されない場合、PATH に Dart SDK がない場合、または上位に `pubspec.yaml` がない `.dart` ファイルがある場合は `incomplete` になります(実行可能なグループは実行されるため、実際の失敗は依然として失敗になります) |
| `dependencies` | サブプロセスの対象、ランタイムの読み込み、生成の入力などで、インポートグラフからは見えないものについて、グロブからテストファイルへの対応を定義します。`[]` は「このレーンは不要」を宣言します(ドキュメント、ライセンスなど) |
| `empty_lanes` | docs/テストなしの空レーンに対する追加のグロブ。どのテストも依存していない Markdown ファイルは、ピン留めファイルがなくても既に該当します(他のファイルと同じインポートグラフによる。引用されたパス、パスセグメントの `join()`、インポート、`dependencies` のエントリ)。reStructuredText と AsciiDoc もここでは Markdown として扱われます。README、CHANGELOG、CONTRIBUTING、LICENSE、AGENTS、CLAUDE は `.md` でなくても該当し、ベンダリングされたライセンス文(`roboto-LICENSE.txt`、`LICENSE-MIT`、`licenses/*.txt` など)も該当します。ソースコードとテストディレクトリ配下のファイルは該当しません。そのファイルを読むテストは、引き続きそのテストが選択されます |
| `selection` | `workflow.yml/job` から、レーンのファイル一覧を出力するコマンドへの対応。プランナーが計算するマトリックス用です(gstack では `scripts/test-free-shards.ts --list`) |
| `warn` | 警告に格下げされるチェック ID。`secrets` と必須レーンは格下げできません |
| `strays.allow` | 意図的なルートのファイルや、新しいトップレベルのディレクトリ |
| `guards` | `[{ id, when: [globs], command, fix?, timeout_s? }]`。変更されたファイルが `when` に一致したときにレーンが通過しなければならないリポジトリのコマンド(マニフェストのチェック、インポートグラフからは見えないサブプロセスのゴールデンなど)。[guards](#guards) を参照してください |
| `serial_patterns` | `lanes` チェックが、ユニットファイルとは別に、ファイルごとに一つのプロセスで実行するテストファイルのグロブ(デフォルトは `**/*.serial.test.*`) |
| `sealed` | 公開先に出てはいけない、封印された出力や評価の出力。プッシュ前フックと `gstack-pregate sealed` が読みます([sealed 出力](#sealed) を参照) |
| `price_file` | 有料ゲートの呼び出し計画データファイルの、リポジトリからの相対パス(`GSTACK_EVAL_CALLS v1`)。`gstack-eval-plan price-gate` はこれから価格を計算し、何も実行しません([docs/eval-calls.md](eval-calls.md)) |
| `stall_timeout_s` | テストコマンドが何も出力しない状態が続いた秒数。この後、プロセスグループは強制終了され、チェックは `incomplete`(`PREGATE_STALLED`)になります。デフォルトは300、`0` で無効化。`--stall-timeout` で上書き可能です([監視](#supervision) を参照) |
| `remote_gate` | リポジトリのリモートテストゲートのコマンド。8コア未満では、ローカルのテスト階層は、これを名指しする `requires-remote` の義務になります。`--remote` を指定すると実行されます([リモートゲート](#remote-gate) を参照) |

ベースブランチの `origin/<base>` にあるコピーだけが有効です。そのため、格下げは有効になる前にレビューされます。`gstack-pregate validate` と `init` は、作業ツリーのファイルを対象とします。

`gstack-pregate init` は、固定の例ではなく、リポジトリから作られた下書きを書き出します。見つかった言語と、各言語のテストに割り当てられるランナーを表示します。インポートグラフでテストに結び付けられないファイルは、その上にある最も近いディレクトリのうち、テストを25個以下しか持たないディレクトリのテストに対応づけられます(スキーマの上限は256エントリ)。下書きが `[]` を書くことはありません。それではテストのないファイルがクリアされてしまうためです。近くにテストがないファイル、およびプランナーがマトリックスを計算するレーンは、`TODO` として表示されます。ベースブランチにこのファイルをコミットする前に、各エントリを確認してください。

## `gstack-pregate`

```
gstack-pregate [--stage preflight|tests|all] [--only <check,..>] [--allow-repo-commands] [--policy-from base|head]
               [--timeout <s>] [--stall-timeout <s>] [--remote --spend-cap <usd>] [--explain] [--json]
gstack-pregate verify | clear --remote <workflow.yml/job> --run-url <url> | lanes | validate | init
```

二段階で、それぞれ独立したクロックを持ち、どちらも出力されます。

**ステージ1、機械的な事前チェック**(2分の約束。gstack での計測では `regen` が約2.5秒、ほかの各チェックは200ミリ秒未満):

- `regen`: 変更された入力または出力を持つ、レジストリのすべてのエントリが最新であること(一時的な worktree での `gstack-regen check`)。
- `secrets`: ブランチで追加された行に対する `gstack-redact`(merge-base から作業ツリーまで、未追跡ファイルを含む)。HIGH、または `secret` カテゴリの MEDIUM は失敗します。その他の MEDIUM は警告です。格下げはできません。
- `strays`: リポジトリのルートに置かれた新しいファイル、新しいトップレベルのディレクトリ、またはどこにあってもスクラッチ用の名前(`zz-*`、`tmp*`、`scratch*`)。
- `literals`: 変更された、エクスポートされた定数や名前付きのタイムアウト・リトライのリテラルすべてについて、テストツリー全体(ナイトリーや Heavy 専用のファイルを含む)で古い値を検索します。ブランチが更新していない利用箇所は `file:line` 付きで失敗します。

- `timing`: 追加または変更されたテストの行で、経過した壁時計時間や CPU 時間を上限と比較している箇所、またはスリープした後にアサートしている箇所は、`TIMING_ASSERTION: <file>:<line> <pattern>` と、`TIMING_ASSERTIONS: found=<n> escaped=<n> files=<n>` という要約を出力します。これは警告(`PREGATE_TIMING_ASSERTION`)で、ブロックはしません。[タイミング](#timing) を参照してください。

- `guards`: `.gstack/pregate.json` の各ガードのうち、`when` のグロブが変更ファイル(名前変更を含む)に一致したものは、検証済みの起動用 Bun の下で、自分のプロセスとして `command` を実行します。タイムアウトは各自の `timeout_s`(デフォルトは `--timeout`)です。終了コードが 0 以外の場合、pregate はガードの名前と `fix` を示して失敗します(`PREGATE_GUARD_FAILED`)。タイムアウトは `incomplete` です。`--allow-repo-commands` がない場合、選択されたガードを一覧表示し、そのチェックは `incomplete` になります。ガードはベースブランチのコピーから読まれ、警告に格下げすることはできません。[ガード](#guards) を参照してください。

**ステージ2、テストの実行:**

- `lanes`: 変更されたファイルは、`lib/pregate/import-graph.ts` を通じてテストに対応づけられます(静的インポート ∪ リポジトリパスの文字列リテラル ∪ `bin/<name>` → `test/<name>*.test.ts` の慣例 ∪ `dependencies`)。Dart の `import`/`export`/`part` ディレクティブは、追跡されているすべての `pubspec.yaml` を通して `package:<name>/x` を解決します。`test/` ディレクトリ配下の `*_test.dart` ファイルはテストです。ただし `integration_test/` と `test_driver/` の下は例外です。これらはデバイスを必要とするため、pregate は実行しません。変更されたものがある場合は、`dependencies` の下で `"**/integration_test/**": []`(および `"**/test_driver/**": []`)を宣言し、CI に実行させるまで、そのレーンは存在しません。Dart ファイルは、デバイステストを含めてソースコードとして扱われます。そのため、`dependencies` に `[]` を宣言するとそれらは対象外になりますが、`empty_lanes` では対象外になりません。変更された非テストファイルを経由して推移的に解決されます。削除されたファイルや名前の変わったファイルは、それを名指ししていたテストを選択します。
  変更されたソースファイルにレーンがない場合は `FAIL lanes — <file> has no test lane` となり、決して合格にはなりません。どのテストも依存していない Markdown は、代わりに docs/テストなしの空レーンになります(`docs/no-tests: N documentation file(s)`)。ベースブランチに `.gstack/pregate.json` がない場合も同様です。依存関係は他のファイルと同じインポートグラフなので、Markdown を読むテスト(フィクスチャやドキュメント)は、引き続きそのテストを選択します。`empty_lanes` は他のドキュメントのためにグロブを追加しますが、ソースファイルやテストディレクトリ配下のファイルを対象外にすることはできません。
  テストランナーが読み込まないファイルは、同じ規則により二つ目の空レーンになります(`no-tests (assets and tool config): …`)。スナップショット、ゴールデン、フィクスチャのディレクトリ外にある画像、フォント、メディア、PDF と、ツールの設定を許可リストで定めたもの(`.editorconfig`、`.gitignore`、`.pre-commit-config.yaml`、lint と format の設定、`.vscode/`、`.idea/`、`.impeccable/`、GitHub の issue テンプレート、CODEOWNERS、dependabot の設定)です。スタイルシートは互いにインポートし合うため、その他のドットファイル(`.rspec`、`.husky/` のフック、`.env*`、バージョンの固定)、CI のワークフローとアクション、`.gstack/` は、引き続きレーンが必要です。
  Django プロジェクト(manage.py があるか、django をインポートするコードがあり、かつ `INSTALLED_APPS` または `ROOT_URLCONF` に代入している Python コード(文字列やコメントではないもの)、あるいは設定ファイルが `DJANGO_SETTINGS_MODULE` を指定している場合)では、Django が名前で読み込むファイルに `framework` のエッジが付きます。すべての Python テストは、各設定モジュールに依存します。設定モジュール内のドット区切りの文字列と、`include("app.urls")` の引数はインポートとして数えられます。アプリのマイグレーション、`admin.py`、`templates/`、`static/`、`templatetags/`、`management/`、`fixtures/`、`locale/` のファイルは、そのアプリのテストと、その `models.py` に到達するテストを選択します(アプリ自身のテストがない場合は設定モジュール、つまりスイート全体)。プロジェクトレベルの `templates/` ディレクトリ配下のテンプレートは、設定モジュールを通じてスイート全体を選択します。
  レーンとプラットフォームの階層は、`.github/workflows/*.yml` から得られます(`gstack-pregate lanes` で表示)。ステップが名指しするテストのパスは、そのステップの `working-directory` に対して解決されます。なければジョブまたはワークフローの `defaults.run.working-directory` を使います。ローカルのものは、ランナーを `set -o pipefail` の下で実行し、ランナーの要約行で判定されます(テストが一つも実行されないのは失敗、`| tail` で隠された終了コードも失敗として扱われます)。このマシンでは実行できないプラットフォームのレーンは、`workflow.yml/job` を名指しする `requires-remote` の義務になります。`--explain` は各テストの出どころと、不確かなすべての対応づけを表示します(プランナーが計算するマトリックスで `selection` マニフェストがない場合は、保守的に選択されます)。`serial_patterns`(デフォルトは `**/*.serial.test.*`)に一致するテストファイルは、ユニットファイルの後に、ファイルごとに一つのプロセスで実行されます。ランナーとすべてのガードは、まず検証済みの起動用 Bun を PATH の先頭にして実行されます。これは `$BUN_INSTALL/bin` と `~/.bun/bin` のうち、gstack とプロジェクトの `engines.bun` を満たす Bun を持つ最初のものです(`runtime: bun <v> from <dir>` の行として表示されます)。そのため、Capy ホストの古いイメージの Bun が判定を覆すことはありません。
- テスト階層のすべてのコマンド(レーンのランナー、各ガード、`--remote` のゲート)は、監視されたうえで実行されます([監視](#supervision) を参照)。`--timeout` は各ランナープロセス(ユニットファイルのグループ、各シリアルファイル、独自の `timeout_s` を持たない各ガード)を制限するもので、合計の時間は制限しません。ストール・タイムアウトは、停止したり無出力になったりしたプロセスを、より早く検出します。
- 8コア未満では、ベースブランチの `remote_gate` またはリモートの `test_backend`(`gstack-config set test_backend ubicloud`)によって、ローカルのテスト階層は、実行される代わりに `requires-remote` の義務として記録されます。[リモートゲート](#remote-gate) を参照してください。

すべてのチェックは、実行時の入力の識別情報を記録します(チェックの前後の作業ツリーのフィンガープリント、選択内容、コマンドのハッシュ)。チェックの途中でツリーが動いた場合、タイムアウトした場合、ツールが見つからない場合は、`incomplete` であり、決して `pass` ではありません。記録は `.gstack/tmp/pregate.json` にあります(`gstack-artifact validate --as pregate`)。

**公開。** `gstack-ship-receipt write --pregate .gstack/tmp/pregate.json`(ステップ18)は、記録が公開されるツリーに対して最新でない場合(`PREGATE_STALE`: 最終スタンプの後に再実行する)、緑でない場合(`PREGATE_LANE_FAILED`、`PREGATE_INCOMPLETE`)、または `requires-remote` の義務のいずれかに受領書がない場合(`PREGATE_REMOTE_UNCLEARED`: ジョブを dispatch してから `gstack-pregate clear --remote <workflow.yml/job> --run-url <url>` を実行する)には、書き込みを拒否します。その後、ship の受領書には `pregate` と `requires_remote` が記録されます。`gstack-pregate verify` は、同じチェックを単独で実行します。

未知のフラグは、すべての動詞で使用法を表示して終了コード 2 になります(gstack にないフラグを実行するように指示されたエージェントが、頼んでいない緑を得ることがないようにするためです)。まだ実装されていない階層2のチェック(`ratchets`、`lint`、`links`、`hermetic`、`patches`、`integrator`)は、`--only` のヘルプに挙げられています。

<a id="supervision"></a>
## 監視: 進捗、ストール、期限

GBRA-95(gbrain、4コア): コアの変更で 3,683 個のローカルファイルが選択され、そのうち 358 個が直列でした。テストのステージは90分間何も表示しませんでした。各シリアルファイルのランナープロセスは、それぞれの `--timeout` まで実行され、その出力は戻るまでバッファされていました。そして、出力が止まったプロセスに誰も気づきませんでした。現在は、各テスト階層のコマンドが次のように動きます。

- 独自のプロセスグループ(`setsid`)で実行され、標準出力と標準エラーはパイプではなくログファイルに追記されます。そのため、出力を開いたままにするバックグラウンドの孫プロセスがチェックを止めることはありません。コマンドの終了後、そのグループの残っているメンバーは強制終了されます。
- 進捗は stderr にライブで報告されます(stdout は表、または `--json` 指定時は一つの JSON ドキュメントのままです):
  ```
  PREGATE_TEST: <n>/<total> <file> start
  PREGATE_TEST: <n>/<total> <file> pass|fail <seconds>
  PREGATE_HEARTBEAT: <label> running <s>s; last file <file>; log <bytes> bytes, last growth <s>s ago (<log>)
  PREGATE: tests <verdict> in <s>s — lanes: <detail>
  ```
  ファイルごとの行は、ランナーのレポーターが提供する場合に、進捗アダプターから出力されます。`bun test`(そのファイルの `<file>:` ヘッダー)が現時点で唯一のアダプターです。一つのファイルだけを実行する場合(各シリアルファイル)は、どのランナーでも起動時にそのファイルを報告します。その他のランナー(node --test、vitest、jest、pytest、flutter test、dart test)はハートビートだけを出力します。進捗行が60秒出ないと、ハートビートが出ます。
- ログが、ストールのタイムアウト(`--stall-timeout <s>`、なければ `stall_timeout_s`、それもなければ300。`0` で無効化)の間に増えなかった場合、**ストール**として強制終了されます。チェックは `incomplete` になり、`PREGATE_STALLED` を表示して、最後に開始されたファイルの名前を示します。次のシリアルファイルは引き続き実行されます。
- そのランナープロセスが `--timeout` に達した場合、**タイムアウト**として強制終了されます(ランナープロセスごとに判定されるので、それぞれは収まっていても、シリアルファイルが多い場合は合格します)。チェックは `incomplete` になり、次のシリアルファイルは引き続き実行されます。

強制終了は、まずグループに SIGTERM を送り、5秒後に SIGKILL を送ります(SIGTERM を無視するグループも確実に終了します)。`gstack-pregate` 自身が SIGINT または SIGTERM を受けると、実行中のすべてのグループに SIGKILL を送り、`pregate.json` は書き込まず、終了コード 130 または 143 で終わります。Windows にはここでのプロセスグループがありません。強制終了は、シェルのツリーに対する `taskkill /T /F` で行われます。そのため、親から切り離されたり、分離して起動されたりした子孫は取りこぼすことがあります。

<a id="remote-gate"></a>
## 小型マシンとリモートゲート

8コア未満(`os.availableParallelism()`)で、ベースブランチの `.gstack/pregate.json` が `remote_gate` を宣言しているか、`gstack-config get test_backend` が `local` 以外を返す場合、レーンのチェックはローカルでは何も実行しません。選択されたローカルのファイルを、`requires-remote` の義務として、実行するコマンドとともに記録します。そのコマンドは、宣言された `remote_gate`(`pregate.json/remote_gate`)か、`test_backend/<backend>`(gstack では `scripts/ubicloud/ubi-runner.sh run --src <repo> -- '<runner> <files>'`)です。どちらもなければ、テスト階層は上記の監視のもとでローカルに実行されます。義務は次の二通りのいずれかで解消します。

- 実行後に `gstack-pregate clear --remote pregate.json/remote_gate --receipt <file>` を実行します。ゲートの出力を、`--remote` が検証するのと同じ方法で検証します(実行 URL は拒否され、受領書が不正な場合は `PREGATE_RECEIPT_INVALID`)。または `gstack-pregate clear --remote test_backend/<backend> --run-url <url>` を実行します。これは機械で検証できる受領書がないため、`attested:<url>` として記録されます。
- `gstack-pregate --stage tests --remote --spend-cap <usd> --allow-repo-commands` を実行します。これは宣言された `remote_gate` を今すぐ実行します(`--policy-from head` の下では決して実行されません。`remote_gate` のない `test_backend` は、この方法では実行できません)。ゲートはリポジトリのルートで、`PREGATE_TREE`(テスト対象の作業ツリーのフィンガープリント)、`PREGATE_FILES_FILE`(選択されたファイル、1行に1つ)、`PREGATE_SPEND_CAP_USD` を環境変数として実行されます。そして `PREGATE_REMOTE: tree=<tree> tests=<n> failed=<n> [spent=<usd>]` を出力しなければならず、実際にテストしたツリーを報告します。義務が解消されるのは、そのツリーが `PREGATE_TREE` と一致し、`tests` が 0 より大きく、`failed` が 0 で、ゲートが終了コード 0 で終わった場合だけです。それ以外の場合、義務は解消されず、チェックは `incomplete` になります。上限は `$GSTACK_SPEND_CAP_USD` がデフォルトで、支出のデフォルトはありません。支出は `spent, reserved, unknown` として表示されます。`spent=` を出力しないゲートは `unknown` となり、上限として数えられます。

gstack 自身の例: `.gstack/pregate.json` は `"remote_gate": "bash scripts/ubicloud/pregate-remote.sh"` を宣言しています。`UBICLOUD_API_KEY` が設定されていれば、スクリプトは `bun run test:ubicloud` の環境で、選択されたファイルを一つの Ubicloud VM 上で実行します。上限では、サイズのリスト価格(`UBI_SIZE`、デフォルトは `standard-16`)で20分の実行を買えない場合、VM を作成する前に拒否します。テストが実行される前に、VM 上でツリーと計画されたファイル集合を確認し、請求された分から `spent=` を報告します。キーがない場合は、同じファイルをローカルで並列シャード(`test-free-shards.ts --files-from`)として実行し、`backend=local (N cores; not the CI environment)` の行を出した後、`spent=0` を報告します。選択に有料のテストファイル(skill-e2e や `test/helpers/paid-test-set.ts` のその他の有料グロブ)が含まれる場合は、それらが名指しされ、有料の PR ゲートに委ねられます。有料ファイルだけの選択は `tests=0` を報告し、これは義務を解消しません。コマンドはどちらの場合も同じです(`--remote` には常に上限が必要です。キーのない経路は何も支出しません)。

pregate は、`--timeout`(デフォルトは600秒)でゲートを強制終了し、その後に5秒の猶予を与えます。そのため、スクリプトはその期限より前に終わらなければなりません。スクリプトは `PREGATE_TIMEOUT_S` から期限を読み取り、なければ実行元の `gstack-pregate` コマンドから(その `--timeout`、なければ600)読み取ります。そして、後片付けのために120秒と15秒の余裕を確保し、VM に対して、その時点と上限の壁(最大45分、後片付けの3分を引いたもの)のうち早い方で停止するよう指示します。期限によって VM の残り時間が300秒未満になる場合は、VM を作成する前に拒否されます(`PREGATE_REMOTE_TIMEOUT_TOO_SHORT`)。作成時には、VM の名前と、実行が後片付けの行より前に強制終了された場合にそれを破棄するための `bash scripts/ubicloud/ubi-runner.sh down <name>` の行を表示します。スクリプトは実行前にすべて解析されるため、実行中に編集しても何も変わりません。`--timeout 2700` は、45分の壁の内側で、ティア全体の実行に十分な余裕を与えます。

```bash
gstack-pregate --stage tests --remote --spend-cap 2 --timeout 2700 --allow-repo-commands
```

計測値(2026年10月): キーありの場合、標準の 16 コアのマシンで、無料のファイル 1,280 個すべてを実行し、開始から後片付けまで 404 秒かかりました(作成 24 秒、セットアップ 72 秒、テスト 250 秒)。費用は $0.06 です。キーなしで 4 コアの場合、98 ファイルに 103 秒かかり、GSTA-35 の 798 ファイルの選択には 3,550 秒かかりました。そのため、キーなしで実用的なのは小さな選択だけです。小型マシンで大きな選択を行う場合は、キーが必要か、実行が終わる長さの `--timeout` が必要です。キーなしの実行は CI ではなく、あなたの環境で行われる点にも注意してください。setup-free-suite.sh がインストールするもの(Playwright の Chromium、Xvfb)を必要とするファイルは、ローカルでそれらをインストールするまで失敗します。

すべての拒否の行は、理由コードから始まります。

| コード | 終了コード | 意味 |
|---|---|---|
| `PREGATE_REMOTE_USAGE` | 2 | 入力が欠けているか不正な形式です。`gstack-pregate --stage tests --remote` を通じて実行してください |
| `PREGATE_REMOTE_TREE_MISMATCH` | 3 | 作業ツリーが `PREGATE_TREE` ではありません。何もアップロードされず、何も支出されません |
| `PREGATE_REMOTE_TREE_MOVED` | 3 | 実行中にツリーが変わりました(動いたパスを一覧表示します)。結果は報告されません |
| `PREGATE_REMOTE_VM_TREE` | 3 | VM の展開されたツリーまたは計画されたファイル集合が、ローカルで確認したものと異なります |
| `PREGATE_REMOTE_NO_RESULT` | 1 | test-free-shards が結果を出力しませんでした(ファイル一覧が拒否されました) |
| `PREGATE_REMOTE_PAID_ONLY` | 0 | 選択されたファイルがすべて有料のテストファイルです。`tests=0` では解消できません |
| `PREGATE_REMOTE_CAP_TOO_LOW` | 5 | 上限ではサイズの価格で20分の実行を買えません。何も作成されません |
| `PREGATE_REMOTE_NO_PRICE` | 5 | `UBI_SIZE` がスクリプト内にリスト価格を持っていません |
| `PREGATE_REMOTE_TIMEOUT_TOO_SHORT` | 5 | pregate の期限が、135秒の後片付け分を引いた後に VM の残り時間を300秒未満にします。何も作成されません |
| `PREGATE_REMOTE_INFRA` | 4 | 作成、セットアップ、SSH、または停止の期限が失敗しました。VM、その後片付けの行、`spent=` が続きます |
| `PREGATE_REMOTE_INTERRUPTED` | 130 | TERM または INT。ubi-runner が自分で VM を後片付けします |

<a id="guards"></a>
## ガードとレーン完了のルール

レーンは、完了を報告する前に、自分のブランチで `gstack-pregate run --allow-repo-commands` を実行します。そのハンドオフには `PREGATE:` の行が含まれます(コーディネーターの契約がその内容を一字一句定めています)。ユニット階層は、変更されたファイルのテストを扱います。ガードは、インポートグラフからは見えないリポジトリの機械的なゲートを扱います。

```json
{ "guards": [
    { "id": "serial-manifest", "when": ["test/**/*.serial.test.ts", "scripts/serial-files.tsv"],
      "command": "bun test test/scripts/serial-files.test.ts",
      "fix": "add the file's row to scripts/serial-files.tsv" } ] }
```

`dependencies` は、引き続きグロブを、レーンのチェックが選択する追加の*テスト*に対応づけます。ガードは、独自の修正行を持つ*コマンド*です。古い gstack は未知のキーを拒否するため(`PREGATE_CONFIG_INVALID`)、リポジトリは、それを読む gstack が出荷された後に初めて `guards` をコミットします。gbrain の実際の設定例は [gbrain の設定例](#gbrain-worked-configs) にあります。

<a id="timing"></a>
## タイミングのアサーション

`timing` が読むのは、ブランチがテストコードに追加または変更した行だけです(テストファイル、および `test/`、`tests/`、`spec/`、`__tests__/` 配下のファイル。フィクスチャのツリーは決して対象にしません)。報告するパターンは次の三つです。

| パターン | 例 |
|---|---|
| `wall-time-bound` | `expect(Date.now() - t0).toBeLessThan(400)`、`expect(elapsedMs).toBeLessThanOrEqual(2_000)`、`assert elapsed < 0.5` |
| `cpu-time-bound` | `expect(cpuMs(() => parse(x))).toBeLessThan(150)`、`assert time.process_time() - c0 < 0.2` |
| `sleep-then-assert` | `await Bun.sleep(50); expect(calls).toBe(1)`(固定のスリープであり、ポーリングのループではない) |

`0` との比較、名前付きの上限(`timeoutMs`、`TTL_MS`)、素の `Date.now()` と順序づけられたタイムスタンプ、そして `while (… Date.now() < deadline)` のポーリングは報告されません。既存のアサーションの上限を変更することは変更された行なので、報告されます。

**エスケープ。** 上限そのものが契約である場合(余裕の大きいハング検出や、純粋な関数に対する CPU 時間の上限など)は、コメントの中に `gstack-timing-ok: <reason>` を書いてください。どのコメント構文(`//`、`#`、`/* */`、`--`)でもかまいません。行の上、または同じ行に置きます。理由は必須です。空の理由でも報告されたままになり、`(gstack-timing-ok needs a reason)` と表示されます。`--explain` は、すべてのエスケープとその理由を一覧表示します。

**ブロックではなく警告(2026-10-16 に計測)。** 検出器は次のものに対して実行されました。

- gstack 自身のテストツリー: 1,566 個のテストファイルのうち 123 個で 263 件のヒット(`wall-time-bound` 176 件、`sleep-then-assert` 87 件)。大半は本物のタイミングのアサーションで、その多くは「ハングしないこと」を確認する寛容な上限です。
- gstack の main 上の直近 51 コミット: テストに触れた 47 件のうち 9 件が指摘されていたはずです(29 件のヒット。#3190 だけで 7 件)。
- gbrain の master 上の直近 100 コミット: テストに触れた 95 件のうち 37 件が指摘されていたはずです(147 件のヒット)。
- gbrain の五つのタイミング起因の flake 修正(#6050、#6493、#6726、#6746、#6862): 38 か所の修正箇所のうち 31 か所が、修正前に指摘されていたはずです。見逃したものは、行にタイミングの比較がない flake です(#6050 の注入された期限、#6862 のスリープと期限パラメーターを持つ `Promise.race`)。また、時計の読み取りから離れた場所で計算される比率やパーセンタイルの確認も含まれます。#6726 の正しい修正(壁時計からスレッドの CPU 時間へ)は、依然として上限であり、21 回報告されます。

ブロックにすると、gstack のテストに触れるコミットの約五分の一、gbrain のテストに触れるコミットの約五分の二が止まってしまいます。正しい修正も含まれるため、このチェックは警告にとどめています。より厳しくしたいリポジトリは、この警告をレビューのルールに残してください(/review のチェックリストにも同じルールがあります)。/investigate の flake 対応手順では、タイミング起因の flake への対処は「上限を決して上げないこと」と定めています。

<a id="sealed"></a>
## sealed 出力: プッシュ前フックと `gstack-pregate sealed`

```json
{ "sealed": {
    "paths": ["heldout/**"],
    "transcripts": ["runs/**/transcript*.jsonl"],
    "answer_markers": ["SEALED ANSWER:"],
    "seed_patterns": ["shuffle_seed=\\d+"],
    "local_paths": true } }
```

`sealed` キーを持つリポジトリは、管理されたプッシュ前フック(`gstack-redact install-prepush-hook`。再インストールは不要)または単独の事前チェックが実行されるたびに、誤った公開を防ぐための局所的なチェックが適用されます。

```
gstack-pregate sealed [--range <a..b>] [--remote origin] [--base <branch>] [--json]
```

- **境界。** プッシュが公開するすべてのコミット: `git rev-list <local sha> --not --remotes=<remote>`(ref が存在する場合はリモートの先頭も含む)。送信先に ref がない場合は、到達可能なすべてが対象です。`--range` は、コミットを明示的に指定します。
- **ルール。** `sealed.path` と `sealed.transcript` は、内容にかかわらず、コミットが追加、名前変更、コピーするすべてのパスを確認します(バイナリ、空、後のコミットで再び削除されたものを含む)。`sealed.answer`、`sealed.seed`、`sealed.local_path`(`/home/<user>/`、`/Users/<user>/`、`C:\Users\<user>\`)は、各コミットで追加された行を確認します。検出結果には、ルール、`file[:line]`、コミットが表示され、本文は決して表示されません。
- **ポリシー。** 送信先のベースブランチの `sealed` と、プッシュされるコミットの `sealed` の和集合です。プッシュによってポリシーを厳しくすることはできますが、緩めることはできません。不正または読めないポリシーは拒否されます。免除は、ベースブランチの `.gstack/sealed-allow.tsv`(`rule<TAB>path<TAB>sha<TAB>reason`)からのみ得られ、すべてのプッシュで一覧表示されます。
- **公開範囲。** `sealed.visibility` をベースブランチから読みます。なければ、状態ルートの下にあるキャッシュ(`sealed-visibility.json`: `public` の回答は24時間、`private` の回答は1時間有効で、拒否を警告に変えることができます)を使います。それもなければ `gh repo view --json visibility`(5秒)を使います。不明、読み取り不能、または新しく作成されたものは、公開として扱われます。公開の場合は拒否し(`SEALED_OUTPUT_REFUSED`、終了コード 1)、非公開の場合は警告します。

Capy のプルリクエストツールは、ローカルの git フックを実行しないことがあるため、`sealed` の設定があるリポジトリでは、エージェントがプッシュや PR 作成の前に `gstack-pregate sealed` を実行します(コーディネーターの契約にそう書かれています)。公開リポジトリのホスト型 CI は、アップロードの後になってようやく迂回を検出します。

<a id="regate"></a>
## `gstack-pregate regate`: ゲートが HEAD をまだカバーしているか

```
gstack-pregate regate --against <gated-head> --bundle <evidence-bundle.json> [--require <lane,...>]
                      [--pr <n>] [--from <gate-ahead.json>] [--predecessor-pr <n> | --predecessor-ref <ref>]
                      [--base <branch>] [--json]
gstack-pregate --against <gated-head> ...      the same verb
```

ゲートされた head と HEAD の間で、ベースブランチの ship ポリシーの下に、ツリーの受領書を今その場で評価します(保存されたものは使いません)。そのため、リポジトリの `stamp_files` と `stamp_patterns` が、何をスタンプとするかを決めます([ship ポリシー](ship-policy.md#tree-receipt) を参照)。再利用には、ゲートされたツリー上で作られた証拠バンドル、同じ実行の識別情報、そして記録されている head のままである前の head(`--from` から読み込む。既定は、この gated head を指している場合の `.gstack/tmp/gate-ahead.json`)が必要です。どのファイルが違うかを(スタンプ以外の違いには最初の行とともに)表示し、その後に次を出力します。

```
STAMP_ONLY: yes|no files=<n> [changed=<n>]
LANE: <label> reusable|rerun|not-reusable (<reason>)      one per bundle lane and per --require lane
MIGRATION_COLLISION: none (...) | unknown (...) | <id> <file> vs <origin/main|PR #n> <file>
REGATE: not-needed | needed (<every reason>)
```

`REGATE: not-needed`(終了コード 0)は、ツリーがスタンプのみであり、バンドルと `--require` のすべてのレーンが再利用可能であり(スタンプに敏感なレーンは再実行されるため、再ゲートが必要です)、前の head が既知で変わっておらず、マイグレーションの検索が衝突なしに完了した場合にのみ出力されます。それ以外はすべて `needed`(終了コード 1)です。バンドルがない場合は `REGATE: needed (no gate evidence for <head> ...)` と出力されます。

マイグレーションは ship ポリシーの `migrations`(`dir`、およびファイル名から番号を取り出すための、キャプチャグループを一つ持つ `id` の正規表現)から得られます。このブランチが `dir` の下に追加する番号は、ベースブランチのツリーや、他のすべての未マージの PR と比較されます(`gh pr list --state open --limit 1000 --json number,headRefOid,files`。PR 自身は head の sha または `--pr` でスキップされます)。100 ファイルを列挙する PR は GitHub によって切り詰められるため、その完全な一覧は `gh api --paginate` で取得されます。クエリの失敗、1000 件の列挙された PR、または取得できないファイル一覧は、`MIGRATION_COLLISION: unknown (...)` となり、`not-needed` をブロックします([`MIGRATION_COLLISION`](troubleshooting.md#migration-collision) を参照)。

<a id="gbrain-worked-configs"></a>
## gbrain の設定例

gbrain は、新しいキーを読む gstack が出荷された後に、これらを master にコミットします(古い gstack は未知のキーを拒否します)。gbrain の `.gitignore` は今のところ `.gstack/*` を無視しているため、この変更では `!.gstack/pregate.json` と `!.gstack/ship-policy.json` も追加されます。どちらの変更も gbrain 側のものです。

`.gstack/pregate.json`: インポートグラフからは見えないゲートのためのガードです。

```json
{
  "dependencies": {
    "test/**/*.serial.test.ts": ["test/scripts/serial-files.test.ts"],
    "scripts/serial-files.tsv": ["test/scripts/serial-files.test.ts"],
    "src/cli.ts": ["test/cli-goldens.test.ts"],
    "src/commands/**": ["test/cli-goldens.test.ts"],
    "src/core/operations*.ts": ["test/cli-goldens.test.ts"]
  },
  "guards": [
    { "id": "serial-manifest", "when": ["test/**/*.serial.test.ts", "scripts/serial-files.tsv", "scripts/run-serial-tests.sh"],
      "command": "bun test test/scripts/serial-files.test.ts",
      "fix": "add the serial file's row to scripts/serial-files.tsv" },
    { "id": "cli-goldens", "when": ["src/cli.ts", "src/cli/**", "src/commands/**", "src/core/operations*.ts", "src/core/ops/**"],
      "command": "bun test --timeout=60000 test/cli-goldens.test.ts test/cli-dispatch-phase.test.ts test/export-surface-golden.test.ts",
      "fix": "bun run regen:all, then justify each changed golden in the PR body" },
    { "id": "regen-check", "when": ["src/**", "skills/**", "templates/**", "plugin/**"],
      "command": "bun scripts/regen-all.ts --check",
      "fix": "bun run regen:all and commit the regenerated files" },
    { "id": "migration-order", "when": ["src/core/schema-migrations/**"],
      "command": "bun scripts/check-schema-migration-order.ts",
      "fix": "renumber the migration to the next free number on master" }
  ]
}
```

`.gstack/ship-policy.json`: スタンプのルールとマイグレーションです。gbrain の master ツリーを 0.60.188.0 から 0.60.189.0 へ純粋に再スタンプする場合、このポリシーの下で、ツリーの受領書は変更された 16 個のファイルすべてをスタンプとして分類します。`src/core/behavior-change-notice.ts` に追加された行は、変更のままになります。

```json
{
  "bump": "patch",
  "queue_mode": "stamp-at-merge",
  "changelog": "CHANGELOG.md",
  "stamp_files": [
    "VERSION", "package.json", "CHANGELOG.md", "openclaw.plugin.json",
    ".claude-plugin/plugin.json", ".codex-plugin/plugin.json",
    "plugin-variants/*/.claude-plugin/plugin.json", "plugin-variants/*/.codex-plugin/plugin.json",
    "plugin-variants/*/README.md", "plugin/README.md",
    "BOOTSTRAP_FOR_AGENTS.md", "templates/bootstrap/template-repo/README.md",
    "src/core/behavior-change-notice.ts"
  ],
  "stamp_patterns": [
    "\"version\": \"{version}\"",
    "since: '{version}'",
    "<!-- gbrain-plugin-tree-stamp: {version} -->",
    "<!-- gbrain-template-stamp: {version} -->",
    "<!-- gbrain-runbook-stamp: {version} -->"
  ],
  "migrations": { "dir": "src/core/schema-migrations", "id": "^v(\\d+)-" }
}
```

gbrain の `bun run release:restamp` は master を取得し、独自のバージョンを選び、dirty なツリーを拒否してコミットするため、現状のままでは `restamp_command` にはできません。上のスタンプのルールにより、gstack 独自の再スタンプの書き込み処理がその作業を行えます。バージョンを受け取り、スタンプだけを書き込む gbrain のモードがあれば、それも可能になります。

gbrain-evals の `.gstack/pregate.json`: sealed のパスです。以下のグロブは、ガードが読む形に合わせたプレースホルダーです。gbrain-evals は、自分の held-out とトランスクリプトのレイアウトを入れてください。

```json
{ "sealed": {
    "paths": ["heldout/**"],
    "transcripts": ["runs/**/transcript*.jsonl"],
    "answer_markers": ["SEALED ANSWER:"],
    "seed_patterns": ["shuffle_seed=\\d+"],
    "local_paths": true } }
```

<a id="issue-links"></a>
## `gstack-issue-links`

```
gstack-issue-links [--base <ref>] [--issue <n>]... [--ci-run <id>]... [--supersedes <pr>]... [--credit <pr>]...
                   [--no-auto-links] [--author <login>] [--repo <owner/repo>] [--out issues.json] [--json]
```

`origin/<base>..HEAD` を読み取ります。`Fixes #N` は、明示的に閉じる意図がある場合だけ付きます。つまり、`Fixes`/`Closes`/`Resolves #N` のトレーラー行、または `--issue N` です。単なる言及(件名の `(#N)` を含む)、部分的な修正、先送りされた依頼、そしてすべての別リポジトリの `owner/repo#N` は `Refs` になります。同じリポジトリ内の参照は、昇格候補として出力されます(stderr に `reference #N ← <commit line> (promote: fix #N)`、`--json` では `candidates`)。所有者が返信した `fix #N` は `--issue N` 付きで再実行されます。無人の実行では、それらは `Refs` のままで、ハンドオフに一覧表示されます。各閉じ issue は `gstack-issue-guard` を通して読まれます。読めないものは `Refs #N (unreadable …)` となり、`ISSUE_UNREADABLE`(終了コード 1)を出します。決して `Fixes` にはなりません。

各 `--ci-run <id>` は、その ID を本文に含む未解決の issue の中から検索され、そのリポジトリのボットが開いた issue であり、その実行を名指ししており(`flake:json` の `first_seen.run_id`、またはこのリポジトリの `actions/runs/<id>` の URL)、かつテスト(`flake:json` の `file › test`、または `Flake: <test>` のタイトル)を持つ場合にのみ、`Flake: #N (run <id>)` として表示されます。同じテストに対する二つの issue があれば、小さい番号を残します。拒否された一致はすべて、その理由とともに表示されます。

このブランチ以外の、他の作者による未マージの PR(このブランチではなく、この PR の作者でもないもの。`--author`、なければ `gh` の閲覧者。閲覧者が `capy-ai[bot]` のようなアプリの場合は HEAD コミットの GitHub ユーザー、なければユーザーが所有するリポジトリの所有者、それもなければ `ISSUE_LOOKUP_FAILED`)で、その閉じ集合がこの PR の `Fixes` と重なるものは、`Related: #N (@author)` になります。これは各 issue の閉じる PR の参照をページごとに読み込んだものです。無人の実行でも同様です。`Supersedes #N` はその行を置き換え、`Contributed by @author`(`lib/contributor-mode.ts` のクレジット行)は、所有者が確認した後に、`--supersedes N` / `--credit N` を指定した場合にのみ追加されます。
`--no-auto-links` は検索を省略します。検索が失敗した場合は `ISSUE_LOOKUP_FAILED` を表示し、他の行は残します。stderr のプレビューには、各行の出どころが示されます。

表示された行は PR 本文の `## Issues` の下に入ります。`--out` は、`gstack-ship-receipt write --issues @file` が埋め込むオブジェクト(`fixes`、`refs`、`flakes`、`related`)を書き出します。`--body` を指定すると、それらの行のいずれかが欠けた本文は、その書き込みで拒否されます(`ISSUE_LINKS_MISSING`)。
