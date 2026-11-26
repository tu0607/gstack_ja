import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ALL_HOST_CONFIGS } from '../hosts';
import { runGeneration, type GenerationResult } from '../scripts/gen-skill-docs';
import { discoverSectionTemplates } from '../scripts/discover-skills';
import { SECTION, SECTION_INDEX, sectionPath, usesLazySections } from '../scripts/resolvers/sections';
import { generateQAMethodReads, generateQAResource } from '../scripts/resolvers/qa';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { runBashScript } from './helpers/bash-script';
import { PARITY_INVARIANTS, runParityChecks } from './helpers/parity-harness';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const owned = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-qa-sections-')));
const rendered = path.join(owned, 'rendered');
const setup = fs.readFileSync(path.join(ROOT, 'setup'), 'utf8');
const QA_SKILLS = ['qa', 'qa-only'];
const REPORT_TEMPLATE = fs.readFileSync(path.join(ROOT, 'qa/templates/functional-report-template.md'), 'utf8');
const GENERATED_REPORT = '<!-- AUTO-GENERATED from qa/templates/functional-report-template.md — do not edit directly -->\n<!-- Regenerate: bun run gen:skill-docs -->\n' + REPORT_TEMPLATE;
let generated: GenerationResult;
let fixture: typeof import('../scripts/resolvers/sections');

function put(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function context(host: string, skillName: string): TemplateContext {
  return { host, skillName, tmplPath: '', paths: HOST_PATHS[host] };
}

function setupFunction(name: string): string {
  const start = setup.indexOf(`${name}() {`);
  const end = setup.indexOf('\n}\n', start);
  if (start < 0 || end < 0) throw new Error(`Missing setup function ${name}`);
  return setup.slice(start, end + 2);
}

beforeAll(async () => {
  generated = await runGeneration({ host: 'all', outputRoot: rendered });
  expect(generated.exitCode, JSON.stringify(generated.diagnostics)).toBe(0);
  const fixtureRoot = path.join(owned, 'fixture');
  put(path.join(fixtureRoot, 'scripts/resolvers/sections.ts'), fs.readFileSync(path.join(ROOT, 'scripts/resolvers/sections.ts'), 'utf8'));
  for (const skill of [...QA_SKILLS, 'ship']) {
    put(path.join(fixtureRoot, skill, 'sections/manifest.json'), JSON.stringify({
      skill, sections: [{ id: 'native', file: 'contract-probes.md', title: 'Native probes', trigger: 'probing a native contract' }],
    }));
    put(path.join(fixtureRoot, skill, 'sections/contract-probes.md.tmpl'), 'PRIVATE_SECTION_BODY\n{{INVOKE_SKILL:investigate}}\n');
  }
  fixture = await import(path.join(fixtureRoot, 'scripts/resolvers/sections.ts'));
}, 120_000);

afterAll(() => fs.rmSync(owned, { recursive: true, force: true }));

describe('QA-only cross-host lazy rendering', () => {
  test('Codex review defines omitted-Army records without waiving native or QA completion', () => {
    const codex = ALL_HOST_CONFIGS.find(host => host.name === 'codex')!;
    const text = fs.readFileSync(path.join(rendered, codex.hostSubdir, 'skills/gstack-review/SKILL.md'), 'utf8');
    const record = text.slice(text.indexOf('## Step 5.8: エンジニアリングレビューの結果を保存する')).replace(/\s+/g, ' ');
    expect(text).not.toContain('### Dispatch specialists');
    expect(text).not.toContain('### Step 4.6: 指摘の収集とマージ');
    expect(text).not.toContain('SPECIALIST REVIEW: N findings');
    expectTokens(record, ['`specialists: {}`'], 'record');
    expectMentions(record, [['専門家のカバレッジを主張せず', '`specialists: {}`']], 'record');
    expect(record).toContain('小規模差分の専門家がスキップされた場合、またはホストが Review Army を省略している場合は `10.0`');
    expectMentions(record, [['完了の証拠ではありません']], 'record');
    expectMentions(record, [['失敗', 'ブロック', '判定不能', '未実行', 'false']], 'record');
    expectMentions(record, [['`/ship`', '名指しのリスク受容', '`/review`', '完了させられません']], 'record');
    expectTokens(record, ['`issues_found`'], 'record');
    expectMentions(record, [['`COMPLETED`', 'false', 'INCOMPLETE', 'N=0']], 'record');
  });

  for (const host of ALL_HOST_CONFIGS) {
    test(`${host.name} review loads QA methods before static review and reuses them before probes`, () => {
      const directory = host.name === 'claude' ? 'review' : `${host.hostSubdir}/skills/gstack-review`;
      const text = fs.readFileSync(path.join(rendered, directory, 'SKILL.md'), 'utf8');
      const start = text.indexOf('## Step 4: 重大な問題のパス(コアのレビュー)');
      const core = text.indexOf('チェックリストの 2 つのパスを順番に適用してください', start);
      const exploration = text.indexOf('### Step 4.7: Exploratory QA', core);
      expect(start).toBeGreaterThan(-1);
      expect(core).toBeGreaterThan(start);
      expect(exploration).toBeGreaterThan(core);
      const preparation = text.slice(start, core);
      const loop = preparation.indexOf('sections/exploratory.md');
      expect(loop).toBeGreaterThan(-1);
      expect(preparation).toContain('Step 4 は読み取り専用です。charter、セットアップ、プローブは Step 4.7 に回します');
      expect(preparation).not.toContain('sections/system-functional.md');
      const qaDirectory = host.name === 'claude' ? 'qa' : `${host.hostSubdir}/skills/gstack-qa`;
      const shared = fs.readFileSync(path.join(rendered, qaDirectory, 'sections/exploratory.md'), 'utf8');
      const scope = shared.indexOf('`sections/scope.md`');
      const selection = shared.indexOf('全文 Read し、面を選びます');
      const methods = shared.indexOf('`sections/system-functional.md`');
      expect(scope).toBeGreaterThan(-1);
      expect(selection).toBeGreaterThan(scope);
      expect(methods).toBeGreaterThan(selection);
      expect(shared).toContain('**Browser の面のみ:**');
      expect(preparation).not.toContain('sections/browser-setup.md');
      expect(shared).toContain('sections/qa-patterns.md');
      expect(preparation.replace(/\s+/g, ' ')).toContain('Step 4 は読み取り専用です。charter、セットアップ、プローブは Step 4.7 に回します');
      expect(shared.indexOf('**charter** を書きます')).toBeGreaterThan(methods);
      expectMentions(shared, [['この呼び出し', 'Read', '繰り返']], 'shared');
      const qa = text.slice(exploration, text.indexOf('## Step 5: Fix-First レビュー', exploration));
      const charter = qa.indexOf('**1. charter と隔離を設定します。**');
      const readiness = qa.indexOf('**2. 準備状況を確認し、必要なチェックを列挙します。**');
      const setup = qa.indexOf("QA の `sections/browser-setup.md`");
      const probes = qa.indexOf('**3. スモークとプランのチェックを実行します。**');
      expect(charter).toBeGreaterThan(-1);
      expect(readiness).toBeGreaterThan(charter);
      expect(setup).toBeGreaterThan(readiness);
      expect(probes).toBeGreaterThan(setup);
      expectMentions(qa.slice(charter, readiness).replace(/\s+/g, ' '), [['セットアップの前に', '隔離/許可の事前確認']], 'section');
      const flat = qa.replace(/\s+/g, ' ');
      expectMentions(flat, [['再利用するのは', 'ツール/セッション/対象/所有権', '検証済み']], 'flat');
      expectMentions(flat, [['インストール', 'Cookie', 'ブートストラップ', '行いません']], 'flat');
      expect(flat).toContain('functional のみの場合は、browser のセットアップをスキップします');
      if (usesLazySections(host.name, 'review')) {
        const index = text.slice(text.indexOf('## Section index'), text.indexOf('## Step 1:'));
        expect(index.indexOf('サーフェスの選択と QA 手法の読み込み')).toBeLessThan(index.indexOf('sections/review-army.md'));
      } else {
        expect(text).not.toContain('## Section index');
      }
    });

    for (const skill of QA_SKILLS) {
      test(`${host.name} ${skill} resolves a passive manifest without inlining its body`, () => {
        const ctx = context(host.name, skill);
        expect(usesLazySections(host.name, skill)).toBe(true);
        const reference = fixture.sectionPath(ctx, skill, 'native');
        expect(reference).toContain('`sections/contract-probes.md`');
        expect(reference).toContain('installed');
        expect(reference).toContain('SKILL.md directory');
        expect(reference).toContain(host.name === 'claude' ? `\`${skill}\`` : `\`gstack-${skill}\``);
        const pointer = fixture.SECTION(ctx, ['native']);
        expect(pointer).toContain(reference);
        expect(pointer).toContain('probing a native contract');
        expect(pointer).toContain('プロダクトの作業ディレクトリ');
        expect(pointer).toContain('見つからない、または読み取れない');
        expect(pointer).toContain('QA のセットアップブロッカー');
        expect(pointer).not.toContain('PRIVATE_SECTION_BODY');
        expect(pointer).not.toContain('$GSTACK_ROOT');
        expect(fixture.SECTION_INDEX(ctx)).toContain(reference);
        expect(fixture.SECTION_INDEX(context(host.name, 'ship'), [skill])).toContain(reference);
        expect(fixture.sectionPath(context(host.name, 'review'), skill, 'native')).toBe(reference);
        expect(fixture.sectionPath(context(host.name, 'ship'), skill, 'native')).toBe(reference);
      });
    }

    test(`${host.name} generates all QA section templates and preserves other skills' section policy`, () => {
      const sections = discoverSectionTemplates(ROOT);
      const targets = sections.filter(section => QA_SKILLS.includes(section.skillDir));
      expect(targets.length).toBeGreaterThan(0);
      for (const section of targets) {
        const dir = host.name === 'claude' ? section.skillDir : `${host.hostSubdir}/skills/gstack-${section.skillDir}`;
        const file = `${dir}/sections/${path.basename(section.output)}`;
        expect(generated.artifacts).toContainEqual({ relativePath: file, kind: 'section', host: host.name });
        const body = fs.readFileSync(path.join(rendered, file), 'utf8');
        expect(body).toContain('AUTO-GENERATED');
        expect(body).not.toMatch(/\{\{[A-Z_]+(?::[^}]*)?\}\}/);
        expect(fs.readFileSync(path.join(rendered, dir, 'SKILL.md'), 'utf8')).not.toContain(body.split('\n').slice(2).join('\n').trim());
      }
      const outside = generated.artifacts.filter(artifact => artifact.host === host.name && artifact.kind === 'section'
        && !/^(?:qa|qa-only|ship|plan-ceo-review|office-hours)\//.test(artifact.relativePath)
        && !/\/gstack-(?:qa(?:-only)?|ship|plan-ceo-review|office-hours)\//.test(artifact.relativePath));
      expect(outside.length > 0).toBe(host.name === 'claude');
      // C4: ship is carved on every host; external pointers are relative to the installed skill.
      const ctx = context(host.name, 'ship');
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ship/sections/manifest.json'), 'utf8'));
      const entry = manifest.sections[0];
      expect(usesLazySections(host.name, 'ship')).toBe(true);
      const pointer = host.name === 'claude'
        ? `\`~/.claude/skills/gstack/ship/sections/${entry.file}\``
        : `\`sections/${entry.file}\` relative to the installed \`gstack-ship\` SKILL.md directory`;
      expect(SECTION(ctx, [entry.id])).toBe(`> **STOP.** ${entry.trigger}の前に、Read ${pointer} を全文読んで実行してください。\n> 記憶から作業しないこと。このステップの正はそのセクションです。`);
      // Skills carved only on Claude still inline their sections elsewhere.
      const reviewCtx = context(host.name, 'review');
      const reviewEntry = JSON.parse(fs.readFileSync(path.join(ROOT, 'review/sections/manifest.json'), 'utf8')).sections[0];
      expect(usesLazySections(host.name, 'review')).toBe(host.name === 'claude');
      if (host.name !== 'claude') {
        expect(SECTION(reviewCtx, [reviewEntry.id])).toBe(fs.readFileSync(path.join(ROOT, 'review/sections', `${reviewEntry.file}.tmpl`), 'utf8').trimEnd());
        expect(SECTION_INDEX(reviewCtx)).toBe('');
      }
    });

    test(`${host.name} packages the authored functional report beside the QA entrypoint`, () => {
      const dir = host.name === 'claude' ? 'qa' : `${host.hostSubdir}/skills/gstack-qa`;
      const relativePath = `${dir}/templates/functional-report-template.md`;
      expect(generated.artifacts.find(artifact => artifact.relativePath === relativePath))
        .toEqual({ relativePath, kind: 'asset', host: host.name });
      expect(fs.readFileSync(path.join(rendered, relativePath), 'utf8'))
        .toBe(host.name === 'claude' ? REPORT_TEMPLATE : GENERATED_REPORT);
    });

    test(`${host.name} qa-only reads shared browser setup directly without a redirect section`, () => {
      const dir = host.name === 'claude' ? 'qa-only' : `${host.hostSubdir}/skills/gstack-qa-only`;
      const entry = fs.readFileSync(path.join(rendered, dir, 'SKILL.md'), 'utf8');
      const browserRead = generateQAResource(context(host.name, 'qa-only'), ['browser-setup']);
      expect(entry).toContain(browserRead);
      expect(entry.indexOf('**ブラウザの対象のみ:**')).toBeLessThan(entry.indexOf(browserRead));
      expect(browserRead).toContain(sectionPath(context(host.name, 'qa-only'), 'qa', 'browser-setup'));
      expect(browserRead).toContain('このホストにインストールされた呼び出し元スキル');
      expect(browserRead).toContain('プロダクトのディレクトリや他ホストのもので代用してはいけません');
      expect(browserRead).toContain('見つからない/読み取れないアセットは、必須の QA をブロックします');
      expect(browserRead).toContain('ほかの安全なプローブ');
      expect(generated.artifacts.some(artifact => artifact.relativePath === `${dir}/sections/browser-setup.md`)).toBe(false);
      const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'qa-only/sections/manifest.json'), 'utf8'));
      expect(manifest.sections.some((section: { id: string }) => section.id === 'browser-setup')).toBe(false);
      for (const name of ['browser-setup.md.tmpl', 'browser-setup.md']) {
        expect(fs.existsSync(path.join(ROOT, 'qa-only/sections', name))).toBe(false);
      }
    });

    test(`${host.name} both QA entrypoints reach shared functional modes before probes`, () => {
      const qaDirectory = host.name === 'claude' ? 'qa' : `${host.hostSubdir}/skills/gstack-qa`;
      const functional = fs.readFileSync(path.join(rendered, qaDirectory, 'sections/system-functional.md'), 'utf8');
      const modes = functional.slice(functional.indexOf('## Functional modes'), functional.indexOf('## Contract map')).replace(/\s+/g, ' ');
      for (const contract of [
        '**Full**(デフォルト)', '文書化されたすべての契約を網羅します', '**Quick**(`--quick`)',
        '成功と、変更された最もリスクの高いエッジを確認し', 'not run とします',
        '**Regression**(`--regression <previous-report>`)', 'プローブの前に、渡された',
        'functional レポートとリンクされたリプレイ証拠を読みます', 'ベースラインが欠落している、読めない、または対象が違う',
        '場合は、regression モードをブロックします', 'browser のみの `baseline.json` は functional の',
        '所有するセットアップを再確立し', '以前に失敗したプローブを文書化された',
        '記録されたバグのある出力に対してではありません', '変更された隣接する挙動を確認します', '以前のレポートは保存し',
        '修正済み、まだ失敗、新規の指摘を別々に報告します', '安全なリプレイ入力が欠けている場合は、影響を受けるプローブをブロックし',
        'pass には数えません', 'mixed の実行では、各面のモードを別々に適用します',
        '上限付きスモークと明示的なプランのチェックを保持し、Full の探索は行いません',
      ]) expect(modes).toContain(contract);
      expect(functional.indexOf('## Functional modes')).toBeLessThan(functional.indexOf('## Execute and retain evidence'));
      for (const skill of QA_SKILLS) {
        const dir = host.name === 'claude' ? skill : `${host.hostSubdir}/skills/gstack-${skill}`;
        const entry = fs.readFileSync(path.join(rendered, dir, 'SKILL.md'), 'utf8');
        expect(entry).toContain('| Mode | full | `--quick`、`--regression <previous-report-or-baseline>` |');
        expect(entry).toContain(sectionPath(context(host.name, skill), skill, 'exploratory'));
        expect(entry).not.toContain('## Functional modes');
        const explorer = fs.readFileSync(path.join(rendered, dir, 'sections/exploratory.md'), 'utf8');
        const functionalRead = '`sections/system-functional.md` を全文 Read します。';
        expect(entry).not.toContain(functionalRead);
        expect(entry).toContain(skill === 'qa' ? '共有セクションの順序付けられた準備に従い' : '共有の準備ゲート(すぐ下の exploratory の STOP)をここで読み込んでください');
        expect(explorer).toContain(generateQAMethodReads(context(host.name, skill)));
        const stages = ['1. `sections/scope.md`', '全文 Read し、面を選びます', functionalRead,
          '`sections/qa-patterns.md` を全文 Read します。', '**charter** を書きます', '1. まず成功を実証します'];
        const positions = stages.map(stage => explorer.indexOf(stage));
        expect(positions.every(position => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        expect(explorer.split(functionalRead)).toHaveLength(2);
        expectMentions(explorer, [['この呼び出し', 'Read', '繰り返']], 'explorer');
        if (skill === 'qa') {
          expect(entry).toMatch(/`--quick` は、Quick の修正階層と Quick の探索の両方を設定します/);
          expect(entry).toContain('`--exhaustive` は修正階層のみを変更します');
          for (const tier of ['**Quick:** critical と high の重大度のみを修正', '**Standard:** + medium の重大度(デフォルト)', '**Exhaustive:** + low/cosmetic の重大度']) expect(entry).toContain(tier);
        } else {
          expectMentions(entry, [['何も修正せず', '製品のテスト', '変更しないでください']], 'entry');
          const browserSetup = entry.indexOf('## Browser Setup(条件付き)');
          const selectedChecks = entry.indexOf('## Run the Selected Checks');
          expect(browserSetup).toBeGreaterThan(0);
          expect(selectedChecks).toBeGreaterThan(browserSetup);
          expect(entry.lastIndexOf(sectionPath(context(host.name, skill), skill, 'exploratory'))).toBeLessThan(browserSetup);
          expect(entry.slice(browserSetup, selectedChecks)).not.toContain(functionalRead);
          expectMentions(entry, [['準備を最初から', 'やり直さないでください']], 'entry');
          expect(entry).toContain('チャーター、時計、プローブは、Run the Selected Checks まで延期します');
          expectMentions(explorer, [['チャーター', 'プローブ', '前に', '完了']], 'explorer');
          expect(explorer).toContain('## 3. Parent handoff');
          expect(explorer).toContain('test_stub の提案を返します');
          expectMentions(explorer, [['テストを作成', 'バグのある出力を固定', 'いけません']], 'explorer');
          expect(explorer).not.toMatch(/修復の前に|\/review と \/ship では/);
        }
      }
      const browser = fs.readFileSync(path.join(rendered, qaDirectory, 'sections/qa-patterns.md'), 'utf8');
      expect(browser).toContain('### Regression (`--regression <baseline>`)');
      expect(browser).not.toContain('## Functional modes');
    });

    test(`${host.name} caller-relative QA resources resolve within the generated installation`, () => {
      const base = host.name === 'claude' ? rendered : path.join(rendered, host.hostSubdir, 'skills');
      const prefix = host.name === 'claude' ? '' : 'gstack-';
      for (const caller of ['review', 'ship']) {
        const dir = path.join(base, `${prefix}${caller}`);
        const body = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8')
          + (caller === 'ship' // C4: ship is carved on every host
            ? fs.readFileSync(path.join(dir, 'sections/review-army.md'), 'utf8') : '');
        expect(body).toContain(`インストール済みの /${caller} の SKILL.md があるディレクトリから`);
        expect(body).toContain(`\`../${prefix}qa/sections/exploratory.md\` を全文 Read します`);
        const scopeTarget = path.resolve(dir, `../${prefix}qa/sections/scope.md`);
        expect(fs.realpathSync(scopeTarget)).toBe(path.join(base, `${prefix}qa/sections/scope.md`));
        const target = path.resolve(dir, `../${prefix}qa/sections/exploratory.md`);
        expect(fs.realpathSync(target)).toBe(path.join(base, `${prefix}qa/sections/exploratory.md`));
        expect(fs.readFileSync(target, 'utf8')).toContain('# Shared exploratory QA');
        expect(fs.readFileSync(target, 'utf8')).toContain(sectionPath(context(host.name, 'qa'), 'qa', 'scope'));
        expect(fs.readFileSync(scopeTarget, 'utf8')).toContain('**browser**、**functional**');
        if (host.name === 'claude') {
          expect(body).toContain(`呼び出し元のディレクトリが \`gstack-${caller}\` で始まる場合は`);
          expect(body).toContain('代わりに `../gstack-qa/sections/exploratory.md` を使い');
          if (caller === 'review') {
            expectMentions(body, [['QA のインストール', '解決できない', 'ブロッカー']], 'body');
            expectMentions(body, [['このホストのインストール', 'プロダクトのツリー', '決して']], 'body');
            expect(body).toContain('見つからない/読み取れないアセットは、必須の QA をブロックします');
          }
          const registry = path.join(owned, 'prefixed-callers', caller);
          fs.mkdirSync(path.join(registry, `gstack-${caller}`), { recursive: true });
          fs.cpSync(path.join(base, 'qa'), path.join(registry, 'gstack-qa'), { recursive: true });
          const prefixedTarget = path.resolve(registry, `gstack-${caller}`, '../gstack-qa/sections/exploratory.md');
          const prefixedScope = path.resolve(registry, `gstack-${caller}`, '../gstack-qa/sections/scope.md');
          expect(fs.readFileSync(prefixedScope, 'utf8')).toBe(fs.readFileSync(scopeTarget, 'utf8'));
          expect(fs.readFileSync(prefixedTarget, 'utf8')).toBe(fs.readFileSync(target, 'utf8'));
          expect(fs.existsSync(path.resolve(registry, `gstack-${caller}`, '../qa/sections/exploratory.md'))).toBe(false);
        }
      }
    });
  }

  test('freshly rendered QA modes retain the fixed parity and prompt-size limits', () => {
    const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'test/fixtures/parity-baseline-v1.64.1.0.json'), 'utf8'));
    const report = runParityChecks({ repoRoot: rendered, baseline,
      invariants: PARITY_INVARIANTS.filter(invariant => QA_SKILLS.includes(invariant.skill)) });
    expect(report.totalChecks).toBe(2);
    expect(report.details.filter(detail => !detail.passed)).toEqual([]);
  });

  test('invalid IDs and missing source assets fail rather than producing a usable pointer', () => {
    for (const host of ALL_HOST_CONFIGS) {
      expect(() => fixture.SECTION(context(host.name, 'qa'), [])).toThrow('requires a section id');
      expect(() => fixture.sectionPath(context(host.name, 'ship'), 'qa', 'unknown')).toThrow('no section "unknown"');
    }
    const template = path.join(owned, 'fixture/qa-only/sections/contract-probes.md.tmpl');
    fs.unlinkSync(template);
    try {
      for (const host of ALL_HOST_CONFIGS) {
        expect(() => fixture.SECTION(context(host.name, 'qa-only'), ['native'])).toThrow('contract-probes.md.tmpl');
      }
    } finally {
      fs.writeFileSync(template, 'PRIVATE_SECTION_BODY\n');
    }
  });

  test('dry-run reports missing QA sections and authored report assets without recreating them', async () => {
    const artifacts = generated.artifacts.filter(artifact =>
      artifact.kind === 'section' && /^(?:\.[^/]+\/skills\/gstack-)?qa\/sections\//.test(artifact.relativePath)
      || artifact.kind === 'asset' && artifact.relativePath.endsWith('/templates/functional-report-template.md'));
    expect(artifacts.length).toBeGreaterThanOrEqual(ALL_HOST_CONFIGS.length);
    const originals = artifacts.map(artifact => ({ ...artifact, body: fs.readFileSync(path.join(rendered, artifact.relativePath)) }));
    for (const artifact of originals) fs.unlinkSync(path.join(rendered, artifact.relativePath));
    try {
      const result = await runGeneration({ host: 'all', outputRoot: rendered, dryRun: true });
      expect(result.exitCode).toBe(1);
      expect(result.diagnostics.filter(diagnostic => diagnostic.kind === 'error')).toEqual([]);
      expect(result.diagnostics.filter(diagnostic => diagnostic.kind === 'stale').map(diagnostic => diagnostic.relativePath).sort())
        .toEqual(artifacts.map(artifact => artifact.relativePath).sort());
      for (const artifact of artifacts) expect(fs.existsSync(path.join(rendered, artifact.relativePath))).toBe(false);
    } finally {
      for (const artifact of originals) fs.writeFileSync(path.join(rendered, artifact.relativePath), artifact.body);
    }
  });
});

describe('installed QA pointers', () => {
  test('QA-only reads methods and finalization before their dependent writes', () => {
    const source = fs.readFileSync(path.join(ROOT, 'qa-only/SKILL.md.tmpl'), 'utf8');
    const stages = ['共有の準備ゲート(すぐ下の exploratory の STOP)をここで読み込んでください', '{{SECTION:exploratory}}',
      '## Prepare Report Artifacts', '## Run the Selected Checks', '必要な Read を完了させ、レポートの所有権を解決したら、チャーターを所有するレポートに Write し',
      '### レポートを組み立てる', '{{SECTION:reporting}}', '### 検証済みのレポートを書く'];
    const positions = stages.map(stage => source.indexOf(stage));
    expect(positions.every(position => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(source.indexOf('同一の内容を書き込みます')).toBeGreaterThan(source.indexOf('{{SECTION:reporting}}'));
    expect(source).not.toContain('{{SLUG_SETUP}}');
    expect(source).not.toContain('{{SLUG_EVAL}}');
    expectMentions(source, [['繰り返し禁止', '準備の Read', '確定の Read', '適用されません']], 'source');
    expectTokens(source, ['**Charters**'], 'source');
    expectMentions(source.replace(/\s+/g, ' '), [['チャーター', 'メタデータ', '指摘の前', '残してください']], 'source');
  });

  test('QA-only defines standalone permissions, mixed modes and outside changes', () => {
    const source = ['qa-only/SKILL.md.tmpl', 'qa-only/sections/reporting.md.tmpl']
      .map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n').replace(/\s+/g, ' ');
    expect(source).toContain('**caller** はこの /qa-only のワークフローを指します');
    expect(source).toContain('**Owned** は、この実行のために作成された、またはこの実行に明示的に割り当てられたものを指します。書き込み可能というだけでは該当しません');
    expectMentions(source, [['/qa-only を単独で呼び出しても', 'この許可は与えられません']], 'source');
    expectMentions(source, [['禁止された', '作らないでください']], 'source');
    expectMentions(source, [['指定しない限り', '選択されたすべての対象']], 'source');
    expectMentions(source, [['ソース/差分の読み取り', '変更', 'だけ']], 'source');
    expectTokens(source, ['`TODOS.md`'], 'source');
    expect(source).toContain('デフォルトは機能、次にブラウザです');
    expectMentions(source, [['対象を切り替えても', '期限は延長されません']], 'source');
    expect(source).toContain('CLI の実行ファイルのベース名');
    expect(source).toContain('**明示的な許可がない場合:** 学習ストアへの書き込みはスキップし、レポートに進みます');
    expect(source).toContain('**明示的な許可がある場合:** まず、指定されたストアを読み込んでください');
    expect(source).toContain('ログ記録のヘルパーは実行しないでください');
    expect(source).not.toContain('{{LEARNINGS_LOG}}');
    for (const host of ALL_HOST_CONFIGS) {
      const directory = host.name === 'claude' ? 'qa-only' : `${host.hostSubdir}/skills/gstack-qa-only`;
      const explorer = fs.readFileSync(path.join(rendered, directory, 'sections/exploratory.md'), 'utf8').replace(/\s+/g, ' ');
      expectMentions(explorer, [['自分でプロダクトを変更してはいけません']], 'explorer');
      expect(explorer).toContain('元の limits/メモは保持し');
    }
  });

  test('report-only scope, modes and output overrides precede browser setup', () => {
    const source = fs.readFileSync(path.join(ROOT, 'qa-only/SKILL.md.tmpl'), 'utf8');
    const stages = ['## Request Parameters', '## Test Plan Context', '{{LEARNINGS_SEARCH}}',
      '## Select Surfaces and Isolation', '{{SECTION:exploratory}}', '## Prepare Report Artifacts',
      '## Browser Setup(条件付き)', '{{QA_RESOURCE:browser-setup}}', '## Run the Selected Checks'];
    const positions = stages.map(stage => source.indexOf(stage));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(source).not.toContain('{{SECTION:browser-setup}}');
    expect(source).not.toContain('{{QA_METHOD_READS}}');
    expect(source).toContain('共有の準備ゲート(すぐ下の exploratory の STOP)をここで読み込んでください');
    expectMentions(source, [['解析はリクエストを記録するだけ', 'セットアップは開始しません']], 'source');
    expectTokens(source, ['`--quick`', '`--regression`'], 'source');
    expectMentions(source, [['`--quick`', '`--regression`', '1 つのモード', '選んで']], 'source');
    expect(source).toContain('$REPORT_DIR/qa-report-{target}-{YYYY-MM-DD}.md');
    expect(source).not.toContain('qa-report-{domain}');
    expect(source.indexOf('`REPORT_FILE` には、呼び出し元が指定')).toBeLessThan(source.indexOf('## Browser Setup(条件付き)'));
    expectTokens(source, ['`REPORT_FILE`'], 'source');
    expectMentions(source.replace(/\s+/g, ' '), [['チャーターと最終的な指摘', 'サイドカーではなく']], 'source.replace(/\s+/g,  )');
    const browser = fs.readFileSync(path.join(ROOT, 'qa/sections/browser-setup.md.tmpl'), 'utf8');
    expectMentions(browser, [['セットアップ/インストール', 'Cookie インポート', '実行しないでください']], 'browser');
    expect(browser).toContain('セクションの所有権のルールは、LOCAL のブラウザの対象にも適用されます');
  });

  test('QA entrypoints preserve previous artifacts before browser setup without expanding caller authority', () => {
    for (const skill of QA_SKILLS) {
      const source = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md.tmpl'), 'utf8');
      const browser = skill === 'qa' ? '{{SECTION:browser-setup}}' : '{{QA_RESOURCE:browser-setup}}';
      const setup = source.slice(0, source.indexOf(browser)).replace(/\s+/g, ' ');
      expect(setup).toContain('以前のレポート');
      expect(setup).toMatch(/書き込みの前に、指定された以前のレポート.{0,3}ベースラインのパス/);
      expectMentions(setup, [['空の場合にのみ', 'REPORT_DIR'], ['空でない場合は', 'サブディレクトリ']], 'setup');
      if (skill === 'qa-only') {
        expectMentions(setup, [['成果物は決して上書きしないでください']], 'setup');
      } else {
        expectMentions(setup, [['スクリーンショット', '探索メモ', '決して上書きしないでください']], 'setup');
      }
      expect(setup).toMatch(/(?:保存ができない|保持できない)場合は.*出力のブロッカー/);
      expect(setup).toMatch(/書き込み(?:の)?権限を広げ/);
    }
    const source = fs.readFileSync(path.join(ROOT, 'qa-only/SKILL.md.tmpl'), 'utf8').replace(/\s+/g, ' ');
    expectMentions(source, [['確立された', '再検証', '不要です']], 'source');
    expectMentions(source, [['保存先が存在する場合は', 'サフィックス付き']], 'source');
  });

  test('mixed report labels, metadata and baselines have one explicit assembly rule', () => {
    const source = fs.readFileSync(path.join(ROOT, 'qa-only/SKILL.md.tmpl'), 'utf8').replace(/\s+/g, ' ');
    for (const contract of [
      '`mixed-{project-label}`', 'リポジトリ名も同じ方法でサニタイズします', '`mixed-target`',
      '個々の対象はレポート内に一覧にしてください', '共通のメタデータは 1 度だけ記載してください', '**Browser:**', '**Functional:**',
      '`templates/qa-report-template.md`', '`templates/functional-report-template.md`',
      '共有のタイトルとメタデータを重複させないでください',
      'ブラウザのスコアはブラウザのカバレッジにのみ適用され、機能の結果と組み合わせないでください',
      '現在のベースラインまたはリプレイの根拠、チェックポイントをリンクしてください',
      'リグレッションは、以前の入力ベースライン/レポートもリンクします',
      'Full/Quick では、以前のベースラインは該当しません',
      '機能のリグレッションでは、レポートとリプレイの根拠がベースラインになります',
      'レポートのみの修復/テストの項目には、提案または未実行の状態のみを記載し、編集を行ったという主張は書かないでください',
    ]) expect(source).toContain(contract);
  });

  test('QA-only distinguishes shared browser artifacts from per-surface clocks and checkpoints', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const directory = host.name === 'claude' ? 'qa-only' : `${host.hostSubdir}/skills/gstack-qa-only`;
      const source = fs.readFileSync(path.join(rendered, directory, 'SKILL.md'), 'utf8');
      const start = source.indexOf('### 出力の構造');
      expect(start).toBeGreaterThan(-1);
      const layout = source.slice(start, source.indexOf('\n---', start));
      expect(layout).toContain('`REPORT_DIR` は、実行を通してレポートのルートのままです');
      expectTokens(layout.replace(/\s+/g, ' '), ['`$REPORT_DIR/screenshots/`', '`$REPORT_DIR/baseline.json`'], 'layout.replace(/\s+/g,  )');
      expectMentions(layout.replace(/\s+/g, ' '), [['ブラウザのみの実行と混合の実行では', 'スクリーンショット']], 'layout.replace(/\s+/g,  )');
      expectMentions(layout, [['混合対象の分割', '時計とチェックポイントにのみ適用されます']], 'layout');
      expect(layout).toContain('| 対象は 1 つ(ブラウザまたは機能) | `$REPORT_DIR` |');
      expect(layout).toContain('| 混合: ブラウザのプローブ | `$REPORT_DIR/browser` |');
      expect(layout).toContain('| 混合: 機能のプローブ | `$REPORT_DIR/functional` |');
      expect(layout.replace(/\s+/g, ' ')).toContain('時間が計られた場合にのみ `deadline.json`');
      expect(layout).toContain('呼び出し元が固定したパスは、このレイアウトより優先されます');
      expectTokens(layout.replace(/\s+/g, ' '), ['`REPORT_DIR`'], 'layout.replace(/\s+/g,  )');
      expectMentions(layout.replace(/\s+/g, ' '), [['REPORT_DIR', '対象のディレクトリに振り直したり', 'しないでください']], 'layout.replace(/\s+/g,  )');
    }
  });

  test('QA-only persists its plan before probes and separates observed facts from hypotheses', () => {
    for (const host of ALL_HOST_CONFIGS) {
      const directory = host.name === 'claude' ? 'qa-only' : `${host.hostSubdir}/skills/gstack-qa-only`;
      const entry = fs.readFileSync(path.join(rendered, directory, 'SKILL.md'), 'utf8');
      const reporting = fs.readFileSync(path.join(rendered, directory, 'sections/reporting.md'), 'utf8');
      const directive = SECTION(context(host.name, 'qa-only'), ['reporting']);
      expect(entry).toContain(directive);
      expect(entry.indexOf(directive)).toBeGreaterThan(entry.indexOf('### レポートを組み立てる'));
      expectMentions(entry, [['このステップでは', '期限切れの時計を再開する', '許可されません']], 'entry');
      expect(entry).toContain('reporting を先読みしないでください');
      expect(directive).toContain('Read `sections/reporting.md`');
      expect(directive).toContain('見つからない/読み取れないアセットは、必須の QA をブロックします');
      expect(entry).not.toContain('## 1. 各指摘を一度だけ確定する');
      const source = (entry + '\n' + reporting).replace(/\s+/g, ' ');
      expectMentions(source, [['レポートの所有権を解決したら', 'Write が成功した結果を待ってください']], 'source');
      expect(source).toContain('失敗したベースラインの契約は、失敗のままにします');
      expectMentions(source, [['コンソールのエラーメッセージ', '証明するものではありません']], 'source');
      expectMentions(source, [['ページのテキスト抽出', 'アクセス不能', '証明するものではありません']], 'source');
      expectMentions(source, [['独自の測定がない限り', '遅延として扱わないでください']], 'source');
      expect(source).toContain('**Probe budget**(設定された上限)');
      expect(source).toContain('**Guarded command time**(測定された子のスパンの合計)');
      expect(source).toContain('**Total session elapsed** には、レポートを書いている呼び出しについて `unmeasured` を使ってください');
      expectMentions(source, [['期限のウィンドウは', '総実行時間ではありません']], 'source');
      expectMentions(source, [['受領書の間の隔たり', 'ステータスや Write のオーバーヘッドを測定するものではなく']], 'source');
      expectMentions(source, [['期限後にフォローアップを送った', 'とだけ述べてください']], 'source');
      expectMentions(source, [['確認応答', 'まだ完了していません']], 'source');
      expectTokens(source, ['**Measured interval**'], 'source');
      expectMentions(source, [['開始/終了の受領書', '境界', '明記しなければなりません']], 'source');
      expectMentions(source, [['例外のような文字列', '指定された操作が実行されたことを証明しません']], 'source');
      expectMentions(source, [['一度観察しただけでは', '確認されたことにはなりません']], 'source');
      expectMentions(source, [['慎重で事実に基づいた', '一字一句そのまま再利用']], 'source');
      expectMentions(source, [['言い換えを導入しないでください']], 'source');
      const exploratory = fs.readFileSync(path.join(rendered, directory, 'sections/exploratory.md'), 'utf8').replace(/\s+/g, ' ');
      expectMentions(exploratory, [['区切り', '子のテキストではありません']], 'exploratory');
      expectMentions(source, [['例外のみのフック', 'コンソールだけのメッセージは検出できません']], 'source');
      expectMentions(source, [['整合性チェックの後にのみ', 'レポートを書いてください']], 'source');
      expectMentions(source, [['許可された保存先', '書き込んでください']], 'source');
      expectTokens(source, ['`REPORT_FILE`'], 'source');
      expectMentions(source, [['学習ストア', '自動メモリ', '書き込まないでください']], 'source');
      const stages = ['## 1. 各指摘を一度だけ確定する', '## 2. タイミングのフィールドを実際の境界から記入する', '## 3. 書き込む前に、すべての繰り返しを組み立てて確認する'];
      const positions = stages.map(stage => reporting.indexOf(stage));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    }
  });

  const installers = new Set(['claude', 'codex', 'factory', 'kiro', 'opencode', 'cursor']);
  const helpers = [
    '_link_or_copy', '_print_windows_copy_note_once', '_link_skill_runtime_assets', '_gstack_link_target_abs', '_gstack_target_is_ours',
    '_gstack_generated_header', '_claude_entry_owned_strongly', '_claude_entry_is_ours', '_write_owned_marker',
    '_backup_skill_md', '_cleanup_weak_dir', '_gstack_dir_only_links', '_cleanup_linked_dir',
    '_owned_for_windows_refresh', '_sidecar_root_user_owned', '_prune_stale_generated', '_skill_source_exists',
    '_link_runtime_dists', '_copy_runtime_skill_refs', '_copy_skill_md', '_skill_copy_hash', '_skill_copy_unmodified', '_preserve_skill_copy_edits', '_record_skill_copies',
  ].map(setupFunction).join('\n')
    // Install-registry rows (setup's _setup_arm_* / _setup_row) are not under test here.
    + '\n_setup_arm_begin() { :; }\n_setup_arm_publish() { :; }\n_setup_row() { :; }';
  const kiroStart = setup.indexOf('# 6. Install for Kiro CLI');
  const kiroBlock = setup.slice(kiroStart, setup.indexOf('# 6b.', kiroStart));

  for (const host of ALL_HOST_CONFIGS) {
    for (const copy of process.platform === 'win32' ? [true] : [false, true]) {
      test(`${host.name} ${copy ? 'copies' : 'links'} resolve in global/local ${installers.has(host.name) ? 'setup installs' : 'rendered layouts (no setup arm)'}`, () => {
        const base = fs.mkdtempSync(path.join(owned, `${host.name}-`));
        const source = path.join(base, 'payload');
        const native = host.name === 'claude' ? source : path.join(source, host.hostSubdir, 'skills');
        const names = QA_SKILLS.filter(skill => fs.existsSync(path.join(ROOT, skill, 'sections/manifest.json')));
        expect(names).toContain('qa');
        for (const skill of names) {
          const name = host.name === 'claude' ? skill : `gstack-${skill}`;
          const original = host.name === 'claude' ? path.join(rendered, skill) : path.join(rendered, host.hostSubdir, 'skills', name);
          fs.cpSync(original, path.join(native, name), { recursive: true });
          put(path.join(source, skill, 'SKILL.md.tmpl'), `---\nname: ${skill}\n---\n`);
        }
        const homes = [path.join(base, 'home', path.dirname(host.globalRoot)), path.join(base, 'repo', path.dirname(host.localSkillRoot))];
        if (host.name === 'codex') homes.push(path.join(base, 'custom-codex-home/skills'));
        for (const registry of homes) {
          for (const prefix of host.name === 'claude' ? [0, 1] : [1]) {
            fs.mkdirSync(registry, { recursive: true });
            let install: string;
            if (host.name === 'kiro') {
              for (const file of ['bin/tool', 'lib/helper', 'browse/dist/browse', 'browse/bin/helper']) put(path.join(source, file), 'fixture');
              for (const name of ['gstack', 'gstack-upgrade']) put(path.join(native, name, 'SKILL.md'), '<!-- AUTO-GENERATED from SKILL.md.tmpl -->\n<!-- Regenerate: bun run gen:skill-docs -->\n');
              install = `INSTALL_KIRO=1\nKIRO_SKILLS="$REGISTRY"\n${kiroBlock}`;
            } else if (installers.has(host.name)) {
              const name = `link_${host.name}_skill_dirs`;
              install = `${setupFunction(name)}\n${name} "$SOURCE_GSTACK_DIR" "$REGISTRY"`;
            } else {
              install = names.map(skill => `_link_or_copy "$NATIVE/gstack-${skill}" "$REGISTRY/gstack-${skill}"`).join('\n');
            }
            const script = [
              'set -e', `IS_WINDOWS=${copy ? 1 : 0}`, `SKILL_PREFIX=${prefix}`, 'QUIET=1',
              '_FOREIGN_SKIPPED_ENTRIES=()', '_BACKED_UP_SKILL_MDS=()', '_SKILL_BACKUP_ROOT="$HOME/backups"',
              'GSTACK_USER_RENDER_DIR="$HOME/absent-render"',
              'GSTACK_STATE_ROOT="$HOME/.gstack"', '_SKILL_COPIES_FILE="$GSTACK_STATE_ROOT/skill-copies.tsv"', helpers,
              'log() { :; }', '_browser_hint() { :; }', 'bun_cmd() { :; }', install,
            ].join('\n');
            const runInstall = () => runBashScript(script, {
              cwd: base, timeout: 30_000,
              env: { ...process.env, HOME: path.join(base, 'isolated-home'), REGISTRY: registry, SOURCE_GSTACK_DIR: source, NATIVE: native },
            });
            const result = runInstall();
            expect(result.status, result.stderr).toBe(0);
            expect(result.stderr).not.toContain('command not found');
            for (const skill of names) {
              const name = host.name === 'claude' && !prefix ? skill : `gstack-${skill}`;
              const entry = path.join(registry, name, 'SKILL.md');
              const body = fs.readFileSync(entry, 'utf8');
              const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, skill, 'sections/manifest.json'), 'utf8'));
              for (const section of manifest.sections) {
                const ref = sectionPath(context(host.name, skill), skill, section.id);
                expect(body).toContain(ref);
                const relative = ref.match(/^`([^`]+)`/)![1];
                const installed = path.resolve(path.dirname(entry), relative);
                const resolved = fs.realpathSync(installed);
                expect(resolved.startsWith(fs.realpathSync(base) + path.sep)).toBe(true);
                expect(fs.readFileSync(installed, 'utf8')).toBe(fs.readFileSync(path.join(native, host.name === 'claude' ? skill : `gstack-${skill}`, relative), 'utf8'));
                expect(fs.existsSync(path.resolve(base, relative))).toBe(false);
                fs.renameSync(resolved, `${resolved}.absent`);
                try {
                  expect(() => fs.readFileSync(installed, 'utf8')).toThrow('ENOENT');
                  expect(body).toContain('見つからない、または読み取れない');
                  expect(body).toContain('QA のセットアップブロッカー');
                } finally {
                  fs.renameSync(`${resolved}.absent`, resolved);
                }
              }
              const explorer = fs.readFileSync(path.join(path.dirname(entry), 'sections/exploratory.md'), 'utf8');
              expect(body).not.toContain(generateQAMethodReads(context(host.name, skill)));
              expect(body).toContain(skill === 'qa' ? '共有セクションの順序付けられた準備に従い' : '共有の準備ゲート(すぐ下の exploratory の STOP)をここで読み込んでください');
              expect(explorer).toContain(generateQAMethodReads(context(host.name, skill)));
              expect(explorer.indexOf('全文 Read し、面を選びます')).toBeLessThan(explorer.indexOf('`sections/system-functional.md`'));
              expect(explorer.indexOf('`sections/system-functional.md`')).toBeLessThan(explorer.indexOf('**charter** を書きます'));
              const qaName = host.name === 'claude' && !prefix ? 'qa' : 'gstack-qa';
              const qaDirectory = path.join(registry, qaName);
              const functional = fs.readFileSync(path.join(qaDirectory, 'sections/system-functional.md'), 'utf8');
              const reportReference = functional.match(/インストール済みの QA の SKILL\.md からの相対パスで `([^`]+)` を使います/);
              expect(reportReference).not.toBeNull();
              const report = path.resolve(qaDirectory, reportReference![1]);
              const resolvedReport = fs.realpathSync(report);
              expect(resolvedReport.startsWith(fs.realpathSync(base) + path.sep)).toBe(true);
              expect(fs.readFileSync(report, 'utf8'))
                .toBe(host.name === 'claude' ? REPORT_TEMPLATE : GENERATED_REPORT);
              fs.renameSync(resolvedReport, `${resolvedReport}.absent`);
              try {
                expect(() => fs.readFileSync(report, 'utf8')).toThrow('ENOENT');
                expectMentions(explorer, [['アセット', '前提条件', '許可', '影響を受けるプローブをブロック'], ['独立した安全なチェックはブロックしません']], 'explorer');
                expectMentions(explorer, [['現在の入力', '必要な契約', 'pass']], 'explorer');
              } finally {
                fs.renameSync(`${resolvedReport}.absent`, resolvedReport);
              }
            }
            if (host.name === 'kiro') {
              const templates = path.join(registry, 'gstack-qa/templates');
              const report = path.join(templates, 'functional-report-template.md');
              const sourceReport = path.join(native, 'gstack-qa/templates/functional-report-template.md');
              for (const candidate of [templates, report, sourceReport]) {
                expect(fs.realpathSync(candidate).startsWith(fs.realpathSync(base) + path.sep)).toBe(true);
              }
              const original = fs.readFileSync(sourceReport, 'utf8');
              const custom = path.join(templates, 'custom.md');
              fs.writeFileSync(custom, 'unrelated user template');
              try {
                const updated = original + '\nUpdated report instructions.\n';
                fs.writeFileSync(sourceReport, updated);
                if (!copy) {
                  const previous = path.join(source, 'previous-report.md');
                  fs.writeFileSync(previous, original);
                  fs.unlinkSync(report);
                  fs.symlinkSync(previous, report);
                }
                const refreshed = runInstall();
                expect(refreshed.status, refreshed.stderr).toBe(0);
                expect(fs.readFileSync(report, 'utf8')).toBe(updated);
                expect(fs.readFileSync(custom, 'utf8')).toBe('unrelated user template');

                fs.unlinkSync(report);
                fs.writeFileSync(report, 'foreign authored report');
                const fileCollision = runInstall();
                expect(fileCollision.status, fileCollision.stderr).toBe(0);
                expect(fileCollision.stderr).toContain('existing file is not gstack-managed');
                expect(fs.readFileSync(report, 'utf8')).toBe('foreign authored report');

                const foreign = fs.mkdtempSync(path.join(base, 'foreign-'));
                const foreignReport = path.join(foreign, 'functional-report-template.md');
                fs.writeFileSync(foreignReport, 'foreign link target');
                fs.unlinkSync(report);
                fs.symlinkSync(foreignReport, report);
                const fileLinkCollision = runInstall();
                expect(fileLinkCollision.status, fileLinkCollision.stderr).toBe(0);
                expect(fileLinkCollision.stderr).toContain('file link is not gstack-managed');
                expect(fs.readlinkSync(report)).toBe(foreignReport);
                expect(fs.readFileSync(foreignReport, 'utf8')).toBe('foreign link target');

                fs.renameSync(templates, `${templates}.saved`);
                fs.symlinkSync(foreign, templates);
                const directoryLinkCollision = runInstall();
                expect(directoryLinkCollision.status, directoryLinkCollision.stderr).toBe(0);
                expect(directoryLinkCollision.stderr).toContain('directory link is not gstack-managed');
                expect(fs.readlinkSync(templates)).toBe(foreign);
                expect(fs.readFileSync(foreignReport, 'utf8')).toBe('foreign link target');
                expect(fs.readFileSync(`${templates}.saved/custom.md`, 'utf8')).toBe('unrelated user template');

                fs.unlinkSync(templates);
                fs.writeFileSync(templates, 'foreign file at templates directory');
                const directoryFileCollision = runInstall();
                expect(directoryFileCollision.status, directoryFileCollision.stderr).toBe(0);
                expect(directoryFileCollision.stderr).toContain('existing entry is not a directory');
                expect(fs.readFileSync(templates, 'utf8')).toBe('foreign file at templates directory');
              } finally {
                fs.writeFileSync(sourceReport, original);
              }
            }
          }
        }
      }, 60_000);
    }
  }
});
