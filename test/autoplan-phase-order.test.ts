/**
 * /autoplan phase-order pin (free, static).
 *
 * The pipeline order is a deliberate design decision (2026-08-25, user-directed):
 * CEO → Design (if UI scope) → DX (if developer-facing scope) → Eng, ALWAYS LAST.
 * Eng is the required shipping gate — it must review the FINAL amended plan, so
 * every other phase's amendments land before it. The original order buried Eng
 * mid-pipeline (CEO → Design → Eng → DX), which let DX findings land AFTER the
 * gate had signed off — the gate validated a stale plan.
 *
 * These assertions pin the template so a refactor can't silently restore the
 * old order. No paid eval runs the whole chain; the production phase-publication
 * hook enforces the order at runtime (autoplan-publication-guard.test.ts).
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { tmpdir } from 'node:os';
import { prepareMethodology, createSnapshot, preparePhaseClose } from '../bin/gstack-autoplan-snapshot';
import { SECTION } from '../scripts/resolvers/sections';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { ALL_HOST_CONFIGS } from '../hosts';
import { expectMentions } from './helpers/prompt-structure';


const ROOT = path.join(import.meta.dir, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');
const phases = [
  { child: 'ceo', id: '1', next: ['2'] },
  { child: 'design', id: '2', next: ['2.5', '3'] },
  { child: 'dx', id: '2.5', next: ['3'] },
  { child: 'eng', id: '3', next: ['4'] },
];

// Exercise the actual packet's bound report data; the shared close procedure
// owns the separate native-message operation that consumes those fields.
const closePackets = new Map<string, ReturnType<typeof preparePhaseClose> & { text: string }>();
function closePacket(phase: string) {
  if (closePackets.has(phase)) return closePackets.get(phase)!;
  const dir = fs.mkdtempSync(path.join(tmpdir(), 'autoplan-order-'));
  try {
    const active = path.join(dir, 'active.md'), restore = path.join(dir, 'restore.md');
    const original = '## Implementation plan\nKeep the documented behavior.\n## Review record\n';
    fs.writeFileSync(active, original); fs.writeFileSync(restore, original);
    const skill = `plan-${phase === 'dx' ? 'devex' : phase}-review/SKILL.md`;
    const method = prepareMethodology(phase, path.join(ROOT, skill), restore).methodologyPath;
    const checkpoint = createSnapshot(phase, active, restore, method).snapshotPath;
    fs.appendFileSync(active, `<!-- autoplan-accepted:${phase} -->\nNone: current behavior is retained.\n<!-- /autoplan-accepted:${phase} -->\n`);
    const packet = preparePhaseClose(phase, active, checkpoint, restore, method);
    const text = fs.readFileSync(packet.closePacketPath, 'utf8');
    const result = { ...packet, text }; closePackets.set(phase, result); return result;
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
}

function closeContent(phase: string) { return closePacket(phase).text; }

const flat = (text: string) => text.replace(/\s+/g, ' ');
function ordered(text: string, anchors: string[]) {
  const positions = anchors.map(anchor => text.indexOf(anchor));
  expect(positions.every(position => position >= 0), `missing one of ${JSON.stringify(anchors)}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

describe('autoplan phase order (Eng always last)', () => {
  const tmpl = read('autoplan/SKILL.md.tmpl');

  test('Sequential Execution block names Eng as the terminal phase', () => {
    const block = tmpl.split('## 逐次実行')[1]?.split('---')[0] ?? '';
    expect(block).toMatch(/CEO → デザイン.*→ DX.*→ エンジニアリング/s);
    // The old order must not resurface anywhere in the template.
    expect(tmpl).not.toContain('CEO → Design → Eng → DX');
    expect(tmpl).not.toContain('CEO → デザイン → エンジニアリング → DX');
  });

  test('phase headings appear in the new order: 1, 2, 2.5, 3', () => {
    ordered(tmpl, ['## フェーズ 1: CEO レビュー', '## フェーズ 2: デザインレビュー', '## フェーズ 2.5: DX レビュー', '## フェーズ 3: エンジニアリングレビュー']);
    // No stale Phase 3.5 heading or transition marker survives.
    expect(tmpl).not.toContain('Phase 3.5');
    expect(tmpl).not.toContain('フェーズ 3.5');
  });

  test.each(phases)('carved child completion and handoff IDs match the pipeline: %j', ({ child, id, next }) => {
    const section = read(`autoplan/sections/${child}-phase.md.tmpl`);
    const report = closePacket(child).report;
    const announced = [report.number];
    const handoff = report.next;
    expect(section.trim().endsWith('{{SECTION:phase-close}}')).toBe(true);
    const pointer = section.indexOf('{{SECTION:phase-close}}');
    expect(pointer).toBeGreaterThan(section.indexOf('**このフェーズを閉じる:**'));
    expect(section.slice(pointer).trim()).toBe('{{SECTION:phase-close}}');
    const generated = read(`autoplan/sections/${child}-phase.md`);
    expect(generated).toContain('Read `~/.claude/skills/gstack/autoplan/sections/phase-close.md` を全文読んで実行してください');
    expect(announced).toEqual([id]);
    expect([...handoff.matchAll(/Phase (\d+(?:\.\d+)?)/g)].map(m => m[1])).toEqual(next);
    // Catch obsolete Phase 3.5 references anywhere in any carved child,
    // including prose or prompts that could contradict otherwise-correct headings.
    const known = new Set(['0', '0.5', '1', '2', '2.5', '3', '4']);
    const mentioned = [...section.matchAll(/(?:\bPhase |フェーズ )(\d+(?:\.\d+)?)/gi)].map(m => m[1]);
    expect(mentioned.filter(id => !known.has(id))).toEqual([]);
  });

  test('each later Codex voice receives only already-completed phase context', () => {
    const dx = read('autoplan/sections/dx-phase.md.tmpl');
    const priorContext = [...dx.matchAll(/^\s*(CEO|デザイン|エンジニアリング|DX): <[^>\n]*挿入/gm)].map(m => m[1]);
    expect(priorContext).toEqual(['CEO', 'デザイン']);
    // Eng's Codex voice sees every prior phase's consensus, DX included.
    expect(read('autoplan/sections/eng-phase.md.tmpl')).toContain(
      'DX: <DX の合意の表の要約を挿入',
    );
  });

  test('single final gate: premises queue for the gate, never a mid-run stop', () => {
    expectMentions(flat(tmpl), [['ユーザーへの挑戦', '決して自動判断しない']], 'flat(tmpl)');
    expectMentions(flat(tmpl), [['最後の承認ゲート', '一度だけ']], 'flat(tmpl)');
    expectMentions(flat(tmpl), [['実行の途中', '尋ねません']], 'flat(tmpl)');
    expect(tmpl).not.toContain('Premise gate passed (user confirmed)');
    const ceo = read('autoplan/sections/ceo-phase.md.tmpl');
    expect(ceo).not.toContain('GATE: Present premises to user for confirmation');
    expectMentions(flat(ceo), [['フェーズ 4', 'ユーザーへの挑戦', 'キューに入れ']], 'flat(ceo)');
    expectMentions(flat(ceo), [['パイプラインの途中', '決して止めない']], 'flat(ceo)');
  });

  test('generated workflow loads each complete skill at its own phase boundary', () => {
    const skill = read('autoplan/SKILL.md');
    const phase0 = skill.slice(skill.indexOf('### 手順 3:'), skill.indexOf('## フェーズ 1:'));
    const setup = flat(phase0.split('**セクションのスキップ一覧')[0]!);
    expectMentions(setup, [['将来のフェーズ', '先読みしないでください']], 'setup');
    // Locating paths at intake does not load or execute their future phases.
    expect(phase0.split('**セクションのスキップ一覧')[0]!).not.toMatch(/^Read `[^`]+\/SKILL\.md` in full now/gm);

    const owners = [
      { id: '1', name: 'ceo', next: '## フェーズ 2:' },
      { id: '2', name: 'design', next: '## フェーズ 2.5:' },
      { id: '2.5', name: 'devex', next: '## フェーズ 3:' },
      { id: '3', name: 'eng', next: '## 判断の監査証跡' },
    ];
    for (const { id, name, next } of owners) {
      const start = skill.indexOf(`## フェーズ ${id}:`);
      const end = skill.indexOf(next, start);
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);
      const block = skill.slice(start, end);
      const child = name === 'devex' ? 'dx' : name;
      expect(block).toContain(`/autoplan/sections/${child}-phase.md`);
      // The phase checkpoint binds the installed host's complete methodology.
      // A second runtime-root Read would select another harness's skill.
      expect(block).not.toMatch(/^Read `[^`]+\/SKILL\.md` in full now/gm);
      const phase = read(`autoplan/sections/${child}-phase.md`);
      const load = phase.indexOf('ディスパッチの前に、`readRanges` に従って `methodologyPath`');
      expect(load).toBeGreaterThanOrEqual(0);
      expect(phase).toContain(`methodology ${child} "<REVIEW_SKILL>" "<RESTORE_PATH>"`);
      expect(phase).toContain('`readRanges` に従って');
      expect(load).toBeLessThan(phase.indexOf(`create ${child} `));
      if (id === '2' || id === '2.5') {
        expect(block.indexOf('**スキップ条件:**')).toBeLessThan(block.indexOf('> **STOP.**'));
      }
    }
    const gate = skill.indexOf('## フェーズ 4: 最終承認ゲート');
    expect(gate).toBeGreaterThan(-1);
    expect(skill.indexOf('Read `~/.claude/skills/gstack/autoplan/sections/tasks-aggregator.md`'))
      .toBeGreaterThan(gate);
  });
});

describe('autoplan phase execution checkpoints', () => {
  const tmpl = read('autoplan/SKILL.md.tmpl');
  const phases = ['ceo', 'design', 'dx', 'eng'];

  test('loads full review skills at phase entry instead of prefetching future phases', () => {
    const intake = flat(tmpl.split('### 手順 3:')[1]?.split('## フェーズ 0.5:')[0] ?? '');
    expect(intake).toContain('`<REVIEW_SKILL>`');
    expectMentions(intake, [['将来のフェーズ', '先読みしないでください']], 'intake');
    for (const phase of phases) {
      const section = read(`autoplan/sections/${phase}-phase.md.tmpl`);
      expect(section).toMatch(/^ディスパッチの前に、`readRanges` に従って \{\{AUTOPLAN_REVIEW_FILE:plan-[a-z-]+:with-sections\}\}/);
      const load = section.split('\n')[0]!;
      expect(load).toContain('`readRanges` に従って');
      expect(load).toMatch(/EOF まで/);
      expectMentions(load, [['スキップ一覧', '読み込むだけ']], 'load');
      expect(section.indexOf(':with-sections}}')).toBeLessThan(section.indexOf('create ' + phase));
      expect(section).toContain(`create ${phase} "<ACTIVE_PLAN>" "<RESTORE_PATH>" "<methodologyPath>"`);
    }
  });

  for (const phase of phases) {
    test(`${phase} places a blocking native dispatch and its completion wait before outside review`, () => {
      const section = read(`autoplan/sections/${phase}-phase.md.tmpl`);
      const native = section.indexOf(`**{{NATIVE_LABEL}} の${phase === 'design' ? 'デザイン' : phase === 'dx' ? ' DX ' : phase === 'ceo' ? ' CEO ' : 'エンジニアリングの'}サブエージェント**`);
      const outside = section.indexOf('{{OUTSIDE_INVOCATION:autoplan}}');
      expect(native).toBeGreaterThan(-1);
      expect(native).toBeLessThan(outside);
      const dispatch = section.slice(native, outside);
      const words = flat(dispatch);
      expect(dispatch).toContain('`run_in_background`');
      expect(dispatch).toContain('`false`');
      expect(dispatch).toContain('isAsync: true');
      expectMentions(words, [['最後の', 'ツール呼び出し']], 'words');
      expectMentions(words, [['直ちに', 'レスポンスを終えて']], 'words');
      expectMentions(words, [['それ以上のツール呼び出し', 'レビュー']], 'words');
      expect(dispatch).toContain('`nativePromptPath` を EOF まで');
      expectMentions(words, [['INPUT', 'スナップショット', 'ハッシュ', '一致']], 'words');
      expectMentions(words, [['無効', '一度だけ', '再試行']], 'words');
      expectMentions(words, [['インライン', '代替', 'しないでください']], 'words');
      // Provider preflight, timeout and native fallback remain at every call.
      // The invocation states its own outer gate; a second, larger number would contradict it.
      expect(section).not.toContain('Outer tool timeout');
      expect(section).toContain(`{{OUTSIDE_PROVENANCE:${phase}}}`);
      expectMentions(section, [['利用不可'], ['無効']], 'section');
      expect(section).toContain('N/A');
      expect(section).toContain('CONFIRMED');
      expect(section).toMatch(/primary cannot replace|主要な voice で代用/);
      expect(section).toMatch(/never CONFIRMED|CONFIRMED としてはいけません/);
    });
  }

  test('the parent completes only the current phase and cannot waive native work for context pressure', () => {
    const contract = flat(tmpl.split('## 逐次実行')[1]?.split('---')[0] ?? '');
    expectMentions(contract, [['1 つのフェーズだけ', '有効']], 'contract');
    expectMentions(contract, [['将来のフェーズ', '決して', '下書き']], 'contract');
    ordered(contract, ['そのフェーズの指示とスキル/セクション全体を読み込み', '新しいスナップショットを作成し', 'nativeDispatchPrompt',
      'ネイティブの最終結果を受け取り', 'そのフェーズの残りの主要なレビューセクション']);
    ordered(contract, ['`phase-close`', '親に完了メッセージを送信します', 'メッセージを送信した後にのみ、ドライバーは',
      'エンジニアリングの後は、最終的な統合と承認に進みます']);
    expectMentions(contract, [['以前の Read', 'close', '代わりにはなりません']], 'contract');
    expect(contract).toContain('6 番目(公開)');
    expectMentions(contract, [['要求', 'ハッシュ', '証明しません']], 'contract');
    expect(contract).toContain('保留中は利用不可ではありません');
    expectMentions(contract, [['省略しない', 'ネイティブのパス', '必須セクション']], 'contract');
    expectMentions(contract, [['トランスクリプト', '決して読まないでください']], 'contract');
    const rerun = flat(tmpl.split('**影響するフェーズの再実行を開始する場合:**')[1]!.split('---')[0]!);
    expect(rerun.length).toBeGreaterThan(0);
    expect(rerun).toContain('`baselineEdits.record` と `sourceSha256`');
    expect(flat(tmpl)).toContain('`amend-input`');
  });

  test('each phase binds its fixed amendment checkpoint before loading the shared close', () => {
    for (const [phase, number] of [['ceo', '1'], ['design', '2'], ['dx', '2.5'], ['eng', '3']]) {
      const section = read(`autoplan/sections/${phase}-phase.md.tmpl`);
      const barrier = section.indexOf('**このフェーズを閉じる:**');
      const pointer = section.indexOf('{{SECTION:phase-close}}');
      expect(barrier).toBeGreaterThan(-1);
      expect(pointer).toBeGreaterThan(barrier);
      expect(closePacket(phase).report.number).toBe(number);
      expect(section.match(/\{\{SECTION:phase-close\}\}/g)).toHaveLength(1);
      const binding = flat(section.slice(barrier, pointer));
      const checkpoint = phase === 'ceo' ? 'CEO_STEP0_CHECKPOINT' : `${phase.toUpperCase()}_INPUT`;
      expect(binding).toContain(`フェーズ \`${phase}\`、チェックポイント \`<${checkpoint}>\``);
      expect(binding).toContain('`methodologyPath`');
      expect(binding).toContain('改めて');
      expectMentions(binding, [['エクスポート', '置き換えてはいけません']], 'binding');
      expect(section.slice(pointer).trim()).toBe('{{SECTION:phase-close}}');
    }
  });

  test('the shared close separates complete readback, verification, publication and driver return', () => {
    const template = read('autoplan/sections/phase-close.md.tmpl');
    const close = flat(template);
    const stages = ['1. **レビューを完了させて保存する。**', '2. **承認された要件を照合する。**',
      '3. **このフェーズの close パケットを準備する。**', '4. **現在のパケット全体を読む。**',
      '5. **現在の実装を検証する。**', '6. **親のレポートを公開する。**', '7. **ドライバーに戻る。**'];
    const positions = stages.map(stage => template.indexOf(stage));
    ordered(template, stages);
    expectMentions(close, [['レビュアーの最終結果']], 'close');
    expectMentions(close, [['INPUT', 'voice のスナップショット', '照合']], 'close');
    expectMentions(close, [['利用不可', '無効', '完了の評価を与えません']], 'close');
    expectMentions(close, [['`None`', '理由', '説明しなければなりません']], 'close');
    expect(template).toContain('prepare-close "<PHASE>" "<ACTIVE_PLAN>" "<AMENDMENT_CHECKPOINT>" "<RESTORE_PATH>" "<methodologyPath>"');
    expect(close).toContain('`readRanges`');
    expect(close).toContain('正確な `offset` と `limit`');
    expect(close).toMatch(/EOF まで/);
    expectMentions(close, [['結果のない要求', '先に進んではいけません']], 'close');
    expect(close).toContain('手順 3 に戻ります');
    const verification = flat(template.slice(positions[4], positions[5]));
    expectMentions(verification, [['手順 1', '前提条件', '再確認']], 'verification');
    expectMentions(verification, [['このフェーズを開いたまま']], 'verification');
    expect(close).not.toContain('The packet owns the close continuation');
    expect(read('autoplan/sections/phase-close.md')).toContain(template.trim());
  });

  test('native publication precedes driver continuation without a repair bypass or user wait', () => {
    const close = flat(read('autoplan/sections/phase-close.md.tmpl'));
    const publish = close.indexOf('6. **親のレポートを公開する。**');
    const report = close.indexOf('**フェーズ <report.number> 完了。**');
    const continueAt = close.indexOf('7. **ドライバーに戻る。**');
    expect(publish).toBeGreaterThan(-1);
    expect(report).toBeGreaterThan(publish);
    expect(continueAt).toBeGreaterThan(report);
    expectMentions(close.slice(publish, report), [['次のフェーズ', 'ツール呼び出し', 'より前']], 'close.slice(publish, report)');
    expect(close.slice(continueAt)).toContain('同じターンで');
    expectMentions(close.slice(continueAt), [['「続けて」', '待たないでください']], 'close.slice(continueAt)');
    expect(close.slice(continueAt)).toContain('スキップは完了ではありません');
    expectMentions(close, [['bash で表示', '公開にはなりません']], 'close');
  });

  test('all four phase formats consume the current packet data in the shared publication step', () => {
    const totals: Record<string, string> = {ceo: '6', design: 'rows in the completed design litmus scorecard', dx: '6', eng: '6'};
    const numbers: Record<string, string> = {ceo: '1', design: '2', dx: '2.5', eng: '3'};
    const publication = read('autoplan/sections/phase-close.md.tmpl').split('6. **親のレポートを公開する。**')[1]!.split('7. **ドライバーに戻る')[0]!;
    expect(publication).toContain('**フェーズ <report.number> 完了。**');
    expect(publication).toContain('外部レビュー: <完了: N 件の懸念 / 利用不可 / 無効>');
    expect(publication).toContain('ネイティブのサブエージェント: <完了: N 件の問題 / 利用不可>');
    expect(publication).toContain('N/A (voice のカバレッジが欠けている)');
    expect(publication).toContain('X/<report.total> のネイティブ+外部が確認');
    expect(publication).toContain('`report.includeDxMetrics`');
    expect(publication).toContain('DX の総合: <score>/10。TTHW: <observed> 分 → <target> 分。');
    expect(publication).toContain('`report.next`');
    for (const child of phases) {
      const packet = closePacket(child);
      expect(packet.report.number).toBe(numbers[child]);
      expect(packet.report.total).toBe(totals[child]);
      expect(packet.report.includeDxMetrics).toBe(child === 'dx');
      expect(packet.phaseComplete).toBe(false);
      const continuation = packet.text.split('## Return to the close procedure')[1]!;
      expectMentions(continuation, [['not', 'following', 'completed']], 'continuation');
      expect(continuation).toContain(`**Phase ${numbers[child]} complete.**`);
      expect(continuation).toContain(`Passing to <applicable ${packet.report.next}>.`);
      const caller = read(`autoplan/sections/${child}-phase.md.tmpl`).split('**このフェーズを閉じる:**')[1]!;
      expect(caller.trim().endsWith('{{SECTION:phase-close}}')).toBe(true);
      expect(caller).not.toContain('**Phase ');
      expect(caller).not.toContain('**フェーズ ');
      expect(caller).not.toContain('Passing to ');
    }
  });

  test('Design hands off to conditional DX and DX never requests a future Eng result', () => {
    const design = read('autoplan/sections/design-phase.md.tmpl');
    const dx = read('autoplan/sections/dx-phase.md.tmpl');
    expect(design).not.toContain('> Passing to Phase 3.');
    expect(design).not.toContain('> フェーズ 3 に進みます。');
    expect(dx).toContain('デザイン: <デザインの合意の要約を挿入。または「スキップ、UI スコープなし」>');
    expect(dx).not.toContain('Eng: <insert Eng consensus summary>');
  });
});


describe('autoplan current implementation-plan identity', () => {
  test('pins the assigned active plan and keeps accepted amendments separate from review analyses', () => {
    const intake = flat(read('autoplan/SKILL.md.tmpl').split('## フェーズ 0: 受付と復元ポイント')[1]?.split('### 手順 2:')[0] ?? '');
    expect(intake).toContain('ACTIVE_PLAN (ハーネスが割り当てた計画。なければ SOURCE_PLAN)');
    expectMentions(intake, [['計画の修正', 'レビュー成果物', 'ACTIVE_PLAN', '保存']], 'intake');
    expectMentions(intake, [['承認', '会話', '送信']], 'intake');
    expectMentions(intake, [['init', 'SOURCE_PLAN', '正確にバックアップ']], 'intake');
    expect(intake).toContain('init "<SOURCE_PLAN>" "<ACTIVE_PLAN>" "<RESTORE_PATH>"');
    expectMentions(intake, [['ヘルパー', 'エラー', '停止']], 'intake');
    expect(intake).toContain('`## Review record`');
    // Binding belongs to the lazy execution site, not a stale intake variable.
    expect(intake).not.toContain('Bind `<review_plan_path>`');
  });

  test('DX scope consumes the deterministic full-input result and permits only enabling overrides', () => {
    const intake = flat(read('autoplan/SKILL.md.tmpl').split('### 手順 2: 文脈を読む')[1]?.split('### 手順 3:')[0] ?? '');
    expect(intake).toContain('scope "<ACTIVE_PLAN>"');
    expect(intake).toContain('`dxRequired`');
    expectMentions(intake, [['しきい値', '2 つ以上', '用語の一致']], 'intake');
    expect(intake).toContain('`--developer-tool` または `--agent-primary`');
    expectMentions(intake, [['文脈上のラベル', '肯定的な結果']], 'intake');
  });

  test('every native and outside call site binds the fresh snapshot, retaining requested outside consensus', () => {
    for (const phase of ['ceo', 'design', 'dx', 'eng']) {
      const section = read(`autoplan/sections/${phase}-phase.md.tmpl`);
      const bind = section.indexOf("**フェーズ入力をバインドする:**");
      const native = section.indexOf('サブエージェント**');
      const outside = section.indexOf('{{OUTSIDE_INVOCATION:autoplan}}');
      expect(bind).toBeGreaterThan(-1);
      expect(bind).toBeLessThan(native);
      expect(native).toBeLessThan(outside);
      const preparation = section.slice(bind, native);
      expect(preparation).toContain(`create ${phase} "<ACTIVE_PLAN>" "<RESTORE_PATH>"`);
      expect(preparation).toContain('`<' + phase.toUpperCase() + '_INPUT>` として `snapshotPath`');
      expect(preparation).toContain('`Review record`');
      expect(flat(section)).toContain('`nativeDispatchPrompt` を変更せずに');
      expect(section).toContain('`<' + phase.toUpperCase() + '_INPUT>` の隣にある `snapshot.json`');
      expect(section).toContain('`nativePromptPath` を EOF まで');
      expect(section).toContain(`外部のプロンプト: <${phase.toUpperCase()}_INPUT> と以下の文脈の全内容をインラインで含めます`);
      const checkpoint = phase === 'ceo' ? 'CEO_STEP0_CHECKPOINT' : `${phase.toUpperCase()}_INPUT`;
      expect(section).toContain(`フェーズ \`${phase}\`、チェックポイント \`<${checkpoint}>\``);
      expect(section).toContain('{{SECTION:phase-close}}');
      expect(section).not.toContain('<review_plan_path>');
      expect(section).not.toContain('<plan_path>');
      expectMentions(section, [['要約', '以前のレビュー', '含みません']], 'section');
    }
    expect(read('autoplan/sections/phase-close.md.tmpl')).toContain('prepare-close "<PHASE>" "<ACTIVE_PLAN>" "<AMENDMENT_CHECKPOINT>"');
    expect(read('autoplan/sections/eng-phase.md.tmpl')).toContain('DX: <DX の合意の表の要約を挿入');
  });
});


describe('phase-close control ownership across installed hosts', () => {
  test.each(ALL_HOST_CONFIGS)('$name loads or inlines the same numbered close procedure', host => {
    const ctx = {host: host.name, paths: HOST_PATHS[host.name], skillName: 'autoplan', tmplPath: ''} as TemplateContext;
    const rendered = SECTION(ctx, ['phase-close']);
    const template = read('autoplan/sections/phase-close.md.tmpl').trimEnd();
    if (host.name === 'claude') {
      expect(rendered).toContain(`${ctx.paths.skillRoot}/autoplan/sections/phase-close.md`);
      expect(rendered).toContain('を全文読んで実行してください');
    } else {
      expect(rendered).toBe(template);
      ordered(rendered, ['4. **現在のパケット全体を読む。**', '5. **現在の実装を検証する。**',
        '6. **親のレポートを公開する。**', '7. **ドライバーに戻る。**']);
      expect(rendered).toContain('同じターンで');
      expectMentions(rendered, [['「続けて」', '待たないでください']], 'rendered');
      expect(rendered).not.toContain('The packet owns the close continuation');
    }
  });
});
