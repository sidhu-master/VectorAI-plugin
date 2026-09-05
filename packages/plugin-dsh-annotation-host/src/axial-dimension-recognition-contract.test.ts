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
const transitionFixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/external-golden-001');

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

    expect(report.attempts.flatMap(({ failures }) => failures)).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.attempts).toHaveLength(3);
    expect(report.attempts.every(({ trace }) => trace.length === 6)).toBe(true);
    expect(report.attempts.every(({ modelObservations }) => modelObservations.length === 0)).toBe(true);
    expect(review).not.toHaveBeenCalled();
  });

  it('keeps document-backed feature dimensions after the runtime document text is unavailable', async () => {
    const engineeringText = readFileSync(resolve(transitionFixtureDirectory, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes: readFileSync(resolve(transitionFixtureDirectory, 'initial.dxf')),
      source: { name: 'initial.dxf', digest: 'sha256:transition-heavy-shaft' },
      drawingId: 'contract:transition-heavy-shaft',
      now: () => 1,
    });
    if (imported.status !== 'imported') throw new Error('CONTRACT_FIXTURE_IMPORT_FAILED');
    const ref = { drawingId: 'contract:transition-heavy-shaft', revision: 1 };
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
      // The confirmed partition is persisted, while uploaded document text is
      // process-local and may be unavailable after DSH restarts.
      engineeringText: '',
      policyId: 'shaft-hierarchical-dimensioning-v1',
    };

    const report = await runner.evaluate<AxialDimensionPipelineInput, EngineeringAnnotationDraft>({
      id: 'transition-heavy-shaft-axial-dimension-v1',
      pipelineId: AXIAL_DIMENSION_PIPELINE_ID,
      input,
      attempts: 1,
      fixtureDigest: recognitionDigest({ fixture: 'external-golden-001' }),
      policyDigests: [recognitionDigest('shaft-hierarchical-dimensioning-v1@1')],
      assert: ({ axialScheme }) => axialScheme === undefined
        ? ['axial scheme missing']
        : compareTransitionHeavyScheme(axialScheme),
    });

    expect(report.attempts.flatMap(({ failures }) => failures)).toEqual([]);
    expect(report.passed).toBe(true);
    expect(report.attempts[0]?.trace).toHaveLength(6);
    expect(review).not.toHaveBeenCalled();
  });
});

function compareTransitionHeavyScheme(scheme: AxialDimensionScheme): string[] {
  const visible = sortIntervals(intervals([
    ...scheme.displayedCandidateIds,
    ...scheme.closureCandidateIds.filter((id) => (
      scheme.candidates.find((candidate) => candidate.id === id)?.constraint !== 'prohibited'
    )),
  ], scheme));
  const failures: string[] = [];
  const forbiddenTransitions: Array<[number, number]> = [[0, 2], [20, 22], [61, 62], [207, 208]];
  const requiredFeatures: Array<[number, number]> = [
    [2, 20], [31, 61], [62, 81], [81, 115], [138, 198], [198, 201], [208, 244], [270, 286],
  ];
  if (scheme.status !== 'resolved') {
    failures.push(`document-backed partition did not resolve the scheme: ${scheme.status}`);
  }
  if (forbiddenTransitions.some((interval) => visible.some((candidate) => same(candidate, interval)))) {
    failures.push(`transition detail entered the visible dimension scheme: ${JSON.stringify(visible)}`);
  }
  if (requiredFeatures.some((interval) => !visible.some((candidate) => same(candidate, interval)))) {
    failures.push(`document-required feature dimension missing: ${JSON.stringify(visible)}`);
  }
  const chainMemberIds = new Set(scheme.chains.flatMap((chain) => [
    chain.parentCandidateId,
    ...chain.childCandidateIds,
    chain.closureCandidateId,
  ]));
  const ungroupedRequired = scheme.candidates
    .filter((candidate) => candidate.required && candidate.roles.includes('functional') && !chainMemberIds.has(candidate.id))
    .map((candidate) => range(candidate.id, scheme));
  if (ungroupedRequired.length > 0) {
    failures.push(`document-required feature dimension is outside every chain: ${JSON.stringify(sortIntervals(ungroupedRequired))}`);
  }
  const equationTransitions: Array<[number, number]> = [[0, 2], [20, 22], [61, 62], [201, 207], [207, 208]];
  const missingEquationTransitions = equationTransitions.filter((interval) => ![...chainMemberIds]
    .map((id) => range(id, scheme))
    .some((candidate) => same(candidate, interval)));
  if (missingEquationTransitions.length > 0) {
    failures.push(`suppressed transition is missing from the chain equation: ${JSON.stringify(missingEquationTransitions)}`);
  }
  return failures;
}

function compareScheme(scheme: AxialDimensionScheme, manifest: GoldenManifest): string[] {
  const failures: string[] = [];
  if (!same(scheme.topology.stations.map(({ coordinate }) => coordinate), manifest.stations)) {
    failures.push('station contract changed');
  }
  const displayedIntervals = sortIntervals(intervals(scheme.displayedCandidateIds, scheme));
  const expectedDisplayedIntervals = sortIntervals(manifest.displayedIntervals);
  if (!same(displayedIntervals, expectedDisplayedIntervals)) {
    failures.push(`displayed interval contract changed: ${JSON.stringify(displayedIntervals)} != ${JSON.stringify(expectedDisplayedIntervals)}`);
  }
  const closureIntervals = sortIntervals(intervals(scheme.closureCandidateIds, scheme));
  const expectedClosureIntervals = sortIntervals(manifest.closureIntervals);
  if (!same(closureIntervals, expectedClosureIntervals)) {
    failures.push(`closure interval contract changed: ${JSON.stringify(closureIntervals)} != ${JSON.stringify(expectedClosureIntervals)}`);
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
  if (!same(chains, expectedChains)) {
    failures.push(`dimension chain equation contract changed: ${JSON.stringify(chains)} != ${JSON.stringify(expectedChains)}`);
  }
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
