/**
 * 翻訳台帳(translation/ledger.json)の判定・計算ロジック。CLI は bin/gstack-translation-ledger。
 *
 * このフォークは upstream(garrytan/gstack)を日本語化したもの。台帳は「翻訳した生成元ファイルごとに、
 * 翻訳の基準にした upstream 側の英語版 blob sha」を記録する。upstream が更新されたら、blob が変わった
 * ファイルだけを翻訳し直せばよい。何を翻訳対象にするかの判定は `isTranslationSource` の 1 か所に置く。
 * ネットワークには出ない(upstream の fetch は利用者が自分で実行する)。手順: docs/TRANSLATION.md
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

export const LEDGER_PATH = 'translation/ledger.json';
export const PENDING_DIR = 'translation/pending';

export interface LedgerEntry { blob: string; translated_at: string }
export interface Ledger {
  upstream_base: string;
  upstream_remote: string;
  files: Record<string, LedgerEntry>;
}

// ─── 翻訳対象の判定 ────────────────────────────────────────────

/** フォーク側だけに存在するファイル(upstream にない)。台帳の対象にしない。 */
const FORK_ONLY = [/^translation\//, /^docs\/TRANSLATION\.md$/, /^\.claude\/skills\/translate-upstream\//];

/** `.gstack/generated.json` に無い、手書きでない生成物の予備の除外パターン(JSON が読めない場合の保険)。 */
const GENERATED_FALLBACK = [
  'SKILL.md', '*/SKILL.md', '*/sections/*.md', 'review/design-checklist.md',
  'qa/templates/functional-report-template.md', 'openclaw/gstack-*-CLAUDE.md',
  'agents-digest/*.md', 'test/fixtures/golden/*-ship-SKILL.md',
];

let generatedGlobs: Bun.Glob[] | undefined;
function generatedOutputGlobs(root = repoRoot()): Bun.Glob[] {
  if (generatedGlobs) return generatedGlobs;
  const patterns = new Set(GENERATED_FALLBACK);
  const file = path.join(root, '.gstack', 'generated.json');
  if (fs.existsSync(file)) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as { entries?: { outputs?: string[] }[] };
    for (const entry of doc.entries ?? []) for (const out of entry.outputs ?? []) patterns.add(out);
  }
  generatedGlobs = [...patterns].map(p => new Bun.Glob(p));
  return generatedGlobs;
}

function repoRoot(): string {
  return path.resolve(import.meta.dir, '..');
}

/**
 * 翻訳した生成元か。パスだけで決まる判定で、生成物(`.gstack/generated.json` の outputs)は除く。
 * `.tmpl` から生成される `.md`(同じ場所に `<name>.md.tmpl` がある)は、一覧が要る
 * `filterTranslationSources` で除く。
 */
export function isTranslationSource(file: string): boolean {
  const p = file.replace(/^\.\//, '');
  if (p.startsWith('node_modules/') || p.includes('/node_modules/')) return false;
  if (FORK_ONLY.some(re => re.test(p))) return false;
  if (p.endsWith('.tmpl')) return true;
  if (/^[^/]+\/sections\/manifest\.json$/.test(p)) return true;
  if (/^scripts\/resolvers\/.+\.ts$/.test(p)) return true;
  if (p === 'scripts/gen-skill-docs.ts' || p === 'scripts/gen-agents-digest.ts') return true;
  if (/^hosts\/[^/]+\.ts$/.test(p)) return true;
  if (p === 'lib/design-catalog.ts' || p === 'lib/dx-error-contract.ts' || p === 'lib/coordinator-contract.ts') return true;
  if (/^model-overlays\/[^/]+\.md$/.test(p)) return true;
  if (p.endsWith('.md')) {
    if (p === 'README.md') return false;
    if (p.startsWith('test/fixtures/') || p.startsWith('make-pdf/test/fixtures/')) return false;
    return !generatedOutputGlobs().some(g => g.match(p));
  }
  return false;
}

/** 一覧から翻訳対象だけを残す。同じ場所に `.md.tmpl` がある `.md` は生成物なので除く。 */
export function filterTranslationSources(paths: Iterable<string>): string[] {
  const all = new Set(paths);
  return [...all].filter(p => isTranslationSource(p) && !(p.endsWith('.md') && all.has(`${p}.tmpl`))).sort();
}

// ─── git ────────────────────────────────────────────────────

export function git(cwd: string, args: string[]): { ok: boolean; out: string; err: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
}

/** `ref` の完全なコミット sha。解決できなければ undefined。 */
export function resolveCommit(cwd: string, ref: string): string | undefined {
  const r = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return r.ok ? r.out.trim() : undefined;
}

/** `ref` のツリーにある全ファイル(path → blob sha)。サブモジュールは含めない。 */
export function listTree(cwd: string, ref: string): Map<string, string> {
  const r = git(cwd, ['ls-tree', '-r', '-z', ref]);
  if (!r.ok) throw new Error(`git ls-tree ${ref} failed: ${r.err}`);
  const map = new Map<string, string>();
  for (const rec of r.out.split('\0')) {
    const m = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/s.exec(rec);
    if (m && m[2] === 'blob') map.set(m[4]!, m[3]!);
  }
  return map;
}

/** 作業ツリーにある(追跡済み + 未追跡で無視されない)ファイルのうち、実在するもの。 */
export function listLocalFiles(cwd: string): string[] {
  const r = git(cwd, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  if (!r.ok) throw new Error(`git ls-files failed: ${r.err}`);
  return r.out.split('\0').filter(p => p && fs.existsSync(path.join(cwd, p)));
}

export function sourceBlobs(tree: Map<string, string>): Map<string, string> {
  const keep = new Set(filterTranslationSources(tree.keys()));
  return new Map([...tree].filter(([p]) => keep.has(p)));
}

// ─── 台帳 ───────────────────────────────────────────────────

export function readLedger(cwd: string): Ledger {
  const file = path.join(cwd, LEDGER_PATH);
  if (!fs.existsSync(file)) throw new Error(`${LEDGER_PATH} がありません。先に \`init --base <commit>\` を実行してください。`);
  const doc = JSON.parse(fs.readFileSync(file, 'utf8')) as Ledger;
  if (typeof doc.upstream_base !== 'string' || typeof doc.files !== 'object' || doc.files === null) {
    throw new Error(`${LEDGER_PATH} の形式が不正です(upstream_base と files が必要)。`);
  }
  return doc;
}

export function writeLedger(cwd: string, ledger: Ledger): void {
  const files: Record<string, LedgerEntry> = {};
  for (const k of Object.keys(ledger.files).sort()) files[k] = ledger.files[k]!;
  const file = path.join(cwd, LEDGER_PATH);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ ...ledger, files }, null, 2) + '\n');
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface LedgerStatus {
  changed: string[];
  added: string[];
  removed: string[];
  untracked: string[];
}

/** 台帳と upstream の翻訳対象(path → blob)と作業ツリーのファイルを比べる。 */
export function computeStatus(ledger: Ledger, upstream: Map<string, string>, local: Iterable<string>): LedgerStatus {
  const changed: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  for (const [p, blob] of upstream) {
    const entry = ledger.files[p];
    if (!entry) added.push(p);
    else if (entry.blob !== blob) changed.push(p);
  }
  for (const p of Object.keys(ledger.files)) if (!upstream.has(p)) removed.push(p);
  const untracked = filterTranslationSources(local).filter(p => !ledger.files[p] && !upstream.has(p));
  return { changed: changed.sort(), added: added.sort(), removed: removed.sort(), untracked };
}
