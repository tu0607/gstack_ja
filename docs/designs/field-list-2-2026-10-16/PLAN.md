<!-- gstack-autoplan-scope: --no-ui --developer-tool -->
# gstack フィールドリスト 2(2026 年 10 月 16 日): gbrain クルーが gstack に求めるもの

## 実装計画

### 背景

これは計画の改訂 2 版です。改訂 1 版は 6 つの視点(CEO、DX、Eng。Claude Opus 5.5 のネイティブ視点と GPT-6.1 Sol の外部視点)でレビューされ、指摘は 50 件(重大 0、高 23)、ユーザーへの確認事項が 1 件(W13 の自動スコープを延期すること)でした。この改訂では全指摘を反映しています。各フェーズの扱いはレビュー記録に記載しています。実行の予算は最大 3 ラウンドです(今回は 2 ラウンド目)。3 ラウンド目のフェーズで指摘が残った場合は、「指摘付きで採用」として閉じ、ビルドに持ち越します。

オーナーの依頼(Garry、GBRA-108 経由、2026-10-16): 「それを新しいスレッドにして、マージキューに載せてください」。入力は、GBRA-40 のフィールドリスト 2(項目 1〜10 と Step 0)と、GBRA-108 の追記(項目 11〜14)です。どちらも 10 月 14 日〜16 日の gbrain スレッドのトランスクリプトから集めたものです。コーディネーターは GStack Minder(GSTA-36)で、マージキューを管理し、すべてのマージを行います。このウェーブでは、PR を作成して READY の報告を送ります。

ベース: origin/main `3e8b34d`(v1.91.106.0)。**ウェーブのすべての PR は #3190 の上に積み上げます**(`capy/next-wave`、v1.91.107.0、GSTA-31、READY 済みで次にマージ予定)。ほぼすべての項目が #3190 で書き換えられるファイルに触れるためです(bin/gstack-capy-install、bin/gstack-capy-session、capy/skill/gstack/**、lib/autoplan-*.ts、lib/pregate/{index,config,context,runtime,supervise,types}.ts、lib/pregate/checks/{guards,lanes}.ts、lib/plan-reality.ts、lib/ship-receipt.ts、lib/result-codes.ts、ship/**、autoplan/DRIVER.md.tmpl、docs/{troubleshooting,pregate,unattended,capy-install}.md)。以下のコードの参照は、#3190 の head `03968f0` に対するものです。このウェーブで衝突してはならない他の進行中の担当は次のとおりです。#3200(GSTA-32: review-army のテスト)、#3225(GSTA-37: bin/gstack-upgrade の Windows パス、lib/pregate/checks/secrets.ts、lib/redact-patterns.ts、browse のルール 3、いくつかの review セクションのテンプレート)、#3226(GSTA-35: autoplan/SKILL.md.tmpl、autoplan/sections/dx-phase.md.tmpl、plan-devex-review/**、devex-review/**、lib/dx-error-*.ts、scripts/resolvers/{dx,index}.ts)、#3215(コミュニティ: lib/pregate/docs-lane.ts、lane-selection.ts)。これらのファイルを必要とするレーンは、該当 PR のマージを待ち、そのバージョンの上に作業します。競合する編集を分岐させることはしません。

**この計画の外で処理するもの。** Step 0(#3190 のマージ、#3209 は v1.91.106.0 としてマージ済み、gbrain のレーンでの新しいマシンでの受け入れ確認)は GSTA-31/GStack Minder の担当です。結果が誤っているため、ゲートを待たずに 2 件の早期対応 PR を出します。**F1**(項目 13、インストールの正直さ)と **F2**(項目 12 の第 1 部、cso の部分入力の開示)です。レビュアーがウェーブ全体を把握できるようにここに記載していますが、この計画のゲートでは判定しません。

**ウェーブの形を決めたトリアージの訂正。** 項目 13 の根拠(「gbrain のマシンの多くは `gstack: ok 1.91.101.0` と報告しているが、main は 1.91.106.0」)は、主にタイミングによるアーティファクトでした。main は 2026-10-14 17:36Z から #3212 が 2026-10-16 20:29Z にマージされるまで v1.91.101.0 でした。v1.91.102〜104 はマージされていない PR 上のスタンプにすぎません。レーンのトレーラーは最新でした。本当の欠陥はもっと狭い範囲です。`--check` は `gstack-capy-session: behind origin/<b>: <old> -> <new> (<n> commits); fix: …` を単独の行で出力します(bin/gstack-capy-session)。しかしレーンは `gstack:` のトレーラーだけを報告するため、「behind」がすべての引き継ぎで失われています。同様に、項目 1 のコアとなるツールはすでに存在します。`gstack-restamp --after <pr>`(使い捨てのワークツリーで gate-ahead を実行し、.gstack/tmp/gate-ahead.json に記録)、`gstack-tree-receipt`(`TREE: same-modulo-stamps`、.gstack/ship-policy.json の stamp_files、`gate-reuse: eligible`)、`gstack-ship-receipt`(識別子優先の引き継ぎブロック)です。gbrain はすでにシッポリシー(`.gstack/ship-policy.json`、gbrain 90feaab2、2026-10-13: マージ時にスタンプ、stamp_files 13 件、stamp_patterns 5 件)をコミットしているため、tree-receipt は今でもそのスタンプを証明できます。gbrain のキューがスタンプの差分を手作業で証明していたのは、/ship がこれらのツールをコーディネーターのプロトコルにつなげておらず、コーディネーターにはレーンの主張を再検証するコマンドがないためです。

リポジトリの制約: SKILL.md は .tmpl から生成されます(`bun run gen:skill-docs`、`--host codex`)。ロジックは lib/*.ts にあり、薄い bin/ のエントリポイントから呼び出します。モジュールサイズの上限(1 モジュール 800 行、1 関数 150 行)。結果コードは lib/result-codes.ts に置き、docs/troubleshooting.md にアンカーを持たせます。すべてのテストのサブプロセスにはタイムアウトを設けます(spawnsync のトリップワイヤー)。テンプレートの編集には parity-suite と context-budget のラチェットを使います。E2E Evals は PR の push ごとに実行します(有料のゲートは事前承認済み。push はまとめて行う)。

テーマ: **gbrain クルーのコーディネーターは、もう手作業で証明しません。スタンプ、承認、フレーク、古いインストールは、ツールが出力する行になり、gstack のどのレポートも、実際に持っている以上のカバレッジを主張しなくなります。**

### リリースの約束

- **P1. コーディネーターは、印刷された行だけで共有マージキューを回せます。** 手作業で組んだスタンプの差分は不要です。ready report、証明付きのスタンプ、gate-ahead、並べ替え時の restamp を含みます。
- **P2. オーナーの承認を必要とするものは、引用された承認なしに出荷されません。** データの修復はアップグレード時には決して実行しません。
- **P3. どのレポートも、確認した範囲以上を述べません。** cso はスキップしたものを一覧にし(F2)、インストールのトレーラーは遅れているときにそう示し(F1)、書き出した成果物にはマシンのパスを含めず、レーンとレビュアーは必ず実際の `gstack:` トレーラーを報告します。
- **P4. タイミングに依存するテストは、マージ前に検出されます。** また /investigate には、上限を決して引き上げないフレーク対応の手順書があります。
- **P5. /autoplan は予算を守ります。** ランナーが強制するラウンド上限と支出上限があり、フェーズは「指摘付きで採用し、ビルドに持ち越す」として閉じられ、確認ラウンドは差分だけをレビューします。

### 前提の表

| 前提 | 主張 | 根拠 | 判定 |
|---|---|---|---|
| P-a | main は 2026-10-14 17:36Z から 2026-10-16 20:29Z まで v1.91.101.0 だった | `git log --format='%h %cI' origin/main`: 47d639a 2026-10-14T17:36:39Z、a889ef9 2026-10-16T13:29:38-07:00 | 真 |
| P-b | --check が "behind" を出すのはトレーラーからだけ | bin/gstack-capy-session(#3190 の head)のチェックブランチ、`echo "gstack-capy-session: behind origin/…"` | 真 |
| P-c | #3190 の `latest:` の注記には bootstrapper のラッパー 2 が必要。Drive のコピーはラッパー 1 | #3190 の capy/skill/gstack/scripts/install.sh `GSTACK_CAPY_WRAPPER=2`。このマシンは `gstack-capy-skill: wrapper 1` と出力 | 真 |
| P-d | restamp --after、tree-receipt、ship-receipt は存在する | bin/gstack-restamp:5、bin/gstack-tree-receipt:5、bin/gstack-ship-receipt:5 | 真 |
| P-e | gbrain は stamp_files を含むシッポリシーをコミットしている | `gh api repos/garrytan/gbrain/contents/.gstack/ship-policy.json`(829 バイト、コミット 90feaab2) | 真(改訂 1 版では偽としていた) |
| P-f | autoplan には --spend-cap があるが、ホストのサブエージェントの試行は $0 を予約する | lib/autoplan-run.ts:212。今回の実行の spend.json では `estimate_usd: 0` | 真 |
| P-g | cso は 64 MiB を超えると拒否し、「より小さいチェックアウト」を勧める | lib/cso/snapshot.ts:54,66 | 真 |
| P-h | cso は 1 MiB を超えて保留されたファイルを、上限に対して全サイズで数える | lib/cso/snapshot.ts:683(読み込み前にサイズを加算) | 真 |
| P-i | GBRA-102 の restamp の拒否(「上位のマスターに別の PR のエントリがある」) | フィールドリストのみ | 未検証 |
| P-j | #6792 は取り消しを行う accept のパスを出荷した | フィールドリスト。gbrain #6807 のホットフィックス | 未検証(gbrain リポジトリ) |
| P-k | GBRA-117 のランナーは、停止要求の後に Eng を強制した | 追記のみ | 未検証 |

未検証=3

### 完了済み

`git log origin/main --since=2026-10-14` で名前の挙がったファイルを確認しました。#3209(v1.91.106.0)と #3212(v1.91.105.0)は、W1〜W12 の新しい面のどれにも触れていません。#3190(オープン)はすでに pregate の `requires-remote` パス、autoplan のチェックポイントディレクトリ、`rec` のゲートへの返信、`latest:` トレーラーの注記を含んでいます。この計画はそれらの上に作り、やり直しはしません。

### 面の確認

Issue #3190 の head で `--help` またはソースにより確認済み: `gstack-restamp --after/--expect-base/--expect-order`、`gstack-tree-receipt --gated/--from`、`gstack-ship-receipt write/read/census`、`gstack-autoplan next --spend-cap/--estimate-usd`、`gstack-autoplan revise`、`gstack-lane-check --planned`、`gstack-cso start --diff/--base/--scope`。新しい面は新規と明記しています。

### 拘束力のある決定

- すべてのマージは GStack Minder が行います。レーンは READY を送り、スロットの呼び出し前には決してスタンプを押しません(CREW.md 6)。
- #3190、#3200、#3225、#3226、#3215 が担当するファイルは、マージ後にその上に作業し、分岐させません。
- このランの autoplan の予算: 3 ラウンド。その後は指摘付きで採用(GStack Minder、2026-10-16)。

### 数値

- 改訂 1 版のレビュー: 指摘 50 件、高 23 件、重大 0 件 [計測: findings.jsonl の実行結果]。PR を 1 本追加するごとのキューのコスト: スロット 1 つ、スタンプ 1 回、Ubicloud での無料スイート 1 回、push ごとの有料 E2E 実行 1 回(約 $93 [計測: GSTA-37 の実行 38969924945、$93.06])。
- cso の計数のもとでの gbrain のソースのバイト数の取り込み分と保留分 [ビュー前に再計測: W13 のスパイク]。

### 延期した要望

- 項目 12 「cso はリポジトリ全体を必要としない / 最悪の兄弟」: 自動の兄弟ディレクトリの展開(W13)は、計測スパイクの後まで延期します。F2 は、明示的で開示されたスコープを今出荷します。
- 項目 13 「セッション開始時に自動でアップグレードする」: インストールモードでは main ですでに実現済みです(SELF_UPGRADE)。F1 は残りの古いケースを見えるようにするものであり、--check にアップグレードを追加するものではありません。
- 項目 1 「gstack は gbrain 固有の情報を持たない」: そのまま維持します。gbrain のポリシーの変更は、gstack の PR ではなく、GStack Minder を通じて gbrain クルーへの引き継ぎとして扱います。
- 項目 5 の根本原因(マシンの入れ替え)は Capy の担当です。報告のみとし、回避策は実装しません。

### PR の数

gstack のシッポリシーは、ウェーブごとに PR 1 本をデフォルトとしています。このウェーブでは 4 本を求めます。F1 と F2 は、ウェーブの外にある早期対応の欠陥修正です(S1 インストールの正直さ、誤ったセキュリティ結果)。ウェーブ本体は 2 本の積み上げ PR、A の後に B とします。B の ship/review/pregate の作業と A の autoplan/install の作業はファイルとしては別ですが、result-codes.ts、troubleshooting.md、ラチェットのフィクスチャを共有しているため、積み上げることでそれらのファイルの所有者を一本化できます。PR を 1 本追加するごとに、キューのスロット 1 つと、push ごとの有料 E2E 実行 1 回がかかります [見積もり: 各約 $93]。

### 早期対応(ここではゲートしない)

- **F1. インストールのトレーラーに "behind" を載せる(項目 13。#2378 の Capy 側)。#3190 の head の b1f7119 で作成済み。** bin/gstack-capy-session は、セッションが origin より遅れて終わるたびに GSTACK_CAPY_BEHIND/_BEHIND_TO/_BEHIND_FIX を出力します(このランの fetch の FETCH_HEAD を使う。ラッパー 1 の Drive コピーでも動作)。bin/gstack-capy-install は、ok トレーラーに `behind=<n> (latest: <v>); fix: <command>` を付け、`latest:` と置き換えます(遅れの注記は 1 つだけで、両方は出さない)。修正の文字列には `; ` の区切りを決して含めません。再実行で fast-forward できるときは `bash <wrapper> [--for <skill>]`、チェックアウトが dirty、detached、または分岐しているときは `<root>/bin/gstack-upgrade`(自身の拒否メッセージを出力する)、無効化されているときは `unset <VAR>, then …` です。ドキュメントと capy スキルには「behind= のあるトレーラーは、修正コマンドを実行することを意味する」と書きます。下限: スタンプの時点で GSTACK_MIN_REVISION を F1 自身のバージョンまで引き上げます。
- **F2. cso が部分入力を開示する(項目 12 の第 1 部)。作成中。** `gstack-cso start --paths <prefixes>`: スコープ外のファイルは、ファイル単位のマニフェストのエントリになります。`originalHash: not-read` と `withheld: outside the --paths audit scope`(`excluded:` ではなく、空白として扱う)です。これにより snapshot-inputs のカバレッジは `partial` になり、レポートにはスキップしたものが一覧されます。スコープ外のバイトは 64 MiB の累計に含めません。`--diff` で変更されたパスが `--paths` の外にあれば拒否します。diff の検出器は、読んでいないエントリを内容で変更済み・未変更のどちらとも扱いません。recheck と replay は `--paths` を引き継ぎ、保留されたパス内の指摘は拒否します。ペイロード上限のメッセージだけが `--paths` を案内します。マニフェスト(16 MiB)とエントリ数の上限は、容量超過のガイダンスを残します。ファイル単位のエントリは、そこでも数えられるためです(gbrain サイズのリポジトリ、約 7,500 ファイルでは約 2 MiB が必要)。

### ウェーブの項目

**PR A: autoplan、install、eval-plan(W5、W6、W7、W8、W9、W11)。**

**W5. Autoplan の予算(項目 11、高)。**
- 最初の `next` に `--max-rounds <n>` を付けます(無人実行ではデフォルト 3)。run.json に保存し、ラウンドは state.history のフェーズごとの reopen イベントから数えます。
- 上限に達したら、lib/autoplan-gate.ts の closePhase の隣に `closeDeferred(state, phase, reason, by)` を置きます。上限の処理と、新しいコマンド `gstack-autoplan close --phase <p> --deferred "<reason>" --by <who>` から使います。未完了のボイスをスキップ扱いにし、その予約を解放し、export/validate/resume が動くように deferred のコンセンサスファイルを書き、未解決の指摘を tasks.jsonl と、重大度ごとの件数を示すゲートのセクションにコピーします。自動で閉じるのは、未解決の Critical、緊急の指摘、保留中のユーザーからの異議が残っていないときだけです。それ以外は、オーナーのためのゲートの項目になります。
- 上限に達したフェーズの後の `revise` は、そのフェーズを reopen しません。代わりに、ゲートの承認項目「<phase> の上限後に計画が変更された: 未レビューの差分」を差分の要約とともに追加します。これにより上限を回避できず、差分が黙って出荷されることもありません。
- 支出: Capy での無人実行は、見積もりのないホストの試行に対して、ボイスごとに表示されるデフォルト値(`--estimate-usd`、デフォルトは DRIVER に記載)を予約するため、`--spend-cap` が効きます。ホストの支出は、ラウンド数と並べて引き続き `unknown` と報告します。`budget_exhausted` は再開可能な状態で、構造化された cap/rounds/spend のフィールドと、表示される復旧コマンド(close-deferred、またはオーナーが承認した上限の引き上げ)を持ちます。
- 確認ラウンド: プロンプトには、最後にレビューした改訂以降の計画の差分と、決定済みの事項を含めます。指摘には改訂を含む ID を付け、以前の発生と関連付けます。決定済みのスコープに関する指摘は、決定の記録にない計画差分のハンクまたは file:line を引用している場合にのみ再オープンします。それ以外は `settled` と記録します。
テスト: Critical が残った状態での上限クローズがゲートに回ること。上限後の revise。budget_exhausted 後の再開。deferred クローズ後の export と validate。

**W6. マシンのパスを含まない公開用エクスポート(項目 6、中)。** `gstack-autoplan export --public <dir>` は、非公開の実行を変更せずにサニタイズされたコピーを書き出します(resume とバインディングは変更なし)。書き換えるのは、実行で記録されたマシンのルート(出力ディレクトリ、home、plan_input のディレクトリ、チェックポイントのディレクトリ、ワークツリーのルート)だけで、リポジトリ相対のパスか `<local notes (not committed)>` になります。派生ファイルには独自のダイジェストを持たせ、来歴に非公開のダイジェストを記載します。`gstack-artifact validate --public` は、記録されたルートがあると失敗(`ARTIFACT_MACHINE_PATH`)し、一般的な home パスのパターンには file:line 付きの WARN を出します。plan.md のインラインコードとフェンスは書き換えません。回帰: gbrain-evals #164 の形。

**W7. レーンの耐久性(項目 5、中)。** DRIVER.md のコーディネーターの契約と /ship の複数レーンのガイド: 各ステップの後、レーンのブランチに WIP コミットを push し、ゲートは push 済みの SHA から実行します。Capy で GSTACK_AUTOPLAN_CHECKPOINT_DIR が未設定のとき、ランナーは検出した非公開の project-user の Drive フォルダと、正確なエクスポート行(`CHECKPOINT: unset; to survive machine replacement: export GSTACK_AUTOPLAN_CHECKPOINT_DIR=<dir>`)を表示します。`gstack-config set autoplan_checkpoint drive` で opt-in している場合にのみ、そこをデフォルトにします。チェックポイントは、バインドされた各ボイスとフェーズ遷移の後に取ります。resume はバインド済みのボイスを再割り当てしません。

**W8. 事前登録のドライラン(項目 7、中)。** lib/eval-plan.ts の gstack-eval-plan の下(plan-reality ではない): 事前登録では、合成フィクスチャファイルと、診断ごとに期待される件数を宣言します。`gstack-eval-plan check-prereg --allow-repo-commands` は、宣言された summarizer をそのファイルに対して実行し、件数の不一致または未宣言の診断があれば、凍結コミットの前に `PREREG_DIAGNOSTIC_UNTESTED` で失敗させます。

**W9. 評価モデルのルールのリント(項目 10、低)。** 任意の `.gstack/eval-models.json` に allow/deny/tier の制約(「fable: smoke only」「deny gpt-5.4-mini」「ファミリーごとに最新の世代」)を置きます。既存の MODEL_CATALOG で解決し、gstack-eval-plan は各アームのモデルをそれに照らしてリントします。CLAUDE.md の散文は解析しません。

**W11. すべてのマシンが実際のトレーラーを出す(項目 9 と 14、低)。** `--for review-voice`: クローンまたは fast-forward に加え、ヘルパーランタイムの Bun(gstack 自身の最低要件。対象リポジトリのテストの固定版ではない)。./setup もホストのプロファイルも不要です。認証されるのは、gstack-pregate の sealed、gstack-plan-reality、gstack-artifact、gstack-autoplan の submit 側の読み取りだけです。SKILL_REQUIREMENTS の行を加え、admission が重い作業を `--for <skill>` の修正付きで拒否するようにします。インストールされていないときの修正行と、レビュアー/レーンへの説明には、Drive のスキルがないマシン向けのフォールバック(`git clone --depth 1 … && bin/gstack-capy-install --for review-voice`)を含めます。予算: ウォーム時 20 秒未満。テストで計測します。

**PR B(A の上に積み上げ): ship、review、pregate、update-check(W1、W2、W3、W4、W10、W12)。**

**W1. /ship のキューモード(項目 1、高)。** エントリは 1 つ、`bin/gstack-ship-queue`(lib/ship-queue.ts)。プロトコルの各ステップごとにサブコマンドがあり、各サブコマンドは `GSTACK_RESULT: skill=ship-queue …` で終わります。gstack-restamp は基本プリミティブのままです。
- `ready`: コーディネーターの契約の識別子優先の順序による 1 つのブロック。加えて head の SHA、`version: unstamped`、その正確な head での CI の状態、pregate の行。ツリーが push 済みの head と異なる場合は拒否します。
- `stamp --version <X> --expect-gated <sha> --expect-base <sha> [--expect-order <prs>]`: すべての証明の入力を事前確認し、各段階をジャーナルに記録し、restamp を実行します(ベースの移動 → `QUEUE_STALE`)。コミットし、tree-receipt を実行し、`QUEUE_STAMP: <pr> <version> head=<sha> gated=<sha> tree=same-modulo-stamps receipt=<sha256>` を出力します。同一の再試行は再開するか、既存の結果を返します。拒否の場合は head と、何かコミットされたかどうかを報告します。決して push しません。
- `verify --pr <n> --gated <sha>`: コーディネーターが実行します。PR の head を取得し、そこで tree-receipt を再実行するため、QUEUE_STAMP は貼り付けられた主張にはなりません。
- `gate-ahead --after <pr>`: マージ後のワークツリーを準備し、gated の sha とリポジトリのゲートコマンドを出力します。呼び出し側がそれを実行します(バックグラウンドまたは CI)。`gate-ahead --record --exit <rc> --log <file>` は、結果を gated のツリーに結び付け(PR をキーとする)、ワークツリーを削除します。
- ship-policy: 任意のキー `gate_command` と `full_e2e`。このウェーブ以降、未知のキーは POLICY_INVALID で失敗させる代わりに WARN します(導入されたバージョンを明記)。これにより、バージョンが混在するクルーでも動き続けます。
- docs/ship-policy.md「共有マージキューを回す」: 各関係者がコピー&ペーストする手順と、期待される行。
- 受け入れ基準: gbrain のコミット済みポリシーを使い、記録された gbrain のペアのフィクスチャで、実際の gbrain のスタンプコミットに対して tree-receipt が `same-modulo-stamps` と出力すること。lib/restamp.ts を変更する前に、フィクスチャで GBRA-102 の拒否(P-i)を診断すること。

**W2. 承認クラス(項目 3、高)。** gstack-banned-terms をモデルにします。`gstack-approval-classes init|validate|check --base <ref>` は、ヒットごとに `APPROVAL_CLASS: <class> <file>:<line>` を、また `APPROVAL_CLASSES: ok|found=<n>|none` を出力します。クラスは、コミット済みのベースブランチの `.gstack/approval-classes.json`(glob、リテラルパターン、クラスごとの allowed_paths)から取得します。マイグレーションは ship-policy の `migrations` キーから取得します。組み込みの検出器は報告のみを行います。強制のポイントは `gstack-ship-receipt write` です。宣言されたクラスで `Approved by <owner> <YYYY-MM-DD> via <ref>` がない場合は `APPROVAL_CITATION_MISSING` で拒否します。receipt には承認のオブジェクトを記録します。引用は解決されます。plan の sha は、その決定を含む autoplan の APPROVED ゲート記録と一致しなければなりません。URL は ship-policy のメンテナーによるコメントまたはレビューでなければなりません。それ以外は `citation: unverified` と記録し、コーディネーターに渡します。データの修復は明示的で、先にプレビューし、アップグレードやマイグレーションの経路からは到達できないものにします(/review のルール)。

**W3. ステートマシンのラウンドトリップ行列(項目 4、高)。** 改訂 1 版から変更なし。/review の専門家が、差分から kind × owner action × 結果の行を作り、セルをテストに対応付け、欠けているセルを High として挙げます。証明: 記録されたレビューからの #6792 の形を、無料の回帰テストとして作り、有料の `behavior` ケースを 1 つ追加します。

**W4. タイミングアサーションのチェックとフレーク対応の手順書(項目 2、高)。** lib/pregate/checks/timing.ts: 追加または変更されたテストの行について、経過時間の wall/CPU 時間を上限と比較する箇所と、sleep してからアサートする箇所をフラグします。`TIMING_ASSERTION: <file>:<line> <pattern>` とサマリを出力します。エスケープは、その行または直前の行の任意のコメント構文に `gstack-timing-ok: <reason>` を書くことで行い、理由は必須です。ブロックするか警告するかを決める前に、gbrain の 5 件のフレーク差分と gstack 自身のテストツリーで計測します。P4 は、計測がブロックを支持しない限り「マージ前にフラグする」とし、支持すればブロックします。/review のチェックリストにも同じルールを適用します。/investigate にはフレーク対応の手順書を追加します(main と PR の head での同負荷の分布、強制プローブ、外部要因の証拠があるときだけ再実行、上限は決して引き上げない)。

**W10. Pregate の設定の摩擦(項目 8、中。#3190 と #3225 の後)。** #3215 を、作者のコミットを残したまま取り込みます。その前に、信頼できない入力のレビューと、レビュアーが書いたテストを行います。gbrain 型のフィクスチャ(`ci:ubicloud`、`UBI_OWNER`)で #3190 の `requires-remote` パスを確認し、それで示された点だけを修正します。

**W12. update-check が、リリースされていない main の動きを検出する(#2378 の Claude Code 側、中)。** VERSION が等しく、ls-remote の main の SHA がローカルの HEAD と異なる場合、既存の受け取った curl を通じて GitHub の compare API(`status`、`ahead_by`)を問い合わせる。今と同じようにキャッシュする。`UPGRADE_AVAILABLE <ver> <ver>+<n> <short sha>` を出力する。スヌーズは SHA をキーにする。分岐している場合や compare が不明な場合は、`CHECK_FAILED` に似た不明として扱い、最新とも、アップグレード可能とも扱わない。決して fetch しない。gstack-upgrade/SKILL.md.tmpl の質問文と CHANGELOG の段階は、バージョンが等しい場合を扱う(置換のテスト)。

**W13(延期). cso の自動スコープ(項目 12 の第 2 部)。** 計測のための調査だけ。cso の数え方での gbrain の取り込み量と除外量(P-h)。除外された 1 MiB 超のペイロードが上限超過の原因なら、修正は上限の計算方法の変更である(オーナー Garry の判断。数値を添えて報告する)。スコープのヒューリスティックではない。自動の兄弟の展開は、切断された兄弟、代替の転送経路、動的な登録、打ち切りの陰性の対照によって、その限界が示された後にのみ構築する。記録された HEAD の git オブジェクトを対象にし、lib/pregate/import-graph.ts のビルダーを再利用する。

### デリバリーの形

| PR | 内容 | ベース | 待つもの |
|---|---|---|---|
| F1 | 項目 13 のトレーラーと下限 | #3190 の後の main | #3190 |
| F2 | 項目 12 の第 1 部 | main | — |
| A | W5、W6、W7、W8、W9、W11。ウェーブの結果コードとアンカーを登録する | #3190 の後の main(W11 は F1 も) | #3190、autoplan のテンプレートのために #3226 |
| B | W1、W2、W3、W4、W10、W12 | A のブランチ | A。pregate のために #3225。レビューのテストのために #3200 |

各 PR: 互いに対して `gstack-lane-check --planned` が通ること。修正中は集中したテスト。凍結したツリーで Ubicloud 上の無料スイートを一度。`bun run eval:bg:pr`。/review がクリーン。GStack Minder に READY を送る。

### 対象外

Capy 側のマシンの入れ替え(項目 5 の根本原因)と、スキルのマウント(GBRA-56/65): Capy に報告する。gbrain リポジトリの設定の変更: GStack Minder を通じて gbrain チームに引き渡す。

## レビュー記録

- CEO r1(ネイティブ Opus 5.5: High 6、Medium 6。外部 GPT-6.1 Sol: High 4、Medium 1、ユーザーへの確認事項 1): lane-check の共有ファイル → PR A が codes を所有し、B が積む。QUEUE_STAMP を検証可能に → `verify`。ベースが動く競合 → --expect-base。gbrain のポリシー → P-e を修正し、実際のスタンプで受け入れ。引用を解決。支出の上限は効く。上限が Critical を埋もれさせない。W13 は先に計測して延期(ユーザーへの確認事項を取り込んだ)。W4 は計測。W7 はオプトイン。F1 は遅れの注記を一つだけ。W8 は宣言されたフィクスチャ。W6 は別の公開パッケージ。チェックポイントは、バインドされた voice ごとに取る。
- DX r1(ネイティブ: High 3、Medium 6、Low 1。外部: High 1、Medium 3): W6 は記録されたルートのみ。W2 は banned-terms のモデルで、宣言されたクラスのみ。ship-policy の未知のキーは WARN。ship-queue の入口は 1 つ。READY の形式は 1 つ。調整役の手引き。F1 は注記の中に `; ` を入れない。W12 の出力とスヌーズ。W11 のフォールバックと計測された予算。W4 の行の形式。budget_exhausted は再開可能。stamp の再試行のセマンティクス。review-voice のランタイムの境界。cso の助言は失敗の種類ごと。
- Eng r1(ネイティブ: High 4、Medium 5、Low 1。外部: High 2、Medium 2): closeDeferred と、上限後の revise。W2 の強制は ship-receipt に、マイグレーションは policy から。F2 のマニフェストとエントリの上限を開示。W12 の compare API。W13 は git オブジェクトを対象に、import-graph を再利用。W8/W9 は MODEL_CATALOG を使う eval-plan の中に。gate-ahead は --record を伴う非同期。gate の上の pr_count。F1 のチェックモードの修正(dirty/detached のチェックアウト)。F2 の差分の検出器と replay の契約。ラウンドをまたいだ修飾された指摘 ID。
