import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import { OpenCvWorkerProvider } from './opencv-provider.js';
import type { CvSourceImage, CvToolBudget } from './types.js';

const providers: OpenCvWorkerProvider[] = [];
const budget: CvToolBudget = {
  maxPixels: 1_000_000,
  maxResults: 64,
  maxSamplesPerResult: 2_048,
  timeoutMs: 10_000,
};

afterEach(async () => {
  await Promise.all(providers.splice(0).map((provider) => provider.close()));
});

describe('OpenCvWorkerProvider', () => {
  it('extracts a circle candidate from a synthetic source in a worker', async () => {
    const provider = await createProvider();
    const source = await circleSource();

    const overview = await provider.inspectOverview({
      source,
      budget,
      signal: new AbortController().signal,
    });
    const evidence = await provider.extractEvidence({
      source,
      regionId: 'region_full',
      region: { x: 0, y: 0, width: source.width, height: source.height },
      budget,
      signal: new AbortController().signal,
    });

    expect(overview.componentCount).toBeGreaterThan(0);
    const circle = evidence.find((item) => item.kind === 'circle-candidate');
    expect(circle).toBeDefined();
    expect(circle?.bounds.x).toBeGreaterThanOrEqual(35);
    expect(circle?.bounds.x).toBeLessThanOrEqual(45);
    expect(circle?.bounds.y).toBeGreaterThanOrEqual(15);
    expect(circle?.bounds.y).toBeLessThanOrEqual(25);
    expect(circle?.samples.length).toBeGreaterThan(20);
  });

  it('rejects a region before allocation when its pixel budget is exceeded', async () => {
    const provider = await createProvider();
    const source = await circleSource();

    await expect(provider.extractEvidence({
      source,
      regionId: 'region_full',
      region: { x: 0, y: 0, width: source.width, height: source.height },
      budget: { ...budget, maxPixels: 100 },
      signal: new AbortController().signal,
    })).rejects.toMatchObject({ code: 'CV_BUDGET_EXCEEDED' });
  });

  it('reuses one initialized worker across repeated requests', async () => {
    const provider = await createProvider();
    const source = await circleSource();

    for (let index = 0; index < 20; index += 1) {
      const result = await provider.inspectOverview({
        source,
        budget,
        signal: new AbortController().signal,
      });
      expect(result.width).toBe(160);
      expect(result.height).toBe(120);
    }
  }, 30_000);
});

async function createProvider(): Promise<OpenCvWorkerProvider> {
  const provider = await OpenCvWorkerProvider.create({ workerCount: 1 });
  providers.push(provider);
  return provider;
}

async function circleSource(): Promise<CvSourceImage> {
  const bytes = await sharp(Buffer.from(`
    <svg width="160" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="160" height="120" fill="white"/>
      <circle cx="80" cy="60" r="38" fill="none" stroke="black" stroke-width="3"/>
    </svg>
  `)).png().toBuffer();
  return {
    sourceId: 'source_synthetic_circle',
    mimeType: 'image/png',
    bytes,
    width: 160,
    height: 120,
  };
}
