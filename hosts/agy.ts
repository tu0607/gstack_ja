import { defineHost, GBRAIN_RESOLVERS, preambleToolGlossary } from './define-host';

// Google Antigravity CLI, named after its `agy` binary: the longer name pushed
// the runtime prelude past PRELUDE_BYTE_BUDGET. Rewritten on defineHost() from
// the community attempts; disposition and doc sources in docs/ADDING_A_HOST.md
// "Antigravity CLI".
// Paths: the CLI reads global skills from ~/.gemini/antigravity-cli/skills and
// workspace skills from .agents/skills (antigravity.google/docs/skills, CLI
// section). Tool names: antigravity.google/docs/hooks "Supported tools".
const ANTIGRAVITY_TOOL_GLOSSARY = '**Antigravity のツール名:** `AskUserQuestion` は `ask_question` ツール(選択肢はチョイスとして渡す)を指します。`mcp__*__AskUserQuestion` という変種はありません。Bash ツールは `run_command`、Read ツールは `view_file`、Write ツールは `write_to_file`、Edit ツールは `replace_file_content`(1 つのファイルに複数の編集を行う場合は `multi_replace_file_content`)、Grep は `grep_search`、Glob は `find_by_name`、Agent ツールは `invoke_subagent` を指します。Skill ツールはありません。スキルは `view_file` で SKILL.md を読んで読み込みます。ステップが `ExitPlanMode` の呼び出しを求めている場合は、計画の準備ができたことをユーザーに伝えて待ちます。`view_file` は長いファイルの一部しか返さないことがあります。SKILL.md や、読むよう指示されたファイルが最後の行より前で終わっている場合は、それに基づいて動く前に、残りの行範囲を読みます。';

const agy = defineHost({
  name: 'agy',
  displayName: 'Antigravity CLI',
  cliAliases: ['antigravity'],
  defaultModel: 'gemini',
  tier: 'experimental',
  capabilities: { toolExecution: true, questions: 'native', planMode: false, delegation: true, browser: true, safetyHooks: 'advisory' },

  globalRoot: '.gemini/antigravity-cli/skills/gstack',
  localSkillRoot: '.agents/skills/gstack',
  // Render output only. .agents is Codex's render tree, and .gemini is Gemini
  // CLI's workspace directory.
  hostSubdir: '.agy',

  // Antigravity reads name and description only; name defaults to the
  // directory, and the CLI turns each name into a slash command, so names
  // match their gstack-<skill> directories instead of shadowing /plan-style
  // built-ins. 1024 is the Agent Skills description limit.
  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: 1024,
    descriptionLimitBehavior: 'error',
    nameMatchesDirectory: true,
  },

  // Literal ~/.gemini/antigravity-cli paths (the Copilot model) so skills
  // without the preamble still resolve; .source-path (written by setup) lets
  // /gstack-upgrade find the checkout behind the runtime root.
  pathRewrites: [
    { from: 'if [ -d "$HOME/.claude/skills/gstack/.git" ]', to: 'if [ -d "$(cat "$HOME/.gemini/antigravity-cli/skills/gstack/.source-path" 2>/dev/null)/.git" ]' },
    { from: 'INSTALL_DIR="$HOME/.claude/skills/gstack"', to: 'INSTALL_DIR="$(cat "$HOME/.gemini/antigravity-cli/skills/gstack/.source-path")"' },
    { from: '$HOME/.claude/skills/gstack', to: '$HOME/.gemini/antigravity-cli/skills/gstack' },
    { from: '~/.claude/skills/gstack', to: '~/.gemini/antigravity-cli/skills/gstack' },
    { from: '.claude/skills/gstack', to: '.agents/skills/gstack' },
    { from: '.claude/skills/review', to: '.agents/skills/gstack/review' },
    { from: '.claude/skills', to: '.agents/skills' },
    { from: 'CLAUDE.md', to: 'AGENTS.md' },
  ],
  toolRewrites: preambleToolGlossary(ANTIGRAVITY_TOOL_GLOSSARY),

  suppressedResolvers: ['REVIEW_ARMY', ...GBRAIN_RESOLVERS],

  runtimeRoot: {
    globalSymlinks: ['bin', 'lib', 'browse/dist', 'browse/bin', 'design/dist', 'make-pdf/dist', 'freeze/bin', 'careful/bin', 'gstack-upgrade', 'ETHOS.md'],
    globalFiles: {
      'review': ['checklist.md', 'design-checklist.md', 'greptile-triage.md', 'TODOS-format.md'],
    },
  },
});

export default agy;
