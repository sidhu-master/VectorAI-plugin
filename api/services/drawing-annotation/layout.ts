import type { GeometryNode, Vec2 } from '../../../src/drawing/index.js';
import { geometryBounds, unionBounds } from '../../../src/drawing/query/bounds.js';
import type { MeasurementFact } from './types.js';

export interface MeasurementFactLayout {
  textPosition: Vec2;
  definitionPoints: Vec2[];
  side: 'above' | 'below' | 'inside';
  lane: number;
}

export function layoutMeasurementFacts(input: {
  geometry: GeometryNode[];
  facts: MeasurementFact[];
}): Record<string, MeasurementFactLayout> {
  const bounds = unionBounds(input.geometry.flatMap((node) => {
    const item = geometryBounds(node);
    return item ? [item] : [];
  }));
  if (!bounds) return {};
  const diagonal = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const gap = Math.max(diagonal * 0.035, 1);
  const result: Record<string, MeasurementFactLayout> = {};

  const axial = input.facts
    .filter((fact): fact is Extract<MeasurementFact, { kind: 'axial-length' }> => (
      fact.kind === 'axial-length'
    ))
    .sort((left, right) => left.value - right.value || left.key.localeCompare(right.key));
  const lanes: Record<'above' | 'below', Array<Array<readonly [number, number]>>> = {
    above: [],
    below: [],
  };
  axial.forEach((fact, index) => {
    const interval = [Math.min(fact.first[0], fact.second[0]), Math.max(fact.first[0], fact.second[0])] as const;
    const preferred: 'above' | 'below' = index % 2 === 0 ? 'above' : 'below';
    const alternative: 'above' | 'below' = preferred === 'above' ? 'below' : 'above';
    const firstLane = availableLane(lanes[preferred], interval, gap * 0.35);
    const secondLane = availableLane(lanes[alternative], interval, gap * 0.35);
    const side = firstLane <= secondLane ? preferred : alternative;
    const lane = side === preferred ? firstLane : secondLane;
    lanes[side][lane] ??= [];
    lanes[side][lane].push(interval);
    const sign = side === 'above' ? 1 : -1;
    const sourceY = side === 'above' ? bounds.maxY : bounds.minY;
    const measureY = sourceY + sign * gap * (lane + 1);
    result[fact.key] = {
      textPosition: [
        clean((interval[0] + interval[1]) / 2),
        clean(measureY + sign * gap * 0.18),
      ],
      definitionPoints: [
        [fact.first[0], sourceY],
        [fact.second[0], sourceY],
        [fact.first[0], clean(measureY)],
        [fact.second[0], clean(measureY)],
      ],
      side,
      lane,
    };
  });

  const diameter = input.facts
    .filter((fact): fact is Extract<MeasurementFact, { kind: 'diameter' }> => fact.kind === 'diameter')
    .sort((left, right) => left.center[0] - right.center[0] || left.key.localeCompare(right.key));
  const diameterTextX = spreadAxisPositions(
    diameter.map((fact) => fact.center[0]),
    bounds.minX + gap * 0.45,
    bounds.maxX - gap * 0.45,
    gap * 3,
  );
  diameter.forEach((fact, index) => {
    result[fact.key] = {
      textPosition: [clean(diameterTextX[index] ?? fact.center[0]), clean(fact.center[1])],
      definitionPoints: [fact.first, fact.second],
      side: 'inside',
      lane: index,
    };
  });

  const radial = input.facts
    .filter((fact): fact is Extract<MeasurementFact, { kind: 'radius' }> => fact.kind === 'radius')
    .sort((left, right) => left.key.localeCompare(right.key));
  radial.forEach((fact, index) => {
    const dx = fact.edge[0] - fact.center[0];
    const dy = fact.edge[1] - fact.center[1];
    const length = Math.hypot(dx, dy) || 1;
    const leaderEnd: Vec2 = [
      clean(fact.edge[0] + dx / length * gap * 0.65),
      clean(fact.edge[1] + dy / length * gap * 0.65),
    ];
    result[fact.key] = {
      textPosition: [
        clean(leaderEnd[0] + dx / length * gap * 0.15),
        clean(leaderEnd[1] + dy / length * gap * 0.15),
      ],
      definitionPoints: [fact.center, fact.edge, leaderEnd],
      side: 'inside',
      lane: index,
    };
  });

  const angular = input.facts
    .filter((fact): fact is Extract<MeasurementFact, { kind: 'angle' }> => fact.kind === 'angle')
    .sort((left, right) => {
      const side = openingSide(left.vertex[0], bounds) - openingSide(right.vertex[0], bounds);
      if (side !== 0) return side;
      // 同侧按"顶点离开口的深度"降序：越深的车道越靠内，物理上更外侧的锥（浅顶点）推到最外侧
      const depth = (left.vertex[0] - right.vertex[0]) * openingSide(left.vertex[0], bounds);
      return depth || left.value - right.value || left.key.localeCompare(right.key);
    });
  const angularLanes = new Map<-1 | 1, number>();
  // 同侧顺序布局：记录上一车道的文字框，保证本车道圆弧让开它，角度之间不挤压
  const previousBySide = new Map<-1 | 1, {
    textRadius: number;
    halfTextWidth: number;
    axisCoordinate: number;
  }>();
  angular.forEach((fact) => {
    const sideKey = openingSide(fact.vertex[0], bounds);
    const lane = angularLanes.get(sideKey) ?? 0;
    angularLanes.set(sideKey, lane + 1);
    // 顶点到零件边缘（开口端面）的距离：圆弧与文字必须完全退出零件轮廓之外
    const distToEdge = sideKey === -1
      ? fact.vertex[0] - bounds.minX
      : bounds.maxX - fact.vertex[0];
    const firstAngle = Math.atan2(
      fact.rays[0][1] - fact.vertex[1],
      fact.rays[0][0] - fact.vertex[0],
    );
    const secondAngle = Math.atan2(
      fact.rays[1][1] - fact.vertex[1],
      fact.rays[1][0] - fact.vertex[0],
    );
    const sweep = selectAngularSweep(firstAngle, secondAngle, fact.value);
    const middleAngle = firstAngle + sweep.signedRadians / 2;
    // 圆弧整体（含弧两端）退出零件边缘所需的最小半径
    const halfSweep = Math.abs(sweep.signedRadians) / 2;
    const arcClearance = halfSweep >= Math.PI / 2 - 1e-6
      ? distToEdge + gap
      : distToEdge / Math.cos(halfSweep) + gap * 0.3;
    // 文字宽度的一半（与前端估算一致：字符数 × 字高 × 0.55）
    const halfTextWidth = (String(Math.round(Math.abs(fact.value))).length + 1) * 11 * 0.55 / 2;
    // 圆弧半径需要足够大，让紧贴圆弧外侧的文字完全退出零件轮廓
    let minimumRadius = Math.max(
      gap * (2.3 + lane * 2.3),
      arcClearance,
      distToEdge + halfTextWidth,
    );
    const bisector: [number, number] = [Math.cos(middleAngle), Math.sin(middleAngle)];
    const axisCoordinate = fact.vertex[0] * bisector[0] + fact.vertex[1] * bisector[1];
    const previous = previousBySide.get(sideKey);
    if (previous) {
      // 同侧平分线近似平行：本车道文字框需与上一车道文字框错开
      const axisDelta = axisCoordinate - previous.axisCoordinate;
      const textSeparation = previous.halfTextWidth + halfTextWidth + gap * 0.3 - axisDelta;
      if (textSeparation > 0) {
        minimumRadius = Math.max(
          minimumRadius,
          previous.textRadius + textSeparation - gap * 0.5,
        );
      }
    }
    const radius = minimumRadius;
    const arcStart = polarPoint(fact.vertex, radius, firstAngle);
    const arcEnd = polarPoint(fact.vertex, radius, secondAngle);
    // 开口线略过圆弧；文字紧贴开口线端点之外
    const minimumExtensionRadius = radius + gap * 0.15;
    const firstExtensionRadius = Math.max(
      minimumExtensionRadius,
      pointDistance(fact.vertex, fact.rays[0]) + gap * 0.08,
    );
    const secondExtensionRadius = Math.max(
      minimumExtensionRadius,
      pointDistance(fact.vertex, fact.rays[1]) + gap * 0.08,
    );
    // 角度文字位于角平分线上，紧贴自己的圆弧/开口线，且在开口与零件轮廓之外
    const textRadius = Math.max(radius, firstExtensionRadius, secondExtensionRadius) + gap * 0.35;
    previousBySide.set(sideKey, { textRadius, halfTextWidth, axisCoordinate });
    result[fact.key] = {
      textPosition: polarPoint(fact.vertex, textRadius, middleAngle),
      definitionPoints: [
        fact.vertex,
        polarPoint(fact.vertex, firstExtensionRadius, firstAngle),
        polarPoint(fact.vertex, secondExtensionRadius, secondAngle),
        arcStart,
        arcEnd,
      ],
      side: 'inside',
      lane,
    };
  });

  const chamfers = input.facts
    .filter((fact): fact is Extract<MeasurementFact, { kind: 'chamfer' }> => fact.kind === 'chamfer')
    .sort((left, right) => left.key.localeCompare(right.key));
  chamfers.forEach((fact, index) => {
    result[fact.key] = {
      textPosition: [clean((fact.start[0] + fact.end[0]) / 2), clean((fact.start[1] + fact.end[1]) / 2 + gap * 0.18)],
      definitionPoints: [fact.start, fact.end],
      side: 'inside',
      lane: index,
    };
  });
  return result;
}

/**
 * Minimum-displacement one-dimensional label packing. PAVA solves the ordered
 * spacing constraint symmetrically, so dense labels do not all drift to one side.
 */
function spreadAxisPositions(
  source: number[],
  minimum: number,
  maximum: number,
  desiredGap: number,
): number[] {
  if (source.length <= 1) return [...source];
  const available = Math.max(0, maximum - minimum);
  const gap = Math.min(desiredGap, available / (source.length - 1));
  const blocks: Array<{ start: number; end: number; sum: number; count: number }> = [];
  source.forEach((value, index) => {
    blocks.push({ start: index, end: index, sum: value - index * gap, count: 1 });
    while (blocks.length >= 2) {
      const right = blocks.at(-1)!;
      const left = blocks.at(-2)!;
      if (left.sum / left.count <= right.sum / right.count) break;
      blocks.splice(-2, 2, {
        start: left.start,
        end: right.end,
        sum: left.sum + right.sum,
        count: left.count + right.count,
      });
    }
  });
  const result = new Array<number>(source.length);
  blocks.forEach((block) => {
    const mean = block.sum / block.count;
    for (let index = block.start; index <= block.end; index += 1) {
      result[index] = mean + index * gap;
    }
  });
  const first = result[0] ?? minimum;
  const last = result.at(-1) ?? maximum;
  const shift = first < minimum ? minimum - first : last > maximum ? maximum - last : 0;
  return result.map((value) => clean(value + shift));
}

function availableLane(
  lanes: Array<Array<readonly [number, number]>>,
  interval: readonly [number, number],
  padding: number,
): number {
  for (let index = 0; index < lanes.length; index += 1) {
    const occupied = lanes[index] ?? [];
    if (occupied.every((other) => (
      interval[1] + padding < other[0] || interval[0] - padding > other[1]
    ))) return index;
  }
  return lanes.length;
}

function openingSide(
  x: number,
  bounds: { minX: number; maxX: number },
): -1 | 1 {
  return x <= (bounds.minX + bounds.maxX) / 2 ? -1 : 1;
}

function selectAngularSweep(
  start: number,
  end: number,
  valueDegrees: number,
): { signedRadians: number } {
  const full = Math.PI * 2;
  const counterClockwise = positiveModulo(end - start, full);
  const clockwise = counterClockwise - full;
  const target = Math.abs(valueDegrees) * Math.PI / 180;
  return {
    signedRadians: Math.abs(Math.abs(counterClockwise) - target)
      <= Math.abs(Math.abs(clockwise) - target)
      ? counterClockwise
      : clockwise,
  };
}

function polarPoint(center: Vec2, radius: number, angle: number): Vec2 {
  return [
    clean(center[0] + Math.cos(angle) * radius),
    clean(center[1] + Math.sin(angle) * radius),
  ];
}

function pointDistance(first: Vec2, second: Vec2): number {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}

function clean(value: number): number {
  const rounded = Math.round(value * 1_000_000) / 1_000_000;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
