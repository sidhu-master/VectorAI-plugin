// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  analyzeShaftPartition,
  inferRegularShaftRegions,
  type AxialDimensionScheme,
  type EngineeringAnnotationDraft,
} from '@vectorai/engineering-annotation';
import { importDxf } from '../../dxf-import/src/index';
import { describe, expect, it, vi } from 'vitest';
import { createAnnotationRecognitionRunner } from './annotation-recognition-runtime';
import {
  AXIAL_DIMENSION_PIPELINE_ID,
  type AxialDimensionPipelineInput,
} from './axial-dimension-pipeline';
import { partitionGeometryFingerprint } from './partition-geometry-fingerprint';
import { recognitionDigest, type RecognitionModelPort } from './recognition-runtime';

const fixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001');

interface GoldenManifest {
  stations: number[];
  displayedIntervals: Array<[number, number]>;
  closureIntervals: Array<[number, number]>;
  chains: Array<{
    parent: [number, number];
    children: Array<[number, number]>;
    closure: [number, number];
  }>;
}

describe('axial dimension recognition contract', () => {
  it('evaluates the production golden-shaft inference and rejects micro-span drift', async () => {
    const engineeringText = readFileSync(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8');
    const manifest = JSON.parse(readFileSync(resolve(fixtureDirectory, 'manifest.json'), 'utf8')) as GoldenManifest;
    const imported = importDxf({
      bytes: readFileSync(resolve(fixtureDirectory, 'initial.dxf')),
      source: { name: 'initial.dxf', digest: 'sha256:57f79b850e95e852e6ea427711e2534effeecf0f90257340504efcc3f498c1b2' },
      drawingId: 'contract:axial-dimension',
      now: () => 1,
    });
    if (imported.status !== 'imported') throw new Error('CONTRACT_FIXTURE_IMPORT_FAILED');
    const ref = { drawingId: 'contract:axial-dimension', revision: 1 };
    const analyzed = analyzeShaftPartition({
      document: imported.document,
      drawingRef: ref,
      engineeringText,
      drawingSourceName: 'initial.dxf',
    });
    if (analyzed.status !== 'drafted') throw new Error('CONTRACT_PARTITION_FAILED');
    const partition = {
      ...inferRegularShaftRegions(analyzed.draft),
      geometryFingerprint: partitionGeometryFingerprint(imported.document),
    };
    const review = vi.fn(async () => { throw new Error('MODEL_MUST_NOT_RUN'); });
    const runner = createAnnotationRecognitionRunner({ review } as RecognitionModelPort, {} as never);
    const input: AxialDimensionPipelineInput = {
      drawing: {
        version: 1,
        ref,
        document: imported.document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      },
      partition,
      engineeringText,
      policyId: 'shaft-hierarchical-dimensioning-v1',
    };

    const report = await runner.evaluate<AxialDimensionPipelineInput, EngineeringAnnotationDraft>({
      id: 'golden-shaft-axial-dimension-v1',
      pipelineId: AXIAL_DIMENSION_PIPELINE_ID,
      input,
      attempts: 3,
      fixtureDigest: recognitionDigest({ fixture: 'golden-shaft-001', manifest }),
      policyDigests: [recognitionDigest('shaft-hierarchical-dimensioning-v1@1')],
      assert: ({ axialScheme }) => axialScheme === undefined
        ? ['axial scheme missing']
        : compareScheme(axialScheme, manifest),
    });

    expect(report.passed).toBe(true);
    expect(report.attempts).toHaveLength(3);
    expect(report.attempts.every(({ trace }) => trace.length === 6)).toBe(true);
    expect(report.attempts.every(({ modelObservations }) => modelObservations.length === 0)).toBe(true);
    expect(review).not.toHaveBeenCalled();
  });
});

function compareScheme(scheme: AxialDimensionScheme, manifest: GoldenManifest): string[] {
  const failures: string[] = [];
  if (!same(scheme.topology.stations.map(({ coordinate }) => coordinate), manifest.stations)) {
    failures.push('station contract changed');
  }
  if (!same(sortIntervals(intervals(scheme.displayedCandidateIds, scheme)), sortIntervals(manifest.displayedIntervals))) {
    failures.push('displayed interval contract changed');
  }
  if (!same(sortIntervals(intervals(scheme.closureCandidateIds, scheme)), sortIntervals(manifest.closureIntervals))) {
    failures.push('closure interval contract changed');
  }
  const chains = scheme.chains.map((chain) => ({
    parent: range(chain.parentCandidateId, scheme),
    children: sortIntervals(intervals(chain.childCandidateIds, scheme)),
    closure: range(chain.closureCandidateId, scheme),
  })).sort((left, right) => left.parent[0] - right.parent[0] || left.parent[1] - right.parent[1]);
  const expectedChains = manifest.chains.map((chain) => ({
    parent: chain.parent,
    children: sortIntervals(chain.children),
    closure: chain.closure,
  })).sort((left, right) => left.parent[0] - right.parent[0] || left.parent[1] - right.parent[1]);
  if (!same(chains, expectedChains)) failures.push('dimension chain equation contract changed');
  if (scheme.candidates.some(({ nominalValue }) => nominalValue > 0 && nominalValue < 1)) failures.push('micro-span candidate introduced');
  return failures;
}

function intervals(ids: readonly string[], scheme: AxialDimensionScheme): Array<[number, number]> {
  return ids.map((id) => range(id, scheme));
}

function range(id: string, scheme: AxialDimensionScheme): [number, number] {
  const stations = new Map(scheme.topology.stations.map(({ id: stationId, coordinate }) => [stationId, coordinate]));
  const candidate = scheme.candidates.find(({ id: candidateId }) => candidateId === id);
  if (!candidate) throw new Error(`CONTRACT_CANDIDATE_MISSING:${id}`);
  return [stations.get(candidate.startStationId)!, stations.get(candidate.endStationId)!];
}

function sortIntervals(values: Array<[number, number]>): Array<[number, number]> {
  return [...values].sort((left, right) => left[0] - right[0] || left[1] - right[1]);
}

function same(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
