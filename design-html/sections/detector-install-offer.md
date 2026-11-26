<!-- AUTO-GENERATED from detector-install-offer.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<!-- Derived in part from nothing third-party: gstack's own consent flow for downloading impeccable's engine (Apache-2.0, see NOTICE.md). -->
# デザイン検出器: 一度だけのインストールの提案

このファイルは、Setup のプローブが `DESIGN_DETECTOR_INSTALL_OFFER` を出力したときにのみ読んでください。これは `/design-review` が尋ねるものと同じ質問です。どのデザインスキルが最初に実行されても、その質問をし、回答は記憶されます。

**Install offer(質問は 1 つ、一度だけ)。** プローブが `DESIGN_DETECTOR_INSTALL_OFFER: version=<v> platform=<p> bytes=<n> dest=<path>` を出力した場合、ユーザーはこれにまだ回答していません。ほかのどのステップより先に、対話セッションの場合のみ、今すぐ尋ねます。`SESSION_KIND: spawned` の場合やヘッドレス実行では、決してインストールも質問もせず、答えが「今はしない」だったかのように続行します。Conductor では、ブリーフをプローズとして表示して STOP します。このスキルの AskUserQuestion のフォーマットを使います:

```
Project/branch/task: <現在の作業から 1 行>
ELI10: impeccable は、別の Apache-2.0 ツール(Paul Bakaus 作)です。そのエンジンは <n> バイトの 1 つのプログラムで、ページと CSS を 61 種類の機械的なデザインのミスについてチェックします。gstack は、そのファイル 1 つ(バージョン <v>、github.com/pbakaus/impeccable のリリースから)を <dest> にダウンロードし、gstack に記録されたチェックサムと照合し、ダウンロードを ~/.gstack/security/egress.jsonl に記録できます。impeccable のスキルもエディターのフックもありません。gstack が実行しても、エンジンがネットワークに触れることはありません。これがなくても、このスキルは今までどおり動作します。
Stakes if we pick wrong: はいを選ぶと、サードパーティのバイナリがこのマシンに入ります。いいえを選ぶと、機械で検出できるデザインのミスを判断だけに任せたままになります。
Recommendation: ダウンロードは固定され、記録され、元に戻せる(<dest> を削除)ため A です。
注: 選択肢は網羅性ではなく種類が異なるため、完全性のスコアは付けません。
Pros / cons:
A) 今すぐエンジンをインストールする(推奨)
  ✅ すべてのデザインレビューが、ルール id でタグ付けされた 61 件の決定的なチェックから始まる
  ✅ ホームディレクトリ配下に、チェックサム検証済みのファイルが 1 つだけ。記録され、rm で削除できる
  ❌ 自分でビルドしていないサードパーティのバイナリが、スキャンでプロジェクトのファイルに対して実行される
B) 今はしない
  ✅ このマシンでは何も変わらない。デザインスキルが次に実行されるときに、質問が再び出る
  ❌ 機械が捕まえられるミスについて、デザインレビューは引き続き判断だけに頼る
C) 二度と尋ねない
  ✅ デザインスキルは impeccable について何も言わなくなる(元に戻せる: gstack-config set design_detector_install_prompted false)
  ❌ あとでインストールしたエンジンは使われるが、gstack がそれを知らせることは決してない
D) ディテクターをオフにする
  ✅ どのデザインスキルにも、プローブ、スキャン、handoff の行が出ない(gstack-config set design_detector off)
  ❌ あとでインストールしたエンジンは、design_detector が auto に戻るまで無視される
Net: 機械でチェックされた指摘と引き換えの、固定され記録された 16 MB のダウンロードと、すべてのデザインチェックが判断に任されたままである状態との比較。
```

**A** の場合は、インストールを実行して最初の行を読みます(`IMPECCABLE_INSTALLED: <path>` に続いて新しいプローブの行、または `IMPECCABLE_INSTALL_REFUSED: <reason>`。後者の場合、このスキルはスキャンなしで続行します):

```bash
bun --no-env-file --config=/dev/null run $HOME/.claude/skills/gstack/bin/gstack-design-detect.ts install --host claude
```

**B** の場合は、スキャンなしで続行します。**C** の場合は、`~/.claude/skills/gstack/bin/gstack-config set design_detector_install_prompted true` を実行します。**D** の場合は、`~/.claude/skills/gstack/bin/gstack-config set design_detector off` を実行します。`--sha256` や `--base` を自分で渡してはいけません。これらはメンテナーとミラー向けです。ユーザーが `/impeccable` のスキルとそのフックも望む場合は、ユーザー自身が `npx impeccable install` を実行します。gstack は決して実行しません。
