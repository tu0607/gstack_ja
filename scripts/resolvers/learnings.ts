/**
 * Learnings resolver — cross-skill institutional memory
 *
 * Learnings are stored per-project at ~/.gstack/projects/{slug}/learnings.jsonl.
 * Each entry is a JSONL line with: ts, skill, type, key, insight, confidence,
 * source, branch, commit, files[].
 *
 * Storage is append-only. Duplicates (same key+type) are resolved at read time
 * by gstack-learnings-search ("latest winner" per key+type).
 *
 * Cross-project discovery is opt-in. The resolver asks the user once via
 * AskUserQuestion and persists the preference via gstack-config.
 */
import type { TemplateContext } from './types';
import { getHostConfig } from '../../hosts/index';

// Whitelist for query= macro values. Allows alphanumeric, space, hyphen, underscore.
// Anything else (e.g. $, backticks, quotes, ;) is a shell-injection vector when the
// emitted bash interpolates the value into `--query "${queryArg}"`. Static template
// queries hand-written in gstack are safe, but the resolver API must defend against
// future contributors writing dangerous values.
const QUERY_SAFE_RE = /^[A-Za-z0-9 _-]+$/;

/**
 * B5 (#2790): run a learnings search with its stdout intact and its stderr and
 * exit status kept, so a missing bun or a failed script prints why instead of
 * reading as "nothing recorded". Two lines: the capture, then the verdict.
 */
export const learningsCapture = (command: string) => `{ _LE=$(${command} 2>&1 >&3 3>&-); _LR=$?; } 3>&1`;
export const LEARNINGS_VERDICT = `[ "$_LR" = 0 ] || { _LE=\${_LE%%$'\\n'*}; echo "LEARNINGS: unavailable (\${_LE:-exit $_LR})"; }`;

export function generateLearningsSearch(ctx: TemplateContext, args?: string[]): string {
  // Parse query= arg. Empty value falls through to no-query (principle of least surprise:
  // a stray {{LEARNINGS_SEARCH:query=}} placeholder gets today's behavior, not a build error).
  const queryArg = (args || [])
    .filter(a => a.startsWith('query='))
    .map(a => a.slice(6))
    .filter(Boolean)[0];
  if (queryArg && !QUERY_SAFE_RE.test(queryArg)) {
    throw new Error(
      `{{LEARNINGS_SEARCH:query=...}} value must match ${QUERY_SAFE_RE} (alphanumeric, space, hyphen, underscore). Got: ${JSON.stringify(queryArg)}`
    );
  }
  const queryFlag = queryArg ? ` --query "${queryArg}"` : '';
  const findingKind = ctx.skillName === 'qa' || ctx.skillName === 'qa-only' ? 'QA' : 'review';

  if (ctx.skillName === 'qa-only') {
    return `## Prior Learnings(過去の学び)

このプロジェクトの既存の learnings.jsonl は、そのディレクトリがすでに分かっていて、
呼び出し元が Read を許可している場合にのみ読みます。そうでなければ、この任意の参照はスキップします。
${queryArg ? `"${queryArg}" に一致するメモを探します。\n` : ''}ここでは gstack-learnings-search を実行しません。slug ヘルパーがキャッシュを更新することがあるためです。
設定の変更、プロジェクト横断検索の有効化、learning ストアの作成は行いません。

古いメモは証明ではなく手がかりとして扱います。QA の指摘が過去の学びに一致した場合は、
「過去の学びを適用: [key](確信度 N/10、[date] から)」と引用し、
現在の挙動を検証します。古いメモを読むために、新しいメモを書く必要はありません。`;
  }

  if (getHostConfig(ctx.host).learningsMode === 'basic') {
    // Basic learnings mode (host config learningsMode: 'basic' — every host
    // except claude and factory): simpler version, no cross-project prompt,
    // uses $GSTACK_BIN (all basic hosts are env-var hosts)
    return `## Prior Learnings(過去の学び)

このプロジェクトの過去のセッションから、関連する学びを検索します:

\`\`\`bash
${learningsCapture(`$GSTACK_BIN/gstack-learnings-search --limit 10${queryFlag}`)}
${LEARNINGS_VERDICT}
\`\`\`

学びが見つかった場合は、分析に取り入れます。${findingKind} の指摘が過去の学びに
一致した場合は、「過去の学びを適用: [key](確信度 N、[date] から)」と記します。`;
  }

  return `## Prior Learnings(過去の学び)

過去のセッションから関連する学びを検索します:

\`\`\`bash
_CROSS_PROJ=$(${ctx.paths.binDir}/gstack-config get cross_project_learnings 2>/dev/null || echo "unset")
echo "CROSS_PROJECT: $_CROSS_PROJ"
if [ "$_CROSS_PROJ" = "true" ]; then
  ${learningsCapture(`${ctx.paths.binDir}/gstack-learnings-search --limit 10${queryFlag} --cross-project`)}
else
  ${learningsCapture(`${ctx.paths.binDir}/gstack-learnings-search --limit 10${queryFlag}`)}
fi
${LEARNINGS_VERDICT}
\`\`\`

\`CROSS_PROJECT\` が \`unset\`(初回)の場合: ${ctx.skillName === 'plan-eng-review' ? 'プリアンブルの形式に従い、これらの事実と選択肢から完全な判断ブリーフを作成し、質問して待ちます:' : 'AskUserQuestion を使います:'}

> gstack は、このマシン上の他のプロジェクトの学びを検索して、ここに当てはまりそうな
> パターンを見つけることができます。これはローカルで完結します(データがマシンの外に出ることはありません)。
> 個人開発者におすすめです。複数のクライアントのコードベースを扱っていて、
> 相互汚染が懸念される場合は、スキップしてください。

選択肢:
- A) プロジェクト横断の学びを有効にする(推奨)
- B) 学びをプロジェクト内に限定する

A の場合: \`${ctx.paths.binDir}/gstack-config set cross_project_learnings true\` を実行します
B の場合: \`${ctx.paths.binDir}/gstack-config set cross_project_learnings false\` を実行します

その後、適切なフラグを付けて検索を再実行します。

学びが見つかった場合は、分析に取り入れます。${findingKind} の指摘が過去の学びに
一致した場合は、次のように表示します:

**「過去の学びを適用: [key](確信度 N/10、[date] から)」**

これにより、学びが積み重なっていく様子が見えるようになります。ユーザーには、gstack が
時間とともにそのコードベースについて賢くなっていることが伝わるはずです。`;
}

export function generateLearningsLog(ctx: TemplateContext): string {
  const binDir = ctx.paths.binDir; // env-var hosts already resolve to $GSTACK_BIN via types.ts

  return `## Capture Learnings(学びの記録)

このセッション中に、自明ではないパターン、落とし穴、アーキテクチャ上の知見を発見した場合は、
今後のセッションのために記録します:

\`\`\`bash
${binDir}/gstack-learnings-log '{"skill":"${ctx.skillName}","type":"TYPE","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"SOURCE","files":["path/to/relevant/file"]}'
\`\`\`

**Types:** \`pattern\`(再利用できるアプローチ)、\`pitfall\`(やってはいけないこと)、\`preference\`
(ユーザーが述べたもの)、\`architecture\`(構造上の決定)、\`tool\`(ライブラリ/フレームワークの知見)、
\`operational\`(プロジェクト環境/CLI/ワークフローの知識)。

**Sources:** \`observed\`(コード内で見つけた)、\`user-stated\`(ユーザーが伝えた)、
\`inferred\`(AI の推論)、\`cross-model\`(Claude と Codex の両方が一致)。

**Confidence:** 1〜10。正直に付けます。コードで検証した観察済みのパターンは 8〜9 です。
確信のない推論は 4〜5 です。ユーザーが明示的に述べた好みは 10 です。

**files:** この学びが参照している具体的なファイルパスを含めます。これにより
陳腐化の検出が可能になります。それらのファイルが後で削除された場合、その学びにフラグを立てられます。

**本当の発見だけを記録します。** 自明なことは記録しません。ユーザーがすでに知っていることも
記録しません。良い判断基準は、この知見が今後のセッションで時間の節約になるかどうかです。なるなら記録します。`;
}
