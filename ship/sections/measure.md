<!-- AUTO-GENERATED from measure.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## 測定してから修正するループ(赤いの有料 eval、または失敗した無料スイートのシャード)

ここでのすべての再実行は **診断であり、判定ではありません**。失敗した実行の記録された判定は決して変えず、その成果物は `.context/ship-measure/` の下に `diagnostic` とラベル付けされます(eval の履歴には入りません)。レーンの判定は、最後の 1 回の完全なゲート実行からのみ得られます。合格にするために、予算を上げたり、閾値を下げたり、判定の再試行を追加したり、ケースをスキップしたりしないでください。
以下の `ship-measure` は `bun --no-env-file --config=/dev/null run ~/.claude/skills/gstack/scripts/ship-measure.ts` を意味します。

**失敗した無料スイートのシャード (Step 5)。** 失敗を既存のものと呼んだり、push したりする前に、そのシャードの正確なファイル一覧(実行順)を使って `ship-measure free --files <f1,f2,...>` を再実行します(gstack のローカル実行では `--shard <i>`)。10 回の再実行を行い、1 回目は単独でベースラインとし、残りは並列とラベル付けします。それぞれ独自の HOME と state root を持ち、フレーキーのリトライはオフにし、10 分の上限で実行します。
`ship_rerun_backend=ubicloud` を設定し `UBICLOUD_API_KEY` がある場合は、1 台の Ubicloud VM 上で実行されます。ランナーがファイル一覧を受け付けない場合は、失敗したコマンド全体を 10 回再実行します。合格率、完了した件数(例: 上限までに 10 回中 6 回が完了)、失敗のキャプチャを 1 つ報告し、その後トリアージを続けてください。

**赤いの有料 eval (Step 6)。** 赤いケースごとに:

1. **分類する。** 赤い行の原因、証拠、Expected/Received(`failure_cause`、`failure_detail`。gstack では `bun run eval:pass-rates --run <run> --case <id>`)を読みます。名前を付けます: このブランチによるプロダクトの変更、検出器またはアクターの欠陥、フィクスチャの欠陥、プロバイダーの事象、またはモデルのミス。検出器の修正には、有料の試行の前に無料のリプレイテストを行います。インフラの問題(プロバイダーの障害、ランナーの喪失)による赤は、測定をスキップしてもよいです。その場合は `ship-measure skip --case <id> --reason "<why>"` で、PR 本文に `unmeasured` とラベル付けされます。これは決して合格として数えません。
2. **計画を示す。** `ship-measure table`(試行回数、種類ごとの基準と予算。`ship_measure_*` の gstack 設定キーから)と、見積もりを表示します。見積もりは、合格率の履歴から得た 1 試行あたりのコストに試行回数を掛けたもの、または「estimate unknown」(見積もり不明)です。
3. **測定する。** `ship-measure measure --case <id> --round baseline [--cost-per-trial <usd>]` は、現在の HEAD でそのケースを単独で、その種類の回数だけ並列に実行します。プロジェクトに文書化された単一ケースの eval コマンドを通します。それは `--command '<command> {case}'` です(Step 4 でテストコマンドを見つけるのと同じ方法で見つけます。gstack では不要で、ジャッジの ID を受け付けます)。文書化されたコマンドがない場合は、一度だけ尋ね、その回答をレポートに記録します。終了コード 2 は承認が必要です。理由とともに一度だけ尋ね、その後 `--approved` を付けて再実行します。
4. **終了コードで判断する**(MEETS 9/10、すべての赤が適格な場合の MEETS-qualified 8/10、EXTEND 7/10。振る舞いは 11/12、10/12、9/12):
   - 0: MEETS または MEETS-qualified。完了。
   - 5: needs-classify。キャプチャから、挙げられた各赤を記録します:
     `ship-measure classify --case <id> --round <r> --trials <2,5> --class <class> --evidence "<path:line>"`。
     適格なもの: `provider`(その試行自身のプロバイダーエラーの場合に限る)、`judge-noise`、`model-miss`(行を引用)。修正ラウンド: `timeout`、`hang`、`regression`、`fixable`。`unclassified` は、レビューしたが証拠がないことを意味します。
   - 6: EXTEND。変更のないツリーで、`ship-measure extend --case <id> --round <r>` を一度だけ実行します。3 回目のバッチは決して行いません。
   - 1: BELOW。修正ラウンドを行います。
5. **原因のところを修正する。** `.context/ship-measure/<case>/<round>/tNN/` のキャプチャから、失敗した試行の根本原因を特定し、原因を変更します。
6. **再測定する。** `ship-measure measure --case <id> --round round-<n> --fix "<cause and change>"` を実行し、その後、項目 4 を行います。ケースが修正されたと言えるのは、名前の付いた因果的な変更があり、最後の測定でのすべての失敗が説明されている場合だけです。
   「修正後 at <cause> で k/n を観測」と報告し、証明された合格率とは決して書かないでください。
7. **停止する。** 終了コード 3 は名指しの赤です(ラウンドの上限、予算、または 2 回の無効なバッチ)。停止し、push せず、すべての試行を含めて `ship-measure report` を報告します。

**ゲートは 1 回だけ。** すべての赤いケースが目標以上に測定されたら、完全なゲートを 1 回実行します(Step 6 の項目 2)。プロジェクトの CI が push 時にそのゲートを実行する場合(gstack では、プルリクエストの `evals` ワークフロー)は、push がゲートの実行になります。push してその実行を読み、ゲートのコマンドを別途開始しないでください(push された HEAD に対する gstack の `bun run eval:bg:pr` は、2 回目の有料実行を dispatch します)。`ship-measure report` の表(ケースごとの見積もりと実際の支出)を PR 本文に入れてください。
