# 無人実行: アーティファクト契約

gstack のスキルは、親エージェントが `GSTACK_SESSION_KIND=unattended` を付けて起動し、散文ではなくアーティファクトを読んで結果を判断するとき、*無人 (unattended)* で実行されます。このページは、その親と実行とのあいだの契約です。セッション種別が何を変えるのか、実行がどのファイルを書くのか、親が実行の完了をどう判断するのか、そして Markdown を一切読まずに結果をどう読み取るのかを定めています。

セッション種別は次のとおりです。`interactive`(人間がプロンプトに答える)、`headless`(`GSTACK_HEADLESS`、`CI`、eval ハーネス。質問すると BLOCK する)、`spawned`(オーケストレーターのサブエージェント。推奨の選択肢が自動で選ばれる)、`unattended`(このページの対象)。`unattended` は明示的な `GSTACK_SESSION_KIND=unattended` の指定でのみ有効になり、これは `GSTACK_HEADLESS` より優先されます。親が CI の中から実行を駆動できるようにするためです。テストハーネスと eval ハーネスはこの値を設定しないので、`headless` の BLOCK の動作はそのまま残ります。

## セッション種別が変えること

`gstack-skill-start` は `SESSION_KIND: unattended` と `UNATTENDED_SESSION: true` を出力し、スキル全体に次のルールを適用します。

- **プロンプトなし。** 更新チェック、アップグレードの案内、テレメトリと同期の同意、オンボーディングのヒント、ルーティングのブロックは、`spawned` と同じく抑止されます。答えられなかった同意は `off` 扱いです。
- **公開と同期はライター側で強制される。** 利用分析は書き込まれません(`TELEMETRY_WRITE: skipped (unattended session)`)。アーティファクトのリポジトリは pull も push もされません(`ARTIFACTS_SYNC: skipped (unattended session; mode=<m> queue=<n> retained)`)。同期スプールには何も入りません(`gstack-brain-enqueue` は何もしません。`gstack-review-log` は stderr に `review-log: sync skipped (unattended session)` と出します)。`gstack-skill-end` は何も送り出しません。有効になっている既存の設定と保留中のキュー処理は、次に人間が使うセッションに残されます。アップグレードの案内はスキル終了時に 1 行だけ出ます。内容はローカルのキャッシュから読まれ、`UPGRADE_AVAILABLE: <version>; run /gstack-upgrade` の形式です(main がチェックアウトより <n> コミット先に進んでいるが新バージョンがない場合は `<version>+<n> (main at <sha>)` になります)。
- **質問は自分で決めるが、ゲートは決めない。** `(recommended)` の選択肢がある質問は、その選択肢が選ばれ、選択内容が `kind: "auto"` として `decisions.jsonl` に追記されます。推奨のない質問、同意、破壊的または不可逆な選択肢、最終承認ゲートは、`kind: "approval"` と `status: "pending"` で追記されます。スキルは次のゲートで止まり、保留中の一覧を出力して終わります。承認も公開もしません。
- **状態ルートの耐久性を報告する。** `STATE_ROOT: <path> durable=yes|no` が出力されます(ホストが `GSTACK_EPHEMERAL=1` を設定している場合は `no`)。一時的なルートでは、消えるディスクに書き込まず、`learnings: skipped (state root is ephemeral; set GSTACK_STATE_ROOT)` と `timing: analytics skipped (...)` と報告します。実行をまたいで履歴を残したいときは、`GSTACK_STATE_ROOT` を永続的なディレクトリに向けてください([state-root.md](state-root.md) を参照)。
- **autoplan の公開ガードは「名指しはするが、偽装はしない」。** Claude Code のフックを実行しないホストでは、そして無人セッションでは常に、`gstack-skill-start` が `autoplan guard: not enforced by this host; publication order is unverified (GUARD_NOT_INSTALLED)` を 1 回出力します。`gstack-artifact validate` は、無人実行の `review-record.md` にこの行があることを要求します。Claude Code の「存在しなければ拒否する」動作は変わりません。

未知の `GSTACK_SESSION_KIND` の値は `interactive` に丸められ、その旨が `SESSION_KIND: interactive (unknown kind '<x>')` と表示されます。

## 終端行

無人実行では、すべてのワークフロースキルが、親が grep する 1 行で終わります。

```
GSTACK_RESULT: skill=<name> status=<status> run=<dir>
```

`status` は `complete`、`gate_pending`、`incomplete`、`interrupted`、`refused` のいずれかです。`run` は、下に挙げるアーティファクトを格納しているディレクトリです。`/autoplan` は最終ゲートに到達すると、必ず `gate_pending` で終わります。ゲートは書き出されますが、承認されることはないからです。純粋な問い合わせ(`gstack-artifact schema`、`gstack-gate render`)は終端行を出力しません。

ワークフローのコマンドはすべて、同じ終了コードの表を共有します。`0` は成功、`1` は失敗、`2` は使い方の誤り、`3` は拒否または追加フラグが必要であることを表します。エラー行の末尾には、括弧つきの結果コードが付きます。例: `findings.jsonl:12: ... (ARTIFACT_SCHEMA)`。各コードには [troubleshooting.md](troubleshooting.md#unattended-runs-and-artifacts) に、`fix:` 項目つきのアンカーがあります。説明文ではなく、コードを grep してください。

## 実行ディレクトリ

| ファイル | スキーマ | 内容 |
|------|--------|----------|
| `run.json` | `run` v1 | マニフェスト。`run` の ID、`status`、`required_phases`、各フェーズの `native` と `outside` の結果(`status`、`model`、`provider`)、入力の `snapshot` ハッシュ、`counts`、各アーティファクトの `path`(実行ディレクトリからの相対パス)と `sha256`、`session_kind`、`gate_rev`、`deviations`、`consumed_by`。 |
| `decisions.jsonl` | `decisions` v1 | 決定 1 件につき 1 行。`id`(`<run>-<label>` ゲートリビジョン 1 の場合、`<run>-r<rev>-<label>` は再オープン後。ラベルはゲートごとに振り直されるため)、`title`、`options`、`recommended`、`kind`(`auto`、`approval`、`user_challenge`)、`status`(`pending`、`approved`、`overridden`、`rejected`)、`gate_rev`、回答後は `chosen`、`answered_at`、`reply`。 |
| `findings.jsonl` | `findings` v1 | レビュアーの指摘 1 件につき 1 行。`id`、`phase`、`voice`(`native`/`outside`)、`model`、`severity`、`title`、`disposition`、`plan_items`、`native_counterpart`(文字列または null)、`source`。各行はレビューログの行形式と同じなので、`gstack-review-log --findings` はこのファイルからレビューの状態を導出します。 |
| `tasks.jsonl` | `tasks` v2 | 実装タスク。`id`、`title`、`status`、`depends_on`、`findings`(`findings.jsonl` 内の ID)、`blocked_by`、`acceptance`、任意の `pr`/`item`/`tier`。 |
| `timing.json` | `timing` v1 | フェーズごとの `started_at`、`ended_at`、`wall_s`、`outside_s`、`native_s`。実行全体の `started_at` と `total_wall_s`。フェーズ 0 の `estimate`。 |
| `plan.md` | 散文 | `## Implementation plan` セクション。その上に `## URGENT, outside this plan` が書かれます。 |
| `review-record.md` | 散文 | レビューの記録と決定の監査証跡。無人実行では `GUARD_NOT_INSTALLED` の行を含みます。 |
| `gate.json` | `gstack-gate --help` を参照 | `/autoplan` が描画して解析する最終ゲートの一覧。 |

ID は実行に紐づいています。どの行の `id` も `<run>-` で始まり、`run.json` だけが実行 ID を宣言する場所です。`gstack-artifact schema <name>` は、`findings`、`decisions`、`tasks`、`timing`、`run`、`pregate`、`ship-receipt` のいずれかの JSON Schema を出力します。`schema --list` は名前の一覧を出力します。

## 親が実行結果を読む手順

1. **実行が終わったかどうかを判断する。** `gstack-artifact validate <dir>/run.json` が、決定的な完了チェックです。マニフェストが解析でき、スキーマに合致し、必要な各フェーズと各レビュアーの声に終端の結果があり、列挙されたアーティファクトがすべて実行ディレクトリ内に記録済みのハッシュ付きで存在し、JSONL ファイルの各行がスキーマを通り、実行に紐づいた ID が一意で、タスクの依存関係と指摘の参照が循環なく解決でき、`counts` がファイルと一致し、(無人の場合は)ガード行が存在する、という場合にのみ、終了コード `0` で `ARTIFACT_VALID: run=<id> status=<status>` と出力します。それ以外は終了コード `1` で、問題ごとに 1 行のエラーと `ARTIFACT_INVALID: <n> error(s)` を出力します。`--json` は同じ内容を `{ valid, run, status, run_dir, errors[] }` で返します。途中で中断された実行は、部分的な成功としてではなく、`ARTIFACT_RUN_INTERRUPTED` として表示されます。
2. **終端行を読む。** `grep '^GSTACK_RESULT:' <log> | tail -1`。`status=gate_pending` の場合、ゲートはアーティファクトの中にあります。何も承認されていません。
3. **保留中のものを一覧する。**
   ```bash
   jq -c 'select(.status=="pending")' <dir>/decisions.jsonl
   gstack-gate render <dir>/gate.json --all    # the numbered list and reply grammar, every page
   ```
4. **ゲートに回答する。** 返信の文法(`rec`、`as-is`、`<id><option>` のトークン(例: `d3b uc1a`)、または `rec except <tokens>`。単なる yes/no は拒否されます)を組み立て、読み取ったゲートリビジョンとともに送り返します。
   ```bash
   gstack-gate parse <dir>/gate.json --reply "rec except d3b" --gate-rev 1 --json
   gstack-gate decisions <dir>/gate.json --reply "rec except d3b" --gate-rev 1 >> <dir>/decisions.jsonl
   ```
   リビジョンが古い場合は `GATE_REV_STALE`、解析できないトークンが含まれる場合は `GATE_REPLY_UNPARSED` になります。どちらも終了コード `1` で、何も書き込みません。
5. **説明文を読まずに指摘とタスクを読む。**
   ```bash
   jq -c 'select(.severity=="Critical" and .disposition!="accepted")' <dir>/findings.jsonl
   jq -r '.id + "\t" + .title' <dir>/tasks.jsonl
   gstack-artifact urgent <dir>/findings.jsonl   # the URGENT block, or "None."
   ```
6. **読み取り済みであることを記録する。** 2 人目の親(あるいは再試行)が、その実行がすでに読まれたと判断できるように、`gstack-artifact ack <dir>/run.json --consumer <id>` を実行します。これは冪等で、マニフェストに `consumed_by` を記録します。

## 親から `/autoplan` を駆動する: `gstack-autoplan`

親がレビュアーを自分でディスパッチするホスト(Capy、Claude Code のハーネスを持たないオーケストレーター)では、`bin/gstack-autoplan` が、実行全体を管理する明示的で永続的な状態機械になります。親はレビュー記録を読むことはなく、2 つのコマンドのループを回し、出力される行を読みます。どのホストでも、親は autoplan/SKILL.md ではなく `autoplan/DRIVER.md` を読みます(そのパスは `gstack-autoplan --help` と最初の `next` が `DRIVER:` として表示します)。このファイルは、フェーズの順序、アーティファクトの契約、ゲートの手順を、コードから生成された約 100 行にまとめたものです。

```bash
AP=bin/gstack-autoplan
$AP next --out <dir> --plan <plan.md> [--ui|--no-ui] [--developer-tool] [--no-dx] [--light] [--spend-cap <usd>]
#   PHASE: ceo snapshot=<sha> order=ceo,design,dx,eng
#   SCOPE: ui=yes (...) dx=yes (detected: ...) source=ui:detected,dx:detected
#   DRIVER: <root>/autoplan/DRIVER.md
#   Skipped sections: none (scope: ui=yes,dx=yes,source=ui:detected,dx:detected; checklist=loaded)
#   ATTEMPT: <run>-a1 phase=ceo voice=native  prompt=<dir>/ceo-native-prompt.md  result=<dir>/ceo-native.a1.md  model_family=...
#   ATTEMPT: <run>-a2 phase=ceo voice=outside prompt=<dir>/ceo-outside-prompt.md result=<dir>/ceo-outside.a2.md model_family=differs from the native reviewer
#   SPEND: spent=0.00 reserved=0.00 unknown=0(0.00) worst_case=0.00 cap=none
#   GSTACK_RESULT: skill=autoplan status=awaiting_result run=<dir>
```

最初の `next` は `SCOPE: … source=ui:<flag|marker|detected>,dx:<…>` を出力します。CLI のフラグがプランのマーカーと異なる場合は、`SCOPE_PIN: add <!--
gstack-autoplan-scope: … --> as the first line of <file>` も出力されます。gstack がプランを書き換えることはありません。

1. **各 `ATTEMPT:` をディスパッチする。** ネイティブの声は、親自身のモデルによるサブエージェントで、プロンプトファイルを受け取ります。外部の声は、別のモデルファミリーのサブエージェント、または `bin/gstack-outside-voice run --runner codex-cli|api --prompt <file> --out <file> [--model <id>]` です。後者は `OUTSIDE_STATUS: <status> provider=<runner> model=<id> family=<f>` を出力します。すべてのレビュアーは、下の RESULT FORMAT に従って、出力された `result=` のパスに結果を書きます。`next` は冪等です。開いている試行を再出力するだけで、自分で再ディスパッチすることはありません。`EXECUTION_UNKNOWN` は、結果を出さずにプロセスが死んだ試行を列挙します。`--redispatch <attempt>` は新しい試行を発行し、`release --attempt <id>` はその予約を返します。
2. **各結果を一度だけ提出する。**
   ```bash
   $AP submit --out <dir> --phase ceo --voice native  --result <dir>/ceo-native.a1.md  --model <id> --attempt <run>-a1
   $AP submit --out <dir> --phase ceo --voice outside --result <dir>/ceo-outside.a2.md --model <id> --attempt <run>-a2 [--runner host-subagent (default)] [--usage-usd <n>]
   #   BOUND: <run>-a1 phase=ceo voice=native model=<id> findings=7 sha256=<result hash prefix>
   #   PHASE_CLOSED: ceo confirmed=4 disagree=1 new=2 native_only=1 coverage=both
   ```
   submit は、バインドしたバイト列を `<phase>-<voice>.<attempt>.bound.md`(読み取り専用)として確定します。その後レビュアーのファイルに書き込んでも、バインド済みの内容には影響しません。別の試行の結果ファイルは拒否されます(`ATTEMPT_MISMATCH`)。バインドでは、受領行がフェーズのスナップショットと照合され(`RESULT_RECEIPT_MISSING`)、正規の指摘フェンスが解析され(`RESULT_FINDINGS_MISSING`)、ネイティブと同じファミリーの外部モデルは拒否されます(`MODEL_FAMILY_CONFLICT`)。同じ試行の二重バインドや、そのフェーズがまだ待っていない状態でのバインドも拒否されます(`ATTEMPT_MISMATCH`、`PHASE_NOT_AWAITING`、終了コード 3)。両方の声が揃うとフェーズは閉じます。照合結果(外部の指摘ごとの `confirmed` / `unverified` / `disagree` / `new`。不一致と解決は別々に保持されます)は `<phase>-consensus.{json,md}` に書かれます。以後のすべてのフェーズのプロンプト(DX、デザイン、Eng)は、閉じた前段フェーズのコンセンサスをデータとして含みます。コンセンサスがないフェーズは開くことを拒否します(`CONSENSUS_MISSING`)。
3. **`status=gate_pending` になるまで `next` を回し続ける。** Eng は常に最後に実行されます。ゲート(`gate.json`、`gate_rev`)には、ユーザーへの挑戦が承認項目として、不一致が自動項目として、そして `p1` のプラン承認が並びます。何も承認されていません。
4. **読み取ったリビジョンと返信の文法を使って、ゲートに回答する。**
   ```bash
   $AP answer --out <dir> --gate-rev 1 --reply "rec" --by human            # every recommendation, plan changes included (APPLY: ...; amend_pending)
   $AP answer --out <dir> --gate-rev 1 --reply "as-is" --by human          # APPROVED: keeps every direction, no new paid phase
   $AP answer --out <dir> --gate-rev 1 --reply "rec except d1b" --by agent:<id> --owner-reply "<owner's words>"
   ```
   `--by human` は、オーナー自身がトークンを入力したことを意味します。`--by agent:<thread or id>` は、エージェントがトークンを中継したことを意味します。その場合、`--owner-reply`(または stdin の `-`、`--owner-reply-file <path>`)でオーナーの言葉をそのまま保存します(`OWNER_REPLY_REQUIRED`)。オーナーの言葉が別の選択に解析される場合は拒否されます(`GATE_OWNER_REPLY_MISMATCH`)。無人実行では `--by` のない回答は拒否されます(`ANSWER_BY_REQUIRED`、終了コード 3)。この値は各決定行と、レビュー記録のゲートの行に `answered_by` として記録されるので、エージェントが閉じたゲートと、オーナーが閉じたゲートを区別できます。`gstack-autoplan recommend` は、中継の前に 1 つの推奨を変更します。ゲートの `rec_rev` が上がり、以後の `rec` には、オーナーが見た描画の `--rec-hash` が必要になります(`GATE_REC_STALE`)。
   両方の声が確定した指摘(タイトルの一致に基づくもの。`file:line` の近さだけによるものは `unverified`)に対して出された、ユーザーへの挑戦は、同じ `changes` の値を持つ場合にのみ `b` として推奨されます。そのためには、1 つの共有された提案が必要です。それは、その提案を名指しする `--reconcile` の記録、または両方の声が同じ修正案を出したことです。修正案が異なる場合、または欠けている場合は `a` のままです。選択肢 b には、両方の修正案がその根拠とともに並んで表示されます。`rec`(別名 `all`)はすべての推奨を受け入れるので、`b` と推奨された項目も受け入れます。受け入れられたプランの変更はそれぞれ `APPLY: <decision id> <title> -> <chosen text>` を出力し、保留中の修正になります。`next` は `PLAN_AMEND_PENDING` で拒否し、`export` は `revise --incorporates` がそれを指定するまで `complete` の実行を拒否します。プランの編集を伴わないパッケージングや順序の変更は、`revise --settle <id>` で決着させられます。古いリビジョン(`GATE_REV_STALE`、終了コード 3)、単なる `yes`/`no`、矛盾する返信(`GATE_REPLY_UNPARSED`)は何も書き込みません。承認項目が保留のまま残る返信は、答えられた自動項目だけを記録し、ゲートを保持します。後の返信が、先の回答を上書きすることはありません。受け入れられた変更は、回答時には何も再オープンしません(状態は `amend_pending`)。`revise` は、レビューされたプランが変わったフェーズと Eng をそれぞれ再オープンし、そのプロンプトとコンセンサスを `*.r<rev>.*` として退避させます(確定した `*.bound.md` の結果はそのまま残ります)。次のゲートは `gate_rev + 1` です。`p1d` は現在のプランで全フェーズを再実行します。`p1e` は `incomplete` で終了します。
5. **エクスポートして検証する。** `$AP export --out <dir>` は `plan.md`(先頭に `## URGENT, outside this plan` ブロック付き)、`review-record.md`、`tasks.jsonl`、`decisions.jsonl`、`findings.jsonl`、`timing.json`、`run.json` を書き出します。その後、`gstack-artifact validate <dir>/run.json` と、上記の消費の手順がそのまま適用されます。`$AP status --out <dir>` と `resume` は、実行ディレクトリを移動した後も動きます(パスは再ルートされ、ジャーナルのパスは実行からの相対パスです)。`GSTACK_AUTOPLAN_CHECKPOINT_DIR` が設定されている場合(Capy では、`gstack-config set autoplan_checkpoint drive` が非公開のプロジェクト用ユーザーの Drive フォルダをデフォルトにします。設定されていない場合は、最初の `next` がエクスポートの行を出力します)、静止状態の実行、バインドされた各声の後、各フェーズの遷移の後に、不変でハッシュ付きの世代を `<dir>/<run>/generations/` の下に公開し、`current.json` をそれに切り替えます(前の世代は残ります。古いコピーが新しいものを置き換えることはありません。実行と重なるディレクトリは `CHECKPOINT_OVERLAP` で拒否されます。失敗は `CHECKPOINT: failed` の警告になり、コマンドの終了コードには影響しません)。`$AP checkpoints --from <dir>` は、ハッシュの状態つきで世代を一覧表示します。`$AP resume --out <new dir> --from <dir>/<run>` は、ステージングされた実行を検証したうえで、最新の有効な世代を復元します(`CHECKPOINT_INVALID`)。

並行性と復旧: すべての状態の書き込みは、ロックつきの読み取り・変更・書き込みです(`run.lock`。2 人目の書き込み側は `RUN_LOCKED` を見ます)。試行はディスパッチの前に `attempts.jsonl` にジャーナルされます。`submit` の前後で親が死んでも、`next` で再開でき、二重課金は起きません(`test/autoplan-run-recovery.test.ts`、`test/autoplan-run-concurrency.test.ts`、`test/autoplan-answer-invalidation.test.ts`)。`--spend-cap` は、各試行を `spend.json` を通して受け付けます(`SPEND_CAP_EXCEEDED` で拒否、終了コード 3)。host-subagent の支出は `unknown` で、`worst_case` に計上されます。`--deadline <min>` を指定すると、`run` サブコマンドは自分が起動した子プロセスを取り消し、実行を `interrupted` にします。

### RESULT FORMAT(すべてのレビュアーのファイルが含むべき内容)

各プロンプトファイルは、この契約で終わります。`submit` がこれを強制します。

1. 最初の行は、正確に `INPUT: <phase> <snapshot sha256>` です(結果を、両方の声がレビューしたスナップショットに結びつける受領行です)。
2. レビュー本文は散文で、その後に正規の指摘を 1 つのフェンスブロックとして置きます。1 行に 1 つの JSON オブジェクトです。指摘は ```` ```gstack-findings ```` フェンスの中に書きます。`severity` は Critical | High | Medium | Low | Informational のいずれかです。`"user_challenge": true` は、プランの明示された方向性に対する推奨変更を示し、`"changes": "scope" | "cost" | "direction"`(受け入れると何が変わるか)が必要です。`"urgent": true` と `"suggested_owner"` は、プランが担当しないセキュリティまたはデータ損失の指摘を示します。空のフェンスは指摘がないことを意味します。フェンスがない場合は拒否されます。
3. 結果全体を、出力された `result=` のパスに書きます。

### 外部の声のランナー

| ランナー | アクセス | 記録のラベル | 必要なもの |
|---|---|---|---|
| `codex-cli` | リポジトリ、読み取り専用、ここで実行される | `repository review` | `codex` が PATH にあり、ログイン済みであること(`bin/gstack-codex-login` は stdin から `OPENAI_API_KEY` を読みます) |
| `api` | 与えられた入力のみ | `supplied-input review` | `--model <id>` と `OPENAI_API_KEY` または `ANTHROPIC_API_KEY`。リポジトリレビューと黙って同一扱いされることはありません |
| `host-subagent` | ホスト側 | `host-dispatched review` | サブエージェントが書いた `--result <file>`、`--model <id>`。支出は `unknown` |

`bin/gstack-outside-voice runners` は、このマシンで各ランナーが利用可能かどうかを表示します。`family <model>` は、`submit` が比較するモデルファミリーを表示します。完了した `api` または `host-subagent` のレビューは、完全な外部の声として、そのランナー名のラベルつきで記録されます。結果コード: `EXECUTION_UNKNOWN`、`RUN_LOCKED`、`RUN_NOT_INITIALIZED`、`PHASE_NOT_AWAITING`、`ATTEMPT_MISMATCH`、`RESULT_RECEIPT_MISSING`、`RESULT_FINDINGS_MISSING`、`MODEL_FAMILY_CONFLICT`、`SPEND_CAP_EXCEEDED`、`CONSENSUS_MISSING`、`OUTSIDE_RUNNER_UNAVAILABLE`(アンカーは [troubleshooting.md](troubleshooting.md) にあります)。

### 手書きの記録、改訂されたプラン、受け入れ

- **手書きのレビュー。** `submit --record <file>` は、RESULT FORMAT に従っていないレビューを紐づけます。対象は、`gstack-findings` フェンス、重大度と題名の列を持つ指摘の表 1 つ、重大度タグ付きのリスト(`- [High] title`)1 つ、または `No findings.` の行 1 つです。`INPUT:` 行がない場合は、`--attest "<reason>"` と `--attempt <id>`(受領は `attested`。後で `revise` が行われると拒否されます)を付けた場合にのみ紐づけられます。`gstack-artifact validate` は `attested=<n>` を出力します。開いている試行がちょうど 1 つの場合は、`--attempt` を省略できます。`submit --voice outside --unavailable "<reason>"`(または `--failed`)は、ネイティブが紐づけられた後にフェーズを `native_only` で閉じます。`next` と `resume` は、これを再ディスパッチしません。
- **同じ実行の中でプランを改訂する。** ソースのプランを編集してから、`$AP revise --out <dir> --plan <file> [--incorporates <decision id,...>]` を実行します。レビューされた実装プランのハッシュが変わったフェーズはすべて再オープンされ(Eng も含む)、新たに対象になったフェーズは追加されます。退避ファイルは `.r<rev>` の名前を保ち、衝突した場合にのみ `.v<k>` を付けます。`gate_pending` での revise は、次のゲートを `gate_rev + 1` にします。`--incorporates` は、名指しされた修正だけを処理し、プランが変わっていない場合は拒否します。`revise --out <dir> --withdraw <decision id>` は、ジャーナルされたオーナーの決定として 1 つを取り下げます。ソースのプランが、スナップショット以降に変わった場合、`next` は `PLAN_CHANGED`、`answer` は `PLAN_SOURCE_CHANGED` を出力します。`## Implementation plan` と `## Review record` の両方がないプランは `PLAN_SECTIONS_INVALID` で拒否されます。`next --scaffold` は、欠けている見出しを追加したコピーをレビューします。`resume` は、中断された revise を完了させます。
- **受け入れとアップグレード。** Capy ホスト(`GSTACK_CAPY=1`)では、`$GSTACK_INSTALL_VERDICT` に、このチェックアウト、HEAD、ワークフローについての正常なインストール判定がない限り、`next`、`submit`、`answer`、`revise`、`export`、`run` は拒否されます(`INSTALL_UNVERIFIED`)。また、無人セッションで実行中の Bun が gstack のサポート最低バージョンを下回る場合も拒否されます(`RUNTIME_BELOW_MINIMUM`)。判断は `gstack-skill-start` が行うものと同じです(Install admission を参照)。`GSTACK_ALLOW_UNSUPPORTED_RUNTIME=1` で上書きでき、その場合は実行の逸脱として記録されます。`status` と `resume` は制限を受けません。古い gstack が書いた実行ディレクトリは `GSTACK_VERSION_CHANGED` を一度だけ出力し、先に進みます(古い決定 ID は名前を変えられ、ジャーナルに記録されます)。新しい gstack が書いたものは拒否されます。

## オーナー向けブリーフ

`gstack-owner-brief render --out <dir>` は、最終ゲートでオーナーに見せる内容を出力します。無人でも対話でも同じです。`gate.json`、`decisions.jsonl`、`findings.jsonl` から作られる 1 ページで、いずれかが欠けていると `BRIEF_INPUT_MISSING` になります。冒頭は `URGENT, outside this plan` ブロックで、その後に平易な言葉の要約が続きます(完了したフェーズ、受け入れた指摘、デフォルトのまま決まった決定の数、サイクルタイム。`--summary <file>` または `<dir>/summary.md` を指定すると、生成された文の代わりに実行側の要約が使われます)。続いて、ゲートの一覧どおりに番号つきの決定が並びます。1 ページ 7 件(`--page N`)、安定した ID を持ち、各 `auto` 項目には、回答がなかった場合に採用されるデフォルトが注記されます。各 `approval` 項目は `pending until you answer` か `decided <id><letter> on <date>` のいずれかです。最後の行は、全体のレビューが載っている `review-record.md` と、このページに回答するための `gstack-autoplan answer` の呼び出しを示します。`--write` を付けると、`brief.md` も実行ディレクトリに保存されます。`/autoplan` のフェーズ 4 では、この出力をそのまま提示し、以前の長いレポートは `review-record.md` に書き出されます。

最終ゲートの後、`gstack-owner-brief close --out <dir> --plan <file>` は、プラン内の `draft direction stands until the owner decides` の各行を、決まった選択肢と日付に書き換えます(`DRAFT_DIRECTION: line <n> <id> rewritten`)。決定がまだ保留の行はそのまま残り、`DRAFT_DIRECTION_UNRESOLVED`(終了コード 1)として報告されます。返信によってゲートが完了するとき、`gstack-autoplan answer` も同じ書き換えを行います(ジャーナルのイベント `draft_directions_closed`)。

## レーンの完了: pregate、封印されたガード、引き継ぎの行

コーディネーターの下で動くレーンは、完了を報告する前に、そのブランチで `gstack-pregate run --allow-repo-commands` を実行します(変更されたファイルに対するユニットテストと、リポジトリのガード。[docs/pregate.md#guards](pregate.md#guards) を参照)。`.gstack/pregate.json` に `sealed` キーがあるリポジトリでは、push や PR 作成の前に `gstack-pregate sealed` を実行します。PR ツールはローカルのフックを実行しない場合があるためです。引き継ぎには、`GSTACK_RESULT` の行の直後に `gstack: ok|fail <rev>` の行が続き、その後に `PREGATE:` の行が続きます。コーディネーターの契約(`gstack-autoplan contract`)も、同じルールを一字一句同じように定めています。

## タイミング

`/autoplan` は、フェーズ 0 で `ESTIMATE: ...` を出力します(`gstack-autoplan-timing estimate --run <id> --out <dir>`。直近 10 回の記録された実行の、フェーズごとの中央値。履歴がない場合は `no history`)。各フェーズの終了は `gstack-autoplan-timing close` で記録されます。明示的な開始のない close は、前のフェーズの終了から、なければ実行の開始から計測されます。最終ゲートでは、`CYCLE:` の行が出力されます(`gstack-autoplan-timing summary`)。実行をまたいだ履歴は `<state root>/analytics/autoplan-timing.jsonl` にあります。一時的な状態ルートでは、これはスキップされ、その旨が出力されます。

## 参考実行

`test/fixtures/multi-agent-wave/reference-run/` は、無人の `/autoplan` 実行を完全な形で収めたものです(この wave のプランを作った実行です)。これは、欠陥なく検証を通ります。`test/fixtures/multi-agent-wave/INCIDENTS.md` は、手作業で作られた際に何が起きたか、そして各インシデントを今どの検証ルールが捕まえるかを記録しています。

## インストールの受け入れ

無人の実行と、`GSTACK_CAPY=1` を伴う `GSTACK_SESSION_KIND=spawned` の実行は、サポートされた Bun でのみ開始されます。Capy マシン(インストーラーの `GSTACK_LAUNCH` 行が設定する `GSTACK_CAPY=1`)では、このチェックアウト、その HEAD、ワークフローについての合格したインストール判定も必要です。それ以外の場合、`gstack-skill-start` は `INSTALL: fail runtime|verdict — <detail>; fix: <command> (<CODE>)` と `GSTACK_RESULT: skill=<s> status=refused run=-` を出力し、終了コード 3 で終わります。その場合は止まって修正コマンドを実行してください。`GSTACK_ALLOW_UNSUPPORTED_RUNTIME=1` は、とにかく受け入れます(`INSTALL_VERDICT: overridden`)。これは逸脱として記録されます。TypeScript のエントリーポイントは `lib/install-verdict.ts` の `checkInstallAdmission` を使い、Bash 側は `bin/gstack-install-verdict.sh` です。詳しくは [capy-install.md](capy-install.md#the-launch-line) を参照してください。
