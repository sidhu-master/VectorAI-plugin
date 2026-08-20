import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  inspectSampleAnnotationOracle,
  SAMPLE_DEFERRED_CATEGORIES,
  SAMPLE_NOMINAL_DIMENSIONS,
} from './sample-oracle.test-fixture.js';

describe('sample annotation Oracle', () => {
  it('extracts all nominal dimensions while separating unsupported design intent', () => {
    const result = inspectSampleAnnotationOracle(path.resolve('样本图001.dxf'));

    expect(result.nominalDimensions).toEqual(SAMPLE_NOMINAL_DIMENSIONS);
    expect(result.nominalDimensions).toHaveLength(28);
    expect(result.deferredCategories).toEqual(SAMPLE_DEFERRED_CATEGORIES);
    expect(result.unreadableNominalHandles).toEqual([]);
  });
});
