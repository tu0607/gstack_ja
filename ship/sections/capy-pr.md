<!-- AUTO-GENERATED from capy-pr.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 19-C: Capy の PR 本文(何が変わったか、理由、承認)

Step 19 が `CAPY_PR: on` を出力した場合にのみ読みます。Capy では、人が Captain を通じて、PR と READY のレポートからマージを判断します。そのため本文は、何が変わったかを画像で示し、理由と、誰が何を承認したかを示します。ガイドは Capy の `gstack` スキルの SKILL.md と同じ場所にある `captain.md` です。

**順序。** Step 19 が `gstack-ship-receipt` のブロックを書く場合は、それを最初に置きます。その後に `## What changed`、`## Why`、`## Approvals` を続け、そのあとに下の標準のセクションを置きます。`## Summary` はコミットのテーマだけにとどめ、キャプションを繰り返さないでください。

1. **証拠を選ぶ:** 変更前後のペアを 1〜3 組、シグナルの強いものから順に選びます。最初のものが主要な画像です。
   - UI の変更: 変更された画面を、ベースとこのブランチの両方で、browse のフローまたはホストのブラウザを使い、同じサイズでスクリーンショットを撮ります。
   - スキルまたはプロンプトの変更: `~/.claude/skills/gstack/bin/gstack-pr-shots --path <template or SKILL.md> --heading "<changed section>" --caption "<what changed and why>"`。
   - CLI の変更: この Ship がすでに実行しているコマンドの出力を、ベースとこのブランチの両方で、リポジトリ内のファイル(`.gstack/tmp/before.txt`、`.gstack/tmp/after.txt`)に保存します。その後、`~/.claude/skills/gstack/bin/gstack-pr-shots --before <file> --after <file> --kind terminal --caption "<…>"` を実行します。
     画像を作るためだけに、副作用のあるコマンドを実行しないでください。
   - 目に見える表示面がない場合: 変更を最もよく示すソースのセクションまたはテスト出力を画像にします。
   `gstack-pr-shots` は、シークレットスキャナに一致する入力を拒否します(`PR_SHOTS_INPUT_REFUSED`)。キャプチャからシークレットを取り除いてください。拒否を回避しようとしないでください。
2. **`SHOT_PNG:` を読む。** パスの場合: それを使います。`unavailable (…)` の場合: 出力された `shot.html` を、自分のブラウザで幅 880 px としてスクリーンショットを撮り、その PNG を使います。`failed (…)` の場合: テキスト版だけを使います。
3. **アップロード。** 公開リポジトリの場合に限ります(`gh repo view --json visibility -q .visibility` が `PUBLIC` を出力する場合)。非公開リポジトリは、本人が画像を承認している場合を除き、テキスト版にします(その記録は `gstack-approvals add` で行います)。各 PNG を Capy の PR アセットツール(`tools.pr.uploadAsset`)でアップロードします。返された URL をそのまま埋め込み、キャプションを代替テキストにします: `![<caption>](<url>)`(返されたビデオの裸の URL は、独立した行に置きます)。アップロードが失敗した場合は、一時的なエラーの場合に限り、一度だけ再試行します。それ以外の場合は、テキスト版を使い、キャプションの下に `image upload failed: <reason>` と書きます。画像を理由に公開をブロックしないでください。
4. **画像の下すべて:** 何が変わったか、なぜかを 1 行のキャプションで書き、その後に出力された `text.md` の内容を置きます(画像を見られない読み手や検索のための、折りたたまれたテキストの前後比較です)。
5. **`## Why`:** 原因(Issue、失敗した実行、または本人の依頼を引用したもの)と、ユーザーが見る効果を、2〜3 文で書きます。
6. **`## Approvals`:** `~/.claude/skills/gstack/bin/gstack-approvals render` の出力を、そのまま書きます。このコマンドはセルをエスケープし、レシートがそれを承認の引用として読むことは決してありません。`APPROVAL_RECORD_UNAVAILABLE` の場合は、その文章を残し、READY のレポートでそのことを伝えます。行は決して手で入力しないでください。
7. **READY のレポート:** 主要な画像の PNG を、送信するレポートに添付し(Capy のメッセージの添付)、そのアップロードした URL を示します。Captain がインラインで表示できるようにするためです。
