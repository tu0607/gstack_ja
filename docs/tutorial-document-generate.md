# チュートリアル: 機能のドキュメントを 90 秒で生成する

すでにあるプロジェクトに対して `/document-generate` を実行し、チュートリアル / ハウツー / リファレンス / 解説のドキュメントが適切な場所に書かれていく様子を確認します。最後には、PR に貼り付けられるカバレッジマップができあがります。このチュートリアルを終える頃には、4 つの動き(scope、archaeology、partition、write)がわかるようになっています。

## 必要なもの

- gstack のインストール(`git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup`)
- 公開されているサーフェスを少なくとも 1 つ持つプロジェクト(CLI コマンド、エクスポートされた関数、設定オプション、スキル、API エンドポイントのいずれか)で動いている Claude Code
- 約 90 秒

事前に `docs/` ディレクトリを用意する必要はありません。ない場合はスキルが作成します。Diátaxis の用語を知っている必要もありません。出力にはスキルがラベルを付けてくれます。

## ステップ 1: 任意のプロジェクトでスキルを呼び出す

ドキュメント化したいプロジェクトで Claude Code を開きます。次のように入力してください。

```
/document-generate
```

出力先について、スキルが 1 つ質問してきます。

```
A) Write documentation inline in existing files (README, ARCHITECTURE, etc.)
B) Create standalone documentation files (e.g., docs/ directory)
C) Both — inline summaries in existing files + deep docs in standalone files

RECOMMENDATION: Choose C because it maximizes both discoverability and depth.
```

C を選んでください。README へのポインタと、一式の独立したドキュメントが得られます。

## ステップ 2: アーカイオロジー(調査)の実行を見る

スキルは、コードベースを読んでいる約 30 秒の間、無言になります。これは意図的なものです。ステップ 1 の「Codebase Archaeology」フェーズは、このワークフローの中で最も重要なステップだからです。スキルは次のものを読んでいます。

- リポジトリの構造全体
- README、ARCHITECTURE、CONTRIBUTING、CLAUDE.md(エントリーポイント)
- ドキュメント化対象の実装ファイル(シグネチャだけでなく、ファイル全体)
- テスト(エッジケースや意図された動作がわかる)
- `// NOTE:`、`// DESIGN:`、`// WHY:` のタグが付いたインラインコメント

完了すると、次のような行が表示されます。

```
Researched 47 files, identified 12 public surface items, 8 concepts, and 4 design decisions.
```

この数字は、スキルがファイル名から推測したのではなく、実際にコードを読んだことを示しています。

## ステップ 3: Diátaxis の分割計画を確認する

スキルは、どの対象に対してどの象限を書くかを示す分割計画を表示します。

```
Documentation plan:
  [entity]              [tutorial] [how-to] [reference] [explanation]
  WidgetService         ✅ new     ✅ new   ✅ new      ✅ new
  --verbose flag        ❌        ✅ new   ✅ inline   ❌
  Bayesian scheduler    ❌        ❌       ✅ new      ✅ new
```

すべての対象に 4 つの象限が必要なわけではありません。CLI のフラグにはリファレンスとハウツーが付きます。内部モジュールにはリファレンスと解説が付きます。ユーザー向けの機能には 4 つすべてが付きます。スキルは対象の種類に基づいて選びます。

計画に 5 件を超えるドキュメントが含まれる場合、スキルは進める前に確認を求めます。それ以外の場合は、そのまま進みます。

## ステップ 4: 最初に作られたドキュメントを読む

リファレンスのドキュメントは語彙を決めるため、最初に作られます。次のような行が表示されます。

```
GENERATED: docs/reference-widget-service.md
```

そのファイルを開いてください。厳密な構造になっています。1 段落の導入、型とデフォルト値を含む完全な API の一覧、実行可能な例が 2〜3 件、そして次に作られるハウツーとチュートリアルへのリンクを含む Related セクションです。

これが Diátaxis におけるリファレンスの姿です。事実に基づいて網羅的で、物語はありません。あるオプションがなぜ存在するのかを説明したくなったら、それは次にスキルが書く解説のドキュメントに書くべき内容です。

## ステップ 5: 解説、ハウツー、チュートリアルが現れるのを見る

立て続けに(それぞれ 5〜10 秒ほどで)、スキルは残りの象限を書き出します。

```
GENERATED: docs/explanation-widget-architecture.md
GENERATED: docs/howto-create-a-custom-widget.md
GENERATED: docs/tutorial-build-your-first-widget.md
```

それぞれを開いてください。互いの内容を繰り返していないことに気づくはずです。

- **解説** は、問題から始まり、次にアプローチ、そして検討したトレードオフと代替案へと進みます
- **ハウツー** には、前提条件、正確なコマンドを含む番号付きの手順、検証のセクション、トラブルシューティングのセクションがあります
- **チュートリアル** は、3 ステップ未満で動く結果にたどり着き、「What you built」で締めくくられます

スキルはこれらの構造を強制します。ハウツーに検証のセクションが欠けていた場合は、ステップ 8 の品質の自己レビューがコミット前にそれを検出します。

## ステップ 6: 相互リンクを確認する

すべてのドキュメントは、ほかのドキュメントにリンクしています。リファレンスの Related セクションはハウツーとチュートリアルへのリンクを含み、ハウツーの Related セクションはリファレンスへのリンクを含み、チュートリアルの「What you built」セクションは、より深く掘り下げるためにリファレンスへのリンクを含みます。

壊れたリンクがないかを grep で確認します。

```bash
grep -rE '\]\([^)]*\.md\)' docs/ | head -10
```

リンク先のファイルは、すべて存在するはずです。スキルのステップ 7「Cross-Document Linking & Discoverability」が、コミット前にこれを確認しています。

## ステップ 7: PR の本文でカバレッジの概要を確認する

オープンな PR がある機能ブランチにいる場合、スキルは PR の本文に `## Documentation Generated` の表を追加して更新します。

```
## Documentation Generated

| File | Quadrant | Description |
|------|----------|-------------|
| docs/tutorial-build-your-first-widget.md | Tutorial | Walk-through from install to first working widget |
| docs/reference-widget-service.md | Reference | Complete widget API with types, defaults, examples |
| docs/explanation-widget-architecture.md | Explanation | Why widgets are isolated services |
| docs/howto-create-a-custom-widget.md | How-to | Creating and registering custom widgets |
```

PR を開いたレビュアーは、この表を見ることで、どの種類のカバレッジが含まれているかをすぐに把握できます。

## 作ったもの

4 つのドキュメントができました。それぞれ、異なる 4 種類の読者に向けたものです。

- プロジェクトに初めて触れる人は `tutorial-*.md` を読めば、動くものを手に入れられます
- 経験のあるユーザーは `howto-*.md` を読めば、特定のタスクを達成できます
- API の利用者は `reference-*.md` を読めば、正確なシグネチャを確認できます
- コードレビューをする人は `explanation-*.md` を読めば、設計を理解できます

それぞれは、保守しやすい程度に短くまとまっています。それぞれが 1 つの役割だけを持ちます。PR の本文には、どの象限がカバーされたかが示されます。後で `/document-release` を実行すると、Diátaxis のカバレッジマップは、この対象が 4/4 の象限で完全にカバーされていると報告します。

## 次にやること

- `/document-release` が指摘したまま埋めていないギャップがある場合: そのエンティティに限定して `/document-generate` を再度実行してください。
- 4 つの象限が存在する理由を知りたい場合: [explanation-diataxis-in-gstack.md](./explanation-diataxis-in-gstack.md) を読んでください。
- プロジェクト全体ではなく、出荷前に特定の機能だけをドキュメント化したい場合: [howto-document-a-shipped-feature.md](./howto-document-a-shipped-feature.md) を読んでください。
- スキル自体のリファレンス: [`document-generate/SKILL.md`](../document-generate/SKILL.md)
