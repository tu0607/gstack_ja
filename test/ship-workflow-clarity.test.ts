import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ALL_HOST_CONFIGS } from '../hosts';
import { generateAdversarialStep } from '../scripts/resolvers/outside-voice-steps';
import { generateQAReview } from '../scripts/resolvers/qa';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { between, compact, expectAbsent, expectMentions, expectOrdered, expectTokens } from './helpers/prompt-structure';
import { readWorkflowExcerpt } from './helpers/workflow-excerpt';

// Structural checks only (docs/test-value-bar.md): headings, step order and machine-read
// tokens. Workflow wording is judged by the ship workflow-clarity judge in skill-llm-eval.
const readShip = () => readWorkflowExcerpt('ship/SKILL.md', '# Ship:', '## 重要なルール');
const readTemplate = (name: string) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const reviewTemplate = readTemplate('ship/sections/review-army.md.tmpl');
const coverageTemplate = readTemplate('ship/sections/test-coverage.md.tmpl');
const entryTemplate = readTemplate('ship/SKILL.md.tmpl');
const controlTemplate = between(entryTemplate, '### Ship の制御フロー', '{{SECTION_INDEX:ship}}');
const entry = compact(entryTemplate);
const reviewFlow = compact(reviewTemplate);
const finalGate = compact(controlTemplate + between(entryTemplate, '## Step 16:', '## Step 17:'));
const pushFlow = compact(between(entryTemplate, '## Step 17:', '## Step 18:'));
const docsTemplate = readTemplate('ship/sections/documentation.md.tmpl');
const docs = compact(docsTemplate);
const prTemplate = readTemplate('ship/sections/pr-body.md.tmpl');

test('ship QA starts its smoke guard before probes on every host', () => {
  for (const host of ALL_HOST_CONFIGS) {
    const body = generateQAReview({ host: host.name, skillName: 'ship', tmplPath: '', paths: HOST_PATHS[host.name] });
    expectOrdered(body, [/スモークガード/, '**3. スモークとプランのチェックを実行します。**'], `${host.name} ship QA`);
  }
});

test('ship reports QA in the PR template headings, not a second combined report', () => {
  const ship = compact(readShip());
  expectTokens(ship, ['`## Exploratory QA`', '`## Verification Results`', '`templates/functional-report-template.md`'], 'ship QA reporting');
  expectAbsent(ship, ['## Exploratory QA and Verification Results'], 'ship QA reporting');
});

test('the invocation record keeps state tokens and scoped start markers', () => {
  expectTokens(entry, ['**実行記録 (invocation record)**', '`BUMP_LEVEL`', 'Step 1–21', '11.5', '14.5'], 'ship entry');
  const state = compact(between(entryTemplate, '### ステップ間の状態の保持', '{{SECTION_INDEX:ship}}'));
  expectTokens(state, ['`gstack-review-log --start`', '`REVIEW_START`', '`PASS_START`', '`DESIGN_START`', '`gstack-wtree`'], 'ship state');
  expectMentions(entry, [['トークン', '借用', 'ない']], 'ship entry');
});

test('plan obligations precede scope drift, learnings and review', () => {
  const plan = readTemplate('ship/sections/plan-completion.md.tmpl');
  expectOrdered(compact(between(plan, /^/, '**このステップはサブエージェントとして dispatch してください。**')), ['1. 監査を dispatch', '2. Step 8.1', '3. Step 8.2', '4. 過去の学習内容'], 'plan-completion route');
  expectOrdered(plan, ['{{PLAN_COMPLETION_GATE_SHIP}}', '{{PLAN_VERIFICATION_EXEC}}', '{{SCOPE_DRIFT}}', '{{LEARNINGS_SEARCH:'], 'plan-completion placeholders');
  expectOrdered(entryTemplate, ['{{SECTION:plan-completion}}', '{{SECTION:review-army}}'], 'ship entry sections');
  const section = readTemplate('ship/sections/plan-completion.md');
  expectOrdered(section, ['## Step 8.1:', '## Step 8.2:', '## Prior Learnings'], 'plan-completion section');
  expectMentions(section, [['NOT DONE', 'ブロック']], 'plan-completion section');
});

test('the parent owns one ordered review phase that persists each pass once', () => {
  expectTokens(reviewFlow, ['CYCLES', '`converged:false`', '--finish REVIEW_START', '`CONVERGED`', '`status:"unavailable"`', '`completed:false`',
    'Pre-Landing Review: INCOMPLETE', /`STATUS`:[^。]*`unavailable`/], 'ship review phase');
  expectOrdered(reviewTemplate, ['4. **', '5. 概要を出力します:', '6. レビュー結果をレビューログに永続化します', '### Step 9 を繰り返すかどうか判断する'], 'ship review phase');
  expectTokens(compact(between(reviewTemplate, '4. **', '5. 概要を出力します:')), ['CYCLES', 'REVIEW_START', '`converged:false`'], 'review finalize step');
});

test('named QA risks need explicit acceptance through AskUserQuestion', () => {
  const gate = compact(between(reviewTemplate, '**必要なプローブの親ゲート:**'));
  expectTokens(gate, ['AskUserQuestion'], 'required-probe gate');
  expectMentions(gate, [['リスク', '受け入れ'], ['スキップ', '合格', '見なしません']], 'required-probe gate');
});

test('coverage generation has one bounded allowance and an audit-only child prompt', () => {
  const allowance = compact(between(coverageTemplate, /^/, '````text'));
  expectTokens(allowance, ['生成のパスは合計 2 回まで', 'パスごと 30 件、パスごと 5 件のテスト、テストごと 2 分'], 'coverage allowance');
  const prompt = coverageTemplate.split('````text\n')[1]?.split('\n````')[0] ?? '';
  expectTokens(prompt, ['Generation: <allowed|audit-only>; passes used: <N> of 2.', '"coverage_pct":N,"gaps":N', '"tests_added":["path",...]'], 'coverage child prompt');
  expectOrdered(prompt, [/audit-only/, '{{TEST_COVERAGE_AUDIT_SHIP}}'], 'coverage child prompt');
  expectMentions(prompt, [['not', 'commit'], ['not', 'push']], 'coverage child prompt');
});

test('design-lite runs before the Design specialist and reports a fixed JSON shape', () => {
  expectOrdered(reviewTemplate, ['{{DESIGN_REVIEW_LITE}}', '{{REVIEW_ARMY}}'], 'ship review army');
  expectTokens(reviewTemplate, ['"dispatched":true,"findings":N,"critical":N,"informational":N'], 'ship review army');
});

test('late adversarial and comment fixes queue for the parent outside Step 9.4', () => {
  const ship = readShip();
  expectMentions(compact(between(ship, '## Step 11:', '## Step 12:')), [['親', 'キュー']], 'ship Step 11');
  expectMentions(compact(between(ship, '## Step 10:', '## Step 11:')), [['編集せず', 'キュー']], 'ship Step 10');
});

test.each(ALL_HOST_CONFIGS.map(({ name }) => name))('%s: ship adversarial approvals queue and only ship carries the finish phase', host => {
  const ctx = { host, skillName: 'ship', tmplPath: '', paths: HOST_PATHS[host] };
  expectMentions(compact(generateAdversarialStep(ctx)), [['編集せず', 'キュー'], ['外部カバレッジ']], `${host} ship adversarial`);
  const standalone = generateAdversarialStep({ ...ctx, skillName: 'review' });
  expectAbsent(standalone, ['Step 11.5 の前に', '### 敵対的フェーズを終える'], `${host} review adversarial`);
  expectTokens(standalone, [/Step 5 の Fix-First/], `${host} review adversarial`);
});

test('outside challenge availability keeps the review gates and fix limit', () => {
  const adversarial = compact(readTemplate('ship/sections/adversarial.md'));
  expectTokens(adversarial, ['P0/P1', 'Step 9 の 3 サイクルという修正の上限'], 'ship adversarial section');
  const standaloneReview = readTemplate('review/sections/adversarial.md');
  expectTokens(standaloneReview, ['Step 5 の Fix-First'], 'review adversarial section');
  expectAbsent(standaloneReview, ['Step 11'], 'review adversarial section');
});

test('Step 11.5 reads review records and blocks on a mismatch', () => {
  const receipt = compact(between(entryTemplate, '## Step 11.5:', '## Step 12:'));
  expectTokens(receipt, ['~/.claude/skills/gstack/bin/gstack-review-read', '**Review records missing or mismatched**'], 'ship Step 11.5');
  expectAbsent(receipt, ['phase:"core"', 'Step 9.5', 'source:"in-host"', 'status:"clean"'], 'ship Step 11.5');
});

test('version recovery and digest generation keep their tokens', () => {
  const version = compact(between(entryTemplate, '## Step 12:', '## Step 14:'));
  expectTokens(version, ['`baseVersion`', '`currentVersion`', 'ALREADY_BUMPED', '`agents-digest/gstack-AGENTS.md`', '`agentsDigest`', '`bun --no-env-file --config=/dev/null scripts/gen-agents-digest.ts`'], 'ship version step');
  expectAbsent(version, ['skip if ALREADY_BUMPED'], 'ship version step');
});

test('distribution setup detects new targets and never invents credentials', () => {
  const distribution = compact(between(entryTemplate, '## Step 2:', '## Step 3:'));
  expectTokens(distribution, ['git diff origin/<base> --diff-filter=A --name-only'], 'ship Step 2');
  expectMentions(distribution, [['認証情報', '勝手に作ってはいけません']], 'ship Step 2');
});

test('ambiguous Apple targets and merge conflicts stop for AskUserQuestion', () => {
  const apple = compact(between(entryTemplate, '## Step 0.9:', '## Step 1:'));
  expectTokens(apple, ['`Package.swift`', 'AskUserQuestion'], 'ship Step 0.9');
  const merge = compact(between(entryTemplate, '## Step 3:', '{{SECTION:tests}}'));
  expectTokens(merge, ['AskUserQuestion'], 'ship Step 3');
  expectMentions(merge, [['コンフリクト', 'STOP']], 'ship Step 3');
});

test('missing test suites offer a named-gap decision and never report FRESH', () => {
  const tests = compact(readTemplate('ship/sections/tests.md.tmpl'));
  expectTokens(tests, ['A) テストを追加する', 'B) 明記されたテストのギャップを残したまま出荷する', 'C) 停止する'], 'ship tests section');
  expectTokens(finalGate, ['FRESH'], 'ship Step 16');
  expectMentions(finalGate, [['テスト対象外', '承認']], 'ship Step 16');
});

test('Step 16 stages run in order and freeze inputs through push', () => {
  expectOrdered(finalGate, ['### 1. 書き込みを終えて、出力を準備する', '### 2. 変更ルートを選ぶ',
    '### 3. ドキュメントの鮮度を解決する', '### 4. 凍結された候補を検証する', '**入力が一致するときはチェックを再利用します。**'], 'ship Step 16');
  const route = compact(between(entryTemplate, '### 2. 変更ルートを選ぶ', '### 3. ドキュメントの鮮度を解決する'));
  expectOrdered(route, ['**動作、テスト、またはビルドの入力が変わった:**', '**作成者によるドキュメントやリリースのメタデータのみが変わった:**',
    '**変更がない、またはドキュメントのみのチェックが計画をまだ支持している:**'], 'ship change route');
  expectTokens(finalGate, ['**Build failed or prerequisite missing**', '**各テストレーンのレシートも確認します。**'], 'ship Step 16');
  expectMentions(finalGate, [['凍結', 'push']], 'ship Step 16');
});

test('evidence exemptions cover only release metadata and receipts name their command', () => {
  expectTokens(finalGate, ['--allow-paths CHANGELOG.md,VERSION,package.json,agents-digest/gstack-AGENTS.md', '| FRESH (終了コード 0) |',
    "--label <lane> --expect-cmd '<exact Step 5 command>'", '~/.claude/skills/gstack/bin/gstack-wtree', 'git diff <reviewed-tree> <current-tree>'], 'ship evidence gate');
});

test('docs attempts are collected by the parent with typed result fields', () => {
  expectTokens(docs, ['`files_updated`', '`documentation_section`', '`blocked`'], 'ship documentation section');
  expectOrdered(docsTemplate, ['**サブエージェントのプロンプト:**', '**親による処理:**'], 'ship documentation section');
  const freshness = compact(between(entryTemplate, '### 3. ドキュメントの鮮度を解決する', '### 4. 凍結された候補を検証する'));
  expectTokens(freshness, ['Step 14.5'], 'ship docs freshness');
  const retry = between(freshness, '**試行回数が残っており、入力が変更されているか、利用可能な修復がある:**', '**それ以外の場合:**');
  expectAbsent(retry, ['Continue to stage 4', '段階 4 に進'], 'ship docs retry');
  expectTokens(retry, [/段階 1 から Step 16|Step 16 の段階 1/], 'ship docs retry');
  expectOrdered(entryTemplate, ['## Step 14.5:', '## Step 17:'], 'ship entry');
});

test('late verified outputs are committed before push, without tags', () => {
  expectOrdered(compact(between(entryTemplate, '### 5. 報告してから push する', '## Step 17:')), [/コミット/, 'Step 17 に進みます'], 'ship Step 16.5');
  expectMentions(entry, [['git タグ', '付けません']], 'ship entry');
  expectOrdered(pushFlow, ['**Non-fast-forward の push:**', '**認証、フック、またはネットワークの失敗:**'], 'ship Step 17');
  expectTokens(pushFlow, ['`ALREADY_PUSHED`'], 'ship Step 17');
});

test('Step 18 resolves open PR state before preparing the title file Step 19 posts', () => {
  const lookup = compact(between(entryTemplate, '## Step 18:', '{{SECTION:pr-body}}'));
  expectOrdered(lookup, ['gh pr list --head <branch-name> --state open --json number,title,url', 'タイトルを準備'], 'ship Step 18');
  expectTokens(lookup, ['glab mr list --source-branch <branch-name> --output json'], 'ship Step 18');
  const title = compact(between(prTemplate, '### タイトルを用意する (Step 18)', '## Step 19:'));
  expectOrdered(title, ['{{FREE_TEXT_FILE:TITLE_FILE=pr-title}}', 'gstack-pr-title-rewrite.sh <new-version> --stdin > "$TITLE_FILE"'], 'ship Step 18 title');
  expectTokens(title, ['`v<NEW_VERSION> <type>: <summary>`', '`v$NEW_VERSION `', "grep -Eq '^v<new-version>( |$)' \"$TITLE_FILE\""], 'ship Step 18 title');
  expectAbsent(compact(entryTemplate + prTemplate), ['"<current title>"', 'NEW_TITLE'], 'ship Steps 18-19');
  expectTokens(prTemplate, ['--title-file "$TITLE_FILE"', 'exit 1', '**3**'], 'ship pr-body');
  const generated = readTemplate('ship/sections/pr-body.md');
  expectTokens(generated, ['**既存の open な PR/MR**'], 'ship pr-body section');
});

test('linked spec discovery reads frontmatter fields and claims closure only for completed scope', () => {
  const instructions = compact(between(prTemplate, /^/, 'PR/MR の本文には次のセクションを含めます'));
  expectTokens(instructions, ['`spec_branch`', '`spec_filed_at`', '`spec_issue_number`', '`## Linked Spec`', '`Closes #N`', '`Linked to #N`'], 'ship linked spec');
  expectMentions(instructions, [['frontmatter', 'ソース', 'データ']], 'ship linked spec');
  const body = between(prTemplate, 'PR/MR の本文には次のセクションを含めます', '#### 本文を作成し、gstack-post で公開する');
  expectAbsent(body, ['CURRENT_BRANCH=', 'SPEC_ARCHIVES=', 'SPEC_FILE=$(grep'], 'ship pr body');
  expectAbsent(prTemplate, ['[ -z "$SPEC_FILE" ] && exit'], 'ship pr-body');
});

test('comment triage reports one of three statuses with fixed result strings', () => {
  const section = compact(readTemplate('ship/sections/greptile.md.tmpl'));
  expectTokens(section, ['"status":"complete|no_pr|unavailable"', '`complete`', '`no_pr`', '`unavailable`',
    '「Greptile: no PR exists」', '「Greptile: fetched, zero comments」', '`Greptile triage: UNAVAILABLE (dispatch failed)`'], 'ship greptile section');
  expectAbsent(section, ['If no PR exists, `gh` fails, the API errors, or there are zero comments'], 'ship greptile section');
});

test('ship resolves branch and installed-asset references without competing instructions', () => {
  expectAbsent(entryTemplate, ['Test coverage gaps within target threshold', '`.claude/skills/review/TODOS-format.md`'], 'ship entry');
  expectOrdered(entryTemplate, ['`<branch-name>`', 'refs/heads/<branch-name>'], 'ship entry');
  expectTokens(entryTemplate, ['~/.claude/skills/gstack/review/TODOS-format.md'], 'ship entry');
  expectTokens(entry, ['## Step 16: 検証ゲート'], 'ship entry');
  const row = readTemplate('ship/SKILL.md').split('\n').find(line => line.startsWith('| Fix-First の前の探索的 QA'));
  expect(row, 'ship section index lost its exploratory QA row').toBeDefined();
  expectTokens(row!, ['`sections/review-army.md`'], 'ship section index');
});
