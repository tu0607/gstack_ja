## コーディング作業 (gstack)

### ルール(譲れないもの)

1. **必ず起動し、転送しない。** ユーザーが gstack のスキルを使うよう頼んだら、必ず sessions_spawn で Claude Code セッションを起動してください。ユーザー自身に Claude Code を開かせることは決してしません。「これは Claude Code で実行する必要があります」と言ってはいけません。「Claude Code を開く必要があります」とも言わないでください。そのまま実行してください。

2. **リポジトリを特定する。** ユーザーがリポジトリやプロジェクトを名指しした場合は、作業ディレクトリをそのリポジトリのパスに設定してください。リポジトリのパスが分からない場合は、どのリポジトリかを尋ねてください。Claude Code を開くよう伝えて押し付けてはいけません。

3. **/autoplan はエンドツーエンドで実行する。** /autoplan に限っては、セッションを起動し、レビューのパイプライン全体(CEO → デザイン → エンジニアリング)を実行させ、終わったらプランをこのチャットで報告してください。プランはメモリに保存し、ユーザーが後から見つけられるようにしてください。ユーザーが Telegram から離れる必要は一度もないようにしてください。

### ディスパッチのルーティング

コーディング作業を依頼されたら、ディスパッチの階層を選んでください。

**SIMPLE:** 「このタイプミスを直して」「あの設定を更新して」、単一ファイルの変更
→ sessions_spawn(runtime: "acp", prompt: "<タスクだけ>")

**MEDIUM:** 複数ファイルにまたがる機能、リファクタリング、スキルの編集
→ sessions_spawn(runtime: "acp", prompt: "<gstack-lite の内容>\n\n<タスク>")

**HEAVY:** 特定の gstack の方法論が必要
→ sessions_spawn(runtime: "acp", prompt: "Load gstack. Run /qa https://...")
  スキル: /cso、/review、/qa、/ship、/investigate、/design-review、/benchmark、/gstack-upgrade

**FULL:** 完全な機能を構築する、数日にわたるスコープ、計画とレビューが必要
→ sessions_spawn(runtime: "acp", prompt: "<gstack-full の内容>\n\n<タスク>")
  Claude Code は次を実行します: /autoplan → 実装 → /ship → 報告

**PLAN:** ユーザーが Claude Code のプロジェクトを計画したい、機能の仕様を決めたい、またはコードを書く前に設計したい
→ sessions_spawn(runtime: "acp", prompt: "<gstack-plan の内容>\n\n<タスク>")
  Claude Code は次を実行します: /office-hours → /autoplan → プランファイルを保存 → 報告
  プランへのリンクをメモリ/ナレッジストアに保存してください。
  ユーザーが実装する準備ができたら、そのプランを指す新しい FULL セッションを起動してください。

### 判断の目安

- 10 行未満のコードで済むか? → **SIMPLE**
- 複数ファイルにまたがるが、アプローチが明らかか? → **MEDIUM**
- ユーザーが特定のスキル(/cso、/review、/qa)を名指ししたか? → **HEAVY**
- 「gstack をアップグレード」「gstack を更新」 → `Run /gstack-upgrade` を付けた **HEAVY**
- 作業ではなく、機能、プロジェクト、目標か? → **FULL**
- 実装はまだで、何かを計画したいか? → **PLAN**
