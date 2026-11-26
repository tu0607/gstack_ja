import { describe, test, expect, afterAll } from 'bun:test';
import { validateSkill, extractRemoteSlugPatterns, extractWeightsFromTable } from './helpers/skill-parser';
import { ALL_COMMANDS, COMMAND_DESCRIPTIONS, READ_COMMANDS, WRITE_COMMANDS, META_COMMANDS } from '../browse/src/commands';
import { SNAPSHOT_FLAGS } from '../browse/src/snapshot';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { usePrivateStateRoot } from './helpers/private-state-root';
import { expectMentions, expectTokens, compact } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');

// ─── Codex-host render isolation ─────────────────────────────
// .agents/ is gitignored and regenerated. This file used to regenerate it IN
// PLACE at three sites (a tree-mutating hazard for concurrent readers).
// Render the codex host ONCE into a module-level out-dir instead; every
// codex-artifact assertion reads from here. Out-dir renders are byte-
// identical to in-place external-host renders (pinned by
// test/gen-skill-docs-out-dir.test.ts).
const CODEX_OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-skillval-codex-'));
{
  const render = Bun.spawnSync(
    ['bun', 'run', 'scripts/gen-skill-docs.ts', '--host', 'codex', '--out-dir', CODEX_OUT],
    { cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 120_000 },
  );
  if (render.exitCode !== 0) {
    throw new Error(
      `gen-skill-docs --host codex --out-dir failed (exit ${render.exitCode}):\n${render.stderr.toString()}`,
    );
  }
}
afterAll(() => {
  fs.rmSync(CODEX_OUT, { recursive: true, force: true });
});

// Carved-skill aware (v2 plan T9 / Phase B): a carved skill is a skeleton SKILL.md
// plus sections/*.md. Read the union so validations of content that moved into a
// section still hold. For an uncarved skill (no sections dir) this is just the
// skeleton, so readSkillUnion is safe to use everywhere.
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

describe('CSO host permission boundary', () => {
  test('grants no raw source, mutation, search, question, or Agent tools', () => {
    const content = fs.readFileSync(path.join(ROOT, 'cso', 'SKILL.md'), 'utf-8');
    const fmEnd = content.indexOf('\n---', 4);
    const frontmatter = Bun.YAML.parse(content.slice(4, fmEnd)) as Record<string, unknown>;
    const allowed = frontmatter['allowed-tools'];
    expect(allowed).toEqual([
      'Bash(~/.claude/skills/gstack/bin/gstack-cso-launcher *)',
      'Bash(~/.claude/skills/gstack/bin/gstack-cso-launcher.exe *)',
    ]);
    for (const broad of ['Bash', 'Read', 'Grep', 'Glob', 'Write', 'Agent', 'WebSearch', 'AskUserQuestion']) expect(allowed).not.toContain(broad);
  });

  test('retains helper-only source access, sequential challenge, and honest host containment', () => {
    const content = readSkillUnion('cso');
    expectMentions(content, [['`Read`', '`Glob`', '`Grep`', 'ください']], 'content');
    expect(content).toContain('sequential challenge; independent agent unavailable');
    expectMentions(content, [['独立', 'レビュアー', 'ください']], 'content');
    expectMentions(content, [['隔離', 'サンドボックス', 'ありません']], 'content');
  });
});

function readCodexSkillUnion(skill: string): string {
  const dir = path.join(CODEX_OUT, '.agents', 'skills', `gstack-${skill}`);
  const sections = path.join(dir, 'sections');
  return fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf-8')
    + (fs.existsSync(sections) ? fs.readdirSync(sections).sort()
      .filter(file => file.endsWith('.md'))
      .map(file => '\n' + fs.readFileSync(path.join(sections, file), 'utf-8')).join('') : '');
}

describe('SKILL.md command validation', () => {
  // P2 (v1.2.0): the top-level gstack skill is a pure ROUTER, not the browse
  // skill. The browse body lives only in browse/SKILL.md now. This regression
  // pins the split: the router carries routing rules and zero browse commands,
  // while browse/SKILL.md still advertises the full QA surface (asserted below).
  test('top-level SKILL.md is a router with no browse body (P2)', () => {
    const md = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(md).not.toContain('gstack browse: QA Testing'); // browse body removed
    expect(md).toContain('## 最初にルーティング'); // router head present
    expect(md).toMatch(/`\/investigate` を呼び出す/); // routing rules present
    const result = validateSkill(path.join(ROOT, 'SKILL.md'));
    expect(result.invalid).toHaveLength(0); // no INVALID browse commands
    expect(result.valid.length).toBe(0); // and no browse commands at all — it routes, not browses
  });

  // Browse carve: the $B command reference renders into the on-demand section
  // browse/sections/command-list.md; the skeleton carries the Aside contract
  // (Aside is the primary browser, $B its fallback). Validate the union.
  const BROWSE_DOCS = ['browse/SKILL.md', 'browse/sections/command-list.md']
    .map((rel) => path.join(ROOT, rel)).filter((p) => fs.existsSync(p));

  test('all $B commands in browse/SKILL.md + command-list section are valid browse commands', () => {
    let validTotal = 0;
    for (const doc of BROWSE_DOCS) {
      const result = validateSkill(doc);
      expect({ doc, invalid: result.invalid }).toEqual({ doc, invalid: [] });
      validTotal += result.valid.length;
    }
    expect(validTotal).toBeGreaterThan(0);
  });

  test('all snapshot flags in browse/SKILL.md + command-list section are valid', () => {
    for (const doc of BROWSE_DOCS) {
      const result = validateSkill(doc);
      expect({ doc, snapshotFlagErrors: result.snapshotFlagErrors }).toEqual({ doc, snapshotFlagErrors: [] });
    }
  });

  test('all $B commands in qa/SKILL.md are valid browse commands', () => {
    const qaSkill = path.join(ROOT, 'qa', 'SKILL.md');
    if (!fs.existsSync(qaSkill)) return; // skip if missing
    const result = validateSkill(qaSkill);
    expect(result.invalid).toHaveLength(0);
  });

  test('all snapshot flags in qa/SKILL.md are valid', () => {
    const qaSkill = path.join(ROOT, 'qa', 'SKILL.md');
    if (!fs.existsSync(qaSkill)) return;
    const result = validateSkill(qaSkill);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });

  // qa carve: the Phases 1-6 methodology (with its $B command examples) moved
  // into qa/sections/*.md — validate the section files too so browse-command
  // coverage doesn't silently shrink with the carve.
  test('all $B commands and snapshot flags in qa/sections/*.md are valid', () => {
    const secDir = path.join(ROOT, 'qa', 'sections');
    if (!fs.existsSync(secDir)) return; // pre-carve checkout
    const sectionMds = fs.readdirSync(secDir).filter(f => f.endsWith('.md') && !f.endsWith('.md.tmpl'));
    expect(sectionMds.length).toBeGreaterThan(0);
    for (const f of sectionMds) {
      const result = validateSkill(path.join(secDir, f));
      expect({ file: f, invalid: result.invalid }).toEqual({ file: f, invalid: [] });
      expect({ file: f, snapshotFlagErrors: result.snapshotFlagErrors }).toEqual({ file: f, snapshotFlagErrors: [] });
    }
  });

  test('all $B commands in qa-only/SKILL.md are valid browse commands', () => {
    const qaOnlySkill = path.join(ROOT, 'qa-only', 'SKILL.md');
    if (!fs.existsSync(qaOnlySkill)) return;
    const result = validateSkill(qaOnlySkill);
    expect(result.invalid).toHaveLength(0);
  });

  test('all snapshot flags in qa-only/SKILL.md are valid', () => {
    const qaOnlySkill = path.join(ROOT, 'qa-only', 'SKILL.md');
    if (!fs.existsSync(qaOnlySkill)) return;
    const result = validateSkill(qaOnlySkill);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });

  test('all $B commands in plan-design-review/SKILL.md are valid browse commands', () => {
    const skill = path.join(ROOT, 'plan-design-review', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.invalid).toHaveLength(0);
  });

  test('all snapshot flags in plan-design-review/SKILL.md are valid', () => {
    const skill = path.join(ROOT, 'plan-design-review', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });

  test('all $B commands in design-review/SKILL.md are valid browse commands', () => {
    const skill = path.join(ROOT, 'design-review', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.invalid).toHaveLength(0);
  });

  test('all snapshot flags in design-review/SKILL.md are valid', () => {
    const skill = path.join(ROOT, 'design-review', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });

  test('all $B commands in design-consultation/SKILL.md are valid browse commands', () => {
    const skill = path.join(ROOT, 'design-consultation', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.invalid).toHaveLength(0);
  });

  test('all snapshot flags in design-consultation/SKILL.md are valid', () => {
    const skill = path.join(ROOT, 'design-consultation', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });

  test('all $B commands in autoplan/SKILL.md are valid browse commands', () => {
    const skill = path.join(ROOT, 'autoplan', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.invalid).toHaveLength(0);
  });

  test('all snapshot flags in autoplan/SKILL.md are valid', () => {
    const skill = path.join(ROOT, 'autoplan', 'SKILL.md');
    if (!fs.existsSync(skill)) return;
    const result = validateSkill(skill);
    expect(result.snapshotFlagErrors).toHaveLength(0);
  });

  test('autoplan section skip list includes the scope gate', () => {
    // autoplan Step 3 reads plan-eng-review / plan-design-review SKILL.md
    // verbatim; without this skip-list entry it ingests their scope gate — a
    // hard-STOP AskUserQuestion that contradicts autoplan's auto-decide
    // contract. Nothing else pins the skip-list contents.
    const md = fs.readFileSync(path.join(ROOT, 'autoplan', 'SKILL.md'), 'utf-8');
    expect(md).toMatch(/^- スコープゲート/m);
  });
});

describe('Command registry consistency', () => {
  test('COMMAND_DESCRIPTIONS covers all commands in sets', () => {
    const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    const descKeys = new Set(Object.keys(COMMAND_DESCRIPTIONS));
    for (const cmd of allCmds) {
      expect(descKeys.has(cmd)).toBe(true);
    }
  });

  test('COMMAND_DESCRIPTIONS has no extra commands not in sets', () => {
    const allCmds = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    for (const key of Object.keys(COMMAND_DESCRIPTIONS)) {
      expect(allCmds.has(key)).toBe(true);
    }
  });

  test('ALL_COMMANDS matches union of all sets', () => {
    const union = new Set([...READ_COMMANDS, ...WRITE_COMMANDS, ...META_COMMANDS]);
    expect(ALL_COMMANDS.size).toBe(union.size);
    for (const cmd of union) {
      expect(ALL_COMMANDS.has(cmd)).toBe(true);
    }
  });

  test('SNAPSHOT_FLAGS option keys are valid SnapshotOptions fields', () => {
    const validKeys = new Set([
      'interactive', 'compact', 'depth', 'selector',
      'diff', 'annotate', 'outputPath', 'cursorInteractive',
      'heatmap',
    ]);
    for (const flag of SNAPSHOT_FLAGS) {
      expect(validKeys.has(flag.optionKey)).toBe(true);
    }
  });
});

describe('Usage string consistency', () => {
  // Normalize a usage string to its structural skeleton for comparison.
  // Replaces <param-names> with <>, [optional] with [], strips parenthetical hints.
  // This catches format mismatches (e.g., <name>:<value> vs <name> <value>)
  // without tripping on abbreviation differences (e.g., <sel> vs <selector>).
  function skeleton(usage: string): string {
    return usage
      .replace(/\(.*?\)/g, '')        // strip parenthetical hints like (e.g., Enter, Tab)
      .replace(/<[^>]*>/g, '<>')      // normalize <param-name> → <>
      .replace(/\[[^\]]*\]/g, '[]')   // normalize [optional] → []
      .replace(/\s+/g, ' ')           // collapse whitespace
      .trim();
  }

  // Cross-check Usage: patterns in implementation against COMMAND_DESCRIPTIONS
  test('implementation Usage: structural format matches COMMAND_DESCRIPTIONS', () => {
    const implFiles = [
      path.join(ROOT, 'browse', 'src', 'write-commands.ts'),
      path.join(ROOT, 'browse', 'src', 'read-commands.ts'),
      path.join(ROOT, 'browse', 'src', 'meta-commands.ts'),
    ];

    // Extract "Usage: browse <pattern>" from throw new Error(...) calls
    const usagePattern = /throw new Error\(['"`]Usage:\s*browse\s+(.+?)['"`]\)/g;
    const implUsages = new Map<string, string>();

    for (const file of implFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      let match;
      while ((match = usagePattern.exec(content)) !== null) {
        const usage = match[1].split('\\n')[0].trim();
        const cmd = usage.split(/\s/)[0];
        implUsages.set(cmd, usage);
      }
    }

    // Compare structural skeletons
    const mismatches: string[] = [];
    for (const [cmd, implUsage] of implUsages) {
      const desc = COMMAND_DESCRIPTIONS[cmd];
      if (!desc) continue;
      if (!desc.usage) continue;
      const descSkel = skeleton(desc.usage);
      const implSkel = skeleton(implUsage);
      if (descSkel !== implSkel) {
        mismatches.push(`${cmd}: docs "${desc.usage}" (${descSkel}) vs impl "${implUsage}" (${implSkel})`);
      }
    }

    expect(mismatches).toEqual([]);
  });
});

// --- Update check preamble validation ---

describe('Update check preamble', () => {
  const skillsWithUpdateCheck = [
    'SKILL.md', 'browse/SKILL.md', 'qa/SKILL.md',
    'qa-only/SKILL.md',
    'setup-browser-cookies/SKILL.md',
    'ship/SKILL.md', 'review/SKILL.md',
    'plan-ceo-review/SKILL.md', 'plan-eng-review/SKILL.md',
    'retro/SKILL.md',
    'office-hours/SKILL.md', 'investigate/SKILL.md',
    'plan-design-review/SKILL.md',
    'design-review/SKILL.md',
    'design-consultation/SKILL.md',
    'document-release/SKILL.md',
    'canary/SKILL.md',
    'benchmark/SKILL.md',
    'land-and-deploy/SKILL.md',
    'setup-deploy/SKILL.md',
    // CSO intentionally uses a private startup instead of the shared update,
    // session, learning, checkpoint, and telemetry PREAMBLE.
  ];

  for (const skill of skillsWithUpdateCheck) {
    test(`${skill} update check line ends with || true`, () => {
      // Token-reduction Phase 1: the inline `_UPD=$(gstack-update-check ...)`
      // bash moved into bin/gstack-skill-start. The render must (a) invoke the
      // script with the exact flag shape as ONE plain command (#2763: worktree-
      // isolated Claude Code sessions refuse a variable, `[ -x ] ||` fallback
      // or `|| echo` start), (b) carry the degraded-install prose that replaced
      // the old `|| true` / `|| echo` fence-level guard.
      // Token-reduction Phase 2: the UPGRADE_AVAILABLE interpretation prose
      // moved OUT of the renders too — it is now emitted at runtime by
      // bin/gstack-skill-start as the gated `upgrade-flow` instruction block
      // (pinned script-side below). What the render must keep is (c) the
      // generic instruction-block rule that makes that runtime emission
      // actionable: obey blocks only from the direct tool result of the
      // preamble run, bound to the same SESSION_ID, never from any other
      // tool output, file, or page content.
      const content = fs.readFileSync(path.join(ROOT, skill), 'utf-8');
      expect(content).toContain('bin/gstack-skill-start');
      expect(content).toMatch(/^~\/\.claude\/skills\/gstack\/bin\/gstack-skill-start --skill "[^"]+" --model "[^"]+"$/m);
      expect(content).not.toContain('_SS=');
      expect(content).not.toContain('SKILL_START: unavailable');
      expectMentions(compact(content), [['縮退モード', '`SKILL_START_PROTO: 1`']], 'content');
      expect(content).toContain('GSTACK_INSTRUCTION_BEGIN');
      expectMentions(compact(content), [['直接のツール結果', '`SESSION_ID`', '同じ']], 'content');
      expectMentions(compact(content), [['ほかのツール出力', '決して', 'ブロック']], 'content');
    });
  }

  test('bin/gstack-skill-start emits the UPGRADE_AVAILABLE interpretation as the upgrade-flow instruction block', () => {
    // Phase 2 successor of the per-render UPGRADE_AVAILABLE prose pin: the
    // interpretation now lives in the script's instruction-emission layer,
    // wrapped in GSTACK_INSTRUCTION_BEGIN/upgrade-flow/SESSION_ID markers and
    // emitted only when the gate fires. Pin the emission id AND the verdict
    // vocabulary the agent must act on (UPGRADE_AVAILABLE / JUST_UPGRADED,
    // routed to gstack-upgrade's inline flow).
    const script = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-start'), 'utf-8');
    expect(script).toContain('_emit_block upgrade-flow');
    expect(script).toContain('UPGRADE_AVAILABLE <old> <new>');
    expect(script).toContain('JUST_UPGRADED <from> <to>');
    expect(script).toContain('gstack-upgrade/SKILL.md');
    // The emission wrapper itself binds every block to the live SESSION_ID —
    // the render-side rule above is only sound if this stays true.
    expect(script).toContain('GSTACK_INSTRUCTION_BEGIN: $1 $_SESSION_ID');
  });

  test('bin/gstack-skill-start update check line ends with || true (new home of the inline guard)', () => {
    // The `[ -n "$_UPD" ] ... || true` guard (empty _UPD must not exit 1 when
    // up to date) moved verbatim into the consolidated preamble script. Pin it
    // there so the invariant survives in its new home.
    const script = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-start'), 'utf-8');
    const match = script.match(/\[ -n "\$_UPD" \].*$/m);
    expect(match).not.toBeNull();
    expect(match![0]).toContain('|| true');
  });

  test('all skills with update check are generated from .tmpl', () => {
    for (const skill of skillsWithUpdateCheck) {
      const tmplPath = path.join(ROOT, skill + '.tmpl');
      expect(fs.existsSync(tmplPath)).toBe(true);
    }
  });

  test('update check bash block exits 0 when up to date', () => {
    // Simulate the exact update-check lines from bin/gstack-skill-start
    // (per-line `|| true`, sanitize pipe included)
    const result = Bun.spawnSync(['bash', '-c',
      '_sanitize() { sed "s/GSTACK_INSTRUCTION/GSTACK-INSTRUCTION-(stripped)/g"; }; ' +
      '_UPD=$(echo "" || true); [ -n "$_UPD" ] && printf "%s\\n" "$_UPD" | _sanitize || true'
    ], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    expect(result.exitCode).toBe(0);
  });

  test('update check bash block exits 0 when upgrade available', () => {
    const result = Bun.spawnSync(['bash', '-c',
      '_sanitize() { sed "s/GSTACK_INSTRUCTION/GSTACK-INSTRUCTION-(stripped)/g"; }; ' +
      '_UPD=$(echo "UPGRADE_AVAILABLE 0.3.3 0.4.0" || true); [ -n "$_UPD" ] && printf "%s\\n" "$_UPD" | _sanitize || true'
    ], { stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString().trim()).toBe('UPGRADE_AVAILABLE 0.3.3 0.4.0');
  });
});

// --- Part 7: Cross-skill path consistency (A1) ---

describe('Cross-skill path consistency', () => {
  test('REMOTE_SLUG derivation pattern is identical across files that use it', () => {
    const patterns = extractRemoteSlugPatterns(ROOT, ['qa', 'review']);
    const allPatterns: string[] = [];

    for (const [, filePatterns] of patterns) {
      allPatterns.push(...filePatterns);
    }

    // Should find at least 2 occurrences (qa/SKILL.md + review/greptile-triage.md)
    expect(allPatterns.length).toBeGreaterThanOrEqual(2);

    // All occurrences must be character-for-character identical
    const unique = new Set(allPatterns);
    if (unique.size > 1) {
      const variants = Array.from(unique);
      throw new Error(
        `REMOTE_SLUG pattern differs across files:\n` +
        variants.map((v, i) => `  ${i + 1}: ${v}`).join('\n')
      );
    }
  });

  test('all greptile-history write references specify both per-project and global paths', () => {
    const filesToCheck = [
      'review/SKILL.md',
      'ship/SKILL.md',
      'review/greptile-triage.md',
    ];

    for (const file of filesToCheck) {
      const filePath = path.join(ROOT, file);
      if (!fs.existsSync(filePath)) continue;
      // ship's greptile handling moved into sections/greptile.md (T9 carve).
      const content = file === 'ship/SKILL.md' ? readShipUnion() : fs.readFileSync(filePath, 'utf-8');

      const hasBoth = (content.includes('プロジェクト単位') && (content.includes('グローバル') || content.includes('全体'))) ||
        (content.includes('$REMOTE_SLUG/greptile-history') && content.includes('~/.gstack/greptile-history'));

      expect(hasBoth).toBe(true);
    }
  });

  test('greptile-triage.md contains both project and global history paths', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'greptile-triage.md'), 'utf-8');
    expect(content).toContain('$REMOTE_SLUG/greptile-history.md');
    expect(content).toContain('~/.gstack/greptile-history.md');
  });

  test('retro/SKILL.md reads global greptile-history (not per-project)', () => {
    const content = fs.readFileSync(path.join(ROOT, 'retro', 'SKILL.md'), 'utf-8');
    expectMentions(compact(content), [['`GREPTILE_HISTORY`', 'パス']], 'content');
    expect(fs.readFileSync(path.join(ROOT, 'bin', 'gstack-retro-metrics'), 'utf-8')).toContain('$_GH/greptile-history.md');
    // Should NOT reference per-project path for reads
    expect(content).not.toContain('$REMOTE_SLUG/greptile-history.md');
  });
});

// --- Part 7: QA skill structure validation (A2) ---

describe('QA skill structure validation', () => {
  // qa carve: modes, Phases 1-6, and the health rubric moved into
  // qa/sections/qa-patterns.md — validate the skeleton+sections union.
  const qaContent = readSkillUnion('qa');

  test('qa/SKILL.md has all 11 phases', () => {
    // Headings carry the English `Phase N:` marker; titles are localized.
    for (let n = 1; n <= 11; n++) {
      expect(qaContent).toMatch(new RegExp(`^#{2,3} Phase ${n}: `, 'm'));
    }
    expect(qaContent).toContain('TODOS.md');
  });

  test('has all four QA modes defined', () => {
    const modes = [
      'Diff-aware',
      'Full',
      'Quick',
      'Regression',
    ];
    for (const mode of modes) {
      expect(qaContent).toContain(mode);
    }

    // Mode triggers/flags
    expect(qaContent).toContain('--quick');
    expect(qaContent).toContain('--regression');
  });

  test('has all three tiers defined', () => {
    const tiers = ['Quick', 'Standard', 'Exhaustive'];
    for (const tier of tiers) {
      expect(qaContent).toContain(tier);
    }
  });

  test('health score weights sum to 100%', () => {
    const weights = extractWeightsFromTable(qaContent);
    expect(weights.size).toBeGreaterThan(0);

    let sum = 0;
    for (const pct of weights.values()) {
      sum += pct;
    }
    expect(sum).toBe(100);
  });

  test('health score has all 8 categories', () => {
    const weights = extractWeightsFromTable(qaContent);
    const expectedCategories = [
      'Console', 'Links', 'Visual', 'Functional',
      'UX', 'Performance', 'Content', 'Accessibility',
    ];
    for (const cat of expectedCategories) {
      expect(weights.has(cat)).toBe(true);
    }
    expect(weights.size).toBe(8);
  });

  test('has four mode definitions (Diff-aware/Full/Quick/Regression)', () => {
    expect(qaContent).toContain('### Diff-aware');
    expect(qaContent).toContain('### Full');
    expect(qaContent).toContain('### Quick');
    expect(qaContent).toContain('### Regression');
  });

  test('output structure references report directory layout', () => {
    expect(qaContent).toContain('qa-report-');
    expect(qaContent).toContain('baseline.json');
    expect(qaContent).toContain('screenshots/');
    expect(qaContent).toContain('.gstack/qa-reports/');
  });
});

// --- Part 7: Greptile history format consistency (A3) ---

describe('Greptile history format consistency', () => {
  test('greptile-triage.md defines the canonical history format', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'greptile-triage.md'), 'utf-8');
    expect(content).toContain('<YYYY-MM-DD>');
    expect(content).toContain('<owner/repo>');
    expect(content).toContain('<type');
    expect(content).toContain('<file-pattern>');
    expect(content).toContain('<category>');
  });

  test('review/SKILL.md and ship/SKILL.md both reference greptile-triage.md for write details', () => {
    const reviewContent = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    const shipContent = readShipUnion();

    expect(reviewContent.toLowerCase()).toContain('greptile-triage.md');
    expect(shipContent.toLowerCase()).toContain('greptile-triage.md');
  });

  test('greptile-triage.md defines all 9 valid categories', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'greptile-triage.md'), 'utf-8');
    const categories = [
      'race-condition', 'null-check', 'error-handling', 'style',
      'type-safety', 'security', 'performance', 'correctness', 'other',
    ];
    for (const cat of categories) {
      expect(content).toContain(cat);
    }
  });
});

// --- Hardcoded branch name detection in templates ---

describe('No hardcoded branch names in SKILL templates', () => {
  const tmplFiles = [
    'ship/SKILL.md.tmpl',
    'review/SKILL.md.tmpl',
    'qa/SKILL.md.tmpl',
    'plan-ceo-review/SKILL.md.tmpl',
    'retro/SKILL.md.tmpl',
    'document-release/SKILL.md.tmpl',
    'plan-eng-review/SKILL.md.tmpl',
    'plan-design-review/SKILL.md.tmpl',
    'codex/SKILL.md.tmpl',
  ];

  // Patterns that indicate hardcoded 'main' in git commands
  const gitMainPatterns = [
    /\bgit\s+diff\s+(?:origin\/)?main\b/,
    /\bgit\s+log\s+(?:origin\/)?main\b/,
    /\bgit\s+fetch\s+origin\s+main\b/,
    /\bgit\s+merge\s+origin\/main\b/,
    /\borigin\/main\b/,
  ];

  // Lines that are allowed to mention 'main' (fallback logic, prose)
  const allowlist = [
    /fall\s*back\s+to\s+`main`/i,
    /fall\s*back\s+to\s+`?main`?/i,
    /typically\s+`?main`?/i,
    /If\s+on\s+`main`/i,  // old pattern — should not exist
  ];

  for (const tmplFile of tmplFiles) {
    test(`${tmplFile} has no hardcoded 'main' in git commands`, () => {
      const filePath = path.join(ROOT, tmplFile);
      if (!fs.existsSync(filePath)) return;
      const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
      const violations: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isAllowlisted = allowlist.some(p => p.test(line));
        if (isAllowlisted) continue;

        for (const pattern of gitMainPatterns) {
          if (pattern.test(line)) {
            violations.push(`Line ${i + 1}: ${line.trim()}`);
            break;
          }
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `${tmplFile} has hardcoded 'main' in git commands:\n` +
          violations.map(v => `  ${v}`).join('\n')
        );
      }
    });
  }
});

// --- Part 7b: TODOS-format.md reference consistency ---

describe('TODOS-format.md reference consistency', () => {
  test('review/TODOS-format.md exists and defines canonical format', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'TODOS-format.md'), 'utf-8');
    expect(content).toContain('**What:**');
    expect(content).toContain('**Why:**');
    expect(content).toContain('**Priority:**');
    expect(content).toContain('**Effort:**');
    expect(content).toContain('## Completed');
  });

  test('skills that write TODOs reference TODOS-format.md', () => {
    const shipContent = readShipUnion();
    const ceoPlanContent = readSkillUnion('plan-ceo-review'); // carved: TODOS-format ref moved to section
    const engPlanContent = readSkillUnion('plan-eng-review');

    expect(shipContent).toContain('TODOS-format.md');
    expect(ceoPlanContent).toContain('TODOS-format.md');
    expect(engPlanContent).toContain('TODOS-format.md');
  });
});

// --- v0.4.1 feature coverage: RECOMMENDATION format, session awareness, enum completeness ---

describe('v0.4.1 preamble features', () => {
  // Tier 1 skills have core preamble only (no AskUserQuestion format)
  const tier1Skills = ['SKILL.md', 'browse/SKILL.md', 'setup-browser-cookies/SKILL.md', 'benchmark/SKILL.md'];

  // Tier 2+ skills have AskUserQuestion format with RECOMMENDATION
  const tier2PlusSkills = [
    'qa/SKILL.md', 'qa-only/SKILL.md',
    'ship/SKILL.md', 'review/SKILL.md',
    'plan-ceo-review/SKILL.md', 'plan-eng-review/SKILL.md',
    'retro/SKILL.md',
    'office-hours/SKILL.md', 'investigate/SKILL.md',
    'plan-design-review/SKILL.md',
    'design-review/SKILL.md',
    'design-consultation/SKILL.md',
    'document-release/SKILL.md',
    'canary/SKILL.md',
    'land-and-deploy/SKILL.md',
    'setup-deploy/SKILL.md',
    // CSO's private startup intentionally omits the generic AUQ/session/
    // escalation PREAMBLE; its helper owns readiness and terminal state.
  ];

  const skillsWithPreamble = [...tier1Skills, ...tier2PlusSkills];

  for (const skill of tier2PlusSkills) {
    test(`${skill} contains AskUserQuestion Pros/Cons format`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill), 'utf-8');
      // v1.7.0.0 Pros/Cons format tokens. The preamble resolver
      // (generate-ask-user-format.ts) injects all of these into every
      // tier-2+ skill. Drop any of them and the test catches it on the
      // next `bun test` run.
      expect(content).toContain('AskUserQuestion');
      expect(content).toContain('Pros / cons:');
      expect(content).toContain('Recommendation: <choice>');
      expect(content).toContain('Net:');
      expect(content).toContain('ELI10');
      expect(content).toContain('Stakes if we pick wrong:');
      // Concrete format markers must be documented in the resolver text
      expect(content).toMatch(/✅/);
      expect(content).toMatch(/❌/);
    });
  }

  for (const skill of skillsWithPreamble) {
    test(`${skill} contains session awareness`, () => {
      // Token-reduction Phase 1: the inline `_SESSIONS=$(find ~/.gstack/sessions ...)`
      // bash moved into bin/gstack-skill-start. Session identity (the harness
      // pid that names the sessions-dir entry) is derived by the script itself,
      // so the render passes no "$PPID" (#2763); it still carries the
      // SESSION_KIND STATUS-line interpretation prose.
      const content = fs.readFileSync(path.join(ROOT, skill), 'utf-8');
      expect(content).not.toContain('$PPID');
      expect(content).toContain('SESSION_KIND');
    });
  }

  test('bin/gstack-skill-start owns the session-tracking machinery (new home of _SESSIONS)', () => {
    // The sessions-dir touch + stale-session cleanup that every preamble used
    // to inline now lives in the consolidated script — pin it there.
    const script = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-start'), 'utf-8');
    expect(script).toContain('mkdir -p "$_GH/sessions"');
    expect(script).toContain('touch "$_GH/sessions/$PARENT_PID"');
    expect(script).toContain('-mmin +120'); // 120-min freshness window survives the move
  });

  for (const skill of skillsWithPreamble) {
    test(`${skill} contains escalation protocol`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill), 'utf-8');
      expect(content).toContain('DONE_WITH_CONCERNS');
      expect(content).toContain('BLOCKED');
      expect(content).toContain('NEEDS_CONTEXT');
    });
  }
});

// --- Structural tests for new skills ---

describe('office-hours skill structure', () => {
  // Carved (v2 plan T9): Phase 5 (Design Doc) + Phase 6 (handoff) moved into
  // sections/design-and-handoff.md, so structural phrases now live there — read
  // the skeleton+sections union.
  const content = readSkillUnion('office-hours');

  // Original structural assertions
  // Phase headings are localized (`フェーズ N`); machine-read tokens stay English.
  for (const [section, marker] of [
    ['Phase 1', 'フェーズ 1:'], ['Phase 2', 'フェーズ 2A:'], ['Phase 3', 'フェーズ 3:'],
    ['Phase 4', 'フェーズ 4:'], ['Phase 5', 'フェーズ 5:'], ['Phase 6', 'フェーズ 6:'],
    ['Design Doc', '# Design: {title}'], ['Supersedes', 'Supersedes:'], ['APPROVED', 'APPROVED'],
    ['Premise Challenge', '前提への異議'], ['Alternatives', '代替案'], ['Smart-skip', 'スマートスキップ'],
  ] as const) {
    test(`contains ${section}`, () => expect(content).toContain(marker));
  }

  // Dual-mode structure
  for (const [section, marker] of [['Startup mode', 'スタートアップモード'], ['Builder mode', 'ビルダーモード']] as const) {
    test(`contains ${section}`, () => expect(content).toContain(marker));
  }

  // Mode detection question
  test('contains explicit mode detection question', () => {
    expectMentions(compact(content), [['質問', '今回の目的は何ですか', '本物']], 'content');
    expect(content).toContain('**スタートアップを立ち上げる**');
  });

  // Six forcing questions (startup mode)
  for (const [question, heading] of [
    ['Demand Reality', '#### Q1: 需要の現実'], ['Status Quo', '#### Q2: 現状'],
    ['Desperate Specificity', '#### Q3: 切実な具体性'], ['Narrowest Wedge', '#### Q4: 最も狭い楔'],
    ['Observation & Surprise', '#### Q5: 観察と驚き'], ['Future-Fit', '#### Q6: 未来への適合'],
  ] as const) {
    test(`contains forcing question: ${question}`, () => expect(content).toContain(heading));
  }

  // Builder mode questions
  test('contains builder brainstorming questions', () => {
    expectTokens(content, ['これの最もクールな版は何ですか', '何があれば、本当に楽しいものになりますか']);
  });

  // Intrapreneurship adaptation
  test('contains intrapreneurship adaptation', () => {
    expectMentions(compact(content), [['社内起業', 'Q4', 'Q6']], 'content');
  });

  // YC founder discovery engine
  test('contains YC apply CTA with ref tracking', () => {
    expect(content).toContain('ycombinator.com/apply?ref=gstack');
  });

  test('contains "What I noticed" design doc section', () => {
    expect(content).toContain('What I noticed about how you think');
  });

  test('contains golden age framing', () => {
    expect(content).toContain('黄金時代');
  });

  test('contains Garry Tan personal plea', () => {
    expect(content).toMatch(/> Garry Tan より、GStack の作者として一言/);
  });

  test('contains founder signal synthesis phase', () => {
    expect(content).toMatch(/^## フェーズ 4\.5: 創業者シグナルの統合/m);
  });

  test('contains three-tier decision rubric', () => {
    expectTokens(content, ['**トップティア**', '**ミドルティア**', '**ベーシックティア**']);
  });

  test('contains anti-slop examples', () => {
    expectMentions(content, [['アンチスロップ', '言うのではなく見せる']], 'content');
    expectTokens(content, ['- 良い例:', '- 悪い例:']);
  });

  test('contains "One more thing" transition beat', () => {
    expect(content).toContain('**ビート 2: 「もう一つ。」**');
  });

  // Operating principles per mode
  test('contains startup operating principles', () => {
    expect(content).toContain('**具体性だけが通貨です。**');
  });

  test('contains builder operating principles', () => {
    expect(content).toContain('**面白さが通貨です**');
  });

  // Spec Review Loop (Phase 5.5)
  test('contains spec review loop', () => {
    expect(content).toContain('Spec Review Loop');
  });

  test('contains adversarial review dimensions', () => {
    for (const dim of ['Completeness', 'Consistency', 'Clarity', 'Scope', 'Feasibility']) {
      expect(content).toContain(dim);
    }
  });

  test('contains subagent dispatch instruction', () => {
    expect(content).toMatch(/Agent.*tool|subagent/i);
  });

  test('contains max 3 iterations', () => {
    expectMentions(compact(content), [['反復', '最大 3 回']], 'content');
  });

  test('contains quality score', () => {
    expectMentions(compact(content), [['品質スコア', 'メトリクス']], 'content');
  });

  test('contains spec review metrics path', () => {
    expect(content).toContain('spec-review.jsonl');
  });

  test('contains convergence guard', () => {
    expect(content).toMatch(/convergence/i);
  });

  // Visual Sketch (Phase 4.5)
  test('contains visual sketch section', () => {
    expect(content).toContain('Visual Sketch');
  });

  test('contains wireframe generation', () => {
    expect(content).toMatch(/wireframe|sketch/i);
  });

  test('contains DESIGN.md awareness', () => {
    expect(content).toContain('DESIGN.md');
  });

  test('wireframes render through gstack-render (Aside first)', () => {
    expect(content).toContain('gstack-render.ts');
    expect(content).toContain('--screenshot');
  });

  test('contains rough aesthetic instruction', () => {
    expect(content).toMatch(/rough|hand-drawn/i);
  });
});

describe('investigate skill structure', () => {
  const content = fs.readFileSync(path.join(ROOT, 'investigate', 'SKILL.md'), 'utf-8');
  for (const [section, marker] of [
    ['Iron Law', '## 鉄則'], ['Root Cause', '## フェーズ 1: 根本原因の調査'],
    ['Pattern Analysis', '## フェーズ 2: パターン分析'], ['Hypothesis', '## フェーズ 3: 仮説の検証'],
    ['DEBUG REPORT', 'DEBUG REPORT'], ['3-strike', '**3 回失敗のルール:**'], ['BLOCKED', 'BLOCKED'],
  ] as const) {
    test(`contains ${section}`, () => expect(content).toContain(marker));
  }
});

// Contributor mode was removed in v0.13.10.0 — replaced by operational self-improvement.
// Tests for contributor mode preamble structure are no longer applicable.

describe('Enum & Value Completeness in review checklist', () => {
  const checklist = fs.readFileSync(path.join(ROOT, 'review', 'checklist.md'), 'utf-8');

  test('checklist has Enum & Value Completeness section', () => {
    expect(checklist).toContain('Enum & Value Completeness');
  });

  test('Enum & Value Completeness is classified as CRITICAL', () => {
    // It should appear under Pass 1 — CRITICAL, not Pass 2
    const pass1Start = checklist.indexOf('### パス 1');
    const pass2Start = checklist.indexOf('### パス 2');
    const enumStart = checklist.indexOf('#### Enum と値の網羅性');
    expect(pass1Start).toBeGreaterThan(-1);
    expect(enumStart).toBeGreaterThan(pass1Start);
    expect(enumStart).toBeLessThan(pass2Start);
  });

  test('Enum & Value Completeness mentions tracing through consumers', () => {
    expectMentions(compact(checklist), [['すべての利用箇所', 'たどる'], ['許可リスト'], ['`case`/`if-elsif`']], 'checklist');
  });

  test('Enum & Value Completeness covers loosened input acceptance and stale user-facing strings', () => {
    const start = checklist.indexOf('#### Enum と値の網羅性');
    const section = checklist.slice(start, checklist.indexOf('### パス 2', start));
    expectMentions(compact(section), [['受け入れる入力を緩める'], ['緩められた受け入れ', '利用箇所', '壊す']], 'section');
    const maintainability = fs.readFileSync(path.join(ROOT, 'review', 'specialists', 'maintainability.md'), 'utf-8');
    const stale = maintainability.slice(maintainability.indexOf('### 古くなったコメントとドキュメント文字列'));
    expectMentions(compact(stale.slice(0, stale.indexOf('\n### ', 5))), [['ユーザー向けの文字列', 'エラー', 'トースト', 'ラベル']], 'stale section');
  });

  test('Enum & Value Completeness is in the severity classification as CRITICAL', () => {
    const gateSection = checklist.slice(checklist.indexOf('## 重大度の分類'));
    // The ASCII art has CRITICAL on the left and INFORMATIONAL on the right
    // Enum & Value Completeness should appear on a line with the CRITICAL tree (├─ or └─)
    const enumLine = gateSection.split('\n').find(l => l.includes('Enum & Value Completeness'));
    expect(enumLine).toBeDefined();
    // It's on the left (CRITICAL) side — starts with ├─ or └─
    expect(enumLine!.trimStart().startsWith('├─') || enumLine!.trimStart().startsWith('└─')).toBe(true);
  });

  test('Fix-First Heuristic exists in checklist and is referenced by review + ship', () => {
    expect(checklist).toContain('## Fix-First のヒューリスティック');
    expect(checklist).toContain('AUTO-FIX');
    expect(checklist).toContain('ASK');

    const reviewSkill = fs.readFileSync(path.join(ROOT, 'review/SKILL.md'), 'utf-8');
    const shipSkill = readShipUnion();
    expect(reviewSkill).toContain('AUTO-FIX');
    expect(reviewSkill).toContain('[AUTO-FIXED]');
    expect(shipSkill).toContain('AUTO-FIX');
    expect(shipSkill).toContain('[AUTO-FIXED]');
  });
});

// --- Completeness Principle spot-check ---

describe('Completeness Principle in generated SKILL.md files', () => {
  const skillsWithPreamble = [
    'qa/SKILL.md',
    'qa-only/SKILL.md',
    'ship/SKILL.md', 'review/SKILL.md',
    'plan-ceo-review/SKILL.md', 'plan-eng-review/SKILL.md',
    'retro/SKILL.md',
    'plan-design-review/SKILL.md',
    'design-review/SKILL.md',
    'design-consultation/SKILL.md',
    'document-release/SKILL.md',
    // CSO reports complete/partial/not-assessed from its own evidence contract
    // and must not inherit the shared numerical completeness rubric.
  ];

  for (const skill of skillsWithPreamble) {
    test(`${skill} contains Completeness Principle section`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill), 'utf-8');
      expect(content).toContain('Completeness Principle');
      expect(content).toContain('Boil the Ocean');
    });
  }

  test('Completeness Principle keeps compact scoring guidance in tier 2+ skills', () => {
    // CSO is intentionally exempt; use a regular tier 2+ PREAMBLE consumer.
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Completeness: X/10');
    expect(content).toContain('10 = すべてのエッジケース');
    expect(content).toContain('Note: options differ in kind, not coverage');
    expectMentions(compact(content), [['スコア', '捏造']], 'content');
  });
});

// --- Part 7: Planted-bug fixture validation (A4) ---

describe('Planted-bug fixture validation', () => {
  test('qa-eval ground truth has exactly 5 planted bugs', () => {
    const groundTruth = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'qa-eval-ground-truth.json'), 'utf-8')
    );
    expect(groundTruth.bugs).toHaveLength(5);
    expect(groundTruth.total_bugs).toBe(5);
  });

  test('qa-eval-spa ground truth has exactly 5 planted bugs', () => {
    const groundTruth = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'qa-eval-spa-ground-truth.json'), 'utf-8')
    );
    expect(groundTruth.bugs).toHaveLength(5);
    expect(groundTruth.total_bugs).toBe(5);
  });

  test('qa-eval-checkout ground truth has exactly 5 planted bugs', () => {
    const groundTruth = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'qa-eval-checkout-ground-truth.json'), 'utf-8')
    );
    expect(groundTruth.bugs).toHaveLength(5);
    expect(groundTruth.total_bugs).toBe(5);
  });

  test('qa-eval.html contains the planted bugs', () => {
    const html = fs.readFileSync(path.join(ROOT, 'browse', 'test', 'fixtures', 'qa-eval.html'), 'utf-8');
    // BUG 1: broken link
    expect(html).toContain('/nonexistent-404-page');
    // BUG 2: disabled submit
    expect(html).toContain('disabled');
    // BUG 3: overflow
    expect(html).toContain('overflow: hidden');
    // BUG 4: missing alt
    expect(html).toMatch(/<img[^>]*src="\/logo\.png"[^>]*>/);
    expect(html).not.toMatch(/<img[^>]*src="\/logo\.png"[^>]*alt=/);
    // BUG 5: console error
    expect(html).toContain("Cannot read properties of undefined");
  });

  test('review-eval-vuln.rb contains expected vulnerability patterns', () => {
    const content = fs.readFileSync(path.join(ROOT, 'test', 'fixtures', 'review-eval-vuln.rb'), 'utf-8');
    expect(content).toContain('params[:id]');
    expect(content).toContain('update_column');
  });
});

// --- CEO review mode validation ---

describe('CEO review mode validation', () => {
  const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');

  test('has all four CEO review modes defined', () => {
    const modes = ['SCOPE EXPANSION', 'SELECTIVE EXPANSION', 'HOLD SCOPE', 'SCOPE REDUCTION'];
    for (const mode of modes) {
      expect(content).toContain(mode);
    }
  });

  test('has CEO plan persistence step', () => {
    expect(content).toContain('ceo-plans');
    expect(content).toContain('status: ACTIVE');
  });

  test('has docs/designs promotion section', () => {
    // Carved (v2 plan Phase B): the promotion block moved into the review section.
    const union = readSkillUnion('plan-ceo-review');
    expect(union).toContain('docs/designs');
    expect(union).toContain('PROMOTED');
  });

  test('mode quick reference has four columns', () => {
    expect(content).toContain('EXPANSION');
    expect(content).toContain('SELECTIVE');
    expect(content).toContain('HOLD SCOPE');
    expect(content).toContain('REDUCTION');
  });

  // Skill chaining (benefits-from)
  test('contains prerequisite skill offer for office-hours', () => {
    expect(content).toContain('Prerequisite Skill Offer');
    expect(content).toContain('/office-hours');
  });

  test('contains mid-session detection', () => {
    expect(content).toContain('**セッション途中の検出(0A):**');
    expectMentions(compact(content), [['よくわからない', '`/office-hours`', '提案']], 'content');
  });

  // Spec review on CEO plans
  test('contains spec review loop for CEO plan documents', () => {
    expect(content).toContain('Spec Review Loop');
  });
});

// --- gstack-slug helper ---

describe('gstack-slug', () => {
  const SLUG_BIN = path.join(ROOT, 'bin', 'gstack-slug');
  usePrivateStateRoot();

  test('binary exists and is executable', () => {
    expect(fs.existsSync(SLUG_BIN)).toBe(true);
    const stat = fs.statSync(SLUG_BIN);
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  test('outputs SLUG and BRANCH lines in a git repo', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    expect(output).toContain('SLUG=');
    expect(output).toContain('BRANCH=');
  });

  test('SLUG does not contain forward slashes', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    const slug = result.stdout.toString().match(/SLUG=(.*)/)?.[1] ?? '';
    expect(slug).not.toContain('/');
    expect(slug.length).toBeGreaterThan(0);
  });

  test('BRANCH does not contain forward slashes', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    const branch = result.stdout.toString().match(/BRANCH=(.*)/)?.[1] ?? '';
    expect(branch).not.toContain('/');
    expect(branch.length).toBeGreaterThan(0);
  });

  test('output is eval-compatible (KEY=VALUE format)', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    const lines = result.stdout.toString().trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/^SLUG=.+/);
    expect(lines[1]).toMatch(/^BRANCH=.+/);
  });

  test('output values contain only safe characters (no shell metacharacters)', () => {
    const result = Bun.spawnSync([SLUG_BIN], { cwd: ROOT, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 });
    const slug = result.stdout.toString().match(/SLUG=(.*)/)?.[1] ?? '';
    const branch = result.stdout.toString().match(/BRANCH=(.*)/)?.[1] ?? '';
    // Only alphanumeric, dot, dash, underscore are allowed (#133)
    expect(slug).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(branch).toMatch(/^[a-zA-Z0-9._-]+$/);
  });
  test('eval sets variables under bash with set -euo pipefail', () => {
    const result = Bun.spawnSync(
      ['bash', '-c', 'set -euo pipefail; eval "$(./bin/gstack-slug 2>/dev/null)"; echo "SLUG=$SLUG"; echo "BRANCH=$BRANCH"'],
      { cwd: ROOT, env: { ...process.env }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000 }
    );
    expect(result.exitCode).toBe(0);
    const output = result.stdout.toString();
    expect(output).toMatch(/^SLUG=.+/m);
    expect(output).toMatch(/^BRANCH=.+/m);
  });

  test('no templates or bin scripts use source process substitution for gstack-slug', () => {
    // Scan project sources, including new untracked templates, without walking
    // ignored caches, symlinked installations or private evaluation worktrees.
    const result = Bun.spawnSync(
      ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.tmpl', 'bin/gstack-review-*'],
      { cwd: ROOT, stdout: 'pipe', stderr: 'pipe', timeout: 5_000 },
    );
    expect(result.exitCode, result.stderr.toString()).toBe(0);
    const files = [...new Set(result.stdout.toString().split('\0').filter(Boolean))];
    expect(files.length).toBeGreaterThan(0);
    const violations = files.filter(file => /source <\(.*gstack-slug/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
    expect(violations).toEqual([]);
  });
});

// --- Test Bootstrap validation ---

describe('Test Bootstrap ({{TEST_BOOTSTRAP}}) integration', () => {
  test('TEST_BOOTSTRAP resolver produces valid content', () => {
    const content = fs.readFileSync(path.join(ROOT, 'ship/sections/tests.md'), 'utf8');
    expect(content).toContain('Test Framework Bootstrap');
    expect(content).toContain('RUNTIME:ruby');
    expect(content).toContain('RUNTIME:node');
    expect(content).toContain('RUNTIME:python');
    expect(content).toContain('no-test-bootstrap');
    expect(content).toContain('BOOTSTRAP_DECLINED');
  });

  test('TEST_BOOTSTRAP appears in qa/SKILL.md', () => {
    const content = readSkillUnion('qa');
    expect(content).toMatch(/^## テストフレームワークのブートストラップ/m);
    expect(content).toContain('TESTING.md');
    expect(content).toContain('CLAUDE.md');
  });

  test('TEST_BOOTSTRAP appears in ship/SKILL.md', () => {
    const content = readShipUnion();
    expect(content).toContain('Test Framework Bootstrap');
    expect(content).toContain('Step 4');
  });

  test('TEST_BOOTSTRAP appears in design-review/SKILL.md', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('Test Framework Bootstrap');
  });

  test('TEST_BOOTSTRAP does NOT appear in qa-only/SKILL.md', () => {
    const content = fs.readFileSync(path.join(ROOT, 'qa-only', 'SKILL.md'), 'utf-8');
    expect(content).not.toContain('Test Framework Bootstrap');
    expect(content).not.toMatch(/^#+ .*ブートストラップ/m);
    // But should have the recommendation note
    expectMentions(compact(content), [['テストフレームワークが検出されません'], ['`/qa`', 'ブートストラップ']], 'content');
  });

  test('bootstrap includes framework knowledge table', () => {
    const content = readSkillUnion('qa');
    expect(content).toContain('vitest');
    expect(content).toContain('minitest');
    expect(content).toContain('pytest');
    expect(content).toContain('cargo test');
    expect(content).toContain('phpunit');
    expect(content).toContain('ExUnit');
  });

  test('bootstrap includes CI/CD pipeline generation', () => {
    const content = readSkillUnion('qa');
    expect(content).toContain('.github/workflows/test.yml');
    expect(content).toContain('GitHub Actions');
  });

  test('bootstrap includes first real tests step', () => {
    const content = readSkillUnion('qa');
    expect(content).toContain('**最初の実テスト:**');
    expect(content).toContain('git log --since=30.days');
    expectMentions(compact(content), [['リスクの高い順', '優先', 'エラーハンドラー']], 'content');
  });

  test('bootstrap includes vibe coding philosophy', () => {
    const content = readSkillUnion('qa');
    expectMentions(compact(content), [['バイブコーディング', '100%', 'テストカバレッジ']], 'content');
  });

  test('WebSearch is in allowed-tools for qa, ship, design-review', () => {
    const qa = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    const ship = readShipUnion();
    const qaDesign = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(qa).toContain('WebSearch');
    expect(ship).toContain('WebSearch');
    expect(qaDesign).toContain('WebSearch');
  });
});

// --- Phase 8e.5 regression test validation ---

describe('Phase 8e.5 regression test generation', () => {
  test('qa/SKILL.md contains Phase 8e.5', () => {
    const content = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expect(content).toContain('### 8e.5. 回帰テストの記録');
    expect(content).toContain('test(qa): regression test');
    expectMentions(compact(content), [['テストのみのコミット', '8f', '数えません']], 'content');
  });

  test('qa/SKILL.md Rule 13 is amended for regression tests', () => {
    const content = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expectMentions(compact(content), [['Phase 8a.5', '明文化', 'テストを作成']], 'content');
    expectMentions(compact(content), [['決して', 'CI', '既存のテスト']], 'content');
    expect(content.indexOf('### 8a.5. 修復の前に回帰テストを書く')).toBeGreaterThan(-1);
    expect(content.indexOf('### 8a.5. 修復の前に回帰テストを書く')).toBeLessThan(content.indexOf('### 8b. 修正'));
    expectMentions(compact(content), [['修復の前に', '検出したコマンド']], 'content');
    const exploratory = fs.readFileSync(path.join(ROOT, 'qa', 'sections', 'exploratory.md'), 'utf-8').replace(/\s+/g, ' ');
    expectMentions(exploratory, [['修復の前に', '回帰', '検証済み']], 'exploratory');
    expectMentions(exploratory, [['コマンド/リクエスト', '失敗', '修復の前に']], 'exploratory');
    expectMentions(exploratory, [['別の入力', '回帰テスト', 'なりません']], 'exploratory');
  });

  test('design-review has CSS-aware Phase 8e.5 variant', () => {
    const content = fs.readFileSync(path.join(ROOT, 'design-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('### 8e.5. 回帰テスト (design-review の変形)');
    expect(content).toContain('CSS のみ');
    expect(content).toContain('test(design): regression test');
  });

  test('regression test includes full attribution comment format', () => {
    const content = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expect(content).toContain('// Regression: ISSUE-NNN');
    expect(content).toContain('// Found by /qa on');
    expect(content).toContain('// Report: .gstack/qa-reports/');
  });

  test('regression test uses auto-incrementing names', () => {
    const content = fs.readFileSync(path.join(ROOT, 'qa', 'SKILL.md'), 'utf-8');
    expectMentions(compact(content), [['自動で増分', '{name}.regression-N.test.{ext}'], ['最大の番号 + 1']], 'content');
  });
});

// --- Step 3.4 coverage audit validation ---

describe('Step 3.4 test coverage audit', () => {
  test('ship/SKILL.md contains Step 7', () => {
    const content = readShipUnion();
    expect(content).toContain('## Step 7: テストカバレッジ監査');
    // The coverage diagram collapses code-path and user-flow counts onto one
    // summary line. Verify that summary is present (labels are stable).
    expect(content).toContain('Code paths:');
  });

  test('Step 3.4 includes quality scoring rubric', () => {
    const content = readShipUnion();
    expect(content).toContain('★★★');
    expect(content).toContain('★★');
    expectMentions(compact(content), [['★★★', 'エッジケース', 'エラーパス']], 'content');
    expectMentions(compact(content), [['★★', 'ハッピーパスのみ']], 'content');
  });

  test('Step 3.4 includes before/after test count', () => {
    const content = readShipUnion();
    expect(content).toContain('Count test files before');
    expect(content).toContain('Count test files after');
  });

  test('ship PR body includes Test Coverage section', () => {
    const content = readShipUnion();
    expect(content).toContain('## Test Coverage');
  });

  test('ship rules include test generation rule', () => {
    const content = readShipUnion();
    expectMentions(compact(content), [['Step 7', 'カバレッジのテストを生成']], 'content');
    expectMentions(compact(content), [['失敗するテスト', '決してコミットしない']], 'content');
  });

  test('Step 3.4 states the value-based coverage goal', () => {
    const content = readShipUnion();
    expectMentions(compact(content), [['カバレッジの目標', '変更されたすべての挙動', '実際の回帰', 'テスト']], 'content');
    expectMentions(compact(content), [['テストの数', '目標ではありません']], 'content');
  });

  test('Step 3.4 traces actual codepaths, not just syntax', () => {
    const content = readShipUnion();
    expectMentions(compact(content), [['変更されたすべてのコードパス', '`git diff origin/<base>`', 'トレース']], 'content');
    expectMentions(compact(content), [['データフロー', 'トレース']], 'content');
    expectMentions(compact(content), [['実行を diagram', 'します']], 'content');
  });

  test('Step 3.4 maps user flows and interaction edge cases', () => {
    const content = readShipUnion();
    expectTokens(content, [
      '**2. ユーザーフロー、操作、エラー状態をマッピングします:**',
      '**操作のエッジケース:**',
      'ダブルクリック',
      '操作の途中での離脱',
      '**ユーザーに見えるエラー状態:**',
      '**空/ゼロ/境界の状態:**',
    ], 'ship step 7');
  });

  test('Step 3.4 diagram includes user-flow coverage summary', () => {
    const content = readShipUnion();
    // The diagram was compressed from separate CODE PATH COVERAGE / USER FLOW
    // COVERAGE section headers into a single summary line. Assert on the
    // labels that still appear on that summary line.
    expect(content).toContain('Code paths:');
    expect(content).toContain('User flows:');
  });
});

// --- Ship step numbering regression guard ---

describe('ship step numbering', () => {
  // Allowed sub-steps that are resolver-generated and intentionally nested:
  // 0.9 (Apple target detection — MUST precede Step 1's branch gate, R2-pinned
  // by test/ship-apple-gate.test.ts), 8.1 (Plan Verification), 8.2 (Scope
  // Drift), 9.1 (Review Army), 9.2 (Findings Merge), 9.3 (Cross-review dedup),
  // 9.4 (Fix-First and persistence), 15.0 (WIP context), 15.1 (Bisectable commits),
  // 15.2 (safe optional WIP consolidation), 6.5 (early Greptile PR, which must
  // follow the free tests and precede the reviews it runs in parallel with).
  const ALLOWED_SUBSTEPS = new Set(['0.9', '6.5', '8.1', '8.2', '9.1', '9.2', '9.3', '9.4', '11.5', '14.5', '15.0', '15.1', '15.2']);

  test('ship/SKILL.md.tmpl contains no unexpected fractional step numbers', () => {
    const tmpl = fs.readFileSync(path.join(ROOT, 'ship', 'SKILL.md.tmpl'), 'utf-8');
    // Match "Step X.Y" where X.Y is a decimal step reference (e.g., "Step 3.47", "Step 8.1")
    const matches = Array.from(tmpl.matchAll(/Step (\d+\.\d+)/g));
    const violations = matches
      .map((m) => m[1])
      .filter((n) => !ALLOWED_SUBSTEPS.has(n));
    if (violations.length > 0) {
      const unique = Array.from(new Set(violations)).sort();
      throw new Error(
        `ship/SKILL.md.tmpl contains fractional step numbers that are not in the allowed sub-step list.\n` +
          `  Found: ${unique.join(', ')}\n` +
          `  Allowed sub-steps: ${Array.from(ALLOWED_SUBSTEPS).sort().join(', ')}\n` +
          `  Fix: use clean integer step numbers (1-20), or add to ALLOWED_SUBSTEPS if intentional.`
      );
    }
  });

  test('ship/SKILL.md main headings use clean integer step numbers', () => {
    const skill = readShipUnion();
    // Headings like "## Step 7: Test Coverage Audit" — NOT sub-steps like "## Step 8.1:"
    const headings = Array.from(skill.matchAll(/^## Step (\d+(?:\.\d+)?):/gm)).map(
      (m) => m[1]
    );
    const fractional = headings.filter((n) => n.includes('.'));
    const unexpected = fractional.filter((n) => !ALLOWED_SUBSTEPS.has(n));
    expect(unexpected).toEqual([]);
    expect(headings.filter((n) => n === '11.5')).toHaveLength(1);
  });

  test('review/SKILL.md step numbers unchanged (regression guard for resolver conditionals)', () => {
    // Carved skill: Step 4.5 lives in sections/review-army.md and Step 4.8 in
    // sections/adversarial.md — read the skeleton+sections union.
    const skill = readSkillUnion('review');
    // /review uses its own fractional numbering: 1.5, 2.5, 4.5, 4.8, 5.8
    // If the ship-side renumber accidentally touched the review-side of resolver conditionals,
    // these would vanish. This test catches that.
    expect(skill).toContain('## Step 1.5: Scope Drift Detection');
    expect(skill).toContain('## Step 4.5: Review Army');
    expect(skill).toMatch(/^## Step 4\.8: /m);
  });
});

// --- Retro test health validation ---

describe('Retro test health tracking', () => {
  // The inline git pipelines moved into bin/gstack-retro-metrics (retro
  // token-reduction wave); the skill interprets its labeled METRIC lines.
  test('gstack-retro-metrics gathers the test health data', () => {
    const script = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-retro-metrics'), 'utf-8');
    expect(script).toContain('TEST_FILES_TOTAL');
    expect(script).toContain('REGRESSION_TEST_COMMITS');
    expect(script).toContain('TEST_FILES_CHANGED');
    // The historical grep targets survive the script absorption.
    expect(script).toContain('test(qa):');
    expect(script).toContain('test(design):');
    expect(script).toContain('git ls-files');
  });

  test('retro skill interprets the test-health metric lines', () => {
    // Template source, not the generated render: the pin must hold across the
    // regen boundary (the generated file follows the template at gen time).
    const content = fs.readFileSync(path.join(ROOT, 'retro', 'SKILL.md.tmpl'), 'utf-8');
    expect(content).toContain('TEST_FILES_TOTAL');
    expect(content).toContain('REGRESSION_TEST_COMMITS');
  });

  test('retro/SKILL.md has Test Health metrics row', () => {
    const content = readSkillUnion('retro');
    expect(content).toMatch(/^\| テストの健全性 \| N テストファイル/m);
    expectMentions(compact(content), [['この期間に M 件変更', 'K 件のリグレッションテストのコミット']], 'content');
  });

  test('retro/SKILL.md has Test Health narrative section', () => {
    // Carved: the narrative report format lives in sections/report-format.md.
    const content = readSkillUnion('retro');
    expect(content).toContain('### テストの健全性');
    expectMentions(compact(content), [['テストファイルの総数', '`TEST_FILES_TOTAL`']], 'content');
    expectMentions(compact(content), [['テストカバレッジ 100%'], ['バイブコーディング', '安全']], 'content');
  });

  test('retro JSON schema includes test_health field', () => {
    const content = readSkillUnion('retro');
    expect(content).toContain('test_health');
    expect(content).toContain('total_test_files');
    expect(content).toContain('regression_test_commits');
  });
});

// --- QA report template regression tests section ---

describe('QA report template', () => {
  test('qa-report-template.md has Regression Tests section', () => {
    const content = fs.readFileSync(path.join(ROOT, 'qa', 'templates', 'qa-report-template.md'), 'utf-8');
    expect(content).toContain('## リグレッションテスト');
    expect(content).toContain('committed / deferred / skipped');
    expect(content).toContain('### 延期したテスト');
    expect(content).toContain('**前提条件:**');
  });
});

// --- Codex skill validation ---

describe('Codex skill', () => {
  test('codex/SKILL.md exists and has correct frontmatter', () => {
    const content = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(content).toContain('name: codex');
    expect(content).toContain('version: 1.0.0');
    expect(content).toContain('allowed-tools:');
  });

  // Carved skill (T9): the three mode bodies live in codex/sections/
  // {review,challenge,consult}-mode.md. Content pins read the union; the
  // mode DISPATCH must stay in the always-loaded skeleton.
  test('codex union contains all three modes; skeleton keeps the dispatch', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('## ステップ 2A: レビューモード');
    expect(content).toContain('## ステップ 2B: チャレンジ');
    expect(content).toContain('## ステップ 2C: 相談モード');
    const skeleton = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(skeleton).toContain('## ステップ 1: モードの判定');
    expectMentions(compact(skeleton), [['3 つのモード', '互いに排他的']], 'skeleton');
  });

  test('codex union contains gate verdict logic', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('[P1]');
    expect(content).toContain('GATE: PASS');
    expect(content).toContain('GATE: FAIL');
  });

  test('codex union contains session continuity', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('codex-session-id');
    expect(content).toContain('codex exec resume');
  });

  test('codex resume command only uses resume-supported flags', () => {
    const content = readSkillUnion('codex');
    const match = content.match(/codex exec resume[^\n]+/);
    expect(match).not.toBeNull();
    const resumeCommand = match![0];
    expect(resumeCommand).not.toContain(' -C ');
    expect(resumeCommand).not.toMatch(/ -s /);
    // resume takes the sandbox only as config; the probe's select-model reports it (read-only by default).
    expect(resumeCommand).toContain('-c "sandbox_mode=\\"${_CODEX_SANDBOX_MODE:?}\\""');
  });

  test('codex union contains cost tracking', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('tokens used');
    expect(content).toContain('Est. cost');
  });

  test('codex union contains cross-model comparison', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('CROSS-MODEL ANALYSIS');
    expect(content).toContain('Agreement rate');
  });

  test('codex union contains review log persistence', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('codex-review');
    expect(content).toContain('gstack-review-log');
  });

  test('codex uses command -v for binary discovery, not hardcoded path', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('command -v codex');
    expect(content).not.toContain('/opt/homebrew/bin/codex');
    // Defensive: catch any future regression that reintroduces `which codex`,
    // which fails in environments where `which` isn't on PATH (some Windows
    // shells, BusyBox-only containers). #1197.
    expect(content).not.toContain('which codex');
  });

  test('codex/SKILL.md contains error handling for missing binary and auth', () => {
    const content = fs.readFileSync(path.join(ROOT, 'codex', 'SKILL.md'), 'utf-8');
    expect(content).toContain('NOT_FOUND');
    expect(content).toContain('codex login');
  });

  test('codex union uses mktemp for temp files', () => {
    const content = readSkillUnion('codex');
    expect(content).toContain('mktemp');
  });

  test('codex JSON stream parser uses portable Python discovery', () => {
    // The JSONL parsers live in the challenge + consult mode sections; sweep
    // the tmpl union and the rendered union so neither side drifts.
    const sectionsDir = path.join(ROOT, 'codex', 'sections');
    const tmplUnion = ['codex/SKILL.md.tmpl']
      .map((rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8'))
      .concat(
        fs.readdirSync(sectionsDir).sort()
          .filter((f) => f.endsWith('.md.tmpl'))
          .map((f) => fs.readFileSync(path.join(sectionsDir, f), 'utf-8')),
      )
      .join('\n');

    for (const content of [tmplUnion, readSkillUnion('codex')]) {
      expect(content).toContain('PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)');
      expect(content).toContain('PYTHONUNBUFFERED=1 "$PYTHON_CMD" -u -c');
      expect(content).not.toContain('PYTHONUNBUFFERED=1 python3 -u -c');
    }
  });

  test('adversarial review in /review always runs both passes', () => {
    // Carved skill: the Step 4.8 adversarial body lives in sections/adversarial.md.
    const content = readSkillUnion('review');
    expect(content).toContain('## Step 4.8: 敵対的レビュー(常時実行)');
    // Always-on: both Claude and Codex adversarial
    expect(content).toContain('### Claude 敵対的サブエージェント(常に実行)');
    expect(content).toContain('### Codex 敵対的チャレンジ(`CODEX_MODE` が `ready` または `unverified` のときは常に実行)');
    // Claude adversarial subagent dispatch
    expect(content).toContain('Agent ツール');
    expect(content).toContain('FIXABLE');
    expect(content).toContain('INVESTIGATE');
    // Probe-based availability via the shared codexPreflight() (install + auth)
    expect(content).toContain('CODEX_MODE');
    expect(content).toContain('command -v codex'); // install check kept literal
    // codex_reviews=disabled gates Codex passes only; Claude adversarial still runs
    expectMentions(compact(content), [['`CODEX_MODE: disabled`', 'Codex のパスだけ', 'スキップ']], 'content');
    expectMentions(compact(content), [['Claude の敵対的サブエージェント', '常に実行']], 'content');
    // Review log
    expect(content).toContain('adversarial-review');
    expect(content).toContain('run-with-timeout --effort high ');
    expect(content).toContain('ADVERSARIAL REVIEW SYNTHESIS');
    // Large diff structured review still gated
    expect(content).toContain('### Codex 構造化レビュー(大きな diff のみ、200 行以上)');
    expect(content).toContain('DIFF_TOTAL >= 200');
  });

  test('adversarial review in /ship always runs both passes', () => {
    const content = readShipUnion();
    expect(content).toContain('## Step 11: 敵対的レビュー(常時実行)');
    expect(content).toContain('adversarial-review');
    expect(content).toContain('run-with-timeout --effort high ');
    expect(content).toContain('今すぐ調査して修正する');
    expect(content).toContain('### Claude 敵対的サブエージェント(常に実行)');
  });

  test('scope drift detection in /review and /ship', () => {
    const reviewContent = readSkillUnion('review');
    const shipContent = readShipUnion();
    // Both should contain scope drift from the shared resolver
    for (const content of [reviewContent, shipContent]) {
      expect(content).toContain('Scope Check:');
      expect(content).toContain('DRIFT DETECTED');
      expect(content).toContain('SCOPE CREEP');
      expect(content).toContain('MISSING REQUIREMENTS');
      expectMentions(compact(content), [['表明された意図', '実際の変更', '比較']]);
    }
  });

  test('codex-host ship/review preserve adversarial review with a Claude outside voice', () => {
    for (const skill of ['ship', 'review']) {
      const content = readCodexSkillUnion(skill);
      expect(content).not.toMatch(/codex\s+(?:exec|review)\s/);
      expect(content).toContain('gstack-claude-code');
      expect(content).toContain('codex_reviews');
      expect(content).toContain('adversarial-review');
      expect(content).toContain('今すぐ調査して修正する');
    }
  });

  test('codex integration in /plan-eng-review offers plan critique', () => {
    // Carved skill: the Codex outside-voice plan critique lives in
    // sections/review-sections.md — read the skeleton+sections union. (The
    // skeleton alone used to match "Codex" only via an inline-bash comment
    // that the gstack-skill-start consolidation removed.)
    const content = readSkillUnion('plan-eng-review');
    expect(content).toContain('Codex');
    expect(content).toContain('codex exec');
  });

  // D5 regression guard: the Codex outside voice is default-on, not opt-in. A future
  // gen-skill-docs change must not silently reintroduce the "Want an outside voice?"
  // AskUserQuestion. The CODEX_PLAN_REVIEW content renders into each skill's
  // sections/review-sections.md (the skeleton points at it). plan-design-review uses
  // DESIGN_OUTSIDE_VOICES, not CODEX_PLAN_REVIEW, so it is excluded here.
  test('plan reviews run the Codex outside voice default-on (no opt-in question)', () => {
    for (const skill of ['plan-eng-review', 'plan-ceo-review', 'plan-devex-review']) {
      const content = fs.readFileSync(
        path.join(ROOT, skill, 'sections', 'review-sections.md'), 'utf-8');
      expect(content).not.toContain('Want an outside voice');
      expect(content).toContain('CODEX_MODE');
      expect(content).toContain('command -v codex'); // preflight install check (e2e relies on it)
    }
  });

  test('/document-release includes the default-on Codex documentation review', () => {
    // The doc-review renders into the carved release-body section (kept out of the
    // always-loaded skeleton to respect the skeleton-byte budget).
    const content = fs.readFileSync(
      path.join(ROOT, 'document-release', 'sections', 'release-body.md'), 'utf-8');
    expect(content).toContain('## Codex ドキュメントレビュー(デフォルトで有効)');
    expect(content).toContain('CODEX_MODE');
    expect(content).toContain('codex-doc-review');
  });

  test('codex-host document-release runs Claude Code and keeps the historical log identifier', () => {
    const content = readCodexSkillUnion('document-release');
    expect(content).toContain('Claude Code');
    expect(content).toContain('gstack-claude-code');
    expect(content).toContain('codex-doc-review');
    expect(content).not.toMatch(/codex\s+(?:exec|review)\s/);
  });

  test('codex review invocations avoid the prompt plus --base argument shape', () => {
    // The real invariant is "never pass a positional [PROMPT] together with a
    // scope flag" — the CLI rejects that combination at argv parse time
    // (#1428, #1479). Two different shapes satisfy it, and these files have
    // diverged on which one they use:
    //
    //   scoped   — `codex review --base <base>` with NO prompt argument. The
    //     scope comes from the CLI, which is the only thing that actually sets
    //     it. This is what all three files now use.
    //   broken   — prompt-only `codex review "<text>"` describing the diff
    //     range in prose. This parses, but the CLI falls back to *uncommitted
    //     working-tree* scope, so the review silently covers the wrong changes.
    //
    // The old assertion banned the substring `--base <base> -c '...'`, which
    // the correct scoped form also contains — it could not tell the two apart,
    // so it effectively banned the fix.
    for (const rel of ['codex/SKILL.md', 'review/SKILL.md', 'ship/SKILL.md']) {
      // ship's AND review's codex commands moved into sections/adversarial.md;
      // codex's own scoped invocation lives in sections/review-mode.md (T9 carve).
      const content = rel === 'ship/SKILL.md' ? readShipUnion()
        : rel === 'review/SKILL.md' ? readSkillUnion('review')
        : readSkillUnion('codex');
      expect(content).toMatch(/codex\s+review\s+--base\b/);
      const offending: string[] = [];
      for (const line of content.split('\n')) {
        if (line.includes('`codex review`')) continue;
        const match = line.match(/(?:^|[;&|]\s*|\s)codex\s+review\b(.*)$/);
        if (!match) continue;
        const rest = match[1];
        if (!/--base\b|--commit\b|--uncommitted\b/.test(rest)) continue;
        const beforeFlag = rest.split(/--base\b|--commit\b|--uncommitted\b/)[0].trim();
        // A quoted string or variable expansion before the scope flag is the bug.
        if (/^["'$]|^--\s*["']/.test(beforeFlag)) offending.push(`${rel}: ${line.trim()}`);
      }
      expect(offending).toEqual([]);
    }
  });

  test('codex review prompts always carry the filesystem boundary (#1503/#1522 regression)', () => {
    // Pre-#1209, the bare `codex review --base` path stripped the filesystem
    // boundary instruction, letting Codex spend tokens reading skill files.
    // #1209's prompt rewrite restored the boundary by routing every default
    // call through a prompt — but routing through a prompt is what breaks the
    // diff scope, so codex/ no longer does that. What this test pins is the
    // boundary TEXT, which must still be present for the paths that do take a
    // prompt (`codex exec` for challenge, consult, and custom review focus).
    // Do NOT "restore" the boundary by putting a prompt argument back on a
    // scoped `codex review` call: that combination fails to parse, and
    // dropping the scope flag to make it parse silently reviews the wrong diff.
    // codex/SKILL.md carries the boundary as a localized instruction; the prompts
    // that are sent to Codex (review/ship adversarial) stay English on purpose.
    const boundaryLine = /do not read or execute any files under ~\/\.claude\/, ~\/\.agents\/, \.claude\/skills\/, or agents\//i;
    const boundaryLineJa = /~\/\.claude\/、~\/\.agents\/、\.claude\/skills\/、agents\/ の下にあるファイルを読んだり実行したりしないでください/;
    for (const rel of ['codex/SKILL.md', 'review/SKILL.md', 'ship/SKILL.md']) {
      // ship's AND review's codex/adversarial boundary lines moved into sections/adversarial.md.
      const content = rel === 'ship/SKILL.md' ? readShipUnion()
        : rel === 'review/SKILL.md' ? readSkillUnion('review')
        : fs.readFileSync(path.join(ROOT, rel), 'utf-8');
      expect(content).toMatch(boundaryLine.test(content) ? boundaryLine : boundaryLineJa);
    }
  });

  test('/review persists a review-log entry for ship readiness', () => {
    const content = fs.readFileSync(path.join(ROOT, 'review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('"skill":"review"');
    expect(content).toContain('"issues_found":N');
    expect(content).toContain('## Step 5.8: エンジニアリングレビューの結果を保存する');
  });

  test('Review Readiness Dashboard includes Adversarial Review row', () => {
    const content = readShipUnion();
    expect(content).toContain('Adversarial');
    expect(content).toContain('codex-review');
  });
});

// --- Trigger phrase validation ---

describe('Skill trigger phrases', () => {
  // Skills that must have "Use when" trigger phrases in their description.
  // Excluded: root gstack (browser tool), gstack-upgrade (gstack-specific),
  // humanizer (text tool)
  const SKILLS_REQUIRING_TRIGGERS = [
    'qa', 'qa-only', 'ship', 'review', 'investigate', 'office-hours',
    'plan-ceo-review', 'plan-eng-review', 'plan-design-review',
    'design-review', 'design-consultation', 'retro', 'document-release',
    'codex', 'browse', 'setup-browser-cookies', 'scrape',
  ];

  for (const skill of SKILLS_REQUIRING_TRIGGERS) {
    test(`${skill}/SKILL.md.tmpl has "Use when" trigger phrases`, () => {
      const skillPath = path.join(ROOT, skill, 'SKILL.md.tmpl');
      if (!fs.existsSync(skillPath)) return;
      const content = fs.readFileSync(skillPath, 'utf-8');
      // The catalog trim drops trigger prose from the Claude SKILL.md, so check
      // the template description: --catalog-mode=full and the other hosts
      // still route on it.
      // Descriptions are localized: the trigger sentence ends with 「…と依頼されたときに使います/使用します」.
      expect(content).toMatch(/使(い|用し)ます/);
    });
  }

  // Skills with proactive triggers should have "Proactively suggest" somewhere in the skill.
  const SKILLS_REQUIRING_PROACTIVE = [
    'qa', 'qa-only', 'ship', 'review', 'investigate', 'office-hours',
    'plan-ceo-review', 'plan-eng-review', 'plan-design-review',
    'design-review', 'design-consultation', 'retro', 'document-release',
  ];

  for (const skill of SKILLS_REQUIRING_PROACTIVE) {
    test(`${skill}/SKILL.md.tmpl has proactive routing phrase`, () => {
      const skillPath = path.join(ROOT, skill, 'SKILL.md.tmpl');
      if (!fs.existsSync(skillPath)) return;
      const content = fs.readFileSync(skillPath, 'utf-8');
      // Same catalog-trim consideration — check the template description.
      // Localized: 積極的に提案/起動/呼び出す (document-release words it as 提案すべきときに使います).
      expect(content).toMatch(/積極的に(提案|起動|このスキルを呼び出|このスキルを積極的に)|提案すべきとき/);
    });
  }
});

// ─── Private-path leak detector ──────────────────────────────
//
// Catches accidental references to maintainer-private files in skill output.
// Adapted from the McGluut fork's skill-contract-audit.ts (we don't take the
// whole script — these are the unique checks not already covered by
// test/gen-skill-docs.test.ts:1668-2074 .claude/skills leakage tests).

describe('Private-path leak detection', () => {
  const PRIVATE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /coordination-board\.md/i, label: 'coordination-board.md' },
    { pattern: /SEEKING_LOG\.md/, label: 'SEEKING_LOG.md' },
    { pattern: /RATIONAL_SUBJECT\.md/, label: 'RATIONAL_SUBJECT.md' },
    { pattern: /VALUE_SIGNAL_LOOP\.md/, label: 'VALUE_SIGNAL_LOOP.md' },
    { pattern: /C:\\\\LLM Playground\\\\go/i, label: 'C:\\LLM Playground\\go' },
  ];

  // Walk every SKILL.md and SKILL.md.tmpl in the repo (excluding node_modules,
  // generated host outputs, and .git).
  function discoverSkillSurface(): string[] {
    const results: string[] = [];
    function walk(dir: string) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') && entry.name !== '.agents') continue;
        if (entry.name === 'node_modules' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name === 'SKILL.md' || entry.name === 'SKILL.md.tmpl') {
          results.push(full);
        }
      }
    }
    walk(ROOT);
    return results;
  }

  test('no SKILL.md or SKILL.md.tmpl references private maintainer files', () => {
    const files = discoverSkillSurface();
    expect(files.length).toBeGreaterThan(0);
    const leaks: string[] = [];
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const { pattern, label } of PRIVATE_PATTERNS) {
        if (pattern.test(content)) {
          leaks.push(`${path.relative(ROOT, file)} mentions ${label}`);
        }
      }
    }
    expect(leaks).toEqual([]);
  });
});

// ─── Doc-inventory cross-check ───────────────────────────────
//
// Every skill directory (with a SKILL.md.tmpl) must appear in both AGENTS.md
// and docs/skills.md. Catches the inventory drift codex flagged (/debug
// → /investigate; missing /autoplan, /context-save, /plan-devex-review, etc.).

describe('Doc inventory cross-check', () => {
  // Skills that don't get user-invocation lines in agent-facing docs.
  // - 'qa-only' is a sub-mode of /qa with shared docs.
  // - The 5 listed below are infrastructure (model overlays, shipped binary,
  //   hosts) that don't show up in the user-facing skill table.
  const DOC_INVENTORY_EXCLUDE = new Set([
    // Infra / non-skills
    'agents', 'connect-chrome', 'contrib', 'hosts',
    'lib', 'model-overlays', 'openclaw', 'supabase', 'scripts', 'test',
  ]);

  function discoverSkillDirs(): string[] {
    const dirs: string[] = [];
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (DOC_INVENTORY_EXCLUDE.has(entry.name)) continue;
      const tmplPath = path.join(ROOT, entry.name, 'SKILL.md.tmpl');
      if (fs.existsSync(tmplPath)) dirs.push(entry.name);
    }
    return dirs.sort();
  }

  test('every skill is documented in AGENTS.md', () => {
    const agents = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf-8');
    const missing: string[] = [];
    for (const skill of discoverSkillDirs()) {
      // Match `/skill-name` as a token boundary.
      if (!new RegExp(`/${skill}\\b`).test(agents)) missing.push(skill);
    }
    expect(missing).toEqual([]);
  });

  test('every skill is documented in docs/skills.md', () => {
    const docs = fs.readFileSync(path.join(ROOT, 'docs', 'skills.md'), 'utf-8');
    const missing: string[] = [];
    for (const skill of discoverSkillDirs()) {
      if (!new RegExp(`/${skill}\\b`).test(docs)) missing.push(skill);
    }
    expect(missing).toEqual([]);
  });
});

// ─── Codex Skill Validation ──────────────────────────────────

describe('Codex skill validation', () => {
  // .agents/ is gitignored (v0.11.2.0) — read from the module-level out-dir
  // render (CODEX_OUT) instead of regenerating the live tree in place.
  const AGENTS_DIR = path.join(CODEX_OUT, '.agents', 'skills');

  // Discover all shared skills with templates.
  // Host-exclusive outside-voice skills are intentionally omitted here:
  // - /codex is unavailable on Codex
  // - /claude-code is unavailable on Claude Code
  const CLAUDE_SKILLS_WITH_TEMPLATES = (() => {
    const skills: string[] = [];
    for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      if (entry.name === 'codex') continue; // Unavailable on Codex
      if (entry.name === 'claude-code') continue; // Unavailable on Claude Code
      if (fs.existsSync(path.join(ROOT, entry.name, 'SKILL.md.tmpl'))) {
        skills.push(entry.name);
      }
    }
    return skills;
  })();

  test('shared skills have both Claude and Codex variants', () => {
    for (const skillDir of CLAUDE_SKILLS_WITH_TEMPLATES) {
      // Claude variant
      const claudeMd = path.join(ROOT, skillDir, 'SKILL.md');
      expect(fs.existsSync(claudeMd)).toBe(true);

      // Codex variant
      const codexName = skillDir.startsWith('gstack-') ? skillDir : `gstack-${skillDir}`;
      const codexMd = path.join(AGENTS_DIR, codexName, 'SKILL.md');
      expect(fs.existsSync(codexMd)).toBe(true);
    }
    // Root template has both too
    expect(fs.existsSync(path.join(ROOT, 'SKILL.md'))).toBe(true);
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack', 'SKILL.md'))).toBe(true);
  });

  test('/codex skill has a Claude variant and no Codex variant', () => {
    // Claude variant should exist
    expect(fs.existsSync(path.join(ROOT, 'codex', 'SKILL.md'))).toBe(true);
    // Codex variant must NOT exist
    expect(fs.existsSync(path.join(AGENTS_DIR, 'gstack-codex', 'SKILL.md'))).toBe(false);
  });

  test('Codex skill names follow gstack-{name} convention', () => {
    const codexDirs = fs.readdirSync(AGENTS_DIR);
    for (const dir of codexDirs) {
      // Every directory should start with gstack
      expect(dir.startsWith('gstack')).toBe(true);
      // Root is just 'gstack', others are 'gstack-{name}'
      if (dir !== 'gstack') {
        expect(dir.startsWith('gstack-')).toBe(true);
      }
    }
  });

  test('$B commands in Codex SKILL.md files are valid browse commands', () => {
    const codexDirs = fs.readdirSync(AGENTS_DIR);
    for (const dir of codexDirs) {
      const skillMd = path.join(AGENTS_DIR, dir, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const content = fs.readFileSync(skillMd, 'utf-8');
      // Only validate if the skill contains $B commands
      if (!content.includes('$B ')) continue;
      const result = validateSkill(skillMd);
      expect(result.invalid).toHaveLength(0);
    }
  });
});

// --- Repo mode and test failure triage validation ---

describe('Repo mode preamble validation', () => {
  test('generated SKILL.md preamble contains REPO_MODE output', () => {
    // Token-reduction Phase 1: the inline `gstack-repo-mode` call moved into
    // bin/gstack-skill-start. The render pins the script invocation; the
    // script pins the REPO_MODE echo + the gstack-repo-mode call.
    const content = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expect(content).toContain('bin/gstack-skill-start');
    const script = fs.readFileSync(path.join(ROOT, 'bin', 'gstack-skill-start'), 'utf-8');
    expect(script).toContain('REPO_MODE:');
    expect(script).toContain('gstack-repo-mode');
  });

  test('tier 3+ skills contain See Something Say Something section', () => {
    // Root SKILL.md is tier 1 (no Repo Mode). Check a tier 3 skill instead.
    const content = fs.readFileSync(path.join(ROOT, 'plan-ceo-review', 'SKILL.md'), 'utf-8');
    expect(content).toContain('## リポジトリの所有権 — 気づいたら声に出す');
    expect(content).toContain('REPO_MODE');
    expect(content).toContain('solo');
    expect(content).toContain('collaborative');
  });
});

describe('Test failure triage in ship skill', () => {
  test('ship/SKILL.md contains Test Failure Ownership Triage', () => {
    const content = readShipUnion();
    expect(content).toContain('Test Failure Ownership Triage');
  });

  test('ship/SKILL.md triage uses git diff for classification', () => {
    const content = readShipUnion();
    expect(content).toContain('git diff origin/<base>...HEAD --name-only');
  });

  test('ship/SKILL.md triage has solo and collaborative paths', () => {
    const content = readShipUnion();
    expect(content).toContain('REPO_MODE');
    expect(content).toContain('solo');
    expect(content).toContain('collaborative');
    expect(content).toContain('今すぐ調査して修正する');
    expect(content).toContain('P0 の TODO として追加する');
  });

  test('ship/SKILL.md triage has GitHub issue assignment for collaborative mode', () => {
    const content = readShipUnion();
    expect(content).toContain('gh issue create');
    expect(content).toContain('--assignee');
  });

  test('{{TEST_FAILURE_TRIAGE}} placeholder is fully resolved in ship/SKILL.md', () => {
    const content = readShipUnion();
    expect(content).not.toContain('{{TEST_FAILURE_TRIAGE}}');
  });

  test('ship/SKILL.md uses in-branch language for stop condition', () => {
    const content = readShipUnion();
    expectMentions(compact(content), [['ブランチ内', 'In-branch'], ['曖昧な場合', 'ブランチ内として扱います']], 'content');
    expectMentions(compact(content), [['STOP'], ['あなたの失敗']], 'content');
    expectMentions(compact(content), [['先へ進まないでください']], 'content');
  });
});

describe('no compiled binaries in git', () => {
  // Tracked files enumerated once and reused by both assertions. git ls-files -z
  // + split is ~ms; the previous xargs-per-file shell loops blew past 5s on CI.
  const trackedFiles: string[] = require('child_process')
    .execSync('git ls-files -z', { cwd: ROOT, encoding: 'utf-8', timeout: 30_000 })
    .split('\0')
    .filter(Boolean);

  test('git tracks no Mach-O or ELF binaries', () => {
    // Only mode 100755 (executable) files can be binaries we care about. Pre-filter
    // via git ls-files -s to avoid running `file` on every text file.
    const lsOut: string = require('child_process').execSync('git ls-files -s', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 30_000,
    });
    const executableFiles = lsOut
      .split('\n')
      .filter(Boolean)
      .map((line: string) => {
        const parts = line.split(/\s+/);
        return { mode: parts[0], file: line.split('\t')[1] };
      })
      .filter((e: { mode: string; file: string }) => e.mode === '100755')
      .map((e: { mode: string; file: string }) => e.file);

    if (executableFiles.length === 0) return;

    // Batch-invoke `file --mime-type` across all executable files at once.
    const result: string = require('child_process')
      .execSync(`file --mime-type -- ${executableFiles.map((f: string) => `'${f.replace(/'/g, "'\\''")}'`).join(' ')}`, {
        cwd: ROOT,
        encoding: 'utf-8',
        timeout: 30_000,
      })
      .trim();

    const binaries = result
      .split('\n')
      .filter((l: string) =>
        /application\/(x-mach-binary|x-executable|x-pie-executable|x-sharedlib)/.test(l)
      )
      .map((l: string) => l.split(':')[0].trim());

    expect(binaries).toEqual([]);
  });

  test('warns about tracked files larger than 2MB', () => {
    // Large fixtures can be legitimate test infrastructure. Keep visibility on
    // repository size without blocking those fixtures from living in git.
    // Known-good fixtures are exempted from the warning to keep CI logs clean.
    const MAX_BYTES = 2 * 1024 * 1024;
    const knownLargeFixtures = new Set<string>([
      // Currently empty — add repo-relative paths of intentionally-committed
      // large fixtures here with a reason.
    ]);
    const oversized = trackedFiles.flatMap((f: string) => {
      if (knownLargeFixtures.has(f)) return [];
      const full = path.join(ROOT, f);
      try {
        const size = fs.statSync(full).size;
        return size > MAX_BYTES ? [{ file: f, size }] : [];
      } catch {
        return [];
      }
    });

    if (oversized.length > 0) {
      const formatted = oversized
        .map(({ file, size }: { file: string; size: number }) => {
          const mib = (size / (1024 * 1024)).toFixed(1);
          return `${file} (${mib} MiB)`;
        })
        .join(', ');
      console.warn(`[size-warning] tracked files over 2 MiB: ${formatted}`);
    }

    expect(Array.isArray(oversized)).toBe(true);
  });
});


// ─── Browser-skills validation ──────────────────────────────────
//
// Browser-skills are bundled in <gstack-root>/browser-skills/<name>/. Each
// must have a SKILL.md whose frontmatter satisfies the contract enforced by
// browse/src/browser-skills.ts:parseSkillFile (host required, args + triggers
// parseable as the right shape). This test catches malformed bundled skills
// at CI time, before they ship.

describe('Bundled browser-skills frontmatter contract', () => {
  const browserSkillsRoot = path.join(ROOT, 'browser-skills');

  function listBundledSkillDirs(): string[] {
    if (!fs.existsSync(browserSkillsRoot)) return [];
    return fs.readdirSync(browserSkillsRoot)
      .filter(name => !name.startsWith('.'))
      .map(name => path.join(browserSkillsRoot, name))
      .filter(dir => {
        try { return fs.statSync(dir).isDirectory(); } catch { return false; }
      });
  }

  test('each bundled skill has a SKILL.md', () => {
    for (const dir of listBundledSkillDirs()) {
      const skillFile = path.join(dir, 'SKILL.md');
      expect(fs.existsSync(skillFile)).toBe(true);
    }
  });

  test('each bundled skill SKILL.md frontmatter parses with required fields', async () => {
    const { parseSkillFile } = await import('../browse/src/browser-skills');
    for (const dir of listBundledSkillDirs()) {
      const name = path.basename(dir);
      const content = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf-8');
      // parseSkillFile throws on missing required fields; we just want to
      // make sure none of our shipped skills tripwire it.
      const { frontmatter } = parseSkillFile(content, { skillName: name });
      expect(frontmatter.name).toBe(name);
      expect(typeof frontmatter.host).toBe('string');
      expect(frontmatter.host.length).toBeGreaterThan(0);
      expect(Array.isArray(frontmatter.triggers)).toBe(true);
      expect(Array.isArray(frontmatter.args)).toBe(true);
    }
  });

  test('each bundled skill has a script.ts', () => {
    for (const dir of listBundledSkillDirs()) {
      expect(fs.existsSync(path.join(dir, 'script.ts'))).toBe(true);
    }
  });

  test('each bundled skill ships a sibling SDK at _lib/browse-client.ts', () => {
    for (const dir of listBundledSkillDirs()) {
      expect(fs.existsSync(path.join(dir, '_lib', 'browse-client.ts'))).toBe(true);
    }
  });

  test('each bundled skill has a script.test.ts', () => {
    for (const dir of listBundledSkillDirs()) {
      expect(fs.existsSync(path.join(dir, 'script.test.ts'))).toBe(true);
    }
  });

  test("each bundled skill's _lib/browse-client.ts matches the canonical SDK", () => {
    // If the canonical SDK changes, the bundled copy must be updated. This
    // test enforces that — the _lib copy should be byte-identical.
    const canonical = fs.readFileSync(path.join(ROOT, 'browse', 'src', 'browse-client.ts'), 'utf-8');
    for (const dir of listBundledSkillDirs()) {
      const sibling = fs.readFileSync(path.join(dir, '_lib', 'browse-client.ts'), 'utf-8');
      expect(sibling).toBe(canonical);
    }
  });

  test('script.ts imports browse from ./_lib/browse-client', () => {
    for (const dir of listBundledSkillDirs()) {
      const content = fs.readFileSync(path.join(dir, 'script.ts'), 'utf-8');
      expect(content).toMatch(/from\s+['"]\.\/_lib\/browse-client['"]/);
    }
  });
});

// Token-reduction Phase 5: the four ios skills demoted from preamble-tier 3
// to 2 — they never consume the tier-3 sections (repo-mode ownership, search
// before building) but DO fire AskUserQuestion, which tier >=2 provides.
describe('ios tier demotion (Phase 5)', () => {
  const iosSkills = ['ios-fix', 'ios-clean', 'ios-sync', 'ios-design-review'];
  for (const skill of iosSkills) {
    test(`${skill} render drops tier-3 sections, keeps AUQ format`, () => {
      const content = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect(content).not.toContain('## Repo Ownership');
      expect(content).not.toContain('## Search Before Building');
      expect(content).toContain('## AskUserQuestion Format');
    });
  }
});
