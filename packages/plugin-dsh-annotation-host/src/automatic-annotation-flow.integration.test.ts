// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { ToolRunContext } from '@deepseek-ai/dsh-tools';
import { analyzeShaftPartition, type PartitionDraft, type PartitionRevision } from '@vectorai/engineering-annotation';
import { importDxf } from '../../dxf-import/src/index';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AnnotationSessionStateStore } from './session-state';
import { DimensionInferenceService } from './dimension-inference-service';
import { DimensionPlanStore } from './dimension-plan-store';
import { evaluateShaftGdtCoverage, groundSegmentRecommendation } from './gdt-reviewer';
import { GdtService } from './gdt-service';
import { partitionGeometryFingerprint } from './partition-geometry-fingerprint';
import { PartitionSessionStore } from './partition-store';
import { resolveShaftGdtRules } from './shaft-gdt-rules';
import { createEngineeringAnnotationTool } from './tools';

const fixtureDirectory = resolve(import.meta.dirname, '../../engineering-annotation/test/fixtures/golden-shaft-001');

describe('complete automatic annotation workflow', () => {
  it('continues from a confirmed partition through dimensions, datum, GD&T and surface texture', async () => {
    const bytes = readFileSync(resolve(fixtureDirectory, 'initial.dxf'));
    const engineeringText = readFileSync(resolve(fixtureDirectory, 'engineering-data.ini'), 'utf8');
    const imported = importDxf({
      bytes,
      source: { digest: 'sha256:automatic-flow', name: 'initial.dxf' },
      drawingId: 'automatic-flow',
      now: () => 1,
    });
    if (imported.status !== 'imported') throw new Error('fixture import failed');
    const ref = { drawingId: 'automatic-flow', revision: 1 };
    const analyzed = analyzeShaftPartition({
      document: imported.document,
      drawingRef: ref,
      engineeringText,
      drawingSourceName: 'initial.dxf',
    });
    if (analyzed.status !== 'drafted') throw new Error('fixture partition failed');
    const draft = {
      ...analyzed.draft,
      geometryFingerprint: partitionGeometryFingerprint(imported.document),
    };
    const sessionId = 'session:automatic-flow';
    const agent = { id: sessionId } as Agent;
    const partitions = new PartitionSessionStore(undefined, { now: () => 2, id: () => 'partition:confirmed' });
    partitions.bindDrawing(sessionId, ref);
    partitions.beginAnalysis(sessionId, ref);
    partitions.setDraft(sessionId, draft);
    partitions.confirm(sessionId, ref);

    const plans = new DimensionPlanStore(undefined, { now: () => 3, id: () => 'dimension:preview' });
    const host = {
      getSnapshot: () => ({
        version: 1 as const,
        ref,
        document: imported.document,
        capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
      }),
      runExtensionProgram: async () => ({ result: {
        status: 'rejected' as const,
        disposition: 'confirmation_required' as const,
        code: 'LIFECYCLE_CHANGE',
        message: 'The candidate requires an exact human confirmation before commit.',
        operationId: 'operation:deterministic',
        operationBindingDigest: 'sha256:deterministic',
      } }),
    };
    const dimensions = new DimensionInferenceService(
      host,
      partitions,
      { getStagedEngineeringText: () => engineeringText },
      plans,
    );
    const gdt = new GdtService(host, plans, async ({ partition }) => {
      const resolution = resolveShaftGdtRules(partition);
      return {
        ...groundSegmentRecommendation(imported.document.geometry, partition, resolution.recommendation),
        coverage: evaluateShaftGdtCoverage(partition, resolution.recommendation, resolution.questions),
      };
    });
    const tool = createEngineeringAnnotationTool(
      host,
      new AnnotationSessionStateStore(undefined, { now: () => 4 }),
      partitions,
      plans,
      {
        name: 'drawing_auto_annotate',
        description: 'automatic set',
        annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'],
        objective: '工程图纸自动标注集',
        afterAnnotations: (currentAgent) => {
          dimensions.start(currentAgent);
          const partition = partitions.get(String(currentAgent.id));
          const value = partition.confirmed ?? partition.draft;
          if (!value) throw new Error('GDT_PARTITION_REQUIRED');
          return gdt.startAutomatic(currentAgent, value as unknown as PartitionDraft | PartitionRevision);
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
        displayedDimensionCount: number;
        datumCount: number;
        geometricToleranceCount: number;
      };
    };

    expect(result.annotationSet).toMatchObject({
      completionStatus: 'preview-ready',
      completionClaimAllowed: true,
    });
    expect(result.annotationSet.displayedDimensionCount).toBeGreaterThan(0);
    expect(result.annotationSet.datumCount).toBe(2);
    expect(result.annotationSet.geometricToleranceCount).toBeGreaterThan(0);
    const completedDraft = plans.get(sessionId).draft;
    expect(completedDraft?.surfaceTextures.length).toBeGreaterThan(0);
    expect(completedDraft?.diagnostics).toContainEqual(expect.objectContaining({ code: 'GDT_COVERAGE_COMPLETE' }));
  });
});
