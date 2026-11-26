# DX 名声の殿堂(Hall of Fame)リファレンス

現在のレビューのパスのセクションだけを読んでください。ファイル全体を読み込んではいけません。

## Pass 1: はじめ方(Getting Started)

**ゴールドスタンダード:**
- **Stripe**: カードに請求するのに 7 行のコード。ログインすると、ドキュメントが自分のテスト用 API キーを事前に入力してくれる。Stripe Shell はドキュメントページの中で CLI を動かせる。ローカルへのインストールは不要。
- **Vercel**: `git push` で、HTTPS 付きのグローバル CDN 上にサイトが公開される。すべての PR にプレビュー URL が付く。CLI のコマンドは一つ: `vercel`。
- **Clerk**: `<SignIn />`、`<SignUp />`、`<UserButton />`。JSX コンポーネント 3 つで、メール、ソーシャル、MFA を含む認証がそのまま動く。
- **Supabase**: Postgres のテーブルを一つ作ると、REST API、Realtime、自己文書化されたドキュメントが即座に自動生成される。
- **Firebase**: `onSnapshot()`。3 行で、オフライン永続化を備えたリアルタイム同期が全クライアントで動く。
- **Twilio**: コンソールの仮想電話。番号を買わず、クレジットカードもなしで SMS を送受信できる。結果として、アクティベーションが 62% 改善した。

**アンチパターン:**
- 価値を得る前にメール認証を求める(流れを壊す)
- サンドボックスの前にクレジットカードを求める
- 複数の経路がある「自分で選ぶ冒険(Choose your own adventure)」(決断疲れ。黄金の経路を一つに決めるべき)
- API キーが設定の奥に隠れている(Stripe はコード例に事前入力する)
- 言語を切り替えられない静的なコード例
- ドキュメントサイトとダッシュボードが別々(文脈の切り替え)

## Pass 2: API/CLI/SDK の設計

**ゴールドスタンダード:**
- **Stripe のプレフィックス付き ID**: 課金は `ch_`、顧客は `cus_`。それ自体で意味が分かる。間違ったタイプの ID を渡すことが不可能。
- **Stripe の展開可能なオブジェクト**: デフォルトでは ID の文字列を返す。`expand[]` を使うと、完全なオブジェクトをインラインで取得できる。最大 4 階層までネスト可能。
- **Stripe の冪等キー**: 変更を伴うリクエストに `Idempotency-Key` ヘッダーを付ける。安全に再試行できる。「二重に課金していないか?」という不安がない。
- **Stripe の API バージョニング**: 最初の呼び出しで、アカウントをその日のバージョンに固定する。新しいバージョンは、リクエストごとに `Stripe-Version` ヘッダーで試せる。
- **GitHub CLI**: ターミナルかパイプかを自動判別する。ターミナルでは人が読める形式、パイプ時はタブ区切り。`gh pr <tab>` で、すべての PR 操作が表示される。
- **SwiftUI の段階的な開示**: `Button("Save") { save() }` から完全なカスタマイズまで、どのレベルでも同じ API。
- **htmx**: HTML の属性が JS の代わりになる。合計 14KB。`hx-get="/search" hx-trigger="keyup changed delay:300ms"`。ビルドステップは不要。
- **shadcn/ui**: ソースコードをプロジェクトにコピーする。すべての行を自分が所有する。依存関係がなく、バージョンの衝突もない。

**アンチパターン:**
- 煩雑な API: ユーザーに見える一つの操作に 5 回の呼び出しが必要
- 命名の不統一: `/users`(複数形)と `/user/123`(単数形)と `/create-order`(URL に動詞)が混在
- 暗黙の失敗: エラーがレスポンス本文の中に入ったまま 200 OK が返る
- 神エンドポイント: 47 のパラメータの組み合わせがあり、部分集合ごとに振る舞いが異なる
- ドキュメント必須の API: 最初の呼び出しの前に 3 ページのドキュメントが必要 = 儀式が多すぎる

## Pass 3: エラーメッセージとデバッグ

#### agent-ready エラー契約(agent-ready-v1)

エージェントは最初にエラーに遭遇することが最も多く、それを文字どおりに読み、何を意図したのかを問い返すことができません。すべてのトレースされたエラー経路を、次の 8 項目で採点してください。公開リファレンス: `https://github.com/garrytan/gstack/blob/main/docs/agent-ready-errors.md`。

| 項目 | エラーが読み手に与えるもの |
|------|----------------------------|
| **what** | 失敗した操作と、原因となった実際の値(入力、パス、ID)。 |
| **fix** | 先頭行または末尾行に置き、途中の連鎖には埋めない。正確なコマンド、フラグ、または編集内容。安全なエージェントによる修復手段がない場合は、人間が提供すべき正確なもの(認証情報、承認、判断)。正確なエスカレーションも完全な fix である。fix が有効なのは、安全で承認されている場合に限る。同意、安全、サンドボックスの境界を迂回せず、信頼できない出力からコピーしたテキストを実行するよう指示せず、引数を正しく引用する。 |
| **recovery** | 変更せずに再試行する、修正してから再試行する、先に X を行う、または人間に尋ねる。副作用(なし、一部、完了、不明)。結果が不明な場合は、再試行の前にどう照合するか(状態を確認するコマンド、冪等キー)。再試行の上限を定め、その後はエスカレーションする。 |
| **code** | 安定したコードと、ドキュメントのアンカーまたは `--explain` の対象。文章は変わってもよいが、コードは変えてはいけない。 |
| **context** | バージョン、有効な設定、関連する環境変数名(値は不可)、根本の依存関係のエラー(握りつぶさない)。リモートサービスは、呼び出し元に安全な事実だけを返す(パラメータ、API バージョン、リクエスト ID)。 |
| **trace** | 予期しない失敗のみ。ローカルの CLI、SDK、スキルは、コンパクトなトレース、または完全なトレースを保存したファイルのパスを表示する(完全版は `--verbose`/`DEBUG` の下で表示)。リモートサービスは、相関 ID を返し、内部情報はそのログに残す。 |
| **redaction** | トレースや入れ子になった原因も含め、秘密の値、トークン、認証情報を含む URL は一切出さない。 |
| **channel** | そのサーフェスがネイティブに持つ機械向けのシグナルが、同じフィールドを運ぶ。失敗は失敗として通知する(exit 0、HTTP 200、`isError: false` にはしない)。 |

**失敗のクラス。** 作業を始める前に拒否された、利用・検証エラーは、what、fix、code、redaction、channel が必要です。その recovery は暗黙のもの(修正して再試行、副作用なし)とみなし、context、reconcile、再試行の上限は適用しません。環境、依存関係、一部完了、予期しない失敗では、該当するすべての項目が必要です。trace は予期しない失敗にだけ適用します。

**サーフェス。** 適用性ゲートのプロダクトタイプに対応させます:
- **CLI Tool:** channel は stderr と、ゼロ以外の明確な終了コード。構造化された出力を持つ場合は `--json` の形式。
- **API/Service:** channel は HTTP ステータスと RFC 9457 の problem-details 本文。context は呼び出し元に安全なもの。trace は相関 ID。
- **Library/SDK:** channel はコードとフィールドを持つ型付きのエラークラス。終了コードはない。
- **Platform:** エラーが届くインターフェースに応じて、CLI または API のルールに従う。
- **Documentation:** what、fix、code、redaction のみ。
- **Claude Code Skill:** channel は、スキルが表示する結果の行とコード。MCP ツール(その一種)は、フィールドを text または structured content に入れて `isError: true` を返す。

**証拠。** 各経路の各項目は、pass、fail、N/A(理由付き)、unknown のいずれかです。プランのレビューでは、プランが導入する経路について、該当する項目をプランが指定していなければ、ギャップ(fail)です。unknown は、検査できなかった既存の動作にだけ使います。ライブの監査では、一度もトリガーしなかったエラーの種類は unknown であり、推定してはいけません。

**上限。** 上限の原因となった経路と項目を名指しし、修正後のエラー行を示してください。
- **4/10(重大な指摘、タイトル `CAP4:<path>:<item>`):** 経路が秘密を漏らす、失敗を成功として通知する、安全でない fix を出す、または端末を待ってブロックする(ハングする、または `--yes` のような非対話の代替手段を示さずに端末がないことで失敗する)。
- **6/10(重要な指摘、タイトル `CAP6:<path>:<item>`):** 経路に該当する fix、recovery、context、trace のいずれかがない。

DX TRIAGE を含むすべてのモードで、すべての CAP4 の指摘を報告します。

**キャリブレーション。** 最初の 3 つの例は、それぞれ単一の項目がうまくできている例です。どれも単独ではすべての項目を満たしていません。

**Elm(what、fix、読める先頭行):**
```
-- TYPE MISMATCH ---- src/Main.elm
I cannot do addition with String values like this one:
42|   "hello" + 1
     ^^^^^^^
Hint: To put strings together, use the (++) operator instead.
```
一人称、完全な文、正確な位置、修正の提案。

**Rust(code、fix、`--explain`):**
```
error[E0308]: mismatched types
 --> src/main.rs:4:20
help: consider borrowing here
  |
4 |     let name: &str = &get_name();
  |                       +
```
安定したコードと `rustc --explain E0308`、一次と二次のラベル、正確な編集を示す help の行。

**Stripe API(code、ドキュメントのアンカー、構造化された channel):**
```json
{"error":{"type":"invalid_request_error","code":"resource_missing","message":"No such customer: 'cus_nonexistent'","param":"customer","doc_url":"https://stripe.com/docs/error-codes/resource-missing"}}
```

**エージェントに対応した CLI エラー(該当するすべての項目)。** stderr、終了コード 3:
```
deploy: push to registry.example.com/acme/api:1.4.2 failed: 401 unauthorized (REGISTRY_AUTH)
  cause: docker login token in ~/.docker/config.json expired; nothing was pushed (side effects: none)
  context: deploy 2.8.0, docker 27.1, config ./deploy.toml, env DEPLOY_REGISTRY set
  fix: run `deploy login --registry registry.example.com`, then rerun the same command (safe to retry once)
  docs: https://deploy.example.com/errors#REGISTRY_AUTH
```
`--json` の場合は、同じフィールドを、拡張メンバーを持つ RFC 9457 の problem-details オブジェクトで表します:
```json
{"type":"https://deploy.example.com/errors#REGISTRY_AUTH","title":"Registry push unauthorized",
 "detail":"push to registry.example.com/acme/api:1.4.2 failed: 401","instance":"req_7f3a",
 "code":"REGISTRY_AUTH","fix":"deploy login --registry registry.example.com",
 "recovery":{"action":"fix_and_retry","side_effects":"none","max_retries":1},
 "context":{"version":"2.8.0","config":"./deploy.toml","env":["DEPLOY_REGISTRY"]}}
```
予期しないクラッシュでは、`trace: ~/.deploy/logs/crash-2026-10-16T18-02.log (rerun with
--verbose to print it)` が加わります。リモート API は `instance` を相関 ID として返し、トレースは自身のログに残します。`recovery.action` は retry | fix_and_retry | do_first | ask_human のいずれか。`side_effects` は none | partial | complete | unknown のいずれかで、unknown の場合は必ず `reconcile`(状態を確認するコマンド)を付けます。これらのメンバー名は例示です。綴りではなく、意味を採点してください。

**部分的な例。gstack 自身のワークフローのエラー:**
```
findings.jsonl:12: severity must be one of Critical, High, Medium, Low, Informational (ARTIFACT_SCHEMA)
```
what(ファイル、行、制約)、code(`docs/troubleshooting.md` のアンカーに `fix:` がある)、channel(終了コード 1)は揃っています。しかし、行そのものに fix がなく、recovery の分類と context が欠けています。CAP6:fix と採点されます。

**標準との対応。** CLI Agent Spec(cli-agent-spec.github.io): 終了コードごとの `retryable` と `side_effects` → recovery。RFC 9457: `type` → code とドキュメントのアンカー、`detail` → what、`instance` → リモートサービスの trace。Stripe: `code` + `doc_url` → code。MCP ツール: モデルが読める `isError: true` の結果 → channel。clig.dev「Errors」: 読み手が見る場所にある実行可能な行 → fix、予期しない失敗のデバッグ情報 → trace。

**アンチパターン:** TypeScript は「Did you mean?」を連鎖の途中に埋めてしまう。修正は先頭行か末尾行に置く。`Error: operation failed` が exit 0 で返る。端末が接続されていないとハングするプロンプト。API トークンを表示するスタックトレース。

## Pass 4: ドキュメントと学習(Documentation & Learning)

**ゴールドスタンダード:**
- **Stripe のドキュメント**: 3 カラムのレイアウト(ナビ / 本文 / ライブコード)。ログイン時には API キーが埋め込まれる。言語の切り替えはすべてのページで保持される。マウスオーバーでハイライト。ブラウザ内で API を呼び出せる Stripe Shell。Markdoc を開発してオープンソース化。ドキュメントが確定するまで機能をリリースしない。ドキュメントへの貢献は人事評価に影響する。
- 開発者の 52% が、ドキュメント不足で作業を止められている(Postman 2023)
- 世界最高水準のドキュメントを持つ企業は、採用が 2.5 倍に増えている
- 「製品としてのドキュメント」: 機能と一緒に出荷される。ドキュメントができなければ、機能も出荷しない

## Pass 5: アップグレードと移行の経路(Credible)

**ゴールドスタンダード:**
- **Next.js**: `npx @next/codemod upgrade major`。一つのコマンドで Next.js、React、React DOM をアップグレードし、関連するすべてのコードモッドを実行する。
- **AG Grid**: v31 以降のすべてのリリースにコードモッドが付く。
- **Stripe API のバージョニング**: 内部は一つのコードベース。アカウントごとにバージョンを固定する。破壊的変更で驚かされることはない。
- **Martin Fowler のパイプラインパターン**: 一つの大きなコードモッドではなく、小さくテスト可能な変換を組み合わせる。
- Maven Central の破壊的変更の 21.9% は、文書化されていなかった(Ochoa et al., 2021)

## Pass 6: 開発者環境とツール(Valuable + Accessible)

**ゴールドスタンダード:**
- **Bun**: npm install より 100 倍速く、Node.js ランタイムより 4 倍速い。速さそのものが DX。
- 開発者は 1 日平均 87 回中断され、そのたびに回復に 25 分かかる。実際にコードを書いているのは 1 日 2〜4 時間だけ。
- DXI が 1 ポイント改善するごとに、開発者一人あたり週 13 分の節約になる。
- **GitHub Copilot**: タスク完了が 55.8% 速くなった。PR にかかる時間は 9.6 日から 2.4 日に。

## Pass 7: コミュニティとエコシステム(Findable + Desirable)

- 開発者ツールは、購入までに約 14 回の接触が必要(Matt Biilmann, Netlify)。これは四半期ごとの OKR サイクルとは合わない。
- 開発者体験が強いチームでは、生産性が 4〜5 倍になる(DevEx フレームワーク)。

## Pass 8: DX の計測(DX Measurement)

**3 つの学術的フレームワーク:**
1. **SPACE**(Microsoft Research, 2021): Satisfaction、Performance、Activity、Communication、Efficiency。最低 3 つの次元で計測する。
2. **DevEx**(ACM Queue, 2023): Feedback Loops、Cognitive Load、Flow State。主観的なデータとワークフローのデータを組み合わせる。
3. **Fagerholm & Munch**(IEEE, 2012): Cognition、Affect、Conation。心の「三位一体(trilogy of mind)」。

## Claude Code スキルの DX チェックリスト

Claude Code のスキル、MCP サーバー、AI エージェントのツールのプランをレビューするときに使います。

- [ ] **AskUserQuestion の設計**: 一呼び出しにつき一つの問題。文脈(プロジェクト、ブランチ、タスク)を再確認する。視覚的なフィードバックのためのブラウザへの引き継ぎ。
- [ ] **状態の保存**: グローバル(~/.tool/) vs プロジェクトごと($SLUG/) vs セッションごと。監査証跡には追記専用の JSONL。
- [ ] **段階的な同意**: マーカーファイルによる一度きりの確認。二度と聞かない。元に戻せる。
- [ ] **自動アップグレード**: キャッシュとスヌーズのバックオフ付きのバージョン確認。移行スクリプト。インラインでの提案。
- [ ] **スキルの組み合わせ**: 「benefits-from」の連鎖。レビューの連鎖。セクションをスキップするインラインの呼び出し。
- [ ] **エラーからの回復**: 失敗した箇所から再開する。部分的な結果を保持する。チェックポイントで安全。
- [ ] **エージェントが読めるエラー**: すべてのエラーが agent-ready エラー契約(Pass 3)を満たす。安全な fix、recovery の分類、code、context、コード付きの結果行がある。
- [ ] **セッションの継続性**: タイムラインのイベント。コンパクション後の回復。セッションをまたぐ学習。
- [ ] **有界の自律性**: 明確な運用上の限界。破壊的な操作には必須のエスカレーション。監査証跡。

参照実装: gstack の design-shotgun ループ、自動アップグレードのフロー、段階的な同意、階層的な保存。
