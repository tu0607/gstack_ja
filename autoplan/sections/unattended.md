<!-- AUTO-GENERATED from unattended.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->
## 無人実行のプロファイル

`SESSION_KIND: unattended`: 親が `~/.claude/skills/gstack/bin/gstack-autoplan` (`next`/`submit`/`answer --gate-rev`/
`export`; docs/unattended.md) を通じて実行を駆動し、成果物を読みます。散文は読みません。フェーズは自分で閉じ、エンジニアリングは最後に実行し、
外部の voice は `gstack-outside-voice` を通じて実行します。実行は `status=gate_pending` で止まります。決して承認しないでください。`gstack-artifact
validate <dir>/run.json` が完了の確認です。最後は
`GSTACK_RESULT: skill=autoplan status=<status> run=<dir>` で終えてください。
