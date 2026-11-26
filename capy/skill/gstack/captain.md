# キャプテンの下での作業: 承認、プランの確認、マージの依頼

このファイルは gstack の Capy スキル(オーナーが Drive にコピーするフォルダ)に属します。Capy のスレッドが gstack を動かしているときに、判断を求め、回答を記録し、マージを依頼する方法を説明します。このルールは、スレッドがキャプテン(クルースレッド)に報告する場合も、人に直接報告する場合も同じように適用されます。`gstack-skill-start` は、`GSTACK_CAPY=1` のとき(Capy の起動行がこれを設定します)、短い形式を `capy-asks` のブロックとして表示します。`GSTACK_CAPY_ASKS=0` を設定すると、そのセッションではこのブロックを出しません。

## 1. スレッドごとの承認の仕組み

- **一本化されている。** クルースレッドは、キャプテンに尋ねます。Capy のエージェントチャネルを通した「要対応」の報告であり、人に質問することはありません。キャプテンが平易な言葉で人に伝え、その人の正確な返答を送り返します。キャプテンのいないスレッドは、Capy の質問で人に直接尋ねます。どちらの場合も、「ゲートのコード」や「スロット番号」だけを示す裸の質問をしてはいけません。
- **スコープ。** 回答は、尋ねられたスレッドとスコープにだけ適用されます。後の作業にまで及ぶ包括的な承認ではありません。
- **標準承認**は、キャプテンが自身のルールに挙げているものです。例としては「マージトレインを通して、緑になったらマージ」「有料の評価ゲートは事前承認済み」「単一ケースのフレーキーの再実行」があります。その際はルール(日付と文言付き)を引用し、改めて尋ねないでください。gstack は独自の標準承認を持ちません。
- **必ず新たに確認するもの:**
  - 製品や挙動の判断
  - 宣言された上限を超える支出
  - リポジトリの外に公開されるもの(アドバイザリ、リリース、投稿)
  - しきい値、予算、試行回数、テストの種類の変更
  - 誰かの貢献を取り込まずに閉じること
  - 破壊的または不可逆なもの
- **gstack のワークフローが Capy で行うこと。** `GSTACK_SESSION_KIND=unattended` で起動されると、ワークフローは推奨の選択肢を取り、それ以外の項目を保留のゲート項目として書き出し、停止します。あなたの仕事は、その保留項目を以下の形でキャプテンか人に届け、その回答をワークフローに返すことです。

## 2. 承認の記録

すべての回答には、1 行の記録が必要です。日付、何が尋ねられたか、その人の正確な言葉、誰が言ったか(誰が中継したか)、回答がどこまでを対象とするか、何がまだ保留か、結果(承認、却下、保留、または引用された標準承認)を書きます。

```bash
gstack-approvals add --ask "Spend up to \$40 on a paid eval rerun for the ship cases" \
  --words "yes go" --by "Garry (via GStack Minder)" --scope "one rerun of the 6 ship cases, cap \$40"
gstack-approvals add --outcome standing --ask "Merge #3330 when green" \
  --words "yes merge when green" --by "Garry, 2026-10-16 (Captain rule)" --scope "every crew PR, through a train"
gstack-approvals import --autoplan <run dir> --by Garry   # after gstack-autoplan answer; idempotent
gstack-approvals render                                    # the ## Approvals section
```

- **保存場所。** `<state root>/projects/<slug>/approvals/<branch key>.jsonl` です。ブランチごとに 1 ファイルです。1 つのスレッドは 1 つのブランチを出荷するためです。Capy では、状態のルートはマシンと一緒に破棄されるため、すべての書き込みは、プライベートなプロジェクトユーザーの Drive フォルダ(`<drive>/approvals/<slug>/`)か、`GSTACK_APPROVALS_DIR` にもミラーされます。`GSTACK_APPROVALS_MIRROR=0` でミラーを無効にできます。読み取りは両方のコピーを統合します。`gstack-approvals sync` でローカルのコピーを復元できます。
- **永続的なコピー**は、スレッドの報告と PR の本文にある `## Approvals` のセクションです。`render` の出力を貼り付けてください。行を手で入力してはいけません。
- **シークレットを含まない。** すべてのフィールドは、書き込まれる前に gstack のシークレットスキャナーを通ります。ヒットすると、その行は拒否されます(`APPROVAL_RECORD_SECRET`。フィールドとルールの名前は示しますが、本文は示しません)。シークレットの代わりに `[redacted]` と書くか、その人に言い直してもらってください。
- **表示用のみ。** 描画された表は、メンション、リンク、画像、HTML、そして `Approved by … via …` に似た引用を、すべてエスケープします。gstack が強制する承認の種類には、それ自身の引用行が必要です(docs/ship-policy.md#approval-classes)。
- 表が空なら「No approvals recorded」(承認の記録なし)を意味します。記録もミラーもない新しい Capy マシンでは、代わりに「Record unavailable」(記録を利用できない)と表示されます(`APPROVAL_RECORD_UNAVAILABLE`)。記録が失われたことは、空であることとは違うからです。

## 3. プランの承認: 形式

承認のために出すすべてのプランやゲートには、次の要素がこの順番で含まれている必要があります。プロジェクトの外の人にも分かるように書いてください。

1. **Before → after(変更前後)。** 今、ユーザーやメンテナーが見ているものと、変更後に見えるものを、具体例で示します。コマンドとその出力、画面、コストや時間の数字などです。
2. **なぜ重要か。** 今、誰がどれだけ困っているか。可能な限り数字で示します。
3. **この作業の原因。** きっかけです。issue や PR のリンク、失敗した実行、ユーザーからの報告、あるいはその人の依頼を引用して示します。
4. **大きな判断。** それぞれについて、検討した選択肢、選んだもの、その理由、何があれば覆るかを示します。
5. **あなたに必要なこと。** 決めるべきこと一つ、選択肢とそのコスト、選んだもの、そして一語の返答です。推奨の返答が既定値です(autoplan のゲートなら `rec`)。「最初に書かれたとおりのプラン」を既定値として提示してはいけません。

autoplan の実行では、パート 1 から 4 をプランの中に `## Before → after`、`## Why it matters`、`## What caused this work`、`## Big decisions` のセクションとして書きます。そのうえでゲートでは次を実行します:

```bash
gstack-owner-brief render --captain --out <run dir>
```

これは、ヘッダー行(「Decision needed … Reply **rec** …」)、4 つのプランのセクション(それぞれ上限付きで、残りはプランを指す)、そして「What we need from you」を出力します。最後のものは、`rec` が選ぶすべての選択肢を言葉で並べます。最後の行「For the relaying agent」には、実行、`gate_rev`、`rec_hash`、そして正確な `gstack-autoplan answer` のコマンドが入っています。その行より上はすべて中継してください。返答が戻ってきたら:

```bash
gstack-autoplan answer --out <run dir> --gate-rev <n> --reply rec --rec-hash <h> \
  --by agent:<your thread> --owner-reply "<their exact words>"
gstack-approvals import --autoplan <run dir> --by <name>
```

その人が言葉で答えた場合(「2 つの PR に分けて」など)は、言葉を対応するトークンにマッピングして回答し、記録した内容を一行で確認します(「Recorded: split into two PRs; everything else as recommended」(記録: 2 つの PR に分割。それ以外は推奨どおり))。セクションが欠けているプランは、「Not ready for approval」(承認の準備ができていない)と表示され、返答の案内は出ず、終了コード 1(`CAPTAIN_BRIEF_INCOMPLETE`)で終わります。セクションを追加し、`gstack-autoplan revise --plan <file>` を実行して、もう一度 render してください。autoplan のゲートではない判断については、同じ 5 つの要素を手で書いてください。

## 4. マージの依頼: 形式

READY を送るすべての PR と、READY の報告そのものには、次の要素があります:

1. **What changed(何が変わったか)。** 前後の画像を 1 から 3 枚、重要度の高い順に示します。それぞれに 1 行のキャプションを付けます(何が変わり、なぜか)。その下には、折りたたんだテキスト版を置きます。
   - UI: ベースとブランチの両方のスクリーンショット。サイズは同じにします。
   - スキルやプロンプト: `gstack-pr-shots --path <file> --heading "<section>" --caption "<…>"`。
   - CLI: `gstack-pr-shots --before <capture> --after <capture> --kind terminal --caption "<…>"`。キャプチャはリポジトリ内のファイルです。
   - 内部: 変更を最もよく示すソースのセクションやテストの出力。
   `gstack-pr-shots` はテキストだけを読み、何も実行せず、シークレットに一致する入力を拒否し、`SHOT_PNG:` を表示します。ブラウザがない場合、その行は `unavailable` と表示されます。その場合は、表示された `shot.html` を自分のブラウザでスクリーンショットしてください。各 PNG は、Capy の PR アセットツール(`tools.pr.uploadAsset`)でアップロードしてください。公開リポジトリの場合に限ります。返された URL を、キャプションを代替テキストとして添えて埋め込んでください。
2. **Why(なぜ)。** 原因と、ユーザーが見る効果を、2〜3 文で示します。
3. **Approvals(承認)。** `gstack-approvals render`。
4. **Evidence(証拠)。** ヘッドで緑になったチェック、ゲートやトレインの結果、フレーキーなケース。

READY の報告には、主要な画像を添付してください(Capy のメッセージの添付)。キャプテンがそれをインラインで表示できるようにするためです。
/ship は `GSTACK_CAPY=1` のとき、これらすべてを行います(その `capy-pr` セクション)。Capy の外では、PR の本文は変わりません。
