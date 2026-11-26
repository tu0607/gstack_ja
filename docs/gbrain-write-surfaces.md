# gbrain の書き込み先: どこに何が入り、どう確認するか

このドキュメントは2種類の読者を想定しています。

1. **エージェント**: 計画系スキルが、コンパクトな `## Brain Context Load` や `## Save Results to Brain` のブロックをレンダリングすると、このドキュメントを参照します。gbrain を実際に使うときに、§Context Load または §Save Template をその場で読んでください。`gbrain` が PATH にない場合は、まるごと読み飛ばして構いません。
2. **人間**: 計画系スキルを実際の brain に対して実行した後、手動のプローブのセクションを使って、ページが確かに届いたかを確認してください。

## 何がどこに入るか

| ホストと検出状態 | 計画系スキルの SKILL.md に表示される内容 |
|---|---|
| どのホストでも、`gstack-config gbrain-refresh` が `gbrain_local_status: "ok"` を報告 | 圧縮された brain 対応ブロックがレンダリングされる。エージェントは実際に保存するときに、このドキュメントをその場で読む。計画系スキルごとに約 250 トークンのオーバーヘッド。 |
| どのホストでも、gbrain が検出されない | ブロックは生成時に抑止される。トークンのオーバーヘッドはゼロ。キャリブレーションのテイクは引き続きレンダリングされる(別のリゾルバで、ホストに依存しない)。 |
| GBrain または Hermes のホスト | 検出の結果にかかわらず、ブロックは常にレンダリングされる。これらのホストは gbrain 連携を第一級の関心事として出荷しているため。 |

`.gbrain-source` は、そのディレクトリから行われる**読み取りと書き込み**(`gbrain put` を含む)のソースを選択します。ストレージエンジンを選ぶものではありません。エンジンは `~/.gbrain/config.json` で別途設定されます。GBrain は、明示的な `--source` を最初に解決し、次に `GBRAIN_SOURCE`、次に最も近い信頼された `.gbrain-source`、そして登録されたパスとデフォルトソースのルールの順に従います。ページが想定外のソースに入った場合は、成功した `put` が意図したコーパスに届いた証拠だとみなす前に、有効なソースの選択を確認してください。

信頼ポリシー(`personal` と `shared`。エンドポイントのハッシュごと)が、自動 push と書き戻しを制御します。`gstack-config set brain_trust_policy@<endpoint-hash> personal` で設定します。ローカルの PGLite インストールは `personal` が自動で既定になります。リモート MCP のインストールは、`/setup-gbrain` のステップ 9.5 で確認を求めます。

## §Context Load(計画系スキルを実行するエージェントが読む)

開始する前に、関連するコンテキストを brain から検索してください。

1. ユーザーの依頼から **2〜4 個のキーワードを抽出**する。名詞、エラー名、ファイルパス、技術用語を選び、動詞や形容詞は選ばない。
   例: 「deploy の後にログインページが壊れている」なら、`login broken deploy` を検索する。
2. **検索**: `gbrain search "<keyword1 keyword2>"`。`[slug] Title (score: 0.85) - first line of content...` のような行が返ります。
3. **結果が少ない場合**(3件未満): 最も具体的なキーワード1つに広げて、もう一度検索する。それでも少なければ、brain のコンテキストなしで進める。
4. **上位3件を読む**: それぞれについて `gbrain get "<slug>"` を実行する。3件を超えて読むことはやめる。それ以降は効果が薄いため。
5. **コンテキストを使って**分析に役立てる。brain のページがあなたの考えを変えた場合は、出力で具体的な slug を引用する。

`gbrain search` がゼロ以外の終了コードを返した場合(gbrain が PATH にない、ネットワークの一時的な不調、スロットル)は、一時的な問題として扱い、brain のコンテキストなしで進めてください。その場で再試行しないでください。ユーザーが後でスキルを再実行できます。

## §Save Template(実際に保存するエージェントが読む)

スキルを完了したら、出力を保存してください。コンパクトなリゾルバのブロックには、そのスキルに固有のスラッグのプレフィックス、タイトル、タグが既に示されています(例: `gbrain put "ceo-plans/<feature-slug>" ...`)。ページは自由形式のテキストなので、シェルのコマンド、ヒアドキュメント、引用符で囲んだ引数に入れることは決してしないでください。代わりに、リポジトリのルートに非公開のファイルを作り、ファイル書き込みツールでページをそこに書き込み、`gbrain put` に標準入力で読ませてください。

```bash
mkdir -p .gstack/tmp && mktemp .gstack/tmp/page.XXXXXX
```

表示されたファイルに、ページとして読まれるべき内容をそのまま書き込みます。

```markdown
---
title: "<Title>: <feature name>"
tags: [<tag>, <feature-slug>]
---
<skill output in markdown — the actual deliverable, not a summary>
```

次に保存します。`<page-file>` には表示されたパスを代入してください。

```bash
gbrain put "<slug-prefix>/<feature-slug>" < "<page-file>" && rm -f "<page-file>"
```

ファイルの書き込みが失敗した、または拒否された場合は、保存しないでください。原因を報告し、出力はユーザーのために残してください。

保存済みと報告する前に、**同じ作業ディレクトリとアカウント**から、ページを読み戻してください。

```bash
gbrain get "<slug-prefix>/<feature-slug>"
```

返されたページに、意図したタイトルと実質的な出力が含まれていることを確認してください。読み取りが失敗した場合、または別のページが返った場合は、保存を未検証として報告し、再試行のために出力を保持してください。永続化された結果だと主張しないでください。同じルールはエンティティのスタブにも適用されます。

**スラッグのガイド**: `<feature-slug>` は kebab-case、小文字で、プレフィックス内で一意であるべきです。抽象的なラベルより、具体的なプロジェクト名や機能名を優先してください。例: `security-fix` ではなく `auth-rate-limit`。

**タイトルのガイド**: 定型のプレフィックス(例: 「CEO Plan」「Eng Review」)は固定です。サフィックスは、機能やトピックの人間が読める名前です。

**タグのガイド**: 最初のタグは、スキルのメタデータにある定数の `<tag>`(例: `ceo-plan`、`eng-review`)です。2つ目のタグは `<feature-slug>` で、横断的にたどれるようにするためのものです。明らかな関係がある場合は、タグを追加してください(例: `[ceo-plan, auth-rate-limit, security]`)。

### エンティティのスタブ化

メインのページを保存した後、出力に登場する人名と組織名を抽出してください。それぞれについて:

```bash
# Check if a page exists first
gbrain search "<entity name>"

# If no match, create a stub from a private file you write with your
# file-write tool (same pattern as the page above)
mktemp .gstack/tmp/entity.XXXXXX
gbrain put "entities/<entity-slug>" < "<entity-file>" && rm -f "<entity-file>"
```

スタブのファイルには次の内容を入れます。

```markdown
---
title: "<Person or Company Name>"
tags: [entity, person]
---
Stub page. Mentioned in <skill name> output. Replace with real bio when relevant.
```

**実在する名前だけを抽出してください**。実在の人名(例: 「Garry Tan」)と、会社や組織の名前(例: 「Y Combinator」)だけです。製品名、機能名、セクションの見出し、技術用語(CSS のクラス名、関数名)、ファイルパスはスキップしてください。迷ったらスキップします。

人の場合は `tags: [entity, person]`、会社やチームの場合は `tags: [entity, organization]` です。

### エラー処理

- **スロットル**: 終了コード 1 で、stderr に `throttle`、`rate limit`、`capacity`、`busy` のいずれかを含む場合。保存を延期して先に進んでください。brain が混み合っているだけで、内容は失われず、今回の実行では永続化されないだけです。
- **それ以外のゼロ以外の終了コード**: 一時的な失敗として扱います。その場で再試行しないでください。ユーザーがスキルを再実行するか、gbrain 自体の設定が怪しいと思う場合は `gstack-config gbrain-refresh` を実行できます。
- **`gbrain: command not found`**: gbrain が PATH にありません。コンパクトなリゾルバのブロックは、スキップするよう指示していたはずなので、ここには到達しないはずです。もし到達してしまった場合は、黙ってスキップして続行してください。

### バックリンク

出力が別の brain ページを名前やトピックで言及している場合は、本文の最後にバックリンクの行を追加してください。

```
Related: [[other-page-slug]], [[another-slug]]
```

gbrain は `[[slug]]` の構文を、レンダリングされたページでクリックできるリンクに自動変換します。関係が具体的な場合にだけバックリンクを追加してください(例: 「この CEO プランは `eng-reviews/auth-rate-limit` にある eng レビューに依存している」)。つながりを捏造しないでください。

### 完了時のサマリー

スキルの最終出力では、brain の利用状況を1行で示してください。「Brain: read 3 pages, saved and read back 1 page, enriched 2 entity stubs, 0 throttles.」のように書きます。ページを保存済みと数えるのは、読み戻しが成功した後だけです。これにより、ユーザーは brain のカバレッジが時間とともに広がっていく様子を確認できます。

## 永続化の検証(自動)

「保存しようとしているデータが、実際に保存されているか」という対になった問いは、`test/skill-e2e-gbrain-roundtrip-local.test.ts` でカバーされています。これは分離された一時的な HOME に対して、実際の `gbrain init --pglite` と `gbrain put`、`gbrain get` を行うラウンドトリップです。定期実行のティアで、`VOYAGE_API_KEY` が設定されていない場合、または gbrain の CLI が PATH にない場合はスキップされます。

リゾルバに触れる PR を開く前に、次を実行してください。

```bash
EVALS=1 EVALS_TIER=periodic VOYAGE_API_KEY=$VOYAGE_API_KEY \
  bun test test/skill-e2e-gbrain-roundtrip-local.test.ts
```

計画系スキルを実際に実行した後に、自分の brain に対して手作業で確認したい場合(エージェントが保存すべきだったページのデバッグなど)は、次を使ってください。

```bash
gbrain get "<prefix>/<slug>"           # expect markdown + frontmatter
gbrain search "<slug fragment>"        # expect slug in top results
gbrain sources list                    # confirm gstack-brain-<user> source
gbrain get "entities/<person>"         # expect stub per named person
```

## Remote / Supabase / thin-client MCP のルーティング

リゾルバは、gbrain がサポートするすべてのエンジンで動く単一の CLI の形を出力します。`gbrain put "<slug>" < "<page-file>"` で、ページは標準入力で渡されます。CLI は、ユーザーの `~/.gbrain/config.json` に応じて、ローカルの PGLite、リモートの Supabase、またはリモート MCP エンドポイントに内部でルーティングします。**gstack はそのルーティングをテストしていません**。ストレージ層は gbrain が守るべき契約であり、ローカル PGLite に対してテストしているのと同じ CLI の呼び出しが、ほかのどのエンジンに対しても実行されるからです。

Supabase や thin-client MCP で書き込みが反映されない場合:

1. `gbrain doctor --fast --json` を実行する。エンジンの健全性チェックです。何かが `error` を報告したら、まずそれを直してください。
2. `gstack-config get brain_trust_policy@<endpoint-hash>` が自動書き込みのために `personal` である必要があります。現在のハッシュは `gstack-config endpoint-hash` で取得してください。`shared` の場合、エージェントは書き込みの前に確認を求めます。拒否した場合は、スキルを再実行してください。
3. 信頼ポリシーが `personal` で、`gbrain doctor` も問題ないのにページが見つからない場合は、gbrain に issue を立ててください。gstack の CLI の呼び出し形式は、T11(`gbrain-roundtrip-local`)が検証しているものと同じです。

## 自動化では検証していないこと

- **キャリブレーションのテイク(`takes_add`)**: 現在、これらは `gbrain put` の中のフェンスブロックへの書き込みにフォールバックしています。`BRAIN_CALIBRATION_WRITEBACK` が FALSE のままで、gbrain v0.42 以降で `takes_add` MCP 操作が出荷されるのを待っているためです。フラグが切り替わったら、このドキュメントのプローブを `/office-hours` に対して再実行し、`gbrain takes_list` が期待される重み(`scripts/brain-cache-spec.ts:151-157` によれば、office-hours では 0.9)とともに `kind=bet` のエントリを表示するか確認してください。
- **残り4つの計画系スキルのスキルごとの E2E**: 偽の CLI による E2E のカバレッジがあるのは `/office-hours` だけです(`test/skill-e2e-office-hours-brain-writeback.test.ts`)。リゾルバの単体テスト(`test/resolvers-gbrain-save-results.test.ts`)は5つすべての配線をカバーしています。スキルごとの E2E の拡張は TODOS.md で追跡されています。
- **`.gbrain-source` の書き込みの意味**: gstack は、文書化された読み取り専用の契約を重要なものとして扱いますが、gbrain の CLI が、そのピンに基づいて書き込みを再ルーティングすることがないかは独立には検証していません。もしそのような事例を見つけた場合は、それは gbrain のバグなので、上流に報告してください。
