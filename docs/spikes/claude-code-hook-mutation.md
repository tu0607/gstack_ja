# スパイク:plan-tune の cathedral 向けの Claude Code フックによる変更

**ステータス:** 完了(2026-05-27)
**対象の面:** D10(PreToolUse は AUQ の入力を変更できるか)、D19/Codex(matcher は MCP の variant をカバーする必要があるか)
**下流の利用者:** T3、T5、T6、T8

## このスパイクが答える問い

`AskUserQuestion` に対する PreToolUse フックは、`updatedInput` を通じて、ユーザーの回答を実際に置き換えられるか? できるなら、正確なプロトコルは何か?

## 答え

**はい。** `updatedInput` がサポートされた仕組みです。出典:https://code.claude.com/docs/en/hooks(2026-04 の参照で確認)。

## フックの stdin のスキーマ(PreToolUse + PostToolUse)

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "effort": { "level": "medium" },
  "hook_event_name": "PreToolUse",
  "tool_name": "AskUserQuestion",
  "tool_input": { /* tool-specific */ },
  "tool_use_id": "unique-id-12345"
}
```

サブエージェントの文脈では、任意で `agent_id`、`agent_type` がつきます。

## `allow + updatedInput` の PreToolUse フックの stdout スキーマ

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "auto-decided by plan-tune preference",
    "updatedInput": { /* shallow-merged into original tool_input */ },
    "additionalContext": "optional context for Claude"
  }
}
```

**permissionDecision の値:**
- `"allow"`:進める。必要に応じて `updatedInput` を付ける
- `"deny"`:ブロックする(Claude へのフィードバック。D 接頭辞の決定における Codex の訂正により、合成された回答ではない)
- `"ask"`:ユーザーにエスカレーションする
- `"defer"`:外部からの再開のために、ツール呼び出しを一時停止する(Claude Code v2.1.89 以降。ヘッドレスの機能。`-p --resume` で再開して再評価する)。「判断なし」の意味で決して出力しないこと。対話型のセッションでは、一時停止したツール呼び出しを再開するものがなく、ツールは「Tool result missing due to internal error」で失敗します(#2035、#2006)。判断を保留するには、終了コード 0 で stdout を空にします(`additionalContext` だけを含む `hookSpecificOutput` は任意で、`permissionDecision` は含めません)。

**`updatedInput` の意味:** 返されたオブジェクトに含まれるフィールドを、元の `tool_input` に浅くマージします。`permissionDecision: "allow"` のときだけ有効です。これにより、`never-ask` の設定に対して、自動で決めた回答を代入できます。

## matcher のスキーマ

`~/.claude/settings.json` の `matcher` フィールドは、**正規表現のメタ文字を含む場合**に、JS の正規表現の構文をサポートします。文字とアンダースコアだけの matcher は、完全一致です。

ネイティブ版と MCP 版の両方の `AskUserQuestion` をカバーするには、次のようにします。
```json
"matcher": "(AskUserQuestion|mcp__.*__AskUserQuestion)"
```

Conductor はネイティブの `AskUserQuestion` を `--disallowedTools` で無効にし、`mcp__conductor__AskUserQuestion` を経由させます。そこでフックが発火するには、MCP のサフィックスが必要です。

## 複数フックの並行処理の注意点

> 一致するすべてのフックは並行に実行され、同一のハンドラーは自動的に重複排除されます。

**この用途では:**
- gstack は、AUQ に該当するツール名に対して、PreToolUse と PostToolUse のフックをそれぞれ 1 つだけ登録します。
- ユーザー自身のフックが AskUserQuestion で `updatedInput` を返す場合、マージの順序は未定義です。
- 対策:`bin/gstack-settings-hook` のインストールの案内に、この制約を記載します。ユーザーは、受け入れる前に差分のプレビューで競合を見つけられます。

**`permissionDecision` の優先順位(複数のフックが判断する場合):** `deny > ask > allow > defer`。最も制限的なものが勝ちます。

## 実装の hookSpecificOutput の例

**自動判断(PreToolUse、`never-ask` の設定かつ一方向ではない場合):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "plan-tune: never-ask preference on ship-test-failure-triage",
    "updatedInput": {
      "questions": [{ /* same as input, but with auto-selected answer */ }]
    }
  }
}
```

**素通し(設定がない場合、または一方向の安全上の上書きの場合):** 終了コード 0 で stdout を空にします。注入する文脈(plan-tune のメモリの断片)がある場合は、`permissionDecision` を付けずに `additionalContext` を出力します。
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "additionalContext": "[plan-tune memory] Past answers suggest: ..."
  }
}
```
(履歴の注記:この例は当初 `permissionDecision: "defer"` を出力していました。CC v2.1.89 で `defer` に一時停止して再開するという意味が与えられた後、すべての AskUserQuestion が壊れました(#2035)。)

**PostToolUse での捕捉(常に):**
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse"
  }
}
```
(PostToolUse フックは、ツールの結果に追記するために `additionalContext` を設定することもできます。v1 の捕捉では必要ありません。)

## ツールエラー時の PostToolUse(AUQ 失敗時のフォールバック、OV3:B)— 未検証

AUQ 失敗時の散文によるフォールバックには、防御的な PostToolUse フック(`hosts/claude/hooks/auq-error-fallback-hook.ts`)が加わります。AskUserQuestion の呼び出しがエラーを返したり、結果が欠けていたりすると、`additionalContext` を注入して、`SESSION_KIND` に応じた散文のフォールバックを実行するようモデルに思い出させます。これは上記で文書化された `additionalContext` の仕組みを使います。

**ハーネスで確定できなかった未解決の問い:** MCP ツールの呼び出しがトランスポートや結果の欠落のエラーを返したとき(Conductor のバグでは `[Tool result missing due to internal error]` が表示されます)、Claude Code は PostToolUse フックを呼び出すか? 上記のドキュメントは、*成功時*の PostToolUse を扱っています。Conductor の内部の MCP の失敗を、オンデマンドで再現して観測することはできませんでした。

**決定(OV3:B = A):** フックは、それでも防御的に作ります。
- **成功時には作用しない**(`isErrorResponse(tool_response)` が真のときだけ発火します)。また、プラットフォームがエラーの経路で呼び出さない場合にも作用しません。
- 散文レベルのフォールバックが、どのみちその場合をカバーします(`generate-ask-user-format.ts`)。フックは、主たる仕組みではなく、信頼性の*層*です。
- その判断ロジックは、決定的に単体テストされます(`test/auq-error-fallback-hook.test.ts`)。合成されたエラーの `tool_response` と各 `SESSION_KIND` が与えられると、正しい指示を出します。実際の回答が与えられると、保留します。

**推奨する手動または部分的なスパイク(後で隙間を埋めるため):** 呼び出されたらログを出す使い捨ての PostToolUse フックを登録します。そのうえで、(a) 通常のツールエラーを発生させ(例:失敗する `Bash` の呼び出し)、PostToolUse がツールのエラーで発火するかを確認し、(b) Conductor の MCP の AUQ の失敗を再現して、ログを確認します。(b) で発火が確認されたら、フックを「防御的で作用しない」から「検証済み」に昇格させます。それまでは、ランタイムの層はベストエフォートとして扱い、散文によるフォールバックを保証された経路とみなします。

## T8 フックのインストーラー向けの settings.json のスニペット

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "(AskUserQuestion|mcp__.*__AskUserQuestion)",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/skills/gstack/hosts/claude/hooks/question-preference-hook",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "(AskUserQuestion|mcp__.*__AskUserQuestion)",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/skills/gstack/hosts/claude/hooks/question-log-hook",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

フックのコマンドは、内部では `bun` を呼び出して実行します。Claude Code のフックの実行機構では、絶対パス(または `$CLAUDE_PROJECT_DIR` の置換)が必要です。フック本体は TypeScript のファイルで、bash のラッパーが bun に渡します。

## 実装時に決めることにした未解決の問い

1. **推奨の選択肢の解析の範囲。** D2 では、まず `(recommended)` のラベルを解析すると定めています。ラベルは、AskUserQuestion の形式に従い、選択肢の `label` フィールドにあります。実装では、`tool_input.questions[*].options[*]` を走査して、ラベルのサフィックスを探す必要があります。実例:ship/SKILL.md.tmpl は `"A) Fix now"`(recommended)のような選択肢を出力します。

2. **自動判断のイベントのタグ付け。** フックが `updatedInput` を返すと、PostToolUse フックは解決された入力を見て、通常のイベントを記録します。PostToolUse のペイロードに、追加のフィールド(例:`was_auto_decided: true`)が必要です。フックはセッションの状態の追跡を通じてそれを設定できます。PreToolUse で `~/.gstack/sessions/<id>/.auto-decided-<tool_use_id>` というマーカーファイルを書き、PostToolUse でそれを読み、読んだら削除します。

3. **タイムアウトの振る舞い。** フックの既定のタイムアウトは 60 秒ですが、タイムアウトしたときに何が起きるかについて、ドキュメントは乏しいです。フックの誤動作でユーザーが 5 秒を超えて待つことがないよう、明示的に `timeout: 5` を設定します。タイムアウト時は素通しにフォールバックします。

## 参考

- https://code.claude.com/docs/en/hooks(正規の情報源。2026-04 時点の最新)
- WebSearch の結果(2026-05-27)
- 既存の `bin/gstack-settings-hook`(SessionStart のみの実装。T3 のスキーマを意識した書き直しで置き換えられる予定)
