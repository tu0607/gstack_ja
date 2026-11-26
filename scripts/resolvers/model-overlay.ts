/**
 * Model overlay resolver — reads model-overlays/{model}.md and returns it
 * wrapped in a subordinate behavioral-patch section.
 *
 * Precedence:
 *   1. Exact match: ctx.model === 'gpt-5.4' → reads model-overlays/gpt-5.4.md
 *   2. INHERIT directive: if the file's first non-whitespace line is
 *      `{{INHERIT:claude}}`, the resolver reads model-overlays/claude.md first
 *      and concatenates it ahead of the rest of this file's content.
 *      This lets `gpt-5.4.md` build on top of `gpt.md` without duplication.
 *   3. Missing file: returns empty string (graceful degradation, no error).
 *   4. No ctx.model set: returns empty string.
 *
 * The returned block is subordinate to skill workflow, safety gates, and
 * AskUserQuestion instructions. The subordination language is part of the
 * wrapper heading so it appears with every overlay regardless of file content.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { TemplateContext } from './types';

const OVERLAY_DIR = path.resolve(import.meta.dir, '../../model-overlays');

const INHERIT_RE = /^\s*\{\{INHERIT:([a-z0-9-]+(?:\.[0-9]+)*)\}\}\s*\n/;

export function readOverlay(model: string, seen: Set<string> = new Set()): string {
  if (seen.has(model)) return ''; // cycle guard
  seen.add(model);

  const filePath = path.join(OVERLAY_DIR, `${model}.md`);
  if (!fs.existsSync(filePath)) return '';

  const raw = fs.readFileSync(filePath, 'utf-8');
  const match = raw.match(INHERIT_RE);
  if (!match) return raw.trim();

  const baseModel = match[1];
  const base = readOverlay(baseModel, seen);
  const rest = raw.replace(INHERIT_RE, '').trim();

  if (!base) return rest;
  return `${base}\n\n${rest}`;
}

export function generateModelOverlay(ctx: TemplateContext): string {
  if (!ctx.model) return '';

  const content = readOverlay(ctx.model);
  if (!content) return '';

  const precedence = ctx.model === 'gpt-5.6-sol'
    ? `以下の指示は、${ctx.model} モデルにおけるスコープの曖昧さを解消します。
これらは、あいまいな「完全さ」を表す語、たとえば \`complete\`, \`full\`, \`every\`,
\`exhaustive\`、\`100%\`、および \`Boil the Ocean\` と、ユーザーが求めていない
作業の反復をいつ止めるかを規定します。スキルの具体的なワークフロー手順、STOP ポイント、
AskUserQuestion のゲート、プランモードの安全性、必須テスト、スキルが定める
再検証・再レビューのループ、/ship のレビューゲートは、引き続きこの指示より優先されます。
このパッチを、具体的な要件を省略するために使ってはいけません。`
    : `以下のヒントは ${ctx.model} モデルファミリー向けに調整されています。これらは、スキルのワークフロー、
STOP ポイント、AskUserQuestion のゲート、プランモードの安全性、/ship のレビューゲートに
**従属**します。以下のヒントがスキルの指示と矛盾する場合は、スキルが優先されます。
これらはルールではなく、好みとして扱ってください。`;

  return `## Model-Specific Behavioral Patch (${ctx.model})(モデル固有の動作パッチ)

${precedence}

${content}`;
}
