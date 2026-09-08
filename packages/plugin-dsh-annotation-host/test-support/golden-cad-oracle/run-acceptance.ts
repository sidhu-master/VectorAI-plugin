// SPDX-License-Identifier: Apache-2.0
/** Independent production-path fixture runner. Intentionally never reads target.dxf or manifest.json. */
import { createHash } from 'node:crypto';
import { deepStrictEqual } from 'node:assert';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AnnotationNode, DimensionAnnotation, DimensionTarget, DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import { drawingWorkspaceSnapshotSchema, dimensionPlanSessionSnapshotSchema } from '@vectorai/plugin-space-contracts';
import {
  analyzeShaftPartition, buildAxialTopology, generateAxialDimensionCandidates,
  inferAxialDimensionScheme, inferRegularShaftRegions, parseEngineeringDocument,
  planEngineeringAnnotations, projectAxialDimensionScheme, SHAFT_HIERARCHICAL_DIMENSIONING_V1,
  validateEngineeringDraft, analyzeDimensionChain, orderDimensionIntents,
} from '@vectorai/engineering-annotation';
import { applyDrawingTransaction } from '../../../drawing-edit-core/src/document-transaction';
import type { DrawingTransactionCommand } from '../../../drawing-edit-protocol/src/index';
import { importDxf } from '../../../dxf-import/src/index';
import { DimensionPlanStore } from '../../src/dimension-plan-store';
import { exportEngineeringDrawingDxf, projectEngineeringCadDrawing } from '../../src/engineering-dxf-export';
import { GOLDEN_REQUIREMENTS as requirements } from './acceptance-requirements';

export function runGoldenAcceptance(outputDirectory: string) {
  mkdirSync(outputDirectory, { recursive: true });
  const fixture = resolve(import.meta.dirname, '../../../engineering-annotation/test/fixtures/golden-shaft-001');
  const bytes = readFileSync(resolve(fixture, 'initial.dxf'));
  const engineeringText = readFileSync(resolve(fixture, 'engineering-data.ini'), 'utf8');
  const sourceDigest = createHash('sha256').update(bytes).digest('hex');
  const imported = importDxf({ bytes, source: { digest: `sha256:${sourceDigest}`, name: 'initial.dxf' }, drawingId: 'golden-real-acceptance', now: () => 1 });
  if (imported.status !== 'imported') throw new Error('ACCEPTANCE_INITIAL_IMPORT_FAILED');
  let document = imported.document;
  const originalGeometry = JSON.stringify(document.geometry);
  const ref = { drawingId: document.id, revision: 1 };
  const commands: DrawingTransactionCommand[] = [];
  const evidence = [requirements.evidenceId];
  const limitations: string[] = [];
  const grounding: Array<Record<string, unknown>> = [];
  const quality = { status: 'confirmed' as const, confidence: 1, evidenceRefs: evidence as never };
  const lines = document.geometry.filter((n): n is Extract<GeometryNode, { type: 'line' }> => n.type === 'line');
  const contourLines = lines.filter(n => n.sourceRef?.layer === '1轮廓实线层');
  const verticals = contourLines.filter(n => Math.abs(n.start[0] - n.end[0]) < 1e-6);
  const minX = Math.min(...verticals.map(n => n.start[0]));
  const maxX = Math.max(...verticals.map(n => n.start[0]));
  const longBore = contourLines.filter(n => Math.abs(n.start[1] - n.end[1]) < 1e-6 && Math.abs(n.start[0] - n.end[0]) > (maxX - minX) * 0.8);
  const axisY = longBore.reduce((sum, n) => sum + n.start[1], 0) / longBore.length;
  if (!Number.isFinite(minX) || !Number.isFinite(axisY)) throw new Error('ACCEPTANCE_SOURCE_AXIS_NOT_GROUNDED');
  const center = (node: Extract<GeometryNode, { type: 'line' }>): Vec2 => [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
  const lineTarget = (station: number, radius: number, orientation: 'axial' | 'face' | 'slope'): DimensionTarget => {
    // Internal opening slopes are source geometry on layer 0. Layer names do
    // not identify engineering surfaces; bound the geometric search instead.
    const candidates = (orientation === 'slope' ? lines : contourLines).filter(n => {
      const dx = Math.abs(n.start[0] - n.end[0]), dy = Math.abs(n.start[1] - n.end[1]);
      return orientation === 'axial' ? dx > 0.01 && dy < 0.01 : orientation === 'face' ? dx < 0.01 && dy > 0.01
        : dx > 0.01 && dy > 0.01 && Math.abs(center(n)[0] - minX - station) < 3 && Math.abs(center(n)[1] - axisY - radius) < 3;
    }).map(node => ({ node, score: Math.hypot(center(node)[0] - minX - station, center(node)[1] - axisY - radius) })).sort((a, b) => a.score - b.score);
    if (!candidates[0]) throw new Error(`ACCEPTANCE_GROUNDING_FAILED:${station}:${radius}`);
    const selected = candidates[0].node;
    return { geometryId: selected.id, anchor: { kind: 'nearest', point: center(selected) } };
  };
  const features: Record<string, DimensionTarget> = {
    'left-bearing': lineTarget(8.5, 17.5, 'axial'), 'right-bearing': lineTarget(161.5, 17.5, 'axial'),
    'left-shoulder-face': lineTarget(45, 22, 'face'), 'right-shoulder-face': lineTarget(150, -21, 'face'),
    'left-roughness-shoulder': lineTarget(45, 22, 'face'), 'right-roughness-shoulder': lineTarget(150, 21, 'face'),
    'left-opening': lineTarget(2, -10.5, 'slope'), 'right-opening': lineTarget(171, 10.5, 'slope'),
    gear: lineTarget(105, 27.8, 'axial'), 'left-chamfer': lineTarget(45.5, 25, 'slope'),
    'gear-chamfer': lineTarget(147, 26, 'face'),
  };
  const leftBearingRelief = document.geometry.filter((n): n is Extract<GeometryNode, { type: 'arc' }> =>
    n.type === 'arc' && Math.abs(n.radius - 0.8) < 0.001 && n.center[1] > axisY)
    .sort((a, b) => Math.abs(a.center[0] - minX - 17) - Math.abs(b.center[0] - minX - 17))[0];
  if (!leftBearingRelief) throw new Error('ACCEPTANCE_LEFT_DETAIL_RELIEF_NOT_GROUNDED');
  features['left-bearing-relief'] = { geometryId: leftBearingRelief.id, anchor: { kind: 'center' } };
  const rightShoulderTransition = document.geometry.filter((n): n is Extract<GeometryNode, { type: 'arc' }> =>
    n.type === 'arc' && Math.abs(n.radius - 0.8) < 0.001 && n.center[1] > axisY)
    .sort((a, b) => Math.abs(a.center[0] - minX - 150) - Math.abs(b.center[0] - minX - 150))[0];
  if (!rightShoulderTransition) throw new Error('ACCEPTANCE_RIGHT_DETAIL_TRANSITION_NOT_GROUNDED');
  features['upper-right-shoulder-transition'] = { geometryId: rightShoulderTransition.id, anchor: { kind: 'center' } };
  for (const [id, target] of Object.entries(features)) grounding.push({ requirement: id, target, source: 'initial-dxf-intrinsic-feature-selection' });
  const automatic = planEngineeringAnnotations({ document, ref, objective: 'Apply explicit golden acceptance requirements', annotationKinds: ['opening-angle', 'diameter', 'centerline', 'radius'] });
  const annotations = automatic.annotations;
  const dimensional = annotations.filter((n): n is DimensionAnnotation => n.type === 'dimension');
  const semanticDimensions = new Map<string, DimensionAnnotation>();
  for (const requirement of requirements.dimensions) {
    if (requirement.kind !== 'diameter') continue;
    const candidates = dimensional.filter(n => n.dimensionKind === 'diameter').map(node => {
      const xs = node.definitionPoints.slice(0, 2).map(p => p[0] - minX);
      const station = xs.reduce((a, b) => a + b, 0) / xs.length;
      const centerStation = (requirement.interval[0] + requirement.interval[1]) / 2;
      return { node, score: Math.abs((node.computedValue ?? 0) - requirement.nominal) * 100 + Math.abs(station - centerStation) };
    }).sort((a, b) => a.score - b.score);
    const node = candidates[0]?.node;
    if (!node || Math.abs((node.computedValue ?? 0) - requirement.nominal) > 0.03) throw new Error(`ACCEPTANCE_DIMENSION_NOT_GROUNDED:${requirement.id}`);
    // The nominal display is the explicit drawing requirement; the measured
    // definition geometry is retained and independently checked by the oracle.
    node.displayText = `⌀${requirement.nominal}`;
    semanticDimensions.set(requirement.id, node);
    grounding.push({ requirement: requirement.id, annotationId: node.id, measured: node.computedValue, nominal: requirement.nominal, targets: node.targets });
  }
  const analyzed = analyzeShaftPartition({ document, drawingRef: ref, engineeringText, drawingSourceName: 'initial.dxf' });
  if (analyzed.status !== 'drafted') throw new Error('ACCEPTANCE_PARTITION_FAILED');
  const partition = inferRegularShaftRegions(analyzed.draft);
  const parsed = parseEngineeringDocument(engineeringText);
  const topology = buildAxialTopology({ document, partition, unit: parsed.drawing.unit ?? 'mm' });
  const candidateSet = generateAxialDimensionCandidates({ topology, partition, document: parsed,
    manualIntervals: requirements.axial.map(r => ({ start: r.interval[0], end: r.interval[1], label: `${requirements.evidenceId}:${r.id}` })),
  });
  const scheme = inferAxialDimensionScheme({ topology, candidateSet, policy: SHAFT_HIERARCHICAL_DIMENSIONING_V1 });
  let draft = projectAxialDimensionScheme({ scheme });
  const makeLinear = (id: string, nominal: number, targets: DimensionTarget[], points: [Vec2, Vec2], transverse = false) => {
    const dimensionLineA: Vec2 = transverse ? [Math.max(...points.map(p => p[0])) + 14, points[0][1]] : [points[0][0], Math.min(...points.map(p => p[1])) - 10];
    const dimensionLineB: Vec2 = transverse ? [dimensionLineA[0], points[1][1]] : [points[1][0], dimensionLineA[1]];
    const measured = Math.abs(points[1][transverse ? 1 : 0] - points[0][transverse ? 1 : 0]);
    const node: DimensionAnnotation = {
      id: `annotation:acceptance:${id}` as never, type: 'dimension', visible: true, quality,
      dimensionKind: 'linear', associationStatus: 'resolved', targets,
      computedValue: measured, displayText: `${nominal}`, unit: 'mm',
      definitionPoints: [...points, dimensionLineA, dimensionLineB],
      textPosition: [(dimensionLineA[0] + dimensionLineB[0]) / 2, (dimensionLineA[1] + dimensionLineB[1]) / 2],
      layout: { mode: 'automatic', generatedText: `${measured}` }, engineeringIntentId: `intent:acceptance:${id}`,
    };
    annotations.push(node); semanticDimensions.set(id, node);
    grounding.push({ requirement: id, targets, source: 'explicit-requirement-grounded-in-initial' });
    return node;
  };
  const gearEndpoints = contourLines.flatMap(node => [node.start, node.end].filter(p => p[0] - minX >= 92 - 0.001 && p[0] - minX <= 147 + 0.001).map(point => ({ node, point })));
  const upper = [...gearEndpoints].sort((a, b) => b.point[1] - a.point[1])[0];
  const lower = [...gearEndpoints].sort((a, b) => a.point[1] - b.point[1])[0];
  if (!upper || !lower) throw new Error('ACCEPTANCE_GEAR_ENVELOPE_NOT_GROUNDED');
  makeLinear('gear.outer-span', 57.03, [upper, lower].map(({ node, point }) => ({ geometryId: node.id, anchor: { kind: 'nearest', point } })), [upper.point, lower.point], true);
  for (const requirement of requirements.openingDepths) {
    const matched = requirement.interval.map(station => {
      const node = verticals.filter(n => Math.abs(n.start[0] - minX - station) < 0.002).sort((a, b) => Math.abs(center(a)[1] - axisY) - Math.abs(center(b)[1] - axisY))[0];
      if (!node) throw new Error(`ACCEPTANCE_OPENING_STATION_NOT_FOUND:${station}`);
      return { node, point: center(node) };
    });
    makeLinear(requirement.id, requirement.nominal, matched.map(({ node, point }) => ({ geometryId: node.id, anchor: { kind: 'nearest', point } })), matched.map(m => m.point) as [Vec2, Vec2]);
  }
  for (const annotation of annotations) {
    if (annotation.type === 'dimension' && annotation.dimensionKind === 'radius' && (annotation.computedValue ?? 99) < 1.1) annotation.visible = false;
    commands.push({ type: 'node.create', plane: 'annotation', node: { ...annotation } });
  }
  for (const relation of automatic.associations) commands.push({ type: 'node.create', plane: 'relation', node: { ...relation } });
  document = applyDrawingTransaction(document, commands, 2);
  for (const node of annotations) {
    if (node.type !== 'dimension' || !node.visible) continue;
    draft.intents.push({ id: node.engineeringIntentId!, drawingRef: ref, kind: node.dimensionKind, targets: node.targets,
      datumIds: [], nominalValue: node.computedValue!, unit: node.unit ?? 'mm', functionalRole: 'functional',
      source: 'manual', status: 'resolved', evidenceIds: evidence });
  }
  draft.datums = requirements.datums.map(r => ({ id: r.id, drawingRef: ref, name: r.name, geometryId: features[r.feature]!.geometryId,
    anchor: features[r.feature]!.anchor, role: r.role, source: 'manual', status: 'confirmed', evidenceIds: evidence, decisionAuthority: 'user-confirmed' }));
  draft.geometricTolerances = requirements.gdt.map((r, index) => ({
    id: `gdt:acceptance:${index}`, drawingRef: ref, characteristic: r.characteristic,
    controlledTargets: [features[r.feature]!], toleranceZone: { shape: 'linear' },
    datumReferenceFrame: r.commonDatum ? requirements.datums.map(d => ({ datumId: d.id })) : [],
    computed: { status: 'pending', unit: 'mm', diagnostics: [] }, source: 'manual', status: 'resolved', evidenceIds: evidence, decisionAuthority: 'user-confirmed',
  }));
  limitations.push('DatumReference has no common-datum type. The required A-B is recorded as the existing A/B reference array; semantic common-datum support remains unverified.');
  draft.surfaceTextures = requirements.roughness.map((r, index) => ({
    id: `texture:acceptance:${index}`, drawingRef: ref,
    controlledTargets: [features[r.feature === 'left-shoulder-face' ? 'left-roughness-shoulder' : r.feature === 'right-shoulder-face' ? 'right-roughness-shoulder' : r.feature]!],
    parameter: 'Ra', value: r.value, unit: 'um', materialRemoval: 'required', source: 'manual', status: 'confirmed', evidenceIds: evidence, decisionAuthority: 'user-confirmed',
  }));
  limitations.push('SurfaceTextureIntent requires a parameter. Ra is the existing mechanical drawing interpretation for the bare numeric roughness marks; the target DXF itself does not explicitly spell out Ra.');
  const store = new DimensionPlanStore(undefined, { now: () => 3, id: () => 'confirmed:acceptance' });
  store.begin('acceptance', ref); store.setDraft('acceptance', draft);
  for (const interval of requirements.omittedClosureIntervals) {
    const current = store.get('acceptance').draft!.axialScheme!;
    const stationValues = new Map(current.topology.stations.map(s => [s.id, s.coordinate]));
    const candidate = current.candidates.find(c => Math.abs(stationValues.get(c.startStationId)! - interval[0]) < 0.01 && Math.abs(stationValues.get(c.endStationId)! - interval[1]) < 0.01);
    const chain = candidate && current.chains.filter(c => {
      const parent = current.candidates.find(p => p.id === c.parentCandidateId)!;
      return stationValues.get(parent.startStationId)! <= interval[0] + 0.01 && stationValues.get(parent.endStationId)! >= interval[1] - 0.01
        && (c.closureCandidateId === candidate.id || c.childCandidateIds.includes(candidate.id) || c.alternativeClosureCandidateIds.includes(candidate.id));
    }).sort((a, b) => current.candidates.find(p => p.id === a.parentCandidateId)!.nominalValue - current.candidates.find(p => p.id === b.parentCandidateId)!.nominalValue)[0];
    if (!candidate || !chain) throw new Error(`ACCEPTANCE_EXPLICIT_CLOSURE_NOT_GROUNDED:${interval}`);
    if (chain.closureCandidateId !== candidate.id || chain.status !== 'resolved') store.editScheme('acceptance', { type: 'closure.choose', chainId: chain.id, candidateId: candidate.id, expectedDrawingRef: ref });
    grounding.push({ requirement: 'omitted-closure', interval, candidateId: candidate.id, command: 'closure.choose' });
  }
  for (const requirement of requirements.axial) {
    const current = store.get('acceptance').draft!.axialScheme!;
    const stations = new Map(current.topology.stations.map(s => [s.id, s.coordinate]));
    const candidate = current.candidates.find(c => Math.abs(stations.get(c.startStationId)! - requirement.interval[0]) < 0.01 && Math.abs(stations.get(c.endStationId)! - requirement.interval[1]) < 0.01);
    if (!candidate) throw new Error(`ACCEPTANCE_DISPLAY_REQUIREMENT_NOT_GROUNDED:${requirement.id}`);
    if (!current.displayedCandidateIds.includes(candidate.id)) store.editScheme('acceptance', { type: 'candidate.display', candidateId: candidate.id, displayed: true, expectedDrawingRef: ref });
    grounding.push({ requirement: requirement.id, candidateId: candidate.id, command: 'candidate.display' });
  }
  const explicitDisplayScheme = store.get('acceptance').draft!.axialScheme!;
  const explicitStations = new Map(explicitDisplayScheme.topology.stations.map(s => [s.id, s.coordinate]));
  const expectedDisplay = new Set(explicitDisplayScheme.candidates.filter(c => requirements.axial.some(r => Math.abs(explicitStations.get(c.startStationId)! - r.interval[0]) < 0.01 && Math.abs(explicitStations.get(c.endStationId)! - r.interval[1]) < 0.01)).map(c => c.id));
  for (const candidateId of [...explicitDisplayScheme.displayedCandidateIds, ...explicitDisplayScheme.closureCandidateIds]) {
    if (!expectedDisplay.has(candidateId)) store.editScheme('acceptance', { type: 'candidate.display', candidateId, displayed: false, expectedDrawingRef: ref });
  }
  for (const requirement of [...requirements.dimensions, ...requirements.axial]) {
    if (!('deviations' in requirement)) continue;
    const node = semanticDimensions.get(requirement.id);
    const axialIntent = node ? undefined : draft.intents.find(i => {
      if (i.kind !== 'linear' || Math.abs(i.nominalValue - requirement.nominal) > 0.01) return false;
      const points = i.targets.flatMap(t => t.anchor.kind === 'nearest' ? [t.anchor.point[0] - minX] : []).sort((a, b) => a - b);
      return points.length === 2 && points.every((p, index) => Math.abs(p - requirement.interval[index]!) < 0.01);
    });
    const intentId = node?.engineeringIntentId ?? axialIntent?.id;
    if (!intentId) throw new Error(`ACCEPTANCE_TOLERANCE_TARGET_NOT_FOUND:${requirement.id}`);
    if (!store.get('acceptance').draft!.intents.some(i => i.id === intentId)) {
      writeFileSync(resolve(outputDirectory, 'failed-requirement-state.json'), JSON.stringify({ requirement, intentId, state: store.get('acceptance') }, null, 2));
      throw new Error(`ACCEPTANCE_STATE_LOST_INTENT:${requirement.id}:${intentId}`);
    }
    store.editTolerance('acceptance', { type: 'manual.apply', dimensionIntentId: intentId, mode: 'bilateral', upperDeviation: requirement.deviations[0], lowerDeviation: requirement.deviations[1], displayPreference: 'deviations', evidenceRefs: evidence, expectedDrawingRef: ref }, undefined);
    grounding.push({ requirement: requirement.id, toleranceIntentId: intentId, deviations: requirement.deviations });
  }
  requirements.gdt.forEach((r, index) => store.editGeometricTolerance('acceptance', { type: 'override.set', intentId: `gdt:acceptance:${index}`, value: r.value, expectedDrawingRef: ref }));
  const beforeConfirmation = store.get('acceptance').draft!;
  writeFileSync(resolve(outputDirectory, 'preconfirmation-diagnostics.json'), JSON.stringify({
    validation: validateEngineeringDraft(beforeConfirmation as never),
    ordering: orderDimensionIntents({ intents: beforeConfirmation.intents as never, dependencies: beforeConfirmation.dependencies as never }),
    chains: beforeConfirmation.chains.map(chain => analyzeDimensionChain({ chain: chain as never, intents: beforeConfirmation.intents as never, tolerances: beforeConfirmation.tolerances as never })),
  }, null, 2));
  const plan = store.confirm('acceptance', ref);
  const extraCommands: DrawingTransactionCommand[] = [];
  const anchorPoint = (target: DimensionTarget): Vec2 => {
    if (target.anchor.kind === 'nearest') return target.anchor.point;
    const node = document.geometry.find(n => n.id === target.geometryId);
    if (target.anchor.kind === 'center' && node && 'center' in node) return node.center;
    throw new Error(`ACCEPTANCE_FEATURE_ANCHOR_NOT_RESOLVED:${target.geometryId}`);
  };
  for (const requirement of requirements.notes.filter(r => r.id !== 'spline-dual-radius1')) {
    const target = features[requirement.feature]!;
    const p = anchorPoint(target), label: Vec2 = [p[0] + 10, p[1] + 10];
    extraCommands.push({ type: 'node.create', plane: 'annotation', node: {
      id: `annotation:acceptance:note:${requirement.id}` as never, type: 'leader', visible: true, quality,
      target, points: [p, [label[0] - 2, label[1]], label], content: requirement.text, textHeight: 3.5,
      arrowhead: 'closed-filled',
    } });
  }
  const reliefArcs = document.geometry.filter((n): n is Extract<GeometryNode, { type: 'arc' }> => n.type === 'arc' && Math.abs(n.radius - 1) < 0.001 && n.center[0] - minX > 41 && n.center[0] - minX < 45 && n.center[1] > axisY).sort((a, b) => a.center[0] - b.center[0]);
  if (reliefArcs.length >= 2) {
    const tips = reliefArcs.slice(0, 2).map(arc => {
      const parameter = (arc.startAngle + arc.endAngle) / 2 * Math.PI / 180;
      return { target: { geometryId: arc.id, anchor: { kind: 'curve-parameter' as const, parameter } }, point: [arc.center[0] + arc.radius * Math.cos(parameter), arc.center[1] + arc.radius * Math.sin(parameter)] as Vec2 };
    });
    const elbow: Vec2 = [tips[0]!.point[0] - 3, axisY + 14], label: Vec2 = [elbow[0] - 8, elbow[1]];
    extraCommands.push({ type: 'node.create', plane: 'annotation', node: {
      id: 'annotation:acceptance:note:spline-dual-radius1' as never, type: 'leader', visible: true, quality,
      target: tips[0]!.target, points: [tips[0]!.point, elbow, label], content: 'R1', textHeight: 3.5,
      branches: [{ target: tips[1]!.target, points: [tips[1]!.point, elbow] }],
    } });
  } else limitations.push('Source grounding could not locate both upper R1 arcs.');
  for (const [index, requirement] of requirements.details.entries()) {
    const target = features[requirement.feature]!; const p = anchorPoint(target);
    extraCommands.push({ type: 'node.create', plane: 'annotation', node: {
      id: `annotation:acceptance:detail:${index}` as never, type: 'leader', visible: true, quality,
      target, points: [p, [p[0] + 8, p[1] + 8]], content: requirement.text, textHeight: 5,
      callout: { type: 'detail', radius: index === 0 ? 3.5 : 6 },
    } });
  }
  // Place references after the real feature notes/details have joined the
  // drawing, so their obstacles participate in the first reviewed scene.
  document = applyDrawingTransaction(document, extraCommands, 4);
  const scene = projectEngineeringCadDrawing(document, plan, { profile: 'caxa-compatible' });
  const referenceCommands: DrawingTransactionCommand[] = [];
  for (const [index, requirement] of requirements.referenceCallouts.entries()) {
    const originalNode = 'associatedDimension' in requirement ? semanticDimensions.get(requirement.associatedDimension) : undefined;
    const axialRequirement = 'associatedDimension' in requirement ? requirements.axial.find(r => r.id === requirement.associatedDimension) : undefined;
    const projectedNode = originalNode ? scene.document.annotations.find(n => n.id === originalNode.id) : axialRequirement
      ? scene.document.annotations.find(n => n.type === 'dimension' && n.dimensionKind === 'linear' && Math.abs((n.computedValue ?? 0) - axialRequirement.nominal) < 0.01)
      : undefined;
    const symbol = 'associatedFeature' in requirement ? scene.symbolPlacements.find(p => p.kind === 'gdt' && p.geometryIds.includes(String(features[requirement.associatedFeature]!.geometryId))) : undefined;
    const placement = scene.dimensionPlacements.find(p => p.annotationId === projectedNode?.id);
    const rotation = originalNode?.dimensionKind === 'diameter' || requirement.text === '[B]3' ? 90 : 0;
    const gap = placement?.footprint.textGap ?? scene.profile.dimensionStyles.find(s => s.name === 'GB_LINEAR')?.textGap ?? 1;
    let alignment: 'left' | 'right' = 'left';
    let p: Vec2;
    if (placement) {
      const b = placement.textBounds;
      p = rotation === 90 ? [(b.minX + b.maxX) / 2, b.maxY + gap] : [b.maxX + gap, (b.minY + b.maxY) / 2];
    } else if (symbol) {
      const towardLeft = symbol.anchor[0] < (symbol.box.minX + symbol.box.maxX) / 2;
      alignment = towardLeft ? 'right' : 'left';
      p = [towardLeft ? symbol.box.minX - gap : symbol.box.maxX + gap, (symbol.box.minY + symbol.box.maxY) / 2];
    } else throw new Error(`ACCEPTANCE_REFERENCE_NOT_GROUNDED:${requirement.text}`);
    grounding.push({ requirement: requirement.text, source: 'initial-reference-placement-from-real-paper-footprint',
      associatedAnnotationId: projectedNode?.id, associatedSymbolIds: symbol?.ids, position: p,
      limitation: 'TextAnnotation has no persistent dimension/GDT attachment; later automatic movement is not followed.' });
    referenceCommands.push({ type: 'node.create', plane: 'annotation', node: {
      id: `annotation:acceptance:reference:${index}` as never, type: 'text', visible: true, quality,
      content: requirement.text, position: p, height: 3.5, rotation, alignment, verticalAlignment: 'middle',
      sourceRef: { sourceId: requirements.evidenceId, layer: '1粗实线层' },
    } });
  }
  document = applyDrawingTransaction(document, referenceCommands, 5);
  limitations.push('Reference callouts use the actual paper footprint for initial placement, but plain text has no persistent dimension/GDT attachment. Later automatic relayout can detach them.');
  if (JSON.stringify(document.geometry) !== originalGeometry) throw new Error('ACCEPTANCE_SOURCE_GEOMETRY_WAS_CHANGED');
  const annotationStateBeforeRestore = JSON.stringify(document.annotations);
  const restored = drawingWorkspaceSnapshotSchema.parse(JSON.parse(JSON.stringify({ version: 1, ref, document,
    capabilities: { edit: true, delete: true, annotations: true, sourceUnderlay: true },
  })));
  document = restored.document as unknown as DrawingDocument;
  const restoredPlan = dimensionPlanSessionSnapshotSchema.parse(JSON.parse(JSON.stringify(plan)));
  deepStrictEqual(document.annotations, JSON.parse(annotationStateBeforeRestore), 'ACCEPTANCE_ANNOTATION_RESTORE_CHANGED');
  const finalScene = projectEngineeringCadDrawing(document, restoredPlan, { profile: 'caxa-compatible' });
  writeFileSync(resolve(outputDirectory, 'acceptance-paper-scene.json'), JSON.stringify({
    annotations: finalScene.document.annotations,
    dimensionPlacements: finalScene.dimensionPlacements, symbolPlacements: finalScene.symbolPlacements,
  }, null, 2));
  const output = resolve(outputDirectory, 'actual.dxf');
  writeFileSync(output, exportEngineeringDrawingDxf(document, restoredPlan, { profile: 'caxa-compatible' }));
  const report = { authority: requirements.authority, inputSourceDigest: sourceDigest, initialGeometryPreserved: true,
    requirements, grounding, limitations, plan: restoredPlan, strictJsonRestore: 'passed', commands: [...commands, ...extraCommands, ...referenceCommands],
    actualAnnotationCount: document.annotations.length, exportedTo: output };
  writeFileSync(resolve(outputDirectory, 'acceptance-input-and-grounding.json'), JSON.stringify(report, null, 2));
  writeFileSync(resolve(outputDirectory, 'acceptance-document.json'), JSON.stringify(document, null, 2));
  console.log(JSON.stringify({ actual: output, confirmed: plan.phase, explicitTolerances: plan.confirmed?.tolerances.length,
    gdtRows: plan.confirmed?.geometricTolerances.length, roughness: plan.confirmed?.surfaceTextures.length, initialGeometryPreserved: true, limitations }, null, 2));
  return { document, plan, output, report };
}

if (process.argv[1]?.endsWith('run-acceptance.ts')) {
  runGoldenAcceptance(resolve(process.argv[2] ?? '.local/dxf-export-review/real-acceptance'));
}
