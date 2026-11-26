/**
 * A6 acceptance: the generated ship skill runs the measure-then-fix loop on a
 * red paid eval (classify, measure alone, decide by the measurement bar, fix
 * at the cause, re-measure, gate once) and measures a failed free shard before calling it pre-existing, and
 * it states the "diagnostic, not verdict" rule. Every ship-measure command and
 * flag the skill names exists in scripts/ship-measure.ts.
 */
import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { between, compact, expectMentions, expectOrdered, expectTokens } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');

describe('the generated ship skill runs the loop (A6 acceptance)', () => {
  const tests = fs.readFileSync(path.join(ROOT, 'ship/sections/tests.md'), 'utf8');
  const loop = fs.readFileSync(path.join(ROOT, 'ship/sections/measure.md'), 'utf8');
  const skeleton = fs.readFileSync(path.join(ROOT, 'ship/SKILL.md'), 'utf8');

  test('a red eval no longer stops /ship: Step 6 reads the loop instead of rerunning the gate', () => {
    const step6 = tests.slice(tests.indexOf('## Step 6: Eval スイート'));
    expect(step6.length).toBeGreaterThan(0);
    expectMentions(compact(step6), [
      ['eval が 1 つでも失敗した場合', 'ゲート全体を再実行しないでください'],
      ['`~/.claude/skills/gstack/ship/sections/measure.md`', '読み'],
      ['分類し', '単独で測定し', '原因で修正し', '再測定し', 'ゲートを 1 回実行します'],
    ], 'ship Step 6');
    expectTokens(skeleton, ['| `sections/measure.md` |'], 'ship skeleton routing table');
  });

  test('the loop steps run in order: classify, plan, measure, decide, fix, re-measure, stop, then gate once', () => {
    expectOrdered(loop, ['1. **分類する。**', '2. **計画を示す。**', '3. **測定する。**', '4. **終了コードで判断する**', '5. **原因のところを修正する。**', '6. **再測定する。**', '7. **停止する。**', '**ゲートは 1 回だけ。**'], 'measure loop steps');
    expectMentions(compact(loop), [
      ['完全なゲートを 1 回実行します'],
      // A push that runs the gate in CI is the gate run; a second dispatch doubles the paid gate.
      ['push がゲートの実行になります'],
      ['ゲートのコマンドを別途開始しないでください'],
    ], 'gate once');
  });

  test('the decision branches on every exit code the runner returns, with the bar and its rules', () => {
    const decideStep = between(loop, '4. **終了コードで判断する**', '5. **原因のところを修正する。**');
    expectTokens(decideStep, ['- 0: MEETS', '- 5: needs-classify', '- 6: EXTEND', '- 1: BELOW'], 'decision exit codes');
    for (const cls of ['provider', 'judge-noise', 'model-miss', 'timeout', 'hang', 'regression', 'fixable', 'unclassified']) expect(decideStep).toContain(`\`${cls}\``);
    expect(decideStep).toMatch(/MEETS 9\/10[\s\S]*MEETS-qualified 8\/10[\s\S]*EXTEND 7\/10[\s\S]*11\/12、10\/12、9\/12/);
    expectMentions(compact(decideStep), [['3 回目のバッチ', '決して行いません']], 'no third batch');
    expectMentions(compact(loop.slice(loop.indexOf('7. **停止する。**'))), [['終了コード 3', '名指しの赤']], 'exit 3');
    const source = fs.readFileSync(path.join(ROOT, 'scripts/lib/measure-bar.ts'), 'utf8');
    for (const cls of ['provider', 'judge-noise', 'model-miss', 'timeout', 'hang', 'regression', 'fixable', 'unclassified']) expect(source).toContain(`'${cls}'`);
  });

  test('the diagnostic-not-verdict rule, the honest-fix rule and the unmeasured label are stated', () => {
    expectMentions(compact(loop), [
      ['再実行', '診断であり、判定ではありません'],
      ['判定', '決して変えず', '`diagnostic`'],
      ['予算を上げたり', '閾値を下げたり', '判定の再試行', 'ケースをスキップしたりしないでください'],
      ['「修正後 at <cause> で k/n を観測」', '証明された合格率とは決して書かないでください'],
      ['`unmeasured`', 'PR 本文'],
      ['決して合格として数えません'],
      ['一度だけ尋ね', '回答をレポートに記録します'],
    ], 'measure honesty rules');
  });

  test('a failed free shard is measured before it is called pre-existing, with the retry off', () => {
    expectMentions(compact(tests), [['無料スイートのシャードが失敗した場合', '`~/.claude/skills/gstack/ship/sections/measure.md`', '読み']], 'free shard measure pointer');
    expect(tests.indexOf('sections/measure.md')).toBeLessThan(tests.indexOf('Test Failure Ownership Triage'));
    const free = between(loop, '**失敗した無料スイートのシャード (Step 5)。**', '**赤いの有料 eval (Step 6)。**');
    expectTokens(free, ['ship-measure free --files', '--shard <i>', '`ship_rerun_backend=ubicloud`', '`UBICLOUD_API_KEY`'], 'free shard rerun commands');
    expectMentions(compact(free), [
      ['既存のものと呼んだり', 'push したりする前に'],
      ['正確なファイル一覧'],
      ['1 回目は単独でベースライン'],
      ['フレーキーのリトライはオフ'],
      ['10 分の上限'],
      ['失敗したコマンド全体を 10 回再実行します'],
      ['完了した件数', '上限までに'],
    ], 'free shard rerun rules');
  });

  test('every ship-measure command and flag the skill names exists in the runner', () => {
    const source = fs.readFileSync(path.join(ROOT, 'scripts/ship-measure.ts'), 'utf8');
    const named = [...loop.matchAll(/ship-measure (\w+)([^`]*)`/g)];
    expect(named.length).toBeGreaterThan(5);
    for (const [, command, rest] of named) {
      expect(source).toMatch(new RegExp(`command [!=]== '${command}'`));
      for (const [flag] of rest!.matchAll(/--[a-z-]+/g)) expect(source).toContain(`'${flag}'`);
    }
  });
});
