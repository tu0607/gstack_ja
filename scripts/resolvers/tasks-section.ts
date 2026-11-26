/**
 * Resolvers for the Implementation Tasks emission (#1454).
 *
 *   {{TASKS_SECTION_EMIT:<phase>}}     — per-skill task emission + JSONL write
 *   {{TASKS_SECTION_AGGREGATE}}        — autoplan aggregation across all phases
 *
 * JSONL artifact fields: phase, run_id, branch, commit, id, priority,
 * component, files, effort_human, effort_cc, title, source_finding
 * (consumed by /autoplan's aggregator).
 */

import type { TemplateContext, ResolverFn } from './types';

const VALID_PHASES = new Set(['ceo-review', 'design-review', 'eng-review', 'devex-review']);

export const generateTasksSectionEmit: ResolverFn = (_ctx: TemplateContext, args?: string[]) => {
  const phase = args?.[0];
  if (!phase || !VALID_PHASES.has(phase)) {
    throw new Error(`TASKS_SECTION_EMIT requires one of ${[...VALID_PHASES].join(', ')} — got ${phase}`);
  }
  const ceo = _ctx.skillName === 'plan-ceo-review';
  const conditionalWrites = ceo || _ctx.skillName === 'plan-eng-review';
  const storagePolicy = ceo ? 'Step 0 storage policy' : 'Review record and write policy';

  return `## Implementation Tasks(実装タスク)

${ceo ? `承認されたレビューの深さの範囲で、発見事項をタスクに変換します。実装可能なタスクは
構築内容を記述します。戦略のみのタスクは、次のリサーチ・設計・検証のアクションとその担当者を
明示し、実装上の契約は決めません。
ファイルは判明しているものだけを列挙します。不明なファイルは "to be determined" と書き、
JSONL の files 配列は空にします。各タスクには具体的な検証ステップが必要です。` : `このレビューを終える前に、上記の発見事項を、構築に着手できるタスクのフラットなリストにまとめます。
各タスクは特定の発見事項から導きます。水増しはしません。`}
${conditionalWrites ? `markdown セクションは必ず出力します。\`/autoplan\` 用の JSONL アーティファクトは、${storagePolicy} が許可する場合にのみ書き込みます。許可されない場合は、完全なタスク出力に「未永続化」と明記し、集約アーティファクトが存在するとは主張しないでください。` : 'markdown セクションを出力し、さらに `/autoplan` がフェーズをまたいで\n集約できる JSONL アーティファクトを書き込みます。'}

### markdown セクション(常に出力)

\`\`\`markdown
## Implementation Tasks
Synthesized from this review's findings. Each task derives from a specific
finding above. Run with Claude Code or Codex; checkbox as you ship.

- [ ] **T1 (P1, human: ~2h / CC: ~15min)** — <component> — <imperative title>
  - Surfaced by: <section name> — <specific finding text or line reference>
  - Files: <paths to touch>
  - Verify: <test command or manual check>
- [ ] **T2 (P2, human: ~30min / CC: ~5min)** — ...
\`\`\`

ルール:
- P1 は出荷をブロックします。P2 は同じブランチで取り込むべきです。P3 はフォローアップの TODO です。
- 発見事項から実行可能なタスクが生まれなかった場合は、でっち上げないでください。
- セクションの発見事項がゼロだった場合は、次を出力します: \`_No new tasks from <section>._\`
- 人間チームと CC+gstack の工数見積もりの両方を示します。タスク種別ごとの既定の比率(人間 ÷ CC の時間): スキャフォールディング ~100x、テスト ~50x、機能 ~30x、リグレッションテスト付きバグ修正 ~20x、アーキテクチャ ~5x、リサーチ ~3x。実際の作業に合わせて調整し、前提を明記してください。

### JSONL の成果物(${conditionalWrites ? '許可されている場合に書き込む(タスクがゼロでも)' : 'タスクがゼロでも常に書き込む'})

\`/autoplan\` はこのファイルを読んでフェーズをまたいで集約します。各行は
\`jq -nc\` で組み立て、引用符・改行・バックスラッシュを含むタイトルや元の発見事項も
正しくシリアライズされるようにします。手書きの \`echo\` / \`printf\` は決して使わないでください。

\`\`\`bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "\${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
TASKS_DIR="$GSTACK_STATE_ROOT/projects/\${SLUG:-unknown}"
mkdir -p "$TASKS_DIR"
TASKS_FILE="$TASKS_DIR/tasks-${phase}-$(date +%Y%m%d-%H%M%S).jsonl"
COMMIT=$(git rev-parse HEAD 2>/dev/null || echo unknown)
# The task record keeps the raw git branch; artifact filenames keep gstack-slug's sanitized BRANCH.
GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$$"

# このレビューで特定したタスク 1 件につき jq 呼び出しを 1 回繰り返します。
# プレースホルダーは、タスクごとに設定するシェル変数で置き換えます:
#   TASK_ID (T1, T2, ...), PRIORITY (P1/P2/P3), COMPONENT, TITLE,
#   SOURCE_FINDING, EFFORT_HUMAN, EFFORT_CC, FILES_JSON (a JSON array literal
#   like '["browse/src/sanitize.ts","browse/src/server.ts"]').
jq -nc \\
  --arg phase '${phase}' \\
  --arg run_id "$RUN_ID" \\
  --arg branch "$GIT_BRANCH" \\
  --arg commit "$COMMIT" \\
  --arg id "$TASK_ID" \\
  --arg priority "$PRIORITY" \\
  --arg component "$COMPONENT" \\
  --arg effort_human "$EFFORT_HUMAN" \\
  --arg effort_cc "$EFFORT_CC" \\
  --arg title "$TITLE" \\
  --arg source_finding "$SOURCE_FINDING" \\
  --argjson files "$FILES_JSON" \\
  '{phase:$phase, run_id:$run_id, branch:$branch, commit:$commit, id:$id, priority:$priority, component:$component, files:$files, effort_human:$effort_human, effort_cc:$effort_cc, title:$title, source_finding:$source_finding}' \\
  >> "$TASKS_FILE"
\`\`\`

\`jq\` がインストールされていない場合は、JSONL の書き込みをスキップし、
autoplan の集約のために jq をインストールするようユーザーに警告します。JSONL を手書きしてはいけません。

${conditionalWrites ? '書き込みが許可されていてタスクが 1 件も特定されなかった場合は、JSONL ファイルを touch します' : 'このレビューでタスクが 1 件も特定されなかった場合でも、JSONL ファイルを touch します'}
(\`: > "$TASKS_FILE"\`)。これにより、集約処理はこのフェーズが今回の実行で出力を生成したことを認識できます
(空のファイルは「実行したが発見事項なし」を意味し、「未実行」とは区別されます)。
`;
};

export const generateTasksSectionAggregate: ResolverFn = (_ctx: TemplateContext) => {
  return `## Implementation Tasks aggregator(実装タスクの集約)

以下の Final Approval Gate の出力ブロックを描画する前に、各レビュースキルが書き込んだ
フェーズごとのタスクリストを集約します。

\`\`\`bash
GSTACK_STATE_ROOT=$(~/.claude/skills/gstack/bin/gstack-paths --get GSTACK_STATE_ROOT); : "\${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
BRANCH=$(~/.claude/skills/gstack/bin/gstack-slug --get BRANCH 2>/dev/null)
SLUG=$(~/.claude/skills/gstack/bin/gstack-slug --get SLUG 2>/dev/null)
TASKS_DIR="$GSTACK_STATE_ROOT/projects/\${SLUG:-unknown}"
BRANCH=$(git branch --show-current 2>/dev/null || echo unknown)
# Commit window: last 5 commits on this branch. Drops stale standalone reviews.
COMMITS_RECENT=$(git log --format=%H -n 5 2>/dev/null | tr '\\n' '|' | sed 's/|$//')

AGGREGATED_TASKS=""
if command -v jq >/dev/null 2>&1; then
  # All 4 phases, scoped to this branch + commit window; latest run_id per
  # phase; exact dedupe by (component, sorted(files), title); P1 > P2 > P3, then phase order.
  ALL_JSONL=$(mktemp -t autoplan-tasks.XXXXXXXX)
  for phase in ceo-review design-review eng-review devex-review; do
    # find, not a glob: zsh nomatch errors when a phase wrote no JSONL. Sorted for stable order.
    while IFS= read -r f; do
      [ -f "$f" ] || continue
      # .commit is bound BEFORE the pipe: a pipe rebinds jq's context, so a bare
      # .commit after it indexes the array, every line errors, and the aggregate is empty.
      jq -c --arg branch "$BRANCH" --arg commits "$COMMITS_RECENT" \\
        '.commit as $c | select(.branch == $branch and ($commits | split("|") | index($c) != null))' \\
        "$f" 2>/dev/null >> "$ALL_JSONL" || true
    done < <(find "$TASKS_DIR" -maxdepth 1 -name "tasks-$phase-*.jsonl" 2>/dev/null | sort)
    # Latest run_id per phase
    if [ -s "$ALL_JSONL" ]; then
      jq -sc --arg phase "$phase" \\
        '[.[] | select(.phase == $phase)] | (max_by(.run_id) // null) as $latest_run | if $latest_run then map(select(.run_id == $latest_run.run_id)) else [] end | .[]' \\
        "$ALL_JSONL" > "$ALL_JSONL.phase" 2>/dev/null || true
      jq -c --arg phase "$phase" 'select(.phase != $phase)' "$ALL_JSONL" > "$ALL_JSONL.other" 2>/dev/null || true
      cat "$ALL_JSONL.other" "$ALL_JSONL.phase" > "$ALL_JSONL"
      rm -f "$ALL_JSONL.phase" "$ALL_JSONL.other"
    fi
  done

  # Exact-match dedupe; non-matches stay separate (the renderer marks possible duplicates).
  AGGREGATED_TASKS=$(jq -s \\
    'group_by([.component, (.files | sort), .title])
     | map(
         # Highest priority per group; tie-break by phase order
         sort_by({P1:0,P2:1,P3:2}[.priority] // 99, {"ceo-review":0,"design-review":1,"eng-review":2,"devex-review":3}[.phase] // 99) | .[0]
       )
     | sort_by({P1:0,P2:1,P3:2}[.priority] // 99, {"ceo-review":0,"design-review":1,"eng-review":2,"devex-review":3}[.phase] // 99)
     | if length == 0 then "_No actionable tasks emitted from any phase._" else
         map("- [ ] **\\(.id) (\\(.priority), human: \\(.effort_human) / CC: \\(.effort_cc)) — \\(.component)** — \\(.title)\\n  - Surfaced by: \\(.phase) — \\(.source_finding)\\n  - Files: \\(.files | join(", "))") | join("\\n")
       end' "$ALL_JSONL" 2>/dev/null | sed 's/^"//;s/"$//;s/\\\\n/\\n/g')
  rm -f "$ALL_JSONL"
else
  AGGREGATED_TASKS="_jq not installed — install jq to aggregate per-phase task lists. Skipping._"
fi
\`\`\`

以下の Final Approval Gate の出力テンプレートでは、集約した markdown を
\`### Implementation Tasks (aggregated across phases)\` セクションに描画します。
メッセージを表示する前に、実行時に \`$AGGREGATED_TASKS\`(上記の bash 変数)を代入してください。
これは gen-skill-docs のプレースホルダーではありません。

\`$AGGREGATED_TASKS\` が空の場合(JSONL ファイルが見つからない、つまりこのセッションでレビュースキルが 1 つも実行されていない場合)は、次を描画します:

\`_ブランチ $BRANCH のフェーズ別タスクリストが $TASKS_DIR に見つかりません。各レビュー
スキルが自分のリストを書き出します。実行したのにここにリストが出ない場合は、
jq がインストールされているか、tasks-<phase>-*.jsonl ファイルがあるかを確認してください。_\`
`;
};
