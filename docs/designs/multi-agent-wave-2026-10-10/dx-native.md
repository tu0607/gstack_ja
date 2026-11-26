INPUT: dx ffe831074afb86b6b394d6b0e0383034883c94a61dbce855e29b0738e5f11753

読み込み対象: `/workspace/gstack/.gstack/tmp/autoplan/autoplan-dx-U0huJT/native-prompt.md` の 1〜229 行、SHA-256 `482ebf2c…e83fe`(`sha256sum` で検証済み)。埋め込まれた実装計画のハッシュは `ffe83107…f11753` で、`dx-implementation.md` と照合済み。以下で **confirmed**(確認済み)または **refuted**(反証)とマークした主張は、すべてこのチェックアウト上の file:line で確認した。ディスパッチでは質問するか、ゲートで停止するよう求められていたが、すべての質問に推奨の選択肢で自動決定し、その旨を指摘とタスクに記録した。

## Step 0

### ペルソナ A: サブエージェントのマシンに gstack をインストールし、autoplan を unattended で実行して出力を消費する親 Capy エージェント

**どんな人か。** Capy のスレッドの Capy。クラウドの Ubuntu マシン上で Claude または GPT モデルを動かす。Claude Code のハーネスはなく、Skill ツールも、AskUserQuestion も、フックもない。ネイティブツールでファイルを読み、bash を実行し、オーナーの費用をトークン単位で使う。ツールを判断する基準は 1 つだけである。*答えを grep できるか?*

**今日どうしているか(確認済み)。** ユーザースコープのドライブスキルから `scripts/install.sh --check` を実行する。`check_install` は素の `test -x`/`test -s`/`grep -Fq` の連鎖であり(`~/.capy/drive/user-garry-tan/skills/gstack/scripts/install.sh:7-14`)、`set -euo pipefail`(`:2`)の下で動き、`check_install; exit 0`(`:32-35`)として呼ばれる。いずれかのプローブが失敗すると、スクリプトは出力なしでステータス 1 により終了する。成功時の唯一の文言は Playwright のスモークテストの中から出力される(`:24`)。`| tail` を通すと、親は終了コード 0 と何も出力されないことを見る。計画の P0-1 の再現は妥当である。

**共感のナラティブ。** 親は「3 番目のマシンに gstack の準備はできているか?」と尋ね、沈黙だけが返ってくる。沈黙はエージェントが行動できない唯一のものである。それは PASS でも FAIL でもなく、そのうえ「チェックが何も出力しなければ問題ない」と学習で刷り込まれている。その後、親がサブエージェントに「gstack を読み込んで autoplan を実行せよ」と指示すると、スキルはディスク上にないため、サブエージェントは 20 分のモデル時間をかけてレビューを即興で作る。親が知るのは、出力に `## Review record` がないときだけである。28 スレッドのうち 13 件がまさにこれを行った。親が欲しいのは、より良い doctor のダッシュボードではない(ダッシュボードは既に存在する: `bin/gstack-doctor:51-53` が `%-15s %-15s %s` の行を出力し、失敗時は `:455-456` で終了コード 1 を返す)。親が欲しいのは、`test` に組み込める、grep で安定して得られる 1 行である。

**開発者の行程のトレース(現状)と摩擦点。**

1. 親はドライブの `SKILL.md` を読み、`bash scripts/install.sh --check` を実行する。**F1:** 無言の終了コード 1、またはパイプを通すと終了コード 0。行もなく、修正のヒントもなく、改訂もない。
2. フラグなしでインストーラーを実行する: clone + `./setup --host claude --no-prefix` + `./setup --host codex --model gpt-6-astra` + `bunx playwright install --with-deps chromium`(`install.sh:43-50`)。**F2:** 計画だけをするマシンで、86 秒と 115 MiB の Chromium がかかる。スキップするフラグはなく、唯一のスキップ手段は `setup` の文書化されていない `GSTACK_SKIP_PLAYWRIGHT=1` だけである(`setup:2071`)。
3. `bin/gstack-doctor` を実行する。**F3:** 13 行の、説明文に近い列。「7 ok, 2 warn, 3 not configured, 0 fail」、終了コード 0。Bun 1.3.14 は、テスト済みの 1.4.2 に対して `warn` として表示される。親は、この Bun でゲートが健全かどうか判断できない。`--json` はない(`bin/gstack-doctor:37-38` で解析されるのは `--live` と `-h` だけ)。
4. サブエージェントを起動する: 「`~/.claude/skills/autoplan/SKILL.md` を読んで、plan.md に対して実行せよ」。**F4:** プリアンブルはセッションを `interactive` に分類する(曖昧なら何でも interactive、`bin/gstack-session-kind:16-18`)。そのため、スキルは存在しない AskUserQuestion を呼び出し、フォールバックの散文の説明がサブエージェントのターンを終わらせる。親が `GSTACK_HEADLESS=1` を設定すると、スキルは最初の質問で BLOCK する(`generate-ask-user-format.ts:28`)。`GSTACK_SESSION_KIND=spawned` を設定すると、最終的な承認ゲートは自動承認される(`:15`、破壊的な選択肢だけが例外)。
5. 実行は散文の記録で終わる。**F5:** 親は決定事項を見つけるために `ACTIVE_PLAN` を読まなければならない。フェーズごとの `tasks-<phase>-*.jsonl` は存在するが、集約も、マニフェストも、完了チェックもない。
6. **F6:** 学習内容と決定事項は、使い捨てのマシン上の `~/.gstack` に書かれ(`lib/state-root.ts:22-29` の連鎖は `$HOME/.gstack` で終わる)、ウェイクアップ時には失われている。
7. **F7:** Codex の outside voice には `codex login` が必要である。計画では `OPENAI_API_KEY` から 3.7 秒で動くことが示されているが、doctor(`bin/gstack-doctor:186` は「codex login, or export CODEX_API_KEY」と表示)も `outsideVoiceFailurePolicy()`(`scripts/resolvers/outside-voice.ts:216`)も API キーの経路に言及していない。

**初回のロールプレイ(計画後)。** 「`bin/gstack-capy-install --only autoplan` … `gstack: ok 1.91.70.0 for=autoplan`。よし。`GSTACK_SESSION_KIND=unattended`、autoplan を実行。… `AUTOPLAN_RESULT: gate_pending run=…/run.json decisions=…`。`gstack-artifact validate run.json` → 終了コード 0。`jq 'select(.status=="pending")' decisions.jsonl` → 7 つのゲート。さて、どうする? 答えを返す… どうやって? autoplan を再実行するのか? 3 つのレビューフェーズをやり直すのか? `resume` はない。」この最後の疑問が、計画で最大の穴である(指摘 1)。

**TTHW(time to hello world)。** 現状: 新しいマシンでゼロから信頼できる「準備完了」の判定に至るまでの時間は、チェック自体が信用できないため無制限である。ゼロから unattended なレビューの消費に至るには、ハーネスが必要で、それは存在しない。計画上の目標: `gstack: ok … for=autoplan` まで約 25 秒(Chromium なし。クローン + 2 回の `setup` レンダリング)、`AUTOPLAN_RESULT` まで 1 回の実行、ゲート一覧まで `jq` 1 回。欠けている再開ステップを追加すれば、ループ全体は 2 つのコマンドで閉じる。

### ペルソナ B: 「次はキュー上の <version> で出荷する」というコーディネーター・エージェント。3 つの PR が 2 回並べ替えられる

**どんな人か。** 1 つのスレッドで、1 回に 1 つの PR を、独自の `release:restamp` スクリプト、CHANGELOG、`(was X)` のドキュメント言及、ミラーリポジトリ、Ubicloud の VM 上で 40 分以上かかる完全なテストゲートを持つリポジトリにマージしていく。CI の状態とリスクから順序を決めるため、順序は変わる。

**共感のナラティブ。** 今日の `/ship` の Step 12 は、PR を開く時点でバージョンを主張する。その際、ライブの PR キューと兄弟のワークツリーを読み、最も高い主張を超えて進める(`bin/gstack-next-version:80-105`、`pickNextSlot`)。PR 2 が PR 1 より先にマージされた瞬間、PR 1 の主張は誤りになる。その CHANGELOG の見出しは誤ったバージョンの下に入り、ドキュメント中のすべての `(was X)` が古くなり、ミラーも食い違う。コーディネーターは 2 つのリポジトリの 5 つのファイルを手作業で編集し、「ツリーが変わった」からと 40 分のゲートを再実行し、次の並べ替えでまた同じことを繰り返す。フィードバックでは、彼らは `/ship` の使用をやめ、リポジトリ独自のツールを使うようになった。彼らが望むのは「自分の番になったらワンコマンドでスタンプを押し、既にゲートを通したものと同じツリーであることを示してほしい」ということである。

**開発者の行程のトレース(計画の目標)と摩擦点。**

1. コーディネーターは PR 3 が次だと判断する。PR 3 のワークツリーで `gstack-restamp --queue-mode stamp-at-merge --next` を実行する。**F8:** `--next` は「その時点の main の VERSION に、ポリシーのバンプを加え、次バージョンのキューリーダーを通したもの」と定義されている(計画 C2)。キューリーダーの本来の仕事は*主張*を読むことである(`bin/gstack-next-version:80-105`)。stamp-at-merge では誰も主張しないので、リーダーはバイパスされるか(その場合はそう明記すべき)、あるいは以前の PR の古い主張によって番号が予期せず繰り上がるかのどちらかになる。仕様が不明である。
2. `gstack-restamp` は `.gstack/ship-policy.json` の `bun run release:restamp` を実行しようとする。**F9:** 単独で実行すると、`repo commands not executed (pass --allow-repo-commands)` で終了コード 3 となる(C1)。姿勢としては正しいが、`/ship` の外にいるコーディネーターは、もう 1 つのフラグを知る必要がある。さらに計画は、VERSION/CHANGELOG/`stamp_paths` へのスタンプが行われるのか(部分的なスタンプ)、それとも何も行われないのかを述べていない。リリースツールが飛ばされて半分だけスタンプされたツリーが、最悪の結果である。
3. レシート: `gstack-tree-receipt` が `TREE: same-modulo-stamps` と `gate-reuse: eligible` を出力する。**F10:** 呼び出し方法が不明。レシートには、ゲートを通した head と先行 PR の head が必要である。コーディネーターはそれらをどこから得るのか。`gate-ahead.json` か、`gstack-evidence` か。計画では出力は示されているが入力が示されていない。
4. 並べ替え #1: PR 1 が PR 3 より前になる。PR 3 には `--after 1`(gate-ahead)が必要になる。**F11:** `--after` と `mirror` は **tier 2**(C2)である。P3 の約束(「動く」)は tier 1 であり、並べ替えを安価にする部分は次の PR に先送りされうる。コーディネーターの主要なユースケースは、半分しか提供されない。
5. 並べ替え #2: `PREDECESSOR MOVED <old> -> <new>` による拒否。良い。**F12:** その後、コーディネーターは何をすればよいのか。この行には修正の指示(基準 3)がないが、すべての doctor の行には修正の指示がある(`bin/gstack-doctor:53`)。
6. マージ。**F13:** 出荷レシート(C5)は PR 本文の最初のフェンスドブロックになるのでよい。しかし、B0 では `ship-receipt` が契約に含まれると言っているのに、`schema_version` フィールドが列挙されておらず、`/land-and-deploy` が消費するためのリーダー(`gstack-ship-receipt read --pr N`)もない。計画は `/land-and-deploy` が「それを読む」と述べるが、そのためのコマンドが示されていない。

**TTHW。** 現状: 1 回の並べ替えには、手作業の編集に約 20 分と、繰り返される 40 分のゲートがかかる。目標: `gstack-restamp --after <pr>` + `gstack-tree-receipt` で約 2 分、手作業の編集はゼロ、レシートが `eligible` と言えばゲートを再利用する。`--after` が tier 1 であり、レシートの入力が明示されている場合にのみ達成可能である。

## パス 1〜8

| # | 観点 | 変更前 | 変更後 | スコアを動かす変更 |
|---|---|---|---|---|
| 1 | オンボーディング / TTHW | 2 | 8 | A1+A2 を記載どおりに実施し、加えて 3 つのコマンド(インストール、実行、検証)と再開コマンド(指摘 1)を載せた、コピペ可能な「親エージェントのクイックスタート」文書を 1 つ用意する。再開がないとループは開いたままで、スコアは 6 になる。 |
| 2 | 発見しやすさ | 3 | 7 | `gstack-doctor --for <skill>` が、*どの*コンポーネントを必要としたかを表示する(今日は行の名前と `--require` の ID が別の語彙になっている)。`bun gstack-autoplan-snapshot prompt <phase>` が既存の `nativeDispatchPrompt` を表に出す(`bin/gstack-autoplan-snapshot.ts:661`)。`gstack-artifact schema <name>` を追加し、親がリポジトリなしで契約を読めるようにする。 |
| 3 | エラーメッセージ | 4 | 7 | doctor の行と `review-log: status mismatch` には修正の指示があるが、`PREDECESSOR MOVED`、`gate-reuse: not-eligible`、`repo commands not executed`、バリデーターの失敗、フックの `guard unavailable` には欠けている。リポジトリの慣例は、`lib/gate-outcomes.ts` の理由コードと、`docs/troubleshooting.md` のアンカーを使うことである(`lib/gate-outcomes.ts:69-79`)。新しいエラーの系統はすべてこれを経由させる。 |
| 4 | CLI / フラグの一貫性 | 3 | 7 | コンポーネント ID の語彙は 1 つにする。判定の文法も 1 つにする(`PASS|FAIL|SKIP <id>` の行と key=value の末尾行)。`--for` と `--require` は両方ではなく、どちらか一方にする。新しい 5 つの bin に共通の終了コード表を用意する(doctor が `:12` と `:39` で行うように、終了コード 2 は全体で使用法エラーを意味する)。`--queue-mode` の既定値と、それが必須かどうかを明記する。 |
| 5 | 機械可読性 | 5 | 9 | B0 は正しい形である。`gstack-doctor --check` に `--json` を追加する(計画済み)。`gstack-artifact validate` にも追加する(計画なし)。`gstack-tree-receipt`、`gstack-pregate`(計画済み)、`gstack-gate parse`(計画済み)にも追加する。autoplan と cso で共有する終了行の文法を 1 つにする(今日は `AUTOPLAN_RESULT:` と `CSO_RUN:` の 2 つの形がある)。`run.json.status` の値を列挙する。 |
| 6 | ドキュメント / 例 | 2 | 6 | 計画には、名前付きのフィクスチャと `INCIDENTS.md` はあるが、unattended 実行、出荷ポリシー、レシートのためのユーザー向けドキュメントがない。各ピンファイル(`ship-policy.json`、`generated.json`、`pregate.json`、`banned-terms.json`)には、コピペ可能な例と、それを書き出す `gstack-<tool> init` が必要である。 |
| 7 | オーナーのゲート体験 | 4 | 8 | B9 のゲート一覧、E3 の 1 ページのブリーフ、実際のオーナーの返信(`d10 yes`、`1a 2a`)からのフィクスチャは強い。返信の文法はゲート一覧と一緒に表示される。残るギャップ: 保留中の依頼と `URGENT` ブロックが別の PR に分かれている(D1 は tier 1、B12 は別)ため、一方のリリースではブリーフが不完全になる。 |
| 8 | 回復性 | 2 | 7 | 中断された実行の検証は大きく失敗する(B0)。欠けているのは、回答を伴う `gate_pending` からの再開(指摘 1)、終了済みのフェーズを再実行せずに中断されたフェーズを再開すること(`run.json` にはフェーズの結果があるため、フラグ 1 つで済む)、`gstack-restamp` の `--dry-run`(「書き込み前にドライランの差分として表示」と暗示されているが、フラグとしては存在しない)である。 |

## 指摘

**指摘 1 — Critical。unattended の autoplan には出口(`gate_pending`)はあるが、回答の入口がない。** B2 は実行を `AUTOPLAN_RESULT: gate_pending …` で終え、D6 は実行が承認しないと定めている。B9 は `all except 3b` を JSON に変換する `gstack-gate parse` を与える。しかし、B2、B9、E3 のどこにも、親がその JSON をどう返し、`plan.md` をどう確定させるかが書かれていない(「`draft direction stands until the owner decides` の行は、決定された選択肢に書き換えられる」という E3 は、フェーズを閉じる操作であり、そのトリガーが指定されていない)。親に残された唯一の選択肢は autoplan を再実行することだが、それは 3 つの有償フェーズをやり直すことになる。証拠: スナップショット CLI には `init` がある(`bin/gstack-autoplan-snapshot.ts:833`)。計画は `export` と `prompt` を追加するが、`resume`/`answer` はない。修正案: `bun gstack-autoplan-snapshot answer --decisions decisions.jsonl --reply "<grammar>"`(または `gstack-gate parse` の出力である `--answers <json>`)を追加する。これは、ID を保留中のゲートに照らして検証し、`kind:"owner"` の行を `status:"decided"` で追記し、Phase 4 の終了操作(下書きの行の書き換え、最終的な `plan.md` の書き出し、`run.json.status` の `complete` への更新)を実行し、`AUTOPLAN_RESULT: complete …` を出力する。これをクイックスタートの 3 番目の手順として文書化すること。

**指摘 2 — Critical。同じコンポーネントに 2 つの語彙がある。** A1 の行は「Claude skills, Codex skills, the Astra behavioral patch, browse bundle, Chromium…」であり、A2 の既定は `--require claude,codex,patch` で、末尾行は `gstack: fail <component,component>` である。末尾行が「Claude skills」と表示すると、親はそれを `--require` の ID に対応付けられない。さらに `--json` のキーが第 3 の推測になる。今日の doctor にも、小規模ながら同じ問題がある(`row ok codex …` と `check_codex`、`bin/gstack-doctor:186,446`)。修正案: 1 つの `COMPONENTS` テーブルを `lib/doctor-components.ts` に置く(ID、人間向けのラベル、プローブ、修正方法、必要とするスキル)。これを行の ID、`--require`、末尾行、`--json` のキー、`--for` の解決のすべてに使う。`--for <skill>` は、行の前に `required: claude codex patch` を表示する。

**指摘 3 — High。stamp-at-merge の下での `--next` は自己矛盾している。** C2: 「`--next`(その時点の main の VERSION に、ポリシーのバンプを加え、次バージョンのキューリーダーを通したもの)」。キューリーダーは、*主張された* PR のバージョンに対して衝突を解決する(`bin/gstack-next-version:80-105`、`pickNextSlot`)。stamp-at-merge では、次の番になるまで PR はバージョンを主張しないため、リーダーは事前のウェーブの古い主張を見つけて過剰に繰り上げるか、何もしないかのどちらかになる。修正案: `--queue-mode stamp-at-merge` の下では、`--next` は `origin/<base>:VERSION` とポリシーのバンプだけを読み、`claims: ignored (stamp-at-merge)` と出力する。リーダーは従来の claim-at-open モードのために残す。既定の `--queue-mode` を明記する(推奨: `ship-policy.json` から読み、なければ従来どおり)。そうすれば、すべての呼び出しでフラグが必須にならない。

**指摘 4 — High。P3 の約束は tier 2 の部品に依存している。** `--after <pr>` と `mirror` は C2 で tier 2 である。キューの再生テスト(検証 3)はその両方を主張している。これらが後続に先送りされると、PR C が出荷するのは、PR がすでに次の番になっている場合にのみ動くリスタンプであり、並べ替えのたびにゲートを再実行しなければならない。それがまさにインシデントである。修正案: `--after`(並べ替えを安価にするゲート先行)を tier 1 に昇格させる。`mirror` は tier 2 のままにする。あるいは P3 を「次になったらスタンプする」と書き直し、並べ替えの主張を後続に移す。自動決定: `--after` を昇格。

**指摘 5 — High。修正の指示もドキュメントのアンカーもないエラー行。** 基準 3 は、問題、原因、修正、リンクを求めている。計画の行のうち、これらがないものは次のとおりである: `PREDECESSOR MOVED <old> -> <new>`、`gate-reuse: not-eligible (<what changed>)`、`repo commands not executed (pass --allow-repo-commands)`(修正はあるが、原因とリンクがない)、`Autoplan publication guard is unavailable`、`autoplan guard: not installed; publication order is unverified`、そして `gstack-artifact validate` のすべての失敗。リポジトリにはすでに仕組みがある。`lib/gate-outcomes.ts` の理由コードには、それぞれ `docs/troubleshooting.md#anchor` が付いている(`lib/gate-outcomes.ts:69,74,79`、AGENTS.md の「Key conventions」)。修正案: `RESTAMP_PREDECESSOR_MOVED`、`GATE_REUSE_NOT_ELIGIBLE`、`REPO_COMMANDS_NOT_AUTHORIZED`、`ARTIFACT_INVALID_*`、`GUARD_NOT_INSTALLED` を、アンカー付きで gate-outcomes に追加する。各 bin は `<line> — fix: <text> (<anchor>)` の形式で出力する。

**指摘 6 — High。P7 の「親が成果物を消費した」には、それを支えるコマンドがない。** B2:「親が報告したときに `consumer`」。PR D と E の tier 3 は、その数値が出たときにのみ解禁される。ワンライナーがなければ、その数値は永遠にゼロのままで、計画自身のゲートが開かない。修正案: `gstack-artifact ack <run.json> --consumer <thread-id>` は、行を `analytics/autoplan-timing.jsonl` に追記し、`run.json.consumed_by` を設定する。パラクイックスタートでは `validate` の後にこれを置く。検証は、消費された場合にのみ終了コード 0 を返すべきか? いいえ、両者は別々に保つ。validate は検査であり、ack は報告である。

**指摘 7 — Medium。終了状態の行に 2 つの文法がある。** `AUTOPLAN_RESULT: gate_pending run=<path> decisions=<path> …`(B2)と `CSO_RUN: <run id> findings=<path>`(B2 の cso の箇条書き)。親には正規表現が 1 つあればよい。修正案: unattended な各スキルは `GSTACK_RESULT: skill=<name> status=<complete|gate_pending|incomplete|interrupted> run=<path>` を出力する。ステータスの列挙は `run.json.status` にも持たせる。古い接頭辞がテストで固定されている場合は、1 リリースの間エイリアスとして残す。

**指摘 8 — Medium。Chromium をスキップする方法が 3 つあり、優先順位が明記されていない。** `GSTACK_SKIP_PLAYWRIGHT=1`(環境変数、`setup:2071`)、新しい `./setup --no-browser`(A2)、そして `gstack-capy-install` での遅延読み込みの既定(`--with-browser` で上書き、D9)。修正案: `--no-browser` は内部で環境変数を設定する。インストーラーは `--with-browser` でない限り `--no-browser` を渡す。優先順位を 1 文で `setup --help` に書く(ヘルプの網羅性にはテストがある。`test/setup-help.test.ts`)。

**指摘 9 — Medium。`--for <skill>` と `--require <csv>` は、1 つの入力の 2 通りの綴りである。** A1 は両方を提供している。`--for <skill>` を選ぶ(コンポーネント表を介して ID に解決する)。`--require <csv>` は、解決先となる低レベルの形式としてのみ存在させる。解決された集合を表示し、親が ID を学べるようにする。また、`--check` が `--live`(`bin/gstack-doctor:37`)とどう組み合わさるかを明記する。`--check` は、`--live` も渡されない限り、有償のプローブを決して実行しないこと。

**指摘 10 — Medium。フックがない場合の意味論は、1 つの振る舞いとして記述されているが、実際には 2 つである。** B1:「フックは、ガードがインストールされていない場合に呼び出しを許可し、`autoplan guard: not installed` と出力する」。確認済み: シェルフックのバックストップは、その TS 側が失敗すると*拒否*する(`autoplan/bin/phase-publication-hook:4-9`)。これは壊れたインストールに対して正しい振る舞いである。フックの*ファイル*が存在しない場合、フロントマターを尊重するホストは、何かを出力する前にフックに失敗する。これを変更できるのは `{{AUTOPLAN_PUBLICATION_HOOK}}` のレンダリング(`autoplan/SKILL.md.tmpl:31`)だけである。修正案: 計画の文章で 2 つのケースを分ける。(a) フックファイルがない → リゾルバーは「not installed」の許可 JSON を出力する 1 行のインライン `command` をレンダリングする。(b) フックはあるが `.ts` が失敗する → 拒否を維持する。レビュー記録には (a) の行を載せる。

**指摘 11 — Medium。Capy のドライブ上の永続状態が、ドライブのポリシーと衝突する。** A3 は `GSTACK_STATE_ROOT` を `~/.capy/drive/project-user-*/gstack-state` に設定する。Capy のドライブのガイダンスは、ドライブはメモリ、作業用の一時領域、検証の証拠のためのものではないと述べている。学習内容とレビューログはまさにそれに当たる。計画が既に挙げている代替案、つまり「スキップされると率直に述べる」は、正直で安上がりである。修正案: 既定は `learnings: skipped (ephemeral)` と `STATE_ROOT: <path> durable=no` の行にする。ドライブのルートは明示的なオプトインにする(オーナーが `GSTACK_STATE_ROOT` を設定するか、`--state-root drive` を指定する)。さらに、「Capy のクラウドのホーム」をどう検出するかを明記する(パスのヒューリスティックではなく、環境変数のマーカーによる)。

**指摘 12 — Medium。`gstack-artifact validate` には `--json` も、終了コードの契約もない。** B0 はこれを「親が最初に実行する決定論的な完了チェック」と呼ぶが、挙げているのは失敗の原因だけである。修正案: 終了コード 0 は有効、1 は無効(問題ごとに 1 行の `INVALID <reason-code> <path>` を出力)、2 は使用法エラー。`--json` は `{valid, errors:[{code, path, message}]}` を出力する。`gstack-artifact schema <name>` は、それが検証するバージョンの JSON Schema を出力する。これにより、別のマシン上の親も、リポジトリなしで契約を読める。

**指摘 13 — Medium。ピンファイルに雛形がない。** 新しい JSON のピンファイルが 4 つ(`ship-policy.json`、`generated.json`、`pregate.json`、`banned-terms.json`)あり、それぞれにスキーマはあるが、`init` や例はない。このウェーブを採用するコーディネーターは、リポジトリを開いて読まなければならない TypeScript の型に対して、JSON を手で書くことになる。修正案: `gstack-restamp init-policy`、`gstack-regen init`、`gstack-pregate init` を追加し、コメント付きの例(`"$schema"`、既定値を持つすべてのキー)を書き出す。また、`docs/ship-policy.md` で gstack リポジトリ自身のファイルを示す。

**指摘 14 — Low。repo コマンドが拒否された場合の部分的なスタンプの振る舞い。** C1 は、単独実行時に終了コード 3 で「コマンドを列挙する」とあるが、VERSION/CHANGELOG/`stamp_paths` が書き込まれたかどうかも述べなければならない。修正案: 何かを書く前に拒否し(全か無か)、`nothing written` と表示する。

**指摘 15 — Low。「ホストについての『このウェーブでは扱わない』の前提」がわずかにずれている。** 「どのリゾルバーも `capabilities.questions` を読まない」と書かれている。確かに、どのリゾルバーもそれで分岐はしないが、`scripts/host-config.ts:178` はそれを検証しており、すべてのホストがそれを宣言している(`hosts/claude.ts:7`、`hosts/codex.ts:7`)。決定(D2a)は今も成り立つ。ただし、将来の読み手が誤った前提で再検討しないように、その文を修正すること。

**指摘 16 — Low。review-log の不一致の終了コード。** B7 は `status mismatch` に終了コード 2 を使う。しかし `bin/gstack-review-log:95-97` は無効な JSON に 1 を返し、doctor は使用法エラーに 2 を使う(`bin/gstack-doctor:12`)。拒否された行には 1 を使い、使用法エラーには 2 を残す。表は `--help` に載せること。

## 必須の成果物

### 開発者の行程マップ(計画後、両ペルソナ)

| 段階 | 親エージェント(ペルソナ A) | コーディネーター(ペルソナ B) | 消費される成果物 / 行 |
|---|---|---|---|
| インストール | `bin/gstack-capy-install --only autoplan` | 同じ、`--only ship` | `gstack: ok <rev> for=autoplan` |
| 事前確認 | `gstack-doctor --check --for autoplan --json` | `gstack-doctor --check --for ship` | `PASS|FAIL|SKIP <id>` の行、末尾行 |
| 実行 | `GSTACK_SESSION_KIND=unattended` + plan.md に対する autoplan | `gstack-restamp --after <pr>` の後に `/ship` | `GSTACK_RESULT: …`、スタンプのみの差分 |
| 検証 | `gstack-artifact validate run.json` | `gstack-tree-receipt --gated <sha>` | 終了コード 0 / `gate-reuse: eligible` |
| 決定 | `jq 'select(.status=="pending")' decisions.jsonl` → オーナー → **`snapshot answer --reply "all except 3b"`**(今は存在しない) | ゲートの再利用、または `--force-gate <reason>` | `decisions.jsonl` の `kind:"owner"` |
| 報告 | `gstack-artifact ack run.json --consumer <thread>`(今は存在しない) | PR 本文の最初の ` ```gstack-ship-receipt ` | P7 のカウンター / レシート |
| 回復 | 中断 → `validate` が失敗 → `snapshot resume`(存在しない) | `PREDECESSOR MOVED` → `--after <new>` で再実行(修正の指示が必要) | アンカー付きの理由コード |

### DX 実装チェックリスト

- [ ] `lib/doctor-components.ts`: 単一のコンポーネント表(ID、ラベル、プローブ、修正方法、必要とするスキル)。行の ID、`--require`、末尾行、`--json` のキー、`--for` のすべてがこれを読む(指摘 2)。
- [ ] `gstack-doctor --check`: `PASS|FAIL|SKIP <id> [— fix: …]` の行。末尾行 `gstack: <ok|fail> rev=<v> for=<skill|hosts> fail=<csv>`。`--json`。`--live` なしでは `--check` は有償のプローブを決して実行しない(指摘 9)。
- [ ] `./setup --no-browser` を `setup --help` に文書化する。`GSTACK_SKIP_PLAYWRIGHT` と `--with-browser` に対する優先順位の文を添える(指摘 8)。
- [ ] `GSTACK_RESULT:` を autoplan と cso で 1 つの文法にする。`run.json.status` の列挙(指摘 7)。
- [ ] `bun gstack-autoplan-snapshot answer|resume` とそのドキュメント(指摘 1)。
- [ ] `gstack-artifact validate --json`、終了コードの表、`schema <name>`、`ack`(指摘 6、12)。
- [ ] 親エージェント向けのクイックスタート文書: install → run → validate → answer → ack。すべてのコマンドをコピペ可能にし、`docs/unattended.md` に置く。ユーザースコープのスキルからリンクする。
- [ ] `gstack-restamp`: `--queue-mode` の既定はポリシーから。stamp-at-merge の下では `--next` は主張を無視し、そのことを明示する。`--dry-run`。repo コマンドが拒否された場合は全か無か。`--after` は tier 1(指摘 3、4、14)。
- [ ] `gstack-tree-receipt`: 入力を文書化する(`--gated <sha>`、`--predecessor <sha>` または `--from gate-ahead.json`)。`--json`。`PREDECESSOR MOVED` と `not-eligible` の修正の指示(指摘 5、F10)。
- [ ] `gstack-ship-receipt`: ブロック内の `schema_version`。`/land-and-deploy` 用の `read --pr N`(F13)。
- [ ] 新しいエラーの系統ごとに、`lib/gate-outcomes.ts` に新しい理由コードを追加し、`docs/troubleshooting.md` にアンカーを付ける(指摘 5)。
- [ ] 4 つのピンファイルの `init` の雛形と `docs/ship-policy.md`(指摘 13)。
- [ ] 計画の文章の修正: フックがない場合と失敗した場合の分離(指摘 10)、ドライブの状態ルートのオプトイン化(指摘 11)、ホストの能力に関する文(指摘 15)、review-log の終了コード(指摘 16)。
- [ ] 新しい bin すべてに共通の終了コード表(0 正常、1 失敗、2 使用法エラー、3 拒否/フラグが必要)を各 `--help` に載せる。新しい bin の `--help` 網羅性テストを、`test/setup-help.test.ts` と並べて作る。

### 魔法の瞬間

1. **`gstack: ok 1.91.70.0 for=autoplan` が、新しいマシンで 30 秒以内に出る。** Chromium はダウンロードされない。親は 1 行を grep して次に進む。86 秒かかり、かつ嘘をついていたマシンで初めてこれが出れば、信頼の問題は終わる。
2. **`gstack-artifact validate run.json && jq 'select(.status=="pending")' decisions.jsonl`** が、推奨事項と費用付きの番号付きゲート 7 件を、散文を読まずに返す。その後 `snapshot answer --reply "all except 3b"` で計画が確定する。コマンド 2 つ、有償の再実行はゼロ。この瞬間は指摘 1 が修正されて初めて存在する。
3. **再スタンプの後の `gate-reuse: eligible`。** 依拠している同一性(スタンプを除いたツリー、ピン、ロックファイル、CI のハッシュ)が併せて表示される。40 分のゲートが、監査可能なレシートと共にスキップされる。これは、コーディネーターがリポジトリ独自のツールを使うのをやめる瞬間である。
4. **`OUTSIDE_STATUS: completed provider=host-subagent model=gpt-6-astra`**。Codex CLI のない Capy の実行で、`[single-model]` ではない。outside voice は CLI のインストールではなく、モデルの選択になる。

### 競合ベンチマーク: Claude Code、Codex、Capy がサブエージェントの出力をネイティブにどう公開しているか

- **Claude Code** のサブエージェント(Task/Agent ツール)は、単一の自由形式の結果を親に返す。構造化された出力は、プロンプトが JSON を求め、親がそれを解析する場合にのみ存在し、スキーマもバリデーターもない。`claude -p --output-format json` は最終メッセージを型付きのエンベロープ(`result`、`session_id`、コスト)で包むが、中身はやはり散文である。gstack の B0(`run.json` マニフェスト + `schema_version` + バリデーター)はハーネスより先を行く。3 つのうちで、親に決定論的な完了チェックを与える唯一のものである。
- **Codex CLI** の `codex exec` は JSONL イベントをストリーミングし、エージェントのステータスで終了する。最終メッセージはテキストである。アーティファクトのマニフェストはない。gstack の `GSTACK_RESULT:` 行とファイルは、Codex の最後の JSONL イベントに匹敵する。その利点は、親が後で検証できるハッシュ付きのファイルである。
- **Capy** のサブエージェントは、完了の要約(`message_agent` の最終結果)、`tools.subagent.get` の要約フィールド、パスで添付されたファイルで終わる。`pr_create` は、チェックと指摘付きの PR を生成し、親は `tools.pr.getFindings` を通じて構造化された行として読む。Capy がすでに使っているパターン(まず識別子、次に散文、そして型付きの指摘リスト)を、C5 と B2 は採用している。gstack が Capy に倣うべき点: Capy のサブエージェントの出力は、パスを知らなくても(サブエージェントのインデックスで)参照できる。一方、gstack の `AUTOPLAN_RESULT` はパスを名指しするため、親はファイルを見つけるために 1 行を解析しなければならない。実行ディレクトリを 1 度だけ表示し(`run=<dir>`)、その中に固定のファイル名(`run.json`、`decisions.jsonl`、…)を置けば、Capy の「1 つのハンドル、既知の形」に一致し、親の正規表現も 1 つのキャプチャグループで済む。
- **結論:** 指摘 1(再開)と指摘 7(結果の文法の統一)が修正されれば、gstack の unattended の契約は、3 つのハーネスのどれのネイティブ出力よりも厳格になる。これは、主たる利用者が別のエージェントであるツールにとって正しい場所である。

## スコア

- 全体の初期スコア(計画を記載どおりに、8 つのパスで平均): **3.1 / 10**。成果物の契約とゲート一覧は強い。しかし、回答のステップでループが開いたままであり、コンポーネントの命名が割れており、stamp-at-merge の下でキューモードの意味論がキューリーダーと矛盾し、エラーの多くに修正の指示がない。
- 目標の全体スコア(タスクの下で、すべて P1 と P2 を実施した場合): **7.6 / 10**。残るギャップは、ドキュメントの量と、`mirror` が tier 2 にずれ込むリスクである。

## タスク

```json
[
  {"id":"DX-1","priority":"P1","component":"autoplan","title":"Add `gstack-autoplan-snapshot answer|resume`: consume gate-list replies, run Phase 4 close operations, finalize plan.md and run.json.status","files":["lib/autoplan-export.ts","bin/gstack-autoplan-snapshot.ts","lib/gate-list.ts","autoplan/sections/unattended.md.tmpl","docs/unattended.md","test/autoplan-unattended.test.ts"],"effort_human":"3 days","effort_cc":"3 hours","source_finding":"Finding 1"},
  {"id":"DX-2","priority":"P1","component":"doctor","title":"One component table for row ids, --require, --for resolution, trailer and --json keys; print the resolved required set","files":["lib/doctor-components.ts","bin/gstack-doctor","bin/gstack-capy-install","test/gstack-doctor.test.ts"],"effort_human":"2 days","effort_cc":"2 hours","source_finding":"Finding 2"},
  {"id":"DX-3","priority":"P1","component":"restamp","title":"Define --queue-mode default (from ship-policy) and make --next ignore claims under stamp-at-merge with an explicit line","files":["lib/restamp.ts","bin/gstack-restamp","lib/ship-policy.ts","bin/gstack-next-version","test/gstack-restamp-queue.test.ts"],"effort_human":"1 day","effort_cc":"1.5 hours","source_finding":"Finding 3"},
  {"id":"DX-4","priority":"P1","component":"restamp","title":"Promote --after <pr> (gate-ahead) to tier 1 so P3's reorder promise ships in PR C","files":["lib/restamp.ts","bin/gstack-restamp","test/gstack-restamp-queue.test.ts"],"effort_human":"2 days","effort_cc":"2 hours","source_finding":"Finding 4"},
  {"id":"DX-5","priority":"P1","component":"errors","title":"Reason codes with docs/troubleshooting.md anchors for PREDECESSOR MOVED, gate-reuse not-eligible, repo commands refused, artifact invalid, guard not installed; every line carries fix:","files":["lib/gate-outcomes.ts","docs/troubleshooting.md","lib/tree-receipt.ts","lib/restamp.ts","lib/headless-artifacts.ts","autoplan/bin/phase-publication-hook"],"effort_human":"1.5 days","effort_cc":"1.5 hours","source_finding":"Finding 5"},
  {"id":"DX-6","priority":"P1","component":"artifacts","title":"`gstack-artifact ack <run.json> --consumer <id>` so the P7 adoption number is measurable; `validate --json`, exit table, `schema <name>`","files":["lib/headless-artifacts.ts","bin/gstack-artifact","docs/unattended.md","test/gstack-artifact.test.ts"],"effort_human":"1 day","effort_cc":"1.5 hours","source_finding":"Finding 6, Finding 12"},
  {"id":"DX-7","priority":"P1","component":"docs","title":"Parent-agent quickstart (install → run → validate → answer → ack) with copy-paste commands; link from the user-scope Capy skill","files":["docs/unattended.md","README.md","agents-digest/gstack-AGENTS.md"],"effort_human":"1 day","effort_cc":"1 hour","source_finding":"Pass 6, Pass 1"},
  {"id":"DX-8","priority":"P2","component":"unattended","title":"One terminal-status grammar `GSTACK_RESULT: skill= status= run=` for autoplan and cso; run.json.status enum","files":["lib/headless-artifacts.ts","autoplan/sections/unattended.md.tmpl","cso/SKILL.md.tmpl","test/autoplan-unattended.test.ts"],"effort_human":"0.5 day","effort_cc":"45 min","source_finding":"Finding 7"},
  {"id":"DX-9","priority":"P2","component":"tree-receipt","title":"Specify receipt inputs (--gated, --predecessor | --from gate-ahead.json), add --json, fix clause on refusals","files":["lib/tree-receipt.ts","bin/gstack-tree-receipt","ship/SKILL.md.tmpl","land-and-deploy/SKILL.md.tmpl"],"effort_human":"1 day","effort_cc":"1 hour","source_finding":"Journey F10, Finding 5"},
  {"id":"DX-10","priority":"P2","component":"ship-receipt","title":"schema_version in the fenced receipt and `gstack-ship-receipt read --pr N` for /land-and-deploy","files":["bin/gstack-ship-receipt","lib/headless-artifacts.ts","land-and-deploy/SKILL.md.tmpl"],"effort_human":"0.5 day","effort_cc":"45 min","source_finding":"Journey F13"},
  {"id":"DX-11","priority":"P2","component":"setup","title":"Document ./setup --no-browser and the precedence over GSTACK_SKIP_PLAYWRIGHT and --with-browser in setup --help","files":["setup","bin/gstack-capy-install","test/setup-help.test.ts"],"effort_human":"0.5 day","effort_cc":"30 min","source_finding":"Finding 8"},
  {"id":"DX-12","priority":"P2","component":"pin-files","title":"`init` scaffolds for ship-policy.json, generated.json, pregate.json, banned-terms.json plus docs/ship-policy.md with gstack's own examples","files":["bin/gstack-restamp","bin/gstack-regen","bin/gstack-pregate","bin/gstack-banned-terms","docs/ship-policy.md"],"effort_human":"1 day","effort_cc":"1 hour","source_finding":"Finding 13"},
  {"id":"DX-13","priority":"P2","component":"plan-text","title":"Split hook-absent vs hook-failed semantics; make drive state root opt-in; correct the hosts capabilities sentence; align review-log exit codes","files":["scripts/resolvers/autoplan-publication-hook.ts","autoplan/bin/phase-publication-hook","bin/gstack-skill-start","bin/gstack-review-log"],"effort_human":"0.5 day","effort_cc":"45 min","source_finding":"Findings 10, 11, 15, 16"},
  {"id":"DX-14","priority":"P3","component":"restamp","title":"--dry-run flag and all-or-nothing refusal when repo commands are not authorized (`nothing written`)","files":["lib/restamp.ts","bin/gstack-restamp"],"effort_human":"0.5 day","effort_cc":"30 min","source_finding":"Finding 14"},
  {"id":"DX-15","priority":"P3","component":"cli","title":"Shared exit-code table (0/1/2/3) in every new bin's --help and a --help coverage test for the new bins","files":["bin/gstack-artifact","bin/gstack-restamp","bin/gstack-tree-receipt","bin/gstack-pregate","bin/gstack-gate","test/new-bin-help.test.ts"],"effort_human":"0.5 day","effort_cc":"45 min","source_finding":"Pass 4"}
]
```

推奨: 条件付きで承認する。成果物の契約とゲート一覧は、エージェント優先のツールにとって正しい形である。しかし、unattended のループには回答と再開のステップがなく、インストールの判定は 2 つのコンポーネントの語彙を使い、stamp-at-merge の下では `--next` がキューリーダーと矛盾する。PR B と PR C が着地する前に DX-1 から DX-7 を修正すれば、この有望な計画は、散文を読まずに親が端から端まで駆動できる計画になる。
