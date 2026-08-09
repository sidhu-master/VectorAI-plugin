import { describe, expect, it } from 'vitest';

import { MemoryObservationSlotStore } from './slot-store.js';

describe('MemoryObservationSlotStore', () => {
  it('joins two crop observations into one stable full-circle slot', () => {
    const slots = new MemoryObservationSlotStore();
    const partial = slots.observe({
      sourceId: 'source_test1',
      evidence: evidence('evidence_left', true),
      candidateTypes: [{ type: 'circle', score: 0.7 }],
    });
    const completed = slots.observe({
      sourceId: 'source_test1',
      evidence: evidence('evidence_right', false),
      candidateTypes: [{ type: 'circle', score: 0.96 }],
    }, { preferredSlotId: partial.id });

    expect(completed.id).toBe(partial.id);
    expect(completed.evidenceRefs).toEqual(['evidence_left', 'evidence_right']);
    expect(completed.revision).toBe(2);
  });

  it('does not confirm a closed primitive from crop-edge evidence alone', () => {
    const slots = new MemoryObservationSlotStore();
    const partial = slots.observe({
      sourceId: 'source_test1',
      evidence: evidence('evidence_partial', true),
      candidateTypes: [{ type: 'circle', score: 0.99 }],
    });

    expect(() => slots.confirm(partial.id)).toThrow('SLOT_CLOSED_PRIMITIVE_PARTIAL');
    const confirmed = slots.confirm(partial.id, { wholeObjectValidated: true });
    expect(confirmed.status).toBe('committed');
  });

  it('records retype, merge, and split lineage without changing source identity', () => {
    const slots = new MemoryObservationSlotStore();
    const circle = slots.observe({
      sourceId: 'source_test1', evidence: evidence('evidence_circle', false),
      candidateTypes: [{ type: 'circle', score: 0.8 }],
    });
    const line = slots.observe({
      sourceId: 'source_test1', evidence: evidence('evidence_line', false),
      candidateTypes: [{ type: 'line', score: 0.9 }],
    });

    const retyped = slots.recordDrawingChange(circle.id, {
      action: 'retype', removedDrawingEntityIds: ['circle_1'], addedDrawingEntityIds: ['arc_1'],
    });
    const merged = slots.merge([retyped.id, line.id], {
      evidence: evidence('evidence_joined', false), candidateTypes: [{ type: 'polyline', score: 0.95 }],
    });
    const split = slots.split(merged.id, [
      { evidence: evidence('evidence_split_a', false), candidateTypes: [{ type: 'line', score: 0.9 }] },
      { evidence: evidence('evidence_split_b', false), candidateTypes: [{ type: 'arc', score: 0.9 }] },
    ]);

    expect(retyped.lineage.at(-1)).toMatchObject({ action: 'retype' });
    expect(merged.lineage.at(-1)).toMatchObject({ action: 'merge', parentSlotIds: [circle.id, line.id] });
    expect(split).toHaveLength(2);
    expect(split.every((slot) => slot.lineage.at(-1)?.action === 'split')).toBe(true);
    expect(split.every((slot) => slot.sourceId === 'source_test1')).toBe(true);
  });
});

function evidence(handle: string, touchesRegionEdge: boolean) {
  return {
    handle,
    kind: 'contour' as const,
    bounds: { x: 10, y: 10, width: 40, height: 40 },
    confidence: 0.9,
    touchesRegionEdge,
  };
}
