import { describe, expect, it } from 'vitest';

import {
  assignPartitionMembers,
  pointInPartition,
  partitionToFeature,
  readDrawingPartitions,
  sanitizePartitionPolygon,
  type DrawingPartition,
} from './drawing-partition';
import { createEmptyDrawing, type GeometryId, type GeometryNode, type Vec2 } from '@/drawing';

const ring = (points: number[][]): Vec2[] => points.map(
  (point) => [point[0], point[1]] as Vec2,
);
const gid = (id: string): GeometryId => id as GeometryId;

const quality = { status: 'confirmed' as const, confidence: 0.95, evidenceRefs: [] };
const geometry: GeometryNode[] = [
  { id: gid('line_a'), type: 'line', visible: true, quality, start: [0, 0], end: [10, 0] },
  { id: gid('line_b'), type: 'line', visible: true, quality, start: [20, 0], end: [30, 0] },
  { id: gid('circle_c'), type: 'circle', visible: true, quality, center: [25, 5], radius: 3 },
];

describe('sanitizePartitionPolygon', () => {
  it('removes duplicated closing vertex and keeps the ring open', () => {
    expect(sanitizePartitionPolygon(ring([[0, 0], [10, 0], [10, 10], [0, 0]])))
      .toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it('drops consecutive duplicate points and invalid coordinates', () => {
    expect(sanitizePartitionPolygon(ring([[0, 0], [0, 0], [Number.NaN, 1], [10, 0], [10, 10]])))
      .toEqual([[0, 0], [10, 0], [10, 10]]);
  });

  it('returns null when fewer than 3 valid vertices remain', () => {
    expect(sanitizePartitionPolygon(ring([[0, 0], [10, 0]]))).toBeNull();
    expect(sanitizePartitionPolygon([])).toBeNull();
  });

  it('thins polygons down to the vertex budget', () => {
    const dense = Array.from({ length: 40 }, (_, index) => [index, index % 7] as [number, number]);
    const result = sanitizePartitionPolygon(dense);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(24);
  });
});

describe('pointInPartition', () => {
  const square = ring([[0, 0], [0, 10], [10, 10], [10, 0]]);

  it('classifies inside, outside and boundary points', () => {
    expect(pointInPartition([5, 5], square)).toBe(true);
    expect(pointInPartition([15, 5], square)).toBe(false);
    expect(pointInPartition([0, 5], square)).toBe(true);
  });
});

describe('assignPartitionMembers', () => {
  it('assigns geometry whose bounds center falls inside the polygon', () => {
    const leftPolygon = ring([[-1, -1], [-1, 15], [15, 15], [15, -1]]);
    const rightPolygon = ring([[15, -1], [15, 15], [35, 15], [35, -1]]);
    expect(assignPartitionMembers(geometry, leftPolygon)).toEqual(['line_a']);
    expect(assignPartitionMembers(geometry, rightPolygon)).toEqual(['line_b', 'circle_c']);
  });
});

describe('partition feature round-trip', () => {
  it('persists partitions as semantic features and reads them back in order', () => {
    const document = createEmptyDrawing();
    const partitions: DrawingPartition[] = [
      {
        id: 'partition_1', name: '上台阶区', basis: '台阶以上轮廓',
        polygon: ring([[0, 0], [0, 10], [10, 10], [10, 0]]), colorIndex: 0, order: 0,
        geometryIds: ['line_a'],
      },
      {
        id: 'partition_2', name: '下台阶区', basis: '台阶以下轮廓',
        polygon: ring([[0, 10], [0, 20], [10, 20], [10, 10]]), colorIndex: 1, order: 1,
        geometryIds: [],
      },
    ];
    document.features = partitions.map(partitionToFeature);

    const restored = readDrawingPartitions(document);
    expect(restored.map((partition) => [partition.id, partition.name]))
      .toEqual([
        ['partition_1', '上台阶区'],
        ['partition_2', '下台阶区'],
      ]);
    expect(restored[0].polygon).toEqual(partitions[0].polygon);
    expect(restored[0].geometryIds).toEqual(['line_a']);
  });

  it('ignores malformed partition features instead of throwing', () => {
    const document = createEmptyDrawing();
    document.features = [
      {
        ...partitionToFeature({
          id: 'partition_1', name: '有效分区', basis: '',
          polygon: ring([[0, 0], [1, 0], [1, 1]]), colorIndex: 0, order: 0, geometryIds: [],
        }),
      },
      {
        id: 'partition_bad' as never,
        type: 'feature', visible: true,
        quality: { status: 'candidate', confidence: 1, evidenceRefs: [] },
        semanticType: 'drawing-partition',
        geometryIds: [], annotationIds: [], relationIds: [],
        properties: { name: '坏分区', polygon: [[0, 0], [1, 1]] },
      },
    ];
    expect(readDrawingPartitions(document)).toHaveLength(1);
  });
});
