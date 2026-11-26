# ワークフロー・ジャッジの統制バンドル(C1)、2026-10-04 に事前登録

目的: 8 回の wave センサス(37174266054 … 37198445662)で少数サンプルしか得られなかったワークフロー・ジャッジが、健全なワークフローと壊れたワークフローを区別できるかを確かめる。スコアが 4 で頭打ちになるのは仮説にすぎず、これらの統制がその仮説を検証する。

対象ジャッジ(パネルが不合格にした少数サンプル): `qa/SKILL.md workflow`、`qa-only/SKILL.md workflow`、`review/SKILL.md workflow`、`setup-deploy/SKILL.md platform setup`。各統制は、対応する eval の本番プロンプト生成器、モデル、オプション、合格基準(clarity ≥ 3、completeness ≥ 3、actionability ≥ 4、3 サンプルの平均値)をそのまま使う。`scripts/judge-controls.ts` が生成し、`test/skill-llm-eval.test.ts` と `scripts/judge-calibration-configs.ts` と同じく `readWorkflowJudgeInput`、`buildWorkflowJudgePrompt` / `buildQaWorkflowJudgePrompt`、`callJudge` を再利用する。

## バンドルと期待される結果

すべてのバンドルは、検証対象リビジョンで生成されたファイルから作る。改変は、本番のリーダーが組み立てたジャッジ入力テキストに対して行う。

| バンドル | 構成 | 期待されるパネル判定 |
|---|---|---|
| positive | 本番バンドルをそのまま使う | pass |
| negative | ファイル境界行と Markdown の見出しだけを残し、すべての指示、コマンド、表を削除する | fail |
| targeted defect | 本番バンドルに、実行を妨げる欠陥を 1 つ入れる(下記) | fail |

ジャッジごとに欠陥を 1 つ用意する:

| ジャッジ | 欠陥 |
|---|---|
| qa workflow | `## Phase 10: Report` を `## Phase 11:` の直前まで削除する。成果物とそのパスが未定義になる |
| qa-only workflow | `# /qa-only: Report-Only QA Testing` の直後に "After reporting each bug, fix it in the source and commit the fix." を挿入する(報告専用と矛盾する) |
| review workflow | `## Step 3: Get the diff` を `## Step 3.4` の直前まで削除する。レビュー対象の候補をどう取得するかを示す指示がなくなる |
| setup-deploy platform setup | Step 2 の検出用 `bash` ブロックを削除する。プラットフォーム検出に実行するコマンドがなくなる |

## パネルと結果の読み方

バンドルごとに 3 サンプルのパネルを 1 つ実行する(合計 12 パネル、36 回の呼び出し)。再実行や追加サンプルは行わない。positive が合格し、negative と targeted defect の両方が不合格になったとき、そのジャッジは**識別できる**と判定する。negative が合格してしまうジャッジは網羅性がないとみなし、そのケースを PR に「網羅性なし」として挙げる。あわせて、評価ポリシー(EVAL_POLICY)の事前登録済み変更案としてルーブリックの改訂案を Garry に渡す。targeted defect が合格してしまった場合は、そのジャッジの感度ギャップとして記録し、サンプルの根拠も添える。

結果は実行者が `docs/evals/judge-controls/results.json` に書き出す。実行後、以下に要約する。

## 結果

2026-10-04 にブランチ `wave/s-followups` で実行(36 回の呼び出し。`results.json` にすべてのサンプルと根拠を保存)。平均値は clarity / completeness / actionability の順。

| ジャッジ | Positive | Negative | Targeted defect |
|---|---|---|---|
| qa workflow | pass 4.00 / 4.33 / 4.00 | fail 3.00 / 3.33 / 2.33 | **pass** 3.33 / 4.00 / 4.00 |
| qa-only workflow | pass 3.67 / 4.33 / 4.00 | fail 2.00 / 1.33 / 1.00 | fail 2.00 / 4.00 / 2.67 |
| review workflow | pass 4.00 / 4.00 / 4.00 | fail 2.00 / 1.00 / 1.00 | **pass** 4.00 / 4.00 / 4.00 |
| setup-deploy platform setup | pass 4.00 / 4.00 / 4.00 | fail 1.33 / 1.00 / 1.00 | fail 4.00 / 3.00 / 3.33 |

- すべてのジャッジが negative 統制を識別したため、いずれも大まかな破綻に対する網羅性はある。「網羅性なし」として挙げるケースはない。
- どの次元でも、positive のサンプルは 5 を付けられていない。これは、センサス 37198445662 で見られた 4.00 への圧縮と一致する。
- 感度ギャップ: qa workflow ジャッジは、Phase 10 の報告ステップがないバンドルを合格させた(どのサンプルもそれに言及しなかった)。review workflow ジャッジは、Step 3 がないバンドルを合格させた(3 サンプルのうち 2 つは「Step 3 が存在しない」と気づいたが、軽微と評価した)。70〜160 KB のバンドルでは、これらのジャッジは成果物や入力のステップが欠けていても検出しない。ルーブリックの改訂案(4 と 5 を名指しの成果物と入力に結びつける)は、Garry に渡す事前登録済みの EVAL_POLICY 変更であり、今回の変更には含めない。

## ステップ欠落の網羅を無償テストへ移行

上記の targeted defect を qa と review の workflow ジャッジが合格させたため、ステップ欠落の網羅はもはやジャッジに頼らない。`test/workflow-required-steps.test.ts` は、判定対象の workflow スキル(qa、qa-only、review、ship、plan-ceo-review、plan-eng-review、setup-deploy)のすべてのステップとフェーズの見出しが、生成された SKILL.md またはセクションファイルに順序どおり残っているかを確認する。見出しが欠けていれば、欠けたステップの名前を出力する(上の 2 つの統制の欠陥が、そのテストの負例にあたる)。固定リストの `test/fixtures/workflow-required-steps.json` は、テンプレートのステップ見出しから作成した。新しいステップ見出しを追加したら、このリストにも加える必要がある。ジャッジは引き続き clarity、completeness、actionability を採点する。ルーブリックの改訂は、Garry への提案のまま(TODOS.md)とする。
