import type { TemplateContext } from '../types';

export function generateContextHealth(ctx?: TemplateContext): string {
  if (ctx?.explainLevel === 'terse') return '';
  return `## コンテキストの健全性(ソフトな指示)

長時間のスキルセッションでは、フェーズを終えたとき、または方針を変えるときに、完了したこと、次にやること、意外だった点を 1〜2 文でユーザーに伝えてください。

同じ診断、同じファイル、失敗した修正のバリエーションを繰り返しているなら、手を止めて見直してください。エスカレーションや /context-save を検討します。進捗サマリーが git の状態を変更してはいけません。`;
}

// Preamble Composition (tier → sections)
// ─────────────────────────────────────────────
// T1: core + upgrade + lake + telemetry + voice(trimmed) + completion
// T2: T1 + voice(full) + ask + completeness + context-recovery
// T3: T2 + repo-mode + search
// T4: (same as T3 — TEST_FAILURE_TRIAGE is a separate {{}} placeholder, not preamble)
//
// Skills by tier:
//   T1: browse, setup-cookies, benchmark
//   T2: investigate, cso, retro, doc-release, setup-deploy, canary, checkpoint, health
//   T3: autoplan, codex, design-consult, office-hours, ceo/design/eng-review
//   T4: ship, review, qa, qa-only, design-review, land-deploy
