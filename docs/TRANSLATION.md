# 翻訳の運用(upstream 差分)

このフォークは upstream(garrytan/gstack)を日本語化したものです。upstream が更新されるたびに全量を翻訳し直さないよう、「どこまで翻訳したか」を台帳に記録し、差分のあるファイルだけを翻訳します。

## 仕組み

- **台帳** `translation/ledger.json`: 翻訳した生成元ファイルごとに、翻訳の基準にした upstream 側の英語版 blob sha と日付を記録します。`upstream_base` は最後に全件を反映した upstream のコミットです。
- **判定ロジック** `lib/translation-ledger.ts` の `isTranslationSource(path)`: 何を翻訳対象にするかを決める唯一の場所です。
- **CLI** `bin/gstack-translation-ledger`(`bun run translation:status` / `translation:mark` / `translation:check`)。CLI は `git fetch` を実行しません(マシン外への送信に受領記録が必要なため。取得は人間が行います)。
- **無料テスト** `test/translation-ledger.test.ts` が判定と往復を守ります。

### 翻訳対象

生成元だけが対象です。生成物は `bun run gen:skill-docs --host all` で作り直されるため、台帳には入れません。

- 対象: リポジトリ直下と `docs/` などの `.md`(README.md と `test/fixtures/**`、`make-pdf/test/fixtures/**` を除く)、すべての `.tmpl`、`*/sections/manifest.json`、`scripts/resolvers/**/*.ts`、`scripts/gen-skill-docs.ts`、`scripts/gen-agents-digest.ts`、`hosts/*.ts`、`lib/design-catalog.ts`、`lib/dx-error-contract.ts`、`lib/coordinator-contract.ts`、`model-overlays/*.md`。
- 除外: `.gstack/generated.json` の outputs(`*/SKILL.md`、`*/sections/*.md`、`review/design-checklist.md`、`agents-digest/*.md` など)と、同じ場所に `<name>.md.tmpl` がある `.md`。
- フォーク独自のファイル(`translation/**`、`docs/TRANSLATION.md`)は upstream に無いので対象外です。増やすときは `lib/translation-ledger.ts` の `FORK_ONLY` に追加します。

## 準備(初回のみ)

```bash
git remote add upstream https://github.com/garrytan/gstack.git
bin/gstack-translation-ledger init --base 4a98e407   # 台帳がまだ無い場合だけ
```

## upstream 更新時の手順

この手順は、プロジェクトのスキル `/translate-upstream`(`.claude/skills/translate-upstream/SKILL.md`)が一通り実行します。補助ツールは `translation/tools/`(機械的チェック、アンカー復元、記号の統一、分割、required-steps の再導出)、Haiku サブエージェント向けの指示は `translation/prompts/`(translate / review / fix)にあります。手で行う場合の流れは次のとおりです。

1. `git fetch upstream`(自分で実行)。
2. `bun run translation:status --diff` で差分を確認します。`CHANGED`(blob が変わった)、`ADDED`(新規)、`REMOVED`(消えた)、`UNTRACKED`(ローカルにあるが台帳にない)が出ます。`--diff` は CHANGED ごとの差分を `translation/pending/<path>.diff` に書きます。`--json` で機械可読の出力です。
3. 差分ファイルを Haiku サブエージェントで翻訳します。英語の diff と現在の日本語版を渡し、該当箇所だけを訳します。ADDED の新規ファイルは全文を訳します。REMOVED はファイルを削除します。
4. `bun run gen:skill-docs --host all` で生成物を作り直します。
5. `bun run translation:mark` で台帳を更新します(省略時は CHANGED/ADDED 全部。パスを指定すると一部だけ。REMOVED は台帳から消えます)。一部だけ mark した場合、残りの差分のために `upstream_base` は進みません。
6. `bun run typecheck && bun run test`。

`bun run translation:check` は UNTRACKED があると exit 1 です。upstream のマージで増えたファイルを台帳に入れ忘れると検出されます。

## 翻訳ルール

翻訳しないもの:

- コマンド、スクリプト、サンプルコード、`test/fixtures/**`。

英語トークンを残すもの(機械が読むマーカー):

- `# gstack: design-md-format=spec`
- `## currentDecision (…)`、`## Review Sections(…)`、`## Implementation plan`、`## Review record`
- `**STOP.**` と `Read \`<path>\``
- CLAUDE.md の `## Skill routing(…)`、`## Behavior changes`
- `Recommendation: … because …`
- エラー文字列そのものを見出しにしたもの
- Codex など外部モデルへ送るプロンプト本文

その他の注意:

- 日本語は UTF-8 で 1 文字 3 バイトです。バイト予算(SKILL.md のサイズやコンテキストの上限)は実測して引き上げます(`bun test/helpers/capture-context-budget.ts` など。CLAUDE.md の「サイズの予算」を参照)。
- 見出しを変えたら、その見出しを参照するテストも同時に更新します。
- テンプレートを訳したら必ず `bun run gen:skill-docs --host all` で SKILL.md を作り直し、`.tmpl` と生成物の両方を確認します(生成物を直接編集しない)。
