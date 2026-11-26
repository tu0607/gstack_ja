# Eval のモデルルール: `.gstack/eval-models.json`

eval でどのモデルを使ってよいかについてルールを持つリポジトリ(例: 「Fable はスモークテストでのみ」「gpt-5.4-mini は不可」「各ファミリーで最新のモデルのみ」)は、そのルールをデータとして `.gstack/eval-models.json` に書きます。`gstack-eval-plan` は、各アームをこのルールと照合します。対象は `arms`、`dry-run`、`pilot start`、そして `price-gate` の各呼び出し行です。gstack は、`CLAUDE.md` やその他のドキュメントの散文からこのルールを読むことは決してありません。計画: フィールドリスト 2、W9(`docs/designs/field-list-2-2026-10-16/PLAN.md`)。

## ファイル

```json
{
  "schema_version": 1,
  "allow": ["claude-*", "gpt-*"],
  "deny": ["gpt-5.4-mini"],
  "scopes": { "full": { "deny": ["claude-fable-*"] } },
  "families": {
    "claude-opus": ["claude-opus-5-5", "claude-opus-5", "claude-opus-4-8"],
    "claude-fable": ["claude-fable-5-1", "claude-fable-5"],
    "gpt-sol": ["gpt-6.1-sol", "gpt-6-sol"]
  }
}
```

| キー | 必須 | 意味 |
|---|---|---|
| `schema_version` | はい | `1` |
| `allow` | はい | アームが使ってよいモデル ID またはグロブ。どのエントリにも一致しない ID は失敗します。そのため、綴りを間違えた、または新しいモデルが、初期状態で通ることはありません。denied 以外をすべて許可するには `["*"]` を使います。 |
| `deny` | いいえ | どのアームも使ってはいけない ID またはグロブ。最初にチェックされます。 |
| `scopes` | いいえ | eval のスコープごと(`smoke` または `full`)に、追加の `allow` および/または `deny` のリスト。「Fable はスモークのみ」は `scopes.full.deny: ["claude-fable-*"]` と書きます。 |
| `families` | いいえ | ファミリー名から、リテラルの ID のリストへの対応。**新しい順** に並べます。このキーがあると、アームはそのファミリーで最新の ID でなければなりません(そうでなければ `EVAL_MODEL_OLD_GENERATION`)。どのファミリーにも属さないアームは、通過せずに `EVAL_MODEL_GENERATION_UNRESOLVED` で失敗します。 |

グロブでは `*`(任意の文字の並び)と `?`(任意の 1 文字)を使います。それ以外の文字はすべてリテラルとして扱います。ルールは、書かれたままの ID と、プロバイダーの接頭辞を除いた ID(`openai/gpt-5.4-mini` は `gpt-5.4-mini` に一致)、そして日付の接尾辞を除いた Claude の ID(`claude-opus-5-5-20261001` は `claude-opus-5-5` に一致)に対して照合されます。未知のキー、未知のスコープ、`families` 内のグロブ、または二つのファミリーに登録された ID があると、ファイル全体が無効になり(`EVAL_MODELS_INVALID`)、その場合はどのアームも通過しません。

ルールは、gstack 自身のモデルカタログ(`lib/model-catalog.ts`)が何を持っているかに関係なく適用されます。カタログにないモデルは、ファイルだけで許可または拒否が決まります。カタログが確認するのは `families` が最新かどうかだけです。ファミリーがカタログの現在のフロンティアまたはスマートモデルを、別の ID より後ろに並べている場合は、ファイルが古く、無効になります。

## チェックの順序

各アームについて、そのスコープで最初に拒否したルールが結果を決めます。

1. `deny` → `EVAL_MODEL_DENIED`
2. `scopes.<scope>.deny` → `EVAL_MODEL_DENIED`
3. どの `allow` エントリにも一致しない → `EVAL_MODEL_DENIED`(未知の ID は閉じた側で失敗する)
4. `scopes.<scope>.allow` が設定されていて、一致しない → `EVAL_MODEL_DENIED`
5. `families` が設定されている場合: どのファミリーにも属さない → `EVAL_MODEL_GENERATION_UNRESOLVED`。ファミリーの先頭の ID ではない → `EVAL_MODEL_OLD_GENERATION`

## スコープ

`price-gate` は、各呼び出し行をその行の `scope` でチェックします(`GSTACK_EVAL_CALLS v1`、`docs/eval-calls.md`)。`arms`、`dry-run`、`pilot start` は `--scope smoke|full` を受け取り、デフォルトは `full` です。そのため、スモーク専用のモデルは、コマンドがスモーク実行だと宣言しない限り失敗します。

## どちらのコピーを読むか

デフォルトでは、レビュー済みのコピーを読みます。`git show origin/<base>:.gstack/eval-models.json`(`--base`、デフォルトは origin/HEAD のブランチ)です。ブランチが、照合される側のルールを緩めることはできません。作業ツリーのコピーと違う場合は、`EVAL_MODELS_NOTE:` の行でその旨を表示します。`--models-from head` を指定すると、代わりに作業ツリーのコピーでリントします。ファイルを追加または変更する PR で使ってください。ソースのラベルは `head (unreviewed)` と表示されます。どちらのコピーも存在しない場合は、何もチェックされず、その行は `EVAL_MODELS: none ...` と表示されます。ベースを解決できないのに作業ツリーのコピーが存在する場合は、ルールをスキップせずにコマンドが拒否します(`EVAL_MODELS_INVALID`)。

## 出力

```
EVAL_MODEL: claude-fable-5-1 scope=full denied (scopes.full.deny claude-fable-*) where=dry-run --arms
EVAL_MODEL: claude-opus-5-5 scope=full ok (allow claude-*; newest in families.claude-opus) where=dry-run --arms
EVAL_MODELS: fail refused=1/2 source=origin/main@0123456789ab:.gstack/eval-models.json
```

拒否のたびに、stderr にもその結果行が出力され、最後にコードが付きます。`dry-run` はそのチェックを `dry-run.json` の `checks.model_rules` に記録し、`DRY_RUN_RESULT` を失敗させます。`pilot start` は何も確保しません。`price-gate` はレシートを書きません。
