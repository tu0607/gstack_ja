# gstack メッセージのトラブルシューティング

表示されたメッセージを探し、その修正手順に従ってください。gstack が実行するチェックはすべて、次の3つの状態のいずれかで終わります。

- **ran**: チェックは実行された。ただし問題が見つかった可能性はある。
- **not run**: gstack がチェックを実行しないことにした(無効にしている、または該当するものがなかった)。
- **unavailable**: gstack は実行を試みたが、実行できなかった。これはカバレッジの欠落であり、合格ではない。

`ran` 以外のメッセージは、次のような形になります。

```
<check>: not run (<reason>). Fix: <command>
<check> unavailable: <reason> (<detail>). No review ran; this is missing coverage, not a pass. Fix: <command>
<check>: ran, verdict unverified (<reason>). Fix: read the output above
```

このページで `unavailable:` または `not run (` の後ろの語句を検索してください。各セクションには安定したリンクアンカーがあります。理由コードとアンカーは `lib/gate-outcomes.ts` から取得されており、コードに対応するセクションがない場合は無料テストが失敗します。

<a id="gstack-doctor"></a>
### スキルを実行する前に準備状況を確認する

`~/.claude/skills/gstack/bin/gstack-doctor` を実行してください(他のホストでは、gstack のチェックアウトで `./setup --status` を実行すると、doctor の絶対パスが表示されます)。doctor は、インストール、state root、Bun、フック、Codex、キャッシュされた Codex モデルチェック、artifacts の同期、browse バンドル、その他のコンパイル済みバイナリ、/cso のネイティブヘルパー、Claude Code、最大のセッションジャーナル、最近の /autoplan ガードコードについて、それぞれ1行ずつ表示します。各行は `ok`、`warn`、`not configured`、`fail` のいずれかで、修正方法が併記されます。終了コードが非ゼロになるのは `fail` の場合だけです。doctor は有料の呼び出しを行いません。Codex の行はキャッシュされたモデルチェックとその経過時間を報告し、`--live` を指定するとそのチェックを一度実行します。バグ報告には出力を貼り付けてください。

---

## モデルポリシー

[モデルポリシーのガイド](model-policy.md)では、2つのティア、6つの設定、優先順位、読み取り専用の確認コマンドを説明しています。解決された選択は、要求したプロバイダーやモデルが実際に動くことの証明ではありません。

<a id="model-policy-config"></a>
### モデルポリシーの設定が無効または読み取れない

**意味。** 新しいポリシーのパスで、整合性のある設定を読み取れなかったか、設定された値が無効でした。読み取れないファイルは「設定なし」として扱われません。そうすると、プレミアムのデフォルトが黙って選ばれてしまうおそれがあるためです。

**修正。** エラーに示されたファイルまたはキーを修復してください。`plan_review_tier` は `frontier`、`smart`、`host` を受け付け、`implementation_tier` は `frontier` または `smart` を受け付けます。既定値に戻すには、空の値を設定するのではなく `gstack-config unset <key>` を使ってください。`set` が拒否された場合、古い値はそのまま残ります。無関係な state ディレクトリを削除するのではなく、所有者や読み取り権限を正してください。
`plan_review_tier = smart` のような不正な行の場合は、報告されたファイルを編集し、その行を修正するか削除してください。`unset` が取り除けるのは正規の `key:` レコードだけで、区切り文字の綴りの誤りや引用符で囲まれたキーは修復できません。

**期待される結果。** `gstack-models list` またはそれに対応する `resolve` コマンドが、どのソースが優先されたかを説明します。このエラーでは外部モデルの呼び出しは行われていません。

<a id="model-policy-provider"></a>
### カスタムプロバイダーには明示的なモデルまたはホストモードが必要

**意味。** ネイティブの設定や環境フラグによって、レビュアーがカスタムエンドポイントやパートナープラットフォームに送られています。公開 API のカタログ識別子が、そこでは有効なデプロイ識別子とは限りません。ネイティブのプロバイダー設定が不正な場合も、gstack は公開エンドポイントを前提にできません。

**修正。** そのリクエストに互換性のあるモデルを指定するか、プロバイダーの gstack 用環境変数による上書きまたは tier モデルの設定を行うか、`gstack-config set plan_review_tier host` を選んでください。認証情報は、モデルの設定ではなく、プロバイダーの通常の認証の仕組みに置いてください。エラーがネイティブ設定の不正を指している場合は、先にそのソースを修正してください。

**期待される結果。** 確認コマンドは、明示的な選択、または正直にホストに委譲された選択を報告します。アカウントの資格を証明するものではなく、公開のデフォルトを、推定されたカスタムエンドポイントに送ることもありません。

<a id="model-policy-selection"></a>
### 選択されたレビューモデルを使用できなかった

**意味。** 要求されたモデルが拒否されたか、プロバイダーがレビューを完了できませんでした。モデルが存在しない、アカウントで使えない、廃止された、または誤って構成されたエンドポイントの背後にある、といった可能性があります。これらを同じ診断として扱わず、プロバイダーの証拠は残してください。外部レビューが成功したことにはならず、gstack は別のモデルに置き換えません。

**修正。** エラーで指定されたソースを変更してください。たとえば、環境変数による上書きは tier の設定より優先されるため、tier を編集しても置き換えられません。その上書きを解除するか修正するか、リクエストに対応するモデルを明示的に指定してください。報告された失敗が認証、クォータ、サンドボックス、タイムアウトによるものであれば、既存の修復手順に従ってください。確認コマンドがリクエストされた ID を示していても、使用者の識別情報が欠けている場合は不明のままです。

**期待される結果。** 次の呼び出しでは、使用するモデルとそのソースを示し、同じ選択を確認したうえで、プロバイダーの実際の結果を報告します。キャッシュされた probe やネイティブのフォールバックは、完了した外部レビューとはみなされません。

<a id="model-policy-freshness"></a>
### モデルカタログの鮮度が不明、古い、または更新が必要

**意味。** 公式の根拠が変わったか、必要なソースを確認できなかったか、保持している根拠がこのカタログやパーサーと一致していません。`unknown/source-unavailable` は最新ではありません。後でソースが失敗しても、以前の廃止の検出結果を消したり、そのメンテナンス課題を閉じたりしてはいけません。

**修正。** freshness ワークフローのレポートと追跡 issue で、失敗したソースと根拠の詳細を読んでください。必要に応じてソースのパーサーやパブリケーションへのアクセスを修復し、その後デフォルトブランチに対してワークフローを手動で実行してください。モデルが置き換えられたか非推奨になった場合は、[メンテナンス担当者向けチェックリスト](model-policy.md#maintainer-update-checklist)に従って、代替モデルを検証するか、サポートされている緩和策を記録してください。新しいリリースがまだ採用されていないという理由だけで issue を閉じないでください。

**期待される結果。** 確認が完了したソースは、現在のカタログに紐づく根拠を生成し、未解決の検出結果は見えたままになります。個人のピンや無関係な PR は変更されません。ワークフローの最終実行日も確認してください。スケジュールされたジョブが一度も実行されていなければ、その不在を自ら報告することはできません。

#### `recoveryRequired` 状態の修復

このフラグは、メンテナンス担当者がレコードを修復するまで issue を開いたままにします。別の取得が成功しただけでは、破損した履歴が正しいと証明されません。

1. 現在の issue の本文を保存してください。保持されている復旧アーカイブも含めます。そのうえで、信頼できる最新のワークフローレポートをダウンロードしてください。その `report.state` を開始時の状態として使ってください。実行 ID、カタログのハッシュ、確認日を推測で作ってはいけません。
2. そのレポートの `lifecycle` 配列を、issue の独立したライフサイクルブロックおよび保持されているアーカイブと照合してください。既知の廃止、期限、人による判断は保持してください。現在カタログにあるモデルが、以前の置き換えによる古い `resolvedByCatalog` フラグを持ち続けてはいけません。
3. issue のエディターで、`state:begin` と `state:end` のマーカー行の間にある有効な JSON を復元してください。同じライフサイクル配列を `lifecycle:begin` と `lifecycle:end` の間に置いてください。独立した所有権と領域のマーカーを復元し、所有範囲外の人間が書いた本文はそのまま残してください。
4. この照合が済んでから初めて、`recoveryRequired` を `false` に設定してください。以前に成功した証拠を検証できない場合は、新しい成功を捏造するのではなく、`lastSuccess` を `null` に設定してください。ライフサイクルの履歴を復元できない場合は、フラグを立てたままにして、issue を調査のため開いたままにしてください。
5. デフォルトブランチに対して **Model-policy freshness** を実行してください。完全で最新の根拠があり、未解決の検出結果がない場合にのみ、issue を閉じられます。パースエラーやソースエラーがあれば issue は開いたままです。合格を作るために履歴を消してはいけません。

## 外部レビュー(Codex と Claude Code)

外部レビューでは、差分、計画、質問を別の AI プロバイダーに送信します。その判定は `lib/outside-review-result.ts` から得られ、`VERDICT: clean|findings|unverified|unavailable` を出力します。P0 または P1 の検出結果を含む `findings` の判定は、ネイティブの P0/P1 と同様にブロックします。`unverified` と `unavailable` はカバレッジの欠落です。/ship と /review は続行しますが、準備状況ダッシュボードと PR 本文にそのギャップを表示し、合格としては決して数えません。

<a id="outside-review-verdict"></a>
### レビューから判定を読み取る方法

- **重大度タグ。** `[P0]`〜`[P3]`、Codex のネイティブ `P1:` ラベル、そして任意の見出し、箇条書き、番号、太字の後に続く行頭の P0〜P3 ラベルです。たとえば `**P1 — x**`、`**P1** — x`、`1. P2 — x`、`P2 —`、`### P1`、表のセル `| P1 |` です。P0 と P1 はブロックします。P2 と P3 は助言です。ラベルの位置にある P0〜P3 のトークンが、これらのどの形式としても読めない場合(`## P1/P2 findings` など)、そのレビューは [`unverified`](#outside-review-unparsed-severity) となり、決して `clean` にはなりません。コードフェンスとインラインコードは引用であってラベルではありません。
- **ラベルの位置にある重大度の語。** `Severity: High`、`Priority: low`、行頭の `High:`、`High —`、`[High]`、`**High**`(任意の見出し、箇条書き、番号の後)、どこにあっても太字の `**High**`、表のセル `| high |` などです。Critical と High は P0 と P1 と同様にブロックします。Medium と Low は P2 と P3 と同様に助言です。散文中の語は数えません。"high-level"、"low-risk"、"a medium-term follow-up"、"no critical findings" は検出結果ではありません。
- **すべてのレビューゲート。** これらのルールは、レビューを要約するすべてのゲートに適用されます。`/codex` の相談と challenge を支える `execution` ゲートも含みます。最後の `Verdict:` 行が `not ready` で、読み取れる重大度がない返答は、`FINDINGS: unspecified` を出力し、ブロックする検出結果と同様に終了コード 3 で終わります。
- **検出結果がない場合。** タグもラベルもないレビューが `clean` となるのは、その結論がそう述べている場合だけです。つまり、最後の文(またはその最後の ", and" の節)、あるいは `Recommendation:` 行の `because` 節が、`NO_FINDINGS`、"No issues found"、"I found no actionable regressions"、"I did not find any bugs" で始まっており、"but"、"however"、"except"、"other than"、"elsewhere" を含まない場合です。ほかの文が先に来る場合、その後の文は、述語("were found"、"is evident")や、コロンで始まる説明を除き、変更全体に限定される必要があります(例: "in this change"、"in the staged changes")。"No issues in the parser." はレビューの結論になりません。返答の他の場所にある "no issues" という表現は数えません。それ以外の場合、レビューは `unverified` となり(下記参照)、決して `clean` にはなりません。重大度のラベルがまったくない `/codex` の相談への回答は、レビューの要約ではないため `clean` のままです。
- **設計提案。** /design-consultation と /office-hours の設計方向の意見は、`proposal` ゲートで読み取られます。完了した提案に必要なのは、`Recommendation: ... because ...` の行だけです。

外部レビューのプロンプトでは、レビュアーに各検出結果を Critical、High、Medium、Low のいずれかで分類するよう求めています。そのため、ほとんどのレビューは `findings` か `clean` になります。

<a id="sourced-helper-location"></a>
### `gstack: cannot load gstack-codex-probe` / `gstack: cannot locate <helper> (shell: ...)` / `CODEX_MODE: helper_unavailable`

**意味。** スキルは `gstack-codex-probe` をコマンドとして実行し、チェックごとにサブコマンドを1つ使います。そのため、エージェントが使うシェルは関係ありません。`cannot load gstack-codex-probe` と `CODEX_MODE: helper_unavailable` は、インストール先でプローブファイルが見つからないか、実行可能ではないことを意味します。

`cannot locate <helper> (shell: ...)` は、`source` でシェルに読み込まれたままのヘルパーから出されます(`gstack-egress-lib.sh` や、スキルがアップグレード前にレンダリングされた場合に読み込まれる Codex プローブ)。そのようなヘルパーは、bash では `BASH_SOURCE`、zsh では `%x` を使って自分のディレクトリを見つけます。それ以外のシェル(dash、sh)や、どのファイルを読んでいるのかシェルが判断できない場合は、パスを推測せずに停止します。メッセージには、認識されたシェルが表示されます。

**修正。** `cannot load` の場合は、gstack のチェックアウトから `./setup` を再実行するか(または `/gstack-upgrade`)。`cannot locate` の場合は、bash または zsh(macOS と Linux の既定)からスキルを実行するか、gstack のインストール先をヘルパーに教えてください。

```bash
export GSTACK_ROOT=~/.claude/skills/gstack   # your install dir; it holds bin/
```

`gstack: sourcing gstack-codex-probe is deprecated ...` と表示される場合、アップグレード前にレンダリングされたスキルが、まだプローブを source しています。2026-10-21 以降のリリースまでは動作し続けます。今すぐスキルを再レンダリングするには `/gstack-upgrade` を実行してください。

**期待される結果。** `~/.claude/skills/gstack/bin/gstack-codex-probe select-model exec` は、どのシェルからでも `CODEX_SEL: <model>` を(stderr には `CODEX_MODEL: <model> (exec; source: ...)` を)出力します。また、事前確認は `helper_unavailable` 以外の `CODEX_MODE` を出力します。`gstack-codex-probe help` はすべてのサブコマンドを表示します。

<a id="codex-sandbox-unavailable"></a>
### `Codex outside review unavailable: Codex's sandbox could not start here (...)`

**意味。** Codex はすべてのコマンドを Linux のサンドボックス(bubblewrap)内で実行します。多くのコンテナや devcontainer では、カーネルが非特権のユーザー名前空間を許可しないため、サンドボックスを起動できず、Codex が試みるすべてのコマンドが失敗します。gstack は、何も読めなかったレビューを信用する代わりに、これを報告します。`CODEX_MODE: sandbox_unavailable` は、有料の呼び出しの前に無料の事前確認で見つかった同じ状態です。

**保持される内容。** 何も外部レビューに送られていないか、レビューは破棄されています。コードとファイルは変更されていません。

**修正。** コンテナで非特権のユーザー名前空間を有効にするか(Docker の場合は、それを許可する seccomp プロファイル)、信頼できるコンテナ内であれば、このシェルで Codex をサンドボックスなしで実行してください。

```bash
export GSTACK_CODEX_NO_SANDBOX=1
```

**期待される結果。** 名前空間が有効なら、次のレビューは `OUTSIDE_STATUS: completed` を出力します。`GSTACK_CODEX_NO_SANDBOX=1` の場合、すべてのレビューは `WARNING: GSTACK_CODEX_NO_SANDBOX=1: ...` を出力します。Codex は、あなたのユーザーが読み書きできるすべてを読み書きできるためです。値が正確に `1` の場合のみ有効で、シェルの環境変数からのみ設定できます。

<a id="outside-review-commands-failed"></a>
### `... outside review unavailable: the reviewer could not run commands or read the diff (...)`

**意味。** レビュアーはコマンドの実行を試みましたが、どれも成功しませんでした。または、その回答がコマンドを実行できなかった、あるいは差分を読めなかったと述べています。その後に書かれた "no issues found" はレビューではありません。

**保持される内容。** なし。回答は上に表示されますが、数えられません。

**修正。** 上に表示されたレビュアーの stderr を読み、指摘された内容を直してから再実行してください。

**期待される結果。** `VERDICT:` 行を含む `OUTSIDE_STATUS: completed`。

<a id="outside-review-execution-failed"></a>
### `... outside review unavailable: the reviewer process failed (exit N: ...)`

**意味。** プロバイダーの CLI が 0 以外の終了コードで終了しました。括弧内は stderr の最初の行です。

**保持される内容。** 部分的な出力は上に表示されますが、数えられません。

**修正。** プロバイダーの診断で示された原因を修正してください(再ログイン、モデルの修正、ネットワークの確認など)。その後、再実行してください。

**期待される結果。** `OUTSIDE_STATUS: completed`。

<a id="outside-review-timeout"></a>
### `... outside review unavailable: the reviewer hit its time limit and was stopped (exit 124)`

**意味。** プロバイダーが期限内に完了せず、停止されました。

**保持される内容。** 部分的な出力は上に表示されますが、数えられません。

**修正。** より小さい範囲で再実行するか、プロバイダーの状態とネットワークを確認してください。

**期待される結果。** `OUTSIDE_STATUS: completed`。

<a id="outside-review-empty-response"></a>
### `... outside review unavailable: the reviewer returned no response`

**意味。** プロバイダーは正常終了しましたが、何も返しませんでした。

**修正。** 上の stderr を読んでから、再実行してください。

**期待される結果。** `OUTSIDE_STATUS: completed`。

<a id="outside-review-refused"></a>
### `... outside review unavailable: the reviewer declined to review`

**意味。** プロバイダーは、レビューの代わりに拒否の回答を返しました。

**修正。** 再実行してください。再び拒否される場合は、ネイティブのレビューに頼ってください。

**期待される結果。** `OUTSIDE_STATUS: completed`。

<a id="outside-review-missing-markers"></a>
### `... outside review unavailable: the response lacks the markers this gate requires (...)`

**意味。** 回答に、このゲートが確認する内容が含まれていませんでした。具体的には、`Recommendation: ... because ...` の行、`SCORE:`/`AMBIGUITIES:` の組、または重大度のタグです。

**修正。** レビューを再実行してください。

**期待される結果。** `OUTSIDE_STATUS: completed`。

<a id="outside-review-unverified"></a>
### `... outside review: ran, verdict unverified (...)` / `OUTSIDE_STATUS: unverified` / `GATE: UNVERIFIED`

**意味。** レビューは完了しましたが、重大度のタグもラベルもなく、検出結果がないという明示的な結論もなかったため、そこから合格か不合格かを読み取ることができません([判定の読み取り方](#outside-review-verdict)を参照)。

**保持される内容。** 回答全体が上に表示されます。

**修正。** 上の出力を読んで判断してください。これは合格ではなく、/ship と /review はカバレッジの欠落として一覧表示します。

<a id="outside-review-unparsed-severity"></a>
### `... outside review: ran, verdict unverified (the review labels a finding with a P0-P3 severity in a form the parser cannot read (line N: "..."))` / `REASON: unparsed_severity`

**意味。** 返答には、行頭に P0〜P3 のトークンがあります。検出結果のラベルが置かれる位置です。しかし、その形式は gstack が単一の重大度として読めないものです(例: `## P1/P2 findings` や `- P2/P3 nits`)。gstack はどの重大度が適用されるかを推測しないため、判定は `clean` ではなく unverified になります。括弧内に引用された行(`UNPARSED:` としても表示されます)が、最初のそのようなラベルです。同じ返答に読み取れる P0 または P1 の検出結果もある場合、その検出結果がブロックし(`VERDICT: findings`、終了コード 3)、解析できなかった行も引き続き表示されます。

**保持される内容。** 返答全体が上に表示されます。

**修正。** 引用された行と返答を読んで判断してください。これは合格ではありません。レビューを再実行し、レビュアーに各検出結果を `[P1] <title>` または `P1: <title>` の形式でラベル付けするよう求めてください。保存された、または修正された返答を再確認するには、gstack のチェックアウトから次を実行します。

```bash
bun lib/outside-review-result.ts --verdict execution reply.md
```

(それらのゲートには `review` または `structured` を使います。)

**期待される結果。** `VERDICT: findings` または `VERDICT: clean` と、P0〜P3 の `FINDINGS:` 値が表示され、`UNPARSED:` 行は出ないこと。

<a id="codex-model-unusable"></a>
### `CODEX_MODE: model_unusable` / `MODEL_UNUSABLE`

**意味。** Codex が選択されたモデルを拒否しました。アカウントがそのモデルを使えない(HTTP 400)、モデルが廃止された、またはカスタムプロバイダーの `base_url` が誤っている(HTTP 404)のいずれかです。`CODEX_MODEL:` の行は、モデル名とその取得元を示します。

**修正。** アカウントで使えるモデルを選ぶか、プロバイダーを修正してください。

```bash
export GSTACK_CODEX_MODEL=<supported-model>
# or edit model / base_url in ${CODEX_HOME:-~/.codex}/config.toml
```

**期待される結果。** `CODEX_MODE: ready`。

<a id="codex-quota-exhausted"></a>
### `CODEX_MODE: quota_exhausted` / `MODEL_QUOTA_EXHAUSTED`

**意味。** アカウントが利用上限に達したため、Codex は呼び出しを拒否しました(`You've hit your usage limit` または `insufficient_quota`)。マーカーの下の行は Codex 自身のメッセージで、リセット時刻と追加購入の方法が書かれています。モデルの選択は問題ありません。gstack は外部のカバレッジを、合格ではなく unavailable として報告し、結果を 15 分間キャッシュするため、その後の実行(および他のスキル)は Codex を呼び出しません。HINT 行には、残りの分数が表示されます。

**修正。** Codex のメッセージに示されたリセット時刻まで待つか、そのアカウントにクレジットや上位プランを追加してください。別のアカウントを使うには、再度サインインしてください。

```bash
codex login
```

gstack の 15 分のキャッシュが切れる前に再確認するには(たとえばクレジットを購入した直後など)、1回だけキャッシュされた結果を無視するか、削除してください。

```bash
export GSTACK_CODEX_PROBE_RETRY=1   # unset it again afterwards
# or
rm -f ~/.gstack/.codex-model-probe  # <state root>/.codex-model-probe
```

**期待される結果。** リセットの後、または `codex login` の後(認証の署名が変わり、直ちに再確認されます)、`CODEX_MODE: ready` になります。

<a id="codex-rate-limited"></a>
### `CODEX_MODE: unverified (rate_limited)` / `MODEL_PROBE_RATE_LIMITED` / `unavailable: Codex rate-limited the review`

**意味。** Codex が HTTP 429(リクエストが多すぎる)を返しました。通常は数秒で解消されます。`quota_exhausted` とは別の状態で、キャッシュされることはありません。プローブの時点ではレビューは引き続き実行され、その結果によって判断されます。レビュー自体の最中に 429 が出た場合は、そのレビューが失敗したことを意味するため、カバレッジは欠落しており、合格にはなりません。

**修正。** 1分後にレビューを再実行してください。429 が続く場合は、プロバイダーのダッシュボードで、そのアカウントまたは API キーのレート制限を確認してください。

**期待される結果。** `CODEX_MODE: ready` となり、レビューが完了します。

<a id="codex-mode-unverified"></a>
### `CODEX_MODE: unverified` / `MODEL_PROBE_INCONCLUSIVE`

**意味。** 短いモデルチェックがタイムアウトしたか、ネットワークエラーが発生したため、gstack はモデルが動作することを確認できませんでした。レビューは引き続き実行され、その結果が確認されます。

**修正。** 今は何もしなくて構いません。その後レビューが失敗した場合は、そのメッセージに理由が示されます。

<a id="codex-auth-failed"></a>
### `CODEX_MODE: not_authed` / `AUTH_FAILED`

**意味。** Codex の認証情報が見つかりませんでした。`CODEX_API_KEY` も `OPENAI_API_KEY` も `auth.json` もなく、`config.toml` のカスタムプロバイダーの `env_key` で指定された環境変数も設定されていません。

**修正。**

```bash
codex login
```

または、プロバイダーの `env_key` が指定する変数をエクスポートしてください。

**期待される結果。** `CODEX_MODE: ready`。

<a id="outside-review-disabled"></a>
### `Codex review skipped (codex_reviews disabled)` / `CODEX_MODE: disabled`

**意味。** 外部レビューを無効にしています。これは `not run` であり、合格でも障害でもありません。

**修正。** 外部レビューを再び有効にするには、次を実行します。

```bash
gstack-config set codex_reviews enabled
```

<a id="outside-review-consent-missing"></a>
### `outside review: not run (outside reviews are turned off ... ). Fix: gstack-config set codex_reviews enabled ...` / `OUTSIDE_STATUS: not_run reason=consent_missing`

**意味。** 送信そのものが拒否されました。`gstack-codex-probe run-with-timeout`、`gstack-claude-code`、`gstack-outside-voice`、そして無人の `gstack-autoplan` ランナーは、リポジトリの内容を外部モデルに送る前に `codex_reviews` を読み取ります。その値が `disabled` の場合、または設定ファイルは存在するものの読み取れない場合(あるいは `enabled` と `disabled` 以外の値が入っている場合)、これらは上の行を表示し、CLI を起動せず、API リクエストも行いません。`codex_reviews` が未設定の場合は既定値の `enabled` となり、そのマシンでの最初の送信時に下の[通知](#codex-review-notice)が表示されます。名前を指定して依頼したレビュー(`/codex`、`/claude-code`)は `--user-invoked` を渡すため、引き続き実行されます。これは `not run` であり、合格でも障害でもありません。`/autoplan` は、このフェーズの外部結果として、`status: disabled`、`outcome: not_run`、`reason: consent_missing` を記録します。

**修正。** 外部レビューを再び許可するには、次を実行します。

```bash
gstack-config set codex_reviews enabled
gstack-config get --stored codex_reviews   # enabled, disabled, unset, or unreadable (exit 2)
```

保存された値の読み取りが終了コード 2 で終わる場合は、表示された `config.yaml` のパーミッションか、不正な `codex_reviews` の行を修正してから、再実行してください。

<a id="codex-review-notice"></a>
### `NOTICE: gstack outside reviews send the review prompt and code to Codex (...) using ...`

**意味。** 外部レビューは既定で有効です。そのマシンで最初に行われるレビューでは、どのプロバイダーがプロンプトとコードを受け取るか、そして費用を負担するログインまたはキーが何であるかが表示されます。これは一度だけ表示され(gstack は状態ディレクトリに `.codex-review-notice-shown` を記録します)、レビューをブロックすることはありません。

**修正。** 望みどおりの状態であれば、何もしなくて構いません。Codex へのコード送信を止めるには、次を実行します。

```bash
gstack-config set codex_reviews disabled
```

**期待される結果。** 以降のレビューは `Codex review skipped (codex_reviews disabled)` または `CODEX_MODE: disabled` を表示し、/ship と /review は外部レビューを未実行として表示します。

---

## /ship、/review、/document-release のトラブル

<a id="ship-no-version-source"></a>
### `Shipped without a version change: no version source is configured (no VERSION file, no .gstack/version-path). ...`

**意味。** /ship が、所有しているバージョンファイルを見つけられませんでした。`VERSION` も `.gstack/version-path` もないか、リリース自動化(release-please、Changesets、semantic-release、ワークスペースのモノレポ、プレースホルダーの package.json のバージョン)がバージョンを管理しています。バージョンの更新については `not run` です。

**保持される内容。** それ以外はすべてリリースされます。バージョンの更新なし、CHANGELOG のバージョン見出しなし、`vX.Y.Z` の PR タイトル接頭辞なし。

**修正。** /ship でリリースのバージョン管理を行うには、`VERSION` を作成するか、ファイルを固定してください。

```bash
echo package.json > .gstack/version-path && git add .gstack/version-path
```

**期待される結果。** 次の /ship が、そのファイルを更新し、CHANGELOG の見出しを書き出します。

<a id="ship-version-source-broken"></a>
### `gstack-version-bump: classify: version source is broken: <path> ...`

**意味。** 固定されたバージョンファイルが存在しない、空である、読み取れない、またはバージョンを解析できません。/ship は `0.0.0.0` を勝手に作ることなく停止します。

**保持される内容。** 何も書き込まれていません。

**修正。** そのファイルを修復するか、`--version-path` / `.gstack/version-path` を修正してください。

**期待される結果。** `gstack-version-bump classify` が現在のバージョンを表示します。

<a id="review-base-stale"></a>
### `BASE_REFRESH: stale <rev>` / `Base coverage: stale at <rev>`

**意味。** /review はベースブランチを取得できなかったため(オフライン、認証情報なし、または Codex のサンドボックスのような読み取り専用の `.git`)、ローカルの `origin/<base>` の `<rev>` と比較してレビューしました。

**修正。** サンドボックスの外で `git fetch origin <base>` を実行し、ベースが進んでいれば /review を再実行してください。

<a id="review-fingerprint-tmpdir"></a>
### `gstack-wtree: cannot create a temp index under <dir>; set TMPDIR to a writable directory` / `gstack-review-log: cannot create a private object directory under <dir>; no working-tree fingerprint. Set TMPDIR to a writable directory.`

**意味。** /review は、一時的なプライベートオブジェクトディレクトリ内でワーキングツリーのフィンガープリントを取ります(Codex のサンドボックスでは `.git` が読み取り専用です)。その一時ディレクトリを作成できなかったため、このレビューにはフィンガープリントがなく、後続の手順でその証拠を再利用できません。

**修正。** `export TMPDIR=<a writable directory>` を実行してから、/review を再度実行してください。

<a id="review-fingerprint-stage"></a>
### `gstack-wtree: cannot stage the working tree: <git error>`

**意味。** フィンガープリントのオブジェクトを書き込めませんでした。単独で実行した `gstack-wtree` は、リポジトリのオブジェクトストアに書き込みます。

**修正。** /review を通じて実行してください(`gstack-review-log` がプライベートなオブジェクトディレクトリを用意します)。または、`.git/objects` を書き込み可能にしてください。

<a id="plan-audit-not-run"></a>
### `Plan completion audit: not run (no plan is bound to this branch and no docs/designs/ file matches). Fix: ...`

**意味。** /ship と /review は、そのブランチに紐づいた計画(plan モード、/autoplan、または PR 本文の `Plan: <path>` 行)に対して PR の監査を行います。紐づく計画がなく、一致する `docs/designs/` のファイルもない場合、無関係な最新の計画を選ばなくなり、監査は `not run` になります。

**修正。** PR 本文に `Plan: docs/designs/<file>.md` を追加するか、/autoplan を実行してください。

**期待される結果。** 次の /ship または /review が、その計画に対する監査を表示します。

<a id="plan-eng-review-not-persisted"></a>
### `PERSISTED: no` / `PERSIST: gstack-review-log '{...}'` / `no saved Eng Review: run the PERSIST: line ...`

**意味。** /plan-eng-review は、呼び出し元が書き込みを禁じている場所で実行されました(たとえば、委任するエージェントが、判定対象の計画を編集できないようにレビュアーを読み取り専用にしている場合)。レビュー自体は完了しています。レビューは `DONE` で終わり、`PERSISTED: no` と記録し、テレメトリとして `success` を記録し、完全なレポートと判断の台帳を返答として返します。何も保存されていないため、/ship の準備状況ダッシュボードには Eng Review の記録がなく、「no saved Eng Review」とともに NOT CLEARED と報告します。実際の失敗(許可された保存が失敗した場合、古い証拠の場合)では、依然として `BLOCKED` で終わります。

**保持される内容。** 返答には完全なレポートが含まれ、その最後の行は、今回のレビューの値を使ったレビューログのコマンドです。

**修正。** レビューされたリポジトリから、返答の最後の行を `PERSIST: ` の接頭辞なしで実行してください。

```bash
~/.claude/skills/gstack/bin/gstack-review-log '{"skill":"plan-eng-review",...}'
```

または、書き込みが許可された場所で /plan-eng-review を再実行し、そのレポートとログを記録してください。

**期待される結果。** `gstack-review-read` が `plan-eng-review` のエントリを一覧表示し、/ship のダッシュボードに Eng Review の行が表示されます(ステータスが `clean` の場合は CLEAR)。

<a id="learnings-bun-missing"></a>
### `gstack-learnings-search: bun not found on PATH, so learnings could not be read. Fix: ...`

**意味。** 学習内容の検索(および `gstack-timeline-read`、つまり「タイムライン」)には Bun が必要です。「学習内容がない」と誤認されないよう、終了コード 127 で終了します。

**修正。** https://bun.sh から Bun をインストールし、その後 `cd <gstack checkout> && ./setup` を実行してください。

**期待される結果。** スキルが、これまでの学習内容を再び表示します。

<a id="learnings-unavailable"></a>
### `LEARNINGS: unavailable (<first stderr line>)`

**意味。** スキルの学習内容の参照が失敗しました(多くの場合、Bun が見つからない)。以前のスキルは、ここで何も表示しなかったため、「学習内容がない」と誤解されていました。

**保持される内容。** 学習内容のファイルはそのままで、スキルは学習内容なしで続行します。

**修正。** 括弧内の理由を読んでください。Bun が原因と示されている場合は、インストールしてから `./setup` を再実行してください。

<a id="log-tmpdir-unwritable"></a>
### `gstack-learnings-log: could not create a temp file in <dir>, so the learning was not recorded. Fix: ...`

**意味。** 学習内容、質問、設定のログは、`${TMPDIR:-/tmp}` 内の一時ファイルを経由して書き込まれます。その書き込みを妨げるサンドボックスでは、以前は黙ってエントリが失われていました。

**修正。** `export TMPDIR=<a writable directory>` を実行し、再度ログを記録してください。

<a id="plan-tune-not-calibrated"></a>
### `CALIBRATION: not calibrated: no recorded signals`

**意味。** 記録された回答が、どの心理特性のシグナルとも一致しなかったため、/plan-tune が調整に使えるものがありません。もう「calibrated」とは表示されません。

**修正。** 登録された質問にさらに回答してから、`gstack-developer-profile --derive` を実行してください。

<a id="artifact-case-collision"></a>
### `ARTIFACTS_SYNC: attention: case-collision held=<N> names=<names>. Artifact paths differ only by letter case, ...`

**意味。** artifacts リポジトリには、英字の大文字小文字だけが異なるパスがあります(例: `projects/MyApp/` と `projects/myapp/`)。Mac や Windows のディスクでは、それらは1つのファイルとして保存されます。そのため、そうした環境の git は、もう一方の綴りでの書き込みをステージしてしまい、同期は成功と報告しても、一方の綴りは変更されたまま残り、他のマシンは古いデータを読むことになります(#3220)。同期は現在、そのようなパスの下にあるキューに入ったファイルをすべて、ステージせずに保留します。ファイルはキューに残り、ほかのものは同期を続けます。ステータスは `ok` ではなく `collision` になります。追跡されているのが片方の綴りだけの場合は、その綴りが同期を続け、新しいエイリアスだけが保留されます。どちらもまだ追跡されていない場合は、両方とも待機します。`<names>` は衝突しているフォルダ名またはファイル名です。`gstack-brain-sync --status` は、保留されたパスを `message` に一覧表示します。新しいエイリアスをリモートに push するローカルのコミット(2台のマシンで両方の綴りを同時に作った場合)は、ステータス `error` で拒否され、ローカルに残ります。

自動では何も修復されません。スラグの解決やスキルの起動には影響せず、影響を受けるのは同期だけです。

**修正。** 1台のマシンで、片方の綴りを手作業で残してください。

1. 残す綴りを選びます。今日そのプロジェクトについて `gstack-slug` が表示するものを選んでください。プロジェクトが異なる綴りに解決される場合(リモート URL が2通りに入力されている、`~/code/MyApp` と `~/code/myapp` の両方でフォルダにアクセスしている場合など)は、先に安定させてください。リモート URL の大文字小文字を修正するか、`GSTACK_PROJECT_SLUG` を設定します。
2. もう一方の綴りの追跡されたファイルを、残す側に統合します。Mac の作業ツリーには片方の綴りしか表示されないため、Git から両方の綴りを読んでください。また、作業ファイルも読んでください。保留された、まだ同期されていない書き込みがそこにあるためです。このループは、捨てる側の綴りの追跡ファイルと、追跡されていないファイル(同期されなかった保留の書き込み)を扱います。JSONL のログは連結され(重複行は除かれます)、それ以外のファイルは、判断のために表示されます。

   ```bash
   cd ~/.gstack
   keep=projects/MyApp; drop=projects/myapp
   { git -c core.ignorecase=false ls-files -- "$drop"; git -c core.ignorecase=false ls-files --others -- "$drop"; } | sort -u | while IFS= read -r f; do
     rel=${f#"$drop"/}
     case "$rel" in *.jsonl) ;; *) echo "decide by hand: $f"; continue ;; esac
     { git show ":$keep/$rel"; git show ":$f"; cat "$keep/$rel" "$f"; } 2>/dev/null | awk '!seen[$0]++' > "$HOME/.gstack-fold.tmp"
     mkdir -p "$keep/$(dirname "$rel")" && mv "$HOME/.gstack-fold.tmp" "$keep/$rel"
     git -c core.ignorecase=false add -f -- "$keep/$rel"
     git -c core.ignorecase=false rm -q --cached --ignore-unmatch -- "$f"
     echo "folded: $keep/$rel"
   done
   ```

   このループが表示する各ファイル(Markdown、`decisions.active.json` などの JSON スナップショット)について、`git show ":$keep/<file>"` と `git show ":$drop/<file>"` を比べ、残す内容を `"$keep/<file>"` に書き込み、その後、同じ `git -c core.ignorecase=false add -f -- "$keep/<file>"` と `git -c core.ignorecase=false rm -q --cached --ignore-unmatch -- "$drop/<file>"` を実行してください。JSON スナップショットを連結してはいけません。その後、コミットして push します。

   ```bash
   git -c core.ignorecase=false commit -m "repair: fold $drop into $keep"
   git push origin HEAD
   ```

   Linux では、2つのフォルダはディスク上で別々です。コミット後、`git -c core.ignorecase=false ls-files --others -- "$drop"` が、統合または移動していないものを何も一覧表示しないことを確認してから、捨てたフォルダ(`rm -r "$drop"`)を削除してください。Mac や Windows では、2つは同じフォルダなので、何も削除してはいけません。
3. 捨てる綴りの保留記録を消し、残す側のファイルをキューに入れます。`--status` が一覧表示する保留パスごとに `gstack-brain-sync --skip-file <dropped path>` を実行し、`folded:` の行ごと、および手作業で移動したファイルごとに `gstack-brain-enqueue <kept path>` を実行してから、`gstack-brain-sync --once` を実行してください。
4. ほかのすべてのマシンでは、次のスキル起動で修復が取り込まれます(または `git -C ~/.gstack pull` を実行してください)。追跡されているパスで大文字小文字だけが異なるものがなくなると、この行は消えます。

<a id="skill-start-former-bucket"></a>
### `gstack: earlier data for this project is in projects/<slug> (a worktree's old bucket). Merge it: ...`

**意味。** リンクされたワークツリーは、メインのチェックアウトとプロジェクトの識別情報を共有するようになりました。ワークツリーが以前の独自のバケットに書き込んだ学習内容やチェックポイントは、まだ残っています。

**修正。** それらを統合してください(ログは重複排除され、競合は一覧表示され、何も上書きされません)。

```bash
gstack-slug --adopt-legacy --from <slug>
```

または、この通知を止めるには、`gstack-slug --adopt-legacy --dismiss <slug>` を実行してください。

---

## デザインスキル

<a id="design-not-available"></a>
### `DESIGN_NOT_AVAILABLE: <path> --version exited <code>`(または `timed out after 10s`、`is not installed`、`no timeout/gtimeout/perl ...`)

**意味。** デザインスキルは、`DESIGN_READY` を宣言する前に、`"$D" --version` を10秒の期限付きで実行するようになりました。終了コード 137 は、macOS が起動時にバイナリを強制終了したことを意味します(コード署名が不正)。セットアップは同じ状態を `design unavailable: <bin> is killed at launch (exit 137) after re-signing` と表示します。

**保持される内容。** 何も生成されておらず、費用も発生していません。

**修正。** バイナリを再ビルドして再署名するセットアップを再実行してください。

```bash
cd <gstack checkout> && ./setup
```

メッセージが不足しているタイムアウト用のツールを示している場合は、coreutils(`gtimeout`)または perl をインストールしてください。

**期待される結果。** 次のデザインスキルが `DESIGN_READY` を表示します。

<a id="design-image-model-invalid"></a>
### `GSTACK_DESIGN_IMAGE_MODEL="<value>" is not a gpt-image model name (expected something like gpt-image-2); fix it or unset it to use gpt-image-2`

**意味。** デザインのバイナリは、リクエストを送る前に、`gpt-image-*` のモデル名ではない画像ツールのモデルの上書きを拒否します。

**修正。** `export GSTACK_DESIGN_IMAGE_MODEL=gpt-image-2`(またはキーで使える別の gpt-image モデル)を実行するか、`unset GSTACK_DESIGN_IMAGE_MODEL` を実行してください。

<a id="design-taste-profile-unavailable"></a>
### `TASTE_PROFILE_UNAVAILABLE: could not resolve the project slug (gstack-slug failed). Fix: run ./setup.`

**意味。** /design-consultation と /design-shotgun は、あなたの好み(taste)のプロファイルを読み込みます。これは、プロファイルが見つからなかったことを示します。好みがないものとして扱うことはありません。

**修正。** `cd <gstack checkout> && ./setup`。

<a id="design-variant-save-failed"></a>
### `cannot save paid image to <path>: <code> (<cause>). Image bytes were received; saved a recovery copy to <tmp path>. Fix: ...`

**意味。** 有料の画像生成は成功しましたが、出力パスへの書き込みに失敗しました(ディスク、パーミッション、または `-999` までのすべての名前が使用済み)。gstack は同じ画像を二重に購入することも、既存の画像を上書きすることもありません。

**保持される内容。** 画像は、一時ディレクトリに表示された復旧パスに保存されています。

**修正。** 表示された修正手順に従ってください(ディスク容量の確保、フォルダの書き込み許可、または新しい `--output` の指定)。その後、復旧ファイルを希望の場所にコピーしてください。

---

## Codex およびその他の環境変数ホスト

<a id="gstack-no-install-found"></a>
### `gstack: no install found (tried <path>). Fix: ./setup --host <host> from your gstack checkout; ./setup --status shows it.`

**意味。** Codex、Factory、OpenCode、Cursor、Copilot、Kiro では、すべての bash ブロックが自力で gstack を探します。まずエクスポートされた `GSTACK_ROOT`(`bin/` と `lib/` を含む)、次にリポジトリ内のインストール、最後にホストのグローバルインストール(Codex では `$CODEX_HOME/skills/gstack`)の順です。どれも存在しませんでした。

**修正。**

```bash
cd <gstack checkout> && ./setup --host codex   # or your host
./setup --status
```

**期待される結果。** `./setup --status` がインストールを一覧表示し、ルーターが実ファイルであり、セクションのリンクが解決されることを示します。

<a id="setup-status-router-symlink"></a>
### `router is a symlink, which Codex skips` / `section links: N of M broken (first: ...)`

**意味。** `./setup --status` は、登録されている各インストールを確認します。Codex はシンボリックリンクされた SKILL.md を無視します。また、リンク切れのセクションがあると、切り出されたスキルは次の手順を読み込めません。

**修正。** `cd <source> && ./setup --host <host>`(コマンドが表示されます)。

<a id="setup-skill-copy-saved"></a>
### `saved your edited <path> to <backup> (setup rewrites gstack's SKILL.md copies on every run)`

**意味。** インストールされたルーターとネストされた SKILL.md ファイルは、実際のコピーになりました。セットアップを実行するたびに書き換えられます。あなたの手による編集は、先に保存されています。

**保持される内容。** あなたの編集内容は `<backup>` にあります。カスタマイズは、ご自身のスキルに移してください。

<a id="setup-skill-copy-backup-failed"></a>
### `error: could not back up an edited SKILL.md copy under <root>; the previous runtime root is unchanged`

**修正。** `<state root>/backups` のパーミッションを修正してから、`./setup --host <host>` を実行してください。

<a id="upgrade-not-a-checkout"></a>
### `ERROR: <dir> is not a gstack checkout; nothing was changed. Re-run Step 2.` / `INSTALL_DIR is not set: re-run Step 2 ...`

**意味。** /gstack-upgrade は、どの git コマンドよりも前に、gstack 自身のチェックアウトの中にいることを確認するようになりました。手順 2 が表示したパスなしでブロックが実行されたため、プロジェクトに触れずに停止しました。

**修正。** 手順 2 をもう一度実行し、ブロックの先頭に `INSTALL_DIR=<printed path>` を付けてください。Windows(Git Bash)で `INSTALL_DIR` が正しく設定されている場合、古い /gstack-upgrade の文言は、同じパスの2通りの綴りを比べてしまい、それでも拒否することがありました。その場合は、`cd <install dir> && git pull --ff-only --autostash && ./setup` で回復できます([フックの誤検知](#setup-hook-does-not-parse)を参照)。

<a id="skill-over-size-limit"></a>
### `<host>/<skill>/SKILL.md is <bytes> bytes, over the 160,000-byte limit. Fix: carve sections with usesLazySections() for this skill.`

**意味。** コントリビューター向けの情報です。ホストが1つの SKILL.md を読み込める上限は 160,000 バイトです。`bun run gen:skill-docs` はリポジトリ内で失敗し、`--install-root` の下では警告を出します。

---

## セットアップと自動更新

<a id="bun-too-old"></a>
### `gstack needs Bun 1.3.3 or newer (1.4.2 recommended); found <version> at <path>. Nothing was installed or changed.`

**意味。** 1.3.3 より古い Bun は、gstack のコンパイル済みツールがプロジェクトの `.env` を読むのを止めるビルドフラグを、黙って無視します。そのため、セットアップは何も書き込む前に拒否します。セットアップを止めない2つの警告にも同じリンクが表示されます。`warning: gstack is tested on Bun 1.4.2 (CI pin); found <version>`(1.3.3 から 1.4.2 は動作しますが、テストされていません)と、`warning: could not read the Bun version (...)`(セットアップは続行されます。`bun --version` を確認してください)です。

**修正。**

```bash
bun upgrade
./setup
```

**期待される結果。** `bun --version` が 1.4.2 以上を表示し、セットアップは Bun の警告なしで完了します。

<a id="auto-update-bun-too-old"></a>
### `gstack auto-update: update held (bun-too-old: found Bun <version> at <path>; gstack <version> needs <floor> or newer); nothing was installed or changed. Fix now: ...`

**意味。** チーム モードの自動更新が、セットアップが実行する Bun より新しい Bun を必要とするリリースを取得しました。チェックアウトとインストール済みのスキルは現在のリビジョンのままにされ、この行はセッションの開始ごとに1回表示されます。(古い自動更新プログラムが最初の更新を実行する場合は、この確認を行えません。)

**修正。** `bun upgrade`。次のセッション開始時に更新が再開されます。今すぐ更新するには、`bun upgrade && cd <gstack checkout> && git pull --ff-only && ./setup` を実行してください。

<a id="bun-version-unreadable"></a>
### `bun-version-unreadable: could not read the version of Bun at <path> (bun --version printed '<output>'); gstack <version> needs <floor> or newer (BUN_VERSION_UNREADABLE)`

**意味。** チェックアウトを移動する前に、自動更新プログラムと `/gstack-upgrade` は、セットアップが実行する Bun と、入ってくるリリースのセキュリティ下限を比べます。`bun --version` がバージョンではない内容を表示したため(制御文字を取り除いた上で表示)、比較を実行できず、更新は保留されました。何もインストールも変更もされていません。`/gstack-upgrade` も、同じテキストを `BUN_VERSION_UNREADABLE:` の後に表示します。以前のリリースでは、読み取れないバージョンや、zsh のもとでのすべてのバージョンを、「下限を下回っていない」と解釈して先に進んでいました(#3195)。

**修正。** Bun を再インストールしてください。壊れたインストールでは `bun upgrade` が動かないことがあります。Git Bash または macOS/Linux のターミナルで次を実行します。

```bash
curl -fsSL https://bun.sh/install | bash
bun --version
```

**期待される結果。** `bun --version` が `1.4.2` などのバージョンを表示し、次のセッション開始時(または `/gstack-upgrade`)に更新されます。

**修正されたバージョン。** v1.91.101.0 以降の最初のリリース(#3195)。

<a id="auto-update-incomplete"></a>
### `gstack auto-update: setup did not finish (<reason>); installed skills may be out of date. gstack retries automatically. Fix now: cd <dir> && ./setup`

**意味。** pull は成功しましたが、セットアップ(またはマイグレーション)が失敗しました。gstack はもう「たった今アップグレードされました」とは表示しません。1時間後、次に6時間後、次に24時間後に再試行し、この行をセッション開始ごとに1回表示します。`(bun not found on PATH)` が理由の場合は、先に Bun をインストールしてください。

**保持される内容。** 以前のインストールが有効なままです。

**修正。** 表示されたコマンドを実行してください。

<a id="auto-update-pull-failed"></a>
### `gstack auto-update: git pull did not finish (exit N: ...); gstack is not updating. Fix now: ...`

**修正。** `cd <gstack checkout> && git pull --ff-only && ./setup`。

<a id="setup-hook-does-not-parse"></a>
### `gstack setup: refusing to register hooks that do not parse (Claude Code would block tool calls with them): <file>:<line>: <error>`

**Windows(Git Bash)の場合、1.91.31 から: 誤検知です。** すべての TypeScript フックが `bun could not bundle the TypeScript entry` で失敗する場合(question-log、question-preference、auq-error-fallback、timeline-stop のフック、`/autoplan` の公開フック、`/plan-ceo-review` のモード引き継ぎフック)、フックには問題がありません。Git Bash は `C:/…` のパスを Bun に渡していましたが、チェッカーは `/c/…` として探していました(#3088、#3100)。main のチェッカーは両方の綴りを読みます。同じ Git Bash の綴りのせいで、`/gstack-upgrade` が `ERROR: <dir> is not a gstack checkout; nothing was changed.` で停止していました。どちらも1つの方法で回復できます。手作業で更新し、その更新からセットアップを実行してください。

```bash
cd ~/.claude/skills/gstack && git pull --ff-only --autostash && ./setup
```

インストール先が `~/.claude/skills/gstack` でない場合は、そのディレクトリを使ってください(`./setup --status` がパスを表示します)。**期待される結果。** セットアップが終了コード 0 で完了し、拒否の行がなく、以後の自動更新が正常に進みます。

**それ以外の環境での意味。** Claude Code は gstack のフックのシム(shim)を `/bin/sh` 経由で実行します。パースできないフックは終了コード 2 で終わり、それが保護するツール呼び出しを、すべてのセッションでブロックします。セットアップは、登録するすべてのフックと、スキルのフロントマターが実行するすべてのフック(`/autoplan`、`/careful`、`/freeze`、`/guard`、`/investigate`、`/plan-ceo-review`)をパースチェックします。対象は、シム、それが source する gstack のシェルヘルパー(`careful/bin/hook-extract.sh` や `bin/gstack-state-root.sh` など)、そして、ローカルのインポートを含めて実行する TypeScript です。どのファイルでも、マージ競合のマーカー行は、ファイルがパースできる場合でも `unresolved merge conflict marker` として失敗します(ヒアドキュメント、文字列、テンプレートリテラル内のマーカーも含みます)。TypeScript は gstack のチェックアウトからバンドルされるため、フックを実行するプロジェクトの `tsconfig.json` や `bunfig.toml` は読み込まれません。セットアップはパースできるフックを登録し、スキップしたものを一覧にし、残りのインストールを完了して、0 以外の終了コードで終わります。Claude Code は `~/.claude/skills/gstack` から直接フックを実行するため、以前のセットアップが登録し、スキップされたフックや、スキルが実行するフックは、修正されるまで壊れたファイルを実行し続けます。これは gstack のバグか、チェックアウトでの編集またはマージが中途半端に終わったものです。表示された `<file>:<line>` を報告してください。

**修正。**

```bash
git -C ~/.claude/skills/gstack status   # half-applied edits or merge conflicts?
git -C ~/.claude/skills/gstack checkout -- <file>   # or finish the merge
cd ~/.claude/skills/gstack && ./setup
```

**期待される結果。** セットアップが終了コード 0 で完了し、拒否の行が出ないこと。

<a id="auto-update-hook-does-not-parse"></a>
### `gstack auto-update: update held (hook-does-not-parse: <file>:<line>: <error>); nothing was installed or changed, and your current hooks keep running. ...`

**Windows(Git Bash)の場合、1.91.31 から: 誤検知です。** 保留の理由が `<hook>.ts:1: bun could not bundle the TypeScript entry` である場合、そのリリースに問題はありません。インストール済みのチェッカーが Git Bash の `C:/…` パスを誤って読んでいます(#3088、#3100)。自動更新プログラムはすべてのリリースをこのチェッカーで確認するため、手作業で一度更新するまで、すべてのリリースを保留します。回復手順は次のとおりです(これで `/gstack-upgrade` の `is not a gstack checkout` による拒否も解消されます)。

```bash
cd ~/.claude/skills/gstack && git pull --ff-only --autostash && ./setup
```

インストール先が `~/.claude/skills/gstack` でない場合は、そのディレクトリを使ってください。**期待される結果。** セットアップが終了コード 0 で完了し、次のセッション開始時に保留の行が表示されず、以後の更新は自動でインストールされます。

**それ以外の環境での意味。** チーム モードの自動更新が、パースできないフック、またはマージ競合のマーカーが残るフックを含むリリースを取得しました(セットアップと同じチェックです)。チェックアウトを移動する前に、入ってくるリビジョンを確認するため、チェックアウト、インストール済みのスキル、登録済みのフックは現在のリビジョンのままです。入ってくるリリース自身の `bin/gstack-hook-check` が判断するため、インストールされているチェッカーのバグが後続のリリースを保留することはありません。ただし、入ってくるチェッカーがクラッシュしたり、何も出力しなかったり、検証できないレポートを出力したりした場合は、インストール済みのチェッカーが判断します。gstack は次の更新チェックで再度確認し、フックがパースできる最初のリリースをインストールします。これは gstack のバグです。表示された `<file>:<line>` を報告してください。

**修正。** 次のリリースを待ってください。手動で `git pull` して `./setup` を実行することは、pull の前に確認できないため、推奨されません。その場合、セットアップが壊れたフックを拒否します(上の項目を参照)。

<a id="auto-update-hook-check-unavailable"></a>
### `gstack auto-update: update held (hook-check-unavailable: <reason>); nothing was installed or changed, and your current hooks keep running. ... Fix now (in a terminal; Git Bash on Windows): cd '<dir>' && git fetch origin && bash bin/gstack-ff-update . '@{upstream}' && ./setup ...`

**意味。** 入ってくるリリースのフックチェッカーも、インストール済みのチェッカーも、入ってくるフックについて検証されたレポートを出せませんでした(クラッシュ、出力なし、読めないレポート、または TypeScript フックをバンドルする Bun がない)。あるいは、入ってくるリビジョンをチェック用に展開できませんでした(`cannot extract the incoming revision: <git's error>`)。そのため、自動更新プログラムは、チェックアウトを移動すると Claude Code のツール呼び出しが壊れるかどうかを判断できません。チェックアウト、スキル、フックは現在のリビジョンのままです。`<reason>` は、各チェッカーが何をしたかを示します。

**修正。** 表示されたコマンドを実行してください。`bin/gstack-ff-update` は、ローカルの編集を失わずにチェックアウトを移動します([退避された編集](#auto-update-rescued-edits)を参照)。セットアップは、登録するすべてのフックをチェックし、問題を示します(たとえば Bun がないなど)。

Windows で、理由が `git archive of the incoming revision failed` の場合、更新プログラムは #3184 の修正より前のものです。[保留されたインストールの回復](#auto-update-held-install-recovery)を参照してください。

<a id="auto-update-held-install-recovery"></a>
### `HELD hook-check-unavailable: git archive of the incoming revision failed` / `gstack auto-update: update held (hook-check-unavailable: git archive of the incoming revision failed) ...` / `gstack auto-update: setup did not finish (bun not found on PATH) ...` on Windows

**意味。** 1.91.89.0 から、#3184 を修正したリリースまでの間、自動更新プログラムは、フックをチェックする前に、入ってくる各リリースを `git archive | tar` で展開していました。Git for Windows の MSYS `tar` は、アーカイブ内でターゲットより前に来る `connect-chrome` のシンボリックリンクを作成できません。そのため、すべてのリリースが保留され(`~/.gstack/analytics/session-update.log` に `HELD` の行が出ます)、古い `setup did not finish (bun not found on PATH)` の行が、その保留を隠すことがありました。インストール済みの更新プログラムは、自分自身の修正を届けられず、古い `/gstack-upgrade` は、ローカルの編集が競合した場合にマーカーを残すことがあります。この回復では、新しいリビジョンから新しい `bin/gstack-ff-update` を private な一時ディレクトリに取得し、それを実行します。クリーンなインストール、ローカルの編集が競合するインストール、すでに未マージのファイルがあるインストール、そしてプレフィックスモードのインストールで動作します。再生成可能な `SKILL.md` と `sections/*.md` の編集は、セットアップが再レンダリングします。それ以外の編集はすべて、退避用の ref に保持されます(コマンドがその ref を表示します。[退避された編集](#auto-update-rescued-edits)を参照)。

**修正(Git Bash)。** (インストール先が `~/.claude/skills/gstack` でない場合は、そのディレクトリを使ってください。)

<!-- form:recovery-gitbash -->
```bash
cd ~/.claude/skills/gstack && git fetch origin main && d=$(mktemp -d) && git show FETCH_HEAD:bin/gstack-ff-update > "$d/gstack-ff-update" && bash "$d/gstack-ff-update" . FETCH_HEAD; s=$?; rm -rf "$d"; [ "$s" = 0 ] && ./setup
```

**修正(Windows PowerShell 5.1)。** (同じスクリプトを Git の `bash.exe` 経由で実行し、その後 `.\setup.ps1` を実行します。)

<!-- form:recovery-powershell -->
```powershell
Set-Location -LiteralPath "$HOME\.claude\skills\gstack" -ErrorAction Stop; $gb = Join-Path (git --exec-path) '..\..\..\bin\bash.exe'; & $gb -c 'set -f; IFS=; git fetch origin main && d=$(mktemp -d) && git show FETCH_HEAD:bin/gstack-ff-update > $d/gstack-ff-update && bash $d/gstack-ff-update . FETCH_HEAD; s=$?; rm -rf -- $d; exit $s'; if ($LASTEXITCODE -eq 0) { .\setup.ps1 }
```

**Claude Code の中では**、上の Git Bash 版を実行するように依頼してください。

**期待される結果。** スクリプトが `ok <old> <new>` または `rescued <old> <new> refs/gstack/rescue/<oid> unmerged=<0|1>` を表示し、セットアップが終了コード 0 で完了し、次のセッション開始時に保留の行が表示されず、以後の更新は自動でインストールされます。

**未リリースの修正を試す場合と、元に戻す場合。** 修正ブランチは出荷前に試すことができます。分離したリビジョンがチェックアウトされている間は、自動更新が一時停止します。`<branch>` は、issue に記載されたブランチ名に置き換えてください。

<!-- form:trial-gitbash -->
```bash
cd ~/.claude/skills/gstack && git checkout -- 'SKILL.md' '*/SKILL.md' '*/sections/*.md' && git fetch origin <branch> && git checkout --detach FETCH_HEAD && ./setup
```

<!-- form:trial-powershell -->
```powershell
Set-Location -LiteralPath "$HOME\.claude\skills\gstack" -ErrorAction Stop; $gb = Join-Path (git --exec-path) '..\..\..\bin\bash.exe'; & $gb -c 'set -f; git checkout -- SKILL.md */SKILL.md */sections/*.md && git fetch origin <branch> && git checkout --detach FETCH_HEAD'; if ($LASTEXITCODE -eq 0) { .\setup.ps1 }
```

リリース版に戻すには(これで自動更新も再開されます):

<!-- form:goback-gitbash -->
```bash
cd ~/.claude/skills/gstack && git checkout -- 'SKILL.md' '*/SKILL.md' '*/sections/*.md' && git checkout main && ./setup
```

<!-- form:goback-powershell -->
```powershell
Set-Location -LiteralPath "$HOME\.claude\skills\gstack" -ErrorAction Stop; $gb = Join-Path (git --exec-path) '..\..\..\bin\bash.exe'; & $gb -c 'set -f; git checkout -- SKILL.md */SKILL.md */sections/*.md && git checkout main'; if ($LASTEXITCODE -eq 0) { .\setup.ps1 }
```

<a id="auto-update-unmerged-files"></a>
### `gstack auto-update: update held (unmerged-files: <n> unmerged file(s) in the install (first: <path>)); an earlier merge, rebase or stash pop left conflicts in the install, and an update would bury them. Fix now (...): cd '<dir>' && git fetch origin && bash bin/gstack-ff-update . '@{upstream}' && ./setup ...`

**意味。** gstack のチェックアウトに未マージのファイルがあります。自分で行ったマージ、リベース、または `git stash pop` によるコンフリクトマーカー、または以前の自動更新プログラム(この修正より前のもの。ローカルの編集が競合したとき、その `merge --autostash` がマーカーを残していました)によるものです。バックグラウンドの更新プログラムは、未マージのファイルがあるチェックアウトを移動することはありません。また、それらが存在する間は、「setup did not finish」の修正手順も表示しません。セットアップがマーカーの上で実行されてしまうためです。

**修正。** 表示されたコマンドを実行してください。まずすべてを保存します。未マージのファイルも含めて、"needs manual resolution" というラベルの付いた退避用の ref に保存されます。その後、チェックアウトをリリースに移動して、セットアップを実行します。退避内容は [退避された編集](#auto-update-rescued-edits) の下のコマンドで読めます。自分で競合を解決する場合は、マージを完了するか中止してください(`git -C '<dir>' merge --abort`、`git -C '<dir>' checkout -- <file>`)。gstack は次の確認で再試行します。

<a id="auto-update-autostash-unrecoverable"></a>
### `gstack auto-update: update held (autostash-unrecoverable: <reason>); your local edits are where they were and nothing was installed. Look first: git -C '<dir>' status --short. Fix now (...)` / `autostash-unrecoverable: <reason>`

**意味。** `bin/gstack-ff-update` は、チェックアウトを移動することを拒否し、何も変更しませんでした。`<reason>` がその理由を示します。リリースが追跡されているファイルを置く場所に、追跡されていないファイルがある(`git refused to update ...: would be overwritten`)、更新の実行中にファイルが変わった、別の git コマンドがインデックスのロックを保持している(`index.lock exists`)、またはその名前の退避用 ref が、すでに別のコミットを指している、のいずれかです。

**修正。** 表示された `status` コマンドを実行し、一覧表示された追跡されていないファイルを邪魔にならない場所に移すか(または別の git コマンドの終了を待ち)、その後、表示された `Fix now` のコマンドを実行してください。復元するものはありません。ローカルの編集は作業ツリーにそのまま残っています。

<a id="auto-update-rescued-edits"></a>
### `gstack auto-update: your local edits in the install (<files>) conflicted with an update, so they were saved in refs/gstack/rescue/<oid> and the install runs the update. ...` / `rescued <old> <new> refs/gstack/rescue/<oid> unmerged=<0|1>`

**意味。** gstack のチェックアウトで追跡されているファイルを編集していて、リリースが同じ行を変更しました(またはステージされた変更や未マージのファイルがありました)。Claude Code がフックを実行するチェックアウトにコンフリクトマーカーを残す代わりに、`bin/gstack-ff-update` は編集内容を1つのコミット `refs/gstack/rescue/<oid>` として保存し、チェックアウトをリリースに移動しました。退避のコミットの最初の親は、以前のリビジョンなので、含まれるのは編集内容だけです。2番目の親には、ステージされていた内容が入っています。競合しなかった編集はそのまま残ります。再生成可能な `SKILL.md` と `sections/*.md` の編集(スキルのプレフィックス、gbrain のブロック)は、退避されるのではなく、セットアップが再レンダリングします。セッション開始時の行は、その ref を削除するまで、1日1回繰り返し表示されます。

**修正。** まず確認してください。

```bash
git -C ~/.claude/skills/gstack show --stat 'refs/gstack/rescue/<oid>'
```

編集内容を残すには、変更内容だけを書き出し、一時的なチェックアウトで適用してください(インストール先では決して `stash apply` を使わないでください)。

```bash
git -C ~/.claude/skills/gstack diff 'refs/gstack/rescue/<oid>^' 'refs/gstack/rescue/<oid>' > ~/gstack-local-edits.patch
git clone https://github.com/garrytan/gstack.git ~/gstack-scratch && cd ~/gstack-scratch && git apply -3 ~/gstack-local-edits.patch
```

"needs manual resolution" というラベルの退避には、すでに未マージだったファイルが含まれています。その内容にはコンフリクトマーカーが含まれている可能性があるため、解決してください。作業が終わったら、その ref を削除してください(これで毎日の表示も止まります)。

```bash
git -C ~/.claude/skills/gstack update-ref -d 'refs/gstack/rescue/<oid>'
```

<a id="setup-runtime-root-contains-checkout"></a>
### `gstack setup: refusing to replace <root> for <host>: this runtime directory contains the source checkout setup runs from (<checkout>), so replacing it would delete the checkout. Nothing was changed.`

**意味。** セットアップは、Codex、Factory、OpenCode、Cursor、Copilot、Antigravity については、ランタイムのルート(`~/.cursor/skills/gstack` など)を構築し、古いものと入れ替えることでインストールします。Kiro については、`~/.kiro/skills/gstack` に書き込みます。gstack のチェックアウトがそのルートにあるか、その内部にあるため、入れ替えるとチェックアウトが削除されてしまいます(#3084)。Kiro の場合は、チェックアウトを自分自身にリンクしてしまいます。セットアップは、何かを書き込む前に拒否します。`./setup --status` と `gstack-doctor` は、`./setup --host <host>` の代わりに、そのホストについての移動の手順を提案します。

**修正。** チェックアウトを外に移してから、その新しい場所からセットアップを実行してください。セットアップは正確なコマンドを表示します。`~/.claude/skills/gstack` がチェックアウトへのシンボリックリンクである場合、チェックアウトがそのシンボリックリンクの位置に置かれます。

```bash
rm ~/.claude/skills/gstack && mv ~/.cursor/skills/gstack ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --host claude && ./setup --host cursor
```

そうでない場合は、ホストのスキルディレクトリの外に移してください。

```bash
mv ~/.cursor/skills/gstack ~/gstack && cd ~/gstack && ./setup --host cursor
```

**期待される結果。** 両方のセットアップが終了コード 0 で完了し、`./setup --status` が各ホストを `current` と表示します。

<a id="host-renders-pruned"></a>
### `pruned <dir> (<host> is not installed from this checkout): ...` / `kept <path>: not proven generated (...)` / `host-render backup: <dir> (...)`

**意味。** gstack のチェックアウトは、そこからインストールされたエージェントのスキルだけを保持します。その一覧は、チェックアウト内の `.gstack-installed-hosts` にあります(#1694)。古いインストールでは、すべてのエージェントのコピーがレンダリングされていたため、グローバルな Claude のインストールには、Claude Code と Cursor-agent がスキャンする 632 個の `SKILL.md` ファイル(34.7 MB)がありました。セットアップは、このチェックアウトからインストールされていないエージェントのコピーを削除しました。生成されたファイルは、表示されたバックアップディレクトリに移動されました。チェックアウトへのリンクは削除されました。gstack が生成したと証明できないファイル(`kept ...`)は、そのまま残されました。バックアップ内の `prune.log` にすべてのパスが記載されています。同じ剪定は、アップグレードのマイグレーションからも一度実行されます。記録にあるエージェントは、決して剪定されません。

**修正。** 使っていないエージェントであれば、何もしなくて構いません。そのエージェントを戻すには、このチェックアウトからインストールすると、記録されてスキルがレンダリングされます。

```bash
./setup --host <name>
```

手作業でレンダリングする指示のみのエージェント(Hermes、OpenClaw、GBrain)の場合は、まず `.gstack-installed-hosts` にその名前を追加し、その後 `bun run gen:skill-docs --host <name>` を実行してください。1つのファイルを戻すには、バックアップから `mv` で戻します。`kept` のファイルはあなたのものです。必要がなくなったら、移動または削除してください。バックアップは、どのエージェントもスキャンしない gstack の state root にあります。不要だと確信できたら削除してください(v1.91.65 より前の Claude のインストールで約 36 MB)。

**期待される結果。** 次の `./setup` は `pruned` の行を表示せず、`./setup --status` は使っているエージェントを一覧表示します。

<a id="cso-windows-msvc-compile"></a>
### `CSO unavailable: its native helper was not built (windows-msvc-compile)`

**意味。** Visual Studio のコンパイラは見つかりましたが、/cso のネイティブヘルパーをコンパイルできませんでした。セットアップは最初のコンパイラエラーを表示します。以前は「Visual Studio をインストールしてください」と表示していました。

**修正。** 表示されたコンパイラエラーを修正してから、`./setup` を再実行してください。

<a id="cso-build-or-publish-failed"></a>
### `CSO unavailable: the native helper's <stage> step failed (...)` / `CSO publish step failed (...) for <revision>; previous CSO kept: <revision>`

**意味。** /cso のネイティブヘルパーは任意です。そのビルドの前提条件は満たされていましたが、`build` の段階(ヘルパーのコンパイル)か、`publish` の段階(ロックの下で新しいヘルパーを `bin/` に入れ替える)が失敗しました。以前はセットアップがここで停止していましたが(#3071)、今は他のすべてを完了させ、どの段階が失敗したかを示します。以前のヘルパーがインストールされていて、失敗した publish がそれを戻した場合、セットアップは `previous CSO kept` を表示し、/cso はそのヘルパーを使い続けます。そうでない場合、/cso は `not assessed` を報告します。`interrupted` は、結果を記録する前にその段階が強制終了されたことを意味します。結果は `bin/.gstack-cso-build-result` にあり、`gstack-doctor` の `cso` の行は同じ記録を読みます。ビルドの出力は `bin/.gstack-cso-build.log` にあります。

**修正。** ログを読み、報告された内容を修正してから、gstack のチェックアウトから再試行してください。
```bash
bun run build:cso && ./setup
```

Windows では、セットアップとビルドは、`pwsh`(PowerShell 7)がインストールされていればそれを使い、なければ Windows PowerShell 5.1 にフォールバックします。#3071 で、公開中にステージされたファイルが消える根本原因はまだ分かっていません。遭遇した場合は、ログをそこに添付してください。CI は `GSTACK_STRICT_BUILD=1` を設定します。これにより、これらの失敗は致命的となり、ビルドの回帰が隠れなくなります。

**期待される結果。** セットアップが CSO の行を表示せず、doctor の `cso` の行が `ok` になります。

<a id="cso-windows-docker"></a>
### `Docker found at <path>, but native Windows Docker transport is not supported yet; static assessment only.` / `docker.exe at <path> is outside the trusted install locations (...)`

**意味。** Windows では、/cso は `docker.exe` を、Windows が報告する Program Files、Program Files (x86)、Windows ディレクトリのインストールフォルダの下でのみ探します。実パスで確認し、途中にシンボリックリンクやジャンクションがないものに限ります。ユーザーが書き込めるディレクトリは信頼されません。Docker の子プロセスはレジストリの認証情報を持つためです。この拒否は上書きできません。

信頼された `docker.exe` であっても、/cso の隔離されたコンテナを、まだ実行できません。/cso が許可するのは、ローカルの Unix Docker ソケットだけです。Windows の Docker Desktop は、名前付きパイプで通信します。/cso はこれを報告し、静的な評価のみを実行します。コンテナやランタイムのチェックは実行されません。

**修正。** ランタイムのチェックを行うには、Linux または macOS(WSL2 は Linux と数えます)で、ローカルの Docker ソケットを使って /cso を実行してください。Windows では、静的な評価がサポートされているモードです。拒否のメッセージがユーザーディレクトリを示していた場合は、Docker Desktop を Program Files の下にインストールしてください。

<a id="cso-capacity"></a>
### `Snapshot manifest cap exceeded: ...` / `64 MiB source cap exceeded: ...` / `Symlink or special source file: <path>`

**意味。** /cso は、監査を始める前に、リポジトリのプライベートなスナップショットをコピーします。スナップショットが不完全になるか、大きすぎる場合は、実行全体を拒否します。各メッセージは、適用された上限を示します。

- **スナップショットのマニフェストの上限(16 MiB)。** 追跡されているか、無視されていない追跡対象外のファイルごとに1エントリです。約 50,000 個のファイルが収まります。
- **64 MiB のソースの上限。** 依存関係ディレクトリと VCS ディレクトリの外にあるすべてのそのようなファイルのサイズの合計です。1 MiB を超えるファイルも、その内容が監査から除かれていても含まれます。
- **シンボリックリンク。** リポジトリのどこかに追跡されたシンボリックリンクがあると、実行が停止します。

**修正。** これらの上限を引き上げる設定はありません。64 MiB のソースの上限については、監査したいリポジトリ相対のディレクトリをカンマ区切りで `--paths` に指定して再実行してください(例: `--paths src/core,src/mcp`)。それ以外のパスは、取得も評価もされず、上限にも数えられません。その場合、スナップショットと履歴のカバレッジは **partial** と表示され、スキップされたパスはすべてレポートに数えられ、実行のスナップショットのマニフェストに一覧されるため、判定は何が監査されなかったかを示します。`--diff` を使う場合、依存関係ディレクトリ以外で変更されたパスはすべて `--paths` の中になければ、実行は拒否されます。手で切り詰めたコピーを監査してはいけません。/cso はそれをリポジトリ全体として扱い、何もスキップされたと報告しないためです。`--paths` は、マニフェストの上限や 100,000 エントリの上限を下げるものではありません。スキップされたパスにも、マニフェストのエントリがあるためです(約 50,000 個のファイルが収まります)。シンボリックリンクは削除する必要があります。ファイル数やサイズを [#2993](https://github.com/garrytan/gstack/issues/2993) に追記してください。

<a id="cso-scanner-invalid-output"></a>
### `INVALID_OUTPUT: Scanner report is malformed, unsupported, or exceeds structural limits.`(実際のリポジトリでの Semgrep)

**意味。** v1.91.101.0 より後の最初のリリースより前は、/cso は、電話番号やカード番号に見える数値に、引用符のない `<REDACTED-...>` のマーカーを重ねることで、スキャナーの JSON レポートを墨消ししていました。たとえば Semgrep の `"max_memory_bytes":1145427776` やエポックのタイムスタンプなどです。その結果、レポートはパースできず、スキャナーは評価されなかったと記録されていました(#3185)。今は、墨消しされた数値は引用符付きの文字列 `"<REDACTED-...>"` になり、レポートはパースできます。JSON のトークンをまたぐような墨消しは、なお内容を伏せます(`REDACTION_FAILED`)。

**修正。** gstack を更新(`/gstack-upgrade`)してから、/cso を再度実行してください。このコードがまだ表示される場合、スキャナー自体が不正な JSON を出力しています。スキャナーとそのバージョンを https://github.com/garrytan/gstack/issues に報告してください。

**修正されたバージョン。** v1.91.101.0 より後の最初のリリース(#3185)。

<a id="cso-orbstack-argv0"></a>
### `unsupported argv0 "docker-tools"`(/cso 下の OrbStack の `docker`)

**意味。** /cso は `docker` の正規パス(シンボリックリンクを解決したもの)を実行します。OrbStack の `docker` は、1つのマルチコールバイナリ `docker-tools` へのシンボリックリンクで、そのバイナリは起動された名前によって何をするかを決めます。実際の名前で起動すると拒否されたため、Docker の隔離と、すべてのスキャナーが欠けていると報告されていました(#3187)。今は /cso が、同じ検証済みバイナリを `docker` という名前で起動します。クリーンアップのウォッチドッグの中でも同じです。

**修正。** gstack を更新(`/gstack-upgrade`)してから、`gstack-doctor` を実行してください。OrbStack が動いていれば、その `cso` の行が合格になるはずです。

**修正されたバージョン。** v1.91.101.0 より後の最初のリリース(#3187)。

<a id="conductor-auq-hook-removed"></a>
### `removed the AskUserQuestion preference hook: it breaks Conductor's native AskUserQuestion (#2207). ...`

**意味。** Conductor では、セットアップは plan-tune の質問設定フックをもうインストールしません。以前に追加されていた場合は削除します。他の plan-tune のフックは残ります。

**修正。** それでも残したい場合は、`gstack-config set plan_tune_hooks yes` を実行してから、`./setup` を実行してください。

<a id="browse-extension-id-invalid"></a>
### `Error: browse_extension_id '<v>' is not a Chrome extension ID ... Existing value left unchanged.`

**修正。** `chrome://extensions` から32文字の ID(a から p の文字)をコピーし、`gstack-config set browse_extension_id <id>` を実行してください。

---

<a id="install-check-gstack-doctor---check-and-the-capy-installer"></a>
## インストールの確認(`gstack-doctor --check`)と Capy インストーラー

`gstack-doctor --check` は、コンポーネントごとに `PASS | FAIL | SKIP <id>` の行を1つずつ表示し、最後に `gstack: ok <revision> for=<workflow>`(終了コード 0)または `gstack: fail <id,id>`(終了コード 1)を表示します。FAIL の行には、すべて `fix:` の節と、以下のコードのいずれかが付きます。末尾の行は直接読んでください。`--check` を `tail` や、終了ステータスが doctor のものを置き換えてしまうコマンドにパイプしてはいけません(docs/capy-install.md)。

<a id="doctor-component-missing"></a>
### `FAIL <id> — <detail>; fix: <command> (COMPONENT_MISSING; ...)`

**意味。** 選択されたワークフロー(`--for <skill>`、`--require <csv>`、またはデフォルトでは、このチェックアウトからインストールされたすべてのホストプロファイル)が必要とするコンポーネントが、インストールされていない、ビルドされていない、最新ではない、または認証されていないことを示します。その行にはそれが示されています。`claude` または `codex`(ホストプロファイルが欠けているか古い)、`patch`(Codex のレンダリングにモデルの振る舞いのパッチがない)、`codex-cli`(Codex CLI が必要だが、存在しないかログインしていない)、`browse-bundle`、`browser`(Chromium が起動またはレンダリングしない)、`cso`(ネイティブヘルパーが必要だがビルドされていない)です。

**修正。** その行の `fix:` の節にあるコマンドを実行してください。`browser` の場合は、`<checkout>/bin/gstack-browser-ensure` です。インストーラーが Chromium をスキップしている場合(`SKIP browser (lazy; ...)`)、初回の使用時にインストールされます。

**期待される結果。** その行が `PASS` になり、末尾の行が `gstack: ok` になります。

<a id="doctor-runtime-below-minimum"></a>
### `FAIL runtime — bun <version> ... (RUNTIME_BELOW_MINIMUM; ...)`

**意味。** `PATH` 上の Bun が存在しないか、gstack のセキュリティ下限(1.3.3。古い Bun は、コンパイルフラグの no-autoload を無視します。[bun-too-old](#bun-too-old) を参照)、またはサポートされている最小値(1.4.2。CI の固定値であり `engines.bun`)を下回っています。ダッシュボード(`--check` なしの `gstack-doctor`)は、テストされていないバージョンを警告しますが、`--check` は失敗させます。テストされていないランタイムでのゲートの実行は、この確認が防ぐためにある事故だからです。Capy の既定のクラウドイメージは 1.3.14 を含むため、新しい Capy マシンは、インストーラーが Bun をアップグレードするまでここで失敗します。

**修正。** `bin/gstack-capy-install` は、`./setup` を実行する前に、セットアップのチェックサムで検証された手順を使って Bun をアップグレードします。手動で行う場合は、`https://bun.sh/install` をダウンロードし、その SHA-256 を `bin/gstack-bun-version.sh` の `GSTACK_BUN_INSTALL_SHA` と照合してから、`BUN_VERSION=1.4.2 bash <file>` を実行し、`./setup` を再実行してください。

<a id="doctor-project-pin-mismatch"></a>
### `FAIL pins — bun <version> outside engines.bun >=1.4.2 (package.json:<line>; ...) (PROJECT_PIN_MISMATCH; ...)`

**意味。** 対象のプロジェクト(`--project <path>`、既定では現在のディレクトリの git のトップレベル。gstack のチェックアウトは決して対象にしません)が、実行中のものが満たさない Bun または Node のバージョンを固定しています。固定は `package.json`(`packageManager`、`engines`)、`.tool-versions`、`.nvmrc`、`.bun-version`、そして `.github/workflows/*.yml` 内の `bun-version:` / `node-version:` の行から取得されます。範囲(`>=1.4.2`)と厳密な固定は区別されます。CI の固定は、そのプラットフォームのレーンに限定されます。Windows のジョブの固定が、Linux の実行を失敗させることはありません。ダッシュボードは警告し、`--check` は失敗させます。Bun が存在しない場合、その行は `SKIP pins (no bun to evaluate the project pins)` になります。これは決して黙って行われません。

**修正。** インストールされた固定バージョン(このプラットフォーム向け)を入れるか、プロジェクトの固定を変更してください。行には、各制約とそのソースが示されます。Capy では、その行の修正は正確なブートストラップのコマンド `bash <skill>/scripts/install.sh` です(`--check` を付けないのと同じコマンドです)。これは、固定が検証済みのバージョンを指定している場合に、固定された Bun をインストールし、`gstack: ok` で終わるか、引き上げるべき固定を名指しした `RUNTIME_PIN_CONFLICT` で停止します。

<a id="doctor-revision-unmet"></a>
### `FAIL revision — installed <version> (requested <ref>) (REVISION_UNMET; ...)`

**意味。** `--revision <ref>` は、doctor に特定の gstack のリビジョン(VERSION の文字列、タグ、ブランチ、またはコミット)を認定するよう求めましたが、チェックアウトは別のものにあります。満たされていないリビジョンは決して `ok` になりません。

**修正。** チェックアウトを移動してください。`<checkout>/bin/gstack-upgrade`(デフォルトブランチの先端。対話的には `/gstack-upgrade`)、または `git -C <checkout> fetch origin && git -C <checkout> checkout <ref> && ./setup`。`bin/gstack-capy-install --revision <ref>` は、既存のチェックアウトを決して移動しません。`gstack: ok <installed> (requested <ref>; run <checkout>/bin/gstack-upgrade to move)` と報告します。

<a id="capy-install-runtime-conflict"></a>
### `gstack-capy-install: Bun conflict: gstack needs >=<minimum>, <project> pins <constraint> (RUNTIME_PIN_CONFLICT; ...)`

**意味。** インストーラーは、検証済みの Bun のアーカイブを1つだけインストールします。gstack のサポートされている最小値か、その最小値より上で、メッセージの `verified archives:` に挙げられているプロジェクトの厳密な固定です。ここでは両者が合わないため(たとえば、プロジェクトが `bun@1.3.14` を固定している場合や、gstack が検証済みのアーカイブを持たないバージョンの場合)、インストーラーは何も変更せず、`./setup` の前に停止しました。

**修正。** プロジェクトで検証済みのバージョンを固定するか、そのバージョンを検証できるリリースに gstack を更新するか、プロジェクトが受け入れる Bun を持つマシンに gstack をインストールしてください。`--project <path>` は、どのプロジェクトの固定を適用するかを指定します。

<a id="browser-ensure-failed"></a>
### `gstack-browser-ensure: NEEDS_SETUP ... (BROWSER_UNAVAILABLE; ...)`

**意味。** Chromium なしでインストールされたマシン(`SKIP browser (lazy; gstack-browser-ensure installs on first use)`)で、最初のブラウザスキルを実行すると、セットアップのロックの下で `bun x playwright install chromium` を通じて Chromium のインストールを試みました。あるいは、Chromium はインストールされていますが、起動しません。

**修正。** 上のインストーラーの出力を読んでください。オフラインやプロキシ経由のマシンでは、Playwright の CDN へのネットワークアクセスが必要です。Ubuntu 24.04 以降では、AppArmor のユーザー名前空間のエラーに `GSTACK_CHROMIUM_NO_SANDBOX=1` が必要です。その後、`<checkout>/bin/gstack-browser-ensure` を再実行してください。インストーラーの `--with-browser` は、今すぐブラウザが欲しいマシンでインストールを前倒しします。

<a id="capy-install-preflight-failed"></a>
### `gstack-capy-install: preflight: <tool> not found (INSTALL_PREFLIGHT_FAILED; ...)`

**意味。** インストーラーは、`./setup` の前に `git`、`curl`、`node`、`jq` を確認し、Bun がない場合や、サポートされている最小値を下回る場合は Bun をインストールします。いずれかのツールが欠けているか、Bun のインストールスクリプトのチェックサムが `GSTACK_BUN_INSTALL_SHA` と一致しませんでした(ダウンロードは破棄され、何も実行されません)。

**修正。** 指定されたツールをインストールしてから(`apt-get install -y jq`、nodejs.org または nvm からの Node)、`bin/gstack-capy-install` を再実行してください。チェックサムの不一致は、上流のインストーラーが変わったことを意味します。新しいスクリプトを確認した後にだけ、`GSTACK_BUN_INSTALL_SHA` を更新してください。

<a id="upgrade-refused"></a>
### `gstack-upgrade: <cause>; nothing was changed; fix: <command> (UPGRADE_REFUSED)`

**意味。** `bin/gstack-upgrade` は、チェックアウトをリモートのデフォルトブランチの先端まで、fast-forward でのみ移動します。何かを変更する前に拒否しました。ディレクトリが gstack のチェックアウトではない、HEAD がデタッチされているか別のブランチにある(固定されている)、追跡されているファイルが変更されている、ローカルのコミットがリモートのブランチにない、入ってくるリリースの Bun の下限が PATH 上の Bun より高い、または別の更新プログラムが `<state root>/.setup-lock` を保持している、のいずれかです。stash、reset、破棄は決して行いません。

**修正。** 表示されたコマンドで、指摘された原因を解決してください(表示された変更をコミットまたは移動する、デフォルトブランチをチェックアウトする、ローカルのコミットを別のブランチに移動する)。その後、`bin/gstack-upgrade` を再実行してください。fast-forward の後に失敗した再インストールは、次の実行で完了します(`reinstall pending from <version>`)。

<a id="upgrade-busy"></a>
### `gstack-upgrade: live gstack sessions hold this installation: pid <p> (<age>m), ...; nothing was changed; fix: ... (UPGRADE_BUSY)`

**意味。** 複数のエージェントがこのチェックアウトを共有しています(たとえば、1台のマシンの Capy のサブエージェント)。セッションの開始ごとに、ワークフローのリース `<git dir>/gstack-leases/<harness pid>` が書き込まれます(`bin/gstack-lease touch`、`bin/gstack-skill-start` から)。`bin/gstack-upgrade` は、何かを変更する前に拒否しました。pid が生きていて、かつ自身のプロセスの祖先に含まれないリースが存在するためです。fast-forward すると、ワークフローの途中のセッションの下で gstack が変わってしまいます。120 分より古いリースは剪定されます。プロセスが終了したリースは、決してブロックしません。古いリースも同様です。各リースは、そのプロセスの開始の識別情報を記録するため、再起動やマシンのスリープ後に pid が再利用された場合(GBRA-105 のリースは pid 379 を指していましたが、それは dbus-daemon になっていました)は、ブロックせずに回収されます。アップグレードを行う側のセッション(その実行を行う pid の連鎖)は、決して数えられません。

**修正。** それらのセッションが終わるまで待ってください(`bin/gstack-lease list` は、すべてのリースを、その経過時間と `alive|dead|stale` とともに表示します。保持しているものは `pid <p> (<age>m <command>)` と名指しされます)。その後、`bin/gstack-upgrade` を再実行してください。それらが休止していると分かっている場合は、`GSTACK_UPGRADE_FORCE=1 bin/gstack-upgrade` で続行できます。Capy のセッション開始時には、同じ拒否が `SELF_UPGRADE: skipped (live gstack sessions hold this installation: ...)` として表示され、末尾の行は `gstack: fail behind — … (UPGRADE_BUSY)` になります。アップグレードできなかったセッションが、ok と認定されることはありません。

<a id="upgrade-fetch-failed"></a>
### `gstack-upgrade: could not reach origin (...) (UPGRADE_FETCH_FAILED)`

**意味。** リモートのデフォルトブランチを一覧にも取得もできませんでした(オフライン、プロキシ、認証情報)。そのため、`--check` はチェックアウトが最新かどうかを判断できません。取得なしに `current` と報告することはありません。

**修正。** チェックアウトの origin へのネットワークアクセスを確認(`git -C <checkout> remote -v`)してから、再実行してください。

<a id="revision-below-minimum"></a>
### `gstack: fail revision — installed <v> is below the supported minimum <m> (<cause>); fix: ... (REVISION_BELOW_MINIMUM)`

**意味。** デフォルトブランチの `capy/support.env` は、そのインストーラー、末尾の行、修正の行が正直である最も古いリビジョン(`GSTACK_MIN_REVISION`)を宣言しており、このチェックアウトはそれより古いです。Capy のスキルのブートストラッパーは、それを `FETCH_HEAD` から読むため、そのファイルより前のチェックアウトでも、この値を知ることができます。`--check` は報告するだけです(`fast-forward available`)。インストールモードでは、クリーンで固定されていないチェックアウトを fast-forward し、1つのロックの下で再インストールして再確認します。原因は、何も移動しなかった理由を示します。`pinned by --revision`、`pinned: HEAD is detached`、`tracked files changed: <files>`、`diverged: ...`、または `auto-upgrade disabled`(`GSTACK_CAPY_AUTO_UPGRADE=0`)です。`gstack-doctor --check --min-revision <m>` は、revision の行を同じように失敗させます。

**修正。** 修正の節のコマンドを実行してください。ブートストラッパーを `--check` なしで実行するか、`<checkout>/bin/gstack-upgrade` を実行します。固定の場合は `--revision` を外すか、最小値以上のリビジョンを固定してください。fast-forward の後で、インストールが中断されると、末尾の行は `fail` のままになります。次のインストールの実行で完了します。

<a id="capy-wrapper-stale"></a>
### `FAIL wrapper — ... (CAPY_WRAPPER_STALE)` / `WARN wrapper — ...; owner action: ...` / `gstack-capy-skill: owner action — Drive copy is wrapper <n>, minimum <m>; ...`

**意味。** Capy のスキルフォルダが、チェックアウトの `GSTACK_CAPY_MIN_WRAPPER`(`capy/support.env`)より古いです。doctor の `wrapper` の行は、アクティブなラッパーの来歴(ブートストラッパーがエクスポートする `GSTACK_CAPY_WRAPPER_REV` と `GSTACK_CAPY_WRAPPER_PATH`)によって判断します。最新のアクティブなラッパーは合格します。一方、他の場所にある古い Drive のコピーは `WARN` の行になります。これはオーナーの対応事項であり、実行を失敗させることはありません。来歴がない場合(`gstack-doctor --check` の直接実行、または `GSTACK_CAPY_WRAPPER=` の行がない、ブートストラッパー以前のコピー。ラッパーのバージョン 0 として読まれます)は、Drive のコピー(`~/.capy/drive/*/skills/gstack/scripts/install.sh`、または `GSTACK_CAPY_WRAPPER_PATH` が設定されている場合はそれだけ)を読み、すべてのコピーが古い場合にだけ失敗します。その場合、各コピーをそのリビジョンとともに一覧にします。古いアクティブなラッパーも `WARN` です。古いコピーでも動作するためです(`capy/support.env`)。`bin/gstack-upgrade` は、チェックアウト自身のコピーをアクティブなラッパーとしてインストーラーを実行し、ラッパーの行だけが失敗の原因である場合に、保留中の再インストールを残しません。

**修正。** このセッションでは、チェックアウト自身のコピーを実行してください: `bash <checkout>/capy/skill/gstack/scripts/install.sh --check --for <skill>`。これは最新の来歴を持つため、古い Drive のコピーを変更せずに、認定します。オーナーは、`<checkout>/capy/skill/gstack/` を Drive のスキルフォルダに上書きコピーするか(Capy では、ユーザースコープの Drive の `skills/gstack/`)、Capy に再同期させてください。Drive のコピーが変わるまで、このメッセージは毎セッション表示されます。エージェントがスキルフォルダに書き込むことはありません。

<a id="bun-resolution-drift"></a>
### `FAIL runtime — bun resolution drifted: recorded bun <v> at <path> (<rule>), now <current>; changed: <what>; fix: ... (BUN_RESOLUTION_DRIFT)`

**意味。** インストールと `--check` は、1つの契約(`bin/gstack-bun-version.sh` の `gstack_bun_resolve`。`lib/pregate/runtime.ts` の `resolveBun` と対になっています)を通して Bun を解決します。その契約は、プロジェクトの厳密な固定と、ランタイムストアにある gstack のインストール既定値(`<state root>/runtimes/bun/<version>/bun`)、次に `$BUN_INSTALL/bin`、`~/.bun/bin`、そして PATH の順で見ます。gstack の最小値とプロジェクトのすべての固定を満たす最初の Bun が選ばれます。インストールは、このチェックアウトとプロジェクトのために、その選択を検証の判定に記録します(`bun_path`、`bun_version`、`bun_rule`)。記録された Bun が消えているか、別のバージョンを報告するか(その場で置き換えられた)、gstack の最小値やプロジェクトの固定を満たさなくなっています。今、先に解決されるかもしれない別の候補(別のプロジェクトのインストールがストアに公開した Bun、変更された `BUN_INSTALL`)は、ドリフトではありません。`--check` は記録された Bun を保持し、`note: the recorded bun ... stays certified` を表示し、新しい選択を記録するインストールの実行を名指しします。パイプラインのレーンとガード(`lib/pregate/runtime.ts`)と、ワークフローの開始は、検証が記録した Bun が消えているか変わっている場合に、このコードで拒否します。

**修正。** 行の修正を実行してください。これはインストーラーで、現在の選択を記録します。または、資格のあるものが何も残っていない場合は、検証済みの Bun をストアに再ダウンロードします。次の `--check` は合格します。

<a id="bun-install-version-invalid"></a>
### `gstack-capy-install: GSTACK_BUN_INSTALL_VERSION=<v> is not a verified Bun at or above gstack's supported minimum ...; fix: ... (BUN_INSTALL_VERSION_INVALID)`

**意味。** `GSTACK_BUN_INSTALL_VERSION` は、プロジェクトの厳密な固定が決めない場合に、インストーラーがダウンロードする Bun を上書きします(`GSTACK_BUN_DEFAULT`、1.4.3)。その値は `GSTACK_BUN_VERIFIED`(SHA-256 で検証されたアーカイブ)に含まれ、gstack のサポートされている最小値(`GSTACK_BUN_TESTED`)以上である必要があります。何もインストールされていません。

**修正。** 変数を解除するか、メッセージが一覧表示する検証済みのバージョンの1つに設定してください。

<a id="install-unverified"></a>
### `INSTALL: fail verdict — <detail>; fix: ... (INSTALL_UNVERIFIED)`

**意味。** Capy のマシン(`GSTACK_CAPY=1`。`GSTACK_LAUNCH` の行で設定されます)では、無人または生成されたワークフローは、合格のインストール判定(`<state root>/install-verdicts/<sha256 of the checkout path>.json`。`GSTACK_INSTALL_VERDICT` として名指しされます)を持ち、かつこのチェックアウト、その現在の HEAD、そして開始されるワークフロー以上の範囲を対象とする場合にのみ開始されます。`--for autoplan` の判定は、`qa` のブラウザを対象としません。計画だけの pins SKIP は、リポジトリのテストを実行するワークフローを対象としません。`gstack-skill-start` がこの行を表示し、`GSTACK_RESULT: skill=<s> status=refused run=-`、終了コード 3 で終わりました。同じ開始は、Capy のマシン以外でも、Bun が PATH 上で最小値未満である無人の実行を拒否します(`INSTALL: fail runtime ... (RUNTIME_BELOW_MINIMUM)`)。

**修正。** このマシンで `--for <workflow>` を付けて Capy のスキルインストーラーを実行し、それが表示する `GSTACK_LAUNCH` の行で起動してください。`GSTACK_ALLOW_UNSUPPORTED_RUNTIME=1` は、そのまま許可します(`INSTALL_VERDICT: overridden` と表示されます)。これは逸脱として記録してください。

---

## Capy: 承認、Captain のブリーフ、PR のスクリーンショット

これらは、gstack の Capy 向けの変更が追加するコマンドによるものです。`gstack-approvals`(スレッドごとの承認記録)、`gstack-owner-brief render --captain`(before/after の形式による計画の依頼)、`gstack-pr-shots`(PR 本文用の before/after 画像)です。ガイドは `capy/skill/gstack/captain.md` にあります。

<a id="approval-record-invalid"></a>
### `gstack-approvals: ... (APPROVAL_RECORD_INVALID)`

**意味。** 必須フィールド(`--ask`、`--words`、`--scope`、`--by`)が欠けているか、値が列挙された範囲外にあります(`--outcome approved|rejected|pending|standing`、実在する `YYYY-MM-DD` の日付ではない `--date`)。または、長さの上限を超えています(ask、scope、pending は 300 文字、words は 2,000 文字)。終了コードは 2 です。何も書き込まれていません。

**修正。** 必須のフラグをすべて付け、行に示された上限の範囲内にして、再実行してください。

<a id="approval-record-secret"></a>
### `gstack-approvals: ... (APPROVAL_RECORD_SECRET)`

**意味。** あるフィールドが、gstack のシークレットスキャナー(push ガードと同じもの)に一致しました。その行には、フィールド名と検出ルールが示されますが、一致したテキストは示されません。終了コードは 3 です。ローカルにも Drive のミラーにも、何も書き込まれていません。

**修正。** シークレットを `[redacted]` に置き換えて、その言葉を記録するか、本人にその言葉を言い直してもらってください。それが本物のシークレットであった場合は、ローテーションしてください。

<a id="approval-record-no-branch"></a>
### `gstack-approvals: ... (APPROVAL_RECORD_NO_BRANCH)`

**意味。** 記録はブランチごとに保持されます(1つの Capy スレッドは1つのブランチを出荷します)。HEAD がデタッチされているか、作業ディレクトリが git リポジトリではありません。終了コードは 3 です。

**修正。** 作業を出荷するブランチをチェックアウトするか、`--branch <name>` を渡してください。

<a id="approval-record-unavailable"></a>
### `gstack-approvals: ... (APPROVAL_RECORD_UNAVAILABLE)`

**意味。** このマシンには記録がなく、state root は一時的なもの(Capy のマシン)で、Drive のミラーも解決できません。そのため、「承認はない」と、「古いマシンとともに記録が失われた」とを区別できません。`render` はセクションを出力しますが、「No approvals recorded」の代わりに「Record unavailable on this machine」と表示します。終了コードは 1 です。

**修正。** 記録がある場所で実行するか、スレッドのレポートから行をコピーし直すか、private な Drive のミラーを解決できるようにしてください(`~/.capy/drive/project-user-*` フォルダが1つ、または `GSTACK_APPROVALS_DIR`)。

<a id="approval-record-write-failed"></a>
### `gstack-approvals: ... (APPROVAL_RECORD_WRITE_FAILED)`

**意味。** ローカルの記録、またはその Drive のミラーに書き込めませんでした。その行にはパスとエラーが示されます。ローカルへの追記に失敗した場合、何も書き込まれていません。ミラーへの書き込みに失敗した場合、ローカルの行はそのまま残ります。終了コードは 1 です。

**修正。** 指定されたディレクトリを書き込み可能にしてから、`gstack-approvals sync` を再実行してミラーし直してください。

<a id="approval-import-unanswered"></a>
### `gstack-approvals import: ... (APPROVAL_IMPORT_UNANSWERED)`

**意味。** autoplan の実行には、回答されたゲートがありません(すべての判断が保留のまま)。そのため、取り込むものがありません。終了コードは 3 です。

**修正。** ゲートに回答(`gstack-autoplan answer ... --by human|agent:<id>`)してから、再度取り込んでください。取り込みは冪等なので、再試行しても回答が二重に記録されることはありません。

<a id="captain-brief-incomplete"></a>
### `gstack-owner-brief render --captain: ... (CAPTAIN_BRIEF_INCOMPLETE)`

**意味。** 計画に、ブリーフが必要とするセクションが少なくとも1つ欠けています。`## Before → after`、`## Why it matters`、`## What caused this work`、`## Big decisions` のいずれかです。ブリーフは表示されますが、冒頭に "Not ready for approval" と書かれ、返信の依頼は含まれません。終了コードは 1 です。

**修正。** 指定されたセクションを計画に追加し(レビュー中の場合は `gstack-autoplan revise --plan <file>`)、再度レンダリングしてください。`--allow-incomplete` はプレビュー用に終了コード 0 で終わりますが、本文には依然として準備ができていないと書かれます。

<a id="pr-shots-input-not-found"></a>
### `gstack-pr-shots: ... (PR_SHOTS_INPUT_NOT_FOUND)`

**意味。** 入力が見つかりません。`--before/--after` のファイル、`--base` の ref、両側にない `--path`、または両側にない `--heading` のいずれかです。終了コードは 3 です。

**修正。** その行に示された ref、パス、または見出しを確認してください。

<a id="pr-shots-input-refused"></a>
### `gstack-pr-shots: ... (PR_SHOTS_INPUT_REFUSED)`

**意味。** PR の画像は公開されるため、入力は何もレンダリングされる前に拒否されました。入力がシークレットスキャナーに一致した(その行に側、行番号、ルールが示されます)、バイナリである、512 KiB を超える、リポジトリと state root の外にある、または `-` で始まる ref を指定した、のいずれかです。終了コードは 3 です。

**修正。** キャプチャからシークレットを取り除くか、追跡されているテキストファイルを撮影してください。

<a id="pr-shots-identical"></a>
### `gstack-pr-shots: ... (PR_SHOTS_IDENTICAL)`

**意味。** before と after が同じテキストなので、撮影すべき変更がありません。終了コードは 1 です。

**修正。** このブランチが変更したファイルまたはセクションを撮影してください(`git diff --stat origin/<base>...HEAD`)。

<a id="pr-shots-render-failed"></a>
### `gstack-pr-shots: ... (PR_SHOTS_RENDER_FAILED)`

**意味。** ブラウザは利用可能でしたが、`shot.html` のレンダリングに失敗しました。その行にはレンダラーのエラーが示されます。`shot.html` と `text.md` は依然として書き出されます。終了コードは 1 です。ブラウザがまったくない場合、コマンドは代わりに `SHOT_PNG: unavailable (...)` を表示し、終了コード 0 で終わります。

**修正。** 幅 880 px で、ご自身のブラウザを使って `shot.html` のスクリーンショットを撮るか、`text.md` を使ってください。

## ブラウザ

<a id="browse-runtime-version-skew"></a>
### `[browse] this install's browse CLI (<root>, build <hash>) and the gstack checkout's server bundle (<checkout>, build <hash>) are from different builds, so the server was not started. ...`

**意味。** Windows では、ホストのランタイムのルート(`~/.codex/skills/gstack` およびその他の環境変数ホスト)には、browse のコピーがあり、`node_modules` がありません。そのため、その CLI は、`.source-path` に記録された gstack のチェックアウトにあるサーバーのバンドルを起動します。チェックアウトが再ビルド(または更新)されたのに、このランタイムのルートは更新されなかったため、両者のビルドが異なります。食い違ったサーバーを実行しないよう、browse は実行を拒否します。

**修正。** メッセージに名指しされたチェックアウトからセットアップを再実行してください。すべてのランタイムのルートを再ビルドし、更新します。

```bash
cd <checkout> && ./setup
```

<a id="browse-chain-no-flow"></a>
### `[browse] chain: no flow to run (stdin was empty)`(または `stdin is a terminal`、`stdin could not be read (EAGAIN)`)

**意味。** 引数なしの `browse chain` は、それにパイプされた JSON のフローを実行します。何も届かなかったため、ブラウザを起動する前に終了コード 1 で終わります。以前は Windows で、何も実行せずに終了コード 0 で終わっていました。

**修正。** フローをパイプするか、引数として渡してください。

```bash
echo '[["goto","https://example.com"],["text"]]' | browse chain
browse chain 'goto https://example.com | text'
```

<a id="browse-chromium-path-failed"></a>
### `Chromium at GSTACK_CHROMIUM_PATH=<path> failed to launch: ...`

**意味。** ヘッドレスの browse と make-pdf は、現在 `GSTACK_CHROMIUM_PATH` を使います(NixOS、macOS 13)。そのバイナリが起動できませんでした。

**修正。** `GSTACK_CHROMIUM_PATH` を、動作する Chromium に向けるか、`unset GSTACK_CHROMIUM_PATH` を実行して gstack に同梱の Chromium を使ってください。

<a id="browse-profile-in-use"></a>
### `Headed Chromium profile <dir> is in use by Chromium PID <pid> (started by PID <ppid>: <name>). ...`

**意味。** ヘッドありの browse は、プロジェクトごとに1つのプロファイル(`<project>/.gstack/chromium-profile`)を保持します。稼働中のブラウザがこれを所有しており、browse はそれを決して終了させません。`... is locked by PID <pid> on another host (<host>)` は、同期されたフォルダを経由して、別のマシンからロックが来ていることを意味します。

**修正。** そのブラウザを閉じるか、`export CHROMIUM_PROFILE=<another dir>` を実行してください。別のホストの場合は、そちらで停止するか、何も使っていないと確信できたら `<dir>/SingletonLock` を削除してください。

<a id="browse-profile-per-project"></a>
### `[browse] Headed browse now keeps a profile per project ...`

**意味。** 初回の使用時には、どのブラウザもそれを使っていない場合に、`~/.gstack/chromium-profile` からログイン情報がコピーされます。そうでなければ、新しく開始し、取り込み方法を表示します。`browse profiles` は一覧を表示し、`browse profiles prune --days 30` は使われていないものを削除します。

<a id="browse-blocked-address"></a>
### `Blocked: <host> is a cloud metadata or link-local address` / `... resolves to a cloud metadata or link-local address`

**意味。** browse は、すべての数値表記における 169.254.0.0/16(コンテナの認証情報エンドポイントを含む)、100.100.100.200、fe80::/10、fc00::/7 を拒否します。リダイレクトの後やページが起こしたナビゲーションの後も同様です。タブは `about:blank` にリセットされ、コマンドは失敗します。これは上書きできません。

<a id="browse-forbidden-origin"></a>
### サイドバーのターミナルからの `forbidden origin`

**意味。** ターミナルが受け付けるのは、gstack の拡張機能だけです。自分でビルドした拡張機能や、フォークした拡張機能は、別の ID を持ちます。`BROWSE_EXTENSION_ID` はもう読み込まれません。

**修正。** `gstack-config set browse_extension_id <your 32-letter id>` を実行してください。

<a id="browse-type-selector-hint"></a>
### `hint: "<word>" looks like a CSS selector`

**意味。** 単独の `browse type <text>` は、フォーカスされている要素に入力します。最初の語がセレクターに見えたため、テキストとして入力されました。

**修正。** `browse type --selector '<sel>' <text>` を使ってください(`--` で始まるテキストは、`--` の後に置いてください)。

<a id="browse-server-node-missing"></a>
### `server-node.mjs not found. Run bun run build`(Windows)

**修正。** `cd <gstack checkout> && bun run build`。

<a id="freeze-helpers-out-of-date"></a>
### `[freeze] Hook helpers out of date (partial upgrade?)`

**意味。** `check-freeze.sh` と `hook-extract.sh` が、異なる gstack のバージョンから来ています。

**修正。** `cd <gstack checkout> && ./setup`(または `/unfreeze`)。

<a id="browse-chromium-pid-unrecorded"></a>
### `[browse] Could not record the Chromium PID (CDP SystemInfo.getProcessInfo: <error>); browse stop cannot reap a surviving Chromium.`

**意味。** browse が起動したヘッドレスの Chromium について、browse は `browse stop` がサーバーより長く生き残ったブラウザを終了できるように、CDP でブラウザのプロセス ID を読み取ります。その読み取りが失敗したか、2 秒を超えたため、このセッションのブラウザは記録されていません。gstack が起動していないブラウザは、記録も終了もされません。

**修正。** `browse stop` の後、`ps aux | grep -i chrom` で残ったブラウザを確認し、`kill <pid>` で終了させてください。

<a id="browse-no-active-page"></a>
### `No active page. Use "browse goto <url>" first.`(browse の外で最後のタブが閉じられた後)

**意味。** browse の外で、すべてのタブが閉じられた場合(ヘッドありのウィンドウのタブを手で閉じた場合や、ページが自分で閉じた場合)、以前のリリースでは、デーモンが強制終了されるまで、その後のすべてのコマンドが、`status` と `stop` を含めて、この理由で失敗していました(#3167)。今は `status` と `stop` が、タブを開かずに応答します。ほかのコマンドは、最初に新しい空白のタブを1つ開き、`[browse] warning: every tab was closed outside browse, so this command ran on a new blank tab; open your page again with: browse goto <url>` を表示します。

**修正。** `browse goto <url>` で、ページを開き直してください。

**修正されたバージョン。** v1.91.101.0 以降の最初のリリース(#3167)。

<a id="browse-tab-unrecoverable"></a>
### ``browse: every tab was closed outside browse and a new one could not be opened, because the browser or its context is gone (<cause>); fix: run `browse restart` ... (BROWSE_TAB_UNRECOVERABLE)``

**意味。** browse の外で、すべてのタブが閉じられ、ブラウザまたはそのコンテキストも失われているため、browse はコマンドを実行するためのタブを開けませんでした。`browse status` と `browse stop` は、依然として応答します。

**修正。** `browse restart`(gstack のスキル内では `$B restart`)を実行してから、コマンドを再度実行してください。

**修正されたバージョン。** v1.91.101.0 以降の最初のリリース(#3167)。

---

## Windows

<a id="windows-smart-app-control"></a>
### `Windows blocked compiled gstack binaries at launch (Smart App Control or another application-control policy, #2595)` / `bash: .../browse.exe: Permission denied`

**意味。** 既知の問題です(#2595、#2124)。gstack は、Bun を使って、お使いのマシン上で5つのバイナリをコンパイルします。`browse`、`find-browse`、`design`、`pdf`、`gstack-global-discover` です。これらには署名がなく、あるマシンでビルドされたバイナリは、署名の代わりに Smart App Control が受け入れる評価を得ることはありません。そのため、Smart App Control が有効な Windows 11 は、それらの起動を拒否します。Git Bash はそれを `Permission denied` と表示します。これはファイルのパーミッションの問題に見えますが、実際はコードの整合性の問題です(PowerShell は `An Application Control policy has blocked this file` と表示します)。セットアップは、各バイナリに `--version` を実行し、ブロックされたものと、それを必要とするスキルを名指しするようになりました。gstack のブラウザのフォールバック(`/browse`、`/qa`、`/qa-only`、`/design-review`、`/canary`、`/benchmark`、`/pair-agent`、`/scrape`、`/make-pdf`)、デザインのバイナリ(`/design-consultation`、`/design-shotgun`、`/design-html`、`/plan-design-review`)、そして `/retro global` です。それ以外のすべてのスキルは動作します。`gstack-doctor` は、同じ状態を `browse bundle` と `binaries` の行に表示します。Smart App Control のあるマシンでの、正確な Windows のエラーテキストは検証されていません。セットアップは、生の最初の行を、その分類の隣に表示します。

**修正。** Smart App Control のファイルごとの許可リストはありません。現在の選択肢は次のとおりです。

- WSL で gstack を実行する(`wsl --install` の後、Linux のディストリビューションに gstack をインストールします)。WSL は gstack の Linux 版のビルドを実行します。Smart App Control はそれを確認しません。
- または、Windows セキュリティの「アプリとブラウザー コントロール」>「Smart App Control の設定」で、Smart App Control をオフにする。2026 年 4 月の更新がある Windows 11 では、後から Windows を再インストールせずにオンに戻せます。古いビルドでは、オフにすると元に戻せません。Smart App Control がオンの間、gstack のバイナリはブロックされたままです。

署名付きのリリースバイナリが、本当の修正です。`TODOS.md` で追跡しています。Windows がバイナリを許可したら、`./setup` を再実行してください。メッセージは消えます。

**期待される結果。** セットアップが "Windows blocked" の行を表示せず、`gstack-doctor` が `browse bundle` と `binaries` について `ok` を表示します。

<a id="setup-ps1-unexpected-eof"></a>
### `setup: -c: line 1: unexpected EOF while looking for matching '"'` / `setup: -c: line 2: syntax error: unexpected end of file`(`.\setup.ps1` から)

**意味。** Windows PowerShell 5.1(`powershell.exe`、Windows の既定の PowerShell)は、ネイティブプログラムへの引数を従来の方法で渡し、その内部の二重引用符を取り除きます。#3130 を修正したリリースより前は、`setup.ps1` が Git Bash に、二重引用符を含む `bash -c` のスクリプトを渡していたため、bash は壊れたスクリプトを読み、何もインストールされませんでした。PowerShell 7.3 以降は影響を受けませんでした。

**修正。** gstack を更新してください(Git Bash では `cd ~/.claude/skills/gstack && git pull --ff-only`)。その後、`.\setup.ps1` を再度実行してください。そのスクリプトにはもう二重引用符が含まれていません。それまでは、Git Bash から `./setup` を実行するか、PowerShell 7(`pwsh`)から `.\setup.ps1` を実行してください。

<a id="setup-ps1-empty-argument"></a>
### `setup.ps1: argument N is empty; setup takes no empty arguments. Nothing was installed or changed. (SETUP_PS1_EMPTY_ARGUMENT; ...)`

**意味。** `.\setup.ps1` に渡した引数の1つが空文字列です(`''` や、`$hostName` のような未設定の変数など)。セットアップは空の引数を受け付けず、Windows PowerShell 5.1 のもとで `setup.ps1` が引数を Git Bash に渡す方法では、空の引数を渡せないため、何かを実行する前に拒否します。

**修正。** 空の引数を取り除くか、値を与えてください。

```powershell
.\setup.ps1 --host codex
```

---

<a id="chromium-install-exit-127"></a>
### `Chromium bootstrap: chromium-install — <bun> x playwright install chromium exited 127 (command not found); install Bun from bun.sh (winget Bun ships no bunx), or skip with ./setup --no-browser (Git Bash) or .\setup.ps1 --no-browser (PowerShell)`

**意味。** セットアップ(または `bin/gstack-browser-ensure`。`BROWSER_UNAVAILABLE <bun> x playwright install chromium exited 127 (command not found)` として)が、Playwright のインストーラーを実行できませんでした。シェルが実行するコマンドを見つけられなかったためです。#3131 を修正したリリースより前は、セットアップは `bunx` を呼んでいました。winget でインストールされた Bun には `bunx` が含まれないため、その失敗を `exited 127 (offline, proxy, or blocked download?)` として報告していました。今は、解決された Bun を通じて `bun x` を実行します。そのため、終了コード 127 は、その Bun 自体、またはそれが起動するコマンドが欠けていることを意味します。ブラウザを必要としないスキルは、どちらの場合もインストールされます。

**修正。** https://bun.sh から Bun をインストールしてから(`bun` と `bunx` が含まれます)、セットアップを再度実行してください。今はブラウザなしでインストールするには、Git Bash では次を実行します。

```bash
./setup --no-browser
```

Windows PowerShell では次を実行します。

```powershell
.\setup.ps1 --no-browser
```

---

<a id="bash-unavailable"></a>
### `gstack: no Git Bash found to run gstack's bash scripts on Windows (tried ...); fix: ... (BASH_UNAVAILABLE)`

**意味。** Windows は shebang のスクリプトを実行できないため、gstack は bash のスクリプト(`gstack-wtree`、`gstack-slug`、フックのバイナリ、regen と pregate の選択マニフェストにある `bash -c` のコマンド)を、Git Bash に渡します。次の順序で探し、メッセージには試したすべての候補と、それを拒否した理由が表示されます。

1. `GSTACK_GIT_BASH`(または古い名前の `GSTACK_BASH`。両方が設定されていて値が異なる場合は、`GSTACK_GIT_BASH` が優先され、その旨が1行で警告されます)。存在しない値は、スキップされずに拒否されます。
2. `git --exec-path` の隣にある bash(scoop、ユーザーごと、およびポータブルな Git を見つけます)。
3. `C:\Program Files\Git`、`C:\Program Files (x86)\Git`、`%LOCALAPPDATA%\Programs\Git`、および scoop の `git\current`。
4. PATH 上の `bash`。ただし、`uname -s` が MSYS または MINGW を報告する場合に限ります。`System32` や `WindowsApps` にある WSL の `bash.exe` は決して使われません。それは `C:\...` のパスを Linux のパスとして読むためです。どちらでもない PATH 上の bash(たとえば Cygwin)も、もう使われません。

Issue #3197 より前は、これらのコマンドはスクリプトを直接起動していたため、`gstack-restamp` は `cannot fingerprint the working tree ()` で拒否し、`gstack-gate-diff` と `gstack-evidence` は黙ってフィンガープリントを落としていました。

**修正。** PowerShell で `winget install --id Git.Git -e` を実行して Git for Windows をインストールするか、gstack に、そのための bash.exe を恒久的に指定してください。Git Bash の `export` は、そのシェルにしか届きません。Claude Code が読む場所に設定してください。

- Windows PowerShell 5.1 または PowerShell 7 の場合。その後、Claude Code を再起動してください。

  ```powershell
  [Environment]::SetEnvironmentVariable('GSTACK_GIT_BASH', 'C:\Program Files\Git\bin\bash.exe', 'User')
  ```

- または、`~/.claude/settings.json` の `env` ブロック。

  ```json
  { "env": { "GSTACK_GIT_BASH": "C:/Program Files/Git/bin/bash.exe" } }
  ```

フックは、見つけた bash を `<state root>/cache/windows-bash.json` にキャッシュします(`git.exe` のパスと更新日時でキーされ、使用前に再確認されます)。上書きの値はキャッシュされません。

**期待される結果。** `gstack-restamp --dry-run` が差分を表示し、`gstack-gate-diff` が `+nowtree` ではなく、ツリー ID で終わる候補を記録します。

---

## メモリと gbrain

以下のすべてのメッセージは、[docs/gbrain-sync-errors.md](gbrain-sync-errors.md) にも、より詳しく記載されています。ページごとの取り込みのメッセージ(`FAILED`、`re-queued`、`quarantined`、照合の進捗、このマシンに残されたという通知)も含みます。

<a id="gbrain-db-unreachable"></a>
### `database host unreachable (<code> <host>); your gbrain config is unchanged. Fix: check network or VPN, then re-run /sync-gbrain.`

**意味。** gbrain のデータベースへの DNS または接続のエラーです。以前は設定の破損のように見え、セットアップはオフラインの間、brain の機能を取り除いていました。

**修正。** ネットワークまたは VPN を復旧してから、`/sync-gbrain` を実行してください。

<a id="memory-ingest-unattributed-failures"></a>
### `[memory-ingest] ERR: gbrain reported N failure(s) it did not attribute to a staged page ... Refusing to advance state.`

**保持される内容。** 何も保存済みとしてマークされないため、何も失われません。このような実行が3回続くと、gstack はバッチを二分探索し、それを壊しているページを隔離します。

**修正。** `/sync-gbrain` を再実行してください。

<a id="memory-reconcile-not-run"></a>
### `[memory-ingest] reconcile: not run (...)`

**意味。** アップグレードの後、gstack は保存済みとしてマークしたトランスクリプトを再確認し、brain にないものを再取り込みします。その確認には、ローカルの gbrain が必要です。

**修正。** `/setup-gbrain` を実行してから、`gstack-memory-ingest --reconcile` を実行してください(`--dry-run` で事前確認できます)。

<a id="memory-ingest-locked"></a>
### `[memory-ingest] ERR: another memory ingest (pid <N>) is writing <state file>; not run.`

**修正。** 完了するまで待ってから、`/sync-gbrain` を再実行してください。

<a id="memory-ingest-state-unsaved"></a>
### `[memory-ingest] ERR: could not save ingest state <path>: <error>.`

**対処。** gstack の state root 配下のパーミッションを直すか、ディスク空き容量を確保してから、`/sync-gbrain` を実行してください。

<a id="memory-ingest-transcript-checkout"></a>
### `[memory-ingest] kept N transcript page(s) for <repo> on this machine: gbrain source <id> ...`

管理対象の gbrain brain(0.60 以降)では、インポートは、このホストが所有する checkout に紐づいたソースにしか入りません。そのため gstack は、インポートの前に各 transcript ソースを専用の checkout `<state root>/gbrain-transcript-sources/<id>/` に紐づけます。
この partition はこのマシン上に残り、スタンプ(記録)も付かないままです。次のいずれかの場合、後の実行でインポートされます。

- **別の所有者が保持している**: ソースが別のホストや別のディレクトリに紐づいています。gstack がそれを横取りすることはありません。`gbrain sources writer status --source <id> --json` で状態を確認してください。所有者が解放する(所有側のホストで `gbrain sources writer transfer prepare <id>` を実行する)か、ここで `gbrain sources set-path <id> <checkout>` を使って紐づけ直してください。
- **state root が一時的なもの**(`GSTACK_EPHEMERAL=1`): 紐づけ先のディレクトリがマシンとともに消えてしまいます。永続的な root を指定して実行してください: `GSTACK_STATE_ROOT=<durable directory> gstack-memory-ingest --bulk`
- **gstack の checkout に紐づいているが、存在しないか有効でない**: state root のバックアップから checkout を復元するか、`gbrain doctor --json` の指示に従ってください。
- **紐づけできなかった**: メッセージには gbrain が拒否した理由が含まれています。上記の writer status コマンドでソースを確認してください。

<a id="gbrain-artifacts-not-indexed"></a>
### `curated artifacts pushed to git, but gbrain source <id> has 0 indexed pages. Fix: gbrain sync --source <id>, then re-run /sync-gbrain`

**対処。** `gbrain sync --source <id>` を実行してから、`/sync-gbrain` を実行してください。

<a id="gbrain-dream-skipped"></a>
### `dream: skipped — the installed gbrain cannot run only the resolve_symbol_edges phase, and the full dream cycle costs about 35 minutes ...`

**意味。** `/sync-gbrain --dream`(および `--full` の自動ビルド)は、現在 call-graph フェーズだけを実行します。インストールされている gbrain ではスコープを絞れないため、何も実行されませんでした。

**対処。** `gstack-gbrain-install` を実行してから、`/sync-gbrain --dream` を実行してください。または、dream サイクル全体を自分で実行してください: `gbrain dream --source <id>`。

<a id="gbrain-cycle-freshness-unknown"></a>
### `call graph for <source>: unknown: installed gbrain does not expose cycle_freshness`

**対処。** `gstack-gbrain-install` を実行してください。

<a id="gbrain-path-unavailable"></a>
### `[gbrain-sync] gbrain source <id>: path unavailable (<path>); gstack skips it.`

**意味。** 削除されたワークツリーのコードソースです。gstack がこれを自動で削除することはありません。

**対処。** まずプレビューし、このマシンのものだと gstack が確認できたものだけを削除してください。

```bash
gstack-gbrain-sync --prune-gone-worktrees --dry-run
gstack-gbrain-sync --prune-gone-worktrees
```

---

## Eval レポートと合格率

これらは、paid eval の census レポートと `bun run eval:pass-rates` から出力されます。
census が赤になった場合の手順は [docs/evals/census-red.md](evals/census-red.md) を参照してください。

<a id="pass-rates-unknown-flag"></a>
### `eval:pass-rates: unknown flag <flag>` / `eval:pass-rates: unknown case <id> (not an E2E, judge or paid test file id)`

**意味。** フラグまたは case id が認識されませんでした。コマンドは何も取得せずに終了コード 2 で終了します。

**対処。** `bun run eval:pass-rates --help` でフラグの一覧を確認してください。`--case` には、`test/helpers/touchfiles-data.ts` にあるレジストリ id か、paid テストファイルのパスを指定します。

<a id="failure-cause-newer"></a>
### `unknown failure_cause "<x>" (written by a newer gstack; update this checkout to read it)`

**意味。** 試行記録に、このチェックアウトが知らない failure cause が含まれています。新しい gstack が書き込んだものです。

**対処。** `git pull`(またはブランチを `main` にリベース)を実行してから、コマンドを再実行してください。

<a id="paid-case-several-owners"></a>
### `--case <id>: registered by <file>, <file>; it needs exactly one`

**意味。** 複数の paid テストファイルがその case を登録しているため、`test-paid-shards.ts --case` はどのファイルを使うか選べません。

**対処。** 赤くなった shard のファイルを直接実行してください。レポートの `after a repair:` の行に、実行するコマンドが出力されています: `EVALS=1 EVALS_TIER=<tier> bun test <file>`

<a id="evidence-too-large"></a>
### `evidence: <artifact> too large to fetch (<N> MB)`

**意味。** この赤の試行記録を含むスライス artifact が 64 MB を超えているため、`eval:pass-rates --run` はこれをダウンロードしません。

**対処。** 実行ページからダウンロードするか、次のコマンドを使ってください。
`gh api repos/<owner>/<repo>/actions/artifacts/<artifact id>/zip > slice.zip`

<a id="headroom-alarm"></a>
### `[headroom] <case> session <key>: max <s> of <s> (<pct>) over <n> sample(s), above the 85% cap. Cut work in the skill or fixture; budgets are never raised ...`

**意味。** `eval:pass-rates --gate`(週次レポート)が、最も遅いセッションで設定したタイムアウトの 85% を超える時間を使っている case を検出しました。赤になるまであと一歩の状態です。

**対処。** スキルまたは fixture の作業量を減らしてください。予算(タイムアウト値)は引き上げないでください。`bun run eval:pass-rates --headroom --case <id>` でその case を確認できます。

<a id="cost-unknown"></a>
### `cost unknown (no billing captured for any of <N> trial(s))` / `cost $<x> known + <N> of <M> trial(s) cost unknown`

**意味。** PTY と Codex のセッションでは課金情報が記録されないため、コストは不明です。表示されるのは、判明している分の合計だけです。

**対処。** 対応不要です。情報提供のメッセージです。

<a id="cause-provider-stall"></a>
### `· cause provider_stall: no stream event for <N>s ...`

**意味。** セッションは部分的なメッセージをストリーミングしたあと、モデルへのリクエストが処理中で、ツール、権限プロンプト、フック、サブエージェントのいずれも未完了の状態で、少なくとも 120 秒間まったくイベントを受信しませんでした。EVAL_POLICY v1 のもとでも、この試行は失敗として扱われます。

**対処。** `bun run eval:pass-rates --run <run id> --case <id>` で内容を確認してください。paid の再実行は、修正を入れた後にのみ行ってください。

<a id="overlay-wrong-answer"></a>
### `taskCorrect: false` と `answerError` を持つオーバーレイのレコード(契約 v4)

**意味。** 試行は完了しましたが、回答が誤っていました。overlay contract v4 のもとでは、これは比較の中で有効な測定値です。失敗になるのは overlay を ON にした場合の誤答だけです。

**対処。** 試行の JSON 内の `answerError` を読んでください。再実行は不要です。

<a id="detector-corpora-stale"></a>
### `[detector-corpora] <N> stale entries (refresh from a current census when one fails)`

**意味。** 一部のリプレイコーパスのエントリは、その case の古い入力系列から来ています。これは情報提供のメッセージです。コーパスは引き続きそれらをリプレイします。

**対処。** census でその case が赤になった場合は、新しいキャプチャをそのコーパスに追加し、`bun test test/detector-corpus-<case>.test.ts` で確認してください。

<a id="auq-substance-panel"></a>
### `recommendation substance median <x> < 4 over samples [<a>,<b>,<c>] (boilerplate/weak)`

**意味。** auq-matrix の case では、取得した各質問の推奨内容を 3 サンプルの judge パネルで採点します。3 サンプルのうち 4 点に達したのが 2 つ未満だったため、中央値が 4 未満になりました。

**対処。** ログに残ったサンプルと取得された質問を読んでください。修正はスキルの本文に加え、auq-matrix の診断実行を 1 回行ってください。

---

## Push ガード(マスキング)

<a id="redact-postgres-default-pair"></a>
### ホスト名が `@db` のようなサービス名で、既定の `postgres`/`postgres` ログインを使う場合の `db.url_with_password` HIGH(pre-push でブロック)

**意味。** デフォルトの `postgres:postgres` の組み合わせが例外扱いになるのは、ホストが `localhost` または `127.0.0.1` の場合だけです。`@db` のようなサービス名では、その URL が最終的にどこにデプロイされるかわからないため、ブロックされたままになります。

**対処。** ローカルと CI の設定では `postgres://postgres:postgres@localhost:5432/...` を使うか、URL を環境変数から読み込んでください。認証情報が本物であれば、ローテーションしてください。一度だけバイパスする場合は `GSTACK_REDACT_PREPUSH=skip git push` を使います。
URL がレビュー済みの、公開されている開発用の値である場合は、[`.gstack-redact-allowlist`](#redact-allowlist) に登録してください。

<a id="redact-allowlist"></a>
### `.gstack-redact-allowlist (<n> entries) suppressed <m> finding(s) in this push`

**意味。** push されたコミットのリポジトリルートに `.gstack-redact-allowlist` が含まれています。各行(前後の空白を除去し、`#` はコメントの開始)は、完全一致する 1 つのスパンを表します。`db.url_with_password` の場合は `postgres://USER:PASSWORD@host:port` という URL 全体、キーパターンの場合はキー、`pii.email` の場合はアドレスです。検出結果は、マッチしたテキストがエントリと完全に一致する場合にのみ抑制されます。そのため、パスワードだけ、部分文字列、別のキーは引き続き報告され、ブロックされます。フックはワーキングツリーではなく、push される各コミットからファイルを読みます。64 KiB を超えるファイルは無視されます。エントリを含む push のたびに、この行と、抑制された各検出結果のファイルと行番号が表示されます。
`gstack.redact.allowEmail` と併用でき、こちらはローカル設定のままです。

**対処。** 抑制されているものがすべてレビュー済みの値であれば、何もする必要はありません。もう適用されないエントリは削除し、実際の認証情報はローテーションしてください。

<a id="redact-version-as-ip"></a>
### 4 区切りのバージョン番号に対する `pii.ip_public` MEDIUM

**意味。** その行は、値をバージョンとして宣言していません。

**対処。** `version: 1.2.3.4`、`"version": "..."`、または `v1.2.3.4` の形式で書いてください。
MEDIUM の検出結果では push はブロックされません。

<a id="redact-prepush-email"></a>
### pre-push フックによる `MEDIUM  pii.email  <file>:<line>`

**意味。** push される行に、自分のものではなく、かつ push 先のコミットメタデータにまだ含まれていないメールアドレスが追加されています。フックは次のものは報告しません: 自分のアドレス(`git config user.email`)、`gstack.redact.allowEmail` に列挙されたアドレス、そして push されるコミットの履歴、置き換えられるリモートの先端、および設定済みのリモートに新しいブランチを push する場合はそのリモートの追跡ref に含まれる作成者とコミッターのアドレス(mailmap で解決されたものを含む)。別のリモートにしか存在しないアドレスは、引き続き報告されます。フックが `existing-email suppression was limited for this push` も出力している場合は、5 秒以内に履歴を読み取れなかったことを意味します。そのため、既知の作成者も一覧に含まれる可能性があります。

**対処。** アドレスを削除するか、このリポジトリで許可してください: `git config --add gstack.redact.allowEmail <address>`。自分のアドレスである場合は、`git config user.email` を確認してください。allowlist が対象とするのは `pii.email` だけです。HIGH の検出結果を通すことはありません。

<a id="unattended-runs-and-artifacts"></a>
## 無人実行と artifact

ワークフローのコマンド(`gstack-artifact`、`gstack-gate`、`gstack-autoplan-timing`、`gstack-review-log --findings`)は、エラー行の末尾に括弧付きのコードを付けます(例: `(ARTIFACT_STALE)`)。コードとアンカーは `lib/result-codes.ts` から来ています。説明文ではなく、コードで grep してください。これらのコマンドは、いずれも同じ終了コード表を共有します: `0` 成功、`1` 失敗、`2` 使い方の誤り、`3` 拒否またはフラグが必要。artifact の契約そのものは [docs/unattended.md](unattended.md) にあります。

<a id="artifact-invalid-json"></a>
### `ARTIFACT_INVALID_JSON`

**意味。** `run.json`、`timing.json`、またはその他の JSON artifact が解析できませんでした。

**対処。** 書き出しを行ったツールで run を再生成してください。マニフェストを手で編集することはありません。書き込みが途中で止まっていれば、それは書き込み側が中断されたことを意味します。

<a id="artifact-unsupported-version"></a>
### `ARTIFACT_UNSUPPORTED_VERSION`

**意味。** artifact の `schema_version` は、この gstack が読めないバージョンです(`gstack-artifact schema <name>` で、検証できるバージョンが表示されます)。

**対処。** 利用側をアップグレードする(`/gstack-upgrade`)か、この gstack で run を再生成してください。

<a id="artifact-schema"></a>
### `ARTIFACT_SCHEMA`

**意味。** 必須フィールドがない、型が誤っている、または enum の範囲外の値が入っています。メッセージには、ファイル、行、フィールド名が示されます。

**対処。** `gstack-artifact schema <name>` と行の内容を比べて、再生成してください。

<a id="artifact-missing"></a>
### `ARTIFACT_MISSING`

**意味。** `run.json` が、run ディレクトリ内に存在しない artifact を指定しています。

**対処。** 個別のファイルではなく、run ディレクトリ全体をコピーしてください。そのファイルが一度も書き出されていない場合は、それを書き出すフェーズを再実行してください。

<a id="artifact-stale"></a>
### `ARTIFACT_STALE`

**意味。** ファイルのバイト列のハッシュが、`run.json` に記録された値と一致しません。そのため、マニフェストはこのファイルを正しく表していません。

**対処。** run は一部が書き換えられたものとして扱ってください。再生成するか、そのファイルを書き出したツールを通して再度紐づけ、マニフェストを更新してください。

<a id="artifact-path-escape"></a>
### `ARTIFACT_PATH_ESCAPE`

**意味。** artifact のパスが run ディレクトリの外を指しています。`..` のセグメント、絶対パス、または別の場所を指すシンボリックリンクのいずれかです。

**対処。** すべての artifact を、単純な相対名で run ディレクトリ内に置いてください。run ディレクトリは 1 つの単位としてコピーされるため、その外にあるものは契約の対象外です。

<a id="artifact-malformed-jsonl"></a>
### `ARTIFACT_MALFORMED_JSONL`

**意味。** JSONL の artifact に、1 つの JSON オブジェクトになっていない行があります。多くの場合は最後の行で、書き込みが追記の途中で中断されています。

**対処。** そのファイルを書き出すフェーズを再実行してください。行を手で削除しないでください。どちらにしてもその行が持っていたデータは失われ、マニフェストのハッシュも変わってしまいます。

<a id="artifact-duplicate-id"></a>
### `ARTIFACT_DUPLICATE_ID`

**意味。** 1 つのファイル内の 2 つの行が同じ id を持っています。

**対処。** id は run に紐づいており(`<run>-...`)、ファイルごとに一意です。id を割り当てたツールで行を再生成してください。

<a id="artifact-unbound-id"></a>
### `ARTIFACT_UNBOUND_ID`

**意味。** 行の id が `run.json` の run id で始まっていないため、別の run に属している可能性があります。

**対処。** この run の id を使って行を再生成してください。

<a id="artifact-dangling-ref"></a>
### `ARTIFACT_DANGLING_REF`

**意味。** タスクの `findings`、`blocked_by`、`depends_on`、または decision の参照が、この run の artifact が定義していない id を指しています。

**対処。** 参照先の finding、decision、またはタスクを先に書くか、参照を削除してください。`depends_on` のエントリは、同じファイル内の別のタスクが持つ `pr` ラベルを指すこともできます。

<a id="artifact-dependency-cycle"></a>
### `ARTIFACT_DEPENDENCY_CYCLE`

**意味。** タスク同士が循環して依存しているため、どのレーンも開始できません。

**対処。** `depends_on` で循環を断ち切ってください。メッセージには、循環に含まれる id が列挙されます。

<a id="artifact-count-mismatch"></a>
### `ARTIFACT_COUNT_MISMATCH`

**意味。** `run.json` の `counts` の値が、それが要約しているファイルの行と一致しません(例: 行が 64 件なのに `counts.findings: 65`)。

**対処。** 最後の行が書き込まれた後に `run.json` を再生成してください。件数が、ファイルの代わりになることはありません。記録となるのはハッシュと行の内容です。

<a id="artifact-run-interrupted"></a>
### `ARTIFACT_RUN_INTERRUPTED`

**意味。** `run.json.status` が終了状態ではないか、いずれかの voice がまだ `running` または `pending` です。artifact は未完了の run を表しています。

**対処。** run を再開してください(`gstack-autoplan resume --out <dir>`、PR B-runner)。または、artifact を部分的なものとして扱い、その旨を明記してください。

<a id="artifact-reviewer-missing"></a>
### `ARTIFACT_REVIEWER_MISSING`

**意味。** `required_phases` のフェーズが `phases` に存在しない、voice が終了状態になっていない、または完了した voice に `artifacts` 内で紐づいた出力ファイル(パスとハッシュ)がありません。

**対処。** フェーズを完了させてください。voice が欠けている場合、それはカバレッジが欠けていることを意味します。バリデーターがそれを N/A として補完することはありません。

<a id="artifact-guard-line-missing"></a>
### `ARTIFACT_GUARD_LINE_MISSING`

**意味。** run には `session_kind: unattended` と書かれていますが、その `review-record.md` に `GUARD_NOT_INSTALLED` の行がありません。そのため、記録上、公開の順序が検証されていないことが明示されていません。

**対処。** `gstack-skill-start` で run を開始してください(この行を出力します)。そして、その行をレビュー記録に残してください。

<a id="guard-not-installed"></a>
### `autoplan guard: not enforced by this host; publication order is unverified (GUARD_NOT_INSTALLED)`

**意味。** autoplan の公開フックは、Claude Code の内部でのみ実行されます。それ以外のホストと、すべての `unattended` セッションでは、フックは存在しても実行されません。そのため、フェーズの公開順序は、ガードではなく、フェーズごとに記録されたスナップショットのハッシュに依存します。

**対処。** このホストでは何もする必要はありません。この行は run ごとに 1 回出力され、レビュー記録に残すものです。`gstack-artifact validate` は、unattended の run でこの行を必須とします。Claude Code では、フックファイルが*存在しない*場合、ガードされたすべての呼び出しが拒否されます(インストールが壊れているものを、存在しないものとして通してはならないため)。

<a id="review-status-mismatch"></a>
### `review-log: status mismatch ... (REVIEW_STATUS_MISMATCH)`

**意味。** `gstack-review-log` に渡された行が主張する `status`、`unresolved`、`issues_found`、または `critical_gaps` の値が、`--findings` ファイルと矛盾しています(例: 未解決の finding があるのに `status: clean`)。その行は書き込まれませんでした。

**対処。** 主張の方ではなく、findings ファイルを直してから、再度ログを記録してください。主張するフィールドは省略し、行をファイルから導出させてください。

<a id="gate-rev-stale"></a>
### `GATE_REV_STALE`

**意味。** 返信が、ゲート一覧の現在のリビジョンより古い `gate_rev` を指定しています。そのため、変更された項目への回答になっている可能性があります。

**対処。** 現在の一覧を表示し(`gstack-gate render <file>`)、それを読んでから、表示された `gate_rev` を指定して返信してください。

<a id="gate-reply-unparsed"></a>
### `GATE_REPLY_UNPARSED`

**意味。** 返信の一部が、どのゲート項目や選択肢にも一致しませんでした。何も適用されておらず、解析できなかったトークンが一覧表示されます。

**対処。** `all`、`<id><option>` 形式のトークン(`d3b uc1a`)、または `all except <tokens>` で返信してください。単独の `yes` や `no` は、複数の選択肢を持つ項目では曖昧なため、推測されることはありません。

<a id="answer-by-required"></a>
### `ANSWER_BY_REQUIRED`

**意味。** `gstack-autoplan answer` が、`--by` を指定せずに、または `human` でも `agent:<id>` でもない値を指定して unattended の run で実行されました。artifact には、ゲートに誰が回答したかが記録されている必要があります。そうしないと、オーナーがトークンを入力した場合と、エージェントが中継または決定した場合が `decisions.jsonl` 上で区別できなくなります。何も適用されていません。

**対処。** オーナーがトークンを入力した場合は `--by human` を、エージェントが中継または決定した場合は `--by agent:<thread or id>` を指定して再実行してください。この値は、返信が回答する各 decision 行に `answered_by` として記録され、レビュー記録のゲートの行にも記録されます。

<a id="queue-aware-ship-policy-restamp-tree-receipt-ship-receipt"></a>
## キュー対応の ship: ポリシー、restamp、ツリーの受領記録、ship の受領記録

`gstack-ship-policy`、`gstack-restamp`、`gstack-tree-receipt`、`gstack-ship-receipt`、および `gstack-evidence bundle|ancestor` は、上記と同じ終了コード表を共有し、エラー行の末尾に括弧付きのコードを付けます。ポリシーファイルについては [docs/ship-policy.md](ship-policy.md) で、キューのフローについては [docs/ship-policy.md#stamp-at-merge](ship-policy.md#stamp-at-merge) で説明しています。

<a id="policy-source-unavailable"></a>
### `policy source unavailable — fix: git fetch origin <base> --depth=1 (POLICY_SOURCE_UNAVAILABLE)`

**意味。** ポリシーは `origin/<base>` にコミットされたコピーから読み込まれます。その ref がここでは解決できません(shallow または detached なゲートのチェックアウト、あるいは fetch が一度も行われていない場合)。ツールは終了コード 3 で終了し、ワーキングツリーのファイルに黙ってフォールバックすることはありません。

**対処。** `git fetch origin <base> --depth=1` を実行してから、再実行してください。ブランチ自身のファイルに対して意図的に実行する場合は、`--policy-from head --allow-repo-commands` を指定します。その場合、受領記録には `policy: head (unreviewed)` と書かれます。

`--base` には `origin` 上のブランチ名を指定します。コミット SHA、タグ、または別のリモートの ref(フォークのクローンにおける `upstream/main`)は、`origin/<base>` としては解決されず、fetch してもその ref は作成されないため、`origin` に存在するブランチを指定してください(`git branch -r --list 'origin/*'` で一覧を確認できます)。`gstack-pregate` は、fetch を提案する代わりに、このことを対処方法の中で説明します。

<a id="policy-invalid"></a>
### `POLICY_INVALID`

**意味。** `.gstack/ship-policy.json` に、未知のキー、型の誤り、または enum の範囲外の値があります。メッセージにはキー名が示されます。未知のキーはエラーになります。タイプミスが黙って「デフォルト」として扱われることがないようにするためです。

**対処。** `gstack-ship-policy validate` で、すべての問題が一覧表示されます。`gstack-ship-policy init --explain` は、各キーの意味とデフォルト値を表示します。

<a id="policy-containment"></a>
### `POLICY_CONTAINMENT`

**意味。** リポジトリ側で指定された入力が、許可された範囲を超えています。`stamp_paths`、`release_outputs`、`changelog`、`mirror` に、絶対パスや `..` のセグメントがある。展開結果が 512 文字の正規表現を超えるグロブがある。リストが 64 件を超えている。`release_tool` が 512 文字を超える、または改行を含んでいる。書き込み時には、同じコードが、シンボリックリンクを通してリポジトリの外を指す一致ファイルも検出します。

**対処。** パスはリポジトリからの相対パスにし、グロブは短く、リストは小さく保ってください。mirror は `..`(兄弟のチェックアウト)で始められますが、途中に `..` を含めることはできません。

<a id="policy-exists"></a>
### `POLICY_EXISTS`

**意味。** `gstack-ship-policy init` が既存のポリシーファイルを見つけたため、何も書き込みませんでした。

**対処。** ファイルを編集するか、`--force` を指定してサンプルで置き換えてください。

<a id="repo-commands-not-allowed"></a>
### `repo commands not executed (pass --allow-repo-commands) (REPO_COMMANDS_NOT_ALLOWED)`

**意味。** ポリシーでコマンド(`release_tool`)が宣言されていて、そのツールが単独で実行されました。ファイルが存在するだけでは実行は許可されません。`/ship` と `/land-and-deploy` の外では、リポジトリが宣言したコマンドは `--allow-repo-commands` を付けたときだけ実行されます。このときコマンドは一覧表示されただけで、何も書き込まれていません。

**対処。** リポジトリのコードを実行するつもりであれば `--allow-repo-commands` を渡してください(テストを実行するときは、すでにこのオプションを付けているはずです)。実行しないのであれば、release tool を削除してください。

<a id="queue-stale"></a>
### `QUEUE_STALE`

**意味。** `gstack-restamp` に、バージョン割り当てが前提としていたベース SHA(`--expect-base`)またはマージ順(`--expect-order`)が伝えられましたが、そのどちらかが変わりました。ベースが進んだ、前のブランチがまだマージされていない、後続のブランチが先にマージされた、のいずれかです。JSON の結果には `expected`、`actual`、`recompute` が含まれます。

**対処。** 表示された `recompute` コマンドを実行して、現在のベースからバージョンを再計算し、その後サーバー側の head 条件(`MERGE_CONDITION: sha=<head>`)を使ってマージしてください。

<a id="restamp-version-source"></a>
### `RESTAMP_VERSION_SOURCE`

**意味。** 設定されたバージョンのソース(`VERSION`、`.gstack/version-path`)が、ベースリビジョンまたはブランチ上で存在しない、曖昧である、または壊れています。そのため、バンプの元となるバージョンがありません。

**対処。** ベースブランチで `VERSION` を作成するか、`.gstack/version-path` でマニフェストのパスを固定してください。gstack が `0.0.0.0` で代用することはありません。

<a id="restamp-merge-conflict"></a>
### `RESTAMP_MERGE_CONFLICT`

**意味。** `--after <pr>` は、一時的な worktree でブランチと前のブランチの head をマージしたものを作りますが、そのマージがコンフリクトしました。ブランチ自体は変更されていません。

**対処。** 前のブランチ(またはベースがマージされたらベース)を、`/ship` の Step 3 のコンフリクトルールに従ってブランチへマージし、その後 `--after` をもう一度実行してください。

<a id="restamp-release-tool-failed"></a>
### `RESTAMP_RELEASE_TOOL_FAILED`

**意味。** ポリシーの `release_tool` が、ステージング用 worktree の中で 0 以外の終了コードで終了しました。ブランチには書き込まれておらず、journal にはステージが記録されています。

**対処。** リポジトリ内でそのツールを手動で実行し、問題を修正してから `gstack-restamp` を再実行してください。

<a id="restamp-output-outside-allowed"></a>
### `RESTAMP_OUTPUT_OUTSIDE_ALLOWED`

**意味。** release tool が、許可された出力の集合(バージョンファイル、ロックファイル、CHANGELOG、`stamp_paths`、`release_outputs`)の外にあるパスを変更しました。restamp はブランチへ何も書き込む前に処理を拒否しました。

**対処。** そのパスが正当な生成物である場合は、ベースブランチの `release_outputs` にそのパスを追加してください。そうでなければ、そのツールがそのパスへ書き込まないようにしてください。

<a id="restamp-conflict"></a>
### `RESTAMP_CONFLICT`

**意味。** 適用またはロールバックの途中で、ファイルの中身がジャーナルに記録されたバイト列と一致しなくなりました(ステージの実行後に誰かが編集しました)。上書きするとその編集が失われるため、restamp は停止しました。

`cannot fingerprint the working tree (<detail>); nothing written` も、何もステージされる前に発生する同じコードです。`gstack-wtree exited <n>: <reason>` にはヘルパー自身の修復案(たとえば書き込み可能な `TMPDIR`)が含まれます。`gstack-wtree could not start: ...` は、Windows で bash の検索に失敗したことを示します([`BASH_UNAVAILABLE`](#bash-unavailable) を参照)。

**対処。** `.gstack/tmp/restamp-journal.json` を読み、指定されたファイルを手作業で整合させてから、`gstack-restamp` を再実行してください(冪等です。stamp が完了していれば何もしません)。

<a id="restamp-predecessor-moved"></a>
### `PREDECESSOR MOVED <old> -> <new> — fix: gstack-restamp --after <pr> again (RESTAMP_PREDECESSOR_MOVED)`

**意味。** ゲートは、前の PR の head が現在のものではなくなった時点の head に対して構築された合成ツリー上で実行されました。そのため、ゲートされたツリーは、マージされるツリーと一致しません。receipt は `gate-reuse: eligible` を拒否します。

**対処。** `gstack-restamp --after <pr>` を再度実行し、新しい合成ツリーにゲートをかけ直して、receipt を読み直してください。

<a id="changelog-duplicate-heading"></a>
### `CHANGELOG_DUPLICATE_HEADING`

**意味。** 2 つのセクションが同じバージョンの見出しを共有しています。多くの場合、バージョンを既に持つエントリの隣で、stamp が `[Unreleased]` の見出しを付け替えたことが原因です。

**対処。** 両者を新しいバージョンの下の 1 つのエントリにまとめてください。

<a id="changelog-top-mismatch"></a>
### `CHANGELOG_TOP_MISMATCH`

**意味。** stamp の後、最初のエントリの見出しが `VERSION` のバージョンと一致しません。

**対処。** `gstack-restamp` は PR のセクションを先頭へ移動します。手作業の編集によってそれが元に戻された場合は、見出しを修正するか、restamp を再実行してください。

<a id="changelog-section-missing"></a>
### `CHANGELOG_SECTION_MISSING`

**意味。** CHANGELOG に `[Unreleased]` セクションもなく、現在ブランチに stamp されているバージョンを見出しとするセクションもありません。そのため、見出しを付け替える対象がありません。

**対処。** stamp-at-merge の方式では、PR のエントリを `## [Unreleased]` の下に書いてください。restamp がそれを `## [<version>] - <date>` に変換します。

<a id="gate-reuse-not-eligible"></a>
### `gate-reuse: not-eligible (<what changed>) — fix: <rerun command> (GATE_REUSE_NOT_ELIGIBLE)`

**意味。** ツリーの同一性だけではゲートの証拠になりません。receipt は、ゲートされた同一性(stamp を除いたツリー、ランタイムのピン、ロックファイルのハッシュ、CI ワークフローのハッシュ、ゲートコマンドのハッシュ、実行された選択、ランナーイメージ)を現在の状態と比較し、異なる箇所を示します。また、最終ツリーで再実行しなければならない stamp に依存するゲートも示します。

**対処。** 表示されたコマンドで、stamp されたツリー上の該当レーンを再実行するか、`/ship` で `--force-gate <reason>` を渡して、ゲート全体をもう一度実行してください。

<a id="evidence-identity-unknown"></a>
### `EVIDENCE_IDENTITY_UNKNOWN`

**意味。** バンドル(またはレコード)に、コミット済みのツリー ID、ランタイムのバージョン、ロックファイルのハッシュ、またはコマンドのハッシュがありません。そのため、再利用の判断をその証拠に基づいて行うことができません。検証されていない取り込み済みのアサーションも、不明として扱われます。

**対処。** コミット済みの head に対してレーンを実行した後、ゲートマシン上で `gstack-evidence bundle --out <file> --label <lane>...` を使ってバンドルを作り直してください。

<a id="evidence-bundle-invalid"></a>
### `EVIDENCE_BUNDLE_INVALID`

**意味。** バンドルが有効な JSON ではないか、`gstack-evidence-bundle` v1 ではありません。

**対処。** `gstack-evidence bundle` で作り直してください。バンドルを手で編集することはありません。

<a id="preregistration-not-ancestor"></a>
### `PREREGISTRATION_NOT_ANCESTOR`

**意味。** ポリシーの `preregistration_shas` のエントリが HEAD の祖先ではありません。そのため、事前登録された eval はこのブランチを表していません。

**対処。** そのコミットがブランチの履歴に含まれるようにマージまたは rebase するか、ベースブランチでそのエントリを削除してください。`gstack-evidence ancestor <sha>...` はエントリごとに 1 行ずつ結果を出力します。ship receipt にはその結果が記録されます。

<a id="history-policy-violation"></a>
### `HISTORY_POLICY_VIOLATION`

**意味。** ポリシーは `history: merge-only` を指定していますが、計画では squash、rebase、またはその他の方法でブランチを書き換えることになっています。`gstack-ship-policy check-history --plan squash|rebase` は、何かが動く前に拒否します(終了コード 3)。`--plan` を付けない場合は、push 済みのブランチが HEAD の祖先でなくなったときに違反を報告します(終了コード 1)。

**対処。** `git merge origin/<base>` を実行し、すべてのコミットを残してください。PR はマージコミットでマージしてください。

<a id="receipt-missing"></a>
### `RECEIPT_MISSING`

**意味。** `gstack-ship-receipt read --pr <n>` が、PR 本文の中に ```` ```gstack-ship-receipt ```` ブロックを見つけられませんでした。

**対処。** `/ship` の Step 18 が書き込みます(`gstack-ship-receipt write ... --pr <n>`)。古い PR の場合は、同じコマンドで一度手動で書き込んでください。

<a id="receipt-invalid"></a>
### `RECEIPT_INVALID`

**意味。** ブロックは存在しますが、`ship-receipt` スキーマ(`gstack-artifact schema ship-receipt`)に対して検証できません。

**対処。** `gstack-ship-receipt write` で再生成してください。ブロックを手で編集してはいけません。
<a id="execution-unknown"></a>
### `EXECUTION_UNKNOWN`

**意味。** `gstack-autoplan` が、ある試行について dispatch の意図を記録しました(プロンプトはレビュアーに渡されました)が、その後に終了レコードがありません(`submit` もキャンセルもありません)。ランナーが強制終了されたか、親プロセスが戻ってこなかったかのどちらかです。プロバイダーは完了して課金された可能性があります。スナップショットのハッシュは、どの入力が送られたかを証明しますが、レビューが完了したかどうかは証明しません。支出台帳には、その試行の予約分が残ります。

**対処。** レビュアーが完了していた場合は、同じ試行 ID で結果を submit してください(`gstack-autoplan submit --out <dir> --phase <p> --voice <v> --result <file> --model <id> --attempt <id>`)。後から届いた結果も引き続き紐づけられます。完了していなかった場合は、`gstack-autoplan next --out <dir> --redispatch <attempt>` で明示的に再 dispatch してください。`resume` と `next` は、曖昧な試行を自動的に再 dispatch することはありません。

<a id="run-locked"></a>
### `RUN_LOCKED`

**意味。** 別の `gstack-autoplan` プロセスが `<dir>/run.lock` を保持しています(ファイルには pid、ホスト、開始時刻が記録されています)。変更を伴うコマンドはすべて、実行中ロックを取得するため、2 つの書き手が互いに干渉することはありません。

**対処。** 所有プロセスが終了するまで待ってください。その pid がすでに存在しない場合(ランナーが強制終了された場合)は、`gstack-autoplan resume --out <dir>` を実行すると所有権を取得し、未完了の試行を整理します。pid が生きているロックが奪われることはありません。

<a id="run-not-initialized"></a>
### `RUN_NOT_INITIALIZED`

**意味。** `--out` ディレクトリに、`gstack-autoplan` が書いた `run.json` がありません。そのため、`submit`、`status`、`answer`、`resume` が対象とするものがありません。

**対処。** `gstack-autoplan next --plan <file> --out <dir>` で実行を開始してください。最初の `next` で実行が初期化されます(復元ポイント、アクティブな計画、マニフェストを作成します)。

<a id="phase-not-awaiting"></a>
### `PHASE_NOT_AWAITING`

**意味。** `submit` が指定したフェーズまたは voice は、結果を待っている状態ではありません。そのフェーズはすでに閉じられているか、まだ開かれていないか、その voice にはすでに紐づいた結果があります。

**対処。** `gstack-autoplan status --out <dir>` を実行し、直前の `next` が出力した試行(`ATTEMPT: ... phase=<p> voice=<v>`)に対して submit してください。

<a id="attempt-mismatch"></a>
### `ATTEMPT_MISMATCH`

**意味。** `--attempt` の ID が、そのフェーズと voice に対して開いている試行ではないか、その試行はすでに submit 済みです。結果は 1 回だけ紐づけられます。同じ試行を 2 回 submit すると、最初の結果を上書きせず拒否されます。

**対処。** その voice について `next` が出力した試行 ID を渡してください。紐づいた結果を置き換えたい場合は、`answer` でフェーズを開き直す(スコープを変える選択になります)か、新しい実行を開始してください。

<a id="result-receipt-missing"></a>
### `RESULT_RECEIPT_MISSING`

**意味。** 結果ファイルの先頭に、プロンプトが要求した完全読了の receipt がありません。receipt は `INPUT: <phase> <snapshot sha256>` の形式です。レビュアーがプロンプトファイルを EOF まで読まなかったか、その結果が別のスナップショットに対するものです(dispatch と submit の間に計画が変わりました)。

**対処。** レビュアーの 1 行目は、プロンプトファイルの INPUT 行と同じでなければなりません。計画が変わった場合は、`next` を再実行して新しいスナップショットを取得し、再 dispatch してください。古いスナップショットに対する結果が現在のフェーズに紐づくことはありません。

<a id="result-findings-missing"></a>
### `RESULT_FINDINGS_MISSING`

**意味。** 結果に、有効な正規の findings ブロックがありません。各レビュアーは、散文と一緒に次のフェンス付きブロックを 1 つ返します。

````
```gstack-findings
{"severity":"High","title":"...","file":"lib/x.ts","line":12,"fix":"..."}
```
````

1 行に 1 つの JSON オブジェクトで、少なくとも `severity`(`Critical`、`High`、`Medium`、`Low`、`Informational` のいずれか)と `title` を含みます。空のフェンスは、レビュアーが何も見つけなかったことを意味します。フェンスがない場合や行の形式が不正な場合は、結果を照合できないため拒否されます。

**対処。** レビュアーにフェンスを出すよう依頼してください(プロンプトにその指定があります)。あるいは、散文から行を自分で追加して、再度 submit してください。照合は散文ではなくこれらの行に対して行われます。散文だけのレビューには、網羅性のチェックがありません。

<a id="model-family-conflict"></a>
### `MODEL_FAMILY_CONFLICT`

**意味。** 外部 voice のモデルが、ネイティブのレビュアーと同じファミリーに属しています(どちらも Anthropic、どちらも OpenAI など)。または、ID からファミリーを判定できません。同じファミリーの 2 つの voice は、実質的には 1 つの voice です。記録には、どの voice がどのモデルかが示されます。

**対処。** 外部 voice を別のファミリーのモデルで実行し、そのモデルの ID を `--model` で渡してください。認識されるファミリーは、anthropic、openai、google、xai、deepseek、qwen、zai、moonshot、meta、mistral、minimax です。テーブルで分類できない ID は拒否されます。モデル名は完全に指定してください(`astra` ではなく `openai/gpt-6-astra`)。

<a id="spend-cap-exceeded"></a>
### `SPEND_CAP_EXCEEDED`

**意味。** `spent + reserved + next_estimate` が `--spend-cap` を超えます。台帳(`<dir>/spend.json`)は、未確定の予約と不明な課金を予約額で計上します。そのため、クラッシュした試行のコストは、確定または解放されるまで保留されたままです。

**対処。** `--spend-cap` を引き上げるか、実際のコストがわかっている試行を確定させるか(`submit --usage-usd <n>`)、実行されなかった試行を解放するか(`gstack-autoplan release --attempt <id>`)、ここで停止してください。ホストが dispatch したサブエージェントの支出は `unknown` として扱われ、ゼロ扱いにはなりません。

<a id="consensus-missing"></a>
### `CONSENSUS_MISSING`

**意味。** Eng フェーズの `next` が、閉じられた前のフェーズに、そのコンセンサス記録(`<phase>-consensus.md` とその照合行)がないことを見つけました。そのため、そのフェーズの要約がないまま Eng のプロンプトが送られてしまうことになります。

**対処。** `gstack-autoplan resume --out <dir>` を実行すると、照合を通じてフェーズが再度閉じられます。閉じられたすべてのフェーズに要約が揃うまで、Eng の dispatch は拒否されます。一部だけ送られることはありません。

<a id="outside-runner-unavailable"></a>
### `OUTSIDE_RUNNER_UNAVAILABLE`

**意味。** `gstack-outside-voice run --runner <r>` をここで実行できません。`codex-cli` は `codex` バイナリもログインも見つけられませんでした。`api` は、そのモデルのファミリーに対応する `OPENAI_API_KEY` も `ANTHROPIC_API_KEY` も見つけられませんでした。`host-subagent` は `--result <file> --model <id>` なしで呼ばれました。別のランナーが設定されている場合(`--fallback` または `GSTACK_OUTSIDE_RUNNER`)は、`codex-cli unavailable; using <runner>` という行が表示され、そのランナーでレビューが続行されます。これは完全な外部 voice であり、縮退版ではありません。ほかに使えるランナーがない場合は、カバレッジが欠けている状態です。

**対処。** `gstack-codex-login` は `OPENAI_API_KEY` から Codex にログインします(無人のマシン向けです)。または、API キーを設定して `--runner api` を渡してください。あるいは、別ファミリーのサブエージェントでレビューを実行し、そのファイルを `--runner host-subagent --result <file> --model <id>` で submit してください。

<a id="reality-row-missing"></a>
### `REALITY_ROW_MISSING`

**意味。** `gstack-plan-reality check --phase <p> <review>` で、レビューが含むべき行に対応する `REALITY: <row> …` の行が見つかりませんでした。対象は、ティア 1 のすべての行(`premise-table`、`already-done`、`surface-check`、`binding-decisions`、`numbers`、`deferred-asks`、`pr-count`)と、`--scope` で指定されたスコープに対応するティア 2 の行です。また、ティア 1 の行が `n/a` とマークされている場合も対象です。チェックは `PLAN_REALITY: phase=<p> rows=<n>/<m> missing=<ids> verdict=<v>` を出力し、終了コード `1` で終わります。無人実行では判定は `incomplete` となり、そのフェーズは閉じません。対話的な実行では判定は `repair` となり、不足している行を作成して再チェックします。これは最大 2 回までで、その後は不足したままの行を各々ゲートで警告します。

**対処。** `gstack-plan-reality rows --phase <p> [--scope <csv>]` は、各行のチェック内容を出力します。その内容に従って作業し、レビューの最後に、行ごとに 1 行ずつ `REALITY: <row> pass|finding <summary> <file:line>` を書いてください。

<a id="reality-receipt-missing"></a>
### `REALITY_RECEIPT_MISSING`

**意味。** `REALITY:` の行には行名と状態がありますが、receipt がありません。receipt は `path:line`、`path:line-line`、またはコミットの sha です。receipt があることで、その行は主張ではなくチェックとして扱われます。

**対処。** その行に、チェックを行った場所を追記してください。例: `REALITY: already-done pass 0 hits since 2026-10-09 for bin/gstack-doctor 91bbd9e` または `REALITY: surface-check finding bun upgrade --version absent on 1.3.14 bin/gstack-capy-install:52`。

## プリゲート: 生成ファイルのレジストリ、gstack-pregate、Issue リンク

どちらのツールも、ピン留めファイル(`.gstack/generated.json`、`.gstack/pregate.json`)を作業ツリーからではなく `origin/<base>` から読みます。また、リポジトリが宣言したコマンドは、`--allow-repo-commands` を付けた場合か `/ship` の内部でのみ実行されます。詳細は docs/pregate.md を参照してください。

<a id="regen-registry-invalid"></a>
### `REGEN_REGISTRY_INVALID`

**意味。** `.gstack/generated.json` が有効な JSON ではないか、未知のキーがあるか、`id`/`inputs`/`outputs` が欠けているか、ID が重複しています。

**対処。** `gstack-regen validate` は、すべてのエラーを JSON パス付きで表示します。`gstack-regen init --explain` と比較して、ベースブランチでファイルを修正してください。

<a id="regen-containment"></a>
### `REGEN_CONTAINMENT`

**意味。** レジストリの glob がリポジトリの外に出ている(`..`、絶対パス、各リストで 64 を超える)か、コマンドが 1 行でないか、512 バイトを超えています。

**対処。** リポジトリからの相対 glob を使い、コマンドは 1 行ごとに書いてください。

<a id="regen-stale"></a>
### `REGEN_STALE`

**意味。** 登録された出力が、現在のツリーの一時的な `git worktree` でそのコマンドが生成する内容と異なります。出力が古いか、手で編集されています。

**対処。** 表示されたコマンドを実行してください(`gstack-regen write --only <id>` はその場で実行します)。そして出力をコミットしてください。生成ファイルを手でマージしてはいけません。コンフリクトが起きたら、どちらか一方を選んでから再生成してください。

<a id="regen-command-failed"></a>
### `REGEN_COMMAND_FAILED`

**意味。** 登録されたコマンドが、一時的な worktree で 0 以外の終了コードで終了しました。

**対処。** リポジトリで手動で実行し、出力を確認してください。一時的な worktree には独自の `node_modules` がないため、依存関係を必要とするコマンドはリポジトリのものを参照する必要があります(gstack のエントリは `bun run` 経由でこれを行います)。

<a id="regen-deps-missing"></a>
### `REGEN_DEPS_MISSING`

**意味。** 登録されたコマンドは 0 で終了し、その出力はコミット済みのものと異なります。ただし `package.json` は依存関係を宣言しており、リポジトリには `node_modules` がありません。そのため、一時的な worktree は依存関係なしで生成処理を実行しました。差分は古いファイルではなく、依存関係の欠落から生じた可能性があります。そのためこのエントリは `REGEN_STALE` ではなく、未検証として報告されます。

**対処。** 表示されたインストールコマンド(`bun install`、またはリポジトリのロックファイルに対応するもの)を実行してから、`gstack-regen check` かプリゲートを再実行してください。

<a id="pregate-config-invalid"></a>
### `PREGATE_CONFIG_INVALID`

**意味。** `.gstack/pregate.json` に、未知のキー、誤った型、リポジトリの外に出る glob、`{files}` を含まないランナー、または `warn` 内の `secrets` があります。

**対処。** `gstack-pregate validate` を実行してください。`secrets` と必須レーンの義務は格下げできません。それ以外の `warn` 内のチェック ID は、ベースブランチのコピーに書かれている場合のみ適用されます。

<a id="pregate-secrets"></a>
### `PREGATE_SECRETS`

**意味。** `gstack-redact` が、このブランチが追加した行の中で HIGH の検出、または `secret` カテゴリの MEDIUM の検出を見つけました。

**対処。** 認証情報をローテーションし、追加した行から(履歴も含めて)削除してから、再実行してください。格下げはできません。

<a id="pregate-strays"></a>
### `PREGATE_STRAYS`

**意味。** リポジトリのルート、新しいトップレベルディレクトリ、または一時的な名前(`zz-*`、`tmp*`、`scratch*`)でファイルが追加された。

**対処。** 削除するか移動してください。意図的にルートに置くファイルは `strays.allow` に記載します。

<a id="pregate-literals"></a>
### `PREGATE_LITERALS`

**意味。** 変更されたエクスポート定数(または名前付きのタイムアウト/リトライのリテラル)が、ブランチで更新されていないテストファイルに、古い値のまま残っている。nightly および Heavy 専用のファイルも対象に含まれる。

**対処。** 一覧に出ている `file:line` をすべて更新するか、古い値を残してください。

<a id="pregate-no-lane"></a>
### `PREGATE_NO_LANE`

**意味。** 変更されたソースファイルが、静的インポート、リポジトリパスの文字列リテラル、`bin/<name>` → `test/<name>*.test.ts` の命名規則、または `dependencies` の宣言のいずれを通してもテストに対応付けられない。Django プロジェクトでは、Django が名前で読み込むファイル(settings の文字列、include()、アプリのマイグレーション、admin、テンプレート、静的ファイル)も対応付けの対象になる。これは合格ではなく失敗である。どのテストにも依存されていない Markdown は docs/no-tests の空レーンであり、このエラーには当たらない。名前に plan、evidence、redproof が含まれているかどうかは関係ない。あるテストがそれらのファイルを読む場合(パスの引用や、パスセグメントの `join()`)は、そのテストが選択される。対応付けられないソースファイルやコードファイルは引き続き失敗する。テストディレクトリ配下のファイルは、この空レーンには該当しない。画像、フォント、メディア、およびどのテストも名前を挙げていない許可リスト入りのツール設定は、assets-and-tool-config の空レーンであり、このエラーではない。

**対処。** そのファイルを名指しするテストを追加するか、`.gstack/pregate.json` の `dependencies` にレーンを宣言してください(動作を持たないファイルには明示的な `[]` を指定します)。それ以外の非 Markdown のドキュメントは、ベースブランチの `empty_lanes` に記載します。`integration_test/` または `test_driver/` 配下の Dart ファイルはデバイスを必要とするため、pregate では実行されません。その場合は `dependencies` に `"**/integration_test/**": []`(および `"**/test_driver/**": []`)を宣言し、CI で実行させてください。ポリシーがまだない場合は、`gstack-pregate init` がリポジトリから `dependencies` のエントリを作成し、配置できなかったファイルを一覧表示します。`--explain` は、すべての対応付けとその理由を表示します。レーンのないファイルについては、テストファイル内で解決されなかったインポート指定子(例えば、対象が存在しない `tsconfig.json` の `paths` エイリアス `@/lib/x`)や、たどられなかった `extends` の中継(相対 `extends` のみ、最大4ホップ)も表示します。テストが実際にそのファイルをカバーしている場合は、`dependencies` に宣言してください。リゾルバーが見つけるべきだったのに見つけられなかった場合は、その指定子をリゾルバーの不具合として報告してください。

<a id="pregate-lane-failed"></a>
### `PREGATE_LANE_FAILED`

**意味。** 変更されたファイルが選択したローカルレーンが、`set -o pipefail` の下で非ゼロで終了したか、テストを 0 件しか報告しなかった(ZERO-RUN)。

**対処。** 出力されたレーンのログを読み、失敗を修正して、`gstack-pregate --stage tests` を再実行してください。`| tail` によって隠れた終了も、終了であることに変わりはありません。

<a id="pregate-incomplete"></a>
### `PREGATE_INCOMPLETE`

**意味。** チェックがタイムアウトした、そのツールが利用できない、リポジトリのコマンドが許可されていない、またはチェックの実行中に作業ツリーが変わった。Incomplete は合格とは扱われず、公開もブロックされる。

**対処。** `--allow-repo-commands` を指定する、ツールをインストールする(Dart パッケージの場合、メッセージには `not on PATH: dart` または `flutter` と表示される。リポジトリが fvm で固定している場合は fvm も使える)、メッセージが `pubspec.yaml` を持たないと指摘する Dart パッケージの `pubspec.yaml` をコミットする(または `runner` を宣言する)、`--timeout` を上げる、あるいは作業ツリーを変更せずに保ってから、再実行してください。

<a id="pregate-stalled"></a>
### `PREGATE_STALLED`

**意味。** レーンチェック(またはガード、`--remote` ゲート)が起動したテストコマンドが、ストールタイムアウト(デフォルトは 300 秒。ベースブランチの `.gstack/pregate.json` の `stall_timeout_s`、または `--stall-timeout`)の間、ログに何も書き出さなかった。pregate はそのプロセスグループを強制終了し、最後に開始されたテストファイルの名前を表示する。このチェックは未完了であり、合格ではない。

**対処。** 出力されたログを開き、指定されたファイルでハングの原因を探してください(ブロックされた子プロセス、終了しないサーバー、同期的な待機など)。修正してから `gstack-pregate --stage tests` を再実行します。正当な理由で長く静かになるテストには、より大きな `--stall-timeout` が必要です。`0` を指定するとストールによる強制終了が無効になり、`--timeout` だけが残ります。

<a id="pregate-receipt-invalid"></a>
### `PREGATE_RECEIPT_INVALID`

**意味。** `gstack-pregate clear --remote pregate.json/remote_gate --receipt <file>` が、リモートゲートの出力を読み取った結果、その `PREGATE_REMOTE:` 行が欠けている、`pregate.json` がテストしたものとは別のツリーを指している、0 件のテストを報告している、または失敗を報告している、のいずれかに該当した。この義務は未クリアのままになる。実行 URL だけでは、この義務はクリアされない。`test_backend/<backend>` の義務は実行 URL を受け付けるが、その URL は検証済みではなく、申告済み(attested)として記録される。

**対処。** pregate がテストしたツリーでリモートゲートを実行し、その出力ファイルを `--receipt` で渡してください。または、`gstack-pregate --stage tests --remote --spend-cap <usd> --allow-repo-commands` を実行させて、結果を検証させてください。

<a id="pregate-stale"></a>
### `PREGATE_STALE`

**意味。** `pregate.json` が、公開しようとしている作業ツリーのフィンガープリントとは別のものに対して記録されている(最終スタンプ、再生成、または任意の編集の後)。

**対処。** 最終的な生成とスタンプの後で `gstack-pregate` を再実行してください。そうしないと、Step 18 は出荷レシートの書き込みを拒否します。

<a id="pregate-remote-uncleared"></a>
### `PREGATE_REMOTE_UNCLEARED`

**意味。** `requires-remote` の義務(このマシンでは実行できないプラットフォームレーンで、`workflow.yml/job` によって指定される)に、レシートがない。

**対処。** そのジョブをディスパッチし、その後 `gstack-pregate clear --remote <workflow.yml/job> --run-url <url>` を実行してください(エビデンスバンドルから行う場合は `--bundle-lane <label>`)。出荷レシートには、各義務とそのレシートが記載されます。

<a id="issue-unreadable"></a>
### `ISSUE_UNREADABLE`

**意味。** `Fixes #N`/`Closes #N` のトレーラー、または `--issue N` で指定された Issue を、`gstack-issue-guard` を通じて読み取れなかった。

**対処。** `gh auth status` と番号を確認してください。読み取れるようになるまでは、そのリンクは `Fixes` ではなく `Refs #N` として表示されます。

<a id="issue-lookup-failed"></a>
### `ISSUE_LOOKUP_FAILED`

**意味。** `gstack-issue-links` が、リポジトリを解決できなかった、この PR が修正する Issue をクローズする未解決の PR の一覧を取得できなかった、`--ci-run` の ID を名指ししている flake の Issue を検索できなかった、またはこの PR の作成者を特定できなかった。`gh` はアプリ(`…[bot]`)として実行されており、HEAD コミット(未 push、または GitHub ユーザーに紐づいていない)もユーザー所有のリポジトリも、作成者を示していない。そのため、オーナー自身の未解決 PR は `Related:` の行に残る。クローズおよび参照の行は引き続き出力される。`--json` を指定すると、各失敗が `unavailable` の下に一覧されます。

**対処。** `gh auth status` を確認してください。リモートが GitHub リポジトリでない場合は `--repo <owner/repo>` を、`gh` がアプリとして実行されている場合は `--author <login>` を指定してから、再実行します。それでも失敗する場合は、どの検索が欠けているかを引き継ぎ時に明記してください。本文が完全であるかのように提示してはいけません。

<a id="issue-links-missing"></a>
### `ISSUE_LINKS_MISSING`

**意味。** `gstack-ship-receipt write --issues @issues.json --body <file>` が、Issue オブジェクトに記録された `Fixes`、`Refs`、`Flake:`、`Related:`、`Supersedes`、または `Contributed by` の行が本文に欠けていることを検出した。このままでは PR 本文とそのレシートが食い違ってしまうため、何も書き込まれなかった。

**対処。** `gstack-issue-links` が `## Issues` の下に出力した行をすべて本文に貼り付けるか(Issue の集合が変わった場合は `gstack-issue-links --out` を再実行してから)、レシートの書き込みを再実行してください。

## eval の計画、レーンの所有、証拠の検証、オーナー向けブリーフ

`bin/gstack-eval-plan`、`bin/gstack-lane-check`、`gstack-evidence verify`、`bin/gstack-owner-brief`、`bin/gstack-contributor-mode`、`bin/gstack-banned-terms` が出力するコードです(計画 E1〜E3)。それぞれ、末尾に括弧付きのエラー行が出力されます。コードを grep して確認してください。

<a id="prereg-incomplete"></a>
### `PREREG_INCOMPLETE`

**意味。** `gstack-eval-plan prereg --check <file>` が、必須の事前登録セクションの欠落または空を検出した。対象は `## Bars`、`## Arms`、`## Decoys`、`## Stop rules`、`## Held-out exposure`(計画が触れるすべての held-out セット、その事前の露出、およびそのセットに対する予約)である。

**対処。** 有償の呼び出しを行う前に、名指しされたセクションを埋めてください。停止ルールや held-out の露出を示せない計画は、事前登録されていないことになります。パイロットは、このチェックに合格するまで開始を拒否します。

<a id="eval-price-missing"></a>
### `EVAL_PRICE_MISSING`

**意味。** あるアームのモデルが `lib/pricing.ts` に行を持っていないため、承認見積もりが `$0` になってしまう。台帳はそれを無制限に承認してしまう。

**対処。** プロバイダーの料金ページから行を追加してください(100 万トークンあたりの USD を `as_of` と共に記載)。または、そのアームを削除します。この表は標準のテキストトークンのみを価格設定しています。除外された課金カテゴリについては `lib/pricing.ts` を参照してください。

<a id="eval-dry-run-failed"></a>
### `EVAL_DRY_RUN_FAILED`

**意味。** 実際の入力ファイルに対する `$0` のスタブモデルでのドライランで、有償の実行であれば支払うことになっていた問題が見つかった。具体的には、プロンプトに必要なフィールドがない行、推論モデルには小さすぎる出力予算、またはリトライ用のプロンプトテキストがない、といったものである。

**対処。** 名指しされた行またはフラグ(`--output-budget`、`--retry-prompt`)を修正し、`gstack-eval-plan dry-run` を再実行してください。出力されるチェックリストが、パイロットに必要な記録になります。

<a id="eval-arms-unresolved"></a>
### `EVAL_ARMS_UNRESOLVED`

**意味。** `gstack-models resolve --role eval-arms` がアームを一つも生成せず、リポジトリのポリシードキュメントによるフォールバック(`--policy-doc`、デフォルトは `docs/model-policy.md`、`MODEL_POLICY.md`、`docs/MODELS.md` のうち最初に見つかったもの)にも、価格設定されたモデルが記載されていなかった。

**対処。** `--arms <model,model>` を指定するか、`--policy-doc` でプロジェクトで許可されたモデルを一覧している文書を指すか、モデルポリシーの設定を修正してください。

<a id="eval-budget-exhausted"></a>
### `EVAL_BUDGET_EXHAUSTED`

**意味。** 台帳が次の予約を拒否した。消費済み + 予約済み + 不明な課金 + 見積もりが上限を超えている(その下では `SPEND_CAP_EXCEEDED`)。実行はステータス `budget_exhausted` で停止し、再試行されない。

**対処。** 支出表(`gstack-eval-plan pilot report`)を確認し、未決の試行を確定させるか解放してから、意図的に `--cap` を上げるか、停止してください。

<a id="lane-conflict"></a>
### `LANE_CONFLICT`

**意味。** `gstack-lane-check` が、計画中のファイルを、進行中のブランチまたはプルリクエストがすでに変更していることを検出した。該当行には PR 番号、ブランチ、およびハンク数が表示される。

**対処。** そのファイルの所有者を一つに決めてください。その PR がマージされるのを待つか、このレーンをそのブランチの上に積むか、計画からそのファイルを外します。2つのレーンが同じファイルを編集することは、このチェックが防ぐために存在するマージコンフリクトの事故にあたります。

<a id="lane-ref-unavailable"></a>
### `LANE_REF_UNAVAILABLE`

**意味。** `--branch` または `--pr` を解決できなかった。ref が取得されていないか、`gh` が存在しないかログインしていない。

**対処。** `git fetch origin <branch>` を実行するか、`gh auth status` を確認してください。解決できなかったレーンは、そのように報告され、クリア済みとして数えられることは決してありません。

<a id="evidence-unverified"></a>
### `EVIDENCE_UNVERIFIED`

**意味。** `gstack-evidence verify <bundle>` が、このマシン上ではレーンの主張を検証できなかった。コミットされたツリーがバンドルのものと異なる、記録されたログが存在しない、またはそのハッシュが異なる、あるいはプローブが再実行されていない、のいずれかである。

**対処。** バンドルのコミットをチェックアウトし、`--rerun` を実行して、ここでレーンのコマンドを実行してください。または、その主張を、ゲートの再利用に決して数えられない、取り込まれた主張として扱ってください。

<a id="banned-term-found"></a>
### `BANNED_TERM_FOUND`

**意味。** 差分が、`.gstack/banned-terms.json` に記載された用語を、その用語の `allowed_paths` の外側に追加している。検出結果には、用語、ファイル、行、および許可された場所が示される。

**対処。** 追加された行からその用語を削除するか、テキストを許可されたパスに移動してください。`/review` と `/document-release` は、すべての差分でこのチェックを実行します。

<a id="banned-terms-invalid"></a>
### `BANNED_TERMS_INVALID`

**意味。** `.gstack/banned-terms.json` が無効である。`terms` は空でない文字列のリストでなければならず、各 `allowed_paths` のエントリは、単純なリポジトリ相対のグロブでなければならない(`..` 、絶対パス、シンボリックリンクによる脱出は不可)。

**対処。** `gstack-banned-terms init` は、すべてのキーがデフォルト値であるコメント付きの例を書き出します。`gstack-banned-terms validate` でファイルを検証できます。

<a id="contributor-source-unavailable"></a>
### `CONTRIBUTOR_SOURCE_UNAVAILABLE`

**意味。** `gstack-contributor-mode detect` が、`.gstack/ship-policy.json` に `maintainers` のリストを見つけられず、collaborators API にも問い合わせられなかった(`gh` が存在しない、ログインしていない、または PR の作成者を解決できない)。そのため、モードはオフになり、`source=off` が記録される。

**対処。** ship policy に `maintainers` を追加してください(明示的なリストが常に優先される)。`gh auth login` を実行するか、このレビューに限ってモードを強制するために `--contributor` を指定してください。

<a id="brief-input-missing"></a>
### `BRIEF_INPUT_MISSING`

**意味。** `gstack-owner-brief render --out <dir>` には、実行ディレクトリに `gate.json`、`decisions.jsonl`、`findings.jsonl` が必要だが、そのうち一つが欠けている。

**対処。** 先にゲートに到達させてください(`gstack-autoplan next --out <dir>` を `gate_pending` になるまで実行する)。ブリーフは、ゲートが書き出した内容を描画します。

<a id="draft-direction-unresolved"></a>
### `DRAFT_DIRECTION_UNRESOLVED`

**意味。** フェーズクローズの書き換えが、`draft direction stands until the owner decides` という行を見つけたが、その判断 ID がまだ保留中のため、そのまま残された。

**対処。** その ID に対するゲートに回答してから、`gstack-owner-brief close` を再実行してください。判断済みの行だけが、選ばれた選択肢と日付に書き換えられます。

<a id="setup-crlf-repair"></a>
### `warning: left <n> locally edited file(s) with CRLF line endings that gstack pins to LF`

**意味。** Git for Windows は `core.autocrlf=true` でチェックアウトするため、`.gitattributes` が LF に固定するまで、gstack のネストされたシェルスクリプト(スキルの `bin/` ヘルパー、Claude のフックシム、`lib/cso/images/*`、`scripts/app/*`)は CRLF で書かれていた(#3110)。Git Bash はそれでも実行できるが、同じチェックアウトを読む Linux の bash(同期されたツリー、WSL、バインドマウント)は `set: pipefail: invalid option name` で失敗し、その方法で失敗するフックは、それが保護するツール呼び出しをブロックする。新しいルールを取り込んでも既存のコピーは修正されない。Git は内容が変わらなかったファイルを書き換えないからである。setup は、`git ls-files --eol` を一度実行してそれらのファイルを見つけ、LF で再チェックアウトする。ローカルで編集されたファイルは触らず、この警告の中で名前を挙げる。同じセクションは、`skipped the CRLF repair`(別の setup がインストールレジストリのロックを保持していた)と `the CRLF repair could not rewrite every file` もカバーしている。

**対処。** 編集されたファイルについては、stash して restore してください。Git は LF で書き戻し、あなたの編集は保たれます。

```bash
cd ~/.claude/skills/gstack && git stash && git stash pop
```

修復がスキップされた場合は、もう一方の setup が終わったら `./setup` を再実行してください。失敗した場合は、チェックアウトで `git checkout -- . && ./setup` を実行すると、ローカルの編集は破棄され、すべてのファイルが書き直されます。インストールディレクトリが `~/.claude/skills/gstack` でない場合は、そのディレクトリを使ってください(`./setup --status` が表示します)。期待される結果は、次の `./setup` で CRLF の警告が出力されないことです。

## フィールドウェーブのレーン CD: プリゲートのガード、再ゲート、封印された出力

<a id="pregate-guard-failed"></a>
### `PREGATE_GUARD_FAILED`

**意味。** ベースブランチの `.gstack/pregate.json` にあるガード(シリアルテストのマニフェストチェックや CLI のゴールデンテストなど、リポジトリのコマンド)が、ブランチが変更したファイルに一致し、非ゼロで終了した。ガードは、インポートグラフからは見えない領域(マニフェスト、サブプロセスのゴールデン、レジストリ)をカバーする。これらを warn に格下げすることはできない。

**対処。** 表の中のガードの行(終了コード、出力の末尾、ログのパス)を読み、その `fix` の行に従って対処し、コミットしてから、`gstack-pregate run --allow-repo-commands` を再実行してください。レーンは、これが合格した後にのみ完了と報告され、そのハンドオフに `PREGATE:` の行を含めます。

<a id="migration-collision"></a>
### `MIGRATION_COLLISION`

**意味。** `gstack-pregate regate` が、ベースブランチの `.gstack/ship-policy.json` から `migrations`(`dir`、`id`)を読み取り、このブランチが追加するマイグレーション番号が、ベースブランチにすでにあるか、別のファイル名で別の未解決 PR が追加するものと一致することを検出した。両方の PR は、それぞれのゲートを通過してしまうが、二番目のマージでスキーマの順序が壊れてしまう。オープン PR の検索が完了できない場合(`gh` が存在しない、または失敗している、オープン PR が 1000 件ある、GitHub がファイル一覧を切り詰めて完全に取得できない PR がある)には、その行は `MIGRATION_COLLISION: unknown (...)` と表示され、`REGATE: not-needed` は出力されない。

**対処。** この PR が次にマージされるときに使える空いているマイグレーション番号を取り、ファイルと ID の名前を変更し、コミットしてから、`gstack-pregate regate --against <gated-head> --bundle <file>` を再実行してください。名前を変更したマイグレーションはコードの変更であるため、ゲートは再実行されます。

<a id="sealed-output-refused"></a>
### `SEALED_OUTPUT_REFUSED`

**意味。** リポジトリが `.gstack/pregate.json` に `sealed` ポリシーを宣言しており(ベースブランチ ∪ push されたコミット)、今回の push が公開するコミットが、sealed のパスまたはトランスクリプトを追加している(バイナリ、空のファイル、後で削除されたファイルを含む)か、sealed-answer のマーカー、シード、またはローカルのホームパスを含む行を追加している。そして、送信先が公開されているか、その可視性が不明である(新規または読み取れないリポジトリは公開とみなされる)。読み取れない、または不正な形式の sealed ポリシーも拒否される。管理された pre-push フックと `gstack-pregate sealed` は、検出結果ごとに 1 行を出力する。ルール、`file[:line]`、コミットである。一致したテキストは決して出力されない。

**対処。** ブランチが公開リポジトリに届く前に、公開されるすべてのコミットからその出力を削除してください(後のコミットで削除しても、それまでに公開されたものは残ります)。レビュー済みの誤検知は、ベースブランチの `.gstack/sealed-allow.tsv` に 1 行で記載します。形式は `rule<TAB>path<TAB>sha<TAB>reason` です。非公開の送信先の場合は、ベースブランチの `.gstack/pregate.json` の `sealed` 配下に `"visibility": "private"` を設定してください。Capy のプルリクエストツールはローカルのフックを実行しないことがあるため、push や PR 作成の前には、ご自身で `gstack-pregate sealed` を実行してください。

<a id="eval-gate-unpriced"></a>
### `EVAL_GATE_UNPRICED`

**意味。** `gstack-eval-plan price-gate` が、有償ゲートのためのコール計画ファイルを見つけられなかった。`--plan-file` がない、ベースブランチの `.gstack/pregate.json` に `price_file` がない、またはファイルに `GSTACK_EVAL_CALLS` の行がない、のいずれかである。(宣言された `price_file` が HEAD に存在しない場合は、これではなく `EVAL_PLAN_STALE` になる。)コストが不明なゲートは、価格設定済みとして承認することはできない。

**対処。** 利用するリポジトリは、[docs/eval-calls.md](eval-calls.md) の形式でコール計画ファイルをコミットし、それを `price_file` に指定してください。オーナーが価格未設定のゲートを認めた場合に限り、`--allow-unpriced "<reason>"` を付けて再実行します。これは終了コード 0 で終了し、`GATE_UNPRICED_OVERRIDE: <reason> (owner-authorized override; not authorization to spend)` を出力し、その理由をレシートに記録します。

<a id="eval-gate-over-cap"></a>
### `EVAL_GATE_OVER_CAP`

**意味。** ゲートの課金合計が `--cap-usd` を超えているか、1回の呼び出しの予約量(入力の分担分と `max_out_tokens` の合計)が `--cap-usd` を超えているか、`scope=smoke` の行の場合は `--smoke-cap-usd` を超えていることを示します。プロバイダーは上限に収まらない予約を拒否するため、このまま実行すると支払い後に失敗してしまいます。

**対処。** 呼び出し計画で質問数、アーム数、または `max_out_tokens` を減らして計画ファイルを再生成するか、オーナーと相談のうえ上限を意図的に引き上げてください。上限をすり抜けるために呼び出しを分割してはいけません。

<a id="eval-plan-stale"></a>
### `EVAL_PLAN_STALE`

**意味。** 呼び出し計画ファイルが、承認されようとしている内容とは異なるものに価格を付けています。具体的には、その `GSTACK_EVAL_GATE` コマンドが正確な `--gate` 文字列と一致しない、`GSTACK_EVAL_HEAD` が HEAD より古く、計画ファイル以外のファイルが変更されている、入力のsha256が HEAD 上で `GSTACK_EVAL_INPUT` の行と一致しない、あるいは基本ポリシーの `price_file` が HEAD コミットに含まれていない、といった場合です。`--allow-unpriced` でもこの拒否は覆せません。

**対処。** 正確なゲートコマンドに対して、HEAD 時点で計画ファイルを再生成し(リポジトリ自身の生成元を使用)、コミットしてから `gstack-eval-plan price-gate` を再実行してください。

<a id="plan-sections-invalid"></a>
### `PLAN_SECTIONS_INVALID`

**意味。** `gstack-autoplan next` がレビューするのは、計画の `## Implementation plan` セクションのみで、`## Review record` は非公開のまま保たれます。そのため計画には、コードフェンスの外にある、空でない Implementation plan セクションがちょうど1つと、その後に続く Review record セクションが1つ必要です。両方の見出しがない計画は自動的にラップされます。見出しが1つだけの場合、見出しが重複または逆順の場合、セクションが空の場合は、何も書き込まれずに拒否されます。エラーには問題点が示されます。

**対処。** 不足している見出しを追加するか、最初の `next` を `--scaffold` 付きで再実行してください。そうすると、不足している見出しを追加した `<out>/plan-source.md` が書き出され、そのコピーをレビューして `SCAFFOLDED:` を表示します。計画ファイル自体は編集されません。セクションの重複、逆順、空の場合は意味があいまいなため、手作業で修正する必要があります。

<a id="plan-amend-pending"></a>
### `PLAN_AMEND_PENDING`

**意味。** オーナーがゲートで少なくとも1つの計画変更を承認しています(それぞれ `APPLY:` 行として表示されます)が、実行中の計画にはその変更がまだ反映されていません。このまま再実行すると古い計画がレビューされてしまいます。承認された変更がすべて反映されるか取り下げられるまで、`next` は実行を拒否します。`complete` の実行に保留中の変更がある場合、`export` も拒否します。

**対処。** 計画を編集してから、`gstack-autoplan revise --out <dir> --plan <file> --incorporates <decision id,...>` を実行してください。`revise` は指定された各 id を、変更前と変更後の Implementation plan のハッシュに紐付け、Implementation plan が変わっていない場合は拒否します。指定しなかった id は保留のままになります。パッケージングや順序の変更(その `APPLY:` 行が `no plan edit needed: revise --settle <id>` で終わるもの)は、`gstack-autoplan revise --out <dir> --settle <id>` で処理でき、何も再オープンされません。承認された変更を取り下げたい場合は、`gstack-autoplan revise --out <dir> --withdraw <decision id>` を実行すると、取り下げが journal に記録されます。

<a id="amendment-unknown"></a>
### `AMENDMENT_UNKNOWN`

**意味。** `gstack-autoplan revise --incorporates` または `--withdraw` に、保留中の変更ではない decision id が指定されました。オーナーがゲートでその変更を計画変更として承認していない(たとえば gstack が変更を記録する前にゲートに回答された場合)か、すでに反映済みまたは取り下げ済みです。何も変更されません。

**対処。** `pending:` の後に拒否メッセージが列挙する id のみを指定してください。保留中のものがない場合は、`--incorporates` を付けずに revise してください。
`gstack-autoplan revise --out <dir> --plan <file>`

<a id="amendment-not-settleable"></a>
### `AMENDMENT_NOT_SETTLEABLE`

**意味。** `gstack-autoplan revise --settle <id>` は、計画の編集なしに承認済みの変更を処理するものです。これが正しいのは、パッケージングまたは順序の変更(ゲート項目の `changes` が `packaging` または `ordering`)で、かつ実行がすでにレビューしている計画に対してのみです。レビュー対象は、オーナーがその変更を承認した計画、または後の `revise` で記録された計画です。指定された変更が範囲、コスト、方向性に影響する場合、`changes` の値が指定されていない場合、計画ファイルに `revise` で記録されていない編集がある場合、あるいは `--settle` に Implementation plan を変更しつつ何も反映しない `--plan` が付いている場合は、この拒否になります。何も変更されません。

**対処。** 計画を編集したうえで、
`gstack-autoplan revise --out <dir> --plan <file> --incorporates <decision id>`
を実行してください。パッケージングや順序の変更を同時に処理する場合は `--settle <id>` を加えるか、revise の後に処理してください。各変更の `APPLY:` 行はどの経路をたどるかを示し、`NEXT:` には settle の手順が最初に挙げられます。

<a id="gate-rec-stale"></a>
### `GATE_REC_STALE`

**意味。** ゲートが描画された後に `gstack-autoplan recommend` が推奨内容を変更したため、オーナーが以前の描画に対して返した `rec`(または `all`)の回答は、オーナーが見ていない推奨を採用してしまうことになります。描画のたびに `rec_hash=<h>` が表示され、`recommend` が一度実行されると、`rec` の回答にはオーナーが回答した描画のハッシュを指定する必要があります。`rec` が存在する前に書かれたゲート(`rec_rev` がない `gate.json`、バージョン 1.91.101.0 以前)に対する `rec`/`all` の回答も同様に拒否されます。その描画は、`all` が `b` と推奨された項目を保留のままにすると説明していましたが、`all` では今やそれらも採用されてしまうためです。

**対処。** 再描画し(`gstack-gate render <dir>/gate.json --all`)、オーナーに伝えてから、その描画の `--rec-hash <h>` を指定して回答してください。明示的な `<id><option>` トークンは拒否されません。

<a id="checkpoint-invalid"></a>
### `CHECKPOINT_INVALID`

**意味。** `gstack-autoplan resume --out <dir> --from <checkpoint>` が、復元可能な世代を見つけられませんでした。原因は、`checkpoint.json` が読めない、または schema_version 1 のチェックポイントではない、リストされたファイルが存在しない、通常ファイルではない、世代の外へ出ている(`..` のパスや、シンボリックリンクされたディレクトリ)、あるいは記録された sha256 と一致しない、のいずれかです。または、ステージングされた実行が `gstack-artifact validate` を通らないことも原因になります。`--from` に実行のコレクションを指定した場合は、検証に通る最新の世代を復元し、壊れた新しい世代は読み飛ばします。ルートに複数の実行がある場合は、どれか1つを指定する必要があります。`--out` には何も書き込まれません。

**対処。** `gstack-autoplan checkpoints --from <dir>` を実行すると、すべての世代が `hash=ok` または `hash=bad (<reason>)` 付きで表示されます。問題のない世代を、そのディレクトリを指定して復元してください。`GSTACK_AUTOPLAN_CHECKPOINT_DIR` が設定されていると、実行が静止状態で残るすべてのコマンドは新しい世代を発行し、前の世代を保持します。

<a id="checkpoint-overlap"></a>
### `CHECKPOINT_OVERLAP`

**意味。** この実行のチェックポイントディレクトリと、実行ディレクトリが同じディレクトリであるか、片方がもう片方を含んでいます(シンボリックリンクを解決した後で判定)。復元時には、チェックポイントと `--out` またはそのステージングディレクトリが該当します。一方をもう一方にコピーすると、稼働中の実行が置き換えられるか削除されてしまうため、何も触られていません。コマンドがコミットされた後のチェックポイントの拒否は、stderr に `CHECKPOINT: failed …` を表示しますが、そのコマンドの終了コードはそのままです。

**対処。** `GSTACK_AUTOPLAN_CHECKPOINT_DIR`(または `--from` / `--out`)を、実行の外側のディレクトリに向けてください。たとえば、プロジェクトユーザーの非公開の Drive フォルダなどです。

<a id="checkpoint-target-exists"></a>
### `CHECKPOINT_TARGET_EXISTS`

**意味。** `resume --from` は、存在しないか空の `--out` ディレクトリにのみ復元します。今回指定された `--out` にはすでにファイルがあります。

**対処。** 新しい `--out` ディレクトリを指定するか、`--from` を付けずに `gstack-autoplan resume --out <dir>` を実行して、そこにすでにある実行を再開してください。

<a id="owner-reply-required"></a>
### `OWNER_REPLY_REQUIRED`

**意味。** エージェントが、オーナーの実際の発言を記録せずにゲートに回答しました(`--by agent:<id>`)。何も適用されていません。

**対処。** オーナーの言葉をそのまま渡してください。`--owner-reply "<text>"`、標準入力から読む場合は `--owner-reply -`、またはファイルから読む場合は `--owner-reply-file <path>` を使います。これらはすべての決定の行に保存されます。ゲートの文法で解析できる場合は、`--reply` と同じ選択に解決される必要があります。

<a id="gate-owner-reply-mismatch"></a>
### `GATE_OWNER_REPLY_MISMATCH`

**意味。** オーナーの発言そのものがゲートへの回答(たとえば `rec`)になっていて、エージェントが伝えたトークンとは異なる選択に解決されます。何も適用されていません。

**対処。** オーナーが選んだ内容をそのまま伝えてください。オーナーの言葉を `--reply` として渡せば、常に整合します。オーナーの言葉とトークンが食い違う場合は、オーナーに確認してください。

<a id="gstack-version-changed"></a>
### `GSTACK_VERSION_CHANGED`

**意味。** `run.json.gstack_version` が、現在実行中の gstack とは別のバージョンを指しています。古い実行(またはこのフィールドが存在する前に書かれた実行)の場合は通知にとどまり、コマンドは `gstack_version_changed` を journal に記録して、前方への移行(たとえば 1.91.95 より前に発行された decision id の書き換え)を実行してから続行します。新しい gstack が書いた実行の場合は、古いランナーは新しい状態を理解できないため、コマンドは拒否されます。

**対処。** 通知の場合は何もする必要はありません。拒否された場合は、このマシンで gstack をアップグレード(`bin/gstack-upgrade`)してから、コマンドを再実行してください。

<a id="artifact-gate-unsettled"></a>
### `ARTIFACT_GATE_UNSETTLED`

**意味。** `gstack-artifact validate` が、ステータスが `complete` であるにもかかわらず、最後のゲート改訂の承認項目が保留のままになっている実行、または承認された計画変更(`run.json.amendments`)が保留のままになっている実行を見つけました。ランナーがこのような状態を書き込むことはありません。手作業による編集か、古いランナーが原因です。

**対処。** 承認が保留のものがなくなるまで `gstack-autoplan answer` でゲートに回答し、保留中の変更それぞれについて `revise --incorporates` または `--withdraw` を実行してください。

<a id="ios-launch-env-invalid"></a>
### `ios-qa launch: GSTACK_IOS_LAUNCH_ENV ... so the app was not launched (<detail>); fix: ... (IOS_LAUNCH_ENV_INVALID)`

**意味。** `gstack-ios-qa-daemon` は、テスト対象のアプリを起動するたびに、`GSTACK_IOS_LAUNCH_ENV` を `xcrun devicectl device process launch --environment-variables` に渡します。その値は、キーが環境変数名、値が文字列である JSON オブジェクトでなければならず、`GSTACK_` の変数を設定してはいけません(その名前空間はデバッグブリッジのものです)。それ以外(不正な JSON、配列、数値の値、`GSTACK_` のキー)は起動が拒否されます。環境変数なしでアプリを起動すると、環境変数でゲートされたデバッグブリッジが動かないまま正常に動いているように見えてしまうためです。詳細にはキーと型が示されますが、値は示されません。v1.91.101.0 の次のリリースで追加されました。

**対処。** デーモンを起動するシェル(デバイスを接続した Mac 上の macOS ターミナルまたは Claude Code)で次を実行します。

```bash
export GSTACK_IOS_LAUNCH_ENV='{"DEBUG_BRIDGE":"1"}'
```

または `unset GSTACK_IOS_LAUNCH_ENV` を実行してから、`gstack-ios-qa-daemon` を再起動してください。

<a id="outside-voice-unavailable"></a>
### `Outside voice unavailable: <cause>. Fix: <fix>. Continuing to ... (OUTSIDE_VOICE_UNAVAILABLE)`

**意味。** `/plan-ceo-review`、`/plan-eng-review`、または `/plan-devex-review` が、セカンドオピニオンなしで実行されました。外部のプロバイダー(Codex、または Codex ホストの下の Claude Code)が実行されなかったか失敗し、ネイティブのフォールバックも有効なレビューを提供できませんでした。このフォールバックは、組み込みの Plan サブエージェントをバックグラウンドで起動し、同時に5分のバックグラウンドタイマーを動かして、どちらか先に終わらなかった方を停止させます。原因の行には、どの部分が不足していたかが示されます。`Plan agent type not offered`、`TaskStop not offered`、`background tasks unavailable`、`no complete report within five minutes`、または失敗ステータスのいずれかです。レビューログの行には、同じ原因が `unavailable_reason` として記録されます。Claude Code 2.1.277 でフォールバックが以前使っていた TaskOutput ツールが削除されたため、古い gstack では、最新の Claude Code でのネイティブフォールバックがすべてここで終わっていました。

**保持される内容。** ネイティブの計画レビュー自体は完了しています。この行は `status: unavailable` として記録され、正常なレビューとしては記録されません。遅れて届いた、または部分的なレビュアーの結果は数えられません。

**対処。** 行に示されたプロバイダーを修復してください。インストールするか、`codex login` を実行します(ターミナルまたは Git Bash で)。ネイティブフォールバックの場合は、Claude Code 2.1.277 以降を、バックグラウンドタスクを有効にして実行してください(`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS` が未設定で、bare モードではないこと)。その後、レビューを再実行してください。

**期待される結果。** プロバイダーが実行された場合は `OUTSIDE VOICE (...)` のレポート、または `CODEX SAYS (plan review — outside voice)` が表示されます。

<a id="artifact-machine-path"></a>
### `ARTIFACT_MACHINE_PATH`

**意味。** autoplan 実行の公開コピーに、その実行がこのマシン上で記録したパスがまだ含まれています。具体的には、実行ディレクトリ、ホームディレクトリ、計画のディレクトリ、チェックポイントディレクトリ、またはワークツリーのルートです。`gstack-artifact validate --public <dir> --private <run>/run.json` は、各ヒットを file:line 付きで報告します。`gstack-autoplan export --public` は、ステージングコピーに対してこのチェックを実行し、失敗した場合は何も書き出しません。

**対処。** `gstack-autoplan export --out <run> --public <dir>` でエクスポートしてください。これは記録されたルートをリポジトリ相対パス、または `<local notes (not committed)>` に書き換えます。エクスポートは plan.md のインラインコードやフェンスされたブロックを書き換えないため、そこでヒットした場合は計画の編集が必要です。パスを変更し、`revise` してから、再度エクスポートしてください。記録されたルートではない一般的なホームディレクトリのパスは、エラーではなく WARN 行になります。

<a id="artifact-public-target-exists"></a>
### `ARTIFACT_PUBLIC_TARGET_EXISTS`

**意味。** `gstack-autoplan export --public <dir>` は、`<dir>` の中に、同じ実行の以前の公開コピーではないファイルを見つけたため、上書きを拒否しました。

**対処。** 空の新しいディレクトリを指定するか、この実行の公開コピーがすでにあるディレクトリを指定してください(そのディレクトリは丸ごと置き換えられます)。

<a id="prereg-diagnostic-untested"></a>
### `PREREG_DIAGNOSTIC_UNTESTED`

**意味。** `gstack-eval-plan prereg --check <file> --allow-repo-commands` が、事前登録の宣言されたサマライザー(`## Diagnostics` の `summarizer:`、`fixture:`、および診断ごとの `| diagnostic | expected |` の行)を合成フィクスチャに対して実行しました。その結果が事前登録の定義と一致しませんでした。カウントが異なる(`mismatch`)、宣言された診断が存在しない(`missing`)、事前に登録されていない診断が報告された(`undeclared`)、またはサマライザーが失敗、タイムアウト、あるいは stdout を1つの JSON オブジェクトのカウントで終えなかった、のいずれかです。各 `PREREG_DIAGNOSTIC:` 行は1つの診断を示します。これは gbrain-evals #162(D7)のパターンで、2つの診断カウントが有料実行後の修正を必要としたケースです。

**対処。** すべての行が `ok` になるまで、サマライザーを修正するか、定義(期待されるカウントまたはフィクスチャ)を修正してください。その後、凍結をコミットします。`PREREG_DIAGNOSTICS:` 行の `sha256` は、テストしたフィクスチャに紐付いています。`--allow-repo-commands` がない場合、コマンドはサマライザー(`PREREG_COMMAND:`)を一覧表示して終了コード 3(`REPO_COMMANDS_NOT_ALLOWED`)で終わります。サマライザーはリポジトリのコマンドだからです。

<a id="eval-models-invalid"></a>
### `EVAL_MODELS_INVALID`

**意味。** `.gstack/eval-models.json` を読み込めなかったか、検証に失敗しました。原因には、JSON エラー、`schema_version` が 1 以外、`allow` が欠けているか空、未知のキーやスコープ、`families` 内のグロブ、2つのファミリーに同じ id がある、あるいは古い id の後に gstack の現在のカタログのモデルを列挙したファミリーがある、といったものが含まれます。また、作業ツリーのコピーが存在するのに `origin/<base>` を解決できない場合も発火します。ルールが無効な間は、どのアームも合格しません。

**対処。** 行が示すとおり(`docs/eval-models.md`)にファイルを修正し、レビュー済みの PR で反映するか、ベースブランチを取得してください。マージされていない編集をテストするには、`--models-from head` を使います。

<a id="eval-model-denied"></a>
### `EVAL_MODEL_DENIED`

**意味。** アームのモデルが `deny` または、そのスコープの `deny` に一致したか、どの `allow` のエントリにも一致しなかった(未知の id はフェイルクローズされます)、あるいはそのスコープの `allow` リストのどのエントリにも一致しませんでした。`EVAL_MODEL:` 行がルールを示します。

**対処。** そのスコープでルールが許可しているモデルを選んでください。スモーク実行の場合は、`--scope smoke` を渡します(`price-gate` は各呼び出し行のスコープを使います)。ルールを変更するには、レビュー済みの PR で `.gstack/eval-models.json` を編集してください。

<a id="eval-model-old-generation"></a>
### `EVAL_MODEL_OLD_GENERATION`

**意味。** ルールで `families`(新しい順)が宣言されていて、アームが、そのファミリーの先頭ではない id を使っています。

**対処。** ファミリーの最新の id を使ってください。`EVAL_MODEL:` 行が名前を示します。順序が間違っている場合は、レビュー済みの PR で `families` を修正してください。

<a id="eval-model-generation-unresolved"></a>
### `EVAL_MODEL_GENERATION_UNRESOLVED`

**意味。** ルールで `families` が宣言されているため、すべてのアームはそのファミリーの最新世代でなければなりません。このアームのモデルはどのファミリーにも含まれていないため、世代を確認できず、確認されないまま合格するのではなく失敗します。

**対処。** レビュー済みの PR で `.gstack/eval-models.json` のファミリー(新しい順)にそのモデルを追加するか、ファミリーに含まれているモデルを使ってください。

<a id="wtree-unavailable"></a>
### `gstack-pregate: cannot fingerprint the working tree: bin/gstack-wtree could not start (on Windows, no Git Bash was found) or it ran and failed (<detail>); fix: <fix> (WTREE_UNAVAILABLE)`

**意味。** `gstack-pregate` は、どのチェックを実行する前にも `bin/gstack-wtree` で作業ツリーのフィンガープリントを取ります。これができない場合は終了コード 3 で拒否されます。原因は2つあり、行にどちらかが示されます。

- **起動できなかった。** Windows では、スクリプトを実行するための Git Bash が見つかりませんでした。詳細には、試したすべての候補と、それが拒否された理由(`GSTACK_GIT_BASH (unset): not set; git --exec-path …; install path …; PATH bash: …` など)が、[`BASH_UNAVAILABLE`](#bash-unavailable) に記載された順序で列挙されます。macOS や Linux では、`bin/gstack-wtree` が存在しないことを意味します。
- **実行したが失敗した。** 詳細はスクリプト自身のメッセージで、修正方法は表示された修復手順です(例: `set TMPDIR to a writable directory`)。

これ以前は、どちらの場合も `policy source unavailable: origin/<base> is not a resolvable commit` と報告され、修正として `git fetch` が示されていました。それでは何も変わりませんでした。

**対処。** 行に表示された修正を実行してください。Windows の場合は、gstack が Git Bash の `bash.exe` を使うように指定してから、`gstack-pregate` を再実行してください。

- Git Bash(このシェルのみ): `export GSTACK_GIT_BASH='C:/Program Files/Git/bin/bash.exe'`
- Windows PowerShell 5.1 または PowerShell 7(このシェルのみ):
  `$env:GSTACK_GIT_BASH = 'C:\Program Files\Git\bin\bash.exe'`

恒久的に設定するには(Claude Code は次回の起動時にこれを読み込みます)、[`BASH_UNAVAILABLE`](#bash-unavailable) の手順に従うか、Git for Windows をインストールしてください(PowerShell で `winget install --id Git.Git -e`)。

**`--json` を付けた場合。** チェックが実行される前の拒否(この場合、ベースが利用できない場合、不正なピンファイルの場合)はすべて、stdout に1つの JSON オブジェクトとして出力されます。`{"ok":false,"status":"refused","code":"WTREE_UNAVAILABLE","detail":"…","fix":"…","docs":"…#wtree-unavailable"}` の形式で、終了コードは 3 です。実行の結果のオブジェクトも同じ `ok` と `status` を持ちます(`complete` または `incomplete`)ので、`status` で拒否と実行を区別できます。`--json` 指定時、`GSTACK_RESULT:` 行は stderr に出力されます。

<a id="claude-md-skill-list"></a>
### `warn CLAUDE.md the gstack section in <file> lists <n> skills; Claude Code lists installed skills itself, and a pasted list goes stale with each release`

**意味。** `gstack-doctor` が、`~/.claude/CLAUDE.md` またはこのプロジェクトの `CLAUDE.md` にある gstack セクションで、スキルを列挙しているのを検出しました。具体的には、`Available
skills:` の行があるか、8 個以上の `/skill` 名が並んでいる状態です。古いインストールプロンプトは、この一覧を書くよう求めていました(#3169)。Claude Code は、インストール済みのすべてのスキルを説明付きで自動的に一覧表示します。貼り付けられた一覧はリリースのたびに古くなるため、エージェントが一部だけの一覧を完全な一覧だと誤解することがあります。

**対処。** そのセクションを、doctor が出力する短いブロックに置き換えてください(スキル一覧は含みません。自分で書いた gstack に関するほかのルールは残してください)。

```
## gstack
Use /browse from gstack for all web browsing. Never use mcp__claude-in-chrome__* tools.
```

**期待される結果。** 次回の `gstack-doctor` 実行で、`ok CLAUDE.md no gstack section lists skills (...)` と表示されます。
<a id="policy-gstack-too-old"></a>
### `POLICY_GSTACK_TOO_OLD`

**意味。** ベースブランチ上の `.gstack/ship-policy.json` で、`min_gstack_version` が、それを読み込む gstack のバージョンより高く設定されています。このポリシーは、この gstack が違う意味で解釈するか、まったく解釈できないキーを使っているため、ship-policy の読み取り元(`gstack-restamp`、`gstack-tree-receipt`、`gstack-ship-queue`、`gstack-ship-policy`)はすべて、推測で処理せず拒否します。`min_gstack_version` より古い gstack は、そのキーを未知のものとして扱い、キー名を示す `POLICY_INVALID` で失敗します。

**対処。** メッセージで示されたバージョンまで gstack をアップグレードしてから(`bin/gstack-upgrade` を使うか、セッションのインストールを再実行します)、再実行してください。クルーのリードが `min_gstack_version` を上げると、同時にクルー全体のインストール下限も上がります。`gstack-ship-policy validate` は、その場合にだけ `MIN_READER:` を表示します。

<a id="queue-not-ready"></a>
### `QUEUE_NOT_READY`

**意味。** `gstack-ship-queue ready` は、コーディネーターが誤読するおそれのある READY ブロックを出力しません。次のいずれかに当てはまる場合です。作業ツリーに未コミットの追跡対象の変更がある、HEAD が(`gh pr view` で読み取った) PR の push 済みヘッドと一致しない、その正確なヘッドでの CI が成功していない(失敗、保留中、または読み取り不能)、あるいは pregate の結果がない、失敗している、別のツリーに対して記録されている(`PREGATE_STALE`)。

**対処。** コミットして push し、そのヘッドでの CI の完了を待ってください。ツリーが変わっていた場合は `gstack-pregate run --allow-repo-commands` を再実行し、その後 `gstack-ship-queue ready --pr <n>` を再実行します。拒否される前に表示されるブロックに、まだ満たされていない行が示されます。

<a id="queue-proof-missing"></a>
### `QUEUE_PROOF_MISSING`

**意味。** キューのステップが、自分の主張を証明するために必要な入力を欠いているか、入力が一致しません。具体的には、ゲートされたヘッドがここではコミットではない、HEAD がスタンプを除いてゲートされたヘッドと異なる(ゲートがこのツリーをまったくカバーしていない)、他の入力を持つ前のスタンプが未完了である、スタンプジャーナルのヘッドが移動している、あるいは gate-ahead マージを `git merge-tree` で再計算できない、といった場合です。`QUEUE_STAMP_REFUSED:` 行に `committed=yes` と書かれていない限り、何も書き込まれていません。

**対処。** 指定された入力を用意するか(ゲートされたヘッドを fetch する、現在のベースの sha を渡す)、スタンプしたいツリーをゲートし直してください。未完了のスタンプの場合は、同じコマンドを再実行して再開するか、そのファイルを元に戻して `.gstack/tmp/ship-queue/stamp-<pr>.json` を削除してください。

<a id="queue-stamp-not-stamp-only"></a>
### `QUEUE_STAMP_NOT_STAMP_ONLY`

**意味。** `gstack-ship-queue stamp` はスタンプをコミットしました。しかし、ゲートされたヘッドとスタンプされたヘッドの間のツリーレシートで、スタンプのルールの外にある差分が見つかりました(残りのパスは表示されます)。ゲートの結果はそのヘッドをカバーしません。拒否行には `committed=yes <sha>` と表示されます。

**対処。** 残っているパスを確認してください。余計な編集であれば取り除いてから再度スタンプするか、スタンプされたヘッドに対してゲートを実行してください。

<a id="queue-verify-mismatch"></a>
### `QUEUE_VERIFY_MISMATCH`

**意味。** コーディネーターの `gstack-ship-queue verify` が、PR の push 済みコミットからレーンの主張を再現できませんでした。ヘッドが移動した、ヘッドがスタンプを除いてゲートされたツリーと異なる、レシートのダイジェストが `QUEUE_STAMP` のものと異なる、あるいは gate-ahead の記録の場合に、`git merge-tree --write-tree` が別のマージツリーを返す、記録されたスタンプパッチが記録されたゲート済みツリーを再現しない、またはスタンプ以外のものを変更している、もしくはゲート後に先行 PR が移動した、といった場合です。

**対処。** マージしないでください。レーンに、現在のキューに対して `gstack-ship-queue stamp`(または `gate-ahead`)を再実行し、改めて報告するよう依頼してください。

<a id="queue-gate-missing"></a>
### `QUEUE_GATE_MISSING`

**意味。** ship ポリシーで `full_e2e: true` が設定されていますが、スタンプまたは検証しようとしているツリーに結び付いた、合格したフルゲートの結果がありません。該当するゲート済みヘッドに対する gate-ahead の記録がない、そのヘッドでの実行による `--gate-exit 0 --gate-log <file>` がない、または記録された実行が非ゼロで終了している、のいずれかです。

**対処。** gate-ahead ワークツリーで、ポリシーの `gate_command` に指定されたゲートを実行し、`gstack-ship-queue gate-ahead --record` で結び付けてください。あるいは、ゲート済みヘッドでの合格した実行の終了コードとログを `stamp` に渡してください。

<a id="gate-ahead-attempt-invalid"></a>
### `GATE_AHEAD_ATTEMPT_INVALID`

**意味。** `gstack-ship-queue gate-ahead --record` が、ゲートの結果を結び付けられませんでした。試行 ID がその PR に対して不明である、その試行にはすでに別の結果が入っている、ログファイルが存在しない、あるいは試行のワークツリーがもはやゲート済みのコミットを保持していない(HEAD が移動したか、追跡対象のファイルが変更された)ため、結果がゲート済みのツリーを表さなくなる、といった場合です。

**対処。** `gstack-ship-queue gate-ahead --list --pr <n>` で、すべての試行と現在の試行を確認できます。現在有効な試行を記録するか、`gate-ahead --after <pr>` で新しい試行を準備し、追跡対象のファイルを編集せずにそこでゲートを実行してください。

<a id="queue-train-off"></a>
### `QUEUE_TRAIN_OFF`

**意味。** マージトレインのコマンド(`train …` または `verify --train`)が、`.gstack/ship-policy.json` に `train` ブロックが宣言されていないベースリビジョンに対して実行されました。そのため、トレインの機能は無効で、PR ごとのキューが適用されます。何も書き込まれていません。

**対処。** PR ごとのキュー(`ready --pr <n>`、`stamp`、`verify`)を使うか、先にベースブランチへ `min_gstack_version` 付きの `train` ブロックを入れてください([マージトレインを実行する](ship-policy.md#run-a-merge-train))。

<a id="queue-train-untrusted"></a>
### `QUEUE_TRAIN_UNTRUSTED`

**意味。** ピン留めされた PR のヘッドリポジトリが、ベースリポジトリではありません。トレインのブランチとそのディスパッチはリポジトリのシークレットを使って実行されるため、フォークからの作業がトレインに乗ることはありません。

**対処。** 表示された `train build --prs <list without it>` を実行してください。フォークの PR は信頼済みブランチの経路にとどまります。

<a id="queue-train-moved"></a>
### `QUEUE_TRAIN_MOVED`

**意味。** PR のヘッドが、トレインがピン留めした SHA ではなくなりました(ビルド時、または検証時にスタンプを超えてピン留めを過ぎた場合)。そのため、トレインはマージされるものをテストしないことになります。先行するスロットがマージされた後の検証では、キューは `QUEUE_TRAIN_FROZEN` によって凍結されます。

**対処。** レーンに、新しいヘッドに対する新しい READY を依頼し、その後新しいピンでトレインをビルドしてください(`train build --prs <n>@<new sha>,…`)。

<a id="queue-train-conflict"></a>
### `QUEUE_TRAIN_CONFLICT`

**意味。** ある PR を、その前にあるプレフィックスに対してマージすると、バージョンファイルと CHANGELOG 以外でコンフリクトします。`QUEUE_TRAIN_CONFLICT:` 行に、その PR、コンフリクトしたファイル、そしてその前にマージされた PR が示されます。何もディスパッチされず、ブランチも push されていません。

**対処。** 表示された `train build --prs <list without that PR>` を実行してください。その PR のレーンは main をマージし(先行 PR が取り込まれた後は、それらも含めて)、再度 READY を報告します。

<a id="queue-train-free-red"></a>
### `QUEUE_TRAIN_FREE_RED`

**意味。** `train/<nonce>` にディスパッチされた無料テストが、失敗、キャンセル、欠落している(`--free-timeout` までに `workflow_dispatch` の実行が現れなかった)、あるいは別の SHA で実行された、のいずれかです。そのため、有料ゲートはディスパッチされていません。

**対処。** 無料テストの実行結果を確認してください。PR が原因の失敗であれば、その PR を外してください(`train build --prs <list without it>`)。不安定なテストであれば、次のビルドの前に、そのテストの担当者に渡してください。

<a id="queue-train-dispatch-unknown"></a>
### `QUEUE_TRAIN_DISPATCH_UNKNOWN`

**意味。** トレインのディスパッチが試行されましたが、そのナンスを持つ実行が現れませんでした。そのため、開始したかどうかはわかりません(GitHub がディスパッチを受け付けた後で `gh workflow run` が失敗することがあります)。盲目的に再ディスパッチされることはありません。

**対処。** `gstack-ship-queue train status --train <nonce>` を実行してください。ナンスを持つ実行を採用するか、ディスパッチが存在しないとマークします。そのあとでのみ、`train build --train <nonce>` で同じナンスを使って再ディスパッチできます。

<a id="queue-train-waiting"></a>
### `QUEUE_TRAIN_WAITING`

**意味。** トレインの PR 数が `train.max_size` より少なく、最も古い READY の PR が `train.fill_hours` より短い時間しか待っていません。そのため、まだディスパッチされません。メッセージには、いつディスパッチされるかが表示されます。

**対処。** READY の PR を追加するか、表示された時刻の後で再実行してください。あるいは、1 PR のトレインにする場合は `--urgent` を指定してください。

<a id="queue-train-pending"></a>
### `QUEUE_TRAIN_PENDING`

**意味。** トレインの実行(無料テスト、フルゲート、またはバイセクト)がまだ終わっていないため、判定はまだ出ていません。

**対処。** 表示された `NEXT:` コマンドを後で再実行してください。実行が保留中のあいだは、何も再ディスパッチされません。

<a id="queue-train-incomplete"></a>
### `QUEUE_TRAIN_INCOMPLETE`

**意味。** トレインのゲートが、その集計を完了しませんでした。INFRA または INCOMPLETE のパネル、どのジョブにも結び付いていない/一部だけ/キャンセルされたシャード、アップロード前に停止されたスライス、別のナンス・ヘッド・ツリーに結び付いたレコード、あるいは公開されたレコードがない、といった場合です。不完全なゲートは、決して成功とはみなされません。

**対処。** すべての欠落が機械的に INFRA または INCOMPLETE と分類されている場合は、EVAL_POLICY.infraRedispatch が許可する 1 回の再ディスパッチ(`train rebuild --train <nonce> --infra`)を実行し、両方の実行を報告してください。それ以外の場合は、その実行を診断してください。

<a id="queue-train-red"></a>
### `QUEUE_TRAIN_RED`

**意味。** トレインのツリー上で、トレインのフルゲートが失敗しています。メッセージには失敗したケースが示されます。その PR はマージされず、判定を変えるための再試行もされません。

**対処。** 失敗したケースをバイセクトしてください(`train bisect --train <nonce> --spend-cap <usd>`)。再ビルドの 2 回目も失敗した後は、そのケースを修正用のレーンに回してください。

<a id="queue-train-red-on-main"></a>
### `QUEUE_TRAIN_RED_ON_MAIN`

**意味。** バイセクトの結果、失敗したケースは、main(T0 を含む)を含むすべてのプレフィックスで失敗していました。つまり、トレインの PR ではなく、main が壊れています。

**対処。** まず main を前進させる形で修正してください(1 PR のトレインとして)。その後、このトレインを変更せずに再ビルドします。

<a id="queue-train-unattributed"></a>
### `QUEUE_TRAIN_UNATTRIBUTED`

**意味。** バイセクトのパターンが、どの PR も main も原因とみなせません。すべて成功しているか、単調ではないかのどちらかです。プレフィックスごとに 1 回の試行では、不安定さと破損を区別できません。

**対処。** すべて成功している場合は、事前に登録された再ビルド(`train rebuild --train <nonce>`)を 1 回実行し、両方の実行を報告してください。それ以外のパターンの場合は、修正用のレーンを用意し、修正がマージされた後に変更されたトレインを作成してください。

<a id="queue-train-bisect-capped"></a>
### `QUEUE_TRAIN_BISECT_CAPPED`

**意味。** バイセクトの予約コスト(すべてのケース×プレフィックスの試行。コストデータがない試行は `train.trial_reservation_usd` で見積もられます)が `--spend-cap` を超えています。収まったプレフィックスは起動され、完了したプレフィックスの結果は保持されます。ただし結果は原因不明のままであり、決して成功にはなりません。

**対処。** より高い上限を指定して再開してください(`train bisect --train <nonce> --spend-cap <usd>`)。結果のないプレフィックスだけが実行されます。

<a id="queue-train-prefix-invalid"></a>
### `QUEUE_TRAIN_PREFIX_INVALID`

**意味。** バイセクトのプレフィックスが、`train/<nonce>` 上のトレインのヘッドの祖先ではありません(ブランチが移動した)。あるいは、失敗したケースがゲートの計画に含まれていません。そのため、バイセクトの入力はディスパッチ前に拒否されます。

**対処。** `train/<nonce>` がまだ記録されたヘッドを指しているか確認してください(`train status`)。ブランチが移動した場合は、新しいトレインが必要です。

<a id="queue-train-rebuild-refused"></a>
### `QUEUE_TRAIN_REBUILD_REFUSED`

**意味。** `train rebuild` は許可されていません。バイセクトの記録がない(`--infra` を指定した場合は、INFRA/INCOMPLETE のみの集計がない)、バイセクトがすべて成功していない、あるいはトレインがすでに一度再ビルドまたは再ディスパッチされている、のいずれかです。

**対処。** 失敗したケースを修正用のレーンに回してください。トレインは、修正がマージされた後にのみ再ビルドできます(変更されたトレインとして)。

<a id="queue-train-tree-mismatch"></a>
### `QUEUE_TRAIN_TREE_MISMATCH`

**意味。** main のツリーが、この PR の前のトレインのプレフィックスとも、後のプレフィックスとも一致しません(スタンプを除く)。そのため、マージするとゲートがテストしたものが公開されなくなります。

**対処。** マージを停止してください。そのトレインの先行 PR がすでにマージされていた場合、キューは `QUEUE_TRAIN_FROZEN` により凍結されています。そうでなければ、現在の main に対して新しいトレインを作成してください。

<a id="queue-train-frozen"></a>
### `QUEUE_TRAIN_FROZEN`

**意味。** トレインが公開の途中で停止し、main には、どのゲートも単独ではカバーしていないプレフィックスが入った状態になっています。`QUEUE_TRAIN_FROZEN:` 行には、マージされた PR、main のツリー、そして main の SHA でディスパッチされたバックストップの実行が示されます。凍結の情報はローカルの状態と `refs/notes/gstack-trains` に保存されています。修復が入るまで、通常のトレインや他のトレインのマージは拒否されます。

**対処。** 修復用の PR を、その正確なヘッドで 1 つ受け入れてください(`train build --repair --prs <n>@<sha>`)。その修復のマージ後の main のツリーが、成功の記録とともに検証されると、凍結は解除されます。その後、`NEXT:` が、まだマージされていない PR のトレインを構築します。

<a id="ready-screen-choice-required"></a>
### `READY_SCREEN_CHOICE_REQUIRED`

**意味。** ベースのポリシーでトレインが有効になっているため、READY では明示的な画面の選択が必要です。`--screen`(今、PR のマージ SHA に対する画面に料金を払う)か、`--no-screen` のいずれかを指定してください。`SCREEN:` 行に、選択内容と推奨が示されます。

**対処。** 表示された推奨に従って `gstack-ship-queue ready` を再実行してください。ローカルで集中的なケースをすでに実行したレーンは、その旨を READY ブロックに記載し、`--no-screen` を指定してもかまいません。

<a id="pregate-timing-assertion"></a>
### `PREGATE_TIMING_ASSERTION`

**意味。** ブランチが追加または変更したテスト行が、経過した実時間または CPU 時間を上限と比較しているか、固定時間だけスリープしてからアサートしています。マシンの負荷がかかると、このようなテストはコードを変更していなくても失敗します。`timing` チェックは警告を出しますが、ブロックはしません(計測の詳細は [docs/pregate.md#timing](pregate.md#timing) にあります)。

**対処。** 代わりに結果をアサートしてください。注入されたクロック、強制された期限、イベント、あるいは期限付きのポーリングなどです。上限そのものが契約である場合は、その行、またはその上の行のコメントに `gstack-timing-ok: <reason>` を追加してください。不安定なテストを通すために上限を引き上げることは、決してしないでください。原因の診断については /investigate の flake playbook を参照してください。

<a id="approval-classes-invalid"></a>
### `APPROVAL_CLASSES_INVALID`

**意味。** ベースブランチにコミットされた `.gstack/approval-classes.json`(または `gstack-approval-classes validate` の場合は作業ツリー上のコピー)が、有効な JSON ではない、未知のキーがある、名前や照合対象のない class がある、あるいはリポジトリの外に出る glob がある、のいずれかです。`gstack-ship-receipt write` は、class が未検査のままで出荷されることを避けるため、拒否します。

**対処。** `gstack-approval-classes validate` を実行し、ファイルを修正してマージしてください。[承認クラス](ship-policy.md#approval-classes) を参照してください。

<a id="approval-class-found"></a>
### `APPROVAL_CLASS_FOUND`

**意味。** `gstack-approval-classes check` が、宣言された class でカバーされる変更を検出しました。各 `APPROVAL_CLASS:` 行には class と file:line が示され、各 `APPROVAL_SCOPE: <class>@<digest12>` 行は、承認が紐付けられるトークンです。組み込みの検出器によるレポートのみの行は、このコードを設定しません。

**対処。** オーナーに確認し、次の行を PR の本文に追加してください: `Approved by <owner> <YYYY-MM-DD> via <ref> for <class>@<digest12>`。トークンは、効果が追加、削除、または編集されるたびに変わるため、後の変更には新たな承認が必要です。

<a id="approval-citation-missing"></a>
### `APPROVAL_CITATION_MISSING`

**意味。** `gstack-ship-receipt write` が、宣言された承認 class に対して、解決可能かつ現在の効果に紐付く引用を見つけられませんでした。そのためレシートは書き込まれていません。拒否行には、すべての候補の引用と、それが有効とみなされなかった理由が示されます。プランの autoplan ゲートが APPROVED でない、コメントが ship-policy のメンテナーによるものでない、または引用されたオーナーによるものでない、証拠がスコープトークンも class も、すべての効果パスとともに示していない(他の作業の承認、または効果が追加される前に与えられた承認)、あるいは解決できない参照に一致する `for <class>@<digest12>` の証明が欠けている、といった場合です。

**対処。** 承認を引用してください。プランの sha と `--approval-run <run dir>`、またはトークンを示すメンテナーのコメントやレビューの URL を指定します。gstack が読めない証拠(スレッドのコードやチャットメッセージなど)の場合は、`for <class>@<digest12>` で、どのスコープをカバーするかを証明してください。レシートには、コーディネーター向けに `citation: unverified` と記録されます。

<a id="approval-source-unavailable"></a>
### `APPROVAL_SOURCE_UNAVAILABLE`

**意味。** `origin/<base>` が解決できないため、コミットされた承認 class を読めません。`check` は終了コード 3 で終了し、`gstack-ship-receipt write` は `approval.status: unavailable` を記録して `approval=unchecked` を表示します。

**対処。** `git fetch origin <base>` を実行してから再実行してください。作業ツリー上のコピーは決して使われません。

<a id="state-matrix-incomplete"></a>
### `STATE_MATRIX_INCOMPLETE`

**意味。** `gstack-state-matrix check` が、state-machines スペシャリストの出力を読み、ギャップを見つけました。具体的には、kind × オーナーのアクションの組に行がない、結果の行がない行がある、チェックアウトに存在しないテスト参照がある、あるいは CRITICAL の検出なしにテストされていないセルがある、といった場合です。マトリクスが不完全なレビューは、カバレッジが不完全であり、決してクリーンな結果とはみなされません。

**対処。** 同じ差分に対して state-machines スペシャリストを再実行し、その出力を再度確認してください。

## gstack-error-capture

`gstack-error-capture` は、`/devex-review` のステップ 3 のために、ターミナルなし、環境を消去し、一時的なプライベート HOME の状態で対象の CLI を 1 つ実行し、秘匿化された JSON レコードを 1 件出力します。このツール自身の失敗は、`gstack-error-capture: <what>; fix: <fix> (<CODE>)` という 1 行の stderr を出力し、レコードは出力しません。終了コード 2 は使用法の誤り、3 は拒否、1 はヘルパーの失敗を意味します。`gstack-error-capture --help` で、すべてのフラグとコードを一覧表示できます。

<a id="dx-capture-usage"></a>
### `gstack-error-capture: ... (DX_CAPTURE_USAGE)`

**意味。** gstack-error-capture の引数が不正です。未知のフラグ、値のないフラグ、`--` がない、または `--` の後にコマンドがない、のいずれかです。終了コードは 2 です。

**対処。** `gstack-error-capture [--deadline <s>] [--max-bytes <n>] [--pass-env NAME,...] [--copy-config <path>] [--cwd <dir>] [--approved] [--launch-check] -- <cmd> [args]` の形式で再実行してください。フラグは `--` の前に置き、コマンドとその引数は `--` の後に置きます。

<a id="dx-capture-bad-deadline"></a>
### `gstack-error-capture: ... (DX_CAPTURE_BAD_DEADLINE)`

**意味。** `--deadline` が、正の秒数ではありません(3600 以下で、小数点以下 3 桁まで指定できます)。終了コードは 2 です。

**対処。** `--deadline 20` を付けて再実行してください。

<a id="dx-capture-bad-max-bytes"></a>
### `gstack-error-capture: ... (DX_CAPTURE_BAD_MAX_BYTES)`

**意味。** --max-bytes が 1 から 1048576 までの整数ではありません。終了コードは 2 です。

**対処。** `--max-bytes 65536` を付けて再実行してください。

<a id="dx-capture-bad-pass-env"></a>
### `gstack-error-capture: ... (DX_CAPTURE_BAD_PASS_ENV)`

**意味。** --pass-env に、無効な変数、未設定の変数、またはコンテインメントが管理する変数(PATH、HOME、XDG_CONFIG_HOME、TERM、USERPROFILE)が指定されています。終了コードは 2 です。

**対処。** `--pass-env NAME` を、呼び出し元の環境で NAME が設定された状態で再実行してください。

<a id="dx-capture-bad-cwd"></a>
### `gstack-error-capture: ... (DX_CAPTURE_BAD_CWD)`

**意味。** --cwd が既存のディレクトリではありません。終了コードは 2 です。

**対処。** `--cwd <existing-directory> --approved` を付けて再実行してください。

<a id="dx-capture-approval-required"></a>
### `gstack-error-capture: ... (DX_CAPTURE_APPROVAL_REQUIRED)`

**意味。** --pass-env、--copy-config、--cwd のいずれかが --approved なしで指定されました。これらは対象の認証情報や実ファイルを渡すため、承認が必要です。終了コードは 3 です。

**対処。** 指定された変数、ファイル、またはディレクトリについて、ユーザーに承認を求めてから、--approved を付けてください。

<a id="dx-capture-config-refused"></a>
### `gstack-error-capture: ... (DX_CAPTURE_CONFIG_REFUSED)`

**意味。** --copy-config に、存在しないファイル、シンボリックリンク、通常のファイルではないもの、HOME の外にあるパス、重複したファイル、または 1 MiB を超えるファイルが指定されています。終了コードは 3 です。

**対処。** `--copy-config <regular file under $HOME, no symlinks>` を指定して再実行してください。

<a id="dx-capture-not-found"></a>
### `gstack-error-capture: ... (DX_CAPTURE_NOT_FOUND)`

**意味。** コマンドが実行可能ファイルに解決されません。レコードには launch "not_found" が記録され、何も実行されていません。終了コードは 1 です。

**対処。** コマンドをインストールするか、`--` の後にそのコマンドの絶対パスを指定してください。

<a id="dx-capture-temp-dir"></a>
### `gstack-error-capture: ... (DX_CAPTURE_TEMP_DIR)`

**意味。** gstack の状態ルート配下にある、非公開(0700)のコンテインメント用ディレクトリを作成できませんでした。終了コードは 1 です。

**対処。** $GSTACK_STATE_ROOT/error-capture を、自分が所有する書き込み可能なディレクトリにしてください(シンボリックリンクは不可)。そのうえで再実行してください。

<a id="dx-capture-containment-unavailable"></a>
### `gstack-error-capture: ... (DX_CAPTURE_CONTAINMENT_UNAVAILABLE)`

**意味。** このプラットフォームでは、プロセスグループまたは Windows のジョブによるコンテインメントが利用できません。何も実行されていません。終了コードは 1 です。

**対処。** Linux、macOS、またはジョブオブジェクトが利用可能な Windows でキャプチャを実行してください。

<a id="dx-capture-supervisor-failed"></a>
### `gstack-error-capture: ... (DX_CAPTURE_SUPERVISOR_FAILED)`

**意味。** 結果を報告する前に、デッドラインのスーパーバイザーが失敗しました。終了コードは 1 です。

**対処。** 同じコマンドを一度再実行してください。それでも同じエラーになる場合は、`bin/gstack-qa-deadline --help` を実行してスーパーバイザーを確認してください。

<a id="dx-capture-interrupted"></a>
### `gstack-error-capture: ... (DX_CAPTURE_INTERRUPTED)`

**意味。** ヘルパーが SIGINT、SIGTERM、または SIGHUP を受け取りました。対象のグループは強制終了され、レコードは出力されていません。終了コードは 1 です。

**対処。** 中断せずに同じコマンドを再実行してください。

<a id="dx-capture-redaction-failed"></a>
### `gstack-error-capture: ... (DX_CAPTURE_REDACTION_FAILED)`

**意味。** 完成したレコードがまだ秘密情報のチェックに引っかかったため、何も出力されていません。終了コードは 1 です。

**対処。** --pass-env を追加して再実行しないでください。コマンド名を gstack のメンテナーに報告してください。

<a id="dx-capture-internal"></a>
### `gstack-error-capture: ... (DX_CAPTURE_INTERNAL)`

**意味。** ヘルパーで想定外の障害が発生しました。出力される行にはエラークラスと最初のスタックフレームが含まれます。終了コードは 1 です。

**対処。** 一度再実行してください。それでも同じエラーになる場合は、出力されたフレームを gstack のメンテナーに報告してください。
