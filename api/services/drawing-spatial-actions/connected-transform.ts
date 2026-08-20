import type {
  DrawingCommand,
  DrawingDocument,
  GeometryNode,
  Vec2,
} from '../../../src/drawing/index.js';
import { roughGeometryBounds } from '../drawing-spatial/geometry-sampling.js';
import type { DrawingDiagnostic } from '../drawing-diagnostics/types.js';

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

export interface ConnectedTransformCompilation {
  commands: DrawingCommand[];
  diagnostics: DrawingDiagnostic[];
  audit: {
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
  };
}

export interface ConnectedCarrierCandidate {
  carrierNodeId: string;
  carrierType: 'circle' | 'ellipse';
  contactedOpenConnectorCount: number;
  contactedPortCount: number;
}

/**
 * Projects a compact, revision-local capability index for the model. It contains no
 * semantic object labels: code only reports which closed carriers already have open
 * connector ports, while the model remains responsible for choosing the intended one.
 */
export function findConnectedCarrierCandidates(
  document: DrawingDocument,
): ConnectedCarrierCandidate[] {
  const tolerance = drawingRelativeTolerance(document);
  return document.geometry.flatMap((node) => {
    if (node.type !== 'circle' && node.type !== 'ellipse') return [];
    const contacts = findCarrierContacts(document, node, tolerance);
    if (contacts.length === 0) return [];
    return [{
      carrierNodeId: node.id as string,
      carrierType: node.type,
      contactedOpenConnectorCount: new Set(contacts.map(({ node: connector }) => connector.id)).size,
      contactedPortCount: contacts.length,
    }];
  });
}

/**
 * Moves one closed analytic carrier and transports every contacted open endpoint as
 * an ordered interface. The model chooses the carrier and target pose; this compiler
 * handles the coordinate math and leaves each connector's opposite anchor untouched.
 */
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
  const poseTolerance = Math.max(drawingExtent(input.document) * 1e-9, 1e-9);
  const explicitRotationMagnitude = input.rotationDegrees === undefined
    ? 0
    : Math.abs(normalizedRotationDegrees(input.rotationDegrees));
  if (
    distance(carrier.center, input.targetCenter) <= poseTolerance
    && explicitRotationMagnitude <= 1e-9
  ) {
    throw new Error('CONNECTED_TRANSFORM_NO_EFFECT');
  }
  const tolerance = input.contactTolerance ?? drawingRelativeTolerance(input.document);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error('CONNECTED_TRANSFORM_TOLERANCE_INVALID');
  }
  const connectorEndpoints = findCarrierContacts(input.document, carrier, tolerance);
  const minimumDeformationRotationDegrees = connectorEndpoints.length > 0
    ? inferMinimumDeformationRotation({
        beforeCenter: carrier.center,
        targetCenter: input.targetCenter,
        contacts: connectorEndpoints.map(({ endpoint, projected }) => ({
          projected,
          fixedAnchor: endpoint.fixedAnchor,
        })),
      })
    : 0;
  const orientationMode = input.rotationDegrees !== undefined
    ? 'explicit-rotation'
    : connectorEndpoints.length > 0
      ? 'minimum-deformation'
      : 'translated';
  const rotationDegrees = input.rotationDegrees ?? minimumDeformationRotationDegrees;
  if (!Number.isFinite(rotationDegrees)) throw new Error('CONNECTED_TRANSFORM_ROTATION_INVALID');
  const rotationRadians = rotationDegrees * Math.PI / 180;
  const ports = connectorEndpoints.map(({ node, endpoint, projected }) => {
    const after = transportCarrierPoint(
      carrier,
      projected,
      input.targetCenter,
      rotationRadians,
    );
    const beforeConnectorLength = distance(projected, endpoint.fixedAnchor);
    const afterConnectorLength = distance(after, endpoint.fixedAnchor);
    return {
      connectorNodeId: node.id as string,
      endpointRole: endpoint.role,
      before: structuredClone(projected),
      after,
      fixedAnchor: structuredClone(endpoint.fixedAnchor),
      originalAngle: clean(angleOf(carrier.center, projected) * 180 / Math.PI),
      transportedAngle: clean(angleOf(input.targetCenter, after) * 180 / Math.PI),
      beforeConnectorLength: clean(beforeConnectorLength),
      afterConnectorLength: clean(afterConnectorLength),
      stretchRatio: clean(safeRatio(afterConnectorLength, beforeConnectorLength)),
      lengthChange: clean(afterConnectorLength - beforeConnectorLength),
    } satisfies ConnectedTransformPortAudit;
  }).sort((left, right) => (
    left.originalAngle - right.originalAngle
      || left.connectorNodeId.localeCompare(right.connectorNodeId)
      || left.endpointRole.localeCompare(right.endpointRole)
  ));
  const commands: DrawingCommand[] = [
    {
      type: 'geometry.update', id: carrier.id,
      changes: {
        center: structuredClone(input.targetCenter),
        ...(carrier.type === 'ellipse' && rotationDegrees !== 0
          ? { majorAxis: rotateVector(carrier.majorAxis, rotationRadians) }
          : {}),
      },
      expected: { center: structuredClone(carrier.center) },
    },
    ...ports.map((port): DrawingCommand => ({
      type: 'geometry.update', id: port.connectorNodeId as GeometryNode['id'],
      changes: { [port.endpointRole]: structuredClone(port.after) },
      expected: { [port.endpointRole]: structuredClone(endpointValue(
        input.document,
        port.connectorNodeId,
        port.endpointRole,
      )) },
    })),
  ];
  const interfaceMetrics = connectorEndpoints.length > 0
    ? connectedInterfaceMetrics({
        document: input.document,
        ports,
        carrier,
        targetCenter: input.targetCenter,
        selectedRotationDegrees: rotationDegrees,
        minimumDeformationRotationDegrees,
      })
    : undefined;
  const diagnostics = interfaceMetrics
    ? connectedInterfaceDiagnostics(carrier.id, ports, interfaceMetrics)
    : [];
  return {
    commands,
    diagnostics,
    audit: {
      carrierNodeId: carrier.id,
      carrierType: carrier.type,
      beforeCenter: structuredClone(carrier.center),
      targetCenter: structuredClone(input.targetCenter),
      rotationDegrees: clean(rotationDegrees),
      orientationMode,
      contactTolerance: tolerance,
      connectorNodeIds: [...new Set(ports.map((port) => port.connectorNodeId))],
      ports,
      ...(interfaceMetrics ? { interfaceMetrics } : {}),
    },
  };
}

function connectedInterfaceMetrics(input: {
  document: DrawingDocument;
  ports: ConnectedTransformPortAudit[];
  carrier: Extract<GeometryNode, { type: 'circle' | 'ellipse' }>;
  targetCenter: Vec2;
  selectedRotationDegrees: number;
  minimumDeformationRotationDegrees: number;
}): ConnectedTransformInterfaceMetrics {
  const drawingDiagonal = drawingExtent(input.document);
  const maximumStretchRatio = Math.max(...input.ports.map((port) => port.stretchRatio));
  const maximumLengthIncrease = Math.max(
    0,
    ...input.ports.map((port) => port.afterConnectorLength - port.beforeConnectorLength),
  );
  const selectedDeformationCost = input.ports.reduce(
    (sum, port) => sum + port.afterConnectorLength ** 2,
    0,
  );
  const referenceRadians = input.minimumDeformationRotationDegrees * Math.PI / 180;
  const minimumDeformationCost = input.ports.reduce((sum, port) => {
    const reference = transportCarrierPoint(
      input.carrier,
      port.before,
      input.targetCenter,
      referenceRadians,
    );
    return sum + distance(reference, port.fixedAnchor) ** 2;
  }, 0);
  const metrics: ConnectedTransformInterfaceMetrics = {
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
    const beforeSignedArea = signedArea([
      input.ports[0].fixedAnchor,
      input.ports[0].before,
      input.ports[1].before,
      input.ports[1].fixedAnchor,
    ]);
    const afterSignedArea = signedArea([
      input.ports[0].fixedAnchor,
      input.ports[0].after,
      input.ports[1].after,
      input.ports[1].fixedAnchor,
    ]);
    const meaningfulArea = Math.abs(beforeSignedArea) > Math.max(drawingDiagonal ** 2 * 1e-8, 1e-12);
    if (meaningfulArea) {
      metrics.beforeSignedArea = clean(beforeSignedArea);
      metrics.afterSignedArea = clean(afterSignedArea);
      metrics.areaRetentionRatio = clean(Math.abs(afterSignedArea / beforeSignedArea));
      metrics.orientationInverted = Math.sign(afterSignedArea) !== Math.sign(beforeSignedArea);
    }
  }
  return metrics;
}

function connectedInterfaceDiagnostics(
  carrierNodeId: string,
  ports: ConnectedTransformPortAudit[],
  metrics: ConnectedTransformInterfaceMetrics,
): DrawingDiagnostic[] {
  const nodeIds = [carrierNodeId, ...new Set(ports.map((port) => port.connectorNodeId))];
  const diagnostics: DrawingDiagnostic[] = [];
  if (metrics.orientationInverted) {
    diagnostics.push(modelReviewDiagnostic(
      'CONNECTED_INTERFACE_ORIENTATION_INVERTED',
      '候选变换使有序连接接口发生了方向翻转',
      nodeIds,
      '重新选择目标姿态、旋转角度或完整重建连接轮廓；若翻转确属目标，请显式确认此诊断',
      interfaceFacts(metrics),
    ));
  }
  if (metrics.areaRetentionRatio !== undefined && metrics.areaRetentionRatio < 0.1) {
    diagnostics.push(modelReviewDiagnostic(
      'CONNECTED_INTERFACE_AREA_COLLAPSED',
      '候选变换使有序连接接口面积塌缩到原来的 10% 以下',
      nodeIds,
      '检查接口配对与旋转；可参考最小形变角度重新生成完整候选',
      interfaceFacts(metrics),
    ));
  }
  if (metrics.maximumStretchRatio > 3 && metrics.normalizedMaximumLengthIncrease > 0.02) {
    diagnostics.push(modelReviewDiagnostic(
      'CONNECTED_INTERFACE_EXCESSIVE_STRETCH',
      '候选变换使至少一个连接边界产生异常拉伸',
      nodeIds,
      '调整目标位置或姿态，或用完整 Drawing Transaction 重建连接轮廓',
      interfaceFacts(metrics),
    ));
  }
  if (metrics.deformationCostRatio >= 4) {
    diagnostics.push(modelReviewDiagnostic(
      'CONNECTED_TRANSFORM_NON_MINIMUM_ORIENTATION',
      '显式旋转的连接形变代价明显高于代码计算的最小形变参考',
      nodeIds,
      '比较 minimumDeformationRotationDegrees 后重新选择角度；若高形变是设计目标，请显式确认',
      interfaceFacts(metrics),
    ));
  }
  return diagnostics;
}

function modelReviewDiagnostic(
  code: string,
  message: string,
  nodeIds: string[],
  action: string,
  facts: Record<string, unknown>,
): DrawingDiagnostic {
  return {
    code,
    severity: 'warning',
    message,
    nodeIds,
    action,
    facts,
  };
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
    ...(metrics.areaRetentionRatio === undefined
      ? {}
      : { areaRetentionRatio: metrics.areaRetentionRatio }),
    ...(metrics.orientationInverted === undefined
      ? {}
      : { orientationInverted: metrics.orientationInverted }),
  };
}

function openEndpoints(node: GeometryNode): Array<{
  role: 'start' | 'end';
  point: Vec2;
  fixedAnchor: Vec2;
}> {
  switch (node.type) {
    case 'line': return [
      { role: 'start', point: node.start, fixedAnchor: node.end },
      { role: 'end', point: node.end, fixedAnchor: node.start },
    ];
    default: return [];
  }
}

function findCarrierContacts(
  document: DrawingDocument,
  carrier: Extract<GeometryNode, { type: 'circle' | 'ellipse' }>,
  tolerance: number,
) {
  return document.geometry.flatMap((node) => {
    if (node.id === carrier.id) return [];
    return openEndpoints(node).flatMap((endpoint) => {
      const projected = closestPointOnCarrier(carrier, endpoint.point);
      if (!projected || distance(projected, endpoint.point) > tolerance) return [];
      return [{ node, endpoint, projected }];
    });
  });
}

function closestPointOnCarrier(
  carrier: Extract<GeometryNode, { type: 'circle' | 'ellipse' }>,
  point: Vec2,
): Vec2 | null {
  if (carrier.type === 'circle') {
    const vector: Vec2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
    const length = Math.hypot(vector[0], vector[1]);
    if (length <= 1e-12) return null;
    return [
      clean(carrier.center[0] + vector[0] * carrier.radius / length),
      clean(carrier.center[1] + vector[1] * carrier.radius / length),
    ];
  }
  const majorLength = Math.hypot(carrier.majorAxis[0], carrier.majorAxis[1]);
  if (majorLength <= 1e-12 || carrier.ratio <= 0) return null;
  const majorUnit: Vec2 = [carrier.majorAxis[0] / majorLength, carrier.majorAxis[1] / majorLength];
  const minorUnit: Vec2 = [-majorUnit[1], majorUnit[0]];
  const delta: Vec2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
  const localX = dot(delta, majorUnit);
  const localY = dot(delta, minorUnit);
  const parameter = Math.atan2(localY / (majorLength * carrier.ratio), localX / majorLength);
  return ellipsePoint(carrier, parameter);
}

function transportCarrierPoint(
  carrier: Extract<GeometryNode, { type: 'circle' | 'ellipse' }>,
  point: Vec2,
  targetCenter: Vec2,
  rotationRadians: number,
): Vec2 {
  const local: Vec2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
  const rotated = rotateVector(local, rotationRadians);
  return [clean(targetCenter[0] + rotated[0]), clean(targetCenter[1] + rotated[1])];
}

function ellipsePoint(
  ellipse: Extract<GeometryNode, { type: 'ellipse' }>,
  parameter: number,
): Vec2 {
  const minor: Vec2 = [
    -ellipse.majorAxis[1] * ellipse.ratio,
    ellipse.majorAxis[0] * ellipse.ratio,
  ];
  return [
    clean(ellipse.center[0] + ellipse.majorAxis[0] * Math.cos(parameter)
      + minor[0] * Math.sin(parameter)),
    clean(ellipse.center[1] + ellipse.majorAxis[1] * Math.cos(parameter)
      + minor[1] * Math.sin(parameter)),
  ];
}

function drawingRelativeTolerance(document: DrawingDocument): number {
  const diagonal = drawingExtent(document);
  return Math.max(diagonal * 0.0025, Number.EPSILON * Math.max(1, diagonal) * 64);
}

function drawingExtent(document: DrawingDocument): number {
  const bounds = document.geometry.flatMap((node) => roughGeometryBounds(node) ?? []);
  if (bounds.length === 0) return 0.01;
  return Math.hypot(
    Math.max(...bounds.map((value) => value.maxX)) - Math.min(...bounds.map((value) => value.minX)),
    Math.max(...bounds.map((value) => value.maxY)) - Math.min(...bounds.map((value) => value.minY)),
  );
}

function endpointValue(
  document: DrawingDocument,
  nodeId: string,
  role: 'start' | 'end',
): Vec2 {
  const node = document.geometry.find((item) => item.id === nodeId);
  if (!node || node.type !== 'line') throw new Error('CONNECTED_TRANSFORM_CONNECTOR_STALE');
  return structuredClone(node[role]);
}

/**
 * Finds the rigid carrier rotation that minimizes the total squared distance from
 * transported contact ports to their fixed external anchors. This is the 2D
 * orthogonal Procrustes solution, so no model-side angle or connector coordinates
 * are needed for the common connected-move case.
 */
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
  if (Math.hypot(dotSum, crossSum) <= 1e-12) return 0;
  return clean(Math.atan2(crossSum, dotSum) * 180 / Math.PI);
}

function rotateVector(vector: Vec2, radians: number): Vec2 {
  return [
    clean(vector[0] * Math.cos(radians) - vector[1] * Math.sin(radians)),
    clean(vector[0] * Math.sin(radians) + vector[1] * Math.cos(radians)),
  ];
}

function normalizedRotationDegrees(value: number): number {
  if (!Number.isFinite(value)) throw new Error('CONNECTED_TRANSFORM_ROTATION_INVALID');
  const normalized = ((value % 360) + 540) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function dot(left: Vec2, right: Vec2): number {
  return left[0] * right[0] + left[1] * right[1];
}

function angleOf(center: Vec2, point: Vec2): number {
  return Math.atan2(point[1] - center[1], point[0] - center[0]);
}

function distance(left: Vec2, right: Vec2): number {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}

function signedArea(points: Vec2[]): number {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - point[1] * next[0];
  }, 0) / 2;
}

function safeRatio(numerator: number, denominator: number): number {
  if (Math.abs(denominator) > 1e-12) return numerator / denominator;
  return Math.abs(numerator) <= 1e-12 ? 1 : Number.MAX_SAFE_INTEGER;
}

function assertPoint(value: Vec2, code: string): void {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(Number.isFinite)) {
    throw new Error(code);
  }
}

function clean(value: number): number {
  const rounded = Number(value.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}
