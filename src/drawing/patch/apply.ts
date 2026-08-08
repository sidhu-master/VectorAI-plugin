import type {
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  GeometryNode,
  SemanticFeature,
} from '../document/types';
import { validateDrawingDocument } from '../validation/document';
import type {
  DrawingPatch,
  DrawingPatchError,
  DrawingPatchOperation,
  DrawingPatchResult,
} from './types';

const IMMUTABLE_FIELDS = new Set(['id', 'type', 'plane']);

export function applyDrawingPatch(
  document: DrawingDocument,
  patch: DrawingPatch,
): DrawingPatchResult {
  const working = structuredClone(document);
  const inverse: DrawingPatchOperation[] = [];

  for (const [operationIndex, operation] of patch.operations.entries()) {
    const operationError = applyOperation(working, operation, inverse, operationIndex);
    if (operationError) return { success: false, document, errors: [operationError] };
  }

  const report = validateDrawingDocument(working);
  if (!report.valid) {
    return {
      success: false,
      document,
      errors: report.issues
        .filter((issue) => issue.severity === 'error')
        .map((issue) => ({
          operationIndex: Math.max(0, patch.operations.length - 1),
          code: issue.code,
          message: issue.message,
          path: issue.path,
        })),
    };
  }

  return {
    success: true,
    document: working,
    inversePatch: { operations: inverse.reverse() },
  };
}

function applyOperation(
  document: DrawingDocument,
  operation: DrawingPatchOperation,
  inverse: DrawingPatchOperation[],
  operationIndex: number,
): DrawingPatchError | undefined {
  switch (operation.type) {
    case 'geometry.add':
      document.geometry.push(clone(operation.value));
      inverse.push({ type: 'geometry.delete', id: operation.value.id });
      return undefined;
    case 'annotation.add':
      document.annotations.push(clone(operation.value));
      inverse.push({ type: 'annotation.delete', id: operation.value.id });
      return undefined;
    case 'relation.add':
      document.relations.push(clone(operation.value));
      inverse.push({ type: 'relation.delete', id: operation.value.id });
      return undefined;
    case 'feature.add':
      document.features.push(clone(operation.value));
      inverse.push({ type: 'feature.delete', id: operation.value.id });
      return undefined;
    case 'geometry.update': {
      const node = document.geometry.find((item) => item.id === operation.id);
      if (!node) return missing(operationIndex, operation.id);
      return updateNode(
        node,
        operation.changes,
        operationIndex,
        (changes) => inverse.push({ type: 'geometry.update', id: operation.id, changes }),
      );
    }
    case 'annotation.update': {
      const node = document.annotations.find((item) => item.id === operation.id);
      if (!node) return missing(operationIndex, operation.id);
      return updateNode(
        node,
        operation.changes,
        operationIndex,
        (changes) => inverse.push({ type: 'annotation.update', id: operation.id, changes }),
      );
    }
    case 'relation.update': {
      const node = document.relations.find((item) => item.id === operation.id);
      if (!node) return missing(operationIndex, operation.id);
      return updateNode(
        node,
        operation.changes,
        operationIndex,
        (changes) => inverse.push({ type: 'relation.update', id: operation.id, changes }),
      );
    }
    case 'feature.update': {
      const node = document.features.find((item) => item.id === operation.id);
      if (!node) return missing(operationIndex, operation.id);
      return updateNode(
        node,
        operation.changes,
        operationIndex,
        (changes) => inverse.push({ type: 'feature.update', id: operation.id, changes }),
      );
    }
    case 'geometry.delete':
      return deleteGeometry(document, operation.id, inverse, operationIndex);
    case 'annotation.delete':
      return deleteAnnotation(document, operation.id, inverse, operationIndex);
    case 'relation.delete':
      return deleteRelation(document, operation.id, inverse, operationIndex);
    case 'feature.delete':
      return deleteFeature(document, operation.id, inverse, operationIndex);
  }
}

function updateNode(
  node: GeometryNode | AnnotationNode | DrawingRelation | SemanticFeature,
  changes: Record<string, unknown>,
  operationIndex: number,
  recordInverse: (changes: Record<string, unknown>) => void,
): DrawingPatchError | undefined {
  const immutable = Object.keys(changes).find((key) => IMMUTABLE_FIELDS.has(key));
  if (immutable) {
    return {
      operationIndex,
      code: 'IMMUTABLE_FIELD',
      message: `字段 ${immutable} 不可修改`,
    };
  }
  const record = node as unknown as Record<string, unknown>;
  const previous: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(changes)) {
    previous[key] = clone(record[key]);
    if (value === undefined) delete record[key];
    else record[key] = clone(value);
  }
  recordInverse(previous);
  return undefined;
}

function deleteGeometry(
  document: DrawingDocument,
  id: GeometryNode['id'],
  inverse: DrawingPatchOperation[],
  operationIndex: number,
): DrawingPatchError | undefined {
  const nodeIndex = document.geometry.findIndex((item) => item.id === id);
  if (nodeIndex < 0) return missing(operationIndex, id);
  const deletedRelations = document.relations.filter((relation) => relationReferences(relation, id));
  const deletedRelationIds = new Set(deletedRelations.map((relation) => relation.id));
  document.relations = document.relations.filter((relation) => !deletedRelationIds.has(relation.id));
  deletedRelations.forEach((relation) => inverse.push({ type: 'relation.add', value: clone(relation) }));

  for (const feature of document.features) {
    const nextGeometryIds = feature.geometryIds.filter((item) => item !== id);
    const nextRelationIds = feature.relationIds.filter((item) => !deletedRelationIds.has(item));
    if (nextGeometryIds.length === feature.geometryIds.length
      && nextRelationIds.length === feature.relationIds.length) continue;
    inverse.push({
      type: 'feature.update',
      id: feature.id,
      changes: {
        geometryIds: clone(feature.geometryIds),
        relationIds: clone(feature.relationIds),
      },
    });
    feature.geometryIds = nextGeometryIds;
    feature.relationIds = nextRelationIds;
  }

  const [deleted] = document.geometry.splice(nodeIndex, 1);
  inverse.push({ type: 'geometry.add', value: clone(deleted) });
  return undefined;
}

function deleteAnnotation(
  document: DrawingDocument,
  id: AnnotationNode['id'],
  inverse: DrawingPatchOperation[],
  operationIndex: number,
): DrawingPatchError | undefined {
  const nodeIndex = document.annotations.findIndex((item) => item.id === id);
  if (nodeIndex < 0) return missing(operationIndex, id);
  const deletedRelations = document.relations.filter((relation) => relationReferences(relation, id));
  const deletedRelationIds = new Set(deletedRelations.map((relation) => relation.id));
  document.relations = document.relations.filter((relation) => !deletedRelationIds.has(relation.id));
  deletedRelations.forEach((relation) => inverse.push({ type: 'relation.add', value: clone(relation) }));
  for (const feature of document.features) {
    const nextAnnotationIds = feature.annotationIds.filter((item) => item !== id);
    const nextRelationIds = feature.relationIds.filter((item) => !deletedRelationIds.has(item));
    if (nextAnnotationIds.length === feature.annotationIds.length
      && nextRelationIds.length === feature.relationIds.length) continue;
    inverse.push({
      type: 'feature.update',
      id: feature.id,
      changes: {
        annotationIds: clone(feature.annotationIds),
        relationIds: clone(feature.relationIds),
      },
    });
    feature.annotationIds = nextAnnotationIds;
    feature.relationIds = nextRelationIds;
  }
  const [deleted] = document.annotations.splice(nodeIndex, 1);
  inverse.push({ type: 'annotation.add', value: clone(deleted) });
  return undefined;
}

function deleteRelation(
  document: DrawingDocument,
  id: DrawingRelation['id'],
  inverse: DrawingPatchOperation[],
  operationIndex: number,
): DrawingPatchError | undefined {
  const nodeIndex = document.relations.findIndex((item) => item.id === id);
  if (nodeIndex < 0) return missing(operationIndex, id);
  for (const feature of document.features) {
    if (!feature.relationIds.includes(id)) continue;
    inverse.push({
      type: 'feature.update',
      id: feature.id,
      changes: { relationIds: clone(feature.relationIds) },
    });
    feature.relationIds = feature.relationIds.filter((item) => item !== id);
  }
  const [deleted] = document.relations.splice(nodeIndex, 1);
  inverse.push({ type: 'relation.add', value: clone(deleted) });
  return undefined;
}

function deleteFeature(
  document: DrawingDocument,
  id: SemanticFeature['id'],
  inverse: DrawingPatchOperation[],
  operationIndex: number,
): DrawingPatchError | undefined {
  const nodeIndex = document.features.findIndex((item) => item.id === id);
  if (nodeIndex < 0) return missing(operationIndex, id);
  const deletedRelations = document.relations.filter((relation) => (
    relation.plane === 'semantic' && relation.featureId === id
  ));
  const relationIds = new Set(deletedRelations.map((relation) => relation.id));
  document.relations = document.relations.filter((relation) => !relationIds.has(relation.id));
  deletedRelations.forEach((relation) => inverse.push({ type: 'relation.add', value: clone(relation) }));
  for (const feature of document.features) {
    if (feature.id === id || !feature.relationIds.some((relationId) => relationIds.has(relationId))) continue;
    inverse.push({
      type: 'feature.update',
      id: feature.id,
      changes: { relationIds: clone(feature.relationIds) },
    });
    feature.relationIds = feature.relationIds.filter((relationId) => !relationIds.has(relationId));
  }
  const [deleted] = document.features.splice(nodeIndex, 1);
  inverse.push({ type: 'feature.add', value: clone(deleted) });
  return undefined;
}

function relationReferences(relation: DrawingRelation, id: string): boolean {
  if (relation.plane === 'constraint') return relation.geometryIds.some((item) => item === id);
  if (relation.plane === 'association') {
    return relation.annotationId === id || relation.geometryIds.some((item) => item === id);
  }
  if (relation.plane === 'semantic') {
    return relation.featureId === id || relation.nodeIds.includes(id);
  }
  return relation.nodeIds.includes(id);
}

function missing(operationIndex: number, id: string): DrawingPatchError {
  return { operationIndex, code: 'NODE_NOT_FOUND', message: `节点 ${id} 不存在` };
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
