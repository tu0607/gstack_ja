#!/usr/bin/env bun
/**
 * 全角の括弧・コロン・疑問符を半角に統一する(コードフェンスとインラインコードの外だけ)。
 * 使い方: bun translation/tools/normalize-punct.ts [--apply] [<file>...]   (省略時は翻訳対象の md/tmpl すべて)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { filterTranslationSources } from '../../lib/translation-ledger';

const argv = process.argv.slice(2); const apply = argv.includes('--apply');
const positional = argv.filter(a => a !== '--apply');
const files = positional.length ? positional : filterTranslationSources(execSync('git ls-files', { encoding: 'utf8' }).split('\n')).filter(f => /\.(md|tmpl)$/.test(f) && f !== 'README.md');
const MAP: Record<string, string> = { '（': '(', '）': ')', '：': ':', '？': '?' };
let total = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n'); let fence: string | null = null; let n = 0;
  const out = lines.map(l => {
    const m = /^\s*(`{3,}|~{3,})/.exec(l);
    if (m) { if (!fence) fence = m[1]; else if (m[1].length >= fence.length && m[1][0] === fence[0]) fence = null; return l; }
    if (fence) return l;
    return l.split(/(`[^`]*`)/).map((seg, i) => i % 2 ? seg : seg.replace(/[（）：？]/g, c => { n++; return MAP[c]; })).join('');
  });
  if (n) { total += n; console.log(`${n} ${f}`); if (apply) writeFileSync(f, out.join('\n')); }
}
console.error(`[normalize-punct] ${total} 箇所${apply ? ' を置換' : '(--apply で置換)'}`);
