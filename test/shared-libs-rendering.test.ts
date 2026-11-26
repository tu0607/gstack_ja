import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ALL_HOST_CONFIGS } from '../hosts';
import { discoverTemplates } from '../scripts/discover-skills';
import { sharedLibsPlanExcerpt } from './helpers/shared-libs-plan-excerpt';
import { compact, expectMentions } from './helpers/prompt-structure';

const ROOT = resolve(import.meta.dir, '..');
let output: string;

function rendered(host: (typeof ALL_HOST_CONFIGS)[number], skill: string): string {
  const dir = host.name === 'claude' ? join(output, skill)
    : join(output, host.hostSubdir, 'skills', `gstack-${skill}`);
  const sections = join(dir, 'sections');
  return readFileSync(join(dir, 'SKILL.md'), 'utf8') + (existsSync(sections)
    ? readdirSync(sections).filter(f => f.endsWith('.md')).sort()
      .map(f => '\n' + readFileSync(join(sections, f), 'utf8')).join('') : '');
}

describe('shared-code skill distribution', () => {
  beforeAll(() => {
    output = mkdtempSync(join(tmpdir(), 'gstack-shared-libs-render-'));
    const result = spawnSync('bun', ['run', 'scripts/gen-skill-docs.ts', '--host', 'all', '--out-dir', output],
      { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
    expect(result.status, result.stderr).toBe(0);
  }, 120_000);
  afterAll(() => { if (output) rmSync(output, { recursive: true, force: true }); });

  test('the new authored template is discovered without a hand-maintained installer list', () => {
    expect(discoverTemplates(ROOT)).toContainEqual({
      tmpl: 'deslop-shared-libs/SKILL.md.tmpl', output: 'deslop-shared-libs/SKILL.md',
    });
    expect(readFileSync(join(output, 'gstack/llms.txt'), 'utf8')).toContain('deslop-shared-libs');
    expectMentions(readFileSync(join(output, 'SKILL.md'), 'utf8'), [['`/deslop-shared-libs`', '呼び出す']], 'router SKILL.md');
  });

  for (const host of ALL_HOST_CONFIGS) {
    test(`${host.name}: all three workflows receive the same evaluation criteria`, () => {
      const texts = ['deslop-shared-libs', 'plan-eng-review', 'review'].map(skill => rendered(host, skill));
      for (const text of texts) {
        expect(text.match(/### 共有コードの評価ルーブリック/g)?.length).toBe(1);
        expectMentions(compact(text), [
          ['検証済み', '一次的', '少なくとも 2 箇所'],
          ['移動したコード', '両側'],
          ['提案段階の呼び出し元', 'エンジニアリングプランのレビュー'],
        ], 'shared-code rubric');
        expect(text).not.toContain('{{SHARED_LIBS_RUBRIC}}');
      }
      const standalone = texts[0];
      expect(standalone).not.toContain('gstack-skill-start');
      expect(standalone).not.toContain('gstack-skill-end');
      expect(standalone).not.toContain('## Preamble');
      expectMentions(compact(standalone), [
        ['5 ページ', '50 ページ'],
        ['繰り返しのページ番号'],
        ['一時ファイル', 'リポジトリの外'],
        ['API のレスポンス', '標準出力', 'メモリ'],
      ], 'standalone budget and write boundary');
      // Git safety is the installed helper from the trusted global runtime, not a retyped prefix.
      const safeGit = `~/${host.globalRoot}/bin/gstack-safe-git`;
      expect(standalone).toContain(`${safeGit} -C <repo> rev-parse --is-inside-work-tree`);
      expect(standalone).toContain(`${safeGit} ls-files --cached --others --exclude-standard -z`);
      expectMentions(compact(standalone), [['決して', '素の `git`']], 'standalone git safety');
      expect(standalone).not.toContain('git --no-pager');
      expect(standalone).not.toContain('$GSTACK_ROOT');
      expect(standalone).not.toContain('{{SAFE_GIT}}');
      expect(standalone).toContain('python3 -I -S');
      expectMentions(compact(standalone), [
        ['正確に 2 つ', 'コミット済みのオブジェクト ID'],
        ['同じ Git のツリー'],
        ['Git のトランスポート', '呼び出してはいけません'],
        ['`ls-remote`', 'トランスポート'],
        ['ルーズオブジェクト', 'デコード'],
      ], 'standalone git transport rules');
      expect(texts[2]).toContain('snapshot_covered_paths');
      expectMentions(compact(texts[2]), [['assume-unchanged', 'skip-worktree'], ['blob', 'バイト単位', '一致']], 'review snapshot coverage');
      for (const [skill, parent] of [['review', texts[2]], ['ship', rendered(host, 'ship')]]) {
        const validation = parent.indexOf(skill === 'ship' ? '1. **重大度を検証します。**' : '**まず advisory の重大度を検証します。**');
        expect(validation).toBeGreaterThanOrEqual(0);
        expect(validation).toBeLessThan(parent.indexOf(skill === 'ship' ? '2. **判断を読みます。**' : '指摘を分類する前に'));
        if (skill === 'ship') {
          const matching = parent.slice(validation).replace(/\s+/g, ' ');
          expectMentions(matching, [
            ['CRITICAL', 'advisory', '`advisory` を外し', '決して下げません'],
            ['INFORMATIONAL', 'advisory のまま', 'simplification'],
            ['矛盾する保存済みの判断', '拒否'],
            ['欠陥', '抑制'],
          ], 'ship severity validation');
        } else {
          expectMentions(compact(parent), [
            ['`advisory` を', '`CRITICAL` の重大度を保持'],
            ['重大度を下げてはいけません', 'advisory'],
            ['INFORMATIONAL', 'advisory のまま', 'simplification'],
            ['CRITICAL', 'advisory', '矛盾', '根拠にはなりません'],
          ], 'review severity validation');
        }
        if (host.name !== 'codex' && !host.suppressedResolvers?.includes('REVIEW_ARMY')) {
          const stages = ['#### 1. 出力を解析する', '#### 2. 重大度を検証する', '#### 3. 識別とマージ',
            '#### 4. スペシャリストの信頼度ゲートを適用する', '#### 5. スペシャリストをスコア化して提示する'];
          const positions = stages.map(stage => parent.indexOf(stage));
          expect(positions.every(position => position >= 0)).toBe(true);
          expect(positions).toEqual([...positions].sort((a, b) => a - b));
          const merge = parent.slice(positions[1], positions[2]).replace(/\s+/g, ' ');
          expectMentions(compact(merge), [['`advisory` を', '`CRITICAL` の重大度を保持'], ['重大度を下げてはいけません']], 'review army merge');
          expectMentions(compact(parent), [['`quality_score`', 'スペシャリストの指摘だけ'], ['コアの指摘は入れません']], 'specialist header scope');
        } else {
          expect(parent).not.toContain('#### 1. 出力を解析する');
          expect(parent).not.toContain('SPECIALIST REVIEW: N findings');
        }
      }
    });
  }

  test('Codex keeps the core check when Review Army is suppressed', () => {
    const codex = ALL_HOST_CONFIGS.find(host => host.name === 'codex')!;
    const review = rendered(codex, 'review');
    expect(review).not.toContain('### スペシャリストを並列にディスパッチする');
    expect(review).toContain('### 共有コードの評価ルーブリック');
    expect(review).toContain('sharedLibsFingerprint');
    expect(review).toContain('advisory');
    expect(review).toContain('ASK');
  });

  test('the bounded plan fixture includes the generated decision prerequisites before Code Quality', () => {
    const entrypoint = readFileSync(join(output, 'plan-eng-review/SKILL.md'), 'utf8');
    const review = readFileSync(join(output, 'plan-eng-review/sections/review-sections.md'), 'utf8');
    const excerpt = sharedLibsPlanExcerpt(entrypoint, review);
    const headings = ['## AskUserQuestion Format', '## 私のエンジニアリングの好み',
      '## Review record and write policy', '**プランレビューの根拠:**',
      '## Confidence Calibration', '## Decision procedure(決定の手順)',
      '### 未回答の選択を準備する', '**独立した選択を分ける。**',
      '**一つの選択を比較する。**', '**保留中の記録のチェックポイント。**',
      '### 一度送信して待つ', '### 回答を記録する',
      '### 2. コード品質のレビュー', '### 共有コードの評価ルーブリック', '**Blocked outcome:**'];
    const positions = headings.map(heading => excerpt.indexOf(heading));
    expect(positions.every(index => index >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(excerpt.match(/^## Decision procedure\(決定の手順\)$/gm)).toHaveLength(1);
    expect(excerpt).toContain('AskUserQuestion({ questions: [currentDecision] })');
    expectMentions(compact(excerpt), [
      ['D の採番', '最初の対象メニューは除きます'],
      ['書き込みの前に', '成果物', '親ディレクトリの権限'],
      ['Write/Edit', 'Read', '保存された記録全体'],
      ['保存結果を確認', 'State', '解決ブロック全体', 'Read'],
      ['提案段階の呼び出し元', 'エンジニアリングプランのレビュー'],
    ], 'plan excerpt');
    expect(excerpt).not.toMatch(/^## (?:Scope Challenge|Outside Voice|Required outputs)/m);
    expect(excerpt).not.toMatch(/^### [134]\. (?:Architecture|Test|Performance) review/m);
    expect(excerpt).not.toContain('gstack-skill-start --');

    // Exact source slices preserve the complete native brief and decision loop.
    for (const [source, start, end] of [
      [entrypoint, '## AskUserQuestion Format', '## Artifacts Sync'],
      [review, '## Review record and write policy', '## Prior Learnings'],
      [review, '## Decision procedure(決定の手順)', '## Scope Challenge'],
      [review, '### 2. コード品質のレビュー', '### 3. テストのレビュー'],
    ]) expect(excerpt).toContain(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))));

    for (const [source, marker] of [[entrypoint, '## AskUserQuestion Format'],
      [review, '## Review record and write policy'], [review, '## Decision procedure(決定の手順)'],
      [review, '## Scope Challenge']] as const) {
      const damaged = source.replace(marker, '## Missing prerequisite');
      expect(() => sharedLibsPlanExcerpt(source === entrypoint ? damaged : entrypoint,
        source === review ? damaged : review)).toThrow(/marker not found/);
    }
  });

  test('every rendered recommendation names a concrete risk, never "none"', () => {
    // C3: shared-libs-opportunity-judgment reds 37193478719 t3 and 37195203538 t1 wrote
    // "Main risk: none found inside the repo" / "none in behavior" for the top recommendation.
    for (const host of ALL_HOST_CONFIGS) {
      const text = rendered(host, 'deslop-shared-libs').replace(/\s+/g, ' ');
      expectMentions(text, [['主なリスク'], ['移行後に異なりうる具体的な振る舞い', '共有の失敗の影響範囲', '「なし」とは決して書かない']], host.name);
    }
  });

  test('standalone catalog entry keeps a bounded multi-line description', () => {
    const skill = readFileSync(join(output, 'deslop-shared-libs/SKILL.md'), 'utf8');
    const description = skill.match(/^description: \|\n((?:  .+\n)+)/m)?.[1];
    expect(description).toBeDefined();
    expect(description!.trimEnd().endsWith('(gstack)')).toBe(true);
    expect(description).toContain('/deslop-shared-libs');
    // The always-loaded catalog budget itself is pinned by test/catalog-budget.test.ts.
    expect(Buffer.byteLength('deslop-shared-libs') + Buffer.byteLength(description!)).toBeLessThan(600);
  });
});
