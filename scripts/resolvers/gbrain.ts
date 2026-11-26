/**
 * GBrain resolver — brain-first lookup and save-to-brain for thinking skills.
 *
 * GBrain is a "mod" for gstack. When installed, coding skills become brain-aware:
 * they search the brain for context before starting and save results after finishing.
 *
 * These resolvers are suppressed on hosts that don't support brain features
 * (via suppressedResolvers in each host config). For those hosts,
 * {{GBRAIN_CONTEXT_LOAD}}, {{GBRAIN_SAVE_RESULTS}}, {{BRAIN_PREFLIGHT}},
 * {{BRAIN_CACHE_REFRESH}}, and {{BRAIN_WRITE_BACK}} all resolve to empty string.
 *
 * Compatible with GBrain >= v0.10.0 (search CLI, doctor --fast --json, entity enrichment).
 *
 * Brain-aware planning (T4 / v1.48 plan): adds three new resolvers powered by
 * the bin/gstack-brain-cache CLI and scripts/brain-cache-spec.ts. The new
 * resolvers fire only for the 5 planning skills registered in
 * SKILL_DIGEST_SUBSETS (office-hours, plan-ceo-review, plan-eng-review,
 * plan-design-review, plan-devex-review).
 */
import type { TemplateContext } from './types';
import {
  SKILL_DIGEST_SUBSETS,
  SKILL_CALIBRATION_WEIGHTS,
  BRAIN_CACHE_ENTITIES,
  getSkillSubset,
  getInvalidationTargets,
} from '../brain-cache-spec';

// Per-skill slug + title + tag metadata for SAVE_RESULTS. The full save
// template (heredoc body, entity-stub instructions, throttle handling,
// backlinks) lives in docs/gbrain-write-surfaces.md §Save Template and is
// read on-demand by the agent. Compressing the inline prose keeps the
// token footprint at ~150 tokens per skill (down from ~500), so users with
// gbrain installed pay a small overhead and users without it (whose hosts
// have GBRAIN_SAVE_RESULTS suppressed at gen-time) pay nothing.
interface SkillSaveMeta {
  slugPrefix: string;
  title: string;
  tag: string;
}

const skillSaveMap: Record<string, SkillSaveMeta> = {
  'office-hours':         { slugPrefix: 'office-hours',    title: 'Office Hours',    tag: 'design-doc' },
  'investigate':          { slugPrefix: 'investigations',  title: 'Investigation',   tag: 'investigation' },
  'plan-ceo-review':      { slugPrefix: 'ceo-plans',       title: 'CEO Plan',        tag: 'ceo-plan' },
  'plan-eng-review':      { slugPrefix: 'eng-reviews',     title: 'Eng Review',      tag: 'eng-review' },
  'plan-design-review':   { slugPrefix: 'design-reviews',  title: 'Design Review',   tag: 'design-review' },
  'plan-devex-review':    { slugPrefix: 'devex-reviews',   title: 'Devex Review',    tag: 'devex-review' },
  'retro':                { slugPrefix: 'retros',          title: 'Retro',           tag: 'retro' },
  'ship':                 { slugPrefix: 'releases',        title: 'Release',         tag: 'release' },
  'cso':                  { slugPrefix: 'security-audits', title: 'Security Audit',  tag: 'security-audit' },
  'design-consultation':  { slugPrefix: 'design-systems',  title: 'Design System',   tag: 'design-system' },
};

export function generateGBrainContextLoad(ctx: TemplateContext): string {
  let base = `## Brain Context Load(brain の文脈の読み込み)

**\`gbrain\` が PATH にない場合は、このセクション全体をスキップします。**

ユーザーのリクエストから 2〜4 個のキーワードを抽出し、brain を検索します:
\`gbrain search "<keywords>"\`。上位 3 件の結果を
\`gbrain get "<slug>"\` で読みます。その文脈を分析に活かします。

\`gbrain search\` が結果を返さない場合、または 0 以外の終了コードで終わった場合は、
brain の文脈なしで進めます。検索/読み取りの完全なプロトコルと例は、
\`docs/gbrain-write-surfaces.md\` §Context Load を参照してください。`;

  if (ctx.skillName === 'investigate') {
    base += `\n\n構造化データの抽出リクエスト(「これを追跡して」「メールから抽出して」「トラッカーを作って」)は、代わりに GBrain の data-research スキルに回します: \`gbrain call data-research\`。`;
  }

  return base;
}

export function generateGBrainSaveResults(ctx: TemplateContext): string {
  // gbrain v0.18+ uses `gbrain put <slug>` (NOT the deprecated `put_page`
  // MCP op). Compressed in v1.50.0.0: the inline heredoc + entity-stub +
  // throttle + backlink prose moved to docs/gbrain-write-surfaces.md
  // §Save Template, which the agent reads on demand when it actually
  // saves. The compact pointer keeps non-gbrain users' token overhead
  // near zero when their host's static suppression is overridden by
  // detection.
  const meta = skillSaveMap[ctx.skillName];

  if (!meta) {
    return `## Save Results to Brain(結果を brain に保存)

**\`gbrain\` が PATH にない場合は、このセクション全体をスキップします。**

スキルの出力が保存に値する場合は、ファイル書き込みツールでページ(frontmatter + Markdown)を
非公開のファイルに書き、
\`gbrain put "<slug>" < "<page-file>"\` を実行します。完全なテンプレート(frontmatter の形、
エンティティのスタブ、スロットル処理)は、\`docs/gbrain-write-surfaces.md\` §Save Template を参照してください。`;
  }

  return `## Save Results to Brain(結果を brain に保存)

**\`gbrain\` が PATH にない場合は、このセクション全体をスキップします。**

出力を保存します: リポジトリのルートで \`mkdir -p .gstack/tmp && mktemp .gstack/tmp/page.XXXXXX\` を実行し、
ファイル書き込みツールで、出力されたファイルにページを書きます
(frontmatter は \`title: "${meta.title}: <feature name>"\`、\`tags: [${meta.tag}, <feature-slug>]\`、
続けて出力を Markdown で)。その後:

\`\`\`bash
gbrain put "${meta.slugPrefix}/<feature-slug>" < "<page-file>" && rm -f "<page-file>"
\`\`\`

保存したページを読み戻してから、永続化したと主張します。その後、ページ内の人物/組織の
エンティティのスタブページを作成します。0 以外の終了コード(スロットルを含む)は一時的なものです。その場では
再試行しません。エンティティのスタブ、スロットル、バックリンクは、
\`docs/gbrain-write-surfaces.md\` §Save Template を参照してください。`;
}

// ────────────────────────────────────────────────────────────────────
// Brain-aware planning resolvers (T4 / v1.48 plan)
// ────────────────────────────────────────────────────────────────────

/**
 * Returns true when this skill is registered for brain preflight. Skills not
 * in SKILL_DIGEST_SUBSETS get an empty BRAIN_PREFLIGHT block (no behavior).
 */
function isPreflightSkill(skillName: string): boolean {
  return Object.prototype.hasOwnProperty.call(SKILL_DIGEST_SUBSETS, skillName);
}

/**
 * Renders the per-skill BRAIN_PREFLIGHT block. The rendered output is a single
 * bash script that:
 *   1. Reads each digest file from gstack-brain-cache get (one call per digest)
 *   2. Falls back to "(brain context unavailable)" on missing
 *   3. Concatenates outputs into a single ## Brain Context block injected
 *      into the skill's prompt context
 *   4. Tells the agent: "use this context to skip already-known questions"
 *
 * The cache CLI handles cold-refresh + lock dedup + stale-but-usable
 * fallback internally. From the resolver's perspective the call is one
 * shell command per digest.
 */
export function generateBrainPreflight(ctx: TemplateContext): string {
  if (!isPreflightSkill(ctx.skillName)) return '';
  const subset = getSkillSubset(ctx.skillName);
  const binDir = ctx.paths.binDir;
  // Build the bash that loads each digest. Per-skill subset is small (2-5 entries).
  const loadLines = subset.map((entityName) => {
    const entity = BRAIN_CACHE_ENTITIES[entityName];
    if (!entity) return '';
    const projectFlag = entity.scope === 'per-project' ? '--project "$SLUG"' : '';
    return `  printf '\\n### %s\\n\\n' "${entityName}"\n  ${binDir}/gstack-brain-cache get ${entityName} ${projectFlag} 2>/dev/null || printf '_(no ${entityName} digest available yet)_\\n'`;
  }).join('\n');
  const usageByEntity: Record<string, string> = {
    product: '`product` ダイジェストにバリュープロポジション、ターゲットユーザー、ステージが示されている場合は、再度尋ねない。',
    goals: '`goals` ダイジェストにアクティブな目標が列挙されている場合は、それに照らして推奨を組み立てる。',
    'recent-decisions': '`recent-decisions` ダイジェストに過去のスコープ/アーキテクチャの選択が示されている場合は、このプランがそれと矛盾していないか指摘する。',
    'user-profile': '`user-profile` ダイジェストにキャリブレーションのパターン(「セキュリティを作り込みすぎる傾向がある」など)が含まれている場合は、関連するときに提示する。',
    'developer-persona': '`developer-persona` ダイジェストにビルダーのワークフローや摩擦への耐性が記述されている場合は、DX の推奨をそれに合わせる。',
    brand: '`brand` ダイジェストにビジュアルの原則や制約が示されている場合は、デザインの好みを尋ねる前にそれを使う。',
    'competitive-intel': '`competitive-intel` ダイジェストに競合製品やワークフローへの期待が示されている場合は、比較の文脈として使う。',
    salience: '`salience` ダイジェストが最近のローカルな文脈を示している場合は、単独の事実ではなく、検証すべき手がかりとして扱う。',
  };
  const usageLines = subset
    .map((entityName) => usageByEntity[entityName])
    .filter(Boolean)
    .map((line) => `- ${line}`)
    .join('\n');

  return `## Brain Context (preflight)(brain の文脈、事前読み込み)

${ctx.skillName === 'plan-eng-review' ? 'Scope ゲートの後、以降のレビューの質問の前に、' : '確認の質問をする前に、'}このプロジェクトの brain の構造化された文脈を読み込みます。
キャッシュ層が、陳腐化、更新、期限切れでも使えるフォールバックを
自動で処理します。読み込んだ文脈にすでに答えがある質問はスキップし、
推奨は、brain がこのスキル向けに出力した内容に基づかせます。

\`\`\`bash
SLUG=$(${binDir}/gstack-slug --get SLUG 2>/dev/null) || true
{
  printf '## Brain Context(brain の文脈)\\n\\n'
${loadLines}
} > /tmp/.gstack-brain-context-$$.md 2>/dev/null
[ -s /tmp/.gstack-brain-context-$$.md ] && cat /tmp/.gstack-brain-context-$$.md
rm -f /tmp/.gstack-brain-context-$$.md 2>/dev/null || true
\`\`\`

**この文脈の使い方:**
${usageLines}
- ダイジェストが \`(no X digest available yet)\` の場合は、そのセクションをコールド(未取得)として扱い、ユーザーに尋ねる。

**プライバシー:** Salience ダイジェストは許可リストでフィルタされます(D9 のデフォルト: \`projects/\`、
\`gstack/\`、\`concepts/\` のみ)。個人/家族/セラピーの内容がここに漏れることはありません。
`;
}

/**
 * Renders the at-skill-end background refresh hook. Fires after the skill's
 * own work completes (telemetry has already logged); kicks any digest whose
 * age exceeds half its TTL but hasn't yet expired, so the NEXT invocation
 * gets a fresh cache without paying the cold-miss tax.
 *
 * Subordinate to {{TELEMETRY}} — runs after. Doesn't block the user.
 */
export function generateBrainCacheRefresh(ctx: TemplateContext): string {
  if (!isPreflightSkill(ctx.skillName)) return '';
  const binDir = ctx.paths.binDir;
  return `## Brain Cache Background Refresh(brain キャッシュのバックグラウンド更新)

${ctx.skillName === 'plan-ceo-review' ? `終了ゲートを通過したら、テレメトリの前に、このノンブロッキングの更新を開始します。
その後、以下の最終処理の指示に戻ります。ユーザーが
更新プロセスを待つ必要はありません。` : `スキルの作業が完了し(テレメトリが記録された後)、TTL に近づいているキャッシュダイジェストの
バックグラウンド更新を起動します。
これはノンブロッキングで、ユーザーは待ちません。次回の呼び出しでは、
ウォームなキャッシュの恩恵を受けられます。`}

\`\`\`bash
SLUG=$(${binDir}/gstack-slug --get SLUG 2>/dev/null) || true
(${binDir}/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
\`\`\`
`;
}

/**
 * Renders the calibration write-back block. ONLY emits when the skill makes
 * typed decisions worth a kind=bet take AND the brain trust policy is
 * personal. Phase 2 / E5 cross-skill calibration.
 *
 * Gated behind BRAIN_CALIBRATION_WRITEBACK feature flag in the resolver
 * output — the flag stays false until upstream gbrain ships takes_add MCP
 * op (T8). When the flag flips, the existing skill templates pick up the
 * write-back behavior without any template changes.
 */
export function generateBrainWriteBack(ctx: TemplateContext): string {
  if (!isPreflightSkill(ctx.skillName)) return '';
  const weight = SKILL_CALIBRATION_WEIGHTS[ctx.skillName];
  if (weight == null) return '';
  // List the cache digests this skill's writes should invalidate. Multiple
  // skills write to multiple entities; the invalidation map captures this.
  const invalidatesEntities = getInvalidationTargets(`/${ctx.skillName}`);
  const invalidateBash = invalidatesEntities
    .map((e) => `  ${ctx.paths.binDir}/gstack-brain-cache invalidate ${e} --project "$SLUG" 2>/dev/null || true`)
    .join('\n');

  return `## Brain Calibration Write-Back (gated)(brain キャリブレーションの書き戻し、ゲート付き)

${ctx.skillName === 'plan-eng-review' ? '`BRAIN_CALIBRATION_WRITEBACK` は、デフォルトでオフの予約済みゲートです。このランタイムはこれを設定しません。このセクションをスキップし、終了のシーケンスを続けます。有効にしたり、brain が利用可能であることから許可を推測したりしてはいけません。以下の契約は、将来のゲート付き統合のために残してあるもので、今すぐ書き込む指示ではありません。\n\n' : ''}\`BRAIN_CALIBRATION_WRITEBACK\` が設定され、かつプリアンブル/brain-health の
出力または gstack の設定に \`brain_trust_policy@<endpoint-hash>=personal\` が示されている場合を除き、スキップします。
不明な場合はスキップします。両方のゲートを通過した場合は、永続的な
型付きの予測を 1 つ \`mcp__gbrain__takes_add\` で記録します。利用できない場合は、
gstack:takes フェンスブロックを付けて \`mcp__gbrain__put_page\` を使います。

Take の frontmatter:
\`\`\`yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: ${weight}
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: ${ctx.skillName}
\`\`\`

書き込み後、影響を受けるダイジェストを無効化します:

\`\`\`bash
SLUG=$(${ctx.paths.binDir}/gstack-slug --get SLUG 2>/dev/null) || true
${invalidateBash || '  # (no per-skill invalidation targets configured)'}
\`\`\``;
}
