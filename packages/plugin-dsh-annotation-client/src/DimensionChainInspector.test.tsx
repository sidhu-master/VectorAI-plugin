// SPDX-License-Identifier: Apache-2.0

import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { DimensionChainInspector } from './DimensionChainInspector';

describe('DimensionChainInspector', () => {
  it('shows evidence conflict and lets the user choose an alternative closure', async () => {
    const chooseClosure = vi.fn(async () => undefined);
    const scheme = {
      topology: { unit: 'mm' },
      candidates: [
        { id: 'parent', nominalValue: 100, evidenceIds: [] },
        { id: 'child', nominalValue: 77, evidenceIds: [] },
        { id: 'closure', nominalValue: 23, evidenceIds: ['document:1'] },
        { id: 'alternative', nominalValue: 20, evidenceIds: [] },
      ],
      evidence: [{ id: 'document:1', label: '目标文档尺寸', origin: 'document' }],
      displayedCandidateIds: ['parent', 'child'], closureCandidateIds: ['closure'],
      chains: [{ id: 'chain:root', parentCandidateId: 'parent', childCandidateIds: ['child'], closureCandidateId: 'closure', alternativeClosureCandidateIds: ['alternative'], status: 'needs-review' }],
      diagnostics: [{ id: 'd', code: 'DIMENSION_DOCUMENT_DISPLAY_CONFLICT', message: 'conflict' }],
      status: 'needs-review',
    } as never;
    const controller = { actions: { chooseClosure, setDisplayed: vi.fn() } } as never;
    const root = create(<DimensionChainInspector scheme={scheme} controller={controller} />).root;

    expect(root.findByProps({ children: '文档与目标标注冲突' })).toBeDefined();
    await act(async () => root.findByProps({ 'aria-label': '选择候选闭环 20 mm' }).props.onClick());
    expect(chooseClosure).toHaveBeenCalledWith('chain:root', 'alternative');
  });
});
