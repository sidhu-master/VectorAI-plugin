import type { SourcePixelRect } from '../drawing-cv/types.js';
import type { RenderedSemanticPlanes } from './source-renderer.js';

export interface RegionGeometryMetrics {
  edgePrecision: number;
  edgeRecall: number;
  edgeF1: number;
  fitP50: number;
  fitP95: number;
  fitMax: number;
}

export interface RegionResidualReport {
  geometry: RegionGeometryMetrics;
  topologyFailures: string[];
  associationMismatches: string[];
  residualRegions: SourcePixelRect[];
  improved: boolean;
}

export function compareDrawingRegion(input: {
  sourceEdges: Uint8Array;
  rendered: RenderedSemanticPlanes;
  region: SourcePixelRect;
  tolerancePixels: number;
  previousGeometry?: RegionGeometryMetrics;
  topologyFailures?: string[];
  associationMismatches?: string[];
}): RegionResidualReport {
  const { width, height } = input.rendered;
  if (input.sourceEdges.length !== width * height
    || input.rendered.combined.length !== width * height
    || input.region.width !== width || input.region.height !== height
    || !Number.isInteger(input.tolerancePixels) || input.tolerancePixels < 0) {
    throw new Error('RESIDUAL_COMPARE_INPUT_INVALID');
  }
  const source = binary(input.sourceEdges);
  const drawing = binary(input.rendered.combined);
  const sourceNear = dilate(source, width, height, input.tolerancePixels);
  const drawingNear = dilate(drawing, width, height, input.tolerancePixels);
  const sourceCount = count(source);
  const drawingCount = count(drawing);
  const matchedDrawing = countWhere(drawing, sourceNear);
  const matchedSource = countWhere(source, drawingNear);
  const edgePrecision = drawingCount === 0 ? (sourceCount === 0 ? 1 : 0) : matchedDrawing / drawingCount;
  const edgeRecall = sourceCount === 0 ? (drawingCount === 0 ? 1 : 0) : matchedSource / sourceCount;
  const edgeF1 = edgePrecision + edgeRecall === 0
    ? 0
    : 2 * edgePrecision * edgeRecall / (edgePrecision + edgeRecall);
  const distances = distanceField(source, width, height);
  const fitErrors: number[] = [];
  for (let index = 0; index < drawing.length; index += 1) {
    if (drawing[index]) fitErrors.push(distances[index]);
  }
  fitErrors.sort((left, right) => left - right);
  const geometry: RegionGeometryMetrics = {
    edgePrecision,
    edgeRecall,
    edgeF1,
    fitP50: percentile(fitErrors, 0.5),
    fitP95: percentile(fitErrors, 0.95),
    fitMax: fitErrors.at(-1) ?? (sourceCount === 0 ? 0 : Number.POSITIVE_INFINITY),
  };
  const topologyFailures = [...(input.topologyFailures ?? [])];
  const associationMismatches = [...(input.associationMismatches ?? [])];
  const improvedMetrics = input.previousGeometry !== undefined && (
    geometry.edgeF1 > input.previousGeometry.edgeF1 + 1e-9
    || geometry.fitP95 < input.previousGeometry.fitP95 - 1e-9
  );
  return {
    geometry,
    topologyFailures,
    associationMismatches,
    residualRegions: connectedResiduals(
      unmatchedMask(source, drawing, sourceNear, drawingNear),
      width,
      height,
      input.region,
    ),
    improved: improvedMetrics && topologyFailures.length === 0,
  };
}

function binary(mask: Uint8Array): Uint8Array {
  return Uint8Array.from(mask, (value) => value > 0 ? 1 : 0);
}

function dilate(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  if (radius === 0) return mask.slice();
  const output = new Uint8Array(mask.length);
  const radiusSquared = radius * radius;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!mask[y * width + x]) continue;
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const targetY = y + offsetY;
        if (targetY < 0 || targetY >= height) continue;
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          if (offsetX * offsetX + offsetY * offsetY > radiusSquared) continue;
          const targetX = x + offsetX;
          if (targetX >= 0 && targetX < width) output[targetY * width + targetX] = 1;
        }
      }
    }
  }
  return output;
}

function distanceField(source: Uint8Array, width: number, height: number): Float64Array {
  const distance = new Float64Array(source.length);
  distance.fill(Number.POSITIVE_INFINITY);
  for (let index = 0; index < source.length; index += 1) {
    if (source[index]) distance[index] = 0;
  }
  const diagonal = Math.SQRT2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x > 0) distance[index] = Math.min(distance[index], distance[index - 1] + 1);
      if (y > 0) distance[index] = Math.min(distance[index], distance[index - width] + 1);
      if (x > 0 && y > 0) distance[index] = Math.min(distance[index], distance[index - width - 1] + diagonal);
      if (x + 1 < width && y > 0) distance[index] = Math.min(distance[index], distance[index - width + 1] + diagonal);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (x + 1 < width) distance[index] = Math.min(distance[index], distance[index + 1] + 1);
      if (y + 1 < height) distance[index] = Math.min(distance[index], distance[index + width] + 1);
      if (x + 1 < width && y + 1 < height) {
        distance[index] = Math.min(distance[index], distance[index + width + 1] + diagonal);
      }
      if (x > 0 && y + 1 < height) {
        distance[index] = Math.min(distance[index], distance[index + width - 1] + diagonal);
      }
    }
  }
  return distance;
}

function unmatchedMask(
  source: Uint8Array,
  drawing: Uint8Array,
  sourceNear: Uint8Array,
  drawingNear: Uint8Array,
): Uint8Array {
  const output = new Uint8Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    if ((source[index] && !drawingNear[index]) || (drawing[index] && !sourceNear[index])) output[index] = 1;
  }
  return output;
}

function connectedResiduals(
  mask: Uint8Array,
  width: number,
  height: number,
  region: SourcePixelRect,
): SourcePixelRect[] {
  const visited = new Uint8Array(mask.length);
  const output: SourcePixelRect[] = [];
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const nextX = x + offsetX;
          const nextY = y + offsetY;
          if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (mask[next] && !visited[next]) {
            visited[next] = 1;
            queue.push(next);
          }
        }
      }
    }
    output.push({
      x: region.x + minX,
      y: region.y + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }
  return output.sort((left, right) => (
    right.width * right.height - left.width * left.height
  ));
}

function count(mask: Uint8Array): number {
  let total = 0;
  for (const value of mask) total += value ? 1 : 0;
  return total;
}

function countWhere(mask: Uint8Array, accepted: Uint8Array): number {
  let total = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] && accepted[index]) total += 1;
  }
  return total;
}

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}
