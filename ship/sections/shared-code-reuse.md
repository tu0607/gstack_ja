<!-- AUTO-GENERATED from shared-code-reuse.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
**skip された shared-code の advisory を再利用できるのは、構造的な証拠が揃っている場合だけです:**

1. **証拠を読みます。** 裏付けとなるすべての呼び出し元とヘルパーの移動先を読みます。
   自社(first-party)が書いたものであるという来歴と、現在の抽出が価値のあるものかどうかを確立します。
   これはチェッカーでは判断できません。`evidence_paths`/`helper_target` を保持します。
2. **チェッカーを実行します。** リポジトリのルートから、現在の指摘をリテラルの JSON として
   stdin に渡します。REVIEW_START はこのパスで取得したトークンに置き換え、例のパスとシンボルは実際の証拠に
   置き換えます。クォートされた区切り文字はそのままにします。

```bash
"$HOME/.claude/skills/gstack/bin/gstack-review-log" --check-shared-libs REVIEW_START <<'GSTACK_SHARED_LIBS_REUSE_JSON'
{"advisory":true,"severity":"INFORMATIONAL","evidence_paths":["src/caller-a.ts","src/caller-b.ts"],"helper_target":{"path":"src/shared.ts","symbol":"sharedHelper"}}
GSTACK_SHARED_LIBS_REUSE_JSON
```

3. **結果に従います。** JSON を読みます。抑制が許されるのは `reusable: true` の場合だけです。
   false、コマンドの失敗、読めない出力の場合は、抑制ではなく、新たなソースレビューと
   新たな判断が必要です。独自のスナップショット、過去の記録、カバレッジを渡してはいけません。
4. **ロガー経由で永続化します。** ロガーが最終的なカバレッジを再計算します。自分で
   証明を渡してはいけません。実際の欠陥は、それとは独立に、通常の Fix-First の扱いを保ちます。

**reusable の結果が証明すること(これらのチェックを自分で再構築しないこと):**
- 同一性: `sharedLibsFingerprint` に加え、実際のリポジトリ、生のブランチ、現在のスナップショット。
  チェッカーは REVIEW_START を消費・置換せずに読みます。サニタイズされたブランチ名は同一性ではありません。
- 過去の判断: 完了/収束したレビュー、検証済みのバインディング、明示的な Skip、
  ロガーがバージョン付けした `snapshot_covered_paths`。古いバージョンなしのカバレッジには新たな判断が必要です。
- ソース: `canReuseSharedLibsAdvisory` は、裏付けとなるすべてのパスの生ファイルが
  その blob とバイト単位で一致していることを要求します。assume-unchanged、skip-worktree、
  sparse index のエントリ、シンボリックリンク/祖先、サブモジュール、無視された/範囲外/読めないファイル、
  有効または不明な Git フィルター、エンコーディング、改行変換は除外します。
- 安全な検査: fsmonitor とオプションのロックを無効にし、外部 diff/textconv は決して使いません。
  不明な証拠は fail closed(失敗側に倒す)です。
