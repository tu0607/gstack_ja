import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { generatePlanCompletionGateShip } from '../scripts/resolvers/plan-gates';
import { generateTestBootstrap } from '../scripts/resolvers/testing';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { expectMentions } from './helpers/prompt-structure';

const read = (file: string) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const compact = (text: string) => text.replace(/\s+/g, ' ');
const ctx = { host: 'claude' as const, skillName: 'ship', tmplPath: '', paths: HOST_PATHS.claude };

test('ship stop lines block advancement while retaining the stated repair route', () => {
  const entry = compact(read('ship/SKILL.md.tmpl'));
  expectMentions(entry, [['STOP', '修復/再開ルート', '進行を止めます']], 'entry');
  expectMentions(entry, [['AskUserQuestion', '回答してから先に進んでください']], 'entry');
  expectMentions(entry, [['通常の承認', 'ゲート', '免除されません']], 'entry');
  const review = compact(read('ship/sections/review-army.md.tmpl'));
  expect(review).toMatch(/\*\*ディスパッチしたレビュアーの出力が欠けている:\*\* 停止し/);
  expect(review).toMatch(/\*\*3 回目の修正サイクルに到達 \(`CYCLES >= 3`\):\*\* 停止し/);
});

test('a new ship bootstrap choice overrides only the saved decline, not framework selection', () => {
  const ship = generateTestBootstrap(ctx);
  const decline = ship.slice(ship.indexOf('**BOOTSTRAP_DECLINED** が表示された場合'), ship.indexOf('**どのエコシステムのマーカーも一致しなかった場合:**'));
  expect(decline.length).toBeGreaterThan(0);
  expectMentions(compact(decline), [['Add tests', 'この呼び出しに限り', '優先されます']], 'compact(decline)');
  expectMentions(compact(decline), [['フレームワークの承認を含め']], 'compact(decline)');
  expect(decline).not.toContain('rm ');
  expect(ship.indexOf('**既存のテストの証拠が 1 つでもある場合**')).toBeLessThan(ship.indexOf('**BOOTSTRAP_DECLINED** が表示された場合'));
  const qa = generateTestBootstrap({ ...ctx, skillName: 'qa' });
  expect(compact(qa)).toMatch(/BOOTSTRAP_DECLINED[^\n]{0,160}ブートストラップの残りはスキップします/);
  expect(qa).not.toContain('Step 5 で明示的に選ばれた Add tests');
});

test('an unverified item answered not done enters the existing decision before continuing', () => {
  const gate = generatePlanCompletionGateShip(ctx);
  const exits = compact(gate.slice(gate.indexOf('**終了条件:**'), gate.indexOf('**上限。**')));
  expect(exits.length).toBeGreaterThan(0);
  expectMentions(exits, [['N が 1 つでもある場合', '停止し', 'NOT DONE']], 'exits');
  expectMentions(exits, [['必要な作業が検証されてからでなければ再開しません']], 'exits');
  expectMentions(exits, [['2 回目の先送りの選択肢はありません']], 'exits');
  expect(exits).not.toContain('re-running /ship');
  expect(gate).toContain('項目ごとの確認は必須です');
});

test('docs reentry distinguishes the initial audit from same-invocation accepted evidence', () => {
  const docs = compact(read('ship/sections/documentation.md.tmpl'));
  const entry = docs.slice(0, docs.indexOf('## 候補を準備する'));
  expect(entry.length).toBeGreaterThan(0);
  expectMentions(entry, [['再入場', 'リセットされること', '許可されること']], 'entry');
  expectMentions(docs, [['3 回目の試行は決して行いません']], 'docs');
  expectMentions(docs, [['監査を実行をまたいで再利用することは決してしないでください']], 'docs');
  expectMentions(docs, [['redaction/セキュリティのゲート', '免除できません', '許可されていない']], 'docs');
});

test('late behavioral repairs rebuild before the docs decision and commit only remaining changes', () => {
  const entry = compact(read('ship/SKILL.md.tmpl'));
  expectMentions(entry, [['Step 14 で終わる範囲', 'Step 14.5', '入りません']], 'entry');
  expectMentions(entry, [['再ビルドして再比較し', '段階 3', 'ドキュメントの鮮度']], 'entry');
  const commit = entry.slice(entry.indexOf('### 5. 報告してから push する'), entry.indexOf('## Step 17:'));
  expect(commit.length).toBeGreaterThan(0);
  expectMentions(commit, [['空のコミットは決して作らないでください']], 'commit');
  expectMentions(commit, [['無関係なユーザーのファイルは保持します']], 'commit');
});

test('the title is prefixed once in Step 18 and posted from its file unchanged', () => {
  const body = compact(read('ship/sections/pr-body.md.tmpl'));
  expectMentions(body, [['Step 18 のタイトルファイル名に置き換えてください']], 'body');
  expect(body).not.toContain('prefixed with');
  expect(body).toContain('--title-file "$TITLE_FILE"');
  expectMentions(body, [['再試行のたびに同じファイルを送ります']], 'body');
});
