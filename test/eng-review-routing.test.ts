import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ALL_HOST_CONFIGS } from '../hosts';
import { generateBrainWriteBack } from '../scripts/resolvers/gbrain';
import { generateAskUserFormat } from '../scripts/resolvers/preamble/generate-ask-user-format';
import { generateTestCoverageAuditPlan, generateTestCoverageAuditShip } from '../scripts/resolvers/testing';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { generateReviewDashboard, generatePlanFileReviewReport } from '../scripts/resolvers/review-dashboard';
import { generateExitPlanModeGate } from '../scripts/resolvers/plan-gates';
import { ENG_REVIEW_EXCERPT } from './helpers/workflow-excerpt';
import { expectMentions, expectOrdered } from './helpers/prompt-structure';

const entry = readFileSync('plan-eng-review/SKILL.md.tmpl', 'utf8');
const section = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
const compact = (text: string) => text.replace(/\s+/g, ' ');

function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start);
  const to = text.indexOf(end, from + start.length);
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  return text.slice(from, to);
}

function ordered(text: string, stages: string[]) {
  const positions = stages.map(stage => text.indexOf(stage));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

const scope = section.split('## Scope Challenge(スコープチャレンジ)\n')[1]?.split('## Review Sections')[0] ?? '';
const assessment = scope.split('### A. ターゲットを評価する')[1]?.split('### B. 複雑さのセレクターを解決する')[0] ?? '';
const complexity = scope.split('### B. 複雑さのセレクターを解決する')[1]?.split('### C. 指摘を解決する')[0] ?? '';
const findings = scope.split('### C. 指摘を解決する')[1] ?? '';
const recovery = entry.split('## 回復ルーティング')[1]?.split('{{EXIT_PLAN_MODE_GATE}}')[0] ?? '';

describe('engineering review routing contracts', () => {
  test('the bounded engineering excerpt includes the recovery rules it references', () => {
    const excerpt = between(entry, ENG_REVIEW_EXCERPT.startMarker, ENG_REVIEW_EXCERPT.endMarker);
    ordered(excerpt, ['{{SECTION:review-sections}}', '## 回復ルーティング', '**保留中の質問:**',
      '**修復可能な書き込み/読み取りの失敗:**', '**後からの変更や作業の欠落:**', '**Blocked outcome:**']);
    expectMentions(compact(entry.slice(entry.indexOf(ENG_REVIEW_EXCERPT.endMarker))), [['回復ルーティング', '使って']], 'self-check');
  });

  test('preparation establishes permission and evidence before applying review rules', () => {
    ordered(section, ['## レビューの準備', '## Review record and write policy', '{{LEARNINGS_SEARCH}}',
      '## 振り返りによる学習', '{{CONFIDENCE_CALIBRATION}}', '## Decision procedure(決定の手順)',
      '## Scope Challenge', '### A. ターゲットを評価する', '### B. 複雑さのセレクターを解決する',
      '### C. 指摘を解決する', '### 1. アーキテクチャのレビュー']);
  });

  test('compression cannot remove mandatory review stages', () => {
    const priority = between(entry, '## 優先順位の階層', '## 私のエンジニアリングの好み');
    expectMentions(priority, [['短縮してよいのは', '任意のコメント']], 'priority');
    expect(priority).not.toContain('Everything else');
  });

  test('Scope Challenge has one named route and completes its assessments before writing', () => {
    expect([...scope.matchAll(/^### (.+)$/gm)].map(match => match[1])).toEqual([
      'A. ターゲットを評価する', 'B. 複雑さのセレクターを解決する', 'C. 指摘を解決する',
    ]);
    expect([...assessment.matchAll(/^- \*\*([^*]+)\*\*/gm)].map(match => match[1])).toEqual(expect.arrayContaining([
      '各サブ問題を既に解決しているものは何か?', '目的を達成する最小の変更は何か?',
      '複雑さのチェック:', '検索のチェック:', 'TODOS の相互参照:', '完全性のチェック:', '配布のチェック:',
    ]));
    expectMentions(compact(assessment), [['スコープの変更', '指摘', 'しないでください']], 'compact(assessment)');
    expect(scope).not.toContain('Below the threshold, start at step 1');
  });

  test('below-threshold route skips selectors, never findings or remedy approvals', () => {
    ordered(compact(findings), ['1. 番号付きの', '2. Decision procedure を通して', '3. それらの回答から',
      'セクション 1 に進みます']);
    expectMentions(findings, [['どの是正も', '承認しません']], 'findings');
    expect(findings).toContain('"No issues found"');
  });

  test('high complexity stops before Section 1 and asks cuts and structure separately', () => {
    expectMentions(compact(complexity), [['STOP', 'クラス/サービス', 'セクション 1']], 'compact(complexity)');
    ordered(compact(complexity), ['1. 複雑さを説明します', 'それぞれ別々に質問します',
      '2. このゲートが発動したときは', '3. 実際の機能と構造の回答を一つのスコープ記録として保存します']);
    expect(compact(complexity)).toContain('Pending remedies not decided here: <ids>');
  });

  test('the structure question uses its registered id and honors a stored preference', () => {
    ordered(compact(complexity), ['2. このゲートが発動したときは',
      '`plan-eng-review-structure`', '`AUTO_DECIDE`', '`Original arrangement`', '`Smaller arrangement`']);
    expectMentions(compact(complexity), [['plan-eng-review-structure', 'スラッグなし']], 'compact(complexity)');
  });

  test('no safe smaller arrangement does not authorize scope cuts or bypass the pause', () => {
    ordered(compact(complexity), ['より小さい配置がない場合',
      '一時停止は配置を未決定のまま', '解決されるまで C に進まない']);
    expectMentions(compact(complexity), [['解決されるまで', 'C に進まないでください']], 'compact(complexity)');
    expectMentions(compact(complexity), [['合意された質問だけ', '調べ']], 'compact(complexity)');
  });

  test('selector answers are saved and verified before scope changes apply', () => {
    const summary = compact(complexity.slice(complexity.indexOf('3. 実際の機能と構造')));
    ordered(summary, ['feature answers: <refs>; structure: <A/B + ref>; accepted scope: <exact scope>; pending remedies: <ids or none>',
      '読み戻して', '承認されたスコープの変更だけを適用します', '**C. 指摘を解決する** に進みます']);
    expectMentions(summary, [['失敗した場合', '先へ進めません']], 'summary');
    expect(summary).toContain('**not persisted**');
    expectMentions(compact(section), [['これらの選択', 'エンジニアリング上の是正', '承認しません']], 'compact(section)');
  });

  test('engineering remedies are saved, asked once, and recorded before the next choice', () => {
    const procedure = between(section, '## Decision procedure(決定の手順)', '## Scope Challenge');
    ordered(procedure, ['**一つの選択を比較する。**', '**保留中の記録のチェックポイント。**', '### 一度送信して待つ',
      'AskUserQuestion({ questions: [currentDecision] })', '### 回答を記録する', '次の選択については']);
    expectMentions(between(procedure, '### 一度送信して待つ', '### 回答を記録する'), [['STOP', '実際の回答', '届くまで']], 'section');
    expectMentions(compact(procedure), [['条件付きの修正', '実装', '承認しません']], 'compact(procedure)');
    expectMentions(compact(procedure), [['是正', 'ExitPlanMode', 'しないでください']], 'compact(procedure)');
    const questions = generateAskUserFormat({ skillName: 'plan-eng-review', host: 'claude', paths: HOST_PATHS.claude } as TemplateContext);
    expectMentions(questions, [['10 = 完全', '7 = ハッピーパス', '3 = 近道']], 'questions');
    expect(questions).toContain('Note: options differ in kind, not coverage — no completeness score.');
  });

  test('unavailable research preserves an explicit coverage limit and continues review', () => {
    expect(compact(assessment)).toContain('Search unavailable — proceeding with in-distribution knowledge only.');
    const outside = between(section, '### Outside Voice の後の続行', '### TODOS.md の更新');
    expectMentions(compact(outside), [['完了したレビューだけ', 'モデル間']], 'compact(outside)');
    expect(section).toContain('- Outside voice: ');
    expect(section).toContain('completed / unavailable / disabled / skipped');
    ordered(section.slice(section.indexOf('### Outside Voice の後の続行')), ['### TODOS.md の更新', '{{PLAN_REVIEW_APPROVAL_CHECK}}', '## Required outputs']);
  });

  test('paused transport and failed persistence have distinct non-success outcomes', () => {
    const pause = between(recovery, '**保留中の質問:**', '**修復可能な書き込み/読み取りの失敗:**');
    expectMentions(pause, [['完了のテレメトリ', 'ExitPlanMode', '出さずに']], 'pause');
    expectMentions(compact(pause), [['保留中'], ['再送しないでください']], 'compact(pause)');
    const failure = compact(between(recovery, '**修復可能な書き込み/読み取りの失敗:**', '**後からの変更や作業の欠落:**'));
    expectMentions(failure, [['依存する質問', '停止']], 'failure');
    expectMentions(failure, [['**Blocked outcome**', '従います']], 'failure');
    expectMentions(failure, [['許可された保存の失敗', 'チャットだけ', 'ないでください']], 'failure');
    const policy = compact(between(section, '## Review record and write policy', '{{LEARNINGS_SEARCH}}'));
    expect(policy).toContain('**Recovery routing → Repairable write/read failure**');
    expectMentions(policy, [['禁止された書き込みは', 'スキップ']], 'policy');
    const blocked = between(recovery, '**Blocked outcome:**', '**Report-back outcome:**');
    expect(blocked).toContain('`OUTCOME=error`');
    expect(blocked).not.toContain('`OUTCOME=success`');
  });

  test('#3106: a caller-forbidden write reports back as DONE with PERSISTED: no and a final PERSIST: line', () => {
    const back = compact(recovery.slice(recovery.indexOf('**Report-back outcome:**')));
    ordered(back, ['レビューログ', '**not persisted**', 'EXIT PLAN MODE GATE', '`OUTCOME=success`', '`DONE`', '`PERSISTED: no`',
      '`PERSIST: `', '`gstack-review-log`']);
    expect(back).not.toContain('BLOCKED');
    expect(back).not.toMatch(/REPORTED|DONE_WITH/);
    const blocked = compact(between(recovery, '**Blocked outcome:**', '**Report-back outcome:**'));
    expect(blocked).toContain('`BLOCKED`');
    const routes = compact(between(section, '| 成果物 | 保存先 | 書き込みが禁止されている場合 |', 'QA テスト計画/タスク JSONL は'));
    expectMentions(routes, [['**Read-only review**', '**Report-back outcome**']], 'routes');
    expectMentions(routes, [['レビューログ', '**Report-back outcome**']], 'routes');
    const finish = compact(between(section, '## Required outputs', '### 出力リファレンス'));
    expectMentions(finish, [['禁止', '**Report-back outcome**']], 'finish');
    expectMentions(finish, [['回復されなかった保存', '**Blocked outcome**', 'ログの記録ではなく']], 'finish');
    expectMentions(finish, [['必須のログが禁止', 'not persisted', '**Report-back outcome**']], 'finish');
  });

  test('#3106: an unpersisted review gets no saved credit; /ship names the PERSIST: line or a rerun', () => {
    const ctx = (skillName: string) => ({ skillName, tmplPath: `${skillName}/SKILL.md.tmpl`, host: 'claude', paths: HOST_PATHS.claude } as TemplateContext);
    const ship = compact(generateReviewDashboard(ctx('ship')));
    expectMentions(ship, [['Eng Review のレコードがない場合'], ['/plan-eng-review', '`PERSIST:` 行']], 'ship');
    expect(ship).toContain('docs/troubleshooting.md#plan-eng-review-not-persisted');
    expect(generateReviewDashboard(ctx('plan-eng-review'))).not.toContain('PERSIST:');
    const gate = compact(generateExitPlanModeGate(ctx('plan-eng-review')));
    expectMentions(gate, [['永続化が禁止', '**Report-back outcome**', 'このゲートではなく']], 'gate');
    const writer = compact(generatePlanFileReviewReport(ctx('plan-eng-review')));
    expectMentions(writer, [['**Report-back outcome**', '使います']], 'writer');
    expectMentions(writer, [['**Blocked outcome**', 'レビューログ', '従います']], 'writer');
    expect(readFileSync('docs/troubleshooting.md', 'utf8')).toContain('<a id="plan-eng-review-not-persisted"></a>');
  });

  test('late changes rerun affected approvals and outputs before another navigation answer', () => {
    const late = compact(between(recovery, '**後からの変更や作業の欠落:**', '**Blocked outcome:**'));
    ordered(late, ['影響を受けるレビューのステージに戻ります', 'Decision procedure',
      'Approval readiness', 'Required outputs の手順 1〜4', '次の遷移を選びます']);
    expectMentions(late, [['古い根拠', '**Blocked outcome**', 'まず']], 'late');
    const finish = section.slice(section.indexOf('## Required outputs'));
    expect(compact(finish)).toContain('**Recovery routing → Late change or missing work**');
    expectMentions(compact(finish), [['次のステップの回答', '実装', '承認するものではありません']], 'compact(finish)');
    ordered(finish, ['{{TASKS_SECTION_EMIT:eng-review}}', '### Completion summary', '{{PLAN_FILE_REVIEW_REPORT}}',
      '## レビューログ', '{{REVIEW_DASHBOARD}}', '## 次のステップ — レビューの連鎖', '## Learning hooks', '{{BRAIN_WRITE_BACK}}']);
    const sequence = compact(finish.slice(0, finish.indexOf('### 出力リファレンス')));
    ordered(sequence, ['1. **レビュー本文を準備する。**', '2. **保存と読み戻し。**', '3. **保存されたレビューを記録する。**',
      '4. **公開する。**', '5. **次の手順(ナビゲーション)を選ぶ。**', '6. **完了する。**', '自己チェック']);
  });

  test('plan test diagrams cover proposed paths without inventing existing implementation', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const ctx = { skillName: 'plan-eng-review', host: host.name, paths: HOST_PATHS[host.name] } as TemplateContext;
      const audit = generateTestCoverageAuditPlan(ctx);
      expectMentions(audit, [['既存または提案された', 'コンポーネント']], 'audit');
      expectMentions(audit, [['既存または提案された', '関数/メソッド']], 'audit');
      expectMentions(audit, [['提案', '実行可能なコードではありません']], 'audit');
      for (const obligation of ['すべての条件分岐', 'すべてのエラーパス', '別の関数へのすべての呼び出し', 'すべてのエッジ:']) {
        expect(audit).toContain(obligation);
      }
      expectMentions(audit, [['回帰カバレッジのスキップ', '認められません']], 'audit');
      const ship = generateTestCoverageAuditShip({ ...ctx, skillName: 'ship' });
      expectMentions(ship, [['変更された各ファイル', 'ASCII の diagram']], 'ship');
      expect(ship).not.toContain('既存または提案された');
    }
  });

  test('calibration write-back stays gated: no write instruction runs without the default-off gate', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const ctx = { skillName: 'plan-eng-review', host: host.name, paths: HOST_PATHS[host.name] } as TemplateContext;
      const output = generateBrainWriteBack(ctx);
      const gate = output.search(/`BRAIN_CALIBRATION_WRITEBACK` が設定され、かつ/);
      expect(gate).toBeGreaterThan(0);
      expect(output.indexOf('mcp__gbrain__takes_add')).toBeGreaterThan(gate);
      expect(output.indexOf('mcp__gbrain__put_page')).toBeGreaterThan(gate);
      expectMentions(output.slice(0, gate), [['このセクションをスキップ']], 'output.slice(0, gate)');
      expectMentions(output.slice(0, gate), [['有効にしたり', '許可', 'してはいけません']], 'output.slice(0, gate)');
      expect(output).toContain('brain_trust_policy@<endpoint-hash>=personal');
      expectMentions(output, [['不明な場合は', 'スキップ']], 'output');
      expect(output).toContain('source_skill: plan-eng-review');
      expect(output).not.toContain('${BRAIN_CALIBRATION_WRITEBACK');
      for (const skillName of ['office-hours', 'plan-ceo-review', 'plan-design-review', 'plan-devex-review']) {
        const other = generateBrainWriteBack({ ...ctx, skillName });
        expect(other).toStartWith('## Brain Calibration Write-Back (gated)');
        expect(other).toMatch(/\n\n`BRAIN_CALIBRATION_WRITEBACK` が設定され、かつ/);
        expect(other).not.toContain('このセクションをスキップ');
      }
    }
  });
});
