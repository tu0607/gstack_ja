---
name: translate-upstream
description: upstream(garrytan/gstack)の差分を日本語版に取り込む。差分確認 → Haiku 並列で差分翻訳 → 再生成 → セルフレビュー(機械的チェック + 原文突き合わせ)→ 修正 → 予算・テスト調整 → 台帳更新。「upstream の差分を翻訳して」「翻訳を更新して」「差分翻訳」「translate upstream」で起動。
---

# /translate-upstream — upstream 差分の翻訳

このスキルは、このフォーク(gstack の日本語版)に upstream の変更を取り込む定型作業を一通り行う。詳細な背景は `docs/TRANSLATION.md`、ルールの定義元は `lib/translation-ledger.ts` と `translation/prompts/*.md`。

原則:
- 翻訳とレビューの単純作業は **Haiku のサブエージェント**(Agent ツール、`model: haiku`)に、同時実行 20 以内で並列に任せる。判断(機械が読むトークンの扱い、テストの書き換え方針、予算の引き上げ)は自分で行う。
- `git add` / `git commit` / `git stash` はしない(ユーザーが行う)。`git fetch` はユーザーの許可があるときだけ。
- 生成物(`*/SKILL.md`、`*/sections/*.md` など)は直接編集せず、`.tmpl` とリゾルバーを編集して `bun run gen:skill-docs --host all` で作り直す。
- 一時ファイルは `translation/pending/` 配下に置く(gitignore 済みではないので、終わったら `translation/pending/` を削除する)。

## Step 0: 前提確認

```bash
git log -1 --format='%h %s' upstream/main
git merge-base --is-ancestor upstream/main HEAD && echo MERGED || echo NOT_MERGED
git status --short | wc -l
```

- `upstream/main` が無い、または古い場合は、ユーザーに `git fetch upstream` を依頼する(自分では実行しない)。
- `NOT_MERGED` の場合: 翻訳対象の文書だけを更新してもコードとテストが古いままになる。ユーザーに「先に `git merge upstream/main` を行うか、文書だけの更新でよいか」を AskUserQuestion で確認する。文書だけの更新を選んだ場合は、台帳の `upstream_base` が進むことと、コードとの不整合が残ることを最終報告に明記する。
- マージ直後の場合、競合解決で英語版(theirs)を採用したファイルは日本語を含まない。Step 2 で `FULL` として扱う。

## Step 1: 差分確認

```bash
bun run translation:status --diff --json > translation/pending/status.json
bun run translation:status
```

- `changed` / `added` / `removed` / `untracked` の件数をユーザーに短く報告する。
- `removed`: 日本語版のファイルを削除する(`rm`)。生成物側は再生成で消えるが、`.gstack/generated.json` に残る出力は `bun run gen:skill-docs` の prune に任せる。
- `untracked`: upstream に無いローカルのファイル。フォーク独自なら `lib/translation-ledger.ts` の `FORK_ONLY` に追加し、そうでなければ原因を調べる。

## Step 2: 差分翻訳(Haiku 並列)

1. 作業一覧を作る。`changed` の各パスは、現在のファイルに日本語が含まれていれば `DIFF`、含まれていなければ `FULL`。`added` は `FULL`。

```bash
bun -e '
const s=JSON.parse(require("fs").readFileSync("translation/pending/status.json","utf8"));
const fs=require("fs"); const ja=/[぀-ヿ一-鿿]/;
const rows=[...s.changed.map(p=>[fs.existsSync(p)&&ja.test(fs.readFileSync(p,"utf8"))?"DIFF":"FULL",p]),...s.added.map(p=>["FULL",p])];
fs.writeFileSync("translation/pending/tasks.txt",rows.map(r=>r.join(" ")).join("\n")+"\n");
console.log(rows.length,"tasks");'
```

2. サイズで分割する(`chunk.ts` はパスの列だけを読むので、モード付きの一覧は後で結合する)。

```bash
cut -d" " -f2 translation/pending/tasks.txt | bun translation/tools/chunk.ts --out translation/pending/chunks --max-bytes 120000 --max-chunks 20
for f in translation/pending/chunks/chunk-*.txt; do grep -F -f "$f" translation/pending/tasks.txt > "${f%.txt}.tasks"; done
```

3. チャンクごとに Haiku エージェントを起動する(同時に 20 まで。終わったら残りを流す)。プロンプトは次の形:

> 差分翻訳をしてください。手順は `translation/prompts/translate.md` を最初に Read して従ってください。担当一覧(モード付き): `translation/pending/chunks/chunk-NN.tasks`。

4. 各エージェントの報告から「原文のまま残した箇所」を集め、Step 4 の判断材料にする。

## Step 3: 再生成と型検査

```bash
bun run gen:skill-docs --host all
bun run gen:skill-docs --host all --dry-run | grep -c STALE   # 0 であること
bun run typecheck
bun run translation:check
```

`gen:skill-docs` が失敗する場合は、テンプレートのプレースホルダー(`{{...}}`)やリゾルバーの構文が壊れている。エラーの箇所を直してから進む。

## Step 4: セルフレビュー

### 4a. 機械的チェック(自分で実行)

```bash
bun translation/tools/mech-check.ts --baseline upstream/main        # フェンス、見出し化、リンク化、表の列数(原文にもある分は除外)
bun translation/tools/anchors.ts --fix --ref upstream/main          # 翻訳した見出しで切れたアンカーを <a id> で復元
bun translation/tools/normalize-punct.ts --apply                    # 全角の括弧・コロン・疑問符を半角に統一
bun translation/tools/residue-scan.ts $(cut -d" " -f2 translation/pending/tasks.txt)   # 英語だけの行(人が判断)
```

- `anchors.ts` が `SKIP` にした分は、原文の見出しに当たる日本語見出しの直前に `<a id="…"></a>` を手で入れる。
- `residue-scan` の結果は、コマンド片・固有名詞・機械契約を除き、残りを訳す(Haiku に追加で依頼してよい)。

### 4b. 原文突き合わせ(Haiku 並列)

1. 今回訳したファイル(`translation/pending/tasks.txt` のパス)を `chunk.ts --max-bytes 130000` で分割する。
2. チャンクごとに Haiku エージェントを起動する:

> 翻訳のセルフレビューをしてください。手順は `translation/prompts/review.md` を最初に Read して従ってください。担当一覧: `translation/pending/chunks/review-NN.txt`。出力: `translation/pending/review/findings-NN.jsonl`。

3. 全報告が揃ったら集計し(`severity` と `kind` ごとの件数、high/medium の一覧)、次を自分で判断する:
   - `token` の指摘: 本当に機械が読む文字列か `grep -rn` で `lib/ bin/ scripts/ test/` を確認する。読まれるなら英語トークンを残し、見出しなら「英語トークン(日本語)」の形にする。読まれないなら日本語のままでよい。
   - エラー出力の本文(`lib/result-codes.ts` の summary など)と、Codex など外部モデルへ送るプロンプト、PR 本文テンプレートのフェンス内、TypeScript のコメントは英語のままにする。
   - 残りの散文の指摘(mistranslation / untranslated / unnatural / syntax)は、ファイルごとに JSONL を分けて Haiku に適用させる:

> 翻訳レビューの指摘を適用してください。手順は `translation/prompts/fix.md` を最初に Read して従ってください。指摘の一覧: `translation/pending/review/fix-NN.jsonl`。

4. 適用後に Step 3 を再実行する。

## Step 5: 予算とテストの調整

1. バイト予算とフィクスチャを再導出する(日本語は UTF-8 で 1 文字 3 バイト):

```bash
bun run scripts/gen-ship-goldens.ts
bun test/helpers/capture-context-budget.ts
bun translation/tools/regen-required-steps.ts
```

2. 影響するテストを先に回す(環境変数 `TMPDIR` は `/private` 始まりにする):

```bash
export TMPDIR=$([[ "$TMPDIR" == /private* ]] && echo "$TMPDIR" || echo "/private$TMPDIR")
bun test test/gen-skill-docs.test.ts test/skill-validation.test.ts test/ship-golden.test.ts test/context-budget-ratchet.test.ts \
  test/parity-suite.test.ts test/qa-lazy-sections.test.ts test/skill-fixture.test.ts test/workflow-required-steps.test.ts \
  test/catalog-budget.test.ts test/carve-section-ordering.test.ts test/external-host-carve.test.ts test/design-checklist-sync.test.ts \
  test/translation-ledger.test.ts --timeout 120000
```

   さらに、訳したスキルごとに `test/<skill>-*.test.ts` と `test/*<skill>*.test.ts` を回す。

3. 失敗の直し方(CLAUDE.md「テストの価値の基準」に従う):
   - 予算超過(`maxSkeletonBytes`、`maxSizeRatio`、`SKILL_BYTE_CEILING`、`CATALOG_BUDGET_TOKEN_EQUIVALENTS`、`KERNEL_MAX_BYTES` など): 実測値 + 1.5〜15% に引き上げ、コメントに「日本語版: 実測 N(日付)」と残す。
   - 英語の文をピン留めしているテスト: 構造・トークン・順序は厳密なまま、文の意味は `expectMentions`(`test/helpers/prompt-structure.ts`)で日本語のキーワードに置き換える。文をまるごと固定し直さない。
   - 見出しを参照するテスト: 見出しを「英語トークン(日本語)」にした場合は、正規表現の括弧を `\(` `\)` でエスケープする。
   - upstream が追加した新しいテストで英語の文を固定しているものも同じ方針で日本語に合わせる。
   - 環境要因(cso のバイナリ、ios-qa の Swift、dia 系、Linux 専用、Aside 未起動)は翻訳と無関係。疑わしい場合は英語版(`git worktree add --detach <tmp> upstream/main` に `node_modules` をシンボリックリンク)で同じテストを走らせて比較する。

4. 最後に無料スイート全体を単独で 1 回回す(他の作業と並走させない。1〜2 時間):

```bash
TMPDIR=$([[ "$TMPDIR" == /private* ]] && echo "$TMPDIR" || echo "/private$TMPDIR") bun run scripts/test-free-shards.ts --wall-timeout 7200
```

   失敗は、単独再実行 → 英語版との比較、の順で切り分け、翻訳起因だけを直す。

## Step 6: 台帳の更新と報告

```bash
bun run translation:mark            # 全部反映した場合。一部なら パスを列挙する
bun run translation:check
rm -rf translation/pending
```

最終報告には次を含める: 取り込んだ upstream のコミット、changed/added/removed の件数、Haiku の起動数、セルフレビューの件数と適用数、英語のまま残した判断(理由つき)、引き上げた予算、書き換えたテスト、残る失敗とその分類(翻訳起因 / 環境要因)、コミットはしていないこと。
