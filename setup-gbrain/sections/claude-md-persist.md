<!-- AUTO-GENERATED from claude-md-persist.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
セクションを検索して置換する(または末尾に追記する)。ブロックの形式はモードによって異なります:

### Path 4(リモート MCP)

```markdown
## GBrain Configuration (configured by /setup-gbrain)
- Mode: remote-http
- MCP URL: {MCP_URL}
- Server version: gbrain v{SERVER_VERSION}  (from Step 4c verify)
- Setup date: {today}
- MCP registered: yes (user scope)
- Token: stored in ~/.claude.json (do not commit; never written to CLAUDE.md)
- Artifacts repo: {gstack_artifacts_remote URL or "none"}
- Artifacts sync: {off|artifacts-only|full}
- Current repo policy: {read-write|read-only|deny|unset}
```

ベアラートークンは **決して** CLAUDE.md に書き込まないでください(多くのプロジェクトでは CLAUDE.md が git にチェックインされます)。トークンは、`claude mcp add` が配置した `~/.claude.json` にのみ存在します。

### Paths 1、2a、2b、3(ローカル stdio)

```markdown
## GBrain Configuration (configured by /setup-gbrain)
- Mode: local-stdio
- Engine: {pglite|postgres}
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: {today}
- MCP registered: {yes/no}
- Artifacts sync: {off|artifacts-only|full}
- Current repo policy: {read-write|read-only|deny|unset}
```

ここに `## GBrain Search Guidance` のブロックは書き込まないでください。書き込みを行うのは `/sync-gbrain` だけです。`/sync-gbrain` は、このリポジトリのコードインデックスが応答することを読み取りチェックで確認した後、そのブロックを書き込み、同じ見出しの古いブロックがあれば置き換えます。Step 10 で `/sync-gbrain` の実行を提案します。
