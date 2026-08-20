import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { HumanDecisionRequest } from '@/contracts/drawing-agent';
import HumanDecisionCard from './HumanDecisionCard';

const request: HumanDecisionRequest = {
  id: 'decision_1', episodeId: 'episode_1', revision: 'revision_1' as never,
  kind: 'grant-permission',
  question: '是否允许当前候选修改受保护内容？',
  reason: '这次修改需要解除一个已有约束，授权只对当前候选生效。',
  options: [{ id: 'allow_once', label: '仅允许本次' }, { id: 'deny', label: '不允许' }],
  recommendedOptionId: 'allow_once',
  affectedResources: [{ plane: 'relation', ids: ['constraint_1'], action: 'constraint.delete' }],
  previewHandle: 'preview_1', expiresWhenRevisionChanges: true,
};

describe('HumanDecisionCard', () => {
  it('shows the generic question, reason, affected resources, recommendation and feedback field', () => {
    const html = renderToStaticMarkup(
      <HumanDecisionCard request={request} submitting={false} onRespond={() => undefined} />,
    );

    expect(html).toContain('是否允许当前候选修改受保护内容？');
    expect(html).toContain('仅允许本次');
    expect(html).toContain('推荐');
    expect(html).toContain('relation');
    expect(html).toContain('constraint_1');
    expect(html).toContain('补充说明（可选）');
    expect(html).not.toContain('model');
    expect(html).not.toContain('reasoning');
  });
});
