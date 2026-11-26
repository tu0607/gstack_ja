/**
 * autoplan/DRIVER.md resolvers (field wave item 13): the compact entry a parent
 * agent on any host reads to drive an unattended /autoplan run through
 * `gstack-autoplan`, instead of autoplan/SKILL.md. Every list comes from code:
 * the phase order (PHASES), the scope flags (SCOPE_FLAG_TOKENS), the run
 * directory files (FILES), the reviewer RESULT FORMAT, the result codes
 * (RESULT_CODES). The command lines and the gate reply forms are stated once
 * here; test/autoplan-driver.test.ts checks them against `gstack-autoplan
 * --help` and the gate parser.
 */
import { FILES } from '../../lib/autoplan-state';
import { PHASES, RESULT_FORMAT } from '../../lib/autoplan-prompts';
import { SCOPE_FLAG_TOKENS } from '../../lib/autoplan-scope';
import { RESULT_CODES } from '../../lib/result-codes';
import { DEFAULT_HOST_ESTIMATE_USD, DEFAULT_MAX_ROUNDS } from '../../lib/autoplan-budget';
import type { ResolverFn } from './types';

/** One entry per command line the loop runs, as the field-wave plan specifies them. */
export const AUTOPLAN_DRIVER_COMMANDS: Array<{ cmd: string; does: string }> = [
  { cmd: 'gstack-autoplan next --out <dir> --plan <plan.md> [scope flags] [--light] [--spend-cap <usd>] [--max-rounds <n>] [--scaffold]', does: `最初の呼び出し: 実行を初期化し、PHASE:、SCOPE:、DRIVER: と、ボイスごとに 1 行の ATTEMPT: を出力します。--max-rounds はフェーズごとのレビューラウンド数の上限です(無人実行のデフォルトは ${DEFAULT_MAX_ROUNDS})。無人の Capy 実行は、--estimate-usd <n> で指定しない限りホストの試行ごとに ${DEFAULT_HOST_ESTIMATE_USD.toFixed(2)} を確保するため、--spend-cap が効きます` },
  { cmd: 'gstack-autoplan next --out <dir> [--redispatch <attempt>]', does: '2 回目以降の呼び出し: 次のフェーズを開く、または未完了の試行を再表示します。自分で再ディスパッチすることはありません' },
  { cmd: 'gstack-autoplan submit --out <dir> --phase <p> --voice native|outside --record <file.md> --model <id> [--attempt <id>]', does: '自由形式のレビュー記録を紐づけます(正規のフェンス、指摘事項の表またはリスト 1 つ、または `No findings.`)' },
  { cmd: 'gstack-autoplan submit ... --record <file.md> --attest "<reason>" --attempt <id>', does: 'INPUT: 行のない記録を receipt: attested として紐づけます(誤った INPUT: は常に拒否されます)' },
  { cmd: 'gstack-autoplan submit --out <dir> --phase <p> --voice native|outside --result <file> --model <id> --attempt <id>', does: '正規の結果を紐づけます(下の RESULT FORMAT)' },
  { cmd: 'gstack-autoplan submit --out <dir> --phase <p> --voice outside --unavailable|--failed "<reason>"', does: '外部ボイスを実行できないとき、ネイティブのみでフェーズを閉じます' },
  { cmd: 'gstack-autoplan answer --out <dir> --gate-rev <n> --reply "<reply>" --by human|agent:<id> [--owner-reply <text>|-] [--rec-hash <h>]', does: '下の返信文法でゲートに回答します。エージェントが回答する場合は、オーナーの言葉をそのまま保存します' },
  { cmd: 'gstack-autoplan recommend --out <dir> --gate-rev <n> --item <id> --option <k> --basis "<why>"', does: '中継の前に推奨を 1 つ変更します。その後、再度レンダリングして中継します(`rec` には新しい `--rec-hash` が必要です)' },
  { cmd: 'gstack-autoplan revise --out <dir> --plan <plan v2> --incorporates <decision ids>', does: '修正したプランを紐づけます。レビュー済みのプランが変わったフェーズをすべて再び開きます(Eng は最後)' },
  { cmd: 'gstack-autoplan revise --out <dir> --settle <decision id|d4>', does: 'プランを編集せずに、パッケージングまたは順序の変更を完了扱いにします。何も再び開きません' },
  { cmd: 'gstack-autoplan revise --out <dir> --withdraw <decision id>', does: '保留中の修正を適用せずに取り下げます' },
  { cmd: 'gstack-autoplan close --out <dir> --phase <p> --deferred "<reason>" --by human|agent:<id>', does: '指摘付き承認でフェーズを閉じます。未解決の指摘は tasks.jsonl に入り、Critical、緊急、ユーザーへの異議の指摘はゲート項目になります。`STOP: reason=budget_exhausted` からの復旧手段でもあります' },
  { cmd: 'gstack-autoplan budget --out <dir> [--spend-cap <usd>] [--max-rounds <n>] --by human|agent:<id>', does: 'オーナーによる上限の引き上げを記録します。予算で停止したあとは、`resume` で実行を続行します' },
  { cmd: 'gstack-autoplan export --out <dir>', does: '成果物一式を書き出します。そのあと `gstack-artifact validate <dir>/run.json` を実行します' },
  { cmd: 'gstack-autoplan export --out <dir> --public <pub>', does: 'コミットや共有のための、マシン固有のパスを含まないコピーです(記録されたルートは書き換え、plan.md のコードは保持し、来歴ダイジェストを付けます)。非公開の実行には手を触れません。そのあと、このマシンで `gstack-artifact validate --public <pub> --private <dir>/run.json` を実行します' },
  { cmd: 'gstack-autoplan status|resume --out <dir>', does: 'マニフェストを読みます(PENDING: 行が未完了の試行を示します)。クラッシュ後は所有権を引き継ぎます(EXECUTION_UNKNOWN が未完了の試行を列挙します)' },
  { cmd: 'gstack-autoplan resume --out <new dir> --from <checkpoint>', does: '最新の有効なチェックポイント世代(GSTACK_AUTOPLAN_CHECKPOINT_DIR)を空のディレクトリに復元して所有権を引き継ぎます。`checkpoints --from <dir>` で一覧できます' },
];

/** The reply grammar `gstack-gate` parses, one form per line. */
export const GATE_REPLY_FORMS: Array<{ reply: string; means: string }> = [
  { reply: 'rec', means: 'すべての項目が推奨を採用します(プラン変更を含み、それぞれ APPLY: を出力します)。`all` は別名です' },
  { reply: 'as-is', means: 'すべての方向性をそのまま維持します。プラン変更はありません' },
  { reply: 'd3b uc1a', means: '設定する項目ごとに <id><option> のトークンを 1 つ指定します。未回答の自動項目はデフォルトを採用します' },
  { reply: 'rec except d3b', means: '推奨を採用し、列挙した項目だけ上書きします' },
];

/** Result codes the loop can print, in the order a run meets them. */
export const DRIVER_CODES = ['RUN_NOT_INITIALIZED', 'PLAN_SECTIONS_INVALID', 'RUN_LOCKED', 'EXECUTION_UNKNOWN', 'SPEND_CAP_EXCEEDED', 'PHASE_NOT_AWAITING', 'ATTEMPT_MISMATCH',
  'RESULT_RECEIPT_MISSING', 'RESULT_FINDINGS_MISSING', 'MODEL_FAMILY_CONFLICT', 'CONSENSUS_MISSING', 'GATE_REV_STALE', 'GATE_REPLY_UNPARSED', 'GATE_REC_STALE', 'OWNER_REPLY_REQUIRED', 'GATE_OWNER_REPLY_MISMATCH', 'PLAN_AMEND_PENDING', 'AMENDMENT_NOT_SETTLEABLE', 'CHECKPOINT_INVALID', 'GSTACK_VERSION_CHANGED'] as const;
/** Fix text for codes the plan specifies and lane B-core adds to lib/result-codes.ts; the table's own fix wins once it exists. */
const PENDING_FIX: Record<string, string> = {
  PLAN_SECTIONS_INVALID: 'プランには `## Implementation plan` と `## Review record` が 1 つずつ必要です。どちらもないプランは `next --scaffold` を再実行して包んでください',
  PLAN_AMEND_PENDING: 'APPLY: 行ごとにプランを編集して `revise --incorporates <ids>` を実行するか、`revise --withdraw <id>` を実行してください',
  GSTACK_VERSION_CHANGED: '通知のみ: この実行は別の gstack で開始されました。前方マイグレーションが実行され、記録されています',
};

export const generateAutoplanDriverPhases: ResolverFn = () => [
  `Order: ${PHASES.join(' → ')}. Design は UI スコープのときだけ、DX は DX スコープのときだけ実行し、Eng は常に最後に実行します。`,
  `最初の \`next\` のスコープフラグ: ${SCOPE_FLAG_TOKENS.map(t => `\`${t}\``).join(', ')}。\`--developer-tool\` と \`--agent-primary\` は DX を有効にするだけです。`,
].join('\n');

export const generateAutoplanDriverCommands: ResolverFn = () =>
  AUTOPLAN_DRIVER_COMMANDS.map(c => `- \`${c.cmd}\`\n  ${c.does}.`).join('\n');

export const generateAutoplanDriverGate: ResolverFn = () =>
  GATE_REPLY_FORMS.map(f => `- \`${f.reply}\`: ${f.means}.`).join('\n');

export const generateAutoplanDriverFiles: ResolverFn = () =>
  `ランナーの状態: ${Object.values(FILES).map(f => `\`${f}\``).join(', ')}.`;

export const generateAutoplanDriverResultFormat: ResolverFn = () =>
  RESULT_FORMAT('<phase>', '<snapshot sha256>', '<result file>').replace(/^\n---\n/, '').trimEnd();

export const generateAutoplanDriverCodes: ResolverFn = () => DRIVER_CODES.map(code => {
  const row = (RESULT_CODES as Record<string, { fix: string }>)[code];
  return `- \`${code}\`: ${row?.fix ?? PENDING_FIX[code]}`;
}).join('\n');
