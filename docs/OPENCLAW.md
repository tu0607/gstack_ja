# gstack と OpenClaw の統合

gstack は、移植されたコードベースとしてではなく、方法論の提供元として OpenClaw と統合されています。
OpenClaw の ACP ランタイムは、Claude Code のセッションをネイティブに起動します。gstack は、そのセッションをより良くする計画の規律と方法論を提供します。

これは、プロンプトのテキストとして符号化された軽量なプロトコルです。デーモンはなく、JSON-RPC もなく、互換性マトリクスもありません。プロンプトそのものが橋渡しです。

## アーキテクチャ

```
  OpenClaw                               gstack repo
  ─────────────────────                    ──────────────
  Orchestrator: messaging,                 Source of truth for
  calendar, memory, EA                     methodology + planning
       │                                        │
       ├── Native skills (conversational)       ├── Generates native skills
       │   office-hours, ceo-review,            │   via gen-skill-docs pipeline
       │   investigate, retro                   │
       │                                        ├── Generates gstack-lite
       ├── sessions_spawn(runtime: "acp")       │   (planning discipline)
       │       │                                │
       │       └── Claude Code                  ├── Generates gstack-full
       │           └── gstack installed at      │   (complete pipeline)
       │               ~/.claude/skills/gstack  │
       │                                        └── docs/OPENCLAW.md (this file)
       └── Dispatch routing (AGENTS.md)
```

## ディスパッチのルーティング

OpenClaw は、起動時にどの段階の gstack サポートを使うかを決めます。

| 段階 | 使う場面 | プロンプトの接頭辞 |
|------|---------------|---------------|
| **Simple** | 1 ファイルの編集、タイプミス、設定の変更 | gstack のコンテキストは注入しない |
| **Medium** | 複数ファイルにまたがる機能、リファクタリング | gstack-lite の CLAUDE.md を追記 |
| **Heavy** | 特定の gstack スキルが必要 | "Load gstack. Run /X"(gstack を読み込んで /X を実行) |
| **Full** | 完全な機能、目的、プロジェクト | gstack-full パイプラインを追記 |
| **Plan** | 「Claude Code のプロジェクトを計画して」 | gstack-plan パイプラインを追記 |

### 判断の目安

- 10 行未満のコードで済むか? → **Simple**
- 複数のファイルに触れるが、進め方は明らかか? → **Medium**
- ユーザーが特定のスキル(/cso、/review、/qa)を名指ししているか? → **Heavy**
- タスクではなく、機能・プロジェクト・目的か? → **Full**
- 実装する前に、Claude Code のために何かを計画したいか? → **Plan**

### ディスパッチのルーティングのガイド(AGENTS.md 用)

そのまま貼り付けられる完全なセクションは `openclaw/agents-gstack-section.md` にあります。
それを OpenClaw の AGENTS.md にコピーしてください。

重要な振る舞いのルール(これらはディスパッチの段階より上に置きます)。

1. **必ず起動し、リダイレクトしない。** ユーザーが gstack のスキルを使いたいと言ったら、必ず Claude Code のセッションを起動します。ユーザーに Claude Code を開くよう言ってはいけません。
2. **リポジトリを特定する。** ユーザーがリポジトリを名指しした場合は、作業ディレクトリをそこに設定します。不明な場合は、どのリポジトリかを尋ねます。
3. **Autoplan はエンドツーエンドで実行する。** 起動し、パイプライン全体を走らせ、チャットで報告します。ユーザーが Telegram から離れる必要があってはいけません。

### CLAUDE.md の衝突への対処

既に CLAUDE.md があるリポジトリで Claude Code を起動する場合は、gstack-lite/full を新しいセクションとして追記してください。既存の指示を置き換えてはいけません。

## gstack が OpenClaw 向けに生成するもの

すべての成果物は `openclaw/` ディレクトリにあり、`bun run gen:skill-docs --host openclaw` によって生成されます。

### gstack-lite(Medium の段階)
`openclaw/gstack-lite-CLAUDE.md` — 約 15 行の計画の規律:
1. 変更する前に、すべてのファイルを読む
2. 5 行の計画を書く: 何を、なぜ、どのファイル、テストのケース、リスク
3. 判断の原則を使って、曖昧さを解消する
4. 完了を報告する前に、自己レビューを行う
5. 完了報告: 何を出荷したか、どんな判断をしたか、不確かな点は何か

A/B テスト済み: 時間は 2 倍、出力は明らかに良くなる。

### gstack-full(Full の段階)
`openclaw/gstack-full-CLAUDE.md` — 既存の gstack スキルをつなげます:
1. CLAUDE.md を読み、プロジェクトを理解する
2. /autoplan を実行する(CEO、エンジニアリング、デザインのレビュー)
3. 承認された計画を実装する
4. /ship を実行して PR を作成する
5. PR の URL と判断を報告する

### gstack-plan(Plan の段階)
`openclaw/gstack-plan-CLAUDE.md` — レビューを全部通すが、実装はしない:
1. /office-hours を実行して設計ドキュメントを作る
2. /autoplan を実行する(CEO、エンジニアリング、デザイン、DX のレビュー + Codex による敵対的レビュー)
3. レビュー済みの計画を `plans/<project-slug>-plan-<date>.md` に保存する
4. 報告: 計画のパス、要約、主要な判断、推奨される次のステップ

オーケストレーターは、計画へのリンクを自分のメモリストア(brain リポジトリ、ナレッジベース、または AGENTS.md で設定されたもの)に保存します。ユーザーが構築の準備ができたら、保存された計画を参照する FULL のセッションを起動します。

### ネイティブの方法論スキル
ClawHub に公開されています。`clawhub install` でインストールします。
- `gstack-openclaw-office-hours` — 製品の詰問(6 つの強制的な質問)
- `gstack-openclaw-ceo-review` — 戦略的な挑戦(10 セクションのレビュー、4 つのモード)
- `gstack-openclaw-investigate` — 運用上のデバッグ(4 フェーズの方法論)
- `gstack-openclaw-retro` — 運用上の振り返り(週次レビュー)

ソースは gstack リポジトリの `openclaw/skills/` にあります。これらは、OpenClaw の会話の文脈に合わせて手で書き直した gstack の方法論です。gstack のインフラ(ブラウザ、テレメトリー、プリアンブルなど)は含まれていません。

## 生成されたセッションの検出

OpenClaw が起動したセッションの中で Claude Code が動くとき、`OPENCLAW_SESSION` 環境変数が設定されているはずです。gstack はこれを検出して、次のように振る舞いを変えます。
- 対話型のプロンプトをスキップする(推奨される選択肢を自動で選ぶ。ただし、破壊的または取り消せない選択肢は決して自動で選ばない。保守的な選択が勝ち、完了報告に記録される)
- 対話型のオンボーディングの指示ブロックを、出力時に抑制する(アップグレードの確認、テレメトリーの案内、機能の発見、ルーティングの注入、ヒント)。これにより、一度きりのプロンプトは次の人間のセッションのために無傷で残る
- Conductor のプロース信号(`CONDUCTOR_SESSION: true`)を抑制する。Conductor のワークスペース内で起動されたセッションは、誰もいない相手に散文を描画する代わりに、自動で選ぶ
- タスクの完了と、散文による報告に集中する

`sessions_spawn` には、起動ごとの環境変数の引数がありません([openclaw/openclaw#51654](https://github.com/openclaw/openclaw/issues/51654) は、それを追加せずに閉じられました)。そのため、ツール呼び出しの中の `env` フィールドは無視されます。代わりに、Claude ACP ハーネスまたは Gateway サービスの環境に `OPENCLAW_SESSION=1` を設定してください。認証情報はそのラッパーの外に置きます。そして、起動されたプロセスの中から(例えば `echo $OPENCLAW_SESSION`)変数を確認してください。セッションの最後のメッセージを信じるのではなく、そうするのです。

### 明示的な上書き: GSTACK_SESSION_KIND

`GSTACK_SESSION_KIND=spawned` は、同じ分類のためのコマンドごとの明示的なマーカーです。これは、周囲のすべての環境マーカー(`OPENCLAW_SESSION` や `GSTACK_HEADLESS` を含む)より優先されます。存在する理由は、Claude Code のサブエージェントが親セッションの環境をそのまま(バイト単位で)引き継ぐため(#2733)です。ディスパッチするスキルは、同じコマンドラインでプリアンブルの呼び出しに接頭辞を付けて、そのサブエージェントをマークします。

```bash
GSTACK_SESSION_KIND=spawned "$_SS" --skill "document-release" ...
```

gstack 自身もこれを使います。`/ship` の Step 14.5 は、最終コミット、検証、公開の前に、この接頭辞付きで `/document-release` のサブエージェントをディスパッチします。/ship が所有するスコープは、一般的な spawned の自動選択を上書きします。リスクのある、または不確かなドキュメントの変更は、対話的な質問や自動承認なしに、ブロッカーとして親に返されます。意図的に範囲を狭くしています。処理されるのは `spawned` だけです。`headless` は既に `GSTACK_HEADLESS` を持っており、環境変数で `interactive` を強制して CI のマーカーを上書きできるようにすると、誤分類の落とし穴になるからです。空の値やそれ以外の値は予約済みで無視されます(周囲の検出にフォールバックします)。なお、フックのプロセスはハーネスの環境を引き継ぐため、コマンドごとの接頭辞は PreToolUse/PostToolUse のフックには届きません。そのトポロジー向けに、フックのテキストには spawned の回避文が含まれています(`hosts/claude/hooks/spawned-directive.ts`)。

**改ざんの可視化。** セッション全体の環境を注入する仕組み(クローンしたリポジトリの `.claude/settings.json` の env ブロック、direnv、CI のラッパーなど)は、実在する人間のセッションに `GSTACK_SESSION_KIND=spawned` を設定し、その確認ゲートを黙って自動選択に切り替えてしまう可能性があります。環境変数による上書きが分類を決めた場合、プリアンブルは大きな `SPAWNED_OVERRIDE: env` のステータス行を出します。これにより、なぜそのセッションが spawned とみなされたのかが、トランスクリプトに表示されます。信頼できないリポジトリでは `.claude/settings.json` の env ブロックを監査してください(/cso がこれをカバーしています)。

## インストール

OpenClaw のユーザーは、OpenClaw のエージェントに「openclaw 向けに gstack をインストールして」と伝えてください。

エージェントは次のことを行うべきです。
1. gstack-lite の CLAUDE.md を、そのコーディングセッションのテンプレートにインストールする
2. ネイティブの方法論スキル 4 つをインストールする
3. AGENTS.md にディスパッチのルーティングを追加する
4. テストの起動で検証する

gstack の開発者は、`./setup --host openclaw` でこのドキュメントを出力できます。実際の成果物は `bun run gen:skill-docs --host openclaw` によって生成されます。

## 行わないこと

- ディスパッチのデーモンはなし(セッションの起動は ACP が担当)
- Clawvisor のリレーなし(セキュリティ層は不要)
- 双方向の学習の橋渡しなし(brain リポジトリが知識ストア)
- JSON スキーマやプロトコルのバージョン管理なし
- gstack からの SOUL.md なし(OpenClaw には独自のものがある)
- コーディング系スキルの完全な移植なし(コーディングのスキルはネイティブの Claude Code に残る)
