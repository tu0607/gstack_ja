import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildWorkflowJudgePrompt, type WorkflowJudgeFile, type WorkflowJudgeInput } from './workflow-judge-input';

export const COOKIE_WORKFLOW_JUDGE = {
  model: 'claude-sonnet-5-5',
  judgeContext: 'a fallback-browser cookie import workflow',
  judgeGoal: 'how to select an authorized source browser, profile, and domain without guessing an account; configure optional authentication verification before mutation; obtain explicit consent for precisely scoped storage reset; distinguish copied cookies from positive sign-in evidence; and recover within the documented platform and privacy boundaries',
  thresholds: { clarity: 4, completeness: 3, actionability: 4 },
} as const;

export function buildCookieWorkflowJudgeInput(root: string): WorkflowJudgeInput & { prompt: string; sha256: string } {
  // Each marker lists its English heading and the Japanese heading of the translated fork; exactly one must match.
  const files: WorkflowJudgeFile[] = [
    { path: 'setup-browser-cookies/SKILL.md', kind: 'entrypoint', start: ['# Setup Browser Cookies', '# ブラウザ Cookie のセットアップ'], end: null },
    { path: 'BROWSER.md', kind: 'section', start: ['#### Choosing a source and checking sign-in', '#### 取り込み元の選択とサインインの確認'], end: ['### Tabs + frames', '### タブとフレーム'] },
  ].map(spec => {
    const source = readFileSync(join(root, spec.path), 'utf8');
    const locate = (markers: string[]): { index: number; marker: string } => {
      const found = markers.map(marker => ({ marker, matches: [...source.matchAll(new RegExp(`^${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\r?$`, 'gm'))] }))
        .filter(candidate => candidate.matches.length > 0);
      if (found.length !== 1 || found[0].matches.length !== 1) {
        throw new Error(`${spec.path}: expected exactly one marker ${JSON.stringify(markers)}, found ${found.reduce((total, candidate) => total + candidate.matches.length, 0)}`);
      }
      return { index: found[0].matches[0].index!, marker: found[0].marker };
    };
    const startAt = locate(spec.start);
    const start = startAt.index;
    const end = spec.end === null ? source.length : locate(spec.end).index;
    if (end <= start || !source.slice(start + startAt.marker.length, end).trim()) {
      throw new Error(`${spec.path}: empty or reversed cookie workflow excerpt`);
    }
    return {
      path: spec.path,
      kind: spec.kind as WorkflowJudgeFile['kind'],
      content: source.slice(start, end),
      startLine: source.slice(0, start).split('\n').length,
      endLine: source.slice(0, end - 1).split('\n').length,
    };
  });
  if (!files[0].content.includes('`BROWSER.md`') || !(files[0].content.includes('**Choosing a source and checking sign-in**') || files[0].content.includes('**取り込み元の選択とサインインの確認**'))) {
    throw new Error('setup-browser-cookies/SKILL.md: missing cookie reference link');
  }
  const text = [
    'SKILL.md is the entry point. BROWSER.md supplies the exact referenced cookie section, not an additional execution step.',
    ...files.map(file => [
      `--- BEGIN FILE ${JSON.stringify(file.path)} (lines ${file.startLine}-${file.endLine}; ${file.kind}) ---`,
      file.content,
      `--- END FILE ${JSON.stringify(file.path)} ---`,
    ].join('\n')),
  ].join('\n\n');
  const input = { files, text };
  const prompt = buildWorkflowJudgePrompt(COOKIE_WORKFLOW_JUDGE, input);
  return { ...input, prompt, sha256: createHash('sha256').update(prompt).digest('hex') };
}
