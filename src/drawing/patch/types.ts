import type {
  AnnotationId,
  AnnotationNode,
  DrawingDocument,
  DrawingRelation,
  FeatureId,
  GeometryId,
  GeometryNode,
  RelationId,
  SemanticFeature,
} from '../document/types';

export type DrawingPatchOperation =
  | { type: 'geometry.add'; value: GeometryNode }
  | { type: 'geometry.update'; id: GeometryId; changes: Record<string, unknown> }
  | { type: 'geometry.delete'; id: GeometryId }
  | { type: 'annotation.add'; value: AnnotationNode }
  | { type: 'annotation.update'; id: AnnotationId; changes: Record<string, unknown> }
  | { type: 'annotation.delete'; id: AnnotationId }
  | { type: 'relation.add'; value: DrawingRelation }
  | { type: 'relation.update'; id: RelationId; changes: Record<string, unknown> }
  | { type: 'relation.delete'; id: RelationId }
  | { type: 'feature.add'; value: SemanticFeature }
  | { type: 'feature.update'; id: FeatureId; changes: Record<string, unknown> }
  | { type: 'feature.delete'; id: FeatureId };

export interface DrawingPatch {
  operations: DrawingPatchOperation[];
}

export interface DrawingPatchError {
  operationIndex: number;
  code: string;
  message: string;
  path?: string;
}

export type DrawingPatchResult =
  | {
      success: true;
      document: DrawingDocument;
      inversePatch: DrawingPatch;
    }
  | {
      success: false;
      document: DrawingDocument;
      errors: DrawingPatchError[];
    };
