import { describe, expect, it } from 'vitest';

import {
  createEmptyDrawing,
  type DrawingDocument,
  type GeometryId,
  type RelationId,
} from '../../../src/drawing';
import { DrawingSpatialContextIndex } from './context-index';

describe('DrawingSpatialContextIndex', () => {
  it('keeps a complete cross-boundary primitive addressable from overlapping regions', () => {
    const document = fixtureDocument();
    const index = new DrawingSpatialContextIndex(document, {
      maxLeafNodes: 1, maxDepth: 4, overlapRatio: 0.08,
    });

    expect(index.query({ minX: -12, minY: -2, maxX: -1, maxY: 2 }).map((item) => item.id))
      .toContain('line_cross');
    expect(index.query({ minX: 1, minY: -2, maxX: 12, maxY: 2 }).map((item) => item.id))
      .toContain('line_cross');
    const map = index.globalMap();
    expect(map.regions.length).toBeGreaterThan(1);
    expect(JSON.stringify(map.regions)).not.toContain('line_cross');
  });

  it('expands a local working set through explicit topology and labels spatial context separately', () => {
    const index = new DrawingSpatialContextIndex(fixtureDocument(), {
      neighborPaddingRatio: 0.03,
    });

    const workingSet = index.workingSet(['arm_upper'], { limit: 8 });

    expect(workingSet.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'arm_upper', relevance: 'target' }),
      expect.objectContaining({ id: 'arm_lower', relevance: 'relation' }),
      expect.objectContaining({ id: 'body_overlap', relevance: 'neighbor' }),
    ]));
    expect(workingSet.nodes.find((item) => item.id === 'body_overlap')?.relevance)
      .not.toBe('target');
  });

  it('projects a bounded global map without enumerating every exact node', () => {
    const document = fixtureDocument();
    for (let index = 0; index < 120; index += 1) {
      document.geometry.push(line(`grid_${index}`, [index, 20], [index, 30]));
    }
    const spatial = new DrawingSpatialContextIndex(document, {
      maxLeafNodes: 12, maxDepth: 5,
    });

    const map = spatial.globalMap();

    expect(map.counts.geometry).toBe(124);
    expect(map.regions.length).toBeLessThan(128);
    expect(map.topology).toMatchObject({ relationCount: 1, connectedComponentCount: 1 });
    expect(JSON.stringify(map)).not.toContain('grid_119');
  });
});

function fixtureDocument(): DrawingDocument {
  const document = createEmptyDrawing({ now: () => 1 });
  document.geometry.push(
    line('line_cross', [-10, 0], [10, 0]),
    line('arm_upper', [8, 8], [14, 12]),
    line('arm_lower', [14, 12], [18, 16]),
    line('body_overlap', [8, 8], [8, -8]),
  );
  document.relations.push({
    id: 'relation_arm' as RelationId,
    type: 'topology', plane: 'topology', kind: 'connected',
    visible: true, quality: { status: 'confirmed', evidenceRefs: [] },
    nodeIds: ['arm_upper', 'arm_lower'],
  });
  return document;
}

function line(id: string, start: readonly [number, number], end: readonly [number, number]) {
  return {
    id: id as GeometryId,
    type: 'line' as const,
    visible: true,
    quality: { status: 'confirmed' as const, evidenceRefs: [] },
    start,
    end,
  };
}
