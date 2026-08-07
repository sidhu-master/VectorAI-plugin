/**
 * Spatial Harness - AI 操作空间世界的工具箱
 *
 * 架构位置：
 *   User -> AI Agent -> Spatial Harness -> Spatial Core -> SpatialModel
 *
 * 三类操作：
 *   Search  - 按条件查询实体（类型、区域、属性、关系）
 *   Inspect - 获取单个实体详情（参数、关系、包围盒）
 *   Edit    - 创建、修改、删除实体和关系
 *
 * 核心理念：AI 不直接读整个模型，而是"需要什么，自己取什么"。
 */

import type {
  ConstraintKind,
  GeometryEntity,
  SpatialModel,
  SpatialRelation,
} from './types';

// ============ Search ============

export interface SearchQuery {
  type?: 'point' | 'line' | 'circle';   // 按类型筛选
  bbox?: { minX: number; minY: number; maxX: number; maxY: number }; // 按区域筛选
  visibleOnly?: boolean;                    // 只返回可见实体
  relationKind?: ConstraintKind;           // 按关联关系筛选
  limit?: number;                          // 限制返回数量
}

export interface SearchResult {
  id: string;
  type: string;
  summary: string;  // 一行摘要，如 "circle: center=[50,50], radius=20"
}

export function searchEntities(model: SpatialModel, query: SearchQuery): SearchResult[] {
  let entities = model.entities;

  if (query.visibleOnly !== false) {
    entities = entities.filter((e) => e.visible);
  }

  if (query.type) {
    entities = entities.filter((e) => e.type === query.type);
  }

  if (query.bbox) {
    entities = entities.filter((e) => {
      const b = entityBBox(e);
      return aabbIntersect(b, query.bbox!);
    });
  }

  if (query.relationKind) {
    const relEntityIds = new Set<string>();
    model.relations
      .filter((r) => r.kind === query.relationKind)
      .forEach((r) => r.entities.forEach((id) => relEntityIds.add(id)));
    entities = entities.filter((e) => relEntityIds.has(e.id));
  }

  if (query.limit) {
    entities = entities.slice(0, query.limit);
  }

  return entities.map((e) => ({
    id: e.id,
    type: e.type,
    summary: summarizeEntity(e),
  }));
}

// ============ Inspect ============

export interface InspectResult {
  entity: GeometryEntity;
  relations: SpatialRelation[];   // 涉及此实体的关系
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  relatedEntities: { id: string; type: string; summary: string }[];
}

export function inspectEntity(model: SpatialModel, id: string): InspectResult | null {
  const entity = model.entities.find((e) => e.id === id);
  if (!entity) return null;

  const relations = model.relations.filter((r) => r.entities.includes(id));
  const relatedIds = new Set<string>();
  relations.forEach((r) =>
    r.entities.forEach((rid) => {
      if (rid !== id) relatedIds.add(rid);
    }),
  );

  const relatedEntities = Array.from(relatedIds)
    .map((rid) => model.entities.find((e) => e.id === rid))
    .filter(Boolean)
    .map((e) => ({
      id: e!.id,
      type: e!.type,
      summary: summarizeEntity(e!),
    }));

  return {
    entity,
    relations,
    bbox: entityBBox(entity),
    relatedEntities,
  };
}

// ============ Edit ============

export type EditOperation =
  | { kind: 'create'; entity: GeometryEntity }
  | { kind: 'modify'; id: string; patch: Partial<GeometryEntity> }
  | { kind: 'delete'; id: string }
  | { kind: 'createRelation'; relation: SpatialRelation }
  | { kind: 'deleteRelation'; id: string };

export interface EditResult {
  success: boolean;
  model: SpatialModel;
  errors: string[];
}

export function applyEdits(model: SpatialModel, operations: EditOperation[]): EditResult {
  const errors: string[] = [];
  let entities = [...model.entities];
  let relations = [...model.relations];

  for (const op of operations) {
    switch (op.kind) {
      case 'create':
        entities.push(op.entity);
        break;

      case 'modify': {
        const idx = entities.findIndex((e) => e.id === op.id);
        if (idx === -1) {
          errors.push(`modify: 实体 ${op.id} 不存在`);
        } else {
          entities[idx] = { ...entities[idx], ...op.patch } as GeometryEntity;
        }
        break;
      }

      case 'delete': {
        entities = entities.filter((e) => e.id !== op.id);
        relations = relations.filter((r) => !r.entities.includes(op.id));
        break;
      }

      case 'createRelation':
        relations.push(op.relation);
        break;

      case 'deleteRelation':
        relations = relations.filter((r) => r.id !== op.id);
        break;
    }
  }

  return {
    success: errors.length === 0,
    model: { ...model, entities, relations },
    errors,
  };
}

// ============ Harness Summary - 给 AI 的模型摘要 ============

export interface ModelSummary {
  entityCount: number;
  relationCount: number;
  byType: Record<string, number>;
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  recentEntities: SearchResult[];
}

export function summarizeModel(model: SpatialModel): ModelSummary {
  const byType: Record<string, number> = {};
  for (const e of model.entities) {
    byType[e.type] = (byType[e.type] || 0) + 1;
  }

  const bbox = model.entities.length > 0
    ? model.entities.reduce(
        (acc, e) => {
          const b = entityBBox(e);
          return {
            minX: Math.min(acc.minX, b.minX),
            minY: Math.min(acc.minY, b.minY),
            maxX: Math.max(acc.maxX, b.maxX),
            maxY: Math.max(acc.maxY, b.maxY),
          };
        },
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      )
    : null;

  return {
    entityCount: model.entities.length,
    relationCount: model.relations.length,
    byType,
    bbox,
    recentEntities: searchEntities(model, { limit: 10 }),
  };
}

// ============ 工具函数 ============

function entityBBox(e: GeometryEntity) {
  switch (e.type) {
    case 'point':
      return { minX: e.x, minY: e.y, maxX: e.x, maxY: e.y };
    case 'line':
      return {
        minX: Math.min(e.start[0], e.end[0]),
        minY: Math.min(e.start[1], e.end[1]),
        maxX: Math.max(e.start[0], e.end[0]),
        maxY: Math.max(e.start[1], e.end[1]),
      };
    case 'circle':
      return {
        minX: e.center[0] - e.radius,
        minY: e.center[1] - e.radius,
        maxX: e.center[0] + e.radius,
        maxY: e.center[1] + e.radius,
      };
  }
}

function aabbIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function summarizeEntity(e: GeometryEntity): string {
  switch (e.type) {
    case 'point':
      return `point: x=${e.x}, y=${e.y}`;
    case 'line':
      return `line: start=[${e.start[0]},${e.start[1]}], end=[${e.end[0]},${e.end[1]}]`;
    case 'circle':
      return `circle: center=[${e.center[0]},${e.center[1]}], radius=${e.radius}`;
  }
}
