/**
 * SpatialModel 管理工具
 */

import type { GeometryEntity, ModelMetadata, SpatialModel, SpatialRelation } from './types';
import { PROTOCOL_NAME, PROTOCOL_VERSION } from './types';

export function createEmptyModel(unit: 'mm' | 'cm' | 'm' = 'mm'): SpatialModel {
  return {
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION,
    metadata: {
      unit,
      createdBy: 'system',
      timestamp: Date.now(),
    },
    entities: [],
    relations: [],
  };
}

export function createModel(
  entities: GeometryEntity[],
  relations: SpatialRelation[] = [],
  unit: 'mm' | 'cm' | 'm' = 'mm',
  createdBy: ModelMetadata['createdBy'] = 'AI',
): SpatialModel {
  return {
    protocol: PROTOCOL_NAME,
    version: PROTOCOL_VERSION,
    metadata: {
      unit,
      createdBy,
      timestamp: Date.now(),
    },
    entities,
    relations,
  };
}

export function createDerivedModel(parent: SpatialModel): SpatialModel {
  return {
    ...parent,
    metadata: {
      ...parent.metadata,
      parentId: undefined, // 由调用方设置
      timestamp: Date.now(),
    },
  };
}

export function cloneModel(model: SpatialModel): SpatialModel {
  return JSON.parse(JSON.stringify(model));
}
