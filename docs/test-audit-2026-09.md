# テスト監査 2026-09: 根拠資料

テスト削減ブランチの根拠資料です(計画は /autoplan で承認済み: 「A, approve as-is」; UC1 は削除として解決)。基準コミットは 65bfb0c (v1.91.6.0) です。計画が PR 本文の表や検証項目を求めている箇所は、ここで解決しています。

## コミット

| コミット | ワークストリーム |
|---|---|
| G | テストインフラの未使用コード(デッドコード)の削除 |
| F | 製品を偽装するテストを、実境界を使うテストに置き換え |
| A | 未使用の評価コードに対するテスト(到達可能性に基づく) |
| B-cleanup | 有料レーンの整理(B1–B4, B6, B7) |
| C | 常に失敗していた finding 件数クラスタを廃止し、そのヘルパーを削減 |
| D | 事象ごとの系列を検出器の所有者へ統合 |
| H | plan-count 履歴 PTY 用の起動準備完了マーカー |
| E | 派生 touchfile 閉包の不変条件(動作変更あり) |
| B5 | ティアレーンのスキップと census judge(動作変更あり) |
| B8 | 11 本の有料評価に対するデフォルトのキャプチャモデル(動作変更あり) |
| Guard | ratchet、共有リゾルバ、CONTRIBUTING、TODOS、ポートフォリオ、本ドキュメント |
| Release | 所要時間の更新、CHANGELOG、VERSION、ドキュメントの整備 |

## C0 トリアージ(コミット G の前に記録)

2026-09-29 にコミット G の前に記録。情報源は、定期 Periodic Evals の実行 3 件、34812905093 (09-14、各実行の sha あり)、35567915613 (09-21、a6b3a575)、36385945043 (09-28、65bfb0c 時点)です。
事前確認: `gh` は認証済み(git.capy.ai プロキシ、アカウント garrytan)。`gh run download` は 401 になるが、REST の `actions/artifacts/<id>/zip` 経路は動作する。3 件の実行とも成果物は保持されている(期限切れではない)。
ファイルごとの根拠: 09-28 = アップロード済みのシャードごとの PTY 成果物(observation.json とターミナルログ)。09-14/09-21 = eval-slices ジョブのログにある、シャードごとの失敗の末尾(bun の出力 + observation のダンプ + 直近 3KB のターミナル証跡)。ローカルコピーは監査ワークスペースの c0/ にあります。

分類: product = スキルが finding ごとに質問しなかった; harness = PTY/分類器/タイムアウト/起動の問題; budget = 締め切りに達した時点でも実モデルが進行中。
一致ルール: harness と budget はどちらも製品以外の分類であり、すべての成果物が harness または budget のとき(product が一つも見られないとき)にファイルを削除する。それ以外は残して除外する。

| ファイル | 09-14 | 09-21 | 09-28 | 分類 | 対応 |
|---|---|---|---|---|---|
| skill-e2e-autoplan-chain | harness: セッションが 13 秒で終了、フェーズマーカーなし(起動) | harness: コンテキスト圧縮後、observer が phase-3 マーカーしか見ていない。トランスクリプトは CEO、Design、DX の方法論ファイルを参照し、「Phase 3 complete」と記載 | budget: 順序どおり phase-1, 2, 2.5 に到達した後タイムアウト(2 回の試行、160 分) | harness/budget | 削除 |
| skill-e2e-plan-ceo-finding-count | harness: 5 件の finding のケースが 11 秒で終了。対になるケースはタイムアウト | harness: モデルが 8 件の finding 判断を質問(SQL lookup、Email errors、Orders load、Tests、Sequencing、TODO…)。分類器がすべて preReview とラベル付け → `no_review_questions` | harness: 分類器が「Unsupported current CEO decision; cannot exclude it from the 4–7 count」で例外。対になるケースは plan_ready に到達(review=2) | harness | 削除 |
| skill-e2e-plan-eng-finding-count | harness: finding ごとの質問 D3 が描画された。フィンガープリントはスピナーのノイズ。step0=4、review=0 | harness: 廃止済みのレガシー oracle「mandatory legacy regression coverage absent」が reviewCount=9 で発生し、その後シャードの壁時計タイムアウト | harness: モデルが finding ごとの判断 D1–D8/D9 を質問し、すべて preReview とラベル付け → review=0 で締め切り | harness | 削除 |
| skill-e2e-plan-design-finding-count | harness: 1.7 秒で終了 | harness: BAND FAIL、上限超過(5 件の finding に対して review=8 > 7。finding ごとの質問に加え余分な質問もあった) | budget: review=4 と review=5 の時点でタイムアウト。まだ質問中 | harness/budget | 削除 |
| skill-e2e-plan-devex-finding-count | harness: 2.1 秒で終了 | harness: reviewCount=9 かつ outcome=plan_ready なのに、seed 分類器が `missing-quickstart` を見逃した。再試行はシャードの壁時計タイムアウトに到達 | pass(plan_ready、review=6) | harness | 削除 |

どの成果物にも製品の失敗は見られないため、C3 の issue は起票しない。C0 で残すための TODO エントリも不要。

## セキュリティ対応表(F)

| design/test/serve.test.ts の mirror 'path traversal protection'(5件) | design/test/serve.test.ts の実 serve() リロードの閉じ込め | design/src/serve.ts の startsWith(allowedDir) ガードを削除 → テスト 1 が失敗 |
| browse/test/terminal-agent-internal-handler.test.ts 1–3(internalHandler/route のソース grep。grant と revoke の認証ゲート) | browse/test/terminal-agent-integration.test.ts の「/internal/grant and /internal/revoke bearer auth」(no/wrong/valid × grant/revoke と状態変化の確認) | internalHandler を経由しないように revoke ルートを書き換え(bearer チェックなし) → 「revoke: no token…」と「unauthenticated revoke…」が失敗 |
| server-security-surface「/health carries no security field and server.ts does not import getStatus」(#2557) | extension-token「GET /health is liveness-only」(実際の /health のボディ。デフォルトとヘッド付き/固定オリジンの両方) | /health のボディに `security: 'protected'` を注入 → 2 件失敗 |
| server-security-surface「security.ts no longer exports the unfed status surface」 | 同じ /health ボディのチェック。getStatus の唯一の利用元は /health.security だったため、未使用の export はユーザーから見える影響がない | (上の行でカバー) |
| server-security-surface「the sidepanel shield markup is gone」 | 同じ /health ボディのチェック。シールドの唯一のデータ源は /health.security で、それが存在しないことを確認 | (上の行でカバー) |
| server-security-surface:60-66「server.ts still consumes the sidecar on the inject-scan path」(ENG-OV9) | pty-inject-scan「/pty-inject-scan — L4 sidecar verdict drives the response」(実際の buildFetchHandler。sidecar クライアントは子 bun テストでモック) | server.ts の `if (sidecarAvail.available && verdict !== 'BLOCK')` を `if (false)` に置き換え → 失敗 |
| server-security-surface:68-76「security.ts keeps the pure combiner + canary exports」 | browse/test/security.test.ts が THRESHOLDS、combineVerdict、generateCanary、injectCanary、checkCanaryInStructure、extractDomain を import して実行 | injectCanary の export を外す → SyntaxError「Export named 'injectCanary' not found」、security.test.ts が失敗 |
| server-security-surface「/health stays liveness-only: no token in any mode」 | extension-token「GET /health never carries a token (IRON RULE)」(3件、既存)+ liveness-only テスト | `token: authToken` を注入 → 5 件失敗 |
| server-auth「/health never serves a token — no headed-mode or chrome-extension carve-out」 | extension-token の IRON RULE テスト(ヘッド付き、固定 Origin、両方) | `token: authToken` を注入 → 5 件失敗 |
| server-auth「/health does not expose currentUrl or currentMessage」; security-audit-r2「/health endpoint security」(2件) | extension-token「GET /health is liveness-only」 | `currentUrl: 'x'` を注入 → 2 件失敗 |
| sidebar-tabs「/health no longer surfaces agentStatus or messageQueue length」 | extension-token「GET /health is liveness-only」(terminalPort が残ることも確認) | `agentStatus: 'idle'` を注入 → 2 件失敗 |
| security-audit-r2「Task 1: validateOutputPath uses realpathSync」のソース grep(4件)+ 動作テスト(5件) | browse/test/path-validation.test.ts「validateOutputPath — symlink resolution」+「validateOutputPath」の許可/拒否ケース(path-security を直接 import するように変更) | validateOutputPath の両方の realpathSync の解決を、解決されていないパスに置き換え → シンボリックリンクのケースが失敗 |
| security-audit-r2「results.push is present in the loop block」「viewport case uses rawW/rawH」(識別子の grep であり、セキュリティ契約ではない) | 残す兄弟テスト:「validateOutputPath appears before page.screenshot() in the loop」「viewport case clamps width and height」 | 該当なし。識別子名のみ |
| test/skill-e2e-brain-privacy-gate.test.ts(有料、一度も緑にならず): プライバシーの質問は成果物が外部へ送信される前に一度だけ発生する | test/gstack-skill-start.test.ts「artifacts-sync consent is asked before any artifacts egress, and only in interactive sessions」 | 日次の pull から sync モードのゲートを外す → 失敗(pull のスタンプが同意保留のまま書かれる)。対話専用の条件を外す → 失敗(生成されたセッションにゲートが出る) |

## 混在ファイルと統合の一覧

### F(製品を偽装するテスト)
| ファイル | ブロック | 判断 |
|---|---|---|
| design/test/serve.test.ts | ファイル全体(インラインの mirror サーバーに対する 16 件のテスト) | 削除。エフェメラルポートで実 serve() を動かす 2 件のテストに、その場で置き換え |
| test/gbrain-init-rollback.test.ts | ずれたローカル bash コピーを実行する 3 件のテスト | 削除。ロールバックの契約は、テンプレートから抽出したブロックを実行する test/gbrain-init-voyage-code-3.test.ts に移動 |
| test/gbrain-init-voyage-code-3.test.ts | ローカルコピーの voyage のケース(4件) | 移動。3 か所のテンプレートの init ブロックをそれぞれ実行するように変更 |
| test/gbrain-init-voyage-code-3.test.ts | 「demonstrates the #1798 collision」 | 削除(zsh 自体をテストしている) |
| test/gbrain-init-voyage-code-3.test.ts | テンプレートの grep による件数テスト(3件) | 残す(「template alignment」の 1 テストに統合) |
| browse/test/browser-manager-unit.test.ts | 「signature accepts an optional exitCode argument」「server.ts callback forwards exitCode…」 | 削除(トートロジー)。実際の所有者は server-factory の「buildFetchHandler chains cfgBrowserManager.onDisconnect」 |
| browse/test/memory-command.test.ts | 「12. text mode renders modificationHistory with evicted-count when > 0」 | 削除(ローカルのリテラル 2 つを比較している)。ギャップ: evicted-count のサフィックスは所有者側でテストされていない |
| test/ios-qa-swiftui-tap-regression.test.ts(+ fixture 2 件、98 KB) | ファイル全体 | 削除 |
| test/memory-ingest-no-put_page.test.ts | ファイル全体 | 削除。gstack-memory-ingest.test.ts の偽 gbrain が put/put_page で終了コード 99 を返す |
| browse/test/terminal-agent-internal-handler.test.ts | テスト 1–3 | 削除。terminal-agent-integration の「/internal/grant and /internal/revoke bearer auth」(3×2 + 状態変化)に置き換え |
| browse/test/terminal-agent-detach-reattach.test.ts | テスト 1, 4, 5, 6 | 削除(terminal-agent-ring-buffer-runtime と重複) |
| browse/test/terminal-agent-detach-reattach.test.ts | テスト 2, 3, 7–10 | 残す |
| browse/test/server-security-surface.test.ts | 6 件すべて | 削除。セキュリティ対応表を参照 |
| browse/test/server-auth.test.ts | 「/health never serves a token — no headed-mode or chrome-extension carve-out」「/health does not expose currentUrl or currentMessage」 | 移動 → extension-token「GET /health is liveness-only」+ IRON RULE |
| browse/test/security-audit-r2.test.ts | 「/health endpoint security」(2件) | 移動 → extension-token「GET /health is liveness-only」 |
| browse/test/security-audit-r2.test.ts | Task 1 のブロック(ソース 4 件 + 動作 5 件)、「results.push is present…」、「viewport case uses rawW/rawH…」、AGENT_SRC | 削除。validateOutputPath は path-validation が所有 |
| browse/test/security-audit-r2.test.ts | escapeRegExp の動作テスト | 残す。path-security を直接 import(meta-commands の再 export は削除済み) |
| browse/test/security-audit-r2.test.ts | state-load、inbox、responsive、CSS バリデータの順序の grep | 残す(唯一のガード) |
| browse/test/sidebar-tabs.test.ts | 「/health no longer surfaces agentStatus or messageQueue length」 | 移動 → extension-token の liveness-only(terminalPort も確認) |
| browse/test/sidebar-tabs.test.ts | 「browse/src/sidebar-agent.ts is gone」「sidebar-agent test files are gone」 | 削除 |
| browse/test/sidebar-ux.test.ts | 「stop button style exists」「stop button uses error color」「experimental-banner no longer uses amber…」「tool description uses system font not mono」 | 削除+未使用の CSS(.stop-btn、.experimental-banner、.agent-tool、.agent-reasoning。67 行) |
| browse/test/sidebar-ux.test.ts | 「switchTab has bringToFront option」(:50 と重複)、「shutdown kills the terminal-agent via identity-based kill」(terminal-agent-pid-identity と重複)、「quick actions toolbar has cookies button」(sidebar-tabs の quick-actions と重複) | 削除 |
| test/skill-validation.test.ts | 「Generated SKILL.md freshness」(3件) | 削除(C14)。gen-skill-docs のプレースホルダの正規表現を \w+ に拡張 |
| test/gen-skill-docs.test.ts | 「generated header is present in SKILL.md」「…in browse/SKILL.md」 | 削除(C14)。「every skill has a generated SKILL.md with auto-generated header」が両方をカバー |
| test/post-rename-doc-regen.test.ts | 「top-level SKILL.md exists and is regenerated」 | 削除(C15) |
| test/static-no-legacy-writes.test.ts | 「office-hours/SKILL.md uses --log-session, not raw echo append」 | 削除(C15)。.tmpl の対応テストと鮮度テストがある |
| make-pdf/test/coverage-gaps.test.ts | 19 件すべて | 移動 → diagram-prepass.test.ts(18 件)と render.test.ts(screenCss) |

### A(未使用の評価コード)
到達可能性ツール: 監査ツール reach.ts(ts-morph。ルート = test/helpers を import するヘルパー以外のすべてのファイル、bin/gstack-model-benchmark、outside-voice のシム。辺 = 識別子 → トップレベルのヘルパー宣言。固定点まで BFS。--prune で到達しない宣言と未使用の import を削除し、0 件になるまで再実行)。
65bfb0c 時点の基準値: 未使用の宣言 12 件 = A4 の 10 個の名前 + `execGit`(auq-sdk-capture)+ `invokeAndObserve`(claude-pty-runner)。A のテスト削除の後は 33 件が未使用(eng-seeded-coverage の oracle の閉包 2,626 行、autoplan-artifact-permission の approvers 474 行、matchesAutoplanDigestRows 86 行、上記の 12 件)。2 回目のパスで 0 件。

| ファイル | ブロック | 判断 |
|---|---|---|
| A1 の純粋なファイル 25 件 + eng-native-seed-contract.test.ts | すべて | 削除(native-seed-contract の 61 件のテストはすべて evaluateEngSeedCoverage を呼ぶ。ライブの pty-runner のアサートを含む 3 ブロックは plan-eng-finding-count のコールバックを再生しているだけ。hasNativePlanTerminal / isQuestionlessNativePlanExit / classifyPlanCountFrame は plan-count-pending-exit、plan-count-empty-review、plan-count-completion が所有を維持) |
| eng-count-ad-v2 | 「first attempt … D9 handoff」「prior successful plan Write…」「closed handoff…」「new task references…」「conditional closure…」 | 削除(isEngCompletionHandoff) |
| eng-count-ad-v2 | 「new first-finding and handoff paths…」 | 最初の finding の半分(engFirstReviewAUQ)は残す。handoff の半分は削除 |
| eng-count-ad-v2 | census() | 残す。使われなくなった handoff の述語の引数を削除(リトライの census は変化なし: administrative 0) |
| eng-count-ad-v2 | ライブの 6 件 + touchfile テスト | 残す(touchfile テストは eng-completion-handoff のパス行を失う) |
| eng-resolution-block-position | テスト 1–3 | 削除(handoff / seed oracle) |
| eng-resolution-block-position | 「saved native Header and Options…」(createEngBatchingIssueCounter) | 残す |
| eng-seeded-completion-ai | 「complete native navigation preserves conflicting current states…」 | 削除(handoff) |
| eng-task-pause-navigation-f359 | check() と handoff のテストすべて | 削除 |
| eng-task-pause-navigation-f359 | 「handoff alone never supplies a native terminal…」 | 残す(hasNativePlanTerminal)。admin の集合は完了した呼び出しのシグネチャに変更 |
| eng-next-handoff-ah | handoff のテスト 18 件+ parser-ACK の再生 | 削除 |
| eng-next-handoff-ah | 「exact final exit/report replay…」「actual pending ExitPlanMode…」 | 残す(hasNativePlanTerminal、isCurrentPlanApprovalScreen) |
| eng-published-navigation | handoff のチェック約 150 件 | 削除 |
| eng-published-navigation | retry、real-completed、D19、investigation、cf74 のターミナル再生 | 残す(hasNativePlanTerminal)。中の未使用の handoff/phase のアサートは除去 |
| eng-seeded-coverage.test | evaluateEngSeedCoverage/isEngSeedDecisionAUQ に基づく oracle のブロック 23 件と describe 6 件 | 削除 |
| eng-seeded-coverage.test | 「Eng semantic native evidence boundary」、touchfile テスト、「batching caller counts…」 | 残す |
| autoplan-edit-digests-al / clipped-suffix-aq / pending-artifact | approver のケース(8/8/8) | 削除 |
| 同じ 3 ファイル | recorder/launcher のケース | 残す |
| A2 の再生ファイル 11 件 | すべて | 削除 |
| autoplan-permission-viewport | 27 件のテスト(autoplan-phase-order + pty-current-screen) | 削除。取り込んだ設定上書きカードのアサートは claude-pty-runner.unit の「isPermissionDialogVisible」に移動 |
| autoplan-phase-observation | 44 件のテスト(すべて phase-order のヘルパー経由) | 削除 |
| eng-finding-fixture.test | seeder + レガシー認証 fixture のテスト(5件) | 削除 |
| eng-finding-fixture.test | 有料の eng-finding-count ファイルに対する prompt-builder のピン 2 件 | C まで残す(計画では「4 件の prompt-builder テスト」とあったが、実際は 2 件のみ) |
| ceo-paired-payment-fixture、design-ui-scope、plan-skill-completion、pty-current-screen、required-reads、transcript-section-logger の各テスト | すべて | 削除 |
| plan-count-fixture | design-ui-captured の 3 ケース + captured-question の偽の配線 | 削除 |
| autoplan-phase-handoff | 「captured parent text…」の readPlanSkillCompletion のアサート | その行を削除。テストは残す |
| plan-seed-submission | PtyCurrentScreen のデコーダ | 本番の createPtyScreen に置き換え(58/58 が通過) |
| touchfiles.test | 「native completion changes select the Design UI gate」の plan-skill-completion のパス | each リストから削除 |

### B-cleanup(B1–B4、B6、B7)
| ファイル | ブロック | 判断 |
|---|---|---|
| skill-llm-eval-spec、skill-e2e-spec-execute、gemini-e2e(+ gemini-session-runner + test)、skill-e2e-ship-idempotency、オーバーレイの opus-4-7 *-sonnet ラッパー 2 件(+ fixture のエントリ)、skill-e2e-conductor-prose、codex-e2e-plan-format、skill-e2e-brain-privacy-gate | すべて | 削除(B1/B7) |
| conductor-prose-observation-ao.test.ts + fixture | すべて(削除した有料の呼び出し元のソースを評価していた) | 有料ファイルと一緒に削除 |
| plan-tune-cathedral-fixture.test.ts | すべて(注入したフェイクの下で cathedral ファイルのソースを評価していた) | 削除。cathedral のシナリオは無料スイートで直接実行する(B3) |
| skill-llm-eval.test.ts | 「regression vs baseline」 | 削除(B2) |
| skill-llm-eval.test.ts | 「command reference table」「snapshot flags reference」「browse/SKILL.md reference」 | 統合して 1 つの union judge「browse/SKILL.md reference」にまとめる(B2) |
| skill-llm-eval.test.ts | 「baseline score pinning」 | union judge に統合(eval-baselines.json の browse_skill を固定) |
| skill-e2e-opus-47.test.ts | ルーティングの否定対照 3 件 | skill-routing-e2e の「journey-negatives」に移動(同じ 1/3 以下の上限)。肯定例は skill-routing-e2e に既にある |
| skill-e2e-ios.test.ts | 「ios-qa E2E (with device)」の HAS_DEVICE スタブ | 削除(B3) |
| gstack-skill-start.test.ts | 新規の「artifacts-sync consent is asked before any artifacts egress…」 | 追加(B7: 既存のピンは順序を確認していなかった) |
| 有料の件数リテラル(paid-retry-supervision、paid-overlay-scheduling、overlay-lifecycle、overlay-measurement、paid-shards、touchfiles、periodic-fixture-selection、codex-eval-selection、paid-pr-profile) | 件数 / キーの一覧 | 削除されたファイルとキーに合わせて更新(削除されたキーを指すアサート以外は、アサートを除去していない) |

### C(finding 件数クラスタの廃止、C2 のヘルパー削減)

ルール: 無料テストのブロックは、すべてのアサート対象が C の後の閉包(削除されたヘルパー、または登録アダプタ経由で読み込まれる削除済みの有料ファイル)の外にある場合に削除する。デッドコードを入力ビルダーとしてだけ使い、対象は生きているブロックは、ビルダーを置き換えるか復元する(下表の行)。LIVE のブロックは残す。touchfile の自己アサートは削除されたキーだけを失う(削除は E が行う)。

| ファイル | ブロック | 判断 |
|---|---|---|
| test/skill-e2e-autoplan-chain.test.ts | ファイル全体 | 削除(C1。C0 の分類は harness/budget、トリアージ参照) |
| test/skill-e2e-plan-ceo-finding-count.test.ts | ファイル全体 | 削除(C1。C0 の分類は harness/budget、トリアージ参照) |
| test/skill-e2e-plan-design-finding-count.test.ts | ファイル全体 | 削除(C1。C0 の分類は harness/budget、トリアージ参照) |
| test/skill-e2e-plan-devex-finding-count.test.ts | ファイル全体 | 削除(C1。C0 の分類は harness/budget、トリアージ参照) |
| test/skill-e2e-plan-eng-finding-count.test.ts | ファイル全体 | 削除(C1。C0 の分類は harness/budget、トリアージ参照) |
| 無料のテストファイル 84 件(コミット内の一覧) | ファイル全体 | 削除。すべてのブロックが削除されたヘルパーまたは削除された有料ファイルしか使っていなかった |
| test/autoplan-eval-budget.test.ts | ファイル全体(AUTOPLAN_CHAIN_BUDGET、専用スライス) | 削除。timer の安全性と明示的な上書きのチェックは eng-finding-retry-budget の「ordinary tiers and registered allocations remain unchanged」に移動 |
| test/plan-review-native-default.test.ts | 3 件のテスト(multiSelect の省略時のデフォルト) | 移動 → plan-review-decisions の「an omitted native multiSelect receives the false default only in evaluator input」(削除の確認あり) |
| test/autoplan-chain-fixture.test.ts | 「native sequencing config reaches the real CLI reader…」 | 移動 → plan-count-fixture.test.ts。他の 3 件は削除(チェーンのソースのピン) |
| test/eng-finding-fixture.test.ts、test/design-finding-fixture.test.ts | ファイル全体 | 削除(削除された有料ファイルを読み込む / import している) |
| test/ceo-current-decision-record.test.ts(PROD-TOUCH) | 28 件すべて | 削除。plan-ceo-review のテンプレートを、廃止された ceo-payment-findings カウンタの入力としてだけ読んでいた |
| test/devex-finding-fixture.test.ts | DX の登録(8 件)+ 実体化された devex-existing-sdk のチェック(5 件) | 削除(削除された DX 件数評価だけが使う fixture)。「every host exposes the DX per-call rule…」は残す |
| test/ceo-finding-fixture.test.ts | 「native count registration: %s」(11 件) | 削除(削除された有料ファイルを import している)。fixture のテストは残す |
| test/eng-semantic-terminal.test.ts | evaluateEngTerminalReview/buildEngSeedDecisionInput のブロック(6件)、登録ループ(7件) | 削除。「real native Exit…」と「a late substantive answer…」は、dead な assessor の代わりに直接の id コールバックを使って残す |
| test/eng-seeded-coverage.test.ts | 「Eng semantic native evidence boundary」describe、2 件の混在テスト、touchfile テスト | 削除(buildEngSeedDecisionInput は未使用。バリデータは plan-review-decisions が所有) |
| test/plan-count-fixture.test.ts(PROD-TOUCH) | 実 PTY の子ワーカー | 残す。未使用の design/devex の述語はインラインの呼び出し側ポリシーに置き換え。dead な分類器のアサートは削除 |
| test/plan-count-native-input.test.ts | design の outside-voices のケース | 残す。pickDesignCountOutsideVoices はインラインの呼び出し側ポリシーに置き換え。autoplan のルーティングのテストは削除 |
| test/plan-pending-question-pty.test.ts | hook の PTY テスト | 残す。autoplanSetupDecision のナビゲーションは固定のネイティブキー列に置き換え |
| test/helpers/claude-pty-runner.unit.test.ts | findModeOption(7 件)、design/devex の Step0 + first-review(14 件) | 削除。プロンプトパーサーのテスト 2 件は、dead な境界のアサートを削って残す |
| test/autoplan-method-read-audit.test.ts、autoplan-phase-handoff、autoplan-publication-guard、plan-count-session-cwd、autoplan-preconfigured-onboarding-ar(PROD-TOUCH) | chain の呼び出し元のピン以外すべて | 残す。ヘルパー autoplan-method-read-audit.ts / autoplan-preconfigured-fixture.ts は復元(本番の phase-publication フックと skill-start に適応している) |
| test/autoplan-artifact-recorder、autoplan-edit-digests-al、eng-test-plan-edit-approval | recorder のテスト | 残す。readPendingAutoplanArtifact は復元(recorder は claude-pty-runner が import している) |
| test/carve-guards(ヘルパー) | autoplan の externalTest | 挙動の 'none'(チェーンがセクション読み取りを証明する唯一のものだった。TODOS にエントリあり) |
| 再生ファイル 20 件(ceo-completion-handoff-m/-o、ceo-handoff-y、ceo-count-ad-v2、design-count-native-8525、…) | MIXED/DEAD のブロック | 削除。LIVE のブロックは残す(hasNativePlanTerminal の admin 除外は eng-published-navigation / eng-next-handoff-ah が所有) |

削除したヘルパー(11件): autoplan-setup-question, ceo-approach-pick, ceo-completion-handoff, ceo-payment-findings,
design-artifact-question, design-count-fixture, design-count-outside, design-count-review, devex-count-fixture,
devex-seed-coverage, eng-count-question-policy。claude-pty-runner と eng-seeded-coverage は、有料のルートの閉包に合わせて縮小しました。
これらの削除によって孤立した fixture 135 件を削除しました(fe011e0 に対する orphans.py の差分)。加えて test/fixtures/devex-existing-sdk/ も削除しました。
既知の選択上の影響(計画の定義上は回帰ではありません。E が閉包を導出します): lib/autoplan-phase-publication.ts、bin/gstack-decision-log、lib/gstack-decision.ts、そして claude-pty-runner を import している recorder/dx-navigation ヘルパーは、以前は引退した eval のみを選択していましたが、E の完了までは何も選択しなくなりました。
C2 の範囲外のため、そのまま残したもの: ceo-finding-fixture の seedCeoPaymentProject/pickSuppliedCeoPlanStart と test/fixtures/ceo-existing-payment(有効な有料の利用者がなく、C2 のヘルパー一覧にも含まれないため)。

### D(インシデントごとの系列の統合)
仕組み: 各インシデントのファイルを、その検出器の所有者テストに `describe('<incident>')` ブロックとして、そのまま折りたたみます(監査ツール merge-into.ts)。import は先頭にまとめ、インシデントごとの束縛はローカルの const として復元します。そのため、どのケースも同一のフィクスチャに対して同一のコードを実行します。削除したのは、インシデントのファイル自身のタッチファイル登録を確認するテスト(E 型。そのパスはもう存在しません)のみです。ファミリーごとの集計は「所有者 + インシデント(統合前)」と「所有者(統合後)」を比べ、パス数は「統合前 − 削除分」に一致し、失敗は 0 でなければなりません(監査ツールの family.sh)。インシデントの名前が入っていたタッチファイルのリストは、所有者の名前に置き換えています(監査ツールの tfreplace.py)。行は値のテーブルに書き直していません。そのまま折りたたむ方法では、インシデント固有の制御を取りこぼすことがないためです(レーン 3 の C7 のリスク注記)。

| 検出器 | 所有者 | 折りたたんだインシデントのファイル(完全なパス) | テスト数 統合前 → 統合後(自己登録は削除) |
|---|---|---|---|
| hasStaleFillRaceFinding | test/ceo-section-loading-fixture.test.ts | test/sdk-columnar-af, sdk-compact-sequence-aj, sdk-order-b-ag, sdk-ordered-schedule-ar, sdk-ordering-ae, sdk-original-order-ai, sdk-reported-coordination-ar, sdk-schedule-continuation-ah, sdk-stale-table-ad-v3 (.test.ts) | 376 → 368 (8) |
| generateModelOverlay / resolveModel | test/model-overlays.test.ts(新規) | test/model-overlay-fable-5, -gpt-5.6-sol, -gpt-6-astra, -opus-4-7, -opus-4-8, -sonnet-5 | 37 → 37 (0)。オーバーレイのフレーズはすべて維持 |
| coverageAuditVerdict / coverageAuditReadEvidence | test/coverage-audit-evidence.test.ts | test/coverage-audit-af, coverage-audit-aw, coverage-audit-shell-legend-at, coverage-checkbox-tail-av, coverage-diagram-legend-as, coverage-shell-display-aq(coverageAuditReadEvidence を検証) | 149 → 145 (4) |
| autoplan の phase 完了 | test/autoplan-phase-observer.test.ts | test/autoplan-phase-dash-ao, autoplan-with-result-au(autoplan-final-gate-ao は C で削除) | 82 → 80 (2) |
| findNativeAutoDecision | test/native-auto-decide.test.ts | test/auto-decide-current-declaration, -explanatory-mode, -recommendation-scope, -saved-ai, -structured, -target-identity, auto-decision-state(auto-decide-fixture は実データの seeding のため維持) | 859 → 858 (1) |
| claudeOutsideExecutions | test/outside-voice-evidence.test.ts | test/outside-background-ai, outside-voice-async | 49 → 49 (0) |
| engStep0Boundary/engSetupAUQ/engFirstReviewAUQ | test/eng-first-review.test.ts(新規) | test/eng-annotated-cache-au, eng-architecture-cache-av, eng-binding-retry-z, eng-binding-z, eng-cache-brief-am, eng-cache-owner-an, eng-cache-writes-as, eng-count-ad-v2, eng-declarative-as, eng-declared-retry-at, eng-first-category-af, eng-first-review-t, eng-injected-export-aq, eng-library-hooks-aq, eng-scope-y | 256 → 247 (9) |
| hasNativePlanTerminal(完了/引き継ぎ) | test/plan-count-completion.test.ts | test/ceo-completion-handoff-m, ceo-completion-handoff-o, ceo-handoff-y, dx-manual-handoff-ao, plan-count-dx-handoff-o, eng-next-handoff-ah, eng-task-pause-navigation-f359, design-count-native-8525 | 129 → 129 (0) |
| createPlanCountPermissionGuard | test/plan-count-file-permission.test.ts | test/batching-permission-at, design-crop-gutter-ap, plan-count-crop-ak, plan-count-permission-ac, plan-count-quoted-frame-ak | 125 → 121 (4) |
| ceo-mode-option | test/ceo-mode-option.test.ts | test/ceo-hold-commitment-ar, ceo-hold-posture-ag, ceo-mode-colon-at, ceo-mode-full-ad, ceo-mode-posture-ad, ceo-prerequisite-ad-v2 | 463 → 457 (6) |
| plan-scope-selection | test/plan-scope-selection.test.ts | test/design-scope-announcement-ao, design-scope-declaration-ak, design-scope-entry-aq, design-scope-selection-aj, eng-option-b-scope-al, plan-scope-recovery-av | 90 → 84 (6) |
| planCountPrerequisitePick | test/plan-count-prerequisite.test.ts(-n から改名) | test/plan-count-navigation-r, plan-count-prerequisite-n | 38 → 37 (1) |

ネイティブ完了の否定ケースのテーブル: C の後は 3 つのファイルに残ります(eng-first-review に 14 件のインシデントごとのコピー、plan-count-completion に 2 件、dx-selected-navigation-ap に 1 件)。それぞれ異なるキャプチャ済みの呼び出しと、異なる engFirstReviewAUQ の分岐に適用されています。1 つのテーブルにまとめられるのは、engFirstReviewAUQ が入口で一度だけネイティブ完了を確認するようになってから(現状は各分岐がそれぞれゲートしています。claude-pty-runner.ts の engFirstReviewAUQ を参照)に限ります。これは有料の判定に関わるハーネスの動作変更なので、ここでは行わず延期しました(計画との差分。TODOS に記録)。

### E(導出されたタッチファイルの閉包)

選択の回帰の定義(E の証明と削除ルールで使用): サンプルの編集に対する `--tier gate --profile pr --list` の出力で、変更前に選択されていた有料のケースが、無料の `*.test.ts` のタッチファイル項目以外の経路で選択されていたものが、変更後に欠けていること。証明は computePaidCaseSelection(`--list` が呼び出す関数)を使い、689ef30 と E のツリーを比較して計算しました:

| サンプルの編集 | プロファイル | e2e 変更前 → 変更後 | judge 変更前 → 変更後 | 失われたもの | 追加されたもの |
|---|---|---|---|---|---|
| plan-eng-review/SKILL.md.tmpl | pr | 2 → 2 | 1 → 1 | なし | なし |
| plan-eng-review/SKILL.md.tmpl | full | 28 → 28 | 1 → 1 | なし | なし |
| test/helpers/claude-pty-runner.ts | pr | 0 → 1 | 0 → 0 | なし | auq-format-gate |
| test/helpers/claude-pty-runner.ts | full | 15 → 20 | 0 → 0 | なし | auq-format-gate, carve-section-loading, office-hours-section-loading, plan-ceo-section-loading, ship-section-loading |
| test/helpers/plan-count-fixture.ts | pr | 0 → 1 | 0 → 0 | なし | auq-format-gate |
| test/helpers/plan-count-fixture.ts | full | 10 → 20 | 0 → 0 | なし | auq-format-gate, carve-section-loading, office-hours-auto-mode, office-hours-section-loading, plan-ceo-section-loading, plan-design-review-plan-mode, plan-devex-review-plan-mode, plan-eng-review-plan-mode, plan-mode-no-op, ship-section-loading |
| bin/gstack-config | pr | 3 → 3 | 0 → 0 | なし | なし |
| bin/gstack-config | full | 9 → 9 | 0 → 0 | なし | なし |
| test/fixtures/plans/autoplan-dashboard.md | pr | 86 → 86 | 23 → 23 | なし | なし |
| test/fixtures/plans/autoplan-dashboard.md | full | 0 → 0 | 0 → 0 | なし | なし |

書き換え: E2E/LLM judge のリストから、無料の `*.test.ts` の項目を 950 件削除しました。閉包のパスを 653 件追加しました(123 のキーにまたがる 53 種類の異なるヘルパー/fixture)。いずれも、そのキーの有料ファイルが行う実際の静的 import か、リテラルの fixture パスです。閉包の走査は GLOBAL_TOUCHFILES のモジュールで止まり(そこを編集すると、すでにすべてが選択されるため)、選択ロジック自身のモジュール(touchfiles-data/touchfiles/test-selection。マップの差分で確認)は無視します。キーのない有料ファイル(アサーションで確認済み): codex-e2e-recommendation-substance(census のみ。PERIODIC_CI_EXCLUDE)、skill-e2e-auq-consistency と skill-e2e-auq-verbose-vs-carved-ab(定期実行ティアの gate のみ)。
削除したもの: test/periodic-fixture-selection.test.ts(手で複製した一覧)、test/fake-impeccable-touchfiles.test.ts、41 ファイルにある 45 件の選択例(自己登録、または test/ パスへのリテラルの selectTests)。空になった 2 つのファイル(autoplan-clipped-suffix-aq、codex-eval-selection)とその孤立した fixture。非テストパスのみに絞ったもの: 8 件のテスト(CSO の各テスト、mode-question の取得、live runtime の各テスト、mode 入力の各テスト、autoplan-review-discovery、autoplan-snapshot、review-entry-and-design-clarity-au、shared-libs-fixture の生成、devex の calibration、cookie judge ヘルパーの正確性)。
残した選択の意味論のテスト(ES-1): matchGlob のスイート、global touchfile、skill 固有、resolver から consumer への同値性、testing resolver、learnings のレンダリング、browse/aside、gen-skill-docs の範囲指定、unrelated/empty/union、LLM judge、SKILL のルート、完全性、ティア、依存パスの存在、逆方向の不変条件。eval-cli-family、skill-fixture の global、workflow-boundaries F9。
削除の確認: 1 つのキーで test/fixtures/fake-impeccable.ts を置き換えると、不変条件は有料ファイル、パス、import/リテラルの連鎖、キー、検証コマンド、CONTRIBUTING.md#paid-test-touchfiles、および下限の注記を表示します。

## 挙動を変えたコミット: 維持か破棄か

| コミット | 計測 | 判断 |
|---|---|---|
| E | 上記の選択の証明: 4 つのサンプル編集では、どちらのプロファイルでも失われたケースはなし。増えたのは実際の静的依存関係のみ | 維持 |
| B5 | gate レーンは 52 → 42 ファイル、週次 gate の census は 52 → 41(judge はスキップ)、定期実行は 77 → 69。サンプル編集の PR プロファイルの選択は変更前後で完全に一致 | 維持 |
| B8 | 有料実行: gate 16/16 合格。定期実行 28 合格、6 失敗(4 ファイルに集中)。フォールバックを適用: それら 4 ファイルは claude-opus-4-7 のまま。7 ファイルはピンを張り直し。フォールバック後の B8 の推定差分は週あたり +$0.69(opus −$1.43、sonnet +$2.12)。C と B5 の節約を含めると、ゼロ未満になる | 維持(7 ファイル) |

### B8 の支出前の見積もり(2026-09-29 に記録。B8 の有料実行の前)

出典: 直近の週次の定期アーティファクト(run 36385945043 = 09-28、35567915613 = 09-21)、シャードごとの eval JSON の cost_usd。
test/helpers/pricing.ts の価格比: claude-fable-5-1(既定のキャプチャ。lib/eval-model.ts)は入力/出力 $10/$50 / MTok。claude-opus-4-7 は $15/$75(入出力ともに比 0.667)。claude-sonnet-4-6 は $3/$15(入出力ともに比 3.33)。

| ファイル | 旧ピン | 週次 $(09-28) | 既定での推定週次 $ | 差分 |
|---|---|---:|---:|---:|
| plan, design, plan-prosons, plan-format, qa-bugs, retro, office-hours-phase4 | opus-4-7 | 15.78 | 10.52 | −5.26 |
| office-hours, office-hours-brain-writeback | sonnet-4-6 | 0.91 | 3.03 | +2.12 |
| auq-matrix, workflow | opus-4-7 | 保存されたアーティファクトに結果なし | — | ≤ 0(比 0.667) |
| **B8 合計** | | 16.69 | 13.55 | **−3.14** |

同じトークン量を想定しています(詳細度の変化は数値を動かします。比は入力と出力の両方に同じように適用)。
実時間: シャードの実時間は変わらない(予算はモデルに依存しない)。判断基準は次のとおり、固定しました: C と B5 の節約を差し引いた後の B8 の推定純週次ドルがゼロを超える場合、この PR から B8 を外します。推定純額: −3.14(B8) − C の節約(引退した 5 件の eval) − B5 の節約(空のシャード 18 件、census judge 23 件) < 0 → B8 は有料の実行を 1 回だけ行うため進めます。
フォールバックの確認: skill-e2e-office-hours と -brain-writeback の `git log -S claude-sonnet-4-6` は、636175d / #2264(インフラの強化)のみを示し、コスト上の根拠はありません → 両方ともピンを張り直しました。

## 有料の検証とフォールバック

- B2 の union judge「browse/SKILL.md reference」: 合格(clarity 4、completeness 4、actionability 4)、$0.02。フォールバックは不要。元の browse の 3 つの judge は削除済み。
- B6 の `skill-routing-e2e` に折りたたんだ否定ケース: 3/3 が未ルーティング、$0.36。フォールバックは不要。`skill-e2e-opus-47` は削除済み。
- B8 の再ピン実行(B8 のツリーをコミット、`EVALS_ALL=1`、`EVALS_TIER=gate` の後に `periodic`、11 ファイル、デタッチ、記録されたキャプチャ費用は約 $32): gate 16 合格 / 0 失敗。periodic 28 合格 / 6 失敗 / 33 スキップ。失敗はすべて、09-14、09-21、09-28 の週次実行では旧ピンで合格していたため、既定のモデルに起因すると判断: `plan-design-review-plan-mode`(300 秒でタイムアウト、ターンの記録なし)、`office-hours-phase4-fork`(2 つの選択肢による分岐なし)、`plan-review-prosons-neutral-neg`(出力ファイルが書かれず)、`plan-ceo-review-selective` と `plan-eng-review`(600 秒のタイムアウト)、`plan-ceo-review-expansion-energy`(surface-framing のスコア 3 < 4)。フォールバックを適用: skill-e2e-design、-office-hours-phase4、-plan-prosons、-plan は claude-opus-4-7 を維持(TODOS の項目)。残りの 7 ファイルは再ピンのまま。
- 最終的な差分での PR プロファイルの一覧(`--tier gate --profile pr --list`、EVALS_ALL なし): 不明な依存関係(削除したヘルパー、fixture、ワークフローの編集)により、gate のケースをすべて復元: 192 件中 86 件のテスト、42 シャード中 38 件。記録としてのデータ。
- gate census の支出前の見積もり(実行前に記録): 41 の計画ファイル(judge はスキップ)。保存された週次アーティファクトにファイルごとのコストがある 21 ファイルの合計は約 $22。残りの 20 ファイルは保存されたコストがないため、同じ平均で計算すると全体で約 $40〜45。8 つのローカルワーカーでの実時間は約 1〜2 時間。census はこの PR が使う唯一の完全な有料実行です。上記の B8 の実行で、再ピンしたファイルはすでにカバーされています。
- 完全な gate census: 結果は最終レポートと PR の本文に記載。

## 変更前の指標(65bfb0c)

- `bun run test:ubicloud --record-durations`(standard-16、2026-09-29 04:34Z): EXIT 0、1065 ファイル(シャードごとに 1 ファイル)、実時間 142 秒。記録された直列の合計 1,888.2 秒(65bfb0c のコミット済みの durations ファイル。リリースコミットの差分を参照)。生のコピー: 監査ワークスペース metrics/before-durations.json。ログ: 監査ワークスペース ubi-before.log
- ファイル数/LOC の集計: 監査ワークスペース metrics/before-counts.txt
- 有料の --list: before-gate-list.txt(gate 58/119 ファイル、216 件のテストを選択)、before-periodic-list.txt(periodic 100/119)
追跡されているテストファイル: 1187
test/ 以下: 982
test/ の LOC(ts): 274208
test/helpers の LOC: 51390
test/fixtures のバイト数: 16289330 合計
全テストファイルの LOC: 279898
無料のテスト: 27,331 合格、0 失敗(1065 シャード)

## 変更後の指標(リリースコミット、変更前と同じ集計スクリプト)

| 指標 | 変更前(65bfb0c) | 変更後 |
|---|---:|---:|
| 追跡されている `*.test.ts` ファイル | 1,184 | 957 |
| `test/*.test.ts` ファイル | 979 | 755 |
| `test/` の TypeScript の行数 | 274,208 | 227,713 |
| `test/helpers` の行数 | 51,390 | 39,427 |
| `test/fixtures` のバイト数 | 16,289,330 | 9,695,914 |
| すべての `*.test.ts` の行数 | 279,640 | 244,504 |
| 無料のスイート(Ubicloud standard-16、`--record-durations`) | 1,065 ファイル、27,331 合格、実時間 142 秒、直列 1,888.2 秒 | 857 ファイル、20,302 合格、実時間 136 秒、直列 1,737.7 秒 |
| 有料ファイル / gate レーン / 定期レーン | 119 / 58 / 100 | 100 / 42 / 69 |
| 週次 gate census の計画ファイル数 | 58 | 41 |
| このブランチが削除するファイルでの 09-21 の週次定期シャードの分数 | 462 件中 235 | 0 |

`git diff --numstat 65bfb0c..release`: 本番、CI、スクリプト 21 ファイル(+90/−215)。ドキュメント 6(+574/−78、リリースのドキュメント全体の見直し前)。テスト 383(+9,375/−44,379)。テストヘルパー 47(+786/−12,749)。fixture 199(−43,667)。

## 計画との差分

- AUTOPLAN_PREFLIGHT_BUDGET_BYTES(G)は維持: `skill-preflight-budget.test.ts` が実際に生成された出力に対して強制しています。
- 計画を超えて plan-tune-cathedral-fixture.test.ts を削除(B3): 名前を変更したファイルの fixture を再生するだけだったため。
- eng-finding-fixture.test.ts: 計画では 4 つのプロンプト構築テストを挙げていましたが、実際に存在したのは 2 つだけでした。C で、それらが読んでいた有料ファイルと一緒に削除しました。
- C0 の合意ルール: ハーネスと予算は 1 つの非製品グループとして扱いました。5 ファイルのすべてのアーティファクトは、製品ではなくハーネスまたは予算のものでした。
- C は、影響を受ける 8 つの本番ファイルのうち 7 つを残しました。`ceo-current-decision-record` は削除しました。そのテンプレートの読み取りは、削除された counter にしか使われていなかったためです。残したテストのために 3 つのヘルパーを復元しました(`autoplan-method-read-audit.ts`、`autoplan-preconfigured-fixture.ts`、`readPendingAutoplanArtifact`)。
- `CARVE_GUARDS.autoplan` は `behavioral: 'none'` になりました(引退したチェーンが唯一のセクション読み取りの証明だったため)。
- D は、インシデントのファイルを値のテーブルに書き直さず、そのまま所有者の `describe` ブロックに折りたたみます。そのため、どのインシデントの制御も失われません。ネイティブ完了の否定テーブルは、まとめると有料の判定での engFirstReviewAUQ のゲートを変えてしまうため、延期しました(TODOS)。
- E は、閉包の走査をグローバルなタッチファイルのモジュールで止め、選択ロジックのモジュールは除外します。有料ファイルが import するヘルパーは、そのファイルが登録するすべてのケースを選択するようになりました(例: cookie judge のヘルパーはすべての judge を選択)。
- H は `plan-count-history` のみを編集しました。`eng-semantic-terminal` のスリープするケースと `design-artifact-question` は C で削除しました。
- B5 には、スキップを回避する CLI のファイル選択機能がありません。ファイルを `bun test` で直接実行すると、スキップは回避されます。
- 以前のコミットの修正: B コミットの census、judge 数、タッチファイル数、選択のリテラルは古くなっていたため(完全なローカル実行で無料のテストが 9 件失敗)、C の前にそのコミット内で修正しました。

## 保持した誤検知(レーンのレポート §4)

### レーン 1

- `skill-e2e-hermetic-canary.test.ts` — テストインフラに対する有料のテストですが、子プロセスの env/認証/設定がヘルメチックであることを示す唯一の反証可能な証明です($0.02、5〜8 秒、gate と PR プロファイル)。維持。
- `paid-*.test.ts`(8 ファイル、1,948 LOC、無料で約 3.5 秒)— `scripts/test-paid-shards.ts`(1,866 LOC)と `test-pr-profile.ts`、つまり実際の有料ランナーをテストしています。正当なツールのテストです。小さな臭いとして、`paid-free-boundary.test.ts` は `test/helpers/test-selection.ts` の sha256 を固定しており、インシデント名のテスト(`as at 06ed920`、`PR 2956`)を持っています。
- `llm-judge-abort.test.ts`、`llm-judge-frontier.test.ts`(287 LOC、74ms)— すべての judge が使う共有 judge クライアントの単体テスト。維持。
- `llm-judge-recommendation.test.ts` — `judgeRecommendation` の fixture ベースの否定ケースのカバレッジ(約 $0.04)。維持。
- `make-pdf/test/e2e/*` — Linux の無料スイートと、`make-pdf-gate.yml`(macOS)の両方で実行されます。プラットフォームが異なるため重複ではありません。`ci-prereqs.test.ts` は、サイレントにスキップされないための防御テストです。維持。
- Carve/オーバーレイのケースごとのラッパー — C4 を参照。維持。
- `overlay-harness-claude-dedicated-tools-vs-bash-sonnet` — Sonnet 4.6 に `claude.md` を適用しています。本番でも実際にレンダリングされる組み合わせです。維持(D5 とは異なる)。
- `skill-e2e-office-hours` の posture judge、`skill-e2e-benchmark-providers`($0.001)— CLAUDE.md が明示的に定期実行に分類している品質ベンチマーク。維持。
- `codex-e2e-sol-scope.test.ts` — CI では実行されませんが、現在の `gpt-5.6-sol` のオーバーレイの挙動を固定しています。手動レーンへ移動(C2)、削除はしない。
### レーン 2

- `autoplan-overwrite-progress-ax`(70 LOC): `autoplanPermissionProgressKey` をテストしており、`skill-e2e-autoplan-chain.test.ts:205` でライブに使われています。維持(recorder/progress のテストに統合できる可能性あり)。
- `autoplan-artifact-recorder.test.ts`(7.5 秒): ライブのフック承認の所有者。維持。候補 1 を安全にする証明です。
- `auq-format-always-loaded`: 生成された SKILL.md を grep して、AskUserQuestion の形式と、スキルごとの頻度ルールを確認しています。これはプロンプトのバイトの契約です(保持の基準)。維持。
- `auq-error-fallback-hook`、`autoplan-publication-guard/-hook/-generation`、`autoplan-snapshot/-init/-obligations/-methodology-names/-phase-order`、`outside-voice-provenance`、`outside-voice-invocation/-preflight/-routing`: 本番のフック、bin、リゾルバーを実行しています。維持。
- `autoplan-review-discovery`(14 秒): ホストごとの実際のコピー/シンボリックリンクのインストールレイアウトと `bin/gstack-autoplan-snapshot`。維持。コストの大半は、tmp への `gen-skill-docs --host all` 1 回です。生成された出力を複数のテストで共有する候補です(削除ではなく性能の改善)。
- `auq-parallel`(17.4 秒): モックの SDK を通して、有料の AUQ ハーネスの並行性、期限、クリーンアップをテストしています。ハーネスのテストですが、有料実行のコストとタイムアウトの挙動を守ります。維持。シナリオを減らすことを検討する余地あり。
- `carve-guard-completeness`、`carve-section-ordering`、`carve-guards-negative`: carve されたスキルの生成出力の構造を守るガード。さらに、ガードが発火することを示すネガティブな対照。維持。`carve-section-sharding` と `autoplan-eval-budget` は有料ランナーのスケジューリングをテストしています。`test-paid-shards` のテストの隣に移すこともできますが、現状でも問題ありません。
- `outside-voice-fixture`、`carve-plan-fixture`、`autoplan-chain-fixture`: 有料 eval が使う fixture ビルダーのテスト。安価で、有料実行の妥当性を守ります。維持(優先度は低い)。
- 深くは監査していないもの: `autoplan-amend-input`、`autoplan-method-read-audit`、`autoplan-phase-handoff`、`autoplan-dual-voice-*`、`autoplan-owned-state`、`autoplan-preconfigured-onboarding-ar`、`autoplan-pending-question`、`auq-native-capture`、`batching-permission-at`(そのヘルパー `plan-count-file-permission.ts` はランナーで稼働中。兄弟の `plan-count-crop-ak`、`plan-count-permission-ac`、`design-crop-gutter-ap` はこのレーンの対象外)。
### レーン 3

- `plan-count-transcript.test.ts` (252 LOC): ハーネスのように見えるが、`helpers/plan-count-transcript.ts` は `lib/claude-public-transcript.ts` の再 export であり、本番が使っている (`lib/autoplan-phase-publication.ts`、`autoplan/bin/phase-publication-hook.ts`)。Keep。lib の所有者の名前に改名することを検討。
  `plan-count-session-cwd` と `plan-count-cross-cwd-ancestry` も同様 (lib を直接 import)。
- `design-checklist-sync.test.ts`: 生成ファイルのドリフトの契約 (`lib/design-catalog.ts` から `review/design-checklist.md`)。CLAUDE.md に名指しされている。Keep。
- `design-catalog`、`design-md`、`design-detect-contract`、`design-flag-utils`、`review-log`、`review-start-evidence` (13.3 秒、`lib/review-evidence`)、`office-hours-review`、`plan-tune`、`ship-version-sync`、`ship-template-redaction`、`ship-test-detection-markers`、`spec-quality-gate-secret-sink`: 本番のモジュールとバイナリをテストしている。Keep。
- `ship-review-loop.test.ts` のテスト 1 (レンダリングされた各ホストで `**STOP** … run /ship again` がないこと) は、実際の #2391 の回帰を防ぐガード。テスト 2〜3 は完全一致の文の pin ("stay in this invocation and loop") で、緩めてよいが、ここの文章はスキルの指示そのものなので、削除の候補ではない。
- `ship-apple-gate.test.ts`: 順序の assert (Apple のアダプターがブランチのゲートより前) は、文章の中の振る舞い。Keep。
- `spec-template-invariants`、`ship-workflow-clarity`、`ship-plan-completion-invariants`、`eng-scope-entry-ap`、`review-entry-and-design-clarity-au`、`design-scope-entry-aq`、`plan-scope-recovery-av`、`ceo-mode-preference-al` (スキルの文章に対する約 400 件の `toContain`/`toMatch`): 順序のチェック (keep) と完全一致の文の pin (壊れやすい) が混在。assert ごとの見直しが必要で、一括削除の対象ではない。
- `plan-skill-questions.test.ts` (2,439 LOC、22.6 秒、430 テスト): `helpers/plan-skill-questions.ts` は有料のパスで 9 個のヘルパーと 2 個のフィクスチャのモジュールから使われている。大きいがライブ。後で C7 型の統合を行う候補。
- `claude-pty-runner.ts` の export: 有料/ヘルパーのコードから到達できない、トップレベルの宣言は 4 件だけ (111 LOC: `isTrustDialogVisible`、`findModeOption`、`PLAN_SKILL_COUNT_FINALIZE_MS`、`isUnknownSlashCommandVisible`)。小さいので追わない。
### レーン 4

- **`test/setup-codex-scope*.test.ts` (5 ファイル、160 秒。このレーンで最大の時間の無駄):** 各ケースで実際の `setup` を 2 回起動し、グローバルや他人のスキルが変更されないことを assert する。これらはデータ損失を防ぐ安全性の契約であり、各ケースは異なるレイアウト、エイリアス、所有権の形を扱う。例外は `setup-codex-scope.test.ts` の最初のテスト "fixture writes reject physical escapes…" で、これはテストインフラのフィクスチャのガードを試している。AGENTS.md はそのガードを義務付けているので、削除ではなくレーン 5 に回す。
- **`test/cso-cli*.test.ts` (73 秒) と `cso-scanner-cli`:** 各テストは異なる CLI の契約 (recheck の解決、launcher の信頼、redaction、期限)。コンパイル済みの launcher を通るため遅いが、それが実際の境界。
- **`gstack-memory-ingest.test.ts` (75 秒):** 偽の gbrain を使った振る舞いの CLI テスト。"probes the gbrain executable directly…" のソース grep だけが弱く、小さな削除候補。
- **browse/test の cookie-* のクラスタ (14 ファイル、約 65 秒):** 振る舞いのセキュリティテスト (復号、origin の方針、Keychain の拒否、隔離された Chromium の認証)。カバーする層が異なるため、重複はない。
- **browse の xvfb (43 秒)、handoff (55 秒)、commands (36 秒):** 実際の振る舞い。commands.test.ts の `expect(true)
  .toBe(false)` は、"should not reach" の try/catch の中にあり、catch がエラーメッセージを assert しているので、トートロジーではない。
- **`design/test/feedback-roundtrip.test.ts`:** サーバーも mirror だが、テスト対象は実際のブラウザで動く生成されたボード JS。デーモンのファイルがサーバーの契約を持つ。提案: ブラウザを実際のデーモンに向けて、mirror を取り除く。
- **`setup-gbrain-path4-structure.test.ts`:** テンプレートの文章を grep しているが、その文章 (トークンが argv や CLAUDE.md に決して現れないこと、STOP ゲート) がプロンプトの契約そのもの。
- **`terminal-agent-pid-identity` のテスト 1 (リポジトリ全体で `pkill -f terminal-agent` がないこと):** セッションをまたぐ kill のバグに対する、最も安価で独立したガード。
- **security-audit-r2 の順序の grep (state load、inbox、responsive、CSS validator):** 現時点で唯一のガード。削除ではなく変換する。
- **sidebar-ux "welcome page has left-aligned text":** 明示された利用者のデザインの好みを符号化しており、安価。
### レーン 5

- **CI の実際の契約を守るメタテスト (KEEP):**
  - `ci-image-tag-binding` (3 つの hashFiles のドリフトが、黙ってのリビルドを引き起こす)
  - `ci-image-cli-pin` (固定されていない CLI が PTY ハーネスを 3 回壊した)
  - `workflow-concurrency` (汎用のループ)
  - `free-tests-workflow-wiring` (シークレットなし、`pull_request_target` なし、最小権限)
  - `evals-workflow-wiring`、`ci-eval-cache`、`e2e-tier-alignment` (inert-demotion の類)
  - `paid-orphan-tripwire`、`eval-budgets-policy`、`eval-detach-timeout-floor`、`periodic-exclude-policy`、`gate-secret-scan`
  - `strict-output*`、`test-free-shards*`、`paid-shards`/`paid-retry-supervision`/`paid-run-manifest`/`paid-selection-propagation`/`paid-overlay-scheduling`/`ci-paid-coordination` (CI の判定を決めるコードをテストしている)
  - `touchfiles-map-diff` (実際の fail-closed の選択ロジック)
  - `hermetic-wiring` (意図的にもろいソース grep。retention bar)
  - `spawnsync-timeout-tripwire` と `parity-suite` (AGENTS.md が名指し)
  - `llm-judge-frontier` (judge のパースが評価の判定を決める)
  - `secret-sink-harness.test` (否定的な対照が本物の setup-gbrain のバイナリを実行する)
  - `paid-free-boundary`
- **弱いリテラルの pin で、後で削ってもよいもの (削除候補ではない):** `free-tests-workflow-wiring` の `max-parallel: 20` と、正確なマトリクスの文字列。`workflow-concurrency` は `actionlint.yml`/`skill-docs.yml` を固定している。`test-free-shards-sandbox-knobs` の "Linux caps at 16"。`parity-baseline-integrity` は CHANGELOG の見出しの数値を固定しており、振る舞いのチェックというより docs の整合性チェック。
- **有料のコールバックの再生 (26 ファイル。例: `review-n-plus-one-contract`):** テストのテスト。ただし AGENTS.md の step 4 が明示的に要求しており、そうでなければ無駄になる有料実行を招く、壊れた合否の述語を捕まえる。
- **`test/helpers/claude-pty-runner.unit.test.ts` (3,694 LOC、223 テスト、0.1 秒):** 5,885 LOC の PTY ハーネスの大きな自己テスト。カバーする分類器 (`classifyVisible`、`parseNumberedOptions`、`Step0BoundaryPredicate`…) は有料実行でライブに使われるので、残す。キャプチャごとのブロック (`captured F`、`captured G`) は、インシデントごとの統合のレーンに属する。
- **ゼロの import 元のヘルパー** `auq-parallel-worker`、`setup-gbrain-fixture-command`、`emulate-bun-windows-eexist` はパスで読み込まれる (preload や生成された import)。`benchmark-judge` は本番の呼び出し元がある (`bin/gstack-model-benchmark` の動的 import)。
- **`browse/src` の `__reset*`/`reset*ForTests` の export (12 件):** 標準のシングルトンのリセットの継ぎ目。Keep。

## 訂正 (2026-10 の監査)

上の記述のうち、v1.91.19.0 の main に照らして成り立たなくなったもの:

- `codex-e2e-recommendation-substance` は census のみではない。`PERIODIC_CI_EXCLUDE` から外れ、すべての periodic の census で実行される。
- 変更後の指標は置き換えられている。リリースから 5 日後、無料スイートは 132 ファイル増え、直列時間の約 53% が増えた。現在の数値は [2026-10 監査](test-audit-2026-10.md) を参照。
- 所要時間の seed にもう一度 19 ファイルが欠けていた。その中には、パッカーが短いファイルとして扱った 115 秒の `claude-overlay-setup.test.ts` も含まれる。
- `browse/test/compare-board.test.ts` は、この監査の間も隔離されたままだった。その 16 テストは今ではヘッドレスで合格し、無料スイートで再び実行される。
- `ci-image-tag-binding` は今では `evals.yml`、`evals-periodic.yml`、`evals-marathon.yml` を固定している。`ci-image.yml` は、それらのワークフローが同じ内容ハッシュのタグを push するため削除された。
- レーン 5 に挙げた弱いリテラルの pin は、まだ残っている。
