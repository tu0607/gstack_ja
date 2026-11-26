import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HOST_CONFIGS } from '../hosts';
import { RESOLVERS } from '../scripts/resolvers';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { qaProbeNames } from './helpers/qa-probe-names';
import { expectMentions } from './helpers/prompt-structure';

const root = join(import.meta.dir, '..');
const callers = ['qa', 'qa-only', 'review', 'ship'];

function context(host: string, skillName: string): TemplateContext {
  return { host, skillName, tmplPath: '', paths: HOST_PATHS[host] };
}

function render(file: string, ctx: TemplateContext): string {
  let body = readFileSync(join(root, file), 'utf8');
  for (let pass = 0; pass < 10; pass++) {
    const next = body.replace(/\{\{([A-Z_]+)(?::([^}]+))?\}\}/g, (_match, name, args) => {
      if (!RESOLVERS[name]) throw new Error(`Unknown resolver ${name}`);
      return RESOLVERS[name](ctx, args?.split(':'));
    });
    if (next === body) return body;
    body = next;
  }
  throw new Error(`Unresolved template ${file}`);
}

function assertProbeLocalBlocker(body: string): void {
  expect(body).toMatch(/QA のセットアップブロッカー/);
  expect(body).toMatch(/影響を受けるプローブを blocked/);
  expect(body).toMatch(/ほかの安全なプローブ/);
  expect(body).toMatch(/独立した機能\/静的チェック/);
  expect(body).not.toContain('stop that workflow');
  expect(body).not.toContain('stop all checks');
}

function assertSharedBrowserAuthority(body: string): void {
  const decision = body.slice(body.indexOf('## ブラウザへのアクセスの判断'), body.indexOf('## BROWSER SETUP'));
  expect(decision).toMatch(/呼び出しているワークフローを使ってください/);
  const reportOnly = decision.slice(decision.indexOf('- **報告のみ'), decision.indexOf('- **単独の /qa'));
  expect(reportOnly).toContain('/qa-only、/review、/ship');
  expectMentions(reportOnly, [['フォールバック', 'セットアップ', 'インストール', 'Cookie', '実行しないでください'],
    ['ブートストラップ', 'ほかのスキル', '決して'], ['影響を受ける', 'ブラウザのプローブだけをブロック'],
    ['独立した機能/静的チェックは続けてください']], 'reportOnly');
  expect(reportOnly).not.toContain('cd <SKILL_DIR>');
  const standalone = decision.slice(decision.indexOf('- **単独の /qa'));
  const ask = standalone.search(/明示的な承認/);
  const gate = standalone.search(/承認された後にのみ/);
  const setup = standalone.indexOf('`cd <SKILL_DIR> && ./setup`');
  expect(ask).toBeGreaterThan(-1);
  expect(gate).toBeGreaterThan(ask);
  expect(setup).toBeGreaterThan(gate);
  expect(standalone).toContain('/setup-browser-cookies');
  expect(standalone).toMatch(/断られた、利用できない、または失敗した場合は、影響を受けるプローブをブロック/);
  expect(decision).toMatch(/不明な呼び出し元の場合は、報告のみ/);
  expect(body).not.toContain('If `NEEDS_SETUP`: tell the user');
  expect(body).not.toContain('An authenticated page needs /setup-browser-cookies');
}

describe('QA caller authority in pure host renders', () => {
  for (const host of ALL_HOST_CONFIGS) {
    test(`${host.name}: a scope handoff requires the actual prior method read`, () => {
      for (const caller of callers) {
        const body = RESOLVERS.QA_EXPLORATORY(context(host.name, caller));
        const scope = body.indexOf('`sections/scope.md`');
        const methods = body.indexOf('**Functional の面:**');
        expect(scope).toBeGreaterThan(-1);
        expect(methods).toBeGreaterThan(scope);
        expect(body.indexOf('## 1. Charter and preflight')).toBeGreaterThan(methods);
        expect(body).not.toContain('If the caller has not selected surfaces and established isolation');
      }
    });

    test(`${host.name}: exploratory scope defines its controller and timing before probes`, () => {
      for (const caller of callers) {
        const body = RESOLVERS.QA_EXPLORATORY(context(host.name, caller));
        expect(body).toContain('**呼び出し元**(/qa、/qa-only、/review、/ship)');
        const n = qaProbeNames(body);
        const start = `bun ${n.guard} start ${n.deadline} SECONDS [EARLIER_UTC]`;
        expect(body).toContain(start);
        expect(body).toContain(`${n.guard} が期限を強制します`);
        expect(body.indexOf(start)).toBeLessThan(body.indexOf('1. まず成功を実証します'));
        expect(body).toMatch(/スコープ内の契約がテスト済みまたはブロック済みになった時点で停止します/);
      }
    });

    test(`${host.name}: final QA cannot omit caller-required rechecks as unaffected`, () => {
      const body = render('qa/SKILL.md.tmpl', {
        ...context(host.name, 'qa'), tmplPath: 'qa/SKILL.md.tmpl', preambleTier: 4,
      });
      const final = body.slice(body.indexOf('## Phase 9: 最終 QA'), body.indexOf('## Phase 10: レポート'));
      expectMentions(final, [['呼び出し元が必要とする再確認', '飛ばすことはできません']], 'final');
      expectMentions(final, [['ブロックされた', '結論が出ていない', '再確認', '修復を検証することは決してありません']], 'final');
    });

    test(`${host.name}: prior learnings name QA findings without changing review callers`, () => {
      for (const skill of ['qa', 'qa-only']) {
        const body = RESOLVERS.LEARNINGS_SEARCH(context(host.name, skill));
        expect(body).toContain('QA の指摘が過去の学びに');
        expect(body).not.toContain('review の指摘が過去の学びに');
        expect(body).toContain('過去の学びを適用');
      }
      for (const skill of ['review', 'ship']) {
        expect(RESOLVERS.LEARNINGS_SEARCH(context(host.name, skill))).toContain('review の指摘が過去の学びに');
      }
    });

    test(`${host.name}: report-only learning lookup cannot configure or initialize stores`, () => {
      const ctx = context(host.name, 'qa-only');
      const search = RESOLVERS.LEARNINGS_SEARCH(ctx, ['query=webhook retries']);
      expectMentions(search, [['learnings.jsonl', 'ディレクトリ', 'すでに分かっていて'], ['呼び出し元', 'Read', '許可'],
        ['gstack-learnings-search', '実行しません']], 'search');
      expect(search).toContain('"webhook retries"');
      expect(search).not.toContain('```bash');
      expect(search).not.toContain('gstack-config');
      expect(search).not.toContain('AskUserQuestion');
      expect(() => RESOLVERS.LEARNINGS_SEARCH(ctx, ['query=$(touch outside)'])).toThrow();
    });

    test(`${host.name}: missing lazy sections stop affected probes, not independent checks`, () => {
      for (const skill of ['qa', 'qa-only']) {
        const ctx = context(host.name, skill);
        for (const id of ['browser-setup', 'exploratory']) {
          const sharedSetup = skill === 'qa-only' && id === 'browser-setup';
          const pointer = sharedSetup ? RESOLVERS.QA_RESOURCE(ctx, [id]) : RESOLVERS.SECTION(ctx, [id]);
          assertProbeLocalBlocker(pointer);
          expect(pointer).toContain(`\`sections/${id}.md\``);
          expect(pointer).toContain('SKILL.md directory');
          expect(pointer).toMatch(sharedSetup ? /プロダクトのディレクトリや他ホストのもので代用してはいけません/ : /プロダクトの作業ディレクトリ[^\n]*決して使わない/);
          expect(pointer).not.toContain('## BROWSER SETUP');
          expect(pointer).not.toContain('aside repl');
        }
      }
    });

    test(`${host.name}: each installed caller resource uses the same blocker rule`, () => {
      for (const caller of callers) {
        const resource = RESOLVERS.QA_RESOURCE(context(host.name, caller), ['browser-setup']);
        assertProbeLocalBlocker(resource);
        if (caller === 'review' || caller === 'ship') {
          expect(resource).toContain(`../${host.name === 'claude' ? 'qa' : 'gstack-qa'}/sections/browser-setup.md`);
          expect(resource).toContain(`インストール済みの /${caller} の SKILL.md`);
        } else {
          expect(resource).toContain('installed');
          expect(resource).toContain('sections/browser-setup.md');
        }
      }
    });

    test(`${host.name}: shared QA setup chooses runtime caller authority before readiness`, () => {
      const ctx = context(host.name, 'qa');
      const body = render('qa/sections/browser-setup.md.tmpl', ctx);
      assertSharedBrowserAuthority(body);
      expect(body.indexOf('## ブラウザへのアクセスの判断')).toBeLessThan(body.indexOf('## BROWSER SETUP'));
      expect(body.indexOf('## BROWSER SETUP')).toBeLessThan(body.indexOf('## Browser fallback'));
      expect(body.replace(/\s+/g, ' ')).toMatch(/機能のみの対象では、Aside の確認、Web サーバーの探索、ブラウザのインストールは行いません/);
      expect(body).toMatch(/所有権のルールは、LOCAL のブラウザの対象にも適用されます/);
      expect(body).toMatch(/ブラウザのステップの代わりに単体テストや curl を使ってもいけません/);
      expect(body).toMatch(/パスワード、ワンタイムコード、支払い情報は決して入力せず/);
      expect(body).toMatch(/ほかのタブは、読み取り、スクリーンショット、移動、閉じる操作を一切行いません/);
      expect((body.match(/cd <SKILL_DIR> && \.\/setup/g) ?? [])).toHaveLength(1);
    });

    test(`${host.name}: QA fallback delegates setup and authentication without new authority`, () => {
      for (const caller of callers) {
        const fallback = RESOLVERS.BROWSE_FALLBACK(context(host.name, caller));
        expect(fallback).toContain('Browser access decision');
        expect(fallback).not.toContain('進めてよいですか?');
        expect(fallback).not.toContain('run `cd <SKILL_DIR>');
        expect(fallback).not.toContain('認証が必要なページには、/setup-browser-cookies');
        expect(fallback).toContain('$B snapshot -i');
        expect(fallback).toContain('DIFF_START');
        expect(fallback).toContain('CONSOLE_ERRORS=');
      }
    });

    test(`${host.name}: browser methodology routes auth through the decision instead of importing`, () => {
      const body = render('qa/sections/qa-patterns.md.tmpl', context(host.name, 'qa'));
      const auth = body.slice(body.indexOf('### Phase 2:'), body.indexOf('### Phase 3:'));
      expect(auth).toContain('Browser access decision');
      expect(auth).not.toContain('Fallback: /setup-browser-cookies or');
      expect(auth).toMatch(/認証情報を扱ったり、cookie\/トークン\/localStorage を露出させたりしてはいけません/);
    });

    test(`${host.name}: functional-only and report-only paths preserve independent checks and gates`, () => {
      const scope = RESOLVERS.QA_SCOPE(context(host.name, 'qa'));
      expect(scope).toMatch(/functional のみの実行では、browser のセットアップ、方法論、検証、ブートストラップを読んではいけません/);
      expect(scope).not.toContain('command -v aside');
      expect(scope).not.toContain('curl -sI');
      for (const caller of callers) {
        const ctx = context(host.name, caller);
        const body = RESOLVERS.QA_EXPLORATORY(ctx);
        const compact = body.replace(/\s+/g, ' ');
        expect(compact).toMatch(/影響を受けるプローブをブロックします。独立した安全なチェックはブロックしません/);
        expect(compact).not.toContain('stop all checks');
        expect(body).toContain('2. 選んだ面に応じた下記の手法を全文 Read します');
        expect(body.indexOf('2. 選んだ面に応じた下記の手法を全文 Read します')).toBeLessThan(body.indexOf('1. まず成功を実証します'));
        const reads = RESOLVERS.QA_METHOD_READS(context(host.name, caller));
        expect(reads).toContain('**Functional の面:**');
        expect(reads).toContain('sections/system-functional.md');
        expect(reads).toContain('**Browser の面のみ:**');
        expect(reads).toContain('sections/qa-patterns.md');
        expect(body).toMatch(/ワークフロー、フレームワークのインストール、公開は行いません/);
        expect(body).toMatch(/判断、テスト、修正、公開を担います/);
        expect(body).toMatch(/タイムアウト、拒否は、決して pass になりません/);
        expect(body).toMatch(/pass には、現在の入力に対する必要な契約がすべて pass し/);
        if (caller !== 'qa-only') {
          expect(body).toMatch(/必須の失敗があると \/review は未完了のままで/);
          expect(body).toMatch(/ユーザーが名指しされたそのリスクを明示的に受け入れない限り/);
          expect(body).toMatch(/非対話の実行ではブロックを返します/);
          expect(body).toMatch(/test_stub の提案には ASK の承認が必要です/);
        }
      }
      const review = RESOLVERS.QA_REVIEW(context(host.name, 'review'));
      const ship = RESOLVERS.QA_REVIEW(context(host.name, 'ship'));
      expect(review).toMatch(/ship のウェイバーでは完了にできません/);
      expect(ship).toMatch(/名指しされたリスクの明示的な受け入れ/);
      expect(ship.replace(/\s+/g, ' ')).toMatch(/clean\/completed と報告できるのは、必須のチェックがすべて現在の入力で pass した場合だけです/);
    });

    test(`${host.name}: non-QA fallback retains its existing setup and human sign-in flow`, () => {
      const fallback = RESOLVERS.BROWSE_FALLBACK(context(host.name, 'browse'));
      expect(fallback).toContain('進めてよいですか?');
      expect(fallback).toMatch(/回答を得るまで STOP し、その後 `cd <SKILL_DIR> && \.\/setup` を実行します/);
      expect(fallback.indexOf('進めてよいですか?')).toBeLessThan(fallback.indexOf('cd <SKILL_DIR> && ./setup'));
      expect(fallback).toContain('認証が必要なページには、/setup-browser-cookies');
      expect(fallback).toContain('$B handoff');
      expect(fallback).toContain('$B resume');
      expect(fallback).not.toContain('Browser access decision');
    });

    test(`${host.name}: orchestration declares required probes before execution`, () => {
      for (const caller of ['review', 'ship']) {
        const ctx = context(host.name, caller);
        const body = (caller === 'review' ? RESOLVERS.QA_REVIEW_PREFLIGHT(ctx) : '') + RESOLVERS.QA_REVIEW(ctx);
        const exploration = body.indexOf('{{QA_RESOURCE:exploratory}}');
        expect(exploration).toBeGreaterThan(-1);
        const resource = RESOLVERS.QA_RESOURCE(ctx, ['exploratory']);
        expect(resource).toContain(`../${host.name === 'claude' ? 'qa' : 'gstack-qa'}/sections/exploratory.md`);
        const shared = render('qa/sections/exploratory.md.tmpl', context(host.name, 'qa'));
        expect(shared.indexOf('`sections/scope.md`')).toBeLessThan(shared.indexOf('`sections/system-functional.md`'));
        const required = body.indexOf(caller === 'review'
          ? '2. 準備状況を確認し、必要なチェックを列挙します' : '2. 必要なチェックを列挙します');
        expect(required).toBeGreaterThan(-1);
        expect(exploration).toBeLessThan(required);
        expect(body).toContain('5 分/12 プローブ');
        expect(body.replace(/\s+/g, ' ')).toMatch(/clean\/completed と報告できるのは、必須のチェックがすべて現在の入力で pass した場合だけです/);
      }
      const ship = RESOLVERS.QA_REVIEW(context(host.name, 'ship'));
      expect(ship).toContain('Step 9.4');
      expect(ship).toMatch(/名指しされたリスクの明示的な受け入れ。そうでなければブロックです/);
    });

    test(`${host.name}: caller QA selects surfaces directly and links checkpoints in one final section`, () => {
      for (const caller of ['review', 'ship']) {
        const ctx = context(host.name, caller);
        const body = (caller === 'review' ? RESOLVERS.QA_REVIEW_PREFLIGHT(ctx) : '') + RESOLVERS.QA_REVIEW(ctx);
        const exploration = body.indexOf('{{QA_RESOURCE:exploratory}}');
        const shared = render('qa/sections/exploratory.md.tmpl', context(host.name, 'qa'));
        const scope = shared.indexOf('`sections/scope.md`');
        const methods = shared.indexOf('**Functional の面:**');
        const probes = body.indexOf(caller === 'review'
          ? '2. 準備状況を確認し、必要なチェックを列挙します' : '2. 必要なチェックを列挙します');
        expect(scope).toBeGreaterThan(-1);
        expect(exploration).toBeGreaterThan(-1);
        expect(methods).toBeGreaterThan(scope);
        expect(shared.indexOf('## 1. Charter and preflight')).toBeGreaterThan(methods);
        expect(exploration).toBeLessThan(probes);
        expect(body).not.toContain('**Functional の面:**');
        expect(RESOLVERS.QA_RESOURCE(ctx, ['exploratory'])).toContain(`../${host.name === 'claude' ? 'qa' : 'gstack-qa'}/sections/exploratory.md`);
        if (caller === 'review') {
          const flat = body.replace(/\s+/g, ' ');
          expect(flat).toContain('`## Exploratory QA and Verification Results`');
          expect(flat).toContain('`### Browser results`');
          expect(flat).toMatch(/すべてのチェックポイントにリンクします/);
          expect(flat).toMatch(/2 つ目のレポートは作りません/);
        } else {
          expect(body.replace(/\s+/g, ' ')).toContain('`## Exploratory QA');
          expect(body).toMatch(/すべてのチェックポイントにリンクし、2 つ目のレポートは作りません/);
        }
        expect(body).toContain('templates/functional-report-template.md');
        expect(body).not.toContain('not a second report');
      }
    });

    test(`${host.name}: orchestration logs reviewer attempts before parent-owned edits`, () => {
      const body = RESOLVERS.ADVERSARIAL_STEP(context(host.name, 'review'));
      const flat = body.replace(/\s+/g, ' ');
      expect(flat).toMatch(/Step 5 の Fix-First の処理のために、親のキューに積みます。Step 4\.8 の間は編集しないでください/);
      expect(flat).toMatch(/内側の修復ループは開始しないでください/);
      expect(flat).toMatch(/親の REVIEW_START を上書きしてはいけません/);
      expect(flat).toMatch(/ソース・フェーズ・試行ごとに 1 件のレコードを保存します/);
      expect(flat).toMatch(/各トークンは一度だけ消費されます/);
      expect(body).not.toContain('address the findings. Re-run the same shared structured invocation');
      expect(flat).toMatch(/ネイティブのパスは、Step 5\.8 の完了に必須です/);
    });

    test(`${host.name}: orchestration skips only history matching without user skips`, () => {
      for (const caller of ['review', 'ship']) {
        const body = RESOLVERS.CROSS_REVIEW_DEDUP(context(host.name, caller));
        if (caller === 'ship') {
          const flat = body.replace(/\s+/g, ' ');
          expect(body.indexOf('2. **判断を読みます。**')).toBeLessThan(body.indexOf('3. **証拠を照合します。**'));
          expect(flat).toMatch(/対象になるのは明示的な `skipped` アクションだけで、`fixed`、`auto-fixed`、未回答の質問は対象外です/);
        } else {
          expect(body).toMatch(/現在の指摘の分類は引き続き行います/);
          expect(body.indexOf('過去のレビューがない場合')).toBeLessThan(body.indexOf('`findings` 配列を持つ各 JSONL エントリについて'));
          expect(body).toMatch(/抑制するのは `skipped` の指摘だけです — `fixed` や `auto-fixed` は決して抑制しません/);
        }
        expect(body).not.toContain('skip this step silently');
      }
    });

    test(`${host.name}: orchestration consumes the existing generation allowance at both coverage gates`, () => {
      const body = RESOLVERS.TEST_COVERAGE_GATE_SHIP(context(host.name, 'ship'));
      expect(body).toContain('Step 7 に残っている生成の許容量');
      expect(body.match(/A で、許容量が残っている場合:/g)).toHaveLength(2);
      expect(body).toMatch(/上限に達している場合は、B\/C か停止/);
      expect(body).toMatch(/上限に達している場合は、B か停止/);
      expect(body).toMatch(/上限に達した場合は、A の生成パスを省いて、停止を推奨します/);
      expect(body).toContain('Minimum = 60%、Target = 80%');
      expect(body).not.toContain('Maximum 2 passes total');
    });
  }

  test('report-only recommendations cannot dispatch a repair skill during discovery', () => {
    const skill = readFileSync(join(root, 'qa-only/SKILL.md.tmpl'), 'utf8');
    expect(skill).toMatch(/このレポートのみの実行から、\/qa や別のスキルを決して呼び出さないでください/);
    expect(skill).toMatch(/別途ユーザーが許可した/);
    expect(skill).toMatch(/コミット、スタッシュ、ブートストラップは決して行わないでください/);
  });

  test('standalone QA scopes its general test rule around the approved browser bootstrap', () => {
    const skill = readFileSync(join(root, 'qa/SKILL.md.tmpl'), 'utf8');
    const rule = skill.split('\n').find(line => line.startsWith('**明示的に承認されたブラウザのブートストラップの外では:**'));
    expect(skill).not.toMatch(/^13\. /m);
    expect(rule).toMatch(/Phase 8a\.5 の、許可された明文化/);
    expect(rule).toMatch(/CI の設定を変更したり、既存のテストを弱めたりは決してしないでください/);
    const bootstrap = readFileSync(join(root, 'qa/sections/test-bootstrap.md.tmpl'), 'utf8');
    expect(bootstrap).toMatch(/`\/qa` のブラウザ実行時のみ。機能系や report-only では実行しません/);
    const ask = bootstrap.search(/AskUserQuestion で回答を待つこと/);
    expect(ask).toBeGreaterThan(-1);
    expect(ask).toBeLessThan(bootstrap.search(/実際に選ばれたものだけをインストール/));
    expect(bootstrap).toMatch(/有効な赤いリグレッションテストを黙って削除しないでください/);
    expect(bootstrap).toContain('`.github/workflows/test.yml` を作成または拡張します');
  });

  test('negative controls reject workflow-wide stopping and ungated installation', () => {
    const ctx = context('claude', 'qa');
    const pointer = RESOLVERS.SECTION(ctx, ['browser-setup']);
    expect(() => assertProbeLocalBlocker(pointer + '\nstop that workflow')).toThrow();
    expect(() => assertProbeLocalBlocker(pointer.replace("ほかの安全なプローブ(独立した機能/静的チェック)は続行します", "すべてのチェックを停止します"))).toThrow();
    const setup = render('qa/sections/browser-setup.md.tmpl', ctx);
    expect(() => assertSharedBrowserAuthority(setup.replace('承認された後にのみ', '直ちに'))).toThrow();
    expect(() => assertSharedBrowserAuthority(setup.replace('明示的な承認', '状況の更新'))).toThrow();
    expect(() => assertSharedBrowserAuthority(setup.replace('ブートストラップや、ほかのスキルの呼び出しは決して行わないでください', 'ほかのスキルを呼び出します'))).toThrow();
    expect(() => assertSharedBrowserAuthority(setup + '\nIf `NEEDS_SETUP`: tell the user')).toThrow();
    expect(() => assertSharedBrowserAuthority(setup + '\nAn authenticated page needs /setup-browser-cookies')).toThrow();
  });
});
