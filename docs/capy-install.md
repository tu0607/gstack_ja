# Capy クラウドマシンへの gstack のインストール

3つの層があり、それぞれを gstack が担当します。

| 層 | 場所 | 役割 |
|---|---|---|
| ブートストラッパー | `capy/skill/gstack/scripts/install.sh`(オーナーの Drive のスキルフォルダに一度コピーされ、固定される) | 存在しなければ clone する。origin のデフォルトブランチを取得し、`FETCH_HEAD:capy/support.env` からサポートされる最小バージョンを読む。インストールモードでは、最小バージョンより古く、クリーンでピン留めされていないチェックアウトを fast-forward する。完全なラッパーを exec する |
| 完全なラッパー | `bin/gstack-capy-session`(チェックアウトとともに移動する) | セッション開始を、インストーラーへの対応づける。`--check` は認証する(origin より遅れているチェックアウトも報告する)。それ以外の場合は、origin より遅れているチェックアウトを fast-forward する(`bin/gstack-upgrade --ff-only-no-reinstall`)。その後、インストールまたは修復する |
| インストーラー | `bin/gstack-capy-install` | Bun、両方のホストプロファイル、doctor、インストールの判定、起動行、トレーラーを担当する |

Capy エージェント向けに同梱されたスキル(`capy/skill/gstack/SKILL.md`)が、これらの使い方を説明します。Drive のフォルダはミラーです。オーナーが求めたときに `capy/skill/gstack/` をそこにコピーします。Drive への自動的な書き込みは行われません。

Drive のスキルを使わない直接の利用(サブエージェントやレビュー用マシン)では、ブートストラッパーが解決したルートに clone し、そのうえでチェックアウト自身のブートストラッパーを絶対パスで、プロジェクトのディレクトリから実行してください。そうすると、最小バージョンのチェックと fast-forward が実行され、判定はその呼び出し元のプロジェクトに紐づけられます。同じコマンドで、以降のすべてのセッションも処理できます(既存のチェックアウトは再 clone されず、fast-forward されます)。

```bash
test -f "$HOME/.local/share/gstack/setup" || git clone --quiet --single-branch --depth 1 https://github.com/garrytan/gstack.git "$HOME/.local/share/gstack" && GSTACK_CAPY_ROOT="$HOME/.local/share/gstack" bash "$HOME/.local/share/gstack/capy/skill/gstack/scripts/install.sh" --for autoplan
```

この文面は `lib/doctor-components.ts` の `capyBootstrapCommand` から来ています(Bash では `gstack_capy_bootstrap_cmd`)。未インストール時の修正行は、確認したルートとともにこの文面を出力します。

## レビュー用マシン: `--for review-voice`

派遣されたレビュアー(/autoplan の一つの声、セカンドオピニオン)は、プランを読んで報告するだけで、ワークフローは実行しません。`--for review-voice` を使うと、そのマシンに数秒で本物のトレーラーが得られます。clone または fast-forward を行い、Bun を gstack 自身のサポートされる最小バージョンに揃えます(プロジェクトのピンは適用しません。リポジトリのテストはそこでは実行しないため、トレーラーには `pins: skipped (helper runtime)` と表示されます)。`./setup` は実行せず、ホストプロファイルも bun のシムも作りません。doctor が認証するのは読み取り専用のヘルパーだけです(`PASS helpers`: `gstack-pregate sealed`、`gstack-plan-reality`、`gstack-artifact`、および `gstack-autoplan` の `status` や `contract` などの読み取り)。その判定はホストプロファイルをカバーしないため、そこで開始されたワークフローは拒否されます(`INSTALL: fail verdict — … (review-voice certifies only the read-only helpers); fix: run GSTACK_CAPY_ROOT=<root> bash <root>/capy/skill/gstack/scripts/install.sh --for <skill> …`)。review-voice のチェックは、同じ HEAD とプロジェクトに対して、より完全なインストールが書き込んだ ok の判定を置き換えることはありません。/autoplan のレビュアーのプロンプトはすべて、このコマンド(`GSTACK TRAILER`)で終わります。ウォームな実行の予算(20 秒未満)は `test/capy-review-voice.test.ts` で計測されます。

## セッション開始時

1. `bash <skill>/scripts/install.sh --check --for <skill>` を実行します(チェックアウトが存在すれば 1 秒未満)。これはリファレンスを取得するだけで、チェックアウトは決して移動させません。チェックアウトがない場合は `gstack: fail not-installed — ...` と表示され、セッションはその行を記録し、gstack のワークフローを実行しない場合は続行します。最初のワークフローの直前にインストールしてください。
2. トレーラーが `gstack: fail revision ...` または `gstack: fail runtime ...` で、かつチェックアウトが存在する場合は、同じコマンドを `--check` なしで実行してください。最小バージョンより低く、リモートのデフォルトブランチ上のクリーンなチェックアウトは、fast-forward され(`gstack-capy-skill: upgraded <old> -> <new>`)、再インストールされ、`.gstack-capy-install.lock` の下で一つのトランザクションとして再チェックされます(ブートストラッパーがロックを保持し、`GSTACK_CAPY_LOCK_HELD=1` で引き渡します)。ピン留めされている(`--revision`、detached HEAD、別のブランチ)、ダーティ、または分岐しているチェックアウトは決して移動されません。トレーラーに原因と正確なコマンドが示されます([REVISION_BELOW_MINIMUM](troubleshooting.md#revision-below-minimum))。`GSTACK_CAPY_AUTO_UPGRADE=0` を指定すると fast-forward は無効になります。
3. 最小バージョンは下限であり、更新の契機ではありません。最小バージョンより上でも、origin のデフォルトブランチより遅れているチェックアウトは、インストールモードのセッション開始時に移動されます。完全なラッパーは `bin/gstack-upgrade --ff-only-no-reinstall` を実行します(`gstack-upgrade` のすべての拒否条件が適用されます)。`SELF_UPGRADE: done <old> -> <new>` と表示し、新しいチェックアウトのラッパーを re-exec します。そのラッパーは新しいリビジョンからインストールします(`GSTACK_CAPY_UPGRADED_FROM` が設定されるため、セットアップは決してスキップされません)。拒否された場合は `SELF_UPGRADE: skipped (<reason>)` と表示され、そのセッションが ok と認定されることは決してありません。トレーラーは `gstack: fail behind — installed <rev> is <n> commits behind origin (latest <ver>) and the session-start upgrade was skipped: <reason>; fix: <command> (UPGRADE_BUSY|UPGRADE_REFUSED)` となり、終了コードは 1 です。何も先行していない場合は `SELF_UPGRADE: none (current)` と表示されます。`GSTACK_CAPY_SELF_UPGRADE=off`(または `GSTACK_CAPY_AUTO_UPGRADE=0`)を指定すると `SELF_UPGRADE: disabled (<variable>)` と表示されます。`--check` はチェックアウトを決して移動させません。origin より遅れている場合は `gstack-capy-session: behind origin/<branch>: <installed> -> <remote> (<n> commits); fix: bash <skill>/scripts/install.sh [--for <skill>] (fast-forwards)` と表示され、エージェントはその修正を実行します。セッションが origin より遅れたまま終わった場合(`--check`、または fast-forward がスキップされたか無効化された場合)は、ok のトレーラーにもそのことが書かれます。レーンはトレーラーだけを中継するためです: `behind=<n> (latest: <ver>); fix: <command>`(下のトレーラーの文法を参照)。
4. フェッチが失敗した場合(オフライン)は、ブートストラッパーが `remote minimum unknown (fetch failed)` と表示し、ローカルのインストールだけをチェックします。最小バージョンを主張することはなく、何も fast-forward されません。

アップグレードの対象は、常にデフォルトブランチの先端です。そこにあるすべてのコミットは、CI を通過した、タグ付きのリリースです。復旧は後戻りではなく前進します。fast-forward の後にインストールが中断された場合、トレーラーは `fail` のままになります。次のインストールまたは `bin/gstack-upgrade` の実行が、保留中のインストールの段階を完了させるか(fast-forward の後にセットアップが省略されることはありません)、原因を示して拒否します。古いコミットへのチェックアウトは、サポートされたロールバックではありません。すでに実行されたセットアップのマイグレーションは元に戻りません。

最小バージョンの間では、`bin/gstack-upgrade --check` が `current <v>` または `behind <installed> -> <remote> (<n> commits)` と表示します。`bin/gstack-upgrade` は fast-forward し、再インストールします(Capy のインストールでは `bin/gstack-capy-install`、それ以外では `./setup --refresh-registered`)。ダーティ、分岐、またはピン留めされたチェックアウトは拒否され([UPGRADE_REFUSED](troubleshooting.md#upgrade-refused))、stash やリセットは決して行いません。

一つのチェックアウトを複数のエージェントで共有している場合(一台のマシンで 8 つの Capy サブエージェント)、それぞれがワークフローのリースを保持します。`bin/gstack-skill-start` を実行するたびに、`<git dir>/gstack-leases/<harness pid>` が更新されます(`bin/gstack-lease touch`。120 分を過ぎると削除されます)。各リースには、そのプロセスの開始時の識別情報が記録されます(Linux では boot ID と `/proc` の開始時刻、それ以外では `ps -o lstart`)。pid は再起動やマシンのスリープからの復帰後に再利用されることがあるためです。`bin/gstack-upgrade`、そしてセッション開始時の自動アップグレードは、自分のチェーンの外にある生きたプロセスが保持するリースが存在する間は、[UPGRADE_BUSY](troubleshooting.md#upgrade-busy) を出して拒否します。その際、保持者を `pid <p> (<age>m <command>)` の形式で一覧します。リースの pid がすでに別のプロセスのものになっている場合、または 120 分を過ぎた古い gstack の識別情報なしのリースは、古いとみなされます。`bin/gstack-lease live` がそれを回収します(`gstack-lease: reclaimed stale lease …`)。古いと判断するには証拠が必要です。同じバックエンドから得た、整った二つの識別情報が異なっていることです(`ps` は `LC_ALL=C TZ=UTC0` の下で読まれます)。識別情報が読めない場合、レコードが不正な場合、バックエンドが変わった場合は、リースは保持されます。`touch`(名前の変更による公開、削除)と回収(再読み込みしてから、古いと判断したレコードだけを削除)は、リースディレクトリ内の一つのロックの下で実行されます。このロックは、保持者の pid と開始時の識別情報を名前に含むシンボリックリンクです。そのため、更新が削除されることはなく、生きたリースが同時のスキャンから消えることもありません。ロックが破られるのは、その保持者が死んでいるか、pid が再利用された場合だけで、年齢では決して破られません。ロックを壊す側は、二つ目のシンボリックリンクで直列化し、削除する前にロックを再読み込みします。一つの gstack-lease プロセスが強制終了されるのは常に安全ですが、続けて二つが強制終了された場合(一方がロックを保持し、もう一方がそれを壊している最中)は、回収が更新を削除してしまう可能性があります。生きたプロセスがロックを保持している間、`touch` は書き込まずに終了コード 3 で終わります(`gstack-skill-start` は、そのセッションがリースを保持していないと報告します)。回収はそのリースを保持したままにします。`bin/gstack-lease list` は `alive|dead|stale` を表示し、`GSTACK_UPGRADE_FORCE=1` で上書きできます。

## インストーラーの処理内容

1. その中にあるチェックアウトを再利用する(または `--root <dir>` に clone する)。ロックの下で行う。リセットや pull は決して行わない。`--revision <ref>` は新しい clone をピン留めする。別のリビジョンにある既存のチェックアウトは、`requested: <ref> (run <checkout>/bin/gstack-upgrade to move)` というトレーラーの注記とともに再利用される。新しく clone した場合は `cloned <repo> at <sha12> (<version>)` と表示される(ブートストラッパーの clone も、`GSTACK_CAPY_CLONED` を通じて同様)。
2. 事前確認: `git`、`curl`、`node`、`jq`、次に Bun。プロジェクトのピン(`--project <path>`、デフォルトは現在のディレクトリの git のトップレベル)は、doctor 自身のパーサー(`bin/gstack-runtime-pins.ts`: engines、packageManager、`.tool-versions`、`.bun-version`、およびこのプラットフォームの CI の `bun-version:` レーン)で読まれます。このプラットフォームの CI の厳密なピンは代替として扱われます。リポジトリは複数の Bun バージョンでテストする場合があるためです(gstack 自身の CI は 1.4.2 をピンし、一つのジョブは 1.4.3 で実行します)。そのため、いずれか一つの CI のバージョンに一致する Bun であれば CI を満たします。CI の範囲指定と、CI 以外のすべてのピンは、引き続き必須です。一つのリゾルバーが Bun を選びます(`bin/gstack-bun-version.sh` の `gstack_bun_resolve`。`lib/pregate/runtime.ts` の `resolveBun` が TypeScript 側の対応物です)。インストーラー、`--check`、doctor、bun のシム、インストールの受け入れは、すべてこれを使います。候補は、先に適格なものが勝ちます。順番は次のとおりです。プロジェクトの厳密なピンのストアのコピー(ルール `pin`)、インストールのデフォルトのストアのコピー(`default`)、`$BUN_INSTALL/bin/bun`、`~/.bun/bin/bun`(`home`)、次に PATH 上のすべての `bun`。適格とは、実行でき、サポート最小バージョン(1.4.2)以上のバージョンを報告し、プロジェクトのピンを満たすことです。どれも適格でない場合、インストーラーは厳密なリリースのアーカイブを一つダウンロードし、その SHA-256 を `bin/gstack-bun-version.sh` と照合して、バージョン付きのストア `<state root>/runtimes/bun/<version>/bun` に展開します。これは `~/.gstack-runtime.lock` の下で行われます。各バージョンのディレクトリには `bunx -> bun` も含まれます。壊れたエントリは、隙間なく修復されます(ファイルは前のものの上に名前を変えて置かれます)。`~/.bun/bin` には決して書き込みません。アーカイブは、gstack が検証済みのアーカイブを持っている場合、プロジェクトの CI 以外の厳密なピンになります(`GSTACK_BUN_VERIFIED`: 1.4.2、1.4.3)。CI の厳密なピンだけがある場合は、インストールのデフォルトがそのうちの一つであればそれを、そうでなければ検証済みの中で最も高いものを使います。それもない場合は、インストールのデフォルト `GSTACK_BUN_DEFAULT`(1.4.3。最小の 1.4.2 より上で、一つの CI ジョブは軽量の無料ティアをこれで実行します)になります。`GSTACK_BUN_INSTALL_VERSION=<v>` はデフォルトを上書きします。検証済みのアーカイブがないバージョン、または最小バージョン未満のバージョンは、インストールを停止させます([BUN_INSTALL_VERSION_INVALID](troubleshooting.md#bun-install-version-invalid))。CI 以外の厳密なピンがある場合は、そのバージョンだけがそれを満たします。それ以外の厳密なピン(最小バージョン未満、CI 以外の二つの異なるピン、または検証済みアーカイブのないもの)や、gstack の最小バージョンが満たさない範囲指定は、両方の制約を示して停止します([RUNTIME_PIN_CONFLICT](troubleshooting.md#capy-install-runtime-conflict)、終了コード 3)。`./setup` の前に停止します。少なくとも最低限のセキュリティ基準を満たす Bun がない場合は、ピンを読めるように、まずデフォルトをインストールします。

Node も同じルールに従います(`bin/gstack-node-runtime.sh`)。`engines.node`、`.nvmrc`、`.tool-versions`、CI の `node-version:` レーンを使います。CI 以外の厳密なピンは必須で、異なるジョブにある CI の厳密なピンは代替です。条件を満たす最初の node が採用されます。順番は次のとおりです。PATH 上の最初の node(ルール `PATH`)、次に必要な各バージョンについて、gstack のストアのコピー `<state root>/runtimes/node/<version>/bin/node`(`store`)と nvm の `${NVM_DIR:-~/.nvm}/versions/node/v<version>/bin/node`(`nvm`)、そして PATH 上のその他の `node` です。どれも適格でなく、プロジェクトが厳密なバージョンを指定している場合、インストールモードでは `https://nodejs.org/dist/v<version>/` から `node-v<version>-<target>.tar.gz` と `SHASUMS256.txt` をダウンロードします(`GSTACK_NODE_DIST_URL` でベース URL を上書きできます)。アーカイブの SHA-256 をそのリストと照合し、ツリーをストアに名前の変更によって公開します。CI のピンだけがある場合は、最も高いバージョンをインストールします。`/usr/local/bin` と nvm には決して書き込みません。CI 以外の二つの異なる厳密な Node のピンがある場合は、[RUNTIME_PIN_CONFLICT](troubleshooting.md#capy-install-runtime-conflict) で停止します。`--check` は、バージョンを報告し続けてピンを満たす限り、記録された Node を保持します。Node をインストールすることは決してありません。doctor の `pins` の行は、起動時の PATH が与える node を読み取ります。Node が一致しない場合は、読み取った node の情報と、それを修正するインストーラーのコマンドを示します。
3. `./setup --host claude --no-prefix`、次に `./setup --host codex --model gpt-6-astra`。どちらも `--no-browser` 付きです。このまったく同じ HEAD が、同じホスト、モデル、ブラウザのフラグでセットアップされており(成功したセットアップの後に git dir に記録されている)、かつ `gstack-doctor --check` が通る場合は、スキップされます。ウォームな再実行は約 1 秒です。各セットアップは独自の `gstack ready (<host>)` で終わり、インストーラーはその後 `gstack ready (claude, codex)` と表示します。
4. 要求されたワークフロー(`--for <skill>`、`--only <skill>`、または `--require <id,id>`。デフォルトは `claude,codex,patch`)に対して `gstack-doctor --check` を、起動時の PATH で実行します。これにより、トレーラーは Bun のワークフローが実際に動くことを認証します。
5. インストールの判定(スキーマ 2)。`<state root>/install-verdicts/<sha256 of the checkout realpath>/<sha256 of the project realpath, or "none">.json` に、アトミックに書き込まれます。内容は、チェックアウト、プロジェクト、HEAD、認証されたワークフローと必須コンポーネント、ピンがプランニング専用としてスキップされたかどうか、尊重したピン、解決された Bun(`bun_path`、`bun_version`、`bun_rule`、そして今回の実行でダウンロードされた場合は `bun_install`)、プロジェクトがピンを指定している場合は解決された Node(`node_path`、`node_version`、`node_rule`)、トレーラー、リモートの最小バージョン、起動時の PATH、時刻です。受け入れは、実行中の Bun が判定に記録されたものでないワークフローを拒否します([BUN_RESOLUTION_DRIFT](troubleshooting.md#bun-resolution-drift))。事前確認のレーンとガードも同様です。`GSTACK_CAPY=1` の下、または判定が存在する場合はいつでも、不正な判定を拒否します([INSTALL_UNVERIFIED](troubleshooting.md#install-unverified))。`--check` は、記録された Bun が存在する間はそれを保持し、記録されたバージョンを報告し、ピンを満たします。今解決されたら最初に選ばれる候補があれば `note:` の行になります。記録された Bun が消えた、変更された、またはピンを満たさなくなった場合だけ、doctor の `runtime` の行が失敗します。スキーマ 1 の判定(チェックアウトだけをキーとする)も引き続き読まれます。
6. Capy のマシン上(`CAPY_MACHINE_CONFIG` が設定されているか、`~/.capy/system` が存在する場合)では、インストールモードで、以下に説明する bun のシムを書き込みます。

`--check` は、ステップ 4 と 5 だけを実行します(clone、Bun のインストール、セットアップ、シムは行いません)。

## bun のシム

Capy の新しいシェルは、イメージの `/usr/local/bin/bun`(1.3.14)を最初に見つけるため、`GSTACK_LAUNCH` の接頭辞なしで入力された `bun test` は、以前は間違った Bun を実行していました。そのため、インストールモードは `~/.local/bin/bun` と `~/.local/bin/bunx` を書き込みます(Capy イメージの PATH では `~/.local/bin` が `/usr/local/bin` より前にあります)。それぞれは小さな POSIX のスクリプトで、二行目にマーカー `# gstack-bun-shim: gstack-owned; delete this file to remove it` があります。呼び出しのたびに、`bun` のシムは作業ディレクトリを囲む git のトップレベルを見つけ、次の順番で実行します。そのプロジェクトのインストール判定に記録された Bun(プロジェクトの外や gstack のチェックアウト内では `none` の判定)、プロジェクトの厳密なピンのストアのコピー、インストールのデフォルトのストアのコピー、そして `$BUN_INSTALL/bin/bun`、`~/.bun/bin/bun`、およびシムではない PATH 上のすべての `bun` のうち、サポート最小バージョン以上で最初のもの、次にセキュリティの下限以上で最初のものです。ピンが使われるのは、それが `x.y.z` の形式で、そのストアのエントリがストア内の本物のバイナリである場合(`..` がなく、シンボリックリンクで外へ出ず、シムのマーカーのファイルではない)だけです。ストアにない Bun をピンしているプロジェクトは、`gstack bun shim: <root> pins bun <v>, which is not in gstack's runtime store; run ... --check here` と表示します。記録がなく、ピンもないリポジトリは、静かに次に進みます。`bunx` は、その隣にある `bun` のシムを通して `bun x` を実行します。

- `GSTACK_BUN_SHIM_EXPLAIN=1 bun --version` は、`gstack bun shim: project=<root> record=<file> chose=<bun> rule=<rule>` を表示します(記録がない場合はそれを示します)。
- `GSTACK_BUN_SHIM=0` をインストール時に指定すると、シムは書き込まれません。
- 削除するには、`~/.local/bin/bun` と `~/.local/bin/bunx` を削除します。gstack が置き換えるのは、存在しないファイル、またはマーカーを持つファイルだけです。そこにある他人のファイルや壊れたリンクは、注記とともにそのまま残されます。`GSTACK_LAUNCH` の接頭辞が、認証された Bun に到達する方法のままです。
- doctor の `runtime` の行はシムに言及します。リゾルバーは、シムのマーカーを持つファイルを Bun の候補として決して扱いません。

## 確認に使う一行

最後の行がトレーラーです。

```
gstack: ok 1.91.96.0 for=autoplan
gstack: ok 1.91.96.0 for=review (requested: v1.91.90.0 (run <checkout>/bin/gstack-upgrade to move); latest: 1.91.101.0 available)
gstack: ok 1.91.96.0 for=autoplan (pins: skipped (planning-only))
gstack: ok 1.91.101.0 for=autoplan (behind=12 (latest: 1.91.107.0); fix: bash <skill>/scripts/install.sh --for autoplan)
gstack: fail runtime,pins
```

ok のトレーラーには、括弧付きの注記グループが最大一つまで含まれ、`; ` で区切られます。順序は次のとおりです。`requested: …`(`--revision` とは別のリビジョンの既存チェックアウト)、`pins: skipped (planning-only|no project|helper runtime)`、そして `behind=<n> (latest: <ver>)` に続く `fix: <command>` のいずれか(このセッションが、このラン内で成功したフェッチの後、origin のデフォルトブランチより <n> コミット遅れたまま終わったことを示す。`bin/gstack-capy-session` は `GSTACK_CAPY_BEHIND`、`_BEHIND_TO`、`_BEHIND_FIX` を export するため、どのブートストラッパーのリビジョンでも機能する)、または `latest: <ver> available`(origin のデフォルトブランチに、より新しい VERSION がある。ブートストラッパーは、このラン内で成功したフェッチの後にのみ `GSTACK_CAPY_REMOTE_VERSION` として export する)。fail のトレーラーには注記は決して付きません。`^gstack: ok ` または `^gstack: fail ` に一致させてください。バージョンの後の最初の空白より先は、決して解析しないでください。

終了コードが 0 なのは `gstack: ok` の場合だけです。終了ステータスとトレーラーを直接読んでください。

```bash
out=$(bash <skill>/scripts/install.sh --check --for autoplan 2>&1); rc=$?
printf '%s\n' "$out" | grep '^gstack: '
[ "$rc" -eq 0 ]
```

`--check`(またはインストーラー)の出力を、`tail`、`head`、または単独の `grep` にパイプしないでください。パイプの終了ステータスが doctor の終了ステータスに取って代わり、静かな失敗が起きてしまいます。このインストーラーが無くそうとしている問題そのものです。`FAIL <id>` の行にはすべて `fix:` の句と、[troubleshooting の該当アンカー](troubleshooting.md#install-check-gstack-doctor---check-and-the-capy-installer)へのリンク付きの理由コードが付きます。親エージェントは、この grep でサブエージェントのマシンごとに確認します。一台のマシンのインストールが、別のマシンを保証することはありません。サブエージェントの最初の報告には、それぞれ独自の `gstack:` の行が含まれます。

`SKIP pins (planning-only; repo pins differ: ..., launch bun <v>)`(トレーラーの注記 `pins: skipped (planning-only)`)は失敗ではありません。プランニング系のワークフロー(`--for autoplan`、プランのレビュー、`office-hours`)は、対象リポジトリのテストを決して実行しないためです。実行するワークフロー(`review`、`ship`、`qa`)と `--require` は、`pins` を必須のまま保ちます。

レーンが別のスレッドに報告する場合(ハンドオフ、`gstack-lane-check` の結果、コーディネーターの契約)は、メッセージで短い表示コードではなく、完全なスレッド ID(`jam_…`)を保存して使ってください。その コードはアプリが表示するラベルであり、ID こそが別のエージェントが宛先に指定でき、証拠のバンドルに記録されるものだからです。`UBI_OWNER` とレーンの所有記録も、同じ完全な ID を使います。

## ブラウザ

既定のインストールは `SKIP browser (lazy; gstack-browser-ensure installs on first use)` と表示し、何もダウンロードしません。最初のブラウザ系スキルの実行(`/browse`、`/qa`、`/design-review` など)は、その事前確認から `bin/gstack-browser-ensure` を呼び出します。これは、セットアップのロックの下で Chromium(約 115 MiB。Capy のマシンで約 86 秒)をインストールし、`BROWSER_OK` または `BROWSER_UNAVAILABLE <reason>` を表示します。`--with-browser` を指定すると、代わりにインストール中にブラウザをインストールします。その場合、インストーラーは計画専用のインストール時間とブラウザのブートストラップ時間を別々に表示します。

<a id="the-launch-line"></a>
## 起動行

成功したすべての実行(`--check` を含む)は、トレーラーの前に次の行を表示します。

```
GSTACK_LAUNCH: PATH=<dir>:$PATH GSTACK_SESSION_KIND=unattended GSTACK_STATE_ROOT=<path> GSTACK_EPHEMERAL=1 GSTACK_CAPY=1 GSTACK_INSTALL_VERDICT=<file>
GSTACK_LAUNCH_PATH: <dir>
```

`PATH=<dir>:$PATH` と `GSTACK_LAUNCH_PATH` は、認定された Bun、またはプロジェクトの解決された Node が PATH の先頭にない場合にのみ現れます(古い Capy のイメージは `/usr/local/bin/bun` 1.3.14 を含んでおり、57 個の gstack のコマンドは `#!/usr/bin/env bun` で始まります)。`<dir>` が共有の bin ディレクトリになることは決してありません。gstack のストアにある Bun は、自身のバージョンのディレクトリから起動します。それ以外の Bun、または起動に必要な Node は、`<verdict file without .json>.launch` を通して起動します。これは gstack が所有するディレクトリで、`bun`、`bunx`、そして必要な場合には `node`、`npm`、`npx`、`corepack` のシンボリックリンクだけを含みます。そのため、`/usr/local/bin` や `$BUN_INSTALL/bin` にある Bun が、そのディレクトリの他のツール(イメージの node など)を PATH の先頭に押し出すことはありません。事前確認のレーンも、同じディレクトリを通して起動します。子シェルの `export` は、親の後続のコマンドを設定できません。そのため、親はこれらの代入を、起動するすべての gstack コマンドに与えます(コマンドに接頭辞を付けるか、それを実行するシェルで一度だけ export します)。これらのない新しいシェルは、実際に実行する Bun を報告し続けます: `FAIL runtime — bun 1.3.14 at /usr/local/bin/bun ...; verified bun 1.4.2 found at ~/.bun/bin (not on PATH); fix: export PATH="$HOME/.bun/bin:$PATH" or prefix commands with the GSTACK_LAUNCH line`。

`GSTACK_EPHEMERAL=1` は、ディスクがマシンと一緒に消えることを gstack に伝えます。そのため doctor の `state root` の行は `durable=no` と表示し、無人の実行は、黙って書き込む代わりに `learnings: skipped` と表示します。永続的なルートはオプトインです。マシンより長く存続するディレクトリを `GSTACK_STATE_ROOT` に設定してください。インストーラーが Capy のドライブに書き込むことはありません。詳しくは [docs/state-root.md](state-root.md#ephemeral-machines) を参照してください。

`GSTACK_CAPY=1` は、インストールの受け入れを有効にします。無人のセッション(どのホストでも)は、サポートされる最低バージョン未満の Bun では、ワークフローの開始を拒否します。`GSTACK_CAPY=1` のとき、無人または `GSTACK_SESSION_KIND=spawned` のセッションは、さらにこのチェックアウトに対する合格した判定、現在の HEAD、そして開始するワークフローと同じかそれ以上の範囲のワークフローも必要とします。拒否されると `INSTALL: fail ...` と `GSTACK_RESULT: skill=<s> status=refused run=-` が表示され、終了コード 3 で終わります([INSTALL_UNVERIFIED](troubleshooting.md#install-unverified))。環境内のスポーンされたセッション(OpenClaw)は、警告するだけです。`GSTACK_ALLOW_UNSUPPORTED_RUNTIME=1` を指定すると、それでも受け入れ、そのことを表示します。

## Capy のスナップショットに焼き込む

ワークフローを一度も実行しないマシンは、インストールの費用(コールドで約 30 秒)を払うべきではありません。ほとんどのマシンで gstack を実行するプロジェクトは、代わりに焼き込めます。プロジェクトのセットアップの初期化ステップは、次を実行します。

```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.local/share/gstack
~/.local/share/gstack/bin/gstack-capy-install --require claude,codex,patch
```

スナップショットは `$HOME`(チェックアウト、`~/.bun/bin`、両方のホストプロファイル)を取り込みます。その後、各セッションは `--check` の分だけを支払います。焼き込まれたリビジョンも、origin より遅れている場合はインストールモードのセッション開始時に前に進みます。焼き込まれた `~/.bun/bin` は、`GSTACK_LAUNCH` の行を通してワークフローに届きます。プロジェクトのセットアップは、そのプロジェクトのすべてのスレッドで共有されるため、それを変更するかどうかはプロジェクトの判断です。

## キャプテンの下での作業

Capy のセッション(起動行によって設定される `GSTACK_CAPY=1`)では、すべてのワークフローが `CAPY: on` と `capy-asks` ブロックを表示します。決定は Capy を通ります(クルーのスレッドはキャプテンに尋ね、それ以外は本人に尋ねます)。プランの承認は `gstack-owner-brief render --captain` で表示され、回答は `gstack-approvals` で記録されます。また /ship の PR の本文は、before/after の画像(`gstack-pr-shots`)、Why、Approvals で始まります。ガイドは [`capy/skill/gstack/captain.md`](../capy/skill/gstack/captain.md) にあります。`GSTACK_CAPY_ASKS=0` を指定すると、1 つのセッションについて `capy-asks` ブロックを省きます。

<a id="raising-the-supported-minimum"></a>
## サポートされる最低バージョンの引き上げ

`capy/support.env` には `GSTACK_MIN_REVISION` と `GSTACK_CAPY_MIN_WRAPPER` があります。`GSTACK_MIN_REVISION` を引き上げるのは、インストールの正直さやセキュリティの修正に限られます。リリース時のスタンプで、リリースされる VERSION に合わせます。これは、トレーラーが失敗する下限であり、ブートストラッパー自身が fast-forward する基準でもあります(それより上で origin より遅れたチェックアウトは、そのチェックアウト自身のラッパーが fast-forward します。そのため、下限が機械を最新に保っているわけではありません)。VERSION を超えることは決してありません(test/capy-skill-wrapper.test.ts)。`GSTACK_CAPY_MIN_WRAPPER` は、ブートストラッパー自身が古いコピーでは動かない形で変わるとき、ブートストラッパーの `GSTACK_CAPY_WRAPPER` と一緒に引き上げます。古い Drive のコピーは引き続き動き、所有者の対処を求めるメッセージを表示します([CAPY_WRAPPER_STALE](troubleshooting.md#capy-wrapper-stale))。doctor の `wrapper` の行は警告します(最低バージョンを下回る有効なコピーは WARN であり、決して FAIL ではありません)。`bin/gstack-upgrade` は、そのために保留中の再インストールを残すことは決してありません。ラッパー 2 は、オプションの export(トレーラーの `latest:` の注記と `cloned` の行)を追加するだけなので、最低バージョンは 1 のままです。

## 終了コード

| 終了コード | 意味 |
|-----:|---------|
| 0 | `gstack: ok` — 必須のコンポーネントがすべて合格 |
| 1 | `gstack: fail <ids>` — 必須のコンポーネントが失敗。各行に修正方法がある |
| 2 | 使い方のエラー |
| 3 | `./setup` の前に事前確認が停止(`INSTALL_PREFLIGHT_FAILED`、`RUNTIME_PIN_CONFLICT`)。何もインストールされていない |
