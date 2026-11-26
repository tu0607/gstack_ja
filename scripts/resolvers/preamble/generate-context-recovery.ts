import type { TemplateContext } from '../types';

export function generateContextRecovery(ctx: TemplateContext): string {
  const binDir = ctx.paths.binDir; // env-var hosts already resolve to $GSTACK_BIN via types.ts

  // The listing lives in bin/gstack-context-recovery (#2763): worktree-isolated
  // Claude Code sessions refuse the eval and git-in-a-pipe forms the inline
  // fence used, but run one literal command. Branch-form discipline
  // (#2550/#1851) moved with it.
  return `## Context Recovery(コンテキストの復元)

セッション開始時、またはコンパクション後に、直近のプロジェクトコンテキストを復元します。

\`\`\`bash
${binDir}/gstack-context-recovery
\`\`\`

成果物が一覧に出た場合は、役立つ最新のものを読みます。\`LAST_SESSION\` または \`LATEST_CHECKPOINT\` が出た場合は、2 文でおかえりなさいの要約を伝えます。\`RECENT_PATTERN\` から次のスキルが明らかな場合は、一度だけ提案します。

**セッションをまたぐ意思決定。** 一覧に出た \`ACTIVE DECISIONS\` とその根拠を尊重し、黙って蒸し返さず、覆す予定がある場合は明示します。過去の意思決定に関する質問には \`${binDir}/gstack-decision-search\` を使います。あなたまたはユーザーが下した永続的な意思決定(アーキテクチャ、スコープ、ツールやベンダーの選択、決定の覆し。些細なものやターン単位の選択は除く)は \`${binDir}/gstack-decision-log\` で記録します(覆す場合は \`--supersede <id>\`)。確実でローカルに完結し、gbrain は不要です。`;
}
