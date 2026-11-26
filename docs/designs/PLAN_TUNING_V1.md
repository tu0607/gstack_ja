# Plan Tuning v1 — 設計ドキュメント

**ステータス:** 実装として承認済み(2026-04-18)
**ブランチ:** garrytan/plan-tune-skill
**作成者:** Garry Tan(ユーザー)。AI によるレビューは Claude Opus 4.7 + OpenAI Codex gpt-5.4 による。
**スコープの置き換え:** [PLAN_TUNING_V0.md](./PLAN_TUNING_V0.md)(観察のためのサブストレート)の上に、文章スタイルと LOC レシートの層を加える。V0 はそのまま残す。
**関連:** [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) — 切り出されたペーシングの見直し、V1.1 の計画。

## このドキュメントについて

/plan-tune v1 が何であり、何でないか、何を検討し、なぜそれぞれの判断をしたかの正式な記録。将来のコントリビューター(および未来の Garry)が、古い資料を掘り起こさずに理由をたどれるように、リポジトリにコミットしている。ユーザーごとのローカルの計画の成果物は、すべてこれで置き換える。

## クレジット

この計画は **[Louise de Sadeleer](https://x.com/LouiseDSadeleer/status/2045139351227478199)** のおかげで生まれた。彼女は非技術者として gstack の一連の実行に最後まで付き合い、それがどう感じられたかを率直に教えてくれた。彼女のフィードバックは次のとおり。

1. 「しばらくすると少し疲れてきたし、ちょっと堅苦しく感じた。」 — *ペーシング/疲労*
2. 「I'm just gonna say yes yes yes」(アーキテクチャのレビュー中)。 — *関与の低下*
3. 「彼が自分が書いたコードの行数を強調しているのが面白い。もちろん AI が彼のために生み出したものなのに。」 — *LOC の枠組み*
4. 「エンジニアでない私には、これは少し分かりにくい。」 — *専門用語の密度 + 結果の枠組み*

V1 は #3 と #4 に直接対応する。用語の説明と、結果を中心にした文章で、実在の人が読み手のために書いたように読めるものにする。そして LOC の枠組みを、根拠のあるものに改める。Louise の #1 と #2(ペーシング/疲労)には、別のデザインのラウンドが必要。[PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) に V1.1 の計画として切り出した。

## 機能の概要(1段落)

gstack のスキルの出力こそがプロダクトである。文章が非技術者の創業者にとって読みにくければ、彼らはレビューから離脱し、「yes yes yes」とクリックしてしまう。V1 は、tier ≥ 2 のすべてのスキルに適用される文章スタイルの基準を加える。用語は初めて出てきたときに説明する(厳選された約 50 語のリストから)。質問は「ユーザーに何が起きると困るか」といった結果の観点で書き、実装の用語では書かない。文は短く、名詞は具体的にする。V0 のより簡潔な文章を望むパワーユーザーは、`gstack-config set explain_level terse` を設定できる。バイナリのスイッチであり、中間のモードはない。さらに README にある「製品コード 60 万行以上」という枠組みは、Louise に LOC の誇示だと指摘されたため、`scc` を使った、2013 年と 2026 年の按分の倍率の計算値に置き換える。公開リポジトリと非公開リポジトリの可視性についての正直な注意書きを添える。

## なぜより小さいバージョンにしたのか

V1 は、複数のレビューを経て、4 回の大きなスコープの見直しを経験した。最終的なスコープは、どの中間バージョンよりも小さい。レビューのパスを重ねるたびに、本当の問題が見つかったからだ。

**見直し 1 — 4 段階の経験の軸(却下)。** 元の提案: 初回実行時に、ユーザーに自分が経験豊富な開発者か、単独での経験がないエンジニアか、チームで出荷した非技術者か、完全な非技術者かを尋ねる。スキルは各レベルに適応する。CEO レビューの前提の挑戦の段階で却下された。理由: (a) オンボーディングの質問が、V1 がまさに摩擦を減らそうとしている瞬間に、摩擦を増やす。(b)「自分はどのレベルか」は、もっとも助けを必要とするユーザーにとって、それ自体が分かりにくい質問である。(c) 技術の専門性は一次元ではない(CSS では設計者のレベル A、デプロイではレベル D、ということがある)。(d) エンジニアも、非技術者と同じ文章の基準の恩恵を受ける。

**見直し 2 — ELI10 がデフォルト、terse で無効化(採用)。** すべてのスキルの出力は、文章の基準をデフォルトとする。V0 の文章を望むパワーユーザーは `explain_level: terse` を設定する。Codex の第 1 パスは、重大な欠陥(静的な Markdown のゲート、ホストごとのパス、README の更新の仕組み)を指摘した。3 つすべてを取り込んだ。

**見直し 3 — ELI10 + レビューのペーシングの見直し(提案、後に縮小)。** ペーシングの作業を追加した。指摘を順位付けし、二択のドアを自動承認し、フェーズごとに AskUserQuestion を最大 3 件に制限し、Silent Decisions ブロックと flip コマンドを用意する。Louise の #1 と #2 に直接対応することを意図していた。エンジニアリングレビューの第 2 パスで、スコアリングの計算式とパスの一貫性のバグが見つかった。エンジニアリングレビューの第 3 パスと Codex の第 2 パスで、ペーシングの作業に 10 件以上の構造的な欠陥が見つかった。それらは計画の文章の編集では直せなかった。

**見直し 4 — ELI10 + LOC のみ(最終)。** ユーザーはスコープの縮小を選んだ。V1 は文章スタイルと LOC のレシートだけを出荷し、ペーシングは [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) を通じて V1.1 に延期する。これが承認された V1 のスコープ。

一貫したテーマは次のとおり。各レビューのパスは、残りのスコープに構造的な欠陥がなくなるまで、野心を正しく狭めていった。CEO レビューのスコープ縮小モードに合致するが、戦略的な選択によって早い段階で行われたのではなく、エンジニアリングレビューを通じて遅い段階で行われた。

## v1 のスコープ(今回作るもの)

1. **プリアンブルの文章スタイルのセクション**(`scripts/resolvers/preamble.ts`)。6 つのルール: スキル呼び出しごとに、用語は初めて出てきた箇所で説明する。結果の枠組み。短い文、具体的な名詞、能動態。決定は、ユーザーへの影響で締めくくる。用語は、ユーザーが貼り付けていても、初出では無条件に説明する。ユーザーのターンによる上書き(ユーザーが「簡潔に」と言えば、その応答では省く)。
2. **リポジトリが管理する用語リスト**(`scripts/jargon-list.json`)。厳選された約 50 語の、頻出の技術用語。リストにない用語は、平易な英語とみなす。用語は `gen-skill-docs` の時点で生成された SKILL.md の文章にインライン化する(実行時のコストはゼロ)。
3. **terse による無効化**(`gstack-config set explain_level terse`)。二値: `default` と `terse`。terse では文章スタイルのブロック全体を省き、V0 の文体を使う。
4. **ホストを意識したプリアンブルのエコー。** `_EXPLAIN_LEVEL=$(${binDir}/gstack-config get explain_level 2>/dev/null || echo "default")`。既存の V0 の `ctx.paths.binDir` のパターンを通じて、ホストに依存しない。
5. **gstack-config の検証。** ヘッダーに `explain_level: default|terse` を文書化する。値をホワイトリストで検証する。未知の値は、具体的なメッセージとともに警告し、`default` にフォールバックする。
6. **README の LOC の枠組みの変更。** 「60 万行以上の製品コード」というヒーローの枠組みを削除する。`<!-- GSTACK-THROUGHPUT-PLACEHOLDER -->` のアンカーを挿入する。ビルド時のスクリプトがアンカーを、計算された倍率と注意書きに置き換える。
7. **`scc` を使ったスループットのスクリプト**(`scripts/garry-output-comparison.ts`)。2013 年と 2026 年のそれぞれについて、Garry が書いた公開コミットを列挙し、`git diff` から追加された行を抽出し、`scc --stdin`(または正規表現のフォールバック)で分類する。`docs/throughput-2013-vs-2026.json` に、言語ごとの内訳と注意書きを出力する。
8. **`scc` の単独のインストールスクリプト**(`scripts/setup-scc.sh`)。`package.json` の依存関係にはしない(本当に任意。ユーザーの 95% はスループットを実行しない)。OS を検出し、`brew install scc` / `apt install scc` を実行するか、GitHub のリリースへのリンクを表示する。
9. **README の更新パイプライン**(`scripts/update-readme-throughput.ts`)。`docs/throughput-2013-vs-2026.json` があれば読み込み、アンカーを計算された数値に置き換える。なければ、CI が拒否する `GSTACK-THROUGHPUT-PENDING` のマーカーを書く。これにより、コミット前にコントリビューターがスクリプトを実行することを強制する。
10. **/retro に、論理的な SLOC と重み付けしたコミットを、生の LOC より上に加える。** 生の LOC は文脈のために残すが、視覚的には目立たなくする。
11. **アップグレードの移行**(`gstack-upgrade/migrations/v<VERSION>.sh`)。アップグレード後に一度だけ、対話的なプロンプトを出す。V0 の文章に戻したいユーザー向けに、`explain_level: terse` を提案する。フラグファイルで実行を制御する。
12. **文書化。** CLAUDE.md に文章スタイルのセクションを加える(プロジェクトの規約)。CHANGELOG.md に V1 のエントリを加える(ユーザー向けの語り口で、スコープの縮小と V1.1 のペーシングに触れる)。README.md に文章スタイルの説明セクションを加える(約 80 語)。CONTRIBUTING.md に、用語リストの維持についての注記を加える(用語の追加・削除の PR)。
13. **テスト。** 新しいテストファイル 6 件と、既存の `gen-skill-docs.test.ts` の拡張。LLM ジャッジによる E2E を除き、すべて gate tier(LLM ジャッジは periodic)。
14. **V0 の休眠状態の否定テスト。** 5D の次元名と 8 つのアーキタイプ名が、デフォルトモードのスキルの出力に現れないことを確認する。V0 の心理特性の仕組みが V1 に漏れ出すのを防ぐ。
15. **V1 と V1.1 の設計ドキュメント。** PLAN_TUNING_V1.md(この文書)。PACING_UPDATES_V0.md(V1.1 の計画。V1 の実装中に、抽出した付録から作成)。TODOS.md の P0 のエントリ。

## 延期

**V1.1 へ(明示的に、専用の設計ドキュメントとともに):**
- レビューのペーシングの見直し(順位付け、自動承認、フェーズごとに最大 3 件、Silent Decisions ブロック、flip の仕組み)。理由: [PACING_UPDATES_V0.md](./PACING_UPDATES_V0.md) の「抽出された理由」を参照。計画文だけでは直せない 10 件以上の構造的な欠陥がある。
- プリアンブルの初回メタプロンプトの監査(Lake の紹介、テレメトリ、proactive、ルーティング)。Louise は初回実行時にそのすべてを見た。それらは疲労として数えられる。V1.1 は、N 回目のセッションまで抑制することを検討する。

**V2 へ(またはそれ以降):**
- question-log からの混乱のシグナルの検出。オンザフライの翻訳の提案を引き起こす。
- 5D の心理特性に基づくスキルの適応(V0 E1 の項目)。
- /plan-tune narrative + /plan-tune vibe(V0 E3 の項目)。
- スキルごと、またはトピックごとの説明レベル。
- チームのプロファイル。
- AST ベースの「配送された機能」の指標。

## 完全に却下(検討したが、やらないもの)

- **4 段階の宣言された経験の軸(A/B/C/D)。** CEO レビューの前提の挑戦で却下。上の「なぜより小さいバージョンにしたのか」を参照。
- **新しいリゾルバーファイルとしての ELI10(`scripts/resolvers/eli10-writing.ts`)。** Codex の第 1 パスが、プリアンブルの AskUserQuestion の書式のセクションにある既存の「賢い 16 歳」という枠組みとの衝突を指摘。代わりに既存のプリアンブルに組み込む。
- **実行時の文章スタイルのブロックの抑制。** Codex の第 1 パスが、`gen-skill-docs` は静的な Markdown を出力することを指摘。一度焼き込まれた内容は、後から隠せない。解決策: 条件付きの文章のゲート(V0 の `QUESTION_TUNING` のゲートと同じ種類の、プロンプトの約束事)。
- **デフォルトと terse の中間の文章モード。** 改訂 3 では「terse = 用語の説明はないが、結果の枠組みは残す」と提案された。Codex の第 2 パスが、移行のメッセージとの矛盾を指摘。二値にする。terse = V0 の文章、それだけ。
- **実行時にユーザーが編集できる用語リスト。** 改訂 3 では、`~/.gstack/jargon-list.json` をユーザーの上書きとして提案された。Codex の第 2 パスが、生成時のインライン化との矛盾を指摘。解決: リポジトリが管理するものだけ。PR で追加・削除し、再生成して反映する。
- **`package.json` の `devDependencies.optional` フィールド。** npm/bun の正式なフィールドではない。エンジニアリングレビューの第 2 パスが指摘。代わりに単独のインストールスクリプトにする。
- **README の置き換えアンカーと CI の拒否マーカーに同じ文字列を使うこと。** エンジニアリングレビューの第 2 パスと Codex の第 2 パスが、パイプラインが自分自身の更新の経路を壊すことを指摘。2 つの文字列による解決: `GSTACK-THROUGHPUT-PLACEHOLDER`(アンカー、実行をまたいで安定)と `GSTACK-THROUGHPUT-PENDING`(ビルドが実行されなかったことを示す明示的なマーカー。CI が拒否する)。
- **受け入れ基準「すべての技術用語に説明をつける」。** Codex の第 2 パスが、厳選リストの規則との矛盾を指摘。基準を規則に合うように書き直した: 「`scripts/jargon-list.json` にある用語で、出現するものはすべて説明がつく」。
- **受け入れ基準「/autoplan ごとに AskUserQuestion は 12 件以下」。** V1 から削除。この目標には、いま V1.1 にあるペーシングの見直しが必要。

## アーキテクチャ

```
~/.gstack/
  developer-profile.json           # unchanged from V0
  config.yaml                       # + explain_level key (default | terse)

scripts/
  jargon-list.json                  # NEW: ~50 repo-owned terms (gen-time inlined)
  garry-output-comparison.ts        # NEW: scc + git per-year, author-scoped
  update-readme-throughput.ts       # NEW: README anchor replacement
  setup-scc.sh                      # NEW: OS-detecting scc installer
  resolvers/preamble.ts             # MODIFIED: Writing Style section + EXPLAIN_LEVEL echo

docs/
  designs/PLAN_TUNING_V1.md         # NEW: this file
  designs/PACING_UPDATES_V0.md      # NEW: V1.1 plan (extracted)
  throughput-2013-vs-2026.json      # NEW: computed, committed

~/.claude/skills/gstack/bin/
  gstack-config                     # MODIFIED: explain_level header + validation

gstack-upgrade/migrations/
  v<VERSION>.sh                     # NEW: V0 → V1 interactive prompt
```

### データフロー

```
User runs tier-≥2 skill
       │
       ▼
Preamble bash (per-invocation):
  _EXPLAIN_LEVEL=$(${binDir}/gstack-config get explain_level 2>/dev/null || "default")
  echo "EXPLAIN_LEVEL: $_EXPLAIN_LEVEL"
       │
       ▼
Generated SKILL.md body (static Markdown, baked at gen-skill-docs):
  - AskUserQuestion Format section (existing V0)
  - Writing Style section (NEW, conditional prose gate)
       │
       ├── "Skip if EXPLAIN_LEVEL: terse OR user says 'be terse' this turn"
       ├── 6 writing rules (jargon, outcome, short, impact, first-use, override)
       └── Jargon list inlined from scripts/jargon-list.json
       │
       ▼
Agent applies or skips based on runtime EXPLAIN_LEVEL + user-turn signal
       │
       ▼
V0 QUESTION_TUNING + question-log + preferences unchanged
       │
       ▼
Output to user (gloss-on-first-use, outcome-framed, short sentences; or V0 prose if terse)
```

### データフロー: スループットのスクリプト(ビルド時)

```
bun run build
   │
   ├── gen:skill-docs (regenerates SKILL.md files with jargon list inlined)
   ├── update-readme-throughput (reads JSON if present; replaces anchor OR writes PENDING marker)
   └── other steps (binary compilation, etc.)

Separately, on-demand:
bun run scripts/garry-output-comparison.ts
   │
   ├── scc preflight (if missing → exit with setup-scc.sh hint)
   ├── For 2013 + 2026: enumerate Garry-authored commits in public garrytan/* repos
   ├── For each commit: git diff, extract ADDED lines, classify via scc --stdin
   └── Write docs/throughput-2013-vs-2026.json (per-language + caveats)
```

## セキュリティとプライバシー

- **新しいユーザーデータはなし。** V1 はプリアンブルの文章と設定キーを拡張するだけ。個人データは新たに収集しない。
- **機微なデータの実行時の読み取りはなし。** 用語リストは、リポジトリにコミットされた厳選されたリスト。
- **移行スクリプトは一度きり。** フラグファイルによって、再実行を防ぐ。
- **scc は公開リポジトリにのみ実行する。** 非公開の作業へのアクセスはない。

## 決定のログ(長所と短所つき)

### 決定 A: 4 段階の経験の軸 vs. デフォルトとしての ELI10 — 答え: デフォルトとしての ELI10

**4 段階の軸(却下):** 初回実行時に、ユーザーに A/B/C/D で自己申告させる。スキルはレベルごとに適応する。
- 長所: 明示的なユーザーの主権。パワーユーザーは V0 の振る舞いを得られる。
- 短所: オンボーディングの摩擦が増える。ユーザーに自分をラベル付けさせる。技術の専門性は一次元ではない。エンジニアも、非技術者と同じ文章の基準の恩恵を受ける。

**terse で無効化する ELI10 がデフォルト(採用):** すべてのスキルの出力は、文章の基準をデフォルトとする。パワーユーザーは `explain_level: terse` を設定する。
- 長所: オンボーディングの質問がない。良い文章は全員の恩恵になる。パワーユーザーにも逃げ道がある。
- 短所: アップグレード時に V0 の振る舞いが黙って変わる → 移行のプロンプトが必要。

### 決定 B: 新しいリゾルバーファイル vs. 既存のプリアンブルを拡張 — 答え: 既存を拡張

**新しいリゾルバー(却下):** `scripts/resolvers/eli10-writing.ts` を別の生成器として作る。
- 長所: モジュール化できる。
- 短所(Codex #7): プリアンブルの AskUserQuestion の書式にある既存の「賢い 16 歳」という枠組みと衝突する。情報源が二つになる。

**プリアンブルを拡張(採用):** `scripts/resolvers/preamble.ts` に、AskUserQuestion の書式のすぐ下に、文章スタイルのセクションを直接加える。
- 長所: 情報源が一つ。既存のルールと組み合わさる。
- 短所: `preamble.ts` が大きくなる。

### 決定 C: 実行時の抑制 vs. 条件付きの文章のゲート — 答え: 条件付きの文章のゲート

**実行時の抑制(却下):** プリアンブルが `explain_level` を読み、抑制のロジックを発動させる。
- 長所: メンタルモデルが単純。
- 短所(Codex #1): `gen-skill-docs` は静的な Markdown を出力する。一度焼き込まれると、内容を後から隠すことはできない。実行時の抑制は作り話である。

**条件付きの文章のゲート(採用):** 「EXPLAIN_LEVEL: terse のとき、またはユーザーがこのターンで『簡潔に』と言ったときは、このブロックを省く」。プロンプトの約束事。エージェントが実行時に従うか、従わないか。
- 長所: テストできる。V0 の `QUESTION_TUNING` のパターンと一致する。仕組みについて正直である。
- 短所: エージェントがプロンプトに従うことに依存する(実行時の強制はない)。

### 決定 D: 用語リストの場所 — 実行時にユーザーが編集可能 vs. リポジトリが管理し生成時に適用 — 答え: リポジトリが管理し生成時に適用

**実行時にユーザーが編集可能(却下):** `~/.gstack/jargon-list.json` が `scripts/jargon-list.json` を上書きする。
- 長所: ユーザーが自分の分野に特有の用語を追加できる。
- 短所(Codex #4、第 2 パス): 生成時のインライン化では、ユーザーの編集には再生成が必要。矛盾する。

**リポジトリが管理し、生成時にインライン化(採用):** `scripts/jargon-list.json` のみ。追加・削除は PR で行う。`bun run gen:skill-docs` が用語をプリアンブルの文章にインライン化する。
- 長所: 情報源が一つ。実行時のコストがゼロ。既存のビルドと組み合わさる。
- 短所: ユーザーはローカルで用語を追加できない。緩和策: CONTRIBUTING.md に文書化する。PR を受け付ける。

### 決定 E: V1 でのペーシングの見直し vs. V1.1 — 答え: V1.1(切り出し)

**V1 でのペーシング(却下):** ランキング、自動承認、Silent Decisions、フェーズごとに最大 3 件の上限、flip の仕組みをまとめて入れる。
- 長所: Louise の疲労に直接対応する。
- 短所(エンジニアリングレビューの第 3 パス + Codex の第 2 パス): 計画の文章の編集では直せない 10 件以上の構造的な欠陥。セッション状態のモデルが未定義。question-log に `phase` フィールドがない。レジストリがレビューの動的な指摘をカバーしない。flip の仕組みに実装がない。移行のプロンプトそのものが割り込みになる。初回のプリアンブルのプロンプトも数に入る。ペーシングを散文で書いても、既存の順次の質問の実行順序は反転できない。

**V1.1 へ切り出す(採用):** V1 では ELI10 と LOC を出荷する。ペーシングは、完全なレビューのサイクルを伴う独自のデザインのラウンドを経る。
- 長所: V1 を誠実に出荷できる。V1 の利用から、V1.1 のための実際のベースラインデータ(Louise の V1 のトランスクリプト)が得られる。CEO レビューのスコープ縮小モードに一致する。
- 短所: Louise の疲労の不満は、V1.1 まで完全には解決しない。緩和策: V1 でも文章の質を通じて彼女の体験は改善する。V1.1 でペーシングを追って対応する。

### 決定 F: README の更新の仕組み — 単一の文字列 vs. 二つの文字列 — 答え: 二つの文字列

**単一の文字列(却下):** `<!-- GSTACK-THROUGHPUT-MULTIPLE: N× -->` を、置き換えのアンカーと CI の拒否マーカーの両方として使う。
- 長所: 単純。
- 短所(Codex 第 2 パス): パイプラインが自分自身を壊す。CI はマーカーを含むコミットを拒否するが、マーカーこそがアンカーである。

**二つの文字列(採用):** `GSTACK-THROUGHPUT-PLACEHOLDER`(アンカー、安定)+ `GSTACK-THROUGHPUT-PENDING`(ビルドが実行されなかったことを示す明示的なマーカー。CI が拒否する)。
- 長所: アンカーは残る。CI は実際の失敗の状態を捉える。
- 短所: 覚える記号が二つある。

## レビューの記録

| レビュー | 実行回数 | ステータス | 取り込んだ主な指摘 |
|---|---|---|---|
| CEO レビュー | 1 | CLEAR(スコープを維持) | 前提の転換: 4 段階の軸 → デフォルトとしての ELI10。クロスモデルの対立は、ユーザーの明示的な選択によって解決。 |
| Codex レビュー | 2 | ISSUES_FOUND + スコープ縮小を促した | 第 1 パス: 25 件の指摘、重大な障害 3 件(静的な Markdown、ホストのパス、README の仕組み)。第 2 パス: 修正後の計画に対する 20 件の指摘。V1.1 への切り出しを促した。 |
| Eng レビュー | 3 | CLEAR(スコープ縮小済み) | 第 1 パス: 重大なギャップ + 3 件の判断(すべて A)。第 2 パス: スコアリングの計算式のバグ、パスの矛盾、存在しない `devDependencies.optional` フィールド。第 3 パス: ペーシングの構造的な欠陥を特定し、切り出しを促した。 |
| DX レビュー | 1 | CLEAR(トリアージ) | 重大 3 件(文書の計画、アップグレードの移行、ヒーローの瞬間)。9 件を自動承認し、Silent DX Decisions とした。 |

レビューのレポートは、`gstack-review-log` を通じて `~/.gstack/` に保存する。全履歴を含む計画ファイルは `~/.claude/plans/system-instruction-you-are-working-transient-sunbeam.md` に残す。
