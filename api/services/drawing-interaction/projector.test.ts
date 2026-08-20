import { describe, expect, it } from 'vitest';

import type {
  DrawingDocument,
  DrawingId,
  GeometryId,
  RevisionId,
} from '../../../src/drawing/index.js';
import type { SemanticEntityHypothesis } from '../drawing-grounding/types.js';
import { WorldModelCompiler } from '../drawing-world-model/compiler.js';
import {
  projectDocumentIntentFrame,
  projectDrawingDeltaFrame,
  projectGroundingFrame,
} from './projector.js';

describe('projectGroundingFrame', () => {
  it('draws only the selected SourceSpan and keeps overlapping exclusions separate', () => {
    const revision = 'revision_interaction_1' as RevisionId;
    const document = crossingLines();
    const world = new WorldModelCompiler().compile(document, revision);
    const targetSpan = world.sourceSpans.find((span) => (
      span.sourceNodeId === 'line_target'
      && span.samples[0][0] === 0
      && span.samples.at(-1)?.[0] === 5
    ));
    const interfaceVertex = world.vertices.find((vertex) => (
      vertex.point[0] === 5 && vertex.point[1] === 0
    ));
    expect(targetSpan).toBeDefined();
    expect(interfaceVertex).toBeDefined();

    const frame = projectGroundingFrame({
      world,
      candidates: [hypothesis({
        revision,
        supportRef: targetSpan!.id,
        excludedRef: 'node:line_crossing',
        interfaceRef: interfaceVertex!.id,
      })],
      selectedCandidateIds: ['entity_target_part'],
    });

    expect(frame).toMatchObject({
      kind: 'spatial',
      phase: 'grounding',
      label: '目标局部',
      strokes: expect.arrayContaining([
        expect.objectContaining({
          ref: targetSpan!.id,
          nodeId: 'line_target',
          role: 'boundary',
          points: [[0, 0], [5, 0]],
        }),
        expect.objectContaining({
          ref: 'node:line_crossing',
          nodeId: 'line_crossing',
          role: 'excluded',
        }),
      ]),
      markers: [expect.objectContaining({
        ref: interfaceVertex!.id,
        role: 'interface',
        point: [5, 0],
      })],
      vectors: [],
    });
    expect(frame.strokes.filter((stroke) => stroke.nodeId === 'line_target')).toHaveLength(1);
    expect(frame.strokes.find((stroke) => stroke.nodeId === 'line_target')?.points)
      .not.toContainEqual([10, 0]);
  });
});

describe('projectDrawingDeltaFrame', () => {
  it('shows an arbitrary Drawing IR edit as exact before/after strokes and a motion vector', () => {
    const before = crossingLines();
    const after = structuredClone(before);
    const moved = after.geometry.find((node) => node.id === 'line_target');
    if (!moved || moved.type !== 'line') throw new Error('fixture line missing');
    moved.start = [0, 4];
    moved.end = [10, 4];

    const frame = projectDrawingDeltaFrame({
      before,
      after,
      changedNodeIds: ['line_target'],
      phase: 'previewing',
      label: '移动候选',
    });

    expect(frame).toMatchObject({
      kind: 'spatial',
      phase: 'previewing',
      label: '移动候选',
      strokes: [
        expect.objectContaining({
          nodeId: 'line_target', role: 'before', points: [[0, 0], [10, 0]],
        }),
        expect.objectContaining({
          nodeId: 'line_target', role: 'after', points: [[0, 4], [10, 4]],
        }),
      ],
      vectors: [{
        id: 'motion:line_target', role: 'motion', from: [5, 0], to: [5, 4],
      }],
    });
  });
});

describe('projectDocumentIntentFrame', () => {
  it('projects the current exact target, destination, and motion before a tool finishes', () => {
    const frame = projectDocumentIntentFrame({
      document: crossingLines(),
      nodeIds: ['line_target'],
      label: '正在移动目标',
      markers: [{ id: 'destination', role: 'target', point: [5, 8] }],
      motions: [{
        id: 'move:line_target', nodeId: 'line_target', from: [0, 0], to: [5, 8],
      }],
    });

    expect(frame).toMatchObject({
      kind: 'spatial',
      phase: 'planning',
      label: '正在移动目标',
      strokes: [expect.objectContaining({
        ref: 'node:line_target',
        nodeId: 'line_target',
        role: 'target',
        points: [[0, 0], [10, 0]],
      })],
      markers: [{ id: 'destination', role: 'target', point: [5, 8] }],
      vectors: [{
        id: 'move:line_target', role: 'motion', from: [0, 0], to: [5, 8],
      }],
    });
  });
});

function hypothesis(input: {
  revision: RevisionId;
  supportRef: string;
  excludedRef: string;
  interfaceRef: string;
}): SemanticEntityHypothesis {
  return {
    id: 'entity_target_part',
    drawingId: 'drawing_interaction' as DrawingId,
    revision: input.revision,
    label: '目标局部',
    referringExpression: '左侧目标局部',
    observationRefs: ['observation_overview'],
    regionRefs: [],
    supports: [{
      kind: 'source-span', ref: input.supportRef, weight: 1, role: 'boundary',
    }],
    excludedSupports: [input.excludedRef],
    interfaceRefs: [input.interfaceRef],
    confidence: 0.91,
    provenance: {
      provider: 'test', evidenceRefs: ['observation_overview'], createdAt: 1,
    },
  };
}

function crossingLines(): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing',
    schemaVersion: '1.0',
    id: 'drawing_interaction' as DrawingId,
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{
      id: 'frame_document', kind: 'document', transform: [1, 0, 0, 1, 0, 0],
    }],
    geometry: [
      {
        id: 'line_target' as GeometryId,
        type: 'line', start: [0, 0], end: [10, 0], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
      },
      {
        id: 'line_crossing' as GeometryId,
        type: 'line', start: [5, -5], end: [5, 5], visible: true,
        quality: { status: 'confirmed', evidenceRefs: [] },
      },
    ],
    annotations: [], relations: [], features: [],
    metadata: { createdAt: 1, updatedAt: 1 },
  };
}
