/**
 * coordinator-contract — the block every lane prompt inherits word for word
 * (plan E2). A coordinator thread that runs several lanes states its merge
 * conditions, behavior-change notices, spend caps and handoff format once;
 * the `{{COORDINATOR_CONTRACT}}` resolver renders this text into the plan
 * template, `bin/gstack-autoplan` prints it into every reviewer prompt
 * (lib/autoplan-prompts.ts writePrompts), and `gstack-autoplan contract`
 * prints it for a parent that writes its own lane prompts. One source, no
 * paraphrase: test/coordinator-contract.test.ts pins that the three outputs
 * are byte-identical.
 */
export const COORDINATOR_CONTRACT_HEADING = '## Coordinator contract(すべてのレーンが継承するコーディネーター契約)';

export const COORDINATOR_CONTRACT = `${COORDINATOR_CONTRACT_HEADING}

マージ条件。レーンの PR がマージされるのは、次がすべて満たされたときだけです: 必須のゲートレーンがスタンプ済みのツリーで green であるか、ツリーの受領記録が \`gate-reuse: eligible\` と言っていること。\`gstack-lane-check\` が、計画されたファイルについて他のすべての open なレーンに対して \`clear\` を報告していること。PR 本文が \`gstack-ship-receipt\` ブロックで始まっていること。そして、マージすると言うのがレーンではなくコーディネーターであること。レーンは決して自分でマージせず、他のレーンをリベースせず、いかなるブランチも force-push しません。

挙動変更の通知。プラン自体の項目の外にある、ユーザーに見える挙動の変更はすべて、レビューが始まる前に、PR 本文の \`## Behavior changes\` の下に、ファイル、以前の挙動、新しい挙動を添えて列挙します。レビューで見つかった記載漏れの変更は、その大きさにかかわらず CRITICAL の指摘です。

支出上限。各レーンは、コーディネーターが指定した \`--spend-cap\` のもとで動きます。上限に達したレーンは \`incomplete\` で停止し(\`STOP: reason=budget_exhausted\`)、支出済み・予約済み・不明の各金額を報告します。有料 eval を判定を変えるために再試行することはありません。再実行には、名前の付いた修復が必要です。ホストのサブエージェントの支出は \`unknown\` として報告し、決してゼロにはしません。

完了の前に。レーンは各ステップの後に WIP コミットを自分のブランチへ push し、push 済みの SHA をゲートにかけます。完了と言えるのは \`gstack-pregate run --allow-repo-commands\` が通ったときだけです。\`requires-remote\` には \`--stage tests --remote --spend-cap <cap>\` が必要です。\`.gstack/pregate.json\` に \`sealed\` キーがある場合は、push や PR 作成の前に \`gstack-pregate sealed\` を実行し、拒否されたら push を止めます。

引き継ぎの書式。レーンは次の順で、識別子を先に報告します: PR の URL(または \`no PR\` とブランチと SHA)、\`GSTACK_RESULT\` 行、\`gstack: ok|fail <rev>\` 行、\`PREGATE:\` 行、ゲートの要約(通過・失敗・スキップしたレーン数)、挙動変更(または \`none\`)、支出(支出済み/予約済み/不明)、そして検証できなかったこと。スレッド間の参照には、短いコードではなく常に完全なスレッド id(\`jam_…\`)を使います。識別子より後の散文は切り詰めてもよいですが、識別子より前は切り詰めてはなりません。
`;
