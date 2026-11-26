<!-- AUTO-GENERATED from design-phase.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
ディスパッチの前に、`readRanges` に従って `methodologyPath` from `bun "<SNAPSHOT_TOOL>" methodology design "<REVIEW_SKILL>" "<RESTORE_PATH>"` を読み込みます。読み込みに成功した範囲と合計を、EOF まで記録してください。スキップ一覧のものは読み込むだけです。

**上書きルール:**
- 重点領域: 関連するすべての次元(P1)
- 構造的な問題(状態の欠落、壊れた階層): 自動修正(P5)
- 美的・好みの問題: TASTE DECISION としてマーク
- デザインシステムとの整合: DESIGN.md が存在し、修正が明白な場合は自動修正
- 二重の voice: 利用可能であれば、Claude のサブエージェントと Codex の両方を必ず実行します(P6)。

  **フェーズ入力をバインドする:** 実行し、両方の voice の `<DESIGN_INPUT>` として `snapshotPath` を使います:
```bash
bun "<SNAPSHOT_TOOL>" create design "<ACTIVE_PLAN>" "<RESTORE_PATH>" "<methodologyPath>"
```
  新しい `Implementation plan` のみを使います。`Review record` は含めません。

  **Claude のデザインサブエージェント**(ネイティブのツール):
  Claude Code: Agent のスキーマに `run_in_background` がある場合は `false` に設定します。
  起動の受領書がある場合はバックグラウンドで実行されています。その完了通知を待ってください。
  その他のホスト: フォアグラウンドで実行します。サポートされている場合は完了を待ちます。

  `<DESIGN_INPUT>` の隣にある `snapshot.json` を読みます。その `nativeDispatchPrompt` を変更せずに、Agent のプロンプトとして送ってください。このレスポンスでの唯一かつ最後のツール呼び出しです。
  ネイティブの Read は有効のままにします。子は最初に `nativePromptPath` を EOF まで読みます。
  すべての基準と計画を含み、要約や以前のレビューは含みません。

  **ネイティブの完了バリア:** 非同期(`isAsync: true` / `status: "async_launched"`)の場合:
  Claude Code: 直ちにレスポンスを終えてください: "Waiting for <agent ID>."
  そのエージェント ID の最終通知が届くまで、それ以上のツール呼び出しやレビューはしないでください。
  その他のホストは、その ID を待ちます。その後、外部のレビューを行います。このフェーズのレビューだけです。
  完了したネイティブの INPUT は、スナップショットのフェーズとハッシュに一致しなければなりません。無効な入力は一度だけ再試行します。それでも無効なら、失敗時の方針を適用します。
  インラインでの代替はしないでください。失敗時の方針を適用してください。

  **Codex のデザインの voice**(Bash 経由):
  外部のプロンプト: <DESIGN_INPUT> と以下の文脈の全内容をインラインで含めます(Write ツールを使用)。

重要: SKILL.md ファイル、または skills/gstack を含むパスを読んだり実行したりしないでください(外部の指示になるため)。リポジトリのコードだけをレビューしてください。

  <DESIGN_INPUT> の計画ファイルを読んでください。この計画の
  UI/UX のデザイン上の判断を評価してください。

  また、CEO のレビュー段階の以下の指摘も考慮してください:
  <CEO の二重 voice の指摘の要約を挿入 — 主要な懸念、意見の不一致>

  情報の階層はユーザーと開発者のどちらに役立っているか? インタラクションの状態(読み込み中、空、エラー、部分的)は
  指定されているか、それとも実装者の想像に任されているか? レスポンシブの方針は意図的か、それとも後付けか?
  アクセシビリティの要件(キーボード操作、コントラスト、タッチターゲット)は指定されているか、それとも願望にとどまっているか?
  この計画は具体的な UI の判断を記述しているか、それとも一般的なパターンを書いているだけか?
  曖昧なまま残すと、実装者を悩ませるデザイン上の判断は何か?
  意見を明確に述べてください。曖昧な表現は避けてください。

実際のプラン/spec/ソースを含む **完全なプロンプトとコンテキスト** を、プライベートなファイルに書き込みます。そのファイルのシェルクォート済みパスを `<prepared-prompt-file>` に代入します。ユーザーのテキストをシェルのソースに埋め込んではいけません。指摘事項ごとの重大度(Critical、High、Medium、Low のいずれか)と、最後の Recommendation: <action> because <specific reason> の行を要求してください。指摘なしの場合も、その明確な根拠を含めます。

```bash
# GSTACK_ACTIVE_HOST names the harness, never the model.
if { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
  echo 'Codex outside review unavailable: harness mismatch; no outside process started. Missing coverage.' >&2
  if { [ -n "${CLAUDECODE:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = claude ]; } && { [ -n "${CODEX_THREAD_ID:-}" ] || [ -n "${CODEX_SANDBOX:-}" ] || [ "${GSTACK_ACTIVE_HOST:-}" = codex ]; }; then
    echo 'Inherited harness markers conflict. Run setup --host <actual-harness> (claude or codex); do not guess a replacement provider.' >&2
  else
    echo 'Repair installed skills: run setup --host codex from your gstack checkout.' >&2
  fi
  exit 78
fi

_REPO_ROOT=$(git rev-parse --show-toplevel) || { echo 'ERROR: not in a git repo' >&2; exit 1; }
_OUTSIDE_TMP=$(mktemp -d "${TMPDIR:-/tmp}/gstack-outside.XXXXXXXX") || exit 1
trap 'rm -rf "$_OUTSIDE_TMP"' EXIT
_OUTSIDE_INPUT="$_OUTSIDE_TMP/prompt"
cat -- '<prepared-prompt-file>' >"$_OUTSIDE_INPUT" || exit 1

_CODEX_PROBE="$HOME/.claude/skills/gstack/bin/gstack-codex-probe"
export _CODEX_DEADLINE=$(($(date +%s)+540)); _CODEX_OUT=$("$_CODEX_PROBE" role-ready exec) || exit $?
_CODEX_SEL=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SEL: //p')
_CODEX_SANDBOX_MODE=$(echo "$_CODEX_OUT" | sed -n 's/^CODEX_SANDBOX: //p')
"$_CODEX_PROBE" show-first-use-notice
_OUTSIDE_EXIT=0
"$_CODEX_PROBE" run-with-timeout --effort high 540 codex exec - -C "$_REPO_ROOT" -s "${_CODEX_SANDBOX_MODE:?}" -c "model=\"${_CODEX_SEL:?}\"" -c skills.include_instructions=false -c 'web_search="cached"' --json -o "$_OUTSIDE_TMP/text" <"$_OUTSIDE_INPUT" >"$_OUTSIDE_TMP/events" 2>"$_OUTSIDE_TMP/stderr" || _OUTSIDE_EXIT=$?
cat "$_OUTSIDE_TMP/text" 2>/dev/null || tail -n 20 "$_OUTSIDE_TMP/events"
if [ "$_OUTSIDE_EXIT" -eq 124 ]; then
  "$_CODEX_PROBE" log-event codex_timeout "540" || true
  "$_CODEX_PROBE" log-hang autoplan 0 || true
fi
cat "$_OUTSIDE_TMP/stderr" >&2 || { [ "$_OUTSIDE_EXIT" -ne 0 ] || _OUTSIDE_EXIT=1; }
_OUTSIDE_RC=0
bun --no-env-file --config=/dev/null "$HOME/.claude/skills/gstack/lib/outside-review-result.ts" --label 'Codex outside review' --exit "$_OUTSIDE_EXIT" --stderr "$_OUTSIDE_TMP/stderr" --events "$_OUTSIDE_TMP/events" review "$_OUTSIDE_TMP/text" || _OUTSIDE_RC=$?
case "$_OUTSIDE_RC" in
  0|3) ;;
  4) echo 'OUTSIDE_STATUS: unverified provider=codex host=claude'; exit 4 ;;
  *) [ "$_OUTSIDE_EXIT" -ne 0 ] && exit "$_OUTSIDE_EXIT"; exit 1 ;;
esac
echo 'OUTSIDE_STATUS: completed provider=codex host=claude'
```

Bash の `timeout: 600000` を使い、完全なレスポンスを `tool-output` フェンスで表示します。実行が成功し、マーカーが有効であることを必須とします。拒否、空または不正な出力、score/severity/completion マーカーの欠落、タイムアウト、CLI の失敗は `outside_status: unavailable` を意味します。P0/P1 の指摘事項は、ネイティブのものと同様にブロックします。`OUTSIDE_STATUS: unverified` はカバレッジの欠落です。呼び出し元のフォールバックを使います。カバレッジの欠落は、決してクリーン/PASS にはなりません。 どちらの結果でも、自分で作成したプライベートなプロンプトだけを削除します。一時領域のクリーンアップは自動です。

外部のレビューが失敗または未完了の場合は利用不可とします。無効の場合は外部をスキップします。どちらの場合もネイティブのパスは残します。

従来のレビューログのスキル ID は保持し、次を追加します: `"host":"claude","outside_provider":"codex","outside_status":"completed|unavailable|disabled|skipped","phase":"design"`。試行ごとに結果が異なる場合は、別々に記録します。`source:"codex"` は CLI の出力が完了していることを必要とします。ネイティブは `source:"in-host"` を使います(従来の `source:"claude"` はネイティブの Claude を指します)。利用可否の確認やネイティブのフォールバックは、外部レビューの完了ではありません。報告されたすべての modelUsage を保持し、不明なモデルは不明のままにします。 `GSTACK_CODEX_NO_SANDBOX=1` の場合は、`"codex_sandbox":"danger-full-access"` を追加します。

  エラー処理: フェーズ 1 の失敗/縮退の方針が適用されます。

- デザインの選択: 外部レビュアーが、妥当な UX の根拠に基づいてデザインの判断に反対している場合 → TASTE DECISION。両方のモデルが同意するスコープの変更 → USER CHALLENGE。

**必須の実行チェックリスト(デザイン):**

1. 手順 0(デザインのスコープ): 完全性を 0〜10 で評価します。DESIGN.md を確認します。既存のパターンを対応付けます。

2. 手順 0.5(二重の voice): 上記の完了した呼び出しを、Codex SAYS(デザイン — UX への挑戦)と
   Claude SUBAGENT(デザイン — 独立したレビュー)の下に提示してください。
   plan-design-review のデザインのリトマス・スコアカードを作成します。CEO の指摘は外部の voice にのみ渡します。ネイティブの voice は独立したままにします。
   外部が欠けている、または無効な場合は N/A とし、CONFIRMED としてはいけません。主要な voice で代用することはできません。

3. パス 1〜7: 読み込んだスキルから、それぞれ実行します。0〜10 で評価します。各問題を自動判断します。
   スコアカードの DISAGREE の項目は、関連するパスで両方の視点とともに提起します。

**このフェーズを閉じる:**

上記のレビュー作業はここで終わります。ここで、以前に読んでいても、共有の close の手順を改めて読み込んでください。
フェーズ `design`、チェックポイント `<DESIGN_INPUT>`、およびこのフェーズの `methodologyPath` を使います。
この呼び出しのためにこのチェックポイントを保持してください。レビューのエクスポートでこれを置き換えてはいけません。

> **STOP.** レビューフェーズの終了(レビューが終わった後、完了の通知または次のフェーズの読み込みより前。終了のたびに読み直す)の前に、Read `~/.claude/skills/gstack/autoplan/sections/phase-close.md` を全文読んで実行してください。
> 記憶から作業しないこと。このステップの正はそのセクションです。
