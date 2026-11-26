import type { TemplateContext } from './types';

// テストの価値の基準。plan-eng-review と ship(カバレッジ監査経由)、
// qa/qa-only({{TEST_VALUE_BAR:qa}})、test-audit({{TEST_VALUE_BAR:audit}})が共有する。
// 静的な review/specialists/testing.md はこれらの定数を繰り返し、
// test/test-value-bar.test.ts が同期を保つ。
// openclaw/openclaw@a214e76 の .agents/skills/test-audit/SKILL.md を元にしている。

export const TEST_VALUE_BAR_MODES = ['plan', 'ship', 'qa', 'audit'] as const;
export type TestValueBarMode = (typeof TEST_VALUE_BAR_MODES)[number];

export const QUESTIONS = [
  'どんな観測可能な振る舞い、不変条件、独立した契約を守るか。',
  'どんな確かなリグレッションで失敗するか。',
  '既存のカバレッジがそれをまだ捕まえていないのはなぜか。ほぼ重複するテストを作るより、既存のテーブル駆動テストや共有フィクスチャに行を足すことを優先する。',
  '本番の呼び出し元が誰も必要としない本番の継ぎ目(export、フラグ、ラッパー、注入フック)を必要とするか。必要とするなら、代わりに本物の境界でテストする。',
] as const;

export const VALUE_CARD_FIELDS = ['protects', 'fails_when', 'why_new', 'seam'] as const;
/** 任意の 5 番目のフィールド。green が証明しないことと、どのフィクスチャやモックが何の代役かを 1 文で書く。 */
export const VALUE_CARD_OPTIONAL_FIELD = 'no_claim';
export const NO_CLAIM_EXAMPLES = ['provider の受け入れ(provider はモック。ユニットのみ)', 'protects 以外は主張しない'] as const;
export const CARD_FIELD_MAX_BYTES = 160;

export const CATALOG = [
  'assert のないカバレッジ探り',
  '自己比較と同一コピー',
  'コピーしたフィクスチャ、一覧、export リスト',
  '宣言された契約ではない、ソース、import、文字列の厳密な grep',
  '本物の境界でも重複している、private な述語や呼び出し形状のテスト',
  '同じ契約の重複した呼び出し',
  '共有ヘルパーのテストを呼び出し元ごとに再生したもの',
  'テスト専用の export、グローバル、ラッパーを生かしておくことだけが目的のテスト',
  '呼び出し元がテストだけの本番コード',
] as const;

export const RETIREMENT_FIELDS = ['test', 'detects', 'non_test_callers', 'search_command', 'stronger_proof', 'history', 'unlocks', 'validation'] as const;
export const REVIEW_EVIDENCE_FIELDS = ['detects', 'non_test_callers', 'search_command', 'stronger_proof'] as const;
export const REASON_CODES = ['duplicate_protects', 'needs_seam', 'incomplete_card', 'no_credible_regression', 'covered_elsewhere', 'implementation_coupled'] as const;
export const WEAK_REASONS = ['star_one', 'gate_failed', 'unrated'] as const;
export const PRAGMA = 'gstack:test-value keep';
export const SWEEP_POINTER = 'リポジトリ全体の一掃: /test-audit を実行する。';

export const RETENTION_ONE_LINER = '保持の基準: 公開 API、プロトコル、設定、マイグレーション、ストレージ、セキュリティ、プラットフォーム、既定値、プロンプトのバイト列、生成された出力(ゴールデン)、パッケージ、リリース、アーキテクチャの契約を独立に強制しているテストは残す。静的であること、遅いことは削除の理由にならない。';

export const CALLER_SEARCH_COMMAND = "git grep -n -F -w -e '<symbol>' -- . ':!test/' ':!tests/' ':!spec/' ':!**/__tests__/**' ':!**/*.test.*' ':!**/*.spec.*' ':!**/*_test.*' ':!**/test_*.py'";
export const CALLER_SYMBOL_PATTERN = '^[A-Za-z_][A-Za-z0-9_]*$';

export const DOCS_PAGE = 'docs/test-value-bar.md';

export const MESSAGES = {
  ratingUnavailable: {
    message: 'rating unavailable: 読み取り専用の評価ディスパッチが失敗またはタイムアウトしたため、この実行ではカバレッジゲートをスキップします。テストを再評価するには Step 7 を再実行してください。',
    anchor: 'rating-unavailable',
  },
  valueCoverageUnavailable: {
    message: 'value-weighted coverage unavailable(インストール済みのスキルが古い); /gstack-upgrade を実行してください。この実行のゲートは coverage_pct(任意のテスト)を使いました。',
    anchor: 'value-weighted-coverage-unavailable',
  },
  inconsistentCoverage: {
    message: 'inconsistent coverage inputs: coverage_pct_value が coverage_pct を上回っていたため、coverage_pct に丸めました。数値がおかしく見える場合は Step 7 を再実行してください。',
    anchor: 'inconsistent-coverage-inputs',
  },
  malformedKey: {
    message: 'malformed <key> ignored: 監査が誤った型を返したため、空として数えます。原因はインストール済みのスキルが古いことの可能性が高いです。/gstack-upgrade を実行してください。',
    anchor: 'malformed-key-ignored',
  },
  allRejected: {
    message: 'all <N> generated tests rejected by machine checks: 理由は tests_rejected を参照してください。ゲートは、変わらない value-weighted coverage で続行します。',
    anchor: 'all-generated-tests-rejected',
  },
  baseControlUnavailable: {
    message: 'base control unavailable: <reason>。HEAD で失敗するという結果は有効なままです。手で確認するには、`git worktree add --detach <tmp> <base>` を実行し、テストと新しいフィクスチャを同じパスにコピーし、<tmp> で検出したテストコマンドを実行して、`git worktree remove --force <tmp>` で片付けます。その後、`passes at base: manual` と報告してください。',
    anchor: 'base-control-unavailable',
  },
  callerCheckUnavailable: {
    message: 'caller check unavailable: <command or "unsupported symbol">。この指摘は INFORMATIONAL のままで、削除は提案しません。証拠を完成させるには、検索を手で実行してください。',
    anchor: 'caller-check-unavailable',
  },
  unknownMode: {
    message: 'Unknown TEST_VALUE_BAR mode <x>; expected plan|ship|qa|audit. プレースホルダーを直すか、scripts/resolvers/test-value.ts にそのモードを追加してください。',
    anchor: 'unknown-test-value-bar-mode',
  },
} as const;

export type MessageKey = keyof typeof MESSAGES;

export function degradedMessage(ctx: TemplateContext, key: MessageKey): string {
  const { message, anchor } = MESSAGES[key];
  return `${message} (see ${ctx.paths.skillRoot}/${DOCS_PAGE}#${anchor})`;
}

export function generateTestValueMessage(ctx: TemplateContext, args?: string[]): string {
  const key = args?.[0] ?? '';
  if (!(key in MESSAGES)) throw new Error(`Unknown TEST_VALUE_MESSAGE key ${key}; expected ${Object.keys(MESSAGES).join('|')} (scripts/resolvers/test-value.ts)`);
  return degradedMessage(ctx, key as MessageKey);
}

// 実測した描画サイズに 15% を加えた値: plan 3266、ship 4411、qa 1877、audit 5636 バイト。
// 日本語の本文は UTF-8 で 1 文字 3 バイトになるため、英語版の上限(plan 2555、ship 3526、
// qa 1548、audit 4642)から引き上げた。基準を肥大させないための上限は変わらず維持している。
export const TEST_VALUE_BAR_MAX_BYTES: Record<TestValueBarMode, number> = { plan: 3756, ship: 5073, qa: 2159, audit: 6482 };

export function clampCardField(value: string): string {
  const bytes = Buffer.from(value, 'utf8');
  if (bytes.length <= CARD_FIELD_MAX_BYTES) return value;
  let end = CARD_FIELD_MAX_BYTES - 3;
  while (end > 0 && (bytes[end]! & 0xc0) === 0x80) end--;
  return `${bytes.subarray(0, end).toString('utf8')}...`;
}

export type ValueCard = Record<(typeof VALUE_CARD_FIELDS)[number], string> & { [VALUE_CARD_OPTIONAL_FIELD]?: string };

export function renderValueCard(card: ValueCard): string {
  const fields: string[] = [...VALUE_CARD_FIELDS];
  if (card.no_claim !== undefined) fields.push(VALUE_CARD_OPTIONAL_FIELD);
  return `Value: ${fields.map(field => `${field}=${clampCardField(card[field as keyof ValueCard]!)}`).join('; ')}`;
}

const EXAMPLE_CARD = renderValueCard({
  protects: 'refundPayment は空の reason を拒否する',
  fails_when: 'reason のガードが外れるか反転する',
  why_new: 'billing.test.ts は processPayment しかカバーしていない',
  seam: 'none',
  no_claim: NO_CLAIM_EXAMPLES[0],
});

const EXAMPLE_REJECTED = 'Rejected (covered_elsewhere): "checkout renders"; checkout.e2e.ts:15 がすでにカバーしているので、そのテストを拡張する。';

function questionList(mode: TestValueBarMode): string {
  const questions = mode === 'qa' ? QUESTIONS.slice(2) : QUESTIONS;
  return questions.map((question, index) => `${index + 1}. ${question}`).join('\n');
}

function cardRules(mode: TestValueBarMode, skillName: string): string {
  const where = {
    plan: 'Test Plan Artifact の Critical Path と Edge Case ごとに 1 枚のカードを書く。',
    ship: '生成した各テストのヘッダーコメントに、帰属表示の隣へ書く(折り返し、切り詰めない)。既知のコメント構文がない場合は、PR 本文の Test value の詳細に書く。',
    qa: skillName === 'qa-only' ? '提案する各テストの下に書く。' : '8e.5 の記録に書く。',
    audit: 'テストのヘッダーコメントにカードがあれば、そこから読む。',
  }[mode];
  return `価値のカード: \`Value: protects=<...>; fails_when=<...>; why_new=<...>; seam=none; no_claim=<...>\`(seam は \`none\` かその名前。\`no_claim\` は、green が証明しないことと、どのフィクスチャやモックが何の代役かを 1 文で書く。例: \`no_claim=${NO_CLAIM_EXAMPLES[0]}\` または \`no_claim=${NO_CLAIM_EXAMPLES[1]}\`。必須のライブ確認を免除することは決してない)。各フィールドは、ここでは最大 ${CARD_FIELD_MAX_BYTES} UTF-8 バイト(157 バイトに切り詰めて \`...\` を付ける。書き出す JSON は完全な値を保持する)。${where} 上流のカードがなくても止めない。自分で導き出す。未知のフィールドは無視する。

例: ${EXAMPLE_CARD}
${EXAMPLE_REJECTED}`;
}

const STAR_RULE = '弱いテスト(★ のスモーク、存在確認のみ、自明なもの、ゲートに落ちたもの、未評価のもの)はカバレッジに数えない。X = ★★/★★★ のテストがあるパス / 全パス(価値で重み付け。ゲートは X を使う)。Y = 何らかのテストがあるパス / 全パス。';

const WEAK_PATH_RULE = `全パス = diff のコードパスのトレース。最大 30 件で、0 件ならゲートをスキップする。弱いテストしかないパスは、X では未カバー、Y ではカバー済みとなり、\`gaps\` ではなく \`weak_gaps\`(理由 \`${WEAK_REASONS.join('|')}\`)に入る。★ を付けるのは、変更されたパスから到達できるテストだけ。`;

const RED_PROOF = `リグレッションの証明: リグレッションテストは、修正の前に HEAD で、自身の assert によって失敗しなければならない(HEAD で通るならリグレッションのラベルを外す。import、フィクスチャ、環境の失敗はテストの欠陥なので、1 回だけ直すか捨てる)。コントロールとして base では通らなければならず(そこで assert が失敗したなら無効とする。それ以外の失敗は "base control unavailable: collection error")、修正の後でも通らなければならない。記録する書式: \`Regression proof — fails at HEAD: yes · passes at base: yes | unavailable (<reason>) | manual · passes after fix: yes | pending\`。`;

function auditSections(): string {
  return `低価値カタログ(該当するものは、保持の基準がそのテストの守る契約を名指ししない限り、ゲートを失敗させる):
${CATALOG.map(entry => `- ${entry}`).join('\n')}

保持の基準: 公開 API、プロトコル、設定、マイグレーション、ストレージ、セキュリティ、プラットフォーム、既定値、プロンプトのバイト列、生成された出力(SKILL.md のゴールデン)、パッケージ、リリース、アーキテクチャの契約を独立に強制しているテストは残す。呼び出し順序が観測可能ならその順序も残す。ソースの検査が最も安価な独立したガードであれば、それも残す。パッケージのエントリポイントから到達できるもの(\`package.json\` の exports/main、index の再 export)は決して引退させない。静的であること、遅いことは削除の理由にならない。\`${PRAGMA} reason="<why>"\` が付いたテストはスキップし、抑制されたものとして一覧に載せる。

引退のカード。編集の前にすべて埋める: ${RETIREMENT_FIELDS.map(field => `\`${field}\``).join(', ')}。\`${CALLER_SYMBOL_PATTERN}\` に一致するシンボルの呼び出し元チェック(一致しない場合は "caller check unavailable: unsupported symbol"): \`${CALLER_SEARCH_COMMAND}\`。コマンド、除外、ヒット数を記録する。証拠は grep のみ(再 export、動的ディスパッチ、生成されたコードは見えない)なので、本番コードを引退させるのは、使い捨ての worktree でそれを取り除いても、リポジトリの typecheck/build またはデッドコードツールが通る場合に限る。`;
}

export function generateTestValueBar(ctx: TemplateContext, args?: string[]): string {
  const mode = args?.[0] as TestValueBarMode;
  if (!TEST_VALUE_BAR_MODES.includes(mode)) throw new Error(MESSAGES.unknownMode.message.replace('<x>', String(args?.[0])));
  const parts = [
    `**テストの価値の基準。** ${mode === 'qa' ? 'テストを書く、または提案する前に、再現したバグがすでに、何を守るか、何で失敗するかに答えている。次にも答える:' : '4 つの答えがすべて揃っている場合にだけ、テストを提案する、または書く。揃わない場合は、既存のテストを拡張するか、捨てる:'}`,
    questionList(mode),
    cardRules(mode, ctx.skillName),
  ];
  if (mode !== 'qa') parts.splice(2, 0, '振る舞いを保つリファクタリングで壊れるテストは、実装を assert している。正確な出力が宣言された契約である場合(ゴールデン、プロンプトのバイト列、ワイヤーフォーマット)を除き、それを所有する境界で書き直す。');
  if (mode === 'plan') parts.push(`${STAR_RULE} 計算するのは /ship。ここでは、提案するすべてのテストにカードが必要。`, RETENTION_ONE_LINER);
  if (mode === 'ship') parts.push(`${STAR_RULE} ${WEAK_PATH_RULE}`, RETENTION_ONE_LINER);
  if (mode === 'ship' || mode === 'audit') parts.push(RED_PROOF);
  if (mode === 'audit') parts.push(auditSections());
  const rendered = parts.join('\n\n');
  const bytes = Buffer.byteLength(rendered, 'utf8');
  const budget = TEST_VALUE_BAR_MAX_BYTES[mode];
  if (bytes > budget) throw new Error(`TEST_VALUE_BAR mode '${mode}' renders ${bytes} bytes, budget ${budget} (over by ${bytes - budget}). Trim the mode's section in scripts/resolvers/test-value.ts or raise the ceiling with a reason.`);
  return rendered;
}
