import { afterAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { generateQAMethodology } from '../scripts/resolvers/utility';
import { generateQAExploratory } from '../scripts/resolvers/qa';
import { generateTestBootstrap } from '../scripts/resolvers/testing';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { runBashScript } from './helpers/bash-script';
import { qaProbeNames } from './helpers/qa-probe-names';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const ctx = { host: 'claude', skillName: 'qa', tmplPath: '', paths: HOST_PATHS.claude };
const method = generateQAMethodology(ctx);
const bootstrap = fs.readFileSync(path.resolve(import.meta.dir, '../qa/sections/test-bootstrap.md.tmpl'), 'utf8');
const owned = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-browser-contracts-'));
afterAll(() => fs.rmSync(owned, { recursive: true, force: true }));

function detection(body: string): string {
  const script = body.match(/```bash\n([\s\S]*?)\n```/)?.[1];
  if (!script) throw new Error('Missing native detection script');
  return script;
}

const cases: Array<[string, Record<string, string>]> = [
  ['Django beside-source tests', { 'manage.py': '', 'requirements.txt': 'Django', 'polls/tests.py': 'test' }],
  ['Python standalone tests', { 'setup.cfg': '', 'test_math.py': 'test' }],
  ['Python declared pytest', { 'pyproject.toml': 'pytest' }],
  ['Node script and Next.js', { 'package.json': '{"scripts":{"test":"node --test"},"dependencies":{"next":"1"}}' }],
  ['Go beside-source tests', { 'go.mod': 'module fixture', 'main_test.go': 'test' }],
  ['Rust in-source tests', { 'Cargo.toml': '', 'src/lib.rs': '#[test]\nfn example() {}' }],
  ['Ruby/Rails tests', { 'Gemfile': 'rails', 'Rakefile': '', 'test_math.rb': '', 'math_spec.rb': 'test' }],
  ['PHP config', { 'composer.json': '{}', 'phpunit.xml.dist': '<phpunit/>' }],
  ['Elixir tests', { 'mix.exs': '', 'math_test.exs': 'test' }],
  ['Maven JVM tests', { 'pom.xml': '', 'ExampleTest.java': 'test' }],
  ['Gradle JVM tests', { 'build.gradle.kts': '', 'ExampleTest.kt': 'test' }],
  ['Make test target', { 'Makefile': 'test:\n\ttrue\n' }],
  ['Make check target', { 'Makefile': 'check:\n\ttrue\n' }],
  ['Runner configs', { 'jest.config.js': '', 'vitest.config.ts': '', 'playwright.config.ts': '', '.rspec': '', 'pytest.ini': '', 'tox.ini': '' }],
  ['Test directories and extensions', { 'spec/example.rb': '', '__tests__/example.ts': '', 'tests/example.py': '', 'example.test.tsx': '', 'example.spec.jsx': '' }],
  ['Untested project', { 'go.mod': '', 'main.go': 'package main' }],
  ['Unknown runtime', { 'README.md': 'fixture' }],
  ['Persistent opt-out', { '.gstack/no-test-bootstrap': '', 'package.json': '{}' }],
];

describe('compact QA bootstrap preserves native detection', () => {
  for (const shell of ['bash', 'zsh']) for (const [name, files] of cases) {
    test.skipIf(shell === 'zsh' && !Bun.which('zsh'))(`${name} (${shell})`, () => {
      const cwd = fs.mkdtempSync(path.join(owned, 'markers-'));
      for (const [relative, value] of Object.entries(files)) {
        const target = path.join(cwd, relative);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, value);
      }
      const init = runBashScript('git init -q && git add --all', { cwd, timeout: 10_000 });
      expect(init.status, init.stderr).toBe(0);
      const run = (source: string) => shell === 'bash'
        ? runBashScript(detection(source), { cwd, timeout: 10_000 })
        : spawnSync('zsh', ['-f', '-c', detection(source)], { cwd, timeout: 10_000, encoding: 'utf8' });
      const before = run(generateTestBootstrap(ctx));
      const after = run(bootstrap);
      expect([0, 1]).toContain(before.status);
      expect(after.status, after.stderr).toBe(before.status);
      expect(after.stdout.trim().split('\n').sort()).toEqual(before.stdout.trim().split('\n').sort());
      for (const [relative, value] of Object.entries(files)) expect(fs.readFileSync(path.join(cwd, relative), 'utf8')).toBe(value);
    });
  }

  test('QA bootstrap owns approval, cleanup, red-test evidence, CI and documentation', () => {
    expect(bootstrap).not.toContain('{{TEST_BOOTSTRAP}}');
    for (const contract of [
      '機能系や report-only では実行しません', 'コマンドが文書化されていればブートストラップは省略し', '**ブートストラップしないでください**',
      'AskUserQuestion で回答を待つこと', '実際に選ばれたものだけをインストール', '自分が加えた変更だけを元に戻し', 'ユーザーの編集は残したまま',
      '有効な赤いリグレッションテストを黙って削除しないでください', '/qa の診断・修正ゲート', '最初の実テスト',
      '最低 1、最大 5', '検証済みの完全なコマンド', '.github/workflows/test.yml', 'push と pull_request',
      'ubuntu-latest', 'テストステップの追加を手動で行う必要がある', 'TESTING.md は上書きせず更新してください', '100% のテストカバレッジ',
      '両方の分岐', '無関係なステージ済みの編集', '{{FREE_TEXT_FILE:PROMPT_FILE=aside-prompt}}', '{{ASIDE_RESEARCH_SEND}}', 'WebSearch',
    ]) expect(bootstrap).toContain(contract);
    expect(bootstrap).not.toContain('git checkout --');
    expect(bootstrap).not.toContain('delete silently');
  });

  test('shared {{TEST_BOOTSTRAP}} copy undoes only owned changes, like the QA copy', () => {
    for (const skillName of ['ship', 'design-review']) {
      const shared = generateTestBootstrap({ ...ctx, skillName });
      expect(shared).not.toContain('git checkout --');
      expect(shared).not.toMatch(/delete silently/i);
      expect(shared).not.toMatch(/revert all bootstrap changes/i);
      expect(shared).toMatch(/ブートストラップ(?:自身の|が行った)変更だけを元に戻し/);
      expect(shared).toMatch(/ユーザーの編集は保持/);
      expectMentions(shared, [['無関係な編集', 'すでにステージ', '停止']], 'shared');
    }
  });
});

async function runRecipe(marker: string, options: { flow?: boolean; hostname?: string; response?: string } = {}) {
  const scripts = [...method.matchAll(/aside repl '([\s\S]*?)'\n```/g)].map(match => match[1]);
  const matches = scripts.filter(script => script.includes(marker));
  expect(matches).toHaveLength(1);
  let script = matches[0];
  if (options.flow) script = script.replace('const flow = false;', 'const flow = true;');
  const events: Array<{ name: string; value?: any }> = [];
  const output: string[] = [];
  const hostname = options.hostname ?? 'localhost';
  const origin = `http://${hostname}:3000`;
  const listeners = new Map<string, (event: any) => void>();
  const window: any = { addEventListener: (name: string, fn: (event: any) => void) => listeners.set(name, fn) };
  const pageConsole = { error: (...args: unknown[]) => events.push({ name: 'console', value: args }) };
  const document = {
    body: { innerText: 'Page text' },
    querySelectorAll: () => ['/ok', '/ok', '/logout', '/signout', '/delete', '/remove', '/cancel', '/unsubscribe']
      .map(relative => ({ href: origin + relative })).concat([{ href: 'https://other.example/foreign' }]),
  };
  const pg = {
    _sendToTarget: async (name: string, value: any) => {
      events.push({ name, value });
      if (name === 'Page.addScriptToEvaluateOnNewDocument') new Function('window', 'console', value.source)(window, pageConsole);
    },
    goto: async () => {
      events.push({ name: 'goto' });
      pageConsole.error('load failure');
      listeners.get('error')?.({ message: 'uncaught failure' });
      listeners.get('unhandledrejection')?.({ reason: { message: 'promise failure' } });
    },
    screenshot: async (value: any) => events.push({ name: 'screenshot', value }),
    locator: (ref: string) => ({ click: async () => events.push({ name: 'click', value: ref }) }),
    evaluate: async (fn: Function) => new Function('window', 'document', 'location', `return (${fn.toString()})();`)(window, document, { origin, hostname }),
    url: () => origin,
  };
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  await new AsyncFunction('openTab', 'closeTab', 'snapshot', 'console', 'sleep', 'pwd', 'fetch', 'annotatedScreenshot', 'fs', 'path', 'Buffer', script)(
    async (url: string) => { events.push({ name: 'open', value: url }); return pg; },
    async (page: unknown) => { expect(page).toBe(pg); events.push({ name: 'close' }); },
    async (_page: unknown, value: unknown) => { events.push({ name: 'snapshot', value }); return { tree: '[ref=e12] Save', diff: 'Saved' }; },
    { log: (...args: unknown[]) => output.push(args.map(String).join(' ')) },
    async (value: number) => events.push({ name: 'sleep', value }),
    '/owned-session',
    async (url: string, value: unknown) => { events.push({ name: 'fetch', value: { url, ...value as object } }); return { status: 200, text: async () => options.response ?? 'body' }; },
    async () => ({ base64Image: Buffer.from('image').toString('base64') }),
    { writeFile: async (file: string, bytes: Buffer) => events.push({ name: 'writeFile', value: { file, bytes: bytes.toString() } }) },
    path.posix, Buffer,
  );
  expect(events[0].name).toBe('open');
  expect(events.at(-1)?.name).toBe('close');
  expect(output.at(-1)).toBe('GSTACK_STEP_OK');
  return { events, output };
}

describe('compact QA browser recipes retain native operations', () => {
  test('bounded exploration rechecks the clock around checkpoints without replacing probe evidence', () => {
    for (const skillName of ['qa', 'qa-only', 'review', 'ship']) {
      const loop = generateQAExploratory({ ...ctx, skillName });
      const n = qaProbeNames(loop);
      for (const contract of [
        `bun ${n.guard} start ${n.deadline} SECONDS [EARLIER_UTC]`,
        'SECONDS には、モードと呼び出し元の制限のうち短い方を設定します',
        `${n.guard} が期限を強制します`,
        'QA_DEADLINE のレシートは観測ではありません',
        '拒否されたものは not-run として報告し',
        `\`bun ${n.guard} run ${n.deadline} -- COMMAND ARGS\``,
        '有限のコマンドタイムアウトを宣言します',
      ]) expect(loop).toContain(contract);
      expect(loop).toMatch(new RegExp(`${n.deadline} をリセットしたり、${n.guard} を迂回したりしてはいけません`));
      for (const field of ['observationCommand', 'observed', 'hypothesis', 'nextCommand']) expect(loop).toContain(`${field}:`);
      expectMentions(loop, [['Functional', 'Regression', 'デフォルトの合計タイマーはありません']], 'loop');
      if (skillName !== 'qa-only') expect(loop).toContain('明示的なプランのチェックと再検証は、このスモーク予算を超えても引き続き必要です');
    }
  });

  test('one shared loop owns the preserved phases, checkpoints and time limits', () => {
    const prose = method.replace(/\s+/g, ' ');
    for (const contract of [
      '実行順序を決めるのは共有の探索ループであり、これらの技法フェーズではありません',
      'ベースライン以降のすべてのプローブ(オリエンテーション、リンク、 正確なリプレイ、追加の証拠を含む)に適用されます',
      'チェックポイントをまたいでバッチ処理してはいけません',
      '時間の上限にはチェックポイントと証拠が含まれます',
      '時間を使い切ったらプローブを止め、未完了のカバレッジを報告します。チェックポイントを飛ばしてはいけません',
      '/qa と /qa-only では、Full、Quick、Regression のいずれかを選びます',
      '/review と /ship は、呼び出し元のスモークと計画の範囲を維持します',
      '深さを指定するフラグが 競合する場合は、プローブの前に質問して解決します',
      'Diff-aware は範囲を選ぶもので、別のパスではありません',
      'ブラウザサーフェスを選択して切り分けた後',
      '到達できるすべてのページを訪れます(5〜15 分)', '3 分: ホームページと主要なナビゲーション先 5 つ',
      '詳細な問題とチェックリストはスキップしますが、共有ループのゲートは決してスキップしません',
    ]) expect(prose).toContain(contract);
    const titles = ['初期化', '認証(必要な場合)', 'オリエンテーション', '探索', '記録', 'まとめ'];
    const phases = titles.map((title, index) => {
      const heading = `### Phase ${index + 1}: ${title}`;
      expect(method).toContain(heading);
      const start = method.indexOf(heading);
      const next = index < 5 ? method.indexOf(`### Phase ${index + 2}:`) : method.indexOf('## Health Score Rubric');
      expect(next).toBeGreaterThan(start);
      return method.slice(start, next).replace(/\s+/g, ' ');
    });
    expect(phases[0]).toContain('呼び出し元の BROWSER SETUP');
    expect(phases[0]).toContain('呼び出し元が所有するアーティファクトのパス');
    expectMentions(phases[0], [['呼び出し元の権限の範囲内でのみ', '完了させます']], 'phases[0]');
    expectMentions(phases[2], [['負荷をかける前に', '成功するベースライン']], 'phases[2]');
    expectMentions(phases[2], [['読み込みが成功したことではなく', '結果/状態を観察します']], 'phases[2]');
    expect(phases[4]).toContain('共有ループの正確なリプレイのルール');
    expectMentions(phases[4], [['リプレイが終わる前のタイムアウト', '確認が未完了']], 'phases[4]');
    expect(phases[4]).toContain('最小化が未完了になります');
    expectMentions(phases[5], [['新しいプローブは行わず', '保持した証拠']], 'phases[5]');
    expect(phases[5]).toContain('呼び出し元のアーティファクト/混合レポートのルール');
    for (const skillName of ['qa', 'qa-only']) {
      const loop = generateQAExploratory({ ...ctx, skillName }).replace(/\s+/g, ' ');
      for (const contract of [
        '各プローブは、ネイティブなコマンド/操作 1 つとチェックです', 'まず成功を実証します: 出力と、永続的な効果の両方です',
        '**プローブの前に公開します。**',
        'ディスパッチの前に、チェックポイントの公開が成功するのを待ちます',
        'メモを後から埋めたり、上書きしたりしてはいけません',
        '同じ初期フィクスチャの状態から、失敗した正確なコマンド/リクエストを',
        'その後、それらのゲートを通して最小化します',
        '別の入力や回帰テストは、そのリプレイにはなりません',
      ]) expect(loop).toContain(contract);
    }
  });

  test('consolidated QA rules survive at their authoritative execution steps', () => {
    const source = fs.readFileSync(path.resolve(import.meta.dir, '../qa/SKILL.md.tmpl'), 'utf8');
    const section = (start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end)).replace(/\s+/g, ' ');
    const setup = section('## セットアップ', '## Phases 1-6:');
    expect(setup).toContain('git status --porcelain');
    expect(setup).toContain('ツリーが汚れている場合は **STOP** し、AskUserQuestion を使ってください');
    for (const choice of ['QA の前に、現在のすべての変更を説明的なメッセージでコミットする', '変更をスタッシュし、QA を実行してから、スタッシュを pop する', '手動でのクリーンアップのために中止する']) expect(setup).toContain(choice);
    expectMentions(setup, [['セットアップを続ける前に', 'ユーザーの選択だけを実行してください']], 'setup');
    expectMentions(section('### 8d.', '### 8e.'), [['関係のない修正は決してコミットしないでください']], 'section(### 8d., ### 8e.)');
    const classification = section('### 8e.', '### 8e.5.');
    for (const rule of ['8c に合格', 'ネイティブの回帰テスト', 'テストのカバレッジが欠けている場合はそれを開示する', 'この実行の修復のみを元に戻す', 'すでにコミットされている場合はそのコミットを revert する', '有効な回帰テストや根拠は残し', '「deferred」', 'ユーザーの変更は決して破棄しないこと']) expect(classification).toContain(rule);
    const regulation = section('### 8f.', '## Phase 9:');
    for (const rule of [/5 件の修正ごとに/, /差し戻しの後にはいつでも/, /すぐに STOP/, /続けるかどうかを尋ねてください/, /上限: 修正 50 件/]) expect(regulation).toMatch(rule);
    for (const signal of [/すぐに STOP/, /差し戻し/, /無関係なファイル/]) expect(regulation).toMatch(signal);
    expectMentions(source, [['迷ったら', '止まって尋ねてください']], 'source');
    const rules = source.slice(source.indexOf('## Additional Rules'));
    for (const rule of ['明示的に承認されたブラウザのブートストラップの外では', 'Phase 8a.5 の、許可された明文化によってのみテストを作成してください', 'CI の設定を変更したり、既存のテストを弱めたりは決してしないでください', '新しいネイティブのテストファイルを使ってください']) expect(rules).toContain(rule);
    const loop = generateQAExploratory(ctx).replace(/\s+/g, ' ');
    for (const rule of ['ロジックにはユニット', '状態/リクエストには統合', 'E2E は、より小さいテストがジャーニーを捉えられない場合に限ります', '自動的に両方を行うわけではありません', 'モックにするのは無関係なサービスだけです', 'Phase 8 の回帰ゲートは親が担います', 'バグのある出力を固定したり、テストを弱めたり、有効な red のテストを削除したりしてはいけません']) expect(loop).toContain(rule);
    expectMentions(section('### 8a.5.', '### 8b.'), [['検出したコマンドを実行し', '欠陥によるものだと証明してください']], 'section(### 8a.5., ### 8b.)');
    expectMentions(section('### 8e.5.', '### 8f.'), [['結果を記録するもの', '別のテストを作成するものではありません']], 'section(### 8e.5., ### 8f.)');
  });

  test('browser repair verification points at the actual read/flow recipe', () => {
    const verify = fs.readFileSync(path.resolve(import.meta.dir, '../qa/sections/browser-verify.md.tmpl'), 'utf8');
    expectTokens(verify, ['`flow = true`'], 'verify');
    for (const contract of ['元の再現手順に合わせて設定してください', '`flow = false`', 'エラーフック、スナップショット、コンソール出力',
      '`GSTACK_STEP_OK` の確認', '修正後のスクリーンショット名は新規のものを使い', '同名が既に存在する場合はサフィックスを付けてください',
      'コピーしたスクリーンショットを Read で確認します', '機能面の修正では、このセクションは読み込まないでください']) expect(verify).toContain(contract);
    expect(verify).not.toContain('const HOOK =');
    expect(verify).not.toContain('Phase 5 Drive-a-flow');
    const orient = method.slice(method.indexOf('### Phase 3: オリエンテーション'), method.indexOf('### Phase 4: 探索'));
    expect(orient).toContain('const flow = false;');
    expect(orient).toContain('if (flow)');
    expect(orient).toContain('"DIFF_START"');
    expect(orient).toContain('"CONSOLE_ERRORS="');
  });

  test('browser selection, evidence, consent and report contracts remain explicit', () => {
    for (const contract of [
      '選択されたブラウザサーフェスに対してのみ実行します', 'diff をソースと突き合わせてマッピングします', '探索はブラックボックスのままとし',
      '### Diff-aware(URL がなくフィーチャーブランチにいる場合は自動)', '### Full', '### Quick', '### Regression',
      'BROWSER SETUP', 'NEEDS_ASIDE', 'ASIDE_NOT_RUNNING', '/setup-browser-cookies', '$B handoff', '$B resume',
      '認証情報を扱ったり、cookie/トークン/localStorage を露出させたりしてはいけません', 'すべてのスクリーンショットについて', '続けて Read します', 'レポート/スクリーンショットを削除してはいけません',
      '一度再試行して確認し', '重大度ごとの件数', 'ページ/スクリーンショットの数', 'YYYY-MM-DD',
      'baseline.json', 'healthScore', 'categoryScores', 'BROWSER SETUP の安全性/センチネルのルール',
      'LOCAL 以外の変更を列挙した AskUserQuestion を、操作する前に 1 回だけ行います',
      '選択されたブラウザサーフェスについて、ブラウザの使用を決して拒否してはいけません',
    ]) expect(method).toContain(contract);
  });

  for (const flow of [false, true]) {
    test(flow ? 'interactive before/action/after evidence' : 'page orientation and load-time error capture', async () => {
      const { events, output } = await runRecipe('const flow = false', { flow });
      const names = events.map(event => event.name);
      expect(names.indexOf('Page.addScriptToEvaluateOnNewDocument')).toBeLessThan(names.indexOf('goto'));
      const screenshots = events.filter(event => event.name === 'screenshot').map(event => event.value);
      expect(screenshots).toEqual(flow ? [
        { path: 'issue-001-step-1.jpg', type: 'jpeg', quality: 60, fullPage: false },
        { path: 'issue-001-result.jpg', type: 'jpeg', quality: 60 },
      ] : [{ path: 'initial.jpg', type: 'jpeg', quality: 60, fullPage: true }]);
      expect(output).toContain('CONSOLE_ERRORS=["load failure","uncaught: uncaught failure","unhandledrejection: promise failure"]');
      expect(output).toContain('ASIDE_DIR=/owned-session');
      expect(output).toContain('Page text');
      expect(names.filter(name => name === 'click')).toHaveLength(flow ? 1 : 0);
      if (flow) {
        expect(names.indexOf('screenshot')).toBeLessThan(names.indexOf('click'));
        expect(names.indexOf('click')).toBeLessThan(names.lastIndexOf('screenshot'));
        expect(output).toContain('DIFF_START');
        expect(output).toContain('Saved');
        expect(output).toContain('DIFF_END');
      }
    });
  }

  for (const hostname of ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'app.localhost', 'app.test', 'example.com', 'app.local']) {
    test(`link checks preserve local-only requests and dangerous-path exclusions (${hostname})`, async () => {
      const { events, output } = await runRecipe('const links =', { hostname });
      const requests = events.filter(event => event.name === 'fetch');
      const local = hostname !== 'example.com' && hostname !== 'app.local';
      expect(requests).toEqual(local ? [{ name: 'fetch', value: { url: `http://${hostname}:3000/ok`, method: 'HEAD' } }] : []);
      expect(output).toContain(`LINK ${local ? '200' : '?'} http://${hostname}:3000/ok`);
    });
  }

  test('responsive capture restores viewport', async () => {
    const { events, output } = await runRecipe('Emulation.setDeviceMetricsOverride');
    expect(events).toContainEqual({ name: 'Emulation.setDeviceMetricsOverride', value: { width: 375, height: 812, deviceScaleFactor: 2, mobile: true } });
    expect(events).toContainEqual({ name: 'Emulation.clearDeviceMetricsOverride', value: {} });
    expect(output).toContain('ASIDE_DIR=/owned-session');
  });

  test('annotated evidence is written inside the Aside session', async () => {
    const { events, output } = await runRecipe('annotatedScreenshot(pg)');
    expect(events).toContainEqual({ name: 'writeFile', value: { file: '/owned-session/issue-002.png', bytes: 'image' } });
    expect(output).toContain('ASIDE_DIR=/owned-session');
  });

  test('session API requests retain status and bounded body evidence', async () => {
    const { events, output } = await runRecipe('API_STATUS=', { response: 'x'.repeat(6000) });
    expect(events).toContainEqual({ name: 'fetch', value: { url: '<base-url>/api/...', method: 'GET' } });
    expect(output).toContain('API_STATUS=200');
    expect(output).toContain('API_BODY_START');
    expect(output).toContain('x'.repeat(4000));
    expect(output).toContain('API_BODY_END');
  });
});
