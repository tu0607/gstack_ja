import type { TemplateContext } from '../types';

export function generateConfusionProtocol(ctx?: TemplateContext): string {
  if (ctx?.explainLevel === 'terse') return '';
  return `## Confusion Protocol(混乱時のプロトコル)

重大な曖昧さ(アーキテクチャ、データモデル、破壊的な範囲、不足している文脈)がある場合は、STOP してください。その曖昧さを一文で述べ、トレードオフ付きで 2〜3 個の選択肢を示して質問します。通常のコーディングや自明な変更には使いません。`;
}
