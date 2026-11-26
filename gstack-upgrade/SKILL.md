---
name: gstack-upgrade
version: 1.1.0
description: gstack を最新バージョンにアップグレードします。
triggers:
  - upgrade gstack
  - update gstack version
  - get latest gstack
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

# /gstack-upgrade

gstack を最新バージョンにアップグレードし、新しい内容を表示します。

## インラインのアップグレードの流れ

このセクションは、すべてのスキルの preamble が `UPGRADE_AVAILABLE` を検出したときに参照されます。

### Step 1: ユーザーに確認する(または自動でアップグレードする)

まず、自動アップグレードが有効かを確認します:
```bash
_AUTO=""
[ "${GSTACK_AUTO_UPGRADE:-}" = "1" ] && _AUTO="true"
[ -z "$_AUTO" ] && _AUTO=$(~/.claude/skills/gstack/bin/gstack-config get auto_upgrade 2>/dev/null || true)
echo "AUTO_UPGRADE=$_AUTO"
```

**`AUTO_UPGRADE=true` または `AUTO_UPGRADE=1` の場合:** AskUserQuestion はスキップします。「gstack v{old} → v{new} を自動でアップグレード中...」と記録し、直接 Step 2 に進みます。
セットアップが失敗した場合は、Step 4 のインストール形式ごとの回復手順に従います。ベンダリングされたインストールはバックアップを復元します。git のインストールは、
アップグレード前のコミットを記録したうえで停止し、破壊的なリセットは行いません。復元されたと実際に確認できた場合にのみ、復元されたと主張します。

**それ以外の場合**は、AskUserQuestion を使います:
- 質問: 「gstack **v{new}** が利用可能です(現在は v{old})。今すぐアップグレードしますか?」
  4 つのフィールドの場合(`UPGRADE_AVAILABLE <old> <old>+<n> <sha>`、main が進んでいる): 「gstack の main は v{old} より **{n} コミット**先にあります(sha は {sha})。今すぐアップグレードしますか?」
- 選択肢: ["Yes, upgrade now", "Always keep me up to date", "Not now", "Never ask again"]

**「Yes, upgrade now」の場合:** Step 2 に進みます。

**「Always keep me up to date」の場合:**
```bash
~/.claude/skills/gstack/bin/gstack-config set auto_upgrade true
```
ユーザーに伝えます:「自動アップグレードを有効にしました。今後のアップデートは自動でインストールされます。」そのうえで Step 2 に進みます。

**「Not now」の場合:** 段階的に長くなるスヌーズの状態を書き込みます(1 回目は 24 時間、2 回目は 48 時間、3 回目以降は 1 週間)。その後、現在のスキルを続けます。
アップグレードについて再度触れてはいけません。
```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
_SNOOZE_FILE="$GSTACK_STATE_ROOT/update-snoozed"
_REMOTE_VER="{new}"
_CUR_LEVEL=0
if [ -f "$_SNOOZE_FILE" ]; then
  _SNOOZED_VER=$(awk '{print $(1)}' "$_SNOOZE_FILE")
  if [ "$_SNOOZED_VER" = "$_REMOTE_VER" ]; then
    _CUR_LEVEL=$(awk '{print $(2)}' "$_SNOOZE_FILE")
    case "$_CUR_LEVEL" in *[!0-9]*) _CUR_LEVEL=0 ;; esac
  fi
fi
_NEW_LEVEL=$((_CUR_LEVEL + 1))
[ "$_NEW_LEVEL" -gt 3 ] && _NEW_LEVEL=3
echo "$_REMOTE_VER $_NEW_LEVEL $(date +%s)" > "$_SNOOZE_FILE"
```
補足: `{new}` は `UPGRADE_AVAILABLE` の出力にあるリモートのバージョンです。更新チェックの結果から置き換えてください。4 つのフィールドの行の場合は、4 番目のフィールドの SHA を `{new}` として使います。そうすると、main が動いたときにスヌーズが終わります。

ユーザーにスヌーズの期間を伝えます:「次の通知は 24 時間後です」(レベルに応じて 48 時間や 1 週間)。ヒント:「自動アップグレードには、`~/.gstack/config.yaml` で `auto_upgrade: true` を設定してください。」

**「Never ask again」の場合:**
```bash
~/.claude/skills/gstack/bin/gstack-config set update_check false
```
ユーザーに伝えます:「更新チェックを無効にしました。再度有効にするには `~/.claude/skills/gstack/bin/gstack-config set update_check true` を実行してください。」
現在のスキルを続けます。

### Step 2: インストールの形式を検出する

```bash
if [ -d "$HOME/.claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.claude/skills/gstack"
elif [ -d "$HOME/.gstack/repos/gstack/.git" ]; then
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$HOME/.gstack/repos/gstack"
elif [ -d ".claude/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR=".claude/skills/gstack"
elif [ -d ".agents/skills/gstack/.git" ]; then
  INSTALL_TYPE="local-git"
  INSTALL_DIR=".agents/skills/gstack"
elif [ -d ".claude/skills/gstack" ]; then
  INSTALL_TYPE="vendored"
  INSTALL_DIR=".claude/skills/gstack"
elif [ -d "$HOME/.claude/skills/gstack" ]; then
  INSTALL_TYPE="vendored-global"
  INSTALL_DIR="$HOME/.claude/skills/gstack"
elif _SRC=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT 2>/dev/null) && _SRC=$(awk -F '\t' '$(1) == "claude" && $(6) != "-" { print $(6); exit }' "$_SRC/installs.tsv" 2>/dev/null) && [ -d "$_SRC/.git" ]; then
  # The install registry names the checkout setup activated for this host (e.g. a ~/gstack clone).
  INSTALL_TYPE="global-git"
  INSTALL_DIR="$_SRC"
else
  echo "ERROR: gstack not found"
  exit 1
fi
INSTALL_DIR=$(cd -- "$INSTALL_DIR" && pwd -P) || { echo "ERROR: cannot enter the gstack install directory" >&2; exit 1; }
echo "Install type: $INSTALL_TYPE at $INSTALL_DIR"
```

上で出力されたインストールの形式と絶対ディレクトリは、以降のすべてのステップで使います。
`INSTALL_TYPE`、`INSTALL_DIR`、`OLD_VERSION`、後で得る `NEW_VERSION` は、明示的に引き継いでください。ツールの呼び出しは新しいシェルで実行されることがあるため、
後続の各ブロックは、取得した出力から値を代入して始めます(例: `INSTALL_DIR=/abs/path/printed/above`)。前の呼び出しの作業ディレクトリやシェル変数に頼ってはいけません。
ファイルを変更するすべてのブロックは、最初に `INSTALL_DIR` を確認します。未設定、空、存在しない、読めない、または gstack 自身のチェックアウトではない場合は、
git のコマンドを実行する前に停止します。

### Step 3: 古いバージョンを保存する

Step 2 の出力にあるインストールディレクトリを使います:

```bash
OLD_VERSION=$(cat "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}/VERSION" 2>/dev/null || echo "unknown")
echo "OLD_VERSION=$OLD_VERSION"
```

### Step 4: アップグレード

Step 2 で検出したインストールの形式とディレクトリを使います:

**git のインストールの場合**(global-git、local-git):

まず fast-forward します。`bin/gstack-ff-update` を通すので、セッション中の自動アップグレードと同じコードを使います。
きれいにマージできるローカルの編集は、更新の上に乗ります。競合する編集(またはステージ済みの変更、未マージのファイル)は、
コンフリクトマーカーとして残される代わりに、rescue ref に保存されます:
```bash
cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" || exit 1
{ [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ] && _p=$(git rev-parse --show-prefix 2>/dev/null) && [ -z "$_p" ] && [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; } || { echo "ERROR: $INSTALL_DIR is not a gstack checkout; nothing was changed. Re-run Step 2." >&2; exit 1; }
git fetch origin
# Same pre-advance check as the auto-updater: the incoming release's Bun floor,
# judged by bash whatever this tool shell is (zsh does not word-split).
HOLD=$(bash -c '. bin/gstack-bun-version.sh && gstack_bun_incoming_hold . origin/main' 2>/dev/null) && { case "$HOLD" in bun-version-unreadable*) echo "BUN_VERSION_UNREADABLE: $HOLD; nothing was changed" >&2 ;; *) echo "BUN_TOO_OLD: $HOLD; nothing was changed" >&2 ;; esac; exit 1; }
PRE_UPGRADE_COMMIT=$(git rev-parse HEAD)
echo "PRE_UPGRADE_COMMIT=$PRE_UPGRADE_COMMIT"
FF=$(bash bin/gstack-ff-update . origin/main); FF_RC=$?
echo "$FF"
case "$FF_RC" in
  0) if ./setup --refresh-registered; then echo "FF_OK"; else echo "SETUP_FAILED: git update succeeded; stop and inspect setup output (previous commit: $PRE_UPGRADE_COMMIT)" >&2; exit 1; fi ;;
  4) echo "FF_REFUSED" ;;
  *) echo "FF_STOPPED: $FF" >&2; exit 1 ;;
esac
```

setup の `--refresh-registered` は、このチェックアウトが登録したすべてのインストール(各ホスト、グローバルとこのプロジェクトのもの)を更新します。
ソースを先に表示し、インストールごとに 1 行の `Upgrade summary` で終わります。各行は表示されたとおりに伝えます。`failed` の行は、そのホストが以前のインストールを保持したことを意味します。
その再試行コマンドを伝えます。全ホストが更新されたとは決して言わないでください。`skipped` の行は、別のチェックアウトまたはプロジェクトに属します。そのコマンドは伝えるだけで、実行はしません。

出力が `FF_OK` で終わっていれば、アップグレードは完了です。下のフォールバックは完全にスキップします。
その直前の行が `rescued <old> <new> refs/gstack/rescue/<oid> unmerged=<0|1>` の場合は、競合したローカルの編集がそこに保存されたことをユーザーに伝えます。
スクリプトが表示した `Inspect`、`Export`、`Delete` のコマンドを伝えます(スクラッチのチェックアウトに `git apply -3` でエクスポートします。インストールの中で `stash apply` を使ってはいけません。
`unmerged=1` は、rescue を手作業で解決する必要があることを意味します)。
`FF_STOPPED` の場合は、停止して理由を伝えます。何も変更されていません。
`ff-busy` は、別の gstack の更新が実行中であることを意味します(1 分後に再試行)。
`autostash-unrecoverable` は、邪魔になっているもの(リリースが追加する未追跡ファイル、または別の git コマンド)を示します。
`index-unreadable` は、チェックアウトのインデックスが壊れていることを意味します。
`BUN_TOO_OLD` の場合は停止します。ユーザーに `bun upgrade` を実行してから、/gstack-upgrade をもう一度実行するよう伝えます。
`BUN_VERSION_UNREADABLE` の場合は停止します。`bun --version` が gstack が読めるバージョンを出力しなかったため、`bun upgrade` も実行できないかもしれません。
ユーザーに、https://bun.sh から Bun を再インストールするよう伝えます(Git Bash または macOS/Linux のターミナルで `curl -fsSL https://bun.sh/install | bash`)。
`bun --version` が 1.4.2 のようなバージョンを出力することを確認してから、/gstack-upgrade をもう一度実行するよう伝えます(docs/troubleshooting.md#bun-version-unreadable)。
`SETUP_FAILED` の場合は停止します。ユーザーの変更は保持し、復旧用のコミットを報告します。git の経路には `.bak` はありません。setup が失敗したからといって、
divergence のフォールバックに入ってはいけません。入るのは `FF_REFUSED` の場合だけです(ローカルのコミットや分岐した履歴)。ネットワークや認証の失敗は、リセットではなく修復のために停止します。

**フォールバック(ff-only が拒否された場合 — ローカルのコミットまたは分岐)。** `git reset
--hard` は物を破壊します。きれいなツリーでも、push されていないローカルのコミットは失われます。ゲートをかけます:

1. `$INSTALL_DIR` で `git status --porcelain` と `git rev-list origin/main..HEAD --oneline` を実行します。
2. 両方が空なら、リセットは明らかに安全です。確認せずに、下のフォールバックのブロックを実行します。
3. そうでなければ AskUserQuestion で確認します(取り消しのできない破壊的な操作)。破棄される内容を正確に列挙します。
   変更されたファイルごと、push されていないコミットごとに、ハッシュと件名を示します。選択肢は次のとおりです: **A)** 破棄してアップグレードする(リセット) — 選択肢の文字を明示的に入力することが必要です。
   **B)** アップグレードを中止して、ユーザーが先に作業を救出できるようにする(ローカルのコミットがある場合に推奨)。
   曖昧な返答では決して進めません。

```bash
cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" || exit 1
{ [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ] && _p=$(git rev-parse --show-prefix 2>/dev/null) && [ -z "$_p" ] && [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; } || { echo "ERROR: $INSTALL_DIR is not a gstack checkout; nothing was changed. Re-run Step 2." >&2; exit 1; }
# Regenerable render-footprint dirt (setup re-renders it) never goes into the stash.
git checkout -- 'SKILL.md' '*/SKILL.md' '*/sections/*.md' 2>/dev/null || true
STASH_OUTPUT=$(git stash 2>&1)
git reset --hard origin/main
./setup --refresh-registered
```
`$STASH_OUTPUT` に「Saved working directory」が含まれる場合は、ユーザーに警告します:「注意: ローカルの変更はスタッシュされました(生成された SKILL.md やセクションファイルへの変更は、先に破棄されています。セットアップで再生成されます)。自分の変更を復元するには、スキルのディレクトリで `git stash pop` を実行してください。」

**ベンダリングされたインストールの場合**(vendored、vendored-global):
```bash
(cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: INSTALL_DIR=${INSTALL_DIR:-} is not a gstack install; nothing was changed. Re-run Step 2." >&2; exit 1; }
# A stale .bak from a previously crashed upgrade would make the mv below NEST
# the live install inside it and the failure-restore arm would "restore" the
# stale backup. It may also be the only good copy from that crashed run —
# abort and let the human inspect, never delete it silently.
[ -e "$INSTALL_DIR.bak" ] && { echo "ERROR: stale backup exists at $INSTALL_DIR.bak (from a previous failed upgrade?) — inspect it, salvage/remove it, then re-run." >&2; exit 1; }
TMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/gstack-upgrade.XXXXXX") || { echo "ERROR: mktemp failed — aborting upgrade (install untouched)." >&2; exit 1; }
git clone --depth 1 https://github.com/garrytan/gstack.git "$TMP_DIR/gstack" || { echo "ERROR: clone failed — aborting upgrade (install untouched)." >&2; rm -rf "$TMP_DIR"; exit 1; }
mv "$INSTALL_DIR" "$INSTALL_DIR.bak" || { rm -rf "$TMP_DIR"; exit 1; }
if mv "$TMP_DIR/gstack" "$INSTALL_DIR"; then
  if (cd "$INSTALL_DIR" && ./setup --refresh-registered); then
    rm -rf "$INSTALL_DIR.bak" "$TMP_DIR"
  else
    rm -rf "$INSTALL_DIR"
    mv "$INSTALL_DIR.bak" "$INSTALL_DIR" || { echo "ERROR: restore failed; backup retained." >&2; exit 1; }
    rm -rf "$TMP_DIR"
    echo "ERROR: setup failed; previous install restored." >&2
    exit 1
  fi
else
  mv "$INSTALL_DIR.bak" "$INSTALL_DIR"
  echo "ERROR: swap failed — previous install restored; upgrade aborted." >&2
  rm -rf "$TMP_DIR"
  exit 1
fi
```

### Step 4.5: ローカルのベンダリングされたコピーを処理する

Step 2 のインストールディレクトリを使います。同じ場所にローカルのベンダリングされたコピーがあるか、チームモードが有効かを確認します:

```bash
_RESOLVED_PRIMARY=$(cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" && pwd -P) || exit 1
_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
LOCAL_GSTACK=""
if [ -n "$_ROOT" ] && [ -d "$_ROOT/.claude/skills/gstack" ]; then
  _RESOLVED_LOCAL=$(cd "$_ROOT/.claude/skills/gstack" && pwd -P)
  if [ "$_RESOLVED_LOCAL" != "$_RESOLVED_PRIMARY" ]; then
    LOCAL_GSTACK="$_ROOT/.claude/skills/gstack"
  fi
fi
_TEAM_MODE=$(~/.claude/skills/gstack/bin/gstack-config get team_mode 2>/dev/null || echo "false")
echo "LOCAL_GSTACK=$LOCAL_GSTACK"
echo "TEAM_MODE=$_TEAM_MODE"
```

**`LOCAL_GSTACK` が空でなく、かつ `TEAM_MODE` が `true` の場合:** ベンダリングされたコピーを削除します。チームモードではグローバルインストールを唯一の情報源として使います。

```bash
(cd -- "${LOCAL_GSTACK:?LOCAL_GSTACK is not set: re-run the detection block above and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: LOCAL_GSTACK=${LOCAL_GSTACK:-} is not a gstack copy; nothing was changed." >&2; exit 1; }
_ROOT=${LOCAL_GSTACK%/.claude/skills/gstack}
{ [ "$_ROOT" != "$LOCAL_GSTACK" ] && cd -- "${_ROOT:?}" && _p=$(git rev-parse --show-prefix 2>/dev/null) && [ -z "$_p" ] && [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = true ]; } || { echo "ERROR: $LOCAL_GSTACK is not the vendored copy at the root of a git repository; nothing was changed." >&2; exit 1; }
git rm -r --cached .claude/skills/gstack/ 2>/dev/null || true
if ! grep -qF '.claude/skills/gstack/' .gitignore 2>/dev/null; then
  echo '.claude/skills/gstack/' >> .gitignore
fi
rm -rf "$LOCAL_GSTACK"
```
ユーザーに伝えます:「`$LOCAL_GSTACK` にあったベンダリングされたコピーを削除しました(チームモードが有効です。グローバルインストールが唯一の情報源です)。準備ができたら `.gitignore` の変更をコミットしてください。」

**`LOCAL_GSTACK` が空でなく、かつ `TEAM_MODE` が `true` ではない場合:** 新しくアップグレードされたプライマリのインストールからコピーして更新します(README のベンダリングされたインストールと同じ方法です):
```bash
(cd -- "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: INSTALL_DIR=${INSTALL_DIR:-} is not a gstack install; nothing was changed." >&2; exit 1; }
(cd -- "${LOCAL_GSTACK:?LOCAL_GSTACK is not set: re-run the detection block above and substitute the printed path}" && [ -f VERSION ] && [ -f setup ] && [ -f bin/gstack-config ]) || { echo "ERROR: LOCAL_GSTACK=${LOCAL_GSTACK:-} is not a gstack copy; nothing was changed." >&2; exit 1; }
[ -e "$LOCAL_GSTACK.bak" ] && { echo "ERROR: stale vendored backup; inspect it before retrying." >&2; exit 1; }
mv "$LOCAL_GSTACK" "$LOCAL_GSTACK.bak" || exit 1
if cp -Rf "$INSTALL_DIR" "$LOCAL_GSTACK" && rm -rf "$LOCAL_GSTACK/.git" && (cd "$LOCAL_GSTACK" && ./setup --refresh-registered); then
  rm -rf "$LOCAL_GSTACK.bak"
  echo "LOCAL_SYNC_OK"
else
  rm -rf "$LOCAL_GSTACK"
  mv "$LOCAL_GSTACK.bak" "$LOCAL_GSTACK" || { echo "ERROR: restore failed; backup retained." >&2; exit 1; }
  echo "ERROR: sync failed; previous vendored copy restored." >&2
  exit 1
fi
```
`LOCAL_SYNC_OK` が出た場合にのみ、ユーザーに伝えます:「`$LOCAL_GSTACK` にあるベンダリングされたコピーも更新しました。準備ができたら `.claude/skills/gstack/` をコミットしてください。」
それ以外の場合は停止し、回復の結果を報告します。マイグレーションを続けたり、成功を宣言したりしてはいけません。

### Step 4.75: バージョン間のマイグレーションを実行する

`./setup` が完了した後、古いバージョンと新しいバージョンの間にあるマイグレーションスクリプトを実行します。
マイグレーションは、`./setup` だけではカバーできない状態の修正(古い設定、孤立したファイル、ディレクトリ構造の変更)を扱います。

```bash
MIGRATIONS_DIR="${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}/gstack-upgrade/migrations"
: "${OLD_VERSION:?OLD_VERSION is not set: substitute the value Step 3 printed}"
if [ -d "$MIGRATIONS_DIR" ]; then
  for migration in $(find "$MIGRATIONS_DIR" -maxdepth 1 -name 'v*.sh' -type f 2>/dev/null | sort -V); do
    # Extract version from filename: v0.15.2.0.sh → 0.15.2.0
    m_ver="$(basename "$migration" .sh | sed 's/^v//')"
    # Run if this migration version is newer than old version
    # (simple string compare works for dotted versions with same segment count)
    if [ "$OLD_VERSION" != "unknown" ] && [ "$(printf '%s\n%s' "$OLD_VERSION" "$m_ver" | sort -V | head -1)" = "$OLD_VERSION" ] && [ "$OLD_VERSION" != "$m_ver" ]; then
      echo "Running migration $m_ver..."
      # GSTACK_INSTALL_DIR: migrations that clean the INSTALL (not just
      # ~/.gstack state) default to ~/.claude/skills/gstack when unset —
      # a repo-local install would silently no-op without this.
      GSTACK_INSTALL_DIR="$INSTALL_DIR" bash "$migration" || echo "  Warning: migration $m_ver had errors (non-fatal)"
    fi
  done
fi
```

マイグレーションは、`gstack-upgrade/migrations/` にある冪等な bash スクリプトです。各ファイルは `v{VERSION}.sh` という名前で、古いバージョンからアップグレードする場合にのみ実行されます。
新しいマイグレーションの追加方法は CONTRIBUTING.md を参照してください。

### Step 4.8: 古いデーモンを停止する(無条件)

アップグレード前に起動した browse デーモンは、停止されるまで古いバイナリのコードを提供し続けます。
実行中のプロセスが古い実行ファイルを保持しているため、`git reset --hard` や `./setup` の後も残ります。
このステップは必ず実行し、Step 2 で検出したインストールディレクトリを使います。

```bash
INSTALL_DIR_PLACEHOLDER="<install dir from Step 2>"
NEW_HASH=$(cat "$INSTALL_DIR_PLACEHOLDER/browse/dist/.version" 2>/dev/null || echo "")
_STATE_FILE="${BROWSE_STATE_FILE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/browse.json}"
if [ -z "$NEW_HASH" ] || [ ! -f "$_STATE_FILE" ]; then
  echo "DAEMON_CHECK=none (no state file or no fresh build hash)"
else
  DAEMON_PID=$(sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$_STATE_FILE" | head -1)
  DAEMON_PORT=$(sed -n 's/.*"port"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$_STATE_FILE" | head -1)
  OLD_HASH=$(sed -n 's/.*"binaryVersion"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$_STATE_FILE" | head -1)
  if [ -z "$DAEMON_PID" ] || ! kill -0 "$DAEMON_PID" 2>/dev/null; then
    echo "DAEMON_CHECK=dead (no live daemon to stop)"
  elif [ "$OLD_HASH" = "$NEW_HASH" ]; then
    echo "DAEMON_CHECK=current (daemon already runs the new binary)"
  elif curl -fsS --max-time 2 "http://127.0.0.1:$DAEMON_PORT/health" 2>/dev/null | grep -q '"status":"healthy"'; then
    echo "DAEMON_CHECK=stale-responsive pid=$DAEMON_PID hash=${OLD_HASH:-unknown} -> $NEW_HASH"
    "$INSTALL_DIR_PLACEHOLDER/browse/dist/browse" stop && echo "DAEMON_STOPPED=yes"
  else
    echo "DAEMON_CHECK=stale-busy pid=$DAEMON_PID hash=${OLD_HASH:-unknown} -> $NEW_HASH"
  fi
fi
```

実行する前に、`<install dir from Step 2>` を実際のインストールディレクトリに置き換えます。`DAEMON_CHECK` の結果は次のように解釈します:

1. **`stale-responsive` かつ `DAEMON_STOPPED=yes`:** ユーザーに伝えます:「古い browse デーモンを停止しました(バイナリ {OLD_HASH} → {NEW_HASH})。次の browse コマンドで、新しいバイナリを使ったデーモンが起動します。」
2. **`stale-busy`:** デーモンは古いバイナリを実行していますが、作業の途中です。作業を優先して待ち、アップグレード中に作業中のデーモンを決して止めてはいけません。ユーザーに伝えます:「アップグレード前のバイナリ({OLD_HASH} → {NEW_HASH})を実行している browse デーモンがまだ動いていますが、現在作業中です。作業が終わったら `browse stop` で停止してください。または `browse --force-restart stop` で直ちに強制的に再起動できます(そのセッションのタブ、Cookie、ログインは失われます)。」
3. **`none` / `dead` / `current`:** 何もする必要はありません。何も言わないでください。

### Step 5: マーカーの書き込みとキャッシュの削除

```bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
mkdir -p "$GSTACK_STATE_ROOT"
echo "$OLD_VERSION" > "$GSTACK_STATE_ROOT"/just-upgraded-from
rm -f "$GSTACK_STATE_ROOT"/last-update-check
rm -f "$GSTACK_STATE_ROOT"/update-snoozed
```

### Step 6: 新しい内容を表示する

`$INSTALL_DIR/CHANGELOG.md` を読みます。古いバージョンと新しいバージョンの間にあるすべてのバージョンのエントリを探します。テーマごとに分けて、5〜7 個の箇条書きにまとめます。詰め込みすぎないこと。利用者に見える変更に絞ります。重要でない内部のリファクタリングは省きます。

4 つのフィールドの場合: `git -C "$INSTALL_DIR" log --oneline <PRE_UPGRADE_COMMIT>..HEAD` を要約し(7 個以内の箇条書き)、「gstack v{old}、main は {sha} にあります」として示します。

形式:
```
gstack v{new} — upgraded from v{old}!

What's new:
- [bullet 1]
- [bullet 2]
- ...

Happy shipping!
```

### Step 7: 続行する

What's New を表示した後、ユーザーが最初に呼び出したスキルを続けます。アップグレードは完了しています。これ以上の操作は不要です。

---

## 単独での使い方

`/gstack-upgrade` を直接呼び出した場合(preamble からではない場合):

1. 新しく更新を確認します(キャッシュを無視):
```bash
~/.claude/skills/gstack/bin/gstack-update-check --force 2>/dev/null || \
.claude/skills/gstack/bin/gstack-update-check --force 2>/dev/null || true
```
出力を使って、アップグレードが利用可能かを判断します。

2. `UPGRADE_AVAILABLE`(3 つまたは 4 つのフィールド)の場合: 上の Step 2〜6 に従います。

   `CHECK_FAILED ...` の場合: リモートのバージョンを読めなかったため、更新の状態は不明です。その行を表示します(失敗した URL が示されています)。チェックが失敗したとユーザーに伝えます。
   「すでに最新バージョンです」と報告してはいけません。停止します。

3. 出力がない場合(プライマリは最新): 古いローカルのベンダリングされたコピーがないかを確認します。

上の Step 2 の bash ブロックを実行して、プライマリのインストールの形式とディレクトリ(`INSTALL_TYPE` と `INSTALL_DIR`)を検出します。そのうえで、上の Step 4.5 の検出ブロックを実行して、
ローカルのベンダリングされたコピー(`LOCAL_GSTACK`)とチームモードの状態(`TEAM_MODE`)を確認します。

**`LOCAL_GSTACK` が空の場合**(ローカルのベンダリングされたコピーがない): ユーザーに伝えます:「すでに最新バージョン(v{version})です。」

**`LOCAL_GSTACK` が空でなく、かつ `TEAM_MODE` が `true` の場合:** 上の Step 4.5 のチームモードの削除ブロックを使って、ベンダリングされたコピーを削除します。ユーザーに伝えます:「グローバルの v{version} は最新です。古いベンダリングされたコピーを削除しました(チームモードが有効です)。準備ができたら `.gitignore` の変更をコミットしてください。」

**`LOCAL_GSTACK` が空でなく、かつ `TEAM_MODE` が `true` ではない場合**は、バージョンを比較します:
```bash
PRIMARY_VER=$(cat "${INSTALL_DIR:?INSTALL_DIR is not set: re-run Step 2 and substitute the printed path}/VERSION" 2>/dev/null || echo "unknown")
LOCAL_VER=$(cat "${LOCAL_GSTACK:?LOCAL_GSTACK is not set: re-run the Step 4.5 detection block}/VERSION" 2>/dev/null || echo "unknown")
echo "PRIMARY=$PRIMARY_VER LOCAL=$LOCAL_VER"
```

**バージョンが異なる場合:** 上の Step 4.5 の同期ブロックに従い、プライマリからローカルのコピーを更新します。ユーザーに伝えます:「グローバルの v{PRIMARY_VER} は最新です。ローカルのベンダリングされたコピーを v{LOCAL_VER} → v{PRIMARY_VER} に更新しました。準備ができたら `.claude/skills/gstack/` をコミットしてください。」

**バージョンが一致する場合:** ユーザーに伝えます:「最新バージョン(v{PRIMARY_VER})です。グローバルとローカルのベンダリングされたコピーは、どちらも最新です。」
