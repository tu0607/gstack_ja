---
# gstack: design-md-format=spec
name: gstack
typography:
  display:
    fontFamily: Satoshi
  body:
    fontFamily: DM Sans
  label:
    fontFamily: DM Sans
  mono:
    fontFamily: JetBrains Mono
    fontFeature: tnum
colors:
  primary-dark-mode: "#F59E0B"
  primary-light-mode: "#D97706"
  primary-text-accent-dark-mode: "#FBBF24"
  primary-text-accent-light-mode: "#B45309"
  zinc-50: "#FAFAFA"
  zinc-400: "#A1A1AA"
  zinc-600: "#52525B"
  zinc-800: "#27272A"
  surface-dark: "#141414"
  base-dark: "#0C0C0C"
  surface-light: "#FFFFFF"
  base-light: "#FAFAF9"
  border-dark: "#262626"
  border-light: "#E7E5E4"
  success: "#22C55E"
  warning: "#F59E0B"
  error: "#EF4444"
  info: "#3B82F6"
spacing:
  2xs: 2px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
rounded:
  sm: 4px
  md: 8px
  lg: 12px
  full: 9999px
---

# デザインシステム — gstack

## 概要

- **これは何か:** gstack のコミュニティサイト。Claude Code をバーチャルなエンジニアリングチームに変える CLI ツール
- **対象:** gstack を知ったばかりの開発者、既存のコミュニティメンバー
- **分野・業界:** 開発者ツール(比較対象: Linear、Raycast、Warp、Zed)
- **プロジェクトの種類:** コミュニティのダッシュボード + マーケティングサイト

- **方向性:** インダストリアル/ユーティリタリアン。機能優先でデータ密度が高く、等幅フォントが個性を担う
- **装飾のレベル:** 意図的。素材感を出すため、サーフェスにごく薄いノイズ/グレインのテクスチャを敷く
- **ムード:** 職人の仕事にこだわる人が作った、真剣なツール。冷たくなく、温かみがある。CLI の系譜こそがブランドそのもの
- **参考サイト:** formulae.brew.sh(競合だが、こちらは生きていてインタラクティブ)、Linear(ダーク基調で抑制が効いている)、Warp(温かいアクセント)

## カラー

- **アプローチ:** 抑制的。アンバーのアクセントは稀で、それだけに意味がある。ダッシュボードのデータに色を使い、クローム(枠組み)はニュートラルに保つ
- **プライマリ(ダークモード):** amber-500 #F59E0B。温かく活気があり、「ターミナルのカーソル」を思わせる
- **プライマリ(ライトモード):** amber-600 #D97706。白い背景に対してコントラストが出るよう、やや濃くする
- **プライマリのテキストアクセント(ダークモード):** amber-400 #FBBF24
- **プライマリのテキストアクセント(ライトモード):** amber-700 #B45309
- **ニュートラル:** 冷たい亜鉛グレー
  - zinc-50: #FAFAFA(最も明るい)
  - zinc-400: #A1A1AA
  - zinc-600: #52525B
  - zinc-800: #27272A
  - サーフェス(ダーク): #141414
  - ベース(ダーク): #0C0C0C
  - サーフェス(ライト): #FFFFFF
  - ベース(ライト): #FAFAF9
- **セマンティック:** success #22C55E、warning #F59E0B、error #EF4444、info #3B82F6
- **ダークモード:** デフォルト。ほぼ黒のベース(#0C0C0C)、カードのサーフェスは #141414、ボーダーは #262626。
- **ライトモード:** 温かみのあるストーンのベース(#FAFAF9)、白いカードのサーフェス、ストーン色のボーダー(#E7E5E4)。アンバーのアクセントは、コントラストのために amber-600 に変わる。

## タイポグラフィ

- **ディスプレイ/ヒーロー:** Satoshi(Black 900 / Bold 700)。幾何学的だが温かみがあり、特徴的な字形(小文字の 'a' と 'g')を持つ。Inter でも Geist でもない。Fontshare の CDN から読み込む。
- **本文:** DM Sans(Regular 400 / Medium 500 / Semibold 600)。すっきりして読みやすく、幾何学的なディスプレイ書体よりやや親しみやすい。Google Fonts から読み込む。
- **UI/ラベル:** DM Sans(本文と同じ)
- **データ/表:** JetBrains Mono(Regular 400 / Medium 500)。個性を担うフォント。tabular-nums に対応している。等幅フォントは、コードブロックの中に隠すのではなく、目立たせるべき。Google Fonts から読み込む。
- **コード:** JetBrains Mono
- **読み込み:** DM Sans と JetBrains Mono は Google Fonts、Satoshi は Fontshare から読み込む。`display=swap` を使う。
- **スケール:**
  - Hero: 72px / clamp(40px, 6vw, 72px)
  - H1: 48px
  - H2: 32px
  - H3: 24px
  - H4: 18px
  - 本文: 16px
  - 小: 14px
  - キャプション: 13px
  - マイクロ: 12px
  - ナノ: 11px(JetBrains Mono のラベル)

## レイアウト

- **アプローチ:** ダッシュボードはグリッドで厳密に、ランディングページはエディトリアル風のヒーローにする
- **グリッド:** lg 以上は 12 カラム、モバイルは 1 カラム
- **コンテンツの最大幅:** 1200px(6xl)
- **角丸:** sm:4px、md:8px、lg:12px、full:9999px
  - カード/パネル: lg(12px)
  - ボタン/入力欄: md(8px)
  - バッジ/ピル: full(9999px)
  - スキルバー: sm(4px)

### 余白
- **基本単位:** 4px
- **密度:** 快適。詰め込みすぎず(Bloomberg Terminal のようにはしない)、余裕を持たせすぎず(マーケティングサイトのようにはしない)
- **スケール:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## モーション

- **アプローチ:** 最小限で機能的。理解を助けるトランジションだけを使う。ダッシュボードのライブフィードそのものがモーション
- **イージング:** enter(ease-out / cubic-bezier(0.16,1,0.3,1))、exit(ease-in)、move(ease-in-out)
- **所要時間:** micro(50〜100ms)、short(150ms)、medium(250ms)、long(400ms)
- **アニメーションする要素:** ライブフィードのドットの点滅(2s 無限)、スキルバーの塗りつぶし(600ms ease-out)、ホバー状態(150ms)

## グレインのテクスチャ

素材感を出すため、ページ全体にごく薄いノイズのオーバーレイを敷きます:
- ダークモード: 不透明度 0.03
- ライトモード: 不透明度 0.02
- SVG の feTurbulence フィルターを、body::after の CSS background-image として使う
- pointer-events: none、position: fixed、z-index: 9999

## 決定ログ

| 日付 | 決定 | 根拠 |
|------|----------|-----------|
| 2026-03-21 | 初期のデザインシステム | /design-consultation で作成。インダストリアルな雰囲気、温かいアンバーのアクセント、Satoshi + DM Sans + JetBrains Mono。 |
| 2026-03-21 | ライトモードは amber-600 | amber-500 は白に対して明るすぎ、ぼやける。amber-700 は茶色すぎて土色がかる。amber-600 がちょうど良い。 |
| 2026-03-21 | グレインのテクスチャ | 平坦なダークのサーフェスに素材感を加える。「よくある SaaS テンプレート」の均質さを防ぐ。 |
| 2026-09-08 | オープンな DESIGN.md 形式 | `gstack-design-md convert` で変換。トークンはフロントマターに、正規のセクションを使い、Motion と決定ログは追加のセクションとして残した。DM Sans は本文の書体として残す。ディスプレイ用に乱用されがちな書体のリストに入っているが、Operate サーフェスでの本文/UI への使用は、役割を限定したルールの下で認められた例外である。 |
| 2026-09-08 | ライブフィードの点滅が、意図的に加えた唯一のモーションの瞬間 | ライブフィードのドットの 2s の点滅が、唯一意図的に加えたモーションの瞬間である。点滅するドットのカタログルールに対する意図的な例外。スキルバーの塗りつぶしと 150ms のホバートランジションは、機能的な状態の遷移であり、意図的な瞬間ではない。 |
| 2026-09-08 | JetBrains Mono のデータラベルは 11px | Nano(11px)のデータラベルは JetBrains Mono で表示される。これは 12px という UI テキストの下限を下回る。UI ラベルは DM Sans のままにする(`typography.label` トークン)。検出器の「小さすぎる UI テキスト」と「等幅フォントの仮装」の行を、未解決ではなく決定済みとして読めるように記録しておく。 |
