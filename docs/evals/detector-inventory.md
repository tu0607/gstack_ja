# E2E 検出器インベントリ: フレーズ確認と構造化データの出典

このインベントリは、ゲートおよび定期実行 (periodic) の E2E ケース (test/helpers/touchfiles-data.ts の `E2E_TIERS`、および定期実行の単独の AUQ ファイル 3 件) において、モデルの自由記述テキスト中のフレーズや正規表現だけに基づいて合否を決めているすべての箇所を一覧にしたものです。対象は HEAD `cbcccf9` です。フレーズ確認の行は 153 件あり、そのうち 13 件はすでに構造化データを先に読んでいます (a)。38 件は変換候補 (b) です。79 件は契約がユーザーに見えるものなので、フレーズによる裏付けが必要です (c)。23 件は構造化データの出典がありません (d)。さらに 13 件は LLM ジャッジです。共有検出器 (S1-S10、F1-F3、A1) は、最大 9 件のケースで使われていても 1 回として数えています。B1 の 5 ケースのうち、結果を決められる構造化記録があるのは auto-decide-preserved だけです。残りの 4 ケースはすでに記録を先に読んでいるか、ユーザーに見えるテキストを検査しているため、B1 のリプレイ用コーパスがフレーズ確認を保護しています。

処理区分:

- **(a) すでに構造化データを先に読んでいる。** 確認は構造化記録を先に読み、記録がない場合にだけフレーズに戻ります。
- **(b) 変換候補。** 同じ事実の構造化記録がこの実行の中にあり、契約はユーザーに見える文章ではありません。
- **(c) フレーズによる裏付けが必要。** 契約はユーザーが見るもの (表示された質問、描画されたレポートやメッセージ) です。記録はテキストの位置を特定できても、テキストの代わりにはなりません。`Completeness: N/10` のように、表示された質問に対する数値形式の正規表現は (c) です。
- **(d) 構造化データの出典なし。** 実行中に何も記録していない内部の事実です。
- **judge。** LLM ジャッジです。一覧には載せていますが、フレーズ確認ではありません。

「Journal」は、test/helpers/plan-count-transcript.ts が読む隔離された Claude セッションの JSONL を指します。「Surface」は `fullSurface`/`fullOutputSurface` を指し、Skill が注入した SKILL.md の本文も含みます。

## 共有検出器

| ID | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| S1 | test/helpers/pty/screen.ts:399 (test/helpers/pty/classify.ts:490 経由) | 画面の `❯ 1.` の選択肢一覧 → `asked` | journal 内の AskUserQuestion の tool_use で位置を特定 | はい (表示された質問) | (c) |
| S2 | test/helpers/pty/classify.ts:45 (:505 経由) | 英字または番号付きの散文の選択肢、`Recommendation:`、`(recommended)` → `asked` | AUQ が禁止されている場合は出典なし | はい | (c) |
| S3 | test/helpers/pty/screen.ts:186 (test/helpers/pty/classify.ts:467 経由) | "ready to execute" / 計画の終了パネル → `plan_ready` | journal 内の ExitPlanMode の tool_use | いいえ | (b) |
| S4 | test/helpers/pty/classify.ts:425 | 許可されたディレクトリ外での画面上の `⏺ Write(path)` → `silent_write`。最初の AUQ より前の計画の書き込み → `wrote_findings_before_asking` | journal 内の Write/Edit の tool_use (file_path、順序) | いいえ | (b) |
| S5 | test/helpers/pty/screen.ts:205 (test/helpers/pty/classify.ts:460 経由) | `(auto-decided from plan-tune preference)` → `auto_decided`。test/helpers/pty/runners/observation.ts:389 の構造化経路より前に実行 | `gstack-ceo-mode-handoff --auto` (plan-ceo-review/SKILL.md.tmpl:410)、question-log の `auto_decided:true` (:416; scripts/resolvers/question-tuning.ts:38)。test/helpers/native-auto-decide.ts:412 が読む | はい (チャットは handoff の行から始まる必要がある。plan-ceo-review/SKILL.md.tmpl:410)。記録で位置を特定できるが、裏付けは transcript の行のまま | (b) |
| S6 | test/helpers/pty/runners/observation.ts:410-416 | Haiku の `waiting` 判定 → `asked` | — | — | judge |
| S7 | test/helpers/pty/plan-native.ts:36 (:605 経由) | 計画ファイルに `^## GSTACK REVIEW REPORT$` があり、後ろに `## ` の見出しがない | なし (描画された計画ファイル) | はい | (c) |
| S8 | test/helpers/plan-mode-evidence.ts:72 → test/helpers/pty/screen.ts:279 | `plan_ready` のとき計画ファイルに `## Decisions` がある → 失敗 | なし | はい | (c) |
| S9 | test/helpers/pty/classify.ts:148 | 詰まった画面の "what should I (design-)review" と "current branch diff" | ネイティブ AUQ が許可されている場合、AUQ の tool_use で位置を特定 | はい | (c) |
| S10 | test/helpers/pty/classify.ts:166、test/helpers/plan-scope-selection.ts:54-110、test/helpers/pty/runners/observation.ts:483 | スコープゲートの自動選択のお知らせ、先頭行の対象の文言、画面上のシードトークン | なし (スコープ選択の記録はない。シードトークンは貼り付けたシードにある) | いいえ | (d) |
| F1 | test/helpers/pty/runners/floor.ts:474 → test/helpers/plan-floor-review.ts:217 | 段階的な質問が `finding` と判定される (合格はこれだけ) | — | — | judge |
| F2 | test/helpers/pty/runners/floor.ts:451 | 散文の候補は、表示領域と最後のアシスタントメッセージの両方に散文の選択肢が出ている場合のみ。ネイティブの呼び出しを先に読む | ネイティブの AUQ 呼び出し (構造化を先に) | はい | (a) |
| F3 | test/helpers/pty/runners/floor.ts:497 | 画面の Write の描画 / 計画完了のテキスト → 失敗 | run.transcript 内の Write/ExitPlanMode の tool_use | いいえ | (b) |
| A1 | test/helpers/auq-sdk-capture.ts:30-43 `scoreAuqFormat` | 質問に ELI10:、Recommendation:、Pros / cons、✅、❌、Net:、(recommended) がある | AUQ のツール入力 (その散文が契約) | はい | (c) |

S1-S8 を使うケース: plan-ceo-review-plan-mode、plan-devex-review-plan-mode、plan-mode-no-op、office-hours-auto-mode (ゲート)。auto-decide-preserved、plan-eng-review-plan-mode、plan-design-review-plan-mode-smoke (定期実行)。S9-S10: plan-mode-no-op、plan-eng-review-plan-mode、plan-design-review-plan-mode-smoke。F1-F3: plan-ceo-finding-floor、plan-devex-finding-floor (ゲート)。plan-design-finding-floor、plan-eng-finding-floor (定期実行)。A1: auq-format-gate (ゲート)。単独の AUQ ファイル 3 件 (定期実行)。

## ゲート階層

### test/skill-e2e-plan-mode-no-op.test.ts、test/skill-e2e-plan-ceo-plan-mode.test.ts、test/skill-e2e-plan-devex-plan-mode.test.ts、test/skill-e2e-office-hours-auto-mode.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| plan-mode-no-op | test/skill-e2e-plan-mode-no-op.test.ts:114, :175 | 画面に計画モードの注意文がない | なし | はい (漏れたテキスト) | (c) |
| plan-mode-no-op | test/skill-e2e-plan-mode-no-op.test.ts:186 | 画面にシードトークン `ZephyrLedgerWidget` がある | なし。トークンは貼り付けたシードにある | いいえ | (d) |
| office-hours-auto-mode | test/skill-e2e-office-hours-auto-mode.test.ts:41 | S5 の `auto_decided` でケースが失敗 | question-log の行 | いいえ | (b) |

plan-ceo-review-plan-mode (:89, :108)、plan-devex-review-plan-mode (:181-222)、office-hours-auto-mode (:54) の判定は、それ以外は S1-S8 です。

### test/skill-e2e-plan-devex-finding-floor.test.ts、test/skill-e2e-plan-design-with-ui.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| plan-devex-finding-floor | test/helpers/plan-floor-review.ts:278-280 `pickPlanFloorProductType` | プロダクト種別の問い `^Is this…?$` と、正確な "Project/branch/task" の文脈が 1 つ。一致しなければメニューは未回答のまま止まる (停滞) | AUQ のヘッダー `Product type` と選択肢のラベル (:268-281 で解析済み) | いいえ (セレクター) | (b) |
| plan-design-with-ui-scope | test/skill-e2e-plan-design-with-ui.test.ts:34-36 | デザインの焦点の質問の散文 "I've rated this plan N/10…" または "all 7 … focus … design?" | 回答されたネイティブ呼び出しの AUQ のヘッダーと選択肢 | いいえ (境界の ID) | (b) |
| plan-design-with-ui-scope | test/skill-e2e-plan-design-with-ui.test.ts:44-57 | 選択肢のラベルや UI の語彙によるレビュー指摘の識別 | 選択肢のラベル (構造化)。デザイン指摘の記録はない | いいえ | (b) |
| plan-design-with-ui-scope | test/helpers/plan-review-board-feedback.ts:111-120、:127-138 | 外部の意見者の質問の先頭の正規表現。散文中の `/boards/` URL が 1 つ。不一致なら例外 | ヘッダー `Voices` と正確な選択肢のラベル (:115-116 で比較) | いいえ (アクター) | (b) |
| plan-design-with-ui-scope | test/skill-e2e-plan-design-with-ui.test.ts:80-81 | ネイティブ呼び出しなしに画面のプロンプトに `/boards/` がある場合は例外 | ネイティブ呼び出しがないことで判定 | いいえ | (a) |
| plan-design-with-ui-scope | test/helpers/pty/classify.ts:555 `COMPLETION_SUMMARY_RE` (test/helpers/pty/runners/counting.ts:554 経由) | 画面の report/summary/`VERDICT:` のテキストが上限の前に収集を終了させる | レビューログの行 / ExitPlanMode の tool_use | いいえ | (b) |

### test/skill-e2e-ask-user-question-format-compliance.test.ts、test/skill-e2e-plan-tune.test.ts、test/skill-e2e-plan.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| auq-format-gate | test/skill-e2e-ask-user-question-format-compliance.test.ts:58 | 質問が `options differ in kind` に一致 | AUQ のツール入力 | はい | (c) |
| auq-format-gate | test/skill-e2e-ask-user-question-format-compliance.test.ts:61、:68 | 推奨の実質が 4 以上 | — | — | judge |
| plan-tune-inspect | test/skill-e2e-plan-tune.test.ts:167-169、:185 | 出力が 3 つのシード済み質問 ID またはエイリアスのうち 2 つ以上を挙げる | question-log はシード済みのフィクスチャの入力 | はい (検査レポート) | (c) |
| plan-review-report | test/skill-e2e-plan.test.ts:463-491 | plan.md の `## GSTACK REVIEW REPORT`、CEO/Eng/Design の行、末尾が `NO UNRESOLVED DECISIONS` または箇条書き | 行はシード済みのレビューログから。表は描画されたもの | はい | (c) |

### test/skill-e2e-design.test.ts (ゲートのケース)

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| plan-design-review-no-ui-scope | test/skill-e2e-design.test.ts:561-565、:572 | 出力に ui/no frontend/no design/not applicable/backend がない | なし (早期終了では記録を書かない) | いいえ | (d) |
| design-review-plugin-handoff | test/skill-e2e-design.test.ts:1012、:1020-1023 | detector-output.md に `IMPECCABLE_READY`、FINDING-001、ルール ID、`deferred`、引き継ぎごとの `/impeccable x` | probe/scan ツールの出力 (:994、:1010-1011 で確認) | はい (レポート) | (c) |
| design-review-detector-shim | test/skill-e2e-design.test.ts:1158 | ツールの出力またはレポートに `IMPECCABLE_READY` がある | probe ツールの出力を先に読む | はい | (a) |
| design-review-detector-shim | test/skill-e2e-design.test.ts:1159-1161 | レポートに FINDING-001、[ai-color-palette]、[low-contrast] がある | calls.jsonl のレシートとエンジンのログ (:1132-1154) | はい | (c) |
| design-review-detector-shim-dom | test/skill-e2e-design.test.ts:1254-1255 | レポートに [ai-color-palette] と "static scan of the rendered DOM" がある | DOM ダンプと Bash のトレース (:1247-1252) | はい | (c) |

### test/skill-e2e-coverage-audit.test.ts、test/skill-e2e-workflow.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| review-coverage-audit、plan-eng-coverage-audit | test/helpers/coverage-audit-evidence.ts:546-547 | 最後の JSON `{"tested","untested"}` の行を先に見る。ASCII 図の文法によるフォールバック (:459-510) | プロンプトで要求された JSON の要約 | いいえ | (a) |
| ship-coverage-audit | test/helpers/coverage-audit.ts:34-38 | 図に gap/no test、tested/✓/★、coverage、両方の関数名がある | なし (図が要求された出力) | はい | (c) |
| document-release | test/skill-e2e-workflow.test.ts:101-102、:109 | CHANGELOG に古いエントリが残る。現在のエントリと README に "feature c" が言及される | なし (ドキュメントが成果物) | はい | (c) |

### test/skill-e2e-shared-libs.test.ts、test/skill-e2e-shared-libs-paths.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| shared-libs-read-only | test/skill-e2e-shared-libs.test.ts:113-120 | レポートが uncommitted/overlay/raw、tip と branch の SHA、retry-worker/route に一致。ブランチだけのファイルに blob のリンクがない | なし (契約上の読み取り専用) | はい | (c) |
| shared-libs-unsupported-git | test/skill-e2e-shared-libs.test.ts:136、:144 | レポートが unavailable/unsupported/limited に一致。"no commits/PRs found" ではない | なし | はい | (c) |
| shared-libs-review-path-eligibility | test/skill-e2e-shared-libs-paths.test.ts:133-134 | `trace + output` が submodule/160000、check-ignore/ignored に一致 (出力だけでも満たされる) | Bash コマンドのトレース (最初のオペランド) | いいえ | (b) |

### test/skill-e2e-ship-docsync.test.ts、test/skill-e2e-docsync-spawned.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| ship-docsync-store | test/skill-e2e-ship-docsync.test.ts:74、:78 | ship レポートが `Documentation…blocked` に一致。`Documentation: current` ではない | レシートなし、publish の呼び出しなし (:75-77) | はい (レポートの状態) | (c) |
| ship-docsync-completion、ship-docsync-current | test/skill-e2e-ship-docsync.test.ts:81、:97 | 解析された docs の契約の後、レポートに `contract.documentation_section` がある | docs の dispatch JSON (ship/sections/documentation.md.tmpl:52-56) | はい | (a) |
| ship-docsync-late-result、-missing-marker、-missing-asset、-launch-failure、-timeout-unsettled、-failure | test/helpers/docsync-fault-eval.ts:28、:30 | 成功でないレポートが `Documentation…blocked` に一致。インラインコードの外に `Documentation: current` がない | アクターのイベントログが dispatch の回数と公開の有無を先に決める (:22-27) | はい | (c) |
| ship-docsync-recovery、-stale-before、-stale-after | test/helpers/docsync-fault-eval.ts:31 | レポートに受理された監査 ID がある | アクターの状態 `acceptedId` | はい | (a) |
| docsync-spawned | test/skill-e2e-docsync-spawned.test.ts:60 | `contract.blockers` が security/sensitive に一致 | 解析された docs の契約 | いいえ | (a) |

### test/helpers/ship-hook-actor.ts (ship-hook-consent、ship-hook-refresh のファイル)

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| ship-managed-hook-refresh | test/helpers/ship-hook-actor.ts:122 | 最終出力が refresh/updat/install/current に一致 | インストーラーのレシート (:113-121 で確認) | はい (結果をユーザーに伝える) | (c) |
| ship-unmanaged-hook-consent | test/helpers/ship-hook-actor.ts:129 | 最終出力が declin/unchanged/not install/preserv/leave に一致 | 拒否の対話記録 (:127) | はい | (c) |
| ship-local-hook-preservation | test/helpers/ship-hook-actor.ts:133 | 最終出力が /manual/ に一致 | なし | はい | (c) |

### test/skill-e2e-review.test.ts、test/skill-e2e-review-attribution.test.ts、test/skill-e2e-review-army.test.ts (ゲートのケース)

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| review-sql-injection | test/skill-e2e-review.test.ts:87-95 | review-output.md に sql/injection/sanitiz/parameteriz/… が含まれる | なし。フィクスチャはチェックリストだけをコピーするため、レビューログの行がない (review/SKILL.md.tmpl:402) | 一部 | (d) |
| review-enum-completeness | test/skill-e2e-review.test.ts:173-177 | レビューが "returned" と enum/status/critical に言及する | なし (焦点を絞ったチェックリストの実行) | 一部 | (d) |
| ship-base-branch | test/skill-e2e-review-attribution.test.ts:144 | ship-preflight.md が /main\|base/ に一致 | Bash のトレース中の git コマンド (review-base-branch がこれを使う、:87) | いいえ | (b) |
| review-dashboard-via | test/skill-e2e-review-attribution.test.ts:273、:275 | 出力とダッシュボードが autoplan、clear に一致 | レビューログはシード済みの入力。ダッシュボードは描画されたもの | はい | (c) |
| review-army-migration-safety | test/skill-e2e-review-army.test.ts:136-142 | 出力に drop/data loss/reversib/migration/column が含まれる | なし (1 回の実行) | 一部 | (d) |
| review-army-perf-n-plus-one | test/skill-e2e-review-army.test.ts:272-280 | 出力に n+1/eager/includes/preload/query/loop が含まれる | Agent の結果にある専門家の JSON 指摘 (review/sections/review-army.md)。指摘ごとには未検証 | いいえ | (b) |
| review-army-delivery-audit | test/skill-e2e-review-army.test.ts:395-404 | 出力に not done/missing と email/notification が含まれる | 未検証 | 一部 | (d) |
| review-army-quality-score | test/skill-e2e-review-army.test.ts:494-496 | `SPECIALIST REVIEW: 1 findings (1 critical, 0 informational)`、`PR Quality Score: 8/10`、`[ADVISORY]` | merged-review.json (:485-493 で確認) | はい (描画された形式) | (c) |

### test/skill-e2e-bws.test.ts、test/skill-e2e-session-intelligence.test.ts、test/skill-e2e-learnings.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| skillmd-no-local-binary | test/skill-e2e-bws.test.ts:156 | result.output が READY/NEEDS_SETUP に一致 | セットアップブロックの Bash tool_result が `READY: $B`/`NEEDS_SETUP` を出力 (browse/SKILL.md:214) | いいえ | (b) |
| skillmd-outside-git | test/skill-e2e-bws.test.ts:194 | 同上 | 同上 | いいえ | (b) |
| context-recovery-artifacts | test/skill-e2e-session-intelligence.test.ts:181-183、:195 | 出力に recent artifacts/ceo-plans/last_session/ship/timeline/completed のいずれかが含まれる (ほぼ空振り) | bin/gstack-context-recovery:31、:37 が記録を出力するが、フィクスチャはそれをコピーしない (:46-48) | いいえ | (d) (bin をコピーすれば (b)) |
| context-save-writes-file | test/skill-e2e-session-intelligence.test.ts:257、:266 | チェックポイントに `---` と `status:` が含まれる | ファイルの YAML フロントマター (解析可能) | いいえ | (b) |
| context-restore-loads-latest | test/skill-e2e-session-intelligence.test.ts:379-393、:401-402 | `RESTORED: <newer>` または新しい方の本文のフレーズ。フォールバックとして新しい方のファイルを Read | Read の tool_use | 一部 | (c) |
| learnings-show | test/skill-e2e-learnings.test.ts:117-119、:131 | 出力が n-plus-one、stale/cache、rubocop のうち 2 つ以上に言及する | `gstack-learnings-search` の Bash の結果 (フィクスチャがコピーする。test/skill-e2e-learnings.test.ts:43) | はい (/learn がこれを表示する) | (c) |

### test/skill-e2e-qa-functional*.test.ts、test/skill-e2e-skillify.test.ts、test/skill-e2e-deploy.test.ts、test/skill-e2e-cso.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| qa-functional-cli-report、-webhook-report、-cli-fix、-webhook-fix | test/helpers/qa-checkpoint-evidence.ts:207-209 | report.md が各 `exploration-NNN.json` のチェックポイントにリンクしている | チェックポイントファイルと gstack-qa-evidence のレシート。リンクは描画される | はい | (c) |
| 同じ 4 件 | test/helpers/qa-functional-evidence.ts:179-180 | 非公開のセンチネルが出力、レポート、証拠のいずれにもない | 該当なし (漏えいのカナリア) | はい | (c) |
| skillify-happy-path | test/skill-e2e-skillify.test.ts:379 → test/helpers/skill-body-narration.ts:7 | コミットされた SKILL.md に `I `/`I'll`/`Let me` の独白がない | なし (生成されたスキルの文章が成果物) | はい | (c) |
| skillify-provenance-refusal | test/skill-e2e-skillify.test.ts:429、:467 | 表示内容が unknown skill/not registered に一致 (読み込みの検知) | Skill の tool_use とそのエラーの tool_result | いいえ | (b) |
| skillify-provenance-refusal | test/skill-e2e-skillify.test.ts:444、:468 | アシスタントが "no recent scrape result" / "run /scrape first" に一致 | なし | はい (拒否、skillify/SKILL.md.tmpl:67) | (c) |
| land-and-deploy-workflow | test/skill-e2e-deploy.test.ts:81 | デプロイのレポートと CLAUDE.md が /fly/ に一致 | Bash の結果 `PLATFORM:fly` (land-and-deploy/sections/first-run-validation.md:35)。このフローが実際に実行されたかは未検証 | いいえ | (b) |
| land-and-deploy-workflow | test/skill-e2e-deploy.test.ts:82 | 成果物に `test-app` がある | なし | いいえ | (d) |
| land-and-deploy-first-run | test/skill-e2e-deploy.test.ts:150-151 | レポートに fly または first-run-app がある | Bash の結果 `PLATFORM:fly` (このケースはステップ 1.5 を実行) | いいえ | (b) |
| land-and-deploy-review-gate | test/skill-e2e-deploy.test.ts:221-222 | 準備状況のレポートが review に一致し、run/no reviews/missing ではない | なし (gstack-review-read がインストールされていない) | はい | (c) |
| setup-deploy-workflow | test/skill-e2e-deploy.test.ts:408-410 | CLAUDE.md に fly、my-cool-app、Deploy Configuration がある | `## Deploy Configuration` のキーと値のブロック (setup-deploy/SKILL.md.tmpl:183-190) | いいえ (機械が読む) | (b) |
| cso-diff-mode | test/skill-e2e-cso.test.ts:181 | webhook.js の指摘の散文が signature/authenticat/forg に一致 | report.json に class/CWE のフィールドがない (lib/cso/contracts.ts:65-80) | いいえ | (d) |
| cso-diff-mode (および定期実行の CSO ケース) | test/skill-e2e-cso.test.ts:61、:86、:133-134 | CANARY トークンが出力、transcript、レポートのいずれにもない | 該当なし (漏えいのカナリア) | はい | (c) |

### test/skill-e2e-third-party-actions.test.ts

同意の質問は設計上プレーンテキストです (Read と Bash のみ使用)。probe の Bash の結果 (`READY:`/`NEEDS_ASIDE: <os>`/`ASIDE_NOT_RUNNING`、ship/SKILL.md:395-409) が記録するのは検出結果であり、提示された内容ではありません。

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| tpa-present | test/skill-e2e-third-party-actions.test.ts:197-203 | Aside、`A)`、defer、ダッシュボードのホスト。ダウンロードの勧誘がない (正規表現 :41) | probe の `READY:` | はい | (c) |
| tpa-absent-linux | test/skill-e2e-third-party-actions.test.ts:218-226; test/helpers/third-party-actions.ts:6、:23 | 勧誘がない。Aside で操作する選択肢がない。手動と headed の操作の選択肢がある | probe の `NEEDS_ASIDE: Linux` | はい | (c) |
| tpa-broken | test/skill-e2e-third-party-actions.test.ts:244、:249-252 | 操作の選択肢がない。"open the Aside app" または英字の質問 | probe の `ASIDE_NOT_RUNNING` | はい | (c) |
| tpa-absent-darwin | test/skill-e2e-third-party-actions.test.ts:272-274 | 勧誘の文、`macOS 15`、操作の選択肢がない | probe の `NEEDS_ASIDE: Darwin` | はい | (c) |
| tpa-apple-ban | test/skill-e2e-third-party-actions.test.ts:307-311 | account.apple.com に対する操作の選択肢がない。アプリ固有のパスワードの案内 | なし | はい | (c) |

### test/helpers/workflow-boundaries-fixture.ts (investigate が所有するファイル), test/skill-e2e-safety-pair-agent.test.ts, test/skill-e2e-safety-ship-evidence.test.ts

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| investigate-owned-completion, -abort, -ending-error | test/helpers/workflow-boundaries-fixture.ts:156-160 | 台本型アクター: 選択肢のラベルが abort/stop/cancel または continue/proceed に一致しなければ未対応 | AUQ の入力(ラベルは散文) | はい | (c) |
| investigate-owned-abort | test/helpers/workflow-boundaries-fixture.ts:194 | 最終出力が abort/stop/cancel に一致 | レシート (:186-193) | はい | (c) |
| investigate-owned-ending-error | test/helpers/workflow-boundaries-fixture.ts:209 | 最終出力が error/unavailable/cannot/unable に一致 | レシート `VERIFY_STATUS:69` (:208) | はい | (c) |
| safety-pair-agent-block | test/skill-e2e-safety-pair-agent.test.ts:86, :91 | 最終出力に指示ブロックがバイト単位で含まれる | ブロックは偽のツール結果内にあり、それを中継することが契約 | はい | (c) |
| safety-ship-stale-evidence | test/skill-e2e-safety-ship-evidence.test.ts:133 `callJudge` | — | — | — | judge |

フレーズのみによる確認を含まないゲートケース: 共有ライブラリのレビューライフサイクル、再検証、index-flags、prior-coverage の各ケース(レビューログの行とトレースで確認); ship-skipped-queued-finding; qa-callers の 5 ケース; ship-section-loading; ship-triage (test/helpers/ship-triage-labels.ts:12 は先に JSON を解析するため (a)); ship-coverage-value, review-test-value, test-audit-report-only (JSON レコード。正規表現は項目の選択にだけ使うため (a)); review-army-json-findings; ship-local-workflow; gstack-upgrade-happy-path; qa-quick; qa-only-no-fix; qa-bootstrap; browse-basic; browse-snapshot; skillmd-setup-discovery; operational-learning; skillify-approval-reject; canary-workflow; benchmark-workflow; retro-base-branch; timeline-event-flow; hermetic-canary; hermetic-sentinel; diagram-triplet; safety-codex-consult-embed.

## 定期実行 (periodic) 階層

### B1 ケース

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| auto-decide-preserved | test/skill-e2e-auto-decide-preserved.test.ts:173 (S5) | 画面の自動決定注記が通る | handoff の `--auto` と question-log。画面が未分類の場合のみ読む | はい (handoff の行) | (b) |
| auto-decide-preserved | test/skill-e2e-auto-decide-preserved.test.ts:159 (S1/S2) | 選択肢一覧が表示されていると失敗 | 散文の質問のみ (AUQ は禁止) | はい | (c) |
| plan-ceo-section-loading | test/helpers/ceo-stale-fill-decision.ts:54 ‖ test/helpers/ceo-section-loading-fixture.ts:688 (test/skill-e2e-plan-ceo-review-section-loading.test.ts:118 から呼び出し) | 承認済みの台帳行と fill/write/race に言及する `currentDecision` があれば通る。なければ構造化→散文の順で検出 | PLAN.md の決定台帳と `currentDecision` ブロック | いいえ | (a) |
| plan-ceo-section-loading | test/helpers/auq-sdk-capture.ts:399-420 (:101 から呼び出し) | `COMPLETION SUMMARY` に Section 1-11 の結果行がある | セクションごとのデータはなし | はい | (c) |
| plan-ceo-section-loading | test/skill-e2e-plan-ceo-review-section-loading.test.ts:74, :110-111 | `## GSTACK REVIEW REPORT`、レビュー表のヘッダー、`\| CEO Review \|` の行 | 描画されたダッシュボード | はい | (c) |
| plan-ceo-section-loading | test/helpers/auq-sdk-capture.ts:213 (:113 から呼び出し) | レポート行 `Outside Review` のステータスが `disabled` で始まる | このネイティブのみの実行では出典なし | はい | (c) |
| shared-libs-plan-callers | test/helpers/shared-libs-plan-actor.ts:28-112 (フレーズ拒否 :63, :67, :72, :75, :85, :109) | 台本型アクターが質問の散文を解析: 再利用の動詞、`lib/retry-after.ts`、契約の文言、スコープ拡大の正規表現 9 種。一致すると失敗 | AUQ の入力。提示内容を伝えるのは選択肢の文言だけ | はい (質問内容) | (c) |
| shared-libs-plan-callers | test/skill-e2e-shared-libs-periodic.test.ts:198 | — | — | — | judge |
| plan-design-review-plan-mode | test/skill-e2e-design.test.ts:489, :497, :508 | 出力が `\d+/10` に一致 | レビューログの `initial_score`/`overall_score` (plan-design-review/sections/review-sections.md.tmpl:229)。フィクスチャでは未検証 | はい | (c) |
| plan-design-review-plan-mode | test/skill-e2e-design.test.ts:496-497, :508 | 出力または評価済みプランの増分に information architecture/interaction state/ai slop/hierarchy が含まれる | なし (レビューログはスコアと件数のみ) | いいえ | (d) |
| plan-design-review-plan-mode | test/skill-e2e-design.test.ts:499-504, :511 | plan.md に empty/loading/error/state/responsive/accessibility が含まれる | なし | いいえ | (d) |
| ship-docsync-late-result | ゲート階層。ship-docsync の表に掲載 | — | — | — | ゲートを参照 |

### プランレビュー: test/skill-e2e-plan-ceo-mode-routing.test.ts, test/skill-e2e-plan-eng-*.test.ts, test/skill-e2e-plan-design-*.test.ts, carve-section-loading

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| plan-ceo-mode-routing | test/helpers/ceo-mode-option.ts:661-670 (test/skill-e2e-plan-ceo-mode-routing.test.ts:248 から呼び出し) | まず handoff のツール結果行で posture の正規表現、次に回答後の散文 | `gstack-ceo-mode-handoff` のツール結果 (plan-ceo-review/SKILL.md.tmpl:410) | いいえ | (a) |
| plan-ceo-mode-routing | test/skill-e2e-plan-ceo-mode-routing.test.ts:257 | HOLD の posture でレビューする | — | — | judge |
| plan-ceo-mode-routing | test/helpers/pty/classify.ts:341 `MODE_RE` | 選択肢のラベルがモード名で始まる → モードの質問と判定 | ネイティブ AUQ の選択肢 | はい | (c) |
| plan-design-finding-floor | test/helpers/pty/boundaries.ts:653-658 `pickDesignFocusAll` | Step-0D のタイトル、"Project/branch/task" と ELI10 の評価文。一致しなければ停止 | AUQ のヘッダーと選択肢ラベル (:659-661 で解析) | いいえ (セレクター) | (b) |
| plan-eng-multi-finding-batching | test/helpers/pty/boundaries.ts:62-116, :587-600, :626-640 | セットアップかレビューかの質問を散文で判定 ("This plan introduces N new classes"、"Issue"、スコープ縮小) | 決定台帳の R レコード (plan-eng-review/sections/review-sections.md.tmpl:213-235)。`QUESTION_TUNING=false` では qid 分岐は無効 | いいえ | (b) |
| plan-eng-multi-finding-batching | test/helpers/eng-seeded-coverage.ts:33-104 | 回答済みの AUQ ごとに異なる課題の識別子 ("Issue N:"、D/R-ID、ELI10 のゲート) | 台帳の R レコード。散文ゲートの後ろのフォールバックとしてのみ使用 | いいえ | (b) |
| plan-eng-multi-finding-batching | test/helpers/pty/classify.ts:555 (counting.ts:554 経由) | 画面の完了テキストでカウントを終了 | レビューログの行 / ExitPlanMode の tool_use | いいえ | (b) |
| plan-eng-review-artifact | test/skill-e2e-plan-eng-artifact.test.ts:78 | テストプラン成果物が dashboard/fetchStats/`/api/stats` に一致 | 成果物のスキーマには変更内容を示すフィールドがない (scripts/resolvers/testing.ts:501-528) | いいえ | (d) |
| carve-section-loading [plan-eng-review] | test/helpers/carve-section-case.ts:120 → test/helpers/auq-sdk-capture.ts:381 | レポートまたは出力が report/review/summary/design doc/handoff に一致 | キャプチャ状態のルートにあるレビューログの行。判定の前に削除 (auq-sdk-capture.ts:368-370) | いいえ | (b) |
| carve-section-loading [他 12 スキル] | 同上 | 同じ緩い正規表現 | なし (Bash は不許可、auq-sdk-capture.ts:358-359) | いいえ | (d) |

plan-eng-review-plan-mode と plan-design-review-plan-mode-smoke の判定は S1-S10。plan-eng-finding-floor と plan-design-finding-floor の判定は F1-F3。

### 質問の形式: test/skill-e2e-plan-format.test.ts, test/skill-e2e-plan-prosons.test.ts, 単独の AUQ ファイル

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| plan-ceo-review-format-mode, plan-eng-review-format-kind | test/skill-e2e-plan-format.test.ts:174-175, :377-378 | `Completeness: N/10` がない。kind の注記がある | キャプチャされた質問 | はい | (c) |
| plan-ceo-review-format-approach, plan-eng-review-format-coverage | test/skill-e2e-plan-format.test.ts:241, :310 | `Completeness: N/10` がある | キャプチャされた質問 | はい | (c) |
| 形式の 4 ケースすべて | test/skill-e2e-plan-format.test.ts:177, :243, :312, :380 | 推奨の質 | — | — | judge |
| plan-review-prosons-format | test/skill-e2e-plan-prosons.test.ts:184-196 | `D\d+ —`、ELI10:、Stakes…:、Recommendation:、Pros / cons:、^Net:、✅≥4、❌≥2、(recommended) | キャプチャされた質問 | はい | (c) |
| plan-review-prosons-hardstop-neg | test/skill-e2e-plan-prosons.test.ts:246-249 | ハードストップの逃げ道の行がない。✅/❌ の件数 | キャプチャされた質問 | はい | (c) |
| plan-review-prosons-neutral-neg | test/skill-e2e-plan-prosons.test.ts:299-303 | `taste call` がない。(recommended) がない。`Recommendation:.*because` | キャプチャされた質問 | はい | (c) |
| plan-ceo-review-prosons-cadence | test/skill-e2e-plan-prosons.test.ts:353-358 | Pros / cons の見出し。ハードストップの逃げ道または pros+cons | キャプチャされた質問 | はい | (c) |
| test/skill-e2e-auq-matrix.test.ts | test/helpers/auq-sdk-capture.ts:54-59 (:166 から呼び出し) | `Recommendation:` の行。`(recommended)` のラベルがちょうど 1 つ | AUQ の選択肢 (AUTO_DECIDE フックが解析する接尾辞) | はい | (c) |
| test/skill-e2e-auq-consistency.test.ts | test/skill-e2e-auq-consistency.test.ts:65, :87 | A1 の各要素がすべての実行に存在する | AUQ の本文 | はい | (c) |
| test/skill-e2e-auq-verbose-vs-carved-ab.test.ts | test/skill-e2e-auq-verbose-vs-carved-ab.test.ts:43, :108 | 分割形式の件数が冗長形式以上 | AUQ の本文 | はい | (c) |
| AUQ マトリクス、一貫性、A/B | auq-matrix :148; consistency :69, :95-96; A/B :48, :109 | 内容のパネルと許容範囲 | — | — | judge |
| plan-ceo-review-expansion-energy | test/skill-e2e-plan.test.ts:271-275 | posture | — | — | judge |

### 共有ライブラリ、レビュー部隊、Codex レビュー、デザイン

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| shared-libs-opportunity-judgment | test/skill-e2e-shared-libs-periodic.test.ts:121-122 | レポートにティップの SHA と `lib/retry-after.ts` が含まれる | なし | はい | (c) |
| shared-libs-opportunity-judgment | test/skill-e2e-shared-libs-periodic.test.ts:123 | `JSON.stringify(transcript)` が inventory.py/search.py/negative inventory に一致 (アシスタントの散文も含む) | Read/Bash のツール呼び出しの入力 | いいえ | (b) |
| shared-libs-opportunity-judgment, shared-libs-pr-coverage | test/skill-e2e-shared-libs-periodic.test.ts:88, :125, :158 | — | — | — | judge |
| shared-libs-codex-read-only | test/codex-e2e-shared-libs.test.ts:123-129 | Codex のレポートに SHA、オーバーレイの文言、ファイル名、節約量、テストが含まれる | なし | はい | (c) |
| review-army-red-team | test/skill-e2e-review-army.test.ts:651 | 出力が red team/adversarial に一致 | Agent/Task の割り当て説明 (perf ケースは :256-258 で読む) | いいえ | (b) |
| review-army-consensus | test/skill-e2e-review-army.test.ts:737-741 | 出力に sql/injection/interpolat が含まれる | Agent の結果にある専門家の JSON 指摘。未検証 | いいえ | (b) |
| review-army-simplification | test/skill-e2e-review-army.test.ts:806-815 | 出力に native/stdlib/speculative/… が含まれ、"lean already. ship." ではない | なし | 一部 | (d) |
| review-army-simplification-precision | test/skill-e2e-review-army.test.ts:868-872 | セルフチェックで削除/縮小の JSON 指摘がない。`NO FINDINGS` の番兵 | 専門家の JSON 行または番兵 | いいえ | (a) |
| review-design-lite | test/skill-e2e-review.test.ts:285-306 | 7 つのキーワード群のうち 4 つ以上 | なし | 一部 | (d) |
| codex-review | test/skill-e2e-workflow.test.ts:478, :481 | Codex のコマンド出力から実行された判定 | lib/outside-review-result.ts | いいえ | (a) |
| codex-review | test/skill-e2e-workflow.test.ts:482 | codex-output.md が `GATE: PASS\|FAIL (N critical\|UNVERIFIED` に一致。fail-closed ではない | 同じ判定 | はい (ゲートの行) | (c) |
| design-consultation-core | test/skill-e2e-design.test.ts:160-161, :186, :190 | DESIGN.md に 7 つのセクション群ごとに同義語が 1 つ。CLAUDE.md が design.md に言及 | 内容の出典はなし | はい | (c) |
| design-consultation-research | test/skill-e2e-design.test.ts:253, :263 | "Search unavailable" は WebSearch/aside の呼び出しがない場合のみ | WebSearch / aside のツール呼び出しを先に読む (:243-245) | はい | (a) |
| design-consultation-existing | test/skill-e2e-design.test.ts:314-315, :334-335 | DESIGN.md に color と spacing が含まれる | 形式のマーカーのみ | はい | (c) |
| design-review-fix | test/skill-e2e-design.test.ts:714, :742 | design-audit.md が 47/48px、line-height、radius、padding、spacing、heading に一致 | なし | はい | (c) |
| design-html-slop-gate | test/skill-e2e-design.test.ts:1318-1319 | gate-output.md に ai-color-palette と accepted がある | スキャン呼び出しの回数のみ | はい | (c) |
| design-consultation-core, plan-decision-classification, plan-devex-peer-comparison-classification, diagram-authoring-quality | design :168; classification :150-153, :40-43; diagram :159-183 | — | — | — | judge |

### コンテキスト、スクレイプ、CSO、ヘルス、Aside

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| context-save-then-restore-roundtrip | test/skill-e2e-context-skills.test.ts:221, :231 | 表示内容に魔法のタイトルがある (空振り: Skill の入力に含まれている) | 復元時の保存ファイルの Read/Bash tool_result | いいえ | (b) |
| context-restore-fragment-match | test/skill-e2e-context-skills.test.ts:266-267, :277-278 | 表示内容に PAYMENTS マーカーがあり、ALPHA/OMEGA がない | Read/Bash の tool_result の内容 | いいえ | (b) |
| context-restore-provenance-order | test/skill-e2e-context-skills.test.ts:321-327, :344 | トークンを配置した上で、"Next steps" が "Verify first" より前にある | なし | はい (context-restore/SKILL.md.tmpl:217-221) | (c) |
| context-restore-provenance-order | test/skill-e2e-context-skills.test.ts:328, :335, :338, :345 | `FIRST_ACTION: verify PROV_ASSUMED_7Q` | なし (AUQ は禁止) | いいえ | (d) |
| context-restore-empty-state | test/skill-e2e-context-skills.test.ts:374, :385 | 表示内容が no saved context/NO_CHECKPOINTS に一致 (空振り: 注入された本文に含まれる) | Bash の結果 `NO_CHECKPOINTS` (context-restore/SKILL.md.tmpl:84, :95) | 一部 | (b) |
| context-restore-list-delegates | test/skill-e2e-context-skills.test.ts:413, :423 | 表示内容が `context-save list` に一致 (空振り) | なし | はい | (c) |
| context-restore-legacy-compat | test/skill-e2e-context-skills.test.ts:465-470, :480 | 表示内容にマーカー/タイトル/ファイル名/ブランチ、または改名前の名前がある | 旧ファイルの Read | いいえ | (b) |
| context-save-list-current-branch | test/skill-e2e-context-skills.test.ts:517, :536 | 表示内容が timestamp/main-work に一致 | Bash の一覧の結果 | 一部 | (b) |
| context-save-list-current-branch | test/skill-e2e-context-skills.test.ts:525-526, :537-538 | 最終出力に他ブランチのエントリがない | なし (モデルが描画した一覧) | はい | (c) |
| context-save-list-all-branches | test/skill-e2e-context-skills.test.ts:572-576, :586 | 表示内容に 3 つの timestamp がすべてある | Bash の一覧の結果 | 一部 | (b) |
| scrape-prototype-path | test/skill-e2e-skillify.test.ts:283, :290-294, :304-305 | 表示内容が /skillify/ と `"items": [` に一致 (どちらも空振り: scrape/SKILL.md.tmpl:32, :173 に含まれる) | なし | はい | (c) |
| cso-full-audit | test/skill-e2e-cso.test.ts:139-140 | server.js の指摘の散文が tenant/owner/authoriz に一致 | report.json に class フィールドがない | いいえ | (d) |
| cso-infra-scope | test/skill-e2e-cso.test.ts:227-229 | 指摘の散文が comment body、run/shell、GITHUB_TOKEN に一致 | 同上 | いいえ | (d) |
| health-reporting | test/helpers/health-eval-fixture.ts:132-156 | 描画されたダッシュボード: 総合 5.6、部分的なカバレッジ、typecheck 0/10、"60 errors"、利用不可のカテゴリ、傾向の判定なし、総合 N/A | health-history.jsonl の行 (:158-176 で確認済み) | はい | (c) |
| aside-browse-basic, aside-qa-quick, aside-scrape-json | test/skill-e2e-aside.test.ts:179, :219, :234-239 | 最終メッセージにタイトル。レポートに `health score`。最終 JSON に page1 が含まれる | 未検証 | はい | (c) |
| aside-canary-quick | test/skill-e2e-aside.test.ts:256 | カナリアのレポートが CANARY REPORT/Status: に一致 | `{date}-canary.json` (canary/SKILL.md.tmpl:221)。未検証 | いいえ | (b) |
| qa-b6-static, qa-b7-spa, qa-b8-checkout | test/skill-e2e-qa-bugs.test.ts:158, :177-179 | — | — | — | judge |

### オフィスアワー、gbrain、codex、外部レビュー、安全性、ベンチマーク

| ケース | 確認箇所 (file:line) | 一致条件 | 構造化データの出典 | ユーザーに見えるか | 処理区分 |
|---|---|---|---|---|---|
| office-hours-phase4-fork | test/skill-e2e-office-hours-phase4.test.ts:190-191 | 書かれた質問に `because` があり、選択肢の行が 2 つ以上 | なし (プロンプトにより AUQ は抑止、:128) | はい | (c) |
| office-hours-phase4-fork | test/skill-e2e-office-hours-phase4.test.ts:193 | approach/architecture の語彙、または Server/Client/Hybrid の選択肢 | なし。ネイティブのキャプチャがあれば構造化される | いいえ | (d) |
| office-hours-phase4-fork | test/helpers/llm-judge.ts:496-516 (test/helpers/e2e-helpers.ts:320-322 経由) | 決定論的な `Recommendation:` と `because` が judgeRecommendation の一部 | なし | はい | (c) |
| office-hours-design-draft | test/helpers/office-hours-completion.ts:107-115 | 設計書に実質的な Problem/Approach/Success/"What I noticed" と Assignment のセクションがある | なし | はい | (c) |
| setup-gbrain-bad-token | test/skill-e2e-setup-gbrain-bad-token.test.ts:60-61 | `JSON.stringify(result)` が error_class AUTH/rotate token に一致 (ヘルパー自身の stdout で満たされる) | 検証用 JSON の `error_class` (bin/gstack-gbrain-mcp-verify:64)。:65-67 で確認済み | 一部 | (b) |
| setup-gbrain-remote | test/skill-e2e-setup-gbrain-remote.test.ts:326-328 | シリアライズした transcript に `"error_class": NETWORK/AUTH/MALFORMED` が含まれてはいけない | Bash の結果にある検証用 JSON | いいえ | (b) |
| setup-gbrain-remote | test/skill-e2e-setup-gbrain-remote.test.ts:352 | CLAUDE.md が `Mode: remote-http` に一致 | 保存された設定ブロック | はい | (c) |
| setup-gbrain-path4-local-pglite | test/skill-e2e-setup-gbrain-path4-local-pglite.test.ts:72-73; test/helpers/setup-gbrain-fixture.ts:122-169 | 質問が code search/pglite/symbol に一致。台本型アクターが選択肢のラベルを分類し、未知の集合では例外 | AUQ のラベルのみ。選択肢の ID はなし | はい | (c) |
| sync-gbrain-read-ready, sync-gbrain-read-unknown | test/helpers/sync-gbrain-readiness-verdict.ts:4-25 | 機能の行が OK/WARN、判定が YELLOW、否定されていない ready の主張がない | bin/gstack-gbrain-read-capability.ts:87 のステータス JSON (ステータスのみ。行と判定は描画される) | はい | (c) |
| codex-discover-skill | test/helpers/codex-eval.ts:43 | 出力が review/gstack/skill に一致 | なし | 一部 | (d) |
| codex-review-findings | test/helpers/codex-eval.ts:66-67; lib/outside-review-result.ts:88 | 出力が finding/issue/…/no issues に一致。拒否の表現は unavailable として扱う | 実行されたコマンドを先に読む。フィクスチャにはレビューログの手順なし | 一部 | (d) |
| outside-voice-codex-to-claude-code, outside-voice-claude-code-to-codex | test/helpers/outside-voice-evidence.ts:214-216 | 外部の stdout が invoice と authorization の欠陥に一致し、拒否がない | 呼び出しとレシートは構造的に確認。レビューログの行はステータスのみ保持 | いいえ | (d) |
| outside-plan-disabled-no-fallback | test/helpers/disabled-plan-review-fixture.ts:322-325 | JSON の `outside_review_this_run: disabled` が先、その後に散文 | レビューログの `outside_status:"disabled"` (scripts/resolvers/outside-voice-steps.ts:331) | はい | (a) |
| outside-plan-disabled-no-fallback | test/helpers/disabled-plan-review-fixture.ts:326-328 | 出典不明の "both reviewers agree" という主張がない | なし | はい | (c) |
| safety-design-risk-stop | test/skill-e2e-safety-design-risk.test.ts:165 | 最終出力が未修正の FINDING-00N をそれぞれ挙げる | どの指摘が残っているかは git log が決める。一覧には記録がない | はい | (c) |
| benchmark-providers-live | test/skill-e2e-benchmark-providers.test.ts:116, :136, :168 | プロバイダーの出力に "ok" が含まれる | なし | はい | (c) |
| office-hours-forcing-energy, office-hours-builder-wildness, office-hours-phase4-fork, safety-design-risk-stop, llm-judge-recommendation, arm-benchmark-* | office-hours :102-107, :183-188; e2e-helpers.ts:323-326; design-risk :166-174; llm-judge-recommendation :42-163; arm-benchmark :121 (ゲートなし) | — | — | — | judge |

フレーズのみによる確認を含まない定期実行ケース: plan-ceo-review, plan-ceo-review-selective, plan-eng-review (終了理由とファイル長の任意確認のみ); autoplan-dual-voice と autoplan-journal-drift (transcript の証拠); journey-* の 11 件のルーティングケース (Skill ツールの入力); context-save-routing; scrape-match-path; qa-fix-loop; retro; office-hours-brain-writeback; gbrain-roundtrip-local; safety-codex-boundary; safety-ios-demo; codex-sol-scope-termination; ios-qa-device; design-consultation-preview; オーバーレイハーネスの 5 ケース (JSON 解析と deep-equal)。

## 変換候補

これらは、8 回の wave 棚卸し(定期の棚卸し 37174266054 から 37198445662まで)を通した赤の履歴の順に並べ、その次にティアと、一つの変更でいくつのケースをカバーできるかで並べています。

1. **S5 画面優先の自動決定**(test/helpers/pty/classify.ts:460)。auto-decide-preserved は 8 回中 3 回で赤になり、いずれも `outcome=timeout` でした。そのリプレイコーパス(test/fixtures/detector-corpora/auto-decide-preserved/)は、二件がプロダクトの失敗(モデルが handoff の行を送らなかった)、一件が既に修正済みの順序の誤判定だったことを示しています。つまり、赤の原因がフレーズの画面そのものだった例はありません。バインドされた question-log の記録に判定を任せ、ネイティブのトランスクリプトのチェックに引き継がせると、office-hours-auto-mode と plan-mode のスモークも同様にカバーできます。ただし、直近の合格したキャプチャ五件のうち二件は、その経路を、アーカイブされたポーリングからは証明できません(そのポーリングは handoff のメッセージより前のものです)。そのため、この変換を取り込むには、有料の診断実行が一度必要です。
2. **shared-libs-opportunity-judgment のトランスクリプトの正規表現**(test/skill-e2e-shared-libs-periodic.test.ts:123)。このケースは 8 回中 2 回赤になりましたが、どちらの赤も judge の失敗でした。そのため、この変換は過去の赤を解消するものではなく、脆いチェックを取り除くものです。
3. **S3/S4/F3 の PTY ターミナル**(test/helpers/pty/classify.ts:425、:467; test/helpers/pty/runners/floor.ts:497)。赤は 0 件です。`plan_ready` と `silent_write` を、ランナーがすでに読んでいるジャーナルの ExitPlanMode と Write の tool_use から導出します。一つの変更で、gate の 4 ケースと periodic の 5 ケースをカバーします。
4. **待機を文言に頼るセットアップのセレクター**(test/helpers/plan-floor-review.ts:278-280、test/helpers/pty/boundaries.ts:653-658、test/helpers/plan-review-board-feedback.ts:111-120、test/skill-e2e-plan-design-with-ui.test.ts:34-57)。棚卸しの赤は 0 件ですが、plan-design-with-ui-scope の PR レーンの赤があります(実行 37166586458、37172907071)。質問を、AUQ のヘッダーとオプションのラベルで識別します。
5. **gate の READY プローブ**(skillmd-no-local-binary と skillmd-outside-git 内。test/skill-e2e-bws.test.ts:156、:194)。最後のメッセージではなく、セットアップブロックの Bash の結果を読みます。
6. **gate の成果物とトレースの置き換え**: context-save-writes-file(フロントマターを解析する)、ship-base-branch(git のトレース)、land-and-deploy-workflow と -first-run(`PLATFORM:` の結果)、setup-deploy-workflow(設定ブロック)、skillify-provenance-refusal の読み込みの罠(Skill tool_result)、shared-libs-review-path-eligibility(`output` のオペランドを外す)。別途、context-recovery-artifacts は、変換する前に `bin/gstack-context-recovery` をそのフィクスチャにコピーする必要があります。
7. **plan-eng-multi-finding-batching**(test/helpers/pty/boundaries.ts:62-116、test/helpers/eng-seeded-coverage.ts:33-104、test/helpers/pty/classify.ts:555)。質問の文言ではなく、回答された AUQ の ID に紐づく決定台帳の R レコードを数えます。
8. **periodic のサーフェスの絞り込み**: context-skills のラウンドトリップ、フラグメント、空の状態、レガシー、一覧のケース。carve-section-loading [plan-eng-review]。review-army の red-team と consensus。setup-gbrain-bad-token と -remote。aside-canary-quick。これらのフレーズチェックのいくつかは、今は空振りです。サーフェスには注入された SKILL.md の本文が含まれるからです。そのため、ツールの結果に絞り込むと、古い赤を取り除くのではなく、新しい赤が表面化します。

ここまでの赤だが、変換候補ではないケース: shared-libs-plan-callers(赤 3 件。アクターのフレーズ拒否 "hardening"。(c))。plan-ceo-section-loading(赤 2 件。報告のチェック (c)、台帳のチェックは既に (a))。plan-review-prosons-neutral-neg(2 件。質問の形式 (c))。plan-ceo-review-format-mode と -format-approach、tpa-absent-darwin、auq-matrix(各 1 件、(c))。plan-design-review-plan-mode(1 件、(d))。scrape-prototype-path(1 件。空振りの (c)。失敗したアサーションは不明)。plan-ceo-mode-routing(1 件。既に (a))。plan-eng-review-artifact(タイムアウト)、shared-libs-read-only(ファイルシステムのスナップショット)、shared-libs-review-revalidation(プロセスの中断)、overlay の sonnet ケース(測定の妥当性)は、フレーズチェックで失敗したものではありません。`SKILL.md workflow` / `platform setup` の四件の赤は、`E2E_TIERS` の外にある skill-llm-eval の judge です。

## 監査していない範囲

- 棚卸しのコミット `a8ace39` から `fd6854b` は、このチェックアウトにありません。そのため、wave の赤の行番号を、アサーションに対応づけることができませんでした。赤は、試行のエラーテキストから帰属させています。
- skill-llm-eval.test.ts の judge ケースは `E2E_TIERS` の外にあり、対象外です。
- codex-ci-access.test.ts、codex-hardening.test.ts、codex-under-codex-detection.test.ts、e2e-shard-reuse.test.ts、skill-routing-e2e.test.ts は、上位のキーの名前を挙げていますが、無料のテストであるか、上で監査したファイルに委ねています。
- plan-eng-review-artifact-full は `marathon` で、対象外です。
- aside-* のケースは、macOS で稼働中の Aside が必要で、CI では一度も実行されません。
- 「構造化されたソース」の列にある「Not verified」は、テンプレートが記録を書くことは確認したものの、フィクスチャがそのヘルパーをインストールしているかは監査で確認していない、という意味です。
