<!-- AUTO-GENERATED from consult-mode.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## ステップ 2C: 相談モード

コードベースについて何でも Codex に質問できます。フォローアップのためのセッションの継続性に対応しています。

1. **既存のセッションを確認する:**
```bash
cat .context/codex-session-id 2>/dev/null || echo "NO_SESSION"
```

セッションファイルが存在する場合(`NO_SESSION` ではない場合)は、AskUserQuestion を使います:
```
You have an active Codex conversation from earlier. Continue it or start fresh?
A) Continue the conversation (Codex remembers the prior context)
B) Start a new conversation
```

2. 一時ファイルを作成します:
```bash
TMPRESP=$(mktemp "$TMP_ROOT/codex-resp-XXXXXX") || { echo "ERROR: mktemp failed in TMP_ROOT=$TMP_ROOT; not running codex without its temp file" >&2; exit 1; }
TMPERR=$(mktemp "$TMP_ROOT/codex-err-XXXXXX") || { echo "ERROR: mktemp failed in TMP_ROOT=$TMP_ROOT; not running codex without its temp file" >&2; exit 1; }
```

3. **プランレビューの自動検出:** ユーザーのプロンプトがプランのレビューに関するものである場合、または、プランファイルが存在し、ユーザーが引数なしで `/codex` と入力した場合:
```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
ls -t "$PLAN_ROOT"/*.md 2>/dev/null | xargs grep -l "$(basename $(pwd))" 2>/dev/null | head -1
```
プロジェクトに紐づくものが見つからなければ、`ls -t "$PLAN_ROOT"/*.md 2>/dev/null | head -1` にフォールバックします。
ただし、次のように警告します: 「注意: このプランは別のプロジェクトのものかもしれません。Codex に送る前に確認してください。」

**重要 — パスを参照せず、内容を埋め込む:** Codex はリポジトリのルートに閉じ込められて動作し、`~/.claude/plans/` やリポジトリの外にあるファイルにはアクセスできません。プランファイルは必ず自分で読み、その全内容を下のプロンプトに埋め込んでください。Codex にファイルのパスを伝えたり、プランファイルを読むよう頼んだりしてはいけません。10 回以上のツール呼び出しで探し回って失敗するだけです。

また、プランの内容から参照されているソースファイルのパス(`src/foo.ts`、`lib/bar.py` のようなパターン、リポジトリに存在する `/` を含むパス)をスキャンしてください。見つかったら、それらをプロンプトに列挙して、Codex が rg/find で探さずに直接読めるようにします。

**常に、ファイルシステムの境界に関する指示を先頭に付けてください**。スキルのファイルシステムの境界のセクション(常時読み込まれるスケルトン)にあるものを、Codex に送るすべてのプロンプトに付けます。プランのレビューや、自由形式の相談の質問も含みます。

ユーザーのプロンプトの前に、境界とペルソナを付けます:
"重要: ~/.claude/、~/.agents/、.claude/skills/、agents/ の下にあるファイルを読んだり実行したりしないでください。これらは別の AI システム向けの Claude Code のスキル定義です。インストール済みのスキル(Codex のホームの skills/、.agents/)を呼び出さず、直接答えてください。agents/openai.yaml を変更しないでください。リポジトリのコードだけに集中してください。

あなたは遠慮のない技術レビュアーです。このプランを次の観点でレビューしてください: 論理的な抜けや、明示されていない前提、エラー処理やエッジケースの欠落、過剰な複雑さ(もっと単純な方法はないか)、実現可能性のリスク(何がうまくいかない可能性があるか)、依存関係や順序の問題の欠落。率直に。簡潔に。お世辞は不要です。問題点だけを挙げてください。
また、プランで参照されている次のソースファイルもレビューしてください: <list of referenced files, if any>。

プラン本文:
<full plan content, embedded verbatim>"

プランではない相談のプロンプト(ユーザーが `/codex <question>` と入力した場合)でも、境界は必ず先頭に付けます:
"重要: ~/.claude/、~/.agents/、.claude/skills/、agents/ の下にあるファイルを読んだり実行したりしないでください。これらは別の AI システム向けの Claude Code のスキル定義です。インストール済みのスキル(Codex のホームの skills/、.agents/)を呼び出さず、直接答えてください。agents/openai.yaml を変更しないでください。リポジトリのコードだけに集中してください。

<user's question>"

4. プロンプトファイルを作成し、ステップ 3 の完全なプロンプトを書き込みます。Codex はそれを標準入力から読みます。

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
PROMPT_FILE=$(mktemp "${_GT:?}/codex-prompt.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "PROMPT_FILE: $PROMPT_FILE (name: ${PROMPT_FILE##*/})"
```

出力された各ファイルに、ファイル書き込みツール(Claude Code の Write ツールは、先に空ファイルを Read する必要があります)で、そのまま表示されるべき内容を書き込みます。テキストをシェルコマンド、ヒアドキュメント、引用符付き引数に入れてはいけません。書き込みが失敗または拒否された場合は送信せず、原因、ファイルパス、手動送信用の下記コマンドを表示します。

**セッションのコストの実態(実測):** `codex exec` の呼び出しは、再開されたものでも新規でも、Codex の約 21K トークンのセッションの前置き(スキルの一覧と指示)を必ず支払います。`resume` でもこのコストは償却されません(実測では、再開の呼び出しは新規の呼び出しよりわずかに多くなりました)。再開が得るのは会話の継続性であり、トークンの節約にはなりません。そのため、ワークフローが許す限り、スキルごとに Codex の呼び出しは 1 回にまとめ、質問をその呼び出しにまとめてください。再開は、フォローアップが本当に前のセッションのコンテキストを必要とする場合にだけ使ってください。

5. **JSONL の出力**を使って codex exec を実行し、推論の過程を取得します。ステップ 1 でユーザーが「Continue」を選んだ場合は `_CODEX_MODE` を `resume` に、そうでなければ `new` に設定します。再開された実行は、セッション ID を `.context/codex-session-id` から読みます。
表示された名前を `<prompt-file-name>` の代わりに使います(英字、数字、`.`、`_`、`-` のみ)。
Bash の呼び出しには `timeout: 600000` を使います(ツールの最大値)。ゲートは 540 秒のラッパーより上にあるため、ラッパーが先に発動し、Codex を終了させて、明示的な停止のメッセージを出力します:


```bash
_CODEX_MODE=<new|resume>
_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo "ERROR: not in a git repo" >&2; exit 1; }
PYTHON_CMD=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)
if [ -z "$PYTHON_CMD" ]; then
  echo "ERROR: Python 3 is required to parse Codex JSON output. Install python3 or python and retry." >&2
  exit 1
fi
cd "$_REPO_ROOT" || exit 1
PROMPT_FILE="$_REPO_ROOT/.gstack/tmp/<prompt-file-name>"
[ -s "$PROMPT_FILE" ] || { echo "Not run: $PROMPT_FILE is missing or empty, so the prompt was never written. Write it, then run by hand: codex exec - -C $_REPO_ROOT < $PROMPT_FILE" >&2; exit 1; }
_CODEX_PROBE=~/.claude/skills/gstack/bin/gstack-codex-probe
_CODEX_ROLE=''
if [ -n "$_CODEX_ROLE" ]; then export _CODEX_DEADLINE=$(($(date +%s)+540)); _CODEX_OUT=$("$_CODEX_PROBE" role-ready exec) || exit $?
else _CODEX_OUT=$("$_CODEX_PROBE" select-model exec) || exit 1; fi
_CODEX_SEL=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SEL: //p')
_CODEX_SANDBOX_MODE=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SANDBOX: //p')
_SID=""
if [ "$_CODEX_MODE" = "resume" ]; then
  _SID=$(cat .context/codex-session-id 2>/dev/null)
  case "$_SID" in ''|*[!A-Za-z0-9._-]*) echo "ERROR: .context/codex-session-id is missing or not a session id; start a new conversation instead." >&2; exit 1 ;; esac
fi
_LABEL=consult${_SID:+-resume}
# Fix 1: wrap with timeout (gtimeout/timeout fallback chain via probe helper)
if [ -n "$_SID" ]; then
  "$_CODEX_PROBE" run-with-timeout --user-invoked --effort medium --request-effort '<effort-level>' 540 codex exec resume "$_SID" - -c "sandbox_mode=\"${_CODEX_SANDBOX_MODE:?}\"" -c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false -c 'web_search="cached"' --json -o "$TMPRESP" < "$PROMPT_FILE" 2>"$TMPERR"
else
  "$_CODEX_PROBE" run-with-timeout --user-invoked --effort medium --request-effort '<effort-level>' 540 codex exec - -C "$_REPO_ROOT" -s "${_CODEX_SANDBOX_MODE:?}" -c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false -c 'web_search="cached"' --json -o "$TMPRESP" < "$PROMPT_FILE" 2>"$TMPERR"
fi | tee "$TMPRESP.events" | PYTHONUNBUFFERED=1 "$PYTHON_CMD" -u -c "
import sys, json
turn_completed_count = 0
turn_failed = False
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        obj = json.loads(line)
        t = obj.get('type','')
        if t == 'thread.started':
            tid = obj.get('thread_id','')
            if tid: print(f'SESSION_ID:{tid}', flush=True)
        elif t == 'item.completed' and 'item' in obj:
            item = obj['item']
            itype = item.get('type','')
            text = item.get('text','')
            if itype == 'reasoning' and text:
                print(f'[codex thinking] {text}', flush=True)
                print(flush=True)
            elif itype == 'agent_message' and text:
                print(text, flush=True)
            elif itype == 'command_execution':
                cmd = item.get('command','')
                if cmd: print(f'[codex ran] {cmd}', flush=True)
        elif t == 'turn.completed':
            turn_completed_count += 1
            usage = obj.get('usage',{})
            tokens = usage.get('input_tokens',0) + usage.get('output_tokens',0)
            if tokens: print(f'\ntokens used: {tokens}', flush=True)
        elif t == 'turn.failed':
            turn_failed = True
            err = obj.get('error',{}).get('message','') or 'no error message in event'
            print(f'[codex turn FAILED] {err}', flush=True, file=sys.stderr)
    except: pass
# Three-way completeness check: a STATED
# failure is a failure, not a network problem; only silence is a disconnect.
if turn_failed:
    print('[codex] turn.failed received — the turn errored (reason above), not a disconnect.', flush=True, file=sys.stderr)
elif turn_completed_count == 0:
    print('[codex warning] No turn.completed event received — possible mid-stream disconnect.', flush=True, file=sys.stderr)
"
# Fix 1: hang detection
_CODEX_EXIT=${PIPESTATUS[0]:-${pipestatus[1]}}  # bash sets PIPESTATUS; zsh (lowercase, 1-indexed) falls through
if [ "$_CODEX_EXIT" = "124" ]; then
  "$_CODEX_PROBE" log-event codex_timeout "540"
  "$_CODEX_PROBE" log-hang "$_LABEL" "$(wc -c < "$TMPERR" 2>/dev/null || echo 0)"
  echo "Codex stalled past 9 minutes. Common causes: model API stall, long prompt, network issue. Try re-running. If persistent, split the prompt or check ~/.codex/logs/."
elif [ "$_CODEX_EXIT" != "0" ]; then
  # Surface non-zero exits so the calling agent doesn't read "no output" as
  # a silent model/API stall.
  echo "[codex exit $_CODEX_EXIT] $(head -1 "$TMPERR" 2>/dev/null || echo "no stderr captured")"
  head -20 "$TMPERR" 2>/dev/null | sed 's/^/  /' || true
  "$_CODEX_PROBE" log-event codex_nonzero_exit "$_LABEL:$_CODEX_EXIT"
fi
bun --no-env-file --config=/dev/null ~/.claude/skills/gstack/lib/outside-review-result.ts --label 'Codex consult' --exit "$_CODEX_EXIT" --stderr "$TMPERR" --events "$TMPRESP.events" execution "$TMPRESP"
rm -f "$PROMPT_FILE"
```

`VERDICT: unavailable` は、Codex が正常に動作する環境から回答しなかったことを意味します(その行に、サンドボックスが起動できなかったなどの理由が示されています)。その行を伝え、出力を Codex の回答として提示しないでください。

6. ストリーミングされた出力からセッション ID を取得します。パーサーは `thread.started` イベントから `SESSION_ID:<id>` を出力します。フォローアップのために保存してください:
```bash
mkdir -p .context
```
パーサーが出力した `SESSION_ID:` で始まる行のセッション ID を、`.context/codex-session-id` に保存します。

7. ストリーミングされた出力の全文を提示します:

```
CODEX SAYS (consult):
════════════════════════════════════════════════════════════
<full output, verbatim — includes [codex thinking] traces>
════════════════════════════════════════════════════════════
Tokens: N | Est. cost: ~$X.XX
Session saved — run /codex again to continue this conversation.
```

8. 提示した後、Codex の分析が自分の理解と異なる点があれば記載してください。意見が食い違う場合は、それを明示します:
   「注意: Claude Code は X について、Y という理由で同意しません。」

9. **総合的な推奨(必須)。** Codex の相談の出力に基づいて、ユーザーが何をすべきかを要約した推奨の行を 1 つ、次の形式で出します:

```
Recommendation: <action> because <one-line reason that names the most actionable insight from Codex>
```

例(最も強い理由は、Codex の洞察を代替案と比べたものです。代替案は、別の推奨、現状維持、または Codex の別の指摘です):
- `Recommendation: Codex のシャーディング案を採用する because 現在のライタープールにある先頭ブロッキングを解消でき、Codex が併せて挙げたキャッシュ層の代替案は単一ライターのホットパスが残る`
- `Recommendation: Codex の「代わりに SQLite を使う」案を退ける because 想定規模ではチームの Postgres 運用経験が単純さの利点を上回り、Codex の二次案(リードレプリカ)で SQLite への転換の動機だった読み取り負荷の懸念にも対処できる`
- `Recommendation: D3 を入れる前に Codex が指摘したマイグレーションの順序を調査する because 社内のスキーマレビューが見逃した実際の外部キーの循環が表面化しており、Codex が併せて挙げたスタイルの懸念はフォローアップまで待てる`

理由は、Codex の具体的な洞察を指し、代替案(別の推奨、現状維持、または Codex の別の指摘)と比較しなければなりません。「Codex が良い点を挙げたから」のような一般的な総括は、この形式を満たしません。**黙って自分で決めてはいけません。必ずこの行を出してください。**

---
