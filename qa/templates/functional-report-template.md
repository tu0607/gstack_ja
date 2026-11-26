# 機能 QA レポート: {TARGET}

| 項目 | 値 |
|---|---|
| 日付 / ブランチ / リビジョン | {DATE / BRANCH / COMMIT AND WORKING-TREE INPUTS} |
| 呼び出し元 / 権限 / 深さ | {qa-only, qa, review or ship; permitted writes; bound} |
| サーフェス / スコープ | {API, CLI, job, worker, webhook; changed and adjacent contracts} |
| ランタイム / ネイティブツール | {VERSIONS AND REPOSITORY-SUPPORTED COMMANDS} |
| フィクスチャの所有 / 送信先 | {ISOLATED ROOT, STORES, DOWNSTREAM TARGETS} |
| プローブの予算 / コマンドの実行時間 / 停止理由 | {CONFIGURED LIMIT / SUM OF CAPTURE durationMs / COMPLETE OR BOUND/BLOCKER} |

## 契約の結果

| 契約と情報源 | 正確なプローブ / 証拠 | 期待 → 観察 | 結果 |
|---|---|---|---|
| {契約、ドキュメント/テスト/ユーザーのソース} | {コマンドまたはリクエスト、証拠のパス} | {出力と永続的な効果} | pass / fail / blocked / not run / inconclusive / not applicable (reason) |

この機能のセクションには、視覚的なスコアは適用されません。混在するレポートでは、ブラウザのセクションのスコアと証拠を別々に保ち、両方のサーフェスのリプレイの証拠とリグレッションのベースラインをリンクしてください。スコアや結果を合算しないこと。

## 所見

### ISSUE-NNN: {再現した不具合またはセットアップの阻害要因}

- 分類 / 重大度: {PRODUCT DEFECT / SETUP / INCONCLUSIVE; IMPACT}。
- 意図された契約と情報源: {EXPECTED BEHAVIOR, NOT MERELY CURRENT IMPLEMENTATION}。
- 再現: {WORKING DIRECTORY; SAFE SETUP/RESET; ENVIRONMENT NAMES ONLY; EXACT COMMAND OR METHOD/PATH/HEADERS/BODY USING SYNTHETIC VALUES}。
- 観察: {EXIT/STATUS; STDOUT; STDERR; INITIAL/FINAL DURABLE STATE; REPLAY/RETRY ORDER}。
- 証拠: {EXACT SAFE OUTPUT AND STATE PATHS; REVISION/RUNTIME; REDACTION AND REPRODUCIBILITY LIMITS}。
- 診断 / 次の対応: {CAUSAL EVIDENCE OR SPECIFIC PREREQUISITE; NO SPECULATIVE FIX}。

## 発見事項と恒久的なテスト

各 `exploration-NNN.json` のチェックポイントを、次のプローブの前に保存し、このレポートにリンクしてください。
各チェックポイントの受領書は、その `link` を表示します。`.qa-evidence/NNN` のキャプチャのフォルダは、チェックポイントではありません。
チェックポイントごとに Markdown の項目を一つ書きます。例:

- [checkpoint 001](exploration-001.json) — この観察が次のプローブをどう形作ったか。

実際のファイル名を使い、このレポートからの相対パス(または所有する絶対パス)でリンクしてください。プレーンテキストや、バッククォートで囲んだファイル名はリンクになりません。
置き換えられたチェックポイントも、現在の合格の証拠ではなく履歴として含めてください。
元の注記は、このレポートと一緒に保持します。

| 仮説 / 発見事項 | ネイティブのテストまたは提案されたケース | 修正の前の赤い証拠 | 緑 + 元の + 隣接の証拠 | 親の処理 |
|---|---|---|---|---|
| {次の検証を変えた観察} | {ユニット / 統合 / E2E; パスまたは報告のみの提案} | {EXACT DEFECT FAILURE OR HEALTHY CONTRACT} | {ACTUAL RESULTS OR NOT RUN} | {AUTHORIZED CHANGE / SUGGESTION / DEFERRED} |

## カバレッジの制限とクリーンアップ

実行されなかったチャーター、利用できない前提条件、拒否された効果、あいまいな契約、不完全な観察、残っているリスクを列挙します。それらを合格として数えてはいけません。
所有するプロセスや状態のうち、クリーンアップしたものを挙げ、残ったものも示します。その後の変更で証拠が無効になったかどうかを述べてください。レポートのみの場合は、提案と、実際に作成されたテストを分けて示します。
