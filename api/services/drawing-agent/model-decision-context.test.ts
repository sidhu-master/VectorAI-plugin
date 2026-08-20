import { describe, expect, it } from 'vitest';

import { createModelDecisionContext } from './model-decision-context.js';

describe('createModelDecisionContext', () => {
  it('creates a compact initial decision context from computed evidence', () => {
    expect(createModelDecisionContext({
      sequence: 1,
      phase: 'initial',
      reason: 'initial-world-state',
      evidenceRefs: ['world:sha256:abc', 'observation:overview'],
      diagnosticCodes: [],
    })).toMatchObject({
      sequence: 1,
      phase: 'initial',
      evidenceDelta: { evidenceRefs: ['world:sha256:abc', 'observation:overview'] },
    });
  });

  it('requires a reason and genuinely non-empty evidence for every extra decision', () => {
    expect(() => createModelDecisionContext({
      sequence: 2,
      phase: 'tool-evidence',
      reason: '',
      evidenceRefs: ['e1'],
      diagnosticCodes: [],
    })).toThrow(/ESCALATION_REASON_REQUIRED/);
    expect(() => createModelDecisionContext({
      sequence: 2,
      phase: 'tool-evidence',
      reason: 'tool-result',
      evidenceRefs: [],
      diagnosticCodes: [],
    })).toThrow(/ESCALATION_EVIDENCE_REQUIRED/);
  });

  it('deduplicates evidence and binds an escalation digest to its reason', () => {
    const context = createModelDecisionContext({
      sequence: 2,
      phase: 'preview-review',
      reason: 'preview-generated',
      evidenceRefs: ['e2', 'e2', 'diagnostic:NEW_DANGLING_ENDPOINT'],
      diagnosticCodes: ['NEW_DANGLING_ENDPOINT'],
    });

    expect(context).toMatchObject({
      sequence: 2,
      phase: 'preview-review',
      escalationReason: 'preview-generated',
      evidenceDelta: {
        evidenceRefs: ['e2', 'diagnostic:NEW_DANGLING_ENDPOINT'],
        diagnosticCodes: ['NEW_DANGLING_ENDPOINT'],
        digest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
      },
    });
  });
});
