# Browser-Skills v1 — 繰り返すブラウザ操作の手順化

**ステータス:** フェーズ 1 は `garrytan/browserharness` で出荷済み。フェーズ 2〜4 は以下に列挙。
**最終更新:** 2026-04-26
**著者:** garrytan(/plan-eng-review と /codex による外部の視点のレビューを含む)

## 何であるか

Browser-skills は、繰り返されるブラウザ操作の流れを、決定的な Playwright スクリプトに落とし込んだタスクごとのディレクトリです。各スキルは次を持ちます。

```
browser-skills/<name>/
├── SKILL.md                        # frontmatter + prose contract
├── script.ts                       # deterministic logic
├── _lib/browse-client.ts           # vendored copy of the SDK
├── fixtures/<host>-<date>.html     # captured page for tests
└── script.test.ts                  # parser tests against the fixture
```

ユーザー(フェーズ 2 では、ちょうど操作をうまくこなしたエージェント)が、スキルを一度作成します。以降の呼び出しは、スクリプトを実行し、エージェントが `$B` のプリミティブで試行錯誤するのに費やす 30 秒の代わりに、200ms で JSON を返します。

同梱のリファレンスは `hackernews-frontpage` です。HN のトップページをスクレイピングし、30 件のストーリーを JSON で返します。`$B skill list` と `$B skill run hackernews-frontpage` を試してください。

## domain-skills(v1.8.0.0)との違い

- **Domain-skills** = 「エージェントがサイトについての事実を覚える」。ホスト名ごとの JSONL のノートで、セッション開始時にプロンプトへ注入されます。状態機械が、隔離 → 有効 → グローバル昇格を扱います。
- **Browser-skills** = 「エージェントが手順を決定的なスクリプトに落とし込む」。タスクごとのディレクトリで、`$B skill run` で実行され、デーモンのスコープ付きトークンによって、spawn ごとの権限を分離します。

両者は同じメンタルモデル(ホストごと、3 段階のスコープ)を使います。より大きな生産性の向上は手順のレイヤーにあります。スクレイピングやフォーム操作を、潜在的な推論から、再現可能なコードへ移すからです。

## 既存の P1(「`$B` コマンドの自己作成」)と異なる理由

元の P1 は、Codex の T1 への異論によってブロックされていました。エージェントが書いた TypeScript を、デーモンの**内部で**安全に実行することはできない、という指摘です(環境のグローバル、コンストラクタを悪用する手法、承認と実行の間の top-level await による TOCTOU)。正しい設計は「ケイパビリティを渡す IPC による、プロセス外のワーカーの隔離」でした。それは困難なプロジェクトで、出荷されないかもしれません。

Browser-skills は、スクリプトをデーモンの**外で**、独立した Bun プロセスとして実行することで、この問題全体を回避します。デーモンはスキルのコードを import も eval もしません。スキルは、あらゆる外部クライアントが使うのと同じワイヤーフォーマットで、ループバックの HTTP を介してデーモンと通信します。

承認された計画は、既存の P1 を置き換えます。

---

## フェーズ

| フェーズ | ブランチ | 範囲 |
|-------|--------|-------|
| **1** | `garrytan/browserharness` | SDK、ストレージ、`$B skill list/run/show/test/rm` のサブコマンド、スコープ付きトークンのモデル、同梱の `hackernews-frontpage` リファレンス。**出荷済み(v1.19.0.0、フェーズ 2a と統合)。** |
| **2a** | `garrytan/browserharness`(継続) | `/scrape <intent>`(読み取り専用、マッチ/プロトタイプの経路を持つ単一の入口)+ `/skillify`(プロトタイプを恒久的なスキルに落とし込む)。D3 のアトミック書き込みヘルパー `browse/src/browser-skill-write.ts` を追加。**v1.19.0.0 で出荷予定。** |
| **2b** | 新規(`browser-skills-automate`) | `/automate` スキルのテンプレート(`/scrape` の、変更を伴う操作版の兄弟)。`/skillify` と D3 ヘルパーを再利用。非codified の実行時には、変更ステップごとの確認ゲート。TODOS で P0。 |
| **3** | 新規(`browser-skills-resolver`) | セッション開始時のリゾルバー注入(ホストごとのブラウザスキル探索)。ドメインスキルの注入を踏襲。`gstack-config browser_skillify_prompts` のつまみ。 |
| **4** | 新規 | 評価テスト基盤(LLM ジャッジ)、フィクスチャの鮮度検出、ライブページに対する定期的な再検証、不審な spawn 向けの OS レベルのファイルシステム・サンドボックス。 |

---

## フェーズ 1 のアーキテクチャ

### 確定した決定事項(13 件)

1. **フェーズ 1 = ストレージ全体 + SDK + サブコマンド + 同梱リファレンス。** まだエージェントによる作成はない。フェーズ 2 で `/scrape` と `/automate` を入れる。
2. **フェーズ 2 の 2 つの動詞: `/scrape`(読み取り専用)と `/automate`(変更を伴う)。** どちらも skillify の承認ゲートの仕組みを共有するが、別々のスキルテンプレートとして存在する。
3. **TODOS.md の既存の「`$B` の自己作成」P1 を置き換える。** ユーザーに見える目標は同じで、デーモン内の隔離の問題がない。
4. **SDK の配布: 各スキル内の兄弟ファイル(Option E)。** 正規の SDK は `browse/src/browse-client.ts`(約 250 行)にある。各スキルは `<skill>/_lib/browse-client.ts` にコピーを持つ。フェーズ 2 の生成器は、生成されるすべてのスクリプトの隣に、現在の SDK をコピーする。各スキルは完全に自己完結している。ディレクトリごとどこへでもコピーでき、そのまま動く。バージョンのずれは起こり得ない(SDK は、スキルが作成された時点のバージョンに固定される)。ディスクの費用は、スキルあたり約 3KB。
5. **3 段階の探索: 同梱 → グローバル → プロジェクト。** 同梱のスキルは、gstack のインストールに含まれて読み取り専用で配布される(`<gstack-install>/browser-skills/<name>/`)。グローバルは `~/.gstack/browser-skills/<name>/`。プロジェクトごとは `<project>/.gstack/browser-skills/<name>/`。探索は、プロジェクト → グローバル → 同梱の優先順で各段階を調べ、最初にヒットしたものが採用される。**`$B skill list` は、各スキル名と一緒に、解決された段階を表示する**ので、「なぜそのスキルが実行されたのか?」が謎のままになることはない。
6. **信頼モデル: spawn 時のスコープ付きトークン。環境変数の除去をサンドボックスとはみなさない。** 詳細は下記の「信頼モデル」を参照。(Codex が「セキュリティ演劇だ」と指摘したため、当初の環境変数除去の計画から改訂。)
7. **単一の正: SKILL.md のフロントマターだけ。`meta.json` は使わない。** フロントマターは、host、triggers、args、version、source、trusted を保持する。SHA256 と鮮度は、別の `.checksum` サイドカーとして、フェーズ 4 に先送り(入るなら)。
8. **INDEX.json は使わない。ディレクトリを歩いて読む。** `$B skill list` は 3 段階を列挙し、各 SKILL.md のフロントマターを解析する。50 スキルで約 5〜10ms。「インデックスがディスクからずれる」という不具合の種類が、まるごと消える。
9. **`$B skill run` の出力プロトコル。** stdout = JSON。stderr = ストリーミングのログ。終了コードは 0 / 非 0。既定のタイムアウトは 60 秒で、`--timeout=Ns` で上書きできる。stdout の上限は 1MB(超えたら切り詰めて非 0 で終了)。`gh` / `kubectl` / `docker` の慣習に合わせる。
10. **フィクスチャの再生: 2 種類のテストに 2 つの方式。** SDK の単体テストは、テスト内のモック HTTP サーバーを立てる。エンドツーエンドのスキルのテストは、スクリプトがエクスポートするパーサー関数で、同梱の HTML フィクスチャを解析する(デーモンは不要)。フェーズ 1 のフィクスチャだけで `hackernews-frontpage` には十分。フェーズ 2 の `/automate` には、よりリッチなフィクスチャが必要になる。
11. **リファレンスのスキル: `hackernews-frontpage`。** HN のトップページ(タイトル、ポイント、コメント)をスクレイピングする。認証なし、安定した HTML、フィクスチャテストの理想的な対象。
12. **トークンとポートの発見: spawn されたスキルはスコープ付きトークンを環境変数からのみ読む。単独のデバッグ実行は状態ファイルにフォールバック。** `$B skill run` で spawn された場合、SDK は環境変数の `GSTACK_PORT` と `GSTACK_SKILL_TOKEN` を読む。独立した `bun run script.ts` の場合、SDK は `<project>/.gstack/browse.json`(`config.ts:50` の実際の状態ファイルのパス)にフォールバックする。
13. **CHANGELOG の誠実さ。** フェーズ 1 の見出し: 人間が決定的なブラウザスクリプトを手書きでき、gstack がそれを実行する。フェーズ 1 では、エージェントによる作成は次のリリースで入ることを明記する。捏造した性能の数値は書かない。フェーズ 1 には、比較の前後のデータがない。

### 信頼モデル(決定 #6 の詳細)

2 つの直交する軸があります。

| 軸 | 仕組み | 既定 |
|------|-----------|---------|
| **デーモン側のケイパビリティ** | `read+write` のスコープに結びつく spawn ごとのスコープ付きトークン(17 個のブラウザ操作のコマンドの面。管理コマンドの `eval`/`js`/`cookies`/`storage` は除く)。一度だけ使えるクライアント ID は、スキル名と spawn ID を符号化する。spawn が終了すると取り消される。 | 常にスコープ付き(デーモンのルートのトークンは決して使わない)。 |
| **プロセス側の環境変数へのアクセス** | SKILL.md のフロントマターの `trusted: true` は、`GSTACK_TOKEN` を除いた `process.env` を渡す。`trusted: false`(既定)は、最小限の許可リスト(LANG、LC_ALL、TERM、TZ、固定された PATH)以外をすべて落とし、シークレットのパターンのキー(TOKEN/KEY/SECRET/PASSWORD、AWS_*、AZURE_*、GCP_*、ANTHROPIC_*、OPENAI_*、GITHUB_* など)を明示的に取り除く。 | 信頼しない(オプトインが必要)。 |

`GSTACK_PORT` と `GSTACK_SKILL_TOKEN` は、常に最後に注入されるため、親プロセスが環境変数でそれらを設定して上書きすることはできません。

**これが正しく扱う点:** デーモン側のスコープ付きトークンは、デーモンが強制できる。`eval`(管理者スコープ)を呼ぼうとするスキルは、SDK がそれを公開していても 403 を受け取る。ケイパビリティの境界は正しい場所にある。

**これが閉じられない点:** Bun には組み込みのファイルシステム・サンドボックスがない。信頼されていないスキルも、`import 'fs'` して、OS ユーザーが読めるものは何でも読める(例: `~/.ssh/id_rsa`)。環境変数の除去は衛生的な対策であって、サンドボックスではない。OS レベルの隔離(`sandbox-exec`、名前空間)はフェーズ 4 の作業であり、既存の trusted/untrusted の契約の後ろに、きれいに組み込める。

当初の計画は、環境変数の除去をサンドボックスと呼んでいた。Codex はそれがセキュリティ演劇だと正しく指摘した。改訂後の計画では、それを正しく呼ぶ。ベストエフォートの衛生的な対策と多層防御であり、本当の境界はデーモン側のスコープ付きトークンにある。

### ファイル構成

```
browse/src/
├── browse-client.ts                # canonical SDK (~250 LOC)
├── browser-skills.ts               # 3-tier walk + frontmatter parser + tombstones
├── browser-skill-commands.ts       # $B skill list/show/run/test/rm + spawnSkill
└── skill-token.ts                  # mintSkillToken / revokeSkillToken wrappers

browser-skills/
└── hackernews-frontpage/           # bundled reference skill
    ├── SKILL.md
    ├── script.ts
    ├── _lib/browse-client.ts        # byte-identical copy of canonical
    ├── fixtures/hn-2026-04-26.html
    └── script.test.ts

browse/test/
├── skill-token.test.ts              # mint/revoke lifecycle, scope assertions
├── browse-client.test.ts            # mock HTTP server, wire format, auth
├── browser-skills-storage.test.ts   # 3-tier walk, frontmatter, tombstones
└── browser-skill-commands.test.ts   # parseRunArgs, dispatch, env scrub, spawn

test/skill-validation.test.ts       # extended: bundled-skill contract checks
```

### 変更しないもの

- domain-skills のストレージ、状態機械、注入。変更なし。
- トンネル面の許可リスト(`server.ts:118-123`)。同じ 17 個のコマンド。
- L1〜L6 のセキュリティの仕組み。Browser-skills はフェーズ 1 ではプロンプトにテキストを注入しない。フェーズ 3 のリゾルバー注入は、既存の UNTRUSTED のエンベロープに乗る。
- `cli.ts` の `sendCommand()` の HTTP クライアント。SDK は、別の関心事(ライブラリ対 CLI プロセス)を持つ別モジュール。

---

## Codex の外部の視点からの指摘(レビュー後の対応)

/codex のレビューは 8 件の指摘を出しました。計画では次のように扱います。

| # | 指摘 | フェーズ 1 での対応 |
|---|---------|------------------|
| 1 | ファイルシステムのサンドボックスがないと、信頼モデルは見せかけ | 決定 #6(スコープ付きトークン)により**解決済み**。 |
| 2 | 同梱スキルが 1 つだけなのに、フェーズ 1 は作り込みすぎ(探索の段階、墓石など) | **認めたうえで維持。** ユーザーは、フェーズ 2 でエージェントの作成を入れる前にアーキテクチャを固めるため、フェーズ 1 全体を選んだ。各サブシステムは十分小さく、データから使われていないと分かれば、きれいに削除できる。 |
| 3 | `cli.ts:398` の既存のクライアントのパターンにより、兄弟の SDK が不要になる可能性 | **偽であると確認。** 398 行目は `extractTabId()`(フラグのパーサー)の末尾。実際の HTTP クライアントは `sendCommand()`(cli.ts:401-467)だが、CLI に結びついている(`process.stdout.write`、`process.exit`、サーバー再起動の回復)。ライブラリとして再利用できない。新しい `browse-client.ts` は、同じワイヤーフォーマットを真似るが、ライブラリの形をしている。 |
| 4 | 「最初にヒットしたものが勝つ」探索が不透明 | `$B skill list` と `$B skill show` にインラインで解決された段階を表示することで**緩和**。将来的に、段階の上書きが混乱を招くと分かれば、任意の `--source bundled\|global\|project` フラグを検討。 |
| 5 | アトミックなスキルのパッケージングは、インデックスの問題より重要。シンボリックリンクの防御 | **フェーズ 1 では解決。** 同梱のスキルは gstack のインストールの一部として配布される(ライブ書き込みなし。インストールディレクトリ内の読み取り専用ファイルであるため、アトミック)。フェーズ 2 の `writeBrowserSkill` は、一時ディレクトリに書いてから名前を変え、`realpath`/`lstat` の規律を使う(既存の `browse/src/path-security.ts`)。 |
| 6 | アクティビティフィードからのフェーズ 2 の合成は弱い(損失のあるリングバッファ) | **フェーズ 2 の設計での未解決の課題。** アクティビティフィードはテレメトリであって、リプレイ用の中間表現ではない。フェーズ 2 では、構造化されたレコーダーか、エージェント自身の文脈から、エージェントにスクリプトを書き直させる必要がある。フェーズ 2 の設計段階で決める。 |
| 7 | Bun ランタイムの回帰: スキルのスクリプトを独立した Bun として動かすと、Bun ランタイムが再び必要になる | **フェーズ 2 の配布での未解決の課題。** フェーズ 1 は、同梱のリファレンススキルが gstack のインストール(すでに Bun でビルドされる)に含まれるため、これを回避している。フェーズ 2 では、(a) 生成された各スキルに Bun のバイナリを同梱する、(b) スキルを自己完結した実行ファイルにコンパイルする、(c) `cli.ts` の HTTP のパターンで Node.js を使う、のどれかを決める必要がある。 |
| 8 | `file://` のフィクスチャでは、タイミング、認証、ナビゲーション、遅延ハイドレーションを証明できない | **文書化された制限。** `hackernews-frontpage` には十分。フェーズ 2 の `/automate` には、よりリッチなフィクスチャ(タイミングを持つモックデーモン、記録された HAR のリプレイなど)が必要になる。 |

---

## フェーズ 2a — `/scrape` + `/skillify`(v1.19.0.0 で出荷予定)

2 つのスキルのテンプレートと、1 つのヘルパーモジュール。`/scrape <intent>` は、ページのデータを取得するための単一の入口です。新しい intent での最初の呼び出しは、`$B` のプリミティブでプロトタイプを作り、JSON を返します。その後、一致する intent の呼び出しは、約 200ms で、codified された browser-skill にルーティングされます。`/skillify` は、直近に成功したプロトタイプを、ディスク上の恒久的な browser-skill に codify します。変更を伴う兄弟の `/automate` は、フェーズ 2b(TODOS の P0)に先送りされました。

### v1.19.0.0 の計画レビュー(`/plan-eng-review`)で確定した決定

| ID | 決定 | 確定した動作 |
|----|----------|-----------------|
| **D1** | `/skillify` の出所(provenance)ガード | 最大 10 のエージェントのターンを遡り、明確に境界付けられた `/scrape` の呼び出し(プロトタイプの intent の行と、その後ろの JSON 出力)を探す。見つからなければ、次のメッセージで拒否する: *"No recent /scrape result found in this conversation. Run /scrape <intent> first, then say /skillify."*(この会話に最近の /scrape の結果がありません。まず /scrape <intent> を実行してから /skillify と言ってください。)黙ってフォールバックしない。 |
| **D2** | 合成の入力の切り出し | テンプレートは、エージェントに、ユーザーが受け入れた JSON を生んだ最後の試行の `$B` の呼び出しだけを抽出するよう指示する。加えて、ユーザーが述べた intent の文字列も抽出する。失敗したセレクターの試行、無関係なチャット、以前のセッションの内容は捨てる。Codex の指摘 #6 は、選択肢(b)(構造化レコーダーではなく、エージェント自身の文脈からの再プロンプト)を選んで解決する。 |
| **D3** | アトミックな書き込みの規律 | `/skillify` は `~/.gstack/.tmp/skillify-<spawnId>/` に書き込み、その一時ディレクトリに対して `$B skill test` を実行し、成功かつユーザーの承認が得られた場合にのみ、最終的な段階のパスに名前を変える。テストの失敗または承認の拒否では、一時ディレクトリを `rm -rf` で完全に削除する(承認されなかったスキルに墓石は残さない)。新しいモジュール `browse/src/browser-skill-write.ts`(`stageSkill` / `commitSkill` / `discardStaged`)を作り、Codex の指摘 #5 に従って `realpath`/`lstat` の規律を守る。 |
| **D4** | テストの範囲 | ゲート段階の E2E が 5 件(scrape の一致、scrape のプロトタイプ、skillify の正常系、skillify の出所による拒否、承認ゲートでの拒否)+ 単体テストが 1 件(アトミック書き込みヘルパーの失敗時のクリーンアップ)+ 手動で確認するスモークテストが 1 件(変更を伴う intent の拒否)。`test/helpers/touchfiles.ts` に登録する。 |

### 引き継ぎ事項

- **既定の段階: グローバル。** 手順はグローバルに置くのが基本で、`/skillify` の時点でプロジェクトごとの上書き(`<project>/.gstack/browser-skills/` へ)を選べる(ドメインスキルのスコープに合わせる)。フェーズ 1 のストレージのヘルパーは、両方の探索パスをサポートする。
- **Bun ランタイムの配布。** Codex の指摘 #7 は未解決のまま。フェーズ 2a では、Bun が PATH にあると想定する(gstack は `setup:6-15` によって既に Bun を必要とする)。`/skillify` の SKILL.md の「Limits」に文書化する。根本的な解決はフェーズ 4 で行う。

## フェーズ 2b — `/automate` の素案

変更を伴う操作の、`/scrape` の兄弟です。同じ skillify のパターンを使います(`/skillify` と D3 ヘルパーをそのまま再利用)。違いは、非 codify の実行時には、変更ステップごとに UNTRUSTED で包まれた要約と `AskUserQuestion` の確認ゲートを置くことです。codify された後は、スキルは無人で実行されます(codify されたスクリプトが、どの `$B click`/`fill`/`type` の呼び出しを実行するかを正確に列挙するため)。TODOS.md の P0 の項目を参照してください。

## フェーズ 3 の素案

セッション開始時のリゾルバー注入。`server.ts:722-743` のドメインスキルの注入を踏襲する。

```ts
const browserSkillsBlock = await renderBrowserSkillsForHost(hostname, projectSlug);
if (browserSkillsBlock) {
  systemPrompt += `\n\n${browserSkillsBlock}`;
}
```

`renderBrowserSkillsForHost()` は 3 段階を読み、`host` フィールドが一致するスキルに絞り込み、UNTRUSTED で包んだブロックを出力して一覧を示す。

`gstack-config browser_skillify_prompts`(既定はオフ): オンのとき、`/qa`、`/design-review` などの作業の終わりに出るナッジが、アクティビティフィードで 1 つのホストに対して N 件以上のコマンドが実行され、かつその host+intent に対するスキルがまだ存在しない場合に発火する。

## フェーズ 4 の素案

- LLM ジャッジによる評価(「エージェントは再探索する代わりにスキルに手を伸ばしたか?」)。
- フィクスチャの鮮度検出 — 同梱のフィクスチャと、ライブのページを比較する。
- 不審な spawn 向けの OS レベルのファイルシステム・サンドボックス(macOS では `sandbox-exec`、Linux では名前空間 / seccomp)。
- `$B skill upgrade <name>` — 正規の SDK が変わったときに、兄弟の SDK のコピーを再生成する。

---

## 検証(フェーズ 1)

`bun test` で、新しいテストファイルが通ること:
- `browse/test/skill-token.test.ts` — 15 件のアサーション
- `browse/test/browse-client.test.ts` — 26 件のアサーション
- `browse/test/browser-skills-storage.test.ts` — 31 件のアサーション
- `browse/test/browser-skill-commands.test.ts` — 29 件のアサーション
- `browser-skills/hackernews-frontpage/script.test.ts` — 13 件のアサーション
- `test/skill-validation.test.ts` — 同梱スキルの新しいアサーション 7 件

デーモンを起動した状態でのエンドツーエンド:

```bash
$B skill list                            # shows hackernews-frontpage (bundled)
$B skill show hackernews-frontpage       # prints SKILL.md
$B skill run hackernews-frontpage        # returns JSON of 30 stories
$B skill test hackernews-frontpage       # runs script.test.ts
```
