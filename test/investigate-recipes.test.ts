/**
 * Plan D3: investigate recipes and backlog mode. Pins the carve shape (manifest
 * ids, STOP pointers, the Arguments table routing `--backlog`), the tokens each
 * recipe must carry (commands, the `## Flake evidence` section, the four backlog
 * classes, the never-retry rule), the Phase 1 additions, the benchmark
 * `git update-index --refresh` line, and that an external host gets the recipes
 * inlined. Prose is not pinned.
 */
import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CARVE_GUARDS } from './helpers/carve-guards';
import { expectMentions } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const RECIPES = ['flake', 'polluter', 'race', 'eval-bisect', 'backlog'] as const;

describe('investigate carve', () => {
  const manifest = JSON.parse(read('investigate/sections/manifest.json')) as { skill: string; sections: Array<{ id: string; file: string; trigger: string }> };
  const skeleton = read('investigate/SKILL.md');
  test('manifest lists the five recipes and the registry guards them', () => {
    expect(manifest.skill).toBe('investigate');
    expect(manifest.sections.map(s => s.id)).toEqual([...RECIPES]);
    expect(CARVE_GUARDS.investigate!.expectedSections).toEqual(manifest.sections.map(s => s.file));
    for (const s of manifest.sections) expect(fs.existsSync(path.join(ROOT, 'investigate', 'sections', `${s.file}.tmpl`))).toBe(true);
  });
  test('the skeleton routes: Arguments table with --backlog before the first STOP, one STOP per recipe, recipes after the Phase 2 pattern table', () => {
    const args = skeleton.indexOf('## 引数');
    const firstStop = skeleton.indexOf('> **STOP.**');
    expect(args).toBeGreaterThan(0);
    expect(args).toBeLessThan(firstStop);
    expect(skeleton).toMatch(/\| `\/investigate --backlog \[<issue numbers or gh query>\]` \| 未解決の issue を HEAD に照らして読み取り専用で仕分けます/);
    for (const id of RECIPES) expect(skeleton).toContain(`sections/${id}.md`);
    expect(skeleton.match(/> \*\*STOP\.\*\*/g)!.length).toBe(RECIPES.length);
    const recipes = skeleton.indexOf('### レシピ');
    expect(recipes).toBeGreaterThan(skeleton.indexOf('## フェーズ 2: パターン分析'));
    expect(recipes).toBeLessThan(skeleton.indexOf('## フェーズ 3: 仮説の検証'));
    expect(skeleton).not.toContain('## Flake recipe');
  });
  test('Phase 1 additions: call sites before calling two queries duplicates; update-index before timing git in a worktree (investigate and benchmark)', () => {
    const phase1 = skeleton.slice(skeleton.indexOf('## フェーズ 1: 根本原因の調査'), skeleton.indexOf('## スコープのロック'));
    expectMentions(phase1, [['重複', '呼び出し箇所']], 'phase 1');
    expect(phase1).toContain('`git update-index --refresh`');
    const benchmark = read('benchmark/SKILL.md');
    expect(benchmark).toContain('git update-index --refresh >/dev/null 2>&1 || true');
    expectMentions(benchmark, [['計測', 'git', 'update-index']], 'benchmark');
  });
});

describe('recipe tokens', () => {
  test('flake: reproduce on main, N runs, gh run list, forced probe, never loosen, rerun rule, Flake evidence section, paid evals never retried', () => {
    const flake = read('investigate/sections/flake.md');
    expect(flake).toContain('## Flake の手順');
    expect(flake).toContain('git worktree add <dir> origin/<base>');
    expect(flake).toContain('ship-measure.ts free --files <file> --reruns N');
    expect(flake).toContain('gh run list --branch <base> --workflow free-tests.yml --status success --limit 20');
    expect(flake).toContain('**強制プローブ。**');
    expect(flake).toContain('**決して緩めない。**');
    expect(flake).toContain('P(fail | regression)');
    expect(flake).toContain('RH-15');
    expect(flake).toContain('**再実行は、原因が既知で PR の外にある場合');
    expectMentions(flake, [['`## Flake evidence`', 'PR 本文', '必須']], 'flake');
    expect(flake).toContain('`EVAL_POLICY`');
    expectMentions(flake, [['有料', 'eval', '決して再試行しません']], 'flake');
    expect(flake).toContain('ルーティングメモ');
  });
  test('polluter: CI file order, ship-measure free --files bisect, the leak list, the POLLUTER report line', () => {
    const polluter = read('investigate/sections/polluter.md');
    expect(polluter).toContain('bun --no-env-file --config=/dev/null run scripts/ship-measure.ts free --shard <I>');
    expect(polluter).toContain('--files <affected-files> --reruns 3');
    expect(polluter).toContain('**先行ファイルを二分探索する。**');
    expect(polluter).toContain('POLLUTER: <file> leaked <what> into <victim>; fixed by <change>');
    expect(polluter).toContain('**被害者ではなく Polluter を修正する。**');
  });
  test('race: timing probes, forced interleaving, the concurrent-writer template', () => {
    const race = read('investigate/sections/race.md');
    expect(race).toContain('**タイミングのプローブ。**');
    expect(race).toContain('**強制的なインターリーブ。**');
    expect(race).toContain('Promise.allSettled(Array.from({ length: N }, (_, i) => writer(i)))');
    expect(race).toMatch(/N ≥ 8/);
  });
  test('eval-bisect: distinct revisions, cached cheap scorer, detached runs with the sentinel, never retry a paid case', () => {
    const bisect = read('investigate/sections/eval-bisect.md');
    expect(bisect).toContain('**異なるリビジョンのみを対象にする。**');
    expect(bisect).toContain('.gstack/tmp/eval-bisect/');
    expect(bisect).toContain('### gstack-detach EXIT=<code> ###');
    expectMentions(bisect, [['有料ケース', '再試行しないでください']], 'eval-bisect');
  });
  test('backlog: the four classes, repro required for still_open, contributor PRs evidence only, read-only table, no closing', () => {
    const backlog = read('investigate/sections/backlog.md');
    for (const cls of ['`still_open`', '`already_fixed <commit>`', '`partially_fixed`', '`owned_elsewhere`']) expect(backlog).toContain(cls);
    expectMentions(backlog, [['再現', '必須']], 'backlog');
    expect(backlog).toContain('`repro needed`');
    expect(backlog).toContain('**コントリビューターの PR は証拠としてのみ扱います。**');
    expect(backlog).toContain('| issue | class | receipt (commit / repro / link) | contributor PR (evidence) | next |');
    expectMentions(backlog, [['`gh issue close`', '行わない']], 'backlog');
    expect(backlog).not.toMatch(/gh issue close <n>/);
  });
});

describe('external hosts inline the recipes', () => {
  const codex = path.join(ROOT, '.agents', 'skills', 'gstack-investigate', 'SKILL.md');
  test.skipIf(!fs.existsSync(codex))('the codex render carries every recipe heading and no section pointer', () => {
    const text = fs.readFileSync(codex, 'utf8');
    for (const heading of ['## Flake の手順', '## Polluter の手順', '## Race の手順', '## Eval bisect の手順', '## バックログモード']) expect(text).toContain(heading);
    expect(text).not.toContain('sections/flake.md');
  });
});
