import { describe, expect, it } from 'vitest';

import type { DrawingDocument, DrawingId, GeometryId, GeometryNode, Vec2 } from '../../../src/drawing/index.js';
import type { DrawingPartition } from '../../../src/contracts/drawing-partition.js';
import { buildPartitionedAnnotationSteps } from './partition-steps.js';

const ring = (points: number[][]): Vec2[] => points.map(
  (point) => [point[0], point[1]] as Vec2,
);

const quality = { status: 'confirmed' as const, confidence: 0.95, evidenceRefs: [] };
const gid = (id: string): GeometryId => id as GeometryId;

/**
 * 轴对称轮廓（模拟真实轴类图纸）：
 * - 左右两端各一对锥面倒角（120° 开角，锥口贴端面）--应保留；
 * - 左端 45° 角部倒角对（90° 正交开角）--应被 90° 规则抑制；
 * - 中部一对斜线（120° 开角但不贴端面）--应被轴端规则抑制。
 */
const coneRise = 4 * Math.sqrt(3); // 精确 60° 锥面：水平 4、垂直 4√3
const journalY = 12.9 - coneRise;
const geometry: GeometryNode[] = [
  { id: gid('line_top'), type: 'line', visible: true, quality, start: [14, journalY], end: [86, journalY] },
  { id: gid('line_bottom'), type: 'line', visible: true, quality, start: [14, -journalY], end: [86, -journalY] },
  { id: gid('cone_upper_left'), type: 'line', visible: true, quality, start: [10, 12.9], end: [14, journalY] },
  { id: gid('cone_lower_left'), type: 'line', visible: true, quality, start: [10, -12.9], end: [14, -journalY] },
  { id: gid('cone_upper_right'), type: 'line', visible: true, quality, start: [86, journalY], end: [90, 12.9] },
  { id: gid('cone_lower_right'), type: 'line', visible: true, quality, start: [86, -journalY], end: [90, -12.9] },
  { id: gid('corner_upper_left'), type: 'line', visible: true, quality, start: [10, 10.9], end: [11, 11.9] },
  { id: gid('corner_lower_left'), type: 'line', visible: true, quality, start: [10, -10.9], end: [11, -11.9] },
  { id: gid('mid_upper'), type: 'line', visible: true, quality, start: [40, 11], end: [42, 7.54] },
  { id: gid('mid_lower'), type: 'line', visible: true, quality, start: [40, -11], end: [42, -7.54] },
  { id: gid('circle_hole'), type: 'circle', visible: true, quality, center: [50, 0], radius: 3 },
];

const document = {
  id: 'drawing_test',
  revision: 'revision_test',
  geometry,
  annotations: [],
  features: [],
} as unknown as DrawingDocument;

const partitions: DrawingPartition[] = [
  {
    id: 'partition_1', name: '左轴承位B01', basis: '台阶以上轮廓',
    polygon: ring([[0, -25], [0, 25], [50, 25], [50, -25]]), colorIndex: 0, order: 0,
    geometryIds: ['cone_upper_left', 'cone_lower_left', 'line_top', 'line_bottom'],
  },
];

const staleAutoAngular = {
  id: 'annotation_auto_stale90',
  type: 'dimension',
  visible: true,
  quality,
  dimensionKind: 'angular',
  associationStatus: 'resolved',
  targets: [],
  computedValue: 90,
  displayText: '90°',
  unit: 'deg',
  textPosition: [40, 0],
  definitionPoints: [],
};

const manualAngular = {
  ...staleAutoAngular,
  id: 'annotation_manual_90',
};

describe('buildPartitionedAnnotationSteps（自动标注暂停期：仅轴端开角标注）', () => {
  it('keeps only axial-end opening angles and suppresses orthogonal / mid-shaft pairs', () => {
    const steps = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document,
      partitions,
    });

    expect(steps).toHaveLength(2);
    for (const step of steps) {
      expect(step.annotation.dimensionKind).toBe('angular');
      expect(step.annotation.unit).toBe('deg');
      expect(step.annotation.displayText).toMatch(/°$/);
      expect(step.commands).toEqual([{ type: 'annotation.create', value: step.annotation }]);
    }
    expect(steps.map((step) => Math.round(step.annotation.computedValue)).sort()).toEqual([120, 120]);
    const targetIds = new Set(steps.flatMap((step) => step.annotation.targets.map((target) => target.geometryId)));
    expect([...targetIds].sort()).toEqual([
      'cone_lower_left', 'cone_lower_right', 'cone_upper_left', 'cone_upper_right',
    ]);
  });

  it('skips already committed annotations', () => {
    const first = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document,
      partitions,
    });
    expect(first).toHaveLength(2);

    const resumed = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document: {
        ...document,
        annotations: first.map((step) => step.annotation),
      } as DrawingDocument,
      partitions,
    });
    expect(resumed).toEqual([]);
  });

  it('removes stale automatic angular annotations but keeps manual ones on re-run', () => {
    const steps = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document: {
        ...document,
        annotations: [staleAutoAngular, manualAngular],
      } as unknown as DrawingDocument,
      partitions,
    });

    const removals = steps.filter((step) => step.commands.some((command) => command.type === 'annotation.delete'));
    expect(removals).toHaveLength(1);
    expect(removals[0].commands[0]).toEqual({ type: 'annotation.delete', id: 'annotation_auto_stale90' });
    expect(steps).toHaveLength(3);
  });

  it('refreshes kept annotations whose layout has drifted', () => {
    const first = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document,
      partitions,
    });
    expect(first).toHaveLength(2);
    const drifted = first.map((item, index) => (
      index === 0 ? { ...item.annotation, textPosition: [-999, -999] } : item.annotation
    ));

    const steps = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document: {
        ...document,
        annotations: drifted,
      } as unknown as DrawingDocument,
      partitions,
    });

    // 漂移的那项先删后建刷新，未漂移的保持不变
    expect(steps).toHaveLength(2);
    const deletes = steps.flatMap((item) => item.commands
      .filter((command) => command.type === 'annotation.delete')
      .map((command) => command.id));
    expect(deletes).toEqual([drifted[0].id]);
    const creates = steps.filter((item) => item.commands
      .some((command) => command.type === 'annotation.create'));
    expect(creates).toHaveLength(1);
    expect(creates[0].annotation.id).toBe(drifted[0].id);
    expect(creates[0].annotation.textPosition).not.toEqual([-999, -999]);
  });

  it('returns empty steps when no axial-end opening-angle facts exist', () => {
    const plain: DrawingDocument = {
      ...document,
      geometry: geometry.filter((node) => !node.id.startsWith('cone_')),
    } as DrawingDocument;
    const steps = buildPartitionedAnnotationSteps({
      drawingId: 'drawing_test' as DrawingId,
      document: plain,
      partitions,
    });
    expect(steps).toEqual([]);
  });
});
