import { describe, it, expect } from 'vitest';
import { DXFAdapter } from '../adapters/dxf';
import { compileIntent, resetIdCounter } from '../compiler';
import type { SpatialModel } from '../types';

describe('DXFAdapter', () => {
  it('导出单个 circle', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [{ type: 'circle', params: { center: [100, 100], radius: 20 } }],
    });
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    expect(dxf).toContain('CIRCLE');
    expect(dxf).toContain('100.000000');
    expect(dxf).toContain('20.000000');
    expect(dxf).toContain('AC1009'); // R12
    expect(dxf).toContain('EOF');
  });

  it('导出 point', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [{ type: 'point', params: { x: 50, y: 30 } }],
    });
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    expect(dxf).toContain('POINT');
    expect(dxf).toContain('50.000000');
    expect(dxf).toContain('30.000000');
  });

  it('导出 line', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [{ type: 'line', params: { start: [0, 0], end: [100, 0] } }],
    });
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    expect(dxf).toContain('LINE');
    expect(dxf).toContain('0.000000');
    expect(dxf).toContain('100.000000');
  });

  it('导出多个实体', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 } },
        { type: 'line', params: { start: [0, 0], end: [100, 0] } },
        { type: 'point', params: { x: 50, y: 50 } },
      ],
    });
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    const circleCount = (dxf.match(/CIRCLE/g) || []).length;
    const lineCount = (dxf.match(/LINE/g) || []).length;
    const pointCount = (dxf.match(/POINT/g) || []).length;
    expect(circleCount).toBe(1);
    expect(lineCount).toBe(1);
    expect(pointCount).toBe(1);
  });

  it('跳过 invisible 实体', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'circle', visible: true, center: [50, 50], radius: 20 },
        { id: 'e2', type: 'circle', visible: false, center: [100, 50], radius: 10 },
      ],
      relations: [],
    };
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    const circleCount = (dxf.match(/CIRCLE/g) || []).length;
    expect(circleCount).toBe(1); // 只有 visible 的那个
  });

  it('包含 HEADER 和 ENTITIES 段', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [],
      relations: [],
    };
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    expect(dxf).toContain('HEADER');
    expect(dxf).toContain('ENTITIES');
    expect(dxf).toContain('EOF');
  });

  it('保持 circle 结构化（非线段近似）', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [{ type: 'circle', params: { center: [50, 50], radius: 20 } }],
    });
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    // 应该有 CIRCLE 实体，而不是多个 LINE
    expect(dxf).toContain('CIRCLE');
    const lineCount = (dxf.match(/^LINE$/gm) || []).length;
    expect(lineCount).toBe(0);
  });

  it('导出 two_holes 示例', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 }, reference: 'left' },
        { type: 'circle', params: { center: [150, 50], radius: 20 }, reference: 'right' },
      ],
      relations: [
        { kind: 'distance', entities: ['left', 'right'], value: 100 },
      ],
    });
    const adapter = new DXFAdapter();
    const dxf = adapter.represent(model);

    // 关系不导出，只导出几何实体
    const circleCount = (dxf.match(/CIRCLE/g) || []).length;
    expect(circleCount).toBe(2);
    expect(dxf).toContain('EOF');
  });
});
