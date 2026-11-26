import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ALL_HOST_CONFIGS } from '../hosts';
import { RESOLVERS } from '../scripts/resolvers';
import { HOST_PATHS, type TemplateContext } from '../scripts/resolvers/types';
import { expectMentions } from './helpers/prompt-structure';

const root = join(import.meta.dir, '..');
const compact = (text: string) => text.replace(/\s+/g, ' ');

function render(file: string, ctx: TemplateContext): string {
  let text = readFileSync(join(root, file), 'utf8');
  for (let pass = 0; pass < 10; pass++) {
    const next = text.replace(/\{\{([A-Z_]+)(?::([^}]+))?\}\}/g, (_match, name, args) => {
      if (!RESOLVERS[name]) throw new Error(`Unknown resolver ${name}`);
      return RESOLVERS[name](ctx, args?.split(':'));
    });
    if (next === text) return compact(text);
    text = next;
  }
  throw new Error(`Unresolved template ${file}`);
}

function ordered(text: string, markers: string[]): void {
  let previous = -1;
  for (const marker of markers) {
    const index = text.indexOf(marker);
    expect(index, marker).toBeGreaterThan(previous);
    previous = index;
  }
}

describe('review and ship completion freshness contracts', () => {
  for (const host of ALL_HOST_CONFIGS) {
    for (const skillName of ['review', 'ship']) {
      const ctx: TemplateContext = { host: host.name, skillName, tmplPath: '', paths: HOST_PATHS[host.name] };
      const body = compact(RESOLVERS.QA_REVIEW(ctx));
      const shared = compact(RESOLVERS.QA_EXPLORATORY({ ...ctx, skillName: 'qa' }));
      const gate = body.slice(body.indexOf('**4. 報告の前に鮮度を確認します。**'), body.indexOf('検証済みの欠陥は Fix-First に返します'));

      test(`${host.name}/${skillName}: dependent probes await prerequisites without serializing independent Reads`, () => {
        expect(shared).toContain('チャーターの作成やプローブの前に、次の Read を順番に完了します');
        expect(shared).toContain('チェックポイントの公開が成功するのを待ちます');
        expect(body).toContain('クロック/ガードの結果を待ちます');
        expect(body).toContain('独立した Read だけをまとめます');
        expectMentions(shared, [['アセット', '許可', '欠けている', 'プローブをブロック'], ['独立した安全なチェックはブロックしません']], 'shared');
        ordered(body, ['独立した Read だけをまとめます', '**1.', '**3. スモークとプランのチェックを実行します']);
      });

      test(`${host.name}/${skillName}: normal and skipped paths resolve freshness before completion`, () => {
        expect(gate).toContain('完了の報告やログの前には毎回');
        expect(gate).toContain('修正がゼロでも、専門家をスキップしても');
        ordered(gate, ['a. エージェント/ユーザーからの更新を読み', '報告/ログとまとめずに、その結果を待ちます',
          'b. 更新がなくても、各プローブが記録した', 'c. 変更された、または不確かなカバレッジを再レビュー', 'd. 再検証や編集/更新の後に、もう一度比較します',
          'clean/completed と報告できるのは、必須のチェックがすべて現在の入力で pass した場合だけです']);
        expect(gate).toContain('更新がなくても');
      });

      test(`${host.name}/${skillName}: late changes preserve current per-probe evidence`, () => {
        expectMentions(gate, [['記録したソース', 'フィクスチャ', 'フィンガープリント', '現在の入力', '比較']], 'gate');
        expect(gate).toContain('有効で現在の pass は再実行しません');
        expect(gate).toContain('影響を受けるチェックについてステップ 3 を繰り返します');
        expect(gate).toContain('d. 再検証や編集/更新の後に、もう一度比較します');
      });

      test(`${host.name}/${skillName}: required revalidation uses real limits rather than the optional-work reserve`, () => {
        expect(gate).toContain('影響を受けるチェックについてステップ 3 を繰り返します');
        expect(shared).toContain('影響を受ける再検証ごとにステップ 2 に戻ります');
        expect(shared).toContain('limits/メモは保持します。ステータスには新しい証拠が必要です');
        expectMentions(gate, [['報告のための余裕', '呼び出し元の期限内', '必須の再検証', '止めてはいけません']], 'gate');
        expect(body).toContain('クロック/ガードの結果を待ちます');
        expect(body).toContain('Smoke: 5 分/12 プローブ');
        expect(body).toContain('スモークが期限切れになっても、必須のプランのチェックと再検証を');
        expect(body).toContain('スモークガードなしで実行します。クロックはリセットしません');
        expect(body).toContain('有限のコマンドタイムアウトを使い、呼び出し元に期限がある場合は、その残り時間を上限とします');
      });

      test(`${host.name}/${skillName}: unavailable freshness or insufficient time cannot certify completion`, () => {
        expectMentions(gate, [['Read の失敗', '時間不足', '必須のチェックをブロック']], 'gate');
        expect(gate).toContain('failed、blocked、inconclusive、not-run のチェックを列挙します');
        expect(gate).toContain('clean/completed と報告できるのは、必須のチェックがすべて現在の入力で pass した場合だけです。任意の未テストのアイデアはそれを妨げません');
        expect(body).toContain('レポート専用の探索を実行するのは親だけです');
        expect(body).toContain('テストの作成にはユーザーの承認が必要です');
        expect(body).toContain('セットアップ/許可のブロッカーは欠陥ではありません');
        if (skillName === 'review') expectMentions(body, [['未解決のカバレッジ', 'Step 5.8', '未完了', 'ship', 'ウェイバー']], 'body');
        else expectMentions(body, [['名指し', 'リスク', '明示的な受け入れ'], ['そうでなければブロックです']], 'body');
      });
    }

    test(`${host.name}/ship: finalization consumes the freshness result before summaries and persistence`, () => {
      const ctx: TemplateContext = { host: host.name, skillName: 'ship', tmplPath: '', paths: HOST_PATHS[host.name] };
      const body = render('ship/sections/review-army.md.tmpl', ctx);
      const finalization = body.slice(body.indexOf('4. **次のステップを選ぶ前に、この pass を完了し'), body.indexOf('5. 概要を出力します'));
      expect(finalization).toContain('項目 5–6 の前に、鮮度を再確認します (Step 9.2.1)');
      expect(body).toContain('修正がゼロでも、専門家をスキップしても');
      expect(body).toContain('clean/completed と報告できるのは、必須のチェックがすべて現在の入力で pass した場合だけです');
      ordered(body, ['項目 5–6 の前に、鮮度を再確認します (Step 9.2.1)', '5. 概要を出力します', '6. レビュー結果をレビューログに永続化します']);
      expect(body).toContain('項目 5–6 は、元の REVIEW_START を使って正確に 1 回ずつ完了します');
      expect(body).toContain('`status:"unavailable"`、`completed:false`、`converged:false` を使います');
      expectMentions(body, [['失敗', 'ブロック', '判定不能', '未実行', '必要なプローブ', 'false', 'clean にはしません']], 'body');
      expectMentions(body, [['ディスパッチされていない', '未サポート', 'ゲート', 'specialist', 'ブロックしません']], 'body');
    });
  }
});
