// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { resolveShaftGdtRules, type ShaftEngineeringRequirement } from './shaft-gdt-rules';

describe('shaft GD&T evidence boundary', () => {
  it('derives a complete preview set from high-confidence functional features', () => {
    const partition = genericPartition([
      feature('support-west', 12, 31, 'bearing-seat', '支承甲', 'document'),
      feature('drive', 117, 181, 'gear', '旋转输出', 'manual'),
      feature('support-east', 203, 227, 'bearing-seat', '支承乙', 'document'),
    ]);

    const result = resolveShaftGdtRules(partition);

    expect(result.status).toBe('resolved');
    expect(result.questions).toEqual([]);
    expect(result.recommendation.datums).toHaveLength(2);
    expect(result.recommendation.datums.map(({ segmentId }) => segmentId)).toEqual(['support-west', 'support-east']);
    expect(result.recommendation.controls).toEqual(expect.arrayContaining([
      expect.objectContaining({ characteristic: 'total-runout', segmentIds: ['support-west'], datumNames: ['A', 'B'] }),
      expect.objectContaining({ characteristic: 'circular-runout', segmentIds: ['drive'], datumNames: ['A', 'B'] }),
      expect.objectContaining({ characteristic: 'total-runout', segmentIds: ['support-east'], datumNames: ['A', 'B'] }),
    ]));
    expect(result.recommendation.surfaceTextures).toHaveLength(2);
  });

  it('emits only controls backed by documented requirements', () => {
    const partition = genericPartition([
      feature('support-west', 12, 31, 'bearing-seat', '支承甲', 'document'),
      feature('drive', 117, 181, 'gear', '旋转输出', 'manual'),
      feature('support-east', 203, 227, 'bearing-seat', '支承乙', 'document'),
    ]);
    const requirements: ShaftEngineeringRequirement[] = [
      {
        kind: 'datum', id: 'req:datum-a', name: 'A', role: 'primary', segmentId: 'support-west',
        decisionAuthority: 'documented-requirement', evidenceIds: ['doc:datum-axis'], confidence: 0.99,
      },
      {
        kind: 'datum', id: 'req:datum-b', name: 'B', role: 'secondary', segmentId: 'support-east',
        decisionAuthority: 'documented-requirement', evidenceIds: ['doc:datum-axis'], confidence: 0.99,
      },
      {
        kind: 'geometric-control', id: 'req:drive-runout', characteristic: 'total-runout',
        segmentIds: ['drive'], datumNames: ['A', 'B'], toleranceZoneShape: 'linear',
        decisionAuthority: 'documented-requirement', evidenceIds: ['doc:drive-runout'], confidence: 0.97,
      },
      {
        kind: 'surface-texture', id: 'req:support-ra', segmentIds: ['support-west'], parameter: 'Ra', value: 0.8,
        materialRemoval: 'required', decisionAuthority: 'documented-requirement',
        evidenceIds: ['doc:support-finish'], confidence: 0.98,
        ruleRef: { id: 'document:surface-finish', version: '1' },
      },
    ];

    const result = resolveShaftGdtRules(partition, [], requirements);

    expect(result.status).toBe('resolved');
    expect(result.questions).toEqual([]);
    expect(result.recommendation.datums).toEqual([
      expect.objectContaining({ name: 'A', segmentId: 'support-west', decisionAuthority: 'documented-requirement', evidenceIds: ['doc:datum-axis'] }),
      expect.objectContaining({ name: 'B', segmentId: 'support-east', decisionAuthority: 'documented-requirement', evidenceIds: ['doc:datum-axis'] }),
    ]);
    expect(result.recommendation.controls).toEqual([
      expect.objectContaining({ id: 'req:drive-runout', characteristic: 'total-runout', segmentIds: ['drive'], datumNames: ['A', 'B'], decisionAuthority: 'documented-requirement', evidenceIds: ['doc:drive-runout'] }),
    ]);
    expect(result.recommendation.surfaceTextures).toEqual([
      expect.objectContaining({ id: 'req:support-ra', segmentIds: ['support-west'], value: 0.8, decisionAuthority: 'documented-requirement', evidenceIds: ['doc:support-finish'] }),
    ]);
  });

  it('does not commit an unconfirmed AI recommendation', () => {
    const partition = genericPartition([feature('support', 12, 31, 'bearing-seat', '支承', 'document')]);
    const requirements: ShaftEngineeringRequirement[] = [{
      kind: 'surface-texture', id: 'ai:finish', segmentIds: ['support'], parameter: 'Ra', value: 0.8,
      materialRemoval: 'required', decisionAuthority: 'ai-recommendation', evidenceIds: ['ai:review'], confidence: 0.91,
    }];

    const result = resolveShaftGdtRules(partition, [], requirements);

    expect(result.status).toBe('needs-user-input');
    expect(result.recommendation.surfaceTextures).toEqual([]);
    expect(result.questions).toEqual([
      expect.objectContaining({ code: 'GDT_RECOMMENDATION_CONFIRMATION_REQUIRED', segmentIds: ['support'] }),
    ]);
  });
});

function genericPartition(values: ReturnType<typeof feature>[]): PartitionDraft {
  const segments = values.map(({ group: _group, origin: _origin, ...segment }) => segment);
  const semanticGroups = values.map(({ group, origin: _origin }) => group);
  return {
    version: 1,
    drawingRef: { drawingId: 'generic-functional-shaft', revision: 9 },
    axis: { origin: [17, -3], direction: [1, 0], normal: [0, 1], zMin: 0, zMax: 240, orientation: 'forward' },
    segments,
    semanticGroups,
    stepCandidates: [],
    evidence: values.map(({ group, origin }) => ({ id: group.evidenceIds[0]!, origin, label: group.name ?? group.semanticType })),
    diagnostics: [],
  };
}

function feature(
  id: string,
  zStart: number,
  zEnd: number,
  semanticType: string,
  name: string,
  origin: 'document' | 'manual' | 'ai',
  semanticConfidence = 0.95,
) {
  const evidenceId = `${origin}:${id}`;
  return {
    id,
    zStart,
    zEnd,
    semanticType,
    name,
    semanticConfidence,
    profile: { minRadius: 8, maxRadius: 8, sampleCount: 3 },
    boundaryConfidence: 0.92,
    geometryNodeIds: [`geometry:${id}`],
    boundaryEvidenceIds: [],
    semanticEvidenceIds: [evidenceId],
    diagnosticIds: [],
    origin,
    group: {
      id: `group:${id}`,
      segmentIds: [id],
      range: { zStart, zEnd },
      semanticType,
      name,
      evidenceIds: [evidenceId],
    },
  };
}
