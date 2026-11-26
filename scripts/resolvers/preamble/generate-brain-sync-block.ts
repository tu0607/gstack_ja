/**
 * Artifacts-sync interpretation rules (token-reduction Phase 1).
 *
 * The ~6.8KB of artifacts-sync bash this generator used to inline (gbrain
 * availability hints, remote-MCP detection via claude.json, restore hint,
 * daily pull, queue-depth status) now runs inside `bin/gstack-skill-start`
 * (invoked by the Preamble fence above) and reports through the same STATUS
 * lines it always emitted: the GBrain hint text and the `ARTIFACTS_SYNC:`
 * line. What remains here is the prose the model acts on. The one-time
 * privacy stop-gate moved behind its runtime gate in Phase 2: it now arrives
 * as a GSTACK_INSTRUCTION block from gstack-skill-start when consent is
 * actually pending; this generator only carries the interpretation prose.
 *
 * Skill-END sync is no longer a separate fence: `bin/gstack-skill-end`
 * (invoked by the Telemetry step) drains the queue before logging.
 */
import type { TemplateContext } from '../types';

export function generateBrainSyncBlock(ctx: TemplateContext): string {
  const isBrainHost = ctx.host === 'gbrain' || ctx.host === 'hermes';
  return `## Artifacts Sync (skill start)(アーティファクトの同期。スキル開始時)

スキル開始時に artifacts sync は実行済みです。GBrain のヒントテキスト(あれば)は、
Grep より \`gbrain\` を優先すべき場面を示します。\`ARTIFACTS_SYNC:\` は同期の状態を報告します
(\`off\`、\`mode=... | queue=N\`、\`remote-mode\`、または \`gstack-brain-restore\`
のヒント)。\`attention:\` 行があれば、その内容と挙げられたコマンドを 1 文でユーザーに伝え、続行します。

${isBrainHost ? `出力に \`ARTIFACTS_SYNC: artifacts repo detected\` が含まれる場合は、AskUserQuestion で \`gstack-brain-restore\` を提案します。含まれない場合は続行します。

` : ''}一度きりのプライバシー確認ゲートは、同意が未取得のときにスキル開始時の\`GSTACK_INSTRUCTION\` ブロックとして届きます。
指示のとおりに AskUserQuestion で発火させます。`;
}
