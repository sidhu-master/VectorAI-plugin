import type {
  DrawingCommand,
  DrawingDocument,
  RevisionId,
  Vec2,
} from '../../../src/drawing/index.js';

export type SpatialPointRef =
  | {
      kind: 'observation';
      observationId: string;
      normalized: Vec2;
    }
  | {
      kind: 'world';
      frameId: string;
      point: Vec2;
    }
  | {
      kind: 'node_anchor';
      nodeId: string;
      anchor: 'center' | 'start' | 'end' | 'vertex';
      index?: number;
    };

export interface SpatialTarget {
  id: string;
  description: string;
  nodeRefs: string[];
  visualAnchors?: SpatialPointRef[];
  interfaceRefs?: SpatialPointRef[];
}

export type SpatialOperation =
  | {
      kind: 'translate';
      nodeIds: string[];
      from?: SpatialPointRef;
      to?: SpatialPointRef;
      delta?: Vec2;
    }
  | {
      kind: 'set_endpoint';
      nodeId: string;
      endpoint: 'start' | 'end';
      point: SpatialPointRef;
    }
  | {
      kind: 'create_path';
      geometry: 'line' | 'polyline';
      points: SpatialPointRef[];
      closed?: boolean;
      nodeId?: string;
    }
  | {
      kind: 'delete_nodes';
      nodeIds: string[];
    };

export type SpatialPostcondition =
  | {
      kind: 'anchors_coincident';
      first: SpatialPointRef;
      second: SpatialPointRef;
      toleranceRatio?: number;
    }
  | {
      kind: 'anchor_at';
      anchor: SpatialPointRef;
      point: SpatialPointRef;
      toleranceRatio?: number;
    }
  | { kind: 'nodes_unchanged'; nodeIds: string[] }
  | { kind: 'path_closed'; nodeId: string };

export interface SpatialEditProgram {
  baseRevision: RevisionId;
  replacesPreviewHandle?: string;
  summary: string;
  intent: string;
  targets: SpatialTarget[];
  operations: SpatialOperation[];
  preserveNodeRefs: string[];
  postconditions: SpatialPostcondition[];
  evidenceRefs: string[];
  confidence?: number;
}

export interface SpatialOperationReceipt {
  operationIndex: number;
  kind: SpatialOperation['kind'];
  affectedNodeIds: string[];
  resolvedPoints: Array<{ role: string; point: Vec2 }>;
  commands: DrawingCommand[];
}

export interface SpatialProgramCompilation {
  commands: DrawingCommand[];
  receipts: SpatialOperationReceipt[];
  diagnostics: SpatialProgramDiagnostic[];
  document: DrawingDocument;
}

export interface SpatialProgramDiagnostic {
  kind: SpatialPostcondition['kind'] | 'program';
  status: 'passed' | 'failed' | 'warning';
  message: string;
  measured?: number;
  tolerance?: number;
  nodeIds?: string[];
}

export type SpatialProgramErrorCode =
  | 'SPATIAL_OBSERVATION_EXPIRED'
  | 'SPATIAL_OBSERVATION_DRAWING_MISMATCH'
  | 'SPATIAL_OBSERVATION_REVISION_MISMATCH'
  | 'SPATIAL_FRAME_UNSUPPORTED'
  | 'SPATIAL_REFERENCE_UNRESOLVED'
  | 'SPATIAL_PROGRAM_INVALID'
  | 'SPATIAL_OPERATION_UNSUPPORTED'
  | 'SPATIAL_PROGRAM_PRESERVE_CONFLICT'
  | 'SPATIAL_PROGRAM_REVISION_MISMATCH';

export class SpatialProgramError extends Error {
  readonly code: SpatialProgramErrorCode;

  constructor(code: SpatialProgramErrorCode, message: string) {
    super(message);
    this.name = 'SpatialProgramError';
    this.code = code;
  }
}
