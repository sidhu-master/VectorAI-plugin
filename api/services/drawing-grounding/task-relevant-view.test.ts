import { describe, expect, it } from 'vitest';

import type { DrawingId, RevisionId } from '../../../src/drawing/index.js';
import { createTaskRelevantView } from './task-relevant-view.js';
import type { SemanticEntityHypothesis } from './types.js';

describe('createTaskRelevantView', () => {
  it('projects task-selected temporary relations without mutating hypotheses', () => {
    const hypotheses = [
      hypothesis('entity_upper', 'upper contour', 'span_upper'),
      hypothesis('entity_lower', 'lower contour', 'span_lower'),
      hypothesis('entity_part', 'target part', 'span_upper'),
    ];
    const before = structuredClone(hypotheses);

    const view = createTaskRelevantView({
      episodeId: 'episode_1',
      drawingId: 'drawing_1' as DrawingId,
      revision: 'revision_1' as RevisionId,
      goalDigest: 'sha256:goal_a',
      hypotheses,
      entityIds: ['entity_upper', 'entity_lower', 'entity_part'],
      relations: [
        {
          kind: 'part-of',
          from: 'entity_upper',
          to: 'entity_part',
          confidence: 0.9,
          evidenceRefs: ['model:choice_1'],
        },
        {
          kind: 'part-of',
          from: 'entity_lower',
          to: 'entity_part',
          confidence: 0.9,
          evidenceRefs: ['model:choice_1'],
        },
      ],
      abstraction: 'part',
      evidenceRefs: ['model:choice_1'],
    });

    expect(view).toMatchObject({
      episodeId: 'episode_1',
      goalDigest: 'sha256:goal_a',
      abstraction: 'part',
      entities: [
        expect.objectContaining({ id: 'entity_upper' }),
        expect.objectContaining({ id: 'entity_lower' }),
        expect.objectContaining({ id: 'entity_part' }),
      ],
      relations: [
        expect.objectContaining({ kind: 'part-of', from: 'entity_upper', to: 'entity_part' }),
        expect.objectContaining({ kind: 'part-of', from: 'entity_lower', to: 'entity_part' }),
      ],
    });
    expect(hypotheses).toEqual(before);
  });

  it('allows the same geometric supports to be grouped differently for another task', () => {
    const hypotheses = [
      hypothesis('entity_upper', 'upper contour', 'span_shared'),
      hypothesis('entity_outline', 'outer contour', 'span_shared'),
    ];
    const partView = createTaskRelevantView({
      ...scope('sha256:part_goal'),
      hypotheses,
      entityIds: ['entity_upper'],
      relations: [],
      abstraction: 'part',
      evidenceRefs: ['model:part_choice'],
    });
    const outlineView = createTaskRelevantView({
      ...scope('sha256:outline_goal'),
      hypotheses,
      entityIds: ['entity_outline'],
      relations: [],
      abstraction: 'object',
      evidenceRefs: ['model:outline_choice'],
    });

    expect(partView.entities[0].supports[0].ref).toBe('span_shared');
    expect(outlineView.entities[0].supports[0].ref).toBe('span_shared');
    expect(partView.id).not.toBe(outlineView.id);
    expect(partView.entities.map((entity) => entity.id)).toEqual(['entity_upper']);
    expect(outlineView.entities.map((entity) => entity.id)).toEqual(['entity_outline']);
  });

  it('rejects dangling semantic relations and cross-revision candidates', () => {
    const valid = hypothesis('entity_a', 'candidate', 'span_a');
    expect(() => createTaskRelevantView({
      ...scope('sha256:goal'),
      hypotheses: [valid],
      entityIds: ['entity_a'],
      relations: [{
        kind: 'part-of',
        from: 'entity_a',
        to: 'missing',
        confidence: 1,
        evidenceRefs: [],
      }],
      abstraction: 'part',
      evidenceRefs: [],
    })).toThrow(/TASK_VIEW_DANGLING_RELATION/);

    expect(() => createTaskRelevantView({
      ...scope('sha256:goal'),
      hypotheses: [{ ...valid, revision: 'revision_other' as RevisionId }],
      entityIds: ['entity_a'],
      relations: [],
      abstraction: 'part',
      evidenceRefs: [],
    })).toThrow(/TASK_VIEW_SCOPE_MISMATCH/);
  });
});

function scope(goalDigest: string) {
  return {
    episodeId: 'episode_1',
    drawingId: 'drawing_1' as DrawingId,
    revision: 'revision_1' as RevisionId,
    goalDigest,
  };
}

function hypothesis(
  id: string,
  label: string,
  supportRef: string,
): SemanticEntityHypothesis {
  return {
    id,
    drawingId: 'drawing_1' as DrawingId,
    revision: 'revision_1' as RevisionId,
    label,
    referringExpression: label,
    observationRefs: [],
    regionRefs: [],
    supports: [{
      kind: 'source-span',
      ref: supportRef,
      weight: 1,
      role: 'boundary',
    }],
    excludedSupports: [],
    interfaceRefs: [],
    confidence: 0.8,
    provenance: { provider: 'test', evidenceRefs: [], createdAt: 1 },
  };
}
