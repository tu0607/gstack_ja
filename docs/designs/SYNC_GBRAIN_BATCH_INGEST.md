# /sync-gbrain バッチ取り込みの移行

**ステータス:** garrytan/dublin-v1 で実装済み(D1-D8 の判断をこの PR に含める)
**ブランチ:** garrytan/dublin-v1
**担当:** Garry Tan
**きっかけ:** 2026-05-09 の /investigate の実行
**見積もり工数:** 人間 約3日 / CC+gstack 約2時間
**変更ファイル:** ソース 4 件 + テスト 1 件 = 計 5 件(見積もりより少ない)

## 判断(レビュー後)

このドキュメントは、当初のアーキテクチャを記録している。最終的なアーキテクチャは、次の8件のレビュー判断に従う(`/Users/garrytan/.claude/plans/purrfect-tumbling-quiche.md` に記録)。

- **D1** 階層化したステージングディレクトリ(スラッグのセグメントごとに mkdir -p)— 採用
- **D2** 切り替えと同じ PR で旧方式を削除(`--legacy-ingest` フラグは作らない)— 採用
- **D3** 元のソースファイルを先にスキャンし、クリーンなものだけをステージする — 採用
- **D4** ~~三状態の OK/DEGRADED/ERR の判定~~ Codex の指摘 7 により OK/ERR の二状態に統合(gbrain の content_hash による冪等性があるため、第三の状態は不要)
- **D5** ~~状態スキーマの skip_reason フィールド~~ Codex の指摘 7 により削除(再実行は安いので、永続的なスキップ管理は不要)
- **D6** gbrain の content_hash による冪等性を信頼し、帳簿の仕組み(skip_reason、三状態、SIGTERM のチェックポイント)は削除する
- **D7** `~/.gbrain/sync-failures.jsonl` によるファイル単位の失敗検出(バイトオフセットのスナップショットと追記のみの読み取り)
- **D8** スコープ内の既存の不具合を 3 件まとめて修正: F6 アトミックな saveState(tmp + rename)、F8 隔離ステージングのベンチマーク、F9 ファイル全体の sha256 ハッシュ(1MB の上限を撤廃)

## gbrain のソースで検証済み

`~/git/gbrain/src/` を読んで、3 つの性質を確認した。

- **冪等性**: `core/import-file.ts:242-243, :478` — content_hash を確認し、変わっていなければスキップ、変わっていれば上書き。
- **frontmatter の整合**: `core/import-file.ts:228, 297, 410-422` — title/type/tags を反映する。frontmatter がないときだけ自動推論する。
- **パスを正とするスラッグ**: `core/sync.ts:260`(`slugifyPath`)、`core/import-file.ts:429` で適用される。
- **ファイル単位の失敗の表面化**: `commands/import.ts:308-310`。`:28` のコメントは「callers can gate state advances」。D7 が使う意図された API である。

## 性能: 計画と計測値(2026-05-10 の性能レビュー後)

| 指標 | 計画の目標 | 計測値 | 判定 |
|---|---|---|---|
| 5135 ファイルでの準備フェーズ | — | <10s | 速い |
| 5135 ファイルでの `gbrain import` | — | >10 分 | gbrain 側の性能問題、起票済み |
| ループ/ハング(当初のバグ) | なし | なし | 修正済み |
| SIGTERM でメモリの取り込みが null で終了 | なし | なし — 状態の書き込みは成功。子の gbrain は親とともに終了する | 修正済み |
| FILE_TOO_LARGE が last_commit を止める | なし | なし — 失敗したパスは D7 で除外される | 修正済み |

**当初の性能の見込み違いと修正。** 最初のコールドランの計測(約 12 分)の大半は、1841 回の逐次的な gitleaks サブプロセスの起動(それぞれ約 256ms)に費やされていた。これは冗長なセキュリティゲートだった。クロスマシンの流出の境界は `gstack-brain-sync`(bin/gstack-brain-sync:78-110、コミット前にステージされた差分を正規表現でシークレットスキャンする)である。ローカルの PGLite に取り込む前に、すべてのソースファイルをスキャンしても、露出は変わらない。シークレットは既にディスク上に平文で存在しているからだ。そこで、ファイルごとの gitleaks はオプトインにし、既定ではオフにした。これにより準備フェーズは約 12 分から 10 秒未満になった。

残りのコールドランのコストは、`gbrain import` 自体である。大きなステージングディレクトリでは、線形より悪くスケールする(501 ファイルで 10 秒、5031 ファイルで 10 分超)。これは gstack の設計ではなく、gbrain 側の性能問題である。TODO として起票済み。修正は gbrain の content_hash チェックのループか、自動リンクの調整フェーズにある可能性が高い。

## F9 のハッシュ移行(一度きりの切り替え)

F9 は `fileSha256` を、1MB で上限を設けたハッシュからファイル全体のハッシュに切り替えた。この変更より前の既存の状態エントリは、古い 1MB 上限のハッシュを持つ。mtime が変わっていないファイルでは、`fileChangedSinceState` が mtime のチェックで false を返すため、新しいハッシュは計算されない。そのため、変更のないファイルは以前と同じように動く。アップグレード後に mtime が変わったファイルでは、ファイル全体のハッシュが再計算され、(正しく)変更ありとみなされて再インポートされる。`gbrain doctor` のプローブレポートの `updated_count` は、アップグレード後の最初の実行で水増しされて見えるかもしれない。触れたファイルはすべてアルゴリズムの境界をまたぐからだ。データの損失はないが、知っておく価値はある。

## 後続の作業(TODO として起票)

1. **大きなディレクトリでの gbrain import の性能** — 501 ファイルは 10 秒なのに、5031 ファイルで 10 分超かかる理由を調べる。考えられる原因: `getPage(slug)` による content_hash チェックでの N+1 の SQL、ページごとの自動リンクの調整、バッチ化されていない FTS インデックスの更新。gstack ではなく gbrain の中にある問題。
2. **任意: ソースファイルの変更検出キャッシュ** — 準備フェーズが速くなっても、5031 ファイルを歩くにはそれなりの時間がかかる。最後に成功した取り込み以降に変更がない状態を、バッチ単位(ファイル単位ではない)でキャッシュすれば、変更のない増分実行では準備フェーズを丸ごと省略できる。

## 課題

`/sync-gbrain` のメモリ段階は、新しい PGLite では 35 分かかり、null で終了して進捗をすべて失う。続けて実行すると、同じ 35 分をやり直す。2 回の連続した実行で観測された(gbrain 0.30.0 の broken-postgres での実行: 712 秒で null 終了、gbrain 0.31.2 の PGLite での実行: 2100 秒で null 終了、ただし 501 ページは実際に保存されていた)。

## 根本原因(/investigate より)

`bin/gstack-memory-ingest.ts` には、重なり合う 2 つのバグがある。

1. **ファイルごとのサブプロセス構成。** 911 行目の取り込みループは、`~/.gstack/projects/` の 1,841 ファイルを歩き、ファイルごとに 2 つのサブプロセスを起動する。
   - `gitleaks detect --no-git --source <path>` — コールドスタート 46ms(`lib/gstack-memory-helpers.ts:157`)
   - `gbrain put <slug>` — コールドスタート 329ms(`bin/gstack-memory-ingest.ts:823`)
   - ファイルごとの下限: 375ms × 1841 = 690 秒(11.5 分)。実際の作業の前に、サブプロセスの起動だけで費やされる。
2. **kill で保存されないタイムアウト。** `bin/gstack-gbrain-sync.ts:442` のオーケストレーターは 35 分のタイムアウトを課している。発火すると、`spawnSync` は `result.status === null` を返し、子は SIGTERM を受け取る。メモリ内の取り込み状態は `~/.gstack/.transcript-ingest-state.json` に書き出されない。次の実行は同じ未進行の状態から始まる。これが、毎回すべてをやり直す現象を説明する。

## 現場の数値

| 指標 | 値 | 出典 |
|---|---|---|
| walkAllSources のファイル数 | 1,841 | `find ~/.gstack/projects -type f \( -name "*.md" -o -name "*.jsonl" \)` |
| `gbrain put` のコールドスタート | 329ms | `time (echo "test" \| gbrain put _bench)` |
| `gitleaks detect` のコールドスタート | 46ms | `time gitleaks detect --no-git --source <small-file>` |
| 理論上の下限(サブプロセスのみ) | 690 秒 / 11.5 分 | 375ms × 1841 |
| 実際の実行時間 | 2100 秒 / 35 分 | オーケストレーターのタイムアウトと正確に一致 |
| 実際に保存されたページ数 | 501 | gbrain sources list page_count |
| 実行中の PGLite の増加 | 290 → 386 MB | `du -sh ~/.gbrain/brain.pglite` |

## 提案するアーキテクチャ

サブプロセスごとの逐次ループを、**準備してからバッチ処理する**パイプラインに置き換える。

```
walkAllSources(ctx)
  → prepareStage (in-process, fast):
       parse transcripts/artifacts
       build PageRecord with custom YAML frontmatter
       gitleaks scan (single subprocess on staging dir)
       write prepared .md to staging dir
  → gbrain import <staging-dir> --no-embed (single subprocess)
  → flush state file with all successes
  → cleanup staging dir
```

### `gbrain import <dir>` が正しいバッチの経路である理由

- gbrain の CLI にすでに実装されている(検証済み: `gbrain --help` に `import <dir> [--no-embed]` が出る)。
- gbrain 自身のランタイムの中でプロセス内にディレクトリを歩くため、サブプロセスの分岐がない。
- gbrain のバッチサイズと埋め込みのバッチ調整を活かせる。
- 観測された実行では、gbrain v0.31.2 の import は 10 秒で 501 ページと 2906 チャンクを処理した。遅かったのは、上にある当方の**ページごとの `gbrain put` ループ**だった。

### 現行コードが正しく行っていて、維持するもの

- **カスタムの YAML frontmatter の注入**(title、type、tags)— frontmatter 付きの準備済み .md をステージングディレクトリに書き出すことで維持する。
- **シークレットのスキャン** — 維持するが、準備の後、取り込みの前に、`gitleaks detect --source <staging-dir>` を 1 回だけ呼ぶ形に移す。検出のあったファイルは、既存のリダクションのポリシー(`lib/gstack-memory-helpers.ts`)に従って、編集するか除外する。ステージングディレクトリは、gitleaks が見るのは準備済みの内容だけで、gbrain の内部状態は見えないことを保証する。
- **部分的なトランスクリプトの検出** — 準備フェーズで維持する。部分的なファイルには引き続き frontmatter に `partial: true` を付ける。
- **帰属できないトランスクリプトのフィルタリング** — 準備フェーズで維持する。
- **ファイルごとの mtime + sha256 の状態管理** — 維持する。準備フェーズはステージされたものを記録し、取り込みの成功結果は実際に保存されたものを記録する。
- **増分モード** — `fileChangedSinceState` のチェックは、準備ループの先頭に残す。

## 移行の手順

### 手順 1: 現行の取り込みループから `preparePages` を抽出する

`bin/gstack-memory-ingest.ts` の `ingestPass`(899-988 行)のうち、歩く処理と `gbrainPutPage` の呼び出しの間にあるものをすべて取り出し、新しい関数 `preparePages(args, ctx, state) → { staged: PreparedPage[], skipped, failed }` に移す。

出力: `{ slug, body, source_path, mtime_ns, sha256, partial }` のリスト。`body` は frontmatter を含む完全な markdown である。

### 手順 2: ステージングディレクトリへの書き出しを追加する

純粋関数: `writeStaged(prepared, stagingDir) → { written, errors }`。
ファイル名: `${slug}.md`。冪等な上書き。

ステージングディレクトリのライフサイクル:
- `~/.gstack/.staging-ingest-${pid}-${ts}/` に作成する
- `finally` ブロックで、SIGTERM の場合も含めて削除する
- 取り込みパスごとに 1 つのステージングディレクトリを使い、実行をまたいで再利用しない

### 手順 3: gitleaks を 1 回だけ実行する

準備の後に 1 回呼ぶ形に、ファイルごとの `secretScanFile(path)` の呼び出しを置き換える。
`gitleaks detect --no-git --source <staging-dir> --report-format json --report-path -`。

JSON の出力を解析し、`Map<slug, findings[]>` を作る。検出のあったファイルは、取り込みの前にステージングディレクトリから取り除く(または、`lib/gstack-memory-helpers.ts` の既存のリダクションのポリシーに従ってその場で浄化する)。

### 手順 4: `gbrainPutPage` のループを、取り込みの呼び出し 1 回に置き換える

```typescript
const importResult = spawnSync("gbrain", ["import", stagingDir], {
  stdio: ["ignore", "inherit", "inherit"],
  timeout: 30 * 60 * 1000, // generous; whole batch
});
```

stdout を解析し、`Import complete` の行と `failed` の件数を取り出す。

### 手順 5: 部分的な成功のときに状態を保存する

gbrain import が `imported=N, failed=M` を報告したら、成功した N 件のスラッグの状態を保存する(すべてではない)。失敗したものは状態に記録せず、次回の実行で再試行させる。成功したものはやり直さない。

### 手順 6: `gstack-memory-ingest.ts` に SIGTERM ハンドラを追加する

`main()` を次のように包む。
```typescript
let interrupted = false;
const flush = () => {
  if (interrupted) return;
  interrupted = true;
  saveState(state); // best-effort flush of whatever's accumulated
  cleanupStagingDir();
  process.exit(143);
};
process.on("SIGTERM", flush);
process.on("SIGINT", flush);
```

これは、kill で保存されないバグを独立して解消する。バッチの取り込みがオーケストレーターのタイムアウトを超えても、準備段階の状態は残る。

### 手順 7: オーケストレーターを更新する

`bin/gstack-gbrain-sync.ts:444` で:
- `result.status === 0` を `result.status === 0 || (parsedSummary.imported > 0 && parsedSummary.imported >= parsedSummary.skipped + parsedSummary.failed)` に変える。部分的な成功(大半のページが取り込まれた)は、ERR ではなく OK とみなす。
- 段階のサマリーに `failed_count` と `partial_blockers` を出し、ユーザーが `ERR exited null` ではなく `Memory ... OK 487/501 imported (14 FILE_TOO_LARGE)` を見られるようにする。

### 手順 8: FILE_TOO_LARGE を個別に扱う

gbrain が FILE_TOO_LARGE を報告したら、新しい `~/.gstack/.ingest-skip-list.json` に記録する。次の準備フェーズは、そのファイルを完全にスキップする。常に失敗するファイルを再びステージしないためである。ユーザーは、新しい `gstack-memory-ingest --skip-list` フラグで一覧を確認できる。

## テスト計画

1. **単体テスト(無料、`bun test` で実行):**
   - 50 ファイルのフィクスチャコーパスに対する `preparePages`。YAML が正しいこと、部分的な検出が動くこと、帰属できないものがフィルタされることを確認する。
   - `writeStaged` の上書きの冪等性。
   - 子プロセスのテストハーネスを使った SIGTERM ハンドラの flush の動作。

2. **インテグレーションテスト(無料、`bun test` で実行):**
   - エンドツーエンド: 準備 → gitleaks → 一時的な PGLite への gbrain import。page_count が取り込み件数と一致することを確認する。
   - 部分的な成功の経路: FILE_TOO_LARGE を意図的に注入する。成功したものは状態に残り、失敗がスキップリストに記録されることを確認する。
   - SIGTERM をまたぐ状態の保持: ingest を起動し、途中で kill し、再起動して、再開された状態を確認する。

3. **ベンチマークのゲート(定期実行、有料):**
   - 1841 ファイルのフィクスチャでのコールドラン: 8 分未満であることを確認する。
   - 増分ラン(変更なし): 60 秒未満であることを確認する。
   - テスト用フィクスチャ: 繰り返し可能な計測のため、`~/.gstack/projects/` のスナップショットをコピーしたもの。

## ロールバック戦略

- 新しい `--legacy-ingest` フラグを `gstack-memory-ingest` に追加し、古いファイルごとの経路を 1 リリースサイクルの間だけ呼べるようにする。
- 実際のコーパスでバッチの経路が後退した場合は、`gstack-config set memory_ingest_path legacy` を設定すれば、再デプロイなしで戻せる。
- バッチが安定したと確認できたら、フラグとレガシーの経路を 1 つ後のマイナーバージョンで削除する。

## plan-eng-review に向けたリスクと未解決の問い

1. **overlapping スラッグでの gbrain import の冪等性。** 以前の実行がスラッグ X を古い内容で PGLite に書いていた場合、更新された X の `gbrain import` は上書きするのか、重複させるのか。依存する前に検証が必要。

2. **gbrain import のパーサーでの frontmatter の注入。** 現行のコードは、既存の frontmatter ブロックに title/type/tags を注入する方法を知っている(794-821 行)。`gbrain import` は、`gbrain put` と同じようにこれらのフィールドを反映するか。単体テストで検証する。

3. **ステージングディレクトリのディスクへの負荷。** 1841 ファイル × 平均約 50KB = 約 92MB のステージング用 .md の内容。開発用マシンでは許容できるが、知っておく価値はある。代替案: gbrain が対応していれば、準備した内容を tar にまとめて import にパイプで渡す。ただし対応していない可能性が高いため、V1 では無視する。

4. **ワークツリーをまたいだ同時実行。** `~/.gstack/.staging-ingest-${pid}-${ts}/` は pid で名前空間を分けているため、同時に実行される 2 つの /sync-gbrain が衝突しない。ただし、オーケストレーターはすでに `~/.gstack/.sync-gbrain.lock` でロックを取っているため、これは念のための保険である。保持する。

5. **「memory ingest exited null」というメッセージ。** この変更の後も、オーケストレーターは実際の OOM kill や SIGKILL の場合には status=null を見るかもしれない。判定のブロックをもっと正直にするべきか。例: `ERR memory: killed by signal SIGTERM at 35:00 (timeout)`。

6. **メモリに対して `gbrain put` を完全に廃止すべきか。** レガシーの経路は、V1.5 の `put_file` 移行計画のために残っている。バッチの import が動けば、オーケストレーターの外から起動される `~/.gstack/.transcript-ingest-state.json` の更新や、アドホックな取り込みのために、単一ページの put をフォールバックとして残す必要があるか。おそらく必要だが、確認する価値はある。

## これが対象でないもの

- gbrain CLI の変更ではない。作業はすべて gstack 内で行う。
- CLAUDE.md の声や UX の変更ではない。
- ユーザー向けの新機能でもない。CHANGELOG のエントリは「Memory ingest is ~10× faster on cold runs and survives interruption.」とする。

## 受け入れ基準

- 1841 ファイルでのコールドの `/sync-gbrain` が 8 分未満で完了する。
- 増分の `/sync-gbrain`(ファイルの変更なし)が 60 秒未満で完了する。
- 実行中の SIGTERM で状態が flush され、次回の実行は取り込み済みのファイルをやり直さずに再開する。
- FILE_TOO_LARGE の失敗が sync.last_commit の前進を妨げない。
- 既存のすべてのテストフィクスチャ(トランスクリプト、learnings、design-docs、ceo-plans)が、完全な frontmatter 付きで正しく取り込まれる。
- 部分的なトランスクリプトと帰属できないトランスクリプトの扱いに回帰がない。
