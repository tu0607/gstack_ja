# サイドバーのフロー

GStack Browser のサイドバーが実際にどう動くかを説明する。`sidepanel.js`、`background.js`、`content.js`、`terminal-agent.ts`、またはサイドバー関連のサーバーエンドポイントに触る前に読むこと。

サイドバーの主要な画面は1つ、**Terminal** ペインである。インタラクティブな `claude` の PTY だ。Activity / Refs / Inspector は、フッターの `debug` トグルの裏にあるデバッグ用のオーバーレイとして残っている。チャットのキュー経路(1回限りの `claude -p`、sidebar-agent.ts)は、PTY が実用になった時点で取り除いた。Terminal ペインの方が厳密に高機能だからだ。

## コンポーネント

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│  sidepanel.js + │────▶│  server.ts   │────▶│terminal-agent.ts │
│  -terminal.js   │     │  (compiled)  │     │  (non-compiled)  │
│  (xterm.js)     │     │              │     │  PTY listener    │
└─────────────────┘     └──────────────┘     └──────────────────┘
        ▲                       │                      │
        │  ws://127.0.0.1:<termPort>/ws (Sec-WebSocket-Protocol auth)
        └───────────────────────┼──────────────────────▶│ Bun.spawn(claude)
                                │                      │  terminal: {data}
                                │                      ▼
                                │              ┌──────────────────┐
                                │              │  claude PTY      │
                                │              └──────────────────┘
            POST /pty-session   │
            (Bearer AUTH_TOKEN) │
                                ▼
                       ┌──────────────────┐
                       │ pty-session-     │
                       │ cookie.ts        │
                       │ (in-memory token │
                       │  registry)       │
                       └──────────────────┘
                                │
                                │ POST /internal/grant (loopback)
                                ▼
                       ┌──────────────────┐
                       │  validTokens Set │
                       │  in agent memory │
                       └──────────────────┘
```

コンパイル済みの browse サーバーは外部の実行ファイルを `posix_spawn` できない。そのため `terminal-agent.ts` は、コンパイルされていない `bun run` の別プロセスとして動き、`claude` のサブプロセスを所有する。

## 起動から最初のキー入力までのタイムライン

```
T+0ms     CLI runs `$B connect`
            ├── Server starts (compiled)
            └── Spawns terminal-agent.ts via `bun run`

T+500ms   terminal-agent.ts boots
            ├── Bun.serve on 127.0.0.1:0 (random port)
            ├── Writes <stateDir>/terminal-port (server reads it for /health)
            ├── Writes <stateDir>/terminal-internal-token (loopback handshake)
            └── Probes claude → writes claude-available.json

T+1-3s    Extension loads, sidebar opens
            ├── background.js: GET /health (liveness only — no token) then
            │   POST /extension-token → AUTH_TOKEN. The server releases the
            │   token only to Origin chrome-extension://<pinned id>; the
            │   manifest "key" pins the ID (browse/scripts/extension-id.ts)
            ├── sidepanel-terminal.js: setState(IDLE), shows "Starting Claude Code..."
            └── tryAutoConnect() polls until window.gstackServerPort + token are set

T+ready   tryAutoConnect calls connect()
            ├── POST /pty-session (Authorization: Bearer AUTH_TOKEN)
            │   └── server mints attach token, posts /internal/grant to agent
            │   └── responds with {terminalPort, sessionId, attachToken,
            │                      leaseExpiresAt}
            ├── GET /claude-available (preflight)
            ├── new WebSocket(`ws://127.0.0.1:<terminalPort>/ws`,
            │                 [`gstack-pty.<token>`])
            │   └── Browser sends Sec-WebSocket-Protocol + Origin
            │   └── Agent validates Origin AND token BEFORE upgrading
            │   └── Agent echoes the protocol back (REQUIRED — browser
            │       closes the connection without it)
            ├── On open: send {type:"resize"} then a single \n byte
            └── Agent message handler sees the byte → spawnClaude()
```

## 認証: WebSocket は Authorization ヘッダーを送れない

ブラウザの WebSocket クライアントは `Authorization` を設定できない。ただし、`new WebSocket(url, protocols)` の第2引数で `Sec-WebSocket-Protocol` を設定できる。これを利用する。

1. `POST /pty-session`(認証: Bearer AUTH_TOKEN)→ サーバーが短命のセッショントークンを発行し、ループバック経由でエージェントに送り、JSON の本文で返す。
2. 拡張機能が `new WebSocket(url, ['gstack-pty.<token>'])` を呼ぶ。
3. エージェントは `Sec-WebSocket-Protocol` を読み、`gstack-pty.` を取り除き、`validTokens` と照合して、プロトコルを返す。このエコーは必須である。エコーがないと、Chromium はアップグレードの応答を受け取った時点で接続を閉じる。

非ブラウザのクライアント(curl、インテグレーションテスト)向けに `Set-Cookie: gstack_pty=...` ヘッダーも返す。Cookie 経路は当初の v1 の設計だったが、`SameSite=Strict` の Cookie は、chrome-extension のオリジンから server.ts:34567 → agent:<random> へポートをまたぐ際に引き継がれない。ブラウザが実際に使うのはプロトコルトークンの経路である。

### 二重トークンのモデル

| トークン | 保存場所 | 用途 | 有効期間 |
|-------|----------|----------|----------|
| `AUTH_TOKEN` | `<stateDir>/browse.json`。server.ts のメモリ内。拡張機能のメモリには、固定したオリジンからの `POST /extension-token` で入る(`GET /health` からは決して得ない) | `/pty-session` への POST(Cookie とトークンを発行) | サーバーの稼働期間 |
| `gstack-pty.<...>`(Sec-WebSocket-Protocol) | ブラウザのメモリのみ。エージェントの `validTokens` Set | `/ws` のアップグレード認証 | 30分。WS が閉じると自動で失効 |
| `INTERNAL_TOKEN` | `<stateDir>/terminal-internal-token`。エージェントのメモリ内 | サーバーからエージェントへのループバック `/internal/grant` | エージェントの稼働期間 |

`AUTH_TOKEN` は `/ws` に直接使うことは**決して**できない。セッショントークンは `/pty-session` や `/command` に**決して**使えない。この厳密な分離により、SSE やページ内容からのトークンの漏えいがシェルへのアクセスに発展するのを防ぐ。

## 脅威モデル

Terminal ペインは、意図的に prompt-injection のセキュリティ層を**迂回する**。ユーザーが claude に直接入力しており、ループ内に信頼できないページの内容がないからだ。信頼の源はキーボードであり、ローカルのターミナルと同じである。

この信頼の前提は、次の3つの転送上の保証に依存している。

1. **ローカルのみのリスナー。** terminal-agent.ts は `127.0.0.1` にのみバインドする。トンネルの面(server.ts の `TUNNEL_PATHS`)には `/pty-session` や `/terminal/*` が含まれないため、トンネルはデフォルトで拒否して 404 を返す。
2. **Origin ゲート。** `/ws` のアップグレードには `Origin: chrome-extension://<id>` が必要である。ローカルホストの Web ページは、Origin が通常の `http(s)://...` になるため、シェルに対するクロスサイトの WebSocket ハイジャックを仕掛けられない。
3. **セッショントークンの認証。** 認証済みの `/pty-session` への POST によってのみ発行され、1つの WS に限定され、閉じると自動で失効する。

どれか1つでも欠ければ、タブ全体が安全でなくなる。

## ライフサイクル

- **即時の自動接続。** サイドバーが開くと、tryAutoConnect がブートストラップ用のグローバル変数を確認し、設定され次第接続する。キー入力は不要。
- **WS ごとに1つの PTY。** WebSocket を閉じると claude に SIGINT を送り、3秒後に SIGKILL を送る。セッショントークンは失効させるため、盗まれたトークンを再利用できない。
- **閉じたときの自動再接続はしない。** ユーザーには「セッションが終了しました。クリックして新しいセッションを開始」と表示される。自動再接続すると、リロードのたびに新しい claude のセッションを消費してしまうからだ。v1.1 では、タブ/セッション ID をキーにしたセッションの再開を追加するかもしれない(TODOS を参照)。
- **いつでも手動で再起動できる。** `↻ Restart` ボタンは、常に表示されているターミナルのツールバーにある。ENDED の状態だけでなく、セッションの途中でも使える。

## クイックアクションのツールバー

ブラウザ操作の3つのボタンが、Terminal ペイン上部の Restart ボタンの隣にある。

| ボタン | 動作 |
|--------|----------|
| 🧹 Cleanup | `window.gstackInjectToTerminal(prompt)` を呼ぶ。「広告やバナーを削除して」という指示を、稼働中の PTY に流し込む。ターミナルの claude がそれを見て実行する。 |
| 📸 Screenshot | `POST /command screenshot`。browse サーバーを直接呼ぶ。PTY は関与しない。 |
| 🍪 Cookies | `/cookie-picker` ページに移動する。 |

Inspector の「Send to Code」ボタンは、同じ `gstackInjectToTerminal` の経路を使い、CSS のインスペクターのデータを claude に転送する。

## デバッグ用の画面(Activity / Refs / Inspector)

フッターの `debug` トグルの裏にある。SSE で駆動され、Terminal ペインとは独立している。

- **Activity** — `/activity/stream` の SSE を通じて、browse のすべてのコマンドを流す。
- **Refs** — REST: `GET /refs`。現在のページの `@ref` 要素のラベル。
- **Inspector** — CDP ベースの要素ピッカー。`/inspector/events` の SSE。

デバッグのストリップを閉じると、Terminal ペインが再び表示される。xterm.js は、コンテナが `display:none` から `display:flex` に変わっても自動では再描画されない。そのため sidepanel-terminal.js は `#tab-terminal` の class 属性に対して `MutationObserver` を走らせ、`.active` が戻ったときに fit と refresh を強制する。

## ファイル

| コンポーネント | ファイル | 実行環境 |
|-----------|------|---------|
| サイドバーの UI 本体 | `extension/sidepanel.html` + `sidepanel.js` + `sidepanel.css` | Chrome のサイドパネル |
| ターミナルの UI | `extension/sidepanel-terminal.js` + `extension/lib/xterm.js` | Chrome のサイドパネル |
| サービスワーカー | `extension/background.js` | Chrome のバックグラウンド |
| コンテンツスクリプト | `extension/content.js` | ページのコンテキスト |
| HTTP サーバー | `browse/src/server.ts` | Bun(コンパイル済みバイナリ) |
| PTY エージェント | `browse/src/terminal-agent.ts` | Bun(非コンパイル) |
| PTY トークンストア | `browse/src/pty-session-cookie.ts` | Bun(コンパイル済み、server.ts 内) |
| CLI のエントリ | `browse/src/cli.ts` | Bun(コンパイル済みバイナリ) |
| 状態ファイル | `<stateDir>/browse.json` | ファイルシステム |
| ターミナルのポート | `<stateDir>/terminal-port` | ファイルシステム |
| 内部トークン | `<stateDir>/terminal-internal-token` | ファイルシステム |
| Claude のプローブ | `<stateDir>/claude-available.json` | ファイルシステム |
| アクティブなタブ | `<stateDir>/active-tab.json` | ファイルシステム(claude が読む) |
