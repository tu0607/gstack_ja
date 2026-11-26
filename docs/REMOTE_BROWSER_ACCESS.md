# リモートブラウザへのアクセス — GStack Browser とペアリングする方法

> **対象範囲:** `/pair-agent` が共有するのは、gstack 独自のブラウザエンジンです。これは、Aside ブラウザがない場合(Linux、Windows、Aside アプリを閉じている場合)に動く**フォールバック**です。Aside が開いている Mac では、すべてのスキルが代わりに Aside を操作します。ペアリングできる共有デーモンはありません。Aside を操作する各エージェントは、自分のタブを開きます。フォールバックがいつ使われるかは [BROWSER.md](../BROWSER.md) を参照してください。

GStack Browser のサーバーは、HTTP リクエストを送れる任意の AI エージェントと共有できます。
エージェントは、本物の Chromium ブラウザへの範囲を限定したアクセス権を得ます。ページの移動、内容の読み取り、要素のクリック、フォームへの入力、スクリーンショットの撮影ができます。各エージェントは、自分専用のタブを 1 つ得ます。

この文書は、リモートエージェント向けのリファレンスです。クイックスタートの手順は、実際の認証情報を埋め込んだ状態で `$B pair-agent` が生成します。

## アーキテクチャ

```
Your Machine                          Remote Agent
─────────────                         ────────────
GStack Browser Server                 Any AI agent
  ├── Chromium (Playwright)           (OpenClaw, Hermes, Codex, etc.)
  ├── Local listener  127.0.0.1:LOCAL         │
  │    (bootstrap, CLI, sidebar, cookies)      │
  ├── Tunnel listener 127.0.0.1:TUNNEL ◄───────┤
  │    (pair-agent only: /connect and          │
  │     /command — locked allowlist)           │
  ├── ngrok tunnel (forwards tunnel port only) │
  │     https://xxx.ngrok.dev ─────────────────┘
  └── Token Registry
        ├── Root token (local listener only)
        ├── Setup keys (5 min, one-time)
        ├── Session tokens (24h, scoped)
        └── SSE session cookies (30 min, stream-scope)
```

### 二重リスナーの構成(v1.6.0.0)

デーモンは 2 つの HTTP ソケットをバインドします。**ローカルのリスナー**は、完全なコマンド面を 127.0.0.1 にだけ提供し、決して転送されません。**トンネルのリスナー**は `/tunnel/start` で遅延バインドされ(`/tunnel/stop` で解体されます)、固定のパスの許可リストを持ちます。ngrok が転送するのはトンネルのポートだけです。

ngrok の URL をたまたま見つけた人は、`/health`、`/cookie-picker`、`/inspector/*`、`/welcome` に到達できません。その TCP ソケットには、それらのパスが存在しないからです。トンネルを通じて送られたルートトークンは 403 になります。トンネルのリスナーが受け付けるのは `/connect` と `/command` だけで、後者はスコープ付きトークンと、26 個のブラウザ操作コマンドの許可リストが必要です。

エンドポイントの完全な一覧は [ARCHITECTURE.md](../ARCHITECTURE.md#dual-listener-tunnel-architecture-v1600) を参照してください。

## 接続の流れ

1. **ユーザーが実行**する: `$B pair-agent`(Claude Code では `/pair-agent`)
2. **サーバーが作成**する: 1 回限りのセットアップキー(5 分で期限切れ)
3. **ユーザーがコピー**する: 手順ブロックを、もう一方のエージェントのチャットに貼り付ける
4. **リモートエージェントが実行**する: セットアップキーを付けて `POST /connect`
5. **サーバーが返す**: スコープ付きのセッショントークン(既定は 24 時間)
6. **リモートエージェントが作成**する: `newtab` を付けて `POST /command` で、自分のタブ
7. **リモートエージェントがブラウズ**する: セッショントークンと tabId を付けて `POST /command`

## API リファレンス

### 認証

すべてのコマンドのエンドポイントは Bearer トークンを必要とします:

```
Authorization: Bearer gsk_sess_...
```

`/connect` は認証不要です(レート制限あり)。リモートエージェントは、これでセットアップキーをスコープ付きのセッショントークンに交換します。`/health` はローカルのリスナーでは認証不要です(死活確認と状態の確認だけで、トークンは決して含みません)。ただし、トンネルのリスナーには存在しません(404)。拡張機能のトークンのブートストラップは、ローカルのリスナーの `POST /extension-token` で行います。これは、固定された `chrome-extension://` の Origin によってゲートされています。これもトンネルの面にはありません。

SSE のエンドポイント(`/activity/stream`、`/inspector/events`)は、Bearer トークンか、HttpOnly の `gstack_sse` Cookie(`POST /sse-session` で発行され、TTL は 30 分、ストリームのスコープのみ。`/command` には使えません)のどちらかを受け付けます。v1.6.0.0 以降、`?token=<ROOT>` というクエリ文字列による認証は受け付けなくなりました。

### エンドポイント

#### POST /connect
セットアップキーをセッショントークンに交換します。認証は不要です。レート制限は 300/分です(フラッド対策。セットアップキーは 24 個のランダムなバイトで、総当たりは不可能です)。

```json
Request:  {"setup_key": "gsk_setup_..."}
Response: {"token": "gsk_sess_...", "expires": "ISO8601", "scopes": ["read","write","admin","meta"], "agent": "agent-name"}
```

#### POST /command
ブラウザのコマンドを送ります。Bearer 認証が必要です。

```json
Request:  {"command": "goto", "args": ["https://example.com"], "tabId": 1}
Response: (plain text result of the command)
```

#### GET /health
サーバーの状態。認証は不要です。status、activeTab、tabs、mode、uptime を返します。
`status` はデーモンの生存確認です。`activeTab`(`{ id, responsive }`、またはページがない場合は null)は、アクティブなタブのメインスレッドが 1 秒以内に応答したかどうかを示します。
トークンは決して含みません。拡張機能のトークンのブートストラップは `POST /extension-token` で行います(ローカルのリスナーのみ。固定された `chrome-extension://` の Origin とループバックの Host を検証し、そうでなければ 403)。トンネル経由では到達できません(404)。

### コマンド

#### ナビゲーション
| コマンド | 引数 | 説明 |
|---------|------|-------------|
| `goto` | `["URL"]` | URL に移動する |
| `back` | `[]` | 戻る |
| `forward` | `[]` | 進む |
| `reload` | `[]` | ページを再読み込みする |

#### 内容の読み取り
| コマンド | 引数 | 説明 |
|---------|------|-------------|
| `snapshot` | `["-i"]` | @ref ラベル付きの対話型スナップショット(最も役立つ) |
| `text` | `[]` | ページ全体のテキスト |
| `html` | `["selector?"]` | 要素またはページ全体の HTML |
| `links` | `[]` | ページ上のすべてのリンク |
| `screenshot` | `["/tmp/s.png"]` | スクリーンショットを撮る |
| `url` | `[]` | 現在の URL |

#### 操作
| コマンド | 引数 | 説明 |
|---------|------|-------------|
| `click` | `["@e3"]` | 要素をクリックする(スナップショットの @ref を使う) |
| `fill` | `["@e5", "text"]` | フォームの欄に入力する |
| `select` | `["@e7", "option"]` | ドロップダウンの値を選ぶ |
| `type` | `["text"]` | テキストを入力する(キーボード) |
| `press` | `["Enter"]` | キーを押す |
| `scroll` | `["down"]` | ページをスクロールする |

#### タブ
| コマンド | 引数 | 説明 |
|---------|------|-------------|
| `newtab` | `["URL?"]` | 新しいタブを作成する(書き込みの前に必須) |
| `tabs` | `[]` | すべてのタブを一覧表示する |
| `closetab` | `["id?"]` | タブを閉じる |

## スナップショット → @ref のパターン

これは最も強力なブラウズのパターンです。CSS セレクターを書く代わりに、次のようにします。

1. `snapshot -i` を実行して、ラベル付きの要素を含む対話型スナップショットを得る
2. スナップショットは、次のようなテキストを返す:
   ```
   [Page Title]
   @e1 [link] "Home"
   @e2 [button] "Sign In"
   @e3 [input] "Search..."
   ```
3. コマンドで `@e` の参照をそのまま使う: `click @e2`、`fill @e3 "search query"`

これがスナップショットの仕組みであり、CSS セレクターを推測するよりずっと信頼できます。必ず先に `snapshot -i` を実行し、その後で参照を使ってください。

## スコープ

| スコープ | 許可される操作 |
|-------|---------------|
| `read` | snapshot、text、html、links、screenshot、url、tabs、console など |
| `write` | goto、click、fill、scroll、newtab、closetab など |
| `admin` | eval、js、cookies、storage、cookie-import、useragent など |
| `meta` | tab、diff、frame、responsive、watch |
| `control` | stop、restart、disconnect、state、handoff — ブラウザ全体にかかわる破壊的な操作 |

ペアリングされたエージェントは、既定で `read+write+admin+meta` を得ます。ペアリングの儀式が信頼の境界です。`--restrict` は一覧を絞り込みます(`control` を与えることは決してできません)。`--control` は control のスコープを追加します(`--admin` は古い別名です)。トンネル経由では、`js`、`cookies`、`storage` のコマンドは、スコープにかかわらずコマンドの許可リストによってブロックされます。`eval` は動作します。エージェントが信頼できないウェブのコンテンツを読む場合は、`--restrict "read,write"` でペアリングしてください。スコープは、プロンプトインジェクションの影響範囲を制限します。

すでにペアリングされたエージェントの権限を絞り込むには、**同じ `--client` 名**で、より狭い `--restrict`/`--domain` を付けて再ペアリングします。権限を減らす再ペアリングは、以前のセッションを直ちに取り消し、そのタブを解放します(エージェントは新しいキーで再接続しなければなりません)。そのため、古い広い権限が残ることはありません。権限を広げたり更新したりする場合は、動作中のセッションを維持し、停止は起きません。`--client` を付けずに再ペアリングすると、代わりに新しいエージェントが作られます。`root` は予約された名前です。

## タブの分離

各エージェントは、自分で作成したタブを所有します。ルールは次のとおりです。
- **読み取り:** どのエージェントも、どのタブでも読み取れる(snapshot、text、screenshot)
- **書き込み:** タブの所有者だけが書き込める(click、fill、goto など)
- **所有者のないタブ:** 既存のタブへの書き込みは、ルートだけ可能
- **最初の一歩:** 操作の前に、必ず `newtab` を実行する

## エラーコード

| コード | 意味 | 対処 |
|------|---------|------------|
| 401 | トークンが無効、期限切れ、または取り消し済み | ユーザーに /pair-agent を再実行してもらう |
| 403 | コマンドがスコープにない、タブが自分のものでない、またはトンネルの許可リストにない | newtab を使う。ユーザーは --restrict なしで、または --control を付けて再ペアリングできる |
| 429 | レート制限超過(>10 req/s) | Retry-After ヘッダーの時間だけ待つ |

## セキュリティモデル

- **物理的なポートの分離。** ローカルのリスナーとトンネルのリスナーは別々の TCP ソケットです。ngrok が転送するのはトンネルのポートだけです。トンネルの呼び出し元は、ブートストラップのエンドポイントに一切到達できません(404。ポートが違うため)。
- **トンネルのコマンド許可リスト。** トンネル経由の `/command` が受け付けるのは、ブラウザを操作する 26 個のコマンド(goto、click、fill、snapshot、text、newtab、tabs、back、forward、reload、closetab など)だけです。サーバー管理のコマンド(tunnel、pair、token、useragent、js)は、トンネルでは拒否されます。
- **ルートトークンはトンネルでブロックされる。** トンネルのリスナーに届いたルートトークンを含むリクエストは、ペアリングのヒントとともに 403 を返します。トンネルで動くのは、スコープ付きのセッショントークンだけです。
- **セットアップキー** は 5 分で期限切れになり、1 回しか使えません。
- **セッショントークン** は 24 時間で期限切れになります(設定可能)。
- ルートトークンは、指示ブロックや接続文字列には決して現れません。
- **control のスコープ**(stop、restart、disconnect)は既定で拒否され、スコープのリストで与えられることは決してありません。admin はペアリング時に付与されます。`js`、`cookies`、`storage` は、コマンドの許可リストによってトンネル経由で引き続きブロックされます。信頼度の低いエージェントには `--restrict` を使ってください。
- トークンは即座に取り消せます: `$B tunnel revoke agent-name` はセッションと、保留中のセットアップキーをすべて削除し、現在のエージェントの一覧と照合して確認します。`$B tunnel agents` はペアリング済みのエージェントを表示します(保留中のセットアップキーを含む)。`$B stop` はすべてを消去します。トークンはデーモンより長く生き残りません。
- **SSE の認証** は、30 分の HttpOnly SameSite=Strict Cookie を使います。ストリームのスコープのみで、`/command` に対しては無効です。
- **パスのトラバーサルを防止** `/welcome` で。`GSTACK_SLUG` は `^[a-z0-9_-]+$` に一致しなければならず、そうでなければ組み込みのテンプレートにフォールバックします。
- **SSRF のガード** `goto`、`download`、スクレイピングのパスで。URL の宛先を、localhost とプライベートレンジのブロックリストに対して検証します。
- **トンネルの面の拒否ログ。** トンネルのリスナーでの拒否(`path_not_on_tunnel`、`root_token_on_tunnel`、`missing_scoped_token`、`disallowed_command:*`)はすべて、タイムスタンプ、送信元 IP、パス、メソッドとともに `~/.gstack/security/attempts.jsonl` に追記されます。書き込みは毎分 60 回までにレート制限されています。
- **トンネル開始時の egress レシート(v1.63+)。** トンネルのセッションを開くたびに、ngrok が何かを転送する前に、ハッシュチェーン付きのレシート(sink は `browse-tunnel`)を `~/.gstack/security/egress.jsonl` に書きます。失敗時は閉じます。レシートを書けなければ、トンネルは起動を拒否します。監査には `bin/gstack-egress list` / `bin/gstack-egress verify` を使います。
- すべてのエージェントの活動は、帰属(clientId)付きで記録されます。

**既知の非目標(#1136 として追跡):** Windows では、Cookie の取り込みのためのブラウザ経路が、`--remote-debugging-port=<random>` 付きで Chrome を起動します。App-Bound Encryption v20 では、同じユーザーのローカルプロセスがそのポートに接続し、復号された v20 の Cookie を持ち出せます。これは、SQLite の DB を直接読むよりも、権限昇格の経路になります。修正の方向性は、TCP の代わりに `--remote-debugging-pipe` を使うことです。

## 同一マシンの近道

2 つのエージェントが同じマシン上にあるなら、コピー&ペーストを省略できます。

```bash
$B pair-agent --local openclaw    # writes to ~/.openclaw/skills/gstack/browse-remote.json
$B pair-agent --local codex       # writes to ~/.codex/skills/gstack/browse-remote.json
$B pair-agent --local cursor      # writes to ~/.cursor/skills/gstack/browse-remote.json
```

トンネルは不要です。localhost を直接使います。

## ngrok トンネルの設定

別のマシンにあるリモートエージェントの場合:

1. [ngrok.com](https://ngrok.com) でサインアップする(無料プランで可)
2. ダッシュボードから認証トークンをコピーする
3. 保存する: `echo 'NGROK_AUTHTOKEN=your_token' > ~/.gstack/ngrok.env`
4. 任意で固定ドメインを取得する: `echo 'NGROK_DOMAIN=your-name.ngrok-free.dev' >> ~/.gstack/ngrok.env`
5. トンネル付きで起動する: `BROWSE_TUNNEL=1 $B restart`
6. `$B pair-agent` を実行する。トンネルの URL が自動的に使われます
