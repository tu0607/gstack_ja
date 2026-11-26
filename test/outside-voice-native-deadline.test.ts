import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { generateCodexPlanReview } from '../scripts/resolvers/outside-voice-steps';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { ALL_HOST_CONFIGS } from '../hosts';
import { RESULT_CODES } from '../lib/result-codes';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

// #3182: Claude Code 2.1.277 removed TaskOutput. The plan-review native
// fallback must bound its reviewer with primitives the host still has: a
// background timer whose exit re-invokes the parent, the background agent's
// completion notification, and TaskStop. These checks pin the generated
// instructions, not a model's compliance with them.

const ROOT = path.resolve(import.meta.dir, '..');
const SKILLS = ['plan-ceo-review', 'plan-eng-review', 'plan-devex-review'] as const;
const flat = (text: string) => text.replace(/\s+/g, ' ');

function bounded(content: string): string {
  return content.match(/\*\*Bounded outside-voice wait[\s\S]*?(?=\*\*(?:Integrate reviewer findings|Cross-model tension)\([^)]*\):\*\*)/)?.[0] ?? '';
}

function renders(): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const skill of SKILLS) {
    out.push([`${skill}/sections/review-sections.md`, fs.readFileSync(path.join(ROOT, skill, 'sections/review-sections.md'), 'utf8')]);
    for (const host of ALL_HOST_CONFIGS) {
      const ctx: TemplateContext = { host: host.name, skillName: skill, tmplPath: `${skill}/sections/review-sections.md.tmpl`, paths: HOST_PATHS[host.name] };
      out.push([`${host.name}:${skill}`, generateCodexPlanReview(ctx)]);
    }
  }
  return out;
}

describe('native outside-voice fallback without TaskOutput (#3182)', () => {
  test('no rendered plan-review section requires the removed TaskOutput tool', () => {
    for (const [name, content] of renders()) {
      const section = bounded(content);
      expect(section.length, name).toBeGreaterThan(0);
      expect(section, name).not.toContain('TaskOutput');
      expect(section, name).not.toContain('block: true');
    }
  });

  test('the deadline is a host timer started before dispatch, and TaskStop ends the loser', () => {
    for (const [name, section] of renders().map(([n, c]) => [n, bounded(c)] as const)) {
      const timer = section.indexOf('`command: "sleep 300"`');
      const dispatch = section.indexOf('`subagent_type: "Plan"`');
      expect(timer, name).toBeGreaterThan(0);
      expect(dispatch, name).toBeGreaterThan(timer);
      expect(section.slice(timer, dispatch), name).toContain('`run_in_background: true`');
      expectMentions(flat(section), [['タイマーの ID', 'TaskStop'], ['エージェントと同じ ID', 'TaskStop'], ['ターンを終了', '通知'],
        ['ポーリング', 'sleep', 'Read', 'してはいけません']], name);
    }
  });

  test('only the matching completed notification that beats the timer counts', () => {
    for (const [name, section] of renders().map(([n, c]) => [n, bounded(c)] as const)) {
      expectTokens(flat(section), ['`<task-notification>`', '`<task-id>`', '`<status>`', '`completed`',
        'is waiting on its own background work', '[Subagent hand-back]'], name);
      expectMentions(flat(section), [['タイマーより先', '<task-notification>'], ['ターン数の上限'], ['識別可能', '完全', 'レポート'],
        ['生のトランスクリプト', '却下'], ['遅れた結果', 'クレジット'], ['キャンセル', '未確認']], name);
      // A foreground run returns a report the host never bounded: no credit.
      expectMentions(flat(section), [['Agent がレポートを直接返した', '期限', '強制', 'クレジットなし']], name);
    }
  });

  test('the unavailable line names its cause and fix, in the output and the persisted row', () => {
    for (const [name, content] of renders()) {
      const unavailable = flat(content.slice(content.indexOf('**利用不可のパス:**')));
      expect(unavailable, name).toContain('Outside voice unavailable: <cause>. Fix: <fix>.');
      expectMentions(unavailable, [['Plan', '提供されていない'], ['TaskStop', '提供されていない'], ['バックグラウンドタスク', '利用できない'],
        ['5 分以内', 'レポート']], name);
      expect(unavailable, name).toContain('(OUTSIDE_VOICE_UNAVAILABLE)');
      expect(unavailable, name).toContain('`"unavailable_reason":"<cause>"`');
      if (name.startsWith('claude:')) expectMentions(unavailable, [['Claude Code 2.1.277', 'バックグラウンドタスク']], name);
    }
    expect(RESULT_CODES.OUTSIDE_VOICE_UNAVAILABLE.anchor).toBe('outside-voice-unavailable');
  });
});
