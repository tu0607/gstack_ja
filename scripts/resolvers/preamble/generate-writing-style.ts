import type { TemplateContext } from '../types';

/**
 * Writing Style preamble section.
 *
 * v1.45.0.0 changes (T3):
 * - Jargon list is referenced by path, not inlined. The 80-term list was
 *   duplicated into every tier-2+ skill (~1.5-2 KB × 48 skills = ~80 KB
 *   across the corpus). The pointer asks the agent to Read the JSON on
 *   first jargon term encountered — one extra Read per session, but the
 *   per-corpus payload is ~30 bytes.
 * - When `ctx.explainLevel === 'terse'`, the entire section is replaced
 *   with a one-line pointer. Saves ~1.5 KB per tier-2+ skill in the
 *   opt-in terse build.
 */
export function generateWritingStyle(ctx: TemplateContext): string {
  if (ctx.explainLevel === 'terse') {
    return `## 文体\n\n簡潔モード(ビルド時): 専門用語の補足、成果ベースの言い換え、意思決定の影響による締めを省きます。結論から述べます。\n`;
  }

  const jargonPath = `${ctx.paths.skillRoot}/scripts/jargon-list.json`;

  return `## 文体(プリアンブルのエコーに \`EXPLAIN_LEVEL: terse\` が出た場合、またはユーザーの現在のメッセージが簡潔な出力や説明なしの出力を明示的に求めた場合は、このセクション全体を省略)

AskUserQuestion、ユーザーへの返信、指摘事項に適用します。AskUserQuestion の形式は構造を定めるもので、ここでは文章の質を定めます。

- 厳選した専門用語は、ユーザーがその語を貼り付けた場合でも、スキル呼び出しごとに初出時に補足します。
- 質問は成果の言葉で表現します。どんな痛みを避けられるか、どんな機能が使えるようになるか、ユーザー体験がどう変わるかを示します。
- 短い文、具体的な名詞、能動態を使います。
- 意思決定は、ユーザーへの影響(何が見えるか、何を待つか、何を失うか、何を得るか)で締めます。
- ユーザーのターンでの指定が優先されます。現在のメッセージが簡潔さ、説明なし、答えだけを求めている場合は、このセクションを省略します。
- 簡潔モード(EXPLAIN_LEVEL: terse): 補足なし、成果ベースの言い換えなし、より短い応答。

厳選した専門用語リストは \`${jargonPath}\` にあります。このセッションで最初に専門用語に出会ったときに、そのファイルを一度 Read し、\`terms\` 配列を正式なリストとして扱います。リストはリポジトリが管理しており、リリースごとに増えることがあります。
`;
}
