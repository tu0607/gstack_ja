# 設計: Design Shotgun — ブラウザからエージェントへのフィードバックループ

2026-03-27 生成
ブランチ: garrytan/agent-design-tools
ステータス: 生きたドキュメント — バグの発見と修正に応じて更新する

## この機能が行うこと

Design Shotgun は、複数の AI デザインのモックアップを生成し、ユーザーの実際のブラウザで並べて開いて比較ボードにし、構造化されたフィードバックを集めます(お気に入りを 1 つ選ぶ、他の案を評価する、メモを残す、再生成を依頼する)。フィードバックはコーディングエージェントに戻り、エージェントがそれに従って動きます。承認されたバリアントで先へ進むか、新しいバリアントを生成してボードを再読み込みします。

ユーザーはブラウザのタブから離れる必要がありません。エージェントは無駄な質問をしません。ボードそのものがフィードバックの手段です。

## 中核の問題: 話をしなければならない 2 つの世界

```
  ┌─────────────────────┐          ┌──────────────────────┐
  │   USER'S BROWSER    │          │   CODING AGENT       │
  │   (real Chrome)     │          │   (Claude Code /     │
  │                     │          │    Conductor)         │
  │  Comparison board   │          │                      │
  │  with buttons:      │   ???    │  Needs to know:      │
  │  - Submit           │ ──────── │  - What was picked   │
  │  - Regenerate       │          │  - Star ratings      │
  │  - More like this   │          │  - Comments          │
  │  - Remix            │          │  - Regen requested?  │
  └─────────────────────┘          └──────────────────────┘
```

「???」が難所です。ユーザーが Chrome でボタンをクリックします。ターミナルで動くエージェントがそれを知る必要があります。この 2 つは、共有メモリも、共有のイベントバスも、WebSocket 接続もない、まったく別々のプロセスです。

## アーキテクチャ: 連携の仕組み

```
  USER'S BROWSER                    $D serve (Bun HTTP)              AGENT
  ═══════════════                   ═══════════════════              ═════
       │                                   │                           │
       │  GET /                            │                           │
       │ ◄─────── serves board HTML ──────►│                           │
       │    (with __GSTACK_SERVER_URL      │                           │
       │     injected into <head>)         │                           │
       │                                   │                           │
       │  [user rates, picks, comments]    │                           │
       │                                   │                           │
       │  POST /api/feedback               │                           │
       │ ─────── {preferred:"A",...} ─────►│                           │
       │                                   │                           │
       │  ◄── {received:true} ────────────│                           │
       │                                   │── writes feedback.json ──►│
       │  [inputs disabled,                │   (or feedback-pending    │
       │   "Return to agent" shown]        │    .json for regen)       │
       │                                   │                           │
       │                                   │                  [agent polls
       │                                   │                   every 5s,
       │                                   │                   reads file]
```

### 3 つのファイル

| ファイル | 書かれるタイミング | 意味 | エージェントの動作 |
|------|-------------|-------|-------------|
| `feedback.json` | ユーザーが Submit をクリックしたとき | 最終的な選択、完了 | 読んで、先へ進む |
| `feedback-pending.json` | ユーザーが Regenerate / More Like This をクリックしたとき | 新しい選択肢を求めている | 読んで、削除し、新しいバリアントを生成し、ボードを再読み込みする |
| `feedback.json`(2 回目以降) | 再生成の後にユーザーが Submit をクリックしたとき | 反復の後の最終的な選択 | 読んで、先へ進む |

### 状態遷移

```
  $D serve starts
       │
       ▼
  ┌──────────┐
  │ SERVING  │◄──────────────────────────────────────┐
  │          │                                        │
  │ Board is │  POST /api/feedback                    │
  │ live,    │  {regenerated: true}                   │
  │ waiting  │──────────────────►┌──────────────┐     │
  │          │                   │ REGENERATING │     │
  │          │                   │              │     │
  └────┬─────┘                   │ Agent has    │     │
       │                         │ 10 min to    │     │
       │  POST /api/feedback     │ POST new     │     │
       │  {regenerated: false}   │ board HTML   │     │
       │                         └──────┬───────┘     │
       ▼                                │             │
  ┌──────────┐                POST /api/reload        │
  │  DONE    │                {html: "/new/board"}    │
  │          │                          │             │
  │ exit 0   │                          ▼             │
  └──────────┘                   ┌──────────────┐     │
                                 │  RELOADING   │─────┘
                                 │              │
                                 │ Board auto-  │
                                 │ refreshes    │
                                 │ (same tab)   │
                                 └──────────────┘
```

### ポートの発見

エージェントは `$D serve` をバックグラウンドで起動し、stderr からポートを読み取ります。

```
SERVE_STARTED: port=54321 html=/path/to/board.html
SERVE_BROWSER_OPENED: url=http://127.0.0.1:54321
```

エージェントは stderr から `port=XXXXX` を解析します。このポートは、後でユーザーが再生成を依頼したときに `/api/reload` へ POST するために必要です。エージェントがポート番号を失うと、ボードを再読み込みできません。

### なぜ localhost ではなく 127.0.0.1 なのか

`localhost` は、一部のシステムでは IPv6 の `::1` に解決されますが、Bun.serve() は IPv4 しか待ち受けません。さらに重要なのは、`localhost` は開発者が作業してきたすべてのドメインの開発用 Cookie を送ってしまうことです。アクティブなセッションが多いマシンでは、それが Bun の既定のヘッダーサイズの上限を超えます(HTTP 431 エラー)。`127.0.0.1` ならどちらの問題も避けられます。

## すべてのエッジケースと落とし穴

### 1. ゾンビフォームの問題

**何が起きるか:** ユーザーがフィードバックを送信し、POST は成功し、サーバーは終了します。しかし HTML のページは Chrome で開いたままです。まだ操作できるように見えます。ユーザーがフィードバックを編集してもう一度 Submit をクリックするかもしれません。サーバーはすでにいないので、何も起きません。

**修正:** POST が成功すると、ボードの JS は次のとおり動きます。
- すべての入力(ボタン、ラジオ、テキストエリア、星評価)を無効にする
- Regenerate のバーを完全に隠す
- Submit ボタンを「フィードバックを受け付けました。コーディングエージェントに戻ってください。」に置き換える
- 「さらに変更したい場合は、`/design-shotgun` をもう一度実行してください。」と表示する
- ページは、送信された内容の読み取り専用の記録になる

**実装箇所:** `compare.ts:showPostSubmitState()`(484 行目)

### 2. 死んだサーバーの問題

**何が起きるか:** ユーザーがボードを開いたままにしている間に、サーバーがタイムアウト(既定 10 分)するか、クラッシュします。ユーザーが Submit をクリックします。fetch() は黙って失敗します。

**修正:** `postFeedback()` には `.catch()` ハンドラがあります。ネットワークエラーのときは次のとおり動きます。
- 赤いエラーバナーを表示: 「接続が失われました」
- 集めたフィードバックの JSON を、コピー可能な `<pre>` ブロックで表示する
- ユーザーはそれをコーディングエージェントに直接コピー＆ペーストできる

**実装箇所:** `compare.ts:showPostFailure()`(546 行目)

### 3. 止まらないローディングスピナー

**何が起きるか:** ユーザーが Regenerate をクリックします。ボードはスピナーを表示し、2 秒ごとに `/api/progress` をポーリングします。エージェントがクラッシュするか、新しいバリアントの生成に時間がかかりすぎます。スピナーが永遠に回り続けます。

**修正:** 進捗のポーリングには、厳格な 5 分のタイムアウトがあります(150 回のポーリング × 2 秒間隔)。5 分経つと次のとおり動きます。
- スピナーを「問題が発生しました。」に置き換える
- 「コーディングエージェントで `/design-shotgun` をもう一度実行してください。」と表示する
- ポーリングを止める。ページは情報表示のみになる

**実装箇所:** `compare.ts:startProgressPolling()`(511 行目)

### 4. file:// URL の問題(最初のバグ)

**何が起きるか:** スキルのテンプレートは当初 `$B goto file:///path/to/board.html` を使っていました。しかし `browse/src/url-validation.ts:71` は、セキュリティのために `file://` URL をブロックします。フォールバックの `open file://...` はユーザーの macOS ブラウザを開きますが、`$B eval` がポーリングしているのは Playwright のヘッドレスブラウザ(別のプロセスで、そのページを読み込んでいない)です。エージェントは空の DOM を永遠にポーリングし続けます。

**修正:** `$D serve` は HTTP で配信します。ボードに `file://` を使うことは決してありません。`$D compare` の `--serve` フラグが、ボードの生成と HTTP 配信を 1 つのコマンドにまとめます。

**証拠:** `.context/attachments/image-v2.png` を参照してください。実際のユーザーがまさにこのバグに遭遇しました。エージェントは正しく原因を突き止めました。(1) `$B goto` は `file://` URL を拒否する、(2) デーモンがあってもポーリングのループがない。

### 5. ダブルクリックの競合

**何が起きるか:** ユーザーが Submit を素早く 2 回クリックします。サーバーに 2 つの POST が届きます。最初のものは状態を "done" にし、100ms 後の exit(0) を予約します。2 つ目は、その 100ms の間に届きます。

**現状:** 完全には防げていません。`handleFeedback()` は、状態がすでに "done" かどうかを確認せずに処理します。2 つ目の POST は成功し、2 つ目の `feedback.json` を書きます(害はない。同じデータ)。終了は 100ms 後にやはり実行されます。

**リスク:** 低い。ボードは最初の POST の応答で、すべての入力を無効にします。そのため、2 回目のクリックは約 1ms 以内に届く必要があります。また、両方の書き込みは同じフィードバックデータを含みます。

**対策案:** `handleFeedback()` の先頭に `if (state === 'done') return Response.json({error: 'already submitted'}, {status: 409})` を追加する。

### 6. ポートの調整の問題

**何が起きるか:** エージェントは `$D serve` をバックグラウンドで起動し、stderr から `port=54321` を解析します。再生成のときに `/api/reload` へ POST するため、後でこのポートが必要です。エージェントがコンテキストを失うと(会話が圧縮される、コンテキストウィンドウがいっぱいになる)、ポートを覚えていないかもしれません。

**現状:** ポートは一度だけ stderr に出力されます。エージェントが覚えておく必要があります。ディスクに書かれるポートファイルはありません。

**対策案:** 起動時に、ボードの HTML の隣に `serve.pid` または `serve.port` ファイルを書く。エージェントはいつでもそれを読めます。
```bash
cat "$_DESIGN_DIR/serve.port"  # → 54321
```

### 7. フィードバックファイルの掃除の問題

**何が起きるか:** 再生成のラウンドで作られた `feedback-pending.json` が、ディスクに残ります。エージェントが読む前にクラッシュすると、次の `$D serve` のセッションが古いファイルを見つけてしまいます。

**現状:** リゾルバのテンプレートのポーリングループは、読んだあとに `feedback-pending.json` を削除するよう指示しています。しかし、これはエージェントが指示を完璧に守ることに依存しています。古いファイルは新しいセッションを混乱させるかもしれません。

**対策案:** `$D serve` は起動時に、古いフィードバックファイルを確認して削除できる。または、ファイル名にタイムスタンプを付ける(`feedback-pending-1711555200.json`)。

### 8. 順次生成のルール

**何が起きるか:** 基になっている OpenAI GPT Image API は、画像生成の同時リクエストをレート制限します。3 つの `$D generate` 呼び出しが並列で走ると、1 つは成功し、2 つは中断されます。

**修正:** スキルのテンプレートには、明示的にこう書かなければなりません。「モックアップは一度に 1 つずつ生成すること。`$D generate` の呼び出しを並列化しないこと。」これはプロンプトレベルの指示であり、コードレベルのロックではありません。design バイナリは順次実行を強制しません。

**リスク:** エージェントは、独立した作業を並列化するように訓練されています。明示的な指示がなければ、3 つの generate を同時に走らせようとします。それはAPI の呼び出しと費用を無駄にします。

### 9. AskUserQuestion の重複

**何が起きるか:** ユーザーがボード経由でフィードバックを送信した後(推奨のバリアント、評価、コメントはすべて JSON に入っている)、エージェントは改めて「どのバリアントがお好みですか?」と尋ねます。これは煩わしいです。ボードのそもそもの目的は、それを避けることです。

**修正:** スキルのテンプレートには次のように書かなければなりません。「AskUserQuestion でユーザーの好みを尋ねないこと。`feedback.json` を読むこと。そこにユーザーの選択が入っている。AskUserQuestion は、理解が正しいかを確認するためにのみ使い、聞き直すために使わないこと。」

### 10. CORS の問題

**何が起きるか:** ボードの HTML が外部のリソース(フォント、CDN の画像)を参照している場合、ブラウザは `Origin: http://127.0.0.1:PORT` 付きでリクエストを送ります。多くの CDN はこれを許可しますが、一部はブロックするかもしれません。

**現状:** サーバーは CORS ヘッダーを設定していません。ボードの HTML は自己完結しています(画像は base64 でエンコード、スタイルはインライン)。そのため、実際にはこれが問題になったことはありません。

**リスク:** 現在の設計では低い。ボードが外部リソースを読み込むようになったら問題になります。

### 11. 大きなペイロードの問題

**何が起きるか:** `/api/feedback` への POST 本文のサイズ上限がありません。ボードが何らかの理由で数 MB のペイロードを送ると、`req.json()` はそれをすべてメモリに解析します。

**現状:** 実際には、フィードバックの JSON は約 500 バイトから 2KB です。リスクは理論上のもので、実際の問題ではありません。ボードの JS は、固定の形の JSON オブジェクトを組み立てます。

### 12. fs.writeFileSync のエラー

**何が起きるか:** `serve.ts:138` の `feedback.json` の書き込みは、try/catch なしで `fs.writeFileSync()` を使っています。ディスクがいっぱいだったり、ディレクトリが読み取り専用だったりすると、これが例外を投げてサーバーをクラッシュさせます。ユーザーにはスピナーが永遠に回って見えます(サーバーは死んでいますが、ボードはそれを知りません)。

**リスク:** 実際には低い(ボードの HTML が同じディレクトリに書かれたばかりなので、書き込み可能なことは証明されている)。ただし、try/catch で 500 を返すようにすればより良くなります。

## 完全なフロー(手順ごと)

### 正常系: ユーザーが最初の試行で選ぶ

```
1. Agent runs: $D compare --images "A.png,B.png,C.png" --output board.html --serve &
2. $D serve starts Bun.serve() on random port (e.g. 54321)
3. $D serve opens http://127.0.0.1:54321 in user's browser
4. $D serve prints to stderr: SERVE_STARTED: port=54321 html=/path/board.html
5. $D serve writes board HTML with injected __GSTACK_SERVER_URL
6. User sees comparison board with 3 variants side by side
7. User picks Option B, rates A: 3/5, B: 5/5, C: 2/5
8. User writes "B has better spacing, go with that" in overall feedback
9. User clicks Submit
10. Board JS POSTs to http://127.0.0.1:54321/api/feedback
    Body: {"preferred":"B","ratings":{"A":3,"B":5,"C":2},"overall":"B has better spacing","regenerated":false}
11. Server writes feedback.json to disk (next to board.html)
12. Server prints feedback JSON to stdout
13. Server responds {received:true, action:"submitted"}
14. Board disables all inputs, shows "Return to your coding agent"
15. Server exits with code 0 after 100ms
16. Agent's polling loop finds feedback.json
17. Agent reads it, summarizes to user, proceeds
```

### 再生成の経路: ユーザーが別の選択肢を求める

```
1-6.  Same as above
7.  User clicks "Totally different" chiclet
8.  User clicks Regenerate
9.  Board JS POSTs to /api/feedback
    Body: {"regenerated":true,"regenerateAction":"different","preferred":"","ratings":{},...}
10. Server writes feedback-pending.json to disk
11. Server state → "regenerating"
12. Server responds {received:true, action:"regenerate"}
13. Board shows spinner: "Generating new designs..."
14. Board starts polling GET /api/progress every 2s

    Meanwhile, in the agent:
15. Agent's polling loop finds feedback-pending.json
16. Agent reads it, deletes it
17. Agent runs: $D variants --brief "totally different direction" --count 3
    (ONE AT A TIME, not parallel)
18. Agent runs: $D compare --images "new-A.png,new-B.png,new-C.png" --output board-v2.html
19. Agent POSTs: curl -X POST http://127.0.0.1:54321/api/reload -d '{"html":"/path/board-v2.html"}'
20. Server swaps htmlContent to new board
21. Server state → "serving" (from reloading)
22. Board's next /api/progress poll returns {"status":"serving"}
23. Board auto-refreshes: window.location.reload()
24. User sees new board with 3 fresh variants
25. User picks one, clicks Submit → happy path from step 10
```

### 「More Like This」の経路

```
Same as regeneration, except:
- regenerateAction is "more_like_B" (references the variant)
- Agent uses $D iterate --image B.png --brief "more like this, keep the spacing"
  instead of $D variants
```

### フォールバックの経路: $D serve が失敗する

```
1. Agent tries $D compare --serve, it fails (binary missing, port error, etc.)
2. Agent falls back to: open file:///path/board.html
3. Agent uses AskUserQuestion: "I've opened the design board. Which variant
   do you prefer? Any feedback?"
4. User responds in text
5. Agent proceeds with text feedback (no structured JSON)
```

## この機能を実装しているファイル

| ファイル | 役割 |
|------|------|
| `design/src/serve.ts` | HTTP サーバー、状態遷移、ファイルの書き込み、ブラウザの起動 |
| `design/src/compare.ts` | ボードの HTML の生成、評価/選択/再生成の JS、POST の処理、送信後のライフサイクル |
| `design/src/cli.ts` | CLI のエントリポイント、`serve` と `compare --serve` のコマンドを接続 |
| `design/src/commands.ts` | コマンドのレジストリ。`serve` と `compare` を引数とともに定義 |
| `scripts/resolvers/design.ts` | `generateDesignShotgunLoop()` — ポーリングループと再読み込みの指示を出力するテンプレートのリゾルバ |
| `design-shotgun/SKILL.md.tmpl` | 全体の流れを統括するスキルのテンプレート: コンテキストの収集、バリアントの生成、`{{DESIGN_SHOTGUN_LOOP}}`、フィードバックの確認 |
| `design/test/serve.test.ts` | HTTP エンドポイントと状態遷移の単体テスト |
| `design/test/feedback-roundtrip.test.ts` | E2E テスト: ブラウザのクリック → JS の fetch → HTTP POST → ディスク上のファイル |
| `browse/test/compare-board.test.ts` | 比較ボードの UI に対する DOM レベルのテスト |

## 何がうまくいかない可能性があるか

### 既知のリスク(起こりやすい順)

1. **エージェントが順次生成のルールに従わない** — ほとんどの LLM は並列化したがります。バイナリで強制していないため、これは無視されうるプロンプトレベルの指示です。

2. **エージェントがポート番号を失う** — コンテキストの圧縮で stderr の出力が落ちる。エージェントはボードを再読み込みできなくなる。緩和策: ポートをファイルに書く。

3. **古いフィードバックファイル** — クラッシュしたセッションから残った `feedback-pending.json` が、次の実行を混乱させる。緩和策: 起動時に掃除する。

4. **fs.writeFileSync のクラッシュ** — フィードバックファイルの書き込みに try/catch がない。ディスクがいっぱいだと、サーバーが静かに死ぬ。ユーザーには無限のスピナーが見える。

5. **ポーリングのずれ** — 5 分間の `setInterval(fn, 2000)`。実際には、JavaScript のタイマーは十分正確です。しかし、ブラウザのタブがバックグラウンドに回ると、Chrome はインターバルを 1 分に 1 回へ抑制するかもしれません。

### うまくいっている点

1. **二重のチャンネルによるフィードバック** — フォアグラウンドモードは stdout、バックグラウンドモードはファイル。両方が常に有効。エージェントはどちらでも使える。

2. **自己完結した HTML** — ボードは CSS、JS、base64 エンコードの画像をすべてインラインに持つ。外部依存はない。オフラインでも動く。

3. **同じタブでの再生成** — ユーザーは 1 つのタブにとどまる。ボードは `/api/progress` のポーリングと `window.location.reload()` で自動的に更新される。タブが増殖しない。

4. **穏やかな縮退** — POST の失敗ではコピー可能な JSON を表示。進捗のタイムアウトでは明確なエラーメッセージを表示。無言の失敗はない。

5. **送信後のライフサイクル** — 送信後、ボードは読み取り専用になる。ゾンビフォームはない。「次に何をするか」が明確に示される。

## テストのカバレッジ

### テストされていること

| フロー | テスト | ファイル |
|------|------|------|
| Submit → ディスク上の feedback.json | ブラウザのクリック → ファイル | `feedback-roundtrip.test.ts` |
| 送信後の UI のロック | 入力が無効、成功が表示される | `feedback-roundtrip.test.ts` |
| Regenerate → feedback-pending.json | チクレット + 再生成のクリック → ファイル | `feedback-roundtrip.test.ts` |
| 「More like this」→ 特定のアクション | JSON 内の more_like_B | `feedback-roundtrip.test.ts` |
| 再生成後のスピナー | DOM に読み込み中のテキストが出る | `feedback-roundtrip.test.ts` |
| 再生成 → 再読み込み → Submit の全体 | 2 往復 | `feedback-roundtrip.test.ts` |
| サーバーがランダムなポートで起動する | ポート 0 のバインド | `serve.test.ts` |
| サーバー URL の HTML への注入 | __GSTACK_SERVER_URL の確認 | `serve.test.ts` |
| 不正な JSON の拒否 | 400 応答 | `serve.test.ts` |
| HTML ファイルの検証 | 存在しなければ exit 1 | `serve.test.ts` |
| タイムアウトの挙動 | タイムアウト後に exit 1 | `serve.test.ts` |
| ボードの DOM 構造 | ラジオ、星、チクレット | `compare-board.test.ts` |

### テストされていない項目

| ギャップ | リスク | 優先度 |
|-----|------|----------|
| 送信ボタンのダブルクリック競合 | 低 — 最初の応答で入力欄が無効化される | P3 |
| 進捗ポーリングのタイムアウト(150回のイテレーション) | 中 — テストで5分待つのは長すぎる | P2 |
| 再生成中のサーバークラッシュ | 中 — ユーザーには無限スピナーが表示される | P2 |
| POST 中のネットワークタイムアウト | 低 — localhost は高速 | P3 |
| バックグラウンドの Chrome タブによるインターバルのスロットリング | 中 — 5分のタイムアウトが30分以上に延びる可能性がある | P2 |
| 大きなフィードバックペイロード | 低 — ボードは固定形式の JSON を組み立てる | P3 |
| 同時セッション(ボード2つ、サーバー1つ) | 低 — `$D serve` ごとに別のポートが割り当てられる | P3 |
| 前回セッションの古いフィードバックファイル | 中 — 新しいポーリングループを混乱させる可能性がある | P2 |

## 改善の可能性

### 短期(このブランチ内)

1. **ポート番号をファイルに書き出す** — `serve.ts` が起動時に `serve.port` をディスクに書き出す。エージェントはいつでもこれを読める。5行程度。
2. **起動時に古いファイルを削除する** — `serve.ts` が起動前に `feedback*.json` を削除する。3行程度。
3. **ダブルクリックを防ぐ** — `handleFeedback()` の先頭で `state === 'done'` を確認する。2行程度。
4. **ファイル書き込みを try/catch で囲む** — `fs.writeFileSync` を try/catch で囲み、失敗時は 500 を返す。5行程度。

### 中期(フォローアップ)

5. **ポーリングの代わりに WebSocket を使う** — `setInterval` + `GET /api/progress` を WebSocket 接続に置き換える。新しい HTML の準備ができたら、ボードが即座に通知を受け取れる。ポーリングのずれとバックグラウンドタブのスロットリングを解消できる。`serve.ts` で約50行、`compare.ts` で約20行。

6. **エージェント用のポートファイル** — `{"port": 54321, "pid": 12345, "html": "/path/board.html"}` を `$_DESIGN_DIR/serve.json` に書き出す。エージェントは stderr を解析する代わりにこれを読む。コンテキストが失われても、システムがより頑健になる。

7. **フィードバックのスキーマ検証** — 書き込みの前に POST のボディを JSON スキーマで検証する。不正な形式のフィードバックを早期に検出し、後続処理でエージェントが混乱するのを防ぐ。

### 長期(設計の方向性)

8. **常駐のデザインサーバー** — セッションごとに `$D serve` を起動する代わりに、長時間動作するデザインデーモン(browse デーモンのようなもの)を動かす。複数のボードが1つのサーバーを共有し、コールドスタートがなくなる。ただしデーモンのライフサイクル管理という複雑さが増す。

9. **リアルタイムの共同作業** — 2つのエージェント(または1つのエージェントと1人の人間)が同じボードを同時に編集する。サーバーが WebSocket で状態の変更をブロードキャストする。フィードバックに対して競合解決が必要になる。
