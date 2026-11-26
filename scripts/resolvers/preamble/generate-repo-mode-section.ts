

export function generateRepoModeSection(): string {
  return `## リポジトリの所有権 — 気づいたら声に出す

\`REPO_MODE\` は、ブランチ外の問題をどう扱うかを制御します:
- **\`solo\`** — すべてがあなたの担当です。調査し、積極的に修正を提案してください。
- **\`collaborative\`** / **\`unknown\`** — AskUserQuestion で知らせ、修正はしません(他の人の担当の可能性があるため)。

おかしいと思うものは必ず知らせてください。気づいた内容と影響を一文で伝えます。`;
}

