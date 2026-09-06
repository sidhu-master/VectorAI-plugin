// SPDX-License-Identifier: Apache-2.0

import {
  type AnnotationNode,
  type DimensionAnnotation,
  type DrawingDocument,
  type DxfExportEntity,
  type DxfExportProfile,
  type DxfDimensionPresentation,
  type GeometryNode,
  type Vec2,
} from '@vectorai/drawing-core';
import {
  isAxialDimensionCandidateSuppressed,
  axialDimensionIntentId,
  projectEngineeringAnnotations,
  type EngineeringAnnotationDraft as DomainEngineeringAnnotationDraft,
} from '@vectorai/engineering-annotation';
import {
  allocateAxialDimensionLanes,
  type AxialDimensionScheme,
  type DimensionPlanSessionSnapshot,
} from '@vectorai/plugin-space-contracts';

import type { CadDimensionPresentation } from './cad-dimension-projector';
import { cadAxialDimensionOffset } from './cad-paper-layout';
import { projectCadDimensionLayout } from './cad-dimension-layout';
import { projectCadEngineeringSymbols } from './cad-symbol-layout';
import {
  CAXA_COMPATIBLE_DXF_PROFILE,
  GB_ENGINEERING_DXF_PROFILE,
} from './gb-cad-profile';

export type EngineeringDxfProfile = 'generic-gb' | 'caxa-compatible';

export interface EngineeringDxfExportOptions {
  profile?: EngineeringDxfProfile | DxfExportProfile;
  /** Canvas previews retain eligible draft candidates; export keeps its confirmation policy. */
  purpose?: 'export' | 'canvas';
  /** Internal viewport-fit projection override; rendered canvas/export normally use automatic scale. */
  annotationScale?: number;
}

interface EngineeringCadPresentation {
  dimension: CadDimensionPresentation;
  layers: { dimension: string; omittedDimension: string; symbol: string };
}

/** Pure paper scene shared by the engineering canvas and DXF exporter. */
export function projectEngineeringCadDrawing(
  document: DrawingDocument,
  plan: DimensionPlanSessionSnapshot,
  options: EngineeringDxfExportOptions = {},
) {
  const profile = annotationProfileForDrawing(resolveExportProfile(options.profile), document, options.annotationScale);
  const caxaCompatible = options.profile === 'caxa-compatible';
  const presentation = resolveCadPresentation(profile, caxaCompatible);
  const cadProjection = {
    document: caxaCompatible ? projectCaxaSemanticLayers(document, profile) : structuredClone(document),
    entities: [] as DxfExportEntity[],
  };
  const visible = plan.draft ?? plan.confirmed;
  if (!visible) {
    const paper = projectCadDimensionLayout(cadProjection.document, profile);
    return {
      document: paper.document, dimensionPlacements: paper.placements, symbolPlacements: [],
      profile, entities: cadProjection.entities,
      dimensionPresentation: dimensionPresentations(paper),
    };
  }
  const entities: DxfExportEntity[] = [...cadProjection.entities];
  const existingIntentIds = new Set(cadProjection.document.annotations.flatMap((node) => (
    node.type === 'dimension' && node.engineeringIntentId !== undefined ? [node.engineeringIntentId] : []
  )));
  const visibleAxialIntentIds = new Set(visible.axialScheme === undefined
    ? [] : visibleAxialCandidateIds(visible.axialScheme).map(axialDimensionIntentId));
  const projected = projectEngineeringAnnotations({
    draft: visible as unknown as DomainEngineeringAnnotationDraft,
    orderedIntentIds: visible.intents.map(({ id }) => id).filter((id) => existingIntentIds.has(id) || visibleAxialIntentIds.has(id)),
    existingAnnotations: cadProjection.document.annotations,
  }).annotations;
  const documentWithPortableTolerances = projectPlanTolerances(cadProjection.document, visible, projected);
  const chains = visible.axialScheme ? dimensionChainAnnotations(
    visible.axialScheme, cadProjection.document, presentation, projected,
  ) : undefined;
  if (chains) documentWithPortableTolerances.annotations.push(...chains.annotations);
  const paper = projectCadDimensionLayout(documentWithPortableTolerances, profile);
  if (chains) applyChainPaperOffsets(paper, chains.offsets);
  if (options.purpose !== 'canvas' && visible.axialScheme) {
    // Closure intervals aid editing and calculation but are not issued dimensions.
    // Remove them after shared layout so retained dimensions keep canvas positions.
    const closureIntents = new Set(visible.axialScheme.closureCandidateIds.map(axialDimensionIntentId));
    const omittedIds = new Set(paper.document.annotations.flatMap((node) =>
      node.type === 'dimension' && node.engineeringIntentId && closureIntents.has(node.engineeringIntentId) ? [String(node.id)] : []));
    paper.document.annotations = paper.document.annotations.filter((node) => !omittedIds.has(String(node.id)));
    paper.placements = paper.placements.filter(({ annotationId }) => !omittedIds.has(annotationId));
  }
  const planConfirmed = plan.confirmed !== undefined && visible === plan.confirmed;
  const includeCandidates = options.purpose === 'canvas' || visible === plan.draft;
  const symbols = projectCadEngineeringSymbols(visible, paper.document, profile, {
    planConfirmed, caxaCompatible, dimensionPlacements: paper.placements,
    includeCandidates,
  });
  entities.push(...symbols.entities);
  return {
    document: paper.document, dimensionPlacements: paper.placements, symbolPlacements: symbols.placements,
    profile, entities, dimensionPresentation: dimensionPresentations(paper),
  };
}

/** CAXA output uses the golden sample's semantic layers even when an imported
 * drawing used generic layer names. Preserve authored geometry and remove only
 * an automatically generated shaft axis that duplicates an imported one. */
function projectCaxaSemanticLayers(document: DrawingDocument, profile: DxfExportProfile): DrawingDocument {
  const projected = structuredClone(document);
  const importedCenterlineAnnotations = projected.annotations.filter((node): node is Extract<AnnotationNode, { type: 'centerline' }> => (
    node.type === 'centerline' && node.visible && node.sourceRef !== undefined
  ));
  const importedCenterlineGeometry = projected.geometry.filter((node): node is Extract<GeometryNode, { type: 'line' }> => (
    node.type === 'line' && node.visible && isCenterlineLayer(node.sourceRef?.layer)
  ));
  const importedCenterlines = [...importedCenterlineAnnotations, ...importedCenterlineGeometry];
  projected.geometry = projected.geometry.map((node) => node.type === 'line' && isCenterlineLayer(node.sourceRef?.layer)
    ? { ...node, sourceRef: { ...node.sourceRef!, layer: profile.semanticLayers.centerline } }
    : node);
  projected.annotations = projected.annotations
    .filter((node) => !(node.type === 'centerline'
      && node.sourceRef === undefined
      && String(node.id).startsWith('annotation_centerline_')
      && importedCenterlines.some((source) => duplicateCenterline(source, node))))
    .map((node) => {
      if (node.sourceRef === undefined) return node;
      if (node.type === 'centerline') {
        return { ...node, sourceRef: { ...node.sourceRef, layer: profile.semanticLayers.centerline } };
      }
      if (node.type === 'section-hatch') {
        return { ...node, sourceRef: { ...node.sourceRef, layer: profile.semanticLayers.sectionHatch } };
      }
      return node;
    });
  return projected;
}

function duplicateCenterline(
  source: { start: Vec2; end: Vec2; extension?: number },
  generated: Extract<AnnotationNode, { type: 'centerline' }>,
): boolean {
  const sourceSpan = extendedCenterline(source);
  const generatedSpan = extendedCenterline(generated);
  const sourceVector: Vec2 = [sourceSpan[1][0] - sourceSpan[0][0], sourceSpan[1][1] - sourceSpan[0][1]];
  const generatedVector: Vec2 = [generatedSpan[1][0] - generatedSpan[0][0], generatedSpan[1][1] - generatedSpan[0][1]];
  const sourceLength = Math.hypot(...sourceVector);
  const generatedLength = Math.hypot(...generatedVector);
  if (sourceLength <= 1e-9 || generatedLength <= 1e-9) return false;
  const direction: Vec2 = [sourceVector[0] / sourceLength, sourceVector[1] / sourceLength];
  const tolerance = Math.max(sourceLength, generatedLength) * 1e-6 + 1e-6;
  if (Math.abs(direction[0] * generatedVector[1] - direction[1] * generatedVector[0]) > tolerance) return false;
  const perpendicularDistance = (point: Vec2) => Math.abs(
    direction[0] * (point[1] - sourceSpan[0][1]) - direction[1] * (point[0] - sourceSpan[0][0]),
  );
  if (generatedSpan.some((point) => perpendicularDistance(point) > tolerance)) return false;
  const projection = (point: Vec2) => (
    (point[0] - sourceSpan[0][0]) * direction[0] + (point[1] - sourceSpan[0][1]) * direction[1]
  );
  const generatedRange = generatedSpan.map(projection).sort((left, right) => left - right);
  const overlap = Math.max(0, Math.min(sourceLength, generatedRange[1]!) - Math.max(0, generatedRange[0]!));
  return overlap >= Math.min(sourceLength, generatedLength) * 0.8;
}

function extendedCenterline(node: { start: Vec2; end: Vec2; extension?: number }): [Vec2, Vec2] {
  const dx = node.end[0] - node.start[0];
  const dy = node.end[1] - node.start[1];
  const length = Math.hypot(dx, dy);
  if (length <= 1e-9) return [node.start, node.end];
  const ux = dx / length;
  const uy = dy / length;
  const extension = node.extension ?? 0;
  return [
    [node.start[0] - ux * extension, node.start[1] - uy * extension],
    [node.end[0] + ux * extension, node.end[1] + uy * extension],
  ];
}

function isCenterlineLayer(layer: string | undefined): boolean {
  const normalized = layer?.trim().toUpperCase();
  return normalized === 'CENTERLINE' || normalized === 'CENTER' || layer === '中心线层' || layer === '3中心线层';
}

/** Keep CAD annotation furniture legible when a larger model is fitted to the same paper viewport. */
function annotationProfileForDrawing(profile: DxfExportProfile, document: DrawingDocument, requestedScale?: number): DxfExportProfile {
  const points = document.geometry.filter(({ visible }) => visible).flatMap((node): Vec2[] => {
    if (node.type === 'point') return [[node.x, node.y]];
    if (node.type === 'line') return [node.start, node.end];
    if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
    if (node.type === 'spline') return [...node.controlPoints];
    if (node.type === 'circle' || node.type === 'arc') return [
      [node.center[0] - node.radius, node.center[1] - node.radius],
      [node.center[0] + node.radius, node.center[1] + node.radius],
    ];
    if (node.type === 'ellipse') {
      const minor: Vec2 = [-node.majorAxis[1] * node.ratio, node.majorAxis[0] * node.ratio];
      const extent: Vec2 = [Math.hypot(node.majorAxis[0], minor[0]), Math.hypot(node.majorAxis[1], minor[1])];
      return [[node.center[0] - extent[0], node.center[1] - extent[1]], [node.center[0] + extent[0], node.center[1] + extent[1]]];
    }
    return [];
  });
  if (points.length < 2) return profile;
  const span = Math.max(
    Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)),
  );
  // 180 model units is the usable reference span that preserves the supplied
  // 173 mm sample at its native 3.5 mm lettering. Larger parts scale as one
  // coherent paper system, capped to avoid pathological/infinite geometry.
  const scaleFactor = requestedScale !== undefined && Number.isFinite(requestedScale) && requestedScale > 0
    ? requestedScale
    : Math.min(4, Math.max(1, span / 180));
  if (scaleFactor === 1) return profile;
  const scale = (value: number) => value * scaleFactor;
  return {
    ...profile,
    dimensionStyles: profile.dimensionStyles.map((style) => ({
      ...style,
      arrowSize: scale(style.arrowSize),
      originOffset: scale(style.originOffset),
      dimensionLineExtension: scale(style.dimensionLineExtension),
      extension: scale(style.extension),
      textHeight: scale(style.textHeight),
      textGap: scale(style.textGap),
    })),
  };
}

function dimensionPresentations(paper: ReturnType<typeof projectCadDimensionLayout>): Record<string, DxfDimensionPresentation> {
  const circles = new Set(paper.document.geometry.filter(({ type }) => type === 'circle').map(({ id }) => id));
  const nodes = new Map(paper.document.annotations.map((node) => [String(node.id), node]));
  const presentations: Record<string, DxfDimensionPresentation> = Object.fromEntries(paper.placements.map((placement) => {
    const node = nodes.get(placement.annotationId);
    const profileDiameter = node?.type === 'dimension' && node.dimensionKind === 'diameter'
      && node.definitionPoints.length >= 4 && !node.targets.some(({ geometryId }) => circles.has(geometryId));
    const gap = placement.footprint.textGap;
    return [placement.annotationId, {
      ...(profileDiameter ? { nativeKind: 'linear' as const } : {}),
      rotation: placement.rotation,
      arrowsOutside: placement.arrowsOutside,
      textGap: placement.textGapOverride,
      angularWitnesses: placement.arc?.witnesses,
      style: placement.footprint.dimensionStyle as 'GB_LINEAR' | 'GB_ANGULAR' | 'GB_RADIAL',
      leader: placement.leader,
      textBounds: {
        minX: placement.textBounds.minX - gap, minY: placement.textBounds.minY - gap,
        maxX: placement.textBounds.maxX + gap, maxY: placement.textBounds.maxY + gap,
      },
    }];
  }));
  for (const obstacle of paper.textObstacles) presentations[obstacle.annotationId] = { textBounds: obstacle.textBounds };
  return presentations;
}

/**
 * Project only the portable tolerance result onto dimensions that the Drawing
 * already owns. IDs, geometry, layout, source layers, visibility and every
 * unrelated annotation remain authoritative in the first-layer document.
 */
function projectPlanTolerances(
  document: DrawingDocument,
  plan: NonNullable<DimensionPlanSessionSnapshot['draft'] | DimensionPlanSessionSnapshot['confirmed']>,
  projected: readonly DimensionAnnotation[],
): DrawingDocument {
  const intentIds = new Set(plan.intents.map(({ id }) => id));
  const toleranceIntentIds = new Set(plan.tolerances.map(({ dimensionIntentId }) => dimensionIntentId));
  const hiddenIntentIds = new Set(plan.axialScheme?.hiddenCandidateIds?.map(axialDimensionIntentId) ?? []);
  const toleranceByIntentId = new Map(projected.map(({ engineeringIntentId, toleranceProjection }) => (
    [engineeringIntentId!, toleranceProjection] as const
  )));
  const annotations: AnnotationNode[] = document.annotations.map((node) => {
    if (node.type === 'dimension' && node.engineeringIntentId !== undefined && hiddenIntentIds.has(node.engineeringIntentId)) {
      return { ...node, visible: false };
    }
    if (node.type !== 'dimension' || node.engineeringIntentId === undefined || !intentIds.has(node.engineeringIntentId)) {
      return node;
    }
    const toleranceProjection = toleranceByIntentId.get(node.engineeringIntentId);
    if (toleranceProjection !== undefined) return { ...node, toleranceProjection };
    if (!toleranceIntentIds.has(node.engineeringIntentId)) return node;
    const next = { ...node };
    delete next.toleranceProjection;
    return next;
  });
  return { ...document, annotations };
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
  };
}

function dimensionChainAnnotations(
  scheme: AxialDimensionScheme,
  document: DrawingDocument,
  presentation: EngineeringCadPresentation,
  projected: readonly DimensionAnnotation[],
): { annotations: DimensionAnnotation[]; offsets: Map<string, Vec2> } {
  const annotations: DimensionAnnotation[] = [];
  const offsets = new Map<string, Vec2>();
  const projectedByIntentId = new Map(projected.map((node) => [node.engineeringIntentId, node]));
  const existingIntentIds = new Set(document.annotations.flatMap((node) => (
    node.type === 'dimension' && node.engineeringIntentId !== undefined ? [node.engineeringIntentId] : []
  )));
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
  const visibleIds = visibleAxialCandidateIds(scheme);
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
    const intentId = axialDimensionIntentId(candidateId);
    if (existingIntentIds.has(intentId)) return;
    const start = stations.get(candidate.startStationId);
    const end = stations.get(candidate.endStationId);
    if (start === undefined || end === undefined) return;
    const candidateMemberships = memberships.get(candidateId) ?? [];
    const membership = candidateMemberships.find(({ role }) => role === 'closure')
      ?? candidateMemberships.find(({ role }) => role === 'parent')
      ?? candidateMemberships[0];
    const groupOffset = membership ? chainOffsets.get(membership.chainId) ?? 0 : 0;
    const ownOffset = candidateOffsets.get(candidateId) ?? 0;
    const lane = lanes.get(candidateId) ?? 0;
    const offset = cadAxialDimensionOffset({
      radialDistance,
      lane,
      textHeight,
    });
    const a = worldPoint(origin, direction, normal, start, offset);
    const b = worldPoint(origin, direction, normal, end, offset);
    const witnessA = worldPoint(origin, direction, normal, start, radialDistance + 1);
    const witnessB = worldPoint(origin, direction, normal, end, radialDistance + 1);
    const layer = closureIds.has(candidateId) ? presentation.layers.omittedDimension : presentation.layers.dimension;
    const textPosition = add(midpoint(a, b), scale(normal, textHeight * 1.6));
    annotations.push({
      id: `annotation:cad-axial:${candidateId}` as DimensionAnnotation['id'],
      type: 'dimension', visible: true,
      quality: { status: 'confirmed', evidenceRefs: [] },
      dimensionKind: 'linear', associationStatus: 'resolved', targets: [],
      unit: scheme.topology.unit,
      ...projectedByIntentId.get(intentId),
      engineeringIntentId: intentId,
      sourceRef: { sourceId: 'engineering-cad-projection', layer },
      definitionPoints: [witnessA, witnessB, a, b],
      textPosition,
      displayText: format(candidate.nominalValue),
      layout: {
        mode: 'automatic',
        generatedText: format(Math.abs(end - start)),
      },
      computedValue: Math.abs(end - start),
    });
    if (groupOffset + ownOffset !== 0) offsets.set(String(annotations.at(-1)!.id), scale(normal, groupOffset + ownOffset));
  });
  return { annotations, offsets };
}

/**
 * Chain offsets are relative to the automatic paper placement. Apply them only
 * after laying out synthetic nodes, so the first drag cannot switch to the old
 * seed lane. Existing document-owned manual/legacy dimensions are never moved.
 * Keep controlled witnesses fixed while translating the dimension line/text.
 */
function applyChainPaperOffsets(paper: ReturnType<typeof projectCadDimensionLayout>, offsets: ReadonlyMap<string, Vec2>): void {
  if (offsets.size === 0) return;
  for (const node of paper.document.annotations) {
    const delta = offsets.get(String(node.id));
    if (!delta || node.type !== 'dimension') continue;
    node.definitionPoints = node.definitionPoints.map((point, index) => index < 2 ? point : add(point, delta));
    node.textPosition = add(node.textPosition, delta);
    node.layout = { ...node.layout, mode: 'manual' };
  }
  for (const placement of paper.placements) {
    const delta = offsets.get(placement.annotationId);
    if (!delta) continue;
    placement.automatic = false;
    placement.textPosition = add(placement.textPosition, delta);
    placement.textBounds = {
      minX: placement.textBounds.minX + delta[0], maxX: placement.textBounds.maxX + delta[0],
      minY: placement.textBounds.minY + delta[1], maxY: placement.textBounds.maxY + delta[1],
    };
    if (placement.line) placement.line = {
      ...placement.line, start: add(placement.line.start, delta), end: add(placement.line.end, delta),
    };
  }
}

function visibleAxialCandidateIds(scheme: AxialDimensionScheme): string[] {
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const hidden = new Set(scheme.hiddenCandidateIds ?? []);
  return [...new Set([
    ...scheme.displayedCandidateIds,
    ...scheme.closureCandidateIds.filter((id) => {
      const candidate = candidates.get(id);
      return candidate !== undefined && !isAxialDimensionCandidateSuppressed(candidate);
    }),
  ])].filter((id) => !hidden.has(id));
}

function dimensionMemberships(scheme: AxialDimensionScheme): Map<string, Array<{ chainId: string; role: 'parent' | 'child' | 'closure' }>> {
  const values = new Map<string, Array<{ chainId: string; role: 'parent' | 'child' | 'closure' }>>();
  scheme.chains.forEach((chain) => {
    const members = [
      { id: chain.parentCandidateId, role: 'parent' as const },
      ...chain.childCandidateIds.map((id) => ({ id, role: 'child' as const })),
      { id: chain.closureCandidateId, role: 'closure' as const },
    ];
    members.forEach(({ id, role }) => values.set(id, [...(values.get(id) ?? []), { chainId: chain.id, role }]));
  });
  return values;
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

export type EngineeringCadScene = ReturnType<typeof projectEngineeringCadDrawing>;
