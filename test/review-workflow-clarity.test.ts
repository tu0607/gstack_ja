import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateReviewArmy } from '../scripts/resolvers/review-army';
import { generateCrossReviewDedup, generateSharedCodeReuse, generateScopeDrift } from '../scripts/resolvers/review-scope';
import { generatePlanCompletionAuditReview, generatePlanCompletionAuditShip, generatePlanCompletionGateShip, PLAN_AUDIT_NOT_RUN } from '../scripts/resolvers/plan-gates';
import { generateQAReview } from '../scripts/resolvers/qa';
import { generateConfidenceCalibration } from '../scripts/resolvers/confidence';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { between, compact, expectAbsent, expectMentions, expectOrdered, expectTokens } from './helpers/prompt-structure';

const root = join(import.meta.dir, '..');
const skill = readFileSync(join(root, 'review/SKILL.md.tmpl'), 'utf8');
const adversarial = readFileSync(join(root, 'review/sections/adversarial.md.tmpl'), 'utf8');

test('review audits deliverables before deferring behavioral plan checks to the QA preflight', () => {
  const ctx: TemplateContext = { skillName: 'review', tmplPath: '', host: 'claude', paths: HOST_PATHS.claude };
  const audit = compact(generatePlanCompletionAuditReview(ctx));
  expectTokens(audit, ['Step 4.7', 'UNVERIFIABLE', 'DONE'], 'audit');
  expectMentions(audit, [
    ['静的', '振る舞い', '分け'],
    ['diff', 'DONE', 'なりません'],
    ['0 件', '免除'],
    ['UNVERIFIABLE', 'Step 4.7', '回し'],
    ['アプリケーション', 'API', '状態', 'いけません'],
  ], 'audit');
  expectOrdered(audit, [/バリデーターとそのフックを調べ/, /見つかった場合\(上で安全性を確認済み/], 'audit');
});

test('review prior-Skip matching includes adversarial and Greptile findings without relaxing eligibility', () => {
  const dedup = generateCrossReviewDedup({ skillName: 'review', tmplPath: '', host: 'claude', paths: HOST_PATHS.claude });
  expectMentions(dedup, [['敵対的', 'Greptile', '統合']], 'dedup');
  expectMentions(dedup, [['すべての条件', '抑制', '未変更']], 'dedup');
  expectMentions(dedup, [['advisory', '欠陥', '抑制', 'いけません']], 'dedup');
  expectMentions(dedup, [['`skipped`', '`fixed`', '`auto-fixed`', '決して']], 'dedup');
  expectMentions(compact(skill), [['Step 5.0', 'Step 5a', '重複排除']], 'skill');
});

test('Review audit and prior-Skip clarifications do not route Ship through Review steps', () => {
  for (const host of Object.keys(HOST_PATHS) as TemplateContext['host'][]) {
    const ctx: TemplateContext = { skillName: 'ship', tmplPath: '', host, paths: HOST_PATHS[host] };
    const audit = generatePlanCompletionAuditShip(ctx);
    expect(audit).toContain('Step 8.1/9');
    expect(audit).not.toContain('Step 4.7');
    const dedup = generateCrossReviewDedup(ctx);
    expect(dedup).toContain('Step 9.3: Cross-review finding dedup');
    expect(dedup).not.toContain('Step 5.0');
    expect(dedup).not.toContain('統合したすべての指摘');
  }
});

test('review collects every source before its single parent fix phase', () => {
  const markers = [
    '## Step 4:', '### TODOS の相互参照',
    '### ドキュメントの陳腐化の確認', '{{SECTION:review-army}}',
    '{{QA_REVIEW}}', '{{SECTION:adversarial}}',
    '## Step 5: Fix-First', '{{CROSS_REVIEW_DEDUP}}',
    '### Step 5a:', '### Step 5b:', '### Step 5c:', '### Step 5d:',
    '## Step 5.8:',
  ];
  expectOrdered(skill, markers, 'review skill');
  expect(skill.match(/## Step 5: Fix-First/g)).toHaveLength(1);
  expectMentions(compact(skill), [['Step 5', 'ソース', '編集しないでください']], 'skill');
});

test('review settles adversarial attempts before fixing and has one full-pass back edge', () => {
  const generated = readFileSync(join(root, 'review/sections/adversarial.md'), 'utf8');
  const decision = compact(skill.slice(skill.indexOf('## Step 5.8:')));
  expect(generated).toContain('## Step 4.8:');
  expectMentions(generated, [['Step 4.8', '編集しないでください']], 'generated');
  expectMentions(decision, [['パス', 'Step 3〜5', '含みます']], 'decision');
  expectMentions(decision, [['3 未満', '新しい REVIEW_START', 'Step 3〜5', '繰り返します']], 'decision');
  expectAbsent(decision, ['Route Step', 'Steps 5.0–5d', 'Steps 5.0〜5d'], 'decision');
  expectMentions(decision, [['クリーンな要約', '4 回目', '停止']], 'decision');
});

test('review small-diff and failed-reader paths retain QA and the required adversarial pass', () => {
  const army = generateReviewArmy({ skillName: 'review', tmplPath: 'review/SKILL.md.tmpl',
    host: 'claude', paths: HOST_PATHS.claude });
  expect(army).not.toContain('design-lite');
  expectMentions(compact(army), [['ディスパッチ', '未完了', 'クリーン']], 'review army');
  expect(army).not.toContain('skip silently');
});

test('review defines QA confidence, severity, impact selection and numeric version comparison', () => {
  const flat = compact(skill);
  expect(flat).toContain('信頼度(1〜10)');
  expectMentions(flat, [['Step 4.7', '重大度', '保持']], 'skill');
});

test('review emits scope check after the plan audit and before the checklist', () => {
  expectOrdered(skill, ['{{SCOPE_DRIFT}}', '{{SECTION:plan-completion}}', '## Step 2:'], 'review skill');
  expect(skill).not.toContain('Finish Step 1.5 here');
});

test('review composes confidence-tagged findings into one final report with explicit incomplete coverage', () => {
  const flat = compact(skill);
  expect(flat).toContain('CRITICAL/INFORMATIONAL');
  const report = flat.slice(flat.indexOf('### 最終レビューの報告'), flat.indexOf('{{LEARNINGS_LOG}}'));
  expectMentions(report, [
    ['最終報告', '1 つ'],
    ['解決されていない非助言的な欠陥'],
    ['`COMPLETED`', 'false', 'INCOMPLETE', '明記'],
  ], 'report');
  expect(report).toContain('`## Exploratory QA and Verification Results`');
});

test('small-diff persistence uses an empty specialist map without manufacturing skipped coverage', () => {
  const army = generateReviewArmy({ skillName: 'review', tmplPath: 'review/SKILL.md.tmpl',
    host: 'claude', paths: HOST_PATHS.claude });
  expectMentions(army, [['DIFF_LINES < 50', '`specialists: {}`', 'のまま']], 'army');
  expectMentions(compact(skill), [['Step 4.6', '`specialists`', 'そのまま使います']], 'skill');
  const ship = readFileSync(join(root, 'ship/sections/review-army.md.tmpl'), 'utf8');
  expect(ship).toContain('`specialists`: 小さな差分でスキップした場合は `{}`');
  expectMentions(compact(ship), [['必要なプローブ', 'すべて', '合格']], 'ship');
});

test('caller QA runs charter and setup after resource loading and has a severity for unmatched functional failures', () => {
  for (const skillName of ['review', 'ship']) {
    const body = generateQAReview({ skillName, tmplPath: '', host: 'claude', paths: HOST_PATHS.claude });
    const preparation = body.indexOf(skillName === 'review'
      ? '**1. charter と隔離を設定します。**'
      : '共有の preflight を実行し');
    const probes = body.indexOf('**3. スモークとプランのチェックを実行します。**');
    expect(preparation).toBeGreaterThan(-1);
    if (skillName === 'review') {
      const readiness = body.indexOf('**2. 準備状況を確認し、必要なチェックを列挙します。**');
      expect(readiness).toBeGreaterThan(preparation);
      expect(probes).toBeGreaterThan(readiness);
      expectMentions(body.slice(preparation, readiness), [['セットアップ', '隔離/許可の事前確認', '完了']], 'review QA preparation');
    } else expect(preparation).toBeGreaterThan(body.indexOf('**2. 必要なチェックを列挙します。**'));
    expect(probes).toBeGreaterThan(preparation);
    expect(compact(body)).toMatch(/`functional-contract`[,、]\s*`CRITICAL`/);
    expectMentions(body, [['セットアップ/許可', 'ブロッカー', '欠陥ではありません']], 'body');
    expectMentions(body, [['テストの作成', '承認']], 'body');
    expect(body).not.toContain('for parent approval');
  }
});

test('review prepares context and deduplicates before classifying findings', () => {
  expectOrdered(skill, [
    '## Step 3.5:', '## Step 3.6:',
    '{{LEARNINGS_SEARCH}}', '{{ASIDE_RESEARCH}}', '## Step 4:',
    '## Step 5: Fix-First', '{{CROSS_REVIEW_DEDUP}}',
    '**修正サイクルを通じて判断を保持する:**', '### Step 5a:',
  ], 'review skill');
  expect(skill).toMatch(/Step 5a の分類の前に/);
});

test('review owns the complete persistence contract after the adversarial read', () => {
  const step = skill.slice(skill.indexOf('## Step 5.8:'));
  expect(skill.indexOf('{{SECTION:adversarial}}')).toBeLessThan(skill.indexOf('## Step 5.8:'));
  expect(adversarial).not.toContain('### Before persisting Eng Review (Step 5.8)');
  for (const token of [
    'Step 3〜5', '修正サイクルは最大 3 回', '`evidence_paths`/`helper_target`',
    'snapshot_covered_paths', 'REVIEW_START', 'COMPLETED', 'CONVERGED', 'CYCLES', 'Step 4.7',
    'Step 4.8', '名指しのリスク受容', '件数をゼロ', '`completed:false`',
    '`specialists`', '`findings`', '明示的にスキップ', 'sharedLibsFingerprint', '`review_binding`',
  ]) expect(step.toLowerCase().replace(/\s+/g, ' ')).toContain(token.toLowerCase());
  expectOrdered(step, ['### 1. 編集後の再レビュー', '### 2. 記録を埋める', '~/.claude/skills/gstack/bin/gstack-review-log'], 'Step 5.8');
  expect(step).toContain('`quality_score`');
  expect(step.indexOf('Pre-Landing Review: N issues (X critical, Y informational)'))
    .toBeGreaterThan(step.indexOf('~/.claude/skills/gstack/bin/gstack-review-log'));
  expect(step).toContain('`## Exploratory QA and Verification Results`');
});

test('review distinguishes required native coverage from optional outside coverage', () => {
  const section = readFileSync(join(root, 'review/sections/adversarial.md'), 'utf8');
  expectMentions(section, [['ブロックしない', '任意', '敵対的', 'だけ']], 'section');
  expect(section).not.toContain('All errors are non-blocking');
});

test('review identifies probe selection, report assets and the detected diff base', () => {
  const generated = generateQAReview({ skillName: 'review', tmplPath: 'review/SKILL.md.tmpl',
    host: 'claude', paths: HOST_PATHS.claude });
  const checklist = readFileSync(join(root, 'review/checklist.md'), 'utf8');
  expect(generated).toContain('5 分/12 プローブ');
  expectMentions(generated, [['QA', '`templates/functional-report-template.md`', 'Read']], 'generated');
  expectMentions(generated, [['すべてのチェックポイント', 'リンク']], 'generated');
  expectMentions(generated, [['2 つ目のレポート', '作りません']], 'generated');
  expect(checklist).not.toContain('git diff origin/main');
});

test('caller QA defines execution, evidence ownership and report adaptation before handoff', () => {
  for (const skillName of ['review', 'ship']) {
    const generated = compact(generateQAReview({ skillName, tmplPath: `${skillName}/SKILL.md.tmpl`,
      host: 'claude', paths: HOST_PATHS.claude }));
    expectMentions(generated, [['他の実行', 'レポート', '上書き', 'いけません']], 'generated');
    expectMentions(generated, [['更新がなくても', '現在の入力', '比較']], 'generated');
    expectMentions(generated, [['チェックリストの重大度', '使います']], 'generated');
    if (skillName === 'review') {
      expect(generated).toContain('`## Exploratory QA and Verification Results`');
      expect(generated).toContain('`### Browser results`');
    } else {
      expect(generated).toContain('`## Exploratory QA`');
    }
  }
});

test('review section index follows the actual pre-fix execution order', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'review/sections/manifest.json'), 'utf8'));
  expect(manifest.sections.map((section: { id: string }) => section.id)).toEqual([
    'plan-completion', 'review-army', 'adversarial', 'shared-code-reuse',
  ]);
});

test('review finalization ownership: initialize invocation state and capture the core token before reading', () => {
  const start = skill.slice(skill.indexOf('## Step 3:'), skill.indexOf('## Step 3.4:'));
  expect(start).toContain('CYCLES=0');
  expect(skill.match(/CYCLES=0/g)).toHaveLength(1);
  expect(start).toContain('gstack-review-log --start review\ngit diff "$DIFF_BASE"');
  const flat = compact(start);
  expectMentions(flat, [['REVIEW_START', 'コア候補', '差分を読みます']], 'flat');
  expectMentions(flat, [['読み込む前に', '新しいトークン']], 'flat');
  expectMentions(flat, [['PASS_START', '独自']], 'flat');
  expectMentions(flat, [['REVIEW_START', '使いません']], 'flat');
  expectMentions(flat, [['Step 5.8', '最後', 'コア', 'トークンだけ', '完了']], 'flat');
});

test('review finalization ownership: late findings use Fix-First before the bounded parent transition', () => {
  const flat = compact(skill);
  expectOrdered(flat, [
    '{{SECTION:adversarial}}',
    '## Step 5: Fix-First',
    '構造化された承認があっても、advisory/test_stub の ASK のゲートは免除されません',
    '## Step 5.8:',
    '編集した場合: CYCLES を 1 増やします',
    '編集していない場合: 下の記録を埋めます',
    '### 2. 記録を埋める',
    '--finish REVIEW_START',
  ], 'review skill');
  expect(flat).toContain('修正サイクルは最大 3 回');
  expect(flat).toContain('3 回目に達したら、下の記録を埋めて保存することで `converged:false`');
  const limit = flat.slice(flat.indexOf('3 回目に達したら'), flat.indexOf('編集していない場合:'));
  expectMentions(limit, [['この呼び出しを停止します']], 'limit');
  expectMentions(limit, [['クリーンな要約', '4 回目', '停止']], 'limit');
});

test('review finalization ownership: affected QA reuse cannot replace a full review or erase decisions', () => {
  const step = skill.slice(skill.indexOf('## Step 5.8:'));
  const flat = compact(step);
  expect(flat).toContain('Step 3〜5 を順番に実行します');
  expectMentions(flat, [['変更のない入力', 'QA の証拠', 'だけ']], 'flat');
  expectMentions(flat, [['プローブを再利用', 'レビューの手順', '飛ばす']], 'flat');
  expectMentions(flat, [['以前の修正', '抑制']], 'flat');
  expectMentions(flat, [['ロガー', '`snapshot_covered_paths`', '計算します']], 'flat');
  expectMentions(flat, [['前のサイクル', '前の記録', '持ち越し', 'ないでください']], 'flat');
});

test('review finalization ownership: required native completion and optional outside records stay separate', () => {
  const step = skill.slice(skill.indexOf('### 2. 記録を埋める'));
  const flat = compact(step);
  expectMentions(flat, [['必須のプローブ', '判定不能', 'false']], 'flat');
  expectMentions(flat, [['`/ship`', '名指しのリスク受容', '`/review`', '完了させられません']], 'flat');
  expectMentions(flat, [['ネイティブの結果', '代わりにはできず']], 'flat');
  expectMentions(flat, [['構造化レビューのゲート', '適用されます']], 'flat');
  expect(flat).toContain('件数をゼロとし `completed:false`');
  expectMentions(flat, [['`CONVERGED`', '編集のないパス', 'true']], 'flat');
});

test('review finalization ownership: finish only the final core token without log-time capture', () => {
  const step = skill.slice(skill.indexOf('## Step 5.8:'));
  const flat = compact(step);
  expect(step.match(/--finish REVIEW_START/g)).toHaveLength(1);
  expect(step).not.toContain('--start review');
  expect(step).not.toContain('--finish PASS_START');
  expectMentions(flat, [['`review_binding`', '捏造', 'REVIEW_START', '置き換え', 'ないでください']], 'flat');
  expectMentions(flat, [['最後のコアのトークン', 'だけ']], 'flat');
  expect(step).toContain('"completed":COMPLETED,"converged":CONVERGED,"cycles":CYCLES');
});

test('review finalization ownership: the plan audit retains its high-impact gate before the final scope check', () => {
  const plan = readFileSync(join(root, 'review/sections/plan-completion.md.tmpl'), 'utf8');
  expectMentions(plan, [['HIGH', '質問']], 'plan');
  expectMentions(plan, [['最終のスコープチェック', '質問', '解決']], 'plan');
  expect(plan).not.toContain('never blocks the review');
  expect(plan).toContain('{{PLAN_COMPLETION_AUDIT_REVIEW}}');
  const audit = readFileSync(join(root, 'review/sections/plan-completion.md'), 'utf8');
  const gate = audit.indexOf('**HIGH インパクトのプランファイルの食い違い**');
  expect(gate).toBeGreaterThan(-1);
  expect(gate).toBeLessThan(audit.indexOf('監査のあとに続行する場合(HIGH インパクトのゲートがない'));
  const flatAudit = compact(audit);
  expectMentions(flatAudit, [['実装の前', '呼び出しを終了']], 'flatAudit');
  expectMentions(flatAudit, [['読み取り専用の監査ではなく', 'Step 5']], 'flatAudit');
  // C2: a spawned or non-interactive review cannot answer the question; its default writes and drops nothing.
  expect(flatAudit).toContain('REQUIREMENTS MISSING を報告して続行し、何も記録しません');
  expect(flatAudit.indexOf('REQUIREMENTS MISSING を報告して続行し')).toBeLessThan(flatAudit.indexOf('監査のあとに続行する場合'));
});

test('review scope notes remain provisional until the plan section emits the only final scope check', () => {
  const scope = compact(generateScopeDrift({ skillName: 'review', tmplPath: 'review/SKILL.md.tmpl',
    host: 'claude', paths: HOST_PATHS.claude }));
  expectMentions(scope, [['メモ', '暫定']], 'scope');
  expectMentions(scope, [['Step 2 の前に', '最終的な Scope Check', '1 つだけ']], 'scope');
  expect(scope).not.toContain('Scope Check: [CLEAN');
  expect(scope).not.toContain('available plan-audit results');
});

test('review confidence uses its severity labels without an undefined P0 exception', () => {
  const ctx: TemplateContext = { skillName: 'review', tmplPath: 'review/SKILL.md.tmpl',
    host: 'claude', paths: HOST_PATHS.claude };
  const confidence = generateConfidenceCalibration(ctx);
  expect(confidence).toContain('[CRITICAL]');
  expect(confidence).toContain('[CRITICAL|INFORMATIONAL]');
  expect(confidence).not.toMatch(/\bP[012]\b/);
  const flat = compact(confidence);
  for (const row of [
    /\| 9-10 \|[^|]*\| 通常どおり表示 \|/, /\| 7-8 \|[^|]*\| 通常どおり表示 \|/,
    /\| 5-6 \|[^|]*\| 注記付きで表示/, /\| 3-4 \|[^|]*\| 本文からは除外/,
    /\| 1-2 \|[^|]*\| リリースを止めるほどの重大事態/,
  ]) expect(flat).toMatch(row);
  expectMentions(flat, [['憶測であることを明記']], 'confidence');
  expectMentions(flat, [['その指摘は未検証です']], 'confidence');
  expect(flat).toContain('file:line');
  expectMentions(flat, [['confidence', '4〜5', '固定']], 'confidence');
  expectMentions(flat, [['憶測', 'confidence 7 以上', 'いけません']], 'confidence');
  expect(confidence.indexOf('Pre-emit verification gate')).toBeLessThan(confidence.indexOf('| スコア |'));
  expect(confidence).not.toContain('FP classes the gate kills');
  expect(confidence).not.toContain('1539-framework-aware-review.md');
  expectMentions(generateConfidenceCalibration({ ...ctx, skillName: 'ship' }), [['重大度', 'にのみ報告']], 'section');
});

test('review names the lifecycle and record owners before using their persistence rules', () => {
  const start = compact(skill.slice(skill.indexOf('## Step 3:'), skill.indexOf('## Step 3.4:')));
  expect(start).toContain('REVIEW_START / PASS_START |');
  expect(start).toContain('`review_binding` |');
  expect(start).toContain('`snapshot_covered_paths` |');
  expectMentions(start, [['一致するキーだけ', '再利用できると証明されない']], 'start');
  expectMentions(start, [['`snapshot_covered_paths`', 'バイト単位で同一'], ['レビュアーが提供するものではない']], 'start');
});

test('review invocation-local advice reuse keeps raw-source and changed-decision gates', () => {
  const decisions = compact(skill.slice(skill.indexOf('**修正サイクルを通じて判断を保持する:**'),
    skill.indexOf('### Step 5a:')));
  expectMentions(decisions, [['AUTO-FIX/修正', '明示的なスキップ', '保存']], 'decisions');
  expect(decisions).toContain('`advisory`、`evidence_paths`、`helper_target`');
  expectMentions(decisions, [['実質的な提案', '新しい質問が必要です']], 'decisions');
  expectMentions(decisions, [['新規・再発の欠陥', '抑制', 'できません']], 'decisions');
});

for (const skillName of ['review', 'ship']) {
  const ctx: TemplateContext = { skillName, tmplPath: `${skillName}/SKILL.md.tmpl`,
    host: 'claude', paths: HOST_PATHS.claude };
  const army = generateReviewArmy(ctx);
  const flat = army.replace(/\s+/g, ' ');

  // PR gate run 38981523623 (ship-exploratory-plan-checks): the block sourced the scope signals
  // without printing them, so the agent appended its own echo to see SCOPE_FRONTEND.
  test(`${skillName} clarity: the scope block prints every signal specialist selection reads`, () => {
    const block = between(army, '### スタックとスコープを検出する', '### スペシャリストのヒット率を読む');
    expect(block).toContain("/gstack-diff-scope <base> 2>/dev/null) || true\nset | grep '^SCOPE_'\n");
    const selection = between(army, '### スペシャリストを選択する', '### 適応型ゲーティング');
    const used = [...new Set(selection.match(/SCOPE_[A-Z_]+/g))];
    expect(used.length).toBeGreaterThan(0);
    const flags = between(readFileSync(join(root, 'bin/gstack-diff-scope'), 'utf8'), '_print_flags() {', '}');
    for (const signal of used) {
      if (flags.includes(`echo "${signal}=`)) continue;
      // PR gate run 39002269281: a signal gstack-diff-scope does not print comes from a detect helper the scope
      // block itself runs, never from a command named only in selection prose.
      const helper = /bin\/(gstack-[a-z-]+) detect\b/.exec(block.split('\n').find(line => line.includes(signal))!)?.[1];
      expect(helper, signal).toBeDefined();
      expect(readFileSync(join(root, 'bin', helper!), 'utf8'), signal).toContain(`${signal}=\${`);
      expect(selection, signal).not.toMatch(/\bdetect\b/);
    }
  });

  test(`${skillName} clarity: the state-machine signal checks the detector's exit status and fails toward dispatch`, () => {
    const block = between(army, '### スタックとスコープを検出する', '### スペシャリストのヒット率を読む');
    expect(block).toContain(`_SM=$(${HOST_PATHS.claude.binDir}/gstack-state-matrix detect --base <base>) || _SM=SCOPE_STATE_MACHINE=unknown; source <(echo "$_SM")\n`);
    expect(block.indexOf('SCOPE_STATE_MACHINE=unknown')).toBeLessThan(block.indexOf("set | grep '^SCOPE_'"));
    const selection = between(army, '### スペシャリストを選択する', '### 適応型ゲーティング').replace(/\s+/g, ' ');
    expect(selection).toContain('9. **State Machines** — SCOPE_STATE_MACHINE が true または unknown の場合:');
    // /review delta on 51f1e02: a fixed .gstack/tmp/state-machines.md let a second review check the previous run's
    // output (Write refuses an unread existing file) and commit it; each run now checks the new file outfile prints.
    expect(selection).toContain('/gstack-state-matrix outfile` を実行し、出力されたファイルを Read して');
    expect(selection).toContain('/gstack-state-matrix check <file>` を実行します');
    expect(selection).not.toContain('.gstack/tmp/state-machines.md');
    expect(selection).not.toContain('<<');
    expect(selection).not.toContain('pipe output');
  });

  test(`${skillName} clarity: the scope block run against a failing detector prints unknown and keeps its stderr`, () => {
    const stubs = mkdtempSync(join(realpathSync(tmpdir()), 'scope-block-'));
    try {
      const block = /\`\`\`bash\n([\s\S]*?)\n\`\`\`/.exec(between(generateReviewArmy({ ...ctx, paths: { ...ctx.paths, binDir: stubs } }),
        '### スタックとスコープを検出する', '### スペシャリストのヒット率を読む'))![1].replaceAll('<base>', 'main');
      writeFileSync(join(stubs, 'gstack-diff-scope'), '#!/bin/sh\necho SCOPE_FRONTEND=false\n', { mode: 0o755 });
      const run = (detector: string) => {
        writeFileSync(join(stubs, 'gstack-state-matrix'), `#!/bin/sh\n${detector}\n`, { mode: 0o755 });
        return spawnSync('bash', ['-c', block], { cwd: stubs, encoding: 'utf8', timeout: 10_000 });
      };
      const failed = run("echo SCOPE_STATE_MACHINE=false; echo '# no merge base with origin/main; run: git fetch origin main'; echo 'detector crashed' >&2; exit 2");
      expect(failed.stdout).toMatch(/^SCOPE_STATE_MACHINE=unknown$/m);
      expect(failed.stdout).not.toMatch(/^SCOPE_STATE_MACHINE=false$/m);
      expect(failed.stderr).toContain('detector crashed');
      expect(run('exit 127').stdout).toMatch(/^SCOPE_STATE_MACHINE=unknown$/m);
      const silent = run("echo 'detector found no git' >&2; exit 3");
      expect(silent.stdout).toMatch(/^SCOPE_STATE_MACHINE=unknown$/m);
      expect(silent.stderr).toContain('detector found no git');
      const lateFail = run("echo SCOPE_STATE_MACHINE=true; echo SCOPE_LEAK=1; exit 1");
      expect(lateFail.stdout).toMatch(/^SCOPE_STATE_MACHINE=unknown$/m);
      expect(lateFail.stdout).not.toContain('SCOPE_LEAK');
      const detected = run("echo SCOPE_STATE_MACHINE=true; echo '# state-machine: src/takes.ts:4 proposal,accept'");
      expect(detected.stdout).toMatch(/^SCOPE_STATE_MACHINE=true$/m);
      expect(detected.stdout).toMatch(/^SCOPE_FRONTEND=false$/m);
      expect(run('echo SCOPE_STATE_MACHINE=false').stdout).toMatch(/^SCOPE_STATE_MACHINE=false$/m);
      expect(block).toContain("DIFF_LINES=$(git diff \"$DIFF_BASE\" --numstat | awk '{n+=$1+$2} END {print n+0}')");
    } finally { rmSync(stubs, { recursive: true, force: true }); }
  });

  test(`${skillName} clarity: terminal failure permits independent work but never certifies coverage`, () => {
      expectMentions(flat, [['終了した', '停止したこと', '確認します']], 'flat');
      expectMentions(flat, [['タイムアウト', '終了の証明']], 'flat');
      expectMentions(flat, [['編集せずに', '停止経路']], 'flat');
      expectMentions(flat, [['ディスパッチ', '未完了', 'クリーン']], 'flat');
      const redTeam = flat.slice(flat.indexOf('### Red Team のディスパッチ'));
      expectMentions(redTeam, [['停止したことを確認', '未完了']], 'redTeam');
      expect(redTeam).toContain('段階 1〜7');
    });

  test(`${skillName} clarity: ordered specialist merge separates validation from scoring and provenance`, () => {
      const markers = ['#### 1. 出力を解析する', '#### 2. 重大度を検証する',
        '#### 3. 識別とマージ', '#### 4. スペシャリストの信頼度ゲートを適用する',
        '#### 5. スペシャリストをスコア化して提示する', '#### 6. スペシャリストの活動を保存する',
        '#### 7. Fix-First に引き継ぐ'];
      expectOrdered(army, markers, 'review army');
      const validation = flat.slice(flat.indexOf('#### 2.'), flat.indexOf('#### 3.'));
      expect(validation).toContain('`advisory` を取り除き、`CRITICAL` の重大度を保持します');
      expectMentions(validation, [['重大度を下げてはいけません']], 'validation');
      const merge = flat.slice(flat.indexOf('#### 3.'), flat.indexOf('#### 4.'));
      expectMentions(merge, [['フィンガープリントでグループ化する前に', '欠陥と助言を分けます']], 'merge');
      for (const token of ['sharedLibsFingerprint', 'リテラルの JSON として標準入力に渡します', '+1(上限 10)']) expect(merge).toContain(token);
      expectMentions(merge, [
        ['供給されたハッシュ', '信用', 'いけません'],
        ['メタデータがない', '重複排除', '再利用はできません'],
        ['コアの指摘', '信頼度の加点を受けることはありません'],
      ], 'merge');
      for (const gate of ['信頼度 7 以上', '信頼度 5〜6', '信頼度 3〜4', '信頼度 1〜2']) expect(army).toContain(gate);
      const scoring = flat.slice(flat.indexOf('#### 5.'), flat.indexOf('#### 6.'));
      expectMentions(scoring, [['`quality_score`', 'スペシャリストの指摘だけ']], 'scoring');
      expectMentions(scoring, [['advisory ではない', 'スペシャリストの指摘']], 'scoring');
      expect(scoring).toContain('quality_score = max(0, 10 - (critical_count * 2 + informational_count * 0.5))');
      expectMentions(flat, [['advisory', '統計', '`findings` フィールド', '数えます']], 'flat');
      expectMentions(flat, [['コアだけの助言', 'スペシャリスト', '作ってはいけません']], 'flat');
      expectMentions(flat, [['ASK のみ']], 'flat');
    });

  test(`${skillName} clarity: shared-code reuse gives executable decisions and retains checker safeguards`, () => {
      const reuse = compact(generateSharedCodeReuse(ctx));
      expectOrdered(reuse, ['1. **証拠を読みます。**', '2. **チェッカーを実行します。**',
        '3. **結果に従います。**', '4. **ロガー経由で永続化します。**'], 'reuse');
      for (const token of ['--check-shared-libs REVIEW_START', "<<'GSTACK_SHARED_LIBS_REUSE_JSON'", 'リテラルの JSON として stdin',
        '`reusable: true`', 'sharedLibsFingerprint', '明示的な Skip', 'ロガーがバージョン付けした `snapshot_covered_paths`',
        'canReuseSharedLibsAdvisory']) expect(reuse).toContain(token);
      expectMentions(reuse, [
        ['コマンドの失敗', '読めない出力', '抑制ではなく'],
        ['独自のスナップショット', '渡してはいけません'],
        ['不明な証拠', 'fail closed'],
        ['実際の欠陥', '通常の Fix-First'],
      ], 'reuse');
    });
}

test('review clarity: settlement gates edits separately from incomplete required coverage', () => {
  const fix = compact(skill.slice(skill.indexOf('## Step 5: Fix-First'), skill.indexOf('{{CROSS_REVIEW_DEDUP}}')));
  expectMentions(fix, [['未完了', '編集せずに', '停止']], 'fix');
});

test('review clarity: Greptile reply choices never substitute for Fix-First approval', () => {
  const fix = skill.slice(skill.indexOf('## Step 5: Fix-First'), skill.indexOf('{{CROSS_REVIEW_DEDUP}}'));
  expect(fix).toContain('VALID & ACTIONABLE な Greptile の指摘');
  const greptile = skill.slice(skill.indexOf('### Greptile のコメントの解決'), skill.indexOf('## Step 5.8:'));
  const flat = compact(greptile);
  expectMentions(flat, [['返信の判断', 'コードの承認ではありません']], 'flat');
  expect(flat).toContain('B) コードの変更を提案する');
  expect(flat).toContain('Step 5c〜5d');
  expectMentions(flat, [['承認を待って', '編集']], 'flat');
  expectMentions(flat, [['新たな修正の許可', '与えられません']], 'flat');
});

test('ship review clarity: parent settlement gate precedes classification and cannot waive coverage', () => {
  const ship = readFileSync(join(root, 'ship/sections/review-army.md.tmpl'), 'utf8');
  const gate = compact(ship.slice(ship.indexOf('## Step 9.4:'), ship.indexOf('1. Step 9.3 が')));
  expectMentions(gate, [['戻りを待つ', '終了を確認']], 'gate');
  expectMentions(gate, [['不完全', '編集せずに', '停止']], 'gate');
  expectMentions(gate, [['ディスパッチした出力', '継続をブロック']], 'gate');
});

test('review keeps its smoke-clock, setup-authority, plan-gate and findings-source rules', () => {
  const ctx = { skillName: 'review', tmplPath: 'review/SKILL.md.tmpl', host: 'claude', paths: HOST_PATHS.claude } as TemplateContext;
  const qa = compact(generateQAReview(ctx));
  expectMentions(qa, [['/review', '設定しません'], ['EARLIER_UTC', 'だけが有効']], 'qa');
  expectMentions(qa, [['レポート専用の /review', 'インストール', '実行しません']], 'qa');
  expectMentions(qa, [['そうでなければ', 'ブロックのまま']], 'qa');
  expect(qa).not.toContain('Ask for setup/permission');
  expect(generateQAReview({ ...ctx, skillName: 'ship', tmplPath: 'ship/SKILL.md.tmpl' })).not.toContain('/review は設定しません');
  const audit = compact(generatePlanCompletionAuditReview(ctx));
  // F1 (#2768): no bound plan prints the exact not-run line instead of the old notice.
  expect(audit).toContain(PLAN_AUDIT_NOT_RUN);
  expect(audit).not.toMatch(/skip dispatch/);
  expect(audit).toContain('**HIGH インパクトのプランファイルの食い違い**は、調査結果を示す AskUserQuestion のトリガーになります');
  expectMentions(audit, [['フォールバックの情報源', 'この質問', 'トリガーにはなりません']], 'audit');
  const shipCtx = { ...ctx, skillName: 'ship', tmplPath: 'ship/SKILL.md.tmpl' };
  expectMentions(generatePlanCompletionAuditShip(shipCtx), [['別のプラン', '探してはいけません']], 'generatePlanCompletionAuditShip(shipCtx)');
});

// INV-1 consumers: an outside review that reports `unverified` or
// `unavailable` is missing coverage in /ship's readiness note, its PR body
// and /review's completion, never a pass.
test('ship and review count unverified or unavailable outside reviews as missing coverage', () => {
  const read = (rel: string) => readFileSync(join(import.meta.dir, '..', rel), 'utf-8').replace(/\s+/g, ' ');
  for (const rel of ['ship/SKILL.md', 'review/SKILL.md']) {
    expectMentions(read(rel), [['`unverified`', '`unavailable`', 'カバレッジ', '合格']], rel);
  }
  // The PR body line is output template text that stays in English.
  expectMentions(read('ship/sections/pr-body.md'), [['`unverified`', '`unavailable`', 'missing coverage', 'never']], 'ship/sections/pr-body.md');
});

test('testing specialist treats negative assertions as decisions and catches ones a rename emptied', () => {
  const specialist = between(readFileSync(join(root, 'review/specialists/testing.md'), 'utf8'), '### 否定のアサーション', '\n### ');
  expectTokens(specialist, ['not.toContain', 'assertNotIn'], 'testing specialist');
  expectMentions(compact(specialist), [
    ['新たに', 'アサート', 'カバレッジではなく', '削除'],
    ['認める仕様の行', '削除'],
    ['名前変更', '否定のアサーション', '空'],
    ['永遠に合格'],
    ['検索', '否定のアサーション', '古い値'],
  ], 'testing specialist');
});

test('security specialist checks authorization paths a route-guard read misses', () => {
  const auth = compact(between(readFileSync(join(root, 'review/specialists/security.md'), 'utf8'), '### 認証・認可のバイパス', '\n### '));
  expectMentions(auth, [
    ['エラー', 'レンダラー', '外側', 'ガード'],
    ['オーナーシップ', 'ロールの降格'],
    ['一覧', '詳細', 'ダウンロード', '個別に'],
    ['セッション', '検証する前', 'コールバック'],
  ], 'security specialist');
});

// Gate Integrity (docs/designs/HONEST_WORK_GATE_INTEGRITY.md W2): the category
// sits in the core CRITICAL pass every diff size gets, its findings reach a
// human through one four-option question, and the record carries identity
// fields a later reader can act on. Tokens and order only; the prose is free.
test('Gate Integrity is a Pass 1 category that is ASK-only and keeps the three levels apart', () => {
  const checklist = readFileSync(join(root, 'review/checklist.md'), 'utf8');
  const pass1 = between(checklist, '### パス 1 — CRITICAL', '### パス 2 — INFORMATIONAL');
  expect(pass1).toContain('#### ゲート整合性(Gate Integrity)');
  expect(between(checklist, '**二段階のレビュー:**', '**出力形式:**')).toMatch(/パス 1\(CRITICAL\):[^\n]*Gate Integrity/);
  const category = compact(between(pass1, '#### ゲート整合性(Gate Integrity)'));
  expectTokens(category, ['GATE_SUMMARY:', 'RH-1', 'RH-3', 'RH-4', 'RH-12', 'RH-13', 'RH-14', 'RH-15', 'RH-16', 'RH-2', 'RH-5',
    '**一覧(Listed)**', '**読み取り(Read)**', '**所見(Finding)**', 'gstack-decision-search --query "<dec-id>"'], 'Gate Integrity category');
  expectMentions(category, [
    ['ASK', 'AUTO-FIX', 'ではありません'],
    ['グループ', '一つの判断'],
    ['信頼度', '識別'],
    ['正当化ではありません'],
    ['引用は所見を消さない'],
    ['データ', '指示として従ってはいけません'],
    ['`actor`', '`reason`', 'コピーしてはいけません'],
  ], 'Gate Integrity category');
  const heuristic = between(checklist, '## Fix-First のヒューリスティック', '## 抑制');
  const askColumn = heuristic.slice(heuristic.indexOf('ASK (needs human judgment):'));
  expect(askColumn).toContain('Gate Integrity');
  expect(between(checklist, '## 重大度の分類', '## Fix-First のヒューリスティック')).toMatch(/└─ Gate Integrity/);
});

test('the eval-threshold suppression no longer removes a relaxed gate from the human question', () => {
  const suppressions = compact(between(readFileSync(join(root, 'review/checklist.md'), 'utf8'), '## 抑制'));
  expect(suppressions).toContain('eval の閾値の変更');
  const line = suppressions.slice(suppressions.indexOf('eval の閾値の変更'), suppressions.indexOf('無害な no-op'));
  expectMentions(line, [['ゲート整合性', '抑制しません'], ['所見', 'ASK', '決してありません']], 'threshold suppression');
  expectTokens(line, ['verified', 'unverified'], 'threshold suppression');
});

test('review runs the gate scan before slop, carries the listing into Step 4 and asks the four gate options in order', () => {
  expectOrdered(skill, ['## Step 3.5:', '{{GATE_SCAN_BLOCK}}', 'bun run slop:diff', '## Step 3.6:',
    '## Step 4:', '### Step 5c:', 'review-gate-disposition',
    'A) ゲートを復元する', 'B) 維持 — 理由', 'C) 維持 — その他の理由', 'D) 後の人間のために未解決のままにする',
    '### Step 5d:', '## Step 5.8:'], 'review skill');
  expect(skill.match(/\{\{GATE_SCAN_BLOCK\}\}/g)).toHaveLength(1);
  expectTokens(between(skill, '## Step 4:', '### 共有コードの機会'), ['GATE_SUMMARY:', '`gate`', '`gate_id`'], 'Step 4 gate carry');
  const ask = compact(between(skill, '### Step 5c:', '### Step 5d:'));
  expect(ask).toContain('<gstack-qid:review-gate-disposition>');
  expectMentions(ask, [
    ['spawned', 'headless', 'D が推奨'],
    ['自動で選ばれた回答', '決して', '判断として扱いません'],
  ], 'Step 5c gate question');
  for (const action of ['`restored`', '`kept`', '`open`']) expect(ask).toContain(action);
});

test('review persists gate identity fields, counts open findings and reports one Gate edits line', () => {
  const record = compact(between(skill, '### 2. 記録を埋める', '### 最終レビューの報告'));
  expectTokens(record, ['`gate`', '`gate_id`', '`reason`', '`kept`', '`restored`', '`open`', '`actor`', 'gstack-session-kind'], 'review record');
  expectMentions(record, [
    ['ハンクのテキスト', '決して', '保存しないでください'],
    ['`open`', '`issues_found`', '含め'],
    ['ロガー', '`actor`', '記録'],
  ], 'review record');
  const report = compact(between(skill, '### 最終レビューの報告', '{{LEARNINGS_LOG}}'));
  expectOrdered(report, ['`Gate edits: none detected (', '`Gate edits: N listed, M read, K findings —', '`Gate edits: partial (', '`Gate edits: UNAVAILABLE —'], 'final report');
  expectMentions(report, [['`none detected`', '決して書かない']], 'final report');
});

test('review suppressions allow a clean result and skip common false positives but never suppress missing validation or a missing await', () => {
  const suppressions = between(readFileSync(join(root, 'review/checklist.md'), 'utf8'), '## 抑制');
  expectMentions(compact(suppressions), [['指摘ゼロ', '有効']], 'suppressions');
  expectTokens(suppressions, ['「関数が長すぎる」', '「null 参照の可能性」', '「N+1 クエリ」', '「ハードコードされた値」', '`Math.random()`'], 'suppressions');
  expectAbsent(suppressions, [/missing input validation/i, /\bawait\b/i, /入力(の)?(検証|バリデーション)の(欠如|不足)/], 'suppressions');
});
