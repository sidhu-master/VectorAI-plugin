import { describe, expect, it } from 'vitest';

import { createEmptyDrawing } from '../../../src/drawing/document/create';
import type {
  AnnotationId,
  GeometryId,
  RelationId,
  RevisionId,
} from '../../../src/drawing/document/types';
import type { DrawingTransaction } from '../../../src/drawing/transaction/types';
import type { PermissionGrant } from '../../../src/contracts/drawing-agent';
import {
  HumanInteractionPolicy,
  digestDrawingTransaction,
  permissionGrantMatches,
} from './policy';

const confirmed = { status: 'confirmed' as const, evidenceRefs: [] };
const revision = 'revision_1' as RevisionId;

describe('HumanInteractionPolicy', () => {
  it('requires candidate permission for deleting an existing constraint', () => {
    const document = fixtureDocument();
    const transaction = candidate([{
      type: 'relation.delete', id: 'constraint_1' as RelationId,
    }]);
    const policy = new HumanInteractionPolicy();

    const result = policy.evaluate({ document, transaction, protections: [], grants: [] });

    expect(result).toEqual({
      status: 'decision_required',
      requirements: [{
        action: 'constraint.delete',
        resourceId: 'constraint_1',
        reasonCode: 'EXISTING_CONSTRAINT_CHANGE',
      }],
      invalidGrantRefs: [],
    });
  });

  it('requires permission to change a protected resource but not ordinary redraws', () => {
    const document = fixtureDocument();
    const policy = new HumanInteractionPolicy();
    const locked = candidate([{
      type: 'geometry.update', id: 'circle_1' as GeometryId, changes: { radius: 12 },
    }]);

    expect(policy.evaluate({
      document,
      transaction: locked,
      protections: [{
        resourceId: 'circle_1', actions: ['geometry.update'], reason: 'user-lock',
      }],
      grants: [],
    })).toMatchObject({
      status: 'decision_required',
      requirements: [{
        action: 'geometry.update', resourceId: 'circle_1', reasonCode: 'PROTECTED_RESOURCE_CHANGE',
      }],
    });

    const ordinary = candidate([
      { type: 'geometry.delete', id: 'circle_1' as GeometryId },
      {
        type: 'geometry.create', value: {
          id: 'line_2' as GeometryId,
          type: 'line', visible: true, quality: confirmed,
          start: [0, 0], end: [20, 0],
        },
      },
      {
        type: 'annotation.update', id: 'text_1' as AnnotationId,
        changes: { content: 'updated' },
      },
    ]);
    expect(policy.evaluate({
      document,
      transaction: ordinary,
      protections: [],
      grants: [],
      diagnostics: [{ code: 'OPEN_ENDPOINT', severity: 'warning' }],
    })).toEqual({ status: 'allowed', grantRefs: [] });
  });

  it('accepts only an exact referenced grant for the current candidate', () => {
    const document = fixtureDocument();
    const transaction = candidate([{
      type: 'relation.delete', id: 'constraint_1' as RelationId,
    }]);
    const digest = digestDrawingTransaction(transaction);
    const grant = permissionGrant({ transactionDigest: digest });
    transaction.metadata!.decisionGrantRefs = [grant.id];
    const policy = new HumanInteractionPolicy();

    expect(policy.evaluate({
      document, transaction, protections: [], grants: [grant],
    })).toEqual({ status: 'allowed', grantRefs: ['grant_1'] });

    for (const changed of [
      permissionGrant({ transactionDigest: digest, revision: 'revision_2' as RevisionId }),
      permissionGrant({ transactionDigest: 'f'.repeat(64) }),
      permissionGrant({ transactionDigest: digest, actions: ['constraint.update'] }),
      permissionGrant({ transactionDigest: digest, resourceIds: ['constraint_2'] }),
    ]) {
      expect(policy.evaluate({
        document, transaction, protections: [], grants: [changed],
      })).toMatchObject({
        status: 'decision_required', invalidGrantRefs: ['grant_1'],
      });
    }
  });

  it('treats an exact denial as a resolved denial and binds grants to the request', () => {
    const document = fixtureDocument();
    const transaction = candidate([{
      type: 'relation.delete', id: 'constraint_1' as RelationId,
    }]);
    const transactionDigest = digestDrawingTransaction(transaction);
    const denied = permissionGrant({ transactionDigest, effect: 'deny' });
    transaction.metadata!.decisionGrantRefs = [denied.id];
    const result = new HumanInteractionPolicy().evaluate({
      document, transaction, protections: [], grants: [denied],
    });

    expect(result).toEqual({
      status: 'denied', grantRefs: ['grant_1'],
      requirements: [{
        action: 'constraint.delete', resourceId: 'constraint_1',
        reasonCode: 'EXISTING_CONSTRAINT_CHANGE',
      }],
    });
    expect(permissionGrantMatches(denied, {
      requestId: 'another_request', episodeId: 'episode_1', revision,
      transactionDigest, actions: ['constraint.delete'], resourceIds: ['constraint_1'],
    })).toBe(false);
  });
});

function fixtureDocument() {
  const document = createEmptyDrawing({
    idFactory: { next: () => 'drawing_policy' }, now: () => 1,
  });
  document.geometry.push({
    id: 'circle_1' as GeometryId,
    type: 'circle', visible: true, quality: confirmed, center: [0, 0], radius: 10,
  });
  document.annotations.push({
    id: 'text_1' as AnnotationId,
    type: 'text', visible: true, quality: confirmed, content: 'R10',
    position: [12, 0], height: 2, rotation: 0,
    alignment: 'left', verticalAlignment: 'baseline',
  });
  document.relations.push({
    id: 'constraint_1' as RelationId,
    type: 'constraint', plane: 'constraint', kind: 'radius',
    visible: true, quality: confirmed, geometryIds: ['circle_1' as GeometryId],
    value: 10, status: 'satisfied',
  });
  return document;
}

function candidate(commands: DrawingTransaction['commands']): DrawingTransaction {
  return {
    id: 'transaction_1', baseRevision: revision,
    actor: { type: 'AI', id: 'drawing-agent' }, commands,
    preconditions: [], postconditions: [], evidenceRefs: [],
    metadata: {
      episodeId: 'episode_1', summary: 'Apply the candidate edit.',
      decisionGrantRefs: [],
    },
  };
}

function permissionGrant(overrides: Partial<PermissionGrant>): PermissionGrant {
  return {
    id: 'grant_1', requestId: 'request_1', episodeId: 'episode_1', revision,
    transactionDigest: 'a'.repeat(64),
    actions: ['constraint.delete'], resourceIds: ['constraint_1'],
    effect: 'allow', scope: 'candidate', ...overrides,
  };
}
