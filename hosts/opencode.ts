import { defineHost, preambleToolGlossary, sharedRuntimeRoot } from './define-host';

const opencode = defineHost({
  name: 'opencode',
  displayName: 'OpenCode',
  tier: 'experimental',
  capabilities: { toolExecution: true, questions: 'native', planMode: true, delegation: true, browser: true, safetyHooks: 'advisory' },

  globalRoot: '.config/opencode/skills/gstack',  // XDG config dir, not ~/.opencode

  // #2626: the shared prose names Claude's question tool.
  toolRewrites: preambleToolGlossary('**OpenCode のツール名:** `AskUserQuestion` は `question` ツールを指します。`mcp__*__AskUserQuestion` という別名はありません。手順で `ExitPlanMode` の呼び出しを求められた場合は、代わりに計画が完成したことをユーザーに伝えて待機してください。'),

  // OpenCode links a wider runtime asset set than the shared default
  // (design binary, review specialists, qa templates/references, DX hall of fame).
  runtimeRoot: sharedRuntimeRoot(['qa/templates', 'qa/references']),
});

export default opencode;
