import { describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ALL_HOST_CONFIGS } from '../hosts';
import { generateQAExploratory, generateQAMethodReads, generateQAReview, generateQAReviewPreflight } from '../scripts/resolvers/qa';
import { generatePlanVerificationExec } from '../scripts/resolvers/plan-gates';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { qaProbeNames } from './helpers/qa-probe-names';
import { expectMentions } from './helpers/prompt-structure';

const startCommand = (text: string) => { const n = qaProbeNames(text); return `bun ${n.guard} start ${n.deadline} SECONDS`; };

function assertPreparation(text: string) {
  expectMentions(text, [['チャーター', 'プローブ', '前に']], 'text');
  expect(text).toMatch(/最初のプローブの前に結果を待ち|成功した各 Read の結果を待ちます/);
  expectMentions(text, [['この呼び出し', 'Read', '繰り返']], 'text');
  const stages = ['`sections/scope.md`', '**Functional の面:**', '`sections/system-functional.md`',
    '**Browser の面のみ:**', '`sections/qa-patterns.md`', '## 1. Charter and preflight',
    startCommand(text), '1. まず成功を実証します'];
  const positions = stages.map(stage => text.indexOf(stage));
  expect(positions.every(position => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  for (const section of ['scope', 'system-functional', 'qa-patterns']) {
    expect(text.split(`\`sections/${section}.md\``)).toHaveLength(2);
  }
}

function assertBoundsAndLayout(text: string) {
  for (const contract of ['Browser Quick: SECONDS=180', 'Browser Full/Regression: SECONDS=900']) expect(text).toContain(contract);
  for (const rule of [
    /Functional の Full、Quick、Regression には、デフォルトの合計タイマーはありません/,
    /モードと呼び出し元の制限のうち短い方/,
    new RegExp(`合計の時間制限がない場合は、${qaProbeNames(text).deadline} を作成せず`),
    /有限のコマンドタイムアウト/,
    /standalone の mixed 実行では REPORT_DIR\/browser と REPORT_DIR\/functional を使い/,
    /最終レポートは REPORT_DIR に 1 つ/,
    /呼び出し元のパスが優先/,
  ]) expect(text).toMatch(rule);
  expect(text.search(/呼び出し元のパスが優先/)).toBeLessThan(text.indexOf(startCommand(text)));
}

function assertPlanExecution(text: string, shared = generateQAExploratory({ host: 'claude', skillName: 'qa', tmplPath: '', paths: HOST_PATHS.claude })) {
  const step = text.slice(text.indexOf('**3. スモークとプランのチェックを実行します。**'), text.indexOf('**4. 報告の前に鮮度を確認します。**')).replace(/\s+/g, ' ');
  for (const rule of [
    /共有の Probe loop に従ってスモークのチェックとリプレイを行います/,
    /スモークが期限切れになっても、必須のプランのチェックと再検証を/,
    /スモークガードなしで実行します。クロックはリセットしません/,
    /呼び出し元に期限がある場合は、その残り時間を上限/,
    /呼び出し元の期限が切れたら、未完了のチェックを not-run/,
    /クロック\/ガードの結果を待ちます/,
  ]) expect(step).toMatch(rule);
  expect(step.indexOf('共有の Probe loop')).toBeLessThan(step.indexOf('必須のプランのチェック'));
  expect(step.indexOf('必須のプランのチェック')).toBeLessThan(step.indexOf('同じ手順で'));
  for (const rule of [/まず成功を実証します: 出力と、永続的な効果の両方/,
    /チェックポイントの公開が成功するのを待ちます/,
    /同じ初期フィクスチャの状態から、失敗した正確なコマンド\/リクエストを/]) {
    expect(shared).toMatch(rule);
  }
}

describe('QA probe entry and checkpoint gates', () => {
  test('the caller exposes the response boundary before the first QA instruction read', () => {
    for (const skillName of ['review', 'ship']) {
      const text = generateQAReviewPreflight({ host: 'claude', skillName, tmplPath: '', paths: HOST_PATHS.claude });
      const beforeRead = text.slice(0, text.indexOf('{{QA_RESOURCE:exploratory}}'));
      expectMentions(beforeRead, [['Read', '以前', 'レスポンス'], ['キャプチャ', 'プローブ'], ['まとめて', 'Read']], 'caller entry gate');
    }
  });

  test('the native CI preparation excerpt lacks the required acknowledged-read gate', () => {
    const captured = JSON.parse(fs.readFileSync(path.join(import.meta.dir, 'fixtures/qa-functional-ci-36505065023.json'), 'utf8'));
    const output = captured.omittedReadEvents.flatMap(event => event.message.content)
      .find(block => block.type === 'tool_result' && typeof block.content === 'string' && block.content.includes('# Shared exploratory QA')).content;
    const old = output.replace(/^\s*\d+(?:→|\t)/gm, '');
    expect(old).toContain('Read `sections/scope.md`');
    expect(old).toContain('Read `sections/system-functional.md`');
    const current = generateQAExploratory({ host: 'claude', skillName: 'qa-only', tmplPath: '', paths: HOST_PATHS.claude });
    for (const [clause, now] of [['## 0. Preparation gate', '## 0. Preparation gate'],
      ['Await each successful Read result before continuing', '成功した各 Read の結果を待ちます'],
      ['complete it now before Charter and preflight', 'Charter と preflight の前に、今すぐ完了します']]) {
      expect(old).not.toContain(clause);
      expect(current).toContain(now);
    }
    assertPreparation(current);
  });

  test('the report template no longer asks agents to sanitize public state paths', () => {
    const report = fs.readFileSync(path.join(import.meta.dir, '../qa/templates/functional-report-template.md'), 'utf8');
    expect(report).toContain('SAFE OUTPUT AND STATE PATHS');
    expect(report).toContain('REDACTION AND REPRODUCIBILITY LIMITS');
    expect(report).not.toContain('SANITIZED OUTPUT/STATE PATHS');
  });

  test('parent QA instructions resolve nested methods and reports from the same installed QA directory', () => {
    for (const host of ALL_HOST_CONFIGS) {
      for (const skillName of ['review', 'ship']) {
        const ctx = { host: host.name, skillName, tmplPath: '', paths: HOST_PATHS[host.name] };
        const preflight = generateQAReviewPreflight(ctx).replace(/\s+/g, ' ');
        const body = generateQAReview(ctx).replace(/\s+/g, ' ');
        expect(preflight).toContain('`sections/...`');
        expect(preflight).toContain('`templates/...`');
        expectMentions(preflight, [['パス', 'インストール済み', 'QA', 'SKILL.md', '呼び出し元', 'プロダクト']], 'QA asset resolution');
        expect(body).toContain('QA の `sections/browser-setup.md`');
        expect(body).toContain('QA の `templates/functional-report-template.md`');
        if (skillName === 'review') {
          expect(body).toContain('QA の `templates/qa-report-template.md`');
          expect(body).toContain('Step 4 の面');
          expectMentions(body, [['完了済み', 'Read', '繰り返']], 'body');
        }
      }
    }
  });

  test('composes and checks a complete note before immutable publication on every host', () => {
    for (const host of ALL_HOST_CONFIGS) {
      for (const skillName of ['qa', 'qa-only']) {
        const text = generateQAExploratory({ host: host.name, skillName, tmplPath: '', paths: HOST_PATHS[host.name] });
        const stages = [...(skillName === 'qa-only' ? ['最後の結果をコピーする前に分類します'] : []),
          '公開前にフィールドを確認します', "--after PREV --hypothesis 'why' -- CMD",
          'Browser のチェックポイントは Write を使います', 'チェックポイントの公開が成功するのを待ちます', '3. その正確なプローブを実行します'];
        const positions = stages.map(stage => text.indexOf(stage));
        expect(positions.every(position => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expectMentions(text, [['訂正', '公開']], 'text');
        if (skillName === 'qa-only') {
          expectMentions(text, [['創作', '代わり']], 'text');
          expectMentions(text, [['停止', '影響を受ける', 'プローブ']], 'text');
        } else {
          expectMentions(text, [['停止', '伏せ', '開示']], 'text');
        }
      }
    }
  });

  test('mode bounds and checkpoint nesting are explicit before dispatch', () => {
    for (const skillName of ['qa', 'qa-only']) {
      const text = generateQAExploratory({ host: 'claude', skillName, tmplPath: '', paths: HOST_PATHS.claude });
      for (const contract of [
        '解決済みの REPORT_DIR を再利用します',
        'トップレベルのフィールドはちょうど 4 つです:', 'observationCommand:', 'observed:', 'hypothesis:', 'nextCommand:',
        'QA_DEADLINE のレシートは観測ではありません',
      ]) expect(text).toContain(contract);
      assertBoundsAndLayout(text);
      expect(text.indexOf('Browser Quick: SECONDS=180')).toBeLessThan(text.indexOf(startCommand(text)));
    }
  });

  test('each shared loop loads its selected methods before choosing or executing probes', () => {
    for (const host of ALL_HOST_CONFIGS) {
      for (const skillName of ['qa', 'qa-only']) {
        const ctx = { host: host.name, skillName, tmplPath: '', paths: HOST_PATHS[host.name] };
        const text = generateQAExploratory(ctx);
        const methods = generateQAMethodReads(ctx);
        expect(text).toContain(methods);
        expect(text.indexOf(methods)).toBeLessThan(text.indexOf('1. まず成功を実証します'));
        assertPreparation(text);
        const decision = text.indexOf('**別のプローブが必要かを判断します。**');
        const write = text.indexOf('**プローブの前に公開します。**');
        expect(decision).toBeGreaterThan(-1);
        expect(decision).toBeLessThan(write);
        expectMentions(text.slice(decision, write), [['チェックポイント', 'ではありません']], 'text.slice(decision, write)');
        expect(text.slice(decision, write)).toMatch(/期限切れ/);
        expect(text.slice(decision, write)).not.toContain('If done or blocked');
        if (skillName === 'qa-only') {
        } else {
          expect(text).toMatch(/安全なプログラム JSON のキーと値、ID のハッシュはすべてそのまま保持/);
        }
        expect(text).toMatch(new RegExp(`observed は ${qaProbeNames(text).recorder} が供給します。転記してはいけません`));
      }
    }
  });

  test('expiry branches precede baseline, checkpoint, probe and replay execution on every host', () => {
    for (const host of ALL_HOST_CONFIGS) for (const skillName of ['qa', 'qa-only', 'review', 'ship']) {
      const text = generateQAExploratory({ host: host.name, skillName, tmplPath: '', paths: HOST_PATHS[host.name] });
      const steps = text.slice(text.indexOf('1. まず成功を実証します')).split(/\n(?=[2-5]\. )/);
      expect(steps).toHaveLength(5);
      expect(text).toContain('/gstack-qa-deadline');
      const n = qaProbeNames(text);
      for (const name of Object.values(n)) expect(name.length).toBeGreaterThan(3);
      expect(text).toContain(`bun ${n.guard} start ${n.deadline} SECONDS [EARLIER_UTC]`);
      expect(text).toContain(`\`bun ${n.guard} run ${n.deadline} -- COMMAND ARGS\``);
      expect(text).toContain(`\`bun ${n.recorder} capture ${n.dir} NNN [--public] --deadline ${n.deadline} -- COMMAND ARGS\``);
      expect(text).toContain(`\`bun ${n.recorder} materialize ${n.dir} annotations.json\``);
      expect(text).toMatch(new RegExp(`${n.deadline} をリセットしたり、${n.guard} を迂回したりしてはいけません`));
      expect(text).toMatch(new RegExp(`${n.deadline} が無効/欠落している場合は、プローブを停止し`));
      expect(steps[1]).toContain(`\`bun ${n.guard} status ${n.deadline}\``);
      expect(steps[1].indexOf('期限切れ、または安全な次のプローブ')).toBeLessThan(steps[1].indexOf('**プローブの前に公開します。**'));
      expectMentions(steps[1], [['STOP', '探索', 'レポート']], 'steps[1]');
      expect(steps[2]).toContain(`${n.guard} が期限を強制します`);
      expect(steps[2]).toMatch(/拒否されたものは not-run として報告/);
      expect(steps[3]).toContain('ステップ 2〜3');
      expect(steps[4]).toContain('ステップ 2 に戻ります');
    }
  });

  test('parent QA makes method loading a stop gate even for plan verification', () => {
    for (const host of ALL_HOST_CONFIGS) {
      for (const skillName of ['review', 'ship']) {
        const ctx = { host: host.name, skillName, tmplPath: '', paths: HOST_PATHS[host.name] };
        const text = (skillName === 'review' ? generateQAReviewPreflight(ctx) : '') + generateQAReview(ctx);
        const gate = text.search(/どのプローブ\(プランのチェックを含む\)の前にも、順序付けられたスコープ\/手法の Read/);
        expect(gate).toBeGreaterThan(-1);
        expect(text).toContain('{{QA_RESOURCE:exploratory}}');
        expect(text).not.toContain('{{QA_RESOURCE:scope}}');
        expect(text).not.toContain('`sections/system-functional.md`');
        const shared = generateQAExploratory({ ...ctx, skillName: 'qa' });
        assertPreparation(shared);
        assertPlanExecution(text);
        const required = text.indexOf(skillName === 'review'
          ? '**2. 準備状況を確認し、必要なチェックを列挙します。**' : '**2. 必要なチェックを列挙します。**');
        expect(required).toBeGreaterThan(-1);
        expect(gate).toBeLessThan(required);
        if (skillName === 'review') {
          const isolation = text.indexOf('**1. charter と隔離を設定します。**');
          const setup = text.indexOf("QA の `sections/browser-setup.md`");
          expect(isolation).toBeGreaterThan(gate);
          expect(setup).toBeGreaterThan(required);
          expect(text.slice(isolation, required).replace(/\s+/g, ' ')).toMatch(/セットアップの前に、共有の隔離\/許可の事前確認を完了します/);
          expect(text).toMatch(/Step 4 は読み取り専用です。charter、セットアップ、プローブは Step 4\.7 に回します/);
        } else {
          const setup = text.indexOf("QA の `sections/browser-setup.md`");
          expect(setup).toBeGreaterThan(required);
          expect(setup).toBeLessThan(text.indexOf('**3. スモークとプランのチェックを実行します'));
        }
      }
    }
  });

  test('preparation controls reject reordered scope, duplicate Reads and early charters', () => {
    const text = generateQAExploratory({ host: 'claude', skillName: 'qa', tmplPath: '', paths: HOST_PATHS.claude });
    assertPreparation(text);
    const method = '`sections/system-functional.md` を全文 Read します。';
    for (const changed of [
      method + '\n' + text.replace(method, ''),
      text.replace(method, method + '\n' + method),
      '## 1. Charter and preflight\n' + text,
      text.replace('この呼び出しですでに完了した Read は繰り返しません。', 'すべての Read を行います。'),
      text.replace('`sections/qa-patterns.md` を全文 Read します。', '').replace('## 1. Charter and preflight', '## 1. Charter and preflight\n`sections/qa-patterns.md` を全文 Read します。'),
      // ci-36641820398-1-gate-census-7 ship-exploratory-small-cli dispatched its first probe with the resource Reads.
      text.replace('最初のプローブの前に結果を待ち、同じレスポンス内では行いません。', ''),
    ]) expect(() => assertPreparation(changed)).toThrow();
  });

  test('layout and bounds controls reject mixed caller overrides, split reports and unbounded commands', () => {
    const text = generateQAExploratory({ host: 'claude', skillName: 'qa', tmplPath: '', paths: HOST_PATHS.claude });
    assertBoundsAndLayout(text);
    for (const [before, after] of [
      ['standalone の mixed 実行では', 'すべての mixed 実行では'],
      ['REPORT_DIR/browser と REPORT_DIR/functional を使い', 'REPORT_DIR を使い'],
      ['最終レポートは REPORT_DIR に 1 つ置きます', '面ごとに最終レポートを書きます'],
      ['呼び出し元のパスが優先されます', '面のパスが優先されます'],
      ['有限のコマンドタイムアウト', '無制限のコマンドタイムアウト'],
      ['モードと呼び出し元の制限のうち短い方', '呼び出し元に関係なくモードの時間'],
    ]) expect(() => assertBoundsAndLayout(text.replace(before, after))).toThrow();
  });

  test('required plan checks cannot inherit the expired smoke guard or lose caller bounds and checkpoints', () => {
    for (const skillName of ['review', 'ship']) {
      const text = generateQAReview({ host: 'claude', skillName, tmplPath: '', paths: HOST_PATHS.claude }).replace(/\s+/g, ' ');
      assertPlanExecution(text);
      for (const [before, after] of [
        ['スモークが期限切れになっても、必須のプランのチェックと再検証を', 'スモークが期限切れならプランのチェックはスキップします。その後、'],
        ['スモークガードなしで実行します。クロックはリセットしません', 'スモークガードを再開して使います'],
        ['同じ手順で', '新しいチェックポイントの連鎖を始めます'],
        ['その残り時間を上限とします', '上限はありません'],
        ['呼び出し元の期限が切れたら、未完了のチェックを not-run とします', 'その期限が切れたら、チェックを pass とします'],
        ['行動する前に、クロック/ガードの結果を待ちます', 'クロックの結果は無視します'],
        ['必須のプランのチェックと再検証を', '必須のプランのチェックを'],
        ['スモークのチェックとリプレイを行います', 'スモークのチェック、リプレイ、再検証を行います'],
      ]) {
        expect(text).toContain(before);
        expect(() => assertPlanExecution(text.replace(before, after))).toThrow();
      }
      const smoke = 'スモークの上限まで、共有の Probe loop に従ってスモークのチェックとリプレイを行います。';
      expect(text).toContain(smoke);
      expect(() => assertPlanExecution(text.replace(smoke, '').replace('**4. 報告の前に', smoke + '\n**4. 報告の前に'))).toThrow();
      const shared = generateQAExploratory({ host: 'claude', skillName: 'qa', tmplPath: '', paths: HOST_PATHS.claude });
      for (const contract of ['まず成功を実証します: 出力と、永続的な効果の両方です',
        'チェックポイントの公開が成功するのを待ちます',
        '同じ初期フィクスチャの状態から、失敗した正確なコマンド/リクエストを']) {
        expect(shared).toContain(contract);
        expect(() => assertPlanExecution(text, shared.replace(contract, '任意の証拠'))).toThrow();
      }
    }
  });

  test('core review collects runtime checks without executing them ahead of QA setup', () => {
    for (const [file, step] of [['review/SKILL.md.tmpl', 'Step 4.7'], ['ship/sections/review-army.md.tmpl', 'Step 9.2.1']]) {
      const template = fs.readFileSync(path.join(import.meta.dir, '..', file), 'utf8');
      const text = template.replace('{{QA_REVIEW_PREFLIGHT}}', generateQAReviewPreflight({ host: 'claude', skillName: 'review', tmplPath: '', paths: HOST_PATHS.claude }));
      const staticRule = step === 'Step 4.7' ? 'Step 4 は読み取り専用です。charter、セットアップ、プローブは Step 4.7 に回します' : `この pass は静的に行います。製品のプローブは ${step} に回します`;
      expect(text).toContain(staticRule);
      expect(text.indexOf(staticRule)).toBeLessThan(text.indexOf('{{QA_REVIEW}}'));
      if (step === 'Step 4.7') {
        expect(template.indexOf('{{QA_REVIEW_PREFLIGHT}}')).toBeGreaterThan(template.indexOf('## Step 4:'));
        expect(text.indexOf(staticRule)).toBeLessThan(text.indexOf('チェックリストの 2 つのパスを順番に適用してください'));
      }
    }
  });

  test('plan execution waits for the actual shared method reads, not just collection', () => {
    const text = generatePlanVerificationExec({ host: 'claude', skillName: 'ship', tmplPath: '', paths: HOST_PATHS.claude });
    expectMentions(text, [['QA', '全体', '呼び出']], 'text');
    expectMentions(text, [['実行する前に', '完了', 'コマンド']], 'text');
  });
});

// Lane S C2: gaps the qa-only/review/ship workflow judges named in their rationales.
describe('judge-named QA workflow gaps (C2)', () => {
  const ctx = (skillName: string) => ({ host: 'claude' as const, skillName, tmplPath: '', paths: HOST_PATHS.claude });

  test('Browser Quick leaves time for its six page probes, and the method states the same budget', () => {
    for (const skillName of ['qa', 'qa-only']) {
      const seconds = Number(/Browser Quick: SECONDS=(\d+)/.exec(generateQAExploratory(ctx(skillName)))?.[1]);
      // homepage + top 5 targets, each a checkpoint write plus one guarded command: 30 s left ~5 s per probe.
      expect(seconds / 6).toBeGreaterThanOrEqual(20);
      const patterns = fs.readFileSync(path.join(import.meta.dir, '..', 'qa', 'sections', 'qa-patterns.md'), 'utf8');
      expect(patterns).toContain(`${seconds / 60} 分: ホームページと主要なナビゲーション先 5 つ`);
    }
  });

  test('PROBE_DIR names its source line, and stopping goes to the final report steps', () => {
    for (const skillName of ['qa', 'qa-only']) {
      const text = generateQAExploratory(ctx(skillName));
      const layout = text.indexOf('standalone の mixed 実行では REPORT_DIR/browser と REPORT_DIR/functional');
      const probeDir = text.indexOf("PROBE_DIR: 上の行に従った、この面で所有するプローブ用ディレクトリ。");
      expect(layout).toBeGreaterThan(-1);
      expect(probeDir).toBeGreaterThan(layout);
      expect(text.slice(layout, probeDir).split('\n')).toHaveLength(3);
      expect(text).toContain('レポート(§4)を書きます。チェックポイントではありません。');
      const final = text.indexOf('## 4. Final report');
      expect(final).toBeGreaterThan(-1);
      expect(text.indexOf('annotations.json', final)).toBeLessThan(text.indexOf('materialize PROBE_DIR', final));
    }
  });

  // The review workflow judge passed 10/10 with this one-sentence rule and 6/10
  // with the longer "step 4c reruns plan checks only" variant, which every low
  // sample read as conflicting with Step 5.8's repeat-pass reruns (2026-10-05).
  test('/review and /ship: post-expiry smoke rechecks are not-run, stated once before step 4c', () => {
    for (const skillName of ['review', 'ship']) {
      const text = generateQAReview(ctx(skillName));
      const rule = text.indexOf('期限切れ後のスモークの再確認は not-run です。');
      expect(rule).toBeGreaterThan(-1);
      expect(rule).toBeLessThan(text.indexOf('c. 変更された、または不確かなカバレッジを再レビューし、影響を受けるチェックについてステップ 3 を繰り返します。'));
    }
  });
});

// Lane S C2: gaps the qa-only/review/ship workflow judges named in their rationales.
describe('judge-named QA workflow gaps (C2)', () => {
  const ctx = (skillName: string) => ({ host: 'claude' as const, skillName, tmplPath: '', paths: HOST_PATHS.claude });

  test('Browser Quick leaves time for its six page probes, and the method states the same budget', () => {
    for (const skillName of ['qa', 'qa-only']) {
      const seconds = Number(/Browser Quick: SECONDS=(\d+)/.exec(generateQAExploratory(ctx(skillName)))?.[1]);
      // homepage + top 5 targets, each a checkpoint write plus one guarded command: 30 s left ~5 s per probe.
      expect(seconds / 6).toBeGreaterThanOrEqual(20);
      const patterns = fs.readFileSync(path.join(import.meta.dir, '..', 'qa', 'sections', 'qa-patterns.md'), 'utf8');
      expect(patterns).toContain(`${seconds / 60} 分: ホームページと主要なナビゲーション先 5 つ`);
    }
  });

  test('PROBE_DIR names its source line, and stopping goes to the final report steps', () => {
    for (const skillName of ['qa', 'qa-only']) {
      const text = generateQAExploratory(ctx(skillName));
      const layout = text.indexOf('standalone の mixed 実行では REPORT_DIR/browser と REPORT_DIR/functional');
      const probeDir = text.indexOf("PROBE_DIR: 上の行に従った、この面で所有するプローブ用ディレクトリ。");
      expect(layout).toBeGreaterThan(-1);
      expect(probeDir).toBeGreaterThan(layout);
      expect(text.slice(layout, probeDir).split('\n')).toHaveLength(3);
      expect(text).toContain('レポート(§4)を書きます。チェックポイントではありません。');
      const final = text.indexOf('## 4. Final report');
      expect(final).toBeGreaterThan(-1);
      expect(text.indexOf('annotations.json', final)).toBeLessThan(text.indexOf('materialize PROBE_DIR', final));
    }
  });

  test('/review and /ship: smoke rechecks after smoke expiry are not-run, before step 4c revalidation', () => {
    for (const skillName of ['review', 'ship']) {
      const text = generateQAReview(ctx(skillName));
      const rule = text.indexOf('期限切れ後のスモークの再確認は not-run です。');
      expect(rule).toBeGreaterThan(-1);
      expect(rule).toBeLessThan(text.indexOf('c. 変更された、または不確かなカバレッジを再レビューし、影響を受けるチェックについてステップ 3 を繰り返します。'));
    }
  });
});
