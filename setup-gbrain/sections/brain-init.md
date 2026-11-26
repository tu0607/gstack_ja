<!-- AUTO-GENERATED from brain-init.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
経路ごとに異なります。Step 2 で選んだ経路のサブセクションのみを、以下から実行してください
(Step 2 でエンジンの移行が選ばれた場合は Switch の手順)。

### Path 1(Supabase、既存の URL)

secret-read ヘルパーを読み込み、`read -s` と伏せ字のプレビューで URL を収集します:

```bash
. ~/.claude/skills/gstack/bin/gstack-gbrain-lib.sh
read_secret_to_env GBRAIN_POOLER_URL "Paste Session Pooler URL: " \
  --echo-redacted 's#://[^@]*@#://***@#'
```

次に、構造を検証します:

```bash
printf '%s' "$GBRAIN_POOLER_URL" | ~/.claude/skills/gstack/bin/gstack-gbrain-supabase-verify -
```

検証の終了コードが 3(direct-connection の URL)の場合、検証ツール自身のメッセージが修正方法を説明しています。それを提示し、Session Pooler の URL を再度求めてください。

成功した場合は、環境変数経由で gbrain に引き渡します(argv には決して載せません):

```bash
GBRAIN_DATABASE_URL="$GBRAIN_POOLER_URL" gbrain init --non-interactive --json
```

その後すぐに `unset GBRAIN_POOLER_URL GBRAIN_DATABASE_URL` を実行します。URL はこの時点で、gbrain 自身によってモード 0600 で `~/.gbrain/config.json` に保存されています。

### Path 2a(Supabase、自動プロビジョニング)

トークンを収集する前に、この PAT のスコープの開示をそのまま表示します:

> *この Supabase Personal Access Token は、これから作成する `gbrain` プロジェクトだけでなく、
> Supabase アカウント内のすべてのプロジェクトに対する読み取り・書き込み・削除の
> 全権限を与えます。Supabase は現在、スコープ付きトークンをサポートしていません。
> gstack がこの PAT を使うのは、プロジェクトを 1 つ作成し、正常になるまでポーリングし、
> Session Pooler URL を読み取るためだけです。その後、プロセスのメモリから破棄します。
> トークンは、https://supabase.com/dashboard/account/tokens で手動で失効させるまで
> Supabase 側で有効なままです。セットアップの完了後すぐに失効させることをおすすめします。*

その後:

```bash
. ~/.claude/skills/gstack/bin/gstack-gbrain-lib.sh
read_secret_to_env SUPABASE_ACCESS_TOKEN "Paste PAT: "
```

AskUserQuestion で階層を尋ねます: "Which Supabase tier?"(どの Supabase の階層を使いますか?)Free(プロジェクト数の上限2、7日間操作がないと一時停止)と Pro($25/月、一時停止なし、実用には推奨)を提示します。階層は**組織レベル**であることを説明してください(Management API の仕様による)。ユーザーは現在の階層に基づいて組織を選びます。Pro を使うには、先に supabase.com で組織をアップグレードする必要がある場合があります。

組織を一覧表示し、1つ選んでもらいます(複数ある場合は AskUserQuestion):

```bash
orgs=$(~/.claude/skills/gstack/bin/gstack-gbrain-supabase-provision list-orgs --json)
```

`.orgs` 配列が空の場合は、次のように提示します: "Your Supabase account has no organizations. Create one at https://supabase.com/dashboard, then re-run `/setup-gbrain`."(Supabase アカウントに組織がありません。https://supabase.com/dashboard で組織を作成してから、`/setup-gbrain` を再実行してください。)そして停止します。

ユーザーにリージョンを尋ねます(既定は `us-east-1`。有効な値は Supabase Management API の18個の enum 値です。よく使われるものをいくつか挙げ、完全な一覧が必要な場合は「Other」を選んでもらってください)。

DB のパスワードを生成します(ユーザーには決して表示しません):

```bash
export DB_PASS=$(openssl rand -base64 24)
```

中断されたプロビジョニングを再開または削除できるように、SIGINT のトラップを設定します:

```bash
trap 'echo ""; echo "gstack-gbrain: interrupted. In-flight ref: $INFLIGHT_REF"; \
      echo "Resume: /setup-gbrain --resume-provision $INFLIGHT_REF"; \
      echo "Delete: https://supabase.com/dashboard/project/$INFLIGHT_REF"; \
      unset SUPABASE_ACCESS_TOKEN DB_PASS; exit 130' INT TERM
```

作成 + 待機 + 取得:

```bash
result=$(~/.claude/skills/gstack/bin/gstack-gbrain-supabase-provision \
  create gbrain "$REGION" "$ORG_SLUG" --json)
INFLIGHT_REF=$(echo "$result" | jq -r .ref)
~/.claude/skills/gstack/bin/gstack-gbrain-supabase-provision wait "$INFLIGHT_REF" --json
pooler=$(~/.claude/skills/gstack/bin/gstack-gbrain-supabase-provision \
  pooler-url "$INFLIGHT_REF" --json)
GBRAIN_DATABASE_URL=$(echo "$pooler" | jq -r .pooler_url)
export GBRAIN_DATABASE_URL
gbrain init --non-interactive --json
unset SUPABASE_ACCESS_TOKEN DB_PASS GBRAIN_DATABASE_URL INFLIGHT_REF
trap - INT TERM
```

成功後、PAT の失効に関するリマインダーを出力します:

> "セットアップ完了。貼り付けた PAT を https://supabase.com/dashboard/account/tokens で失効させてください。メモリからはすでに破棄済みで、再び必要ありません。gbrain プロジェクトは独自の埋め込みデータベースのパスワードを使うため、引き続き動作します。"

### Path 2b(Supabase、手動)

ユーザーを supabase.com の手順に沿って案内します:
1. https://supabase.com/dashboard にログインする
2. "New Project" をクリックし、名前を `gbrain` にして、リージョンを選び、生成されたデータベースのパスワードをコピーする — 手順 4 のプーラー URL にはそれを含める必要があります(貼り付ける前に、`[YOUR-PASSWORD]` のプレースホルダをすべて置き換えてください)
3. プロジェクトの初期化を約2分待つ
4. Settings → Database → Connection Pooler → Session → URL(ポート 6543)をコピーする

その後は、Path 1 と同じ secret-read、検証、初期化の流れに従います。

### Path 3(PGLite ローカル)

```bash
# gstack default: voyage-code-3 (1024d) when VOYAGE_API_KEY is set — code
# retrieval beats general-purpose embeddings on real code queries (validated
# A/B). Without the key, gbrain auto-selects (OpenAI 1536d when available).
# Never select gbrain's legacy zeroentropyai recipe for a new brain: its hosted
# API's sunset date (September 4, 2026) has passed; the wireup helper warns existing installs.
set --  # flags ride the positional params — unquoted $VAR breaks under zsh word-splitting
if [ -n "${VOYAGE_API_KEY:-}" ]; then
  set -- --embedding-model voyage:voyage-code-3 --embedding-dimensions 1024
fi
gbrain init --pglite --json "$@"
```

完了です。ネットワークも、シークレットも不要です(`VOYAGE_API_KEY` が設定されている場合は、同期中に Voyage の埋め込み API の呼び出しが発生します。100万トークンあたり約 $0.18 で、リポジトリごとにわずかな費用です)。

### Path 4(リモート gbrain MCP — ベアラートークン付きの HTTP トランスポート)

ブレインが別のマシン(Tailscale、ngrok、社内 LAN、またはチームメイトのサーバー)で動いているユーザー向けです。ローカルの gbrain CLI のインストールも、ローカルの DB も不要です。このスキルはリモート MCP を登録して終了します。取り込みとインデックス作成はブレインのホストで行われます。

**4a. MCP の URL を収集する。** ユーザーに次のように求めます:

```
Paste your gbrain MCP URL (e.g. https://wintermute.tail554574.ts.net:3131/mcp):
```

素の `read -r` で読み込みます(URL だけでは認証情報にならないため、シークレットの扱いは不要です)。`https://` で始まることを検証します(ループバック以外のホストには TLS を必須とします)。localhost 以外への `http://` は拒否してください。

**4b. secret-read ヘルパーでベアラートークンを収集する(argv には決して載せない)。**

```bash
. ~/.claude/skills/gstack/bin/gstack-gbrain-lib.sh
read_secret_to_env GBRAIN_MCP_TOKEN "Paste bearer token: " \
  --echo-redacted 's/.\{6\}$/***REDACTED***/'
```

**4c. gstack-gbrain-mcp-verify で検証する。** ヘルパーを実行し、分類された JSON 出力を取得します:

```bash
verify_json=$(GBRAIN_MCP_TOKEN="$GBRAIN_MCP_TOKEN" \
  ~/.claude/skills/gstack/bin/gstack-gbrain-mcp-verify "$MCP_URL")
status=$(echo "$verify_json" | jq -r .status)
```

`status != "success"` の場合、ヘルパーはすでに失敗を NETWORK / AUTH / MALFORMED に分類し、1行の修正のヒントを出力しています。そのヒントを `error_text` の生のエラーの上に提示し、「修正して /setup-gbrain を再実行してください」という明確なメッセージとともに **STOP** してください。検証に失敗した場合は、Step 5a に進まないでください。登録が途中まで終わると、ユーザーは中途半端に壊れた状態になります。

後続のステップのために、検証出力から次の2つの値を取得します:
- `SERVER_VERSION`(例: `0.27.1`) — Step 8 の CLAUDE.md のブロックに書き込まれます。
- `URL_FORM_SUPPORTED`(`true|false`) — Step 7 で `gstack-artifacts-init` に渡され、ブレインの管理者向けの接続コマンドのどの形式を出力するかを制御します。

**4d.(Path 4)コード検索のためのローカル PGLite を提案する。** 次のように尋ねます:

> D# — このマシンで、シンボルを認識したコード検索を使いますか?
> プロジェクト/ブランチ/タスク: <検出したスラッグとブランチを使った1文の前提>
> ELI10(専門用語なしの説明): `<MCP_URL>` のリモートブレインはマシンをまたいだ知識に優れていますが、`gbrain code-def` / `code-refs` / `code-callers` のようなシンボルの問い合わせには、このマシンのコードのローカルインデックスが必要です。コード専用に、リモートブレインとは別の、小さく隔離された PGLite データベース(約30秒、アカウント不要、ディスク約 120 MB)を用意できます。トランスクリプトと artifacts は引き続き artifacts リポジトリ経由でリモートブレインに送られます。ローカルの PGLite はコードのみを保持します。
> 影響: 用意しない場合、このリポジトリの worktree でのセマンティックなコード検索は Grep にフォールバックします。
> 推奨: A — 30秒、継続的な費用なし、シンボルツールが使えるようになります。
> 完全性: A=10/10(完全な分割エンジン)、B=7/10(リモートのみ)。
> A) はい、コード用にローカル PGLite をセットアップする(推奨)
>   ✅ worktree ごとに `gbrain code-def`、`code-refs`、`code-callers` が使えるようになる
>   ✅ 独立したエンジン — リモートブレインを乱さず、トランスクリプトも共有しない
> B) いいえ、リモート MCP のみ
>   ✅ ローカルの状態はゼロ — `~/.claude.json` の MCP 登録のみ
>   ❌ シンボルのコード問い合わせは、このリポジトリの worktree では Grep にフォールバックする
> 結果: A = 完全な分割エンジン、B = リモートのみ。

**A(はい)の場合**: ロールバック可能な方式で、ローカル PGLite をインストールして初期化します:

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-install || exit $?
# At this point the local gbrain CLI is on PATH. Init PGLite, but back up any
# existing ~/.gbrain/config.json first (rollback if init fails).
if [ -f "$HOME/.gbrain/config.json" ]; then
  BACKUP="$HOME/.gbrain/config.json.gstack-bak-$(date +%s)"
  mv "$HOME/.gbrain/config.json" "$BACKUP"
fi
# gstack default for local code-search PGLite: voyage-code-3 (1024d) when
# VOYAGE_API_KEY is set. It wins the A/B over voyage-4-large and OpenAI
# text-embedding-3-large on this codebase's symbol queries. Falls back to
# gbrain's auto-selected provider when the key isn't present.
set --  # flags ride the positional params — unquoted $VAR breaks under zsh word-splitting
if [ -n "${VOYAGE_API_KEY:-}" ]; then
  set -- --embedding-model voyage:voyage-code-3 --embedding-dimensions 1024
fi
if ! gbrain init --pglite --json "$@"; then
  if [ -n "${BACKUP:-}" ] && [ -f "$BACKUP" ]; then mv "$BACKUP" "$HOME/.gbrain/config.json"; fi
  echo "gbrain init failed. Existing config (if any) was restored. PGLite at ~/.gbrain/pglite/ may be in a partial state — \`rm -rf ~/.gbrain/pglite\` to reset." >&2
  echo "Continuing setup without local code search; you can re-run /setup-gbrain to retry." >&2
fi
```

その後、5a に進みます。5a のリモート HTTP MCP の登録はそのまま実行されます。ローカルの PGLite は MCP の登録とは独立しています(Claude Code は問い合わせのために MCP 経由でリモートブレインと通信し、`gbrain` CLI は code-def/refs/callers のためにローカルの PGLite と通信します)。

**B(いいえ)の場合**: インストールと初期化はスキップします。ローカルエンジンは存在しないままです。`gbrain_local_status` は `missing-config` になります(gbrain がインストールされていない場合は `no-cli`)。`/sync-gbrain` はコードのステージをきれいにスキップします。

**4e. B を選んだ場合、他の経路の Step 3、Step 4 と、ローカル doctor の Step 5 をスキップします。**
A を選んだ場合、Step 3 はすでに(gstack-gbrain-install 経由で)実行され、Step 4 もすでに(`gbrain init --pglite` 経由で)実行されているため、直接 Step 5a に進みます。B を選んだ場合、Step 3/4/5 は何もしません。また、リモート HTTP モードではメモリのステージが artifacts のパイプラインを経由するため、Step 7.5(トランスクリプトの取り込み)もスキップします。

ベアラートークン(`GBRAIN_MCP_TOKEN`)は、Step 5a の `claude mcp add --header` が消費するまでプロセスの環境変数に残ります。その後すぐに `unset GBRAIN_MCP_TOKEN` を実行します。トークンのセキュリティ上のトレードオフは `setup-gbrain/memory.md` に記載されています。`claude mcp add` の実行中は argv に一時的に露出し、常駐状態は `~/.claude.json`(モード 0600)です。

### Switch(detect の既存エンジンの状態から)

```bash
# Going PGLite → Supabase, collect URL first (Path 1 flow), then:
timeout 180s gbrain migrate --to supabase --url "$URL" --json
# Going Supabase → PGLite:
timeout 180s gbrain migrate --to pglite --json
```

`timeout` が 124(タイムアウトの終了コード)を返した場合は、次のメッセージを提示します("Migration didn't complete in 3 minutes — another gstack session may be holding a lock on the source brain. Close other workspaces and re-run `/setup-gbrain --switch`. Your original brain is untouched.")(移行が3分以内に完了しませんでした。別の gstack セッションが移行元のブレインのロックを保持している可能性があります。他のワークスペースを閉じてから `/setup-gbrain --switch` を再実行してください。元のブレインは変更されていません。)。そして STOP します。
