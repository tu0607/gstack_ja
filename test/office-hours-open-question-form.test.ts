/**
 * Q3 (#2719, PR #2729): in Conductor (or when AskUserQuestion fails) prose is
 * the only channel, and the prose fallback defined only the `D<N>` decision
 * brief. Office-hours' Phase 2A/2B diagnostic questions have no option set, so
 * the model dropped them. Office-hours now carries a `Q<N>` open-question form
 * and its diagnostic phases name it; other skills are unchanged.
 */
import { describe, expect, test } from 'bun:test';
import { generateAskUserFormat } from '../scripts/resolvers/preamble/generate-ask-user-format';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import * as fs from 'fs';
import * as path from 'path';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const ctx = (host: string, skillName: string): TemplateContext => ({ host, skillName, tmplPath: '', paths: HOST_PATHS[host] });

describe('Q3: open-question prose form', () => {
  for (const host of ['claude', 'codex']) {
    test(`${host}: office-hours defines the Q<N> form and routes free-text replies to it`, () => {
      const text = generateAskUserFormat(ctx(host, 'office-hours'));
      expectTokens(text, ['(`Q<N>`)**', "Q<N> — <question, verbatim>\nWhy I'm asking:", "Reply in your own words — I'll wait."], 'text');
      expectMentions(text, [['自由記述の返信', '未回答', 'Q<N>'], ['個別の選択肢', 'D<N>', '常に']], 'text');
    });

    test(`${host}: other skills keep only the D<N> brief`, () => {
      expect(generateAskUserFormat(ctx(host, 'review'))).not.toContain('Q<N>');
    });
  }

  test('the Phase 2A and 2B diagnostic sections ask in Q<N> form when prose is the channel', () => {
    for (const file of ['office-hours/sections/phase-2a-startup-diagnostic.md.tmpl', 'office-hours/sections/phase-2b-builder-brainstorm.md.tmpl']) {
      expectMentions(fs.readFileSync(path.join(ROOT, file), 'utf8'), [['`D<N>`', '`Q<N>`', 'ではなく']], file);
    }
  });
});
