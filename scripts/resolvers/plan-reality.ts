/**
 * Plan reality rows (multi-agent wave D1, release promise P5).
 *
 * {{PLAN_REALITY_ROWS}} and its variants render lib/plan-reality.ts's one row
 * table into the plan-review skills and the autoplan phase files, so the rows a
 * review must carry, the `REALITY:` line a reviewer emits and the check a
 * parent runs never drift apart:
 *
 *   {{PLAN_REALITY_ROWS:eng}} / {{PLAN_REALITY_ROWS:ceo}}
 *       the operative block for an interactive plan review (tier 1 row ids, the
 *       bin that prints every applicable row, the line grammar, the miss rule)
 *   {{PLAN_REALITY_ROWS:deep}}
 *       the full table with each row's incident note, for the deep section
 *   {{PLAN_REALITY_ROWS:autoplan:<phase>}}
 *       one checklist item for an autoplan phase file
 *   {{PLAN_REALITY_ROWS:pregate}}
 *       the Pre-Gate rule: unattended a miss is `incomplete`, never a warning
 *   {{PLAN_REALITY_ROWS:summary}}
 *       the Completion Summary line
 *
 * The rows themselves are printed by `gstack-plan-reality rows` at run time so
 * the zero-headroom skills carry the contract, not eighteen rows of prose.
 */
import type { TemplateContext } from './types';
import { REALITY_LINE_SHAPE, REALITY_ROWS, TIER1_ROW_IDS, renderIncidentTable } from '../../lib/plan-reality';

const BIN = '~/.claude/skills/gstack/bin/gstack-plan-reality';

function phaseFor(ctx: TemplateContext, arg: string | undefined): string {
  if (arg && arg !== 'deep' && arg !== 'summary' && arg !== 'pregate' && arg !== 'autoplan') return arg;
  const m = /^plan-(ceo|eng|devex|design)-review$/.exec(ctx.skillName);
  return m ? (m[1] === 'devex' ? 'dx' : m[1]) : 'eng';
}

export function generatePlanRealityRows(ctx: TemplateContext, args?: string[]): string {
  const mode = args?.[0];
  if (mode === 'deep') {
    return `### Reality rows(各行が存在する理由)

各行は、それを生んだインシデントに紐づいています。そのチェック内容は
\`${BIN} rows --phase <p> --deep\` が出力するものです。Tier 1 の行はすべてのレビューで必須で、\`n/a\` にはできません。Tier 2 の行は、検出されたスコープがそのスコープ(\`--scope\`)を挙げている場合にのみ必須です。

${renderIncidentTable(REALITY_ROWS)}`;
  }
  if (mode === 'summary') return `- Reality rows: ___/___ 件の該当行を出力済み(\`PLAN_REALITY\` 行)、未検証の前提 ___ 件`;
  if (mode === 'pregate') {
    return `Reality rows: 各フェーズの \`PLAN_REALITY: … verdict=complete\` を
\`${BIN} check --phase <ceo|eng> <review-file|->\` から取得します。該当行が欠けている場合、無人実行では
警告ではなく \`incomplete\` です。対話実行では上記の修復ルールに従います。`;
  }
  if (mode === 'autoplan') {
    return `Reality rows: 読み込んだスキルの \`REALITY:\` 行(該当行ごとに 1 行)。
   フェーズを閉じる前に \`${BIN} check --phase ${args?.[1] ?? 'ceo'} --plan <reviewed snapshot> <review-file|->\` が \`PLAN_REALITY: … verdict=complete\` を出力します
   (無人実行では \`incomplete\` のままフェーズは閉じません)。`;
  }
  const phase = phaseFor(ctx, mode);
  return `**Reality rows(必須):** \`${BIN} rows --phase ${phase}\` を実行し、その
行を順に処理します(tier 1 は常に対象で \`n/a\` 不可: ${TIER1_ROW_IDS.join(', ')}。tier 2 は検出されたスコープに応じ、\`--scope <csv>\`)。
すべての行は file:line の証跡を引用します(リンクされた issue がない場合、deferred-asks は \`pass\`)。前提テーブルは \`unverified=<n>\` を数えます。最後に
行ごとに 1 行、\`${REALITY_LINE_SHAPE}\` を出力し、続けて
\`${BIN} check --phase ${phase} <review-file|->\` を実行します。行が欠けている場合、無人実行では \`incomplete\` です。
対話実行では 2 回修復を試み、それでも欠けていればゲートで警告します。`;
}
