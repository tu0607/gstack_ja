# 修正 #1671: `/office-hours` が SESSION_COUNT: 0 と報告し続ける

**ステータス:** 出荷済み
**ブランチ:** fix-1671-profile-migration
**日付:** 2026-05-23
**Issue:** https://github.com/garrytan/gstack/issues/1671
**バグを持ち込んだ元の PR:** garrytan/gstack#1039 / コミット `0a803f9` / v1.0.0.0 / 2026-04-18

## 問題

`/office-hours` は、毎回の呼び出しで `SESSION_COUNT: 0` と `TIER: introduction` を報告します。何度もスキルを使ってきたユーザーでもです。`welcome_back` のティア(`bin/gstack-developer-profile:165-169`)は、リピーターに対して締めの売り込みを飛ばすためのものですが、到達不能になっています。v1.0.0.0 以降、新規の `$HOME` を使うすべてのユーザーで、約 5 週間にわたってこの状態です。

## 根本原因

v1.0.0.0 の移行で読み取りの経路は `~/.gstack/developer-profile.json` に移りましたが、書き込みを行う `office-hours/SKILL.md.tmpl` は古い `~/.gstack/builder-profile.jsonl` に書き続けていました。初回の読み取り時に作られる `ensure_profile` のスタブは `sessions: []` です。その後の書き込みは、リーダーが二度と読まないファイルに行きます。リーダーとライターが、保存先について食い違っていたのです。

根本原因の完全な分析(RC2/RC3 のフォローアップを含む): https://github.com/garrytan/gstack/issues/1671

## 修正

書き込み側を、読み取り側と同じファイルを使うようにします。

### 変更点

1. **`bin/gstack-developer-profile`** — `--log-session '<json>'` サブコマンドを追加:
   - 必須フィールド(`date`、`mode`)を検証し、不正な入力は黙ってスキップする(`bin/gstack-timeline-log:22-26` に合わせる)。
   - 既存の `developer-profile.json` を `bun -e` で読む。
   - `sessions[]` にエントリを追加する。`signals_accumulated` を更新する(シグナル文字列ごとの増分。`do_migrate:67-69` と同じ)。`resources_shown` と `topics` は和集合を取る。
   - アトミックな mktemp + mv の書き込み(54 行目の既存のパターンに合わせる)。
   - 書き込み後に `gstack-brain-enqueue "developer-profile.json"` を呼ぶ。`bin/gstack-timeline-log:40` に合わせる。

2. **`bin/gstack-developer-profile:do_read`** — LAST_PROJECT / LAST_ASSIGNMENT / LAST_DESIGN_TITLE / CROSS_PROJECT / DESIGN_* を選ぶときに、`mode:"resources"` のエントリを除外する。フェーズ 6 の resources の自動追記は、同じ /office-hours の呼び出しで、実際のセッションの後に行われる。フィルタがないと、その resources のエントリが、ユーザーの次のセッションのための実際のセッションの状態を上書きしてしまう。これは、壊れた書き込み側に隠されていた潜在的なバグで、この修正によって表に出てくる。

3. **`office-hours/SKILL.md.tmpl`** — 490 行目と 893 行目の書き込み側を入れ替える:
   - 変更前: `echo '{...}' >> "$GSTACK_STATE_ROOT/builder-profile.jsonl"`
   - 変更後: `~/.claude/skills/gstack/bin/gstack-developer-profile --log-session '{...}' 2>/dev/null || true`
   - `bun run gen:skill-docs` を実行して `office-hours/SKILL.md` を再生成する。

### この修正に含めないこと(意図的に)

- **新しいバイナリは作らない。** `developer-profile.json` の所有者のバイナリは `gstack-developer-profile` なので、書き込みはそのサブコマンドとして置く。`--log-session` は、このバイナリの既存の書き込み側サブコマンドの境界(`--migrate` / `--derive`)に加わるもので、`gstack-*-log` のイベント書き込みの系統には入らない。動詞の名前は `gstack-*-log` のものと合わせる。
- **mkdir のロックは入れない。** 同時の /office-hours 呼び出しは、`developer-profile.json` に対して読み取り・変更・書き込みの競合を起こす。コードベースでは、`gstack-config`(YAML の読み取り・変更・書き込み、ロックなし)でも同じ競合を許容している。この修正が持ち込んだものではなく、範囲外。
- **スキーマの変更はしない。** スキーマは `schema_version: 1` のまま。この修正はスキーマを変えず、書き込み側がそれを使うようにするだけ。
- **影響を受けるユーザーの自動的な照合はしない。** 既存のユーザーが、`builder-profile.jsonl` に取り残したエントリは、過去の履歴が `developer-profile.json` に自動的にマージされることはない。次の /office-hours の実行で、最初の新しいセッションは `welcome_back` に入る。過去のデータは古いファイルに残る(非推奨の期間中は他のツールからまだ読める)。影響を受けるユーザーのほとんどは取り残されたセッションが少数なので、失われるのは主に見た目の問題にとどまる。1 リリースだけの照合の経路は、正味のノイズだとして削除した(Garry の「正しいサイズの差分」の声)。
- **自動の /autoplan のタイムライン集約(RC2)はしない。** 別の問題で、別の PR にする。
- **プロジェクト単位のオプトイン(RC3)はしない。** 別の問題で、別の PR にする。
- **gbrain の glob は変えない。** office-hours のマニフェストは、コンテキストのために `~/.gstack/builder-profile.jsonl` をまだ glob している。新しい書き込みがそのファイルに入らなくなるので、スナップショットは古くなる。UX の問題になったら、後続の修正で更新する。

### テスト(すべてゲートのティア。無料で、決定的)

1. `test/gstack-developer-profile.test.ts` の**回帰テスト**:
   - 新規の `$HOME`。
   - /office-hours の前処理を実行: gstack-developer-profile が空のスタブを作る。
   - 起動モードの JSON で `--log-session` を呼ぶ。
   - もう一度 `--read` を実行する。`SESSION_COUNT: 1`、`TIER: welcome_back` をアサートする。
   - 現在の main では失敗する(サブコマンドが存在しない)。修正後は通る。

2. **`do_read` のモードフィルタのテスト:** 起動のセッションの後に resources のエントリを記録すると、`--read` は LAST_PROJECT / LAST_ASSIGNMENT / LAST_DESIGN_TITLE を、resources のエントリからではなく、実際のセッションから返す。RESOURCES_SHOWN は正しく集計され続ける。

3. **検証と集計のテスト:** `--log-session` は、不正な JSON や必須フィールドの欠けたものを黙ってスキップする。`ts` がなければ注入し、ユーザーが設定した `ts` は保持する。複数のセッションにわたって signals/resources/topics を正しく集計する。

4. `test/static-no-legacy-writes.test.ts`(新規)の**静的な grep による不変条件**: すべてのスキルのディレクトリを走査し、許可リストにあるリーダー(`gstack-developer-profile`、`gstack-memory-ingest.ts`、`gstack-artifacts-init`、ドキュメントのファイル)以外のプロダクションのコードパスが `builder-profile.jsonl` に書き込まないことをアサートする。将来の書き込み側が古いファイルへ退行するのを防ぐ。

### 受け入れ基準

- 新規の `$HOME` での 2 回目の `/office-hours` の呼び出しが、`TIER: welcome_back` を返す。
- 変更したファイルに対して、単独で `bun test` が通る。
- `bun run gen:skill-docs` が、`.tmpl` の編集と一致するきれいな差分を生成する。

### ロールアウト

- コミットは 1 つ。CHANGELOG のスタイルガイドに従い、PATCH のバージョンを上げる。
- CHANGELOG のエントリは `/ship` が書く。ユーザー向けの文体: 以前にはなかった、ユーザーが今体験することを冒頭に書く(welcome_back のティアは 2 回目の訪問で効くようになる)。

## フォローアップの TODO

- 1 リリースの後、`builder-profile.jsonl` を完全に非推奨にする(書き込み側 + シム + memory-ingest の型)。
- RC2 を修正する(autoplan が子スキルをインライン展開するため、子スキルのタイムラインログのプリアンブルを迂回してしまう)。
- RC3 に対応する: 複数のエージェントの ID を使うパワーユーザー向けに `GSTACK_PROFILE_SCOPE` のオプトインを追加する。
- /plan-tune が `--derive` を呼ばないため、`inferred`/`gap` がずれうる(既存の問題で、#1671 の根本原因とは無関係)。
- `mode:"resources"` のエントリは、既存のティア集計の下で SESSION_COUNT を膨らませる(既存の問題で、#1671 の根本原因とは無関係)。
