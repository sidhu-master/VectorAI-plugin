// SPDX-License-Identifier: Apache-2.0

import type { GeometryId } from '@vectorai/drawing-core';
import { describe, expect, it } from 'vitest';
import {
  orderDimensionIntents,
  type AnnotationDependency,
  type DimensionFunctionalRole,
  type DimensionIntent,
} from '../index';

function intent(id: string, role: DimensionFunctionalRole, geometryId = `geometry-${id}`): DimensionIntent {
  return {
    id,
    drawingRef: { drawingId: 'drawing-1', revision: 1 },
    kind: 'linear',
    targets: [{ geometryId: geometryId as GeometryId, anchor: { kind: 'end' } }],
    datumIds: [],
    nominalValue: 1,
    unit: 'mm',
    functionalRole: role,
    source: 'geometry',
    status: 'resolved',
    evidenceIds: [`geometry:${geometryId}`],
  };
}

function edge(beforeIntentId: string, afterIntentId: string, reason: AnnotationDependency['reason'] = 'explicit-document-order'): AnnotationDependency {
  return { beforeIntentId, afterIntentId, reason, evidenceIds: [`order:${beforeIntentId}:${afterIntentId}`] };
}

describe('dimension dependency order', () => {
  it('honors graph dependencies before default functional ranks', () => {
    const result = orderDimensionIntents({
      intents: [intent('closure', 'closure'), intent('datum', 'datum'), intent('component', 'process')],
      dependencies: [
        edge('datum', 'component', 'datum-before-dependent'),
        edge('component', 'closure', 'component-before-closure'),
      ],
    });
    expect(result.orderedIntentIds).toEqual(['datum', 'component', 'closure']);
    expect(result.diagnostics).toEqual([]);
  });

  it('uses role, stable geometry target, then ID to break ready-queue ties', () => {
    const result = orderDimensionIntents({
      intents: [
        intent('process-z', 'process', 'geometry-b'),
        intent('functional-z', 'functional', 'geometry-a'),
        intent('overall', 'overall', 'geometry-z'),
        intent('process-b', 'process', 'geometry-a'),
        intent('process-a', 'process', 'geometry-a'),
      ],
      dependencies: [],
    });
    expect(result.orderedIntentIds).toEqual([
      'overall', 'functional-z', 'process-a', 'process-b', 'process-z',
    ]);
  });

  it('normalizes duplicate edges and reports unknown endpoints without blocking valid nodes', () => {
    const duplicate = edge('a', 'b');
    const result = orderDimensionIntents({
      intents: [intent('b', 'process'), intent('a', 'process')],
      dependencies: [duplicate, structuredClone(duplicate), edge('missing', 'b')],
    });
    expect(result.orderedIntentIds).toEqual(['a', 'b']);
    expect(result.diagnostics.map(({ code }) => code)).toEqual(['DIMENSION_DEPENDENCY_UNKNOWN']);
  });

  it('does not silently break a cycle and identifies every blocked intent', () => {
    const result = orderDimensionIntents({
      intents: [intent('c', 'process'), intent('a', 'datum'), intent('b', 'functional')],
      dependencies: [edge('a', 'b'), edge('b', 'c'), edge('c', 'a')],
    });
    expect(result.orderedIntentIds).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'DIMENSION_DEPENDENCY_CYCLE',
        severity: 'error',
        entityIds: ['a', 'b', 'c'],
      }),
    ]);
  });
});
