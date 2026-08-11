import { describe, expect, it } from 'vitest';
import type { DrawingDocument, GeometryNode } from '../../../src/drawing/index.js';
import { renderGroundingSnapshot } from './grounding-renderer.js';

describe('renderGroundingSnapshot', () => {
  it('renders geometry into a PNG and reports per-node pixel bounds', async () => {
    const snapshot = await renderGroundingSnapshot({
      document: documentWith([geometry({
        id: 'line_a', type: 'line', start: [10, 10], end: [30, 10],
      }), geometry({
        id: 'circle_b', type: 'circle', center: [50, 50], radius: 8,
      })]),
      scale: 1,
      offsetX: 0,
      offsetY: 100, // world Y-up → 图像 Y-down
      width: 100,
      height: 100,
      maxDimension: 200,
    });

    expect(snapshot.imageDataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(snapshot.width).toBe(100);
    expect(snapshot.height).toBe(100);

    const line = snapshot.nodes.find((node) => node.nodeId === 'line_a');
    expect(line).toBeDefined();
    expect(line!.type).toBe('line');
    expect(line!.bounds.x).toBe(9); // 10 - stamp 半径 1
    expect(line!.bounds.y).toBe(89); // Y 翻转(90 - 1)
    expect(line!.bounds.width).toBeGreaterThanOrEqual(21);

    const circle = snapshot.nodes.find((node) => node.nodeId === 'circle_b');
    expect(circle).toBeDefined();
    // 圆心 world(50,50) → 图像(50,50),半径 8 + stamp 半径 1
    expect(circle!.bounds.x).toBeGreaterThanOrEqual(40);
    expect(circle!.bounds.x).toBeLessThanOrEqual(42);
    expect(circle!.bounds.width).toBeGreaterThanOrEqual(17);
    expect(circle!.bounds.width).toBeLessThanOrEqual(20);
  });

  it('flags selected nodes and renders them highlighted', async () => {
    const snapshot = await renderGroundingSnapshot({
      document: documentWith([geometry({
        id: 'line_a', type: 'line', start: [10, 10], end: [30, 10],
      }), geometry({
        id: 'line_c', type: 'line', start: [10, 20], end: [30, 20],
      })]),
      scale: 1,
      offsetX: 0,
      offsetY: 100,
      width: 100,
      height: 100,
      selectedIds: ['line_a'],
    });

    const selected = snapshot.nodes.find((node) => node.nodeId === 'line_a');
    const other = snapshot.nodes.find((node) => node.nodeId === 'line_c');
    expect(selected!.selected).toBe(true);
    expect(other!.selected).toBe(false);
    // 选区节点使用更粗的描边 → 高度 > 2
    expect(selected!.bounds.height).toBeGreaterThan(2);
    // 未选中节点半径 1 → 高度 3(中心 ±1)
    expect(other!.bounds.height).toBe(3);
  });
});

function geometry(input: Record<string, unknown> & { id: string; type: GeometryNode['type'] }): GeometryNode {
  return {
    ...input,
    id: input.id as GeometryNode['id'],
    visible: true,
    quality: { status: 'confirmed', evidenceRefs: [] },
  } as unknown as GeometryNode;
}

function documentWith(geometryItems: GeometryNode[]): DrawingDocument {
  return {
    protocol: 'VectorAI-Drawing', schemaVersion: '1.0', id: 'drawing_ground' as DrawingDocument['id'],
    metadata: { createdAt: 1, updatedAt: 1 },
    unitSystem: { length: 'mm', angle: 'deg' },
    coordinateFrames: [{ id: 'document', kind: 'document', transform: [1, 0, 0, 1, 0, 0] }],
    geometry: geometryItems, annotations: [], relations: [], features: [],
  };
}
