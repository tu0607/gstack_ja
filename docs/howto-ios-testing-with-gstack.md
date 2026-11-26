# gstack iOS で iOS アプリをテストする方法

これは、gstack に付属する iOS の QA 機能をエンドツーエンドで説明するガイドです。正規の Swift テンプレートをアプリにインストールし、実機の iPhone を USB で接続して、どのエージェントからでも操作します(ローカルの Claude Code、または Tailscale 経由で HTTP に対応した任意のエージェント)。シミュレーターも、XCTest のハーネスも、WebDriverAgent も使いません。

以下のすべては、実機の iPhone 17 Pro Max(iOS 26.5)でエンドツーエンドに検証済みです。同じ手順は iOS 16 以降の任意のデバイスで動作します。

## 必要なもの

- Xcode 16.0 以降がインストールされた macOS(`xcrun devicectl --version` が成功すること)。Xcode 16 には、`devicectl` が USB 経由でデバイスに到達するために使う CoreDevice トンネルが含まれています。
- iOS/iPadOS 16 以降の実機の iPhone または iPad(iPad の Stage Manager やマルチウィンドウのレイアウトは、まだ実機での検証をしていません)。ロックを解除し、Mac とペアリングされていて、設定 → プライバシーとセキュリティで **デベロッパモード** が有効になっていること。
- Apple の開発者チーム。無料の個人チームで、実機へのデバッグ用デプロイには十分です。必要なのはチーム ID(例: `623FYQ2M88`)で、証明書の ID ではありません。Xcode → 設定 → アカウント → 自分の Apple ID → チームの一覧で確認できます。セットアップは、最初のデプロイ時に `-allowProvisioningUpdates -allowProvisioningDeviceRegistration` を使って、アプリをデバイス向けに署名します。
- gstack がインストール済みであること(`./setup` が完了していて、`gstack-ios-qa-regen` と `gstack-ios-qa-daemon` が PATH にあること)。
- PATH 上の Bun ランタイム(`bun --version`)。Mac 側のデーモンは bun のプロセスです。

任意のリモートエージェント(Tailscale)モードでは、さらに、Mac に Tailscale がインストールされていて、`/var/run/tailscale.sock` が読み取り可能である必要があります。

## アーキテクチャを一言で

```
┌─────────────────┐   tailnet (opt)    ┌──────────────────────┐   USB CoreDevice    ┌─────────────────────┐
│ Remote agent    │ ─────────────────▶ │ gstack-ios-qa-daemon │ ──────────────────▶ │ iOS app StateServer │
│ (Claude, GPT,   │  bearer + session  │  (Mac, bun/TS)       │  IPv6 ULA tunnel    │  (loopback only)    │
│  OpenClaw, ...) │                    │                      │                     │                     │
└─────────────────┘                    └──────────────────────┘                     └─────────────────────┘
```

- iOS アプリには、`StateServer`(`DebugBridge` の SPM ライブラリ、`#if DEBUG` のみ)が組み込まれ、`::1` と `127.0.0.1` のポート 9999 で待ち受けます。bearer トークンで保護されています。使い捨ての起動トークンは、アプリの `tmp/` にある 0600 のファイルに置かれます(`os_log` には出しません)。デーモンがそれをコピーし、約5秒以内にローテーションします。そのときファイルは削除されるので、後からコピーしても無効な認証情報です。アプリがファイルを書けなかった場合は `NOT READY` をログに出し、`/healthz` には `boot_token_error` が入ります。
- Mac のデーモンは、デバイスが接続されると `xcrun devicectl` が自動的に開く CoreDevice の IPv6 トンネル経由で、トラフィックを中継します。
- Tailscale モードでは、デーモンはテールネットの IP にバインドされた別のリスナーを公開します。セッショントークンごとに、observe / interact / mutate / restore の権限レベルが強制されます。トークンは、Mac の所有者が `gstack-ios-qa-mint` で明示的に発行します。リモートの呼び出し元が自動で許可リストに入ることはありません。

iOS の `StateServer` は、リモートモードでも**常に**ループバックのみです。iPhone には Tailscale の ID を検証する手段がないので、ID の検証は Mac 側で行われます。

## 手順 1: DebugBridge パッケージを生成する

アプリのルートで `/ios-qa` を実行するか、同じ決定的な再生成ツールを直接呼び出してください。

```bash
gstack-ios-qa-regen \
  --app-source "$PWD/Sources/YourApp" \
  --bridge-dir "$PWD/DebugBridge"
```

このコマンドは、正規のテンプレートの明示的な許可リストを、ローカルの `DebugBridge/` Swift パッケージにコピーし、`DebugBridgeGenerated/StateAccessor.swift` を生成し、インストールされたバージョンを `DebugBridgeGenerated/.gstack-version` に書き込みます。生成された出力はそれ自身のスキーマのハッシュから除外されるので、ソースが変わらないまま再実行すると、高速でバイト単位で安定したキャッシュヒットになります。また、古いフラットなハーネスのレイアウトから残っている、明示的な古い生成ファイルのセットも削除します。これにより、古いブリッジのソースが、パッケージの代わりに読み込まれることを防ぎます。

1. `DebugBridge/` をローカルのパッケージの依存関係として追加します。`DebugBridgeUI` プロダクトに依存するのは Debug 構成のときだけにしてください。`DebugBridgeCore` と `DebugBridgeTouch` は推移的に入ってきます。
2. `DebugBridgeGenerated/StateAccessor.swift` をアプリのターゲットに追加します。
3. `@main` の App の init で、サーバーを開始する前に UIKit のリゾルバをインストールし、生成されたアクセサを登録します。例の状態名やアクセサ名は、生成ツールが見つけた型に置き換えてください。

   ```swift
   #if DEBUG
   import DebugBridgeCore
   #if canImport(UIKit)
   import DebugBridgeUI
   #endif
   #endif

   // Inside App.init(), after appState is initialized:
   #if DEBUG
   #if canImport(UIKit)
   DebugBridgeUIWiring.installAll()
   #endif
   DebugBridgeManager.shared.start(
       appState: appState,
       register: AppStateAccessor.register
   )
   #endif
   ```

3 つの SwiftPM ターゲットの分担は次のとおりです。`DebugBridgeCore` はクロスプラットフォームなので、CI の Mac ホストでの `swift build` で、UIKit なしにコードの大部分を検証できます。`DebugBridgeUI` と `DebugBridgeTouch` は iOS 専用で、UIKit にリンクします。`DebugBridgeTouch` は Objective-C です。KIF 由来の UITouch 合成を含み、iOS 18 以降の `_UIHitTestContext` の修正が入っているため、SwiftUI の Button のタップが実際に発火します。

Release ビルドを防ぐ構造的なガードは、何層かに分かれています。`Package.swift` の `.when(configuration: .debug)` の句により、SwiftPM は Release ビルドでどの `DebugBridge*` ターゲットのリンクも拒否します。そのため、後片付けを忘れても、ブリッジが TestFlight に出ることはありません。さらにその上で、`DebugBridgeTouch.m` のプライベート API のタッチ合成は `#if TARGET_OS_IOS && DEBUG` の内側でコンパイルされます(`Package.swift` の `cSettings` により、そのターゲットでは Debug 構成のときだけ `DEBUG` が定義されます)。そのため、Release のコンパイルではタッチブリッジは空の変換単位を出力します。リンカのガードを回避されたとしても、バイナリにプライベートのシンボルは一つもありません。

## 手順 2: ビルドしてデバイスにインストールする

アプリのプロジェクトディレクトリから:

```
xcodebuild \
  -scheme YourAppScheme \
  -configuration Debug \
  -destination 'generic/platform=iOS' \
  -derivedDataPath /tmp/build \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  CODE_SIGN_STYLE=Automatic \
  DEVELOPMENT_TEAM=YOUR_TEAM_ID \
  build
```

そのあと、インストールして起動します。

```
UDID=$(xcrun devicectl list devices 2>/dev/null | awk 'NR>2 && $0!="" {print $(NF-2); exit}')
xcrun devicectl device install app --device "$UDID" /tmp/build/Build/Products/Debug-iphoneos/YourApp.app
xcrun devicectl device process launch --device "$UDID" --terminate-existing your.bundle.id
```

電話がロックされていると、`FBSOpenApplicationServiceErrorDomain error 1 — Locked` が出ます。ロックを解除してから再試行してください。初めてインストールするときは、電話に「信頼」のダイアログが出ます。「信頼」をタップしてから、再実行してください。

## 手順 3: Mac 側のデーモンを起動する

方法は2つあります。

**オプション A — スキルに起動させる。** どこからでも Claude Code で `/ios-qa` を実行してください。スキルがオンデマンドでデーモンを起動し、トンネルを立ち上げ、起動トークンをローテーションして、プロキシ経由でデバイスを公開します。ローカルの USB で使うには、最も簡単な方法です。

**オプション B — 自分で起動する。** 次を実行します。

```
gstack-ios-qa-daemon
```

デーモンは、両方のループバックリスナーがバインドされると `READY: port=<n> pid=<pid>` を表示します。デフォルトのポートは 9099 です。起動するプロセスは、この行を約5秒のタイムアウトで読み取って準備完了を確認できます。表示されたポートに `curl` を向けることもできます。

どちらの場合も、デーモンは `~/.gstack/ios-qa-daemon.pid` に排他的な flock を取ります。2つの Claude Code セッションから2回実行しても安全です。2回目の呼び出しは、実行中のデーモンのポートを見つけて、それに参加します。

特定のデバイスやバンドルを対象にするには、次の環境変数を設定します。

```
GSTACK_IOS_TARGET_UDID=248C3A58-B843-5BDB-8F5D-89ADB7D7BF6A
GSTACK_IOS_TARGET_BUNDLE_ID=com.yourorg.yourapp
GSTACK_IOS_DAEMON_PORT=9099       # loopback listener port; default 9099
GSTACK_IOS_LAUNCH_ENV='{"DEBUG_BRIDGE":"1"}'   # optional: env for the app when the daemon launches it
```

`GSTACK_IOS_LAUNCH_ENV` は、デバッグブリッジ(またはそのほかのもの)が環境変数でゲートされているアプリのためのものです。文字列から文字列へのマップの JSON オブジェクトで、デーモンはこれを、デーモンが実行するすべての起動に `xcrun devicectl device process launch --environment-variables` として渡します。下記の強制再起動も含みます。効果があるのは、デーモンがアプリを起動したときだけです。すでに実行中のアプリは、起動時の環境をそのまま保持します。不正な JSON、文字列でない値、`GSTACK_` のキー(デバッグブリッジ用に予約されています)があると、環境変数なしでアプリを起動するのではなく、`IOS_LAUNCH_ENV_INVALID` で起動を拒否します。

`GSTACK_IOS_TARGET_UDID` が未設定の場合、デーモンはペアリング済みで利用可能な最適な iPhone または iPad を選びます。有線接続のデバイスを優先します。2台が同順位になった場合(USB 接続の iPhone と iPad の両方など)は、推測することを拒否します。ブートストラップのエラーには、デバイスごとに UDID が表示され、すぐに使える `export GSTACK_IOS_TARGET_UDID=<udid>` の行が出ます。
デーモンは、稼働中はトンネルが健全であればローテーション済みのトンネルを保持します。CoreDevice の経路が切れた(`503 device_disconnected` / `504 upstream_timeout`)場合は、同じ UDID のトンネルアドレスを再解決し、保持している bearer で実行中のアプリをプローブします。そのためアプリは状態を保ったままになります。再ブートストラップするのは、アプリがその bearer を拒否したとき(401、アプリが再起動された)、アプリが実行されていないとき(通常の起動が1回)、または別のデバイスが選択されたときだけです。古い bearer が別のデバイスに送られることは決してありません。応答が失われたタップやそのほかの変更は、再送されることは決してありません。
新しく起動したデーモンが、以前のデーモンが1回限りの起動トークンを消費した、すでに実行中のターゲットに到達した場合は、バンドルの所有者を検証し、そのターゲットを1回だけ強制的に再起動し、新しいトークンを待ち、所有権を再度検証してから、通常どおりローテーションします。

## 手順 4: デバイスを操作する

デーモンが実行されると、`http://127.0.0.1:9099`(または `[::1]:9099`)で HTTP のサーフェスが使えます。スキルのフローがこれを代わりに行いますが、生のエンドポイントは次のとおりです。

| エンドポイント | 役割 | 認証 |
|---|---|---|
| `GET /healthz` | バージョンの確認。 | なし(ループバック) |
| `POST /auth/rotate` | デーモン専用。起動トークンを、メモリ上のみの値にローテーションする。 | 起動トークン |
| `POST /session/acquire` | デバイスごとのセッションロックを取得する。`{session_id, ttl_seconds}` を返す。 | bearer |
| `POST /session/release` | ロックを解放する。 | bearer + セッション |
| `GET /screenshot` | アクティブなウィンドウの PNG をキャプチャする。`{png_base64: "..."}` を返す。 | bearer |
| `GET /elements` | アクセシビリティツリーのスナップショット。 | bearer |
| `GET /state/snapshot` | `// @Snapshotable` が付いたすべてのフィールドを JSON としてダンプする。 | bearer |
| `POST /state/restore` | スナップショット全体を検証してから、MainActor で復元する。 | bearer + セッション、mutate 権限 |
| `POST /tap` `{x,y}` | ウィンドウ座標で、実際の UITouch を合成する。SwiftUI の Button が発火する。 | bearer + セッション、interact 権限 |
| `POST /swipe` `{from_x,from_y,to_x,to_y}` | 最も近い外側の UIScrollView をスクロールする。 | bearer + セッション、interact 権限 |
| `POST /type` `{text}` | 現在の first responder にテキストを設定する。 | bearer + セッション、interact 権限 |

変更を伴うリクエストには、`Authorization: Bearer <token>` ヘッダーと `X-Session-Id` ヘッダーの両方が必要です。読み取り専用のエンドポイント(`/screenshot`、`/elements`、`GET /state/*`)は bearer だけが必要です。

状態のスナップショットは、プロパティの直前に置かれたスタンドアロンのジェネレータ・マーカーコメントによって、フィールドごとにオプトインします。これは意図的にプロパティラッパーではないので、Observation と問題なくコンパイルできます。

```swift
@Observable
final class AppState {
    // @Snapshotable
    var username: String = ""

    var authToken: String = "" // never exported
}
```

マーカーの付いていないフィールドは、スナップショットに決して現れません。これにより、トークン、個人情報、認証の状態が、デフォルトで記録されたフィクスチャに入らなくなります。マーカーの付いたフィールドは、ファイルスコープの observable クラスの、書き込み可能なインスタンスの `var` で、明示的な型を持ち、内部または公開のセッターでなければなりません。サポートされるスナップショットの型は、JSON ネイティブのスカラー(`String`、`Bool`、符号付き/符号なし整数の各幅、`Float`、`Double`、`CGFloat`)、配列、String をキーとする辞書、およびそれらの Optional の組み合わせです。スナップショットのキーは、observable クラスをまたいでユニークでなければなりません。ジェネレータは、無効な宣言、カスタムの値、暗黙的に非ラップの Optional、ネストした observable クラス、重複するキーに遭遇すると、壊れた、または情報を欠いた Swift を出力する代わりに、報告して停止します。復元は2段階で行われます。すべてのモデルがまず入力全体を検証し、そのあとで初めて MainActor で代入が適用されます。

## 手順 5: リモートのエージェントを動かす(任意)

別のマシン上のエージェントにデバイスを操作させたい場合は、`--tailnet` を付けてデーモンを起動してください。

```
gstack-ios-qa-daemon --tailnet
```

デーモンはまず `/var/run/tailscale.sock` を調べます。ソケットがないか読み取れない場合は、テールネットのリスナーをまったく開きません(ループバックは引き続き動きます)。リモートモードが中途半端に起動することはありません。

次に、接続させたい ID のためのセッショントークンを発行します。

```
gstack-ios-qa-mint grant --remote 'alice@example.com' --capability interact
gstack-ios-qa-mint grant --remote 'tag:ci' --capability mutate --ttl 86400 --note 'nightly'
gstack-ios-qa-mint list
```

権限のレベルは入れ子になっています。`observe`(読み取りのエンドポイントのみ)⊂ `interact`(タップ、スワイプ、入力)⊂ `mutate`(`POST /state/*`)⊂ `restore`(`POST /state/restore`)。仕事を果たせる最小のレベルを選んでください。許可リストのファイルは `~/.gstack/ios-qa-allowlist.json`(モード 0600)にあります。デーモンは `/auth/mint` のリクエストごとにこれを読み込むので、変更は再起動なしで即座に反映されます。

リモートのエージェントは、デーモンのテールネットのリスナーに対して `POST /auth/mint` を呼び出します。デーモンは、tailscaled の WhoIs エンドポイント経由で呼び出し元の ID を正規化し、許可リストを確認して、短命のセッショントークン(デフォルト 1 時間、上限 24 時間)を返します。認証された変更リクエストはすべて `~/.gstack/security/ios-qa-audit.jsonl` に記録されます。拒否されたリクエストは `~/.gstack/security/attempts.jsonl` に記録されます。

## 手順 6: リリース用ビルドを出荷する

TestFlight や App Store に出す前に、`/ios-clean` を実行してください。`DebugBridge` の SPM 依存関係を削除し、`@main` の App から `#if DEBUG` の配線を取り除きます。`Package.swift` の構造的なガード(`condition: .when(configuration: .debug)`)により、後片付けを忘れても Release ビルドはブリッジをリンクしませんが、`/ios-clean` はレビューしやすい、整った差分を提供します。

## よくある失敗

| 症状 | 壊れている箇所 |
|---|---|
| `xcodebuild` が `Could not locate device support files for iOS X.Y` で失敗する | `xcodebuild -downloadPlatform iOS` を実行して、iPhone の iOS バージョン用のデバイスサポートパッケージを取得する(約 8GB)。 |
| インストールは成功するが、`process launch` が `Locked` で失敗する | 電話がロックされている。ロックを解除して再試行する。 |
| ペアリング済みデバイスへの初回インストールが、わかりやすいエラーなしに失敗する | 電話が Mac を信頼する必要がある。電話の設定 → 一般 → VPN とデバイス管理を開き、確認する。 |
| 設定 → プライバシーに「デベロッパモード」のスイッチが見当たらない | デバイスを一度 Xcode → Window → Devices and Simulators に接続するか、そのデバイスに対して任意の `devicectl device install` を試す。最初の試行の後で、iOS がスイッチを表示します。 |
| `xcrun devicectl device copy from` が ERROR 7000 を返す | 元のパスが間違っている。起動トークンは、パスのルートではなく、アプリのデータコンテナ(NSTemporaryDirectory)内の `tmp/gstack-ios-qa.token` にある。 |
| ブートストラップが `multiple_devices` で失敗する | iPhone/iPad が2台以上接続されている。表示された `export GSTACK_IOS_TARGET_UDID=<udid>` を実行し、デーモンを再起動する。 |
| `(IOS_LAUNCH_ENV_INVALID)` で起動が拒否される | `GSTACK_IOS_LAUNCH_ENV` が、文字列から文字列へのマップの JSON オブジェクトではないか、`GSTACK_` のキーを設定している。修正するか未設定にして、デーモンを再起動する。詳しくは [troubleshooting](troubleshooting.md#ios-launch-env-invalid) を参照。 |
| `boot_token_unavailable ... could not write tmp/gstack-ios-qa.token` | アプリが起動トークンのファイルを書けなかった。アプリの `tmp/` ディレクトリを直し、アプリを再起動する。 |
| iOS 26 で SwiftUI の `DragGesture` や `Canvas` がタップやスワイプを無視する | 合成されたプロセス内のタッチは、iOS 26 では SwiftUI のジェスチャ認識器に届きません。また `/swipe` は `UIScrollView` しかスクロールしません。入力のルーティングの回避策は、`/ios-qa` スキルの「Known limits」を参照してください。 |
| `/healthz` は 200 を返すが、`/tap` は ok:true を返し、UI が変わらない | 電話はペアリングされているが、アプリの起動をまたいで StateServer のポートが変わった可能性がある。CoreDevice の IPv6 を再解決する(`dscacheutil -q host -a name '<DeviceName>.coredevice.local'`)。 |
| `/auth/mint` が `403 identity_not_allowed` を返す | リモートの呼び出し元の ID が、Mac の許可リストにない。Mac で `gstack-ios-qa-mint grant --remote <identity> --capability interact` を実行する。 |
| デーモンがテールネットのリスナーを開けない | Tailscale がインストールされていないか、`/var/run/tailscale.sock` が読み取れない。Tailscale を直してから、デーモンを再起動する。その間もループバックは動いている。 |
| SwiftUI の Button のタップは `ok:true` を返すが、アクションが発火しない | iOS 17 以前を使っている。その場合 `_UIHitTestContext` が存在しない。DebugBridgeTouch の実装は、SwiftUI のジェスチャコンテナに解決されないプレーンな `hitTest:` にフォールバックする。デバイスを iOS 18 以降に更新するか、代わりに UIKit のコントロールをタップする。 |

## これで得られるもの

HTTP を話せる任意の言語で、エージェントのループを書けます。スクリーンショットを撮り、モデルに次に何をすべきか尋ね、タップを送る。ステートのスナップショットを前後で撮って、`/ios-fix` の回帰テストのための決定的なフィクスチャを記録できます。同僚を許可リストに加えれば、ハードウェアに触れることなく、Tailscale 経由でノートパソコンから iPhone を操作できます。`tag:ci` のセッショントークンを、mutate 権限と 24 時間の TTL で発行すれば、同じデーモンを CI に組み込むこともできます。

全体は、あなたがすでに持っている Mac、すでに持っている iPhone、無料の Apple 開発者アカウント、そして gstack があれば成り立ちます。有料のテストサービスは不要です。シミュレーターのずれもありません。ユーザーが見ているものが、エージェントが操作しているものです。
