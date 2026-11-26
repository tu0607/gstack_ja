# コントリビューター向けリファレンス

CLAUDE.md の内容から、コントリビューター専用の詳細を原文のまま移したものです。CLAUDE.md は Claude Code が毎セッション読み込み、40,000 文字で上限が設けられています(#2096、`test/claude-md-size.test.ts`)。CLAUDE.md には、この文書の各セクションへの一行ポインタだけを残しています。

<a id="skill-size-budgets"></a>
## スキルのサイズ予算

**トークン上限:** 生成された SKILL.md は、160KB(約 40K トークン)を超えると警告が出ます。これは「機能の肥大化に注意する」ためのガードレールであり、ハードなゲートではありません。最新のフラッグシップモデルは 200K〜1M のコンテキストウィンドウを持つため、40K は 4〜20% にあたります。また、プロンプトキャッシュがあるので、サイズが大きくなる際の追加コストは小さくなります。この上限の目的は、リゾルバーやプリアンブルが暴走的に増えることを検知することであり、慎重に調整された大きなスキルを無理に圧縮することではありません(`ship`、`plan-ceo-review`、`office-hours` は、正当な理由で 25〜35K トークン分の振る舞いを詰め込んでいます)。40K を超えた場合、まず適切な対処は通常次のとおりです。(1) 何が増えたのかを確認する、(2) 1 つのリゾルバーが 1 PR で 10K 以上増やしたなら、インラインに置くべきか参照ドキュメントに分けるべきかを検討する、(3) 調整済みの文章を圧縮するのは最後の手段にする。カバレッジ監査、レビュー部隊、ボイスの指示を削ると、品質面で実際の代償があります。

もう一段厳しい上限として、検出(ディスカバリー)のための面を守る仕組みがあります。`test/catalog-budget.test.ts` は、全スキルの frontmatter の `name` と `description` を合計した値を `CATALOG_BUDGET_TOKEN_EQUIVALENTS`(現在 1,194、新しいスキルを追加するたびに引き上げる)トークン相当以内に抑えます(スキルごとに 260 バイトのサブ上限があり、test/helpers/skill-census.ts の共通集計で数えます)。これは警告ではなく強制されるルールです。すべてのホストがセッションごとに全カタログを読み込むため、ここが増えると会話のたびにコストがかかります。失敗時のメッセージには、再計測と上限引き上げの手順が含まれています。`bin/gstack-context-bill` は、スキルツリーのトークン内訳(常時読み込みか呼び出しごとか、`--diff`、`--budget`)を表示します。`--exact` を付けると実際のトークナイザを使いますが、その場合はファイルの本文が api.anthropic.com に POST され、egress レシートが残ります。

コンテキスト予算のラチェット(`test/context-budget-ratchet.test.ts`、無料で `bun run test` の中で実行)は、さらに 2 つの台帳について絶対上限を固定します。1 つは常時読み込まれる full frontmatter の合計(catalog-budget は name と description だけを数えます)、もう 1 つは各スキルの呼び出しごとの即時トークン(SKILL.md と強制読み込みされる参照ファイルの合計)です。後者はサイズの下限や同等比率のガードで相対的に守られ、絶対値では守られていません。これらは `test/fixtures/context-budget.json` に照らして判定されます。スキルが上限を超えると失敗し、新しいスキルは予算を意識的に設定するまで失敗します。正当な増加や削減を反映する場合は、`bun test/helpers/capture-context-budget.ts` を再実行し、更新したフィクスチャを同じコミットに含めてください。こうすることで、上限が段階的に下がり、削減の成果が固定されます。

<a id="egress-receipts"></a>
## Egress レシート

**外部送信先への egress レシート**(v1.63.0.0 以降)。gstack が開始する、マシン外への送信はすべて、送信の前に `~/.gstack/security/egress.jsonl` へハッシュチェーン付きのレシートを書かなければなりません。TypeScript の呼び出し元は `lib/egress-receipt.ts` の `writeReceipt` を使います。シェルスクリプトは `bin/gstack-egress-lib.sh` を source して、`_receipted_curl` / `_receipted_git` を使います。失敗時の扱いはクラスごとに異なります。機密性の高い送信先(brain-sync、memory-ingest、gbrain-sync、telemetry、ngrok トンネル、mcp-verify、supabase-provision、Memorable ブリッジのプロンプトごとの memorable-recall の受け渡し)は fail-closed です。ユーザーに見える送信先(デザイン機能での OpenAI 呼び出し、update-check、ダッシュボード、git 系の操作)は fail-open で、stderr に警告を出します。`test/egress-receipt-wiring.test.ts` の新しい送信先スキャナーは、非ループバックのホストへの未記録の `curl`、`git push`、`fetch` を検出すると CI を失敗させます。ただし、そのファイルの `SCANNER_EXEMPT` リストに理由付きの項目がある場合は除きます(ユーザーが指定したページ取得、到達性の確認、指示文字列、スキルの文章など)。マシン外への新しい送信先を追加する場合は、ヘルパー経由で配線し、列挙された送信先リストに加えてください。`aside exec`(gstack が組み立てたプロンプトを Aside のエージェントに送る処理)は、ユーザーに見える fail-open の送信先です。スキルは必ず `scripts/resolvers/aside.ts` が描画する `_aside_exec` ラッパーを通して呼び出し、直接呼び出してはいけません。確認には `bin/gstack-egress`(`list` | `verify`(改ざんがあれば終了コード 3) | `grants`)を使います。脅威モデルは、試みられた egress を事後に追跡するための観測性であり、情報持ち出しを防ぐ制御ではありません。

<a id="skill-linking-and-ownership"></a>
## スキルのリンクと所有権

**プレフィックス設定:** セットアップは、トップレベルに実ディレクトリを作成します(シンボリックリンクではありません)。その中に SKILL.md へのシンボリックリンクを置きます(例: `qa/SKILL.md -> gstack/qa/SKILL.md`)。さらに、各スキルのランタイム資産(sections/、テンプレート、チェックリストなど。SKILL.md、テスト、ビルド出力、`.tmpl` のソース以外のすべて)へのリンクも作ります。エイリアススキル(`_gstack-command`、`connect-chrome`)は、シンボリックリンクではなく書き換え済みのコピーとしてインストールされます。これにより、Claude はこれらを `gstack/` の下のネストされたものとしてではなく、トップレベルのスキルとして検出できます。名前は、`~/.gstack/config.yaml` の `skill_prefix` で制御される短い形式(`qa`)または名前空間付きの形式(`gstack-qa`)のどちらかです。対話型のプロンプトを省略するには、`--no-prefix` または `--prefix` を渡します。

**所有権のゲート(#2119):** `setup` は、作成するすべてのスキルディレクトリに `.gstack-owned` マーカーを書き込みます。そのうえで、`setup`(リンカー、エイリアスのインストーラー、プレフィックス切り替えの両方のクリーンアップ、廃止されたスキルの整理)と `bin/gstack-relink` は、gstack のものだと証明できるエントリにしか、削除やリンクの上書きを行いません。強い証明(gstack に解決されるシンボリックリンク、またはマーカー)があれば、ディレクトリ全体を削除または更新できます。弱い証明(バイト単位で元のソースと同一の実際の SKILL.md、または gen-skill-docs の 2 行のバナーを持つもの)は、そのファイル 1 つだけを対象にします。弱い証明しかないファイルの内容が異なる場合は、gstack がリンクを上書きする前に `~/.gstack/backups/skills/<ts>/<skill>/SKILL.md` に移動されます。それ以外は外部のスキルとみなされ、スキップされ、セットアップの最後の要約に名前が出ます。このルールは 2 つの箇所(`setup` と `bin/gstack-relink`)に重複して書かれています。共通ヘルパーが TODOS.md に登録されるまでは、両者を同期させておいてください。廃止されたスキルの整理(`_prune_stale_generated`)は、存在しないスキルの生成済みレンダリングに対して、同じ強い/弱いの区別を適用します。判定は専用のゲート(`_owned_for_windows_refresh`)を通します。実ホストディレクトリは、その SKILL.md が生成バナーを持つ場合にのみ候補になり、マーカーとバイト一致は参照しません。このゲートはレンダーツリーとすべてのホストのスキルディレクトリを走査し、実際のレンダーディレクトリは削除し、gstack に解決されるホストのシンボリックリンクだけを削除し、バナー付きの実ディレクトリは `_cleanup_weak_dir` で掃除し、レンダーツリー内のシンボリックリンクは決してたどらず、フロントマターの `name:` で改名されたスキルも認識します。これらは `test/setup-link-ownership.test.ts`、`test/setup-cleanup-orphans.test.ts`、`test/setup-prune-stale-generated.test.ts`、`test/relink.test.ts` で検証されています。

<a id="redaction-guard"></a>
## 秘匿化ガード

共有の秘匿化エンジンは、外部の送信先(codex への投入、GitHub の issue/PR 本文、push されるコミット)に届く前に、認証情報、個人情報(PII)、法的・不利益になる内容を検出します。これは**ガードレールであり、完全な強制ではありません**。`git push --no-verify`、直接の `gh issue create`、`GSTACK_REDACT_PREPUSH=skip` はいずれもこれを迂回します。このガードが防ぐのは、うっかりや不注意による事故で、全体の 99% のケースです。意図的に漏らそうとする者を止められるとは主張しないでください(CHANGELOG の 1 行でそれができてしまうなら、悪意のあるスクリーンショットを撮る人に対しては失敗するはずです)。

- **エンジンと分類:** `lib/redact-patterns.ts`(唯一の情報源。3 段階の階層です。HIGH は本物の機密情報である認証情報で、ブロックされます。MEDIUM は PII、法的情報、社内情報、および誤検知の多い認証情報の形で、AskUserQuestion による確認を経ます。LOW は参考情報です)と `lib/redact-engine.ts`(副作用のない `scan()` と `applyRedactions()`)。調整は重要です。誤検知が多いゲートは無視されてしまうため、文脈に依存する形式(Stripe の `pk_live_`、Google の `AIza`、JWT、環境変数の `*_KEY=`)は MEDIUM に置いています。
- **CLI:** `bin/gstack-redact`(終了コード 0 はクリーン、2 は MEDIUM、3 は HIGH。`--json`、`--auto-redact`、`--repo-visibility`、`--from-file` を指定できます)。`bin/gstack-redact-prepush` は、任意で有効にできる git フックです。
- **スキル文書は生成されます。** 生成元は `scripts/resolvers/redact-doc.ts`(`{{REDACT_INVOCATION_BLOCK:<sink>}}`)です。これにより、/spec、/cso、/ship、/document-release、/document-generate がエンジンからずれることを防ぎます。
- **送信地点でのスキャン:** 送信されるバイト列そのものを必ずスキャンしてください。一時ファイルに書き出し、そのファイルをスキャンし、同じファイルを `gh` や `git` に渡します。文字列をスキャンしてから再レンダリングしてはいけません(スキャン時と送信時のずれが生じます)。
- **可視性(階層の昇格はなし):** 実行ごとに一度だけ解決します。順序は、ローカル設定(`gstack-config get redact_repo_visibility`。~/.gstack に保存されるのでコミットされません)→ gh → glab → unknown(=public-strict)の順です。公開リポジトリでは、より厳しい指摘ごとの確認を行います(一括承認も、黙って進めることもありません)。MEDIUM が自動的に HIGH に昇格されることはありません。
- **ツール由来のフェンス:** Codex、Greptile、eval の出力は ` ```codex-review ` や ` ```greptile ` のフェンスで囲みます。こうすると、これらのツールが引用したサンプルの認証情報は、ブロックではなく警告に格下げされます。フェンスの中にも、有効な形式の認証情報があれば、それはブロックされます。
- **設定キー:** `redact_repo_visibility`(public|private|unknown。gh や glab で読めないリポジトリ向けの、ローカル専用の上書き)、`redact_prepush_hook`(true|false)。HIGH のブロックを無効にするキーは、意図的に存在しません。
- **コミット済みの許可リスト:** push されるコミットのルートにある `.gstack-redact-allowlist` には、良性と確認済みの、一致した正確な範囲を列挙します。pre-push フックが抑制するのは、検出範囲がエントリと一致する指摘だけで、各 push ごとにすべての抑制を一覧表示します。
- **監査:** /spec の意味的レビューは、内容を含まない記録(カテゴリと本文の sha256。spec の本文は含みません)を `~/.gstack/security/semantic-reviews.jsonl`(0600)に追記します。

<a id="checking-out-prs-from-garrytan-agents"></a>
## garrytan-agents からの PR のチェックアウト

「<PR のリンク> をチェックアウトして」とユーザーが言い、その PR が `garrytan-agents/gstack`(または `garrytan/gstack` のコラボレーターではない、他のフォーク)からのものである場合は、単に `gh pr checkout` してはいけません。フォークの PR はベースリポジトリのシークレット(`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` など)を受け取れないため、eval や E2E の CI ジョブは、ベースリポジトリに何を設定してあっても、空の環境による認証エラーで失敗します。

**手順:** ブランチを `garrytan/gstack`(ベースリポジトリ)に push し、PR をそこから付け直します。

具体的には、`gh pr checkout <N>` の後に、次のとおり行います。

1. 元の PR 番号とヘッドのブランチ名を控える。
2. 同じブランチをベースリポジトリに push する: `git push origin HEAD:<branch-name>`(origin は `garrytan/gstack`。ワークツリーはそのリモートで設定されています)。
3. フォーク側の PR を閉じる: `gh pr close <N> --comment "moving to base-repo branch for secret access"`。
4. ベースリポジトリのブランチから新しい PR を開く: `gh pr create --base main --head <branch-name>`。
5. 新しい PR のワークフローは、自動的にシークレットを受け取ります。

なぜフォーク側で直さないのか。`garrytan-agents` は `garrytan/gstack` のコラボレーターではありません。コラボレーターとして追加する(案 A)か、リポジトリ全体の「フォークの PR にシークレットを送る」設定を切り替える(案 B)と、誰からのフォーク PR にもシークレットが届いてしまい、この 1 つのブランチを移すよりも影響範囲が広くなります。案 C(このセクション)なら、シークレットの配布範囲を狭く保てます。

ユーザーが移動を省略するよう求めた場合(例: 「フォークの PR のままでいい」)は、その意向に従ってください。その場合、eval の CI は空の環境による認証で失敗しますが、check-freshness、workflow-lint、windows-tests はフォークの PR でも通ります。
