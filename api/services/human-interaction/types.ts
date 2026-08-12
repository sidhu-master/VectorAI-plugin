import type {
  HumanDecisionRequest,
  HumanDecisionResponse,
  PermissionGrant,
} from '../../../src/contracts/drawing-agent.js';
import type {
  DrawingDocument,
  DrawingTransaction,
} from '../../../src/drawing/index.js';

export type HumanInteractionRequirementReason =
  | 'EXISTING_CONSTRAINT_CHANGE'
  | 'PROTECTED_RESOURCE_CHANGE';

export interface HumanInteractionRequirement {
  action: string;
  resourceId: string;
  reasonCode: HumanInteractionRequirementReason;
}

export interface HumanInteractionProtection {
  resourceId: string;
  actions: string[];
  reason: string;
}

export interface HumanInteractionDiagnosticInput {
  code: string;
  severity: 'info' | 'warning' | 'candidate' | 'error';
}

export interface HumanInteractionPolicyInput {
  document: DrawingDocument;
  transaction: DrawingTransaction;
  protections: HumanInteractionProtection[];
  grants: PermissionGrant[];
  diagnostics?: HumanInteractionDiagnosticInput[];
}

export type HumanInteractionPolicyResult =
  | { status: 'allowed'; grantRefs: string[] }
  | {
      status: 'decision_required';
      requirements: HumanInteractionRequirement[];
      invalidGrantRefs: string[];
    }
  | {
      status: 'denied';
      requirements: HumanInteractionRequirement[];
      grantRefs: string[];
    };

export interface HumanInteractionRecord {
  request: HumanDecisionRequest;
  response?: HumanDecisionResponse;
  grants: PermissionGrant[];
  createdAt: number;
  resolvedAt?: number;
}

export interface HumanInteractionStore {
  appendRequest(runId: string, request: HumanDecisionRequest): Promise<void>;
  resolveRequest(
    runId: string,
    response: HumanDecisionResponse,
    grants: PermissionGrant[],
  ): Promise<HumanInteractionRecord>;
  getPending(runId: string): Promise<HumanDecisionRequest | null>;
  list(runId: string): Promise<HumanInteractionRecord[]>;
}
