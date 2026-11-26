import { describe, test, expect, afterAll } from 'bun:test';
import { assertSinglePreamble } from '../scripts/gen-skill-docs';
import { validateSkillFrontmatter } from '../scripts/skill-check';
import { externalHostPathLeaks } from './helpers/skill-parser';
import { COMMAND_DESCRIPTIONS } from '../browse/src/commands';
import { SNAPSHOT_FLAGS } from '../browse/src/snapshot';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawnSync } from 'child_process';
import { runCapturedCommand } from './helpers/sync-command-capture';
import { between, compact, expectAbsent, expectMentions, expectOrdered, expectTokens } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const MAX_SKILL_DESCRIPTION_LENGTH = 1024;

// Carved-skill aware (v2 plan T9): ship is now a skeleton SKILL.md + sections/*.md.
// Read the union so assertions about content that MOVED into a section still pass.
// The skeleton is a subset of the union, so skeleton-only assertions also hold,
// and negative assertions stay safe (the absent phrases live in neither file).
function readSkillUnion(skill: string): string {
  let t = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
  const secDir = path.join(ROOT, skill, 'sections');
  if (fs.existsSync(secDir)) {
    for (const f of fs.readdirSync(secDir).sort()) {
      if (f.endsWith('.md')) t += '\n' + fs.readFileSync(path.join(secDir, f), 'utf-8');
    }
  }
  return t;
}
function readShipUnion(): string {
  return readSkillUnion('ship');
}

function ordered(text: string, anchors: string[]): void {
  const positions = anchors.map(anchor => text.indexOf(anchor));
  expect(positions.every(position => position >= 0), `missing one of ${JSON.stringify(anchors)}`).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
}

function readExternalSkillUnion(output: string, hostSubdir: string, skill: string): string {
  const dir = path.join(output, hostSubdir, 'skills', `gstack-${skill}`);
  const sections = path.join(dir, 'sections');
  return fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf-8')
    + (fs.existsSync(sections) ? fs.readdirSync(sections).sort()
      .filter(file => file.endsWith('.md'))
      .map(file => '\n' + fs.readFileSync(path.join(sections, file), 'utf-8')).join('') : '');
}


// Token-reduction Phase 1: the preamble's inline bash (session bookkeeping,
// config echoes, telemetry producers, artifacts sync) moved into
// bin/gstack-skill-start / bin/gstack-skill-end. The render carries a one-line
// invocation fence + interpretation prose. Assertions that pinned inline-bash
// internals now pin the scripts (the new home); render-side assertions pin the
// fence + prose. Script behavior is pinned by test/gstack-skill-start.test.ts.
const SKILL_START_SCRIPT = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-start'), 'utf-8');
const SKILL_END_SCRIPT = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-end'), 'utf-8');

function extractDescription(content: string): string {
  const fmEnd = content.indexOf('\n---', 4);
  expect(fmEnd).toBeGreaterThan(0);
  const frontmatter = content.slice(4, fmEnd);
  const lines = frontmatter.split('\n');
  let description = '';
  let inDescription = false;
  const descLines: string[] = [];

  for (const line of lines) {
    if (line.match(/^description:\s*\|?\s*$/)) {
      inDescription = true;
      continue;
    }
    if (line.match(/^description:\s*\S/)) {
      return line.replace(/^description:\s*/, '').trim();
    }
    if (inDescription) {
      if (line === '' || line.match(/^\s/)) {
        descLines.push(line.replace(/^  /, ''));
      } else {
        break;
      }
    }
  }

  if (descLines.length > 0) {
    description = descLines.join('\n').trim();
  }
  return description;
}

function extractMarkdownSection(content: string, heading: string): string {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startMatch = content.match(new RegExp(`^${escaped}.*$`, 'm'));
  expect(startMatch?.index).toBeDefined();
  const start = startMatch!.index!;
  const afterHeading = start + startMatch![0].length;
  const nextSection = content.slice(afterHeading).match(/\n## /);
  const end = nextSection?.index === undefined
    ? content.length
    : afterHeading + nextSection.index;
  return content.slice(start, end).trim();
}

function extractPreambleBeforeWorkflow(content: string, workflowMarkers: string[]): string {
  const markerIndexes = workflowMarkers
    .map(marker => content.indexOf(marker))
    .filter(index => index >= 0);
  expect(markerIndexes.length).toBeGreaterThan(0);
  return content.slice(0, Math.min(...markerIndexes));
}

function isRepoRootSymlink(candidateDir: string): boolean {
  try {
    return fs.realpathSync(candidateDir) === fs.realpathSync(ROOT);
  } catch {
    return false;
  }
}

// Dynamic template discovery — matches the generator's findTemplates() behavior.
// New skills automatically get test coverage without updating a static list.
const ALL_SKILLS = (() => {
  const skills: Array<{ dir: string; name: string }> = [];
  if (fs.existsSync(path.join(ROOT, 'SKILL.md.tmpl'))) {
    skills.push({ dir: '.', name: 'root gstack' });
  }
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    if (fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) {
      skills.push({ dir: entry.name, name: entry.name });
    }
  }
  return skills;
})();

// The claude host deliberately skips some skills (skipSkills — e.g. the
// /claude-code outside-voice skill exists only for non-Claude hosts), so those
// dirs have a SKILL.md.tmpl but no generated claude-host SKILL.md on a fresh
// checkout. Every generated-file assertion must exclude them or it is red on
// every clean clone (it was, invisibly, until the free suite ran in CI).
import { getHostConfig as __getHostConfig } from '../hosts/index';
const CLAUDE_SKIPPED = new Set(__getHostConfig('claude').generation.skipSkills ?? []);
const CLAUDE_GENERATED_SKILLS = ALL_SKILLS.filter(s => !CLAUDE_SKIPPED.has(s.dir));

// ─── Out-dir render isolation ────────────────────────────────
// Every generator invocation in this file that used to regenerate the live
// tree (the gitignored .agents/.factory/... host dirs included) now renders
// into this module-level out-dir: ONE `--host all` render covers the claude
// host plus every external host, and all golden-artifact reads plus the
// per-host `--dry-run` determinism checks point here. The tracked tree is
// only ever READ (the `generated files are fresh` dry-run deliberately
// compares against the committed files — that is a read, not a write).
// Out-dir renders of external hosts are byte-identical to in-place renders
// (pinned by test/gen-skill-docs-out-dir.test.ts).
const EXTERNAL_OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-gen-docs-out-'));
{
  const render = Bun.spawnSync(
    ['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'all', '--out-dir', EXTERNAL_OUT],
    { cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 },
  );
  if (render.exitCode !== 0) {
    throw new Error(
      `gen-skill-docs --host all --out-dir failed (exit ${render.exitCode}):\n${render.stderr.toString()}`,
    );
  }
}
afterAll(() => {
  fs.rmSync(EXTERNAL_OUT, { recursive: true, force: true });
});

describe('gen-skill-docs', () => {
  // Browse carve (token-reduction Phase 4): the command reference + snapshot
  // flags render into browse/sections/command-list.md now — read the
  // skeleton+sections union so these pins hold across the carve.
  test('generated SKILL.md contains all command categories', () => {
    const content = readSkillUnion('browse');
    const categories = new Set(Object.values(COMMAND_DESCRIPTIONS).map(d => d.category));
    for (const cat of categories) {
      expect(content).toContain(`### ${cat}`);
    }
  });

  test('generated SKILL.md contains all commands', () => {
    const content = readSkillUnion('browse');
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      const display = meta.usage || cmd;
      expect(content).toContain(display);
    }
  });

  test('command table is sorted alphabetically within categories', () => {
    const content = readSkillUnion('browse');
    // Extract command names from the Navigation section as a test
    const navSection = content.match(/### Navigation\n\|.*\n\|.*\n([\s\S]*?)(?=\n###|\n## )/);
    expect(navSection).not.toBeNull();
    const rows = navSection![1].trim().split('\n');
    const commands = rows.map(r => {
      const match = r.match(/\| `(\w+)/);
      return match ? match[1] : '';
    }).filter(Boolean);
    const sorted = [...commands].sort();
    expect(commands).toEqual(sorted);
  });

  test('snapshot flags section contains all flags', () => {
    const content = readSkillUnion('browse');
    for (const flag of SNAPSHOT_FLAGS) {
      expect(content).toContain(flag.short);
      expect(content).toContain(flag.description);
    }
  });

  test('every skill has a SKILL.md.tmpl template', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = path.join(ROOT, skill.dir, 'SKILL.md.tmpl');
      expect(fs.existsSync(tmplPath)).toBe(true);
    }
  });

  test('every skill has a generated SKILL.md with auto-generated header', () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const mdPath = path.join(ROOT, skill.dir, 'SKILL.md');
      expect(fs.existsSync(mdPath)).toBe(true);
      const content = fs.readFileSync(mdPath, 'utf-8');
      expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
      expect(content).toContain('Regenerate: bun run gen:skill-docs');
    }
  });

  // #1778: strict YAML parsers (Codex/OpenAI skill loading) reject frontmatter
  // whose plain `description:` scalar contains an interior ": " (read as a nested
  // mapping). Parse EVERY generated frontmatter block with a strict YAML parser,
  // not just string-check that name:/description: exist.
  test('every generated SKILL.md frontmatter parses as strict YAML', () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      expect(validateSkillFrontmatter(content),
        `frontmatter for ${skill.dir} must be valid YAML with string name/description`).toEqual([]);
    }
  });

  test('every generated Codex (.agents/skills) frontmatter parses as strict YAML', () => {
    // Reads the module-level out-dir render (guaranteed present — the render
    // throws at module load if it fails), never the live gitignored tree.
    const agentsDir = path.join(EXTERNAL_OUT, '.agents', 'skills');
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const mdPath = path.join(agentsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(mdPath)) continue;
      expect(validateSkillFrontmatter(fs.readFileSync(mdPath, 'utf-8')),
        `Codex frontmatter for ${entry.name} must be valid YAML with string name/description`).toEqual([]);
    }
  });

  test(`every generated SKILL.md description stays within ${MAX_SKILL_DESCRIPTION_LENGTH} chars`, () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      const description = extractDescription(content);
      expect(description.length).toBeLessThanOrEqual(MAX_SKILL_DESCRIPTION_LENGTH);
    }
  });

  test(`every Codex SKILL.md description stays within ${MAX_SKILL_DESCRIPTION_LENGTH} chars`, () => {
    const agentsDir = path.join(EXTERNAL_OUT, '.agents', 'skills');
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      const description = extractDescription(content);
      expect(description.length).toBeLessThanOrEqual(MAX_SKILL_DESCRIPTION_LENGTH);
    }
  });

  test('every Codex SKILL.md description stays under 900-char warning threshold', () => {
    const WARN_THRESHOLD = 900;
    const agentsDir = path.join(EXTERNAL_OUT, '.agents', 'skills');
    const violations: string[] = [];
    for (const entry of fs.readdirSync(agentsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(agentsDir, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      const description = extractDescription(content);
      if (description.length > WARN_THRESHOLD) {
        violations.push(`${entry.name}: ${description.length} chars (limit ${MAX_SKILL_DESCRIPTION_LENGTH}, ${MAX_SKILL_DESCRIPTION_LENGTH - description.length} remaining)`);
      }
    }
    expect(violations).toEqual([]);
  });

  test('package.json version matches VERSION file (npm-valid translation)', () => {
    // Decision 11 (v1.67 wave): VERSION stays the 4-digit source of truth;
    // package.json carries the npm-valid 3-digit translation (npm rejects a
    // fourth component). The pre-v1.67 1:1 four-digit mirror is also accepted
    // (grandfathered until the next write), matching gstack-version-bump's
    // own drift contract.
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
    const version = fs.readFileSync(path.join(ROOT, 'VERSION'), 'utf-8').trim();
    const npmTranslation = version.split('.').slice(0, 3).join('.');
    expect([npmTranslation, version]).toContain(pkg.version);
  });

  test('generated files are fresh (match --dry-run)', () => {
    // Deliberately compares against the LIVE TRACKED SKILL.md files (no
    // --out-dir): this is the freshness gate for the committed tree. Dry-run
    // writes nothing — it is a read.
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--dry-run'], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Every skill should be FRESH
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const file = skill.dir === '.' ? 'SKILL.md' : `${skill.dir}/SKILL.md`;
      expect(output).toContain(`FRESH: ${file}`);
    }
    expect(output).not.toContain('STALE');
  });

  test('no generated SKILL.md contains unresolved placeholders', () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      const unresolved = content.match(/\{\{\w+\}\}/g);
      expect(unresolved).toBeNull();
    }
  });

  test('templates contain placeholders', () => {
    // P2 (v1.2.0): the root template is a pure router — only {{PREAMBLE}}.
    // The browse command/snapshot placeholders live in browse/SKILL.md.tmpl now.
    const rootTmpl = fs.readFileSync(path.join(ROOT, 'SKILL.md.tmpl'), 'utf-8');
    expect(rootTmpl).toContain('{{PREAMBLE}}');
    expect(rootTmpl).not.toContain('{{COMMAND_REFERENCE}}');
    expect(rootTmpl).not.toContain('{{SNAPSHOT_FLAGS}}');

    // Browse carve: the reference resolvers moved into the on-demand section
    // template (so gen-skill-docs keeps them fresh from browse/src); the
    // skeleton points at the section instead of inlining the reference.
    const browseTmpl = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md.tmpl'), 'utf-8');
    expect(browseTmpl).not.toContain('{{COMMAND_REFERENCE}}');
    expect(browseTmpl).not.toContain('{{SNAPSHOT_FLAGS}}');
    expect(browseTmpl).toContain('{{SECTION:command-list}}');
    expect(browseTmpl).toContain('{{PREAMBLE}}');

    const browseSectionTmpl = fs.readFileSync(
      path.join(ROOT, 'browse', 'sections', 'command-list.md.tmpl'), 'utf-8');
    expect(browseSectionTmpl).toContain('{{COMMAND_REFERENCE}}');
    expect(browseSectionTmpl).toContain('{{SNAPSHOT_FLAGS}}');

    // Aside is the primary browser: every browsing skill renders the Aside
    // contract ({{ASIDE_SETUP}}); the browse binary is its fallback.
    const qaTmpl = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md.tmpl'), 'utf-8');
    expect(qaTmpl).not.toContain('{{ASIDE_SETUP}}');
    expect(qaTmpl).toContain('{{SECTION:browser-setup}}');
    expect(fs.readFileSync(path.join(ROOT, 'qa/sections/browser-setup.md.tmpl'), 'utf8'))
      .toContain('{{ASIDE_SETUP}}');
    expect(browseTmpl).toContain('{{ASIDE_SETUP}}');
  });

  test('generated SKILL.md contains operational self-improvement (replaced contributor mode)', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('Contributor Mode');
    expect(content).not.toContain('gstack_contributor');
    expect(content).not.toContain('contributor-logs');
    expect(content).toContain('Operational Self-Improvement');
    expect(content).toContain('gstack-learnings-log');
    // The learnings-resurface call moved from the inline preamble bash into
    // the skill-start script (Phase 1) — same command, new home.
    expect(SKILL_START_SCRIPT).toContain('gstack-learnings-search" --limit 3');
  });

  test('generated SKILL.md with LEARNINGS_LOG contains operational type', () => {
    // Check a skill that has LEARNINGS_LOG (e.g., review)
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('operational');
  });

  test('session awareness lives in gstack-skill-start (registry touch + stale cleanup)', () => {
    // The sessions registry moved from inline preamble bash into the script:
    // it records the harness pid (--parent-pid identity) and expires entries
    // older than 120 minutes.
    expect(SKILL_START_SCRIPT).toContain('sessions/$PARENT_PID');
    expect(SKILL_START_SCRIPT).toContain('-mmin +120');
    // The render keeps the completion-status protocol the sessions feed into.
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('RECOMMENDATION');
  });

  test('branch detection lives in gstack-skill-start and is echoed as BRANCH', () => {
    expect(SKILL_START_SCRIPT).toContain('_BRANCH=$(git branch --show-current');
    expect(SKILL_START_SCRIPT).toContain('echo "BRANCH: $_BRANCH"');
  });

  // #2001: update_check: false silences the binary but the upgrade-handling
  // instruction prose used to ship unconditionally. Token-reduction Phase 2
  // made the gate STRUCTURAL: the prose left the renders entirely (absence is
  // pinned by test/onboarding-moved-literals.test.ts) and now emits from
  // gstack-skill-start's instruction layer ONLY when the update-check binary
  // produced output — and that binary silences itself on update_check=false.
  // Opted-out installs can never see the prose, by construction.
  test('update_check opt-out gates the update binary and upgrade-flow emission (issue #2001)', () => {
    // The config-echo cluster lives in gstack-skill-start: the flag is still
    // read and echoed as a STATUS line for the model.
    expect(SKILL_START_SCRIPT, 'script must read update_check config').toContain('_UPDATE_CHECK=$(');
    expect(SKILL_START_SCRIPT, 'script must echo UPDATE_CHECK').toContain('echo "UPDATE_CHECK: $_UPDATE_CHECK"');
    // Gate half 1: the update-check binary exits silently when opted out.
    const updateCheck = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-update-check'), 'utf-8');
    expect(updateCheck, 'binary must read update_check config').toContain('get update_check');
    expect(updateCheck, 'binary must exit silently on update_check=false')
      .toMatch(/if \[ "\$_UC" = "false" \]; then\n\s*exit 0/);
    // Gate half 2: the upgrade-flow instruction block emits only when the
    // binary emitted something (empty when opted out, cached, or up to date).
    expect(SKILL_START_SCRIPT, 'upgrade-flow must be gated on update-check output')
      .toMatch(/if \[ -n "\$_UPD" \]; then\n\s*_emit_block upgrade-flow/);
  });

  test('tier 2+ skills contain ELI10 simplification rules (AskUserQuestion format)', () => {
    // Root SKILL.md is tier 1 and CSO intentionally uses a private startup with
    // no shared PREAMBLE. Check a regular tier 2+ PREAMBLE consumer instead.
    // v1.7.0.0 Pros/Cons format uses "ELI10 (ALWAYS)" rather than "Simplify (ELI10".
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('ELI10');
    expect(content).toContain('平易な言葉');
    expect(content).toContain('関数名ではなく');
  });

  test('tier 1 skills do NOT contain AskUserQuestion format', () => {
    // Use benchmark (tier 1) instead of root — root SKILL.md gets overwritten by Codex test setup
    const content = fs.readFileSync(path.join(ROOT, 'benchmark', 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('## AskUserQuestion Format');
    expect(content).not.toContain('## Completeness Principle');
  });

  test('benchmark routing is scoped to web page performance', () => {
    // The template description is the routing source; the Claude catalog trim
    // drops its tail from benchmark/SKILL.md.
    const template = fs.readFileSync(path.join(ROOT, 'benchmark', 'SKILL.md.tmpl'), 'utf-8');
    const useWhen = template.match(/Use when:[\s\S]*?(?=\n\n|\(gstack\))/)?.[0] ?? '';
    expect(useWhen).toContain('"web performance benchmark"');
    expect(useWhen).not.toMatch(/"benchmark"|"performance"/);
    expect(template).toContain('/benchmark-models');
    const router = fs.readFileSync(path.join(ROOT, 'SKILL.md.tmpl'), 'utf-8');
    expect(router).toMatch(/ウェブパフォーマンス[^\n]*`\/benchmark` を呼び出す/);
    expect(router).toMatch(/モデルやスキルのベンチマーク[^\n]*`\/benchmark-models` を呼び出す/);
  });

  test('telemetry producer lives in the scripts; render documents the analytics sink', () => {
    // The skill-usage.jsonl producers moved into the scripts (Phase 1).
    expect(SKILL_START_SCRIPT).toContain('analytics/skill-usage.jsonl');
    expect(SKILL_END_SCRIPT).toContain('analytics/skill-usage.jsonl');
    // The render still tells the model where telemetry lands.
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('$GSTACK_STATE_ROOT/analytics/');
  });

  test('plan-review generated preambles stay under the Option A budget', () => {
    const reviewSkills = [
      {
        path: path.join(ROOT, 'plan-ceo-review', 'SKILL.md'),
        markers: ['# メガプランレビューモード', '## Step 0: プラットフォームとベースブランチを検出する'],
      },
      {
        path: path.join(ROOT, 'plan-eng-review', 'SKILL.md'),
        markers: ['# プランレビューモード'],
      },
    ];

    // Plan skills carry the same preamble surface as other tier-≥2 skills
    // (Artifacts Sync, Context Recovery, Routing Injection are load-bearing
    // functionality, not optional). Budget is set to current size + small
    // headroom; ratchet down if a future slim trims real bytes.
    // Ratcheted from 33000 → 35000 when the gbrain context-load block was
    // added (per /sync-gbrain plan §4). Ratcheted 35000 → 36500 in v1.27.0.0
    // when generate-brain-sync-block.ts gained the gbrain_mcp_mode probe +
    // remote-mode ARTIFACTS_SYNC status line (Path 4 of /setup-gbrain).
    // Ratcheted 36500 → 39000 in the contributor wave when #1205 added the
    // \\u-escape CJK rule (rule 12 + self-check item) to the AskUserQuestion
    // preamble.
    // Ratcheted 39000 → 40000 in plan-tune cathedral T14: question-tuning
    // resolver gained the <gstack-qid:...> marker convention + the
    // (recommended) label requirement (D2 + D18 — both load-bearing for
    // hook enforcement). Adds ~700 bytes.
    // Ratcheted 40000 → 60000 in v1.52.0.0 cap audit: ~20K headroom so
    // future preamble adds don't trip the gate on each PR. Real runaway
    // (preamble doubling) still trips; normal scope growth doesn't.
    for (const skill of reviewSkills) {
      const content = fs.readFileSync(skill.path, 'utf-8');
      const preamble = extractPreambleBeforeWorkflow(content, skill.markers);
      expect(Buffer.byteLength(preamble, 'utf-8')).toBeLessThan(60_000);
    }
  });

  test('voice and writing-style preamble sections stay compact', () => {
    const content = readSkillUnion('plan-eng-review'); // carved: review body moved to section
    const voice = extractMarkdownSection(content, '## Voice');
    const writingStyle = extractMarkdownSection(content, '## 文体');

    // Japanese text is ~3 bytes/char, so the compactness budget counts characters.
    expect(voice.length).toBeLessThan(3_000);
    expect(writingStyle.length).toBeLessThan(2_000);
  });

  test('slim voice section preserves the gstack voice contract', () => {
    const content = readSkillUnion('plan-eng-review'); // carved: review body moved to section
    const voice = extractMarkdownSection(content, '## Voice');

    expect(voice).toMatch(/要点から始め/);
    expect(voice).toMatch(/ファイル|関数|行番号|コマンド|実際の数値/);
    expect(voice).toMatch(/ユーザーの成果|実際のユーザー/);
    expect(voice).toMatch(/企業文書調|学術調|広報調|誇大表現/);
    expect(voice).toMatch(/AI 特有の語彙|delve|crucial|robust/i);
    expect(voice).toMatch(/決めるのはユーザー|推奨であり、決定ではありません/);
  });

  test('preamble .pending-* glob is zsh-safe (uses find, not shell glob)', () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      if (!content.includes('.pending-')) continue;
      // Must NOT have a bare shell glob ".pending-*" outside of find's -name argument
      expect(content).not.toMatch(/for _PF in [^\n]*\/\.pending-\*/);
      // Must use find to avoid zsh NOMATCH error on glob expansion
      expect(content).toContain("find ~/.gstack/analytics -maxdepth 1 -name '.pending-*'");
    }
  });

  test('bash blocks with shell globs are zsh-safe (setopt guard or find)', () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      const bashBlocks = [...content.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);

      for (const block of bashBlocks) {
        const lines = block.split('\n');

        for (const line of lines) {
          const trimmed = line.trimStart();
          if (trimmed.startsWith('#')) continue;
          if (!trimmed.includes('*')) continue;
          // Skip lines where * is inside find -name, git pathspecs, or $(find)
          if (/\bfind\b/.test(trimmed)) continue;
          if (/\bgit\b/.test(trimmed)) continue;
          if (/\$\(find\b/.test(trimmed)) continue;

          // Check 1: "for VAR in <glob>" must use $(find ...) — caught above by the
          // $(find check, so any surviving for-in with a glob pattern is a violation
          if (/\bfor\s+\w+\s+in\b/.test(trimmed) && /\*\./.test(trimmed)) {
            throw new Error(
              `Unsafe for-in glob in ${skill.dir}/SKILL.md: "${trimmed}". ` +
              `Use \`for f in $(find ... -name '*.ext')\` for zsh compatibility.`
            );
          }

          // Check 2: ls/cat/rm/grep with glob file args must have setopt guard
          const isGlobCmd = /\b(?:ls|cat|rm|grep)\b/.test(trimmed) &&
                            /(?:\/\*[a-z.*]|\*\.[a-z])/.test(trimmed);
          if (isGlobCmd) {
            expect(block).toContain('setopt +o nomatch');
          }
        }
      }
    }
  });

  test('bash blocks never loop over an unquoted variable (zsh does not word-split it)', () => {
    // `for f in $LIST` runs once with the whole list under zsh (no SH_WORD_SPLIT),
    // which is the Bash tool's shell on macOS. Iterate with
    // `printf '%s\n' "$LIST" | while IFS= read -r f` or `$(echo "$LIST")`;
    // zsh still splits an unquoted command substitution.
    const violations: string[] = [];
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = readSkillUnion(skill.dir);
      for (const block of [...content.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1])) {
        for (const loop of block.matchAll(/\bfor\s+\w+\s+in\s+([^;\n]*)/g)) {
          if (loop[1].split(/\s+/).some(word => /^\$\{?\w+\}?$/.test(word))) {
            violations.push(`${skill.dir}: ${loop[0].trim()}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('preamble-using skills have correct skill name in telemetry', () => {
    const PREAMBLE_SKILLS = [
      { dir: '.', name: 'gstack' },
      { dir: 'ship', name: 'ship' },
      { dir: 'review', name: 'review' },
      { dir: 'qa', name: 'qa' },
      { dir: 'retro', name: 'retro' },
    ];
    for (const skill of PREAMBLE_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      // The skill name now travels as --skill into gstack-skill-start (the
      // preamble fence) and gstack-skill-end (the telemetry epilogue) — the
      // scripts write it into the JSONL events.
      expect(content, `${skill.dir} preamble fence must pass its own name`)
        .toMatch(new RegExp(`--skill "${skill.name}" --model`));
      expect(content, `${skill.dir} epilogue must pass its own name`)
        .toContain(`gstack-skill-end --skill "${skill.name}"`);
    }
  });

  test('qa and qa-only load the shared QA_METHODOLOGY through exploration', () => {
    const qaSkeletonTmpl = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md.tmpl'), 'utf-8');
    expect(qaSkeletonTmpl).toContain('{{SECTION:exploratory}}');
    expect(qaSkeletonTmpl).not.toContain('{{QA_METHOD_READS}}');
    expect(qaSkeletonTmpl).not.toContain('{{QA_METHODOLOGY}}');
    const qaSectionTmpl = fs.readFileSync(path.join(ROOT, 'qa', 'sections', 'qa-patterns.md.tmpl'), 'utf-8');
    expect(qaSectionTmpl).toContain('{{QA_METHODOLOGY}}');

    const qaOnlyTmpl = fs.readFileSync(path.join(ROOT, 'qa-only', 'SKILL.md.tmpl'), 'utf-8');
    expect(qaOnlyTmpl).not.toContain('{{QA_METHODOLOGY}}');
    expect(qaOnlyTmpl).toContain('{{SECTION:exploratory}}');
    expect(qaOnlyTmpl).not.toContain('{{QA_METHOD_READS}}');
    expectMentions(qaOnlyTmpl, [['共有の準備ゲート', '読み込んで']], 'qa-only template');
    for (const skill of ['qa', 'qa-only']) {
      expect(fs.readFileSync(path.join(ROOT, skill, 'sections/exploratory.md.tmpl'), 'utf8'))
        .toContain('{{QA_EXPLORATORY}}');
      const entry = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf8');
      const explorer = fs.readFileSync(path.join(ROOT, skill, 'sections/exploratory.md'), 'utf8');
      const directoryRead = '`sections/scope.md` relative to the installed `qa`/`gstack-qa` SKILL.md directory';
      expect(entry).toContain('sections/exploratory.md');
      expect(explorer).toContain(directoryRead);
      for (const method of ['system-functional', 'qa-patterns']) {
        const methodRead = `\`sections/${method}.md\` を全文 Read します。`;
        expect(entry).not.toContain(methodRead);
        expect(explorer).toContain(methodRead);
        expect(explorer.split(methodRead)).toHaveLength(2);
        expect(explorer.indexOf(directoryRead)).toBeLessThan(explorer.indexOf(methodRead));
        const directory = path.resolve(ROOT, skill, skill === 'qa-only' ? '../qa' : '.');
        expect(fs.realpathSync(path.join(directory, 'sections', `${method}.md`)))
          .toBe(path.join(ROOT, 'qa', 'sections', `${method}.md`));
      }
      expect(explorer).toContain('**Browser の面のみ:**\n`sections/qa-patterns.md` を全文 Read します。');
      expectMentions(explorer, [['チャーター', '前に', 'Read']], 'explorer');
      expectMentions(explorer, [['繰り返', '呼び出し', '完了']], 'explorer');
      expect(explorer.indexOf('`sections/qa-patterns.md` を全文 Read')).toBeLessThan(explorer.indexOf('挙動ごとに **charter** を書きます'));
    }
  });

  test('QA_METHODOLOGY is expanded in the shared resource referenced by qa and qa-only', () => {
    const qaContent = readSkillUnion('qa'); // carved: methodology lives in qa/sections/qa-patterns.md
    const qaOnlyUnion = readSkillUnion('qa-only');
    expect(qaOnlyUnion).toContain('`sections/scope.md` relative to the installed `qa`/`gstack-qa` SKILL.md directory');
    expect(qaOnlyUnion).toContain('**Browser の面のみ:**\n`sections/qa-patterns.md` を全文 Read します。');
    expect(qaOnlyUnion).not.toContain('Health Score Rubric');
    const qaOnlyContent = qaOnlyUnion + fs.readFileSync(path.join(ROOT, 'qa/sections/qa-patterns.md'), 'utf8');

    // Both should contain the health score rubric
    expect(qaContent).toContain('Health Score Rubric');
    expect(qaOnlyContent).toContain('Health Score Rubric');

    // Both should contain framework guidance
    expect(qaContent).toContain('フレームワーク別のガイダンス');
    expect(qaOnlyContent).toContain('フレームワーク別のガイダンス');

    // Both should contain the important rules
    expect(qaContent).toContain('重要なルール');
    expect(qaOnlyContent).toContain('重要なルール');

    // Both should contain the 6 phases
    expect(qaContent).toContain('Phase 1');
    expect(qaOnlyContent).toContain('Phase 1');
    expect(qaContent).toContain('Phase 6');
    expect(qaOnlyContent).toContain('Phase 6');
  });

  test('qa-only has no-fix guardrails', () => {
    const qaOnlyContent = fs.readFileSync(path.join(ROOT, 'qa-only', 'SKILL.md'), 'utf-8');
    expect(extractMarkdownSection(qaOnlyContent, '## 追加ルール(qa-only 固有)')).toMatch(/修正/);
    // Should not have Edit, Glob, or Grep in allowed-tools.
    // Scope to frontmatter (between the first two --- lines) — the body can
    // legitimately mention these tool names in prose (e.g., Claude model
    // overlay names the host's dedicated file and search tools).
    const fmMatch = qaOnlyContent.match(/^---\n([\s\S]*?)\n---/);
    expect(fmMatch).not.toBeNull();
    const frontmatter = fmMatch![1];
    expect(frontmatter).toMatch(/allowed-tools:/);
    expect(frontmatter).not.toMatch(/allowed-tools:[\s\S]*?- Edit/);
    expect(frontmatter).not.toMatch(/allowed-tools:[\s\S]*?- Glob/);
    expect(frontmatter).not.toMatch(/allowed-tools:[\s\S]*?- Grep/);
  });

  test('qa has fix-loop tools and phases', () => {
    const qaContent = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    // Should have Edit, Glob, Grep in allowed-tools
    expect(qaContent).toContain('Edit');
    expect(qaContent).toContain('Glob');
    expect(qaContent).toContain('Grep');
    // Should have fix-loop phases
    expect(qaContent).toContain('Phase 7');
    expect(qaContent).toContain('Phase 8');
    expect(qaContent).toContain('修正ループ');
    expect(qaContent).toContain('トリアージ');
    expect(qaContent).toMatch(/5 件の修正ごと/);
  });
});

describe('BASE_BRANCH_DETECT resolver', () => {
  // Find a generated SKILL.md that uses the placeholder (ship is guaranteed to)
  const shipContent = readShipUnion();

  test('resolver output contains PR base detection command', () => {
    expect(shipContent).toContain('gh pr view --json baseRefName');
  });

  test('resolver output contains repo default branch detection command', () => {
    expect(shipContent).toContain('gh repo view --json defaultBranchRef');
  });

  test('resolver output contains fallback to main', () => {
    expect(shipContent).toMatch(/`main` にフォールバック/);
  });

  test('resolver output uses "the base branch" phrasing', () => {
    expect(shipContent).toContain('the base branch');
  });

  test('resolver output contains GitLab CLI commands', () => {
    expect(shipContent).toContain('glab');
  });

  test('resolver output contains git-native fallback', () => {
    expect(shipContent).toContain('git symbolic-ref');
  });

  test('resolver output mentions GitLab platform', () => {
    expect(shipContent).toMatch(/gitlab/i);
  });
});

describe('GitLab support in generated skills', () => {
  const retroContent = fs.readFileSync(path.join(ROOT, 'retro', 'SKILL.md'), 'utf-8');
  const shipSkillContent = readShipUnion();

  test('retro contains GitLab MR number extraction', () => {
    expect(retroContent).toContain('[#!]');
  });

  test('retro uses BASE_BRANCH_DETECT (contains glab)', () => {
    expect(retroContent).toContain('glab');
  });

  test('ship creates GitLab MRs through gstack-post, which runs glab mr create', () => {
    // CEO-19: /ship publishes only through gstack-post; the helper detects
    // GitLab from the remote and runs glab with argv values.
    expect(shipSkillContent).toContain('gstack-post pr-create --base <base>');
    expect(shipSkillContent).toContain('glab mr list --source-branch');
    expect(fs.readFileSync(path.join(ROOT, 'lib', 'gstack-post.ts'), 'utf-8')).toContain('args: ["mr", "create"');
  });

  test('ship checks .gitlab-ci.yml', () => {
    expect(shipSkillContent).toContain('.gitlab-ci.yml');
  });
});

/**
 * Quality evals — catch description regressions.
 *
 * These test that generated output is *useful for an AI agent*,
 * not just structurally valid. Each test targets a specific
 * regression we actually shipped and caught in review.
 */
describe('description quality evals', () => {
  // Regression: snapshot flags lost value hints (-d <N>, -s <sel>, -o <path>)
  // Browse carve: the flag reference renders into browse/sections/command-list.md.
  test('snapshot flags with values include value hints in output', () => {
    const content = readSkillUnion('browse');
    for (const flag of SNAPSHOT_FLAGS) {
      if (flag.takesValue) {
        expect(flag.valueHint).toBeDefined();
        expect(content).toContain(`${flag.short} ${flag.valueHint}`);
      }
    }
  });

  // Regression: "is" lost the valid states enum
  test('is command lists valid state values', () => {
    const desc = COMMAND_DESCRIPTIONS['is'].description;
    for (const state of ['visible', 'hidden', 'enabled', 'disabled', 'checked', 'editable', 'focused']) {
      expect(desc).toContain(state);
    }
  });

  // Regression: "press" lost common key examples
  test('press command lists example keys', () => {
    const desc = COMMAND_DESCRIPTIONS['press'].description;
    expect(desc).toContain('Enter');
    expect(desc).toContain('Tab');
    expect(desc).toContain('Escape');
  });

  // Regression: "console" lost --errors filter note
  test('console command describes --errors behavior', () => {
    const desc = COMMAND_DESCRIPTIONS['console'].description;
    expect(desc).toContain('--errors');
  });

  // Regression: snapshot -i lost "@e refs" context
  test('snapshot -i mentions @e refs', () => {
    const flag = SNAPSHOT_FLAGS.find(f => f.short === '-i')!;
    expect(flag.description).toContain('@e');
  });

  // Regression: snapshot -C lost "@c refs" context
  test('snapshot -C mentions @c refs', () => {
    const flag = SNAPSHOT_FLAGS.find(f => f.short === '-C')!;
    expect(flag.description).toContain('@c');
  });

  // Guard: every description must be at least 4 chars (catches empty or stub descriptions; Japanese is denser per char)
  test('all command descriptions have meaningful length', () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description.length).toBeGreaterThanOrEqual(4);
    }
  });

  // Guard: snapshot flag descriptions must be at least 10 chars
  test('all snapshot flag descriptions have meaningful length', () => {
    for (const flag of SNAPSHOT_FLAGS) {
      expect(flag.description.length).toBeGreaterThanOrEqual(10);
    }
  });

  // Guard: descriptions must not contain pipe (breaks markdown table cells)
  // Usage strings are backtick-wrapped in the table so pipes there are safe.
  test('no command description contains pipe character', () => {
    for (const [cmd, meta] of Object.entries(COMMAND_DESCRIPTIONS)) {
      expect(meta.description).not.toContain('|');
    }
  });

  // Guard: generated output uses → not ->
  test('generated SKILL.md uses unicode arrows', () => {
    // P2 (v1.2.0): the browse body moved out of the top-level router into
    // browse/SKILL.md. Guard arrow style on the browse body (sliced from its
    // H1 so the auto-generated `-->` header comments are excluded).
    const content = fs.readFileSync(path.join(ROOT, 'browse', 'SKILL.md'), 'utf-8');
    const h1 = content.search(/^# browse: /m);
    expect(h1).toBeGreaterThan(-1);
    const body = content.slice(h1);
    expect(body).toContain('→');
    expect(body).not.toContain('->');
  });
});

describe('REVIEW_DASHBOARD resolver', () => {
  const REVIEW_SKILLS = ['plan-ceo-review', 'plan-eng-review', 'plan-design-review'];

  for (const skill of REVIEW_SKILLS) {
    test(`review dashboard appears in ${skill} generated file`, () => {
      const content = readSkillUnion(skill); // carved skills: union skeleton + sections
      expect(content).toContain('gstack-review');
      expect(content).toContain('REVIEW READINESS DASHBOARD');
    });
  }

  test('review dashboard appears in ship generated file', () => {
    const content = readShipUnion();
    // The dashboard reads the review log through its reader; the literal
    // reviews.jsonl filename used to come only from the Context Recovery fence.
    expect(extractMarkdownSection(content, '## Review Readiness Dashboard')).toContain('bin/gstack-review-read');
    expect(content).toContain('REVIEW READINESS DASHBOARD');
  });

  test('dashboard treats review as a valid Eng Review source', () => {
    const content = readShipUnion();
    expect(content).toContain('| Eng Review | `review` or `plan-eng-review` | (DIFF) or (PLAN) |');
    expect(content).toContain('**内容優先のルール:** `review`');
    expect(content).toContain('**プランレコード**(plan-ceo-review、plan-eng-review');
    expectMentions(content, [['CLEARED', 'Eng Review', '`clean`', '7 日', '鮮度']], 'ship dashboard verdict rule');
  });

  test('shared dashboard propagates review source to plan-eng-review', () => {
    const content = readSkillUnion('plan-eng-review'); // carved: review body moved to section
    expect(content).toContain('| Eng Review | `review` or `plan-eng-review` | (DIFF) or (PLAN) |');
    expect(content).toContain('**内容優先のルール:** `review`');
  });

  test('resolver output contains key dashboard elements', () => {
    const content = readSkillUnion('plan-ceo-review'); // carved: dashboard moved to section
    expect(content).toContain('VERDICT');
    expect(content).toContain('CLEARED');
    expect(content).toContain('Eng Review');
    expect(content).toContain('7 日');
    expect(content).toContain('Design Review');
    expect(content).toContain('skip_eng_review');
  });

  test('dashboard bash block includes git HEAD for staleness detection', () => {
    const content = readSkillUnion('plan-ceo-review'); // carved: dashboard moved to section
    expect(content).toContain('git rev-parse --short HEAD');
    expect(content).toContain('---HEAD---');
  });

  test('dashboard includes staleness detection prose', () => {
    const content = readSkillUnion('plan-ceo-review'); // carved: dashboard moved to section
    expect(content).toContain('**2. 判定を選ぶ前に、鮮度を確認します。**');
    expect(content).toContain('commit');
  });

  for (const skill of REVIEW_SKILLS) {
    test(`${skill} contains review chaining section`, () => {
      const content = readSkillUnion(skill); // carved skills: union skeleton + sections
      expect(content).toMatch(/Review Chaining|レビューの連鎖/);
    });

    test(`${skill} レビューログ includes commit field`, () => {
      const content = readSkillUnion(skill); // carved skills: union skeleton + sections
      expect(content).toContain('"commit"');
    });
  }

  test('plan-ceo-review chaining mentions eng and design reviews', () => {
    // Carved skill: the chaining prose lives in sections/*.md. (It used to
    // pass against the skeleton only because the preamble's routing-injection
    // rules incidentally named these skills — that prose moved into
    // bin/gstack-skill-start in token-reduction Phase 2.)
    const content = readSkillUnion('plan-ceo-review');
    expect(content).toContain('/plan-eng-review');
    expect(content).toContain('/plan-design-review');
  });

  test('plan-eng-review chaining mentions design and ceo reviews', () => {
    const content = readSkillUnion('plan-eng-review'); // carved: review body moved to section
    expect(content).toContain('/plan-design-review');
    expect(content).toContain('/plan-ceo-review');
  });

  test('plan-design-review chaining mentions eng, ceo, and design skills', () => {
    const content = readSkillUnion('plan-design-review');
    expect(content).toContain('/plan-eng-review');
    expect(content).toContain('/plan-ceo-review');
    expect(content).toContain('/design-shotgun');
    expect(content).toContain('/design-html');
  });

  test('ship does NOT contain review chaining', () => {
    const content = readShipUnion();
    expect(content).not.toMatch(/Review Chaining|レビューの連鎖/);
  });
});

// ─── Test Coverage Audit Resolver Tests ─────────────────────

describe('TEST_COVERAGE_AUDIT placeholders', () => {
  const planSkill = readSkillUnion('plan-eng-review'); // carved
  const shipSkill = readShipUnion();
  const reviewSkill = readSkillUnion('review'); // carved: Review Army moved to sections/review-army.md

  test('plan and ship modes share codepath tracing methodology', () => {
    // Review mode delegates test coverage to the Testing specialist subagent (Review Army)
    const normalizedPlanSkill = planSkill.replace(/\s+/g, ' ');
    const normalizedShipSkill = shipSkill.replace(/\s+/g, ' ');
    for (const skill of [normalizedPlanSkill, normalizedShipSkill]) {
      ordered(skill, ['具体的なソースとテストのファイル', '**データフローをトレースします。**', '**実行を diagram にします。**', '品質のスコアリング基準']);
      for (const marker of ['★★★', '★★', 'GAP']) expect(skill).toContain(marker);
    }
    // Plan mode traces the plan, not a git diff
    expect(planSkill).toContain('**Step 1. プラン内のすべてのコードパスをトレース');
    expect(planSkill).not.toContain('git diff origin');
    // Ship mode traces the diff
    expect(shipSkill).toContain('**1. 変更されたすべてのコードパスを、`git diff origin/<base>` を使ってトレース');
  });

  test('review mode uses Review Army for specialist dispatch', () => {
    expect(reviewSkill).toContain('Review Army');
    expect(reviewSkill).toContain('Specialist Dispatch');
    expect(reviewSkill).toContain('testing.md');
  });

  test('plan and ship modes include E2E decision matrix', () => {
    // Review mode delegates to Testing specialist
    for (const skill of [planSkill, shipSkill]) {
      expect(skill).toContain('E2E Test Decision Matrix');
      expect(skill).toContain('→E2E');
      expect(skill).toContain('→EVAL');
    }
  });

  test('plan and ship modes include regression rule', () => {
    // Review mode delegates to Testing specialist
    for (const skill of [planSkill, shipSkill]) {
      expect(skill).toMatch(/^#{3,4} REGRESSION RULE/m);
    }
    expectMentions(planSkill, [['のないまま','必須の要件','回帰']], 'planSkill');
  });

  test('all five plan audit subheadings stay inside Test review while ship keeps its existing depth', () => {
    const tests = planSkill.split('\n### 3. テストのレビュー\n')[1]!.split('\n### 4. パフォーマンスのレビュー\n')[0]!;
    const instructions = tests.replace(/```[\s\S]*?```/g, '');
    const headings = ['Test Framework Detection', 'E2E Test Decision Matrix', 'REGRESSION RULE',
      'LLM/eval scope', 'Test Plan Artifact'];
    // Headings carry a Japanese gloss in parentheses; compare the English identifier.
    expect([...instructions.matchAll(/^#### (.+)$/gm)].map(match => match[1]!.replace(/\([^)]*[\u3040-\u30ff\u4e00-\u9fff][^)]*\)$/, ''))).toEqual(headings);
    expect(instructions).not.toMatch(/^#{1,3} /m);
    for (const heading of headings.filter(heading => heading !== 'LLM/eval scope')) {
      expect(shipSkill).toContain(`\n### ${heading}`);
      expect(shipSkill).not.toContain(`\n#### ${heading}`);
    }
  });

  test('planned regression coverage gets its own approved contract without making coverage optional', () => {
    const regression = planSkill.split('\n#### REGRESSION RULE(回帰ルール・必須)\n')[1]!.split('**Step 4.')[0]!;
    expect(regression).toContain('必須の要件');
    expectMentions(regression, [['スキップ','どうカバー']], 'regression');
    expectMentions(regression, [['承認された契約','プランに加える前']], 'regression');
    expect(regression).toContain('専用の AskUserQuestion');
    expect(regression).not.toContain('diff が壊した');
    expectMentions(regression, [['動作中','すでに壊れて','証明ではありません']], 'regression');
  });

  test('plan gap additions wait for their test-contract decision', () => {
    const action = planSkill.split('**Step 5. 足りないテストをプランに追加します:**')[1]!.split('\n#### Test Plan Artifact(')[0]!;
    expectMentions(action, [['新しい契約','任意の深さ','保留']], 'action');
    expectMentions(action, [['適用する前','回答を待ち']], 'action');
    expect(action).not.toContain('explain what broke');
  });

  test('implemented regressions still require an immediate test without a question', () => {
    const regression = shipSkill.split('### REGRESSION RULE(回帰ルール・必須)')[1]!.split('**4.')[0]!;
    expectMentions(regression, [['AskUserQuestion','行いません']], 'regression');
  });

  test('plan and ship modes include test framework detection', () => {
    // Review mode delegates to Testing specialist
    for (const skill of [planSkill, shipSkill]) {
      expect(skill).toContain('Test Framework Detection');
      expect(skill).toContain('CLAUDE.md');
    }
  });

  test('plan framework absence keeps requirements without offering test generation', () => {
    const detection = planSkill.split('\n#### Test Framework Detection(')[1]!.split('**Step 1.')[0]!;
    expect(detection).toContain('フレームワークが不明であることを述べ');
    expectMentions(detection, [['選択肢','フレームワークの質問はしません']], 'detection');
    expectMentions(detection, [['インストール','提案したテストの作成は行いません']], 'detection');
    expect(detection).not.toContain('skip test generation');
  });

  test('plan mode adds tests to plan + includes test plan artifact', () => {
    expect(planSkill).toContain('足りないテストをプランに追加します');
    expect(planSkill).toContain('eng-review-test-plan');
    expect(planSkill).toContain('Test Plan Artifact');
    const artifact = planSkill.split('\n#### Test Plan Artifact(')[1]!;
    // The artifact is written even when Test review choices are still unanswered (periodic run 37151477069).
        expectMentions(artifact, [['未解決の選択肢','必須の実装ではなく']], 'artifact');
    expect(artifact).toContain('TEST_PLAN_USER=$(whoami)');
    expect(artifact).toContain('gstack-slug のサニタイズ済みの `BRANCH`');
    expectMentions(artifact, [['origin', '`local-only`']], 'artifact');
  });

  test('ship mode auto-generates tests + includes before/after count', () => {
    expect(shipSkill).toContain('カバーされていないパスのテストを生成します');
    expect(shipSkill).toContain('Before/after test count');
    expect(shipSkill).toContain('コードパスは最大 30 個');
    expect(shipSkill).toContain('ship-test-plan');
  });

  test('review mode uses Fix-First + Review Army for specialist coverage', () => {
    expect(reviewSkill).toContain('Fix-First');
    expect(reviewSkill).toContain('INFORMATIONAL');
    // Review Army handles test coverage via Testing specialist subagent
    expect(reviewSkill).toContain('Review Army');
    expect(reviewSkill).toContain('Testing');
  });

  test('plan mode does NOT include ship-specific content', () => {
    expect(planSkill).not.toContain('Before/after test count');
    expect(planSkill).not.toContain('30 code paths max');
    expect(planSkill).not.toContain('ship-test-plan');
  });

  test('review mode does NOT include test plan artifact', () => {
    expect(reviewSkill).not.toContain('Test Plan Artifact');
    expect(reviewSkill).not.toContain('eng-review-test-plan');
    expect(reviewSkill).not.toContain('ship-test-plan');
  });

  test('review/specialists/ directory has all expected checklist files', () => {
    const specDir = path.join(ROOT, 'review', 'specialists');
    const expected = [
      'testing.md',
      'maintainability.md',
      'security.md',
      'performance.md',
      'data-migration.md',
      'api-contract.md',
      'simplification.md',
      'red-team.md',
    ];
    for (const f of expected) {
      expect(fs.existsSync(path.join(specDir, f))).toBe(true);
    }
  });

  // Regression pins for the simplification specialist (advisory carve-out edits
  // the pre-existing quality_score instruction, so the rendered contract is
  // pinned statically — the carve-out and the early-out line must both survive
  // regeneration verbatim).
  test('simplification advisory carve-out and early-out render into review docs', () => {
    const reviewArmySection = fs.readFileSync(
      path.join(ROOT, 'review', 'sections', 'review-army.md'),
      'utf-8',
    );
    expect(reviewArmySection).toContain('"advisory": true');
    expectTokens(reviewArmySection, ['`quality_score`'], 'reviewArmySection');
    expectMentions(reviewArmySection, [['quality_score', 'スペシャリストの指摘だけ'], ['コアの指摘は入れません']], 'reviewArmySection');
    expectMentions(reviewArmySection, [['advisory ではない', 'スペシャリストの指摘', '件数', 'スコア']], 'reviewArmySection');
    expect(reviewArmySection).toContain('net: -N lines possible');
    expect(reviewArmySection).toContain('--simplification');
    // The specialist itself must never carry a verdict-shaped zero-findings line.
    const spec = fs.readFileSync(
      path.join(ROOT, 'review', 'specialists', 'simplification.md'),
      'utf-8',
    );
    expect(spec).toContain('NO FINDINGS');
    expect(spec).not.toContain('Lean already. Ship.');
    // Closed tag vocabulary: the disavowed yagni: frame must not appear.
    expect(spec).toContain('speculative');
    expect(spec.toLowerCase()).not.toContain('"yagni"');
  });

  test('each specialist file has standard header with scope and output format', () => {
    const specDir = path.join(ROOT, 'review', 'specialists');
    const files = fs.readdirSync(specDir).filter(f => f.endsWith('.md'));
    for (const f of files) {
      const content = fs.readFileSync(path.join(specDir, f), 'utf-8');
      // All specialist files must have Scope and Output/JSON in header
      expect(content).toContain('適用範囲:');
      expect(content.toLowerCase()).toMatch(/出力|output|json/);
      // Must define NO FINDINGS behavior
      expect(content).toContain('NO FINDINGS');
    }
  });

  // Regression guard: ship output contains key phrases from before the refactor
  test('ship SKILL.md regression guard — key phrases preserved', () => {
    const regressionPhrases = [
      'カバレッジの目標: 変更されたすべての挙動が、実際の回帰を捉えられるテストで守られていること。',
      'ASCII のカバレッジ diagram',
      'processPayment',
      'refundPayment',
      'billing.test.ts',
      'checkout.e2e.ts',
      'COVERAGE:',
      'QUALITY:',
      'GAPS:',
      'Code paths:',
      'User flows:',
    ];
    for (const phrase of regressionPhrases) {
      expect(shipSkill).toContain(phrase);
    }
  });

  test('ship SKILL.md contains review army specialist dispatch', () => {
    expect(shipSkill).toContain('Specialist Dispatch');
    expect(shipSkill).toContain('Step 9.1');
    expect(shipSkill).toContain('Step 9.2');
  });

  test('ship SKILL.md contains cross-review finding dedup', () => {
    expect(shipSkill).toContain('Cross-review finding dedup');
    expect(shipSkill).toContain('Step 9.3');
  });

  test('ship SKILL.md contains re-run idempotency behavior', () => {
    expect(shipSkill).toContain('**ルート:**');
    expect(shipSkill.replace(/\s+/g, ' ')).toContain('統合 (1–3) → テストとレビュー (4–11.5) → リリース準備 (12–15) → 凍結内容の検証 (16) → push と公開 (17–21)');
    expectMentions(shipSkill.replace(/\s+/g, ' '), [['重複','検証','省略']], 'shipSkill');
  });
});

// --- {{TEST_FAILURE_TRIAGE}} resolver tests ---

describe('TEST_FAILURE_TRIAGE resolver', () => {
  const shipSkill = readShipUnion();

  test('contains all 4 triage steps', () => {
    expectOrdered(shipSkill, [/### Step T1:/, /### Step T2:/, /### Step T3:/, /### Step T4:/], 'ship');
  });

  test('T1 includes classification criteria (in-branch vs pre-existing)', () => {
    expect(shipSkill).toContain('In-branch');
    expect(shipSkill).toContain('Likely pre-existing');
    expect(shipSkill).toContain('git diff origin/');
  });

  test('T3 branches on REPO_MODE (solo vs collaborative)', () => {
    expect(shipSkill).toContain('REPO_MODE');
    expect(shipSkill).toContain('solo');
    expect(shipSkill).toContain('collaborative');
  });

  test('solo mode offers fix-now, TODO, and skip options', () => {
    const solo = between(shipSkill, '**REPO_MODE が `solo` の場合:**', '**REPO_MODE が `collaborative`');
    expectMentions(solo, [['A)', '修正'], ['B)', 'P0', 'TODO'], ['C)', 'スキップ']], 'solo');
  });

  test('collaborative mode offers blame + assign option', () => {
    const collab = between(shipSkill, '**REPO_MODE が `collaborative`', '### Step T4:');
    expectMentions(collab, [['blame', 'issue', 'アサイン']], 'collab');
    expect(shipSkill).toContain('gh issue create');
  });

  test('defaults ambiguous failures to in-branch (safety)', () => {
    const t1 = between(shipSkill, '### Step T1:', '### Step T2:');
    expectMentions(t1, [['曖昧', 'ブランチ内']], 't1');
  });
});

// --- {{PLAN_FILE_REVIEW_REPORT}} resolver tests ---

describe('PLAN_FILE_REVIEW_REPORT resolver', () => {
  const REVIEW_SKILLS = ['plan-ceo-review', 'plan-eng-review', 'plan-design-review', 'codex'];

  for (const [label, skill] of [['Eng', 'plan-eng-review'], ['CEO', 'plan-ceo-review']]) {
  test(`${label} report example is fenced Markdown, and the original escaped fence is rejected`, async () => {
    const { marked } = await import('marked');
    const content = readSkillUnion(skill!);
    const tokens = marked.lexer(content);
    const headings = tokens.filter(token => token.type === 'heading' && token.depth === 2);
    expect(headings.map(token => token.text)).not.toContain('GSTACK REVIEW REPORT');
    const example = tokens.find(token => token.type === 'code'
      && token.lang === 'markdown' && token.text.startsWith('## GSTACK REVIEW REPORT\n'));
    expect(example).toBeDefined();
    if (example?.type !== 'code') throw new Error('Missing fenced report example');
    expect(example.text).toContain('| Review | Trigger | Why | Runs | Status | Findings |');
    expect(example.text).toContain('`/' + skill + '`');
    // Reproduce the observed literal-backslash delimiters without changing
    // the parser or preprocessing malformed Markdown into valid fences.
    const broken = content.replace(example.raw, example.raw.replaceAll('`', '\\`'));
    expect(broken).not.toBe(content);
    const brokenTokens = marked.lexer(broken);
    expect(brokenTokens.some(token => token.type === 'code' && token.lang === 'markdown'
      && token.text.startsWith('## GSTACK REVIEW REPORT\n'))).toBe(false);
    expect(brokenTokens.filter(token => token.type === 'heading' && token.depth === 2)
      .map(token => token.text)).toContain('GSTACK REVIEW REPORT');
  });
  }

  test('Eng renderers use real code delimiters without changing confidence rules or report fields', async () => {
    const {generateConfidenceCalibration} = await import('../scripts/resolvers/confidence');
    const {generateReviewDashboard, generatePlanFileReviewReport} = await import('../scripts/resolvers/review-dashboard');
    const {generateCodexPlanReview} = await import('../scripts/resolvers/outside-voice-steps');
    const {HOST_PATHS} = await import('../scripts/resolvers/types');
    for (const host of ALL_HOST_CONFIGS) {
      const ctx = {skillName: 'plan-eng-review', tmplPath: 'plan-eng-review/SKILL.md.tmpl',
        host: host.name, paths: HOST_PATHS[host.name]!};
      const confidence = generateConfidenceCalibration(ctx);
      const dashboard = generateReviewDashboard(ctx);
      const report = generatePlanFileReviewReport(ctx);
      const outside = generateCodexPlanReview(ctx);
      // These four resolver fragments contain no intentional escaped-backtick
      // example; the preamble does, and is deliberately outside this check.
      for (const output of [confidence, dashboard, report, outside]) expect(output).not.toContain('\\`');
      expect(confidence).toBe(generateConfidenceCalibration({...ctx, skillName: 'plan-ceo-review'}).replaceAll('\\`', '`'));
      const ceoDashboard = generateReviewDashboard({...ctx, skillName: 'plan-ceo-review'}).replaceAll('\\`', '`');
      const ceoVoiceTokens = ['`autoplan-voices`', '`design-outside-voices`'];
      expectTokens(dashboard, ceoVoiceTokens, 'dashboard');
      expectTokens(ceoDashboard, ceoVoiceTokens, 'ceoDashboard');
      expect(ceoDashboard).toBe(dashboard);
      for (const field of ['status', 'unresolved', 'critical_gaps', 'issues_found', 'mode', 'commit']) {
        expect(report).toContain('`' + field + '`');
      }
      expect(outside).toContain(host.name === 'codex' ? 'claude auth login' : 'codex login');
      expectMentions(outside, [['カバレッジ','クリーン']], 'outside');
    }
  });

  for (const skill of REVIEW_SKILLS) {
    test(`plan file review report appears in ${skill} generated file`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('GSTACK REVIEW REPORT');
    });
  }

  test('resolver output contains key report elements', () => {
    const content = readSkillUnion('plan-ceo-review'); // carved: report writer moved to section
    expect(content).toContain('Trigger');
    expect(content).toContain('Findings');
    expect(content).toContain('VERDICT');
    expect(content).toContain('/plan-ceo-review');
    expect(content).toContain('/plan-eng-review');
    expect(content).toContain('/plan-design-review');
    expect(content).toContain('/codex review');
  });

  test('Eng task output follows the same write policy as its report', () => {
    const content = readSkillUnion('plan-eng-review');
    // The task example itself has an H2; bound by the following real section.
    const tasks = content.slice(content.indexOf('## Implementation Tasks'), content.indexOf('## Plan File Review Report'));
    expectMentions(tasks, [['許可','場合にのみ','書き込']], 'tasks');
    expectMentions(tasks, [['許可されない','未永続化','完全']], 'tasks');
    expect(tasks).not.toContain('always write');
  });
});

// --- {{PLAN_COMPLETION_AUDIT}} resolver tests ---

describe('PLAN_COMPLETION_AUDIT placeholders', () => {
  const shipSkill = readShipUnion();
  const reviewSkill = readSkillUnion('review'); // carved: plan-completion audit moved to sections/plan-completion.md

  test('ship SKILL.md contains plan completion audit step', () => {
    expectTokens(shipSkill, [/^## Step 8: /m, /^## Step 8\.1: Plan Verification/m, /^## Step 8\.2: /m], 'ship');
  });

  test('review SKILL.md contains plan completion in scope drift', () => {
    expect(reviewSkill).toContain('Plan File Discovery');
    expect(reviewSkill).toContain('Actionable Item Extraction');
    expect(reviewSkill).toContain('Integration with Scope Drift Detection');
  });

  test('both modes share plan file discovery methodology', () => {
    expect(shipSkill).toContain('Plan File Discovery');
    expect(reviewSkill).toContain('Plan File Discovery');
    // Both should have conversation context first
    for (const [label, skill] of [['ship', shipSkill], ['review', reviewSkill]] as const) {
      expectOrdered(skill, ['Plan File Discovery', /1\. \*\*会話の文脈/, /3\. \*\*内容に基づく検索/], label);
    }
  });

  test('ship mode has gate logic for NOT DONE items', () => {
    const gate = between(shipSkill, '1. **NOT DONE の項目がある場合**', '2. **UNVERIFIABLE の項目がある場合**');
    expectTokens(gate, ['AskUserQuestion', /A\) 停止/, /B\) とにかく出荷/, /C\) .*意図的に外した/, 'Deferred from plan:', 'intentionally dropped'], 'gate');
    expectMentions(gate, [['a の場合', '停止']], 'gate');
  });

  test('review mode is INFORMATIONAL only', () => {
    expect(reviewSkill).toContain('INFORMATIONAL');
    expect(reviewSkill).toContain('MISSING REQUIREMENTS');
    expect(reviewSkill).toContain('SCOPE CREEP');
  });

  test('item extraction has 50-item cap', () => {
    expectTokens(shipSkill, [/最大 50 項目/, 'Showing top 50 of N plan items'], 'ship');
  });

  test('uses file-level traceability (not commit-level)', () => {
    expectMentions(shipSkill, [['diff', '具体的なファイル']], 'ship');
    expect(shipSkill).not.toContain('commit-level traceability');
  });
});

// --- {{PLAN_VERIFICATION_EXEC}} resolver tests ---

describe('PLAN_VERIFICATION_EXEC placeholder', () => {
  const shipSkill = readShipUnion();

  test('ship SKILL.md contains plan verification step', () => {
    expect(shipSkill).toContain('Step 8.1');
    expect(shipSkill).toContain('Plan Verification');
  });

  test('references the shared explorer without invoking an entire QA workflow', () => {
    const resource = '`../qa/sections/exploratory.md` を全文 Read';
    expect(shipSkill).toContain(resource);
    const load = shipSkill.indexOf(resource);
    const preflight = shipSkill.indexOf('共有の preflight を実行し');
    const probes = shipSkill.indexOf('**3. スモークとプランのチェックを実行します。**');
    expect(load).toBeGreaterThan(-1);
    expect(preflight).toBeGreaterThan(load);
    expect(probes).toBeGreaterThan(preflight);
    const shared = fs.readFileSync(path.join(ROOT, 'qa/sections/exploratory.md'), 'utf8');
    expectOrdered(shared, ['`sections/scope.md`', '`sections/system-functional.md`', '**charter**'], 'shared');
    expect(shipSkill.slice(preflight, probes)).toContain('`sections/browser-setup.md`');
    expectMentions(shipSkill, [['qa スキル全体', '呼び出し', 'いけません']], 'shipSkill');
  });

  test('keeps declared browser URLs separate from native functional probes', () => {
    expectMentions(shipSkill, [['機能面', '探し出さず', 'ネイティブ']], 'shipSkill');
    expectMentions(compact(shipSkill), [['api の url', '自動的', 'ページ']], 'shipSkill');
  });

  test('retains automatic exploration when there is no plan or verification section', () => {
    expectMentions(shipSkill, [['検証のセクション', 'プランファイルもない']], 'shipSkill');
    expectMentions(shipSkill, [['diff の範囲', '自動 QA', '引き続き実行']], 'shipSkill');
  });

  test('blocks unavailable required checks instead of silently skipping them', () => {
    const flat = shipSkill.replace(/\s+/g, ' ');
    expectMentions(flat, [['非対話', 'ブロック', '返します']], 'flat');
    expectMentions(flat, [['必須プローブ', '黙って', 'いけません']], 'flat');
    expectMentions(flat, [['読み取れない', 'ブロック', '必須の QA']], 'flat');
    expectMentions(flat, [['verify_result', 'fail']], 'flat');
    expectMentions(flat, [['リスクを受け入れても', '保持']], 'flat');
  });
});

// --- Coverage gate tests ---

describe('Coverage gate in ship', () => {
  const shipSkill = readShipUnion();
  const reviewSkill = readSkillUnion('review'); // carved: testing.md specialist ref lives in sections/review-army.md

  test('ship SKILL.md contains coverage gate with thresholds', () => {
    expect(shipSkill).toContain('Coverage gate');
    expect(shipSkill).toContain('>= target');
    expect(shipSkill).toContain('< minimum');
  });

  test('ship SKILL.md supports configurable thresholds via CLAUDE.md', () => {
    expect(shipSkill).toContain('## Test Coverage');
    expect(shipSkill).toContain('Minimum:');
    expect(shipSkill).toContain('Target:');
  });

  test('coverage gate skips on parse failure (not block)', () => {
    expect(shipSkill).toContain('could not determine percentage — skipping');
  });

  test('review SKILL.md delegates coverage to Testing specialist', () => {
    // Coverage audit moved to Testing specialist subagent in Review Army
    expect(reviewSkill).toContain('testing.md');
    expect(reviewSkill).toContain('INFORMATIONAL');
  });
});

// --- Ship metrics logging ---

describe('Ship metrics logging', () => {
  const shipSkill = readShipUnion();

  test('ship SKILL.md contains metrics persistence step', () => {
    expect(shipSkill).toContain('Step 20');
    expect(shipSkill).toContain('coverage_pct');
    expect(shipSkill).toContain('plan_items_total');
    expect(shipSkill).toContain('plan_items_done');
    expect(shipSkill).toContain('verification_result');
  });
});

// --- Plan file discovery shared helper ---

describe('Plan file discovery shared helper', () => {
  // The shared helper should appear in ship (via PLAN_COMPLETION_AUDIT_SHIP)
  // and in review (via PLAN_COMPLETION_AUDIT_REVIEW)
  const shipSkill = readShipUnion();
  const reviewSkill = readSkillUnion('review'); // carved: plan-completion audit moved to sections/plan-completion.md

  test('plan file discovery appears in both ship and review', () => {
    expect(shipSkill).toContain('Plan File Discovery');
    expect(reviewSkill).toContain('Plan File Discovery');
  });

  test('both include conversation context first', () => {
    for (const skill of [shipSkill, reviewSkill]) expectOrdered(skill, ['Plan File Discovery', /1\. \*\*会話の文脈\(最優先\)/], 'skill');
  });

  test('both include content-based fallback', () => {
    for (const skill of [shipSkill, reviewSkill]) expectTokens(skill, [/3\. \*\*内容に基づく検索\(フォールバック\)/], 'skill');
  });
});

// --- Retro plan completion ---

describe('Retro plan completion section', () => {
  // Carved: the narrative report format (incl. Plan Completion) lives in
  // retro/sections/report-format.md — read the skeleton+sections union.
  const retroSkill = readSkillUnion('retro');

  test('retro SKILL.md contains plan completion section', () => {
    expectTokens(retroSkill, ['### プラン完了率', 'plan_items_total', 'Plan Completion This Period'], 'retro');
  });
});

// --- Plan status footer in preamble ---

describe('Plan status footer in preamble', () => {
  test('preamble contains plan status footer as neutral forward reference to EXIT PLAN MODE GATE', () => {
    // Read any skill that uses PREAMBLE
    const content = readSkillUnion('office-hours'); // carved: Phase 5/6 prose moved to section
    expect(content).toContain('Plan Status Footer');
    expect(content).toContain('GSTACK REVIEW REPORT');
    expect(content).toContain('ExitPlanMode');
    expect(content).toContain('EXIT PLAN MODE GATE');
    // The preamble must NOT impose review-report rules on operational skills
    // that have no review report. It's a forward reference, not enforcement.
    expect(content).not.toContain('NO REVIEWS YET');
  });
});

// --- make-pdf setup ordering ---

describe('make-pdf setup ordering', () => {
  test('MAKE-PDF SETUP appears before generic preamble footer sections', () => {
    const content = fs.readFileSync(path.join(ROOT, 'make-pdf', 'SKILL.md'), 'utf-8');
    const preambleIdx = content.indexOf('## Preamble (run first)');
    const setupIdx = content.indexOf('## MAKE-PDF SETUP');
    const planModeIdx = content.indexOf('## Plan Mode Safe Operations');
    const telemetryIdx = content.indexOf('## Telemetry (run last)');
    const workflowIdx = content.indexOf('\n# make-pdf: ') + 1;

    expect(preambleIdx).toBeGreaterThanOrEqual(0);
    expect(setupIdx).toBeGreaterThan(preambleIdx);
    expect(setupIdx).toBeLessThan(planModeIdx);
    expect(setupIdx).toBeLessThan(telemetryIdx);
    expect(setupIdx).toBeLessThan(workflowIdx);
    expect(content.match(/^## MAKE-PDF SETUP/gm)?.length ?? 0).toBe(1);
  });
});

// --- Skill invocation during plan mode in preamble ---

describe('Skill invocation during plan mode in preamble', () => {
  test('preamble contains skill invocation plan mode section', () => {
    const content = readSkillUnion('office-hours'); // carved: Phase 5/6 prose moved to section
    expect(content).toContain('Skill Invocation During Plan Mode');
    expectMentions(content, [['ワークフローを続けたり', 'exitplanmode', 'いけません'], ['exitplanmode', 'キャンセル', 'プランモードの終了']], 'content');
  });

  // #2851: a skill cannot grant permissions or redefine the host's mode; the
  // host's restrictions and the user's scope win, in every generated skill.
  test('no generated skill claims precedence over host plan-mode restrictions (#2851)', () => {
    let checked = 0;
    for (const file of ['SKILL.md', ...fs.readdirSync(ROOT).map(d => path.join(d, 'SKILL.md'))]) {
      if (!fs.existsSync(path.join(ROOT, file))) continue;
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      if (!content.includes('## Skill Invocation During Plan Mode')) continue;
      checked++;
      expect(content, file).not.toContain('takes precedence over generic plan mode');
      expect(content, file).not.toContain('overrides generic plan mode');
      expect(content, file).not.toContain('allowed because they inform the plan');
      expect(content, file).not.toContain('"PLAN MODE EXCEPTION — ALWAYS RUN" execute.');
      expect(content, file).not.toContain('Execute "PLAN MODE EXCEPTION — ALWAYS RUN" commands');
      expectMentions(content, [['制限', 'スコープ', '優先']], 'content');
      expect(content, file).toMatch(/"PLAN MODE EXCEPTION — ALWAYS RUN"(?: と記された| の)コマンドは、ホストが許可する場合にのみ実行/);
    }
    expect(checked).toBeGreaterThan(40);
  });
});

// --- {{SPEC_REVIEW_LOOP}} resolver tests ---

describe('SPEC_REVIEW_LOOP resolver', () => {
  const content = readSkillUnion('office-hours'); // carved: Phase 5/6 prose moved to section
  const { generateSpecReviewLoop } = require('../scripts/resolvers/spec-review');
  const { HOST_PATHS } = require('../scripts/resolvers/types');
  const render = (skillName: string, host = 'claude') => generateSpecReviewLoop({
    skillName,
    tmplPath: `${skillName}/SKILL.md.tmpl`,
    host,
    paths: HOST_PATHS[host],
  });

  test('office-hours prepares a complete reviewer prompt on every host', () => {
    const { renderOfficeHoursReviewerPrompt } = require('../lib/office-hours-review');
    for (const host of Object.keys(HOST_PATHS)) {
      const output = render('office-hours', host);
      expect(output).toContain('gstack-office-hours-review prepare --design');
      expect(output).toContain('--out-dir "<review-directory>"');
      ordered(output, ['mktemp -d "<design-path>.review.XXXXXX"', 'prepare --design', '`round-N.prompt.md`', '`dispatch`']);
    }
    const prompt = renderOfficeHoursReviewerPrompt({ document: '/tmp/design.md', verdictPath: '/tmp/round-1.json' });
    expect(prompt).toContain('Document: /tmp/design.md');
    expect(prompt).toContain('Verdict: /tmp/round-1.json');
    expect(prompt).toContain('"document": "/tmp/design.md"');
    expect(prompt).toMatch(/design and coaching document/i);
    for (const section of ["'The Assignment'", "'What I noticed about how you think'"]) expect(prompt).toContain(section);
    expect(prompt).toMatch(/never invent customer answers/i);
    expect(prompt).toMatch(/including minor findings/i);
    expect(prompt).toContain('`OFFICE_HOURS_VERDICT round=1 sha256=<hash> path=<verdict path>`');
    expect(prompt).toMatch(/run the `Seal:` command/);
    expect(prompt).not.toMatch(/identical JSON/i);
    expect(prompt).toMatch(/classify every preceding finding/i);
    ordered(prompt, ['1. **Completeness**', '2. **Consistency**', '3. **Clarity**', '4. **Scope**', '5. **Feasibility**']);
    expect(prompt).toMatch(/distinguished from committed behavior/i);
    expect(prompt).toContain('"version": 2');
    expect(prompt).toContain('"prior": []');
  });

  test('office-hours checks stop conditions before edits and preserves concerns mechanically', () => {
    const output = render('office-hours');
    const step2 = output.slice(output.indexOf('**Step 2:'), output.indexOf('**Step 3:'));
    expectMentions(step2, [['前に', 'ディスパッチ', '指摘']], 'step2');
    ordered(step2, ['gstack-office-hours-review check --receipt "<receipt line>"', '一致しない場合、チェックは失敗し', '- PASS:', '- CONVERGENCE:', '- MAX_ITERATIONS: ラウンド 3', '- CONTINUE:', 'gstack-office-hours-review finalize --design']);
    expectMentions(step2, [['blocking の指摘だけを修正'], ['minor', '編集してはいけません']], 'step2');
    expectMentions(step2, [['停止', '再ディスパッチはしません']], 'step2');
    expectMentions(step2, [['生成された', 'セクション', '編集してはいけません']], 'step2');
    expect(step2.slice(step2.indexOf('finalize --design'))).toContain('既存のユーザー承認');
  });

  test('office-hours finalizes the report after writing it and labels derivable metrics', () => {
    const output = render('office-hours');
    expect(output).toContain('--report "<report-path>"');
    expect(output).toContain('レポートができた後に');
    expectMentions(output, [['要約したり置き換えたりしてはいけません']], 'output');
    expectMentions(output, [['assignment', '承認', '保持']], 'output');
    expectMentions(output, [['レビュアー', '明示的な証拠']], 'output');
  });

  test('office-hours errors stay explicit and preserve preceding valid evidence', () => {
    const output = render('office-hours');
    expect(output).toMatch(/--unreviewed "<actual failure cause>"` と、\s*それまでの有効なラウンドファイルのみ/);
    expectMentions(output, [['json', '捏造', 'いけません']], 'output');
    expectMentions(output, [['承認ゲートではありません']], 'output');
  });

  test('CEO keeps its loop limits, scoring, failure handling, and reporting', () => {
    const ceo = render('plan-ceo-review');
    const report = ceo.split('**Step 3:')[1]!.replace(/\s+/g, ' ');
    expect(report).toContain('JSON の `null`');
    expectMentions(ceo, [['clarity', '追加の質問なしで実装できる']], 'ceo');
    expect(ceo).not.toContain('design and coaching document');
    expect(ceo).not.toContain('gstack-office-hours-review');
    const dispatch = ceo.slice(ceo.indexOf('**Step 1:'), ceo.indexOf('**Step 2:')).replace(/\s+/g, ' ');
    expect(dispatch).toContain('`run_in_background: false`');
    expectMentions(dispatch, [['待機ツール']], 'dispatch');
    expectMentions(dispatch, [['待機中', '先へ進', 'いけません']], 'dispatch');
    const fixes = ceo.slice(ceo.indexOf('**Step 2:'), ceo.indexOf('**Step 3:')).replace(/\s+/g, ' ');
    ordered(fixes, ['0D を使い', '作業用プランと CEO サマリーを修正', '再ディスパッチ']);
    expectMentions(fixes, [['3 回目のレビュー', '停止']], 'fixes');
    expect(fixes).toContain('ループを止めます');
    expectMentions(fixes, [['レビュアー', '成功', '必須ではありません']], 'fixes');
    expectMentions(fixes, [['スコアがない', '不要']], 'fixes');
    expect(report).toContain('"## Reviewer Concerns"');
    expect(report).toContain('SCORE は、2 つの完全な入力をレビューした最新の試行');
    expect(report).toContain('"prior review score"');
    expect(report).toContain('未保存として');
    expect(report).toContain('**0H の spec-review メトリクス**');
    expectMentions(report, [['停止', '完了']], 'report');
    expect(report).toContain('GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"');
    expect(report).toContain('mkdir -p "$GSTACK_STATE_ROOT/analytics" || exit 1');
    expect(report).toContain('>> "$GSTACK_STATE_ROOT/analytics/spec-review.jsonl" || exit 1');
    expect(report).not.toContain('Your doc survived');
  });

  test('CEO spec report separates findings, confirmed fixes, and unresolved concerns', () => {
    const report = render('plan-ceo-review').split('**Step 3: Report and persist metrics(指標の報告と保存)**')[1]!.replace(/\s+/g, ' ');
    expect(report).toContain('ITERATIONS は実際のレビュアー起動回数');
    ordered(report, ['FOUND、FIXED、REMAINING', 'レビュアーが確認した修正']);
    expect(report).toContain('見積もりではなく、実際の数');
    expect(report).not.toContain('M issues caught and fixed');
  });

  test('CEO spec review receives the full source plan as well as the scope artifact on every host', () => {
    for (const host of Object.keys(HOST_PATHS)) {
      const output = render('plan-ceo-review', host).replace(/\s+/g, ' ');
      expectMentions(output, [['両方の入力'], ['5 つの観点'], ['矛盾', '裏づけのない承認済みの拡張']]);
    }
    const source = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md.tmpl'), 'utf8');
    expect(source).toContain('## Plan under review\n{working plan path, or');
    const template = source.replace(/\s+/g, ' ');
    expectMentions(template, [['要約', '代わりにはなりません']], 'template');
  });

  test('CEO shares both inputs after spec review and owns unresolved concerns in its scope document', () => {
    const template = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md.tmpl'), 'utf8');
    const persist = (template.split('### 0H.')[1]?.split('### 0I.')[0] ?? '').replace(/\s+/g, ' ');
    const review = persist.indexOf('{{SPEC_REVIEW_LOOP}}');
    const sharing = persist.search(/最終承認のために両方の入力を提示/);
    expect(review).toBeGreaterThanOrEqual(0);
    expect(sharing).toBeGreaterThan(review);
    const output = render('plan-ceo-review');
    const processing = output.split('**Step 2:')[1]!.split('**Step 3:')[0]!.replace(/\s+/g, ' ');
    const report = output.split('**Step 3:')[1] ?? '';
    expect(report).toContain('CEO サマリー');
    expect(report).toContain('Reviewer Concerns');
    expect(report).toContain('対応する入力');
  });

  test('CEO reviewer receives one complete prompt without duplicate scoring instructions', () => {
    const output = render('plan-ceo-review');
    const dispatch = (output.split('**Step 1: レビュアーのサブエージェントをディスパッチ**')[1]?.split('**Step 2:')[0] ?? '').replace(/\s+/g, ' ');
    expect(dispatch.match(/両方の入力を全文読むこと/g)).toHaveLength(1);
    expect(dispatch.match(/品質スコア/g)).toHaveLength(1);
    expect(dispatch).toContain('品質スコア(1〜10)');
    expectMentions(dispatch, [['全体', 'pass', 'すべての観点']], 'dispatch');
    expectMentions(dispatch, [['pass', '番号付きの問題']], 'dispatch');
    expectMentions(dispatch, [['入力', '要件', '引用']], 'dispatch');
  });

  test('contains all 5 review dimensions', () => {
    for (const dim of ['Completeness', 'Consistency', 'Clarity', 'Scope', 'Feasibility']) {
      expect(content).toContain(dim);
    }
  });

  test('references Agent tool for subagent dispatch', () => {
    expect(content).toMatch(/Agent.*tool/i);
  });

  test('specifies max 3 iterations', () => {
    expect(content).toContain('最大 3 回');
  });

  test('includes quality score', () => {
    expectTokens(content, ['quality_score'], 'content');
  });

  test('includes metrics path', () => {
    expect(content).toContain('spec-review.jsonl');
  });

  test('includes convergence guard', () => {
    expect(content).toMatch(/収束ガード|CONVERGENCE/);
  });

  test('includes graceful failure handling', () => {
    expect(content).toMatch(/skip.*review|unavailable/i);
  });
});

// --- {{DESIGN_SKETCH}} resolver tests ---

describe('DESIGN_SKETCH resolver', () => {
  const content = readSkillUnion('office-hours'); // carved: Phase 5/6 prose moved to section

  test('references DESIGN.md for design system constraints', () => {
    expect(content).toContain('DESIGN.md');
  });

  test('contains wireframe or sketch terminology', () => {
    expect(content).toMatch(/wireframe|sketch/i);
  });

  test('wireframes render through gstack-render (Aside first)', () => {
    expect(content).toContain('gstack-render.ts');
  });

  test('references screenshot capture', () => {
    expect(content).toContain('--screenshot');
  });

  test('specifies rough aesthetic', () => {
    expect(content).toMatch(/[Rr]ough|hand-drawn/);
  });

  test('includes skip conditions', () => {
    expect(content).toMatch(/no UI component|skip/i);
  });
});

// --- {{CODEX_SECOND_OPINION}} resolver tests ---

describe('CODEX_SECOND_OPINION resolver', () => {
  const content = readSkillUnion('office-hours'); // carved: Phase 5/6 prose moved to section
  const codexContent = readExternalSkillUnion(EXTERNAL_OUT, '.agents', 'office-hours');

  test('Phase 3.5 section appears in office-hours SKILL.md', () => {
    expect(content).toContain('Phase 3.5: Cross-Model Second Opinion');
  });

  test('contains codex exec invocation', () => {
    expect(content).toContain('codex exec');
  });

  test('contains cross-model synthesis instructions', () => {
    expect(content).toMatch(/[Ss]ynthesis/);
  });

  test('contains Claude subagent fallback', () => {
    expect(content).toContain('CODEX_MODE: not_installed');
    expectMentions(content, [['プリフライト', 'ready', 'ない'], ['Agent ツール', 'サブエージェント']], 'office-hours');
    expectTokens(content, ['SECOND OPINION (Claude subagent)'], 'office-hours');
  });

  test('contains premise revision check', () => {
    expectMentions(content, [['Codex', '前提', '異議']], 'office-hours');
    expectTokens(content, ['A) Codex の意見に基づいて', 'B) 元の前提を維持する'], 'office-hours');
  });

  test('contains error handling for auth, timeout, and empty', () => {
    expectTokens(content, ['**認証失敗:**', '**タイムアウト:**', '**空のレスポンス:**', 'codex login'], 'office-hours');
  });

  test('Codex host runs Phase 3.5 through Claude Code', () => {
    expect(codexContent).toContain('Phase 3.5: Cross-Model Second Opinion');
    expect(codexContent).toContain('gstack-claude-code');
    expect(codexContent).toContain('Claude Code');
    expect(codexContent).not.toMatch(/codex\s+(?:exec|review)\s/);
  });
});

// --- Codex filesystem boundary tests ---

describe('Codex filesystem boundary', () => {
  // Skills that call codex exec/review and should contain boundary text
  const CODEX_CALLING_SKILLS = [
    'codex',         // /codex skill — 3 modes
    'autoplan',      // /autoplan — CEO/design/eng voices
    'review',        // /review — adversarial step resolver
    'ship',          // /ship — adversarial step resolver
    'plan-eng-review',  // outside voice resolver
    'plan-ceo-review',  // outside voice resolver
    'office-hours',     // second opinion resolver
  ];

  const BOUNDARY_MARKER = /do not read or execute any|読んだり実行したりしないでください/i;

  test('boundary instruction appears in all skills that call codex', () => {
    for (const skill of CODEX_CALLING_SKILLS) {
      // Union: ship's codex call lives in sections/adversarial.md after the carve.
      const content = readSkillUnion(skill);
      expect(content).toMatch(BOUNDARY_MARKER);
    }
  });

  test('codex skill has Filesystem Boundary section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(content).toContain('## ファイルシステムの境界');
  });

  test('codex skill has rabbit-hole detection rule', () => {
    const content = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expectTokens(content, ['gstack-update-check', 'gstack-config', 'skills/gstack'], 'codex');
    expectMentions(content, [['スキルファイル', '迷走'], ['もう一度試す']], 'codex');
  });

  test('outside-voice-steps.ts CODEX_BOUNDARY constant is interpolated into resolver output', () => {
    // The adversarial step resolver should include boundary text in codex exec
    // prompts. Carved: the adversarial step lives in sections/adversarial.md.
    const reviewContent = readSkillUnion('review');
    // Boundary should appear near codex exec invocations
    const boundaryIdx = reviewContent.search(BOUNDARY_MARKER);
    const codexExecIdx = reviewContent.indexOf('codex exec');
    // Both must exist and boundary must come before a codex exec call
    expect(boundaryIdx).toBeGreaterThan(-1);
    expect(codexExecIdx).toBeGreaterThan(-1);
  });

  test('autoplan boundary text avoids host-specific paths for cross-host compatibility', () => {
    const content = fs.readFileSync(path.join(ROOT, 'autoplan', 'SKILL.md.tmpl'), 'utf-8');
    // autoplan template uses generic 'skills/gstack' pattern instead of host-specific
    // paths like ~/.claude/ or .agents/skills (which break Codex/Claude output tests)
    const boundaryStart = content.indexOf('ファイルシステムの境界');
    const boundaryEnd = content.indexOf('---', boundaryStart + 1);
    const boundarySection = content.slice(boundaryStart, boundaryEnd);
    expect(boundarySection).not.toContain('~/.claude/');
    expect(boundarySection).not.toContain('.agents/skills');
    expect(boundarySection).toContain('skills/gstack');
    expect(boundarySection).toMatch(BOUNDARY_MARKER);
  });
});

// --- Codex outside-voice availability probe ---

describe('Codex outside voice is offered behind an executed availability probe', () => {
  test.each(['office-hours', 'plan-ceo-review', 'plan-design-review', 'plan-eng-review'])('%s probes codex and has a not-installed fallback', skill => {
    const content = readSkillUnion(skill);
    expect(content).toContain('command -v codex');
    expect(content).toContain('not_installed');
  });
});

// --- {{BENEFITS_FROM}} resolver tests ---

describe('BENEFITS_FROM resolver', () => {
  const ceoContent = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
  const engContent = readSkillUnion('plan-eng-review'); // carved

  test('plan-ceo-review contains prerequisite skill offer', () => {
    expect(ceoContent).toContain('Prerequisite Skill Offer');
    expect(ceoContent).toContain('/office-hours');
  });

  test('plan-ceo-review offers /office-hours when no design doc exists and detects a lost user mid-session', () => {
    const offer = extractMarkdownSection(ceoContent, '## 前提スキルの提案');
    expectMentions(offer, [['設計ドキュメント', 'No design doc found', '提案']], 'offer');
    expect(offer).toContain('A) 今すぐ /office-hours を実行する');
    expect(offer).toContain('B) スキップ');
    expectMentions(offer, [['再度提案', 'セッション']], 'offer');
    expect(ceoContent).toContain('**セッション途中の検出(0A):**');
    const midSession = ceoContent.indexOf('**セッション途中の検出(0A):**');
    expect(ceoContent.slice(midSession, midSession + 300)).toContain('`/office-hours`');
  });

  test('plan-eng-review contains prerequisite skill offer', () => {
    expect(engContent).toContain('Prerequisite Skill Offer');
    expect(engContent).toContain('/office-hours');
  });

  test('the optional Eng prerequisite ends before mandatory engineering review', () => {
    const offer = extractMarkdownSection(engContent, '## 前提スキルの提案');
    expect(offer).toContain('B) スキップ');
    expectMentions(offer, [['再度提案', 'セッション']], 'offer');
    expect(offer).not.toContain('### Step 0: Scope Challenge');
    const review = extractMarkdownSection(engContent, '## エンジニアリングレビュー');
    expect(review).toContain('### Step 0: Scope Challenge');
    expectMentions(review, [['scope challenge', '前', '必ず']], 'review');
    expect(review).toContain('sections/review-sections.md');
  });

  test('Eng initial and prerequisite recheck both discover the canonical override and fall back on slug failure', () => {
    const initial = extractMarkdownSection(engContent, '### Design Doc Check').match(/```bash\n([\s\S]*?)\n```/)![1]!;
    const offer = extractMarkdownSection(engContent, '## 前提スキルの提案');
    expectTokens(offer, ['**Design Doc Check**'], 'offer');
    expectMentions(offer, [['office-hours', '完了', 'Design Doc Check', '再実行']], 'offer');
    expectMentions(offer, [['新規の実行']], 'offer');
    expectMentions(offer, [['プリアンブル', '前提スキル', 'しません']], 'offer');
    expect(offer).not.toContain('_REVIEW_SLUG=');
    const recheck = initial; // Execute the one canonical block again after the prerequisite.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'eng-design-slug-'));
    try {
      const home = path.join(dir, 'home'), cwd = path.join(dir, 'project');
      const helper = path.join(home, '.claude/skills/gstack/bin/gstack-slug');
      fs.mkdirSync(path.dirname(helper), {recursive: true});
      fs.mkdirSync(cwd);
      fs.copyFileSync(path.join(ROOT, 'bin/gstack-slug'), helper);
      fs.chmodSync(helper, 0o755);
      fs.copyFileSync(path.join(ROOT, 'bin/gstack-state-root.sh'), path.join(path.dirname(helper), 'gstack-state-root.sh'));
      fs.copyFileSync(path.join(ROOT, 'bin/gstack-remote-identity.sh'), path.join(path.dirname(helper), 'gstack-remote-identity.sh'));
      for (const bin of ['gstack-paths', 'gstack-design-doc-find', 'gstack-ceo-plan-find']) {
        fs.copyFileSync(path.join(ROOT, 'bin', bin), path.join(path.dirname(helper), bin));
        fs.chmodSync(path.join(path.dirname(helper), bin), 0o755);
      }
      const expected = path.join(home, '.gstack/projects/canonical-override/session-unknown-design-current.md');
      const wrong = path.join(home, '.gstack/projects/project/session-unknown-design-wrong.md');
      for (const file of [expected, wrong]) {
        fs.mkdirSync(path.dirname(file), {recursive: true});
        fs.writeFileSync(file, '# Design fixture\n');
      }
      const env = {...process.env, HOME: home, GSTACK_HOME: path.join(home, '.gstack'),
        GSTACK_PROJECT_SLUG: 'canonical-override', GIT_CEILING_DIRECTORIES: dir};
      for (const command of [initial, recheck]) {
        // No eval (#2763): worktree-isolated Claude Code sessions refuse it.
        expect(command).toContain('if SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG); then');
        expect(command).toContain('BRANCH=$(~/.claude/skills/gstack/bin/gstack-slug --get BRANCH)');
        expect(command).not.toContain('eval ');
        expect(command).toContain('echo "No design doc found"');
        expect(command).not.toContain('remote-slug');
        const result = runCapturedCommand('bash', ['-c', command], {cwd, env, timeout: 30000, captureStdout: true});
        expect(result.status, result.stderr).toBe(0);
        expect(result.stdout).toContain(`Design doc found: ${expected}`);
        expect(result.stdout).not.toContain(wrong);
      }
      fs.writeFileSync(helper, '#!/usr/bin/env bash\necho "slug fixture failed" >&2\nexit 23\n', {mode: 0o755});
      for (const command of [initial, recheck]) {
        const result = runCapturedCommand('bash', ['-c', command], {cwd, env, timeout: 30000, captureStdout: true});
        expect(result.status).toBe(0);
        expect(result.stderr).toContain('slug fixture failed');
        expect(result.stdout).not.toContain('Design doc found:');
        expect(result.stdout).toContain('No design doc found');
      }
    } finally { fs.rmSync(dir, {recursive: true, force: true}); }
  });

  test('offer includes graceful decline', () => {
    expect(ceoContent).toContain('問題ありません');
  });

  test('skills without benefits-from do NOT have prerequisite offer', () => {
    const qaContent = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expect(qaContent).not.toContain('Prerequisite Skill Offer');
  });

  test('inline invocation — no "another window" language', () => {
    expect(ceoContent).not.toContain('another window');
    expect(engContent).not.toContain('another window');
  });

  test('inline invocation — read-and-follow path present', () => {
    expect(ceoContent).toContain('office-hours/SKILL.md');
    expect(engContent).toContain('office-hours/SKILL.md');
  });

  test('BENEFITS_FROM delegates to INVOKE_SKILL pattern', () => {
    // Should contain the INVOKE_SKILL-style loading prose (not the old manual skip list)
    expectMentions(engContent, [['次のセクション', 'スキップ', '親スキル']], 'plan-eng-review');
  });
  // #1958: spawned/headless sessions have no human to answer the offer.
  test('every prerequisite offer is skipped in spawned and headless sessions, before any option', () => {
    const renders: Array<[string, string]> = [
      ['plan-ceo-review', ceoContent],
      ['plan-eng-review', engContent],
      ['plan-devex-review', readSkillUnion('plan-devex-review')],
      ['autoplan', readSkillUnion('autoplan')],
    ];
    for (const [skill, content] of renders) {
      const offer = extractMarkdownSection(content, '## 前提スキルの提案');
      expectTokens(offer, ['`SESSION_KIND`', '`spawned`', '`headless`'], `${skill} offer`);
      expectMentions(offer, [['session_kind', '省略']], `${skill} offer`);
      expectOrdered(offer, ['`SESSION_KIND`', 'A) 今すぐ /office-hours を実行する'], `${skill} offer`);
    }
  });
});

describe('office-hours closing reads the builder profile before logging the session (#2801)', () => {
  const skeleton = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');
  const handoff = fs.readFileSync(path.join(ROOT, 'office-hours', 'sections', 'design-and-handoff.md'), 'utf-8');
  const phase45 = extractMarkdownSection(skeleton, '## フェーズ 4.5: 創業者シグナルの統合');
  const step1 = between(handoff, '### ステップ 1: ビルダープロファイル', '### ステップ 2:');
  const fence = (text: string, after: string) => between(text, after).match(/```bash\n([\s\S]*?)\n```/)![1]!;
  const readBlock = fence(phase45, '### ビルダープロファイルの読み取り');
  const logBlock = fence(phase45, '### ビルダープロファイルへの追記');
  const CARRY = 'Builder profile before this session:';

  test('Phase 4.5 reads the profile before --log-session and records the prior tier for Phase 6', () => {
    expect(readBlock).toContain('bin/gstack-builder-profile');
    expect(logBlock).toContain('bin/gstack-developer-profile --log-session');
    expectOrdered(phase45, ['bin/gstack-builder-profile', 'bin/gstack-developer-profile --log-session'], 'Phase 4.5');
    expectTokens(phase45, [CARRY, 'PROFILE_READ=', 'SESSION_TIER=', 'PRIOR_SESSION_COUNT=', 'LAST_ASSIGNMENT=', 'CROSS_PROJECT='], 'Phase 4.5');
  });

  test('a failed profile read proceeds as a first session and says so', () => {
    expect(readBlock).toContain('PROFILE_READ: failed');
    expectMentions(phase45, [['failed', 'introduction']], 'Phase 4.5');
    expectMentions(step1, [['failed', 'introduction'], ['読み込めなかった', 'ビルダープロファイル', '初めて']], 'Phase 6 Step 1');
  });

  test('Phase 6 takes tier and last-session fields from the Phase 4.5 line, never from a post-log read', () => {
    expectTokens(step1, [CARRY, 'PRIOR_SESSION_COUNT + 1'], 'Phase 6 Step 1');
    expectMentions(step1, [['tier', 'session_count', '使わない']], 'Phase 6 Step 1');
    expectAbsent(step1, ['SESSION_TIER=$(', 'SESSION_COUNT=$('], 'Phase 6 Step 1');
    const tiers = between(handoff, '### ステップ 2: ティアの経路をたどる', '### 創業者向けリソース');
    expectAbsent(tiers, ['[SESSION_COUNT]', 'from profile]'], 'tier paths');
  });

  test('welcome_back and regular greetings drop a last-session clause whose value is empty', () => {
    const welcomeBack = between(handoff, '### TIER = welcome_back', '### TIER = regular');
    const regular = between(handoff, '### TIER = regular', '### TIER = inner_circle');
    expectTokens(welcomeBack, ['[LAST_ASSIGNMENT]', '[LAST_PROJECT]', '「おかえりなさい。」'], 'welcome_back');
    expectMentions(welcomeBack, [['last_assignment', 'last_project', '空', '省き']], 'welcome_back');
    expectOrdered(welcomeBack, ['前回は [LAST_PROJECT] の話をしましたね', '空の場合'], 'welcome_back');
    expectTokens(regular, ['前回は: [LAST_ASSIGNMENT]'], 'regular');
    expectMentions(regular, [['last_assignment', '空', '省い']], 'regular');
  });

  test('executing the rendered blocks in order: a first session reads introduction, a failed read is marked', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-tier-'));
    try {
      const home = path.join(dir, 'home'), state = path.join(dir, 'state');
      const bin = path.join(home, '.claude/skills/gstack/bin');
      fs.mkdirSync(bin, { recursive: true });
      for (const file of ['gstack-builder-profile', 'gstack-developer-profile', 'gstack-state-root.sh', 'gstack-slug', 'gstack-remote-identity.sh']) {
        fs.copyFileSync(path.join(ROOT, 'bin', file), path.join(bin, file));
        fs.chmodSync(path.join(bin, file), 0o755);
      }
      const env = { ...process.env, HOME: home, GSTACK_HOME: state, GSTACK_STATE_ROOT: state, GIT_CEILING_DIRECTORIES: dir };
      const run = (command: string) => runCapturedCommand('bash', ['-c', command], { cwd: dir, env, timeout: 15000, captureStdout: true });
      const log = logBlock
        .replace('TIMESTAMP', '2026-10-07T00:00:00Z').replace('MODE', 'builder').replace('"SLUG"', '"proj"')
        .replace(':N,', ':2,').replace('SIGNALS_ARRAY', '["taste"]').replace('DOC_PATH', 'd.md')
        .replace('ASSIGNMENT_TEXT', 'Talk to five users').replace('TOPICS_ARRAY', '[]');
      const first = run(readBlock);
      expect(first.status, first.stderr).toBe(0);
      expect(first.stdout).toMatch(/^SESSION_COUNT: 0$/m);
      expect(first.stdout).toMatch(/^TIER: introduction$/m);
      expect(run(log).status).toBe(0);
      const afterLog = run(readBlock);
      expect(afterLog.stdout).toMatch(/^TIER: welcome_back$/m);
      expect(afterLog.stdout).toContain('LAST_ASSIGNMENT: Talk to five users');
      fs.writeFileSync(path.join(bin, 'gstack-builder-profile'), '#!/usr/bin/env bash\nexit 3\n', { mode: 0o755 });
      const failed = run(readBlock);
      expect(failed.status).toBe(0);
      expect(failed.stdout.trim()).toBe('PROFILE_READ: failed');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('office-hours reports success only when this run wrote its design doc (#1049)', () => {
  const skeleton = fs.readFileSync(path.join(ROOT, 'office-hours', 'SKILL.md'), 'utf-8');
  const check = between(skeleton, '## テレメトリの前に: この実行の設計ドキュメントを確認する', '\n## ');
  const block = check.match(/```bash\n([\s\S]*?)\n```/)![1]!;

  test('success requires DESIGN_DOC: ok; a missing doc maps to abort or error, not success', () => {
    expect(block).toContain('bin/gstack-paths --get GSTACK_STATE_ROOT');
    expect(block).not.toMatch(/\bls -t\b|find /);
    expectMentions(check, [['success', 'design_doc: ok'], ['abort', 'error', 'design_doc']], 'design doc check');
    expectOrdered(skeleton, ['## フェーズ 4.5', '## テレメトリの前に: この実行の設計ドキュメントを確認する', '## 重要なルール'], 'office-hours');
  });

  test('the rendered check accepts only this run\'s non-empty doc under the state root', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oh-doc-'));
    try {
      const home = path.join(dir, 'home'), state = path.join(dir, 'state');
      const bin = path.join(home, '.claude/skills/gstack/bin');
      fs.mkdirSync(bin, { recursive: true });
      for (const file of ['gstack-paths', 'gstack-state-root.sh']) {
        fs.copyFileSync(path.join(ROOT, 'bin', file), path.join(bin, file));
        fs.chmodSync(path.join(bin, file), 0o755);
      }
      const doc = path.join(state, 'projects', 'proj', 'me-main-design-20261007-120000.md');
      fs.mkdirSync(path.dirname(doc), { recursive: true });
      fs.writeFileSync(path.join(path.dirname(doc), 'other-main-design-20261007-130000.md'), '# Another session\n');
      const outside = path.join(dir, 'me-main-design-20261007-120000.md');
      fs.writeFileSync(outside, '# Outside the state root\n');
      const env = { ...process.env, HOME: home, GSTACK_HOME: state, GSTACK_STATE_ROOT: state };
      const run = (docPath: string) => {
        const result = runCapturedCommand('bash', ['-c', block.replace('DESIGN_DOC_PATH', docPath)], { cwd: dir, env, timeout: 15000, captureStdout: true });
        expect(result.status, result.stderr).toBe(0);
        return result.stdout.trim();
      };
      expect(run(doc)).toBe('DESIGN_DOC: missing');
      expect(run('')).toBe('DESIGN_DOC: missing');
      expect(run(outside)).toBe('DESIGN_DOC: missing');
      fs.writeFileSync(doc, '');
      expect(run(doc)).toBe('DESIGN_DOC: missing');
      fs.writeFileSync(doc, '# Design: fixture\n');
      expect(run(doc)).toBe('DESIGN_DOC: ok');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});

describe('office-hours shows the design doc before asking for approval (#879)', () => {
  const handoff = fs.readFileSync(path.join(ROOT, 'office-hours', 'sections', 'design-and-handoff.md'), 'utf-8');

  test('the full doc is printed inline as assistant text, after spec review and before the approval question', () => {
    const approval = 'レビュー済みの設計ドキュメントを、AskUserQuestion でユーザーに提示してください';
    const inline = '**承認を求める前に、設計ドキュメントの全文をインラインで出力してください。**';
    const beforeApproval = between(handoff, 'spec-review.jsonl', approval);
    expectMentions(beforeApproval, [['設計ドキュメント', '全文', 'インライン'], ['ツール', '折りたたまれ']], 'pre-approval');
    expectOrdered(handoff, ['spec-review.jsonl', inline, approval, 'A) 承認'], 'design-and-handoff');
  });
});

// --- {{INVOKE_SKILL}} resolver tests ---

describe('INVOKE_SKILL resolver', () => {
  const ceoContent = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');

  test('plan-ceo-review uses INVOKE_SKILL for mid-session office-hours fallback', () => {
    // The mid-session detection path should use INVOKE_SKILL-generated prose
    expect(ceoContent).toContain('office-hours/SKILL.md');
  });

  test('INVOKE_SKILL output includes default skip list', () => {
    expect(ceoContent).toContain('Preamble (run first)');
    expect(ceoContent).toContain('Telemetry (run last)');
    expect(ceoContent).toContain('AskUserQuestion Format');
  });

  test('INVOKE_SKILL output includes error handling', () => {
    expectMentions(ceoContent, [['読み込めない場合', 'スキップ'], ['読み込めなかった', 'スキップ']], 'plan-ceo-review');
  });

  test('template uses {{INVOKE_SKILL:office-hours}} placeholder', () => {
    const tmpl = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md.tmpl'), 'utf-8');
    expect(tmpl).toContain('{{INVOKE_SKILL:office-hours}}');
  });
});

// --- {{CHANGELOG_WORKFLOW}} resolver tests ---

describe('CHANGELOG_WORKFLOW resolver', () => {
  const shipContent = readShipUnion();

  test('ship SKILL.md contains changelog workflow', () => {
    expect(shipContent).toContain('## Step 13: CHANGELOG');
    expect(shipContent).toContain('git log origin/<base>..HEAD --oneline');
  });

  test('changelog workflow includes cross-check step', () => {
    const crossCheck = between(shipContent, '**クロスチェック:**', '**ユーザーに変更内容の説明を求めてはいけません。**');
    expectMentions(crossCheck, [['CHANGELOG', 'コミット一覧', '照合'], ['ユーザー向け', '反映']], 'changelog cross-check');
  });

  test('changelog workflow includes voice guidance', () => {
    expectMentions(shipContent, [['ユーザー', '**できる**', '書き始めます']], 'ship changelog');
  });

  test('template uses {{CHANGELOG_WORKFLOW}} placeholder', () => {
    // Post-carve (T9): the skeleton points to the changelog section, which carries
    // the resolver. Neither should inline the old changelog content.
    const skel = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md.tmpl'), 'utf-8');
    const changelogSection = fs.readFileSync(path.join(ROOT, 'ship', 'sections', 'changelog.md.tmpl'), 'utf-8');
    expect(skel).toContain('{{SECTION:changelog}}');
    expect(changelogSection).toContain('{{CHANGELOG_WORKFLOW}}');
    expect(skel + changelogSection).not.toContain('Group commits by theme');
  });

  test('changelog workflow includes keep-changelog format', () => {
    expect(shipContent).toContain('### Added');
    expect(shipContent).toContain('### Fixed');
  });
});

// --- Duplicate {{PREAMBLE}} guard (#2508/#2362) ---

describe('assertSinglePreamble', () => {
  test('one {{PREAMBLE}} passes', () => {
    expect(() => assertSinglePreamble('a\n{{PREAMBLE}}\nb', 'x/SKILL.md.tmpl')).not.toThrow();
  });

  test('zero {{PREAMBLE}} passes (sections have none)', () => {
    expect(() => assertSinglePreamble('no macro here', 'x/sections/y.md.tmpl')).not.toThrow();
  });

  test('a second occurrence throws with the template path — even in prose', () => {
    // The original #2508 bug WAS a prose mention: "emitted by {{PREAMBLE}}'s
    // preamble bash". Resolution is context-blind, so the guard must be too.
    const tmpl = '{{PREAMBLE}}\n\n...later: emitted by {{PREAMBLE}}\'s preamble bash';
    expect(() => assertSinglePreamble(tmpl, 'spec/SKILL.md.tmpl')).toThrow(/spec\/SKILL\.md\.tmpl.*2 times/);
  });
});

// --- Parameterized resolver infrastructure tests ---

describe('parameterized resolver support', () => {
  test('gen-skill-docs regex handles colon-separated args', () => {
    // Verify the template containing {{INVOKE_SKILL:office-hours}} was processed
    // without leaving unresolved placeholders
    const ceoContent = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(ceoContent).not.toMatch(/\{\{INVOKE_SKILL:[^}]+\}\}/);
  });

  test('templates with parameterized resolvers pass unresolved check', () => {
    // All generated SKILL.md files should have no unresolved {{...}} placeholders
    const skillDirs = fs.readdirSync(ROOT).filter(d =>
      fs.existsSync(path.join(ROOT, d, 'SKILL.md'))
    );
    for (const dir of skillDirs) {
      const content = fs.readFileSync(path.join(ROOT, dir, 'SKILL.md'), 'utf-8');
      const unresolved = content.match(/\{\{[A-Z_]+(?::[^}]*)?\}\}/g);
      if (unresolved) {
        throw new Error(`${dir}/SKILL.md has unresolved placeholders: ${unresolved.join(', ')}`);
      }
    }
  });
});

// --- Preamble routing injection tests ---

describe('preamble routing injection (bin/gstack-skill-start emission layer)', () => {
  // Token-reduction Phase 2: the routing-injection prose left the rendered
  // preamble entirely — bin/gstack-skill-start probes, gates, and emits the
  // whole flow as a GSTACK_INSTRUCTION block (with the AUQ, the routing rules
  // to append, and the decline ack all INSIDE the block). Absence from the
  // renders is pinned by test/onboarding-moved-literals.test.ts (tombstone);
  // this suite pins the gate structure and the emitted block's content.
  const routingBlock = (() => {
    const start = SKILL_START_SCRIPT.indexOf('_emit_block routing-injection');
    expect(start).toBeGreaterThan(0);
    return SKILL_START_SCRIPT.slice(start, SKILL_START_SCRIPT.indexOf('\nEOI', start));
  })();

  test('routing probe checks CLAUDE.md and AGENTS.md (now in gstack-skill-start)', () => {
    // #2500: the probe iterates CLAUDE.md AND AGENTS.md — non-Claude hosts
    // route skills via AGENTS.md, the cross-harness convention file.
    expect(SKILL_START_SCRIPT).toContain('for _RF in CLAUDE.md AGENTS.md');
    expect(SKILL_START_SCRIPT).toContain('grep -q "## Skill routing" "$_RF"');
    expect(SKILL_START_SCRIPT).toContain('echo "HAS_ROUTING: $_HAS_ROUTING"');
  });

  test('script reads and echoes routing_declined config', () => {
    expect(SKILL_START_SCRIPT).toMatch(/_ROUTING_DECLINED=\$\("\$_BIN\/gstack-config" get routing_declined/);
    expect(SKILL_START_SCRIPT).toContain('echo "ROUTING_DECLINED: $_ROUTING_DECLINED"');
  });

  test('emitted block carries the routing injection AskUserQuestion', () => {
    expect(routingBlock).toContain('Add routing rules to CLAUDE.md');
    expect(routingBlock).toContain("I'll invoke skills manually");
  });

  test('routing injection respects prior decline (gate + in-block ack)', () => {
    expect(SKILL_START_SCRIPT).toContain('[ "$_ROUTING_DECLINED" = "false" ]');
    expect(routingBlock).toMatch(/routing_declined.*true/);
    expect(routingBlock).toContain('re-enable with `__BIN__/gstack-config set routing_declined false`');
  });

  test('routing injection only fires when all conditions met', () => {
    // Must be: HAS_ROUTING=no AND ROUTING_DECLINED=false AND PROACTIVE_PROMPTED=yes
    expect(SKILL_START_SCRIPT).toContain(
      'if [ "$_HAS_ROUTING" = "no" ] && [ "$_ROUTING_DECLINED" = "false" ] && [ "$_PROACTIVE_PROMPTED" = "yes" ]; then',
    );
  });

  test('routing section content includes key routing rules', () => {
    expect(routingBlock).toContain('invoke /office-hours');
    expect(routingBlock).toContain('invoke /investigate');
    expect(routingBlock).toContain('invoke /ship');
    expect(routingBlock).toContain('invoke /qa');
  });

  test('routing section uses renamed checkpoint skills (not stale /checkpoint)', () => {
    expect(routingBlock).toContain('invoke /context-save');
    expect(routingBlock).toContain('invoke /context-restore');
    expect(routingBlock).not.toContain('invoke checkpoint');
  });

  test('routing section routes only to available skills, without "when in doubt" over-triggering (#3018)', () => {
    expect(routingBlock).toContain("Route only to skills in the session's available-skills list");
    expect(routingBlock).not.toContain('When in doubt');
    expect(routingBlock).not.toContain('Do NOT answer directly');
  });

  test('root router skips routes to skills that are not loaded and says when not to invoke (#3018)', () => {
    const router = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expectMentions(router, [['利用可能なスキル一覧', 'のみ'], ['読み飛ばし', '呼び出そうとしない'], ['どのスキルにも該当しない', '直接回答']], 'root router');
    expect(router).not.toContain('When in doubt, invoke the skill');
  });
});

// --- {{DESIGN_OUTSIDE_VOICES}} resolver tests ---

describe('DESIGN_OUTSIDE_VOICES resolver', () => {
  test('plan-design-review contains outside voices section', () => {
    const content = readSkillUnion('plan-design-review');
    expect(content).toContain('Design Outside Voices');
    expect(content).toContain('CODEX_MODE: ready');
    expect(content).toContain('LITMUS SCORECARD');
  });

  test('design-review contains outside voices section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Outside Voices');
    expect(content).toContain('source audit');
  });

  test('design-consultation contains outside voices section', () => {
    const content = readSkillUnion('design-consultation');
    expect(content).toContain('Design Outside Voices');
    expect(content).toContain('design direction');
  });

  test('consultation dispatch shares the complete brief without executing product text', () => {
    const content = readSkillUnion('design-consultation');
    const command = [...content.matchAll(/```bash\n([\s\S]*?)```/g)]
      .map(match => match[1]).find(block => block.includes('codex exec'))!;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'design-brief-contract-'));
    const quote = (value: string) => "'" + value.replaceAll("'", "'\\''") + "'";
    try {
      const brief = path.join(dir, 'product.md');
      const capture = path.join(dir, 'argv.json');
      const marker = path.join(dir, 'must-not-execute');
      const product = `A product with $(touch ${marker}), \`touch ${marker}\`, and "quotes".\nUsers: builders.\n`;
      fs.writeFileSync(brief, product);
      // Fake codex: the free sandbox preflight succeeds; exec writes its final message to -o.
      fs.writeFileSync(path.join(dir, 'codex'), `#!${process.execPath}\nconst fs = require('fs'); const a = process.argv.slice(2); if (a[0] === 'sandbox') process.exit(0);\nfs.writeFileSync(process.env.CAPTURE, JSON.stringify({ args: a, stdin: a[1] === '-' ? fs.readFileSync(0, 'utf8') : '' }));\nconst msg = 'Recommendation: choose a clear hierarchy because builders need to find their work.';\nif (a.includes('-o')) fs.writeFileSync(a[a.indexOf('-o') + 1], msg);\nconsole.log(msg);\n`, { mode: 0o700 });
      const prepare = (file: string) => command.replace("'<prepared-prompt-file>'", quote(file))
        .replaceAll('$HOME/.claude/skills/gstack', ROOT);
      const env = { ...process.env, PATH: dir + path.delimiter + process.env.PATH, CAPTURE: capture,
        CODEX_THREAD_ID: '', CODEX_SANDBOX: '', CLAUDECODE: '1', GSTACK_ACTIVE_HOST: 'claude',
        GSTACK_HOME: path.join(dir, 'state'), GSTACK_STATE_ROOT: '' };
      const result = spawnSync('bash', ['-c', prepare(brief)], { cwd: ROOT, env, encoding: 'utf8', timeout: 5_000 });
      expect(result.status, result.stderr).toBe(0);
      const { args, stdin } = JSON.parse(fs.readFileSync(capture, 'utf8'));
      expect(args[0]).toBe('exec');
      expect(args[1]).toBe('-');
      expect(stdin).toBe(product);
      expect(args).toContain('read-only');
      expect(fs.readFileSync(brief, 'utf8')).toBe(product);
      expect(fs.existsSync(marker)).toBe(false);
      fs.unlinkSync(capture);
      const missing = spawnSync('bash', ['-c', prepare(path.join(dir, 'absent'))], { cwd: ROOT, env, encoding: 'utf8', timeout: 5_000 });
      expect(missing.status).not.toBe(0);
      expect(missing.stderr).toContain('No such file');
      expect(fs.existsSync(capture)).toBe(false);
      expectMentions(content, [['両方のボイス', '待', '統合'], ['ネイティブのボイスのみ'], ['ネイティブの Agent', '絶対パス']], 'design-consultation');
      expectTokens(content, ['[上に表示された DESIGN_BRIEF の絶対パス]'], 'design-consultation');
      expectMentions(content, [['確認できないフェイス', '省略']], 'design-consultation');
      expect(content).toContain('a face may serve multiple roles');
      expect(content).not.toContain('a single question that covers everything');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  test('branches correctly per skillName — different prompts', () => {
    const planContent = readSkillUnion('plan-design-review');
    const consultContent = readSkillUnion('design-consultation');
    // plan-design-review uses analytical prompt (high reasoning); run-with-timeout
    // turns --effort X into -c model_reasoning_effort="X" (test/codex-probe-subcommands.test.ts)
    expect(planContent).toContain('run-with-timeout --effort high ');
    expect(planContent).not.toContain('--effort medium');
    // design-consultation uses creative prompt (medium reasoning)
    expect(consultContent).toContain('run-with-timeout --effort medium ');
    expect(consultContent).not.toContain('--effort high');
  });
});

// --- {{DESIGN_HARD_RULES}} resolver tests ---

describe('DESIGN_HARD_RULES resolver', () => {
  test('plan-design-review Pass 4 contains hard rules', () => {
    const content = readSkillUnion('plan-design-review');
    expect(content).toContain('Design Hard Rules');
    expect(content).toContain('Classifier');
    expect(content).toContain('MARKETING/LANDING PAGE');
    expect(content).toContain('APP UI');
  });

  test('design-review contains hard rules', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Design Hard Rules');
  });

  test('includes all 3 rule sets', () => {
    const content = readSkillUnion('plan-design-review');
    expect(content).toContain('Landing page rules');
    expect(content).toContain('App UI rules');
    expect(content).toContain('Universal rules');
  });

  test('classifier names the four visitor modes and keeps the legacy aliases', () => {
    const content = readSkillUnion('plan-design-review');
    for (const mode of ['PERSUADE', 'OPERATE', 'READ', 'EXPERIENCE', 'HYBRID']) expect(content).toContain(`**${mode}**`);
    expect(content).toContain('Read rules');
    expect(content).toContain('Experience rules');
    expectMentions(content, [['HYBRID', 'ページ単位', 'セクション単位']], 'content');
  });

  test('carries the craft-floor reflexes and the three-looks calibration', () => {
    const content = readSkillUnion('plan-design-review');
    expectMentions(content, [['ディテクター', '反射的な習慣']], 'content');
    expect(content).toContain('Browser surfaces carry the design');
    expect(content).toContain('One authored motion moment');
    expect(content).toContain('Depth has an offset');
    expect(content).toContain('Light or dark comes from the use scene');
    expect(content).toContain('Calibration: the three looks');
  });

  test('slop section lists detector rule ids and judgment tells outside design-review', () => {
    const content = readSkillUnion('plan-design-review');
    expect(content).toContain('nested-cards: Nested cards');
    expectMentions(content, [['ディテクタールール', '判断']], 'content');
    // Never a bracketed gstack-only id.
    expect(content).not.toContain('[hero-metrics]');
  });

  test('design-consultation carries the font procedure, role-scoped lists, color strategies, and catalog bullets', () => {
    const content = readSkillUnion('design-consultation');
    expectMentions(content, [['フェイスの選び方', '手順']], 'content');
    expectMentions(content, [['Display', '使われすぎ'], ['overused-font', 'フラグ']], 'content');
    expectMentions(content, [['どの役割でも禁止', 'Papyrus']], 'content');
    expectTokens(content, ['Restrained', 'Committed', 'Full palette', 'Drenched'], 'content');
    expectMentions(content, [['ライト/ダーク', '調整つまみ']], 'content');
    expectMentions(content, [['ルック 1 番'], ['ルック 2 番']], 'content');
    // Bullets are prose only: never a bracketed rule id in the proposal skill.
    expectMentions(content, [['カードの中のカード', '間違い']], 'content');
    expect(content).not.toMatch(/^- \[[a-z-]+\] /m);
    // The old menu is gone.
    expectAbsent(content, ['Font recommendations by purpose'], 'content');
  });

  test('design-html blacklist lines carry catalog ids', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-html', 'SKILL.md'), 'utf-8');
    expectMentions(content, [['AI スロップのブラックリスト']], 'content');
    expect(content).toContain('デフォルトとしての紫/青のグラデーション <!-- ai-color-palette -->');
    expect(content).toContain('lib/design-catalog.ts');
  });

  test('design-review renders the catalog once: Methodology category 9 carries it, Hard Rules points at it', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content.split('### Design Hard Rules').length - 1).toBe(1);
    // Category 9 lists the rule once (ids only); Typography points at the same id from its overused-face item.
    expect(content.split('[overused-font]').length - 1).toBe(2);
    expectMentions(content, [['Methodology', 'カテゴリ 9']], 'content');
    expect(content).toContain('**9. AI Slop Detection**');
    expectMentions(content, [['ディテクタールール', 'id のみ']], 'content');
    expect(content).toContain('[nested-cards] nested cards');
    expectMentions(content, [['判断で見つける兆候', 'ディテクタールールなし']], 'content');
    // The legacy blacklist is not repeated as a numbered list in design-review.
    expect(content).not.toMatch(/^1\. Purple\/violet\/indigo/m);
  });

  test('references shared AI slop blacklist items', () => {
    const content = readSkillUnion('plan-design-review');
    expect(content).toContain('3-column feature grid');
    expectMentions(content, [['紫', 'インディゴ', 'グラデーション']], 'content');
  });

  test('includes OpenAI hard rejection criteria', () => {
    const content = readSkillUnion('plan-design-review');
    expectMentions(content, [['SaaS', 'カードグリッド'], ['カルーセル']], 'content');
  });

  test('includes OpenAI litmus checks', () => {
    const content = readSkillUnion('plan-design-review');
    expectMentions(content, [['Litmus checks', 'YES/NO'], ['ブランド', 'プロダクト', 'はっきり']], 'content');
  });
});

describe('Design approval reconciliation', () => {
  test('token alignment reuses the approved outcome while preserving first decisions and new tradeoffs', () => {
    const section = fs.readFileSync(path.join(ROOT, 'plan-design-review/sections/review-sections.md'), 'utf8');
    const pass = extractMarkdownSection(section, '### パス 5: デザインシステムとの整合');
    const ask = pass.search(/\*\*(?:STOP\.|停止。)\*\*/);
    expect(ask).toBeGreaterThan(0);
    const beforeQuestion = pass.slice(0, ask);
    expectMentions(beforeQuestion, [['以前のパス', '承認'], ['新しい指摘', 'なりません'], ['新しい証拠', '再度質問']], 'beforeQuestion');
  });

  test('loaded review section distinguishes individual issue decisions from navigation', () => {
    const section = fs.readFileSync(path.join(ROOT, 'plan-design-review/sections/review-sections.md'), 'utf8').replace(/\s+/g, ' ');
    expectMentions(section, [['次のステップ', '承認しません'], ['次のステップ', 'AskUserQuestion', '使わないでください'], ['未解決の指摘事項がなければ', '不要']], 'section');
  });

  test('Design blocking Exit checklist reconciles approvals and refreshes stale output after a decision', () => {
    const main = fs.readFileSync(path.join(ROOT, 'plan-design-review/SKILL.md'), 'utf8');
    const check = extractMarkdownSection(main, '## セクションの自己チェック');
    expectMentions(check, [['承認チェック0']], 'check');
    const gate = extractMarkdownSection(main, '## EXIT PLAN MODE GATE (BLOCKING)').replace(/\s+/g, ' ');
    ordered(gate, ['0. 承認:', '1. 直近の書き込みのあとに']);
    const approvals = gate.slice(gate.indexOf('0. 承認:'), gate.indexOf('1. 直近の書き込みのあとに'));
    expectMentions(approvals, [['異なる課題', 'まとめてはいけません'], ['navigation', '承認ではありません'], ['プリアンブルで許可された', '自動決定'], ['先送り', '未解決のまま'], ['保留', 'pending', '質問して待ちます']], 'approvals');
    ordered(approvals, ['プランとレポートを更新し', 'Read-back ゲート', 'このゲートを再実行']);
  });

  test('CEO readiness binds actual approvals before its read-only exit verification', () => {
    const main = fs.readFileSync(path.join(ROOT, 'plan-ceo-review/SKILL.md'), 'utf8');
    const check = extractMarkdownSection(main, '## セクションの自己チェック').replace(/\s+/g, ' ');
    const gate = extractMarkdownSection(main, '## EXIT PLAN MODE GATE (BLOCKING)').replace(/\s+/g, ' ');
    const section = fs.readFileSync(path.join(ROOT, 'plan-ceo-review/sections/review-sections.md'), 'utf8');
    const readiness = extractMarkdownSection(section, '## Approval readiness').replace(/\s+/g, ' ');
    expect(section.indexOf('## Approval readiness')).toBeLessThan(section.indexOf('## 必須の出力'));
    expectMentions(readiness, [['プリアンブルで許可された', '正確な事前承認'], ['ナビゲーション', '是正策の承認ではありません'], ['アプローチが承認する', 'コミットメント'], ['回答の範囲だけ'], ['デリバリー範囲の先送り', '決着済み'], ['その選択は未解決のまま'], ['ナビゲーションだけでは無効になりません']], 'readiness');
    expect(readiness).toContain('`Approval readiness: PASS`');
    expectMentions(main.replace(/\s+/g, ' '), [['既定', '実装可能な水準']], 'main');
    ordered(gate, ['読み取り専用の検証', '`Approval readiness: PASS` を', '1. 直近の書き込みのあとに']);
    expectMentions(gate, [['その選択についてだけ', '0D に戻ります'], ['ExitPlanMode', 'テレメトリ', 'なしで終えてください']], 'gate');
    expect(gate).toContain('**Gate outcome: Blocked**');
    expectMentions(main, [['ログのみの欠落を伴う合格']], 'main');
    expect(check).toContain('`sections/review-sections.md`');
    expectMentions(check, [['止めて', '読み直し']], 'check');
    const decisions = main.slice(main.indexOf('### 0D.'), main.indexOf('### 0E.')).replace(/\s+/g, ' ');
    ordered(decisions, ['**まず、その質問のルートを選んでください:**', '**管理上の質問:**', '**プランの判断:**']);
    expectMentions(decisions, [['以前の承認', '正確に再利用']], 'decisions');
    expect(decisions).toContain('`D<N> — <ROW-ID>: <一行の質問>`');
    const row = decisions.slice(decisions.indexOf('**質問前のチェックポイント:**'), decisions.indexOf('労力とリスクは、それぞれ'));
    for (const field of ['ID', '所有者', '現在と提案', '状態', '正確な承認とスコープ']) expect(row).toContain(field);
    expectMentions(decisions.slice(decisions.indexOf('**4. 質問し')), [['実際の回答', '停止']], 'section');
    expectMentions(decisions, [['許可された作業だけを修正'], ['矛盾', 'ユーザーの指示', '再検討'], ['問題なし、次に進みます']], 'decisions');
    const outside = extractMarkdownSection(section, '**Cross-model tension(モデル間の緊張関係):**').replace(/\s+/g, ' ');
    expectMentions(outside, [['外部のレビュアー', '完了した場合に限って']], 'outside');
    expect(outside).toContain('CROSS-MODEL');
    const findings = extractMarkdownSection(section, '**Integrate reviewer findings(レビュアーの指摘の統合):**').replace(/\s+/g, ' ');
    expectMentions(findings, [['範囲を限定したネイティブのフォールバック']], 'findings');
    expect(findings).toContain('Outside Voice Integration Rule');
  });

  test('Eng cannot exit with unasked findings listed only in an unresolved-decisions report', () => {
    const main = fs.readFileSync(path.join(ROOT, 'plan-eng-review/SKILL.md'), 'utf8');
    const rawGate = extractMarkdownSection(main, '## EXIT PLAN MODE GATE (BLOCKING)');
    const gate = rawGate.replace(/\s+/g, ' ');
    const section = fs.readFileSync(path.join(ROOT, 'plan-eng-review/sections/review-sections.md'), 'utf8');
    const readiness = extractMarkdownSection(section, '## Approval readiness');
    const normalizedReadiness = readiness.replace(/\s+/g, ' ');
    expect(section.indexOf('## Approval readiness')).toBeLessThan(section.indexOf('## Required outputs'));
    expect(normalizedReadiness).toContain('`Approval readiness: PASS`');
    expectMentions(normalizedReadiness, [['ナビゲーションだけでは無効になりません']], 'normalizedReadiness');
    expect(readiness).not.toMatch(/^ {3}\S/m);
    expectMentions(gate, [['Approval readiness が通っていることを確認'], ['読み取り専用', '承認でも書き込みでもありません']], 'gate');
    const approvalParagraph = rawGate.slice(rawGate.indexOf('現在の決定事項について'), rawGate.indexOf('5 つのチェックをすべて検証します'));
    expect(approvalParagraph).not.toMatch(/^ {3}\S/m);
    expect([...rawGate.matchAll(/^([1-5])\. /gm)].map(match => match[1])).toEqual(['1', '2', '3', '4', '5']);
    ordered(gate, ['現在の決定事項について Approval readiness', '1. 直近の書き込みのあとに、レポートファイルを Read']);
    expectMentions(normalizedReadiness, [['承認済みのすべての是正策', '台帳'], ['実際の回答', '正確な事前承認', '許可された自動決定'], ['ナビゲーション', '数えません'], ['先送り', '未解決のまま'], ['専用の決定', '1 つ'], ['ドラフト', '保留', 'pending']], 'normalizedReadiness');
    const decisionStart = section.indexOf('\n## Decision procedure(決定の手順)\n');
    const decisionEnd = section.indexOf('\n## Scope Challenge(スコープチャレンジ)\n', decisionStart);
    expect(decisionStart).toBeGreaterThan(0);
    expect(decisionEnd).toBeGreaterThan(decisionStart);
    const decisions = section.slice(decisionStart, decisionEnd).replace(/\s+/g, ' ');
    expect(decisions).toContain('AskUserQuestion({ questions: [currentDecision] })');
    const ask = decisions.indexOf('AskUserQuestion({ questions: [currentDecision] })');
    const stop = decisions.search(/実際の回答が届くまで STOP/);
    expect(stop).toBeGreaterThan(ask);
    expect(stop).toBeLessThan(decisions.indexOf('### 回答を記録する'));
    expectMentions(gate, [['古くなっている場合', '検証が古い', '停止します']], 'gate');
    expect(gate).toContain('**Recovery routing → Late change or missing work**');
    const recovery = readSkillUnion('plan-eng-review').split('**後からの変更や作業の欠落:**')[1]!.split('**Blocked outcome:**')[0]!.replace(/\s+/g, ' ');
    ordered(recovery, ['Approval readiness を繰り返し', 'Required outputs', '次の遷移を選びます']);
    expect(gate).toContain('**Blocked outcome**');
    const report = extractMarkdownSection(section, '### レポートファイルに書き込む');
    expect(report).toContain('**Blocked outcome**');
    expectMentions(report.replace(/\s+/g, ' '), [['レビューログ', '**Blocked outcome**', '従います']], 'report');
  });

  test('approval entry does not alter other review Exit checklists', () => {
    for (const skill of ['plan-devex-review']) {
      const gate = extractMarkdownSection(readSkillUnion(skill), '## EXIT PLAN MODE GATE (BLOCKING)');
      expect(gate).not.toContain('0. 承認:');
      expect(gate).toContain('1. 直近の書き込みのあとに');
      expect(gate).toContain('5. このスキルの呼び出しの文脈にプランファイルがある場合');
    }
  });

  test('task and decision reporting require approval while preserving unanswered findings', () => {
    const section = fs.readFileSync(path.join(ROOT, 'plan-design-review/sections/review-sections.md'), 'utf8').replace(/\s+/g, ' ');
    const reconcile = section.search(/タスクや完了サマリーをまとめる前に/);
    expect(reconcile).toBeGreaterThan(0);
    expect(reconcile).toBeLessThan(section.indexOf('## Implementation Tasks'));
    expectMentions(section, [['個別に承認された', '決定'], ['提案された修正', '0件']], 'section');
  });
});

// --- {{DESIGN_DETECTOR}} resolver tests ---

describe('DESIGN_DETECTOR resolver', () => {
  const designReview = () => fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
  const designHtml = () => fs.readFileSync(path.join(ROOT, 'design-html', 'SKILL.md'), 'utf-8');
  const bashBlocksOf = (content: string) => [...content.matchAll(/```bash\n([\s\S]*?)```/g)].map(m => m[1]);

  test('design-review carries the probe, Phase 0, the DOM dump, and the run id', () => {
    const c = designReview();
    expect(c).toContain('gstack-design-detect.ts probe --host claude');
    expect(c).toContain('IMPECCABLE_READY');
    // the consent-gated install: offered once, only on the probe's say-so, never in spawned sessions, never via npx
    expect(c).toContain('DESIGN_DETECTOR_INSTALL_OFFER');
    expect(c).toContain('gstack-design-detect.ts install --host claude');
    expectMentions(c, [['Install offer', '質問は 1 つ']], 'c');
    expect(c).toContain('gstack-config set design_detector_install_prompted true');
    expectMentions(c, [['SESSION_KIND: spawned', 'ヘッドレス', 'インストールも質問もせず']], 'c');
    expect(c).toContain('**Phase 0: mechanical scan**');
    expect(c).toContain('scan --changed <base> --format gstack --host claude');
    expect(c).toContain('### DOM dump(DOM モードのみ');
    expect(c).toContain('data-gstack-dom-css');
    expect(c).toContain(`$B js '('"$_DUMP"')()' --out "$_TMP/{page}.dom.html" --raw`);
    expect(c).toContain('DOM_DUMP_OK');
    expect(c).toContain('DOM_DUMP_REDACTION_BLOCKED');
    expect(c).toContain('DOM_DUMP_TOO_LARGE');
    expect(c).toContain('REPORT_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/designs/design-audit-$(date +%Y%m%d)"');
    expect(c).toContain('RUN_ID="$(date +%H%M%S)-$$"');
    expect(c).toContain('"schemaVersion": 2');
    expect(c).toContain('engine changed X → Y; rule set may differ');
    expect(c).toContain('Detector: N → M');
    expect(c).toContain('/impeccable typeset');
  });

  test('the DOM-dump script is loaded from lib/dom-dump.js, never inlined in the prose', () => {
    const c = designReview();
    expect(c).not.toMatch(/```js\n/);
    expect(c).not.toContain('document.documentElement.cloneNode');
    expect(c).toContain('_DUMP=$(cat "$HOME/.claude/skills/gstack/lib/dom-dump.js")');
    expect(c).toContain(`const html = await pg.evaluate('"$_DUMP"');`);
    expect(c).toContain('_TMP=$(mktemp -d "${TMPDIR:-/tmp}/gstack-dom.XXXXXX"); _DUMP=$(cat "$HOME/.claude/skills/gstack/lib/dom-dump.js")');
  });

  test('every rendered Aside script is single-quoted: a page-controlled <url> is never inside a double-quoted bash string', () => {
    const files = [...fs.readdirSync(ROOT).filter(d => fs.existsSync(path.join(ROOT, d, 'SKILL.md'))).map(d => path.join(ROOT, d, 'SKILL.md')),
      ...fs.readdirSync(ROOT).flatMap(d => fs.existsSync(path.join(ROOT, d, 'sections')) ? fs.readdirSync(path.join(ROOT, d, 'sections')).filter(f => f.endsWith('.md')).map(f => path.join(ROOT, d, 'sections', f)) : [])];
    expect(files.length).toBeGreaterThan(10);
    for (const f of files) {
      const c = fs.readFileSync(f, 'utf-8');
      expect(c, path.relative(ROOT, f)).not.toMatch(/^aside repl "/m);
    }
  });

  test('the E2E fixture slice markers exist in the rendered design skills (a template rename fails here, not in paid CI)', () => {
    const dr = designReview();
    const dh = fs.readFileSync(path.join(ROOT, 'design-html', 'SKILL.md'), 'utf-8');
    for (const [a, b] of [['**Design detector(任意、決定的):**', '**出力ディレクトリを作成します:**'], ['**Phase 0: mechanical scan**', '## フェーズ 1-6'], ['### DOM dump(DOM モードのみ', '### Auth Detection']]) {
      expect(sliceBetween(dr, a, b).length, `${a} .. ${b}`).toBeGreaterThan(100);
    }
    for (const [a, b] of [['**Design detector(任意、決定的):**', '## Step 0: 入力の検出'], ['### Slop Gate(上限あり、ループにしない)', '### 検証用スクリーンショット']]) {
      expect(sliceBetween(dh, a, b).length, `${a} .. ${b}`).toBeGreaterThan(100);
    }
  });

  test('design-html carries the probe and the bounded slop gate', () => {
    const c = designHtml();
    expect(c).toContain('gstack-design-detect.ts probe --host claude');
    expect(c).toContain('### Slop Gate(上限あり、ループにしない)');
    expectMentions(c, [['1 パス', 'スキャン']], 'c');
    expect(c).toContain('impeccable-disable <rule>: <reason>');
  });

  test('ship and review unions reach the detector through review-lite and the checklist', () => {
    const ship = readSkillUnion('ship');
    expectMentions(ship, [['まず機械的なパスを実行します']], 'ship');
    expect(ship).toContain('scan --changed <base> --format gstack --host claude');
    expect(ship).toContain('"detector":D');
    expect(ship).toContain('Detector: "clean" | "N findings');
    const review = readSkillUnion('review');
    const checklist = fs.readFileSync(path.join(ROOT, 'review', 'design-checklist.md'), 'utf-8');
    expect(checklist).toContain('**0. まず機械的なパス。**');
    expect(checklist).toContain('IMPECCABLE_READY');
  });

  test('every rendered invocation uses bun --no-env-file and ends a scan with the exit echo; no bash block runs npx impeccable', () => {
    for (const content of [designReview(), designHtml(), readSkillUnion('ship'), readSkillUnion('review'), fs.readFileSync(path.join(ROOT, 'review', 'design-checklist.md'), 'utf-8')]) {
      for (const block of bashBlocksOf(content)) {
        expect(block).not.toContain('npx impeccable');
        for (const line of block.split('\n')) {
          if (!line.includes('gstack-design-detect.ts')) continue;
          expect(line).toContain('bun --no-env-file --config=/dev/null run ');
          if (/gstack-design-detect\.ts scan /.test(line)) expect(line).toContain('echo "DETECT_EXIT_CODE=$?"');
        }
      }
    }
  });

  test('--host is rendered per host', () => {
    // Fresh codex render into a temp out-dir: the tracked tree is Claude-only and
    // the gitignored .agents/ copy may be stale.
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-detector-host-'));
    try {
      const r = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--out-dir', out], { cwd: ROOT, timeout: 120_000 });
      expect(r.exitCode).toBe(0);
      const codex = fs.readFileSync(path.join(out, '.agents', 'skills', 'gstack-design-review', 'SKILL.md'), 'utf-8');
      expect(codex).toContain('gstack-design-detect.ts probe --host codex');
      expect(codex).not.toContain('probe --host claude');
      expect(codex).toContain('$GSTACK_ROOT/lib/dom-dump.js');
    } finally {
      fs.rmSync(out, { recursive: true, force: true });
    }
  });
});

// --- {{DESIGN_MD_CHECK}} resolver + open DESIGN.md adoption ---

describe('DESIGN_MD_CHECK resolver and open DESIGN.md adoption', () => {
  test('design-consultation asks the conversion question once and writes the spec form', () => {
    const c = readSkillUnion('design-consultation');
    expect(c).toContain('gstack-design-md.ts check DESIGN.md');
    expect(c).toContain('DESIGN_MD_FORMAT: spec');
    expect(c).toContain('mark legacy-keep');
    expect(c).toContain('convert --write');
    expect(c).toContain('# gstack: design-md-format=spec');
    expect(c).toContain("## Do's and Don'ts");
    expect(c).toContain('## Elevation & Depth');
    expect(c).toContain('fontFeature: tnum');
    expect(c).toContain('"{colors.primary}"');
    // the legacy template is gone
    expect(c).not.toContain('## Product Context\n- **What this is:**');
  });

  test('design-review calibrates against tokens and never re-offers conversion; design-html writes the spec form', () => {
    const dr = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(dr).toContain('gstack-design-md.ts check DESIGN.md');
    expect(dr).toContain('gstack-design-md.ts tokens DESIGN.md');
    expectMentions(dr, [['変換を提案してはいけません']], 'dr');
    expect(dr).not.toContain('mark legacy-keep');
    const dh = fs.readFileSync(path.join(ROOT, 'design-html', 'SKILL.md'), 'utf-8');
    expect(dh).toContain('# gstack: design-md-format=spec');
    const pdr = readSkillUnion('plan-design-review');
    expect(pdr).toContain('{colors.primary}');
    const checklist = fs.readFileSync(path.join(ROOT, 'review', 'design-checklist.md'), 'utf-8');
    expect(checklist).toContain('gstack-design-md.ts tokens DESIGN.md');
    expect(readSkillUnion('ship')).toContain('gstack-design-md.ts tokens DESIGN.md');
  });

  test('every rendered gstack-design-md invocation uses bun --no-env-file', () => {
    for (const content of [readSkillUnion('design-consultation'), fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8'), readSkillUnion('ship')]) {
      for (const line of content.split('\n')) {
        if (line.includes('gstack-design-md.ts')) expect(line).toContain('bun --no-env-file --config=/dev/null run ');
      }
    }
  });
});

// --- PRODUCT.md prefill + /impeccable handoffs ---

describe('PRODUCT.md prefill and /impeccable handoffs', () => {
  test('design-consultation and design-shotgun read PRODUCT.md and never open the impeccable skill', () => {
    for (const skill of ['design-consultation', 'design-shotgun']) {
      const c = readSkillUnion(skill);
      expect(c).toContain('cat PRODUCT.md 2>/dev/null | head -120 || echo "NO_PRODUCT_MD"');
      expectMentions(c, [['再度尋ね'], ['.claude/skills/impeccable/**', '決して開かない']], skill);
    }
  });

  test('handoffs are gated on IMPECCABLE_SKILL: present in review-lite and design-review', () => {
    expectMentions(readSkillUnion('ship'), [['IMPECCABLE_SKILL: present', 'NEEDS INPUT', 'handoff=']], 'ship');
    const dr = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expectTokens(dr, ['`handoff=`', '`IMPECCABLE_SKILL: present`'], 'dr');
    expectTokens(dr, ['`/impeccable`'], 'dr');
  });
});

// --- Extended DESIGN_SKETCH resolver tests ---

describe('DESIGN_SKETCH extended with outside voices', () => {
  const content = readSkillUnion('office-hours'); // carved: Phase 5/6 prose moved to section

  test('contains outside design voices step', () => {
    expectMentions(content, [['Step 6', '外部のデザインボイス']], 'content');
  });

  test('offers opt-in via AskUserQuestion', () => {
    expectMentions(content, [['外部のデザイン視点', '提案します'], ['AskUserQuestion', '使います']], 'content');
  });

  test('still contains original wireframe steps', () => {
    expectMentions(content, [['ワイヤーフレーム']], 'content');
    expect(content).toContain('gstack-render.ts');
  });
});

// --- Extended DESIGN_REVIEW_LITE resolver tests ---

describe('DESIGN_REVIEW_LITE extended with Codex', () => {
  const content = readShipUnion();

  test('contains Codex design voice block', () => {
    expectMentions(content, [['Codex デザインボイス', '任意']], 'content');
    expect(content).toContain('CODEX (design)');
  });

  test('still contains original checklist steps', () => {
    expect(content).toContain('design-checklist.md');
    expect(content).toContain('SCOPE_FRONTEND');
  });

  test('design-checklist path uses installed gstack/review root (#2694)', () => {
    // #2694: generateDesignReviewLite used to emit
    // `.claude/skills/review/design-checklist.md` (missing the gstack/ segment).
    // After install the file lives at ~/.claude/skills/gstack/review/design-checklist.md.
    // The bad relative form must not appear — the good path does not contain it
    // as a substring because `gstack/` sits between `skills/` and `review/`.
    expect(content).toContain('~/.claude/skills/gstack/review/design-checklist.md');
    expect(content).not.toContain('.claude/skills/review/design-checklist.md');
  });

});

// ─── Codex Generation Tests ─────────────────────────────────

describe('Codex generation (--host codex)', () => {
  // .agents/ is gitignored (v0.11.2.0) — read the module-level out-dir render
  // (--host all covers codex) instead of regenerating the live tree in place.
  const AGENTS_DIR = path.join(EXTERNAL_OUT, '.agents', 'skills');

  // Dynamic discovery of expected Codex skills: all templates except /codex.
  // The out-dir is a fresh mkdtemp, so the vendored-dev-mode symlink loop
  // (.agents/skills/{name} → repo root) that made the generator skip skills
  // in-place can never occur here — every template renders.
  const CODEX_SKILLS = (() => {
    const skills: Array<{ dir: string; codexName: string }> = [];
    if (fs.existsSync(path.join(ROOT, 'SKILL.md.tmpl'))) {
      skills.push({ dir: '.', codexName: 'gstack' });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === 'codex') continue; // /codex is excluded from Codex output
      if (!fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) continue;
      const codexName = entry.name.startsWith('gstack-') ? entry.name : `gstack-${entry.name}`;
      skills.push({ dir: entry.name, codexName });
    }
    return skills;
  })();

  test('--host codex generates correct output paths', () => {
    for (const skill of CODEX_SKILLS) {
      const skillMd = path.join(AGENTS_DIR, skill.codexName, 'SKILL.md');
      expect(fs.existsSync(skillMd)).toBe(true);
    }
  });

  test('root gstack bundle has OpenAI metadata for Codex skill browsing', () => {
    const rootMetadata = path.join(ROOT, 'agents', 'openai.yaml');
    expect(fs.existsSync(rootMetadata)).toBe(true);
    const content = fs.readFileSync(rootMetadata, 'utf-8');
    expect(content).toContain('display_name: "gstack"');
    expect(content).toContain('allow_implicit_invocation: true');
  });

  test('externalSkillName mapping: root is gstack, others are gstack-{dir}', () => {
    // Root → gstack
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack', 'SKILL.md'))).toBe(true);
    // Subdirectories → gstack-{dir}
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-review', 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-ship', 'SKILL.md'))).toBe(true);
    // gstack-upgrade doesn't double-prefix
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-upgrade', 'SKILL.md'))).toBe(true);
    // No double-prefix: gstack-gstack-upgrade must NOT exist
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-gstack-upgrade', 'SKILL.md'))).toBe(false);
  });

  test('Codex frontmatter has ONLY name + description', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content.startsWith('---\n')).toBe(true);
      const fmEnd = content.indexOf('\n---', 4);
      expect(fmEnd).toBeGreaterThan(0);
      const frontmatter = content.slice(4, fmEnd);
      // Must have name and description
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
      // Must NOT have allowed-tools, version, or hooks
      expect(frontmatter).not.toContain('allowed-tools:');
      expect(frontmatter).not.toContain('version:');
      expect(frontmatter).not.toContain('hooks:');
    }
  });

  test('all Codex skills have agents/openai.yaml metadata', () => {
    for (const skill of CODEX_SKILLS) {
      const metadata = path.join(AGENTS_DIR, skill.codexName, 'agents', 'openai.yaml');
      expect(fs.existsSync(metadata)).toBe(true);
      const content = fs.readFileSync(metadata, 'utf-8');
      expect(content).toContain(`display_name: "${skill.codexName}"`);
      expect(content).toContain('short_description:');
      expect(content).toContain('allow_implicit_invocation: true');
    }
  });

  test('no .claude/skills/ in Codex output', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('.claude/skills');
    }
  });

  test('no ~/.claude/ runtime paths in Codex output', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      // Outside prompts may explicitly forbid reading Claude's skill directory.
      // Every executable/runtime path must still use the selected host root.
      const withoutBoundary = content.replace(/^.*(?:do not read or execute any files under|読んだり実行したりしないでください)[^\n]*$/gim, '');
      expect(withoutBoundary).not.toContain('~/.claude/');
    }
  });

  test('/codex skill excluded from Codex output', () => {
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-codex', 'SKILL.md'))).toBe(false);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-codex'))).toBe(false);
  });

  test('Codex output includes the renamed Claude Code skill and restricted runner', () => {
    const content = readExternalSkillUnion(EXTERNAL_OUT, '.agents', 'claude-code');
    expect(content).toContain('name: claude-code');
    expect(content).toContain('gstack-claude-code');
    expect(content).toContain('--access none');
    expect(content).toContain('--access read-only');
    expect(content).toContain('--timeout-ms');
    expect(content).toContain('claude-session-id');
    expect(content).not.toContain('$HOME/.claude/.credentials.json');
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-claude'))).toBe(false);
  });

  test('Codex ship and review preserve outside review through Claude Code', () => {
    for (const skill of ['ship', 'review']) {
      const content = readExternalSkillUnion(EXTERNAL_OUT, '.agents', skill);
      expect(content).not.toMatch(/codex\s+(?:exec|review)\s/);
      expect(content).toContain('gstack-claude-code');
      expect(content).toContain('codex_reviews');
      expect(content).toContain('adversarial-review');
    }
  });

  test('--host codex --dry-run freshness', () => {
    // Dry-run against the out-dir render: determinism/idempotency check
    // (regenerating produces the same bytes the module-level render did).
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // Every Codex skill should be FRESH
    for (const skill of CODEX_SKILLS) {
      expect(output).toContain(`FRESH: .agents/skills/${skill.codexName}/SKILL.md`);
    }
    expect(output).not.toContain('STALE');
  });

  test('--host agents alias produces same output as --host codex', () => {
    const codexResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    });
    const agentsResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'agents', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT,
      stdout: 'pipe',
      stderr: 'pipe',
      timeout: 120_000,
    });
    expect(codexResult.exitCode).toBe(0);
    expect(agentsResult.exitCode).toBe(0);
    // Both should produce the same output (same FRESH lines)
    expect(codexResult.stdout.toString()).toBe(agentsResult.stdout.toString());
  });

  test('multiline descriptions preserved in Codex output', () => {
    // office-hours has a multiline description — verify it survives the frontmatter transform
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-office-hours', 'SKILL.md'), 'utf-8');
    const fmEnd = content.indexOf('\n---', 4);
    const frontmatter = content.slice(4, fmEnd);
    // Description should span multiple lines (block scalar)
    const descLines = frontmatter.split('\n').filter(l => l.startsWith('  '));
    expect(descLines.length).toBeGreaterThan(1);
    // Verify key phrases survived
    expect(frontmatter).toContain('YC Office Hours');
  });

  test('hook skills have safety prose and no hooks: in frontmatter', () => {
    const HOOK_SKILLS = ['gstack-careful', 'gstack-freeze', 'gstack-guard'];
    for (const skillName of HOOK_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skillName, 'SKILL.md'), 'utf-8');
      // Must have safety advisory prose
      expect(content).toContain('Safety Advisory');
      // Must NOT have hooks: in frontmatter
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).not.toContain('hooks:');
    }
  });

  test('all Codex SKILL.md files have auto-generated header', () => {
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      expect(content).toContain('AUTO-GENERATED from SKILL.md.tmpl');
      expect(content).toContain('Regenerate: bun run gen:skill-docs');
    }
  });

  test('Codex preamble resolves runtime assets from repo-local or global gstack roots', () => {
    // Check a skill that has a preamble (review is a good candidate)
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('GSTACK_ROOT');
    // C1: one shared root resolution — repo-local first, then CODEX_HOME's global root.
    expect(content).toContain('_r=$(git rev-parse --show-toplevel 2>/dev/null)/.agents/skills/gstack');
    expect(content).toContain('_r=${CODEX_HOME:-~/.codex}/skills/gstack');
    // Phase 1/2: config reads moved into gstack-skill-start — the fence itself
    // is the bin asset the preamble must resolve through $GSTACK_BIN, and the
    // question-preference runtime call still resolves the same way.
    expect(content).toContain('$GSTACK_BIN/gstack-skill-start');
    expect(content).toContain('$GSTACK_BIN/gstack-question-preference');
    // The upgrade-skill doc reference moved into the script's upgrade-flow
    // block, resolved $0-relative ($_ROOT_DIR) — host-neutral by construction,
    // so the Codex render no longer needs its own copy.
    expect(SKILL_START_SCRIPT).toContain('$_ROOT_DIR/gstack-upgrade/SKILL.md');
    expect(SKILL_START_SCRIPT).toContain('_ROOT_DIR=$(dirname "$_BIN")');
    expect(content).not.toContain('~/.codex/skills/gstack/bin/gstack-config get telemetry');
  });

  // ─── Path rewriting regression tests ─────────────────────────

  test('sidecar paths resolve through $GSTACK_ROOT (not gstack-review/)', () => {
    // #2518: templates now anchor sidecars at the installed skill root
    // (~/.claude/skills/gstack/review/...), which the codex path rewrite turns
    // into $GSTACK_ROOT/review/... — resolved by the preamble against the
    // repo-local .agents root or the global install. The old repo-relative
    // form (.claude/skills/review/) only resolved inside gstack's own checkout.
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('$GSTACK_ROOT/review/checklist.md');
    // design-checklist.md is now referenced via Review Army specialist (Claude only, stripped for Codex)
    // Wrong: must NOT reference gstack-review/checklist.md (file doesn't exist there)
    expect(content).not.toContain('.agents/skills/gstack-review/checklist.md');
  });

  test('sidecar paths in ship skill point to gstack/review/ for pre-landing review', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-ship', 'SKILL.md'), 'utf-8');
    // Ship references the review checklist in its pre-landing review step
    if (content.includes('checklist.md')) {
      expect(content).toContain('.agents/skills/gstack/review/');
      expect(content).not.toContain('.agents/skills/gstack-review/checklist');
    }
  });

  test('greptile-triage sidecar path is correct', () => {
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-review', 'SKILL.md'), 'utf-8');
    if (content.includes('greptile-triage')) {
      expect(content).toContain('$GSTACK_ROOT/review/greptile-triage.md');
      expect(content).not.toContain('.agents/skills/gstack-review/greptile-triage');
    }
  });

  test('all four path rewrite rules produce correct output', () => {
    // Test each of the 4 path rewrite rules individually
    const content = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-review', 'SKILL.md'), 'utf-8');

    // Rule 1: ~/.claude/skills/gstack → $GSTACK_ROOT
    expect(content).not.toContain('~/.claude/skills/gstack');
    expect(content).toContain('$GSTACK_ROOT');

    // Rule 2: .claude/skills/gstack → .agents/skills/gstack
    expect(content).not.toContain('.claude/skills/gstack');

    // Rule 3: .claude/skills/review → .agents/skills/gstack/review
    expect(content).not.toContain('.claude/skills/review');

    // Rule 4: .claude/skills → .agents/skills (catch-all)
    expect(content).not.toContain('.claude/skills');
  });

  test('path rewrite rules apply to all Codex skills with sidecar references', () => {
    // Verify across ALL generated skills, not just review
    for (const skill of CODEX_SKILLS) {
      const content = fs.readFileSync(path.join(AGENTS_DIR, skill.codexName, 'SKILL.md'), 'utf-8');
      // No skill should reference Claude paths
      expect(content).not.toContain('~/.claude/skills');
      expect(content).not.toContain('.claude/skills');
      if (content.includes('gstack-config') || content.includes('gstack-update-check') || content.includes('gstack-telemetry-log')) {
        expect(content).toContain('$GSTACK_ROOT');
      }
      // If a skill references checklist.md, it must use the correct sidecar path
      if (content.includes('checklist.md') && !content.includes('design-checklist.md')) {
        expect(content).not.toContain('gstack-review/checklist.md');
      }
    }
  });

  // ─── Claude output regression guard ─────────────────────────

  test('Claude output uses installed-root review paths (#2518)', () => {
    // Codex changes must NOT affect Claude output; the Claude form is the
    // installed-root anchor, not the old repo-relative path that only
    // resolved inside gstack's own checkout.
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('~/.claude/skills/gstack/review/checklist.md');
    expect(content).toContain('~/.claude/skills/gstack');
    // Must NOT contain Codex HOST paths. `~/.codex/sessions/` is exempt: the
    // timeout-wrapper guidance documents the Codex CLI's own rollout-log
    // location (a user-facing CLI path, same class as ~/.codex/logs/ in the
    // codex skill), not the gstack Codex host install path.
    // `~/.codex/config.toml` is the same user-facing class: the shared
    // codexPreflight's model_unusable branch (#2477) points at the CLI's own
    // config file, where the rejected `model =` pin lives.
    expect(content).not.toContain('.agents/skills');
    expect(
      content
        .replaceAll('~/.codex/sessions/', '')
        .replaceAll('~/.codex/config.toml', ''),
    ).not.toContain('~/.codex/');
  });

  test('Claude output unchanged: ship skill still uses .claude/skills/ paths', () => {
    const content = readShipUnion();
    expect(content).toContain('~/.claude/skills/gstack');
    expect(content).not.toContain('.agents/skills');
    // ~/.codex/sessions/ is the Codex CLI's rollout-log path (user-facing),
    // documented by the adversarial-pass timeout guidance; ~/.codex/config.toml
    // is the CLI's own config file (model_unusable guidance, #2477) — see the
    // review test above.
    expect(
      content
        .replaceAll('~/.codex/sessions/', '')
        .replaceAll('~/.codex/config.toml', ''),
    ).not.toContain('~/.codex/');
  });

  test('Claude output unchanged: all Claude skills have zero Codex paths', () => {
    for (const skill of CLAUDE_GENERATED_SKILLS) {
      const content = fs.readFileSync(path.join(ROOT, skill.dir, 'SKILL.md'), 'utf-8');
      // pair-agent legitimately documents how Codex agents store credentials.
      // codex + autoplan document the Codex CLI auth file (~/.codex/auth.json)
      // and log path (~/.codex/logs/) — those are user-facing Codex CLI paths,
      // not the gstack Codex host install path. ~/.codex/sessions/ (rollout
      // logs, referenced by the review/ship timeout guidance) and
      // ~/.codex/config.toml (the model_unusable guidance in the shared
      // codexPreflight, #2477) are the same user-facing class, so they are
      // scrubbed before the ban.
      if (skill.dir !== 'pair-agent' && skill.dir !== 'codex' && skill.dir !== 'autoplan') {
        expect(
          content
            .replaceAll('~/.codex/sessions/', '')
            .replaceAll('~/.codex/config.toml', ''),
        ).not.toContain('~/.codex/');
      }
      // gstack-upgrade legitimately references .agents/skills for cross-platform detection
      if (skill.dir !== 'gstack-upgrade') {
        expect(content).not.toContain('.agents/skills');
      }
    }
  });

  // ─── Design outside voices: Codex host guard ─────────────────

  test('codex host retains design outside voices through Claude Code', () => {
    const codexContent = readExternalSkillUnion(EXTERNAL_OUT, '.agents', 'design-review');
    expect(codexContent).toContain('Design Outside Voices');
    expect(codexContent).toContain('gstack-claude-code');
  });

  test('codex design-shotgun generates with built-in $imagegen and keeps $D for the board only', () => {
    const codex = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-design-shotgun', 'SKILL.md'), 'utf-8');
    expectTokens(codex, ['`$imagegen`', 'view_image', 'gstack-design-claim', '$D compare --images-file'], 'codex design-shotgun');
    expectMentions(codex, [['$imagegen', 'デフォルトの組み込みモード'], ['OPENAI_API_KEY', '不要']], 'codex design-shotgun');
    for (const generator of ['"$D" variants', '"$D" generate', '"$D" evolve', '$D iterate', '`$D variants --brief']) {
      expect(codex).not.toContain(generator);
    }
    const claude = fs.readFileSync(path.join(ROOT, 'design-shotgun', 'SKILL.md'), 'utf-8');
    expect(claude).toContain('"$D" variants --briefs-file');
    expect(claude).not.toContain('$imagegen');
    for (const skill of ['plan-design-review', 'design-consultation']) {
      expect(readExternalSkillUnion(EXTERNAL_OUT, '.agents', skill)).not.toContain('$imagegen');
    }
  });

  test('codex host does not include Codex design block in ship', () => {
    const codexContent = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-ship', 'SKILL.md'), 'utf-8');
    expectAbsent(codexContent, ['Codex design voice', 'Codex デザインボイス'], 'codex ship');
  });

  // ─── Explicit --model override wins over the host default ────
  // Without --model the codex host renders its defaultModel (gpt) — pinned by
  // the golden test. This pins the OTHER direction through the real CLI:
  // `./setup --host codex --model <id>` depends on it. The override renders
  // into its OWN out-dir, so no restore pass is needed — the host-default
  // render (EXTERNAL_OUT) is untouched and asserted directly.
  test('explicit --model overrides the codex host default', () => {
    const overrideOut = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-model-override-'));
    try {
      const override = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--model', 'claude', '--out-dir', overrideOut], {
        cwd: ROOT,
        stdout: 'pipe',
        stderr: 'pipe',
        timeout: 120_000,
      });
      expect(override.exitCode).toBe(0);
      const content = fs.readFileSync(path.join(overrideOut, '.agents', 'skills', 'gstack-ship', 'SKILL.md'), 'utf-8');
      expect(content).toContain('## Model-Specific Behavioral Patch (claude)(モデル固有の動作パッチ)');
      // The overlay now travels as --model into gstack-skill-start, which
      // echoes MODEL_OVERLAY at runtime.
      expect(content).toContain('--model "claude"');
    } finally {
      fs.rmSync(overrideOut, { recursive: true, force: true });
    }
    // Host-default direction: the untouched EXTERNAL_OUT render carries gpt.
    const hostDefault = fs.readFileSync(path.join(AGENTS_DIR, 'gstack-ship', 'SKILL.md'), 'utf-8');
    expect(hostDefault).toContain('## Model-Specific Behavioral Patch (gpt)(モデル固有の動作パッチ)');
    expect(hostDefault).toContain('--model "gpt"');
  });
});

// ─── Factory generation tests ────────────────────────────────

describe('Factory generation (--host factory)', () => {
  // .factory/ is gitignored — read the module-level out-dir render
  // (--host all covers factory) instead of regenerating in place.
  const FACTORY_DIR = path.join(EXTERNAL_OUT, '.factory', 'skills');

  // Fresh out-dir → the vendored-dev-mode symlink loop can never occur, so
  // every template renders (see the Codex discovery note above).
  const FACTORY_SKILLS = (() => {
    const skills: Array<{ dir: string; factoryName: string }> = [];
    if (fs.existsSync(path.join(ROOT, 'SKILL.md.tmpl'))) {
      skills.push({ dir: '.', factoryName: 'gstack' });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === 'codex') continue;
      if (!fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) continue;
      const factoryName = entry.name.startsWith('gstack-') ? entry.name : `gstack-${entry.name}`;
      skills.push({ dir: entry.name, factoryName });
    }
    return skills;
  })();

  test('--host factory generates correct output paths', () => {
    for (const skill of FACTORY_SKILLS) {
      const skillMd = path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md');
      expect(fs.existsSync(skillMd)).toBe(true);
    }
  });

  test('Factory frontmatter has name + description + user-invocable', () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md'), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).toContain('name:');
      expect(frontmatter).toContain('description:');
      expect(frontmatter).toContain('user-invocable: true');
      expect(frontmatter).not.toContain('allowed-tools:');
      expect(frontmatter).not.toContain('preamble-tier:');
      expect(frontmatter).not.toContain('sensitive:');
    }
  });

  test('sensitive skills have disable-model-invocation', () => {
    const SENSITIVE = ['gstack-ship', 'gstack-land-and-deploy', 'gstack-guard', 'gstack-careful', 'gstack-freeze', 'gstack-unfreeze'];
    for (const name of SENSITIVE) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, name, 'SKILL.md'), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).toContain('disable-model-invocation: true');
    }
  });

  test('non-sensitive skills lack disable-model-invocation', () => {
    const NON_SENSITIVE = ['gstack-qa', 'gstack-review', 'gstack-investigate', 'gstack-browse'];
    for (const name of NON_SENSITIVE) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, name, 'SKILL.md'), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = content.slice(4, fmEnd);
      expect(frontmatter).not.toContain('disable-model-invocation');
    }
  });

  test('no .claude/skills/ in Factory output', () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('.claude/skills');
    }
  });

  test('no ~/.claude/skills/ paths in Factory output', () => {
    for (const skill of FACTORY_SKILLS) {
      const content = fs.readFileSync(path.join(FACTORY_DIR, skill.factoryName, 'SKILL.md'), 'utf-8');
      // ~/.claude/skills should be rewritten, but ~/.claude/plans is legitimate
      // (plan directory lookup) and ~/.claude/ in codex prompts is intentional
      expect(content).not.toContain('~/.claude/skills');
    }
  });

  test('Factory installs both outside-review wrapper skills', () => {
    for (const skill of ['gstack-codex', 'gstack-claude-code']) {
      expect(fs.existsSync(path.join(FACTORY_DIR, skill, 'SKILL.md'))).toBe(true);
    }
  });

  test('Factory keeps Codex integration blocks', () => {
    // Factory users CAN use Codex second opinions (codex exec is a standalone binary)
    const shipContent = fs.readFileSync(path.join(FACTORY_DIR, 'gstack-ship', 'SKILL.md'), 'utf-8');
    expect(shipContent).toContain('codex');
  });

  test('no agents/openai.yaml in Factory output', () => {
    for (const skill of FACTORY_SKILLS) {
      const yamlPath = path.join(FACTORY_DIR, skill.factoryName, 'agents', 'openai.yaml');
      expect(fs.existsSync(yamlPath)).toBe(false);
    }
  });

  test('--host droid alias works', () => {
    const factoryResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'factory', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000,
    });
    const droidResult = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'droid', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000,
    });
    expect(factoryResult.exitCode).toBe(0);
    expect(droidResult.exitCode).toBe(0);
    expect(factoryResult.stdout.toString()).toBe(droidResult.stdout.toString());
  });

  test('--host factory --dry-run freshness', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'factory', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000,
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    for (const skill of FACTORY_SKILLS) {
      expect(output).toContain(`FRESH: .factory/skills/${skill.factoryName}/SKILL.md`);
    }
    expect(output).not.toContain('STALE');
  });

  test('Factory preamble uses .factory paths', () => {
    const content = fs.readFileSync(path.join(FACTORY_DIR, 'gstack-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('GSTACK_ROOT');
    expect(content).toContain('_r=$(git rev-parse --show-toplevel 2>/dev/null)/.factory/skills/gstack');
    expect(content).toContain('$GSTACK_BIN/gstack-config');
  });
});

// ─── Parameterized host smoke tests (config-driven) ─────────

import { ALL_HOST_CONFIGS, getExternalHosts } from '../hosts/index';
import { sliceBetween } from './helpers/skill-fixture';

describe('Parameterized host smoke tests', () => {
  // Every external host was rendered up front by the module-level
  // `--host all --out-dir EXTERNAL_OUT` render, so the per-host `--dry-run`
  // freshness checks are deterministic: they compare a regeneration against
  // that render — an idempotency/determinism check that catches
  // non-deterministic gen without ever writing (or depending on) the live
  // gitignored host dirs. The tracked-claude freshness test
  // (`generated files are fresh`) runs earlier and is unaffected.
  for (const hostConfig of getExternalHosts()) {
    describe(`${hostConfig.displayName} (--host ${hostConfig.name})`, () => {
      const hostDir = path.join(EXTERNAL_OUT, hostConfig.hostSubdir, 'skills');

      test('generates output that exists on disk', () => {
        // The module-level --host all render must have produced this host's tree.
        expect(fs.existsSync(hostDir)).toBe(true);
        const skills = fs.readdirSync(hostDir).filter(d =>
          fs.existsSync(path.join(hostDir, d, 'SKILL.md'))
        );
        expect(skills.length).toBeGreaterThan(0);
      });

      test('no .claude/skills path leakage outside repo-root sidecar symlinks', () => {
        expect(fs.existsSync(hostDir)).toBe(true);
        const skills = fs.readdirSync(hostDir);
        for (const skill of skills) {
          // Dev installs may mount the repo root at host/skills/gstack as a runtime
          // sidecar. The generator skips that symlink loop, so leakage checks should too.
          if (isRepoRootSymlink(path.join(hostDir, skill))) continue;
          const skillMd = path.join(hostDir, skill, 'SKILL.md');
          if (!fs.existsSync(skillMd)) continue;
          const content = fs.readFileSync(skillMd, 'utf-8');
          const leaks = externalHostPathLeaks(content);
          if (leaks.length > 0) {
            throw new Error(`${skill}: .claude/skills leakage:\n${leaks.slice(0, 3).join('\n')}`);
          }
        }
      });

      test('frontmatter has name and description', () => {
        expect(fs.existsSync(hostDir)).toBe(true);
        const skills = fs.readdirSync(hostDir);
        for (const skill of skills) {
          const skillMd = path.join(hostDir, skill, 'SKILL.md');
          if (!fs.existsSync(skillMd)) continue;
          const content = fs.readFileSync(skillMd, 'utf-8');
          expect(content).toMatch(/^---\n/);
          expect(content).toMatch(/^name:\s/m);
          expect(content).toMatch(/^description:\s/m);
        }
      });

      test('--dry-run freshness check passes', () => {
        const result = Bun.spawnSync(
          ['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', hostConfig.name, '--dry-run', '--out-dir', EXTERNAL_OUT],
          { cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 }
        );
        expect(result.exitCode).toBe(0);
        const output = result.stdout.toString();
        expect(output).not.toContain('STALE');
      });

      if (hostConfig.generation.skipSkills?.includes('codex')) {
        test('/codex skill excluded', () => {
          expect(fs.existsSync(path.join(hostDir, 'gstack-codex', 'SKILL.md'))).toBe(false);
        });
      }
    });
  }
});

// ─── --host all tests ────────────────────────────────────────

describe('--host all', () => {
  // Same determinism guard as the parameterized block: the module-level
  // `--host all --out-dir EXTERNAL_OUT` render is the comparison baseline, so
  // this dry-run reports FRESH regardless of live-tree state — and proves the
  // claude host plus every external host regenerate deterministically.
  test('--host all generates for all registered hosts', () => {
    const result = Bun.spawnSync(['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'all', '--dry-run', '--out-dir', EXTERNAL_OUT], {
      cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000,
    });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    // All hosts should appear in output
    expect(output).toContain('FRESH: SKILL.md');           // claude
    for (const hostConfig of getExternalHosts()) {
      expect(output).toContain(`FRESH: ${hostConfig.hostSubdir}/skills/`);
    }
  });
});

// ─── Setup script validation ─────────────────────────────────
// These tests verify the setup script's install layout matches
// what the generator produces — catching the bug where setup
// installed Claude-format source dirs for Codex users.

describe('setup script validation', () => {
  const setupContent = fs.readFileSync(path.join(ROOT, 'setup'), 'utf-8');

  test('setup has separate link functions for Claude and Codex', () => {
    expect(setupContent).toContain('link_claude_skill_dirs');
    expect(setupContent).toContain('link_codex_skill_dirs');
    // Old unified function must not exist
    expect(setupContent).not.toMatch(/^link_skill_dirs\(\)/m);
  });

  test('Claude install uses link_claude_skill_dirs', () => {
    // The Claude install section (section 4) should use the Claude function
    const claudeSection = setupContent.slice(
      setupContent.indexOf('# 4. Install for Claude'),
      setupContent.indexOf('# 5. Install for Codex')
    );
    expect(claudeSection).toContain('link_claude_skill_dirs');
    expect(claudeSection).not.toContain('link_codex_skill_dirs');
  });

  test('Codex install uses link_codex_skill_dirs', () => {
    // The Codex install section (section 5) should use the Codex function
    // End marker: the next numbered section header (a marker that doesn't
    // exist slices to EOF and the assertion reads unrelated sections).
    const codexSection = setupContent.slice(
      setupContent.indexOf('# 5. Install for Codex'),
      setupContent.indexOf('# 6. Install for Kiro')
    );
    expect(setupContent.indexOf('# 6. Install for Kiro')).toBeGreaterThan(-1);
    expect(codexSection).toContain('create_codex_runtime_root');
    expect(codexSection).toContain('link_codex_skill_dirs');
    expect(codexSection).not.toContain('link_claude_skill_dirs');
    expect(codexSection).not.toContain('_link_or_copy "$GSTACK_DIR" "$CODEX_GSTACK"');
  });

  test('Codex install prefers repo-local .agents/skills when setup runs from there', () => {
    expect(setupContent).toContain('SKILLS_PARENT_BASENAME');
    expect(setupContent).toContain('CODEX_REPO_LOCAL=0');
    expect(setupContent).toContain('[ "$SKILLS_PARENT_BASENAME" = ".agents" ]');
    expect(setupContent).toContain('CODEX_REPO_LOCAL=1');
    expect(setupContent).toContain('CODEX_SKILLS="$INSTALL_SKILLS_DIR"');
  });

  test('setup separates install path from source path for symlinked repo-local installs', () => {
    expect(setupContent).toContain('INSTALL_GSTACK_DIR=');
    expect(setupContent).toContain('SOURCE_GSTACK_DIR=');
    expect(setupContent).toContain('INSTALL_SKILLS_DIR=');
    expect(setupContent).toContain('CODEX_GSTACK="$INSTALL_GSTACK_DIR"');
    // Links come from the source checkout, or its per-install render (#1882).
    expect(setupContent).toContain('link_codex_skill_dirs "${_CODEX_RENDER_ROOT:-$SOURCE_GSTACK_DIR}" "$CODEX_SKILLS"');
  });

  test('Codex installs always create sidecar runtime assets for the real skill target', () => {
    expect(setupContent).toContain('if [ "$INSTALL_CODEX" -eq 1 ]; then');
    expect(setupContent).toContain('create_agents_sidecar "$SOURCE_GSTACK_DIR"');
  });

  test('link_codex_skill_dirs reads from .agents/skills/', () => {
    // The Codex link function must reference .agents/skills for generated Codex skills
    const fnStart = setupContent.indexOf('link_codex_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('.agents/skills');
    expect(fnBody).toContain('gstack*');
  });

  test('link_claude_skill_dirs creates real directories with absolute SKILL.md symlinks', () => {
    // Claude links should be real directories with absolute SKILL.md symlinks
    // to ensure Claude Code discovers them as top-level skills (not nested under gstack/)
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('mkdir -p "$target"');
    // v1.36.0.0: routes through _link_or_copy helper for Windows fallback (cp on MSYS2/Git Bash).
    // v1.67 (#2569): the source is render-aware — canonical SKILL.md, or the
    // rendered :user variant from ${GSTACK_HOME}/render/claude when present.
    expect(fnBody).toContain('_skill_md_src="$gstack_dir/$dir_name/SKILL.md"');
    expect(fnBody).toContain('_link_or_copy "$_skill_md_src" "$target/SKILL.md"');
  });

  // REGRESSION: cleanup functions must handle both old symlinks AND new real-directory pattern
  test('cleanup functions handle real directories with symlinked SKILL.md', () => {
    // cleanup_old_claude_symlinks must detect and remove real dirs with SKILL.md symlinks
    const cleanupOldStart = setupContent.indexOf('cleanup_old_claude_symlinks()');
    const cleanupOldEnd = setupContent.indexOf('}', setupContent.indexOf('cleaned up old', cleanupOldStart));
    const cleanupOldBody = setupContent.slice(cleanupOldStart, cleanupOldEnd);
    expect(cleanupOldBody).toContain('-d "$old_target"');
    expect(cleanupOldBody).toContain('-L "$old_target/SKILL.md"');
    expect(cleanupOldBody).toContain('rm -rf "$old_target"');

    // cleanup_prefixed_claude_symlinks must also handle the new pattern
    const cleanupPrefixedStart = setupContent.indexOf('cleanup_prefixed_claude_symlinks()');
    const cleanupPrefixedEnd = setupContent.indexOf('}', setupContent.indexOf('cleaned up prefixed', cleanupPrefixedStart));
    const cleanupPrefixedBody = setupContent.slice(cleanupPrefixedStart, cleanupPrefixedEnd);
    expect(cleanupPrefixedBody).toContain('-d "$prefixed_target"');
    expect(cleanupPrefixedBody).toContain('-L "$prefixed_target/SKILL.md"');
    expect(cleanupPrefixedBody).toContain('rm -rf "$prefixed_target"');
  });

  // REGRESSION: link function must upgrade old directory symlinks
  test('link_claude_skill_dirs removes old directory symlinks before creating real dirs', () => {
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // Must check for and remove old symlinks before mkdir
    expect(fnBody).toContain('if [ -L "$target" ]');
    expect(fnBody).toContain('rm -f "$target"');
  });

  test('setup links root gstack skill through a thin Claude wrapper alias', () => {
    const fnStart = setupContent.indexOf('link_claude_root_skill_alias()');
    const fnEnd = setupContent.indexOf('# ─── Helper: remove old unprefixed Claude skill entries', fnStart);
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('_gstack-command');
    // #2511: the alias must be a rewritten COPY (unique frontmatter name),
    // never a verbatim symlink of the canonical SKILL.md.
    expect(fnBody).toContain('_install_alias_skill_md "$gstack_dir/SKILL.md" "$target" "_gstack-command"');
    expect(fnBody).not.toContain('_link_or_copy "$gstack_dir/SKILL.md"');

    const claudeSection = setupContent.slice(
      setupContent.indexOf('# 4. Install for Claude'),
      setupContent.indexOf('# 5. Install for Codex')
    );
    expect(claudeSection).toContain('link_claude_root_skill_alias "$SOURCE_GSTACK_DIR" "$INSTALL_SKILLS_DIR"');
  });

  test('setup supports --host auto|claude|codex|kiro|opencode|cursor; slate is informational', () => {
    expect(setupContent).toContain('--host');
    // #2361: slate moved OUT of the install accept-list (it was accepted but
    // never dispatched — a silent exit-0 no-op) into an informational arm.
    expect(setupContent).toContain('claude|codex|kiro|factory|opencode|cursor|copilot|agy|auto');
    expect(setupContent).toMatch(/^ {2}slate\)/m);
  });

  test('auto mode detects claude, codex, kiro, and opencode binaries', () => {
    expect(setupContent).toContain('command -v claude');
    expect(setupContent).toContain('command -v codex');
    expect(setupContent).toContain('command -v kiro-cli');
    expect(setupContent).toContain('command -v opencode');
  });

  // T1: Sidecar skip guard — prevents .agents/skills/gstack from being linked as a skill
  test('link_codex_skill_dirs skips the gstack sidecar directory', () => {
    const fnStart = setupContent.indexOf('link_codex_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('done', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('[ "$skill_name" = "gstack" ] && continue');
  });

  // T2: Dynamic $GSTACK_ROOT paths in generated Codex preambles
  test('generated Codex preambles use dynamic GSTACK_ROOT paths', () => {
    // Read the module-level out-dir render (always present).
    const codexSkillDir = path.join(EXTERNAL_OUT, '.agents', 'skills', 'gstack-ship');
    const content = fs.readFileSync(path.join(codexSkillDir, 'SKILL.md'), 'utf-8');
    expect(content).toContain('GSTACK_ROOT=');
    expect(content).toContain('$GSTACK_BIN/');
  });

  test('setup installs Kiro-native output and runtime assets', () => {
    expect(setupContent).toContain('INSTALL_KIRO=');
    expect(setupContent).toContain('kiro-cli');
    expect(setupContent).toContain('KIRO_SKILLS=');
    expect(setupContent).toContain('KIRO_SKILLS="$HOME/.kiro/skills"');
    expect(setupContent).toContain('KIRO_DIR="$SOURCE_GSTACK_DIR/.kiro/skills"');
    expect(setupContent).toContain('gen:skill-docs --host kiro');
    expect(setupContent).toContain('$KIRO_GSTACK/lib');
  });

  test('setup supports --host opencode with install section and OpenCode skill path vars', () => {
    expect(setupContent).toContain('INSTALL_OPENCODE=');
    expect(setupContent).toContain('OPENCODE_SKILLS="$HOME/.config/opencode/skills"');
    expect(setupContent).toContain('OPENCODE_GSTACK="$OPENCODE_SKILLS/gstack"');
  });

  // --host cursor full install slice (#1358, PR #2547 by @szsunyuan re-derived)
  test('auto mode detects Cursor via binary or ~/.cursor directory', () => {
    expect(setupContent).toContain('command -v cursor');
    expect(setupContent).toContain('[ -d "$HOME/.cursor" ] && INSTALL_CURSOR=1');
  });

  test('setup supports --host cursor with install section and Cursor skill path vars', () => {
    expect(setupContent).toContain('INSTALL_CURSOR=');
    expect(setupContent).toContain('CURSOR_SKILLS="$HOME/.cursor/skills"');
    expect(setupContent).toContain('CURSOR_GSTACK="$CURSOR_SKILLS/gstack"');
    expect(setupContent).toContain('create_cursor_runtime_root');
    expect(setupContent).toContain('create_cursor_sidecar');
    expect(setupContent).toContain('link_cursor_skill_dirs');
    expect(setupContent).toContain('gstack ready (cursor).');
  });

  test('create_cursor_runtime_root exposes only Cursor runtime assets', () => {
    const fnStart = setupContent.indexOf('create_cursor_runtime_root()');
    const fnEnd = setupContent.indexOf('create_cursor_sidecar()', fnStart);
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('gstack/SKILL.md');
    expect(fnBody).toContain('browse/dist');
    expect(fnBody).toContain('browse/bin');
    expect(fnBody).toContain('gstack-upgrade/SKILL.md');
    // Review checklists and the other read-on-demand files come from the shared
    // helpers, the same set every env-var root gets (#1077 residue): the Cursor
    // render reads design-checklist.md and review/specialists too.
    expect(fnBody).toContain('_link_runtime_dists "$gstack_dir" "$cursor_gstack"');
    expect(fnBody).toContain('_copy_runtime_skill_refs "$cursor_dir" "$cursor_gstack"');
    // bin scripts import ../lib — the two must travel together.
    expect(fnBody).toContain('$cursor_gstack/lib');
    expect(fnBody).not.toContain('qa/templates');
    expect(fnBody).not.toContain('_link_or_copy "$gstack_dir" "$cursor_gstack"');
  });

  test('create_cursor_sidecar plants runtime assets without wiping generated SKILL.md', () => {
    const fnStart = setupContent.indexOf('create_cursor_sidecar()');
    const fnEnd = setupContent.indexOf('link_cursor_skill_dirs()', fnStart);
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('.cursor/skills/gstack');
    expect(fnBody).toContain('bin');
    expect(fnBody).toContain('browse/dist');
    expect(fnBody).toContain('browse/bin');
    expect(fnBody).toContain('ETHOS.md');
    expect(fnBody).not.toContain('rm -rf');
  });

  test('link_cursor_skill_dirs skips the gstack runtime root directory', () => {
    const fnStart = setupContent.indexOf('link_cursor_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('[ "$skill_name" = "gstack" ] && continue');
    // #2444-aware guard: Windows bypass, else only replace symlink-or-missing.
    expect(fnBody).toContain('[ "$IS_WINDOWS" -eq 1 ] || [ -L "$target" ] || [ ! -e "$target" ]');
  });

  // #2142 deleted existing ~/.cursor/skills/<name> dirs with `rm -rf "$target"`
  // before relinking. That can wipe unowned Cursor skills. Only replace a
  // symlink or a missing path; never the whole skills directory.
  test('link_cursor_skill_dirs does not delete unowned Cursor skill directories', () => {
    const fnStart = setupContent.indexOf('link_cursor_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).not.toContain('rm -rf "$target"');
    expect(fnBody).not.toContain('rm -rf "$skills_dir"');
    expect(setupContent).not.toContain('rm -rf "$CURSOR_SKILLS"');
  });

  test('Cursor install links generated skills before planting the sidecar', () => {
    const cursorInstall = setupContent.slice(
      setupContent.indexOf('# 6d. Install for Cursor'),
      setupContent.indexOf('# 7. Create .agents/ sidecar'),
    );
    const linkCall = cursorInstall.indexOf('link_cursor_skill_dirs "$SOURCE_GSTACK_DIR"');
    const sidecarCall = cursorInstall.indexOf('create_cursor_sidecar "$SOURCE_GSTACK_DIR"');
    expect(linkCall).toBeGreaterThan(-1);
    expect(sidecarCall).toBeGreaterThan(-1);
    expect(linkCall).toBeLessThan(sidecarCall);
  });

  test('setup installs OpenCode skills into a nested gstack runtime root', () => {
    expect(setupContent).toContain('create_opencode_runtime_root');
    expect(setupContent).toContain('.opencode/skills');
    expect(setupContent).toContain('review/specialists');
    expect(setupContent).toContain('qa/templates');
    expect(setupContent).toContain('qa/references');
    expect(setupContent).toContain('dx-hall-of-fame.md');
    expect(setupContent).toContain('$opencode_gstack/lib');
  });

  test('create_agents_sidecar links runtime assets', () => {
    // Sidecar must link bin with its shared lib modules, plus browse, review, qa
    const fnStart = setupContent.indexOf('create_agents_sidecar()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('done', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('bin');
    expect(fnBody).toContain('lib');
    expect(fnBody).toContain('browse');
    expect(fnBody).toContain('review');
    expect(fnBody).toContain('qa');
  });

  test('create_codex_runtime_root exposes only runtime assets', () => {
    const fnStart = setupContent.indexOf('create_codex_runtime_root()');
    const fnEnd = setupContent.indexOf('\n}\n', fnStart);
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('gstack/SKILL.md');
    expect(fnBody).toContain('$codex_gstack/lib');
    expect(fnBody).toContain('browse/dist');
    expect(fnBody).toContain('browse/bin');
    expect(fnBody).toContain('gstack-upgrade/SKILL.md');
    expect(fnBody).toContain('_link_runtime_dists "$gstack_dir" "$codex_gstack"');
    expect(fnBody).not.toContain('_link_or_copy "$gstack_dir" "$codex_gstack"');
    // Review runtime assets: individual files from the shared helper, never
    // the whole review/ dir, which has a SKILL.md.
    const shared = setupContent.slice(setupContent.indexOf('_link_runtime_dists() {'), setupContent.indexOf('_copy_runtime_skill_refs() {'));
    for (const f of ['review/checklist.md', 'review/design-checklist.md', 'review/greptile-triage.md', 'review/TODOS-format.md']) {
      expect(shared).toContain(f);
    }
    expect(shared).not.toMatch(/for d in [^;]*\breview(?:\s|;)/);
  });

  test('create_factory_runtime_root links shared lib modules beside bin', () => {
    const fnStart = setupContent.indexOf('create_factory_runtime_root()');
    const fnEnd = setupContent.indexOf('create_opencode_runtime_root()', fnStart);
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('$factory_gstack/bin');
    expect(fnBody).toContain('$factory_gstack/lib');
  });

  test('direct Codex installs are migrated out of ~/.codex/skills/gstack', () => {
    expect(setupContent).toContain('migrate_direct_codex_install');
    expect(setupContent).toContain('$HOME/.gstack/repos/gstack');
    expect(setupContent).toContain('avoid duplicate skill discovery');
  });

  // --- Symlink prefix tests (PR #503) ---

  test('link_claude_skill_dirs applies gstack- prefix by default', () => {
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('SKILL_PREFIX');
    expect(fnBody).toContain('link_name="gstack-$skill_name"');
  });

  test('link_claude_skill_dirs preserves already-prefixed dirs', () => {
    const fnStart = setupContent.indexOf('link_claude_skill_dirs()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('linked[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // gstack-* dirs should keep their name (e.g., gstack-upgrade stays gstack-upgrade)
    expect(fnBody).toContain('gstack-*) link_name="$skill_name"');
  });

  test('setup supports --no-prefix flag', () => {
    expect(setupContent).toContain('--no-prefix');
    expect(setupContent).toContain('SKILL_PREFIX=0');
  });

  test('cleanup_old_claude_symlinks removes only gstack-pointing symlinks', () => {
    expect(setupContent).toContain('cleanup_old_claude_symlinks');
    const fnStart = setupContent.indexOf('cleanup_old_claude_symlinks()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('removed[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    // Should check readlink before removing
    expect(fnBody).toContain('readlink');
    expect(fnBody).toContain('gstack/*');
    // Should skip already-prefixed dirs
    expect(fnBody).toContain('gstack-*) continue');
  });

  test('cleanup runs before link when prefix is enabled', () => {
    // In the Claude install section, cleanup should happen before linking
    const claudeInstallSection = setupContent.slice(
      setupContent.indexOf('INSTALL_CLAUDE'),
      setupContent.lastIndexOf('link_claude_skill_dirs')
    );
    expect(claudeInstallSection).toContain('cleanup_old_claude_symlinks');
  });

  // --- Persistent config + interactive prompt tests ---

  test('setup reads skill_prefix from config', () => {
    expect(setupContent).toContain('get skill_prefix');
    expect(setupContent).toContain('GSTACK_CONFIG');
  });

  test('setup supports --prefix flag', () => {
    expect(setupContent).toContain('--prefix)');
    expect(setupContent).toContain('SKILL_PREFIX=1; SKILL_PREFIX_FLAG=1');
  });

  test('--prefix and --no-prefix persist to config', () => {
    expect(setupContent).toContain('set skill_prefix');
  });

  test('interactive prompt shows when no config', () => {
    expect(setupContent).toContain('Short names');
    expect(setupContent).toContain('Namespaced');
    expect(setupContent).toContain('Choice [1/2]');
  });

  test('non-TTY defaults to flat names', () => {
    // Should check if stdin is a TTY before prompting
    expect(setupContent).toContain('-t 0');
  });

  test('cleanup_prefixed_claude_symlinks exists and uses readlink', () => {
    expect(setupContent).toContain('cleanup_prefixed_claude_symlinks');
    const fnStart = setupContent.indexOf('cleanup_prefixed_claude_symlinks()');
    const fnEnd = setupContent.indexOf('}', setupContent.indexOf('removed[@]}', fnStart));
    const fnBody = setupContent.slice(fnStart, fnEnd);
    expect(fnBody).toContain('readlink');
    expect(fnBody).toContain('gstack-$skill_name');
  });

  test('reverse cleanup runs before link when prefix is disabled', () => {
    const claudeInstallSection = setupContent.slice(
      setupContent.indexOf('INSTALL_CLAUDE'),
      setupContent.lastIndexOf('link_claude_skill_dirs')
    );
    expect(claudeInstallSection).toContain('cleanup_prefixed_claude_symlinks');
  });

  test('welcome message references SKILL_PREFIX', () => {
    // gstack-upgrade is always called gstack-upgrade (it's the actual dir name)
    // but the welcome section should exist near the prefix logic
    expect(setupContent).toContain('Run /gstack-upgrade anytime');
  });
});

describe('discover-skills hidden directory filtering', () => {
  test('discoverTemplates skips dot-prefixed directories', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-discover-'));
    try {
      // Create a hidden dir with a template (should be excluded)
      fs.mkdirSync(path.join(tmpDir, '.hidden'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, '.hidden', 'SKILL.md.tmpl'), '---\nname: evil\n---\ntest');
      // Create a visible dir with a template (should be included)
      fs.mkdirSync(path.join(tmpDir, 'visible'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'visible', 'SKILL.md.tmpl'), '---\nname: good\n---\ntest');

      const { discoverTemplates } = require('../scripts/discover-skills');
      const results = discoverTemplates(tmpDir);
      const dirs = results.map((r: { tmpl: string }) => r.tmpl);

      expect(dirs).toContain('visible/SKILL.md.tmpl');
      expect(dirs).not.toContain('.hidden/SKILL.md.tmpl');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('telemetry', () => {
  test('telemetry start block lives in gstack-skill-start; render notes the handoff keys', () => {
    // The start-block bash moved into the script (Phase 1): it reads the
    // config, mints the session identity, and echoes the STATUS keys.
    expect(SKILL_START_SCRIPT).toContain('_TEL_START=$(date +%s)');
    expect(SKILL_START_SCRIPT).toContain('_SESSION_ID=');
    expect(SKILL_START_SCRIPT).toContain('echo "TELEMETRY:');
    expect(SKILL_START_SCRIPT).toContain('echo "TEL_PROMPTED:');
    expect(SKILL_START_SCRIPT).toMatch(/gstack-config" get telemetry/);
    // The render must tell the model to carry SESSION_ID/TEL_START to skill end.
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('SESSION_ID');
    expect(content).toContain('TEL_START');
  });

  test('telemetry opt-in prompt lives in gstack-skill-start (marker-gated emit)', () => {
    // Token-reduction Phase 2: the one-time consent prompt left the renders
    // (absence pinned by test/onboarding-moved-literals.test.ts); the script
    // gates it on the marker files and emits it as a GSTACK_INSTRUCTION block
    // with all three config-set outcomes and the ack INSIDE the block.
    expect(SKILL_START_SCRIPT).toContain(
      'if [ "$_TEL_PROMPTED" = "no" ] && [ "$_LAKE_SEEN" = "yes" ]; then',
    );
    expect(SKILL_START_SCRIPT).toContain('_emit_block telemetry-prompt');
    expect(SKILL_START_SCRIPT).toContain('gstack-config set telemetry community');
    expect(SKILL_START_SCRIPT).toContain('gstack-config set telemetry anonymous');
    expect(SKILL_START_SCRIPT).toContain('gstack-config set telemetry off');
    expect(SKILL_START_SCRIPT).toContain('touch "$_GH/.telemetry-prompted"');
  });

  test('generated SKILL.md contains telemetry epilogue (one gstack-skill-end call)', () => {
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('Telemetry (run last)');
    expect(content).toContain('gstack-skill-end --skill "gstack" --outcome OUTCOME');
    expect(content).toContain('--tel-start "TEL_START"');
    expect(content).toContain('PLAN MODE EXCEPTION');
    // The duration math + remote-log dispatch moved into gstack-skill-end.
    expect(SKILL_END_SCRIPT).toContain('_TEL_END');
    expect(SKILL_END_SCRIPT).toContain('_TEL_DUR');
    expect(SKILL_END_SCRIPT).toContain('SKILL_NAME');
    expect(SKILL_END_SCRIPT).toContain('OUTCOME');
    expect(SKILL_END_SCRIPT).toContain('gstack-telemetry-log');
  });

  test('pending marker handling lives in the scripts', () => {
    // gstack-skill-start finalizes stale markers; gstack-skill-end clears the
    // session's own marker.
    expect(SKILL_START_SCRIPT).toContain("-name '.pending-*'");
    expect(SKILL_START_SCRIPT).toContain('_pending_finalize');
    expect(SKILL_END_SCRIPT).toContain('.pending-$SESSION_ID');
  });

  test('telemetry blocks appear in all skill files that use PREAMBLE', () => {
    const skills = ['qa', 'ship', 'review', 'plan-ceo-review', 'plan-eng-review', 'retro'];
    for (const skill of skills) {
      const skillPath = path.join(ROOT, skill, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        const content = fs.readFileSync(skillPath, 'utf-8');
        expect(content).toContain('Telemetry (run last)');
        expect(content).toContain(`gstack-skill-end --skill "${skill}"`);
        expect(content).toContain('--tel-start "TEL_START"');
      }
    }
  });
});

describe('community fixes wave', () => {
  // Helper to get all generated SKILL.md files
  function getAllSkillMds(): Array<{ name: string; content: string }> {
    const results: Array<{ name: string; content: string }> = [];
    const rootPath = path.join(ROOT, 'SKILL.md');
    if (fs.existsSync(rootPath)) {
      results.push({ name: 'root', content: fs.readFileSync(rootPath, 'utf-8') });
    }
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const skillPath = path.join(ROOT, entry.name, 'SKILL.md');
      if (fs.existsSync(skillPath)) {
        results.push({ name: entry.name, content: fs.readFileSync(skillPath, 'utf-8') });
      }
    }
    return results;
  }

  // #594 — Discoverability: every SKILL.md.tmpl description contains "gstack"
  test('every SKILL.md.tmpl description contains "gstack"', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = skill.dir === '.' ? path.join(ROOT, 'SKILL.md.tmpl') : path.join(ROOT, skill.dir, 'SKILL.md.tmpl');
      const content = fs.readFileSync(tmplPath, 'utf-8');
      const desc = extractDescription(content);
      expect(desc.toLowerCase()).toContain('gstack');
    }
  });

  // #594 — Discoverability: first line of each description is under 120 chars
  test('every SKILL.md.tmpl description first line is under 120 chars', () => {
    for (const skill of ALL_SKILLS) {
      const tmplPath = skill.dir === '.' ? path.join(ROOT, 'SKILL.md.tmpl') : path.join(ROOT, skill.dir, 'SKILL.md.tmpl');
      const content = fs.readFileSync(tmplPath, 'utf-8');
      const desc = extractDescription(content);
      const firstLine = desc.split('\n')[0];
      // 英語版は 120 文字。日本語は 1 文字あたりの情報量が英語の約 2〜2.5 倍あるため、
      // 同じ「一覧で 1 行に収まる要約」を保つ上限として 300 文字を使う(現状の最長は約 283 文字)。
      expect(firstLine.length).toBeLessThanOrEqual(300);
    }
  });

  // #573 — Feature signals: ship/SKILL.md contains feature signal detection
  test('ship/SKILL.md contains feature signal detection in Step 4', () => {
    const content = readShipUnion();
    // MINOR は「機能の兆候」(新しいルート/ページ、マイグレーション、モジュール)で確認する、という Step 12 の規則
    expectMentions(content, [['MINOR', '機能の兆候', 'マイグレーション']], 'ship version bump rule');
  });

  // #510 — Context warnings: no SKILL.md contains "running low on context"
  test('no generated SKILL.md contains "running low on context"', () => {
    const skills = getAllSkillMds();
    for (const { name, content } of skills) {
      expect(content).not.toContain('running low on context');
    }
  });

  // #510 — Context warnings: plan-eng-review has explicit anti-warning
  test('plan-eng-review/SKILL.md explicitly forbids preemptive context warnings', () => {
    const content = readSkillUnion('plan-eng-review'); // carved: review body moved to section
    expectMentions(content, [['事前に警告しない']], 'plan-eng-review context-warning rule');
  });

  // #474 — Safety Net: no SKILL.md uses find with -delete
  test('no generated SKILL.md contains find with -delete flag', () => {
    const skills = getAllSkillMds();
    for (const { name, content } of skills) {
      // Match find commands that use -delete (but not prose mentioning the word "delete")
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes('find ') && line.includes('-delete')) {
          throw new Error(`${name}/SKILL.md contains find with -delete: ${line.trim()}`);
        }
      }
    }
  });

  // #467 — Telemetry: preamble JSONL writes are gated by telemetry setting
  test('preamble JSONL writes are inside telemetry conditional', () => {
    const preamble = fs.readFileSync(path.join(ROOT, 'scripts/resolvers/preamble.ts'), 'utf-8');
    // Find all skill-usage.jsonl write lines
    const lines = preamble.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('skill-usage.jsonl') && lines[i].includes('>>')) {
        // Look backwards for a telemetry conditional within 5 lines
        let foundConditional = false;
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          if (lines[j].includes('_TEL') && lines[j].includes('off')) {
            foundConditional = true;
            break;
          }
        }
        expect(foundConditional).toBe(true);
      }
    }
  });
});

describe('codex commands must not use inline $(git rev-parse --show-toplevel) for cwd', () => {
  // Regression test: inline $(git rev-parse --show-toplevel) in codex exec -C
  // or codex review without cd evaluates in whatever cwd the background shell
  // inherits, which may be a different project in Conductor workspaces.
  // The fix is to resolve _REPO_ROOT eagerly at the top of each bash block.

  // Scan all source files that could contain codex commands
  // Use Bun.Glob to avoid ELOOP from .claude/skills/gstack symlink back to ROOT
  const tmplGlob = new Bun.Glob('**/*.tmpl');
  const sourceFiles = [
    ...Array.from(tmplGlob.scanSync({ cwd: ROOT, followSymlinks: false })),
    ...fs.readdirSync(path.join(ROOT, 'scripts/resolvers'))
      .filter(f => f.endsWith('.ts'))
      .map(f => `scripts/resolvers/${f}`),
    'scripts/gen-skill-docs.ts',
  ];

  test('no codex exec command uses inline $(git rev-parse --show-toplevel) in -C flag', () => {
    const violations: string[] = [];
    for (const rel of sourceFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('codex exec') && line.includes('-C') && line.includes('$(git rev-parse --show-toplevel)')) {
          violations.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('no generated SKILL.md has codex exec with inline $(git rev-parse --show-toplevel) in -C flag', () => {
    const violations: string[] = [];
    const skillMdGlob = new Bun.Glob('**/SKILL.md');
    const skillMdFiles = Array.from(skillMdGlob.scanSync({ cwd: ROOT, followSymlinks: false }));
    for (const rel of skillMdFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes('codex exec') && line.includes('-C') && line.includes('$(git rev-parse --show-toplevel)')) {
          violations.push(`${rel}:${i + 1}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('codex review commands must be preceded by cd "$_REPO_ROOT" (no -C support)', () => {
    // codex review does not support -C, so the pattern must be:
    //   _REPO_ROOT=$(git rev-parse --show-toplevel) || { ... }
    //   cd "$_REPO_ROOT"
    //   codex review ...
    // NOT: codex review ... with inline $(git rev-parse --show-toplevel)
    const allFiles = [
      ...Array.from(tmplGlob.scanSync({ cwd: ROOT, followSymlinks: false })),
      ...Array.from(new Bun.Glob('**/SKILL.md').scanSync({ cwd: ROOT, followSymlinks: false })),
      ...fs.readdirSync(path.join(ROOT, 'scripts/resolvers'))
        .filter(f => f.endsWith('.ts'))
        .map(f => `scripts/resolvers/${f}`),
      'scripts/gen-skill-docs.ts',
    ];
    const violations: string[] = [];
    for (const rel of allFiles) {
      const abs = path.join(ROOT, rel);
      if (!fs.existsSync(abs)) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip non-executable lines (markdown table cells, prose references)
        if (line.includes('|') && line.includes('`/codex review`')) continue;
        if (line.includes('`codex review`')) continue;
        // Check for codex review with inline $(git rev-parse)
        if (line.includes('codex review') && line.includes('$(git rev-parse --show-toplevel)')) {
          violations.push(`${rel}:${i + 1} — inline git rev-parse in codex review`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('codex review commands take their scope from a flag, never from prompt text', () => {
    // `codex review` scope comes ONLY from --base/--commit/--uncommitted. The
    // positional [PROMPT] is mutually exclusive with all three (#1428, #1479),
    // and a prompt-only `codex review` silently falls back to the *uncommitted
    // working-tree* scope (`git status --short; git diff`) — so describing the
    // diff range in prompt text produces a confident review of the wrong
    // changes, with no error. Both halves are pinned here:
    //   (a) every `codex review` invocation carries a scope flag, and
    //   (b) no invocation puts a positional prompt in front of that flag.
    //
    // This does NOT apply to `codex exec`, which is agentic and really does run
    // the git command it's told to — the adversarial pass legitimately scopes
    // itself in prompt text.
    const checkedFiles = [
      'scripts/resolvers/review-dashboard.ts',
      'scripts/resolvers/plan-gates.ts',
      'scripts/resolvers/spec-review.ts',
      'scripts/resolvers/outside-voice-steps.ts',
      'scripts/resolvers/review-scope.ts',
      'review/SKILL.md',
      'ship/SKILL.md',
      'codex/SKILL.md.tmpl',
      'codex/SKILL.md',
      // codex's scoped invocations moved into the carved review-mode section
      // (T9) — keep sweeping both the .tmpl source and the generated section.
      'codex/sections/review-mode.md.tmpl',
      'codex/sections/review-mode.md',
    ];

    const violations: string[] = [];
    for (const rel of checkedFiles) {
      // ship's codex/adversarial command moved into sections/adversarial.md (T9 carve).
      const content = rel === 'ship/SKILL.md' ? readShipUnion() : fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Only inspect real shell invocations, not prose mentioning the command.
        if (line.includes('`codex review`')) continue;
        const match = line.match(/(?:^|[;&|]\s*|\s)codex\s+review\b(.*)$/);
        if (!match) continue;
        const rest = match[1];
        const scopeFlag = /--base\b|--commit\b|--uncommitted\b/;
        if (!scopeFlag.test(rest)) {
          // A quoted prompt with no scope flag is the silent-wrong-scope bug.
          if (/^\s*["'$]/.test(rest)) {
            violations.push(`${rel}:${i + 1} — prompt-only codex review (falls back to working-tree scope)`);
          }
          continue;
        }
        const beforeFlag = rest.split(scopeFlag)[0].trim();
        if (/^["'$]|^--\s*["']/.test(beforeFlag)) {
          violations.push(`${rel}:${i + 1} — positional prompt passed alongside a scope flag`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});

// ─── Learnings + Confidence Resolver Tests ─────────────────────

describe('LEARNINGS_SEARCH resolver', () => {
  const SEARCH_SKILLS = ['review', 'ship', 'plan-eng-review', 'investigate', 'office-hours', 'plan-ceo-review'];

  for (const skill of SEARCH_SKILLS) {
    test(`${skill} generated SKILL.md contains learnings search`, () => {
      const content = readSkillUnion(skill); // ship: moved to sections/plan-completion.md
      expect(content).toContain('Prior Learnings');
      expect(content).toContain('gstack-learnings-search');
    });
  }

  test('learnings search includes cross-project config check', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('cross_project_learnings');
    expect(content).toContain('--cross-project');
  });

  test('learnings search includes AskUserQuestion for first-time cross-project opt-in', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expectMentions(content, [['AskUserQuestion', 'unset'], ['A)', 'プロジェクト横断'], ['B)', 'プロジェクト内に限定']], 'review learnings opt-in');
    expectTokens(content, ['gstack-config set cross_project_learnings true', 'gstack-config set cross_project_learnings false'], 'review learnings opt-in');
  });

  test('Eng clarifies its full brief without changing any host options or other skills', async () => {
    const { generateLearningsSearch } = await import('../scripts/resolvers/learnings');
    const { ALL_HOST_CONFIGS } = await import('../hosts');
    const { HOST_PATHS } = await import('../scripts/resolvers/types');
    // Eng だけは「unset のとき」の 1 行が AskUserQuestion ではなく判断ブリーフの指示になる。その行だけが違うことを確認する。
    const gateLine = (text: string) => text.split('\n').find(line => line.includes('CROSS_PROJECT') && line.includes('unset')) ?? '';
    const withoutGate = (text: string) => text.split('\n').filter(line => !(line.includes('CROSS_PROJECT') && line.includes('unset'))).join('\n');
    for (const host of ALL_HOST_CONFIGS) {
      const ctx = { skillName: 'plan-eng-review', tmplPath: 'plan-eng-review/SKILL.md.tmpl', host: host.name, paths: HOST_PATHS[host.name]! };
      const eng = generateLearningsSearch(ctx);
      const standard = generateLearningsSearch({ ...ctx, skillName: 'review' });
      expect(generateLearningsSearch({ ...ctx, skillName: 'plan-ceo-review' })).toBe(standard);
      if (host.learningsMode === 'basic') {
        expect(eng).toBe(standard);
        expect(eng).not.toContain('CROSS_PROJECT');
      } else {
        expect(gateLine(eng)).toContain('判断ブリーフ');
        expect(gateLine(eng)).not.toContain('AskUserQuestion');
        expect(gateLine(standard)).toContain('AskUserQuestion');
        expect(withoutGate(eng)).toBe(withoutGate(standard));
        expect(eng).toContain('A) プロジェクト横断の学びを有効にする(推奨)');
        expect(eng).toContain('B) 学びをプロジェクト内に限定する');
        expect(eng).toContain('gstack-config set cross_project_learnings true');
        expect(eng).toContain('gstack-config set cross_project_learnings false');
      }
    }
  });

  test('learnings search mentions prior learning applied display format', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('過去の学びを適用');
  });
});

describe('LEARNINGS_LOG resolver', () => {
  const LOG_SKILLS = ['review', 'retro', 'investigate'];

  for (const skill of LOG_SKILLS) {
    test(`${skill} generated SKILL.md contains learnings log`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).toContain('Capture Learnings');
      expect(content).toContain('gstack-learnings-log');
    });
  }

  test('learnings log documents all type values', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    for (const type of ['pattern', 'pitfall', 'preference', 'architecture', 'tool']) {
      expect(content).toContain(type);
    }
  });

  test('learnings log documents all source values', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    for (const source of ['observed', 'user-stated', 'inferred', 'cross-model']) {
      expect(content).toContain(source);
    }
  });

  test('learnings log includes files field for staleness detection', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    // files フィールドは JSON のキーとして渡す(陳腐化検出に使われる)
    expect(content).toContain('"files":["path/to/relevant/file"]');
  });
});

describe('CONFIDENCE_CALIBRATION resolver', () => {
  // CSO owns a distinct evidence rubric; the shared numerical confidence
  // resolver would conflict with that contract and its private startup.
  const CONFIDENCE_SKILLS = ['review', 'ship', 'plan-eng-review'];

  for (const skill of CONFIDENCE_SKILLS) {
    test(`${skill} generated SKILL.md contains confidence calibration`, () => {
      const content = readSkillUnion(skill); // ship: moved to sections/review-army.md
      expect(content).toContain('Confidence Calibration');
      expectMentions(content, [skill === 'review' ? ['1〜10', 'スコア', '指摘'] : ['confidence', 'スコア', '指摘']], `${skill} confidence scoring`);
    });
  }

  test('confidence calibration includes scoring rubric with all tiers', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('9-10');
    expect(content).toContain('7-8');
    expect(content).toContain('5-6');
    expect(content).toContain('3-4');
    expect(content).toContain('1-2');
  });

  test('confidence calibration includes display rules', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    // 表示ルール: 9-10 / 7-8 は通常どおり表示、3-4 は本文から除外して付録のみ
    // 表の行ごと(1 行 = 1 つの表示ルール)に確認する
    expectTokens(content, [/\| 9-10 \|.*通常どおり表示/, /\| 7-8 \|.*通常どおり表示/, /\| 5-6 \|.*Medium confidence/, /\| 3-4 \|.*本文.*付録/], 'confidence display rules');
  });

  test('confidence calibration includes finding format example', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('[CRITICAL] (confidence:');
    expect(content).toContain('SQL injection');
  });

  test('confidence calibration includes calibration learning feedback loop', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    const flat = content.replace(/\s+/g, ' ');
    expectMentions(flat, [['キャリブレーション', '7 未満', '学びとして記録']], 'calibration learning loop');
  });

  test('skills without confidence calibration do NOT contain it', () => {
    // office-hours and retro do NOT use confidence calibration
    for (const skill of ['office-hours', 'retro']) {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('## Confidence Calibration');
    }
  });
});

describe('gen-skill-docs prefix warning (#620/#578)', () => {
  const { execSync } = require('child_process');

  test('warns about skill_prefix when config has prefix=true', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-prefix-warn-'));
    try {
      // Create a fake ~/.gstack/config.yaml with skill_prefix: true
      const fakeHome = tmpDir;
      const fakeGstack = path.join(fakeHome, '.gstack');
      fs.mkdirSync(fakeGstack, { recursive: true });
      fs.writeFileSync(path.join(fakeGstack, 'config.yaml'), 'skill_prefix: true\n');

      // Render into an out-dir under the fixture (the warning fires on any
      // non-dry-run generation) so the live tree is never rewritten.
      const outDir = path.join(tmpDir, 'out');
      const output = execSync(`bun run scripts/gen-skill-docs.ts --out-dir "${outDir}"`, {
        cwd: ROOT,
        env: { ...process.env, HOME: fakeHome },
        encoding: 'utf-8',
        timeout: 30000,
      });
      expect(output).toContain('skill_prefix is true');
      expect(output).toContain('gstack-relink');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('no warning when skill_prefix is false or absent', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-prefix-warn-'));
    try {
      const fakeHome = tmpDir;
      const fakeGstack = path.join(fakeHome, '.gstack');
      fs.mkdirSync(fakeGstack, { recursive: true });
      fs.writeFileSync(path.join(fakeGstack, 'config.yaml'), 'skill_prefix: false\n');

      const outDir = path.join(tmpDir, 'out');
      const output = execSync(`bun run scripts/gen-skill-docs.ts --out-dir "${outDir}"`, {
        cwd: ROOT,
        env: { ...process.env, HOME: fakeHome },
        encoding: 'utf-8',
        timeout: 30000,
      });
      expect(output).not.toContain('skill_prefix is true');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('voice-triggers processing', () => {
  const { extractVoiceTriggers, processVoiceTriggers } = require('../scripts/gen-skill-docs') as {
    extractVoiceTriggers: (content: string) => string[];
    processVoiceTriggers: (content: string) => string;
  };

  test('extractVoiceTriggers parses valid YAML list', () => {
    const content = `---\nname: cso\ndescription: |\n  Security audit.\nvoice-triggers:\n  - "see-so"\n  - "security review"\n---\nBody`;
    const triggers = extractVoiceTriggers(content);
    expect(triggers).toEqual(['see-so', 'security review']);
  });

  test('extractVoiceTriggers returns [] when no field present', () => {
    const content = `---\nname: qa\ndescription: |\n  QA testing.\n---\nBody`;
    expect(extractVoiceTriggers(content)).toEqual([]);
  });

  test('processVoiceTriggers appends voice triggers to description', () => {
    const content = `---\nname: cso\ndescription: |\n  Security audit. (gstack)\nvoice-triggers:\n  - "see-so"\n  - "security review"\n---\nBody`;
    const result = processVoiceTriggers(content);
    expect(result).toContain('音声トリガー(音声入力の別名): "see-so", "security review"。');
  });

  test('processVoiceTriggers strips voice-triggers field from output', () => {
    const content = `---\nname: cso\ndescription: |\n  Security audit. (gstack)\nvoice-triggers:\n  - "see-so"\n---\nBody`;
    const result = processVoiceTriggers(content);
    expect(result).not.toContain('voice-triggers:');
  });

  test('processVoiceTriggers returns content unchanged when no voice-triggers', () => {
    const content = `---\nname: qa\ndescription: |\n  QA testing.\n---\nBody`;
    expect(processVoiceTriggers(content)).toBe(content);
  });

  test('CSO voice triggers fold into the full description', () => {
    // The Claude catalog trim drops this line from cso/SKILL.md; full-mode and
    // other-host renders still carry it.
    const content = processVoiceTriggers(fs.readFileSync(path.join(ROOT, 'cso', 'SKILL.md.tmpl'), 'utf-8'));
    expect(content).toContain('"see-so"');
    expect(content).toContain('音声トリガー(音声入力の別名):');
  });

  test('Claude root router routes every skill voice trigger the catalog trim drops', () => {
    const routing = between(fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8'), '**ルーティングルール', '**振り分けは');
    const skills = fs.readdirSync(ROOT).filter(d => !fs.lstatSync(path.join(ROOT, d)).isSymbolicLink() && fs.existsSync(path.join(ROOT, d, 'SKILL.md.tmpl')));
    let routed = 0;
    for (const skill of skills) {
      const triggers = extractVoiceTriggers(fs.readFileSync(path.join(ROOT, skill, 'SKILL.md.tmpl'), 'utf-8').replace(/\r\n/g, '\n'));
      if (triggers.length === 0) continue;
      const line = routing.split('\n').find(l => l.endsWith(`→ \`/${skill}\` を実行`) && l.startsWith('- 音声トリガー '));
      expect(line, skill).toBeDefined();
      for (const t of triggers) expect(line, skill).toContain(`"${t}"`);
      routed++;
    }
    expect(routed).toBeGreaterThan(0);
  });

  test('generated CSO SKILL.md does NOT contain raw voice-triggers field', () => {
    const content = fs.readFileSync(path.join(ROOT, 'cso', 'SKILL.md'), 'utf-8');
    const fmEnd = content.indexOf('\n---', 4);
    const frontmatter = content.slice(0, fmEnd);
    expect(frontmatter).not.toContain('voice-triggers:');
  });

  test('generated Claude CSO skill preauthorizes only the trusted launcher', () => {
    const expected = [
      'Bash(~/.claude/skills/gstack/bin/gstack-cso-launcher *)',
      'Bash(~/.claude/skills/gstack/bin/gstack-cso-launcher.exe *)',
    ];
    for (const file of ['cso/SKILL.md.tmpl', 'cso/SKILL.md']) {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8');
      const fmEnd = content.indexOf('\n---', 4);
      const frontmatter = Bun.YAML.parse(content.slice(4, fmEnd)) as Record<string, unknown>;
      expect(frontmatter['allowed-tools'], file).toEqual(expected);
    }
  });

  test('generated CSO host variants retain challenge fallback and host-containment disclosure', () => {
    const claude = fs.readFileSync(path.join(ROOT, 'cso', 'SKILL.md'), 'utf-8');
    const codex = fs.readFileSync(path.join(EXTERNAL_OUT, '.agents', 'skills', 'gstack-cso', 'SKILL.md'), 'utf-8');
    for (const content of [claude, codex]) {
      expect(content).toContain('sequential challenge; independent agent unavailable');
      expectMentions(content, [['隔離', 'サンドボックス', 'ありません']], 'content');
      expectMentions(content, [['独立した', 'レビュアー', '要求しないでください']], 'content');
    }
  });

  // Gen-time-only keys: interactive + benefits-from are read from the .tmpl by
  // buildContext; the generated copy has no reader (the host reads name/
  // description/allowed-tools/hooks; gbrain: is runtime-read and NOT stripped).
  // Pin the strip so a stripFields refactor can't silently re-add the always-on
  // frontmatter weight — mirrors the voice-triggers pins above.
  test('generated SKILL.md strips gen-time-only keys the .tmpl still declares', () => {
    const tmpl = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md.tmpl'), 'utf-8');
    const tmplFm = tmpl.slice(0, tmpl.indexOf('\n---', 4));
    expect(tmplFm).toContain('interactive:');
    expect(tmplFm).toContain('benefits-from:');

    const generated = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    const genFm = generated.slice(0, generated.indexOf('\n---', 4));
    expect(genFm).not.toContain('interactive:');
    expect(genFm).not.toContain('benefits-from:');

    // The runtime-read and host-read keys survive the strip.
    const investigate = fs.readFileSync(path.join(ROOT, 'investigate', 'SKILL.md'), 'utf-8');
    const invFm = investigate.slice(0, investigate.indexOf('\n---', 4));
    expect(invFm).toContain('hooks:');
    expect(invFm).toContain('gbrain:');
  });
});

describe('CEO accepted requirement preservation', () => {
  test('HOLD SCOPE includes implementation work needed to meet accepted requirements', () => {
    const main = fs.readFileSync(path.join(ROOT, 'plan-ceo-review/SKILL.md'), 'utf8');
    const hold = main.slice(main.indexOf('**HOLD SCOPE の場合**'), main.indexOf('**SCOPE REDUCTION の場合:**'));
    expectMentions(hold, [['受け入れ基準', '維持'], ['必要な修復', 'スコープに含まれます']], 'HOLD SCOPE');
  });

  test('loaded sections keep requirement conflicts unresolved until an authorized decision', () => {
    const section = fs.readFileSync(path.join(ROOT, 'plan-ceo-review/sections/review-sections.md'), 'utf8');
    const policy = section.slice(section.indexOf('**承認された要件を保持してください。**'), section.indexOf('### セクション 1:')).replace(/\s+/g, ' ');
    expectMentions(policy, [['ギャップ', '報告', '対処案'], ['HOLD SCOPE', '抜けている']], 'policy');
    expectMentions(policy, [['保証', '弱めたり', '違反']], 'policy');
    expectMentions(policy, [['文書化', '要件', '満たしたことにはなりません']], 'policy');
    expectMentions(policy, [['要件の変更', '明示的な権限']], 'policy');
    expectMentions(policy, [['自動判断', '制約', '覆すことはできません']], 'policy');
  });
});

describe('plan-mode-info resolver (handshake-replacement)', () => {
  const REVIEW_SKILLS = [
    'plan-ceo-review',
    'plan-eng-review',
    'plan-design-review',
    'plan-devex-review',
  ];

  // Header for the vestigial handshake that was removed. If it ever reappears,
  // someone accidentally re-introduced the resolver.
  const HANDSHAKE_MARKER = '## Plan Mode Handshake';
  // Header for the new plan-mode-info section (previously lived at the tail
  // of completion-status.ts; now hoisted to position 1 of the preamble).
  const PLAN_MODE_INFO_MARKER = '## Skill Invocation During Plan Mode';

  test('vestigial handshake is absent from all generated Claude SKILL.md files', () => {
    // Scan every generated SKILL.md under ROOT (top-level directory per skill).
    // Using fs.readdirSync + filter instead of a glob so we catch any skill
    // that gets added later without updating this list.
    const entries = fs.readdirSync(ROOT, { withFileTypes: true });
    let checked = 0;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMd = path.join(ROOT, entry.name, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      expect(content, `handshake marker in ${entry.name}/SKILL.md`).not.toContain(HANDSHAKE_MARKER);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('vestigial handshake is absent from non-Claude host outputs', () => {
    // Non-Claude hosts render to hostSubdirs (.agents/, .openclaw/, etc). The
    // plan-mode-info section renders only on planMode hosts (#3168); no host
    // gets the old handshake. Scan every candidate host tree in
    // the module-level out-dir render (--host all), which is always present —
    // so the check can no longer silently degrade to a console warning.
    const hostDirs = ['.agents', '.openclaw', '.opencode', '.factory', '.hermes', '.kiro', '.cursor', '.slate'];
    let checked = 0;
    for (const host of hostDirs) {
      const skillsRoot = path.join(EXTERNAL_OUT, host, 'skills');
      if (!fs.existsSync(skillsRoot)) continue;
      const entries = fs.readdirSync(skillsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(skillsRoot, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) continue;
        const content = fs.readFileSync(skillMd, 'utf-8');
        expect(content, `handshake marker in ${host}/skills/${entry.name}/SKILL.md`).not.toContain(HANDSHAKE_MARKER);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('plan-mode section renders only for hosts whose capabilities declare planMode (#3168)', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const skillsRoot = host.name === 'claude' ? EXTERNAL_OUT : path.join(EXTERNAL_OUT, host.hostSubdir, 'skills');
      const files = fs.readdirSync(skillsRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
        .map(entry => path.join(skillsRoot, entry.name, 'SKILL.md'))
        .filter(file => fs.existsSync(file));
      expect(files.length, `${host.name}: no rendered skills under ${skillsRoot}`).toBeGreaterThan(0);
      const withSection = files.filter(file => {
        const content = fs.readFileSync(file, 'utf-8');
        return content.includes(PLAN_MODE_INFO_MARKER) || content.includes('## Plan Mode Safe Operations');
      }).map(file => path.relative(EXTERNAL_OUT, file));
      if (host.capabilities.planMode) {
        expect(withSection.some(file => file.endsWith(`plan-ceo-review${path.sep}SKILL.md`)), `${host.name} lost the plan-mode section`).toBe(true);
      } else {
        expect(withSection, `${host.name} declares planMode:false but renders the plan-mode section`).toEqual([]);
      }
    }
  });

  test.each(REVIEW_SKILLS)(
    '%s/SKILL.md contains the new plan-mode-info section near the top',
    (skill) => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      const idx = content.indexOf(PLAN_MODE_INFO_MARKER);
      expect(idx).toBeGreaterThan(0);
      // Position 1 in preamble composition = within the first ~300 lines.
      // Roughly translates to first ~15KB of text.
      expect(idx).toBeLessThan(15_000);
    },
  );

  test('plan-mode-info is wired BEFORE generateUpgradeCheck in preamble', () => {
    // Token-reduction Phase 2: generateUpgradeCheck's render output is now
    // ONLY the steady-state PROACTIVE-false + SKILL_PREFIX rules (the
    // UPGRADE_AVAILABLE prose emits from bin/gstack-skill-start at runtime),
    // so those rules are the resolver's order marker.
    const content = fs.readFileSync(
      path.join(ROOT, 'plan-ceo-review', 'SKILL.md'),
      'utf-8',
    );
    const planModeIdx = content.indexOf(PLAN_MODE_INFO_MARKER);
    const upgradeIdx = content.search(/`PROACTIVE` が `"?false"?`/);
    expect(planModeIdx).toBeGreaterThan(0);
    expect(upgradeIdx).toBeGreaterThan(0);
    expect(planModeIdx).toBeLessThan(upgradeIdx);
  });

  test('0D authority and fresh-approval paths precede mode selection', () => {
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8').replace(/\s+/g, ' ');
    const approachIdx = content.indexOf('### 0D.');
    const constructIdx = content.indexOf('`currentDecision` を一つ作成', approachIdx);
    const saveIdx = content.indexOf('**質問前のチェックポイント:**', constructIdx);
    const presentIdx = content.indexOf('1 回の呼び出しで 1 行だけ尋ね', saveIdx);
    const stopIdx = presentIdx < 0 ? -1 : content.indexOf('**実際の回答を得るまで停止してください。**', presentIdx);
    const modeIdx = content.indexOf('### 0E. モード選択');
    const preludeIdx = content.indexOf('### 0F');
    const positions = [approachIdx, constructIdx, saveIdx, presentIdx, stopIdx, modeIdx, preludeIdx];
    expect(positions.every(position => position > 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const approach = content.slice(approachIdx, modeIdx);
    expectMentions(approach, [['正確な', '承認', '再利用']], 'approach');
    expectTokens(content, ['正確な承認とスコープ'], 'plan-ceo-review');
    // 再検討は、矛盾・変わった前提・ユーザーの指示がある場合だけ(推測やレビュー担当者の同意では再検討しない)
    expectMentions(approach, [['再検討', '矛盾', '変わった前提', 'ユーザーの指示'], ['推測', 'レビュー担当者の同意', '再検討しないでください']], 'approach');
    const reopenIdx = content.indexOf('矛盾、変わった前提');
    expect(reopenIdx).toBeGreaterThan(approachIdx);
    expect(reopenIdx).toBeLessThan(presentIdx);
    const gate = content.slice(stopIdx, modeIdx);
    const startup = content.slice(content.indexOf('### 0C.'), approachIdx);
    expectMentions(startup, [['0E の前に', '0D', '未解決'], ['A)', 'B)', 'C)'], ['必要な選択がない', '0E']], 'startup');
    expectMentions(approach, [['0D', 'モード選択', '呼び出し元', '戻り']], 'approach');
    expectTokens(approach, ['**モード変更**'], 'approach');
    const modeChange = content.slice(content.indexOf('**モードの変更:**'), preludeIdx);
    expectMentions(modeChange, [['4 つのモード', 'メニュー', '尋ねてください']], 'modeChange');
    expectMentions(gate, [['実際の回答', '停止'], ['呼び出し元', '戻り', '同じことを二度と尋ねないでください']], 'gate');
    expectMentions(gate, [['選択肢が一つだけ', '同じ']], 'gate');
    expectMentions(approach, [['推奨は承認ではありません']], 'approach');
    expectMentions(approach, [['その引数オブジェクトは変えずに', '組み立て直さない']], 'approach');
    expectMentions(gate, [['回答への参照', 'スコープ', '正確な承認とスコープ'], ['状態を更新'], ['許可された作業だけを修正']], 'gate');
    expectMentions(gate, [['次の行に進む前に', '保存ポリシー']], 'gate');
  });
});

// Every skill that renders {{PLAN_FILE_REVIEW_REPORT}} / {{EXIT_PLAN_MODE_GATE}},
// on every host: the union covers each skill-specific branch of both resolvers.
function renderPlanReportAndGate(): string {
  const { generatePlanFileReviewReport } = require('../scripts/resolvers/review-dashboard');
  const { generateExitPlanModeGate } = require('../scripts/resolvers/plan-gates');
  const { HOST_PATHS } = require('../scripts/resolvers/types');
  const skills = ['codex', 'devex-review', 'plan-ceo-review', 'plan-design-review', 'plan-devex-review', 'plan-eng-review'];
  return ALL_HOST_CONFIGS.flatMap((host) => skills.map((skillName) => {
    const ctx = { skillName, tmplPath: `${skillName}/SKILL.md.tmpl`, host: host.name, paths: HOST_PATHS[host.name] };
    return `${generatePlanFileReviewReport(ctx)}\n${generateExitPlanModeGate(ctx)}`;
  })).join('\n');
}

// GSTACK REVIEW REPORT report-at-bottom contract — verifies the prompt-text
// fix in scripts/resolvers/review-dashboard.ts (the load-bearing change for the
// "report not at bottom of plan in plan mode" bug). The bug is in the
// prompt's contradictory write-flow instructions, not in observable
// runtime behavior we can cheaply gate in CI. Verifying the prompt text
// directly is the deterministic equivalent of the regression test the
// PTY harness can't reliably drive (autoplan needs auto-progression of
// AskUserQuestions to reach the report-write step, which the harness
// doesn't support today).
describe('GSTACK REVIEW REPORT delete-then-append flow', () => {
  const PLAN_REVIEW_SKILLS = [
    'plan-ceo-review',
    'plan-design-review',
    'plan-devex-review',
    'plan-eng-review',
  ];

  for (const skill of PLAN_REVIEW_SKILLS) {
    test(`${skill}/SKILL.md prescribes delete-then-append, not in-place replace`, () => {
      // Carved skills (v2 plan Phase B) relocate the review-report prose into
      // sections/*.md; readSkillUnion follows the content wherever the carve put it.
      const content = readSkillUnion(skill);

      // The new (correct) instruction must be present.
      expectMentions(content, [['削除してから追記する'], ['その場で置き換えてはいけません'], ['削除してから', '追記']], `${skill} review report flow`);

      // The old contradictory bullets must be gone. The signature phrase
      // from the buggy prompt was 'replace it entirely using the Edit tool'
      // which is what allowed mid-file reports to stay mid-file.
      expect(content).not.toContain('replace it** entirely using the Edit tool');
      expect(content).not.toContain('If it was found mid-file, move it');
    });
  }

  test('plan-file review report resolver renders the rewritten flow', () => {
    const src = renderPlanReportAndGate();
    expectMentions(src, [['削除してから追記する'], ['その場で置き換えてはいけません'], ['削除してから', '追記']], 'plan-file review report resolver');
    // Old contradictory bullets are gone from the source resolver.
    expect(src).not.toContain('replace it** entirely using the Edit tool');
    expect(src).not.toContain('If it was found mid-file, move it');
  });
});

describe('LEARNINGS_SEARCH resolver: query parameter', () => {
  // Lazy-load resolver and types after describe block to keep test file self-contained.
  const { generateLearningsSearch } = require('../scripts/resolvers/learnings');
  const { HOST_PATHS } = require('../scripts/resolvers/types');

  const claudeCtx = {
    skillName: 'test',
    tmplPath: 'test/SKILL.md.tmpl',
    host: 'claude',
    paths: HOST_PATHS.claude,
  };
  const codexCtx = { ...claudeCtx, host: 'codex', paths: HOST_PATHS.codex };

  test('no args → bash does not contain --query (backwards-compat)', () => {
    const out = generateLearningsSearch(claudeCtx);
    expect(out).not.toContain('--query');
  });

  test('claude host + query=foo bar → both cross-project and project-scoped branches contain --query', () => {
    const out = generateLearningsSearch(claudeCtx, ['query=foo bar']);
    // Both branches of the if/else must carry the flag.
    const lines = out.split('\n').filter(l => l.includes('gstack-learnings-search'));
    expect(lines.length).toBeGreaterThanOrEqual(2);
    for (const line of lines) {
      expect(line).toContain('--query "foo bar"');
    }
  });

  test('codex host + query=foo bar → codex bash variant contains --query', () => {
    const out = generateLearningsSearch(codexCtx, ['query=foo bar']);
    expect(out).toContain('--query "foo bar"');
    expect(out).toContain('$GSTACK_BIN/gstack-learnings-search');
  });

  test('empty value query= → bash does not contain --query (locked semantics: falls through)', () => {
    const claudeOut = generateLearningsSearch(claudeCtx, ['query=']);
    expect(claudeOut).not.toContain('--query');
    const codexOut = generateLearningsSearch(codexCtx, ['query=']);
    expect(codexOut).not.toContain('--query');
  });

  test('shell-injection chars in query= → throws at gen-time (defense in depth)', () => {
    for (const bad of ['$(whoami)', '`cmd`', 'a;b', 'a&b', 'a"b', 'a\\b', 'foo$x']) {
      expect(() => generateLearningsSearch(claudeCtx, [`query=${bad}`])).toThrow(/alphanumeric/);
    }
  });
});

describe('EXIT PLAN MODE GATE placement', () => {
  // Fresh skill list — do NOT reuse REVIEW_SKILLS upstream (3 entries, missing plan-devex).
  const planSkills = ['plan-eng-review', 'plan-ceo-review', 'plan-design-review', 'plan-devex-review'];

  // Strip fenced code blocks before matching headings — PLAN_FILE_REVIEW_REPORT
  // already contains `## GSTACK REVIEW REPORT` inside a markdown example fence,
  // and the gate text itself shows `## GSTACK REVIEW REPORT` inside a fence too.
  const stripFences = (md: string) => md.replace(/```[\s\S]*?```/g, '');

  test('gate follows review work, with only the declared cache hook after CEO and Eng verification', () => {
    const GATE = '## EXIT PLAN MODE GATE (BLOCKING)(プランモード終了ゲート。ブロッキング)';
    for (const skill of planSkills) {
      const md = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      const stripped = stripFences(md);
      const headings = [...stripped.matchAll(/^## .+$/gm)].map(m => m[0]);
      const lastH2 = headings.at(-1);
      if (['plan-ceo-review', 'plan-eng-review'].includes(skill)) {
        const gate = headings.indexOf(GATE);
        // 見出しは日本語化(「セクションの自己チェック(終える前に)」など)。「セクション」+「チェック」で特定する。
        const selfCheck = headings.findIndex(h => h.startsWith('## セクション') && h.includes('チェック'));
        expect(selfCheck).toBeGreaterThanOrEqual(0);
        expect(gate).toBeGreaterThan(selfCheck);
        const afterGate = headings.slice(gate);
        expect(afterGate.length).toBe(2);
        expect(afterGate[0]).toBe(GATE);
        expect(afterGate[1]!.startsWith('## Brain Cache Background Refresh')).toBe(true);
        const tail = md.slice(md.indexOf(GATE));
        const compactTail = tail.replace(/\s+/g, ' ');
        // テレメトリの目印: CEO は前文の日本語ラベル、Eng は英語のまま残った太字ラベル
        const telemetryMarker = skill === 'plan-ceo-review' ? '**テレメトリ(最後に実行)**' : '**Telemetry (run last)**';
        const cacheHeading = '## Brain Cache Background Refresh';
        const telemetry = tail.indexOf(telemetryMarker);
        expect(telemetry, `${skill} telemetry marker`).toBeGreaterThan(0);
        const cache = tail.indexOf(cacheHeading);
        if (skill === 'plan-ceo-review') expect(telemetry).toBeGreaterThan(cache);
        else expect(telemetry).toBeLessThan(cache);
        expectMentions(compactTail, [skill === 'plan-ceo-review' ? ['検証済みの保存済み報告を伴う合格'] : ['ゲートを通過した後']], `${skill} gate pass path`);
        const finalHandoff = tail.slice(cache);
        expectMentions(finalHandoff, [skill === 'plan-ceo-review' ? ['ExitPlanMode', '呼び出し元'] : ['テレメトリ', 'キャッシュ', 'ExitPlanMode']], `${skill} final handoff`);
        if (skill === 'plan-ceo-review') {
          expect(finalHandoff.indexOf('ExitPlanMode')).toBeGreaterThan(finalHandoff.indexOf(telemetryMarker));
          expectMentions(finalHandoff, [['引き継ぎ', '別のワークフロー']], 'finalHandoff');
        }
        if (skill === 'plan-eng-review') {
          expectMentions(compactTail, [['回復できなかった保存', '通過できません']], 'eng gate tail');
          expectMentions(finalHandoff, [['ホストがプランモードにある場合のみ', 'ExitPlanMode']], 'finalHandoff');
          expectMentions(finalHandoff, [['ExitPlanMode', '呼び出さないでください'], ['現在の会話', '終えてください']], 'finalHandoff');
        } else {
          expectTokens(compactTail, ['**ログのみの欠落を伴う合格:**', '**未保存**'], 'ceo gate outcomes');
          expectMentions(compactTail, [['書き込まれていない成果物', '未保存'], ['成功のテレメトリ', 'ExitPlanMode', 'なしで']], 'ceo gate outcomes');
        }
      } else {
        expect(lastH2, `${skill}/SKILL.md last ## heading (fences stripped)`).toBe(GATE);
      }
      if (skill === 'plan-eng-review') {
        const gate = extractMarkdownSection(md, GATE).replace(/\s+/g, ' ');
        expectTokens(gate, ['**Blocked outcome**'], 'gate');
        expectMentions(gate, [['成功のテレメトリ', 'ExitPlanMode', '行わずに']], 'gate');
      } else if (skill === 'plan-ceo-review') {
        expectTokens(md, ['**Gate outcome: Blocked**'], `${skill}/SKILL.md gate body`);
      } else {
        expectMentions(extractMarkdownSection(md, GATE), [['ExitPlanMode', '呼び出してはいけません']], `${skill}/SKILL.md gate body`);
      }
    }
  });

  test('codex/SKILL.md contains gate (mid-file per D5; Step 2B/2C follow)', () => {
    const codex = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(codex).toContain('## EXIT PLAN MODE GATE (BLOCKING)');
    expectMentions(extractMarkdownSection(codex, '## EXIT PLAN MODE GATE (BLOCKING)'), [['ExitPlanMode', '呼び出してはいけません']], 'codex gate');
  });
});

describe('scope-gate exceptions drift-guard', () => {
  // The plan-mode auto-select-B exceptions block is hand-duplicated in the
  // plan-eng-review and plan-design-review templates (matching the gate
  // around it, which predates this block). The two copies must stay
  // identical in their target-selection policy. Eng resolves that policy
  // before announcing its target and has a separate bootstrap transport;
  // Design retains its own startup sequence and page vocabulary.
  // A future edit to one copy that silently misses the other fails here
  // instead of drifting. The real fix (shared {{SCOPE_GATE}} resolver) is a
  // filed TODO — this guard is the stopgap that makes the duplication safe.
  const START_MARKER = '**例外 — 質問する前に、この順序で確認してください:**';
  // eng は「適用されなかった場合」、design は「適用されない場合」と訳が分かれている
  const END_MARKERS = ['上記の例外が適用されなかった場合:', '上記の例外が適用されない場合:'];
  const endMarkerOf = (md: string, from: number) => END_MARKERS.find(marker => md.indexOf(marker, from) >= 0) ?? END_MARKERS[0]!;
  // PTY 検出器が固定する告知文。eng は英語のまま、design は日本語に訳されている
  const ANNOUNCEMENTS = ['スコープゲート: プランモード — Bを自動選択(<対象>をレビュー)'];

  function extractExceptionsBlock(skill: string): string {
    const md = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
    const start = md.indexOf(START_MARKER);
    expect(start, `${skill}/SKILL.md: exceptions block start marker present`).toBeGreaterThan(-1);
    const endMarker = endMarkerOf(md, start);
    const end = md.indexOf(endMarker, start);
    expect(end, `${skill}/SKILL.md: exceptions block end marker present`).toBeGreaterThan(start);
    return md.slice(start, end + endMarker.length);
  }

  // eng と design は別々に訳されているため文面は一致しない。ターゲット選択ポリシーの要素(自動選択の条件、
  // 複数候補の扱い、明示指定の優先、迷ったら質問)が両方に残っていることを確認する。
  const POLICY_RULES: string[][] = [
    ['プランモード', 'B', '自動'],
    ['複数', 'ホストが参照しているプランファイルを優先'],
    ['それでも曖昧', '質問'],
    ['選択が優先'],
    ['プランモード', 'プランが存在しない', '通常どおり質問'],
    ['ユーザー', '明示的に', 'branch diff', '質問を省略'],
    ['迷ったら質問してください'],
  ];

  test('eng and design retain the same target-selection policy across distinct startup sequences', () => {
    const engRaw = extractExceptionsBlock('plan-eng-review');
    const designRaw = extractExceptionsBlock('plan-design-review');
    for (const [name, block] of [['eng', engRaw], ['design', designRaw]] as const) {
      expectMentions(block, POLICY_RULES, name);
      // 例外は 1(プランモード)→ 2(ユーザー指定)の順
      expect(block.indexOf('1. **'), name).toBeGreaterThanOrEqual(0);
      expect(block.indexOf('2. **'), name).toBeGreaterThan(block.indexOf('1. **'));
    }
    // eng: 明示指定の優先は、自動選択の告知より前に述べられる
    expect(engRaw.indexOf('選択が優先されます')).toBeGreaterThan(-1);
    expect(engRaw.indexOf('選択が優先されます')).toBeLessThan(engRaw.indexOf('自動選択したプランは 1 行で伝え'));
    const engMd = fs.readFileSync(path.join(ROOT, 'plan-eng-review/SKILL.md'), 'utf8');
    const endIdx = engMd.indexOf(endMarkerOf(engMd, engMd.indexOf(START_MARKER)));
    const transport = engMd.indexOf('有効化されている MCP の AskUserQuestion があればそれを、なければネイティブの AskUserQuestion を選びます');
    expect(transport).toBeGreaterThan(endIdx);
    expect(transport).toBeLessThan(engMd.indexOf('## Preamble (after scope gate)'));
  });

  test('exceptions block carries the announcement string the PTY detectors pin', () => {
    for (const skill of ['plan-eng-review', 'plan-design-review']) {
      const block = extractExceptionsBlock(skill);
      expect(ANNOUNCEMENTS.some(text => block.includes(text)), `${skill}: announcement string`).toBe(true);
    }
  });

  test('gate menu carries the question strings the PTY question detector pins', () => {
    // isScopeGateQuestionVisible (claude-pty-runner.ts) anchors on the
    // question text + option A's body. If the menu is reworded without
    // updating the detector, the paid smokes' must-stay-false assertions go
    // vacuous — this free pin fails first.
    for (const skill of ['plan-eng-review', 'plan-design-review']) {
      const md = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      // メニュー文は eng が日本語、design が英語のまま(翻訳の不統一。PTY 検出器は英語を固定している)
      expect(['What should I review?', 'レビュー対象は何ですか?'].some(text => md.includes(text)), `${skill}: gate question text`).toBe(true);
      expect(['The current branch diff', '現在のブランチの差分'].some(text => md.includes(text)), `${skill}: option A body text`).toBe(true);
    }
  });
});

describe('GSTACK REVIEW REPORT mandatory unresolved-decisions status', () => {
  // Report text rides in PLAN_FILE_REVIEW_REPORT → every report consumer gets it.
  // devex-review is a report consumer but NOT a gate consumer, so the two target
  // sets differ (CP5/CX5). Regression guard: a future token-cut that drops the
  // unresolved-status line again fails here. See plan-flag-unresolved-issues.
  const REPORT_CONSUMERS = [
    'plan-ceo-review',
    'plan-eng-review',
    'plan-design-review',
    'plan-devex-review',
    'codex',
    'devex-review',
  ];
  // Gate text rides in EXIT_PLAN_MODE_GATE (lives in SKILL.md, not sections).
  const GATE_SKILLS = [
    'plan-ceo-review',
    'plan-eng-review',
    'plan-design-review',
    'plan-devex-review',
    'codex',
  ];

  for (const skill of REPORT_CONSUMERS) {
    test(`${skill}: report mandates the unresolved-decisions status as final content`, () => {
      const content = readSkillUnion(skill);
      expect(content).toContain('NO UNRESOLVED DECISIONS');
      // 「空白を除く最後の行」(改行での折り返しを許容)
      expect(content).toMatch(/空白を除く\s*最後の\s*行/);
    });
  }

  for (const skill of GATE_SKILLS) {
    test(`${skill}: exit gate blocks unless the unresolved status is the final line`, () => {
      const md = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      // Gate check #4 — present, sentinel named, and explicitly blocking (no escape).
      expect(md).toContain('NO UNRESOLVED DECISIONS');
      if (['plan-ceo-review', 'plan-eng-review'].includes(skill)) {
        const gate = md.split('## EXIT PLAN MODE GATE (BLOCKING)')[1]!.replace(/\s+/g, ' ');
        expect(gate).toMatch(/空白を除く最終行が、太字にしていない `NO UNRESOLVED DECISIONS`/);
        expect(gate).toContain('`**UNRESOLVED DECISIONS:**`');
        expectMentions(gate, [['ステータスの欠落', '失敗します']], `${skill} gate`);
        if (skill === 'plan-eng-review') expectMentions(gate, [['**Blocked outcome**', '成功のテレメトリ', 'ExitPlanMode']], `${skill} gate`);
        else expectTokens(gate, ['**Gate outcome: Blocked**'], `${skill} gate`);
      } else {
        const gate = extractMarkdownSection(md, '## EXIT PLAN MODE GATE (BLOCKING)');
        expect(gate).toMatch(/空白を除く\s*最終行/);
        expect(gate).toContain('`**UNRESOLVED DECISIONS:**`');
        expectMentions(gate, [['ステータスの欠落', 'ゲートの失敗']], `${skill} gate`);
      }
    });
  }

  test('plan-file review report and exit gate resolvers render the mandatory block + blocking gate', () => {
    const src = renderPlanReportAndGate();
    expect(src).toContain('NO UNRESOLVED DECISIONS');
    expectMentions(src, [['二重に数えない']], 'review report resolver');
    expect(src).toMatch(/空白を除く\s*最後の\s*行/);
    expectMentions(src, [['ステータスの欠落', '失敗します']], 'exit gate resolver');
    // The old soft wording must be gone from the gate.
    expect(src).not.toContain('absorbs CODEX / CROSS-MODEL / UNRESOLVED lines if applicable');
  });
});

// ─── {{PREAMBLE}} requires an explicit preamble-tier ────────

describe('PREAMBLE resolution requires declared preamble-tier', () => {
  test('resolving {{PREAMBLE}} without preamble-tier throws with the template path', async () => {
    const { generatePreamble } = await import('../scripts/resolvers/preamble');
    const { HOST_PATHS } = await import('../scripts/resolvers/types');
    const ctx = {
      skillName: 'tierless-skill',
      tmplPath: 'tierless-skill/SKILL.md.tmpl',
      host: 'claude' as const,
      paths: HOST_PATHS.claude,
      // preambleTier deliberately absent — the generator must refuse to default it.
    };
    expect(() => generatePreamble(ctx)).toThrow(/tierless-skill\/SKILL\.md\.tmpl/);
    expect(() => generatePreamble(ctx)).toThrow(/preamble-tier/);
  });

  test('every template that resolves {{PREAMBLE}} declares preamble-tier in frontmatter', () => {
    const entries = fs.readdirSync(ROOT, { withFileTypes: true });
    const offenders: string[] = [];
    const checkTmpl = (tmplPath: string) => {
      const tmpl = fs.readFileSync(tmplPath, 'utf-8');
      if (tmpl.includes('{{PREAMBLE}}') && !/^preamble-tier:\s*\d+$/m.test(tmpl)) {
        offenders.push(path.relative(ROOT, tmplPath));
      }
    };
    checkTmpl(path.join(ROOT, 'SKILL.md.tmpl'));
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name === 'node_modules') continue;
      const tmplPath = path.join(ROOT, e.name, 'SKILL.md.tmpl');
      if (fs.existsSync(tmplPath)) checkTmpl(tmplPath);
    }
    expect(offenders).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// #2499: gbrain MCP detection must read BOTH ~/.claude.json scopes.
// Claude Code registers MCP servers at user scope (.mcpServers) and project
// scope (.projects["/abs/path"].mcpServers — what `claude mcp add` without
// --scope user writes). The rendered brain-sync block previously read only
// user scope, so a correctly configured project-scoped brain was invisible.
// ---------------------------------------------------------------------------
describe('brain-sync block reads project-scoped MCP registrations (#2499)', () => {
  // Phase 1: the artifacts-sync bash (including the MCP-scope jq probe) moved
  // from the rendered SKILL.md into bin/gstack-skill-start. Pin the LIVE
  // script bytes — same assertions, new home. The render carries only the
  // ARTIFACTS_SYNC interpretation prose.
  const rendered = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-start'), 'utf-8');

  test('rendered _GBRAIN_MCP_ENTRY jq resolves project scope with nearest-ancestor cwd match', () => {
    const line = rendered.split('\n').find((l) => l.includes('_GBRAIN_MCP_ENTRY=$('));
    expect(line).toBeDefined();
    // Project-scope read present, driven by $PWD.
    expect(line!).toContain('--arg cwd "$PWD"');
    expect(line!).toContain('.projects');
    // User scope still resolved first.
    expect(line!).toContain('.mcpServers.gbrain');
    // The old user-scope-only filter is gone from the rendered output.
    expect(rendered).not.toContain('.mcpServers.gbrain.type // .mcpServers.gbrain.transport');
    expect(rendered).not.toContain(".mcpServers.gbrain.url // empty");
  });

  test('rendered _GBRAIN_MCP_TYPE and _GBRAIN_HOST extract from the resolved entry', () => {
    const typeLine = rendered.split('\n').find((l) => l.includes('_GBRAIN_MCP_TYPE=$('));
    const hostLine = rendered.split('\n').find((l) => l.includes('_GBRAIN_HOST=$('));
    expect(typeLine).toBeDefined();
    expect(hostLine).toBeDefined();
    expect(typeLine!).toContain('_GBRAIN_MCP_ENTRY');
    expect(hostLine!).toContain('_GBRAIN_MCP_ENTRY');
  });

  test('rendered jq lines FUNCTION: project-scoped registration resolves for a cwd inside the project', () => {
    // Execute the exact rendered bytes, not a re-derivation: extract the
    // _GBRAIN_MCP_ENTRY + _GBRAIN_MCP_TYPE lines from the generated SKILL.md
    // and run them in bash against a fixture ~/.claude.json that carries ONLY
    // a project-scoped gbrain registration.
    const lines = rendered.split('\n');
    const entryLine = lines.find((l) => l.includes('_GBRAIN_MCP_ENTRY=$('));
    const typeLine = lines.find((l) => l.includes('_GBRAIN_MCP_TYPE=$('));
    expect(entryLine).toBeDefined();
    expect(typeLine).toBeDefined();

    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-2499-home-'));
    const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-2499-proj-'));
    const nestedCwd = path.join(projectDir, 'src', 'deep');
    fs.mkdirSync(nestedCwd, { recursive: true });
    try {
      fs.writeFileSync(
        path.join(tmpHome, '.claude.json'),
        JSON.stringify({
          projects: {
            [projectDir]: {
              mcpServers: { gbrain: { type: 'http', url: 'https://brain.example.com/mcp' } },
            },
          },
        }),
      );
      const script = `cd "$1" || exit 1\n${entryLine!.trim()}\n${typeLine!.trim()}\necho "RESOLVED:$_GBRAIN_MCP_TYPE"`;
      const r = spawnSync('bash', ['-c', script, 'bash', nestedCwd], {
        encoding: 'utf-8',
        env: { ...process.env, HOME: tmpHome },
        timeout: 10_000,
      });
      expect(r.stdout).toContain('RESOLVED:http');

      // Discriminator: a cwd OUTSIDE the project must NOT resolve it.
      const outside = spawnSync('bash', ['-c', script, 'bash', os.tmpdir()], {
        encoding: 'utf-8',
        env: { ...process.env, HOME: tmpHome },
        timeout: 10_000,
      });
      expect(outside.stdout).toContain('RESOLVED:\n');
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
      fs.rmSync(projectDir, { recursive: true, force: true });
    }
  });
});

// #2896: Claude Code replaces `$<digit>` tokens in a SKILL.md body with the
// invocation's argument words before the model reads it (2.1.271+:
// /\$(\d+)(?!\w)/g), so shell/awk fields arrive rewritten yet still parse.
// Write awk fields as $(N) and shell positionals as ${N}. Section files are
// read later with Read and are not substituted.
describe('generated Claude skill bodies carry no $N token Claude Code rewrites (#2896)', () => {
  const CLAUDE_ARG_TOKEN = /\$\d+(?!\w)/g;
  test('tripwire', () => {
    const offenders: string[] = [];
    let checked = 0;
    for (const file of ['SKILL.md', ...fs.readdirSync(ROOT).map(d => path.join(d, 'SKILL.md'))]) {
      const full = path.join(ROOT, file);
      if (!fs.existsSync(full)) continue;
      const lines = fs.readFileSync(full, 'utf-8').split('\n');
      const bodyStart = lines[0] === '---' ? lines.indexOf('---', 1) + 1 : 0;
      checked++;
      lines.slice(bodyStart).forEach((line, i) => {
        for (const m of line.matchAll(CLAUDE_ARG_TOKEN)) offenders.push(`${file}:${bodyStart + i + 1}: ${m[0]} in ${line.trim().slice(0, 120)}`);
      });
    }
    expect(checked).toBeGreaterThan(40);
    expect(offenders).toEqual([]);
  });

  test('the tripwire pattern matches what Claude Code substitutes', () => {
    expect('awk \'{print $1}\' "$0" ~$0.05 $12'.match(CLAUDE_ARG_TOKEN)).toEqual(['$1', '$0', '$0', '$12']);
    expect('awk \'{print $(1)}\' "${1}" $ARGUMENTS $1a $_x'.match(CLAUDE_ARG_TOKEN)).toBeNull();
  });
});
