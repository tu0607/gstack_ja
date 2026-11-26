#!/usr/bin/env bun
/**
 * 翻訳した見出しで切れたアンカーリンク(`#slug`)を検出し、`--fix` で英語のアンカー
 * `<a id="slug"></a>` を対応する日本語見出しの直前に挿入して復元する。
 * 使い方: bun translation/tools/anchors.ts [--fix] [--ref <git-ref>]
 *   --ref は英語の原文を読む参照(既定 upstream/main)。日本語版と原文の見出し数が一致するファイルだけ自動で直す。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';

const argv = process.argv.slice(2);
const fix = argv.includes('--fix');
const ri = argv.indexOf('--ref'); const ref = ri >= 0 ? argv[ri + 1] : 'upstream/main';
const ROOT = process.cwd();
const files = execSync("git ls-files '*.md' '*.tmpl'", { encoding: 'utf8' }).split('\n').filter(f => f && !f.startsWith('test/fixtures/') && !f.includes('node_modules'));
const slug = (h: string) => h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/`/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s+/g, '-');
function headings(text: string) { const out: { idx: number; text: string }[] = []; let fence = false; text.split('\n').forEach((l, i) => { if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; } if (fence) return; const m = /^#{1,6}\s+(.*)$/.exec(l); if (m) out.push({ idx: i, text: m[1] }); }); return out; }
function slugs(hs: { text: string }[]) { const c = new Map<string, number>(); return hs.map(h => { let g = slug(h.text); const n = c.get(g) ?? 0; c.set(g, n + 1); return n ? `${g}-${n}` : g; }); }
function anchorsOf(text: string) { const s = new Set(slugs(headings(text))); for (const m of text.matchAll(/<a\s+(?:name|id)="([^"]+)"/g)) s.add(m[1]); return s; }
const cache = new Map<string, Set<string>>();
const anchors = (f: string) => { if (!cache.has(f)) cache.set(f, anchorsOf(readFileSync(f, 'utf8'))); return cache.get(f)!; };
const broken = new Map<string, Set<string>>();
for (const f of files) {
  let fence = false;
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; } if (fence) return;
    for (const m of l.matchAll(/\]\(([^)\s#]*)#([^)]+)\)/g)) {
      const [, p, frag] = m; if (/^https?:/.test(p) || p.includes('{')) continue;
      const target = p ? resolve(dirname(f), p) : resolve(f);
      if (!existsSync(target) || !/\.(md|tmpl)$/.test(target)) continue;
      const id = decodeURIComponent(frag);
      if (!anchors(target).has(id) && !anchors(target).has(id.toLowerCase())) { const rel = relative(ROOT, target); if (!broken.has(rel)) broken.set(rel, new Set()); broken.get(rel)!.add(id); console.log(`${f}:${i + 1}: 切れたアンカー ${p}#${frag}`); }
    }
  });
}
let fixed = 0, skipped = 0;
if (fix) for (const [target, ids] of broken) {
  const jaFile = target.endsWith('.md') && existsSync(`${target}.tmpl`) ? `${target}.tmpl` : target;
  let en = ''; try { en = execSync(`git show ${ref}:${target}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { en = ''; }
  if (!en) { console.log(`SKIP ${target}: ${ref} に原文がない`); skipped += ids.size; continue; }
  const enH = headings(en); const enS = slugs(enH);
  const jaLines = readFileSync(jaFile, 'utf8').split('\n'); const jaH = headings(jaLines.join('\n'));
  const inserts: { idx: number; id: string }[] = [];
  for (const id of ids) {
    const i = enS.indexOf(id.toLowerCase());
    if (i < 0) { console.log(`SKIP ${target}#${id}: 原文にも見出しがない`); skipped++; continue; }
    if (jaH.length !== enH.length) { console.log(`SKIP ${jaFile}#${id}: 見出し数が原文と違う(${jaH.length} vs ${enH.length})。手で <a id="${id}"></a> を「${enH[i].text}」の訳の直前に入れる`); skipped++; continue; }
    if (jaLines[jaH[i].idx - 1]?.includes(`id="${id}"`)) continue;
    inserts.push({ idx: jaH[i].idx, id }); fixed++;
  }
  for (const ins of inserts.sort((a, b) => b.idx - a.idx)) jaLines.splice(ins.idx, 0, `<a id="${ins.id}"></a>`);
  if (inserts.length) writeFileSync(jaFile, jaLines.join('\n'));
}
console.error(`[anchors] 切れたアンカー ${[...broken.values()].reduce((n, s) => n + s.size, 0)} 件${fix ? `、復元 ${fixed}、要手動 ${skipped}` : ''}`);
