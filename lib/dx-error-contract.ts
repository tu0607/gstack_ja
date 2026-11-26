/**
 * The agent-ready error contract: the one source for how gstack's DX reviews
 * score error messages. scripts/resolvers/dx.ts renders the full text into
 * /plan-devex-review Pass 3 ({{DX_ERROR_CONTRACT}}); the autoplan DX reviewer
 * prompts carry the compact form. bin/gstack-autoplan-snapshot.ts keeps its
 * own literal copy of the compact form (it runs as a lone file in installed
 * copies); test/dx-error-contract.test.ts asserts the two stay identical.
 */

export const DX_ERROR_RUBRIC = 'agent-ready-v1';

export const DX_ERROR_ITEMS = ['what', 'fix', 'recovery', 'code', 'context', 'trace', 'redaction', 'channel'] as const;

export const DX_ERROR_DOC = 'https://github.com/garrytan/gstack/blob/main/docs/agent-ready-errors.md';

export const DX_ERROR_COMPACT =
  `すべてのエラー経路を agent-ready エラー契約(${DX_ERROR_DOC})に照らして採点してください。what (失敗した操作と実際の値)、fix (最初または最後の行に置く、安全で許可されたコマンドか編集、または人間が提供すべき正確なもの)、recovery (再試行、修正して再試行、先に X を行う、または人間に尋ねる。副作用は none/partial/complete/unknown、結果が不明な場合は再試行の前に照合する、再試行の上限)、code (安定したコードとドキュメントのアンカー)、context (バージョン、設定、環境変数名、根本の原因。リモートサービスは呼び出し元に安全なものだけ)、trace (予期しない失敗のみ。ローカルではコンパクトなトレースかそのファイルパス、リモートでは相関 ID)、redaction (どこにも秘密の値を出さない)、channel (そのサーフェス固有の失敗シグナル。CLI は 0 以外の終了コードと stderr、API はステータスと RFC 9457 の本文、SDK は型付きエラー、MCP ツールは isError)。 ` +
  '作業の前に拒否された利用・検証エラーに必要なのは what、fix、code、redaction、channel だけです。項目はサーフェスごとに適用し、N/A には理由が必要で、プランが導入する経路について指定していない項目はギャップです。unknown は、検査できなかった既存の動作にだけ使います。 ' +
  '秘密の漏えい、失敗を成功として通知すること、安全でない fix、端末でのブロック(ハング、または --yes のような非対話の代替手段を示さずに端末がないことで失敗する)は、"CAP4:<path>:<item>" というタイトルの Critical の指摘として報告してください(Error Messages のスコアを 4/10 に制限します)。該当する fix、recovery、context、trace の欠落は、"CAP6:<path>:<item>" というタイトルの High の指摘として報告してください(6/10 に制限します)。';

export const DX_ERROR_CONTRACT = `#### agent-ready エラー契約(${DX_ERROR_RUBRIC})

エージェントは最初にエラーに遭遇することが最も多く、それを文字どおりに読み、何を意図したのかを問い返すことができません。すべてのトレースされたエラー経路を、次の 8 項目で採点してください。公開リファレンス: \`${DX_ERROR_DOC}\`。

| 項目 | エラーが読み手に与えるもの |
|------|----------------------------|
| **what** | 失敗した操作と、原因となった実際の値(入力、パス、ID)。 |
| **fix** | 先頭行または末尾行に置き、途中の連鎖には埋めない。正確なコマンド、フラグ、または編集内容。安全なエージェントによる修復手段がない場合は、人間が提供すべき正確なもの(認証情報、承認、判断)。正確なエスカレーションも完全な fix である。fix が有効なのは、安全で承認されている場合に限る。同意、安全、サンドボックスの境界を迂回せず、信頼できない出力からコピーしたテキストを実行するよう指示せず、引数を正しく引用する。 |
| **recovery** | 変更せずに再試行する、修正してから再試行する、先に X を行う、または人間に尋ねる。副作用(なし、一部、完了、不明)。結果が不明な場合は、再試行の前にどう照合するか(状態を確認するコマンド、冪等キー)。再試行の上限を定め、その後はエスカレーションする。 |
| **code** | 安定したコードと、ドキュメントのアンカーまたは \`--explain\` の対象。文章は変わってもよいが、コードは変えてはいけない。 |
| **context** | バージョン、有効な設定、関連する環境変数名(値は不可)、根本の依存関係のエラー(握りつぶさない)。リモートサービスは、呼び出し元に安全な事実だけを返す(パラメータ、API バージョン、リクエスト ID)。 |
| **trace** | 予期しない失敗のみ。ローカルの CLI、SDK、スキルは、コンパクトなトレース、または完全なトレースを保存したファイルのパスを表示する(完全版は \`--verbose\`/\`DEBUG\` の下で表示)。リモートサービスは、相関 ID を返し、内部情報はそのログに残す。 |
| **redaction** | トレースや入れ子になった原因も含め、秘密の値、トークン、認証情報を含む URL は一切出さない。 |
| **channel** | そのサーフェスがネイティブに持つ機械向けのシグナルが、同じフィールドを運ぶ。失敗は失敗として通知する(exit 0、HTTP 200、\`isError: false\` にはしない)。 |

**失敗のクラス。** 作業を始める前に拒否された、利用・検証エラーは、what、fix、code、redaction、channel が必要です。その recovery は暗黙のもの(修正して再試行、副作用なし)とみなし、context、reconcile、再試行の上限は適用しません。環境、依存関係、一部完了、予期しない失敗では、該当するすべての項目が必要です。trace は予期しない失敗にだけ適用します。

**サーフェス。** 適用性ゲートのプロダクトタイプに対応させます:
- **CLI Tool:** channel は stderr と、ゼロ以外の明確な終了コード。構造化された出力を持つ場合は \`--json\` の形式。
- **API/Service:** channel は HTTP ステータスと RFC 9457 の problem-details 本文。context は呼び出し元に安全なもの。trace は相関 ID。
- **Library/SDK:** channel はコードとフィールドを持つ型付きのエラークラス。終了コードはない。
- **Platform:** エラーが届くインターフェースに応じて、CLI または API のルールに従う。
- **Documentation:** what、fix、code、redaction のみ。
- **Claude Code Skill:** channel は、スキルが表示する結果の行とコード。MCP ツール(その一種)は、フィールドを text または structured content に入れて \`isError: true\` を返す。

**証拠。** 各経路の各項目は、pass、fail、N/A(理由付き)、unknown のいずれかです。プランのレビューでは、プランが導入する経路について、該当する項目をプランが指定していなければ、ギャップ(fail)です。unknown は、検査できなかった既存の動作にだけ使います。ライブの監査では、一度もトリガーしなかったエラーの種類は unknown であり、推定してはいけません。

**上限。** 上限の原因となった経路と項目を名指しし、修正後のエラー行を示してください。
- **4/10(重大な指摘、タイトル \`CAP4:<path>:<item>\`):** 経路が秘密を漏らす、失敗を成功として通知する、安全でない fix を出す、または端末を待ってブロックする(ハングする、または \`--yes\` のような非対話の代替手段を示さずに端末がないことで失敗する)。
- **6/10(重要な指摘、タイトル \`CAP6:<path>:<item>\`):** 経路に該当する fix、recovery、context、trace のいずれかがない。

DX TRIAGE を含むすべてのモードで、すべての CAP4 の指摘を報告します。`;
