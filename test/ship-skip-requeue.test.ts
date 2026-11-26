import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { ALL_HOST_CONFIGS } from '../hosts';
import { generateAdversarialStep } from '../scripts/resolvers/outside-voice-steps';
import { generateCrossReviewDedup, generateSharedCodeReuse } from '../scripts/resolvers/review-scope';
import { HOST_PATHS } from '../scripts/resolvers/types';
import { expectMentions, expectOrdered } from './helpers/prompt-structure';

const compact = (text: string) => text.replace(/\s+/g, ' ');
const review = compact(readFileSync(new URL('../ship/sections/review-army.md.tmpl', import.meta.url), 'utf8'));

describe.each(ALL_HOST_CONFIGS.map(({ name }) => name))('%s ship skip/requeue contract', host => {
  const ctx = { host, skillName: 'ship', tmplPath: '', paths: HOST_PATHS[host] };
  const dedup = compact(generateCrossReviewDedup(ctx));
  const adversarial = compact(generateAdversarialStep(ctx));
  const finish = adversarial.slice(adversarial.indexOf('### 敵対的フェーズを終える'));

  test('unchanged explicit skips are matched before the actionable queue drives a repeat', () => {
    const match = finish.indexOf('Step 9.3 の照合手順を適用します');
    expect(match).toBeGreaterThan(-1);
    expect(match).toBeLessThan(finish.indexOf('2. **ネイティブの完了後に修正がキューに積まれている'));
    expectMentions(finish, [['未照合または再オープンされた所見だけが', 'キューに残ります']], 'finish');
    expectMentions(dedup, [['明示的な', '`skipped` アクションだけ']], 'dedup');
    expectMentions(dedup, [['無関係な編集では開きません']], 'dedup');
    expectOrdered(dedup, ['1. **重大度を検証します。**', '2. **判断を読みます。**',
      '3. **証拠を照合します。**', '4. **shared-code を構造的に照合します。**', '5. **処理を適用します。**'], 'dedup steps');
    expectMentions(review, [['照合されなかった、または再オープンされた指摘事項のみを', 'AUTO-FIX', 'ASK']], 'review');
  });

  test('dedup and persistence include queued sources and preserve the explicit decision', () => {
    expectMentions(review, [['`advisory`', '`evidence_paths`', '`helper_target`', '保持します']], 'review');
  });

  test('working-tree changes and new evidence reopen matching identities', () => {
    expect(dedup).toContain('git diff --name-only <prior-review-commit>');
    expect(dedup).not.toContain('git diff --name-only <prior-review-commit> HEAD');
    expectMentions(dedup, [['後からのユーザーの判断を尊重します']], 'dedup');
    expectMentions(dedup, [['証明ではなく', '候補の絞り込み']], 'dedup');
  });

  test('fixed regressions and missing Skip proof are not suppressed', () => {
    expectMentions(dedup, [['`fixed`', '`auto-fixed`', '未回答の質問は対象外です']], 'dedup');
    expectMentions(dedup, [['証明がない、または比較結果が不明な場合は', '抑制ではなく新たな判断が必要です']], 'dedup');
    expectMentions(finish, [['スコープを限定した承認は保持します']], 'finish');
    expectMentions(finish, [['9.3 に直接ジャンプしたり', 'REVIEW_START', '作成したりしてはいけません']], 'finish');
  });

  test('shared-code and advisory collisions retain stricter identity checks', () => {
    expectMentions(dedup, [
      ['欠陥を抑制することはできません'],
      ['`advisory` を外し', '重大度は決して下げません'],
      ['矛盾する保存済みの判断は拒否します'],
      ['メタデータがない場合に', '通常の行照合を使ってはいけません'],
      ['以前のレビューの再利用には', 'チェッカーが必要です'],
      ['代替することはできません'],
    ], 'dedup');
    const checker = compact(generateSharedCodeReuse(ctx));
    expectMentions(checker, [['抑制が許されるのは', '`reusable: true`'], ['独自のスナップショット', '過去の記録', 'カバレッジを渡してはいけません']], 'checker');
  });

  test('skipped defects stay unresolved and required failures stay failed', () => {
    expectMentions(dedup, [['未解決の欠陥は抑制しません'], ['必須プローブの失敗は失敗のままにします']], 'dedup');
    expectMentions(review, [
      ['修正をスキップすることは', 'リスクの受け入れや合格したプローブとは見なしません'],
      ['失敗または利用不可の必要なプローブは継続をブロックします'],
      ['VERIFY_RESULT は fail のままです'],
    ], 'review');
    expectMentions(adversarial, [['承認済みの所見と失敗したゲートを保持し', 'クリーンなレビューとして報告してはいけません']], 'adversarial');
  });

  test('fresh review after edits, native coverage and cycle limits remain required', () => {
    expect(finish).toContain('**必須のネイティブレビューが未完了:** STOP');
    expectMentions(finish, [['保留中の Step 11.5 の前に', 'Step 9、10、11 を挿入します']], 'finish');
    expectMentions(finish, [['3 サイクルという修正の上限はリセットされません']], 'finish');
    expectMentions(review, [['CYCLES は初回の入場時のみ 0 に設定します'], ['修正が適用された場合は CYCLES を 1 増やします'], ['4 回目の修正サイクルは実行しないでください']], 'review');
    expectMentions(finish, [['リリース準備に直接ジャンプしてはいけません']], 'finish');
  });
});
