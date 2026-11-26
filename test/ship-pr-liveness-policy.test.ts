import { describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { expectMentions } from './helpers/prompt-structure';

const template = fs.readFileSync(
  path.join(import.meta.dir, '..', '.github', 'PULL_REQUEST_TEMPLATE.md'),
  'utf8',
);

describe('gstack PR liveness policy', () => {
  test('remembers the authenticated repository-owner exemption', () => {
    expect(template).toContain('gh api user --jq .login');
    expectMentions(template, [['@garrytan', '適用除外'], ['git', 'author', 'メタデータ', '不十分']], 'template');
  });

  test('retains live GSTACK PR proof for every other contributor', () => {
    expectMentions(template, [
      ['生存証明', '外部コントリビューター', '必須'],
      ['その他のコントリビューター', 'スクリーンショット', '添付'],
      ['`GSTACK PR`', 'ライブ', '入力'],
      ['画像', '描き込', '編集', '認められません'],
    ], 'template');
  });
});
