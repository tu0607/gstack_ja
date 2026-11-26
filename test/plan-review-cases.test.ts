import { describe, expect, test } from 'bun:test';
import { pickDevexCheckpointQuestion, pickPlanReviewQuestion } from './helpers/plan-review-cases';
import type { NativeQuestion } from './helpers/plan-skill-questions';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runGeneration } from '../scripts/gen-skill-docs';
import { generateAntiShortcutClause } from '../scripts/resolvers/spec-review';
import { generateCodexPlanReview } from '../scripts/resolvers/outside-voice-steps';
import { generatePlanFileReviewReport } from '../scripts/resolvers/review-dashboard';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { generateTestCoverageAuditPlan } from '../scripts/resolvers/testing';
import { ALL_HOST_CONFIGS } from '../hosts';
import { runCapturedCommand } from './helpers/sync-command-capture';
import { expectMentions } from './helpers/prompt-structure';

const compactProse = (value: string) => value.replace(/\s+/g, ' ').trim();
const at = (text: string, anchor: string | RegExp) => typeof anchor === 'string' ? text.indexOf(anchor) : text.search(anchor);
const ordered = (text: string, anchors: Array<string | RegExp>) => {
  const positions = anchors.map(anchor => at(text, anchor));
  expect(positions.every(position => position >= 0), `missing one of ${anchors.map(String).join(' | ')}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
};
const expectAll = (text: string, rules: RegExp[]) => { for (const rule of rules) expect(text).toMatch(rule); };

const mentions = (text: string, groups: string[][], where = 'text') => expectMentions(compactProse(text), groups, where);

describe('CI workflow clarity regressions', () => {
  test('CEO defines narrow depth and sends settled initial choices directly to mode selection', () => {
    const source = compactProse(readFileSync('plan-ceo-review/SKILL.md.tmpl', 'utf8'));
    const routeMarker = '**まず、その質問のルートを選んでください:**';
    const route = source.split(routeMarker)[1]!.split('**1. 情報源')[0]!;
    ordered(route, ['**管理上の質問:**', '**プランの判断:**']);
    expectMentions(route, [['回答を待って記録'], ['プランの変更', '承認しません'], ['手順 2〜4', '新しい回答'],
      ['管理上の回答', 'プランの変更', 'プランの判断のルート']], 'route');
    ordered(source, [routeMarker, '**1. 情報源', '**質問前のチェックポイント:**', '**回答後のチェックポイント:**']);
  });

  test('Eng defines evidence paths and gives its setup selector short labels with complete descriptions', () => {
    const source = compactProse(readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8'));
    for (const field of ['プラン: 指定された既存のパス', 'ブランチの差分: 変更されたファイル', 'ファイル/ディレクトリ: 選択されたパス']) expect(source).toContain(field);
    expectMentions(source, [['`not available`', '将来のパス'], ['パスを作り出さない'], ['同じ承認済みの機能リスト']], 'source');
    for (const token of ['`Original arrangement`', '`Smaller arrangement`', '`Pending remedies not decided here: <ids>`']) expect(source).toContain(token);
    expect(source).not.toContain('`A) Original arrangement: <files/classes>; fixed features: <approved list>`');
  });

  test('Eng initializes a report before its first record without findings or a premature terminal report', () => {
    const source = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
    const FIRST = '**最初のレポート保存:**';
    const requirements = [['ヘッダー', '固定されたターゲット'], ['既存の保存先', '読み込み', '保持'],
      ['指摘事項と修正', 'Scope Challenge C', '台帳の保存'], ['`## GSTACK REVIEW REPORT`', 'EOF'],
      ['最終レポート', 'Plan File Review Report']];
    const check = (text: string) => {
      const policy = compactProse(text.split('## Review record and write policy')[1]!.split('{{LEARNINGS_SEARCH}}')[0]!);
      const initialization = policy.split(FIRST)[1]?.split('**書き込みの経路。**')[0] ?? '';
      expect(initialization.length).toBeGreaterThan(0);
      const permission = policy.indexOf('各成果物と親ディレクトリの権限を確認してください');
      expect(permission).toBeGreaterThanOrEqual(0);
      expect(permission).toBeLessThan(policy.indexOf(FIRST));
      expectMentions(initialization, requirements, 'initialization');
      const save = compactProse(text.split('**保留中の記録のチェックポイント。**')[1]!.split('### 一度送信して待つ')[0]!);
      expectMentions(save, [['レポートの配置'], ['Read', '保存された記録全体']], 'save');
    };
    check(source);
    expect(() => check(source.replace(/\*\*最初のレポート保存:\*\*[^\n]*/, ''))).toThrow();
  });

  test('Eng separates setup selectors from remedy execution and names the exact resume points', () => {
    const source = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
    const setup = compactProse(source.split('## Decision procedure(決定の手順)')[1]!.split('### 未回答の選択を準備する')[0]!);
    expectMentions(setup, [['回答前の台帳は使いません'], ['Scope Challenge B', 'セレクター'], ['エンジニアリング上の是正を承認しません']], 'setup');
    const procedure = compactProse(source.split('## Decision procedure(決定の手順)')[1]!.split('## Scope Challenge')[0]!);
    expect(procedure.slice(procedure.indexOf('### 未回答の選択を準備する'))).not.toContain('Context Recovery/前提条件');
    expect(source).not.toContain('**Setup selectors stop at B.**');
    const entry = compactProse(readFileSync('plan-eng-review/SKILL.md.tmpl', 'utf8'));
    expectMentions(entry, [['是正措置の回答', '**Record the answer**'], ['ユーザーが見た可能性がある', 'まだ保留中'], ['再送しないでください']], 'entry');
  });

  test('Eng exposes each existing performance concern without a second approval procedure', () => {
    const source = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
    const performance = source.split('### 4. パフォーマンスのレビュー')[1]!.split('{{CODEX_PLAN_REVIEW}}')[0]!;
    const concerns = performance.match(/^\* .+$/gm)!.join('\n');
    expectAll(concerns, [/N\+1 クエリ/, /メモリ/, /キャッシュ/, /遅い、または複雑なパス/]);
    expect(performance).not.toContain('AskUserQuestion');
  });

  test('Eng binds unchanged complexity thresholds and MODE to selected work and actual scope changes', () => {
    const source = compactProse(readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8'));
    const scope = source.split('## Scope Challenge')[1]!.split('## Review Sections')[0]!;
    expectMentions(scope, [['根拠としてのみ読んだファイルではなく', '選択された作業を数えます']], 'scope');
    expectMentions(scope, [['STOP', 'クラス/サービス', 'セクション 1']], 'scope');
    const result = scope.slice(scope.indexOf('Scope Challenge の結果は'));
    for (const token of ['`scope reduced per recommendation`', '`scope accepted as-is`']) expect(result).toContain(token);
    expectMentions(result, [['より小さい配置', 'スコープの削減にはなりません'], ['MODE', '保留中の是正', '承認するものではありません']], 'result');
    expectMentions(source, [['MODE', 'FULL_REVIEW', 'scope accepted as-is'], ['SCOPE_REDUCED', 'scope reduced per recommendation'],
      ['issues_found', '4 つのセクションの件数のみ']], 'source');
  });

  test('Eng three-stage transaction rejects missing save, comparison, wait or answer checkpoints', () => {
    const source = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
    const markers: string[] = ['### 未回答の選択を準備する', '**保留中の記録のチェックポイント。**',
      'Read で保存された記録全体を取得してください', '各ネイティブのフィールドを `currentDecision` と比べ',
      '### 一度送信して待つ', '検証済みの質問、ヘッダー、ラベル、説明を一字一句そのままコピーしてください',
      '実際の回答が届くまで STOP', '### 回答を記録する',
      '選択された保存済みのラベル、完全な説明、グリッドの列を一緒に読みます', 'スコープされた Edit を使って',
      '解決ブロック全体を Read してください', '選択された選択肢の全体とグリッドの列に一致する', '次の選択については'];
    const check = (text: string) => ordered(compactProse(text.split('## Decision procedure(決定の手順)')[1]!.split('## Scope Challenge')[0]!), markers);
    check(source);
    for (const marker of markers) expect(() => check(compactProse(source).replace(marker, ''))).toThrow();
    expect(source).not.toMatch(/return to step|repeat steps|after step [1-6]/i);
    expectMentions(compactProse(source), [['回答が保留中でない', '次のセクションを開始']], 'compactProse(source)');
  });

  test('Eng finalization refreshes the existing Test Plan without repeating its producer', () => {
    const source = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
    const closing = source.split('## Required outputs')[1]!;
    expect(source.match(/\{\{TEST_COVERAGE_AUDIT_PLAN\}\}/g)).toHaveLength(1);
    expect(source.indexOf('{{TEST_COVERAGE_AUDIT_PLAN}}')).toBeLessThan(source.indexOf('### 4. パフォーマンスのレビュー'));
    expect(closing.match(/1\. \*\*レビュー本文を準備する。\*\*/g)).toHaveLength(1);
    expect(closing.indexOf('1. **レビュー本文を準備する。**')).toBeLessThan(closing.indexOf('2. **保存と読み戻し。**'));
    mentions(closing, [['変更のない出力', '作り直さ']], 'closing');
  });

  test('plan coverage definitions precede the uninterrupted trace sequence', () => {
    const source = generateTestCoverageAuditPlan({ skillName: 'plan-eng-review', host: 'claude', paths: HOST_PATHS.claude } as TemplateContext);
    ordered(source, ['定義: **targeted audit**', '**Step 1. プラン内のすべてのコードパスをトレースします:**']);
    const trace = source.indexOf('**Step 1. プラン内のすべてのコードパスをトレースします:**');
    const first = source.slice(source.indexOf('1. **プランを読みます。**', trace), source.indexOf('2. **データフローをトレースします。**', trace));
    mentions(first, [['diagram を描く前', '専用のツール呼び出し']], 'first');
    expect(first).not.toContain('定義:');
    expect(first).not.toContain('Step 2 の前');
    mentions(source, [['5 つの Test ステップ', 'Section 3', 'Scope'], ['トレースや diagram の前', '具体的なソース/テストを読みます'],
      ['将来のパス', '提案']], 'source');
  });

  test('CEO fallback names the current host mode and needs completed findings before the later report exists', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const source = generateCodexPlanReview({ skillName: 'plan-ceo-review', host: host.name, paths: HOST_PATHS[host.name] } as TemplateContext);
      expect([...new Set(source.match(/under_codex|under_current_harness/g))]).toEqual(['under_current_harness']);
      mentions(source, [['SOURCE=in-host', 'OUTSIDE_STATUS=unavailable', 'clean', 'issues_found'], ['Sections 1-10/11', '台帳'], ['最終レポート', '後の']], 'source');
      expect(source).not.toContain('Sections 1-10/11 and current report');
    }
  });
});

const menu = (labels: string[], header = 'Next review', question = "D12 — What's next?"): NativeQuestion => ({
  header, question, multiSelect: false, options: labels.map(label => ({ label, description: 'Offered choice' })),
});

// Generated instruction ordering only; native completion remains a paid check.
describe('plan report persistence precedes completion logging', () => {
  test('Eng required レビューログ failure stops before best-effort decision logging', () => {
    const template = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
    const logSection = template.split('## レビューログ')[1]!.split('{{REVIEW_DASHBOARD}}')[0]!;
    const block = logSection.match(/```bash\n([\s\S]*?)\n```/)?.[1];
    expect(block).toBeDefined();
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'eng-required-log-')));
    try {
      const bin = join(root, 'bin'); mkdirSync(bin);
      // These are freshly created ordinary files inside this isolated root;
      // never write through a host skill-registration symlink.
      expect(realpathSync(bin)).toBe(join(root, 'bin'));
      for (const [name, label, exitVar] of [
        ['gstack-review-log', 'required', 'FIXTURE_REVIEW_EXIT'],
        ['gstack-decision-log', 'decision', 'FIXTURE_DECISION_EXIT'],
      ]) writeFileSync(join(bin, name!), `#!/bin/sh\nprintf '%s\\n' '${label}' >> "$FIXTURE_CALL_LOG"\nexit "$${exitVar}"\n`, {mode: 0o755, flag: 'wx'});
      const command = block!.replaceAll('~/.claude/skills/gstack/bin/', `'${bin}/'`);
      expect(command).not.toContain('~/.claude/skills');
      for (const [reviewExit, decisionExit, expectedExit, calls] of [
        [23, 0, 23, ['required']],
        [0, 0, 0, ['required', 'decision']],
        [0, 17, 0, ['required', 'decision']],
      ] as const) {
        const file = join(root, `calls-${reviewExit}-${decisionExit}`);
        const result = runCapturedCommand('bash', ['-c', command], {cwd: root,
          env: {...process.env, FIXTURE_CALL_LOG: file, FIXTURE_REVIEW_EXIT: String(reviewExit), FIXTURE_DECISION_EXIT: String(decisionExit)},
          timeout: 5000, captureStdout: true});
        expect(result.status, result.stderr).toBe(expectedExit);
        expect(readFileSync(file, 'utf8').trim().split('\n')).toEqual([...calls]);
      }
    } finally { rmSync(root, {recursive: true, force: true}); }
  });
  const plans = ['plan-ceo-review', 'plan-eng-review', 'plan-design-review', 'plan-devex-review'];
  // The Japanese templates translate these headings; plan-eng-review keeps its English ones.
  const logHeadingOf = (skill: string) => skill === 'plan-eng-review' ? '## レビューログ'
    : skill === 'plan-devex-review' ? '## レビューログ' : '## レビューログ';
  const logHeadingOfPath = (relativePath: string) => logHeadingOf(plans.find(skill => relativePath.includes(`${skill}/`)) ?? '');
  for (const skill of plans) {
    test(`${skill}: save/readback gate precedes its log and dashboard`, () => {
      const template = readFileSync(`${skill}/sections/review-sections.md.tmpl`, 'utf8');
      const report = template.indexOf('{{PLAN_FILE_REVIEW_REPORT}}');
      const log = template.indexOf(logHeadingOf(skill));
      const dashboard = template.indexOf('{{REVIEW_DASHBOARD}}');
      expect(report).toBeGreaterThan(0);
      expect(report).toBeLessThan(log);
      expect(log).toBeLessThan(dashboard);
      expect(template.match(/\{\{PLAN_FILE_REVIEW_REPORT\}\}/g)).toHaveLength(1);
      const logPolicy = compactProse(template.slice(log, dashboard));
      if (skill === 'plan-eng-review') {
        expectMentions(compactProse(template), [['レビューログ', '**Report-back outcome**', '代わりに'],
          ['必須のログ', '成功した場合にのみ', '保存されたレビューとして公開']], 'template');
      } else if (skill === 'plan-ceo-review') {
        expectMentions(logPolicy, [['書き込みと読み戻しが成功した後にのみ'], ['保存または検証が失敗した場合', 'このブロックの前で停止'],
          ['両方の履歴コマンド', 'ベストエフォート'], ['記録されたと主張しないでください']], 'logPolicy');
      } else {
        expectMentions(logPolicy, [['書き込み', '後にのみ保存'], ['失敗した場合', 'エラーを報告して停止']], 'logPolicy');
      }
    });
  }
  for (const host of ALL_HOST_CONFIGS) {
    test(`${host.name}: current report does not depend on a premature completion record`, () => {
      for (const skillName of plans) {
        const report = generatePlanFileReviewReport({ skillName, host: host.name, paths: HOST_PATHS[host.name]! } as TemplateContext);
        // PLAN.md may be the review input while REPORT.md is the requested output.
        const target = report.slice(report.indexOf(skillName === 'plan-eng-review'
          ? '### 選択済みのレポートファイルを使う' : '### プランファイルを検出する'), report.indexOf('### レポートを生成する'));
        expect(target.length).toBeGreaterThan(0);
        if (skillName === 'plan-eng-review') {
          expectMentions(target, [['Review record and write policy', '選択された'], ['別の保存先を選んではいけません']], 'target');
          expect(target).not.toContain('ホストのアクティブなプラン');
          const writer = report.slice(report.indexOf('### レポートファイルに書き込む'));
          expect(writer).not.toContain('PLAN MODE EXCEPTION — ALWAYS RUN');
          expectMentions(writer, [['保存先がない', '書き込みが禁止', 'not persisted'], ['ファイル書き込みのステップは実行せず'],
            ['読み直して', '再試行'], ['その場で置き換えてはいけません'], ['新しいレポートをファイル末尾に追記']], 'writer');
        } else {
          ordered(target, ['明示的に指定された出力/レポートファイル', 'ユーザーが示したレビュー対象のプラン', 'ホストのアクティブなプラン']);
        }
        if (skillName === 'plan-ceo-review') {
          expectMentions(target, [['書き込みが許可されたファイルがない', '完全なプラン'], ['レポートの生成を省略してはいけません']], 'target');
        } else if (skillName !== 'plan-eng-review') {
          expectMentions(target, [['対象のファイルがなければ', 'スキップ']], 'target');
        }
        expect(report).toContain('過去のレビューのエントリ');
        if (['plan-ceo-review', 'plan-eng-review'].includes(skillName)) {
          expect(report).toContain('現在の Completion Summary を使います');
          expect(report).not.toContain('DX Scorecard');
          expectMentions(report, [['`clean`', 'CLEAR', '`issues_open`', 'ISSUES OPEN'], ['not-persisted']], 'report');
        } else expect(report).toContain('現在の Completion Summary or DX Scorecard');
        expectMentions(report, [['過去の実行回数', 'ちょうど 1'], ['事前にログへ記録してはいけません']], 'report');
        if (skillName === 'plan-ceo-review') {
          const writer = compactProse(report.slice(report.indexOf('### プランファイルに書き込む')));
          expectMentions(writer, [['完了済みレビューのログとハンドオフはありません']], 'writer');
          ordered(writer, ['保存先が選択されていない場合、または書き込みが禁止されている場合', '`## GSTACK REVIEW REPORT` をファイル末尾に置いて',
            '保存先のファイルが存在する場合は', '今ここで Read します', '保存先のファイルが存在しない場合は、Write', 'レポートを最後に置いたまま', '4. **Read-back gate:**']);
        } else expectMentions(report, [['以前のレポートがあったかどうか', '追記']], 'report');
        expectMentions(report, skillName === 'plan-eng-review'
          ? [['レビューログ', '決定事項のログ記録の前に', '**Blocked outcome**']]
          : [['レビューログ', '決定事項のログ記録の前に', '停止']], 'report');
        expect(report.indexOf('Read-back gate')).toBeGreaterThan(report.indexOf(skillName === 'plan-eng-review' ? '### レポートファイルに書き込む' : '### プランファイルに書き込む'));
        expect(report).not.toContain('review log output you already have');
      }
      for (const skillName of ['codex', 'devex-review']) {
        const report = generatePlanFileReviewReport({ skillName, host: host.name, paths: HOST_PATHS[host.name]! } as TemplateContext);
      }
    });
  }
  test('every generated plan-review carrier keeps write/readback before log before dashboard', async () => {
    const outputRoot = mkdtempSync(join(tmpdir(), 'review-persistence-order-'));
    try {
      const generated = await runGeneration({ host: 'all', outputRoot, contentLinkRoot: null, log: () => {} });
      expect(generated.exitCode, JSON.stringify(generated.diagnostics)).toBe(0);
      // A carved skill carries the report in sections/review-sections.md (every
      // host since C4 for plan-ceo-review); an inlined one in its SKILL.md.
      const isSection = (artifact: typeof generated.artifacts[number]) => artifact.kind === 'section'
        && plans.some(skill => artifact.relativePath === `${skill}/sections/review-sections.md`
          || artifact.relativePath.endsWith(`/gstack-${skill}/sections/review-sections.md`));
      const carved = new Set(generated.artifacts.filter(isSection).map(a => `${a.host}:${a.relativePath.replace(/\/sections\/review-sections\.md$/, '')}`));
      const carriers = generated.artifacts.filter(artifact => isSection(artifact)
        || (artifact.kind === 'skill' && plans.some(skill => artifact.relativePath.endsWith(`/gstack-${skill}/SKILL.md`))
          && !carved.has(`${artifact.host}:${artifact.relativePath.replace(/\/SKILL\.md$/, '')}`)));
      expect(carriers).toHaveLength(plans.length * ALL_HOST_CONFIGS.length);
      for (const carrier of carriers) {
        const content = readFileSync(join(outputRoot, carrier.relativePath), 'utf8');
        if (carrier.relativePath.includes('plan-eng-review/')) {
          const dispatch = compactProse(content.slice(content.indexOf('**保留中の記録のチェックポイント。**'), content.indexOf('## Scope Challenge')));
          ordered(dispatch, ['AskUserQuestion({ questions: [currentDecision] })', '実際の回答が届くまで STOP', '### 回答を記録する', '次の選択については']);
        }
        const report = content.indexOf('\n## Plan File Review Report(プランファイルのレビューレポート)\n');
        const readback = content.indexOf('**Read-back gate:**', report);
        const log = content.indexOf(`\n${logHeadingOfPath(carrier.relativePath)}\n`);
        const dashboard = content.indexOf('\n## Review Readiness Dashboard(レビュー準備状況のダッシュボード)\n');
        expect({ carrier: carrier.relativePath, ordered: 0 < report && report < readback && readback < log && log < dashboard }).toMatchObject({ ordered: true });
        expect(content.slice(report, readback)).toContain('現在の Completion Summary');
        expectMentions(content.slice(readback, log), carrier.relativePath.includes('plan-eng-review/')
          ? [['レビューログ', '決定事項のログ記録の前に', '**Blocked outcome**']]
          : [['レビューログ', '決定事項のログ記録の前に', '停止']], 'readback to log');
      }
    } finally { rmSync(outputRoot, { recursive: true, force: true }); }
  }, 30_000);
});

test('Eng loads its one remedy procedure before Scope Challenge findings and retains consent', async () => {
  const outputRoot = mkdtempSync(join(tmpdir(), 'eng-decision-order-'));
  let rendered: { skeleton: string; sections: string };
  try {
    const generated = await runGeneration({ host: 'claude', outputRoot, contentLinkRoot: null });
    expect(generated.exitCode, JSON.stringify(generated.diagnostics)).toBe(0);
    rendered = {
      skeleton: readFileSync(join(outputRoot, 'plan-eng-review/SKILL.md'), 'utf8'),
      sections: readFileSync(join(outputRoot, 'plan-eng-review/sections/review-sections.md'), 'utf8'),
    };
  } finally { rmSync(outputRoot, { recursive: true, force: true }); }
  for (const suffix of ['.tmpl', '']) {
    const skeleton = suffix ? readFileSync(`plan-eng-review/SKILL.md${suffix}`, 'utf8') : rendered.skeleton;
    const sections = suffix ? readFileSync(`plan-eng-review/sections/review-sections.md${suffix}`, 'utf8') : rendered.sections;
    ordered(skeleton, ['# プランレビューモード', '明示的に許可しない限り、機能、受け入れスイート、ベンチマークを構築しないでください', '## スコープゲート']);
    const rule = sections.indexOf('## Decision procedure(決定の手順)');
    expect(rule).toBeGreaterThan(0);
    expect(sections.match(/^## Decision procedure\(決定の手順\)$/gm)).toHaveLength(1);
    const procedureBody = compactProse(sections.slice(rule, sections.indexOf('## Scope Challenge')));
    const dispatch = procedureBody.slice(procedureBody.indexOf('**保留中の記録のチェックポイント。**'));
    ordered(dispatch, ['### 一度送信して待つ', 'AskUserQuestion({ questions: [currentDecision] })',
      '実際の回答が届くまで STOP', '### 回答を記録する', '次の選択については']);
    expectMentions(dispatch, [['質問オブジェクトを一つ送ります'], ['ほかの ID は待機します'],
      ['是正を適用したり', '別の呼び出し', 'ExitPlanMode'], ['/autoplan', '承認された決定']], 'dispatch');
    expect(procedureBody).not.toContain('Setup gates');
    expect(skeleton).not.toContain('**Decisions (including Step 0):**');
    expect(skeleton).not.toContain('For every issue or recommendation');
    const scope = compactProse(sections.slice(sections.indexOf('## Scope Challenge'), sections.indexOf('## Review Sections')));
    expectMentions(scope, [['複雑さのゲート', '決定ブリーフ'], ['機能の削減/延期', '別々に質問'], ['スコープを変更する前に待ちます'],
      ['承認されていない修正', '保留のまま'], ['削減がなくても', '構造の質問を解決'],
      ['元の配置の確認', '一時停止を提案'], ['回答を待ちます'], ['承認されたスコープの変更だけを適用します'],
      ['指摘やスコープの回答は', '承認しません']], 'scope');
    expect(scope).toContain('No issues found');
    const complexityRule = scope.indexOf('最初のスコープのセレクターには、グリッドも **回答前** の台帳への書き込みも必要ありません');
    expect(complexityRule).toBeGreaterThan(0);
    expect(complexityRule).toBeLessThan(scope.indexOf('1. 複雑さを説明します'));
    expectMentions(scope.slice(complexityRule), [['質問して待ってください'], ['一つのスコープ記録'],
      ['実際の回答と照らして読み戻して'], ['回答前の記録を作り直さないでください']], 'scope after complexityRule');
    expect(scope).not.toContain('proceed as-is');
    const stop = skeleton.indexOf('**複雑さのゲート:**');
    const sectionMarker = suffix ? /\{\{SECTION:review-sections\}\}/g : /> \*\*STOP\.\*\* Scope Challenge と完全なレビューの開始/g;
    const sectionRead = at(skeleton, new RegExp(sectionMarker.source, sectionMarker.flags.replace('g', '')));
    expect(stop).toBeGreaterThan(0);
    expect(sectionRead).toBeGreaterThan(stop);
    expect(skeleton.slice(skeleton.indexOf('### Step 0: Scope Challenge'), sectionRead)).not.toContain('**STOP');
    expectMentions(compactProse(skeleton.slice(stop, sectionRead)), [['セクション 1', 'ExitPlanMode', '指摘や修正を書いたりしないでください']], 'section');
    expectMentions(skeleton, [['Scope Challenge', 'セクション 1', '必ず行います']], 'skeleton');
    expect(skeleton.match(sectionMarker)).toHaveLength(1);
    expectMentions(compactProse(sections), [['以下のブロックを順番に従ってください'], ['参照ルール', '追加のレビュー工程ではありません']], 'sections');
    expect(sections).not.toContain('After startup, prepare in this order:');
    ordered(sections, ['## Review record and write policy',
      suffix ? '{{LEARNINGS_SEARCH}}' : '## Prior Learnings', suffix ? '## 振り返りによる学習' : '## 振り返りによる学習',
      suffix ? '{{CONFIDENCE_CALIBRATION}}' : '## Confidence Calibration',
      '## Decision procedure(決定の手順)', '## Scope Challenge', '### 1. アーキテクチャのレビュー']);
    expect(sections).not.toContain('{{ANTI_SHORTCUT_CLAUSE}}');
    expect(sections).not.toContain('**Anti-shortcut clause:**');
    expect(skeleton).not.toContain('STOP while a Step 0 question');
    expect(sections.match(/^## Scope Challenge\(スコープチャレンジ\)$/gm)).toHaveLength(1);
    expect(sections).not.toContain('## Step 0 findings');
    ordered(scope, ['8 ファイル未満かつ新しいクラス/サービスが 2 個未満であれば、B の質問は飛ばして', '### C. 指摘を解決する',
      '1. 番号付きの Scope Challenge の指摘を', '2. Decision procedure を通して各是正を解決し', '3. それらの回答から、受け入れ/却下/延期/保留の処理を報告します',
      '回答が保留中でない場合にのみ、セクション 1 に進みます']);
    const selfCheckEnd = skeleton.indexOf(suffix ? '{{EXIT_PLAN_MODE_GATE}}' : '## EXIT PLAN MODE GATE');
    const selfCheck = compactProse(skeleton.slice(skeleton.indexOf('## セクションの自己チェック'), selfCheckEnd));
    expectMentions(selfCheck, [['Scope Challenge', 'セクション 1〜4', 'Outside Voice', '出力を完了した'], ['検証済みの作業は保持してください']], 'selfCheck');
    expect(selfCheck).toContain('`~/.claude/skills/gstack/plan-eng-review/sections/review-sections.md`');
    expect(selfCheck).not.toContain('Redo memory-only work');
    const stages = skeleton.indexOf('ターゲットの選択後は、プリアンブルの完全な決定ブリーフ');
    const prerequisite = skeleton.indexOf(suffix ? '{{BENEFITS_FROM}}' : '## 前提スキルの提案');
    ordered(skeleton, ['ターゲットの選択後は、プリアンブルの完全な決定ブリーフ', suffix ? '{{BENEFITS_FROM}}' : '## 前提スキルの提案', '## エンジニアリングレビュー', '### Step 0: Scope Challenge']);
    expectMentions(skeleton.slice(stages, prerequisite), [['完全な決定ブリーフ', 'トランスポート', '連続した D 番号'], ['セットアップの質問', '承認されません']], 'stages');
    expect(skeleton).not.toContain('**Later question stages:**');
    if (!suffix) expectMentions(skeleton.slice(prerequisite), [['完全な意思決定ブリーフ', '事実と選択肢']], 'prerequisite');
    const boundary = compactProse(sections.slice(rule, sections.indexOf('### 1. アーキテクチャのレビュー')));
    expectMentions(boundary, [['リクエスト、ソース、実際の回答を読みます'], ['一つの選択を終えてから、次に進みます'],
      ['別々の選択です', '同じ指摘、関数、パッチ'], ['各上限には', '測定方法と単位'],
      ['すべての列で', '承認済みの値は変えずに繰り返し'], ['一つの振る舞いは', '必要なコード、テスト、ドキュメント'],
      ['カバレッジの選択肢は実装や証明の深さを変えます'], ['確立された契約や', '必要な証明を削らないでください'],
      ['正確な過去の承認', '回答と処理を引用'], ['後から判明した必須の証明', '再度質問せずに引き継ぎます'],
      ['それを分け', 'この比較を作り直して', '保存または送信する前に'], ['そのテストは承認を待ちます'],
      ['振る舞いを変えない事実の訂正', '訂正と根拠を記録します']], 'boundary');
  }
}, 30_000);

// Source/renderer contract controls only: native review behavior remains a paid
// regression. Resolve the actual Eng clause on every host without trusting an
// old generated carrier to hide a contradictory unconditional approval gate.
describe('Eng approved-work decision gate', () => {
  const template = readFileSync('plan-eng-review/sections/review-sections.md.tmpl', 'utf8');
  const rawGate = template.split("## Decision procedure(決定の手順)")[1]?.split('### 1. アーキテクチャのレビュー')[0] ?? '';
  const gate = compactProse(rawGate);
  const ledger = rawGate.match(/```markdown\n([\s\S]*?)\n```/)?.[1] ?? '';
  const prepare = gate.indexOf('### 未回答の選択を準備する');
  const identify = gate.indexOf('選択肢を作る前に');
  const compare = gate.indexOf('**一つの選択を比較する。**');
  const save = gate.indexOf('**保留中の記録のチェックポイント。**');
  const send = gate.indexOf('### 一度送信して待つ');
  const record = gate.indexOf('### 回答を記録する');

  test('the ledger template keeps one record with its fields, selectors and single State block', () => {
    const lines = ledger.split('\n');
    expect(lines).toContain('### R1: <one independently selectable choice>');
    expect(lines.filter(line => /^[A-Z][A-Za-z ]*(?: D2)?:/.test(line)).map(line => line.split(':')[0])).toEqual([
      'Finding', 'Plan baseline', 'Runtime evidence', 'Comparison grid', 'Question D2', 'Header', 'Options',
      'State', 'Actual answer', 'Accepted scope', 'History',
    ]);
    expect(ledger).toContain('State: <pending, or approved>');
    expect(lines.filter(line => line.startsWith('State:'))).toHaveLength(1);
    expect(ledger).toContain('Question D2:\n<currentDecision.question in full');
    expect(ledger).toContain('Header: <currentDecision.header>');
    for (const selector of ['A', 'B']) expect(ledger).toContain(`with one ${selector}) record selector>`);
    expect(rawGate.indexOf(ledger)).toBeGreaterThan(rawGate.indexOf('**保留中の記録のチェックポイント。**'));
    expect(rawGate.indexOf(ledger)).toBeLessThan(rawGate.indexOf('### 一度送信して待つ'));
  });

  test('preserves the full selected scope and reopens contradictory options before applying them', () => {
    const options = gate.slice(compare, save);
    expectMentions(options, [['完全なラベルと説明', 'グリッドの列のすべての行'], ['同じコミットメントを示し', '同じ条件を保持'],
      ['条件付きの修正を含め', '実装は一切承認しません']], 'options');
    const apply = gate.slice(record, gate.indexOf('## Scope Challenge'));
    ordered(apply, ['選択された保存済みのラベル、完全な説明、グリッドの列を一緒に読みます', '**未回答の選択を準備する** に戻って',
      '隣接する `State` / `Actual answer` / `Accepted scope` のブロック全体を置き換えてください']);
    expectMentions(apply, [['解釈し直したり', '矛盾する承認']], 'apply');
    // a689 D3's conditional fix was selected, then silently replaced with a
    // probe-only scope. Native behavior remains a paid gate; this guards the
    // producer's prepare/apply/recovery instructions, not that run's outcome.
  });

  test('reconciles operative decision State before approval readiness and unresolved counts', () => {
    const apply = gate.slice(record, gate.indexOf('## Scope Challenge'));
    expectMentions(apply, [['State を `approved` に', '`pending`'], ['置き換えられた状態は', 'History に移します'],
      ['各フィールドは History の外に一度だけ'], ['回答とスコープの末尾だけを更新しないでください'], ['Read の代わりになりません'], ['選択肢は保持し']], 'apply');
    // c6fc retained both pending and approved fields after an acknowledged answer.
    ordered(apply, ['隣接する `State` / `Actual answer` / `Accepted scope` のブロック全体を置き換えてください',
      'スコープされた Edit を使って', 'その一意の状態、実際の回答、承認されたスコープが', '先へ進む前に差異を修正し']);
    expect(apply.indexOf('次の選択については')).toBeGreaterThan(apply.indexOf('その一意の状態、実際の回答、承認されたスコープが'));
    const outputs = compactProse(template.split('## Required outputs')[1]!.split('### 「スコープ外」セクション')[0]!);
    expectMentions(outputs, [['各記録の現在の State', '選択は保留のままにします'], ['エントリポイントの **Recovery routing**'],
      ['変更された出力は', '手順 1〜4']], 'outputs');
  });

  test('current contracts and completed comparisons precede saved questions without approving a fix', () => {
    expect(0 <= prepare && prepare < identify && identify < compare && compare < save && save < send && send < record).toBe(true);
    const headings = [...rawGate.split('## Scope Challenge')[0]!.replace(/```markdown[\s\S]*?```/g, '').matchAll(/^### ([^\n]+)$/gm)].map(match => match[1]);
    expect(headings).toEqual(['未回答の選択を準備する', '一度送信して待つ', '回答を記録する']);
    // A reopened row must use its latest accepted plan, not the seed/runtime
    // value, and rebuild all option states before the existing save/ask gate.
    expectMentions(gate.slice(prepare, identify), [['観測された振る舞い', '承認を与えません'], ['検証されていない振る舞い', '不明とマーク'],
      ['以前の値', 'History に残してください']], 'prepare');
    expectMentions(gate.slice(identify, compare), [['一つの検証方法の任意の深さは', '一つの選択とみなします'],
      ['代替の仕組みは一つの質問にまとめます'], ['再度開かれた選択は ID を維持し', '`D<N>`']], 'identify');
    expectMentions(gate.slice(prepare, save), [['既存/提案されたテスト', 'スコア']], 'gate.slice(prepare, save)');
    const options = gate.slice(compare, save);
    expectMentions(options, [['具体的な現在の値', '各選択肢の値と作業量', '承認の引用'], ['共有された、固定された、保留中の選択をすべて含めます'],
      ['Investigate/Defer', '調査の範囲を限定'], ['必要な実装と証明は共通の作業として扱います'], ['新しいものであれば承認が必要です'],
      ['選択可能なすべての振る舞い', '行を一つ割り当てます']], 'options');
    expectMentions(gate.slice(save, send), [['Grep', '記録を検証しません']], 'gate.slice(save, send)');
    expectMentions(gate, [['再度開くのは', '矛盾する根拠', '変わった前提']], 'gate');
  });

  test('assigns independent row IDs before constructing the final question', () => {
    ordered(gate.slice(identify, compare), ['現在の各値と提案された変更を列挙してください',
      '独立して選択できる変更には、別々の ID を付けます', 'ユーザーが一方を承認し']);
  });

  test('finishes native fields before save and dispatches the literal final read-back', () => {
    const options = gate.slice(compare, save);
    ordered(options, ['保留中の ID を一つ選びます', '別の **comparison grid** を作成します', '**保存前に整合させる。**']);
    expect(options).toContain('`currentDecision` を構築します');
    expect(options).toContain('`options`: すべての正確なラベルと完全な説明');
    expect(options).toContain('`question`: プロジェクト、ELI10、Stakes、Recommendation');
    expectMentions(options, [['file:line', 'ネイティブのフィールドに入れてください'], ['人間/CC の作業量', 'リスク', '保守'],
      ['保存する前に', 'ヘッダーとすべてのラベルを確定'], ['各 5 語未満'],
      ['保存された Pros/cons ブロックだけでは', '不足している決定の文脈を補えません']], 'options');
    const checkpoint = gate.slice(save, send);
    expectMentions(checkpoint, [['記録、完全なグリッド、正確な `currentDecision` を保存します'], ['保存に失敗した場合は質問をブロックします'],
      ['すべてのネイティブのフィールド、推奨案、すべての選択肢を含めてください'], ['A〜D の記録用セレクターは台帳の表記にすぎません'],
      ['最後の編集の後に読み込んでください'], ['Grep', '記録を検証しません'], ['質問する前に完全な Read を繰り返してください'],
      ['Question、Header、Options のフィールドを重複させないでください'], ['読めない、または検証できない記録は', '**Recovery routing**'],
      ['ペイロードのフィールドが一つでも変わった場合', 'もう一度読み込んでください']], 'checkpoint');
    const readOnly = compactProse(template.split('**Read-only review:**')[1]!.split('{{LEARNINGS_SEARCH}}')[0]!);
    expectMentions(readOnly, [['許可された修正', '**not persisted**'], ['同じ比較を行います']], 'readOnly');
    const recovery = compactProse(readFileSync('plan-eng-review/SKILL.md.tmpl', 'utf8'));
    expectMentions(recovery, [['完全な読み戻し検証を繰り返します'], ['回復手順が指定されていない', '**Blocked outcome**']], 'recovery');
    const dispatch = gate.slice(send, record);
    expect(dispatch).toContain('`AskUserQuestion({ questions: [currentDecision] })`');
    expectMentions(dispatch, [['保留中の記録のチェックポイントを通過した後にのみ'], ['ブリーフの段落を追加または削除したり', '選択肢を作り直したりしないでください'],
      ['承認された文章と自動判断も', '検証済みのブリーフを使います']], 'dispatch');
  });

  test('all four section gates and outside voice distinguish pending choices from findings', () => {
    const reviewSections = template.split('## Review Sections(レビューのセクション。スコープが合意された後)')[1]!;
    const sectionRule = compactProse(reviewSections.split('### 1. アーキテクチャのレビュー')[0]!);
    expect(sectionRule).toContain('Architecture → Code Quality → Tests → Performance');
    const sections = [...reviewSections.matchAll(/^### ([1-4])\.([^]*?)(?=^### [1-4]\.|^\{\{CODEX_PLAN_REVIEW\}\})/gm)];
    expect(sections.map(section => Number(section[1]))).toEqual([1, 2, 3, 4]);
    const tests = sections[2]![2]!.replace('{{TEST_COVERAGE_AUDIT_PLAN}}', () => generateTestCoverageAuditPlan({} as TemplateContext));
    const stop = tests.indexOf('**保留中の各判断について STOP します。**');
    const artifact = tests.indexOf('\n#### Test Plan Artifact');
    const report = tests.indexOf('**Add missing tests to the plan** がテストと評価の決定を解決し');
    expect(0 <= stop && stop < artifact && artifact < report).toBe(true);
    expectMentions(tests.slice(report), [['パフォーマンスのレビューに進みます']], 'tests.slice(report)');
    expect(tests.slice(stop, artifact)).not.toContain('and continue');
    expectMentions(gate.slice(send), [['準備完了の前に', '解決']], 'gate.slice(send)');
    expectMentions(gate, [['残っている未知の点と不確かなリスクを記録します'], ['未解決のリスクと検証は見える状態に保ち'],
      ['ドラフト、推奨案、レビュー担当者の同意も', '承認を与えません']], 'gate');
    expect(template).toContain('{{CODEX_PLAN_REVIEW}}');
    expect(template).toContain('{{PLAN_FILE_REVIEW_REPORT}}');
    expectMentions(compactProse(template), [['要約、省略', '飛ばさないでください']], 'compactProse(template)');
    for (const stale of ['For each issue found in this section',
      'Otherwise, use AskUserQuestion for each finding',
      'Outside voice findings are INFORMATIONAL until the user explicitly approves each one']) {
      expect(template).not.toContain(stale);
    }
  });

  test('every option is recorded against one decision before sending or scoring coverage', () => {
    expect(gate).not.toContain('`label: changes; preserves; pending`');
    const format = gate.split('**一つの選択を比較する。**')[1]!.split('**保留中の記録のチェックポイント。**')[0]!;
    expect(format.length).toBeGreaterThan(0);
    expect(format).not.toContain('per-issue AskUserQuestion');
    expect(template).not.toContain('## CRITICAL RULE — How to ask questions');
    expect(template).not.toContain('issue NUMBER + option LETTER');
    expect(template).not.toContain('Label with NUMBER + LETTER');
  });

  test('scope bootstrap resolves a target without depending on later session routing or decision briefs', () => {
    const skeleton = readFileSync('plan-eng-review/SKILL.md.tmpl', 'utf8');
    const bootstrap = compactProse(skeleton.split('## スコープゲート')[1]!.split('{{PREAMBLE}}')[0]!);
    expectMentions(bootstrap, [['検出ツールやプリアンブルを実行する前に'], ['セッション状態を調べようとしないでください'],
      ['決定ブリーフ、D 番号、完全性、Question Tuning、台帳は使いません'], ['有効化されている MCP の AskUserQuestion', 'ネイティブ'],
      ['最初のツール呼び出しは AskUserQuestion'], ['正確なメニューを送信し、回答を待ちます'],
      ['ユーザーがそれを見た可能性がある', '待ちます'], ['再送はしないでください'], ['メニューをプレーンテキストで送って STOP'],
      ['選択肢は列 0 から始め'], ['ターゲットを推測しないでください'], ['レビュー対象のターゲットは', '変えないでください']], 'bootstrap');
    for (const token of ['`--disallowedTools`', '起動シーケンス', 'Context Recovery']) expect(bootstrap).toContain(token);
    ordered(bootstrap, ['**ユーザー指定のターゲット(プランモード以外):**', '**初期セレクターのアルゴリズム']);
    // A missing or disallowed tool led models to infer a headless session and
    // end the turn with a separate pending report instead of the menu
    // (988e985 slice 5 and three earlier captures). The menu is the one
    // no-transport outcome, whatever the session type.
    expectMentions(bootstrap, [['セッションの種類にかかわらず', '承認することもありません']], 'bootstrap');
    expect(bootstrap).not.toContain('Headless or spawned session');
    expect(bootstrap).not.toContain('Scope pending');
  });

  test('the review record covers code inputs and per-artifact write limits before any decision is saved', () => {
    const policyStart = template.indexOf('## Review record and write policy');
    const policyEnd = template.indexOf('{{LEARNINGS_SEARCH}}', policyStart);
    expect(policyStart).toBeGreaterThan(0);
    expect(policyEnd).toBeGreaterThan(policyStart);
    const policy = template.slice(policyStart, policyEnd);
    const prose = compactProse(policy);
    expect(policyStart).toBeLessThan(template.indexOf('## Decision procedure(決定の手順)'));
    for (const target of ['| プランまたは設計ドキュメント |', '| ブランチの差分 |', '| 特定のファイルまたはディレクトリ |']) expect(policy).toContain(target);
    expect(prose).toContain('**レポートファイル:**');
    expectMentions(prose, [['実装の編集や別のファイルの作成を許可するものではありません'], ['現在の作業プランとこのターゲットの根拠を使ってください'],
      ['作業プラン、指摘事項、決定台帳、最終的な構造化レポートの保存先'], ['台帳への書き込みの前に', '**レポートファイル**を選んでください'],
      ['衝突した場合はサフィックスを付ける'], ['無関係な有効プランに置き換えたり', '黙って差し替えたりしないでください'],
      ['アクティブなプランのみに限定する制限'], ['1 つのパスの許可は、ほかのパスを許可するものではありません'],
      ['実装の編集には明示的な権限が必要です'], ['保存先を求める'], ['回復されなかった書き込みの失敗は、レビューをブロックします']], 'prose');
    for (const command of ['$GSTACK_STATE_ROOT/projects/$SLUG/$BRANCH-eng-review-{YYYYMMDD-HHMMSS}.md', 'gstack-paths', 'gstack-slug']) expect(prose).toContain(command);
    // Discovery paths follow the writers' state root (testing.ts, tasks-section.ts), never a hardcoded home.
    expect(prose).toContain('検出パス `$GSTACK_STATE_ROOT/projects/{slug}/`');
    expect(prose).not.toContain('~/.gstack/projects/{slug}/');
    expect(prose).toContain('**許可された保存の失敗**');
    expect(prose).toContain('**Recovery routing → Repairable write/read failure**');
    const routes = Object.fromEntries(policy.split('\n').filter(line => line.startsWith('| '))
      .map(line => line.split('|').slice(1, -1).map(cells => cells.trim())).map(cells => [cells[0], cells[2]]));
    expect(routes["作業プラン、台帳、完全なレビューレポート"]).toContain('完了テレメトリを出さずに待つ');
    expect(routes["作業プラン、台帳、完全なレビューレポート"]).toContain('**Report-back outcome**');
    for (const auxiliary of ['QA テスト計画とタスク JSONL', 'TODOS.md']) {
      expect(routes[auxiliary]).toContain('**not persisted**');
      expect(routes[auxiliary]).toContain('続行');
    }
    expect(routes['必須のレビューログ']).toContain('このログがなければ最終ゲートは通過できない');
    expect(routes['必須のレビューログ']).toContain('**not persisted** として提示する');
    expect(routes['必須のレビューログ']).toContain('**Report-back outcome** を使う');
    const log = template.split('## レビューログ')[1]!.split('{{REVIEW_DASHBOARD}}')[0]!;
    expectMentions(log, [['読み戻しに成功した後', '完了の手順 3']], 'log');
    expect(log).not.toContain('PLAN MODE EXCEPTION — ALWAYS RUN');
  });

  test('approval readiness follows TODO decisions and finalization returns forward exactly once', () => {
    const closing = template.split('## Required outputs')[1]!.split('### 「スコープ外」セクション')[0]!;
    const finish = [...closing.matchAll(/^([1-6])\. \*\*([^*]+)\*\*/gm)].map(match => [match[1], match[2]]);
    expect(finish).toEqual([['1', 'レビュー本文を準備する。'], ['2', '保存と読み戻し。'], ['3', '保存されたレビューを記録する。'],
      ['4', '公開する。'], ['5', '次の手順(ナビゲーション)を選ぶ。'], ['6', '完了する。']]);
    expectMentions(compactProse(closing), [['Review Readiness Dashboard を表示し', '保存された Completion summary'],
      ['読み取り専用の EXIT PLAN MODE GATE', 'すべてのホストモード'], ['ExitPlanMode はホストがプランモードの場合にのみ'],
      ['**Recovery routing → Late change or missing work**', '次の手順(ナビゲーション)を再開する前に'], ['両方を通過した後にのみ', '成功のテレメトリ'],
      ['回復されなかった保存には', '**Blocked outcome**'], ['保存が禁止されている場合は', '**Report-back outcome**']], 'closing');
    const publication = compactProse(closing.slice(closing.indexOf('3. **保存されたレビューを記録する。**'), closing.indexOf('5. **画面遷移を選ぶ。**')));
    expectMentions(publication, [['必須のログが禁止されている場合は', 'not persisted', '**Report-back outcome**'], ['失敗した場合は、書き込みポリシーの回復に従います']], 'publication');
    ordered(template, ['### TODOS.md の更新', '{{PLAN_REVIEW_APPROVAL_CHECK}}', '## Required outputs',
      '{{PLAN_FILE_REVIEW_REPORT}}', '## レビューログ', '{{REVIEW_DASHBOARD}}', '## 次のステップ — レビューの連鎖',
      '## Learning hooks', '{{BRAIN_WRITE_BACK}}']);
    expect(template.split('{{PLAN_REVIEW_APPROVAL_CHECK}}')).toHaveLength(2);
    expect(template).not.toContain('{{BRAIN_CACHE_REFRESH}}');
    expect(template).not.toContain('Run the preamble\'s **Telemetry');
    expect(closing.match(/エントリポイントのセクションの自己チェック/g)).toHaveLength(1);
    const navigation = compactProse(template.slice(template.indexOf('{{REVIEW_DASHBOARD}}')).split('## Learning hooks')[0]!);
    expectMentions(navigation, [['次のステップの回答は、実装の変更を承認するものではありません'], ['追加したり強めたりせずにコピー'],
      ['独立したすべてのレーンを待たせるわけではありません']], 'navigation');
    const skeleton = readFileSync('plan-eng-review/SKILL.md.tmpl', 'utf8');
    ordered(skeleton, ['{{SECTION:review-sections}}', '## 回復ルーティング', '**保留中の質問:**', '**Blocked outcome:**', '## セクションの自己チェック', '{{EXIT_PLAN_MODE_GATE}}',
      'ゲートを通過した後:', '{{BRAIN_CACHE_REFRESH}}', 'ホストがプランモードにある場合のみ、選択された次のステップのために ExitPlanMode を呼び出します']);
    expect(skeleton).not.toContain('run approval check 0 below');
    const pause = compactProse(skeleton.split('**保留中の質問:**')[1]!.split('**Blocked outcome:**')[0]!);
    expectMentions(pause, [['完了のテレメトリや ExitPlanMode を出さずに']], 'pause');
    const blocked = compactProse(skeleton.split('**Blocked outcome:**')[1]!.split('{{EXIT_PLAN_MODE_GATE}}')[0]!);
    expect(blocked).toContain('`OUTCOME=error` と実際の `ERROR_MESSAGE`/`FAILED_STEP`');
    expectMentions(blocked, [['`BLOCKED`', '不足しているパスや作業'], ['保存されたレビューや完了のクレジットにはなりません'], ['レビューを止め'],
      ['ExitPlanMode は呼び出さないでください'], ['回復ルーティングを使い', '失敗したステップから再開します']], 'blocked');
    const lateChange = compactProse(skeleton.split('**後からの変更や作業の欠落:**')[1]!.split('**Blocked outcome:**')[0]!);
    expectMentions(lateChange, [['新しいまたは再開された選択肢は Decision procedure を使います'], ['Approval readiness を繰り返し', 'Required outputs の手順 1〜4'],
      ['変更されていない保存済みの出力は', '成功したレビューログを再利用']], 'lateChange');
    expectMentions(skeleton.slice(skeleton.indexOf('ゲートを通過した後:')), [['`OUTCOME=success`', '一度実行', 'キャッシュを更新']], 'after gate');
    expectMentions(skeleton, [['検証と終了の間', '作業中のプラン']], 'skeleton');
  });

  // This parses the actual worked example, not model output or a test-only
  // decision oracle. It proves the instructions expose the observed two-axis
  // option pattern; only native evaluation can prove the model follows them.
  test('worked comparison exposes two independently selectable option values', () => {
    const example = rawGate.split('**一つの選択を比較する。**')[1]?.split('**保留中の記録のチェックポイント。**')[0] ?? '';
    expectMentions(example, [['ジッターのみ', '省く', 'まとめて']], 'example');
    const split = example.split('まずジッターについて質問してください:')[1] ?? '';
    const separated = [...split.matchAll(/^\| (R[12] [^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)]
      .map(([, commitment, current, A, B]) => ({ commitment, current, A, B }));
    expect(separated).toEqual([
      { commitment: 'R1 ジッター', current: '未指定、保留中', A: 'on', B: 'off' },
      { commitment: 'R2 遅延の上限', current: '未指定、保留中', A: '未指定、保留中', B: '未指定、保留中' },
    ]);
    expectMentions(gate.slice(record), [['確定した値は固定したまま'], ['再度質問せずに']], 'gate.slice(record)');
  });

  test('every host resolves the Eng gate without the conflicting generic shortcut clause', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const clause = generateAntiShortcutClause({ skillName: 'plan-eng-review', host: host.name } as TemplateContext);
      expectMentions(clause, [['4 つのセクションすべてと outside voice', '決定ゲート'], ['指摘と証拠は残します'],
        ['質問は新規または再開された選択についてのみ'], ['未承認の改善策を先に書き込んだり', 'セクションや最終レポートを省略したりしてはいけません']], 'clause');
      expect(clause).not.toContain('ANY non-trivial finding');
    }
  });
});

// These checks cover generated instructions, not native model compliance.
describe('outside-voice commitment queue', () => {
  test('Eng selects the other provider and preserves explicit native fallback on every host', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const eng = generateCodexPlanReview({ host: host.name, paths: HOST_PATHS[host.name]!, skillName: 'plan-eng-review' } as TemplateContext);
      const provider = host.name === 'codex' ? 'Claude Code' : 'Codex';
      const mismatch = 'under_current_harness';
      // B1: the heading also admits `unverified`.
      expect(eng).toContain('**`CODEX_MODE: ready`(または `unverified`)の場合');
      expect(eng).toContain(`— ${provider} を実行します:**`);
      const fallback = compactProse(eng.slice(eng.indexOf('**Native fallback —'), eng.indexOf('**Bounded outside-voice wait')));
      const routing = eng.slice(eng.indexOf('**Outcome routing:**'), eng.indexOf('**disabled は、このセクションの終端の分岐です'));
      const preflight = eng.match(/```bash\n([\s\S]*?)\n```/)![1];
      expect(preflight).toContain(mismatch);
      expectMentions(routing, [['ほかのプリフライトのモード', 'ハーネスの不一致', 'Native fallback を使います'],
        ['外部の実行または出力の検証が失敗', 'Native fallback を使います']], 'routing');
      const bounded = eng.slice(eng.indexOf('**Bounded outside-voice wait'), eng.indexOf('**Cross-model tension(モデル間の緊張関係):**'));
      expectMentions(bounded, [['ネイティブの結果が外部カバレッジを補うことはありません']], 'bounded');
      expectMentions(eng, [['SOURCE=in-host', 'OUTSIDE_STATUS=unavailable', 'clean', 'issues_found'], ['これらの所見は', 'レビュアーのものです']], 'eng');
      expectMentions(fallback, [['disabled', '代替は行いません']], 'fallback');
      if (host.name === 'codex') {
        expect(eng).toContain('gstack-claude-code');
        expect(eng).not.toContain('codex exec');
      } else {
        expect(eng).toContain('codex exec');
        expect(eng).toContain('_CODEX_OUT=$("$_CODEX_PROBE" role-ready exec) || exit $?');
      }
    }
  });

  const skills = ['plan-ceo-review', 'plan-eng-review', 'plan-devex-review'];
  for (const host of ALL_HOST_CONFIGS) {
    test(`${host.name}: separates changed commitments and preserves scope revision choices`, () => {
      for (const skillName of skills) {
        const tmplPath = `${skillName}/sections/review-sections.md.tmpl`;
        expect(readFileSync(tmplPath, 'utf8')).toContain('{{CODEX_PLAN_REVIEW}}');
        const generated = generateCodexPlanReview({ skillName, tmplPath, host: host.name, paths: HOST_PATHS[host.name]! });
        const start = generated.indexOf(skillName === 'plan-ceo-review'
          ? '**Integrate reviewer findings(レビュアーの指摘の統合):**' : '**Cross-model tension(モデル間の緊張関係):**');
        const end = generated.indexOf('**Persist the result(結果の保存):**', start);
        expect(start).toBeGreaterThan(0);
        expect(end).toBeGreaterThan(start);
        const queue = generated.slice(start, end);
        // Each review reuses its own gate; none falls back to a generic commitment table.
        expect(queue).not.toContain('reference | commitment | current value');
        expect(queue).toContain('**Whole-candidate scope:** A) Include、B) Defer、C) Cut、D) Hold');
        expectMentions(compactProse(queue), [['2 つの候補を見直す場合は 2 行'], ['Hold', '以前の扱いを変えずに議論のために止めます'],
          ['組み上がった集合の容量と依存関係'], ['影響を受ける候補の Include/Defer/Cut/Hold の行に戻ります'],
          ['未解決の矛盾を報告'], ['ほかの候補を黙って削ったり置き換えたりしてはいけません']], 'queue');
        if (skillName !== 'plan-devex-review') {
          expect(queue).toContain('A) この変更を適用する、B) この行の現在の値を維持する、C) 選ぶ前に調査する、D) この提案された変更だけを先送りする');
          expectMentions(queue, [['D は、この提案の行を未解決のままにします'], ['それらを変える前には別途質問します']], 'queue');
        }
        if (skillName === 'plan-ceo-review') {
          expectMentions(queue, [['同じ 6 列の台帳'], ['新規または再オープンされた選択には 0D を使い'], ['2 つ目の手順を始めてはいけません'],
            ['元の入力、確認したソース、正確な承認'], ['承認された振る舞いを変えずに、誤った前提を訂正します'],
            ['不確実性は、その担当者と必要な検証とともに保持します'], ['信頼できる重大なリスクは、確認の前に対応が必要になることがあります'],
            ['独立した選択', '0D のルール'], ['調査と先送りは、実装を認可するものではありません'],
            ['チャレンジは最終ゲートまで待ちます'], ['1 つの回答が、他の保留中の行を解決することはありません'],
            ['事実の訂正だけで済んだ所見']], 'queue');
          const skeleton = compactProse(readFileSync('plan-ceo-review/SKILL.md.tmpl', 'utf8'));
          // Delegation must resolve to the complete procedure, including the
          // saved comparison and separate actual answer, without duplicating it.
          ordered(skeleton, ['**1. 情報源と過去の回答を確認する。**', '**2. 保留中の選択を記録する。**',
            '比較の前に保留中の行を記録してください', '**3. その行の選択肢を比較して保存する。**',
            '**質問前のチェックポイント:**', '**4. 質問し、回答を記録し、修正する。**']);
          expect(skeleton).toContain('`D<N> — <ROW-ID>: <一行の質問>`');
          expectMentions(skeleton, [['1 回の呼び出しで 1 行だけ尋ね'], ['検証済みのフィールドと文字通り比較'], ['ROW-ID は保留中の選択を特定します'],
            ['回答への参照とスコープ', '保存し'], ['許可された作業だけを修正してください']], 'skeleton');
          continue;
        }
        if (skillName === 'plan-eng-review') {
          expectMentions(queue, [['外部の所見はすべて', '同じ Decision procedure'], ['レビュアーと証拠を記録します'],
            ['レビュアー間の一致は証拠であって承認ではありません'], ['新規または再オープンされた選択には', 'それぞれ独自の回答が必要です'],
            ['4 択のメニュー', '通常の 2〜3 個'], ['独立して回答できる変更を 1 つ特定してから', '代替案を組み立て'],
            ['必要なコード、テスト、ドキュメント', 'まとめて扱います'],
            ['ある行への回答が', '他の保留中の行を解決することはありません'], ['チャレンジは、その最終ゲートまで待ちます']], 'queue');
          continue;
        }
        ordered(queue, ['1. **証拠を裏付ける。**', '2. **所見を分類する。**',
          '3. **スコープを確認する。**', '4. **1 つの判断を起案して回答を得る。**',
          'AskUserQuestion を使い', '実際の回答を待ちます', '限定的な Edit で反映します']);
        expect(queue).toContain('この提案された変更だけを先送りする');
        expectMentions(queue, [['ほかのすべての値は、すべての選択肢で固定または保留'], ['独立して選べる変更は分割します'],
          ['その候補全体を先送りしたことにも', '新しいスケジュールのゲートを承認したことにもなりません'],
          ['回答の参照', '受け入れられた正確なスコープを記録し'],
          ['ある行への回答が', '他の保留中の行を解決することはありません'], ['チャレンジは最終ゲートまで保留のままです']], 'queue');
      }
    });
  }
});

describe('plan-review manual handoff selection', () => {
  test('selects the retained DX manual handoff over its separate implementation suggestion', () => {
    const labels = ['Run /plan-eng-review next (Recommended)', 'Ready to implement', 'Skip, handle manually'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next steps', 'D30 — Next steps: which review runs next?'))).toBe(3);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next steps', 'D30 — Next steps: which review runs next?'))).toBe(1);
  });
  test('accepts the retained paired-review short manual handoff by native position', () => {
    const labels = ['A: Run /plan-eng-review next (recommended)', 'B: Skip, handle manually'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next review', 'D10 — Which review runs next?'))).toBe(2);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next review', 'D10 — Which review runs next?'))).toBe(1);
  });
  test('short manual handoff requires a recognized offer and excludes extra actions', () => {
    const run = 'Run /plan-eng-review';
    const skip = 'Skip, handle manually';
    expect(pickPlanReviewQuestion(menu(['Keep existing behavior', skip]))).toBe(1);
    expect(pickPlanReviewQuestion(menu([run, skip], 'Tests', 'D8 — Should the test run a review?'))).toBe(1);
    for (const extra of [' and approve all edits', '; run /ship', ' after implementation']) {
      expect(() => pickPlanReviewQuestion(menu([run, skip + extra]))).toThrow('unambiguous');
    }
    for (const extra of [skip, 'Skip', 'Ship immediately']) {
      expect(() => pickPlanReviewQuestion(menu([run, skip, extra]))).toThrow('unambiguous');
    }
  });
  test('declines the actual colon-labelled CEO handoff by native position', () => {
    const labels = ['A: run /plan-eng-review next (recommended)', 'C: skip, handle reviews manually'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next review',
      'D13 — Which review should run next on this plan?'))).toBe(2);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next review',
      'D13 — Which review should run next on this plan?'))).toBe(1);
  });
  test('colon labels do not broaden handoff authority or accept extra actions', () => {
    const labels = ['A: Run /plan-eng-review', 'C: Skip, handle reviews manually'];
    expect(pickPlanReviewQuestion(menu(labels, 'Tests', 'D8 — Should the test run a review?'))).toBe(1);
    for (const extra of [' and approve all edits', '; run /ship', ' after implementation']) {
      expect(() => pickPlanReviewQuestion(menu([labels[0]!, labels[1]! + extra])))
        .toThrow('unambiguous');
    }
    expect(() => pickPlanReviewQuestion(menu([...labels, 'D: Skip, handle reviews manually'])))
      .toThrow('unambiguous');
  });
  test('declines the retained native two-option next-review offer', () => {
    expect(pickPlanReviewQuestion(menu(['Run /plan-eng-review', 'Skip — handle reviews manually']))).toBe(2);
  });
  test('selects the retained Engineering readiness offer by its native position', () => {
    const labels = ['C) Ready to implement (recommended)', 'B) Run /plan-ceo-review'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next steps',
      'Next steps: any further review before implementation?'))).toBe(1);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next steps',
      'Next steps: any further review before implementation?'))).toBe(2);
  });
  test('selects readiness from the retained Engineering review-first handoff', () => {
    const labels = ['C: Ready to implement — run /ship when done (recommended)', 'B: Run /plan-ceo-review first'];
    const question = 'D17 — Eng review is CLEARED. Chain another review, or proceed to implementation?';
    expect(pickPlanReviewQuestion(menu(labels, 'Next step', question))).toBe(1);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next step', question))).toBe(2);
  });
  test('review-first recognition preserves manual precedence and question context', () => {
    const labels = ['Run /plan-ceo-review first (recommended)', 'Ready to implement', 'Skip — handle reviews manually'];
    expect(pickPlanReviewQuestion(menu(labels))).toBe(3);
    expect(pickPlanReviewQuestion(menu(labels.toReversed()))).toBe(1);
    expect(pickPlanReviewQuestion(menu(labels, 'Tests', 'D4 — Should this test run a review?'))).toBe(1);
  });
  test.each([
    'Run /plan-ceo-review firstly',
    'Run /plan-ceo-review first next',
    'Run /plan-ceo-review first and approve all edits',
    'Run /plan-ceo-review first; run /ship',
    'Run /plan-unknown-review first',
    'Run /design-shotgun first',
  ])('review-first handoffs reject unknown or extended run labels: %s', label => {
    expect(() => pickPlanReviewQuestion(menu([label, 'Ready to implement — run /ship when done'])))
      .toThrow('unambiguous');
  });
  test.each([
    ['Run /plan-ceo-review', 'Ready to implement now'],
    ['Run /plan-ceo-review', 'Ready to implement and approve all edits'],
    ['Run /plan-ceo-review', 'Ready to implement; run /ship'],
    ['Ready to implement', 'Ready to implement — run /ship when done'],
  ])('rejects added execution authority or ambiguous readiness: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(labels))).toThrow('unambiguous');
  });
  test('selects the source-prescribed manual choice after both applicable reviews', () => {
    expect(pickPlanReviewQuestion(menu([
      'A) Run /plan-eng-review next (required gate) (Recommended)',
      'B) Run /plan-design-review next', "C) Skip — I'll handle reviews manually",
    ]))).toBe(3);
  });
  test('recognizes a full next-step brief without depending on its D ordinal', () => {
    expect(pickPlanReviewQuestion(menu(['Run /plan-eng-review', 'Skip – I’ll handle reviews manually'],
      'Handoff', "D24 — What's next?\nProject: payment review\nRecommendation: A"))).toBe(2);
  });
  test.each([
    ['ceo', 3], ['design', 5], ['devex', 4], ['eng', 3],
  ] as const)('supports every current %s review source handoff option', (skill, selected) => {
    const source = readFileSync(`plan-${skill}-review/sections/review-sections.md.tmpl`, 'utf8');
    // The Japanese sources translate these headings (the devex one uses a different final word).
    const heading = skill === 'eng' ? '## 次のステップ — レビューの連鎖'
      : skill === 'devex' ? '## 次のステップ — レビューの連鎖' : '## 次のステップ — レビューの連鎖';
    const handoff = source.split(heading)[1]?.split('\n## ')[0] ?? '';
    const sourceLabels = [...handoff.matchAll(/^- \*\*([A-E]\))(?:\*\* (.+)| ([^*]+)\*\*)/gm)]
      .map(match => ({ letter: match[1]!, text: (match[2] ?? match[3]!).replace(/:$/, '') }));
    expect(sourceLabels).toHaveLength(selected);
    // pickPlanReviewQuestion recognises the English labels a native question carries; map each
    // Japanese source option onto the label of the same kind (run / ready to implement / skip).
    const kind = (text: string) => /スキップ/.test(text) ? 'Skip — handle reviews manually'
      : /実装の準備完了/.test(text) ? (/devex-review/.test(text) ? 'Ready to implement, run /devex-review after shipping' : 'Ready to implement — run /ship when done')
      : `Run ${text.match(/\/(?:plan-(?:ceo|eng|design|devex)-review|design-shotgun|design-html)/)?.[0] ?? text}`;
    const labels = sourceLabels.map(({ letter, text }) => `${letter} ${kind(text)}`);
    expect(pickPlanReviewQuestion(menu(labels, 'Next steps'))).toBe(selected);
    // Native dialogs allow at most four choices. Each applicable source subset
    // keeps its explicit non-running handoff; no absent choice is fabricated.
    for (let i = 0; i < selected - 1; i++) {
      expect(pickPlanReviewQuestion(menu([labels[i]!, labels[selected - 1]!]))).toBe(2);
    }
  });
  test('manual handoff takes precedence over a separate future implementation suggestion', () => {
    expect(pickPlanReviewQuestion(menu([
      'Run /plan-eng-review', 'Ready to implement, run /devex-review after shipping',
      "Skip, I'll handle next steps manually",
    ]))).toBe(3);
  });
  test('does not change ordinary findings, TODOs, mode choice, or prerequisite answers', () => {
    for (const header of ['Security', 'TODO', 'Mode', 'Office hours']) {
      expect(pickPlanReviewQuestion(menu(['Keep the current design', 'Skip — handle reviews manually'], header, 'D4 — Decide this issue'))).toBe(1);
    }
  });
  test('does not elect a skip from an unrelated question mentioning review commands', () => {
    expect(pickPlanReviewQuestion(menu(['Run /plan-eng-review', 'Skip — handle reviews manually'],
      'Tests', 'D8 — Should the regression test run the /plan-eng-review command?'))).toBe(1);
  });
  test.each([
    ['Run /plan-eng-review', 'Skip this review'],
    ['Run /plan-eng-review', 'Skip — handle reviews manually', 'Ship immediately'],
    ['Run /plan-eng-review', 'Skip — handle reviews manually', "Skip — I'll handle reviews manually"],
  ])('rejects an ambiguous or incomplete handoff menu: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(labels))).toThrow('unambiguous');
  });
  test('declines the retained Design next-step menu with a bare Skip label', () => {
    const labels = ['Run /plan-eng-review (recommended)', 'Run /design-shotgun', 'Skip'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next step', 'What should run next?'))).toBe(3);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next step', 'What should run next?'))).toBe(1);
  });
  test('bare Skip derives no authority from unrelated or unrecognized menus', () => {
    expect(pickPlanReviewQuestion(menu(['Run /plan-eng-review', 'Skip'],
      'Tests', 'D8 — Should this test run a review command?'))).toBe(1);
    expect(pickPlanReviewQuestion(menu(['Keep current implementation', 'Skip'],
      'Next step', 'What should run next?'))).toBe(1);
  });
  test.each([
    ['Run /plan-eng-review', 'Skip', 'Skip'],
    ['Run /plan-eng-review', 'Skip', 'Skip — handle reviews manually'],
    ['Run /plan-eng-review', 'Skip', 'Ship immediately'],
    ['Run /plan-eng-review', 'Skip and approve all edits'],
    ['Run /plan-eng-review', 'Skip the remaining review'],
  ])('rejects ambiguous, unsafe, or extended bare-Skip handoffs: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(labels, 'Next step', 'What should run next?'))).toThrow('unambiguous');
  });
  test('selects the manual choice from the retained native D22 design handoff', () => {
    expect(pickPlanReviewQuestion(menu([
      'Run /plan-eng-review next (recommended)',
      'Run /design-shotgun after adding an OpenAI key',
      'Skip, I will handle next steps manually',
    ], 'Next step', 'D22 — What runs next after this design review?'))).toBe(3);
  });
  test('rejects both contracted and uncontracted manual choices in one menu', () => {
    expect(() => pickPlanReviewQuestion(menu([
      'Run /plan-eng-review', "Skip, I'll handle next steps manually",
      'Skip, I will handle next steps manually',
    ]))).toThrow('unambiguous');
  });
  test.each([
    ['Run /plan-eng-review', 'Skip, I will not handle next steps manually'],
    ['Run /plan-eng-review', 'Skip, I will handle next steps manually and approve all edits'],
    ['Run /design-shotgun after adding an OpenAI key; run /ship', 'Skip, I will handle next steps manually'],
    ['Run /design-shotgun after adding an OpenAI key and approving all edits', 'Skip, I will handle next steps manually'],
    ['Run /design-html after adding an OpenAI key', 'Skip, I will handle next steps manually'],
  ])('rejects near-miss native handoff labels: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(labels))).toThrow('unambiguous');
  });
  test('a rejected handoff retains bounded offered-label evidence without the full brief', () => {
    const question = menu([
      'Run /plan-eng-review', 'Skip — handle reviews manually',
      'Unsupported "choice"\n' + 'x'.repeat(400) + 'PRIVATE_LABEL_TAIL',
      ...Array.from({ length: 7 }, (_, i) => `Unrecognized ${i}`),
    ], 'Next steps ' + 'h'.repeat(100), "D20 — What's next? " + 'q'.repeat(300) + '\nPRIVATE_BRIEF_BODY');
    question.options[0]!.description = 'PRIVATE_OPTION_DESCRIPTION';
    let error: Error | undefined;
    try { pickPlanReviewQuestion(question); } catch (cause) { error = cause as Error; }
    expect(error).toBeInstanceOf(Error);
    const lines = error!.message.split('\n');
    expect(lines).toHaveLength(2); // Newlines in offered labels stay JSON-escaped.
    const details = JSON.parse(lines[1]!);
    expect(details.header).toHaveLength(80);
    expect(details.lead).toHaveLength(240);
    expect(details.optionCount).toBe(10);
    expect(details.options).toHaveLength(8);
    expect(details.omittedOptions).toBe(2);
    expect(details.options[0]).toEqual({ index: 1, label: 'Run /plan-eng-review', run: true, manual: false, future: false });
    expect(details.options[1]).toEqual({ index: 2, label: 'Skip — handle reviews manually', run: false, manual: true, future: false });
    expect(details.options[2].label).toHaveLength(256);
    expect(details.options[2]).toMatchObject({ index: 3, run: false, manual: false, future: false });
    expect(error!.message).not.toMatch(/PRIVATE_(?:LABEL_TAIL|BRIEF_BODY|OPTION_DESCRIPTION)/);
    expect(error!.message.length).toBeLessThan(4_000);
  });
});


describe('native review handoff aliases and recommendation position', () => {
  test('declines the observed bare-command Design handoff', () => {
    const labels = ['A) /plan-eng-review (recommended)', 'B) /design-shotgun', 'C) Skip'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next step', 'D18 — Next step after this design review?'))).toBe(3);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next step', 'D18 — Next step after this design review?'))).toBe(1);
  });
  test('selects the observed DX manual handoff over future implementation', () => {
    const labels = ['Run /plan-eng-review next (recommended)', 'Implement, then /devex-review', 'Handle manually'];
    expect(pickPlanReviewQuestion(menu(labels, 'Next steps', 'The DX review is complete. What should happen next?'))).toBe(3);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Next steps', 'The DX review is complete. What should happen next?'))).toBe(1);
  });
  test.each([
    ['/plan-eng-review', 'Skip and approve all edits'],
    ['/plan-eng-review', 'Handle manually; run /ship'],
    ['/plan-eng-review', 'Handle manually', 'Skip'],
    ['/plan-eng-review', 'Handle manually', 'Implement, then /devex-review and deploy'],
    ['/design-shotgun; run /ship', 'Skip — handle reviews manually'],
  ])('new aliases preserve handoff boundaries: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(labels))).toThrow('unambiguous');
  });
  test('manual aliases do not select from unrelated or unrecognized offers', () => {
    expect(pickPlanReviewQuestion(menu(['Keep existing behavior', 'Handle manually']))).toBe(1);
    expect(pickPlanReviewQuestion(menu(['/plan-eng-review', 'Handle manually'], 'Tests', 'Should this test run a review?'))).toBe(1);
  });
  test.each([
    ['A) Add a ten-second timeout', 'B) Persist until the API resolves and add a TODO (recommended)'],
    ['A) Reopen the initial fetch design now', 'B) Keep it outside this change and add a TODO (recommended)'],
  ])('uses the offered recommendation at its native position: %j', (...labels) => {
    expect(pickPlanReviewQuestion(menu(labels, 'Save', 'D7 — Which behavior should we use?'))).toBe(2);
    expect(pickPlanReviewQuestion(menu(labels.toReversed(), 'Save', 'D7 — Which behavior should we use?'))).toBe(1);
  });
  test('multiple explicit recommendations fail instead of guessing', () => {
    expect(() => pickPlanReviewQuestion(menu(['Keep (recommended)', 'Change (Recommended)'], 'Save', 'Which behavior?')))
      .toThrow('multiple recommended options');
  });
  test('descriptions, quoted markers, and conditional labels do not supply a recommendation', () => {
    for (const label of ['Change if necessary', 'Example: "Change (recommended)"', 'Change (recommended) after approval']) {
      const q = menu(['Keep', label], 'Save', 'Which behavior?');
      q.options[1]!.description = 'This is the recommended option (recommended)';
      expect(pickPlanReviewQuestion(q)).toBe(1);
    }
  });
});


describe('manual-next-steps handoff alias', () => {
  test('declines the exact retained Design menu in either native order', () => {
    const question: NativeQuestion = {
  "header": "Next step",
  "multiSelect": false,
  "options": [
    {
      "description": "Required shipping gate; validates the interaction specs this review added.",
      "label": "A) Run /plan-eng-review (recommended)"
    },
    {
      "description": "Exit plan mode with the design-reviewed plan; no further review now.",
      "label": "E) Skip, manual next steps"
    }
  ],
  "question": "D12 — What should run next?\nProject/branch/task: main — Settings redesign plan is design-complete (5/10 → 9/10, 7 decisions, 0 unresolved).\nELI10: The design review is done and written into the plan. Before anyone builds it, gstack's shipping gate wants an engineering review of the same plan: it checks that the token scoping, the aria-disabled click guard, the min-width lock, and the 14px audit are technically sound and testable. A CEO review is not warranted: the plan's product direction was never in question. Design exploration skills need a keyed designer, which this environment lacks.\nStakes if we pick wrong: skipping eng review means /ship will report NOT CLEARED later; running it now costs one more review pass.\nRecommendation: A because eng review is the only review that gates shipping, and this design review added interaction specs (busy-button semantics, token ownership) that need an architectural check.\nNote: options differ in kind, not coverage — no completeness score.\nPros / cons:\nA) Run /plan-eng-review next (recommended)\n  ✅ Clears the required gate while the seven decisions are fresh in the plan\n  ✅ Validates aria-disabled guard, min-width lock, and Settings-scoped token ownership\n  ❌ One more interactive review session before implementation begins\nE) Skip, handle next steps manually\n  ✅ Start implementing T1-T7 immediately from the plan\n  ✅ No further review questions today\n  ❌ /ship will report NOT CLEARED until an eng review runs\nNet: clear the gate now or defer it to ship time."
};
    expect(pickPlanReviewQuestion(question)).toBe(2);
    expect(pickPlanReviewQuestion({ ...question, options: question.options.toReversed() })).toBe(1);
  });
  test('keeps manual preference and requires recognized next-review context', () => {
    const skip = 'E) Skip, manual next steps';
    expect(pickPlanReviewQuestion(menu(['Run /plan-eng-review', 'Ready to implement', skip], 'Next step', 'What should run next?'))).toBe(3);
    expect(pickPlanReviewQuestion(menu(['Keep existing behavior', skip], 'Next step', 'What should run next?'))).toBe(1);
    expect(pickPlanReviewQuestion(menu(['Run /plan-eng-review (recommended)', skip], 'Tests', 'D8 — Should this test run a review?'))).toBe(1);
  });
  test.each([
    'Skip, automated next steps',
    'Skip, manual next steps and approve all edits',
    'Skip, manual next steps; run /ship',
    'Skip, manual next steps after implementation',
    'Skip, manual next steps (automatically)',
    'Skip, manual next steps then deploy',
  ])('rejects an automation or extended lookalike: %s', (label) => {
    expect(() => pickPlanReviewQuestion(menu(['Run /plan-eng-review', label], 'Next step', 'What should run next?'))).toThrow('unambiguous');
  });
  test.each([
    ['Skip, manual next steps', 'Skip, manual next steps'],
    ['Skip, manual next steps', 'Handle manually'],
    ['Skip, manual next steps', 'Ship immediately'],
  ])('keeps ambiguous or unsafe menus refused: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(['Run /plan-eng-review', ...labels], 'Next step', 'What should run next?'))).toThrow('unambiguous');
  });
});


describe('DX implement-now future handoff alias', () => {
  test('declines the exact retained DX future-alias menu in either native order', () => {
    const question: NativeQuestion = {
  "header": "Next review",
  "multiSelect": false,
  "options": [
    {
      "description": "Architecture and test review of the amended plan; clears the required ship gate.",
      "label": "Run /plan-eng-review next (recommended)"
    },
    {
      "description": "Start on T1-T9; measure real TTHW with the boomerang after shipping.",
      "label": "Implement now, /devex-review after"
    },
    {
      "description": "End here; no next review scheduled.",
      "label": "Skip, handle manually"
    }
  ],
  "question": "D17 — DX review complete. Which review runs next?\nProject/branch/task: main branch; eval-sdk public beta plan, DX review CLEAR (7/10 → 8/10), 16 decisions logged, zero unresolved.\nELI10: This review changed the plan in ways that touch code: the first-run gate is decoupled in two entrypoints, a new explicit conformance command appears, and five release checks are added. Those are architecture and test decisions, and Eng Review is the one gate that must be clear before shipping. The dashboard shows Eng Review at zero runs, so the verdict is NOT CLEARED. No end-user UI is in scope, so Design Review does not apply. After implementation, /devex-review on the shipped beta is the boomerang that measures whether the 5-minute target held in reality.\nStakes if we pick wrong: skip Eng Review and the gate decoupling ships without an architecture pass on state handling and release-check design; run it and the plan gets validated where the DX changes are riskiest.\nRecommendation: A because the DX changes T1, T2, and T6 are code and test changes that Eng Review exists to validate, and the ship gate requires it anyway.\nNote: options differ in kind, not coverage — no completeness score.\nPros / cons:\nA) Run /plan-eng-review next (required gate) (recommended)\n  ✅ Validates the gate decoupling, conformance command, and release-check design before any code is written (human: ~30 min / CC: ~10 min)\n  ✅ Clears the only review the ship dashboard requires\n  ❌ Adds a review cycle before implementation starts\nB) Ready to implement; run /devex-review after shipping\n  ✅ Fastest path to code; nine tasks are already specified with verification steps\n  ✅ The post-ship boomerang still measures the real TTHW against the 5-minute target\n  ❌ Ship dashboard stays NOT CLEARED until Eng Review runs on the diff instead of the plan\nC) Skip, I'll handle next steps manually\n  ✅ You keep full control of sequencing\n  ✅ Nothing else runs automatically\n  ❌ No review is scheduled; the required gate is still open\nNet: A clears the required gate on the plan; B defers it to the diff; C leaves it to you."
};
    expect(pickPlanReviewQuestion(question)).toBe(3);
    expect(pickPlanReviewQuestion({ ...question, options: question.options.toReversed() })).toBe(1);
  });
  test('selects the exact future alias only within a recognized handoff', () => {
    const labels = ['Run /plan-eng-review next (recommended)', 'Implement now, /devex-review after'];
    expect(pickPlanReviewQuestion(menu(labels))).toBe(2);
    expect(pickPlanReviewQuestion(menu(labels.toReversed()))).toBe(1);
    expect(pickPlanReviewQuestion(menu(labels, 'Tests', 'Which test behavior?'))).toBe(1);
    expect(() => pickPlanReviewQuestion(menu(['Ready to implement', labels[1]!]))).toThrow('unambiguous');
  });
  test.each([
    'Implement now, /devex-review after and approve all edits',
    'Implement now, /devex-review after; run /ship',
    'Implement now, /devex-review after and deploy',
    'Implement now, /plan-eng-review after',
    'Implement now, /devex-review',
    'Implement later, /devex-review after',
  ])('rejects an extended or different future alias: %s', (label) => {
    expect(() => pickPlanReviewQuestion(menu(['Run /plan-eng-review next', label, 'Skip, handle manually']))).toThrow('unambiguous');
  });
  test.each([
    ['Implement now, /devex-review after', 'Ready to implement'],
    ['Implement now, /devex-review after', 'Implement now, /devex-review after'],
    ['Implement now, /devex-review after', 'Skip, handle manually', 'Handle manually'],
    ['Implement now, /devex-review after', 'Skip, handle manually; run /ship'],
  ])('keeps ambiguous or unsafe future-alias menus refused: %j', (...labels) => {
    expect(() => pickPlanReviewQuestion(menu(['Run /plan-eng-review', ...labels]))).toThrow('unambiguous');
  });
});


describe('DX future handoff punctuation', () => {
  const future = 'Ready to implement; run /devex-review after shipping';
  const run = 'Run /plan-eng-review next (required gate) (recommended)';
  const manual = "Skip, I'll handle next steps manually";
  // Exact retained D13 header, first line and labels: fd620d native question
  // toolu_01YLyQ6Zw1mDmhPXs3G1peaK, diagnostic session028cd11a-a8fe-46ba-99c6-e348835678f4.
  // The picker reads only these fields; the full public brief/ID stays in the repair receipt.
  const captured = menu([
    'Run /plan-eng-review next (recommended)',
    'Ready to implement; /devex-review after shipping',
    "Skip, I'll handle next steps manually",
  ], 'Next step', 'D13 — What should happen next after this DX review?');
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  test('replays the captured DX future handoff without a redundant run verb in every option order', () => {
    for (const order of orders) {
      const question = { ...captured, options: order.map(index => captured.options[index]!) };
      expect(pickPlanReviewQuestion(question)).toBe(order.indexOf(2) + 1);
    }
  });
  test('accepts optional run with comma or semicolon while preserving manual priority', () => {
    for (const separator of [',', ';']) for (const verb of ['', 'run ']) {
      const label = `Ready to implement${separator} ${verb}/devex-review after shipping`;
      const labels = [run, label, manual];
      for (const order of orders) {
        expect(pickPlanReviewQuestion(menu(order.map(index => labels[index]!)))).toBe(order.indexOf(2) + 1);
      }
      expect(pickPlanReviewQuestion(menu([run, label]))).toBe(2);
      expect(pickPlanReviewQuestion(menu([label, run]))).toBe(1);
    }
  });
  test('optional run does not admit changed targets, timing, negation or extra actions', () => {
    for (const label of [
      'Ready to implement; /plan-devex-review after shipping',
      'Ready to implement; /devex-review before shipping',
      'Ready to implement; /devex-review after implementation',
      'Ready to implement; /devex-review now',
      'Ready to implement; do not run /devex-review after shipping',
      'Not ready to implement; /devex-review after shipping',
      'Ready to implement; /devex-review not after shipping',
      'Ready to implement; /devex-review after shipping and approve all edits',
      'Ready to implement; /devex-review after shipping; run /ship',
      'Ready to implement; /devex-review after shipping\nrun /ship',
      'Ready to implement:: /devex-review after shipping',
    ]) expect(() => pickPlanReviewQuestion(menu([run, label, manual]))).toThrow('unambiguous');
  });
  test('the captured future label retains context, duplicate and whole-menu refusal', () => {
    const label = captured.options[1]!.label;
    expect(pickPlanReviewQuestion(menu([run, label, manual], 'Tests',
      'D8 — Which regression should cover this label?\nNext step: handle manually.'))).toBe(1);
    for (const extra of [manual, 'Handle manually', 'Ship immediately', '/unknown-review']) {
      expect(() => pickPlanReviewQuestion(menu([run, label, manual, extra]))).toThrow('unambiguous');
    }
    expect(() => pickPlanReviewQuestion(menu([run, label, label]))).toThrow('unambiguous');
    expect(() => pickPlanReviewQuestion(menu([run, label, future]))).toThrow('unambiguous');
  });
  test('accepts the native semicolon menu while choosing the offered manual handoff', () => {
    expect(pickPlanReviewQuestion(menu([run, future, manual], 'Next review',
      'D22 — Which review should run next on this plan?'))).toBe(3);
    expect(pickPlanReviewQuestion(menu([manual, future, run]))).toBe(1);
    expect(pickPlanReviewQuestion(menu([run, future]))).toBe(2);
    expect(pickPlanReviewQuestion(menu([future, run]))).toBe(1);
  });
  test('keeps the context, unique-choice, and exact-action boundaries', () => {
    expect(pickPlanReviewQuestion(menu([run, future, manual], 'Tests', 'Choose test coverage'))).toBe(1);
    for (const suffix of [' and approve all edits', '; run /ship', ' then deploy', ' now']) {
      expect(() => pickPlanReviewQuestion(menu([run, future + suffix, manual]))).toThrow('unambiguous');
    }
    expect(() => pickPlanReviewQuestion(menu([run, future, future]))).toThrow('unambiguous');
    expect(() => pickPlanReviewQuestion(menu([run, future, manual, 'Ship immediately']))).toThrow('unambiguous');
  });
});


describe('manual handoff punctuation', () => {
  const run = 'A) Run /plan-eng-review next (recommended)';
  const manual = "C) Skip: I'll handle reviews manually";

  test('selects the exact retained paired menu by offered index, not its letter', () => {
    const question = menu([run, manual], 'Next review',
      'Next step: run /plan-eng-review on this plan now?');
    expect(pickPlanReviewQuestion(question)).toBe(2);
    expect(pickPlanReviewQuestion({ ...question, options: question.options.toReversed() })).toBe(1);
  });

  test.each([',', ':', ';', '.', '—', '–', '-'])('accepts the finite manual-action grammar with separator %s', separator => {
    for (const action of ["I'll handle reviews manually", 'I’ll handle next steps manually',
      'I will handle reviews manually', 'handle next steps manually', 'handle manually']) {
      const label = `C) Skip ${separator} ${action}`;
      expect(pickPlanReviewQuestion(menu([run, 'Ready to implement', label]))).toBe(3);
      expect(pickPlanReviewQuestion(menu([label, 'Ready to implement', run]))).toBe(1);
    }
  });

  test('retains handoff context and the short-form recognized-offer requirement', () => {
    expect(pickPlanReviewQuestion(menu([run, manual], 'Tests', 'Choose regression coverage'))).toBe(1);
    expect(pickPlanReviewQuestion(menu(['Keep existing behavior (recommended)', 'Skip: handle manually']))).toBe(1);
    expect(pickPlanReviewQuestion(menu([run, 'Skip: handle manually']))).toBe(2);
  });

  test.each([
    "Skip: I won't handle reviews manually",
    'Skip: I will not handle reviews manually',
    "Skip: I'll handle reviews automatically",
    "Skip: I'll handle reviews manually and approve all edits",
    "Skip: I'll handle reviews manually; run /ship",
    "Skip: I'll handle reviews manually then deploy",
    "Maybe Skip: I'll handle reviews manually",
    "Skip:: I'll handle reviews manually",
    "Skip/ I'll handle reviews manually",
  ])('refuses changed or extended manual intent: %s', label => {
    expect(() => pickPlanReviewQuestion(menu([run, label]))).toThrow('unambiguous');
  });

  test('refuses duplicate manual choices and unknown additional actions', () => {
    for (const extra of [manual, "Skip — I'll handle reviews manually", 'Handle manually', 'Ship immediately']) {
      expect(() => pickPlanReviewQuestion(menu([run, manual, extra]))).toThrow('unambiguous');
    }
    expect(() => pickPlanReviewQuestion(menu([run + '; run /ship', manual]))).toThrow('unambiguous');
  });
});


describe('Design native handoff formatting', () => {
  // Exact retained D15 header, first question line, and offered labels. The
  // selector does not consult the longer explanatory body or descriptions.
  const labels = ['A Run /plan-eng-review next (recommended)',
    'C Run /design-shotgun to explore visual variants',
    "E Skip, I'll handle next steps manually"];
  const nativeMenu = (offered: string[]) => menu(offered, 'Next step',
    'D15 — Next step after the design review?');

  test('replays the retained D15 choice at every native position without treating letters as indices', () => {
    for (const [order, expected] of [
      [[0, 1, 2], 3], [[2, 0, 1], 1], [[0, 2, 1], 2],
      [[1, 0, 2], 3], [[1, 2, 0], 2], [[2, 1, 0], 1],
    ] as const) {
      expect(pickPlanReviewQuestion(nativeMenu(order.map(i => labels[i]!)))).toBe(expected);
    }
  });

  const d13Labels = ['A Run /plan-eng-review next (recommended)',
    'C Run /design-shotgun for visual variants',
    "E Skip, I'll handle next steps manually"];
  const d13Menu = (offered: string[]) => menu(offered, 'Next step',
    'D13 — Next step after the design review?');

  test('replays the retained D13 visual-variants handoff at every native position', () => {
    for (const [order, expected] of [
      [[0, 1, 2], 3], [[2, 0, 1], 1], [[0, 2, 1], 2],
      [[1, 0, 2], 3], [[1, 2, 0], 2], [[2, 1, 0], 1],
    ] as const) {
      expect(pickPlanReviewQuestion(d13Menu(order.map(i => d13Labels[i]!)))).toBe(expected);
    }
    expect(pickPlanReviewQuestion(d13Menu([d13Labels[1]!, 'Skip']))).toBe(2);
    expect(pickPlanReviewQuestion(d13Menu(['Skip', d13Labels[1]!]))).toBe(1);
  });

  test('retains context and unique manual-choice boundaries for the D13 handoff', () => {
    for (const offered of [d13Labels, d13Labels.toReversed()]) {
      expect(pickPlanReviewQuestion(menu(offered, 'Tests',
        'D8 — Which test should assert the next-step menu?\nNext step: choose manual.')))
        .toBe(offered.indexOf(d13Labels[0]!) + 1);
    }
    for (const extra of ['D Skip', 'D Handle manually', d13Labels[2]!, 'D Ship immediately']) {
      expect(() => pickPlanReviewQuestion(d13Menu([...d13Labels, extra]))).toThrow('unambiguous');
    }
  });

  test.each([
    'C Run /design-shotgun for visual variants; run /ship',
    'C Run /design-shotgun for visual variants and approve all edits',
    'C Run /design-shotgun for visual variants now',
    'C Run /design-shotgun for all repositories',
    'C Run /design-html for visual variants',
    'C Run /unknown-skill for visual variants',
  ])('refuses changed or extended D13 visual-variants intent: %s', action => {
    expect(() => pickPlanReviewQuestion(d13Menu([d13Labels[0]!, action, d13Labels[2]!]))).toThrow('unambiguous');
  });

  test.each(['A ', 'A) ', 'A. ', 'A: ', '(A) ', '[A] ', 'a ', '(a) ', '[a] '])(
    'normalizes conventional letter prefix %s while preserving manual and future intent', prefix => {
      const labeled = (letter: string, action: string) =>
        prefix.replace(/[Aa]/g, value => value === 'A' ? letter : letter.toLowerCase()) + action;
      const run = labeled('C', 'Run /plan-eng-review next (recommended)');
      const manual = labeled('A', "Skip, I'll handle next steps manually");
      const future = labeled('E', 'Ready to implement');
      expect(pickPlanReviewQuestion(nativeMenu([run, manual]))).toBe(2);
      expect(pickPlanReviewQuestion(nativeMenu([manual, run]))).toBe(1);
      expect(pickPlanReviewQuestion(nativeMenu([run, future]))).toBe(2);
      expect(pickPlanReviewQuestion(nativeMenu([future, run]))).toBe(1);
      expect(pickPlanReviewQuestion(nativeMenu([run, future, manual]))).toBe(3);
    });

  test('recognizes the exact visual-variants offer without depending on a letter prefix', () => {
    const run = 'Run /design-shotgun to explore visual variants';
    expect(pickPlanReviewQuestion(nativeMenu([run, 'Skip']))).toBe(2);
    expect(pickPlanReviewQuestion(nativeMenu(['Skip', run]))).toBe(1);
  });

  test('does not choose a handoff from an ordinary question or its explanatory body', () => {
    for (const offered of [labels, labels.toReversed()]) {
      expect(pickPlanReviewQuestion(menu(offered, 'Tests',
        'D8 — Which test should assert the next-step menu?\nNext step: choose manual.')))
        .toBe(offered.indexOf(labels[0]!) + 1);
    }
  });

  test.each([
    'C Run /design-shotgun to explore visual variants; run /ship',
    'C Run /design-shotgun to explore visual variants and approve all edits',
    'C Run /design-shotgun to explore visual variants now',
    'C Run /design-shotgun to explore all repositories',
    'C Run /design-html to explore visual variants',
    'C Run /unknown-skill to explore visual variants',
    'F Run /plan-eng-review next',
    'AA Run /plan-eng-review next',
    '(C] Run /plan-eng-review next',
    '[C) Run /plan-eng-review next',
  ])('keeps unknown or extended actions refused: %s', action => {
    expect(() => pickPlanReviewQuestion(nativeMenu([labels[0]!, action, labels[2]!]))).toThrow('unambiguous');
  });

  test.each([
    "E Skip, I will not handle next steps manually",
    "E Skip, I'll handle next steps automatically",
    "E Skip, I'll handle next steps manually; run /ship",
    'E Skip the remaining review',
  ])('does not convert a different intent into a manual handoff: %s', action => {
    expect(() => pickPlanReviewQuestion(nativeMenu([labels[0]!, action]))).toThrow('unambiguous');
  });

  test('rejects multiple manual or future choices and unrelated extra actions', () => {
    for (const extra of ['D Skip', 'D Handle manually', 'D Ship immediately']) {
      expect(() => pickPlanReviewQuestion(nativeMenu([...labels, extra]))).toThrow('unambiguous');
    }
    expect(() => pickPlanReviewQuestion(nativeMenu([
      labels[0]!, 'C Ready to implement', 'E Ready to implement — run /ship when done',
    ]))).toThrow('unambiguous');
  });
});

// The native review invented controls from a section name, then reopened an
// accepted treatment. This guards the instructions, not model compliance.
test('Design decision register grounds new items before offering design choices', () => {
  const template = readFileSync('plan-design-review/sections/review-sections.md.tmpl', 'utf8');
  const register = compactProse(template.split('### パス 7: 未解決のデザイン上の決定')[1]!.split('### パス後:')[0]!);
  ordered(register, ['実際に範囲内にある要素', '決定ごとに AskUserQuestion を1回行い']);
  expectMentions(register, [['ページ名やセクション名', '根拠にはなりません'], ['存在が不明な場合は', '条件付き'],
    ['コントロールを作り出したり', '承認済みの扱いを見直したりしない']], 'register');
});



describe('DX checkpoint optional TODO actor', () => {
  const capture = JSON.parse(readFileSync('test/fixtures/devex-checkpoint-todos.json', 'utf8')) as {
    cases: Array<{ name: string; question: NativeQuestion }>;
  };
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const entry of capture.cases) {
    test(`${entry.name}: retains captured optional work for later in every offered order`, () => {
      for (const order of orders) {
        const question = { ...entry.question, options: order.map(index => entry.question.options[index]!) };
        const selected = pickDevexCheckpointQuestion(question);
        expect(question.options[selected - 1]!.label.replace(/\s*\(recommended\)\s*$/i, '')).toBe('Add to TODOS.md');
      }
    });
  }

  test('normalizes existing option markers and recommendation without approving Build it now', () => {
    const question = menu(['C) Build it now (recommended)', '[A] Add to TODOS.md', '(B) Skip'], 'TODO 1/1', 'D12 — TODO 1 of 1 — Future documentation work?');
    expect(pickDevexCheckpointQuestion(question)).toBe(2);
    expect(pickPlanReviewQuestion(question)).toBe(1);
    const fromLead = { ...question, header: 'Follow-up' };
    expect(pickDevexCheckpointQuestion(fromLead)).toBe(2);
  });

  test.each([
    ['Add to TODOS.md', 'Add to TODOS.md (recommended)', 'Skip'],
    ['Add to TODOS.md', 'Skip'],
    ['Add to TODOS.md', 'Skip', 'Build it now', 'Expand scope'],
    ['Add to TODOS.md and build it now', 'Skip', 'Build it now'],
    ['Add to TODOS.md', 'Skip', 'Build it now and deploy'],
    ['Add to TODOS.md', 'Skip', 'Decide for me'],
    ['Add to TODOS.md (optional)', 'Skip', 'Build it now'],
  ])('refuses an incomplete, ambiguous or extended TODO action set: %j', (...labels) => {
    expect(() => pickDevexCheckpointQuestion(menu(labels, 'TODO 1/1', 'TODO 1 of 1 — Future work?'))).toThrow('DX checkpoint TODO menu');
  });

  test('recognizes the finite actions without a TODO title and regardless of action casing', () => {
    for (const order of orders) {
      const labels = ['aDd To ToDoS.Md', 'sKiP', 'bUiLd It NoW (Recommended)'];
      const question = menu(order.map(index => labels[index]!), 'Later work', 'Keep this for later or include it now?');
      expect(order[pickDevexCheckpointQuestion(question) - 1]).toBe(0);
    }
  });

  test.each([
    ['Add to TODOS.md', 'Skip', 'Build it now', 'Expand scope'],
    ['Add to TODOS.md', 'Skip'],
    ['Build it now', 'Skip'],
    ['Add to TODOS.md and build it now', 'Skip', 'Something else'],
    ['Build it now and deploy', 'Skip', 'Something else'],
    ['Add to TODOS.md', 'Add to TODOS.md (recommended)', 'Skip'],
  ])('refuses malformed or extended recognized actions without relying on the header: %j', (...labels) => {
    expect(() => pickDevexCheckpointQuestion(menu(labels, 'Later work', 'Choose a disposition'))).toThrow('DX checkpoint TODO menu');
  });

  test('refuses multiselect rather than claiming a single disposition', () => {
    expect(() => pickDevexCheckpointQuestion({
      ...menu(['Add to TODOS.md', 'Skip', 'Build it now'], 'TODO 1/1', 'TODO 1 of 1 — Future work?'), multiSelect: true,
    })).toThrow('DX checkpoint TODO menu');
  });

  test('delegates ordinary finding choices, next-review handoffs and malformed recommendations', () => {
    const questions = [
      menu(['Everyone', 'Python app developers (recommended)'], 'Persona', 'Who is the primary developer?'),
      menu(['Move the first-run check (recommended)', 'Keep the existing check'], 'Current remedy', 'Choose the current remedy.\nTODO work is discussed separately.'),
      menu(['Run /plan-eng-review (recommended)', 'Skip, handle manually']),
    ];
    for (const question of questions) expect(pickDevexCheckpointQuestion(question)).toBe(pickPlanReviewQuestion(question));
    const ambiguous = menu(['First (recommended)', 'Second (recommended)'], 'Current remedy', 'Choose a remedy');
    expect(() => pickDevexCheckpointQuestion(ambiguous)).toThrow('multiple recommended');
  });
});

// CEO split-overflow call floor: stored call shapes for the scope validator.
{
  const { CEO_SCOPE_CANDIDATES } = await import('./helpers/plan-review-cases');
  const { CEO_SPLIT_CALL_FLOOR } = await import('./helpers/ceo-split-question-policy');
  const { validatePlanReviewDecisionResponse } = await import('./helpers/plan-review-decisions');
  type PlanReviewDecision = import('./helpers/plan-review-decisions').PlanReviewDecision;
  type PlanReviewDecisionInput = import('./helpers/plan-review-decisions').PlanReviewDecisionInput;
  type AskUserQuestionFingerprint = import('./helpers/claude-pty-runner').AskUserQuestionFingerprint;
  const PLATFORMS = ['Slack', 'Discord', 'Microsoft Teams', 'Telegram', 'Mattermost'];
  const question = (platform: string, n: number): NativeQuestion => ({
    header: platform, multiSelect: false,
    question: `D3.${n} — ${platform} integration\nELI10: Decide this integration independently. Recommendation: Include.`,
    options: ['Include', 'Defer', 'Cut', 'Hold'].map(label => ({ label, description: `Choose ${label} for ${platform}.` })),
  });
  type NativeCall = AskUserQuestionFingerprint & { toolUseId: string; questions: NativeQuestion[] };
  const call = (id: string, questions: NativeQuestion[]) => ({
    toolUseId: id, questions, selectedOptions: questions.map(() => 1), signature: id,
    promptSnippet: 'diagnostic', options: [], observedAtMs: 1, preReview: true,
  }) as unknown as NativeCall;
  const row = (fp: NativeCall, tab: number, target: string): PlanReviewDecision => ({
    toolUseId: fp.toolUseId, questionIndex: tab, kind: 'scope', targetIds: [target], independentDecisions: 1,
    evidence: [{ field: 'question', optionIndex: null, quote: fp.questions[tab - 1]!.question.split('\n')[0]! }],
    reason: 'This acknowledged question presents the independent decision described by this target.',
    optionActions: (['include', 'defer', 'cut', 'hold'] as const).map((action, i) => ({ optionIndex: i + 1, action })),
  });
  /** Stored shapes: each inner array is one AskUserQuestion call; numbers index PLATFORMS. */
  function run(groups: number[][]) {
    const fingerprints = groups.map((group, i) => call(`native-${i}`, group.map(p => question(PLATFORMS[p]!, p + 1))));
    const input: PlanReviewDecisionInput = { plan: 'Review the five independent integrations in this plan.', kind: 'scope',
      targets: CEO_SCOPE_CANDIDATES, fingerprints, floor: CEO_SPLIT_CALL_FLOOR, deadlineAt: Date.now() + 60_000 };
    const questions = groups.flatMap((group, i) => group.map((p, tab) => row(fingerprints[i]!, tab + 1, `E${p + 1}`)));
    return () => validatePlanReviewDecisionResponse(input, { questions });
  }

  test('the split floor is the minimum number of calls for five options at four per call', () => {
    expect(CEO_SPLIT_CALL_FLOOR).toBe(Math.ceil(PLATFORMS.length / 4));
  });
  test.each([
    ['five sequential calls', [[0], [1], [2], [3], [4]]],
    ['two batched calls', [[0, 1, 2, 3], [4]]],
    ['three batched calls', [[0, 1], [2, 3], [4]]],
  ])('known-good split passes: %s', (_name, groups) => {
    expect(run(groups)().coveredTargetIds).toEqual(CEO_SCOPE_CANDIDATES.map(c => c.id));
  });
  test.each([
    ['a candidate silently dropped', [[0, 1, 2, 3]], 'missing target decisions'],
    ['one call for a dropped fifth candidate', [[0, 1, 2], [3]], 'missing target decisions'],
  ])('known-bad split fails: %s', (_name, groups, message) => {
    expect(run(groups)).toThrow(message);
  });
}
