# gstack のメモリ取り込み — 何をするのか、何がローカルに残るのか、何ができるのか

これは、`/setup-gbrain` と `/sync-gbrain` にあるトランスクリプトとメモリの取り込み機能について、ユーザー向けにまとめた資料です。どちらかで、コーディングエージェントのセッションを gbrain に取り込むかどうかを尋ねられた場合、この資料で、それぞれの回答が何をするのかを説明しています。

## 何が取り込まれるのか

| ソース | 種類 | 場所 | 機密性 |
|---|---|---|---|
| Claude Code のセッション JSONL | `transcript` | `~/.claude/projects/*/` | 高 — ツールの入出力を含む会話の全文 |
| Codex CLI のセッション JSONL | `transcript` | `~/.codex/sessions/YYYY/MM/DD/` | 高 |
| Cursor のセッション SQLite (V1.0.1) | `transcript` | `~/Library/Application Support/Cursor/` | 同じ — V1.0.1 に延期 |
| Eureka ログ | `eureka` | `~/.gstack/analytics/eureka.jsonl` | 中 — あなたの気づき。多くは秘密情報ではない |
| プロジェクトの学び | `learning` | `~/.gstack/projects/<slug>/learnings.jsonl` | 中 |
| プロジェクトのタイムライン | `timeline` | `~/.gstack/projects/<slug>/timeline.jsonl` | 低 |
| CEO プラン | `ceo-plan` | `~/.gstack/projects/<slug>/ceo-plans/*.md` | 中 |
| デザインドキュメント | `design-doc` | `~/.gstack/projects/<slug>/*-design-*.md` | 中 |
| レトロ | `retro` | `~/.gstack/projects/<slug>/retros/*.md` | 中 |
| ビルダープロファイル | `builder-profile-entry` | `~/.gstack/builder-profile.jsonl` | 低 |

## トランスクリプト

キュレーションされたメモリ(学び、タイムライン、プラン、デザイン、レトロ、eureka、ビルダープロファイル)は、`/sync-gbrain` を実行するたびに同期されます。セッションのトランスクリプトは、共有すると決めた後にのみ同期されます。その選択は `transcript_ingest_mode` 設定キーで行い、必要に応じて `transcript_repos` の許可リストで絞り込めます。

| 値 | `/sync-gbrain` が取り込むもの |
|---|---|
| `recent` | 過去 90 日以内のセッション |
| `all` | 全履歴(`--full` ですべてのセッションファイルを走査) |
| `new@2026-10-03T17:00:00Z` | 最初のレコードがその UTC 時刻以降のセッションだけ。それより前に始まったセッションは、後から追記されても対象外のまま。開始時刻のないセッションも対象外 |
| `off` | トランスクリプトなし。それ以外のメモリは同期される |
| `recent+repos`、`all+repos`、`new@…+repos` | 同じ期間で、`transcript_repos` に含まれるリポジトリだけ。`+repos` は gstack が自分で追加・削除します |

対象となるのは、Claude Code のセッション(`~/.claude/projects/`)と Codex のセッション(`~/.codex/sessions/`)の両方です。対象は、現在のリポジトリだけでなく、ユーザーのリポジトリごとの信頼ポリシーが許可している、このマシン上のすべてのプロジェクトです。ページは、ブレインに入ります。local-stdio モードではローカルのエンジン(PGLite または Supabase)に、remote-http モードではリモートのブレインが取得する成果物のリポジトリに入ります。

設定や変更は次のように行います。

```bash
gstack-config set transcript_ingest_mode recent   # or all, or off
gstack-config set transcript_ingest_mode "new@$(date -u +%Y-%m-%dT%H:%M:%SZ)"   # only sessions from now on
gstack-config set transcript_repos github.com/acme/app,github.com/acme/api       # only these repos
gstack-config unset transcript_repos                                             # every repo again
gstack-config has transcript_ingest_mode && gstack-config get transcript_ingest_mode
bun run lib/transcript-consent.ts --describe                                     # the effective consent in words
```

`gstack-config set` は、それ以外の値を拒否し、保存されていた値を維持します。カットオフは `Z`(UTC)形式のみで、秒まで指定します。`transcript_repos` は、任意の git リモートの表記(`https://…`、`git@…:…`、末尾の `.git` の有無を問わない)を受け付け、正規化した形式で保存します。空のリストは拒否されます。許可リストを設定またはクリアすると、同じ書き込みで `+repos` のマーカーも更新されます。`gstack-config set transcript_ingest_mode <base>` は、許可リストが存在する間は `+repos` マーカーを維持します。`off` は、マーカーを決して持ち越しません。

**複数の設定ルート。** gstack が複数の状態ルート(例: `GSTACK_HOME` と `~/.gstack`)を読む場合、最も制限的な回答が優先されます。どこか一つのルートに `off` があれば、それは off の意味になります。最も遅いカットオフと、90 日の期間の両方が適用されます。許可リストは、すべてのルートの許可リストに含まれるリポジトリだけが対象になります。解決されたルート自体が同意を保持している必要があります。

**未設定。** 選択するまでは、トランスクリプトはスキップされます。同期のたびに、`--quiet` であっても、その旨を一行表示します。次に対話形式で `/sync-gbrain` を実行したとき、一度だけ質問されます。以前のゲートのバージョンの値(`A`〜`E`、`incremental`)や、このバージョンが認識しない値も、選択されていないものとして扱われ、再度質問されます。保存された `off` は、`--quiet` なしで `transcripts off (your choice)` と表示され、二度と質問されません。

**一回限りの上書き。** `--sources` のリスト(または `GSTACK_MEMORY_INGEST_SOURCES`)に `transcript` が含まれている場合、モードに関係なく、その実行ではトランスクリプトを取り込みます。同期は、モードの通知を依然として表示します。上書きによって、範囲を限定した同意が広がることはありません。`new@` のカットオフと `transcript_repos` の許可リストは依然として適用されます。`--sources all`、空のリスト、または有効な種類を含まないリストは、上書きにはなりません。

```bash
bun run bin/gstack-gbrain-sync.ts --incremental --sources transcript
```

**各同期が何を伝えるか。** `--quiet` なしの場合、同期は同意の内容を言葉で表示します(期間またはカットオフ、最大三つのリポジトリ、同意の元になった設定ルート)。取り込みの概要では、理由別に対象外となったセッションの数を数えます。カットオフより前、開始時刻なし、許可リストにない、リポジトリポリシーで deny、の各理由です。`new@` の下で同期が何も取り込まなかった場合は、その旨と、次の同期で新しいセッションが現れることを表示します。

**中断されたインポート。** 同期が途中で中断され、次の実行の前にトランスクリプトの選択(モード、カットオフ、許可リスト)が変わっていた場合、次の同期は、再開せずにメモリを一度だけ最初からステージし直し、その旨を一行表示します。

**ステージされたページ。** `~/.gstack/transcripts/` にすでにステージされているトランスクリプトのページ(remote-http モード)は、モードが `recent`、`all`、`new@…` のいずれでもない間は待機します。それらはディスク上に残り、`gstack-brain-sync` によって push されません。ほかの成果物は、引き続き push されます。同意の範囲を絞り込んだ場合(後のカットオフ、小さい許可リスト)は、次の同期で、範囲外になったステージ済みのページを削除し、`removed N staged transcript pages outside the new scope` と表示します。再び範囲を広げると、元のセッションから再ステージされます。push の前に、`gstack-brain-sync` は未 push のコミットも確認し、同意の範囲外のページを含まないように書き直します(`removed N excluded transcript pages from unpublished sync commits`)。この削除は、ステージ済みと未 push のページだけが対象です。

**すでに取り込まれたトランスクリプトは残ります。** `off` に切り替えたり、範囲を絞り込んだりしても、新しい取り込みが止まるだけです。すでにブレインにあるページや、すでに push されたページは削除されません。それらはそちらで削除してください(下の「ページを削除する」を参照)。

**gstack をダウングレードする場合。** `new@` と `transcript_repos` より前の gstack は、それらの値を認識できないものとして扱い、トランスクリプトを自動では取り込みません。ただし、範囲の指定がない明示的なトランスクリプトの上書きは、今も尊重します。そのため、ダウングレードする前に、スクリプトから `--sources transcript` と `GSTACK_MEMORY_INGEST_SOURCES=transcript` を削除し、保留中の同期を完了させるか、`gstack-config set transcript_ingest_mode off` を実行してください。

## ローカルに残るもの

- **状態ファイル**(`~/.gstack/.gbrain-sync-state.json`、`~/.gstack/.transcript-ingest-state.json`、`~/.gstack/.gbrain-engine-cache.json`、`~/.gstack/.gbrain-errors.jsonl`)は、ED1(状態ファイルの同期の意思決定)に従い、ローカルのみです。ブレインのリモート経由では同期されません。

- **git のリモートが解決できないセッション**(`/tmp/` やスクラッチディレクトリなどで実行されたもの)は、デフォルトでスキップされます。取り込みヘルパーに `--include-unattributed` を渡すと、対象に含められます。

- **`deny` のトラストポリシーがあるリポジトリ**(`/setup-gbrain` の Step 6 で設定)は、スキップされます。そのリポジトリのコードもトランスクリプトも取り込まれません。

## リモートごとのトラストポリシー(deny / read-only)

トランスクリプトの取り込みは、コードのインポートと同じリモートごとの信頼ストアに従います(`~/.gstack/gbrain-repo-policy.json`。`gstack-gbrain-repo-policy` で管理)。各トランスクリプトの git リモートは、何かを書き込む前にこのストアと照合されます。

- **deny** — トランスクリプトはスキップされます(`skipped (policy deny)` と報告されます)。
- **read-only** — これもスキップされます。read-only は「検索は許可するが、ページの書き込みは決してしない」という意味で、トランスクリプトの取り込みはページを書き込むからです(`skipped (policy read-only)` と報告されます)。
- **read-write、またはエントリなし** — 通常どおり取り込まれます。
- **ストアが壊れている、または読めない** — 設定済みのポリシーを迂回せず、書き込みを行う前に取り込みを中止します。`gstack-gbrain-repo-policy list` でストアを確認してください。壊れている場合は、`/setup-gbrain` を再実行してください。

成果物(学び、プラン、レトロなど)は、ポリシーでフィルタされることは決してありません。ポリシーは git のリモートをキーにしており、成果物には git のリモートがないからです。

## 秘密情報のスキャン対象

秘密情報の境界となるのは `gstack-brain-sync`(プライベートな成果物リポジトリへの git push)です。これは、このマシンから内容が出る前に、独自のスキャナを実行します。ローカルの PGLite への取り込みは、すでにディスク上にプレーンテキストで存在する内容の露出範囲を変えるものではありません。

メモリの取り込み中のファイルごとの **gitleaks** スキャンは、v1.33.0.0 以降、**オプトイン**です(デフォルトではオフ)。再度有効にするには(大規模なトランスクリプトのコーパスでは、コールドの実行に約 4〜8 分追加されます)、次のいずれかを使います。

```bash
bun run bin/gstack-memory-ingest.ts --bulk --scan-secrets
# or
GSTACK_MEMORY_INGEST_SCAN_SECRETS=1 bun run bin/gstack-memory-ingest.ts --bulk
```

有効にすると、gitleaks は生の `.jsonl` ではなく、レンダリングされた各ページ、つまりインポートされる正確なマークダウンをスキャンします。対象は次のとおりです。

- AWS / GCP / Azure のアクセスキー
- ANTHROPIC_API_KEY、OPENAI_API_KEY、GitHub のトークン
- Stripe のキー、Slack のトークン、JWT のシークレット
- 一般的な高エントロピー文字列(しきい値は設定可能)

検出があったセッションは、部分的に黒塗りするのではなく、**完全にスキップ**されます。ソースのパスと検出件数はログに残りますが、秘密の値はログに残りません。スキップされた内容は `bun run bin/gstack-memory-ingest.ts --probe`(新規と更新の件数を表示)で確認するか、`/sync-gbrain --full` の実行中にヘルパーの出力を見ることで確認できます。

gitleaks がインストールされていない(macOS では `brew install gitleaks`、Linux では `apt install gitleaks` を実行)のに、それでも `--scan-secrets` を渡した場合は、ヘルパーが一度だけ警告を出し、スキャンできなかったファイルはすべてスキップされます。スキャンせずにインポートされることはありません。スキャンが途中で失敗した場合も同様です。スキップされたファイルは保留のままになり、次の実行で再試行されます。レポートが欠落している、または不正な形式の場合、16 MiB を超えるレポート、60 秒を超えるスキャンも、そのページをブロックします。レポートは、スキャン後に削除される非公開の一時ファイルに保存されます。

再開されたステージングも再度スキャンされます。これには、現在のソースの走査に含まれないファイルも含まれます。検出、不完全なスキャン、またはサポートされていないエントリがあると、再開されたインポート全体が、ゼロ以外の終了コードで拒否され、再試行のためにステージが保持されます。保存されたページによって、期待されるインポート件数が決まります。現在のレンダリング済みのソースと一致するページだけが、そのインジェスト状態を進めることができます。不完全または一致しないステージは、リカバリーのために残されます。

スキャンが要求されている場合、新規、再開、および永続的なパスはいずれも、ページのレンダリングに使われたソースのスナップショットにのみスタンプし、そのハッシュと更新時刻が変わっていない場合に限ります。増分チェックは、タイムスタンプが一致する場合でも、ハッシュを検証します。スキャンされたページは、アトミックに昇格させる前に、非公開のステージングに完全に書き込まれるため、部分的な書き込みが送信ページになることはありません。

`--no-write` はドライランです。ページを準備して件数を数えますが、何もインポートせず、インジェスト状態も変更しません。そのため、後の本番の実行は、対象となるすべてのページを依然としてインポートします。

## 保存先

ストレージの階層は、gbrain のエンジン(`/setup-gbrain` の実行時に設定)によって異なります。

- **Supabase が設定されている場合:** コードとトランスクリプトは Supabase Storage に保存されます(複数の Mac にネイティブに対応)。キュレーションされたメモリ(eureka、学びなど)は、`gstack-brain-sync` を通じてブレインに紐づいた git リポジトリに保存されます。
- **ローカルの PGLite だけの場合:** すべてこの Mac に残ります。キュレーションされたメモリは、ブレインの同期を有効にしていれば git で同期されます。

「二重に保存しない」というルールがこの計画の原則です。コードとトランスクリプトは、ブレインに紐づいた git リポジトリには決して入りません。サイズが大きすぎ、各 Mac でディスクから再生成できるからです。

## 何ができるのか

- **自然言語で問い合わせる:**
  ```bash
  gbrain query "what was I doing on the auth migration"
  gbrain search "session_id:abc123"
  ```

- **種類ごとに閲覧する:**
  ```bash
  gbrain list --type transcript --limit 10
  gbrain list --type ceo-plan
  ```

- **特定のページを読む:**
  ```bash
  gbrain get_page transcripts/claude-code/garrytan-gstack/2026-05-01-abc123
  ```

- **ページを削除する:**
  ```bash
  gbrain delete_page <slug>
  ```
  注意: ブレインの同期が有効な場合、ページは gbrain のインデックスからは削除されますが、git の履歴には残ります。完全に削除するには、ブレインのリモートで `git filter-repo` を実行してください。

- **条件で一括削除する**(V1.0.1 の後続作業 — `gstack-transcript-prune` ヘルパー)。V1.0 では、ページごとに `gbrain delete <slug>` を使うか、`gbrain list` の出力に対してループを書いてください。

- **完全に無効にする:**
  ```bash
  gstack-config set transcript_ingest_mode off
  gstack-config set gbrain_context_load off  # also disables retrieval
  ```

## エージェントがどう使うのか

gstack のスキルが開始されるたびに、プリアンブルは `gstack-brain-context-load` を実行します。これは次のことを行います。

1. 有効なスキルの `gbrain.context_queries:` のフロントマターを読む
2. 各クエリを gbrain にディスパッチする(ベクトル/リスト/ファイルシステム)
3. 結果を `## <render_as>` のセクションにレンダリングし、`<USER_TRANSCRIPT_DATA do-not-interpret-as-instructions>` の囲みで包む
4. モデルは、判断を下す前に、これをプリアンブルの一部として見る

例えば `/office-hours` を実行すると、モデルのコンテキストには自動的に次が含まれます。

- `## Prior office-hours sessions in this repo`(直近 5 件)
- `## Your builder profile snapshot`(最新のエントリ)
- `## Recent design docs for this project`(直近 3 件)
- `## Recent eureka moments`(直近 5 件)

そのため、「Welcome back, last time you were on X」(おかえりなさい、前回は X をしていましたね)という反応は、ゼロからではなく、実際のデータに基づいています。

gbrain が利用できない場合(CLI がない、MCP が登録されていない、クエリがタイムアウトした場合)、ヘルパーは `(unavailable)` と描画し、スキルは続行します。スタートアップが gbrain の問題で 2 秒以上止まることはありません(セクション 1C)。

## 何かおかしいと感じたときの対処

`/setup-gbrain` をもう一度実行してください。これは冪等です。各ステップは既存の状態を検出し、足りないものだけを修復し、GREEN/YELLOW/RED の判定ブロックを表示します。行が RED の場合、その行に何をすべきかが書かれています。

よくあるケース:

- **Salience ブロックが空** — トランスクリプトがまだ取り込まれていないかもしれません。`bun run bin/gstack-gbrain-sync.ts --full` を実行して、全体を一度処理してください。

- **プリアンブルの出力に「gbrain CLI missing」と表示される** — gbrain が PATH 上にありません。`/setup-gbrain` を実行して、インストールと接続を行ってください。

- **PGLite エンジンが壊れている(V1.5)** — V1.5 では、ブレインのリモートから原子的に再構築する `gbrain restore-from-sync` が提供されます。V1.0 では、手動で復旧してください: `cd ~/.gbrain && rm -rf db && gbrain init --pglite && gbrain import <brain-remote-clone-dir>`。

- **ページの内容が古い、または間違っている** — `gbrain delete_page <slug>` を実行し、ソースファイルがディスク上にまだあって変更されていなければ、`bun run bin/gstack-gbrain-sync.ts --incremental` を再実行してソースから再取り込みしてください。

## プライバシーと監査

- すべての `secretScanFile` の検出は、取り込み時に stderr にログされます。
- gbrain へのすべての put/delete は、`{ts, op, duration_ms, outcome}` の形式で `~/.gstack/.gbrain-errors.jsonl` に記録され、事後の追跡に使えます。
- `~/.gstack/.gbrain-engine-cache.json` は、どのストレージ階層(PGLite か Supabase か)が有効かを示します。
- ブレインの同期の git 履歴には、ユーザーの git の ID で、すべてのキュレーション済み成果物の push が記録されます。

トランスクリプトのページに秘密情報が含まれているのを見つけた場合(ファイルごとのスキャンがオフだった、または gitleaks が見逃した場合)、復旧の手順は次のとおりです。
1. `gbrain delete_page <slug>` — インデックスからすぐに削除します
2. 秘密情報をローテーションします(予防措置として、念のため必ず行ってください)
3. ブレインの同期が有効な場合: ブレインのリモートで `git filter-repo --invert-paths --path <relative-path>` を実行し、履歴から完全に削除します
4. 見逃しが gitleaks のルールの穴によるものだと思われる場合は、パターンとともに gitleaks の issue を立てるか、`~/.gitleaks.toml` にある gitleaks の設定を拡張してください。

## Path 4: Remote MCP の設定(v1.27.0.0 以降)

ローカルで gbrain を実行していない場合 — HTTP で `gbrain serve` を実行している、Tailscale、ngrok、社内 LAN を通じてアクセスできるチームメイトや別のマシンがある場合 — `/setup-gbrain` の Path 4 は、貼り付けるだけで済むフローです。

次のものを用意します。
- MCP の URL(例: `https://wintermute.tail554574.ts.net:3131/mcp`)
- ベアラートークン(ブレインの管理者が `gbrain access-token issue` で発行したもの)

`/setup-gbrain` が行うこと:
1. `gstack-gbrain-mcp-verify` で URL とトークンを検証します。失敗は三種類に分類され、それぞれ一行の修復のヒントが付きます。
   **NETWORK**(「Tailscale/DNS を確認してください」)、**AUTH**(「トークンをローテーションしてください」)、**MALFORMED**(「Accept ヘッダーの落とし穴 — `application/json` と `text/event-stream` の両方を渡してください」)。
2. ユーザースコープで MCP を登録します。
   ```
   claude mcp add --scope user --transport http gbrain "$URL" \
     --header "Authorization: Bearer $TOKEN"
   ```
3. ローカルへのインストール、ローカルの doctor、トランスクリプトの取り込み、フェデレーションされたソースの登録をスキップします。これら四つはすべて、Path 4 がインストールしないローカルの `gbrain` CLI を必要とするためです。
4. 任意で、GitHub または GitLab にプライベートな `gstack-artifacts-$USER` リポジトリを用意し、ブレインの管理者がブレインのホストで実行するための一行の `gbrain sources add` コマンドを表示します。

### トークン保存のトレードオフ

ベアラートークンは `~/.claude.json`(モード 0600)に保存されます。Claude Code は、すべての MCP サーバーの認証情報をここに保存します。`claude mcp add --header "Authorization: Bearer $TOKEN"` の実行中は、トークンが一時的にプロセスの引数(argv)に現れ、同時に動いている `ps` からは見えてしまいます(約 10 ミリ秒)。その時間は短いものの、ゼロではありません。

検討したが採用していない緩和策:
- **ヘッダーを標準入力または環境変数で渡す形式** — これなら argv の時間枠を閉じられます。ただし Claude Code v1.0.x の時点では、CLI はどちらも提供していません。提供されたら、`/setup-gbrain` の Path 4 は自動的にそちらに切り替わります。
- **キーチェーンへの保存** — 明示的に対象外です(トークンの常時の保存先である `~/.claude.json` が、すべての MCP の認証情報に対する既存の信頼の範囲です。キーチェーンに広げると、gbrain だけでなく、すべての MCP サーバーに影響します)。

### ブレインの管理者への連携に「常に表示する」理由

`gstack-artifacts-init` は、「Send this to your brain admin」とラベルの付いた `gbrain sources add` コマンドを、ユーザー自身がブレインの管理者である場合でも、必ず表示します(一貫した UX で、モードの検出による不安定さを避けるためです)。

以前の設計では、無害な(副作用のない)MCP の書き込み呼び出し(`add_tag` など)を使って、ユーザーのベアラーが管理者のスコープを持つかどうかを調べ、十分なスコープがあればソースの登録を自動で実行することが提案されていました。設計レビューでは、ページの書き込みができても、ソースの管理権限があることは証明されない、と指摘されました。これらは、まともな認証モデルでは別のスコープだからです。gbrain が次の二つを提供するまでは、

- ベアラーのスコープの一覧を返す `mcp__gbrain__whoami` の機能ツール、かつ
- 管理者スコープによる制限を伴う `mcp__gbrain__sources_add` の MCP ツール

誰がそのコマンドを実行する権限を持つかを知っているふりをするのではなく、常にコマンドを表示します。

### CLAUDE.md のブロック(Path 4)

local-stdio モードとは異なります。トークンは**決して** CLAUDE.md に書き込まれません(多くのプロジェクトは CLAUDE.md を git にチェックインしています)。このブロックには、URL、検証済みのサーバーバージョン、成果物のリポジトリの URL(用意した場合)、リポジトリごとのトラストポリシーを記録します。

```markdown
## GBrain Configuration (configured by /setup-gbrain)
- Mode: remote-http
- MCP URL: https://wintermute.tail554574.ts.net:3131/mcp
- Server version: gbrain v0.27.1
- Setup date: 2026-05-06
- MCP registered: yes (user scope)
- Token: stored in ~/.claude.json (do not commit; never written to CLAUDE.md)
- Artifacts repo: github.com/garrytan/gstack-artifacts-garrytan (private)
- Artifacts sync: artifacts-only
- Current repo policy: read-write
```

### トークンのローテーション

これはサーバー側で行います。検証が `AUTH` に当たった場合(例: ブレインの管理者がトークンをローテーションした場合)、ヘルパーは「rotate token on the brain host, re-run /setup-gbrain」(ブレインのホストでトークンをローテーションし、/setup-gbrain を再実行してください)と表示します。wintermute など、gbrain サーバーがある場所で次を実行します。

```
gbrain access-token rotate    # invalidates old, issues new
```

(スコープ付きトークンに関する gbrain 側の拡張要望を含む、Path 4 の完全なフローについては `gstack/setup-gbrain/SKILL.md.tmpl` を参照してください。それらの拡張により、V2 では gstack が自動でローテーションできるようになる見込みです。)
