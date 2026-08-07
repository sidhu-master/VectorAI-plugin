import { describe, it, expect } from 'vitest';
import { validateModel } from '../validator';
import { compileIntent, resetIdCounter } from '../compiler';
import { createEmptyModel } from '../model';
import type { SpatialModel } from '../types';

describe('Geometry Validator', () => {
  it('通过合法模型', () => {
    const { model } = compileIntent({
      objects: [{ type: 'circle', params: { center: [50, 50], radius: 20 } }],
    });
    const result = validateModel(model);
    expect(result.valid).toBe(true);
  });

  it('拒绝 radius <= 0', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'circle', visible: true, center: [50, 50], radius: -5 },
      ],
      relations: [],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('radius');
  });

  it('拒绝 radius 为 NaN', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'circle', visible: true, center: [50, 50], radius: NaN },
      ],
      relations: [],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
  });

  it('拒绝线段 start == end', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'line', visible: true, start: [50, 50], end: [50, 50] },
      ],
      relations: [],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('重合');
  });

  it('拒绝关系引用不存在的实体', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'circle', visible: true, center: [50, 50], radius: 20 },
      ],
      relations: [
        { id: 'r1', kind: 'distance', entities: ['e1', 'nonexistent'], status: 'unsolved', value: 50 },
      ],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('nonexistent');
  });

  it('拒绝 distance 为负数', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'circle', visible: true, center: [50, 50], radius: 20 },
        { id: 'e2', type: 'circle', visible: true, center: [100, 50], radius: 20 },
      ],
      relations: [
        { id: 'r1', kind: 'distance', entities: ['e1', 'e2'], status: 'unsolved', value: -10 },
      ],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('负数');
  });

  it('拒绝 equal 关系缺少 property', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'e1', type: 'circle', visible: true, center: [50, 50], radius: 20 },
        { id: 'e2', type: 'circle', visible: true, center: [100, 50], radius: 20 },
      ],
      relations: [
        { id: 'r1', kind: 'equal', entities: ['e1', 'e2'], status: 'unsolved' },
      ],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('property');
  });

  it('拒绝重复实体 ID', () => {
    const model: SpatialModel = {
      protocol: 'VectorAI-Spatial',
      version: '0.1',
      metadata: { unit: 'mm', createdBy: 'AI', timestamp: Date.now() },
      entities: [
        { id: 'dup', type: 'circle', visible: true, center: [50, 50], radius: 20 },
        { id: 'dup', type: 'circle', visible: true, center: [100, 50], radius: 20 },
      ],
      relations: [],
    };
    const result = validateModel(model);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('重复');
  });

  it('空模型合法', () => {
    const model = createEmptyModel();
    const result = validateModel(model);
    expect(result.valid).toBe(true);
  });

  it('完整编译流程：two_holes 示例', () => {
    resetIdCounter();
    const { model } = compileIntent({
      objects: [
        { type: 'circle', params: { center: [50, 50], radius: 20 }, reference: 'left' },
        { type: 'circle', params: { center: [150, 50], radius: 20 }, reference: 'right' },
      ],
      relations: [
        { kind: 'equal', entities: ['left', 'right'], property: 'radius' },
        { kind: 'distance', entities: ['left', 'right'], value: 100 },
      ],
    });
    const result = validateModel(model);
    expect(result.valid).toBe(true);
  });
});
