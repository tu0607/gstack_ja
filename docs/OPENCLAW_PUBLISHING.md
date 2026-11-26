# ネイティブの OpenClaw スキルを ClawHub に公開する

CLAUDE.md から、トークン読み込みを減らすために原文のまま移したものです。

## ワークフロー

ネイティブの OpenClaw スキルは `openclaw/skills/gstack-openclaw-*/SKILL.md` にあります。これらは生成パイプラインで作られたものではなく、手で書かれた方法論のスキルです。どの OpenClaw ユーザーもインストールできるように、ClawHub に公開しています。

**公開:** コマンドは `clawhub publish` です(`clawhub skill publish` ではありません)。

```bash
clawhub publish openclaw/skills/gstack-openclaw-office-hours \
  --slug gstack-openclaw-office-hours --name "gstack Office Hours" \
  --version 1.0.0 --changelog "description of changes"
```

ほかのスキルも同様に繰り返します: `gstack-openclaw-ceo-review`、`gstack-openclaw-investigate`、`gstack-openclaw-retro`。更新のたびに `--version` を上げてください。

**認証:** `clawhub login`(GitHub 認証のためにブラウザが開きます)。`clawhub whoami` で確認します。

**更新:** 同じ `clawhub publish` コマンドを、より高い `--version` と `--changelog` を付けて実行します。

**確認:** `clawhub search gstack` で公開されたことを確認します。
