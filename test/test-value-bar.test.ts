/**
 * The test value bar ships in every prompt that proposes, writes, reviews or
 * sweeps tests. These checks prove the prompts carry the contract; the paid
 * cases in test/skill-e2e-test-value.test.ts carry the behavior claim.
 */
import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { generateTestCoverageAuditInner } from '../scripts/resolvers/testing';
import {
  CALLER_SEARCH_COMMAND, CALLER_SYMBOL_PATTERN, CARD_FIELD_MAX_BYTES, CATALOG, MESSAGES, PRAGMA, QUESTIONS, REASON_CODES,
  RETENTION_ONE_LINER, RETIREMENT_FIELDS, REVIEW_EVIDENCE_FIELDS, SWEEP_POINTER, TEST_VALUE_BAR_MAX_BYTES, TEST_VALUE_BAR_MODES,
  NO_CLAIM_EXAMPLES, VALUE_CARD_FIELDS, VALUE_CARD_OPTIONAL_FIELD,
  WEAK_REASONS, clampCardField, generateTestValueBar, renderValueCard, type TestValueBarMode,
} from '../scripts/resolvers/test-value';
import { recordsNonTestCallerSearch } from './helpers/test-value-fixture';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const FIX = 'Fix: bun run gen:skill-docs && bun test test/test-value-bar.test.ts';
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const ctx = { skillName: 'ship', tmplPath: '', host: 'claude', paths: HOST_PATHS.claude } as TemplateContext;
const bar = (mode: TestValueBarMode) => generateTestValueBar(ctx, [mode]);

const CARD_FORMAT = 'Value: protects=<...>; fails_when=<...>; why_new=<...>; seam=none; no_claim=<...>';
const NO_CLAIM_EXAMPLE_TOKENS = NO_CLAIM_EXAMPLES.map(example => `no_claim=${example}`);
const shipSection = read('ship/sections/test-coverage.md');
const shipGate = generateTestCoverageAuditInner(ctx, 'ship', 'gate');

// required = 機械が読むトークン(構造、フィールド名、コード、コマンド、JSON の形)。
// mentions = 1 文の中で同時に現れるべき語(大文字小文字を区別しない)。日本語の文は丸ごとピン留めしない。
type Contract = { render: string; required: string[]; mentions?: string[][]; absent?: string[] };
const CARD_MENTIONS = [[String(CARD_FIELD_MAX_BYTES), 'UTF-8', '157'], ['JSON', '完全な値'], ['上流', 'カード', '止めない']];
const CONTRACT: Record<TestValueBarMode, Contract> = {
  plan: {
    render: generateTestCoverageAuditInner(ctx, 'plan'),
    required: [
      ...QUESTIONS, CARD_FORMAT, 'X = ★★/★★★', 'Y = ', RETENTION_ONE_LINER,
      '## Tests to Retire', 'Value: protects={...}; fails_when={...}; why_new={...}; seam=none; no_claim={...}', ...NO_CLAIM_EXAMPLE_TOKENS,
    ],
    mentions: [
      ...CARD_MENTIONS,
      ['カバレッジの目標'], ['テストの数', '目標'],
      ['X =', '★★/★★★', '全パス'], ['Y =', '全パス'],
      ['ゴールデン', 'プロンプトのバイト列', 'ワイヤーフォーマット'],
      ['Edge Case', 'Critical Path', 'バリューカード'],
      ['不要になるテスト', '列挙'],
    ],
    absent: ['100% coverage is the goal', 'Step 4.75'],
  },
  ship: {
    render: shipSection,
    required: [
      ...QUESTIONS, CARD_FORMAT,
      `\`weak_gaps\`(理由 \`${WEAK_REASONS.join('|')}\`)`, RETENTION_ONE_LINER,
      'extended > added > rejected', REASON_CODES.join(', '),
      '"coverage_pct":N,"gaps":N,"diagram":"<full markdown coverage diagram for PR body>","tests_added":["path",...],"coverage_pct_value":N,"weak_gaps":[',
      '`incomplete_card`', '`duplicate_protects`', '`needs_seam`',
      ...NO_CLAIM_EXAMPLE_TOKENS,
      'Regression proof — fails at HEAD: yes · passes at base: yes | unavailable (<reason>) | manual · passes after fix: yes | pending',
      'base control unavailable: collection error', 'N of M regression tests got base control', 'worktree add --quiet --detach',
      'trap cleanup EXIT INT TERM', 'timeout 30 git -C "$ROOT" fetch',
      "find \"${TMPDIR:-/tmp}\" -maxdepth 1 -name 'gstack-base-control.*'",
      'K = `tests_added.length`', 'R = `tests_rejected.length`', 'E = `tests_extended.length`', 'W = `weak_gaps.length`',
      'C) これらのパスにテストは不要', SWEEP_POINTER,
    ],
    mentions: [
      ...CARD_MENTIONS,
      ['カバレッジの目標'], ['テストの数', '目標'],
      ['0 件', 'ゲートをスキップ'],
      ['5 テスト', '生成パス'], ['拡張', '1 スロット', '却下'], ['30 個'], ['2 分', '上限'],
      ['4 つのフィールド', 'no_claim', '空でない'], ['4 フィールド', '有効'],
      ['tests_rejected', '新規ファイル', '残してはいけません'],
      ['読み取り専用', 'Agent', 'ディスパッチ'], ['生成のパス', '消費しません'],
      ['3 分以内', '/ship'],
      ['ゲート', '尋ねるだけ', 'ハードフェイル'],
      ['生成スロットの残り'], ['A)', '残りのギャップ', '提案テスト', 'PR 本文'],
      ['真の `gaps`', '限定'], ['弱いパス', '編集してはいけません'],
    ],
    absent: ['100% coverage is the goal', '20 tests generated max', '30-path/20-test'],
  },
  qa: {
    render: bar('qa'),
    required: [QUESTIONS[2], QUESTIONS[3], CARD_FORMAT],
    mentions: [['上流', 'カード', '止めない']],
    absent: [QUESTIONS[0], QUESTIONS[1]],
  },
  audit: {
    render: bar('audit'),
    required: [...QUESTIONS, ...CATALOG, RETIREMENT_FIELDS.map(field => `\`${field}\``).join(', '), CALLER_SEARCH_COMMAND, CALLER_SYMBOL_PATTERN,
      'caller check unavailable: unsupported symbol', PRAGMA],
    mentions: [['grep のみ'], ['typecheck/build', 'デッドコード'], ['エントリポイント', '決して引退させない']],
  },
};

describe('test value bar render contract', () => {
  for (const mode of TEST_VALUE_BAR_MODES) test(`${mode}: required contract strings and byte ceiling`, () => {
    const { render, required, mentions = [], absent = [] } = CONTRACT[mode];
    const missing = required.filter(text => !render.includes(text));
    expect(missing, `${mode} render lacks contract text. ${FIX}`).toEqual([]);
    expectMentions(render, mentions, `${mode} render`);
    expect(absent.filter(text => render.includes(text)), `${mode} render keeps retired text. ${FIX}`).toEqual([]);
    const rendered = bar(mode);
    expect(rendered.includes('例: Value: protects=') && rendered.includes('Rejected (covered_elsewhere)'), `${mode} needs one good card and one rejected proposal`).toBe(true);
    expect(Buffer.byteLength(rendered, 'utf8')).toBeLessThanOrEqual(TEST_VALUE_BAR_MAX_BYTES[mode]);
  });

  test('the card clamp applies to card lines only; written JSON keeps full values (C2)', () => {
    for (const mode of TEST_VALUE_BAR_MODES) {
      expectMentions(bar(mode), [[String(CARD_FIELD_MAX_BYTES), 'UTF-8', '157', '`...`'], ['JSON', '完全な値']], `${mode} bar`);
    }
  });

  test('qa mode names only the invoking skill\'s card location (/qa-only has no 8e.5 record)', () => {
    const forSkill = (skillName: string) => generateTestValueBar({ ...ctx, skillName }, ['qa']);
    expect(forSkill('qa')).toContain('8e.5');
    expect(forSkill('qa')).not.toContain('提案する各テスト');
    expect(forSkill('qa-only')).toContain('提案する各テスト');
    expect(forSkill('qa-only')).not.toContain('8e.5');
  });

  test('plan and ship coverage audits render the bar at their call site', () => {
    for (const mode of ['plan', 'ship'] as const) expect(generateTestCoverageAuditInner(ctx, mode)).toContain(bar(mode));
  });

  test('an unknown mode and an over-budget render fail generation with actionable text', () => {
    expect(() => generateTestValueBar(ctx, ['foo'])).toThrow('Unknown TEST_VALUE_BAR mode foo; expected plan|ship|qa|audit');
    expect(() => generateTestValueBar(ctx, ['foo'])).toThrow('scripts/resolvers/test-value.ts');
    const saved = TEST_VALUE_BAR_MAX_BYTES.qa;
    try {
      TEST_VALUE_BAR_MAX_BYTES.qa = 10;
      expect(() => bar('qa')).toThrow(/^TEST_VALUE_BAR mode 'qa' renders \d+ bytes, budget 10 \(over by \d+\)\. Trim the mode's section in scripts\/resolvers\/test-value\.ts or raise the ceiling with a reason\.$/);
    } finally {
      TEST_VALUE_BAR_MAX_BYTES.qa = saved;
    }
  });

  test('card fields clamp by UTF-8 bytes without splitting a character', () => {
    const long = '€'.repeat(100);
    const clamped = clampCardField(long);
    expect(Buffer.byteLength(clamped, 'utf8')).toBeLessThanOrEqual(CARD_FIELD_MAX_BYTES);
    expect(clamped.endsWith('...')).toBe(true);
    expect(clamped).not.toContain('\uFFFD');
    expect(clampCardField('short')).toBe('short');
    expect(renderValueCard({ protects: long, fails_when: 'x', why_new: 'y', seam: 'none' })).toStartWith(`Value: protects=${clamped}; fails_when=x;`);
  });

  test('no_claim is an optional fifth field: rendered last when present, absent from a four-field card (W5)', () => {
    expect(VALUE_CARD_FIELDS).toEqual(['protects', 'fails_when', 'why_new', 'seam']);
    expect(VALUE_CARD_OPTIONAL_FIELD).toBe('no_claim');
    const four = renderValueCard({ protects: 'a', fails_when: 'b', why_new: 'c', seam: 'none' });
    expect(four).toBe('Value: protects=a; fails_when=b; why_new=c; seam=none');
    const five = renderValueCard({ protects: 'a', fails_when: 'b', why_new: 'c', seam: 'none', no_claim: NO_CLAIM_EXAMPLES[1] });
    expect(five).toBe(`${four}; no_claim=${NO_CLAIM_EXAMPLES[1]}`);
    expect(renderValueCard({ protects: 'a', fails_when: 'b', why_new: 'c', seam: 'none', no_claim: '€'.repeat(100) })).toEndWith('...');
    for (const mode of TEST_VALUE_BAR_MODES) {
      const rendered = bar(mode);
      expect(rendered, `${mode} lacks both no_claim examples`).toContain(`no_claim=${NO_CLAIM_EXAMPLES[0]}`);
      expect(rendered).toContain(`no_claim=${NO_CLAIM_EXAMPLES[1]}`);
      expectMentions(rendered, [['ライブ確認', '免除'], ['no_claim', '1 文']], `${mode} bar`);
    }
  });
});

describe('ship parent decision rules', () => {
  const rows = Object.fromEntries(shipGate.split('\n').filter(line => line.startsWith('| ') && !line.startsWith('| Step 7') && !line.startsWith('|---'))
    .map(line => line.split(' | ')).map(cells => [cells[0]!.slice(2), cells.slice(1).join(' | ')]));
  for (const [condition, uses, message] of [
    ['評価のディスパッチが失敗またはタイムアウト', 'ゲートをスキップ', MESSAGES.ratingUnavailable.message],
    ['パスがゼロ、テストのみの diff', 'ゲートをスキップ', 'could not determine percentage'],
    ['`Star rating: off`', '`coverage_pct`', 'weak paths still listed'],
    ['`coverage_pct_value` が欠落', '`coverage_pct`', MESSAGES.valueCoverageUnavailable.message],
    ['`coverage_pct_value` > `coverage_pct`', '`coverage_pct`(上限に丸める)', MESSAGES.inconsistentCoverage.message],
    ['それ以外', '`coverage_pct_value`', ''],
  ] as const) test(`${condition} -> ${uses}`, () => {
    const row = Object.entries(rows).find(([key]) => key.startsWith(condition));
    expect(row, `gate table lacks the row "${condition}"`).toBeDefined();
    expect(row![1]).toStartWith(uses);
    expect(row![1]).toContain(message);
  });

  test('gate never substitutes 0 and parent processing tolerates old or malformed output', () => {
    expectMentions(shipGate, [['0', '代用']], 'ship gate');
    expectMentions(shipSection, [['新しいキー', '空として']], 'ship parent processing');
    expect(shipSection).toContain(MESSAGES.malformedKey.message);
    expect(shipSection).toContain(MESSAGES.allRejected.message);
  });

  test('the rejection step removes new rejected files and reports tracked ones for a hunk revert', () => {
    const start = shipSection.indexOf('   REJECTED_FILE="$(git rev-parse');
    const end = shipSection.indexOf('   rm -f "$REJECTED_FILE"\n', start) + '   rm -f "$REJECTED_FILE"\n'.length;
    const block = shipSection.slice(start, end).split('\n').map(line => line.replace(/^ {3}/, '')).join('\n');
    expect(block).toContain('<rejected-file-name>');
    expect(block).toContain('done < "$REJECTED_FILE"');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-value-rejected-'));
    try {
      const git = (...args: string[]) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10_000 });
      git('init', '-q');
      fs.mkdirSync(path.join(dir, 'test'));
      fs.writeFileSync(path.join(dir, 'test/kept.test.ts'), 'test("a", () => {});\n');
      git('add', '.');
      git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'seed');
      fs.appendFileSync(path.join(dir, 'test/kept.test.ts'), 'test("dup", () => {});\n');
      fs.writeFileSync(path.join(dir, 'test/new dup.test.ts'), 'test("dup", () => {});\n');
      fs.mkdirSync(path.join(dir, '.gstack/tmp'), { recursive: true });
      const list = path.join(dir, '.gstack/tmp/rejected-tests.abc123');
      fs.writeFileSync(list, 'test/new dup.test.ts\ntest/kept.test.ts\n../outside.test.ts\n');
      const script = block.replace('<rejected-file-name>', 'rejected-tests.abc123');
      const run = spawnSync('bash', ['-c', script], { cwd: dir, encoding: 'utf8', timeout: 10_000 });
      expect(run.status).toBe(0);
      expect(run.stdout).toContain('REMOVED: test/new dup.test.ts');
      expect(run.stdout).toContain('REVERT_HUNK: test/kept.test.ts');
      expect(run.stdout).toContain('SKIPPED (outside repo): ../outside.test.ts');
      expect(fs.existsSync(path.join(dir, 'test/new dup.test.ts'))).toBe(false);
      expect(fs.existsSync(path.join(dir, 'test/kept.test.ts'))).toBe(true);
      expect(fs.existsSync(list)).toBe(false);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('PR body and Step 20 carry the value line, both numbers and the metrics', () => {
    const prBody = read('ship/sections/pr-body.md');
    expect(prBody).toContain('Coverage: {X}% value-weighted ({Y}% including {W} weakly covered paths)');
    expect(prBody).toContain('Test value: {K} tests written, {R} rejected by the authoring gate, {E} existing tests extended, {W} paths weakly covered (weak = ★, gate-failing or unrated).');
    expect(prBody).toContain('"1 test written", "1 existing test extended", "1 path weakly covered"');
    const ship = read('ship/SKILL.md');
    expect(ship).toContain('"coverage_pct":COVERAGE_PCT,"coverage_schema":2,"coverage_pct_value":COVERAGE_PCT_VALUE,"weak_gaps":WEAK_GAPS,"tests_extended":TESTS_EXTENDED,"tests_rejected":TESTS_REJECTED,"regression_proof":REGRESSION_PROOF');
  });
});

describe('static review specialist stays in sync', () => {
  const specialist = read('review/specialists/testing.md');
  test('questions, catalog, evidence fields, codes, pragma and caller search', () => {
    const expected = [...QUESTIONS, ...CATALOG, ...REVIEW_EVIDENCE_FIELDS.map(field => `\`${field}\``), RETIREMENT_FIELDS.join(', '),
      ...REASON_CODES.map(code => `\`${code}\``), `${PRAGMA} reason="<why>"`, CALLER_SEARCH_COMMAND, CALLER_SYMBOL_PATTERN, SWEEP_POINTER,
      '`no_claim=...`',
      `test-value-bar.md#${MESSAGES.callerCheckUnavailable.anchor}`];
    const flat = specialist.replace(/\n/g, ' ').replace(/ +/g, ' ');
    expect(expected.filter(text => !flat.includes(text.replace(/\n/g, ' '))), `review/specialists/testing.md is out of sync with scripts/resolvers/test-value.ts`).toEqual([]);
    expectMentions(specialist, [['自動削除', '決してしない'], ['既存の重大度', 'カバレッジのギャップ'], ['INFORMATIONAL', '1 行'], ['赤い証明', '回帰テスト']], 'review/specialists/testing.md');
  });
});

describe('template contracts', () => {
  test('consumers use their mode placeholder and both plan reviews state one contract', () => {
    expect(read('qa/SKILL.md.tmpl')).toContain('{{TEST_VALUE_BAR:qa}}');
    expect(read('qa-only/SKILL.md.tmpl')).toContain('{{TEST_VALUE_BAR:qa}}');
    expect(read('test-audit/SKILL.md.tmpl')).toContain('{{TEST_VALUE_BAR:audit}}');
    for (const skill of ['qa', 'qa-only']) expect(read(`${skill}/SKILL.md`), `${skill} lacks the rendered bar. ${FIX}`).toContain(generateTestValueBar({ ...ctx, skillName: skill }, ['qa']));
    expect(read('test-audit/SKILL.md')).toContain(bar('audit'));
    const templates = spawnSync('git', ['ls-files', '*.tmpl'], { cwd: ROOT, encoding: 'utf8', timeout: 10_000 }).stdout.split('\n').filter(Boolean);
    expect(templates.filter(file => read(file).includes('prefer too many to too few'))).toEqual([]);
    expectMentions(read('plan-ceo-review/SKILL.md.tmpl'), [['すべての振る舞い'], ['回帰', 'テスト', '書']], 'plan-ceo-review tests rule');
    expectMentions(read('plan-eng-review/SKILL.md.tmpl'), [['すべての振る舞い'], ['回帰', 'テスト', '書']], 'plan-eng-review tests rule');
  });

  test('/test-audit is hard report-only when spawned', () => {
    const audit = read('test-audit/SKILL.md.tmpl').replace(/\s+/g, ' ');
    expectTokens(audit, ['`SESSION_KIND: spawned`', '`headless`', 'C) 停止', 'A) このバッチを承認 B) スキップ C) 停止']);
    expectMentions(audit, [['spawned', 'headless', '報告のみ'], ['質問', '編集'], ['すべてのバッチ', 'C) 停止']], 'test-audit spawned rule');
  });

  test('the caller search keeps production resolvers and excludes tests', () => {
    const command = CALLER_SEARCH_COMMAND.replace('<symbol>', 'generateTestValueBar');
    const run = spawnSync('bash', ['-c', command], { cwd: ROOT, encoding: 'utf8', timeout: 30_000 });
    expect(run.status).toBe(0);
    const files = [...new Set(run.stdout.split('\n').filter(Boolean).map(line => line.split(':')[0]))];
    expect(files).toContain('scripts/resolvers/testing.ts');
    expect(files.filter(file => file!.startsWith('test/'))).toEqual([]);
  });
});

describe('docs and registration', () => {
  const docs = read('docs/test-value-bar.md');
  test('every degraded-mode message has a docs anchor and every rendered pointer resolves', () => {
    const anchors = new Set([...docs.matchAll(/^### ([a-z0-9-]+)$/gm)].map(match => match[1]));
    expect(Object.values(MESSAGES).map(({ anchor }) => anchor).filter(anchor => !anchors.has(anchor))).toEqual([]);
    const rendered = [shipSection, read('review/specialists/testing.md')].join('\n');
    const pointers = [...rendered.matchAll(/test-value-bar\.md#([a-z0-9-]+)/g)].map(match => match[1]);
    expect(pointers.length).toBeGreaterThan(5);
    expect(pointers.filter(anchor => !anchors.has(anchor!))).toEqual([]);
  });

  test('/test-audit appears in every registration list', () => {
    const lists: [string, string][] = [
      ['AGENTS.md', '| `/test-audit` |'],
      ['docs/skills.md', '| [`/test-audit`](#test-audit) |'],
      ['docs/skills.md', '## `/test-audit`'],
      ['gstack/llms.txt', '[/test-audit](test-audit/SKILL.md)'],
      ['SKILL.md.tmpl', '`/test-audit` を呼び出す'],
      ['docs/PROJECT_STRUCTURE.md', 'test-audit/'],
      ['test/fixtures/context-budget.json', '"test-audit":'],
      ['test/helpers/touchfiles-data.ts', "'test-audit-report-only': ['test-audit/**'"],
    ];
    expect(lists.filter(([file, text]) => !read(file).includes(text)).map(([file, text]) => `${file}: ${text}`)).toEqual([]);
    expect(read('README.md').split('/deslop-shared-libs, /test-audit, /ship').length - 1).toBe(0);
  });
});

// Stored test-only-export evidence for the review test-value caller-search grader.
{
  const stored = JSON.parse(fs.readFileSync(path.join(import.meta.dir, 'fixtures/test-value-seam-evidence.json'), 'utf8')) as
    { known_good: Record<string, unknown>; known_bad: Record<string, unknown> };

  describe('test-only export caller-search evidence', () => {
    test.each(Object.entries(stored.known_good))('accepts %s', (_name, evidence) => {
      expect(recordsNonTestCallerSearch({ evidence })).toBe(true);
    });
    test.each(Object.entries(stored.known_bad))('rejects %s', (_name, evidence) => {
      expect(recordsNonTestCallerSearch({ evidence })).toBe(false);
    });
  });
}
