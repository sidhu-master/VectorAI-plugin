// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, DxfBlockGraphic, DxfExportEntity, DxfExportProfile, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { leaderPaths } from '@vectorai/drawing-core';
import { normalizeHatchRegion } from '@vectorai/drawing-hatch';
import type { EngineeringAnnotationDraft } from '@vectorai/plugin-space-contracts';

import type { CadDimensionPlacement, CadTextBounds } from './cad-dimension-layout';
import { encodeCaxaGdtSymbol, encodeCaxaText } from './gb-cad-profile';

export interface CadSymbolPlacement {
  kind: 'datum' | 'gdt' | 'surface-texture';
  ids: string[];
  geometryIds: string[];
  /** The authoritative controlled geometry anchor, even when a leader uses a dimension extension. */
  anchor: Vec2;
  position: Vec2;
  box: CadTextBounds;
  automatic: boolean;
  leader: Vec2[];
  rotation?: number;
  /** Surface glyph facing, separate from the readable text rotation. */
  facing?: 1 | -1;
  attachedToDimensionId?: string;
  attachedToGdtIds?: string[];
}

export interface CadEngineeringSymbolOptions {
  planConfirmed: boolean;
  /** Show unresolved candidates for inspection without changing their domain status. */
  includeCandidates?: boolean;
  caxaCompatible: boolean;
  dimensionPlacements?: readonly CadDimensionPlacement[];
}

interface SurfaceFootprint { segments: Array<readonly [Vec2, Vec2]>; textBounds: CadTextBounds; tip: Vec2; tangent?: Vec2; forward?: Vec2 }
interface SymbolResult { entity: DxfExportEntity; placement: CadSymbolPlacement; footprint?: SurfaceFootprint }
interface SymbolSpec {
  stored?: Vec2;
  candidates(): Vec2[];
  render(position: Vec2): SymbolResult;
  alternatives?: SymbolSpec[];
}
interface Context {
  h: number;
  arrow: number;
  layer: string;
  style: string;
  textFactor: number;
  surfaceTexture?: DxfExportProfile['surfaceTexture'];
  caxa: boolean;
  unresolvedValueLabel: string;
  bounds: CadTextBounds;
  obstacles: CadTextBounds[];
  dimensionLines: Array<readonly [Vec2, Vec2]>;
  contours: Array<readonly [Vec2, Vec2]>;
  materials: Vec2[][][];
  results: SymbolResult[];
}

/** Pure CAD projection: symbol ownership and target associations stay in the plan. */
export function projectCadEngineeringSymbols(
  plan: EngineeringAnnotationDraft,
  document: DrawingDocument,
  profile: DxfExportProfile,
  options: CadEngineeringSymbolOptions,
): { entities: DxfExportEntity[]; placements: CadSymbolPlacement[] } {
  const style = profile.dimensionStyles.find(({ name }) => name === 'GB_LINEAR') ?? profile.dimensionStyles[0];
  const unit = { mm: 1, cm: 10, m: 1000, in: 25.4 }[document.unitSystem.length];
  const h = (style?.textHeight ?? 3.5) * (style?.overallScale ?? 1) / unit;
  const textStyle = style?.textStyle ?? profile.textStyles[0]?.name ?? 'STANDARD';
  const geometry = new Map(document.geometry.filter(({ visible }) => visible).map((node) => [String(node.id), node]));
  const context: Context = {
    h, arrow: (style?.arrowSize ?? 3.5) * (style?.overallScale ?? 1) / unit,
    surfaceTexture: profile.surfaceTexture,
    layer: profile.semanticLayers.symbol, style: textStyle,
    textFactor: options.caxaCompatible ? 0.707 : profile.textStyles.find(({ name }) => name === textStyle)?.widthFactor ?? 1,
    caxa: options.caxaCompatible, unresolvedValueLabel: options.includeCandidates ? '—' : '待计算', bounds: geometryBounds([...geometry.values()]),
    obstacles: [
      ...(options.dimensionPlacements ?? []).map(({ textBounds }) => ({ ...textBounds })),
      ...document.annotations.flatMap((node): CadTextBounds[] => node.visible && node.type === 'text'
        ? [{ minX: node.position[0] - (node.alignment === 'left' ? 0 : textWidth(node.content, node.height, 1)),
          maxX: node.position[0] + (node.alignment === 'right' ? 0 : textWidth(node.content, node.height, 1)),
          minY: node.position[1] - node.height, maxY: node.position[1] + node.height }]
        : []),
      ...document.annotations.flatMap((node): CadTextBounds[] => {
        if (!node.visible || node.type !== 'leader') return [];
        const anchor = node.points[node.points.length - 1];
        const boxes: CadTextBounds[] = anchor ? [{ minX: anchor[0], maxX: anchor[0] + textWidth(node.content, node.textHeight, 1), minY: anchor[1] - node.textHeight / 2, maxY: anchor[1] + node.textHeight }] : [];
        if (node.callout && node.points[0]) {
          const [x, y] = node.points[0]; const r = node.callout.radius;
          boxes.push({ minX: x - r, maxX: x + r, minY: y - r, maxY: y + r });
        }
        return boxes;
      }),
    ],
    dimensionLines: [
      ...(options.dimensionPlacements ?? []).flatMap(({ line }) => line
        ? [[line.start, line.end] as const, [line.witnessA, line.start] as const, [line.witnessB, line.end] as const] : []),
      ...document.annotations.flatMap((node) => node.visible && node.type === 'leader'
        ? leaderPaths(node).flatMap((points) => points.slice(1).map((end, index) => [points[index], end] as const)) : []),
    ],
    contours: [...geometry.values()].flatMap(geometrySegments),
    materials: materialRegions(document, h),
    results: [],
  };
  const eligible = (status: string) => !['conflict', 'stale'].includes(status) && (status === 'confirmed' || options.planConfirmed || options.includeCandidates);
  const datums = plan.datums.filter(({ status }) => eligible(status)).flatMap((datum): SymbolSpec[] => {
    const anchor = resolveAnchor(geometry.get(String(datum.geometryId)), datum.anchor);
    if (!anchor) return [];
    const diameterCandidate = relatedDiameter(String(datum.geometryId), anchor, document, options.dimensionPlacements ?? []);
    // A diameter line may be moved far outside a crowded drawing. Keep the
    // semantic relationship, but do not move the datum's physical attachment
    // away from its actual feature surface with that layout decision.
    const diameter = diameterCandidate && distance(anchor, diameterCandidate.attachment) <= context.h * 8
      ? diameterCandidate
      : undefined;
    return [datumSpec(datum, anchor, diameter, context)];
  });
  const groups = new Map<string, EngineeringAnnotationDraft['geometricTolerances']>();
  for (const intent of plan.geometricTolerances.filter(({ status }) => eligible(status))) {
    if (!intent.controlledTargets.length) continue;
    const key = `geometry:${targetKey(intent.controlledTargets)}:${intent.framePosition ? `manual:${JSON.stringify(intent.framePosition)}` : 'automatic'}`;
    groups.set(key, [...groups.get(key) ?? [], intent]);
  }
  const frames = [...groups.values()].flatMap((intents): SymbolSpec[] => {
    const targets = uniqueTargets(intents.flatMap(({ controlledTargets }) => controlledTargets));
    const anchors = targets.flatMap((target) => {
      const point = resolveAnchor(geometry.get(String(target.geometryId)), target.anchor);
      return point ? [{ geometryId: String(target.geometryId), point }] : [];
    });
    return anchors.length && anchors.length === targets.length ? [gdtSpec(intents, anchors, plan, context)] : [];
  });
  const textures = (plan.surfaceTextures ?? []).filter(({ status }) => eligible(status)).flatMap((intent): SymbolSpec[] => {
    const spec = intent.controlledTargets[0];
    const anchor = spec ? resolveAnchor(geometry.get(String(spec.geometryId)), spec.anchor) : null;
    return anchor ? [textureSpec(intent, anchor, geometry.get(String(spec.geometryId))!, context)] : [];
  });
  // Stored placements reserve their space before any automatic placement runs.
  const specs = [...datums, ...frames, ...textures];
  for (const spec of specs.filter(({ stored }) => stored !== undefined)) reserve(spec.render(spec.stored!), context);
  for (const spec of [...datums, ...frames, ...textures].filter(({ stored }) => stored === undefined)) {
    let candidates = [spec, ...spec.alternatives ?? []].flatMap((variant) => variant.candidates().map((position) => variant.render(position)));
    if (spec.alternatives) {
      const inside = candidates.filter(({ placement: { box } }) => {
        const envelope = sectionEnvelope((box.minX + box.maxX) / 2, context);
        return box.minX > context.bounds.minX && box.maxX < context.bounds.maxX && box.minY > envelope.minY && box.maxY < envelope.maxY;
      });
      if (inside.length) candidates = inside;
      candidates.sort((a, b) => distance(a.placement.anchor, a.placement.position) - distance(b.placement.anchor, b.placement.position));
    }
    const firstClear = candidates.find((candidate) => collisionScore(candidate, context) === 0);
    const best = firstClear ?? candidates.reduce((best, next) => collisionScore(next, context) < collisionScore(best, context) ? next : best);
    reserve(best, context);
  }
  return { entities: context.results.map(({ entity }) => entity), placements: context.results.map(({ placement }) => placement) };
}

function datumSpec(
  datum: EngineeringAnnotationDraft['datums'][number], anchor: Vec2,
  diameter: { id: string; attachment: Vec2; outward: Vec2 } | undefined, context: Context,
): SymbolSpec {
  const { h, layer } = context;
  // The configured arrow size is the altitude of the filled equilateral marker.
  const halfBase = context.arrow / Math.sqrt(3);
  const width = Math.max(h * 20 / 11, textWidth(datum.name, h, context.textFactor) + h * 0.8);
  const boxFor = (marker: Vec2): CadTextBounds => ({ minX: marker[0] - width / 2, maxX: marker[0] + width / 2, minY: marker[1] - h * 28 / 11, maxY: marker[1] - h * 8 / 11 });
  return {
    stored: datum.labelPosition && point(datum.labelPosition),
    candidates: () => {
      if (!diameter) return outsideCandidates(anchor, width, h * 28 / 11 + context.arrow, context, 'below').map((p): Vec2 => [p[0] + width / 2, p[1] - context.arrow]);
      const candidates: Vec2[] = [];
      const top = Math.min(diameter.attachment[1], context.bounds.minY) - h;
      for (const drop of [0, h, h * 2, h * 4, h * 6]) {
        for (const offset of [0, width / 2 + h, width + h, (width + h) * 2]) {
          candidates.push([diameter.attachment[0] + diameter.outward[0] * offset,
            top - context.arrow - drop]);
        }
      }
      return candidates;
    },
    render(marker) {
      const box = boxFor(marker);
      const tip: Vec2 = [marker[0], marker[1] + context.arrow];
      const start = diameter?.attachment ?? anchor;
      const leader: Vec2[] = [start, [start[0], tip[1]], tip];
      const picture: DxfBlockGraphic[] = [polyline(leader, context),
        polyline([marker, [marker[0], box.maxY]], context), rectangle(box, context),
        { type: 'solid-hatch', layer, color: color(context, 'fill'), boundary: [[marker[0] - halfBase, marker[1]], [marker[0] + halfBase, marker[1]], tip] },
        mtext(datum.name, [marker[0], (box.minY + box.maxY) / 2], context),
      ];
      return result({ kind: 'datum', ids: [datum.id], geometryIds: [String(datum.geometryId)], anchor, position: marker,
        box: { ...box, minX: Math.min(box.minX, marker[0] - halfBase), maxX: Math.max(box.maxX, marker[0] + halfBase), maxY: tip[1] }, automatic: datum.labelPosition === undefined, leader,
        ...(diameter ? { attachedToDimensionId: diameter.id } : {}) }, picture, context);
    },
  };
}

function gdtSpec(
  intents: EngineeringAnnotationDraft['geometricTolerances'], anchors: Array<{ geometryId: string; point: Vec2 }>,
  plan: EngineeringAnnotationDraft, context: Context,
): SymbolSpec {
  const { h } = context;
  const names = new Map(plan.datums.map(({ id, name }) => [id, name]));
  const rows = intents.map((intent) => {
    const value = intent.override?.value ?? (intent.computed.status === 'resolved' ? intent.computed.value : undefined);
    const zone = intent.toleranceZone;
    const valueText = value === undefined || !Number.isFinite(value) ? context.unresolvedValueLabel
      : `${zone.shape === 'diametrical' ? '%%C' : zone.shape === 'spherical' ? 'S%%C' : ''}${format(value)}${condition(zone.materialCondition)}${zone.projectedZoneLength === undefined ? '' : ` Ⓟ${format(zone.projectedZoneLength)}`}`;
    // The existing domain contract represents a common datum in one cell.
    // It has no separate primary/secondary/tertiary cell discriminator.
    const datumText = intent.datumReferenceFrame.map((ref) => `${names.get(ref.datumId) ?? '?'}${condition(ref.materialCondition)}`).join('-');
    return [gdtSymbol(intent.characteristic, context.caxa), valueText, ...(datumText ? [datumText] : [])];
  });
  const widths = Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, column) => column === 0 ? 1.6 * h
    : Math.max(1.6 * h, ...rows.map((row) => textWidth(row[column] ?? '', h, context.textFactor) + h * 0.8)));
  const width = widths.reduce((sum, value) => sum + value, 0);
  const rowHeight = 1.8 * h;
  const height = rowHeight * rows.length;
  const stored = intents[0].framePosition;
  const anchor = anchors[0].point;
  return {
    stored: stored && point(stored),
    candidates: () => outsideCandidates(anchor, width, height, context, anchor[1] >= (context.bounds.minY + context.bounds.maxY) / 2 ? 'above' : 'below'),
    render(position) {
      const box = { minX: position[0], maxX: position[0] + width, minY: position[1] - height, maxY: position[1] };
      const leaders = anchors.map(({ point: target }) => frameLeader(target, box, h));
      const picture: DxfBlockGraphic[] = leaders.flatMap((leader) => [polyline(leader, context), arrow(leader[0], leader[1], context)]);
      picture.push(rectangle(box, context));
      for (let row = 1; row < rows.length; row++) picture.push(polyline([[box.minX, box.maxY - row * rowHeight], [box.maxX, box.maxY - row * rowHeight]], context, 'frame'));
      let x = box.minX;
      widths.forEach((columnWidth, column) => {
        if (column > 0) picture.push(polyline([[x, box.minY], [x, box.maxY]], context, 'frame'));
        rows.forEach((row, rowIndex) => {
          if (row[column]) picture.push(mtext(row[column], [x + columnWidth / 2, box.maxY - rowHeight * (rowIndex + 0.5)], context, column === 0));
        });
        x += columnWidth;
      });
      return result({ kind: 'gdt', ids: intents.map(({ id }) => id), geometryIds: [...new Set(anchors.map(({ geometryId }) => geometryId))],
        anchor, position, box, automatic: stored === undefined, leader: leaders[0] }, picture, context);
    },
  };
}

function textureSpec(intent: EngineeringAnnotationDraft['surfaceTextures'][number], anchor: Vec2, target: GeometryNode, context: Context, facing?: 1 | -1, forward = false): SymbolSpec {
  if (facing === undefined) {
    // Preserve an automatic glyph's explicit facing when it becomes manually
    // positioned. Legacy manual markers have no facing and retain their +1.
    if (intent.labelPosition !== undefined) return textureSpec(intent, anchor, target, context, intent.labelFacing ?? 1);
    const canFace = context.surfaceTexture && intent.materialRemoval === 'required' && intent.labelPosition === undefined && target.type === 'line';
    const materialSide = canFace ? surfaceMaterialFacing(anchor, target, context) : undefined;
    const fallback = !!canFace && materialSide === undefined && context.materials.length > 0;
    const spec = textureSpec(intent, anchor, target, context, materialSide ?? 1, fallback);
    if (materialSide !== undefined) {
      const candidates = spec.candidates;
      const angle = readableSurfaceRotation(target) * Math.PI / 180;
      const outward: Vec2 = [-Math.sin(angle) * materialSide, Math.cos(angle) * materialSide];
      spec.candidates = () => {
        const all = candidates();
        const outside = all.filter((position) => {
          const { box } = spec.render(position).placement;
          return ((box.minX + box.maxX) / 2 - anchor[0]) * outward[0] + ((box.minY + box.maxY) / 2 - anchor[1]) * outward[1] >= 0;
        });
        return outside.length ? outside : all;
      };
    }
    if (fallback) spec.alternatives = [textureSpec(intent, anchor, target, context, -1, true)];
    return spec;
  }
  const { h, layer } = context;
  const label = intent.parameter === 'Ra' ? format(intent.value) : `${intent.parameter} ${format(intent.value)}`;
  const geometryIds = intent.controlledTargets.map(({ geometryId }) => String(geometryId));
  const rotation = readableSurfaceRotation(target);
  const radians = rotation * Math.PI / 180;
  const rotate = ([x, y]: Vec2): Vec2 => [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)];
  const offset = (x: number, y: number): Vec2 => rotate([x * h / 11, -y * h / 11]);
  const paperStyle = intent.materialRemoval === 'required' ? context.surfaceTexture : undefined;
  // Preserve the established marker-to-tip offset, including manual markers.
  const tipLocal: Vec2 = intent.materialRemoval === 'required' ? [0, -2 * h / 11] : [0, 0];
  const glyphRotate = ([x, y]: Vec2): Vec2 => rotate([facing * x, tipLocal[1] + facing * (y - tipLocal[1])]);
  const shortRise = paperStyle ? paperStyle.shortRise * h : 0;
  const longRise = paperStyle ? paperStyle.longRise * h : 0;
  const slope = paperStyle ? Math.tan(paperStyle.includedAngle * Math.PI / 360) : 0;
  const outline: Vec2[] = paperStyle
    ? [[-shortRise * slope, tipLocal[1] + shortRise], tipLocal, [shortRise * slope, tipLocal[1] + shortRise], [longRise * slope, tipLocal[1] + longRise]].map((p) => glyphRotate(p as Vec2))
    : intent.materialRemoval === 'required'
    ? [offset(-12, -16), offset(0, 2), offset(12, -16), offset(26, -37)]
    : [offset(-9, -9), [0, 0], offset(18, -28)];
  if (intent.materialRemoval === 'prohibited') outline.push(...Array.from({ length: 24 }, (_, index) => offset(Math.cos(index * Math.PI / 12) * 4.5, Math.sin(index * Math.PI / 12) * 4.5)));
  const halfLabel = textWidth(label, h, context.textFactor) / 2;
  const textLocal: Vec2 = [0, paperStyle ? tipLocal[1] + facing * (shortRise + paperStyle.textGap * h) : h * 23 / 11];
  const textOffset = rotate(textLocal);
  const textCorners = [-halfLabel, halfLabel].flatMap((x) => (paperStyle ? [0, facing * h] : [-h / 2, h / 2]).map((y) => rotate([x, textLocal[1] + y])));
  const boundsPoints = [...outline, ...textCorners];
  const bounds = { minX: Math.min(...boundsPoints.map(([x]) => x)), maxX: Math.max(...boundsPoints.map(([x]) => x)),
    minY: Math.min(...boundsPoints.map(([, y]) => y)), maxY: Math.max(...boundsPoints.map(([, y]) => y)) };
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const centerOffset: Vec2 = [(bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2];
  const tipOffset = rotate(tipLocal);
  const boxFor = (marker: Vec2): CadTextBounds => ({ minX: marker[0] + bounds.minX, maxX: marker[0] + bounds.maxX, minY: marker[1] + bounds.minY, maxY: marker[1] + bounds.maxY });
  const markerForCenter = (center: Vec2): Vec2 => [center[0] - centerOffset[0], center[1] - centerOffset[1]];
  const related = () => context.results.find(({ placement }) => placement.kind === 'gdt' && geometryIds.every((id) => placement.geometryIds.includes(id)))?.placement;
  return {
    stored: intent.labelPosition && point(intent.labelPosition),
    candidates: () => {
      const frame = rotation === 0 ? related() : undefined;
      const onFrame: Vec2[] = frame ? [frame.box.minX - bounds.minX, frame.box.maxX - bounds.maxX, frame.box.maxX, frame.box.minX]
        .map((x): Vec2 => [x, frame.box.maxY - tipOffset[1]]) : [];
      const tangent = target.type === 'line' ? direction(target.start, target.end) : [1, 0] as Vec2;
      const normal: Vec2 = [-tangent[1], tangent[0]];
      const surfaceSteps = [0, ...Array.from({ length: 64 }, (_, index) => [(index + 1) / 8, -(index + 1) / 8]).flat()];
      const onSurface: Vec2[] = target.type === 'line' ? surfaceSteps.map((step): Vec2 =>
        [anchor[0] + tangent[0] * step * h - tipOffset[0], anchor[1] + tangent[1] * step * h - tipOffset[1]]) : [];
      const local: Vec2[] = [];
      for (const spacing of [1, 1.5, 2]) {
        for (const side of [-1, 1]) {
          for (const along of [0, -1, 1]) {
            const offset = (Math.abs(normal[0]) * width / 2 + Math.abs(normal[1]) * height / 2 + h * 0.35) * spacing * side;
            const shift = along * (width / 2 + h);
            local.push(markerForCenter([anchor[0] + normal[0] * offset + tangent[0] * shift,
              anchor[1] + normal[1] * offset + tangent[1] * shift]));
          }
        }
      }
      const centerDistance = (marker: Vec2) => distance([marker[0] + centerOffset[0], marker[1] + centerOffset[1]], anchor);
      local.sort((a, b) => centerDistance(a) - centerDistance(b));
      const envelope = sectionEnvelope(anchor[0], context);
      const above = anchor[1] >= (envelope.minY + envelope.maxY) / 2;
      const exterior = above ? anchor[1] >= envelope.maxY - h : anchor[1] <= envelope.minY + h;
      const outside = outsideCandidates(anchor, width, height, context, above ? 'above' : 'below').map((p): Vec2 => [p[0] - bounds.minX, p[1] - bounds.maxY]);
      if (exterior) {
        // Contour direction is arbitrary; the occupied section determines which
        // normal leads outside. Keep an outer-surface callout on that side.
        return [...onFrame, ...[...onSurface, ...local].filter((marker) => {
          const center: Vec2 = [marker[0] + centerOffset[0], marker[1] + centerOffset[1]];
          const localEnvelope = sectionEnvelope(center[0], context);
          return above ? center[1] > Math.max(envelope.maxY, localEnvelope.maxY) + h : center[1] < Math.min(envelope.minY, localEnvelope.minY) - h;
        }), ...outside];
      }
      // A sloped opening's normal alone can miss a narrow bore. Sample the
      // neighboring open section intervals and fit the actual symbol bounds.
      const corridors: Vec2[] = [];
      const sectionXs = [...[0, -1, 1, -2, 2].map((shift) => anchor[0] + shift * (width / 2 + h)),
        ...context.obstacles.flatMap((box) => [box.minX - width / 2 - h * 0.2, box.maxX + width / 2 + h * 0.2])]
        .filter((x) => Math.abs(x - anchor[0]) <= (width + h) * 2);
      for (const x of new Set(sectionXs)) {
        const ys = sectionIntersections(x, context).sort((a, b) => a - b);
        for (let index = 1; index < ys.length; index++) {
          const low = ys[index - 1] + h * 0.2; const high = ys[index] - h * 0.2;
          if (high - low < height) continue;
          const centerY = Math.max(low + height / 2, Math.min(high - height / 2, anchor[1]));
          corridors.push(markerForCenter([x, centerY]));
        }
      }
      const inside = [...onSurface, ...local, ...corridors].filter((marker) => {
        const box = boxFor(marker);
        return box.minX > context.bounds.minX && box.maxX < context.bounds.maxX && box.minY > envelope.minY && box.maxY < envelope.maxY;
      }).sort((a, b) => {
        const middle = (envelope.minY + envelope.maxY) / 2;
        const inward = (marker: Vec2) => Math.abs(marker[1] + centerOffset[1] - middle) < Math.abs(anchor[1] - middle) ? 0 : 1;
        return inward(a) - inward(b) || centerDistance(a) - centerDistance(b);
      });
      return [...onFrame, ...inside, ...local, ...outside];
    },
    render(marker) {
      const local = (x: number, y: number): Vec2 => { const delta = offset(x, y); return [marker[0] + delta[0], marker[1] + delta[1]]; };
      const frame = intent.labelPosition === undefined && rotation === 0 ? related() : undefined;
      const onFrame = frame !== undefined && marker[0] >= frame.box.minX && marker[0] <= frame.box.maxX
        && Math.abs(marker[1] + tipOffset[1] - frame.box.maxY) < h / 100;
      const box = boxFor(marker);
      const tip: Vec2 = [marker[0] + tipOffset[0], marker[1] + tipOffset[1]];
      const leader: Vec2[] = onFrame ? [] : intent.labelPosition
        ? [anchor, [anchor[0], marker[1]], marker] : textureLeader(anchor, tip, box, context, forward ? rotate([0, facing]) : undefined);
      const picture: DxfBlockGraphic[] = leader.length ? [polyline(leader, context)] : [];
      const outlinePoints = outline.map(([x, y]): Vec2 => [marker[0] + x, marker[1] + y]);
      if (intent.materialRemoval === 'required') picture.push(polyline(outlinePoints.slice(0, 3), context, 'frame', true),
        { type: 'line', layer, color: color(context, 'frame'), start: outlinePoints[2], end: outlinePoints[3] });
      else picture.push(polyline([local(-9, -9), marker, local(18, -28)], context, 'frame'));
      if (intent.materialRemoval === 'prohibited') picture.push(polyline(Array.from({ length: 24 }, (_, index) => local(Math.cos(index * Math.PI / 12) * 4.5, Math.sin(index * Math.PI / 12) * 4.5)), context, 'frame', true));
      const text = mtext(label, [marker[0] + textOffset[0], marker[1] + textOffset[1]], context, false, rotation);
      if (paperStyle && text.type === 'mtext') text.alignment = facing === 1 ? 8 : 2;
      picture.push(text);
      const segments = picture.slice(leader.length ? 1 : 0).flatMap((graphic): Array<readonly [Vec2, Vec2]> => {
        if (graphic.type === 'line') return [[graphic.start, graphic.end]];
        if (graphic.type !== 'polyline') return [];
        return graphic.points.flatMap((start, index) => {
          const end = graphic.points[index + 1] ?? (graphic.closed ? graphic.points[0] : undefined);
          return end ? [[start, end] as const] : [];
        });
      });
      const textBounds = { minX: marker[0] + Math.min(...textCorners.map(([x]) => x)), maxX: marker[0] + Math.max(...textCorners.map(([x]) => x)),
        minY: marker[1] + Math.min(...textCorners.map(([, y]) => y)), maxY: marker[1] + Math.max(...textCorners.map(([, y]) => y)) };
      return result({ kind: 'surface-texture', ids: [intent.id], geometryIds, anchor, position: marker, box,
        automatic: intent.labelPosition === undefined, leader, rotation, facing, ...(onFrame ? { attachedToGdtIds: frame.ids } : {}) }, picture, context,
      { segments, textBounds, tip, ...(target.type === 'line' ? { tangent: direction(target.start, target.end) } : {}),
        ...(forward ? { forward: rotate([0, facing]) } : {}) });
    },
  };
}

function outsideCandidates(anchor: Vec2, width: number, height: number, context: Context, preferred: 'above' | 'below' = 'above'): Vec2[] {
  const { bounds, h } = context;
  const candidates: Vec2[] = [];
  for (let tier = 0; tier < 6; tier++) {
    for (const side of preferred === 'above' ? [1] : [-1]) {
      const y = side > 0 ? bounds.maxY + h * 2 + height + tier * (height + h * 2) : bounds.minY - h * 2 - tier * (height + h * 2);
      for (const shift of [0, -1, 1, -2, 2]) candidates.push([anchor[0] - width / 2 + shift * (width + h * 2), y]);
    }
  }
  return candidates;
}

function reserve(value: SymbolResult, context: Context): void { context.results.push(value); context.obstacles.push(value.placement.box); }
function collisionScore({ placement, footprint }: SymbolResult, context: Context): number {
  // An unmatched internal face has no reliable material-side inference. Its
  // paper glyph unfolds in front of the final incoming leader, never over it.
  if (footprint?.forward && placement.leader.length > 1) {
    const previous = [...placement.leader].reverse().find((p) => distance(p, footprint.tip) > 1e-8);
    if (previous && (footprint.tip[0] - previous[0]) * footprint.forward[0] + (footprint.tip[1] - previous[1]) * footprint.forward[1] < 1e-8) return 1000000;
  }
  if (footprint?.forward && footprint.segments.some((segment) => segment.some((p) => pointInMaterial(p, context.materials)))) return 100000;
  const box = expand(placement.box, context.h * 0.15);
  const attachedFrame = placement.attachedToGdtIds;
  const attachedBoxes = attachedFrame ? context.results.filter(({ placement: p }) => p.ids.some((id) => attachedFrame.includes(id))).map(({ placement: p }) => p.box) : [];
  const obstacles = context.obstacles.filter((obstacle) => !attachedBoxes.includes(obstacle));
  const boxHits = obstacles.filter((obstacle) => overlap(box, obstacle)).length;
  const dimensionHits = context.dimensionLines.filter(([a, b]) => {
    // A datum triangle may intentionally meet its associated extension endpoint.
    if (placement.attachedToDimensionId && (distance(a, placement.leader[0]) < 1e-9 || distance(b, placement.leader[0]) < 1e-9)) return false;
    return footprint ? crossesSurfaceFootprint(a, b, footprint, context.h * 0.15) : segmentCrosses(a, b, box);
  }).length;
  const leaderHits = placement.leader.slice(1).reduce((count, end, index) => count + obstacles.filter((obstacle) => segmentCrosses(placement.leader[index], end, expand(obstacle, context.h * 0.1))).length, 0);
  const contourHits = context.contours.filter(([a, b]) => footprint ? crossesSurfaceFootprint(a, b, footprint, context.h * 0.01) : segmentCrosses(a, b, box)).length;
  return boxHits * 100 + (dimensionHits + contourHits) * 10 + leaderHits
    + (footprint?.forward ? materialLeaderLength(placement.leader, context) * 10 / context.h : 0);
}

function relatedDiameter(geometryId: string, anchor: Vec2, document: DrawingDocument, placements: readonly CadDimensionPlacement[]): { id: string; attachment: Vec2; outward: Vec2 } | undefined {
  const ids = new Set(document.annotations.filter((node) => node.type === 'dimension' && node.visible && node.dimensionKind === 'diameter' && node.targets.some((target) => String(target.geometryId) === geometryId)).map(({ id }) => String(id)));
  return placements.filter((placement) => ids.has(placement.annotationId) && placement.line).map((placement) => {
    const line = placement.line!;
    // Both ends of a diameter refer to the same cylindrical feature. Prefer the
    // lower extension so a datum does not cross the diameter text from its upper witness.
    const lowerIsStart = line.start[1] <= line.end[1];
    const attachment = lowerIsStart ? line.start : line.end;
    return { id: placement.annotationId, attachment, outward: direction(lowerIsStart ? line.witnessA : line.witnessB, attachment),
      distance: Math.min(distance(anchor, line.witnessA), distance(anchor, line.witnessB)) };
  }).sort((a, b) => a.distance - b.distance)[0];
}

/** Local section extents distinguish a bore wall from the surrounding silhouette. */
function sectionEnvelope(x: number, context: Context): Pick<CadTextBounds, 'minY' | 'maxY'> {
  const ys = sectionIntersections(x, context);
  return ys.length > 1 ? { minY: Math.min(...ys), maxY: Math.max(...ys) } : context.bounds;
}
function sectionIntersections(x: number, context: Context): number[] {
  return context.contours.flatMap(([a, b]): number[] => {
    if (x < Math.min(a[0], b[0]) - 1e-7 || x > Math.max(a[0], b[0]) + 1e-7) return [];
    if (Math.abs(b[0] - a[0]) < 1e-7) return [a[1], b[1]];
    return [a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])];
  });
}

function materialRegions(document: DrawingDocument, h: number): Vec2[][][] {
  const regions = document.annotations.flatMap((node): Vec2[][][] => {
    if (!node.visible || node.type !== 'section-hatch' || !node.hatch) return [];
    const normalized = normalizeHatchRegion(node.hatch, h / 1000);
    return normalized.status === 'ok' ? [normalized.region.contours] : [];
  });
  if (regions.length) return regions;
  const contours = document.geometry.flatMap((node): Vec2[][] => node.visible && node.type === 'polyline' && node.closed
    ? [node.vertices.map(({ point }) => point)] : []);
  return contours.length ? [contours] : [];
}

function surfaceMaterialFacing(anchor: Vec2, target: GeometryNode, context: Context): 1 | -1 | undefined {
  if (target.type !== 'line' || !context.materials.length || !context.surfaceTexture) return undefined;
  const edges = context.materials.flat(1).flatMap((contour) => contour.map((start, index) => [start, contour[(index + 1) % contour.length]] as const));
  if (!edges.some(([a, b]) => segmentDistance(anchor, anchor, a, b) <= context.h / 100)) return undefined;
  const angle = readableSurfaceRotation(target) * Math.PI / 180;
  const normal: Vec2 = [-Math.sin(angle), Math.cos(angle)];
  const inside = (p: Vec2) => pointInMaterial(p, context.materials);
  const step = Math.min(context.h / 100, distance(target.start, target.end) / 100);
  for (const factor of [1, 2, 4, 8]) {
    const a = inside([anchor[0] + normal[0] * step * factor, anchor[1] + normal[1] * step * factor]);
    const b = inside([anchor[0] - normal[0] * step * factor, anchor[1] - normal[1] * step * factor]);
    if (a !== b) return a ? -1 : 1;
  }
  return undefined;
}

function pointInContour([x, y]: Vec2, contour: Vec2[]): boolean {
  let inside = false;
  for (let index = 0, previous = contour.length - 1; index < contour.length; previous = index++) {
    const a = contour[index]; const b = contour[previous];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

function pointInMaterial(point: Vec2, regions: Vec2[][][]): boolean {
  return regions.some((contours) => contours.reduce((count, contour) => count + Number(pointInContour(point, contour)), 0) % 2 === 1);
}

function materialLeaderLength(path: Vec2[], context: Context): number {
  return path.slice(1).reduce((total, end, index) => {
    const start = path[index];
    const occupied = [0.125, 0.375, 0.625, 0.875].filter((t) => pointInMaterial([start[0] + (end[0] - start[0]) * t, start[1] + (end[1] - start[1]) * t], context.materials)).length;
    return total + distance(start, end) * occupied / 4;
  }, 0);
}

function frameLeader(anchor: Vec2, box: CadTextBounds, h: number): Vec2[] {
  const below = box.maxY < anchor[1];
  const attachY = below ? box.maxY : box.minY;
  const x = Math.max(box.minX, Math.min(box.maxX, anchor[0]));
  const bendY = attachY + (below ? h : -h);
  return [anchor, [anchor[0], bendY], [x, bendY], [x, attachY]];
}
function textureLeader(anchor: Vec2, tip: Vec2, box: CadTextBounds, context: Context, forward?: Vec2): Vec2[] {
  let paths: Vec2[][] = [[anchor, [anchor[0], tip[1]], tip], [anchor, [tip[0], anchor[1]], tip], [anchor, tip],
    ...[box.minX - context.h * 0.2, box.maxX + context.h * 0.2].map((x): Vec2[] => [anchor, [x, anchor[1]], [x, tip[1]], tip])];
  if (forward) paths = paths.filter((path) => {
    const previous = [...path].reverse().find((p) => distance(p, tip) > 1e-8);
    return previous && (tip[0] - previous[0]) * forward[0] + (tip[1] - previous[1]) * forward[1] > 1e-8;
  });
  if (!paths.length && forward) paths = [[anchor, [tip[0] - forward[0] * context.h, tip[1] - forward[1] * context.h], tip]];
  const obstacles = [...context.obstacles.map((obstacle) => expand(obstacle, context.h * 0.1)), expand(box, -context.h * 0.01)];
  const hits = (path: Vec2[]) => path.slice(1).reduce((sum, end, index) => sum + obstacles.filter((obstacle) => segmentCrosses(path[index], end, obstacle)).length, 0)
    + (forward ? materialLeaderLength(path, context) / context.h : 0);
  return paths.reduce((best, next) => hits(next) < hits(best) ? next : best);
}
function result(placement: CadSymbolPlacement, picture: DxfBlockGraphic[], context: Context, footprint?: SurfaceFootprint): SymbolResult { return { placement, entity: { type: 'block-reference', layer: context.layer, picture }, ...(footprint ? { footprint } : {}) }; }
function polyline(points: Vec2[], context: Context, role: 'line' | 'frame' = 'line', closed = false): DxfBlockGraphic { return { type: 'polyline', layer: context.layer, color: color(context, role), points, ...(closed ? { closed } : {}) }; }
function rectangle(box: CadTextBounds, context: Context): DxfBlockGraphic { return polyline([[box.minX, box.minY], [box.maxX, box.minY], [box.maxX, box.maxY], [box.minX, box.maxY]], context, 'frame', true); }
function mtext(content: string, position: Vec2, context: Context, encoded = false, rotation?: number): DxfBlockGraphic { return { type: 'mtext', layer: context.layer, color: color(context, 'text'), position, content: context.caxa && !encoded ? encodeCaxaText(content) : content, height: context.h, style: context.style, alignment: 5, ...(rotation === undefined ? {} : { rotation }) }; }
function arrow(tip: Vec2, next: Vec2, context: Context): DxfBlockGraphic {
  const length = distance(tip, next) || 1;
  const d: Vec2 = [(next[0] - tip[0]) / length * context.arrow, (next[1] - tip[1]) / length * context.arrow];
  return { type: 'solid-hatch', layer: context.layer, color: color(context, 'fill'), boundary: [tip, [tip[0] + d[0] - d[1] / 6, tip[1] + d[1] + d[0] / 6], [tip[0] + d[0] + d[1] / 6, tip[1] + d[1] - d[0] / 6]] };
}
function color(context: Context, role: 'line' | 'frame' | 'fill' | 'text'): number | undefined { return context.caxa ? { line: 4, frame: 31, fill: 4, text: 3 }[role] : undefined; }
function condition(value: string | undefined): string { return value ? `(${value.toUpperCase()})` : ''; }
function gdtSymbol(characteristic: string, caxa: boolean): string {
  if (caxa) return encodeCaxaGdtSymbol(characteristic);
  return ({ straightness: '⏤', flatness: '⏥', circularity: '○', cylindricity: '⌭', 'profile-line': '⌒', 'profile-surface': '⌓', parallelism: '∥', perpendicularity: '⊥', angularity: '∠', position: '⌖', coaxiality: '◎', symmetry: '⌯', 'circular-runout': '↗', 'total-runout': '⌰' } as Record<string, string>)[characteristic] ?? characteristic;
}
function textWidth(content: string, h: number, factor: number): number { return [...content.replace(/%%[cC]/g, '⌀')].reduce((sum, char) => sum + (char.codePointAt(0)! > 255 ? 1 : char === '.' ? 0.3 : 0.62) * h * factor, 0); }
function targetKey(targets: readonly { geometryId: unknown }[]): string { return [...new Set(targets.map(({ geometryId }) => String(geometryId)))].sort().join('\u0000'); }
function uniqueTargets<T extends { geometryId: unknown; anchor?: unknown }>(targets: T[]): T[] { return [...new Map(targets.map((target) => [`${String(target.geometryId)}:${JSON.stringify(target.anchor)}`, target])).values()]; }

function resolveAnchor(node: GeometryNode | undefined, anchor: EngineeringAnnotationDraft['datums'][number]['anchor'] | undefined): Vec2 | null {
  if (!node || !anchor) return null;
  if (anchor.kind === 'nearest') return point(anchor.point);
  if (anchor.kind === 'center') return 'center' in node ? point(node.center) : node.type === 'point' ? [node.x, node.y] : null;
  if (anchor.kind === 'start' || anchor.kind === 'end') {
    const end = anchor.kind === 'end';
    if (node.type === 'line') return point(end ? node.end : node.start);
    if (node.type === 'polyline') return node.vertices.length ? point(node.vertices[end ? node.vertices.length - 1 : 0].point) : null;
    if (node.type === 'arc') return polar(node.center, node.radius, (end ? node.endAngle : node.startAngle) * Math.PI / 180);
  }
  if (anchor.kind === 'vertex' && node.type === 'polyline') return node.vertices[anchor.index] ? point(node.vertices[anchor.index].point) : null;
  if (anchor.kind === 'curve-parameter') {
    if (node.type === 'circle' || node.type === 'arc') return polar(node.center, node.radius, anchor.parameter);
    if (node.type === 'ellipse') return [node.center[0] + node.majorAxis[0] * Math.cos(anchor.parameter) - node.majorAxis[1] * node.ratio * Math.sin(anchor.parameter), node.center[1] + node.majorAxis[1] * Math.cos(anchor.parameter) + node.majorAxis[0] * node.ratio * Math.sin(anchor.parameter)];
    if (node.type === 'line') return [node.start[0] + (node.end[0] - node.start[0]) * anchor.parameter, node.start[1] + (node.end[1] - node.start[1]) * anchor.parameter];
  }
  return null;
}
function geometryBounds(geometry: GeometryNode[]): CadTextBounds {
  const points = geometry.flatMap((node): Vec2[] => {
    if (node.type === 'point') return [[node.x, node.y]];
    if (node.type === 'line') return [node.start, node.end];
    if (node.type === 'ray' || node.type === 'xline') return [node.origin];
    if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
    if (node.type === 'spline') return node.controlPoints;
    const dx = node.type === 'ellipse' ? Math.hypot(node.majorAxis[0], node.majorAxis[1] * node.ratio) : node.radius;
    const dy = node.type === 'ellipse' ? Math.hypot(node.majorAxis[1], node.majorAxis[0] * node.ratio) : node.radius;
    return [[node.center[0] - dx, node.center[1] - dy], [node.center[0] + dx, node.center[1] + dy]];
  });
  if (!points.length) points.push([0, 0]);
  return { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)) };
}
function geometrySegments(node: GeometryNode): Array<readonly [Vec2, Vec2]> {
  if (node.type === 'line') return [[node.start, node.end]];
  if (node.type === 'polyline') return node.vertices.flatMap((vertex, index) => {
    const next = node.vertices[index + 1] ?? (node.closed ? node.vertices[0] : undefined);
    return next ? [[vertex.point, next.point] as const] : [];
  });
  if (node.type === 'circle' || node.type === 'arc') {
    const start = node.type === 'circle' ? 0 : node.startAngle * Math.PI / 180;
    let sweep = node.type === 'circle' ? Math.PI * 2 : (node.endAngle - node.startAngle) * Math.PI / 180;
    if (node.type === 'arc') {
      if (node.counterClockwise && sweep < 0) sweep += Math.PI * 2;
      if (!node.counterClockwise && sweep > 0) sweep -= Math.PI * 2;
    }
    return Array.from({ length: 32 }, (_, index) => [polar(node.center, node.radius, start + sweep * index / 32), polar(node.center, node.radius, start + sweep * (index + 1) / 32)] as const);
  }
  return [];
}
function segmentCrosses(a: Vec2, b: Vec2, box: CadTextBounds): boolean {
  let min = 0; let max = 1;
  for (const [origin, delta, low, high] of [[a[0], b[0] - a[0], box.minX, box.maxX], [a[1], b[1] - a[1], box.minY, box.maxY]]) {
    if (Math.abs(delta) < 1e-10) { if (origin < low || origin > high) return false; }
    else { min = Math.max(min, Math.min((low - origin) / delta, (high - origin) / delta)); max = Math.min(max, Math.max((low - origin) / delta, (high - origin) / delta)); if (min > max) return false; }
  }
  return true;
}
function crossesSurfaceFootprint(a: Vec2, b: Vec2, footprint: SurfaceFootprint, clearance: number): boolean {
  if (segmentCrosses(a, b, expand(footprint.textBounds, clearance))) return true;
  const { tangent, tip } = footprint;
  const alongSurface = tangent && [a, b].every((p) => Math.abs((p[0] - tip[0]) * tangent[1] - (p[1] - tip[1]) * tangent[0]) <= clearance);
  return footprint.segments.some(([c, d]) => {
    // The two strokes meeting the tip may meet the controlled surface or its
    // collinear witness. Other strokes and text still participate in collisions.
    if (alongSurface && (distance(c, tip) < 1e-8 || distance(d, tip) < 1e-8)) return false;
    return segmentDistance(a, b, c, d) <= clearance;
  });
}
function segmentDistance(a: Vec2, b: Vec2, c: Vec2, d: Vec2): number {
  const ab: Vec2 = [b[0] - a[0], b[1] - a[1]]; const cd: Vec2 = [d[0] - c[0], d[1] - c[1]];
  const denominator = ab[0] * cd[1] - ab[1] * cd[0];
  if (Math.abs(denominator) > 1e-10) {
    const ac: Vec2 = [c[0] - a[0], c[1] - a[1]];
    const t = (ac[0] * cd[1] - ac[1] * cd[0]) / denominator;
    const u = (ac[0] * ab[1] - ac[1] * ab[0]) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return 0;
  }
  const toSegment = (p: Vec2, start: Vec2, end: Vec2) => {
    const dx = end[0] - start[0]; const dy = end[1] - start[1]; const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.max(0, Math.min(1, ((p[0] - start[0]) * dx + (p[1] - start[1]) * dy) / lengthSquared)) : 0;
    return distance(p, [start[0] + t * dx, start[1] + t * dy]);
  };
  return Math.min(toSegment(a, c, d), toSegment(b, c, d), toSegment(c, a, b), toSegment(d, a, b));
}
function overlap(a: CadTextBounds, b: CadTextBounds): boolean { return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY; }
function expand(b: CadTextBounds, p: number): CadTextBounds { return { minX: b.minX - p, maxX: b.maxX + p, minY: b.minY - p, maxY: b.maxY + p }; }
function point(value: readonly unknown[]): Vec2 { return [value[0] as number, value[1] as number]; }
function polar(center: Vec2, radius: number, angle: number): Vec2 { return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius]; }
function distance(a: Vec2, b: Vec2): number { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
function direction(a: Vec2, b: Vec2): Vec2 { const length = distance(a, b) || 1; return [(b[0] - a[0]) / length, (b[1] - a[1]) / length]; }
function readableSurfaceRotation(target: GeometryNode): number {
  if (target.type !== 'line') return 0;
  let angle = Math.atan2(target.end[1] - target.start[1], target.end[0] - target.start[0]) * 180 / Math.PI;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  // Imported near-orthogonal facets use an orthogonal paper direction within
  // two degrees; source geometry, anchors and measurements stay unchanged.
  const orthogonal = Math.round(angle / 90) * 90;
  if (Math.abs(angle - orthogonal) <= 2) angle = orthogonal;
  return angle === -90 ? 90 : angle;
}
function format(value: number): string { return Number(value.toFixed(6)).toString(); }
