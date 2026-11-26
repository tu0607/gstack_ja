// lib/design-catalog.ts — gstack's design anti-pattern vocabulary, typed.
// Derived in part from pbakaus/impeccable (Apache-2.0), modified. See NOTICE.md.
//
// Pure module: no I/O, no imports from scripts/. bin/ and lib/ travel together
// on every host, scripts/ is never linked, so anything runtime may import this
// and nothing here may import scripts/.
//
//   lib/design-catalog.ts
//     ├─ scripts/resolvers/constants.ts          AI_SLOP_BLACKLIST: the 11 legacy lines, verbatim, in order
//     ├─ scripts/resolvers/design.ts             DESIGN_METHODOLOGY cat 9, DESIGN_HARD_RULES, DESIGN_DETECTOR
//     │                                          (handoffs), OVERUSED_FONTS, DESIGN_SLOP_BULLETS, and the
//     │                                          design-html anti-slop line (catalogEntries)
//     ├─ scripts/resolvers/design-checklist.ts   review/design-checklist.md (generated)
//     ├─ bin/gstack-design-detect.ts             normalizes engine findings by impeccableId
//     └─ design/src/brief.ts                     MOCKUP_NEVER_NAMES in the image-generation prompt
//
// Rule ids. An entry's `impeccableId` is set only when that id exists in
// test/fixtures/impeccable-antipatterns.json (test-enforced), and rendered
// prose brackets an id only in that case, so a reader never meets a bracketed
// id the detector cannot emit. Everything else is a gstack-only tell that the
// LLM pass judges. The four lists this file replaced (constants.ts, the
// consultation proposal section, design-html's blacklist, and the review
// checklist) had drifted apart; they now render from here.

export type SlopCategory =
  | 'scaffold' | 'surface' | 'type' | 'color' | 'layout'
  | 'motion' | 'copy' | 'states' | 'imagery' | 'browser-surface';
export type DetectMethod = 'engine' | 'grep' | 'render' | 'llm';
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export type ReviewTier = 'auto-fix' | 'ask' | 'possible';
export type Impact = 'high' | 'medium' | 'polish';
export type FontRole = 'display' | 'body' | 'ui' | 'mono';
/** The `/impeccable <cmd>` commands a deferred finding may hand off to (one source for the type and the prose). */
export const HANDOFF_COMMANDS = ['typeset', 'layout', 'colorize', 'harden', 'clarify', 'polish', 'animate', 'quieter'] as const;
export type Handoff = (typeof HANDOFF_COMMANDS)[number];

export interface DesignSlopEntry {
  /** kebab-case; equals impeccableId when the detector knows the rule */
  id: string;
  /** set only when the id is in test/fixtures/impeccable-antipatterns.json */
  impeccableId?: string;
  /** short label (compact renders, mockup "Never:" line) */
  name: string;
  /** the doctrine line, gstack voice (cat 9, checklist, consultation bullets) */
  prose: string;
  category: SlopCategory;
  kind: 'slop' | 'quality';
  detect: DetectMethod[];
  /** design-checklist tier */
  confidence: Confidence;
  /** review-lite bucket */
  tier: ReviewTier;
  /** design-review triage */
  impact: Impact;
  /** grep hint rendered in design-checklist.md category 1 */
  heuristic?: string;
  /** overused-font names */
  values?: string[];
  /** roles the values are banned for; present iff values is */
  roles?: FontRole[];
  handoff?: Handoff;
  source: 'gstack' | 'impeccable' | 'both';
  /** the 11 originals; AI_SLOP_BLACKLIST derives from these verbatim */
  legacyBlacklist?: true;
  /** feeds the design binary's "Never:" prompt line */
  mockupNever?: true;
}

/** Training-data defaults: never the display voice on any surface (body/UI on Operate/Read is the one exception, FONTS_BODY_UI_OK). */
const OVERUSED_DISPLAY = [
  'Inter', 'Roboto', 'Arial', 'Helvetica', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Space Grotesk', 'Space Mono', 'Fraunces', 'Playfair Display', 'Cormorant', 'Lora', 'Crimson',
  'Newsreader', 'Syne', 'IBM Plex Sans', 'IBM Plex Serif', 'DM Sans', 'DM Serif', 'Outfit',
  'Plus Jakarta Sans', 'Instrument Sans', 'Geist',
];

export const DESIGN_SLOP_CATALOG: DesignSlopEntry[] = [
  // ── The 11 legacy lines. Order and prose are load-bearing: AI_SLOP_BLACKLIST is this list. ──
  {
    id: 'ai-color-palette', impeccableId: 'ai-color-palette', name: 'Purple gradient palette',
    prose: '紫・バイオレット・インディゴのグラデーション背景、または青から紫へのカラースキーム',
    category: 'color', kind: 'slop', detect: ['engine', 'grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '`#6366f1` から `#8b5cf6` の範囲の値を持つ `linear-gradient`、または紫・バイオレットに解決される CSS カスタムプロパティを探す。',
    handoff: 'colorize', source: 'both', legacyBlacklist: true,
    mockupNever: true,
  },
  {
    id: 'feature-grid-3col', name: 'The 3-column feature grid',
    prose: '**3 カラムのフィーチャーグリッド(3-column feature grid):** 色付き円の中のアイコン + 太字のタイトル + 2 行の説明を、左右対称に 3 回繰り返す。AI が作るレイアウトとして最も見分けやすい型。',
    category: 'scaffold', kind: 'slop', detect: ['grep', 'llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    heuristic: 'ちょうど 3 つの子要素を持つ grid/flex コンテナで、各子が円形の要素 + 見出し + 段落を含むものを探す。',
    handoff: 'layout', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'icon-circle-decoration', name: 'Icons in colored circles',
    prose: 'セクションの飾りとして、色付きの円の中に置いたアイコン(SaaS スターターテンプレートの見た目)',
    category: 'scaffold', kind: 'slop', detect: ['grep', 'llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    heuristic: '`border-radius: 50%` と背景色を持ち、アイコンの装飾用コンテナとして使われている要素を探す。',
    handoff: 'quieter', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'centered-everything', name: 'Centered everything',
    prose: 'すべてを中央揃えにする(見出し・説明・カードのすべてに `text-align: center`)',
    category: 'layout', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '`text-align: center` の密度を Grep で調べる。テキストコンテナの 60% を超えて中央揃えなら指摘する。',
    handoff: 'layout', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'uniform-radius', name: 'Uniform bubbly border-radius',
    prose: 'すべての要素に同じ丸い border-radius を付ける(どの要素にも同じ大きな角丸)',
    category: 'surface', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '`border-radius` の値を集計する。80% を超えて 16px 以上の同じ値を共有していたら指摘する。すべてがピル型の角丸なら極端な例。',
    handoff: 'polish', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'decorative-blobs', name: 'Decorative blobs and dividers',
    prose: '装飾的なブロブ、浮かぶ円、波形の SVG 区切り線(セクションが空に感じるなら、必要なのは装飾ではなく良いコンテンツ)',
    category: 'imagery', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'emoji-decoration', name: 'Emoji as design elements',
    prose: '絵文字をデザイン要素として使う(見出しのロケット、箇条書きの絵文字)',
    category: 'imagery', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '見出し、リスト項目、ボタンで、アイコンや箇条書きの記号として使われている絵文字のコードポイントを Grep で探す。',
    handoff: 'polish', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'side-tab', impeccableId: 'side-tab', name: 'Colored left-border on cards',
    prose: 'カード上の色付き左ボーダー(`border-left: 3px solid <accent>`)',
    category: 'surface', kind: 'slop', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: 'カード、コールアウト、リスト項目のセレクターにある `border-left: <n>px solid` を Grep で探す。',
    handoff: 'polish', source: 'both', legacyBlacklist: true,
  },
  {
    id: 'generic-hero-copy', name: 'Generic hero copy',
    prose: 'ありきたりなヒーローコピー(「Welcome to [X]」「Unlock the power of...」「Your all-in-one solution for...」)',
    category: 'copy', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: 'HTML/JSX の内容から「Welcome to」「Unlock the power of」「Your all-in-one solution」「Revolutionize your」「Streamline your workflow」を Grep で探す。',
    handoff: 'clarify', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'cookie-cutter-rhythm', name: 'Cookie-cutter section rhythm',
    prose: '型にはまったセクションのリズム(ヒーロー → 特徴 3 つ → お客様の声 → 料金 → CTA、どのセクションも同じ高さ)',
    category: 'scaffold', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'gstack', legacyBlacklist: true,
  },
  {
    id: 'system-font-primary', name: 'system-ui as the primary face',
    prose: 'system-ui や `-apple-system` を主要な見出し/本文フォントにする。これは「タイポグラフィを諦めた」サインだ。ちゃんとした書体を選ぶ。',
    category: 'type', kind: 'slop', detect: ['grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: 'body、見出し、ベーススタイルの `font-family` で、スタックの先頭が `system-ui` または `-apple-system` のものを Grep で探す。',
    handoff: 'typeset', source: 'gstack', legacyBlacklist: true,
  },

  // ── Slop the detector knows (ids from the registry fixture). ──
  {
    id: 'border-accent-on-rounded', impeccableId: 'border-accent-on-rounded', name: 'Border accent on a rounded card',
    prose: '角丸カードの色付きの縁。サイドタブの着ぐるみ。状態は、背景の色味、アイコン、ラベルで伝える。',
    category: 'surface', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'polish', source: 'impeccable',
  },
  {
    id: 'overused-font', impeccableId: 'overused-font', name: 'Overused display font',
    prose: '学習データのデフォルト書体を見出しの声に使うのは、探すのをやめたということ。Operate や Read の画面の本文や UI なら、この中のいくつかは問題ない。どれをなぜ使うかを述べる。',
    category: 'type', kind: 'slop', detect: ['engine', 'grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '見出し系セレクター(h1、h2、.hero、.display)の先頭の書体が、リストにある書体でないか `font-family` を Grep で探す。',
    values: OVERUSED_DISPLAY, roles: ['display'],
    handoff: 'typeset', source: 'both',
  },
  {
    id: 'flat-type-hierarchy', impeccableId: 'flat-type-hierarchy', name: 'Flat type hierarchy',
    prose: '見出しが本文サイズから 1 段階以内しか離れていない。スケールを決め、レベルの差を太さだけにしない。',
    category: 'type', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'gradient-text', impeccableId: 'gradient-text', name: 'Gradient text',
    prose: '強調は太さかサイズで行う。グラデーション文字は、強調の着ぐるみ。',
    category: 'color', kind: 'slop', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: 'グラデーション背景と並ぶ `background-clip: text` を Grep で探す。',
    handoff: 'colorize', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'cream-palette', impeccableId: 'cream-palette', name: 'Cream default palette',
    prose: 'クリーム色の地、セリフの見出し、テラコッタのアクセント。ルック 1 番。ブリーフが求めたなら問題ないが、求めていないならデフォルトの選択。',
    category: 'color', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'colorize', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'nested-cards', impeccableId: 'nested-cards', name: 'Nested cards',
    prose: 'カードの中のカードは常に間違い。カードは怠惰なコンテナで、入れ子にすればその二乗。',
    category: 'scaffold', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'monotonous-spacing', impeccableId: 'monotonous-spacing', name: 'Monotonous spacing',
    prose: 'すべての間隔が 1 つの値。リズムには、1 拍ではなく、大きな間隔と小さな間隔が必要。',
    category: 'layout', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'layout', source: 'impeccable',
  },
  {
    id: 'bounce-easing', impeccableId: 'bounce-easing', name: 'Bounce easing',
    prose: 'UI のモーションでのオーバーシュートやバウンスのカーブ。すでに見える既定の状態からの、指数関数的な ease-out を使う。',
    category: 'motion', kind: 'slop', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'polish',
    heuristic: 'transition と keyframes で、制御点が 1 を超える cubic-bezier のカーブ、またはアニメーション名の `bounce` を Grep で探す。',
    handoff: 'animate', source: 'impeccable',
  },
  {
    id: 'pulsing-dot', impeccableId: 'pulsing-dot', name: 'Pulsing status dot',
    prose: '「Live」や「Online」の横で、小さな円がいつまでも脈打つ。最初の 1 ループの後は何も伝えないモーション。',
    category: 'motion', kind: 'slop', detect: ['engine', 'grep'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    heuristic: '小さな丸い要素に付いた無限ループの keyframe アニメーションを Grep で探す。',
    handoff: 'animate', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'blinking-cursor', impeccableId: 'blinking-cursor', name: 'Blinking cursor effect',
    prose: 'マーケティングコピーの中で点滅する偽のターミナルカーソル。インターフェースではなく芝居。',
    category: 'motion', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'animate', source: 'impeccable',
  },
  {
    id: 'shape-assembled-illustration', impeccableId: 'shape-assembled-illustration', name: 'Shape-assembled illustration',
    prose: 'アセットの代わりに、CSS の図形で組み立てたイラスト。アセットを用意するか、何も出さない。',
    category: 'imagery', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'dark-glow', impeccableId: 'dark-glow', name: 'Dark-mode glow',
    prose: '暗い面の光る縁。ルック 2 番。奥行きにはオフセットがある。オフセットゼロの色付きハローは装飾。',
    category: 'surface', kind: 'slop', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: '`box-shadow` で、x/y オフセットがゼロ、ぼかしが大きく、彩度の高い色のものを Grep で探す。',
    handoff: 'colorize', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'radial-halo', impeccableId: 'radial-halo', name: 'Radial halo',
    prose: 'ヒーローコンテンツの背後にある放射状グラデーションのハロー。またルック 2 番。',
    category: 'surface', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'radial-spotlight-glow', impeccableId: 'radial-spotlight-glow', name: 'Radial spotlight glow',
    prose: 'ページ上部を照らすスポットライトの光。ハローと同じ系統。',
    category: 'surface', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'marquee', impeccableId: 'marquee', name: 'Logo marquee',
    prose: '延々とスクロールするロゴの帯。ロゴが重要なら静止して見せ、重要でなければ削る。',
    category: 'motion', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'animate', source: 'impeccable',
  },
  {
    id: 'icon-tile-stack', impeccableId: 'icon-tile-stack', name: 'Icon tile above every heading',
    prose: 'すべての見出しの上にある角丸四角のアイコン。横並びにするか、コンテナを外す。',
    category: 'scaffold', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'italic-serif-display', impeccableId: 'italic-serif-display', name: 'Italic serif display',
    prose: 'ルック 3 番。編集的な信頼感を狙うイタリックのセリフ見出し。内容で裏付けるか、見出しを立体(ローマン体)に戻す。',
    category: 'type', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'hero-eyebrow-chip', impeccableId: 'hero-eyebrow-chip', name: 'Hero eyebrow chip',
    prose: 'ヒーローの見出しの上に浮かぶピル型のラベル。見出しは自分で重みを持つ。チップを削る。',
    category: 'scaffold', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'kicker-above-heading', impeccableId: 'kicker-above-heading', name: 'Kicker above heading',
    prose: '見出しの上のキッカー(kicker)は、最も強いデフォルトだ。見出しは自分で重みを持つので、ラベルを消す。それでもユーザーが望むなら従い、トレードオフを一度だけ伝える。',
    category: 'scaffold', kind: 'slop', detect: ['engine', 'grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: 'h1 または h2 の直前にある、短く、大文字で、字間を空けた要素を探す。',
    handoff: 'layout', source: 'impeccable',
    mockupNever: true,
  },
  {
    id: 'numbered-section-labels', impeccableId: 'numbered-section-labels', name: 'Numbered section labels',
    prose: 'セクションの上の 01 / 02 / 03。順序が読み手に必要な情報である場合を除く。',
    category: 'scaffold', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'layout', source: 'impeccable',
  },
  {
    id: 'em-dash-overuse', impeccableId: 'em-dash-overuse', name: 'Em-dash overuse',
    prose: '1 文おきに現れるエムダッシュ(—)。参考情報: 生成コピーのサインだが、それだけでブロックはしない。',
    category: 'copy', kind: 'slop', detect: ['engine'], confidence: 'LOW', tier: 'possible', impact: 'polish',
    handoff: 'clarify', source: 'impeccable',
  },
  {
    id: 'marketing-buzzword', impeccableId: 'marketing-buzzword', name: 'Marketing buzzwords',
    prose: '「Seamless」「effortless」「supercharge」「streamline」など、何も説明しない言葉。製品が何をするかを書く。',
    category: 'copy', kind: 'slop', detect: ['engine', 'grep'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '表示されるコピーから seamless、effortless、supercharge、streamline、revolutionize、unlock、empower、elevate を Grep で探す。',
    handoff: 'clarify', source: 'impeccable',
  },
  {
    id: 'aphoristic-cadence', impeccableId: 'aphoristic-cadence', name: 'Aphoristic cadence',
    prose: '短く。鋭く。断片的に。どの文もスローガン。人に何かを説明するように書く。',
    category: 'copy', kind: 'slop', detect: ['engine', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'clarify', source: 'impeccable',
  },
  {
    id: 'oversized-h1', impeccableId: 'oversized-h1', name: 'Oversized h1',
    prose: 'ポスターではないページで、6rem を超える見出し。大きさは階層ではない。',
    category: 'type', kind: 'slop', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: 'h1 と見出し系セレクターで、font-size が 6rem または 96px を超えるものを Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'extreme-negative-tracking', impeccableId: 'extreme-negative-tracking', name: 'Extreme negative tracking',
    prose: '見出しの letter-spacing が -0.04em を下回る。詰めた字間は好み、潰れた字間はサイン。',
    category: 'type', kind: 'slop', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'polish',
    heuristic: '`letter-spacing` が -0.04em を下回る値を Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'gpt-thin-border-wide-shadow', impeccableId: 'gpt-thin-border-wide-shadow', name: 'Thin border plus wide shadow',
    prose: '同じカードに細いヘアラインのボーダーと、広く柔らかい影。面を持ち上げる方法は 1 つにする。',
    category: 'surface', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'polish', source: 'impeccable',
  },
  {
    id: 'repeating-stripes-gradient', impeccableId: 'repeating-stripes-gradient', name: 'Repeating stripes gradient',
    prose: '背景のテクスチャとしての斜めストライプのグラデーション。テクスチャはブランドから取るか、なしにする。',
    category: 'surface', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'codex-grid-background', impeccableId: 'codex-grid-background', name: 'Grid-paper background',
    prose: 'ヒーローの背後のうっすらしたグリッド。生成された開発ツールがこぞって出す設計図ルック。',
    category: 'surface', kind: 'slop', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'theater-slop-phrase', impeccableId: 'theater-slop-phrase', name: 'Theater phrases',
    prose: '「Built for the way you work」「Designed for teams like yours」「Meet your new...」。ローンチを説明せず、ローンチを演じるフレーズ。',
    category: 'copy', kind: 'slop', detect: ['engine', 'grep'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: 'コピーから「built for」「designed for」「meet your new」「ship faster」「the future of」を Grep で探す。',
    handoff: 'clarify', source: 'impeccable',
  },
  {
    id: 'image-hover-transform', impeccableId: 'image-hover-transform', name: 'Image hover zoom',
    prose: 'ホバー時に画像を拡大する。情報を持たないモーション。',
    category: 'motion', kind: 'slop', detect: ['engine', 'grep'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    heuristic: '画像の `:hover` ルールにある `transform: scale` を Grep で探す。',
    handoff: 'animate', source: 'impeccable',
  },

  // ── gstack-only slop tells: the LLM pass judges these; no detector id, so no brackets. ──
  {
    id: 'gradient-cta', name: 'Gradient CTA button',
    prose: '主要な行動喚起(CTA)にグラデーションのボタンを使う。パレットが持つ単色 1 つにする。',
    category: 'color', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: 'ボタンと CTA のセレクターにあるグラデーション背景を Grep で探す。',
    handoff: 'colorize', source: 'gstack',
  },
  {
    id: 'stock-photo-hero', name: 'Stock-photo hero',
    prose: 'ありきたりなストックフォトのヒーロー、またはその代わりの灰色のプレースホルダー div。製品を見せるか、何も見せない。',
    category: 'imagery', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'gstack',
  },
  {
    id: 'card-default-component', name: 'Cards as the default component',
    prose: 'すべてのコンテナを、ドロップシャドウ付きの角丸カードにする。カードを積み重ねたアプリ UI はレイアウトではない。',
    category: 'scaffold', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'gstack',
  },
  {
    id: 'generic-testimonials', name: 'Generic testimonial section',
    prose: 'アバター、星 5 つ、誰も言っていない引用を並べたお客様の声。実名と実際の主張を載せるか、削る。',
    category: 'scaffold', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'clarify', source: 'gstack',
  },
  {
    id: 'split-hero-template', name: 'Left-text right-image hero',
    prose: '型どおりのヒーロー: 左に見出し、右にスクリーンショット、ボタン 2 つ。どのジェネレーターも最初に手を出すテンプレート。',
    category: 'scaffold', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'gstack',
  },
  {
    id: 'generic-cta-copy', name: 'Generic CTA labels',
    prose: '「Get Started」と「Learn More」だけが行動喚起になっている。そのクリックで何が得られるかを書く。',
    category: 'copy', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: 'ページにもっと具体的な CTA がないのに、ボタンやリンクが「Get Started」「Learn More」になっているものを Grep で探す。',
    handoff: 'clarify', source: 'gstack',
  },
  {
    id: 'hero-metrics', name: 'Hero metric template',
    prose: 'ヒーローの下に、大きな数字 3 つと小さなラベル(「10k+ users」「99.9%」)。数えているのはテンプレートで、製品ではない。',
    category: 'scaffold', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'clarify', source: 'gstack',
    mockupNever: true,
  },
  {
    id: 'identical-cards', name: 'Identical card grids',
    prose: '同じ形、同じアイコン枠、同じ 2 行のカードを並べたグリッド。重みの違う内容に、同じ大きさの箱を与えている。',
    category: 'scaffold', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'gstack',
    mockupNever: true,
  },
  {
    id: 'glassmorphism', name: 'Glassmorphism',
    prose: 'ぼかした背景のすりガラスパネルを既定の面にする。半透明の層は、奥行きを説明する場所に 1 枚だけ使い、どこにでも使わない。',
    category: 'surface', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '複数のコンテナにある `backdrop-filter: blur` を Grep で探す。',
    handoff: 'quieter', source: 'gstack',
  },
  {
    id: 'hand-drawn-svg', name: 'Hand-drawn SVG illustration',
    prose: 'アートディレクションの代わりに、生成した SVG の落書きやマスコット。アセットを依頼またはライセンスするか、何も出さない。',
    category: 'imagery', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'gstack',
  },
  {
    id: 'modal-by-default', name: 'Modal by default',
    prose: 'すべての二次操作をモーダルにする。インライン、サイドパネル、別ページのほうが、ユーザーの負担が小さいことが多い。',
    category: 'states', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'harden', source: 'gstack',
  },
  {
    id: 'monospace-costume', name: 'Monospace as costume',
    prose: '技術的に見せるために、ラベルや本文を等幅にする。等幅はコードとデータ列のためのもの。',
    category: 'type', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    heuristic: 'コードや表形式ではないセレクターに付いた、等幅のスタックの `font-family` を Grep で探す。',
    handoff: 'typeset', source: 'gstack',
  },
  {
    id: 'content-stand-ins', name: 'Content stand-ins',
    prose: 'コンテンツがあるべき場所を埋める、スパークライン、進捗リング、偽のアバター。実際のデータか、正直な空の状態を出す。',
    category: 'imagery', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'harden', source: 'gstack',
  },
  {
    id: 'mode-by-category', name: 'Mode picked by category',
    prose: '開発ツールだから暗く、ヘルスケアだから明るく、という選び方。ライトかダークかは、利用シーン(誰が、どこで、どんな光の下で使うか)で決める。',
    category: 'color', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'medium',
    handoff: 'colorize', source: 'gstack',
  },
  {
    id: 'unthemed-browser-surfaces', name: 'Unthemed browser surfaces',
    prose: '選択色、キャレット、スクロールバー、フォーカスリング、下線のオフセット、等幅数字がブラウザの既定のまま。パレットからテーマを付ける。',
    category: 'browser-surface', kind: 'slop', detect: ['grep', 'llm'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    heuristic: '`::selection`、`caret-color`、`accent-color`、`scrollbar-color`、`text-underline-offset`、`font-variant-numeric` を Grep で探す。1 つもなければ、どれもテーマ化されていない。',
    handoff: 'polish', source: 'gstack',
  },
  {
    id: 'missing-states', name: 'Missing states',
    prose: 'ハッピーパスだけが設計されている。空、読み込み中、エラー、長いコンテンツの状態も、コンポーネントの一部。',
    category: 'states', kind: 'slop', detect: ['llm'], confidence: 'LOW', tier: 'ask', impact: 'high',
    handoff: 'harden', source: 'gstack',
  },

  // ── Quality rules the detector knows. ──
  {
    id: 'organic-clip-path', impeccableId: 'organic-clip-path', name: 'Organic clip-path',
    prose: '写真の縁やブロブを真似た、多角形の clip-path。それ自身の縁を持つアセットか、長方形にする。',
    category: 'imagery', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'buried-raster', impeccableId: 'buried-raster', name: 'Buried raster',
    prose: 'ほぼ不透明なウォッシュの下に埋もれた写真。画像が見えないなら、何の役にも立っていない。',
    category: 'imagery', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'quieter', source: 'impeccable',
  },
  {
    id: 'broken-image', impeccableId: 'broken-image', name: 'Broken image',
    prose: '読み込みに失敗した画像。ページ上でこれ以上目立つものはない。',
    category: 'imagery', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'harden', source: 'impeccable',
  },
  {
    id: 'script-error', impeccableId: 'script-error', name: 'Script error',
    prose: '読み込み時にコンソールに出る JavaScript エラー。ページはまだ完成していない。',
    category: 'states', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'harden', source: 'impeccable',
  },
  {
    id: 'content-hidden-at-rest', impeccableId: 'content-hidden-at-rest', name: 'Content hidden at rest',
    prose: '発火しないかもしれないスクロールアニメーションを待つ、opacity 0 のコンテンツ。コンテンツは既定で見えている。',
    category: 'motion', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'animate', source: 'impeccable',
  },
  {
    id: 'edge-flush-cards', impeccableId: 'edge-flush-cards', name: 'Edge-flush cards',
    prose: 'ビューポートの端に接しているカード。レイアウトに余白(ガター)を持たせる。',
    category: 'layout', kind: 'quality', detect: ['engine', 'render'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'impeccable',
  },
  {
    id: 'text-occlusion', impeccableId: 'text-occlusion', name: 'Text occlusion',
    prose: '別の要素に覆われたテキスト。重なりは、意図した選択になるまではバグ。',
    category: 'layout', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'harden', source: 'impeccable',
  },
  {
    id: 'first-viewport-column-overflow', impeccableId: 'first-viewport-column-overflow', name: 'First-viewport overflow',
    prose: '最初のビューポートより幅の広いカラム。到着した時点で横スクロールが出る。',
    category: 'layout', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'layout', source: 'impeccable',
  },
  {
    id: 'gray-on-color', impeccableId: 'gray-on-color', name: 'Gray text on a colored surface',
    prose: '色付きの面の上の二次テキストは、その色相から作った色味にする。灰色にしない。',
    category: 'color', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'colorize', source: 'impeccable',
  },
  {
    id: 'low-contrast', impeccableId: 'low-contrast', name: 'Low contrast text',
    prose: 'WCAG AA のコントラスト(本文 4.5:1、大きな文字 3:1)を下回るテキスト。直すのは不透明度ではなく、色の組み合わせ。',
    category: 'color', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'colorize', source: 'impeccable',
  },
  {
    id: 'layout-transition', impeccableId: 'layout-transition', name: 'Layout-property transition',
    prose: '`transition: all`、または width、height、top、left の transition。アニメーションさせるのは transform と opacity。',
    category: 'motion', kind: 'quality', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'auto-fix', impact: 'polish',
    heuristic: '`transition` に `all` やレイアウト系プロパティがないか Grep で探す。',
    handoff: 'animate', source: 'impeccable',
  },
  {
    id: 'line-length', impeccableId: 'line-length', name: 'Line length',
    prose: '本文の 1 行が 45〜75 文字の範囲外。テキストカラムに max-width を設定する。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    heuristic: '本文のラッパーに `max-width` があるか確認する。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'cramped-padding', impeccableId: 'cramped-padding', name: 'Cramped padding',
    prose: 'テキストコンテナのパディングが 8px 未満。テキストには余裕が必要。',
    category: 'layout', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'impeccable',
  },
  {
    id: 'body-text-viewport-edge', impeccableId: 'body-text-viewport-edge', name: 'Body text at the viewport edge',
    prose: '小さな画面で、本文がビューポートの端から数ピクセル以内にある。',
    category: 'layout', kind: 'quality', detect: ['engine', 'render'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'layout', source: 'impeccable',
  },
  {
    id: 'tight-leading', impeccableId: 'tight-leading', name: 'Tight leading',
    prose: '本文の line-height が 1.4 未満。見出しは詰めてもよいが、段落は詰めてはいけない。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: '本文と段落の `line-height` が 1.4 未満の値を Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'skipped-heading', impeccableId: 'skipped-heading', name: 'Skipped heading level',
    prose: 'h2 を挟まずに h1 の次が h3。スクリーンリーダーは見出しの階層をたどる。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    heuristic: '1 つのファイルまたはコンポーネントの中で、見出しタグがレベルを飛ばしていないか HTML/JSX を確認する。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'heading-rhythm', impeccableId: 'heading-rhythm', name: 'Heading rhythm',
    prose: '見出しの下より上のほうが余白が大きい。計算後の値を読む。',
    category: 'type', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'justified-text', impeccableId: 'justified-text', name: 'Justified text',
    prose: 'Web で本文を両端揃えにすると、語間に川(rivers)ができる。左揃えにする。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'auto-fix', impact: 'polish',
    heuristic: '`text-align: justify` を Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'tiny-text', impeccableId: 'tiny-text', name: 'Tiny text',
    prose: '本文が 16px 未満。16px に上げる。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'auto-fix', impact: 'medium',
    heuristic: 'body、p、ベーススタイルの `font-size` で 16px(16px 基準の 1rem)未満の値を Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'undersized-ui-text', impeccableId: 'undersized-ui-text', name: 'Undersized UI text',
    prose: 'ラベルやコントロールが 12px 未満。10px は誰も読まない。',
    category: 'type', kind: 'quality', detect: ['engine'], confidence: 'HIGH', tier: 'ask', impact: 'medium',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'all-caps-body', impeccableId: 'all-caps-body', name: 'All-caps body text',
    prose: '段落を大文字にする。大文字は短いラベルのためのもの。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'HIGH', tier: 'auto-fix', impact: 'medium',
    heuristic: 'body と段落のセレクターにある `text-transform: uppercase` を Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'wide-tracking', impeccableId: 'wide-tracking', name: 'Wide tracking on body',
    prose: '本文の letter-spacing が 0.05em を超える。字間を広げるのは、小さな大文字ラベルのため。',
    category: 'type', kind: 'quality', detect: ['engine', 'grep'], confidence: 'MEDIUM', tier: 'ask', impact: 'polish',
    heuristic: '本文の `letter-spacing` が 0.05em を超える値を Grep で探す。',
    handoff: 'typeset', source: 'impeccable',
  },
  {
    id: 'text-overflow', impeccableId: 'text-overflow', name: 'Text overflow',
    prose: 'テキストがコンテナからはみ出す。長いコンテンツは通常のケース。',
    category: 'states', kind: 'quality', detect: ['engine', 'render'], confidence: 'HIGH', tier: 'ask', impact: 'high',
    handoff: 'harden', source: 'impeccable',
  },
  {
    id: 'repeated-container-text', impeccableId: 'repeated-container-text', name: 'Repeated container text',
    prose: '兄弟のコンテナ全体で同じテキストが繰り返されている。そのまま出荷されたプレースホルダー。',
    category: 'copy', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'clarify', source: 'impeccable',
  },
  {
    id: 'clipped-overflow-container', impeccableId: 'clipped-overflow-container', name: 'Clipped overflow',
    prose: 'overflow hidden で自分の内容を切り取るコンテナ。何かが切れている。',
    category: 'states', kind: 'quality', detect: ['engine', 'render'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'harden', source: 'impeccable',
  },
  {
    id: 'design-system-font', impeccableId: 'design-system-font', name: 'Off-system font',
    prose: 'DESIGN.md のトークンに名前のない書体。トークンを追加するか、既存のものを使う。',
    category: 'type', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'polish', source: 'impeccable',
  },
  {
    id: 'design-system-color', impeccableId: 'design-system-color', name: 'Off-system color',
    prose: 'DESIGN.md のトークンに名前のない色。トークンを追加するか、既存のものを使う。',
    category: 'color', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'polish', source: 'impeccable',
  },
  {
    id: 'design-system-radius', impeccableId: 'design-system-radius', name: 'Off-system radius',
    prose: 'DESIGN.md のトークンに名前のない角丸。トークンを追加するか、既存のものを使う。',
    category: 'surface', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'polish', source: 'impeccable',
  },
  {
    id: 'design-system-font-size', impeccableId: 'design-system-font-size', name: 'Off-system font size',
    prose: 'DESIGN.md のトークンに名前のないフォントサイズ。トークンを追加するか、スケール上のものを使う。',
    category: 'type', kind: 'quality', detect: ['engine'], confidence: 'MEDIUM', tier: 'ask', impact: 'medium',
    handoff: 'polish', source: 'impeccable',
  },
];

// ── Mockup prompt ──

/**
 * Plain-English names of the entries flagged `mockupNever`, deduped: the design
 * binary appends "Never: <names>." to every image-generation prompt
 * (design/src/brief.ts) so mockups stop reaching for these before the
 * comparison board opens. Exactly ten ids carry the flag (test-enforced).
 */
export const MOCKUP_NEVER_NAMES: readonly string[] = [
  ...new Set(DESIGN_SLOP_CATALOG.filter(e => e.mockupNever).map(e => e.name)),
];

// ── Fonts ──

/** Never the display voice; the detector flags several as `overused-font`. */
export const OVERUSED_FONTS_DISPLAY: readonly string[] = OVERUSED_DISPLAY;

/** Never, in any role. */
export const BANNED_FONTS: readonly string[] = [
  'Papyrus', 'Comic Sans', 'Lobster', 'Impact', 'Jokerman', 'Bleeding Cowboys', 'Permanent Marker',
  'Bradley Hand', 'Brush Script', 'Hobo', 'Trajan', 'Raleway', 'Clash Display', 'Courier New',
];

/** On the overused list, yet fine as body or UI on an Operate or Read surface when the proposal says so. */
export const FONTS_BODY_UI_OK: readonly string[] = ['DM Sans', 'Instrument Sans', 'IBM Plex Sans'];

/** Mono for data and code. */
export const FONTS_MONO_OK: readonly string[] = ['JetBrains Mono', 'IBM Plex Mono', 'Fira Code'];

/**
 * Freely available faces on no default list. Availability was verified at the
 * last edit of this constant; a proposal re-verifies in-session before naming one.
 */
export const FONTS_VERIFIED_FREE = {
  verified: '2026-09-08',
  fontshare: ['Satoshi', 'General Sans', 'Clash Grotesk', 'Cabinet Grotesk'],
  googleFonts: ['Instrument Serif', 'Source Sans 3', 'JetBrains Mono', 'Fira Code'],
} as const;

// ── Lookups ──

const BY_ID = new Map(DESIGN_SLOP_CATALOG.map(e => [e.id, e]));
const BY_IMPECCABLE_ID = new Map(
  DESIGN_SLOP_CATALOG.filter(e => e.impeccableId).map(e => [e.impeccableId as string, e]),
);

export function catalogEntry(id: string): DesignSlopEntry | undefined {
  return BY_ID.get(id);
}

/** The catalog entry for a detector rule id, or undefined when the id is unmapped. */
export function entryForImpeccableId(impeccableId: string): DesignSlopEntry | undefined {
  return BY_IMPECCABLE_ID.get(impeccableId);
}

// ── Rendering ──

export interface RenderCatalogOptions {
  kind?: 'slop' | 'quality';
  /** drop entries whose impact is in this list (e.g. ['polish'] for a shorter list) */
  omitImpact?: Impact[];
}

export function selectCatalog(o: RenderCatalogOptions): DesignSlopEntry[] {
  return DESIGN_SLOP_CATALOG.filter(e =>
    (!o.kind || e.kind === o.kind)
    && !(o.omitImpact && o.omitImpact.includes(e.impact)),
  );
}

/** `- prose` bullets, no ids: the register the proposal skills render (design-consultation, design-shotgun). */
export function renderCatalog(o: RenderCatalogOptions): string {
  return selectCatalog(o).map(e => `- ${e.prose}`).join('\n');
}

/** Slop the detector knows, minus the 11 legacy lines: what design doctrine renders as bracketed ids. */
export function detectorSlopEntries(o: { omitPolish?: boolean } = {}): DesignSlopEntry[] {
  return DESIGN_SLOP_CATALOG.filter(e => e.kind === 'slop' && e.impeccableId && !e.legacyBlacklist && !(o.omitPolish && e.impact === 'polish'));
}

/** gstack-only slop tells (no detector rule), minus the legacy lines: the LLM pass is the detector. */
export function judgmentTellEntries(o: { omitPolish?: boolean } = {}): DesignSlopEntry[] {
  return DESIGN_SLOP_CATALOG.filter(e => e.kind === 'slop' && !e.impeccableId && !e.legacyBlacklist && !(o.omitPolish && e.impact === 'polish'));
}

/** Catalog entries by id, throwing with the id when one is missing (a rename must fail loudly at gen time). */
export function catalogEntries(ids: string[]): DesignSlopEntry[] {
  return ids.map(id => {
    const e = BY_ID.get(id);
    if (!e) throw new Error(`lib/design-catalog.ts: no entry with id "${id}"`);
    return e;
  });
}
