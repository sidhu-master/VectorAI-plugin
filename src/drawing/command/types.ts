import type { IdFactory } from '../document/create';
import type {
  AnnotationId,
  AnnotationNode,
  CommitId,
  DrawingRelation,
  FeatureId,
  GeometryId,
  GeometryNode,
  RelationId,
  SemanticFeature,
} from '../document/types';
import type { DrawingPatch } from '../patch/types';
import type { DrawingSelector } from '../query/types';

type NewNode<T extends { id: string }> = T extends unknown
  ? Omit<T, 'id'> & { id?: T['id'] }
  : never;

type UpdateCommand<TType extends string, TId extends string> = {
  type: TType;
  id: TId;
  changes: Record<string, unknown>;
  expected?: Record<string, unknown>;
};

export type DrawingCommand =
  | { type: 'geometry.create'; value: NewNode<GeometryNode> }
  | UpdateCommand<'geometry.update', GeometryId>
  | { type: 'geometry.delete'; id: GeometryId }
  | { type: 'annotation.create'; value: NewNode<AnnotationNode> }
  | UpdateCommand<'annotation.update', AnnotationId>
  | { type: 'annotation.delete'; id: AnnotationId }
  | { type: 'relation.create'; value: NewNode<DrawingRelation> }
  | UpdateCommand<'relation.update', RelationId>
  | { type: 'relation.delete'; id: RelationId }
  | { type: 'feature.create'; value: NewNode<SemanticFeature> }
  | UpdateCommand<'feature.update', FeatureId>
  | { type: 'feature.delete'; id: FeatureId }
  | { type: 'history.revert'; commitId: CommitId };

export type DrawingAssertion =
  | { type: 'node.exists'; nodeId: string }
  | { type: 'node.absent'; nodeId: string }
  | { type: 'property.equals'; nodeId: string; path: string; value: unknown }
  | { type: 'document.valid' }
  | { type: 'selection.count'; selector: DrawingSelector; equals: number }
  | { type: 'selection.count'; selector: DrawingSelector; min: number };

export interface DrawingCommandError {
  commandIndex: number;
  code: string;
  message: string;
}

export type DrawingCommandCompilation =
  | {
      success: true;
      patch: DrawingPatch;
      preconditions: DrawingAssertion[];
    }
  | {
      success: false;
      patch: { operations: [] };
      errors: DrawingCommandError[];
    };

export interface DrawingCommandCompilerOptions {
  idFactory?: IdFactory;
}
