import {expect, test} from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {ALL_HOST_CONFIGS} from '../hosts';
import {HOST_PATHS, type TemplateContext} from '../scripts/resolvers/types';
import {generatePreamble} from '../scripts/resolvers/preamble';
import {generatePreambleBash} from '../scripts/resolvers/preamble/generate-preamble-bash';
import {generatePlanModeInfo} from '../scripts/resolvers/preamble/generate-completion-status';
import {generateDesignHardRules} from '../scripts/resolvers/design';
import {E2E_TOUCHFILES, LLM_JUDGE_TOUCHFILES, selectTests} from './helpers/touchfiles';
import { between, compact, expectMentions, expectTokens } from './helpers/prompt-structure';

const root = path.resolve(import.meta.dir, '..');
// plan-design-review announces in Japanese, plan-eng-review still carries the English line.
const announcements = ['スコープゲート: プランモード — Bを自動選択(<対象>をレビュー)', 'Scope gate: plan mode — auto-selected B (reviewing <target>).'];
const firstAnnouncement = (tmpl: string) => Math.min(...announcements.map(text => tmpl.indexOf(text)).filter(at => at >= 0));
const RESOLVE_GATE = '上のスコープゲートを解決してください';
// The design and eng entries word the parenthetical differently; both start at the Scope gate.
const START_AT_GATE = /Scope gate[^。\n]{0,60}?から始め/;
const START_AT_STEP0 = 'Step 0 から順に従います';
const section = fs.readFileSync(path.join(root, 'plan-design-review/sections/review-sections.md.tmpl'), 'utf8');
function context(skillName: string, host: typeof ALL_HOST_CONFIGS[number]): TemplateContext {
  return {skillName, tmplPath: `${skillName}/SKILL.md.tmpl`, host: host.name,
    paths: HOST_PATHS[host.name]!, preambleTier: 3, interactive: true};
}
function assertScopedEntry(preamble: string, planMode = true) {
  const command = preamble.indexOf('```bash');
  expect(command).toBeGreaterThan(0);
  const entry = preamble.slice(0, command);
  expect(entry).toContain('## Preamble (after scope gate)');
  expect(entry).toContain(RESOLVE_GATE);
  expectMentions(entry, [['ゲート', '質問', '回答を待ちます']], 'entry');
  expect(preamble).not.toContain('## Preamble (run first)');
  expect(preamble).not.toContain(START_AT_STEP0);
  if (!planMode) {
    expect(preamble).not.toContain('## Skill Invocation During Plan Mode');
    return;
  }
  expect(preamble).toMatch(START_AT_GATE);
}

test('Design and Eng resolve the existing gate at the first executable preamble in every host', () => {
  for (const host of ALL_HOST_CONFIGS) for (const skill of ['plan-design-review', 'plan-eng-review']) {
    const ctx = context(skill, host);
    assertScopedEntry(generatePreamble(ctx), host.capabilities.planMode);
    const tmpl = fs.readFileSync(path.join(root, `${skill}/SKILL.md.tmpl`), 'utf8');
    expect(firstAnnouncement(tmpl)).toBeLessThan(tmpl.indexOf('{{PREAMBLE}}'));
    expectMentions(tmpl.replace(/\*\*/g, ''), [['明示的に指定', 'その選択が優先されます']], 'tmpl');
    expectMentions(tmpl, [['プランモード', 'プランが存在しない', '質問']], 'tmpl');
  }
});

test('missing local checkpoint and competing Step 0 entry instructions fail the generation contract', () => {
  const text = generatePreamble(context('plan-design-review', ALL_HOST_CONFIGS[0]!));
  expect(() => assertScopedEntry(text.replace(RESOLVE_GATE, ''))).toThrow();
  expect(() => assertScopedEntry(text.replace('## Preamble (after scope gate)', '## Preamble (run first)'))).toThrow();
  expect(() => assertScopedEntry(text.replace(START_AT_GATE, `${START_AT_STEP0}; then the Scope gate`))).toThrow();
});

test('other skills keep their existing preamble entry and plan-mode starting point', () => {
  for (const host of ALL_HOST_CONFIGS) for (const skill of ['plan-ceo-review', 'plan-devex-review', 'ship', 'review']) {
    const ctx = context(skill, host);
    expect(generatePreambleBash(ctx).startsWith('## Preamble (run first)(プリアンブル。最初に実行)\n\n```bash')).toBe(true);
    if (host.capabilities.planMode) expect(generatePlanModeInfo(ctx)).toContain(START_AT_STEP0);
    else expect(generatePlanModeInfo(ctx)).toBe('');
    expect(generatePreambleBash(ctx)).not.toContain('以下のコマンドを実行する前に');
  }
});

test('hard rules remain inside the scored fourth pass without changing other skills heading levels', () => {
  const host = ALL_HOST_CONFIGS[0]!;
  const rules = generateDesignHardRules(context('plan-design-review', host));
  const rendered = section.replace('{{DESIGN_HARD_RULES}}', rules);
  const start = rendered.indexOf('### パス 4:');
  const end = rendered.indexOf('### パス 5:');
  const pass = rendered.slice(start, end);
  expect(pass.indexOf('**パス4の評価:**')).toBeLessThan(pass.indexOf('#### Design Hard Rules'));
  expect(pass.match(/^### /gm)).toHaveLength(1);
  expectMentions(pass, [['リトマス質問', '独立した数値評価ではありません']], 'pass');
  for (const skill of ['design-review', 'design-consultation', 'design-html']) {
    expect(generateDesignHardRules(context(skill, host)).startsWith('### Design Hard Rules\n')).toBe(true);
  }
});

test('the decision table preserves first approval, inherited approvals', () => {
  const cases = section.slice(section.indexOf('| 状況 |'), section.indexOf('{{LEARNINGS_SEARCH}}'));
  expect(cases).toContain('再度質問しない');
  expect(cases).toContain('必須の成果物にそのまま写す');
  expect(cases).toContain('新たな修正は承認しない');
  expectMentions(cases, [['個別の決定', '既にある']], 'cases');
  expect(cases).toContain('入力がそのギャップを指摘していても、また DESIGN.md が正確なトークンを指定していても');
  expect(cases).toContain('提案された修正は保留のままにする');
  expect(cases).toContain('新たなトレードオフ');
  expectMentions(section, [['次のステップ', 'いかなる修正も承認しません']], 'section');
  expectMentions(section, [['先に編集して後で質問', '決してしないでください']], 'section');
});

test('scoring and section dependencies are explicit while existing clean and pass thresholds remain', () => {
  expectMentions(section, [['個別の決定を得てから', '修正を適用します']], 'section');
  expect(section).toContain('パス7は採点しない決定事項の登録簿');
  expectMentions(section, [['読み返しの後', 'すべてのパスが 8 以上']], 'section');
  expectMentions(section, [['総合スコアが 8 以上', '未解決が 0 件', '"clean"']], 'section');
  expectMentions(section, [['DESIGN.md がない場合', 'トークンとコンポーネントの指定を評価']], 'section');
  expectMentions(section, [['整合していると仮定したりしないでください']], 'section');
  expect(section).toContain('`~/.claude/skills/gstack/plan-design-review/SKILL.md` を Read して');
  expectMentions(section, [['既存の結果を使い', 'やり直さないでください']], 'section');
  expectMentions(section, [['パス7の後', 'モックアップの更新', '完了サマリー']], 'section');
});

test('the design Completion Summary is its own section above the report', () => {
  const rendered = fs.readFileSync(path.join(root, 'plan-design-review/sections/review-sections.md'), 'utf8');
  const summary = compact(between(rendered, '### 完了サマリー', '**総合デザインスコア:**'));
  expect(summary).toContain('独立した `## Design Review Completion Summary` セクション');
  expectMentions(summary, [['終端', '`## GSTACK REVIEW REPORT`', '上に置き']], 'summary placement');
  expectMentions(summary, [['レポートの中には決して書かない'], ['削除して再生成']], 'summary placement');
  expect(compact(rendered)).toContain('次の \\`## \\` 見出しまたはファイル末尾のうち先に来るほう');
  const nextReviewRewrite = (plan: string) =>
    plan.replace(/^## GSTACK REVIEW REPORT\n[\s\S]*?(?=^## |(?![\s\S]))/m, '') + '## GSTACK REVIEW REPORT\n| Eng Review | CLEAR |\n';
  const report = '## GSTACK REVIEW REPORT\n| Design Review | ISSUES OPEN |\n';
  const box = 'Pass 1  (Info Arch)  | 4/10 → 8/10 after fixes\n';
  expect(nextReviewRewrite(`# Plan\n\n## Design Review Completion Summary\n${box}\n${report}`)).toContain(box);
  expect(nextReviewRewrite(`# Plan\n\n${report}\n### Completion Summary\n${box}`)).not.toContain(box);
});

test('the DX Scorecard is its own section above the report', () => {
  const rendered = fs.readFileSync(path.join(root, 'plan-devex-review/sections/review-sections.md'), 'utf8');
  const scorecard = compact(between(rendered, '### DXスコアカード', 'DX PLAN REVIEW'));
  expect(scorecard).toContain('独立した `## DX Review Scorecard` セクション');
  expectMentions(scorecard, [['終了', '`## GSTACK REVIEW REPORT`', '上に置いてください']], 'scorecard placement');
  expectMentions(scorecard, [['レポートの内側には決して書かないでください']], 'scorecard placement');
});

test('new regression and changed preamble sources select all Design and Eng owners', () => {
  for (const map of [E2E_TOUCHFILES, LLM_JUDGE_TOUCHFILES]) {
    const affected = selectTests(['plan-design-review/SKILL.md.tmpl', 'plan-eng-review/SKILL.md.tmpl'], map, []).selected;
    for (const source of ['scripts/resolvers/preamble/generate-preamble-bash.ts', 'scripts/resolvers/preamble/generate-completion-status.ts']) {
      const selected = selectTests([source], map, []).selected;
      for (const owner of affected) expect(selected).toContain(owner);
    }
  }
});

test('design-review captures code tokens before universal principles', () => {
  const skill = fs.readFileSync(path.join(root, 'design-review/SKILL.md'), 'utf8');
  const capture = between(skill, '**プロジェクトのデザインシステムを取得します:**', '## Phase 1');
  expectTokens(capture, ['`tailwind.config.*`', '`:root`'], 'design-system capture');
  expectMentions(compact(capture), [['デザインのドキュメントもコードのトークンもない', '場合にのみ', '一般的なデザインの原則']], 'design-system capture');
  const mockup = compact(between(skill, '### 8a.5.', '### 8b.'));
  expectMentions(mockup, [['ブリーフ', '取得したシステム', '再利用', '色', 'フォント']], 'target mockup');
  expectMentions(mockup, [['新しいパレット', '持ち込んではいけません']], 'target mockup');
});
