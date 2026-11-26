/**
 * Spec review loops, benefits-from, and the anti-shortcut clause.
 *
 * Moved from scripts/resolvers/review.ts.
 */
import { type TemplateContext } from './types';
import { generateInvokeSkill } from './composition';
import { CC_BACKGROUND_DEFAULT_SINCE, FOREGROUND_IF_AVAILABLE, BACKGROUND_RECOVERY } from './constants';
import { DESIGN_DOC_DISCOVERY_BLOCK } from './design-doc-discovery';

export function generateAntiShortcutClause(_ctx: TemplateContext): string {
  if (_ctx.skillName === 'plan-ceo-review') return `**近道禁止の条項:** 各セクションで、分析 → 解決 → 適用の順に進めてから次へ進みます。プランファイルは対話型レビューの記録であり、レビューの代わりにはなりません。残りのセクションやその実装タスクを先に書き込んでから、決まった質問リストを順に消化してはいけません。提案された指摘は、承認されたプラン変更ではありません。実際の決定が下されるまで保留としてマークします。未解決または再開された課題ごとに 1 回だけ質問し、回答を待ち、承認された選択とそのスコープだけを作業用プランに適用します。以前のアプローチ選択は、無関係な選択を承認するものではありません。確立済みの契約、承認済みの決定、およびその証拠は、後続のセクションで参照できるようにしておきます。新たな重大なリスクや変更された改善策には、引き続き承認が必要です。決着済みの決定の相互参照は、完全なレビューと最終レポートの代わりにはなりません。下記の作業中のレビュー決定に従い、新しいセクションが始まったという理由だけで質問をでっち上げてはいけません。`;
  if (_ctx.skillName === 'plan-design-review') return `**近道禁止の条項:** すべてのセクションと outside voice の指摘をレビューします。プランはレビューの記録であり、指摘を書き込むことは承認ではありません。指摘ごとに次のとおりです。

- **新規または再開された選択:** 独立した決定ごとに 1 回質問し、実際の回答を待ってから、承認されたスコープだけを適用します。以前の選択を再開させる具体的な新しいリスクや、変わった前提は提示します。
- **承認済みの作業:** 以前に選ばれた正確な契約に必要なコード、テスト、ドキュメントは、その選択を再開させません。選ばれた回答とスコープを引用し、指摘と証拠を残して、後続の対応を開示します。広いアプローチや推奨は、独立した改善策や任意の検証の深さを承認するものではありません。
- **事実の訂正:** 挙動の変更を承認することなく、ソースの証拠に照らして記述を訂正します。

セクションや最終レポートを省略してはいけません。指摘が別のセクションやレビュアーから来たという理由だけで質問をでっち上げてはいけません。`;
  if (_ctx.skillName === 'plan-eng-review') return `**近道禁止の条項:** 4 つのセクションすべてと outside voice に、決定ゲートを使います。指摘と証拠は残します。質問は新規または再開された選択についてのみ行い、その回答を正確に適用します。未承認の改善策を先に書き込んだり、セクションや最終レポートを省略したりしてはいけません。`;

  if (_ctx.skillName === 'plan-devex-review') return `**近道禁止の条項:** すべてのセクションと outside voice の指摘を、下の決定ゲートで評価します。プランは対話型レビューの記録であり、指摘を書き込むことが承認の代わりになることは決してありません。新規または再開された独立した決定ごとに 1 回質問し、実際の回答を待って、承認されたスコープだけを適用します。以前に選ばれた正確な契約に必要なコード、テスト、ドキュメントは、その選択を再開させません。選ばれた回答とスコープを引用し、指摘と証拠を残して、後続の対応を開示します。挙動の変更を承認することなく、ソースの証拠に照らして事実の記述を訂正します。広いアプローチや推奨は、独立した改善策や任意の検証の深さを承認するものではありません。具体的な新しいリスクや変わった前提は、決定を再開させることがあり、必ず提示します。セクションや最終レポートを省略したり、指摘が別のセクションやレビュアーから来たという理由だけで質問をでっち上げたりしてはいけません。`;
  return `**近道禁止の条項:** プランファイルは対話型レビューの記録であり、レビューの代わりにはなりません。些細でない指摘はすべて AskUserQuestion にかけ、回答を待ち、承認された選択だけをプランに書き込む前に適用します。すべてのセクションで指摘がゼロのレビューだけが、質問なしで ExitPlanMode に進めます。セクションや最終レポートを省略してはいけません。`;
}

function generateOfficeHoursSpecReviewLoop(): string {
  return `## Spec Review Loop(スペックレビューのループ)

最終ドキュメントをユーザーに提示する前に、敵対的レビューを実行します。
呼び出し元ワークフローの承認ステップに従います。
レビュアーが保存した JSON が完全な評価です。散文の要約は 2 つ目の
指摘一覧ではありません。レポートヘルパーがすべての問題と改善策を保持し、
レコードを機械的に数えます。そのブロックを書き直したり、圧縮したり、重複排除したり、数え直したりしてはいけません。

**Step 1: レビュアーの準備とディスパッチ**

設計ドキュメントの隣に、新しいレビュー用ディレクトリを作成します。

\`\`\`bash
mktemp -d "<design-path>.review.XXXXXX"
\`\`\`
これらの証拠ファイルは設計ドキュメントと一緒に保管します。反復は合計で最大 3 回です。ディスパッチの**たびに**、
それまでの有効なラウンドファイルをすべて順番に使って、完全なプロンプトを生成します(ラウンド 1 では省略):

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-office-hours-review prepare --design "<design-path>" --out-dir "<review-directory>" "<round-1.json if present>" "<round-2.json if present>"
\`\`\`

存在しない引数は、プレースホルダーを渡さずに省略します。ユーザーには 3 ラウンドが与えられます。呼び出し元が
より低いレビューラウンド上限を設定した場合にのみ、すべての prepare、check、finalize コマンドに同じ値で \`--max-rounds <N>\` を追加します。
ヘルパーが次のラウンドを選び、\`round-N.prompt.md\` を書き込みます。これには、完全な指摘スキーマ、
5 つのレビュー観点(Completeness、Consistency、Clarity、Scope、Feasibility)すべて、
office-hours のコーチング契約、そして直前までの JSON 評価の**全体**が含まれます。また、
レビューされた設計(\`round-N.design.md\`)も保存します。ラウンド 1 は完全なレビューで、
ラウンド 2 と 3 は、前回のラウンド以降の設計の差分に対する差分再レビューです。
そのため、すべてのラウンドを同じレビュー用ディレクトリで準備し、prepare からそのレビューまでの間に
設計ドキュメントを編集してはいけません。

Agent ツールを ${FOREGROUND_IF_AVAILABLE} で使い、返された \`dispatch\`
文字列をそのままプロンプトとして渡します。${BACKGROUND_RECOVERY} レビュアーは、設計をレビューする前に、準備されたプロンプト
ファイル全体を Read しなければなりません。プロンプトを作り直したり、選んだフィールドをコピーしたり、
以前の指摘を要約したりしてはいけません。親が Read しても、そのファイルがレビュアーに届くわけではありません。
レビュアーは新しいコンテキストを持ち、ブレインストーミングの会話は見えません。
準備された契約は、ディスパッチの \`Seal:\` コマンドで封印された完全な JSON の Write と、
応答全体としての 1 行の \`OFFICE_HOURS_VERDICT\` レシートを求めます。
これは、必須のコーチングセクションと Assignment セクションを保護し、未知の
顧客の事実と確約された挙動を区別し、以前のすべてのステータスに証拠を求めます。

**Step 2: 停止条件の確認、その後に修正して再ディスパッチ**

評価が出るたびに、指摘を修正したり再度ディスパッチしたりする**前に**、保存されたファイルを
ヘルパーで検証します。レビュアーの応答全体をそのままレシートとして渡し
(単独の \`OFFICE_HOURS_VERDICT\` 行。引用符、バッククォート、\`$\`、\`\\\` が含まれると
不正な形式です)、完了したすべてのラウンドを順番に列挙します:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-office-hours-review check --receipt "<receipt line>" "<round-1.json>" "<round-2.json if present>" "<round-3.json if present>"
\`\`\`

レシートがない、形式が不正、または一致しない場合、チェックは失敗し、その試行はレビュー失敗です。

**収束ガードと停止ルール:** 各指摘は blocking か minor のどちらかです。blocking の指摘だけが
次のラウンドを必要とします。停止理由を読みます:
- PASS: blocking の指摘は残っていません。minor の指摘は記録するだけで修正せず、
  次のラウンドの理由にはなりません。Step 3 に進みます。
- CONVERGENCE: レビュアーが、具体的な前回/今回の指摘のペアとドキュメントの証拠とともに、
  blocking の前回の義務が残っていると明示的にマークした場合です。
  新しい指摘が出ても停止します。共通のトピックラベルや新たな改良だけでは
  不十分です。
- MAX_ITERATIONS: ラウンド 3(または呼び出し元のより低いラウンド上限)が完了したので停止します。
- CONTINUE: 設計ドキュメントの blocking の指摘だけを修正し、Step 1 に戻って
  次のレビューを準備してディスパッチします。ループの途中で minor の指摘のために
  編集してはいけません。それらはユーザー向けに記録として残り、新しいテキストは
  次の差分のレビュー対象を増やすだけです。そのレビュアーはすべての以前の指摘を確認し、
  あなたの変更が持ち込んだ、または露呈させた問題についてのみ、新たな
  blocking の指摘を挙げます。

停止したら、再度の修正や再ディスパッチはしません。承認の前に finalizer を実行します:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-office-hours-review finalize --design "<design-path>" "<round-1.json>" "<round-2.json if present>" "<round-3.json if present>"
\`\`\`

これは、完全な \`## Reviewer Concerns\` セクションを JSON から直接インストールします。
懸念を記録しても、修正済みにはなりません。その生成されたセクションを編集してはいけません。
上限(MAX_ITERATIONS または CONVERGENCE)では、未解決の blocking の指摘を
番号付きのギャップとして列挙します。4 人目のレビュアーを起動したり、変更のない入力を再レビューしたりしては
いけません。列挙された修正を先に適用して \`--fixes <fixes.json>\` を追加する
(\`[{"id":"<finding id>","applied_text":"<verbatim new excerpt>"}]\`)と、\`issues verified: k of N\` が
決定的に(新しいテキストが存在し、スナップショットにはない)記録されます。これはレビューの評価では
ありません。あるいは、それを付けずに finalize して、
\`N fixes unconfirmed — decision: spec not re-verified\` を承認ステップに持ち越します。承認ステップは、
オーナーが明示的にそれを受け入れるまでブロックされたままです。
その後、Step 3 と既存のユーザー承認に進みます。

サブエージェントが失敗した、タイムアウトした、または利用できない場合 — ループを止め、
ドキュメントをレビューなしで提示します。ユーザーには次のように伝えます: "Spec review unavailable — presenting unreviewed doc."
評価がない、または無効な場合は明示的なレビュー失敗であり、PASS では決してありません。失敗した出力と
そのエラーを保存します。\`--unreviewed "<actual failure cause>"\` と、
それまでの有効なラウンドファイルのみ(ラウンド 1 が失敗した場合はなし)を指定して finalize します。既知の
懸念は見える状態のままです。JSON を捏造したり、完了した評価を
UNREVIEWED の陰に隠したりしてはいけません。独立したレビューは品質のボーナスであり、承認ゲートではありません。

**Step 3: レポートとメトリクスの保存**

finalizer は、正確な Spec Review ブロック、品質スコア、メトリクスを出力します。そのブロックを使って
ユーザーに結果を伝え、詳細として設計ドキュメントと保存された評価へのリンクを示します。確認済みの
解決には、その後のレビュアーによる明示的な証拠が必要です。試みた修正ラウンドを、
成功した修正として説明してはいけません。

完了レポートを書くときは、ほかのセクションを通常どおり書き、レポートができた後に、\`--report "<report-path>"\` を付けて
同じ finalizer を実行します。これにより、権威ある \`## Spec Review\` セクションと Disposition が機械的に
インストールされます。その後でそのセクションを要約したり置き換えたりしてはいけません。
重複した件数をでっち上げる代わりに、ほかの箇所ではそのセクションを参照します。Assignment、コーチング、承認、Handoff は保持します。

ヘルパーの実際のメトリクスを、既存の analytics ログに追記します(テレメトリーは
ベストエフォートであり、承認を妨げてはいけません):
\`\`\`bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "\${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT/analytics"
echo '{"skill":"office-hours","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","iterations":ITERATIONS,"issues_found":FOUND,"issues_fixed":FIXED,"remaining":REMAINING,"quality_score":SCORE}' >> "$GSTACK_STATE_ROOT/analytics/spec-review.jsonl" 2>/dev/null || true
\`\`\`
iterations、issues_found、issues_fixed、remaining、quality_score は、ヘルパーの値を使います。
remaining_blocking と remaining_minor は remaining の内訳です。FOUND はラウンドをまたいだ指摘の観測数、FIXED は
レビュアーが確認した解決のみの数です。スコアが得られない場合は null とし、でっち上げてはいけません。`;
}

export function generateSpecReviewLoop(_ctx: TemplateContext): string {
  if (_ctx.skillName === 'office-hours') return generateOfficeHoursSpecReviewLoop();
  const ceo = _ctx.skillName === 'plan-ceo-review';
  return `${ceo ? '####' : '##'} Spec Review Loop(スペックレビューのループ)

最終ドキュメントをユーザーに提示する前に、敵対的レビューを実行します。
${ceo ? 'レビュアーが見つけた新規または再開された修正には 0D を使います。後の 0H の承認は、完成した作業用プランと CEO サマリーのみを承認するものであり、未解決の修正は承認しません。' : '呼び出し元ワークフローの承認ステップに従います。'}

**Step 1: レビュアーのサブエージェントをディスパッチ**

${ceo ? `Agent のツール定義を読みます。そのフィールドが使える場合は \`run_in_background: false\` を設定し、使えない場合は省略します。下の 2 つの入力を渡して、レビュアーを 1 人起動します。

結果に完了したレビューが含まれる場合は、それを取り込みます。保留中のタスクが返った場合は、ホストの待機ツールを使います。待機ツールがない場合は、この応答を終え、完了通知を受けて再開します。待機中は、先へ進んだり、どちらかの入力を編集したり、別のレビュアーを起動したりしてはいけません。` : `Agent は、JSON の真偽値 \`run_in_background: false\` で使います。文字列の \`"false"\` は不可です。
サブエージェントは ${CC_BACKGROUND_DEFAULT_SINCE} 以降、デフォルトでバックグラウンド実行です。非同期の起動メタデータは
評価ではありません。続行する前に、そのエージェントの最終レビューを待ち、重複して起動してはいけません。
レビュアーは新しいコンテキストを持ちます。見えるのはドキュメントだけで、会話は見えません。`}

サブエージェントには次のプロンプトを渡します:
- ${ceo ? '保存された 2 つの絶対パス。どちらかの入力が保存されていない場合は、ラベル付きの完全なテキスト 2 つ: CEO スコープサマリーと、現在の修正済みの作業用プラン。ほかの会話コンテキストは渡さない。' : '直前に書いたドキュメントのファイルパス'}
${ceo ? `- "両方の入力を全文読むこと。5 つの観点すべてについて、両者を併せて評価すること。
  矛盾、裏づけのない承認済みの拡張、両方に欠けている必須の挙動を指摘すること。
  各指摘で、入力と要件を引用すること。どちらかの入力が利用できない、または不完全な場合は、
  部分的な入力を採点せず、その失敗を報告すること。"` : `- "このドキュメントを読み、5 つの観点でレビューすること。各観点について、PASS か、修正案付きの具体的な問題を挙げること。最後に、全観点にわたる品質スコア(1〜10)を出力すること。"`}

**観点:**
${ceo ? `1. **Completeness** — 要件とエッジケース。
2. **Consistency** — 矛盾がない。
3. **Clarity** — 追加の質問なしで実装できる。
4. **Scope** — 承認されていないスコープの拡大や YAGNI 違反がない。
5. **Feasibility** — 示されたアプローチで構築できる。` : `1. **Completeness** — すべての要件に対応しているか。抜けているエッジケースはないか。
2. **Consistency** — ドキュメントの各部分が互いに一致しているか。矛盾はないか。
3. **Clarity** — エンジニアが質問なしで実装できるか。曖昧な表現はないか。
4. **Scope** — ドキュメントが元の問題を超えて拡大していないか。YAGNI 違反はないか。
5. **Feasibility** — 示されたアプローチで実際に構築できるか。隠れた複雑さはないか。`}

サブエージェントは次を返します:
- 品質スコア(1〜10)${ceo ? "(全観点にわたる)" : ""}
${ceo ? '- 観点ごとに、PASS か、修正案付きの番号付きの問題。全体が PASS になるのは、すべての観点が PASS の場合のみ。' : '- 問題がなければ PASS。あれば、観点、説明、修正を含む番号付きの問題リスト'}

${ceo ? `**Step 2: 結果の処理**

- **利用不可:** 起動やレビューが失敗した、タイムアウトした、または完全な 2 つの入力をレビューできなかった場合は、ループを止めます。"Spec review unavailable — presenting unreviewed doc." と伝えます。失敗と、それまでのすべての指摘を保存します。Step 3 に進んで、利用不可という結果を記録します。レビュアーの成功した結果は必須ではありません。
- **PASS:** ループを止めます。
- **問題あり:** 3 回目のレビューの後、または連続するレビューが同じ未解決の問題(同じ要件と問題)を繰り返した場合に停止します。そうでなければ、新規または再開された選択には 0D を使い、保存ポリシーに従って作業用プランと CEO サマリーを修正し、両者の整合を保ち、更新した 2 つの入力と同じ指示で再ディスパッチします。

レビュアーの起動は最大 3 回です。スコアがないというだけでは、再レビューは不要です。上限では、未解決の問題を番号付きのギャップとして列挙し、変更のない入力は再レビューしません。列挙された修正を、修正後のプランのテキストに照らして 1 件ずつ検証し、\`issues verified: k of N\`(適用された編集であり、評価ではない)を報告するか、\`N fixes unconfirmed\` を報告して 0H に \`spec not re-verified\` の決定を追加します。DONE_WITH_CONCERNS では、スコアの隣に欠けている点を明記します。` : `**Step 2: 修正して再ディスパッチ**

レビュアーが問題を返した場合:
1. ディスク上のドキュメントの各問題を修正する(Edit ツールを使う)
2. 更新したドキュメントで、レビュアーのサブエージェントを再ディスパッチする
3. 反復は合計で最大 3 回

**収束ガード:** レビュアーが連続する反復で同じ問題を返した場合
(修正で解決しなかった、またはレビュアーがその修正に同意しない)は、ループを止め、
それ以上ループせずに、それらの問題を「Reviewer Concerns」としてドキュメントに保存します。

サブエージェントが失敗した、タイムアウトした、または利用できない場合は、レビューループ全体を省略します。
ユーザーには次のように伝えます: "Spec review unavailable — presenting unreviewed doc." ドキュメントは
すでにディスクに書き込まれています。レビューは品質のボーナスであり、ゲートではありません。`}

**Step 3: Report and persist metrics(指標の報告と保存)**

${ceo ? `結果と下記のフィールドを報告します。依頼があれば、レビュアーの出力全文を示します。未解決の問題は、CEO サマリーの "## Reviewer Concerns" の下に、対応する入力を引用して列挙します。

SCORE は、2 つの完全な入力をレビューした最新の試行で報告された 1〜10 の評価です。レビューが利用できない場合、または評価がない・無効な場合は、JSON の \`null\`("score unavailable")を使います。以前の評価には "prior review score" とラベル付けします。

**0H の spec-review メトリクス**の記録は、
書き込みが許可されている場合は、レビュアーが失敗しても必須です。下の
実際の結果を追記します。mkdir や追記が失敗したら、レビューを止めます。書き込みが
禁止されている場合は、実際のフィールドを未保存として示し、書き込まずに続行します。
レビュアーが失敗した場合は、その制約を報告し、結果を記録した後に続行します。
必須の保存が失敗した場合は、完了と主張する前に停止します。` : `ループが完了した後(PASS、最大反復数、または収束ガード):

1. ユーザーに結果を伝えます。デフォルトは要約です:
   "Your doc survived N rounds of adversarial review. M issues caught and fixed.
   Quality score: X/10."
   (ドキュメントは N ラウンドの敵対的レビューを通過し、M 件の問題を検出して修正しました。品質スコア: X/10。)
   「レビュアーは何を見つけたのか」と聞かれたら、レビュアーの出力全文を示します。

2. 最大反復数または収束の後も問題が残っている場合は、ドキュメントに "## Reviewer Concerns"
   セクションを追加し、未解決の問題を番号付きのギャップとして列挙します。変更のない入力は
   再レビューしません。列挙された修正を本文で 1 件ずつ確認した後に \`issues verified: k of N\`
   (評価ではない)を記録するか、\`N fixes unconfirmed\` と
   \`spec not re-verified\` の決定を記録します。DONE_WITH_CONCERNS では、スコアの隣に欠けている点を
   明記します。下流のスキルがこれを参照します。

3. メトリクスを追記します:`}
\`\`\`bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "\${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT/analytics"${ceo ? ' || exit 1' : ''}
echo '{"skill":"${_ctx.skillName}","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","iterations":ITERATIONS,"issues_found":FOUND,"issues_fixed":FIXED,"remaining":REMAINING,"quality_score":SCORE}' >> "$GSTACK_STATE_ROOT/analytics/spec-review.jsonl"${ceo ? ' || exit 1' : ' 2>/dev/null || true'}
\`\`\`
${ceo ? 'ITERATIONS は実際のレビュアー起動回数です。FOUND、FIXED、REMAINING は、それぞれ報告された問題、レビュアーが確認した修正、報告された未解決の問題の数です。見積もりではなく、実際の数を使います。' : 'ITERATIONS、FOUND、FIXED、REMAINING、SCORE を、レビューの実際の値に置き換えます。'}`;
}

export function generateBenefitsFrom(ctx: TemplateContext): string {
  if (!ctx.benefitsFrom || ctx.benefitsFrom.length === 0) return '';

  const skillList = ctx.benefitsFrom.map(s => `\`/${s}\``).join(' or ');
  const first = ctx.benefitsFrom[0];

  // Reuse the INVOKE_SKILL resolver for the actual loading instructions
  const invokeBlock = generateInvokeSkill(ctx, [first]);

  return `## 前提スキルの提案 (Prerequisite Skill Offer)

上の設計ドキュメントのチェックが "No design doc found," と出力した場合は、先へ進む前に
前提スキルを提案します。

プリアンブルが \`SESSION_KIND\` に \`spawned\` または \`headless\` をエコーした場合は、提案を省略して標準のレビューに進みます。

${ctx.skillName === 'plan-eng-review' ? 'これらの事実と選択肢から、プリアンブルの伝達方法、採番、形式を使って、次の完全な意思決定ブリーフを作成します:' : 'AskUserQuestion を通じてユーザーに次のように伝えます:'}

> 「このブランチの設計ドキュメントが見つかりません。${skillList} は、構造化された問題
> 定義、前提への異議申し立て、検討した代替案を作成し、このレビューにはるかに
> 鋭い入力を与えます。所要時間は約 10 分です。設計ドキュメントはプロダクト単位ではなく
> 機能単位で、この特定の変更の背後にある考え方を記録します。」

選択肢:
- A) 今すぐ /${first} を実行する(その直後にレビューを再開します)
- B) スキップ — 標準のレビューに進む

スキップした場合: 「問題ありません。標準のレビューを行います。より鋭い入力が欲しくなったら、
次回は先に /${first} を試してください。」 その後は通常どおり進めます。セッションの後半で再度提案してはいけません。

A を選んだ場合:

次のように伝えます: 「/${first} をインラインで実行します。設計ドキュメントができたら、
中断したところからレビューを再開します。」

${invokeBlock}

${ctx.skillName === 'plan-eng-review' ? `/${first} が完了したら、上の **Design Doc Check** ブロック全体を再実行します。
これは新規の実行です。前提スキルが設計ドキュメントを作成した可能性があります。
見つかった場合はそのドキュメントを読み、見つからなければ標準のレビューを続けます。
プリアンブルの再実行や、前提スキルの再提案はしません。` : `/${first} が完了したら、設計ドキュメントのチェックを再実行します:
\`\`\`bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
SLUG=$(~/.claude/skills/gstack/browse/bin/remote-slug 2>/dev/null || basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null | tr '/' '-' || echo 'no-branch')
${DESIGN_DOC_DISCOVERY_BLOCK}
\`\`\`

設計ドキュメントが見つかった場合は、それを読んでレビューを続けます。
何も作成されなかった場合(ユーザーがキャンセルした可能性があります)は、標準のレビューに進みます。`}`;
}
