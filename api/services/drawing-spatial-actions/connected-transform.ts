import {
  compileConnectedTransform as compileSharedConnectedTransform,
  findConnectedCarrierCandidates as findSharedConnectedCarrierCandidates,
  type ConnectedCarrierCandidate,
  type ConnectedTransformAudit,
  type ConnectedTransformInterfaceMetrics,
  type ConnectedTransformPortAudit,
} from '@vectorai/drawing-edit-core';

import type {
  DrawingCommand,
  DrawingDocument,
  Vec2,
} from '../../../src/drawing/index.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';

export type {
  ConnectedCarrierCandidate,
  ConnectedTransformInterfaceMetrics,
  ConnectedTransformPortAudit,
};

export interface ConnectedTransformCompilation {
  commands: DrawingCommand[];
  diagnostics: DrawingDiagnostic[];
  audit: ConnectedTransformAudit;
}

/** The Web runtime adapts the same Host-neutral solver used by DSH. */
export function findConnectedCarrierCandidates(
  document: DrawingDocument,
): ConnectedCarrierCandidate[] {
  return findSharedConnectedCarrierCandidates(document);
}

export function compileConnectedTransform(input: {
  document: DrawingDocument;
  carrierNodeId: string;
  targetCenter: Vec2;
  rotationDegrees?: number;
  contactTolerance?: number;
}): ConnectedTransformCompilation {
  const shared = compileSharedConnectedTransform(input);
  return {
    commands: shared.commands.map((command): DrawingCommand => {
      if (command.type !== 'node.update') {
        throw new Error('CONNECTED_TRANSFORM_COMMAND_UNSUPPORTED');
      }
      return {
        type: 'geometry.update',
        id: command.id as never,
        changes: structuredClone(command.changes) as never,
        expected: structuredClone(command.expected) as never,
      };
    }),
    diagnostics: shared.diagnostics.map((diagnostic): DrawingDiagnostic => ({
      code: diagnostic.code,
      severity: diagnostic.severity === 'error' ? 'warning' : diagnostic.severity,
      message: diagnostic.message,
      nodeIds: [...(diagnostic.nodeIds ?? [])],
      ...(diagnostic.action ? { action: diagnostic.action } : {}),
      ...(diagnostic.facts ? { facts: structuredClone(diagnostic.facts) } : {}),
    })),
    audit: structuredClone(shared.audit),
  };
}
