import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { expectMentions } from './helpers/prompt-structure';

const SKILL = fs.readFileSync(path.resolve(import.meta.dir, '..', 'setup-deploy', 'SKILL.md'), 'utf-8');

function section(heading: string, next: string): string {
  const start = SKILL.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  return SKILL.slice(start, SKILL.indexOf(next, start + heading.length));
}

describe('setup-deploy does not assume Vercel deploys on push', () => {
  test('auto-deploy is conditional on a Git-connected Vercel project', () => {
    const vercel = section('#### Vercel', '#### Netlify');
    expectMentions(vercel, [['Vercel プロジェクトがこの Git リポジトリに接続されている場合に限'], ['CLI のみ', 'デプロイ', 'ユーザーに尋ね', 'トリガー']], 'Vercel');
  });

  test('the nothing-detected path explains how a CLI-only Vercel project becomes detectable', () => {
    const manual = section('#### カスタム / 手動', '1. **デプロイはどのようにトリガーされますか?**');
    expectMentions(manual, [['Vercel CLI', '`vercel.json`', '`.vercel/`'], ['`vercel link`', '`.vercel/`']], 'Custom / Manual');
    expect(SKILL).not.toMatch(/GoLive/i);
  });
});
