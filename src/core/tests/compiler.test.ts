import { describe, it, expect, beforeEach } from 'vitest';
import { compileIntent, resetIdCounter } from '../compiler';
import type { SpatialIntent } from '../types';

describe('Compiler', () => {
  beforeEach(() => {
    resetIdCounter();
  });

  it('编译单个 circle', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [100, 100], radius: 20 }, reference: 'c1' },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    expect(model.entities).toHaveLength(1);
    expect(model.entities[0].type).toBe('circle');
    const circle = model.entities[0] as any;
    expect(circle.center).toEqual([100, 100]);
    expect(circle.radius).toBe(20);
    expect(circle.visible).toBe(true);
  });

  it('编译 point', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'point', params: { x: 50, y: 30 } },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    expect(model.entities[0].type).toBe('point');
    const point = model.entities[0] as any;
    expect(point.x).toBe(50);
    expect(point.y).toBe(30);
  });

  it('编译 line', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'line', params: { start: [0, 0], end: [100, 0] } },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    const line = model.entities[0] as any;
    expect(line.start).toEqual([0, 0]);
    expect(line.end).toEqual([100, 0]);
  });

  it('处理 diameter 参数（自动转换为 radius）', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], diameter: 40 } },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    const circle = model.entities[0] as any;
    expect(circle.radius).toBe(20); // 40/2
  });

  it('处理 radius 别名 r', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], r: 15 } },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    const circle = model.entities[0] as any;
    expect(circle.radius).toBe(15);
  });

  it('编译带关系的双孔', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 }, reference: 'left' },
        { type: 'circle', params: { center: [150, 50], radius: 20 }, reference: 'right' },
      ],
      relations: [
        { kind: 'equal', entities: ['left', 'right'], property: 'radius' },
        { kind: 'distance', entities: ['left', 'right'], value: 100 },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    expect(model.entities).toHaveLength(2);
    expect(model.relations).toHaveLength(2);

    // 检查关系引用被正确转换为 ID
    const distRel = model.relations.find((r) => r.kind === 'distance')!;
    expect(distRel.entities).toEqual([model.entities[0].id, model.entities[1].id]);
    expect(distRel.value).toBe(100);
    expect(distRel.status).toBe('unsolved');
  });

  it('使用索引引用实体', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 } },
        { type: 'circle', params: { center: [150, 50], radius: 20 } },
      ],
      relations: [
        { kind: 'distance', entities: [0, 1], value: 100 },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    expect(model.relations[0].entities).toEqual([model.entities[0].id, model.entities[1].id]);
  });

  it('协议头正确', () => {
    const intent: SpatialIntent = {
      objects: [{ type: 'circle', params: { center: [0, 0], radius: 10 } }],
    };
    const { model } = compileIntent(intent);
    expect(model.protocol).toBe('VectorAI-Spatial');
    expect(model.version).toBe('0.1');
    expect(model.metadata.unit).toBe('mm');
    expect(model.metadata.createdBy).toBe('AI');
    expect(model.metadata.timestamp).toBeGreaterThan(0);
  });

  it('字符串数字参数被转换', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: ['50', '50'], radius: '20' } },
      ],
    };
    const { model, errors } = compileIntent(intent);
    expect(errors).toHaveLength(0);
    const circle = model.entities[0] as any;
    expect(circle.center).toEqual([50, 50]);
    expect(circle.radius).toBe(20);
  });
});
