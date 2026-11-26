# 設計: /review と /ship への slop-scan 統合

ステータス: 延期
作成日: 2026-04-09
依存: slop-diff スクリプト(scripts/slop-diff.ts、マージ済み)

## 課題

slop-scan の指摘は、`bun run slop:diff` を手動で実行しないと見えない。SQL の安全性チェックや信頼境界のチェックと同じように、レビューと出荷の過程で自動的に表示されるべきである。

## 統合ポイント

### /review(Step 4、チェックリストの確認の後)

チェックリストによる重大/情報の確認の後に `bun run slop:diff` を実行する。新しい指摘は、他のレビュー出力と並べてインラインで表示する。

```
Pre-Landing Review: 3 issues (1 critical, 2 informational)

AI Slop: +2 new findings, -0 removed
  browse/src/new-feature.ts
    defensive.empty-catch: 2 locations
      line 42: empty catch, boundary=filesystem
      line 87: empty catch, boundary=process
```

分類: INFORMATIONAL(マージを止めることはなく、パターンを示すだけ)。

Fix-First のヒューリスティック: 指摘が、ファイル操作を囲む空の catch なら、`safeUnlink()` で自動修正する。拡張機能のコードで catch してログを出しているだけなら、スキップする(CLAUDE.md のガイドラインでは、それが正しいパターン)。

### /ship(Step 3.5、事前のレビューと PR 本文)

/review と同じ統合を行う。加えて、PR 本文に 1 行の要約を表示する。

```markdown
## Pre-Landing Review
- 2 issues auto-fixed, 0 needs input
- AI Slop: +0 new / -3 removed ✓
```

### レビュー準備状況ダッシュボード

行は**追加しない**。Slop は差分に対する診断であり、独立して「実行される」レビューではない。Eng Review の出力の中に表示され、ダッシュボードに独立した項目としては現れない。

## 自動修正するものとスキップするもの

CLAUDE.md の "Slop-scan" の節に従う。要約は次のとおり。

**自動修正(本当の品質改善):**
- `fs.unlinkSync` を囲む空の catch → `safeUnlink()` に置き換える
- `process.kill` を囲む空の catch → `safeKill()` に置き換える
- 囲む try がない `return await` → `await` を削除する
- URL パースを囲む型のない catch → `instanceof TypeError` のチェックを追加する

**スキップ(slop-scan が指摘するが、正しいパターン):**
- 発火して忘れる(fire-and-forget)ブラウザ操作(page.close、bringToFront)に対する `.catch(() => {})`
- Chrome 拡張機能のコードでの catch とログ出力(捕捉されない例外は拡張機能をクラッシュさせる)
- シャットダウンや緊急時の経路での `safeUnlinkQuiet`(あらゆるエラーを握りつぶすのが正しい)
- アクティブなセッションに処理を委譲するだけのパススルーのラッパー(API の安定性のための層)

## 実装メモ

- `scripts/slop-diff.ts` が、重い処理(ワークツリーによるベースとの比較、行番号に依存しないフィンガープリント、フォールバック)をすでに担っている
- /review と /ship のスキルは bash ブロックを実行する。統合の内容は、スクリプトを実行し、出力を解析して、レビューの指摘に含めることである
- slop-scan がインストールされていない場合(`npx slop-scan` が失敗する場合)は、黙ってスキップする
- スクリプトは常に終了コード 0 で終わる(診断であり、ゲートにはしない)

## 工数の見積もり

| 作業 | 人間 | CC+gstack |
|------|-------|-----------|
| review/SKILL.md.tmpl への追加 | 2 時間 | 10 分 |
| ship/SKILL.md.tmpl への追加 | 2 時間 | 10 分 |
| review/checklist.md への追加 | 1 時間 | 5 分 |
| 実際の PR でのテスト | 2 時間 | 15 分 |
| SKILL.md ファイルの再生成 | — | 1 分 |
