# GBrain 同期によるマシン間のメモリ共有

gstack は、learnings、retros、CEO のプラン、設計ドキュメント、開発者プロファイルなど、`~/.gstack/` に多くの有用な状態を書き込みます。デフォルトでは、ノートパソコンを替えるとそれらはすべて失われます。**GBrain 同期**は、その一部を非公開の git リポジトリに push するので、メモリがマシン間で引き継がれ、GBrain からインデックス検索できるようになります。

## 得られるもの

- マシン A で作業し、マシン B でそのまま続けられる。
- learnings、plans、designs が GBrain で見える(GBrain を使っている場合)。
- 綺麗に抜けられる出口(`gstack-brain-uninstall`)があり、データには一切触れない。
- デーモンなし、システムサービスなし、バックグラウンドプロセスなし。

## マシンの外に出ないもの

設計上、同期を有効にしていても、次のものはローカルに留まります。

- 認証情報: `.auth.json`、`auth-token.json`、`sidebar-sessions/`、`security/device-salt`
- マシン固有の状態: Chromium のプロファイル、ONNX モデルの重み、キャッシュ、eval-cache、CDP-profile、一回限りのプロンプトのマーカー(`.welcome-seen`、`.telemetry-prompted`、`.vendoring-warned-*` など)
- 質問の設定: マシンごとの UX 設定(`question-preferences.json`、`question-log.jsonl`、`question-events.jsonl`)。

正確な allowlist は `~/.gstack/.brain-allowlist` にあります。CLI がこれを管理しますが、マーカー行の下に自分のエントリを追加できます。

## 初回セットアップ(30〜90 秒)

```bash
gstack-artifacts-init
```

このコマンドは次のことを行います。

1. `~/.gstack/` を git リポジトリにする。
2. リモート URL を尋ねる(デフォルトは `gh repo create --private gstack-artifacts-$USER`)。どの git リモートでも使えます。GitHub、GitLab、Gitea、セルフホストのものなどです。
3. 設定だけを含む初回コミットを push する。
4. `~/.gstack-artifacts-remote.txt` を書き出す(URL のみで、秘密情報は含まない。別のマシンにコピーしても安全)。
5. brain ホスト用の `gbrain sources add` の接続コマンドを表示する(自動では実行されません。自分で実行するか、自分のマシンでは `bin/gstack-gbrain-source-wireup` が同じ接続を行います)。これにより `gbrain search` で、同期された learnings、plans、designs を検索できるようになります。古い `gstack-brain-reader add --ingest-url ...` による HTTP の経路は、v1.15.1.0 で削除されました。それは gbrain が一度も出荷しなかった `/ingest-repo` エンドポイントに依存していたためです。

初期化の後、**次に実行するスキル**が、プライバシーモードについて1つだけ質問します。

- **allowlist のものをすべて同期(推奨)**: learnings、reviews、plans、designs、retros、timelines、開発者プロファイルのすべてが同期されます。
- **artifacts のみ**: plans、designs、retros、learnings のみ。振る舞いに関するデータ(timelines、開発者プロファイル)はスキップします。
- **辞退**: すべてをローカルに保ちます。後で `gstack-config set artifacts_sync_mode full` で同期を有効にできます。

回答は保存され、二度と尋ねられません。

## マシン間のワークフロー

マシン A では、`gstack-artifacts-init` を一度実行するだけです。それ以降、スキルを実行するたびに、開始時と終了時に同期キューがドレインされます(スキルごとに約 200〜800 ミリ秒のネットワーク待ち時間が発生します)。

マシン B では:

1. マシン A の `~/.gstack-artifacts-remote.txt` を、マシン B にコピーする(パスワードマネージャー、dotfile リポジトリ、USB メモリなど、お好きな方法で。従来の `~/.gstack-brain-remote.txt` という名前も引き続き認識されます)。
2. gstack のスキルを何か実行する。preamble が URL ファイルを見つけ、次を表示します。
   ```
   BRAIN_SYNC: brain repo detected: <url>
   BRAIN_SYNC: run 'gstack-brain-restore' to pull your cross-machine memory
   ```
3. `gstack-brain-restore` を実行する。これでリポジトリがクローンされ、learnings、plans、retros が復元され、git のマージドライバが再登録されます。
4. 次のスキル: マシン A で昨日書いた learning が表示されます。ここがこの仕組みの醍醐味です。

## ステータス、健全性、キューの深さ

```bash
gstack-brain-sync --status
```

表示される内容: ステータス(`ok`、`idle`、`held`、`collision`、`blocked`、`push_failed`、`error`)、シークレットスキャンで保留されたファイルとその対処、パスが別のパスと大文字・小文字の違いだけであるため保留されたファイル(`case_held`、`case_names`。[troubleshooting](troubleshooting.md#artifact-case-collision) を参照)、`drainable` の件数、最後の同期と push の時刻、保留中のキューの深さ、現在のプライバシーモード。

スキルを実行するたびに、preamble の出力の上のほうに `ARTIFACTS_SYNC:` の行が表示されます。同期が止まっている場合は、`ARTIFACTS_SYNC: attention:` の行が追加されます。その行の一覧と対処は [gbrain-sync-errors.md](gbrain-sync-errors.md#artifacts_sync-attention--at-skill-start) にあります。

## プライバシーモードの詳細

| モード | 同期される内容 |
|------|------------|
| `off` | 何も同期しない(デフォルト)。 |
| `artifacts-only` | Plans、designs、retros、learnings、reviews。timelines と開発者プロファイルはスキップします。 |
| `full` | allowlist のすべて。振る舞いに関する状態を含みます。 |

いつでも次のコマンドで変更できます。
```bash
gstack-config set artifacts_sync_mode full
gstack-config set artifacts_sync_mode off
```

## 削除・移動されたファイル

デフォルトでは、同期は削除を公開しません。同期済みの設計ドキュメントを削除したり、プロジェクトのディレクトリを移動したり(プロジェクトのスラッグ移行でも起こります)すると、古いパスはリモートに残り、brain は新しいコピーと並べてそれも索引化し続けます。削除も公開するには、次を実行します。

```bash
gstack-config set artifacts_sync_removals on
```

この設定の下では、各同期で、ディスク上にもうない同期済みファイルの削除がコミットされます。トランスクリプトのページは対象外です。決定ログとそのアクティブなスナップショットは、常にセットで扱われます。一度に20件を超えるファイルを削除しようとする同期は、そのどれも公開しません。それは片付けではなく、データの消失に見えるからです。設定にかかわらず、それらは自分で確認して公開してください。

```bash
gstack-brain-sync --publish-removals        # list them
gstack-brain-sync --publish-removals --yes  # commit and push their removal
```

## シークレットの保護

すべてのコミットは、マシンを出る前に、認証情報の形をした内容がないかスキャンされます。ブロック対象のパターンには次が含まれます。

- AWS のアクセスキー(`AKIA…`)
- GitHub のトークン(`ghp_`、`gho_`、`ghu_`、`ghs_`、`ghr_`、`github_pat_`)
- OpenAI のキー(`sk-…`)
- PEM ブロック(`-----BEGIN …-----`)
- JWT(`eyJ…`)
- JSON 内の Bearer トークン(`"authorization": "…"`、`"api_key": "…"` など)

スキャンに引っかかった場合、旗の立ったファイル(と、それに連動するファイル)だけが保留され、残りは同期されます。保留されたファイルはキューに残り、同期のたびに再スキャンされます。スキル開始時には次のように表示されます。

```
ARTIFACTS_SYNC: attention: status=held held=1. The secret scan is holding back 1 file(s); everything else still syncs. See which files and how to fix them: <bin> --status
```

対処方法:

1. `gstack-brain-sync --status` を実行する(その行には絶対パスが表示されます)。`held` の下の各項目には、ファイル、スキャナのルール、両方の対処が表示されます。
2. 同期したくないコンテンツに対する誤検知であれば、`gstack-brain-sync --skip-file <path>` を実行して、そのパスを恒久的に除外する。`gstack-brain-sync --unskip-file <path>` で元に戻せます。
3. それ以外の場合は、ファイルを編集してシークレットを取り除く。次のスキル実行で同期されます。

`~/.gstack/.git/hooks/pre-commit` には、多層防御のフックがあります。リポジトリに対して手動で `git commit` した場合も、同じスキャンが実行されます。

別途(v1.63.0.0 以降)、すべての push は、何かが送信される*前に*、改ざん検知可能な受領書を egress 台帳(`~/.gstack/security/egress.jsonl`)に書き込みます。失敗時は閉じる方式です。受領書を書けなければ、push は拒否され、キューは保持されます。台帳は `gstack-egress list` で確認でき、ハッシュチェーンは `gstack-egress verify` で検証できます。

## 2台のマシンでの競合

マシン A とマシン B で同じ日に書き込むと、どちらも追記コミットを push します。git のデフォルトでは、ファイル末尾で競合しますが、`.jsonl` ファイルと markdown ファイルには独自のマージドライバが登録されています。

- JSONL ファイルは、ソートと重複排除のドライバを使い、ISO のタイムスタンプで追記を並べ替えます(決定的になるよう、タイムスタンプがない場合は各行の SHA-256 ハッシュにフォールバックします)。
- Markdown の artifact(retros、plans、designs)は、両側を連結する union マージドライバを使います。

競合の確認を求められることはないはずです。もし求められた場合(たとえば同じプランを2台のマシンで編集したなど、実際の意味的な競合)、git は停止して確認を求めます。

## マシン間の pull の頻度

preamble は、24 時間に1回 `git fetch` と `git merge --ff-only` を実行します(`~/.gstack/.brain-last-pull` でキャッシュされます)。これを気にする必要はありません。毎日最初にスキルを呼び出すときに、自動で行われます。

歴史的な注記(#2516): 以前の毎日の pull は `~/.gstack` 自体しか更新せず、gbrain が実際にインデックス化している `~/.gstack-brain-worktree` のデタッチされたワークツリーは更新していませんでした。そのため、次の setup-gbrain/sync-gbrain が実行されるまで、brain は古いページを黙って提供し続けていました。この修正以降、毎日の同期はブレインのワークツリーも進めます(`gstack-gbrain-source-wireup --advance-only`。`~/.gstack/.brain-worktree-last-advance` でスロットルされます)。進められなかった場合は、黙って失敗するのではなく警告を出し、汚れたワークツリーを強制的にリセットすることはありません。

## アンインストール

```bash
gstack-brain-uninstall
```

これは次のことを行います。

- `~/.gstack/.git/` と、すべての `.brain-*` 設定ファイルを削除する。
- `gstack-config` の `artifacts_sync_mode` をクリアする。
- learnings、plans、retros、開発者プロファイルには一切触れない。

非公開の GitHub リポジトリも削除する場合は、`--delete-remote` を追加してください(GitHub のみ。`gh repo delete` を使います)。

いつでも `gstack-artifacts-init` で再初期化できます。

## トラブルシューティング

gstack-brain が表示しうるエラーメッセージの一覧と、それぞれの問題・原因・対処は [gbrain-sync-errors.md](gbrain-sync-errors.md) を参照してください。

## 内部の仕組み

この機能の背後にある設計判断は次のとおりです。拒否リストよりも許可リスト(未知のファイルはデフォルトでローカルに留まる)、デーモンよりも preamble の境界での同期(面倒を見るべきバックグラウンドプロセスがない)、同時に動くマシンのキューを和集合にできる JSONL マージドライバ、そして何かが同期される前に一度だけ確認するプライバシーのゲートです。
