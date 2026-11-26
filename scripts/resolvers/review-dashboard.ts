/**
 * Review dashboard and plan-file review report resolvers.
 *
 * Moved from scripts/resolvers/review.ts.
 */
import { type TemplateContext } from './types';

export function generateReviewDashboard(ctx: TemplateContext): string {
  const result = `## Review Readiness Dashboard(レビュー準備状況のダッシュボード)

${ctx.skillName === 'ship' ? 'プリフライトでレビューログと設定を読み、準備状況を表示します。新しいランディング前レビューは Step 9 で実行します。' : 'レビューの完了後に、レビューログと設定を読み、ダッシュボードを表示します。'}

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-review-read
\`\`\`

**1. 表示するレコードを選びます。** 下の各行について、最新のレコードを使います。
7 日より古いレコードで行を CLEAR にしてはいけません。また、新しい失敗を古い成功で
置き換えてもいけません。Ship のメトリクスはレビューレコードではありません。

| 行 | 最新を選ぶ対象 | ステータスの接尾辞 |
|---|---|---|
| Eng Review | \`review\` or \`plan-eng-review\` | (DIFF) or (PLAN) |
| CEO Review | \`plan-ceo-review\` | — |
| Design Review | \`plan-design-review\` or \`design-review-lite\` | (FULL) or (LITE) |
| Adversarial | \`adversarial-review\` or legacy \`codex-review\` | — |
| Outside Voice | \`codex-plan-review\` from CEO or Eng review | — |

各レコードの host、source、outside_provider、outside_status、phase を保持してください。
過去の source "claude" はネイティブのサブエージェント、"claude-code" は外部 CLI です。
古いプロバイダーや不明なモデルを、現在のハーネスから推測してはいけません。ネイティブの結果で、
欠落している、無効化された、またはスキップされた外部カバレッジを埋めることはできません。

**出典の明示:** 記録された \`via\` を接尾辞に付けます("CLEAR (PLAN via
/autoplan)")。\`via\` がなければ "CLEAR (PLAN)" または "CLEAR (DIFF)" のままにします。ダッシュボードの下に、\`autoplan-voices\`
と \`design-outside-voices\` をワークフロー実行とフェーズごとにまとめます。各フェーズの
プロバイダーと outside_status を表示し、部分的なカバレッジも残してください。これらの詳細で Eng Review が CLEAR になることはありません。

**2. 判定を選ぶ前に、鮮度を確認します。**

- **内容優先のルール:** \`review\`、\`adversarial-review\`、\`codex-review\`、
  ship 段階のレビュー、\`design-review-lite\` では、\`review_freshness.status\`
  を使い、その \`reason\` を表示します。CURRENT とは、開始時と終了時の内容フィンガープリントが
  現在の \`---WTREE---\` フィンガープリントと一致する、完了したクリーンなレビューのことです。
  STALE または UNVERIFIED では Eng Review を CLEAR にできません。\`review_freshness\` がない場合は
  (ログのみの旧レコードを含む)UNVERIFIED です。差分の証拠について、HEAD の一致や
  コミット距離にフォールバックしてはいけません(コミット数が 0 でも同じです)。
  記録されたサイクル、completed/converged フィールド、欠落している source/phase の
  カバレッジを表示してください。カバレッジが不明な場合は合格ではありません。
- **プランレコード**(plan-ceo-review、plan-eng-review、plan-design-review、
  codex-plan-review)は、作業ツリーのフィンガープリントではなく 7 日間のウィンドウを使います。
  \`plan_sha256\` があれば、プランファイルと比較して不一致を報告してかまいません。
  記録されたコミットを \`---HEAD---\` と比較し、異なる場合は
  \`git rev-list --count STORED_COMMIT..HEAD\` を実行して、
  "Note: {skill} review from {date} may be stale — {N} commits since review" と報告します。
  コマンドが失敗した場合は UNKNOWN として、古いものとして扱います。コミットを追跡していない場合は、
  再実行を提案してください。すべてのレビューが最新なら、注記は省略します。

**3. 履歴上の判定を選びます。** CLEARED になるのは、選んだ Eng Review が
\`clean\` で、7 日以内で、ステップ 2 の鮮度を満たす場合だけです。それ以外は NOT CLEARED と報告し、
欠落、古さ、または未解決の課題という理由を添えます。${ctx.skillName === 'ship' ? ` Eng Review のレコードがない場合は、「保存済みの Eng Review がありません。読み取り専用の /plan-eng-review が出力した \`PERSIST:\` 行を実行するか、再実行してください」と伝えます(docs/troubleshooting.md#plan-eng-review-not-persisted)。` : ''} \`skip_eng_review\` が true の場合は、
Eng Review に "SKIPPED (global)" を、このダッシュボードに CLEARED を表示します。
${ctx.skillName === 'ship' ? 'この判定で Step 9 と、その指摘・承認・収束のゲートをスキップすることはありません。履歴が NOT CLEARED でも Step 1 を続行してください。' : 'Eng Review はデフォルトで必須です。`gstack-config set skip_eng_review true` でこの要件を無効にできます。'}

ほかの行は文脈を示すもので、Eng Review の代わりにはなりません:
- CEO Review を勧めるのは、プロダクトやビジネス、スコープに関する判断のときです。定型的な修正やクリーンアップでは勧めません。
- Design Review を勧めるのは、UI/UX の作業のときです。バックエンド、インフラ、プロンプトのみの作業では勧めません。
- Adversarial レビューには、必ずネイティブのパスが含まれます。利用可能で有効な外部の
  チャレンジはそれを補います。200 行以上の差分には、構造化された P1 ゲートも適用されます。
- Outside Voice は、CEO/Eng レビューの後にデフォルトで有効になるプランレビューです。\`codex_reviews\`
  でその追加ステップを無効にできます。プロバイダーが失敗した場合はネイティブにフォールバックし、
  外部カバレッジの欠落を記録します。このダッシュボードの行が出荷をブロックすることはありません。

**4. ダッシュボードを表示します。** 欠落、古い、無効化された、利用できない結果は、
CLEAR としてではなく、そのとおりに明示してください。最新の \`clean\` は CLEAR、
\`issues_open\` は ISSUES OPEN と表示し、保存されているステータスは変更しません。

${ctx.skillName === 'ship' ? `**REVIEW READINESS DASHBOARD**

ステップ 1 の各エントリにつき 1 行を使います。必須とするのは Eng Review だけです。

| Review | Runs | Last run | Status | Required |
|---|---:|---|---|---|
| {行と接尾辞} | {件数} | {タイムスタンプまたは —} | {実際のステータスと理由} | {yes/no} |

VERDICT: {CLEARED or NOT CLEARED} — {理由}` : `\`\`\`
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
\`\`\``}`;
  return ctx.skillName === 'plan-eng-review' ? result.replaceAll('\\`', '`') : result;
}

export function generatePlanFileReviewReport(ctx: TemplateContext): string {
  const beforeLog = ['plan-ceo-review', 'plan-eng-review', 'plan-design-review', 'plan-devex-review'].includes(ctx.skillName);
  const ceo = ctx.skillName === 'plan-ceo-review';
  const eng = ctx.skillName === 'plan-eng-review';
  const reviewFile = eng ? 'レポートファイル' : 'プランファイル';
  const conditionalWrites = ceo || ctx.skillName === 'plan-eng-review';
  const storagePolicy = ceo ? 'Step 0 storage policy' : 'Review record and write policy';
  const result = `## Plan File Review Report(プランファイルのレビューレポート)

${beforeLog ? (conditionalWrites ? (eng ? 'Required outputs の準備が整ったら、作業中のプランと完全なレビュー本文を、下の最終レポートとともに保存します。**Review record and write policy** を適用してください。' : `完了を告げる前に、${storagePolicy} に従って、承認済みの完全なプランと、このレポートを含むレビュー出力を作成してください。`) : 'ログの記録や完了の通知の前に、承認済みのプラン変更と、下のレポートを含むレビュー出力の全体を保存してください。') : `Review Readiness Dashboard を会話の出力に表示したあと、**プランファイル**そのものも
更新して、プランを読む人にレビューの状況が見えるようにします。`}

### ${ctx.skillName === 'plan-eng-review' ? '選択済みのレポートファイルを使う' : 'プランファイルを検出する'}

${ctx.skillName === 'plan-eng-review' ? '**Review record and write policy** で既に選択されたレポートファイルを使います。ここで別の保存先を選んではいけません。' : beforeLog ? `明示的に指定された出力/レポートファイルを最優先で使います。なければ、ユーザーが示したレビュー対象のプラン、次にホストのアクティブなプランを使います。${conditionalWrites ? `${storagePolicy} を適用してください。書き込みが許可されたファイルがない場合は、レビュー済みの完全なプランとレポートをチャットで作成し、not persisted と明記します。レポートの生成を省略してはいけません。` : '対象のファイルがなければ、このセクションはスキップします。ファイルのない通常のレビューのログ記録は、そのまま適用されます。'}` : `1. この会話にアクティブなプランファイルがあるか確認します(ホストはシステムメッセージでプランファイルの
   パスを提示します。会話の文脈にあるプランファイルへの参照を探してください)。
2. 見つからなければ、このセクションは黙ってスキップします。すべてのレビューがプランモードで実行されるわけではありません。`}

### レポートを生成する

${beforeLog ? `\`~/.claude/skills/gstack/bin/gstack-review-read\` を実行して、過去のレビューのエントリを取得します。
このレビューのステータスと指摘には、現在の ${conditionalWrites ? 'Completion Summary' : 'Completion Summary or DX Scorecard'} を使います。
下のレビューログのフィールド規則を適用し、過去の実行回数にちょうど 1 を加えてください。
レポートを埋めるために、この実行を事前にログへ記録してはいけません。
ほかのレビューには過去のエントリを使い、そのステータス、出典、鮮度を保持します。` : `上の Review Readiness Dashboard のステップで既に得ているレビューログの出力を読みます。`}

各 JSONL エントリは、記録された来歴に従って解釈します。過去の source "claude" はネイティブの Claude サブエージェント、"claude-code" は外部 CLI です。過去の codex の識別子はそのまま保持し、古いレコードを現在のハーネスで付け替えてはいけません。モデルの識別が不明なものは不明のままにします。新しいレコードでは、host、outside_provider、outside_status、phase を表示します。外部カバレッジを成立させるのは、完了した外部レコードだけです。ネイティブへのフォールバックは成立させません。

スキルごとに記録されるフィールドは異なります:

- **plan-ceo-review**: \\\`status\\\`, \\\`unresolved\\\`, \\\`critical_gaps\\\`, \\\`mode\\\`, \\\`scope_proposed\\\`, \\\`scope_accepted\\\`, \\\`scope_deferred\\\`, \\\`commit\\\`
  → Findings 列: "{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred"
  → scope 系のフィールドが 0 または欠けている場合(HOLD/REDUCTION モード): "mode: {mode}, {critical_gaps} critical gaps"
- **plan-eng-review**: \\\`status\\\`, \\\`unresolved\\\`, \\\`critical_gaps\\\`, \\\`issues_found\\\`, \\\`mode\\\`, \\\`commit\\\`
  → Findings 列: "{issues_found} issues, {critical_gaps} critical gaps"
- **plan-design-review**: \\\`status\\\`, \\\`initial_score\\\`, \\\`overall_score\\\`, \\\`unresolved\\\`, \\\`decisions_made\\\`, \\\`commit\\\`
  → Findings 列: "score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions"
- **plan-devex-review**: \\\`status\\\`, \\\`initial_score\\\`, \\\`overall_score\\\`, \\\`product_type\\\`, \\\`tthw_current\\\`, \\\`tthw_target\\\`, \\\`mode\\\`, \\\`persona\\\`, \\\`competitive_tier\\\`, \\\`unresolved\\\`, \\\`commit\\\`
  → Findings 列: "score: {initial_score}/10 → {overall_score}/10, TTHW: {tthw_current} → {tthw_target}"
- **devex-review**: \\\`status\\\`, \\\`overall_score\\\`, \\\`product_type\\\`, \\\`tthw_measured\\\`, \\\`dimensions_tested\\\`, \\\`dimensions_inferred\\\`, \\\`boomerang\\\`, \\\`commit\\\`
  → Findings 列: "score: {overall_score}/10, TTHW: {tthw_measured}, {dimensions_tested} tested/{dimensions_inferred} inferred"
- **codex-review**: \\\`status\\\`, \\\`gate\\\`, \\\`findings\\\`, \\\`findings_fixed\\\`
  → Findings 列: "{findings} findings, {findings_fixed}/{findings} fixed"

${ceo ? `**Outside Review** には、この実行で完了したレビュアーの出力と、指摘の処理状況を使い、
"N findings; R resolved; U unresolved" と書きます。指摘がない場合は
"0 findings — completed review" と書きます。ネイティブへのフォールバックによる指摘は native と明記し、
外部カバレッジは利用不可のままにします。無効化または利用できなかった試行では、
実際の理由と "no completed external review" を書き、指摘が 0 件だと匂わせてはいけません。
過去の履歴に件数がない場合は "finding count not recorded" と書きます。各試行の
プロバイダーと結果は OUTSIDE COVERAGE に残します。

` : ''}${beforeLog ? (conditionalWrites ? '現在の行は、実際のこのレビューを表します。ログに記録されていない現在の実行には not persisted と記し、保存済みのダッシュボードのエントリとして提示してはいけません。' : '現在の行と、その後のログは、同じ保存済みレビューを表していなければなりません。') : `Findings 列に必要なフィールドは、すべて JSONL エントリに揃っています。
今完了したレビューについては、自分の Completion Summary のより詳しい内容を使ってかまいません。
過去のレビューについては、JSONL のフィールドをそのまま使います。必要なデータはすべて含まれています。`}

${conditionalWrites ? '`clean` は CLEAR、`issues_open` は ISSUES OPEN と表示し、鮮度と not-persisted のラベルは保持します。そのほかのステータスは、記録された意味のままにします。\n\n' : ''}次の Markdown の表を作成します:

\\\`\\\`\\\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \\\`/plan-ceo-review\\\` | Scope & strategy | {runs} | {status} | {findings} |
| Outside Review | {recorded provider and trigger} | Independent 2nd opinion | {runs} | {outside_status} | {findings} |
| Eng Review | \\\`/plan-eng-review\\\` | Architecture & tests (required) | {runs} | {status} | {findings} |
| Design Review | \\\`/plan-design-review\\\` | UI/UX gaps | {runs} | {status} | {findings} |
| DX Review | \\\`/plan-devex-review\\\` | Developer experience gaps | {runs} | {status} | {findings} |
\\\`\\\`\\\`

表の下に、次の行を追加します。**OUTSIDE COVERAGE** と **CROSS-MODEL** は条件付きです。
フェーズが実行された、無効化/スキップ/利用不可だった、または指摘がある場合は含めます。
該当するフェーズがまったくない場合に限り省略します。**VERDICT** は常に含めます:

- **OUTSIDE COVERAGE:** プロバイダー、フェーズ、完了状態、指摘。利用不可、無効化、スキップされたフェーズも含めます。別のフェーズから完了を推測してはいけません。
- **CROSS-MODEL:** ネイティブと、完了した外部レビューの両方がある場合のみ。記録されたプロバイダーと、判明しているモデルの識別に基づく重複の分析です。ハーネス名から別々のモデルファミリーだと推測してはいけません。
- **VERDICT:** CLEAR のレビューを列挙します(例: "CEO + ENG CLEARED — ready to implement")。
  Eng Review が CLEAR ではなく、グローバルにスキップもされていない場合は、"eng review required" を付け加えます。

${ceo ? `**未解決の決定事項のステータス(必須):** これはレポートの最後の内容で、
VERDICT の後に置きます。このレビューの未解決項目を、その台帳から数えます。過去のレビューについては、
スキルごとの最新で有効な行(ダッシュボードの 7 日間のウィンドウ)の \`unresolved\` を合計します。
二重に数えないよう、現在のスキルは除外します。

- どちらの件数も 0 なら、太字にしない \`NO UNRESOLVED DECISIONS\` の 1 行そのもので終えます。
- そうでなければ、太字のラベル \`**UNRESOLVED DECISIONS:**\`(新しい見出しにはしません)を使い、
  現在の未解決項目ごとに箇条書きを 1 つ付けます。過去の件数 N が正の場合は、現在の項目が
  なくても、最後の箇条書きとして \`- + N unresolved from prior reviews\` を追加します。
  最後の箇条書きが、空白を除く最後の行になります。別の件数の行や、末尾の文章を付け足してはいけません。このステータスを省略してはいけません。
` : `**未解決の決定事項のステータス(必須 — 省略不可。レポートの空白を除く最後の行)。**
VERDICT の後で、レポート(\\\`## GSTACK REVIEW REPORT\\\` 見出しの下の内容。
太字のラベルであり、新しい \\\`## \\\` 見出しにはしません。「空なら省略」の規則の対象外)を、
次のどちらか 1 つだけで終えます。太字にしない \\\`NO UNRESOLVED DECISIONS\\\` の 1 行そのもの
(太字にしたものは認められません)、または \\\`**UNRESOLVED DECISIONS:**\\\` のヘッダーと、未解決項目ごとに 1 つの箇条書きです
(最後の箇条書きが最終行。\\\`+ N unresolved from prior reviews\\\` を足すのは N > 0 のときだけ)。
二重に数えないための手順です。このレビューの未解決項目は文脈から列挙し、過去のレビューについては
現在のスキルの行を除外したうえで、スキルごとの最新で有効な行(ダッシュボードの 7 日間のウィンドウ)の
\\\`unresolved\\\` を合計します。両方が 0 のときだけ、定型の行を出力します。`}

### ${reviewFile}に書き込む

${beforeLog ? (conditionalWrites ? `${ceo ? '保存先が選択されていない' : 'レポートの保存先がない'}場合、または書き込みが禁止されている場合は、同じ完全な${eng ? '作業中のプラン' : 'プラン'}、レビュー出力、最終レポートをチャットで組み立て、not persisted と明記します。下のファイル書き込みのステップは実行せず、その Read-back ゲートを通過したと主張してもいけません。${ctx.skillName === 'plan-eng-review' ? ' そのうえで **Report-back outcome** を使います。' : ' Stage 3 のブロックされたチャットでの返却に従います。完了済みレビューのログとハンドオフはありません。'} それ以外の場合は、承認済みの変更だけを保存し、未解決の選択肢は保留のままにします:` : '**PLAN MODE EXCEPTION — ALWAYS RUN:** 承認済みの変更だけを適用した、レビュー済みの完全なプランとレポートを保存します。未解決の選択肢は保留のままにします。') : `**PLAN MODE EXCEPTION — ALWAYS RUN:** これはプランファイルへの書き込みです。プランファイルは、
プランモードで編集が許されている唯一のファイルです。プランファイルのレビューレポートは、
プランの最新状況の一部です。`}

レポートは常に${reviewFile}の最後のセクションでなければなりません。途中に置いてはいけません。
削除してから追記する、単一の手順を使います:

${beforeLog ? `1. 既存の${eng ? 'レポートファイル' : 'プラン/レポート'}があれば Read します。その内容を保持し、
   承認済みの変更だけを適用して、レビュー出力の全体を含めます。既存の
   \`## GSTACK REVIEW REPORT\` セクションを探します。` : `1. プランファイルを(Read ツールで)読み、現在の内容全体を確認します。読み取った
   出力の中から、ファイルのどこにあっても \\\`## GSTACK REVIEW REPORT\\\` 見出しを探します。`}
2. 見つかった場合は、Edit ツールで既存のセクション全体を削除します。\\\`## GSTACK REVIEW REPORT\\\` から、
   次の \\\`## \\\` 見出しまたはファイル末尾のうち先に来るほうまでを対象にし、
   空文字列に置き換えます。セクションが今どこにあっても同じです。途中にあるセクションの削除は
   特別な例外ではなく、意図した動作です。${ceo ? 'Edit が失敗した場合は、エラーを報告し、レビューログや決定事項のログ記録の前に停止します。' : `Edit が失敗した場合(たとえば同時編集で\n   内容が変わった場合)は、${reviewFile}を読み直して 1 回だけ再試行します。`}
${ceo ? `3. 更新後の完全なプランとレビュー本文を、新しい
   \`## GSTACK REVIEW REPORT\` をファイル末尾に置いて保存します:
   - 保存先のファイルが存在する場合は、ステップ 2 でレポートを削除したかどうかにかかわらず、
     今ここで Read します。この Read で得た末尾を使って Edit するか、完全なファイルを Write します。
   - 保存先のファイルが存在しない場合は、Write で完全なファイルを作成します。
   どちらの場合も、レポートを最後に置いたまま、Read-back ゲートに進みます。` : `3. レポートを削除した場合は、更新後のファイルを Read します。新しい
   \\\`## GSTACK REVIEW REPORT\\\` をファイル末尾に追記します。直近の Read で確認した末尾に
   合わせて Edit するか、レポートを最後に置いた完全なファイルを Write します。${beforeLog ? ' 以前のレポートがあったかどうかにかかわらず、追記します。' : ''}
   後ろにほかのセクションが続く場合、"Unresolved Decisions" はファイル末尾の目印ではありません。`}
${beforeLog ? `4. **Read-back gate:** 保存したファイルを Read します。承認済みの変更、レビュー出力の全体、現在のレビューの行、
   判定、最後の未解決の決定事項のステータスを確認し、
   \`## GSTACK REVIEW REPORT\` が最後のセクションであることを検証します。書き込みまたは検証に失敗した場合は、
   ${ctx.skillName === 'plan-eng-review' ? 'エラーを報告し、レビューログや決定事項のログ記録の前に **Blocked outcome** に従います。' : 'エラーを報告し、レビューログや決定事項のログ記録の前に停止します。'}` : `4. 続行する前に、Read ツールで、\\\`## GSTACK REVIEW REPORT\\\` がファイル内の最後の
   \\\`## \\\` 見出しであることを確認します。そうでなければ、ステップ
   2〜3 を 1 回繰り返します。`}

${ceo || ctx.skillName === 'plan-eng-review' ? 'セクションをその場で置き換えてはいけません。削除してから、新しいレポートをファイル末尾に追記します。' : `セクションをその場で置き換えてはいけません。削除してから、新しいレポートをファイル末尾に追記します。
そうすれば、レビューレポートが常にプランの最後のセクションになります。`}`;
  return conditionalWrites ? result.replaceAll('\\`', '`') : result;
}
