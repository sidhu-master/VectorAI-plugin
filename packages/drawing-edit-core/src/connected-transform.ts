// SPDX-License-Identifier: Apache-2.0

import type { DrawingDocument, GeometryNode, Vec2 } from '@vectorai/drawing-core';
import type { Diagnostic, DrawingTransactionCommand } from '@vectorai/drawing-edit-protocol';

export interface ConnectedTransformPortAudit {
  connectorNodeId: string;
  endpointRole: 'start' | 'end';
  before: Vec2;
  after: Vec2;
  fixedAnchor: Vec2;
  originalAngle: number;
  transportedAngle: number;
  beforeConnectorLength: number;
  afterConnectorLength: number;
  stretchRatio: number;
  lengthChange: number;
}

export interface ConnectedTransformInterfaceMetrics {
  drawingDiagonal: number;
  portCount: number;
  maximumStretchRatio: number;
  maximumLengthIncrease: number;
  normalizedMaximumLengthIncrease: number;
  selectedDeformationCost: number;
  minimumDeformationCost: number;
  deformationCostRatio: number;
  selectedRotationDegrees: number;
  minimumDeformationRotationDegrees: number;
  beforeSignedArea?: number;
  afterSignedArea?: number;
  areaRetentionRatio?: number;
  orientationInverted?: boolean;
}

export interface ConnectedTransformAudit {
  carrierNodeId: string;
  carrierType: 'circle' | 'ellipse';
  beforeCenter: Vec2;
  targetCenter: Vec2;
  rotationDegrees: number;
  orientationMode: 'explicit-rotation' | 'minimum-deformation' | 'translated';
  contactTolerance: number;
  connectorNodeIds: string[];
  ports: ConnectedTransformPortAudit[];
  interfaceMetrics?: ConnectedTransformInterfaceMetrics;
}

export interface ConnectedTransformCompilation {
  commands: DrawingTransactionCommand[];
  diagnostics: Diagnostic[];
  audit: ConnectedTransformAudit;
}

export interface ConnectedCarrierCandidate {
  carrierNodeId: string;
  carrierType: 'circle' | 'ellipse';
  contactedOpenConnectorCount: number;
  contactedPortCount: number;
}

type Carrier = Extract<GeometryNode, { type: 'circle' | 'ellipse' }>;

export function findConnectedCarrierCandidates(document: DrawingDocument): ConnectedCarrierCandidate[] {
  const tolerance = drawingRelativeTolerance(document);
  return document.geometry.flatMap((node) => {
    if (node.type !== 'circle' && node.type !== 'ellipse') return [];
    const contacts = findCarrierContacts(document, node, tolerance);
    if (contacts.length === 0) return [];
    return [{
      carrierNodeId: String(node.id),
      carrierType: node.type,
      contactedOpenConnectorCount: new Set(contacts.map(({ node: connector }) => connector.id)).size,
      contactedPortCount: contacts.length,
    }];
  });
}

export function compileConnectedTransform(input: {
  document: DrawingDocument;
  carrierNodeId: string;
  targetCenter: Vec2;
  rotationDegrees?: number;
  contactTolerance?: number;
}): ConnectedTransformCompilation {
  const carrier = input.document.geometry.find((node) => node.id === input.carrierNodeId);
  if (!carrier) throw new Error('CONNECTED_TRANSFORM_CARRIER_NOT_FOUND');
  if (carrier.type !== 'circle' && carrier.type !== 'ellipse') {
    throw new Error('CONNECTED_TRANSFORM_CARRIER_NOT_CLOSED');
  }
  assertPoint(input.targetCenter, 'CONNECTED_TRANSFORM_TARGET_CENTER_INVALID');
  const extent = drawingExtent(input.document);
  const explicitRotation = input.rotationDegrees === undefined
    ? undefined
    : normalizedRotationDegrees(input.rotationDegrees);
  if (
    distance(carrier.center, input.targetCenter) <= Math.max(extent * 1e-9, 1e-9)
    && Math.abs(explicitRotation ?? 0) <= 1e-9
  ) throw new Error('CONNECTED_TRANSFORM_NO_EFFECT');
  const tolerance = input.contactTolerance ?? drawingRelativeTolerance(input.document);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error('CONNECTED_TRANSFORM_TOLERANCE_INVALID');
  }
  const contacts = findCarrierContacts(input.document, carrier, tolerance);
  const minimumRotation = contacts.length === 0 ? 0 : inferMinimumDeformationRotation({
    beforeCenter: carrier.center,
    targetCenter: input.targetCenter,
    contacts: contacts.map(({ endpoint, projected }) => ({
      projected,
      fixedAnchor: endpoint.fixedAnchor,
    })),
  });
  const rotationDegrees = explicitRotation ?? minimumRotation;
  const rotationRadians = rotationDegrees * Math.PI / 180;
  const ports = contacts.map(({ node, endpoint, projected }): ConnectedTransformPortAudit => {
    const after = transportCarrierPoint(carrier, projected, input.targetCenter, rotationRadians);
    const beforeLength = distance(projected, endpoint.fixedAnchor);
    const afterLength = distance(after, endpoint.fixedAnchor);
    return {
      connectorNodeId: String(node.id),
      endpointRole: endpoint.role,
      before: structuredClone(projected),
      after,
      fixedAnchor: structuredClone(endpoint.fixedAnchor),
      originalAngle: clean(angleOf(carrier.center, projected) * 180 / Math.PI),
      transportedAngle: clean(angleOf(input.targetCenter, after) * 180 / Math.PI),
      beforeConnectorLength: clean(beforeLength),
      afterConnectorLength: clean(afterLength),
      stretchRatio: clean(safeRatio(afterLength, beforeLength)),
      lengthChange: clean(afterLength - beforeLength),
    };
  }).sort((left, right) => (
    left.originalAngle - right.originalAngle
    || left.connectorNodeId.localeCompare(right.connectorNodeId)
    || left.endpointRole.localeCompare(right.endpointRole)
  ));
  const commands: DrawingTransactionCommand[] = [{
    type: 'node.update',
    id: String(carrier.id),
    changes: {
      center: structuredClone(input.targetCenter),
      ...(carrier.type === 'ellipse' && rotationDegrees !== 0
        ? { majorAxis: rotateVector(carrier.majorAxis, rotationRadians) }
        : {}),
    },
    expected: {
      center: structuredClone(carrier.center),
      ...(carrier.type === 'ellipse' && rotationDegrees !== 0
        ? { majorAxis: structuredClone(carrier.majorAxis) }
        : {}),
    },
  }, ...ports.map((port): DrawingTransactionCommand => ({
    type: 'node.update',
    id: port.connectorNodeId,
    changes: { [port.endpointRole]: structuredClone(port.after) },
    expected: {
      [port.endpointRole]: structuredClone(endpointValue(
        input.document, port.connectorNodeId, port.endpointRole,
      )),
    },
  }))];
  const metrics = ports.length === 0 ? undefined : interfaceMetrics({
    document: input.document,
    ports,
    carrier,
    targetCenter: input.targetCenter,
    selectedRotationDegrees: rotationDegrees,
    minimumDeformationRotationDegrees: minimumRotation,
  });
  return {
    commands,
    diagnostics: metrics ? interfaceDiagnostics(String(carrier.id), ports, metrics) : [],
    audit: {
      carrierNodeId: String(carrier.id),
      carrierType: carrier.type,
      beforeCenter: structuredClone(carrier.center),
      targetCenter: structuredClone(input.targetCenter),
      rotationDegrees: clean(rotationDegrees),
      orientationMode: explicitRotation !== undefined
        ? 'explicit-rotation'
        : ports.length > 0 ? 'minimum-deformation' : 'translated',
      contactTolerance: tolerance,
      connectorNodeIds: [...new Set(ports.map(({ connectorNodeId }) => connectorNodeId))],
      ports,
      ...(metrics ? { interfaceMetrics: metrics } : {}),
    },
  };
}

function findCarrierContacts(document: DrawingDocument, carrier: Carrier, tolerance: number) {
  return document.geometry.flatMap((node) => {
    if (node.id === carrier.id || node.type !== 'line') return [];
    return ([
      { role: 'start' as const, point: node.start, fixedAnchor: node.end },
      { role: 'end' as const, point: node.end, fixedAnchor: node.start },
    ]).flatMap((endpoint) => {
      const projected = closestPointOnCarrier(carrier, endpoint.point);
      return projected && distance(projected, endpoint.point) <= tolerance
        ? [{ node, endpoint, projected }]
        : [];
    });
  });
}

function closestPointOnCarrier(carrier: Carrier, point: Vec2): Vec2 | null {
  if (carrier.type === 'circle') {
    const delta: Vec2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
    const length = Math.hypot(...delta);
    if (length <= 1e-12) return null;
    return cleanPoint([
      carrier.center[0] + delta[0] * carrier.radius / length,
      carrier.center[1] + delta[1] * carrier.radius / length,
    ]);
  }
  const majorLength = Math.hypot(...carrier.majorAxis);
  if (majorLength <= 1e-12 || carrier.ratio <= 0) return null;
  const major: Vec2 = [carrier.majorAxis[0] / majorLength, carrier.majorAxis[1] / majorLength];
  const minor: Vec2 = [-major[1], major[0]];
  const delta: Vec2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
  const parameter = Math.atan2(
    dot(delta, minor) / (majorLength * carrier.ratio),
    dot(delta, major) / majorLength,
  );
  const minorAxis: Vec2 = [-carrier.majorAxis[1] * carrier.ratio, carrier.majorAxis[0] * carrier.ratio];
  return cleanPoint([
    carrier.center[0] + carrier.majorAxis[0] * Math.cos(parameter) + minorAxis[0] * Math.sin(parameter),
    carrier.center[1] + carrier.majorAxis[1] * Math.cos(parameter) + minorAxis[1] * Math.sin(parameter),
  ]);
}

function inferMinimumDeformationRotation(input: {
  beforeCenter: Vec2;
  targetCenter: Vec2;
  contacts: Array<{ projected: Vec2; fixedAnchor: Vec2 }>;
}): number {
  let dotSum = 0;
  let crossSum = 0;
  for (const contact of input.contacts) {
    const local: Vec2 = [
      contact.projected[0] - input.beforeCenter[0],
      contact.projected[1] - input.beforeCenter[1],
    ];
    const target: Vec2 = [
      contact.fixedAnchor[0] - input.targetCenter[0],
      contact.fixedAnchor[1] - input.targetCenter[1],
    ];
    dotSum += dot(local, target);
    crossSum += local[0] * target[1] - local[1] * target[0];
  }
  return Math.hypot(dotSum, crossSum) <= 1e-12
    ? 0
    : clean(Math.atan2(crossSum, dotSum) * 180 / Math.PI);
}

function interfaceMetrics(input: {
  document: DrawingDocument;
  ports: ConnectedTransformPortAudit[];
  carrier: Carrier;
  targetCenter: Vec2;
  selectedRotationDegrees: number;
  minimumDeformationRotationDegrees: number;
}): ConnectedTransformInterfaceMetrics {
  const drawingDiagonal = drawingExtent(input.document);
  const maximumStretchRatio = Math.max(...input.ports.map(({ stretchRatio }) => stretchRatio));
  const maximumLengthIncrease = Math.max(0, ...input.ports.map(({ lengthChange }) => lengthChange));
  const selectedDeformationCost = input.ports.reduce((sum, port) => sum + port.afterConnectorLength ** 2, 0);
  const referenceRadians = input.minimumDeformationRotationDegrees * Math.PI / 180;
  const minimumDeformationCost = input.ports.reduce((sum, port) => {
    const reference = transportCarrierPoint(input.carrier, port.before, input.targetCenter, referenceRadians);
    return sum + distance(reference, port.fixedAnchor) ** 2;
  }, 0);
  const result: ConnectedTransformInterfaceMetrics = {
    drawingDiagonal: clean(drawingDiagonal),
    portCount: input.ports.length,
    maximumStretchRatio: clean(maximumStretchRatio),
    maximumLengthIncrease: clean(maximumLengthIncrease),
    normalizedMaximumLengthIncrease: clean(maximumLengthIncrease / Math.max(drawingDiagonal, 1e-12)),
    selectedDeformationCost: clean(selectedDeformationCost),
    minimumDeformationCost: clean(minimumDeformationCost),
    deformationCostRatio: clean(safeRatio(selectedDeformationCost, minimumDeformationCost)),
    selectedRotationDegrees: clean(input.selectedRotationDegrees),
    minimumDeformationRotationDegrees: clean(input.minimumDeformationRotationDegrees),
  };
  if (input.ports.length === 2) {
    const before = signedArea([
      input.ports[0]!.fixedAnchor, input.ports[0]!.before,
      input.ports[1]!.before, input.ports[1]!.fixedAnchor,
    ]);
    const after = signedArea([
      input.ports[0]!.fixedAnchor, input.ports[0]!.after,
      input.ports[1]!.after, input.ports[1]!.fixedAnchor,
    ]);
    if (Math.abs(before) > Math.max(drawingDiagonal ** 2 * 1e-8, 1e-12)) {
      result.beforeSignedArea = clean(before);
      result.afterSignedArea = clean(after);
      result.areaRetentionRatio = clean(Math.abs(after / before));
      result.orientationInverted = Math.sign(after) !== Math.sign(before);
    }
  }
  return result;
}

function interfaceDiagnostics(
  carrierNodeId: string,
  ports: ConnectedTransformPortAudit[],
  metrics: ConnectedTransformInterfaceMetrics,
): Diagnostic[] {
  const nodeIds = [carrierNodeId, ...new Set(ports.map(({ connectorNodeId }) => connectorNodeId))];
  const facts = interfaceFacts(metrics);
  const diagnostics: Diagnostic[] = [];
  if (metrics.orientationInverted) diagnostics.push({
    code: 'CONNECTED_INTERFACE_ORIENTATION_INVERTED', severity: 'warning',
    message: 'The ordered connected interface changes orientation.',
    nodeIds,
    action: 'Choose another target pose or rebuild the connected boundary.',
    facts,
  });
  if (metrics.areaRetentionRatio !== undefined && metrics.areaRetentionRatio < 0.1) diagnostics.push({
    code: 'CONNECTED_INTERFACE_AREA_COLLAPSED', severity: 'warning',
    message: 'The connected interface area collapses below ten percent of its original area.',
    nodeIds,
    action: 'Inspect the interface pairing and use the minimum-deformation orientation.',
    facts,
  });
  if (metrics.maximumStretchRatio > 3 && metrics.normalizedMaximumLengthIncrease > 0.02) diagnostics.push({
    code: 'CONNECTED_INTERFACE_EXCESSIVE_STRETCH', severity: 'warning',
    message: 'At least one connected boundary is stretched excessively.',
    nodeIds,
    action: 'Move the target closer or rebuild the connected boundary.',
    facts,
  });
  if (metrics.deformationCostRatio >= 4) diagnostics.push({
    code: 'CONNECTED_TRANSFORM_NON_MINIMUM_ORIENTATION', severity: 'warning',
    message: 'The explicit orientation has much greater deformation cost than the minimum-deformation pose.',
    nodeIds,
    action: 'Use the measured minimum-deformation orientation or explicitly confirm the intended twist.',
    facts,
  });
  return diagnostics;
}

function interfaceFacts(metrics: ConnectedTransformInterfaceMetrics): Record<string, unknown> {
  return {
    portCount: metrics.portCount,
    maximumStretchRatio: metrics.maximumStretchRatio,
    maximumLengthIncrease: metrics.maximumLengthIncrease,
    normalizedMaximumLengthIncrease: metrics.normalizedMaximumLengthIncrease,
    selectedDeformationCost: metrics.selectedDeformationCost,
    minimumDeformationCost: metrics.minimumDeformationCost,
    deformationCostRatio: metrics.deformationCostRatio,
    selectedRotationDegrees: metrics.selectedRotationDegrees,
    minimumDeformationRotationDegrees: metrics.minimumDeformationRotationDegrees,
    ...(metrics.beforeSignedArea === undefined ? {} : { beforeSignedArea: metrics.beforeSignedArea }),
    ...(metrics.afterSignedArea === undefined ? {} : { afterSignedArea: metrics.afterSignedArea }),
    ...(metrics.areaRetentionRatio === undefined ? {} : { areaRetentionRatio: metrics.areaRetentionRatio }),
    ...(metrics.orientationInverted === undefined ? {} : { orientationInverted: metrics.orientationInverted }),
  };
}

function transportCarrierPoint(carrier: Carrier, point: Vec2, center: Vec2, radians: number): Vec2 {
  const local: Vec2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
  const rotated = rotateVector(local, radians);
  return cleanPoint([center[0] + rotated[0], center[1] + rotated[1]]);
}

function drawingRelativeTolerance(document: DrawingDocument): number {
  const diagonal = drawingExtent(document);
  return Math.max(diagonal * 0.0025, Number.EPSILON * Math.max(1, diagonal) * 64);
}

function drawingExtent(document: DrawingDocument): number {
  const points = document.geometry.flatMap(geometryExtentPoints);
  if (points.length === 0) return 0.01;
  return Math.hypot(
    Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y)),
  );
}

function geometryExtentPoints(node: GeometryNode): Vec2[] {
  if (node.type === 'point') return [[node.x, node.y]];
  if (node.type === 'line') return [node.start, node.end];
  if (node.type === 'ray' || node.type === 'xline') return [node.origin];
  if (node.type === 'circle' || node.type === 'arc') return [
    [node.center[0] - node.radius, node.center[1] - node.radius],
    [node.center[0] + node.radius, node.center[1] + node.radius],
  ];
  if (node.type === 'ellipse') {
    const radius = Math.hypot(...node.majorAxis);
    return [[node.center[0] - radius, node.center[1] - radius], [node.center[0] + radius, node.center[1] + radius]];
  }
  if (node.type === 'polyline') return node.vertices.map(({ point }) => point);
  return node.controlPoints;
}

function endpointValue(document: DrawingDocument, nodeId: string, endpoint: 'start' | 'end'): Vec2 {
  const node = document.geometry.find((item) => item.id === nodeId);
  if (!node || node.type !== 'line') throw new Error('CONNECTED_TRANSFORM_CONNECTOR_STALE');
  return structuredClone(node[endpoint]);
}

function normalizedRotationDegrees(value: number): number {
  if (!Number.isFinite(value)) throw new Error('CONNECTED_TRANSFORM_ROTATION_INVALID');
  const normalized = ((value % 360) + 540) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function rotateVector(vector: Vec2, radians: number): Vec2 {
  return cleanPoint([
    vector[0] * Math.cos(radians) - vector[1] * Math.sin(radians),
    vector[0] * Math.sin(radians) + vector[1] * Math.cos(radians),
  ]);
}

function signedArea(points: Vec2[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]!;
    return sum + point[0] * next[1] - point[1] * next[0];
  }, 0) / 2;
}

function safeRatio(numerator: number, denominator: number): number {
  return Math.abs(denominator) > 1e-12
    ? numerator / denominator
    : Math.abs(numerator) <= 1e-12 ? 1 : Number.MAX_SAFE_INTEGER;
}

function angleOf(center: Vec2, point: Vec2): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function dot(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function cleanPoint(point: Vec2): Vec2 {
  return [clean(point[0]), clean(point[1])];
}

function clean(value: number): number {
  const rounded = Number(value.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function assertPoint(point: Vec2, code: string): void {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error(code);
}
