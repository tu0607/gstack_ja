# コードインテリジェンス・プロバイダー契約

ステータス: 設計 + 最初の実装スライス
オーナー: メンテナが指示した社内作業
関連: `runtime/context.js`(Context.dev のプロバイダーパターン)、
`scripts/gstack2/browser-provider-contract.ts`(既存のプロバイダー契約の書き方)、
`lib/gstack-decision-semantic.ts`(失敗時に null を返す信頼性の契約)

## 問題

gstack には、約 1.7 万行の自前のコードインテリジェンス用の接着コードがあります。トランスクリプトの取り込み(`bin/gstack-memory-ingest.ts`、約 1,900 行)、統合の同期コマンド(`bin/gstack-gbrain-sync.ts`、約 1,600 行)、コンテキストの読み込み(`bin/gstack-brain-context-load.ts`)、3 段階の計画キャッシュ(`bin/gstack-brain-cache`)、ソースの突き合わせ、エンジン状態の分類、破壊的操作のガード、さらに約 15 個の `bin/gstack-gbrain-*` と `bin/gstack-brain-*` のエントリポイント、約 40 個のテストがあります。これらはすべて、直接の CLI 呼び出し(シェルアウト)で到達する外部ツール 1 つ(GBrain)を囲む独自の配線です。

自前のインデクサを維持し続けるつもりはありません。gstack が**小さく任意の契約**を定義し、外部のプロバイダーがそれを実装する形にしたい。インデックス作成、検索、グラフの処理はプロバイダー側に置き、gstack 側には持たせないようにします。

譲れない要件: **プロバイダーが OFF でも gstack は完全に機能しなければなりません。** ファイルだけで動く経路(決定事項のストア、コンテキストリカバリ、grep)は信頼性を保ち、プロバイダーの存在に依存してはいけません。これは既存の決定ストアの考え方です(`lib/gstack-decision.ts` は gbrain を一切 import しない。`lib/gstack-decision-semantic.ts` は null に縮退する)。この契約は強化であり、依存ではありません。

## 設計判断: ドキュメントストアではなくリポジトリ志向

決定済みです(蒸し返さないこと)。契約は**リポジトリ志向**です。

```
register_source(repo)   — required
refresh(source)         — required
search(query)           — required
status(source)          — required
```

`add` / `delete` / `export` は**任意の機能**で、プロバイダーが広告してもしなくてもかまいません。GBrain は広告します(そのネイティブの基本単位はスラッグによるドキュメント操作で、put/delete/get/export)。コード検索やコードグラフのツールは広告しません。

ドキュメントストア型の契約(add / delete-by-id / export を**必須**のオペレーションにする)は却下しました。コード検索ツールやコードグラフのツールを実態と違って見せてしまうからです。Sourcebot はリポジトリ全体をインデックスして検索を公開しますが、「ドキュメント ID X を削除する」という概念はありません。すべてのプロバイダーに文書の CRUD を実装させると、私たちが最も使いたいツール(リポジトリ全体のインデクサ、グラフツール)を除外してしまうか、必須の操作をうそで埋めることになります。「リポジトリを入れて、クエリで答えを出す」が、正直な共通の最小公倍数です。GBrain の文書の軸は、契約の形ではなく*任意の機能*として残ります。

## 契約

TypeScript で `lib/code-intelligence/contract.ts` に定義します。形は次のとおりです(抜粋)。

```ts
type CodeProviderCapability =
  | "register_source" | "refresh" | "search" | "status"   // required
  | "add" | "delete" | "export";                          // optional

interface CodeProvider {
  readonly id: "gbrain" | "sourcebot" | "graphify";
  readonly label: string;
  readonly capabilities: ReadonlySet<CodeProviderCapability>;
  readonly local: boolean;   // true = no repo content leaves the machine

  registerSource(repo: RepoRef, opts?: OpOptions): Promise<SourceStatus>;
  refresh(source: SourceRef, opts?: OpOptions): Promise<SourceStatus>;
  search(query: string, opts?: SearchOptions): Promise<CodeSearchHit[]>;
  status(source?: SourceRef, opts?: OpOptions): Promise<SourceStatus>;

  add?(doc: { slug: string; body: string }, opts?: OpOptions): Promise<SourceStatus>;
  delete?(slug: string, opts?: OpOptions): Promise<SourceStatus>;
  export?(source: SourceRef, opts?: OpOptions): Promise<string>;
}
```

すべてのプロバイダーは必須の 4 つのメソッドを実装しなければならず、実際に支えている機能だけを正確に広告しなければなりません(`assertRequiredCapabilities` が構築時に必須の 4 つを強制し、テストがそれを固定します)。任意のメソッドは、対応する機能を広告しているときに限って存在します。広告していない任意の操作を呼び出すと `CAPABILITY_UNSUPPORTED` を投げます。黙って何もしない、ということはありません。

### 型付きの失敗

`runtime/context.js` の `ContextError` の規律(閉じたコードの集合で、未知のコードを渡すとコンストラクタが例外を投げる)に倣います。

| コード | 意味 |
|------|------|
| `PROVIDER_UNAVAILABLE` | CLI/MCP の経路がない — ファイルだけの動作に縮退する |
| `PROVIDER_NOT_CONSENTED` | リポジトリのインデックス作成に同意がなく、内容がマシン外に出る |
| `CAPABILITY_UNSUPPORTED` | プロバイダーがこの操作を提供しない |
| `SOURCE_NOT_REGISTERED` | 操作には未登録のソースが必要 |
| `PROVIDER_TIMEOUT` | プロバイダーが操作のタイムアウトを超えた |
| `PROVIDER_ERROR` | プロバイダーは動いたが失敗した |

`PROVIDER_UNAVAILABLE` が最も重要です。呼び出し側はこれを捕捉する(またはピッカーの null 解決を使う)と、grep やファイルだけの動作にフォールバックします。致命的になることは決してありません。

### 同意

2 つの直交する同意の軸があり、どちらも明示的で、自動では与えられません。

1. **ネットワーク / 内容の外部送信の同意(リポジトリ単位)。** リポジトリの内容がマシン外に出る前に、インデックス作成はリポジトリごとに同意されていなければなりません。この契約は `registerSource` / `refresh` / `add` で強制します。`provider.local === false` かつ `opts.consented !== true` のとき、`PROVIDER_NOT_CONSENTED` を投げます。ローカルのプロバイダー(Graphify)はこの軸を飛ばします。マシン外に出るものがないからです。
2. **インストールへの同意(Graphify のみ)。** Graphify は自動インストールされることはありません。`options`/`status` の表示では、CLI が存在するときに限って利用可能と表示します。gstack は Graphify のインストーラを実行しません。インストールはユーザーの操作です(`pip install graphifyy && graphify install`)。

これは Context.dev のモデルと同じです。プロバイダーの選択は、外部送信の同意を与えないまま保存されます。外部送信には、別途の明示的な手順が必要です。

## プロバイダーごとの機能マトリクス

| 操作 | GBrain(最初に推奨) | Sourcebot | Graphify |
|----|--------------------------|-----------|----------|
| `register_source` | ✓ `sources add --federated` | ✓ 設定の config.json にローカルの `git` 接続を追加 | ✓ `graphify update <dir>`(ローカル、LLM なし) |
| `refresh` | ✓ `sync` + `sync --strategy code --full` | ✓ 自動(設定変更 + reindexIntervalMs) | ✓ `graphify update <dir>` |
| `search` | ✓ `gbrain search`(連合したコーパス) | ✓ `POST /api/search`(匿名アクセスならキーなしで可。Bearer キーは任意) | ✓ `graphify query "<q>" --graph <graph.json>` |
| `status` | ✓ `sources list` + page_count | ~ 部分的(サーバーの生存確認) | ~ 部分的(graph.json の有無 + ノード数) |
| `add` | ✓ `put <slug>` | ✗ 提供しない | ✗ 提供しない |
| `delete` | ✓ `delete <slug>` | ✗ 提供しない | ✗ 提供しない |
| `export` | ✓ `export` | ✗ 提供しない | ✓ `graphify-out/graph.json` を読む |
| `local`(外部送信なし) | いいえ(連合 DB) | ループバック → **はい**。リモートホスト → いいえ | **はい**(ローカルのみ) |

3 つとも、ランタイムから直接駆動します。MCP クライアントは使いません。

- **GBrain**(`garrytan/gbrain`、gstack エコシステムのツール): 契約に完全に合致します。既存の `gbrain` CLI の接点(`lib/gbrain-exec.ts`)から駆動します。ネイティブの基本単位はスラッグによるドキュメント操作(put/delete/get/export)に加え、リポジトリの軸(`sources add`/`sync`)です。7 つの機能すべてを広告します。**最初に推奨。**
- **Sourcebot**(`github.com/sourcebot-dev/sourcebot`、YC Fall 2025): セルフホストのリポジトリ全体に対する正規表現検索。Docker Compose で配備します(サーバー同梱 + Postgres + Redis。Docker を使わない正式な方法はありません)。`register_source` は、サーバーの `config.json` にローカルの `{ "type": "git", "url": "file:///path" }` の接続を追加します(設定が変わると再インデックスされます。ローカルのリポジトリには `remote.origin.url` が必要で、なければスキップされます)。`search` は `POST {baseUrl}/api/search`、`status` はそのエンドポイントを確認します。`add`/`delete`/`export` は提供しません。これは**ローカル**ツールで、インデックスされたコードはマシン上にとどまります。**API キーは任意**です。匿名アクセス(`FORCE_ENABLE_ANONYMOUS_ACCESS=true`)を有効にしたローカルのインスタンスは、キーなしで `/api/search` に応答します。アダプタは、キーが設定されているときだけ `Authorization: Bearer <SOURCEBOT_API_KEY>` を送ります。ループバックの `baseUrl` ならコンテンツはマシン上にとどまります(local=true)。リモートの場合は外部送信の同意が必要です。
- **Graphify**(`github.com/Graphify-Labs/graphify`、YC が支援): `graphify` CLI によるローカルの tree-sitter コードグラフ。アダプタは **`graphify update <dir>`** を使います。これはローカルで LLM を使わないビルドです(`graphify-out/graph.json` を書き出す)。LLM の抽出バックエンドを必要とし、API キーとネットワークが要る、素の `graphify <dir>` によるビルドは意図的に避けています。`graphify query "<q>" --graph <graph.json>` で検索します(`NODE ...`/`EDGE ...` の出力は、ファイルを `src=`/`at=` に持つ)。`export` はグラフの JSON を読みます。完全にローカルで、マシン外に出るものはありません。任意のツールで、**明示的なユーザー操作があるときだけインストール**します(`pip install graphifyy && graphify install`、Python 3.10 以上が必要)。自動インストールは決してしません。

**ローカルのインデックスという選択肢は提供しません**(意図的に除外)。素朴なローカルインデックスは結果の品質を落とします。本物のプロバイダーに振るか、ファイルだけの grep に振るのであり、中途半端な自前インデックスには振りません。

### 統合の接点(MCP は不要)

どのプロバイダーも、ランタイムから駆動できる接点を公開しています。そのため gstack は CLI のシェルアウトか、素の HTTP で駆動し、MCP を話すことはありません。

- **GBrain / Graphify: CLI。** シェルアウト(`spawnSync`)します。既存の gbrain の接着コードと同じ形で、同じ ENOENT → `PROVIDER_UNAVAILABLE` への縮退をします。
- **Sourcebot: HTTP + 設定ファイルの編集。** クエリには `POST /api/search`、リポジトリの登録にはサーバーの `config.json` の JSON 編集を使います。`fetch` は注入可能にし、テストは実際のサーバーなしでスタブに対して動きます。

Sourcebot と Graphify は、エージェント内で使うための MCP サーバーも提供しています。契約はそれに依存しません。CLI と HTTP の接点だけで、ランタイムからインデックスを作り、検索するには十分だからです。

## ピッカー: GBrain を最初に推奨

`lib/code-intelligence/picker.ts` と `selection.ts`。ユーザーは `gstack-code-intelligence select <provider>` でプロバイダーを選び、それは `$GSTACK_HOME/code-intelligence.json` に保存されます。`resolveSelectedProvider()` は、選択されたプロバイダーを構築するか、何も選ばれていないときは `null` を返します。これがプロバイダー OFF の経路で、呼び出し側は grep やファイルだけの決定ストアに縮退します。利用可能性は呼び出し時に確かめます。選択されたプロバイダーの CLI やサーバーがなければ `PROVIDER_UNAVAILABLE` を投げ、呼び出し側はそれを捕捉して縮退します。

`RECOMMENDED_ORDER` は静的な事実として **GBrain → Sourcebot → Graphify** を持ちます。GBrain は常に最初に推奨されます。`detectAvailable()` は、`options`/`status` の表示のために各プロバイダーを調べます(GBrain は実際の `localEngineStatus()` を通じて、Graphify は CLI/グラフの有無を通じて、Sourcebot は HTTP の生存確認を通じて)。ピッカーが推奨外のツールを黙って優先することはありません。

## 現在の GBrain の接着コードを、この契約でどう置き換えるか

契約が接合部になり、独自の接着コードはそこへ集約されます。対応関係は次のとおりです。

| 現在(独自実装) | 契約の下では |
|-----------------|--------------------|
| `bin/gstack-gbrain-sync.ts`(`sync`/`reindex-code`/`sources`) | `provider.registerSource` / `provider.refresh` |
| `lib/gstack-decision-semantic.ts` の `semanticRecall` | `provider.search`(スコープ付き)→ 同じく null に縮退 |
| `bin/gstack-brain-context-load.ts`(`query`/`list`) | `provider.search` / `provider.status` |
| `bin/gstack-memory-ingest.ts`(`import`、put) | `provider.add`(任意の機能。GBrain のみ) |
| `lib/gbrain-sources.ts`(`ensureSourceRegistered`、`probeSource`) | GBrain アダプタの内部 |
| `lib/gbrain-local-status.ts` | GBrain アダプタの利用可能性の確認(残して再利用) |
| `bin/gstack-gbrain-detect` / `-install` / `-source-wireup` / `-repo-policy` | プロバイダーのセットアップ + ピッカー + 同意(より薄く) |

目的は、約 1.7 万行を 1 つのコミットで削除することではありません。すべての利用側に契約を呼ばせ、独自の経路をプロバイダーごとに、契約の背後で退役させることです。「コードを検索するか、縮退するか」だけが必要な利用側は、GBrain の固有事項をまったく import しなくなります。

## ロールアウト

段階的に進め、各フェーズは独立して取り消せるようにします。スキルのテンプレートの変更は後のフェーズに回します。最初のスライスで `gen:gstack2` / パリティの再ベースラインの作業が発生しないようにするためです。

- **フェーズ 1(今回のスライス): 契約、3 つの実アダプタ、使える CLI。**
  `contract.ts` + 完全に駆動できる GBrain(CLI)、Graphify(CLI)、Sourcebot(HTTP + 設定)のアダプタ + 選択の保存 + `gstack-code-intelligence` CLI(`options`/`status`/`select`/`consent`/`index`/`search`)+ テスト。ユーザーは今日、プロバイダーを選び、リポジトリをインデックスして検索できます。スキルのテンプレートや生成ファイルはまだ変更しないので、`gen:gstack2` / パリティの再ベースラインは不要です。
- **フェーズ 2: 内部の利用側を契約経由にする。** `gstack-decision-semantic` と `gstack-brain-context-load` を `resolveSelectedProvider()` に向け、null への縮退を正確に保ちます。ファイルだけの経路の動作は変えません。
- **フェーズ 3: スキルで選択を見せる。** スキルがインデックス付き検索の恩恵を受ける場面でピッカーを出します。`context` コマンドのその場での同意の確認に倣います。スキルを再生成し(`bun run gen:gstack2`)、`bun run test:gstack2` を再実行して、パリティを意図的に再ベースラインします。
- **フェーズ 4: 独自の接着コードを退役させる。** すべての利用側が契約に載ったら、同期/取り込み/キャッシュのエントリポイントとそのテストを、プロバイダーごとに削除します。

## 実環境での検証

3 つのアダプタはすべて、隔離された環境で実際のツールに対して駆動されました(並列のエージェントが、それぞれ 1 つのワークツリーで作業)。3 つとも、実際のリポジトリをエンドツーエンドでインデックスし、検索できるようになりました。検証は 2 ラウンド行いました。1 ラウンド目の修正に、実際の実行でしか捕まらなかった誤りが含まれていたためです。ここに正直に記録します。

- **GBrain — 実際の Postgres + pgvector(Docker)、gbrain 0.42.56 — 証明済み。** デフォルトの pglite/WASM エンジンは macOS で壊れている(上流の garrytan/gbrain#223)ため、動作するレシピでは `DATABASE_URL` で実際の Postgres を指定します。実際のエンドツーエンドの検索で、本物のコード定義が返りました(`[0.88] src-checksum-ts … export statement computeChecksum`)。実際の実行で、私が導入した**回帰**が捕まりました。`--help` を誤読して `refresh` から `--strategy code` を削除したところ、コードが一切インデックスされなくなっていたのです(ドキュメントだけがインデックスされていた)。検証済みの 2 段階(`sync`、その後 `sync --strategy code --full`)に戻しました。グローバル検索には `--federated` の登録が不可欠です。以前に修正済みのこととして、エンジンが停止しているときは、`PROVIDER_ERROR` と WASM のスタックダンプではなく、`PROVIDER_UNAVAILABLE`(1 行のメッセージ)に縮退するようになりました。
- **Sourcebot — 実際の v6.5.0(Docker) — キーなしで証明済み。** エンドポイント、リクエストの本文、レスポンスの解析は、実際のサーバーに対して正しいことを確認しました。以前の誤った結論を訂正します。Sourcebot はローカルで使うのに API キーを**必要としません**。匿名アクセス(`FORCE_ENABLE_ANONYMOUS_ACCESS=true`)を有効にすると、`/api/search` がキーなしで応答します。キーを設定しない状態で、CLI から実際のヒットが返ることを確認しました。キーは任意のままです。修正したのはメッセージだけです(まず匿名アクセスを案内し、キーはその次の手段として案内)。また、ローカルのリポジトリにはインデックスのために `remote.origin.url` が必要だという注記を加えました。これはローカルのツールです(コードはマシン上にとどまります。`SOURCEBOT_TELEMETRY_DISABLED=true` を設定しない限り、起動時にテレメトリの ping が送られます)。
- **Graphify — 実際にインストール、graphify 0.9.23 — 証明済み。** 以前の誤った主張を訂正します。**コード**については、`graphify <dir>` と `graphify update <dir>` は、LLM の呼び出しなしで同一の AST グラフを作ります。LLM が行うのは、コミュニティのクラスタの名前を変えることと、コード以外のドキュメントを取り込むことだけで、ノードやエッジは 1 つも増やさず、私たちのパーサもその触るフィールドを捨てています。そのため、LLM のモードは意図的に設けず、`local=true` は正しいのです。アダプタは `graphify update` を使います。実際の `index` と検索で、正しい `file:line` の参照が返りました。修正したこととして、`search` はインデックスされたリポジトリのグラフ(保存されたルート)を読むようになり、`options` はインストール済みのプロバイダーを利用可能と報告するようになりました。

大きな教訓として、記録に残しておきます。`--help` の読み取りや 1 人のエージェントの結論は証拠になりません。実際にツールを動かすことが証拠です。1 ラウンド目の判断のうち 2 つ(gbrain のフラグ削除と graphify の LLM に関する主張)が、これで覆りました。

## この変更でしないこと

gstack 2 の正規の契約と CLAUDE.md の境界に従い、クラウドブラウザ、代替の iOS ドライバ、ローカルの画像モデル、プロバイダーのマーケットプレイス、ワークフローエンジン、**新しい状態データベース**は導入しません。Context.dev は、ウェブのコンテキストのために新たに認可された唯一の外部サービスのままです。この契約はコードインテリジェンスを扱い、それは別の軸です。既存の決定ストアとコンテキストリカバリはファイルだけで動き、プロバイダーに依存しないままです。

## テスト

`test/code-intelligence.test.ts`(19 テスト。実際のツールは使わない): 機能マトリクスの不変条件(すべてのプロバイダーが必須の 4 つを広告、文書の操作を広告するのは GBrain だけ。Sourcebot のループバックとリモートの違いを含む `local` フラグ)、結果のパーサー、選択の保存 + リポジトリごとの同意 + プロバイダー OFF(`null`)、同意のゲート(同意なしの非ローカル GBrain は `PROVIDER_NOT_CONSENTED` を投げる。ローカルの Graphify は免除)、偽の `gbrain` シムに対する GBrain アダプタ、偽の `graphify` シムに対する Graphify アダプタ(index でグラフを作り、search でヒットを返し、status でノード数を数える)、注入した `fetch` と一時的な `config.json` に対する Sourcebot アダプタ(register でローカルの git 接続を書き、search で `files[]` をヒットに対応づける)、そしてツールやサーバーがないときにすべてのアダプタが `PROVIDER_UNAVAILABLE` に縮退すること。`gstack-code-intelligence` CLI は、エンドツーエンドでスモークテストしました。select → 同意のゲート → ローカルの Graphify によるインデックス(5 ノードのグラフ)→ 検索。
