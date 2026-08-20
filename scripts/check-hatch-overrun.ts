import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseAsciiDxf } from '../api/services/drawing-dxf/raw-parser';
import { projectHatchPattern } from '../api/services/drawing-dxf/hatch';
import { pointInPolygonRegion } from '../api/services/drawing-spatial/polygon';
import type { Vec2 } from '../src/drawing/index.js';

function toContoursFromSegments(segments: Array<{ start: Vec2; end: Vec2 }>): Vec2[][] {
  const EPS = 1e-6;
  const contours: Vec2[][] = [];
  let current: Vec2[] = [];
  const same = (left: Vec2, right: Vec2) => Math.hypot(left[0] - right[0], left[1] - right[1]) <= EPS;

  for (const seg of segments) {
    if (current.length === 0) {
      current = [seg.start, seg.end];
      continue;
    }
    if (same(current[current.length - 1]!, seg.start)) {
      current.push(seg.end);
      continue;
    }
    if (current.length >= 3) {
      if (same(current[0]!, current[current.length - 1]!)) current.pop();
      if (current.length >= 3) contours.push(current);
    }
    current = [seg.start, seg.end];
  }
  if (current.length >= 3) {
    if (same(current[0]!, current[current.length - 1]!)) current.pop();
    if (current.length >= 3) contours.push(current);
  }

  return contours;
}

(async () => {
  const source = await readFile(resolve(process.cwd(), '样本图001.dxf'), 'utf8');
  const manifest = parseAsciiDxf(source);
  const hatches = manifest.entities.filter((entity) => entity.type === 'HATCH');
  console.log('hatch count', hatches.length);

  for (const entity of hatches) {
    const pattern = projectHatchPattern(entity.pairs);
    if (!pattern) {
      console.log('pattern parse skip');
      continue;
    }

    // 这里把当前投影段自己恢复为边界轮廓近似，仅用于自查
    // 真实投影中 boundaryContours 来自 HATCH 实体，不容易直接拿到，只做回归趋势判断。
    const contours = toContoursFromSegments(pattern.segments);

    let outCount = 0;
    let minOutX = Number.POSITIVE_INFINITY;
    let maxOutX = Number.NEGATIVE_INFINITY;
    let minOutY = Number.POSITIVE_INFINITY;
    let maxOutY = Number.NEGATIVE_INFINITY;

    for (const seg of pattern.segments) {
      const mid: Vec2 = [(seg.start[0] + seg.end[0]) / 2, (seg.start[1] + seg.end[1]) / 2];
      const inside = pointInPolygonRegion(mid, contours, [], 1e-6);
      if (!inside) {
        outCount += 1;
        minOutX = Math.min(minOutX, mid[0]);
        maxOutX = Math.max(maxOutX, mid[0]);
        minOutY = Math.min(minOutY, mid[1]);
        maxOutY = Math.max(maxOutY, mid[1]);
      }
    }

    console.log('segments', pattern.segments.length, 'out-mid', outCount, 'contours', contours.length);
    if (outCount > 0) {
      console.log('out-mid bbox', { minOutX, maxOutX, minOutY, maxOutY });
      console.log('first out maybe sample', pattern.segments.find((seg) => {
        const mid: Vec2 = [(seg.start[0] + seg.end[0]) / 2, (seg.start[1] + seg.end[1]) / 2];
        return !pointInPolygonRegion(mid, contours, [], 1e-6);
      }));
    }
  }
})();
