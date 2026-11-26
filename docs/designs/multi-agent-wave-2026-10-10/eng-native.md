INPUT: eng d7365d9256d2c956908fce530731115816ab6b477152e78602fc69d51fd14b17

読み取りの受領: `/workspace/gstack/.gstack/tmp/autoplan/autoplan-eng-JwMe0e/native-prompt.md`、230 行、67384 バイト、SHA-256 `77ee24a4…3511f`(ディスパッチの値と一致)。2000 文字を超える 6 行(54、58、65、74、100、102)は `sed` で全文を再読した。以下の file:line はすべて `origin/main 91bbd9e`(v1.91.69.0)の `/workspace/gstack` で開いて確認した。

拘束力があるものとして扱った前のフェーズの決定: UC1(階層化されたスコープ、P7 のゲート)、B0(成果物の契約を 1 つにしバリデーターを置く)、B1(`unattended` を 4 つ目の種類とする)、C1(リポジトリのコマンドはオプトイン)、C3/D11(同一性に基づくゲートの再利用)、B2(ランナーは 1 つ)、A1(doctor の表は 1 つ)、A2(Bun の事前確認)、C2(stamp-at-merge、再スタンプのジャーナル)、ハンク単位のレシート、GSTACK_RESULT の文法、ゲート一覧の ID/ページ送り/gate_rev、2 段階の事前ゲート。計画自身のプレミス表が誤っている場合は、そのレシートとともにそう述べる。計画の D1「前提表」の行は、そのうち 2 件を捕捉できたはずである。

## スコープの検討

**既に存在するもの(検証済み)。** `bin/gstack-doctor` は 456 行の Bash 3.2 で、行ごとに 1 つの `check_*` を持ち、`--live` があり、`fail` のとき終了コード 1、使用法エラーのとき 2 を返す(bin/gstack-doctor:3-16、:35-40、:442-454)。`bin/gstack-session-kind` は `spawned|headless|interactive` に分類し、明示的な上書きは `spawned` だけを受け付ける(bin/gstack-session-kind:33-36)。`bin/gstack-skill-start:93` はその 3 つだけを許可し、それ以外は `interactive` に強制する。プリアンブルの AUQ のルールも同じ 3 つで分岐する(scripts/resolvers/preamble/generate-ask-user-format.ts:15-29)。`lib/state-root.ts:22-29` が連鎖を所有し、`test/state-root-ratchet.test.ts` は手書きの連鎖や、裸の `~/.gstack` の散文を拒否する。`bindReview` は唯一の書き込みの関門であり、`reviewFreshness` は読み取り時に既に `issues_found > 0` を格下げしている(lib/review-evidence.ts:178-186、:238-240)。bash のラッパーは束縛エラーを `invalid JSON` として飲み込む(bin/gstack-review-log:88-96)。`gstack-version-bump write` には、まさに C1 が一般化したい信頼の根拠を持つ、オプトインの書き込み後フックが 1 つある(bin/gstack-version-bump:373-402)。また半分だけ書かれた状態からの回復経路もある(:483-495)。`gstack-evidence` は `tree`/`wtree` を記録し、許可リストに対してファイル名で変更されたパスを比較する(bin/gstack-evidence:388-396、:498-512)。設計上マシンに局所的である(:27-30)。`outsideVoiceFor` はレンダリング時の `ctx.host` からプロバイダーを選ぶ(scripts/resolvers/outside-voice.ts:8-12)。仕様レビューのループは PASS、繰り返し、3 回目の起動で停止し、「スコアの欠落だけでは再レビューは不要」とする(scripts/resolvers/spec-review.ts:186-192)。autoplan の公開フックは `host === 'claude'` のときだけレンダリングされ、ファイルがないと拒否する(scripts/resolvers/composition.ts:11、:16-23)。シェルのバックストップは、TS 側が失敗すると拒否する(autoplan/bin/phase-publication-hook:4-9)。`lib/gate-outcomes.ts:1-18` は、`docs/troubleshooting.md` のアンカーを持つ理由コードの契約であり、アンカーのテストがある(`test/troubleshooting-anchors.test.ts`)。`setup` は `GSTACK_SKIP_PLAYWRIGHT=1`(setup:2071-2072)と `GSTACK_SKIP_FONTS=1`(setup:1512)を尊重し、Bun がないときはチェックサム検証付きの Bun インストール手順を表示し(setup:296-305)、`--status` は常に終了コード 0 を返す(setup:136-146)。21 スキルのセクションマニフェストが存在し、機械的な述語のない受動的なレジストリとして文書化されている(autoplan/sections/manifest.json:5)。`investigate/` には `sections/` ディレクトリがない(278 行のモノリス。パリティ比は上限 1.12 に対して 0.787 であり、余裕がある)。

**計画が再構築するものと、拡張するもの。** PR A は doctor と setup を拡張する(正しい判断)。PR B の B7/B8/B9/B12 は既存の関門を拡張する(正しい判断)。しかし PR B の B2/B3 は、「薄い」と称する新しいサブシステムである。B2 はプロンプトを組み立て、ディスパッチし、再開可能な状態機械であり、B3 は実行時の outside voice のランナーである。今日存在するのは、レンダリング時の散文だけである。PR C はほとんど新しいコードである(再スタンプ、レシート、regen、pregate、ship-policy、ship-receipt、証拠バンドル)。7 つのライブラリと 6 つのバイナリは現実的な数であり、キューの再生フィクスチャだけで複数リポジトリのハーネスになる。PR D はテンプレートとリゾルバーの作業であり、予算への影響がある(セクション 4)。PR E は tier 3 であり、ただし E1 は tier 1、E2 のバンドルは C3 が既に前倒ししている。

**複雑さの検討(私の見積もり、`[estimated]`。表の「3/1/8」ではなく、テキストが示唆するものを数える)。**

| PR | 新しいバイナリ | 新しいライブラリ | テンプレート/リゾルバーの編集 | フィクスチャ | 推定 LOC | 1 回のレビューに収まるか |
|---|---|---|---|---|---|---|
| A | `gstack-capy-install`、`gstack-browser-ensure`(+ doctor の `--check/--for/--require/--json/--project`) | `runtime-pins.ts`、コンポーネント表(指摘 F5 の言語を参照) | setup の `--no-browser`、`--status` の終了コード、browse の事前確認 | 約 10(健全、欠落、各種、誤ったホスト、認証なし、範囲とピンの違い、Windows レーンのピン) | 900〜1200 | はい |
| B | `gstack-artifact`、`gstack-autoplan`、`gstack-gate`、`gstack-codex-login`(+ `gstack-outside-voice`、F2) | `headless-artifacts.ts`、`autoplan-export.ts`、`autoplan-run.ts`、`gate-list.ts`、`outside-voice-api.ts` | プリアンブル(unattended)、skill-start、session-kind、autoplan の骨組み + `sections/unattended`、4 つのチェックリスト、spec-review、review-evidence、review-log、phase-close | 約 20 | 3500〜5000 | **いいえ**。B2+B3 だけで 1 つの PR になる |
| C | `gstack-restamp`、`gstack-tree-receipt`、`gstack-regen`、`gstack-pregate`、`gstack-ship-receipt`、`gstack-hermetic-run` | `ship-policy.ts`、`restamp.ts`、`changelog-check.ts`、`tree-receipt.ts`、`regen.ts`、`pregate/*`(6 ファイル以上)、`md-links.ts`、証拠バンドル | ship の Step 3/5/12/16/18、land-and-deploy、tests.md.tmpl | 約 16 + 3 つの PR にまたがる複数リポジトリの再生 | 4000〜6000 | **いいえ**。pregate と restamp は別々のレビューの機会が必要 |
| D | —(なし) | `plan-reality.ts` リゾルバー | 6 つのテンプレートファイル | 約 12 | 600〜900 | 可能だが、すべての編集が余裕ゼロのスキルに入る(セクション 4) |
| E | `gstack-lane-check`、`gstack-banned-terms`、(`gstack-evidence verify`) | `lane-ownership.ts`、`spend-ledger.ts`、`pricing.ts`、eval-plan のセクション | 新しいスキル + qa/ship のセクション | 約 10 | 1500〜2500 | はい(tier 1 のみ) |

**リポジトリ自身の制約に対する PR 数。** リポジトリには、PR 数に関する厳格な規則はないが、PR ごとに効く 3 つのバイト単位の ratchet(パリティ、コンテキスト予算、スキルサイズ)があり、また、すべての PR が完全なゲートを通るリリースプロセスがある。5 つの PR は正しい*形*だが、そのうち 2 つは誤った*サイズ*である。推奨する分割: B → B-core(B0、B1、B7、B9、B12、B10)と B-runner(B2、B3、B4、B8、B11)。C → C-stamp(C1、C2、C3、C5、C7)と C-pregate(C4、C8、C6)。各半分は単独で出荷可能であり、キューのコストとして追加のゲートが 2 回分かかる。これは事前ゲートの PR が安くすることを意図している。D1(a) の精神を保ち、10 ではなく 7 つの PR とする。この決定を、以下の決定 E1 として記録する。

## セクション 1 アーキテクチャ

```
 parent agent (Capy thread / coordinator)
   | GSTACK_LAUNCH: GSTACK_SESSION_KIND=unattended GSTACK_STATE_ROOT=<p> GSTACK_EPHEMERAL=1
   v
 bin/gstack-capy-install ──> ./setup --host claude|codex (--no-browser) ──> bin/gstack-doctor --check --for <skill>
   |                                                                          ^ table: doctor-components (F5: bash, not TS)
   |                                                                          ├─ lib/runtime-pins.ts  <── <project>/package.json, .tool-versions, .github/workflows/*.yml
   |                                                                          └─ bin/gstack-browser-ensure (lazy Chromium)
   v
 bin/gstack-autoplan {run|next|submit|status|answer|resume} ── lib/autoplan-run.ts (state machine; F1)
   |   reads: autoplan/sections/*.md (+ scope field, F9), snapshot.json (nativeDispatchPrompt), gate list
   |   writes: --out/<run>/{plan.md, review-record.md, tasks.jsonl, decisions.jsonl, findings.jsonl, timing.json, run.json}
   |           via lib/headless-artifacts.ts  <── bin/gstack-artifact {validate|schema|ack}
   |   outside voice: bin/gstack-outside-voice --runner codex-cli|api|host-subagent (F2) ── lib/outside-voice-api.ts
   |   review log:    bin/gstack-review-log --findings findings.jsonl ── lib/review-evidence.ts bindReview (B7)
   |   gate:          bin/gstack-gate {render|parse} ── lib/gate-list.ts (ids, gate_rev, pages)
   |   state root:    $GSTACK_STATE_ROOT/analytics/autoplan-timing.jsonl   (EPHEMERAL on Capy — F3)
   v
 /ship (Step 5)  bin/gstack-pregate ── lib/pregate/{index,regen,secrets,strays,literals,lanes,import-graph,...}.ts
   |                 pins: .gstack/pregate.json  .gstack/generated.json (read from origin/<base>, F12)
   |                 writes: pregate.json (schema via headless-artifacts)
 /ship (Step 12/16/18)
   bin/gstack-restamp --queue-mode stamp-at-merge --next|--version|--after <pr> ── lib/restamp.ts, lib/changelog-check.ts
   |     pins: .gstack/ship-policy.json (lib/ship-policy.ts)   journal: .gstack/tmp/restamp-journal.json   gate-ahead: .gstack/tmp/gate-ahead.json
   |     calls: bin/gstack-version-bump write, <release_tool> (opt-in), bin/gstack-regen --write, mirror
   bin/gstack-tree-receipt --from gate-ahead.json ── lib/tree-receipt.ts  <── bin/gstack-evidence bundle (portable), gstack-wtree
   |     verdict: TREE: same-modulo-stamps | changed (<paths>)   gate-reuse: eligible | not-eligible (<what>)
   bin/gstack-ship-receipt ── fenced ```gstack-ship-receipt``` (first PR-body section) ── /land-and-deploy read --json
```

**モジュールサイズの ratchet のリスク(修正版)。** 計画の前提では、`bin/gstack-next-version`(822 行)、`bin/gstack-autoplan-snapshot.ts`(865 行)、`setup`(4662 行)が `test/module-size-ratchet.test.ts` によって上限を設けられているとしているが、これは誤りである。フィクスチャが上限を設けるのは 47 の `newModules` と 4 の `residualFiles` であり、それらのいずれも上記の 3 つではない(test/fixtures/module-size-ratchet.json。残余のリストは `scripts/test-free-shards.ts`、`scripts/test-paid-shards.ts`、`browse/src/server.ts`、`test/helpers/claude-pty-runner.ts`)。これらの bin を薄く保つことは依然として良い衛生だが、本当の ratchet の露出は、計画が編集するが名前を挙げていないファイルにある。`scripts/resolvers/plan-gates.ts`(571/800、D2 が `Undeclared behavior changes` の行を追加)、`scripts/resolvers/spec-review.ts`(288/800、B8)、`autoplan/bin/phase-publication-hook.ts`(B1)、`scripts/lib/measure-bar.ts`(E1)、`scripts/resolvers/outside-voice-steps.ts`(B3)。これら 5 つはすべて `newModules` にあるため、触れたすべての関数に 150 行の関数上限が適用される。新しい `lib/*` ファイルは、フィクスチャに追加されない限り ratchet の対象ではない。計画の「`lib/pregate/*` の各ファイルは 150 行未満」は、フィクスチャに追加されるまで強制されない。

**状態ルートの遵守。** 計画のすべての新しいパスは、`GSTACK_STATE_ROOT` か、親が選んだ `--out` ディレクトリを経由する。これは正しい。ただし罠が 2 つある。(1) テンプレートとリゾルバーは、`:?` ガード付きの `gstack-paths --get GSTACK_STATE_ROOT` の形式を使わなければならない。さもないと `test/state-root-ratchet.test.ts` が最初のフェンスで失敗する(test/state-root-ratchet.test.ts:18-25)。(2) `docs/unattended.md` は、散文で `~/.gstack` を書いてはならない(PROSE_ROOT の正規表現、:20)。代わりに `$GSTACK_STATE_ROOT` を書くこと。`--out` ディレクトリは設計上その連鎖の外にある。そのため `run.json` は `state_root` と `state_root_durable` を記録し、検証器がどの成果物の種類がどこに入ったかを言えるようにすべきである。

**生成されるテンプレートの遵守。** すべての散文の編集は `.tmpl` + `bun run gen:skill-docs --host all` で行う(scripts/gen-skill-docs.ts:34、:116 は `all` をサポートする)。新しい `{{HOST_ADAPTATION:unattended}}`、`{{PLAN_REALITY_ROWS}}`、`{{COORDINATOR_CONTRACT}}` のリゾルバーは、`scripts/resolvers/index.ts:52` に登録される必要があり、すべてのホストにレンダリングされる。そのため、それを含むすべてのスキルにバイト数がかかる(セクション 4)。B4 の `sections/manifest.json` の `scope` フィールドは、文書化された受動的なレジストリの設計を覆す(autoplan/sections/manifest.json:5 の「No machine predicate here — see docs/designs/v2_PLAN.md:663」)。`test/qa-lazy-sections.test.ts:127` は、インライン化せずに受動的に解決することを主張している。この覆しは、プロンプトを自分で組み立てる unattended ランナーにとっては擁護できるが、計画は、誰も読まないフィールドを追加するのではなく、そのメモ、`$schema`、そのテストを更新しなければならない。

## セクション 2 エッジケースと障害モード

レジストリ(重大な欠落 = テストもなく、扱いもなく、かつ無言 → ★ で示す):

| # | モード | 検出 | 計画での扱い | 計画でのテスト | 欠落 |
|---|---|---|---|---|---|
| 1 | `--check` を `tail` にパイプし、呼び出し側がパイプの状態を見る | 末尾行 + 非ゼロの終了コード | A1 はあらゆる経路で末尾行を表示する。SKILL.md はパイプしないと述べる | 末尾行のトークンに対する doctor のフィクスチャ | 問題なし |
| 2 | 対象マシンに Bun がない。doctor の表は TS にある | `bun` が見つからない | **なし**。A1 は表を `lib/doctor-components.ts` に置くが、doctor は Bash 3.2 であり、Bun なしで報告すると約束している(bin/gstack-doctor:22) | なし | ★ F5 |
| 3 | `bun upgrade --version <pin>` が Bun 1.3.14 で非対応 | `bun upgrade --help` は `--canary` のみを列挙する | A2 はそのフラグを前提とする | なし | ★ F11 |
| 4 | プロジェクトのピンと gstack の下限が競合する | 両方の制約を表示し、インストーラーが停止する | はい | 部分的(ランタイム不一致のフィクスチャ) | 競合のフィクスチャを追加 |
| 5 | `unattended` が設定されているが、古い `gstack-skill-start` が `interactive` に強制する(bin/gstack-skill-start:93) | なし | 言及なし | 言及なし | ★ F7 |
| 6 | `GSTACK_SESSION_KIND=unattended` と `GSTACK_HEADLESS=1` が両方設定される(eval ハーネス + 親) | 上書きがステップ 0 で勝つ | 暗黙で、明言されていない | HEADLESS のみの陰性対照 | 優先順位を明記する。両方設定のテストを追加 |
| 7 | Capy のホスト: フックファイルは存在するが、フックが実行されない | なし | B1 はファイルの*不在*しか検出しない(composition.ts:21-23) | 不在に対するガードのフィクスチャ | ★ F4 |
| 8 | Claude のホスト: フックファイルがない(壊れたインストール) → B1 が拒否を許可に変える | `guard: not installed` と表示 | 出荷されるところでガードを弱める | — | F4 |
| 9 | P7 のカウンターが一時的な状態ルートに書かれる。unattended では telemetry が `off` | — | A3 は学習内容をスキップするが、B0/B10 は依然として analytics を書く | なし | ★ F3 |
| 10 | unattended のランナーは、ホストがディスパッチしなければならない*ネイティブ*のレビュアーを必要とする(本レビュー) | 実行がブロックされるか、両方の意見のために Codex を呼び出す | B2 には `submit`/`next` の動詞がない | 受け入れ条件は「ファイルを生成する」と述べる | ★ F1 |
| 11 | 外部ランナーの `api` が途切れた/空の出力を返す。`host-subagent` の結果ファイルがない | `OUTSIDE_STATUS` | B3 は*完了*したものに対して「決して格下げしない」とする。ファイル欠落の経路は未定義 | — | 拒否 + 理由コードを追加 |
| 12 | `--outside-model` が Claude の ID で、ネイティブも Claude のとき、同一ファミリーのチェック | モデルファミリーの表 | ルールとして述べられている | なし | フィクスチャを追加 |
| 13 | `findings.jsonl` の件数は一致するが、内容が省略されている | run.json のハッシュによる束縛 | はい(B0) | 省略された指摘のフィクスチャ | 問題なし |
| 14 | 古い `gate_rev` に対する `answer` | 現在のリビジョンで拒否 | はい(B9) | パースのフィクスチャ | 問題なし |
| 15 | `d10 yes`(ID + ベアの yes) | 複数選択肢では曖昧 | ベアの yes/no は拒否。ID + yes は未定義 | 引用のみ | 明記する: ID の後の `yes` は推奨の選択肢。対応表を表示する |
| 16 | 中断された実行で `decisions.jsonl` が半分書かれている | validate が失敗 | 未完了の最初のゲートから `resume` | 中断のフィクスチャ | 問題なし。すべてのライターで原子的な rename を要求する |
| 17 | B7 の不一致の終了コード | B7 の中で終了コード 2 と 1 が矛盾。今日の使用法エラーは終了コード 1(bin/gstack-review-log:81-84) | — | — | F8 |
| 18 | ポリシーを読むとき `origin/<base>` がない(ゲートの VM での shallow clone) | git が失敗する | 述べられていない | なし | ★ F12 |
| 19 | `--after <pr>` の使い捨てワークツリーが、合成されたブランチのキーの下に証拠を書く | 実際のブランチでの `gstack-evidence check` は何も見つけない | 述べられていない | キューの再生ではカバーされない | ★ F13 |
| 20 | 古い VERSION の文字列が、ロックファイルやドキュメント内の無関係な依存関係のバージョンと一致する | 許可された変換の正規表現が書き換える | パスごとのハンク分類。パターンは「exact」 | — | フィクスチャを追加(F14) |
| 21 | 2 人のコーディネーターが 1 つのブランチで 2 回の再スタンプを競合させる | ジャーナル | ジャーナルは実行ごと | 段階ごとの障害注入 | ジャーナルのパスにロックを追加 |
| 22 | ゲートとマージの間に先行 PR の head が動く | `PREDECESSOR MOVED` の拒否 | はい(C3) | 再生に含まれる | 問題なし |
| 23 | 触れた*bash* の bin(インポーターなし)に対する事前ゲートの `lanes` | インポートグラフは何も見つけず → PASS | 述べられていない | — | ★ F15 |
| 24 | `gstack-hermetic-run` が出荷される bin から `test/helpers/hermetic-env.ts` をインポートする | 製品の typecheck の範囲 | 述べられていない | — | F16 |
| 25 | `node_modules` を持つ大きなリポジトリの `regen --check` のスクラッチコピー | 時間 | 「2 分の約束」は計測された | gstack と gbrain で計測 | スクラッチコピーが `cp -r` ではなく `git worktree` を使えば問題なし |
| 26 | `.gstack/ship-policy.json` の `mirror` または `stamp_paths` がリポジトリの外に出る(`..`、シンボリックリンク) | 封じ込めのチェック | C1 は封じ込めを検査すると言う | 名前が挙がっていない | エスケープのフィクスチャを追加 |
| 27 | 事前ゲートでダウングレードされたチェックが、ドリフトしたリポジトリでの初回実行で依然として厳しく失敗する | `warn` のマップ | はい(D5) | — | 問題なし |
| 28 | 10 倍: 33 件の決定を含むゲート一覧、ページ送りの ID | 安定した ID | はい | 一括承認のフィクスチャ | 問題なし |
| 29 | 10 倍: 4 つの voice にまたがる 176 件の未解決を含む `findings.jsonl`、`validate` の参照整合性 | O(n) | はい | — | 問題なし |
| 30 | ratchet のフィクスチャの更新を忘れる → PR B〜E のすべてで parity/context budget の CI が赤くなる | ratchet のテスト | 計画は「パリティを明確にする」と述べるが、PR ごとのレシートがない | — | F6 |

## セクション 3 テスト計画

```
 codepath                                   test file (free unless marked)                      fixture
 ─────────────────────────────────────────  ──────────────────────────────────────────────────  ─────────────────────────────
 A  doctor --check/--for/--require/--json   test/gstack-doctor.test.ts (extend)                 healthy; each missing; wrong host;
                                                                                               no auth; bun range vs exact; win lane pin
    lib/runtime-pins.ts                     test/runtime-pins.test.ts (new)                     package.json engines, .tool-versions, nvmrc,
                                                                                               workflows w/ per-lane pins
    gstack-capy-install                     test/gstack-capy-install.test.ts (new, PATH-stubbed) no-bun; old-bun; conflict; --with-browser; --revision mismatch
    gstack-browser-ensure                   test/gstack-browser-ensure.test.ts (new)             stub playwright dir; lazy marker
    setup --no-browser / --status exit 1    test/setup-status.test.ts (extend)                   broken section link registry
 B  session-kind unattended                 test/gstack-session-kind.test.ts (extend)            override; both-set; unknown value
    skill-start unattended                  test/gstack-skill-start.test.ts (extend)             no telemetry prompt; UPGRADE_AVAILABLE one-liner
    preamble AUQ rule                       test/spawned-consent-rule.test.ts (extend)           unattended never records consent
    headless-artifacts + gstack-artifact    test/headless-artifacts.test.ts (new)                valid; interrupted; missing reviewer; omitted finding;
                                                                                               count/hash mismatch; stale artifact; schema print
    autoplan-run state machine              test/gstack-autoplan-run.test.ts (new)               next→submit→close per phase; answer stale rev; resume
    autoplan export                         test/autoplan-snapshot.test.ts (extend)              plan.md >30KB warn; custom heading
    outside-voice runner                    test/gstack-outside-voice.test.ts (new)              codex-cli stub; api stub; host-subagent result; same-family refusal
    review-log --findings                   test/review-log.test.ts (extend)                     clean/176-open mismatch; resolved-all → clean
    gate-list                               test/gate-list.test.ts (new)                         `all`, `d3b uc1a`, `all except d9b`, `yes`, `d10 yes`, 33 items/pages
    spec-review cap                         test/spec-review*.test.ts (extend)                   cap → cheap pass vs unconfirmed decision
    URGENT block order                      test/autoplan-report-order.test.ts (new)             block precedes summary
    E2E unattended run (paid)               test/skill-e2e-autoplan-unattended.test.ts (new)     this plan; PR B merge gate (Validation 2)
 C  ship-policy init/validate/show          test/ship-policy.test.ts (new)                       containment escapes; head vs base
    restamp                                 test/gstack-restamp.test.ts (new)                    --version; --next; --after; idempotent; dry-run; journal injected failures
    queue replay                            test/gstack-restamp-queue.test.ts (new)              3 PRs, mirror, CHANGELOG, (was X), since:, reorder x2
    tree-receipt                            test/gstack-tree-receipt.test.ts (new)               same-modulo-stamps; changed; lockfile-only; predecessor moved; dep==old version
    regen                                   test/gstack-regen.test.ts (new)                      stale golden; --write; command not authorized (exit 3)
    pregate (per check)                     test/pregate-<check>.test.ts (new, one per lib file)  INCIDENTS.md map: stale goldens, scratch, heavy-only const, win-only change, dropped hunk, |tail
    ship-receipt                            test/gstack-ship-receipt.test.ts (new)               render; read --json; truncation keeps identifiers
    ship/sections/tests.md.tmpl pipefail     test/ship-tests-section.test.ts (structural)         fence contains pipefail + wait $pid
 D  plan-reality resolver                   test/plan-reality-rows.test.ts (structural)          every row id rendered where declared; unattended → incomplete
    plan-gates undeclared-changes           test/plan-gates*.test.ts (extend)                    fixture diff with omitted behavior
    investigate sections + manifest         test/investigate-lazy-sections.test.ts (new)         manifest passive + scope; CARVE_GUARDS entry
    eval cases (paid)                       eval:bg:pr on plan-eng-review/plan-ceo-review/review/investigate
 E  spend-ledger                            test/spend-ledger.test.ts (new)                      spent+reserved>=cap under lock; unknown charges
    lane-check                              test/gstack-lane-check.test.ts (new)                 two branches intersecting
    banned-terms                            test/gstack-banned-terms.test.ts (new)               allowed_paths
    eval-plan skill                         test/context-budget-ratchet (new ceiling), parity (new invariant), skill-size-budget
```

**無料と有料の違い。** 上記のうち無料でないのは、無人 E2E(Validation 2)、変更されたテンプレートに対する `eval:bg:pr` のプロンプト評価(Validation 5)、そして B4 のチェックリストの品質(判定にはジャッジが必要)だけです。計画は有料の作業を安価なチェックの後に回しており、その点は正しいです。`pregate` PR がそれを証明するべきです。

**不足点。** (1) 新しい `gstack-session-kind` と古い `gstack-skill-start` が混在する場合のテストがありません。これはまさにフリートのアップグレード途中の状態です。(2) Bun がない状態(P1 のシナリオ)で `gstack-doctor --check` が動くことを確かめるテストがありません。(3) 現在 `--help` のカバレッジテストは存在しません(`test/help-coverage*.test.ts` がない)。そのため B0 の「`--help` カバレッジテストを付ける」は新規テストになります。名前を付けてください: `test/bin-help-exit-table.test.ts`。このテストでは、新しい bin がすべて終了コード表を表示して終了コード 0 で終わることを検証します。(4) `lanes` のチェックには、変更された bash bin をパスリテラル(F15)経由で起動するテストに対応付けるフィクスチャが必要です。(5) キューの再生には、同時に再スタンプされるケースがありません。(6) `gstack-artifact ack` の冪等性と P7 の集計は、収集パスが未定義(F3)のためテストがありません。(7) Windows: 新しく追加される bash の bin(`gstack-capy-install`、`gstack-codex-login`、doctor)はすべて、Windows 向けの限定サブセット(`scripts/test-free-shards.ts --windows-only`)から除外するか、安全に動くようにする必要があります。計画はこの点に触れていません。(8) 新しいテストファイルには durations のエントリが必要です。なければシャード分割はデフォルト値を使います。最初の PR で `scripts/free-test-durations.json` の扱いを確認し、INCIDENTS.md に記録してください。

## セクション 4 パフォーマンス/サイズ

**コンテキスト予算への影響(今回計測。`parity-harness.ts` の不変条件を `test/fixtures/parity-baseline-v1.64.1.0.json` に対して `bun` で実行):**

| スキル | union バイト数 | 比率 | maxSizeRatio | 余裕 |
|---|---|---|---|---|
| ship | 288 804 | 1.539 | 1.539 | **約 0 B** |
| review | 133 923 | 1.234 | 1.2345 | **約 60 B** |
| autoplan | 115 143 | 1.129 | 1.1305 | **約 150 B** |
| qa | 94 736 | 1.127 | 1.1272 | **約 20 B** |
| plan-eng-review | 145 423 | 1.167 | 1.187 | 約 2.5 KB |
| plan-ceo-review | 160 085 | 1.055 | 1.081 | 約 4 KB |
| plan-devex-review | 129 397 | 1.033 | 1.08 | 約 6 KB |
| investigate (monolith) | 47 702 | 0.787 | 1.12 | 約 20 KB |
| cso | 33 508 | 0.374 | 1.08 | 大きい |

計画が ship(C5、C6、C7、C8 Step 5、Step 16 stage 1、E2 の引き継ぎ)、review(D2、E3 のコントリビューターモード)、autoplan(B1 のガード行、B2 の無人セクション、B12、E3 のブリーフ、B4 のチェックリスト)、qa(E1 のソーク)に加える各テンプレートの編集は、最初の 1 バイトで `test/parity-suite.test.ts` に失敗し、同じコミットで `CARVE_GUARDS` の `maxSizeRatio` を上げ、`capture-context-budget` を更新することを要求します。計画は「すべてのテンプレート編集はパリティを通すこと」と書いていますが、バイト数の予算を立てておらず、その根拠も示していません。これは PR ごとに数時間の隠れたコストになりますし、より重要なのは設計上の圧力になることです。散文で*説明する*より、bin が文面を*出力する*ほう(`gstack-gate render`、`gstack-ship-receipt`、`gstack-pregate` の表)を優先し、新しい散文は遅延セクションに入れてください。遅延セクションは union 比率には含まれますが、即時のコンテキスト予算の上限には含まれません。B4 の 200 行のチェックリスト 4 本は、計画レビュー系スキル全体で約 30〜40 KB の新しい union バイトを追加します。plan-eng-review の余裕は 2.5 KB です。B4 は「追加ではなく置き換え」として予算化し、深いセクションがチェックリストの分だけ縮むようにして、union のバイト増減を PR 本文に記録してください。`eval-plan` は新しいスキルであり、「上限がまったくないスキルが存在する」と `test/context-budget-ratchet.test.ts` が失敗します。PR E でフィクスチャのエントリを追加する必要があります。

**パリティスイートのリスク。** 仕組みそのものは低リスクです(ここでは 269 ms で緑になりました)。しかし、上の表にあるバイト単位の規律については高リスクです。また `test/skill-size-budget.test.ts` は縮小の下限です。B4 がプロセスの重要な部分を即時のテキストから外すと、スケルトンが `minBytes` を下回って plan-* スキルでこのテストが失敗するおそれがあります。切り出す前に `minBytes` を確認してください。

**2 分の事前ゲートの実現可能性。** ステージ 1(`regen --check`、`secrets`、`strays`、`literals`、`links`、`lint`、`patches`、`ratchets`)が gstack で実現可能なのは、`regen --check` が `git worktree` の一時領域を使う場合(`node_modules` を含むリポジトリを `cp -r` する場合は不可)と、`gen:skill-docs --host all` と agents digest を含めても数十秒で収まる場合に限られます。`ratchets`(`module-size`、`state-root`、`parity`、`context-budget`)はそれぞれ数秒です。`literals` はテストツリーに対する grep なので高速です。`lint` は semgrep が入っていないこと(`not installed` と表示する)に依存します。つまり gstack では約 60〜100 秒になります(計測値ではなく `[estimated]`)。gbrain での所要時間は不明です。ステージ 2(`lanes`、`guards`、`hermetic`)はテストを実行するため、設計上は上限がありません。計画は、ここに独自の時間計測を持たせるという判断を正しく行っています。リスク: `lanes` の import グラフの閉包を `scripts/` と `test/` の全体(約 2000 行のファイル)にわたって計算すると、グラフがキャッシュされていれば数秒で済みますが、キャッシュがなければ毎回再パースになります。`HEAD^{tree}` をキーにして `.gstack/tmp` の下にキャッシュしてください。

## 指摘事項

**F1 — 致命的。無人ランナーには、ホストが振り分けるレビュアーのための動詞がない。** B2 は `run|status|answer|resume` を定義し、`run` が「無人ループを所有する」と述べています。しかし Capy マシンでのネイティブな voice は、親が prompt ファイルから振り分けるサブエージェントです(今回のレビューもまさにこの方法で行われました。`nativeDispatchPrompt` は `snapshot.json`、bin/gstack-autoplan-snapshot.ts にあります)。このままでは、`run` は誰も結果を渡せない結果を永遠に待つか、両方の voice を Codex に流して B3 の同一ファミリー規則に違反するかのどちらかになります。根拠: B3 が名前を挙げているのは外部 voice の実行器だけで、Claude Code なしでネイティブ voice がどう生成されるかを定めていません。変更案: `lib/autoplan-run.ts` を明示的なステートマシンにします。`next` は、フェーズ、voice、prompt のパス、期待される結果のパスを表示し、`GSTACK_RESULT: status=awaiting_result` を出して、`gate_pending` に似た形で終了します。`submit --phase <p> --voice native|outside --result <file> --model <id>` は、検証し、ハッシュを `run.json` に結び付け、B11 の照合と `phase-close` を実行します。`run` が `next` のループになるのは、両方の voice をローカルで実行できる実行器(2 つのファミリーに対する `api`)がある場合に限ります。

**F2 — 高。B3 は、レンダリング時のリゾルバに実行時の判断を置いている。** `outsideVoiceFor(ctx)` は `gen:skill-docs` のレンダリング時に `ctx.host` から提供元を選び(scripts/resolvers/outside-voice.ts:8-12)、レンダリングされた文面は `codex` を直接呼び出します(scripts/resolvers/outside-voice-steps.ts:177、:327)。実行ごとに選ばれる `--runner codex-cli|api|host-subagent` フラグは、このリゾルバの中には置けません。置こうとすると、3 つの分岐すべてを各ホストの SKILL.md にレンダリングすることになり、余裕のないスキルには入りきりません。変更案: `lib/outside-voice-runner.ts` の上に新しい `bin/gstack-outside-voice run --runner <r> --prompt <file> --out <file> [--model <id>] [--result <file>]` を作ります。リゾルバは bin の名前と実行器の表を一度だけ記述します。`outsideVoiceFailurePolicy()` は失敗時の文面を引き続き担当し、`codex-cli unavailable; using <runner>` を追加します。

**F3 — 致命的。P7 の採用数に、永続的な収集経路がない。** B0 の `ack`、B2、B10 は `$GSTACK_STATE_ROOT/analytics/autoplan-timing.jsonl` に追記します。しかし A3 は Capy の state root をデフォルトで一時的なものとし、B1 は未回答の送信同意を `off` にします。UC1(a) は、PR D/E の tier 3 を「10 スレッドのうち 6 つを親が消費した」という条件でゲートしていますが、この設計ではそれを数えられません。変更案: すでにマシンの外へ出ている永続的な媒体を使います。すなわち、親が選ぶ `--out` ディレクトリの `run.json.consumed_by` と、PR 本文の `gstack-ship-receipt` ブロック(`session_kind`、`artifacts_consumed: <n>/<m>`)です。さらに `gstack-ship-receipt census --repo <r> --since <tag>` を追加し、`gh` 経由でマージ済み PR 本文から P7 の数値を計算します。state root 上の分析データは、`durable=no` と明記した上でボーナスとして残します。

**F4 — 高。B1 のガード条項は誤った条件を検出し、正しい条件を緩めてしまう。** 公開フック(publication hook)は `host === 'claude'` のときだけレンダリングされ(scripts/resolvers/composition.ts:11)、ファイルがない場合の分岐は拒否します(composition.ts:16-23)。Capy では、ファイルは(リポジトリからインストールされて)*存在し*、フックは一切実行されないため、「フックファイルがない」という条件は決して発火せず、ガードが強制されていないことを報告するものもありません。Claude Code では、ファイルがないことはインストールの破損を意味し、拒否を許可に変えると、唯一の安全装置が取り除かれます(bin/phase-publication-hook の autoplan/bin/phase-publication-hook:4-9 は、壊れたインストールがファイル不在として通過しないよう、まさにそのために存在します)。変更案: Claude のレンダリングでは、ファイル不在時の拒否を維持します。`SESSION_KIND=unattended` のとき(およびフックを使わないすべてのホストのレンダリングで)、`gstack-skill-start` から `autoplan guard: not enforced by this host; publication order is unverified (GUARD_NOT_INSTALLED)` を出力し、B0 の検証器は無人実行について `review-record.md` にその行があることを要求します。「ガードがインストールされていなければ、ガードされたツール呼び出しを許可し、そのことを明示する」というオーナーの方針は、無人ホストではもともとフックが実行されていなかったので、満たされます。

**F5 — 高。A1 の TypeScript によるコンポーネント表は、doctor の「Bun なしでも報告する」という契約を壊す。** `bin/gstack-doctor` は Bash 3.2 と POSIX で書かれており、「bun や python3 がなくても報告できる」ようになっています(bin/gstack-doctor:22)。P1 のシナリオは、何もインストールされていないマシンで、Bun が下限を下回るか存在しない状態です(A2 によると Capy イメージには 1.3.14 が入っていますが、Bun がないと `setup` は :296 で終了します)。`lib/doctor-components.ts` の表は、その状態では読めません。変更案: 表は `bin/gstack-doctor-components.sh` とします(読み込まれるシェルスクリプトで、コンポーネントごとに 1 行。id、ラベル、プローブ関数、修正方法、needed_by)。`--json` や `--for` の解決で TS が必要なら、ビルド時に `lib/doctor-components.ts` から bash の表を生成し、鮮度テストを付けます。これは `agents-digest` が生成されているのと同じ方法です(bin/gstack-version-bump:373-385 にそのパターンが書かれています)。`--check` は、`bun` を `PATH` から取り除いたフィクスチャで実行して検証してください。

**F6 — 高。ゼロ余裕の 4 スキルでバイト予算が計上されていない。** セクション 4 の表を参照してください。ship 1.539/1.539、review 1.234/1.2345、autoplan 1.129/1.1305、qa 1.127/1.1272 です(`test/helpers/parity-harness.ts:247` のデフォルトと、スキルごとの `CARVE_GUARDS`)。B から E までの各 PR は、少なくとも 1 つのスキルに文面を加えます。変更案: 各 PR の受け入れ基準に、スキルごとの union バイト増減と、`CARVE_GUARDS`/`capture-context-budget` を更新するコミットを記載します。B4 は「追加ではなく置き換え」とします。bin が出力できる文面は、すべて bin が出力します。

**F7 — 中。`unattended` は `gstack-skill-start` のホワイトリストに入れないと、黙って `interactive` になる。** bin/gstack-skill-start:93 は `case "$_SESSION_KIND" in spawned|headless|interactive) ;; *) _SESSION_KIND="interactive"` です。B1 は session-kind、preamble、skill-start の名前を挙げていますが、この行には触れていません。失敗の仕方は、意図の逆になります(プロンプトが戻ってきてしまいます)。変更案: `unattended` を case に加えます。未知の kind が `SESSION_KIND: interactive (unknown kind '<x>' from gstack-session-kind)` と表示されることを確かめるテストを加え、混在したフリートで問題が目立つようにします。また、ステップ 0 の上書きが `GSTACK_HEADLESS` より優先されること、そして評価ハーネスがこれを設定しないことを明記してください。

**F8 — 中。B7 の終了コードは、自己矛盾しており、コードとも食い違っている。** 文章では、ステータスの不一致は「終了コード 2」と書かれ、その 3 文後には「拒否された行は終了コード 1、使用方法は 2 のまま」と書かれています。今日のラッパーでは、使用方法の誤りは終了コード 1 で終わり(bin/gstack-review-log:81-84)、バインディングのエラーは `invalid JSON` に飲み込まれています(:88-96)。変更案: B0 の表を採用します。使用方法は 2、拒否された行は 1 で、stderr に `review-log: status mismatch: claimed clean, findings.jsonl has 176 open (REVIEW_STATUS_MISMATCH)` を出します。ラッパーを修正して stderr を通してください(:95 の `2>/dev/null` を削除します)。

**F9 — 中。新しい理由コードは、`lib/gate-outcomes.ts` の契約に合わない。** `GateOutcome.state` は `ran|not_run|unavailable` で、キーは snake_case で、それぞれにアンカーが 1 つずつあります。これは `test/troubleshooting-anchors.test.ts` で検証されています(lib/gate-outcomes.ts:1-18)。`QUEUE_STALE`、`GATE_REUSE_NOT_ELIGIBLE`、`REPO_COMMANDS_NOT_AUTHORIZED` はゲートの状態ではありません。また `ARTIFACT_INVALID_*` はワイルドカードなので、アンカーを 1 つに定められません。変更案: 同じ `{anchor, summary, fix}` の形をした兄弟ファイル `lib/result-codes.ts` を作り、artifact のエラーは列挙します。アンカーのテストを両方の表に広げます。CLI に現れるコードは snake_case のままにするか、SCREAMING_CASE の規約を文書化してください。

**F10 — 中。B4 の `scope` フィールドは、文書化された設計を、そのガードに触れずに覆してしまう。** autoplan/sections/manifest.json:5 は、このマニフェストが PASSIVE で「ここには機械的な述語はない」と書いています。`test/qa-lazy-sections.test.ts:127` は、受動的な解決を検証しています。変更案: 注記と `$schema` を更新し、`scope` は任意とし、既定値は `always` にします。消費者は(F1 の)*ランナー*だけにします。計画どおり、インタラクティブなレンダリングは `scope` を無視します。

**F11 — 中。A2 は `bun upgrade --version <pin>` に依存しているが、Bun 1.3.14 にはそのオプションがない。** このマシンで `bun upgrade --help` を実行すると、`--canary` しか表示されません。`setup:296-305` にはすでに、チェックサム検証付きの `BUN_VERSION=… bash install` の手順が出力されています。変更案: インストーラーはその手順を実行し(ダウンロード、sha256 の出力、`~/.bun` へのインストール、再実行)、A1 の `gstack runtime` の修正行にその手順を引用します。

**F12 — 中。`origin/<base>` からポリシーを読む経路には、シャロークローンやオフラインの場合の扱いがない。** C1 はコミット済みのベースのコピーからピンを読みますが、ゲートの VM はシャロークローンや detached な checkout であることがよくあります。変更案: `origin/<base>` が解決できないときは、`policy source unavailable — fix: git fetch origin <base> --depth=1 (POLICY_SOURCE_UNAVAILABLE)` を出して終了コード 3 で終了します。ワーキングツリーに黙って戻ってはいけません。また `docs/ship-policy.md` に、ベースの読み取りが保護するのはコマンド*文字列*だけであることを、はっきり書いてください(`bun run release:restamp` は PR のスクリプトを実行します。C1 もこれを認めています)。

**F13 — 中。ゲート先行ワークツリーの証拠が、誤ったブランチで管理されている。** レビューと証拠の台帳は、slug とブランチでキーが付けられています(bin/gstack-review-log:18-22、:99、`gstack-evidence` の台帳パス bin/gstack-evidence:13)。合成ブランチを使う使い捨てのマージ用ワークツリーは、その名前の下に書き込みます。そのため、実際のブランチでのレシートの `gstack-evidence check` は何も見つけられず、MISSING と判定されます。変更案: `gate-ahead.json` に証拠のブランチキーを記録し、`gstack-tree-receipt --from` がそれを読むようにします。または、`GSTACK_REVIEW_BRANCH` か証拠のブランチを、ワークツリー内で実際の PR ブランチに設定して渡してください。

**F14 — 中。許可されたバージョン変換には、ファイル種別ごとのルールと、否定のフィクスチャが必要。** C3 は hunk を分類します。危険なのは、古い VERSION(やその npm 形式)が、`package-lock.json`/`bun.lock` や文書の中の無関係な依存関係のバージョンと一致する場合です。変更案: ロックファイルのルールは、ルートパッケージの `version` キーだけに一致させます(`syncNpmLockfiles` はすでにその位置を把握しています。bin/gstack-version-bump:486)。`stamp_paths` のルールは、`(was X)`、`since: X`、`vX` に一致させますが、それは `X` が古い VERSION と等しく、かつ置換後の値が新しい VERSION と等しいときに限ります。依存関係のピンが古いバージョンと等しいフィクスチャは、`changed` と分類されなければなりません。

**F15 — 中。`lanes` は、import グラフを通じて bash の bin をそのテストに対応付けられない。** `test/gstack-doctor.test.ts` は `bin/gstack-doctor` を起動しますが、TS のどのファイルもそれを import していません。先例(`test/helpers/touchfile-closure.ts:1-6、:20`)にはすでに、文字列リテラルによるパスの照合が追加されています。変更案: `lib/pregate/import-graph.ts` は、静的な import とリポジトリパスのリテラル、および `bin/<name>` → `test/<name>*.test.ts` という命名規則の和集合をとります。「レーンが見つからない」は、パスさせずに `FAIL lanes — <file> has no test lane` として報告します。

**F16 — 低。`bin/gstack-hermetic-run` がテストコードを import してしまう。** `buildHermeticEnv` は `test/helpers/hermetic-env.ts:112`(554 行)にあります。出荷される bin がそれを import すると、製品コードとテストコードの型チェックの境界を越えます(`bun run typecheck` と `typecheck:test`)。変更案: 環境を組み立てる処理を `lib/hermetic-env.ts` に移し、テストヘルパーからは再エクスポートします。

**F17 — 低。検証 2 は、PR B のマージゲートを Codex CLI に結び付けている。** 「`OPENAI_API_KEY` だけから得た Codex のログイン」は、B3 が Claude のサブエージェントを完全な外部 voice として受け入れることと矛盾します。変更案: ゲートはどちらの実行器でも受け入れ、どちらが実行されたかを記録します。

**F18 — 低。新しいピンファイルのセキュリティ面は、名前は挙げられているがフィクスチャがない。** `mirror`、`stamp_paths`、`generated.json` のコマンド、`pregate.json` のガードパターン、`banned-terms.json` は、すべてリポジトリが管理する入力です。封じ込め(`..` なし、シンボリックリンクによる脱出なし、glob はリポジトリ内に限定)、コマンド実行は `--allow-repo-commands` の下でのみ、`banned-terms` と `guards` のパターンには正規表現のサイズ上限を設けること、に名前付きのフィクスチャが必要です。`gstack-regen --check` は、一時的なコピーの中でも依然としてコードを実行するので、同じオプトインの背後に置いてください。

**F19 — 低。Windows の限定サブセット。** 新しい bash の bin とテストは、`scripts/test-free-shards.ts --windows-only` で分類されなければなりません。計画はこの点に触れておらず、Windows レーンこそ、C8 が対象とする「実行されなかったプラットフォームのレーン」というインシデントそのものです。

## 必須の成果物

**対象外(確認のうえ拡張)。** 計画の「このウェーブでは行わないこと」リストは有効です(`capy` ホストなし、semgrep/gitleaks のインストールなし、ネイティブ Windows の `/cso` なし、issue のクローズなし、main への stamp なし、プラットフォームのレーンのローカル実行なし)。さらに追加します: P7 のテレメトリ送信は行わない(レシートがそれを運ぶ。F3)、`headless` の BLOCK の意味や評価ケースの意味は変えない、Greptile 階層の語彙は使わない(D8a)、`CARVE_GUARDS` の自動更新は行わない(それぞれが人の目に見えるコミットであるため)。

**既存のもの(レシート)。** doctor の行と終了コード(bin/gstack-doctor:3-16)、セッションの種類と上書き(bin/gstack-session-kind:33-66)、skill-start の kind ホワイトリスト(bin/gstack-skill-start:93)、AUQ の分岐規則(generate-ask-user-format.ts:15-29)、state-root の連鎖とラチェット(lib/state-root.ts:22-29、test/state-root-ratchet.test.ts)、`bindReview`/`reviewFreshness`(lib/review-evidence.ts:178-243)、review-log のラッパー(bin/gstack-review-log:81-99)、version-bump のオプトイン再生成と半端書き込みの経路(bin/gstack-version-bump:373-402、:483-495)、証拠のフィンガープリントと許可リストの比較(bin/gstack-evidence:388-396、:498-512)、レンダリング時の外部 voice(outside-voice.ts:8-12、:217-230)、spec-review の停止規則(spec-review.ts:186-192)、公開フックのレンダリングとバックストップ(composition.ts:7-32、phase-publication-hook:1-15)、gate-outcome の契約(lib/gate-outcomes.ts:1-18)、setup のスキップフラグとステータスの終了コード(setup:1512、:2071-2072、:136-146)、Bun の下限と検証済みバージョン(bin/gstack-bun-version.sh:16-17、package.json:80-81 の `>=1.4.2`、windows-free-tests.yml:85-89)、受動的なマニフェスト(autoplan/sections/manifest.json:5)、パリティ/コンテキスト予算/スキルサイズのラチェット(test/parity-suite.test.ts、test/context-budget-ratchet.test.ts、test/skill-size-budget.test.ts)、モジュールサイズのフィクスチャ(test/fixtures/module-size-ratchet.json: 47 + 4 エントリ。計画が挙げる 3 つの bin は含まれていません)。

**完了の要約。** 計画は根拠がしっかりしており(レシートのほとんどは確認できました)、その判断は正しいです。一方で、最も重要な P2 について、ネイティブのレビュアーの出力がどのように実行に戻るかが不十分に定義されており、リポジトリのラチェットが最も厳しい箇所(ship/review/autoplan/qa のバイト数)については、過信しています。2 つの前提は誤りです(3 つの bin へのモジュールサイズ上限、`bun upgrade --version`)。1 つの約束は、設計のままでは測定できません(P7)。1 つの安全性の変更は誤ったホストを対象にしています(B1 のガード)。1 つのコンポーネントは、その約束のために使う言語として不適切です(doctor の表)。これらは決定を変えるものではなく、PR B の形と、すべての PR の受け入れ基準を変えるものです。このマシンでは確認できなかった主張は、86 秒の Chromium の数字、3.7 秒の Codex のプローブ、gbrain の事前ゲートの時間、PR ごとの作業量の表です(いずれも `[estimated]` であり、計画もそのように明記しています)。

**依存関係と並列化。**
- A は独立しており、最初に入ります(D1)。F5 と F11 は A の中にあります。
- B-core(B0、B1、B7、B9、B10、B12)は、A の `GSTACK_LAUNCH` 行にだけ依存します。B-runner(B2、B3、B4、B8、B11)は、B-core のスキーマと F1/F2 の bin に依存します。この 2 つの半分は、新しいマシン上で並行して開発でき、B-runner は B-core のブランチの上に積み重ねます。
- C-stamp(C1、C2、C3、C5、C7)は、B0(レシートのスキーマ)のみに依存します。C-pregate(C4、C8、C6)は、C1(ピンの信頼境界)と B0(`pregate.json`)に依存します。C-stamp と B-runner は互いに素であり、並行して進められます。C-pregate は C-stamp の上に積み重ねます。
- D は、tier 2 だけが B4(`scope`)に依存します。tier 1 の行は B-core の後に始められます。D のバイト予算の作業(F6)は、コードではなく、長いボトルネックです。
- E の tier 1(E1 の台帳とパイロット)は、`lib/pricing.ts` の抽出を除いて、B から D のどれにも依存しません。E2 のバンドルは C3 に移されました。E の tier 3 は、F3 の census による P7 を待ちます。
- 共有ファイルは、それぞれ 1 人が担当します。`bin/gstack-skill-start`(B-core)、`scripts/resolvers/outside-voice*.ts`(B-runner)、`ship/SKILL.md.tmpl` と `ship/sections/*`(C-stamp の後に C-pregate、直列)、`test/fixtures/carve-guards`/`CARVE_GUARDS`(PR ごとに 1 コミット、その PR の作成者が担当)。

## スコア

- アーキテクチャ: 6/10 — 層構造は正しい(lib が bin の背後にあり、ピン、ひとつの検証器)が、F1/F2/F5 が 3 つのコンポーネントを誤った場所または誤った言語に置いている。
- エッジケース: 6/10 — キューとレシートのエッジは強い。セッション種別、シャロークローン、ワークツリーのキー、bash レーンのエッジが欠けている。
- テスト計画: 7/10 — インシデントのフィクスチャとキューの再生は正しい計測手段である。Bun がない doctor のケース、セッション種別の混在、同時の再スタンプ、Windows の分類、P7 のテストが欠けている。
- 適切なサイズの差分: 4/10 — A、D、E は適切なサイズ。B と C はそれぞれ 2 回のレビューセッションを要し、バイト予算が計上されていない。
- 可逆性: 8/10 — 新しい振る舞いはすべて、新しい種別、新しいピンファイル、新しいフラグの背後にある。`headless` とインタラクティブな経路は変更されない。ガードの変更(F4)は、唯一取り消しにくい編集であり、書かれたままでは出荷すべきではない。
- ratchet の下での保守性: 5/10 — 計画は ratchet に名前を挙げているが、それがどのファイルを上限で縛るかを誤認しており、ゼロ余裕の 4 スキルの予算を計上していない。

## タスク

```json
[
  {"id":"T1","priority":"P1","component":"autoplan-runner","title":"Add next/submit verbs to gstack-autoplan so a host-dispatched native reviewer can return results; run becomes a loop over next only when both voices are local","files":["bin/gstack-autoplan","lib/autoplan-run.ts","lib/headless-artifacts.ts","test/gstack-autoplan-run.test.ts"],"effort_human":"4d","effort_cc":"0.5d","source_finding":"F1"},
  {"id":"T2","priority":"P1","component":"outside-voice","title":"Create bin/gstack-outside-voice (codex-cli|api|host-subagent) and point the resolver prose at it instead of rendering runner branches","files":["bin/gstack-outside-voice","lib/outside-voice-runner.ts","lib/outside-voice-api.ts","scripts/resolvers/outside-voice.ts","scripts/resolvers/outside-voice-steps.ts","test/gstack-outside-voice.test.ts"],"effort_human":"3d","effort_cc":"0.5d","source_finding":"F2"},
  {"id":"T3","priority":"P1","component":"adoption","title":"Carry P7 in run.json.consumed_by and the ship receipt; add gstack-ship-receipt census over merged PR bodies; label state-root analytics durable=no","files":["lib/headless-artifacts.ts","bin/gstack-artifact","bin/gstack-ship-receipt","docs/unattended.md","test/gstack-ship-receipt.test.ts"],"effort_human":"2d","effort_cc":"0.25d","source_finding":"F3"},
  {"id":"T4","priority":"P1","component":"autoplan-guard","title":"Keep deny-on-absent in the Claude render; emit GUARD_NOT_INSTALLED from gstack-skill-start for unattended/non-hook hosts and require it in review-record.md","files":["scripts/resolvers/composition.ts","bin/gstack-skill-start","lib/headless-artifacts.ts","test/autoplan-publication-guard.test.ts","test/gstack-skill-start.test.ts"],"effort_human":"1d","effort_cc":"0.15d","source_finding":"F4"},
  {"id":"T5","priority":"P1","component":"doctor","title":"Component table as sourced bash (or build-time generated from TS with a freshness test); --check fixture with bun removed from PATH","files":["bin/gstack-doctor","bin/gstack-doctor-components.sh","lib/doctor-components.ts","test/gstack-doctor.test.ts"],"effort_human":"2d","effort_cc":"0.25d","source_finding":"F5"},
  {"id":"T6","priority":"P1","component":"budgets","title":"Per-PR union-byte delta and CARVE_GUARDS/capture-context-budget refresh in acceptance; B4 checklists replace rather than add; new eval-plan ceiling","files":["test/helpers/carve-guards.ts","test/fixtures/context-budget*.json","docs/designs/multi-agent-wave-2026-10-10/ACCEPTANCE.md"],"effort_human":"1d per PR","effort_cc":"0.1d per PR","source_finding":"F6"},
  {"id":"T7","priority":"P1","component":"session-kind","title":"Whitelist unattended in gstack-skill-start; loud fallback for unknown kinds; state override-vs-HEADLESS precedence and test both-set","files":["bin/gstack-skill-start","bin/gstack-session-kind","test/gstack-skill-start.test.ts","test/gstack-session-kind.test.ts"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F7"},
  {"id":"T8","priority":"P2","component":"review-log","title":"Adopt exit table (usage 2, rejected 1 with REVIEW_STATUS_MISMATCH); pass bindReview stderr through the wrapper","files":["bin/gstack-review-log","lib/review-evidence.ts","test/review-log.test.ts"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F8"},
  {"id":"T9","priority":"P2","component":"reason-codes","title":"lib/result-codes.ts with enumerated artifact/queue/policy codes and anchors; extend troubleshooting-anchors test","files":["lib/result-codes.ts","lib/gate-outcomes.ts","docs/troubleshooting.md","test/troubleshooting-anchors.test.ts"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F9"},
  {"id":"T10","priority":"P2","component":"sections-manifest","title":"Optional scope field with updated passive-registry note and schema; runner is the only consumer; update qa-lazy-sections test","files":["autoplan/sections/manifest.json","plan-*-review/sections/manifest.json","scripts/resolvers/sections.ts","test/qa-lazy-sections.test.ts"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F10"},
  {"id":"T11","priority":"P2","component":"installer","title":"Replace bun upgrade --version with setup's checksum-verified BUN_VERSION install recipe; doctor fix line quotes it","files":["bin/gstack-capy-install","bin/gstack-doctor","test/gstack-capy-install.test.ts"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F11"},
  {"id":"T12","priority":"P2","component":"ship-policy","title":"POLICY_SOURCE_UNAVAILABLE (exit 3) when origin/<base> is unresolvable; never fall back to the working tree; document the command-string-only trust boundary","files":["lib/ship-policy.ts","docs/ship-policy.md","test/ship-policy.test.ts"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F12"},
  {"id":"T13","priority":"P2","component":"restamp","title":"Record the evidence branch key in gate-ahead.json and read it in the receipt; concurrent-restamp lock on the journal","files":["lib/restamp.ts","lib/tree-receipt.ts","test/gstack-restamp-queue.test.ts"],"effort_human":"1d","effort_cc":"0.15d","source_finding":"F13"},
  {"id":"T14","priority":"P2","component":"tree-receipt","title":"Per-file-type permitted transforms (root package version keys only in lockfiles) and a dep-equals-old-version negative fixture","files":["lib/tree-receipt.ts","test/gstack-tree-receipt.test.ts","test/fixtures/multi-agent-wave/p0-3-dep-equals-old-version/"],"effort_human":"1d","effort_cc":"0.15d","source_finding":"F14"},
  {"id":"T15","priority":"P2","component":"pregate","title":"Import graph unions repo-path literals and bin→test naming; 'no lane found' is FAIL; cache graph by HEAD tree","files":["lib/pregate/import-graph.ts","lib/pregate/lanes.ts","test/pregate-lanes.test.ts"],"effort_human":"1.5d","effort_cc":"0.2d","source_finding":"F15"},
  {"id":"T16","priority":"P3","component":"pregate","title":"Move buildHermeticEnv to lib/hermetic-env.ts and re-export from the test helper","files":["lib/hermetic-env.ts","test/helpers/hermetic-env.ts","bin/gstack-hermetic-run"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F16"},
  {"id":"T17","priority":"P3","component":"validation","title":"PR B merge gate accepts either outside runner and records it","files":["docs/designs/multi-agent-wave-2026-10-10/ACCEPTANCE.md"],"effort_human":"0.1d","effort_cc":"0.05d","source_finding":"F17"},
  {"id":"T18","priority":"P2","component":"pin-security","title":"Containment, opt-in and regex-size fixtures for ship-policy mirror/stamp_paths, generated.json, pregate.json guards, banned-terms.json","files":["lib/ship-policy.ts","lib/regen.ts","lib/pregate/index.ts","bin/gstack-banned-terms","test/ship-policy.test.ts","test/gstack-regen.test.ts"],"effort_human":"1d","effort_cc":"0.15d","source_finding":"F18"},
  {"id":"T19","priority":"P3","component":"windows-lane","title":"Classify every new bash bin and test for the curated Windows subset; add durations entries","files":["scripts/test-free-shards.ts","scripts/free-test-durations.json","scripts/free-test-durations-windows.json"],"effort_human":"0.5d","effort_cc":"0.1d","source_finding":"F19"},
  {"id":"T20","priority":"P1","component":"delivery","title":"Split B into B-core/B-runner and C into C-stamp/C-pregate (seven PRs, stacked); record as decision E1 with the two-gate cost","files":["docs/designs/multi-agent-wave-2026-10-10/ACCEPTANCE.md"],"effort_human":"0.2d","effort_cc":"0.05d","source_finding":"Scope Challenge"}
]
```

**自動決定(推奨の選択肢を採用し、記録済み。質問はしない):** UC1(a)、T20 で修正された D1(a)(7 つの PR: A、B-core、B-runner、C-stamp、C-pregate、D、E)、D2(a)、D3(a)、D4(a)(F12 の拒否を伴う)、D5(a)、D6(a)、D7(a)、D8(a)、D9(a)、D10(a)、D11(a)(F14 のファイル種別ごとのルールを伴う)。新しい決定 E1(PR の分割)は、上記のとおり (a) を推奨します。(b) は PR 5 本のままにし、PR ごとに 2 回のレビューセッションを受け入れる案です。

推奨: 修正してから進めること。決定自体は妥当で、レシートのほとんどは確認できますが、B の PR は、P2 を満たすために submit/next の動詞と、実行時の外部 voice の bin(F1、F2)が必要です。P7 は設計のままでは測定できません(F3)。ガードの変更は誤ったホストを対象にしています(F4)。doctor の表は、P1 のシナリオが持たない言語で書かれています(F5)。また 4 つのスキルには、以降の PR が加える文面を受け入れる余地のパリティがありません(F6)。
