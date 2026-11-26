#!/usr/bin/env bun
/**
 * 翻訳後に残った「英語だけの行」を、コードフェンスとフロントマターの外から探す。
 * 使い方: bun translation/tools/residue-scan.ts [<file>...]   (省略時は翻訳対象の生成元すべて)
 * 出力: <file>:<line>: <text>。コマンド片や固有名詞も混じるので、人が判断する。
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { filterTranslationSources } from '../../lib/translation-ledger';

const args = process.argv.slice(2);
const files = args.length ? args : filterTranslationSources(execSync('git ls-files', { encoding: 'utf8' }).split('\n')).filter(f => /\.(md|tmpl)$/.test(f));
const JA = /[぀-ヿ一-鿿]/;
const WORDS = /\b[A-Za-z]{3,}\b.*\b[A-Za-z]{3,}\b.*\b[A-Za-z]{3,}\b/;
let total = 0;
for (const f of files) {
  let fence: string | null = null; let frontmatter = false;
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (i === 0 && line.trim() === '---') { frontmatter = true; return; }
    if (frontmatter) { if (line.trim() === '---') frontmatter = false; return; }
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (m) { if (!fence) fence = m[1]; else if (m[1].length >= fence.length && m[1][0] === fence[0]) fence = null; return; }
    if (fence || /^(    |\t)/.test(line)) return;
    const t = line.trim();
    if (!t || JA.test(t) || /^(\||<|https?:|\[.*\]:|!\[|#)/.test(t)) return;
    const stripped = t.replace(/`[^`]*`/g, '').replace(/\[[^\]]*\]\([^)]*\)/g, '').replace(/https?:\S+/g, '').replace(/\{[^}]*\}/g, '');
    if (!WORDS.test(stripped)) return;
    console.log(`${f}:${i + 1}: ${t.slice(0, 160)}`); total++;
  });
}
console.error(`[residue-scan] ${files.length} files, ${total} English-only lines`);
