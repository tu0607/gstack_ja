# TODOS.md フォーマットリファレンス

TODOS.md の正規フォーマットに関する共通リファレンスです。`/ship`(Step 14)と `/plan-ceo-review`(TODOS.md の更新セクション)が参照し、TODO 項目の構造を統一します。

---

## ファイル構成

```markdown
# TODOS

## <Skill/Component>     ← e.g., ## Browse, ## Ship, ## Review, ## Infrastructure
<items sorted P0 first, then P1, P2, P3, P4>

## Completed
<finished items with completion annotation>
```

**セクション:** スキルやコンポーネントごとに分けます(`## Browse`、`## Ship`、`## Review`、`## QA`、`## Retro`、`## Infrastructure`)。各セクション内では、優先度順(P0 が一番上)に並べます。

---

## TODO 項目の形式

各項目は、そのセクションの下の H3 です。

```markdown
### <Title>

**What:** One-line description of the work.

**Why:** The concrete problem it solves or value it unlocks.

**Context:** Enough detail that someone picking this up in 3 months understands the motivation, the current state, and where to start.

**Effort:** S / M / L / XL
**Priority:** P0 / P1 / P2 / P3 / P4
**Depends on:** <prerequisites, or "None">
```

**必須フィールド:** What、Why、Context、Effort、Priority
**任意フィールド:** Depends on、Blocked by

---

## 優先度の定義

- **P0** — ブロッカー: 次のリリース前に必ず完了すること
- **P1** — 重要: 今のサイクル中に完了すべきこと
- **P2** — 重要度は中: P0/P1 が片付いたら取り組むこと
- **P3** — あると良い: 採用や利用データが出てから見直すこと
- **P4** — いつか: 良いアイデアだが、緊急性はない

---

## 完了項目の形式

項目が完了したら、元の内容をそのまま残したうえで、次を追記して `## Completed` セクションに移します。

```markdown
**Completed:** vX.Y.Z (YYYY-MM-DD)
