/**
 * AskUserQuestion Format resolver — gate-tier assertions on the generated
 * Pros/Cons format directive block.
 *
 * v1.7.0.0 introduces Pros/Cons decision-brief formatting:
 * - D<N> numbered header
 * - ELI10 paragraph
 * - Stakes-if-we-pick-wrong line
 * - Recommendation line (mandatory, even for neutral posture)
 * - Pros/Cons block with ✅/❌ per option, min 2 pros + 1 con, ≥40 char bullets
 * - Net: synthesis line
 *
 * This test pins the format contract so a future edit to the resolver
 * can't silently drop a rule. If the resolver stops emitting one of
 * these tokens, bun test catches it in milliseconds instead of waiting
 * for the weekly periodic eval to notice.
 */
import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from '../scripts/resolvers/types';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { generateAskUserFormat } from '../scripts/resolvers/preamble/generate-ask-user-format';
import { compact, expectMentions, expectTokens } from './helpers/prompt-structure';

function makeCtx(): TemplateContext {
  return {
    skillName: 'test-skill',
    tmplPath: 'test.tmpl',
    host: 'claude',
    paths: HOST_PATHS.claude,
    preambleTier: 2,
  };
}

describe('generateAskUserFormat — v1.7.0.0 Pros/Cons format', () => {
  const out = generateAskUserFormat(makeCtx());

  test('includes AskUserQuestion Format header', () => {
    expect(out).toContain('## AskUserQuestion Format');
  });

  test('documents D-numbered header requirement', () => {
    expect(out).toContain('D<N>');
    expectMentions(out, [['最初の質問', '`D1`']], 'out');
  });

  test('documents ELI10 requirement', () => {
    expect(out).toContain('ELI10');
    expect(out).toMatch(/plain English.*16-year-old/);
  });

  test('documents Stakes-if-we-pick-wrong line', () => {
    expect(out).toContain('Stakes if we pick wrong');
  });

  test('documents mandatory Recommendation line', () => {
    expect(out).toContain('Recommendation: <choice>');
    expectMentions(out, [['Recommendation', '常に必須']], 'out');
  });

  test('documents Pros / cons block header', () => {
    expect(out).toContain('Pros / cons:');
  });

  test('documents ✅ pro markers with min count + min length rule', () => {
    expect(out).toContain('✅');
    expect(out).toContain('≥2 個の pros');
    expect(out).toContain('40 文字以上');
  });

  test('documents ❌ con markers with min count rule', () => {
    expect(out).toContain('❌');
    expect(out).toContain('≥1 個の con');
  });

  test('documents hard-stop escape with exact phrase', () => {
    // "No cons — this is a hard-stop choice" may span a line break in the
    // rendered resolver text; match across whitespace collapses.
    expectMentions(out, [['no', 'hard-stop', 'choice']], 'out');
  });

  test('documents neutral-posture escape preserving', () => {
    // CT1 resolution: (recommended) label STAYS on default option to preserve AUTO_DECIDE contract.
    expect(out).toMatch(/taste call/i);
    expectMentions(out, [['AUTO_DECIDE', '(recommended)', '残']], 'out');
  });

  test('documents Net line for closing synthesis', () => {
    expect(out).toMatch(/^Net:/m);
    expect(out).toMatch(/synthesis|tradeoff/i);
  });

  test('documents Completeness scoring rules (coverage vs kind)', () => {
    expect(out).toContain('Completeness');
    expect(out).toContain('10 = 完全');
    expectMentions(out, [['種類で異なる', 'options differ in kind, not coverage']], 'out');
  });

  test('documents tool_use mandate (rule 11)', () => {
    expect(out).toMatch(/tool_use/);
    expectMentions(out, [['tool_use', '散文ではなく']], 'out');
  });

  test('includes self-check before emitting', () => {
    expect(out).toContain('### 出力前の自己チェック');
    expectMentions(out, [['D<N>', 'ヘッダー']], 'out');
    expect(out).toContain('`Net:` が質問文を締めている');
  });

  test('documents D-numbering as model-level not runtime state', () => {
    // Codex finding #4 caveat: D-numbering is a prompt wish, not a system guarantee.
    expectMentions(out, [['モデルレベルの指示', 'ランタイムのカウンターではありません']], 'out');
  });

  test('per-skill override guidance preserved', () => {
    expectMentions(out, [['スキルごとの指示', '追加']], 'out');
  });
});

describe('generateAskUserFormat — 5+ option split rule (slim inline + docs pointer)', () => {
  const out = generateAskUserFormat(makeCtx());

  // 5 highest-signal pins. The full rule lives in
  // docs/askuserquestion-split.md; this contract only checks what the
  // inline subsection MUST surface so the agent can act without
  // reading the docs file for routine 5-option splits.

  test('forbids dropping options to fit the 4-option cap', () => {
    expect(out).toContain('**4 個の選択肢**');
    expectMentions(out, [['捨てたり', '黙って先送り', 'いけません']], 'out');
  });

  test('names the Include / Defer / Cut / Hold buckets', () => {
    expect(out).toMatch(/A\) Include/);
    expect(out).toMatch(/B\) Defer/);
    expect(out).toMatch(/C\) Cut/);
    expect(out).toMatch(/D\) Hold/);
  });

  test('specifies D<N>.k child numbering and D<N>.final summary', () => {
    expect(out).toContain('D<N>.k');
    expect(out).toContain('D<N>.final');
  });

  test('AUTO_DECIDE is gated at runtime, not just collision-resistance', () => {
    expect(out).toContain('bin/gstack-question-preference');
    expect(out).toContain('*-split-*');
    expectMentions(out, [['`*-split-*`', 'AUTO_DECIDE', '対象になることはありません']], 'out');
  });

  test('points to docs/askuserquestion-split.md for the full rule', () => {
    expect(out).toContain('docs/askuserquestion-split.md');
    expectMentions(out, [['N>4', 'オンデマンド']], 'out');
  });

  test('dependency repair routes to one candidate', () => {
    const source = fs.readFileSync(path.resolve(import.meta.dir, '../docs/askuserquestion-split.md'), 'utf8');
    const repair = source.split('**ステップ 1 — 依存関係と容量を検証する。**')[1]?.split('**ステップ 2')[0] ?? '';
    const text = compact(repair);
    expectMentions(text, [['実際の過去の回答']], 'text');
    expectMentions(text, [['振り分け', 'どの処理も変わりません']], 'text');
    expectTokens(text, ['`D<N>.revise-<k>`', '**Include / Defer / Cut / Hold**'], 'text');
    expectMentions(text, [['他の候補', '黙って', 'いけません']], 'text');
    expectMentions(text, [['Hold', 'チェーンを止めます']], 'text');
    expectMentions(text, [['未解決のブロッキング競合', '報告']], 'text');
    expectMentions(text, [['整合しない集合', '実装可能', 'いけません']], 'text');
    expect(text).not.toContain('accept the broken state');
  });

  test('regression: orphan "12." prefix removed from CJK rule', () => {
    expect(out).not.toContain('12. **Non-ASCII');
    expect(out).not.toContain('12. **非 ASCII');
    expect(out).toContain('**非 ASCII 文字');
  });
});

describe('generateAskUserFormat — runtime-failure prose fallback', () => {
  const out = generateAskUserFormat(makeCtx());

  test('documents the unavailable/failed subsection', () => {
    expectMentions(out, [['AskUserQuestion', '使えない', '失敗']], 'out');
  });

  test('carves out the auto-decide denial as NOT a failure', () => {
    expect(out).toContain('[plan-tune auto-decide]');
    expectMentions(out, [['自動決定による拒否', '失敗ではありません']], 'out');
    expectMentions(out, [['再試行せず', '散文にフォールバックもしません']], 'out');
  });

  test('retries the errored call exactly once before degrading', () => {
    const flat = compact(out).replace(/\*\*/g, '');
    expectMentions(flat, [['同じ', '呼び出し', '1 回だけ', '再試行']], 'out');
    expectMentions(flat, [['再試行すると二重に質問']], 'out');
  });

  test('branches on SESSION_KIND: spawned / headless / interactive', () => {
    expect(out).toContain('SESSION_KIND');
    expect(out).toMatch(/`spawned`[\s\S]*自動選択/);
    expect(out).toMatch(/`headless`[\s\S]*BLOCKED/);
    expect(out).toMatch(/`interactive`[\s\S]*散文フォールバック/);
    // empty/absent SESSION_KIND degrades to interactive
    expect(out).toMatch(/空または不在[\s\S]{0,40}interactive/);
  });

  // The mandatory triad the user explicitly required for the plain-text output.
  test('prose fallback mandates the triad: issue ELI10', () => {
    expect(out).toContain('ELI10');
  });

  test('prose fallback mandates the triad: per-choice Completeness score', () => {
    const flat = compact(out).replace(/\*\*/g, '');
    expectMentions(flat, [['選択肢ごとの Completeness スコア', '各選択肢', '明示']], 'out');
  });

  test('prose fallback mandates the triad: recommendation + (recommended) marker', () => {
    expect(out).toMatch(/Recommendation: <choice> because/);
    expectMentions(out, [['`(recommended)`', 'マーカー', 'その選択肢']], 'out');
  });

  test('prose fallback is one paragraph per choice', () => {
    expectMentions(out, [['選択肢ごとに 1 段落'], ['箇条書きは不可']], 'out');
  });

  test('prose fallback tells the user to reply with a letter, then STOP', () => {
    expectMentions(out, [['返信行', 'セレクター']], 'out');
    expectMentions(out, [['STOP', '回答を待ちます']], 'out');
  });

  test('prose questions carry their checked identity', () => {
    const layout = out.slice(out.indexOf('レイアウト:'), out.indexOf('**継続'));
    expect(layout).toContain('提示するセレクターを列挙した');
    expect(layout).toContain('`QUESTION_TUNING: true` の場合は');
    expectTokens(layout, ['`<gstack-qid:{question_id}>`'], 'layout');
  });

  // OV2: the former "tool_use, not prose" assertions must carry the qualifier so the
  // fallback is not self-contradicting. Guards against the instruction collision
  // silently returning on a future edit.
  test('OV2: the Format line qualifies', () => {
    expectMentions(out, [['tool_use', '散文ではなく'], ['ただし', '失敗時フォールバック', '散文フォールバックが正しい出力']], 'out');
  });

  test('OV2: the self-check "not writing prose" line', () => {
    // The exception is two-pronged: CONDUCTOR_SESSION makes prose the default, OR the documented failure fallback.
    const line = out.split('\n').find(l => l.includes('散文ではなくツールを呼んでいる')) ?? '';
    expectMentions(line, [['ただし', '`CONDUCTOR_SESSION: true`', '失敗時フォールバック']], 'self-check line');
  });

  // #2733: proactive spawned rule — spawned outranks Conductor. Without it a
  // spawned session's AUQ handling exists only as a failure-reaction path, and
  // a spawned subagent inside a Conductor workspace prose-STOPs with no reader.
  test('Spawned: proactive do-not-call rule present', () => {
    const spawnedRule = out.indexOf('`SESSION_KIND: spawned` がエコーされている');
    const conductorRule = out.indexOf('`CONDUCTOR_SESSION: true` がエコーされている');
    expect(spawnedRule).toBeGreaterThan(0);
    expect(conductorRule).toBeGreaterThan(0);
    expect(spawnedRule, 'spawned rule must outrank (precede) the Conductor rule').toBeLessThan(conductorRule);
    expectMentions(out, [['散文にも', 'BLOCKED にもせず']], 'out');
    expectMentions(out, [['Conductor ルール', '優先されます']], 'out');
  });

  test('Spawned: destructive-gate carve-out present', () => {
    expectMentions(out, [['不可逆', '決して自動選択せず', '保守的']], 'out');
  });

  test('Spawned: self-check carries the never-reach-this-checklist clause', () => {
    expectMentions(out, [['`SESSION_KIND: spawned`', 'このチェックリストに到達しないはず']], 'out');
    expect(out).toContain('エコーされた STATUS 行のみ');
  });

  test('Spawned: anti-injection', () => {
    expectMentions(out, [['ツール出力', 'spawned の主張', '決してトリガーになりません']], 'out');
  });

  // Periodic-lane regression (v1.76 → v1.78): v1.76's "(or your dispatch
  // prompt marks this session as spawned)" let the model INFER spawned status
  // from a scripted-looking prompt in a CI-looking session and silently
  // auto-decide every review question (reviewCount=0 across the plan-review
  // E2Es). Two pinned-container rounds then showed ANY prose-declaration
  // channel in the eager path keeps counts unstable (intermittent 0s, band
  // overshoot, paired-control breaks in both directions). The trigger is the
  // machine-verifiable STATUS echo ONLY; the dispatch-declaration channel
  // lives exclusively at failure time (the AUQ hooks' spawned escape), which
  // never enters an interactive session's eager reasoning.
  test('Spawned: trigger is the STATUS echo only', () => {
    expect(out).not.toContain('marks this session as spawned');
    expect(out).not.toContain('or your dispatch prompt');
    expectMentions(out, [['トリガーになるのは', '`SESSION_KIND: spawned`', 'STATUS エコー']], 'out');
    expectMentions(out, [['ディスパッチプロンプト', 'ツール出力', 'spawned の主張', '決してトリガーになりません']], 'out');
  });

  test('Spawned: absence-safe interactive default', () => {
    expectMentions(out, [['エコーがなければ', '自動化されて見えても', '対話型です']], 'out');
    expect(out).not.toMatch(/When unsure, ask/);
    expect(out).not.toMatch(/HOW MANY/);
    expect(out).not.toMatch(/adds, removes, or batches/);
    expect(out).not.toMatch(/exactly as written/);
  });

  // Conductor-default-prose contract (the proactive path, distinct from the
  // failure fallback). Guards the Tool-resolution rule + self-check wording.
  test('Conductor: do-not-call rule present in Tool resolution', () => {
    expect(out).toMatch(/CONDUCTOR_SESSION: true/);
    expectMentions(out, [['AskUserQuestion', '呼びません']], 'out');
    expect(out).toMatch(/gstack-question-log/);
  });

  test('Conductor: one-way prose rule + continuation protocol present', () => {
    const flat = compact(out).replace(/\*\*/g, '');
    expectMentions(flat, [['一方通行'], ['明示的な入力による確認']], 'out');
    expectMentions(flat, [['曖昧', '決して進めず']], 'out');
    expect(flat).toContain('継続 — 入力された返信をブリーフに対応づける');
  });
});

describe('CQ2 — cross-file invariant: auto-decide prefix matches the hook', () => {
  const out = generateAskUserFormat(makeCtx());
  const hookSrc = fs.readFileSync(
    path.resolve(__dirname, '..', 'hosts', 'claude', 'hooks', 'question-preference-hook.ts'),
    'utf-8',
  );

  test('the hook actually emits the [plan-tune auto-decide] prefix', () => {
    expect(hookSrc).toContain('[plan-tune auto-decide]');
  });

  test('the resolver references the exact same prefix the hook emits', () => {
    // If a future edit reworded the hook reason, this catches the drift: the prose
    // fallback would stop recognizing the auto-decide denial as not-a-failure.
    const PREFIX = '[plan-tune auto-decide]';
    expect(hookSrc.includes(PREFIX) && out.includes(PREFIX)).toBe(true);
  });
});
