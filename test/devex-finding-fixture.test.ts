import { expect, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runGeneration } from '../scripts/gen-skill-docs';
import { ALL_HOST_NAMES, getHostConfig } from '../hosts';
import { expectAbsent, expectMentions, expectTokens } from './helpers/prompt-structure';

test('every host exposes the DX per-call rule before the pre-review audit and Step 0', async () => {
  const outputRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'devex-rule-free-'));
  try {
    const generated = await runGeneration({ host: 'all', outputRoot });
    expect(generated.exitCode).toBe(0);
    const skills = generated.artifacts.filter(artifact => artifact.kind === 'skill'
      && /(?:^|\/)gstack-plan-devex-review\/SKILL\.md$|^plan-devex-review\/SKILL\.md$/.test(artifact.relativePath));
    expect(skills.map(artifact => artifact.host).sort()).toEqual([...ALL_HOST_NAMES].sort());
    for (const artifact of skills) {
      const content = fs.readFileSync(path.join(outputRoot, artifact.relativePath), 'utf8');
      const audit = content.indexOf('## プリレビューのシステム監査');
      expect(audit).toBeGreaterThan(0);
      const preReview = content.slice(audit, content.indexOf('## 製品の種類の自動検出と適用性のゲート', audit));
      expect(preReview).toContain('origin/<detected-base-branch>...HEAD');
      expect(preReview).not.toContain('git merge-base HEAD main');
      expectMentions(preReview, [['ブランチ', '調査', '延期']], 'pre-review audit');
      const productGate = content.slice(content.indexOf('## 製品の種類の自動検出と適用性のゲート', audit),
        content.indexOf('## ステップ0: DXの調査', audit));
      expectMentions(productGate, [['ブランチ', '製品の種類', '確認']], 'product type gate');
      const brain = content.indexOf('## Brain Context (preflight)', audit);
      const productType = content.indexOf('## 製品の種類の自動検出と適用性のゲート', audit);
      const persona = content.indexOf('### 0A. 開発者ペルソナの掘り下げ', productType);
      const personaStop = content.indexOf('**STOP.**', persona);
      const prerequisite = content.indexOf('## 前提スキルの提案', persona);
      expect(brain).toBeGreaterThan(audit);
      expect(brain).toBeLessThan(productType);
      expect(prerequisite).toBeGreaterThan(personaStop);
      expect(prerequisite).toBeLessThan(content.indexOf('### 0B. 会話の糸口としての共感のナラティブ', persona));
      const beforeAudit = content.slice(0, audit);
      expectMentions(beforeAudit, [['ステップ0', '外部の視点'], ['AskUserQuestion', '独立した選択', '1つ']], 'decision gate preface');
      // Claude loads the review section later; these evidence limits must also
      // govern Step 0's first journey questions on every host.
      const earlyEvidence = beforeAudit.replace(/\s+/g, ' ');
      expectMentions(earlyEvidence, [
        ['レポーター', '説明', '正確な言葉'],
        ['共感のナラティブ', '確認', '実行時の観察'],
        ['選ばれた選択肢', '回答の参照', '承認された範囲'],
        ['ユーザーの作業の境界', 'モード', '承認された例外'],
        ['モードのデフォルト', '例外', '取り消'],
      ], 'early evidence limits');
      const classification = earlyEvidence.slice(earlyEvidence.indexOf('2. **指摘を分類する。**'),
        earlyEvidence.indexOf('3. **スコープを確認する。**'));
      expectMentions(classification, [
        ['ソースの検証', '事実の訂正', 'レビューの作業'],
        ['検証されていない', '不明のまま'],
        ['新しい提示の方法', '保証', 'チャネル', 'スコープの拡張', '判断として残'],
      ], 'finding classification');
      const rating = content.slice(content.indexOf('## 0〜10の採点の方法'));
      expectTokens(rating, ['4. 各ギャップについて判断ゲートを実行する']);
      expectAbsent(rating, ['AskUserQuestion で解決']);
      const journey = content.slice(content.indexOf('### 0F.'), content.indexOf('### 0G.'));
      const wholeGate = journey.indexOf('判断ゲートの4つのステップをすべて実行する');
      expect(wholeGate).toBeGreaterThanOrEqual(0);
      expect(wholeGate).toBeLessThan(journey.indexOf('> 「ジャーニーの段階: インストール'));
      expectAbsent(journey, ['AskUserQuestion per friction point']);
      const mode = content.slice(content.indexOf('### 0E. モードの選択'), content.indexOf('Context-dependent defaults:'));
      expectMentions(mode, [['明示的に要求したモード'], ['モードの質問', '省略', '0F']], 'mode selection');
      const sectionText = generated.artifacts.filter(item => item.kind === 'section'
        && item.host === artifact.host && item.relativePath.startsWith('plan-devex-review/'))
        .map(item => fs.readFileSync(path.join(outputRoot, item.relativePath), 'utf8')).join('\n');
      const allContent = content + '\n' + sectionText;
      expectMentions(allContent, [
        ['人間のオンボーディング', '自動実行', '別に記録'],
        ['温まったスニペットのタイマー', '人間のベンチマーク'],
        ['見積もり', 'ラベル', '測定されるまで'],
      ], 'review rules');
      const gate = beforeAudit.indexOf('### 判断ゲート');
      const ground = beforeAudit.indexOf('1. **根拠を確認する。**', gate);
      const classify = beforeAudit.indexOf('2. **指摘を分類する。**', gate);
      const scope = beforeAudit.indexOf('3. **スコープを確認する。**', gate);
      const options = beforeAudit.indexOf('4. **一つの判断を作り、回答を得る。**', gate);
      expect([gate, ground, classify, scope, options].every((offset, i, offsets) =>
        offset >= 0 && (i === 0 || offset > offsets[i - 1]!))).toBe(true);
      const askHeading = allContent.search(/^## .*質問の仕方$/m);
      expect(askHeading).toBeGreaterThanOrEqual(0);
      const localRule = allContent.slice(askHeading, allContent.indexOf('## 必須の出力', askHeading));
      expectMentions(localRule, [['判断ゲート', '選択肢を作る前']], 'ask rule');
      const benchmark = content.slice(content.indexOf('### 0C. 競合のDXベンチマーク'),
        content.indexOf('### 0D. マジカルモーメントの設計'));
      expect(benchmark.indexOf('時計を定義してください')).toBeGreaterThanOrEqual(0);
      expect(benchmark.indexOf('時計を定義してください')).toBeLessThan(benchmark.indexOf('AskUserQuestion:'));
      expectMentions(benchmark, [
        ['時間', '同等の境界', '比較'],
        ['競合の沈黙', '待ち時間がない', '推測しないで'],
        ['承認された時計', 'ターゲット', '0D', 'パス1', 'パス8', 'レポート'],
      ], 'benchmark clock');
      expectTokens(benchmark, ['開始 → 結果']);
      expectMentions(allContent, [
                ['ターゲットのティア', 'テレメトリ', '自動のリリースゲート', '承認するものではありません'],
        ['作業リスト', 'ステップ0', '引き継'],
        ['明確な矛盾', '変わった前提', '再度開く前'],
        ['境界', '名指し', 'スコープの承認'],
        ['実装の詳細', '選ばれた挙動の証明', '一緒'],
        ['独立したポリシー', '独自の判断'],
      ], 'review continuity');
      if (!getHostConfig(artifact.host!).suppressedResolvers.includes('CODEX_PLAN_REVIEW')) {
        const outside = allContent.slice(allContent.indexOf('## Outside Voice — 独立したプランへのチャレンジ'));
        const context = outside.indexOf('REVIEW CONTEXT (全体の作業リストより。切り詰めたプラン本文の外側にあるもの)');
        const planBody = outside.indexOf('THE PLAN:\n<plan content>');
        expect(context).toBeGreaterThan(0);
        expect(planBody).toBeGreaterThan(context);
        const reviewContext = outside.slice(context, planBody);
        expect(reviewContext).toContain('選ばれた選択肢、回答の参照と正確なスコープ');
        expectMentions(reviewContext, [
          ['明示的に承認された例外'],
          ['未実装', '検証', '依存関係'],
          ['具体的な新しい証拠', '前提の変化'],
        ], 'outside voice review context');
        expectMentions(outside, [['Decision gate', '日常的', '新しい選択']], 'outside voice gate');
      } else {
        expect(allContent).not.toContain('REVIEW CONTEXT (全体の作業リストより。切り詰めたプラン本文の外側にあるもの)');
      }

    }
  } finally { fs.rmSync(outputRoot, { recursive: true, force: true }); }
}, 20_000);
