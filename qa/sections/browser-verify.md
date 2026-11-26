<!-- AUTO-GENERATED from browser-verify.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
# ブラウザ修正の検証

ブラウザの不具合に限ってこのセクションを使います。元の操作と隣接する正常系の操作を再実行してください。Phase 5 の証拠は修正前のもの(操作系の不具合なら `issue-NNN-result.jpg`、静的な不具合なら注釈付きの `issue-NNN.png`)です。修正後の証拠は今この時点で取得してください。

interaction の不具合では qa-patterns の Phase 3 にある read/flow スクリプトを `flow = true` で使います。操作と待機は元の再現手順に合わせて設定してください。静的な不具合では `flow = false` を使います。エラーフック、スナップショット、コンソール出力、`GSTACK_STEP_OK` の確認は維持してください。各フローは影響のある URL から単一のスクリプトで実行します。タブはスクリプトをまたいで保持されません。

修正後のスクリーンショット名は新規のものを使い、結果は `issue-NNN-after.jpg` とします(同名が既に存在する場合はサフィックスを付けてください)。表示された `ASIDE_DIR` から `$REPORT_DIR/screenshots/` にコピーし、コピーしたスクリーンショットを Read で確認します。スナップショットツリー、`DIFF`、`CONSOLE_ERRORS=` を修正前の証拠と比較してください。

フォールバック時は、同じチェックに browser-setup の `$B` へのマッピングを適用してください。
機能面の修正では、このセクションは読み込まないでください。
