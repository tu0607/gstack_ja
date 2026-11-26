import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readWorkflowJudgeInput } from './helpers/workflow-judge-input';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const root = resolve(import.meta.dir, '..');
const compact = (text: string) => text.replace(/\s+/g, ' ').trim();
const sources = [
  {
    label: 'templates',
    main: readFileSync(resolve(root, 'plan-ceo-review/SKILL.md.tmpl'), 'utf8'),
    section: readFileSync(resolve(root, 'plan-ceo-review/sections/review-sections.md.tmpl'), 'utf8'),
  },
  {
    label: 'actual judge bundle',
    ...(() => {
      const input = readWorkflowJudgeInput({
        root,
        skillPath: 'plan-ceo-review/SKILL.md',
        startMarker: '## ステップ 0: スコープへの大胆な挑戦',
        endMarker: '## Review Sections',
      });
      return {
        main: input.files.find(file => file.kind === 'entrypoint')!.content,
        section: input.files.find(file => file.path === 'plan-ceo-review/sections/review-sections.md')!.content,
      };
    })(),
  },
];

const ordered = (text: string, anchors: string[]) => {
  const positions = anchors.map(anchor => text.indexOf(anchor));
  expect(positions.every(position => position >= 0), `missing one of ${JSON.stringify(anchors)}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
};

for (const source of sources) describe(`CEO clarity routing — ${source.label}`, () => {
  const main = compact(source.main);
  const section = compact(source.section);
  const decisions = main.split('### 0D.')[1]!.split('### 0E.')[0]!;
  const mode = main.split('### 0E.')[1]!.split('### 0F.')[0]!;

  test('decision statuses keep pending work unapproved and settle only on exact authority', () => {
    ordered(main, ['**必要な選択:**', '**保留:**', '**確定:**']);
    expect(main).toMatch(/\*\*保留:\*\* 未承認/);
    expect(main).toMatch(/\*\*確定:\*\*[^*]*推奨は確定ではありません/);
  });

  test('admin menus return locally while plan decisions run the full approval cycle', () => {
    ordered(decisions, ['**管理上の質問:**', '**プランの判断:**', '**1. 情報源と過去の回答を確認する', '**2. 保留中の選択を記録する。**', '**3. その行の選択肢を比較して保存する', '**質問前のチェックポイント:**', '**4. 質問し、回答を記録し、修正する', '**回答後のチェックポイント:**']);
    expectMentions(decisions, [['プランの変更', '承認しません']], 'decisions');
    expectMentions(decisions, [['モード選択ではなく', '呼び出し元に戻']], 'decisions');
    expectMentions(decisions.split('**4. 質問し')[1]!.split('**回答後のチェックポイント:**')[0], [['実際の回答', '停止']], 'section');
  });

  test('a mode change waits for an answer and selecting a mode approves nothing', () => {
    const change = mode.split('**モードの変更:**')[1]!.split('モードを選んでも')[0]!;
    expectMentions(change, [['一時停止', '尋ね'], ['回答', 'モードは維持']], 'change');
    expectMentions(mode, [['モードを選んでも', '承認されません']], 'mode');
    expect(mode).toContain('| SCOPE EXPANSION / SELECTIVE EXPANSION | 0F → 0G → 0H(スペックレビューのループを含む) → 0I |');
    expect(mode).toContain('| HOLD SCOPE | 0G → 0I |');
    expect(mode).toContain('| SCOPE REDUCTION | 0G |');
  });

  test('scope limits and mode recommendations keep their numeric thresholds and route order', () => {
    expect(main).toMatch(/変更されていない再利用を除く/);
    expect(main).toMatch(/どちらの数も変更を承認しません/);
    ordered(mode, ['計画された変更ファイルが 15 を超える場合', 'カテゴリが重なっている、または不明確な場合', 'それ以外: 新規の製品やシステム']);
    expect(mode).toMatch(/15 を超える場合は、SCOPE REDUCTION を推奨/);
  });

  test('coverage scoring keeps its scale and the completion fraction keeps its format', () => {
    expect(decisions).toContain('**作業は同じだが、カバレッジが違う:**');
    expect(decisions).toContain('10 = すべてのエッジケース、7 = 正常系、3 = 近道');
    expectMentions(decisions, [['承認のチェックポイント', '免除しません']], 'decisions');
    expectMentions(section, [['再度開いた選択', '一度だけ']], 'section');
    expectTokens(section, ['X/Y を報告', '`N/A`'], 'section');
    expectMentions(section, [['Y がゼロ', '`N/A`']], 'section');
  });

  test('section findings check reopening evidence before reusing prior answers', () => {
    const gate = section.split('**解決。**')[1]!.split('**適用。**')[0]!;
    ordered(gate, ['1. このセクションで新しい選択が必要な場合', '2. 正確な以前の回答がそれをカバーしている場合', '3. ブロックしない選択が後のセクションに属する場合']);
    expectMentions(gate, [['モードを再び選ぶ', 'ありません']], 'gate');
    const sections = source.section.match(/^### セクション \d+:/gm)!.length;
    expect(sections).toBeGreaterThan(0);
    expect(source.section.match(/\*\*判断ゲート。\*\*/g)).toHaveLength(sections);
  });

  test('Section 1 publishes current dispositions, not a second initial mode handoff', () => {
    const opening = section.split('### セクション 1: アーキテクチャのレビュー')[1]!.split('評価し、図にしてください:')[0]!;
    expect(opening).toContain('**Current scope**');
    expectMentions(opening, [['モードの引き継ぎ', '再び', 'ではありません']], 'opening');
  });
});
