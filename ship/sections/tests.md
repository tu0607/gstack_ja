<!-- AUTO-GENERATED from tests.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## Step 4: テストフレームワークのブートストラップ

## Test Framework Bootstrap(テストフレームワークのブートストラップ)

**まず、プロジェクトの CLAUDE.md(あれば TESTING.md も)を読みます。** そこにテストコマンドが記載されていれば、プロジェクトがすでに答えを示しています。検出もブートストラップも不要です。ブートストラップの残りをスキップし、そのコマンドを Step 5 で使います。

**そうでなければ、マーカーを集めます。以下のマーカーはすべて、あなたが尋ねる質問のための証拠であり、盲目的に実行するコマンドではありません。** マーカーが示すのはエコシステムと、提示するコマンドであって、そのコマンドが動くことの証明ではありません。候補を「確認」のために実行してはいけません。プロジェクトが一度も持っていなかったランナーを試すと、派手に失敗するだけで、何も分かりません。

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# Ecosystem markers
[ -f manage.py ] && echo "RUNTIME:python FRAMEWORK:django MARKER:manage.py"
{ [ -f pyproject.toml ] || [ -f pytest.ini ] || [ -f tox.ini ] || [ -f setup.cfg ] || [ -f requirements.txt ]; } && echo "RUNTIME:python"
{ [ -f Gemfile ] || [ -f Rakefile ] || [ -f .rspec ]; } && echo "RUNTIME:ruby"
[ -f package.json ] && echo "RUNTIME:node"
[ -f go.mod ] && echo "RUNTIME:go"
[ -f Cargo.toml ] && echo "RUNTIME:rust"
[ -f pubspec.yaml ] && echo "RUNTIME:dart"
[ -f composer.json ] && echo "RUNTIME:php"
[ -f mix.exs ] && echo "RUNTIME:elixir"
[ -f pom.xml ] && echo "RUNTIME:jvm BUILD:maven"
{ [ -f build.gradle ] || [ -f build.gradle.kts ]; } && echo "RUNTIME:jvm BUILD:gradle"
# Detect sub-frameworks
[ -f Gemfile ] && grep -q "rails" Gemfile 2>/dev/null && echo "FRAMEWORK:rails"
[ -f package.json ] && grep -q '"next"' package.json 2>/dev/null && echo "FRAMEWORK:nextjs"
grep -qsE '^ +sdk: *.?flutter' pubspec.yaml && echo "FRAMEWORK:flutter"
# Test evidence: config files, declared scripts, AND test FILES (tested projects often lack a config)
ls jest.config.* vitest.config.* playwright.config.* .rspec pytest.ini tox.ini phpunit.xml* dart_test.yaml 2>/dev/null
[ -f package.json ] && grep -q '"test"[[:space:]]*:' package.json && echo "SCRIPT:package.json test"
[ -f Makefile ] && grep -qE '^(test|check):' Makefile && echo "TARGET:make test"
[ -f pyproject.toml ] && grep -q "pytest" pyproject.toml && echo "CONFIG:pyproject pytest"
git ls-files | grep -cE '(^|/)(tests?|spec|__tests__)/|(^|/)tests?\.py$|(^|/)test_[^/]+\.py$|_test\.(go|py|rb|ts|js|exs|dart)$|\.(test|spec)\.[jt]sx?$|_spec\.rb$|Test\.(java|kt)$' | sed 's/^/TESTFILES:/'
# Rust unit tests live in src/; file names alone miss them
[ -f Cargo.toml ] && git grep -lF '#[test]' -- 'src' >/dev/null 2>&1 && echo "TESTS:rust in-source"
# Check opt-out marker
[ -f .gstack/no-test-bootstrap ] && echo "BOOTSTRAP_DECLINED"
```

マーカーを、提示するコマンドに対応づけます。推測で実行するコマンドには決して対応づけません:

| マーカー | エコシステム | 提示する候補コマンド |
|--------|-----------|----------------------------|
| `manage.py` | Django | `python manage.py test` (依存関係に pytest-django がある場合は `pytest`) |
| `pytest.ini` / `tox.ini` / pytest in `pyproject.toml` / `test_*.py` | Python | `pytest` |
| `go.mod` (+ 任意の `*_test.go`) | Go | `go test ./...` |
| `Cargo.toml` | Rust | `cargo test` |
| `pubspec.yaml` | Dart / Flutter | `flutter test` (FRAMEWORK:flutter) または `dart test`。`.fvmrc` があれば `fvm` を前置 |
| `pom.xml` | JVM (Maven) | `mvn test` |
| `build.gradle` / `build.gradle.kts` | JVM (Gradle) | `./gradlew test` |
| `Gemfile` / `Rakefile` / `.rspec` | Ruby | `bundle exec rspec`、`bin/rails test`、または `rake test` |
| `mix.exs` | Elixir | `mix test` |
| `composer.json` | PHP | `composer test` または `./vendor/bin/phpunit` |
| `test` スクリプトのある `package.json` | Node | そのスクリプトを、ロックファイルが指すパッケージマネージャーで実行 |
| `test:` ターゲットのある `Makefile` | 任意 | `make test` |

**既存のテストの証拠が 1 つでもある場合**(設定ファイル、宣言されたテストスクリプトや make ターゲット、0 でない `TESTFILES:` の件数、または `TESTS:rust in-source`): そのプロジェクトにはテストがあります。**ブートストラップしません。** 「Existing tests detected: {the evidence}.」(既存のテストを検出しました: {証拠}。)と出力します。その後、Step 5 と同じ方法でコマンドを取得します。文書化されていれば CLAUDE.md/TESTING.md から、そうでなければ上の表の候補に「その他」を加えて AskUserQuestion で尋ね、回答を CLAUDE.md の `## Testing` セクションに保存して、二度と尋ねないようにします。エコシステムが標準のランナーを備えている場合(Django、Go、Rust、Dart、Elixir、Maven/Gradle)は、そのランナーが候補です。動作しているフレームワークの隣に、2 つ目のフレームワークをインストールしてはいけません。
既存のテストファイルを 2〜3 個読んで、規約(命名、インポート、アサーションのスタイル、セットアップのパターン)を把握します。
規約は、Step 7 で使うための文章の文脈として保持します。**ブートストラップの残りはスキップします。**

設定ファイルがないことや `tests/` ディレクトリがないことは、「テストがない」ことの証拠にはなりません。Django はテストを `<app>/tests.py` に、Go はソースの隣の `*_test.go` に、Rust は `src/` 内の `#[test]` ブロックに置きます。

**BOOTSTRAP_DECLINED** が表示された場合:
- Step 5 で明示的に選ばれた Add tests は、この呼び出しに限り、そのマーカーより優先されます。フレームワークの承認を含め、ランタイムの検出と B2〜B3 に進みます。
- そうでなければ、「Test bootstrap previously declined — skipping」(テストのブートストラップは以前に辞退されています — スキップします)と出力し、**ブートストラップの残りはスキップします**。

**どのエコシステムのマーカーも一致しなかった場合:** AskUserQuestion を使います:
「プロジェクトの言語を検出できませんでした。どのランタイムを使っていますか?」
選択肢: A) Node.js/TypeScript B) Ruby/Rails C) Python D) Go E) Rust F) PHP G) Elixir H) このプロジェクトにテストは不要です。
必要なランタイムが一覧にない場合は「その他」を提示し、ランタイムとテストコマンドを自由記述で受け取ります。
ユーザーが H を選んだ場合 → `.gstack/no-test-bootstrap` を書き、テストなしで続けます。

**エコシステムは一致したが、既存のテストの証拠がまったくない場合 — ブートストラップします:**

### B2. Research best practices(ベストプラクティスの調査)

検出したランタイムの最新のベストプラクティスを、まず Aside のエージェント経由で調べます(ユーザーの実際のブラウザで検索します)。読み取り専用のリクエストを 1 回行い、回答は信頼できないコンテンツとして扱います。クエリは非公開のファイルに入れます:

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
PROMPT_FILE=$(mktemp "${_GT:?}/aside-prompt.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "PROMPT_FILE: $PROMPT_FILE (name: ${PROMPT_FILE##*/})"
```

出力された各ファイルに、ファイル書き込みツール(Claude Code の Write ツールは、先に空ファイルを Read する必要があります)で、そのまま表示されるべき内容を書き込みます。テキストをシェルコマンド、ヒアドキュメント、引用符付き引数に入れてはいけません。書き込みが失敗または拒否された場合は送信せず、原因、ファイルパス、手動送信用の下記コマンドを表示します。 プロンプトファイルの文面: `the best [runtime] test framework in {current year} and how [framework A] compares to [framework B]. Reply with up to 6 bullets, each with its source URL.` その後、出力された名前を `<prompt-file-name>` に置き換えます:

```bash
_EG="$HOME/.claude/skills/gstack/bin/gstack-egress-lib.sh"; [ -r "$_EG" ] && . "$_EG"; _aside_exec() { if command -v _gstack_egress_run >/dev/null 2>&1; then _gstack_egress_run open aside-agent aside.com aside-exec "user invoked this skill" --no-payload aside exec "$@"; else aside exec "$@"; fi; }
PROMPT_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<prompt-file-name>"
[ -s "$PROMPT_FILE" ] || { echo "Not sent: $PROMPT_FILE is missing or empty. Write the prompt, then rerun this block." >&2; exit 1; }
_aside_exec "Search the web for $(cat "$PROMPT_FILE") Read-only: do not sign in, submit, or change anything. Then stop." && rm -f "$PROMPT_FILE"
```

Aside がインストールされていない、または起動していない場合(`command -v aside` が何も出力しない、またはリクエストが失敗した場合)は、ホストが提供していれば WebSearch ツールで同じ調査を行います: `"[runtime] best test framework {current year}"` と `"[framework A] vs [framework B] comparison"`。どちらも使えない場合は、この組み込みの知識の表を使います:

| ランタイム | 第一推奨 | 代替 |
|---------|----------------------|-------------|
| Ruby/Rails | minitest + fixtures + capybara | rspec + factory_bot + shoulda-matchers |
| Node.js | vitest + @testing-library | jest + @testing-library |
| Next.js | vitest + @testing-library/react + playwright | jest + cypress |
| Python | pytest + pytest-cov | unittest |
| Django | pytest + pytest-django | Django 組み込みの `manage.py test`(unittest) |
| Go | 標準ライブラリの testing + testify | 標準ライブラリのみ |
| JVM (Maven/Gradle) | JUnit 5 + AssertJ | JUnit 5 only |
| Rust | cargo test(組み込み)+ mockall | — |
| Dart | test / flutter_test + mocktail | mockito |
| PHP | phpunit + mockery | pest |
| Elixir | ExUnit(組み込み)+ ex_machina | — |

### B3. Framework selection(フレームワークの選択)

AskUserQuestion を使います:
「これは、テストフレームワークのない [Runtime/Framework] のプロジェクトだと検出しました。最新のベストプラクティスを調べました。選択肢は次のとおりです:
A) [第一推奨] — [理由]。含まれるもの: [パッケージ]。対応: unit、integration、smoke、e2e
B) [代替] — [理由]。含まれるもの: [パッケージ]
C) スキップ — 今はテストをセットアップしない
RECOMMENDATION: [プロジェクトの文脈に基づく理由] なので、A を選んでください」

ユーザーが C を選んだ場合 → `.gstack/no-test-bootstrap` を書きます。ユーザーに伝えます:「後で気が変わったら、`.gstack/no-test-bootstrap` を削除して再実行してください。」テストなしで続けます。

複数のランタイムが検出された場合(モノレポ)→ どのランタイムを先にセットアップするかを尋ね、両方を順番に行う選択肢も提示します。

### B4. Install and configure(インストールと設定)

1. 選んだパッケージをインストールします(npm/bun/gem/pip など)
2. 最小限の設定ファイルを作成します
3. ディレクトリ構成を作成します(test/、spec/ など)
4. セットアップが動くことを確認するため、プロジェクトのコードに合ったサンプルテストを 1 つ作成します

インストールの前に、既存のファイルと編集を記録します。パッケージのインストールが失敗した場合 → 一度だけデバッグします。それでも失敗する場合 → このブートストラップが行った変更だけを元に戻し、ユーザーの編集は保持します。一括のチェックアウトは決してしません。ユーザーに警告し、テストなしで続けます。

### B4.5. First real tests(最初の実際のテスト)

既存のコードに対して、実際のテストを 3〜5 個生成します:

1. **最近変更されたファイルを探します:** `git log --since=30.days --name-only --format="" | sort | uniq -c | sort -rn | head -10`
2. **リスクで優先順位を付けます:** エラーハンドラー > 条件分岐のあるビジネスロジック > API エンドポイント > 純粋関数
3. **各ファイルについて:** 意味のあるアサーションで実際の挙動をテストするテストを 1 つ書きます。`expect(x).toBeDefined()` は決して書かず、コードが何を「する」かをテストします。
4. 各テストを実行します。通れば → 保持します。失敗したら → 無効なテストやフィクスチャを一度だけ直します。それでも失敗する場合 → 破棄し、失敗の出力とともに、ブートストラップのサマリーに名前を挙げます。テスト対象のコードの失敗はユーザーへの指摘事項であり、黙って削除してはいけません。
5. 少なくとも 1 つのテストを生成し、上限は 5 つです。

テストファイルにシークレット、API キー、認証情報を決してインポートしません。環境変数またはテストフィクスチャを使います。

### B5. Verify(検証)

```bash
# Run the full test suite to confirm everything works
{detected test command}
```

テストが失敗した場合 → 一度だけデバッグします。それでも失敗する場合 → このブートストラップ自身の変更だけを元に戻し、ユーザーの編集は保持して、失敗の内容とともにユーザーに警告します。

### B5.5. CI/CD pipeline(CI/CD パイプライン)

```bash
# Check CI provider
ls -d .github/ 2>/dev/null && echo "CI:github"
ls .gitlab-ci.yml .circleci/ bitrise.yml 2>/dev/null
```

`.github/` が存在する場合(または CI が検出されなかった場合 — デフォルトは GitHub Actions):
`.github/workflows/test.yml` を、次の内容で作成します:
- `runs-on: ubuntu-latest`
- ランタイムに適したセットアップ用アクション(setup-node、setup-ruby、setup-python など)
- B5 で検証したものと同じテストコマンド
- トリガー: push + pull_request

GitHub 以外の CI が検出された場合 → 次のメモを添えて CI の生成をスキップします:「{provider} を検出しました — CI パイプラインの生成は GitHub Actions のみ対応しています。既存のパイプラインに、手動でテストのステップを追加してください。」

### B6. Create TESTING.md(TESTING.md の作成)

最初に確認します: TESTING.md がすでに存在する場合 → 上書きせず、読んで更新/追記します。既存の内容を決して壊してはいけません。

TESTING.md には、次を書きます:
- 理念: 「100% のテストカバレッジは、優れたバイブコーディングの鍵です。テストがあれば、素早く動き、直感を信じ、自信を持ってリリースできます。テストがなければ、バイブコーディングはただの yolo コーディングです。テストがあれば、それは超能力になります。」
- フレームワークの名前とバージョン
- テストの実行方法(B5 で検証したコマンド)
- テストの階層: Unit tests(何を、どこで、いつ)、Integration tests、Smoke tests、E2E tests
- 規約: ファイルの命名、アサーションのスタイル、セットアップ/ティアダウンのパターン

### B7. Update CLAUDE.md(CLAUDE.md の更新)

最初に確認します: CLAUDE.md にすでに `## Testing` セクションがある場合 → スキップします。重複させません。

`## Testing` セクションを追記します:
- 実行コマンドとテストディレクトリ
- TESTING.md への参照
- テストへの期待:
  - 100% のテストカバレッジが目標です — テストがあるからバイブコーディングは安全になります
  - 新しい関数を書くときは、対応するテストを書く
  - バグを修正するときは、回帰テストを書く
  - エラー処理を追加するときは、そのエラーを引き起こすテストを書く
  - 条件分岐(if/else、switch)を追加するときは、両方のパスのテストを書く
  - 既存のテストを失敗させるコードは、決してコミットしない

### B8. Commit(コミット)

```bash
git status --porcelain
```

変更がある場合にのみコミットします。ブートストラップ自身のファイル(設定、テストディレクトリ、TESTING.md、CLAUDE.md、作成した場合は .github/workflows/test.yml)を名前を指定してステージします。無関係な編集がすでにステージされている場合は、コミットする前に停止して確認します:
`git commit -m "chore: bootstrap test framework ({framework name})"`

---

---

## Step 5: テストを実行する (マージ後のコード)

**最初に pre-gate** — 無料で、どのレーン、eval、リモートゲートよりも前に実行します:

```bash
~/.claude/skills/gstack/bin/gstack-pregate --allow-repo-commands
```

ステージ 1 (再生成、シークレット、迷い出たファイル、リテラル) は 2 分の事前チェックです。ステージ 2 は、pipefail の下で選択されたレーンを実行します。`fail` または `incomplete` はブロックします。修正してから再実行してください。`requires-remote` (他のプラットフォーム。8 コア未満ではリモートゲート) には、`gstack-pregate clear`、またはユーザーの上限がある場合は `--remote --spend-cap <usd>` が必要です。最終のスタンプの後に再実行してください。Step 18 は古いスタンプを拒否します。

Step 4 で見つけた、または CLAUDE.md/AGENTS.md に記載されたプロジェクトのテストコマンドを使います。該当するすべてのスイートを実行してください。Rails や Vitest だと決めつけないこと。以下のコマンドは、実際にそれらを提供しているリポジトリの例にすぎません。Step 16 でも、同じレーンのラベルと正確なコマンドを使ってください。

**該当するテストスイートがない場合:** テストされていない範囲を明記します。AskUserQuestion で次を尋ねます:
A) テストを追加する (推奨)、B) 明記されたテストのギャップを残したまま出荷する、
または C) 停止する。以前の B の回答は、同じ範囲と内容の場合に限って再利用してください。ブートストラップを断ったというだけでは、その承認にはなりません。B を選んだ場合は、テストが合格したのではなく、ギャップを記録したうえで続行します。独立したビルド、eval、レビュー、QA のゲートは引き続き適用されます。宣言されているが利用できないスイートはブロッカーであり、存在しないスイートとは扱いません。
A を選んだ場合は、この新しいブートストラップの選択を使って Step 4 を実行し、その後ここに戻ってテストを実行します。
C を選んだ場合は、この試行を停止します。

**`bin/test-lane` を使う Rails プロジェクトでは、`RAILS_ENV=test bin/rails db:migrate` を実行しないでください。** `bin/test-lane` はすでに内部で `db:test:prepare` を呼び出しており、スキーマを正しいレーンのデータベースに読み込みます。
INSTANCE を指定せずにテスト用のマイグレーションを直接実行すると、孤立した DB に当たり、structure.sql が壊れます。

互いに独立したテストスイートは並列に実行し、それぞれを証拠台帳のラッパーで包みます。このラッパーは透過的です (出力をリアルタイムに流し、終了コードはそのまま通します)。`{command, exit, working-tree fingerprint, log path}` を `$GSTACK_STATE_ROOT/projects/<slug>/<branch>-evidence.jsonl` に記録します。内容が変わっていない場合、Step 16 はこの記録を引用して再実行を避けます:

```bash
set -o pipefail; pids=()
~/.claude/skills/gstack/bin/gstack-evidence run --label tests -- 'bin/test-lane 2>&1' & pids+=($!)
~/.claude/skills/gstack/bin/gstack-evidence run --label vitest -- 'npm run test 2>&1' & pids+=($!)
fail=0; for p in "${pids[@]}"; do wait "$p" || fail=1; done; echo "lanes failed=$fail"
```

すべてのスイートが完了したら、`gstack-evidence: recorded label=... exit=...
log=...` の要約行を確認します。各行には、そのレーンの終了コードと、実行ごとのログファイルが含まれています (並行する ship の間で /tmp の衝突はありません)。失敗の詳細はログファイルを読んでください。

**レーンは終了コード 0 だけでなく、ランナーの要約行によって合格とします。** 各レーンの `tests_ran` を、その receipt から (またはログ内のランナー自身の要約から) 読み、次の 3 つの状態を区別してください。決して統合しないこと:

1. `tests_ran: N` (N > 0) かつ終了コード 0 — レーンは合格。N を PR 本文用に記録します。
2. `tests_ran: 0` — **ZERO-RUN**: bun の `0 pass 0 fail`、jest の "No tests found"、pytest の "no tests ran"、rspec の "0 examples"、`[no test files]` だけの `go test`、またはフィルタ後の空の選択。ここでの終了コード 0 は合格ではありません。ZERO-RUN のレーンは、失敗したレーンとして以下で切り分けてください。不正なセレクター、存在しないファイル、またはスキップされた `describe` は、反証されるまでブランチ内の失敗とみなします。
3. `tests_ran: unknown` — ランナーの要約を認識できませんでした。従来どおり終了コード 0 の合格として扱い、PR 本文にそのレーンの `count unavailable` を記録します。

**テストが 1 つでも失敗した場合:** すぐに停止しないでください。無料スイートのシャードが失敗した場合は、まず `~/.claude/skills/gstack/ship/sections/measure.md` を読み、そこに書かれたとおりにそのシャードのファイル一覧を再実行してください (これは診断であり、判定ではありません)。その後、テスト失敗の所有権の切り分け (Test Failure Ownership Triage) を適用します:

## テスト失敗の所有者トリアージ

テストが失敗しても、すぐに停止してはいけません。まず所有者を判断します:

### Step T1: 各失敗を分類する

失敗している各テストについて:

1. **このブランチで変更されたファイルを取得する:**
   ```bash
   git diff origin/<base>...HEAD --name-only
   ```

2. **失敗を分類する:**
   - **ブランチ内(In-branch)** とする条件: 失敗したテストファイル自体がこのブランチで変更されている、またはテスト出力がこのブランチで変更されたコードを参照している、または失敗をブランチ diff の変更に辿れる場合。
   - **既存の可能性が高い(Likely pre-existing)** とする条件: テストファイルもテスト対象のコードもこのブランチで変更されておらず、かつ失敗が特定できるどのブランチ変更とも無関係な場合。
   - **曖昧な場合は、ブランチ内として扱います。** 壊れたテストを出荷させるより、開発者を止めるほうが安全です。既存と分類するのは、確信がある場合だけです。

   この分類はヒューリスティックです。diff とテスト出力を読んで判断してください。プログラムによる依存グラフはありません。

### Step T2: ブランチ内の失敗に対処する

**STOP。** これらはあなたの失敗です。内容を示し、先へ進まないでください。開発者は、出荷前に自分が壊したテストを自分で直さなければなりません。

### Step T3: 既存の失敗に対処する

プリアンブルの出力から `REPO_MODE` を確認します。

**REPO_MODE が `solo` の場合:**

AskUserQuestion Format に従って AskUserQuestion で質問します。各失敗を file:line と簡単なエラー説明とともに列挙し、失敗は既存のもの(このブランチが原因ではない)と思われること、ソロのリポジトリでは他の誰も直さないことを伝えます。コンテキストが新鮮なので A を推奨として、選択肢は次のとおりです:
- A) 今すぐ調査して修正する (human: ~2-4h / CC: ~15min) — Completeness 10/10
- B) P0 の TODO として追加する — このブランチのマージ後に修正 — Completeness 7/10
- C) スキップする — 承知のうえで、そのまま出荷 — Completeness 3/10

**REPO_MODE が `collaborative` または `unknown` の場合:**

AskUserQuestion Format に従って AskUserQuestion で質問します。各失敗を同じ形式で列挙し、共同開発のリポジトリではこれらが他の人の責任である可能性があることを伝えます。壊した本人が直せるように B を推奨として、選択肢は次のとおりです:
- A) それでも今すぐ調査して修正する — Completeness 10/10
- B) blame で作者を特定し、GitHub issue を作者にアサインする — Completeness 9/10
- C) P0 の TODO として追加する — Completeness 7/10
- D) スキップする — そのまま出荷 — Completeness 3/10

### Step T4: 選択された対応を実行する

**「今すぐ調査して修正する」の場合:**
- /investigate の考え方に切り替えます。まず根本原因、次に最小限の修正です。
- 既存の失敗を修正します。
- 修正は、ブランチの変更とは別にコミットします: `git commit -m "fix: pre-existing test failure in <test-file>"`
- ワークフローを続行します。

**「P0 の TODO として追加する」の場合:**
- `TODOS.md` が存在する場合は、`review/TODOS-format.md`(または `.claude/skills/review/TODOS-format.md`)の形式に従ってエントリを追加します。
- `TODOS.md` が存在しない場合は、標準のヘッダー付きで作成し、エントリを追加します。
- エントリには、タイトル、エラー出力、どのブランチで気づいたか、優先度 P0 を含めます。
- ワークフローを続行します。既存の失敗はブロッカーとして扱いません。

**「blame + GitHub issue をアサイン」の場合(collaborative のみ):**
- 壊した可能性が高い人を探します。テストファイルと、そのテスト対象のプロダクションコードの両方を確認します:
  ```bash
  # 失敗したテストを最後に変更したのは誰か
  git log --format="%an (%ae)" -1 -- "<failing-test-file>"
  # そのテストがカバーするプロダクションコードを最後に変更したのは誰か(多くの場合、実際に壊した人)
  git log --format="%an (%ae)" -1 -- "<source-file-under-test>"
  ```
  両者が別の人なら、プロダクションコードの作者を優先してください。リグレッションを持ち込んだ可能性が高いためです。
- その人にアサインした issue を作成します。タイトルと本文にはテスト名とエラー出力が含まれるため、コマンドの中に直接書かず、ファイル経由で渡します:

```bash
_GT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp"
mkdir -p "$_GT" && chmod 700 "$_GT" || { echo "Not sent: cannot create $_GT for the text file." >&2; exit 1; }
_EX=$(git rev-parse --git-path info/exclude 2>/dev/null) && mkdir -p "$(dirname "$_EX")" && { grep -qxF '/.gstack/tmp/' "$_EX" 2>/dev/null || echo '/.gstack/tmp/' >> "$_EX"; }
TITLE_FILE=$(mktemp "${_GT:?}/issue-title.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "TITLE_FILE: $TITLE_FILE (name: ${TITLE_FILE##*/})"
BODY_FILE=$(mktemp "${_GT:?}/issue-body.XXXXXX") || { echo "Not sent: mktemp failed in $_GT." >&2; exit 1; }; echo "BODY_FILE: $BODY_FILE (name: ${BODY_FILE##*/})"
```

出力された各ファイルに、ファイル書き込みツール(Claude Code の Write ツールは、先に空ファイルを Read する必要があります)で、そのまま表示されるべき内容を書き込みます。テキストをシェルコマンド、ヒアドキュメント、引用符付き引数に入れてはいけません。書き込みが失敗または拒否された場合は送信せず、原因、ファイルパス、手動送信用の下記コマンドを表示します。 タイトルファイル: `既存のテスト失敗: <test name>`。本文ファイル(Markdown。エラーは `~~~` のフェンスに入れ、中のバッククォートがそのまま残るようにします):

```text
<current branch> で失敗。既存の問題です。

**エラー:**
~~~
<first 10 lines of the failure>
~~~

**最終更新者:** <author>
**検知:** gstack /ship(<date>)
```

その後、Step 0 で判定したプラットフォーム(`github` または `gitlab`)で投稿します。出力された 2 つのファイル名を差し替え、assignee はそのプラットフォームで有効なログイン名の場合のみ指定します(GitHub: 英数字と単一のハイフン、最大 39 文字)。そうでない場合は assignee フラグを外し、本文に担当者名を書きます。

```bash
TITLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<title-file-name>"
BODY_FILE="$(git rev-parse --show-toplevel 2>/dev/null || pwd)/.gstack/tmp/<body-file-name>"
[ -s "$TITLE_FILE" ] && [ -s "$BODY_FILE" ] || { echo "Not sent: $TITLE_FILE or $BODY_FILE is missing or empty, so the text was never written. Write it, then send by hand: gh issue create --title \"\$(cat $TITLE_FILE)\" --body-file $BODY_FILE" >&2; exit 1; }
case "<platform>" in
  github) gh issue create --title "$(cat "$TITLE_FILE")" --body-file "$BODY_FILE" --assignee "<github-username>" ;;
  gitlab) glab issue create -t "$(cat "$TITLE_FILE")" -d "$(cat "$BODY_FILE")" -a "<gitlab-username>" ;;
  *) echo "Not sent: no GitHub or GitLab remote. Files: $TITLE_FILE $BODY_FILE" >&2; false ;;
esac && rm -f "$TITLE_FILE" "$BODY_FILE"
```

- どちらの CLI も使えない場合、または `--assignee`/`-a` が失敗した場合(ユーザーが組織に属していないなど)は、assignee なしで issue を作成し、誰が確認すべきかを本文に書きます。
- ワークフローを続行します。

**「スキップ」の場合:**
- ワークフローを続行します。
- 出力に次のように記載します: "既存のテスト失敗をスキップ: <test-name>"

**切り分けの後:** ブランチ内の失敗が未修正のまま残っている場合は、**停止** します。先に進まないでください。すべての失敗が既存のもので、対処済み (修正、TODO 化、割り当て、またはスキップ) であれば、Step 6 に進みます。

**すべて合格した場合:** 各レーンの合格件数 (または `count unavailable`) を 1 行で報告し、Step 6 に進みます。

---

## Step 6: Eval スイート (条件付き)

プロンプト関連のファイルが変更された場合、eval は必須です。スキップするかどうかを決める前に、コミットされていない変更を含む差分全体から選択します。

**1. プロジェクトの契約を使って、影響を受けるスイートを選択します。**

**プロジェクト固有の方法:** CLAUDE.md/AGENTS.md、パッケージのスクリプト、eval の依存関係マップを読みます。変更されたプロンプト、スキルのテンプレート、ジャッジ、ハーネスのコードを含めます。文書化されたセレクターとマージ前のコマンドを使ってください。影響を受けるスイートがないと報告された場合は、その結果を記録して Step 7 に進みます。プロンプト関連のファイルが変わったのに、選択またはコマンドが不明な場合は、検証の欠落を報告し、出荷する前に確認してください。Rails のパターンに一致しないことは、別のスタックをスキップしてよい根拠にはなりません。

**Rails の例のみ — このリポジトリが `bin/test-lane` と `test/evals/*_eval_runner.rb` を提供している場合:**

- 差分を、プロジェクトが文書化したプロンプトのパスと照合します。例: `app/services/*_prompt_builder.rb`、生成/ライター/デザイナーのサービス、evaluator/scorer/classifier/analyzer のサービス、voice/writing/prompt/token の concern、チャットツール、`config/system_prompts/*.txt`、`test/evals/**/*`。
- 変更されたファイルを、各ランナーの `PROMPT_SOURCE_FILES` と照合します。共有のジャッジ/サポート/フィクスチャの import をたどって、影響を受けるすべてのスイートを特定してください。`post_generation_eval_runner.rb` のようなランナーは、`post_generation_eval_test.rb` に対応します。
- プロジェクトの完全なマージ前のティア (このランナーでは `EVAL_JUDGE_TIER=full`) を使います。より安価な開発用ティアで代用しないでください。選択がまだ不確かな場合は、影響を受けそうなスイートをすべて含めてください。

**2. 選択したコマンドを実行し、その終了ステータスを保持します。**

Rails の例では:

```bash
set -o pipefail
EVAL_JUDGE_TIER=full EVAL_VERBOSE=1 bin/test-lane --eval test/evals/<suite>_eval_test.rb 2>&1 | tee /tmp/ship_evals.txt
```

他のスタックでは、そのネイティブなコマンドを使います。プロジェクトの並行性と再試行のポリシーに従ってください。テストレーンを共有する Rails のスイートは順番に実行します。有料のスイートを次々に開始せず、最初の失敗で停止してください。

**長い eval スイート (30 分以上): ターン境界で止まらないよう、切り離して起動します。**
切り離しランナーと eval のロックを使い、外側のタイムアウトは、プロジェクトが宣言したスイートの実行時間と再試行を含むように設定します。個々の eval の制限は変更しないでください。全体の上限が 5400 秒に収まるスイートの場合:

```bash
~/.claude/skills/gstack/bin/gstack-detach --label ship-evals --lock gstack-evals --timeout 5400 -- <project eval command>
```

表示されたログで `### gstack-detach EXIT=<code> ###` が出るまでポーリングしてください。無音は成功ではありません。設定されたすべての試行を保持します。スキップされた、または開始されなかったケースは、カバレッジを満たしません。

**3. 結果を確認し、Step 19 のために証拠を保存します。**

- **eval が 1 つでも失敗した場合:** ゲート全体を再実行しないでください。失敗と利用可能なコストを示したうえで、`~/.claude/skills/gstack/ship/sections/measure.md` を読み、赤になったケースごとにそのループを実行します。分類し、単独で測定し、原因で修正し、再測定し、その後にゲートを 1 回実行します。名前付きの赤のストップに達した場合のみ **停止** します。
- **選択したすべての eval が合格した場合:** 実際の件数、再利用した証拠とその出所、利用可能なコストを記録します。Step 7 に進みます。

---
