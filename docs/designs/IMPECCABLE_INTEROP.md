# impeccable interop — gstack のデザインスキルと impeccable エンジン、カタログ、オープンな DESIGN.md 形式

**ステータス:** `tehran-v1` で出荷済み(PR 1 本、13 の二分割されたコミット)。CEO 計画 `~/.gstack/projects/garrytan-gstack/ceo-plans/2026-09-08-impeccable-design-interop.md` から昇格。
**最終更新:** 2026-09-08
**著者:** garrytan(/plan-ceo-review、/plan-eng-review、および 2 回の Codex の社外の声によるレビューとともに)

## 出荷された内容

- **検出器の事前処理。** `bin/gstack-design-detect.ts` は、ユーザーがインストールした impeccable エンジンを探し(impeccable のインストーラーやランチャーは決して実行しない。レビューの後に、エンジンのバイナリ自体を、同意を得たうえでダウンロードする機能が追加された。質問は一度だけ行い、`lib/design-detect-contract.ts` でチェックサムを固定し、失敗時は閉じる方向に倒して領収書を残す。スキルもフックもインストールしない)、それを使ってローカルのファイルをスキャンする。`/design-review`(差分に対してはソースモード、rendered-DOM ダンプを通じた URL に対しては DOM モード)、`/ship` の review-lite、`/review` の Design 専門家、`/design-html` のワンパスの slop ゲートは、`IMPECCABLE_READY` のときにこれを実行する。番兵の語彙: `lib/design-detect-contract.ts`。無効化スイッチ: `gstack-config set design_detector off`。
- **型付きカタログは 1 つ。** `lib/design-catalog.ts` が、ずれていた 4 つの slop リストを置き換えた。impeccable の 61 のルール ID のすべてが、gstack の文章、階層、影響度、信頼度、`/impeccable` への引き継ぎとともに対応付けられている。gstack だけの判断の兆候には括弧が付かない。`review/design-checklist.md` と `lib/dom-dump.js` は `lib/` から生成される。
- **ドクトリン。** Persuade / Operate / Read / Experience のモード、職人芸の下限の条件反射、「3 回見る」較正、役割ごとに範囲を絞った使い過ぎのリストを持つフォントの手順、Restrained / Committed / Full palette / Drenched のカラー戦略。
- **オープンな DESIGN.md 形式。** `lib/design-md.ts` と `bin/gstack-design-md.ts` は、google-labs-code/design.md 形式を読み、変換し、書き出す。変換の回答はファイルのマーカー行に保存される。gstack 自身の DESIGN.md も変換済み。
- **生成時のガード。** デザインバイナリの画像プロンプトには、カタログの 10 個の ID から組み立てた「Never:」の行が含まれる。
- **帰属表示。** `NOTICE.md` と `licenses/Apache-2.0.txt`。

## プラグイン検出のフォローアップ(2026-09-25)

検出器は、従来のスキルのインストールに加えて、`${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/cache/<marketplace>/<plugin>/<version>/skills/impeccable/` にある Claude Code のマーケットプレイスからのインストールも認識する。信頼できる絶対パスの `CLAUDE_CONFIG_DIR` は、両方のレイアウトについて、既定の Claude のユーザープロファイルを置き換える。相対パス、存在しない、ディレクトリでない、またはリポジトリに解決される上書きは無視される。`probe --verbose` が、フォールバックの理由を説明する。Claude の設定、プラグインのレジストリ、フックの構成は一切変更しない。

マーケットプレイス/プラグインごとに、検出は通常ファイルの `SKILL.md` を持つ、semver で最も新しいディレクトリを選ぶ。プレリリースの順序も含む。バージョンが同じ場合は、安定した同点決着のためにディレクトリ名を使う。ハッシュや `unknown` のディレクトリは、semver の候補の後に、名前の安定した順序でサポートされ続ける。それらの名前は新しさを証明しない。不完全なディレクトリはスキップされるが、エンジンのない新しく有効なスキルは、古いプラグインのエンジンを借用しない。ランチャー、同梱のエンジン、エンジンの `VERSION` は、選ばれたインストールに紐付いたままになる。プラグインのバージョン番号が、エンジンの互換性の証拠を置き換えることはない。

従来のユーザースキルのインストールは、プラグインの候補より優先される。明示的な `IMPECCABLE_BIN`、承認された PATH 上のバイナリ、スタンドアロンのエンジンキャッシュは、従来どおり高い優先度を保つ。スタンドアロンのエンジンキャッシュは、厳密な semver の順序を共有する。そのため、rc のディレクトリが安定版に勝つことはない。プラグインの検出とは異なり、不透明な名前は引き続き拒否する。複数のマーケットプレイス/プラグインは名前順に並べる。準備の整ったエンジンがあれば、インストールの提案は表示しない。エンジンがない場合は、既存の同意と never-ask の制御を維持する。`IMPECCABLE_SKILL: present` は依然として、ファイルがディスク上に見つかったことを意味するのであり、キャッシュされたプラグインが現在の Claude セッションで有効であることを意味しない。`IMPECCABLE_ENGINE_UNTESTED` は、取得済みのテストセットの外にあるエンジンについて、正直な警告として残る。

検出は、固定の深さの読み取り専用のファイルシステムの走査である。ランチャーの実行、プラグインのインストール、キャッシュの整理は行わず、任意のホームディレクトリを再帰的に検索することもしない。レビュー対象のプロジェクト内に解決されるパスは、シンボリックリンク経由のインストールを含め、実行可能な候補にはならない。キャッシュの走査はディレクトリのシンボリックリンクを飛ばし、設定ディレクトリの外に解決されるキャッシュを拒否する。リポジトリの設定リンクが、走査をプロジェクトの外へ誘導することはできない。ホームディレクトリの正規化された比較により、ホームディレクトリがエイリアス経由でアクセスされた場合でもユーザーのインストールを保持する。ただし、任意のホームのファイルをスキャン対象にすることは許さない。詳細表示では、拒否されたパスとファイルシステムのエラーを記録するが、番兵のプロトコルは壊さない。実行可能なランチャーのヒントは POSIX シェルの引用を使う。制御文字や Markdown を壊す名前、そして Windows には、コマンドではない案内を与える。エンジンの実行に使う生のパスは、サニタイズされた表示用のパスとは別に扱う。

リグレッションは `test/gstack-design-detect.test.ts` にある。`test/skill-e2e-design.test.ts` のプラグインからの引き継ぎのエージェントのケースは、明示的なエンジンの上書きなしで、検出から報告までの実際のパスを検証する。Windows のネイティブな実行ファイルの挙動と、macOS のパスのエイリアスの挙動には、それぞれのプラットフォームでの結果が必要である。Linux のフィクスチャの合格は、それらのネイティブな実行の証拠にはならない。

## CEO 計画(昇格版)

### CEO 計画: gstack のデザインスキルのための impeccable.style 相互運用
/plan-ceo-review により 2026-09-08 に生成
ブランチ: tehran-v1 | モード: SELECTIVE EXPANSION
リポジトリ: garrytan/gstack

## ビジョン

### 10 倍のチェック

市場にあるすべての AI デザインスキルは、文章による語彙であり、2 つの語彙を一緒に読み込むと打ち消し合う(impeccable 自身のドキュメントもそう述べている)。「impeccable を取り込む」の 10 倍の版は、5 つ目の語彙ではない。gstack がデザインのオーケストレーターになることである。gstack は、エコシステムが提供するすべての決定的なチェックを実行する(現在は、ユーザーがインストールしていれば impeccable の 61 ルールのエンジン)。共有のルール ID を gstack 自身の言葉で話す。Google Stitch と impeccable の両方が使うオープンな DESIGN.md の交換形式を読み書きする。そして、他にはない 3 つのものを保つ。ユーザーの実際のブラウザ(Aside)を通じた、公開サイトのデザイン監査。比較ボード付きの画像モックアップ。UI の 1 行を書く前の、計画段階でのデザインレビュー。

ユーザーが感じること: `/design-review` は、機械的な検出結果がすでに表示された状態で開始する。各結果には `[side-tab]` や `[nested-cards]` のタグが付いている。そして判断は、階層、信頼性、コピーに費やされる。`/design-consultation` は、impeccable、Stitch、そして将来のどのツールも翻訳なしで読める DESIGN.md を書く。モックアップのボードは、生成プロンプトが紫のグラデーションに手を伸ばさないよう指示されたため、それを表示しなくなる。そして、ユーザーが impeccable をインストールしている場合、保留された指摘はすべて、それを修正するコマンドで締めくくられる。

### プラトン的理想

実行せず(SELECTIVE EXPANSION モード)。

## スコープの判断

| # | 提案 | 工数 | 判断 | 理由 |
|---|----------|--------|----------|-----------|
| 1 | `design/src/brief.ts` の `briefToPrompt()` にある「Never:」の行。固定された `MOCKUP_NEVER_NAMES` のエクスポートから組み立てる(カタログの 10 個の ID を、平易な英語の名前にし、重複を除く) | S(人間で約 2 時間 / CC で約 10 分) | 採用 | 計画の中で最も安い勝ち筋。slop はモックアップの生成段階で止まる。プロンプトの文章のみ。`design/test/brief.test.ts` を追加(現在、brief のテストは存在しない) |
| 2 | rendered-DOM のダンプを通じた、ライブ URL に対する検出器(両方のエンジンで共有する 1 つのダンプスクリプト。Aside は `pwd` の下に書き込み、browse エンジンは一時ディレクトリの下に `$B eval --out --raw` で書き込む。bash が両方を `$REPORT_DIR/dom/` にコピーする)。静的エンジンでスキャンする。ラッパーは `${GSTACK_HOME:-$HOME/.gstack}/projects/*/designs/` を許可リストに含める | M(人間で約 1.5 日 / CC で約 40 分) | 採用 | ソースをスキャンすることと、design-review の規則 4(「ソースを決して読まない」)との緊張を解決する。デプロイされたサイトでも動作する。ラッパーのルートの確認、ダンプスクリプト、`$REPORT_DIR` のパスの修正が、実際の作業 |
| 3 | `design-baseline.json` の `detector: {mode, engine, total, byRule}`。`mode` が一致する場合、回帰モードは出現したもの、消えたもの、ルール ID を報告する。エンジンが異なる場合は `engine changed` の注記を付ける | S(人間で約 4 時間 / CC で約 15 分) | 採用 | 数値はすでに計算されている。実行をまたいでルール ID ごとに追跡する。`mode` のゲートとエンジンの注記により、ソースと DOM の違い、およびエンジンのアップグレードが、回帰と誤読されることを防ぐ |
| 4 | `$D check` における slop のルーブリック(GPT-4o のビジョン) | M(人間で約 2 日 / CC で約 40 分) | 保留 | バリアントごとに有料の呼び出し。ビジョンはクリーム色のパレットやネストされたカードを誤判定する。カタログの LLM 由来の兆候が実際に使われた後に再検討 |
| 5 | `overused-font` のヒットに対するテイストプロファイルの相互作用 | S(人間で約 4 時間 / CC で約 15 分) | 保留 | `.impeccable/config.json` の ignore-value が、2 つのスキーマを結合せずに、すでにこのケースをカバーしている |
| 6 | plan-ceo-review のセクション 11 にあるカタログの箇条書き | S | 保留 | plan-ceo-review のスケルトンには、約 555 B の切り出しの余裕がある。ドクトリンの切り出しの TODO の後に順序付ける |

実装アプローチの判断(D1): A(検出器のみ、5/10)と C(B に生成時の強制を加えたもの、10/10)よりも、レビュー済みの 13 コミットの計画である B を採用。C の無償の半分(提案 1)はチェリーピックとして採用し、有料の半分(提案 4)は保留。

配布: PR 1 本(2026-09-08 のユーザーの判断。レビューの 2 本の PR という提案を覆した)。コミットは二分割のまま。golden はコミット 4、7、9 で再生成。コミット 12 と 13 は一括。

## 採用されたスコープ(本計画に追加)

**1. 生成時の slop ガード(コミット 7b)。** `lib/design-catalog.ts` は、次の 10 個の ID にだけ `mockupNever: true` を設定する。`kicker-above-heading`、`icon-tile-stack`、`gradient-text`、`ai-color-palette`、`cream-palette`、`nested-cards`、`dark-glow`、`pulsing-dot`、そして gstack だけの `identical-cards` と `hero-metrics`。`MOCKUP_NEVER_NAMES: string[]` をエクスポートする(その `name` フィールド。重複を除き、平易な英語で、ID は含まない)。`design/src/brief.ts` の `briefToPrompt()` は、固定の末尾の前に `"Never: " + MOCKUP_NEVER_NAMES.join(", ") + "."` を追加する(出荷時は `Never by default (unless the brief above asks for it): …`)。import のパスは `../../lib/design-catalog`(前例: `design/src/receipted-fetch.ts` は `../../lib/egress-receipt` を import している。`scripts/build.sh` は相対的な TS をバイナリにバンドルする。`setup` はすでに `lib/` の mtime を再ビルドのトリガーとして扱っている)。`lib/design-catalog.ts` は `scripts/` から何も import しない。カタログの不変条件のテストは 10 個の ID をチェックする。新しい `design/test/brief.test.ts` は、「Never:」の行が存在し、固定の末尾より前にあり、`MOCKUP_NEVER_NAMES.length` 個の名前を列挙することをアサートする。バイナリは `./setup` で再ビルドする。`design/dist/` は決してコミットしない。

**2. rendered-DOM のダンプを通じた、ライブ URL に対する検出器(コミット 7)。**
- モードの規則: 対象が URL である場合(機能ブランチ上の明示的な `http://localhost:3000` を含む)は DOM モードとし、ソースのスキャンは行わない。URL のない差分を意識したモードでは、変更されたフロントエンドのディレクトリに対するソースモードになる。これは Phase 0 の文章に明記し、誰かが「親切に」ソースをスキャンしないようにする。
- フックの規則(出荷前に置き換え。Eng レビューの判断 35): `IMPECCABLE_HOOK: present` は、スキャンを決してスキップしない。文章はエージェントに対して、gstack の行を使い、フックの語彙は無視するよう指示する。DOM モードは、フックが描画されたページを見られないため、ダンプに対して常にスキャンする。フックによるスキップはソースモードに限定する。
- 1 つのダンプスクリプトを両方のエンジンで使う。リゾルバによって、フェンス付きの JS ブロックとしてレンダリングされる。アロー関数ではなく IIFE の式として書き、シングルクォート文字を含まない(出荷前に置き換え。スクリプトは `lib/dom-dump-script.ts` を参照)。理由: すべての `aside repl '...'` のスクリプトはシングルクォートの bash 文字列であり、`$B eval` は式をラップするため。スクリプトは次の処理を行う。`ownerNode` が `<link>` であるスタイルシートだけをシリアライズする(インラインの `<style>` ノードはマークアップにすでに含まれているため、同じものをシリアライズすると二重に数えてしまう)。オリジンが異なるシートは捕捉し、末尾の HTML コメントに未解決として列挙する。テキストを `<head>` 内に `<style data-gstack-dom-css>` として注入する。`document.documentElement.outerHTML` を返す。Aside: Phase 3 のページスクリプトがそれを評価し、`fs.writeFile(path.join(pwd, "{page}.dom.html"), html)` を行う(サンドボックスの `fs` は `pwd` の下にしか書き込めない)。`ASIDE_DIR=` を表示し、bash がそのファイルを `$REPORT_DIR/dom/` にコピーする。browse のフォールバック: `_TMP=$(mktemp -d)`、同じ JS を `$_TMP/dom-dump.js` に書き、`$B eval "$_TMP/dom-dump.js" --out "$_TMP/{page}.dom.html" --raw` を実行し(`--out` は一時ディレクトリまたはカレントディレクトリのみ受け付ける。`browse/src/path-security.ts:26`)、その後 `cp` で `$REPORT_DIR/dom/` へコピーする。`$B html` は使わない。読み取り系のコマンドは、stdout を信頼できないコンテンツのマーカーでラップするため(`browse/src/server.ts:1249-1255`)。その行は design-review 自身の DOM モードの文章にあり、`scripts/resolvers/design.ts` に置く。共有の `{{BROWSE_FALLBACK}}` のテーブルにはない(そのテーブルは 10 個のスキルにレンダリングされるため)。同じスクリプト、両方のエンジンで同じシリアライズ。ただし、ページの内容はセッションによって異なる可能性がある。`{page}` は Phase 3 のスクリーンショットがすでに使っているスラッグを再利用する。DOM モードでは、指摘の `file:line` は `{page}.dom.html` を指す。エージェントは、レンダリングされたページで要素を確認する(規則 4)。ソースの行を探し回ることは決してしない。
- `design-review/SKILL.md.tmpl:95` の `$REPORT_DIR` を `$HOME/.gstack/...` から `${GSTACK_HOME:-$HOME/.gstack}/...` に変更する(`bin/gstack-slug` がすでにそうしている)。これにより、`GSTACK_HOME` が設定されているときに、許可リストとレポートのディレクトリが一致する。tmpl:119 の出力構造のツリーと、`design.ts:419` の `mkdir` は、`~/.gstack` の省略形のままにする。どちらも許可リストには関係しない。
- 順序: DOM モードでは、スキャンは最後の Phase 3 のページスクリプトがダンプを生成した後に、一度だけ実行する。ソースモードでは、スキャンはセットアップで実行する。Phase 9 は再計算する(DOM モードでは、影響を受けたページをリロード後に再ダンプして再スキャンし、ソースモードでは、変更されたファイルを再スキャンする)。Phase 10 は `Detector: N → M` を報告する。
- スキャン: `gstack-design-detect.ts scan --format gstack "$REPORT_DIR/dom"`。ラッパーのターゲットの検証は、リポジトリのルートの下のパス、または `${GSTACK_HOME:-$HOME/.gstack}/projects/*/designs/` の下のパスを受け付ける(明示的な許可リスト。designs のパスが受け入れられ、designs ではない兄弟のパスが拒否されることをテストする)。報告の行は一度だけ: 「rendered DOM の静的スキャン。オリジンが異なる CSS は解決しない」。
- 中核となる前提(impeccable の静的エンジンは、`.html` ファイル内のインラインの `<style>` を読む)は、コミット 1 で固定する。コミット 13 ではない。フィクスチャのセットには `review-eval-design-slop.html` を含み、それをローカルで配信し、`$B eval dom-dump.js --out --raw` でダンプし、スキャンする。DOM モードはコミット 7 で、このフィクスチャの上に出荷する。

**3. 回帰のベースラインにおける検出器の件数(コミット 7)。** `design-baseline.json` のテンプレートと回帰の文章は、スキルのテンプレートではなく `scripts/resolvers/design.ts`(DESIGN_METHODOLOGY の Phase 6、JSON ブロック、「Regression Output」)にある。そちらを編集する。フィールド: `detector: { mode: "dom"|"source", engine, total, byRule: {id: n} }`。`engine` は、READY のパスが `~/.impeccable/bin/<version>/` のキャッシュである場合はそこから解析したバージョン、または隣接する `VERSION` ファイルから得た値とし、それ以外は、バイナリの `sha256:<12 桁の 16 進数>`(出荷前に置き換え。ファイルシステムのパスは決して使わない)。フィクスチャが示す場合は、`detect --json` の出力に含まれるバージョンのフィールドが優先される。前回のベースライン = 今日の `$REPORT_DIR` より古い、最新の `${GSTACK_HOME:-$HOME/.gstack}/projects/$SLUG/designs/design-audit-*/design-baseline.json`(同じ日に 2 回目の実行をすると、今日のベースラインは上書きされ、直前の日のものと比較する。これは意図した動作)。差分は `mode` が一致する場合にのみ計算する。そうでない場合は「detector modes differ (dom vs source), no delta」と言う。`engine` が異なる場合は、`engine changed X → Y; rule set may differ` という注記とともに差分を表示する。フィールドがない場合は「no detector baseline (first scan)」と表示し、決して `+N` とはしない。出力: 出現した ID、消えた ID、合計、散文の中の 1 行の例(`+ kicker-above-heading (2)  - gradient-text (1)  total 14 → 9`)。既知の制限として明記する: ライブの DOM のダンプは揺れる(広告、タイムスタンプ、A/B テスト)ため、件数の差分は参考程度であり、ID の出現/消滅がシグナルである。

## TODOS.md に保留

- `$D check` の slop ルーブリック(P3、M): カタログの LLM のみの兆候の項目がレビューで実際に使われた後に、それを `design/src/check.ts` に追加する。バリアントごとのコストとビジョンの誤検出が未解決の問題。
- テイストプロファイルの相互作用(P3、S): 値がユーザーの承認済みのテイストプロファイルにある場合、検出器の `overused-font` のヒットを polish に格下げする。現在は `impeccable hooks ignore-value` がそれをカバーしている。
- plan-ceo-review のセクション 11 のカタログの箇条書き(P3、S): plan-ceo-review のドクトリンの切り出し(TODOS.md の 1100 行目付近)でブロックされている。

## レビュアーの懸念

敵対的なレビューを 3 ラウンド実施(スコアは 10 点満点で 6 → 8 → 7。26 件の指摘、26 件を修正)。3 ラウンド目の 9 件の修正は最後のラウンドの後に適用されたため、レビューされていない。内容: browse のフォールバックのための一時ディレクトリへの `--out` と、その後の `cp`。フックによるスキップはソースモードに限定。`<link>` のみのスタイルシートのインライン化。diff のルールにおける `engine changed` の注記。`$B eval` の行を共有のフォールバックのテーブルから除外。共有スクリプトに対する IIFE / シングルクォートなしの制約。コミット 1 で取得した DOM ダンプのフィクスチャ。Phase 9 が計算し、Phase 10 が報告。文言(セッションに依存するダンプ、前日のベースライン、`{page}` のプレースホルダー、brief のテストが `MOCKUP_NEVER_NAMES.length` をアサート)。レビュアーが挙げ、本計画が受け入れた残存リスク: design-review の積極的な予算は、コミット 7 でフィクスチャの更新が必要になる(想定どおりであり、条件付きではない)。
