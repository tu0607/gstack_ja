import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { generateReviewDashboard } from '../scripts/resolvers/review-dashboard';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { ALL_HOST_CONFIGS } from '../hosts';
import { expectMentions } from './helpers/prompt-structure';

/**
 * Template-drift tripwire for the content-binding wave. The bins are
 * code-enforced; the GRADING rules live as prose in rendered templates that
 * agents follow. This test pins the load-bearing rule text in the GENERATED
 * files so a template refactor can't silently drop a rule while the bins keep
 * working. (Prompt-followed prose is honest tier-2 enforcement — this tripwire
 * is what keeps it from being tier-3 vibes.)
 */

const ROOT = path.resolve(import.meta.dir, '..');

function rendered(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('content-binding template drift', () => {
  test('design-lite records outside coverage after the outside step in ship', () => {
    const text = rendered('ship/sections/review-army.md');
    const outside = text.indexOf('Codex デザインボイス**');
    expect(outside).toBeGreaterThan(-1);
    expect(text.indexOf('--finish DESIGN_START')).toBeGreaterThan(outside);
    expectMentions(text.replace(/\s+/g, ' '), [['DESIGN_START', '最初', 'トークン']], 'review-army');
  });

  test('ship eval selection scopes the Rails example below the project-native path', () => {
    const text = rendered('ship/sections/tests.md');
    const native = text.indexOf('**プロジェクト固有の方法:**');
    const rails = text.indexOf('**Rails の例のみ');
    expect(native).toBeGreaterThan(-1);
    expect(rails).toBeGreaterThan(native);
    expect(text).not.toContain('**If no matches:**');
    expect(text).toContain('**eval が 1 つでも失敗した場合:**');
  });

  test('ship historical readiness does not replace the current pre-landing gate', () => {
    const text = rendered('ship/SKILL.md');
    expectMentions(text.replace(/\s+/g, ' '), [['Step 9', '承認', '収束', 'スキップ']], 'text');
  });

  test('ship Step 16 carries the evidence check (mechanized IRON LAW)', () => {
    const ship = rendered('ship/SKILL.md');
    expect(ship).toMatch(/gstack-evidence check --label tests --expect-cmd '[^']+' --label vitest --expect-cmd '[^']+' --max-age 24 --allow-paths CHANGELOG\.md,VERSION,package\.json/);
    expect(ship.replace(/\s+/g, ' ')).toMatch(/\| STALE\/MISSING: [^|]+ \| `~\/\.claude\/skills\/gstack\/bin\/gstack-evidence run --label <lane> -- '<command>'` を実行/);
    expectMentions(ship.replace(/\s+/g, ' '), [['Step 5–15', 'Step 16', '段階 1']], 'ship');
  });

  test('ship Step 5 lanes run wrapped with per-lane labels', () => {
    const tests = rendered('ship/sections/tests.md');
    expect(tests).toContain('gstack-evidence run --label tests');
    expect(tests).toContain('gstack-evidence run --label vitest');
  });

  test('land-and-deploy grades staleness content-first (wtree rule) and checks evidence', () => {
    // Carved (prompt-token-load-reduction): Step 3.5 moved out of the skeleton
    // into the on-demand readiness-gate section — the grading rules live there.
    const land = rendered('land-and-deploy/sections/readiness-gate.md');
    expect(land).toContain('wtree');
    expect(land).toContain('---WTREE---');
    expect(land).toContain('gstack-evidence check --label tests --expect-cmd "$TEST_COMMAND" --max-age 24');
    expect(land).toContain('gstack-evidence run --label tests -- "$TEST_COMMAND"');
    expect(land).toContain('UNKNOWN');
  });

  test('the review dashboard staleness rule is wtree-first for diff-scoped rows', () => {
    // The dashboard text is generated into every skill that embeds
    // {{REVIEW_DASHBOARD}}; ship is the canonical carrier.
    const ship = rendered('ship/SKILL.md');
    expect(ship).toContain('---WTREE---');
    expect(ship).toContain('内容優先のルール');
    expectMentions(ship.replace(/\s+/g, ' '), [['コマンド', '失敗', 'UNKNOWN', '古い']], 'ship');
  });

  test('the diff-scoped row list is IDENTICAL in both grading surfaces (no drift)', () => {
    // The resolver (dashboard) and land-and-deploy each carry the row list;
    // they diverged once (codex-review present in one, missing in the other).
    // Rendered dashboards escape backticks (template-literal origin), so match
    // structurally: the three row names in order inside the rule sentence.
    const rowList = /内容優先のルール[\s\S]{0,80}?`review`[\s\S]{0,80}?`adversarial-review`[\s\S]{0,80}?`codex-review`[\s\S]{0,80}?ship 段階の(?:エントリ|レビュー)[\s\S]{0,80}?`design-review-lite`/;
    expect(rendered('ship/SKILL.md')).toMatch(rowList);
    // land-and-deploy's copy of the row list lives in the carved readiness-gate
    // section (Step 3.5a), not the skeleton.
    expect(rendered('land-and-deploy/sections/readiness-gate.md')).toMatch(rowList);
  });

  test('both grading surfaces reject missing capture instead of falling back to HEAD', () => {
    for (const file of ['ship/SKILL.md', 'land-and-deploy/sections/readiness-gate.md']) {
      const text = rendered(file);
      expect(text).toContain('review_freshness');
      expect(text).toContain('UNVERIFIED');
      const flat = text.replace(/\s+/g, ' ');
      expectMentions(flat, [['フォールバック'], ['HEAD', '0']], file);
      expect(flat).toMatch(/プランレコード|プランレベル/);
    }
  });

  test('diff callers capture before reading and consume the original token', () => {
    const review = rendered('review/SKILL.md');
    expect(review).toContain('gstack-review-log --start review\ngit diff "$DIFF_BASE"');
    expect(review).toContain('--finish REVIEW_START');
    expect(review).toContain('"completed":COMPLETED,"converged":CONVERGED,"cycles":CYCLES');
    const army = rendered('ship/sections/review-army.md');
    expect(army.indexOf('gstack-review-log --start review')).toBeLessThan(army.indexOf('`git diff origin/<base>`'));
    expect(army).toContain('--finish REVIEW_START');
    expectMentions(army.replace(/\s+/g, ' '), [['項目 5–6', '元の REVIEW_START', '1 回']], 'army');
    expectMentions(army.replace(/\s+/g, ' '), [['修正', '`converged:false`', '必要']], 'army');
    const ship = rendered('ship/SKILL.md');
    expectMentions(army.replace(/\s+/g, ' '), [['`CYCLES >= 3`', '`converged:false`'], ['4 回目', '実行しない']], 'army');
    expectMentions(ship.replace(/\s+/g, ' '), [['承認', '拡張']], 'ship.replace(/\s+/g,  )');
    expect(army).toContain('--start design-review-lite');
    expect(army).toContain('--finish DESIGN_START');
    const codex = rendered('codex/sections/review-mode.md');
    const starts = [...codex.matchAll(/gstack-review-log --start codex-review/g)];
    expect(starts).toHaveLength(2);
    const nativeReview = codex.indexOf(`run-with-timeout --user-invoked --effort high --request-effort '<effort-level>' 330 codex review`);
    expect(nativeReview).toBeGreaterThan(-1);
    expect(starts[0].index).toBeLessThan(nativeReview);
    expect(starts[1].index).toBeLessThan(codex.indexOf('git diff "<base>...HEAD"'));
    expect(codex).toContain('--finish CODEX_REVIEW_START');
    expect(codex).toContain('"completed":COMPLETED,"converged":CONVERGED');
    expectMentions(codex, [['再実行', 'トークン']], 'codex');
    for (const skill of ['ship', 'review']) {
      const adversarial = rendered(`${skill}/sections/adversarial.md`);
      expect(adversarial).toContain('--start adversarial-review');
      expect(adversarial).toContain('--finish PASS_START');
      expectMentions(adversarial.replace(/\s+/g, ' '), [['diff を読む前', '敵対的', '構造化']], 'adversarial.replace(/\s+/g,  )');
      expectMentions(adversarial.replace(/\s+/g, ' '), [['トークン', '一度']], 'adversarial');
    }
  });

  test('dashboard selection and freshness precede a verdict without replacing the live ship gate', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const text = generateReviewDashboard({ host: host.name, skillName: 'ship',
        tmplPath: 'ship/SKILL.md.tmpl', paths: HOST_PATHS[host.name] }).replace(/\s+/g, ' ');
      const positions = ['**1. ', '**2. ', '**3. ', '**4. '].map(marker => text.indexOf(marker));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
      expectMentions(text, [['CLEARED', '`clean`', '7 日', '鮮度']], 'text');
      expectMentions(text, [['STALE', 'UNVERIFIED', 'CLEAR']], 'text');
      expectMentions(text, [['`review_freshness`', 'UNVERIFIED']], 'text');
      expectMentions(text, [['Step 9', '承認', '収束', 'スキップ']], 'text');
      expectMentions(text, [['NOT CLEARED', 'Step 1', '続行']], 'text');
    }
  });

  test('release-body write side carries the banner tripwire (and it actually fires)', () => {
    const body = rendered('document-release/sections/release-body.md');
    expect(body).toContain('grep -c "UNTRUSTED TRACKER CONTENT" "<run-dir>/body.md"');
    expect(body).toContain('grep -c "UNTRUSTED TRACKER CONTENT" "<run-dir>/body-original.md"');
    // The fail-open shape: grep -c prints 0 AND exits 1 on no-match, so an
    // `|| echo 0` double-emits and breaks the -gt into the clean branch.
    expect(body).not.toContain('|| echo 0');
    expect(body).toContain('banner tripwire clean');

    // Functional: execute the template's tripwire block against a 0-banner
    // original and a 1-banner outgoing body — the ABORT branch must fire.
    //
    // Pass the script as an ARGV element (spawnSync array form), never by
    // interpolating JSON.stringify into a shell line: JSON escaping is not
    // shell escaping. Inside shell double quotes a JSON "\n" stays a literal
    // backslash-n, which collapsed this multi-line script onto one line where
    // `then\n` became the command word `thenn` and `>&2\nelse\n` became the
    // redirect `>&2nelsen` — silently littering a `2nelsen` file (containing
    // "bash: thenn: command not found") in the repo root on every suite run,
    // while the old not-contains assertion passed vacuously because ALL
    // output had been redirected into that file.
    const block = body.match(/_ORIG_BANNERS=\$\(grep[\s\S]*?fi\n/);
    expect(block).not.toBeNull();
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const { spawnSync } = require('child_process');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-banner-'));
    try {
      const scriptFor = (origContent: string, newContent: string) => {
        fs.writeFileSync(path.join(dir, 'orig.md'), origContent);
        fs.writeFileSync(path.join(dir, 'new.md'), newContent);
        return block![0]
          .replaceAll('<run-dir>/body-original.md', path.join(dir, 'orig.md'))
          .replaceAll('<run-dir>/body.md', path.join(dir, 'new.md'));
      };

      // Banner leaked into the outgoing body → the ABORT branch fires, loudly.
      const abort = spawnSync('bash', ['-c', scriptFor(
        'clean body\n',
        'body with UNTRUSTED TRACKER CONTENT banner leak\n',
      )], { encoding: 'utf-8', timeout: 30_000 });
      expect(abort.stderr).toContain('ABORT: envelope banner leaked');
      expect(abort.stdout).not.toContain('banner tripwire clean');

      // No banner delta → the clean branch fires.
      const clean = spawnSync('bash', ['-c', scriptFor(
        'clean body\n',
        'also clean body\n',
      )], { encoding: 'utf-8', timeout: 30_000 });
      expect(clean.stdout).toContain('banner tripwire clean');
      expect(clean.stderr).not.toContain('ABORT');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test('greptile triage reads bodies through the guard (metadata/body split)', () => {
    const triage = rendered('review/greptile-triage.md');
    expect(triage).toContain('gstack-issue-guard --stdin --source greptile-line');
    expect(triage).toContain('gstack-issue-guard --stdin --source greptile-replies');
  });
});
