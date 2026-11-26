/**
 * plan-ceo-review carve — static ordering guard (GATE tier, free, deterministic).
 *
 * This is the per-PR mechanical backstop for the v2-plan Phase B carve of
 * plan-ceo-review (Codex outside-voice P2). The periodic real-PTY E2E
 * (skill-e2e-plan-ceo-review-section-loading.test.ts) is the behavioral proof,
 * but it runs weekly and costs money. This file runs on every `bun test` and
 * fails CI the moment the carve's structural invariants break:
 *
 *  1. The skeleton points at the section with a STOP-Read directive, and that
 *     directive sits AFTER Step 0 (scope + mode) — so the conversational Step 0
 *     stays in the always-loaded skeleton, never stranded in the on-demand file.
 *  2. The heavy review body (Sections 1-11) is NOT in the skeleton — it moved to
 *     the section. A regression that inlines it back would re-bloat the skeleton.
 *  3. The review report writer ("GSTACK REVIEW REPORT") lives in the section, and
 *     the blocking EXIT PLAN MODE GATE that verifies it lives in the skeleton
 *     AFTER the STOP — so the gate fires once the section work returns.
 *  4. Nothing review-governing sits in the skeleton below the STOP (Codex P1):
 *     no "Section N", no "## Mode Quick Reference", no "## Formatting Rules".
 */

import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createHash } from 'node:crypto';
import { validateCeoReviewCompletion } from './helpers/auq-sdk-capture';
import { generateAntiShortcutClause, generateSpecReviewLoop } from '../scripts/resolvers/spec-review';
import { generatePlanFileReviewReport } from '../scripts/resolvers/review-dashboard';
import { generatePlanReviewApprovalCheck, generateExitPlanModeGate } from '../scripts/resolvers/plan-gates';
import { generateCodexPlanReview } from '../scripts/resolvers/outside-voice-steps';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { ALL_HOST_CONFIGS } from '../hosts';
import { generateTasksSectionEmit } from '../scripts/resolvers/tasks-section';
import { generateBrainCacheRefresh } from '../scripts/resolvers/gbrain';
import { runGeneration } from '../scripts/gen-skill-docs';
import { ASK_QUESTIONS_HEADING } from './helpers/workflow-excerpt';
import { expectMentions } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const SKELETON = path.join(ROOT, 'plan-ceo-review', 'SKILL.md');
const SECTION = path.join(ROOT, 'plan-ceo-review', 'sections', 'review-sections.md');

// Prose wrapping is not the contract; keep raw documents for line/heading guards.
const compactProse = (value: string) => value.replace(/\s+/g, ' ').trim();

// Anchors are exact labels, headings, placeholders or table cells (strings) or
// case-insensitive meaning checks (RegExp); they must all exist, in this order.
const ordered = (text: string, anchors: Array<string | RegExp>) => {
  const positions = anchors.map(anchor => typeof anchor === 'string' ? text.indexOf(anchor) : text.search(anchor));
  expect(positions.every(position => position >= 0), `missing one of ${anchors.map(String).join(' | ')}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
};

const between = (text: string, start: string, end: string) => {
  const from = text.indexOf(start);
  expect(from, `missing ${start}`).toBeGreaterThan(-1);
  const to = text.indexOf(end, from + start.length);
  expect(to, `missing ${end} after ${start}`).toBeGreaterThan(-1);
  return text.slice(from + start.length, to);
};

const skeletonSource = () => fs.readFileSync(`${SKELETON}.tmpl`, 'utf8');
const sectionSource = () => fs.readFileSync(`${SECTION}.tmpl`, 'utf8');

// Source-order and meaning guards; the selected judge remains the clarity proof.
test('CEO decision cycle returns to its caller with two complete persistence checkpoints', () => {
  const cycle = compactProse(between(skeletonSource(), '### 0D.', '### 0E.'));
  ordered(cycle, ['**1. 情報源と過去の回答を確認する。**', '**2. 保留中の選択を記録する。**',
    '**3. その行の選択肢を比較して保存する。**', 'Commitment | Source/approval or pending | Current | A | B | C',
    '**質問前のチェックポイント:**', '**4. 質問し、回答を記録し、修正する。**', '**回答後のチェックポイント:**']);
  expect(cycle.match(/\*\*(?:質問前|回答後)のチェックポイント:\*\*/g)).toHaveLength(2);
  expectMentions(cycle, [['モード選択ではなく呼び出し元に戻ります']], 'cycle');
  expectMentions(cycle.split('**回答後のチェックポイント:**')[1], [['呼び出し元のステップに戻り', '二度と尋ねないでください']], 'section');
});

test('CEO mode provenance separates an explicit instruction from asked and automatic question logs', () => {
  const mode = between(skeletonSource(), '### 0E.', '### 0F.');
  const rows = mode.split('\n').filter(line => /^- \*\*(ユーザーの明示的な選択|好みの確認が成功した場合|実際の質問への回答):\*\*/.test(line));
  expect(rows).toHaveLength(3);
  expect(rows[0]).toContain('質問ログはありません');
  expect(rows[1]).toContain('`auto_decided: true`');
  expect(rows[2]).toContain('`auto_decided: false`');
  expect(mode.indexOf('**ユーザーの明示的な選択:**')).toBeGreaterThan(mode.indexOf('4. **モードの引き継ぎ:**'));
});

test('CEO scope destinations preserve deferrals without asking their already answered TODO again', () => {
  const scope = compactProse(between(skeletonSource(), '### 0G.', '### 0H.'));
  ordered(scope, ['**先送り:**', '**見送り / 削除:**']);
  const defer = between(scope, '**先送り:**', '**見送り / 削除:**');
  expect(defer).toContain('TODOS.md');
  expect(defer).toContain('スコープ外');
  expect(scope.split('**見送り / 削除:**')[1]).toMatch(/スコープ外に記録します。TODO にはしません/);
  const todoMenu = compactProse(between(sectionSource(), '### TODOS.md の更新', '{{PLAN_REVIEW_APPROVAL_CHECK}}'));
  expectMentions(todoMenu, [['このメニューに出るのは', '未回答のTODO提案だけです']], 'todoMenu');
  expectMentions(todoMenu, [['すでに先送り', 'スキップ', '改めて尋ねず']], 'todoMenu');
  expectMentions(todoMenu, [['1問につき1件']], 'todoMenu');
  const readiness = compactProse(generatePlanReviewApprovalCheck({ skillName: 'plan-ceo-review' } as TemplateContext));
  expectMentions(readiness, [['その選択は未解決のままとなり']], 'readiness');
  expectMentions(readiness, [['却下された変更', '先送りされた変更', '承認済みの作業に含めません']], 'readiness');
});

test('CEO completion facts precede summary and report while publication follows readback', () => {
  const section = sectionSource();
  ordered(section, ['{{PLAN_REVIEW_APPROVAL_CHECK}}', '### レビューの事実', '### 完了サマリー',
    '{{PLAN_FILE_REVIEW_REPORT}}', '**完了サマリーを公開:**', '## レビューログ']);
});

// These source scenarios guard instruction branches, not native execution.
test('CEO handoff allows no pending choice without inventing an approval', () => {
  const source = skeletonSource();
  const initial = compactProse(between(source, '### 0C.', '### 0D.'));
  const approach = compactProse(between(source, '### 0D.', '### 0E.'));
  const handoff = compactProse(between(source, '**モードの引き継ぎ:**', '### 0F.'));
  const noChoice = approach.search(/新しい回答が不要な場合/);
  expect(noChoice).toBeGreaterThan(0);
  expect(noChoice).toBeLessThan(approach.indexOf('**2. 保留中の選択を記録する。**'));
  expectMentions(approach, [['代替案や承認を作り出してはいけません']], 'approach');
  expectMentions(initial, [['0E の前に', '未解決のアプローチ']], 'initial');
  ordered(initial, ['A) 現在の、または依頼されたプラン', 'B) 最小限にスコープを絞った代替案', 'C) より大きいアプローチ、または書き直し']);
  expectMentions(handoff, [['新しいアプローチの判断は不要でした']], 'handoff');
  expectMentions(handoff, [['0D の承認を維持し']], 'handoff');
});

test('CEO handoff carries all answered rows instead of one synthetic approach', () => {
  const handoff = between(skeletonSource(), '**モードの引き継ぎ:**', '### 0F.');
  expect(handoff).toContain('Auto-decided review mode → <selected mode> (your preference)');
  expect(handoff).toContain('Mode: <selected mode>; approved decisions: <rows or none>');
  expect(handoff).not.toContain('<approved 0D approach>');
});

// ci-37176837432 paid-slice-3 HOLD SCOPE skipped the helper and paraphrased ("holding scope");
// ci-37198445662 paid-slice-3 HOLD SCOPE ran it, then wrote the plan, loaded sections and probed Codex
// for 114 s before the posture chat. Both spent the case's 240 s post-selection window.
test('CEO mode handoff chat follows the helper before any other tool call', () => {
  const selection = between(skeletonSource(), '### 0E. モード選択', '### 0F.');
  const instruction = compactProse(selection.slice(selection.indexOf('4. **モードの引き継ぎ:**')).split('\n')[0]!);
  expectMentions(instruction, [['他のツール呼び出し、プランの書き込み、セクションの読み込みの前に', 'ヘルパーを決して省略しないでください']], 'instruction');
});

// A2/auto-decide: Claude Code 2.1.284 collapses the helper's Bash output ("Ran 1 shell command"), so the
// printed line reaches the user only through chat. Census reds 37176837432, 37179171083 and 37182865432
// paraphrased it ("HOLD SCOPE was auto-selected…", "Mode decision done…", "I'm defaulting to HOLD SCOPE…");
// every passing capture's chat starts with "Auto-decided review mode →".
test('CEO mode handoff chat repeats the printed line verbatim because tool output is collapsed', () => {
  const selection = between(skeletonSource(), '### 0E. モード選択', '### 0F.');
  const instruction = compactProse(selection.slice(selection.indexOf('4. **モードの引き継ぎ:**')).split('\n')[0]!);
  expectMentions(instruction, [['その行で始まる短いチャット', 'そのままコピー'], ['ターミナルはツールの出力を折りたたむ', 'チャットだけです'], ['言い換え', '禁止です']], 'instruction');
});

// Guards the public handoff instruction, not model compliance or posture detection.
test('CEO mode handoff applies the selected mode before the next question', () => {
  const selection = between(skeletonSource(), '### 0E. モード選択', '### 0F.');
  const handoffStart = selection.indexOf('4. **モードの引き継ぎ:**');
  const routeStart = selection.indexOf('選択されたモードのルートに従ってください:');
  expect(handoffStart).toBeGreaterThan(0);
  expect(routeStart).toBeGreaterThan(handoffStart);
  const handoff = selection.slice(handoffStart, routeStart);
  const instruction = handoff.split('\n')[0]!;
  expect(instruction).toMatch(/他のツールやさらなる質問の前に、`[^`]*gstack-ceo-mode-handoff/);
  const selectionSteps = compactProse(selection.slice(0, handoffStart));
  expectMentions(selectionSteps, [['ユーザーが明示的に選んだ場合は', '手順 2〜3 を飛ばします'], ['終了コード 0', '`AUTO_DECIDE`', '推奨を選び'], ['回答を待って停止']], 'selectionSteps');
  const loggingStart = handoff.indexOf('引き継ぎの後に、モードの出所を記録してください');
  expect(loggingStart).toBeGreaterThan(handoff.indexOf('- その他の選択:'));
  expect(loggingStart).toBeLessThan(handoff.indexOf('モードを選んでも、変更は承認されません'));
  const formats = handoff.split('\n').filter(line => /^- (`plan-ceo-review-mode:|その他の選択:)/.test(line));
  expect(formats).toHaveLength(2);
  for (const format of formats) {
    expect(format).toContain('<Application and rationale>');
    expect(format).toContain('<rows or none>');
  }
});

test('SELECTIVE baseline cuts preserve prior answers until their own scope decision', () => {
  const modeWork = between(skeletonSource(), '### 0G.', '### 0H.');
  const holdChecks = between(modeWork, '**HOLD SCOPE の場合**', '**SCOPE REDUCTION の場合:**');
  expect([...holdChecks.matchAll(/^\d+\. /gm)]).toHaveLength(3);
  const cuts = compactProse(modeWork.split('**現在のスコープの先送り**')[1]!);
  ordered(cuts, ['**A)** この項目を TODOS.md に先送りする', '**B)** スコープに残す']);
  ordered(cuts, [/回答を待ってから適用/, /先送りはデリバリーのスコープだけを変えます/, /以前の承認と並べて/]);
});

// These check the storage branches and their order, not model compliance.
test('CEO defines pending choices and storage before its first decision procedure', () => {
  const source = skeletonSource();
  const step0 = compactProse(source.split('## ステップ 0:')[1]!);
  ordered(step0, ['**必要な選択:**', '**保存ポリシー: 書く前に選んでください。**', '### 0D.']);
  expectMentions(step0, [['現在の内容、台帳の行、比較をすべて保持してください']], 'step0');
  const compare = between(step0, '**3. その行の選択肢を比較して保存する。**', '**4. 質問し');
  // Native c6fc D3 saved and asked Effort 0; cdd D3 cited a missing ledger row.
  expectMentions(compare, [['労力 S を付け'], ['労力 0 とは書かないでください']], 'compare');
  expect(compare).toContain('S/M/L/XL の労力、low/medium/high のリスク');
  ordered(compare, ['**質問前のチェックポイント:**', /割り当てられた ID で、ちょうど一行を見つけてください/,
    /労力とリスクは、それぞれ一つの記載された値でなければなりません。範囲を示してはいけません/, /欠落や無効なフィールド/, '**読み戻し。**']);
  const persistence = between(step0, '### 0H.', '### 0I.');
  ordered(persistence, ['**両方の入力を、保存ポリシーに従って保存または提示してください。**',
    'mkdir -p', '**それ以外の場合:**', '**CEO の要約の形式 — 保存済みのものとチャットの出力の両方で使う:**',
    '# CEO Plan: {Feature Name}', '{{SPEC_REVIEW_LOOP}}']);
  expect(source).toContain('## Reviewer Concerns\n- {unresolved spec-review issues with their owning input, or "None"}');
});

test('CEO chat storage still supplies both spec inputs and the full report without claiming file completion', () => {
  for (const host of ALL_HOST_CONFIGS) {
    const ctx = { skillName: 'plan-ceo-review', host: host.name, paths: HOST_PATHS[host.name]! } as TemplateContext;
    const spec = compactProse(generateSpecReviewLoop(ctx));
    expectMentions(spec, [['ラベル付きの完全なテキスト 2 つ']], 'spec');
    expect(spec).toMatch(/5 つの観点すべて/);
    expectMentions(spec, [['レビュアーの成功した結果は必須ではありません']], 'spec');
    expectMentions(spec, [['必須の保存が失敗した場合は', '完了と主張する前に停止します']], 'spec');
    const report = generatePlanFileReviewReport(ctx);
    ordered(report, ['### レポートを生成する', '### プランファイルに書き込む', '**Read-back gate:**']);
    expect(report).toContain('not persisted');
    expect(report).not.toContain('retry once');
    const writing = compactProse(report);
    expectMentions(writing, [['Stage 3 のブロックされたチャットでの返却']], 'writing');
    ordered(writing, [/保存先のファイルが存在する場合は/, /保存先のファイルが存在しない場合は、Write で/, /レポートを最後に置いたまま/]);
    const tasks = compactProse(generateTasksSectionEmit(ctx, ['ceo-review']));
    expectMentions(tasks, [['実装上の契約は決めません']], 'tasks');
    expect(tasks).toContain('"to be determined"');
    expectMentions(tasks, [['JSONL の files 配列は空にします']], 'tasks');
    const outside = generateCodexPlanReview(ctx);
    if (outside) expectMentions(compactProse(outside), [['CEO のスコープの要約も含めます']], 'outside voice');
    const gate = compactProse(generateExitPlanModeGate(ctx));
    expectMentions(gate, [['すべてのチェックが通るまで', 'ExitPlanMode を呼び出してはいけません']], 'gate');
    ordered(gate, [/プラン\/レポートの保存漏れ/, '1. 直近の書き込みのあとに、プランファイルを Read する。']);
    expectMentions(gate, [['履歴の記録が禁止されている場合は', '試行していないことを確認する']], 'gate');
    expect(gate).toContain('**Gate outcome: Blocked**');
  }
});

// The original 660 judge found competing routes. These guards verify the
// instruction branches and ordering; only the selected judge proves clarity.
test('CEO routes administrative menus separately while scope and TODO retain the full decision protocol', () => {
  const main = compactProse(skeletonSource());
  const decisions = between(main, '### 0D.', '### 0E.');
  ordered(decisions, ['- **管理上の質問:**', '- **プランの判断:**', '**1. 情報源と過去の回答を確認する。**']);
  expectMentions(decisions, [['選択肢ごとに一列を設けてください']], 'decisions');
  ordered(main, ['**A)** このプランのスコープに追加する', '**B)** TODOS.md に先送りする', '**C)** 見送る']);
  expectMentions(main, [['回答済みのスコープの判断は', '再び質問や比較をせずに再利用してください']], 'main');
  const section = compactProse(sectionSource());
  ordered(section, ['**A)** TODOS.md に追加', '**B)** スキップ — 価値が十分でない', '**C)** 現在の計画に必須の作業として残す']);
});

test('CEO output stages prepare body before report and publish only after verification with a blocked chat return', () => {
  const raw = sectionSource();
  const section = compactProse(raw);
  ordered(section, ['### 段階1 — 計画本文とサマリーを準備', '### レビューの事実', '### 完了サマリー',
    '### 段階2 — 最終レポートを保存して検証', '{{PLAN_FILE_REVIEW_REPORT}}', '### 段階3 — 完了サマリーを公開', '## レビューログ']);
  expectMentions(section, [['最終レポートより前に置いてください']], 'section');
  expectMentions(section, [['どの段階も、後で書かれる完了ログに依存しません']], 'section');
  expectMentions(section, [['ファイル内でレポートの後ろに追記しないでください']], 'section');
  const chatStart = raw.search(/計画\/レポートの書き込みが許可されていない場合は/);
  expect(chatStart).toBeGreaterThan(-1);
  const chatEnd = raw.indexOf('\n## ', chatStart);
  expect(chatEnd).toBeGreaterThan(chatStart);
  const chat = compactProse(raw.slice(chatStart, chatEnd));
  expect(chat).toContain('**Gate outcome: Blocked**');
  expectMentions(chat, [['保存の完了を主張せずに']], 'chat');
  const main = compactProse(skeletonSource());
  const blocked = between(main, '- **ブロック:**', '- **検証済みの保存済み報告を伴う合格:**');
  expect(blocked).toContain('**未保存**');
  expect(blocked).toContain('**完了がブロックされている**');
  expectMentions(blocked, [['ログの欠落は、検証済みの報告を未保存にはしません']], 'blocked');
  expectMentions(blocked, [['成功のテレメトリ、ExitPlanMode、キューに入った引き継ぎなしで終えてください']], 'blocked');
  expectMentions(main, [['必須の書き込みが失敗した場合は、依然としてブロックされます']], 'main');
  const gate = compactProse(generateExitPlanModeGate({ skillName: 'plan-ceo-review' } as TemplateContext));
  const precheck = gate.slice(0, gate.indexOf('`Approval readiness: PASS` を、現在の行 ID'));
  expect(precheck.length).toBeGreaterThan(0);
  expectMentions(precheck, [['プラン/レポートの保存漏れ', '完了をブロックします']], 'precheck');
  expectMentions(precheck, [['ベストエフォートの履歴はブロックしません']], 'precheck');
  // Optional task/archive/TODO restrictions cannot block verified required artifacts.
  expect(precheck).not.toMatch(/Forbidden storage|(?:task|archive|TODO).*forbidden/);
});

test('CEO prior unresolved count remains a final report bullet for prior-only and mixed unresolved cases', () => {
  for (const host of ALL_HOST_CONFIGS) {
    const ctx = { skillName: 'plan-ceo-review', host: host.name, paths: HOST_PATHS[host.name]! } as TemplateContext;
    const report = compactProse(generatePlanFileReviewReport(ctx));
    const status = between(report, '**未解決の決定事項のステータス(必須):**', '### プランファイルに書き込む');
    expect(status).toContain('`NO UNRESOLVED DECISIONS`');
    expect(status).toContain('`- + N unresolved from prior reviews`');
    expectMentions(status, [['二重に数えない']], 'status');
    expectMentions(status, [['現在の項目が', 'なくても']], 'status');
    expectMentions(status, [['空白を除く最後の行']], 'status');
    expectMentions(status, [['別の件数の行や、末尾の文章を付け足してはいけません']], 'status');
  }
});

test('CEO saves compared proposals before recording an actual answer in its separate field', () => {
  const procedure = compactProse(between(skeletonSource(), '### 0D.', '### 0E. モード選択'));
  ordered(procedure, [/比較の前に保留中の行を記録してください。承認やタスクを先に書いてはいけません/,
    '**3. その行の選択肢を比較して保存する。**', /提案の欄では、ラベル、説明、利点と欠点に含まれるすべての約束事を比較してください/, '**4. 質問し、回答を記録し、修正する。**',
    /回答への参照とスコープを「正確な承認とスコープ」に保存し/, /許可された作業だけを修正してください/, /次の行に進む前に/]);
});

// A topic row alone did not expose the independently selectable test additions.
// This guards the executable representation/order, not the model's compliance.
test('CEO value comparisons and decline-all outcomes stay explicit before approval', () => {
  const procedure = compactProse(between(skeletonSource(), '### 0D.', '### 0E.'));
  ordered(procedure, [/比較の前に保留中の行を記録してください/, 'Commitment | Source/approval or pending | Current | A | B | C',
    /保存ポリシーに従って、現在のプラン全体、保留中の行、比較を保存または提示してください/, '**4. 質問し']);
  expectMentions(procedure, [['すべての選択肢が断られた場合は', '回答が実行可能な現在のアプローチを残している場合にのみ続行してください']], 'procedure');
  expectMentions(procedure, [['その行を未解決のままにし', '方向性の指示を待つために停止してください']], 'procedure');
});

// The paid paired-control skipped its provisional ledger and treated two
// contracts as one test strategy. Guard drafting before menu synthesis on each
// host; this is an instruction-order check, not proof of native compliance.
test('CEO Step 0 drafts provisional contracts before menus and saves their complete comparison on every host', async () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-pending-rows-'));
  try {
    const generated = await runGeneration({ host: 'all', outputRoot, contentLinkRoot: null, log: () => {} });
    expect(generated.exitCode, JSON.stringify(generated.diagnostics)).toBe(0);
    const carriers = generated.artifacts.filter(artifact => artifact.kind === 'skill'
      && (artifact.relativePath === 'plan-ceo-review/SKILL.md'
        || artifact.relativePath.endsWith('/gstack-plan-ceo-review/SKILL.md')));
    expect(carriers).toHaveLength(ALL_HOST_CONFIGS.length);
    for (const file of [`${SKELETON}.tmpl`, ...carriers.map(carrier => path.join(outputRoot, carrier.relativePath))]) {
      const source = fs.readFileSync(file, 'utf8');
      const approach = compactProse(source.split('### 0D.')[1]?.split('### 0E. モード選択')[0] ?? '');
      ordered(approach, ['**1. 情報源と過去の回答を確認する。**', '**2. 保留中の選択を記録する。**',
        /所有者、振る舞い、制限、テストの方法、カバレッジを現在と提案の欄に記録してください/, /比較の前に保留中の行を記録してください/,
        '**3. その行の選択肢を比較して保存する。**', '`currentDecision` を一つ作成してください', '**質問前のチェックポイント:**',
        '**4. 質問し、回答を記録し、修正する。**', /1 回の呼び出しで 1 行だけ尋ね/, '**回答後のチェックポイント:**']);
      expectMentions(between(approach, '**4. 質問し', '**回答後のチェックポイント:**'), [['実際の回答を得るまで停止してください']], 'section');
      expect(source).toContain('| ID と担当者 | 契約と根拠 | 現在 | 提案 | 状態 | 正確な承認とスコープ |');
      expect(source.indexOf('| ID と担当者 |')).toBeLessThan(source.indexOf('**2. 保留中の選択を記録する。**'));
      expect(source.indexOf('### 0D.')).toBeLessThan(source.indexOf('### 0E. モード選択'));
    }
  } finally { fs.rmSync(outputRoot, { recursive: true, force: true }); }
}, 30_000);

// A saved topic row did not prevent the captured paired menu from combining
// separately proposed coverage. Main review also asked about a draft-created
// recovery promise before reconciling it with the original contract.
test('CEO decision units and factual reconciliation precede menu synthesis', () => {
  const section = sectionSource();
  expectMentions(compactProse(between(section, '**分析。**', '**解決。**')), [['誤った主張', '修正してください']], 'analyze');
  ordered(section, ['### Outside Voice 統合ルール', '{{CODEX_PLAN_REVIEW}}']);
});

test('CEO outside findings reuse authority-first decisions without turning unknown facts into policies', () => {
  const section = fs.readFileSync(SECTION, 'utf8');
  const tension = compactProse(between(section, '**Integrate reviewer findings(レビュアーの指摘の統合):**', '**Cross-model tension(モデル間の緊張関係):**'));
  // The outside branch delegates to the original procedure, not a second approval loop.
  expectMentions(tension, [['同じ 6 列の台帳に記録します']], 'tension');
  expectMentions(tension, [['2 つ目の手順を始めてはいけません']], 'tension');
  expect(tension).not.toContain('reference | commitment | current value');
  expectMentions(tension, [['承認された振る舞いを変えずに', '誤った前提を訂正します']], 'tension');
  expectMentions(tension, [['別の振る舞いを想像しただけでは', '欠陥の証拠にはなりません']], 'tension');
  expectMentions(tension, [['事実の訂正や確認には', '振る舞い変更のメニューは不要です']], 'tension');
  expectMentions(tension, [['求められたモード', '維持します']], 'tension');
  expect(tension).toContain('A) この変更を適用する、B) この行の現在の値を維持する');
  expect(tension).toContain('A) Include、B) Defer、C) Cut、D) Hold');
  expectMentions(tension, [['ほかの候補を黙って削ったり置き換えたりしてはいけません']], 'tension');
  expectMentions(tension, [['調査と先送りは', '実装を認可するものではありません']], 'tension');
  expectMentions(tension, [['チャレンジは最終ゲートまで待ちます']], 'tension');
  expectMentions(tension, [['1 つの回答が、他の保留中の行を解決することはありません']], 'tension');
});

// Guard the complete result routes on every host. This verifies instructions,
// not the quality judge's clarity score or an agent's execution of the workflow.
test('CEO integrates completed native findings before its external-only comparison', () => {
  for (const host of ALL_HOST_CONFIGS) {
    const ctx = { skillName: 'plan-ceo-review', host: host.name, paths: HOST_PATHS[host.name]! } as TemplateContext;
    const review = compactProse(generateCodexPlanReview(ctx));
    expect(review.match(/\*\*Outcome routing:\*\*/g)).toHaveLength(1);
    expectMentions(review, [['呼び出しが失敗した後に', '再起動してはいけません']], 'review');
    const anchors = ['| レビュアーが完了 |', '**Native fallback — プロバイダーが利用不可、または実行が失敗(レビューが有効な場合):**',
      '**Bounded outside-voice wait', '**利用不可のパス:**', '**Integrate reviewer findings(レビュアーの指摘の統合):**',
      '**Cross-model tension(モデル間の緊張関係):**', '**Persist the result(結果の保存):**'];
    ordered(review, anchors);
    const [externalStart, nativeStart, boundedStart, unavailableStart, findingsStart, comparisonStart, persistStart] =
      anchors.map(anchor => review.indexOf(anchor));
    expect(review.slice(externalStart, nativeStart)).toContain('Integrate reviewer findings');
    const bounded = review.slice(boundedStart, unavailableStart);
    expect(bounded).toContain('**Integrate reviewer findings**');
    expectMentions(bounded, [['ステップ 4 に従います']], 'bounded');
    expect(bounded).not.toContain('continue to Cross-model tension');
    const unavailable = review.slice(unavailableStart, findingsStart);
    expect(unavailable).toContain('STATUS = "unavailable"');
    expect(unavailable).toContain('SOURCE = "none"');
    expect(unavailable).toContain('OUTSIDE_STATUS = "unavailable"');
    const findings = review.slice(findingsStart, comparisonStart);
    expectMentions(findings, [['外部カバレッジとは見なしません']], 'findings');
    expectMentions(findings, [['disabled または利用不可のレビューでは', 'このブロックをスキップします']], 'findings');
    const comparison = review.slice(comparisonStart, persistStart);
    expectMentions(comparison, [['外部のレビュアーが完了した場合に限って']], 'comparison');
    expect(comparison).toContain('**Persist the result**');
    expectMentions(comparison, [['CROSS-MODEL の行は書きません']], 'comparison');
    const report = compactProse(generatePlanFileReviewReport(ctx));
    expectMentions(report, [['**CROSS-MODEL:**', 'ネイティブと、完了した外部レビューの両方がある場合のみ']], 'report');
    expect(report).toContain('N findings; R resolved; U unresolved');
    expect(report).toContain('"0 findings — completed review"');
    expect(report).toContain('"no completed external review"');
    expectMentions(report, [['指摘が 0 件だと匂わせてはいけません']], 'report');
    expect(report).toContain('"finding count not recorded"');
    expectMentions(report, [['プロバイダーと結果は OUTSIDE COVERAGE に残します']], 'report');
  }
});

test('CEO expansion preparation feeds one pending list into the scope decisions', () => {
  const source = compactProse(skeletonSource());
  const framing = between(source, '### 0F.', '### 0G.');
  const decisions = between(source, '### 0G.', '### 0H.');
  expectMentions(framing, [['0G の候補を準備してください']], 'framing');
  expect(framing).toContain('S/M/L/XL の労力、リスク、影響');
  expect(framing).toContain('`(recommended)`');
  expectMentions(decisions, [['0F の保留中の一覧を広げてください']], 'decisions');
  expectMentions(decisions, [['追加内容ごとに、順番に、別々に尋ねてください']], 'decisions');
});

// Repeated public quality feedback identified these missing execution instructions.
// This guard checks the source contract; native clarity still requires paid evidence.
test('CEO Step 0 defines the decision record, execution order, and mode approval precedence', () => {
  const source = skeletonSource();
  const step0 = compactProse(source.split('## ステップ 0:')[1]?.split('### 0F.')[0] ?? '');
  ordered(step0, [/1\. レビューの深さと成果物の保存先を選んでから/, /2\. 0A〜0C の根拠を記録してください/, /3\. 0E でモードを選び/,
    /4\. レビューのセクションと締めくくりの手順を完了し/]);
  expectMentions(step0, [['0D は、無条件に尋ねるものではなく、再利用するものです']], 'step0');
  expectMentions(step0, [['観察は変更を承認しません']], 'step0');
  ordered(step0, [/前文のセッションのルールに従ってください/, /ユーザーが明示的に選んだ場合は、手順 2〜3 を飛ばします/]);
  expectMentions(step0, [['選ばずに推奨します']], 'step0');
  expectMentions(step0, [['ユーザーの選択が優先されます']], 'step0');
  expect(step0).toContain('`question_id=plan-ceo-review-mode`');
  expect(step0).toContain('`gstack-question-preference --check`');
  const reduction = compactProse(source.split('**SCOPE REDUCTION の場合:**')[1]?.split('### 0H.')[0] ?? '');
  expectMentions(reduction, [['項目ごとに別々に尋ねてください']], 'reduction');
  ordered(reduction, ['**A)** この項目を TODOS.md に先送りする', '**B)** スコープに残す']);
  expect(reduction).not.toContain('Remove it without a follow-up');
  expect(reduction).not.toContain('Accepted items govern');
});

// Verify the source contract reaches the actual evaluated generated carrier;
// the live AUQ gate still proves model compliance with this instruction.
test('CEO mode recommendation explains a plan-specific consequence without changing routing', () => {
  for (const file of [`${SKELETON}.tmpl`, SKELETON]) {
    const source = fs.readFileSync(file, 'utf8');
    const mode = between(source, '### 0E. モード選択', '### 0F.');
    const recommendation = compactProse(between(mode, '2. 選ばずに推奨します。', '3. その推奨を解決します。'));
    expectMentions(recommendation, [['件数やカテゴリだけで説明しないでください']], 'recommendation');
    expectMentions(recommendation, [['15 を超える場合は', 'SCOPE REDUCTION を推奨します']], 'recommendation');
    expect(recommendation).toContain('グリーンフィールド)なら SCOPE EXPANSION');
    expect(recommendation).toContain('機能の追加なら SELECTIVE EXPANSION');
    expect(recommendation).toContain('修正やリファクタリングなら HOLD SCOPE');
    expect(recommendation).toContain('HOLD SCOPE を推奨します');
    const resolve = compactProse(between(mode, '3. その推奨を解決します。', '4. **モードの引き継ぎ:**'));
    expectMentions(resolve, [['手順 2 の推奨を使います']], 'resolve');
    expectMentions(resolve, [['回答を待って停止']], 'resolve');
  }
});

// Boundary checks stay on source templates: generated carriers remain the
// integration owner's responsibility, and these do not prove model behavior.
describe('CEO review decision boundaries contract', () => {
  const skeleton = skeletonSource();
  const section = sectionSource();
  const alternatives = compactProse(skeleton.split('### 0D.')[1]?.split('### 0F.')[0] ?? '');
  const temporal = compactProse(skeleton.split('### 0I.')[1]?.split('### 0E.')[0] ?? '');
  const continuity = compactProse(between(section, '### 作業中のレビューの判断', '### セクション 1:'));
  const apply = compactProse(continuity.split('**適用。**')[1]!);

  test('every approach comparison preserves approvals and separates independent changes', () => {
    const depth = compactProse(between(skeleton, '**依頼内容からレビューの深さを決めてください。**', '平易な用語:'));
    ordered(depth, ['**A)** このレビューは戦略のみのままにする', '**B)** 指定された機能について実装の設計を追加する']);
    expectMentions(depth, [['A を推奨します'], ['具体的な障害によって B が必要な場合を除きます']], 'depth');
    expectMentions(depth, [['回答を待ってください']], 'depth');
    expectMentions(depth, [['B を選んだ場合', 'その機能についてのみ設計の詳細を許可します']], 'depth');
    expectMentions(compactProse(section), [['ステップ 0 のレビュー深さの拡張の判断を使ってください']], 'compactProse(section)');
    const outputs = compactProse(section.split('## 必須の出力')[1]!);
    expectMentions(outputs, [['戦略のみの作業の場合は、能力ごとの行を使い']], 'outputs');
    expect(outputs).not.toContain('___ methods');
    expect(alternatives).toContain('| コードの変更と必要な回帰テスト | 一緒にまとめ、承認されたら両方を次に進めます。 |');
    expect(alternatives).toContain('| テストの方法やカバレッジが未定の、承認された変更 | 一度決定します。');
    expect(alternatives).toContain('| 既存の振る舞いのテスト | 独立して選べる追加として分けます。');
    expectMentions(compactProse(section), [['0D のテストの表に従って']], 'compactProse(section)');
    expectMentions(alternatives, [['不明な点は残してください']], 'alternatives');
  });

  test('settled approach authority resolves the gate while new choices still require approval', () => {
    const approach = alternatives.split('### 0E. モード選択')[0]!;
    const reuse = approach.split('**2. 保留中の選択を記録する。**')[0]!;
    expectMentions(reuse, [['再検討するのは、矛盾、変わった前提、ユーザーの指示がある場合だけです']], 'reuse');
    expectMentions(reuse, [['推測やレビュー担当者の同意では再検討しないでください']], 'reuse');
    expectMentions(approach, [['推奨は承認ではありません']], 'approach');
    expect(approach).not.toContain('0C-bis');
    expectMentions(compactProse(section), [['修正に承認が必要な場合は', '0D で解決してください']], 'compactProse(section)');
    expectMentions(section, [['明らかな修正', '承認が必要です']], 'section');
    const generated = fs.readFileSync(SKELETON, 'utf8');
    expect(generated).toContain('### ツール解決 (Tool resolution、最初に読むこと)');
    expect(generated).toContain('SESSION_KIND: spawned');
    const afterAnswer = approach.split('**回答後のチェックポイント:**')[1]!;
    expect(afterAnswer).toContain('「問題なし、次に進みます。」');
  });

  test('coverage scoring is conditional and legitimate early decisions retain their exact approval', () => {
    ordered(alternatives, [/所有者、振る舞い、制限、テストの方法、カバレッジを現在と提案の欄に記録してください/, /この行のカバレッジの違いを採点してください/]);
    expect(alternatives).toContain('10 = すべてのエッジケース');
    expectMentions(alternatives, [['完全性のスコアはありません']], 'alternatives');
    // Scoring and recommendation details are reused from the existing preamble.
    const generated = fs.readFileSync(SKELETON, 'utf8');
    expect(generated).toContain('10 = 完全、7 = ハッピーパス、3 = 近道');
    expect(generated).toContain('(recommended)');
    expectMentions(generated, [['AUTO_DECIDE がこれに依存しています']], 'generated');
    expectMentions(generated, [['選択肢がカバー範囲で異なる場合にのみ', '`Completeness: N/10`']], 'generated');
  });

  test('an unresolved section decision is answered before its scoped plan amendment', () => {
    ordered(continuity, ['**解決。**', '**適用。**', /保存されたプランを、各回答の正確なスコープと照合してください/,
      /保存ポリシーに従って不一致を修正してください/, /指摘と処分を記録してから/]);
  });

  test('pending labels authorize only unresolved notes, not an outcome or future review conclusions', () => {
    expectMentions(apply, [['修正に承認が必要な場合は', '0D で解決してください']], 'apply');
    expectMentions(apply, [['レビューする前に、そのセクションの結論やタスクを書いてはいけません']], 'apply');
    expectMentions(apply, [['承認は、実装や検証の証拠ではありません']], 'apply');
  });
});

// These are source-contract checks, not model-behavior evidence. Read the
// template and resolve its shared clause directly so an old generated carrier
// cannot conceal conflicting per-section instructions during implementation.
describe('CEO review decision continuity contract', () => {
  const template = sectionSource();
  const clauses = ALL_HOST_CONFIGS.map(host => generateAntiShortcutClause({
    skillName: 'plan-ceo-review', host: host.name,
  } as TemplateContext));
  const continuity = compactProse(template.split('### 作業中のレビューの判断')[1]?.split('### セクション 1:')[0] ?? '');

  test('analysis, decision, and approved amendment precede advancing to the next section', () => {
    ordered(continuity, ['**分析。**', '**解決。**', '**適用。**']);
    for (const clause of clauses) {
      const text = compactProse(clause);
      expectMentions(text, [['分析 → 解決 → 適用の順に進めてから次へ進みます']], 'text');
      expectMentions(text, [['残りのセクションやその実装タスクを先に書き込んでから', '質問リストを順に消化してはいけません']], 'text');
      expectMentions(text, [['提案された指摘は、承認されたプラン変更ではありません']], 'text');
    }
  });

  test('every section has one decision gate wired to the shared procedure', () => {
    const declared = Number(template.match(/^## Review Sections\(レビューのセクション。(\d+) のセクション/m)?.[1]);
    const sections = [...template.matchAll(/^### セクション ?(\d+):([^]*?)(?=^### セクション ?\d+:|^## 締めくくりの手順)/gm)];
    expect(sections.map(section => Number(section[1]))).toEqual(Array.from({ length: declared }, (_, i) => i + 1));
    for (const [, number, body] of sections) {
      expect(body.match(/\*\*判断ゲート。\*\*/g), `Section ${number}`).toHaveLength(1);
      expect(body, `Section ${number}`).toMatch(/\*\*判断ゲート。\*\* (?:次に|先に)進む前に、このセクションについて上(?:の|記の) ?(?:分析 → 解決 → 適用|Analyze → Resolve → Apply) ?を完了してください/);
    }
    ordered(template, ['### 作業中のレビューの判断', '### セクション 1:']);
    expectMentions(continuity, [['各セクションの**判断ゲート**では', '分析 → 解決 → 適用に従ってください']], 'continuity');
    expectMentions(continuity, [['レビューのみです'], ['コードは変更しないでください']], 'continuity');
    expectMentions(compactProse(template), [['評価したセクションでは', '指摘がゼロの場合にのみ「指摘なし」と言ってください']], 'template');
    expectMentions(template, [['セクション 1〜10 を全文評価してください']], 'template');
    expect(template).toContain('`SKIPPED (no UI scope)`');
    ordered(template, ['### 完了サマリー', '{{PLAN_FILE_REVIEW_REPORT}}']);
  });

  test('the ledger carries exact approvals and declared contracts without claiming implementation', () => {
    const skeleton = skeletonSource();
    const start = skeleton.search(/判断台帳は一つだけ保持してください/);
    expect(start).toBeGreaterThan(skeleton.indexOf('## ステップ 0:'));
    expect(start).toBeLessThan(skeleton.indexOf('### 0D.'));
    const earlyLedger = skeleton.slice(start, skeleton.indexOf('### 0A.'));
    expect(earlyLedger).toContain('| ID と担当者 | 契約と根拠 | 現在 | 提案 | 状態 | 正確な承認とスコープ |');
    const limits = compactProse(between(skeleton, '**示された制限を守ってください。**', '**保存ポリシー:'));
    expectMentions(limits, [['制限を変えるには、根拠とユーザーの承認が必要です']], 'limits');
    expect(skeleton.indexOf('**示された制限を守ってください。**')).toBeLessThan(skeleton.indexOf('### 0D.'));
    const temporal = compactProse(skeleton.split('### 0I.')[1]?.split('{{SECTION:review-sections}}')[0] ?? '');
    expectMentions(temporal, [['ユーザーが実装の計画を求めていない限り']], 'temporal');
    expectMentions(compactProse(template), [['承認は、実装や検証の証拠ではありません']], 'compactProse(template)');
  });

  test('ownership never defers a critical risk or merges distinct choices by topic', () => {
    expectMentions(continuity, [['重大なリスクは今解決してください']], 'continuity');
    const testReview = compactProse(between(template, '### セクション 6: テストのレビュー', '### セクション 7:'));
    expectMentions(testReview, [['自分で書き', 'ユーザーに求めてはいけません']], 'testReview');
    expectMentions(testReview, [['それを提案する前に', '0D でその選択を解決してください']], 'testReview');
    expectMentions(testReview, [['承認された実行時の契約だけでは', '追加の検証の範囲は決まりません']], 'testReview');
    const outside = compactProse(between(template, '### Outside Voice 統合ルール', '{{CODEX_PLAN_REVIEW}}'));
    expectMentions(outside, [['レビュアーが同意しても', '新たな根拠や承認にはなりません']], 'outside');
  });

  test('Design preserves decision gating while DX and fallback retain their existing output on every host', () => {
    const fallbacks = new Set<string>();
    const devexClauses = new Set<string>();
    for (const host of ALL_HOST_CONFIGS) {
      const fallback = generateAntiShortcutClause({ skillName: 'review', host: host.name } as TemplateContext);
      fallbacks.add(fallback);
      // Default clause keeps its constraints: the plan cannot replace the interactive review,
      // findings go through AskUserQuestion before the plan, only zero findings skip asking.
      expect(fallback).toMatch(/レビューの代わりにはなりません/);
      expect(fallback).toMatch(/指摘[\s\S]*AskUserQuestion/);
      expect(fallback).toMatch(/指摘がゼロ[\s\S]*ExitPlanMode/);
      const devex = generateAntiShortcutClause({ skillName: 'plan-devex-review', host: host.name } as TemplateContext);
      devexClauses.add(devex);
      expect(devex).toContain('**近道禁止の条項:**');
      expect(devex).not.toBe(fallback);
      const design = compactProse(generateAntiShortcutClause({ skillName: 'plan-design-review', host: host.name } as TemplateContext));
      expectMentions(design, [['独立した決定ごとに 1 回質問し', '実際の回答を待ってから']], 'design');
      expectMentions(design, [['以前に選ばれた正確な契約に必要なコード、テスト、ドキュメントは', 'その選択を再開させません']], 'design');
      expectMentions(design, [['広いアプローチや推奨は', '独立した改善策や任意の検証の深さを承認するものではありません']], 'design');
    }
    expect(fallbacks.size, 'default clause is host-independent').toBe(1);
    // The pinned DX clause hash was English prose; keep the structural guarantee that it is one host-independent text.
    expect(devexClauses.size, 'DX clause is host-independent').toBe(1);
  });
});

test('CEO closing route checks approvals before outputs and verifies artifacts before telemetry without a file bounce', () => {
  const skeleton = skeletonSource();
  const section = sectionSource();
  const route = between(section, '## 締めくくりの手順', '### Outside Voice 統合ルール');
  const routeStages = ['**Outside Voice:**', '**残りのTODOの選択を解決:**', '**承認の準備確認:**',
    '**必須の出力:**', '**後片付けと履歴:**', '**ナビゲーション:**', '**学び:**'];
  ordered(route, routeStages);
  expect(route.match(/^\d+\. /gm)).toHaveLength(routeStages.length);
  const steps = compactProse(route);
  expectMentions(steps, [['無効または利用できない範囲は記録し', 'レビュアーが実行されない場合は先に進みます']], 'steps');
  expectMentions(steps, [['出力を書く前に台帳を確認し', 'PASSを記録します']], 'steps');
  expectMentions(steps, [['その変更についてのみ0Dを呼び出し']], 'steps');
  expectMentions(steps, [['決定済みの選択を改めて尋ねることなく']], 'steps');
  expectMentions(steps, [['次のスキルをキューに入れます']], 'steps');

  ordered(section, ['## 締めくくりの手順', '{{CODEX_PLAN_REVIEW}}', '## 残りのTODOの選択を解決',
    '### TODOS.md の更新', '{{PLAN_REVIEW_APPROVAL_CHECK}}', '## 必須の出力',
    '{{PLAN_FILE_REVIEW_REPORT}}', '## レビューログ', '{{REVIEW_DASHBOARD}}', '## 次のステップ — レビューの連鎖',
    '## docs/designs への昇格', '{{LEARNINGS_LOG}}', '{{GBRAIN_SAVE_RESULTS}}', '{{BRAIN_WRITE_BACK}}',
    'このスキルのメインの `SKILL.md` に戻ってください: セクションの自己チェック → EXIT PLAN MODE GATE']);
  expect(section).not.toContain('{{EXIT_PLAN_MODE_GATE}}');
  expect(section).not.toContain('{{BRAIN_CACHE_REFRESH}}');
  expect(section).not.toContain('Run the preamble\'s **Telemetry');

  const actualGate = skeleton.indexOf('{{EXIT_PLAN_MODE_GATE}}');
  expect(actualGate).toBeGreaterThan(skeleton.indexOf('## セクションの自己チェック'));
  const terminal = skeleton.slice(actualGate);
  const success = compactProse(terminal.split('**検証済みの保存済み報告を伴う合格:**')[1]!);
  ordered(success, [/下のキャッシュの更新を終えてから/, '{{BRAIN_CACHE_REFRESH}}',
    '前文の**テレメトリ(最後に実行)**を一度実行してください', /これでレビューは完了です/, 'ExitPlanMode を呼び出す',
    /次のスキルへの引き継ぎは、別のワークフローとして開始されます/]);
  expect(terminal).not.toMatch(/return to (?:the )?section|Closing hooks/);
  for (const host of ALL_HOST_CONFIGS) {
    const refresh = compactProse(generateBrainCacheRefresh({ skillName: 'plan-ceo-review', host: host.name, paths: HOST_PATHS[host.name]! } as TemplateContext));
    expectMentions(refresh, [['テレメトリの前に', 'ノンブロッキングの更新を開始します']], 'refresh');
    expect(refresh).not.toContain('telemetry has logged');
  }

  const askQuestions = section.search(ASK_QUESTIONS_HEADING);
  const governingStages = [askQuestions, ...['## 書式のルール',
    '## モードの早見表', '### 作業中のレビューの判断', '### セクション 1:']
    .map(stage => section.indexOf(stage))];
  expect(governingStages.every(position => position >= 0)).toBe(true);
  expect(governingStages).toEqual([...governingStages].sort((a, b) => a - b));
  const questions = section.slice(askQuestions).split('\n').slice(1).join('\n').split('## モードの早見表')[0]!;
  expect(questions).toContain('`D<N>` と A/B/C のラベルを使ってください');
  const formatting = questions.split('## 書式のルール')[1]!;
  expectMentions(formatting, [['0D の正確な `currentDecision` の質問と選択肢の説明を使ってください']], 'formatting');
  expect(questions).not.toMatch(/NUMBER \+ (?:option )?LETTER|"3A"|One sentence max per option/);
});

describe('plan-ceo-review carve — static ordering', () => {
  const skeleton = fs.readFileSync(SKELETON, 'utf-8');
  const section = fs.readFileSync(SECTION, 'utf-8');

  // Index into the skeleton, -1 if absent.
  const at = (needle: string): number => skeleton.indexOf(needle);

  const STEP0 = '## ステップ 0: スコープへの大胆な挑戦 + モードの選択';
  const STOP = 'sections/review-sections.md'; // appears in the index row + STOP directive
  const GATE = 'GSTACK REVIEW REPORT';

  test('the interactive anti-shortcut contract is available before audit or lazy section loading', () => {
    const contract = '**近道禁止の条項:**';
    const audit = skeleton.indexOf('## 事前レビューのシステム監査(ステップ 0 の前)');
    expect(skeleton.indexOf(contract)).toBeGreaterThan(-1);
    expect(skeleton.indexOf(contract)).toBeLessThan(audit);
    expect(skeleton.split(contract)).toHaveLength(2);
    expect(section).not.toContain(contract);
    expect(skeleton).toContain(generateAntiShortcutClause({ skillName: 'plan-ceo-review' } as TemplateContext));
    expectMentions(skeleton, [['未解決または再開された課題ごとに 1 回だけ質問し', '回答を待ち']], 'skeleton');
    expectMentions(skeleton, [['決着済みの決定の相互参照は', '完全なレビューと最終レポートの代わりにはなりません']], 'skeleton');
    expectMentions(skeleton, [['新しいセクションが始まったという理由だけで質問をでっち上げてはいけません']], 'skeleton');
  });

  test('skeleton emits a STOP-Read directive pointing at the section', () => {
    expect(skeleton).toContain('> **STOP.**');
    expect(skeleton).toContain('plan-ceo-review/sections/review-sections.md');
    expect(skeleton).toContain('## Section index — 状況に当てはまるセクションを読む');
  });

  test('Step 0 (scope + mode) stays in the skeleton, BEFORE the STOP', () => {
    const step0 = at(STEP0);
    const stop = skeleton.indexOf('> **STOP.**');
    expect(step0).toBeGreaterThan(-1);
    expect(stop).toBeGreaterThan(step0); // STOP fires only after Step 0
  });

  test('mode selection precedes mode-specific analysis after approach approval', () => {
    const approach = at('### 0D.');
    const mode = at('### 0E. モード選択');
    const analysis = at('### 0G. モード別の分析');
    expect(approach).toBeGreaterThan(-1);
    expect(mode).toBeGreaterThan(approach);
    expect(analysis).toBeGreaterThan(mode);
    expectMentions(skeleton, [['根拠がある場合のみ']], 'skeleton');
    expect(skeleton).toContain('| SCOPE EXPANSION / SELECTIVE EXPANSION | 0F → 0G → 0H(スペックレビューのループを含む) → 0I |');
    expect(skeleton).toContain('| HOLD SCOPE | 0G → 0I |');
    expect(skeleton).toContain('| SCOPE REDUCTION | 0G |');
    expect(skeleton.indexOf('## ステップ 0 の後の続行(すべてのモード)')).toBeGreaterThan(skeleton.indexOf('### 0I.'));
    expect(skeleton.indexOf('## ステップ 0 の後の続行(すべてのモード)')).toBeLessThan(skeleton.indexOf('> **STOP.**'));
    expectMentions(compactProse(skeleton), [['項目ごとに別々に尋ねてください']], 'skeleton');
    expectMentions(skeleton, [['15 を超える場合は', 'SCOPE REDUCTION を推奨します']], 'skeleton');
    expect(skeleton).toContain('グリーンフィールド)なら SCOPE EXPANSION');
    const persist = skeleton.split('### 0H. CEO プランの保存(EXPANSION と SELECTIVE EXPANSION のみ)')[1]?.split('### 0I.')[0] ?? '';
    expect(persist).toMatch(/^#### Spec Review Loop\(スペックレビューのループ\)$/m);
    const handoff = compactProse(persist.slice(persist.indexOf('ループが完了した後、または利用できないと報告された後に')));
    const approval = ['スコープの文書の最終承認のために', '前文の質問の伝達方法を使って尋ねてください:',
      '**A)** これらの文書を承認し、0I に進む', '**B)** これらの文書を修正する', '**C)** このレビューを一時停止する',
      '回答を待って記録してください', 'B の場合は、0D を通じて要求された変更を解決し',
      '両方の入力を更新して、文書の承認を繰り返してください', 'C で停止します',
      'A の後は、レビューセクションの前に 0I を実行してください'].map(stage => handoff.indexOf(stage));
    expect(approval.every(position => position >= 0)).toBe(true);
    expect(approval).toEqual([...approval].sort((a, b) => a - b));
    expectMentions(handoff, [['両方が正確な判断を反映している場合にのみ A を推奨してください']], 'handoff');
    expectMentions(handoff, [['未解決の修正や実装は承認されていないままです']], 'handoff');
  });

  test('the heavy review body (Sections 1-11) is NOT in the skeleton', () => {
    expect(skeleton).not.toContain('### セクション 1: アーキテクチャのレビュー');
    expect(skeleton).not.toContain('### セクション 11:');
    // ...it lives in the section instead.
    expect(section).toContain('### セクション 1: アーキテクチャのレビュー');
    expect(section).toContain('### セクション 11:');
  });

  test('Autoplan CEO uses the loaded Step 0 route before its dual voices and review sections', () => {
    for (const suffix of ['.md.tmpl', '.md']) {
      const phase = fs.readFileSync(path.join(ROOT, 'autoplan/sections/ceo-phase' + suffix), 'utf8');
      const step0 = phase.split('**必須の実行チェックリスト(CEO):**')[1]?.split('手順 0.5(二重の voice):')[0] ?? '';
      expect(step0).toContain('SELECTIVE EXPANSION');
      expectMentions(step0.replace(/\s+/g, ' '), [['CEO のスコープ文書と 0H のスペックレビューのループは、0I とレビューセクションの前に完了させます']], 'step0');
      expect(step0).not.toMatch(/^- 0[A-I](?:-bis)?:/m);
      // The headings alone can be ordered while executable reviewer payloads
      // still run ahead of Step 0, or Codex is presented ahead of Claude.
      const prose = phase.replace(/\s+/g, ' ');
      const positions = ['**必須の実行チェックリスト(CEO):**', '手順 0.5(二重の voice):',
        '`<CEO_INPUT>` の隣にある `snapshot.json` を読みます',
        '`nativeDispatchPrompt` を変更せずに', '**ネイティブの完了バリア:**',
        '外部のプロンプト: <CEO_INPUT> と以下の文脈の全内容をインラインで含めます',
        suffix === '.md.tmpl' ? '{{OUTSIDE_INVOCATION:autoplan}}' : '_OUTSIDE_EXIT=0',
        'CEO DUAL VOICES — CONSENSUS TABLE:', 'セクション 1〜11 —', '**フェーズ 1 から必須の成果物:**', '**このフェーズを閉じる:**',
        suffix === '.md.tmpl' ? '{{SECTION:phase-close}}' : 'Read `~/.claude/skills/gstack/autoplan/sections/phase-close.md` を全文読んで実行してください']
        .map(stage => prose.indexOf(stage));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  test('nothing review-governing sits in the skeleton below the STOP (Codex P1)', () => {
    // Mode Quick Reference + Formatting Rules govern review-time behavior and must
    // travel with the section, not be stranded below the STOP in the skeleton.
    expect(skeleton).not.toContain('## モードの早見表');
    expect(skeleton).not.toContain('## 書式のルール');
    expect(section).toContain('## モードの早見表');
  });

  test('review report writer lives in the section; the EXIT PLAN MODE GATE stays in the skeleton AFTER the STOP', () => {
    // The report itself is produced inside the section work...
    expect(section).toContain(GATE);
    // ...and the blocking gate that verifies it is the last thing the skeleton runs.
    const stop = skeleton.indexOf('> **STOP.**');
    const gate = skeleton.lastIndexOf(GATE);
    expect(gate).toBeGreaterThan(stop);
  });

  test('the loaded test-review section preserves mandatory behaviors and individual assertion decisions', () => {
    const template = fs.readFileSync(`${SECTION}.tmpl`, 'utf-8');
    for (const document of [template, section]) {
      const testReview = document.split('### セクション 6: テストのレビュー')[1]?.split('### セクション 7:')[0];
      expect(testReview).toBeDefined();
      const instructions = testReview!.replace(/\s+/g, ' ');
      expectMentions(instructions, [
        ['アサーションの構文がなくてもアサーションを決められます'],
        ['意味的な数、条件、量化子は正確に'],
        ['自分で書き', 'ユーザーに求めてはいけません'],
        ['個別に尋ねるのは'],
        ['曖昧な成功のラベルでは値は決まりません'],
        ['スコープやアプローチの承認では', '個々のアサーションのギャップは解決しません'],
        ['ヘルパーのカバレッジだけでは', 'それは証明されません'],
        ['チェックが欠けていると言う前に', '既存の要件'],
        ['必要な振る舞いのアサーションを、黙って追加、先送り、免除してはいけません'],
        ['ユーザーが明示的に変更を承認しない限り', '必須の振る舞いは必須のままにしてください'],
      ], 'instructions');
      const phases = ['**要件をマップする。**', '**確定した証明を再利用する。**', '**実際のギャップを解決する。**'].map(phase => instructions.indexOf(phase));
      expect(phases.every(position => position >= 0)).toBe(true);
      expect(phases).toEqual([...phases].sort((a, b) => a - b));
      expect(instructions).toMatch(/\*\*判断ゲート。\*\* 次に進む前に、このセクションについて上の分析 → 解決 → 適用を完了してください。/);
      const procedure = document.split('### 作業中のレビューの判断')[1]!.split('### セクション 1:')[0]!.replace(/\s+/g, ' ');
      expect(document.indexOf('### 作業中のレビューの判断')).toBeLessThan(document.indexOf('### セクション 6: テストのレビュー'));
      expectMentions(procedure, [['各セクションの**判断ゲート**では', '分析 → 解決 → 適用に従ってください']], 'procedure');
      expectMentions(compactProse(document), [['評価したセクションでは', '指摘がゼロの場合にのみ「指摘なし」と言ってください']], 'document');
    }
  });

  test('the loaded data-flow review requires evidence across interacting operations', () => {
    const template = fs.readFileSync(`${SECTION}.tmpl`, 'utf-8');
    for (const document of [template, section]) {
      const dataFlow = document.split('### セクション 4: データの流れと相互作用のエッジケース')[1]?.split('### セクション 5:')[0];
      expect(dataFlow).toBeDefined();
      const instructions = dataFlow!.replace(/\s+/g, ' ');
      expectMentions(instructions, [['個別の図、一つの都合の良いスケジュール、シングルスレッドの実行、アトミックな呼び出しは', 'await をまたいだ順序を証明しません']], 'instructions');
      expectMentions(instructions, [['順序を除外するのは', 'それを防ぐメカニズムを名指しする場合だけです']], 'instructions');
      expectMentions(instructions, [['不変条件は要件であり', '実装がそれを満たすことの証明ではありません']], 'instructions');
      const phases = ['**境界を定義する。**', '**両方の順序を試す。**', '**結果を比較する。**', '**回帰の証明を指定する。**'].map(phase => instructions.indexOf(phase));
      expect(phases.every(position => position >= 0)).toBe(true);
      expect(phases).toEqual([...phases].sort((a, b) => a - b));
    }
  });

  test('the section is generated, not hand-edited', () => {
    expect(section.slice(0, 120)).toContain('AUTO-GENERATED');
  });
});

describe('section capture completion signal', () => {
  // Isolate the runner mock in its own Bun process. Loading a mock in this free
  // shard would replace the real runner for unrelated tests in the same process.
  function captureFixture(exitReason: string, draft: boolean, options: { seed?: string; output?: string; directoryBefore?: boolean; directoryAfter?: boolean } = {}) {
    const planDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ceo-capture-result-'));
    try {
      if (options.seed !== undefined) fs.writeFileSync(path.join(planDir, 'REPORT.md'), options.seed);
      if (options.directoryBefore) fs.mkdirSync(path.join(planDir, 'REPORT.md'));
      const script = `
        import { mock } from 'bun:test';
        import { writeFileSync, mkdirSync } from 'node:fs';
        let runnerCalls = 0;
        import { captureSectionReads } from ${JSON.stringify(path.join(ROOT, 'test/helpers/auq-sdk-capture.ts'))};
        mock.module(${JSON.stringify(path.join(ROOT, 'test/helpers/session-runner.ts'))}, () => ({
          runSkillTest: async () => {
            runnerCalls++;
            ${options.directoryAfter ? `mkdirSync(${JSON.stringify(path.join(planDir, 'REPORT.md'))});` : ''}
            ${draft ? `writeFileSync(${JSON.stringify(path.join(planDir, 'REPORT.md'))}, '# Review report\\nIN PROGRESS');` : ''}
            return { exitReason: ${JSON.stringify(exitReason)}, toolCalls: [], output: ${JSON.stringify(options.output ?? 'Final review report from stdout')} };
          },
        }));
        try {
        const capture = await captureSectionReads({
          planDir: ${JSON.stringify(planDir)}, skillName: 'plan-ceo-review',
          scenario: 'fixture', testName: 'capture-result-fixture', reportMarker: /review report/i,
        });
        process.stdout.write(JSON.stringify(capture));
        } catch (error) { process.stdout.write(JSON.stringify({ errorCode: error.code, runnerCalls })); }
      `;
      const child = Bun.spawnSync([process.execPath, '-e', script], { cwd: ROOT, timeout: 10_000 });
      expect(child.exitCode).toBe(0);
      expect(child.stderr.toString()).toBe('');
      return JSON.parse(child.stdout.toString());
    } finally {
      fs.rmSync(planDir, { recursive: true, force: true });
    }
  }

  test('an unchanged seeded report marker cannot supply attempt completion', () => {
    expect(captureFixture('success', false, { seed: '# Review report\nSeeded plan', output: 'Nothing completed' }))
      .toMatchObject({ exitReason: 'success', reportWritten: false, reportProduced: false, output: 'Nothing completed' });
  });
  test('unchanged seed preserves a valid successful terminal report fallback', () => {
    expect(captureFixture('success', false, { seed: '# Review report\nSeeded plan' }))
      .toMatchObject({ reportWritten: false, reportProduced: true, output: 'Final review report from stdout' });
  });
  test('changed seeded bytes are this attempt artifact, still gated by native success', () => {
    for (const exitReason of ['success', 'timeout']) {
      expect(captureFixture(exitReason, true, { seed: 'Original plan', output: '' }))
        .toMatchObject({ exitReason, reportWritten: true, reportProduced: exitReason === 'success', output: '# Review report\nIN PROGRESS' });
    }
  });
  test('same-byte rewrite is not new report evidence and empty terminal text stays incomplete', () => {
    expect(captureFixture('success', true, { seed: '# Review report\nIN PROGRESS', output: '' }))
      .toMatchObject({ reportWritten: false, reportProduced: false, output: '' });
  });
  test('a newly created report is retained on successful native completion', () => {
    expect(captureFixture('success', true, { output: '' }))
      .toMatchObject({ reportWritten: true, reportProduced: true, output: '# Review report\nIN PROGRESS' });
  });
  test('report snapshot errors retain their cause before the native attempt', () => {
    expect(captureFixture('success', false, { directoryBefore: true }))
      .toEqual({ errorCode: 'EISDIR', runnerCalls: 0 });
  });
  test('report read errors retain their cause after the native attempt', () => {
    expect(captureFixture('success', false, { directoryAfter: true }))
      .toEqual({ errorCode: 'EISDIR', runnerCalls: 1 });
  });

  test.each(['timeout', 'error_api'])('a draft from %s does not signal shared capture completion', exitReason => {
    const capture = captureFixture(exitReason, true);
    expect(capture).toMatchObject({
      exitReason, reportWritten: true, reportProduced: false, output: '# Review report\nIN PROGRESS',
    });
  });

  test('successful captures preserve the terminal-output fallback', () => {
    const capture = captureFixture('success', false);
    expect(capture).toMatchObject({
      exitReason: 'success', reportWritten: false, reportProduced: true, output: 'Final review report from stdout',
    });
  });
});

describe('CEO review completion evidence', () => {
  const completeReport = [
    '# CEO review — HOLD SCOPE',
    'Keep the cache process-local and invalidate only after a successful write.',
    '### Completion Summary',
    '| Review area | Outcome |',
    '| --- | --- |',
    '| Section 1 (Arch) | 1 issue: centralize the invalidation boundary |',
    '| Section 2 (Errors) | 3 error paths mapped, 1 fallback gap |',
    '| Section 3 (Security) | 1 issue: include tenant identity in keys |',
    '| Section 4 (Data/UX) | 2 edge cases mapped, 0 unhandled |',
    '| Section 5 (Quality) | No issues found |',
    '| Section 6 (Tests) | Diagram produced, 2 test gaps |',
    '| Section 7 (Perf) | 1 issue: cap cached value size |',
    '| Section 8 (Observ) | 1 gap: missing hit-rate metric |',
    '| Section 9 (Deploy) | 1 risk: warm-up load |',
    '| Section 10 (Future) | Reversibility: 5/5, 0 debt items |',
    '| Section 11 (Design) | SKIPPED (no UI scope) |',
    '## GSTACK REVIEW REPORT',
    '| Review | Runs | Status | Findings |',
    '| CEO | 1 | CLEAR | Cache boundaries reviewed |',
    '**VERDICT:** CEO CLEARED',
    'NO UNRESOLVED DECISIONS',
  ].join('\n');
  const completed = { exitReason: 'success', reportWritten: true, output: completeReport };

  test('accepts a complete compact report, including the documented no-UI skip', () => {
    expect(() => validateCeoReviewCompletion(completed)).not.toThrow();
  });

  test('accepts bold Markdown section labels', () => {
    const output = completeReport.replace(/\| (Section \d+ \([^|]+\)) \|/g, '| **$1** |');
    expect(() => validateCeoReviewCompletion({ ...completed, output })).not.toThrow();
  });

  test('accepts a numbered Completion Summary heading', () => {
    const output = completeReport.replace('### Completion Summary', '### 12. Completion Summary');
    expect(() => validateCeoReviewCompletion({ ...completed, output })).not.toThrow();
  });

  test('does not require the host plan-mode footer in a standalone report', () => {
    const output = completeReport.split('## GSTACK REVIEW REPORT')[0];
    expect(() => validateCeoReviewCompletion({ ...completed, output })).not.toThrow();
  });

  test('accepts completed reviews with unresolved findings and pending decisions', () => {
    const output = completeReport.replace('No issues found', '2 gaps; approval pending; TODO decisions recorded');
    expect(() => validateCeoReviewCompletion({ ...completed, output })).not.toThrow();
  });

  test('accepts a concrete finding about skipped work', () => {
    const output = completeReport.replace('1 gap: missing hit-rate metric', '1 gap: audit logging is skipped on failures');
    expect(() => validateCeoReviewCompletion({ ...completed, output })).not.toThrow();
  });

  test('rejects a timeout even when the report file exists', () => {
    expect(() => validateCeoReviewCompletion({ ...completed, exitReason: 'timeout' }))
      .toThrow('execution failed: timeout');
  });

  test('rejects report-like stdout when the requested report file is absent', () => {
    expect(() => validateCeoReviewCompletion({ ...completed, reportWritten: false }))
      .toThrow('did not write REPORT.md');
  });

  test('rejects generic prose mentioning a review and completion summary', () => {
    expect(() => validateCeoReviewCompletion({
      ...completed,
      output: 'I reviewed all eleven sections and will produce the Completion Summary and GSTACK REVIEW REPORT. '.repeat(3),
    })).toThrow('missing its Completion Summary');
  });

  test('requires an actual Completion Summary', () => {
    expect(() => validateCeoReviewCompletion({
      ...completed,
      output: completeReport.replace('### Completion Summary', 'The Completion Summary will follow.'),
    })).toThrow('missing its Completion Summary');
  });

  test.each(Array.from({ length: 11 }, (_, index) => index + 1))('requires the Section %i outcome', section => {
    const output = completeReport.split('\n')
      .filter(line => !line.startsWith(`| Section ${section} (`)).join('\n');
    expect(() => validateCeoReviewCompletion({ ...completed, output }))
      .toThrow(`Section ${section} outcome`);
  });

  test.each(['___ issues found', 'TBD', 'reviewed', 'SKIPPED'])('rejects unfinished or skipped non-UI outcomes: %s', outcome => {
    const output = completeReport.replace('No issues found', outcome);
    expect(() => validateCeoReviewCompletion({ ...completed, output }))
      .toThrow('Section 5 outcome');
  });

  test('rejects the original template placeholders as completed outcomes', () => {
    const output = completeReport.replace('SKIPPED (no UI scope)', '___ issues / SKIPPED (no UI scope)');
    expect(() => validateCeoReviewCompletion({ ...completed, output }))
      .toThrow('Section 11 outcome');
  });
});


// Both b176 paid attempts saved a comparison without their complete native choices.
// These guard source ordering and branches; captured controls retain those failures.
describe('CEO complete question persistence before dispatch', () => {
  const source = skeletonSource();
  const cycle = compactProse(between(source, '### 0D.', '### 0E.'));
  const built = between(cycle, '`currentDecision` を一つ作成してください', '**質問前のチェックポイント:**');
  const checkpoint = between(cycle, '**質問前のチェックポイント:**', '**4. 質問し');
  const dispatch = between(cycle, '**4. 質問し', '**回答後のチェックポイント:**');

  test('CEO constructs and verifies one complete row decision before dispatch', () => {
    ordered(cycle, ['**2. 保留中の選択を記録する。**', /情報源のファイル名やメッセージ/,
      '**3. その行の選択肢を比較して保存する。**', '`currentDecision` を一つ作成してください', /この行のカバレッジの違いを採点してください/,
      '**質問前のチェックポイント:**', '**読み戻し。**', '**4. 質問し、回答を記録し、修正する。**',
      /検証済みの読み戻しやチャットの文章を、一つのネイティブの引数オブジェクトにコピーしてください/,
      /質問、ヘッダー、ラベル、説明の全文を、検証済みのフィールドと文字通り比較してください/, /1 回の呼び出しで 1 行だけ尋ね、その引数オブジェクトは変えずに使い/,
      /実際の回答を得るまで停止してください/, /回答への参照とスコープを「正確な承認とスコープ」に保存し/, '**回答後のチェックポイント:**']);
    for (const field of ['| `question` | 完全な概要:', '| `header` と選択肢のラベル |', 'プロジェクト、ELI10、影響、推奨',
      '2〜3 個の選択肢を提示してください', '1〜2 文の要約', 'S/M/L/XL の労力', 'low/medium/high のリスク', '再利用、検証のカバレッジ',
      '完全性のスコアはありません']) expect(built).toContain(field);
    for (const field of ['## currentDecision (ROW-ID)', 'Commitment comparison: <complete grid>',
      'Question: <complete currentDecision.question>', 'Header: <exact currentDecision.header>',
      '<full first option description>', '<full second option description; repeat for all offered options>']) expect(checkpoint).toContain(field);
    expectMentions(checkpoint, [['グリッド、要約、参照だけであってはいけません']], 'checkpoint');
    expectMentions(checkpoint, [['ID とフィールドを `currentDecision` と照合し', '引用を情報源と照合してください']], 'checkpoint');
    expectMentions(checkpoint, [['送信する前にもう一度保存して読み戻してください']], 'checkpoint');
    expect(dispatch).toContain('{questions: [{question, header, options: [{label, description}, ...]}]}');
    expectMentions(dispatch, [['選択子の接頭辞だけ無視します']], 'dispatch');
    expectMentions(dispatch, [['文字列を比較し、形式やスコアは比較しないでください']], 'dispatch');
  });

  test('CEO finishes native field identity and tradeoffs before saving, then reads the entire payload', () => {
    expect(built).toContain('D<N> — <ROW-ID>: <一行の質問>');
    expectMentions(built, [['D は質問の数を数え', 'ROW-ID は保留中の選択を特定します']], 'built');
    expect(built).toContain('`(recommended)`');
    expect(built).toContain('| 各選択肢の `description` |');
    expect(built).toContain('少なくとも 2 つの ✅ の利点と 1 つの ❌ の欠点');
    expect(built).toContain('ホストの制限内での');
    expect(built).toContain('破壊的な選択の例外');
    expect(checkpoint).toContain('続きがあれば取得してください');
  });

  test('CEO save verification retains forbidden-write, failed-save, automatic and changed-decision branches', () => {
    const policy = compactProse(between(source, '**保存ポリシー: 書く前に選んでください。**', '| ID と担当者 |'));
    expectMentions(policy, [['書き込みが禁止されている場合は', '書き込みをせずに分析と判断を続けます']], 'policy');
    expect(policy).toContain('**未保存**');
    expect(policy).toContain('**完了がブロックされている**');
    expectMentions(policy, [['完了ログ、成功のテレメトリ、ExitPlanMode、次のスキルへの引き継ぎは行わないでください']], 'policy');
    expectMentions(policy, [['原因を示して停止します'], ['チャットで失敗した保存を代替できません']], 'policy');
    expectMentions(between(policy, '| 0H のスペックレビューの指標 |', '| レビュー、判断、質問の履歴ログ |'), [['レビュー担当者が利用できないことで', 'この書き込みは免除されません']], 'section');
    expectMentions(cycle, [['チャットの場合は', '**未保存**と表示された完全なテキストを確認してください']], 'cycle');
    expectMentions(cycle, [['前文だけが、散文や自動判断の伝達を許可できます']], 'cycle');
    expectMentions(dispatch, [['前文で許可された自動判断だけが、この待機を解決できます']], 'dispatch');
  });
});
