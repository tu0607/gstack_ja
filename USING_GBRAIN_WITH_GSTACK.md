# GStack で GBrain を使う

コーディングエージェントに、実際に覚えておいてくれる記憶を持たせましょう。

[GBrain](https://github.com/garrytan/gbrain) は AI エージェント向けに設計された永続的なナレッジベースです。エージェントが学んだこと、決めたこと、うまくいったことといかなかったことを保存し、エージェントがそのすべてをオンデマンドで検索できるようにします。GStack には、ゼロから「gbrain が動いていて、エージェントがそれを呼び出せる」状態まで、コマンド1つで到達する道筋があります。試しにローカルで動かす方法、チームと共有する方法、そしてその中間の方法が用意されています。

ここでは、すべてのシナリオ、すべてのフラグ、すべてのヘルパーのバイナリ、すべてのトラブルシューティング手順を扱います。手短な紹介は [README の GBrain の節](README.md#gbrain--persistent-knowledge-for-your-coding-agent) を、エラーコードと同期に特有の問題は [docs/gbrain-sync.md](docs/gbrain-sync.md) を参照してください。

---

## ワンコマンドでのインストール

```bash
/setup-gbrain
```

これだけです。このスキルは現在の状態を検出し、質問は多くても3つだけ行い、インストール、初期化、Claude Code への MCP 登録、リポジトリごとの信頼ポリシーの設定を順に案内します。何もインストールされていないクリーンな Mac なら、5分以内に完了します。すでに何かがセットアップされている Mac では、既存の状態を検出して完了済みの作業を飛ばすので、数秒で終わります。

## セットアップ後に得られるもの

`/setup-gbrain` が完了すると、コーディングエージェントには、それまでなかった2つの検索手段が加わります。

- **このリポジトリ全体に対するセマンティックなコード検索。** `gbrain search "browser security canary"` は、完全一致の grep ヒットではなく、順位付けされたファイル内の領域を返します。`gbrain code-def`、`code-refs`、`code-callers`、`code-callees` は、シンボルをたどって呼び出しグラフを辿ります。実装がどのファイルにあるかはわからないが、何をするものかはわかっているときに役立ちます。エージェントは、問いが意味的なものである場合、grep より先にこれらを使うようになります。CLAUDE.md には `## GBrain Search Guidance` のブロックが追加され、そのルーティングの規則が書かれます。
- **セッションをまたぐ記憶。** 過去のセッションの計画、振り返り、決定事項、学びは `~/.gstack/` に保存され(アーティファクトの同期を有効にしていれば)、gbrain がインデックスする非公開の git リポジトリに送られます。`gbrain search "what did we decide about auth?"` は、以前の CEO 計画を実際に見つけ出すので、毎回のセッションでコンテキストを説明し直す必要がなくなります。

リモート MCP(後述の Path 4)も有効にすると、ブレインへの問い合わせは共有のブレインサーバーに送られ、ほかのマシンからも書き込めるようになります。ノートパソコン、デスクトップ、チームメンバーのマシンが、すべて同じメモリを参照できます。

## 4つの経路

スキルから「Where should your brain live?(ブレインをどこに置きますか)」と聞かれたときに、どれか1つを選びます。

### Path 1: Supabase、接続文字列はすでにある

向いている人: あなた(またはチームメンバーのクラウドエージェント)がすでに Supabase のブレインを用意していて、このローカルマシンでも同じデータを使いたい場合。

**何が起きるか:** Session Pooler の URL を貼り付けます(Settings → Database → Connection Pooler → Session → URI をコピー、ポート 6543)。スキルは、エコーをオフにして読み取り、マスクされたプレビュー(`aws-0-us-east-1.pooler.supabase.com:6543/postgres`。ホストは見えるがパスワードは伏せられます)を表示したうえで、`GBRAIN_DATABASE_URL` 環境変数経由で `gbrain init` に渡します。URL は argv にもシェル履歴にも書き込まれません。

**信頼に関する警告:** この URL を貼り付けると、ローカルの Claude Code に、共有ブレインのすべてのページに対する読み書きの権限が与えられます。その信頼レベルが望ましくない場合は、代わりに PGLite ローカル(Path 3)を選んでください。その場合、ブレインは互いに分離されたままになります。

### Path 2a: Supabase、新しいプロジェクトを自動で用意する

向いている人: Supabase のアカウントを新しく作ったばかりで、クリックなしできれいな新しいプロジェクトを使いたい場合。

**何が起きるか:** Supabase の Personal Access Token(PAT)を貼り付けます。スキルは先に、スコープの開示を表示します。*このトークンは、これから作成するプロジェクトだけでなく、あなたの Supabase アカウント内のすべてのプロジェクトに対するフルアクセス権を持ちます。* 次に組織の一覧を出し、どの組織とどのリージョン(デフォルトは `us-east-1`)を使うかを尋ねます。データベースのパスワードを生成し、`POST /v1/projects` を呼び出し、プロジェクトが `ACTIVE_HEALTHY` になるまで 5 秒ごとに `GET /v1/projects/{ref}` をポーリングします(タイムアウトは 180 秒)。そのうえで pooler URL を取得し、`gbrain init` に渡します。全体で約 90 秒です。

最後に、https://supabase.com/dashboard/account/tokens で PAT を失効させるよう改めて促されます。スキルはそのトークンをすでにメモリから破棄していますが、念のための案内です。

**プロビジョニングの途中で Ctrl-C を押した場合:** SIGINT のトラップが、作成途中のプロジェクトの ref と再開用のコマンドを表示します。Supabase のダッシュボードで孤立したプロジェクトを削除するか、`/setup-gbrain --resume-provision <ref>` を実行して中断したところから再開できます。

### Path 2b: Supabase、手動で作成する

向いている人: PAT を貼り付けるより、supabase.com を自分でクリックして進めたい場合。

**何が起きるか:** スキルが手動の4つのステップ(サインアップ → 新規プロジェクト → 約2分待つ → Session Pooler URL のコピー)を案内し、その後は Path 1 の貼り付けの手順に引き継ぎます。セキュリティの扱いは Path 1 と同じです。

### Path 3: PGLite ローカル

向いている人: まず試してみたい、アカウントもクラウドも共有も不要な場合。あるいは、クラウドのエージェントから切り離された「この Mac のブレイン」が欲しい場合。

**何が起きるか:** `gbrain init --pglite` を実行します。ブレインは `~/.gbrain/brain.pglite` に作られます。初期化自体はネットワーク通信なしで、30 秒で終わります。

**埋め込みモデル。** `VOYAGE_API_KEY` が設定されていると、gstack は `voyage-code-3`(1024 次元)で PGLite を初期化します。これは Voyage のコード特化の埋め込みモデルで、このコードベースのシンボルクエリに対して、汎用の `voyage-4-large` や OpenAI の `text-embedding-3-large` よりも良い結果を出しました。`VOYAGE_API_KEY` がない場合は、gbrain が自動で選びます(`OPENAI_API_KEY` があれば OpenAI の 1536 次元、なければ gbrain のプロバイダの連鎖をたどります)。どちらの場合も、埋め込みは `/sync-gbrain` の同期中に選ばれたプロバイダの API を呼び出します。使いたいプロバイダのキーを、`/sync-gbrain` を実行する前に設定してください。

クラウドに手を出す前に gbrain の感触を確かめたいなら、最初の選択としておすすめです。あとから `/setup-gbrain --switch` で移行することもできます。

### Path 4: リモートの gbrain MCP(分割エンジン)

向いている人: ブレインを、自分の管理下にある別のマシン(Tailscale、ngrok、社内 LAN)またはチームメンバーのサーバーで動かしている場合。ローカルにデータベースを立てずに、マシンをまたいだメモリの利点を得たいが、この Mac でもシンボルを意識したコード検索は使いたい場合。

**何が起きるか:** MCP の URL(例: `https://wintermute.tail554574.ts.net:3131/mcp`)とベアラートークンを貼り付けます。スキルは URL を実際に通信して検証し、gbrain を HTTP MCP として `~/.claude.json` にユーザースコープで登録します。さらに、コード検索用の小さなローカル PGLite(約 30 秒、約 120 MB のディスク)を用意するかを尋ねます。

ローカルの PGLite を受け入れると、**分割エンジンモード** になります。

- **ブレイン／コンテキストへの問い合わせ**(`mcp__gbrain__search`、`mcp__gbrain__query`、`mcp__gbrain__get_page`)は、リモート MCP に送られます。計画、振り返り、学び、マシンをまたいだメモリは、すべて共有サーバー上にあります。
- **コードへの問い合わせ**(`gbrain code-def`、`code-refs`、`code-callers`、`code-callees`、コード用の `gbrain search`)は、各ワークツリーの `.gbrain-source` のピンを通じてローカルの PGLite に送られます。ローカルでインデックスされるため高速で、マシンの外に出ることはありません。

2つのエンジンは互いに独立しています。ローカルの PGLite を消去してもリモートのブレインには影響せず、リモート MCP のベアラートークンを更新してもローカルのコード検索には影響しません。また、リモートのブレインの管理者がすべての開発者のチェックアウトをインデックスできない(またはすべきでない)場合にも、この構成が適しています。ローカルのコードはローカルにとどまります。

## Claude Code への MCP 登録

デフォルトでは、スキルは「Give Claude Code a typed tool surface for gbrain?(gbrain の型付きツールを Claude Code に与えますか)」と尋ねます。「はい」と答えると、次を実行します。

```bash
claude mcp add gbrain -- gbrain serve
```

これにより、gbrain の stdio MCP サーバーが Claude Code に登録されます。以後、`gbrain search`、`gbrain put`、`gbrain get` などが、シェルからの呼び出しではなく、すべてのセッションで第一級のツールとして表示されます。

**`claude` が PATH にない場合**、スキルは MCP の登録を飛ばし、手動で登録するためのヒントを表示します。gbrain を呼び出すスキルは、CLI のリゾルバ経由で今も動作します。MCP はあくまで機能の上乗せであり、前提条件ではありません。

**ほかのローカルエージェント**(Cursor、Codex CLI など)は、それぞれ独自に MCP を登録する必要があります。このスキルは v1 では Claude Code を対象にしています。ほかのホストでは、自分の MCP 設定に `gbrain serve` を手動で登録できます。

## リポジトリごとの信頼ポリシー(3択)

マシン上のリポジトリはそれぞれ、**read-write**、**read-only**、**deny** のいずれかのポリシーを持ちます。

- **read-write** — エージェントは、このリポジトリのコンテキストから `gbrain search` を実行でき、新しいページをブレインに書き戻すこともできます。自分のプロジェクトのデフォルトです。
- **read-only** — エージェントはブレインを検索できますが、このリポジトリのセッションから新しいページを書き込むことはありません。複数のクライアントを担当するコンサルタントに最適です。共有のブレインは検索するが、クライアント A のコードでクライアント B のリポジトリを汚染しない、という使い方ができます。
- **deny** — gbrain とのやり取りは一切ありません。このリポジトリは gbrain のツールから見えません。

スキルは、そのリポジトリで gstack のスキルを初めて実行したときに、リポジトリごとに1回だけ尋ねます。その後、決定は固定されます。同じ git リモートのすべてのワークツリーとブランチは、同じポリシーを共有するので、1回設定すれば、その後もついてきます。

SSH と HTTPS のリモートは、同じキーにまとめられます。`https://github.com/foo/bar.git` と `git@github.com:foo/bar.git` は同じリポジトリです。

**ポリシーを変更するには:**

```bash
/setup-gbrain --repo      # re-prompt for this repo only

# Or directly:
~/.claude/skills/gstack/bin/gstack-gbrain-repo-policy set "github.com/foo/bar" read-only
```

**すべてのポリシーを見るには:**

```bash
~/.claude/skills/gstack/bin/gstack-gbrain-repo-policy list
```

保存先は `~/.gstack/gbrain-repo-policy.json`(モード 0600)で、将来のマイグレーションが決定的に行えるよう、スキーマのバージョンが付いています。

## `/sync-gbrain` でブレインを最新に保つ

`/setup-gbrain` は一度だけのオンボーディングです。`/sync-gbrain` は、このリポジトリのコードの新しい変更を gbrain に見せたいときに、そのたびに実行するコマンドです。

```bash
/sync-gbrain                # incremental: mtime fast-path, ~seconds on a clean tree
/sync-gbrain --full         # full reindex (~25-35 minutes on a big Mac)
/sync-gbrain --code-only    # only the code stage; skip memory + brain-sync
/sync-gbrain --dry-run      # preview what would sync; no writes
```

スキルは、コード、メモリ、ブレインの同期の3つの段階を、それぞれ独立して実行します。ある段階が失敗しても、ほかの段階はブロックされません。状態は `~/.gstack/.gbrain-sync-state.json` に保存されるので、再実行すると途中から正しく再開します。

マシンの外へデータを送りうる段階(リモートにあるかもしれない gbrain DB へのコード同期、メモリの取り込み、ブレインの同期の push)は、いずれも送信の前に、改ざん検知可能な受領記録を送信の台帳(`~/.gstack/security/egress.jsonl`)に書きます。これはフェイルクローズで動作し、受領記録を書けない場合は、記録されないまま同期する代わりに、段階を `EGRESS_RECEIPT_FAILED` で拒否します。通常の対処は `mkdir -p ~/.gstack/security && chmod -R u+w ~/.gstack/security` を実行してから再実行することです。受領記録は `gstack-egress list` で確認できます。

**新しいワークツリーでの動作:**

1. **事前チェック。** `gbrain_local_status`(ローカルエンジンの健全性)を確認します。エンジンが `broken-db` または `broken-config` なら、スキルは対処法のメニューを表示して停止します。エラーを黙って縮退させることはしません。ローカルエンジンがなく、リモート MCP モード(Path 4)を使っている場合は、コードの段階をきれいにスキップし、ブレインの同期だけを実行します。
2. **コードの段階。** カレントディレクトリを `gbrain sources add` で連携ソースとして登録し、リポジトリのルートに `.gbrain-source` のピンファイルを書き込み(kubectl 風のコンテキスト。ワークツリーごとに独自のピンを持つので、Conductor の兄弟ワークツリーが衝突しません)、`gbrain sync --strategy code` を実行します。
3. **メモリの段階。** `~/.gstack/` のトランスクリプトと厳選されたメモリをステージングします。ローカルの stdio MCP モードでは、ローカルエンジンに取り込みます。リモートの http MCP モードでは、リモートブレインの管理者のプル用パイプラインのために、ステージングされた markdown を `~/.gstack/transcripts/run-<pid>-<ts>/` に保存します。取り込みのタイムアウトは、デフォルトで 30 分です。大きなブレインでは `GSTACK_INGEST_TIMEOUT_MS`(1 分〜24 時間を指定可能)で延長できます。タイムアウトした場合も gbrain のインポートのチェックポイントは保持されるので、次の `/sync-gbrain` は最初からではなく途中から再開します。
4. **ブレインの同期の段階。** プライベートのアーティファクトリポジトリを設定していれば、厳選されたアーティファクト(計画、設計、振り返り)をそこへ送ります。
5. **CLAUDE.md の案内。** ラウンドトリップ(ページを書き込む → 検索する → 見つける)の能力を確認します。成功すれば、プロジェクトの CLAUDE.md に `## GBrain Search Guidance` のブロックを書き込みます。失敗すれば、そのブロックを削除します。インストールされていないツールの使用をエージェントに指示してはいけないからです。

**ウォーターマーク。** 同期の状態はコミットハッシュ単位で進みます。gbrain がインデックスできないファイル(1 ファイルあたりのハードリミット 5 MB を超える、または同期中にファイルが消えた)に当たると、ウォーターマークは動かず、以後の同期で再試行されます。修正できない失敗を認めて先に進めるには、次を実行します。

```bash
gbrain sync --source <source-id> --skip-failed
```

何度実行しても安全で(冪等)、同じマシン上の複数のターミナルから同時に実行しても安全です(`~/.gstack/.sync-gbrain.lock` でロックされます)。

## エンジンの切り替え

PGLite を選んだあとで、チームのブレインに参加したくなったら、コマンド1つで済みます。

```bash
/setup-gbrain --switch
```

スキルは `gbrain migrate --to supabase --url "$URL"` を `timeout 180s` で囲んで実行します。移行は双方向(Supabase → PGLite も可能)で、ロスレスです。ページ、チャンク、埋め込み、リンク、タグ、タイムラインがすべてコピーされます。元のブレインはバックアップとして残ります。

**移行がハングする場合:** 別の gstack のセッションが、移行元のブレインにロックをかけている可能性があります。3 分でタイムアウトし、対処すべきことを表示します。ほかのワークスペースを閉じてから、再実行してください。

## GStack のメモリ同期(別の関心事)

これは gbrain 自体とは別の話です。gstack の状態(`~/.gstack/` の学び、計画、振り返り、タイムライン、開発者のプロファイル)は、初期状態ではそのマシンだけに保存されます。「GStack のメモリ同期」を有効にすると、秘密情報をスキャンして厳選したサブセットを、プライベートな git リポジトリに任意で送れます。これにより、メモリがマシンをまたいで引き継がれます。gbrain を使っていれば、その git リポジトリもそこでインデックスの対象になります。

次のコマンドで有効にします。

```bash
gstack-artifacts-init
```

初回のプライバシーの確認が表示されます。選択肢は **すべて許可**、**アーティファクトのみ**(計画、設計、振り返り、学び。タイムラインなどの行動データは除く)、**オフ** の3つです。スキルの実行のたびに、開始時と終了時にキューが同期されます。デーモンもバックグラウンドプロセスもありません。

秘密情報らしき内容(AWS キー、GitHub トークン、PEM ブロック、JWT、ベアラートークン)は、マシンの外に出る前に同期からブロックされます。

**新しいマシンでは:** `~/.gstack-artifacts-remote.txt` をコピーし(旧名の `~/.gstack-brain-remote.txt` も引き続き読めます)、`gstack-brain-restore` を実行すると、昨日の学びが今日のノートパソコンにも現れます。

詳しいガイドは [docs/gbrain-sync.md](docs/gbrain-sync.md) にあります。エラーの一覧は [docs/gbrain-sync-errors.md](docs/gbrain-sync-errors.md) を参照してください。

`/setup-gbrain` は、初回セットアップの最後にこれを設定するかを提案します。これは AskUserQuestion の質問がもう 1 つ増えるだけで、同じプライベートリポジトリのインフラと連携します。

## 孤立したプロジェクトの整理

プロビジョニングの途中で Ctrl-C を押したり、3つの名前を試してから1つに決めたり、そのほかの理由で、使っていない gbrain らしき Supabase プロジェクトが溜まってしまった場合は、次のサブコマンドを使えます。

```bash
/setup-gbrain --cleanup-orphans
```

スキルは PAT を一度だけ再度尋ね(使用後に破棄されます)、Supabase アカウント内のプロジェクトのうち、名前が `gbrain` で始まり、かつ ref がアクティブな `~/.gbrain/config.json` の pooler URL と一致しないものを一覧にします。孤立したプロジェクトごとに、*「孤立したプロジェクト `<ref>`(`<name>`、作成日 `<date>`)を削除しますか?」* と1件ずつ尋ねます。まとめて処理したり「すべて削除」の近道を用意したりはしません。アクティブなブレインが削除の候補に挙がることは決してありません。

## コマンドとフラグの一覧

### `/setup-gbrain` の起動モード

| 呼び出し方 | 何をするか |
|---|---|
| `/setup-gbrain` | 完全なフロー: 状態を検出し、経路を選び、インストール、初期化、MCP、ポリシー、任意でメモリ同期 |
| `/setup-gbrain --repo` | 現在のリポジトリだけ、リモートごとの信頼ポリシーを切り替える |
| `/setup-gbrain --switch` | ほかの手順を再実行せずに、エンジンを移行する(PGLite ↔ Supabase) |
| `/setup-gbrain --resume-provision <ref>` | ポーリング中に中断された Path 2a の自動プロビジョニングを再開する |
| `/setup-gbrain --cleanup-orphans` | 孤立した Supabase プロジェクトの一覧と、プロジェクトごとの削除 |

### ヘルパーのバイナリ(スクリプト用)

| バイナリ | 目的 |
|---|---|
| `gstack-gbrain-detect` | 現在の状態を JSON で出力: PATH 上の gbrain、バージョン、設定のエンジン、doctor の状態、同期モード |
| `gstack-gbrain-install` | 検出優先のインストーラ(`~/git/gbrain`、`~/gbrain` を探し、なければ新規にクローン)。`--dry-run` と `--validate-only` のフラグがあります。PATH のシャドウチェックで、対処法のメニューとともに終了コード 3 で終わります。 |
| `gstack-gbrain-lib.sh` | 実行されず、source して使います。`read_secret_to_env VARNAME "prompt" [--echo-redacted "<sed-expr>"]` を提供します |
| `gstack-gbrain-supabase-verify` | URL の構造チェック。直接接続の URL(`db.*.supabase.co:5432`)は終了コード 3 で拒否されます |
| `gstack-gbrain-supabase-provision` | Management API のラッパー。サブコマンドは `list-orgs`、`create`、`wait`、`pooler-url`、`list-orphans`、`delete-project`。すべて環境変数に `SUPABASE_ACCESS_TOKEN` が必要です。`create` と `pooler-url` は `DB_PASS` も必要です。すべてのサブコマンドで `--json` モードが使えます。 |
| `gstack-gbrain-repo-policy` | リモートごとの信頼の3択。サブコマンドは `get`、`set`、`list`、`normalize` |
| `gstack-gbrain-source-wireup` | `~/.gstack/` のブレインのリポジトリを、`gbrain sources add` と `git worktree` 経由で gbrain の連携ソースとして登録し、続けて初回の `gbrain sync` を実行します。冪等です。v1.12.x の古い `consumers.json + /ingest-repo` による HTTP の連携に代わるものです。フラグは `--strict`、`--source-id <id>`、`--no-pull`、`--uninstall`、`--probe`。 |

### gbrain CLI(上流のツール)

gstack がラップしている gbrain 自体のコマンドは次のとおりです。

| コマンド | 目的 |
|---|---|
| `gbrain init --pglite` | ローカルの PGLite ブレインを初期化する |
| `gbrain init --non-interactive` | 環境変数(`GBRAIN_DATABASE_URL` または `DATABASE_URL`)で初期化する。URL を argv として渡してはいけません。シェル履歴に残ってしまいます。 |
| `gbrain doctor --json` | ヘルスチェック。`{status: "ok"|"warnings"|"error", health_score: 0-100, checks: [...]}` を返す |
| `gbrain migrate --to supabase --url ...` | PGLite のブレインを Supabase に移す(ロスレス。移行元はバックアップとして残す) |
| `gbrain migrate --to pglite` | 逆方向の移行 |
| `gbrain search "query"` | ブレインを検索する |
| `gbrain put "<slug>" --content "<markdown-with-frontmatter>"` | ページを書き込む(タイトルとタグは `--content` 内の YAML フロントマターに書く) |
| `gbrain get "<slug>"` | ページを取得する |
| `gbrain serve` | MCP の stdio サーバーを起動する(`claude mcp add` で使われる) |

### 設定ファイルと状態

| パス | 中身 |
|---|---|
| `~/.gbrain/config.json` | エンジン(pglite/postgres)、データベースの URL またはパス、API キー。モード 0600。`gbrain init` が書き込みます。 |
| `~/.gstack/gbrain-repo-policy.json` | リモートごとの信頼の3択。スキーマ v2。モード 0600。 |
| `~/.gstack/.setup-gbrain.lock.d` | 同時実行のロック(アトミックな mkdir)。通常終了と SIGINT で解放されます。 |
| `~/.gstack/.brain-queue.d/` | GStack メモリ同期の保留中の同期レコード。maildir 形式のスプールで、レコードごとに 1 ファイル。古いリリースの `.brain-queue.jsonl` は、次のドレインで自動的に移行されます。 |
| `~/.gstack/.brain-last-push` | 最後の同期のプッシュの時刻(`/health` のスコア算出用) |
| `~/.gstack-artifacts-remote.txt` | GStack メモリ同期のリモートの URL(マシン間でコピーしても安全。旧名 `~/.gstack-brain-remote.txt` も引き続き読まれます) |
| `~/.gstack/.setup-gbrain-inflight.json` | 将来の `--resume-provision` の永続化状態のために予約 |

### 環境変数

| 変数 | 読み取られる場所 | 何をするか |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | `gstack-gbrain-supabase-provision` | Management API 呼び出し用の PAT。セットアップの実行ごとに破棄されます。 |
| `DB_PASS` | `gstack-gbrain-supabase-provision`(create、pooler-url) | 生成されたデータベースのパスワード。argv には決して入りません。 |
| `GBRAIN_DATABASE_URL` | `gbrain init`、`gbrain doctor` など | Postgres の接続文字列(当プロジェクトでは Supabase の pooler URL)。環境変数が `~/.gbrain/config.json` より優先されます。 |
| `DATABASE_URL` | `gbrain init`(フォールバック) | `GBRAIN_DATABASE_URL` と同じ意味。2番目に確認されます。 |
| `SUPABASE_API_BASE` | `gstack-gbrain-supabase-provision` | Management API のホストを上書きする。テストでモックサーバーを指すために使われます。 |
| `GBRAIN_INSTALL_DIR` | `gstack-gbrain-install` | デフォルトのインストール先(`~/gbrain`)を上書きする |
| `GSTACK_HOME` | すべてのヘルパーのバイナリ | `~/.gstack` の状態ディレクトリを上書きする。テストで多用されます。 |
| `VOYAGE_API_KEY` | `gbrain embed` のサブプロセス、gstack の PGLite 初期化 | 設定されていると、gstack は `voyage-code-3`(1024 次元)、つまり Voyage のコード特化の埋め込みモデルで PGLite を初期化します。このコードベースのシンボルクエリで、`voyage-4-large` や OpenAI の `text-embedding-3-large` よりも良い結果でした。A/B の数値は CHANGELOG v1.43.1.0 を参照してください。 |
| `OPENAI_API_KEY` | `gbrain embed` のサブプロセス | `VOYAGE_API_KEY` が設定されていないときに、`gbrain sync` や `/sync-gbrain` の埋め込みに使われます(gbrain が自動で選ぶ代替手段で、`text-embedding-3-large` の 1536 次元)。どちらのキーもなければ、ページは構造的にだけインポートされます(シンボルテーブル、チャンク)。意味的な検索は劣化し、同期のログに `[gbrain] embedding failed for code file ...` と表示されます。 |
| `ANTHROPIC_API_KEY` | `claude-agent-sdk`、有償の eval | 有償の eval(`bun run eval:bg:pr`)と、Claude に対する直接の `query()` 呼び出しに必要です。 |
| `GSTACK_OPENAI_API_KEY` | `lib/conductor-env-shim.ts` | Conductor が注入するフォールバック。正式名の値が空のとき、`OPENAI_API_KEY` に昇格されます。 |
| `GSTACK_ANTHROPIC_API_KEY` | `lib/conductor-env-shim.ts` | 上と同じパターンの Anthropic 版。 |

<a id="conductor--gstack_-env-vars"></a>
## Conductor + GSTACK_* の環境変数

[Conductor](https://conductor.build) のワークスペースの中で gstack を実行している場合、**Conductor は、ワークスペースの環境から `ANTHROPIC_API_KEY` と `OPENAI_API_KEY` を明示的に取り除きます。** `~/.zshrc` や `.env` に設定しても効果はありません。取り除かれるのは環境の継承のあとだからです。ワークスペースで使えるキーにするには、代わりに Conductor のワークスペースの環境設定で `GSTACK_ANTHROPIC_API_KEY` と `GSTACK_OPENAI_API_KEY` を設定してください。Conductor はこれらを手を加えずに通します。

`lib/conductor-env-shim.ts` が、gstack 側でこのギャップを埋めます。副作用としてインポートされると(`import "../lib/conductor-env-shim";`)、正式名のほうが見えていないサブプロセスに対して、`GSTACK_FOO_API_KEY` を `FOO_API_KEY` に昇格させます。このシムはすでに次の箇所に組み込まれています。

- `bin/gstack-gbrain-sync.ts`。`/sync-gbrain` が埋め込み用に OpenAI を使えるようにするため
- `bin/gstack-model-benchmark`。`--judge` の実行が、手動の環境変数の対応付けなしで動くようにするため
- `scripts/preflight-agent-sdk.ts`。有償 eval の認証のプローブが動くようにするため
- `test/helpers/e2e-helpers.ts`。有償 eval が Anthropic を見つけられるようにするため

有料の API を呼び出す、あるいは gbrain の埋め込みが必要な新しい TS のエントリポイントを追加する場合は、先頭に同じ 1 行のインポートを加えてください。コントリビューター向けのチェックリストは [CONTRIBUTING.md の「Conductor workspaces」](CONTRIBUTING.md#conductor-workspaces) を参照してください。

`bin/gstack-codex-probe` は bash で書かれており、これらを直接読みません。Codex CLI が管理する `~/.codex/` の認証に依存しています。

## セキュリティモデル

このスキルが扱うすべての秘密情報に対する1つのルール: **環境変数だけに置き、argv に渡さず、ログに残さず、こちらからディスクに書き込まない。** 永続化されるのは gbrain 自身の `~/.gbrain/config.json` だけで、モード 0600 です。これは gbrain の運用規律であり、こちらの規律ではありません。

**コードで強制されている項目:**

- `test/skill-validation.test.ts` の CI の grep テストは、`$SUPABASE_ACCESS_TOKEN` または `$GBRAIN_DATABASE_URL` が argv の位置に現れると、ビルドを失敗させます。
- `bin/gstack-gbrain-supabase-provision` に `--insecure`、`-k`、`NODE_TLS_REJECT_UNAUTHORIZED=0` が現れると、CI の grep テストが失敗します。
- プロビジョニングのヘルパーの先頭にある `set +x` により、デバッグのトレースから PAT が漏れることを防ぎます。
- テレメトリのペイロードには、列挙された分類値(シナリオ、インストールの結果、MCP のオプトイン、信頼のレベル)だけが含まれ、秘密情報を含みうる自由記述の文字列は含まれません。

**テストで強制されている項目:**

- `test/secret-sink-harness.test.ts` は、秘密情報を扱うすべてのバイナリを、埋め込んだ秘密情報とともに実行し、その秘密情報が取得されるすべての経路(stdout、stderr、`$HOME` 配下のファイル、テレメトリの JSONL)に現れないことを確認します。シードごとに4つの一致ルールを使います。完全一致、URL デコード後、先頭 12 文字の接頭辞、base64 です。
- 同じテストファイル内の陽性対照(positive control)は、対象となるすべての経路に意図的に秘密情報を漏らし、ハーネスがそれぞれを検出することを確認します。陽性対照がなければ、検出が甘いハーネスと正しく動くハーネスの区別がつかなくなります。

**それでも漏れうるもの**(v1 の正直な限界):

- `read -s` の外で、秘密情報を通常のチャットメッセージに貼り付けた場合、それは会話のトランスクリプトと、ホスト側のログに残ります。
- 漏えい検出ハーネスはサブプロセスの環境変数をダンプしません。`env >> ~/.log` のようなバイナリは検出を逃れます(v1 のどのバイナリもそうしていませんが、grep テストで防いでいます)。
- シェルの `HISTFILE` の挙動はシェル自身のものであり、こちらのものではありません。こちらのコードは秘密情報を argv に渡さないので、そこから履歴に残ることはありません。ただし、生の `curl` コマンドに自分で秘密情報を貼り付けることを止める仕組みはありません。

## トラブルシューティング

### インストール中の「PATH SHADOWING DETECTED」

インストーラがリンクしたものより前の PATH に、別の `gbrain` バイナリがあります。インストーラのバージョンチェックがこれを検出しました。次のいずれかで対処してください。

- 別のほうが不要なら、`rm $(which gbrain)` を実行する
- シェルの rc で `~/.bun/bin` を PATH の先頭に追加し、リンクされたバイナリが優先されるようにする
- `GBRAIN_INSTALL_DIR` に、シャドウしているバイナリのインストール先を設定して再実行する

その後、`/setup-gbrain` を再実行してください。

### 「直接接続の URL は拒否されました」

`db.<ref>.supabase.co:5432` の URL を貼り付けてしまった場合です。これらは IPv6 のみで、ほとんどの環境では失敗します。代わりに Session Pooler の URL を使ってください。Supabase のダッシュボードで、Settings → Database → Connection Pooler → **Session** → URI をコピーします(ポート 6543)。

### 自動プロビジョニングが 180 秒でタイムアウトする

Supabase のプロジェクトがまだ初期化中です。終了メッセージに ref が表示されています。少し待ってから、次を実行してください。

```bash
/setup-gbrain --resume-provision <ref>
```

スキルは PAT を再度尋ね、プロジェクトの作成を飛ばして、ポーリングを再開します。

### 「別の `/setup-gbrain` インスタンスが実行中です」

古いロックディレクトリが残っています。ほかのインスタンスが本当に動いていないと確信できる場合は、次を実行してください。

```bash
rm -rf ~/.gstack/.setup-gbrain.lock.d
```

その後、再実行してください。

### ポリシーファイルの「No cross-model tension」

`~/.gstack/gbrain-repo-policy.json` を、古い `allow` の値を使って手で編集しましたか?問題ありません。次回の読み取り時に、gstack が `allow` を `read-write` に自動で移行し、`_schema_version: 2` を追加します。stderr に 1 行のログが出ます。これは冪等で、結果は決定的です。

### `gbrain doctor` が「warnings」と言う

`/health` はそれを赤ではなく黄色として扱います。`gbrain doctor --json | jq .checks` で、どのサブチェックが警告になっているかを確認してください。典型的な原因は、リゾルバの MECE の重なり(スキル名の衝突)や、DB の接続がまだ設定されていないことです。

### `/sync-gbrain` は `OK` と報告するのに、`gbrain search` が意味的な結果を返さない

インポートの途中で埋め込みが失敗している可能性があります。シンボルのクエリ(`code-def`、`code-refs`)は埋め込みを必要としないため今も動きますが、`gbrain search "<terms>"` は劣化した BM25 の経路にフォールバックします。同期の出力に次のような行がないか確認してください。

```
[gbrain] embedding failed for code file <name>: OpenAI embedding requires OPENAI_API_KEY
```

対処は、再実行の前にプロバイダの API キーをプロセスの環境に入れることです。コードには `VOYAGE_API_KEY` が推奨されます(gstack は設定されていると PGLite を `voyage-code-3` にします)。そうでなければ、`OPENAI_API_KEY` が `text-embedding-3-large` にフォールバックします。素の Mac のシェルでは、呼び出す前に `~/.zshrc` からキーを読み込んでください。Conductor では、`lib/conductor-env-shim.ts` のシムが `GSTACK_ANTHROPIC_API_KEY` と `GSTACK_OPENAI_API_KEY` を正式名に自動で昇格させます。`VOYAGE_API_KEY` については、Conductor のワークスペースの環境に直接設定してください。すでにインポート済みのページの埋め込みを補うには、`/sync-gbrain --code-only` を再実行してください。

### `gbrain sync` がコミットハッシュで止まる — `FILE_TOO_LARGE`

ツリー内のファイルが、gbrain のハードリミットである 5 MB を超えています(`gbrain/src/core/import-file.ts` の `MAX_FILE_SIZE`)。よくある原因は、レスポンスのリプレイキャッシュ、キャプチャしたスクリーンショット、大きな JSON のフィクスチャです。gbrain はコード同期で `.gitignore` 形式の除外リストを参照しません。できることは、失敗を認めることだけです。

```bash
gbrain sync --source <source-id> --skip-failed
```

ウォーターマークは問題のあるコミットを越えて進みます。同じファイルが再び変更されると、また失敗するので、そのたびに再度スキップしてください。

### ZeroEntropy の埋め込みは 2026 年 9 月 4 日以降に動かなくなる

ZeroEntropy は Notion に買収され、そのホスト型 API は **2026 年 9 月 4 日** にサービスを終了します(新規登録はすでに停止されています)。`zeroentropyai` の埋め込みレシピで設定された gbrain は、その日以降もページのインポートは続けますが、埋め込みは黙って失敗します。ページは構造的にだけ入り、意味的な検索はできなくなります。連携(wireup)のヘルパーは、`~/.gbrain/config.json` にそのレシピの名前があると警告します。期限より前に、別のプロバイダ(`VOYAGE_API_KEY` による Voyage、または `OPENAI_API_KEY` による OpenAI)へ移行してください。詳細、セルフホストの注意点、移行の議論は [garrytan/gstack#2365](https://github.com/garrytan/gstack/issues/2365) を参照してください。

### PGLite → Supabase への切り替えがハングする

同じ Conductor の別のワークスペースにある gstack のセッションが、プリアンブルの `gstack-brain-sync` の呼び出しを通じて、ローカルの PGLite ファイルにロックをかけている可能性があります。ほかのワークスペースを閉じてから、`/setup-gbrain --switch` を再実行してください。タイムアウトは 180 秒に制限されているので、永遠に待つことはありません。

## なぜこの設計なのか

**なぜ二択の allow/deny ではなく、リモートごとの信頼の3択なのか?** 複数のクライアントを抱えるコンサルタントは、書き戻しなしの検索を必要とします。午前はクライアント A、午後はクライアント B の案件を担当するフリーランスの開発者は、A のコードから得た知見が、B が検索できるブレインに漏れることを許せません。read-only なら、それがきれいに解決します。

**なぜ gbrain を gstack に同梱しないのか?** gbrain は独立して活発に開発されている別のプロジェクトで、独自のリリースサイクル、スキーマのマイグレーション、MCP のインターフェースを持っています。同梱すると、gstack が gbrain の更新を制御しなければならなくなり、gbrain の改善がユーザーに届くのが遅くなります。別々でありながら連携している構成なら、それぞれが独自のペースで出荷できます。

**なぜ `gbrain init --non-interactive` を、フラグではなく環境変数で渡すのか?** 接続文字列にはデータベースのパスワードが含まれます。argv で渡すと、パスワードが `ps`、シェル履歴、プロセス一覧に残ります。環境変数で渡せば、秘密情報はプロセスのメモリの中だけにとどまります。gbrain は `GBRAIN_DATABASE_URL` と `DATABASE_URL` の両方をサポートしていますが、gbrain 以外のツールとの衝突を避けるために、前者を使っています。

**なぜ PATH のシャドウを、警告して続行するのではなく、失敗として止めるのか?** シャドウされた `gbrain` があると、以後のすべてのコマンドが、今インストールしたものとは別のバイナリを呼び出してしまいます。それは静かなバージョンのずれのバグで、数週間後に原因不明の機能の欠落として表面化します。セットアップのスキルの仕事は、動く環境を作ることです。壊れた環境へのインストールを拒否することが、セットアップのスキルとして正しい振る舞いです。

**なぜすべてのリポジトリを自動でインポートしないのか?** プライバシーとノイズのためです。触れたすべてのリポジトリを取り込む自動インポートのプリアンブルのフックは、(a) 業務のコードを、同意なしに共有ブレインへ漏らし、(b) 使い捨てのリポジトリで検索を散らかしてしまいます。リポジトリごとのポリシーにより、取り込みは明示的なリポジトリごとの決定になります。`/setup-gbrain` は現時点では自動インポートのフックをインストールしませんが、ポリシーのストアは、将来そうする場合にも互換性があるように作られています。

## 関連するスキルと次のステップ

- `/health`。GBrain の観点(doctor の状態、同期キューの深さ、最後のプッシュからの経過時間)を、0〜10 の総合スコアに含めます。gbrain がインストールされていないマシンでは、この観点は省略されます。gbrain を入れないという選択で減点されることはありません。
- `/gstack-upgrade`。gstack 自体を最新に保ちます。gbrain は独立してはアップグレードしません。gbrain はデフォルトで最新の HEAD にインストールされます。更新するには、gbrain のクローン(デフォルトは `~/gbrain`)で `git pull` を実行し、`/setup-gbrain` を再実行してください。再現性が必要なら、`gstack-gbrain-install --pinned-commit <sha>` で特定のコミットに固定できます。テスト済みの最低バージョンより古いインストールは拒否されます。
- `/retro`。メモリ同期が有効なら、週次の振り返りが gbrain から学びと計画を取り出し、マシンをまたいだ過去の履歴を振り返りで参照できるようにします。

`/setup-gbrain` を実行して、どれが定着するか試してみてください。
