import type {
  Actor,
  AnnotationNode,
  DrawingCommand,
  DrawingCommit,
  DrawingDocument,
  DrawingRelation,
  DrawingTransaction,
  GeometryNode,
  IdFactory,
  RepositoryCommitResult,
  RevisionId,
  SemanticFeature,
} from '@/drawing';

export type DrawingPlane = 'geometry' | 'annotation' | 'relation' | 'feature';

export type LocatedDrawingNode =
  | { plane: 'geometry'; node: GeometryNode }
  | { plane: 'annotation'; node: AnnotationNode }
  | { plane: 'relation'; node: DrawingRelation }
  | { plane: 'feature'; node: SemanticFeature };

export interface DrawingWorkspaceState {
  document: DrawingDocument;
  revision: RevisionId;
  commits: DrawingCommit[];
}

export interface AppliedWorkspaceResult {
  workspace: DrawingWorkspaceState;
  error: string | null;
}

const IMMUTABLE_FIELDS = new Set(['id', 'type', 'plane']);

export function locateDrawingNode(
  document: DrawingDocument,
  id: string,
): LocatedDrawingNode | null {
  const geometry = document.geometry.find((node) => node.id === id);
  if (geometry) return { plane: 'geometry', node: geometry };
  const annotation = document.annotations.find((node) => node.id === id);
  if (annotation) return { plane: 'annotation', node: annotation };
  const relation = document.relations.find((node) => node.id === id);
  if (relation) return { plane: 'relation', node: relation };
  const feature = document.features.find((node) => node.id === id);
  return feature ? { plane: 'feature', node: feature } : null;
}

export function buildUpdateCommand(
  document: DrawingDocument,
  id: string,
  changes: Record<string, unknown>,
): DrawingCommand | null {
  const located = locateDrawingNode(document, id);
  if (!located) return null;
  const immutable = Object.keys(changes).find((key) => IMMUTABLE_FIELDS.has(key));
  if (immutable) throw new Error(`不可修改节点字段 ${immutable}`);

  const expected = Object.fromEntries(Object.keys(changes).map((key) => [
    key,
    clone((located.node as unknown as Record<string, unknown>)[key]),
  ]));
  const payload = { id, changes: clone(changes), expected };
  switch (located.plane) {
    case 'geometry': return { type: 'geometry.update', ...payload, id: located.node.id };
    case 'annotation': return { type: 'annotation.update', ...payload, id: located.node.id };
    case 'relation': return { type: 'relation.update', ...payload, id: located.node.id };
    case 'feature': return { type: 'feature.update', ...payload, id: located.node.id };
  }
}

export function buildDeleteCommand(
  document: DrawingDocument,
  id: string,
): DrawingCommand | null {
  const located = locateDrawingNode(document, id);
  if (!located) return null;
  switch (located.plane) {
    case 'geometry': return { type: 'geometry.delete', id: located.node.id };
    case 'annotation': return { type: 'annotation.delete', id: located.node.id };
    case 'relation': return { type: 'relation.delete', id: located.node.id };
    case 'feature': return { type: 'feature.delete', id: located.node.id };
  }
}

export function buildClearCommands(document: DrawingDocument): DrawingCommand[] {
  return [
    ...document.relations.map((node): DrawingCommand => ({
      type: 'relation.delete', id: node.id,
    })),
    ...document.features.map((node): DrawingCommand => ({
      type: 'feature.delete', id: node.id,
    })),
    ...document.annotations.map((node): DrawingCommand => ({
      type: 'annotation.delete', id: node.id,
    })),
    ...document.geometry.map((node): DrawingCommand => ({
      type: 'geometry.delete', id: node.id,
    })),
  ];
}

export function createWorkspaceTransaction(input: {
  revision: RevisionId;
  commands: DrawingCommand[];
  actor: Actor;
  idFactory: IdFactory;
  goalId?: string;
}): DrawingTransaction {
  return {
    id: input.idFactory.next('transaction'),
    baseRevision: input.revision,
    actor: clone(input.actor),
    ...(input.goalId === undefined ? {} : { goalId: input.goalId }),
    commands: clone(input.commands),
    preconditions: [],
    postconditions: [{ type: 'document.valid' }],
    evidenceRefs: [],
  };
}

export function applyWorkspaceResult(
  current: DrawingWorkspaceState,
  result: RepositoryCommitResult,
): AppliedWorkspaceResult {
  if (result.status === 'rejected') {
    return {
      workspace: current,
      error: result.errors[0]?.message ?? '图纸事务被拒绝',
    };
  }
  if (result.status === 'already_satisfied') {
    return { workspace: current, error: null };
  }
  return {
    workspace: {
      document: clone(result.document),
      revision: result.revision,
      commits: [...clone(current.commits), clone(result.commit)],
    },
    error: null,
  };
}

function clone<T>(value: T): T {
  return value === undefined ? value : structuredClone(value);
}
