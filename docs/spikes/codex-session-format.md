# スパイク: plan-tune cathedral 向け Codex セッション保存形式

**Status:** 完了 (2026-05-27)
**対象:** D5 (Codex インポートは正規表現ではなく構造化ファイルを解析する)
**下流の利用先:** T9 (gstack-codex-session-import)

## このスパイクで答える問い

Codex セッションのディスク上の実際の形式はどうなっているか。また `gstack-codex-session-import` のために、そこから AskUserQuestion 形式のイベントをどう取り出せばよいか。

## 保存レイアウト

```
~/.codex/
├── auth.json                     # Codex auth (do not touch)
├── config.toml                   # User config
├── goals_1.sqlite                # ~24KB, internal goals DB (not relevant)
├── logs_2.sqlite                 # ~16MB, structured logs (target=*, see schema)
├── history.jsonl                 # ~9KB, command history
└── sessions/
    └── 2026/05/27/
        └── rollout-<iso8601>-<uuid>.jsonl   # per-session transcript
```

セッションファイルは、`codex exec` または対話セッション 1 回につき JSONL が 1 つ作られます。作業ディレクトリのパスは `session_meta` イベントに埋め込まれ、CLI のバージョンも記録されます。

## セッション JSONL のイベント種別 (Garry のマシンで計測, 2026-05-27)

| type           | count | meaning |
|----------------|------:|---------|
| `response_item`|   382 | モデルの応答ストリーム (約 76%) |
| `event_msg`    |    97 | 高レベルのセッションイベント (約 19%) |
| `turn_context` |     6 | ターンごとのコンテキストのスナップショット |
| `session_meta` |     6 | セッションのヘッダ (セッションごとに 1 つ) |

### response_item のサブタイプ

| subtype                  | count | meaning |
|--------------------------|------:|---------|
| `function_call`          | 148   | モデルがツールを呼び出した |
| `function_call_output`   | 148   | ツールの結果がモデルに返された |
| `reasoning`              |  44   | 推論の要約 |
| `message`                |  40   | テキストメッセージ (input_text または output_text) |
| `web_search_call`        |   2   | Web 検索ツールの呼び出し |

### event_msg のサブタイプ

| subtype           | count | meaning |
|-------------------|------:|---------|
| `token_count`     | 55    | ステップごとのトークン計上 |
| `agent_message`   | 22    | エージェントの文章による出力 |
| `user_message`    |  6    | ユーザーの文章による入力 |
| `task_started`    |  6    | タスクの開始 (トップレベルのタスクごとに 1 つ) |
| `task_complete`   |  6    | タスクの完了 |
| `web_search_end`  |  2    | Web 検索の完了 |

## 重要な発見: Codex には `AskUserQuestion` ツールがない

Codex では、`response_item` ストリームに AskUserQuestion がツール呼び出しとして現れません。Codex 上で動く gstack のスキルは、AskUserQuestion 形式の Decision Brief を `agent_message` イベント内にプレーンな文章として出力します (プリアンブルの `AskUserQuestion Format`)。ユーザーの回答は次の `user_message` で返ってきます。

そのため、Codex セッションから AUQ イベントを取り込む処理は、Claude Code の場合とは構造的に異なります。

- **Claude Code:** フックが `AskUserQuestion` の構造化された `tool_input`/`tool_output` を取得します。質問、選択肢、回答がそれぞれ分かれています。
- **Codex:** パーサーは `agent_message.text` の本文から抽出し、D 番号付きの Decision Brief パターンを検出したうえで、後続の `user_message` と突き合わせて回答を得る必要があります。

## `gstack-codex-session-import` の復元戦略

**2 段階の抽出:**

1. **マーカー優先 (D18 の仕組み)。** `agent_message` のテキストから `<gstack-qid:foo-bar>` マーカーを検索します。見つかれば正確な question_id が得られ、確実に復元できます。(T14 で上位 10 件のレジストリ質問にマーカーを追加し、Codex がホスト対応のプリアンブル経路でそれを出力するようになれば機能します。)

2. **パターンによるフォールバック。** マーカーがない場合は、次のものを解析します。
   - `D<N> — <title>` の行 (AskUserQuestion Format の D 番号)
   - `Recommendation: ...` の行
   - `A) ...`、`B) ...` などの選択肢ブロック
   - 次の `user_message` イベントで選ばれた選択肢のラベル

   このフォールバックは、ハッシュベースの question_id を作るためだけに使います (Layer 1 が Claude 上で使うのと同じ `hook-<sha1(skill+text+sorted_options)[:10]>` の形式)。`source: "codex-pattern-fallback"` のタグを付け、D18 のハッシュのずれに関する指針に従って、設定の参照キーとしては決して使いません。

## question-log.jsonl へ書き込むスキーマ (Codex インポート)

既存の `bin/gstack-question-log` のスキーマに次を加えます。
- `source: "codex-import-marker"` (qid マーカーが見つかったとき)
- `source: "codex-import-pattern"` (フォールバックの正規表現を使ったとき)
- `codex_session_id` (session_meta の UUID)
- `codex_cwd` (session_meta の作業ディレクトリ。プロジェクトを区別するために使う)
- `codex_ts` (イベントのタイムスタンプ)

## sqlite の logs_2.sqlite スキーマ

```sql
CREATE TABLE logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  ts_nanos INTEGER NOT NULL,
  level TEXT NOT NULL,
  target TEXT NOT NULL,
  feedback_log_body TEXT,
  module_path TEXT,
  file TEXT,
  line INTEGER,
  thread_id TEXT,
  process_uuid TEXT,
  estimated_bytes INTEGER NOT NULL DEFAULT 0
);
```

`logs_2.sqlite` は内部のテレメトリであり、セッションの内容ではありません。**AUQ の抽出には使わないでください。** 正本はセッションの JSONL です。

## プロジェクトスラッグの導出

`session_meta.payload.cwd` から、既存の `bin/gstack-slug` のロジックを使って導出します。Conductor の worktree には、cwd に埋め込まれた独自のスラッグ命名規則があります。この処理はすでにバイナリ側で扱われています。

## バージョンの安全性

`session_meta.payload.cli_version` には Codex CLI のバージョン (例: `0.130.0`) が記録されます。インポーターが未知のバージョンに出会った場合は、stderr に警告を出しつつ処理を続けます。JSONL では、スキーマの追加は通常、後方互換になるためです。

将来のバージョンで `type` や `payload.type` の値が変わった場合、インポーターの監査ログでは `unknown` として現れます。インポーターに保護付きの `KNOWN_VERSIONS = ["0.130.x", "0.131.x", ...]` 定数を追加し、再テストするときに明示的に更新してください。

## 実装に向けた未解決の問い

1. **Codex はユーザーの回答を正確にどこへ保存するのか。** 実際の `codex exec` を実行して Decision Brief を発生させ、その次のイベントを調べて確認する必要があります。おそらく `event_msg` のサブタイプ `user_message`、または `role: "user"` を持つ `response_item` のサブタイプ `message` です。T9 の実装中に確認してください。

2. **「Other」の自由記述の抽出。** Decision Brief の文章は、「Other」の回答と名前付きの選択肢を構造的に区別していません。パターンによるフォールバックでは、回答の中の「Other: <text>」という言い回しを検出する必要があります。T10 (dream cycle の蒸留) がこれを使うのは source が `codex-import-marker` の場合に限られます。そのためデータを信頼できます。

3. **Conductor の cwd の扱い。** Conductor の worktree はプロジェクトの状態を共有しますが、cwd は別々です。インポートでは cwd そのものではなく、プロジェクトのスラッグ単位でイベントをまとめるべきです。そうすれば、兄弟の worktree のイベントが同じプロジェクトのビューに集まります。

## 参考

- `~/.codex/sessions/2026/05/*/` の実地調査
- `sqlite3 ~/.codex/logs_2.sqlite ".schema"` (2026-05-27)
- Codex CLI 0.130.0 (スパイク時点の最新版)
- 関連: plan ファイル内の D5 (クロスモデルの緊張関係) に関する決定
