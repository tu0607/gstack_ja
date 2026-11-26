<!-- AUTO-GENERATED from review-sections.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Review Sections(レビューのセクション。7つのパス、スコープ合意後)

**誤スキップ防止ルール:** プランの種類(戦略、仕様、コード、インフラ)にかかわらず、レビューパス(1〜7)を圧縮、省略、スキップしないでください。このスキルのすべてのパスには理由があります。「これは戦略ドキュメントなので設計パスは適用されない」という判断は常に誤りです。設計上のギャップこそ実装が破綻する箇所だからです。パスに本当に指摘事項がない場合は「指摘事項なし」と述べて次に進んでかまいませんが、そのパスを必ず評価しなければなりません。

**文脈:** このセクションは `plan-design-review/SKILL.md` の続きです。そのセットアップがもう文脈にない場合は、`~/.claude/skills/gstack/plan-design-review/SKILL.md` を Read して、システム監査、デザイン哲学、Step 0、Step 0.5 のモックアップセットアップ(`$D`)、セクションの自己チェックを確認してください。既存の結果を使い、レビューを最初からやり直さないでください。

**誤った先送り防止条項:** 未解決の指摘事項ごとに、意思決定サイクルを1回完了させてください。ギャップを説明し、選択肢を推奨し、ユーザーから個別の決定を得てから、選ばれた修正を適用します。スコープ、フォーカス、セットアップ、次のステップの選択は、いかなる修正も承認しません。最後の次のステップの AskUserQuestion を、指摘事項の承認ループの代わりに使わないでください。未解決の指摘事項がなければ、指摘事項に関する質問は不要です。

**パス間で決定を引き継ぐ。** 指摘事項とは、プランの複数箇所に現れても、1つの未解決のデザイン要件またはトレードオフのことです。各パスの前に、プラン、DESIGN.md、既に行われた決定を比較してください:

| 状況 | 必要な対応 |
|-----------|-----------------|
| 修正案に、ユーザーの個別の決定、またはプリアンブルで承認された指摘ごとの自動決定が既にある。 | その決定を再利用し、影響するすべての参照と一致するトークンに適用する。再度質問しない。 |
| 承認済みの要件を、ジャーニーのストーリーボードなど必須の成果物にそのまま写す必要がある。 | 別途フォーマットを尋ねずに成果物を作成する。これは要件を記録するだけで、新たな修正は承認しない。 |
| プランが DESIGN.md に違反している、またはギャップがあり、その修正を承認する個別の決定がまだない。 | 入力がそのギャップを指摘していても、また DESIGN.md が正確なトークンを指定していても、その指摘について質問し、修正する前に回答を待つ。提案された修正は保留のままにする。 |
| 新しい証拠により、不足している要件、矛盾、または新たなトレードオフが生じた。 | 新しい指摘を明示し、代替案を提示し、プランを変更する前にその指摘の個別の決定を得る。 |

レポートの作成、トークンのマッピング、モックアップの作成、タスクの一覧化は、いずれも修正を承認しません。指摘事項はあるがナビゲーションにしか回答がない場合、レビューはまだ最初の指摘事項の決定を待っている状態です。

## Prior Learnings(過去の学び)

過去のセッションから関連する学びを検索します:

```bash
_CROSS_PROJ=$(~/.claude/skills/gstack/bin/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  { _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 --cross-project 2>&1 >&3 3>&-); _LR=$?; } 3>&1
else
  { _LE=$(~/.claude/skills/gstack/bin/gstack-learnings-search --limit 10 2>&1 >&3 3>&-); _LR=$?; } 3>&1
fi
[ "$_LR" = 0 ] || { _LE=${_LE%%$'\n'*}; echo "LEARNINGS: unavailable (${_LE:-exit $_LR})"; }
```

`CROSS_PROJECT` が `unset`(初回)の場合: AskUserQuestion を使います:

> gstack は、このマシン上の他のプロジェクトの学びを検索して、ここに当てはまりそうな
> パターンを見つけることができます。これはローカルで完結します(データがマシンの外に出ることはありません)。
> 個人開発者におすすめです。複数のクライアントのコードベースを扱っていて、
> 相互汚染が懸念される場合は、スキップしてください。

選択肢:
- A) プロジェクト横断の学びを有効にする(推奨)
- B) 学びをプロジェクト内に限定する

A の場合: `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings true` を実行します
B の場合: `~/.claude/skills/gstack/bin/gstack-config set cross_project_learnings false` を実行します

その後、適切なフラグを付けて検索を再実行します。

学びが見つかった場合は、分析に取り入れます。review の指摘が過去の学びに
一致した場合は、次のように表示します:

**「過去の学びを適用: [key](確信度 N/10、[date] から)」**

これにより、学びが積み重なっていく様子が見えるようになります。ユーザーには、gstack が
時間とともにそのコードベースについて賢くなっていることが伝わるはずです。

すべてのパスは、プランと参照されている既存の契約を使って評価してください。明示的に除外された成果物は、不足している要件ではありません。許可された証拠を使って同じ観点を評価してください。除外を見直すのは、具体的なデザイン上のギャップがある場合だけで、変更する前に質問してください。

**パスのプロトコル(1〜6):** 初期の 0〜10 のスコアを記録してください。以下の `FIX TO 10` はすべて提案です。各指摘について質問し、承認を待ち、そのうえでプランを編集し、スコアが変わった理由とともにそのパスを再評価してください。先に編集して後で質問することは決してしないでください。

却下された修正は記録として残します。解消されていないギャップがあるパスのスコアは 10 未満のままです。各パスの修正前後のスコアと残りのギャップは、以下の完了サマリーに引き継いでください。総合スコアは完了サマリーの規定どおりに計算し、リトマス質問の回答やパス7の決定件数を数値評価として扱わないでください。パス7は採点しない決定事項の登録簿であり、7つ目の評価ではありません。

既存の、または既に承認された契約の忠実な再記述(たとえば変更のないレイアウトのワイヤーフレーム)は、新しいデザイン上の選択ではなくレビューの証拠です。それを直接記録してください。作成することで設計上の決定が新たに導入されたり変更されたりする場合は質問してください。最後に、以下の必須成果物と最終的なプラン ファイルのレビューレポートで締めくくります。未回答の決定もそこに含めてください。

### パス 1: 情報アーキテクチャ
評価 0〜10: プランは、ユーザーが最初、2番目、3番目に何を見るかを定義しているか?
FIX TO 10: 情報階層をプランに追加する。画面/ページ構造とナビゲーションの流れを示す ASCII 図を含める。「制約への執着」を適用する。3つしか表示できないなら、どの3つか?
**STOP.** 指摘1件ごとに AskUserQuestion を1回行う。まとめて聞かないこと。推奨案と理由を示す。指摘がなければ、その旨を伝えて次に進む。ユーザーが応答するまで先に進まないこと。

### パス 2: インタラクション状態の網羅
評価 0〜10: プランは、読み込み中、空、エラー、成功、一部成功の状態を定義しているか?
FIX TO 10: インタラクション状態の表をプランに追加する:
```
  FEATURE              | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL
  ---------------------|---------|-------|-------|---------|--------
  [each UI feature]    | [spec]  | [spec]| [spec]| [spec]  | [spec]
```
各状態について、バックエンドの動作ではなく、ユーザーが実際に目にするものを記述する。
空の状態は機能の一部として扱う。温かみ、主要なアクション、文脈を指定する。
**STOP.** 指摘1件ごとに AskUserQuestion を1回行う。まとめて聞かないこと。推奨案と理由を示す。

### パス 3: ユーザージャーニーと感情の流れ
評価 0〜10: プランはユーザーの感情的な体験を考慮しているか?
FIX TO 10: 承認されたジャーニーを、必須のストーリーボードとして描く。作成するかどうかは尋ねないこと:
```
  STEP | USER DOES        | USER FEELS      | PLAN SPECIFIES?
  -----|------------------|-----------------|----------------
  1    | Lands on page    | [what emotion?] | [what supports it?]
  ...
```
時間軸の設計を適用する: 5秒の本能的反応、5分の行動、5年の内省。
**STOP.** 指摘1件ごとに AskUserQuestion を1回行う。まとめて聞かないこと。推奨案と理由を示す。

### パス 4: AI スロップのリスク

**パス4の評価:** 評価 0〜10: プランは、具体的で意図のある UI を記述しているか、それとも汎用的なパターンか? 各ハードリジェクションの該当と、リトマス質問への YES/NO を、根拠とともに記録する。解消されていないハードリジェクションがあると、このパスの評価は 8 未満に抑えられます(デザインが完成していない扱い)。自動的に 0 点になるわけではありません。リトマス質問の回答は指摘を裏付けるためのもので、独立した数値評価ではありません。
以下のルールの根拠として、プランのテキストと、利用可能な場合はモックアップを使ってください。

#### Design Hard Rules

これらを、計画、承認済みのモックアップ、参照している既存の契約における UI 要件としてレビューします。レンダリングされたサーフェスがある場合は、ピクセルまたは計算済みの値を確認します。ない場合は、計画が規定している内容を評価し、具体的な欠落を特定します。

**Classifier: ルールを適用する前に、モードを名指しします。** モードとは、プロダクトが何であるかではなく、THIS サーフェスで訪問者にとっての成功がどういう姿か、です。開発ツールのランディングページは Persuade です。ファッションハウスのドキュメントは Read です。
- **PERSUADE**(MARKETING/LANDING PAGE: ヒーロー主導、ブランド前面、料金、キャンペーン)→ 訪問者が決断して行動します。デザインそのものがプロダクトです。Landing Page Rules を適用します。
- **OPERATE**(APP UI: ダッシュボード、管理画面、設定、エディター、ツール)→ 訪問者がタスクを終わらせます。一覧性とネイティブの期待が表現に勝ります。ブランドはディテールに宿ります。App UI Rules を適用します。
- **READ**(ドキュメント、記事、ガイド、変更履歴)→ 訪問者が何かを理解します。理解しやすい構造にし、そのうえで留まる価値を作ります。Read Rules を適用します。
- **EXPERIENCE**(ポートフォリオ、ギャラリー、ショーケース)→ 訪問者は作品の中にいます。最初のビューポートは作品のものであり、インターフェースは身を引きます。Experience Rules を適用します。
- **HYBRID**(アプリのようなセクションを持つマーケティングのシェル)→ ページ単位ではなく、セクション単位で分類します。

**Hard rejection criteria**(即不合格のパターン — 1 つでも該当すればフラグを立てる):
1. ありきたりな SaaS のカードグリッドが第一印象になっている
2. 美しい画像だが、ブランドが弱い
3. 強い見出しだが、明確なアクションがない
4. テキストの背後に雑多な画像がある
5. 複数のセクションが同じムードの訴えを繰り返している
6. 物語上の目的のないカルーセル
7. レイアウトではなく、積み重ねたカードで作られたアプリ UI

**Litmus checks**(各項目に、証拠とともに YES/NO で答えます。利用可能な場合は、外部ボイスのリトマススコアカードと比較します。これらは指摘を裏付けるもので、追加の数値スコアではありません):
1. 最初の画面で、ブランドやプロダクトがはっきり分かるか。
2. 強い視覚的なアンカーが 1 つあるか。
3. 見出しをざっと読むだけでページが理解できるか。
4. 各セクションの役割は 1 つか。
5. カードは本当に必要か。
6. モーションは階層構造や雰囲気を改善しているか。
7. 装飾的なシャドウをすべて取り除いても、デザインは上質に感じられるか。

**Landing page rules**(classifier = PERSUADE / MARKETING/LANDING の場合に適用):
- 最初のビューポートは、ダッシュボードではなく、1 つの構図として読める
- ブランド優先の階層: ブランド > 見出し > 本文 > CTA
- タイポグラフィ: 表現力があり、目的がある — デフォルトのスタック(Inter、Roboto、Arial、system)は使わない
- デフォルトで単色のフラットな背景にしない: ブランドまたは実在のアセットによるテクスチャを使い、ハロー、スポットライト、ストライプ、方眼紙のグラデーションは決して使わない(下の AI Slop blacklist とディテクタールールの id を参照)
- ヒーロー: フルブリード、端から端まで。インセット/タイル状/角丸のバリエーションは使わない
- ヒーローの予算: ブランド、見出し 1 つ、補足の文 1 つ、CTA グループ 1 つ、画像 1 つ
- ヒーローにカードを置かない。カードは、カード自体がインタラクションである場合のみ
- 1 セクションにつき 1 つの役割: 1 つの目的、1 つの見出し、1 つの短い補足の文
- モーション: 最初のビューポートに作り込まれた見せ場を 1 つ(登場、またはスクロール連動の表示)。見えているデフォルトからの ease-out。ホバー状態は、情報を伴う場合のみ
- 色: CSS 変数を定義し、白地に紫というデフォルトを避け、アクセントカラーはデフォルトで 1 色
- コピー: デザインの解説ではなく、プロダクトの言葉。「30% 削って良くなるなら、削り続ける」
- Beautiful defaults: 構図優先、ブランドを最も大きな文字に、書体は最大 2 つ(加えてデータとコード用のモノスペース)、デフォルトでカードなし、最初のビューポートはドキュメントではなく 1 つの構図(ポスターの姿勢であって、文字サイズではない。display は 6rem 未満に収める)

**App UI rules**(classifier = OPERATE / APP UI の場合に適用):
- 落ち着いたサーフェスの階層、強いタイポグラフィ、少ない色
- 密度は高いが読みやすい、最小限のクローム
- 構成: プライマリのワークスペース、ナビゲーション、補助的なコンテキスト、アクセント 1 つ
- 避けるもの: ダッシュボードのカードのモザイク、太い枠線、装飾的なグラデーション、飾りのアイコン
- コピー: 実用的な言葉 — 現在地の案内、状態、アクション。気分/ブランド/願望ではない
- カードは、カード自体がインタラクションである場合のみ
- セクション見出しは、そこが何の領域か、またはユーザーに何ができるかを述べる(「Selected KPIs」「Plan status」)

**Read rules**(classifier = READ の場合に適用):
- 行長 65〜75ch、読みの列は 1 本、見出しは前よりも後に続くものに近づける
- 道案内は機能です: 今どこにいるか、次は何か、どこで検索するか
- ドキュメントの索引は Persuade ではなく Read です: ヒーローなし、CTA の芝居なし

**Experience rules**(classifier = EXPERIENCE の場合に適用):
- 作品が最初のビューポートを埋める。クロームは、1 ピクセルごとにその場所に値しなければならない
- 作り込まれたトランジションは 1 つ。スクロールジャックのツアーにはしない
- テンプレートに合わせて作品を切り取ってはいけない

**Universal rules**(すべてのタイプに適用):
- 色のシステムに CSS 変数を定義する
- ディスプレイの声として、デフォルトのフォントスタック(Inter、Roboto、Arial、system)を使わない。DM Sans, Instrument Sans, IBM Plex Sans は、提案がその役割を明示的に割り当てている場合に限り、Operate または Read のサーフェスの body/UI として使ってよい
- 1 セクションにつき 1 つの役割
- 「コピーの 30% を削って良くなるなら、削り続ける」
- カードはその存在に値しなければならない — 装飾的なカードのグリッドは不可
- 小さい、またはコントラストの低い文字を決して使わない(本文が 16px 未満、または本文のコントラスト比が 4.5:1 未満)
- ラベルを、入力欄の中だけに置いてはならない(placeholder-as-label のパターン — 入力欄に内容があるときもラベルが見えていなければならない)
- 訪問済みと未訪問のリンクの区別を必ず保つ(訪問済みのリンクは別の色にする)
- 見出しを段落の間に浮かせてはならない(見出しは、前のセクションよりも、それが導入するセクションに視覚的に近くなければならない)

**ディテクターが捕まえない反射的な習慣**(毎回、手で確認する):
- **Browser surfaces carry the design.** 選択色、キャレット、スクロールバー、フォーカスリング、下線のオフセット、等幅数字は、どのデザインシステムにも属さないブラウザのデフォルトのまま出荷されます。パレットに合わせてテーマ化します。ページが寄せ集めではなく設計されたものであることを示す最も安上がりな目印で、モデルが最も飛ばしがちなものです。
- **One authored motion moment.** すべてのセクションで同じ登場演出にしない、すべてにホバー効果を付けない。すでに見えているデフォルトからの指数関数的な ease-out にします。コンテンツがアニメーションのタイミングの陰に隠れてはいけません。
- **Depth has an offset.** 影はオフセットとやわらかいぼかしです。オフセットがゼロの色付きのハローは装飾であり、奥行きではありません。
- **Secondary text on a colored surface is tinted from that hue.** 決してグレーにしません。
- **More space above a heading than below it.** 計算済みの値を読みます。
- **Light or dark comes from the use scene.** 誰が、どこで、どんな光の下で: 1 文で。カテゴリからは決して決めません。

**Calibration: the three looks.** AI が作ったインターフェースは、プロダクトが何であれ、3 つの見た目のどれかに落ち着きます: (1) クリーム色の地、コントラストの高いセリフのディスプレイ、テラコッタまたはシグナルレッドのアクセント。(2) ほぼ黒、ネオンのアクセント 1 色、光る縁。(3) 新聞の紙面のような細い罫線、イタリックのディスプレイセリフ、小さなトラッキング付きのモノスペースのラベル。それぞれ、ブリーフが求めているのであれば問題ありません。ブリーフが見た目を決めていなかったのにいずれかに着地したなら、見ることをやめています。テスト: カテゴリだけから、あなたの見た目を当てられるか? 「そのカテゴリ、ただし明白なものを避けて」から当てられるか? どちらであっても、やり直します。「本の話だからクリーム色とセリフ」は、このテストに落ちます。ブッククロスやジャケットは、ありとあらゆる彩度の高い色で作られています。

**AI Slop blacklist**(「AI 生成」と一目でわかる 11 件のパターン):
1. 紫・バイオレット・インディゴのグラデーション背景、または青から紫へのカラースキーム
2. **3 カラムのフィーチャーグリッド(3-column feature grid):** 色付き円の中のアイコン + 太字のタイトル + 2 行の説明を、左右対称に 3 回繰り返す。AI が作るレイアウトとして最も見分けやすい型。
3. セクションの飾りとして、色付きの円の中に置いたアイコン(SaaS スターターテンプレートの見た目)
4. すべてを中央揃えにする(見出し・説明・カードのすべてに `text-align: center`)
5. すべての要素に同じ丸い border-radius を付ける(どの要素にも同じ大きな角丸)
6. 装飾的なブロブ、浮かぶ円、波形の SVG 区切り線(セクションが空に感じるなら、必要なのは装飾ではなく良いコンテンツ)
7. 絵文字をデザイン要素として使う(見出しのロケット、箇条書きの絵文字)
8. カード上の色付き左ボーダー(`border-left: 3px solid <accent>`)
9. ありきたりなヒーローコピー(「Welcome to [X]」「Unlock the power of...」「Your all-in-one solution for...」)
10. 型にはまったセクションのリズム(ヒーロー → 特徴 3 つ → お客様の声 → 料金 → CTA、どのセクションも同じ高さ)
11. system-ui や `-apple-system` を主要な見出し/本文フォントにする。これは「タイポグラフィを諦めた」サインだ。ちゃんとした書体を選ぶ。

カタログの残りに対するディテクタールールの id(指摘の中の `[rule-id]` は、これらのいずれかです): border-accent-on-rounded: Border accent on a rounded card; overused-font: Overused display font; flat-type-hierarchy: Flat type hierarchy; gradient-text: Gradient text; cream-palette: Cream default palette; nested-cards: Nested cards; monotonous-spacing: Monotonous spacing; bounce-easing: Bounce easing; pulsing-dot: Pulsing status dot; blinking-cursor: Blinking cursor effect; shape-assembled-illustration: Shape-assembled illustration; dark-glow: Dark-mode glow; radial-halo: Radial halo; radial-spotlight-glow: Radial spotlight glow; marquee: Logo marquee; icon-tile-stack: Icon tile above every heading; italic-serif-display: Italic serif display; hero-eyebrow-chip: Hero eyebrow chip; kicker-above-heading: Kicker above heading; numbered-section-labels: Numbered section labels; em-dash-overuse: Em-dash overuse; marketing-buzzword: Marketing buzzwords; aphoristic-cadence: Aphoristic cadence; oversized-h1: Oversized h1; extreme-negative-tracking: Extreme negative tracking; gpt-thin-border-wide-shadow: Thin border plus wide shadow; repeating-stripes-gradient: Repeating stripes gradient; codex-grid-background: Grid-paper background; theater-slop-phrase: Theater phrases; image-hover-transform: Image hover zoom.
ディテクタールールのない、判断で見つける兆候: gradient cta button, stock-photo hero, cards as the default component, generic testimonial section, left-text right-image hero, generic cta labels, hero metric template, identical card grids, glassmorphism, hand-drawn svg illustration, modal by default, monospace as costume, content stand-ins, mode picked by category, unthemed browser surfaces, missing states.

出典: [OpenAI "Designing Delightful Frontends with GPT-5.4"](https://developers.openai.com/blog/designing-delightful-frontends-with-gpt-5-4)(2026 年 3 月)+ gstack のデザインメソドロジー。

FIX TO 10: 曖昧な UI の記述を、具体的な代替案に書き換える:
- 「アイコン付きのカード」 → 何が、どのSaaSテンプレートとも違うのか?
- 「ヒーローセクション」 → 何がこのヒーローを、この製品ならではのものにしているのか?
- 「すっきりしたモダンな UI」 → 意味がない。実際のデザイン上の決定に置き換える。
- 「ウィジェット付きのダッシュボード」 → 何が、ほかのダッシュボードと違うのか?
Step 0.5 で視覚的なモックアップを生成した場合は、上記の AI スロップのブラックリストに照らして評価してください。Read ツールで各モックアップ画像を読みます。汎用的なパターン(3列グリッド、中央寄せのヒーロー、ストックフォトのような印象)に当てはまるか? 当てはまる場合は指摘し、より具体的な指示で再生成するか尋ねてください。その際は `$D iterate --feedback "$(cat "$FEEDBACK_FILE")"` を使います(フィードバックはインラインではなく非公開のファイルに置く)。以降の表示、確認、ボードには、表示される `outputPath` を使ってください。
**STOP.** 指摘1件ごとに AskUserQuestion を1回行う。まとめて聞かないこと。推奨案と理由を示す。

### パス 5: デザインシステムとの整合
評価 0〜10: プランは DESIGN.md と整合しているか?
DESIGN.md がない場合は、プランに明示されたトークンとコンポーネントの指定を評価してください。指定がないものは指摘事項として残し、採点を省略したり整合していると仮定したりしないでください。
FIX TO 10: DESIGN.md がある場合は、具体的なトークンやコンポーネントを注記する。YAML のフロントマターがある場合(オープンな DESIGN.md 形式)は、パスでトークンを引用する(`{colors.primary}`、`{rounded.md}`)。これにより、プランとファイルが同じ語彙を共有します。DESIGN.md がない場合は、そのギャップを指摘し、`/design-consultation` を推奨する。
新しいコンポーネントにはフラグを立て、既存の語彙に合うかどうかを確認する。
トークンの整合性に関する修正を提案する前に、以前のパスで同じ結果が既に承認されていないか確認してください。承認されている場合は、確立されたトークンを適用し、そのすべてのギャップ/参照を更新してください。プランの場所を変えたり、同じ修正を言い換えたりしても、新しい指摘にはなりません。新しい証拠によって未解決の要件やトレードオフが明らかになった場合にのみ、再度質問し、その内容を明示してください。承認されていない違反には、最初の個別の決定が必要です。
**STOP.** 指摘1件ごとに AskUserQuestion を1回行う。まとめて聞かないこと。推奨案と理由を示す。

### パス 6: レスポンシブとアクセシビリティ
評価 0〜10: プランは、モバイル/タブレット、キーボード操作、スクリーンリーダーを指定しているか?
FIX TO 10: ビューポートごとのレスポンシブ仕様を追加する。「モバイルでは縦に積む」ではなく、意図的なレイアウト変更を書く。アクセシビリティとして、キーボード操作のパターン、ARIA ランドマーク、タッチターゲットのサイズ(最小 44px)、コントラストの要件を追加する。
**STOP.** 指摘1件ごとに AskUserQuestion を1回行う。まとめて聞かないこと。推奨案と理由を示す。

### パス 7: 未解決のデザイン上の決定
以前のパスで記録された未解決の選択肢から始める。新しい項目ごとに、プラン、ソース、DESIGN.md、または承認されたモックアップの中から、実際に範囲内にある要素と、欠けている決定を示すこと。ページ名やセクション名、外部レビューの提案では、コントロールが存在する根拠にはなりません。まず利用可能な成果物を確認すること。存在が不明な場合は、その項目を条件付きとして扱い、何を検証すべきかを明示してください。仮定の要素のために、コントロールを作り出したり、承認済みの扱いを見直したりしないこと。実際の欠けている決定と具体的な矛盾だけを提示し、ある扱いを承認しても、それが別の既知の要素を決めることにはならない。

承認済みのユーザーに見える成果を保持すること。実装の仕組みを選ぶことで、それらを見直すことにはならない。具体的な制約によって新しいデザイン上の要件やトレードオフが明らかになった場合にのみ質問する。実装時に問題となる残りの曖昧さを提示する:
```
  DECISION NEEDED              | IF DEFERRED, WHAT HAPPENS
  -----------------------------|---------------------------
  What does empty state look like? | Engineer ships "No items found."
  Mobile nav pattern?          | Desktop nav hides behind hamburger
  ...
```
Step 0.5 で視覚的なモックアップを生成した場合は、未解決の決定事項を提示するときに、それを証拠として参照してください。モックアップは決定を具体的にします。たとえば「承認済みのモックアップにはサイドバーのナビゲーションが示されているが、プランではモバイルでの挙動が指定されていない。375px でこのサイドバーはどうなるか?」のように示します。
決定ごとに AskUserQuestion を1回行い、推奨案、理由、代替案を示す。決定がなされるたびにプランを編集する。
**STOP.** 各回答を待ってから、編集や次に進むことをしないこと。未回答の決定は未解決として記録する。

### パス後: モックアップの更新(生成された場合)

パス7の後、該当する場合はモックアップの更新を以下のとおり提案し、保留中の TODO 提案を解決し、承認内容を照合し、そのうえでタスクと完了サマリーをまとめてください。

Step 0.5 でモックアップを生成し、レビューのパスによって重要なデザイン上の決定(情報アーキテクチャの再構成、新しい状態、レイアウトの変更)が変わった場合は、モックアップの再生成を提案してください(1回限りで、ループはしない):

AskUserQuestion: 「レビューのパスで[主要なデザイン変更の一覧]が変わりました。更新されたプランを反映するためにモックアップを再生成しますか? これにより、視覚的な参照が実際に作ろうとしているものと一致します。」

はいの場合は、変更内容をまとめたフィードバックとともに `$D iterate` を使うか、更新されたブリーフとともに `$D variants` を使ってください。どちらのテキストも、ブリーフまたはフィードバックのファイルに入れ、インラインに書かないこと。`$_DESIGN_DIR` の同じディレクトリに保存してください。何も上書きされないので、ラウンドの管理を行い、表示されたパスを新しいボード(ボードのブロックで再構築し、`board-images.json` を書き直す)や確認に引き継いでください。

## 質問の仕方
上記のプリアンブルにある AskUserQuestion の形式に従ってください。プランのデザインレビュー向けの追加ルールは以下のとおりです:
* **指摘1件 = AskUserQuestion 1回。** 1回の質問で複数の指摘をまとめないこと。各呼び出しには必ず1つの質問だけを含めます。1回の呼び出しで複数の質問タブを使うことも、まとめて聞くことになります。ユーザーが一方の修正を選んでも他方を選ぶ必要がない場合は、同じコンポーネントやトークンファイルに影響していても、別々に質問してください。実装の作業を共有していても、独立したデザイン上の選択が切り離せなくなるわけではありません。
* デザイン上のギャップを具体的に説明する。何が欠けていて、それが指定されないとユーザーがどんな体験をするのかを示す。
* 2〜3個の選択肢を提示する。各選択肢について、今指定する場合の工数と、先送りした場合のリスクを示す。
* **上記のデザイン原則に対応づける。** 推奨案を、特定の原則に結びつける文を1つ添える。
* 指摘の番号と選択肢の文字でラベルを付ける(例: 「3A」「3B」)。
* **指摘事項ゼロ:** あるセクションに指摘事項がなければ、「指摘なし、次に進みます」と述べてから進む。そうでなければ、ギャップごとに AskUserQuestion を使う。「明らかな修正」があるギャップでも、それはギャップであり、変更をプランに反映する前にユーザーの承認が必要です。
* **AskUserQuestion を使って、ユーザーがどのバリアントを好むかを尋ねないこと。** 必ず先に比較ボードを作成し(`$D compare --serve`)、ブラウザで開いてください。ボードには評価のコントロール、コメント、リミックス/再生成ボタン、構造化されたフィードバック出力があります。AskUserQuestion は、ボードが開いていることを伝え、ユーザーの完了を待つためだけに使ってください。バリアントをインラインで提示して「どちらがお好みですか?」と尋ねるために使わないこと。それは体験の劣化です。

## 必須の成果物

### 「スコープ外」セクション
検討したうえで明示的に先送りしたデザイン上の決定。それぞれ一行の理由を付ける。

### 「既存のもの」セクション
プランが再利用すべき既存の DESIGN.md、UI パターン、コンポーネント。

### TODOS.md の更新
承認された修正の実装と検証は、プランのタスクに入れてください。スコープ内の検証をオプションの後続作業にしないこと。先送りする TODO の提案は、未解決やスコープ外の負債、または新しいスコープの決定やトレードオフのためだけに残してください。パスが終わったら、そのような TODO のそれぞれについて個別に質問し、まとめて聞かないこと。ユーザーが明示的に先送りした内容は尊重する。残っていなければ、その旨を伝えてください。

デザインの負債の場合は、a11y の欠落、未解決のレスポンシブ挙動、先送りされた空の状態などです。各 TODO には以下を付ける:
* **What:** 作業内容を一行で説明する。
* **Why:** 解決する具体的な問題、または得られる価値。
* **Pros:** この作業をすることで得られるもの。
* **Cons:** この作業のコスト、複雑さ、リスク。
* **Context:** 3か月後にこれを引き継いだ人が動機を理解できるだけの詳細。
* **Depends on / blocked by:** 前提条件があれば記載する。

そのうえで選択肢を提示する: **A)** TODOS.md に追加 **B)** スキップ — それほど価値がない **C)** 先送りせず、この PR で今すぐ作る

タスクや完了サマリーをまとめる前に、`~/.claude/skills/gstack/plan-design-review/SKILL.md` の「セクションの自己チェック」にある承認の照合を行ってください(文脈にない場合は Read する)。合意された実装作業だけを書き出し、承認されていない修正は未解決の指摘として保留してください。
「決定事項」とレビューログに数えるのは、個別に承認された新しい決定だけです。提案された修正や次のステップへの回答は0件として数えます。

## Implementation Tasks(実装タスク)

このレビューを終える前に、上記の発見事項を、構築に着手できるタスクのフラットなリストにまとめます。
各タスクは特定の発見事項から導きます。水増しはしません。
markdown セクションを出力し、さらに `/autoplan` がフェーズをまたいで
集約できる JSONL アーティファクトを書き込みます。

### markdown セクション(常に出力)

```markdown
## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — <component> — <imperative title>
  - Surfaced by: <section name> — <specific finding text or line reference>
  - Files: <paths to touch>
  - Verify: <test command or manual check>
- [ ] **T2 (P2, human: ~30min / CC: ~5min)** — ...
```

ルール:
- P1 は出荷をブロックします。P2 は同じブランチで取り込むべきです。P3 はフォローアップの TODO です。
- 発見事項から実行可能なタスクが生まれなかった場合は、でっち上げないでください。
- セクションの発見事項がゼロだった場合は、次を出力します: `_No new tasks from <section>._`
- 人間チームと CC+gstack の工数見積もりの両方を示します。タスク種別ごとの既定の比率(人間 ÷ CC の時間): スキャフォールディング ~100x、テスト ~50x、機能 ~30x、リグレッションテスト付きバグ修正 ~20x、アーキテクチャ ~5x、リサーチ ~3x。実際の作業に合わせて調整し、前提を明記してください。

### JSONL の成果物(タスクがゼロでも常に書き込む)

`/autoplan` はこのファイルを読んでフェーズをまたいで集約します。各行は
`jq -nc` で組み立て、引用符・改行・バックスラッシュを含むタイトルや元の発見事項も
正しくシリアライズされるようにします。手書きの `echo` / `printf` は決して使わないでください。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
TASKS_DIR="$GSTACK_STATE_ROOT/projects/${SLUG:-unknown}"
mkdir -p "$TASKS_DIR"
TASKS_FILE="$TASKS_DIR/tasks-design-review-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
# The task record keeps the raw git branch; artifact filenames keep gstack-slug's sanitized BRANCH.
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# このレビューで特定したタスク 1 件につき jq 呼び出しを 1 回繰り返します。
# プレースホルダーは、タスクごとに設定するシェル変数で置き換えます:
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \
  --arg phase 'design-review' \
  --arg run_id "$RUN_ID" \
  --arg branch "$GIT_BRANCH" \
  --arg commit "$COMMIT" \
  --arg id "$TASK_ID" \
  --arg priority "$PRIORITY" \
  --arg component "$COMPONENT" \
  --arg effort_human "$EFFORT_HUMAN" \
  --arg effort_cc "$EFFORT_CC" \
  --arg title "$TITLE" \
  --arg source_finding "$SOURCE_FINDING" \
  --argjson files "$FILES_JSON" \
  '{phase:$phase, run_id:$run_id, branch:$branch, commit:$commit, id:$id, priority:$priority, component:$component, files:$files, effort_human:$effort_human, effort_cc:$effort_cc, title:$title, source_finding:$source_finding}' \
  >> "$TASKS_FILE"
```

`jq` がインストールされていない場合は、JSONL の書き込みをスキップし、
autoplan の集約のために jq をインストールするようユーザーに警告します。JSONL を手書きしてはいけません。

このレビューでタスクが 1 件も特定されなかった場合でも、JSONL ファイルを touch します
(`: > "$TASKS_FILE"`)。これにより、集約処理はこのフェーズが今回の実行で出力を生成したことを認識できます
(空のファイルは「実行したが発見事項なし」を意味し、「未実行」とは区別されます)。


### 完了サマリー
これを保存されるレビューのために準備してください。完了の宣言は、以下の読み返しゲートの後に行います。
プランファイルでは、これを独立した `## Design Review Completion Summary` セクションとして書いてください(ボックス、先送りの一覧、以下の未解決の決定事項を含む)。終端の `## GSTACK REVIEW REPORT` の上に置き、このレビューで以前に書いたものは置き換えます。レポートの中には決して書かないこと。次のプランレビューがその見出しの下にあるすべてを削除して再生成するためです。

**総合デザインスコア:** 承認された修正の前後それぞれについて、評価したパス(1〜6)の6つのスコアのうち最も低いものを使う。パス7は採点しない。Step 0 の初期印象は、独自の行に残す。総合スコアが 8 以上というのは、評価したすべてのパスが 8 以上であることを意味します。未解決の指摘がある限り、クリーンなレビューログにはできません。

```
  +====================================================================+
  |         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
  +====================================================================+
  | System Audit         | [DESIGN.md status, UI scope]                |
  | Step 0               | [initial rating, focus areas]               |
  | Pass 1  (Info Arch)  | ___/10 → ___/10 after fixes                |
  | Pass 2  (States)     | ___/10 → ___/10 after fixes                |
  | Pass 3  (Journey)    | ___/10 → ___/10 after fixes                |
  | Pass 4  (AI Slop)    | ___/10 → ___/10 after fixes                |
  | Pass 5  (Design Sys) | ___/10 → ___/10 after fixes                |
  | Pass 6  (Responsive) | ___/10 → ___/10 after fixes                |
  | Pass 7  (Decisions)  | ___ resolved, ___ deferred                 |
  +--------------------------------------------------------------------+
  | NOT in scope         | written (___ items)                         |
  | What already exists  | written                                     |
  | TODOS.md updates     | ___ items proposed                          |
  | Approved Mockups     | ___ generated, ___ approved                  |
  | Decisions made       | ___ added to plan                           |
  | Decisions deferred   | ___ (listed below)                          |
  | Overall design score | ___/10 → ___/10                             |
  +====================================================================+
```

読み返しの後、すべてのパスが 8 以上であれば: 「プランはデザインとして完成しています。実装後に /design-review を実行してビジュアル QA を行ってください。」
8 未満のパスがあれば: 何が未解決で、なぜかを記載する(ユーザーが先送りを選んだ場合)。

### 未解決の決定事項
未解決の指摘をすべてここに記載する。まだ質問していない指摘や、未回答の AskUserQuestion も含める。選択肢を黙ってデフォルトにしないこと。

### 承認済みモックアップ

このレビューで視覚的なモックアップを生成した場合は、プランファイルに以下を追加する:

```
## Approved Mockups

| Screen/Section | Mockup Path | Direction | Notes |
|----------------|-------------|-----------|-------|
| [screen name]  | [absolute $_DESIGN_DIR]/[filename].png | [brief description] | [constraints from review] |
```

承認された各モックアップ(ユーザーが選んだバリアント)の完全なパス、方向性の一行説明、制約を含めてください。実装者はこれを読んで、どの視覚資料を基に作ればよいかを正確に把握します。これらは会話やワークスペースをまたいで保持されます。モックアップを生成していない場合は、このセクションを省略してください。

## Plan File Review Report(プランファイルのレビューレポート)

ログの記録や完了の通知の前に、承認済みのプラン変更と、下のレポートを含むレビュー出力の全体を保存してください。

### プランファイルを検出する

明示的に指定された出力/レポートファイルを最優先で使います。なければ、ユーザーが示したレビュー対象のプラン、次にホストのアクティブなプランを使います。対象のファイルがなければ、このセクションはスキップします。ファイルのない通常のレビューのログ記録は、そのまま適用されます。

### レポートを生成する

`~/.claude/skills/gstack/bin/gstack-review-read` を実行して、過去のレビューのエントリを取得します。
このレビューのステータスと指摘には、現在の Completion Summary or DX Scorecard を使います。
下のレビューログのフィールド規則を適用し、過去の実行回数にちょうど 1 を加えてください。
レポートを埋めるために、この実行を事前にログへ記録してはいけません。
ほかのレビューには過去のエントリを使い、そのステータス、出典、鮮度を保持します。

各 JSONL エントリは、記録された来歴に従って解釈します。過去の source "claude" はネイティブの Claude サブエージェント、"claude-code" は外部 CLI です。過去の codex の識別子はそのまま保持し、古いレコードを現在のハーネスで付け替えてはいけません。モデルの識別が不明なものは不明のままにします。新しいレコードでは、host、outside_provider、outside_status、phase を表示します。外部カバレッジを成立させるのは、完了した外部レコードだけです。ネイティブへのフォールバックは成立させません。

スキルごとに記録されるフィールドは異なります:

- **plan-ceo-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`mode\`, \`scope_proposed\`, \`scope_accepted\`, \`scope_deferred\`, \`commit\`
  → Findings 列: "{scope_proposed} proposals, {scope_accepted} accepted, {scope_deferred} deferred"
  → scope 系のフィールドが 0 または欠けている場合(HOLD/REDUCTION モード): "mode: {mode}, {critical_gaps} critical gaps"
- **plan-eng-review**: \`status\`, \`unresolved\`, \`critical_gaps\`, \`issues_found\`, \`mode\`, \`commit\`
  → Findings 列: "{issues_found} issues, {critical_gaps} critical gaps"
- **plan-design-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`unresolved\`, \`decisions_made\`, \`commit\`
  → Findings 列: "score: {initial_score}/10 → {overall_score}/10, {decisions_made} decisions"
- **plan-devex-review**: \`status\`, \`initial_score\`, \`overall_score\`, \`product_type\`, \`tthw_current\`, \`tthw_target\`, \`mode\`, \`persona\`, \`competitive_tier\`, \`unresolved\`, \`commit\`
  → Findings 列: "score: {initial_score}/10 → {overall_score}/10, TTHW: {tthw_current} → {tthw_target}"
- **devex-review**: \`status\`, \`overall_score\`, \`product_type\`, \`tthw_measured\`, \`dimensions_tested\`, \`dimensions_inferred\`, \`boomerang\`, \`commit\`
  → Findings 列: "score: {overall_score}/10, TTHW: {tthw_measured}, {dimensions_tested} tested/{dimensions_inferred} inferred"
- **codex-review**: \`status\`, \`gate\`, \`findings\`, \`findings_fixed\`
  → Findings 列: "{findings} findings, {findings_fixed}/{findings} fixed"

現在の行と、その後のログは、同じ保存済みレビューを表していなければなりません。

次の Markdown の表を作成します:

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | {runs} | {status} | {findings} |
| Outside Review | {recorded provider and trigger} | Independent 2nd opinion | {runs} | {outside_status} | {findings} |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | {runs} | {status} | {findings} |
| Design Review | \`/plan-design-review\` | UI/UX gaps | {runs} | {status} | {findings} |
| DX Review | \`/plan-devex-review\` | Developer experience gaps | {runs} | {status} | {findings} |
\`\`\`

表の下に、次の行を追加します。**OUTSIDE COVERAGE** と **CROSS-MODEL** は条件付きです。
フェーズが実行された、無効化/スキップ/利用不可だった、または指摘がある場合は含めます。
該当するフェーズがまったくない場合に限り省略します。**VERDICT** は常に含めます:

- **OUTSIDE COVERAGE:** プロバイダー、フェーズ、完了状態、指摘。利用不可、無効化、スキップされたフェーズも含めます。別のフェーズから完了を推測してはいけません。
- **CROSS-MODEL:** ネイティブと、完了した外部レビューの両方がある場合のみ。記録されたプロバイダーと、判明しているモデルの識別に基づく重複の分析です。ハーネス名から別々のモデルファミリーだと推測してはいけません。
- **VERDICT:** CLEAR のレビューを列挙します(例: "CEO + ENG CLEARED — ready to implement")。
  Eng Review が CLEAR ではなく、グローバルにスキップもされていない場合は、"eng review required" を付け加えます。

**未解決の決定事項のステータス(必須 — 省略不可。レポートの空白を除く最後の行)。**
VERDICT の後で、レポート(\`## GSTACK REVIEW REPORT\` 見出しの下の内容。
太字のラベルであり、新しい \`## \` 見出しにはしません。「空なら省略」の規則の対象外)を、
次のどちらか 1 つだけで終えます。太字にしない \`NO UNRESOLVED DECISIONS\` の 1 行そのもの
(太字にしたものは認められません)、または \`**UNRESOLVED DECISIONS:**\` のヘッダーと、未解決項目ごとに 1 つの箇条書きです
(最後の箇条書きが最終行。\`+ N unresolved from prior reviews\` を足すのは N > 0 のときだけ)。
二重に数えないための手順です。このレビューの未解決項目は文脈から列挙し、過去のレビューについては
現在のスキルの行を除外したうえで、スキルごとの最新で有効な行(ダッシュボードの 7 日間のウィンドウ)の
\`unresolved\` を合計します。両方が 0 のときだけ、定型の行を出力します。

### プランファイルに書き込む

**PLAN MODE EXCEPTION — ALWAYS RUN:** 承認済みの変更だけを適用した、レビュー済みの完全なプランとレポートを保存します。未解決の選択肢は保留のままにします。

レポートは常にプランファイルの最後のセクションでなければなりません。途中に置いてはいけません。
削除してから追記する、単一の手順を使います:

1. 既存のプラン/レポートがあれば Read します。その内容を保持し、
   承認済みの変更だけを適用して、レビュー出力の全体を含めます。既存の
   `## GSTACK REVIEW REPORT` セクションを探します。
2. 見つかった場合は、Edit ツールで既存のセクション全体を削除します。\`## GSTACK REVIEW REPORT\` から、
   次の \`## \` 見出しまたはファイル末尾のうち先に来るほうまでを対象にし、
   空文字列に置き換えます。セクションが今どこにあっても同じです。途中にあるセクションの削除は
   特別な例外ではなく、意図した動作です。Edit が失敗した場合(たとえば同時編集で
   内容が変わった場合)は、プランファイルを読み直して 1 回だけ再試行します。
3. レポートを削除した場合は、更新後のファイルを Read します。新しい
   \`## GSTACK REVIEW REPORT\` をファイル末尾に追記します。直近の Read で確認した末尾に
   合わせて Edit するか、レポートを最後に置いた完全なファイルを Write します。 以前のレポートがあったかどうかにかかわらず、追記します。
   後ろにほかのセクションが続く場合、"Unresolved Decisions" はファイル末尾の目印ではありません。
4. **Read-back gate:** 保存したファイルを Read します。承認済みの変更、レビュー出力の全体、現在のレビューの行、
   判定、最後の未解決の決定事項のステータスを確認し、
   `## GSTACK REVIEW REPORT` が最後のセクションであることを検証します。書き込みまたは検証に失敗した場合は、
   エラーを報告し、レビューログや決定事項のログ記録の前に停止します。

セクションをその場で置き換えてはいけません。削除してから、新しいレポートをファイル末尾に追記します。
そうすれば、レビューレポートが常にプランの最後のセクションになります。

## レビューログ

プラン/レポートのファイルがスコープに入っている場合は、上記の正常な書き込みと読み返しの後にのみ保存してください。失敗した場合はエラーを報告して停止し、完了や承認された決定を記録しないでください。
**PLAN MODE EXCEPTION — 検証後に必ず実行:** これらのコマンドはレビューのメタデータを `~/.gstack/` に書き込みます。後続のダッシュボードは、保存された結果を読み取ります。

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-design-review","timestamp":"TIMESTAMP","status":"STATUS","initial_score":N,"overall_score":N,"unresolved":N,"decisions_made":N,"commit":"COMMIT"}'
```

完了サマリーの値で置き換えてください:
- **TIMESTAMP**: 現在の ISO 8601 形式の日時
- **STATUS**: 総合スコアが 8 以上かつ未解決が 0 件なら "clean"、それ以外は "issues_open"
- **initial_score**: 修正前の総合デザインスコア(0〜10)
- **overall_score**: 修正後の最終的な総合デザインスコア(0〜10)
- **unresolved**: 未解決のデザイン上の決定の件数
- **decisions_made**: プランに追加されたデザイン上の決定の件数
- **COMMIT**: `git rev-parse --short HEAD` の出力

## Review Readiness Dashboard(レビュー準備状況のダッシュボード)

レビューの完了後に、レビューログと設定を読み、ダッシュボードを表示します。

```bash
~/.claude/skills/gstack/bin/gstack-review-read
```

**1. 表示するレコードを選びます。** 下の各行について、最新のレコードを使います。
7 日より古いレコードで行を CLEAR にしてはいけません。また、新しい失敗を古い成功で
置き換えてもいけません。Ship のメトリクスはレビューレコードではありません。

| 行 | 最新を選ぶ対象 | ステータスの接尾辞 |
|---|---|---|
| Eng Review | `review` or `plan-eng-review` | (DIFF) or (PLAN) |
| CEO Review | `plan-ceo-review` | — |
| Design Review | `plan-design-review` or `design-review-lite` | (FULL) or (LITE) |
| Adversarial | `adversarial-review` or legacy `codex-review` | — |
| Outside Voice | `codex-plan-review` from CEO or Eng review | — |

各レコードの host、source、outside_provider、outside_status、phase を保持してください。
過去の source "claude" はネイティブのサブエージェント、"claude-code" は外部 CLI です。
古いプロバイダーや不明なモデルを、現在のハーネスから推測してはいけません。ネイティブの結果で、
欠落している、無効化された、またはスキップされた外部カバレッジを埋めることはできません。

**出典の明示:** 記録された `via` を接尾辞に付けます("CLEAR (PLAN via
/autoplan)")。`via` がなければ "CLEAR (PLAN)" または "CLEAR (DIFF)" のままにします。ダッシュボードの下に、`autoplan-voices`
と `design-outside-voices` をワークフロー実行とフェーズごとにまとめます。各フェーズの
プロバイダーと outside_status を表示し、部分的なカバレッジも残してください。これらの詳細で Eng Review が CLEAR になることはありません。

**2. 判定を選ぶ前に、鮮度を確認します。**

- **内容優先のルール:** `review`、`adversarial-review`、`codex-review`、
  ship 段階のレビュー、`design-review-lite` では、`review_freshness.status`
  を使い、その `reason` を表示します。CURRENT とは、開始時と終了時の内容フィンガープリントが
  現在の `---WTREE---` フィンガープリントと一致する、完了したクリーンなレビューのことです。
  STALE または UNVERIFIED では Eng Review を CLEAR にできません。`review_freshness` がない場合は
  (ログのみの旧レコードを含む)UNVERIFIED です。差分の証拠について、HEAD の一致や
  コミット距離にフォールバックしてはいけません(コミット数が 0 でも同じです)。
  記録されたサイクル、completed/converged フィールド、欠落している source/phase の
  カバレッジを表示してください。カバレッジが不明な場合は合格ではありません。
- **プランレコード**(plan-ceo-review、plan-eng-review、plan-design-review、
  codex-plan-review)は、作業ツリーのフィンガープリントではなく 7 日間のウィンドウを使います。
  `plan_sha256` があれば、プランファイルと比較して不一致を報告してかまいません。
  記録されたコミットを `---HEAD---` と比較し、異なる場合は
  `git rev-list --count STORED_COMMIT..HEAD` を実行して、
  "Note: {skill} review from {date} may be stale — {N} commits since review" と報告します。
  コマンドが失敗した場合は UNKNOWN として、古いものとして扱います。コミットを追跡していない場合は、
  再実行を提案してください。すべてのレビューが最新なら、注記は省略します。

**3. 履歴上の判定を選びます。** CLEARED になるのは、選んだ Eng Review が
`clean` で、7 日以内で、ステップ 2 の鮮度を満たす場合だけです。それ以外は NOT CLEARED と報告し、
欠落、古さ、または未解決の課題という理由を添えます。 `skip_eng_review` が true の場合は、
Eng Review に "SKIPPED (global)" を、このダッシュボードに CLEARED を表示します。
Eng Review はデフォルトで必須です。`gstack-config set skip_eng_review true` でこの要件を無効にできます。

ほかの行は文脈を示すもので、Eng Review の代わりにはなりません:
- CEO Review を勧めるのは、プロダクトやビジネス、スコープに関する判断のときです。定型的な修正やクリーンアップでは勧めません。
- Design Review を勧めるのは、UI/UX の作業のときです。バックエンド、インフラ、プロンプトのみの作業では勧めません。
- Adversarial レビューには、必ずネイティブのパスが含まれます。利用可能で有効な外部の
  チャレンジはそれを補います。200 行以上の差分には、構造化された P1 ゲートも適用されます。
- Outside Voice は、CEO/Eng レビューの後にデフォルトで有効になるプランレビューです。`codex_reviews`
  でその追加ステップを無効にできます。プロバイダーが失敗した場合はネイティブにフォールバックし、
  外部カバレッジの欠落を記録します。このダッシュボードの行が出荷をブロックすることはありません。

**4. ダッシュボードを表示します。** 欠落、古い、無効化された、利用できない結果は、
CLEAR としてではなく、そのとおりに明示してください。最新の `clean` は CLEAR、
`issues_open` は ISSUES OPEN と表示し、保存されているステータスは変更しません。

```
+====================================================================+
|                    REVIEW READINESS DASHBOARD                       |
+====================================================================+
| Review          | Runs | Last Run            | Status    | Required |
|-----------------|------|---------------------|-----------|----------|
| Eng Review      |  1   | 2026-03-16 15:00    | CLEAR     | YES      |
| CEO Review      |  0   | —                   | —         | no       |
| Design Review   |  0   | —                   | —         | no       |
| Adversarial     |  0   | —                   | —         | no       |
| Outside Voice   |  0   | —                   | —         | no       |
+--------------------------------------------------------------------+
| VERDICT: CLEARED — Eng Review passed                                |
+====================================================================+
```

## Capture Learnings(学びの記録)

このセッション中に、自明ではないパターン、落とし穴、アーキテクチャ上の知見を発見した場合は、
今後のセッションのために記録します:

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"plan-design-review","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
```

**Types:** `pattern`(再利用できるアプローチ)、`pitfall`(やってはいけないこと)、`preference`
(ユーザーが述べたもの)、`architecture`(構造上の決定)、`tool`(ライブラリ/フレームワークの知見)、
`operational`(プロジェクト環境/CLI/ワークフローの知識)。

**Sources:** `observed`(コード内で見つけた)、`user-stated`(ユーザーが伝えた)、
`inferred`(AI の推論)、`cross-model`(Claude と Codex の両方が一致)。

**Confidence:** 1〜10。正直に付けます。コードで検証した観察済みのパターンは 8〜9 です。
確信のない推論は 4〜5 です。ユーザーが明示的に述べた好みは 10 です。

**files:** この学びが参照している具体的なファイルパスを含めます。これにより
陳腐化の検出が可能になります。それらのファイルが後で削除された場合、その学びにフラグを立てられます。

**本当の発見だけを記録します。** 自明なことは記録しません。ユーザーがすでに知っていることも
記録しません。良い判断基準は、この知見が今後のセッションで時間の節約になるかどうかです。なるなら記録します。



## Brain Calibration Write-Back (gated)(brain キャリブレーションの書き戻し、ゲート付き)

`BRAIN_CALIBRATION_WRITEBACK` が設定され、かつプリアンブル/brain-health の
出力または gstack の設定に `brain_trust_policy@<endpoint-hash>=personal` が示されている場合を除き、スキップします。
不明な場合はスキップします。両方のゲートを通過した場合は、永続的な
型付きの予測を 1 つ `mcp__gbrain__takes_add` で記録します。利用できない場合は、
gstack:takes フェンスブロックを付けて `mcp__gbrain__put_page` を使います。

Take の frontmatter:
```yaml
kind: bet
holder: <user identity from whoami>
claim: <one-line prediction the skill is making>
weight: 0.5
since_date: <today's date>
expected_resolution: <date in 1-3 months depending on skill>
source_skill: plan-design-review
```

書き込み後、影響を受けるダイジェストを無効化します:

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || true
  ~/.claude/skills/gstack/bin/gstack-brain-cache invalidate brand --project "$SLUG" 2>/dev/null || true
```

## Brain Cache Background Refresh(brain キャッシュのバックグラウンド更新)

スキルの作業が完了し(テレメトリが記録された後)、TTL に近づいているキャッシュダイジェストの
バックグラウンド更新を起動します。
これはノンブロッキングで、ユーザーは待ちません。次回の呼び出しでは、
ウォームなキャッシュの恩恵を受けられます。

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null) || true
(~/.claude/skills/gstack/bin/gstack-brain-cache refresh --project "$SLUG" 2>/dev/null &) || true
```


## 次のステップ — レビューの連鎖

レビューの準備状況ダッシュボードを表示した後、このデザインレビューで判明したことに基づいて、次に行うべきレビューを推奨してください。ダッシュボードの出力を読み、どのレビューが既に実行されていて、どれが古くなっているかを確認します。

**全体で eng レビューがスキップされていなければ /plan-eng-review を推奨する。** ダッシュボードの出力で `skip_eng_review` を確認してください。`true` の場合は eng レビューがオプトアウトされているので、推奨しないこと。それ以外の場合、eng レビューは必須の出荷ゲートです。このデザインレビューで重要な操作仕様、新しいユーザーフローが追加されたり、情報アーキテクチャが変わったりした場合は、eng レビューがアーキテクチャ上の影響を検証する必要があることを強調してください。eng レビューが既にあるが、そのコミットハッシュがこのデザインレビューより前のものを示している場合は、古くなっている可能性があり、再実行すべきだと伝えてください。

**/plan-ceo-review を推奨することを検討する** — ただし、このデザインレビューで製品の方向性に関する根本的なギャップが明らかになった場合に限ります。具体的には、総合デザインスコアが 4/10 を下回って始まった場合、情報アーキテクチャに大きな構造上の問題があった場合、またはレビューによって正しい課題を解決しているのかという疑問が浮上した場合です。かつ、ダッシュボードに CEO レビューが存在しないこと。これは選択的な推奨です。ほとんどのデザインレビューでは CEO レビューを推奨すべきではありません。

**両方が必要な場合は、eng レビューを先に推奨してください**(必須のゲート)。

**デザイン探索スキルが適切な場合は推奨する** — /design-shotgun と /design-html は、アプリケーションのコードではなく、デザインの成果物(モックアップ、HTML プレビュー)を生成します。プランモードでレビューと並べて使うものです。このデザインレビューで、新しい方向性を探ると役立つ視覚的な問題が見つかった場合は /design-shotgun を推奨してください。承認済みのモックアップがあり、それを動作する HTML にする必要がある場合は /design-html を推奨してください。

次のステップを提示するには AskUserQuestion を使ってください。常に手動/停止の選択肢 E を含め、該当するフォローアップのスキルだけを提示します。ユーザーが手動を選んだ場合は、別のスキルを開始せずに終了してください:
- **A)** 次に /plan-eng-review を実行する(必須のゲート)
- **B)** /plan-ceo-review を実行する(製品の根本的なギャップが見つかった場合のみ)
- **C)** /design-shotgun を実行する — 見つかった問題に対するビジュアルデザインのバリアントを探索する
- **D)** /design-html を実行する — 承認済みのモックアップから Pretext ネイティブの HTML を生成する
- **E)** スキップ — 次のステップは自分で対応します

## フォーマットのルール
* 指摘は番号(1, 2, 3...)、選択肢は文字(A, B, C...)で示す。
* 番号と文字でラベルを付ける(例: 「3A」「3B」)。
* 選択肢の説明は最大1文。
* 未解決の指摘ごとに一時停止する。パスに指摘がなければその旨を伝えて続行し、質問を作り出さないこと。
* 比較しやすいよう、各パスの前後でスコアを評価する。
