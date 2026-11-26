#!/usr/bin/env bun
/**
 * ファイル一覧をサイズで均等に N 分割し、サブエージェントに渡す一覧ファイルを作る。
 * 使い方: bun translation/tools/chunk.ts --out <dir> [--max-bytes 130000] [--max-chunks 20] < list.txt
 * 出力: <dir>/chunk-01.txt ... (1 行 1 パス)。stdout に各チャンクのサイズとファイル数。
 */
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const out = opt('--out', 'translation/pending/chunks'); const maxBytes = Number(opt('--max-bytes', '130000')); const maxChunks = Number(opt('--max-chunks', '20'));
const files = readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(Boolean).filter(f => existsSync(f));
const sized = files.map(f => [statSync(f).size, f] as const).sort((a, b) => b[0] - a[0]);
const total = sized.reduce((n, [s]) => n + s, 0);
const n = Math.max(1, Math.min(maxChunks, Math.ceil(total / maxBytes)));
const chunks = Array.from({ length: n }, () => ({ size: 0, files: [] as string[] }));
for (const [s, f] of sized) { const c = chunks.reduce((a, b) => (a.size <= b.size ? a : b)); c.size += s; c.files.push(f); }
mkdirSync(out, { recursive: true });
chunks.forEach((c, i) => { if (c.files.length) writeFileSync(join(out, `chunk-${String(i + 1).padStart(2, '0')}.txt`), c.files.join('\n') + '\n'); });
console.log(chunks.filter(c => c.files.length).map((c, i) => `chunk-${String(i + 1).padStart(2, '0')}: ${Math.round(c.size / 1000)}KB ${c.files.length} files`).join('\n'));
