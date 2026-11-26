import type { TemplateContext } from '../types';
import { getHostConfig } from '../../../hosts/index';

/**
 * Plan-mode-skill semantics block.
 *
 * Lives at the TOP of the preamble (position 1) so models read the authoritative
 * plan-mode rule before any other instructions. Replaces the vestigial
 * generate-plan-mode-handshake.ts that used to sit at this position and told
 * interactive review skills to emit an exit-and-rerun handshake instead of
 * running their interactive STOP-Ask workflow.
 *
 * Text is the same "Plan Mode Safe Operations" + "Skill Invocation During Plan
 * Mode" blocks that previously lived at the tail of generateCompletionStatus().
 * Only the position changes. All skills (not just interactive: true) see this.
 *
 * Composition position: index 1 in scripts/resolvers/preamble.ts — after
 * generatePreambleBash (so _SESSION_ID / _BRANCH / _TEL env vars exist before
 * any plan-mode-aware telemetry) and before generateUpgradeCheck + onboarding
 * gates. See ceo-plan 2026-04-24 "remove vestigial plan-mode handshake" for
 * the full rationale.
 *
 * Hosts whose capabilities declare planMode:false have no plan mode to be in,
 * so the section renders empty for them (#3168).
 */
export function generatePlanModeInfo(ctx: TemplateContext): string {
  if (!getHostConfig(ctx.host).capabilities.planMode) return '';
  if (ctx.planMode === false) return '';
  const entryOrder = ctx.skillName === 'plan-eng-review'
    ? 'Scope gate から始め、その Startup sequence に従います'
    : 'Scope gate(現在の対象の告知、または回答済みの質問)から始め、続いてプリアンブルと Step 0 に進みます';
  const invocation = ['plan-design-review', 'plan-eng-review'].includes(ctx.skillName)
    ? `呼び出されたスキルを、ホストのプランモードの制限内で実行します。**スキルファイルを実行します**(${entryOrder})。スキルの質問は有効です。スキル自身が解決する質問だけを省きます。AskUserQuestion のどの変種でもターン終了の要件を満たします。AskUserQuestion Format の Tool resolution を使います。利用不可または失敗した場合: \`headless\` → BLOCKED、\`interactive\` → 散文フォールバック(ターン終了の要件を満たす)。STOP では停止し、継続も ExitPlanMode もしません。"PLAN MODE EXCEPTION — ALWAYS RUN" と記されたコマンドは、ホストが許可する場合にのみ実行します。ExitPlanMode は、スキルの完了後、またはユーザーがスキルのキャンセルやプランモードの終了を指示した場合にのみ呼びます。`
    : `ユーザーがプランモードでスキルを呼び出した場合は、そのワークフローをホストのプランモードの制限内で実行します。**スキルファイルは参照資料ではなく、実行可能な指示として扱います。**Step 0 から順に従います。スキルが発する AskUserQuestion は、プランモード内でワークフローが動作しているのであって、違反ではありません。また、指示の中で質問を自ら解決するスキル(例: プランモードの自動選択)は、その質問をしなくてもかまいません。AskUserQuestion(\`mcp__*__AskUserQuestion\` でもネイティブでも、どの変種でも。"AskUserQuestion Format → Tool resolution" を参照)は、プランモードのターン終了の要件を満たします。AskUserQuestion が利用できない、または呼び出しが失敗した場合は、AskUserQuestion Format の failure fallback に従います: \`headless\` → BLOCKED、\`interactive\` → 散文フォールバック(これもターン終了の要件を満たす)。STOP ポイントでは直ちに停止します。そこでワークフローを続けたり、ExitPlanMode を呼んだりしてはいけません。"PLAN MODE EXCEPTION — ALWAYS RUN" と記されたコマンドは、ホストが許可する場合にのみ実行します。ExitPlanMode は、スキルのワークフローが完了した後、またはユーザーがスキルのキャンセルやプランモードの終了を指示した場合にのみ呼びます。`;
  return `## Plan Mode Safe Operations(プランモードで安全な操作)

ホストとシステムのプランモードの制限、およびユーザーの現在のスコープは、あらゆるスキルより優先されます。スキルが自分自身に読み取り専用モードの例外を与えることはできません。ホストが許可する場合、次はプランの材料になります: \`$B\`, \`$D\`, \`codex exec\`/\`codex review\`, temp prompts, writes to \`~/.gstack/\`, writes to the plan file, and \`open\` for generated artifacts。ホストがいずれかをブロックした場合は、それを省略し、その旨を伝えて、許可された作業を続けます。

## Skill Invocation During Plan Mode(プランモード中のスキル呼び出し)

${invocation}`;
}

export function generateCompletionStatus(ctx: TemplateContext): string {
  return `## Completion Status Protocol(完了ステータスのプロトコル)

スキルのワークフローを完了するときは、次のいずれかでステータスを報告します。
- **DONE** — 最終的に使用した入力に対して有効な証拠とともに完了。再利用したものと、独立して検証していないものを明示する。
- **DONE_WITH_CONCERNS** — 完了したが、懸念事項を列挙する。
- **BLOCKED** — 先へ進めない。障害と、試したことを述べる。
- **NEEDS_CONTEXT** — 情報が不足している。必要なものを正確に述べる。

3 回失敗した場合、セキュリティ上重要で確信が持てない変更、または検証できないスコープがある場合は、エスカレーションします。形式: \`STATUS\`, \`REASON\`, \`ATTEMPTED\`, \`RECOMMENDATION\`.

## Operational Self-Improvement(運用上の自己改善)

完了する前に、セッションを振り返って永続的な学びを洗い出し、1 件ずつ記録します。
この振り返りは、注目すべきことがあったと感じたときだけでなく、毎回行います。永続的な
学びとは、今後のセッションで 5 分以上の節約になる、プロジェクト固有の癖、コマンドの修正、
落とし穴、またはパターンです。振り返っても本当に何も出なかった場合は、完了サマリーに
"No durable learnings this session" と明記します。これは省略したステップではなく、
明示的な空の結果です。

\`\`\`bash
${ctx.paths.binDir}/gstack-learnings-log '{"skill":"SKILL_NAME","type":"operational","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"observed"}'
\`\`\`

自明な事実や、一時的な単発のエラーは記録しません。

## Telemetry (run last)(テレメトリー。最後に実行)

ワークフローの完了後、1 つのコマンドでテレメトリーを記録します。OUTCOME は
success/error/abort/unknown のいずれかです。\`SESSION_ID\` と \`TEL_START\` は、プリアンブルの
skill-start 出力がエコーした値です。このコマンドは artifacts-sync のキューも空にします
(従来の skill-end の同期ステップ。gstack-brain-sync を別途実行しないでください)。

**PLAN MODE EXCEPTION — ALWAYS RUN:** これは
\`$GSTACK_STATE_ROOT/analytics/\` にテレメトリーを書き込みます(プリアンブルの analytics の書き込みと同じです)。

\`\`\`bash
${ctx.paths.binDir}/gstack-skill-end --skill "${ctx.skillName}" --outcome OUTCOME \\
  --session-id "SESSION_ID" --tel-start "TEL_START" --used-browse USED_BROWSE \\
  --error-message "ERROR_MESSAGE" --failed-step "FAILED_STEP" 2>/dev/null || true
\`\`\`

実行前に \`OUTCOME\` と \`USED_BROWSE\`(yes/no)を置き換えます。\`SESSION_ID\`/\`TEL_START\` は
skill-start のエコーから代入します。\`ERROR_MESSAGE\`/\`FAILED_STEP\` は、outcome が error
でない限り "" です。コマンドが存在しない場合(古いインストール)は、テレメトリーを
省略します。ワークフローを妨げることはありません。

## Plan Status Footer(プランの状態のフッター)

プランレビューを実行するスキル(\`/plan-*-review\`、\`/codex review\`)は、スキルの末尾に EXIT PLAN MODE GATE のブロッキングチェックリストを含み、ExitPlanMode を呼ぶ前に、プランファイルが \`## GSTACK REVIEW REPORT\` で終わっていることを検証します。プランレビューを実行しないスキル(\`/ship\`、\`/qa\`、\`/review\` などの運用系スキル)は通常プランモードで動作せず、検証すべきレビューレポートもないため、このフッターは何もしません。${ctx.skillName === 'plan-eng-review' ? '選択されたレポートファイルを使い、すべての成果物について Review record と write policy に従います。' : 'プランファイルへの書き込みは、プランモードで許可される唯一の編集です。'}`;
}
