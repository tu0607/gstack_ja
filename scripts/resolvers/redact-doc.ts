/**
 * redact-doc — resolvers for the shared redaction docs + invocation bash.
 *
 *   {{REDACT_TAXONOMY_TABLE}}            → markdown table of the 3-tier taxonomy,
 *                                          derived from lib/redact-patterns so /spec
 *                                          and /cso never drift from the engine.
 *   {{REDACT_INVOCATION_BLOCK:<sink>}}   → the canonical scan-at-sink bash + prose
 *                                          for one enforcement point. <sink> is a
 *                                          hyphenated label: pre-codex, pre-archive,
 *                                          pre-commit.
 *
 * PR, MR and issue text has no sink here: bin/gstack-post scans the exact
 * bytes it sends and refuses HIGH itself (CEO-19), so those sites carry no
 * separate scan.
 *
 * DRY: every skill writes one placeholder per enforcement point; UX/threshold
 * changes land here once. test/redact-doc-resolver.test.ts golden-pins the output.
 */
import { toShellPath, type TemplateContext } from './types';
import { FREE_TEXT_DIR } from './free-text-file';

interface SinkSpec {
  /** What is being scanned, for the prose. */
  noun: string;
  /** What HIGH blocks, in this skill's verbs. */
  blockVerb: string;
}

const SINKS: Record<string, SinkSpec> = {
  'pre-codex': { noun: 'spec 本文', blockVerb: '外部レビュアーへのディスパッチ' },
  'pre-archive': { noun: 'アーカイブされる直前の本文', blockVerb: 'アーカイブの書き込み' },
  'pre-commit': { noun: 'コミットされる直前の生成ドキュメント', blockVerb: 'コミット' },
};
const UNKNOWN_SINK: SinkSpec = { noun: '送信される直前のテキスト', blockVerb: '送信' };

export function generateRedactInvocationBlock(ctx: TemplateContext, args?: string[]): string {
  const sinkLabel = args?.[0] ?? 'unknown';
  const brief = args?.[1] === 'brief';
  const sink = SINKS[sinkLabel] ?? UNKNOWN_SINK;
  const bin = `${ctx.paths.binDir}/gstack-redact`;
  const outsideGate = sinkLabel === 'pre-codex';
  const scan = `REDACT_JSON=$(${outsideGate ? `"${toShellPath(bin)}"` : bin} --from-file "$REDACT_FILE" --repo-visibility "$REDACT_VIS" --self-email "$(git config user.email 2>/dev/null)" --json)`;
  // This sink can dispatch a model and then publish/archive the same spec.
  // Keep its stop decision in executable shell, even when the caller runs
  // without errexit. MEDIUM must pause for its existing user decision.
  const scanAndGate = outsideGate ? `if ${scan}; then REDACT_CODE=0; else REDACT_CODE=$?; fi
case "$REDACT_CODE" in
  0) ;; # Only a successful scan may reach an outside or downstream sink.
  2)
    printf '%s\\n' "$REDACT_JSON"
    printf 'REDACT_FILE: %s\\n' "$REDACT_FILE"
    echo 'Redaction requires the MEDIUM disposition below; outside dispatch and downstream persistence are paused.' >&2
    exit 2 ;;
  3)
    printf '%s\\n' "$REDACT_JSON"
    rm -f "$REDACT_FILE"
    echo 'HIGH redaction finding: outside dispatch and downstream persistence blocked. Redact at source and rescan; no skip.' >&2
    exit 3 ;;
  *)
    rm -f "$REDACT_FILE"
    echo "Redaction scan failed (exit $REDACT_CODE); refusing outside dispatch and downstream persistence." >&2
    exit 1 ;;
esac` : `${scan}\nREDACT_CODE=$?`;

  // Brief variant: a compact pointer for repeat sinks, so the full ~40-line
  // procedure ships once per skill, not once per enforcement point.
  if (brief) {
    return `#### リダクションスキャン — ${sinkLabel} (${sink.noun})

上で示した scan-at-sink の手順と同じものを実行します(\`$REDACT_VIS\` は一度だけ解決して
再利用します。前回のスキャン以降に${sink.noun}が変わった場合は、ファイル書き込みツールで同じ \`$REDACT_FILE\` を
書き直します。\`${bin} --from-file "$REDACT_FILE"
--repo-visibility "$REDACT_VIS" --json\`)。今回の対象は${sink.noun}です。同じ
exit-3/2/0 の処理を適用します。exit 3 の場合は${sink.blockVerb}を行ってはいけません。HIGH にスキップはありません。
スキャンしたバイト列と送信するバイト列が一致するよう、同じ \`$REDACT_FILE\` を下流に渡します。`;
  }

  return `#### リダクションスキャン — ${sinkLabel} (${sink.noun})

送信される「まさにそのバイト列」に対して scan-at-sink を行います。そのバイト列は、ファイル書き込みツールで
書いたプライベートファイルにあり、スキャンはそのファイルを読み、同じファイルが下流へ渡されます。
文字列をスキャンしてから再描画してはいけません。また、テキストをシェルコマンドの中に入れてはいけません。
\`<redact-file-name>\` は、出力されたファイル名で置き換えてください。

\`\`\`bash
${outsideGate ? 'command -v bun >/dev/null 2>&1 || { echo "ERROR: bun unavailable — refusing unscanned outside dispatch." >&2; exit 1; }' : 'command -v bun >/dev/null 2>&1 || echo "redaction scan skipped — bun not on PATH"'}
# Resolve visibility once; cache + reuse. Order: local config (~/.gstack, never
# committed) → gh → glab → unknown(=public-strict).
REDACT_VIS=$(~/.claude/skills/gstack/bin/gstack-config get redact_repo_visibility 2>/dev/null)
[ -z "$REDACT_VIS" ] && REDACT_VIS=$(gh repo view --json visibility -q .visibility 2>/dev/null | tr 'A-Z' 'a-z')
[ -z "$REDACT_VIS" ] && REDACT_VIS=$(glab repo view -F json 2>/dev/null | grep -o '"visibility":"[^"]*"' | head -1 | sed 's/.*:"//;s/"//' | tr 'A-Z' 'a-z')
REDACT_VIS="\${REDACT_VIS:-unknown}"
REDACT_FILE=${FREE_TEXT_DIR.slice(0, -1)}/<redact-file-name>"
[ -s "$REDACT_FILE" ] || { echo "ERROR: $REDACT_FILE is missing or empty — write ${sink.noun} into it first; refusing to send it unscanned." >&2; exit 1; }
${scanAndGate}
\`\`\`

${outsideGate ? 'シェルは HIGH、MEDIUM、またはスキャナー失敗の時点で既に停止しています。MEDIUM の場合は、出力された REDACT_FILE を以下の判断が出るまで保持します。編集/自動リダクションして再スキャンする、キャンセルしてファイルを削除する、または明示的に許可された承認の後にのみ再開する、のいずれかです。停止したシェルでは下流のコマンドは一切実行されません。クリーンなスキャンでは、承認された送信先のために、スキャンしたものと同じファイルを保持します。\n\n' : ''}\`$REDACT_CODE\` で分岐します:

1. **Exit 3 (HIGH)** — 検出結果を表示します。${sink.blockVerb}を行ってはいけません。ユーザーに、
   認証情報のローテーションと元データでのリダクションを行ってから再実行するよう伝えます。HIGH にスキップフラグはありません。
   ${sink.noun}をどこにも永続化してはいけません。
2. **Exit 2 (MEDIUM)** — 検出ごとに AskUserQuestion で質問します(同一 id はまとめます。PUBLIC の
   リポジトリではより厳しい文言にし、一括承認や黙って進めることはしません)。PII のサブセット
   (\`pii.email\`/\`pii.phone.e164\`/\`pii.ssn\`/\`pii.cc\`)には **Auto-redact**(\`--auto-redact <ids>\` で再実行し、
   出力されたサニタイズ済みの本文を使う)/ **Edit** / **Cancel** を提示します。
   PII 以外の MEDIUM には **Proceed (acknowledged)** / **Edit** / **Cancel** を提示します(自動リダクションなし)。
3. **Exit 0 (clean)** — 続行します。\`WARN\`(tool-fence の劣化)と \`LOW\` は、
   1 行の FYI として表示します(ブロックはしません)。

${outsideGate ? '承認された送信先がファイルを消費した後、またはユーザーがキャンセルした場合に、クリーンアップします(ディスパッチがスキャン済みのバイト列を読む前には決して行いません):\n\n' : ''}\`\`\`bash
rm -f "$REDACT_FILE"
\`\`\`

ガードレールであり、厳密な強制ではありません。\`gh\`/\`git\` を直接使えば回避できます。これは事故を防ぐためのものです。`;
}
