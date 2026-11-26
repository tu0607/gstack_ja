import { sliceBetween } from './skill-fixture';

/** Keep the bounded Code Quality fixture on the real engineering decision path. */
export function sharedLibsPlanExcerpt(entrypoint: string, review: string): string {
  return [
    sliceBetween(entrypoint, '## AskUserQuestion Format', '## Artifacts Sync'),
    sliceBetween(entrypoint, '## 私のエンジニアリングの好み', '## 認知パターン'),
    sliceBetween(review, '## Review record and write policy', '## Prior Learnings'),
    sliceBetween(review, '**プランレビューの根拠:**', '## Decision procedure(決定の手順)'),
    sliceBetween(review, '## Decision procedure(決定の手順)', '## Scope Challenge'),
    sliceBetween(review, '### 2. コード品質のレビュー', '### 3. テストのレビュー'),
    sliceBetween(entrypoint, '**Blocked outcome:**', '## EXIT PLAN MODE GATE'),
  ].join('\n\n');
}
