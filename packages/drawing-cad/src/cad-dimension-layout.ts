// SPDX-License-Identifier: Apache-2.0

import type { DimensionAnnotation, DrawingDocument, DxfDimensionStyle, DxfExportProfile, GeometryNode, Vec2 } from '@vectorai/drawing-core';

export interface CadTextBounds { minX: number; minY: number; maxX: number; maxY: number }

export interface CadDimensionFootprint {
  width: number;
  height: number;
  textHeight: number;
  textGap: number;
  arrowSize: number;
  dimensionStyle: string;
  extension: number;
  originOffset: number;
  angularTextOrientation?: DxfDimensionStyle['angularTextOrientation'];
}

export interface CadDimensionPlacement {
  annotationId: string;
  kind: DimensionAnnotation['dimensionKind'];
  automatic: boolean;
  textPosition: Vec2;
  rotation: number;
  textBounds: CadTextBounds;
  footprint: CadDimensionFootprint;
  arrowsOutside: boolean;
  textGapOverride?: number;
  line?: { witnessA: Vec2; witnessB: Vec2; start: Vec2; end: Vec2 };
  arc?: { center: Vec2; radius: number; startAngle: number; sweep: number; witnesses?: Array<{ start: Vec2; end: Vec2 }> };
  leader?: { start: Vec2; end: Vec2 };
}

export interface CadDimensionLayout {
  document: DrawingDocument;
  placements: CadDimensionPlacement[];
  textObstacles: Array<{ annotationId: string; textBounds: CadTextBounds }>;
}

type Segment = readonly [Vec2, Vec2];
interface Context {
  points: Vec2[];
  contours: Segment[];
  hull: Vec2[];
  geometry: Map<string, GeometryNode>;
  placements: CadDimensionPlacement[];
  textObstacles: CadDimensionLayout['textObstacles'];
}

interface CandidateChoice { penalty: number; distance: number; points: Vec2[]; placement: CadDimensionPlacement }

/**
 * Project explicit automatic layout into physical CAD typography on a clone.
 * Measurement, associations and controlled witnesses remain authoritative.
 * Legacy/manual positions are obstacles, never inferred to be automatic.
 */
export function projectCadDimensionLayout(source: DrawingDocument, profile: DxfExportProfile): CadDimensionLayout {
  const document = structuredClone(source);
  const dimensions = document.annotations.filter((node): node is DimensionAnnotation => node.type === 'dimension' && node.visible);
  const geometry = document.geometry.filter(({ visible }) => visible);
  const contours = geometry.flatMap(geometrySegments);
  const textObstacles = annotationTextObstacles(document, profile);
  const context: Context = { points: geometry.flatMap(geometryPoints), contours, hull: [], geometry: new Map(geometry.map((node) => [String(node.id), node])), placements: [], textObstacles };
  if (context.points.length === 0) context.points = dimensions.flatMap(({ definitionPoints }) => definitionPoints);
  if (context.points.length === 0) context.points = [[0, 0]];
  context.hull = convexHull(context.points);
  const circles = new Set(document.geometry.filter(({ type }) => type === 'circle').map(({ id }) => String(id)));
  const profileDiameter = (node: DimensionAnnotation) => node.dimensionKind === 'diameter'
    && node.definitionPoints.length >= 4 && !node.targets.some(({ geometryId }) => circles.has(String(geometryId)));
  const styleName = (node: DimensionAnnotation) => node.dimensionKind === 'angular' ? 'GB_ANGULAR'
    : node.dimensionKind === 'radius' || node.dimensionKind === 'diameter' && !profileDiameter(node) ? 'GB_RADIAL' : 'GB_LINEAR';
  const footprint = (node: DimensionAnnotation) => measureCadDimensionFootprint(node, profile, document.unitSystem.length, styleName(node));

  for (const node of dimensions) {
    const style = dimensionStyle(node, profile, styleName(node));
    if (node.layout?.generatedText !== undefined && node.displayText === node.layout.generatedText) {
      node.displayText = generatedDimensionText(node, style);
      node.layout.generatedText = node.displayText;
    }
    if (node.layout?.mode !== 'automatic') context.placements.push(placement(node, footprint(node), false));
  }
  const automatic = dimensions.filter((node) => node.layout?.mode === 'automatic');
  // Arc text establishes its sector first. Linear witnesses and diameter rows
  // then reserve that space instead of placing a dimension through the label.
  for (const node of sorted(automatic.filter(({ dimensionKind }) => dimensionKind === 'angular'))
    .sort((a, b) => Math.abs(a.computedValue ?? a.observedValue ?? 0) - Math.abs(b.computedValue ?? b.observedValue ?? 0))) {
    placeAngular(node, footprint(node), context);
  }
  const profileDiameters = automatic.filter(profileDiameter);
  placeProfileDiameters(profileDiameters, footprint, context);
  for (const node of sorted(automatic.filter((node) => node.dimensionKind === 'diameter' && !profileDiameters.includes(node)))) {
    placeCircularDiameter(node, footprint(node), context);
  }
  placeLinearDimensions(automatic.filter(({ dimensionKind }) => ['linear', 'aligned', 'ordinate', 'arc-length'].includes(dimensionKind)), footprint, context);
  for (const node of sorted(automatic.filter(({ dimensionKind }) => dimensionKind === 'radius'))) {
    placeRadius(node, footprint(node), context);
  }
  const order = new Map(dimensions.map((node, index) => [String(node.id), index]));
  context.placements.sort((a, b) => order.get(a.annotationId)! - order.get(b.annotationId)!);
  return { document, placements: context.placements, textObstacles };
}

/** Measure the actual visible label, including fit text and stacked deviations. */
export function measureCadDimensionFootprint(
  node: DimensionAnnotation,
  profile: DxfExportProfile,
  drawingUnit: DrawingDocument['unitSystem']['length'],
  styleName?: string,
): CadDimensionFootprint {
  const style = dimensionStyle(node, profile, styleName);
  const textHeight = Math.max(0.01, style?.textHeight ?? 2.5);
  const widthFactor = profile.textStyles.find(({ name }) => name === style?.textStyle)?.widthFactor ?? 1;
  const base = node.layout?.generatedText !== undefined && node.displayText === node.layout.generatedText
    ? generatedDimensionText(node, style)
    : node.displayText ?? numericDimensionText(node, style);
  const lines = base.replace(/\\P/g, '\n').split('\n');
  let width = Math.max(...lines.map((line) => textWidth(line, textHeight, widthFactor)), textHeight * 0.2);
  let height = textHeight * lines.length;
  const tolerance = node.toleranceProjection;
  let upper: number | undefined;
  let lower: number | undefined;
  let scale = 1;
  let designation = '';
  let stacked = false;
  let limits = false;
  if (tolerance && ['confirmed', 'resolved'].includes(tolerance.status)) {
    const preference = tolerance.displayPreference ?? (tolerance.mode === 'fit' ? 'designation' : 'deviations');
    if (preference !== 'deviations') designation = tolerance.fitDesignation?.trim() ?? '';
    if (tolerance.mode === 'limits') {
      upper = tolerance.upperLimit;
      lower = tolerance.lowerLimit;
      stacked = upper !== undefined && lower !== undefined;
      limits = true;
    } else if (['bilateral', 'unilateral', 'fit'].includes(tolerance.mode) && preference !== 'designation') {
      stacked = tolerance.upperDeviation !== undefined || tolerance.lowerDeviation !== undefined;
      upper = tolerance.upperDeviation ?? 0;
      lower = tolerance.lowerDeviation ?? 0;
      if (node.dimensionKind !== 'angular' && tolerance.unit !== 'deg') scale = unitMillimeters(tolerance.unit) / unitMillimeters(drawingUnit);
    }
  } else if (node.tolerance) {
    upper = node.tolerance.upper ?? 0;
    lower = node.tolerance.lower ?? 0;
    stacked = node.tolerance.upper !== undefined || node.tolerance.lower !== undefined;
  }
  width += textWidth(designation, textHeight, widthFactor);
  if (stacked) {
    const high = (upper ?? 0) * scale;
    const low = (lower ?? 0) * scale;
    if (!limits && high > 0 && high === -low) width += textWidth(`±${high}`, textHeight, widthFactor);
    else {
      const upperText = limits ? String(high) : signed(high);
      const lowerText = limits ? String(low) : signed(low);
      const toleranceHeight = textHeight * 0.71;
      width += Math.max(textWidth(upperText, toleranceHeight, widthFactor), textWidth(lowerText, toleranceHeight, widthFactor)) + textHeight * 0.15;
      height = Math.max(height, toleranceHeight * 2.1);
    }
  }
  return { width, height, textHeight, textGap: Math.max(0, style?.textGap ?? textHeight / 4), arrowSize: Math.max(0.01, style?.arrowSize ?? textHeight), dimensionStyle: style?.name ?? 'GB_LINEAR', extension: Math.max(0, style?.extension ?? 1), originOffset: Math.max(0, style?.originOffset ?? 0), angularTextOrientation: style?.angularTextOrientation };
}

interface LinearItem {
  node: DimensionAnnotation; direction: Vec2; normal: Vec2; side: number;
  min: number; max: number; size: CadDimensionFootprint;
}

function placeLinearDimensions(nodes: DimensionAnnotation[], footprint: (node: DimensionAnnotation) => CadDimensionFootprint, context: Context): void {
  const groups = new Map<string, LinearItem[]>();
  for (const node of nodes) {
    if (node.definitionPoints.length < 2) { context.placements.push(placement(node, footprint(node), true)); continue; }
    const [sourceA, sourceB] = node.definitionPoints;
    const [lineA, lineB] = linearEndpoints(node);
    const direction = canonicalDirection(sub(lineB, lineA));
    const normal = perpendicular(direction);
    const extent = projectedExtent(context.points, normal);
    const oldOffset = dot(midpoint(lineA, lineB), normal);
    const sourceOffset = dot(midpoint(sourceA, sourceB), normal);
    const side = oldOffset < (extent.min + extent.max) / 2 ? -1 : 1;
    const size = footprint(node);
    const projected = [dot(sourceA, direction), dot(sourceB, direction)];
    const item = { node, direction, normal, side, min: Math.min(...projected), max: Math.max(...projected), size };
    // The original internal line and internal witnesses express a local
    // placement intent. Small opening depths should use that channel instead
    // of joining the drawing's exterior overall-dimension rows.
    if (node.definitionPoints.length >= 4 && item.max - item.min < size.width + size.arrowSize * 2 + size.textGap * 2
      && sourceOffset > extent.min + size.height && sourceOffset < extent.max - size.height
      && oldOffset > extent.min && oldOffset < extent.max) {
      placeInternalLinear(item, oldOffset, sourceOffset, context);
      continue;
    }
    const key = `${Math.round(Math.atan2(direction[1], direction[0]) * 1e6)}:${side}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    const levels = linearLevels(group);
    group.sort((a, b) => levels.get(a)! - levels.get(b)! || a.min - b.min || a.max - b.max || String(a.node.id).localeCompare(String(b.node.id)));
    const rows: LinearItem[][] = [];
    const placedRows = new Map<LinearItem, number>();
    const rowHeight = Math.max(...group.map(({ size }) => size.height + size.textGap * 2 + size.arrowSize / 3));
    // One shared baseline per row, even when only some labels have stacked
    // tolerances. Label height must not move the underlying dimension line.
    const inset = Math.max(...group.map(({ size }) => size.height + size.textGap * 3 + size.arrowSize));
    for (const item of group) {
      const { node, direction, normal, side, min, max, size } = item;
      const [sourceA, sourceB] = node.definitionPoints;
      const extent = projectedExtent(context.points, normal);
      const edge = side < 0 ? extent.min : extent.max;
      let best: { row: number; score: number; points: Vec2[]; placement: CadDimensionPlacement } | undefined;
      const children = group.filter((other) => other !== item && other.min >= min - 1e-6 && other.max <= max + 1e-6 && other.max - other.min < max - min - 1e-6);
      const firstRow = Math.max(levels.get(item)!, ...children.map((child) => (placedRows.get(child) ?? -1) + 1));
      for (let row = firstRow; row < firstRow + candidateCount(context); row++) {
        const offset = edge + side * (inset + row * rowHeight);
        const start = add(scale(direction, dot(sourceA, direction)), scale(normal, offset));
        const end = add(scale(direction, dot(sourceB, direction)), scale(normal, offset));
        node.definitionPoints = [sourceA, sourceB, start, end];
        node.textPosition = add(midpoint(start, end), scale(normal, size.height / 2 + size.textGap));
        const candidate = fitLinearArrows(placement(node, size, true), context);
        // Adjacent intervals share a witness, not occupied paper. Arrows and
        // glyphs are checked by their actual placement, not inflated spans.
        const occupied = (rows[row] ?? []).filter((other) => min < other.max - 1e-6 && max > other.min + 1e-6).length;
        const score = placementPenalty(candidate, context, false) + occupied * 100;
        if (!best || score < best.score) best = { row, score, points: [...node.definitionPoints], placement: candidate };
        if (score === 0) break;
      }
      node.definitionPoints = best!.points;
      node.textPosition = best!.placement.textPosition;
      (rows[best!.row] ??= []).push(item);
      placedRows.set(item, best!.row);
      context.placements.push(best!.placement);
    }
  }
}

/** Keep connected segments together, then place enclosing spans outside them. */
function linearLevels(items: LinearItem[]): Map<LinearItem, number> {
  const epsilon = Math.max(...items.map(({ size }) => size.textHeight)) * 0.001;
  const contains = (a: LinearItem, b: LinearItem) => a !== b && a.min <= b.min + epsilon && a.max >= b.max - epsilon
    && a.max - a.min > b.max - b.min + epsilon;
  const parents = items.map((_, index) => index);
  const root = (index: number): number => parents[index] === index ? index : root(parents[index]);
  const join = (a: LinearItem, b: LinearItem) => {
    const one = root(items.indexOf(a)); const two = root(items.indexOf(b));
    if (one === two) return;
    const membersA = items.filter((_, index) => root(index) === one);
    const membersB = items.filter((_, index) => root(index) === two);
    if (membersA.some((left) => membersB.some((right) => contains(left, right) || contains(right, left)))) return;
    parents[two] = one;
    // Overlapping chains can otherwise create a cycle between two groups:
    // each group contains one member of the other. Keep those chains separate.
    const visited = new Set<number>(); const active = new Set<number>();
    const cyclic = (group: number): boolean => {
      if (active.has(group)) return true;
      if (visited.has(group)) return false;
      active.add(group);
      const children = items.flatMap((outer, index) => root(index) === group
        ? items.flatMap((inner, child) => contains(outer, inner) && root(child) !== group ? [root(child)] : []) : []);
      if (children.some(cyclic)) return true;
      active.delete(group); visited.add(group); return false;
    };
    if (items.some((_, index) => cyclic(root(index)))) parents[two] = two;
  };
  for (const item of items) {
    // At a branch station, connect the shortest adjoining segment. Joining
    // every span there would merge a feature with its own enclosing stack.
    const next = items.filter((other) => Math.abs(other.min - item.max) <= epsilon)
      .sort((a, b) => a.max - a.min - (b.max - b.min))[0];
    const previous = next && items.filter((other) => Math.abs(other.max - next.min) <= epsilon)
      .sort((a, b) => a.max - a.min - (b.max - b.min))[0];
    if (next && previous === item) join(item, next);
  }
  for (const parent of items) {
    const leaves = items.filter((item) => contains(parent, item) && !items.some((child) => contains(item, child))
      && !items.some((middle) => contains(parent, middle) && contains(middle, item)));
    leaves.slice(1).forEach((leaf) => join(leaves[0], leaf));
  }
  const levels = new Map(items.map((item) => [item, 0]));
  // The strict interval-containment relation is finite. Each pass only
  // propagates a child's level to its enclosing group.
  for (let pass = 0; pass < items.length; pass++) {
    let changed = false;
    items.forEach((item, index) => {
      const members = items.filter((_, other) => root(other) === root(index));
      const children = items.filter((child) => members.some((member) => contains(member, child)));
      const level = children.length ? Math.max(...children.map((child) => levels.get(child)! + 1)) : 0;
      if (level > levels.get(item)!) { members.forEach((member) => levels.set(member, level)); changed = true; }
    });
    if (!changed) break;
  }
  return levels;
}

function placeInternalLinear(item: LinearItem, oldOffset: number, sourceOffset: number, context: Context): void {
  const { node, direction, normal, min, max, size } = item;
  const [sourceA, sourceB] = node.definitionPoints;
  const range = projectedExtent(context.points, direction);
  const inward = (min + max) / 2 < (range.min + range.max) / 2 ? 1 : -1;
  const textCoordinate = (inward > 0 ? max : min) + inward * (size.arrowSize + size.textGap + size.width / 2);
  const radius = Math.max(Math.abs(oldOffset - sourceOffset), size.height + size.textGap * 2);
  const minimum = sourceOffset - radius;
  const maximum = sourceOffset + radius;
  const step = size.height + size.textGap * 2;
  const toward = oldOffset < sourceOffset ? 1 : -1;
  let best: CandidateChoice | undefined;
  for (let attempt = 0; attempt < candidateCount(context); attempt++) {
    const index = attempt === 0 ? 0 : Math.ceil(attempt / 2) * (attempt % 2 ? 1 : -1);
    const offset = oldOffset + index * toward * step;
    const textOffset = offset + size.height / 2 + size.textGap;
    if (textOffset - size.height / 2 <= minimum || textOffset + size.height / 2 >= maximum) continue;
    node.definitionPoints = [sourceA, sourceB,
      add(scale(direction, dot(sourceA, direction)), scale(normal, offset)),
      add(scale(direction, dot(sourceB, direction)), scale(normal, offset))];
    node.textPosition = add(scale(direction, textCoordinate), scale(normal, textOffset));
    const candidate = fitLinearArrows(placement(node, size, true), context);
    best = chooseCandidate(best, node, candidate, context, Math.abs(offset - oldOffset));
    if (best.penalty === 0) break;
  }
  if (best) applyChoice(node, best, context);
  else context.placements.push(placement(node, size, true));
}

function placeProfileDiameters(nodes: DimensionAnnotation[], footprint: (node: DimensionAnnotation) => CadDimensionFootprint, context: Context): void {
  const items = nodes.map((node) => {
    const direction = canonicalDirection(sub(node.definitionPoints[1], node.definitionPoints[0]));
    const axis = canonicalDirection(perpendicular(direction));
    const range = projectedExtent(context.points, axis);
    const coordinate = dot(midpoint(node.definitionPoints[0], node.definitionPoints[1]), axis);
    const side = coordinate < range.min ? -1 : coordinate > range.max ? 1 : 0;
    return { node, direction, axis, range, coordinate, side, size: footprint(node) };
  });
  // Two neighboring profile measurements that share almost the same witness
  // station and almost the same radial envelope cannot both occupy that
  // station legibly. Move the cluster together, preserving its radial order.
  // This applies to arbitrary sectional profiles, not to true circle diameters.
  for (const item of items) {
    const source = midpoint(item.node.definitionPoints[2], item.node.definitionPoints[3]);
    const competing = items.some((other) => other !== item && Math.abs(dot(item.axis, other.axis)) > 0.999
      && Math.abs(dot(sub(source, midpoint(other.node.definitionPoints[2], other.node.definitionPoints[3])), item.axis)) < (item.size.height + other.size.height) / 2 + Math.max(item.size.textGap, other.size.textGap) * 2
      && Math.abs(distance(item.node.definitionPoints[0], item.node.definitionPoints[1]) - distance(other.node.definitionPoints[0], other.node.definitionPoints[1])) < Math.max(item.size.textHeight, other.size.textHeight) * 2);
    if (competing && item.side === 0) item.side = dot(source, item.axis) < (item.range.min + item.range.max) / 2 ? -1 : 1;
  }
  items.sort((a, b) => Number(a.side !== 0) - Number(b.side !== 0)
    || a.side - b.side || distance(a.node.definitionPoints[0], a.node.definitionPoints[1]) - distance(b.node.definitionPoints[0], b.node.definitionPoints[1]) || String(a.node.id).localeCompare(String(b.node.id)));
  for (const item of items) {
    const { node, axis, range, size } = item;
    const [first, second, witnessA, witnessB] = node.definitionPoints;
    const center = midpoint(first, second);
    const side = item.side || (dot(midpoint(witnessA, witnessB), axis) < (range.min + range.max) / 2 ? -1 : 1);
    const step = size.height + size.textGap * 2;
    let best: CandidateChoice | undefined;
    // Interior station labels remain inside their profile when there is room;
    // only labels that cannot fit are assigned to the nearest exterior group.
    // Like linear dimensions, profile dimensions use the writer's text gaps
    // for line crossings; adjacent notes must not reorder their columns.
    if (item.side === 0) {
      for (let attempt = 0; attempt < 32; attempt++) {
        const delta = attempt === 0 ? 0 : Math.ceil(attempt / 2) * step * (attempt % 2 ? side : -side);
        const coordinate = item.coordinate + delta;
        if (coordinate <= range.min + step / 2 || coordinate >= range.max - step / 2) continue;
        shiftDiameter(node, first, second, center, axis, coordinate - item.coordinate);
        const probe = placement(node, size, true);
        best = chooseCandidate(best, node, probe, context, Math.abs(coordinate - item.coordinate), 0, false);
        if (best.penalty === 0) break;
      }
    }
    if (!best || best.penalty > 0) {
      for (let attempt = 0; attempt < candidateCount(context); attempt++) {
        const coordinate = (side < 0 ? range.min : range.max) + side * (size.height / 2 + size.textGap * 2 + attempt * step);
        shiftDiameter(node, first, second, center, axis, coordinate - item.coordinate);
        const probe = placement(node, size, true);
        best = chooseCandidate(best, node, probe, context, Math.abs(coordinate - item.coordinate), 0, false);
        if (best.penalty === 0) break;
      }
    }
    applyChoice(node, best!, context);
  }
}

function shiftDiameter(node: DimensionAnnotation, first: Vec2, second: Vec2, center: Vec2, axis: Vec2, delta: number): void {
  const translation = scale(axis, delta);
  node.definitionPoints = [add(first, translation), add(second, translation), ...node.definitionPoints.slice(2)];
  node.textPosition = add(center, translation);
}

function placeCircularDiameter(node: DimensionAnnotation, size: CadDimensionFootprint, context: Context): void {
  if (node.definitionPoints.length < 2) { context.placements.push(placement(node, size, true)); return; }
  const [first, second] = node.definitionPoints;
  const direction = canonicalDirection(sub(second, first));
  const normal = perpendicular(direction);
  const center = midpoint(first, second);
  const fits = distance(first, second) >= size.width + size.textGap * 2 + size.arrowSize * 2;
  let best: CandidateChoice | undefined;
  for (let attempt = 0; attempt < candidateCount(context); attempt++) {
    node.textPosition = fits && attempt === 0 ? center
      : add(add(second, scale(direction, size.arrowSize + size.width / 2 + size.textGap)), scale(normal, attempt * (size.height + size.textGap * 2)));
    const candidate = placement(node, size, true);
    if (!fits || attempt > 0) candidate.leader = {
      start: distance(first, node.textPosition) < distance(second, node.textPosition) ? first : second,
      end: node.textPosition,
    };
    best = chooseCandidate(best, node, candidate, context, distance(center, candidate.textPosition));
    if (best.penalty === 0) break;
  }
  applyChoice(node, best!, context);
}

function placeAngular(node: DimensionAnnotation, size: CadDimensionFootprint, context: Context): void {
  if (node.definitionPoints.length < 5) { context.placements.push(placement(node, size, true)); return; }
  const [vertex, legA, legB, arcA, arcB] = node.definitionPoints;
  const angleA = Math.atan2(arcA[1] - vertex[1], arcA[0] - vertex[0]);
  const angleB = Math.atan2(arcB[1] - vertex[1], arcB[0] - vertex[0]);
  const sweep = angularSweep(angleA, angleB, Math.abs(node.computedValue ?? node.observedValue ?? 0));
  const bisector = angleA + sweep / 2;
  const controlledLines = node.targets.flatMap(({ geometryId }): Array<Extract<GeometryNode, { type: 'line' }>> => {
    const geometry = context.geometry.get(String(geometryId));
    return geometry?.type === 'line' ? [geometry] : [];
  });
  const controlledPoints = controlledLines.flatMap((line) => [line.start, line.end]);
  // Fit around the measured surfaces as well as the label. In particular,
  // an opening's vertex can lie deep inside a cavity while its actual control
  // lines lie at the mouth; a text-only radius collapses the arc into the part.
  const controlRadius = Math.max(...(controlledPoints.length ? controlledPoints : [legA, legB]).map((point) => distance(vertex, point)));
  const fitRadius = Math.max(size.textHeight * 2, (size.arrowSize * 2 + size.textGap * 2 + size.width) / Math.max(Math.abs(sweep), 0.05));
  const ray: Vec2 = [Math.cos(bisector), Math.sin(bisector)];
  const interiorLimit = Math.min(
    ...controlledPoints.map((point) => distance(vertex, point) - size.textGap),
    rayExitDistance(vertex, ray, context.hull) - size.height - size.textGap,
  );
  // An interior opening arc is useful only when the entire fitted label can
  // remain before the body's end. A wider mouth with its vertex close to the
  // end cannot fit there and therefore encloses the controlled faces outside.
  const interior = controlledPoints.length > 0 && fitRadius <= interiorLimit
    && !outsideEnvelope({ minX: vertex[0], maxX: vertex[0], minY: vertex[1], maxY: vertex[1] }, context.hull);
  const minimumRadius = interior ? fitRadius : Math.max(controlRadius + size.textGap, fitRadius);
  let best: CandidateChoice | undefined;
  for (let attempt = 0; attempt < candidateCount(context); attempt++) {
    const radius = minimumRadius + attempt * (size.height + size.textGap * 2);
    if (interior && radius > interiorLimit) break;
    node.definitionPoints = [vertex, legA, legB, polar(vertex, radius, angleA), polar(vertex, radius, angleB)];
    node.textPosition = polar(vertex, radius + size.height / 2 + size.textGap, bisector);
    const candidate = placement(node, size, true);
    candidate.arc!.witnesses = [angleA, angleB].map((angle) => {
      const ray: Vec2 = [Math.cos(angle), Math.sin(angle)];
      const matched = controlledLines.map((line) => ({ line, alignment: dot(normalized(sub(midpoint(line.start, line.end), vertex)), ray) }))
        .filter(({ alignment }) => alignment > 1 - 1e-6).sort((a, b) => b.alignment - a.alignment)[0]?.line;
      // These are the actual controlled mouth endpoints. The canonical leg
      // points may be viewport-sized extension ends from a previous layout.
      const endpoint = matched ? ((distance(vertex, matched.start) > distance(vertex, matched.end)) !== interior ? matched.start : matched.end) : vertex;
      const extensionDirection = interior ? -1 : 1;
      return { start: add(endpoint, scale(ray, size.originOffset * extensionDirection)), end: polar(vertex, radius + size.extension * extensionDirection, angle) };
    });
    best = chooseCandidate(best, node, candidate, context, radius);
    if (best.penalty === 0) break;
  }
  applyChoice(node, best!, context);
}

function placeRadius(node: DimensionAnnotation, size: CadDimensionFootprint, context: Context): void {
  if (node.definitionPoints.length < 2) { context.placements.push(placement(node, size, true)); return; }
  const [center, edge] = node.definitionPoints;
  const radialAngle = Math.atan2(edge[1] - center[1], edge[0] - center[0]);
  const initial = size.arrowSize + size.width / 2 + size.textGap * 2;
  const directions = [Math.PI, 0, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 0.5, Math.PI * 1.5, Math.PI * 0.25, Math.PI * 1.75];
  let best: CandidateChoice | undefined;
  for (const offset of directions) {
    const ray: Vec2 = [Math.cos(radialAngle + offset), Math.sin(radialAngle + offset)];
    const firstLength = Math.max(initial, rayExitDistance(edge, ray, context.hull) + Math.hypot(size.width, size.height) / 2 + size.textGap);
    for (let attempt = 0; attempt < candidateCount(context); attempt++) {
      const length = firstLength + attempt * (size.height + size.textGap * 2);
      if (best?.penalty === 0 && length > best.distance) break;
      node.textPosition = polar(edge, length, radialAngle + offset);
      const candidate = placement(node, size, true);
      const deviation = Math.min(positive(offset, Math.PI), Math.PI - positive(offset, Math.PI));
      best = chooseCandidate(best, node, candidate, context, length + deviation * size.textHeight * 4,
        outsideEnvelope(expanded(candidate.textBounds, size.textGap), context.hull) ? 0 : 1000);
      if (best.placement === candidate && best.penalty === 0) break;
    }
  }
  applyChoice(node, best!, context);
  if (node.definitionPoints.length > 2) node.definitionPoints = [center, edge, node.textPosition, ...node.definitionPoints.slice(3)];
}

function candidateCount(context: Context): number { return Math.max(8, Math.min(64, 8 + (context.placements.length + context.textObstacles.length) * 2)); }

function chooseCandidate(best: CandidateChoice | undefined, node: DimensionAnnotation, candidate: CadDimensionPlacement, context: Context, displacement: number, additionalPenalty = 0, includePictureCrossings = true): CandidateChoice {
  const penalty = placementPenalty(candidate, context, includePictureCrossings) + additionalPenalty;
  return !best || penalty < best.penalty || penalty === best.penalty && displacement < best.distance
    ? { penalty, distance: displacement, points: [...node.definitionPoints], placement: candidate } : best;
}

function applyChoice(node: DimensionAnnotation, choice: CandidateChoice, context: Context): void {
  node.textPosition = choice.placement.textPosition;
  node.definitionPoints = choice.points;
  context.placements.push(choice.placement);
}

function rayExitDistance(origin: Vec2, ray: Vec2, polygon: Vec2[]): number {
  const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
  let exit = 0;
  polygon.forEach((start, index) => {
    const segment = sub(polygon[(index + 1) % polygon.length], start);
    const denominator = cross(ray, segment);
    if (Math.abs(denominator) < 1e-10) return;
    const delta = sub(start, origin);
    const along = cross(delta, segment) / denominator;
    const parameter = cross(delta, ray) / denominator;
    if (along >= 0 && parameter >= 0 && parameter <= 1) exit = Math.max(exit, along);
  });
  return exit;
}

function placement(node: DimensionAnnotation, footprint: CadDimensionFootprint, automatic: boolean): CadDimensionPlacement {
  const points = node.definitionPoints;
  let rotation = 0;
  let line: CadDimensionPlacement['line'];
  let arc: CadDimensionPlacement['arc'];
  let leader: CadDimensionPlacement['leader'];
  if (points.length >= 2 && node.dimensionKind !== 'angular') {
    const [start, end] = node.dimensionKind === 'diameter' || node.dimensionKind === 'radius' ? points : linearEndpoints(node);
    rotation = readableAngle(Math.atan2(end[1] - start[1], end[0] - start[0]) * 180 / Math.PI);
    if (node.dimensionKind !== 'radius') line = {
      witnessA: node.dimensionKind === 'diameter' ? points[2] ?? start : points[0],
      witnessB: node.dimensionKind === 'diameter' ? points[3] ?? end : points[1], start, end,
    };
    else {
      leader = { start: end, end: node.textPosition };
      rotation = readableAngle(Math.atan2(node.textPosition[1] - end[1], node.textPosition[0] - end[0]) * 180 / Math.PI);
    }
  } else if (node.dimensionKind === 'angular' && points.length >= 5) {
    const a = Math.atan2(points[3][1] - points[0][1], points[3][0] - points[0][0]);
    const b = Math.atan2(points[4][1] - points[0][1], points[4][0] - points[0][0]);
    const sweep = angularSweep(a, b, Math.abs(node.computedValue ?? node.observedValue ?? 0));
    rotation = footprint.angularTextOrientation === 'horizontal' ? 0 : readableAngle((a + sweep / 2) * 180 / Math.PI + 90);
    arc = { center: points[0], radius: distance(points[0], points[3]), startAngle: a, sweep };
  }
  return { annotationId: String(node.id), kind: node.dimensionKind, automatic, textPosition: node.textPosition, rotation,
    textBounds: rotatedBounds(node.textPosition, footprint.width, footprint.height, rotation), footprint,
    arrowsOutside: line !== undefined && distance(line.start, line.end) < footprint.width + footprint.textGap * 2 + footprint.arrowSize * 2,
    ...(line ? { line } : {}),
    ...(arc ? { arc } : {}),
    ...(leader ? { leader } : {}),
  };
}

function blocked(candidate: CadDimensionPlacement, context: Context): boolean {
  return placementPenalty(candidate, context) > 0;
}

/** An above-line label leaves room for the arrow pair even when it cannot fit inline. */
function fitLinearArrows(candidate: CadDimensionPlacement, context: Context): CadDimensionPlacement {
  if (!candidate.arrowsOutside || !candidate.line
    || distance(candidate.line.start, candidate.line.end) < candidate.footprint.arrowSize * 2) return candidate;
  const obstacles = [candidate.textBounds, ...context.textObstacles.map(({ textBounds }) => textBounds),
    ...context.placements.map(({ textBounds }) => textBounds)];
  const crosses = (item: CadDimensionPlacement) => arrowTriangles(item).some((triangle) =>
    obstacles.some((box) => triangleIntersectsBounds(triangle, box)));
  // Use the remaining paper space for a per-dimension gap, so native CAD
  // regeneration can fit the same arrow pair without reducing arrow size.
  const gap = Math.min(candidate.footprint.textGap,
    (distance(candidate.line.start, candidate.line.end) - candidate.footprint.arrowSize * 2) / 2);
  const inside = { ...candidate, arrowsOutside: false, textGapOverride: gap,
    footprint: { ...candidate.footprint, textGap: gap } };
  return crosses(candidate) && !crosses(inside) ? inside : candidate;
}

function arrowTriangles(candidate: CadDimensionPlacement): Vec2[][] {
  if (!candidate.line) return [];
  const { start, end } = candidate.line;
  const direction = normalized(sub(end, start));
  const normal = perpendicular(direction);
  const size = candidate.footprint.arrowSize;
  return [start, end].map((tip, index) => {
    const sign = (index === 0 ? 1 : -1) * (candidate.arrowsOutside ? -1 : 1);
    const base = add(tip, scale(direction, sign * size));
    return [tip, add(base, scale(normal, size / 6)), add(base, scale(normal, -size / 6))];
  });
}

function triangleIntersectsBounds(triangle: Vec2[], box: CadTextBounds): boolean {
  if (triangle.some((point, index) => segmentIntersectsBounds(point, triangle[(index + 1) % 3], box))) return true;
  const center: Vec2 = [(box.minX + box.maxX) / 2, (box.minY + box.maxY) / 2];
  const sides = triangle.map((a, index) => {
    const b = triangle[(index + 1) % 3];
    return (b[0] - a[0]) * (center[1] - a[1]) - (b[1] - a[1]) * (center[0] - a[0]);
  });
  return sides.every((value) => value > 0) || sides.every((value) => value < 0);
}

function placementPenalty(candidate: CadDimensionPlacement, context: Context, includePictureCrossings = true): number {
  const bounds = expanded(candidate.textBounds, candidate.footprint.textGap / 2);
  return context.contours.filter(([a, b]) => segmentIntersectsBounds(a, b, bounds)).length * 20
    + arrowTriangles(candidate).filter((triangle) => [...context.textObstacles, ...context.placements]
      .some(({ textBounds }) => triangleIntersectsBounds(triangle, textBounds))).length * 100
    + context.textObstacles.reduce((penalty, other) => penalty + (overlap(bounds, other.textBounds) ? 100 : 0)
      + (includePictureCrossings && pictureSegments(candidate).some(([a, b]) => segmentIntersectsBounds(a, b, other.textBounds)) ? 1 : 0), 0)
    + context.placements.reduce((penalty, other) => penalty
      + (overlap(bounds, expanded(other.textBounds, other.footprint.textGap / 2)) ? 100 : 0)
      + (includePictureCrossings && pictureSegments(other).some(([a, b]) => segmentIntersectsBounds(a, b, bounds)) ? 1 : 0)
      + (includePictureCrossings && pictureSegments(candidate).some(([a, b]) => segmentIntersectsBounds(a, b, expanded(other.textBounds, other.footprint.textGap / 2))) ? 1 : 0), 0);
}

function annotationTextObstacles(document: DrawingDocument, profile: DxfExportProfile): CadDimensionLayout['textObstacles'] {
  const style = profile.dimensionStyles.find(({ name }) => name === 'GB_LEADER') ?? profile.dimensionStyles[0];
  const widthFactor = profile.textStyles.find(({ name }) => name === style?.textStyle)?.widthFactor ?? 1;
  return document.annotations.flatMap((node) => {
    if (!node.visible || node.type !== 'text' && node.type !== 'leader') return [];
    const position = node.type === 'text' ? node.position : node.points.at(-1);
    if (!position || !node.content) return [];
    const textHeight = node.type === 'text' ? node.height : node.textHeight;
    const lines = node.content.replace(/\\P/g, '\n').split('\n');
    const factor = node.type === 'text' ? profile.plainTextWidthFactor ?? widthFactor : widthFactor;
    const width = Math.max(...lines.map((line) => textWidth(line, textHeight, factor)));
    const height = textHeight * lines.length;
    const rotation = node.type === 'text' ? node.rotation : 0;
    const alignment = node.type === 'text' ? node.alignment : 'left';
    const vertical = node.type === 'text' ? node.verticalAlignment : 'middle';
    const offsetX = alignment === 'left' ? width / 2 : alignment === 'right' ? -width / 2 : 0;
    const offsetY = vertical === 'top' ? -height / 2 : vertical === 'middle' ? 0 : vertical === 'baseline' ? height * 0.3 : height / 2;
    const angle = rotation * Math.PI / 180;
    const center = add(position, [offsetX * Math.cos(angle) - offsetY * Math.sin(angle), offsetX * Math.sin(angle) + offsetY * Math.cos(angle)]);
    // Reserve ink descent and a paper gap around plain text as well as dimensions.
    return [{ annotationId: String(node.id), textBounds: expanded(rotatedBounds(center, width, height, rotation), Math.max(0, style?.textGap ?? textHeight / 4) / 2) }];
  });
}

function pictureSegments(item: CadDimensionPlacement): Segment[] {
  return [
    // Witnesses intentionally traverse inner lanes. The DXF writer gaps them
    // around text; treating their whole path as a rigid obstacle makes a
    // nested chain impossible to place, however far the outer row moves.
    ...(item.line ? [[item.line.start, item.line.end]] as Segment[] : []),
    ...(item.arc ? arcSegments(item.arc) : []),
    ...(item.leader ? [[item.leader.start, item.leader.end]] as Segment[] : []),
  ];
}

function convexHull(points: Vec2[]): Vec2[] {
  const ordered = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (ordered.length < 3) return ordered;
  const cross = (a: Vec2, b: Vec2, c: Vec2) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const half = (values: Vec2[]) => { const result: Vec2[] = []; for (const point of values) { while (result.length >= 2 && cross(result.at(-2)!, result.at(-1)!, point) <= 0) result.pop(); result.push(point); } return result.slice(0, -1); };
  return [...half(ordered), ...half([...ordered].reverse())];
}

function outsideEnvelope(bounds: CadTextBounds, hull: Vec2[]): boolean {
  if (hull.length < 3) return !hull.some((point) => point[0] >= bounds.minX && point[0] <= bounds.maxX && point[1] >= bounds.minY && point[1] <= bounds.maxY);
  const center: Vec2 = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
  let inside = false;
  for (let index = 0; index < hull.length; index++) {
    const a = hull[index];
    const b = hull[(index + 1) % hull.length];
    if (segmentIntersectsBounds(a, b, bounds)) return false;
    if ((a[1] > center[1]) !== (b[1] > center[1]) && center[0] < (b[0] - a[0]) * (center[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return !inside;
}

function arcSegments(arc: NonNullable<CadDimensionPlacement['arc']>): Segment[] {
  const count = Math.max(8, Math.ceil(Math.abs(arc.sweep) / (Math.PI / 72)));
  return Array.from({ length: count }, (_, index) => [polar(arc.center, arc.radius, arc.startAngle + arc.sweep * index / count), polar(arc.center, arc.radius, arc.startAngle + arc.sweep * (index + 1) / count)]);
}

function dimensionStyle(node: DimensionAnnotation, profile: DxfExportProfile, styleName?: string): DxfDimensionStyle | undefined {
  const name = styleName ?? (node.dimensionKind === 'angular' ? 'GB_ANGULAR' : node.dimensionKind === 'diameter' || node.dimensionKind === 'radius' ? 'GB_RADIAL' : 'GB_LINEAR');
  return profile.dimensionStyles.find((style) => style.name === name) ?? profile.dimensionStyles[0];
}

function generatedDimensionText(node: DimensionAnnotation, style?: DxfDimensionStyle): string {
  const value = node.observedValue ?? node.computedValue;
  if (value === undefined || !Number.isFinite(value)) return node.displayText ?? '—';
  return `${node.prefix ?? (node.dimensionKind === 'diameter' ? '⌀' : node.dimensionKind === 'radius' ? 'R' : '')}${formatValue(value, node.dimensionKind === 'angular', style)}${node.suffix ?? (node.dimensionKind === 'angular' ? '°' : '')}`;
}

function numericDimensionText(node: DimensionAnnotation, style?: DxfDimensionStyle): string {
  const value = node.observedValue ?? node.computedValue;
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${node.prefix ?? ''}${formatValue(value, node.dimensionKind === 'angular', style)}${node.unit ? ` ${node.unit}` : ''}${node.suffix ?? ''}`;
}

function formatValue(value: number, angular: boolean, style?: DxfDimensionStyle): string {
  const decimals = angular ? style?.angularDecimalPlaces : style?.decimalPlaces;
  let result = decimals === undefined ? String(value) : value.toFixed(Math.max(0, Math.min(100, decimals)));
  const suppression = angular ? style?.angularZeroSuppression ?? 0 : style?.zeroSuppression ?? 0;
  if (result.includes('.') && (suppression & (angular ? 2 : 8))) result = result.replace(/\.?0+$/, '');
  if (Number(result) === 0) result = result.replace(/^-/, '');
  if (suppression & (angular ? 1 : 4)) result = result.replace(/^(-?)0\./, '$1.');
  return result;
}

function textWidth(content: string, height: number, factor: number): number {
  const plain = content.replace(/%%[cCdDpP]/g, '⌀').replace(/\\[A-Za-z][^;]*;/g, '').replace(/[{}]/g, '');
  return [...plain].reduce((sum, character) => sum + (character === ' ' ? 0.34 : '.,:;!|il'.includes(character) ? 0.3 : 'MW@'.includes(character) ? 0.85 : character.codePointAt(0)! > 255 ? 1 : 0.62) * height * factor, 0);
}

function geometryPoints(node: GeometryNode): Vec2[] {
  const segments = geometrySegments(node);
  if (segments.length) return segments.flatMap(([a, b]) => [a, b]);
  return node.type === 'point' ? [[node.x, node.y]] : node.type === 'ray' || node.type === 'xline' ? [node.origin] : [];
}

function geometrySegments(node: GeometryNode): Segment[] {
  if (node.type === 'line') return [[node.start, node.end]];
  if (node.type === 'polyline') return node.vertices.flatMap((vertex, index): Segment[] => {
    const next = node.vertices[index + 1] ?? (node.closed ? node.vertices[0] : undefined);
    return next ? [[vertex.point, next.point]] : [];
  });
  if (node.type === 'spline') return node.controlPoints.slice(1).map((point, index) => [node.controlPoints[index], point]);
  if (node.type === 'circle' || node.type === 'arc' || node.type === 'ellipse') {
    const start = node.type === 'arc' ? node.startAngle * Math.PI / 180 : node.type === 'ellipse' ? node.startParam ?? 0 : 0;
    const end = node.type === 'arc' ? node.endAngle * Math.PI / 180 : node.type === 'ellipse' ? node.endParam ?? Math.PI * 2 : Math.PI * 2;
    const ccw = node.type !== 'arc' || node.counterClockwise;
    const sweep = (positive(ccw ? end - start : start - end, Math.PI * 2) || Math.PI * 2) * (ccw ? 1 : -1);
    const count = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 36)));
    const point = (angle: number): Vec2 => node.type === 'ellipse'
      ? add(node.center, add(scale(node.majorAxis, Math.cos(angle)), scale(perpendicular(node.majorAxis), Math.sin(angle) * node.ratio)))
      : polar(node.center, node.radius, angle);
    return Array.from({ length: count }, (_, index) => [point(start + sweep * index / count), point(start + sweep * (index + 1) / count)]);
  }
  return [];
}

function rotatedBounds(position: Vec2, width: number, height: number, rotation: number): CadTextBounds {
  const angle = rotation * Math.PI / 180;
  const halfX = (Math.abs(Math.cos(angle)) * width + Math.abs(Math.sin(angle)) * height) / 2;
  const halfY = (Math.abs(Math.sin(angle)) * width + Math.abs(Math.cos(angle)) * height) / 2;
  return { minX: position[0] - halfX, maxX: position[0] + halfX, minY: position[1] - halfY, maxY: position[1] + halfY };
}
function expanded(bounds: CadTextBounds, padding: number): CadTextBounds { return { minX: bounds.minX - padding, minY: bounds.minY - padding, maxX: bounds.maxX + padding, maxY: bounds.maxY + padding }; }
function overlap(a: CadTextBounds, b: CadTextBounds): boolean { return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY; }
function segmentIntersectsBounds(a: Vec2, b: Vec2, bounds: CadTextBounds): boolean {
  let near = 0;
  let far = 1;
  for (const [origin, delta, min, max] of [[a[0], b[0] - a[0], bounds.minX, bounds.maxX], [a[1], b[1] - a[1], bounds.minY, bounds.maxY]]) {
    if (Math.abs(delta) < 1e-10) { if (origin < min || origin > max) return false; }
    else { const one = (min - origin) / delta; const two = (max - origin) / delta; near = Math.max(near, Math.min(one, two)); far = Math.min(far, Math.max(one, two)); if (near > far) return false; }
  }
  return true;
}
function sorted(nodes: DimensionAnnotation[]): DimensionAnnotation[] { return [...nodes].sort((a, b) => a.textPosition[0] - b.textPosition[0] || a.textPosition[1] - b.textPosition[1] || String(a.id).localeCompare(String(b.id))); }
function linearEndpoints(node: DimensionAnnotation): readonly [Vec2, Vec2] { return node.definitionPoints.length >= 4 ? [node.definitionPoints[2], node.definitionPoints[3]] : [node.definitionPoints[0], node.definitionPoints[1]]; }
function projectedExtent(points: Vec2[], axis: Vec2): { min: number; max: number } { const values = points.map((point) => dot(point, axis)); return { min: Math.min(...values), max: Math.max(...values) }; }
function angularSweep(a: number, b: number, degrees: number): number { const ccw = positive(b - a, Math.PI * 2); const cw = ccw - Math.PI * 2; const target = degrees * Math.PI / 180; return Math.abs(Math.abs(ccw) - target) <= Math.abs(Math.abs(cw) - target) ? ccw : cw; }
function readableAngle(angle: number): number { let value = positive(angle, 360); const quadrant = Math.round(value / 90) * 90; if (Math.abs(value - quadrant) < 0.01) value = positive(quadrant, 360); return value > 90 && value <= 270 ? value - 180 : value > 270 ? value - 360 : value; }
function canonicalDirection(value: Vec2): Vec2 { const result = normalized(value); return result[0] < -1e-8 || Math.abs(result[0]) < 1e-8 && result[1] < 0 ? scale(result, -1) : result; }
function normalized(value: Vec2): Vec2 { const length = Math.hypot(...value); return length > 1e-10 ? scale(value, 1 / length) : [1, 0]; }
function perpendicular(value: Vec2): Vec2 { return [-value[1], value[0]]; }
function positive(value: number, divisor: number): number { return ((value % divisor) + divisor) % divisor; }
function dot(a: Vec2, b: Vec2): number { return a[0] * b[0] + a[1] * b[1]; }
function add(a: Vec2, b: Vec2): Vec2 { return [a[0] + b[0], a[1] + b[1]]; }
function sub(a: Vec2, b: Vec2): Vec2 { return [a[0] - b[0], a[1] - b[1]]; }
function scale(a: Vec2, factor: number): Vec2 { return [a[0] * factor, a[1] * factor]; }
function midpoint(a: Vec2, b: Vec2): Vec2 { return scale(add(a, b), 0.5); }
function distance(a: Vec2, b: Vec2): number { return Math.hypot(...sub(b, a)); }
function polar(center: Vec2, radius: number, angle: number): Vec2 { return add(center, [Math.cos(angle) * radius, Math.sin(angle) * radius]); }
function signed(value: number): string { return value === 0 ? '0' : value > 0 ? `+${value}` : String(value); }
function unitMillimeters(unit: DrawingDocument['unitSystem']['length']): number { return { mm: 1, cm: 10, m: 1000, in: 25.4 }[unit]; }
