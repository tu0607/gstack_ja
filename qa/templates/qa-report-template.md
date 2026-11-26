# QA レポート: {APP_NAME}

| 項目 | 値 |
|-------|-------|
| **日付** | {DATE} |
| **URL** | {URL} |
| **ブランチ** | {BRANCH} |
| **コミット** | {COMMIT_SHA} ({COMMIT_DATE}) |
| **PR** | {PR_NUMBER} ({PR_URL}) または "—" |
| **ティア** | Quick / Standard / Exhaustive |
| **スコープ** | {SCOPE or "Full app"} |
| **プローブの予算 / コマンドの実行時間** | {CONFIGURED LIMIT / SUM OF MEASURED COMMAND SPANS} |
| **訪問したページ** | {COUNT} |
| **スクリーンショット** | {COUNT} |
| **フレームワーク** | {DETECTED or "Unknown"} |

## ヘルススコア: {SCORE}/100

| カテゴリ | スコア |
|----------|-------|
| Console | {0-100} |
| Links | {0-100} |
| Visual | {0-100} |
| Functional | {0-100} |
| UX | {0-100} |
| Performance | {0-100} |
| Accessibility | {0-100} |

## 優先して直すべき 3 件

1. **{ISSUE-NNN}: {タイトル}** — {1 行の説明}
2. **{ISSUE-NNN}: {タイトル}** — {1 行の説明}
3. **{ISSUE-NNN}: {タイトル}** — {1 行の説明}

## コンソールの状態

| エラー | 件数 | 初めて見つかった場所 |
|-------|-------|------------|
| {error message} | {N} | {URL} |

## サマリー

| 重大度 | 件数 |
|----------|-------|
| Critical | 0 |
| High | 0 |
| Medium | 0 |
| Low | 0 |
| **合計** | **0** |

## 問題

### ISSUE-001: {短いタイトル}

| 項目 | 値 |
|-------|-------|
| **重大度** | critical / high / medium / low |
| **カテゴリ** | visual / functional / ux / content / performance / console / accessibility |
| **URL** | {page URL} |

**説明:** {何が問題か。期待値と実際の値。}

**再現手順:**

1. {URL} に移動する
   ![Step 1](screenshots/issue-001-step-1.jpg)
2. {Action}
3. **観察:** {何がおかしくなるか}
   ![Result](screenshots/issue-001-result.jpg)

---

## 適用した修正(該当する場合)

| 問題 | 修正の状態 | コミット | 変更したファイル |
|-------|-----------|--------|---------------|
| ISSUE-NNN | verified / best-effort / reverted / deferred | {SHA} | {ファイル} |

### 修正前後の証拠

#### ISSUE-NNN: {title}
**Before:** ![Before](screenshots/issue-NNN-result.jpg) — フェーズ 5 の証拠(静的なバグなら `issue-NNN.png`)
**After:** ![After](screenshots/issue-NNN-after.jpg)

---

## リグレッションテスト

| 問題 | テストファイル | 状態 | 説明 |
|-------|-----------|--------|-------------|
| ISSUE-NNN | path/to/test | committed / deferred / skipped | 説明 |

### 延期したテスト

#### ISSUE-NNN: {title}
**前提条件:** {バグを引き起こすセットアップの状態}
**操作:** {ユーザーが何をするか}
**期待値:** {正しい動作}
**延期の理由:** {reason}

---

## リリース準備の状態

| 指標 | 値 |
|--------|-------|
| ヘルススコア | {before} → {after} ({delta}) |
| 見つかった問題 | N |
| 適用した修正 | N (verified: X, best-effort: Y, reverted: Z) |
| 延期 | N |

**PR Summary:** 「QA で N 件の問題を発見、M 件を修正。ヘルススコア X → Y。」

---

## リグレッション(該当する場合)

| 指標 | ベースライン | 現在 | 差分 |
|--------|----------|---------|-------|
| ヘルススコア | {N} | {N} | {+/-N} |
| 問題 | {N} | {N} | {+/-N} |

**ベースライン以降に修正されたもの:** {list}
**ベースライン以降に新しく発生したもの:** {list}
