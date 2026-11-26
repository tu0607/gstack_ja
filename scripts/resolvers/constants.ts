// ─── Shared Design Constants ────────────────────────────────

import { DESIGN_SLOP_CATALOG } from '../../lib/design-catalog';

/**
 * gstack's AI slop anti-patterns — shared between DESIGN_METHODOLOGY and DESIGN_HARD_RULES.
 *
 * Derived from the typed catalog in lib/design-catalog.ts: the 11 entries flagged
 * `legacyBlacklist`, prose verbatim, in catalog order. Overused fonts live there
 * too (OVERUSED_FONTS_DISPLAY), role-scoped: banned as the display voice, several
 * still fine as body/UI on an Operate or Read surface.
 */
export const AI_SLOP_BLACKLIST: string[] = DESIGN_SLOP_CATALOG
  .filter(e => e.legacyBlacklist)
  .map(e => e.prose);

/** OpenAI hard rejection criteria (from "Designing Delightful Frontends with GPT-5.4", Mar 2026) */
export const OPENAI_HARD_REJECTIONS = [
  'ありきたりな SaaS のカードグリッドが第一印象になっている',
  '美しい画像だが、ブランドが弱い',
  '強い見出しだが、明確なアクションがない',
  'テキストの背後に雑多な画像がある',
  '複数のセクションが同じムードの訴えを繰り返している',
  '物語上の目的のないカルーセル',
  'レイアウトではなく、積み重ねたカードで作られたアプリ UI',
];

/** OpenAI litmus checks — 7 yes/no tests for cross-model consensus scoring */
export const OPENAI_LITMUS_CHECKS = [
  '最初の画面で、ブランドやプロダクトがはっきり分かるか。',
  '強い視覚的なアンカーが 1 つあるか。',
  '見出しをざっと読むだけでページが理解できるか。',
  '各セクションの役割は 1 つか。',
  'カードは本当に必要か。',
  'モーションは階層構造や雰囲気を改善しているか。',
  '装飾的なシャドウをすべて取り除いても、デザインは上質に感じられるか。',
];

/**
 * Web-search flag for every codex invocation (#2525).
 *
 * codex >=0.144 deprecated the legacy `--enable`-based web_search_cached
 * spelling (web search is on by default; the deprecation notice says to set
 * `web_search` to "live", "indexed", "cached", or "disabled" at the top
 * level), and `--enable <FEATURE>` now means `-c features.<name>=true`
 * (verified on 0.147.0), so the legacy spelling is headed for hard
 * rejection. This is the ONE source
 * of truth: resolvers interpolate it directly and templates reference it via
 * the {{CODEX_WEB_SEARCH_FLAG}} token — never write the flag inline.
 *
 * Semantics note: unlike the legacy flag (which yielded to an existing
 * top-level `web_search` in config.toml), the -c form explicitly overrides
 * it. Deliberate: gstack wants deterministic cached search for review
 * invocations. Native `codex review` disables web search regardless of
 * configuration, so on that path the flag is a harmless no-op.
 */
export const CODEX_WEB_SEARCH_FLAG = `-c 'web_search="cached"'`;

/**
 * Historical no-role Codex default and the pinned eval ruler some tests import.
 * It does not follow the role catalog in lib/model-catalog.ts: plan-review
 * calls resolve their model through lib/model-policy.ts at invocation time.
 *
 * A no-role runtime model is resolved per invocation kind by
 * `gstack-codex-probe select-model exec|review` (backed by
 * resolveCodexRuntimeModel in scripts/resolve-codex-generation-model.ts):
 * explicit request (`--model`), then GSTACK_CODEX_MODEL, then Codex config.toml
 * (`model`; `review_model` first for native review; honors CODEX_HOME), then this
 * default (#2914). The selection is printed before the first paid call and the
 * probe checks the same record the flags below pass.
 */
export const CODEX_FRONTIER_MODEL = 'gpt-6-astra';
/**
 * Nested gstack Codex calls are one-shot reviews: keep installed skills (gstack's
 * own included) out of the model's context so the reviewer cannot re-run a whole
 * skill workflow inside its budget (#2847). Read-only sandboxes do not prevent this.
 */
export const CODEX_SKILLS_ISOLATION_FLAG = '-c skills.include_instructions=false';
/** Captured from `select-model` by codexSelect(); `:?` stops an unselected command. */
const SELECTED_MODEL = '${_CODEX_SEL:?}';
/** The sandbox codexSelect() captured; read-only unless GSTACK_CODEX_NO_SANDBOX=1. */
export const CODEX_SANDBOX_REF = '${_CODEX_SANDBOX_MODE:?}';
/** Requires codexSelect('exec') earlier in the same block. */
export const CODEX_MODEL_CONFIG_FLAG = `-c "model=\\"${SELECTED_MODEL}\\"" ${CODEX_SKILLS_ISOLATION_FLAG}`;
/** Requires codexSelect('review'); native review prefers review_model, so both carry the selection. */
export const CODEX_REVIEW_MODEL_CONFIG_FLAG = `-c "review_model=\\"${SELECTED_MODEL}\\"" ${CODEX_MODEL_CONFIG_FLAG}`;
/** The executed probe; pathRewrites map the Claude path per host. */
export const CODEX_PROBE_PATH = '~/.claude/skills/gstack/bin/gstack-codex-probe';

/**
 * Runs `gstack-codex-probe select-model` and captures its KEY: value lines into
 * `_CODEX_SEL` and `_CODEX_SANDBOX_MODE` for CODEX_MODEL_CONFIG_FLAG and
 * CODEX_SANDBOX_REF. The probe is executed, never sourced, so no shell state
 * crosses from the helper and the calling shell does not matter.
 *
 * With `role`, `role-ready` supplies the plan-review record instead: one
 * selection, auth, sandbox and model probe. It and the block's later
 * `run-with-timeout <budgetSecs>` dispatch share one exported deadline, so
 * readiness time is charged to the review instead of extending it. `optional`
 * (manual /codex) keeps select-model unless the agent sets `_CODEX_ROLE`.
 */
export function codexSelect(kind: 'exec' | 'review', probe: string = CODEX_PROBE_PATH, role?: { budgetSecs: number; optional?: boolean }): string {
  const select = `_CODEX_OUT=$("$_CODEX_PROBE" select-model ${kind}) || exit 1`;
  const ready = `export _CODEX_DEADLINE=$(($(date +%s)+${role?.budgetSecs})); _CODEX_OUT=$("$_CODEX_PROBE" role-ready ${kind}) || exit $?`;
  return `_CODEX_PROBE=${probe}
${!role ? select : role.optional ? `_CODEX_ROLE=''\nif [ -n "$_CODEX_ROLE" ]; then ${ready}\nelse ${select}; fi` : ready}
_CODEX_SEL=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SEL: //p')
_CODEX_SANDBOX_MODE=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SANDBOX: //p')`;
}

/**
 * Shared Codex error handling block for resolver output.
 * Used by ADVERSARIAL_STEP, CODEX_PLAN_REVIEW, CODEX_SECOND_OPINION,
 * DESIGN_OUTSIDE_VOICES, DESIGN_REVIEW_LITE, DESIGN_SKETCH.
 */
export function codexErrorHandling(feature: string): string {
  return `**エラー処理:** すべてのエラーはブロッキングではありません。${feature} は参考情報です。
- 認証の失敗(stderr に "auth"、"login"、"unauthorized" が含まれる): 記録してスキップする
- タイムアウト: タイムアウトの時間を記録してスキップする
- 空の応答: 記録してスキップする
どのエラーでも続行します。${feature} は参考情報であり、ゲートではありません。`;
}

/**
 * Shared Codex preflight bash block — the single source of truth for deciding
 * whether a Codex review pass should run. Used by ADVERSARIAL_STEP,
 * CODEX_PLAN_REVIEW, and CODEX_DOC_REVIEW so install/auth/config detection
 * lives in exactly one place.
 *
 * Emits ONE self-contained bash block that runs `gstack-codex-probe` as a
 * command (one subcommand per check), so it works from bash, zsh or sh and
 * nothing it learns persists to later blocks except the echoed mode. It:
 *   1. reads the `codex_reviews` master switch,
 *   2. checks that the probe is installed and executable
 *      (`CODEX_MODE: helper_unavailable` with the fix otherwise),
 *   3. runs `command -v codex` (literal — keeps the e2e substring assertion),
 *      then `check-auth`, `check-sandbox`, `probe-model` and `check-version`,
 *   4. logs the relevant `log-event` for each non-ready outcome,
 *   5. sets ONE canonical mode var and echoes `CODEX_MODE: <mode>` so the agent
 *      gates later blocks on the echoed value.
 *
 * Mode values: `disabled` (codex_reviews disabled or config unreadable; the
 * send binaries refuse it as consent_missing whatever this block prints) | `helper_unavailable` (the probe is
 * missing or not executable) | `not_installed` | `not_authed` |
 * `broken_install` | `sandbox_unavailable` | `model_unusable` | `quota_exhausted` |
 * `unverified` (echoed as `unverified (rate_limited)` after a probe-time 429) | `ready`.
 * The path is host-rewritten at gen-skill-docs time (pathRewrites), so the
 * literal `~/.claude/skills/gstack` is correct here and becomes `$GSTACK_ROOT`
 * etc. for non-Claude hosts.
 *
 * `disabledBehavior` controls the `disabled`-mode interpretation, which is the
 * one branch that legitimately differs per caller (D1):
 *   - `skip-all` (plan / doc reviews): disabled means no extra review step at
 *     all — skip the section, no Claude fallback.
 *   - `codex-only` (diff adversarial): disabled gates only the Codex passes; the
 *     free Claude adversarial subagent still runs.
 */
export function codexPreflight(opts: { modeVar?: string; disabledBehavior: 'skip-all' | 'codex-only'; nativeReview?: boolean; role?: boolean }): string {
  const m = opts.modeVar ?? '_CODEX_MODE';
  const disabledLine = opts.disabledBehavior === 'codex-only'
    ? 'Codex のパスだけをスキップします。下の Claude の敵対的サブエージェントは**引き続き**実行します(無料で高速です)。次を表示します: "Codex passes skipped (codex_reviews disabled) — running Claude adversarial only."'
    : 'このセクション全体をスキップします。Claude のサブエージェントにはフォールバック**しません**。disabled は追加のレビューステップがないことを意味します。次を表示します: "Codex review skipped (codex_reviews disabled). Re-enable: `gstack-config set codex_reviews enabled`."';
  const nativeRoute = opts.disabledBehavior === 'codex-only'
    ? '必須の Claude の敵対的パスは維持し、重複してディスパッチしません。'
    : 'Claude のサブエージェント経路にフォールバックします。';
  return `\`\`\`bash
# Codex preflight: the probe runs as a command, so any shell works.
_CODEX_PROBE=${CODEX_PROBE_PATH}
_CODEX_CFG=$(~/.claude/skills/gstack/bin/gstack-config get --stored codex_reviews 2>/dev/null)
_gstack_helper_error=""
[ -x "$_CODEX_PROBE" ] || _gstack_helper_error="gstack: cannot load gstack-codex-probe; re-run ./setup. https://github.com/garrytan/gstack/blob/main/docs/troubleshooting.md#sourced-helper-location"
if [ "$_CODEX_CFG" = "disabled" ] || [ "$_CODEX_CFG" = "unreadable" ]; then
  ${m}="disabled"
elif { [ -n "\${CODEX_THREAD_ID:-}" ] || [ -n "\${CODEX_SANDBOX:-}" ] || [ "\${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  ${m}="under_codex"
elif ! command -v codex >/dev/null 2>&1; then
  ${m}="not_installed"; "$_CODEX_PROBE" log-event codex_cli_missing 2>/dev/null || true
elif [ -n "$_gstack_helper_error" ]; then
  ${m}="helper_unavailable"; echo "$_gstack_helper_error"
elif ! "$_CODEX_PROBE" check-auth >/dev/null 2>&1; then
  ${m}="not_authed"; "$_CODEX_PROBE" log-event codex_auth_failed 2>/dev/null || true
else${opts.role ? '' : `
  # Free sandbox check before the paid probe; probe exit 2 = the CLI cannot run.`}
  _CODEX_MP=0${opts.role ? '' : '; _CODEX_PS=""'}
  "$_CODEX_PROBE" check-sandbox || _CODEX_MP=3${opts.role ? `
  if [ "$_CODEX_MP" -eq 3 ]; then
    ${m}="sandbox_unavailable"` : `
  for _CODEX_KIND in exec${opts.nativeReview ? ' review' : ''}; do
    [ "$_CODEX_MP" -eq 0 ] || break
    _CODEX_PO=$("$_CODEX_PROBE" probe-model $_CODEX_KIND); _CODEX_MP=$?; printf '%s\\n' "$_CODEX_PO"
    case "$_CODEX_PO" in *"STATE: inconclusive"*) _CODEX_PS=inconclusive ;; *"STATE: rate_limited"*) _CODEX_PS=rate_limited ;; esac
  done
  if [ "$_CODEX_MP" -eq 3 ]; then
    ${m}="sandbox_unavailable"
  elif [ "$_CODEX_MP" -eq 2 ]; then
    ${m}="broken_install"
  elif [ "$_CODEX_MP" -eq 4 ]; then
    ${m}="quota_exhausted"
  elif [ "$_CODEX_MP" -ne 0 ]; then
    ${m}="model_unusable"
  elif [ "$_CODEX_PS" = inconclusive ]; then
    ${m}="unverified"
  elif [ "$_CODEX_PS" = rate_limited ]; then
    ${m}="unverified (rate_limited)"`}
  else
    ${m}="ready"; "$_CODEX_PROBE" check-version || true
  fi
fi
echo "CODEX_MODE: $${m}"
\`\`\`

エコーされた \`CODEX_MODE\` で分岐します。
- **\`disabled\`** (または送信の \`consent_missing\` 行) — \`codex_reviews\` がオフか、読み取れません。${disabledLine}
- **\`helper_unavailable\`** — プローブが存在しないか、実行可能ではありません。上の行(原因と対処)を伝えます。${nativeRoute}
- **\`not_installed\`** — Codex CLI がありません。次を表示します: "Codex not installed; outside coverage unavailable. Install: \`npm install -g @openai/codex\`." ${nativeRoute}
- **\`under_codex\`** — 古い成果物が自分自身のハーネスを選択しました。次を表示します: "Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage. Repair: setup --host codex." 外部の呼び出しはスキップし、下のワークフローのネイティブレビューの指示に従います。継承されたハーネスのマーカーが矛盾していても、別のプロバイダーを推測する根拠にはなりません。
- **\`not_authed\`** — インストールされていますが、認証情報がありません。次を表示します: "Codex not authenticated; outside coverage unavailable. Run \`codex login\` or set \`$CODEX_API_KEY\`." ${nativeRoute}
- **\`broken_install\`** — CLI は PATH 上にありますが、実行できません(spawn ENOENT、実行不可のバイナリ、ベンダーのペイロード欠落)。次を表示します: "Codex is installed but its binary cannot run — Codex passes skipped. Reinstall: \`npm install -g @openai/codex\`." プローブの HINT 行を伝えます。${nativeRoute}
- **\`model_unusable\`** — ${opts.role ? 'ロールの呼び出しが、ポリシー、認証、またはモデルの選択を拒否しました。優先度の低い設定ではなく、その理由と、ソース固有の Repair/HINT 行を伝えます。`AUTH_FAILED` には `codex login` が必要です。モデルを勝手に差し替えてはいけません。' : "選択されたモデル(`CODEX_MODEL:` を参照)が無効、またはアカウントで利用できません(すべての呼び出しで HTTP 400)。プローブの HINT 行と対処(`GSTACK_CODEX_MODEL=<supported-model>` または config.toml の `model`)を伝えます。モデルを勝手に差し替えてはいけません。"} ${nativeRoute}${opts.role ? '' : ' 約 10 秒の往復の結果は 1 時間キャッシュされます。'}
- **\`quota_exhausted\`** — Codex の利用上限です。プローブの出力行(リセット時刻、再試行)をそのまま伝えます。この実行では、これ以上 Codex を呼びません。${nativeRoute}
- **\`sandbox_unavailable\`** — ここでは Codex のサンドボックスを起動できません(ユーザー名前空間のないコンテナ)。プローブが理由と対処を表示しています。有料の呼び出しは行われておらず、外部カバレッジは利用できません。${nativeRoute}
- **\`ready\`** or **\`unverified\`** — 下の Codex パスを実行します。\`unverified\` は、モデルのチェックがタイムアウトした、または \`(rate_limited)\` 付きの場合は 429 に当たったことを意味します。その旨を伝え、パス自身の評価に判断を委ねます。${opts.role ? `
プランレビューの準備確認は、[ポリシー](https://github.com/garrytan/gstack/blob/main/docs/model-policy.md)のモデルを確認します。その診断結果を伝えます。レビューブロックの終了ステータスから、クォータを推測してはいけません。` : ''}`;
}

/**
 * Canonical foreground-dispatch guidance (#497 → #2440 → a third recurrence at
 * a /ship documentation dispatch). Claude Code v2.1.198 made Agent-tool subagents run in the
 * BACKGROUND by default; a synchronous dispatch site must pass the flag
 * explicitly or the parent waits on output that never arrives. Rendered via
 * {{FOREGROUND_DISPATCH_NOTE}} in section templates; resolver sites may
 * interpolate it directly. Same name as the placeholder for grep-ability.
 */
/** The Claude Code release that flipped Agent-tool subagents to background-by-default (#497/#2440 class). Interpolated at every RESOLVER site — grep 'Claude Code v2.1' when bumping. */
export const CC_BACKGROUND_DEFAULT_SINCE = 'Claude Code v2.1.198';
/** Claude Code's fork-subagent schema has no run_in_background, so every foreground request is conditional (CEO-20). */
export const FOREGROUND_IF_AVAILABLE = '`run_in_background: false`(利用可能な場合)';
/** The recovery when a requested foreground dispatch still ran in the background. */
export const BACKGROUND_RECOVERY = '起動レシートが返った場合は、バックグラウンドで実行されています。その完了通知を待ちます。';

export const FOREGROUND_DISPATCH_NOTE =
  `**フォアグラウンド必須:** Agent の呼び出しで ${FOREGROUND_IF_AVAILABLE} を渡します。サブエージェントは ${CC_BACKGROUND_DEFAULT_SINCE} 以降、デフォルトでバックグラウンド実行されるため、使えるフラグを省略するとバックグラウンド実行になります。${BACKGROUND_RECOVERY} ディスパッチは Agent ツールだけで行います。対象を Skill として呼び出したり、そのワークフローを自分のコンテキストでインライン実行したりすると、このディスパッチが存在する理由である新しいコンテキストによる分離が失われます。たとえそのスキルが利用可能なスキルの一覧に載っていてもです。(ステップにインラインのフォールバックが定義されている場合、それが適用されるのは、ディスパッチしたサブエージェントが失敗した後だけです。)`;
