/** Plan-approval handoff: recommend the runtime-resolved implementation model, never switch to it. */
import { toShellPath, type TemplateContext } from './types';

export function generateImplementationModelHandoff(ctx: TemplateContext): string {
  const provider = ctx.host === 'claude' ? ' --provider anthropic' : ctx.host === 'codex' ? ' --provider openai' : '';
  return `**実装モデル:** モデルとソースは次のコマンドの出力をそのまま伝えます: \`"${toShellPath(ctx.paths.binDir)}/gstack-models" resolve --role implementation${provider}\`${provider ? '' : ' (プロバイダごとに 1 つ)'}。gstack はこのセッションのモデルを変更できません。推奨のみ行い、依頼がない限り起動や設定の編集は行いません。エラー時はモデル名ではなく、その修復手順を伝えます。[ポリシー設定](https://github.com/garrytan/gstack/blob/main/docs/model-policy.md).`;
}
