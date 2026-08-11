import { describe, expect, it } from 'vitest';

import {
  parseEditIntent,
  parseVisualFeatureGraph,
} from './drawing-spatial-agent';

describe('drawing spatial-agent protocol', () => {
  it('parses a grounded local-redraw intent without allowing Drawing commands', () => {
    const intent = parseEditIntent({
      operation: 'local-redraw',
      targetFeatureIds: ['right_hand'],
      targetNodeIds: ['hand_line'],
      anchors: [{ nodeId: 'arm_line', role: 'wrist', point: [30, 20] }],
      preserveNodeIds: ['body'],
      preserveRules: [{ type: 'outside-target-unchanged' }],
      desiredRelations: [{ type: 'connected', from: 'arm_line', to: 'hand_line' }],
      confidence: 0.91,
      evidenceRefs: ['view_detail'],
    }, {
      allowedNodeIds: ['hand_line', 'arm_line', 'body'],
      allowedFeatureIds: ['right_hand'],
      allowedEvidenceRefs: ['view_detail'],
    });

    expect(intent).toMatchObject({ operation: 'local-redraw', confidence: 0.91 });
    expect(intent.anchors[0]).toEqual({ nodeId: 'arm_line', role: 'wrist', point: [30, 20] });
  });

  it('parses a feature graph grounded in observed node and view ids', () => {
    const graph = parseVisualFeatureGraph({
      features: [{
        id: 'right_hand', label: '右手', nodeIds: ['hand_line'],
        bounds: { minX: 20, minY: 10, maxX: 40, maxY: 30 },
        confidence: 0.88, evidenceRefs: ['view_detail'],
      }],
      anchors: [{
        id: 'wrist', nodeId: 'arm_line', role: 'wrist', point: [30, 20],
        confidence: 0.9, evidenceRefs: ['view_detail'],
      }],
      relations: [{ type: 'connected', from: 'arm_line', to: 'hand_line', confidence: 0.86 }],
    }, {
      allowedNodeIds: ['hand_line', 'arm_line'],
      allowedEvidenceRefs: ['view_detail'],
    });

    expect(graph.features[0]).toMatchObject({ id: 'right_hand', nodeIds: ['hand_line'] });
  });

  it.each([
    ['invented node', {
      operation: 'transform', targetFeatureIds: ['right_hand'], targetNodeIds: ['invented'],
      anchors: [], preserveNodeIds: [], preserveRules: [], desiredRelations: [],
      confidence: 0.8, evidenceRefs: ['view_detail'],
    }, 'intent.targetNodeIds[0]'],
    ['low-level command payload', {
      operation: 'transform', targetFeatureIds: [], targetNodeIds: ['hand_line'],
      anchors: [], preserveNodeIds: [], preserveRules: [], desiredRelations: [],
      confidence: 0.8, evidenceRefs: ['view_detail'], commands: [{ type: 'geometry.delete' }],
    }, 'intent.commands'],
  ])('rejects %s', (_name, value, path) => {
    expect(() => parseEditIntent(value, {
      allowedNodeIds: ['hand_line'],
      allowedFeatureIds: ['right_hand'],
      allowedEvidenceRefs: ['view_detail'],
    })).toThrow(expect.objectContaining({ path }));
  });
});
