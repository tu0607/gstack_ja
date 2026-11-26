# ブラウザ / サイドバー / サーバーの内部構造

> **対象範囲:** これは gstack 独自のブラウザエンジンの内部リファレンスです。対象は `browse` デーモン、GStack Browser、サイドバー拡張です。このエンジンは、Aside ブラウザがインストールされていないか実行されていない場合 (Linux、Windows、Aside アプリが閉じている場合) の自動的な**フォールバック**です。どのスキルも最初に駆動するのは Aside です。Aside の契約は `scripts/resolvers/aside.ts` と [BROWSER.md](../BROWSER.md) にあります。

CLAUDE.md から、トークン量を減らすためにそのまま移しました。これらは `browse/src/server.ts`、Chrome 拡張、
サイドバーの PTY、SSE エンドポイント、CDP セッション、サイドバーのセキュリティスタックに関する、負荷を支える不変条件です。
ここの各ルールは、それぞれの段落で名前を挙げた CI のトリップワイヤーテストによって、さらに検証されています。

**サイドバーのアーキテクチャ:** `sidepanel.js`、`background.js`、`content.js`、`terminal-agent.ts`、またはサイドバー関連のサーバーエンドポイントを変更する前に、
`docs/designs/SIDEBAR_MESSAGE_FLOW.md` を読んでください。サイドバーの主要な画面は 1 つ、**Terminal** ペイン (対話的な `claude` PTY) です。
Activity / Refs / Inspector は、フッターの `debug` トグルの向こう側にあるデバッグ用のオーバーレイです。
チャットのキューによる経路は、PTY が機能すると確認された時点で取り除かれました。`sidebar-agent.ts` と `/sidebar-command` / `/sidebar-chat` /
`/sidebar-agent/event` エンドポイントはもうありません。このドキュメントには、WS の認証フロー、二重トークンモデル、脅威モデルの境界が書かれています。
ここでの静かな失敗は、たいてい、このクロスコンポーネントの流れを理解していないことに由来します。

**埋め込み側のターミナルエージェントの所有** (v1.42.1.0 以降、ID ベースの kill は v1.44.0.0 以降)。
`browse/src/server.ts` の `buildFetchHandler` は、`ServerConfig.ownsTerminalAgent?:
boolean` (デフォルトは `true`) を受け入れます。`true` のとき、ファクトリのシャットダウンは `acquireAgentStateLock(stateDir)` を取得し、デーモンの所有権を確認します。
記録されたエージェントが存在しないか、すでに死んでいるか、`stopAgentByRecord` によって停止が確認された場合にのみ、
`terminal-port`、`terminal-internal-token`、および対応する `terminal-agent-pid` の記録を削除します。
識別情報が不確かな場合や終了が確認できない場合、ロックが取得できない場合、または後継が所有するデーモンの状態がある場合は、それらのファイルはそのまま残します。
(gbrowser の phoenix オーバーレイなど) 独自に PTY サーバーを事前に起動する埋め込み側は、gstack の後片付けのサイクルを経てもその検出ファイルが残るように、`false` を渡さなければなりません。
このフラグは、`ServerConfig` の中で呼び出し側が所有する 3 つ目の後片付けの制御です (`xvfb?` と `proxyBridge?` と並ぶ)。極性が反転しています (存在の有無ではなく明示的な bool)。
フィールドの JSDoc に記載されています。CLI の `start()` は常に `true` を明示的に渡します。
リファクタリングで渡し忘れると、`browse/test/server-embedder-terminal-port.test.ts` の静的 grep テストが CI で失敗します。
v1.44 より前は `pkill -f terminal-agent\.ts` (正規表現による一致) を使っていましたが、これは同じホスト上の兄弟の gstack セッションまで kill してしまいました。新しい
`browse/test/terminal-agent-pid-identity.test.ts` の静的 grep トリップワイヤーは、
いずれかのソースファイルが `pkill ... terminal-agent` または `spawnSync('pkill', ...)` を再び持ち込んだ場合に CI で失敗します。

**WebSocket の認証には Cookie ではなく Sec-WebSocket-Protocol を使う。** ブラウザは WebSocket のアップグレードで `Authorization` を設定できませんが、
`new WebSocket(url, [token])` を通じて `Sec-WebSocket-Protocol` は設定できます。エージェントはそれを読み、`validTokens` と照合し、
アップグレードのレスポンスでプロトコルを必ずエコーバックしなければなりません。エコーがないと、Chromium は接続を直ちに閉じます。
`Set-Cookie: gstack_pty=...` は、ブラウザ以外の呼び出し元のためのフォールバックとして残されています (クロスポートの `SameSite=Strict`
Cookie の経路は、chrome-extension のオリジンからは機能しないためです)。

**ペインをまたぐ PTY への注入。** ツールバーの Cleanup ボタンと Inspector の「Send to Code」アクションは、どちらも
`sidepanel-terminal.js` が公開する `window.gstackInjectToTerminal(text)` を通じて、テキストを稼働中の claude PTY に送ります。
`/sidebar-command` への POST はありません。サイドバーで実行の対象になるのは、今では稼働中の REPL だけです。

**`/health` はトークンを一切公開してはならず、もう公開していません** (v1.63 以降)。
headed モードでの `AUTH_TOKEN` の漏えいという過去の問題は修正されています。`GET /health` は、どのモードでも生存確認と状態の表示だけです。
トークンのブートストラップは `POST /extension-token` で行われ、これは呼び出し元の Origin を、固定された拡張機能の識別子
(`extension/manifest.json` の `key` フィールドが拡張機能 ID を固定します。`browse/src/server.ts` の `GSTACK_EXTENSION_ID`。
導出は `bun browse/scripts/extension-id.ts` で再現できます) と、ループバックの Host の両方に対して検証します。PTY の認証は引き続き
`POST /pty-session` のみを通じて行われます。`/health` にはどのトークンも追加しないでください。

**トランスポート層のセキュリティ** (v1.6.0.0 以降)。`pair-agent` が ngrok トンネルを開始すると、デーモンは 2 つの HTTP リスナーをバインドします。
ローカルのリスナー (127.0.0.1。コマンドの全範囲。決して転送されない) と、トンネルのリスナー (固定された許可リスト: `/connect`、
スコープ付きトークンを伴う `/command` と 26 個のブラウザ操作コマンドの許可リスト、`/sidebar-chat`)。ngrok が転送するのはトンネルのポートだけです。
トンネル上のルートトークンは 403 を返します。SSE エンドポイントは、`POST /sse-session` を通じて発行される 30 分間の HttpOnly の `gstack_sse` Cookie を使います
(`/command` に対しては決して有効ではありません)。トンネル側の拒否は、`tunnel-denial-log.ts` を通じて `~/.gstack/security/attempts.jsonl` に記録されます。
`server.ts`、`sse-session-cookie.ts`、または `tunnel-denial-log.ts` を編集する前に、
[ARCHITECTURE.md](../ARCHITECTURE.md#dual-listener-tunnel-architecture-v1600) を読んでください。
モジュールの境界 (`token-registry.ts` から `sse-session-cookie.ts` への import がないこと) は、スコープの分離のために不可欠です。

**サーバーの出力地点での Unicode のサニタイズ** (v1.38.0.0 以降)。ページの内容に由来する文字列を送るサーバーの出力地点はすべて、
オブジェクトのペイロードなら `JSON.stringify(payload,
sanitizeReplacer)`、テキストの本文なら `sanitizeLoneSurrogates(body)` を必ず通さなければなりません。
そうしないと、CDP のページ内容から来た単独の UTF-16 サロゲートの片方が、`\uD800` のようなエスケープとして Anthropic API に届き、400 エラーを引き起こします。
現在、4 つの出力地点で配線されています: `handleCommandInternal` (HTTP とバッチ。`handleCommandInternalImpl` を包むサニタイズのラッパー経由) と、
両方の SSE の生成元 (`/activity/stream`、`/inspector/events`)。エンコードの後の正規表現は何もしません。`JSON.stringify` が
正規表現が一致する前にサロゲートをすでにエスケープしているため、replacer はエンコードのパイプラインの中で実行されなければなりません。
`server.ts` に新しい SSE/WebSocket の書き込み先や HTTP のレスポンスを追加する前に、
[ARCHITECTURE.md](../ARCHITECTURE.md#unicode-sanitization-at-server-egress-v13800) を読んでください。
`browse/test/server-sanitize-surrogates.test.ts` は、不変条件のテストによって配線を検証するので、迂回があれば CI で失敗します。

**SSE エンドポイントのヘルパー** (v1.51.0.0 以降)。`server.ts` の新しい SSE エンドポイントは、必ず `browse/src/sse-helpers.ts` の `createSseEndpoint(req, config)` を経由しなければなりません。
このヘルパーがクリーンアップの契約 (abort + enqueue-throw + heartbeat-throw。いずれも冪等) を管理し、
すべての JSON.stringify に `sanitizeLoneSurrogates` を組み込んでいるので、新しい購読者がどちらの不変条件も誤って退行させることはありません。
インラインの `ReadableStream` の配線では、TCP 接続が `req.signal.abort` を発火させずに切れた場合 (Chromium MV3 のサービスワーカーの一時停止、中間プロキシの半クローズ) に購読者がリークしていました。
`/activity/stream`、`/inspector/events`、および (SSE 対応の) `/memory` はすべてこれを経由します。
`browse/test/sse-helpers.test.ts` がクリーンアップの契約を検証します。

**CDP セッションのライフサイクル** (v1.51.0.0 以降)。`browse/src/cdp-bridge.ts` の外での、直接の `page.context().newCDPSession(page)` の呼び出しは、
`browse/test/cdp-session-cleanup.test.ts` の静的 grep トリップワイヤーによって CI で失敗します。単発の CDP 処理には `withCdpSession(page, async (s) => {...})` を
(try/finally で detach)、ページの生存期間に結びついたキャッシュ済みセッションには `getOrCreateCdpSession(page, cache)` を
(`Map<page, session>` によるページを閉じたときの detach) 使ってください。移行済みの箇所は 3 つです: cdp-bridge のフレームイベント、write-commands のアーカイブのキャプチャ、cdp-inspector。
これらのヘルパーは、成功した経路では detach されたのに、エラー経路では detach が抜けていたという、セッションのリークの種類を防ぎます。

**setup のシンボリックリンクの強化** (v1.38.0.0 以降)。`setup` のリンクを作るすべての箇所は、`IS_WINDOWS` 検出の近くにある `_link_or_copy SRC DST` ヘルパーを必ず経由しなければなりません。
Developer Mode が無効な Windows では、素の `ln -snf` は `git pull` で更新されない凍結されたファイルのコピーを作り、
すべてのホストアダプターで、気づかれないまま古い状態になります。このヘルパーは Unix では `ln -snf` をそのまま使い、Windows では `cp -R` / `cp -f` に切り替えます。
`test/setup-windows-fallback.test.ts` は静的な不変条件を強制します。ヘルパーの本体の外にある生の `ln` 呼び出しが 1 つでもあれば、CI で失敗します。
Windows のユーザーには、`_print_windows_copy_note_once` から、`git pull` のたびに `./setup` を再実行するよう促す 1 行の注記が表示されます。

**サイドバーのセキュリティスタック** (プロンプトインジェクションに対する多層防御):

| 層 | モジュール | 配置 |
|-------|--------|----------|
| L1-L3 | `content-security.ts` | サーバーと読み取りの経路 — データマーキング、非表示要素の削除、ARIA の正規表現、URL のブロックリスト、エンベロープによるラップ |
| L4 | `security-classifier.ts` (TestSavantAI ONNX) | **セキュリティサイドカーのサブプロセスのみ** (`security-sidecar-entry.ts`。server.ts から `security-sidecar-client.ts` が駆動する) |
| Canary | `security.ts` (generate/inject/detect) | 純粋なユーティリティ — 現在は本番の注入処理がない (それを注入していたチャットのプロンプトビルダーは取り除かれた) |
| Combiner | `security.ts` (combineVerdict + THRESHOLDS) | 純粋で、テスト済み。現在どの稼働中の層も生成しなくなった LayerSignal の入力に対する transcript/deberta の投票処理を保持している |

履歴のメモ: L4b の Haiku transcript 分類器と、オプトインの DeBERTa のアンサンブル
(`GSTACK_SECURITY_ENSEMBLE=deberta`) は、それらを呼び出していたチャット経路のエージェントが取り除かれるまで存在していました。本番での呼び出し元がゼロの
デッドコードとして、両方とも削除されました。もう稼働中のものとして文書化しないでください。

**重要な制約:** `security-classifier.ts` は、コンパイル済みの browse バイナリから import できません。`@huggingface/transformers` v4 は
`onnxruntime-node` を必要とし、これは Bun のコンパイルの一時展開ディレクトリから `dlopen` に失敗します。そのためサイドカーのサブプロセスを使います。
`server.ts` にとって安全なのは `security.ts` だけです (文字列のみの純粋な処理: canary のユーティリティ、verdict の結合、状態)。元の設計判断については、
`~/.gstack/projects/garrytan-gstack/ceo-plans/2026-04-19-prompt-injection-guard.md`
の「Pre-Impl Gate 1 Outcome」を参照してください。

**しきい値** (`security.ts` 内): `BLOCK: 0.85`、`WARN: 0.75`、`LOG_ONLY: 0.40`、
`SOLO_CONTENT_BLOCK: 0.92` (ラベルなしのコンテンツ分類器は「インジェクション」と「ユーザーを狙ったフィッシング」を区別できないため、単独での基準は高く設定されています)。
稼働中の L4 の経路は、server.ts のサイドカースキャンの処理でこれらを適用します。canary の漏えいは常に BLOCK します (決定的な判定)。

**環境変数のつまみ:**
- `GSTACK_SECURITY_OFF=1` — 緊急用の停止スイッチ。ウォームアップ済みでも分類器はオフのままです。L1-L3 のフィルターは動き続けます。
- 分類器のモデルのキャッシュ: `~/.gstack/models/testsavant-small/` (112MB。初回の実行時のみ)
- 攻撃のログ: `~/.gstack/security/attempts.jsonl` — `tunnel-denial-log.ts` が書き込む (トンネル側の拒否。10MB で切り替わり、5 世代分保持)

履歴のメモ (#2557): プロセス間のセッション状態
(`~/.gstack/security/session-state.json`)、`getStatus()`、`/health` の `security` フィールド、サイドパネルの SEC シールドは、すべて削除されました。
状態ファイルは、唯一の書き込み元であった sidebar-agent.ts が取り除かれた時点で、書き込み元を失っていたからです。そのためシールドは、
永続的な 'inactive' や、古いディスクの状態による誤った「protected」を表示していました。稼働中の防御 (L1-L3 のフィルター、
注入スキャンの経路にある L4 のサイドカー) は、それぞれの呼び出し箇所を通じて報告し、/health は経由しません。
`browse/test/extension-token.test.ts` は、実際の /health の本文でこの削除を検証し、`browse/test/pty-inject-scan.test.ts` は、稼働中の L4 の配線を動作ベースで検証します。
もう稼働中のものとして文書化しないでください。
