# セッション・インテリジェンス層

## 問題

Claude Code のコンテキストウィンドウは一時的なものです。すべてのセッションは毎回まっさらな状態で始まります。約 167K トークンで自動コンパクションが発動すると、一般的な要約は残りますが、ファイルの読み取り、推論の連鎖、途中の決定は失われます。

gstack はすでに、ディスク上に残る価値のある成果物を生成しています。CEO プラン、エンジニアリングレビュー、デザインレビュー、QA レポート、学習内容です。これらのファイルには、現在の作業を形作った決定、制約、コンテキストが含まれています。しかし、Claude はそれらが存在することを知りません。コンパクションの後、すべての判断の拠り所だったプランやレビューは、黙ってコンテキストから消えてしまいます。

エコシステムもこの問題に取り組んでいます。claude-mem(スター 9K 以上)はツールの使用を記録し、将来のセッションにコンテキストを注入します。Claude HUD はエージェントのリアルタイムの状態を表示します。Anthropic 自身の `claude-progress.txt` のパターンでは、エージェントが各セッションの開始時に読む進捗ファイルを使います。

しかし、**スキルが生成した成果物をコンパクションを越えて残す**という具体的な問題を解いているものはありません。gstack のような成果物のアーキテクチャを持つものが他にないからです。

## 着想

gstack は、すでに `~/.gstack/projects/$SLUG/` に構造化された成果物を書き込んでいます。
- CEO プラン: `ceo-plans/`
- デザインレビュー: `design-reviews/`
- エンジニアリングレビュー: `eng-reviews/`
- 学習内容: `learnings.jsonl`
- スキルの利用状況: `../analytics/skill-usage.jsonl`

欠けているのは保存場所ではありません。気づきです。プリアンブルはエージェントに次のことを伝える必要があります。「これらのファイルは存在する。ここには、あなたがすでに行った決定が含まれている。コンパクションの後は、これらを読み直せ」。

## アーキテクチャ

```
                   ┌─────────────────────────────────────┐
                   │        Claude Context Window         │
                   │   (ephemeral, ~167K token limit)     │
                   │                                      │
                   │   Compaction fires ──► summary only   │
                   └──────────────┬──────────────────────┘
                                  │
                          reads on start / after compaction
                                  │
                   ┌──────────────▼──────────────────────┐
                   │    ~/.gstack/projects/$SLUG/         │
                   │    (persistent, survives everything) │
                   │                                      │
                   │  ceo-plans/         ← /plan-ceo-review
                   │  eng-reviews/       ← /plan-eng-review
                   │  design-reviews/    ← /plan-design-review
                   │  checkpoints/       ← /checkpoint (new)
                   │  timeline.jsonl     ← every skill (new)
                   │  learnings.jsonl    ← /learn
                   └─────────────────────────────────────┘
                                  │
                          rolled up weekly
                                  │
                   ┌──────────────▼──────────────────────┐
                   │           /retro                      │
                   │  Timeline: 3 /review, 2 /ship, ...   │
                   │  Health trends: compile 8/10 (↑2)     │
                   │  Learnings applied: 4 this week       │
                   └─────────────────────────────────────┘
```

## 機能

### レイヤー 1: コンテキストの復旧(プリアンブル、すべてのスキル)
プリアンブルに約 10 行の文章を追加します。コンパクションの後やコンテキストの劣化の後、エージェントは `~/.gstack/projects/$SLUG/` を確認して、最近のプラン、レビュー、チェックポイントを探します。ディレクトリを一覧し、最新のファイルを読みます。

コスト: ほぼゼロ。効果: すべてのスキルのプランやレビューがコンパクションを越えて残ります。

### レイヤー 2: セッションのタイムライン(プリアンブル、すべてのスキル)
すべてのスキルが、`timeline.jsonl` に 1 行の JSONL エントリーを追記します。内容は、タイムスタンプ、スキル名、ブランチ、主要な結果です。`/retro` がそれを描画します。

プロジェクトの AI 支援による作業の履歴を見える化します。「今週: /review 3 回、/ship 2 回、/investigate 1 回。対象ブランチは feature-auth と fix-billing」のように。

### レイヤー 3: セッションをまたぐ注入(プリアンブル、すべてのスキル)
最近の成果物があるブランチで新しいセッションが始まると、プリアンブルは一行の要約を表示します。「前回のセッション: JWT 認証を実装、タスク 5 件中 3 件完了。プラン: ~/.gstack/projects/$SLUG/checkpoints/latest.md」

エージェントは、ファイルを読む前に、どこまで進んだかを把握できます。

### レイヤー 4: /checkpoint(オプトインのスキル)
作業状態を手動でスナップショットします。何をしているか、どのファイルを編集しているか、どんな決定をしたか、何が残っているか。席を外す前、複雑な操作の前、ワークスペースの引き継ぎ、数日後の再開に役立ちます。

### レイヤー 5: /health(オプトインのスキル)
コード品質のダッシュボードです。型チェック、リント、テストスイート、デッドコードのスキャン。0-10 の総合スコア。時間をかけて追跡します。`/retro` が推移を表示します。`/ship` は、設定可能な閾値でゲートします。

## 積み上がる効果

各機能は単独でも役立ちます。組み合わせると、積み上がるものになります。

セッション 1: /plan-ceo-review がプランを作る。ディスクに保存される。
セッション 2: エージェントはプリアンブルの後にプランを読む。同じ決定を聞き直さない。
セッション 3: /checkpoint が進捗を保存する。タイムラインに /review 2 回、/ship 1 回。
セッション 4: リファクタリングの途中でコンパクションが発動する。エージェントはチェックポイントを読み直す。主要な決定、型、残作業を復旧して続ける。
セッション 5: /retro がその週をまとめる。ヘルスの推移: 6/10 → 8/10。
      タイムラインには、3 つのブランチにまたがる 12 回のスキルの呼び出しが表示される。

プロジェクトの AI の履歴は、もはや一時的なものではありません。残り、積み上がり、将来のすべてのセッションをより賢くします。それがセッション・インテリジェンス層です。

## これではないもの

- Claude 組み込みのコンパクションの代わりではありません(それはセッションの状態を扱い、私たちは gstack の成果物を扱います)。
- claude-mem のような完全なメモリシステムではありません(それは SQLite を通じてセッションをまたぐメモリを扱い、私たちは構造化されたスキルの成果物を扱います)。
- データベースやサービスではありません(ディスク上の Markdown ファイルだけです)。

## 調査の出典

- [Anthropic: 長時間稼働するエージェントのための効果的なハーネス(原題: Effective harnesses for long-running agents)](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Anthropic: Effective context engineering](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [claude-mem](https://github.com/thedotmack/claude-mem)
- [Claude HUD](https://github.com/jarrodwatts/claude-hud)
- [CodeScene: Agentic AI coding best practices](https://codescene.com/blog/agentic-ai-coding-best-practice-patterns-for-speed-with-quality)
- [git に永続化した状態によるコンパクション後の回復(Beads)(原題: Post-compaction recovery via git-persisted state)](https://dev.to/jeremy_longshore/building-post-compaction-recovery-for-ai-agent-workflows-with-beads-207l)
