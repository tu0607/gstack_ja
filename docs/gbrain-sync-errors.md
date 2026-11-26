# gbrain-sync エラー早見表

`gstack-brain-*` が出力しうるエラーメッセージをすべて、問題・原因・対処とともに載せています。

コマンド出力の `BRAIN_SYNC:` の後ろのプレフィックス、またはバイナリ名で、このファイルを検索してください。

---

## `BRAIN_SYNC: brain repo detected: <url>`

**問題.** `~/.gstack-artifacts-remote.txt`(または別のマシンからコピーされた従来の `~/.gstack-brain-remote.txt`)はあるのに、`~/.gstack/.git` にローカルの git リポジトリがないマシンで作業しています。

**原因.** GBrain の同期は別のマシンで設定済みですが、このマシンではまだ gstack を復元していません。

**対処.**
```bash
gstack-brain-restore
```
これで `~/.gstack/` にリポジトリを取り込み、マージドライバを再登録します。

ここで復元したくない場合は、次のコマンドでヒントを非表示にできます。
```bash
gstack-config set artifacts_sync_mode_prompted true
```

---

## スキル開始時の `ARTIFACTS_SYNC: attention: ...`

**問題.** artifacts の同期が止まっているか、一部止まっています。スキル開始時には、問題ごとに固定の1行が表示されます。`ok` と `idle` のときは何も表示されません。どの行にも `gstack-brain-sync` の絶対パスが含まれています。原因、保留中のファイル、対処を確認するには `--status` 付きで実行してください。

| 状態 | 発生条件 | 注意行(`ARTIFACTS_SYNC: attention: ` の後ろ) | 対処 |
|---|---|---|---|
| `held` | シークレットスキャンが旗を立てたファイルを保留し、残りは同期した | `status=held held=<N>. The secret scan is holding back <N> file(s); everything else still syncs. See which files and how to fix them: <bin> --status` | スキャンに一致しないようファイルを編集する、または `<bin> --skip-file <path>`(恒久的。元に戻すには `--unskip-file <path>`) |
| `blocked` | 保留後の再スキャンでも旗が立ったため、何もコミットされなかった | `status=blocked. The secret scan flagged a file it could not hold back on its own, so nothing is syncing. See the fix: <bin> --status` | `--status` が示すファイルを編集するかスキップする、または `<bin> --drop-queue --yes` でバッチを消去する |
| `push_failed` | コミットはローカルに保存されたが、push に失敗した | `status=push_failed. Synced files are committed locally but the push failed; it retries at skill start. See the cause: <bin> --status` | `--status` が示す対処(多くは `gh auth status`) |
| `error` | ドレインがコミット前に止まり、キューは保持されている | `status=error. The last sync stopped before committing; the queue is kept and retried. See the cause: <bin> --status` | `--status` が示す原因: git のインデックスロック、コミットフック、`git add` の失敗 |
| `unknown` | ステータスファイルに、この表にないステータスコードが入っている | `status=unknown. The sync status file is unreadable. See it: <bin> --status` | `<bin> --once` を実行してファイルを書き直す |
| stale-push | `drainable` の件数が1以上なのに、24時間以上 push がない | `stale-push. Files are ready to sync but nothing has been pushed for over 24 hours. See why: <bin> --status` | `--status` が示す待機理由(一貫した世代を待っている連動グループ、`git add` の失敗) |
| case-collision | `case_names` が設定されている。artifact のパスが大文字・小文字の違いだけで異なり、ドレインはそれらの下にあるキュー済みファイルを保留している | `case-collision held=<N> names=<names>. Artifact paths differ only by letter case, which a Mac or Windows disk stores as one file; sync holds <N> queued file(s) under them and syncs everything else. Repair: https://github.com/garrytan/gstack/blob/main/docs/troubleshooting.md#artifact-case-collision. See the paths: <bin> --status` | 綴りを1つに揃える。手動での修復は [troubleshooting](troubleshooting.md#artifact-case-collision) を参照 |
| stale-drain | `last_drain_at` が24時間以上前で、キューにレコードが残っている | `stale-drain. The sync has not run for over 24 hours while files wait in the queue. See why: <bin> --status` | gstack のプロセスが動いていなければ `~/.gstack/.brain-sync.lock.d` を削除し、`<bin> --once` を実行する |

`<bin>` は絶対パスです。たとえば `~/.claude/skills/gstack/bin/gstack-brain-sync` です。正は `bin/gstack-brain-sync` の usage ヘッダーで、スキル開始時のテストもそこから生成されています。

**保留されたファイル.** シークレットスキャンがファイルに旗を立てると、そのファイル(と、決定ログとそのアクティブなスナップショットのような連動するファイル)だけが保留され、残りは同期されます。保留されたファイルはキューに残り、同期のたびに再スキャンされるので、編集すれば保留は自動的に解除されます。`--status` は `held` の下に保留ファイルを1つずつ挙げ、一致したスキャナのルール(一致したテキストは表示しません)、一緒に保留されたファイル(`dependents`)、そして両方の対処を示します。

1. **本物のシークレットの場合**: ファイルを編集して取り除きます。次のスキル実行で再スキャンされ、同期されます。
2. **誤検知で、決して同期したくない場合**:
   ```bash
   ~/.claude/skills/gstack/bin/gstack-brain-sync --skip-file <path>
   ```
   これでそのパスは今後の同期から恒久的に除外されます(連動するファイルの場合は、それに連動するファイルも止まります)。元に戻してパスを再びキューに入れるには:
   ```bash
   ~/.claude/skills/gstack/bin/gstack-brain-sync --unskip-file <path>
   ```
3. **バッチ全体を破棄して最初からやり直す場合**:
   ```bash
   ~/.claude/skills/gstack/bin/gstack-brain-sync --drop-queue --yes
   ```

**Git のインデックスロック.** git プロセスが書き込みの途中で強制終了すると、`~/.gstack/.git/index.lock` が残ります。同期は、これが10分より古ければ削除します。`~/.gstack` へ書き込むすべての gstack は、同じ同期ロックを先に取得するためです。新しいロックがある場合は、そこで git プロセスが動いているということなので、同期は `error` を報告し、次のスキル開始時に再試行します。

---

## `BRAIN_SYNC: push failed: auth.`

**問題.** リモートとの認証が期限切れになったか、認証情報がないため、git の push が拒否されました。

**原因.** 現在の認証情報ではリモートに到達できません。

**対処.** リモートに応じて認証を更新してください。

- **GitHub**: `gh auth status`(必要なら `gh auth refresh`)
- **GitLab**: `glab auth status`
- **その他**: `git remote -v` を実行し、SSH キーや認証情報ヘルパーを確認

認証を直したら、どれかスキルを実行すると自動で同期が再試行されます。

---

## `BRAIN_SYNC: push failed: <first-line-of-error>`

**問題.** 認証以外の理由で push が失敗しました。コロンの後ろに git のエラーの1行目が表示されます。

**原因.** ネットワークの問題、拒否された push(リモートの方が先に進んでいる)、サーバーの 500 エラー、リポジトリへのアクセス権の取り消しなどが考えられます。

**対処.** より詳しい情報は `~/.gstack/.brain-sync-status.json` を見るか、次を実行して git の完全なエラーを確認してください。
```bash
cd ~/.gstack && git status && git push origin HEAD
```
キューは push の試行後に必ず消去されますが、ローカルのコミットは残っています。次のスキル実行で push が再試行されます。

---

## `gstack: brain-sync push NOT sent — the egress receipt could not be written`

**問題.** 何もマシンの外に出る前に、push が拒否されました。brain-sync の push はすべて、送信の前に改ざん検知可能な受領書を egress 台帳(`~/.gstack/security/egress.jsonl`)に書き込みます。失敗時は閉じる(fail-closed)方式です。受領書を書けなかったため、何も送信されず、ローカルのコミットも作られず、キューは保持されます。次の実行でドレイン全体が再試行されます。`gstack-brain-sync --status` では、失敗の詳細として `EGRESS_RECEIPT_FAILED` が表示されます。

**原因.** `~/.gstack/security/` に書き込めない(受領書の書き込み処理は存在しなければ作成するので、存在しないこと自体は原因ではありません)、ディスクが満杯、または `GSTACK_HOME` が読み取り専用の場所を指している、のいずれかです。

**対処.**
```bash
mkdir -p ~/.gstack/security && chmod -R u+w ~/.gstack/security
```
その後、どれかスキルを実行する(または `gstack-brain-sync --once` を実行する)と再試行されます。台帳は `gstack-egress list` で確認でき、ハッシュチェーンは `gstack-egress verify` で検証できます。

---

## `gstack-artifacts-init: ~/.gstack/ is already a git repo pointing at: <url>`

**問題.** 既存のものと一致しないリモート URL で初期化しようとしました。このコマンドは上書きを拒否します。

**原因.** 別のリモートを指定して `gstack-artifacts-init` を既に実行しています。

**対処.** どちらかを行ってください。

- 既存のリモートを使う: `--remote` を付けずに `gstack-artifacts-init` を実行するか、一致する URL を指定する。
- リモートを切り替える: `git -C ~/.gstack remote set-url origin <url>`(コマンド自身が示す案内)、または先に `gstack-brain-uninstall` を実行してから、新しい URL で再初期化する。どちらもデータは削除されません。

---

## `Remote not reachable via SSH: <url>`

**問題.** 初期化時に、接続性を確認するため git リモートに到達できませんでした。

**原因.** URL の誤り、認証の欠落、またはネットワークの問題です。

**対処.** 手動で確認してください。
```bash
git ls-remote <url>
```
これが失敗する場合は、次を確認してください。
- URL の綴り
- GitHub: `gh auth status`
- GitLab: `glab auth status`
- プライベートネットワーク / VPN / DNS

---

## `Failed to create or find '<name>'. Try --remote <url>.`

**問題.** `gh repo create` による自動リポジトリ作成に失敗し、`gh repo view` でもリポジトリを見つけられませんでした。

**原因.** `gh` が未認証である、同じ名前のリポジトリが別の人の所有として既に存在する、または GitHub アカウントがクォータの上限に達している、のいずれかです。

**対処.**
```bash
gh auth status
```
未認証なら `gh auth login` を実行してください。リポジトリ名が衝突している場合は、別の名前を指定します。
```bash
gstack-artifacts-init --remote git@github.com:YOURUSER/custom-name.git
```

---

## `gstack-brain-restore: ~/.gstack/.git already points at <url>`

**問題.** 既存の git 設定と一致しない URL から復元しようとしました。

**原因.** 別のリモートで以前に初期化した、古い `.git` が残っています。

**対処.** `gstack-brain-uninstall` を実行してから、`gstack-brain-restore <url>` を再実行してください。

---

## `gstack-brain-restore: ~/.gstack/ has existing allowlisted files that would be clobbered`

**問題.** 復元しようとしていますが、`~/.gstack/` には上書きされてしまう learnings や plans がすでにあります。

**原因.** (a) このマシンに、同期前の gstack セッションから状態が蓄積している、または (b) 以前に失敗した復元で中途半端な状態が残っている、のいずれかです。

**対処(3つの選択肢).**

1. **このマシンの状態を新しい正とすべき場合**: 復元の代わりに `gstack-artifacts-init` を実行します。これは、このマシンの状態から新しい brain リポジトリを作ります。

2. **リモートを採用し、このマシンの状態を捨てる場合**: 先に `~/.gstack/projects/` をバックアップし、問題のファイルを削除してから、復元を再実行します。

3. **マージしたい場合**: これには自動マージがありません。同期がすでに有効になっている別のマシンで動いている gstack に、`~/.gstack/` から learnings を手作業でコピーし、そのうえでここに復元してください。

---

## `gstack-brain-restore: <url> does not look like a gstack-brain repo`

**問題.** クローンには成功しましたが、リポジトリに `.brain-allowlist` と `.gitattributes` がありません。

**原因.** gstack-brain ではないランダムな git リポジトリを復元先に指定したか、brain リポジトリから正規の設定ファイルが誰かに削除されています。

**対処.** URL を確認してください。正しければ、`gstack-artifacts-init --remote <url>` を実行して正規の設定を入れ直してください。

---

## `database host unreachable (<code> <host>); your gbrain config is unchanged. Fix: check network or VPN, then re-run /sync-gbrain.`

**問題.** `/sync-gbrain` が code、memory、dream の各ステージをスキップしたか、`/setup-gbrain` が `gbrain_local_status: db-unreachable` を報告しました。

**原因.** `~/.gbrain/config.json` で指定されたデータベースに、ネットワークエラーのため gbrain が到達できませんでした(オフラインのサンドボックスでの `ENOTFOUND` / `EAI_AGAIN`、停止中の VPN、拒否された接続やタイムアウトなど)。設定に問題があると分かっているわけではないので、gstack は設定に手を加えず、遅いタイムアウトの場合と同じように、ブレインを意識したスキルブロックをレンダリングしたままにします。

**対処.** ネットワーク(または VPN)を復旧させてから、次を実行します。
```bash
/sync-gbrain
```
`~/.gbrain/config.json` を脇に移動しないでください。その対処は `broken-db` / `broken-config` の場合だけのものです。

---

## 毎回の実行で出る `[memory-ingest] ERR: gbrain import accounted for N-1 of N staged page(s) ... Refusing to advance state`(`.claude` 形式のプロジェクト)

**問題.** このリリース以前は、ingest が、ドットで始まるスラッグ(例: `.claude`)のプロジェクトのページを含むバッチを、毎回の実行で拒否していました。

**原因.** gbrain のインポート走査は、ドットで始まるすべてのパスセグメントをスキップするため、ステージされたページが収集されませんでした。

**対処.** アップグレード後は何もする必要はありません。そのようなスラッグは `dot-claude` としてステージされるようになり、古い名前で記録された状態は新しい名前に対応づけられます。`/sync-gbrain` を一度実行すると、止まっていたページがインポートされます。

---

## `[memory-ingest] FAILED <path>: <error> (left un-stamped; retried next run)`

**問題.** `/sync-gbrain` のメモリステージで、gbrain が1つのステージ済みページを拒否しました(たとえば frontmatter が無効、またはページが大きすぎる場合)。

**原因.** `gbrain import` が、そのページをファイル単位の失敗として名指ししました(`--json` の `failures` リスト、または `Skipped <path>:` の行)。このリリース以前は、そのようなページは取り込み済みとしてマークされ、二度と再試行されませんでした。

**対処.** 何も失われていません。ページは取り込み済みとマークされず、毎回の実行で再試行されます。同じページが失敗し続ける場合は、エラーを読み、もとのソースファイルを修正してから `/sync-gbrain` を実行してください。

---

## `[memory-ingest] re-queued <slug>: not found in gbrain source <id> after import (retried next run)`

**問題.** gbrain はページがインポートされた(または変更がなかった)と言いましたが、インポート先のソースでそのページを見つけられなかったか、内容が異なっていました。

**原因.** 多くの場合、管理されたインポートが受け付けられたものの、まだ公開中である(gbrain の出力で `Pending:`)か、gbrain が名前を挙げずにスキップしたページです。

**対処.** 何もする必要はありません。次の `/sync-gbrain` で再びインポートされます。毎回繰り返す場合は、gbrain をアップグレードしてください(`gstack-gbrain-install`)。

---

## `[memory-ingest] ERR: gbrain reported N failure(s) it did not attribute to a staged page ... Refusing to advance state.`

**問題.** メモリステージが失敗し、何も取り込み済みとしてマークされませんでした。

**原因.** gbrain は、ステージされたページに帰属させられない失敗を数えました(同じ種類が5件を超えると、表示を止めるため)。そのため gstack は、どのページが取り込まれたかを判別できません。

**対処.** `/sync-gbrain` を再実行してください。3回連続で拒否されると、バッチは自動的に半分に分割され、gbrain がインポートできないページを見つけ出します。そのページは隔離され(次の項目)、残りはインポートされます。

---

## `[memory-ingest] quarantined <slug> (<source path>): gbrain refuses every batch that contains it (...)`

**問題.** 1つのページのせいで、gbrain がバッチ全体を拒否し続けていました。

**原因.** 3回連続でバッチが拒否された後、gstack はバッチを半分ずつインポートし、そのページを特定しました。ほかのすべてのページはインポートされています。

**対処.** ページは、ソースファイルが変わると自動的に再試行されます。今すぐ再試行するには、メッセージに示されたソースファイルを修正または削除してから、`/sync-gbrain` を実行してください。

---

## `[memory-ingest] reconcile: checked N, present M, re-queued K, not yet checked L (run again to continue)`

**問題.** エラーではありません。これはアップグレード後の一度きりの追いつき処理です。gstack は、取り込み済みとマークされていた transcript を再確認し、brain に存在しないものを再キューに入れます。これにより、古いバージョンで失われた transcript が再びインポートされます。

**原因.** 古いバージョンは、gbrain がスキップしたページを取り込み済みとしてマークしてしまうことがありました。アップグレードにより、reconcile が保留中であることが記録されます。その後、ingest の実行ごとに、完了するまで有限のバッチ(200 件)を確認します。

**対処.** 何もする必要はありません。`/sync-gbrain` を実行するたびに、前回止まったところから続行されます。今すぐ実行する場合や進捗を確認する場合は、次のとおりです。
```bash
gstack-memory-ingest --reconcile --dry-run   # report only
gstack-memory-ingest --reconcile             # re-check the next 200 (--limit N)
```
「not yet checked」は、検索が失敗したページ(gbrain がビジーまたは到達不能)を数えます。これらは不足とは扱われません。「unrecoverable」は、brain に存在せず、transcript ファイルももう存在しないページを数えます。状態ファイルは、各パスの前に `~/.gstack/.transcript-ingest-state.json.pre-reconcile.bak` にバックアップされます。

---

## `[memory-ingest] reconcile: not run (...)`

**問題.** reconcile のパスが要求されましたが、実行できませんでした。

**原因.** gbrain がインストールされていない、または `import` を備えていない。あるいは brain がリモート HTTP の brain である(そのページは brain の管理者が pull するためにステージされるので、ローカルで確認すべきものがない)。

**対処.** gbrain がない場合は `/setup-gbrain` を実行してから、`gstack-memory-ingest --reconcile` を実行してください。リモート HTTP の brain の場合は、何もする必要はありません。

---

## `[memory-ingest] ERR: another memory ingest (pid <N>) is writing <state file>; not run.`

**問題.** このパスではメモリステージが何もしませんでした。

**原因.** 別の ingest、reconcile、または `--request-reconcile` が、状態ロック(`~/.gstack/.transcript-ingest-state.json.lock`)を保持しています。既に存在しないプロセスが残したロックは、自動的に引き継がれます。

**対処.** もう一方の実行が終わるまで待ってから、`/sync-gbrain` を再度実行してください。

---

## `[memory-ingest] ERR: could not save ingest state <path>: <error>.`

**問題.** インポートの後で、メモリステージが失敗しました。

**原因.** 状態ファイルを書き込めませんでした(ディスクの空き不足、権限、またはそのパスに別のディレクトリがある場合)。実行は、進捗を記録したふりをせず失敗します。インポート済みのページは次の実行で再確認されますが、gbrain は変更のない内容をスキップするため、この再確認は軽い処理です。

**対処.** ディスクの空き容量を確保するか、`~/.gstack/` の権限を直してから、`/sync-gbrain` を実行してください。

---

## `[memory-ingest] kept N unattributed transcript(s) on this machine: the brain is remote (Postgres or HTTP), ...`

**問題.** `--include-unattributed` の transcript(git リモートのないセッション)はインポートされませんでした。

**原因.** リポジトリに帰属させられない transcript は、マシン内にのみ存在し、フェデレーションされないソース `gstack-transcripts-unattributed` にしか送られません。あなたの brain はリモートです(Postgres または Supabase の `database_url`、あるいはリモート HTTP の MCP brain)。そのため、送信するとマシンの外に出てしまいます。これらは取り込み済みとマークされず、公開可能な `~/.gstack/transcripts/` のステージングにも書き込まれません。

**対処.** それが望みであれば、何もする必要はありません。そのようなセッションを含めたい場合は、`origin` リモートを持つ git リポジトリの中から実行して、帰属させてください。

---

## `[memory-ingest] kept N transcript page(s) for <repo> on this machine: could not register gbrain source <id> (...)`

**問題.** あるリポジトリの transcript がインポートされませんでした。

**原因.** gstack は、リポジトリごとの transcript を、そのリポジトリ専用の gbrain ソース(`gstack-transcripts-...`、マシン内にのみ存在しフェデレーションされない)にインポートし、最初のインポートの前にそれを登録します。インストール済みの gbrain が `gbrain sources add` を拒否したため、ページはローカルに残り、取り込み済みのスタンプが付いていません。

**対処.**
```bash
gstack-gbrain-install      # upgrade gbrain
/sync-gbrain               # the pages import on the next run
```

---

## `curated artifacts pushed to git, but gbrain source <id> has 0 indexed pages. Fix: gbrain sync --source <id>, then re-run /sync-gbrain`

**問題.** git への push は成功したのに、`/sync-gbrain` のブレイン同期ステージが `ERR` になっています。

**原因.** push が移動させるのは、キュレーションされた artifact を git に載せることだけです。gbrain はそれらを別途インデックス化します。このマシンが管理する artifacts ソースはページ数が 0 と報告しているため、検索ではそこからの結果が何も返りません。このリリース以前は、ステージに「curated artifacts pushed」と表示されて合格していました。

**対処.**
```bash
gbrain sync --source <id>
/sync-gbrain
```
それでも 0 のままなら、`gstack-gbrain-source-wireup` でソースを登録し直してください。

---

## `[gbrain-sync] gbrain source <id>: path unavailable (<path>); gstack skips it.`

**問題.** gbrain のコードソースが、このマシン上にもう存在しないディレクトリを指しています。多くの場合、削除された Conductor のワークツリーです。gbrain の autopilot は、これで失敗し続けます。

**原因.** ワークツリーごとに `gstack-code-<repo>-<hash>` というソースが割り当てられます。ワークツリーを削除しても、ソースは残ります。gstack はこれを自動では削除しません。インデックス化されたページが、コミットされていない作業の唯一のコピーかもしれず、また、そのソースが brain を共有している別のマシンのものである可能性もあるためです。

**対処.** 内容を確認してから、gstack が消えたと証明できるものだけを削除してください。
```bash
gstack-gbrain-sync --prune-gone-worktrees --dry-run
gstack-gbrain-sync --prune-gone-worktrees
```
ソースは、そのパスが連続する2回の同期で存在しなかった場合、親ディレクトリが読み取り可能な場合、そのIDがこのホストとパスから再計算でき(つまりこのマシンが作ったものである)、かつリポジトリはまだ存在するがワークツリーを一覧に含まなくなっている場合にのみ削除されます。削除のたびに `~/.gstack/.gbrain-prune.log` に記録されます。同じリポジトリのメインのチェックアウトから実行してください。そうすると gstack がリポジトリを見つけられます。残されたものには理由が表示されます。そのようなソースを手で削除する場合は、確信がある場合に限り `gbrain sources remove <id>` を使ってください。

---

## `dream: skipped — the installed gbrain cannot run only the resolve_symbol_edges phase, and the full dream cycle costs about 35 minutes (LLM phases).`

**問題.** `/sync-gbrain --dream`(または `--full`)が、コールグラフを構築しませんでした。

**原因.** コールグラフに必要なのは gbrain の `resolve_symbol_edges` フェーズだけです。インストール済みの gbrain は、そのフェーズを単独では実行できません(`dream --phase` がない、またはそのようなフェーズがない)。また、gstack はもはや gbrain のフルメンテナンスサイクルを自分から起動しません。そのサイクルは約35分かかり、LLM のフェーズを含むためです。

**対処.**
```bash
gstack-gbrain-install          # upgrade gbrain, then:
/sync-gbrain --dream
```
または、時間があるときに、フルサイクルを自分で実行してください: `gbrain dream --source <id>`。

---

## `call graph for <source>: unknown: installed gbrain does not expose cycle_freshness`

**問題.** `/sync-gbrain` は、このリポジトリのコールグラフが一度でも構築されたかどうかを判断できないため、構築を提案しません。

**原因.** 答えは `gbrain doctor` の `cycle_freshness` チェックから得られます。gstack は現在、`gbrain doctor --json --scope=brain` からそれを読み取ります(以前使っていた `--fast` モードはそのチェックを飛ばすため、いつも「unknown」と答えていました)。インストール済みの gbrain は、そのチェックを報告しません。

**対処.**
```bash
gstack-gbrain-install          # upgrade gbrain
/sync-gbrain --dream           # or build the call graph now regardless
```

---

## `artifacts remote: restored <url> because <owner>/gstack-artifacts-<user> does not exist and <owner>/gstack-brain-<user> does`

**問題.** アップグレード中に一度だけ表示されます。`~/.gstack-artifacts-remote.txt` が、一度も作成されていないリポジトリを指していたため、artifact の push が失敗し続けていました。

**原因.** v1.27.0.0 のアップグレードは、裸のリポジトリ名を `gh repo rename` に渡しましたが、これは必ず失敗します。それでもリモートを新しい名前に書き換えていました。今回のアップグレードで、リモート(および `~/.gstack` の `origin`)が、実在するリポジトリを指すように戻されました。

**対処.** 必要な作業はありません。push は再び動作します。名前の変更を完了させるには:
```bash
gh repo rename gstack-artifacts-<user> --repo <owner>/gstack-brain-<user> --yes
GSTACK_MIGRATE_ASSUME_YES=1 bash ~/.claude/skills/gstack/gstack-upgrade/migrations/v1.27.0.0.sh
```
もし `could not confirm ... exists (gh is not installed or not signed in)` と表示される場合は、`gh auth login` を実行し、GitHub 上でリポジトリ名を確認してください。

---

## 同期されていないが、されるはず

**エラーではありませんが、よくある落とし穴です。** 次の順に確認してください。

1. `gstack-brain-sync --status` を実行し、モードが `off` になっていないか確認する。
2. `~/.gstack/.git` が存在するか確認する。
3. `gstack-config get artifacts_sync_mode` を実行する。値は `full` か `artifacts-only` であるべき。
4. 同期されると思っているファイルが allowlist に入っているか確認する。
   `cat ~/.gstack/.brain-allowlist`
5. プライバシークラスのフィルタ。モードが `artifacts-only` の場合、振る舞いに関するファイル(timelines、developer-profile)は意図的にスキップされる。

すべて正しく見える場合は、次を実行して、ドレインを強制してください。
```bash
gstack-brain-sync --discover-new
gstack-brain-sync --once
```
