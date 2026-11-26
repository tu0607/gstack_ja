/**
 * {{IMPLEMENTER_DISPATCH_RULES}} — rules for an implementing child agent.
 *
 * docs/designs/HONEST_WORK_GATE_INTEGRITY.md W7. Rendered into /spec's issue
 * body template (the archived spec is the prompt `/spec --execute` pipes to
 * `claude -p`, so the rules travel inside it) and into the /ship Test Coverage
 * Audit (Step 7) test-generation child prompt, before its LAST-line JSON protocol. One
 * constant so the two cannot drift. The child's JSON contracts are untouched:
 * gate-edit disclosure uses the prose the protocols already permit before the
 * JSON line. test/dispatch-rules.test.ts pins the rendering sites.
 */

export const IMPLEMENTER_DISPATCH_RULES_HEADING = '実装エージェント向けのルール';

export const IMPLEMENTER_DISPATCH_RULES_ITEMS = [
  '受け入れ基準は各テストの `protects / fails_when / no_claim` プロファイルです。守る観測可能な挙動、拒否する誤った結果、そして green が証明しないことを指します。「テストを通す」を基準にしてはいけません。',
  '本物のコードと本物のテストを同じ変更に含めます。プレースホルダー、スタブのアサーション、後続対応に回したテストは完了とみなしません。',
  'テスト、バリデーター、CI ステップ、タイムアウト、許容誤差、しきい値、スナップショット、抑制プラグマの変更は、他のどの結果よりも先に、サマリー内の独立した行で根拠とともに報告します。',
  '報告するコマンドには、コマンド自体と観測した結果(終了ステータス、件数、失敗した行)を記載します。実行していないコマンドは報告せず、引用するコマンドで stderr を握りつぶしてはいけません。',
  '親が再実行するまで、あなたの報告は主張にすぎません。確認したこと、再利用したこと、確認できなかったことを明記します。',
] as const;

/** The numbered list only; each rendering site supplies its own heading line (`## ` in the spec body, `label:` in a child prompt). */
export const IMPLEMENTER_DISPATCH_RULES = IMPLEMENTER_DISPATCH_RULES_ITEMS.map((rule, index) => `${index + 1}. ${rule}`).join('\n');

export function generateImplementerDispatchRules(): string {
  return IMPLEMENTER_DISPATCH_RULES;
}
