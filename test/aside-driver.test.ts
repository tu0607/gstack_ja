/**
 * Pins for the browser-driver contract: {{ASIDE_SETUP}} (Aside first) and
 * {{BROWSE_FALLBACK}} (gstack's own headless browser when Aside is not
 * installed or not running), plus the tripwires that keep every browsing
 * skill carrying BOTH sections in its generated docs, in that order.
 *
 * The Aside contract never mentions `$B` and the fallback never re-explains
 * Aside — two drivers, two sections, one skill.
 *
 * Also pinned: {{ASIDE_RESEARCH}} (web research through Aside's agent, WebSearch
 * second, in-distribution knowledge last) — it lifts the SAME probe bash from
 * {{ASIDE_SETUP}}, and every `aside exec` send anywhere (cookbook, research,
 * test bootstrap) goes through the receipted `_aside_exec` prelude, never bare.
 */
import { describe, test, expect } from 'bun:test';
import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { generateAsideSetup, generateAsideCookbook, generateAsideResearch, asideExecPrelude, asideResearchSend, ASIDE_LOCAL_HOST_RULE } from '../scripts/resolvers/aside';
import { generateTestBootstrap } from '../scripts/resolvers/testing';
import { generateBrowseFallback, generateBrowseSetup, generateUntrustedContentWarning } from '../scripts/resolvers/browse';
import { RESOLVERS } from '../scripts/resolvers/index';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { extractDesignResearchContract } from './helpers/skill-fixture';
import { expectMentions, expectTokens } from './helpers/prompt-structure';

const ROOT = path.resolve(import.meta.dir, '..');
const ctx = { skillName: 'qa', tmplPath: '', host: 'claude' as const, paths: HOST_PATHS['claude'] };
const setup = generateAsideSetup(ctx);
const cookbook = generateAsideCookbook(ctx);
const section = setup + '\n\n' + cookbook;
const fallback = generateBrowseFallback(ctx);
const research = generateAsideResearch(ctx);
/** The probe bash block of {{ASIDE_SETUP}} — {{ASIDE_RESEARCH}} must carry it byte-for-byte. */
const setupProbe = setup.match(/```bash\n([\s\S]*?)```/)![1];
/** A line that invokes Aside's agent directly, bypassing the receipted `_aside_exec` wrapper. */
const BARE_ASIDE_EXEC = /^\s*aside exec "/m;

/** Skills whose generated docs must drive the browser through Aside, with the `$B` fallback. */
const BROWSING_SKILLS = ['browse', 'qa', 'qa-only', 'design-review', 'scrape', 'benchmark', 'canary', 'land-and-deploy', 'devex-review', 'design-consultation'];

/** Skills that inline no scripts of their own and therefore carry the cookbook too. */
const COOKBOOK_SKILLS = ['browse', 'devex-review'];

describe('Aside driver contract ({{ASIDE_SETUP}})', () => {
  test('is registered as a resolver', () => {
    expect(RESOLVERS.ASIDE_SETUP).toBe(generateAsideSetup);
    expect(RESOLVERS.ASIDE_COOKBOOK).toBe(generateAsideCookbook);
    expect(setup).not.toContain('### Cookbook');
    expect(cookbook.startsWith('### Cookbook')).toBe(true);
    expectMentions(setup, [['browse/SKILL.md', 'cookbook']], 'setup');
  });

  test('detects Aside at runtime, never installs it, and hands off to the fallback', () => {
    expect(section).toContain('command -v aside');
    expect(section).toContain('NEEDS_ASIDE');
    expect(section).toContain('ASIDE_NOT_RUNNING');
    expect(section).toContain('aside.com');
    expectMentions(section, [['決して', 'インストーラー']], 'section');
    expectMentions(section, [['ブラウザのステップの代わり', '単体テスト', 'curl']], 'section');
    // The pitch is macOS-only; both non-READY outcomes continue into the fallback instead of stopping.
    expectMentions(section, [['`NEEDS_ASIDE: Darwin`', '再プローブしない']], 'section');
    expectMentions(section, [['macOS 以外', 'Aside', '勧めません']], 'section');
    expect(section.match(/下の Browser fallback セクションに進みます/g)).toHaveLength(2);
    expect(section).not.toMatch(/verbatim and STOP/);
  });

  test('own-tabs rule: never touch the user\'s tabs, never echo the tab list', () => {
    expectMentions(section, [['自分のタブを開く']], 'section');
    expectMentions(section, [['`openTab(url)`', '自分で開いたタブ']], 'section');
    expectMentions(section, [['`listBrowserTabs()`', '非公開']], 'section');
    expectMentions(section, [['エコー', 'いけません']], 'section');
  });

  test('signed-in tabs (#3063): offer only target-origin tabs, attach after one confirmation, no second sign-in loop', () => {
    const rules = setup.slice(setup.indexOf('### 実際のブラウザを操作するためのルール'));
    const rule = (n: number) => rules.match(new RegExp(`\\n${n}\\. \\*\\*[\\s\\S]*?(?=\\n\\d+\\. \\*\\*|\\n\\n)`))![0];
    expectMentions(rule(1), [['最初の `openTab` の前に', 'タイトルとオリジン', 'ターゲットのオリジン']], 'rule 1');
    expectMentions(rule(1), [['ユーザーが', '確認した後にのみ', 'アタッチ']], 'rule 1');
    expectMentions(rule(4), [['2 回目の壁', 'タブ', 'URL']], 'rule 4');
    expectMentions(rule(4), [['ユーザーのタブを提案', 'ルール 1', '再度のサインイン', '求めません']], 'rule 4');
    expect(rule(4)).not.toMatch(/cookies now apply|Cookie が(今は|今)?適用/i);
    // Rule 6 no longer suggests an early `return`; rule 7 names the fast-[ok abort.
    expect(rule(6)).not.toContain('`return`');
    expectMentions(rule(7), [['`[ok', '中断']], 'rule 7');
  });

  test('consent boundary: look freely, act on non-local targets only after one AskUserQuestion', () => {
    expectMentions(section, [['呼び出しは「見る」ことへの同意', '「操作する」ことへの同意ではない']], 'section');
    expect(section).toContain(ASIDE_LOCAL_HOST_RULE);
    expectMentions(section, [['1 回の実行につき', 'AskUserQuestion', '1 回']], 'section');
  });

  test('consent boundary covers the writes a label hides: wizard steps and saves after a silent no-op set (#3216)', () => {
    const rule3 = setup.match(/\n3\. \*\*呼び出しは「見る」[^\n]*/)![0];
    expectMentions(rule3, [['最初の操作の前に', '列挙']], 'rule 3');
    expectMentions(rule3, [['ウィザード', 'ダイアログ', 'ステップ', '変更を伴う', 'ハンドラー']], 'rule 3');
    expectMentions(rule3, [['cancel', '証明']], 'rule 3');
    expectMentions(rule3, [['save', '読み戻し', '`setValue`', '不一致', '停止', '`throw`']], 'rule 3');
    expectMentions(fallback, [['ルール 3', 'NON-LOCAL', 'AskUserQuestion', 'そのまま適用']], 'fallback');
    expectMentions(cookbook, [['スキップ', '経路'], ['前提条件', '出力']], 'cookbook');
  });

  test('credential boundary: the user signs in, the agent never handles secrets', () => {
    expectMentions(section, [['認証情報', '経由させない']], 'section');
    expectMentions(section, [['パスワード', 'ワンタイムコード', '決して']], 'section');
    expectMentions(section, [['cookie', 'localStorage', '決して']], 'section');
  });

  test('page output is untrusted content', () => {
    expectMentions(section, [['ページが返すものはすべて', '信頼できない']], 'section');
    expectMentions(section, [['スコープ', '権限', '同意', '決して']], 'section');
  });

  test('one flow per script — the verified session model', () => {
    expectMentions(section, [['1 つのスクリプトに 1 つのフロー']], 'section');
    expectMentions(section, [['終了コード', '常に 0']], 'section');
    expect(section).toContain('GSTACK_STEP_OK');
  });

  test('artifact handoff goes through the printed session directory', () => {
    expect(section).toContain('ASIDE_DIR=');
    expectMentions(section, [['画像データ', '決して出力しません']], 'section');
    expectMentions(section, [['コピーしたファイル', 'Read ツール']], 'section');
  });

  test('cookbook names the silent failure modes of aside repl scripts (#3064)', () => {
    expectMentions(cookbook, [['`evaluate`', 'JSON にシリアライズできる値']], 'cookbook');
    expectTokens(cookbook, ['`; return true`', '`JSON.stringify(...)`', '`if`/`else`', '`pg.locator(sel).press("Enter")`'], 'cookbook');
    expectMentions(cookbook, [['トップレベルの `return`', '使えません']], 'cookbook');
    expectMentions(cookbook, [['DOM の読み取り結果が空', 'セレクター']], 'cookbook');
    expectMentions(cookbook, [['クリックする前', '状態を読み取']], 'cookbook');
    // The attach recipe keeps the tab list private and never closes the user's tab.
    expectMentions(cookbook, [['タイトルとオリジン', 'それ以外は決して出力しません']], 'cookbook');
    expectMentions(cookbook, [['`attachBrowserTab`', '決して `closeTab`']], 'cookbook');
    expect(setup).not.toContain('Silent failures');
  });

  test('cookbook uses only the verified Aside APIs', () => {
    expect(section).toContain('Page.addScriptToEvaluateOnNewDocument');
    expect(section).toContain('Emulation.setDeviceMetricsOverride');
    expect(section).toContain('annotatedScreenshot(pg)');
    expect(section).toContain('snapshot(pg, { interactive: true })');
    // Verified NOT to exist or NOT to persist across CLI calls — must never be recommended.
    expect(section).not.toContain('setViewportSize');
    expect(section).not.toContain('pg.on("console"');
    expect(section).not.toContain('TARGET_ID=');
    // Every cookbook script ends by closing its tab and printing the sentinel.
    const scripts = [...section.matchAll(/aside repl '([\s\S]*?)'\n```/g)].map(m => m[1]);
    expect(scripts.length).toBeGreaterThanOrEqual(6);
    for (const s of scripts) {
      expect(s).toContain('await closeTab(pg)');
      expect(s.trim().endsWith('console.log("GSTACK_STEP_OK");')).toBe(true);
    }
  });

  test('probe honors the GSTACK_SKIP_ASIDE=1 opt-out and bounds the readiness call even on stock macOS', () => {
    // Opt-out short-circuits to NEEDS_ASIDE before `command -v aside` is even consulted.
    // E7 (#2902): the installer's ~/.local/bin is not on the default macOS PATH, so the probe falls back to it.
    expect(setupProbe).toContain('_A=aside; command -v aside >/dev/null || _A=$(command -v ~/.local/bin/aside)');
    expect(setupProbe).toMatch(/if \[ "\$\{GSTACK_SKIP_ASIDE:-\}" = "1" \] \|\| \[ -z "\$_A" \]; then\n\s*echo "NEEDS_ASIDE: \$\{GSTACK_PLATFORM:-\$\(uname\)\}"/);
    // Deadline chain: gtimeout (coreutils on macOS) → timeout (Linux) → perl alarm (stock macOS ships neither).
    expect(setupProbe).toContain('gtimeout 30 "$@"');
    expect(setupProbe).toContain('timeout 30 "$@"');
    expect(setupProbe).toContain('perl -e \'alarm(shift);exec(@ARGV)\' 30 "$@"');
    expect(setupProbe.indexOf('gtimeout 30')).toBeLessThan(setupProbe.indexOf('perl -e'));
    expect(setupProbe).toContain('else return 125');
    // The deadline is a FUNCTION, not a string in a variable. A string has to be expanded
    // unquoted to become several words, and zsh does not word-split unquoted expansions:
    // `$_T aside repl …` looked for one command named "gtimeout 30" and the probe answered
    // ASIDE_NOT_RUNNING with Aside ready. A function takes "$@", already split.
    // It must NOT come back as a variable, and must NOT be routed through `eval` either:
    // eval re-parses the string, so the parens and `;` of the perl arm become syntax.
    expect(setupProbe).toContain('_gs_d() {');
    expect(setupProbe).toContain("_o=$(_gs_d \"$_A\" repl 'console.log(\"ASIDE_READY \" + pwd)' 2>&1) || _rc=$?");
    expect(setupProbe).not.toContain('$_T aside repl');
    expect(setupProbe).not.toContain('_T="gtimeout 30"');
    expect(setupProbe).not.toMatch(/eval .*aside repl/);
    expect(setupProbe).toContain('echo "READY: $_A"'); // E7: prints "aside" on PATH, else the off-PATH path
    expect(setupProbe).not.toContain('aside --version');
  });

  test('the rendered probe answers READY on bounded shell arms and reports only safe failure statuses', () => {
    // The pins above are text; this one runs the bash they pin. The bug they missed was not
    // a wrong string, it was a string that only splits into words in a shell that word-splits
    // unquoted expansions — so the probe has to be EXECUTED, in the shells users actually run
    // it under, once per arm of the deadline chain, or the next rewrite reintroduces it.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gstack-probe-'));
    const bin = (p: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); return p; };
    const write = (p: string, body: string) => { fs.writeFileSync(bin(p), body); fs.chmodSync(p, 0o755); };
    const wrap = (from: string, to: string) => write(to, `#!/bin/sh\nexec '${from.replaceAll("'", "'\"'\"'")}' "$@"\n`);
    const lookup = (cmd: string) => {
      const r = spawnSync('bash', ['-c', `command -v ${cmd}`], { encoding: 'utf8', timeout: 5_000 });
      return r.status === 0 ? r.stdout.trim() : null;
    };
    const executable = (cmd: string) => {
      const resolved = lookup(cmd);
      if (!resolved || process.platform !== 'win32') return resolved;
      const native = spawnSync('bash', ['-c', 'cygpath -w "$1"', '_', resolved], { encoding: 'utf8', timeout: 5_000 });
      if (native.status !== 0) throw new Error(`Cannot resolve native shell path: ${native.stderr}`);
      return native.stdout.trim();
    };
    const shellPath = (native: string) => {
      if (process.platform !== 'win32') return native;
      const converted = spawnSync('bash', ['-c', 'cygpath -u "$1"', '_', native], { encoding: 'utf8', timeout: 5_000 });
      if (converted.status !== 0) throw new Error(`Cannot resolve shell PATH entry: ${converted.stderr}`);
      return converted.stdout.trim();
    };
    try {
      // A hermetic PATH: the stubs decide which arm is reachable, so the result does not depend
      // on whether this machine has coreutils. `grep` has to come along — the probe pipes into it.
      write(path.join(dir, 'base', 'aside'), '#!/bin/sh\n[ "$1" = "--version" ] && { echo 9.9.9; exit 0; }\necho "ASIDE_READY /tmp/x"\n');
      wrap(lookup('grep')!, path.join(dir, 'base', 'grep'));
      const failing = {
        window: ['No browser window is open for account u0', '    at stack frame'],
        preload: ['node:internal/modules/cjs/loader:1573', '  throw err;', '', "Error: Cannot find module '/x/preload.cjs'"],
      };
      for (const [name, lines] of Object.entries(failing)) {
        const body = lines.map((l) => `echo "${l}" >&2`).join('\n');
        write(path.join(dir, name, 'aside'), `#!/bin/sh\n[ "$1" = "--version" ] && { echo 9.9.9; exit 0; }\n${body}\nexit 1\n`);
        wrap(lookup('grep')!, path.join(dir, name, 'grep'));
      }
      write(path.join(dir, 'gt', 'gtimeout'), '#!/bin/sh\nshift\nexec "$@"\n');
      write(path.join(dir, 'to', 'timeout'), '#!/bin/sh\nshift\nexec "$@"\n');
      const perl = lookup('perl');
      if (perl) wrap(perl, path.join(dir, 'pl', 'perl'));

      const arms = ['gt', 'to', ...(perl ? ['pl'] : []), 'none'];
      const shells = ['sh', 'bash', 'zsh'].map(executable).filter((shell): shell is string => !!shell);
      expect(shells.length).toBeGreaterThan(0);
      const base = shellPath(path.join(dir, 'base'));
      for (const arm of arms) {
        const PATH = arm === 'none' ? base : `${shellPath(path.join(dir, arm))}:${base}`;
        for (const shell of shells) {
          const r = spawnSync(shell, ['-c', setupProbe], { env: { PATH }, encoding: 'utf8', timeout: 30_000 });
          const status = arm === 'none' ? 'ASIDE_UNAVAILABLE: bounded probe unavailable' : 'READY: aside';
          const name = path.basename(shell).replace(/\.exe$/i, '');
          expect(`${name}/${arm}: ${r.stdout.trim()}`).toBe(`${name}/${arm}: ${status}`);
        }
      }
      const reasons = { window: 'No browser window is open for account u0', preload: "Error: Cannot find module '/x/preload.cjs'" };
      for (const [name, reason] of Object.entries(reasons)) {
        for (const shell of shells) {
          const r = spawnSync(shell, ['-c', setupProbe], { env: { PATH: `${shellPath(path.join(dir, 'gt'))}:${shellPath(path.join(dir, name))}` }, encoding: 'utf8', timeout: 30_000 });
          const executableName = path.basename(shell).replace(/\.exe$/i, '');
          expect(`${executableName}/${name}: ${r.stdout.trim()}`).toBe(`${executableName}/${name}: ASIDE_CLI_ERROR: exit 1; inspect aside --help locally`);
          expect(r.stdout).not.toContain(reason);
        }
      }
      // Both ways out stay reachable: opted out, and Aside not installed (empty PATH dir).
      const sh = shells[0];
      const optOut = spawnSync(sh, ['-c', setupProbe], { env: { PATH: base, GSTACK_SKIP_ASIDE: '1', GSTACK_PLATFORM: 'Darwin' }, encoding: 'utf8', timeout: 30_000 });
      expect(optOut.stdout.trim()).toBe('NEEDS_ASIDE: Darwin');
      const noAside = spawnSync(sh, ['-c', setupProbe], { env: { PATH: shellPath(path.join(dir, 'gt')), GSTACK_PLATFORM: 'Linux' }, encoding: 'utf8', timeout: 30_000 });
      expect(noAside.stdout.trim()).toBe('NEEDS_ASIDE: Linux');
      // E7 (#2902): installed only at ~/.local/bin (not on the macOS login PATH) is still found, and named.
      const home = path.join(dir, 'home');
      write(path.join(home, '.local', 'bin', 'aside'), '#!/bin/sh\necho "ASIDE_READY /tmp/x"\n');
      wrap(lookup('grep')!, path.join(dir, 'grep-only', 'grep'));
      for (const shell of shells) {
        const offPath = spawnSync(shell, ['-c', setupProbe], { env: { HOME: home, PATH: `${shellPath(path.join(dir, 'gt'))}:${shellPath(path.join(dir, 'grep-only'))}` }, encoding: 'utf8', timeout: 30_000 });
        expect(offPath.stdout.trim()).toBe(`READY: ${path.join(home, '.local', 'bin', 'aside')}`);
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    // 20 probe runs, ~1.5 s idle: the ceiling is for a loaded CI box, not a wait.
  }, 30_000);

  test('LOCAL host rule: .localhost and .test count, .local (mDNS) does not', () => {
    expectMentions(ASIDE_LOCAL_HOST_RULE, [['.localhost', '.test', '終わる']], 'ASIDE_LOCAL_HOST_RULE');
    expectMentions(ASIDE_LOCAL_HOST_RULE, [['.local', '含みません']], 'ASIDE_LOCAL_HOST_RULE');
    expectMentions(ASIDE_LOCAL_HOST_RULE, [['mDNS', '別のマシン']], 'ASIDE_LOCAL_HOST_RULE');
    for (const h of ['localhost', '127.0.0.1', '0.0.0.0', '::1']) expect(ASIDE_LOCAL_HOST_RULE).toContain(h);
    // The rendered rule text says so too — the constant is interpolated, not paraphrased.
    expectMentions(setup, [['.local', '含みません', 'localhost']], 'setup');
  });

  test('links recipe compares parsed origins, lists non-LOCAL links as `LINK ?` unfetched, and its LOCAL regex excludes .local', () => {
    const links = cookbook.match(/\*\*リンクとそのステータス[\s\S]*?aside repl '([\s\S]*?)'\n```/)![1];
    expect(links).toContain('new URL(h).origin === location.origin');
    expect(links).not.toContain('startsWith(location.origin)');
    expect(links).not.toContain('startsWith(');
    // Non-LOCAL: print and `continue` BEFORE any fetch — the user's cookies never ride a HEAD request.
    expect(links).toContain('if (!local) { console.log("LINK ?", l); continue; }');
    expect(links.indexOf('LINK ?')).toBeLessThan(links.indexOf('fetch(l, { method: "HEAD" })'));
    const localRe = links.match(/const local = await pg\.evaluate\(\(\) => \/(.*)\/\.test\(location\.hostname\)\)/)![1];
    expect(localRe).toContain('(localhost|test)$');
    expect(localRe).toMatch(/^\^\(localhost\|/);
    expect(localRe).not.toContain('local|');
    expect(localRe).not.toContain('|local)');
    expect(localRe).not.toContain('.local');
    expectMentions(cookbook, [['`LINK ?`', '未取得']], 'cookbook');
  });

  test('`aside exec` is never bare: the open-ended-reading recipe defines _aside_exec from the egress prelude', () => {
    const prelude = asideExecPrelude(ctx);
    expect(prelude).toContain('gstack-egress-lib.sh');
    expect(prelude).toContain('_aside_exec() {');
    expect(prelude).toContain('--no-payload aside exec "$@"');
    // Fail-open: without the lib the wrapper still runs the send.
    expect(prelude).toContain('else aside exec "$@"; fi');
    const [, promptFile, reading] = cookbook.match(/\*\*Aside 自身のエージェントによる自由記述の読み取り\*\*[\s\S]*?```bash\n([\s\S]*?)```[\s\S]*?```bash\n([\s\S]*?)```/)!;
    // CEO-12: the question travels in an agent-written file, never in the command.
    expect(promptFile).toContain('PROMPT_FILE=$(mktemp "${_GT:?}/aside-prompt.XXXXXX")');
    // Prelude and call share ONE bash block (blocks are separate shells).
    expect(reading.startsWith(prelude + '\n')).toBe(true);
    expect(reading).toContain('\n_aside_exec "Open <url>. Read-only, do not submit or change anything. $(cat "$PROMPT_FILE") Then stop."');
    expect(cookbook).not.toMatch(BARE_ASIDE_EXEC);
    expect(setup).not.toMatch(BARE_ASIDE_EXEC);
  });

  test('the Aside contract stays Aside-only — `$B` lives in the fallback section', () => {
    expect(section).not.toMatch(/\$B(?!\w)/);
    expect(section).not.toContain('cookie-import');
    expect(section).not.toContain('GStack Browser');
    expect(section).not.toContain('handoff');
  });
});

describe('browser fallback ({{BROWSE_FALLBACK}})', () => {
  test('shell-probe consumers accept every non-READY status and optional research waives setup before the fallback', () => {
    for (const file of ['browse/SKILL.md.tmpl', 'design-consultation/SKILL.md.tmpl']) {
      const text = fs.readFileSync(path.join(ROOT, file), 'utf8');
      expect({ file, nonReady: /`?READY`?\s*以外/.test(text) }).toEqual({ file, nonReady: true });
    }
    expectMentions(RESOLVERS.QA_METHODOLOGY(ctx), [['BROWSER SETUP', '再利用'], ['Aside', 'READY', '`$B`']], 'QA_METHODOLOGY');
    const consultation = fs.readFileSync(path.join(ROOT, 'design-consultation/SKILL.md.tmpl'), 'utf8');
    expectMentions(consultation, [['ビルド', '提案', 'しないでください']], 'consultation');
    expect(consultation.indexOf('ブラウザは任意です。')).toBeLessThan(consultation.indexOf('{{BROWSE_FALLBACK}}'));
  });

  test('is registered and scoped to the non-READY probe outcomes or the TPA gstack-drive choice', () => {
    expect(RESOLVERS.BROWSE_FALLBACK).toBe(generateBrowseFallback);
    expect(fallback.startsWith("## Browser fallback: gstack's own headless browser")).toBe(true);
    expectMentions(fallback, [['READY ではない', 'BROWSER SETUP']], 'fallback');
  });

  test('finds the $B binary compactly and defers the build to ./setup (no bun-install copy)', () => {
    expect(fallback).toContain('### `$B` バイナリを探す');
    expect(fallback).toContain('browse/dist/browse');
    expect(fallback).toContain('NEEDS_SETUP');
    expect(fallback).toContain('./setup');
    expect(fallback).not.toContain('## SETUP (run this check BEFORE any browse command)');
    expect(fallback).not.toContain('BUN_INSTALL_SHA=');
  });

  test('translates every cookbook step to a $B command', () => {
    for (const cmd of [
      '$B goto <url>', '$B snapshot -i', '$B click @e12', '$B fill @eN "text"', '$B snapshot -D',
      '$B console --errors', '$B screenshot <path>', '$B snapshot -i -a -o <path>', '$B responsive <prefix>',
      '$B links', '$B text', '$B perf', '$B js "<expr>"', '$B eval <file>', '$B pdf <out> [flags]', '$B closetab',
    ]) {
      expect({ cmd, present: fallback.includes(cmd) }).toEqual({ cmd, present: true });
    }
    // Every cookbook evidence label has a row, so a skill's report reads the same under either driver.
    for (const label of ['CONSOLE_ERRORS=', 'DIFF_START', 'TEXT_START', 'NAV=', 'RESOURCES=', 'ASIDE_DIR']) {
      expect({ label, present: fallback.includes(label) }).toEqual({ label, present: true });
    }
  });

  test('consultation fallback retains read-only visual research without unrelated command tables', () => {
    const designFallback = generateBrowseFallback({ ...ctx, skillName: 'design-consultation' });
    expectMentions(designFallback, [['ビルド', '提案', 'しません']], 'designFallback');
    expectMentions(designFallback, [['承認した URL', '$B goto <url>']], 'designFallback');
    for (const cmd of ['$B goto <url>', '$B snapshot -i', '$B screenshot <path>', '$B closetab']) {
      expect(designFallback).toContain(cmd);
    }
    expectMentions(designFallback, [['AskUserQuestion', '同意ルール']], 'designFallback');
    expect(designFallback).not.toContain('$B fill');
    expect(designFallback).not.toContain('$B pdf');
  });

  test('rules that differ: no sessions (cookie import or handoff), consent and evidence unchanged', () => {
    expect(fallback).toContain('/setup-browser-cookies');
    expect(fallback).toContain('$B handoff');
    expect(fallback).toContain('$B resume');
    expectMentions(fallback, [['パスワード', 'ワンタイムコード', '一切ありません']], 'fallback');
    expectMentions(fallback, [['ルール 3', 'そのまま適用']], 'fallback');
    expect(fallback).toContain('UNTRUSTED WEB CONTENT');
    expectMentions(fallback, [['`$B js`', '`$B eval`', '囲まれません']], 'fallback');
    expect(fallback).toContain('browse/SKILL.md');
    // The fallback never re-pitches, re-probes, or re-installs Aside — that is BROWSER SETUP's job.
    expect(fallback).not.toContain('aside.com');
    expect(fallback).not.toContain('command -v aside');
  });

  test('names both marker formats $B prints and says $B js / $B eval output is NOT wrapped', () => {
    // Read the markers from the code that prints them, so the skill text cannot drift from the binary.
    const commandsSrc = fs.readFileSync(path.join(ROOT, 'browse/src/commands.ts'), 'utf-8');
    const contentSecuritySrc = fs.readFileSync(path.join(ROOT, 'browse/src/content-security.ts'), 'utf-8');
    const externalLabel = commandsSrc.match(/`--- BEGIN (UNTRUSTED [A-Z ]+?) \(source/)?.[1];
    const webLabel = contentSecuritySrc.match(/ENVELOPE_BEGIN = '═══ BEGIN (UNTRUSTED [A-Z ]+?) ═══'/)?.[1];
    expect(externalLabel).toBeTruthy();
    expect(webLabel).toBeTruthy();
    for (const surface of [fallback, generateUntrustedContentWarning(ctx)]) {
      expect(surface).toContain(`--- BEGIN/END ${externalLabel} ---`);
      expect(surface).toContain(`═══ BEGIN/END ${webLabel} ═══`);
    }
    expectMentions(fallback, [['内容', '指示ではありません']], 'fallback');
  });

  test('stays compact: under 4.5KB (it does not embed the full SETUP block)', () => {
    expect(fallback.length).toBeLessThan(4500);
    expect(fallback).not.toContain(generateBrowseSetup(ctx));
  });
});

describe('web research ({{ASIDE_RESEARCH}})', () => {
  /** Top-level skill templates that paste the placeholder. */
  const carriers = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(ROOT, d.name, 'SKILL.md.tmpl')))
    .map(d => d.name)
    .filter(name => fs.readFileSync(path.join(ROOT, name, 'SKILL.md.tmpl'), 'utf-8').includes('{{ASIDE_RESEARCH}}'))
    .sort();

  test('is registered and opens with its own section heading', () => {
    expect(RESOLVERS.ASIDE_RESEARCH).toBe(generateAsideResearch);
    expect(research.startsWith('## Web research runs in Aside(Web 調査は Aside で実行する)\n')).toBe(true);
    expectMentions(research, [['リサーチ', 'まず', 'Aside 自身のエージェント']], 'research');
  });

  test('embeds the SAME probe bash as BROWSER SETUP, byte-identical, and lets a skill reuse an earlier answer', () => {
    expect(research).toContain(setupProbe.trimEnd());
    const researchProbe = research.match(/```bash\n([\s\S]*?)```/)![1];
    expect(researchProbe.trimEnd()).toBe(setupProbe.trimEnd());
    expect(researchProbe).toContain('GSTACK_SKIP_ASIDE');
    expectMentions(research, [['同じプローブ', 'BROWSER SETUP', 'Third-Party Web Actions', '再利用']], 'research');
  });

  test('degrades to the WebSearch tool, then to in-distribution knowledge — and never installs Aside', () => {
    expectMentions(research, [['準備ができていない', 'WebSearch', 'フォールバック']], 'research');
    expectMentions(research, [['READY 以外', '安全なステータスだけ', '生の診断情報', '決して']], 'research');
    expectMentions(research, [['WebSearch', '利用できる場合', '実行']], 'research');
    expect(research).toContain('"Search unavailable — proceeding with in-distribution knowledge only."');
    expectMentions(research, [['自分でインストール', 'いけません']], 'research');
    expectMentions(research, [['マシンの外に出る前', 'サニタイズ']], 'research');
    // Untrusted-content rule travels with the research answer.
    expectMentions(research, [['回答', '信頼できないコンテンツ', '扱います']], 'research');
  });

  test('the research send goes through _aside_exec with the cookbook\'s exact prelude (never bare aside exec)', () => {
    expect(research).not.toMatch(BARE_ASIDE_EXEC);
    // CEO-12: the query travels in an agent-written file; the read-only rule stays in the shell.
    expect(research).toContain('_aside_exec "Search the web for $(cat "$PROMPT_FILE") Read-only: do not sign in, submit, or change anything.');
    // The READY block is a nested list item, so the prelude renders indented by two spaces — same bytes otherwise.
    const prelude = asideExecPrelude(ctx);
    expect(research).toContain('  ```bash\n  ' + prelude.replace(/\n/g, '\n  ') + '\n  PROMPT_FILE="');
    const dedent = (s: string) => s.split('\n').map(l => l.replace(/^  /, '')).join('\n');
    const researchBlock = research.match(/  ```bash\n  (_EG=[\s\S]*?)\n  _aside_exec "Search the web/)![1];
    const cookbookBlock = cookbook.match(/```bash\n(_EG=[\s\S]*?)\n_aside_exec "Open <url>/)![1];
    // Same prelude and same prompt-file rebuild; only the by-hand command in the refusal differs.
    const head = (b: string) => b.split('\n').slice(0, 2).join('\n');
    expect(head(dedent(researchBlock))).toBe(head(cookbookBlock));
    expect(cookbookBlock.split('\n')[0]).toBe(prelude);
  });

  test('the test-bootstrap research step (B2) routes through the same _aside_exec prelude', () => {
    const bootstrap = generateTestBootstrap(ctx);
    // CEO-12: the query travels in an agent-written file and goes out through the shared research send block.
    expect(bootstrap).toContain('PROMPT_FILE=$(mktemp "${_GT:?}/aside-prompt.XXXXXX")');
    expect(bootstrap).toContain('`the best [runtime] test framework');
    expect(bootstrap).toContain('```bash\n' + asideResearchSend(ctx) + '\n```');
    expect(asideResearchSend(ctx).startsWith(asideExecPrelude(ctx) + '\n')).toBe(true);
    expect(bootstrap).not.toMatch(BARE_ASIDE_EXEC);
    // Same degradation ladder: WebSearch when the host has it, built-in table last.
  });

  test('every template carrying {{ASIDE_RESEARCH}} renders the section exactly once', () => {
    // CSO's private startup keeps advisory queries inside its stricter public-ID
    // policy and intentionally does not import the generic Aside research block.
    expect(carriers).not.toContain('cso');
    expect(carriers).toEqual(expect.arrayContaining(['design-consultation', 'investigate', 'office-hours', 'plan-ceo-review', 'plan-devex-review', 'plan-eng-review', 'review']));
    for (const skill of carriers) {
      const md = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      expect({ skill, count: md.split('## Web research runs in Aside').length - 1 }).toEqual({ skill, count: 1 });
      expect({ skill, hasFallbackLine: md.includes('Search unavailable — proceeding with in-distribution knowledge only.') }).toEqual({ skill, hasFallbackLine: true });
      const routing = generateAsideResearch({ ...ctx, skillName: skill });
      expect({ skill, count: md.split(routing).length - 1 }).toEqual({ skill, count: 1 });
      const rendered = skill === 'design-consultation' ? extractDesignResearchContract(md) : routing;
      expect({ skill, hasPrelude: rendered.includes('_aside_exec() {'), sameProbe: rendered.includes(setupProbe.trimEnd()) }).toEqual({ skill, hasPrelude: true, sameProbe: true });
      expect({ skill, bareAsideExec: BARE_ASIDE_EXEC.test(rendered) }).toEqual({ skill, bareAsideExec: false });
      if (skill === 'design-consultation') {
        expectMentions(routing, [['Phase 0', 'BROWSER SETUP', '再利用', 'プローブを繰り返しません']], 'routing');
        expect(rendered.split(setupProbe.trimEnd())).toHaveLength(2);
        expect(rendered.split('_aside_exec() {')).toHaveLength(2);
      }
    }
  });
});

describe('browser consolidation tripwires', () => {
  test('every browsing skill carries the Aside contract followed by the $B fallback', () => {
    for (const skill of BROWSING_SKILLS) {
      let md = fs.readFileSync(path.join(ROOT, skill, 'SKILL.md'), 'utf-8');
      if (skill === 'qa' || skill === 'qa-only') {
        expect(md).toContain('sections/browser-setup.md');
        expect(md).not.toContain('## BROWSER SETUP (Aside');
        if (skill === 'qa-only') {
          expectMentions(md, [['`sections/browser-setup.md`', 'installed `qa`', 'Read']], 'qa-only');
          expect(fs.existsSync(path.join(ROOT, skill, 'sections/browser-setup.md'))).toBe(false);
        }
        md += fs.readFileSync(path.join(ROOT, 'qa/sections/browser-setup.md'), 'utf8');
      }
      const aside = md.indexOf('## BROWSER SETUP (Aside');
      const fb = md.indexOf("## Browser fallback: gstack's own headless browser");
      expect({ skill, hasAside: aside >= 0, hasFallback: fb >= 0, fallbackAfterAside: fb > aside }).toEqual({ skill, hasAside: true, hasFallback: true, fallbackAfterAside: true });
      // One copy each — a template that pastes the placeholder twice pays twice.
      expect({ skill, asideCount: md.split('## BROWSER SETUP (Aside').length - 1 }).toEqual({ skill, asideCount: 1 });
      expect({ skill, fallbackCount: md.split("## Browser fallback: gstack's own").length - 1 }).toEqual({ skill, fallbackCount: 1 });
      const hasCookbook = md.includes('### Cookbook (Aside CLI');
      expect({ skill, hasCookbook }).toEqual({ skill, hasCookbook: COOKBOOK_SKILLS.includes(skill) });
    }
  });

  test('the router sends browser work to /browse and mentions Aside', () => {
    const router = fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf-8');
    expectMentions(router, [['`/browse`', '呼び出します']], 'router');
    expect(router).toContain('Aside');
  });
});
