// SPDX-License-Identifier: Apache-2.0

import type { AnnotationNode, DrawingDocument } from '@vectorai/drawing-core';
import {
  planEngineeringAnnotations,
  type DeterministicAnnotationKind,
  type EngineeringAnnotationPlan,
} from '@vectorai/engineering-annotation';
import type { DrawingRef } from '@vectorai/plugin-space-contracts';
import {
  recognitionDigest,
  type RecognitionPipeline,
  type RecognitionPipelineRunner,
} from './recognition-runtime';

export const DETERMINISTIC_ANNOTATION_PIPELINE_ID = 'deterministic-engineering-annotation-plan';
export const DETERMINISTIC_ANNOTATION_PIPELINE_VERSION = '1';

export interface DeterministicAnnotationPipelineInput {
  document: DrawingDocument;
  ref: DrawingRef;
  objective: string;
  annotationKinds: readonly DeterministicAnnotationKind[];
}

export type EngineeringAnnotationPlanner = (
  input: DeterministicAnnotationPipelineInput,
  signal?: AbortSignal,
) => Promise<EngineeringAnnotationPlan>;

export function createDeterministicAnnotationPipeline(): RecognitionPipeline<
  DeterministicAnnotationPipelineInput,
  EngineeringAnnotationPlan
> {
  return {
    id: DETERMINISTIC_ANNOTATION_PIPELINE_ID,
    version: DETERMINISTIC_ANNOTATION_PIPELINE_VERSION,
    async execute(input, context) {
      const output = planEngineeringAnnotations(input);
      context.record({
        id: 'deterministic-annotation-plan',
        kind: 'deterministic',
        status: 'completed',
        digest: recognitionDigest({
          ref: input.ref,
          annotationKinds: [...input.annotationKinds],
          annotationIds: output.annotations.map(({ id }) => id),
          associationIds: output.associations.map(({ id }) => id),
          targetNodeIds: output.targetNodeIds,
          pending: output.pending,
          suppressed: output.suppressed,
          hasProgram: output.program !== null,
        }),
      });
      return output;
    },
    normalize: normalizePlan,
  };
}

export function createEngineeringAnnotationPlanner(
  runner: RecognitionPipelineRunner,
): EngineeringAnnotationPlanner {
  return async (input, signal) => (
    await runner.run<DeterministicAnnotationPipelineInput, EngineeringAnnotationPlan>(
      DETERMINISTIC_ANNOTATION_PIPELINE_ID,
      input,
      signal,
    )
  ).output;
}

function normalizePlan(output: EngineeringAnnotationPlan): unknown {
  return {
    annotations: output.annotations.map(normalizeAnnotation),
    associations: output.associations.map(({ id, annotationId, geometryIds, kind }) => ({
      id,
      annotationId,
      geometryIds: [...geometryIds],
      kind,
    })),
    targetNodeIds: [...output.targetNodeIds],
    pending: structuredClone(output.pending),
    suppressed: structuredClone(output.suppressed),
    hasProgram: output.program !== null,
  };
}

function normalizeAnnotation(annotation: AnnotationNode): unknown {
  if (annotation.type === 'dimension') {
    return {
      id: annotation.id,
      type: annotation.type,
      dimensionKind: annotation.dimensionKind,
      computedValue: annotation.computedValue,
      displayText: annotation.displayText,
      targets: annotation.targets.map(({ geometryId, anchor }) => ({ geometryId, anchor: structuredClone(anchor) })),
      textPosition: [...annotation.textPosition],
      definitionPoints: annotation.definitionPoints.map((point) => [...point]),
    };
  }
  if (annotation.type === 'centerline') {
    return {
      id: annotation.id,
      type: annotation.type,
      targets: [...annotation.targets],
      start: [...annotation.start],
      end: [...annotation.end],
      extension: annotation.extension,
    };
  }
  return { id: annotation.id, type: annotation.type };
}
