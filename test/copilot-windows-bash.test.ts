/**
 * Copilot CLI on Windows ran gstack's extensionless helpers straight from
 * PowerShell. The Copilot tool glossary (rendered into every Copilot skill)
 * names Git for Windows Bash by full path. Kept out of host-config.test.ts,
 * which the curated Windows lane excludes, so Windows runs this check.
 */
import { describe, test } from 'bun:test';
import { expectMentions } from './helpers/prompt-structure';

describe('#3047: Copilot on Windows runs bash blocks in Git for Windows Bash', () => {
  test('the Copilot tool glossary names Git Bash by full path and forbids PowerShell translation', async () => {
    const { default: copilot } = await import('../hosts/copilot');
    const glossary = JSON.stringify(copilot.toolRewrites);
    expectMentions(glossary, [
      ['Git for Windows', 'Bash', 'bash.exe'],
      ['bash', 'WSL'],
      ['PowerShell', '書き換えないでください'],
    ], 'Copilot tool glossary');
  });
});
