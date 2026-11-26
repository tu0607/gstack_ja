/**
 * Section resolvers (v2 plan T9, Claude-first carve).
 *
 * A carved skill keeps its prose-heavy steps in `<skill>/sections/<id>.md`, read
 * on demand. The SAME template ships to every host, so these resolvers make the
 * carve host-aware:
 *
 *  - On CLAUDE and for QA on every host: {{SECTION:id}} emits a STOP-Read pointer to the generated section
 *    file (the skeleton), and the section .md is generated + installed separately.
 *  - Other skills on external hosts: {{SECTION:id}} INLINES the section template's content,
 *    so external hosts keep the full monolith ship skill (no section files, no
 *    host-portable-path problem). Inlined content keeps its own {{RESOLVER}}
 *    tokens, which the generator's multi-pass resolve expands.
 *
 * {{SECTION_INDEX:skill}} renders the situation→section table from the PASSIVE
 * manifest for lazy skills (empty for inlined skills). The manifest
 * is the single source of id/file/title/trigger text (CM2; v2_PLAN.md:663).
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Host, ResolverFn, TemplateContext } from './types';

const ROOT = path.resolve(import.meta.dir, '..', '..');

export const QA_ASSET_BLOCKER = '見つからない、または読み取れない場合は、QA のセットアップブロッカーを報告し、影響を受けるプローブを blocked として扱います。ほかの安全なプローブ(独立した機能/静的チェック)は続行します。見つからない/読み取れないアセットは、必須の QA をブロックします。';

/** Skills carved on every host: QA (portable assets) and those whose external
 * render would exceed SKILL_BYTE_CEILING inlined (C4, #2777). */
const CARVED_ON_EVERY_HOST = ['qa', 'qa-only', 'ship', 'plan-ceo-review', 'office-hours'];

/** Hosts read at most this many UTF-8 bytes of one SKILL.md (~40K tokens).
 * 日本語版は UTF-8 で 1 文字 3 バイトになるため、英語版の 160_000 から引き上げている
 * (トークン数はほぼ同等)。 */
export const SKILL_BYTE_CEILING = 260_000;

export function usesLazySections(host: Host, skill: string): boolean {
  return host === 'claude' || CARVED_ON_EVERY_HOST.includes(skill);
}

/**
 * External hosts: a template's literal `~/.claude/skills/gstack/<skill>/sections/<file>`
 * reference arrives here as `$GSTACK_ROOT/...` or `~/<globalRoot>/...`, and external
 * runtime roots have no section trees. For a carved skill, point it at the installed copy;
 * for this skill's own section inlined by {{SECTION}}, point at the inlined text.
 */
export function rewriteCarvedSectionRefs(content: string, ctx: TemplateContext): string {
  if (ctx.host === 'claude') return content;
  // The root arrives as $GSTACK_ROOT or as the host's literal ~/<globalRoot> (path rewrites).
  return content.replace(/`(?:\$GSTACK_ROOT|~\/[\w./-]*?skills\/gstack)\/([a-z0-9-]+)\/sections\/([A-Za-z0-9._-]+)`/g, (match, skill: string, file: string) => {
    if (!fs.existsSync(path.join(ROOT, skill, 'sections', `${file}.tmpl`))) return match;
    if (usesLazySections(ctx.host, skill)) return `\`sections/${file}\` relative to the installed \`gstack-${skill}\` SKILL.md directory`;
    const entry = loadManifest(skill).sections.find(e => e.file === file);
    const inlined = skill === ctx.skillName && entry && fs.readFileSync(path.join(ROOT, skill, 'SKILL.md.tmpl'), 'utf-8').includes(`{{SECTION:${entry.id}}}`);
    return inlined ? `the \`${file.replace(/\.md$/, '')}\` section inlined in this SKILL.md` : match;
  });
}

interface SectionEntry {
  id: string;
  file: string;
  title: string;
  trigger: string;
  /** Plan B4: read by bin/gstack-autoplan alone; interactive renders ignore it. Default `always`. */
  scope?: 'always' | 'ui' | 'dx' | 'db' | 'perf' | 'security' | 'incident';
  /** Plan B4: a runner-profile section (the checklist) stays out of the Section index. */
  runner_only?: boolean;
}
interface SectionManifest {
  skill: string;
  sections: SectionEntry[];
}

function loadManifest(skill: string): SectionManifest {
  const p = path.join(ROOT, skill, 'sections', 'manifest.json');
  const raw = fs.readFileSync(p, 'utf-8');
  return JSON.parse(raw) as SectionManifest;
}

function findSection(skill: string, id: string): SectionEntry {
  const entry = loadManifest(skill).sections.find(s => s.id === id);
  if (!entry) {
    throw new Error(`{{SECTION:${id}}} — no section "${id}" in ${skill}/sections/manifest.json`);
  }
  return entry;
}

/**
 * Pointer to a carved section file. Claude keeps its global-root path; QA and
 * every external host point relative to the installed skill directory, because
 * external runtime roots (`$GSTACK_ROOT`) carry no `<skill>/sections/` tree
 * while setup links or copies whole skill directories.
 */
export function sectionPath(ctx: TemplateContext, skill: string, id: string): string {
  const entry = findSection(skill, id);
  if (ctx.host !== 'claude' || skill === 'qa' || skill === 'qa-only') {
    fs.accessSync(path.join(ROOT, skill, 'sections', `${entry.file}.tmpl`), fs.constants.R_OK);
    const installedName = ctx.host === 'claude' ? `\`${skill}\`/\`gstack-${skill}\`` : `\`${skill.startsWith('gstack-') ? skill : `gstack-${skill}`}\``;
    return `\`sections/${entry.file}\` relative to the installed ${installedName} SKILL.md directory`;
  }
  return `\`${ctx.paths.skillRoot}/${skill}/sections/${entry.file}\``;
}

/**
 * {{SECTION:id}} — installed-file pointer for QA; otherwise Claude pointers
 * and external inline content retain their existing behavior.
 */
export const SECTION: ResolverFn = (ctx: TemplateContext, args?: string[]): string => {
  const id = args?.[0];
  if (!id) throw new Error('{{SECTION:id}} requires a section id');
  const entry = findSection(ctx.skillName, id);

  if (usesLazySections(ctx.host, ctx.skillName)) {
    if (ctx.skillName === 'qa' || ctx.skillName === 'qa-only') {
      return [
        `> **STOP.** ${entry.trigger}の前に、Read ${sectionPath(ctx, ctx.skillName, id)} を全文読み、その指示に従ってください。`,
        '> このホストのインストール済みパスを使い、プロダクトの作業ディレクトリや別ホストのアセットは決して使わないでください。',
        `> ${QA_ASSET_BLOCKER}`,
      ].join('\n');
    }
    return [
      `> **STOP.** ${entry.trigger}の前に、Read ${sectionPath(ctx, ctx.skillName, id)} を全文読んで実行してください。`,
      `> 記憶から作業しないこと。このステップの正はそのセクションです。`,
    ].join('\n');
  }

  // Non-Claude hosts inline the section template content (monolith preserved).
  // Inner {{RESOLVER}} tokens are expanded by the generator's multi-pass resolve.
  const tmplPath = path.join(ROOT, ctx.skillName, 'sections', `${entry.file}.tmpl`);
  return fs.readFileSync(tmplPath, 'utf-8').trimEnd();
};

/**
 * {{SECTION_INDEX:skill}} — situation→section table from the passive manifest.
 * Lazy skills only; an index would be noise for inlined skills.
 */
export const SECTION_INDEX: ResolverFn = (ctx: TemplateContext, args?: string[]): string => {
  const skill = args?.[0] ?? ctx.skillName;
  if (!usesLazySections(ctx.host, skill)) return '';
  const manifest = loadManifest(skill);
  const lines: string[] = [
    '## Section index — 状況に当てはまるセクションを読む',
    '',
    ...(skill === 'qa' || skill === 'qa-only'
      ? ['指示されたときはセクションを全文 Read し、記憶に頼って進めないでください。']
      : ['このスキルは判断ツリーの骨格です。以下のステップは、必要なときに読むセクションを',
        '指しています。ステップを実行する前にセクションを全文 Read し、記憶に頼って進めないでください。']),
    '',
    '| 状況 | 読むセクション |',
    '|------|-------------------|',
  ];
  for (const s of manifest.sections) {
    if (s.runner_only) continue;
    const reference = skill === 'qa' || skill === 'qa-only' ? sectionPath(ctx, skill, s.id) : `\`sections/${s.file}\``;
    if (skill === 'review' && s.id === 'review-army') {
      lines.push(`| サーフェスの選択と QA 手法の読み込み | [Step 4](#step-4-critical-pass-core-review) にインライン。セットアップとプローブは Step 4.7 で実行 |`);
    }
    lines.push(`| ${s.trigger} | ${reference} |`);
    if (skill === 'ship' && s.id === 'review-army') {
      lines.push(`| Fix-First の前の探索的 QA (Step 9.2.1) | ${reference} の QA Read 指示を使う |`);
    }
  }
  return lines.join('\n');
};
