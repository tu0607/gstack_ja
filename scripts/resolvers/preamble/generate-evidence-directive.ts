import type { TemplateContext } from '../types';

/**
 * Claims Need Evidence: the preamble's honesty kernel (fork port wave 2, D1;
 * extended by docs/designs/HONEST_WORK_GATE_INTEGRITY.md W4).
 *
 * Started as one directive: a claimed limitation ("the API can't do this")
 * needs the verbatim error, documented statement or live probe, because nine
 * App Store release failures in two days shared that one root. W4 widened it
 * to a five-bullet kernel covering claimed executions, evidence kinds, failure
 * disclosure and null results. It is a correctness rule, not prose style, so
 * it renders for every tier that composes it (2–4) and for `terse` builds;
 * tier 1 skills have no evidence claim to make. The bullets stay at or under
 * KERNEL_MAX_BYTES; test/honesty-kernel.test.ts pins that budget.
 */
export const KERNEL_MAX_BYTES = 2000; // 日本語版: UTF-8 で 1 文字 3 バイトになるため英語版の 800 から引き上げ(トークン数はほぼ同等)

export const EVIDENCE_KERNEL_HEADING = '## 主張には証拠が必要';

export const EVIDENCE_KERNEL_BULLETS = [
  '制約を主張する(「この API ではできない」「X には認証情報が必要」)には、原文どおりのエラー、文書化された記述、または実際のプローブが必要です。尋ねたりブロックしたりする前にプローブしてください。',
  '実行したと主張するなら、実際に実行して結果を見ていること: コマンド名と、リビジョンまたは内容のフィンガープリントを示します。stderr を黙らせたコマンドを引用してはいけません。',
  '証拠の種類(静的な読み取り、ユニットテスト、フィクスチャ/リプレイ、実際の実行、本番)を明示し、別の種類に見せかけないこと: モックは実際の確認ではありません。再利用のルール: Step 16。',
  '読み手の結論を変えうる失敗やカバレッジの欠けは開示すること。「done, unverified」(完了、未検証)は「done」ではありません。',
  '確認済みの null 結果(「X を実行し、重要なものは見つからなかった」)は成功です。裏付けのない肯定的な主張は、沈黙より悪いものです。同意するエージェントや同じ情報源の繰り返しの読み取りは、1 つのデータ点にすぎません。',
] as const;

export function generateEvidenceDirective(_ctx?: TemplateContext): string {
  return `${EVIDENCE_KERNEL_HEADING}

${EVIDENCE_KERNEL_BULLETS.map(bullet => `- ${bullet}`).join('\n')}`;
}
