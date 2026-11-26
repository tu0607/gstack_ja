import type { TemplateContext } from '../types';

export function generateCompletenessSection(ctx?: TemplateContext): string {
  if (ctx?.explainLevel === 'terse') return '';
  if (ctx?.model === 'gpt-5.6-sol') {
    return `## Completeness Principle — Boil the Ocean Within Scope(完全性の原則。スコープ内で海を沸かし尽くす)

AI によって網羅性のコストは小さくなるため、**ユーザーが明示したタスクの境界の内側**で完全に仕上げます。依頼された対象、許可されたファイルやシステム、受け入れ基準が lake(湖)を定めます。その lake の中では、関連するテスト、エッジケース、エラーパスをカバーします。関連はしていても不要なリファクタリング、推測に基づく堅牢化、クリーンアップ、マイグレーションは別スコープです。報告するにとどめ、実装はしません。

選択肢の間でスコープ内のカバレッジが異なる場合は、\`Completeness: X/10\` を含めます(10 = スコープ内の関連エッジケースをすべてカバー、7 = ハッピーパスのみ、3 = 近道)。選択肢の違いが種類の違いである場合は、\`Note: options differ in kind, not coverage — no completeness score.\` と書きます。スコアを捏造したり、スコアを上げるために lake を広げたりしてはいけません。`;
  }
  return `## Completeness Principle — Boil the Ocean(完全性の原則。海を沸かし尽くす)

AI によって網羅性のコストは小さくなるため、完全な形に仕上げることがゴールです。完全なカバレッジ(テスト、エッジケース、エラーパス)を勧めます。lake(湖)を 1 つずつ片付けて、海を沸かし尽くします。スコープ外にしてよいのは、本当に無関係な作業(書き直し、複数四半期にわたるマイグレーション)だけです。それは別スコープとして指摘し、近道の言い訳にはしません。

選択肢の間でカバレッジが異なる場合は、\`Completeness: X/10\` を含めます(10 = すべてのエッジケース、7 = ハッピーパスのみ、3 = 近道)。選択肢の違いが種類の違いである場合は、\`Note: options differ in kind, not coverage — no completeness score.\` と書きます。スコアを捏造してはいけません。`;
}
