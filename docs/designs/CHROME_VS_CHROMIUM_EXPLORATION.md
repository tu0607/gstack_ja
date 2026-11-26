# Chrome と Chromium: なぜ Playwright 同梱の Chromium を使うのか

## 当初のビジョン

`$B connect` を作ったとき、計画はユーザーの**実際の Chrome ブラウザ**(Cookie、セッション、拡張機能、開いているタブがそのまま残っているもの)に接続することでした。Cookie のインポートは不要になるはずでした。設計は次のとおりです。

1. `chromium.connectOverCDP(wsUrl)` で、起動中の Chrome に CDP 経由で接続する
2. Chrome を穏やかに終了し、`--remote-debugging-port=9222` を付けて再起動する
3. ユーザーの実際のブラウジング環境にアクセスする

このため `chrome-launcher.ts`(ブラウザバイナリの検出、CDP ポートのプローブ、ランタイム検出を行う 361 行)が存在し、メソッド名も `connectCDP()` でした。

## 実際に起きたこと

Playwright の `channel: 'chrome'` で起動した実際の Chrome は、`--load-extension` を黙ってブロックします。拡張機能が読み込まれませんでした。サイドパネル(アクティビティフィード、参照、チャット)には拡張機能が必要でした。

実装は、Playwright 同梱の Chromium による `chromium.launchPersistentContext()` にフォールバックしました。こちらは `--load-extension` と `--disable-extensions-except` で拡張機能を確実に読み込めます。しかし名前はそのまま残りました。`connectCDP()`、`connectionMode: 'cdp'`、`BROWSE_CDP_URL`、`chrome-launcher.ts` です。

元のビジョン(ユーザーの実際のブラウザの状態にアクセスすること)は一度も実装されませんでした。毎回新しいブラウザを起動していたので、Playwright の Chromium と機能的には同じでしたが、361 行のデッドコードと誤解を招く名前が残っていました。

## 発見(2026-03-22)

`/office-hours` の設計セッションでアーキテクチャをたどったところ、次のことがわかりました。

1. `connectCDP()` は CDP を使っていない。実際には `launchPersistentContext()` を呼んでいる。
2. `connectionMode: 'cdp'` は誤解を招く。実際には単に「ヘッドフル(画面表示)モード」を意味している。
3. `chrome-launcher.ts` はデッドコードだった。その唯一の import は、到達不能な `attemptReconnect()` メソッドにだけあった。
4. `preExistingTabIds` は、一度も接続していない実際の Chrome のタブを守るために設計されていたが、その前提自体が無意味だった。
5. `$B handoff`(ヘッドレス → ヘッドフル)は別の API(`launch()` + `newContext()`)を使っていたため、拡張機能を読み込めず、「ヘッドフル」の体験が 2 種類になっていた。

## 修正内容

### 名前の変更
- `connectCDP()` → `launchHeaded()`
- `connectionMode: 'cdp'` → `connectionMode: 'headed'`
- `BROWSE_CDP_URL` → `BROWSE_HEADED`

### 削除
- `chrome-launcher.ts`(361 行)
- `attemptReconnect()`(デッドメソッド)
- `preExistingTabIds`(デッドな概念)
- `reconnecting` フィールド(デッドな状態)
- `cdp-connect.test.ts`(削除したコードのテスト)

### 統合
- `$B handoff` は、`launchPersistentContext()` と拡張機能の読み込みを使うようになった(`$B connect` と同じ)
- ヘッドフルモードは 1 種類だけ
- handoff でも拡張機能とサイドパネルが自動的に使える

### 制限
- サイドバーのチャットは `--chat` フラグの後ろに置いた
- `$B connect`(デフォルト): アクティビティフィードと参照だけ
- `$B connect --chat`: さらに実験的なスタンドアロンのチャットエージェント

## アーキテクチャ(修正後)

```
Browser States:
  HEADLESS (default) ←→ HEADED ($B connect or $B handoff)
     Playwright            Playwright (same engine)
     launch()              launchPersistentContext()
     invisible             visible + extension + side panel

Sidebar (orthogonal add-on, headed only):
  Activity tab    — always on, shows live browse commands
  Refs tab        — always on, shows @ref overlays
  Chat tab        — opt-in via --chat, experimental standalone agent

Data Bridge (sidebar → workspace):
  Sidebar writes to .context/sidebar-inbox/*.json
  Workspace reads via $B inbox
```

## なぜ実際の Chrome を使わないのか

Playwright から起動した実際の Chrome は、`--load-extension` をブロックします。これは Chrome のセキュリティ機能で、コマンドライン引数で読み込まれた拡張機能は、悪意ある拡張機能の注入を防ぐために Chromium 系ブラウザで制限されています。

Playwright 同梱の Chromium は、テストと自動化のために作られているので、この制限がありません。`ignoreDefaultArgs` オプションを使えば、Playwright 自身の拡張機能ブロックのフラグも回避できます。

ユーザーの実際の Cookie やセッションが必要になった場合の道筋は次のとおりです。
1. Cookie のインポート(`$B cookie-import` で動作済み)
2. Conductor のセッション注入(将来対応。サイドバーからワークスペースのエージェントにメッセージを送る)

実際の Chrome への再接続は行いません。
