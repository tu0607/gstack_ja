import { type TemplateContext } from './types';
import { binaryAssignment } from './runtime-root';

/**
 * {{MAKE_PDF_SETUP}} — emits the readiness check that resolves $P to the
 * make-pdf binary (make-pdf/dist/pdf). Mirrors generateDesignSetup: the
 * assignment comes from binaryAssignment(ctx, 'make-pdf'), the same resolver
 * the runtime prelude puts into every later block that uses $P on env-var
 * hosts, so readiness and use always name the same binary.
 *
 * Resolution order: MAKE_PDF_BIN (contributor dev builds), then the
 * repo-local install, then the global install (env-var hosts: $GSTACK_ROOT,
 * which the prelude resolves repo-local first).
 */
export function generateMakePdfSetup(ctx: TemplateContext): string {
  return `## MAKE-PDF SETUP(make-pdf コマンドを実行する前に、必ずこのチェックを実行)

\`\`\`bash
${binaryAssignment(ctx, 'make-pdf')}
if [ -x "$P" ]; then
  echo "MAKE_PDF_READY: $P"
  alias _p_="$P"   # shellcheck alias helper (not exported)
  export P   # env-var hosts re-derive $P in every later block (runtime prelude)
else
  echo "MAKE_PDF_NOT_AVAILABLE (run './setup' in the gstack repo to build it)"
fi
\`\`\`

\`MAKE_PDF_NOT_AVAILABLE\` が出力された場合: バイナリがビルドされていないことをユーザーに伝えます。gstack リポジトリで \`./setup\` を実行してもらい、その後やり直します。

\`MAKE_PDF_READY\` が出力された場合: \`$P\` がスキルの残りの部分で使うバイナリのパスです。スキル本文を可搬に保つため、明示的なパスではなく \`$P\` を使います。

主なコマンド:
- \`"$P" generate <input.md> [output.pdf]\` — Markdown を PDF にレンダリング(用途の 8 割)
- \`"$P" generate --cover --toc essay.md out.pdf\` — 出版向けのフルレイアウト
- \`"$P" generate --watermark DRAFT memo.md draft.pdf\` — 斜めの DRAFT 透かし
- \`"$P" preview <input.md>\` — HTML をレンダリングしてブラウザで開く(素早い反復用)
- \`"$P" setup\` — ブラウザ(Aside、または gstack 独自のヘッドレスフォールバック)と pdftotext を確認し、スモークテストを実行
- \`"$P" --help\` — フラグの完全なリファレンス

出力の取り決め:
- \`stdout\`: 成功時は出力パスのみ。1 行。
- \`stderr\`: 進捗(\`Rendering HTML... Generating PDF...\`)。\`--quiet\` の場合は出力しません。
- 終了コード: 0 成功 / 1 引数エラー / 2 レンダリングエラー / 3 目次のページ番号の取得失敗 / 4 利用可能なブラウザなし(Aside アプリを開くか、\`./setup\` を実行して gstack 独自のブラウザをビルドしてください)。

PDF は Aside が起動していれば Aside で、そうでなければ gstack 独自のヘッドレスブラウザで出力されます。どちらかは stderr の進捗行に表示されます(\`Rendering PDF through Aside\` / \`through gstack's browser\`)。`;
}
