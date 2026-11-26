import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { ACCEPTANCE_EDITED, generatePlanCompletionAuditReview, generatePlanCompletionAuditShip, generatePlanCompletionGateShip, generatePlanVerificationExec } from '../scripts/resolvers/plan-gates';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { between, expectAbsent, expectMentions, expectOrdered, expectTokens } from './helpers/prompt-structure';

const SHIP_DIR = path.join(__dirname, '..', 'ship');

describe('authored ship-only plan verification handoff', () => {
  const ctx = { skillName: 'ship', tmplPath: 'ship/SKILL.md.tmpl', host: 'claude' as const, paths: HOST_PATHS.claude };
  test('local execution-only checks remain required in Step 8.1/9 outside implementation counts', () => {
    const audit = generatePlanCompletionAuditShip(ctx);
    const extraction = audit.slice(audit.indexOf('### Actionable Item Extraction'), audit.indexOf('### Verification Mode')).replace(/\s+/g, ' ');
    expect(extraction).toContain('実行のみの検証');
    expect(extraction).toContain('Step 8.1/9');
    expectMentions(extraction, [['実装の件数には含めません']], 'extraction');
    expectMentions(extraction, [['静的な確認だけで DONE にしてはならず']], 'extraction');
    expectMentions(extraction, [['それらのチェックが免除されることはありません']], 'extraction');
    expect(fs.readFileSync(path.join(SHIP_DIR, 'sections/plan-completion.md.tmpl'), 'utf8')).toContain('exactly these seven fields');
    const gate = generatePlanCompletionGateShip(ctx);
    expect(gate).toContain('**NOT DONE の項目がある場合**');
    expect(gate).toContain('項目ごとの確認は必須です');
  });
  test('review-mode extraction retains its existing categories and has no ship-only routing', () => {
    const audit = generatePlanCompletionAuditReview({ ...ctx, skillName: 'review' });
    expect(audit).toContain('**テストの要件:**');
    expect(audit).not.toContain('実行のみの検証');
    expect(audit).not.toContain('Step 8.1/9');
    expect(audit).toContain('EXTERNAL-STATE');
  });
  test('preparation hands every explicit check to the report-only execution owner before Fix-First', () => {
    const text = generatePlanVerificationExec(ctx).replace(/\s+/g, ' ');
    expectMentions(text, [['収集は今', '実行は Step 9 で行います']], 'text');
    expectMentions(text, [['QA スキル全体を呼び出したり', 'プローブを開始したりしてはいけません']], 'text');
    for (const heading of ['Verification', 'Test plan', 'Testing', 'How to test', 'Manual testing']) {
      expect(text).toContain(`\`${heading}\``);
    }
    expect(text).toContain('Step 8.2');
    expect(text).toContain('Step 9.2.1 への引き継ぎ');
    expectMentions(text, [['Fix-First の前に'], ['黙って免除してはいけません'], ['非対話の実行では', 'ブロックされたものとして返します']], 'text');
    expectMentions(text, [['VERIFY_RESULT', 'pass', 'skipped', 'fail', '選択したすべての項目が合格した場合にのみ']], 'text');
    expect(text).toContain('`## Verification Results`');
    expect(text.indexOf('収集は今')).toBeLessThan(text.indexOf('Step 9.2.1 への引き継ぎ'));
    expect(text.indexOf('Step 9.2.1 への引き継ぎ')).toBeLessThan(text.indexOf('実行後、'));
  });
  test('the authored parent validates all seven fields and settles failed children before fallback', () => {
    const audit = fs.readFileSync(path.join(SHIP_DIR, 'sections/plan-completion.md.tmpl'), 'utf8');
    const parent = audit.slice(audit.indexOf('**親による処理:**')).replace(/\s+/g, ' ');
    expectMentions(parent, [['最後の行の JSON が有効でなければ', '監査失敗のフォールバックを使います']], 'parent');
    expectMentions(parent, [['宣言された 7 つのフィールドがちょうど揃っている']], 'parent');
    expectMentions(parent, [['分類の合計が `total_items` と等しい']], 'parent');
    expectMentions(parent, [['文字列の `summary`']], 'parent');
    expectMentions(parent, [['計画がない、または実行可能な項目がない有効な報告は', '件数をゼロのまま']], 'parent');
    expect(parent).toContain('約 10 分');
    expectMentions(parent, [['稼働中の子プロセスを停止し', '停止したことを確認してから']], 'parent');
    expectMentions(parent, [['遅れて届いた結果と競合させてはいけません']], 'parent');
    expectMentions(parent, [['B) 停止して監査を修正する', '推奨/既定']], 'parent');
    const contract = audit.split('\n').find(line => line.startsWith('{"total_items":N,'))!;
    expect(Object.keys(JSON.parse(contract.replace(/:N([,}])/g, ':0$1'))).sort())
      .toEqual(['total_items', 'done', 'changed', 'partial', 'not_done', 'unverifiable', 'summary'].sort());
    expect(generatePlanCompletionGateShip(ctx)).toContain('**PARTIAL の項目のみ(NOT DONE も UNVERIFIABLE もない):**');
    expectMentions(generatePlanCompletionGateShip(ctx), [['ブロックはしません']], 'gate');
  });
});

// Carved (v2 plan T9): the Plan Completion gate moved into sections/plan-completion.md.
// Read the skeleton + sections union so these invariants follow the content.
function readShipUnion(): string {
  let t = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md'), 'utf8');
  const secDir = path.join(SHIP_DIR, 'sections');
  if (fs.existsSync(secDir)) {
    for (const f of fs.readdirSync(secDir).sort()) {
      if (f.endsWith('.md')) t += '\n' + fs.readFileSync(path.join(secDir, f), 'utf8');
    }
  }
  return t;
}

describe('ship/SKILL.md — Plan Completion gate invariants', () => {
  const skill = readShipUnion();

  test('Path concreteness rule: filesystem-pathed items must be test -f checked', () => {
    expect(skill).toContain('**Path concreteness rule');
    expectMentions(skill, [['具体的なファイルシステムのパス', '`[ -f <path> ]`', 'DONE か NOT DONE']], 'skill');
  });

  test('Validator detection: project package.json validate-* scripts are auto-run', () => {
    expect(skill).toContain('**Validator detection');
    expect(skill).toMatch(/package\.json/);
    expect(skill).toMatch(/validate-\*/);
  });

  test('Per-item UNVERIFIABLE confirmation: blanket-confirm is forbidden', () => {
    expect(skill).toContain('項目ごとの確認は必須です');
    expectMentions(skill, [['1 回の AskUserQuestion でまとめて確認してはいけません']], 'skill');
  });

  test('Subagent failure: fail-closed, not silent fail-open', () => {
    expect(skill).not.toMatch(/block \/ship on subagent failure/i);
    // The audit-failure fallback still forbids a silent fail-open (meaning, not the old incident ID).
    const fallback = skill.slice(skill.indexOf('**監査失敗のフォールバック:**'), skill.indexOf('**監査失敗のフォールバック:**') + 800);
    expectMentions(fallback, [['失敗を黙って見過ごしてはいけません']], 'fallback');
    expectMentions(skill, [['B) 停止して監査を修正する']], 'skill');
  });

  test('parent rejects audit errors and malformed counts instead of treating them as no plan', () => {
    const audit = fs.readFileSync(path.join(SHIP_DIR, 'sections/plan-completion.md'), 'utf8');
    expect(audit.indexOf('**親による処理:**')).toBeGreaterThan(-1);
    expect(audit.indexOf('**親による処理:**')).toBeLessThan(audit.indexOf('**監査失敗のフォールバック:**'));
    const parent = audit.slice(audit.indexOf('**親による処理:**'), audit.indexOf('**監査失敗のフォールバック:**')).replace(/\s+/g, ' ');
    expectMentions(parent, [['宣言された 7 つのフィールド'], ['監査失敗のフォールバック']], 'parent');
  });

  test('successful plan audits use the declared seven-field contract without an error field', () => {
    const audit = fs.readFileSync(path.join(SHIP_DIR, 'sections/plan-completion.md'), 'utf8');
    const line = audit.split('\n').find(line => line.startsWith('{"total_items":N,'));
    expect(line).toBeDefined();
    const contract = JSON.parse(line!.replace(/:N([,}])/g, ':0$1'));
    expect(Object.keys(contract).sort()).toEqual(['total_items', 'done', 'changed', 'partial', 'not_done', 'unverifiable', 'summary'].sort());
    expect(contract).not.toHaveProperty('error');
    expect(audit).toContain('exactly these seven fields on the LAST LINE');
    expect(audit).not.toContain('A non-null `error`');
  });

  test('CONTENT-SHAPE dispatch invokes validator before falling back to UNVERIFIABLE', () => {
    expect(skill).toMatch(/別のリポジトリにある CONTENT-SHAPE[\s\S]*バリデーター/);
    expectMentions(skill, [['バリデーターに合格すれば', 'UNVERIFIABLE から DONE に格上げされ']], 'skill');
  });

  test('approved deferrals reach Step 14 without duplicating earlier P0 entries', () => {
    const entry = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md'), 'utf8');
    const todos = entry.slice(entry.indexOf('## Step 14:'), entry.indexOf('## Step 15:'));
    expect(todos).toContain('**3. 承認された保留を追加する:**');
    expect(todos).toMatch(/Step 2[^\n]+P1/);
    expect(todos).toMatch(/Step 8[^\n]+P1[^\n]+plan/);
    expect(todos).toMatch(/Step 5[^\n]+P0[^\n]+重複を除き/);
    expect(todos.indexOf('**3. 承認された保留を追加する:**')).toBeLessThan(todos.indexOf('**4. 完了した TODO の検出:**'));
  });

  test('CHANGELOG uses the normal workflow without checkpoint context or squash prerequisites', () => {
    const changelog = fs.readFileSync(path.join(SHIP_DIR, 'sections/changelog.md'), 'utf8');
    expect(changelog).toContain('**すべてのグループを網羅する CHANGELOG エントリを書きます:**');
    expect(changelog).not.toMatch(/WIP:|gstack-context|checkpoint|squash|Step 15\.0/);
  });

  test('live evidence recovery distinguishes bookkeeping failure from stale inputs', () => {
    const entry = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md'), 'utf8');
    const gate = entry.slice(entry.indexOf('## Step 16:'), entry.indexOf('## Step 17:'));
    const text = gate.replace(/\s+/g, ' ');
    expect(text).toContain('STALE/MISSING');
    expect(text).toContain('| レシートの保存/読み戻しだけが失敗した |');
    expectMentions(text, [['**ledger unavailable**', 'FRESH とは決して書かない']], 'text');
    const storage = text.slice(text.indexOf('| レシートの保存/読み戻しだけが失敗した |')).split('|')[2];
    expect(storage).not.toContain('gstack-evidence run');
    expectMentions(storage, [['その証明がなければ STALE/MISSING を使う']], 'storage');
    expectMentions(text, [['新規、変更された、または免除されていないテストの失敗', '公開を停止します'], ['Step 5–15 を実行し']], 'text');
    expectMentions(text, [['検証済みの既存の失敗', '承認済みのスコープ', 'のみ再利用します']], 'text');
    expectMentions(text, [['証拠は STALE になります']], 'text');
  });

  test('ship contract precedes base detection and fresh remote facts precede distribution decisions', () => {
    const entry = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md'), 'utf8');
    expect(entry.indexOf('# Ship:')).toBeLessThan(entry.indexOf('## Step 0:'));
    const preflight = entry.slice(entry.indexOf('## Step 1:'), entry.indexOf('## Step 2:'));
    expect(preflight).toContain('git fetch origin <base>');
    expectMentions(preflight, [['fetch が失敗した場合は STOP し']], 'preflight');
    expect(entry).not.toContain('auto-generate and commit, or flag');
    expectMentions(entry, [['Step 15 でそれらのテストをコミットします']], 'entry');
  });

  test('bisectable commits proceed directly to verification without rewriting existing history', () => {
    const entry = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md'), 'utf8');
    const commit = entry.slice(entry.indexOf('## Step 15:'), entry.indexOf('## Step 16:'));
    expectMentions(commit, [['二分探索しやすいコミット']], 'commit');
    expectMentions(commit, [['Step 16 に進みます']], 'commit');
    expectMentions(commit, [['空のコミットは決して作らないでください']], 'commit');
    expect(commit).not.toMatch(/checkpoint|WIP|squash|git rebase|git reset/);
    expect(entry).not.toMatch(/Step 15\.[012]/);
  });

  test('a rejected push stops publication and routes changed content back through verification', () => {
    const entry = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md'), 'utf8');
    const push = entry.slice(entry.indexOf('## Step 17:'), entry.indexOf('## Step 20:'));
    const recovery = push.replace(/\s+/g, ' ');
    expectMentions(push, [['push が失敗した場合は', 'STOP します']], 'push');
    expect(recovery).toContain('**Non-fast-forward の push:**');
    expectMentions(recovery, [['Step 17 に戻る前に', 'Step 5–16 を実行します']], 'recovery');
    expectMentions(recovery, [['履歴は決して書き換えないでください']], 'recovery');
    expect(recovery).toContain('**認証、フック、またはネットワークの失敗:**');
    expectMentions(push, [['force push は決してしないでください']], 'push');
    expectMentions(push, [['成功した push か', '`ALREADY_PUSHED`', '進みます']], 'push');
  });
});

test('push idempotency requires the live remote SHA and fails closed on transport errors', () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ship-push-state-'));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' };
  const git = (...args: string[]) => {
    const r = spawnSync('git', args, { cwd, env, encoding: 'utf8', timeout: 30_000 });
    if (r.status !== 0) throw new Error(r.stderr || String(r.error));
  };
  try {
    git('init', '-b', 'feature');
    fs.writeFileSync(path.join(cwd, 'app'), 'base\n');
    git('add', 'app'); git('commit', '-m', 'base');
    const remote = path.join(cwd, '.git/remote.git');
    git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
    const source = fs.readFileSync(path.join(SHIP_DIR, 'SKILL.md.tmpl'), 'utf8');
    const block = source.slice(source.indexOf('**冪等性の確認:** ブランチがすでに'))
      .match(/```bash\n([\s\S]*?)\n```/)![1].replaceAll('<branch-name>', 'feature');
    const inspect = () => {
      const r = spawnSync('bash', ['-c', block], { cwd, env, encoding: 'utf8', timeout: 30_000 });
      if (r.error) throw new Error(`idempotency check did not run: ${r.error.message}; stderr: ${r.stderr}`);
      return r;
    };
    expect(inspect().stdout).toContain('PUSH_NEEDED');
    git('push', '-u', 'origin', 'feature');
    expect(inspect().stdout).toContain('ALREADY_PUSHED');
    fs.appendFileSync(path.join(cwd, 'app'), 'new\n'); git('commit', '-am', 'new');
    expect(inspect().stdout).toContain('PUSH_NEEDED');
    git('push', 'origin', 'feature');
    fs.renameSync(remote, remote + '-offline');
    const unavailable = inspect();
    expect(unavailable.status).toBe(1);
    expect(unavailable.stdout).not.toContain('ALREADY_PUSHED');
    expect(unavailable.stdout).toContain('BLOCKED');
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}, 120_000);

// F1 (#2768, #2800): the Plan Completion Audit used to fall back to "the newest
// plan file from the last day" and to any plan naming the repo, so a branch
// with no plan was audited against an unrelated one, and repo-committed
// docs/designs/ was never searched. The rendered discovery block now binds
// explicitly, lists docs/designs/ candidates, and never auto-picks.
describe('F1: plan binding, docs/designs candidates, exact not-run line', () => {
  const ROOT = path.join(__dirname, '..');
  const NOT_RUN = 'Plan completion audit: not run (no plan is bound to this branch and no docs/designs/ file matches). Fix: add "Plan: <path>" to the PR body, or run /autoplan.';
  const sections = {
    ship: path.join(ROOT, 'ship', 'sections', 'plan-completion.md'),
    review: path.join(ROOT, 'review', 'sections', 'plan-completion.md'),
  };

  function discovery(file: string): string {
    const md = fs.readFileSync(file, 'utf8');
    return md.slice(md.indexOf('### Plan File Discovery')).match(/```bash\n([\s\S]*?)```/)![1]
      .replaceAll('~/.claude/skills/gstack', ROOT).replaceAll('<base>', 'main');
  }

  function fixture(opts: { design?: boolean; prBody?: string }) {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'plan-bind-')));
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo);
    const env = { ...process.env, HOME: tmp, GSTACK_HOME: path.join(tmp, '.gstack'), GIT_CONFIG_GLOBAL: '/dev/null', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } as Record<string, string>;
    delete env.GSTACK_STATE_ROOT; delete env.GSTACK_PROJECT_SLUG;
    const git = (...a: string[]) => spawnSync('git', a, { cwd: repo, env, encoding: 'utf8', timeout: 30_000 });
    git('init', '-q', '-b', 'main');
    fs.mkdirSync(path.join(repo, 'docs', 'designs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'designs', 'OLD_FEATURE.md'), '# an older, unrelated design\n');
    git('add', '-A'); git('commit', '-qm', 'base');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('checkout', '-qb', 'feat-pricing');
    fs.writeFileSync(path.join(repo, 'src.ts'), 'x\n');
    if (opts.design) fs.writeFileSync(path.join(repo, 'docs', 'designs', 'PRICING.md'), '# pricing plan\n');
    git('add', '-A'); git('commit', '-qm', 'work');
    // An unrelated plan-mode file from today, naming neither branch nor feature.
    fs.mkdirSync(path.join(tmp, '.claude', 'plans'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.claude', 'plans', 'recent-unrelated.md'), '# refactor the billing page for repo\n');
    const bin = path.join(tmp, 'bin');
    fs.mkdirSync(bin);
    if (opts.prBody !== undefined) fs.writeFileSync(path.join(tmp, 'pr-body.txt'), opts.prBody);
    fs.writeFileSync(path.join(bin, 'gh'), opts.prBody === undefined ? '#!/bin/sh\nexit 1\n' : `#!/bin/sh\ncat '${path.join(tmp, 'pr-body.txt')}'\n`, { mode: 0o755 });
    env.PATH = `${bin}:${process.env.PATH}`;
    return { tmp, repo, env };
  }

  function run(which: 'ship' | 'review', f: ReturnType<typeof fixture>) {
    return spawnSync('bash', ['-c', discovery(sections[which])], { cwd: f.repo, env: f.env, encoding: 'utf8', timeout: 30_000 });
  }

  for (const which of ['ship', 'review'] as const) {
    test(`${which}: a docs/designs file changed on this branch is a candidate; an unrelated recent plan is not`, () => {
      const f = fixture({ design: true });
      try {
        const out = run(which, f).stdout;
        expect(out).toContain(`PLAN_CANDIDATE: ${path.join(f.repo, 'docs', 'designs', 'PRICING.md')}`);
        expect(out).not.toContain('OLD_FEATURE.md');
        expect(out).not.toContain('recent-unrelated.md');
        expect(out).not.toContain('PLAN_FILE:');
      } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
    });

    test(`${which}: nothing bound and nothing matching yields no plan at all`, () => {
      const f = fixture({});
      try {
        const out = run(which, f).stdout;
        expect(out).not.toContain('PLAN_CANDIDATE:');
        expect(out).not.toContain('PLAN_FILE:');
        expect(out).not.toContain('recent-unrelated.md');
      } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
    });

    test(`${which}: a "Plan:" line in the PR body is printed as the binding`, () => {
      const f = fixture({ prBody: 'Summary\n\nPlan: `docs/designs/PRICING.md`\n' });
      try {
        expect(run(which, f).stdout).toContain('PLAN_BINDING: docs/designs/PRICING.md');
      } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
    });

    test(`${which}: binding precedence and the exact not-run line`, () => {
      const md = fs.readFileSync(sections[which], 'utf8');
      const text = md.slice(md.indexOf('### Plan File Discovery')).replace(/\s+/g, ' ');
      expect(text).toContain(NOT_RUN);
      const order = ['会話の文脈(最優先)', 'PR 本文での紐づけ', '内容に基づく検索(フォールバック)', '紐づけも選ばれた候補もない場合'];
      const at = order.map(o => text.indexOf(o));
      expect(at.every(i => i >= 0)).toBe(true);
      expect([...at].sort((a, b) => a - b)).toEqual(at);
      expectMentions(text, [['黙って 1 つを選んではいけません']], 'binding discovery');
      expect(text).toContain('プランなし: 監査をスキップする');
    });
  }

  test('ship binds the plan in the parent before dispatch; the child never searches', () => {
    const md = fs.readFileSync(sections.ship, 'utf8');
    expect(md.indexOf('### Plan File Discovery')).toBeLessThan(md.indexOf('````text'));
    const child = md.slice(md.indexOf('````text'), md.lastIndexOf('````'));
    expect(child).not.toContain('### Plan File Discovery');
    expectMentions(child, [['別のプランを探してはいけません']], 'child');
    expectMentions(md, [['未実行の行を出力した場合は', 'dispatch をスキップします']], 'md');
  });
});

// RH-10 (docs/designs/HONEST_WORK_GATE_INTEGRITY.md W5): editing the plan's acceptance
// text is not progress. The parent diffs the acceptance-bearing sections of the
// working-tree plan against a baseline and reports ACCEPTANCE_EDITED beside the
// child's classes; the child's seven-field contract is untouched.
describe('ACCEPTANCE_EDITED: parent-computed acceptance-text drift', () => {
  const ctx = { skillName: 'ship', tmplPath: 'ship/SKILL.md.tmpl', host: 'claude' as const, paths: HOST_PATHS.claude };
  const rendered = fs.readFileSync(path.join(SHIP_DIR, 'sections', 'plan-completion.md'), 'utf8');

  test('the check renders through the :acceptance arg with the baseline order and the never-CHANGED rule', () => {
    const text = generatePlanCompletionGateShip(ctx, ['acceptance']);
    expect(text).toStartWith('### Acceptance edits (parent-computed)');
    expectOrdered(text, ['origin/<base>', '最初のコミット', 'baseline unavailable'], 'baseline order');
    expectTokens(text, ['ACCEPTANCE_BASELINE: unavailable', `${ACCEPTANCE_EDITED}: none`, `${ACCEPTANCE_EDITED}: yes`, `[${ACCEPTANCE_EDITED}]`, 'Acceptance edits: baseline unavailable', '## Plan Completion'], 'acceptance check');
    expectMentions(text, [['CHANGED にまとめてはいけません'], ['元の義務は引き続き監査します'], ['プランを導入したのと同じコミットで', '検出できません']], 'acceptance check');
    const gate = generatePlanCompletionGateShip(ctx);
    expect(gate).toContain(`**${ACCEPTANCE_EDITED} の項目**`);
    expectMentions(gate, [['CHANGED として数えられることは', '決してありません']], 'gate');
    expect(gate).toContain('`Acceptance edits:` の行');
  });

  test('the template runs it in the parent after the child reports, before Gate Logic, outside the child prompt', () => {
    const parent = between(rendered, '**親による処理:**', '**監査失敗のフォールバック:**');
    expectOrdered(parent, ['1. タスクの終了ステータスを確認します', `\`${ACCEPTANCE_EDITED}\` を追加します`, '下のゲートロジックを適用します', '### Acceptance edits (parent-computed)'], 'parent processing');
    expect(rendered.indexOf('### Acceptance edits (parent-computed)')).toBeLessThan(rendered.indexOf('### Gate Logic'));
    expectAbsent(between(rendered, '````text', '````\n\n**親による処理:**'), [ACCEPTANCE_EDITED], 'child prompt');
    const contract = rendered.split('\n').find(line => line.startsWith('{"total_items":N,'))!;
    expect(Object.keys(JSON.parse(contract.replace(/:N([,}])/g, ':0$1')))).toHaveLength(7);
  });

  function block(planPath: string): string {
    return between(rendered, '### Acceptance edits (parent-computed)', '### Gate Logic').match(/```bash\n([\s\S]*?)```/)![1]
      .replaceAll('<plan-path>', planPath).replaceAll('<base>', 'main');
  }

  function repo() {
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'acceptance-edited-')));
    const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t.invalid', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t.invalid' };
    const git = (...args: string[]) => {
      const r = spawnSync('git', args, { cwd: tmp, env, encoding: 'utf8', timeout: 30_000 });
      if (r.status !== 0) throw new Error(r.stderr);
      return r.stdout.trim();
    };
    const run = (planPath: string) => spawnSync('bash', ['-c', block(planPath)], { cwd: tmp, env, encoding: 'utf8', timeout: 30_000 });
    const plan = (criteria: string, context = 'the old context') => `# Plan\n\n## Context\n\n${context}\n\n## Acceptance Criteria\n\n${criteria}\n\n## Rollback\n\nrevert\n`;
    git('init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(tmp, 'README.md'), 'base\n');
    git('add', '-A'); git('commit', '-qm', 'base');
    return { tmp, git, run, plan };
  }

  test('a plan on origin/<base>: an acceptance edit in the working tree is yes with the diff; a context-only edit is none', () => {
    const f = repo();
    try {
      fs.mkdirSync(path.join(f.tmp, 'docs/designs'), { recursive: true });
      const file = path.join(f.tmp, 'docs/designs/PLAN.md');
      fs.writeFileSync(file, f.plan('1. Orders older than 30 days return HTTP 410 for all 4 user roles'));
      f.git('add', '-A'); f.git('commit', '-qm', 'plan');
      f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      f.git('checkout', '-qb', 'feature');
      fs.writeFileSync(file, f.plan('1. Orders older than 30 days return HTTP 410 for all 4 user roles', 'rewritten context'));
      const none = f.run(file);
      expect(none.status).toBe(0);
      expect(none.stdout).toContain('ACCEPTANCE_BASELINE: origin/main');
      expect(none.stdout).toContain(`${ACCEPTANCE_EDITED}: none`);
      fs.writeFileSync(file, f.plan('1. Orders older than 30 days return HTTP 410 for the admin role'));
      const yes = f.run(file);
      expect(yes.status).toBe(0);
      expect(yes.stdout).toContain(`${ACCEPTANCE_EDITED}: yes`);
      expect(yes.stdout).toContain('-1. Orders older than 30 days return HTTP 410 for all 4 user roles');
      expect(yes.stdout).toContain('+1. Orders older than 30 days return HTTP 410 for the admin role');
      expect(yes.stdout).not.toContain(`${ACCEPTANCE_EDITED}: none`);
    } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
  });

  test('a plan introduced on the branch uses its first commit as the baseline; an untracked plan is baseline unavailable', () => {
    const f = repo();
    try {
      f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      f.git('checkout', '-qb', 'feature');
      fs.mkdirSync(path.join(f.tmp, 'docs/designs'), { recursive: true });
      const file = path.join(f.tmp, 'docs/designs/PLAN.md');
      fs.writeFileSync(file, f.plan('1. Query time under 100ms'));
      f.git('add', '-A'); f.git('commit', '-qm', 'add plan');
      const first = f.git('rev-parse', 'HEAD');
      fs.writeFileSync(file, f.plan('1. Query time under 100ms\n2. Added later'));
      f.git('add', '-A'); f.git('commit', '-qm', 'edit plan');
      const out = f.run(file);
      expect(out.status).toBe(0);
      expect(out.stdout).toContain(`ACCEPTANCE_BASELINE: first commit on branch (${first})`);
      expect(out.stdout).toContain(`${ACCEPTANCE_EDITED}: yes`);
      expect(out.stdout).toContain('+2. Added later');
      const outside = path.join(f.tmp, 'outside-plan.md');
      fs.writeFileSync(outside, f.plan('1. anything'));
      const unavailable = f.run(outside);
      expect(unavailable.status).toBe(0);
      expect(unavailable.stdout).toContain('ACCEPTANCE_BASELINE: unavailable');
      expect(unavailable.stdout).not.toContain(`${ACCEPTANCE_EDITED}:`);
    } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
  });
});
