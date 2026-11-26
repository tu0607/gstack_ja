#!/usr/bin/env bun
/**
 * 翻訳で壊れやすい Markdown 構造の機械的チェック。
 *   FENCE   閉じられていないコードフェンス / 行末に貼り付いたフェンス
 *   HEADING `#1234` のように Issue 番号で始まり見出しに化ける行
 *   LINK    `[x](y)` の参照先が存在しない / 角括弧と丸括弧が隣接してリンクに化けた箇所
 *   TABLE   表の列数の不一致
 *   PUNCT   句読点の重複
 * 使い方: bun translation/tools/mech-check.ts [--baseline <git-ref>] [<file>...]
 *   --baseline を付けると、同じ種類の指摘が英語の原文(git show <ref>:<file>)にもある分を差し引く。
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { filterTranslationSources } from '../../lib/translation-ledger';

const argv = process.argv.slice(2);
const bi = argv.indexOf('--baseline');
const baseline = bi >= 0 ? argv[bi + 1] : null;
const positional = argv.filter((a, i) => a !== '--baseline' && i !== bi + 1);
const files = positional.length ? positional : filterTranslationSources(execSync('git ls-files', { encoding: 'utf8' }).split('\n')).filter(f => /\.(md|tmpl)$/.test(f));

function check(file: string, text: string, resolveLinks: boolean): string[] {
  const out: string[] = []; const lines = text.split('\n');
  let fence: string | null = null; let fenceLine = 0;
  lines.forEach((l, i) => {
    const m = /^\s*(`{3,}|~{3,})/.exec(l);
    if (m) { if (!fence) { fence = m[1]; fenceLine = i + 1; } else if (m[1].length >= fence.length && m[1][0] === fence[0]) fence = null; return; }
    if (/[^`]```\s*$/.test(l) && !/^\s*```/.test(l) && !l.includes('````')) out.push(`${file}:${i + 1}: FENCE 行末に貼り付いたフェンス: ${l.trim().slice(-60)}`);
    if (fence) return;
    const n = i + 1; const t = l.trim();
    if (/^#\d/.test(t)) out.push(`${file}:${n}: HEADING Issue 番号で始まる行が見出しになる: ${t.slice(0, 60)}`);
    if (/。。|、、|。、|、。/.test(t)) out.push(`${file}:${n}: PUNCT 句読点の重複: ${t.slice(0, 60)}`);
    for (const lm of l.matchAll(/\]\(([^)\s#]+)(#[^)]*)?\)/g)) {
      const target = lm[1];
      if (/^(https?:|mailto:|\$|<|\{)/.test(target) || target.includes('{')) continue;
      if (JA.test(target)) { out.push(`${file}:${n}: LINK 日本語がリンク先になっている(括弧の間に空白が必要): ${lm[0].slice(0, 60)}`); continue; }
      if (resolveLinks && !existsSync(resolve(dirname(file), target))) out.push(`${file}:${n}: LINK 参照先なし: ${target}`);
    }
  });
  if (fence) out.push(`${file}:${fenceLine}: FENCE 閉じられていないコードフェンス`);
  let cols: number | null = null; fence = null;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = fence ? null : '`'; return; }
    if (fence) return;
    if (/^\s*\|.*\|\s*$/.test(l)) {
      const c = l.replace(/\\\|/g, '').replace(/`[^`]*`/g, '').split('|').length - 2;
      if (cols === null) cols = c; else if (c !== cols) out.push(`${file}:${i + 1}: TABLE 列数の不一致 (${c} vs ${cols})`);
    } else cols = null;
  });
  return out;
}
const JA = /[぀-ヿ一-鿿]/;
const kindOf = (s: string) => s.replace(/^[^:]+:\d+: (\w+).*/, '$1').replace(/^[^:]+:\d+: /, '');
let total = 0;
for (const f of files) {
  if (!existsSync(f)) continue;
  let findings = check(f, readFileSync(f, 'utf8'), true);
  if (baseline && findings.length) {
    let en = ''; try { en = execSync(`git show ${baseline}:${f}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { en = ''; }
    if (en) {
      const enKinds = new Map<string, number>();
      for (const e of check(f, en, false)) enKinds.set(kindOf(e), (enKinds.get(kindOf(e)) ?? 0) + 1);
      findings = findings.filter(x => { const k = kindOf(x); const left = enKinds.get(k) ?? 0; if (left > 0) { enKinds.set(k, left - 1); return false; } return true; });
    }
  }
  for (const x of findings) console.log(x); total += findings.length;
}
console.error(`[mech-check] ${files.length} files, ${total} findings${baseline ? ` (baseline ${baseline} を差し引き)` : ''}`);
process.exit(total ? 1 : 0);
