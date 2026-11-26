---
name: guard
version: 0.1.0
description: "完全な安全モード: 破壊的なコマンドの警告と、ディレクトリ単位の編集制限を組み合わせます。 (gstack)"
triggers:
  - full safety mode
  - guard against mistakes
  - maximum safety
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/careful/bin/check-careful.sh\""'
          statusMessage: "Checking for destructive commands..."
    - matcher: "PowerShell"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/careful/bin/check-careful.sh\""'
          statusMessage: "Checking for destructive commands..."
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

# /guard — 完全な安全モード

破壊的なコマンドの警告と、ディレクトリ単位の編集制限の両方を有効にします。
これは `/careful` と `/freeze` を 1 つのコマンドにまとめたものです。

**依存関係の注意:** このスキルは、兄弟にあたる `/careful` と `/freeze` のスキルディレクトリにあるフックスクリプトを参照します。
両方がインストールされている必要があります(gstack のセットアップスクリプトによって一緒にインストールされます)。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"guard","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## セットアップ

編集を制限するディレクトリをユーザーに尋ねます。AskUserQuestion を使います:

- 質問: 「Guard mode: 編集を制限するディレクトリはどこにしますか? 破壊的なコマンドの警告は常に有効です。選んだパスの外にあるファイルは、編集がブロックされます。」
- 選択肢ではなく、テキスト入力(ユーザーがパスを入力します)

ユーザーがディレクトリのパスを指定したら:

共有の書き込みツールを使って、ユーザーが選んだ境界を設定します。このツールは物理的な絶対パスを解決し、置き換えと調査のクリーンアップを順番に実行します:
```bash
bash "$HOME/.claude/skills/gstack/freeze/bin/freeze-state.sh" set "<user-provided-path>"
```

ヘルパーが失敗した場合は、境界が有効になったと主張してはいけません。状態を保持し、回復の手順を報告します。
直接の書き込みや削除で共有の書き込みツールを迂回してはいけません。

ユーザーに伝えます:
- 「**Guard mode active.** 2 つの保護が動いています:」
- 「1. **破壊的なコマンドのガード** — rm -rf、DROP TABLE、force-push などは、実行前に警告します(上書き可能)。壊滅的な形のもの(/ や ~ の再帰的な削除、デフォルトブランチへの force-push)は、無条件に拒否されます」
- 「2. **編集の境界** — ファイルの編集は `<path>/` に制限されます。このディレクトリの外の編集はブロックされます。」
- 「永続的な編集の境界を削除するには、`/unfreeze` を実行してください。セッションを終えるとフックは止まりますが、境界は削除されません。」

## 保護の対象

破壊的なコマンドのパターンと安全な例外の全体一覧は、`/careful` を参照してください。
編集の境界がどのように機能するかは、`/freeze` を参照してください。
