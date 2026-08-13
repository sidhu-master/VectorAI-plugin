import { describe, expect, it } from 'vitest';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import { GroundingLedger } from './ledger.js';
import type {
  GroundingEvidenceEvent,
  SemanticEntityHypothesis,
} from './types.js';

describe('GroundingLedger', () => {
  it('folds support deltas without replaying removed or superseded supports', () => {
    const ledger = createLedger();
    ledger.append(proposed('event_1', hypothesis('entity_arm', [
      support('span_upper', 'boundary'),
      support('span_lower', 'boundary'),
      support('span_body', 'context'),
    ])));
    ledger.append({
      ...baseEvent('event_2', 'entity_arm', 'refined'),
      supportDelta: {
        added: [],
        removed: ['span_body'],
      },
      evidenceRefs: ['pick:overlay_2'],
      reasonCode: 'MODEL_EXCLUDED_CONTEXT',
    });

    expect(ledger.current('entity_arm')).toMatchObject({
      status: 'active',
      hypothesis: {
        id: 'entity_arm',
        supports: [
          expect.objectContaining({ ref: 'span_upper' }),
          expect.objectContaining({ ref: 'span_lower' }),
        ],
      },
    });
    expect(ledger.current('entity_arm')?.hypothesis.supports).toHaveLength(2);
  });

  it('returns only new evidence and changed current hypotheses after a cursor', () => {
    const ledger = createLedger();
    const first = ledger.append(proposed('event_1', hypothesis('entity_arm', [
      support('span_upper', 'boundary'),
    ])));
    ledger.append({
      ...baseEvent('event_2', 'entity_arm', 'selected'),
      evidenceRefs: ['observation:detail_1'],
      reasonCode: 'MODEL_SELECTED_CANDIDATE',
    });

    const delta = ledger.deltaSince(first.cursor);

    expect(delta.events.map((event) => event.id)).toEqual(['event_2']);
    expect(delta.current).toEqual([
      expect.objectContaining({ hypothesisId: 'entity_arm', status: 'selected' }),
    ]);
    expect(delta.nextCursor).toBe(2);
  });

  it('links replacement hypotheses without silently retaining the old candidate as active', () => {
    const ledger = createLedger();
    ledger.append(proposed('event_1', hypothesis('entity_old', [
      support('span_body', 'boundary'),
    ])));
    ledger.append(proposed('event_2', {
      ...hypothesis('entity_arm', [support('span_upper', 'boundary')]),
      supersedes: ['entity_old'],
    }));

    expect(ledger.current('entity_old')?.status).toBe('superseded');
    expect(ledger.current('entity_arm')).toMatchObject({
      status: 'active',
      hypothesis: { supersedes: ['entity_old'] },
    });
  });

  it('rejects cross-revision evidence instead of mixing stale grounding into the episode', () => {
    const ledger = createLedger();
    const stale = proposed('event_stale', hypothesis('entity_arm', []));
    stale.revision = 'revision_other' as RevisionId;

    expect(() => ledger.append(stale)).toThrow(/GROUNDING_SCOPE_MISMATCH/);
    expect(ledger.events()).toEqual([]);
  });

  it('rejects duplicate event IDs so replay remains deterministic', () => {
    const ledger = createLedger();
    const event = proposed('event_duplicate', hypothesis('entity_arm', []));
    ledger.append(event);
    expect(() => ledger.append(event)).toThrow(/GROUNDING_EVENT_DUPLICATE/);
  });
});

function createLedger(): GroundingLedger {
  return new GroundingLedger({
    episodeId: 'episode_1',
    drawingId: 'drawing_1' as DrawingId,
    revision: 'revision_1' as RevisionId,
  });
}

function baseEvent(
  id: string,
  hypothesisId: string,
  kind: GroundingEvidenceEvent['kind'],
): GroundingEvidenceEvent {
  return {
    id,
    episodeId: 'episode_1',
    drawingId: 'drawing_1' as DrawingId,
    revision: 'revision_1' as RevisionId,
    hypothesisId,
    kind,
    evidenceRefs: [],
    reasonCode: 'TEST_EVIDENCE',
    createdAt: 1,
  };
}

function proposed(id: string, value: SemanticEntityHypothesis): GroundingEvidenceEvent {
  return {
    ...baseEvent(id, value.id, 'proposed'),
    hypothesis: value,
    evidenceRefs: ['observation:overview_1'],
    reasonCode: 'CANDIDATE_PROPOSED',
  };
}

function hypothesis(
  id: string,
  supports: SemanticEntityHypothesis['supports'],
): SemanticEntityHypothesis {
  return {
    id,
    drawingId: 'drawing_1' as DrawingId,
    revision: 'revision_1' as RevisionId,
    label: 'candidate part',
    referringExpression: 'target part',
    observationRefs: ['observation:overview_1'],
    regionRefs: [],
    supports,
    excludedSupports: [],
    interfaceRefs: [],
    confidence: 0.8,
    provenance: {
      provider: 'test',
      evidenceRefs: ['observation:overview_1'],
      createdAt: 1,
    },
  };
}

function support(
  ref: string,
  role: SemanticEntityHypothesis['supports'][number]['role'],
): SemanticEntityHypothesis['supports'][number] {
  return { kind: 'source-span', ref, weight: 1, role };
}
