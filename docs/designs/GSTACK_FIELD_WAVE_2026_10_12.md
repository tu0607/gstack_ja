# gstack フィールド wave(2026 年 10 月 12 日): 正直なアップグレード、閉じられる無人実行、計画からゲートへの義務

## 緊急、本計画の対象外

計画時点では既知のものはありません。レビュアーがこのブロックを埋めます。

## 実装計画

### 背景

ベース: origin/main `dbf400e`(v1.91.95.0)。入力: gbrain の修正 wave 15 と 16(2026-10-10〜12、gstack 1.91.22〜1.91.94)の間に Capy クラウドマシン上で gstack を動かした GBRA スレッドからのフィールドの証拠、および 12 台のマシンの調査。wave の実行に対するオーナーの承認: Garry、2026-10-12(「start it」)、gbrain のコーディネーターのスレッド経由で伝達。gstack のマージは Garry が行い、この wave は PR を 1 つ開きますが、マージはしません。

この計画を書く前に、すべての項目を 1.91.95.0 で、シミュレートした Capy ホスト上で再現しました(このマシン: Ubuntu 24.04、`/usr/local/bin/bun` 1.3.14、Codex CLI なし、`~/.bun/bin` にある検証済みの Bun 1.4.2 は PATH の外)。証拠は 4 つの調査レポート(レーン A、B1、B2、CD)にあり、重要なものは以下にインラインで引用しています。

main で修正済みで、ここでは検証のみ行ったもの: 項目 6 の新規実行分(#3160、`decisionId` が `<run>-r<rev>-<label>` を発行)。CLI だけで駆動した 3 rev の実行(手書きの結果による `next`/`submit`、`answer "all except d1b"` を 2 回、次に `all`、`export`)は `ARTIFACT_VALID … status=complete` を出力しました。残存する問題: 1.91.94 以前でゲートされた実行を、アップグレード後に export すると、14 件の `ARTIFACT_DUPLICATE_ID` と 6 件の `ARTIFACT_DANGLING_REF` が出ます。`finishGate` が古い行を残す一方(lib/autoplan-gate.ts:111)、`buildTasks` は新しい id を指しているためです(lib/autoplan-export.ts:33)。

再現により前提を修正: 項目 11 の語「doctor」「status」「description」は UI のトリガーではありません。`ui=yes` を設定するのは、`component|form|screen|layout` の非視覚的な用法(lib/autoplan-prompts.ts:23-26、どの語も 2 回ずつ出現)と、レビュー記録の文章です。UI 検出は計画ファイル全体を読みますが(:41)、DX は Implementation の計画だけを読むためです(bin/gstack-autoplan-snapshot.ts:25-26)。

リポジトリの制約: SKILL.md は `.tmpl` から生成されます(`bun run gen:skill-docs`)。新しいロジックは薄い `bin/` のエントリポイントの背後にある `lib/*.ts` に置きます。登録されたモジュールは `test/module-size-ratchet.test.ts` で上限が決められています。`bin/gstack-autoplan-snapshot.ts` と `setup` は増やしません。context-budget とパリティの ratchet はテンプレートの編集に適用されます。テストは docs/test-value-bar.md に従います(文の一致ではなく、構造と機械が読むトークンを検査)。pregate と ship-policy のバリデータは未知のキーを拒否するため(lib/pregate/config.ts:58、lib/ship-policy.ts:158)、利用するリポジトリが新しいキーをコミットする前に、gstack を出荷します。

テーゼ: **Capy 上の親エージェントは、gstack が自分自身について伝えることを信頼でき、自分が開始したものを閉じることができ、手書きの記録を使わずに計画の義務をリポジトリ自身のゲートへ持ち込めます。**

### リリースの約束(ゴールライン)

- **P1. インストール状態は正直で、自己修正する。** すべての修正行は、実在するコマンドを名指しします。セッション開始時に、サポート対象の最低版を下回るチェックアウトは自分で fast-forward し、再インストールして再チェックします。トレーラーが `fail` の間は、ワークフローを拒否します。トレーラーは、ワークフローが実行する Bun と一致します。古い Capy スキルのラッパーは、名前を挙げて拒否されます。
- **P2. 無人の /autoplan 実行は、実行ディレクトリ内で閉じる。** Capy のサブエージェントによってレビューされたフェーズ(自由形式の記録または正規の形式)は `submit` で紐づけられます。アウトサイドボイスのないホストは、それを利用不可としてマークできます。修正された計画は、同じ実行の中で影響を受けたフェーズを開き直します。3 rev の実行は検証されます。再実行では、スコープ、コスト、方向性の質問だけを尋ねます。ユーザーの challenge のデフォルトは、合意しているボイスに従います。
- **P3. レーンが完了を報告する前に、計画の義務がリポジトリの機械的なゲートに届く。** 有料ゲートは、承認の前にドライラン・価格付けされます。再スタンプは、機械によって stamp のみであることが証明されます。封印された出力や eval の出力は、公開リポジトリへ push できるどのマシンにも置かれないようにします(オーナーによる管理、主たる制御)。さらに、ローカルのフックが動く場所では、誤った push を拒否するローカルチェックを置きます。

### 配送の形

1 つの wave PR を `capy/gstack-field-wave` に作成します。PATCH リリース(1.91.96.0、または出荷時に `bin/gstack-next-version` から得られる次の空きスロット)。4 つのビルドレーンが、新しいマシン上で並列に動きます。各レーンは `dbf400e` から分岐した自分のブランチで作業し、VERSION、CHANGELOG、package.json のバージョンに触れずに、二分割されたコミットをコミットします。統合者はレーンのブランチをマージし、生成ファイルを再生成し、スタンプを押し、CHANGELOG を書き、統合されたツリーに対して完全な無料スイートを 1 回実行します。

ファイルの所有(マージを機械的に保つため):
- レーン A は `bin/gstack-capy-install`、`bin/gstack-doctor*`、`bin/gstack-bun-version.sh`、新規の `bin/gstack-upgrade`、`bin/gstack-skill-start`/`gstack-skill-end`(ランタイムのゲートのみ)、新規の `capy/`、`docs/capy-install.md` を所有します。
- レーン B1 は `lib/autoplan-run.ts`、`lib/autoplan-export.ts`、`lib/autoplan-state.ts`、`bin/gstack-autoplan`(`submit`、新規の `revise`)、`bin/gstack-autoplan-snapshot.ts`(`revise`/scaffold のフックのみ、狭く)、`bin/gstack-artifact` を所有します。
- レーン B2 は `lib/autoplan-gate.ts`(`buildGate`、answer/reopen のロジック)、`lib/autoplan-reconcile.ts`、`lib/autoplan-prompts.ts`、`lib/gate-list.ts`、`lib/plan-reality.ts`、`bin/gstack-plan-reality`、`autoplan/` のテンプレート、新規のドライバ文書を所有します。B1 は `lib/autoplan-gate.ts` に新しい関数(`revise` の reopen)だけを追加し、B2 の既存の関数を呼び出します。
- レーン CD は `bin/gstack-pregate`、`lib/pregate/**`、`lib/eval-plan.ts`、`lib/pricing.ts`、`bin/gstack-eval-plan`、`lib/restamp.ts`、`lib/ship-policy.ts`、`lib/tree-receipt.ts`、`bin/gstack-redact-prepush`、新規の `lib/sealed-guard.ts`、`lib/coordinator-contract.ts` を所有します。
- 共有の追記専用ファイル(`lib/result-codes.ts`、`docs/troubleshooting.md`、`docs/unattended.md`、`test/fixtures/module-size-ratchet.json`): 各レーンは自分のエントリを追記し、統合者が解決します。

すべての修正は、まず `dbf400e` 上で失敗するテストとともに入ります。テストはシミュレートした Capy ホスト上で実行します。フィクスチャの PATH には、スタブまたは実物の Bun 1.3.14 を先頭に置き、`codex` は置かず、`HOME`/`GSTACK_HOME`/`GSTACK_STATE_ROOT` は一時的なものにします。既存のアサーションは弱めません。変更される既存のピン留めは、項目ごとに意図的な契約の変更として明記したものだけです。

### レーン A: インストールとアップグレードの正直さ(項目 1〜5)

**A1. `bin/gstack-upgrade` を作り、すべての修正行が実在するコマンドを名指しするようにする(項目 1)。** どのリビジョンにも `bin/gstack-upgrade` は存在したことがありません(`git log --all -- bin/gstack-upgrade` は空)。それでも bin/gstack-capy-install:138、docs/capy-install.md:18、docs/troubleshooting.md:1132、Capy スキル(install.sh:34,55、SKILL.md:40)がそれを名指ししています。`/gstack-upgrade` スキルは無人では実行できません(gstack-skill-start:616 はアップグレードをスキップし、そのフォールバックは AskUserQuestion と `git reset --hard` を使います。gstack-upgrade/SKILL.md.tmpl:166-190)。
- 新規の `bin/gstack-upgrade`(bash 3.2、gstack-capy-install のスタイル): `--check` は(存在すれば `timeout 60` で上限を設けて)fetch し、`gstack-upgrade: current <ver>`(終了コード 0)または `gstack-upgrade: behind <installed> -> <remote ver> (<n> commits)`(終了コード 1)を表示します。何も書き込みません。デフォルトモードは、ディレクトリが gstack のチェックアウトでない場合、HEAD が detached または remote のデフォルトブランチから外れている場合(`--revision` によるピン留め)、スキルの高速パスと同様にレンダリングの痕跡(`SKILL.md`、`*/SKILL.md`、`*/sections/*.md`)だけを捨てた後もツリーが汚れている場合、または到着する Bun の下限が保持されている場合(`gstack_bun_incoming_hold`)に、終了コード 3 で拒否し、何も変更しません。その後 `git merge --ff-only FETCH_HEAD` を実行します。分岐は `UPGRADE_REFUSED`(終了コード 3。stash も reset も決してしない)です。その後、`--capy` が渡された場合は `bin/gstack-capy-install`(setup の前に Bun の事前チェック)、そうでなければ `./setup --refresh-registered` を実行します(マイグレーションは setup の内部で実行されます。setup:3852)。
- 修正の文言: REV_NOTE は `run <root>/bin/gstack-upgrade to move` になります。`_dc_check_revision` の修正は `$SRC/bin/gstack-upgrade` を名指しします(対話的な代替として `/gstack-upgrade` は残します)。gstack-skill-end:46 の `UPGRADE_AVAILABLE` 行は、そのバイナリを名指しします。新しい結果コード `UPGRADE_REFUSED` を、トラブルシューティングのアンカーとともに追加します。
- テスト: 新規の `test/gstack-upgrade-bin.test.ts`(コミット A と B を持つ bare のリモート、A の depth-1 クローン): `--check` は `behind 1.0.0 -> 1.0.1` とともに終了コード 1 で終わり、HEAD は変わらない。デフォルトは HEAD が B の状態で終了コード 0 となり、`setup --refresh-registered` がログに残る。汚れた追跡ファイルと、分岐したローカルのコミットは、それぞれ終了コード 3 で終わり、HEAD、ファイルのバイト列、reflog は変わらない。現状では失敗する: 終了コード 127。静的テストは、トレーラーや修正行が名指しするすべての `bin/<name>` がリポジトリに存在することを検証します。意図的なピン留めの変更: test/gstack-capy-install.test.ts:203(REV_NOTE の文言)。

**A2. サポート対象の最低版を下回るチェックアウトは、セッション開始時に自分でアップグレードし、トレーラーが失敗している間はワークフローを拒否する(項目 2)。** 再現: 1.91.12 のチェックアウト(7fca42ad8)は、`--check` の有無にかかわらず、毎回まったく同じ `gstack: fail installer` の行を出力しました。`--check` はインストーラの実行を求め、インストーラは不足している `bin/gstack-upgrade` の実行を求める、閉じたループです。1.91.71 以上だが古いチェックアウトは、永遠に通過します。これは、リビジョンの行が明示的な `--revision` に対してしか比較しないためです(doctor-check.sh:325)。無人の実行は更新チェックをスキップします(gstack-skill-start:119-123)。実際にインストールされた 1.91.12 のチェックアウトに対して、fast-forward と現行のインストーラを適用したところ、マイグレーション 1.91.19 と 1.91.65 が実行され、最後は `gstack: ok 1.91.95.0` で終わりました(depth-1 クローンの fetch と ff: 3.4 秒)。
- 新規の `capy/support.env`(シェルから読み込み可能、キー 2 つ): `GSTACK_MIN_REVISION=<x.y.z.w>`(インストーラ、トレーラー、修正行が正直である最も古いリビジョン。この wave のリリースに設定)と、`GSTACK_CAPY_MIN_WRAPPER=<n>`。
- Capy スキルのラッパー(A4 で同梱)は、セッション開始時に、`--check` とインストールモードの両方で次を行います。`git fetch --depth 1 origin <default branch>`(上限付き)、`FETCH_HEAD` から `capy/support.env` を読む(古いチェックアウトも、リモートから今日の最低版を知るため)、チェックアウトの VERSION と比較する。最低版を下回り、かつチェックアウトがクリーンで、ピン留めされておらず(`--revision` なし、デフォルトブランチ上)、fast-forward 可能な場合: `git merge --ff-only FETCH_HEAD` を実行し、`bin/gstack-capy-install` を実行し、その後 `--check` を実行して、`gstack-capy-skill: upgraded <old> -> <new>` を表示します。ピン留め済み、汚れている、または分岐している場合は変更せず、トレーラーは `gstack: fail revision — installed <v> is below the supported minimum <min>; fix: <exact commands>`(終了コード 1)になります。fetch の失敗(オフライン)はローカルのチェックにフォールバックし、`remote minimum unknown (fetch failed)` と表示します。誤った ok は決して出しません。これは、最低版を下回るチェックアウトに限って、文書化された「既存のチェックアウトは決して pull しない」という規則を覆します。この覆しはオーナーの要求であり、fast-forward のみなので可逆です(`git checkout <old sha>`)。
- `gstack-doctor --check` に `--min-revision <v>` を追加します(ラッパーはリモートの最低版を渡します)。リビジョンの行は、それを下回ると `REVISION_BELOW_MINIMUM` で FAIL し、ラッパーまたは `bin/gstack-upgrade` を名指しする修正を出します。
- ワークフローの拒否: `unattended` または `spawned` のセッションでは、`gstack-skill-start` が安価な判定(PATH の Bun が、サポート対象の最低版に対して妥当か、チェックアウトの VERSION が、ローカルの `capy/support.env` に対して妥当か)を実行します。どちらかが失敗した場合は、失敗した行とその修正を表示し、`GSTACK_RESULT: skill=<s> status=refused run=-` を出して終了コード 3 で終わります。対話的なセッションは、今の警告を維持します。Capy スキルは、このセッションで `gstack: ok` のトレーラーがない限り、エージェントがワークフローを実行しないよう指示します。
- サブエージェントのずれ: コーディネーターの契約の引き継ぎ形式(lib/coordinator-contract.ts、3 か所でバイト単位で同一にレンダリング)は、最初に「このマシンの `--check` からの `gstack:` トレーラー行」を加えます。同梱のスキルは、サブエージェントの最初の報告が親に対してその行を含むと述べます。
- テスト(先に失敗させる): `test/capy-skill-wrapper.test.ts` は、main が `capy/support.env` を持ち、その最低版がクローンの VERSION より上で、スタブのインストーラを持つ bare のリモートを組み立てます。同梱のラッパーを `--check` 付きで実行すると、fast-forward され、インストーラが実行され、`gstack: ok <new>` で終わる(現状: ラッパーが存在せず、ドライブのコピーは `fail installer` を繰り返す)。汚れたチェックアウトは、コマンドを名指しする `gstack: fail revision` を受け取り、HEAD は変わらない。オフラインのリモートは `remote minimum unknown` と表示する。`test/gstack-doctor.test.ts`: VERSION より上の `--min-revision` は、リビジョンの行を FAIL させる。`test/gstack-skill-start.test.ts`(または既存のセッション種別のテストファイル): PATH の先頭にスタブの Bun 1.3.14 を置いた無人の実行は `status=refused` を表示する。
- 実機での受け入れ(この wave の完了基準): このマシン上で、`~/.local/share/gstack` にある実物の 1.91.12 のチェックアウト(先に脇へ移し、後で復元)が、同梱のラッパーを経由して、デフォルトブランチが wave のブランチであるローカルのミラーを指すことで、セッション開始時に wave の head まで自分でアップグレードし、`gstack: ok` で終わる。

**A3. トレーラーは、ワークフローが実行する Bun と一致する(項目 3)。** 再現: 新しいシェルの `--check` は `FAIL runtime` と `FAIL pins` を出すが、インストーラ自身の `--check` は ok と言っていました。インストーラは PATH を自分自身にだけ export し(gstack-capy-install:108)、`GSTACK_LAUNCH`(:145)は PATH を持ちません。57 個の bin は `#!/usr/bin/env bun` を使うため、新しいシェルは 1.3.14 を黙って実行します。また、インストーラは毎回 Bun を再ダウンロードします(PATH の Bun だけを確認し、:91)。`/usr/local/bin/bun` が 1.4.3 で、gbrain の CI のピンが 1.4.2 の場合、トレーラーは `fail pins — bun 1.4.3 outside CI 1.4.2` になり、インストーラは 1.4.2 を決してインストールしません。ピンのパーサ(:79-90)が CI のピンを無視するためです。
- bin/gstack-bun-version.sh に 1 つのヘルパー `gstack_bun_launch_dir` を置きます。`$BUN_INSTALL/bin` と `~/.bun/bin` のうち、gstack の最低版とプロジェクトのピンを満たす Bun を持つ最初のものを返し、なければ空を返します。
- `GSTACK_LAUNCH:` は、そのディレクトリがまだ PATH の先頭にない場合に `PATH=<dir>:$PATH` を含みます。ラッパーの `--check` は同じ PATH でドクターを実行するため、そのトレーラーは `GSTACK_LAUNCH` で起動されたコマンドに対する判定になります。新しいシェルでの素のドクターの実行は、引き続き PATH の Bun を報告します(これが接頭辞なしのワークフローが実行するものです)。ただし、そのランタイムの行は `bun 1.3.14 at /usr/local/bin/bun; verified bun 1.4.2 found at ~/.bun/bin (not on PATH); fix: export PATH="$HOME/.bun/bin:$PATH" or prefix commands with the GSTACK_LAUNCH line` と表示します。ピンの行も同様です。
- インストーラは、再度ダウンロードする代わりに、インストール済みの検証済み Bun を再利用し、`gstack-runtime-pins.ts`(下限より上の任意の Bun で動作)を通じてプロジェクトのピンを読みます。正確なピン(engines またはこのプラットフォームの CI レーン)が、gstack が検証済みアーカイブを持つバージョンと一致する場合は、そのバージョンを `$BUN_INSTALL/bin` にインストールし、PATH 上の別の Bun と並べて置きます。それ以外の正確なピンは、両方を名指しする `RUNTIME_PIN_CONFLICT` で停止します。共有の bin ディレクトリへのシンボリックリンクは作りません(マシン上のすべてのプロジェクトのシステムの Bun を覆い隠してしまうため)。
- テスト: test/gstack-capy-install.test.ts: Bun をインストールした後、`GSTACK_LAUNCH: PATH=<home>/.bun/bin:$PATH GSTACK_SESSION_KIND=unattended …` となる(現状: PATH なし)。2 回目の実行はダウンロードしない(現状: curl が 2 回)。スタブの PATH Bun 1.4.3 と CI のピン 1.4.2 では、`bun-v1.4.2` をダウンロードし、その PATH で起動する(現状: curl なし)。test/gstack-doctor.test.ts: PATH の Bun 1.3.14 と、`$HOME/.bun/bin` にある検証済みの 1.4.2 では、`found at` と `not on PATH` を含むランタイムの FAIL 行になり、launch の PATH を使うと PASS になる。

**A4. 古い Capy スキルのラッパーは、名前を挙げて拒否される(項目 4)。** Capy スキルのコピーはリポジトリに一度も存在しませんでした。Drive には現行版しか残らないため、10-07 のコピー(1,667 バイト、旧来の「skills … are ready」行)は復元できません。
- 正準のスキルを `capy/skill/gstack/SKILL.md` と `capy/skill/gstack/scripts/install.sh` として同梱します(先例: `openclaw/skills/`)。Drive のフォルダはミラーとなり、オーナーが求めたときにこのディレクトリをコピーして更新します。何も Drive へ自動で書き込みません。
- ラッパーは最初に `gstack-capy-skill: wrapper <n> (<path>)` を表示し、`GSTACK_CAPY_WRAPPER_REV=<n>` をインストーラとドクターに渡します。`gstack-capy-install` は、そのリビジョンがチェックアウトの `capy/support.env` の `GSTACK_CAPY_MIN_WRAPPER` を下回る場合に拒否します: `gstack: fail wrapper — Capy skill wrapper <n> is older than this checkout's minimum <m>; fix: copy <root>/capy/skill/gstack/ over the skill folder (CAPY_WRAPPER_STALE)`、終了コード 1。未設定は直接呼び出しを意味し、許可されます。
- インストーラを呼び出すには古すぎるラッパーは、チェックアウトからは捕捉できません。同梱の SKILL.md は、それを捕捉する規則を明記します。このセッションに `^gstack: ok` の行がなければ、インストールされていないとみなします。
- テスト: `test/capy-skill-wrapper.test.ts`: 最初の行がラッパーの行である。フィクスチャの最低版 99 では、`gstack: fail wrapper` となり終了コード 1 になる。`bash -n` が通る。ラッパーのリビジョンがチェックアウトの最低版以上である。同梱の SKILL.md が名指しするすべてのコマンドが `bin/` に存在する。

**A5. 一度もワークフローを実行しないマシンは、インストールの費用を払わない(項目 5)。** ここで測定した冷えたインストールは 32.5 秒でした(GitHub のクローン 7.2 秒、Bun 2.6 秒、`bun install` 10.6 秒、ビルドとレンダリング約 3 秒、残りの claude のセットアップ 6.5 秒、codex のセットアップ 2 秒)。温まった再実行は 13 秒です。フィールドで見られた 52 秒は、より遅いマシン上で同じフェーズを実行したものです。
- インストーラは、要求されたワークフローについて、このチェックアウトとリビジョンで `gstack-doctor --check` がすでに通っている場合、両方の `./setup` の実行をスキップし(温まった再実行は約 1 秒)、インストール済みの Bun を再利用します(A3)。
- 同梱の SKILL.md はインストールを遅延させます。セッション開始時に `--check` を実行し(1 秒未満。チェックアウトがあれば A2 のアップグレードを行います)、チェックアウトがない場合は `gstack: not installed (no workflow yet)` を記録し、最初のワークフローの直前にインストールします。Garry のユーザースコープの AGENTS.md は、チェックが失敗したらインストーラを実行するよう述べています。この wave は、Garry 向けの一文の修正案をコーディネーターに報告しますが、そこ自体は変更しません。
- docs/capy-install.md に「Capy のスナップショットに焼き込む」を追加します。プロジェクトの Setup の初期化ステップで、クローンと `gstack-capy-install --require claude,codex,patch` を実行します。スナップショットは `$HOME` を捕捉します。A2 があれば、焼き込まれたリビジョンもセッション開始時に前へ進みます。A3 があれば、焼き込まれた `~/.bun/bin` は `GSTACK_LAUNCH` を通じてワークフローに届きます。
- テスト: 1 つのフィクスチャに対する 2 回のインストーラ実行で、setup のログが残るのは 1 回目だけ(現状: setup の呼び出しが 4 回)。意図的なピン留めの変更: デフォルトインストールのテスト(:86-105)は、最初の実行の前に失敗するドクターのスタブを受け取り、新しいチェックアウトで setup が実行されることを引き続き証明するようにします。

### レーン B1: 閉じられる実行(項目 6、7、9)

**B1a. 3 rev の実行は、1.91.95 より前にゲートされたものを含めて検証を通る(項目 6)。** `exportRun` は、書き込み前に、レガシーな decision id を書き換えます(`gate_rev > 1` で、id に `-r<rev>-` を含まない行)。書き換えは `decisionId` を通します。また、`deviations: legacy decision ids rewritten (<n>)` を記録します。これは安全です。それらの実行は一度も検証を通ったことがなく、`ack` は無効な実行を拒否するため(bin/gstack-artifact:87-91)、古い id を保持する利用者はいないからです。テスト: 新しいエンドツーエンドの CLI テストが、3 つのゲートのリビジョンを `next`/`submit`/`answer`/`export` で駆動し、`gstack-artifact validate` が終了コード 0 で、decision、finding、task、attempt の id が一意であることをアサートします(#3160 の回帰ピン)。このバージョンで export された、レガシーな rev 2 の id を持つフィクスチャが検証を通ること(現状: 重複 id が 14 件)。

**B1b. `submit --record` は、Capy のサブエージェントがレビューしたフェーズを閉じる(項目 7)。** 今日、親を止めている要因は 4 つあります。`INPUT:` の受領記録が必須であること(lib/autoplan-run.ts:207-208)、findings の囲みが必須であること(:209)、`--attempt` が必須であること(bin/gstack-autoplan:99。ただし、フェーズとボイスごとに開けるのは 1 つの attempt だけです)、そして CLI がアウトサイドボイスを利用不可とマークできないこと(`markOutside` は `run` からしか到達できません。bin:141)。そのため、Codex のないホストでは、フェーズが `awaiting_result` のまま永遠に止まることがあります。`review-record.md` を手で書いても何も起きません。export が再生成し、validate は `run.json` を読むためです。
- `gstack-autoplan submit --out <dir> --phase <p> --voice native|outside --record <file.md> --model <id> [--attempt <id>]`。実行ロックのもとで、そのフェーズとボイスに対して開いている唯一の attempt に紐づけます(開いているものがちょうど 1 つのときは `--attempt` は任意)。`next` がまだ開いていないフェーズは、実行すべき `next` のコマンドとともに拒否されます。`--voice` は native|outside のままで、`--model` はモデルを指定します。既存の経路に合わせます。現場の要求にある `--voice <model>` は `--model` で代替します。
- 受領記録: `INPUT:` の行はスナップショットと一致しなければなりません。行がない場合、その記録は `receipt: attested` として紐づけられます(スタンプは押さない。スタンプを押すと検証済みの受領記録を偽造することになるため)。ボイスがそれを記録し、レビュー記録には逸脱の行が表示されます。validate は `attested` を終端として扱い、一覧に出します。
- findings: 囲みのブロックがあればそれを使う。なければ severity と title の列を持つ markdown の表。なければ severity のタグ付きの箇条書き(`- [High] title`)。それもなければ明示的な `No findings.` の行。それ以外は、受け入れられる形を名指しする `RESULT_FINDINGS_MISSING` で拒否されます。パーサは severity を推測しません。
- `submit --voice outside --unavailable "<reason>"`(および `--failed`)は `markOutside` を呼び、`coverage=native_only` でフェーズを閉じます。
- 最後のフェーズが閉じると、`submit` は今と同様にゲートを書き込みます。その後、`answer` と `export` で実行を完了します。`--result` の経路は変わりません(test/autoplan-run-recovery.test.ts:44-75 の拒否のピンはそのまま残ります)。
- テスト: 3 つのフェーズが、`--record` で `--attempt` なしに自由形式の記録(一つは表、一つは箇条書き、一つは `No findings.`)を紐づけ、あるフェーズでアウトサイドを利用不可とマークした実行が、`gate_pending` に到達し、`all` に回答し、export して validate を通ること。`INPUT:` が一致しない記録は拒否されること。findings の形のない散文は拒否されること。

**B1c. `revise --plan <v2>` は、同じ実行の中で影響を受けたフェーズを開き直す。2 つのセクションのないプランは、拒否されず足場を組まれる(項目 9)。** 再現: プランを編集して `d1b` に答えた後、再実行は同じスナップショットを使った。CEO の後の編集は、スナップショットが存在するとすぐ `openPhase` が戻るため Eng に届かない(lib/autoplan-run.ts:117)。実行は、init で一度だけ書かれたプライベートの `plan-active.md` しか読まない(:73-75)。2 つのセクションのうち片方だけのプラン、見出しの重複や逆順、空のセクションは、終了コード 1 で標準出力が空、結果コードなしで終了する(プレーンな Error は bin:217 をすり抜ける)。空のセクションは件数エラーとして誤報される(gstack-autoplan-snapshot.ts:413-418)。

- `gstack-autoplan revise --out <dir> --plan <v2> [--json]`: v2 を init と同じように正規化し、`plan-active.md` をアトミックに置き換える(復元ポイントは変えない)。両方のハッシュとともに `plan_revised` をジャーナルに記録する。開かれたフェーズのうち、スナップショットが v2 のフェーズごとのスナップショットと異なるものすべてと Eng を開き直す。開いている試行は `--redispatch` と同じく置き換えられる。`gate_pending` では `p1d` の回答として記録し、`gate_rev` を増やす。スコープはフェーズを追加できるが、削除はできない。アーカイブには `.v<k>` の接尾辞を付け、上書きを防ぐガードを付ける(今は `reopenPhases` が `renameSync` でアーカイブし、黙って上書きする)。`REVISED: plan=<sha12> reopened=<phases>` と結果の行を表示する。
- ドリフトのヒント: `plan_source` が最後のスナップショット以降に変わった場合、`next` は `PLAN_CHANGED: <source> differs from the reviewed plan; run gstack-autoplan revise --out <dir> --plan <source>` を表示する。返答がフェーズを開き直すとき、`answer` は同じものを `PLAN_SOURCE_CHANGED` として表示する。
- セクション: 最初の `next` は、正確な問題と `--scaffold` を名指しする修正の行とともに `PLAN_SECTIONS_INVALID`(終了コード 3)を返す。`next --scaffold` は `<out>/plan-source.md` を書き、`## Implementation plan` の下にプランを置き、空の `## Review record` を付ける。ユーザーのファイルには決して触れず、先に進む。曖昧なプラン(見出しの重複や逆順)は、コード付きで今も拒否する。スナップショットの `init` は厳格なまま(test/autoplan-init.test.ts:125-138)。
- テスト: CEO の後の revise は、閉じたフェーズを何も開き直さないが、DX と Eng を v2 のスナップショットで開く(プロンプトに v2 だけの文が含まれる)。`gate_pending` での revise は `gate_rev` を増やし、再実行のプロンプトは v2 を運ぶ。2 回目の revise は 1 回目のアーカイブを上書きしない。Implementation plan だけのプランは、終了コード 3 と `PLAN_SECTIONS_INVALID`、空でない標準出力を出し、`--scaffold` は先に進む。

### レーン B2: ゲートの判断、スコープ、受領、文脈(項目 8、10〜13)

**B2a. 再実行は、スコープ、コスト、方向性のチャレンジだけを上げる(項目 8)。** 再現: `uc2b` に答えると Eng が開き直された。再実行のネイティブボイスがパッケージングのチャレンジを上げ、それが `d1`(「b reopens eng」)になり、`d1b` がリビジョン 3 を作った。原因: どの上書きも、そのフェーズと Eng を開き直す(lib/autoplan-gate.ts:144-151)。どの `user_challenge` の行もゲート項目になり(:78-96)、プロンプトは、マージ、分割、追加、削除のいずれにもそのフラグを求める(lib/autoplan-prompts.ts:73)。再実行のプロンプトはゲートの決定を運ばない(writePrompts、:118-131)。リビジョン 2 は、CEO のフェーズが再実行されなかったのに、回答済みの CEO の項目を再び尋ねる(`buildGate` が閉じた各フェーズを再スキャンする)。Eng は同一のバイト列の入力で再実行された。

- 指摘は、任意の `changes: "scope"|"cost"|"direction"` を持てるようになる。プロンプトは、レビュアーに `changes` があるときだけ `user_challenge` を設定するよう求める。パッケージング、順序、命名、その他の可逆な選択は、エージェント自身の判断とする。
- 2 回目以降のゲートのリビジョンでは、`changes` のない `user_challenge` は `auto` の項目になる。その上書きはどのフェーズも開き直さず(`reopens: false`)、エージェントの判断として記録される。
- 再実行のプロンプトには `DECIDED AT THE GATE` のブロックが付き、回答済みのすべての項目(id、選んだ選択肢、テキスト)を列挙する。これにより、再実行は解決済みの問題を開き直さない。回答は、再実行されなかったフェーズの項目について引き継がれ、再度尋ねられない。
- `answer` は、受け入れられた計画の変更ごとに `APPLY: <decision id> <title> -> <chosen text>` の行を 1 つ表示する。親にプランを修正するよう伝える(B1c があれば `revise` を実行するよう)。
- テスト: 固定の実行で、再実行のネイティブの指摘が `user_challenge` で `changes` がなければ auto の項目になり、それに `b` と答えても Eng は開き直されない(現在: リビジョン 3)。再実行のプロンプトには uc id を含む `DECIDED AT THE GATE` のブロックが含まれる。リビジョン 2 は、リビジョン 1 で回答済みの CEO の項目を、CEO が再実行されなかった場合に再び尋ねない。

**B2b. ユーザーチャレンジのデフォルトは、同意したボイスに従い、その理由を述べる(項目 10)。** すべての `uc` の項目は `recommended: 'a'` を持つ(keep your direction、lib/autoplan-gate.ts:81)。UC を構築するにはすでに両方のボイスが必要なのに、そうなっている。同じ分岐は `disagree` の行も受け入れる。`recommended` だけを変えるのは誤り。gate.json を編集して UC が `b` を推奨するようにし、`all` と返答すると `APPROVED: gate_rev=1 as-is` と表示された。変更は受け入れられたと数えられたが、一度も適用されず、何も再実行されなかった。

- ゲートの選択肢は `changes_plan: true|false` を持つ。reopen と `APPLY:` の決定は、「推奨と異なるか」ではなく、選ばれた選択肢の `changes_plan` によって決まる。
- ボイスが互いを確認した UC は、変更(`b`)を推奨し、根拠を `recommended: b (both voices)` と描画する。意見が割れた場合は `a` を保持し、`recommended: a (plan direction; voices disagree)` と描画する。根拠はゲートの項目(`recommended_basis`)と decisions.jsonl に保存する。
- これは、同意している UC に対して `all` が何を意味するかを変える。今は、すべての方向性を保持する(CHANGELOG は元の方向性が維持されると述べている)。このウェーブの後は、両方のボイスが合意した変更を受け入れ、それぞれを `APPLY:` として表示する。オーナーがまさにこれを求めた。CHANGELOG と docs/unattended.md にそう書き、デフォルトの変更としてコーディネーターに報告する。
- テスト: 確認された UC は `recommended: b (both voices)` と描画される。`all` と返答すると、そのための `APPLY:` の行が表示され、そのフェーズと Eng が開き直される。意見の割れた UC は `a (plan direction; voices disagree)` と描画される。意図的なピンの変更: test/autoplan-answer-invalidation.test.ts の 79、96、140 行付近は、`all` の古い意味をアサートしているため、同等かより強いアサーションで新しい契約に書き換える。

**B2c. スコープは何が変わるかで決まり、フラグは残る(項目 11)。**
- UI の検出は Implementation plan だけを読む(DX と同じ入力)。
- `ui=yes` には描画される面が必要。Implementation plan に `\.(tsx|jsx|vue|svelte|css|scss|html|erb|hbs)\b` または `/(components|pages|views|styles)/` に一致するパスがあるか、少なくとも 3 つの異なる UI 用語があること。それより少ないのは弱い証拠で、今の保守的なセクションのフォールバックは維持するが、Design フェーズは追加しない。`next` は根拠を表示する: `SCOPE: ui=no (terms: component×1; files: none) dx=yes (detected: CLI×1, flag×2)`。
- 軸ごとの出所: `sources: { ui: 'flag'|'detected'|'marker', dx: … }`。`source=ui:flag,dx:detected` と表示する。`--no-ui` は、検出された DX を flag で強制されたものとは、もうラベルしない。
- 新しい `--no-dx`(追加のみ。これがなければ既存の「フラグは DX を有効にするだけ」という振る舞いは変わらない)。
- プランごとに固定: `initRun` は、ソースのプランから `<!-- gstack-autoplan-scope: --no-ui --developer-tool -->` を読む(Implementation plan の外にあるので、スナップショットは変わらない)。CLI のフラグが優先される。フラグが CLI から来て、プランにマーカーがない場合、init はソースのプランファイルの最初の見出しの後にマーカーを追記し、`SCOPE_PINNED: <marker>` を表示する。
- 対話的な経路のスコープは、同じ検出器から来る。`snapshot scope` は一致とともに `uiRequired` を返す。autoplan/SKILL.md.tmpl は、散文の grep の代わりにそれを使う。
- テスト(新規の test/autoplan-scope.test.ts): UI の語が Review 記録にだけあると `ui=false`。component/form/screen があっても UI のファイルがないと Design フェーズはない。`src/components/Settings.tsx` は `ui=true`。`{ui:false}` は `dx:detected` を報告する。フラグのないマーカーは `marker` から `ui=false` を与える。CLI フラグのある実行はマーカーを書く。意図的なピンの変更: test/review-checklists.test.ts:92-105(`source` の行の形)。

**B2d. PLAN_REALITY は、数値ごとに規則の本文と受領を要求する(項目 12)。** 再現: 1 つの受領が 5 つの数値をカバーし、「the decision rule was written first」は規則の本文なしで通った(`verdict=complete`、終了コード 0)。付随するバグ: ドットパス(`.gstack/ship-policy.json:1`、`.github/…`)の受領が認識されない(lib/plan-reality.ts:160)。`unreceipted=` は動いており、退行させてはならない。

- 数値を含む各節には、独自の受領が必要(file:line、スクリプトのパス、または節の中のバッククォートで囲まれたコマンド)。外れは `numbers_unreceipted=<n>` と節のテキストを表示する。
- 決定規則の存在を主張する行(「rule written first」「decision rule」「preregistered rule」)は、規則の本文を引用するかリンクしなければならない(引用ブロック、フェンスのブロック、または file:line)。外れは `unquoted=<n>` を表示する。
- どちらの外れでも、判定は `incomplete`(終了コード 1)になり、修正の行を付ける。`unreceipted=` はその意味と文字列のトークンを保つ。
- 受領の正規表現は、ドットパスを受け入れる。
- `gstack-autoplan submit` は、実行ごとに 1 回、有効なプランに対してチェックを実行し、その判定を run.json に記録する(報告のみ、決して拒否しない)。
- テスト(test/plan-reality.test.ts): 1 つの受領を共有する 5 つの数値は `numbers_unreceipted=4` を与える。規則なしの「the decision rule was written first」は `unquoted=1` を与える。`.gstack/ship-policy.json:1` の受領は数えられる。既存の `unreceipted=` のケースは、JSON に加えて、文字列のトークンそのものもアサートする(うまくいっていたものを保つピン)。

**B2e. Capy がネイティブに使う、コンパクトなドライバーのドキュメント(項目 13)。** Claude 上で ceo+dx+eng を実行する Capy の親は、約 1,800 行(約 28k トークン。SKILL.md 995 行、そのうち 521 行はプリアンブル。加えてフェーズのセクションと、フェーズを閉じるための 3 回の読み込み)を読む。GPT では、1 つの 1,923 行のファイル(約 33k トークン)。ランナーに必要なのは約 106 行(docs/unattended.md:135-240)。

- 新しく生成される `autoplan/DRIVER.md`(テンプレート `autoplan/DRIVER.md.tmpl`、コードの定数を読むリゾルバー: `PHASES`、`FILES`、RESULT FORMAT、ゲートの文法、ループが見られる結果コード、`submit --record` と `revise` のコマンド)。内容: フェーズの順序とスコープのフラグ、next/submit/answer/revise/export のループ、成果物の契約、ゲートのプロトコル、コーディネーターの契約。フック、ガード、プリアンブル、AskUserQuestion の文章は含まない。
- `gen:skill-docs` がそれを書く。既存の鮮度チェックがそれをカバーする。新しいテストは 160 行で上限を設け、フックの用語(`PreToolUse`、`hook`、`AskUserQuestion`、`Skill tool`)を禁止する。ベンダリングされた Capy のスキルと docs/capy-install.md は、Capy をそれに向ける。

### レーン CD: 計画からゲートへ、キューを意識した出荷、封印された出力(項目 14〜17)

**CD1. リポジトリのガードは、レーンが完了を報告する前に pregate で走る(項目 14)。** gbrain のクローンで再現: マニフェストの行のない新しい serial テストは、`check-test-isolation` と gstack-pregate を通った(pregate は新しいファイルだけを実行した)。その後 `test/scripts/serial-files.test.ts` が失敗した。ある op の説明を言い換えた後、pregate は 3,598 のテストを選んだが、`test/cli-goldens.test.ts` は選ばなかった。このテストは CLI をサブプロセスとして起動するため、import グラフからは見えない。pregate は未知のフラグを黙って無視する(`--sealed`、`--against` は通常の pregate を実行した。bin/gstack-pregate:55,62-99)。lanes のチェックは PATH の先頭にある Bun を実行し(lanes.ts:26)、serial のファイルをユニットのプロセス内で実行する(:54)。

- 新しい `guards` のチェック(lib/pregate/checks/guards.ts と config.ts。既存の pregate の設計が名指ししている通り): 設定のエントリ `{id, when: [globs], command, fix}`。変更されたファイルのいずれかが `when` に一致すると、ガードが走る。その失敗は、ガードの id と修正とともに pregate を失敗させる。`dependencies` のエントリは既に glob を追加のテストに対応させている。ガードはマニフェストと golden スクリプトをカバーする。
- 未知のフラグは、使い方とともに終了コード 2 で終わる。lanes のチェックは、存在すれば `gstack_bun_launch_dir`(A3)から Bun を実行し、serial のパターンのファイル(`serial_patterns` の設定、デフォルトは `**/*.serial.test.*`)を独自のプロセスで実行する。
- コーディネーターの契約と docs/unattended.md は、レーンが完了を報告する前に `gstack-pregate` を実行する(変更されたファイルに対するユニット階層と、リポジトリのガード)と述べ、そのハンドオフは `PREGATE:` の行を運ぶ。
- docs/pregate.md(または既存の pregate のドキュメント)に、gbrain の設定の実例を追加する: `scripts/serial-files.tsv`(`test/scripts/serial-files.test.ts`)のガード、CLI のゴールデン(`src/core/operations.ts` または `src/commands/**` が変わったときの `test/cli-goldens.test.ts`)、`bun run verify`。gbrain は gstack の出荷後にそれをコミットする(gbrain の .gitignore の 16 行目は今 `.gstack/` をブロックしている。その変更は gbrain のもの)。
- テスト: 失敗するスクラッチのリポジトリで、`test/**/*.serial.test.ts` のガードは、マニフェストの行なしに serial テストが入ると、ガードの名前を挙げて pregate を失敗させる(現在: 通る)。`gstack-pregate run --bogus` は終了コード 2 で終わる(現在: 0)。

**CD2. 有料のゲートは、計画の承認の前にドライランされ、価格が付けられる(項目 15)。** eval-plan は、行ごと・アームごとに 1 回の呼び出しをモデル化しており(lib/eval-plan.ts:140-171)、ゲートのコマンドを受け取る動詞がない。lib/pricing.ts には `claude-sonnet-5-5` がなく、最新の Sonnet は `EVAL_PRICE_MISSING` で失敗する。

- 新しい `gstack-eval-plan gate --command "<exact gate command>" [--smoke-questions 2] [--cap-usd <n>]`: 環境からすべてのプロバイダーのキーを取り除いた状態(キーなしのドライラン)でコマンドを実行し、`GSTACK_EVAL_DRY_RUN=1` と `GSTACK_EVAL_SMOKE_QUESTIONS=<n>` を設定し、その出力から `GSTACK_EVAL_CALLS: purpose=<p> model=<id> calls=<n> in_tokens=<n> out_tokens=<n>` の行を読む。各行に価格を付け、`GATE_PRICE: total=<usd> calls=<n> purposes=<list>` と、コマンドが表示した前提条件(`GSTACK_EVAL_PRECONDITION: …`)をすべて表示する。コマンドが呼び出しの行を出さない場合は `EVAL_GATE_UNPRICED` で失敗する(コストが不明なゲートは承認できない)。価格のないモデルには `EVAL_PRICE_MISSING`。`--cap-usd` を超える場合は `EVAL_GATE_OVER_CAP`。
- eval-plan の新しいチェック `reservation-fits-cap`: 1 回の呼び出しの入力と最大出力の合計を価格付けし、スモークの上限の下に収まらなければならない(フィールドで黙って拒否された予約)。
- `claude-sonnet-5-5` の価格を、出典の URL と日付を価格表のコメントに付けて追加する。ビルド時にプロバイダーの現在の価格ページを確認した後。出典のない数値は入れない。
- /eval-plan のテンプレートの、プランを承認するステップは、プランが名指しするすべての有料ゲートについて `gate` を実行する(テンプレートの文言は既存のリゾルバーを通す。parity の予算は守る)。呼び出しの行を出すことは、消費側のリポジトリ(gbrain の synopsis のビルド)の変更であり、ここでは行わず、コーディネーターに報告する。
- テスト(test/pricing-eval-plan.test.ts): 2 つの呼び出しの行と 1 つの前提条件を出すスタブのゲートコマンドは、価格が付けられ、一覧に出る。何も出さないスタブは `EVAL_GATE_UNPRICED` を与える。スタブは `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` を見ない。スモークの上限を超える予約は `reservation-fits-cap` に失敗する。

**CD3. 再スタンプは、リポジトリのコマンドに委譲され、スタンプだけであることは機械が証明する(項目 16)。** 再現: gbrain の 0.60.188.0 から 0.60.189.0 への純粋な再スタンプで、tree-receipt は 16 ファイル中 13 ファイルについて `TREE: changed` と言う。`rewriteStamps`(lib/restamp.ts:276-291)は `(was X)`、引用符のない `since: X`、`vX` しか知らず、`since: '…'`、`"version": "…"`、`<!-- …-stamp -->` のコメントを見逃すため。`release_tool: bun run release:restamp` を設定すると、`RESTAMP_RELEASE_TOOL_FAILED` で失敗する。gbrain のツールがダーティなツリーを拒否し(release-restamp.ts:530-533)、gstack が先に VERSION を書くため(lib/restamp.ts:314-321)。2 つのブランチがそれぞれ移行 v240 を追加すると、`LANE_CHECK: clear` と pregate の通過になる。

- ship policy に `stamp_patterns`(書き込み側と tree-receipt の分類器の両方が共有する、1 つのバージョンのキャプチャグループを持つ正規表現。デフォルトは今の 3 つの形式のまま)と `restamp_command`(リポジトリ自身の再スタンプ。gstack が何かを書く前に、クリーンなツリー上でその場で実行する。その後 gstack は受領を実行するだけ)を加える。リポジトリのコマンドの実行は、既存の `--allow-repo-commands` でゲートされ、`release_tool` と同様にベースブランチのポリシーから読む。
- `gstack-pregate --against <gated-head>` は、そのヘッドと HEAD の間で、ポリシーの stamp パターンの下で tree receipt を実行し、`STAMP_ONLY: yes|no files=<n>`(スタンプでない各差分をファイルと行とともに列挙)、`MIGRATION_COLLISION: none|<number> <file> vs <PR #n file>`(`migrations_dir` のポリシーのキーからの移行ディレクトリ。オープンな PR は `gh pr list --json number,files` で、実行ごとにキャッシュ)、`REGATE: needed|not-needed`(スタンプだけで、かつ衝突がない場合にのみ not-needed)を表示する。再ゲートが必要なら終了コード 1 で終わる。`gh` が利用できない場合は `unknown (gh unavailable)` と表示し、決して `none` とは表示しない。
- どのファイルがスタンプのファイルかは、リポジトリのルールである。ワーキングの gbrain のポリシーは、gbrain のツリーのルールが名指しするファイルを正確に列挙する。そのため、それ以外のドキュメントの `vX` への言及は差分になる(リポジトリのルールが gstack のデフォルトより優先する)。
- テスト(test/gstack-restamp-queue.test.ts、test/tree-receipt*.test.ts、新しい pregate のテスト): `since: '0.60.188.0'`、package.json のバージョン、スタンプのコメントに触れる再スタンプは、設定されたパターンの下で `STAMP_ONLY: yes` になる(現在: changed)。コードの編集は、ファイル名を挙げて `no` になる。同じ移行番号を追加する 2 つのブランチは衝突を報告する(現在: clear)。`restamp_command` は、gstack が何かを書く前に、クリーンなツリー上で実行される(現在: `RESTAMP_RELEASE_TOOL_FAILED`)。test/tree-receipt-stamp-sensitive.test.ts:58-69 の否定的なフィクスチャはそのまま残す。

**CD4. 封印された出力のガードが、すべての push の前に走る(項目 17)。** 再現: 管理された pre-push フックをインストールした状態で、ユーザーごとのトランスクリプト、引用された封印済みの回答、seed、`/home/user` のパスを含む push が、出力なしで終了コード 0 になった。ホームパスは LOW の `internal.user_path` と評価され、pre-push では黙っている。gbrain-evals は公開されている。

- 新規の lib/sealed-guard.ts。bin/gstack-redact-prepush から、既存の `addedLinesFor` の後に呼び出す(既存のフック。再インストールは不要)。`gstack-pregate --sealed [--range <a..b>]` として公開する。リポジトリの `.gstack/pregate.json` にある `sealed` の設定キーを、push されるコミットから読む: `{paths: [push してはいけない glob], transcripts: [glob], answer_markers: [正規表現], seed_patterns: [正規表現], local_paths: true}`。公開リポジトリでは、どの一致も push を拒否し、ファイル、行、ルール id(`sealed.path`、`sealed.transcript`、`sealed.answer`、`sealed.seed`、`sealed.local_path`)を名指しする。非公開リポジトリでは警告する。`sealed` キーのないリポジトリには変化はない。
- 公開範囲: 設定の上書き、次に state ルートの下の 24 時間のキャッシュ、次に push 先の `gh repo view --json visibility`(5 秒のタイムアウト)。`unknown` は公開として扱う。
- Capy の PR ツールはローカルのフックを実行しないかもしれない。そのため、ベンダリングされた Capy のスキルとコーディネーターの契約は、`sealed` の設定があるリポジトリでは、push や PR 作成の前に `gstack-pregate --sealed` を実行するよう述べる。
- 主要な統制は管理である。封印された保留セットはオーナーの管理下にとどまる(Capy の Drive や、公開リポジトリへ push できる Capy のマシンには置かない)。ガードは多層防御の一つ。Capy の PR ツールがローカルの pre-push フックを実行するかどうかは、このウェーブでは測定しない。PR C の本文がそう述べ、コーディネーターが測定結果を記録する。公開リポジトリのサーバー側の push 保護はオーナーの判断であり、ロールアウトの段階に挙げる。
- テスト: 公開のスクラッチリポジトリ(公開範囲の上書き)と `sealed` の設定で、各種の push を拒否し、ファイルとルールを名指しする(現在: 終了コード 0、出力なし)。非公開の上書きは警告して通す。キーのないリポジトリは黙って通す。

### 機能した部分を保つ(リグレッションのピン)

- `install.sh --check` の FAIL の行には、正確な `fix:` の行がある: test/gstack-doctor.test.ts でピン留め。A3 は `found at … not on PATH` の行を加え、A1 は静的な「名指しされたすべての bin が存在する」テストを加える。
- `gstack-autoplan next` はフェーズの順序とスナップショットのハッシュを表示する: test/autoplan-run-recovery.test.ts:207 でピン留め。B1 の end-to-end テストは、すべてのボイスが紐付けた結果がフェーズのスナップショットのハッシュを持つことも、アサートする。
- 古いものを置き換える、承認済みの義務のブロック: test/autoplan-obligations.test.ts:265、:326、:382 でピン留め。変更しない。
- `REOPENED:` の再実行を伴う、完全一致のトークンによるゲートの回答: 文法は test/gate-list.test.ts:50-117 でピン留め。再実行は JSON を通してのみピン留めされている。B2a は、リテラルの `REOPENED: <phases>` の行についてのアサーションを加える。
- PLAN_REALITY の `unreceipted=`: JSON を通してのみピン留めされている。B2d はテキストのトークンをピン留めする。
- 差し替え可能なアウトサイドボイス: test/outside-runner-contract.test.ts でピン留め。B1b の `--unavailable` と `--record` は、ランナーのラベルを保つ。

### このウェーブの対象外

- gbrain 自体の変更(`.gstack/` の gitignore 行、pregate と ship-policy の設定、`GSTACK_EVAL_CALLS` 行の出力、restamp ツールにおける `since:` の扱い): 設定例を添えてコーディネーターに報告する。
- 計画専用インストールでの `bun install --production`(計測で 17.2 秒が 3.7 秒)。`build.sh` と `lib/conductor-env-shim.ts` が devDependencies を読み込むため、先に監査が必要。
- Garry の Drive スキルや、ユーザースコープの AGENTS.md の作成: Garry から依頼があった時点で、コーディネーターが `capy/skill/gstack/` をコピーする。

### 検証

1. 各レーン: 失敗優先のテストは `dbf400e` で失敗し、レーンの先頭で成功すること。加えて、そのレーンが触れる集中スイートを、このシミュレートホスト上で実行する(ホスト形状のテストには PATH 上の Bun 1.3.14 を先頭に、スイートの実行には Bun 1.4.2 を使う)。
2. 統合担当: `bun run gen:skill-docs`、`bun run typecheck`、context-budget・parity・モジュールサイズの各 ratchet を実行し、統合後のツリーで `bun run test`(無料の全スイート)を一度実行する。変更したテンプレートについては、push 済みの HEAD で有料の PR eval(`eval:bg:pr`)を実行する。
3. このマシンでの実運用による受け入れ確認: 実在の 1.91.12 チェックアウトが、ベンダリングされたラッパー経由でセッション開始時に自己アップグレードすること(A2)。本計画の autoplan 出力に対する 3 リビジョンの無人実行が検証を通ること(B1a)。`submit --record` がサブエージェントでレビューされた run を閉じること(B1b)。

### 工数

4 レーンを並行し、各レーンはエージェントの作業時間で約 2〜4 時間。統合と全スイートで約 1 時間。有料の支出は PR eval 層と、本計画のレビュー(ホストのサブエージェント。費用は不明)に限られる。

### ゲートの判断(gate_rev 1、2026-10-13 00:29 UTC。Garry の常設ルール「推奨案を採用し、後戻りできない判断だけをエスカレーションする」に基づき、wave スレッドが `d1b d3b d4b d5b p1b` で回答)

6 回のレビュー(CEO、DX、Eng。ネイティブの claude-opus-5-5 と社外の gpt-6.1-sol を、いずれも Capy のホストのサブエージェントとして実行)で 111 件の指摘が出た。内訳は Critical 3 件、High 37 件。ゲートは方向性の変更を 5 件提示したが、いずれも既定値は「現在の方向性を維持」だった。これは現場の項目 10 に当たる。

- **d1b、採用: Drive のスキルを凍結されたブートストラッパーにする。** 古いチェックアウトは Drive 側のコピーしか実行しないため、P1 はそれに依存する。レーン A は `capy/skill/gstack/` を、短いブートストラッパーとして出荷する。その役割は、clone または fetch を行い、リモートの最小版を下回る場合はロックの下で fast-forward し、チェックアウト自身のラッパーを exec することだけ。これを Garry の Drive に一度コピーするのは、コーディネーターが担当するリリース手順である(GBRA-40 には、これが出荷されたらスキルを更新するよう既に依頼済み)。PR 本文では「マージ後」の先頭にこの項目を記載する。
- **d2a、維持: 両者が一致したユーザーへの異議は、変更を推奨する。** Garry の wave ブリーフがまさにそれを求めている(「声が一致したら、その変更を推奨し、既定値の根拠を明記すること」)。そのため、依頼されていない方向転換ではない。社外 CEO の F2 と Eng の F13 に従って修正: 「一致」とは、同じ指摘に対して両方の声が `user_challenge` を付け(照合後に `confirmed`)、**かつ** 同じ `changes` の値を持つことを指す。これより弱いものは `a` のまま、根拠を示す。ゲートの文法に `all as-is` を追加する(1 つのトークンで全方向性を維持)。p1 の推奨文には、適用される変更の内容を明記する。既定値の変更としてコーディネーターに報告済み。
- **d3b、採用: PR は 1 本ではなく 3 本にする。** PR A(インストールとアップグレード、レーン A)、PR B(autoplan、レーン B-core と B-aux)、PR C(pregate、有料ゲート、restamp、sealed ガード、レーン CD)。各 PR は出荷時に `bin/gstack-next-version` から自分用の PATCH の枠を取る。後から出す PR は main をマージし、restamp する。PR B のゲートの既定値をめぐる議論が、インストール修正を止めることはない。
- **d4b、採用: コーディネーターが担当する展開の一連の作業。** 現場への約束は gstack の外側の手順を必要とする。具体的には、Drive のブートストラッパーのコピー、Garry のユーザースコープ AGENTS.md の 1 文の改定(遅延インストール、トレーラーのルール)、gbrain の `.gstack/` 設定(pregate のガード、ship policy のスタンプパターン、sealed パス)、gbrain による `GSTACK_EVAL_CALLS` 行の出力、そしてリリース後に 12 台のマシンを対象とした調査を再実行すること(各マシンは、セッションを 1 回開始した後に `gstack:` トレーラーを報告する)。wave はこの一覧を、設定例を添えて GBRA-40 に引き渡す。調査の再実行が結果を報告するまでは、現場への約束が果たされたとはみなさない。
- **d5b、採用: 有料ゲートの料金は、実行せずに得られる呼び出し計画から算出する。** CD2 はもはや、料金を知るためにゲートのコマンドを実行しない。リポジトリは、プロバイダーへの呼び出しを行わずに呼び出し計画の行を出力するプランコマンド(`.gstack/pregate.json` の `price_command`、または `--plan-command`)を宣言する。gstack はこれを、環境変数の許可リスト(`env -i` に加えて PATH、HOME、TMPDIR、LANG、および `--keep-env` で渡された名前)の下で、タイムアウト付きで実行する。`unshare -rn` が利用可能な場合はネットワークを拒否し、利用できない場合は `network: not contained` と表示する。プランコマンドを宣言していないゲートのリポジトリには、記録された警告として `EVAL_GATE_UNPRICED` を出す。この警告は、承認するには `--allow-unpriced <理由>` が必要で、黙って通ることはない。
- **p1b: 上記の上書きを条件に承認。** 1.91.95 では、再開された CEO と Eng のフェーズは改訂後の計画を見られない(項目 9。今回の実行で観測: `REOPENED: ceo,eng` の後、再実行はスナップショット `7ce72ff6…` を再利用してしまう)。古いバイト列で再実行する代わりに、以下の修正案は社外の 1 回のパス(レビュー記録)で検証し、PR B 自身の `revise` は本実行で実運用の受け入れ確認として行使する。

### 採用されたレビューの修正案(上記の矛盾する文面を置き換える)

**配布(「Delivery shape」の所有を置き換える)。** ビルダーは 4 つ、PR は 3 本。レーン A → PR A。レーン B-core(項目 6〜10: `lib/autoplan-run.ts`、`lib/autoplan-gate.ts`、`lib/autoplan-export.ts`、`lib/autoplan-state.ts`、`lib/autoplan-reconcile.ts`、`lib/gate-list.ts`、`lib/headless-artifacts.ts`、`bin/gstack-autoplan`、`bin/gstack-artifact`、`bin/gstack-autoplan-snapshot.ts` の限定的なフック)とレーン B-aux(項目 11〜13: `lib/autoplan-prompts.ts` の `detectScope` とスコープの表示、`lib/plan-reality.ts`、`bin/gstack-plan-reality`、`autoplan/DRIVER.md.tmpl` とそのリゾルバ、`autoplan/SKILL.md.tmpl` のスコープステップ)→ PR B。B-core はすべての状態遷移を所有し、B-aux は B-core が呼び出す純粋関数(`checkPlanReality`、`detectScope`)を公開し、本計画のコマンド仕様から DRIVER.md を書き出す。レーン CD → PR C。`lib/coordinator-contract.ts` と、ベンダリングされた Capy スキルの文面は、それぞれ書き手が 1 人(CD と A)。他のレーンは、自分の文を統合担当に送る。追記専用の共有ファイルは統合担当が解決し、生成される `bin/gstack-doctor-components.sh` は手でマージせず、再生成する。全レーンは `test/helpers/capy-host.ts` を使う(ディスパッチ前にベースへコミット済み)。

**レーン A の修正案。**

- `--check` はチェックアウトに対して読み取り専用のままとする。リモートの最小版を知るために fetch してよい(ref のみ)。結果は `gstack: fail revision — installed <v> is below the supported minimum <m> (<cause>); fix: bash <wrapper> --for <skill> (fast-forwards) (REVISION_BELOW_MINIMUM)` と報告する。インストールモードが fast-forward を実行する。ベンダリングされたスキルでのセッション開始時: `--check` を実行し、チェックアウトが存在する状態で `revision` または `runtime` の失敗になった場合は、インストールモードを実行する(セットアップのスキップにより、何も変わっていなければ約 1 秒)。チェックアウトがなく、どのワークフローも計画されていない場合は、`gstack: fail not-installed` のトレーラーを記録して続行する(トレーラーの文法は 1 つ、第 3 の形式は作らない)。
- 既存のチェックアウトへ fetch するときは、決して `--depth` を付けない。`git fetch origin <既定ブランチ>` を実行し、`git show FETCH_HEAD:capy/support.env` を読む。"refusing to merge unrelated histories" と出た場合は、`git fetch --unshallow` を 1 回だけ実行して再試行する。フィクスチャは `file://` URL から clone し、`git rev-parse --is-shallow-repository` が `true` であることを検証する。最小版を下回る状態と、最小版に達した状態という、連続する 2 回のセッション開始をテストする。
- fast-forward、インストール、チェックは、`.gstack-capy-install.lock` の下で 1 つのトランザクションとして実行する。インストーラーは、デッドロックを避けるため `GSTACK_CAPY_LOCK_HELD=1` を通じて保持中のロックを受け入れる。追跡対象のファイルに 1 バイトでも変更があれば、アップグレードを拒否する(「render footprint」を破棄することはしない。インストール済みのチェックアウトは、セットアップ後にクリーンであることを本マシンで確認済み)。fast-forward の後にセットアップが中断された場合、トレーラーは `fail` のままになり、次のインストール実行で完了させる(一度失敗するセットアップのスタブでテスト済み)。
- キルスイッチ `GSTACK_CAPY_AUTO_UPGRADE=0`: fast-forward は行わず、トレーラーは `fail revision … (auto-upgrade disabled)` になる。docs/RELEASING.md に、`GSTACK_MIN_REVISION` を引き上げてよい条件を追記する(インストールの正直さ、またはセキュリティ修正に限り、スタンプ時に VERSION から設定する)。`GSTACK_MIN_REVISION <= VERSION` であることをテストで固定する。
- `bin/gstack-upgrade` は `gstack-session-update` の fast-forward ロジックとロックを再利用する(4 つ目のコピーを足すのではなく、共通部分を切り出す)。Capy のインストールを自動検出(`gstack-capy-install` が書き込むマーカー)し、インストーラーを実行する。オフラインでの `--check` は終了コード 3 で、`UPGRADE_FETCH_FAILED` を出す。
- トレーラーと起動行は、`--check` を含め、ラッパーの成功した実行のすべてから出力される。`GSTACK_LAUNCH: PATH=<dir>:$PATH GSTACK_SESSION_KIND=unattended GSTACK_STATE_ROOT=<p> GSTACK_EPHEMERAL=1 GSTACK_CAPY=1` に加え、シェルの構文を評価しない呼び出し元のために `GSTACK_LAUNCH_PATH: <dir>` も出す。
- ワークフローの拒否は、トートロジーではなく判定ファイルに基づく。ラッパーは `$GSTACK_STATE_ROOT/install-verdict` を書き出す(トレーラー、HEAD の SHA、リモートの最小版、時刻。state root は `gstack-paths` 経由で取得)。`gstack-skill-start` は(`SESSION_KIND` を出力した後に)、`unattended` セッションと、`GSTACK_CAPY=1` を伴う明示的な `GSTACK_SESSION_KIND=spawned` セッションでは、判定ファイルが無い、`fail` である、別の HEAD 用である、または PATH 上の Bun が最小版未満である場合に拒否する。preamble には 1 つルールを追加する(予算内に収まるよう再生成)。`status=refused` の場合は停止するためのルール。`bin/gstack-autoplan` は、変更を伴う動詞(`next`、`submit`、`answer`、`revise`、`export`)で同じ判定を確認する。`status` と `resume` は利用可能なまま。`GSTACK_ALLOW_UNSUPPORTED_RUNTIME=1` で上書きでき、実行の逸脱として記録される。環境に存在する OpenClaw の `spawned` セッション(`GSTACK_CAPY` なし)は警告のみ。
- 古いラッパー: ブートストラッパーは `FETCH_HEAD` から `GSTACK_CAPY_MIN_WRAPPER` を読み、古い場合は同じ引数でチェックアウト側のベンダリングされたラッパーを exec し、`gstack-capy-skill: owner action — Drive copy is wrapper <n>, minimum <m>; copy <root>/capy/skill/gstack/ (CAPY_WRAPPER_STALE)` を表示する。ベンダリングされたラッパーが存在しない場合にのみ拒否する。
- ピン: 下限以上の Bun が存在しない場合は、検証済みの Bun のインストールが最初に行われ、その後そのバイナリでピンを読む。適用されるすべての制約を満たしているインストール済みの Bun は、競合とはみなさず再利用する。計画専用のワークフロー(`--for autoplan`、計画レビュー、office-hours)では、リポジトリのテスト用ピンの不一致を失敗ではなく `SKIP pins (planning-only; repo pins bun 1.4.2, launch bun 1.4.3)` と報告する。リポジトリのテストを実行するワークフロー(`ship`、`review`、`qa`、pregate)では、`pins` を必須のままにする。
- セットアップのスキップは、セットアップ成功後に記録されたソースの HEAD の SHA と、ホストおよびモデルの組み合わせで判定する。VERSION だけでは判定しない。fast-forward の後には適用しない。
- 新しい bash の結果コードは、生成されるコンポーネントファイルから `gstack_result_anchor` を取得する(gstack-capy-install に非公開のテーブルは持たない)。テストで、bash のバイナリが出力するすべての `(CODE)` がアンカーに解決されることを確認する。
- 引き継ぎの行は識別子の後に置く。`GSTACK_RESULT` を先頭にし、続いて `gstack: ok|fail <rev>`。CD がこれをコーディネーターのコントラクトに書き込む。
- 実運用の受け入れ確認は、Drive が保持するとおりのブートストラッパーを通じて、実在の 1.91.12 チェックアウトに対して実行する。

**レーン B-core の修正案。**

- B1a: 冪等な `migrateLegacyDecisionIds` を 1 つ、状態の読み込み時に run ロックの下で実行する(n > 0 のときに一度だけジャーナルイベントを記録)。`exportRun` のたびに実行はしない。run.json は `gstack_version` を記録する。新しい gstack でのコマンドは `GSTACK_VERSION_CHANGED` を表示し、ジャーナルに記録された前方向のマイグレーションを実行する。ダウングレードは拒否する。
- B1b: `submit --record` が受け付けるのは次のものだけ。正規のフェンス、正確な `No findings.` の行、または指摘の形式(重大度とタイトルの列)を持つ Markdown の表またはリストがちょうど 1 つ。候補の形式が 2 つ以上ある場合は拒否する。`INPUT:` がない記録は、`--attest "<理由>"` が指定されない限り `RESULT_RECEIPT_MISSING` で拒否する。`INPUT:` があるが誤っている場合は、常に拒否する。証明付きのバインドには `--attempt` が必要で、その試行の dispatch の後に `plan_revised` イベントが続く場合は拒否する。validate は `attested=<n>` を表示し、その voice は `receipt: attested` と証明の理由を保持する。開いている試行が 1 つだけの場合、正規のパスでは `--attempt` は省略可能なまま。
- `submit --voice outside --unavailable|--failed "<理由>"`。終端 voice の判定(述語)は `next`、`submit`、`resume`、close で共通のものを使う。終端の結果は、manifest を書き出す前に試行の ID とともにジャーナルに記録するため、`next` と `resume` が利用不可の voice を再ディスパッチしたり復活させたりすることはない。
- B1c `revise`: ドリフトは、ファイルのバイト列ではなく Implementation-plan のハッシュで検出する。revise は、レビュー済みのハッシュが v2 と異なるすべての閉じた、または開いたフェーズを再度開く(実際にはレビュー済みのフェーズすべてと Eng)。新たにスコープに入ったフェーズは、スキップされたスタブから初期化し、`required_phases` を更新する。`plan_heading` を run.json に保存する。アクティブな計画、状態、アーカイブ、ジャーナルを、回復可能な 1 つのトランザクションとして公開する(先にジャーナルに意図を記録し、`resume` が完了またはロールバックする)。アーカイブ名は `.r<rev>` を維持し、衝突した場合にのみ `.v<k>` を追加する(test/autoplan-answer-invalidation.test.ts:106 はそのまま残す)。`gate_pending` での revise は、p1d ではなく独自のジャーナルイベントとし、p1d の文面は `revise` を指すようにする。
- 修正案のインターロック(B2a の `APPLY:` 行を所有する): 採用された計画変更は、判断 ID をキーとして保留中の修正案として保存する。`answer` は、それらが存在する場合は `next` ではなく `NEXT: gstack-autoplan revise --out <dir> --plan <source>` を表示する。`next` は、`revise` が変更された Implementation-plan のハッシュを束ねるか、`--withdraw <判断ID>` で 1 つ取り下げるまで、`PLAN_AMEND_PENDING` で拒否する。`export` は、保留中の修正案がある間は `complete` を拒否する。
- 部分的な返答は、保存された判断に照らして解決する。以前の上書きは、後の `all` で決して上書きされない。既定値が適用されるのは未解決の項目だけで、すべての承認が確定するまでゲートは保留のまま。承認が保留中の状態で `complete` を指定すると、validate が拒否する。
- 持ち越しは、表示ラベルではなく安定した由来のキー(フェーズ、指摘 ID、スナップショットのハッシュ、選択肢テキストのハッシュ)を使う。再実行されなかったフェーズからの、変更のない提案のみを持ち越す。
- `changes` は、結果のパーサー、正規の行、指摘のスキーマ、判断に接続する。`recommended_basis` はゲートの項目と判断に保存する。
- `submit` は、アクティブな Implementation-plan のハッシュに対して `checkPlanReality` の結果を記録する。結果はハッシュとチェッカーのバージョンでキャッシュし、`revise` で無効化する。

**レーン B-aux の修正案。**

- B2c: 元の計画ファイルは決して書き換えない。フラグは実行中の run.json に保存する(revise は引き継ぐ)。計画内の `<!-- gstack-autoplan-scope: … -->` マーカーは、作成者がそこに記述した場合(先頭行、見出しより前)に読み取る。`next` は `SCOPE_PIN: add <marker> as the first line of <file> to keep these flags` と表示する。UI の根拠は視覚的な文脈とする(描画されたファイルパス、または視覚的な名詞(page、layout、style、pixel、view、browser、CSS)の隣にある UI の用語)。3 つの用語による閾値は使わない。テストでは、視覚を伴わない CLI の文章、引用されたパス、実際に描画された変更を扱う。
- B2d: `unreceipted_numbers=<n>` を出力し、各項目について `NUMBER_UNRECEIPTED: <clause>` の行を 1 つずつ出す。対象は計測された量に限る(単位付きの数値: s、ms、%、$、USD、tokens、×、MB、GB、または measured/costs/takes/took の後に続く数値)。バージョン、file:line、ID、SHA の根拠は除外する。`RECEIPT_RE` の SHA の選択肢は、a〜f の英字を少なくとも 1 つ、またはコミットやバッククォートの文脈を必要とする。判定は既存のセッション種別の対応(無人なら `incomplete`、それ以外は `repair`)を維持する。誤検出のテストでは、本計画に対してチェッカーを実行し、件数が少ないことを固定する。
- B2e: DRIVER.md を、すべてのホストに対して文書化された無人実行の入口とする。`gstack-autoplan --help` と最初の `next` で `DRIVER: <root>/autoplan/DRIVER.md` と表示する。インストール後のレイアウトでもアセットを解決できるようにし(実行時のアセットヘルパー)、ジェネレーターの通常・出力先・ドライランの各インベントリに登録する。禁止語のテストは、ハーネスの用語(`PreToolUse`、`SessionStart`、`AskUserQuestion`、`Skill tool`)を禁止する。単語としての hook は禁止しない。ベンダリングされた Capy の SKILL.md には、そのテストで行数の上限を設ける。

**レーン CD の修正案。**

- CD1: レーンは `gstack-pregate run --allow-repo-commands` を実行する(コントラクト、docs/unattended.md、DRIVER.md に明記)。必須のガードは格下げできない。権限がない場合は `incomplete` とする。ガードはベースのポリシーから読み取り、それぞれ独自のプロセスでタイムアウト付きで実行する。新しいチェックの ID は、固定されたステージのリストに追加する(test/pregate-selection.test.ts:101)。
- CD2 は d5b に従う。呼び出し計画の通信フォーマットはバージョン管理し、文書化する(`GSTACK_EVAL_CALLS v1: purpose= model= calls= in_tokens= out_tokens= max_out_tokens= scope=full|smoke`)。合計値は、呼び出しごとの予約とは別に集計する。領収書は、料金をコマンド、HEAD、入力に紐付ける。不正な形式、部分的な出力、失敗した生成元は拒否する。最新の Sonnet、embedding、Gemini モデルの料金行は、ソース URL と日付がある場合にのみ追加する。料金が不明なモデルは合計を `unknown` とし、ゼロにはしない。
- CD3: 動詞 `gstack-pregate regate --against <head>`(裸の `--against` は別名として残す)と `gstack-pregate sealed`。`REGATE: not-needed` には、スタンプのみであること、マイグレーションの衝突がないこと、そして `<head>` に対するゲートの根拠(ゲートのレーンが通過したことを示す証拠バンドルまたはツリーの領収書)が必要。根拠がない場合は `REGATE: needed (no gate evidence for <head>)` と表示する。スタンプの対象は、どのパターンを適用する前に、ポリシー(`stamp_files`)による明示的なファイルの許可リストで決める。`stamp_patterns` は、`{version}` の 1 か所だけを持つリテラルのテンプレートとし(自由な正規表現は不可)、個数と長さに上限を設ける。マイグレーションの衝突には `migrations` ポリシー(`dir`、`id` パターン)を使い、`gh pr list --state open --limit 1000 --json number,headRefOid,files` を用いる。100 ファイルのリストは切り詰められたものとみなし(その PR のファイルは別途取得する)、PR 自身は除外し、ベースブランチの追加分と比較する。いずれかの照会が失敗した場合は `unknown` を表示する(これにより `not-needed` は阻止される)。
- CD3 restamp: `restamp_command` は、restamp のステージング用ワークツリー(HEAD のクリーンなチェックアウト)の中で最初のステージとして実行する。割り当てられたターゲットのバージョンを引数として受け取り、`GSTACK_RESTAMP_VERSION` にも渡す。これが設定されている場合、汎用のバージョン書き込みはスキップする。出力の閉じ込めチェックは引き続き実行する。失敗した場合、またはバージョンが誤った出力の場合は、ブランチに何も書き込まない。
- CD4: ガードは、push が公開するすべてのコミットを、宛先との差分(`git rev-list <remote sha or merge-base>..<local sha>`)で列挙し、それらのコミットで追加、名前変更、コピーされたすべてのパスに対して、テキストに関係なくパスのルールを評価する(バイナリや空のファイルも含む。追加してから削除したものも検出する)。テキストのルールは、各コミットで追加された行に対して実行する。有効なポリシーは、宛先のベースブランチの `sealed` 設定と、push されたほうの設定の和集合とする(push によって厳しくはできるが、緩めることはできない)。例外は、ベースブランチの許可ファイル(ルール、パス、SHA、理由)からのみ認める。拒否の末尾には `(SEALED_OUTPUT_REFUSED)` を付け、可視性の上書きキーを明記する。`gstack-pregate sealed --range <a..b>` は同じ中核を共有し、Capy スキルが、push や PR 作成の前にエージェントに実行するよう指示するコマンドである。Capy の PR ツールがローカルのフックを実行するかどうかは、このマシンで確認し、その結果を PR 本文に記録する。公開評価リポジトリ向けのサーバー側の必須チェックは、コーディネーターの一連の作業(d4b)に含まれる。
- 新しい bash のバイナリにおける state root のパスは、正確なガード行を使って `gstack-paths` 経由で解決する。TypeScript では `resolveStateRoot` を使う。

**新しい結果コード(1 つの表。各コードにはトラブルシューティングのアンカーを付ける)。** `UPGRADE_REFUSED`、`UPGRADE_FETCH_FAILED`、`REVISION_BELOW_MINIMUM`、`CAPY_WRAPPER_STALE`、`PLAN_SECTIONS_INVALID`、`PLAN_AMEND_PENDING`、`GSTACK_VERSION_CHANGED`(通知)、`EVAL_GATE_UNPRICED`、`EVAL_GATE_OVER_CAP`、`EVAL_DRY_RUN_FAILED`、`PREGATE_GUARD_FAILED`、`SEALED_OUTPUT_REFUSED`。既存のコードは、合うところで再利用する(`RUNTIME_BELOW_MINIMUM`、`RESULT_RECEIPT_MISSING`、`RESULT_FINDINGS_MISSING`)。

**挙動の変更(各 PR 本文の `## Behavior changes` に記載する)。**

| 変更 | 旧 | 新 | オプトアウト |
|---|---|---|---|
| セッション開始時の最小版未満のチェックアウト(Capy ラッパーのインストールモード) | 一度も pull しない | fast-forward のみ行い、その後インストールとチェック | `GSTACK_CAPY_AUTO_UPGRADE=0`; `--revision` でピン留め |
| 判定が失敗している無人または Capy 起動のワークフロー | そのまま実行される | `status=refused`(skill-start と `gstack-autoplan` の変更を伴う動詞) | `GSTACK_ALLOW_UNSUPPORTED_RUNTIME=1`(記録される) |
| `GSTACK_LAUNCH` 行 | PATH なし。インストーラーのみ | 検証済みの Bun のディレクトリと `GSTACK_CAPY=1` を含む。`--check` でも出力される | 不要 |
| 計画専用の `--check` で、リポジトリのテスト用ピンが一致しない場合 | `fail pins` | `SKIP pins (planning-only …)` | `--require pins` |
| 両方の voice が同じ `changes` で一致した UC に対するゲートの `all` | 方向性を維持 | 変更を適用する(`APPLY:` 行、revise が必要) | `all as-is` |
| `changes` のないユーザーへの異議の再実行 | Eng を再度開く承認項目 | エージェントによる自動判断。再オープンなし | なし |
| UI の検出 | ファイル全体で、UI の単語が 2 つあれば検出 | Implementation plan と視覚的な文脈で判定 | `--ui` |
| PLAN_REALITY | 1 つの領収書で 1 行を覆う | 計測された数値ごとに領収書が必要。ルールの主張にはルールが必要 | なし(`submit` では報告のみ) |
| `gstack-pregate` の未知のフラグ | 無視 | 終了コード 2 | なし |
| `sealed` 設定のあるリポジトリの pre-push フック | sealed のチェックなし | 公開リポジトリでは拒否 | ベースブランチの許可ファイル |

## レビュー記録

autoplan の実行 `ap-20261012235347`(gstack 1.91.95.0、Capy のクラウドマシン、Claude Code のハーネスなし。ネイティブの claude-opus-5-5 と社外の gpt-6.1-sol をホストのサブエージェントとして使用。スコープ `--no-ui --developer-tool`、順序 ceo,dx,eng、3 フェーズすべてのスナップショットは `7ce72ff6…0f09d9`)。CEO: 15 件 + 10 件の指摘(confirmed 1 件)。DX: 30 件 + 16 件(confirmed 0 件)。Eng: 18 件 + 22 件(confirmed 1 件)。ゲート rev 1 は上記のとおり回答。`REOPENED: ceo,eng`。全結果、コンセンサスファイル、ゲートは実行とともに保管している。上記の修正案が採用された結論である。

### 修正案の検証(社外の声 gpt-6.1-sol、ゲート rev 1 の後)

社外の 1 回のパスが、ゲートの判断と修正案を、6 つの結果にある Critical と High のすべての指摘に照らして検証した。社外の声が数えた件数では Critical 4 件、High 53 件(ゲートの要約は過少に数えていた)。35 件は解決、1 件は辞退、21 件は未解決または部分的。ビルダーへの修正指示として 15 件を優先順位づけした。ビルダーには置き換え分として送付した:

- **CD2:** 料金は、ゲートのコマンド、HEAD、入力に紐付けられたバージョン付きの呼び出し計画データファイル(`price-gate --plan-file`、またはベースポリシーの `price_file`)から算出する。承認前にリポジトリのコマンドは実行しない。`--allow-unpriced` は記録されるオーナーによる上書きであり、支出を承認するものではない。
- **CD4 の境界:** 公開されるコミットは、ローカルのマージベースではなく `git rev-list <local> --not --remotes=<remote>` で求める。不正なポリシーは安全側(拒否)に倒す。可視性が不明なものは公開として扱う。1 時間より古いキャッシュされた非公開の判定は、拒否を格下げする前に再照会する。P3 は、誤った公開に対するローカルチェックを約束する。ホスト型 CI は、アップロード後にバイパスを検出するだけ。
- **CD3:** `regate` は、新たに評価されたツリーの領収書からのみ再利用を導出する。レーンごとの判定と、スタンプに敏感な再実行を伴う。委任された restamp には、呼び出し元のツリーがクリーンであることが必要。
- **A:** ブートストラッパーと完全なラッパーは、ロックの受け渡しを伴い、別々のパスに置く。判定はチェックアウトの realpath と HEAD で鍵付けし、そのパスを `GSTACK_LAUNCH` に載せる。判定が必要なのは `GSTACK_CAPY=1` の下だけなので、他のホストはローカルのランタイムチェックを受ける。サポート用のメタデータは `.source-path` 経由で解決する。
- **B-core:** `revise --incorporates <ID>` は、名指しされた修正案だけを解消する。UC の選択肢 b は、両方の voice の是正策をそのまま表示する。統合された適合テストが 1 つ、ループ全体をカバーする。

辞退した案と理由:

- **意味論的な一致の完全な検出(修正 3)。** 機械的には決められない。両方の是正策と `all as-is` を表示しておけば、判断はオーナーから見えたままになる。
- **アップグレードを適格なリリースの SHA に固定する(修正 9)。** gstack の main の各コミットは、スタンプ済みで CI が通ったリリースなので、最小版がポリシーの操作点になる。本計画は、古い SHA のチェックアウトでマイグレーションがロールバックされるとはもはや主張しない。

PR の順序: A、次に A の上に積む B(A の判定ヘルパーを読む)、そして独立した C。

### ゲートの改訂 2 と 3(PR B のコード上で)

実行は PR B(`capy/gstack-autoplan-wave`)に移った。`GSTACK_VERSION_CHANGED` を表示し、マイグレーションを行った。改訂後の計画で `revise --plan` を実行すると、CEO と DX がスナップショット `b5d68733…` で再度開かれた(Eng は rev 1 の回答によってすでに再度開かれていた)。`revise --incorporates d1b,…` は、1.91.95 が修正案として記録していない rev 1 の ID を指定していた。今後は `PLAN_AMEND_PENDING` ではなく `AMENDMENT_UNKNOWN` で拒否する(失敗優先のテストを伴い PR B で修正)。3 つのフェーズすべてが `submit` を通じて再実行され、領収書は検証済み。

- **ゲート rev 2:** 指摘 75 件、項目 3 件。`d1b` は採用: P3 は、sealed 出力に対する主要な統制としてオーナーによる保管を位置づけ、CD4 の注記には、Capy の PR ツールがローカルのフックを実行するかどうかは計測されていないと記載した。`d2a` は維持: すべてのフェーズが計画全体のスナップショットを取るため、どの編集もすべてのフェーズを再度開く。`p1b`。変更は `revise --incorporates ap-20261012235347-r2-d1`(スナップショット `5ad91c4b…`)で束ね、CEO、DX、Eng は `DECIDED AT THE GATE` ブロックとともに再実行した。
- **ゲート rev 3:** 項目 2 件。`all`(現状のまま承認)。未解決の項目 `d1`(一方の voice のみ: ユーザーへの異議ではない High の指摘には処理が残らない)は、この wave の変更ではなく、フォローアップとして記録する。
- `export` の後、`gstack-artifact validate run.json`: `ARTIFACT_VALID: run=ap-20261012235347 status=complete`。ゲートの改訂 3 回、計画の改訂 2 回、取り込まれた修正案 1 件、指摘 76 件、タスク 29 件、判断 11 件で、保留中のものはなし。
- 9 回のフェーズのクローズにわたり `confirmed=0`。コンセンサスの照合は、ネイティブの指摘と社外の指摘を一度もペアにしなかったため、項目 10 の「声が一致した場合の既定値」は実際の実行では発動しなかった。これはフォローアップ事項。
