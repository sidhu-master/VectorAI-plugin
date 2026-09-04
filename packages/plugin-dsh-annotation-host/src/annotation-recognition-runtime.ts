// SPDX-License-Identifier: Apache-2.0

import type { Agent } from '@deepseek-ai/dsh-agent';
import type { DrawingSpaceExtensionHost } from '@vectorai/plugin-space-contracts';
import { createDeterministicAnnotationPipeline } from './deterministic-annotation-pipeline';
import { createAutomaticGdtPipeline } from './gdt-reviewer';
import { RecognitionPipelineRunner, type RecognitionModelPort } from './recognition-runtime';
import { createPartitionSemanticPipeline } from './semantic-reviewer';

type RecognitionSpacePort = Pick<
  DrawingSpaceExtensionHost<Agent>,
  'getSnapshot' | 'renderObservation'
>;

export function createAnnotationRecognitionRunner(
  model: RecognitionModelPort,
  space: RecognitionSpacePort,
): RecognitionPipelineRunner {
  const runner = new RecognitionPipelineRunner(model);
  runner.register(createPartitionSemanticPipeline(space));
  runner.register(createDeterministicAnnotationPipeline());
  runner.register(createAutomaticGdtPipeline(space));
  return runner;
}
