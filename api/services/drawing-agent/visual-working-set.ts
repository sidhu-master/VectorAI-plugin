import type { ModelLoopActionInput, ModelLoopObservation } from './model-loop-adapter.js';
import type { ModelToolResult } from '../drawing-tools/types.js';

type SourceImage = NonNullable<ModelLoopActionInput['sourceImage']>;

export interface VisualWorkingSetInput {
  sourceImage?: SourceImage;
  observations: ModelLoopObservation[];
  sourceBootstrapPending: boolean;
}

/**
 * A model round receives one coherent visual coordinate frame. Source bootstrap wins once;
 * afterwards the newest most specific Drawing observation replaces older images.
 */
export function selectVisualWorkingSet(input: VisualWorkingSetInput): {
  sourceImage?: SourceImage;
  observations: ModelLoopObservation[];
} {
  if (input.sourceBootstrapPending && input.sourceImage) {
    return { sourceImage: input.sourceImage, observations: [] };
  }
  const observation = highestValueObservation(input.observations);
  if (observation) return { observations: [observation] };
  return input.sourceImage
    ? { sourceImage: input.sourceImage, observations: [] }
    : { observations: [] };
}

function highestValueObservation(
  observations: ModelLoopObservation[],
): ModelLoopObservation | undefined {
  const priority: Record<ModelLoopObservation['purpose'], number> = {
    overview: 1,
    'user-viewport': 2,
    'target-detail': 3,
    diff: 4,
    preview: 5,
  };
  let best: { value: ModelLoopObservation; score: number; index: number } | undefined;
  observations.forEach((value, index) => {
    const score = priority[value.purpose];
    if (!best || score > best.score || (score === best.score && index > best.index)) {
      best = { value, score, index };
    }
  });
  return best?.value;
}

export function pendingSourceCropHandle(
  results: ModelToolResult[],
  delivered: ReadonlySet<string>,
): string | undefined {
  for (const result of [...results].reverse()) {
    if (result.receipt.tool !== 'inspect_source_crop'
      || result.receipt.status !== 'succeeded') continue;
    const output = result.output && typeof result.output === 'object' && !Array.isArray(result.output)
      ? result.output as Record<string, unknown>
      : undefined;
    if (typeof output?.mediaHandle !== 'string' || delivered.has(output.mediaHandle)) continue;
    return output.mediaHandle;
  }
  return undefined;
}
