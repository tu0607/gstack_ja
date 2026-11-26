#!/usr/bin/env bun
/**
 * test/fixtures/workflow-required-steps.json を、生成済みの日本語 SKILL.md から再導出する。
 * 見出しの翻訳を変えたあとに実行する(テスト test/workflow-required-steps.test.ts と同じ STEP 正規表現を使う)。
 */
import { readFileSync, writeFileSync } from 'node:fs';
const FIX = 'test/fixtures/workflow-required-steps.json';
const STEP = /^#{2,4} (?:(?:Step|Phase|Section|ステップ|フェーズ|セクション) \d+[A-Za-z0-9.]*|(?:Phases|フェーズ) \d+-\d+|\d+[A-Za-z]?(?:\.\d+)?\.)[ :].*$/;
const pinned = JSON.parse(readFileSync(FIX, 'utf8')) as { source: string; skills: Record<string, Record<string, string[]>> };
const headingsOf = (text: string, re: RegExp) => { const out: string[] = []; let fence = false; for (const l of text.split('\n')) { if (/^\s*(```|~~~)/.test(l)) { fence = !fence; continue; } if (!fence && re.test(l)) out.push(l); } return out; };
let changed = 0;
for (const [skill, files] of Object.entries(pinned.skills)) for (const file of Object.keys(files)) {
  const generated = headingsOf(readFileSync(`${skill}/${file}`, 'utf8'), STEP);
  const tmplTop = skill === 'qa-only' ? headingsOf(readFileSync(`${skill}/${file}.tmpl`, 'utf8'), /^## /) : [];
  const next = [...new Set([...tmplTop, ...generated])];
  if (JSON.stringify(next) !== JSON.stringify(files[file])) { files[file] = next; changed++; }
}
writeFileSync(FIX, JSON.stringify(pinned, null, 2) + '\n');
console.log(`[regen-required-steps] ${changed} file entr${changed === 1 ? 'y' : 'ies'} updated`);
