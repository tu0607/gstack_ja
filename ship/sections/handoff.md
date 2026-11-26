<!-- AUTO-GENERATED from handoff.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 18-H: PR を作成しない引き継ぎ(自動化レーン)

実行で PR を開いてはならない場合(`--no-pr`、自動化レーン、または無人の親がそう指示した場合)は、pr-body のセクションの代わりにこちらを使います。ここでは何も公開しません。

1. 検証のみのチェック: Step 16 のレーンごとの pass/fail/skip の件数を、`requires-remote` のレーンを明記して、pr-body のセクションと同様に `.gstack/tmp/ship-gate.json` に書きます。その後(Issue リンクのフラグを付けて。質問はしないこと):
   ```bash
   ~/.claude/skills/gstack/bin/gstack-issue-links --base <base> --out .gstack/tmp/issues.json
   ~/.claude/skills/gstack/bin/gstack-ship-receipt write --base <base> --gate @.gstack/tmp/ship-gate.json --issues @.gstack/tmp/issues.json
   ```
2. 完了メッセージを、識別子を先頭にして、次の順序で送ります: `SHIP_RECEIPT:` の行とレシートのブロック(`pr: none`)。`branch:` と `sha:`(`git rev-parse HEAD`)、push 済みか `not pushed` か。`inputs:` 計画または Issue、ベースの SHA、支出の上限。`before/after:` 主張するメトリクスごとに 1 行で、ベースと、この SHA の両方で、使ったコマンドとともに測定した結果。`escalation:` マージを止める条件(`requires-remote` のレーン、open のゲート指摘、未検証の主張)の 1 つ、または `none`。`issues:` その行、未昇格の候補、検索の失敗。
   完全なスレッド ID(`jam_…`)はスレッドをまたいで伝えます。識別子より前には何も置かないでください。
3. Step 19 と Step 21 はスキップします。NO_VERSION が適用された場合は、`"version":null` を付けて Step 20 を実行します。

### 複数レーンの実行

レーンは、各ステップの後に WIP コミットを push し、push された SHA をゲートにします。
