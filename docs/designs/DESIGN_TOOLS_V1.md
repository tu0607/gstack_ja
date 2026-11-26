
# 設計: gstack のビジュアルデザイン生成(`design` バイナリ)

2026-03-26 に /office-hours で生成
ブランチ: garrytan/agent-design-tools
リポジトリ: gstack
ステータス: DRAFT
モード: 社内起業(Intrapreneurship)

## 背景

gstack のデザイン系スキル(/office-hours、/design-consultation、/plan-design-review、/design-review)は、いずれもデザインを**テキストの説明**として出力します。DESIGN.md には 16 進数のカラーコード、計画ドキュメントには文章で書かれたピクセル指定、ASCII アートのワイヤーフレームがあります。作成者はデザイナーで、HelloSign を OmniGraffle で手作業でデザインした経験があり、この現状を「みっともない」と感じています。

価値の単位が間違っています。ユーザーに必要なのは、より豊かなデザイン用語ではありません。実行可能な視覚的成果物です。それによって、会話を「この仕様は好みですか?」から「これが画面ですか?」へ変えられます。

## 課題の定義

デザインのスキルは、デザインを見せる代わりに文章で記述しています。Argus の UX 全面改修の計画がその例です。487 行の感情の流れの仕様、タイポグラフィの選択、アニメーションのタイミングが詳細に書かれていますが、視覚的な成果物はゼロです。「デザインする」AI コーディングエージェントは、直感的に反応できるものを見せるべきです。

## 需要の根拠

作成者であり主な利用者が、現在の出力を「みっともない」と感じています。デザインのスキルのセッションはどれも、モックアップであるべき場所に散文で終わります。GPT Image API は今や、テキストの描画が正確なピクセル単位の UI モックアップを生成できます。テキストだけの出力を正当化していた能力のギャップは、もう存在しません。

## 最も狭いくさび

`$D`(`$B` ブラウズバイナリのパターンに倣う)として、スキルのテンプレートから呼び出せる、OpenAI Images/Responses API をラップしたコンパイル済みの TypeScript バイナリ(`design/dist/design`)。統合の優先順は /office-hours → /plan-design-review → /design-consultation → /design-review。

## 合意した前提

1. エンジンは GPT Image API(OpenAI Responses API 経由)が正しい選択。Google Stitch SDK はバックアップ。
2. **デザインのモックアップは、デザインのスキルでデフォルトで有効。** 簡単にスキップできる経路付き。オプトインではない。(Codex の指摘を受けて改訂。)
3. 統合は共有のユーティリティとして行う(スキルごとの再実装ではない)。どのスキルも呼び出せる `design` バイナリとして作る。
4. 優先順位: /office-hours が最初、次に /plan-design-review、/design-consultation、/design-review。

## 別の視点(Codex)

Codex が中核の主張を独立に検証しました。「失敗は Markdown の中の出力の質ではない。価値の単位が間違っていることだ。」Codex の主な貢献:
- 前提 #2(オプトイン → デフォルト有効)に異議を唱え、受け入れた
- ビジョンベースの品質ゲートを提案: GPT-4o のビジョンでモックアップを検証する(読めないテキスト、欠けているセクション、崩れたレイアウトを検出し、1 回だけ自動で再試行する)
- 48 時間のスコープを限定したプロトタイプを提案: 共有の `visual_mockup.ts` ユーティリティ、/office-hours と /plan-design-review のみ、ヒーローのモックアップ 1 枚 + バリアント 2 枚

## 推奨アプローチ: `design` バイナリ(方式 B)

### アーキテクチャ

**browse バイナリのコンパイルと配布のパターンを共有します**(`bun build --compile`、セットアップスクリプト、スキルのテンプレートでの $変数の解決)。ただし、構造はより単純です。永続的なデーモンサーバー、Chromium、ヘルスチェック、トークン認証はありません。design バイナリはステートレスな CLI で、OpenAI API を呼び出し、PNG をディスクに書き出します。複数ターンの反復のためのセッション状態は JSON ファイルです。

**新しい依存関係:** `openai` npm パッケージ(`devDependencies` に追加。runtime の依存には入れない)。design バイナリは browse とは別にコンパイルし、browse のバイナリに openai を膨らませないようにします。

```
design/
├── src/
│   ├── cli.ts            # Entry point, command dispatch
│   ├── commands.ts        # Command registry (source of truth for docs + validation)
│   ├── generate.ts        # Generate mockups from structured brief
│   ├── iterate.ts         # Multi-turn iteration on existing mockups
│   ├── variants.ts        # Generate N design variants from brief
│   ├── check.ts           # Vision-based quality gate (GPT-4o)
│   ├── brief.ts           # Structured brief type + assembly helpers
│   └── session.ts         # Session state (response IDs for multi-turn)
├── dist/
│   ├── design             # Compiled binary
│   └── .version           # Git hash
└── test/
    └── design.test.ts     # Integration tests
```

### コマンド

```bash
# Generate a hero mockup from a structured brief
$D generate --brief "Dashboard for a coding assessment tool. Dark theme, cream accents. Shows: builder name, score badge, narrative letter, score cards. Target: technical users." --output /tmp/mockup-hero.png

# Generate 3 design variants
$D variants --brief "..." --count 3 --output-dir /tmp/mockups/

# Iterate on an existing mockup with feedback
$D iterate --session /tmp/design-session.json --feedback "Make the score cards larger, move the narrative above the scores" --output /tmp/mockup-v2.png

# Vision-based quality check (returns PASS/FAIL + issues)
$D check --image /tmp/mockup-hero.png --brief "Dashboard with builder name, score badge, narrative"

# One-shot with quality gate + auto-retry
$D generate --brief "..." --output /tmp/mockup.png --check --retry 1

# Pass a structured brief via JSON file
$D generate --brief-file /tmp/brief.json --output /tmp/mockup.png

# Generate comparison board HTML for user review
$D compare --images /tmp/mockups/variant-*.png --output /tmp/design-board.html

# Guided API key setup + smoke test
$D setup
```

**ブリーフの入力モード:**
- `--brief "plain text"` — 自由形式のテキストのプロンプト(シンプルなモード)
- `--brief-file path.json` — `DesignBrief` インターフェースに従う構造化された JSON(詳細なモード)
- スキルは JSON のブリーフファイルを組み立てて /tmp に書き、`--brief-file` で渡す

**すべてのコマンドは `commands.ts` に登録します。** `generate` のフラグとして `--check` と `--retry` を含みます。

### デザイン探索のワークフロー(エンジニアリングレビューより)

ワークフローは並列ではなく順次です。PNG は視覚的な探索用(人間向け)、HTML のワイヤーフレームは実装用(エージェント向け)です。

```
1. $D variants --brief "..." --count 3 --output-dir /tmp/mockups/
   → Generates 2-5 PNG mockup variations

2. $D compare --images /tmp/mockups/*.png --output /tmp/design-board.html
   → Generates HTML comparison board (spec below)

3. $B goto file:///tmp/design-board.html
   → User reviews all variants in headed Chrome

4. User picks favorite, rates, comments, clicks [Submit]
   Agent polls: $B eval document.getElementById('status').textContent
   Agent reads: $B eval document.getElementById('feedback-result').textContent
   → No clipboard, no pasting. Agent reads feedback directly from the page.

5. Claude generates HTML wireframe via DESIGN_SKETCH matching approved direction
   → Agent implements from the inspectable HTML, not the opaque PNG
```

### 比較ボードのデザイン仕様(/plan-design-review より)

**分類: APP UI**(タスク中心のユーティリティページ)。プロダクトのブランディングはなし。

**レイアウト: 1 列、モックアップは全幅。** 各バリアントは画像の忠実度を最大にするため、ビューポートの全幅を使います。ユーザーは縦にスクロールしてバリアントを見ます。

```
┌─────────────────────────────────────────────────────────────┐
│  HEADER BAR                                                 │
│  "Design Exploration" . project name . "3 variants"         │
│  Mode indicator: [Wide exploration] | [Matching DESIGN.md]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              VARIANT A (full width)                    │  │
│  │         [ mockup PNG, max-width: 1200px ]              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ (●) Pick   ★★★★☆   [What do you like/dislike?____]   │  │
│  │            [More like this]                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              VARIANT B (full width)                    │  │
│  │         [ mockup PNG, max-width: 1200px ]              │  │
│  ├───────────────────────────────────────────────────────┤  │
│  │ ( ) Pick   ★★★☆☆   [What do you like/dislike?____]   │  │
│  │            [More like this]                            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ... (scroll for more variants)                             │
│                                                             │
│  ─── separator ─────────────────────────────────────────    │
│  Overall direction (optional, collapsed by default)         │
│  [textarea, 3 lines, expand on focus]                       │
│                                                             │
│  ─── REGENERATE BAR (#f7f7f7 bg) ───────────────────────    │
│  "Want to explore more?"                                    │
│  [Totally different]  [Match my design]  [Custom: ______]   │
│                                          [Regenerate ->]    │
│  ─────────────────────────────────────────────────────────  │
│                                        [ ✓ Submit ]         │
└─────────────────────────────────────────────────────────────┘
```

**ビジュアルの仕様:**
- 背景: #fff。影なし、カードの枠線なし。バリアントの区切り: 1px の #e5e5e5 の線。
- タイポグラフィ: システムフォントのスタック。ヘッダー: 16px のセミボールド。ラベル: 14px のセミボールド。フィードバックのプレースホルダ: 13px のレギュラー #999。
- 星評価: クリック可能な星 5 つ。塗りつぶし=#000、未塗りつぶし=#ddd。色はつけず、アニメーションもなし。
- ラジオボタン「Pick」: 明示的なお気に入りの選択。バリアントごとに 1 つ、排他的。
- 「More like this」ボタン: バリアントごとに用意し、そのバリアントのスタイルを種として再生成をトリガーする。
- Submit ボタン: 背景 #000、文字は白、右寄せ。CTA は 1 つだけ。
- 再生成バー: 背景 #f7f7f7。フィードバックの領域と視覚的に区別する。
- モックアップ画像の最大幅: 1200px、中央揃え。左右の余白: 24px。

**インタラクションの状態:**
- 読み込み中(画像の準備前にページが開く): バリアントごとに「Generating variant A...」のスケルトンのパルス表示。星、テキストエリア、Pick は無効。
- 部分的な失敗(3 件中 2 件が成功): 成功したものを表示し、失敗したものにはバリアントごとの [Retry] 付きのエラーカードを表示。
- 送信後: 「フィードバックを送信しました。コーディングエージェントに戻ってください。」ページは開いたまま。
- 再生成: 滑らかな切り替え。古いバリアントをフェードアウトし、スケルトンがパルスし、新しいバリアントをフェードイン。スクロールは先頭に戻る。以前のフィードバックはクリアされる。

**フィードバックの JSON の構造**(非表示の #feedback-result 要素に書き込む):
```json
{
  "preferred": "A",
  "ratings": { "A": 4, "B": 3, "C": 2 },
  "comments": {
    "A": "Love the spacing, header feels right",
    "B": "Too busy, but good color palette",
    "C": "Wrong mood entirely"
  },
  "overall": "Go with A, make the CTA bigger",
  "regenerated": false
}
```

**アクセシビリティ:** 星評価は矢印キーで操作できること。テキストエリアにはラベルを付ける("Feedback for Variant A")。Submit と Regenerate はキーボードで操作でき、はっきり見えるフォーカスリングを持つこと。テキストはすべて白地に対して #333 以上。

**レスポンシブ:** 1200px 超: ゆったりした余白。768〜1200px: 狭めの余白。768px 未満: 全幅、横スクロールなし。

**スクリーンショットの同意($D evolve で初回のみ):** 「デザインの進化のため、公開中のサイトのスクリーンショットを OpenAI に送信します。[Proceed] [Don't ask again]」同意は `~/.gstack/config.yaml` の design_screenshot_consent に保存。

順次にする理由: Codex の敵対的レビューで、ラスター PNG はエージェントにとって不透明であることが判明しました(DOM がなく、状態がなく、差分が取れる構造もない)。HTML のワイヤーフレームは、コードへの橋渡しを残します。PNG は人間が「はい、それで合っています」と言うためのもの。HTML はエージェントが「どう作ればいいかわかる」と言うためのものです。

### 主要な設計判断

**1. ステートレスな CLI。デーモンではない。**
Browse は永続的な Chromium インスタンスを必要とします。Design は API 呼び出しだけなので、サーバーを持つ理由がありません。複数ターンの反復のためのセッション状態は、`previous_response_id` を含む `/tmp/design-session-{id}.json` という JSON ファイルです。
- **セッション ID:** `${PID}-${timestamp}` から生成し、`--session` フラグで渡す
- **発見:** `generate` コマンドがセッションファイルを作り、そのパスを出力する。`iterate` は `--session` でそれを読む
- **掃除:** /tmp のセッションファイルは一時的なもの(OS が掃除する)。明示的な掃除は不要

**2. 構造化されたブリーフの入力**
ブリーフは、スキルの散文と画像生成の間のインターフェースです。スキルはデザインのコンテキストからブリーフを組み立てます。
```typescript
interface DesignBrief {
  goal: string;           // "Dashboard for coding assessment tool"
  audience: string;       // "Technical users, YC partners"
  style: string;          // "Dark theme, cream accents, minimal"
  elements: string[];     // ["builder name", "score badge", "narrative letter"]
  constraints?: string;   // "Max width 1024px, mobile-first"
  reference?: string;     // Path to existing screenshot or DESIGN.md excerpt
  screenType: string;     // "desktop-dashboard" | "mobile-app" | "landing-page" | etc.
}
```

**3. デザインのスキルでのデフォルト有効**
スキルはデフォルトでモックアップを生成します。テンプレートにはスキップの文言を入れます。
```
Generating visual mockup of the proposed design... (say "skip" if you don't need visuals)
```

**4. ビジョンによる品質ゲート**
生成後、任意で GPT-4o のビジョンに画像を通して、次を確認します。
- テキストの読みやすさ(ラベルや見出しが読めるか)
- レイアウトの完全性(要求された要素がすべてあるか)
- 視覚的な一貫性(本物の UI に見えるか。コラージュではないか)
失敗したら 1 回自動で再試行します。それでも失敗したら、警告を付けて出します。

**5. 出力先: 探索は /tmp、承認された最終版は `docs/designs/`**
- 探索用のバリアントは `/tmp/gstack-mockups-{session}/` へ(一時的、コミットしない)
- ユーザーが承認した最終版のモックアップだけを `docs/designs/` に保存する(チェックインする)
- 既定の出力ディレクトリは、CLAUDE.md の `design_output_dir` 設定で変更可能
- ファイル名のパターン: `{skill}-{description}-{timestamp}.png`
- `docs/designs/` がなければ作る(mkdir -p)
- 設計ドキュメントからは、コミットされた画像のパスを参照する
- 常に Read ツールでユーザーに表示する(Claude Code ではインラインで描画される)
- 探索のバリアントをすべてコミットしないことで、リポジトリが肥大化するのを防ぐ。コミットするのは承認されたデザインだけ
- フォールバック: git リポジトリでなければ `/tmp/gstack-mockup-{timestamp}.png` に保存

**6. 信頼の境界に関する注記**
デフォルトで有効な生成は、デザインのブリーフのテキストを OpenAI に送信します。これは、完全にローカルな既存の HTML ワイヤーフレームの経路に対する、新しい外部へのデータの流れです。ブリーフに含まれるのは抽象的なデザインの記述(目的、スタイル、要素)だけで、ソースコードやユーザーのデータは決して含みません。$B からのスクリーンショットは OpenAI に**送信されません**(DesignBrief の reference フィールドは、エージェントが使うローカルのファイルパスで、API にはアップロードされない)。これを CLAUDE.md に記載する。

**7. レート制限への対策**
バリアントの生成は段階的な並列を使います。各 API 呼び出しを、`Promise.allSettled()` と遅延を使って 1 秒ずつずらして開始します。これは、画像生成の 5〜7 RPM のレート制限を避けつつ、完全な直列より速く進めるためです。呼び出しが 429 になったら、指数バックオフ(2 秒、4 秒、8 秒)で再試行します。

### テンプレートへの統合

**既存のリゾルバに追加:** `scripts/resolvers/design.ts`(新しいファイルではない)
- `{{DESIGN_SETUP}}` プレースホルダ用に `generateDesignSetup()` を追加(`generateBrowseSetup()` を模倣)
- `{{DESIGN_MOCKUP}}` プレースホルダ用に `generateDesignMockup()` を追加(探索のワークフロー全体)
- すべてのデザインのリゾルバを 1 つのファイルに保つ(既存のコードベースの慣習に合わせる)

**新しい HostPaths のエントリ:** `types.ts`
```typescript
// claude host:
designDir: '~/.claude/skills/gstack/design/dist'
// codex host:
designDir: '$GSTACK_DESIGN'
```
注: Codex のランタイムのセットアップ(`setup` スクリプト)も、`GSTACK_BROWSE` と同様に `GSTACK_DESIGN` 環境変数をエクスポートする必要があります。

**`$D` を解決する bash ブロック**(`{{DESIGN_SETUP}}` が生成する):
```bash
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
D=""
[ -n "$_ROOT" ] && [ -x "$_ROOT/.claude/skills/gstack/design/dist/design" ] && D="$_ROOT/.claude/skills/gstack/design/dist/design"
[ -z "$D" ] && D=~/.claude/skills/gstack/design/dist/design
if [ -x "$D" ]; then
  echo "DESIGN_READY: $D"
else
  echo "DESIGN_NOT_AVAILABLE"
fi
```
`DESIGN_NOT_AVAILABLE` の場合、スキルは HTML のワイヤーフレーム生成(既存の `DESIGN_SKETCH` の方式)にフォールバックします。デザインのモックアップは段階的な強化であり、必須の要件ではありません。

**既存のリゾルバへの新しい関数:** `scripts/resolvers/design.ts`
- `{{DESIGN_SETUP}}` 用に `generateDesignSetup()` を追加 — `generateBrowseSetup()` のパターンを踏襲
- `{{DESIGN_MOCKUP}}` 用に `generateDesignMockup()` を追加 — 生成 + チェック + 提示の全体のワークフロー
- すべてのデザインのリゾルバを 1 つのファイルに保つ(既存のコードベースの慣習に合わせる)

### スキルへの統合(優先順位順)

**1. /office-hours** — Visual Sketch のセクションを置き換える
- アプローチの選択(Phase 4)の後、ヒーローのモックアップ 1 枚とバリアント 2 枚を生成する
- 3 枚とも Read ツールで提示し、ユーザーに選ばせる
- 要求があれば反復する
- 選ばれたモックアップを設計ドキュメントと並べて保存する

**2. /plan-design-review** — 「より良くなる姿」
- デザインの項目を 10 点中 7 点未満と評価したら、10 点だとどう見えるかのモックアップを生成する
- 並べて比較: 現状($B によるスクリーンショット)と提案($D によるモックアップ)

**3. /design-consultation** — デザインシステムのプレビュー
- 提案するデザインシステムのビジュアルプレビュー(タイポグラフィ、色、コンポーネント)を生成する
- /tmp の HTML プレビューページを、きちんとしたモックアップに置き換える

**4. /design-review** — デザイン意図の比較
- プラン/DESIGN.md の仕様から「デザイン意図」のモックアップを生成する
- 公開中のサイトのスクリーンショットと比べて、視覚的な差分を見る

### 作成するファイル

| ファイル | 目的 |
|------|------|
| `design/src/cli.ts` | エントリポイント、コマンドのディスパッチ |
| `design/src/commands.ts` | コマンドのレジストリ |
| `design/src/generate.ts` | Responses API による GPT Image の生成 |
| `design/src/iterate.ts` | セッション状態を使った多ターンの反復 |
| `design/src/variants.ts` | N 個のデザインバリアントの生成 |
| `design/src/check.ts` | ビジョンによる品質ゲート |
| `design/src/brief.ts` | 構造化されたブリーフの型 + ヘルパー |
| `design/src/session.ts` | セッション状態の管理 |
| `design/src/compare.ts` | HTML の比較ボードの生成 |
| `design/test/design.test.ts` | 統合テスト(OpenAI API はモック) |
| (なし — 既存の `scripts/resolvers/design.ts` に追加) | `{{DESIGN_SETUP}}` + `{{DESIGN_MOCKUP}}` のリゾルバ |

### 変更するファイル

| ファイル | 変更内容 |
|------|--------|
| `scripts/resolvers/types.ts` | `HostPaths` に `designDir` を追加 |
| `scripts/resolvers/index.ts` | DESIGN_SETUP + DESIGN_MOCKUP のリゾルバを登録 |
| `package.json` | `design` のビルドコマンドを追加 |
| `setup` | browse と一緒に design バイナリをビルド |
| `scripts/resolvers/preamble.ts` | Codex ホスト用に `GSTACK_DESIGN` 環境変数のエクスポートを追加 |
| `test/gen-skill-docs.test.ts` | 新しいリゾルバに合わせて DESIGN_SKETCH のテストスイートを更新 |
| `setup` | design バイナリのビルドと Codex/Kiro のアセットのリンクを追加 |
| `office-hours/SKILL.md.tmpl` | Visual Sketch のセクションを `{{DESIGN_MOCKUP}}` に置き換え |
| `plan-design-review/SKILL.md.tmpl` | `{{DESIGN_SETUP}}` を追加し、低得点の項目でモックアップを生成 |

### 既存のコードの再利用

| コード | 場所 | 用途 |
|------|----------|----------|
| Browse CLI のパターン | `browse/src/cli.ts` | コマンドディスパッチのアーキテクチャ |
| `commands.ts` レジストリ | `browse/src/commands.ts` | 単一の情報源のパターン |
| `generateBrowseSetup()` | `scripts/resolvers/browse.ts` | `generateDesignSetup()` のひな形 |
| `DESIGN_SKETCH` リゾルバ | `scripts/resolvers/design.ts` | `DESIGN_MOCKUP` リゾルバのひな形 |
| HostPaths の仕組み | `scripts/resolvers/types.ts` | ホストごとのパス解決 |
| ビルドパイプライン | `package.json` の build スクリプト | `bun build --compile` のパターン |

### API の詳細

**生成:** `image_generation` ツールを使う OpenAI Responses API
```typescript
const response = await openai.responses.create({
  model: "gpt-4o",
  input: briefToPrompt(brief),
  tools: [{ type: "image_generation", size: "1536x1024", quality: "high" }],
});
// Extract image from response output items
const imageItem = response.output.find(item => item.type === "image_generation_call");
const base64Data = imageItem.result; // base64-encoded PNG
fs.writeFileSync(outputPath, Buffer.from(base64Data, "base64"));
```

**反復:** `previous_response_id` を使う同じ API
```typescript
const response = await openai.responses.create({
  model: "gpt-4o",
  input: feedback,
  previous_response_id: session.lastResponseId,
  tools: [{ type: "image_generation" }],
});
```
**注意:** `previous_response_id` による多ターンの画像反復は、プロトタイプで検証が必要な前提です。Responses API は会話のスレッド化をサポートしていますが、生成された画像の視覚的なコンテキストを編集スタイルの反復で保持するかどうかは、ドキュメントで確認できていません。**フォールバック:** 多ターンがうまくいかなければ、`iterate` は元のブリーフと蓄積したフィードバックをまとめた 1 つのプロンプトで、再生成する形にフォールバックします。

**チェック:** GPT-4o のビジョン
```typescript
const check = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{
    role: "user",
    content: [
      { type: "image_url", image_url: { url: `data:image/png;base64,${imageData}` } },
      { type: "text", text: `Check this UI mockup. Brief: ${brief}. Is text readable? Are all elements present? Does it look like a real UI? Return PASS or FAIL with issues.` }
    ]
  }]
});
```

**費用:** 1 回のデザインセッションあたり約 $0.10〜$0.40(ヒーロー 1 枚 + バリアント 2 枚 + 品質チェック 1 回 + 反復 1 回)。各スキルの呼び出しにすでにかかっている LLM の費用に比べれば無視できる額です。

### 認証(スモークテストで検証済み)

**Codex の OAuth トークンは画像生成には使えません。** 2026-03-26 に検証: Images API も Responses API も、`~/.codex/auth.json` の access_token を "Missing scopes: api.model.images.request" で拒否しました。Codex CLI にもネイティブの画像生成機能はありません。

**認証情報の解決順序:**
1. `~/.gstack/openai.json` → `{ "api_key": "sk-..." }` を読む(ファイルのパーミッションは 0600)
2. 環境変数 `OPENAI_API_KEY` にフォールバックする
3. どちらもなければ、ガイド付きのセットアップの流れへ:
   - ユーザーに伝える: 「デザインのモックアップには、画像生成の権限を持つ OpenAI API キーが必要です。platform.openai.com/api-keys で取得してください」
   - ユーザーにキーの貼り付けを求める
   - `~/.gstack/openai.json` に 0600 のパーミッションで書き込む
   - スモークテストを実行する(1024x1024 のテスト画像を生成して、キーが動くか確認する)
   - スモークテストが通れば先へ進む。失敗したらエラーを表示し、DESIGN_SKETCH にフォールバックする
4. 認証情報はあるのに API 呼び出しが失敗したら → DESIGN_SKETCH(既存の HTML ワイヤーフレームの方式)にフォールバックする。デザインのモックアップは段階的な強化であり、必須の要件であったことは一度もない。

**新しいコマンド:** `$D setup` — ガイド付きの API キーの設定とスモークテスト。いつでも実行でき、キーを更新できます。

## 検証が必要な前提(プロトタイプで確認すること)

1. **画像の品質:** 「ピクセルパーフェクトな UI モックアップ」は理想論です。GPT Image の生成は、実際の UI の忠実度でテキストの描画、位置合わせ、間隔を安定して再現できないかもしれません。ビジョンによる品質ゲートは助けになりますが、「実装の元にできる程度に十分良い」という成功基準は、本格的にスキルに組み込む前にプロトタイプで検証する必要があります。
2. **多ターンの反復:** `previous_response_id` が視覚的なコンテキストを保持するかは、証明されていません(API の詳細の節を参照)。
3. **コストモデル:** 想定の 1 セッションあたり $0.10〜$0.40 は、実際の利用で検証が必要です。

**プロトタイプ検証の計画:** Commit 1(generate + check のコア)を作り、10 種類のデザインのブリーフを、異なる画面の種類で実行し、スキルへの組み込みの前に出力の品質を評価する。

## CEO の拡張スコープ(/plan-ceo-review の SCOPE EXPANSION で承認)

### 1. デザインの記憶 + 探索の幅の制御
- 承認されたモックアップから視覚的な言語を自動抽出し、DESIGN.md に書き出す
- DESIGN.md があれば、今後のモックアップを確立されたデザイン言語の範囲に制約する
- DESIGN.md がなければ(初期状態)、多様な方向性を幅広く探索する
- 段階的な制約: デザインが確立しているほど、探索の幅は狭くなる
- 比較ボードに、探索を制御するための REGENERATE セクションを追加する:
  - 「まったく別のもの」(幅広い探索)
  - 「案 ___ に近いもの」(お気に入りの周辺に絞る)
  - 「既存のデザインに合わせる」(DESIGN.md に制約する)
  - 特定の方向性の変更を指示する自由記述の入力欄
  - 再生成でページを更新し、エージェントが新しい送信をポーリングする

### 2. モックアップの差分
- `$D diff --before old.png --after new.png` で視覚的な差分を生成する
- 変更された領域をハイライトして、並べて表示する
- GPT-4o のビジョンで差分を特定する
- 利用箇所: /design-review、反復のフィードバック、PR のレビュー

### 3. スクリーンショットからモックアップへの進化
- `$D evolve --screenshot current.png --brief "make it calmer"`
- 公開中のサイトのスクリーンショットを取り、「あるべき姿」のモックアップを生成する
- 白紙からではなく、現実から出発する
- /design-review の指摘と、視覚的な修正案をつなぐ架け橋になる

### 4. デザイン意図の検証
- /design-review の間、承認済みのモックアップ(docs/designs/)を公開中のスクリーンショットに重ね、ずれを強調する
- 「あなたは X をデザインし、Y を実装した。その差はここだ」と示す
- デザイン → 実装 → 視覚的な検証、というループを完成させる
- $B のスクリーンショット + $D diff + ビジョン分析を組み合わせる

### 5. レスポンシブのバリアント
- `$D variants --brief "..." --viewports desktop,tablet,mobile`
- 複数のビューポートのサイズでモックアップを自動生成する
- 比較ボードには、同時に承認できるレスポンシブのグリッドを表示する
- モックアップの段階からレスポンシブデザインを第一級の関心事にする

### 6. デザインからコードへのプロンプト
- 比較ボードでの承認の後、実装用の構造化されたプロンプトを自動生成する
- 承認された PNG から、ビジョン分析で色、タイポグラフィ、レイアウトを抽出する
- DESIGN.md と HTML ワイヤーフレームと組み合わせて、構造化された仕様にする
- 「承認されたデザイン」と「エージェントがコーディングを始める」の間の解釈のずれをゼロにする

### 今回のプランの範囲外(将来のエンジン)
- Magic Patterns との統合(既存のデザインからパターンを抽出する)
- Variant API(提供されたら、複数バリエーションの React コードとプレビュー)
- Figma MCP(双方向のデザインファイルアクセス)
- Google Stitch SDK(無料の TypeScript の代替)

## 未解決の質問

1. Variant が API を提供したとき、統合の道筋はどうなるか?(design バイナリ内の別エンジンとしてか、独立した Variant のバイナリとしてか)
2. Magic Patterns はどのように統合するか?($D の別のエンジンとしてか、別のツールとしてか)
3. 複数の生成バックエンドをサポートするには、どの時点で design バイナリにプラグイン/エンジンのアーキテクチャが必要になるか?

## 成功基準

- UI のアイデアに対して `/office-hours` を実行すると、設計ドキュメントと一緒に実際の PNG のモックアップが生成される
- `/plan-design-review` の実行で、「より良くなる姿」がテキストではなくモックアップとして示される
- モックアップは、開発者がそれを元に実装できるくらい十分に良いものである
- 品質ゲートは、明らかに壊れたモックアップを検出し、再試行する
- デザインセッション 1 回あたりの費用は 0.50 ドル未満に収まる

## 配布計画

design バイナリは browse バイナリと一緒にコンパイルして配布します。
- `bun build --compile design/src/cli.ts --outfile design/dist/design`
- `./setup` と `bun run build` の間にビルドする
- 既存の `~/.claude/skills/gstack/` のインストールパスからシンボリックリンクで参照する

## 次のステップ(実装の順序)

### Commit 0: プロトタイプの検証(インフラを作る前に必ず合格すること)
- 3 種類の異なるデザインのブリーフを GPT Image API に送る、単一ファイルのプロトタイプスクリプト(約 50 行)
- 検証項目: テキストの描画の品質、レイアウトの正確さ、視覚的な一貫性
- 出力が UI モックアップとして「ひどい AI アート」レベルなら、止まって、アプローチを見直す
- 8 ファイル分のインフラを作る前に、中核の前提を検証する最も安上がりな方法

### Commit 1: design バイナリのコア(generate + check + compare)
- `design/src/` に cli.ts、commands.ts、generate.ts、check.ts、brief.ts、session.ts、compare.ts を置く
- 認証モジュール(`~/.gstack/openai.json` を読む、環境変数にフォールバック、ガイド付きのセットアップの流れ)
- `compare` コマンドは、バリアントごとのフィードバック用テキストエリアを備えた HTML の比較ボードを生成する
- `package.json` のビルドコマンド(browse とは別の `bun build --compile`)
- `setup` スクリプトとの統合(Codex + Kiro のアセットのリンクを含む)
- モックの OpenAI API サーバーを使った単体テスト

### Commit 2: バリアント + 反復
- `design/src/variants.ts`、`design/src/iterate.ts`
- 段階的な並列生成(開始の間隔 1 秒、429 のときは指数バックオフ)
- 多ターンのためのセッション状態の管理
- 反復の流れとレート制限の処理のテスト

### Commit 3: テンプレートへの統合
- `scripts/resolvers/design.ts` に既存の `generateDesignSetup()` + `generateDesignMockup()` を追加する
- `scripts/resolvers/types.ts` の `HostPaths` に `designDir` を追加する
- `scripts/resolvers/index.ts` に DESIGN_SETUP + DESIGN_MOCKUP を登録する
- `scripts/resolvers/preamble.ts` に GSTACK_DESIGN 環境変数のエクスポートを追加する(Codex ホスト)
- `test/gen-skill-docs.test.ts` を更新する(DESIGN_SKETCH のテストスイート)
- SKILL.md ファイルを再生成する

### Commit 4: /office-hours への統合
- Visual Sketch のセクションを `{{DESIGN_MOCKUP}}` に置き換える
- 順次のワークフロー: バリアントを生成 → $D compare → ユーザーのフィードバック → DESIGN_SKETCH の HTML ワイヤーフレーム
- 承認されたモックアップだけを docs/designs/ に保存する(探索用のものは保存しない)

### Commit 5: /plan-design-review への統合
- 低いスコアの項目に対して、`{{DESIGN_SETUP}}` とモックアップ生成を追加する
- 「10/10 ならこう見える」のモックアップ比較

### Commit 6: デザインの記憶 + 探索の幅の制御(CEO の拡張)
- モックアップの承認後、GPT-4o のビジョンで視覚的な言語を抽出する
- 抽出した色、タイポグラフィ、間隔、レイアウトのパターンで DESIGN.md を書き込む／更新する
- DESIGN.md があれば、今後のすべてのモックアップのプロンプトに制約のコンテキストとして渡す
- 比較ボードの HTML に REGENERATE セクションを追加する(チクレット + 自由記述 + 更新のループ)
- ブリーフの構築における段階的な制約のロジック

### Commit 7: モックアップの差分 + デザイン意図の検証(CEO の拡張)
- `$D diff` コマンド: 2 つの PNG を受け取り、GPT-4o のビジョンで差分を特定し、オーバーレイを生成する
- `$D verify` コマンド: $B でサイトのスクリーンショットを撮り、docs/designs/ の承認済みモックアップと差分を取る
- /design-review のテンプレートへの統合: 承認済みのモックアップがあるとき自動で検証する

### Commit 8: スクリーンショットからモックアップへの進化(CEO の拡張)
- `$D evolve` コマンド: スクリーンショット + ブリーフを受け取り、「あるべき姿」のモックアップを生成する
- スクリーンショットを参照画像として GPT Image API に送る
- /design-review への統合: 「修正後はこう見えるべき」という視覚的な提案

### Commit 9: レスポンシブのバリアント + デザインからコードへのプロンプト(CEO の拡張)
- `$D variants` に `--viewports` フラグを追加し、複数のサイズを生成する
- 比較ボードのレスポンシブのグリッドレイアウト
- 承認後に、構造化された実装プロンプトを自動生成する
- 承認された PNG のビジョン分析で、プロンプトの色、タイポグラフィ、レイアウトを抽出する

## 課題

Variant に API を作らせる。投資家として、こう伝える。「私は、AI エージェントがプログラムからビジュアルデザインを生成するワークフローを作っています。GPT Image API は今日でも動きます。しかし、デザイン探索にはマルチバリエーションのアプローチの方が優れているので、Variant を使いたいと考えています。プロンプトを入れると、React コードとプレビュー画像が出てくる API エンドポイントを出荷してください。最初の統合パートナーになります。」

## 検証

1. `bun run build` で `design/dist/design` バイナリがコンパイルされる
2. `$D generate --brief "Landing page for a developer tool" --output /tmp/test.png` で実際の PNG が生成される
3. `$D check --image /tmp/test.png --brief "Landing page"` が PASS/FAIL を返す
4. `$D variants --brief "..." --count 3 --output-dir /tmp/variants/` で PNG が 3 枚生成される
5. UI のアイデアに対して `/office-hours` を実行すると、インラインでモックアップが生成される
6. `bun test` が通る(スキルの検証、gen-skill-docs)
7. `bun run test:evals` が通る(E2E テスト)

## 私が気づいた、あなたの考え方について

- あなたはテキストの説明や ASCII アートについて「それはデザインじゃない」と言いました。これは、デザイナーの直感です。何かを説明することと、何かを見せることの違いを知っている。デザイナーになったことがない人は、たいていこの差に気づきません。
- あなたは /office-hours を最優先にしました。上流のてこになる地点だからです。ブレインストーミングで本物のモックアップが生まれれば、後続のすべてのスキル(/plan-design-review、/design-review)は、文章を解釈し直す代わりに、参照できる視覚的な成果物を持てます。
- あなたは Variant に投資し、すぐに「彼らには API があるべきだ」と考えました。これは投資家＝ユーザーの思考です。会社を評価しているだけでなく、その製品があなたのワークフローにどう収まるかを設計している。
- Codex が opt-in という前提に異議を唱えたとき、あなたはすぐにそれを受け入れました。自己防衛の気配はありませんでした。それが正解にたどり着く最速の道です。

## 仕様レビューの結果

ドキュメントは、敵対的レビューを 1 ラウンド通過しました。11 件の問題を検出し、修正しました。
品質スコア: 7/10 → 修正後の推定 8.5/10。

修正した問題:
1. OpenAI SDK の依存関係を宣言した
2. 画像データの抽出経路を指定した(response.output の項目の形)
3. --check と --retry のフラグを、コマンドのレジストリに正式に登録した
4. ブリーフの入力モードを指定した(プレーンテキストと JSON ファイル)
5. リゾルバのファイルの矛盾を修正した(既存の design.ts に追加する)
6. HostPaths の Codex 環境変数の設定に注記した
7. 「browse をミラーする」を「コンパイルと配布のパターンを共有する」に言い換えた
8. セッション状態を指定した(ID の生成、発見、掃除)
9. 「ピクセルパーフェクト」をプロトタイプで検証が必要な前提として明記した
10. 多ターンの反復は未証明とし、フォールバック計画を付けた
11. $D の発見のための bash ブロックを、DESIGN_SKETCH へのフォールバックを含めて完全に指定した

## エンジニアリングレビューの完了サマリー

- Step 0: スコープの検討 — スコープは現状のまま承認(バイナリ全体。ユーザーが縮小の推奨を覆した)
- アーキテクチャのレビュー: 5 件の問題を検出(openai の依存の分離、穏やかな縮退、出力ディレクトリの設定、認証モデル、信頼の境界)
- コード品質のレビュー: 1 件の問題を検出(8 ファイル対 5 ファイル。8 ファイルのまま)
- テストのレビュー: 図を作成し、42 件のギャップを特定。テスト計画を作成
- パフォーマンスのレビュー: 1 件の問題を検出(段階的な開始を伴う並列バリアント)
- 対象外: Google Stitch SDK の統合、Figma MCP、Variant API(延期)
- 既存の資産: browse CLI のパターン、DESIGN_SKETCH のリゾルバ、HostPaths の仕組み、gen-skill-docs のパイプライン
- 外部の意見: 4 パス(Claude の構造化レビューで 12 件、Codex の構造化レビューで 8 件、Claude の敵対的レビューで致命的な欠陥 1 件、Codex の敵対的レビューで致命的な欠陥 1 件)。重要な洞察: 順次の PNG → HTML のワークフローで、「ラスター画像は不透明」という致命的な欠陥を解消した
- 失敗モード: 致命的なギャップは 0 件(特定されたすべての失敗モードに、エラー処理とテストの計画がある)
- Lake Score: 推奨 7 件のすべてで、完全な選択肢を選んだ

## GSTACK レビューの報告

| レビュー | 起動 | 理由 | 実行回数 | ステータス | 検出事項 |
|--------|---------|-----|------|--------|----------|
| Office Hours | `/office-hours` | デザインのブレインストーミング | 1 | DONE | 前提 4 件(1 件修正。Codex: opt-in → default-on) |
| CEO Review | `/plan-ceo-review` | スコープと戦略 | 1 | CLEAR | 拡張: 提案 6 件、承認 6 件、延期 0 件 |
| Eng Review | `/plan-eng-review` | アーキテクチャとテスト(必須) | 1 | CLEAR | 7 件の問題、致命的なギャップ 0 件、外部の意見 4 件 |
| Design Review | `/plan-design-review` | UI/UX のギャップ | 1 | CLEAR | スコア: 2/10 → 8/10、5 件の判断 |
| Outside Voice | 構造化 + 敵対的 | 独立した検証 | 4 | DONE | 順次の PNG→HTML のワークフロー、信頼の境界に注記 |

**CEO の拡張:** デザインの記憶 + 探索の幅、モックアップの差分、スクリーンショットからの進化、デザイン意図の検証、レスポンシブのバリアント、デザインからコードへのプロンプト。
**デザインの判断:** 1 列の全幅レイアウト、バリアントごとの「More like this」、明示的なラジオの Pick、滑らかなフェードによる再生成、スケルトンのローディング状態。
**未解決:** 0 件
**結論:** CEO + ENG + DESIGN の承認済み。実装に進める。Commit 0(プロトタイプの検証)から始める。
