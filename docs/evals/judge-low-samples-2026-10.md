# ワークフロー審査員の低スコアサンプル、2026年10月(C2)

出典: 8回の wave census の `skill-llm-eval` シャード(37174266054 … 37198445662)、各24審査員。パネルの次元別平均が4未満であるとは、その3サンプルのうち少なくとも1つが4未満だったという意味です。ワークフロー審査員は actionability ≥ 4(clarity と completeness は ≥ 3)をゲートにしているため、actionability が1つでも3ならパネルは不合格になります。

## 低い次元を含むパネル(8回の census における件数)

| 審査員 | 低い次元 | census | パネルの不合格 |
|---|---|---|---|
| setup block | completeness, actionability | 8/8 | なし |
| qa health rubric | completeness | 8/8 | なし |
| qa anti-refusal | `would_browse` が 1 と報告(低スコアではなくブール値フィールド) | 8/8 | なし |
| qa workflow | clarity, actionability | 8/8 | 37186854666 |
| benchmark perf collection | completeness | 8/8 | なし |
| plan-eng-review sections | clarity | 6/8 | なし |
| canary monitoring loop | completeness | 6/8 | なし |
| sync-gbrain read-only readiness | completeness | 6/8 | なし |
| plan-ceo-review modes | clarity | 5/8 | なし |
| qa-only workflow | clarity, actionability | 5/8 | 37198445662 |
| design-review fix loop | completeness | 4/8 | なし |
| review workflow | clarity, actionability | 4/8 | 37193478719 |
| ship workflow | clarity | 3/8 | なし |
| setup-deploy platform setup | actionability, completeness | 2/8 | 37176837432 |
| plan-design-review passes | completeness | 1/8 | なし |

## 不合格になったパネル: 低スコアの理由と対応

| パネル | 理由(要約) | 対応 |
|---|---|---|
| setup-deploy, 37176837432 | `[ -f vercel.json ] \|\| [ -d .vercel ] && echo` の優先順位のバグ。デフォルトブランチが解決されていない。Fly のデプロイトリガーが未定義 | この wave より前に main で修正済み(ブレース付きの検出、`gh repo view --json defaultBranchRef`)。また、その形式に対する優先順位の指摘自体も誤りだった |
| qa workflow, 37186854666 | 成果物ファイル名の `{user}` が未定義 | **修正済み(C2):** `/qa` が `{user}`、`{branch}`、`{datetime}` の取得元を明記 |
| qa workflow, 37186854666 | `PROBE_DIR` は「上で選ばれた」とだけ示されている。EARLIER_UTC の形式が未指定。`/devex-review` のパスが示されていない | リゾルバの担当者(`scripts/resolvers/qa.ts`)に依頼済み |
| qa workflow, 37186854666 | 文章の密度。「Phases 1-6」の番号付けが2種類ある | 密度の問題のみ。記録のみ |
| review workflow, 37193478719 | `unverified` の Codex モードで、実行とスキップのルールが競合していた | この wave より前に main で修正済み(`ready` と `unverified` の両方で実行) |
| review workflow, 37193478719 | 「期限切れ後のスモーク再確認は実行しない」と、修正後に影響を受けたプローブを再実行することの矛盾 | リゾルバの担当者(`scripts/resolvers/qa.ts`)に依頼済み |
| review workflow, 37193478719 | GATE: MISSING COVERAGE が「既存のユーザー判断フローを維持する」と書いているが、そのフローが未定義 | リゾルバの担当者(`scripts/resolvers/outside-voice-steps.ts`)に依頼済み |
| review workflow, 37193478719 | plan-completion の HIGH-impact ゲートに、生成されたセッションや非対話時のデフォルトがない | リゾルバの担当者(plan-completion リゾルバ)に依頼済み |
| qa-only workflow, 37198445662 | レポートのテンプレートが「Duration / durationMs の合計」を求めているが、`reporting.md` はプローブ予算と保護されたコマンドの実行時間を定義している | **修正済み(C2):** 両方の QA レポートテンプレートが定義済みのフィールドを明記 |
| qa-only workflow, 37198445662 および C2 パネル | Browser Quick がトップページと5ページに30秒(`SECONDS=30`)を割り当て、プローブごとにチェックポイントの Write がある | リゾルバの担当者(`scripts/resolvers/qa.ts:76`)に依頼済み。直近3回の qa-only パネルのうち2回で再発 |
| qa-only workflow, 37198445662 | 探索的な §2 は「チェックポイントではなくレポートを書く」と言う一方で、注釈とマテリアライズを先に行うよう求めている。「JSON は完全な値を保持する」の JSON が何を指すか不明 | リゾルバの担当者(`qa.ts`、`test-value.ts`)に依頼済み |

低スコアのサンプルがパネルの不合格につながらなかった審査員には、文章の密度や対象バンドル外に関する指摘が残っています。たとえば qa health rubric の completeness 3 は、それが支えるワークフローを見ずに審査されています。これらは記録するだけで、追いかけてはいません。

## C2 の修正後のパネル(2026-10-04、変更した審査員ごとに3サンプルのパネル1つ)

| 審査員 | 平均(clarity / completeness / actionability) | 判定 |
|---|---|---|
| qa workflow | 3.67 / 4.67 / 4.00 | 合格 |
| qa health rubric | 4.00 / 3.00 / 4.00 | 合格 |
| qa anti-refusal | would_browse true, confidence 5 | 合格 |
| qa-only workflow | 3.67 / 4.33 / 3.67 | **不合格**: 1サンプルが 30 秒の Browser Quick 予算を指摘(上記のリゾルバへの依頼) |
| review workflow | 4.00 / 4.00 / 4.00 | 合格 |
| ship workflow | 4.00 / 4.00 / 4.00 | 合格 |
| plan-ceo-review modes | 3.67 / 4.67 / 4.00 | 合格 |
| cross-skill greptile consistency | 4 | 合格 |
| voice directive tone | すべて ≥ 4.33 | 合格 |

タイミングフィールドと `{user}` に関する指摘は、これらのパネルにはもう現れていません。ship と review の文言を、それぞれのパリティ用のサイズ上限に収まるよう締めた後、それらのファイルが選ぶ審査員を最終的な文言でもう一度実行しました。review workflow は 4.00 / 4.00 / 4.00、ship workflow は 4.00 / 4.00 / 4.00、cross-skill consistency は 4、voice directive tone は ≥ 4.00 で、いずれも合格です。
