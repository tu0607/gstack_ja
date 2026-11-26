---
name: freeze
version: 0.1.0
description: セッション中のファイル編集を特定のディレクトリに制限します。 (gstack)
triggers:
  - freeze edits to directory
  - lock editing scope
  - restrict file changes
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
hooks:
  PreToolUse:
    - matcher: "Edit"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/freeze/bin/check-freeze.sh\""'
          statusMessage: "Checking freeze boundary..."
    - matcher: "Write"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/freeze/bin/check-freeze.sh\""'
          statusMessage: "Checking freeze boundary..."
    - matcher: "NotebookEdit"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/freeze/bin/check-freeze.sh\""'
          statusMessage: "Checking freeze boundary..."
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /freeze — ディレクトリへの編集を制限する

ファイルの編集を特定のディレクトリに限定します。許可されたパスの外にあるファイルを対象とする Edit、Write、NotebookEdit の操作は、
単に警告されるのではなく、**ブロック**されます。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"freeze","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## セットアップ

編集を制限するディレクトリをユーザーに尋ねます。AskUserQuestion を使います:

- 質問: 「どのディレクトリに編集を制限しますか? このパスの外にあるファイルは、編集がブロックされます。」
- 選択肢ではなく、テキスト入力(ユーザーがパスを入力します)

ユーザーがディレクトリのパスを指定したら:

共有の状態書き込みツールを使って、ユーザーが選んだ境界を設定します。このツールは物理的な絶対パスを解決し、境界の置き換えと /investigate による境界の解除が同時に走らないようロックで順番に実行します:
```bash
bash "$HOME/.claude/skills/gstack/freeze/bin/freeze-state.sh" set "<user-provided-path>"
```

ヘルパーが成功した場合にのみ、成功を報告します。`FREEZE_BUSY` や想定外の状態の場合は、その状態を保持し、
実行中の書き込みが終わった後に、回復の確認をユーザーに求めます。状態ファイルを直接書き込んだり削除したりしてはいけません。

ユーザーに伝えます:「編集は `<path>/` に制限されました。このディレクトリの外での Edit、Write、
NotebookEdit はブロックされます。境界を変更するには、もう一度 `/freeze` を実行してください。解除するには `/unfreeze` を実行してください。」

## 仕組み

フックは、Edit/Write のツール入力 JSON から `file_path` を読み取ります。NotebookEdit(Jupyter ノートブック)の呼び出しの場合は、
`notebook_path` を読み取ります(実際の JSON を抽出する処理は /careful と共有しています。コピーは 1 つで、両方のフックから読み込まれます)。
そのうえで、パスが凍結ディレクトリから始まるかを確認します。始まらない場合は、`hookSpecificOutput` のペイロードを返し、
`permissionDecision: "deny"` で操作をブロックします(Claude Code はトップレベルの `permissionDecision` を無視するため、`hookSpecificOutput` の中に入れます)。

判定は fail-closed です。フックが解析できないツールのペイロードは、許可ではなく**拒否**されます。
失敗時に通してしまう境界は、境界とは言えないからです。どちらのパスフィールドも持たないペイロード(ファイルを扱わないツール)は許可されます。
拒否の際には、ツール名、パスのフィールド、境界、`/unfreeze` を示します。シンボリックリンクは最終コンポーネントまで解決されるため、
境界内にあるが境界外を指すシンボリックリンクは、そのリンク先に対して確認されます。

凍結の境界は、状態ファイルから明示的に削除されるまで続きます。フックスクリプトは、Edit/Write/NotebookEdit の呼び出しのたびに、それを読み込みます。
スペースを含む境界にも対応しています。

## 補足

- 凍結ディレクトリ末尾の `/` は、`/src` が `/src-old` に一致するのを防ぎます。
- 凍結が適用されるのは Edit、Write、NotebookEdit だけです。Read、Bash、PowerShell、Glob、Grep には影響しません。
- これは誤った編集を防ぐためのもので、セキュリティの境界ではありません。`sed` や `Set-Content` のような Bash または PowerShell のコマンドは、境界の外のファイルを依然として変更できます。
- 無効にするには `/unfreeze` を実行します。会話を終えたり強制終了したりしても、保存された状態は削除されません。
