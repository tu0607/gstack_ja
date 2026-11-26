# 単純化・スペシャリストのレビューチェックリスト

適用範囲: 条件付き(DIFF_LINES > 100)。このレンズは、求められていない*構造*だけを探します。実装が 1 つだけの抽象化、標準ライブラリの手書き実装、プラットフォームの機能と重複する依存関係、使われない柔軟性です。カバレッジの隙間は対象外です。それは完全性の隙間(Completeness Gaps)のカテゴリが扱います。テスト、エラーのパス、エッジケースの分岐を削除対象にしてはいけません。
出力: JSON オブジェクト。1 行に 1 件の指摘。スキーマ:
{"severity":"INFORMATIONAL","confidence":N,"path":"file","line":N,"category":"delete|stdlib|native|speculative|shrink","summary":"...","fix":"...","lines_removable":N,"advisory":true,"fingerprint":"path:line:category","specialist":"simplification"}
必須: severity(常に INFORMATIONAL)、confidence、path、category、summary、advisory(常に true)、specialist。
任意: line, fix, fingerprint, evidence, lines_removable(修正を適用した場合に削除される正味の行数。マージの段階で合計して `net:` のフッターに使う)。
指摘がない場合: `NO FINDINGS` とだけ出力する。

このスペシャリストの指摘は助言です。PR 品質スコア、ヘッダー、Fix-First による自動適用からは除外されます。例外の扱いはマージの段階が処理します。

---

## 5 つのタグ(閉じた語彙。すべての指摘は、その `category` としてちょうど 1 つを使う)

- `delete:` 不要なコード、使われない柔軟性、投機的な機能。置き換えるものはない。
- `stdlib:` 標準ライブラリが提供している機能を、手で実装している。関数名を挙げること。
- `native:` プラットフォームが既にやっていることを、依存関係やコードで行っている。その機能名を挙げること。
- `speculative:` 実装が 1 つだけの抽象化、誰も設定していない設定、呼び出し元が 1 つだけの層。
- `shrink:` 同じロジックを、より少ない行数で書ける。削減が 5 行以上の場合のみ。短い形を示すこと。

## 指摘のスタイル: 1 行ずつ。場所、削るもの、置き換えるものを書く

❌ 「この EmailValidator クラスは必要以上に複雑かもしれません。この段階で、これらの検証ルールがすべて必要かどうか検討しましたか?」

✅ `{"severity":"INFORMATIONAL","confidence":8,"path":"lib/email.ts","line":12,"category":"stdlib","summary":"27-line validator class — '@' in email covers it; real validation is the confirmation mail","fix":"replace class with a one-line includes('@') check","lines_removable":26,"advisory":true,"specialist":"simplification"}`

✅ `{"severity":"INFORMATIONAL","confidence":9,"path":"app/dates.ts","line":4,"category":"native","summary":"moment.js imported for one format call","fix":"Intl.DateTimeFormat, 0 deps","lines_removable":3,"advisory":true,"specialist":"simplification"}`

✅ `{"severity":"INFORMATIONAL","confidence":8,"path":"repo.py","line":88,"category":"speculative","summary":"AbstractRepository with one implementation","fix":"inline it until a second implementation exists","lines_removable":41,"advisory":true,"specialist":"simplification"}`

✅ `{"severity":"INFORMATIONAL","confidence":7,"path":"sync.ts","line":52,"category":"delete","summary":"retry wrapper around an idempotent local call","fix":"nothing replaces it","lines_removable":19,"advisory":true,"specialist":"simplification"}`

## 探すもの

- 標準ライブラリやプラットフォームが既に提供している依存関係(日付選択のライブラリの代わりに `<input type="date">`、JS の代わりに CSS、アプリのコードの代わりに DB の制約)
- 実装が 1 つだけのインターフェース、生成する製品が 1 つだけのファクトリー、処理を委譲するだけのラッパー
- 1 つのものだけをエクスポートするファイル、使われないフラグや設定、手書きの標準ライブラリの処理
- 組み込みの機能で 1 行にまとめられる手書きのループ(5 行以上削減できる場合のみ)

## 抑制 — 次は指摘してはいけない(メインのチェックリストから引き継いだもので、ここでも拘束力がある)

- 「X は Y と冗長」だが、その冗長さが無害で、可読性を助けている場合
- 一貫性のためだけの変更(別の定数の扱いに合わせて、値を条件分岐で包むなど)
- テスト、エラーのパス、エッジケースの分岐、入力検証、セキュリティの対策、アクセシビリティ — 削除の対象には決してしない。カバレッジは完了性の隙間(Completeness Gaps)のカテゴリの仕事であり、「A が 70 行多いなら A を選ぶ」というのがこのプロジェクトのルール(ETHOS.md)である
- 単一のスモークテストやアサーションによる自己チェック — これは完全性の最低限であり、無駄ではない
- 意図的な `gstack-shortcut(dec-*)` のマーカー — 既に認識されている技術的負債ではあるが、決定 ID が台帳で解決される場合に限る(`gstack-decision-search`)。解決できない ID は偽りの抑制であり、負債ではない
- レビュー中の差分ですでに対処されている事項 — コメントする前に差分全体を必ず読むこと
