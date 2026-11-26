# サードパーティの告知(Third-Party Notices)

gstack は MIT ライセンスです。以下のファイルには、Apache-2.0 の成果物に由来する素材が含まれています。gstack の文体で書き直し、改変したものです。書き直したからといって、適用除外になるわけではありません。ライセンス本文は `licenses/Apache-2.0.txt` にあり、派生した各ファイルには、変更されたことを示す告知が付いています。改変されていないコピー(ルールレジストリの fixture、ライセンス本文)にはヘッダーがなく、ここに一覧で示します。

## impeccable — 著作権 Paul Bakaus — Apache License 2.0

https://github.com/pbakaus/impeccable

派生し、改変したもの:

- `lib/design-catalog.ts`: ルール ID と名前は `crates/live/assets/antipatterns.json` から取った。文章は gstack のもの。
- `scripts/resolvers/design.ts`: Persuade / Operate / Read / Experience の訪問者モード、制作の下限を守る習慣(ブラウザのサーフェス、意図的なモーションの瞬間は一つ、奥行きにはオフセットを持たせる、二次テキストに色味を持たせる、見出しの上に余白を取る、利用シーンに応じて明るい・暗いを選ぶ)、および三つの見た目による調整。`SKILL.md`、`reference/craft-floor.md`、`reference/new-work.md` から、書き直して取り込んだ。
- `design-consultation/sections/proposal-and-preview.md.tmpl`: 書体選定の手順と、調整の段落を書き直した。また、これらのソースから生成される `SKILL.md` / `sections/*.md` のファイル。

改変されていないコピー:

- `test/fixtures/impeccable-antipatterns.json`: コミット 87d8f6d6(engine-v0.1.3)の `crates/live/assets/antipatterns.json` を、出所を示す `_source` オブジェクトで包んだもの。

配布していないもの: `bin/gstack-design-detect.ts` は、ユーザーがインストールした impeccable のエンジンを呼び出します。gstack はそのエンジンを配布も複製もせず、impeccable のインストーラーやランチャーを実行することも決してありません。gstack が行えるダウンロードは、エンジンのバイナリそのものだけです。それも、デザインの skill が提示する一度きりの提案にユーザーが同意した後にのみ行われます。impeccable 自身の GitHub リリースから `~/.impeccable/bin/<version>/` に取得し、`lib/design-detect-contract.ts` に固定されたチェックサムで検証し、まずエグレス台帳に記録します。gstack はエンジンのネットワークの振る舞いを監査しません。ラッパーは URL のターゲットを拒否するので、gstack がエンジンにネットワークへ触れさせることはありません。

## DESIGN.md の仕様 — Copyright Google LLC — Apache License 2.0

https://github.com/google-labs-code/design.md

`lib/design-md.ts`、`bin/gstack-design-md.ts`、および `design-consultation/sections/proposal-and-preview.md.tmpl` の Phase 6 テンプレートは、この形式を実装しています(5 つのグループからなる YAML のトークンのフロントマター、仕様の順序に従った 8 つの正規のセクション、`{path}` のトークン参照)。仕様の本文は一切複製していません。
