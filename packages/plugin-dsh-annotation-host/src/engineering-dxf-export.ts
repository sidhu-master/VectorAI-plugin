// SPDX-License-Identifier: Apache-2.0

import {
  exportDrawingDxf,
  type DrawingDocument,
  type DxfBlockGraphic,
  type DxfExportEntity,
  type DxfExportProfile,
  type GeometryNode,
  type Vec2,
} from '@vectorai/drawing-core';
import {
  allocateAxialDimensionLanes,
  type AxialDimensionScheme,
  type DimensionPlanSessionSnapshot,
  type EngineeringAnnotationDraft,
} from '@vectorai/plugin-space-contracts';

import { projectCadLinearDimension, type CadDimensionPresentation } from './cad-dimension-projector';
import { normalizeCadDxf } from './cad-dxf-normalizer';
import { cadAxialDimensionOffset } from './cad-paper-layout';
import { projectCadRadiusAnnotations } from './cad-radius-projector';
import {
  CAXA_COMPATIBLE_DXF_PROFILE,
  GB_ENGINEERING_DXF_PROFILE,
  caxaEncodedTextLength,
  encodeCaxaGdtSymbol,
  encodeCaxaText,
} from './gb-cad-profile';

export type EngineeringDxfProfile = 'generic-gb' | 'caxa-compatible';

export interface EngineeringDxfExportOptions {
  profile?: EngineeringDxfProfile | DxfExportProfile;
}

interface EngineeringCadPresentation {
  dimension: CadDimensionPresentation;
  layers: { dimension: string; omittedDimension: string; symbol: string };
  symbolColors: { line?: number; frame?: number; text?: number; fill?: number };
}

/** Compose the canonical drawing and the currently visible engineering plan. */
export function exportEngineeringDrawingDxf(
  document: DrawingDocument,
  plan: DimensionPlanSessionSnapshot,
  options: EngineeringDxfExportOptions = {},
): string {
  const profile = resolveExportProfile(options.profile);
  const caxaCompatible = options.profile === 'caxa-compatible';
  const presentation = resolveCadPresentation(profile, caxaCompatible);
  const cadProjection = projectCadRadiusAnnotations(document);
  const visible = plan.draft ?? plan.confirmed;
  if (!visible) return normalizeCadDxf(exportDrawingDxf(cadProjection.document, {
    profile,
    entities: cadProjection.entities,
  }));
  const entities: DxfExportEntity[] = [...cadProjection.entities];
  if (visible.axialScheme) entities.push(...dimensionChainEntities(visible.axialScheme, cadProjection.document, presentation));
  const planConfirmed = plan.confirmed !== undefined && visible === plan.confirmed;
  entities.push(...datumEntities(visible, cadProjection.document, planConfirmed, caxaCompatible, presentation));
  entities.push(...gdtEntities(visible, cadProjection.document, planConfirmed, caxaCompatible, presentation));
  return normalizeCadDxf(exportDrawingDxf(cadProjection.document, { profile, entities }));
}

function resolveExportProfile(profile: EngineeringDxfExportOptions['profile']): DxfExportProfile {
  if (profile === 'caxa-compatible') return CAXA_COMPATIBLE_DXF_PROFILE;
  if (profile === undefined || profile === 'generic-gb') return GB_ENGINEERING_DXF_PROFILE;
  return profile;
}

function resolveCadPresentation(profile: DxfExportProfile, caxaCompatible: boolean): EngineeringCadPresentation {
  const dimensionStyle = profile.dimensionStyles.find(({ name }) => name === 'GB_LINEAR') ?? profile.dimensionStyles[0];
  const textStyle = dimensionStyle?.textStyle ?? profile.textStyles[0]?.name ?? 'STANDARD';
  return {
    dimension: {
      dimensionStyle: 'GB_LINEAR',
      textStyle,
      textHeight: dimensionStyle?.textHeight ?? 2.5,
      arrowSize: dimensionStyle?.arrowSize ?? 2.5,
      lineColor: caxaCompatible ? 4 : undefined,
      textColor: caxaCompatible ? 3 : undefined,
    },
    layers: {
      dimension: profile.semanticLayers.dimension,
      omittedDimension: profile.semanticLayers.omittedDimension,
      symbol: profile.semanticLayers.symbol,
    },
    symbolColors: caxaCompatible
      ? { line: 4, frame: 31, text: 3, fill: 4 }
      : {},
  };
}

function dimensionChainEntities(scheme: AxialDimensionScheme, document: DrawingDocument, presentation: EngineeringCadPresentation): DxfExportEntity[] {
  const entities: DxfExportEntity[] = [];
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const stations = new Map(scheme.topology.stations.map((station) => [station.id, station.sourceCoordinate]));
  const memberships = dimensionMemberships(scheme);
  const chainOffsets = new Map(scheme.layout?.chainNormalOffsets.map((item) => [item.chainId, item.normalOffset]) ?? []);
  const candidateOffsets = new Map(scheme.layout?.candidateNormalOffsets.map((item) => [item.candidateId, item.normalOffset]) ?? []);
  const axis = scheme.topology.axis;
  const normal = normalized(axis.normal);
  const direction = normalized(axis.direction);
  const origin = asVec2(axis.origin);
  const radialDistance = radialDistanceFromAxis(document, origin, normal);
  const textHeight = presentation.dimension.textHeight;
  const visibleIds = [...new Set([...scheme.displayedCandidateIds, ...scheme.closureCandidateIds])];
  const closureIds = new Set(scheme.closureCandidateIds);
  const lanes = allocateAxialDimensionLanes(visibleIds.flatMap((candidateId) => {
    const candidate = candidates.get(candidateId);
    if (!candidate) return [];
    const start = stations.get(candidate.startStationId);
    const end = stations.get(candidate.endStationId);
    if (start === undefined || end === undefined) return [];
    return [{ id: candidateId, span: Math.abs(end - start), occupiedStart: start, occupiedEnd: end }];
  }));

  visibleIds.forEach((candidateId) => {
    const candidate = candidates.get(candidateId);
    if (!candidate) return;
    const start = stations.get(candidate.startStationId);
    const end = stations.get(candidate.endStationId);
    if (start === undefined || end === undefined) return;
    const membership = memberships.get(candidateId)?.[0];
    const groupOffset = membership ? chainOffsets.get(membership.chainId) ?? 0 : 0;
    const ownOffset = candidateOffsets.get(candidateId) ?? 0;
    const lane = lanes.get(candidateId) ?? 0;
    const offset = cadAxialDimensionOffset({
      radialDistance,
      lane,
      textHeight,
      chainOffset: groupOffset,
      candidateOffset: ownOffset,
    });
    const a = worldPoint(origin, direction, normal, start, offset);
    const b = worldPoint(origin, direction, normal, end, offset);
    const witnessA = worldPoint(origin, direction, normal, start, radialDistance + 1);
    const witnessB = worldPoint(origin, direction, normal, end, radialDistance + 1);
    const layer = closureIds.has(candidateId) ? presentation.layers.omittedDimension : presentation.layers.dimension;
    const textPosition = add(midpoint(a, b), scale(normal, textHeight * 1.6));
    entities.push(projectCadLinearDimension({
      layer,
      witnessA,
      witnessB,
      start: a,
      end: b,
      textPosition,
      text: format(candidate.nominalValue),
      measurement: Math.abs(end - start),
      presentation: presentation.dimension,
    }));
  });
  return entities;
}

function datumEntities(
  plan: EngineeringAnnotationDraft,
  document: DrawingDocument,
  planConfirmed: boolean,
  caxaCompatible: boolean,
  presentation: EngineeringCadPresentation,
): DxfExportEntity[] {
  const geometry = new Map(document.geometry.map((node) => [String(node.id), node]));
  const bounds = documentBounds(document);
  const height = presentation.dimension.textHeight;
  return plan.datums.flatMap((datum): DxfExportEntity[] => {
    if (datum.status !== 'confirmed' && !planConfirmed) return [];
    if (datum.status === 'conflict' || datum.status === 'stale') return [];
    const target = resolveAnchor(geometry.get(String(datum.geometryId)), datum.anchor);
    if (!target) return [];
    const marker = datum.labelPosition === undefined
      ? [target[0], bounds.minY - height * 7] as Vec2
      : asVec2(datum.labelPosition);
    const elbow: Vec2 = [target[0], marker[1] + height * 2.2];
    const half = height * 1.6;
    const boxTop = marker[1] + height * 2;
    const boxBottom = marker[1] - height * 2;
    const layer = presentation.layers.symbol;
    return [{ type: 'block-reference', layer, picture: [
      { type: 'polyline', layer, color: presentation.symbolColors.line, points: [target, elbow, [marker[0], elbow[1]], [marker[0], boxTop]] },
      { type: 'polyline', layer, color: presentation.symbolColors.frame, points: [[marker[0] - half, boxTop], [marker[0] + half, boxTop], [marker[0] + half, boxBottom], [marker[0] - half, boxBottom]], closed: true },
      { type: 'solid-hatch', layer, color: presentation.symbolColors.fill, boundary: [[marker[0] - half * 0.65, boxTop + height * 1.4], [marker[0] + half * 0.65, boxTop + height * 1.4], [marker[0], boxTop]] },
      { type: 'mtext', layer, color: presentation.symbolColors.text, position: marker, content: cadText(datum.name, caxaCompatible), height, style: presentation.dimension.textStyle, alignment: 5 },
    ] }];
  });
}

function gdtEntities(
  plan: EngineeringAnnotationDraft,
  document: DrawingDocument,
  planConfirmed: boolean,
  caxaCompatible: boolean,
  presentation: EngineeringCadPresentation,
): DxfExportEntity[] {
  const geometry = new Map(document.geometry.map((node) => [String(node.id), node]));
  const datumNames = new Map(plan.datums.map((datum) => [datum.id, datum.name]));
  const bounds = documentBounds(document);
  const height = presentation.dimension.textHeight;
  const rowHeight = height * 2.4;
  const eligible = plan.geometricTolerances.filter((intent) => (
    !['conflict', 'stale'].includes(intent.status)
      && (intent.status === 'confirmed' || planConfirmed)
  ));
  const groups = new Map<string, typeof eligible>();
  for (const intent of eligible) {
    const target = intent.controlledTargets[0];
    if (!target) continue;
    const key = intent.framePosition
      ? `frame:${intent.framePosition.map((value) => Number(value).toFixed(6)).join(':')}`
      : `target:${String(target.geometryId)}`;
    groups.set(key, [...(groups.get(key) ?? []), intent]);
  }
  return [...groups.values()].flatMap((intents, groupIndex): DxfExportEntity[] => {
    const first = intents[0];
    const targetSpec = first?.controlledTargets[0];
    const target = targetSpec ? resolveAnchor(geometry.get(String(targetSpec.geometryId)), targetSpec.anchor) : null;
    if (!first || !target) return [];
    const rows = intents.map((intent) => {
      const value = intent.override?.value
        ?? (intent.computed.status === 'resolved' ? intent.computed.value : undefined);
      return [
        cadGdtSymbol(intent.characteristic, caxaCompatible),
        value !== undefined && Number.isFinite(value)
          ? cadText(`${intent.toleranceZone.shape === 'diametrical' ? '%%C' : ''}${format(value)}`, caxaCompatible)
          : cadText('待计算', caxaCompatible),
        ...intent.datumReferenceFrame.map((reference) => cadText(`${datumNames.get(reference.datumId) ?? '?'}${reference.materialCondition ? `(${reference.materialCondition.toUpperCase()})` : ''}`, caxaCompatible)),
      ];
    });
    const columnCount = Math.max(...rows.map((row) => row.length));
    const widths = Array.from({ length: columnCount }, (_, column) => Math.max(
      height * (column === 0 ? 3.2 : 5.2),
      ...rows.map((row) => cadCellLength(row[column], caxaCompatible) * height * 0.8),
    ));
    const total = widths.reduce((sum, width) => sum + width, 0);
    const stored = intents.find(({ framePosition }) => framePosition !== undefined)?.framePosition;
    const below = stored !== undefined && stored[1] < target[1];
    const origin: Vec2 = stored === undefined
      ? [target[0] - total / 2, bounds.maxY + height * (8 + groupIndex * 4 + rows.length * 2.4)]
      : asVec2(stored);
    const frameBottom = origin[1] - rowHeight * rows.length;
    const attachX = Math.max(origin[0], Math.min(target[0], origin[0] + total));
    const attachY = below ? origin[1] : frameBottom;
    const leaderBendY = attachY + (below ? height * 2 : -height * 2);
    const leaderElbow: Vec2 = [target[0], leaderBendY];
    const layer = presentation.layers.symbol;
    const picture: DxfBlockGraphic[] = [
      { type: 'polyline', layer, color: presentation.symbolColors.line, points: [target, leaderElbow, [attachX, leaderBendY], [attachX, attachY]] },
      gdtArrow(layer, target, normalized(subtract(leaderElbow, target)), presentation.dimension.arrowSize, presentation.symbolColors.fill),
      { type: 'polyline', layer, color: presentation.symbolColors.frame, points: [origin, [origin[0] + total, origin[1]], [origin[0] + total, frameBottom], [origin[0], frameBottom]], closed: true },
    ];
    rows.slice(1).forEach((_, row) => picture.push({
      type: 'polyline', layer, color: presentation.symbolColors.frame,
      points: [[origin[0], origin[1] - rowHeight * (row + 1)], [origin[0] + total, origin[1] - rowHeight * (row + 1)]],
    }));
    let x = origin[0];
    widths.forEach((width, column) => {
      if (column > 0) picture.push({ type: 'polyline', layer, color: presentation.symbolColors.frame, points: [[x, origin[1]], [x, frameBottom]] });
      rows.forEach((row, rowIndex) => {
        const content = row[column];
        if (content) picture.push({
          type: 'mtext', layer,
          position: [x + width / 2, origin[1] - rowHeight * (rowIndex + 0.5)],
          content, height, style: presentation.dimension.textStyle, alignment: 5, color: presentation.symbolColors.text,
        });
      });
      x += width;
    });
    return [{ type: 'block-reference', layer, picture }];
  });
}

function gdtArrow(layer: string, tip: Vec2, direction: Vec2, size: number, color?: number): DxfBlockGraphic {
  const normal: Vec2 = [-direction[1], direction[0]];
  const base = add(tip, scale(direction, size));
  return {
    type: 'solid-hatch', layer, color,
    boundary: [tip, add(base, scale(normal, size / 6)), add(base, scale(normal, -size / 6))],
  };
}

function dimensionMemberships(scheme: AxialDimensionScheme): Map<string, Array<{ chainId: string }>> {
  const values = new Map<string, Array<{ chainId: string }>>();
  scheme.chains.forEach((chain) => {
    const ids = [chain.parentCandidateId, ...chain.childCandidateIds, chain.closureCandidateId];
    ids.forEach((id) => values.set(id, [...(values.get(id) ?? []), { chainId: chain.id }]));
  });
  return values;
}

function resolveAnchor(node: GeometryNode | undefined, anchor: EngineeringAnnotationDraft['datums'][number]['anchor']): Vec2 | null {
  if (anchor.kind === 'nearest') return [anchor.point[0], anchor.point[1]];
  if (!node) return null;
  if (anchor.kind === 'center') return 'center' in node ? node.center : node.type === 'point' ? [node.x, node.y] : null;
  if (anchor.kind === 'start') return node.type === 'line' ? node.start : node.type === 'polyline' ? node.vertices[0]?.point ?? null : null;
  if (anchor.kind === 'end') return node.type === 'line' ? node.end : node.type === 'polyline' ? node.vertices.at(-1)?.point ?? null : null;
  if (anchor.kind === 'vertex' && node.type === 'polyline') return node.vertices[anchor.index]?.point ?? null;
  return null;
}

function documentBounds(document: DrawingDocument) {
  const points = document.geometry.flatMap(geometryPoints);
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return {
    minX: Math.min(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)), maxY: Math.max(...points.map(([, y]) => y)),
  };
}

function geometryPoints(node: GeometryNode): Vec2[] {
  switch (node.type) {
    case 'point': return [[node.x, node.y]];
    case 'line': return [node.start, node.end];
    case 'ray': case 'xline': return [node.origin];
    case 'circle': case 'arc': return [[node.center[0] - node.radius, node.center[1] - node.radius], [node.center[0] + node.radius, node.center[1] + node.radius]];
    case 'ellipse': return [[node.center[0] - Math.abs(node.majorAxis[0]), node.center[1] - Math.abs(node.majorAxis[1])], [node.center[0] + Math.abs(node.majorAxis[0]), node.center[1] + Math.abs(node.majorAxis[1])]];
    case 'polyline': return node.vertices.map((vertex) => vertex.point);
    case 'spline': return node.controlPoints;
  }
}

function radialDistanceFromAxis(document: DrawingDocument, origin: Vec2, normal: Vec2): number {
  return Math.max(0, ...document.geometry.flatMap(geometryPoints).map((point) => Math.abs(dot(subtract(point, origin), normal))));
}

function worldPoint(origin: Vec2, direction: Vec2, normal: Vec2, coordinate: number, offset: number): Vec2 {
  return add(add(origin, scale(direction, coordinate)), scale(normal, offset));
}

function cadGdtSymbol(value: EngineeringAnnotationDraft['geometricTolerances'][number]['characteristic'], caxaCompatible: boolean): string {
  return caxaCompatible ? encodeCaxaGdtSymbol(value) : value.toUpperCase();
}

function cadText(value: string, caxaCompatible: boolean): string {
  return caxaCompatible ? encodeCaxaText(value) : value;
}

function cadCellLength(value: string | undefined, caxaCompatible: boolean): number {
  if (!value) return 0;
  return caxaCompatible ? caxaEncodedTextLength(value) : value.length;
}

function asVec2(value: unknown): Vec2 {
  if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number') return [0, 0];
  return [value[0], value[1]];
}
function normalized(value: unknown): Vec2 {
  const vector = asVec2(value);
  const length = Math.hypot(vector[0], vector[1]) || 1;
  return [vector[0] / length, vector[1] / length];
}
function add(a: Vec2, b: Vec2): Vec2 { return [a[0] + b[0], a[1] + b[1]]; }
function subtract(a: Vec2, b: Vec2): Vec2 { return [a[0] - b[0], a[1] - b[1]]; }
function scale(value: Vec2, factor: number): Vec2 { return [value[0] * factor, value[1] * factor]; }
function midpoint(a: Vec2, b: Vec2): Vec2 { return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
function dot(a: Vec2, b: Vec2): number { return a[0] * b[0] + a[1] * b[1]; }
function format(value: number): string { return Number(value.toFixed(6)).toString(); }
