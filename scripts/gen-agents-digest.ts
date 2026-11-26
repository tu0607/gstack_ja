#!/usr/bin/env -S bun --no-env-file --config=/dev/null
/**
 * Generate agents-digest/gstack-AGENTS.md — the instruction-only tier.
 *
 * A ~2KB behavioral digest any rules-reading agent host can load (Zed, Amp,
 * Jules, Cursor side-projects, OpenClaw/Hermes methodology mode): the ETHOS
 * principles as one-liners, the reuse ladder, the voice rules, and a pointer
 * to the full install. It is a COMMITTED generated artifact (like llms.txt)
 * so the setup explainer arms can point at it before any toolchain exists.
 *
 * Delivery is print-path + user-performed copy ONLY — never write or
 * overwrite a user's own AGENTS.md (a gstack-AGENTS.md is auto-read by no
 * host; clobbering AGENTS.md destroys user content on every re-run).
 *
 * One host-neutral file, deliberately: the digest contains no host-specific
 * paths, so per-host copies would be byte-identical duplication (the exact
 * per-host rule-text sprawl gstack's generator model exists to avoid). If a
 * host ever needs rewrites, this generator gains a per-host emit then.
 *
 * Size budget: <= 3,000 bytes (UTF-8, Japanese text; see DIGEST_BYTE_BUDGET), enforced by test/agents-digest.test.ts. Every
 * host that loads this pays for it in every session — trim, don't grow.
 *
 * Refresh: invoked from scripts/gen-skill-docs.ts after SKILL.md generation.
 */

import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(import.meta.dir, '..');
// Repo-relative with FORWARD slashes on every platform: this constant is
// compared against literals in shell scripts, host configs, and docs (the
// wiring test), where a Windows path.join backslash form would never match.
// path.join(root, DIGEST_RELPATH) at the write site normalizes it fine.
export const DIGEST_RELPATH = 'agents-digest/gstack-AGENTS.md';
// Budget history: 2,048 bytes for the English digest. The Japanese text measures
// 2,609 UTF-8 bytes (Japanese characters take 3 bytes each, so the same content is
// larger on disk although it is shorter in characters); the budget is that measure
// plus ~15% headroom, rounded to 3,000. The always-on cost is unchanged in spirit.
export const DIGEST_BYTE_BUDGET = 3000;

export function generateAgentsDigest(opts?: { root?: string }): { content: string; bytes: number } {
  const root = opts?.root ?? ROOT;
  const version = fs.readFileSync(path.join(root, 'VERSION'), 'utf-8').trim();

  const content = `# gstack ダイジェスト v${version} — gstack をアップグレードしたら再生成して、もう一度コピーしてください

gstack (https://github.com/garrytan/gstack) の行動ルールを、フルのスキルを
インストールしていないエージェントホスト向けに圧縮したものです。フルのスキルは、
これらのルールの上にワークフロー、レビュー、eval を加えます。

## 行動原則

- **Boil the Ocean** — AI は完全さを安くします。だから完全なものを作ります: テスト、エッジケース、エラー経路。近道には、明示的で記録された判断が必要です。
- **Search Before Building** — 作るかどうか決める前に、すでにあるものを知ります。作り直さない(実績のある定番)、人気のものは吟味する、第一原理の洞察を何より重んじる。
- **User Sovereignty** — モデルは提案し、決めるのはユーザーです。複数モデルの一致はシグナルであって、許可ではありません。ユーザーが示した方向を変える前には尋ねます。
- **Build for Yourself** — 実在する問題の具体性は、仮定の問題の一般性に勝ります。

## 再利用のはしご

新しいコードを書く前に、最初に成り立つ段で止まってください:
1. このリポジトリにすでにあるヘルパー、ユーティリティ、パターン。
2. 標準ライブラリ。
3. プラットフォームのネイティブ機能(JS より CSS、アプリコードより DB 制約)。
4. インストール済みの依存関係。数行で済むことのために、新しい依存を追加しないこと。

そのうえで、残った部分の完全版を作ります。バグ修正は症状ではなく根本原因に
当てます。すべての呼び出し側にガードを入れるより、共有関数に 1 つ入れるほうが優れています。

## 文体

直接的で具体的に、作り手から作り手へ。ファイル、関数、コマンド、ユーザーに見える
影響を名指しします。段落は短く、最後は次にすることで締めます。前置き、堅苦しい口調、
AI 特有の言い回しは不要です。

## gstack の全体

https://github.com/garrytan/gstack をクローンし、\`./setup\` を実行すると、フルの
スキル一式(レビュー、ship、QA、eval)が入ります。このダイジェストは生成物です。
このファイルではなく scripts/gen-agents-digest.ts を編集してください。
`;

  return { content, bytes: Buffer.byteLength(content, 'utf-8') };
}

export function writeAgentsDigest(opts?: { root?: string; outRoot?: string }): { outPath: string; bytes: number } {
  const root = opts?.root ?? ROOT;
  const { content, bytes } = generateAgentsDigest({ root });
  // outRoot: outputs-only rule for --out-dir renders — inputs (VERSION) read
  // from root, the artifact lands wherever the caller isolates outputs.
  const outPath = path.join(opts?.outRoot ?? root, DIGEST_RELPATH);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, content);
  return { outPath, bytes };
}

if (import.meta.main) {
  const { outPath, bytes } = writeAgentsDigest();
  console.log(`[gen-agents-digest] ${path.relative(ROOT, outPath)}: ${bytes} bytes (budget ${DIGEST_BYTE_BUDGET})`);
}
