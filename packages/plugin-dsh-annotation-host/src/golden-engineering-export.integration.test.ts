// SPDX-License-Identifier: Apache-2.0

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CadReader } from '@node-projects/acad-ts';
import {
  analyzeShaftPartition,
  buildAxialTopology,
  generateAxialDimensionCandidates,
  inferAxialDimensionScheme,
  inferRegularShaftRegions,
  parseEngineeringDocument,
  planEngineeringAnnotations,
  SHAFT_HIERARCHICAL_DIMENSIONING_V1,
} from '@vectorai/engineering-annotation';
import { importDxf } from '../../dxf-import/src/index';
import type { DimensionPlanSessionSnapshot } from '@vectorai/plugin-space-contracts';
import { describe, expect, it } from 'vitest';

import { exportEngineeringDrawingDxf } from './engineering-dxf-export';
import { inspectCadContract } from './cad-test-inspector';

const fixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001');

describe('golden shaft complete engineering DXF export', () => {
  it('exports the rule-generated geometry, hatch, centerline, dimensions, datum and GD&T semantics as a valid CAD document', () => {
    const bytes = readFileSync(resolve(fixtureDirectory, 'initial.dxf'));
    const engineeringText = readFileSync(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes, source: { digest: 'sha256:golden-full-export', name: 'initial.dxf' },
      drawingId: 'golden-full-export', now: () => 1,
    });
    expect(imported.status).toBe('imported');
    if (imported.status !== 'imported') return;
    const ref = { drawingId: 'golden-full-export', revision: 1 };
    const planned = planEngineeringAnnotations({
      document: imported.document, ref, objective: '全部自动标注',
      annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
    });
    imported.document.annotations.push(...planned.annotations);

    const analyzed = analyzeShaftPartition({
      document: imported.document, drawingRef: ref, engineeringText, drawingSourceName: 'initial.dxf',
    });
    expect(analyzed.status).toBe('drafted');
    if (analyzed.status !== 'drafted') return;
    const partition = inferRegularShaftRegions(analyzed.draft);
    const engineering = parseEngineeringDocument(engineeringText);
    const topology = buildAxialTopology({ partition, unit: engineering.drawing.unit ?? 'mm' });
    const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: engineering });
    const axialScheme = inferAxialDimensionScheme({
      topology, candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1,
    });
    if (process.env.CAD_EXPORT_DEBUG) console.log(JSON.stringify({
      displayed: axialScheme.displayedCandidateIds,
      closures: axialScheme.closureCandidateIds,
      candidates: axialScheme.candidates,
    }, null, 2));
    const targetIds = imported.document.geometry.filter(({ type }) => type === 'line').slice(0, 2).map(({ id }) => id);
    expect(targetIds).toHaveLength(2);
    const confirmed = {
      version: 1 as const, drawingRef: ref, id: 'revision-1', generationOrder: [], confirmedAt: 1,
      datums: targetIds.map((geometryId, index) => ({
        id: `datum:${index === 0 ? 'A' : 'B'}`, drawingRef: ref, name: index === 0 ? 'A' : 'B', geometryId,
        anchor: { kind: 'start' as const }, role: index === 0 ? 'primary' as const : 'secondary' as const,
        source: 'ai-candidate' as const, status: 'candidate' as const, evidenceIds: [],
      })),
      intents: [], tolerances: [], chains: [], dependencies: [], diagnostics: [], axialScheme,
      geometricTolerances: targetIds.map((geometryId, index) => ({
        id: `gdt:${index}`, drawingRef: ref,
        characteristic: index === 0 ? 'circularity' as const : 'circular-runout' as const,
        controlledTargets: [{ geometryId, anchor: { kind: 'start' as const } }],
        toleranceZone: { shape: 'linear' as const },
        datumReferenceFrame: index === 0 ? [] : [{ datumId: 'datum:A' }, { datumId: 'datum:B' }],
        computed: { status: 'pending' as const, unit: 'mm' as const, diagnostics: [] },
        source: 'ai-candidate' as const, status: 'pending-calculation' as const, evidenceIds: [],
      })),
    };
    const snapshot = {
      version: 1, phase: 'confirmed', drawingRef: ref, confirmed,
      canUndo: false, canRedo: false, updatedAt: 1,
    } as unknown as DimensionPlanSessionSnapshot;

    const dxf = exportEngineeringDrawingDxf(imported.document, snapshot, { profile: 'caxa-compatible' });
    if (process.env.CAD_EXPORT_OUTPUT) writeFileSync(process.env.CAD_EXPORT_OUTPUT, dxf);
    const golden = inspectCadContract(readFileSync(resolve(fixtureDirectory, 'target.dxf'), 'utf8'));
    const actual = inspectCadContract(dxf);
    expect(dxf).toContain('1轮廓实线层');
    expect(dxf).toContain('3中心线层');
    expect(dxf).toContain('5剖面线层');
    expect(dxf).toContain('7标注层');
    expect(dxf).toContain('8符号标注层');
    expect(dxf).not.toMatch(/\r\n2\r\nGEOMETRY\r\n/);
    expect(entityCount(dxf, 'DIMENSION')).toBeGreaterThan(0);
    expect(entityCount(dxf, 'INSERT')).toBeGreaterThanOrEqual(4);
    expect(dxf).toContain('待计算');
    expect(actual.version).toBe(golden.version);
    for (const layer of ['1轮廓实线层', '3中心线层', '5剖面线层', '7标注层', '8符号标注层']) {
      expect(actual.layers[layer]).toEqual(golden.layers[layer]);
    }
    for (const style of ['GB_LINEAR', 'GB_ANGULAR', 'GB_RADIAL']) {
      expect(actual.dimensionStyles[style]).toEqual(golden.dimensionStyles[style]);
    }
    expect(actual.dimensionKinds.diametric).toBe(0);
    expect(actual.dimensionKinds.angular).toBe(golden.dimensionKinds.angular);
    expect(actual.dimensionKinds.radial).toBeGreaterThan(0);
    expect(actual.dimensionPictures).toEqual({ hasMText: true, hasHatchArrowheads: true });

    const reader = CadReader.createReader('golden-full-export.dxf', new TextEncoder().encode(dxf));
    try {
      const document = reader.read();
      document.restoreHandles();
      document.updateCollections(true, true);
    } finally {
      reader.dispose();
    }
  });
});

function entityCount(dxf: string, type: string): number {
  return (dxf.match(new RegExp(`(?:^|\\r?\\n)\\s*0\\r?\\n${type}\\r?\\n`, 'g')) ?? []).length;
}
