import { describe, it, expect } from 'vitest';
import { validateIntent } from '../intent-validator';
import type { SpatialIntent } from '../types';

describe('Intent Validator', () => {
  it('通过合法的 circle intent', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 } },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('拒绝空 objects 数组', () => {
    const intent: SpatialIntent = { objects: [] };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('objects');
  });

  it('拒绝未知实体类型', () => {
    const intent: SpatialIntent = {
      objects: [
        // @ts-expect-error 测试未知类型
        { type: 'hexagon', params: {} },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('hexagon');
  });

  it('拒绝缺少关键参数', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50] } },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('radius');
  });

  it('拒绝字符串类型的 radius（意图错误）', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 'large' } },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('radius');
  });

  it('验证合法关系', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 }, reference: 'c1' },
        { type: 'circle', params: { center: [150, 50], radius: 20 }, reference: 'c2' },
      ],
      relations: [
        { kind: 'distance', entities: ['c1', 'c2'], value: 100 },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(true);
  });

  it('拒绝未知关系类型', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 } },
      ],
      relations: [
        // @ts-expect-error 测试未知类型
        { kind: 'magnetic', entities: [0] },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
  });

  it('拒绝 entities 为空的关系', () => {
    const intent: SpatialIntent = {
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 } },
      ],
      relations: [
        { kind: 'distance', entities: [], value: 50 },
      ],
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
  });

  it('验证合法的 confidence', () => {
    const intent: SpatialIntent = {
      objects: [{ type: 'circle', params: { center: [50, 50], radius: 20 } }],
      confidence: 0.87,
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(true);
  });

  it('拒绝越界的 confidence', () => {
    const intent: SpatialIntent = {
      objects: [{ type: 'circle', params: { center: [50, 50], radius: 20 } }],
      confidence: 1.5,
    };
    const result = validateIntent(intent);
    expect(result.valid).toBe(false);
  });
});
