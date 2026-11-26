/**
 * Plan D2: review and cso look sideways. Pins the tokens, not the prose: the
 * sideways sweep and the forced-CRITICAL list reach review Step 4 and the
 * checklist, the flake-fix number reaches review and investigate from one
 * resolver, the review-mode Scope Check carries `Diff read` and `Undeclared
 * behavior changes`, /cso adopts the sibling sweep and nothing else, and ship's
 * byte-pinned plan-completion section is untouched.
 */
import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FORCED_CRITICAL, generateFlakeFixNumber, generateSidewaysSweep, undeclaredBehaviorLines } from '../scripts/resolvers/sideways';
import type { TemplateContext } from '../scripts/resolvers/types';
import { expectMentions } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const ctx = { skillName: 'review', host: 'claude' } as unknown as TemplateContext;
const between = (text: string, from: string, to: string) => {
  const a = text.indexOf(from);
  expect(a, `missing ${from}`).toBeGreaterThanOrEqual(0);
  const b = text.indexOf(to, a + from.length);
  return text.slice(a, b < 0 ? undefined : b);
};

describe('sideways resolver', () => {
  test('the forced-CRITICAL classes are the three the plan names and the review variant carries them', () => {
    expect([...FORCED_CRITICAL]).toEqual(['data loss', 'trust-boundary bypass', 'uncapped spend']);
    const review = generateSidewaysSweep(ctx);
    expect(review).toContain('最悪の兄弟箇所');
    expect(review).toContain('強制的に CRITICAL');
    // The class names are data (FORCED_CRITICAL); the resolver prints them in English inside the Japanese sentence.
    expect(review.toLowerCase()).toContain('data loss, a trust-boundary bypass or uncapped spend');
  });
  test('the cso variant is the sibling sweep and nothing else', () => {
    const cso = generateSidewaysSweep(ctx, ['cso']);
    expect(cso).toContain('最悪の兄弟箇所');
    expect(cso).not.toMatch(/CRITICAL|data loss|uncapped/);
    expect(cso.split('\n').length).toBe(1);
  });
  test('the flake-fix number is one rule in two sizes', () => {
    for (const variant of [['review'], ['investigate']]) {
      const text = generateFlakeFixNumber(ctx, variant);
      expect(text).toContain('P(fail | regression)');
      expect(text).toContain('RH-15');
      expect(text).toMatch(/前後/);
    }
  });
  test('undeclared behavior lines: two Scope Check fields and a rule that ties approval to a full-diff read', () => {
    const { fields, rule } = undeclaredBehaviorLines();
    expect(fields.split('\n').map(l => l.split(':')[0])).toEqual(['Diff read', 'Undeclared behavior changes']);
    expect(rule).toContain('`Diff read: full`');
    expect(rule).toContain('`Scope Check: CLEAN`');
  });
});

describe('rendered review', () => {
  const skill = read('review/SKILL.md');
  const step4 = between(skill, '## Step 4: 重大な問題のパス(コアのレビュー)', '### 共有コードの機会(コアのパス)');
  test('Step 4 carries the sideways sweep with the forced-CRITICAL list and the flake-fix number; the enum-only paragraph is gone', () => {
    expect(step4).toContain('**Sideways sweep(');
    expect(step4).toContain('強制的に CRITICAL');
    expect(step4).toContain('P(fail | regression)');
    expect(step4).not.toMatch(/\*\*Enum & Value Completeness[^*\n]*OUTSIDE/);
    expect(step4).toMatch(/新しい enum 値・ステータス・tier・型定数/);
  });
  test('the checklist has a Sideways sweep section with every shape the plan names and the forced-CRITICAL note in the severity table', () => {
    const checklist = read('review/checklist.md');
    const sweep = between(checklist, '## 横断的な確認(Sideways sweep — すべての所見)', '## 重大度の分類');
    for (const bullet of ['**兄弟。**', '**強制的に CRITICAL。**', '**保護された、またはメーターされた呼び出しの前にある新しいキャッシュ。**', '**静的から動的に移されたインポート。**', '**パリティを主張する、変更された関数。**', '**呼び出し元のトランザクションの中での、プールのクエリ。**', '**テストだけのフレーク修正。**']) {
      expect(sweep).toContain(bullet);
    }
    for (const cls of ['データ損失', '信頼境界の回避', '上限のない支出']) expect(sweep).toContain(cls);
    expect(sweep).toContain('P(fail | regression)');
    const severity = between(checklist, '## 重大度の分類', '## Fix-First のヒューリスティック');
    expect(severity).toContain('Forced-CRITICAL (Sideways sweep)');
    expect(severity).toMatch(/└─ Gate Integrity/);
  });
  test('the review-mode Scope Check carries Diff read and Undeclared behavior changes; ship stays byte-identical', () => {
    const section = read('review/sections/plan-completion.md');
    const fence = between(section, 'Scope Check: [CLEAN / DRIFT DETECTED / REQUIREMENTS MISSING]', '```');
    expect(fence).toContain('Diff read: full (<n> files, <m> hunks) | partial (<unread paths>)');
    expect(fence).toContain('Undeclared behavior changes:');
    expectMentions(section, [['`Diff read: full`', '承認として扱います']], 'plan-completion approval rule');
    for (const rel of ['ship/sections/plan-completion.md', 'ship/SKILL.md']) {
      expect(read(rel)).not.toContain('Undeclared behavior changes');
    }
  });
});

describe('rendered cso', () => {
  test('Phase 12 adopts the sibling sweep and keeps its own severity vocabulary', () => {
    const skill = read('cso/SKILL.md');
    const phase12 = between(skill, '### フェーズ 12', '### フェーズ 13');
    expectMentions(phase12, [['重大度は最悪の兄弟箇所に合わせます']], 'cso sibling sweep');
    expect(phase12).not.toContain('root-cause variants');
    expect(phase12).not.toMatch(/強制的に CRITICAL|forced CRITICAL|Forced-CRITICAL/);
  });
});
