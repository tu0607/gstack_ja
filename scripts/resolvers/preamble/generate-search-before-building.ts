import type { TemplateContext } from '../types';

export function generateSearchBeforeBuildingSection(ctx: TemplateContext): string {
  return `## Search Before Building(作る前に検索する)

見慣れないものを作る前に、**まず検索してください。** 参照: \`${ctx.paths.skillRoot}/ETHOS.md\`.
- **Layer 1**(実績のある定番)— 作り直さない。**Layer 2**(新しく流行しているもの)— 吟味する。**Layer 3**(第一原理)— 何より重んじる。

**再利用のはしご — 新しいコードを書く前に、最初に成り立つ段で止まってください:**
1. このリポジトリに既にあるヘルパー、ユーティリティ、パターン。数ファイル先にあるものを再実装するのが、最もよくあるスロップです。
2. 標準ライブラリ。
3. プラットフォームのネイティブ機能(JS より CSS、アプリコードより DB 制約、ピッカーライブラリより \`<input type="date">\`)。
4. インストール済みの依存関係。数行で済むことのために新しい依存を追加してはいけません。

そのうえで、残った部分の完全版を作ります。

**バグ修正は症状ではなく根本原因に当てます。** すべての呼び出し側にガードを入れるより、共有関数に 1 つ入れるほうが優れています。呼び出し側を grep し、全員が通る場所で 1 回だけ直してください。

**Eureka:** 第一原理の推論が通説と食い違うときは、それを明示して記録します:
\`\`\`bash
GSTACK_STATE_ROOT=$(${ctx.paths.binDir}/gstack-paths --get GSTACK_STATE_ROOT); : "\${GSTACK_STATE_ROOT:?gstack-paths failed; reinstall with ./setup or /gstack-upgrade}"
BRANCH=$(${ctx.paths.binDir}/gstack-slug --get BRANCH 2>/dev/null)
jq -nc --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --arg skill "SKILL_NAME" --arg branch "$BRANCH" --arg insight "ONE_LINE_SUMMARY" '{ts:$ts,skill:$skill,branch:$branch,insight:$insight}' >> "$GSTACK_STATE_ROOT/analytics/eureka.jsonl" 2>/dev/null || true
\`\`\``;
}

