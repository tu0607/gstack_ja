/**
 * Confidence calibration resolver
 *
 * Adds confidence scoring rubric to review-producing skills.
 * Every finding includes a 1-10 score that gates display:
 *   7+: show normally
 *   5-6: show with caveat
 *   <5: suppress from main report
 *
 * Pre-emit verification gate (#1539): findings without a quoted code snippet
 * are forced to confidence 4-5 so the existing suppression rule fires
 * automatically. Kills the "field doesn't exist on the model" FP class on
 * mature frameworks like Django/Rails — the model code resolves it in <5min,
 * and the gate forces the reviewer to do that lookup before promoting the
 * finding to the report.
 */
import type { TemplateContext } from './types';

export function generateConfidenceCalibration(_ctx: TemplateContext): string {
  if (_ctx.skillName === 'review') return `## Confidence Calibration(確信度の較正)

まず証拠を検証し、その後すべての指摘に 1〜10 のスコアを付けて、その表示ルールを適用します。

### Pre-emit verification gate(出力前の検証ゲート)

1. **該当するコード行を引用する:** file:line と原文のテキスト。存在しないフィールドなら
   そのクラス定義、null になりうる値ならその初期化、競合状態なら双方を引用する。
2. フレームワークが生成するシンボルは、それを生成するメタクラス、ディスクリプタ、
   ORM の Meta ブロック、マイグレーション、デコレーター、スキーマを読んで引用する。
   クラス本体や grep の結果にリテラルな名前がなくても、不在の証明にはならない。
3. **根拠となる行を引用できない場合、その指摘は未検証です。**
   confidence を 4〜5 に固定します。付録のみで報告するなら 4、下の中程度の confidence の
   注記付きで本文に載せるべき場合にのみ 5 を使います。
   憶測で confidence 7 以上をつけてはいけません。

| スコア | 意味 | 表示ルール |
|-------|---------|-------------|
| 9-10 | 具体的なコードが、具体的なバグまたはエクスプロイトを裏づけている。 | 通常どおり表示 |
| 7-8 | 確度の高いパターン一致。ほぼ正しい。 | 通常どおり表示 |
| 5-6 | 中程度。誤検知の可能性がある。 | 注記付きで表示: "Medium confidence, verify this is actually an issue" |
| 3-4 | 疑わしいが問題ない可能性もある。 | 本文からは除外。付録にのみ含める。 |
| 1-2 | 憶測。 | リリースを止めるほどの重大事態(広範なデータ損失、全面的な障害、システム全体の侵害)が疑われる場合にのみ報告し、CRITICAL とラベル付けして、憶測であることを明記する。 |

**指摘のフォーマット:**

\`[CRITICAL|INFORMATIONAL] (confidence: N/10) file:line — description\`

例:
\`[CRITICAL] (confidence: 9/10) user.rb:42 — SQL injection via string interpolation\`

**キャリブレーションの学び:** スコアが 7 未満で報告した指摘を、ユーザーが実在する問題だと
確認した場合は、修正したパターンを学びとして記録します。`;

  const result = `## Confidence Calibration(確信度の較正)

すべての指摘には、confidence スコア(1〜10)を必ず含めます。

| スコア | 意味 | 表示ルール |
|-------|---------|-------------|
| 9-10 | 具体的なコードを読んで検証済み。具体的なバグまたはエクスプロイトを実証。 | 通常どおり表示 |
| 7-8 | 確度の高いパターン一致。ほぼ正しい。 | 通常どおり表示 |
| 5-6 | 中程度。誤検知の可能性がある。 | 注記付きで表示: "Medium confidence, verify this is actually an issue" |
| 3-4 | 低い confidence。パターンは疑わしいが問題ない可能性もある。 | 本文からは除外。付録にのみ含める。 |
| 1-2 | 憶測。 | 重大度が P0 になる場合にのみ報告する。 |

**指摘のフォーマット:**

\\\`[SEVERITY] (confidence: N/10) file:line — description\\\`

例:
\\\`[P1] (confidence: 9/10) app/models/user.rb:42 — where 句への文字列補間による SQL インジェクション\\\`
\\\`[P2] (confidence: 5/10) app/controllers/api/v1/users_controller.rb:18 — N+1 クエリの可能性あり。本番ログで確認\\\`

### Pre-emit verification gate(出力前の検証ゲート)

指摘をレポートに載せる前に、このゲートは次を求めます。

1. **指摘の根拠となる具体的なコード行を引用する** — file:line と、指摘のきっかけとなった
   行の原文。指摘が「モデル Y にフィールド X が存在しない」なら、そのフィールドが
   あるはずのクラス Y の行を引用する。「dict.get() が None を返しうる」なら、その dict の初期化を引用する。
   「A と B の間の競合状態」なら、A と B の両方を引用する。

2. **根拠となる行を引用できない場合、その指摘は未検証です。**
   confidence を 4〜5 に固定します。本文から除外すべき場合は 4、中程度の confidence の
   注記付きでレポートに載せるべき場合にのみ 5 を使います。除外した項目は、レビュアーが
   キャリブレーションを監査できるよう付録に残します。
   憶測で confidence 7 以上をつけて回避してはいけません。それではゲートが無意味になります。

**フレームワークのメタ構造への注意:** シンボルがフレームワークのメタクラス、ディスクリプタ、
ORM の Meta 内部クラス、マイグレーション履歴によって生成される場合(Django
\`Meta\`, Rails \`has_many\`/\`scope\`, SQLAlchemy \`relationship\`/\`Column\`,
TypeORM のデコレーター、Sequelize の \`init\`/\`belongsTo\`、Prisma の生成クライアント)、
クラス本体にリテラルな名前があることを期待せず、そのメタ構造(\`Meta\` ブロック、
マイグレーション、デコレーター、スキーマファイル)を引用します。
検証とは「このシンボルを生成するソースを読んだ」ことであり、「その名前を
grep して見つからなかった」ことではありません。

このゲートが捕捉する誤検知のクラス:

| 誤検知のクラス | ゲートが捕捉する理由 |
|---|---|
| 「モデルにフィールドが存在しない」 | モデルのクラス本体または Meta の引用が必須。フィールドの有無が明らかになる |
| 「dict.get() が None になりうる」 | dict の初期化の引用が必須(例: Django フォームの \`cleaned_data\` は \`{}\` で初期化される) |
| 「save() でフィールドが失われうる」 | ORM のシグネチャまたはモデル定義の引用が必須 |
| 「update_fields が X を漏らしうる」 | フィールド集合の引用が必須。X が存在しなければ、誤検知は自明 |

**キャリブレーションの学び:** confidence 7 未満で報告した指摘を、ユーザーが実在する問題だと
確認した場合、それはキャリブレーションの事象です。最初の confidence が低すぎたということです。
修正したパターンを学びとして記録し、今後のレビューがより高い confidence で捕捉できるようにします。`;
  return _ctx.skillName === 'plan-eng-review' ? result.replaceAll('\\`', '`') : result;
}
