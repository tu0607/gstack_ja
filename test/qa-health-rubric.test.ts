import { describe, expect, test } from 'bun:test';
import { generateQAMethodology } from '../scripts/resolvers/utility';
import { HOST_PATHS } from '../scripts/resolvers/types';

const methodology = generateQAMethodology({
  skillName: 'qa', tmplPath: '', host: 'claude', paths: HOST_PATHS.claude,
});
const rubric = methodology.split('## Health Score Rubric')[1].split('## フレームワーク別のガイダンス')[0];

describe('QA health rubric scoring contract', () => {
  test('console bands have no overlapping boundary at ten errors', () => {
    expect(rubric).toContain('4-10 errors');
    expect(rubric).toContain('11+ errors');
    expect(rubric).not.toContain('10+ errors');
    expect(rubric).toContain('警告、情報、および他で採点された欠陥は除外します');
  });

  test('defines severity, categories, and duplicate handling', () => {
    for (const severity of ['Critical', 'High', 'Medium', 'Low']) {
      expect(rubric).toContain(`**${severity}:**`);
    }
    expect(rubric).toContain('1 つの主カテゴリ');
    expect(rubric).toContain('同じ根本原因');
    expect(rubric).toContain('クライアントサイドのルート');
  });

  test('defines partial coverage and weighted rounding', () => {
    expect(rubric).toContain('**未テスト**');
    expect(rubric).toContain('**暫定**');
    expect(rubric).toContain('15% = 0.15');
    expect(rubric).toContain('丸めるのは最終スコアだけ');
  });
});
