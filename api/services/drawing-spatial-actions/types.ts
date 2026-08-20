import type { WorldModelSlice } from '../drawing-world-model/types.js';

export type SpatialActionMethod =
  | 'transform'
  | 'deform'
  | 'solve'
  | 'replace'
  | 'redraw'
  | 'hybrid'
  | 'raw';

export type SpatialActionFeasibility = 'ready' | 'ambiguous' | 'unsupported';

export interface SpatialActionSplitRequirement {
  nodeId: string;
  parameterRanges: Array<readonly [number, number]>;
}

export interface SpatialActionProposal {
  id: string;
  method: SpatialActionMethod;
  feasibility: SpatialActionFeasibility;
  targetRefs: string[];
  affectedNodeIds: string[];
  preserveRefs: string[];
  fixedInterfaceRefs: string[];
  requiredSplits: SpatialActionSplitRequirement[];
  diagnostics: Array<{
    code: 'TARGET_REF_UNRESOLVED' | 'SOURCE_SPLIT_REQUIRED' | 'METHOD_NEEDS_RELATIONS';
    refs: string[];
    detail: string;
  }>;
  estimatedCost: {
    modelDecisions: number;
    geometryOperations: number;
    verificationScope: 'local';
  };
}

export interface SpatialActionProposalRequest {
  goalDescription: string;
  world: WorldModelSlice;
  targetRefs: string[];
  preserveRefs: string[];
  interfaceRefs: string[];
  methods?: SpatialActionMethod[];
}
