import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { between, expectMentions } from './helpers/prompt-structure';

const root = join(import.meta.dir, '..');
const source = (name: string) => readFileSync(join(root, 'land-and-deploy', name), 'utf8');

describe('land-and-deploy handles a recorded command deploy trigger', () => {
  test('Step 5 routes a recorded command trigger before URL polling', () => {
    const merge = source('sections/merge-and-deploy.md');
    const route = merge.indexOf('2. 記録されたコマンドによるトリガー');
    expect(route).toBeGreaterThanOrEqual(0);
    expect(route).toBeLessThan(merge.indexOf('3. 明示的な `VERIFY_URL`'));
    expect(route).toBeLessThan(merge.indexOf('5. それ以外の場合'));
    const body = between(merge, '2. 記録されたコマンドによるトリガー', '3. 明示的な `VERIFY_URL`');
    expectMentions(body, [
      ['本番', 'まだ動いていない'],
      ['明示的な承認', '自分で実行'],
      ['終了コード', '0', 'リビジョンの証明'],
    ]);
  });

  test('a pending workflow or platform trigger is not mistaken for a command trigger', () => {
    const merge = source('sections/merge-and-deploy.md');
    const body = between(merge, '1. 一致するデプロイの実行', '2. 記録されたコマンドによるトリガー');
    expectMentions(body, [['ワークフロー', 'プラットフォーム', '保留']]);
  });

  test('Strategy D points at the route and still demands revision proof', () => {
    const main = source('SKILL.md');
    const body = between(main, '### 戦略 D: カスタムのデプロイフック', '### 共通: タイミングと失敗の処理');
    expectMentions(body, [
      ['Step 5', 'ルート 2'],
      ['明示的な承認'],
      ['終了コード', 'リビジョンの証明'],
    ]);
  });
});
