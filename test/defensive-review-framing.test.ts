import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { DEFENSIVE_REVIEW_FRAMING, FIXTURE_SUMMARY_MODE } from '../scripts/resolvers/defensive-review';
import { generateReviewArmy } from '../scripts/resolvers/review-army';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { expectAbsent, expectMentions, expectTokens } from './helpers/prompt-structure';

const ROOT = path.join(import.meta.dir, '..');
const FRAMING_SENTENCE = 'これは、メンテナー自身のリポジトリに対する';

function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const to = text.indexOf(end, from + start.length);
  expect(to).toBeGreaterThan(from);
  return text.slice(from, to);
}

describe('defensive-security framing reaches every adversarial dispatch', () => {
  expect(DEFENSIVE_REVIEW_FRAMING.startsWith(FRAMING_SENTENCE)).toBe(true);
  expectTokens(FIXTURE_SUMMARY_MODE, ["git diff --stat \"$DIFF_BASE\""], 'FIXTURE_SUMMARY_MODE');
  expectMentions(FIXTURE_SUMMARY_MODE, [['フィクスチャ', 'サマリーモード', 'レビュー']], 'FIXTURE_SUMMARY_MODE');

  for (const skill of ['review', 'ship']) {
    const army = fs.readFileSync(path.join(ROOT, skill, 'sections', 'review-army.md'), 'utf-8');
    const adversarial = fs.readFileSync(path.join(ROOT, skill, 'sections', 'adversarial.md'), 'utf-8');

    test(`${skill}: adversarial subagent keeps the framing and fixture summary mode`, () => {
      const prompt = between(adversarial, 'サブエージェントのプロンプト:', '攻撃者とカオスエンジニア');
      expect(prompt).toContain(DEFENSIVE_REVIEW_FRAMING);
      expect(prompt).toContain(FIXTURE_SUMMARY_MODE);
    });

    test(`${skill}: Red Team prompt starts from the framing and fixture summary mode`, () => {
      const redTeam = between(army, '### Red Team のディスパッチ', '障害モードに集中してください。"');
      expectMentions(redTeam, [['防御的なフレーミング', 'フィクスチャの扱い', '項目 4']], 'redTeam');
      expectMentions(redTeam, [['そのフィクスチャの扱いに従って']], 'redTeam');
      expect(redTeam).not.toMatch(/git diff "\$DIFF_BASE"`、抜けを探してください/);
    });

    test(`${skill}: only the security specialist gets the framing; testing reads fixtures in full`, () => {
      const dispatch = between(army, '### スペシャリストを並列にディスパッチする', '**編集の前に、リーダーの完了を待つ:**');
      const securityOnly = between(dispatch, '4. **防御的なフレーミング(Security スペシャリストと、後述の Red Team のみ)。**', '5. 指示:');
      expect(securityOnly).toContain(DEFENSIVE_REVIEW_FRAMING);
      expect(securityOnly).toContain(FIXTURE_SUMMARY_MODE);
      expectMentions(securityOnly, [['Testing', 'フィクスチャ', 'フルの diff']], 'securityOnly');
      const sharedInstructions = dispatch.slice(dispatch.indexOf('5. 指示:'));
      expect(sharedInstructions).not.toContain(FRAMING_SENTENCE);
      expectAbsent(sharedInstructions, ['サマリーモード'], 'sharedInstructions');
      expect(dispatch.split(FRAMING_SENTENCE)).toHaveLength(2);
    });
  }

  test('codex host still strips Review Army (specialists and Red Team)', () => {
    expect(generateReviewArmy({ skillName: 'review', tmplPath: '', host: 'codex', paths: HOST_PATHS.codex })).toBe('');
    expect(generateReviewArmy({ skillName: 'ship', tmplPath: '', host: 'codex', paths: HOST_PATHS.codex })).toBe('');
  });
});
