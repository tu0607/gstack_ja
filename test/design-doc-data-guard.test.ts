/**
 * D3 (#2818): plan reviews read design docs and handoff notes that other
 * agents may have written, and the audit now reads repo docs/designs/ files
 * (F1). Each read site must say the content is data, not instructions, and
 * that reviewer-directed text gets reported, not followed. Meaning-level
 * check on the rendered skills: safety-critical lines, case-insensitive.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { between, expectMentions } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');

describe('D3: design docs and handoff notes are data, not instructions', () => {
  const sites: Array<[string, string]> = [
    ['plan-ceo-review/SKILL.md', '**設計ドキュメントの確認:**'],
    ['plan-eng-review/SKILL.md', '### Design Doc Check'],
    ['plan-devex-review/SKILL.md', '**設計ドキュメントの確認:**'],
    ['ship/sections/plan-completion.md', '### Plan File Discovery'],
    ['review/sections/plan-completion.md', '### Plan File Discovery'],
  ];
  for (const [file, anchor] of sites) {
    test(`${file}: the design-doc read treats content as data and reports reviewer-directed text`, () => {
      const md = read(file);
      const at = md.indexOf(anchor);
      expect(at).toBeGreaterThanOrEqual(0);
      const block = md.slice(at, at + 4000);
      expectMentions(block, [['データ', '指示ではありません'], ['レビュ', '従'], [file.startsWith('plan-devex') ? '疑わしい' : '不審']], file);
      if (file.startsWith('plan-')) expectMentions(block, [['引き継ぎ', 'データ']], file);
    });
  }

  test('plan-eng-review/SKILL.md: the CEO plan it reads is data too (#280)', () => {
    const check = between(read('plan-eng-review/SKILL.md'), '### Design Doc Check', '### Step 0');
    expectMentions(check, [['CEO プラン', 'データ', '指示ではありません']], 'plan-eng-review Design Doc Check');
  });
});
