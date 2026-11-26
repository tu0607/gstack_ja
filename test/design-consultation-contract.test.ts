import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ALL_HOST_CONFIGS } from '../hosts';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { generateDesignOutsideVoices, generateOverusedFonts, generateDesignShotgunLoop, generateTasteProfile, generateDesignMdCheck, generateDesignSetup } from '../scripts/resolvers/design';
import { generateBrowseFallback } from '../scripts/resolvers/browse';
import { generateAsideSetup, generateAsideResearch } from '../scripts/resolvers/aside';
import { outsideVoiceInvocation } from '../scripts/resolvers/outside-voice';
import { validateOutsideReview } from '../lib/outside-review-result';
import { expectAbsent, expectMentions, expectTokens } from './helpers/prompt-structure';

const context = (host: string, skillName = 'design-consultation'): TemplateContext => ({ host, skillName, tmplPath: `${skillName}/SKILL.md.tmpl`, paths: HOST_PATHS[host] });
for (const { name: host } of ALL_HOST_CONFIGS) {
  test(`${host}: proposal prompt requests the same completion marker that dispatch validates`, () => {
    const text = generateDesignOutsideVoices(context(host));
    const prompt = text.match(/"(このプロダクトの文脈を踏まえて、デザインの方向性を一式提案してください:[\s\S]*?)"\n/)!;
    expect(prompt).not.toBeNull();
    expect(prompt[1]).toContain('Recommendation: <direction> because <product-specific reason>');
    expect(validateOutsideReview('Recommendation: use a compact triage table because operators compare many incident rows.', 'proposal').completed).toBe(true);
    expect(validateOutsideReview('A compact table sounds nice.', 'review').completed).toBe(false);
    const preparation = outsideVoiceInvocation(context(host), { timeoutMs: 300000, purpose: 'design-direction' });
    expectMentions(preparation, [['Recommendation', 'マーカー', '欠落']], 'preparation');
    expect(preparation).not.toMatch(/severity|no.findings|clean\/PASS/i);
    expect(preparation.includes('ツール、git、パスへのアクセスがありません')).toBe(host === 'codex');
    expectTokens(preparation, ['実際のプラン/spec/ソース'], 'preparation');
    expect(text).toContain('outside_status="unavailable"');
    expectTokens(text, ['"none"'], 'text');
    expectTokens(text, ['| skipped | none | skipped |'], 'text');
    expectTokens(text, ['| clean or issues_found | in-host |'], 'text');
    expectMentions(text, [['<prepared-prompt-file>', 'シェルクォート済み', '絶対パス']], 'text');
    expectMentions(text, [['ここで方向性を選んではいけません']], 'text');
    expect(text).not.toContain('continuing with primary review');
    expect(text).not.toContain('[single-model]');
  });
}

test('creative wording leaves the review and scoring gates intact', () => {
  const ctx = context('codex');
  expectMentions(outsideVoiceInvocation(ctx, { timeoutMs: 300000 }), [['指摘なし', '根拠']], 'default gate');
  expectMentions(outsideVoiceInvocation(ctx, { timeoutMs: 300000, gate: 'structured' }), [['重大度', 'NO_FINDINGS']], 'structured gate');
  expect(outsideVoiceInvocation(ctx, { timeoutMs: 300000, gate: 'spec' })).toContain('SCORE: N');
});

test('preview paths retain verified fonts and select their own token source', () => {
  const section = readFileSync(new URL('../design-consultation/sections/proposal-and-preview.md.tmpl', import.meta.url), 'utf8');
  expectMentions(section, [['競合調査', 'フォントの検証', '免除']], 'section');
  expectMentions(section, [['検証できるまで', 'プレビュー', '延期']], 'section');
  expectMentions(section, [['パス B', '承認された HTML プレビュー', 'CSS の値'], ['$D extract', 'パス A だけ']], 'section');
  expect(section).not.toContain('## Approved Design Direction');
  expectMentions(section, [['承認されたモックアップ', 'Phase 6', '## Proposed DESIGN.md']], 'section');
  expectMentions(section, [['Q-final', '承認', '決まります']], 'section');
  expectMentions(section, [['書き込みを許可するのは A だけ'], ['DESIGN.md', '完全な内容', '準備'], ['CLAUDE.md', '指針', '示して']], 'section');
  expect(generateOverusedFonts(context('claude'))).toContain('font-verification fallback');
  expect(generateOverusedFonts(context('claude', 'design-shotgun'))).not.toContain('font-verification fallback');
  const loop = generateDesignShotgunLoop(context('claude'));
  expectMentions(loop, [['PID', '準備完了']], 'loop');
});


test('consultation drafts before independent dispatch and compares completed input at Q2', () => {
  const root = readFileSync(new URL('../design-consultation/SKILL.md.tmpl', import.meta.url), 'utf8');
  const section = readFileSync(new URL('../design-consultation/sections/proposal-and-preview.md.tmpl', import.meta.url), 'utf8');
  expect(root).not.toContain('{{DESIGN_OUTSIDE_VOICES}}');
  expect(root).not.toContain('### 独立した提案、そして統合');
  expect(root.indexOf('{{SECTION:proposal-and-preview}}')).toBeGreaterThan(root.indexOf('## Phase 2: 調査'));
  const ordered = ['### あなたのデザインの知識', '**フェイスの選び方', '{{OVERUSED_FONTS}}', '{{DESIGN_SLOP_BULLETS}}', '### 独立した提案、そして統合', '{{DESIGN_OUTSIDE_VOICES}}', '**AskUserQuestion Q2'];
  for (let i = 0; i < ordered.length; i++) {
    expect(section.indexOf(ordered[i])).toBeGreaterThan(i === 0 ? -1 : section.indexOf(ordered[i - 1]));
  }
  const question = section.slice(section.indexOf('**AskUserQuestion Q2'), section.indexOf('## Phase 4'));
  expect(question).toContain('completed/unavailable/skipped voices');
  expect(question).toContain('omit comparisons if none completed');
  expectMentions(section, [['一致', '投票', 'しないでください']], 'section');
  expectMentions(section, [['新しく提案されたフォント', '採用する前', '検証']], 'section');
  expectMentions(section, [['公式', 'Google Fonts/Fontshare'], ['古い提案', 'ラベル']], 'section');
});

test('consultation opt-in reads the stored consent, probes the CLI and rechecks its spawn', () => {
  const text = generateDesignOutsideVoices(context('claude'));
  const accepted = text.indexOf('**承認された場合:**');
  const availability = text.indexOf('**Codex の利用可否を確認する:**');
  const invocation = text.indexOf('1. **Codex デザインボイス**');
  expect(availability).toBeGreaterThan(accepted);
  expect(invocation).toBeGreaterThan(availability);
  const preflight = text.slice(availability, invocation);
  expect(preflight).not.toContain('_OUTSIDE_CFG=enabled');
  expect(preflight).toContain('get --stored codex_reviews');
  expect(preflight).toContain('CODEX_MODE: disabled');
  expect(preflight).toContain('CODEX_MODE: under_current_harness');
  expect(preflight).toContain('exit 78');
  expect(text.slice(invocation)).toContain('exit 78');
});

test('optional browser research has one unavailable branch and reuses its readiness probe', () => {
  const ctx = context('claude');
  const fallback = generateBrowseFallback(ctx);
  expectMentions(fallback, [['ビルド', '提案', 'しません']], 'fallback');
  expectAbsent(fallback, ['OK to proceed?', '進めてよいですか'], 'fallback');
  const qaFallback = generateBrowseFallback(context('claude', 'qa'));
  expectTokens(qaFallback, ['**Browser access decision**'], 'qaFallback');
  expectMentions(qaFallback, [['Cookie インポート', '権限']], 'qaFallback');
  expectAbsent(qaFallback, ['OK to proceed?', '進めてよいですか'], 'qaFallback');
  expectTokens(generateBrowseFallback(context('claude', 'browse')), ['進めてよいですか'], 'browse fallback');
  const root = readFileSync(new URL('../design-consultation/SKILL.md.tmpl', import.meta.url), 'utf8');
  expectMentions(root, [['ビルド', '提案', 'しないでください']], 'root');
  expectMentions(root, [['`sessions`', 'エントリ数']], 'root');
  const research = generateAsideResearch(ctx);
  expectMentions(research, [['Phase 0', 'BROWSER SETUP', '再利用']], 'research');
  expect((generateAsideSetup(ctx) + research).match(/console\.log\("ASIDE_READY /g)).toHaveLength(1);
  expectMentions(research.toLowerCase(), [['読み取り専用'], ['サインイン', '変更', '行いません']], 'research');
  expectMentions(research, [['サニタイズ', 'マシンの外']], 'research');
});

test('existing-system choices reach their matching final format without early writes', () => {
  const root = readFileSync(new URL('../design-consultation/SKILL.md.tmpl', import.meta.url), 'utf8');
  const section = readFileSync(new URL('../design-consultation/sections/proposal-and-preview.md.tmpl', import.meta.url), 'utf8');
  expectMentions(root, [['**キャンセル:**', 'スキルを停止'], ['**更新:**', 'Q1', '制約'], ['**最初から作り直す:**', '脇に置きます']], 'root');
  expectMentions(root, [['変換', 'Q-final', '待ちます']], 'root');
  const format = generateDesignMdCheck(context('claude'));
  expectTokens(format, ['`--write` なしの'], 'format');
  expectMentions(format, [['プランモード外', 'Q-final', '承認']], 'format');
  expectMentions(format, [['プランモード', 'Proposed DESIGN.md', '記録']], 'format');
  expectMentions(section, [['変換', '検証']], 'section');
  expectMentions(section, [['その後', '承認', '無効']], 'section');
  expectMentions(section, [['E)', 'プレビューをスキップ', 'Q-final']], 'section');
});

test.each(ALL_HOST_CONFIGS.map(({ name }) => name))('%s: only Update with DESIGN.md enters the entire format-check block', host => {
  const root = readFileSync(new URL('../design-consultation/SKILL.md.tmpl', import.meta.url), 'utf8');
  const format = generateDesignMdCheck(context(host));
  const gate = format.indexOf('**Update-only gate:**');
  const command = format.indexOf('```bash');
  const end = format.indexOf('**Update-only の書式チェックはここまで。**');
  expect(gate).toBeGreaterThan(-1);
  expect(command).toBeGreaterThan(gate);
  expect(end).toBeGreaterThan(format.indexOf('**A) Convert**'));
  expectMentions(format.slice(gate, command), [['**Update**', 'DESIGN.md', 'このブロックに入ります'], ['**Start fresh**', '**Gather product context from the codebase**'], ['**Cancel**', 'すでにスキルを停止']], 'update-only gate');
  expect(root.indexOf('**コードベースからプロダクトの文脈を集めます:**')).toBeGreaterThan(root.indexOf('{{DESIGN_MD_CHECK}}'));
  expectTokens(root, ['**キャンセル:**'], 'root');
  expect(generateDesignMdCheck(context(host, 'design-review'), ['calibrate'])).not.toContain('Update-only');
});

test('design command guidance carries session, extraction and quality-check side effects', () => {
  const setup = generateDesignSetup(context('claude'));
  const section = readFileSync(new URL('../design-consultation/sections/proposal-and-preview.md.tmpl', import.meta.url), 'utf8');
  expect(setup).toContain('$D extract --image /absolute/path.png');
  expectMentions(setup, [['DESIGN.md', '自動的に更新']], 'setup');
  expectMentions(setup, [['`variants`', '`paths`', 'セッションは作りません']], 'setup');
  expectMentions(section, [['`pass: false`', '再生成'], ['`pass: true`', 'チェックが欠けています']], 'section');
  expectMentions(section, [['非リポジトリ', '作業用ディレクトリ']], 'section');
  expectMentions(section, [['Unable to extract', 'フォールバック', '開示']], 'section');
  for (const command of (section + generateDesignShotgunLoop(context('claude'))).matchAll(/\$D iterate[^`\n]+/g)) {
    expect(command[0]).toContain('--session');
  }
});

test('board feedback distinguishes sessionless regeneration, final choice and missing input', () => {
  const loop = generateDesignShotgunLoop(context('claude'));
  const examples = [...loop.matchAll(/```json\n([\s\S]*?)```/g)].map(match => JSON.parse(match[1]));
  expect(examples.find(value => value.regenerated === false)).toMatchObject({ preferred: 'A' });
  expect(examples.find(value => value.regenerated === true)).toMatchObject({ regenerateAction: 'more_like_B' });
  expectMentions(loop, [['必須の `remixSpec`', '出力しません'], ['フィードバックファイル', 'アーカイブ']], 'loop');
  expectMentions(loop, [['ファイルがない', '承認', '推測']], 'loop');
});

test('taste context has defined count and bounded legacy and malformed-profile fallbacks', () => {
  const text = generateTasteProfile(context('claude'));
  expect(text).not.toContain('SESSION_COUNT');
  expect(text).not.toContain('head -200');
  expectMentions(text, [['保持されている', 'セッション', '生涯の合計ではありません']], 'text');
  expectMentions(text, [['不正な形式', '読み取れない', '従来のフォールバック']], 'text');
  const legacy = text.slice(text.indexOf('**Legacy fallback:**'), text.indexOf('**Conflict handling:**'));
  expect(legacy).toContain('$GSTACK_STATE_ROOT/projects/$SLUG/designs/');
  expect(legacy).toContain('approved.json');
  expect(legacy).not.toContain('~/.gstack');
  expectMentions(text, [['新しい 5 件', 'Read'], ['使えるファイルがない', 'テイストプロファイルなしで続行']], 'text');
  expectMentions(text, [['バリアント', 'フォント', '推測']], 'text');
  expectMentions(text, [['読み取り中', '書き直してはいけません']], 'text');
});

test('board fallback names the same launch command and does not poll a failed server', () => {
  const text = generateDesignShotgunLoop(context('claude'));
  expect(text).toContain('$D compare --images');
  expectMentions(text, [['終了コード', '準備完了']], 'text');
  expect(text).not.toContain('$D serve');
  expect(text).not.toContain('POLLING FALLBACK');
  expectTokens(text, ['`BOARD_URL`'], 'text');
  const fallback = text.slice(text.indexOf('**SERVER FALLBACK:**'), text.indexOf('**After receiving feedback'));
  expect(fallback).not.toContain('In that case');
  expect(fallback).not.toContain('means the daemon is serving');
});
