<!-- AUTO-GENERATED from proposal-and-preview.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
<!-- The font-selection procedure and the three-looks calibration in this section are derived from pbakaus/impeccable reference/new-work.md (Apache-2.0), rewritten and modified. See NOTICE.md. -->
## Phase 3: 完全な提案

このセクションを全文読んでから、そのデザインとフォントのルールを適用し → 独立に下書きを作り → 外部の意見を提示し → Q2 のために統合してください。
プレビューと書き込みには、それぞれ後の承認が必要です。

### あなたのデザインの知識(提案に反映させるために使う。表として表示しないこと)

**キャリブレーション: 三つの見た目。** 予測しやすい構成は避けてください。クリーム色/セリフ/テラコッタ、ほぼ黒/ネオン/光る縁、
または新聞風の細い罫線/イタリックのセリフ/小さく字間を空けたモノスペース、の三つです。ブリーフが特に求めている場合にのみ、そのいずれかを使ってください。
それ以外の場合は、カテゴリの固定観念やその明白な逆ではなく、これらのユーザーに根ざした方向性を選んでください。例えば、書籍のプロダクトなら、
クリーム色とセリフをデフォルトにするのではなく、本のジャケットや布地から色を引き出すことができます。

**デザインの方向性**(プロダクトに合うものを一つ選ぶ):
- Brutally Minimal — 文字と余白だけ。装飾なし。モダニズム。
- Maximalist Chaos — 密度が高く、層になっていて、パターンが多い。Y2K と現代の融合。
- Retro-Futuristic — ヴィンテージのテクノロジーへの郷愁。蛍光体のようなパレット、ビットマップの文字、データには暖かいモノスペース(グローの光彩や方眼紙の背景は使わない)。
- Luxury/Refined — セリフ、高いコントラスト、ゆったりした余白、貴金属。
- Playful/Toy-like — 角が丸く、弾むような動き(オーバーシュートなし)、力強い基本色。親しみやすく楽しい。
- Editorial/Magazine — 強いタイポグラフィの階層、非対称のグリッド、引用の強調。
- Brutalist/Raw — 構造をむき出しにし、実用的なグロテスク体を一つ使い、グリッドを見せ、仕上げを施さない(ユーザーが名指しで求めた場合にのみシステムのスタックを使う)。
- Art Deco — 幾何学的な精密さ、金属のアクセント、左右対称、装飾的な枠。
- Organic/Natural — アースカラー、丸みのある形、手描きの質感、粒子感。
- Industrial/Utilitarian — 機能が第一、データが密、モノスペースのアクセント、抑えたパレット。

**装飾のレベル:** minimal(タイポグラフィがすべての仕事をする)/ intentional(控えめなテクスチャ、粒子、背景の処理)/ expressive(創造的な方向性を全面的に、層になった奥行き、パターン)

**レイアウトのアプローチ:** grid-disciplined(厳格な列、予測可能な配置)/ creative-editorial(非対称、重なり、グリッドを破る)/ hybrid(アプリはグリッド、マーケティングは創造的)

**カラーのアプローチ:** Restrained(アクセント 1 色 + ニュートラル。色は稀で意味を持つ)/ Committed(一つの色相がページを支配し、ニュートラルはそこから導く)/ Full palette(階層のためのプライマリ、セカンダリ、意味の色)/ Drenched(デザインの主要な道具として色を使い、サーフェスが色を担う)

**モーションのアプローチ:** minimal-functional(理解を助けるトランジションだけ)/ intentional(控えめな登場アニメーション、意味のある状態遷移)/ expressive(完全な振り付け、スクロール連動、遊び心)

**フェイスの選び方: メニューではなく手順。** (1) 対象の世界(読む出版物、表記、アイデンティティや対象物)と、モードを明示します: Persuade(マーケティング)、Operate(タスク)、Read(長文コンテンツ)、Experience(没入型)。そのトーンに合わせます。
(2) display/body/label/mono の各役割について、フェイスを三つ候補に絞ります。(3) 役割の除外を適用します。(4) 提案する各ファミリーについて、WebSearch や Aside で公式の Google Fonts/Fontshare の掲載を確認し、正確な名称、必要なウェイト、ライセンス、読み込み URL を確かめます。ローカルのフェイスの場合は、ファイルとライセンスを確認します。確認できないフェイスは省略します。
(5) 検証した読み込み元と方式を指定します。

**フォント検証のフォールバック:** 競合調査を飛ばしても、フォントの検証は免除されません。オフラインでは、ローカルのファイルとライセンスを確認します。
それ以外の場合は、役割、ウェイト、プロポーションを記述し、DESIGN.md でフォントの選択を「検証待ち」とマークします。パレットとレイアウトは続けます。フォントを検証できるまでプレビューを延期するか、ユーザーがスキップを望めばそれに従います。
フェイスや URL を捏造しないでください。

**Display として使われすぎ**(どのサーフェスでも、ディスプレイの声には決して使わない。下の body/UI の例外が唯一の例外です。ディテクターはその一部を `overused-font` としてフラグします): Inter, Roboto, Arial, Helvetica, Open Sans, Lato, Montserrat, Poppins, Space Grotesk, Space Mono, Fraunces, Playfair Display, Cormorant, Lora, Crimson, Newsreader, Syne, IBM Plex Sans, IBM Plex Serif, DM Sans, DM Serif, Outfit, Plus Jakarta Sans, Instrument Sans, Geist.

**提案がそう述べている場合、Operate または Read のサーフェスの body/UI としては問題なし:** DM Sans, Instrument Sans, IBM Plex Sans。**データとコード用のモノスペース:** JetBrains Mono, IBM Plex Mono, Fira Code。

**どの役割でも禁止:** Papyrus, Comic Sans, Lobster, Impact, Jokerman, Bleeding Cowboys, Permanent Marker, Bradley Hand, Brush Script, Hobo, Trajan, Raleway, Clash Display, Courier New.

**デフォルトのリストにない、自由に使える書体**(2026-09-08 に検証済み。セッション内で再検証します。オフラインの場合は font-verification fallback を参照): Satoshi, General Sans, Clash Grotesk, Cabinet Grotesk (Fontshare); Instrument Serif, Source Sans 3, JetBrains Mono, Fira Code (Google Fonts)。あえて短くしています。「良い」フォントの長いリストこそ、前回の収束が起きた原因です。

ユーザーがリストにある書体を名指しで求めた場合: それに従い、トレードオフを 1 回だけ述べます。

**同質化を避ける指示:** プロジェクトごとに、見た目、フェイス、パレットを変えてください。繰り返す場合は正当化してください。ライト/ダークは調整つまみの一つではありません。
利用シーン(誰が、どこで、どんな光の下で)が変わるまでそれに固定します。正当化されない同質化はスロップです。

**AI スロップのアンチパターン**(推奨事項には決して含めない):
- 紫・バイオレット・インディゴのグラデーション背景、または青から紫へのカラースキーム
- **3 カラムのフィーチャーグリッド(3-column feature grid):** 色付き円の中のアイコン + 太字のタイトル + 2 行の説明を、左右対称に 3 回繰り返す。AI が作るレイアウトとして最も見分けやすい型。
- セクションの飾りとして、色付きの円の中に置いたアイコン(SaaS スターターテンプレートの見た目)
- すべてを中央揃えにする(見出し・説明・カードのすべてに `text-align: center`)
- すべての要素に同じ丸い border-radius を付ける(どの要素にも同じ大きな角丸)
- 装飾的なブロブ、浮かぶ円、波形の SVG 区切り線(セクションが空に感じるなら、必要なのは装飾ではなく良いコンテンツ)
- 絵文字をデザイン要素として使う(見出しのロケット、箇条書きの絵文字)
- カード上の色付き左ボーダー(`border-left: 3px solid <accent>`)
- ありきたりなヒーローコピー(「Welcome to [X]」「Unlock the power of...」「Your all-in-one solution for...」)
- 型にはまったセクションのリズム(ヒーロー → 特徴 3 つ → お客様の声 → 料金 → CTA、どのセクションも同じ高さ)
- system-ui や `-apple-system` を主要な見出し/本文フォントにする。これは「タイポグラフィを諦めた」サインだ。ちゃんとした書体を選ぶ。
- 角丸カードの色付きの縁。サイドタブの着ぐるみ。状態は、背景の色味、アイコン、ラベルで伝える。
- 学習データのデフォルト書体を見出しの声に使うのは、探すのをやめたということ。Operate や Read の画面の本文や UI なら、この中のいくつかは問題ない。どれをなぜ使うかを述べる。
- 見出しが本文サイズから 1 段階以内しか離れていない。スケールを決め、レベルの差を太さだけにしない。
- 強調は太さかサイズで行う。グラデーション文字は、強調の着ぐるみ。
- クリーム色の地、セリフの見出し、テラコッタのアクセント。ルック 1 番。ブリーフが求めたなら問題ないが、求めていないならデフォルトの選択。
- カードの中のカードは常に間違い。カードは怠惰なコンテナで、入れ子にすればその二乗。
- アセットの代わりに、CSS の図形で組み立てたイラスト。アセットを用意するか、何も出さない。
- 暗い面の光る縁。ルック 2 番。奥行きにはオフセットがある。オフセットゼロの色付きハローは装飾。
- ヒーローコンテンツの背後にある放射状グラデーションのハロー。またルック 2 番。
- ページ上部を照らすスポットライトの光。ハローと同じ系統。
- 延々とスクロールするロゴの帯。ロゴが重要なら静止して見せ、重要でなければ削る。
- すべての見出しの上にある角丸四角のアイコン。横並びにするか、コンテナを外す。
- ルック 3 番。編集的な信頼感を狙うイタリックのセリフ見出し。内容で裏付けるか、見出しを立体(ローマン体)に戻す。
- ヒーローの見出しの上に浮かぶピル型のラベル。見出しは自分で重みを持つ。チップを削る。
- 見出しの上のキッカー(kicker)は、最も強いデフォルトだ。見出しは自分で重みを持つので、ラベルを消す。それでもユーザーが望むなら従い、トレードオフを一度だけ伝える。
- 「Seamless」「effortless」「supercharge」「streamline」など、何も説明しない言葉。製品が何をするかを書く。
- 短く。鋭く。断片的に。どの文もスローガン。人に何かを説明するように書く。
- ポスターではないページで、6rem を超える見出し。大きさは階層ではない。
- 「Built for the way you work」「Designed for teams like yours」「Meet your new...」。ローンチを説明せず、ローンチを演じるフレーズ。
- 主要な行動喚起(CTA)にグラデーションのボタンを使う。パレットが持つ単色 1 つにする。
- ありきたりなストックフォトのヒーロー、またはその代わりの灰色のプレースホルダー div。製品を見せるか、何も見せない。
- すべてのコンテナを、ドロップシャドウ付きの角丸カードにする。カードを積み重ねたアプリ UI はレイアウトではない。
- アバター、星 5 つ、誰も言っていない引用を並べたお客様の声。実名と実際の主張を載せるか、削る。
- 型どおりのヒーロー: 左に見出し、右にスクリーンショット、ボタン 2 つ。どのジェネレーターも最初に手を出すテンプレート。
- 「Get Started」と「Learn More」だけが行動喚起になっている。そのクリックで何が得られるかを書く。
- ヒーローの下に、大きな数字 3 つと小さなラベル(「10k+ users」「99.9%」)。数えているのはテンプレートで、製品ではない。
- 同じ形、同じアイコン枠、同じ 2 行のカードを並べたグリッド。重みの違う内容に、同じ大きさの箱を与えている。
- ぼかした背景のすりガラスパネルを既定の面にする。半透明の層は、奥行きを説明する場所に 1 枚だけ使い、どこにでも使わない。
- アートディレクションの代わりに、生成した SVG の落書きやマスコット。アセットを依頼またはライセンスするか、何も出さない。
- すべての二次操作をモーダルにする。インライン、サイドパネル、別ページのほうが、ユーザーの負担が小さいことが多い。
- コンテンツがあるべき場所を埋める、スパークライン、進捗リング、偽のアバター。実際のデータか、正直な空の状態を出す。
- 開発ツールだから暗く、ヘルスケアだから明るく、という選び方。ライトかダークかは、利用シーン(誰が、どこで、どんな光の下で使うか)で決める。
- ハッピーパスだけが設計されている。空、読み込み中、エラー、長いコンテンツの状態も、コンポーネントの一部。

### 一貫性の検証

どのオーバーライドのあとも、食い違いを穏やかに指摘し、代替案を提示してください。Brutalist/Minimal + expressive なモーション → 控えめなモーションにするか、意図的に維持する。
Drenched + minimal な装飾 → 装飾を補助的なものにする。editorial + 密なデータ → hybrid のレイアウト。決して作業を止めず、ユーザーの最終的な選択を受け入れて進めてください。

### 独立した提案、そして統合

ブリーフから自分の方向性を下書きします。どちらの意見を送る前にも、Q2 の見た目、パレット、役割ごとのタイポグラフィ、レイアウト、余白、モーション、そして意図的な二つのリスクを埋めてください。
その下書きは両方のレビュアーのプロンプトに含めないでください。自分の回答ではなく、同じブリーフを送ります。外部の意見は、ユーザーがオプトインしてからのみ実行します。`enabled` がその選択を記録し、
二回目のハーネスの確認が後の起動を守ります。

## Design Outside Voices(独立)

AskUserQuestion を使います:
> "外部のデザインボイスを取り入れますか? Codex は、独立したデザインの方向性を提案します。Claude のサブエージェントは、独立したデザインの方向性の提案を行います。"
>
> A) はい — 外部のデザインボイスを実行する
> B) いいえ — なしで進める

ユーザーが B を選んだ場合、後述のとおり辞退の結果を 1 件記録し、両方のボイスをスキップして、下書きのまま Q2 に進みます。

**承認された場合:** Phase 1 のプロダクトブリーフ(Phase 2 のリサーチの状況を含む)用に、プライベートファイルを作成します:
```bash
_DESIGN_BRIEF=$(mktemp "${TMPDIR:-/tmp}/gstack-design-brief-XXXXXXXX") || exit 1
printf 'DESIGN_BRIEF=%s\n' "$_DESIGN_BRIEF"
```
そのパスにプロダクトブリーフを書き込み、新しい Bash 呼び出しをまたいで絶対パスを覚えておきます。どちらのボイスもコンテキストを引き継ぎません。両方に同じブリーフを渡します。Codex 向けには、ブリーフの全内容を、後述のデザインの方向性の依頼とともに外部向けのプロンプトファイルに含め、呼び出しの中のリテラルの <prepared-prompt-file> を、そのシェルクォート済みの絶対パスに置き換えます。自分の下書きの方向性は、どちらのプロンプトにも入れません。ネイティブの Agent には、その絶対パス(Codex のプロンプトファイルではなく、プロダクトブリーフのパス)を渡します。ブリーフのテキストをシェルのソースに貼り付けてはいけません。

**Codex の利用可否を確認する:**
```bash

if ! _OUTSIDE_CFG=$("$HOME/.claude/skills/gstack/bin/gstack-config" get --stored codex_reviews) || [ "$_OUTSIDE_CFG" = disabled ]; then
  echo 'CODEX_MODE: disabled'
elif ( # GSTACK_ACTIVE_HOST names the harness, never the model.
if { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  echo 'Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage.' >&2
  if { [ -n "${CLAUDECODE:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = claude ]; } && { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
    echo 'Inherited harness markers conflict. Run setup --host <actual-harness> (claude or codex); do not guess a replacement provider.' >&2
  else
    echo 'Repair installed skills: run setup --host codex from your gstack checkout.' >&2
  fi
  exit 78
fi
); then
  if command -v codex >/dev/null 2>&1; then echo 'CODEX_MODE: ready'; else echo 'CODEX_MODE: not_installed'; fi
else
  echo 'CODEX_MODE: under_current_harness'
fi
```

従来からの `CODEX_MODE` 変数は、ここでは **Codex** の利用可否を表します。 `CODEX_MODE: disabled` または送信時の `consent_missing` 行: `codex_reviews` がオフ、または読み取れません。尋ねずに、`outside_status: disabled` を記録します。 認証と設定されたモデルの有効性は、実際の呼び出し時に確認されます。どちらも上書きしません。 CLI がない、または壊れている場合: Codex をインストールまたは修復してください。認証に失敗した場合: 次を実行してください: `codex login`. それ以外の場合は、この呼び出し元のオプトイン/スキップの選択に従います。 ready でない結果はすべて外部カバレッジの欠落です。呼び出し元の既存のフォールバックに従います。 別の外部プロバイダーで代用してはいけません。

`CODEX_MODE: disabled`、または CLI が ready でない場合: 修復の通知があれば保持し、ネイティブのボイスのみを使います。呼び出しは、起動の前に意図的にハーネスを再確認します。ネイティブが成功しても、外部のカバレッジの代わりにはなりません。

**ready の場合**は、両方のボイスを実行し、統合の前に両方を待ちます。サポートされていれば、
呼び出しを重ねてかまいません。ネイティブの呼び出しはブロッキングのままにします。

1. **Codex デザインボイス**(Bash 経由):
Prompt(ファイルパスだけでなく、実際の計画/プロダクト/フロントエンドのソースのコンテキストを含める):

"このプロダクトの文脈を踏まえて、デザインの方向性を一式提案してください:
- Visual thesis(視覚的な主張): ムード、素材感、エネルギーを 1 文で表す
- Typography(タイポグラフィ): display/body/UI の役割ごとに具体的なフォント名を挙げる(Inter/Roboto/Arial/システム既定は不可)。親が採用前にフォントの利用可否を確認する
- Color system(カラーシステム): 背景、サーフェス、主テキスト、補助テキスト、アクセントの hex 値と CSS 変数
- Layout(レイアウト): コンポーネント起点ではなく、構図起点。最初のビューポートは文書ではなくポスターとして設計する
- Differentiation(差別化): そのカテゴリの通例から意図的に外れる点を 2 つ
- Anti-slop(量産感の排除): 次のものを一切使わない: purple gradient palette, the 3-column feature grid, centered everything, decorative blobs and dividers, nested cards, kicker above heading, icon tile above every heading, dark-mode glow

意見をはっきり述べ、具体的に書き、ぼかさないでください。これはあなた自身のデザインの方向性です。責任を持って示してください。

最後は次の形式で締めてください: Recommendation: <direction> because <product-specific reason>."

実際のプラン/spec/ソースを含む **完全なプロンプトとコンテキスト** を、プライベートなファイルに書き込みます。そのファイルのシェルクォート済みパスを `<prepared-prompt-file>` に代入します。ユーザーのテキストをシェルのソースに埋め込んではいけません。Recommendation: <direction> because <product-specific reason> で終わる完全なデザイン提案を要求してください。

```bash
# GSTACK_ACTIVE_HOST names the harness, never the model.
if { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  echo 'Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage.' >&2
  if { [ -n "${CLAUDECODE:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = claude ]; } && { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
    echo 'Inherited harness markers conflict. Run setup --host <actual-harness> (claude or codex); do not guess a replacement provider.' >&2
  else
    echo 'Repair installed skills: run setup --host codex from your gstack checkout.' >&2
  fi
  exit 78
fi

_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo 'ERROR: not in a git repo' >&2; exit 1; }
_OUTSIDE_TMP=$(mktemp -d "${TMPDIR:-/tmp}/gstack-outside.XXXXXXXX") || exit 1
trap 'rm -rf "$_OUTSIDE_TMP"' EXIT
_OUTSIDE_INPUT="$_OUTSIDE_TMP/prompt"
cat -- '<prepared-prompt-file>' >"$_OUTSIDE_INPUT" || exit 1

_CODEX_PROBE="$HOME/.claude/skills/gstack/bin/gstack-codex-probe"
_CODEX_OUT=$("$_CODEX_PROBE" select-model exec) || exit 1
_CODEX_SEL=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SEL: //p')
_CODEX_SANDBOX_MODE=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SANDBOX: //p')
"$_CODEX_PROBE" check-sandbox || exit 1
"$_CODEX_PROBE" show-first-use-notice
_OUTSIDE_EXIT=0
"$_CODEX_PROBE" run-with-timeout --effort medium 300 codex exec - -C "$_REPO_ROOT" -s "${_CODEX_SANDBOX_MODE:?}" -c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false -c 'web_search="cached"' --json -o "$_OUTSIDE_TMP/text" <"$_OUTSIDE_INPUT" >"$_OUTSIDE_TMP/events" 2>"$_OUTSIDE_TMP/stderr" || _OUTSIDE_EXIT=$?
cat "$_OUTSIDE_TMP/text" 2>/dev/null || tail -n 20 "$_OUTSIDE_TMP/events"

cat "$_OUTSIDE_TMP/stderr" >&2 || { [ "$_OUTSIDE_EXIT" -ne 0 ] || _OUTSIDE_EXIT=1; }
_OUTSIDE_RC=0
bun --no-env-file --config=/dev/null "$HOME/.claude/skills/gstack/lib/outside-review-result.ts" --label 'Codex outside review' --exit "$_OUTSIDE_EXIT" --stderr "$_OUTSIDE_TMP/stderr" --events "$_OUTSIDE_TMP/events" proposal "$_OUTSIDE_TMP/text" || _OUTSIDE_RC=$?
case "$_OUTSIDE_RC" in
  0|3) ;;
  4) echo 'OUTSIDE_STATUS: unverified provider=codex host=claude'; exit 4 ;;
  *) [ "$_OUTSIDE_EXIT" -ne 0 ] && exit "$_OUTSIDE_EXIT"; exit 1 ;;
esac
echo 'OUTSIDE_STATUS: completed provider=codex host=claude'
```

Bash の `timeout: 360000` を使い、完全なレスポンスを `tool-output` フェンスで表示します。実行が成功し、マーカーが有効であることを必須とします。拒否、空または不正な出力、Recommendation マーカーの欠落、タイムアウト、CLI の失敗は `outside_status: unavailable` を意味します。P0/P1 の指摘事項は、ネイティブのものと同様にブロックします。`OUTSIDE_STATUS: unverified` はカバレッジの欠落です。完了した提案は続行します。ネイティブでの完了は、外部カバレッジとは見なされません。 どちらの結果でも、自分で作成したプライベートなプロンプトだけを削除します。一時領域のクリーンアップは自動です。

2. **Claude デザインサブエージェント**(Agent ツール、`run_in_background: false`(利用可能な場合)。結果を待ちます。起動レシートが返った場合は、バックグラウンドで実行されています。その完了通知を待ちます。):
"[上に表示された DESIGN_BRIEF の絶対パス] にあるプロダクトブリーフを最後まで読んでください。

従来のエンタープライズ UI を超える、意外性のあるインディースタジオ風の方向性を提案してください。
- 美的な方向性、タイポグラフィの構成(具体的なフォント名)、カラーパレット(hex 値)を提案する
- そのカテゴリの通例から意図的に外れる点を 2 つ
- ユーザーが最初の 3 秒でどんな感情的反応を抱くべきか

次の既定パターンに頼らないでください: クリーム色の地に高コントラストのセリフ体とテラコッタのアクセント、ほぼ黒の地に 1 色のネオンアクセントと光るエッジ、ヘアラインの新聞風罫線にイタリックのディスプレイセリフと小さな字間広めの等幅ラベル、見出し内のイタリックの強調語、01 / 02 / 03 の番号付きセクションラベル、ピル型のボタン、purple gradient palette, the 3-column feature grid, centered everything, decorative blobs and dividers, nested cards, kicker above heading, icon tile above every heading, dark-mode glow。最初に思いついた案がこれらのいずれかなら、それを名指しして、選び直してください。

大胆に、具体的に書いてください。"

**エラー処理(すべてブロッキングではない):**
- **認証失敗:** stderr に "auth"、"login"、"unauthorized"、"API key" のいずれかが含まれる場合: "Codex の認証に失敗しました。認証するには `codex login` を実行してください。"
- **タイムアウト:** "Codex が 5 分でタイムアウトしました。"
- **空のレスポンス:** "Codex からレスポンスがありませんでした。"
- Codex のエラー時: Claude サブエージェントの出力のみで進めます。それが唯一完了した独立した提案であることを明記します。
- Claude サブエージェントも失敗した場合: 「外部ボイスは利用できません — 私の下書きの方向性で Q2 に進みます。」

完了していて利用可能なボイスの出力のみを、実際の出所とステータスとともに示します。
出力の見出し: `CODEX SAYS (design direction):` と `CLAUDE SUBAGENT (design direction):`。

**Handoff:** 完了した提案(2 件、1 件、または 0 件)をすべて、その出所とステータスとともに保持します。ここで方向性を選んではいけません。Q2 でこれらの提案を、あなたが先に作った下書きと比較します。
両方のボイスが終了したあと(失敗も含む)、自分で作成したプライベートなブリーフのみを、覚えておいた絶対パスで削除します。

**結果を記録する:** ユーザーが承認した場合は、コマンドを 2 回実行します。利用できなかったボイスも含め、ボイスごとに 1 件ずつ記録します。ユーザーが辞退した場合は、STATUS=skipped、SOURCE=none、OUTSIDE_STATUS=skipped で 1 回実行します。
```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"design-outside-voices","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'","status":"STATUS","source":"SOURCE","host":"claude","outside_provider":"codex","outside_status":"OUTSIDE_STATUS","phase":"design","commit":"'"$(git rev-parse --short HEAD)"'"}'
```
ログのフィールドは、実際に完了した提案から埋めます。好みの違いは問題ではなく選択肢です。STATUS=issues_found は、プロダクトの制約が未解決の、使える提案の場合のみです。

| 結果 | STATUS | SOURCE | OUTSIDE_STATUS |
|---|---|---|---|
| ユーザーが両方を辞退(1 件のレコード) | skipped | none | skipped |
| Codex が有効なマーカーつきで完了 | clean or issues_found | codex | completed |
| Codex が利用不可、または無効 | unavailable | none | unavailable |
| ネイティブのサブエージェントが完了 | clean or issues_found | in-host | Codex の実際の結果: completed または unavailable |
| ネイティブのサブエージェントが利用不可 | unavailable | none | Codex の実際の結果: completed または unavailable |

SOURCE は、完了したプロバイダー、または in-host。それ以外は "none" です。承認された実行の両方のレコードは、一方のボイスが失敗しても保持されます。

両方のレコードが、CLI の実際の結果を持ちます。OUTSIDE_STATUS=completed は、有効なマーカーつきで正常に実行された場合のみで、それ以外は unavailable です。`outside_provider`/`outside_status` は、各レコードの出所ではなく、外部のカバレッジを表します。ネイティブのみの成功は、STATUS=clean、SOURCE=in-host、outside_status="unavailable" です。

従来のスキル識別子はそのまま保持します。従来の source:"claude" は、引き続きネイティブの Claude サブエージェントを意味します。報告された modelUsage は、複数のモデルを含めて保持します。モデルの正体が不明な場合は不明のままにします。

完了した外部の提案を比較してください。一致点、相違点、採用したアイデアを、出典を添えて説明します。新しく提案されたフォントを採用する前に、上と同じ手順で検証してください。
推奨事項を、印象に残るものへの回答と結び付けます。一致を投票として数えたり、欠けている提案を作り出したりしないでください。Q2 では、完了した、利用できなかった、または辞退された意見を明示し、推奨事項を提示します。

**AskUserQuestion Q2 — SAFE/RISK の内訳を含む完全な提案を提示:**

```
Based on [product context] and [research findings / my design knowledge]:

AESTHETIC: [direction] — [one-line rationale]
DECORATION: [level] — [why this pairs with the aesthetic]
LAYOUT: [approach] — [why this fits the product type]
COLOR: [approach] + proposed palette (hex values) — [rationale]
TYPOGRAPHY: [display, body, label, mono assignments; a face may serve multiple roles] — [why these fonts]
SPACING: [base unit + density] — [rationale]
MOTION: [approach] — [rationale]

This system is coherent because [explain how choices reinforce each other].

INDEPENDENT INPUT: [completed/unavailable/skipped voices; agreements, differences, ideas adopted and product-specific reasons — omit comparisons if none completed]

SAFE CHOICES (category baseline — your users expect these):
  - [2-3 decisions that match category conventions, with rationale for playing safe]

RISKS (where your product gets its own face):
  - [2-3 deliberate departures from convention]
  - For each risk: what it is, why it works, what you gain, what it costs

Safe choices meet category expectations; risks make the product memorable.
Which risks appeal to you? Try others or adjust anything else?
```

一貫性だけでは、ありきたりに見えることがあります。カテゴリの安全な選択と並べて、理由、利点、コストを添えた創造的なリスクを、少なくとも 2 つ提案してください(タイプ、アクセント、余白、レイアウト、モーションのいずれか)。

**選択肢:** A) 素晴らしい — フォントが検証済みであれば Phase 5 へ進む。 B) [セクション]を調整 — Phase 4 のあと、再度 Q2。 C) 別のリスク — 提案を修正し、再度 Q2。 D) 最初からやり直す — 同じ確定したブリーフを使い、別の方向性を下書きする。 E) プレビューをスキップ — 直接書き込みに進むのではなく、Phase 6 の Q-final へ進む。

修正の際は、フォントと一貫性を再確認します。プロダクトのブリーフが変わった場合は、古い提案を古いものとしてラベル付けし、新しい独立した意見を提示します。
新しい文脈をレビューしたと主張しないでください。

---

## Phase 4: 詳細化(ユーザーが調整を求めた場合のみ)

要求された詳細化ごとに、焦点を絞った AskUserQuestion を一つ使います。**フォント:** 役割、根拠/印象、プレビューの提案を添えた、検証済みの候補を 3〜5 件。
**カラー:** 2〜3 種の hex パレットとカラー理論。**見た目:** プロダクトに合う方向性と、その理由。**レイアウト/余白/モーション:** プロダクトに特有の、具体的なトレードオフ。
選んだ調整を完全な Q2 の提案に反映させ、Q2 を再度尋ねる前に、フォントの検証と一貫性を再確認してください。

---

## Phase 5: デザインシステムのプレビュー(デフォルトでオン)

Q2 の承認後: フォントが検証待ち、またはプレビューをスキップする場合は、制限付きで Phase 6 へ進みます。生成が利用できない/失敗した場合は、
パス B を提案するかスキップし、無制限に再試行しないでください。

### パス A: AI モックアップ(DESIGN_READY の場合)

提案されたシステムを、現実的なプロダクトの画面に適用します。

```bash
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_DESIGN_DIR="$GSTACK_STATE_ROOT/projects/$SLUG/designs/design-system-$(date +%Y%m%d)"
mkdir -p "$_DESIGN_DIR"
echo "DESIGN_DIR: $_DESIGN_DIR"
```

ブリーフ: Phase 3 の見た目/カラー/タイプ/余白/レイアウトに、Phase 1 のプロダクトの文脈を加えたものを、非公開のファイルに書きます:

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
BRIEF_FILE=$(mktemp "${_GT:?}/brief.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "BRIEF_FILE: $BRIEF_FILE (name: ${BRIEF_FILE##*/})"
```

出力された各ファイルに、ファイル書き込みツール(Claude Code の Write ツールは、先に空ファイルを Read する必要があります)で、そのまま表示されるべき内容を書き込みます。テキストをシェルコマンド、ヒアドキュメント、引用符付き引数に入れてはいけません。書き込みが失敗または拒否された場合は送信せず、原因、ファイルパス、手動送信用の下記コマンドを表示します。

ブリーフの形: `Product name: [name]. Product type: [type]. Aesthetic: [direction]. Colors: primary [hex], secondary [hex], neutrals [range]. Typography: display [font], body [font]. Layout: [approach]. Show a realistic [page type] screen with [specific content for this product].` そのうえで、表示された名前を `<brief-file-name>` に代入します:

```bash
BRIEF_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<brief-file-name>"
[ -s "$BRIEF_FILE" ] || { echo "Not run: $BRIEF_FILE is missing or empty. Write the brief, then rerun this block." >&2; exit 1; }
_OUT=$($D variants --brief "$(cat "$BRIEF_FILE")" --count 3 --output-dir "$_DESIGN_DIR/"); _RC=$?
printf '%s\n' "$_OUT"; echo "EXIT: $_RC"
```

<!-- design:round-accounting -->
**ラウンドの集計:** 名前は決して上書きされません(使用済みのものは繰り上げられます)。そのため、表示された `saved` のパスだけを使ってください。
`requested` のうち何枚の有料画像が保存されたかをユーザーに伝え、`failures` の各項目を名指しします。終了コード 2 は、何も保存されなかったことを意味します。
`failures` を報告してここで止めてください(パス B を提案するかスキップ)。`$D check` もボードも実行しないでください。

保存された各パスに対して、最初のものから順に、同じブリーフファイルを使って品質チェックを実行します。失敗したバリアントは決して含めないでください:

```bash
BRIEF_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<brief-file-name>"
[ -s "$BRIEF_FILE" ] || { echo "Not run: $BRIEF_FILE is missing or empty. Write the brief, then rerun this block." >&2; exit 1; }
$D check --image "<first path from the printed saved list>" --brief "$(cat "$BRIEF_FILE")"
```

終了コードではなく JSON を読んでください。`pass: false` は、`issues` に対処して再生成し、再チェックすることを意味します。`pass: true` でも、利用不可/スキップの警告が出ている場合は、
自動化されたチェックが欠けています。そのことを開示し、目視で確認してください。

**提示する前に自己チェック:** 人間のデザイナーが、このバリアントに署名するのを恥ずかしく思うか? 恥ずかしいなら、破棄して再生成します。即座に却下するもの: 紫のグラデーションのヒーロー、3 列の SaaS グリッド、すべてを中央揃え、
使いすぎのディスプレイフェイス、ありきたりなストック写真、system-ui、グラデーションの CTA、すべてに丸い角。いずれかに該当する場合は、再生成が必要です。

受け入れた各 PNG をインラインで読み込み、その後で選択や再加工を提案する前に、それらのパスでボードを開いてください。

### 比較ボードとフィードバックループ

<!-- design:board -->
今回のラウンドのボード用画像(チェックを通った、出力されたパスを順番に)を、Write ツールで JSON 配列として `$_DESIGN_DIR/board-images.json` に書き込みます。ボードの A、B、C の文字は、その順序に従います。続いて、以前の Submit がこれらの画像を承認してしまわないようアーカイブし、ボードをビルドします:

```bash
[ -f "${_DESIGN_DIR:?set _DESIGN_DIR to the design dir printed above}/feedback.json" ] && mv "${_DESIGN_DIR:?}/feedback.json" "${_DESIGN_DIR:?}/feedback-$(date -u +%Y%m%dT%H%M%SZ).json"
$D compare --images-file "$_DESIGN_DIR/board-images.json" --output "$_DESIGN_DIR/design-board.html" --serve
```

これは永続的なデーモンに公開し、ボードを開いて、終了します。キャプチャした stderr から起動マーカーを読みます。PID は準備完了を意味しません。終了コード 0 で `BOARD_URL` があれば、デーモンが配信しています。その完全な `http://127.0.0.1:N/boards/<id>/` の URL を保存します。従来の `--no-daemon` の場合のみ、ホストのバックグラウンドタスクが必要です。`SERVE_STARTED: port=N` はルートの URL `http://127.0.0.1:N/` を示します。

**AskUserQuestion で待つ:** 「<BOARD_URL> を確認し、Submit するか新しいバリアントを依頼してから、教えてください。または、好みをここに貼り付けてください。」選ぶのはボードで、質問は待つだけです。ポーリングしてはいけません。

応答のあと、ボードの HTML の隣にある現在のフィードバックを読みます:
- `feedback.json`: Submit(preferred/overall は null の場合あり):
```json
{"preferred":"A","ratings":{"A":4},"comments":{"A":"Good spacing"},"overall":"Go with A","regenerated":false}
```
- `feedback-pending.json`: Regenerate:
```json
{"preferred":"B","ratings":{"B":4},"comments":{},"overall":"Keep layout","regenerated":true,"regenerateAction":"more_like_B"}
```

`regenerateAction`: `different`、`match`、`more_like_<letter>`、またはカスタムのテキスト(リミックスを含む)。ボードはテキストを使い、必須の `remixSpec` は出力しません。貼り付けられたマップ(`{"layout":"A","colors":"B"}`)があれば尊重します。詳細が足りなければ確認します。

**ボードかチャットか:** 修正は再生成します。最終的な選択には、要約による確認が必要です。skip はモックアップなしで Phase 6 に進みます。選択や詳細がなければ尋ねます。ファイルがないことから承認を推測してはいけません。修正メモつきの Submit は修正です。

**Regenerate:**
1. ブリーフファイルのブリーフを、無関係な制約を保ったまま修正します。今回のラウンドのフィードバックファイルをアーカイブし、古い Submit が新しい画像を承認できないようにします(ボードのブロックが再ビルド時にこれを行います)。
2. 新しいブリーフ(セッションなし)で `$D variants` を実行し、同じキャプチャとラウンドの集計を行います。すべての新しい画像(その出力されたパス)に対して、品質チェックとビジュアルのセルフゲートを再実行します。
3. 上記のボードのブロックで(board-images.json を書き直します)、`--serve` なしで再ビルドします。
4. 保存した URL でリロードします(ボードごとのパスを保ちます。従来のものはルート):
   `jq -nc --arg html "$_DESIGN_DIR/design-board.html" '{html: $html}' | curl -sS -X POST "${BOARD_URL}api/reload" -H 'Content-Type: application/json' --data-binary @-`
5. リロードが成功したことを確認し、最終的な選択、skip、停止があるまで、同じ URL で AskUserQuestion を行います。生成やリロードの失敗は、別の待機ではなくフォールバックを使います。

**SERVER FALLBACK:** 0 以外の終了コード、または準備完了のマーカーがない場合: 各バリアントを Read でインライン表示し、続いて AskUserQuestion を行います: 「比較ボードのサーバーを起動できませんでした。どのバリアントですか? 変更点はありますか?」チャットでのフィードバックは、上記のとおりに扱います。

**After receiving feedback (any path):** PREFERRED、RATINGS、YOUR NOTES、DIRECTION を要約し、AskUserQuestion で「これで合っていますか?」と尋ねます。最終的な選択が確認されたら、`$_DESIGN_DIR/approved.json` を Write してよく、`approved_variant`、`approved_path`(このボードの `board-images.json` にある、その文字のエントリのファイル名。ディレクトリの一覧は決して使わない)、`feedback`、`date`(UTC)、`screen`(選んだモックアップが描いているプロダクトのページ)、`branch`(現在の `git branch --show-current` の結果。detached の場合は空)を含めます。有効な JSON を使い、シェルの補間は決して使いません。これが承認するのは画像のみです。プロジェクトへの書き込みは Q-final がゲートします。

最終的な画像の確認のあと、`$D extract` は Git リポジトリの中で DESIGN.md を書き込みます。新しい非リポジトリの作業用ディレクトリでのみ実行してください。
`$D` と `APPROVED_IMAGE`(確認された文字の `board-images.json` のエントリ)を、絶対パスに束縛します:

```bash
_EXTRACT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/gstack-design-extract-XXXXXXXX") || exit 1
(
  cd "$_EXTRACT_DIR" || exit 1
  if git rev-parse --show-toplevel >/dev/null 2>&1; then
    echo "Extraction refused: scratch directory resolves to a Git repository" >&2
    exit 1
  fi
  "$D" extract --image "$APPROVED_IMAGE"
)
```

抽出されたトークンを、承認された画像と検証済みのフォントと照合し、食い違いは Q-final で示してください。空の配列、「Unable to extract」というムード、コマンドの失敗があれば、
Phase 3 の値へのフォールバックを開示し、測定されたトークンを決して捏造しないでください。

視覚的な変更が遅れて入った場合は、フィードバックのループに戻します。再生成し、再チェックし、再確認し、その後あらためて抽出します。`sessionFile` を提供するのは `generate` だけです。
`$D iterate --session "<returned sessionFile>" --feedback "$(cat "$FEEDBACK_FILE")" --output "$_DESIGN_DIR/refined.png"` を使い、表示された `outputPath` を使ってください。バリアントは必ず再生成します。

**プランモード:** 承認されたモックアップのパスとトークンを、Phase 6 の「## Proposed DESIGN.md」のプランセクションに引き継ぎます。その内容を保存するかどうかは Q-final の承認によって決まります。
実際の DESIGN.md は実装時まで延期します。

### パス B: HTML プレビューページ(DESIGN_NOT_AVAILABLE の場合のフォールバック)

HTML プレビューを作成して開きます:

```bash
PREVIEW_FILE="/tmp/design-consultation-preview-$(date +%s).html"
```

プレビューの HTML を `$PREVIEW_FILE` に書き、それを開きます:

```bash
open "$PREVIEW_FILE"
```

### プレビューページの要件(パス B のみ)

**単一の、自己完結した HTML ファイル**を、フレームワークなしで書いてください。

1. 手順(4)で検証した Google Fonts/Fontshare/セルフホストの元から、提案されたフォントを `<link>` で**読み込む**。
2. 提案されたパレットを**全体で使う**。
3. ヒーローには、Lorem Ipsum ではなく、**プロダクト名を表示する**。
4. **フォントの見本セクション:**
   - 各候補を、そのヒーロー/本文/ボタン/表の役割で示す。同じ役割の代替案は、実際のドメインのコンテンツ(例: シビックテック: 政府のデータ)を使って並べて比較する。
5. **カラーパレットのセクション:**
   - 名前付きの hex のスウォッチ。プライマリ/セカンダリ/ゴーストのボタン、カード、入力欄、成功/警告/エラー/情報のアラート、背景と文字のコントラストの組み合わせ。
6. **現実的なプロダクトのモックアップ:** Phase 1 のプロダクトの種類に応じたレイアウトを 2〜3 件、システム全体、プロダクト名、ドメインのコンテンツ、提案された余白/レイアウト/角丸とともに描画する:
   - **ダッシュボード/Web アプリ:** 指標の表、サイドバーのナビゲーション、アバターのヘッダー、統計カード。
   - **マーケティング:** 実際のコピーのヒーロー、機能、お客様の声、CTA。
   - **設定/管理:** ラベル付きの入力欄、トグル、ドロップダウン、保存。
   - **認証/オンボーディング:** ブランドのログイン、ソーシャルボタン、検証の状態。
7. **ライト/ダークの切り替え:** CSS のカスタムプロパティと、JS のボタン。
8. **すっきりした、プロフェッショナルなレイアウト。**
9. **すべての幅でレスポンシブ。**

フォントとカラーの一覧にとどまらず、そのプロダクトがどのように感じられるかを示してください。

`open` が失敗した場合(ヘッドレス環境)は、ユーザーに次のように伝えてください。
*「プレビューを [path] に書き出しました。ブラウザで開くと、フォントとカラーが描画された状態で確認できます。」*

ユーザーがプレビューをスキップしたいと言った場合は、直接 Phase 6 へ進みます。

---

## Phase 6: DESIGN.md の書き込みと確認

`$D extract` を呼び出すのはパス A だけで、上記のとおり隔離されています。パス B では、承認された HTML プレビューの CSS の値を使います。
プレビューがない場合は、承認された Phase 3 の値を使い、検証されていないフォントだけを検証待ちとしてマークします。根拠と、変更されていない既存の判断は保持します。

**書き込む前に確認します。** 以下の DESIGN.md の完全な内容を準備し、すべてのトークンの出所(承認されたモックアップの抽出、承認された HTML、または Phase 3 のフォールバック)を特定し、
検証されていないフォントを検証待ちとしてマークし、追加または更新する正確な CLAUDE.md の指針を示してください。決定事項とエージェントが選んだデフォルトを、そのプレビューとともに示します。AskUserQuestion Q-final:
- A) 承認 — DESIGN.md と CLAUDE.md を書き込む。プランモードでは、Proposed DESIGN.md をプランの中にだけ保存する
- B) 修正 — Phase 3 に戻り、再度確認する
- C) 最初からやり直す — Phase 1 に戻る

待ちます。書き込みを許可するのは A だけです。B/C の場合は、プロジェクトのファイルに触れないでください。これらの正確な書き込みについて、以前に明示的な承認があった場合は、
再度尋ねることなく尊重してください。その後にトークン、フォント、方向性が変わったら、その承認は無効になります。提案を更新し、影響を受けるフォントとプレビューを再検証し、Q-final を再度尋ねてください。
プロダクトのブリーフが変わった場合は、以前の独立した提案も無効になります。

**プランモードの場合:** DESIGN.md の内容を、プランファイルの「## Proposed DESIGN.md」セクションとして書き込みます。実際のファイルは**書き込まないでください**。それは実装時に行います。

**プランモードでない場合:** 承認された Phase 0 の形式の選択を適用し、そのあとルートの `DESIGN.md` を書き込みます。新規、最初からの作成、変換されたファイルは、以下の google-labs-code/design.md の形式を使います。
すべてのトークンは、5 つの規範的な YAML のグループに入れます。散文では、値を繰り返さずに根拠と用途を説明します。2 行目の形式マーカーを保持してください。
レガシーのまま維持する、または不明な形式の Update では、代わりにそれ自身の形を保持します。`legacy-keep` は、選んだレガシーのパスの場合にだけ保存します。新規の置き換えの前に、以前のファイルをバックアップに保存してください。

```markdown
---
# gstack: design-md-format=spec
name: [Project Name]
description: [one sentence: mood, material, energy]
colors:
  primary: "#..."          # descriptive slugs; hex, or the project's canonical color space
  on-primary: "#..."
  surface: "#..."
  text: "#..."
  text-muted: "#..."
  accent: "#..."
  success: "#..."
  warning: "#..."
  error: "#..."
typography:
  display:
    fontFamily: [face]
    fontWeight: [weight]
    fontSize: [clamp() or rem]
    letterSpacing: [em]
  body:
    fontFamily: [face]
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: [face]
    fontSize: 0.75rem
    letterSpacing: 0.04em
  mono:
    fontFamily: [face]
    fontFeature: tnum
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
  button-primary-hover:
    backgroundColor: "#..."
  input:
    borderColor: "{colors.text-muted}"
    rounded: "{rounded.sm}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  nav-link:
    textColor: "{colors.text}"
---

# [Project Name]

## Overview

**Creative North Star:** [one sentence: aesthetic + why it fits these users]
**Product context:** [product, users, category/peers, project type]
**Mode per surface:** [one line each: Persuade / Operate / Read / Experience]
**Reference sites:** [URLs, if research was done]
**Key characteristics:** [3-5 bullets: first-five-second impressions]

## Colors

**Strategy:** [Restrained / Committed / Full palette / Drenched] — [why]
**Light or dark:** [decided by the use scene: who, where, under what light]
[Explain which tokens signal interaction or emphasis, how neutrals derive from the palette, and how dark-mode surfaces preserve hierarchy rather than merely inverting lightness.]

## Typography

[Faces' source world, mode/register, roles and display boundaries; loading, scale rationale, justified overused-list exceptions]

## Layout

[Breakpoint grids, max width, density, large/small spacing rhythm, intentional grid breaks]

## Elevation & Depth

[Depth: offset + soft-blur shadows, tints, borders; no zero-offset glow]

## Shapes

[Radius hierarchy/uses; nested inner radius = outer radius − gap]

## Components

[Per component: hover/focus-visible/active/disabled states, invariants and adaptations]

## Do's and Don'ts

- Do: [3-5 specific, checkable rules]
- Don't: [3-5 system-specific anti-patterns, including this category's tempting catalog entries]

## Motion

- **Approach:** [minimal-functional / intentional / expressive]
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)
- **The one authored moment:** [what it is]

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| [today] | Initial design system created | Created by /design-consultation based on [product context / research] |
```

プレースホルダーではなく、実際のトークンの値を使ってください。捏造された `components` のエントリや、検証されていない fontFamily の値は省略します。
その代わり、保留中のフォントの役割は散文で説明します。プランモードの外では、DESIGN.md を書いたあとに、
`bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/bin/gstack-design-md.ts check DESIGN.md` を実行します。新規/最初から/変換済み/spec のファイルでは `DESIGN_MD_FORMAT: spec` を、
維持されたレガシーのファイルでは `legacy-keep` 付きの `legacy` を、保持された不明な形式のファイルでは開示された `unknown` の形式を要求します。検証に spec と表示させるためだけに、維持するファイルを変換しないでください。

**プランモードの外では、CLAUDE.md を更新してください**(存在しない場合は作成します)。次のセクションを追記します:

```markdown
## Design System
Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md.
```

DESIGN.md を出荷したあとに、セッションでシステムレベルのトークンだけでなく、画面単位のモックアップやページのレイアウトが生成された場合は、次を提案してください。
「このデザインシステムを、Pretext ネイティブの HTML として動く形で見たいですか? /design-html を実行してください。」

---
