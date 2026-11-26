/**
 * Model overlays: each family's resolved nudges, inheritance and model-ID routing.
 */
import { describe } from 'bun:test';
import { test } from 'bun:test';
import { expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from '../scripts/resolvers/types';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { generateModelOverlay } from '../scripts/resolvers/model-overlay';
import { resolveModel, type Model } from '../scripts/models';
import { CLAUDE_JUDGE_EVAL_MODEL } from '../lib/eval-model';
import { readOverlay } from '../scripts/resolvers/model-overlay';
import { generateCompletenessSection } from '../scripts/resolvers/preamble/generate-completeness-section';
import { generateSetupCommand } from '../scripts/resolvers/utility';
import { expectMentions } from './helpers/prompt-structure';

describe('model-overlay-fable-5', () => {
function makeCtx(model: string): TemplateContext {
  return {
    skillName: 'test-skill',
    tmplPath: 'test.tmpl',
    host: 'claude',
    paths: HOST_PATHS.claude,
    preambleTier: 2,
    model,
  };
}

const ROOT = path.resolve(__dirname, '..');

describe('Fable 5 overlay — family nudges', () => {
  test('raw fable-5.md contains the act-when-ready nudge', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'model-overlays/fable-5.md'), 'utf-8');
    expect(raw).toContain('十分な材料がそろったら、行動する');
  });

  test('resolved overlay inherits from claude base (INHERIT:claude)', () => {
    const out = generateModelOverlay(makeCtx('fable-5'));
    expect(out).toContain('TODO リストの規律');
    expect(out).toContain('従属');
  });

  test('resolved overlay carries the Fable nudges', () => {
    const out = generateModelOverlay(makeCtx('fable-5'));
    expect(out).toContain('十分な材料がそろったら、行動する');
    expect(out).toContain('進捗の主張は証拠に基づかせる');
  });

  test('resolved overlay has no unresolved INHERIT directive', () => {
    const out = generateModelOverlay(makeCtx('fable-5'));
    expect(out).not.toContain('{{INHERIT:');
  });

  test('claude overlay (base) does not carry the Fable nudge', () => {
    const out = generateModelOverlay(makeCtx('claude'));
    expect(out).not.toContain('十分な材料がそろったら、行動する');
  });
});
});

describe('model-overlay-gpt-5.6-sol', () => {
function ctx(model: TemplateContext['model']): TemplateContext {
  return {
    skillName: 'investigate',
    tmplPath: 'investigate/SKILL.md.tmpl',
    host: 'codex',
    paths: {
      skillRoot: '$GSTACK_ROOT',
      localSkillRoot: '.agents/skills/gstack',
      binDir: '$GSTACK_BIN',
      browseDir: '$GSTACK_BROWSE',
      designDir: '$GSTACK_DESIGN',
      makePdfDir: '$GSTACK_MAKE_PDF',
    },
    preambleTier: 3,
    model,
  };
}

describe('GPT-5.6 Sol model profile', () => {
  test('only the exact Sol ID selects the Sol profile', () => {
    expect(resolveModel('gpt-5.6-sol')).toBe('gpt-5.6-sol');
    expect(resolveModel('gpt-5.6-terra')).toBe('gpt');
    expect(resolveModel('gpt-5.6-luna')).toBe('gpt');
    expect(resolveModel('gpt-5.6-sol-preview')).toBe('gpt');
    expect(resolveModel('gpt-5.7')).toBe('gpt');
  });

  test('standalone overlay does not inherit generic GPT completion bias', () => {
    const raw = readOverlay('gpt-5.6-sol');
    expect(raw).toContain('明示されたタスクが境界です');
    expect(raw).toContain('関連する検証を 1 回、クリーンな状態で実行');
    expect(raw).toContain('報告のみ');
    expect(raw).not.toContain('{{INHERIT:gpt}}');
    expect(raw).not.toContain('最善の判断を下して進めて');
  });

  test('wrapper gives scope interpretation precedence but preserves concrete gates', () => {
    const out = generateModelOverlay(ctx('gpt-5.6-sol'));
    expectMentions(out, [
      ['スコープの曖昧さを解消'],
      ['スキルの具体的なワークフロー手順', 'STOP ポイント', '優先'],
      ['このパッチ', '具体的な要件を省略', 'いけません'],
    ], 'overlay');
  });

  // The lake intro moved from a per-model render-time generator into
  // bin/gstack-skill-start's one-time emission layer (token-reduction Phase 2).
  // Sol's scope discipline is carried by the model overlay + completeness
  // section (both still model-conditional and pinned here); the intro itself
  // is a single display-once blurb emitted by the script.
  test('completeness copy stays inside the explicit task boundary', () => {
    const completeness = generateCompletenessSection(ctx('gpt-5.6-sol'));
    expectMentions(completeness, [
      ['ユーザーが明示したタスクの境界の内側'],
      ['報告するにとどめ', '実装はしません'],
      ['10 =', 'スコープ内の関連エッジケースをすべてカバー'],
    ], 'completeness');
  });

  test('generic GPT copy remains unchanged', () => {
    const generic = generateModelOverlay(ctx('gpt'));
    const completeness = generateCompletenessSection(ctx('gpt'));
    expect(generic).toContain('最善の判断を下して進めて');
    expect(completeness).toContain('完全な形に仕上げることがゴール');
  });

  test('terse mode still suppresses the completeness section for Sol', () => {
    // Terse short-circuits before the Sol branch — a check-order flip would
    // ship Sol completeness prose to terse users (a token regression).
    expect(generateCompletenessSection({ ...ctx('gpt-5.6-sol'), explainLevel: 'terse' })).toBe('');
  });
});

describe('SETUP_COMMAND resolver', () => {
  test('claude keeps bare ./setup; every other host reinstalls itself', () => {
    expect(generateSetupCommand({ ...ctx('claude'), host: 'claude' })).toBe('./setup');
    expect(generateSetupCommand({ ...ctx('gpt'), host: 'codex' })).toBe('./setup --host codex');
    expect(generateSetupCommand({ ...ctx('claude'), host: 'kiro' })).toBe('./setup --host kiro');
    expect(generateSetupCommand({ ...ctx('claude'), host: 'factory' })).toBe('./setup --host factory');
  });
});
});

describe('model-overlay-gpt-6-astra', () => {
function ctx(model: TemplateContext['model']): TemplateContext {
  return {
    skillName: 'investigate',
    tmplPath: 'investigate/SKILL.md.tmpl',
    host: 'codex',
    paths: {
      skillRoot: '$GSTACK_ROOT',
      localSkillRoot: '.agents/skills/gstack',
      binDir: '$GSTACK_BIN',
      browseDir: '$GSTACK_BROWSE',
      designDir: '$GSTACK_DESIGN',
      makePdfDir: '$GSTACK_MAKE_PDF',
    },
    preambleTier: 3,
    model,
  };
}

describe('GPT-6 Astra model profile', () => {
  test('exact and suffixed Astra IDs select the Astra profile', () => {
    expect(resolveModel('gpt-6-astra')).toBe('gpt-6-astra');
    expect(resolveModel('gpt-6-astra-2026-09-01')).toBe('gpt-6-astra');
  });

  test('overlay inherits generic GPT guidance', () => {
    const raw = fs.readFileSync(path.resolve(import.meta.dir, '..', 'model-overlays/gpt-6-astra.md'), 'utf-8');
    expect(raw).toContain('{{INHERIT:gpt}}');

    const out = generateModelOverlay(ctx('gpt-6-astra'));
    expect(out).toContain('最善の判断を下して進めて');
    expect(out).toContain('スコープが明確になったら、迷わず実行することを優先');
    expect(out).not.toContain('{{INHERIT:');
  });
});
});

describe('model-overlay-opus-4-7', () => {
function makeCtx(model: string): TemplateContext {
  return {
    skillName: 'test-skill',
    tmplPath: 'test.tmpl',
    host: 'claude',
    paths: HOST_PATHS.claude,
    preambleTier: 2,
    model,
  };
}

const ROOT = path.resolve(__dirname, '..');

describe('Opus 4.7 overlay — pacing directive', () => {
  test('raw opus-4-7.md contains "Pace questions to the skill"', () => {
    const raw = fs.readFileSync(
      path.join(ROOT, 'model-overlays/opus-4-7.md'),
      'utf-8',
    );
    expect(raw).toContain('質問はスキルの指示に合わせて行います');
  });

  test('raw opus-4-7.md does NOT contain "Batch your questions" directive', () => {
    const raw = fs.readFileSync(
      path.join(ROOT, 'model-overlays/opus-4-7.md'),
      'utf-8',
    );
    expect(raw).not.toContain('**Batch your questions.**');
  });

  test('resolved overlay output contains "Pace questions to the skill"', () => {
    const out = generateModelOverlay(makeCtx('opus-4-7'));
    expect(out).toContain('質問はスキルの指示に合わせて行います');
  });

  test('resolved overlay inherits from claude base (INHERIT:claude)', () => {
    const out = generateModelOverlay(makeCtx('opus-4-7'));
    // The claude base contributes the subordination wrapper + Todo discipline
    expect(out).toContain('TODO リストの規律');
    expect(out).toContain('従属');
  });

  test('resolved overlay says skill STOP directives trigger one-per-turn pacing', () => {
    const out = generateModelOverlay(makeCtx('opus-4-7'));
    expect(out).toMatch(/STOP\. AskUserQuestion/);
    expectMentions(out, [['AskUserQuestion`', '含まれている場合', '1 ターンに 1 つの質問']], 'overlay');
  });

  test('resolved overlay requires AskUserQuestion as tool_use', () => {
    const out = generateModelOverlay(makeCtx('opus-4-7'));
    expect(out).toContain('tool_use');
  });

  test('resolved overlay flags "obvious fix" findings still need user approval', () => {
    const out = generateModelOverlay(makeCtx('opus-4-7'));
    expectMentions(out, [['明白な修正', 'ユーザーの承認']], 'overlay');
  });

  test('resolved overlay keeps Effort-match / Literal interpretation nudges', () => {
    const out = generateModelOverlay(makeCtx('opus-4-7'));
    expect(out).toContain('作業の手順に工数を合わせます');
    expect(out).toContain('指示は文字どおりに解釈します');
  });

  test('claude overlay (no INHERIT chain) does not carry the pacing directive', () => {
    // Claude is the default overlay; opus-4-7 inherits FROM claude.
    // The pacing directive belongs to opus-4-7 only.
    const out = generateModelOverlay(makeCtx('claude'));
    expect(out).not.toContain('質問はスキルの指示に合わせて行います');
  });
});
});

describe('model-overlay-opus-4-8', () => {
function makeCtx(model: string): TemplateContext {
  return {
    skillName: 'test-skill',
    tmplPath: 'test.tmpl',
    host: 'claude',
    paths: HOST_PATHS.claude,
    preambleTier: 2,
    model,
  };
}

const ROOT = path.resolve(__dirname, '..');

describe('Opus 4.8 overlay — pacing directive', () => {
  test('raw opus-4-8.md contains "Pace questions to the skill"', () => {
    const raw = fs.readFileSync(
      path.join(ROOT, 'model-overlays/opus-4-8.md'),
      'utf-8',
    );
    expect(raw).toContain('質問はスキルの指示に合わせて行います');
  });

  test('raw opus-4-8.md does NOT contain "Batch your questions" directive', () => {
    const raw = fs.readFileSync(
      path.join(ROOT, 'model-overlays/opus-4-8.md'),
      'utf-8',
    );
    expect(raw).not.toContain('**Batch your questions.**');
  });

  test('resolved overlay output contains "Pace questions to the skill"', () => {
    const out = generateModelOverlay(makeCtx('opus-4-8'));
    expect(out).toContain('質問はスキルの指示に合わせて行います');
  });

  test('resolved overlay inherits from claude base (INHERIT:claude)', () => {
    const out = generateModelOverlay(makeCtx('opus-4-8'));
    // The claude base contributes the subordination wrapper + Todo discipline
    expect(out).toContain('TODO リストの規律');
    expect(out).toContain('従属');
  });

  test('resolved overlay says skill STOP directives trigger one-per-turn pacing', () => {
    const out = generateModelOverlay(makeCtx('opus-4-8'));
    expect(out).toMatch(/STOP\. AskUserQuestion/);
    expectMentions(out, [['AskUserQuestion`', '含まれている場合', '1 ターンに 1 つの質問']], 'overlay');
  });

  test('resolved overlay requires AskUserQuestion as tool_use', () => {
    const out = generateModelOverlay(makeCtx('opus-4-8'));
    expect(out).toContain('tool_use');
  });

  test('resolved overlay flags "obvious fix" findings still need user approval', () => {
    const out = generateModelOverlay(makeCtx('opus-4-8'));
    expectMentions(out, [['明白な修正', 'ユーザーの承認']], 'overlay');
  });

  test('resolved overlay keeps Effort-match / Literal interpretation nudges', () => {
    const out = generateModelOverlay(makeCtx('opus-4-8'));
    expect(out).toContain('作業の手順に工数を合わせます');
    expect(out).toContain('指示は文字どおりに解釈します');
  });

  test('claude overlay (no INHERIT chain) does not carry the pacing directive', () => {
    // Claude is the default overlay; opus-4-8 inherits FROM claude.
    // The pacing directive belongs to the opus-4-x overlays only.
    const out = generateModelOverlay(makeCtx('claude'));
    expect(out).not.toContain('質問はスキルの指示に合わせて行います');
  });
});
});

describe('model-overlay-sonnet-5', () => {
function makeCtx(model: string): TemplateContext {
  return {
    skillName: 'test-skill',
    tmplPath: 'test.tmpl',
    host: 'claude',
    paths: HOST_PATHS.claude,
    preambleTier: 2,
    model,
  };
}

const ROOT = path.resolve(__dirname, '..');

describe('Sonnet 5 overlay — family nudges', () => {
  test('raw sonnet-5.md contains the literal-instructions nudge', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'model-overlays/sonnet-5.md'), 'utf-8');
    expect(raw).toContain('指示は文字どおりに読まれます');
  });

  test('resolved overlay inherits from claude base (INHERIT:claude)', () => {
    const out = generateModelOverlay(makeCtx('sonnet-5'));
    expect(out).toContain('TODO リストの規律');
    expect(out).toContain('従属');
  });

  test('resolved overlay carries the Sonnet 5 nudges', () => {
    const out = generateModelOverlay(makeCtx('sonnet-5'));
    expect(out).toContain('指示は文字どおりに読まれます');
    expect(out).toContain('作業は依頼の範囲に合わせます');
  });

  test('resolved overlay has no unresolved INHERIT directive', () => {
    const out = generateModelOverlay(makeCtx('sonnet-5'));
    expect(out).not.toContain('{{INHERIT:');
  });

  test('claude overlay (base) does not carry the Sonnet 5 nudge', () => {
    const out = generateModelOverlay(makeCtx('claude'));
    expect(out).not.toContain('指示は文字どおりに読まれます');
  });
});
});

describe('model-routing-claude', () => {
  test.each([
    ['claude-opus-4-7', 'opus-4-7'],
    ['claude-opus-4-7-20260416', 'opus-4-7'],
    ['claude-opus-4-7-latest', 'opus-4-7'],
    ['claude-opus-4-7-1', 'claude'],
    ['claude-opus-4-7-1-20260601', 'claude'],
    ['claude-opus-4-8', 'opus-4-8'],
    ['claude-opus-4-8-20260701', 'opus-4-8'],
    ['claude-opus-4-8-latest', 'opus-4-8'],
    ['claude-opus-4-8-1', 'claude'],
    ['claude-sonnet-5', 'sonnet-5'],
    ['claude-sonnet-5-20260115', 'sonnet-5'],
    ['claude-sonnet-5-latest', 'sonnet-5'],
    ['claude-sonnet-5-5', 'claude'],
    ['claude-sonnet-5-5-20261001', 'claude'],
    ['claude-sonnet-5-10', 'claude'],
    ['claude-sonnet-5-latest-20260101', 'claude'],
    ['claude-opus-5-5', 'claude'],
    ['claude-fable-5', 'fable-5'],
    ['claude-fable-5-1', 'fable-5'],
  ] as Array<[string, Model]>)('%s routes to %s', (input, expected) => {
    expect(resolveModel(input)).toBe(expected);
  });

  test('input is lowercased and one trailing [...] marker is stripped', () => {
    expect(resolveModel('CLAUDE-SONNET-5')).toBe('sonnet-5');
    expect(resolveModel('claude-sonnet-5[1m]')).toBe('sonnet-5');
    expect(resolveModel('claude-opus-5-5[1m]')).toBe('claude');
  });

  test('family names force the pinned profile', () => {
    expect(resolveModel('opus-4-7')).toBe('opus-4-7');
    expect(resolveModel('opus-4-8')).toBe('opus-4-8');
    expect(resolveModel('sonnet-5')).toBe('sonnet-5');
  });

  test('Fable prefix exception holds only while the judge eval model is a Fable 5 point release', () => {
    if (resolveModel('claude-fable-5-99') === 'fable-5') {
      expect(CLAUDE_JUDGE_EVAL_MODEL.startsWith('claude-fable-5-')).toBe(true);
    }
  });
});
