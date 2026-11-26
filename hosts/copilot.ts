import { defineHost, GBRAIN_RESOLVERS, preambleToolGlossary } from './define-host';

// GitHub Copilot CLI (#393). Ported from PR #2323 (@andrey-esipov) with ideas
// from #396/#487 (@ridermw) and #1852 (@lolisaigao1234); disposition in
// docs/ADDING_A_HOST.md "GitHub Copilot CLI".
// On Windows: Git Bash note (#3047).
const COPILOT_TOOL_GLOSSARY = '**GitHub Copilot のツール名:** `AskUserQuestion` は `ask_user` ツールを指します(1 回の呼び出しにつき質問は 1 つ。判断の要約を質問文に、各選択肢を choices に入れます)。`ExitPlanMode` は `exit_plan_mode`、Agent ツールは `task`、Read ツールは `view`、Skill ツールは `skill` を指します。Copilot には `mcp__*__AskUserQuestion` 系のバリアントはありません。**Windows の場合:** 各 bash ブロックは、フルパス(通常は `C:\\Program Files\\Git\\bin\\bash.exe`)で Git for Windows の Bash で実行してください。素の `bash` では WSL が起動することがあります。ブロックを PowerShell に書き換えないでください。また、拡張子のない gstack ヘルパーを PowerShell から直接実行しないでください。Windows はアプリ選択ダイアログを開いてしまい、実行されません。';

const copilot = defineHost({
  name: 'copilot',
  displayName: 'GitHub Copilot CLI',
  tier: 'experimental',
  capabilities: { toolExecution: true, questions: 'native', planMode: true, delegation: true, browser: true, safetyHooks: 'advisory' },

  localSkillRoot: '.github/skills/gstack',

  frontmatter: {
    mode: 'allowlist',
    keepFields: ['name', 'description'],
    descriptionLimit: 1024,
    descriptionLimitBehavior: 'error',
    conditionalFields: [
      { if: { sensitive: true }, add: { 'disable-model-invocation': true } },
    ],
  },

  // Literal ~/.copilot paths (the Cursor model, not Codex's $GSTACK_ROOT) so
  // skills without the preamble (careful, freeze, gstack-upgrade) still
  // resolve. .github/skills is Copilot's project skill directory. The runtime
  // root is not a checkout, so /gstack-upgrade finds the source through
  // .source-path (written by setup).
  pathRewrites: [
    { from: 'if [ -d "$HOME/.claude/skills/gstack/.git" ]', to: 'if [ -d "$(cat "$HOME/.copilot/skills/gstack/.source-path" 2>/dev/null)/.git" ]' },
    { from: 'INSTALL_DIR="$HOME/.claude/skills/gstack"', to: 'INSTALL_DIR="$(cat "$HOME/.copilot/skills/gstack/.source-path")"' },
    { from: '$HOME/.claude/skills/gstack', to: '$HOME/.copilot/skills/gstack' },
    { from: '~/.claude/skills/gstack', to: '~/.copilot/skills/gstack' },
    { from: '.claude/skills/gstack', to: '.github/skills/gstack' },
    { from: '.claude/skills/review', to: '.github/skills/gstack/review' },
    { from: '.claude/skills', to: '.github/skills' },
  ],
  toolRewrites: preambleToolGlossary(COPILOT_TOOL_GLOSSARY),

  suppressedResolvers: ['REVIEW_ARMY', ...GBRAIN_RESOLVERS],
});

export default copilot;
