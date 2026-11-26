入力: ceo 2937ab4ea148f3a53969c36337bdca53476892d5f7e8d8b1556bfa8763df6845

ネイティブのプロンプトファイル(202 行、41937 バイト)から、全文を読んでレビューしました。以下の証拠は、計画の基準である origin/main `91bbd9e`(v1.91.69.0)のライブのチェックアウトから取っています。

## ステップ 0

モード: SELECTIVE EXPANSION。計画が、親エージェントが依存する契約を過小に作っている部分では拡張する(アーティファクトのスキーマ、採用の測定、評価ハーネスと衝突しないセッションの種類)。フィードバックで効果が確認されていない機能の幅は、保留または延期する。

### 前提の表

| # | 計画からの前提 | 証拠 | 判定 |
|---|---|---|---|
| 1 | Capy のユーザースコープのインストーラーの `--check` は、失敗時に何も出力しない素の `test -x` の連鎖である | `~/.capy/drive/user-garry-tan/skills/gstack/scripts/install.sh:7-16`(`test -x ... \|\| return 1` の連鎖)、`:32-35`(`--check` は失敗時に出力なしで `check_install; exit 0` を呼ぶ) | 妥当 |
| 2 | `bin/gstack-doctor` はコンポーネントごとに 1 つの `check_*` の行を持ち、修正の行を出し、`fail` で終了コード 1 を返す | `bin/gstack-doctor:8-12`(契約)、`:441-456`(行の呼び出しと `[ "$N_FAIL" -eq 0 ]`) | 妥当 |
| 3 | Doctor には `--check`、`--json`、`--require`、Node の行がない | `bin/gstack-doctor` をそれらのトークンで grep: 無関係な `server-node.mjs` のヒット(`:296`)のみ | 妥当 |
| 4 | `gstack-session-kind` は `spawned \| headless \| interactive` を分類し、明示的な `GSTACK_SESSION_KIND` の上書きとして尊重されるのは `spawned` だけ | `bin/gstack-session-kind:33-36`(spawned の上書き)、`:47-50`(`GSTACK_HEADLESS` → headless)、`:59-62`(`CI`/`GITHUB_ACTIONS` → headless) | 妥当 |
| 5 | `headless` は、どの質問でも BLOCK することを意味し、自動で続行するのは `spawned` だけ | `scripts/resolvers/preamble/generate-ask-user-format.ts:15`(spawned は自動で選ぶ)、`:28`(`headless` → `BLOCKED — AskUserQuestion unavailable`) | 妥当 |
| 6 | アップグレード/テレメトリ/レイク/プロアクティブのプロンプトは、`spawned` の場合だけ抑止される | `bin/gstack-skill-start:96`(update-check の周りの `if [ "$_SESSION_KIND" != "spawned" ]`)、`:394`(発行ブロックの周りの同じガード) | 妥当 |
| 7 | スナップショットの `init` は生のプランを `## Implementation plan` で包む | `bin/gstack-autoplan-snapshot.ts:413-417` | 妥当 |
| 8 | レビュー記録の `status`/`unresolved` はモデルが書き、指摘から導出するものはない | `bin/gstack-review-log:88-93`(記録をそのまま `bindReview` に渡す)、`lib/review-evidence.ts:178-186`(コミットとツリーだけを束縛する) | 妥当。ただし計画が省いているニュアンスがある: `reviewFreshness` は、`status: clean` かつ `issues_found > 0` を、読み取り時にすでに `UNVERIFIED` へ降格させている(`lib/review-evidence.ts:238-240`)。欠けているのは検出ではなく、書き込み時の導出である |
| 9 | `gstack-version-bump write` は、VERSION/package.json/ロックを 1 つのハードコードされた書き込み後フックでスタンプする | `bin/gstack-version-bump:373-402`(`regenAgentsDigest`、`--regen-digest` でのオプトイン、パスはハードコード) | 妥当 |
| 10 | `bin/gstack-next-version` はすでにライブの PR キューと兄弟の worktree を読む | `bin/gstack-next-version:78-106`(`claimed`、`siblings`、`active_siblings`、`pickNextSlot`) | 妥当 |
| 11 | `gstack-evidence` はツリーのフィンガープリントを記録する | `bin/gstack-evidence:10-13`、`:388-396`(`tree`、`dirty`、wtree の TOCTOU ガード) | 妥当 |
| 12 | `ship/sections/measure.md.tmpl:3-16` には、決して緩めない再実行の規律がある | `ship/sections/measure.md.tmpl:3-7` | 妥当 |
| 13 | `codex_reviews` の既定値は `enabled` | `bin/gstack-config:251` | 妥当 |
| 14 | 有料の評価(Step 6)は、Step 16 の安価な生成チェックより前に走る | `ship/sections/tests.md.tmpl:54`(Step 6 の評価)、`ship/SKILL.md.tmpl:371-389`(Step 16 の段階 1 が宣言された生成/ビルドのコマンドを実行する) | 妥当 |
| 15 | `/investigate` には、フレーク、ポリュータ、レース、バックログの内容がない | `investigate/SKILL.md.tmpl` の grep: `:165` の表の 1 行 `Race condition` のみで、手順はない。フレーク/ポリュータ/バックログのヒットはない | 妥当(レースについて 1 行の言及のみ、手順はない) |
| 16 | 事前登録、パネル、予算は gstack の内部のもの | `scripts/ship-measure.ts:22-28`(取り込みの予算)、`scripts/judge-calibration.ts:42`(`split: 'dev' \| 'heldout'`)、`test/helpers/periodic-exclude-data.ts:79-92`(`EVAL_POLICY`) | 妥当 |
| 17 | Doctor の codex の修正の行は、`OPENAI_API_KEY` のログイン経路を示していない | `bin/gstack-doctor:186`(`codex login, or export CODEX_API_KEY`)、`TODOS.md:1639-1641`(`codex login --with-api-key` の CI 専用の使用) | 妥当 |
| 18 | `./setup --status` は常に終了コード 0 を返す | `setup:146`(ステータスの行の後に無条件の `exit 0`) | 妥当 |
| 19 | `--no-browser` は文書化されていない。存在するのは `GSTACK_SKIP_PLAYWRIGHT=1` だけ | `setup` で `--no-browser` を grep: なし。`setup:2071-2072`(`GSTACK_SKIP_PLAYWRIGHT`)、`setup:1505-1512`(`GSTACK_SKIP_FONTS`) | 妥当 |
| 20 | `GSTACK_CODEX_MODEL` は `select-model` で尊重される | `bin/gstack-codex-probe:143-147`、`:456`、`:497` | 妥当 |
| 21 | `capabilities.questions` を読むリゾルバーはない(「Codex ホストなし」の根拠) | `scripts/host-config.ts:178` だけが値を検証する。`scripts/resolvers/` 以下に読み取り側はない | 妥当 |
| 22 | モジュールサイズの ratchet は 800 行 / 関数あたり 150 行。`gstack-next-version` 822、snapshot 865、`setup` 4662 は増やしてはならない | `test/module-size-ratchet.test.ts:2`、`wc -l`: 822 / 865 / 4662 | 妥当 |
| 23 | `nativeDispatchPrompt` は `snapshot.json` にすでに存在する | `bin/gstack-autoplan-snapshot.ts:661-669` | 妥当 |
| 24 | 実行中の Bun は 1.3.14、リポジトリの要件は 1.4.2 | `bun --version` → 1.3.14。`package.json:80-81`(`engines.bun: ">=1.4.2"`)、`.github/workflows/arm-setup-smoke.yml:33` | 妥当(注: `engines` は `>=` の範囲であり、固定ではない) |
| 25 | 「27 スレッドのうち 13 件は、インストーラーを超える gstack のワークフローを一切実行しなかった」、そして道具の不足(低い知覚価値ではない)が原因だという因果の読み | リポジトリにもプロンプトファイルにも成果物はない。計画はスレッドごとの理由を示していない | 未検証(この波の決定的な前提) |
| 26 | 工数: A 1.5 日、B 1.5 日、C 1 日、D 1.5 日(CC+gstack) | 根拠がない。PR B だけで新しいバイナリが 5 つ、lib モジュールが 4 つ、事前ゲートのチェックが 11 件あり、それぞれに fixture がある | 未検証(3 節を参照) |
| 27 | `bin/gstack-hermetic-run` は `hermetic` のチェックで「再利用」できる | `bin/` にそのようなファイルはない。`buildHermeticEnv()` は `test/helpers/hermetic-env.ts` に存在する | 記述どおりには誤り(bin は新規。ヘルパーは再利用可能) |

### 既存のもの(スコープに関係するもの)

| 機能 | 場所 | 計画での使い方 |
|---|---|---|
| 修正の行と失敗時の終了コード 1 を持つ準備状況の行 | `bin/gstack-doctor:441-456` | A1 はモードを追加するもので、ツールは追加しない。正しい |
| セッションの種類の分類とプリアンブルの分岐 | `bin/gstack-session-kind`、`generate-ask-user-format.ts:15-28` | A3 が再利用する。衝突については 6 節を参照 |
| 生のプランの包み込み | `bin/gstack-autoplan-snapshot.ts:413-417` | A4 が文書化する。正しい |
| スナップショットにあるネイティブのディスパッチプロンプト | `bin/gstack-autoplan-snapshot.ts:661` | A6 が公開する。正しい |
| キューを考慮した次のバージョン | `bin/gstack-next-version:78-106` | B2 の `--next` がこれをラップする。正しい |
| ツリー/wtree のフィンガープリント | `bin/gstack-evidence:388-396`、`gstack-wtree` | B3 が合成する。正しい |
| レビュー行の読み取り時の不整合ガード | `lib/review-evidence.ts:238-240` | A7 はこれを引用し、書き込み時の導出だけを加えるべき |
| リポジトリが宣言する再生成のためのコード実行のオプトイン姿勢 | `bin/gstack-version-bump:373-385` | B4/B8 はこれを引き継ぐべきだが、今は引き継いでいない(6 節) |
| 承認の予算、較正の分割、EVAL_POLICY | `scripts/ship-measure.ts:22-28`、`scripts/judge-calibration.ts:42`、`periodic-exclude-data.ts:79-92` | D1 は 3 つすべてを一度に一般化する |
| ハーメティックな環境のビルダー | `test/helpers/hermetic-env.ts` | B8 の `hermetic` のチェック。bin のラッパーは新規 |

### ドリーム状態

どのマシン上の親エージェントも、インストールの 1 行を実行し、`gstack: ok` の 1 行を grep して、その後 `/autoplan` または `/ship` を無人で実行します。そして、散文を読まなくても行動できる、バージョン付きでスキーマ検査された JSONL を受け取ります。一方、オーナーは 1 ページの番号付きのゲートの一覧を受け取ります。計画の PR A は、autoplan についてはそこまで到達します。PR B は、受領書とリスタンプが一緒に入れば ship についてもそこまで到達します。PR C と D は、この波では dream 状態が必要としない幅です。

### 検討された代替案と計画への反論

1. **PR A だけを出荷して波とし、次に B を削って出荷し、C/D の前に採用を測定する。** 計画は暗黙に却下している(4 つの積み重ねた PR、D1)。本レビューはこれを推奨する(1 節、3 節)。
2. **`headless` を再定義する代わりに、第 4 のセッション種別(`unattended`)を作る。** 計画は検討していない。必要である(6 節)。
3. **バージョン付きのフィールドを持つ 1 つのアーティファクトのスキーマモジュールを、独立に記述された 6 つのファイルの代わりに置く。** 検討されていない。必要である(2 節)。
4. **Chromium は常に遅延させ、`--light` をユーザー向けのモードから外す。** 検討されていない。省略可能な単純化である(4 節)。
5. **17 個の現実の行を持つ計画レビューの代わりに、前提の表と 3 行にする。** 検討されていない。推奨する(4 節)。

## 1〜11 節

### 1. これは正しい問題か? 再定義で 10 倍になるか?

**指摘 1.1(高): この波は「13 の 27 スレッドは何も実行しなかった」を供給の失敗として扱い、PR A がそれを変えるかどうかを一度も測定しない。** 前提 25 は未検証である。同じくらいもっともらしい読みは、コーディネーターが駆動する直列のキューでは、ハーネスが正しく動くエージェントでも、gstack のワークフローが見えないリターンのためにコンテキストと時間を費やすので、リポジトリ自身のツールを選ぶ、というものである。その原因なら、PR A はインストールの嘘を直すだけで、誰も autoplan を実行しない。そのため PR B から D は、検証されていない前提の上に作られることになる。修正: 採用を、リリースの約束にする。A10 はすでに `analytics/autoplan-timing.jsonl` を書いている。そこと ship の受領書に `session_kind` と `consumer` のフィールドを追加する。そして P7 を定義する。「次の 10 件の Capy のスレッドがgstack をインストールしたら、少なくとも 6 件が、親が成果物を消費した headless のワークフローを 1 つ実行する(親のトランスクリプトを grep/jq で確認)」。PR C と D は、キューではなく、この数値に基づいてゲートをかける。

思考の本体は正しい(機械可読が先)。これは 10 倍のてこである。それに続く再定義は、アーティファクトの契約こそが製品であり、ツールはその実装にすぎないということである。計画はこれを逆にしている。17 個の新しいバイナリがあり、スキーマはゼロである。

### 2. 前提は明示されているか? 仮定されているか? どれが間違っていうる?

リポジトリレベルの前提は明示されており、ほぼすべてが成り立つ(上の表。23 件が妥当、1 件が記述どおりには誤り、3 件が未検証)。間違っていうるもので重要なもの:

**指摘 2.1(高): 6 つの出力ファイル、5 つの JSONL の形、スキーマのオーナーもバージョンフィールドもない。** `tasks.jsonl` は今日の per-phase スキーマを再利用すると言われている。`decisions.jsonl` と `findings.jsonl` はフィールドをその場で列挙している。ship の受領書はフェンスで囲まれたブロックである。`pregate.json` と `timing.json` は例で説明されている。6 か月後には、PR A の `findings.jsonl` に合わせて書かれた親エージェントは、PR C が `incident` を、PR D が `contributor` を加えると壊れる。修正: `lib/headless-artifacts.ts` 1 つで、すべてのスキーマを `schema_version` とともに所有し、TypeScript の型を export する。そして `phase-close`、`gstack-ship-receipt`、`gstack-pregate` が書き込み前に呼び出す `bin/gstack-artifact validate <file>` を用意する。`findings.jsonl` の行をレビュー記録の行の形に揃え、A7 の導出が 1 つの型の上の 1 つの関数になるようにする。

**指摘 2.2(中): A7 の「不可能になる」は誇張である。** `reviewFreshness` はすでに、未解決の指摘がある `clean` に対して UNVERIFIED を返している(`lib/review-evidence.ts:238-240`)。本当の欠陥は、不整合な行がまだ書かれていることと、ログのリーダーがモデルの書いた `unresolved` 件数を信頼していることである。修正: A7 の範囲を、「`--findings` が与えられたとき、bindReview は書き込み時に拒否する。`--findings` のないインタラクティブな行は `status_source: claimed` とタグ付けする」に絞り、既存の読み取り時のガードを引用して、検出が新しいものだと読者が誤解しないようにする。

**指摘 2.3(中): ランタイムの固定の意味論は、約束の対象となるマシンに対して定義が不十分である。** `engines.bun` は `>=1.4.2` という範囲である(package.json:80-81)。計画のメッセージは `pinned 1.4.2` と表示する。さらに重要なのは、Capy のクラウドイメージが Bun 1.3.14 を同梱しているため、既定のイメージでは、インストーラーが Bun をアップグレードしない限り `--check` が `gstack: ok` で終わることはありえないことである。A2 はそれを述べていない。そのため P1(「健全なマシンでは `gstack: ok` で終わる」)は、主要な対象では達成できない。修正: 行が失敗し、固定が満たせるときには A2 が `bun upgrade --version <pin>`(または `mise`)を実行する。A1 はメッセージで `range` と `exact` の固定を区別する。

### 3. 6 か月後の後悔のシナリオ

**指摘 3.1(高): 工数の表は信用できず、提供の形はそれに依存している。** PR B は、5 つの新しいバイナリ(`restamp`、`tree-receipt`、`regen`、`ship-receipt`、`pregate`)、4 つの lib モジュール、3 つの PR にまたがるキューのリプレイのテスト、ミラーリポジトリ、CHANGELOG の再ヘッダーに加えて、それぞれに独自の fixture がある 11 の事前ゲートのチェックであり、それを 1.5 CC 日で行うとされている。PR D は、13 節からなる新しいスキルと 3 つの lib の抽出を 1.5 日で行うとされている。実際の係数が 3〜4 倍なら、PR C と D は A と B の後ろに数週間置かれ、積み重ねられたベースは乖離し、計画自身のキューの事故(並べ替えの後のリスタンプ)が、B2 が直す前にこの波で最初に起きる。修正: 工数をバイナリごとに fixture の数で再見積もる。PR B を B1、B2(`--version` と `--next` のみ。`--after` と `mirror` は後続)、B3、B5、そして計画が fixture を実際に名指ししている事故に対応する 4 つの事前ゲートのチェック(`regen`、`strays`、`literals`、`lanes`+pipefail)に絞る。`guards`、`patches`、`integrator`、`hermetic`、`links`、`lint`、`ratchets` は、1 つのリポジトリで最初の 4 つを 1 週間回した後に、第 2 の事前ゲートの PR として出す。

**指摘 3.2(中): 事前ゲートは、リポジトリの実際の CI からずれていく第 2 の CI になる。** `lanes`、`guards`、`platform`、`integrator` は、`.github/workflows/*.yml` がすでにエンコードしていることを再導出している。6 か月後、リポジトリが CI のマトリクスを変えても、事前ゲートは古いマッピングから `Tiers ran: unit serial` と報告し続ける。修正: `lanes` と `platform` はレーンの一覧をワークフローのファイルから読む(A1 の `runtime pins` はすでにそれを解析している)。事前ゲートは独自のレーンの分類を持たない。

**指摘 3.3(中): 17 個の現実の行は、コンテキストの予算が制約になっている時期に、計画レビューを長くする。** 計画は、すべてのテンプレートの編集は `test/parity-suite.test.ts` と予算の ratchet を通過しなければならないと注記しているが、4 つのテンプレートに 17 個の条件付きの行と事故のメモを加えている。後悔は、スコープの検出器が誤作動する行(`Transaction semantics`、`Recall`、`Units` は、今日は存在しないスコープの信号を必要とする)に、計画レビューの予算を費やすことである。修正: 本レビュー自身が価値を示し、スコープの検出を必要としない 4 つの行(根拠つきの前提の表、すでに完了しているかの git の確認、サーフェスの確認、拘束力のある決定)だけを出荷する。残りの 13 件は、`detectDxScope` からのスコープ検出の証拠に基づくフォローアップまで延期する。

### 4. 十分な分析なしに退けられた代替案

**指摘 4.1(中): D1(4 つの積み重ねた PR)は、レビュー可能性を根拠にしているが、計画自身が事故と呼ぶキューのコストを根拠にしていない。** 先行して gate を通せない `/ship`(B2 の `--after` は PR B に入っている)のリポジトリでは、積み重ねた PR は、A のマージ後に PR B をリスタンプし、B の後に PR C を、C の後に PR D を手作業でリスタンプすることになる。これは、計画が排除を約束する「手動のスタンプ編集」そのものである。修正: A を先にマージする。次に最小限の B(B1+B2 の `--next`+B3+B5)をマージする。C と D で実際に使い、キューのツールは、それを出荷する波自身で証明する。

**指摘 4.2(低): `--light` をユーザーのモードとして残すか、Chromium を常に遅延させるか。** D9 はフラグ + 遅延インストールを選んでいる。`gstack-browser-ensure` が存在するなら、フラグは冗長である。既定のインストールは Chromium をスキップし、最初のブラウザスキルがインストールする。インストーラーのモードが 1 つ減り、`SKIP browser (light mode)` の状態も 1 つ減り、A2 も小さくなる。修正: 遅延を既定にし、86 秒を前もって払いたいマシンのために `--with-browser` を残す。

**指摘 4.3(低): A9 のオーナーの自由記述の返信の文法(`all except 3=b 7=no`、`d10 yes`、`1a 2a`)。** 計画は推測しないという点で正しいが、5 つの受け付ける方言は、オーナーが増えるたびに増えるパーサーになる。修正: 1 つの文法(`<id><option>` のトークンと `all`)にし、描画されたゲートの一覧が受け付ける返信の形を正確に表示する。引用されたフィードバックの返信は fixture になり、その 1 つの文法で解析できなければならず、できなければ未解析として報告する。

**指摘 4.4(中): D1 の `/eval-plan` は、セクションではなく製品である。** 13 個の箇条書き、3 つの lib の抽出(`pricing`、`spend-ledger`、`measure-bar`)、QA のソークのセクション、封印されたパスの自己チェックがあり、それが必要とする消費者は 1 つ(gbrain-evals)しかない。検討されなかった代替案: 支出の事故を防ぐ 3 つのステップ(事前登録のチェックリスト、`$0` のスタブの乾いた実行、台帳つきの価格付きのパイロット)だけを出荷し、計器の監査、封印されたパス、メモリの事前確認、ソークは、それを必要とするリポジトリに、2 つ目の消費者が現れるまで残す。

### 5. 競争上のリスク

ハーネスのベンダー(Claude Code、Codex、Capy 自身)は、ネイティブの構造化されたサブエージェントのプロトコルとプランモードに収束しつつある。gstack が保持できる持続的な優位性は、配管ではなく、意見の明確なアーティファクトの契約と、事故に基づくチェックである。リスクは、ハーネスがネイティブの「決定の一覧」形式を先に出し、gstack の 5 つの場当たり的な JSONL の形が翻訳の負担になることである。指摘 2.1 の、バージョン付きの単一のスキーマモジュールが、その備えになる。ハーネスが採用するかマッピングできる安定した契約である。それ以外に、計画が特に露出している点はない。

### 6. 計画がカバーしていないリスク

**指摘 6.1(重大): `headless` を再定義すると、既存のすべての `GSTACK_HEADLESS` と CI セッションの挙動が変わる。** 今日、`GSTACK_HEADLESS`(評価/E2E ハーネスが設定する、`bin/gstack-session-kind:47-50`)と `CI`/`GITHUB_ACTIONS`(`:59-62`)はどちらも `headless` に分類され、`headless` はどの質問でもブロックすることを意味する(`generate-ask-user-format.ts:28`)。A3 は `headless` に推奨の選択肢を取らせて続行させる。質問でスキルがブロックすることを今証明しているすべての有料の評価と E2E のケースは、代わりに自動で続行してしまう。これにより、同じケース名のもとで測定される挙動が変わり、PASS の意味が黙って書き換わる。計画自身の検証の規律(AGENTS.md の「失敗を再判定して合格を作り出さない」)が、構造上違反される。修正: 第 4 の種別 `unattended` を追加し、明示的な `GSTACK_SESSION_KIND=unattended` の上書きとしてのみ尊重する。`headless` の意味論は変えない。autoplan の headless の節と `{{HOST_ADAPTATION}}` は `unattended` をキーとする。Capy のインストーラーとスキルは `unattended` を設定する。P2 の文言もそれに合わせて変える。

**指摘 6.2(高): リポジトリが宣言したコマンドを実行する固定ファイルは、`gstack-version-bump` が意図的に採用した、オプトインの姿勢を失う。** `.gstack/generated.json` のコマンド(B4)、`.gstack/pregate.json` のガードのパターンとラチェットのコマンド(B8)、そして `release_tool`(B1/B2)は、すべて対象リポジトリのコードを実行する。`bin/gstack-version-bump:373-385` は、同じクラスの動作が `--regen-digest` の裏にある理由を説明している。敵対的なクローンでの存在の推測は、任意のコード実行になるからである。修正: `gstack-regen`、`gstack-pregate`、`gstack-restamp` は、`/ship` から呼ばれたとき、または `--allow-repo-commands` 付きでのみ、宣言されたコマンドを実行する。単独の呼び出しではコマンドを一覧にして終了コード 3 で終わり、`repo commands not executed (pass --allow-repo-commands)` と表示する。

**指摘 6.3(中): B3 の「同じ、スタンプを除いて」という判定は、`stamp_paths` が `release_tool` の触るすべてを列挙していることに依存する。** リポジトリのリスタンプのスクリプトが、`stamp_paths` の外でロックファイルやドキュメントの索引を再生成すると、`TREE: changed gate=required` となり、P3 の「既に通過したツリーは二度目のゲートを受けない」が、まさにそのポリシーのために作られたリポジトリで成り立たなくなる。修正: 受領書は、差分を `stamp_paths` に加えて `.gstack/generated.json` のパスと照合して分類し、残りの集合を名前つきで報告する。

**指摘 6.4(中): B2 の `--after <pr>` は、先行 PR の head をブランチにマージする。** `history: squash-ok` の下では、先行 PR がマージされるまで、PR は先行 PR のコミットを表示してしまう。後に先行 PR が force-push されると、受領書の `PREDECESSOR MOVED` の拒否では取り消せないマージコミットが残る。修正: gate-ahead は、先行 PR のマージを使い捨ての worktree(`gstack-wtree` はすでに存在する)で作り、そこでゲートを通し、先行 PR の head を `gate-ahead.json` に記録し、PR ブランチの履歴には決して触れない。

**指摘 6.5 (Medium): D3 は、どこにも定義されていない「メンテナーの集合」からコントリビューターモードを自動判定している。** 修正案: `CODEOWNERS` があればそれを読む。なければ push 権限を持つ `gh api repos/:owner/:repo/collaborators` を使う。どちらもなければオフにする。判定に用いた情報源は指摘内に記録すること。

**指摘 6.6 (Low): A2 の薄いラッパーが、マシン上にリポジトリが存在しない段階で「リポジトリのスクリプトを取得する」。** 修正案: ラッパーは既存のロックの下でリポジトリを clone する(または既存のものを再利用する)。そのうえで clone 先から `bin/gstack-capy-install` を実行する。生コンテンツの URL に依存しない唯一の経路なので、その旨を明記すること。

### 7. スコープ: スコープ外(確認済みおよび追加分)

計画に書かれた 4 つの除外事項は妥当であり、その根拠も正しい(capy のホスト対象は前提 21 に照らして検証済み)。本レビューは次を追加で除外する: B2 の `--after`/`mirror`、11 件の事前ゲートチェックのうち 7 件、17 件の現実性確認行のうち 13 件、`/eval-plan` の箇条書き 13 件のうち 10 件、自由記述のゲート文法の方言。詳細は「必須の成果物」を参照。

### 8. リリースの約束と実際の提供内容

P1、P2(`unattended` 付き)、P3(6.3/6.4 付き)、P4(縮小版)は、記載どおりに提供可能でテストもできる。P5 は 4 行の範囲で提供可能。P6 は 3 つの製品を 1 つの約束に詰め込んでいる。P6a(lane-check とエビデンスバンドル。安価で、今日すでにコーディネーターが利用している)に分割し、P6b(`/eval-plan`)と P6c(ゲート一覧を超えるオーナー向けの説明。A9 と D3 の最初の段落で既に提供されている)は延期すること。それ以外に指摘事項はない。

### 9. 検証計画

検証項目 2(API キー付きの Codex ログインを使い、この計画に対してヘッドレスの autoplan をエンドツーエンドで実行する)は、本文書中で最も強力な証明であり、PR A のマージゲートにすべきである。検証項目 3 のキュー再生は良いが、squash 履歴のケース(6.4)と、スタンプ以外のパスに触れる `release_tool`(6.3)を含める必要がある。検証項目 1 のインシデント用フィクスチャは、インシデントとテストの対応表を PR 本文ではなくファイル(`test/fixtures/multi-agent-wave/INCIDENTS.md`)としてコミットすること。さもないと、マージ時に失われる。重要度は低く、これ以上の指摘はない。

### 10. ゲートの決定 D1〜D10(指示に従い自動決定。修正されない限り推奨案を採用)

D1 4 つの積み重ねた PR: 記録どおりに採用。ただし 3.1/4.1 により修正(A、次に最小限の B、C/D は採用状況を見てから着手)。D2 ホストではなくセッションの種類: 採用。ただし 6.1 により修正(`headless` ではなく `unattended`)。D3 リポジトリ内のインストーラー: 採用。D4 `.gstack/*.json` の固定ファイル: 採用。ただし 6.2 により修正(実行はオプトイン)。D5 既定で事前ゲートがブロックする: 出荷される 4 つのチェックについて採用。D6 決して承認しない: 採用。D7 `/eval-plan`: 名称は採用。スコープは 4.4 により修正。D8 強制 CRITICAL のリスト: 採用。D9 遅延読み込みの Chromium: 採用。ただし 4.2 により修正(既定で遅延読み込み)。D10 コントリビューターモードを既定でオン: 採用。ただし 6.5 により修正(メンテナーの情報源を定義する)。

### 11. 方向性と複利効果

PR A が、バージョン付きの成果物モジュールと採用指標を備えて着地すれば、後続のすべてのツールは書き込み先となる契約と、自らを正当化するための数値を得る。仕様どおりに着地すれば、このウェーブは誤ったものを積み上げることになる。バージョン管理されていない契約の上に、より多くのバイナリを載せ、それを測る指標がない。文書全体で、この点だけが戦略上の分岐点である。

## 必須の成果物

### スコープ外(今回のウェーブ)

- `capy` のホスト対象(計画上の除外事項。検証済み: `scripts/host-config.ts:178` が `capabilities.questions` を読む唯一の箇所)。
- semgrep/gitleaks のインストール、ネイティブ Windows での `/cso`、`investigate --backlog` の issue のクローズ(計画上の除外事項。そのまま維持)。
- B2 の `--after <pr>` と `mirror`(B2 の `--version`/`--next` を 1 週間使ってから検討)。
- 事前ゲートのチェック `guards`、`patches`、`integrator`、`hermetic`、`links`、`lint`、`ratchets`(2 つ目の事前ゲート PR)。
- 前提表、既に完了した項目、サーフェスチェック、拘束力のある決定以外の現実性確認行。
- `/eval-plan` の事前登録チェックリスト、`$0` のスタブによるドライラン、台帳付きの有償パイロット、QA のソークセクション以外。
- 1 つの文法以外のオーナー返信の方言。

### 既存のもの

ステップ 0 の表を参照。結論として、P0 の各項目はすべて既存ツール上のモード、派生、または合成であり、これは正しい形である。計画は doctor、next-version、evidence、snapshot を作り直すことを適切に避けている。

### Error & Rescue のレジストリ

| エラー | 発生箇所 | 救済 |
|---|---|---|
| `gstack: fail <components>` | A1 `--check` | 失敗した各行に正確なコマンドを付ける。インストーラーは修正後に `--check` を再実行する。 |
| 既定の Capy イメージ(Bun 1.3.14)での `FAIL runtime pins` | A1/A2 | ピンを満たせる場合はインストーラーが Bun をアップグレードする(2.3)。満たせない場合は、その行がイメージ名を示す。 |
| `GSTACK_HEADLESS` 下の `BLOCKED — AskUserQuestion unavailable` | A3(記載どおり) | `unattended` を導入すること(6.1)で維持される。eval は現在の意味論を保つ。 |
| `AUTOPLAN_RESULT: gate_pending` | A4 | 親が `decisions.jsonl` を読む。自動承認は決してしない(D6)。 |
| `review-log: status mismatch` 終了コード 2 | A7 | 呼び出し側が `findings.jsonl` から再導出する。対話型の行には `status_source: claimed` のタグを付ける。 |
| `artifact: schema_version N unsupported` | 新しい `gstack-artifact validate`(2.1) | 親が gstack をアップグレードするか、読み手を固定する。 |
| `repo commands not executed (pass --allow-repo-commands)` 終了コード 3 | B4/B8/B2 単独実行(6.2) | `/ship` がフラグを渡す。オペレーターが明示的にオプトインする。 |
| 純粋な再スタンプ後の `TREE: changed gate=required (<paths>)` | B3 | レシートが残りのパスを示す。`generated.json` または `stamp_paths` に追加する(6.3)。 |
| `PREDECESSOR MOVED <old> -> <new>` | B3 | 使い捨てのワークツリーで gate-ahead を再実行する(6.4)。 |
| 上限に達した仕様レビューのループで 7 点以上にならない | A8 | ヘッドレスの既定では、列挙された issue に対する安価な 1 回のパスを行う。承認ゲートは `spec not re-verified` でブロックされる。 |
| unattended での Outside voice の認証失敗 | A5 | `OPENAI_API_KEY` から `gstack-codex-login` を使う。ポリシーの文言でその旨を明記する。 |

### 失敗モードのレジストリ

| 失敗モード | 発生可能性 | 影響 | 緩和策 |
|---|---|---|---|
| `headless` の下で eval の意味論が静かに変わる(6.1) | 記載どおりに出荷すると高い | 致命的: ケースを変えずに PASS の定義が変わる | 4 つ目の種類 `unattended` を導入する。 |
| PR A〜D をまたぐ成果物スキーマのずれ(2.1) | 高い | 高い: 親エージェントが壊れる | バージョン付きのスキーマモジュールとバリデーターを 1 つにまとめる。 |
| 信頼されていない clone でのリポジトリ宣言コマンドの実行(6.2) | 中程度 | 高い | オプトインのフラグ。単独実行時は終了コード 3。 |
| PR A は出荷されるが採用は変わらない(1.1) | 不明、未計測 | 高い: 誤った前提の上にウェーブが築かれる | 採用指標を P7 とし、C/D をそれに基づいてゲートする。 |
| 工数が表の 3〜4 倍になる(3.1) | 高い | 中程度: C/D が腐る。このウェーブ自体を手作業で再スタンプすることになる | B を削減する。A の後に最小限の B。 |
| 事前ゲートのレーン分類が CI からずれる(3.2) | 6 か月を超えると中程度 | 中程度 | レーンをワークフローファイルから導出する。 |
| 17 行でレビューのコンテキスト予算を超える(3.3) | 中程度 | 中程度: パリティスイートが赤くなるか、レビューの質が薄まる | 現在は 4 行にする。 |
| リリースツールが再生成するリポジトリでは `same-modulo-stamps` が決して真にならない(6.3) | 中程度 | 中程度: P3 が満たされない | 生成物レジストリに対しても分類する。 |
| 既定のイメージで Bun のピンを満たせない(2.3) | 現時点で確実 | 中程度: 主要ターゲットで P1 が満たされない | インストーラーが Bun をアップグレードする。 |

### ドリーム状態からの差分

理想: インストール用の 1 行、grep 1 回、バージョン付き成果物を伴う unattended な autoplan/ship、番号付きのゲート一覧を見るオーナー。計画どおりに進めると到達できるもの: インストール行と grep(A1/A2)、unattended な autoplan(A3/A4。6.1 の修正後)、オーナー向けのゲート一覧(A9/D3)。計画に欠けているもの: バージョン付きの契約(2.1)と、それを実際に駆動する者がいることの証明(1.1)。理想に対して行き過ぎている部分: 11 件の事前ゲートチェック、17 行、13 件の eval-plan の箇条書き。

### 完了サマリー

- 検証した前提: 27 件。VALID 23 件、表現のままでは FALSE 1 件(#27)、UNVERIFIED 3 件(#25 採用の原因、#26 工数、#24 の範囲とピンの差異のニュアンスは VALID に数える)。
- 指摘: Critical 1 件(6.1)、High 5 件(1.1、2.1、3.1、6.2、および 4.1 における 3.1 の形状上の帰結は 1 回と数える)、Medium 9 件、Low 4 件。
- 本レビュー後も計画に残る未検証の主張: 2 件(採用の原因、工数表)。
- 自動決定したゲートの決定: 10 件中 10 件。うち 6 件は修正。

## スコア

| 観点 | スコア | 備考 |
|---|---|---|
| 前提の妥当性 | 8 | リポジトリの事実は正しい。ウェーブの因果的前提は計測されていない。 |
| 正しい課題設定 | 8 | 機械可読性優先という考え方は正しい。契約こそが製品であるべき。 |
| スコープの妥当性 | 4 | 約 17 個のバイナリ、1 つのスキル、4 つのスキーマ、5.5 日で 17 行と主張されている。 |
| 代替案の検討 | 6 | D1〜D10 は実際の決定である。ただし、削減して計測する道筋と `unattended` は検討されていない。 |
| リスクの網羅 | 5 | ヘッドレスと eval の衝突、およびリポジトリコマンドの実行が網羅されていない。 |
| 6 か月後の軌道 | 6 | A でスキーマと指標が着地すれば強い。幅広い機能が先に着地すれば弱い。 |

## タスク

```json
[
  {"id": "T1", "priority": "P1", "component": "session-kind", "title": "Add `unattended` session kind as an explicit override; leave `headless` semantics unchanged; key autoplan headless section and HOST_ADAPTATION on it", "files": ["bin/gstack-session-kind", "scripts/resolvers/preamble/generate-ask-user-format.ts", "bin/gstack-skill-start", "test/gstack-session-kind.test.ts", "test/gstack-skill-start.test.ts", "test/spawned-consent-rule.test.ts"], "effort_human": "3 days", "effort_cc": "3 hours", "source_finding": "6.1"},
  {"id": "T2", "priority": "P1", "component": "artifacts", "title": "One versioned schema module for tasks/decisions/findings/timing/pregate/ship-receipt with `gstack-artifact validate`", "files": ["lib/headless-artifacts.ts", "bin/gstack-artifact", "lib/autoplan-export.ts", "lib/review-evidence.ts", "test/headless-artifacts.test.ts"], "effort_human": "1 week", "effort_cc": "5 hours", "source_finding": "2.1"},
  {"id": "T3", "priority": "P1", "component": "measurement", "title": "Adoption metric P7: record session_kind and consumer in autoplan-timing.jsonl and the ship receipt; gate PRs C/D on it", "files": ["lib/autoplan-export.ts", "bin/gstack-ship-receipt", "docs/TESTING_INTERNALS.md"], "effort_human": "2 days", "effort_cc": "2 hours", "source_finding": "1.1"},
  {"id": "T4", "priority": "P1", "component": "pin-files", "title": "Repo-declared commands (generated.json, pregate.json, release_tool) run only under /ship or --allow-repo-commands; standalone exits 3", "files": ["lib/regen.ts", "lib/pregate/index.ts", "lib/restamp.ts", "bin/gstack-regen", "bin/gstack-pregate", "bin/gstack-restamp"], "effort_human": "2 days", "effort_cc": "2 hours", "source_finding": "6.2"},
  {"id": "T5", "priority": "P1", "component": "delivery-shape", "title": "Re-estimate per binary with fixture counts; cut PR B to B1, B2 (--version/--next), B3, B5 and pre-gate checks regen/strays/literals/lanes", "files": [".gstack/tmp/autoplan/*/ceo-implementation.md"], "effort_human": "1 day", "effort_cc": "1 hour", "source_finding": "3.1, 4.1"},
  {"id": "T6", "priority": "P2", "component": "installer", "title": "Installer upgrades Bun when the pin is satisfiable; runtime-pins row distinguishes range from exact pins", "files": ["bin/gstack-capy-install", "lib/runtime-pins.ts", "bin/gstack-doctor", "test/gstack-doctor.test.ts"], "effort_human": "2 days", "effort_cc": "2 hours", "source_finding": "2.3"},
  {"id": "T7", "priority": "P2", "component": "tree-receipt", "title": "Classify the receipt diff against stamp_paths plus generated.json paths; name residuals", "files": ["lib/tree-receipt.ts", "bin/gstack-tree-receipt", "test/gstack-restamp-queue.test.ts"], "effort_human": "2 days", "effort_cc": "2 hours", "source_finding": "6.3"},
  {"id": "T8", "priority": "P2", "component": "restamp", "title": "Gate-ahead in a throwaway worktree; never merge the predecessor into the PR branch; add squash-history replay case", "files": ["lib/restamp.ts", "test/gstack-restamp-queue.test.ts"], "effort_human": "3 days", "effort_cc": "3 hours", "source_finding": "6.4"},
  {"id": "T9", "priority": "P2", "component": "plan-reviews", "title": "Ship four reality rows (premise table, already-done, surface check, binding decisions); defer 13 behind scope-detection evidence", "files": ["scripts/resolvers/plan-reality.ts", "plan-eng-review/SKILL.md.tmpl", "plan-ceo-review/SKILL.md.tmpl", "autoplan/sections/*.tmpl", "test/parity-suite.test.ts"], "effort_human": "3 days", "effort_cc": "3 hours", "source_finding": "3.3"},
  {"id": "T10", "priority": "P2", "component": "review-log", "title": "Scope A7 to write-time derivation; tag rows without --findings as status_source: claimed; cite existing read-time guard", "files": ["lib/review-evidence.ts", "bin/gstack-review-log", "test/review-evidence.test.ts"], "effort_human": "1 day", "effort_cc": "1 hour", "source_finding": "2.2"},
  {"id": "T11", "priority": "P2", "component": "pregate", "title": "Derive lanes and platform tiers from .github/workflows/*.yml rather than a pre-gate-owned taxonomy", "files": ["lib/pregate/lanes.ts", "lib/runtime-pins.ts"], "effort_human": "2 days", "effort_cc": "2 hours", "source_finding": "3.2"},
  {"id": "T12", "priority": "P3", "component": "review", "title": "Define the maintainer set source for contributor mode (CODEOWNERS, then collaborators API, else off) and record it", "files": ["review/SKILL.md.tmpl", "bin/gstack-issue-guard"], "effort_human": "1 day", "effort_cc": "1 hour", "source_finding": "6.5"},
  {"id": "T13", "priority": "P3", "component": "installer", "title": "Make Chromium lazy by default via gstack-browser-ensure; replace --light with --with-browser", "files": ["bin/gstack-capy-install", "bin/gstack-browser-ensure", "scripts/resolvers/browse.ts", "setup"], "effort_human": "2 days", "effort_cc": "2 hours", "source_finding": "4.2"},
  {"id": "T14", "priority": "P3", "component": "gate-list", "title": "One reply grammar for the gate list; quoted owner replies become parse fixtures", "files": ["lib/gate-list.ts", "bin/gstack-gate", "test/gate-list.test.ts"], "effort_human": "1 day", "effort_cc": "1 hour", "source_finding": "4.3"},
  {"id": "T15", "priority": "P3", "component": "eval-plan", "title": "Cut /eval-plan to preregistration checklist, $0 stub dry run, priced pilot with ledger; defer the rest", "files": ["eval-plan/SKILL.md.tmpl", "lib/spend-ledger.ts", "lib/pricing.ts"], "effort_human": "1 day", "effort_cc": "1 hour", "source_finding": "4.4"}
]
```

推奨: PR A を修正して進める(`headless` を再定義する代わりに `unattended` というセッションの種類を導入し、単一のバージョン付き成果物スキーマモジュールを用意し、採用指標をリリースの約束として含める)。続いて縮小した PR B に進み、採用が計測されるまで C と D の大部分は延期する。リポジトリレベルの前提は成立しており、このテーマの考え方は正しい。しかし現状の仕様のままでは、`GSTACK_HEADLESS` を使うすべてのセッションで eval の意味論が静かに変わり、また、親エージェントが駆動することを証明するものがないバージョン管理されていない契約の上に 17 個のバイナリを構築することになる。
