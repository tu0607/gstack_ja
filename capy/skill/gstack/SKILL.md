---
name: gstack
description: Capy と Claude Code で gstack をインストールして使う。セッション開始時にこのマシンを確認するために読み込み、gstack の計画、コードレビュー、デバッグ、QA、デザイン、セキュリティ、ドキュメント、出荷のワークフローに使う。
---

# Capy と Claude Code のための gstack

## セッション開始: まず確認し、必要なときだけインストールする

`scripts/install.sh` は、作業リポジトリではなく、この SKILL.md からの相対パスで解決します。これは固定されたブートストラッパーです。最初に `gstack-capy-skill: wrapper <n> (<path>)` を表示し、サポートされる最小バージョンを gstack のリモートから取得して、チェックアウトの中にあるラッパー(`bin/gstack-capy-session`)に処理を引き渡します。

1. セッション開始時に `bash scripts/install.sh --check` を実行してください。ワークフローが分かっている場合は `--for <skill>` を付けます(`--for autoplan`、`--for review`、`--for qa` など)。このコマンドは、コンポーネントごとに `PASS|FAIL|SKIP|WARN <component>` の行を 1 つずつ表示し、`GSTACK_LAUNCH:` の行を出し、最後の行に必ずトレーラーを 1 つ出します。トレーラーは `gstack: ok <revision> for=<skill>[ (<notes>)]`(終了コード 0)か、`gstack: fail <ids> …`(終了コード 1)のいずれかです。`WARN` はオーナーが対応すべき項目です。終了ステータスを読み、`^gstack: ` を直接 grep してください。チェックの出力を `tail`、`head`、単独の `grep` にパイプしてはいけません。`--check` は決してチェックアウトを動かしません。
2. トレーラーに `revision`、`runtime`、`pins` のいずれかが含まれる場合(`gstack: fail revision …`、`gstack: fail runtime,pins`、`gstack: fail pins`)かつチェックアウトが存在する場合、または ok のトレーラーに `behind=<n> (latest: <v>); fix: <command>` が含まれる場合(チェックアウトが origin より <n> コミット遅れている。出力には `gstack-capy-session: behind origin/<branch>: …` の行もある)は、同じコマンドを `--check` なしで実行してください(タイムアウトは 900 秒)。`fix:` が別のコマンドを指している場合は、そのコマンドを実行します。トレーラーは `behi=` を含めて、そのまま報告してください。遅れているレーンは、遅れていることを明示します。`pins` の場合は、プロジェクトが固定した Bun のバージョンが検証済みであればそれをインストールします。検証できない場合は `RUNTIME_PIN_CONFLICT` で停止し、どの pin を上げるべきかを示します。ピン留めされていない、クリーンなチェックアウトが origin より遅れている場合は、インストールモードで早送り(fast-forward)されます。`GSTACK_MIN_REVISION` の下限より下ではブートストラッパーが行い(`gstack-capy-skill: upgraded <old> -> <new>`)、上限より上ではチェックアウト自身が行います(`SELF_UPGRADE: done <old> -> <new>`)。その後、1 つのロック内で再インストールと再チェックが行われます。ピン留め(`--revision`、detached)されている、ダーティな、または分岐しているチェックアウト、あるいは別の生きているセッションがリースを持っているチェックアウト(`UPGRADE_BUSY`)は、決して動かしません。トレーラーが原因と正確なコマンドを示します(上限より上では、`SELF_UPGRADE: skipped (<reason>)` の後に `fail behind` のトレーラーが出ます。理由は `UPGRADE_BUSY` または `UPGRADE_REFUSED` です)。スリープ後に pid が再利用されたリースは、自動的に回収されます。`GSTACK_CAPY_AUTO_UPGRADE=0` はすべての早送りを無効にします。`GSTACK_CAPY_SELF_UPGRADE=off` は上限より上の早送りだけを無効にします。
3. トレーラーが `gstack: fail not-installed …` で、このセッションで gstack のワークフローを実行しない場合は、その行を記録して続けてください。何もインストールされません。最初のワークフローの直前に `bash scripts/install.sh --for <skill>` でインストールしてください(初回は約 30 秒です。クローン、SHA-256 で検証された Bun(適合するものがインストールされていない場合)、Chromium のないホストプロファイル両方、そして新しいシェルが記録された Bun を使えるように `~/.local/bin/bun` のシムを作ります)。
4. その他の `FAIL` の行には `fix:` コマンドと、トラブルシューティングのアンカーが付いた理由コードがあります。修正コマンドを実行し、その後 `--check` をもう一度実行してください。`SKIP codex-cli (optional; …)`、`SKIP browser (lazy; …)`、`SKIP pins (planning-only; …)`、`SKIP pins (helper runtime; …)` は失敗ではありません。

**トレーラーのルール。** このセッションで、このマシンから `^gstack: ok` の行が出ていなければ、ここに gstack はインストールされていません。ワークフローを実行してはいけません。スキルが動くと主張してもいけません。あるマシンへのインストールは、別のマシンをカバーしません。

**サブエージェント。** サブエージェントが親に最初に送る報告には、自身のマシンの `--check` から得た `gstack:` のトレーラー行を、識別子の後にそのまま含めてください。親は、その行がなければ `gstack: fail not-installed` とみなします。読み取りと報告だけを行うレビュー用のサブエージェント(/autoplan の声、セカンドオピニオン)は、代わりに `--for review-voice` を実行します。これは数秒で済み(温まっている場合)、`./setup` は不要で、ホストプロファイルもなく、Bun は gstack 自身の最小バージョンを使い、読み取り専用のヘルパー(`gstack-pregate sealed`、`gstack-plan-reality`、`gstack-artifact`、`gstack-autoplan` の読み取り)だけを認証するトレーラーを出します。すべてのワークフローは、`--for <skill>` の修正案を添えてこれを拒否します。レビュー担当に「インストールは不要」と伝えてはいけません。このスキルがないマシン(あなたが書いたサブエージェント向けのブリーフ)は、プロジェクトのディレクトリから、チェックアウト自身のブートストラッパーを実行します: `test -f "$HOME/.local/share/gstack/setup" || git clone --quiet --single-branch --depth 1 https://github.com/garrytan/gstack.git "$HOME/.local/share/gstack" && GSTACK_CAPY_ROOT="$HOME/.local/share/gstack" bash "$HOME/.local/share/gstack/capy/skill/gstack/scripts/install.sh" --for <skill>`。

`gstack-capy-skill: owner action — Drive copy is wrapper <n>, minimum <m>; copy <root>/capy/skill/gstack/ (CAPY_WRAPPER_STALE)` は、このスキルのフォルダがチェックアウトの想定より古いことを意味します。実行は動きますが、オーナーに伝えてください。オーナーが、そのディレクトリをスキルのフォルダに上書きコピーします。スキルのフォルダを自分で書き換えてはいけません。

## すべての gstack コマンドを GSTACK_LAUNCH の行で起動する

成功したすべての実行(`--check` を含む)は、`GSTACK_LAUNCH: PATH=<dir>:$PATH GSTACK_SESSION_KIND=unattended GSTACK_STATE_ROOT=<path> GSTACK_EPHEMERAL=1 GSTACK_CAPY=1 GSTACK_INSTALL_VERDICT=<file>` を表示します(`PATH=` の部分は、検証済みの Bun が PATH の先頭にない場合だけ付きます)。さらに、シェルの構文を評価しない呼び出し元のために `GSTACK_LAUNCH_PATH: <dir>` を表示します。gstack のコマンドには、この代入を前置してください。あるいは、そのコマンドを実行するシェルで一度 export してください。子シェルの export では、親の後続のコマンドは設定できません。PATH の部分は、gstack の `#!/usr/bin/env bun` コマンドが、トレーラーで認証された Bun を使うために必要です。Capy のイメージにある `/usr/local/bin/bun` は 1.3.14 で、gstack の最小バージョンより古いためです。

`GSTACK_CAPY=1` のとき、アンアテンデッドまたは生成されたセッションで始まったワークフローは、前回の実行がこのチェックアウト、HEAD、ワークフローについて書き出したインストールの判定と、PATH 上の Bun を確認します。どちらかが失敗すると、修正案を添えた `INSTALL: fail …` の行を表示し、`GSTACK_RESULT: skill=<s> status=refused run=-` を出して終了コード 3 で終わります。停止して修正を実行し、その後もう一度開始してください。pins の行が `SKIP pins (planning-only; …)` だった ok の判定では、リポジトリのテストを実行するワークフロー(`review`、`ship`、`qa`)は通りません。また、そのワークフローに必要なコンポーネントをチェックしていない判定も通りません。先に `--for <that skill>` を実行してください。

## 適切なワークフローを読み込む

Capy で GPT-6 Astra を動かしている場合は、ルーティングのために `${CODEX_HOME:-$HOME/.codex}/skills/gstack/SKILL.md` を読み、選んだワークフローのために `${CODEX_HOME:-$HOME/.codex}/skills/gstack-<skill>/SKILL.md` を読んでください。これらは生成された GPT-6 Astra 用の指示であり、Claude 用のソースファイルではありません。

Claude Code の場合は、ルーティングのために `~/.claude/skills/gstack/SKILL.md` を読み、選んだワークフローのために `~/.claude/skills/<skill>/SKILL.md` を読んでください。Claude Code のセッションを起動するときは、gstack を読み込むよう指示し、使いたいワークフローの名前を伝えてください。Capy で Claude モデルを動かしている場合は、下の Capy 向けの調整を加えて、Claude 用の指示ファイルを直接読めます。ただし、それによって Capy が Claude Code のハーネスになるわけではありません。

特定のスキルが指定されていない場合は、ルーターのタスクとスキルの対応表を使ってください。選んだワークフローと、それが参照するファイルだけを読んでください。その他のモデルでは、最も近い指示のプロファイルを使ってください。モデル専用のプロファイルが生成された、または評価されたとは主張しないでください。

## 親エージェント向けの無人実行

Capy から `/autoplan` を駆動する場合は、チェックアウトの `autoplan/DRIVER.md`(`~/.local/share/gstack/autoplan/DRIVER.md`)を読んでください。対話型のプリアンブルを除いた、コンパクトなフェーズのループ、アーティファクトの契約、ゲートのプロトコルが書かれています。このファイルがないチェックアウトは古いので、代わりに `autoplan/SKILL.md` に従ってください。すべてのコマンドは `GSTACK_LAUNCH` の代入付きで実行し、出力は散文ではなくファイルとして読んでください。実行ディレクトリには `run.json`、`decisions.jsonl`、`findings.jsonl`、`tasks.jsonl`、`timing.json`、`plan.md`、`review-record.md` が入っています。実行は `GSTACK_RESULT: skill=autoplan status=gate_pending run=<dir>` で終わります。`~/.local/share/gstack/bin/gstack-artifact validate <dir>/run.json` が完了の確認です。ゲートには `gstack-autoplan answer`(または `gstack-gate parse`)で、表示された `gate_rev` とともに回答します。無人の実行が自分のゲートを承認することはありません。`docs/unattended.md`(チェックアウト内)が契約です。

Capy 向けの `/autoplan` のチェックリスト: 手作業の調整を実行と称するのではなく、必ず `gstack-autoplan` を駆動してください。`gstack-gate render <dir>/gate.json --all` を、`rec`(すべての推奨。プランの変更を含む)付きで中継し、一語の既定値として扱ってください。回答は `--by agent:<id> --owner-reply "<their words>"` を付けて送ります。`GSTACK_AUTOPLAN_CHECKPOINT_DIR` は、プライベートなプロジェクトユーザーの Drive フォルダに設定してください。マシンを交換した後は、`gstack-autoplan resume --out <new dir> --from <that dir>` で、最新の有効なチェックポイントを復元します。

## キャプテンの下での作業

Capy のキャプテン(クルースレッド)のために作業する場合や、人に直接仕える場合、gstack の判断はあなたを通して相手に届きます。`GSTACK_LAUNCH` の行で始まったすべてのワークフローは、`CAPY: on` と、これらのルールを繰り返す `capy-asks` のブロックを表示します。詳しいガイドは、このフォルダにある [captain.md](captain.md) にあります。作業例とコピペ用のテンプレートも載っています。

- **承認の流れ。** クルースレッドは、人に直接尋ねることはありません。Capy のエージェントチャネルで「要対応」の報告として依頼をキャプテンに送ります。キャプテンが平易な言葉で人に伝え、その人の正確な返答を返します。キャプテンのいないスレッドは、Capy の質問で人に直接尋ねます。回答は、尋ねられたスレッドとスコープにだけ適用されます。
- **標準承認は確認不要。** キャプテンがそのルール(例: 「trains を通して、緑になったらマージ」)に挙げているものです。確認し直すのではなく、そのルールを引用してください。gstack は独自の標準承認を持ちません。
- **以下は必ず新たに確認する:** 製品や挙動の判断、宣言された上限を超える支出、リポジトリの外に公開するもの(アドバイザリ、リリース、投稿)、しきい値・予算・試行回数・テストの種類の変更、誰かの貢献を取り込まずに閉じること、破壊的または不可逆なもの。
- **すべての回答を記録する。** `gstack-approvals add --ask … --words "<their exact words>" --by … --scope …` を使うか、autoplan の回答の後は `gstack-approvals import --autoplan <run dir> --by <name>` を使ってください。`gstack-approvals render` は、報告と PR の本文に載せる `## Approvals` の表を出力します。行はシークレットのスキャンを受けます。Capy では、プライベートなプロジェクトユーザーの Drive フォルダにもミラーされます。
- **プランの承認** は `gstack-owner-brief render --captain --out <run dir>` を使います。before → after、なぜ重要か、この作業の原因、大きな判断(選択肢、選んだもの、その理由、何があれば覆るか)、そして必要なこと、が表示されます。`rec` が推奨の一語の返答として示されます。全体をそのまま中継してください。ゲートのコードは最後の行にだけ出ます。そこは中継するエージェント向けです。終了コードが `CAPTAIN_BRIEF_INCOMPLETE` の場合は、不足しているプランのセクションを先に追加してください。
- **マージの依頼。** /ship の PR の本文は `## What changed`(`gstack-pr-shots` のキャプション付きの前後の画像、または UI のスクリーンショット。Capy の PR アセットツールでアップロード)、`## Why`、`## Approvals` で始まります。あなたの READY の報告には、主要な画像を添付してください。

## push または pull request の前に

`.gstack/pregate.json` に `sealed` キーがある、シールされた設定のリポジトリでは、push の前と pull request を作成する前に、必ず `~/.local/share/gstack/bin/gstack-pregate sealed` を実行してください。Capy の pull-request ツールは、ローカルの git フックを実行しないことがあるためです。このチェックは、シールされた、または評価の出力が公開リポジトリに入らないようにするものです。拒否された場合は、ファイル、行、ルールが示されます。合格するまで push しないでください。

## ホスト固有の指示を Capy 向けに調整する

- `Skill` を呼び出すという指示は、利用可能なファイル読み取りツールで、選んだ SKILL.md を読んで従うという意味です。存在しない Skill ツールを呼んではいけません。Capy の UI でスラッシュコマンドが登録されていると仮定してもいけません。
- 出力と判断には、Capy のユーザー向けのメッセージングと質問ツールを使ってください。Capy では、ただのアシスタントのテキストは届いたメッセージとして扱われません。利用できない Claude や Codex のホストツールではなく、Capy のタスクと pull-request のワークフローを使ってください。
- Capy には、ネイティブの gstack のホストターゲットがありません。Claude のフックは、Capy で強制されるフックにはなりません。安全系のスキルは、ここでは助言にとどまります。`/autoplan` は、この点を一度 `autoplan guard: not enforced by this host` と表示して伝えます。同等の強制があるかのように黙って主張せず、欠けている機能は報告してください。
- Capy で GPT-6 Astra または Claude を選んでも、Codex または Claude Code の CLI はインストールも認証もされません。モデル系統の異なるサブエージェントは、別モデルによるクロスモデルのレビューとして完全な外部の声になります。レビューしたモデルを記録してください。別のランナーがレビューしたのに、Codex CLI がないことを、カバレッジの低下として報告してはいけません。
- ユーザーが求めたスコープ、判断、同意は保持してください。ユーザーに代わって、テレメトリやリモートのアーティファクト共有を有効にしてはいけません。gstack のインストールは、マージ、デプロイ、破壊的な操作、承認の回避を許可するものではありません。

## 保守

`bash scripts/install.sh --check` は健全性チェックです。`bash scripts/install.sh` はインストールまたは修復を行い、サポートされる最小バージョンを下回るチェックアウトを早送りします。最小バージョン同士の間では、`~/.local/share/gstack/bin/gstack-upgrade --check` で、チェックアウトが遅れているかを確認できます。`~/.local/share/gstack/bin/gstack-upgrade` は、デフォルトブランチの先頭まで早送りし、再インストールします(ダーティ、分岐、ピン留めされたチェックアウトは拒否し、stash や reset は決して行いません)。このインストーラーは、Git、curl、Node.js、flock、timeout がある Capy の Ubuntu クラウドマシン向けです。許可なく個人のデバイスで実行しないでください。
