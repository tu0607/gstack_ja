import {expect, test} from 'bun:test';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ALL_HOST_CONFIGS} from '../hosts';
import {HOST_PATHS, type TemplateContext} from '../scripts/resolvers/types';
import {generatePreamble} from '../scripts/resolvers/preamble';
import {generateAskUserFormat} from '../scripts/resolvers/preamble/generate-ask-user-format';
import {generateGBrainContextLoad} from '../scripts/resolvers/gbrain';
import {readWorkflowJudgeInput} from './helpers/workflow-judge-input';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const template = fs.readFileSync(path.join(import.meta.dir, '../plan-eng-review/SKILL.md.tmpl'), 'utf8');
const scope = template.slice(template.indexOf('## スコープゲート'), template.indexOf('## 優先順位の階層'));
const announcement = 'スコープゲート: プランモード — Bを自動選択(<対象>をレビュー)';

const menuPrefix = 'A、B、C のいずれかで回答';

test('Eng resolves scope before either executable bootstrap placeholder', () => {
  const gate = template.indexOf('## スコープゲート');
  expect(gate).toBeGreaterThan(0);
  expect(template.indexOf(announcement)).toBeGreaterThan(gate);
  expect(template.indexOf(menuPrefix)).toBeGreaterThan(gate);
  for (const token of ['{{PREAMBLE}}', '{{GBRAIN_CONTEXT_LOAD}}']) {
    expect(template.split(token)).toHaveLength(2);
    expect(template.indexOf(announcement)).toBeLessThan(template.indexOf(token));
    expect(template.indexOf(menuPrefix)).toBeLessThan(template.indexOf(token));
  }
  expect(template.indexOf('{{PREAMBLE}}')).toBeLessThan(template.indexOf('{{GBRAIN_CONTEXT_LOAD}}'));
  expect(template.indexOf('{{GBRAIN_CONTEXT_LOAD}}')).toBeLessThan(template.indexOf('### Design Doc Check'));
});

test('every host expands its real bootstrap after the mandatory entry gate', () => {
  for (const host of ALL_HOST_CONFIGS) {
    const ctx: TemplateContext = {skillName: 'plan-eng-review', tmplPath: 'plan-eng-review/SKILL.md.tmpl',
      host: host.name, paths: HOST_PATHS[host.name]!, preambleTier: 3, interactive: true};
    const preamble = generatePreamble(ctx);
    const brain = host.suppressedResolvers?.includes('GBRAIN_CONTEXT_LOAD') ? '' : generateGBrainContextLoad(ctx);
    const expanded = template.replace('{{PREAMBLE}}', preamble).replace('{{GBRAIN_CONTEXT_LOAD}}', brain);
    expect(expanded.indexOf(announcement)).toBeLessThan(expanded.indexOf('## Preamble (after scope gate)'));
    expect(expanded.indexOf(menuPrefix)).toBeLessThan(expanded.indexOf('```bash'));
    expect(expanded.indexOf('```bash')).toBeLessThan(expanded.indexOf('gstack-skill-start', expanded.indexOf('```bash')));
    if (brain) expect(expanded.indexOf(announcement)).toBeLessThan(expanded.indexOf('## Brain Context Load'));
  }
});

test('entry binds a current target and delays bootstrap until scope resolves', () => {
  const flat = scope.replace(/\s+/g, ' ');
  expectMentions(flat, [['最初のツール呼び出し', 'AskUserQuestion']], 'flat');
  expect(scope.match(/\*\*起動シーケンス\*\*/g)).toHaveLength(1);
  const startup = scope.slice(scope.indexOf('**起動シーケンス**'), scope.indexOf('{{PREAMBLE}}'));
  const order = ['ターゲット選択の後', 'プリアンブル', 'Context Recovery', 'Brain Context',
    'Web リサーチの準備状況', 'Design Doc Check', 'Prerequisite Skill Offer', 'Review preparation'].map(step => startup.indexOf(step));
  expect(order.every(position => position >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(startup).toContain('**Engineering review → Step 0**');
  expect(startup).not.toContain('Read `sections/review-sections.md` in full');
  const entry = template.slice(template.indexOf('## エンジニアリングレビュー'), template.indexOf('## セクションの自己チェック'));
  expect(entry.split('{{SECTION:review-sections}}')).toHaveLength(2);
  expect(entry.indexOf('スコープが解決されている必要があります')).toBeLessThan(entry.indexOf('{{SECTION:review-sections}}'));
  expect(entry.indexOf('**複雑さのゲート:**')).toBeLessThan(entry.indexOf('{{SECTION:review-sections}}'));
});

test('plan selection exceptions and the unseeded stop remain explicit', () => {
  const flat = scope.replace(/\s+/g, ' ');
  expectMentions(flat, [['貼り付けられたドキュメント', 'ツールの結果', '合図にはなりません']], 'flat');
  expectMentions(flat, [['それでも曖昧', '質問']], 'flat');
  expectMentions(flat, [['明示的に指定した場合', '優先されます']], 'flat');
  expectMentions(flat, [['まだプランが存在しない', '通常どおり質問']], 'flat');
  expectMentions(flat, [['STOP', 'プレーンテキスト']], 'flat');
  expectMentions(flat, [['再送', 'しないでください']], 'flat');
  expect(scope).toMatch(/^A\) .+\nB\) .+\nC\) .+$/m);
  expect(scope).toContain(menuPrefix);
  expectMentions(flat, [['STOP', '回答', '待']], 'flat');
});

test('Eng alone defers canonical question rules until scope and keeps one counter across later stages', () => {
  for (const host of ALL_HOST_CONFIGS) {
    const ctx: TemplateContext = {skillName: 'plan-eng-review', tmplPath: 'plan-eng-review/SKILL.md.tmpl',
      host: host.name, paths: HOST_PATHS[host.name]!};
    const format = generateAskUserFormat(ctx);
    const exceptionLine = /^最初の Scope gate では.*$/gm;
    const continuousLine = /^D の採番: 最初の対象メニューは除きます。.*$/gm;
    expect(format.match(exceptionLine)).toHaveLength(1);
    expect(format.search(exceptionLine)).toBeLessThan(format.indexOf('STATUS 行に基づき'));
    expect(format.match(continuousLine)).toHaveLength(1);
    expectMentions(format.match(continuousLine)![0], [['D1'], ['段階の間', 'リセットしてはいけません']], 'continuous D-numbering');
    const ceo = generateAskUserFormat({...ctx, skillName: 'plan-ceo-review'});
    const standardLine = ceo.match(/^D の採番:.*$/m)![0];
    expect(format).not.toContain(standardLine);
    // Eng's bootstrap/counter and two local cross-references differ; the
    // complete STATUS, failure, consent and format rules stay byte-identical.
    expect(format).not.toContain('Spawned session ブロック');
    expect(format).toContain('(このルールに従います)');
    expect(format).toContain('Tool resolution の項目 1 に従います');
    expect(format.replace(/^最初の Scope gate では.*\n\n/m, '').replace(continuousLine, standardLine)
      .replace('(このルールに従います)', '(Spawned session ブロックに従います)')
      .replace('Tool resolution の項目 1 に従います', '**Spawned session** ブロックに従います'))
      .toBe(ceo);
    for (const skillName of ['plan-ceo-review', 'plan-design-review', 'plan-devex-review', 'office-hours']) {
      const other = generateAskUserFormat({...ctx, skillName});
      expect(other).toContain(standardLine);
      expect(other).not.toMatch(exceptionLine);
      expect(other).not.toMatch(continuousLine);
    }
  }
});
test('the full evaluated bundle routes startup into ordered preparation before scope analysis', () => {
  const input = readWorkflowJudgeInput({root:path.join(import.meta.dir, '..'), skillPath:'plan-eng-review/SKILL.md',
    startMarker:'# プランレビューモード', endMarker:null});
  expect(input.files.map(file=>file.kind)).toEqual(['entrypoint','section']);
  const entry = input.files[0]!.content, section = input.files[1]!.content;
  const startup = entry.slice(entry.indexOf('**起動シーケンス**'), entry.indexOf('## Preamble'));
  expect(startup).toMatch(/\*\*Review preparation\*\*.*\*\*Scope Challenge\*\*/);
  const preparation = section.slice(section.indexOf('## レビューの準備'));
  const stages = ['## Review record and write policy', '## Prior Learnings',
    '## 振り返りによる学習', '## Confidence Calibration', '## Decision procedure(決定の手順)',
    '## Scope Challenge', '## Review Sections'];
  const positions = stages.map(stage=>preparation.indexOf(stage));
  expect(positions.every(position=>position>=0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a,b)=>a-b));
  expect(entry.indexOf('**書式の優先順位:**')).toBeLessThan(entry.indexOf('## Preamble'));
  expect(entry.slice(entry.indexOf('## Plan Status Footer'))).not.toContain('**書式の優先順位:**');
  const requiredPath = '~/.claude/skills/gstack/plan-eng-review/sections/review-sections.md';
  expect(entry.slice(entry.indexOf('## エンジニアリングレビュー'),entry.indexOf('## セクションの自己チェック'))).toContain(`Read \`${requiredPath}\``);
  expect(entry.slice(entry.indexOf('## セクションの自己チェック'))).toContain(`\`${requiredPath}\``);
  const policy = section.slice(section.indexOf('## Review record and write policy'), section.indexOf('## Prior Learnings'));
  expectMentions(policy.replace(/\s+/g, ' '), [['パスの許可', '許可するものではありません']], 'policy');
  const qaRow = policy.split('\n').find(line => line.startsWith('| QA テスト計画とタスク JSONL |'))!;
  expectTokens(qaRow, ['**not persisted**'], 'QA row');
  const bestEffortRow = policy.split('\n').find(line => line.startsWith('| ベストエフォートのメタデータ/学習ログ |'))!;
  expectMentions(bestEffortRow, [['禁止', 'スキップ']], 'best-effort row');
  const finish = section.slice(section.indexOf('## Required outputs'), section.indexOf('### 出力リファレンス'));
  expectMentions(finish.replace(/\s+/g, ' '), [['必須のログが禁止', 'not persisted', 'Report-back outcome']], 'finish');
  const log = section.slice(section.indexOf('## レビューログ'), section.indexOf('## Next Steps'));
  expect(log).toContain("' || exit $?");
  expect(log).toContain("' 2>/dev/null || true");
});

test('both complexity paths join findings at the same thresholds', () => {
  const section = fs.readFileSync(path.join(import.meta.dir, '../plan-eng-review/sections/review-sections.md.tmpl'),'utf8');
  const challenge = section.slice(section.indexOf('## Scope Challenge'),section.indexOf('## Review Sections'));
  const stages = ['### A. ターゲットを評価する', '### B. 複雑さのセレクターを解決する', '### C. 指摘を解決する', '1. 番号付きの Scope Challenge の指摘'];
  const positions = stages.map(stage => challenge.indexOf(stage));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  const flat = challenge.replace(/\s+/g, ' ');
  expectMentions(flat, [['STOP', 'クラス/サービス', 'セクション 1']], 'flat');
  expectMentions(section.replace(/\s+/g, ' '), [['読めない', '検証できない', 'Recovery routing']], 'section');
});

test('calibration keeps its future hook but no shipped source enables the absent gate', () => {
  const root = path.join(import.meta.dir, '..');
  const section = fs.readFileSync(path.join(root, 'plan-eng-review/sections/review-sections.md.tmpl'),'utf8');
  expect(section.split('{{BRAIN_WRITE_BACK}}')).toHaveLength(2);
  expect(section.indexOf('{{LEARNINGS_LOG}}')).toBeLessThan(section.indexOf('**キャリブレーションのゲートの状態:**'));
  const note = section.slice(section.indexOf('**キャリブレーションのゲートの状態:**'),section.indexOf('{{BRAIN_WRITE_BACK}}'));
  expectMentions(note, [['自分で', '設定しないでください']], 'calibration note');
  const mentions: string[] = [];
  const tracked = execFileSync('git', ['ls-files', '-z', '--', 'bin', 'lib', 'scripts'], {cwd: root, encoding: 'utf8', timeout: 30_000})
    .split('\0').filter(Boolean);
  for (const rel of tracked) {
    const text = fs.readFileSync(path.join(root, rel), 'utf8');
    if (text.includes('BRAIN_CALIBRATION_WRITEBACK')) mentions.push(rel);
    expect(text, `${rel} must not set BRAIN_CALIBRATION_WRITEBACK`).not.toMatch(/BRAIN_CALIBRATION_WRITEBACK[=:]\s*\S|export BRAIN_CALIBRATION_WRITEBACK/);
  }
  expect(mentions).toEqual(['scripts/resolvers/gbrain.ts']);
});
