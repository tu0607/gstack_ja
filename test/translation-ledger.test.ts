/**
 * 翻訳台帳(lib/translation-ledger.ts、bin/gstack-translation-ledger)。
 * Value: protects=upstream 更新時に「翻訳し直すファイル」を取りこぼさず、生成物や fixtures を台帳に混ぜない;
 *   fails_when=対象の判定が緩む/締まりすぎる、blob 比較や mark の更新が壊れる、check が未登録の対象を見逃す;
 *   why_new=台帳は新規のため既存のテストが無い; seam=none
 */
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { filterTranslationSources, isTranslationSource } from '../lib/translation-ledger';

const ROOT = path.resolve(import.meta.dir, '..');
const CLI = path.join(ROOT, 'bin', 'gstack-translation-ledger');

describe('isTranslationSource', () => {
  test('生成元(.tmpl、resolvers、ホスト設定、契約ファイル、overlay、manifest、docs の .md)は対象', () => {
    for (const p of [
      'SKILL.md.tmpl', 'ship/sections/tests.md.tmpl', 'scripts/resolvers/aside.ts', 'scripts/resolvers/preamble/generate-writing-style.ts',
      'scripts/gen-skill-docs.ts', 'scripts/gen-agents-digest.ts', 'hosts/codex.ts', 'lib/design-catalog.ts',
      'lib/dx-error-contract.ts', 'lib/coordinator-contract.ts', 'model-overlays/claude.md', 'ship/sections/manifest.json',
      'CLAUDE.md', 'docs/CONTRIBUTOR_REFERENCE.md',
    ]) expect(isTranslationSource(p), p).toBe(true);
  });

  test('生成物、fixtures、README、フォーク独自のファイル、コードは対象外', () => {
    for (const p of [
      'SKILL.md', 'ship/SKILL.md', 'ship/sections/tests.md', 'review/design-checklist.md', 'agents-digest/gstack-AGENTS.md',
      'test/fixtures/golden/claude-ship-SKILL.md', 'test/fixtures/foo.md', 'make-pdf/test/fixtures/a.md', 'README.md',
      'translation/ledger.json', 'docs/TRANSLATION.md', 'lib/result-codes.ts', 'hosts/claude/hooks/hook-log.ts', 'scripts/other.ts',
    ]) expect(isTranslationSource(p), p).toBe(false);
  });

  test('同じ場所に .md.tmpl がある .md は生成物として除く', () => {
    expect(filterTranslationSources(['x/DRIVER.md', 'x/DRIVER.md.tmpl', 'x/other.md'])).toEqual(['x/DRIVER.md.tmpl', 'x/other.md']);
  });
});

describe('CLI の init / status / mark / check', () => {
  let repo: string;
  const sh = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd: repo, encoding: 'utf8' });
    return { code: r.status, out: r.stdout, err: r.stderr };
  };
  const git = (...args: string[]) => sh('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args]);
  const cli = (...args: string[]) => sh(CLI, args);
  const write = (p: string, text: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
    fs.writeFileSync(path.join(repo, p), text);
  };

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-ledger-'));
    git('init', '-q', '-b', 'main');
    write('docs/a.md', 'one\n');
    write('docs/gone.md', 'bye\n');
    write('docs/keep.md', 'same\n');
    write('x/SKILL.md', 'generated\n');
    write('x/SKILL.md.tmpl', 'tmpl\n');
    git('add', '-A');
    git('commit', '-q', '-m', 'base');
    git('branch', 'base');
    expect(cli('init', '--base', 'base').code).toBe(0);
    // upstream: a.md 変更、b.md 追加、gone.md 削除、生成物 x/SKILL.md も変更(無視されるはず)
    write('docs/a.md', 'two\n');
    write('docs/b.md', 'new\n');
    write('x/SKILL.md', 'regenerated\n');
    git('rm', '-q', 'docs/gone.md');
    git('add', '-A');
    git('commit', '-q', '-m', 'upstream');
    git('branch', 'up');
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  const ledger = () => JSON.parse(fs.readFileSync(path.join(repo, 'translation/ledger.json'), 'utf8'));

  test('init は生成物を除く翻訳対象だけを blob 付きで記録する', () => {
    const l = ledger();
    expect(Object.keys(l.files).sort()).toEqual(['docs/a.md', 'docs/gone.md', 'docs/keep.md', 'x/SKILL.md.tmpl']);
    expect(l.files['docs/a.md'].blob).toBe(git('rev-parse', 'base:docs/a.md').out.trim());
    expect(l.upstream_base).toBe(git('rev-parse', 'base').out.trim());
  });

  test('status が CHANGED / ADDED / REMOVED / UNTRACKED を分け、--diff で差分を書く', () => {
    write('docs/local-only.md', 'x\n');
    const r = cli('status', '--upstream', 'up', '--diff', '--json');
    expect(r.code).toBe(0);
    const s = JSON.parse(r.out);
    expect(s.changed).toEqual(['docs/a.md']);
    expect(s.added).toEqual(['docs/b.md']);
    expect(s.removed).toEqual(['docs/gone.md']);
    expect(s.untracked).toEqual(['docs/local-only.md']);
    expect(fs.readFileSync(path.join(repo, 'translation/pending/docs/a.md.diff'), 'utf8')).toContain('+two');
    expect(cli('status', '--upstream', 'up').out).toContain('GSTACK_RESULT: skill=translation status=pending changed=1 added=1 removed=1');
  });

  test('未 fetch の ref は案内を出して失敗する', () => {
    const r = cli('status', '--upstream', 'upstream/main');
    expect(r.code).toBe(1);
    expect(r.err).toContain('fetch');
  });

  test('mark で台帳が更新され、clean になる(REMOVED は台帳から消える)', () => {
    expect(cli('mark', '--base', 'up').code).toBe(0);
    const l = ledger();
    expect(l.files['docs/a.md'].blob).toBe(git('rev-parse', 'up:docs/a.md').out.trim());
    expect(l.files['docs/b.md']).toBeDefined();
    expect(l.files['docs/gone.md']).toBeUndefined();
    expect(l.upstream_base).toBe(git('rev-parse', 'up').out.trim());
    expect(cli('status', '--upstream', 'up').out).toContain('status=clean changed=0 added=0 removed=0');
  });

  test('一部だけ mark すると残りは pending のままで upstream_base は進まない', () => {
    expect(cli('mark', '--base', 'up', 'docs/a.md').code).toBe(0);
    expect(ledger().upstream_base).toBe(git('rev-parse', 'base').out.trim());
    expect(JSON.parse(cli('status', '--upstream', 'up', '--json').out).changed).toEqual([]);
    expect(JSON.parse(cli('status', '--upstream', 'up', '--json').out).added).toEqual(['docs/b.md']);
  });

  test('check は UNTRACKED があると exit 1、無ければ 0', () => {
    // 作業ツリーには upstream で増えた docs/b.md があるが、台帳にはまだない
    expect(cli('check').err).toContain('docs/b.md');
    expect(cli('mark', '--base', 'up').code).toBe(0);
    expect(cli('check').code).toBe(0);
    write('docs/untranslated.md', 'x\n');
    const r = cli('check');
    expect(r.code).toBe(1);
    expect(r.err).toContain('docs/untranslated.md');
  });
});
