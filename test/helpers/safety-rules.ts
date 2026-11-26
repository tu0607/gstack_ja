/**
 * Safety-rule registry (E3): each held safety rule, the stable anchor that
 * locates it in its source template or resolver, the paid eval that measures
 * it, and a SHA-256 of its normalized text. test/safety-rule-registry.test.ts
 * fails when an eval disappears while its rule remains, or when the rule text
 * changes without its hash being updated in the same rewording commit.
 *
 * The W1 evals use the same anchors to build their rule-removed arms, so the
 * registry and the evals always agree on which paragraph is "the rule".
 */
import { createHash } from 'node:crypto';

export interface SafetyRule {
  /** Short stable name used in messages. */
  id: string;
  /** E2E_TOUCHFILES / E2E_TIERS key of the eval that measures this rule. */
  evalId: string;
  /** Source template or resolver (repo-relative) that owns the rule text. */
  source: string;
  /** Heading line prefix that scopes the search (the rule's section). */
  section?: string;
  /** Case-insensitive meaning anchor: the first paragraph in the section that matches. */
  match: RegExp;
  /** SHA-256 of the normalized paragraph (collapsed whitespace, lowercased). */
  sha256: string;
}

export const SAFETY_RULES: readonly SafetyRule[] = [
  {
    id: 'codex-boundary',
    evalId: 'safety-codex-boundary',
    source: 'scripts/resolvers/outside-voice-steps.ts',
    match: /^const CODEX_BOUNDARY = /,
    sha256: 'd01521ffb350bb7bc1356f57c05e3dadce15f320133ecfc9ad7f078f9b9b3fdf',
  },
  {
    id: 'ship-fresh-evidence',
    evalId: 'safety-ship-stale-evidence',
    source: 'ship/SKILL.md.tmpl',
    section: '## Step 16: 検証ゲート',
    match: /完了を主張しない/,
    sha256: '03db371ed434c26f3763485696d5f7cbc7bd378d2c198b677c0eeaa512a36d2e',
  },
  {
    id: 'design-review-risk-stop',
    evalId: 'safety-design-risk-stop',
    source: 'design-review/SKILL.md.tmpl',
    section: '### 8f. 自己制御',
    match: /リスクが 20% を超える/,
    sha256: 'b6b65b1db83e2e7238229e0bbcc5186ce8312f1dafd2562f97f2360fad694a15',
  },
  {
    id: 'pair-agent-full-block',
    evalId: 'safety-pair-agent-block',
    source: 'pair-agent/SKILL.md.tmpl',
    match: /指示ブロック全体/,
    sha256: '71c271e04fcc5057cd030b6757dabc8895c1b09b78e236109b123712c3a4acc2',
  },
  {
    id: 'codex-consult-embed',
    evalId: 'safety-codex-consult-embed',
    source: 'codex/sections/consult-mode.md.tmpl',
    match: /内容を埋め込む/,
    sha256: '0077bb29626561f55171a5c7b6692cb10c20647481ec6eb5abc7f3fb272d98ac',
  },
  {
    id: 'ios-qa-demo-override',
    evalId: 'safety-ios-demo-ui-only',
    source: 'ios-qa/SKILL.md.tmpl',
    section: '## デモモード',
    match: /DEMO MODE はほかのすべてのルールより優先/i,
    sha256: 'e4fff80169fad7f4cb711ac6011f8fa01810f6be456addb19c515b0f417a4b0d',
  },
];

export function normalizeRuleText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

export function ruleHash(text: string): string {
  return createHash('sha256').update(normalizeRuleText(text)).digest('hex');
}

export interface LocatedRule {
  /** The rule paragraph exactly as it appears in `text`. */
  paragraph: string;
  start: number;
  end: number;
}

/**
 * Find the rule paragraph (contiguous non-blank lines) in `text`: the first
 * paragraph after the rule's section heading whose text matches its anchor.
 * Works on the source template and on every generated render.
 */
export function locateRule(text: string, rule: Pick<SafetyRule, 'id' | 'section' | 'match'>): LocatedRule | null {
  const lines = text.split('\n');
  let first = 0;
  let last = lines.length;
  if (rule.section) {
    const heading = lines.findIndex(line => line.startsWith(rule.section!));
    if (heading < 0) return null;
    const depth = rule.section.match(/^#*/)![0].length;
    first = heading + 1;
    const next = lines.findIndex((line, k) => k >= first && depth > 0 && /^#+ /.test(line) && line.match(/^#+/)![0].length <= depth);
    if (next >= 0) last = next;
  }
  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) { offsets.push(offset); offset += line.length + 1; }
  for (let i = first; i < last;) {
    if (!lines[i]!.trim()) { i++; continue; }
    let j = i;
    while (j < last && lines[j]!.trim()) j++;
    const paragraph = lines.slice(i, j).join('\n');
    if (rule.match.test(paragraph)) return { paragraph, start: offsets[i]!, end: offsets[i]! + paragraph.length };
    i = j;
  }
  return null;
}

/** The rule-removed arm: the same text with the rule paragraph deleted. */
export function removeRule(text: string, rule: Pick<SafetyRule, 'id' | 'section' | 'match'>): string {
  const hit = locateRule(text, rule);
  if (!hit) throw new Error(`safety rule ${rule.id}: anchor not found; cannot build the rule-removed arm`);
  return text.slice(0, hit.start) + text.slice(hit.end).replace(/^\n+/, '\n');
}

export function safetyRule(id: string): SafetyRule {
  const rule = SAFETY_RULES.find(r => r.id === id);
  if (!rule) throw new Error(`unknown safety rule ${id}`);
  return rule;
}

/** Which arm a W1 eval runs: the shipped rule, or the rule-removed control. */
export type SafetyArm = 'rule' | 'removed';

export function safetyArm(env: NodeJS.ProcessEnv = process.env): SafetyArm {
  const arm = env.GSTACK_SAFETY_ARM ?? 'rule';
  if (arm !== 'rule' && arm !== 'removed') throw new Error(`GSTACK_SAFETY_ARM must be rule or removed, got ${arm}`);
  return arm;
}

/** Apply the arm to a rendered fixture: unchanged for `rule`, rule paragraph deleted for `removed`. */
export function applyArm(text: string, rule: SafetyRule, arm: SafetyArm): string {
  if (!locateRule(text, rule)) throw new Error(`safety rule ${rule.id}: anchor not found in the rendered fixture`);
  return arm === 'rule' ? text : removeRule(text, rule);
}
