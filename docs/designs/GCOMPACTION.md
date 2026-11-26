# GCOMPACTION.md — 設計とアーキテクチャ(保留中)

**承認後の配置先:** `docs/designs/GCOMPACTION.md`

これは `gstack compact` の設計成果物として保存されているものです。下の最初の `---` の区切り線より上の内容は、計画の承認時に `docs/designs/GCOMPACTION.md` へそのまま抽出されます。区切り線より下は、設計の材料になった調査(office hours、競合の詳細調査、eng-review のメモ、codex のレビュー、調査結果)をアーカイブしたものです。

---

## ステータス: 保留(2026-04-17)— Anthropic の `updatedBuiltinToolOutput` API を待つ

**保留の理由。** v1 のアーキテクチャは、Claude Code の `PostToolUse` フックが、組み込みツール(Bash、Read、Grep、Glob、WebFetch)についてモデルのコンテキストに入るツールの出力を置き換えられることを前提としていた。2026-04-17 の調査で、これは現状では不可能だと確認された。

**根拠:**

1. **公式ドキュメント**(https://code.claude.com/docs/en/hooks): `PostToolUse` で出力を置き換えられる唯一のフィールドは `hookSpecificOutput.updatedMCPToolOutput` で、ドキュメントには次のように明記されている。*"For MCP tools only: replaces the tool's output with the provided value."* 組み込みツールに相当するフィールドは存在しない。
2. **Anthropic の issue [#36843](https://github.com/anthropics/claude-code/issues/36843)**(オープン): Anthropic 自身がこの欠落を認めている。*"PostToolUse hooks can replace MCP tool output via `updatedMCPToolOutput`, but there is no equivalent for built-in tools (WebFetch, WebSearch, Bash, Read, etc.)... They can only add warnings via `decision: block` (which injects a reason string) or `additionalContext`. The original malicious content still reaches the model."*
3. **RTK の仕組み**(`src/hooks/init.rs:906-912` と `hooks/claude/rtk-rewrite.sh:83-100` で、ソースを確認): RTK は `PostToolUse` のコンパクターではない。`tool_input.command` を書き換える **PreToolUse** の Bash のマッチャーである(例: `git status` → `rtk git status`)。ラップされたコマンド自体がコンパクトな標準出力を生成する。RTK の README も、「このフックは Bash のツール呼び出しにのみ実行される。Read、Grep、Glob などの Claude Code の組み込みツールは Bash のフックを通らないため、自動では書き換えられない」と確認している。RTK が Bash のみなのは、選択ではなくアーキテクチャ上の制約による。
4. **tokenjuice の仕組み**(`src/core/claude-code.ts:160, 491, 540-549` で、ソースを確認): tokenjuice は `matcher: "Bash"` で `PostToolUse` を登録するが、利用可能な実際の出力置き換え API はない。`decision: "block"` と `reason` を乗っ取って、圧縮したテキストを注入している。これが実際にモデルのコンテキストのトークンを減らすのか、単に UI の出力に重ねているだけなのかは争いがある。tokenjuice も Bash のみ。
5. **Read、Grep、Glob は Claude Code の内部でプロセス内に実行され、フックを完全に迂回する。** 「ネイティブツールのカバレッジ」という立場(wedge ii)は、フックの置き換え API の有無に関係なく、初日から構造的に不可能だった。

**結果。** 両方の wedge は、元の形では成立しなくなった:
- wedge (i)「条件付きの LLM 検証」: PreToolUse のコマンドラップ(RTK の仕組み)を使えば、Bash の出力に限って依然として技術的には可能。ただし Bash のみになると、検証は差別化の要因にならなくなる。
- wedge (ii)「ネイティブツールのカバレッジ」: 現状では不可能。Read、Grep、Glob はフックを発火させない。仮に発火しても、非 MCP のツールに対する出力置き換えのフィールドが存在しない。

**決定。** `gstack compact` は完全に棚上げする。Anthropic の issue #36843 を追跡し、`updatedBuiltinToolOutput`(または同等のもの)が出荷されるのを待つ。その API が出荷されたら、この設計文書、下の 15 項目のロック済みの決定、末尾の調査アーカイブが、新しい実装スプリントの出発点になる。

**再開する場合:** 下の「plan-eng-review でロックした決定」のブロックから始める。その多くは依然として有効。その後、出荷された新しい API に対してフックの参照を再確認し、アーキテクチャのデータフロー図を、実在する出力置き換えのフィールドに合わせて更新する。コーディングを始める前に、改訂した計画に対して `/codex review` を再実行する。

**やらないこと:**
- Bash のみの PreToolUse ラッパーは出荷しない。それは RTK の製品であり、RTK は 28K のスターと 3 年分のルールの蓄積がある。差別化の余地はない。
- `decision: block` + `reason` の小細工は出荷しない。文書化されていない動作で、Anthropic がいつでも壊しうる。また、モデルは圧縮された重ね書きと並んで生の出力を見るかもしれず、コンテキストの節約は争いがある。
- B シリーズのベンチマークを単独で出荷しない。動くコンパクターがなければ、測るものがない。

**保留のコスト:** ほぼゼロ。コードは書かれていない。設計文書、調査、決定は、再開可能な成果物として残る。

---

## plan-eng-review でロックした決定(2026-04-17)

Anthropic が組み込みツールの出力置き換え API を出荷した場合に備えて残している。

エンジニアリングレビューの間に行ったすべての決定の要約。各セクションには完全な根拠が残っているが、このブロックが、ずれが生じた場合の唯一の情報源となる。

**スコープ(セクション 0):**
1. **Claude を先に対応する v1。** compact、rules、verifier を Claude Code のみに出荷する。Codex と OpenClaw は、主要なホストで wedge が証明された後の v1.1 で対応する。これによりホスト統合の約 2 日の作業を削り、出荷のリスクを下げる。「wedge (ii) ネイティブツールのカバレッジ」の主張は、v1 では Claude Code に対してのみ当てはまり、v1.1 まではホストをまたぐ主張はしない。
2. **13 ルールの起動ライブラリ。** v1 は tests(jest/vitest/pytest/cargo-test/go-test/rspec)、git(diff/log/status)、install(npm/pnpm/pip/cargo)を出荷する。build/lint/log のファミリーは v1.1 に延期し、実際のユーザーからの `gstack compact discover` のテレメトリで判断する。
3. **v1.0 では verifier をデフォルトでオン。** `failureCompaction` のトリガー(exit≠0 かつ削減率 >50%)を、初期設定で有効にする。verifier こそが wedge であり、デフォルトでオフにすると差別化の機能が隠れてしまう。トリガーの境界により、発火率は想定でツール呼び出しの 10% 以下に保たれる。

**アーキテクチャ(セクション 1):**
4. **Haiku の出力に対する完全一致のサニタイズ。** 生の出力を `\n` で分割し、行を集合にして、その集合に完全に一致する Haiku の行だけを追加する。最も厳しい敵対的な契約で、プロンプトインジェクションによって新しい文章が入り込むことはない。
5. **多層の failureCompaction のシグナル。** エンベロープの `exitCode` を優先する。ホストがそれを省略した場合は、出力に対する `/FAIL|Error|Traceback|panic/` の正規表現にフォールバックする。どのシグナルが発火したかは `meta.failureSignal`("exit" | "pattern" | "none")に記録する。実装前のタスク #1 では、Claude Code のエンベロープを実際に検証するが、検証できなくてもシステムは壊れない。
6. **ディープマージによるルールの解決。** ユーザー/プロジェクトのルールは、上書きしないフィールドについて組み込みのフィールドを引き継ぐ。`"extends": null` をルールファイルに書くと、完全な置き換えの意味になる。eslint/tsconfig/.gitignore と同じメンタルモデル。一部だけを上書きしても、残りは失われない。

**コード品質(セクション 2):**
7. **ルールごとの正規表現のタイムアウト。RE2 の依存はなし。** 各ルールの正規表現を 50ms の AbortSignal の予算で実行する。タイムアウトした場合はそのルールをスキップし、`meta.regexTimedOut: [ruleId]` を記録する。WASM の依存を避け、ルールの作者が書く構文を制約しない。
8. **事前コンパイルしたルールのバンドル。** `gstack compact install` と `gstack compact reload` は、`~/.gstack/compact/rules.bundle.json`(ディープマージ済みで、正規表現をコンパイルしたメタデータをキャッシュ)を生成する。フックは N 個のソースファイルを解析する代わりに、この 1 つのファイルを読む。
9. **mtime のずれによる自動再読み込み。** フックは起動時にルールのソースファイルの stat を取る。どれかのソースファイルがバンドルより新しければ、適用する前にその場でバンドルを再構築する。呼び出しごとに約 0.5ms 増えるが、「ルールを編集したのに何も変わらない」という落とし穴をなくす。
10. **v1 の秘匿化の対象を拡大。** tee ファイルは次を秘匿化する: AWS のキー、GitHub のトークン(`ghp_/gho_/ghs_/ghu_`)、GitLab のトークン(`glpat-`)、Slack の webhook、汎用の JWT(base64 の 3 つのセグメント)、汎用の bearer トークン、SSH の秘密鍵のヘッダー(`-----BEGIN * PRIVATE KEY-----`)。クレジットカード番号、マイナンバー、環境変数のキーと値のペアは、v2 のより完全な DLP の層に延期する。

**テスト(セクション 3):**
11. **P シリーズのゲートのサブセット。** v1 のゲート階層の P テスト: P1(バイナリのごみ)、P3(空の出力)、P6(RTK を倒すクリティカルなスタックフレーム)、P8(tee への秘密情報)、P15(フックのタイムアウト)、P18(プロンプトインジェクション)、P26(不正な形式のユーザールールの JSON)、P28(正規表現の DoS)、P30(Haiku の幻覚)。残りの 21 件の P ケースは、実際のバグに遭遇するたびに R シリーズとして増やす。
12. **フィクスチャのバージョンの刻印。** すべてのゴールデンのフィクスチャは `toolVersion:` のフロントマターを持つ。フィクスチャの toolVersion が、現在インストールされているものと異なる場合、CI が警告する。暦に基づくローテーションはもう使わない。
13. **B シリーズの実世界ベンチマークの試験台(v1 の必須ゲート)。** 新しいコンポーネント `compact/benchmark/` は `~/.claude/projects/**/*.jsonl` をスキャンし、最もノイズの多いツール呼び出しをランク付けし、名前の付いたシナリオにクラスタリングし、コンパクターをそれらに対して再生し、ルールのファミリーごとの削減率を報告する。v1 は、作者自身の 30 日分のコーパスで、B シリーズが ≥15% の削減と、埋め込まれたバグのクリティカルな行の損失ゼロを示すまで出荷しない。ローカルのみで、決してアップロードしない。コミュニティで共有するコーパスは v2。

**パフォーマンス(セクション 4):**
14. **改訂したレイテンシの予算。** macOS ARM での Bun のコールドスタートは 15-25ms。当初の p50 10ms の目標は非現実的だった。新しい予算: macOS ARM で p50 <30ms / p99 <80ms、Linux で p50 <20ms / p99 <60ms(verifier はオフ)。verifier が発火した場合の予算は、p50 <600ms / p99 <2s のまま。デーモンモードは v2 の選択肢で、コールドスタートがセッションの節約を損なうことを B シリーズが示した場合に検討する。
15. **行指向のストリーミングのパイプライン。** stdin を readline で読み、フィルタ、グループ化、重複排除、リングバッファによる末尾の切り詰めを経て、stdout に出す。1 行が 1MB を超えたら P9 に当たる(1KB に切り詰め、`[... truncated ...]` の印を付ける)。出力の総量にかかわらず、メモリは 64MB で頭打ちになる。

上の各行は実装の `MUST` である。逸脱する場合は、新しい eng-review が必要になる。

---

## 概要

`gstack compact` は、AI のコーディングエージェントのコンテキストウィンドウに届く前に、ツールの出力のノイズを減らす `PostToolUse` フックとして設計された。決定的な JSON のルールで、ノイズの多いテストランナー、ビルドのログ、git の差分、パッケージのインストールの出力を縮める。条件付きの Claude Haiku の verifier は、過剰な圧縮のリスクが高い場合の安全網として働く。

**現在のステータス: 保留。** 上の「ステータス」の節を参照。このアーキテクチャは、2026-04-17 の時点では存在しない Claude Code の API(組み込みツール向けの `updatedBuiltinToolOutput` またはそれに相当するもの)に依存している。Anthropic の issue #36843 がこの欠落を追跡している。

**意図した目標(再開のスプリントのために保存):** 長いセッションごとに、ツール出力のトークンを 15-30% 削減する。タスクの失敗率は増やさない。

**元の wedge(先行する RTK、28K スターに対して)。どちらも調査によって無効になった:**
1. ~~**条件付きの LLM 検証。**~~ PreToolUse のコマンドラップを使えば、Bash に限って依然として技術的には実現可能。Bash のみになると差別化の要因ではなくなる。組み込みツールの API が出てきたら再検討する。
2. ~~**ネイティブツールのカバレッジ。**~~ 現状では構造的に不可能。Read、Grep、Glob は Claude Code の内部でプロセス内に実行され、フックを発火させない。`PostToolUse` を発火させるツールでも、非 MCP のツールに対する出力置き換えのフィールドは存在しない。

**元のポジショニング(今は無効):** *「RTK は速い。gstack compact は速くて安全で、Bash だけでなくツールボックス全体をカバーする。」*

## 非目標

- ユーザーのメッセージや、以前のエージェントのターンを要約すること(それは Claude 自身の Compaction API の役割)。
- エージェントの応答の出力を圧縮すること(caveman の層)。
- ツール呼び出しをキャッシュして再実行を避けること(token-optimizer-mcp の層)。
- 汎用のログ解析ツールとして振る舞うこと。
- `GSTACK_RAW=1` を使ってコマンドを再実行するかどうかについての、エージェント自身の判断を置き換えること。

## なぜ作る価値があるのか

**問題は仮説ではなく、測定されている。**

- [Chroma の調査(2025)](https://research.trychroma.com/context-rot) は、フロンティアモデル 18 件を試験した。どのモデルも、コンテキストが増えると性能が落ちる。劣化はウィンドウの上限よりずっと前から始まる。200K のモデルは 50K で劣化する。
- コーディングエージェントは最悪のケースである。コンテキストが累積し、無関係な情報の密度が高く、タスクの期間が長い。ツールの出力は、主要なノイズ源として名指しされている。
- 市場はすでに支持している。Anthropic は Opus 4.6 の Compaction API を出荷し、OpenAI は compaction のガイドを出し、Google ADK はコンテキスト圧縮を出荷し、LangChain は自律的な圧縮を出荷し、sst/opencode は組み込みの compaction を持つ。決定的な処理と LLM を組み合わせるハイブリッドのパターンが業界の合意である。

**既存の分野(gstack compact が加わり、差別化する対象):**

| プロジェクト | スター | ライセンス | 層 | 脅威 | 注記 |
|---------|-------|---------|--------|------|-------|
| **RTK(rtk-ai/rtk)** | **28K** | Apache-2.0 | ツールの出力 | 主要なベンチマーク | 純粋な Rust、Bash のみ、LLM なし |
| caveman | 34.8K | MIT | 出力のトークン | 別の軸 | 簡潔なシステムプロンプト。我々と組み合わせられる |
| claude-token-efficient | 4.3K | MIT | 応答の冗長さ | 別の軸 | CLAUDE.md が 1 つ |
| token-optimizer-mcp | 49 | MIT | MCP のキャッシュ | 別の軸 | 圧縮するのではなく、呼び出しを防ぐ |
| tokenjuice | ~12 | MIT | ツールの出力 | 新しすぎる | 2 日前。我々の JSON エンベロープの着想元 |
| 6-Layer Token Savings Stack | — | 公開の gist | レシピ | ゼロ | ドキュメント。段階的な圧縮の考え方を裏づける |

RTK が唯一の直接の競合である。他のものは、別のトークンの供給源を圧縮している。

**ライセンスの互換性:** 参照するプロジェクトはすべて寛容なライセンス(MIT または Apache-2.0)で、gstack の MIT ライセンスと互換性がある。AGPL、GPL、その他のコピーレフトの依存関係はない。クリーンルーム方式のポリシーは、下の「ライセンスと帰属」の節を参照。

## アーキテクチャ

### データフロー

```
┌─────────────────────────────────────────────────────────────────┐
│  Host (Claude Code / Codex / OpenClaw)                          │
│  ─────────────────────────────────────────                      │
│  1. Agent requests tool call: Bash|Read|Grep|Glob|MCP           │
│  2. Host executes tool                                          │
│  3. Host invokes PostToolUse hook with: {tool, input, output}   │
└────────────────────┬────────────────────────────────────────────┘
                     │ stdin (JSON envelope)
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│  gstack-compact hook binary                                     │
│  ───────────────────────────                                    │
│  a. Parse envelope                                              │
│  b. Match rule by (tool, command, pattern)                      │
│  c. Apply rule primitives: filter / group / truncate / dedupe   │
│  d. Record reduction metadata                                   │
│  e. Evaluate verifier triggers                                  │
│  f. If trigger met: call Haiku, append preserved lines          │
│  g. On failure exit code: tee raw to ~/.gstack/compact/tee/...  │
│  h. Emit JSON envelope to stdout                                │
└────────────────────┬────────────────────────────────────────────┘
                     │ stdout (JSON envelope)
                     ▼
              Host substitutes compacted output into agent context
```

### ルールの解決

優先順位の高い順に 3 段階の階層(最も高い優先度が勝つ)。tokenjuice と gstack の既存のホスト設定のエクスポートのモデルと同じパターン:

1. 組み込みのルール: gstack に同梱される `compact/rules/`
2. ユーザーのルール: `~/.config/gstack/compact-rules/`
3. プロジェクトのルール: `.gstack/compact-rules/`

ルールはルール ID でツール呼び出しに一致する。ID が `tests/jest` のプロジェクトのルールは、組み込みの `tests/jest` を完全に上書きする。マージはしない。置き換えの意味で、推論を単純に保つ。

### JSON エンベロープの契約(tokenjuice から採用)

入力:
```json
{
  "tool": "Bash",
  "command": "bun test test/billing.test.ts",
  "argv": ["bun", "test", "test/billing.test.ts"],
  "combinedText": "...",
  "exitCode": 1,
  "cwd": "/Users/garry/proj",
  "host": "claude-code"
}
```

出力:
```json
{
  "reduced": "compacted output with [gstack-compact: N → M lines, rule: X] header",
  "meta": {
    "rule": "tests/jest",
    "linesBefore": 247,
    "linesAfter": 18,
    "bytesBefore": 18234,
    "bytesAfter": 892,
    "verifierFired": false,
    "teeFile": null,
    "durationMs": 8
  }
}
```

### ルールのスキーマ

小さく、最小限にする。ルールのペイロードの合計は、ディスク上で 5KB 未満に保つ(claude-token-efficient からの教訓: ルールのファイル自体が、セッションごとにトークンを消費する)。

```json
{
  "id": "tests/jest",
  "family": "test-results",
  "description": "Jest/Vitest output — preserve failures and summary counts",
  "match": {
    "tools": ["Bash"],
    "commands": ["jest", "vitest", "bun test"],
    "patterns": ["jest", "vitest", "PASS", "FAIL"]
  },
  "primitives": {
    "filter": {
      "strip": ["\\x1b\\[[0-9;]*m", "^\\s*at .+node_modules"],
      "keep": ["FAIL", "PASS", "Error:", "Expected:", "Received:", "✓", "✗", "Tests:"]
    },
    "group": {
      "by": "error-kind",
      "header": "Errors grouped by type:"
    },
    "truncate": {
      "headLines": 5,
      "tailLines": 15,
      "onFailure": { "headLines": 20, "tailLines": 30 }
    },
    "dedupe": {
      "pattern": "^\\s*$",
      "format": "[... {count} blank lines ...]"
    }
  },
  "tee": {
    "onExit": "nonzero",
    "maxBytes": 1048576
  },
  "counters": [
    { "name": "failed", "pattern": "^FAIL\\s", "flags": "m" },
    { "name": "passed", "pattern": "^PASS\\s", "flags": "m" }
  ]
}
```

4 つのプリミティブ(`filter`、`group`、`truncate`、`dedupe`)は、RTK の技術の分類からそのまま取った。どの圧縮ツールでも扱う必要がある基本的なもの。どのルールも、4 つのプリミティブの任意の組み合わせを使える。省略されたプリミティブは何もしない。

### verifier の層(段階的、オプトイン)

verifier は、特定のトリガーの下でのみ発火する、安価な Haiku の呼び出し。ツール呼び出しのたびに発火することはない。

**トリガーの一覧(ユーザーが設定可能):**

| トリガー | デフォルト | 条件 |
|---------|---------|-----------|
| `failureCompaction` | **ON** | 終了コード ≠ 0 かつ削減率 >50%(診断が危うい) |
| `aggressiveReduction` | off | 削減率 >80% かつ元の行数 >200 |
| `largeNoMatch` | off | どのルールも一致せず、出力 >500 行 |
| `userOptIn` | on(環境変数で制御) | `GSTACK_COMPACT_VERIFY=1` でその呼び出しに verifier を強制 |

デフォルトの設定は `failureCompaction` のみを含む。これは最も効果の高いケース(エージェントがデバッグ中で、ルールがクリティカルなスタックフレームを絞り込んでしまったかもしれない)である。

**Haiku の役割(限定的):**

```
Here is raw output (truncated to first 2000 lines) and a compacted version.
Return any important lines from the raw that are missing from the compacted,
or `NONE` if nothing critical is missing.
```

verifier は、圧縮された出力を書き換えることは決してない。見出しの下に、欠けている行を追加するだけ:

```
[gstack-compact: 247 → 18 lines, rule: tests/jest]
[gstack-verify: 2 additional lines preserved by Haiku]
  TypeError: Cannot read property 'foo' of undefined
    at parseConfig (src/config.ts:42:18)
```

**なぜ Sonnet ではなく Haiku か:** コストは約 12 分の 1、所要時間は約 500ms 対約 2s。タスクは単純な部分文字列の分類であり、推論ではない。

**verifier の設定(`compact/rules/_verifier.json`):**

```json
{
  "verifier": {
    "enabled": true,
    "model": "claude-haiku-4-5-20251001",
    "maxInputLines": 2000,
    "triggers": {
      "aggressiveReduction": { "enabled": false, "thresholdPct": 80, "minLines": 200 },
      "failureCompaction":   { "enabled": true,  "minReductionPct": 50 },
      "largeNoMatch":        { "enabled": false, "minLines": 500 },
      "userOptIn":           { "enabled": true, "envVar": "GSTACK_COMPACT_VERIFY" }
    },
    "fallback": "passthrough"
  }
}
```

**失敗モード(verifier は純粋に追加的で、基本の動作を決して壊さない):**

- `ANTHROPIC_API_KEY` がない → verifier をスキップし、ルールの出力だけを使う。
- Haiku の呼び出しがタイムアウト(>5s)→ verifier をスキップし、ルールの出力だけを使う。
- Haiku が不正な JSON を返す → スキップし、ルールの出力だけを使う。
- Haiku がプロンプトインジェクションを試みる → サニタイズする。元の生の出力と部分文字列が一致する行のみを追加する。
- Haiku が幻覚の行(生の出力に存在しない)を返す → それらを捨てる。

### Tee モード(RTK から採用)

終了コードが 0 以外のコマンドでは、フィルタリングされていない完全な出力を `~/.gstack/compact/tee/{timestamp}_{cmd-slug}.log` に書き出します。圧縮後の出力には tee ファイルへのポインタが含まれます。

```
[gstack-compact: 247 → 18 lines, rule: tests/jest, tee: ~/.gstack/compact/tee/20260416-143022_bun-test.log]
```

完全なスタックトレースが必要になったら、エージェントはこの tee ファイルを直接読めます。これは、以前の `onFailure.preserveFull` の仕組みを、より素直な設計に置き換えるものです。圧縮後の出力は常に小さいままで、生の出力は常に `cat` 一回で見られます。

**Tee の安全対策:**

- ファイルモードは `0600` です。他のユーザーには読めません。
- 組み込みの秘密情報正規表現セットが、書き込みの前に AWS キー、Bearer トークン、一般的な認証情報のパターンを伏せ字にします。
- 書き込みに失敗した場合(読み取り専用のファイルシステム、権限拒否など)は、優雅に劣化させます。圧縮後の出力は引き続き出力し、`meta.teeFailed: true` を記録します。
- Tee ファイルは 7 日後に自動で期限切れになります(フックの起動時にクリーンアップ)。

### ホスト統合マトリクス

| ホスト | フックの種類 | 対応するマッチャー | 設定パス |
|------|-----------|-------------------|-------------|
| Claude Code | `PostToolUse` | Bash, Read, Grep, Glob, Edit, Write, WebFetch, WebSearch, mcp__* | `~/.claude/settings.json` |
| Codex (v1.1) | `PostToolUse` 相当 | Bash(主)。ツールのサブセットは未定。実機での検証が v1.1 の前提条件 | `~/.codex/hooks.json` |
| OpenClaw (v1.1) | ネイティブのフック API | Bash + MCP | OpenClaw の設定 |

**v1 は Claude 優先です。** ウェッジ(ii)、つまりネイティブツールのカバレッジは、[フックのリファレンス](https://code.claude.com/docs/en/hooks)を通じて Claude Code で確認済みです。Codex と OpenClaw の統合は、主要ホストで B 系列のベンチマークデータによってウェッジが実証された後に、v1.1 でのみ提供します。v1 の CHANGELOG には、Claude のみの対応範囲を明記します。

### 設定の仕様

ユーザー設定(`~/.config/gstack/compact.toml`):

```toml
[compact]
enabled = true
level = "normal"                            # minimal | normal | aggressive (caveman pattern)
exclude_commands = ["curl", "playwright"]   # RTK pattern

[compact.bundle]
auto_reload_on_mtime_drift = true           # hook rebuilds bundle if source rule files are newer
bundle_path = "~/.gstack/compact/rules.bundle.json"

[compact.regex]
per_rule_timeout_ms = 50                    # AbortSignal budget per regex; timeout → skip rule

[compact.verifier]
enabled = true
trigger_failure_compaction = true
trigger_aggressive_reduction = false
trigger_large_no_match = false
failure_signal_fallback = true              # use /FAIL|Error|Traceback|panic/ when exitCode missing
sanitization = "exact-line-match"           # only append lines present verbatim in raw output

[compact.tee]
on_exit = "nonzero"
max_bytes = 1048576
redact_patterns = ["aws", "github", "gitlab", "slack", "jwt", "bearer", "ssh-private-key"]
cleanup_days = 7

[compact.benchmark]
local_only = true                           # hard-coded; config is documentary, cannot be changed
transcript_root = "~/.claude/projects"
output_dir = "~/.gstack/compact/benchmark"
scenario_cap = 20                           # top-N clusters by aggregate output volume
```

**強度レベル(caveman パターン):**

- **minimal:** `filter` と `dedupe` のみ。切り詰めはしません。最も安全です。
- **normal:** `filter` + `dedupe` + `truncate`。デフォルトです。
- **aggressive:** `group` を追加します。節約量は増えますが、エッジケースのリスクも上がります。

### CLI の仕様

| コマンド | 目的 | 由来 |
|---------|---------|--------|
| `gstack compact install <host>` | ホストの設定に PostToolUse フックを登録し、`rules.bundle.json` をビルド | 新規 |
| `gstack compact uninstall <host>` | 冪等な削除 | 新規 |
| `gstack compact reload` | ユーザー/プロジェクトのルールを編集した後に `rules.bundle.json` を再ビルド | 新規 |
| `gstack compact doctor` | ドリフトや壊れたフック設定を検出し、修復を提案 | tokenjuice |
| `gstack compact gain` | 時間の経過によるトークンとドルの節約額を表示(ルールごとの内訳付き) | RTK |
| `gstack compact discover` | 対応するルールのないコマンドを、ノイズ量の多い順に表示 | RTK |
| `gstack compact verify <rule-id>` | フィクスチャに対してルールをドライランで検証 | 新規 |
| `gstack compact list-rules` | 深いマージ(組み込み + ユーザー + プロジェクト)後の有効なルールセットを表示 | 新規 |
| `gstack compact test <rule-id> <fixture>` | フィクスチャにルールを適用し、差分を表示 | 新規 |
| `gstack compact benchmark` | ローカルのトランスクリプト・コーパスに対して B 系列のテストベンチを実行(ベンチマークの節を参照) | 新規 |

エスケープハッチ: 環境変数 `GSTACK_RAW=1` を設定すると、そのコマンドの実行中はフックを完全にバイパスします(tokenjuice の `--raw` フラグと同じパターンです)。フックは、いずれかのソースルールファイルの mtime がバンドルファイルより新しい場合に、バンドルを自動で再読み込みします。

## ファイル構成

```
compact/
├── SKILL.md.tmpl              # template; regen via `bun run gen:skill-docs`
├── src/
│   ├── hook.ts                # entry point; reads stdin, writes stdout; mtime-checks bundle
│   ├── engine.ts              # rule matching + reduction metadata
│   ├── apply.ts               # primitive application (line-oriented streaming pipeline)
│   ├── merge.ts               # deep-merge of built-in/user/project rules; honors `extends: null`
│   ├── bundle.ts              # compile source rules → rules.bundle.json (install/reload)
│   ├── primitives/
│   │   ├── filter.ts
│   │   ├── group.ts
│   │   ├── truncate.ts        # ring-buffered tail; safe for arbitrary input size
│   │   └── dedupe.ts
│   ├── regex-sandbox.ts       # AbortSignal-bounded regex execution (50ms budget per rule)
│   ├── verifier.ts            # Haiku integration (triggers + failure-signal fallback + sanitization)
│   ├── sanitize.ts            # exact-line-match filter for verifier output
│   ├── tee.ts                 # raw-output archival with secret redaction + 7-day cleanup
│   ├── redact.ts              # secret-pattern set (AWS/GitHub/GitLab/Slack/JWT/bearer/SSH)
│   ├── envelope.ts            # JSON I/O contract parsing + validation
│   ├── doctor.ts              # hook drift detection + repair
│   ├── analytics.ts           # gain + discover queries against local metadata
│   └── cli.ts                 # argv dispatch; one thin dispatch per subcommand
├── benchmark/                 # B-series testbench (hard v1 gate)
│   └── src/
│       ├── scanner.ts         # walk ~/.claude/projects/**/*.jsonl; pair tool_use × tool_result
│       ├── sizer.ts           # tokens per call (ceil(len/4) heuristic); rank heavy tail
│       ├── cluster.ts         # group high-leverage calls by (tool, command pattern)
│       ├── scenarios.ts       # emit B1-Bn real-world scenario fixtures
│       ├── replay.ts          # run compactor against scenarios; measure reduction
│       ├── pathology.ts       # layer planted-bug P-cases on top of real scenarios
│       └── report.ts          # dashboard: per-scenario before/after + overall reduction
├── rules/                     # v1 built-in JSON rule library (13 rules)
│   ├── tests/
│   │   ├── jest.json
│   │   ├── vitest.json
│   │   ├── pytest.json
│   │   ├── cargo-test.json
│   │   ├── go-test.json
│   │   └── rspec.json
│   ├── install/
│   │   ├── npm.json
│   │   ├── pnpm.json
│   │   ├── pip.json
│   │   └── cargo.json
│   ├── git/
│   │   ├── diff.json
│   │   ├── log.json
│   │   └── status.json
│   ├── _verifier.json         # verifier config (not a rule per se)
│   └── _HOLD/                 # v1.1 rule families (not shipped at v1; kept for reference)
│       ├── build/
│       ├── lint/
│       └── log/
└── test/
    ├── unit/
    ├── golden/
    ├── fuzz/                  # P-series — v1 gate subset only (P1/P3/P6/P8/P15/P18/P26/P28/P30)
    ├── cross-host/            # v1: claude-code.test.ts only; codex/openclaw stub files
    ├── adversarial/           # R-series — grows with shipped bugs
    ├── benchmark/             # B-series scenario fixtures + expected reduction ranges
    ├── fixtures/              # version-stamped golden inputs (toolVersion: frontmatter)
    └── evals/
```

## テスト戦略

このテスト計画は、設計上あえて包括的にしています。28K スターの既存製品には、3 年分の正規表現の傷跡があります。さらに我々のウェッジ(Haiku verifier とネイティブツールのカバレッジ)は新しい故障面を持ち込みます。「コンパクタのせいでエージェントがバカになった」というのは、一度きりのチャンスで広まる可能性があります。その失敗を許容する余地はゼロです。

### テストの階層

| 階層 | コスト | 頻度 | マージのブロック |
|------|------|-----------|--------------|
| Unit | 無料、1 秒未満 | 全 PR | する |
| Golden ファイル(frontmatter の `toolVersion:` 付き) | 無料、1 秒未満 | 全 PR | する |
| ルールのスキーマ検証 | 無料、1 秒未満 | 全 PR | する |
| Fuzz(P 系列のゲートサブセット: P1/P3/P6/P8/P15/P18/P26/P28/P30) | 無料、10 秒未満 | 全 PR | する |
| クロスホスト E2E — v1 は Claude Code のみ | 無料、約 1 分 | 全 PR(gate 階層) | する |
| verifier による E2E(モック化された Haiku) | 無料、約 15 秒 | 全 PR | する |
| verifier による E2E(実際の Haiku) | 有料、約 $0.10/回 | verifier のファイルに触れる PR | する |
| **B 系列ベンチマーク(実世界のシナリオ)** | **無料、約 2 分** | **リリース前のゲート** | **する(v1 のハードゲート)** |
| トークン節約の評価(E1〜E4 の合成シナリオ) | 有料、約 $4/回 | 週次の定期実行 | しない(参考情報) |
| 敵対的リグレッション(R 系列) | 無料、5 秒未満 | 全 PR | する |
| ツールバージョンのドリフト警告 | 無料、1 秒未満 | 全 PR | 警告のみ |

テストファイルの構成:

```
compact/test/
├── unit/
│   ├── engine.test.ts         # rule matching + primitive application
│   ├── primitives.test.ts     # filter / group / truncate / dedupe
│   ├── envelope.test.ts       # JSON input/output contract
│   ├── triggers.test.ts       # verifier trigger evaluation
│   └── verifier.test.ts       # Haiku call (mocked)
├── golden/
│   ├── tests/                 # one fixture per test runner
│   │   ├── jest-success.input.txt
│   │   ├── jest-success.expected.txt
│   │   ├── jest-fail.input.txt
│   │   ├── jest-fail.expected.txt
│   │   └── ... (vitest, pytest, cargo-test, go-test, rspec)
│   ├── install/
│   ├── git/
│   ├── build/
│   ├── lint/
│   └── log/
├── fuzz/
│   └── pathological.test.ts   # P-series
├── cross-host/
│   ├── claude-code.test.ts
│   ├── codex.test.ts
│   └── openclaw.test.ts
├── adversarial/
│   └── regression.test.ts     # R-series; past bugs that must never recur
├── fixtures/
│   └── {tool}/                # shared raw output fixtures
└── evals/
    └── token-savings.eval.ts  # periodic-tier; measures real reduction
```

### G 系列: 良いケース(期待どおりの削減が起きること)

| ID | シナリオ | 期待される削減 |
|----|----------|-------------------|
| G1 | `jest` の 47 件の成功したテスト、クリーンな実行 | 150 行以上 → 10 行以下 |
| G2 | `jest` の 47 件のテストのうち 2 件が失敗 | 200 行以上 → 両方の失敗 + サマリーを残す |
| G3 | `--reporter=verbose` 付きの `vitest` 実行 | 300 行以上 → 15 行以下 |
| G4 | `pytest` の収集の後に実行 | 失敗時のトレースバックを保持 |
| G5 | 1 件の panic がある `cargo test` | panic の位置をそのまま保持 |
| G6 | 200 件のサブテストが成功した `go test -v` | `PASS: 200 subtests` にまとめる |
| G7 | 500 行のコンテキストの中に 2 つのハンクがある `git diff` | ハンクは残し、コンテキストは落とす |
| G8 | `git log -50` | SHA・件名・作者は残し、本文は落とす |
| G9 | 30 個のファイルが変更された `git status` | ディレクトリごとにグループ化 |
| G10 | 新規の `pnpm install` | 最終的な件数と警告。解決済みのパッケージは落とす |
| G11 | `pip install -r requirements.txt` | ダウンロードの進捗は落とし、最終的なインストール一覧とエラーは残す |
| G12 | 成功した `cargo build` | コンパイルの進捗は落とし、最終的なターゲットは残す |
| G13 | 成功した `docker build` | レイヤーの取得は落とし、最終的なイメージのダイジェストは残す |
| G14 | エラーのない `tsc --noEmit` | `tsc: 0 errors` に圧縮 |
| G15 | 3 件のエラーがある `tsc --noEmit` | 3 件のエラーを位置とともにすべて残す |
| G16 | エラーのない `eslint .` | `eslint: 0 problems` に圧縮 |
| G17 | 違反がある `eslint .` | ルールごとにグループ化し、位置と修正案を残す |
| G18 | 同じ行が 1000 回繰り返される `docker logs -f` | 件数付きで重複を除去: `[last message repeated 973 times]` |
| G19 | `kubectl get pods -A` | namespace ごとにグループ化 |
| G20 | 深いツリーの `ls -la` | ディレクトリごとのグループ化(RTK パターン) |
| G21 | 1 万ファイルの `find . -type f` | 拡張子ごとに件数付きでグループ化 |
| G22 | 500 件ヒットする `grep -r "foo" .` | 50 件で打ち切り。接尾辞 `[... 450 more matches; use --ripgrep for full]` |
| G23 | `curl -v https://api.example.com` | 冗長なヘッダーを削り、レスポンス本文は残す |
| G24 | 50 インスタンスの `aws ec2 describe-instances` | 列形式のサマリー |

### P 系列: 病的なケース(エージェントを壊してはいけない)

ここでどれか一つでも間違えると、「便利な機能」が「壊滅的なリグレッション」に変わります。

| ID | シナリオ | 必要な振る舞い |
|----|----------|-------------------|
| P1 | 出力にバイナリのゴミ(非 UTF-8 のバイト) | 変更せずそのまま通す。クラッシュしない |
| P2 | ANSI エスケープの大量発生(1 万以上のコード) | きれいに取り除き、正規表現を詰まらせない |
| P3 | 空の出力(`""`) | 空のまま通す。ヘッダーを挿入しない |
| P4 | stdout と stderr が混在 | ルールは両方のストリームにまたがってマッチする |
| P5 | 切り詰められた出力(途中で SIGPIPE) | 部分的な出力を誤って圧縮しない |
| P6 | **失敗したテスト。重要なスタックフレームが 200 行中 4 行目** | そのフレームを落としてはいけない(RTK を壊すケース) |
| P7 | 終了コード 0 だが出力に `ERROR:` がある | ルールは終了コードだけを信用してはいけない |
| P8 | 出力に AWS キー / bearer トークン / パスワードが含まれる | tee ファイルは他のユーザーに読めてはいけない。圧縮後の出力では伏せ字にする |
| P9 | 1 行に圧縮された JS のエラー(40KB) | 先頭 1KB に切り詰め、`[... truncated ...]` を付ける |
| P10 | Unicode(絵文字、RTL、結合文字、CJK) | バイト単位で安全な切り詰め。コードポイントを分割しない |
| P11 | 同じコマンドに 2 つのルールがマッチ | 優先順位は決定的。最も長い `match.commands` の接頭辞が勝つ。同点なら ルール ID のアルファベット順 |
| P12 | あるルールの圧縮後の出力が、別のルールのパターンにマッチ | 再帰的に適用しない。フックはツール呼び出しごとに一度だけ実行 |
| P13 | コマンドの引用符の中に改行がある | ルールが引数を誤って解析しない |
| P14 | 同時のツール呼び出し(並列の Bash 呼び出し) | フックに共有の可変状態がない。各呼び出しは独立 |
| P15 | フックの実行が 5 秒を超える | 生の出力をそのまま通す。`meta.timedOut: true` を出す |
| P16 | Haiku API がオフライン / レート制限中 | verifier を黙ってスキップし、純粋なルールの出力を使う |
| P17 | Haiku が不正な JSON を返す | verifier をスキップ。生のレスポンスをエージェントに渡さない |
| P18 | Haiku のレスポンスにプロンプトインジェクション(`"Ignore all prior instructions..."`) | サニタイズ: 元の生の出力の部分文字列に一致する行だけを追記 |
| P19 | 100 万行の出力 | ストリーム処理し、メモリを 64MB に抑える。明確なマーカー付きで切り詰める |
| P20 | 連射: 1 秒に 50 回のツール呼び出し | フックのレイテンシは p99 で 15ms 未満を保つ |
| P21 | シェルのリダイレクト付きのコマンド(`cmd >file 2>&1`) | リダイレクトのラッパーではなく、基礎となるコマンド名でマッチする |
| P22 | コマンド文字列の深くネストした引用符やエスケープ | 堅牢な引数パーサー。シェルインジェクションが不可能 |
| P23 | 出力に NULL バイト | 安全に取り除き、切り詰めない |
| P24 | 終了した後にさらに stderr に書き出すコマンド | フックは最終的な結合出力を受け取り、適切に処理する |
| P25 | 読み取り専用のファイルシステム / tee への書き込み権限なし | 優雅に劣化させる。圧縮後の出力は出し、`meta.teeFailed: true` を記録 |
| P26 | ユーザーのルール JSON が不正 | そのルールをスキップし、stderr に警告を出す。フックは壊さない |
| P27 | ルールが存在しないプリミティブのフィールドを参照 | 未知のフィールドを無視し、残りのルールは適用する |
| P28 | ルールの正規表現に破滅的バックトラッキング | RE2 互換のエンジン(バックトラックなし)か、ルールごとのタイムアウト |
| P29 | 終了コード 137(OOM kill) | ルールは一般的な失敗と同じに扱い、出力は完全に残す |
| P30 | Haiku が生の出力に存在しない行を返す(ハルシネーション) | ハルシネーションされた行を捨て、部分文字列に一致する行だけを残す |

### CH 系列: クロスホスト E2E

サポートされている各ホストで、各シナリオを実行します。入力も期待される出力も同じです。ホストがあるマッチャーに対応していない場合、そのテストは上流の制約へのコメントを添えて `skip-on-{host}` とマークします。

| ID | シナリオ | ホスト |
|----|----------|-------|
| CH1 | `gstack compact install <host>` でフックをインストール | Claude Code, Codex, OpenClaw |
| CH2 | フックのアンインストールは冪等 | 全て |
| CH3 | 再インストールしても重複したエントリを作らない | 全て |
| CH4 | フックがユーザーの他の PostToolUse フックと共存する | 全て |
| CH5 | Bash ツールでフックが発火する | 全て |
| CH6 | Read ツールでフックが発火する | Claude Code(確認済み)。Codex/OpenClaw は検証してから必須化 |
| CH7 | Grep ツールでフックが発火する | CH6 と同じ |
| CH8 | Glob ツールでフックが発火する | CH6 と同じ |
| CH9 | MCP ツール(`mcp__*` マッチャー)でフックが発火する | Claude Code。他は検証 |
| CH10 | 設定の優先順位: プロジェクト > ユーザー > 組み込み | 全て |
| CH11 | `GSTACK_RAW=1` 環境変数でフックをバイパスできる | 全て |
| CH12 | ルール ID の上書きが機能する(プロジェクトのルールが組み込みを置き換える) | 全て |
| CH13 | `gstack compact doctor` が各ホストのドリフトを検出する | 全て |
| CH14 | フックのエラーでエージェントのセッションがクラッシュしない | 全て |

実装上の注意: クロスホストのテストは `golden/` ツリーのフィクスチャのコーパスを再利用します。ハーネスは各フィクスチャを、ホストごとのフック呼び出しのエンベロープで包み、出力が(`host` フィールドを除き)ホストをまたいでバイト単位で同一であることを検証します。

### V 系列: verifier のテスト(有料)

| ID | シナリオ | 期待される結果 |
|----|----------|-------------------|
| V1 | ルールが 200 行のテスト出力を 5 行に減らす。exit=1 | verifier が発火する(失敗 + 50% 超の削減)。欠けている重要な行を追記する |
| V2 | ルールが 10 行の出力を 9 行に減らす。exit=1 | verifier は発火しない(削減が小さすぎる) |
| V3 | ルールが 200 行の出力を 5 行に減らす。exit=0 | verifier は発火しない(成功パス、デフォルト設定) |
| V4 | `aggressiveReduction` トリガーが有効。300 行 → 20 行、exit=0 | verifier が発火する |
| V5 | `GSTACK_COMPACT_VERIFY=1` 環境変数が設定されている | その呼び出しに対して verifier が一度発火する |
| V6 | `ANTHROPIC_API_KEY` がない | verifier を黙ってスキップし、生のルールの出力を返す |
| V7 | verifier のモックが "NONE" を返す | 出力は純粋なルールの経路と同一 |
| V8 | verifier のモックがプロンプトインジェクションを返す | インジェクションは破棄。部分文字列に一致した行だけを追記 |
| V9 | verifier のモックが 5 秒を超えてタイムアウト | スキップ。`meta.verifierTimedOut: true` |
| V10 | verifier のモックが 500 エラーを返す | スキップ。ルールの出力を返す |

### R 系列: 敵対的リグレッション

v1 の出荷後に見つかったバグはすべて、永続的な R 系列のテストになります。最初は空で、傷が増えるたびに増えていきます。テンプレート:

```
R{N}: {commit-sha} — {1-line summary}
Scenario: {reproducer}
Fix: {PR link}
```

### パフォーマンスの予算(CI で強制。実際の Bun のコールドスタートに合わせて改訂)

| 指標 | 目標 | ハードリミット |
|--------|--------|-----------|
| フックのオーバーヘッド、macOS ARM(verifier 無効) | p50 で 30ms 未満 | p99 で 80ms 未満 |
| フックのオーバーヘッド、Linux(verifier 無効) | p50 で 20ms 未満 | p99 で 60ms 未満 |
| フックのオーバーヘッド(verifier が発火) | p50 で 600ms 未満 | p99 で 2s 未満 |
| バンドルのデシリアライズ(rules.bundle.json) | 2ms 未満 | 10ms 未満 |
| mtime ドリフトのチェック(ソースファイルの stat) | 0.5ms 未満 | 3ms 未満 |
| 正規表現 1 つの実行予算(ルールごと) | 5ms 未満 | 50ms 未満(ハードアボート) |
| フック呼び出しごとのメモリ(行ストリーミング) | 通常 16MB 未満 | 最大 64MB 未満 |
| ディスク上のルールペイロードの合計サイズ(ソースファイル) | 5KB 未満 | 15KB 未満 |
| ディスク上のコンパイル済みバンドルのサイズ | 25KB 未満 | 80KB 未満 |

デーモンモードは v2 の最適化です。作者のコーパスに対する B 系列のベンチマークで、コールドスタートがセッション全体の節約に目に見えて悪影響を与える(例: フックの合計オーバーヘッドが、節約されたトークンの実時間の 5% を超える)と分かった場合にのみ、v1.1 へ前倒しします。

### B 系列: 実世界のベンチマーク用テストベンチ(v1 のハードゲート)

**このセクションがある理由。** 競合する圧縮ツールはどれも、手で選んだ固定のフィクスチャの数値を載せています。B 系列は、ユーザーが実際のコーディングセッションで、フックを有効にする前にコンパクタが機能することを証明するためのものです。出荷のゲートであり、マーケティング上の成果物でもあります。

**アーキテクチャ**(`compact/benchmark/src/` のコンポーネント):

```
┌──────────────────────────────────────────────────────────────┐
│  1. SCAN     scanner.ts walks ~/.claude/projects/**/*.jsonl  │
│              → pairs tool_use × tool_result blocks           │
│              → emits {tool, command, outputBytes, lineCount, │
│                estimatedTokens, sessionId, timestamp}        │
├──────────────────────────────────────────────────────────────┤
│  2. RANK     sizer.ts sorts corpus by estimatedTokens desc   │
│              → cluster.ts groups by (tool, command-pattern)  │
│              → identifies heavy-tail: which 10% of calls     │
│                produced 80% of the tokens?                   │
├──────────────────────────────────────────────────────────────┤
│  3. SCENARIO scenarios.ts emits fixture files:               │
│              B1_bun_test_heavy.jsonl                         │
│              B2_git_diff_huge.jsonl                          │
│              B3_tsc_errors_production.jsonl                  │
│              B4_pnpm_install_fresh.jsonl ... (one per        │
│              high-leverage cluster, up to ~20 scenarios)     │
├──────────────────────────────────────────────────────────────┤
│  4. REPLAY   replay.ts runs compactor against each scenario, │
│              measures token reduction + diff of dropped lines│
│              → per-rule reduction numbers                    │
│              → per-scenario before/after token counts        │
├──────────────────────────────────────────────────────────────┤
│  5. PATHOLOGY pathology.ts injects planted critical lines    │
│              (line 4 of 200 in a failing test fixture) into  │
│              real B-scenarios. Confirms verifier restores    │
│              them. Real data + real threats = real proof.    │
├──────────────────────────────────────────────────────────────┤
│  6. REPORT   report.ts emits HTML + JSON dashboard to        │
│              ~/.gstack/compact/benchmark/latest/              │
│              "On YOUR 30 days of Claude Code data, gstack    │
│              compact would save X tokens in Y scenarios."    │
└──────────────────────────────────────────────────────────────┘
```

**v1 の出荷ゲート(ハード):**
- 作者自身の 30 日分のトランスクリプトのセットで、集計されたシナリオ・コーパス全体のトークン削減率が 15% 以上であること。
- 埋め込んだバグのシナリオで、重要な行が一つも失われないこと(埋め込んだスタックフレームはすべて、ルールか verifier のいずれかで残ること)。
- どのシナリオも、新しいルールの下で削減率が 5% 未満に後退しないこと(圧縮しすぎのエッジケースを検出する)。

**プライバシー(譲れない条件):**
- `~/.claude/projects/**/*.jsonl` をローカルでのみ読みます。アップロードは決してしません。共有も決してしません。シナリオをテレメトリに記録することも決してしません。
- 出力ファイルは `~/.gstack/compact/benchmark/` 配下に、モード `0600` で保存します。
- コマンドは確認バナーを表示します: *"Scanning local transcripts at ~/.claude/projects/ (local-only; nothing leaves this machine)."*
- 将来のコミュニティ向けコーパスは、OSS プロジェクトから手で提供され、秘密情報のスキャンを経たフィクスチャで構築する、別の v2 のワークストリームとします。

**analyze_transcripts からの移植(TypeScript による再実装。サブプロセス呼び出しではない):**
- JSONL の解析と tool_use/tool_result の対応付けのパターン(`event_extractor.rb` から)。
- トークン数の見積もり `ceil(len/4)`(同じ文字数比のヒューリスティック。順位付けには十分)。
- シナリオのクラスタリング用のイベント種別の分類(`bash_command`、`file_read`、`test_run`、`error_encountered`)。
- 埋め込みのための、ストレスフィクスチャの生成パターン。

**移植しないもの:** 振る舞いのスコアリング、pgvector の埋め込み、決定の交換グラフ、速度のメトリクス、Rails/ActiveRecord の層。対象外であり、我々が測定したいものではありません。

### 合成トークン節約評価(E 系列。定期実行/参考情報のみ)

元の計画から残していますが、B 系列が実際のゲートになったため、参考情報のみとしています。

- **E1:** 中規模の TypeScript プロジェクトでの、30 分間のシミュレートされたコーディングセッション。gstack compact を有効にした場合と無効にした場合の、合計トークン数を測定。目標: 15% 以上の削減。
- **E2:** 同じセッションを `level=aggressive` で実行。目標: 25% 以上の削減。テストの失敗の増加がゼロであること。
- **E3:** 同じセッションで、`failureCompaction` だけを有効にした verifier。verifier の発火率はツール呼び出しの 10% 以下。
- **E4:** 敵対的テスト。テスト出力に埋め込んだバグを注入し、verifier が重要なスタックフレームを復元することを確認。

### テストコーパスの調達

ルールファミリーごとに、実際の出力を 3 つ以上取得します。

1. 実際のプロジェクトに対してツールを実行する(TS については gstack 自身、Rust/Go/Python については有名な OSS)。
2. stdout、stderr、終了コードを、`toolVersion:` の frontmatter 付きのフィクスチャファイルに取得する(例: `jest@29.7.0`)。
3. 期待される圧縮後の出力を、一度だけ手で書く。
4. Golden ファイルのテスト: ルールの適用結果は、バイト単位で同一でなければならない。
5. CI のドリフト警告: インストールされたツールのバージョンがフィクスチャの `toolVersion:` と異なる場合、CI は警告する(失敗はさせない)。ドリフト警告のダッシュボードはリリース前に確認する。

参照元:
- tokenjuice のフィクスチャディレクトリのパターン(`tests/fixtures/`)。
- RTK のコマンドごとの例(README には実際の前後比較の指標が載っているが、独自に検証すること)。
- gstack 自身のテスト出力(自分たちのドッグフーディング)。
- `~/.gstack/compact/tee/` の実際の失敗の記録(ボランティアの貢献があったら)。
- **B 系列の実世界のシナリオが、削減量を測定するための主要なコーパスです。**

## パターン採用の対応表

競合環境から、具体的に借用するパターン:

| 出典 | 採用するもの | 理由 |
|------|------------|------|
| RTK | 4 つの削減プリミティブ(filter/group/truncate/dedupe)を JSON のルールの動詞として採用 | 本格的なコンパクタには必須 |
| RTK | 失敗時の生データ保存として `gstack compact tee` | 元の `onFailure.preserveFull` の設計より良い |
| RTK | `gstack compact gain` + `gstack compact discover` | 信頼性と継続的な改善のため |
| RTK | コマンドごとの `exclude_commands` によるユーザー単位のブロックリスト | 必須の設定 |
| tokenjuice | フックの入出力の JSON エンベロープ契約 | 明快な機械向けアダプター |
| tokenjuice | `gstack compact doctor` | フックはドリフトする。自己修復が重要 |
| caveman | 強度レベル(minimal/normal/aggressive) | ユーザーが調整できる安全性と節約のつまみ |
| claude-token-efficient | ルールファイルのサイズ予算(合計 5KB 未満) | コンテキストを膨らませない |

## ロールアウト計画

**全フェーズを保留中。Anthropic の `updatedBuiltinToolOutput` API を待つ。** 文書冒頭のステータスの節を参照してください。以下のロールアウトは、API が出荷されて本設計が再開されたときの想定の順序です。

### 保留解除のチェックリスト(API が来たら順番に実行)

1. **新しい API の形を確認する。** 更新された Claude Code のフックのリファレンスを読む。Bash、Read、Grep、Glob について、新しい出力置換フィールドを含む実際のエンベロープを取得する。`docs/designs/GCOMPACTION_envelope.md` に記録する。
2. **ウェッジを再検証する。** 新しい API は Read/Grep/Glob をカバーするか(現在これらは `PostToolUse` を発火させるか)、それとも Bash/WebFetch だけか。Bash だけであれば、ウェッジ(ii)は成立せず、実装の前に製品の訴求を作り直す必要がある。
3. **改訂された計画に対して `/plan-eng-review` を再実行する。** 決定済みの 15 項目のほとんどは引き継げる。アーキテクチャのデータフローと、エンベロープに依存する決定だけを調整する。
4. **改訂された計画に対して `/codex review` を再実行する。** フックの置き換えに関する先の BLOCK 判定の懸念は、API が存在すれば消える。残る重大事項(B 系列のプライバシー、正規表現による DoS、JSON エンベロープのストリーミング)は依然として当てはまる。
5. **下記の元のロールアウトを実行する。**

### 元のロールアウト(保留解除のために保存)

各階層は、前の階層のゲート階層のテストがすべて通ることを前提とします。Claude 優先。Codex と OpenClaw は、主要ホストでウェッジが実証された後の v1.1 で導入します。

1. **v0.0(1 日):** ルールエンジン + 4 つのプリミティブ + 行指向のストリーミングパイプライン + 深いマージ + バンドルコンパイラ + エンベロープ契約 + `tests/*` ファミリーのみの golden テスト。ホストとの統合はまだしない。オフラインのフィクスチャで節約量を測定する。
2. **v0.1(1 日):** Claude Code のフック統合 + `gstack compact install` + mtime ベースの自動再読み込み。オプトインで出荷し、デフォルトはオフ。gstack のパワーユーザー 10 人に試してもらい、フィードバックを集める。
3. **v0.5(1 日):** B 系列のベンチマーク用テストベンチ(`compact/benchmark/`)。ユーザーが自分のデータで測定できるように `gstack compact benchmark` を出荷する。ドッグフーダーから、匿名(最初から何もアップロードしない)の削減量の数値を集める。
4. **v1.0(1 日):** verifier 層。`failureCompaction` トリガーをデフォルトで有効にし、完全一致の行によるサニタイズと、階層化された終了コード/パターンによるフォールバックを入れ、tee の伏せ字の範囲を広げる。**ハードな出荷ゲート:** 作者のローカルの 30 日分のコーパスに対する B 系列で、全体の削減率が 15% 以上かつ、埋め込んだバグで重要な行の損失がゼロであること。ウェッジの訴求(v1 は Claude Code のみ)で始まる CHANGELOG のエントリを公開する。
5. **v1.1(+1 日):** Codex + OpenClaw のフック統合。クロスホストの E2E スイートがグリーンになること。ビルド/リント/ログのルールファミリーを、`gstack compact discover` から導かれた優先度とともに投入する。
6. **v1.2 以降:** ルールファミリーの拡充、コミュニティからのルール貢献のワークフロー、コミュニティ向けコーパスによるベンチマーク(手で用意された公開フィクスチャ。ローカルの B 系列とは別)。

## リスク分析

| リスク | 深刻度 | 対策 |
|------|----------|------------|
| RTK が対抗して LLM verifier を追加する | 低 | 作者はゼロ依存の Rust について声高に主張している。先に出荷し、パターンライブラリを作る。 |
| プラットフォームの圧縮が我々を包含する(Claude Code の Anthropic Compaction API) | 中 | 我々は別の層で動く(ツールごとの出力 vs コンテキスト全体)。補完的なものとして位置付ける。 |
| ルールが重要なものを落とす → 「コンパクタのせいでエージェントがバカになった」 | 高 | B 系列の実世界ベンチマークを出荷のハードゲートにする。tee モードは常に利用可能。失敗時は verifier をデフォルトでオン。完全一致の行によるサニタイズ。 |
| Haiku のコストの膨張(トリガーが想定より多く発火する) | 中 | E3 の評価 + B 系列の発火率の指標。コストは `gstack compact gain` で見える。発火率が 10% を超えたら v1.1 でセッションごとのレート上限を導入。 |
| ルールの保守負債(jest/vitest の出力形式の変更) | 中 | `toolVersion:` のフィクスチャの frontmatter + CI のドリフト警告。コミュニティからのルール PR。`discover` がバイパスされているコマンドを検出する。 |
| ルールファイルがコンテキストを膨らませる | 低 | CI で強制するソース 5KB 未満 + コンパイル済みバンドル 25KB 未満の予算。スキーマ検証でルールごとのサイズ警告。 |
| 正規表現の DoS がエージェントを止める | 中 | ルールごとに 50ms の AbortSignal の予算。タイムアウトは `meta.regexTimedOut` に記録。繰り返し失敗するルールは隔離。 |
| バンドルの陳腐化がユーザーの編集を黙って壊す | 低 | フック呼び出しごとの mtime チェックで自動再ビルド。`gstack compact reload` は必須ではなくバックアップ。 |
| ベンチマークがユーザーの私的なデータを漏らす | 高 | 構造上ローカルのみ: ネットワーク呼び出しなし、モード 0600 の出力、実行時の明示的なバナー。v1 出荷前にプライバシーレビューを行う。 |

## 未解決の質問

1. ~~Codex の PostToolUse フックは Read/Grep/Glob のマッチャーをサポートするか?~~(v1.1 に延期 — v1 は Claude 優先。)
2. ~~OpenClaw のフック API は PostToolUse を具体的にサポートするか?~~(v1.1 に延期。)
3. verifier のモデルは固定すべきか、それとも gstack の他の AI 呼び出しのようにバージョン追跡すべきか?(`claude-haiku-4-5-20251001` に固定し、CHANGELOG で明示的に上げる方向で検討中。)
4. ~~tee ファイル用の組み込みの秘密情報の伏せ字正規表現セット~~ **(解決済み: 拡張セット — AWS/GitHub/GitLab/Slack/JWT/bearer/SSH-private-key。決定 #10 を参照。)**
5. `gstack compact discover` は Haiku で自動生成ルールを提案すべきか?(v2 に延期。スキルの肥大化のリスク。)
6. **新規:** Claude Code の PostToolUse のエンベロープには `exitCode` が含まれるか?(まだ実機での検証が必要。事前実装タスク #1 を参照。ただしシステムにはいずれにせよ多層のフォールバックがある。)
7. **新規:** B 系列のシナリオ数の上限は何が適切か?cluster.ts は、重い裾野の形状に応じて 5〜50 のシナリオを生成しうる。計画: 出力量の合計で上位 20 クラスタに制限する。

## 実装前の課題(コーディングの前に必ず完了すること)

1. **Claude Code の PostToolUse エンベロープの内容を実機で検証する。** 何もしないフックを出荷し、`exitCode`、`command`、`argv`、`combinedText` がすべて含まれることを確認する。これはウェッジ(ii)のネイティブツールのカバレッジと、failureCompaction トリガーの両方の要となる。成果物: 実際に取得したエンベロープを Bash + Read + Grep + Glob について含む `docs/designs/GCOMPACTION_envelope.md`。
2. **RTK のルール定義を読む**(`ARCHITECTURE.md`、`src/rules/`)。4 つのプリミティブのどれを最もよく扱っているかを 1 段落でまとめる。v1 のルールセットに反映する。これは「ビルドする前に既存を調べる」層にあたる。
3. **analyze_transcripts の JSONL パーサーを TypeScript に移植する。** `compact/benchmark/src/scanner.ts`。作者の `~/.claude/projects/` で最もノイズの多いツール呼び出し上位 50 件を一覧する簡単な出力を書く。リプレイのループを作る前に、テストベンチの前提を確認する。これは B 系列の基盤。
4. **CHANGELOG のエントリを最初に書く。** 目標の一文: *"Every tool in your agent's toolbox on Claude Code now produces less noise — test runners, git diffs, package installs — with an intelligent Haiku safety net that restores critical stack frames when our rules over-compact, and a local benchmark that proves the savings on your actual 30 days of coding sessions. Codex + OpenClaw land in v1.1."* この文を正直に書けないなら、ウェッジはまだ成立していない。
5. **ルールのみの v0 を出荷する**(Haiku verifier もベンチマークもなし)。現在の gstack の評価 + 初期の B 系列のプロトタイプで、実際のトークン節約を測定する。ローカルのコーパスで 10% 未満なら、前提そのものが主張より弱い。verifier を重ねる前にルールを改善する。

## ライセンスと帰属

gstack は MIT ライセンスで提供されています。下流のユーザーにとってライセンスをクリーンに保つため、このプロジェクトは競合環境から借用するすべてのものについて、厳密なクリーンルーム方針に従います。

- **上記で参照するすべてのプロジェクトは、寛容なライセンス(MIT または Apache-2.0)です。** AGPL、GPL、SSPL、その他のコピーレフトのリスクはありません。
  - RTK(rtk-ai/rtk): **Apache-2.0** — MIT と互換。Apache の特許付与は我々にとって利点。
  - tokenjuice、caveman、claude-token-efficient、token-optimizer-mcp、sst/opencode: **MIT**。
- **コードではなくパターンを。** これらのプロジェクトは、何を解決し、なぜそうしたのかを理解するために読みます。我々は `compact/src/` の中で TypeScript として独立に実装します。ソースファイルをコピーせず、ソースファイルを一行ずつ翻訳せず、テストのフィクスチャをそのまま持ってきません。
- **帰属。** パターンを直接借用する場合(RTK からの 4 つのプリミティブ、tokenjuice からの JSON エンベロープ、caveman からの強度レベル、claude-token-efficient からのルールファイルのサイズ予算)は、コメント内と上の「パターン採用の対応表」で出典をインラインで明記します。プロジェクトの `README` と `NOTICE` ファイル(追加する場合)に、着想元を列挙します。
- **フィクスチャの調達。** Golden ファイルのフィクスチャは、実際のプロジェクトに対して実際のツールを実行して得たものです。我々自身の取得物であり、RTK や tokenjuice からインポートしたものではありません。これにより、テストのコーパスをライセンス的に絡まったコンテンツから自由に保ちます。
- **禁止する情報源。** 新しい参照プロジェクトを追加する前に、`gh api repos/OWNER/REPO --jq '.license'` を実行し、ライセンスのキーが次のいずれかであることを確認します: `mit`、`apache-2.0`、`bsd-2-clause`、`bsd-3-clause`、`isc`、`cc0-1.0`、`unlicense`。ライセンスのフィールドがないプロジェクトは「すべての権利を留保」と扱い、そこから何も引き出しません。`agpl-3.0`、`gpl-*`、`sspl-*`、および独自のまたはソースが公開されているだけのライセンスは拒否します。

CI での強制: `scripts/check-references.ts` スクリプトが `docs/designs/GCOMPACTION.md` から GitHub の URL を解析し、ライセンスチェックを再実行します。参照するプロジェクトのライセンスが許可リストから外れると失敗します。

## 参考文献

- [RTK (Rust Token Killer) — rtk-ai/rtk](https://github.com/rtk-ai/rtk)
- [RTK issue #538 — native-tool gap](https://github.com/rtk-ai/rtk/issues/538)
- [tokenjuice — vincentkoc/tokenjuice](https://github.com/vincentkoc/tokenjuice)
- [caveman — juliusbrussee/caveman](https://github.com/juliusbrussee/caveman)
- [claude-token-efficient — drona23](https://github.com/drona23/claude-token-efficient)
- [token-optimizer-mcp — ooples](https://github.com/ooples/token-optimizer-mcp)
- [6 層のトークン節約スタック — doobidoo の gist(原題: 6-Layer Token Savings Stack)](https://gist.github.com/doobidoo/e5500be6b59e47cadc39e0b7c5cd9871)
- [Claude Code hooks reference](https://code.claude.com/docs/en/hooks)
- [Chroma context rot research](https://research.trychroma.com/context-rot)
- [Morph: コンテキストが増えると LLM が劣化する理由(原題: Why LLMs Degrade as Context Grows)](https://www.morphllm.com/context-rot)
- [Anthropic Opus 4.6 Compaction API — InfoQ](https://www.infoq.com/news/2026/03/opus-4-6-context-compaction/)
- [OpenAI compaction docs](https://developers.openai.com/api/docs/guides/compaction)
- [Google ADK context compression](https://google.github.io/adk-docs/context/compaction/)
- [LangChain autonomous context compression](https://blog.langchain.com/autonomous-context-compression/)
- [sst/opencode context management](https://deepwiki.com/sst/opencode/2.4-context-management-and-compaction)
- [DEV: 決定的な評価器と LLM 評価器 — 2026 年のトレードオフ研究(原題: Deterministic vs. LLM Evaluators)](https://dev.to/anshd_12/deterministic-vs-llm-evaluators-a-2026-technical-trade-off-study-11h)
- [MadPlay: RTK 80% token reduction experiment](https://madplay.github.io/en/post/rtk-reduce-ai-coding-agent-token-usage)
- [Esteban Estrada: RTK による Claude Code のトークン 70% 削減(原題: RTK 70% Claude Code reduction)](https://codestz.dev/experiments/rtk-rust-token-killer)

**GCOMPACTION.md の正規セクションの終わり。** 上記の内容は、計画が承認されたら `docs/designs/GCOMPACTION.md` に一字一句そのままコピーされ、**保留中の設計資料**となります。コードは書きません。フックもインストールしません。CHANGELOG のエントリも追加しません。この文書は、Anthropic が組み込みツールの出力置換 API を出荷したときに、将来のスプリントが素早く再開できるようにするために存在します。
