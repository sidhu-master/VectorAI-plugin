// SPDX-License-Identifier: Apache-2.0

import type { PartitionDraft } from '@vectorai/engineering-annotation';
import { describe, expect, it } from 'vitest';
import { resolveShaftGdtRules } from './shaft-gdt-rules';

describe('shaft GD&T functional rules', () => {
  it('derives the minimum control set from functional roles instead of sample coordinates', () => {
    const partition = genericPartition([
      feature('support-west', 12, 31, 'bearing', '支承甲', 'document'),
      feature('coupling', 39, 68, 'spline', '传动连接', 'document'),
      feature('drive', 117, 181, 'gear', '旋转输出', 'manual'),
      feature('support-east', 203, 227, 'bearing-seat', '支承乙', 'document'),
    ]);

    const result = resolveShaftGdtRules(partition);

    expect(result.status).toBe('resolved');
    expect(result.questions).toEqual([]);
    expect(result.recommendation.datums).toHaveLength(2);
    expect(result.recommendation.controls.map(({ characteristic }) => characteristic).sort()).toEqual([
      'circular-runout', 'circular-runout',
      'circularity', 'circularity',
      'cylindricity', 'cylindricity',
      'total-runout', 'total-runout',
    ].sort());
    expect(result.recommendation.controls.some(({ characteristic }) => (
      characteristic === 'coaxiality' || characteristic === 'perpendicularity' || characteristic === 'symmetry'
    ))).toBe(false);
    expect(result.recommendation.surfaceTextures).toEqual([
      expect.objectContaining({
        segmentIds: ['support-west'], parameter: 'Ra', value: 0.8,
        materialRemoval: 'required', source: 'process-rule',
      }),
      expect.objectContaining({
        segmentIds: ['support-east'], parameter: 'Ra', value: 0.8,
        materialRemoval: 'required', source: 'process-rule',
      }),
    ]);
  });

  it('asks the user instead of using a low-confidence functional classification', () => {
    const partition = genericPartition([
      feature('support-west', 5, 21, 'bearing', '左支承', 'document'),
      feature('uncertain-support', 88, 109, 'bearing', '疑似右支承', 'ai', 0.71),
      feature('drive', 43, 76, 'gear', '齿轮段', 'document'),
    ]);

    const result = resolveShaftGdtRules(partition);

    expect(result.status).toBe('needs-user-input');
    expect(result.questions).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'GDT_FEATURE_CONFIDENCE_LOW', segmentIds: ['uncertain-support'] }),
      expect.objectContaining({ code: 'GDT_AXIS_SUPPORT_PAIR_REQUIRED' }),
    ]));
    expect(result.recommendation.controls.some(({ characteristic }) => characteristic.includes('runout'))).toBe(false);
  });

  it('does not invent a common datum axis when only one support is known', () => {
    const partition = genericPartition([
      feature('support-only', 10, 30, 'bearing', '唯一支承', 'manual'),
      feature('drive', 50, 90, 'gear', '旋转功能段', 'document'),
    ]);

    const result = resolveShaftGdtRules(partition);

    expect(result.status).toBe('needs-user-input');
    expect(result.questions).toEqual([
      expect.objectContaining({ code: 'GDT_AXIS_SUPPORT_PAIR_REQUIRED' }),
    ]);
    expect(result.recommendation.datums).toEqual([]);
    expect(result.recommendation.controls.map(({ characteristic }) => characteristic).sort()).toEqual([
      'circularity', 'cylindricity',
    ]);
    expect(result.recommendation.surfaceTextures).toEqual([
      expect.objectContaining({ segmentIds: ['support-only'], parameter: 'Ra', value: 0.8 }),
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
