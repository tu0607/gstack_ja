import type { TemplateContext } from '../types';

/**
 * Steady-state STATUS-line rules only (token-reduction Phase 2). The upgrade
 * flow, feature discovery, and every one-time onboarding prompt moved into
 * bin/gstack-skill-start's instruction-emission layer — their text is emitted
 * at runtime only when the gate fires, wrapped in GSTACK_INSTRUCTION blocks
 * the fence prose scopes and the model follows.
 */
export function generateUpgradeCheck(ctx: TemplateContext): string {
  return `\`PROACTIVE\` が \`false\` の場合は、スキルの自動実行や提案(実行するかどうかの確認を含む)をしません。ユーザーが明示的に呼び出したスキルだけを実行します。

\`SKILL_PREFIX\` が \`"true"\` の場合は、\`/gstack-*\` 形式の名前で提案・実行します。ディスク上のパスは次のままです: \`${ctx.paths.skillRoot}/[skill-name]/SKILL.md\`.`;
}
