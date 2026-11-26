---
name: careful
version: 0.1.0
description: 破壊的なコマンドに対する安全ガードレール。 (gstack)
triggers:
  - be careful
  - warn before destructive
  - safety mode
allowed-tools:
  - Bash
  - Read
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/careful/bin/check-careful.sh\""'
          statusMessage: "破壊的なコマンドを確認しています..."
    - matcher: "PowerShell"
      hooks:
        - type: command
          command: 'bash -c "exec bash \"$HOME/.claude/skills/gstack/careful/bin/check-careful.sh\""'
          statusMessage: "破壊的なコマンドを確認しています..."
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /careful — 破壊的なコマンドのガードレール

安全モードが**有効**になりました。Bash と PowerShell のすべてのコマンドは、実行前に破壊的なパターンがないか確認されます。破壊的なコマンドが検出された場合は警告が出ます。そのうえで、実行を続けるかキャンセルするかを選べます。

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"/analytics
echo '{"skill":"careful","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> "$GSTACK_STATE_ROOT"/analytics/skill-usage.jsonl 2>/dev/null || true
```

## 保護の対象

| パターン | 例 | リスク |
|---------|---------|------|
| `rm -rf` / `rm -r` / `rm --recursive` | `rm -rf /var/data` | 再帰的な削除 |
| `DROP TABLE` / `DROP DATABASE` | `DROP TABLE users;` | データの消失 |
| `TRUNCATE` | `TRUNCATE orders;` | データの消失 |
| `git push --force` / `-f` | `git push -f origin main` | 履歴の書き換え |
| `git reset --hard` | `git reset --hard HEAD~3` | コミットされていない作業の消失 |
| `git checkout .` / `git restore .` | `git checkout .` | コミットされていない作業の消失 |
| `kubectl delete` | `kubectl delete pod` | 本番環境への影響 |
| `docker rm -f` / `docker system prune` | `docker system prune -a` | コンテナやイメージの消失 |

## PowerShell と cmd(Windows)

このフックは、Claude Code の主要な Windows シェルである PowerShell ツールに加えて、Bash から起動された `pwsh`/`powershell`/`cmd` も確認します。マッチングは大文字小文字を区別せず、コマンドの位置にあるエイリアスを対象とし、パラメータの省略形(`-r`、`-fo`)も受け付け、cmd の `^` エスケープを取り除きます。上の表のすべての行がここにも適用されます。

| パターン | 例 |
|---------|---------|
| `Remove-Item`/`rm`/`ri`/`del`/`erase`/`rd`/`rmdir` + `-Recurse` または `-Force` | `gci \| ri -r -fo` |
| cmd の `rd /s`、`rmdir /s`、`del /s`、`erase /s` | `cmd /c rd /s /q C:\proj` |
| `Format-Volume`、`Clear-Disk`、`Clear-Content`、`[IO.Directory]::Delete`、`[IO.File]::Delete` | `Clear-Disk -Number 1` |
| `-EncodedCommand`、`iex`、シェルの `Start-Process`、`& $cmd`(中身を検査できない) | `irm $url \| iex` |

**PowerShell はベストエフォートです。** 文字列マッチングでは、実行時に組み立てられるコマンドは見えません。確実に止めたい場合は、Claude Code のパーミッションの拒否ルールを追加してください。このルールは PowerShell とそのエイリアスを解析します。`.claude/settings.json` に `"deny": ["PowerShell(Remove-Item *)"]` と書きます。フックは `bash` 経由で動くため、Windows では Git Bash が必要です。

## 安全な例外

次のパターンは、警告なしで許可されます:
- `rm -rf node_modules` / `.next` / `dist` / `__pycache__` / `.cache` / `build` / `.turbo` / `coverage`

## 動作の仕組み

フックは、ツールの入力 JSON から `tool_name` とコマンドを読み取り、上のパターンと照合します。一致した場合は、`hookSpecificOutput` のペイロードを返します。その中には `permissionDecision: "ask"` と警告の理由が入ります(判定は必ず `hookSpecificOutput` の内側に入れる必要があります。トップレベルの `permissionDecision` は Claude Code が無視します)。MEDIUM の警告は、いつでも上書きして実行を続けられます。

## HIGH 段階(強制拒否)

次の 2 つの致命的なパターンは、確認ではなく**拒否**されます。`/`、`~`、`$HOME` のいずれかをそのまま対象にした `rm -r`/`-R`、そしてリポジトリの**既定のブランチ**への force-push です。対象は単純なコマンドだけです(`;`、`&&`、`||`、`|`、改行を含まないもの)。複合的な形のコマンドは MEDIUM の確認に回されます。`--force-with-lease` は HIGH になることはありません。これはベストエフォートの助言的な停止であり、ポリシーの境界ではありません。回避する方法は、自分でオプトインしたセッション限定の /careful を終了することです。

## プロジェクト固有のパターン(追加のみ)

警告ルールを追加できます。1 行に 1 つの POSIX ERE を書き、`#` によるコメントも使えます。ファイルは `~/.gstack/careful-patterns.txt`(グローバル)または `~/.gstack/projects/<slug>/careful-patterns.txt`(プロジェクトごと)です。組み込みのパターンファミリーの後に参照されるため、設定でできるのはルールの追加だけで、組み込みの警告を抑制することはできません。不正な正規表現の行はスキップされます。

無効にするには、会話を終了するか、新しい会話を始めてください。フックはセッション単位で動作します。
