<!-- AUTO-GENERATED from merge-and-deploy.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 4: PRをマージする

Step 3.5 でこの正確な `PR_HEAD` に対する承認を得た場合にのみ進みます。開始時刻を記録し、`MERGE_ATTEMPT=none`、`MERGE_EXIT=0`、`MERGE_ERROR=''`、`WAITED=false` で初期化します。これらの値は読み取り確認の間も保持し、リトライのためにリセットしないでください。`MERGE_METHOD` は Deploy Configuration と `gh api "repos/$REPO" --jq '{squash: .allow_squash_merge, merge: .allow_merge_commit, rebase: .allow_rebase_merge}'` から決めます。未設定の場合は squash、merge、rebase の順で優先します。許可されていない・不明なメソッドの場合は **STOP** して確認してください。`MERGE_FLAG` は `--squash`、`--merge`、`--rebase` のいずれかに設定します。
マージの**最初の試行の前**、各試行の**後**、および待機中には、次の読み取り確認を必ず実行してください。これが唯一のディスパッチャーであり、どのコマンドも別のマージ方法へフォールスルーしてはいけません。

### 4a-postfail: 失敗後のPR状態チェック

**普遍的な不変条件:** `gh pr merge` が非ゼロで終了したら、リトライまたは停止の前に必ず権威ある PR 状態を照会してください。盲目的にリトライしないこと。関連: cli/cli#3442、cli/cli#13380。`gh pr view` はキュー内のメンバーシップを公開しないため、`autoMergeRequest` と `mergeQueueEntry` の両方について GraphQL を使ってください。失敗・非対応・欠落したフィールドは「不明」であり、リクエストやキューエントリが存在しないという証拠では決してありません。

```bash
READBACK=$(gh api graphql -f query='query($owner:String!,$name:String!,$number:Int!) {
  repository(owner:$owner,name:$name) { pullRequest(number:$number) {
    state headRefOid baseRefName mergedAt mergeCommit { oid }
    autoMergeRequest { enabledAt } mergeQueueEntry { id state }
  } }
}' -f owner="${REPO%/*}" -f name="${REPO#*/}" -F number="$PR_NUMBER") || exit 1
printf '%s' "$READBACK" | jq -e '
  ((.errors // []) | length == 0) and
  (.data.repository.pullRequest | type == "object" and
    has("state") and has("headRefOid") and has("baseRefName") and has("mergeCommit") and
    has("autoMergeRequest") and has("mergeQueueEntry"))' >/dev/null || exit 1
PR_STATE=$(printf '%s' "$READBACK" | jq -er '.data.repository.pullRequest.state') || exit 1
CURRENT_HEAD=$(printf '%s' "$READBACK" | jq -er '.data.repository.pullRequest.headRefOid') || exit 1
CURRENT_BASE=$(printf '%s' "$READBACK" | jq -er '.data.repository.pullRequest.baseRefName') || exit 1
ACTIVE_REQUEST=$(printf '%s' "$READBACK" | jq -r '.data.repository.pullRequest | .autoMergeRequest != null or .mergeQueueEntry != null')
MERGE_ACTION=STOP
case "$PR_STATE" in
  MERGED)
    if [ "$CURRENT_HEAD" != "$PR_HEAD" ] || [ "$CURRENT_BASE" != "$BASE_BRANCH" ]; then
      MERGE_ACTION=MERGED_CHANGED
    else
      MERGE_ACTION=MERGED
    fi ;;
  OPEN)
    if [ "$CURRENT_HEAD" != "$PR_HEAD" ]; then
      MERGE_ACTION=HEAD_CHANGED
    elif [ "$CURRENT_BASE" != "$BASE_BRANCH" ]; then
      MERGE_ACTION=BASE_CHANGED
    elif [ "$ACTIVE_REQUEST" = true ]; then
      MERGE_ACTION=WAIT
    elif [ "$WAITED" = true ]; then
      MERGE_ACTION=STOP
    elif [ "$MERGE_ATTEMPT" = none ]; then
      MERGE_ACTION=START
    elif [ "$MERGE_ATTEMPT" = auto ] && [ "$MERGE_EXIT" -ne 0 ]; then
      case "$MERGE_ERROR" in
        *"Auto-merge is not allowed for this repository"*|*"Pull request is in clean status"*|*"Pull request is in unstable status"*) MERGE_ACTION=DIRECT ;;
      esac
    fi ;;
esac
printf '%s\n' "$MERGE_ACTION"
```

読み取りが失敗した場合や状態が不明な場合: **STOP**。コマンドのエラーを残したまま、マージしないでください。
HEAD_CHANGED/BASE_CHANGED: 承認を無効化し、**STOP** して、新しいターゲットについて Step 1 と readiness からやり直してください。MERGED_CHANGED: 外部でのマージが行われたことは報告しますが、変更された head/base が整合するまでクリーンアップ・デプロイ・ロールバックを **STOP** してください。古いスコープと承認は使えません。決して再実行しないこと。WAIT は §4a へ進みます。STOP は元の stderr と現在の状態を表示します。**`state == "CLOSED"` の場合: STOP**。PR はマージされずにクローズされています。

最初の試行を行うのは START だけです。どちらかのマージコマンドの直前には、読み取り確認と Step 1 のローカルの HEAD/ブランチ/クリーン状態のチェックを繰り返してください。リターゲットやローカルの変更があれば準備状態は無効になります。`--match-head-commit` が守るのは head であり、マージ先ではありません。
各マージブロックは Step 3.5 の承認を伴って CI ゲートを再実行します(`--auto` の場合も、必須チェックの待機のみであっても同様)。ゲートが終了コードを返した場合はマージは実行されていません: 出力とともに **STOP** してください。ブランチ保護またはマージキューだけが、チェックからマージまでを不可分にします。
```bash
CI_GATE=$(~/.claude/skills/gstack/bin/gstack-ci-gate --repo "$REPO" --pr "$PR_NUMBER" --expect-head "$PR_HEAD" "${CI_OVERRIDE[@]}")
echo "$CI_GATE"
case "${CI_GATE%%$'\n'*}" in "VERDICT PASS $PR_HEAD"|"VERDICT NO_CHECKS $NO_CI_APPROVED_HEAD") ;; *) exit 1 ;; esac
MERGE_ATTEMPT=auto
MERGE_EXIT=0
MERGE_ERROR=$(gh pr merge "$MERGE_FLAG" --auto --delete-branch "$PR_NUMBER" --repo "$REPO" --match-head-commit "$PR_HEAD" 2>&1) || MERGE_EXIT=$?
```
終了コードが 0 であっても、必ず読み取り確認に戻ってください。DIRECT の場合のみ、**1 回だけの直接マージへのフォールバック**が許可されます。読み取り確認で OPEN、自動リクエストなし、キューエントリなしが確認でき、かつ auto の試行が文書化された 2 種類の拒否のいずれかを返した場合です。その 2 種類とは、auto-merge が無効である場合、または PR がすでにクリーン/アンスタブルで必須のチェックが残っていない場合です。後者は auto-merge が無効であることを意味しません。
```bash
CI_GATE=$(~/.claude/skills/gstack/bin/gstack-ci-gate --repo "$REPO" --pr "$PR_NUMBER" --expect-head "$PR_HEAD" "${CI_OVERRIDE[@]}")
echo "$CI_GATE"
case "${CI_GATE%%$'\n'*}" in "VERDICT PASS $PR_HEAD"|"VERDICT NO_CHECKS $NO_CI_APPROVED_HEAD") ;; *) exit 1 ;; esac
MERGE_ATTEMPT=direct
MERGE_EXIT=0
MERGE_ERROR=$(gh pr merge "$MERGE_FLAG" --delete-branch "$PR_NUMBER" --repo "$REPO" --match-head-commit "$PR_HEAD" 2>&1) || MERGE_EXIT=$?
```
読み取り確認に戻ってください。直接の試行からのフォールバックはありません。**厳守事項: MERGED の後は決してマージを再実行しないこと**。また、不明な状態やエラーに対してリトライしないこと。`--admin` によるバイパスはなし。

**`state == "MERGED"` の場合:**

サーバー側のマージは成功しています(ローカルのクリーンアップ段階が失敗する前にすでに完了していた場合や、並行したマージが入った場合もあります)。ユーザーに「PRはGitHub上でマージ済みです。」と伝えてください。(「マージは成功しました」とは言わないこと。並行マージのケースに対応するためです。)

マージ SHA を取得します:
```bash
MERGE_SHA=$(printf '%s' "$READBACK" | jq -er '.data.repository.pullRequest.mergeCommit.oid') || exit 1
```

squash/rebase マージの読み取り確認のガード:
- PR の head SHA がベースブランチの祖先であることを求めて、成功を証明**しないでください**。GitHub の squash や rebase マージは意図的に新しいコミットを作成するため、PR がマージ済みであっても `git merge-base --is-ancestor <head_sha> origin/<base>` は失敗することがあります。
- GitHub が `mergeCommit.oid` が null でない `state == "MERGED"` を報告したら、それを権威ある情報として扱ってください。マージ SHA を記録して続行します。
- ローカルのクリーンアップや読み取り確認が必要な場合は、ベースブランチを fetch し、古い PR ブランチのコミットではなくマージコミットと比較/同期してください:
```bash
git fetch "https://github.com/$REPO.git" "$BASE_BRANCH"
git diff --quiet "$MERGE_SHA" FETCH_HEAD || git log --oneline --decorate -1 "$MERGE_SHA" FETCH_HEAD
```
- worktree がクリーンで、squash マージ後に分岐しているように見えないようにするだけであれば、デタッチドHEADよりも、マージコミットを指す名前付きのローカルブランチを優先してください。例: `git switch -c "post-merge/pr-$PR_NUMBER" "$MERGE_SHA"`(ホストがブランチ接頭辞を持つ場合はそれを使う。たとえば Codex Desktop では、git アクションワーカーが `git symbolic-ref --short HEAD` でブランチ名を期待するため `codex/` を使います)。ユーザーから明示的に求められない限り、ユーザーのブランチを force-push したりリセットしたりしないでください。

worktree のクリーンアップ — 非破壊的で、候補ベースで行います:
```bash
git worktree list --porcelain
```
候補の特定: worktree が次の 3 つをすべて満たす場合、古いものとみなします。(a) ベースブランチでチェックアウトされている、かつ (b) ユーザーの現在のメインの作業ツリーではない、かつ (c) その中で `git status --porcelain` が空である(コミットされていない作業がない)。

- クリーンな候補ごとに、削除を提案してください。次のように伝えます: 「`<branch>` でチェックアウトされている古い worktree が `<path>` にあり、コミットされていない作業はありません。削除しますか?」 ユーザーが確認した場合のみ削除します(`git worktree remove <path> && git worktree prune`)。
- 候補にコミットされていない作業がある場合: ファイルを一覧にしてユーザーに伝え、何も削除せず worktree のクリーンアップを停止してください。
- `--force` は使わないこと。ユーザーのメインの作業ツリーは削除しないこと。

リモートブランチの整合: `--delete-branch` が完了していない可能性があります。マージの終了コードからクリーンアップ完了と主張するのではなく、ブランチの結果を確認してください:

```bash
# gh leaves .headRepository.nameWithOwner EMPTY (gh 2.83): compose owner/name
# from headRepositoryOwner.login + headRepository.name.
IFS=$'\t' read -r HEAD_REPO HEAD_BRANCH <<< "$(gh pr view "$PR_NUMBER" --repo "$REPO" --json headRepositoryOwner,headRepository,headRefName \
  --jq '"\(.headRepositoryOwner.login)/\(.headRepository.name)\t\(.headRefName)"')"
case "$HEAD_REPO" in ''|/*|*/) HEAD_BRANCH= ;; esac
[ -n "$HEAD_BRANCH" ] && echo "HEAD: $HEAD_REPO $HEAD_BRANCH" && git ls-remote --heads "https://github.com/$HEAD_REPO.git" "refs/heads/$HEAD_BRANCH"
```

これらの名前は PR のデータです。変数に保持し、決して手で書き直さないでください。PR の head リポジトリが、ブランチの存在場所の正式な情報源です。同一リポジトリの PR であれば base リポジトリであり、フォーク由来の PR であればフォークです。チェックアウトの `origin` で代用しないでください。`HEAD:` の行がない場合は確認が失敗したことを意味します。ブランチの状態は不明として扱い、削除の経路は実行しないでください。

結果は 3 通り。失敗した確認を、クリーンなブランチとして読まないこと:

- **終了コード 0、出力が空** — リモートブランチはすでに存在しません(GitHub のマージ後の自動削除、または並行する別の操作がすでに削除しました)。ユーザーに「リモートブランチはすでにクリーンアップ済みです。」と伝えてください。これにより、回復処理の再実行が冪等になります。
- **終了コード 0、参照行が 1 行** — ブランチが残っています。失敗したマージコマンドが `--delete-branch` の部分に到達しなかったことを意味します。`HEAD_REPO` が `REPO` と等しい場合は、削除を提案し、確認を取ってください(上記のワークツリーのクリーンアップと同じ姿勢)。「リモートブランチ `<head-branch>` が `<head-repository>` にまだ存在します。失敗したマージでは --delete-branch の部分が実行されませんでした。削除しますか?」 確認が取れた場合のみ、そのブロックの最初の 3 行を再実行し、その後 `git push "https://github.com/$HEAD_REPO.git" --delete "refs/heads/$HEAD_BRANCH"` を実行してください。`HEAD_REPO` がフォークの場合は、削除を提案しないでください。ブランチは貢献者のものであり、メンテナーには通常そこへの push 権限がありません。代わりに次のように報告してください: 「ブランチは貢献者のフォーク `<head-repository>` にあります。そちらにお任せします。」 同名のローカルブランチが存在する場合は、`git branch -d "$HEAD_BRANCH"` の削除を併せて提案できます(`-d` を使い、`-D` は使わないこと。fast-forward されていないローカルブランチはユーザーが判断することです)。
- **終了コードが非ゼロ** — 確認そのものが失敗しました(ネットワークや認証の問題)。ユーザーに「リモートブランチの状態を確認できませんでした。そのままにします。」と伝え、削除の提案は完全にスキップしてください。確認の失敗は不明な状態であり、クリーンなブランチではありません。

マージ後の経路を、`auto`、`direct`、`queue`、または(試行前にすでにマージされていた場合は)`external` のいずれかで記録し、続けて §4b(CI による自動デプロイの検出)へ進みます。

### 4a: マージキューの検出とメッセージ

**`state == "OPEN"` かつ、いずれかのリクエストが null でない場合:** auto-merge が有効であるか、マージキューが使われています。どちらが観測されたかを説明してください。auto リクエストだけではキューの存在は証明されません。キューは提案されたマージ結果に対して CI を再実行します。`mergeQueueEntry` が観測された場合にのみ `MERGE_PATH=queue` を記録し、それ以外は `auto` とします。

`WAITED=true` を設定します。30 秒ごとに読み取り確認を繰り返し、最大 30 分間待ちます。2 分ごとに進捗を報告します。
auto リクエストまたはキューエントリがアクティブな OPEN の間は、待ち続けてください。待機が始まったら、START や DIRECT を決して実行しないこと。両方が存在しないことが確認された OPEN は、削除またはキャンセルされたことを意味するので、**STOP** して GitHub の checks/キューのページを案内してください。MERGED の場合はマージ SHA/クリーンアップの上記の分岐に戻ります。CLOSED、head の変更、読み取りの失敗、またはタイムアウトの場合は、サーバー側のリクエストを再実行・キャンセルせずに停止してください。タイムアウトした有効なリクエストは、後でマージされる可能性があることを説明してください。

### 4b: CI による自動デプロイの検出

PR がマージされた後、そのマージによってデプロイワークフローがトリガーされたかを確認します:

```bash
gh run list --repo "$REPO" --branch "$BASE_BRANCH" --limit 10 --json databaseId,name,status,conclusion,workflowName,headSha
```

`MERGE_SHA` と、承認前に特定したデプロイワークフローに一致する実行を探してください(名前だけでなく、そのジョブも読むこと)。ステージングと本番を区別してください。見つかった場合:
- ユーザーに伝える: 「PRはマージされました。マージによって、デプロイワークフロー(「{workflow-name}」)が自動的に開始されたのを確認しました。その完了を監視して、終わったらお知らせします。」

マージ後にデプロイワークフローが見つからない場合:
- ユーザーに伝える: 「PRはマージされました。デプロイワークフローは見当たりません。プロジェクトが別の方法でデプロイしているか、デプロイ工程のないライブラリ/CLIかもしれません。次のステップで適切な検証方法を確認します。」

`MERGE_PATH=queue` でデプロイワークフローが存在する場合:
- ユーザーに伝える: 「PRはマージキューを通過し、デプロイワークフローが実行中です。監視します。」

マージのタイムスタンプ、所要時間、マージの経路をデプロイレポート用に記録してください。

---

## Step 5: デプロイ戦略の検出

マージ前に保存しておいたスコープとデプロイの事実を使ってください。クリーンアップ後のチェックアウトを分類し直さないこと。このスキルは既存のデプロイトリガーを観測するものであり、新しいものを発明するものではありません。

**Step 5〜7 に共通する優先順位のルール:** 明示的な検証 URL、または実際にトリガーされたデプロイは、ドキュメントのみの近道よりも優先されます。次の順に評価してください:

本番用の経路を以下から選択し、**その経路を実行する前に** Step 5a を完了してください。ドキュメントのみでデプロイなしの経路は即座に完了できます。ステージングの提案は不要です。

1. 一致するデプロイの実行、またはプラットフォームのリリース: Step 6 で監視します(ドキュメントのみの変更であっても。ドキュメントサイトかもしれません)。設定されたワークフローやプラットフォームのトリガーで、その実行がまだ現れていない場合は保留のままです。Step 6 の期限内に一致するリビジョンを探してポーリングしてください。別の実行を待つのではありません。
2. 記録されたコマンドによるトリガー(Deploy Configuration がデプロイのトリガーとしてコマンドを記録している): そのコマンドが実行されるまで何もデプロイされません。本番はまだ動いていないとユーザーに伝え、そのコマンドの名前を示して、実行を依頼してください。または、ユーザーの明示的な承認がある場合に限り自分で実行してください。その後、`MERGE_SHA` について Step 6 のステータスをポーリングします。終了コードが 0 であることはリビジョンの証明にはなりません。
3. 明示的な `VERIFY_URL`: ドキュメントのみであっても Step 7 を実行します。デプロイのリビジョンの証拠がない場合は、サイトの健全性と、この変更が本番に反映されているかどうかを分けて報告してください。
4. `DOCS_ONLY=true` かつ、明示的な URL がなく、トリガーされた/想定されたデプロイもない場合: SKIPPED(ドキュメントのみ)を記録し、MERGED — NO DEPLOY NEEDED の状態で Step 9 へ進みます。デプロイの検出が不明であることは、何もトリガーされていないことの証明ではありません。その場合は下記の質問を使ってください。
5. それ以外の場合は、Step 6〜7 で設定された本番の URL/ステータス確認を使います。使える URL もデプロイのステータスもない場合は、一度だけ確認します。また、Step 6 が完了しても、カナリアに必要な本番 URL がない場合も確認します:
   - **前提の再確認:** 「PR #NNN はマージされました。{既知のデプロイの状態}。ヘルスチェックのために URL が必要です。マージだけでは、このリビジョンが公開されたことは証明できません。」
   - **推奨:** Web アプリなら A。デプロイが不要な場合に限り B。
   - A) 本番の URL を提供する → 保存して Step 7 へ進む
   - B) デプロイ不要(ライブラリ/CLI) → MERGED — NO DEPLOY NEEDED の状態で Step 9 へ
   - C) 検証せずに終了 → 証拠に基づく判定表を使って Step 9 へ
   観測された、または想定されるデプロイがない場合にのみ B を提示してください。実行中または失敗中のデプロイを消すことはできません。

### 5a: 任意のステージング検証(デプロイのゲートではない)

ドキュメント以外の変更については、ステージング/プレビューの URL と成功したデプロイの記録が `PR_HEAD`(プレビュー)または `MERGE_SHA`(マージ後のステージング)を特定できる場合にのみ提示してください。URL だけでは不十分です。利用できない場合は、ステージングを N/A と記録し、上記の本番用の経路に進みます。ここではステージングのトリガーや昇格を実行しません。

- **前提の再確認:** 「この変更のデプロイが {staging URL} にあります。こちらも確認できますが、本番がすでに公開されている可能性があります。これは本番を保留・ロールバックするものではありません。」
- **推奨:** A は、本番の検証を外さずにステージングの証拠を加えます。
- A) ステージングを検証し、その後本番を検証する
- B) 本番のみを検証する
- C) ステージングのみを検証する。本番の検証は未完了のままにする

A/C は、`TARGET=staging` を指定して、ステージングの URL に対して Step 7 を実行し、ステージングと本番の証拠を別々に残します。ステージングが健全であれば `STAGING_STATUS=VERIFIED` を設定します。A は上記の本番用の経路に戻り、C は STAGING VERIFIED — PRODUCTION UNVERIFIED の状態で Step 9 へ進みます。ステージングが失敗した場合は Step 7 の判断経路を使い、決して自動で昇格させないこと。B は SKIPPED を記録して本番の経路に進みます。

---
