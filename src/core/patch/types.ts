import type { GeometryEntity, SpatialRelation } from '../types';

export type EntityPatch =
  | { visible?: boolean; x?: number; y?: number }
  | { visible?: boolean; start?: [number, number]; end?: [number, number] }
  | { visible?: boolean; center?: [number, number]; radius?: number };

export type RelationPatch = Partial<
  Pick<SpatialRelation, 'status' | 'value' | 'axis' | 'property'>
>;

export type SpatialOperation =
  | { type: 'entity.add'; entity: GeometryEntity }
  | { type: 'entity.update'; entityId: string; changes: EntityPatch }
  | { type: 'entity.delete'; entityId: string }
  | { type: 'relation.add'; relation: SpatialRelation }
  | { type: 'relation.update'; relationId: string; changes: RelationPatch }
  | { type: 'relation.delete'; relationId: string };

export interface SpatialPatch {
  operations: SpatialOperation[];
}

export interface PatchError {
  operationIndex: number;
  code: string;
  message: string;
}

export interface PatchValidationResult {
  valid: boolean;
  errors: PatchError[];
}
