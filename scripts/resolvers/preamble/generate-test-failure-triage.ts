
import { FREE_TEXT_WRITE_RULE, freeTextFileBash, freeTextFileUse } from '../free-text-file';

export function generateTestFailureTriage(): string {
  return `## テスト失敗の所有者トリアージ

テストが失敗しても、すぐに停止してはいけません。まず所有者を判断します:

### Step T1: 各失敗を分類する

失敗している各テストについて:

1. **このブランチで変更されたファイルを取得する:**
   \`\`\`bash
   git diff origin/<base>...HEAD --name-only
   \`\`\`

2. **失敗を分類する:**
   - **ブランチ内(In-branch)** とする条件: 失敗したテストファイル自体がこのブランチで変更されている、またはテスト出力がこのブランチで変更されたコードを参照している、または失敗をブランチ diff の変更に辿れる場合。
   - **既存の可能性が高い(Likely pre-existing)** とする条件: テストファイルもテスト対象のコードもこのブランチで変更されておらず、かつ失敗が特定できるどのブランチ変更とも無関係な場合。
   - **曖昧な場合は、ブランチ内として扱います。** 壊れたテストを出荷させるより、開発者を止めるほうが安全です。既存と分類するのは、確信がある場合だけです。

   この分類はヒューリスティックです。diff とテスト出力を読んで判断してください。プログラムによる依存グラフはありません。

### Step T2: ブランチ内の失敗に対処する

**STOP。** これらはあなたの失敗です。内容を示し、先へ進まないでください。開発者は、出荷前に自分が壊したテストを自分で直さなければなりません。

### Step T3: 既存の失敗に対処する

プリアンブルの出力から \`REPO_MODE\` を確認します。

**REPO_MODE が \`solo\` の場合:**

AskUserQuestion Format に従って AskUserQuestion で質問します。各失敗を file:line と簡単なエラー説明とともに列挙し、失敗は既存のもの(このブランチが原因ではない)と思われること、ソロのリポジトリでは他の誰も直さないことを伝えます。コンテキストが新鮮なので A を推奨として、選択肢は次のとおりです:
- A) 今すぐ調査して修正する (human: ~2-4h / CC: ~15min) — Completeness 10/10
- B) P0 の TODO として追加する — このブランチのマージ後に修正 — Completeness 7/10
- C) スキップする — 承知のうえで、そのまま出荷 — Completeness 3/10

**REPO_MODE が \`collaborative\` または \`unknown\` の場合:**

AskUserQuestion Format に従って AskUserQuestion で質問します。各失敗を同じ形式で列挙し、共同開発のリポジトリではこれらが他の人の責任である可能性があることを伝えます。壊した本人が直せるように B を推奨として、選択肢は次のとおりです:
- A) それでも今すぐ調査して修正する — Completeness 10/10
- B) blame で作者を特定し、GitHub issue を作者にアサインする — Completeness 9/10
- C) P0 の TODO として追加する — Completeness 7/10
- D) スキップする — そのまま出荷 — Completeness 3/10

### Step T4: 選択された対応を実行する

**「今すぐ調査して修正する」の場合:**
- /investigate の考え方に切り替えます。まず根本原因、次に最小限の修正です。
- 既存の失敗を修正します。
- 修正は、ブランチの変更とは別にコミットします: \`git commit -m "fix: pre-existing test failure in <test-file>"\`
- ワークフローを続行します。

**「P0 の TODO として追加する」の場合:**
- \`TODOS.md\` が存在する場合は、\`review/TODOS-format.md\`(または \`.claude/skills/review/TODOS-format.md\`)の形式に従ってエントリを追加します。
- \`TODOS.md\` が存在しない場合は、標準のヘッダー付きで作成し、エントリを追加します。
- エントリには、タイトル、エラー出力、どのブランチで気づいたか、優先度 P0 を含めます。
- ワークフローを続行します。既存の失敗はブロッカーとして扱いません。

**「blame + GitHub issue をアサイン」の場合(collaborative のみ):**
- 壊した可能性が高い人を探します。テストファイルと、そのテスト対象のプロダクションコードの両方を確認します:
  \`\`\`bash
  # 失敗したテストを最後に変更したのは誰か
  git log --format="%an (%ae)" -1 -- "<failing-test-file>"
  # そのテストがカバーするプロダクションコードを最後に変更したのは誰か(多くの場合、実際に壊した人)
  git log --format="%an (%ae)" -1 -- "<source-file-under-test>"
  \`\`\`
  両者が別の人なら、プロダクションコードの作者を優先してください。リグレッションを持ち込んだ可能性が高いためです。
- その人にアサインした issue を作成します。タイトルと本文にはテスト名とエラー出力が含まれるため、コマンドの中に直接書かず、ファイル経由で渡します:

\`\`\`bash
${freeTextFileBash([{ variable: 'TITLE_FILE', stem: 'issue-title' }, { variable: 'BODY_FILE', stem: 'issue-body' }])}
\`\`\`

${FREE_TEXT_WRITE_RULE} タイトルファイル: \`既存のテスト失敗: <test name>\`。本文ファイル(Markdown。エラーは \`~~~\` のフェンスに入れ、中のバッククォートがそのまま残るようにします):

\`\`\`text
<current branch> で失敗。既存の問題です。

**エラー:**
~~~
<first 10 lines of the failure>
~~~

**最終更新者:** <author>
**検知:** gstack /ship(<date>)
\`\`\`

その後、Step 0 で判定したプラットフォーム(\`github\` または \`gitlab\`)で投稿します。出力された 2 つのファイル名を差し替え、assignee はそのプラットフォームで有効なログイン名の場合のみ指定します(GitHub: 英数字と単一のハイフン、最大 39 文字)。そうでない場合は assignee フラグを外し、本文に担当者名を書きます。

\`\`\`bash
${freeTextFileUse([{ variable: 'TITLE_FILE', placeholder: '<title-file-name>' }, { variable: 'BODY_FILE', placeholder: '<body-file-name>' }], 'gh issue create --title \\"\\$(cat $TITLE_FILE)\\" --body-file $BODY_FILE')}
case "<platform>" in
  github) gh issue create --title "$(cat "$TITLE_FILE")" --body-file "$BODY_FILE" --assignee "<github-username>" ;;
  gitlab) glab issue create -t "$(cat "$TITLE_FILE")" -d "$(cat "$BODY_FILE")" -a "<gitlab-username>" ;;
  *) echo "Not sent: no GitHub or GitLab remote. Files: $TITLE_FILE $BODY_FILE" >&2; false ;;
esac && rm -f "$TITLE_FILE" "$BODY_FILE"
\`\`\`

- どちらの CLI も使えない場合、または \`--assignee\`/\`-a\` が失敗した場合(ユーザーが組織に属していないなど)は、assignee なしで issue を作成し、誰が確認すべきかを本文に書きます。
- ワークフローを続行します。

**「スキップ」の場合:**
- ワークフローを続行します。
- 出力に次のように記載します: "既存のテスト失敗をスキップ: <test-name>"`;
}

