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

  it('returns dominant contours before small glyph-like components under a result budget', async () => {
    const provider = await createProvider();
    const small = Array.from({ length: 18 }, (_, index) => (
      `<circle cx="${20 + index * 20}" cy="270" r="4" fill="none" stroke="black" stroke-width="2"/>`
    )).join('');
    const bytes = await sharp(Buffer.from(`
      <svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="300" fill="white"/>
        <circle cx="200" cy="130" r="100" fill="none" stroke="black" stroke-width="3"/>
        ${small}
      </svg>
    `)).png().toBuffer();
    const source: CvSourceImage = {
      sourceId: 'source_dominant_first', mimeType: 'image/png', bytes,
      width: 400, height: 300,
    };

    const evidence = await provider.extractEvidence({
      source,
      regionId: 'region_full',
      region: { x: 0, y: 0, width: 400, height: 300 },
      budget: { ...budget, maxResults: 2 },
      signal: new AbortController().signal,
    });

    expect(evidence).toHaveLength(2);
    expect(evidence.every((item) => item.bounds.width > 150 && item.bounds.height > 150))
      .toBe(true);
  });

  it('downsamples oversized extraction work and maps evidence back to source coordinates', async () => {
    const provider = await createProvider();
    const source = await circleSource();

    const evidence = await provider.extractEvidence({
      source,
      regionId: 'region_full',
      region: { x: 0, y: 0, width: source.width, height: source.height },
      budget: { ...budget, maxPixels: 4_800 },
      signal: new AbortController().signal,
    });

    const circle = evidence.find((item) => item.kind === 'circle-candidate');
    expect(circle).toBeDefined();
    expect(circle?.bounds.x).toBeGreaterThanOrEqual(35);
    expect(circle?.bounds.x).toBeLessThanOrEqual(45);
    expect(circle?.bounds.y).toBeGreaterThanOrEqual(15);
    expect(circle?.bounds.y).toBeLessThanOrEqual(25);
    expect(circle?.samples.every(([x, y]) => x > 30 && x < 130 && y > 10 && y < 110))
      .toBe(true);
  });

  it('downsamples overview work to its pixel budget while preserving source-space bounds', async () => {
    const provider = await createProvider();
    const source = await circleSource();

    const overview = await provider.inspectOverview({
      source,
      budget: { ...budget, maxPixels: 4_800 },
      signal: new AbortController().signal,
    });

    expect(overview).toMatchObject({ width: 160, height: 120 });
    expect(overview.componentCount).toBeGreaterThan(0);
    expect(overview.foregroundBounds?.width).toBeGreaterThan(60);
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

  it('fits source-space circle parameters from bounded evidence samples', async () => {
    const provider = await createProvider();
    const samples = Array.from({ length: 72 }, (_, index) => {
      const angle = index * Math.PI * 2 / 72;
      return [80 + Math.cos(angle) * 30, 60 + Math.sin(angle) * 30] as const;
    });

    const fit = await provider.fitPrimitive({
      primitiveType: 'circle',
      samples,
      budget: { ...budget, maxSamplesPerResult: 100 },
      signal: new AbortController().signal,
    });

    expect(fit.primitiveType).toBe('circle');
    const center = fit.parameters.center as [number, number];
    expect(center[0]).toBeCloseTo(80, 8);
    expect(center[1]).toBeCloseTo(60, 8);
    expect(fit.parameters.radius as number).toBeCloseTo(30, 8);
    expect(fit.fitErrorP95).toBeLessThan(0.01);
  });

  it('simplifies a dense contour to a bounded polyline fit', async () => {
    const provider = await createProvider();
    const samples = Array.from({ length: 720 }, (_, index) => {
      const angle = index * Math.PI * 2 / 720;
      return [200 + Math.cos(angle) * 100, 160 + Math.sin(angle) * 80] as const;
    });

    const fit = await provider.fitPrimitive({
      primitiveType: 'polyline',
      samples,
      budget: { ...budget, maxSamplesPerResult: 1_000 },
      signal: new AbortController().signal,
    });

    const vertices = fit.parameters.vertices as Array<{ point: readonly [number, number] }>;
    expect(vertices.length).toBeLessThanOrEqual(64);
    expect(fit.parameters.closed).toBe(true);
    expect(fit.fitErrorP95).toBeLessThan(3);
  });
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
