import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { extractDesignResearchContract } from './helpers/skill-fixture';
import { expectAbsent, expectMentions } from './helpers/prompt-structure';
const source = readFileSync(new URL('../design-consultation/SKILL.md', import.meta.url), 'utf8');

test('research-only fixture supplies actual readiness and egress dependencies without expanding scope', () => {
  const contract = extractDesignResearchContract(source);
  expect(contract.match(/console\.log\("ASIDE_READY /g)).toHaveLength(1);
  expect(contract).toContain('GSTACK_SKIP_ASIDE');
  expectMentions(contract, [['Phase 0', 'BROWSER SETUP', '再利用']], 'contract');
  expect(contract).toContain('_gstack_egress_run open aside-agent');
  expect(contract.indexOf('ASIDE_READY')).toBeLessThan(contract.indexOf('## Web research runs in Aside'));
  expectAbsent(contract, ['## Phase 2: 調査', '**Step 2: 視覚的な調査'], 'contract');
  expect(contract).not.toContain('best websites {current year}');
  expect(contract).not.toContain('DESIGN.md');
  expect(extractDesignResearchContract(source.replace('ASIDE_READY', 'PROBE_CHANGED'))).toContain('PROBE_CHANGED');
});

test.each(['## BROWSER SETUP', '### 実際のブラウザを操作するためのルール', '## Web research runs in Aside',
  '## Phase 2: 調査', '**Step 1: Aside で', '**Step 2: 視覚的な調査', '_aside_exec()'])('missing %s fails closed before a paid run', marker => {
  expect(() => extractDesignResearchContract(source.replace(marker, 'REMOVED'))).toThrow();
});
