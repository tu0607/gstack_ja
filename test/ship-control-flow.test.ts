import { describe, expect, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ALL_HOST_CONFIGS } from '../hosts';
import { generateAdversarialStep } from '../scripts/resolvers/outside-voice-steps';
import { generatePlanCompletionGateShip } from '../scripts/resolvers/plan-gates';
import { generateReviewDashboard } from '../scripts/resolvers/review-dashboard';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { expectMentions, expectOrdered } from './helpers/prompt-structure';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const compact = (text: string) => text.replace(/\s+/g, ' ');
const entry = read('ship/SKILL.md.tmpl');
const start = entry.indexOf('### Ship の制御フロー');
const end = entry.indexOf('{{SECTION_INDEX:ship}}');
const controller = entry.slice(start, end);
const review = compact(read('ship/sections/review-army.md.tmpl'));
const adversarial = compact(generateAdversarialStep({ host: 'claude', skillName: 'ship', tmplPath: '', paths: HOST_PATHS.claude }));
const gate = compact(entry.slice(entry.indexOf('## Step 16:'), entry.indexOf('## Step 17:')));

describe('ship source controller', () => {
  test('documentation freshness covers selected code paths as well as release metadata', () => {
    const docs = compact(read('ship/sections/documentation.md.tmpl'));
    // Meaning: the snapshot hashes selected release (code) paths, not only release metadata.
    expectMentions(docs, [['リリースパス・生成された出力・docs のハッシュ']], 'docs');
    expectMentions(docs, [['`--select <path>`', 'リリースパスを絞り込めます']], 'docs');
    const freshness = gate.slice(gate.indexOf('### 3.'), gate.indexOf('### 4.'));
    expectMentions(freshness, [['以前の実行の監査', 'リスクに関する判断', '根拠にはなりません']], 'freshness');
  });

  test('changed documentation inputs permit only the remaining bounded re-audit', () => {
    const docs = compact(read('ship/sections/documentation.md.tmpl'));
    expect(docs.indexOf('## Blocked の復旧')).toBeGreaterThan(-1);
    expectMentions(docs, [['3 回目の試行は決して行いません']], 'docs');
    const freshness = gate.slice(gate.indexOf('### 3.'), gate.indexOf('### 4.'));
    expect(freshness).toContain('**試行回数が残っており、入力が変更されているか、利用可能な修復がある:**');
    expectMentions(freshness, [['**それ以外の場合:**', 'STOP', 'ユーザーが特定の名指しのドキュメントリスクを受け入れ']], 'freshness');
    expect(freshness).not.toContain('**No attempt remains or no repair is available:**');
  });

  test('repairs use one ordered work list without a return stack', () => {
    const text = compact(controller);
    expect(compact(entry)).toContain('**Next steps:**');
    expect(text).toContain('5 → 6 → 7 → 8 → 9 → 10 → 11 → 11.5');
    expectMentions(text, [['初回+1 回の上限はリセットされません']], 'controller');
  });

  test('the roadmap and recovery groups define ownership and zero-edit eligibility', () => {
    const text = compact(entry);
    expect(text).toContain('統合 (1–3) → テストとレビュー (4–11.5) → リリース準備 (12–15) → 凍結内容の検証 (16) → push と公開 (17–21)');
    expectMentions(text, [['子の出力は証拠であり', '進行の許可ではありません']], 'text');
    expect(review).toContain('**このパスで編集がない:**');
    expectMentions(review, [['それがクリアされた後にのみ Step 10 に進めます']], 'review');
    expectMentions(review, [['失敗または利用不可の必要なプローブは継続をブロックします']], 'review');
    expectMentions(review, [['独立したテスト/セキュリティのゲート', '免除できません']], 'review');
    expectMentions(text, [['承認が再設定されたり拡張されたりすることはありません']], 'text');
    expect(text).not.toContain('eligible zero-edit pass');
    expect(text).not.toContain('the same waiver');
    expect(text).not.toContain("the controller's detour");
  });

  test('distribution discovery is a shortlist, not a manifest-only artifact decision', () => {
    const distribution = compact(entry.slice(entry.indexOf('## Step 2:'), entry.indexOf('## Step 3:')));
    expect(distribution).toContain('**パイプラインのない新規成果物:**');
    expect(distribution).toContain('AskUserQuestion');
    expectMentions(distribution, [['`/ship` の実行中にリリースを公開しないでください']], 'distribution');
  });

  test('queue qualification exhaustively distinguishes online, git fallback and unusable output', () => {
    const version = compact(entry.slice(entry.indexOf('## Step 12:'), entry.indexOf('{{SECTION:changelog}}')));
    const qualify = version.indexOf('**最初に適格性を確認します:**');
    const usable = version.indexOf('**利用可能な候補あり:**');
    const missing = version.indexOf('**利用可能な候補なし:**');
    expect(qualify).toBeGreaterThan(0);
    expect(usable).toBeGreaterThan(qualify);
    expect(missing).toBeGreaterThan(usable);
    expect(version).toContain('`NEW_VERSION=CANDIDATE_VERSION`');
    expectMentions(version, [['承認された場合にのみ既存のバージョンを変更します']], 'version');
    expect(version).toContain('`>= NEW_VERSION`');
    expect(version.slice(missing)).toContain('`BUMP_LEVEL`');
    expect(version.slice(missing)).toContain('`currentVersion`');
  });

  test.each(['home', 'override', 'plugin'])('the actual nudge shell honors %s roots, repeat suppression and enabled tuning', mode => {
    const root = mkdtempSync(join(tmpdir(), 'gstack-ship-nudge-'));
    try {
      const home = join(root, 'home');
      const state = mode === 'home' ? join(home, '.gstack') : join(root, 'state root');
      mkdirSync(home, { recursive: true });
      const nudge = entry.slice(entry.indexOf('## Step 21:'), entry.indexOf('## Section self-check'));
      const block = nudge.match(/```bash\n([\s\S]*?)\n```/);
      expect(block).not.toBeNull();
      const script = block![1].replaceAll('~/.claude/skills/gstack', JSON.stringify(resolve(import.meta.dir, '..')));
      const run = () => spawnSync('bash', ['-c', script], {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: home,
          TMPDIR: join(root, 'tmp'),
          ...(mode === 'override' ? { GSTACK_HOME: state } : {}),
          ...(mode === 'plugin' ? { CLAUDE_PLUGIN_ROOT: join(root, 'gstack'), CLAUDE_PLUGIN_DATA: state } : {}),
        },
        encoding: 'utf8',
        timeout: 10_000,
      });
      const marker = join(state, '.plan-tune-nudge-shown');
      const first = run();
      expect(first.status).toBe(0);
      expect(first.stdout).toContain('Run /plan-tune to opt in');
      expect(existsSync(marker)).toBe(true);
      if (mode !== 'home') expect(existsSync(join(home, '.gstack', '.plan-tune-nudge-shown'))).toBe(false);
      const repeated = run();
      expect(repeated.status).toBe(0);
      expect(repeated.stdout).toBe('');
      rmSync(marker);
      writeFileSync(join(state, 'config.yaml'), 'question_tuning: true\n');
      const enabled = run();
      expect(enabled.status).toBe(0);
      expect(enabled.stdout).toBe('');
      expect(existsSync(marker)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test('nested repairs resume the unfinished outer range before its destination', () => {
    const text = compact(controller);
    expect(text).toContain('11.5 の前に `9 → 10 → 11`');
    expect(text).toContain('`5 → 6 → 7 → 8 → 9 → 10 → 11 → 11.5`');
    expect(text).not.toContain('Enter Step 9 before REVIEW_START capture and full review');
  });

  test('shared foreground dispatch stays mandatory at all three owned dispatch sites', () => {
    const coverage = read('ship/sections/test-coverage.md.tmpl');
    const shared = coverage.indexOf('### 共有サブエージェントのディスパッチ');
    expect(shared).toBeGreaterThan(0);
    expect(shared).toBeLessThan(coverage.indexOf('監査は `subagent_type: "general-purpose"`'));
    const contract = compact(coverage.slice(shared, coverage.indexOf('監査は `subagent_type: "general-purpose"`')));
    expect(contract).toContain('`run_in_background: false`');
    expectMentions(contract, [['Agent ツールを使います'], ['Skill として呼び出したり', '代わりにインラインで実行したりしないでください']], 'contract');
    for (const section of ['test-coverage', 'plan-completion', 'greptile']) {
      const text = read(`ship/sections/${section}.md.tmpl`);
      expect(text).toMatch(/フォアグラウンド(?:ディスパッチ| dispatch)/);
      expect(text).toContain('run_in_background: false');
      expect(text).not.toContain('{{FOREGROUND_DISPATCH_NOTE}}');
    }
    expect(entry).not.toContain('### 共有サブエージェントのディスパッチ');
    for (const section of ['plan-completion', 'greptile']) {
      expectMentions(read(`ship/sections/${section}.md.tmpl`), [['Step 7 の共通のフォアグラウンド dispatch ルール']], section);
    }
  });

  test('ship dashboard displays actual historical records without a repeated sample panel', () => {
    const ctx = { host: 'claude' as const, skillName: 'ship', tmplPath: '', paths: HOST_PATHS.claude };
    const ship = generateReviewDashboard(ctx);
    expect(ship).toContain('REVIEW READINESS DASHBOARD');
    expect(ship).toContain('| Review | Runs | Last run | Status | Required |');
    expectMentions(ship, [['必須とするのは Eng Review だけです']], 'ship');
    expect(ship).toContain('{実際のステータスと理由}');
    expect(ship).toContain('VERDICT: {CLEARED or NOT CLEARED} — {理由}');
    expect(ship).not.toContain('+====================================================================+');
    const review = generateReviewDashboard({ ...ctx, skillName: 'review' });
    expect(review).toContain('+====================================================================+');
  });

  test('coverage fallback settles the child and still applies the coverage gate', () => {
    const text = compact(read('ship/sections/test-coverage.md.tmpl'));
    const fallback = text.slice(text.indexOf('**監査の失敗:**'), text.indexOf('{{TEST_COVERAGE_GATE_SHIP}}'));
    expect(fallback.length).toBeGreaterThan(0);
    expectMentions(fallback, [['子プロセスを停止し', '停止したことを確認してから']], 'fallback');
    expectMentions(fallback, [['カバレッジゲートを通過させたり迂回させたりはしません']], 'fallback');
    expect(text).not.toContain('partial results are better than none');
  });

  test('no-plan gate skips only the audit and retains verification and the remaining section', () => {
    const text = generatePlanCompletionGateShip({ host: 'claude', skillName: 'ship', tmplPath: '', paths: HOST_PATHS.claude });
    const noPlan = compact(text.slice(text.indexOf('**プランファイルが見つからない場合:**')));
    expectMentions(noPlan, [['スキップするのはプラン完了の監査だけです']], 'noPlan');
    expect(noPlan).toContain('Step 8.1');
    expectMentions(noPlan, [['Step 9 の QA は引き続き実行されます']], 'noPlan');
    expect(noPlan).not.toContain('Skip entirely');
  });

  test('binding separates record selection, three snapshots and probe outcomes', () => {
    const text = compact(entry.slice(entry.indexOf('## Step 11.5:'), entry.indexOf('## Step 12:')));
    expectOrdered(text, ['1. **2 つのレビューを選びます。', '2. **内容を比較します。', '3. **QA の例外を保持します。', '4. **証拠を保存します。'], 'binding steps');
    expectMentions(text, [['3 つのスナップショットがすべて一致する必要があります']], 'text');
    expectMentions(text, [['失敗した、または実行されていないプローブが合格したことにはなりません']], 'text');
  });

  test('late classification and docs freshness are ordered decisions, not metadata assumptions', () => {
    const text = compact(entry.slice(entry.indexOf('## Step 16:'), entry.indexOf('## Step 17:')));
    expect(text).toContain('**動作、テスト、またはビルドの入力が変わった:**');
    expect(text).toContain('**作成者によるドキュメントやリリースのメタデータのみが変わった:**');
    expect(text).toContain('**変更がない、またはドキュメントのみのチェックが計画をまだ支持している:**');
    expect(text).toContain('| 段階 4 に進む');
    expect(text).not.toContain('Every listed change below is metadata:');
  });

  test('one early controller owns detours without replacing local gates', () => {
    expect(start).toBeGreaterThan(entry.indexOf('# Ship:'));
    expect(start).toBeLessThan(end);
    expect(end).toBeLessThan(entry.indexOf('{{BASE_BRANCH_DETECT}}'));
    expect(entry.match(/### Ship の制御フロー/g)).toHaveLength(1);
    const text = compact(controller);
    expectMentions(text, [['`/ship` を実行する **親** として', '進行を管理します']], 'text');
    expectMentions(text, [['修復中も STOP と AskUserQuestion のゲートは有効です']], 'text');
    expectMentions(text, [['範囲指定で', 'リストにないステップが追加されることはありません']], 'text');
    expectMentions(text, [['Step 14 で終わる範囲は Step 14.5 に入りません']], 'text');
    expect(text).not.toContain('| At step |');
    expect(entry.match(/Ship の制御フロー/g)).toHaveLength(1);
    expectMentions(review, [['新しい REVIEW_START を取得します']], 'review');
  });

  test('distribution and bootstrap detours end at their exact forward resume', () => {
    const tests = compact(read('ship/sections/tests.md.tmpl'));
    expect(tests).toContain('A) テストを追加する (推奨)');
    expectMentions(tests, [['ブートストラップを断ったというだけでは', 'その承認にはなりません']], 'tests');
  });

  test('missing dispatched output outranks the cycle cap, fixes and zero-edit continuation', () => {
    const decisions = review.slice(review.indexOf('### Step 9 を繰り返すかどうか判断する'));
    const names = ['1. **ディスパッチしたレビュアーの出力が欠けている:**', '2. **3 回目の修正サイクルに到達 (`CYCLES >= 3`):**', '3. **上限未満で修正が適用された:**', '4. **このパスで編集がない:**'];
    const positions = names.map(name => decisions.indexOf(name));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const missing = decisions.slice(positions[0], positions[1]);
    expect(missing).toMatch(/^1\. \*\*ディスパッチしたレビュアーの出力が欠けている:\*\* 停止し/);
    expectMentions(missing, [['欠けているディスパッチのカバレッジの代わりにはなりません']], 'missing');
    const cap = decisions.slice(positions[1], positions[2]);
    expect(cap).toContain('停止し');
    expect(cap).toContain('`converged:false`');
    expectMentions(cap, [['4 回目の修正サイクルは実行しないでください']], 'cap');
    const fixes = decisions.slice(positions[2], positions[3]);
    expectMentions(fixes, [['作業リストの保留中の Step 10 の前に挿入します']], 'fixes');
    expectMentions(fixes, [['検証済みの既存の失敗と範囲について承認を保持してください']], 'fixes');
    expectMentions(decisions.slice(positions[3]), [['それがクリアされた後にのみ Step 10 に進めます']], 'decisions.slice(positions[3])');
    expectMentions(review, [['失敗または利用不可の必要なプローブは継続をブロックします']], 'review');
  });

  test('comment fixes resume triage and preserve settled approvals and replies', () => {
    const section = compact(read('ship/sections/greptile.md.tmpl'));
    expectMentions(review, [['次のステップを選ぶ前に', 'この pass を完了し']], 'review');
    expectMentions(section, [['キューに入った修正がなければ', 'Step 11 に進みます']], 'section');
    expectMentions(section, [['この任意のトリアージは ship をブロックしません']], 'section');
    expect(section).not.toContain('return to Step 9');
  });

  test('native recovery has one corrected attempt and cannot borrow outside completion', () => {
    const finish = adversarial.slice(adversarial.indexOf('### 敵対的フェーズを終える'));
    const recovery = finish.slice(finish.indexOf('1. **必須のネイティブレビューが未完了'), finish.indexOf('2. **ネイティブの完了後に修正がキューに積まれている'));
    expect(recovery.length).toBeGreaterThan(0);
    expectMentions(recovery, [['STOP し', 'ネイティブのタスクが停止したことを確認します']], 'recovery');
    expectMentions(recovery, [['外部プロバイダーの出力で', '置き換えることはできません']], 'recovery');
    expectMentions(recovery, [['復旧のための再試行は', '具体的な前提条件が修正され', '1 回だけ許されます']], 'recovery');
    expect(recovery).toContain('PASS_START');
    expectMentions(recovery, [['修復を求め', 'ブロックされたままにします']], 'recovery');
    const queued = finish.slice(finish.indexOf('2. **ネイティブの完了後に修正がキューに積まれている'), finish.indexOf('3. **ネイティブが完了し'));
    expectMentions(queued, [['保留中の Step 11.5 の前に', '挿入します']], 'queued');
    expectMentions(queued, [['復旧のための再試行ではありません']], 'queued');
    expectMentions(finish.slice(finish.indexOf('3. **ネイティブが完了し')), [['Step 11.5 に進みます']], 'finish');
  });

  test.each(ALL_HOST_CONFIGS.map(({ name }) => name))('%s cannot skip Step 11.5 or change standalone review control flow', host => {
    const ctx = { host, skillName: 'ship', tmplPath: '', paths: HOST_PATHS[host] };
    const ship = generateAdversarialStep(ctx);
    const finish = compact(ship.slice(ship.indexOf('### 敵対的フェーズを終える')));
    const branches = ['必須のネイティブレビューが未完了', 'ネイティブの完了後に修正がキューに積まれている', 'ネイティブが完了し、キューに積まれた修正がない']
      .map(label => finish.indexOf(label));
    expect(branches.every(index => index >= 0)).toBe(true);
    expect(branches).toEqual([...branches].sort((a, b) => a - b));
    expectMentions(finish, [['外部プロバイダーの出力で', '置き換えることはできません']], 'finish');
    expect(finish).toContain('Step 11.5');
    expect(finish).not.toContain('proceed to Step 12');
    expect(finish).not.toContain('return to Step 9');
    const review = generateAdversarialStep({ ...ctx, skillName: 'review' });
    expect(review).not.toContain('Ship control flow');
    expect(review).not.toContain('Step 11.5');
    expectMentions(review, [['修復ループ', '開始しないでください']], 'review');
  });

  test('Step 11.5 verifies original record identity before any release write', () => {
    const bindingStart = entry.indexOf('## Step 11.5:');
    expect(bindingStart).toBeGreaterThan(entry.indexOf('{{SECTION:adversarial}}'));
    expect(bindingStart).toBeLessThan(entry.indexOf('## Step 12:'));
    const binding = compact(entry.slice(bindingStart, entry.indexOf('## Step 12:')));
    for (const field of ['skill:"review"', 'via:"ship"', 'skill:"adversarial-review"',
      'review_binding.state', 'verified', 'review_binding.start_wtree', 'review_binding.end_wtree']) expect(binding).toContain(field);
    expectMentions(binding, [['古い作業に新しいトークンを付けてはいけません']], 'binding');
    expectMentions(binding, [['失敗した、または実行されていないプローブが合格したことにはなりません']], 'binding');
    expect(binding).toContain('Step 12 の前に `9 → 10 → 11 → 11.5` を挿入します');
  });

  test('late build and behavior changes complete bounded ranges before docs', () => {
    const build = gate.slice(gate.indexOf('### 1.'), gate.indexOf('### 2.'));
    expectMentions(build, [['修復し', '段階 1 を繰り返します']], 'build');
    expectMentions(build, [['合格したら段階 2 に進みます']], 'build');
    const behavior = gate.slice(gate.indexOf('1. **動作、テスト'), gate.indexOf('2. **作成者によるドキュメント'));
    expect(behavior.length).toBeGreaterThan(0);
    expect(behavior).toContain('`5–11.5 → 12–14 → 16` を挿入し');
    expectMentions(behavior, [['この修復では Step 14.5 を除外します']], 'behavior');
    expectMentions(behavior, [['再ビルドして再比較し']], 'behavior');
    const plan = gate.slice(gate.indexOf('2. **作成者によるドキュメント'), gate.indexOf('3. **変更がない'));
    expect(plan.length).toBeGreaterThan(0);
    expectMentions(plan, [['Step 8 の監査と判断のゲートだけを実行し', '段階 1 に戻ります']], 'plan');
    expectMentions(plan, [['子の件数を自分で編集してはいけません']], 'plan');
  });

  test('docs freshness has bounded re-audit and exact-content exception routes', () => {
    const docs = gate.slice(gate.indexOf('### 3.'), gate.indexOf('### 4.'));
    expect(docs).toContain('**試行回数が残っており、入力が変更されているか、利用可能な修復がある:** Step 17 の前に `14.5 → 15 → 16` を挿入します');
    expectMentions(docs, [['STOP します', 'ユーザーが特定の名指しのドキュメントリスクを受け入れ', '免除できないすべてのゲートが解消されない限り']], 'docs');
    expectMentions(docs, [['3 回目の監査は決して実行しないでください']], 'docs');
    expect(docs).toContain('`Documentation: blocked`');
    expectMentions(docs, [['ハッシュを黙って更新することは決してしない']], 'docs');
  });

  test('tests, absent test approval and new writes reopen final verification', () => {
    const tests = gate.slice(gate.indexOf('### 4.'), gate.indexOf('### 5.'));
    expectMentions(tests, [['新規、変更された、または免除されていないテストの失敗', '公開を停止します'], ['Step 5–15 を実行し']], 'tests');
    expectMentions(tests, [['テストレーンがない場合', '「テスト対象外」の承認']], 'tests');
    expectMentions(tests, [['3 回目の試行は許可されません']], 'tests');
    expectMentions(gate, [['Step 17 に進む前に', 'すべて完了させます']], 'gate');
  });

  test('push failure kinds and publication races have distinct resumes', () => {
    const push = compact(entry.slice(entry.indexOf('## Step 17:'), entry.indexOf('## Step 18:')));
    expectMentions(push, [['push が失敗した場合は、STOP します'], ['Step 19 も公開の主張もありません']], 'push');
    expectMentions(push, [['Step 17 に戻る前に', 'Step 5–16 を実行します']], 'push');
    expectMentions(push, [['履歴は決して書き換えないでください']], 'push');
    expectMentions(push, [['失敗したガードは決して回避しないでください']], 'push');
    const publication = compact(read('ship/sections/pr-body.md.tmpl'));
    expectMentions(publication, [['Step 18 の識別とタイトルの準備を繰り返し']], 'publication');
    expectMentions(publication, [['新しい本文を作って', '公開前に']], 'publication');
  });
});
