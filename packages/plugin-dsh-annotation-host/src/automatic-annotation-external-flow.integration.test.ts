// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { analyzeShaftPartition, type PartitionDraft, type PartitionRevision } from '@vectorai/engineering-annotation';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { importDxf } from '../../dxf-import/src/index';
import { createAnnotationRecognitionRunner } from './annotation-recognition-runtime';
import { createAxialDimensionInference } from './axial-dimension-pipeline';
import { createEngineeringAnnotationPlanner } from './deterministic-annotation-pipeline';
import { DimensionInferenceService } from './dimension-inference-service';
import { DimensionPlanStore } from './dimension-plan-store';
import { createAutomaticGdtReviewer } from './gdt-reviewer';
import { GdtService } from './gdt-service';
import { partitionGeometryFingerprint } from './partition-geometry-fingerprint';
import { PartitionSessionStore } from './partition-store';
import type { RecognitionModelPort } from './recognition-runtime';
import { AnnotationSessionStateStore } from './session-state';
import { createEngineeringAnnotationTool } from './tools';

const fixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/external-golden-001');

describe('automatic annotation workflow with the independent production-shaped shaft', () => {
  it('accepts the editable partition and completes dimensions, datum, GD&T, and surface texture in one call', async () => {
    const engineeringText = readFileSync(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes: readFileSync(resolve(fixtureDirectory, 'initial.dxf')),
      source: { digest: 'sha256:automatic-external-flow', name: 'initial.dxf' },
      drawingId: 'automatic-external-flow',
      now: () => 1,
    });
    if (imported.status !== 'imported') throw new Error('fixture import failed');
    const sessionId = 'session:automatic-external-flow';
    const agent = { id: sessionId } as Agent;
    let drawingRef = { drawingId: 'automatic-external-flow', revision: 1 };
    const analyzed = analyzeShaftPartition({
      document: imported.document,
      drawingRef,
      engineeringText,
      drawingSourceName: 'initial.dxf',
    });
    if (analyzed.status !== 'drafted') throw new Error('fixture partition failed');
    const partitions = new PartitionSessionStore(undefined, { now: () => 2, id: () => 'partition:external-confirmed' });
    partitions.bindDrawing(sessionId, drawingRef);
    partitions.beginAnalysis(sessionId, drawingRef);
    partitions.setDraft(sessionId, {
      ...analyzed.draft,
      geometryFingerprint: partitionGeometryFingerprint(imported.document),
    });

    const host = {
      getSnapshot: () => ({
        version: 1 as const,
        ref: drawingRef,
        document: imported.document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: vi.fn(async () => {
        const previous = drawingRef;
        drawingRef = { ...previous, revision: previous.revision + 1 };
        return { result: {
          status: 'committed' as const,
          mode: 'auto-safe' as const,
          commitId: 'commit:deterministic',
          ref: drawingRef,
          operationId: 'operation:deterministic',
          operationBindingDigest: 'sha256:deterministic',
        } };
      }),
      renderObservation: async () => { throw new Error('MODEL_STAGE_MUST_NOT_RUN_FOR_DOCUMENTED_EXTERNAL_FIXTURE'); },
    };
    const review = vi.fn(async () => { throw new Error('MODEL_STAGE_MUST_NOT_RUN_FOR_DOCUMENTED_EXTERNAL_FIXTURE'); });
    const recognition = createAnnotationRecognitionRunner({ review } as RecognitionModelPort, host);
    const plans = new DimensionPlanStore(undefined, { now: () => 3, id: () => 'dimension:external-preview' });
    const dimensions = new DimensionInferenceService(
      host,
      partitions,
      // Recreate the production lifecycle after DSH restarts: the confirmed
      // partition remains, but the process-local uploaded text does not.
      { getStagedEngineeringText: () => undefined },
      plans,
      createAxialDimensionInference(recognition),
    );
    const gdt = new GdtService(host, plans, createAutomaticGdtReviewer(recognition));
    const resolvePartitionDecision = vi.fn(async () => {
      partitions.confirmPending(sessionId);
      return 'confirm' as const;
    });
    const tool = createEngineeringAnnotationTool(
      host,
      new AnnotationSessionStateStore(undefined, { now: () => 4 }),
      partitions,
      plans,
      {
        planner: createEngineeringAnnotationPlanner(recognition),
        name: 'drawing_auto_annotate',
        description: 'automatic set',
        annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
        objective: '工程图纸自动标注集',
        preparePartition: async () => { throw new Error('EXISTING_EDITABLE_PARTITION_MUST_BE_REUSED'); },
        resolvePartitionDecision,
        afterAnnotations: async (currentAgent, signal) => {
          await dimensions.start(currentAgent, undefined, signal);
          const partition = partitions.get(String(currentAgent.id));
          const value = partition.confirmed ?? partition.draft;
          if (!value) throw new Error('GDT_PARTITION_REQUIRED');
          return gdt.startAutomatic(currentAgent, value as unknown as PartitionDraft | PartitionRevision, signal);
        },
        requiresGdtRecommendation: true,
      },
    );

    const result = await tool.execute({}, {
      agent,
      signal: new AbortController().signal,
    } as ToolRunContext) as unknown as {
      status: string;
      annotationSet: {
        completionStatus: string;
        completionClaimAllowed: boolean;
        terminal: boolean;
        nextAction: string;
        datumCount: number;
        geometricToleranceCount: number;
      };
    };

    expect(resolvePartitionDecision).toHaveBeenCalledOnce();
    expect(partitions.get(sessionId).phase).toBe('confirmed');
    expect(result.annotationSet).toMatchObject({
      completionStatus: 'complete',
      completionClaimAllowed: true,
      terminal: true,
      nextAction: 'report-automatic-annotation-complete-and-stop',
      datumCount: 2,
    });
    expect(result.annotationSet.geometricToleranceCount).toBeGreaterThan(0);
    const completed = plans.get(sessionId).draft;
    expect(completed?.axialScheme?.status).toBe('resolved');
    expect(completed?.surfaceTextures.length).toBeGreaterThan(0);
    expect(completed?.diagnostics).toContainEqual(expect.objectContaining({ code: 'GDT_COVERAGE_COMPLETE' }));
    const stations = new Map(completed?.axialScheme?.topology.stations.map(({ id, coordinate }) => [id, coordinate]));
    const visible = [...completed!.axialScheme!.displayedCandidateIds, ...completed!.axialScheme!.closureCandidateIds]
      .map((id) => completed!.axialScheme!.candidates.find((candidate) => candidate.id === id)!)
      .map((candidate) => [stations.get(candidate.startStationId), stations.get(candidate.endStationId)]);
    expect(visible).not.toContainEqual([207, 208]);
    expect(review).not.toHaveBeenCalled();
  });
});
