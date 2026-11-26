# Slate ホスト統合 — 調査と設計ドキュメント

**日付:** 2026-04-02
**ブランチ:** garrytan/slate-agent-support
**ステータス:** 調査完了、ホスト設定のリファクタリングでブロック中
**置き換え対象:** なし

## Slate とは

Slate は Random Labs のプロプライエタリなコーディングエージェント CLI である。
インストール: `npm i -g @randomlabs/slate` または `brew install anthropic/tap/slate`。
ライセンス: プロプライエタリ。85MB のコンパイル済み Bun バイナリ(arm64/x64、darwin/linux/windows)。
npm パッケージ: `@randomlabs/slate@1.0.25`(8.8KB の薄いランチャーと、プラットフォームごとの optional deps)。

マルチモデル: Claude Sonnet/Opus/Haiku を動的に選び、ほかのモデルも使う。
「スウォーム・オーケストレーション」と、数時間に及ぶ拡張セッションのために作られている。

## Slate は OpenCode のフォークである

**バイナリ文字列の解析で確認**(85MB の Mach-O arm64 バイナリ):

- 内部名: `name: "opencode"`(バイナリ内のリテラル文字列)
- すべての `OPENCODE_*` 環境変数が、対応する `SLATE_*` の環境変数と並んで存在する
- ツールとスキルのアーキテクチャ、LSP 統合、ターミナル管理を OpenCode と共有している
- 独自のブランディング、API エンドポイント(`api.randomlabs.ai`、`agent-worker-prod.randomlabs.workers.dev`)、設定パスを持つ

このため統合では、OpenCode の慣例がほぼそのまま当てはまるが、Slate は独自のパスと環境変数を上乗せしている。

## スキルの探索(バイナリから確認)

Slate はスキルを4つのディレクトリ系統すべてから探す。バイナリのエラーメッセージがそれを裏付けている。

```
"failed .slate directory scan for skills"
"failed .claude directory scan for skills"
"failed .agents directory scan for skills"
"failed .opencode directory scan for skills"
```

**探索パス(Slate のドキュメントによる優先順位):**

1. `.slate/skills/<name>/SKILL.md` — プロジェクトレベル、最優先
2. `~/.slate/skills/<name>/SKILL.md` — グローバル
3. `.opencode/skills/`、`.agents/skills/` — 互換性のためのフォールバック
4. `.claude/skills/` — Claude Code 互換のフォールバック(最下位)
5. `slate.json` によるカスタムパス

**グロブパターン:** `**/SKILL.md` と `{skill,skills}/**/SKILL.md`

**コマンド:** 同じディレクトリ構造だが、`commands/` のサブディレクトリの下にある。
`/.slate/commands/`、`/.claude/commands/`、`/.agents/commands/`、`/.opencode/commands/`

**スキルのフロントマター:** `name` と `description` を持つ YAML(Slate のドキュメントによる)。
どちらのフィールドにも、ドキュメント上の長さの制限はない。

## プロジェクトの指示

Slate はプロジェクトの指示として `CLAUDE.md` と `AGENTS.md` の両方を読む。
どちらのリテラル文字列もバイナリ内で確認できた。既存の gstack プロジェクトに変更は不要で、CLAUDE.md はそのまま動く。

## 設定

**設定ファイル:** `slate.json` / `slate.jsonc`(opencode.json ではない)

**設定オプション(Slate のドキュメントより):**
- `privacy`(boolean) — テレメトリとログを無効化する
- 権限: ツールごとの `allow`、`ask`、`deny`(`read`、`edit`、`bash`、`grep`、`webfetch`、`websearch`、`*`)
- モデルのスロット: `models.main`、`models.subagent`、`models.search`、`models.reasoning`
- MCP サーバー: カスタムコマンドとヘッダー付きのローカルまたはリモート
- カスタムコマンド: テンプレート付きの `/commands`

セットアップスクリプトは `slate.json` を**作成すべきではない**。権限はユーザーが自分で設定する。

## CLI フラグ(ヘッドレスモード)

```
--stream-json / --output-format stream-json  — JSONL output, "compatible with Anthropic Claude Code SDK"
--dangerously-skip-permissions               — bypass all permission checks (CI/automation)
--input-format stream-json                   — programmatic input
-q                                           — non-interactive mode
-w <dir>                                     — workspace directory
--output-format text                         — plain text output (default)
```

**Stream-JSON の形式:** Slate のドキュメントは「Anthropic Claude Code SDK と互換」と述べている。
ただし、まだ実機で検証していない。OpenCode の系統であることを考えると、Claude Code の NDJSON のイベントスキーマ(type: "assistant"、type: "tool_result"、type: "result")と一致している可能性が高い。

**要検証:** セッションランナーのパーサーを作る前に、有効なクレジットで `slate -q "hello" --stream-json` を実行し、実際の JSONL イベントを取得すること。

## 環境変数(バイナリの文字列より)

### Slate 固有のもの
```
SLATE_API_KEY                              — API key
SLATE_AGENT                                — agent selection
SLATE_AUTO_SHARE                           — auto-share setting
SLATE_CLIENT                               — client identifier
SLATE_CONFIG                               — config override
SLATE_CONFIG_CONTENT                       — inline config
SLATE_CONFIG_DIR                           — config directory
SLATE_DANGEROUSLY_SKIP_PERMISSIONS         — bypass permissions
SLATE_DIR                                  — data directory override
SLATE_DISABLE_AUTOUPDATE                   — disable auto-update
SLATE_DISABLE_CLAUDE_CODE                  — disable Claude Code integration entirely
SLATE_DISABLE_CLAUDE_CODE_PROMPT           — disable Claude Code prompt loading
SLATE_DISABLE_CLAUDE_CODE_SKILLS           — disable .claude/skills/ loading
SLATE_DISABLE_DEFAULT_PLUGINS              — disable default plugins
SLATE_DISABLE_FILETIME_CHECK               — disable file time checks
SLATE_DISABLE_LSP_DOWNLOAD                 — disable LSP auto-download
SLATE_DISABLE_MODELS_FETCH                 — disable models config fetch
SLATE_DISABLE_PROJECT_CONFIG               — disable project-level config
SLATE_DISABLE_PRUNE                        — disable session pruning
SLATE_DISABLE_TERMINAL_TITLE               — disable terminal title updates
SLATE_ENABLE_EXA                           — enable Exa search
SLATE_ENABLE_EXPERIMENTAL_MODELS           — enable experimental models
SLATE_EXPERIMENTAL                         — enable experimental features
SLATE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS — bash timeout override
SLATE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT  — disable copy on select
SLATE_EXPERIMENTAL_DISABLE_FILEWATCHER     — disable file watcher
SLATE_EXPERIMENTAL_EXA                     — Exa search (alt flag)
SLATE_EXPERIMENTAL_FILEWATCHER             — enable file watcher
SLATE_EXPERIMENTAL_ICON_DISCOVERY          — icon discovery
SLATE_EXPERIMENTAL_LSP_TOOL               — LSP tool
SLATE_EXPERIMENTAL_LSP_TY                 — LSP type checking
SLATE_EXPERIMENTAL_MARKDOWN               — markdown mode
SLATE_EXPERIMENTAL_OUTPUT_TOKEN_MAX       — output token limit
SLATE_EXPERIMENTAL_OXFMT                  — oxfmt integration
SLATE_EXPERIMENTAL_PLAN_MODE              — plan mode
SLATE_FAKE_VCS                            — fake VCS for testing
SLATE_GIT_BASH_PATH                       — git bash path (Windows)
SLATE_MODELS_URL                          — models config URL
SLATE_PERMISSION                          — permission override
SLATE_SERVER_PASSWORD                     — server auth
SLATE_SERVER_USERNAME                     — server auth
SLATE_TELEMETRY_DISABLED                  — disable telemetry
SLATE_TEST_HOME                           — test home directory
SLATE_TOKEN_DIR                           — token storage directory
```

### OpenCode のレガシー(今も動作する)
```
OPENCODE_DISABLE_LSP_DOWNLOAD
OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER
OPENCODE_EXPERIMENTAL_FILEWATCHER
OPENCODE_EXPERIMENTAL_ICON_DISCOVERY
OPENCODE_EXPERIMENTAL_LSP_TY
OPENCODE_EXPERIMENTAL_OXFMT
OPENCODE_FAKE_VCS
OPENCODE_GIT_BASH_PATH
OPENCODE_LIBC
OPENCODE_TERMINAL
```

### gstack 統合に重要な環境変数

**`SLATE_DISABLE_CLAUDE_CODE_SKILLS`** — 設定されると、`.claude/skills/` の読み込みが無効になる。
そのため `.slate/skills/` への公開は、単なる最適化ではなく必須になる。ネイティブの `.slate/` への公開がないと、このフラグを設定した時点で gstack のスキルは消える。

**`SLATE_TEST_HOME`** — E2E テストに便利。Slate のホームディレクトリを隔離された一時ディレクトリに向けられる。Codex のテストが一時的な HOME を使うのに似ている。

**`SLATE_DANGEROUSLY_SKIP_PERMISSIONS`** — ヘッドレスの E2E テストに必要。

## モデルの参照(バイナリより)

```
anthropic/claude-sonnet-4.6
anthropic/claude-opus-4
anthropic/claude-haiku-4
anthropic/slate              — Slate's own model routing
openai/gpt-5.3-codex
google/nano-banana
randomlabs/fast-default-alpha
```

## API エンドポイント(バイナリより)

```
https://api.randomlabs.ai                          — main API
https://api.randomlabs.ai/exaproxy                 — Exa search proxy
https://agent-worker-prod.randomlabs.workers.dev   — production worker
https://agent-worker-dev.randomlabs.workers.dev    — dev worker
https://dashboard.randomlabs.ai                    — dashboard
https://docs.randomlabs.ai                         — documentation
https://randomlabs.ai/config.json                  — remote config
```

Brew のタップ: `anthropic/tap/slate`(注目すべき点として、Random Labs ではなく Anthropic のタップ配下にある)

## npm パッケージの構成

```
@randomlabs/slate (8.8 kB, thin launcher)
├── bin/slate           — Node.js launcher (finds platform binary in node_modules)
├── bin/slate1          — Bun launcher (same logic, import.meta.filename)
├── postinstall.mjs     — Verifies platform binary exists, symlinks if needed
└── package.json        — Declares optionalDependencies for all platforms

Platform packages (85MB each):
├── @randomlabs/slate-darwin-arm64
├── @randomlabs/slate-darwin-x64
├── @randomlabs/slate-linux-arm64
├── @randomlabs/slate-linux-x64
├── @randomlabs/slate-linux-x64-musl
├── @randomlabs/slate-linux-arm64-musl
├── @randomlabs/slate-linux-x64-baseline
├── @randomlabs/slate-linux-x64-baseline-musl
├── @randomlabs/slate-darwin-x64-baseline
├── @randomlabs/slate-windows-x64
└── @randomlabs/slate-windows-x64-baseline
```

バイナリの上書き: `SLATE_BIN_PATH` 環境変数を設定すると、すべての探索を飛ばし、指定したバイナリを直接実行する。

## 今すでに動くもの

gstack のスキルは、`.claude/skills/` へのフォールバック経由で Slate でも動く。基本的な機能に変更は不要。Claude Code 向けに gstack をインストールしていて Slate も使うユーザーは、両方のエージェントでスキルを使える。

## 初めてサポートする場合に追加されるもの

1. **信頼性** — `.slate/skills/` は Slate の最優先パスである。`SLATE_DISABLE_CLAUDE_CODE_SKILLS` の影響を受けない。
2. **最適化されたフロントマター** — Slate が使わない Claude 固有のフィールド(allowed-tools、hooks、version)を取り除く。`name` と `description` だけを残す。
3. **セットアップスクリプト** — `slate` バイナリを自動検出し、`~/.slate/skills/` にスキルをインストールする。
4. **E2E テスト** — Slate が直接呼び出したときにスキルが動くことを確認する。

## ブロック要因: ホスト設定のリファクタリング

Codex の外部レビューは、Slate を4つ目のホスト(Claude、Codex、Factory の後)として加えることを「パスの別名のためのホストの乱立」だと指摘した。現在のアーキテクチャには次のものがある。

- ハードコードされたホスト名: `type Host = 'claude' | 'codex' | 'factory'`
- `transformFrontmatter()` 内のホストごとの分岐。ほぼ同じロジックが重複している
- `EXTERNAL_HOST_CONFIG` のホストごとの設定。似たパターンが並んでいる
- セットアップスクリプト内のホストごとの関数(`create_codex_runtime_root`、`link_codex_skill_dirs`)
- `bin/gstack-platform-detect`(削除済み。ホストの検出は現在 `hosts/` のレジストリで行われ、`scripts/host-config-export.ts` を通じてシェルに渡される)、`bin/gstack-uninstall`、`bin/dev-setup` にホスト名が重複している

Slate を追加するとは、これらのパターンをもう一度コピーすることを意味する。ホストをデータ駆動(if/else の分岐ではなく設定オブジェクト)にするリファクタリングを行えば、Slate の統合は簡単になり、今後のホスト(OpenCode のフォークや新しいエージェント)も手間なしで追加できるようになる。

### 計画から漏れていた点(Codex の指摘)

- `lib/worktree.ts` は `.agents/` しかコピーせず、`.slate/` はコピーしない。ワークツリー内の E2E テストには Slate のスキルがない
- `bin/gstack-uninstall` は `.slate/` を知らない
- `bin/dev-setup` は、コントリビューターの開発モード向けに `.slate/` を接続しない
- `bin/gstack-platform-detect` は Slate を検出しない(このバイナリは削除済みのため古い情報。ホストの検出は `scripts/host-config-export.ts` 経由の `hosts/` レジストリで行われ、Slate は `hosts/slate.ts` にある)
- E2E テストでは、`.slate/` のパスが実際に動くことを証明するため `SLATE_DISABLE_CLAUDE_CODE_SKILLS=1` を設定すべき(単に `.claude/` にフォールバックしているだけでないことを確認する)

## セッションランナーの設計(後で行う)

JSONL の形式が検証できたら、セッションランナーは次のようにする。

- 起動: `slate -q "<prompt>" --stream-json --dangerously-skip-permissions -w <dir>`
- パース: Claude Code SDK 互換の NDJSON(推定。検証が必要)
- スキル: テスト用フィクスチャの `.claude/skills/` ではなく、`.slate/skills/` にインストールする
- 認証: `SLATE_API_KEY` または既存の `~/.slate/` の認証情報を使う
- 隔離: ホームディレクトリの隔離に `SLATE_TEST_HOME` を使う
- タイムアウト: 既定 300 秒(Codex と同じ)

```typescript
export interface SlateResult {
  output: string;
  toolCalls: string[];
  tokens: number;
  exitCode: number;
  durationMs: number;
  sessionId: string | null;
  rawLines: string[];
  stderr: string;
}
```

## ドキュメントの参照先

- Slate のドキュメント: https://docs.randomlabs.ai
- クイックスタート: https://docs.randomlabs.ai/en/getting-started/quickstart
- スキル: https://docs.randomlabs.ai/en/using-slate/skills
- 設定: https://docs.randomlabs.ai/en/using-slate/configuration
- ホットキー: https://docs.randomlabs.ai/en/using-slate/hotkey_reference
