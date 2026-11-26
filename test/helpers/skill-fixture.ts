/**
 * Skill fixture extraction — enforces the CLAUDE.md rule "E2E test fixtures:
 * extract, don't copy".
 *
 * Full SKILL.md files are 1000-1900 lines. When `claude -p` (or `codex exec`)
 * reads a file that large, context bloat causes timeouts, flaky turn limits,
 * and tests that take 5-10x longer than necessary. Every E2E fixture that
 * needs skill content should extract ONLY the sections the test actually
 * exercises, through one of the three helpers here:
 *
 *   - extractSkillSections(skillDir, sections)
 *       frontmatter + the named `## <section>` blocks, concatenated in the
 *       order given. For tests that exercise specific workflow steps.
 *   - extractSkillBody(skillDir)
 *       frontmatter + intro + everything AFTER the shared generated preamble
 *       ("## Preamble (run first)" or "## Preamble (after scope gate)"
 *       .. end of "## Plan Status Footer").
 *       For tests that exercise the skill's ENTIRE specific flow but never
 *       touch the ~780-line shared preamble.
 *   - extractSkillHead(skillDir, bodyLineCount)
 *       frontmatter + the first N body lines. For ROUTING / discovery tests,
 *       where the agent only reads the frontmatter (name + description) to
 *       decide which skill to invoke.
 *
 * Failure polarity: every extraction failure (missing file, missing
 * frontmatter, renamed section) THROWS with the offending name — a fixture is
 * never silently written empty. test/skill-fixture.test.ts pins the exported
 * section lists against the real generated SKILL.md files, so a section
 * rename fails the FREE suite instead of a paid E2E run.
 */

import * as fs from 'fs';
import * as path from 'path';

// ─── Section lists shared by E2E fixtures and the free pin test ────────────
// Keep these verbatim against the H2 headings in the generated SKILL.md files.
// If gen-skill-docs renames a heading, test/skill-fixture.test.ts fails free.

/** /review E2E (sql-injection, enum-completeness, design-lite): the core
 *  review workflow without the shared preamble, Review Army, or Fix-First. */
export const REVIEW_E2E_SECTIONS = [
  'Step 0: プラットフォームとベースブランチを検出する',
  'Step 1: ブランチの確認',
  'Step 2: チェックリストの読み込み',
  'Step 2.5: Greptile のレビューコメントの確認',
  'Step 3: 差分の取得',
  'Step 4: 重大な問題のパス',
  'Confidence Calibration',
  '重要なルール',
];

/** Review Army E2E: core workflow + Scope Drift / Plan Completion Audit
 *  (delivery-audit test) + Step 4.5 specialist dispatch (quality score,
 *  JSON findings schema, MULTI-SPECIALIST consensus, Red Team). */
export const REVIEW_ARMY_E2E_SECTIONS = [
  'Step 0: プラットフォームとベースブランチを検出する',
  'Step 1: ブランチの確認',
  'Step 1.5: Scope Drift Detection',
  'Step 2: チェックリストの読み込み',
  'Step 2.5: Greptile のレビューコメントの確認',
  'Step 3: 差分の取得',
  'Step 4: 重大な問題のパス',
  'Confidence Calibration',
  'Step 4.5: Review Army — Specialist Dispatch',
  '重要なルール',
];

/** /retro E2E (retro, retro-base-branch): the repo-scoped retro flow
 *  (Steps 0-14 live under Instructions/Prior Learnings/Capture Learnings)
 *  + the narrative report template. Global mode and Compare mode are not
 *  exercised by the E2E tests and are dropped. */
export const RETRO_E2E_SECTIONS = [
  'Step 0: プラットフォームとベースブランチを検出する',
  'ユーザー呼び出し',
  '引数',
  '手順',
  'Prior Learnings',
  'Capture Learnings',
  'エンジニアリング振り返り: [日付範囲]',
  'Tone',
  'Important Rules',
];

/** codex-review-findings E2E against the Codex host variant
 *  (.agents/skills/gstack-review/SKILL.md). Same core workflow as
 *  REVIEW_E2E_SECTIONS. */
export const CODEX_REVIEW_E2E_SECTIONS = [
  'Step 0: プラットフォームとベースブランチを検出する',
  'Step 1: ブランチの確認',
  'Step 2: チェックリストの読み込み',
  'Step 3: 差分の取得',
  'Step 4: 重大な問題のパス',
  'Confidence Calibration',
  '重要なルール',
];

// ─── Parsing internals ──────────────────────────────────────────────────────

/** First/last H2 headings of the shared preamble block that gen-skill-docs
 *  emits into every tier >= 2 skill. extractSkillBody drops this range. */
// 日本語版は英語トークンの直後に全角括弧の日本語を続ける(合成フィクスチャは英語のまま)。両方を受理する。
const SHARED_PREAMBLE_FIRST = ['Preamble (run first)', 'Preamble (after scope gate)', 'Preamble (run first)(プリアンブル。最初に実行)', 'Preamble (after scope gate)(プリアンブル。スコープゲートの後)'];
const SHARED_PREAMBLE_LAST = 'Plan Status Footer';
const SHARED_PREAMBLE_LAST_NAMES = [SHARED_PREAMBLE_LAST, 'Plan Status Footer(プランの状態のフッター)'];

interface H2Section {
  heading: string;
  /** index of the heading line within bodyLines */
  start: number;
  /** one past the last line of the section (start of next H2, or EOF) */
  end: number;
}

/** Accept either a skill directory or a direct path to a .md file. */
function resolveSkillMd(skillDirOrFile: string): string {
  const file = skillDirOrFile.endsWith('.md')
    ? skillDirOrFile
    : path.join(skillDirOrFile, 'SKILL.md');
  if (!fs.existsSync(file)) {
    throw new Error(`skill-fixture: no SKILL.md at ${file}`);
  }
  return file;
}

function splitFrontmatter(raw: string, file: string): { frontmatter: string; bodyLines: string[] } {
  const lines = raw.split('\n');
  if ((lines[0] ?? '').trim() !== '---') {
    throw new Error(`skill-fixture: ${file} does not start with YAML frontmatter ('---')`);
  }
  let close = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { close = i; break; }
  }
  if (close === -1) {
    throw new Error(`skill-fixture: ${file} frontmatter never closes ('---' missing)`);
  }
  return {
    frontmatter: lines.slice(0, close + 1).join('\n'),
    bodyLines: lines.slice(close + 1),
  };
}

/**
 * Scan body lines for H2 sections, fence-aware: `## `-prefixed lines inside
 * ``` / ~~~ code fences are template content (e.g. the PLAN COMPLETION AUDIT
 * output format, the /context-save checkpoint template), NOT section
 * boundaries. Fences close only on a matching char of >= opening length,
 * per CommonMark, so 4-backtick fences embedding 3-backtick blocks work.
 * Standalone generated STOP-Read blocks between horizontal rules replace
 * entire carved steps and end the preceding H2. Nested pointers stay inside it.
 */
function scanH2Sections(bodyLines: string[], stopAtH1 = false): H2Section[] {
  const sections: H2Section[] = [];
  let fence: { ch: string; len: number } | null = null;

  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    const m = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (m) {
      const ch = m[1][0];
      const len = m[1].length;
      if (!fence) {
        fence = { ch, len };
      } else if (fence.ch === ch && len >= fence.len && m[2].trim() === '') {
        fence = null;
      }
      continue;
    }
    if (!fence) {
      const heading = line.startsWith('## ');
      const title = stopAtH1 && /^ {0,3}#(?:[ \t]|$)/.test(line);
      let carvedStep = /^> \*\*STOP\.\*\* .+の前に、Read `[^`]+\/sections\/[^`]+\.md` を全文読んで実行してください。$/.test(line)
        && bodyLines[i + 1] === '> 記憶から作業しないこと。このステップの正はそのセクションです。';
      if (carvedStep) {
        let preceding = i - 1;
        while (preceding >= 0 && !bodyLines[preceding].trim()) preceding--;
        let following = i + 2;
        while (following < bodyLines.length && !bodyLines[following].trim()) following++;
        carvedStep = bodyLines[preceding] === '---' && bodyLines[following] === '---';
      }
      if (heading || title || carvedStep) {
        const previous = sections.at(-1);
        if (previous) previous.end = Math.min(previous.end, i);
        if (heading) sections.push({ heading: line.slice(3).trim(), start: i, end: bodyLines.length });
      }
    }
  }
  return sections;
}

function loadSkill(skillDirOrFile: string, stopAtH1 = false): {
  file: string;
  frontmatter: string;
  bodyLines: string[];
  sections: H2Section[];
} {
  const file = resolveSkillMd(skillDirOrFile);
  const raw = fs.readFileSync(file, 'utf-8');
  const { frontmatter, bodyLines } = splitFrontmatter(raw, file);
  return { file, frontmatter, bodyLines, sections: scanH2Sections(bodyLines, stopAtH1) };
}

function findSection(sections: H2Section[], name: string, file: string): H2Section {
  const hit = sections.find((s) => s.heading === name)
    ?? sections.find((s) => s.heading.startsWith(name));
  if (!hit) {
    const available = sections.map((s) => `  ## ${s.heading}`).join('\n');
    throw new Error(
      `skill-fixture: section "## ${name}" not found in ${file}.\n`
      + 'The section may have been renamed — update the fixture section list '
      + '(see test/helpers/skill-fixture.ts).\n'
      + `Available H2 sections:\n${available}`,
    );
  }
  return hit;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Read the real SKILL.md under `skillDir` (or a direct .md path), slice each
 * requested `## <section>` block, and return frontmatter + the sections
 * concatenated in the order given. Throws loudly on a missing section.
 */
export function extractSkillSections(skillDir: string, sections: string[]): string {
  const { file, frontmatter, bodyLines, sections: all } = loadSkill(skillDir);
  const parts: string[] = [frontmatter, ''];
  for (const name of sections) {
    const hit = findSection(all, name, file);
    parts.push(bodyLines.slice(hit.start, hit.end).join('\n').trimEnd(), '');
  }
  return parts.join('\n');
}

/**
 * Frontmatter + intro/scope gate (everything before either exact preamble heading) + the
 * full skill-specific body (everything after the "## Plan Status Footer"
 * section). Use when a test exercises the whole skill flow: this drops the
 * ~780-line shared generated preamble and nothing else.
 */
export function extractSkillBody(skillDir: string): string {
  const { file, frontmatter, bodyLines, sections: all } = loadSkill(skillDir, true);
  const boundary = (names: string[]): H2Section => {
    const matches = all.filter(section => names.includes(section.heading));
    const label = names.map(name => `"## ${name}"`).join(' or ');
    if (!matches.length) throw new Error(`skill-fixture: section ${label} not found in ${file}.`);
    if (matches.length !== 1) throw new Error(`skill-fixture: ambiguous section ${label} in ${file}.`);
    return matches[0];
  };
  const first = boundary(SHARED_PREAMBLE_FIRST);
  const last = boundary(SHARED_PREAMBLE_LAST_NAMES);
  if (first.start >= last.start) {
    throw new Error(`skill-fixture: "## ${SHARED_PREAMBLE_LAST}" precedes the preamble in ${file}.`);
  }
  const intro = bodyLines.slice(0, first.start).join('\n').trimEnd();
  const tail = bodyLines.slice(last.end).join('\n').trimEnd();
  if (!tail) {
    throw new Error(
      `skill-fixture: ${file} has no content after "## ${SHARED_PREAMBLE_LAST}" — `
      + 'refusing to write a preamble-only fixture.',
    );
  }
  return [frontmatter, '', intro, '', tail, ''].join('\n');
}

/**
 * Frontmatter + the first `bodyLineCount` body lines. For routing/discovery
 * fixtures: skill selection reads the frontmatter name + description, so the
 * body is intentionally truncated.
 */
export function extractSkillHead(skillDir: string, bodyLineCount = 30): string {
  const { frontmatter, bodyLines } = loadSkill(skillDir);
  const head = bodyLines.slice(0, bodyLineCount).join('\n').trimEnd();
  return `${frontmatter}\n${head}\n\n<!-- body truncated by test/helpers/skill-fixture.ts — routing fixture needs frontmatter only -->\n`;
}

/**
 * Slice a rendered skill between two literal markers. Both must exist: a
 * missing END marker would silently hand the agent the rest of the file, which
 * is exactly the "copied the whole SKILL.md" failure the E2E fixtures avoid.
 */
export function sliceBetween(text: string, start: string, end: string): string {
  const i = text.indexOf(start);
  if (i < 0) throw new Error(`skill fixture: start marker not found: ${start}`);
  const j = text.indexOf(end, i + start.length);
  if (j < 0) throw new Error(`skill fixture: end marker not found after start: ${end}`);
  return text.slice(i, j);
}

export function extractDesignResearchContract(skill: string): string {
  // English headings first; the Japanese fork renders the same sections under translated headings.
  const pick = (text: string, ...markers: string[]): string => markers.find(m => text.includes(m)) ?? markers[0]!;
  const setup = sliceBetween(skill, '## BROWSER SETUP', pick(skill, '### Rules for driving a real browser', '### 実際のブラウザを操作するためのルール'));
  const probe = setup.match(/```bash\n[\s\S]*?\n```/)?.[0];
  if (!probe) throw new Error('skill fixture: design research readiness probe missing');
  const routing = sliceBetween(skill, '## Web research runs in Aside', pick(skill, '## Phase 2: Research', '## Phase 2: 調査'));
  const search = sliceBetween(skill, pick(skill, '**Step 1: Identify', '**Step 1: Aside で'), pick(skill, '**Step 2: Visual research', '**Step 2: 視覚的な調査'));
  const prelude = search.match(/^_EG=.*_aside_exec\(\).*$/m)?.[0];
  if (!prelude) throw new Error('skill fixture: design research egress prelude missing');
  return ['Run this readiness probe once before research:', probe, routing,
    'For each Aside research call, include this prelude before invoking `_aside_exec` with the requested query:',
    '```bash', prelude, '```'].join('\n\n');
}
