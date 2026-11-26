---
name: Bug report
about: gstack のスキル、ヘルパー、またはセットアップ手順が壊れた、または想定外の動作をした
labels: bug
---

## 何が起きたか

<!-- 実行したスキルやコマンド、その出力、そして本来期待していた結果を書いてください。 -->

## 再現手順

1.
2.

## 準備状況レポート

gstack の doctor の出力を全文貼り付けてください。doctor はスキルを起動せず、有料の呼び出しも行わず、シークレットやファイルの内容も出力しません。お使いのインストール環境に合った行を実行してください。

```bash
# Claude Code
~/.claude/skills/gstack/bin/gstack-doctor

# Any other host: from your gstack checkout, ./setup --status ends with the
# absolute path of the doctor ("Readiness check: ..."). Run that path.
./setup --status

# The state root (where installs.tsv lists every install) for the same checkout:
./bin/gstack-paths --get GSTACK_STATE_ROOT
```

```text
(doctor output here)
```

## 環境

- ホスト(Claude Code、Codex、Cursor など)とそのバージョン:
- OS:
