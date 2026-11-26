# Memorable によるワークフローのメモリ(任意、サードパーティ)

同じ形の作業を Claude Code に頼むのが3回目になると、ゼロから始まってしまいます。同じファイルを読み直し、同じ検索をやり直し、先月自分が書いた修正に、また同じようにたどり着きます。**Memorable** は、タスクをどう行ったかを記録し、次に近い依頼が来たときにそれを返してくれる、サードパーティの CLI です。

gstack は Memorable をインストールも同梱もせず、依存もしません。gstack が追加するのは**ブリッジ**です。Memorable の `UserPromptSubmit` フックを、gstack 自身のフックマネージャ経由で登録し、gstack がほかのすべてのマシン外への送信先に与える保証で包みます。有効にするまではオフで、Claude Code 以外のホストでは動かず、Windows にはまだ対応していません。

## 得られるもの

- プロンプトのたびに、フックは Memorable に、過去のセッションで近いことがすでに解決されていないか尋ねます。もしあれば、その手順を、明確にラベル付けされた参考データとして注入します。
- gstack 側の明示的な同意キー `memorable_recall`。デフォルトはオフで、`gstack-egress grants` が取り消しコマンドとともに一覧表示します。
- ベンダーのバイナリに渡されるすべてのプロンプトの受領書。引き渡しの前に書かれます(`gstack-egress list --sink memorable-recall`)。受領書がなければ、引き渡しもありません。
- HIGH のティアのシークレットの事前スキャン。生きた形をした認証情報を含むプロンプトは、決して渡されません。
- 戻ってくるものに対する信頼のエンベロープと 8 KiB の上限。ベンダーがプロンプトをブロックしたり、gstack を装って発言したりすることはできません。
- ベンダーは、許可リストで定められた環境(セッションの API キーはなし)の中で、独自のプロセスグループの中で動きます。フックが終了したとき、タイムアウトしたとき、または Claude Code が途中で終了させたときには、そのグループ全体が殺されます。ベンダーが意図的に `setsid` で独自のセッションに分離したプロセスは、そのグループの外にあり、この保証の外にあります。これはベンダー自身の振る舞いに見える選択であり、gstack が防げるものではありません。
- 安定したインストール先への登録、`./setup` のたびの修復、`./setup --no-team` を生き延びること、`gstack-uninstall` による削除、そして Claude Code が `settings.json` を書き換えた後でも効くオフスイッチ。

## これではないもの

- 決定的なリプレイではありません。モデルが無視してもよい、想起されたガイダンスです。
- Aside やブラウザの自動化とは無関係です。
- プロセスの境界を越えた先までは、gstack の保証が及ぶ機能ではありません。`memorable` バイナリが、gstack がプロンプトを渡した後にすることはすべて、別のベンダーによるクローズドソースの npm パッケージに属します。

## 2つの同意は、互いを含意しない

| 同意 | 誰が設定するか | 何を制御するか |
|---|---|---|
| `memorable_recall`(gstack) | `gstack-memorable enable` / `disable` | gstack のフックが、そもそもプロンプトをベンダーのバイナリに渡すかどうか |
| Memorable 自身の同意 | あなたが実行する `memorable enable` / `disable` / `forget` | Memorable が手順を保存するかどうか。また、そのドキュメントによれば、セッションのトレースを抽出 API に送るかどうか |

gstack は、ベンダーの同意コマンドを実行することも、その状態を読むこともありません。`gstack-memorable enable` は、それらを表示するので、自分で実行するか確認できます。ブリッジをオフにすると、gstack の引き渡しが止まります。Memorable が、すでに持っているものをどう扱ってよいかは変わりません。

## gstack が渡すもの、そして gstack が証明できること

| コマンド | gstack がベンダーのバイナリに渡すもの |
|---|---|
| `gstack-memorable status`、`enable`、`disable` | 何もなし。バイナリが存在するかを確認するだけで、実行は決してしません。 |
| フック(ゲートが on の間、すべてのプロンプト) | Claude Code の `UserPromptSubmit` の JSON: `session_id`、`cwd`、`transcript_path`、`prompt`。バイナリはあなたの権限で動くので、あなたが読めるものなら何でも読めます。そのパスが指す transcript も含みます。 |

受領書は、まさにそのバイト列(数と sha256)を証明し、gstack が実際に実行した受け手の名前を記録します。`local:<path to the memorable executable>` です。受領書は、ベンダーのネットワーク活動を証明しませんし、証明することもできません。Memorable のドキュメントによれば、想起はローカルの語彙的な一致が外れた場合にのみ、スクラブされたタスクの行を API 経由で埋め込みます。また、キャプチャはツール名、許可リストに載った引数フィールド、そして200文字のタスクの行をアップロードします。これらはベンダーの主張です。このブリッジは、memorable-cli 0.5.18 のフックの契約に対してテストされています。ほかのバージョンについては、ベンダーの互換性の主張になります。

バイナリの環境は、あなたのセッションの環境ではなく、許可リストです。`PATH`、`HOME`、ユーザー名とシェル名、ロケール(`LANG`、`LC_*`)、一時ディレクトリ、標準のプロキシと TLS の変数(`HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY`、`SSL_CERT_FILE`、`SSL_CERT_DIR`、`NODE_EXTRA_CA_CERTS`)、`XDG_*` のディレクトリ、そしてすべての `MEMORABLE*` 変数だけです。`ANTHROPIC_API_KEY` も、`GSTACK_*` も、`CLAUDE_*` も届きません。その stderr は、redaction エンジンが HIGH または MEDIUM のティアの形(認証情報、メールアドレス、電話番号)を見つけた場合は、`hook-errors.log` に入りません。そのため、エラー時に入力をエコーするベンダーが、プロンプトをログにコピーすることはできません。受領書の `payload_class` は、`claude-user-prompt-json->local-vendor-cli` というトークンです。これは、プロンプトの JSON が、ローカルのベンダー実行ファイルに渡されたことを意味します。ネットワークの宛先は gstack にはわかりません(Memorable によれば、ローカルの想起が外れた場合の埋め込み API です)。

ゲートがオフのとき、または `MEMORABLE=0` が設定されているときは、フックは引き渡しを黙ってスキップします(拒否されたものはないので、何もログには残りません)。

次の場合は、引き渡しを拒否し、`~/.gstack/hook-errors.log` にレート制限された1行を書きます。

- ベンダーのバイナリがない。
- プロンプトに HIGH のティアの認証情報の形がある(生のバイト列と、デコードされた文字列の値の両方で確認するので、JSON エスケープされたキーでも見逃されない)、または 1 MiB より大きい。
- リポジトリのリモートごとの信頼ポリシーが `deny` か `read-only` である(セッションの作業ディレクトリで判断するので、ほかのリポジトリに触れるセッションは対象外になる)。または、そのポリシーをまったく調べられなかった(git がリポジトリを読めない、ストアが読めない)。その場合、調べが失敗したときは閉じる。
- 受領書が書けない、またはフックの 4.5 秒の予算が次のステップ(非常に大きなプロンプトのシークレットスキャン、またはベンダーの起動)を賄えない。

受領書に結果がない場合は、ホストがフックを殺したか、時間切れになったことを意味します。成功ではなく、不明として読んでください。`output-written` の結果は、gstack が Claude Code に注入させるために、エンベロープ付きのコンテキストを標準出力に書いたことを意味します。Claude がそれを使ったかどうかは、フックには知りようがありません。

## gstack がテストすること、そして Memorable の主張であること

gstack は、ブリッジを `test/gstack-memorable.test.ts`、`test/memorable-user-prompt-hook.test.ts`、`test/gstack-settings-hook-schema-aware.test.ts` でテストします。偽のベンダーに対して、上記のすべての拒否、受領書を引き渡しの前に書く順序、エンベロープと上限、環境の許可リスト、プロセスグループの停止、Claude Code がタグを取り除いた後の ID ベースの削除、スイープの除外、アンインストールの分岐、終了コードを確認します。プロセスの境界を越えた先、つまり Memorable が何を保存するか、どこに保存するか、何を送るか、`memorable disable` と `memorable forget` が何を消すかは、Memorable の主張であって、私たちのものではありません。

## 有効にする(3つのステップ。真ん中のステップはあなたが行う)

```bash
npm i -g memorable-cli          # the CLI, from npm, not from gstack
memorable login && memorable enable   # the vendor's account and the vendor's consent; only you can do these
gstack-memorable enable         # gstack's gate + the hook, at the stable install
```

`enable` は、ベンダーのバイナリがない場合、Memorable が自分のフックをすでに登録している場合(下記参照)、安定したインストールがこのブリッジを含んでいない場合(まず `./setup` を実行)、または `settings.json` が読めない場合に、拒否して何も変更しません。Claude Code は、現在のバージョンでは数秒以内に新しいフックを拾います。発火しない場合は、セッションを再起動してください。確認するには次を実行します。

```bash
gstack-memorable status
```

## Memorable がすでにフックを登録している場合

`memorable install-hooks` と `memorable start` は、同じ `UserPromptSubmit` フックを、gstack のテーブルの外にある Memorable 独自の名前で登録します(`memorable enable` はしません。この2つだけがします)。その場合、`enable` は2つ目のエントリを追加するのではなく、拒否します。2つのエントリがあると、フックはプロンプトごとに2回実行され、2回注入し、あなたの利用枠に対して2回キャプチャしてしまうからです。

gstack に任せるには、`~/.claude/settings.json` からそのエントリを削除して、`enable` を再実行してください。Memorable には、自分のフックを削除するコマンドはありません。

## オフにする

```bash
gstack-memorable disable
```

ゲートが先にオフになるので、エントリがまだ残っていても、次のプロンプトからオフになります。ゲートを通過済みのプロンプトは完了します。そのあと、gstack のエントリが識別情報(タグの有無を問わず)で削除され、両方の結果が検証されます。一部だけ失敗した場合は、ゼロ以外の終了コードで報告されます。Memorable 自身の同意と、保存されているものは変わりません。`memorable disable` はキャプチャを止め、`memorable forget` はすべてを拒否します。何を消すかは、Memorable のドキュメントに書かれています。

このエントリは、`gstack-uninstall` でも削除されます(その概要に記載されています)。また、`./setup --no-team` も生き延びます。これはチームモードのフックだけを取り除くためです。

## gbrain を使っている場合

Memorable は、ローカルのストアの代わりに、手順を自分の gbrain データベースに保存できます(`memorable init gbrain`。そのドキュメントによる)。それによって変わるのはベンダーがものを保存する場所だけで、このブリッジについては何も変わりません。このブリッジが渡すのは、ローカルの `memorable` バイナリへのプロンプトだけです。gstack の `/setup-gbrain` と `/sync-gbrain` は、これとは無関係です。

## トラブルシューティング

- **フックが一度も発火しない。** `gstack-memorable status` で、ゲートが `on`、「registered by gstack」と表示されるはずです。不一致の行が出た場合は、その指示に従ってください。すべて正しく見えるなら、Claude Code を一度再起動してください。既知の競合が1つあります。Claude Code は `settings.json` を独自のスケジュールで書き換えます。`enable` の最中に書き換えが入ると、gstack が `registered` と表示した後でエントリが消えることがあります。フックマネージャは排他的ではなく収束型なので、もう一度 `enable` を実行し(`unchanged` または `registered` と報告されるはずです)、`status` を確認してください。
- **何も想起されない。** `gstack-egress list --sink memorable-recall` に `output-written` または `injected=no` の結果を持つ受領書が出ていれば、引き渡しは行われています。`injected=no` は、ベンダーが何も返さなかったという意味です。`memorable status` と `memorable doctor` で、ログイン、同意、保存された手順を確認してください。
- **結果が `timeout` になる。** ベンダーが、許された予算(gstack 自身の作業の後、約4秒)を超えて時間がかかりました。通常はネットワークの問題です。
- **`hook-errors.log` に拒否の理由が出る。** `refused:redaction-high` は、プロンプトに認証情報の形があったという意味です。`trust policy ... deny or read-only` は、リポジトリが保護されているという意味です。`receipt-unwritable` は、`~/.gstack/security` が書けないという意味です。
- **`enable` が「stable install predates this bridge」と言う。** `./setup`(または `/gstack-upgrade`)を実行して、`~/.claude/skills/gstack` に登録されたフックが、実際に動くコードになるようにしてください。

## 正確な仕組み

`bin/gstack-memorable` が入口です。ベンダーの CLI を、`GSTACK_MEMORABLE_BIN`、次に `MEMORABLE_BIN`、次に `~/.memorable/bin/memorable`、次に `PATH` の順に解決し、どれも見つからない場合は、それらの名前を挙げたメッセージで拒否します。バイナリを実行することは決してありません。`enable` と `disable` の実行中はロックを保持し、まず以前の状態を記録し、失敗したときは、想定した状態ではなく、その記録した状態に戻します。

`hosts/claude/hooks/memorable-user-prompt-hook` は、登録されるコマンドです。`memorable-user-prompt-hook.ts` の上にある、失敗時は開く(fail-open)bash のシムで、上記のパイプラインを実行し、常に終了コード 0 で終わります。

登録は、5 秒のタイムアウト付きで `gstack-settings-hook ensure-event` を通ります。また、このフックはそのファイルの `KNOWN_HOOKS` テーブルに行を持つので、タグではなくコマンドで識別されます。その結果:

- `gstack-settings-hook list-items --event UserPromptSubmit --owned-by gstack-memorable` は、タグが残っているかどうかにかかわらず、このフックを表示します。`list-sources` はタグ付きのエントリしか表示しないため、表示されないことがあります。
- `prune-stale --repoint`(すべての `./setup` で実行される)は、古いパスを修復します。
- `./setup --no-team` は、その掃除の対象から除外します。`gstack-uninstall` は、それを削除します。
- `gstack-settings-hook rollback` は、最後の変更をファイル全体で元に戻すものであって、フック単位の取り消しではありません。

Windows: まだ対応していません。そこにはベンダーを囲い込むためのプロセスグループがないため、`enable` は拒否し、フックは終了コード 0 で終わります。TODOS.md で追跡しています。

## クレジット

この連携と、そのフックの契約は、[Advaiyt Sane](https://github.com/AdvaiytSane)(@AdvaiytSane)と [Nikhil Krishnaswamy](https://github.com/NIkhil-cmd-cmd)(@NIkhil-cmd-cmd)が、Memorable で作成しました(#2831)。同意、受領書、エンベロープ、封じ込めの各層は、レビューの中で追加されました。
