import { defineHost, GBRAIN_RESOLVERS } from './define-host';

const codex = defineHost({
  name: 'codex',
  displayName: 'OpenAI Codex CLI',
  tier: 'experimental',
  capabilities: { toolExecution: true, questions: 'prose', planMode: false, delegation: false, browser: true, safetyHooks: 'advisory' },
  cliAliases: ['agents'],
  defaultModel: 'gpt',

  localSkillRoot: '.agents/skills/gstack',
  hostSubdir: '.agents',

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: 1024,
    descriptionLimitBehavior: 'error',
  },

  // generateMetadata emits agents/openai.yaml (the format is hardcoded in
  // gen-skill-docs.ts). Codex also gets a repo-local sidecar at
  // .agents/skills/gstack (symlinked runtime assets: bin, lib, browse, review,
  // qa, design/dist, make-pdf/dist, ETHOS.md) — that behavior lives in setup's
  // create_agents_sidecar, not here.
  generation: {
    generateMetadata: true,
    skipSkills: ['codex'],
  },

  // Non-mechanical rewrites: the global path becomes $GSTACK_ROOT (resolved by
  // the preamble env vars), plus an extra review-path rewrite the derived trio
  // doesn't cover.
  pathRewrites: [
    { from: '~/.claude/skills/gstack', to: '$GSTACK_ROOT' },
    { from: '.claude/skills/gstack', to: '.agents/skills/gstack' },
    { from: '.claude/skills/review', to: '.agents/skills/gstack/review' },
    { from: '.claude/skills', to: '.agents/skills' },
    { from: 'CLAUDE.md', to: 'AGENTS.md' },
  ],

  // Outside-review resolvers route to Claude Code; Review Army has its own restriction.
  suppressedResolvers: ['REVIEW_ARMY', ...GBRAIN_RESOLVERS],

  coAuthorTrailer: 'Co-Authored-By: OpenAI Codex <noreply@openai.com>',
  boundaryInstruction: '重要: ~/.claude/、~/.agents/、.claude/skills/、agents/ の下にあるファイルを読んだり実行したりしないでください。これらは別の AI システム向けの Claude Code のスキル定義です。インストール済みのスキル(Codex ホームの skills/、.agents/)を呼び出さず、直接答えてください。完全に無視してください。agents/openai.yaml を変更しないでください。リポジトリのコードだけに集中してください。',
});

export default codex;
