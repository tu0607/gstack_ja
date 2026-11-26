<!-- AUTO-GENERATED from exploratory.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
# Shared exploratory QA(共有の探索的 QA)

**呼び出し元**(/qa、/qa-only、/review、/ship)が、判断、テスト、修正、公開を担います。探索が書き込むのはレポート/証拠
と、自分が所有するフィクスチャの状態だけです。ワークフロー、フレームワークのインストール、公開は行いません。

チャーターの作成やプローブの前に、次の Read を順番に完了します。最初のプローブの前に結果を待ち、同じレスポンス内では行いません。この呼び出しですでに完了した Read は繰り返しません。
1. `sections/scope.md` relative to the installed `qa`/`gstack-qa` SKILL.md directory を全文 Read し、面を選びます。
2. 選んだ面に応じた下記の手法を全文 Read します。

**Functional の面:**
`sections/system-functional.md` を全文 Read します。

**Browser の面のみ:**
`sections/qa-patterns.md` を全文 Read します。

アセット、前提条件、許可が欠けている、または読めない場合は、影響を受けるプローブをブロックします。独立した安全なチェックはブロックしません。QA のセットアップ上のブロッカーを報告します。

## 1. Charter and preflight(チャーターと事前確認)

解決済みの REPORT_DIR を再利用します。なければ、新しい `.gstack/qa-reports` のサブディレクトリを自分で所有します。
挙動ごとに **charter** を書きます: 契約、リスク、エントリポイント、隔離、終了条件、ソース、コマンド、入力。charter は Markdown としてレポートに保存します。

/review と /ship では、プランやサーバーは必須ではありません。
5 分または 12 プローブのいずれか早い方で停止します(全面で SECONDS=300)。
明示的なプランのチェックと再検証は、このスモーク予算を超えても引き続き必要です。
/qa と /qa-only の場合:
- Browser Quick: SECONDS=180。Browser Full/Regression: SECONDS=900。
- Functional の Full、Quick、Regression には、デフォルトの合計タイマーはありません。
SECONDS には、モードと呼び出し元の制限のうち短い方を設定します。無制限のモードでは、呼び出し元の上限を使います。
合計の時間制限がない場合は、DEADLINE_FILE を作成せず、有限のコマンドタイムアウトを宣言します。
スコープ内の契約がテスト済みまたはブロック済みになった時点で停止します: 各フィールドの文書化された入力ルールごとに、そのルールだけを破り、他のすべてのルールを満たすプローブが必要です。プローブ/時間の上限で到達できなかったルールは limits に記載します。
クロックとチェックポイントは REPORT_DIR を使います。standalone の mixed 実行では REPORT_DIR/browser と REPORT_DIR/functional を使い、最終レポートは REPORT_DIR に 1 つ置きます。呼び出し元のパスが優先されます。
以下で使う名前(すべてのパスをクォートする):
- PROBE_DIR: 上の行に従った、この面で所有するプローブ用ディレクトリ。DEADLINE_FILE: `PROBE_DIR/deadline.json`。時間制限のある実行にのみ存在します。
- SECONDS: 上で設定した、プローブの合計予算。NNN: キャプチャやチェックポイントごとに新しい 3 桁の ID(001、002、...)。再利用しません。
- DEADLINE_TOOL = `$HOME/.claude/skills/gstack/bin/gstack-qa-deadline`、期限ガード: `start` は DEADLINE_FILE を作成し、`status` は `remainingMs` と `expired` を出力し、`run` は 1 つのコマンドを実行して、期限で停止します。
- EVIDENCE_TOOL = `$HOME/.claude/skills/gstack/bin/gstack-qa-evidence`、functional の証拠レコーダー: `capture` は 1 つのコマンドを実行し、その終了コード、stdout、stderr を `PROBE_DIR/.qa-evidence/NNN/` に保存して、ステータス `complete`、`incomplete`、`sensitive` のいずれかを出力します。

ベースラインの前に一度だけ開始します: 時間制限がある場合は `bun DEADLINE_TOOL start DEADLINE_FILE SECONDS [EARLIER_UTC]`。
EARLIER_UTC = 呼び出し元の絶対的な期限(設定されている場合)。
Functional: `bun EVIDENCE_TOOL capture PROBE_DIR NNN [--public] --deadline DEADLINE_FILE -- COMMAND ARGS`。
無制限の場合: `--deadline DEADLINE_FILE` の代わりに `--timeout-ms MS` を使います。
--public には、承認された公開/合成の出力が必要です。EVIDENCE_TOOL が認証情報をスクリーニングします。完全な非公開キャプチャでは、`PROBE_DIR/.qa-evidence/NNN/observation.json`(デコードされた stdout)を安全に Read して結果を待ちます。sensitive/incomplete のキャプチャは、チェックポイントの根拠にできません。
時間制限のある browser: `bun DEADLINE_TOOL run DEADLINE_FILE -- COMMAND ARGS`。切り離したプローブは禁止です。
DEADLINE_FILE をリセットしたり、DEADLINE_TOOL を迂回したりしてはいけません。期限切れ、または DEADLINE_FILE が無効/欠落している場合は、プローブを停止し、未完了のカバレッジを報告します。QA_DEADLINE のレシートは観測ではありません。

## 2. Probe loop(プローブのループ)

各プローブは、ネイティブなコマンド/操作 1 つとチェックです(記録作業は除く)。
プローブをまとめて実行してはいけません。

1. まず成功を実証します: 出力と、永続的な効果の両方です。時間制限があればガードを付け、完了を待ちます。
2. **別のプローブが必要かを判断します。** 時間制限があれば `bun DEADLINE_TOOL status DEADLINE_FILE` を実行します。
   期限切れ、または安全な次のプローブが残っていない場合は、探索を STOP してレポート(§4)を書きます。チェックポイントではありません。
   **プローブの前に公開します。** プローブ用ディレクトリに `exploration-NNN.json` を作成(browser)または作成して構成(functional)します。時間制限があれば期限ファイルの隣に置き、トップレベルのフィールドはちょうど 4 つです:
   observationCommand: 最後に完了したプローブの、ガードを含む完全な外側のコマンド。
   observed: そのデコード済みの子 JSON そのまま(ラッパーや余分なキーなし)、または JSON でない場合は全文。
   hypothesis: nextCommand の理由。nextCommand: 正確なコマンド/リクエスト。時間制限があればガード付き。
   安全なプログラム JSON のキーと値、ID のハッシュはすべてそのまま保持します。
   安全でない値は伏せ、制限を開示し、その連鎖を停止します。
   公開前にフィールドを確認します。下書きやプレースホルダー、創作した安全なパスの伏せ字は禁止です。公開済みのメモは訂正で修復できません。
   Functional: このファイルは書きません。次の capture が公開します: `bun EVIDENCE_TOOL capture PROBE_DIR NNN --deadline DEADLINE_FILE --after PREV --hypothesis 'why' -- CMD`(PREV: 直前に完了したキャプチャの ID)。observed は EVIDENCE_TOOL が供給します。転記してはいけません。
   Browser のチェックポイントは Write を使います。
   ディスパッチの前に、チェックポイントの公開が成功するのを待ちます。
   メモを後から埋めたり、上書きしたりしてはいけません。
3. その正確なプローブを実行します。時間制限があれば、DEADLINE_TOOL が期限を強制します。
   拒否されたものは not-run として報告し、初期状態/入力/結果を保持します。ステップ 2 から繰り返します。
4. 同じ初期フィクスチャの状態から、失敗した正確なコマンド/リクエストを、ステップ 2〜3(同じネイティブコマンド、新しいキャプチャ ID)でリプレイし、
   修復の前に確認します。その後、それらのゲートを通して最小化します。期限切れの場合、確認/最小化は未完了のままです。
   別の入力や回帰テストは、そのリプレイにはなりません。
5. ソース/コマンド/フィクスチャが変更された後は、再レビューし、影響を受ける再検証ごとにステップ 2 に戻ります(未証明=影響あり)。limits/メモは保持します。ステータスには新しい証拠が必要です。

## 3. Parent handoff(親への引き継ぎ)

- **/qa:** 検証済みの修復の前に、重大度、根本原因、Phase 8 の回帰ゲートは親が担います。
- **/review:** Fix-First の前に返します。test_stub の提案には ASK の承認が必要です。
- **Planning:** charter の提案のみ。実行はしません。

最小のネイティブテストを選びます: ロジックにはユニット、状態/リクエストには統合。E2E は、より小さいテストがジャーニーを捉えられない場合に限ります。自動的に両方を行うわけではありません。
モックにするのは無関係なサービスだけです。
バグのある出力を固定したり、テストを弱めたり、有効な red のテストを削除したりしてはいけません。

## 4. Final report(最終レポート)

面ごとのレポートテンプレートを使い、各チェックポイントにリンクします。browser のスコア、functional の結果、提案した/実行したテストを分けます。
PROBE_DIR/annotations.json {evidence: [{capture, command, contract, expected, classification}], limits: ["checkpoint 001"]} を書きます(limits: オブジェクトではなく、空でない文字列の配列。browser のみ: evidence []。)。Markdown の前に `bun EVIDENCE_TOOL materialize PROBE_DIR annotations.json`(observed/メタデータを埋め、reportLinks を出力し、PROBE_DIR ごとに 1 回だけ実行)を実行します。分類は自分で行います。失敗やリプレイを含め、安全なキャプチャはすべて注釈を付けます。省略したキャプチャは伏せられたものとして扱われ、判定は inconclusive のままです。入力の変更前に取ったキャプチャは `superseded` に分類します。同じコマンドを現在の入力で再実行すると、それは閉じられます。 修正後は、スナップショットを出力しないクライアントのものでも、それ以前のキャプチャはすべて superseded になります。判定が依拠する各キャプチャを再実行するか、未解決の残りとして報告します。 伏せた/不完全な証拠は開示します。
証拠は呼び出し単位でのものです。/ship は呼び出しごとに 1 回再実行します。
前提条件/期待/観測の欠落、タイムアウト、拒否は、決して pass になりません。
pass には、現在の入力に対する必要な契約がすべて pass し、必要な残りがないことが求められます。
必須の失敗があると /review は未完了のままで、/ship は、ユーザーが名指しされたそのリスクを明示的に受け入れない限りブロックされます。非対話の実行ではブロックを返します。非挙動の diff だけが not applicable(理由を記載)にできます。プロンプト/テンプレートは挙動に当たります。
