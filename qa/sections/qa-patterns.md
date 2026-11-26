<!-- AUTO-GENERATED from qa-patterns.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
# ブラウザ QA の方法論

選択されたブラウザサーフェスに対してのみ実行します。プローブの前に、diff をソースと突き合わせてマッピングします。探索はブラックボックスのままとし、診断は呼び出し元が担当します。

実行順序を決めるのは共有の探索ループであり、これらの技法フェーズではありません。その
チェックポイントのルールは、ベースライン以降のすべてのプローブ(オリエンテーション、リンク、
正確なリプレイ、追加の証拠を含む)に適用されます。チェックポイントをまたいでバッチ処理してはいけません。

## モード

/qa と /qa-only では、Full、Quick、Regression のいずれかを選びます。深さを指定するフラグが
競合する場合は、プローブの前に質問して解決します。/review と /ship は、呼び出し元のスモークと計画の範囲を維持します。
Diff-aware は範囲を選ぶもので、別のパスではありません。時間の上限にはチェックポイントと証拠が含まれます。
時間を使い切ったらプローブを止め、未完了のカバレッジを報告します。チェックポイントを飛ばしてはいけません。

### Diff-aware(URL がなくフィーチャーブランチにいる場合は自動)

`main` を、検出したベースに置き換えます:

```bash
git diff main...HEAD --name-only
git log main..HEAD --oneline
```

変更されたコントローラ/ルート/ビュー/コンポーネント/モデル/サービス/スタイルをページにマッピングします。コミットと PR の意図を確認し、関連する TODO のバグをテスト計画に加えます。静的ページは直接開きます。ブラウザサーフェスの API プローブ:

```bash
aside repl '
const pg = await openTab("<base-url>");
const r = await fetch("<base-url>/api/...", { method: "GET" });
console.log("API_STATUS=" + r.status);
console.log("API_BODY_START"); console.log((await r.text()).slice(0, 4000)); console.log("API_BODY_END");
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

ブラウザサーフェスを選択して切り分けた後、URL がない場合はローカルアプリを探します:

```bash
for p in 3000 4000 8080; do curl -sI --max-time 3 "http://localhost:$p" >/dev/null 2>&1 && echo "Found app on :$p"; done
```

渡された URL、または最初に応答したもの/ステージング/プレビューを使います。どれもない場合は質問します。変更されたページと隣接するページ、およびフローをテストします。TODOS.md にない新しいバグは、Phase 6 のレポートで指摘します。

**特定できるページがない場合:** バックエンド/設定/インフラの変更であっても、Quick に加えて見つかったインタラクションを使います。

### Full(URL がある場合のデフォルト)
到達できるすべてのページを訪れます(5〜15 分)。ヘルススコアを算出し、証拠のある問題を 5〜10 件記録します。問題をでっち上げてはいけません。

### Quick (`--quick`)(クイック)
3 分: ホームページと主要なナビゲーション先 5 つ。読み込み/コンソール/リンク切れを確認し、Health Score Rubric に従ってスコアを付けます。詳細な問題とチェックリストはスキップしますが、共有ループのゲートは決してスキップしません。

### Regression (`--regression <baseline>`)(回帰)
Full を実行し、修正済み/新規の問題とスコアの差分を追記します。渡された過去のベースラインは保持します。
ベースラインが存在しない、または読み取れない場合は、前提条件の欠落です。ブロックされるのは比較であり、Full の実行ではありません。

## ワークフロー

### Phase 1: 初期化

呼び出し元の BROWSER SETUP と、呼び出し元が所有するアーティファクトのパスを再利用します。Aside が READY なら Aside、そうでなければ `$B`
(`NEEDS_ASIDE`/`ASIDE_NOT_RUNNING`)を使います。足りないセットアップは、呼び出し元の権限の範囲内でのみ
完了させます。共有ループの期限ガードは、呼び出し元の進行中の期限に合わせて絞り込みます。

### Phase 2: 認証(必要な場合)

/setup-browser-cookies または `$B handoff`/`$B resume` については、BROWSER SETUP の **Browser access decision** に従います。ユーザーがサインイン/2FA/OTP/CAPTCHA を終えた後に再実行します。認証情報を扱ったり、cookie/トークン/localStorage を露出させたりしてはいけません。

### Phase 3: オリエンテーション

負荷をかける前に、成功するベースラインを確立します。単に読み込みが成功したことではなく、
ページやインタラクションの期待される結果/状態を観察します。

**読み取り/フロー:** `flow = true` を設定し、インタラクションのアクション/待機を置き換えます。スクリプトは 1 つに保ちます。タブはその終了時に閉じられます。

```bash
aside repl '
const flow = false;
const HOOK = `(() => { window.__gstackErrs = window.__gstackErrs || []; const oe = console.error; console.error = (...a) => { window.__gstackErrs.push(a.map(String).join(" ")); oe.apply(console, a); }; window.addEventListener("error", e => window.__gstackErrs.push("uncaught: " + e.message)); window.addEventListener("unhandledrejection", e => window.__gstackErrs.push("unhandledrejection: " + (e.reason && e.reason.message || e.reason))); })()`;
const pg = await openTab("about:blank");
await pg._sendToTarget("Page.addScriptToEvaluateOnNewDocument", { source: HOOK });
await pg.goto("<target-url>");
console.log((await snapshot(pg, { interactive: true })).tree);
await pg.screenshot({ path: flow ? "issue-001-step-1.jpg" : "initial.jpg", type: "jpeg", quality: 60, fullPage: !flow });
if (flow) {
  await pg.locator("e12").click();
  await sleep(500);
  console.log("DIFF_START"); console.log((await snapshot(pg)).diff); console.log("DIFF_END");
  await pg.screenshot({ path: "issue-001-result.jpg", type: "jpeg", quality: 60 });
}
console.log("URL=" + pg.url());
console.log("CONSOLE_ERRORS=" + JSON.stringify(await pg.evaluate(() => window.__gstackErrs)));
console.log("TEXT_START"); console.log((await pg.evaluate(() => document.body.innerText)).slice(0, 20000)); console.log("TEXT_END");
console.log("ASIDE_DIR=" + pwd);
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

すべてのスクリーンショットについて: `cp "<ASIDE_DIR>/initial.jpg" "$REPORT_DIR/screenshots/initial.jpg"`(名前は置き換える)を実行し、続けて Read します。レポート/スクリーンショットを削除してはいけません。

**リンク:** 同一オリジンの安全なパス。HEAD はローカルでのみ使います(リクエストには cookie が付きます)。

```bash
aside repl '
const pg = await openTab("<target-url>");
const links = await pg.evaluate(() => [...new Set([...document.querySelectorAll("a[href]")].map(a => a.href))].filter(h => new URL(h).origin === location.origin && !/logout|signout|delete|remove|cancel|unsubscribe/i.test(h)));
const local = await pg.evaluate(() => /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])$|\.(localhost|test)$/.test(location.hostname));
for (const l of links) { if (!local) { console.log("LINK ?", l); continue; } const r = await fetch(l, { method: "HEAD" }).catch(e => ({ status: "ERR " + e.message })); console.log("LINK", r.status, l); }
await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

`LINK` が 4xx/5xx、または `ERR` の場合は、リンク切れです。`LINK ?` は未検証です。リンクに含まれない SPA のボタン/メニューは、スナップショットを取ります。

フレームワーク: `__next`/`_next/data` = Next.js、`csrf-token` = Rails、`wp-content` = WordPress、リロードなしのナビゲーション = SPA。

### Phase 4: 探索

直前の結果から、次の候補を選びます。各ページで、`page-<name>.jpg` を指定して読み取りスクリプトを使います。`qa/references/issue-taxonomy.md` に従い、レイアウト、コントロール、空/不正/境界値のフォーム、ナビゲーション、空/読み込み中/エラー/オーバーフローの状態を確認します。副次的なページよりコアフローを優先します。Quick ではこのチェックリストをスキップします。モバイルの場合:

```bash
aside repl '
const pg = await openTab("<page-url>");
await pg._sendToTarget("Emulation.setDeviceMetricsOverride", { width: 375, height: 812, deviceScaleFactor: 2, mobile: true });
await sleep(300);
await pg.screenshot({ path: "page-mobile.jpg", type: "jpeg", quality: 60, fullPage: true });
await pg._sendToTarget("Emulation.clearDeviceMetricsOverride", {});
console.log("ASIDE_DIR=" + pwd); await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

### Phase 5: 記録

各問題は、共有ループの正確なリプレイのルールに従って一度再試行して確認し、その後
最小化して、スクリーンショットの証拠をすぐに報告します。リプレイが終わる前のタイムアウトは、
確認が未完了であることを意味します。それ以降のタイムアウトでは、確認済みの欠陥はそのままですが、証拠
または最小化が未完了になります。

**インタラクティブ:** Phase 3 で `flow = true` にします。代替手段: `pg.fill("#email", "qa@example.com")`, `pg.getByRole("button", { name: "Save" }).click()`, `pg.waitForSelector("#done")`, `pg.waitForURL(/dashboard/)`. 再現手順には、前後のスクリーンショットをリンクします。

**静的**(文言/レイアウト/画像): 注釈付きスクリーンショット 1 枚と説明。

```bash
aside repl '
const pg = await openTab("<page-url>");
const a = await annotatedScreenshot(pg);
await fs.writeFile(path.join(pwd, "issue-002.png"), Buffer.from(a.base64Image, "base64"));
console.log("ASIDE_DIR=" + pwd); await closeTab(pg); console.log("GSTACK_STEP_OK");
'
```

### Phase 6: まとめ

新しいプローブは行わず、保持した証拠を整形します。このホストにインストールされた QA ディレクトリの `templates/qa-report-template.md`
と、呼び出し元のアーティファクト/混合レポートのルールを使います。

スコア、重大度順の Top 3 Things to Fix、コンソールの健全性、重大度ごとの件数、日付、所要時間、ページ/スクリーンショットの数、フレームワークを報告します。`baseline.json` を保存します: `date` (YYYY-MM-DD)、`url`、`healthScore`、`issues` (`id`、`title`、`severity`、`category`)、`categoryScores`。Regression では、fixed = 過去にのみ存在、new = 今回にのみ存在、とします。

## Health Score Rubric(ヘルススコア基準)

各カテゴリのスコア(0-100)を計算し、加重平均を取ります。

### カウント方法
- ページをまたいで同じ根本原因は重複を排除します。最初に該当するものを 1 つの主カテゴリとして使います: Links(ナビゲーション)、Accessibility(アクセスの障壁)、Functional(動作)、Performance(速度)、Visual(レイアウト)、Content(文言)、UX(摩擦)、Console(残りのエラー)。二重に減点してはいけません。
- **未テスト** のカテゴリは除外します。部分的なスコアには、カバレッジとともに **暫定** と明記します。どれもテストしていない場合は "not scored" とします。比較は、カバレッジが同一の場合のみ行います。

### Console(重み: 15%)
再現可能なエラー/例外は、ページをまたいでメッセージとソースで重複を排除します。警告、情報、および他で採点された欠陥は除外します。
- 0 errors → 100
- 1-3 errors → 70
- 4-10 errors → 40
- 11+ errors → 10

### Links(重み: 10%)
クライアントサイドのルートを含め、一意のリンク切れ先を数えます。再現する 4xx/5xx、存在しないルート/アンカー、タイムアウトが対象です。想定された認証リダイレクトと、リソース/API のリクエストは除外します。
- 0 broken → 100
- リンク切れ 1 件ごとに → -15(最小 0)

### カテゴリ別の採点(Visual、Functional、UX、Content、Performance、Accessibility)
100 から始め、指摘事項ごとに減点します:
- Critical issue → -25
- High issue → -15
- Medium issue → -8
- Low issue → -3
下限: 0。

該当する最も高い重大度を使い、影響と回避策を記録します:
- **Critical:** データ損失、セキュリティ/プライバシーの露出、またはすべてのユーザーにとってコアアプリが使用不能。
- **High:** 回避策なしで、コア/主要なタスクがブロックされる。
- **Medium:** タスクが阻害されるが、回避策がある。
- **Low:** タスクの完了が妨げられない、見た目/文言/摩擦の問題。
Console/Links は、代わりに件数を使います。

### 重み
| カテゴリ | 重み |
|----------|------|
| Console | 15% |
| Links | 10% |
| Visual | 10% |
| Functional | 20% |
| UX | 15% |
| Performance | 10% |
| Content | 5% |
| Accessibility | 15% |

### 最終スコア
小数の重みを使います(15% = 0.15): `score = Σ (category_score × weight) / Σ tested weights`。丸めるのは最終スコアだけで、最も近い整数にします(0.5 は切り上げ)。

---

## フレームワーク別のガイダンス

- **Next.js:** ハイドレーションエラー(`Hydration failed`、`Text content did not match`)、`_next/data` の 404、リンクのクリックによるルーティング(`goto` だけでなく)、動的コンテンツの CLS。
- **Rails:** 開発環境での N+1 警告、フォームの CSRF、Turbo/Stimulus の遷移、フラッシュメッセージの表示/消去。
- **WordPress:** プラグインの JS の競合、サインイン時の管理バー、`/wp-json/`、混在コンテンツ。
- **SPA:** スナップショットによるナビゲーション、戻ったときの古い状態、戻る/進むの履歴、長時間使用後のリークを示すコンソールの兆候。

## 重要なルール

**ブラウザでの探索中は、ソースコードを決して読んではいけません。** 現実的なエンドツーエンドのフローを使い、インタラクションのたびにコンソールを確認します。クリック対象が見つからない場合は、注釈付きラベルを使い、それでもだめなら ref/CSS によるクリックを使います。

認証情報には `[REDACTED]` を使います。BROWSER SETUP の安全性/センチネルのルールに従います。実行ごとに、LOCAL 以外の変更を列挙した AskUserQuestion を、操作する前に 1 回だけ行います。LOOK は ACT ではありません。

**選択されたブラウザサーフェスについて、ブラウザの使用を決して拒否してはいけません。** バックエンドのみのアプリ変更であっても同様です。テストや curl では代替できません。API/CLI/ジョブ/ワーカー/webhook が対象の場合は、選択されません。
