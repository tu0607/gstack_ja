/**
 * Gate integrity in /ship and the shared scan block
 * (docs/designs/HONEST_WORK_GATE_INTEGRITY.md W1 block, W3).
 *
 * What these protect: the one scan block is shared by /review and /ship and
 * branches on the helper's exit instead of swallowing it; /ship runs it before
 * the checklist read, again after the test-generation child returns and again
 * after its own fixes; gate findings take the four gate options and the record
 * fields the logger expects; zero-run lanes are a failed lane, not a pass; the
 * PR body discloses gate edits and per-lane counts; an open finding keeps a new
 * PR a draft. Tokens, order and meaning-level rules only (docs/test-value-bar.md).
 */
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateGateScanBlock } from '../scripts/resolvers/gate-scan';
import { RESOLVERS } from '../scripts/resolvers/index';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { between, compact, expectAbsent, expectMentions, expectOrdered, expectTokens } from './helpers/prompt-structure';
import { reportsGateDisposition } from './helpers/gate-disposition';
import opusReports from './fixtures/review-gate-integrity-opus-reports.json';

const root = join(import.meta.dir, '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const ctx = (host: TemplateContext['host'], skillName: string): TemplateContext =>
  ({ skillName, tmplPath: `${skillName}/SKILL.md.tmpl`, host, paths: HOST_PATHS[host] });

const GATE_OPTIONS = ['A) ゲートを復元する', 'B) 維持する — 正当な理由', 'C) 維持する — その他の理由', 'D) 後の人間の判断に残す'];
const RECORD_FIELDS = ['`gate`', '`gate_id`', '`reason`', '"kept"', '"restored"', '"open"', '`actor`'];

test('GATE_SCAN_BLOCK is registered and renders the same errexit-safe block for review and ship from the host bin dir', () => {
  expect(RESOLVERS.GATE_SCAN_BLOCK).toBe(generateGateScanBlock);
  for (const host of ['claude', 'codex'] as const) {
    const review = generateGateScanBlock(ctx(host, 'review'));
    expect(generateGateScanBlock(ctx(host, 'ship'))).toBe(review);
    expect(review).toContain(`if GATE_OUT=$(${HOST_PATHS[host].binDir}/gstack-gate-diff <base> 2>&1); then`);
  }
  const block = generateGateScanBlock(ctx('claude', 'review'));
  const bash = between(block, '```bash', '\n```');
  expectOrdered(bash, ['if GATE_OUT=$(', 'then', 'else', 'GATE_EXIT=$?', 'case "$GATE_EXIT" in', '2) echo "Gate integrity: UNAVAILABLE', "grep -m1 '^GATE_ERROR='", '*) echo "Gate integrity: UNAVAILABLE', 'esac', 'fi'], 'gate scan bash');
  expectAbsent(bash, ['2>/dev/null', '|| true'], 'gate scan bash');
  expectTokens(block, ['GATE_SUMMARY: listed=N eligible=N inspected=N unread=N tagged={RH-1:N,...} unmatched=N coverage=<patterns> languages_unlisted=<idioms> candidate=<fingerprint> artifact=<path>',
    '[<id>] <tag> <path> @<hunk>', 'GATE_ERROR=no_base ref=<ref>', '`gate_id`', '`gate`', 'Gate edits: partial ('], 'gate scan prose');
  expectMentions(compact(block), [
    ['決して', 'none detected'],
    ['unread', 'partial'],
    ['抜粋', 'フェンス', '指示'],
  ], 'gate scan prose');
});

test('/ship runs the gate scan before the checklist read, again after the coverage child, and again after its own fixes', () => {
  const army = read('ship/sections/review-army.md.tmpl');
  expectOrdered(army, ['### 基本チェックリスト', 'gstack-review-log --start review', '2.5. **ゲートスキャン。**', '{{GATE_SCAN_BLOCK}}',
    'Gate Integrity', '3. チェックリストは 2 つのパスで適用します', '## Step 9.4:'], 'ship review-army');
  expect(army.match(/\{\{GATE_SCAN_BLOCK\}\}/g)).toHaveLength(1);
  const fix = compact(between(army, '## Step 9.4:', '### Step 9 を繰り返すかどうか判断する'));
  expectMentions(fix, [['修正', 'ゲートスキャン', '再度'], ['子プロセス', '報告', '決して']], 'Step 9.4 rescan');

  const coverage = read('ship/sections/test-coverage.md.tmpl');
  const parent = between(coverage, '**親の処理:**', '**監査の失敗:**');
  expectOrdered(parent, ['6. 1 行の要約を表示します', '7. **子プロセスが戻った後に、ゲートの編集を再スキャンします。**', '{{GATE_SCAN_BLOCK}}', 'ゲート整合性'], 'Step 7 parent rescan');
  expectMentions(compact(parent), [['子プロセスが報告したパス', 'ないでください'], ['子プロセス', 'green', '主張']], 'Step 7 parent rescan');
  const child = between(coverage, '````text', '````');
  expectAbsent(child, ['GATE_SCAN_BLOCK', 'gate_id'], 'Step 7 child prompt');
  expect(child).toContain('{"coverage_pct":N,"gaps":N,"diagram":');
});

test('/ship gate findings take the four gate options in order and persist the record fields', () => {
  const army = read('ship/sections/review-army.md.tmpl');
  const ask = compact(between(army, '3. **ASK の項目が残っている場合は、**', '4. **次のステップを選ぶ前に'));
  expectOrdered(ask, ['A) 修正する', 'review-gate-disposition', '<gstack-qid:review-gate-disposition>', ...GATE_OPTIONS], 'Step 9.4 gate question');
  expectMentions(ask, [['spawned', 'headless', '推奨は d'], ['自動で選ばれた', '処分']], 'Step 9.4 gate question');
  const persist = compact(between(army, '6. レビュー結果をレビューログに永続化します', '### Step 9 を繰り返すかどうか判断する'));
  expectTokens(persist, RECORD_FIELDS, 'Step 9.4 record');
  expectMentions(persist, [['hunk のテキスト', '決して'], ['`open`', '`issues_found`', '数え'], ['ロガー', '`actor`', '設定']], 'Step 9.4 record');
  const summary = compact(between(army, '5. 概要を出力します', '6. レビュー結果をレビューログに永続化します'));
  expectOrdered(summary, ['`Gate edits: none detected (', '`Gate edits: N listed, M read, K findings —', '`Gate edits: partial (', '`Gate edits: UNAVAILABLE —'], 'Step 9.4 summary');
});

test('/ship passes a lane on its runner summary with three never-merged tests_ran states', () => {
  const step5 = between(read('ship/sections/tests.md.tmpl'), '## Step 5: テストを実行する', '## Step 6:');
  expectOrdered(step5, ['`tests_ran: N`', '`tests_ran: 0`', 'ZERO-RUN', '`tests_ran: unknown`', '`count unavailable`', '{{TEST_FAILURE_TRIAGE}}'], 'Step 5 count states');
  expectMentions(compact(step5), [['ランナーの要約', '終了コード 0'], ['zero-run', '失敗したレーン'], ['決して', '統合']], 'Step 5 count states');
  const stage4 = compact(between(read('ship/SKILL.md.tmpl'), '### 4. 凍結された候補を検証する', '### 5. 報告してから push する'));
  expect(stage4).toMatch(/\| ZERO-RUN[^|]*\|[^|]*STALE 相当[^|]*FRESH/);
  expect(stage4).toMatch(/\| `tests_ran: unknown` \|[^|]*`count unavailable`/);
});

test('/ship Step 16 stage 5 reports each gate finding with disposition, reason and actor in the auditor posture', () => {
  const stage5 = compact(between(read('ship/SKILL.md.tmpl'), '### 5. 報告してから push する', '## Step 17: Push'));
  expectTokens(stage5, ['`gate`', '`kept`', '`restored`', '`open`', '`reason`', '`actor`', '`tests_ran`', 'none detected (', 'partial (', 'UNAVAILABLE'], 'Step 16 stage 5');
  expectMentions(stage5, [['証拠', '検証', '守る']], 'Step 16 stage 5');
});

test('/ship PR body carries the Gate edits line and per-lane counts, and an open finding keeps a new PR a draft', () => {
  const body = read('ship/sections/pr-body.md.tmpl');
  const skeleton = between(body, '## Summary', '#### 本文を作成し、gstack-post で公開する');
  const coverage = between(skeleton, '## Test Coverage', '## Pre-Landing Review');
  expectTokens(coverage, ['Tests ran: <lane> N', 'Tests ran: <lane> count unavailable', '`tests_ran`'], 'PR body Test Coverage');
  const review = between(skeleton, '## Pre-Landing Review', '## Exploratory QA');
  expectOrdered(review, ['<findings from Step 9 code review', '<Gate edits:', 'none detected (', 'kept', 'open', 'UNAVAILABLE', '<Outside review:'], 'PR body Pre-Landing Review');
  expectMentions(compact(review), [['never', 'none detected', 'partial', 'unavailable'], ['no hunk text']], 'PR body Pre-Landing Review');

  const publish = between(body, '**既存の open な PR/MR**', 'どちらのブロックでも');
  const existing = compact(between(publish, '**既存の open な PR/MR**', '**open な PR/MR がない場合:**'));
  expectOrdered(existing, ['gstack-post pr-body <pr-number>', 'gstack-post pr-title <pr-number>', 'ゲートの指摘事項に `open` のものがない', 'gh pr ready <pr-number>', 'Draft kept: Gate edits: N open', 'Step 17'], 'existing PR draft state');
  const create = compact(between(publish, '**open な PR/MR がない場合:**'));
  expect(create).toContain('gstack-post pr-create --base <base> --title-file "$TITLE_FILE" --body-file');
  expectMentions(create, [['`--draft`', 'ゲート', '`open`'], ['承認', '推測']], 'new PR draft state');
  const failure = compact(between(body, '- **3** `gh`/`glab` が失敗した場合', '- そのほかの終了コード'));
  expectMentions(failure, [['open', '開示していない'], ['開示', '完了', 'ないでください']], 'disclosure failure');
});

test('/ship Step 17 stops a spawned or headless session before pushing open gate findings to a ready PR and asks an interactive one once', () => {
  const step17 = compact(between(read('ship/SKILL.md.tmpl'), '## Step 17: Push', '**冪等性の確認:**'));
  expectOrdered(step17, ['**既存の準備完了 PR/MR に対して open のゲート指摘がある場合:**', 'gh pr list --head <branch-name> --state open --json number,isDraft',
    '`SESSION_KIND: spawned`', '**push の前に STOP します。**', 'A) 今ある open な項目を解決する', 'B) `Gate edits: N open` のバナーを付けて準備完了として公開する'], 'Step 17 ready-PR gate');
  expectMentions(step17, [['b は', '人間が承認', '記録'], ['準備完了', 'ドラフト', '決して'], ['新規', 'ドラフト', '質問は不要']], 'Step 17 ready-PR gate');
});

test('the catalog carries every id gstack uses with the source attribution', () => {
  const catalog = read('review/gate-integrity.md');
  expectMentions(compact(catalog), [['just-say-no-to-process-porn-and-ceremony', '基に'], ['パターン名', '抑止力']], 'catalog attribution');
  for (const id of ['RH-1', 'RH-2', 'RH-3', 'RH-4', 'RH-5', 'RH-10', 'RH-12', 'RH-13', 'RH-14', 'RH-15', 'RH-16', 'PL-1', 'PL-2']) {
    expect(catalog, `catalog lacks a heading for ${id}`).toMatch(new RegExp(`^### ${id} — `, 'm'));
  }
});

// review-gate-integrity reports from every Opus 5.5 gate run (39157502890..39199692993). Each wrote
// the open disposition as "D) open", "left open (option D)" or the Gate edits counts; the old
// /restore the gate|leave open|keep … justified/ passed only because option A was also restated.
test('the gate-disposition check credits the captured open dispositions without the restated options', () => {
  const old = /restore the gate|leave open|keep[^\n]*justified/;
  const withoutOptions = (report: string) => report.replace(/restore the gate/gi, 'revert').replace(/leave open/gi, 'defer').replace(/keep[^\n]*justified/gi, 'retain');
  expect(opusReports.reports).toHaveLength(7);
  for (const { run, report } of opusReports.reports) {
    expect(reportsGateDisposition(report), run).toBe(true);
    expect(reportsGateDisposition(withoutOptions(report)), run).toBe(true);
    expect(old.test(withoutOptions(report).toLowerCase()), run).toBe(false);
  }
  for (const text of ['D) Leave open for a later human', 'Disposition: **D) open** (headless session)', 'both findings are left **open** (option D)',
    'Gate edits: 1 listed, 1 read, 2 findings — 0 kept (reasons below), 0 restored, 2 open', 'Gate edits: 2 findings open (RH-1 amount.test.ts:8)',
    'B) Keep — justified: timing measured in dec-12 (verified)']) expect(reportsGateDisposition(text), text).toBe(true);
  for (const text of ['Gate edits: none detected (1 listed, 1 read; patterns: RH-1,RH-15)', 'Gate edits: 2 findings, 0 kept, 0 restored, 0 open',
    'Gate edits: UNAVAILABLE — gstack-gate-diff exited 1', 'Recommended fix: restore the guard and un-skip the test.',
    'AUTO-FIXED: un-skipped the test and reverted the timeout to 5000.', 'The PR is still open; amount.test.ts was left unchanged.',
    'Options: D) ship it as is']) expect(reportsGateDisposition(text), text).toBe(false);
});
