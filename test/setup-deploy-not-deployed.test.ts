import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const SKILL = fs.readFileSync(path.resolve(import.meta.dir, '..', 'setup-deploy', 'SKILL.md'), 'utf-8');

function section(heading: string, next: string): string {
  const start = SKILL.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = SKILL.indexOf(next, start + heading.length);
  expect(end).toBeGreaterThan(start);
  return SKILL.slice(start, end);
}

describe('setup-deploy handles a project with nothing live yet', () => {
  const question = section('1. **デプロイはどのようにトリガーされますか?**', '2. **本番 URL は何ですか?**');

  test('not deployed yet and never deploys are separate answers', () => {
    expect(question).toContain('E) まだ何もデプロイされていない');
    expect(question).toContain('F) このプロジェクトはデプロイしない');
  });

  test('nothing deployed yet stops before the URL question and writes nothing', () => {
    const onE = question.slice(question.indexOf('E の場合は'));
    expect(onE).toContain('ここで停止し、何も書き込まないでください');
    expect(onE).toContain('本番 URL も記録すべきデプロイトリガーもまだ存在しません');
    expect(onE).toContain('`/setup-deploy` を再実行');
  });

  test('a project that never deploys still gets the none configuration', () => {
    expect(question).toContain('F の場合は、Step 4 で `none` の設定を書き込みます');
    expect(SKILL).toContain('platform/URL/workflow/status/health/trigger を `none` に設定');
  });
});
