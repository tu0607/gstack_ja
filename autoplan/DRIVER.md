<!-- AUTO-GENERATED from autoplan/DRIVER.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
# /autoplan ドライバー: 親エージェントからレビューループを実行する

親エージェント(任意のホスト)が `gstack-autoplan` 経由で無人の /autoplan 実行を駆動する場合は、
`autoplan/SKILL.md` の代わりにこのファイルを読んでください。レビュアーはあなたがディスパッチするサブエージェントであり、
状態はランナーが保持します。コマンドは `<root>/bin/` にあります。`<root>` は、この `autoplan/` ディレクトリを含むフォルダです。
`gstack-autoplan --help` と最初の `next` は `DRIVER: <root>/autoplan/DRIVER.md` を出力します。
すべてのコマンドは、インストーラーが出力した `GSTACK_LAUNCH` の割り当てを付けて実行してください。
出力された行とファイルを読んでください。散文は読まないでください。すべてのワークフローコマンドは
`GSTACK_RESULT: skill=autoplan status=<s> run=<dir>` で終わり、すべてのエラー行は `(<CODE>)` で終わります。

## フェーズとスコープ

Order: ceo → design → dx → eng. Design は UI スコープのときだけ、DX は DX スコープのときだけ実行し、Eng は常に最後に実行します。
最初の `next` のスコープフラグ: `--ui`, `--no-ui`, `--no-dx`, `--developer-tool`, `--agent-primary`。`--developer-tool` と `--agent-primary` は DX を有効にするだけです。
最初の `next` は `SCOPE: ui=… (terms; visual; files) dx=… (detected) source=ui:<s>,dx:<s>` を出力します
(各軸は `flag`、`marker`、`detected` のいずれかです)。UI と判定されるには、実装計画内に描画されたファイルパスか、
視覚的な名詞の近くに UI 用語がある必要があります。同じ計画に対する後続の実行でフラグを維持するには、
出力された `SCOPE_PIN:` マーカー (`<!-- gstack-autoplan-scope: … -->`) を、計画の最初の行として自分で追加してください。
gstack が計画を書き換えることはありません。

## ループ

1. `next` は voice ごとに `ATTEMPT: <id> phase=<p> voice=native|outside prompt=<file> result=<file>` を 1 行ずつ出力します。
   native プロンプトは自分のモデルのサブエージェントに、outside プロンプトは別のモデルファミリーのサブエージェント
   (または `gstack-outside-voice run`)にディスパッチしてください。各 voice は `result=` で指定されたファイルに書き出します。
2. 各 voice を必ず 1 回だけ提出してください (`BOUND:`)。両方の voice が入るとフェーズが閉じます (`PHASE_CLOSED:`)。
3. `status=gate_pending` (`GATE: gate_rev=<n>`) になるまで `next` を繰り返します。`gstack-gate render <dir>/gate.json --all` で描画し、
   すべてのページをリレーしてください。オーナーに代わってゲートを承認することは決してありません。
   `rec` (計画変更を含むすべての推奨事項)を既定の選択肢として提示してください。
4. オーナーの返答を添えて `answer` を実行します。オーナーがトークンを自分で入力した場合は `--by human`、
   あなたが返答を中継した場合は `--by agent:<id> --owner-reply "<オーナーの言葉>"` を使います。`--by` がない場合、
   無人実行は拒否されます (`ANSWER_BY_REQUIRED`)。`APPLY: <id> <title> -> <change>` の行は受け入れられた計画変更です
   (ステータスは `amend_pending`)。計画を編集してから `revise` を実行してください (出力された `NEXT:` がそのコマンドを示します)。
   行に計画の編集が不要と書かれている場合は `revise --settle <id>` を使います。それまでは `next` が
   `PLAN_AMEND_PENDING` で拒否し、`export` は実行を完了済みにしません。
5. `REOPENED: <phases>` が出たら、`next` を再度実行してください (Eng は最後)。`APPROVED:` が出たら `export` を実行します。

### Capy 上での注意

- 必ず `gstack-autoplan` を駆動してください。`autoplan/SKILL.md` を手で適応させてはいけません。
  手作業でレビューした計画は autoplan の実行ではありません。その計画を autoplan の実行として提示しないでください。
- すべてのプロンプトは `GSTACK TRAILER` ブロックで終わります。レビュアーは自分のマシンで `--for review-voice` のインストールを
  実行し (./setup もスキルも不要。ウォーム状態なら数秒)、返答を `gstack:` の行から始めます。レビュアーに「インストールは不要です」と決して伝えないでください。
  各レビュアーの行を結果とともに中継し、その行が欠けている場合は `gstack: fail not-installed` として扱ってください。
- 実行が別のマシンへの移行後も生き残るように、`GSTACK_AUTOPLAN_CHECKPOINT_DIR` をプライベートなプロジェクトユーザーの Drive フォルダに設定してください
  (または `gstack-config set autoplan_checkpoint drive` ですべての実行をオプトインしてください)。世代は、各 voice が提出された後と、
  各フェーズ遷移の後に静止状態で公開されます。復元は `resume --out <新しいディレクトリ> --from <dir>/<run>` で行います。
  これは提出済みの voice を再ディスパッチしません。
- 計画には `## Before → after`、`## Why it matters`、`## What caused this work`、`## Big decisions` を含めてください。
  `answer` の後に、出力された `RELAY: gstack-owner-brief render --captain` の出力をキャプテン(または担当者)に中継し、
  その後 `gstack-approvals import --autoplan <dir>` を実行してください (`capy/skill/gstack/captain.md`)。

### コマンド

- `gstack-autoplan next --out <dir> --plan <plan.md> [scope flags] [--light] [--spend-cap <usd>] [--max-rounds <n>] [--scaffold]`
  最初の呼び出し: 実行を初期化し、PHASE:、SCOPE:、DRIVER: と、ボイスごとに 1 行の ATTEMPT: を出力します。--max-rounds はフェーズごとのレビューラウンド数の上限です(無人実行のデフォルトは 3)。無人の Capy 実行は、--estimate-usd <n> で指定しない限りホストの試行ごとに 5.00 を確保するため、--spend-cap が効きます.
- `gstack-autoplan next --out <dir> [--redispatch <attempt>]`
  2 回目以降の呼び出し: 次のフェーズを開く、または未完了の試行を再表示します。自分で再ディスパッチすることはありません.
- `gstack-autoplan submit --out <dir> --phase <p> --voice native|outside --record <file.md> --model <id> [--attempt <id>]`
  自由形式のレビュー記録を紐づけます(正規のフェンス、指摘事項の表またはリスト 1 つ、または `No findings.`).
- `gstack-autoplan submit ... --record <file.md> --attest "<reason>" --attempt <id>`
  INPUT: 行のない記録を receipt: attested として紐づけます(誤った INPUT: は常に拒否されます).
- `gstack-autoplan submit --out <dir> --phase <p> --voice native|outside --result <file> --model <id> --attempt <id>`
  正規の結果を紐づけます(下の RESULT FORMAT).
- `gstack-autoplan submit --out <dir> --phase <p> --voice outside --unavailable|--failed "<reason>"`
  外部ボイスを実行できないとき、ネイティブのみでフェーズを閉じます.
- `gstack-autoplan answer --out <dir> --gate-rev <n> --reply "<reply>" --by human|agent:<id> [--owner-reply <text>|-] [--rec-hash <h>]`
  下の返信文法でゲートに回答します。エージェントが回答する場合は、オーナーの言葉をそのまま保存します.
- `gstack-autoplan recommend --out <dir> --gate-rev <n> --item <id> --option <k> --basis "<why>"`
  中継の前に推奨を 1 つ変更します。その後、再度レンダリングして中継します(`rec` には新しい `--rec-hash` が必要です).
- `gstack-autoplan revise --out <dir> --plan <plan v2> --incorporates <decision ids>`
  修正したプランを紐づけます。レビュー済みのプランが変わったフェーズをすべて再び開きます(Eng は最後).
- `gstack-autoplan revise --out <dir> --settle <decision id|d4>`
  プランを編集せずに、パッケージングまたは順序の変更を完了扱いにします。何も再び開きません.
- `gstack-autoplan revise --out <dir> --withdraw <decision id>`
  保留中の修正を適用せずに取り下げます.
- `gstack-autoplan close --out <dir> --phase <p> --deferred "<reason>" --by human|agent:<id>`
  指摘付き承認でフェーズを閉じます。未解決の指摘は tasks.jsonl に入り、Critical、緊急、ユーザーへの異議の指摘はゲート項目になります。`STOP: reason=budget_exhausted` からの復旧手段でもあります.
- `gstack-autoplan budget --out <dir> [--spend-cap <usd>] [--max-rounds <n>] --by human|agent:<id>`
  オーナーによる上限の引き上げを記録します。予算で停止したあとは、`resume` で実行を続行します.
- `gstack-autoplan export --out <dir>`
  成果物一式を書き出します。そのあと `gstack-artifact validate <dir>/run.json` を実行します.
- `gstack-autoplan export --out <dir> --public <pub>`
  コミットや共有のための、マシン固有のパスを含まないコピーです(記録されたルートは書き換え、plan.md のコードは保持し、来歴ダイジェストを付けます)。非公開の実行には手を触れません。そのあと、このマシンで `gstack-artifact validate --public <pub> --private <dir>/run.json` を実行します.
- `gstack-autoplan status|resume --out <dir>`
  マニフェストを読みます(PENDING: 行が未完了の試行を示します)。クラッシュ後は所有権を引き継ぎます(EXECUTION_UNKNOWN が未完了の試行を列挙します).
- `gstack-autoplan resume --out <new dir> --from <checkpoint>`
  最新の有効なチェックポイント世代(GSTACK_AUTOPLAN_CHECKPOINT_DIR)を空のディレクトリに復元して所有権を引き継ぎます。`checkpoints --from <dir>` で一覧できます.

## レビュアーの結果フォーマット

すべてのプロンプトはこの契約で終わります。`submit --result` がこれを強制します。`submit --record` は上記のより緩い記録形式を受け付けます。

RESULT FORMAT(gstack-autoplan が要求します。親はこの契約に従ってあなたのファイルを紐づけます):
1. 結果の 1 行目は、次の行そのものにしてください: INPUT: <phase> <snapshot sha256>
2. レビュー全体を文章で書き、最後に、正規の指摘を入れたフェンス付きブロックを 1 つだけ置いて終えてください(1 行につき JSON オブジェクト 1 つ):
```gstack-findings
{"id":"F1","severity":"High","title":"<one line>","file":"<path or omit>","line":12,"fix":"<the fix>"}
```
   severity は Critical | High | Medium | Low | Informational のいずれかです。"user_challenge": true を付けるのは、プランが掲げる方向性の変更を勧め、かつその変更がスコープ、コスト、方向性を変える場合(その場合は "changes": "scope" | "cost" | "direction" も付けます)、または変えるのが提供の形(パッケージング)や順序だけで Implementation plan の編集を伴わない場合(その場合は "changes": "packaging" | "ordering" を付けます)に限ります。命名など元に戻せる選択は通常の指摘であり、ユーザーへの異議ではありません。このプランの責任範囲外にあるセキュリティまたはデータ損失の指摘には、"urgent": true と "suggested_owner": "<who>" を付けてください。フェンスが空なら指摘なしを意味します。フェンスがない結果は拒否されます。
3. Write the whole result to this file: <result file>

## ゲートへの返答

返答は、読み取った `gate_rev` に紐づけられます (`--gate-rev`)。`yes`/`no` だけの返答は解釈されず、推測もされません。

- `rec`: すべての項目が推奨を採用します(プラン変更を含み、それぞれ APPLY: を出力します)。`all` は別名です.
- `as-is`: すべての方向性をそのまま維持します。プラン変更はありません.
- `d3b uc1a`: 設定する項目ごとに <id><option> のトークンを 1 つ指定します。未回答の自動項目はデフォルトを採用します.
- `rec except d3b`: 推奨を採用し、列挙した項目だけ上書きします.

## 実行ディレクトリ

ランナーの状態: `run.json`, `attempts.jsonl`, `run.lock`, `spend.json`, `plan-active.md`, `restore.md`, `plan-source.md`. レビュアーのファイル: `<phase>-native-prompt.md`、
`<phase>-outside-prompt.md`、`<phase>-<voice>.<attempt>.md` (レビュアーが書き出す)、その封印された
`<phase>-<voice>.<attempt>.bound.md` (submit が紐づけた内容)、`<phase>-consensus.{json,md}`、
`gate.json`、`decisions.jsonl`。`export` は `plan.md`、`review-record.md`、`findings.jsonl`、
`tasks.jsonl`、`timing.json` を書き出し、`run.json` のハッシュを再計算します。完了の確認には
`gstack-artifact validate <dir>/run.json` を使います。単一ファイルではなく、ディレクトリ全体をコピーしてください。

## 結果コード

- `RUN_NOT_INITIALIZED`: `gstack-autoplan next --plan <file> --out <dir>` から始めてください(最初の呼び出しが実行を初期化します)
- `PLAN_SECTIONS_INVALID`: 足りない見出しを追加するか、最初の `gstack-autoplan next` を --scaffold 付きで再実行して、足場を付けたコピーをレビューしてください(プランファイル自体は編集されません)。重複、順序の逆転、空のセクションは手で直してください
- `RUN_LOCKED`: そのプロセスの終了を待つか、pid がすでに存在しない場合は `gstack-autoplan resume --out <dir>` を実行して所有権を引き継いでください
- `EXECUTION_UNKNOWN`: レビュアーが完了していれば結果ファイルを submit(`gstack-autoplan submit ... --attempt <id>`)するか、`gstack-autoplan next --redispatch <id>` で明示的に再ディスパッチしてください。自動で再ディスパッチされることはありません
- `SPEND_CAP_EXCEEDED`: `--spend-cap` を引き上げるか、未精算の試行を精算または解放するか、停止してください。金額が不明な請求は予約額として数えられます
- `PHASE_NOT_AWAITING`: `gstack-autoplan status --out <dir>` を実行し、`next` が出力した試行に対して submit してください
- `ATTEMPT_MISMATCH`: このボイスについて `next` が出力した試行 ID を渡してください。結果が紐づけられるのは 1 回だけです
- `RESULT_RECEIPT_MISSING`: レビュアーはプロンプトファイルを EOF まで読み、プロンプトが示す INPUT 行で結果を始めなければなりません。別のスナップショットの結果は拒否されます
- `RESULT_FINDINGS_MISSING`: レビューの最後に ```gstack-findings フェンスを 1 つ置き、1 行につき JSON オブジェクト 1 つ(最低限 severity と title を含める)で終えてください。`[]` の行は指摘ではなく、フェンスが空なら指摘なしを意味します
- `MODEL_FAMILY_CONFLICT`: 別のファミリー(anthropic、openai、google、xai、deepseek、qwen、zai、moonshot、meta、mistral)の `--model <id>` を渡してください。同じファミリーの結果は外部ボイスではありません
- `CONSENSUS_MISSING`: 実行を resume して、突き合わせ(reconciliation)を経てフェーズを閉じてください。それ以前のすべてのフェーズ要約がそろうまで、Eng のプロンプトは送られません
- `GATE_REV_STALE`: 現在のゲート一覧をレンダリングして読み、その gate_rev を指定して返信してください
- `GATE_REPLY_UNPARSED`: `rec`、`as-is`、`<id><option>` のトークン(例: `d3b uc1a`)、または `rec except <tokens>` で返信してください。yes/no だけの返信は曖昧です
- `GATE_REC_STALE`: ゲートを再度レンダリング(`gstack-gate render <dir>/gate.json --all`)して中継し、出力された `--rec-hash` を付けて回答してください
- `OWNER_REPLY_REQUIRED`: オーナーの言葉をそのまま、`--owner-reply "<text>"`、`--owner-reply -`(標準入力)、または `--owner-reply-file <path>` で渡してください
- `GATE_OWNER_REPLY_MISMATCH`: オーナーが選んだ内容をそのまま中継するか(または返信そのものを、例: `--reply rec`)、オーナーの言葉とトークンが食い違う場合はオーナーに確認してください
- `PLAN_AMEND_PENDING`: プランを編集してから `gstack-autoplan revise --out <dir> --plan <file> --incorporates <decision id,...>` を実行してください。パッケージングまたは順序の変更は `gstack-autoplan revise --out <dir> --settle <id>` で完了扱いにでき、不要な変更は `gstack-autoplan revise --out <dir> --withdraw <decision id>` で取り下げられます
- `AMENDMENT_NOT_SETTLEABLE`: プランを編集してから `gstack-autoplan revise --out <dir> --plan <file> --incorporates <decision id>` を実行してください(同じ呼び出しでパッケージング/順序の変更も完了扱いにするには `--settle <id>` を追加します)。`--settle` だけを使えるのは、実行がすでにレビューしているプランに対してのみです
- `CHECKPOINT_INVALID`: `gstack-autoplan checkpoints --from <dir>` を実行して各世代のハッシュの状態を確認し、損なわれていない世代を復元してください。--out には何も書き込まれていません
- `GSTACK_VERSION_CHANGED`: 古い実行には何も必要ありません(記録された前方マイグレーションが実行済みです)。新しい gstack が書いた実行には、その gstack が必要です。bin/gstack-upgrade でアップグレードしてください

## Coordinator contract(すべてのレーンが継承するコーディネーター契約)

マージ条件。レーンの PR がマージされるのは、次がすべて満たされたときだけです: 必須のゲートレーンがスタンプ済みのツリーで green であるか、ツリーの受領記録が `gate-reuse: eligible` と言っていること。`gstack-lane-check` が、計画されたファイルについて他のすべての open なレーンに対して `clear` を報告していること。PR 本文が `gstack-ship-receipt` ブロックで始まっていること。そして、マージすると言うのがレーンではなくコーディネーターであること。レーンは決して自分でマージせず、他のレーンをリベースせず、いかなるブランチも force-push しません。

挙動変更の通知。プラン自体の項目の外にある、ユーザーに見える挙動の変更はすべて、レビューが始まる前に、PR 本文の `## Behavior changes` の下に、ファイル、以前の挙動、新しい挙動を添えて列挙します。レビューで見つかった記載漏れの変更は、その大きさにかかわらず CRITICAL の指摘です。

支出上限。各レーンは、コーディネーターが指定した `--spend-cap` のもとで動きます。上限に達したレーンは `incomplete` で停止し(`STOP: reason=budget_exhausted`)、支出済み・予約済み・不明の各金額を報告します。有料 eval を判定を変えるために再試行することはありません。再実行には、名前の付いた修復が必要です。ホストのサブエージェントの支出は `unknown` として報告し、決してゼロにはしません。

完了の前に。レーンは各ステップの後に WIP コミットを自分のブランチへ push し、push 済みの SHA をゲートにかけます。完了と言えるのは `gstack-pregate run --allow-repo-commands` が通ったときだけです。`requires-remote` には `--stage tests --remote --spend-cap <cap>` が必要です。`.gstack/pregate.json` に `sealed` キーがある場合は、push や PR 作成の前に `gstack-pregate sealed` を実行し、拒否されたら push を止めます。

引き継ぎの書式。レーンは次の順で、識別子を先に報告します: PR の URL(または `no PR` とブランチと SHA)、`GSTACK_RESULT` 行、`gstack: ok|fail <rev>` 行、`PREGATE:` 行、ゲートの要約(通過・失敗・スキップしたレーン数)、挙動変更(または `none`)、支出(支出済み/予約済み/不明)、そして検証できなかったこと。スレッド間の参照には、短いコードではなく常に完全なスレッド id(`jam_…`)を使います。識別子より後の散文は切り詰めてもよいですが、識別子より前は切り詰めてはなりません。

