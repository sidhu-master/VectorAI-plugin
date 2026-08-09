import { parentPort } from 'node:worker_threads';
import openCvModule from '@techstark/opencv-js';

import type {
  CvWorkerEvidence,
  CvWorkerMessage,
  CvWorkerRequest,
} from './worker-protocol.js';

if (!parentPort) throw new Error('CV_WORKER_PARENT_MISSING');

const cv = await openCvModule;
parentPort.postMessage({ type: 'ready' } satisfies CvWorkerMessage);
parentPort.on('message', (request: CvWorkerRequest) => {
  try {
    const value = request.operation === 'overview'
      ? inspectOverview(request)
      : extractEvidence(request);
    parentPort!.postMessage({
      type: 'response', id: request.id, ok: true, value,
    } satisfies CvWorkerMessage);
  } catch (error) {
    parentPort!.postMessage({
      type: 'response',
      id: request.id,
      ok: false,
      code: errorCode(error),
      message: error instanceof Error ? error.message : String(error),
    } satisfies CvWorkerMessage);
  }
});

function inspectOverview(request: Extract<CvWorkerRequest, { operation: 'overview' }>) {
  return withBinaryContours(request, (contours: any) => {
    let componentCount = 0;
    let minX = request.width;
    let minY = request.height;
    let maxX = 0;
    let maxY = 0;
    for (let index = 0; index < contours.size(); index += 1) {
      const contour = contours.get(index);
      try {
        if (Math.abs(cv.contourArea(contour, false)) < 5) continue;
        const rect = cv.boundingRect(contour);
        componentCount += 1;
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
      } finally {
        contour.delete();
      }
    }
    return {
      width: request.width,
      height: request.height,
      componentCount,
      ...(componentCount > 0 ? {
        foregroundBounds: {
          x: minX + request.origin[0],
          y: minY + request.origin[1],
          width: maxX - minX,
          height: maxY - minY,
        },
      } : {}),
    };
  });
}

function extractEvidence(
  request: Extract<CvWorkerRequest, { operation: 'extract' }>,
): CvWorkerEvidence[] {
  return withBinaryContours(request, (contours: any) => {
    const output: CvWorkerEvidence[] = [];
    for (let index = 0; index < contours.size() && output.length < request.budget.maxResults; index += 1) {
      const contour = contours.get(index);
      try {
        const area = Math.abs(cv.contourArea(contour, false));
        const perimeter = cv.arcLength(contour, true);
        if (area < 20 || perimeter <= 0) continue;
        const rect = cv.boundingRect(contour);
        const circularity = 4 * Math.PI * area / (perimeter * perimeter);
        const raw = contour.data32S as Int32Array;
        const samples = boundedSamples(raw, request);
        const touchesRegionEdge = rect.x <= 1 || rect.y <= 1
          || rect.x + rect.width >= request.width - 1
          || rect.y + rect.height >= request.height - 1;
        output.push({
          kind: circularity >= 0.72 ? 'circle-candidate' : 'contour',
          bounds: {
            x: rect.x + request.origin[0],
            y: rect.y + request.origin[1],
            width: rect.width,
            height: rect.height,
          },
          confidence: Math.max(0, Math.min(1, circularity)),
          touchesRegionEdge,
          samples,
        });
      } finally {
        contour.delete();
      }
    }
    return output;
  });
}

function withBinaryContours<T>(
  request: CvWorkerRequest,
  consume: (contours: any) => T,
): T {
  assertPixelBudget(request);
  const source = cv.matFromArray(
    request.height,
    request.width,
    cv.CV_8UC4,
    new Uint8Array(request.rgba),
  );
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    cv.findContours(binary, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_NONE);
    return consume(contours);
  } finally {
    source.delete();
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function boundedSamples(raw: Int32Array, request: CvWorkerRequest) {
  const pointCount = raw.length / 2;
  const limit = Math.min(pointCount, request.budget.maxSamplesPerResult);
  const step = Math.max(1, Math.floor(pointCount / Math.max(1, limit)));
  const samples: Array<readonly [number, number]> = [];
  for (let point = 0; point < pointCount && samples.length < limit; point += step) {
    samples.push([
      raw[point * 2] + request.origin[0],
      raw[point * 2 + 1] + request.origin[1],
    ]);
  }
  return samples;
}

function assertPixelBudget(request: CvWorkerRequest): void {
  if (request.width * request.height > request.budget.maxPixels) {
    throw Object.assign(new Error('CV_BUDGET_EXCEEDED'), { code: 'CV_BUDGET_EXCEEDED' });
  }
}

function errorCode(error: unknown): string {
  return error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'CV_WORKER_FAILED';
}
