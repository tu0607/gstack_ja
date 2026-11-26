/**
 * /ship review fix loop stays in one invocation (#2391).
 *
 * The pre-landing review used to commit its fixes, STOP, and tell the user
 * to run /ship again — 5-10 manual invocations on a branch with a few
 * auto-fixable findings, violating the skill's fully-automated contract.
 * The rendered section must instruct a bounded in-invocation loop
 * (re-test, re-review, max 3 fix cycles) and must never terminate an
 * AUTO-FIX result with a rerun request.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { expectMentions } from './helpers/prompt-structure';

const ROOT = path.join(import.meta.dir, '..');

const RENDERED_SITES = [
  path.join(ROOT, 'ship', 'sections', 'review-army.md'),
  path.join(ROOT, 'test', 'fixtures', 'golden', 'claude-ship-SKILL.md'),
  path.join(ROOT, 'test', 'fixtures', 'golden', 'codex-ship-SKILL.md'),
  path.join(ROOT, 'test', 'fixtures', 'golden', 'factory-ship-SKILL.md'),
];

describe('/ship review fix loop (#2391)', () => {
  test('no rendered ship surface instructs a STOP-and-rerun after fixes', () => {
    // The pre-fix instruction: "then **STOP** and tell the user to run
    // `/ship` again". The fixed text mentions the phrase only inside a
    // NEVER-do-this prohibition, so match the imperative STOP shape.
    const rerunRequest = /\*\*STOP\*\*[^\n]*run `\/ship` again/;
    for (const file of RENDERED_SITES) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(rerunRequest.test(content)).toBe(false);
    }
  });

  test('rendered section instructs the bounded in-invocation loop', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship/SKILL.md'), 'utf-8').replace(/\s+/g, ' ');
    const review = fs.readFileSync(path.join(ROOT, 'ship/sections/review-army.md'), 'utf-8').replace(/\s+/g, ' ');
    expect(review).toContain('**上限未満で修正が適用された:** Step 5');
    expectMentions(content, [['再起動せず', 'この実行']], 'content');
    expectMentions(review, [['4 回目', '修正サイクル', '実行しないで']], 'review');
    // The loop re-runs tests AND the review, and only a converged pass continues.
    expectMentions(review, [['Step 10', '保留中', '影響を受ける']], 'review');
    expectMentions(review, [['繰り返し', 'checklist', 'REVIEW_START', '新しい']], 'review');
    expect(review).toContain('**このパスで編集がない:**');
    expectMentions(review, [['クリア', '後にのみ', 'Step 10']], 'review');
  });

  test('the non-convergence stop is a blocker report, not a rerun request', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship/sections/review-army.md'), 'utf-8');
    expect(content).toContain('(`CYCLES >= 3`):**');
    expectMentions(content, [['停止', '再発', '指摘事項', 'converged:false']], 'content');
  });
});
