import type { TemplateContext } from '../types';

export function generateBrainHealthInstruction(ctx: TemplateContext): string {
  if (ctx.host !== 'gbrain' && ctx.host !== 'hermes') return '';
  return `\`BRAIN_HEALTH\` が表示され、スコアが 50 未満の場合は、失敗したチェック(出力に表示されます)をユーザーに伝え、次のように提案します。「詳細な診断には \\\`gbrain doctor\\\` を実行してください。」
出力が有効な JSON でない場合、または health_score がない場合は、GBrain を利用不可として扱い、このセッションでは brain 機能なしで進めます。`;
}
