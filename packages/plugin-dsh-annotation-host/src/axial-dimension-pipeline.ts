// SPDX-License-Identifier: Apache-2.0

import { convertLength, type LengthUnit } from '@vectorai/drawing-core';
import {
  buildAxialTopology,
  generateAxialDimensionCandidates,
  inferAxialDimensionScheme,
  parseEngineeringDocument,
  policyById,
  projectAxialDimensionScheme,
  type AxialDimensionScheme,
  type AxialInferencePolicy,
  type EngineeringAnnotationDraft,
  type ParsedEngineeringDocument,
  type PartitionDraft,
  type PartitionRevision,
} from '@vectorai/engineering-annotation';
import type { DrawingWorkspaceSnapshot } from '@vectorai/plugin-space-contracts';
import { partitionGeometryFingerprint } from './partition-geometry-fingerprint';
import {
  recognitionDigest,
  type RecognitionPipeline,
  type RecognitionPipelineRunner,
} from './recognition-runtime';

export const AXIAL_DIMENSION_PIPELINE_ID = 'axial-dimension-inference';
export const AXIAL_DIMENSION_PIPELINE_VERSION = '1';

export interface AxialDimensionPipelineInput {
  drawing: DrawingWorkspaceSnapshot;
  partition: PartitionDraft | PartitionRevision;
  engineeringText: string;
  policyId: AxialInferencePolicy['id'];
}

export type AxialDimensionInference = (
  input: AxialDimensionPipelineInput,
  signal?: AbortSignal,
) => Promise<EngineeringAnnotationDraft>;

export function createAxialDimensionPipeline(): RecognitionPipeline<
  AxialDimensionPipelineInput,
  EngineeringAnnotationDraft
> {
  return {
    id: AXIAL_DIMENSION_PIPELINE_ID,
    version: AXIAL_DIMENSION_PIPELINE_VERSION,
    async execute(input, context) {
      assertPartitionGeometryCurrent(input.drawing, input.partition);
      context.record({
        id: 'dimension-partition-validation', kind: 'validation', status: 'completed',
        digest: recognitionDigest({
          drawingRef: input.drawing.ref,
          partitionRef: input.partition.drawingRef,
          geometryFingerprint: input.partition.geometryFingerprint,
        }),
      });

      const document = normalizeDocumentCoordinates(
        parseEngineeringDocument(input.engineeringText),
        input.drawing.document.unitSystem.length,
      );
      context.record({
        id: 'dimension-document-normalization', kind: 'deterministic', status: 'completed',
        digest: recognitionDigest({
          drawing: document.drawing,
          regions: document.regions.map(({ id, interval, outerDiameter }) => ({ id, interval, outerDiameter })),
          diagnosticCodes: document.diagnostics.map(({ code }) => code),
        }),
      });

      const topology = buildAxialTopology({
        partition: input.partition,
        document: input.drawing.document,
        unit: input.drawing.document.unitSystem.length,
      });
      context.record({
        id: 'dimension-topology', kind: 'deterministic', status: 'completed',
        digest: recognitionDigest(topology),
      });

      const candidateSet = generateAxialDimensionCandidates({
        topology,
        partition: input.partition,
        document,
      });
      context.record({
        id: 'dimension-candidates', kind: 'deterministic', status: 'completed',
        digest: recognitionDigest(candidateSet),
      });

      const scheme = inferAxialDimensionScheme({
        topology,
        candidateSet,
        policy: policyById(input.policyId),
        ...('id' in input.partition ? { partitionRevisionId: input.partition.id } : {}),
      });
      context.record({
        id: 'dimension-inference', kind: 'deterministic', status: 'completed',
        digest: recognitionDigest(scheme),
      });

      const projection = projectAxialDimensionScheme({ scheme });
      context.record({
        id: 'dimension-projection', kind: 'grounding', status: 'completed',
        digest: recognitionDigest({
          intentIds: projection.intents.map(({ id }) => id),
          chainIds: projection.chains.map(({ id }) => id),
          diagnosticCodes: projection.diagnostics.map(({ code }) => code),
        }),
      });
      return projection;
    },
    normalize: (output) => ({
      drawingRef: structuredClone(output.drawingRef),
      intents: structuredClone(output.intents),
      chains: structuredClone(output.chains),
      dependencies: structuredClone(output.dependencies),
      diagnostics: structuredClone(output.diagnostics),
      axialScheme: structuredClone(output.axialScheme),
    }),
  };
}

export function createAxialDimensionInference(
  runner: RecognitionPipelineRunner,
): AxialDimensionInference {
  return async (input, signal) => (
    await runner.run<AxialDimensionPipelineInput, EngineeringAnnotationDraft>(
      AXIAL_DIMENSION_PIPELINE_ID,
      input,
      signal,
    )
  ).output;
}

/** Re-project an already inferred scheme after a user edit without re-running recognition. */
export function projectEditedAxialDimensionScheme(input: {
  scheme: AxialDimensionScheme;
  baseRevisionId?: string;
}): EngineeringAnnotationDraft {
  return projectAxialDimensionScheme(input);
}

function assertPartitionGeometryCurrent(
  drawing: DrawingWorkspaceSnapshot,
  partition: PartitionDraft | PartitionRevision,
): void {
  if (
    drawing.ref.drawingId !== partition.drawingRef.drawingId
    || partition.geometryFingerprint === undefined
    || partition.geometryFingerprint !== partitionGeometryFingerprint(drawing.document)
  ) {
    throw new Error('DIMENSION_PARTITION_STALE');
  }
}

function normalizeDocumentCoordinates(
  document: ParsedEngineeringDocument,
  drawingUnit: LengthUnit,
): ParsedEngineeringDocument {
  const sourceUnit = document.drawing.unit ?? drawingUnit;
  if (sourceUnit === drawingUnit && document.drawing.unit === drawingUnit) return document;
  return {
    ...document,
    drawing: { ...document.drawing, unit: drawingUnit },
    regions: document.regions.map((region) => ({
      ...region,
      ...(region.interval === undefined ? {} : {
        interval: {
          start: convertLength(region.interval.start, sourceUnit, drawingUnit),
          end: convertLength(region.interval.end, sourceUnit, drawingUnit),
        },
      }),
      ...(region.outerDiameter === undefined ? {} : {
        outerDiameter: convertLength(region.outerDiameter, sourceUnit, drawingUnit),
      }),
    })),
  };
}
