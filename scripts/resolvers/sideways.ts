/**
 * Sideways review (multi-agent wave D2, shared with D3's flake recipe).
 *
 * A finding is a defect class, not a line: the same pattern usually sits at
 * another ingress, command or call site, and the severity is the worst
 * sibling's. These resolvers render that rule once:
 *
 *   {{SIDEWAYS_SWEEP}}          review Step 4: sweep + the forced-CRITICAL list
 *   {{SIDEWAYS_SWEEP:cso}}      /cso Phase 12: the sibling sweep only (D2: nothing else)
 *   {{FLAKE_FIX_NUMBER:review}} a test-only flake fix needs P(fail | regression) before and after
 *   {{FLAKE_FIX_NUMBER:investigate}}
 *                               the same number, as the flake recipe computes it
 *
 * `undeclaredBehaviorLines()` is the Scope Check addition the plan-completion
 * resolver (scripts/resolvers/plan-gates.ts, review mode) renders: diff
 * behavior the author's summary omits, and no approval without a recorded
 * full-diff read. The forced-CRITICAL classes are data so the review checklist
 * test and the rendered prose cannot drift (decision D8a: CRITICAL/INFORMATIONAL
 * stay the vocabulary; the list is what no lane may downgrade).
 */
import type { TemplateContext } from './types';

export const FORCED_CRITICAL = ['data loss', 'trust-boundary bypass', 'uncapped spend'] as const;

export function forcedCriticalPhrase(): string {
  return 'data loss, a trust-boundary bypass or uncapped spend';
}

export function generateSidewaysSweep(_ctx: TemplateContext, args?: string[]): string {
  if (args?.[0] === 'cso') {
    return '指摘を裏付けたら、そのパターンを対象範囲内の他のすべての ingress・コマンド・呼び出し箇所で grep します。重大度は最悪の兄弟箇所に合わせます。';
  }
  return `**Sideways sweep(すべての指摘が対象。diff の外のコードを読む):** 指摘のパターンを他のすべての ingress・コマンド・呼び出し箇所で grep し、一致箇所をそれぞれ Read して、最悪の兄弟箇所で重大度を評価します。新しい enum 値・ステータス・tier・型定数も、同じ方法ですべての利用箇所まで追跡します(checklist: Sideways sweep)。${forcedCriticalPhrase().replace(/^d/, 'D')} は強制的に CRITICAL です。どのレーン・スペシャリスト・重複排除・保存済みの判断でも格下げできません。指摘は変更されたコードに紐づけたままにします。`;
}

export function generateFlakeFixNumber(_ctx: TemplateContext, args?: string[]): string {
  if (args?.[0] === 'investigate') {
    return `**flake 修正の数値:** テストだけに触れる修正(タイムアウトの延長、リトライ、
アサーションの緩和、skip)は、変更の前後で \`P(fail | regression)\`、つまり
テストが守る挙動が退行したときにテストがなお失敗する確率を明記しなければなりません。
強制プローブ(意図的に挙動を壊し、テストを N 回実行して失敗を数える)から求め、
両方の数値を \`## Flake evidence\` に書きます。数値が下がる場合はゲートの
緩和(レビュータグ RH-15)にあたり、マージではなくオーナーの判断が必要です。`;
  }
  return `テストのみの flake 修正(タイムアウト、リトライ、アサーションの緩和、skip)は、強制プローブから得た修正前後の \`P(fail | regression)\` を明記します。両方の数値がなければ RH-15 です。`;
}

/** The Scope Check lines the review-mode plan-completion audit adds (D2). */
export function undeclaredBehaviorLines(): { fields: string; rule: string } {
  return {
    fields: `Diff read: full (<n> files, <m> hunks) | partial (<unread paths>)
Undeclared behavior changes: <PR 本文・コミットメッセージ・計画に記載のない、diff が変更する挙動> | none`,
    rule: `\`Diff read\` は Step 3 が求めた diff 全体の読み込みを記録します。\`Scope Check: CLEAN\` と上記の選択肢 B・C は、\`Diff read: full\` が記録されている場合にのみ承認として扱います。部分的な読み込みは、未読のパスを挙げた \`DRIFT DETECTED\` です。\`Undeclared behavior changes\` には、diff が変更する挙動(デフォルト値、終了コード、保存値、ルート、副作用)のうち、作者自身の要約に含まれないものをすべて挙げます。それぞれがレビュアー向けの Scope Check 項目であり、黙って CLEAN にしてはいけません。`,
  };
}
