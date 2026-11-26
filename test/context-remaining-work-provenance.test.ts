/**
 * Remaining Work provenance (#3004): prompt-byte contract for the shipped
 * context-save and context-restore SKILL.md files.
 *
 * The markers are a wire format between two skills: /context-save writes them
 * into a checkpoint and a later /context-restore sorts on them. Only that
 * contract is pinned (marker tokens, group headings, banner, option-A order),
 * not the surrounding prose. Behavior is covered by the periodic E2E case
 * context-restore-provenance-order.
 *
 * Value: protects=save writes the five provenance markers and restore sorts them into Next steps and Verify first; fails_when=a marker, a group or the saved-order option A is dropped; why_new=no test reads Remaining Work; seam=none
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
const MARKERS = ['(path run)', '(path read)', '(path assumed)', '(code read)', '(target state checked)'];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThanOrEqual(0);
  const to = text.indexOf(end, from + start.length);
  expect(to, `missing ${end} after ${start}`).toBeGreaterThan(from);
  return text.slice(from, to);
}

describe('Remaining Work provenance contract', () => {
  test('context-save marks every item Open. and defines all five markers, writing steps first', () => {
    const save = read('context-save/SKILL.md');
    const table = between(save, '**残りの作業の由来。**', 'ユーザーがタイトルを指定していれば');
    for (const marker of MARKERS) expect(table).toContain(`\`${marker}\``);
    expect(table).toContain('`Open.`');
    expect(table).toContain('`[done]`');
    // Rule 1 (writing steps) is checked before rule 2 (concrete paths).
    expect(table.indexOf('書き込みを伴う作業')).toBeLessThan(table.indexOf('具体的なパスを指している'));
    expect(table).toContain('**マーカーは英語のリテラルのまま使います。**');
    expect(table).toContain('**判断内容とファイルに関する主張。**');
    const format = between(save, '### Remaining Work', '### Notes');
    expect(format).toContain('`Open.`');
  });

  test('context-restore sorts into Next steps and Verify first and option A walks saved order', () => {
    const restore = read('context-restore/SKILL.md');
    expect(restore).not.toContain('{remaining work items}');
    const rules = between(restore, '**残りの作業を由来で分類してください。**', '選んだファイルを読み込み');
    const verifyFirst = between(rules, '**Verify first** に入れます', 'それ以外の項目はすべて');
    for (const marker of ['(path assumed)', '(code read)']) expect(verifyFirst).toContain(`\`${marker}\``);
    expect(verifyFirst).toContain('失敗を報告');
    expect(verifyFirst).toContain('マーカーがなく');
    expect(verifyFirst).toContain('翻訳済みまたは未知のマーカー');
    expect(restore).toContain('**ブランチで判別できない場合。**');
    const nextSteps = between(rules, '**Next steps** に入れます', '検証とは');
    for (const marker of ['(path run)', '(path read)', '(target state checked)']) expect(nextSteps).toContain(`\`${marker}\``);
    expect(rules).toMatch(/`[^`\n]*由来マーカー[^`\n]*Verify first[^`\n]*`/);
    const summary = between(restore, '### Remaining Work', '### Notes');
    expect(summary.indexOf('Next steps')).toBeLessThan(summary.indexOf('Verify first'));
    const optionA = between(restore, 'A の場合は、', '## 保存済みコンテキストが存在しない場合');
    expect(optionA).toContain('保存時の順序で最初の Remaining Work の項目');
    expect(optionA).toContain('Verify first の項目であれば');
  });
});
