import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const fixtureDirectory = resolve('packages/engineering-annotation/test/fixtures/external-golden-001');

const LEFT_BORE_OPENING = {
  includedAngleDegrees: 60,
  startRadius: 15,
  endRadius: 12,
};
const leftBoreOpeningAxialRun = clean(
  (LEFT_BORE_OPENING.startRadius - LEFT_BORE_OPENING.endRadius)
    / Math.tan(LEFT_BORE_OPENING.includedAngleDegrees * Math.PI / 360),
);

const GEAR = {
  startX: 138,
  endX: 198,
  normalModule: 2.5,
  toothCount: 35,
  pressureAngleDegrees: 20,
  helixAngleDegrees: 20,
};
const helixAngleRadians = GEAR.helixAngleDegrees * Math.PI / 180;
GEAR.pitchDiameter = GEAR.normalModule * GEAR.toothCount / Math.cos(helixAngleRadians);
GEAR.tipRadius = (GEAR.pitchDiameter + 2 * GEAR.normalModule) / 2;
GEAR.rootRadius = (GEAR.pitchDiameter - 2.5 * GEAR.normalModule) / 2;
GEAR.sectionTipRadius = GEAR.tipRadius - 0.2;
GEAR.axialPitch = Math.PI * GEAR.normalModule / Math.sin(helixAngleRadians);

const RELIEF_GROOVE = {
  startX: GEAR.endX,
  endX: GEAR.endX + 3,
  floorStartX: GEAR.endX + 0.5,
  floorEndX: GEAR.endX + 2.5,
  floorRadius: 41.75,
  cornerRadius: 0.5,
  shoulderRadius: 44.25,
};

function basicExternalThreadMinorDiameter(nominalDiameter, pitch) {
  return nominalDiameter - 1.226869 * pitch;
}

const THREADS = {
  left: {
    designation: 'M55x2-6g',
    nominalDiameter: 55,
    pitch: 2,
    endX: 0,
    threadLimitX: 19,
    shoulderX: 20,
  },
  right: {
    designation: 'M45x1.5-6g',
    nominalDiameter: 45,
    pitch: 1.5,
    shoulderX: 270,
    threadLimitX: 271.5,
    endX: 286,
  },
};

for (const thread of Object.values(THREADS)) {
  thread.majorRadius = thread.nominalDiameter / 2;
  thread.minorRadius = basicExternalThreadMinorDiameter(thread.nominalDiameter, thread.pitch) / 2;
  thread.chamferRadius = thread.majorRadius - thread.pitch;
}

THREADS.left.chamferEndX = THREADS.left.endX + THREADS.left.pitch;
THREADS.right.chamferStartX = THREADS.right.endX - THREADS.right.pitch;

function clean(value) {
  return Number(value.toFixed(6));
}

function fmt(value) {
  return String(clean(value));
}

function lineSegment(start, end, layer = 'PROFILE-OUTER') {
  return { kind: 'line', start, end, layer };
}

function arcSegment(start, end, center, clockwise, layer = 'PROFILE-OUTER') {
  return { kind: 'arc', start, end, center, clockwise, layer };
}

function splineSegment(controlPoints, layer = 'DETAIL-GEAR') {
  return { kind: 'spline', start: controlPoints[0], end: controlPoints.at(-1), controlPoints, layer };
}

function mirrorPoint([x, y]) {
  return [x, -y];
}

function mirrorSegment(segment) {
  if (segment.kind === 'line') {
    return lineSegment(mirrorPoint(segment.start), mirrorPoint(segment.end), segment.layer);
  }
  if (segment.kind === 'arc') {
    return arcSegment(
      mirrorPoint(segment.start),
      mirrorPoint(segment.end),
      mirrorPoint(segment.center),
      !segment.clockwise,
      segment.layer,
    );
  }
  return splineSegment(segment.controlPoints.map(mirrorPoint), segment.layer);
}

function lerpPoint(left, right, t) {
  return [
    left[0] + (right[0] - left[0]) * t,
    left[1] + (right[1] - left[1]) * t,
  ];
}

function splitCubicBezier(controlPoints, t) {
  const [a, b, c, d] = controlPoints;
  const ab = lerpPoint(a, b, t);
  const bc = lerpPoint(b, c, t);
  const cd = lerpPoint(c, d, t);
  const abc = lerpPoint(ab, bc, t);
  const bcd = lerpPoint(bc, cd, t);
  const point = lerpPoint(abc, bcd, t);
  return [[a, ab, abc, point], [point, bcd, cd, d]];
}

function trimCubicBezier(controlPoints, startT, endT) {
  let trimmed = controlPoints;
  if (startT > 0) [, trimmed] = splitCubicBezier(trimmed, startT);
  const relativeEnd = (endT - startT) / (1 - startT);
  if (relativeEnd < 1) [trimmed] = splitCubicBezier(trimmed, relativeEnd);
  return trimmed;
}

function clippedSpline(controlPoints, startX, endX, layer) {
  const segmentStartX = controlPoints[0][0];
  const segmentEndX = controlPoints.at(-1)[0];
  const clippedStartX = Math.max(segmentStartX, startX);
  const clippedEndX = Math.min(segmentEndX, endX);
  if (clippedEndX - clippedStartX <= 1e-9) return undefined;
  return splineSegment(trimCubicBezier(
    controlPoints,
    (clippedStartX - segmentStartX) / (segmentEndX - segmentStartX),
    (clippedEndX - segmentStartX) / (segmentEndX - segmentStartX),
  ), layer);
}

function gearSectionSegments(startX, endX, rootRadius, tipRadius, axialPitch, valleyPhaseX) {
  const segments = [];
  const halfPitch = axialPitch / 2;
  const firstIndex = Math.floor((startX - valleyPhaseX) / halfPitch) - 1;
  const lastIndex = Math.ceil((endX - valleyPhaseX) / halfPitch) + 1;
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const segmentStartX = valleyPhaseX + index * halfPitch;
    const segmentEndX = segmentStartX + halfPitch;
    const startsAtValley = Math.abs(index % 2) === 0;
    const startRadius = startsAtValley ? rootRadius : tipRadius;
    const endRadius = startsAtValley ? tipRadius : rootRadius;
    const span = segmentEndX - segmentStartX;
    const segment = clippedSpline([
      [segmentStartX, startRadius],
      [segmentStartX + span / 3, startRadius],
      [segmentEndX - span / 3, endRadius],
      [segmentEndX, endRadius],
    ], startX, endX, 'DETAIL-GEAR');
    if (segment) segments.push(segment);
  }
  return segments;
}

function visibleGearTraceSegments(startX, endX, sectionTipRadius, tipRadius, axialPitch, tipPhaseX) {
  const segments = [];
  const firstIndex = Math.floor((startX - tipPhaseX) / axialPitch) - 1;
  const lastIndex = Math.ceil((endX - tipPhaseX) / axialPitch) + 1;
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const left = tipPhaseX + index * axialPitch;
    const middle = left + axialPitch / 2;
    const right = left + axialPitch;
    const leftHalf = clippedSpline([
      [left, sectionTipRadius],
      [left + axialPitch / 6, sectionTipRadius],
      [middle - axialPitch / 6, tipRadius],
      [middle, tipRadius],
    ], startX, endX, 'DETAIL-GEAR-VISIBLE');
    const rightHalf = clippedSpline([
      [middle, tipRadius],
      [middle + axialPitch / 6, tipRadius],
      [right - axialPitch / 6, sectionTipRadius],
      [right, sectionTipRadius],
    ], startX, endX, 'DETAIL-GEAR-VISIBLE');
    if (leftHalf) segments.push(leftHalf);
    if (rightHalf) segments.push(rightHalf);
  }
  return segments;
}

function boundaryPoint(segments, x) {
  return segments
    .flatMap((segment) => [segment.start, segment.end])
    .find(([pointX]) => Math.abs(pointX - x) <= 1e-9);
}

function visibleGearBoundaryConnectors(sectionSegments, visibleSegments, startX, endX) {
  const connectors = [];
  for (const x of [startX, endX]) {
    const sectionPoint = boundaryPoint(sectionSegments, x);
    const visiblePoint = boundaryPoint(visibleSegments, x);
    if (!sectionPoint || !visiblePoint) continue;
    if (Math.hypot(sectionPoint[0] - visiblePoint[0], sectionPoint[1] - visiblePoint[1]) <= 1e-9) continue;
    connectors.push(lineSegment(visiblePoint, sectionPoint, 'DETAIL-GEAR-VISIBLE'));
  }
  return connectors;
}

const topOuterBeforeGearBase = [
  lineSegment(
    [THREADS.left.endX, THREADS.left.chamferRadius],
    [THREADS.left.chamferEndX, THREADS.left.majorRadius],
  ),
  lineSegment(
    [THREADS.left.chamferEndX, THREADS.left.majorRadius],
    [THREADS.left.shoulderX, THREADS.left.majorRadius],
  ),
  lineSegment([THREADS.left.shoulderX, THREADS.left.majorRadius], [22, 25], 'DETAIL-RELIEF'),
  lineSegment([22, 25], [30, 25], 'DETAIL-RELIEF'),
  lineSegment([30, 25], [31, 26]),
  lineSegment([31, 26], [31, 30]),
  lineSegment([31, 30], [61, 30]),
  arcSegment([61, 30], [62, 31], [61, 31], false, 'DETAIL-RELIEF'),
  lineSegment([62, 31], [62, 33]),
  lineSegment([62, 33], [81, 33]),
  lineSegment([81, 33], [81, 38]),
  lineSegment([81, 38], [115, 38]),
  lineSegment([115, 38], [115, 36]),
  lineSegment([115, 36], [132, 36]),
  arcSegment([132, 36], [136, 40], [132, 40], false, 'DETAIL-RELIEF'),
];

const topGearTeeth = gearSectionSegments(
  GEAR.startX,
  GEAR.endX,
  GEAR.rootRadius,
  GEAR.sectionTipRadius,
  GEAR.axialPitch,
  GEAR.startX + GEAR.axialPitch / 2,
);
const lowerGearTeeth = gearSectionSegments(
  GEAR.startX,
  GEAR.endX,
  GEAR.rootRadius,
  GEAR.sectionTipRadius,
  GEAR.axialPitch,
  GEAR.startX,
).map(mirrorSegment);

const topVisibleGearTraces = visibleGearTraceSegments(
  GEAR.startX,
  GEAR.endX,
  GEAR.sectionTipRadius,
  GEAR.tipRadius,
  GEAR.axialPitch,
  GEAR.startX,
);
const lowerVisibleGearTraces = visibleGearTraceSegments(
  GEAR.startX,
  GEAR.endX,
  GEAR.sectionTipRadius,
  GEAR.tipRadius,
  GEAR.axialPitch,
  GEAR.startX + GEAR.axialPitch / 2,
).map(mirrorSegment);
const topVisibleGearBoundaryConnectors = visibleGearBoundaryConnectors(
  topGearTeeth,
  topVisibleGearTraces,
  GEAR.startX,
  GEAR.endX,
);
const lowerVisibleGearBoundaryConnectors = visibleGearBoundaryConnectors(
  lowerGearTeeth,
  lowerVisibleGearTraces,
  GEAR.startX,
  GEAR.endX,
);

function gearFaceAndRelief(profileEnd) {
  const grooveEntryRadius = RELIEF_GROOVE.floorRadius + RELIEF_GROOVE.cornerRadius;
  return [
    lineSegment(profileEnd, [RELIEF_GROOVE.startX, grooveEntryRadius], 'DETAIL-RELIEF'),
    arcSegment(
      [RELIEF_GROOVE.startX, grooveEntryRadius],
      [RELIEF_GROOVE.floorStartX, RELIEF_GROOVE.floorRadius],
      [RELIEF_GROOVE.floorStartX, grooveEntryRadius],
      false,
      'DETAIL-RELIEF',
    ),
    lineSegment(
      [RELIEF_GROOVE.floorStartX, RELIEF_GROOVE.floorRadius],
      [RELIEF_GROOVE.floorEndX, RELIEF_GROOVE.floorRadius],
      'DETAIL-RELIEF',
    ),
    arcSegment(
      [RELIEF_GROOVE.floorEndX, RELIEF_GROOVE.floorRadius],
      [RELIEF_GROOVE.endX, grooveEntryRadius],
      [RELIEF_GROOVE.floorEndX, grooveEntryRadius],
      false,
      'DETAIL-RELIEF',
    ),
    lineSegment(
      [RELIEF_GROOVE.endX, grooveEntryRadius],
      [RELIEF_GROOVE.endX, RELIEF_GROOVE.shoulderRadius],
      'DETAIL-RELIEF',
    ),
    lineSegment(
      [RELIEF_GROOVE.endX, RELIEF_GROOVE.shoulderRadius],
      [207, RELIEF_GROOVE.shoulderRadius],
    ),
    lineSegment([207, RELIEF_GROOVE.shoulderRadius], [207, 30], 'DETAIL-RELIEF'),
    lineSegment([207, 30], [208, 30], 'DETAIL-RELIEF'),
    lineSegment([208, 30], [208, 32], 'DETAIL-RELIEF'),
  ];
}

const topOuterAfterGearBase = [
  lineSegment([208, 32], [244, 32]),
  lineSegment([244, 32], [244, 30]),
  lineSegment([244, 30], [245, 29], 'DETAIL-RELIEF'),
  lineSegment([245, 29], [THREADS.right.shoulderX, 29]),
  lineSegment([THREADS.right.shoulderX, 29], [THREADS.right.shoulderX, THREADS.right.majorRadius]),
  lineSegment(
    [THREADS.right.shoulderX, THREADS.right.majorRadius],
    [THREADS.right.chamferStartX, THREADS.right.majorRadius],
  ),
  lineSegment(
    [THREADS.right.chamferStartX, THREADS.right.majorRadius],
    [THREADS.right.endX, THREADS.right.chamferRadius],
  ),
];

const topGearStart = topGearTeeth[0].start;
const topGearEnd = topGearTeeth.at(-1).end;
const lowerGearStart = lowerGearTeeth[0].start;
const lowerGearEnd = lowerGearTeeth.at(-1).end;
const topOuter = [
  ...topOuterBeforeGearBase,
  lineSegment([136, 40], [GEAR.startX, 40]),
  lineSegment([GEAR.startX, 40], topGearStart),
  ...topGearTeeth,
  ...gearFaceAndRelief(topGearEnd),
  ...topOuterAfterGearBase,
];
const lowerOuter = [
  ...topOuterBeforeGearBase.map(mirrorSegment),
  lineSegment([136, -40], [GEAR.startX, -40]),
  lineSegment([GEAR.startX, -40], lowerGearStart),
  ...lowerGearTeeth,
  ...gearFaceAndRelief(mirrorPoint(lowerGearEnd)).map(mirrorSegment),
  ...topOuterAfterGearBase.map(mirrorSegment),
];

const topBore = [
  lineSegment(
    [0, LEFT_BORE_OPENING.startRadius],
    [leftBoreOpeningAxialRun, LEFT_BORE_OPENING.endRadius],
    'PROFILE-BORE',
  ),
  lineSegment(
    [leftBoreOpeningAxialRun, LEFT_BORE_OPENING.endRadius],
    [22, LEFT_BORE_OPENING.endRadius],
    'PROFILE-BORE',
  ),
  lineSegment([22, 12], [22, 16], 'PROFILE-BORE'),
  lineSegment([22, 16], [58, 16], 'PROFILE-BORE'),
  lineSegment([58, 16], [58, 12], 'PROFILE-BORE'),
  lineSegment([58, 12], [70, 12], 'PROFILE-BORE'),
  lineSegment([70, 12], [74, 10], 'PROFILE-BORE'),
  lineSegment([74, 10], [132, 10], 'PROFILE-BORE'),
  lineSegment([132, 10], [136, 13], 'PROFILE-BORE'),
  lineSegment([136, 13], [174, 13], 'PROFILE-BORE'),
  lineSegment([174, 13], [178, 10], 'PROFILE-BORE'),
  lineSegment([178, 10], [232, 10], 'PROFILE-BORE'),
  lineSegment([232, 10], [236, 13], 'PROFILE-BORE'),
  lineSegment([236, 13], [270, 13], 'PROFILE-BORE'),
  lineSegment([270, 13], [274, 16], 'PROFILE-BORE'),
  lineSegment([274, 16], [286, 16], 'PROFILE-BORE'),
];

function lineEntity(handle, segment, linetype) {
  return [
    '0', 'LINE', '5', handle, '100', 'AcDbEntity', '8', segment.layer,
    ...(linetype ? ['6', linetype] : []),
    '100', 'AcDbLine',
    '10', fmt(segment.start[0]), '20', fmt(segment.start[1]), '30', '0',
    '11', fmt(segment.end[0]), '21', fmt(segment.end[1]), '31', '0',
  ];
}

function arcEntity(handle, segment) {
  const radius = Math.hypot(segment.start[0] - segment.center[0], segment.start[1] - segment.center[1]);
  const startAngle = angleDegrees(segment.start, segment.center);
  const endAngle = angleDegrees(segment.end, segment.center);
  const [dxfStart, dxfEnd] = segment.clockwise ? [endAngle, startAngle] : [startAngle, endAngle];
  return [
    '0', 'ARC', '5', handle, '100', 'AcDbEntity', '8', segment.layer,
    '100', 'AcDbCircle', '10', fmt(segment.center[0]), '20', fmt(segment.center[1]), '30', '0', '40', fmt(radius),
    '100', 'AcDbArc', '50', fmt(dxfStart), '51', fmt(dxfEnd),
  ];
}

function splineEntity(handle, segment) {
  return [
    '0', 'SPLINE', '5', handle, '100', 'AcDbEntity', '8', segment.layer,
    '100', 'AcDbSpline', '70', '0', '71', '3', '72', '8', '73', '4', '74', '0',
    '42', '0.0000001', '43', '0.0000001', '44', '0.0000000001',
    '40', '0', '40', '0', '40', '0', '40', '0',
    '40', '1', '40', '1', '40', '1', '40', '1',
    ...segment.controlPoints.flatMap(([x, y]) => ['10', fmt(x), '20', fmt(y), '30', '0']),
  ];
}

function hatchEntity(handle, boundary, angle) {
  return [
    '0', 'HATCH', '5', handle, '100', 'AcDbEntity', '8', 'SECTION-HATCH',
    '100', 'AcDbHatch', '10', '0', '20', '0', '30', '0',
    '210', '0', '220', '0', '230', '1', '2', 'ANSI31', '70', '0', '71', '0',
    '91', '1', '92', '3', '72', '0', '73', '1', '93', String(boundary.length),
    ...boundary.flatMap(([x, y]) => ['10', fmt(x), '20', fmt(y)]),
    '97', '0', '75', '0', '76', '1', '52', '0', '41', '1', '77', '0',
    '78', '1', '53', fmt(angle), '43', '0', '44', '0', '45', '0', '46', '4', '79', '0',
  ];
}

function angleDegrees(point, center) {
  return Math.atan2(point[1] - center[1], point[0] - center[0]) * 180 / Math.PI;
}

function sampleSegment(segment, divisions = 10) {
  if (segment.kind === 'line') return [segment.end];
  if (segment.kind === 'spline') {
    const [a, b, c, d] = segment.controlPoints;
    return Array.from({ length: divisions }, (_, index) => {
      const t = (index + 1) / divisions;
      const u = 1 - t;
      return [
        u ** 3 * a[0] + 3 * u ** 2 * t * b[0] + 3 * u * t ** 2 * c[0] + t ** 3 * d[0],
        u ** 3 * a[1] + 3 * u ** 2 * t * b[1] + 3 * u * t ** 2 * c[1] + t ** 3 * d[1],
      ];
    });
  }
  const start = Math.atan2(segment.start[1] - segment.center[1], segment.start[0] - segment.center[0]);
  const end = Math.atan2(segment.end[1] - segment.center[1], segment.end[0] - segment.center[0]);
  let sweep = end - start;
  if (segment.clockwise) {
    while (sweep >= 0) sweep -= Math.PI * 2;
  } else {
    while (sweep <= 0) sweep += Math.PI * 2;
  }
  const radius = Math.hypot(segment.start[0] - segment.center[0], segment.start[1] - segment.center[1]);
  return Array.from({ length: divisions }, (_, index) => {
    const angle = start + sweep * (index + 1) / divisions;
    return [segment.center[0] + Math.cos(angle) * radius, segment.center[1] + Math.sin(angle) * radius];
  });
}

function pathPoints(segments) {
  return [segments[0].start, ...segments.flatMap((segment) => sampleSegment(segment))];
}

function addSegments(entities, segments, nextHandle) {
  for (const segment of segments) {
    const handle = nextHandle();
    if (segment.kind === 'line') entities.push(lineEntity(handle, segment));
    else if (segment.kind === 'arc') entities.push(arcEntity(handle, segment));
    else entities.push(splineEntity(handle, segment));
  }
}

function addMirroredLine(entities, nextHandle, layer, start, end, linetype) {
  entities.push(lineEntity(nextHandle(), lineSegment(start, end, layer), linetype));
  entities.push(lineEntity(nextHandle(), lineSegment(mirrorPoint(start), mirrorPoint(end), layer), linetype));
}

function chamferIntersectionX(thread, chamferStartX, chamferEndX) {
  const radialSpan = thread.majorRadius - thread.chamferRadius;
  const axialSpan = chamferEndX - chamferStartX;
  const offset = (thread.majorRadius - thread.minorRadius) / radialSpan * axialSpan;
  return chamferStartX + offset;
}

function addExternalThreadConvention(entities, nextHandle, thread, side) {
  const chamferIntersection = side === 'left'
    ? chamferIntersectionX(thread, thread.chamferEndX, thread.endX)
    : chamferIntersectionX(thread, thread.chamferStartX, thread.endX);
  const minorStartX = side === 'left' ? chamferIntersection : thread.threadLimitX;
  const minorEndX = side === 'left' ? thread.threadLimitX : chamferIntersection;
  addMirroredLine(
    entities,
    nextHandle,
    'DETAIL-THREAD',
    [minorStartX, thread.minorRadius],
    [minorEndX, thread.minorRadius],
  );
  addMirroredLine(
    entities,
    nextHandle,
    'DETAIL-THREAD-LIMIT',
    [thread.threadLimitX, thread.minorRadius],
    [thread.threadLimitX, thread.majorRadius],
  );
}

function buildEntities() {
  const entities = [];
  let handle = 1;
  const nextHandle = () => handle.toString(16).toUpperCase().padStart(4, '0');

  addSegments(entities, topOuter, nextHandle);
  addSegments(entities, lowerOuter, nextHandle);
  addSegments(entities, topVisibleGearTraces, nextHandle);
  addSegments(entities, lowerVisibleGearTraces, nextHandle);
  addSegments(entities, topVisibleGearBoundaryConnectors, nextHandle);
  addSegments(entities, lowerVisibleGearBoundaryConnectors, nextHandle);
  addSegments(entities, topBore, nextHandle);
  addSegments(entities, topBore.map(mirrorSegment), nextHandle);

  addMirroredLine(
    entities,
    nextHandle,
    'PROFILE-BORE',
    [THREADS.left.endX, 15],
    [THREADS.left.endX, THREADS.left.chamferRadius],
  );
  addMirroredLine(
    entities,
    nextHandle,
    'PROFILE-BORE',
    [THREADS.right.endX, 16],
    [THREADS.right.endX, THREADS.right.chamferRadius],
  );
  entities.push(lineEntity(nextHandle(), lineSegment([-12, 0], [298, 0], 'CENTERLINE'), 'CENTER2'));

  addExternalThreadConvention(entities, nextHandle, THREADS.left, 'left');
  addExternalThreadConvention(entities, nextHandle, THREADS.right, 'right');

  const upperMaterial = [...pathPoints(topOuter), ...pathPoints(topBore).reverse()];
  const lowerMaterial = [
    ...pathPoints(lowerOuter),
    ...pathPoints(topBore.map(mirrorSegment)).reverse(),
  ];
  entities.push(hatchEntity(nextHandle(), upperMaterial, 45));
  entities.push(hatchEntity(nextHandle(), lowerMaterial, 45));
  return entities;
}

function ltype(name, description, elements) {
  return [
    '0', 'LTYPE', '100', 'AcDbSymbolTableRecord', '100', 'AcDbLinetypeTableRecord',
    '2', name, '70', '0', '3', description, '72', '65', '73', String(elements.length),
    '40', fmt(elements.reduce((sum, value) => sum + Math.abs(value), 0)),
    ...elements.flatMap((value) => ['49', fmt(value), '74', '0']),
  ];
}

function layer(name, color, linetype = 'CONTINUOUS', lineweight = 25) {
  return [
    '0', 'LAYER', '100', 'AcDbSymbolTableRecord', '100', 'AcDbLayerTableRecord',
    '2', name, '70', '0', '62', String(color), '6', linetype, '370', String(lineweight),
  ];
}

function dxf(entities) {
  const layers = [
    layer('0', 7),
    layer('PROFILE-OUTER', 7, 'CONTINUOUS', 50),
    layer('PROFILE-BORE', 7, 'CONTINUOUS', 50),
    layer('DETAIL-GEAR', 7, 'CONTINUOUS', 50),
    layer('DETAIL-GEAR-VISIBLE', 7, 'CONTINUOUS', 25),
    layer('DETAIL-THREAD', 7, 'CONTINUOUS', 18),
    layer('DETAIL-THREAD-LIMIT', 7, 'CONTINUOUS', 50),
    layer('DETAIL-RELIEF', 8, 'CONTINUOUS', 50),
    layer('CENTERLINE', 4, 'CENTER2', 18),
    layer('SECTION-HATCH', 2, 'CONTINUOUS', 13),
  ];
  return [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$ACADVER', '1', 'AC1027',
    '9', '$INSUNITS', '70', '4',
    '9', '$EXTMIN', '10', '-12', '20', fmt(-GEAR.tipRadius), '30', '0',
    '9', '$EXTMAX', '10', '298', '20', fmt(GEAR.tipRadius), '30', '0',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'TABLES',
    '0', 'TABLE', '2', 'LTYPE', '70', '3',
    ...ltype('CONTINUOUS', 'Solid line', []),
    ...ltype('CENTER2', 'Center line', [0.75, -0.25, 0.125, -0.25]),
    ...ltype('DASHED2', 'Dashed line', [0.5, -0.25]),
    '0', 'ENDTAB',
    '0', 'TABLE', '2', 'LAYER', '70', String(layers.length), ...layers.flat(), '0', 'ENDTAB',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES', ...entities.flat(), '0', 'ENDSEC',
    '0', 'EOF', '',
  ].join('\n');
}

await mkdir(fixtureDirectory, { recursive: true });
await writeFile(resolve(fixtureDirectory, 'initial.dxf'), dxf(buildEntities()), 'utf8');
