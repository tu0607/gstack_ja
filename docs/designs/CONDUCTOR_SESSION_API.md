# Conductor セッションストリーミング API の提案

## 課題

Claude が CDP(gstack の `$B connect`)経由で実際のブラウザを操作しているとき、あなたは 2 つのウィンドウを見ることになります。**Conductor**(Claude の思考を見る)と **Chrome**(Claude の操作を見る)です。

gstack の Chrome 拡張機能のサイドパネルには、ブラウズの活動(すべてのコマンド、結果、エラー)が表示されます。しかし、セッションを*完全に*ミラーリングする(Claude の思考、ツール呼び出し、コードの編集)には、Conductor が会話のストリームを公開する必要があります。

## これで実現できること

gstack の Chrome 拡張機能のサイドパネルに「Session」タブを置き、次を表示します。
- Claude の思考・内容(性能のために切り詰めた表示)
- ツール呼び出しの名前とアイコン(Edit、Bash、Read など)
- コストの見積もりを添えたターンの区切り
- 会話の進行に合わせたリアルタイムの更新

ユーザーは、ブラウザでの Claude の操作と、サイドパネルでの Claude の思考を、ウィンドウを切り替えずに 1 か所で見られます。

## 提案する API

### `GET http://127.0.0.1:{PORT}/workspace/{ID}/session/stream`

Claude Code の会話を NDJSON イベントとして再送出する、Server-Sent Events のエンドポイントです。

**イベントの種類**(Claude Code の `--output-format stream-json` の形式を再利用):

```
event: assistant
data: {"type":"assistant","content":"Let me check that page...","truncated":true}

event: tool_use
data: {"type":"tool_use","name":"Bash","input":"$B snapshot","truncated_input":true}

event: tool_result
data: {"type":"tool_result","name":"Bash","output":"[snapshot output...]","truncated_output":true}

event: turn_complete
data: {"type":"turn_complete","input_tokens":1234,"output_tokens":567,"cost_usd":0.02}
```

**コンテンツの切り詰め:** ストリームでは、ツールの入力と出力を 500 文字で打ち切ります。完全なデータは Conductor の UI に残ります。サイドパネルは要約の表示であり、置き換えではありません。

### `GET http://127.0.0.1:{PORT}/api/workspaces`

アクティブなワークスペースを一覧する探索用のエンドポイントです。

```json
{
  "workspaces": [
    {
      "id": "abc123",
      "name": "gstack",
      "branch": "garrytan/chrome-extension-ctrl",
      "directory": "/Users/garry/gstack",
      "pid": 12345,
      "active": true
    }
  ]
}
```

Chrome 拡張機能は、ブラウズサーバーの git リポジトリ(`/health` のレスポンス由来)を、ワークスペースのディレクトリまたは名前と照合して、自動的にワークスペースを選びます。

## セキュリティ

- **ローカルホスト限定。** Claude Code 自身のデバッグ出力と同じ信頼モデルです。
- **認証は不要。** Conductor が認証を求める場合は、ワークスペースの一覧に Bearer トークンを含めてください。拡張機能はそれを SSE のリクエストに付けて送ります。
- **コンテンツの切り詰め**はプライバシーの機能でもあります。長いコードの出力、ファイルの内容、機密性の高いツールの結果は、Conductor の完全な UI の外に出ません。

## gstack 側(拡張機能側)で作るもの

サイドパネルの「Session」タブにはすでに骨組みがあります(現在はプレースホルダを表示)。

Conductor の API が利用可能になったら、次のとおりにします。
1. サイドパネルがポートのプローブまたは手動入力で Conductor を見つける
2. `/api/workspaces` を取得し、ブラウズサーバーのリポジトリと照合する
3. `/workspace/{id}/session/stream` に対して `EventSource` を開く
4. アシスタントのメッセージ、ツール名とアイコン、ターンの区切り、コストを描画する
5. 穏やかにフォールバックする: 「フルのセッション表示には Conductor を接続してください」

見積もりの工数: `sidepanel.js` で約 200 行。

## Conductor 側(サーバー側)で作るもの

1. ワークスペースごとに Claude Code の stream-json を再送出する SSE エンドポイント
2. アクティブなワークスペースの一覧を返す `/api/workspaces` の探索用エンドポイント
3. コンテンツの切り詰め(ツールの入力と出力に 500 文字の上限)

見積もりの工数: Conductor が、自社の UI の描画のために Claude Code のストリームをすでに内部で取得しているなら、約 100〜200 行。

## 設計上の判断

| 判断 | 選択 | 理由 |
|----------|--------|-----------|
| 転送方式 | SSE(WebSocket ではない) | 一方向、自動再接続、よりシンプル |
| 形式 | Claude の stream-json | Conductor がすでに解析している。新しいスキーマは不要 |
| 探索 | ファイルではなく HTTP エンドポイント | Chrome 拡張機能はファイルシステムを読めない |
| 認証 | なし(ローカルホスト) | ブラウズサーバー、CDP ポート、Claude Code と同じ |
| 切り詰め | 500 文字 | サイドパネルは約 300px 幅。長いコンテンツは役に立たない |
