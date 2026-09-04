// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createAnnotationRecognitionRunner } from './annotation-recognition-runtime';
import type { RecognitionModelPort } from './recognition-runtime';

describe('annotation recognition runtime composition', () => {
  it('registers partition and GD&T on one shared runner', () => {
    const model: RecognitionModelPort = {
      review: async () => { throw new Error('MODEL_MUST_NOT_RUN'); },
    };
    const runner = createAnnotationRecognitionRunner(model, {} as never);

    expect(runner.list()).toEqual([
      'partition-semantic-review',
      'shaft-gdt-semantic-review',
    ]);
  });
});
