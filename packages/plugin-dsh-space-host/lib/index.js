var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create((base == null ? void 0 : base[__knownSymbol("metadata")]) ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array2, target) => __defNormalProp(target, __knownSymbol("metadata"), array2[3]);
var __runInitializers = (array2, flags, self, value) => {
  for (var i = 0, fns = array2[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array2, flags, name, decorators, target, extra) => {
  var fn, it, done, ctx, access2, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array2.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array2[j - 1] = []), extraInitializers = array2[j] || (array2[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name]() {
    return __privateGet(this, extra);
  }, set [name](x) {
    return __privateSet(this, extra, x);
  } }, name));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name) : __name(target, name);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name, done = {}, array2[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access2 = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access2.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access2.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array2, target), desc && __defProp(target, name, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _ports, _byNode, _segmentById, _vertexById, _pending, _drawings, _durable, _previews, _vectorizer, _drawingId, _storage, _previewHandle, _now, _InMemoryDrawingRepository_instances, getDrawing_fn, durableState_fn, requireDurable_fn, saveDurable_fn, _directory, _FileDrawingRepositoryStorage_instances, atomicWrite_fn, path_fn, _pending2, _closed, _stderr, _LocalPythonVectorizerProcess_instances, invoke_fn, onLine_fn, reject_fn, failAll_fn, _timeoutMs, _pendingInstructions, _sessionPolicies, _tasks, _observations, _contexts, _groundings, _previews2, _evaluations, _reviewInflight, _stickyReviewDefects, _selectionProjections, _SemanticEditService_instances, commitPreview_fn, assess_fn, task_fn, preview_fn, snapshot_fn, snapshotAtTask_fn, _intents, _getPreview_dec, _getOperation_dec, _stageUndo_dec, _stageInteractiveEdit_dec, _projectSelection_dec, _query_dec, _getSnapshot_dec, _a2, _init;
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { isDeepStrictEqual } from "node:util";
import { mkdirSync, existsSync, readFileSync, unlinkSync, writeFileSync, openSync, fsyncSync, closeSync, renameSync } from "node:fs";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import sharp from "sharp";
const PLUGIN_NAME = "@vectorai/plugin-dsh-space-host";
const INSTRUCTION = [
  "A new drawing image is pending in the local VectorAI Space plugin.",
  "Call drawing_import before describing, inspecting, or modifying the drawing.",
  "Do not claim that the drawing was inspected until drawing_import succeeds."
].join(" ");
function findLatestImage(messages) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if ((message == null ? void 0 : message.source.kind) !== "user") continue;
    const content = message.content;
    for (let blockIndex = content.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = content[blockIndex];
      if ((block == null ? void 0 : block.type) === "image") return structuredClone(block.attachment);
    }
  }
  return null;
}
function createPreStepIntake(repository, semantic, scope = { isRuntimeRoot: () => true }) {
  return async (payload, next) => {
    var _a3, _b;
    const decision = await next();
    if (decision.kind === "reject" || payload.signal.aborted) return decision;
    if (!scope.isRuntimeRoot(payload.agent)) return decision;
    const directUser = [...decision.messages].reverse().find((message) => message.source.kind === "user");
    if (directUser && semantic) {
      const objective = directUser.content.filter((block) => block.type === "text").map(({ text }) => text).join("\n").trim();
      if (objective) semantic.bindUserInstruction(String(payload.agent.id), {
        objective,
        rootUserMessageDigest: `sha256:${createHash("sha256").update(JSON.stringify({
          id: String(directUser.id),
          objective,
          images: directUser.content.filter((block) => block.type === "image").map((block) => ({
            attachmentId: String(block.attachment.attachmentId),
            mediaType: block.attachment.mediaType,
            bytes: block.attachment.bytes
          }))
        })).digest("hex")}`
      });
    }
    let messages = [...decision.messages];
    const attachment = directUser ? findLatestImage([directUser]) : null;
    const snapshot = ((_a3 = repository.getSnapshot) == null ? void 0 : _a3.call(repository, String(payload.agent.id))) ?? null;
    const selection = ((_b = semantic == null ? void 0 : semantic.currentSelectionProjection) == null ? void 0 : _b.call(semantic, String(payload.agent.id))) ?? null;
    const drawingRef = (selection == null ? void 0 : selection.drawingRef) ?? (snapshot == null ? void 0 : snapshot.ref);
    if (directUser && drawingRef && attachment === null) {
      const capability = [
        `VectorAI drawing capability is available for ${drawingRef.drawingId}@${drawingRef.revision}.`,
        "To activate it, call drawing_observe only if the current user intent is to inspect or modify this drawing; otherwise ignore this capability and continue with other plugins.",
        ...selection ? [
          `Host-verified canvas selection ${selection.selectionProjectionId} contains exact Drawing node ids: ${selection.nodeIds.join(", ")}.`,
          "Use the selection only if drawing_observe starts a drawing task; then pass its selectionProjectionId to drawing_ground with empty targetNodeIds and interfaces so the Host derives the exact target and contacted connectors.",
          "The selection is grounding evidence only and does not grant write authority."
        ] : []
      ].join(" ");
      messages.push(createUserMessage({
        content: [{ type: "text", text: capability }],
        source: {
          kind: "plugin",
          plugin: PLUGIN_NAME,
          form: "snapshot",
          sections: [{ name: "vectorai:drawing-capability", text: capability }]
        }
      }));
    }
    if (attachment === null) return { kind: "enter", messages };
    repository.bindPending(String(payload.agent.id), attachment);
    const context = createUserMessage({
      content: [{ type: "text", text: INSTRUCTION }],
      source: {
        kind: "plugin",
        plugin: PLUGIN_NAME,
        form: "snapshot",
        sections: [{ name: "vectorai:drawing-intake", text: INSTRUCTION }]
      }
    });
    return { kind: "enter", messages: [...messages, context] };
  };
}
function canonicalString(value) {
  return JSON.stringify(normalize(value));
}
function canonicalSemanticString(document) {
  const semantic = Object.fromEntries(
    Object.entries(document).filter(([key]) => key !== "metadata")
  );
  return canonicalString(semantic);
}
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value === "number" && Object.is(value, -0)) return 0;
  return value;
}
function findConnectedCarrierCandidates(document) {
  const tolerance = drawingRelativeTolerance(document);
  return document.geometry.flatMap((node) => {
    if (node.type !== "circle" && node.type !== "ellipse") return [];
    const contacts = findCarrierContacts(document, node, tolerance);
    if (contacts.length === 0) return [];
    return [{
      carrierNodeId: String(node.id),
      carrierType: node.type,
      contactedOpenConnectorCount: new Set(contacts.map(({ node: connector }) => connector.id)).size,
      contactedPortCount: contacts.length
    }];
  });
}
function findConnectedCarrierInterfaces(document, carrierNodeId) {
  const carrier = document.geometry.find((node) => String(node.id) === carrierNodeId);
  if (!carrier || carrier.type !== "circle" && carrier.type !== "ellipse") return [];
  return findCarrierContacts(document, carrier, drawingRelativeTolerance(document)).map(({ node, endpoint, projected }) => ({
    interfaceId: `${String(node.id)}:${endpoint.role}`,
    nodeId: String(node.id),
    endpoint: endpoint.role,
    contactPoint: structuredClone(endpoint.point),
    projectedPoint: structuredClone(projected),
    fixedAnchor: structuredClone(endpoint.fixedAnchor)
  })).sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
}
function compileConnectedTransform(input) {
  const carrier = input.document.geometry.find((node) => node.id === input.carrierNodeId);
  if (!carrier) throw new Error("CONNECTED_TRANSFORM_CARRIER_NOT_FOUND");
  if (carrier.type !== "circle" && carrier.type !== "ellipse") {
    throw new Error("CONNECTED_TRANSFORM_CARRIER_NOT_CLOSED");
  }
  assertPoint(input.targetCenter, "CONNECTED_TRANSFORM_TARGET_CENTER_INVALID");
  const extent = drawingExtent(input.document);
  const explicitRotation = input.rotationDegrees === void 0 ? void 0 : normalizedRotationDegrees(input.rotationDegrees);
  if (distance$2(carrier.center, input.targetCenter) <= Math.max(extent * 1e-9, 1e-9) && Math.abs(explicitRotation ?? 0) <= 1e-9) throw new Error("CONNECTED_TRANSFORM_NO_EFFECT");
  const tolerance = input.contactTolerance ?? drawingRelativeTolerance(input.document);
  if (!Number.isFinite(tolerance) || tolerance <= 0) {
    throw new Error("CONNECTED_TRANSFORM_TOLERANCE_INVALID");
  }
  const contacts = findCarrierContacts(input.document, carrier, tolerance);
  const minimumRotation = contacts.length === 0 ? 0 : inferMinimumDeformationRotation({
    beforeCenter: carrier.center,
    targetCenter: input.targetCenter,
    contacts: contacts.map(({ endpoint, projected }) => ({
      projected,
      fixedAnchor: endpoint.fixedAnchor
    }))
  });
  const rotationDegrees = explicitRotation ?? minimumRotation;
  const rotationRadians = rotationDegrees * Math.PI / 180;
  const ports = contacts.map(({ node, endpoint, projected }) => {
    const after = transportCarrierPoint(carrier, projected, input.targetCenter, rotationRadians);
    const beforeLength = distance$2(projected, endpoint.fixedAnchor);
    const afterLength = distance$2(after, endpoint.fixedAnchor);
    return {
      connectorNodeId: String(node.id),
      endpointRole: endpoint.role,
      before: structuredClone(projected),
      after,
      fixedAnchor: structuredClone(endpoint.fixedAnchor),
      originalAngle: clean$1(angleOf(carrier.center, projected) * 180 / Math.PI),
      transportedAngle: clean$1(angleOf(input.targetCenter, after) * 180 / Math.PI),
      beforeConnectorLength: clean$1(beforeLength),
      afterConnectorLength: clean$1(afterLength),
      stretchRatio: clean$1(safeRatio(afterLength, beforeLength)),
      lengthChange: clean$1(afterLength - beforeLength)
    };
  }).sort((left, right) => left.originalAngle - right.originalAngle || left.connectorNodeId.localeCompare(right.connectorNodeId) || left.endpointRole.localeCompare(right.endpointRole));
  const commands = [{
    type: "node.update",
    id: String(carrier.id),
    changes: {
      center: structuredClone(input.targetCenter),
      ...carrier.type === "ellipse" && rotationDegrees !== 0 ? { majorAxis: rotateVector(carrier.majorAxis, rotationRadians) } : {}
    },
    expected: {
      center: structuredClone(carrier.center),
      ...carrier.type === "ellipse" && rotationDegrees !== 0 ? { majorAxis: structuredClone(carrier.majorAxis) } : {}
    }
  }, ...ports.map((port) => ({
    type: "node.update",
    id: port.connectorNodeId,
    changes: { [port.endpointRole]: structuredClone(port.after) },
    expected: {
      [port.endpointRole]: structuredClone(endpointValue(
        input.document,
        port.connectorNodeId,
        port.endpointRole
      ))
    }
  }))];
  const metrics = ports.length === 0 ? void 0 : interfaceMetrics({
    document: input.document,
    ports,
    carrier,
    targetCenter: input.targetCenter,
    selectedRotationDegrees: rotationDegrees,
    minimumDeformationRotationDegrees: minimumRotation
  });
  return {
    commands,
    diagnostics: metrics ? interfaceDiagnostics(String(carrier.id), ports, metrics) : [],
    audit: {
      carrierNodeId: String(carrier.id),
      carrierType: carrier.type,
      beforeCenter: structuredClone(carrier.center),
      targetCenter: structuredClone(input.targetCenter),
      rotationDegrees: clean$1(rotationDegrees),
      orientationMode: explicitRotation !== void 0 ? "explicit-rotation" : ports.length > 0 ? "minimum-deformation" : "translated",
      contactTolerance: tolerance,
      connectorNodeIds: [...new Set(ports.map(({ connectorNodeId }) => connectorNodeId))],
      ports,
      ...metrics ? { interfaceMetrics: metrics } : {}
    }
  };
}
function findCarrierContacts(document, carrier, tolerance) {
  return document.geometry.flatMap((node) => {
    if (node.id === carrier.id || node.type !== "line") return [];
    return [
      { role: "start", point: node.start, fixedAnchor: node.end },
      { role: "end", point: node.end, fixedAnchor: node.start }
    ].flatMap((endpoint) => {
      const projected = closestPointOnCarrier(carrier, endpoint.point);
      return projected && distance$2(projected, endpoint.point) <= tolerance ? [{ node, endpoint, projected }] : [];
    });
  });
}
function closestPointOnCarrier(carrier, point) {
  if (carrier.type === "circle") {
    const delta2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
    const length = Math.hypot(...delta2);
    if (length <= 1e-12) return null;
    return cleanPoint$2([
      carrier.center[0] + delta2[0] * carrier.radius / length,
      carrier.center[1] + delta2[1] * carrier.radius / length
    ]);
  }
  const majorLength = Math.hypot(...carrier.majorAxis);
  if (majorLength <= 1e-12 || carrier.ratio <= 0) return null;
  const major = [carrier.majorAxis[0] / majorLength, carrier.majorAxis[1] / majorLength];
  const minor = [-major[1], major[0]];
  const delta = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
  const parameter = Math.atan2(
    dot(delta, minor) / (majorLength * carrier.ratio),
    dot(delta, major) / majorLength
  );
  const minorAxis = [-carrier.majorAxis[1] * carrier.ratio, carrier.majorAxis[0] * carrier.ratio];
  return cleanPoint$2([
    carrier.center[0] + carrier.majorAxis[0] * Math.cos(parameter) + minorAxis[0] * Math.sin(parameter),
    carrier.center[1] + carrier.majorAxis[1] * Math.cos(parameter) + minorAxis[1] * Math.sin(parameter)
  ]);
}
function inferMinimumDeformationRotation(input) {
  let dotSum = 0;
  let crossSum = 0;
  for (const contact of input.contacts) {
    const local = [
      contact.projected[0] - input.beforeCenter[0],
      contact.projected[1] - input.beforeCenter[1]
    ];
    const target = [
      contact.fixedAnchor[0] - input.targetCenter[0],
      contact.fixedAnchor[1] - input.targetCenter[1]
    ];
    dotSum += dot(local, target);
    crossSum += local[0] * target[1] - local[1] * target[0];
  }
  return Math.hypot(dotSum, crossSum) <= 1e-12 ? 0 : clean$1(Math.atan2(crossSum, dotSum) * 180 / Math.PI);
}
function interfaceMetrics(input) {
  const drawingDiagonal = drawingExtent(input.document);
  const maximumStretchRatio = Math.max(...input.ports.map(({ stretchRatio }) => stretchRatio));
  const maximumLengthIncrease = Math.max(0, ...input.ports.map(({ lengthChange }) => lengthChange));
  const selectedDeformationCost = input.ports.reduce((sum, port) => sum + port.afterConnectorLength ** 2, 0);
  const referenceRadians = input.minimumDeformationRotationDegrees * Math.PI / 180;
  const minimumDeformationCost = input.ports.reduce((sum, port) => {
    const reference = transportCarrierPoint(input.carrier, port.before, input.targetCenter, referenceRadians);
    return sum + distance$2(reference, port.fixedAnchor) ** 2;
  }, 0);
  const result = {
    drawingDiagonal: clean$1(drawingDiagonal),
    portCount: input.ports.length,
    maximumStretchRatio: clean$1(maximumStretchRatio),
    maximumLengthIncrease: clean$1(maximumLengthIncrease),
    normalizedMaximumLengthIncrease: clean$1(maximumLengthIncrease / Math.max(drawingDiagonal, 1e-12)),
    selectedDeformationCost: clean$1(selectedDeformationCost),
    minimumDeformationCost: clean$1(minimumDeformationCost),
    deformationCostRatio: clean$1(safeRatio(selectedDeformationCost, minimumDeformationCost)),
    selectedRotationDegrees: clean$1(input.selectedRotationDegrees),
    minimumDeformationRotationDegrees: clean$1(input.minimumDeformationRotationDegrees)
  };
  if (input.ports.length === 2) {
    const before = signedArea([
      input.ports[0].fixedAnchor,
      input.ports[0].before,
      input.ports[1].before,
      input.ports[1].fixedAnchor
    ]);
    const after = signedArea([
      input.ports[0].fixedAnchor,
      input.ports[0].after,
      input.ports[1].after,
      input.ports[1].fixedAnchor
    ]);
    if (Math.abs(before) > Math.max(drawingDiagonal ** 2 * 1e-8, 1e-12)) {
      result.beforeSignedArea = clean$1(before);
      result.afterSignedArea = clean$1(after);
      result.areaRetentionRatio = clean$1(Math.abs(after / before));
      result.orientationInverted = Math.sign(after) !== Math.sign(before);
    }
  }
  return result;
}
function interfaceDiagnostics(carrierNodeId, ports, metrics) {
  const nodeIds = [carrierNodeId, ...new Set(ports.map(({ connectorNodeId }) => connectorNodeId))];
  const facts = interfaceFacts(metrics);
  const diagnostics = [];
  if (metrics.orientationInverted) diagnostics.push({
    code: "CONNECTED_INTERFACE_ORIENTATION_INVERTED",
    severity: "warning",
    message: "The ordered connected interface changes orientation.",
    nodeIds,
    action: "Choose another target pose or rebuild the connected boundary.",
    facts
  });
  if (metrics.areaRetentionRatio !== void 0 && metrics.areaRetentionRatio < 0.1) diagnostics.push({
    code: "CONNECTED_INTERFACE_AREA_COLLAPSED",
    severity: "warning",
    message: "The connected interface area collapses below ten percent of its original area.",
    nodeIds,
    action: "Inspect the interface pairing and use the minimum-deformation orientation.",
    facts
  });
  if (metrics.maximumStretchRatio > 3 && metrics.normalizedMaximumLengthIncrease > 0.02) diagnostics.push({
    code: "CONNECTED_INTERFACE_EXCESSIVE_STRETCH",
    severity: "warning",
    message: "At least one connected boundary is stretched excessively.",
    nodeIds,
    action: "Move the target closer or rebuild the connected boundary.",
    facts
  });
  if (metrics.deformationCostRatio >= 4) diagnostics.push({
    code: "CONNECTED_TRANSFORM_NON_MINIMUM_ORIENTATION",
    severity: "warning",
    message: "The explicit orientation has much greater deformation cost than the minimum-deformation pose.",
    nodeIds,
    action: "Use the measured minimum-deformation orientation or explicitly confirm the intended twist.",
    facts
  });
  return diagnostics;
}
function interfaceFacts(metrics) {
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
    ...metrics.beforeSignedArea === void 0 ? {} : { beforeSignedArea: metrics.beforeSignedArea },
    ...metrics.afterSignedArea === void 0 ? {} : { afterSignedArea: metrics.afterSignedArea },
    ...metrics.areaRetentionRatio === void 0 ? {} : { areaRetentionRatio: metrics.areaRetentionRatio },
    ...metrics.orientationInverted === void 0 ? {} : { orientationInverted: metrics.orientationInverted }
  };
}
function transportCarrierPoint(carrier, point, center2, radians) {
  const local = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
  const rotated = rotateVector(local, radians);
  return cleanPoint$2([center2[0] + rotated[0], center2[1] + rotated[1]]);
}
function drawingRelativeTolerance(document) {
  const diagonal = drawingExtent(document);
  return Math.max(diagonal * 25e-4, Number.EPSILON * Math.max(1, diagonal) * 64);
}
function drawingExtent(document) {
  const points = document.geometry.flatMap(geometryExtentPoints);
  if (points.length === 0) return 0.01;
  return Math.hypot(
    Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y))
  );
}
function geometryExtentPoints(node) {
  if (node.type === "point") return [[node.x, node.y]];
  if (node.type === "line") return [node.start, node.end];
  if (node.type === "ray" || node.type === "xline") return [node.origin];
  if (node.type === "circle" || node.type === "arc") return [
    [node.center[0] - node.radius, node.center[1] - node.radius],
    [node.center[0] + node.radius, node.center[1] + node.radius]
  ];
  if (node.type === "ellipse") {
    const radius = Math.hypot(...node.majorAxis);
    return [[node.center[0] - radius, node.center[1] - radius], [node.center[0] + radius, node.center[1] + radius]];
  }
  if (node.type === "polyline") return node.vertices.map(({ point }) => point);
  return node.controlPoints;
}
function endpointValue(document, nodeId, endpoint) {
  const node = document.geometry.find((item) => item.id === nodeId);
  if (!node || node.type !== "line") throw new Error("CONNECTED_TRANSFORM_CONNECTOR_STALE");
  return structuredClone(node[endpoint]);
}
function normalizedRotationDegrees(value) {
  if (!Number.isFinite(value)) throw new Error("CONNECTED_TRANSFORM_ROTATION_INVALID");
  const normalized = (value % 360 + 540) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}
function rotateVector(vector, radians) {
  return cleanPoint$2([
    vector[0] * Math.cos(radians) - vector[1] * Math.sin(radians),
    vector[0] * Math.sin(radians) + vector[1] * Math.cos(radians)
  ]);
}
function signedArea(points) {
  return points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point[0] * next[1] - point[1] * next[0];
  }, 0) / 2;
}
function safeRatio(numerator, denominator) {
  return Math.abs(denominator) > 1e-12 ? numerator / denominator : Math.abs(numerator) <= 1e-12 ? 1 : Number.MAX_SAFE_INTEGER;
}
function angleOf(center2, point) {
  return Math.atan2(point[1] - center2[1], point[0] - center2[0]);
}
function distance$2(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1];
}
function cleanPoint$2(point) {
  return [clean$1(point[0]), clean$1(point[1])];
}
function clean$1(value) {
  const rounded = Number(value.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}
function assertPoint(point, code) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error(code);
}
function applyDrawingTransaction(source, commands, now) {
  const document = structuredClone(source);
  for (const command of commands) applyCommand$1(document, command);
  validateDocument$1(document);
  document.metadata.updatedAt = now;
  return document;
}
function findDrawingNode(document, id) {
  for (const plane of ["geometry", "annotation", "relation", "feature"]) {
    const collection = collectionFor(document, plane);
    const node = collection.find((candidate) => candidate.id === id);
    if (node) return { plane, node };
  }
  return null;
}
function applyCommand$1(document, command) {
  if (command.type === "node.create") {
    if (findDrawingNode(document, command.node.id)) throw new Error("EDIT_NODE_ALREADY_EXISTS");
    const collection = collectionFor(document, command.plane);
    collection.push(structuredClone(command.node));
    return;
  }
  const located = findDrawingNode(document, command.id);
  if (!located) throw new Error("EDIT_NODE_NOT_FOUND");
  if (command.type === "node.delete") {
    const collection = collectionFor(document, located.plane);
    const index = collection.findIndex(({ id }) => id === command.id);
    collection.splice(index, 1);
    removeReferences(document, command.id);
    return;
  }
  if (command.type === "annotation.move-text") {
    if (located.plane !== "annotation") throw new Error("EDIT_NODE_TYPE_MISMATCH");
    const node2 = located.node;
    const key = node2.type === "text" ? "position" : "textPosition";
    assertExpected(node2[key], command.expectedPosition);
    node2[key] = structuredClone(command.position);
    return;
  }
  const node = located.node;
  for (const [key, expected] of Object.entries(command.expected)) assertExpected(node[key], expected);
  for (const [key, value] of Object.entries(command.changes)) node[key] = structuredClone(value);
}
function collectionFor(document, plane) {
  if (plane === "geometry") return document.geometry;
  if (plane === "annotation") return document.annotations;
  if (plane === "relation") return document.relations;
  return document.features;
}
function removeReferences(document, id) {
  document.relations = document.relations.filter((relation) => {
    if (relation.type === "topology") return !relation.nodeIds.includes(id);
    if (relation.type === "constraint") return !relation.geometryIds.includes(id);
    if (relation.type === "association") {
      return relation.annotationId !== id && !relation.geometryIds.includes(id);
    }
    return relation.featureId !== id && !relation.nodeIds.includes(id);
  });
  document.features = document.features.filter((feature) => feature.id !== id).map((feature) => ({
    ...feature,
    geometryIds: feature.geometryIds.filter((nodeId) => nodeId !== id),
    annotationIds: feature.annotationIds.filter((nodeId) => nodeId !== id),
    relationIds: feature.relationIds.filter((nodeId) => nodeId !== id)
  }));
}
function validateDocument$1(document) {
  const ids = [
    ...document.geometry.map(({ id }) => id),
    ...document.annotations.map(({ id }) => id),
    ...document.relations.map(({ id }) => id),
    ...document.features.map(({ id }) => id)
  ].map(String);
  if (new Set(ids).size !== ids.length) throw new Error("EDIT_DUPLICATE_NODE_ID");
  const geometry = new Set(document.geometry.map(({ id }) => id));
  const annotation = new Set(document.annotations.map(({ id }) => id));
  const feature = new Set(document.features.map(({ id }) => id));
  for (const relation of document.relations) {
    const valid = relation.type === "topology" ? relation.nodeIds.every((id) => ids.includes(String(id))) : relation.type === "constraint" ? relation.geometryIds.every((id) => geometry.has(id)) : relation.type === "association" ? annotation.has(relation.annotationId) && relation.geometryIds.every((id) => geometry.has(id)) : feature.has(relation.featureId) && relation.nodeIds.every((id) => ids.includes(String(id)));
    if (!valid) throw new Error("EDIT_DANGLING_REFERENCE");
  }
}
function assertExpected(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("EDIT_PRECONDITION_FAILED");
}
function invertDrawingTransaction(document, forward) {
  let working = structuredClone(document);
  const inverses = [];
  for (const command of forward) {
    inverses.push(inverseFor(working, command));
    working = applyDrawingTransaction(working, [command], working.metadata.updatedAt);
  }
  return inverses.reverse().flat();
}
function inverseFor(document, command) {
  if (command.type === "node.create") return [{ type: "node.delete", id: command.node.id }];
  const located = findDrawingNode(document, command.id);
  if (!located) throw new Error("EDIT_NODE_NOT_FOUND");
  if (command.type === "node.delete") {
    return [{
      type: "node.create",
      plane: located.plane,
      node: structuredClone(located.node)
    }];
  }
  if (command.type === "annotation.move-text") {
    return [{
      type: "annotation.move-text",
      id: command.id,
      position: structuredClone(command.expectedPosition),
      expectedPosition: structuredClone(command.position)
    }];
  }
  const node = located.node;
  return [{
    type: "node.update",
    id: command.id,
    changes: Object.fromEntries(Object.keys(command.changes).map((key) => [key, structuredClone(node[key])])),
    expected: structuredClone(command.changes)
  }];
}
function compileSpatialEditProgram(input) {
  if (input.program.baseRef.drawingId !== input.document.id) throw new Error("EDIT_DRAWING_MISMATCH");
  if (input.program.targetHandle !== input.grounding.targetHandle) throw new Error("EDIT_GROUNDING_MISMATCH");
  const initial = structuredClone(input.document);
  let working = structuredClone(input.document);
  const forward = [];
  const operationDiagnostics = [];
  for (const operation of input.program.operations) {
    const compiled = compileOperation(working, operation, input.grounding, input.ports);
    const commands = compiled.commands;
    operationDiagnostics.push(...compiled.diagnostics);
    if (commands.length > 0) {
      working = applyDrawingTransaction(working, commands, input.ports.now());
      forward.push(...commands);
    }
  }
  if (canonicalSemanticString(initial) === canonicalSemanticString(working)) throw new Error("EDIT_NO_EFFECT");
  assertPreserved(initial, working, input.program.preserveScopes);
  const diagnostics = [
    ...operationDiagnostics,
    ...evaluateProgram(working, input.program, input.grounding)
  ];
  const inverse = invertDrawingTransaction(initial, forward);
  const restored = applyDrawingTransaction(working, inverse, input.ports.now());
  if (canonicalSemanticString(restored) !== canonicalSemanticString(initial)) {
    throw new Error("EDIT_INVERSE_VERIFICATION_FAILED");
  }
  const actualEffect = diffDocuments$1(initial, working);
  const effectProjection = {
    createdNodeIds: actualEffect.createdNodeIds,
    updatedNodeIds: actualEffect.updatedNodeIds,
    deletedNodeIds: actualEffect.deletedNodeIds,
    changedFields: actualEffect.changedFields
  };
  const effectDigest = input.ports.digest(canonicalString(effectProjection));
  const candidateDigest = input.ports.digest(canonicalString({
    baseRef: input.program.baseRef,
    resultingSemanticDocument: JSON.parse(canonicalSemanticString(working)),
    effectDigest,
    forward,
    inverse,
    targetScope: [...input.grounding.targetNodeIds].sort(),
    interfaceScopes: [...input.grounding.interfaces].map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint })).sort((left, right) => left.interfaceId.localeCompare(right.interfaceId))
  }));
  const semanticRiskKey = input.ports.digest(canonicalString({
    baseRef: input.program.baseRef,
    resultingSemanticDigest: input.ports.digest(canonicalSemanticString(working)),
    effectDigest,
    authoritativeObjective: input.program.objective
  }));
  return { forward, inverse, candidate: working, actualEffect, diagnostics, candidateDigest, effectDigest, semanticRiskKey };
}
function compileOperation(document, operation, grounding, ports) {
  if (operation.kind === "rigid_transform") {
    const transform2 = normalizedTransform(operation);
    return {
      commands: grounding.targetNodeIds.map((id) => transformNodeCommand(document, id, transform2)),
      diagnostics: []
    };
  }
  if (operation.kind === "connected_transform") {
    const target = grounding.targetNodeIds.length === 1 ? findDrawingNode(document, grounding.targetNodeIds[0]) : null;
    if ((target == null ? void 0 : target.plane) === "geometry" && (target.node.type === "circle" || target.node.type === "ellipse")) {
      const translation = finitePoint(operation.translation, "EDIT_TRANSFORM_INVALID");
      const candidate = operation;
      const compiled = compileConnectedTransform({
        document,
        carrierNodeId: String(target.node.id),
        targetCenter: [
          target.node.center[0] + translation[0],
          target.node.center[1] + translation[1]
        ],
        ...candidate.rotationRadians === void 0 ? {} : { rotationDegrees: degrees(candidate.rotationRadians) }
      });
      const allowed2 = new Set(operation.interfaceIds);
      const grounded = new Set(grounding.interfaces.map(({ interfaceId }) => interfaceId));
      for (const port of compiled.audit.ports) {
        const interfaceId = `${port.connectorNodeId}:${port.endpointRole}`;
        if (!allowed2.has(interfaceId) || !grounded.has(interfaceId)) {
          throw new Error("EDIT_INTERFACE_SCOPE_MISMATCH");
        }
      }
      return { commands: dedupeUpdates(compiled.commands), diagnostics: compiled.diagnostics };
    }
    if (operation.rotationRadians === void 0 || operation.pivot === void 0) {
      throw new Error("EDIT_CONNECTED_STRATEGY_UNAVAILABLE");
    }
    const transform2 = normalizedTransform({
      translation: operation.translation,
      rotationRadians: operation.rotationRadians,
      pivot: operation.pivot
    });
    const allowed = new Set(operation.interfaceIds);
    const commands = grounding.targetNodeIds.map((id) => transformNodeCommand(document, id, transform2));
    for (const port of grounding.interfaces) {
      if (!allowed.has(port.interfaceId)) throw new Error("EDIT_INTERFACE_SCOPE_MISMATCH");
      if (!port.endpoint) throw new Error("EDIT_INTERFACE_ENDPOINT_REQUIRED");
      const located = findDrawingNode(document, port.nodeId);
      if (!located || located.plane !== "geometry" || located.node.type !== "line") {
        throw new Error("EDIT_INTERFACE_UNRESOLVED");
      }
      const point = located.node[port.endpoint];
      commands.push({
        type: "node.update",
        id: port.nodeId,
        changes: { [port.endpoint]: transformPoint(point, transform2) },
        expected: { [port.endpoint]: structuredClone(point) }
      });
    }
    return { commands: dedupeUpdates(commands), diagnostics: [] };
  }
  if (operation.kind === "set_endpoint") {
    const located = findDrawingNode(document, operation.nodeId);
    if (!located || located.plane !== "geometry" || located.node.type !== "line") {
      throw new Error("EDIT_ENDPOINT_UNRESOLVED");
    }
    return { commands: [{
      type: "node.update",
      id: operation.nodeId,
      changes: { [operation.endpoint]: structuredClone(operation.point) },
      expected: { [operation.endpoint]: structuredClone(located.node[operation.endpoint]) }
    }], diagnostics: [] };
  }
  if (operation.kind === "create_path") {
    const id = operation.nodeId || inputId(ports, "geometry");
    return { commands: [{
      type: "node.create",
      plane: "geometry",
      node: {
        id,
        type: "polyline",
        vertices: operation.points.map((point) => ({ point: structuredClone(point) })),
        closed: operation.closed,
        visible: true,
        quality: { status: grounding.sourceStatus === "confirmed" ? "confirmed" : "candidate", evidenceRefs: [] }
      }
    }], diagnostics: [] };
  }
  if (operation.kind === "create_annotation_batch") {
    return { commands: [
      ...operation.annotations.map((node) => ({
        type: "node.create",
        plane: "annotation",
        node: structuredClone(node)
      })),
      ...operation.associations.map((node) => ({
        type: "node.create",
        plane: "relation",
        node: structuredClone(node)
      }))
    ], diagnostics: [] };
  }
  return { commands: operation.nodeIds.map((id) => {
    if (!findDrawingNode(document, id)) throw new Error("EDIT_NODE_NOT_FOUND");
    return { type: "node.delete", id };
  }), diagnostics: [] };
}
function finitePoint(value, code) {
  const point = [Number(value[0]), Number(value[1])];
  if (!point.every(Number.isFinite)) throw new Error(code);
  return point;
}
function normalizedTransform(input) {
  const translation = [Number(input.translation[0]), Number(input.translation[1])];
  const pivot = [Number(input.pivot[0]), Number(input.pivot[1])];
  if (![...translation, ...pivot, input.rotationRadians].every(Number.isFinite)) {
    throw new Error("EDIT_TRANSFORM_INVALID");
  }
  return { translation, rotationRadians: input.rotationRadians, pivot };
}
function inputId(ports, kind) {
  const id = ports.id(kind);
  if (!id) throw new Error("EDIT_ID_UNAVAILABLE");
  return id;
}
function transformNodeCommand(document, id, transform2) {
  const located = findDrawingNode(document, id);
  if (!located) throw new Error("EDIT_TARGET_UNRESOLVED");
  const before = located.node;
  const changes = located.plane === "geometry" ? transformedGeometryFields(before, transform2) : located.plane === "annotation" ? transformedAnnotationFields(before, transform2) : null;
  if (!changes) throw new Error("EDIT_TARGET_NOT_TRANSFORMABLE");
  return {
    type: "node.update",
    id,
    changes: changes.after,
    expected: changes.before
  };
}
function transformedGeometryFields(node, transform2) {
  if (node.type === "point") return pair({ x: node.x, y: node.y }, (() => {
    const [x, y] = transformPoint([node.x, node.y], transform2);
    return { x, y };
  })());
  if (node.type === "line") return pair({ start: node.start, end: node.end }, { start: transformPoint(node.start, transform2), end: transformPoint(node.end, transform2) });
  if (node.type === "ray" || node.type === "xline") return pair({ origin: node.origin, direction: node.direction }, { origin: transformPoint(node.origin, transform2), direction: rotate(node.direction, transform2.rotationRadians) });
  if (node.type === "circle") return pair({ center: node.center }, { center: transformPoint(node.center, transform2) });
  if (node.type === "arc") return pair(
    { center: node.center, startAngle: node.startAngle, endAngle: node.endAngle },
    { center: transformPoint(node.center, transform2), startAngle: node.startAngle + degrees(transform2.rotationRadians), endAngle: node.endAngle + degrees(transform2.rotationRadians) }
  );
  if (node.type === "ellipse") return pair({ center: node.center, majorAxis: node.majorAxis }, { center: transformPoint(node.center, transform2), majorAxis: rotate(node.majorAxis, transform2.rotationRadians) });
  if (node.type === "polyline") return pair({ vertices: node.vertices }, { vertices: node.vertices.map((vertex) => ({ ...vertex, point: transformPoint(vertex.point, transform2) })) });
  return pair({ controlPoints: node.controlPoints }, { controlPoints: node.controlPoints.map((point) => transformPoint(point, transform2)) });
}
function transformedAnnotationFields(node, transform2) {
  if (node.type === "text") return pair({ position: node.position, rotation: node.rotation }, { position: transformPoint(node.position, transform2), rotation: node.rotation + transform2.rotationRadians });
  if (node.type === "dimension") return pair({ textPosition: node.textPosition, definitionPoints: node.definitionPoints }, { textPosition: transformPoint(node.textPosition, transform2), definitionPoints: node.definitionPoints.map((point) => transformPoint(point, transform2)) });
  if (node.type === "leader") return pair({ points: node.points }, { points: node.points.map((point) => transformPoint(point, transform2)) });
  if (node.type === "centerline") return pair({ start: node.start, end: node.end }, { start: transformPoint(node.start, transform2), end: transformPoint(node.end, transform2) });
  return pair({ segments: node.segments }, { segments: node.segments.map((segment) => ({ start: transformPoint(segment.start, transform2), end: transformPoint(segment.end, transform2) })) });
}
function pair(before, after) {
  return { before: structuredClone(before), after };
}
function transformPoint(point, transform2) {
  const relative = [point[0] - transform2.pivot[0], point[1] - transform2.pivot[1]];
  const rotated = rotate(relative, transform2.rotationRadians);
  return cleanPoint$1([
    rotated[0] + transform2.pivot[0] + transform2.translation[0],
    rotated[1] + transform2.pivot[1] + transform2.translation[1]
  ]);
}
function rotate(vector, radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return cleanPoint$1([vector[0] * cosine - vector[1] * sine, vector[0] * sine + vector[1] * cosine]);
}
function cleanPoint$1(point) {
  return [clean(point[0]), clean(point[1])];
}
function clean(value) {
  const result = Math.abs(value) < 1e-12 ? 0 : Number(value.toFixed(12));
  return Object.is(result, -0) ? 0 : result;
}
function degrees(radians) {
  return radians * 180 / Math.PI;
}
function dedupeUpdates(commands) {
  const merged = [];
  const indexes = /* @__PURE__ */ new Map();
  for (const command of commands) {
    const id = "id" in command ? command.id : command.node.id;
    const index = indexes.get(id);
    if (index === void 0) {
      indexes.set(id, merged.length);
      merged.push(structuredClone(command));
      continue;
    }
    const current = merged[index];
    if ((current == null ? void 0 : current.type) !== "node.update" || command.type !== "node.update") {
      throw new Error("EDIT_OVERLAPPING_TRANSFORM_SCOPE");
    }
    const overlap = Object.keys(command.changes).some((field) => field in current.changes);
    if (overlap) throw new Error("EDIT_OVERLAPPING_TRANSFORM_SCOPE");
    merged[index] = {
      ...current,
      changes: { ...current.changes, ...structuredClone(command.changes) },
      expected: { ...current.expected, ...structuredClone(command.expected) }
    };
  }
  return merged;
}
function assertPreserved(before, after, scopes) {
  var _a3, _b;
  for (const scope of scopes) {
    if (scope.kind !== "node-field") continue;
    const beforeNode = (_a3 = findDrawingNode(before, scope.nodeId)) == null ? void 0 : _a3.node;
    const afterNode = (_b = findDrawingNode(after, scope.nodeId)) == null ? void 0 : _b.node;
    if (!beforeNode || !afterNode) throw new Error("EDIT_PRESERVE_SCOPE_CHANGED");
    for (const field of scope.fields) {
      if (canonicalString(beforeNode[field]) !== canonicalString(afterNode[field])) {
        throw new Error("EDIT_PRESERVE_SCOPE_CHANGED");
      }
    }
  }
}
function evaluateProgram(document, program, grounding) {
  const diagnostics = [];
  if (grounding.sourceStatus !== "confirmed") diagnostics.push({
    code: grounding.sourceStatus === "provisional" ? "SOURCE_PROVISIONAL" : "SOURCE_CANDIDATE",
    severity: "warning",
    message: "The edit target is not backed by confirmed source geometry."
  });
  for (const postcondition of program.postconditions) {
    if (postcondition.kind !== "within_bounds") continue;
    const outside = document.geometry.some((node) => nodePoints(node).some(([x, y]) => x < postcondition.bounds.minX || x > postcondition.bounds.maxX || y < postcondition.bounds.minY || y > postcondition.bounds.maxY));
    if (outside) diagnostics.push({
      code: "POSTCONDITION_OUT_OF_BOUNDS",
      severity: "error",
      hard: true,
      message: "Edited geometry exceeds the declared drawing bounds."
    });
  }
  return diagnostics;
}
function nodePoints(node) {
  if (node.type === "point") return [[node.x, node.y]];
  if (node.type === "line") return [node.start, node.end];
  if (node.type === "ray" || node.type === "xline") return [node.origin];
  if (node.type === "circle" || node.type === "arc" || node.type === "ellipse") return [node.center];
  if (node.type === "polyline") return node.vertices.map(({ point }) => point);
  return node.controlPoints;
}
function diffDocuments$1(before, after) {
  const beforeNodes = allNodes$2(before);
  const afterNodes = allNodes$2(after);
  const createdNodeIds = [...afterNodes.keys()].filter((id) => !beforeNodes.has(id)).sort();
  const deletedNodeIds = [...beforeNodes.keys()].filter((id) => !afterNodes.has(id)).sort();
  const changedFields = {};
  const updatedNodeIds = [...beforeNodes.keys()].filter((id) => {
    const next = afterNodes.get(id);
    if (!next || canonicalString(beforeNodes.get(id)) === canonicalString(next)) return false;
    const previous = beforeNodes.get(id);
    changedFields[id] = [.../* @__PURE__ */ new Set([...Object.keys(previous), ...Object.keys(next)])].filter((key) => canonicalString(previous[key]) !== canonicalString(next[key])).sort();
    return true;
  }).sort();
  return { createdNodeIds, updatedNodeIds, deletedNodeIds, changedFields };
}
function allNodes$2(document) {
  return new Map([
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features
  ].map((node) => [node.id, node]));
}
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;
const PLANE_ORDER = ["geometry", "annotation", "relation", "feature"];
function queryDrawing(document, query) {
  if (query.kind === "node") {
    return { kind: "node", node: cloneResult(findNode$1(document, query.id)) };
  }
  if (query.kind === "neighbors") return queryNeighbors(document, query);
  return queryWorldSlice(document, query);
}
function queryWorldSlice(document, query) {
  validateBounds(query.bounds);
  const limit = validateLimit(query.limit);
  const selectedPlanes = new Set(query.planes ?? PLANE_ORDER);
  const direct = /* @__PURE__ */ new Map();
  direct.set("geometry", selectedPlanes.has("geometry") ? document.geometry.filter((node) => intersectsNode(node, query.bounds)).map((node) => ({ plane: "geometry", node })) : []);
  direct.set("annotation", selectedPlanes.has("annotation") ? document.annotations.filter((node) => intersectsNode(node, query.bounds)).map((node) => ({ plane: "annotation", node })) : []);
  const directNodeIds = /* @__PURE__ */ new Set([
    ...(direct.get("geometry") ?? []).map(({ node }) => node.id),
    ...(direct.get("annotation") ?? []).map(({ node }) => node.id)
  ]);
  const relations = selectedPlanes.has("relation") ? document.relations.filter((node) => referencedIds(node).some((id) => directNodeIds.has(id) || referencedNodeIntersects(document, id, query.bounds))).map((node) => ({ plane: "relation", node })) : [];
  direct.set("relation", relations);
  const matchedIds = /* @__PURE__ */ new Set([...directNodeIds, ...relations.map(({ node }) => node.id)]);
  direct.set("feature", selectedPlanes.has("feature") ? document.features.filter((node) => referencedIds(node).some((id) => matchedIds.has(id) || referencedNodeIntersects(document, id, query.bounds))).map((node) => ({ plane: "feature", node })) : []);
  const totalByPlane = Object.fromEntries(PLANE_ORDER.map((plane) => {
    var _a3;
    return [
      plane,
      ((_a3 = direct.get(plane)) == null ? void 0 : _a3.length) ?? 0
    ];
  }));
  const all = PLANE_ORDER.flatMap((plane) => direct.get(plane) ?? []);
  return {
    kind: "world-slice",
    bounds: structuredClone(query.bounds),
    nodes: structuredClone(all.slice(0, limit)),
    totalByPlane,
    truncated: all.length > limit
  };
}
function queryNeighbors(document, query) {
  const limit = validateLimit(query.limit);
  if (findNode$1(document, query.nodeId) === null) {
    return { kind: "neighbors", nodeId: query.nodeId, nodes: [], truncated: false };
  }
  const related = document.relations.filter((node) => referencedIds(node).includes(query.nodeId));
  const features = document.features.filter((node) => referencedIds(node).includes(query.nodeId) || related.some((relation) => node.relationIds.includes(relation.id)));
  const ids = /* @__PURE__ */ new Set();
  for (const node of [...related, ...features]) {
    for (const id of referencedIds(node)) ids.add(id);
  }
  ids.delete(query.nodeId);
  const nodes = orderedNodes(document).filter(({ node }) => ids.has(node.id) || related.some((relation) => relation.id === node.id) || features.some((feature) => feature.id === node.id));
  return {
    kind: "neighbors",
    nodeId: query.nodeId,
    nodes: structuredClone(nodes.slice(0, limit)),
    truncated: nodes.length > limit
  };
}
function findNode$1(document, id) {
  return orderedNodes(document).find(({ node }) => node.id === id) ?? null;
}
function orderedNodes(document) {
  return [
    ...document.geometry.map((node) => ({ plane: "geometry", node })),
    ...document.annotations.map((node) => ({ plane: "annotation", node })),
    ...document.relations.map((node) => ({ plane: "relation", node })),
    ...document.features.map((node) => ({ plane: "feature", node }))
  ];
}
function cloneResult(result) {
  return result === null ? null : structuredClone(result);
}
function validateBounds(bounds2) {
  const values = [bounds2.minX, bounds2.minY, bounds2.maxX, bounds2.maxY];
  if (!values.every(Number.isFinite) || bounds2.minX > bounds2.maxX || bounds2.minY > bounds2.maxY) {
    throw new Error("INVALID_QUERY_BOUNDS");
  }
}
function validateLimit(limit) {
  const value = limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(value) || value < 1) throw new Error("INVALID_QUERY_LIMIT");
  if (value > MAX_LIMIT) throw new Error("QUERY_LIMIT_EXCEEDED");
  return value;
}
function referencedNodeIntersects(document, id, bounds2) {
  const result = findNode$1(document, id);
  return result !== null && (result.plane === "geometry" || result.plane === "annotation") && intersectsNode(result.node, bounds2);
}
function referencedIds(node) {
  if (node.type === "topology") return node.nodeIds;
  if (node.type === "constraint") return node.geometryIds;
  if (node.type === "association") return [node.annotationId, ...node.geometryIds];
  if (node.type === "semantic") return [node.featureId, ...node.nodeIds];
  return [...node.geometryIds, ...node.annotationIds, ...node.relationIds];
}
function intersectsNode(node, query) {
  if (node.type === "ray") return infiniteLineIntersects(node.origin, node.direction, query, true);
  if (node.type === "xline") return infiniteLineIntersects(node.origin, node.direction, query, false);
  return intersects(boundsOfNode(node), query);
}
function boundsOfNode(node) {
  switch (node.type) {
    case "point":
      return fromPoints([[node.x, node.y]]);
    case "line":
      return fromPoints([node.start, node.end]);
    case "circle":
      return radiusBounds(node.center, node.radius);
    case "arc":
      return arcBounds(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
    case "ellipse": {
      const [ax, ay] = node.majorAxis;
      const bx = -ay * node.ratio;
      const by = ax * node.ratio;
      return {
        minX: node.center[0] - Math.hypot(ax, bx),
        minY: node.center[1] - Math.hypot(ay, by),
        maxX: node.center[0] + Math.hypot(ax, bx),
        maxY: node.center[1] + Math.hypot(ay, by)
      };
    }
    case "polyline":
      return fromPoints(node.vertices.map(({ point }) => point));
    case "spline":
      return fromPoints(node.controlPoints);
    case "text": {
      const width = node.maxWidth ?? Math.max(node.height, node.content.length * node.height * 0.6);
      return expandPoint(node.position, width, node.height);
    }
    case "dimension":
      return fromPoints([...node.definitionPoints, node.textPosition]);
    case "leader":
      return fromPoints(node.points);
    case "centerline":
      return fromPoints([node.start, node.end]);
    case "section-hatch":
      return fromPoints(node.segments.flatMap(({ start, end }) => [start, end]));
  }
}
function fromPoints(points) {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function radiusBounds([x, y], radius) {
  return { minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius };
}
function arcBounds(center2, radius, startAngle, endAngle, counterClockwise) {
  const angles = [startAngle, endAngle];
  for (const angle of [0, 90, 180, 270]) {
    if (angleOnArc(angle, startAngle, endAngle, counterClockwise)) angles.push(angle);
  }
  return fromPoints(angles.map((angle) => {
    const radians = angle * Math.PI / 180;
    return [center2[0] + radius * Math.cos(radians), center2[1] + radius * Math.sin(radians)];
  }));
}
function angleOnArc(angle, start, end, counterClockwise) {
  const normalize2 = (value) => (value % 360 + 360) % 360;
  const a = normalize2(angle);
  const s = normalize2(start);
  const e = normalize2(end);
  if (counterClockwise) return normalize2(a - s) <= normalize2(e - s);
  return normalize2(s - a) <= normalize2(s - e);
}
function expandPoint([x, y], width, height) {
  return { minX: x - width, minY: y - height, maxX: x + width, maxY: y + height };
}
function intersects(a, b) {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
function infiniteLineIntersects(origin, direction, bounds2, ray) {
  const [dx, dy] = direction;
  if (dx === 0 && dy === 0) return intersects(fromPoints([origin]), bounds2);
  let low = ray ? 0 : Number.NEGATIVE_INFINITY;
  let high = Number.POSITIVE_INFINITY;
  for (const [coordinate, delta, min, max] of [
    [origin[0], dx, bounds2.minX, bounds2.maxX],
    [origin[1], dy, bounds2.minY, bounds2.maxY]
  ]) {
    if (delta === 0) {
      if (coordinate < min || coordinate > max) return false;
      continue;
    }
    const first = (min - coordinate) / delta;
    const second = (max - coordinate) / delta;
    low = Math.max(low, Math.min(first, second));
    high = Math.min(high, Math.max(first, second));
  }
  return low <= high;
}
const WORLD_MODEL_COMPILER_VERSION = "world-model-0.1.0";
class WorldModelCompiler {
  constructor(ports = { digest: portableDigest$1 }) {
    __privateAdd(this, _ports);
    __privateSet(this, _ports, ports);
  }
  compile(document, revision, request = {}) {
    var _a3, _b, _c;
    const tolerance = positive$2(request.tolerance, 1e-6);
    const curveSamples = integer$1(request.curveSamples, 8, 512, 64);
    const limit = integer$1(request.limit, 1, 2e3, 2e3);
    const requested = request.nodeIds ? new Set(request.nodeIds) : null;
    const allCandidates = document.geometry.filter((node) => (!requested || requested.has(String(node.id))) && (!request.bounds || boundsIntersect(geometryBounds(node), request.bounds)));
    const effectiveScopeBounds = request.bounds ? structuredClone(request.bounds) : unionSpatialBounds(allCandidates.map(geometryBounds));
    const missing = ((_a3 = request.nodeIds) == null ? void 0 : _a3.filter((id) => !document.geometry.some((node) => node.id === id))) ?? [];
    const scopeDigest = __privateGet(this, _ports).digest(stableStringify({
      drawingId: document.id,
      revision,
      nodeIds: (_b = request.nodeIds) == null ? void 0 : _b.slice().sort(),
      bounds: request.bounds,
      tolerance,
      curveSamples
    }));
    const offset = parseContinuation(request.continuationToken, scopeDigest);
    const page = allCandidates.slice(offset, offset + limit);
    const hasMore = offset + page.length < allCandidates.length;
    const continuationToken = hasMore ? `world:${scopeDigest}:${offset + page.length}` : void 0;
    const diagnostics = missing.map((id) => ({
      code: "WORLD_MODEL_NODE_NOT_FOUND",
      severity: "error",
      message: `Geometry ${id} does not exist.`,
      nodeIds: [id],
      sourceSpanIds: []
    }));
    const unsupported = page.filter((node) => node.type === "ray" || node.type === "xline");
    diagnostics.push(...unsupported.map((node) => ({
      code: "WORLD_MODEL_UNBOUNDED_GEOMETRY",
      severity: "warning",
      message: `Unbounded geometry ${node.id} cannot form a bounded arrangement span.`,
      nodeIds: [String(node.id)],
      sourceSpanIds: []
    })));
    const unsplitDrafts = page.flatMap((node) => spansForNode(node, curveSamples));
    const drafts = splitLinearDraftsAtIntersections(unsplitDrafts, tolerance);
    const sourceSpans = drafts.map((draft) => {
      const id = stableId$1(__privateGet(this, _ports), "span", {
        drawingId: document.id,
        revision,
        nodeId: draft.sourceNodeId,
        range: draft.parameterRange,
        samples: draft.samples
      });
      return {
        id,
        sourceNodeId: draft.sourceNodeId,
        parameterRange: draft.parameterRange,
        halfEdgeIds: [`half:${id}:forward`, `half:${id}:reverse`],
        derivation: draft.derivation,
        tolerance,
        bounds: pointsBounds(draft.samples),
        samples: structuredClone(draft.samples)
      };
    });
    const vertices = [];
    const halfEdges = [];
    const vertexFor = (point, source) => {
      const existing = vertices.find((vertex2) => distance$1(vertex2.point, point) <= tolerance);
      if (existing) return existing;
      const vertex = {
        id: stableId$1(__privateGet(this, _ports), "vertex", { point: quantize(point, tolerance) }),
        point: structuredClone(point),
        incidentHalfEdgeIds: [],
        source
      };
      vertices.push(vertex);
      return vertex;
    };
    for (const span of sourceSpans) {
      const first = span.samples[0];
      const last = span.samples.at(-1);
      if (!first || !last) continue;
      const origin = vertexFor(first, distance$1(first, last) <= tolerance ? "closed-curve-anchor" : "endpoint");
      const destination = vertexFor(last, distance$1(first, last) <= tolerance ? "closed-curve-anchor" : "endpoint");
      const forward = span.halfEdgeIds[0];
      const reverse = span.halfEdgeIds[1];
      halfEdges.push(
        { id: forward, twinId: reverse, sourceSpanId: span.id, originVertexId: origin.id, destinationVertexId: destination.id, direction: "forward" },
        { id: reverse, twinId: forward, sourceSpanId: span.id, originVertexId: destination.id, destinationVertexId: origin.id, direction: "reverse" }
      );
      origin.incidentHalfEdgeIds.push(forward, reverse);
      if (destination !== origin) destination.incidentHalfEdgeIds.push(forward, reverse);
    }
    const incidenceEdges = compileIncidence(unsplitDrafts, sourceSpans, tolerance, __privateGet(this, _ports));
    const connectedEdges = compileConnectivity(document, sourceSpans, vertices, tolerance, __privateGet(this, _ports));
    const unresolved = [
      ...allCandidates.slice(0, offset).map((node) => `node:${node.id}`),
      ...allCandidates.slice(offset + page.length).map((node) => `node:${node.id}`),
      ...unsupported.map((node) => `node:${node.id}`),
      ...missing.map((id) => `node:${id}`)
    ];
    const state = unsupported.length > 0 || missing.length > 0 ? "unknown" : hasMore || offset > 0 ? "partial" : "resolved";
    const knowledge = {
      state,
      scopeDigest,
      unresolvedBoundaryRefs: [...new Set(unresolved)],
      ...continuationToken ? { continuationToken } : {}
    };
    return {
      drawingId: document.id,
      revision,
      compilerVersion: WORLD_MODEL_COMPILER_VERSION,
      inputDigest: __privateGet(this, _ports).digest(stableStringify({ document: document.geometry, request, revision })),
      frameId: ((_c = document.coordinateFrames.find(({ kind }) => kind === "document")) == null ? void 0 : _c.id) ?? "document",
      ...effectiveScopeBounds ? { scopeBounds: effectiveScopeBounds } : {},
      sourceSpans,
      vertices: vertices.sort((a, b) => a.id.localeCompare(b.id)),
      halfEdges: halfEdges.sort((a, b) => a.id.localeCompare(b.id)),
      faces: [],
      incidenceEdges,
      connectedEdges,
      diagnostics,
      knowledge,
      ...continuationToken ? { continuationToken } : {}
    };
  }
}
_ports = new WeakMap();
function spansForNode(node, curveSamples) {
  if (node.type === "ray" || node.type === "xline" || node.type === "point") return [];
  if (node.type === "line") return [{
    sourceNodeId: String(node.id),
    parameterRange: [0, 1],
    derivation: "analytic",
    samples: [structuredClone(node.start), structuredClone(node.end)]
  }];
  if (node.type === "polyline") {
    const count = Math.max(1, node.vertices.length - (node.closed ? 0 : 1));
    return Array.from({ length: count }, (_, index) => {
      const next = (index + 1) % node.vertices.length;
      return {
        sourceNodeId: String(node.id),
        parameterRange: [index / count, (index + 1) / count],
        derivation: "polyline-exact",
        samples: [structuredClone(node.vertices[index].point), structuredClone(node.vertices[next].point)]
      };
    });
  }
  const samples = sampleCurve(node, curveSamples);
  return samples.length < 2 ? [] : [{
    sourceNodeId: String(node.id),
    parameterRange: [0, 1],
    derivation: node.type === "circle" || node.type === "arc" || node.type === "ellipse" ? "analytic" : "sampled-fallback",
    samples
  }];
}
function splitLinearDraftsAtIntersections(drafts, tolerance) {
  const cuts = drafts.map(() => /* @__PURE__ */ new Set([0, 1]));
  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    const left = drafts[leftIndex];
    if (left.samples.length !== 2) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const right = drafts[rightIndex];
      if (right.sourceNodeId === left.sourceNodeId || right.samples.length !== 2) continue;
      const parameters = segmentIntersectionParameters(
        left.samples[0],
        left.samples[1],
        right.samples[0],
        right.samples[1],
        tolerance
      );
      if (!parameters) continue;
      if (parameters.left > tolerance && parameters.left < 1 - tolerance) cuts[leftIndex].add(parameters.left);
      if (parameters.right > tolerance && parameters.right < 1 - tolerance) cuts[rightIndex].add(parameters.right);
    }
  }
  return drafts.flatMap((draft, index) => {
    if (draft.samples.length !== 2) return [draft];
    const parameters = [...cuts[index]].sort((left, right) => left - right);
    return parameters.slice(0, -1).map((start, parameterIndex) => {
      const end = parameters[parameterIndex + 1];
      const rangeStart = draft.parameterRange[0] + (draft.parameterRange[1] - draft.parameterRange[0]) * start;
      const rangeEnd = draft.parameterRange[0] + (draft.parameterRange[1] - draft.parameterRange[0]) * end;
      return {
        ...draft,
        parameterRange: [rangeStart, rangeEnd],
        samples: [pointAt(draft.samples[0], draft.samples[1], start), pointAt(draft.samples[0], draft.samples[1], end)]
      };
    });
  });
}
function sampleCurve(node, count) {
  if (node.type === "spline") return structuredClone(node.controlPoints);
  if (node.type === "circle") return Array.from({ length: count + 1 }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return [node.center[0] + node.radius * Math.cos(angle), node.center[1] + node.radius * Math.sin(angle)];
  });
  if (node.type === "arc") return Array.from({ length: count + 1 }, (_, index) => {
    const start2 = node.startAngle * Math.PI / 180;
    const raw = (node.endAngle - node.startAngle) * Math.PI / 180;
    const span = node.counterClockwise ? raw : -raw;
    const angle = start2 + span * index / count;
    return [node.center[0] + node.radius * Math.cos(angle), node.center[1] + node.radius * Math.sin(angle)];
  });
  const major = node.majorAxis;
  const minor = [-major[1] * node.ratio, major[0] * node.ratio];
  const start = node.startParam ?? 0;
  const end = node.endParam ?? Math.PI * 2;
  return Array.from({ length: count + 1 }, (_, index) => {
    const parameter = start + (end - start) * index / count;
    return [
      node.center[0] + major[0] * Math.cos(parameter) + minor[0] * Math.sin(parameter),
      node.center[1] + major[1] * Math.cos(parameter) + minor[1] * Math.sin(parameter)
    ];
  });
}
function compileIncidence(drafts, spans, tolerance, ports) {
  const result = [];
  for (let leftIndex = 0; leftIndex < drafts.length; leftIndex += 1) {
    const left = drafts[leftIndex];
    if (left.samples.length !== 2) continue;
    for (let rightIndex = leftIndex + 1; rightIndex < drafts.length; rightIndex += 1) {
      const right = drafts[rightIndex];
      if (right.sourceNodeId === left.sourceNodeId || right.samples.length !== 2) continue;
      const hit = segmentIntersection(left.samples[0], left.samples[1], right.samples[0], right.samples[1], tolerance);
      if (!hit) continue;
      const sourceSpanIds = spans.filter((span) => (span.sourceNodeId === left.sourceNodeId || span.sourceNodeId === right.sourceNodeId) && (!hit.point || pointOnBounds(hit.point, span.bounds, tolerance))).map(({ id }) => id);
      result.push({
        id: stableId$1(ports, "incidence", { left: left.sourceNodeId, right: right.sourceNodeId, hit }),
        kind: hit.kind,
        nodeIds: [left.sourceNodeId, right.sourceNodeId],
        sourceSpanIds,
        ...hit.point ? { point: hit.point } : {}
      });
    }
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
function pointOnBounds(point, bounds2, tolerance) {
  return point[0] >= bounds2.minX - tolerance && point[0] <= bounds2.maxX + tolerance && point[1] >= bounds2.minY - tolerance && point[1] <= bounds2.maxY + tolerance;
}
function compileConnectivity(document, spans, vertices, tolerance, ports) {
  const byNode = /* @__PURE__ */ new Map();
  for (const span of spans) byNode.set(span.sourceNodeId, [...byNode.get(span.sourceNodeId) ?? [], span.id]);
  const result = document.relations.flatMap((relation) => {
    if (relation.type !== "topology" || relation.kind !== "connected") return [];
    const nodeIds = relation.nodeIds.filter((id) => byNode.has(id));
    return nodeIds.length < 2 ? [] : [{
      id: stableId$1(ports, "connected", { relationId: relation.id, nodeIds }),
      source: "authored",
      nodeIds,
      sourceSpanIds: nodeIds.flatMap((id) => byNode.get(id) ?? []),
      relationId: String(relation.id)
    }];
  });
  for (const vertex of vertices) {
    const nodeIds = [...new Set(spans.flatMap((span) => {
      const first = span.samples[0];
      const last = span.samples.at(-1);
      const atAuthoredStart = span.parameterRange[0] <= tolerance && first && distance$1(first, vertex.point) <= tolerance;
      const atAuthoredEnd = span.parameterRange[1] >= 1 - tolerance && last && distance$1(last, vertex.point) <= tolerance;
      return atAuthoredStart || atAuthoredEnd ? [span.sourceNodeId] : [];
    }))];
    if (nodeIds.length < 2) continue;
    const authored = result.some((edge) => nodeIds.every((id) => edge.nodeIds.includes(id)));
    if (!authored) result.push({
      id: stableId$1(ports, "connected", { point: quantize(vertex.point, tolerance), nodeIds }),
      source: "shared-endpoint",
      nodeIds,
      sourceSpanIds: nodeIds.flatMap((id) => byNode.get(id) ?? []),
      point: vertex.point
    });
  }
  return result.sort((a, b) => a.id.localeCompare(b.id));
}
function segmentIntersection(a, b, c, d, tolerance) {
  const parameters = segmentIntersectionParameters(a, b, c, d, tolerance);
  if (!parameters) return null;
  const point = pointAt(a, b, parameters.left);
  const touching = parameters.left <= tolerance || parameters.left >= 1 - tolerance || parameters.right <= tolerance || parameters.right >= 1 - tolerance;
  return { kind: touching ? "touching" : "crossing", point: cleanPoint(point) };
}
function segmentIntersectionParameters(a, b, c, d, tolerance) {
  const r = [b[0] - a[0], b[1] - a[1]];
  const s = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross(r, s);
  const offset = [c[0] - a[0], c[1] - a[1]];
  if (Math.abs(denominator) <= tolerance) return null;
  const t = cross(offset, s) / denominator;
  const u = cross(offset, r) / denominator;
  if (t < -tolerance || t > 1 + tolerance || u < -tolerance || u > 1 + tolerance) return null;
  return { left: Math.max(0, Math.min(1, t)), right: Math.max(0, Math.min(1, u)) };
}
function pointAt(start, end, parameter) {
  return cleanPoint([
    start[0] + (end[0] - start[0]) * parameter,
    start[1] + (end[1] - start[1]) * parameter
  ]);
}
function geometryBounds(node) {
  if (node.type === "point") return pointsBounds([[node.x, node.y]]);
  if (node.type === "line") return pointsBounds([node.start, node.end]);
  if (node.type === "ray" || node.type === "xline") return pointsBounds([node.origin]);
  if (node.type === "circle" || node.type === "arc") return {
    minX: node.center[0] - node.radius,
    minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius,
    maxY: node.center[1] + node.radius
  };
  if (node.type === "ellipse") {
    const radius = Math.hypot(...node.majorAxis);
    return { minX: node.center[0] - radius, minY: node.center[1] - radius, maxX: node.center[0] + radius, maxY: node.center[1] + radius };
  }
  if (node.type === "polyline") return pointsBounds(node.vertices.map(({ point }) => point));
  return pointsBounds(node.controlPoints);
}
function pointsBounds(points) {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function boundsIntersect(left, right) {
  return left.minX <= right.maxX && left.maxX >= right.minX && left.minY <= right.maxY && left.maxY >= right.minY;
}
function parseContinuation(token, scopeDigest) {
  if (!token) return 0;
  const prefix = `world:${scopeDigest}:`;
  if (!token.startsWith(prefix)) throw new Error("WORLD_MODEL_CONTINUATION_INVALID");
  const offset = Number(token.slice(prefix.length));
  if (!Number.isInteger(offset) || offset < 0) throw new Error("WORLD_MODEL_CONTINUATION_INVALID");
  return offset;
}
function unionSpatialBounds(bounds2) {
  if (bounds2.length === 0) return void 0;
  return {
    minX: Math.min(...bounds2.map((item) => item.minX)),
    minY: Math.min(...bounds2.map((item) => item.minY)),
    maxX: Math.max(...bounds2.map((item) => item.maxX)),
    maxY: Math.max(...bounds2.map((item) => item.maxY))
  };
}
function stableId$1(ports, kind, value) {
  return `${kind}_${ports.digest(stableStringify(value)).replace(/^sha256:/, "").slice(0, 24)}`;
}
function portableDigest$1(value) {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 3266489917) >>> 0;
  }
  return `sha256:${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}
function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize(child)]));
}
function integer$1(value, minimum, maximum, fallback) {
  if (value === void 0) return fallback;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error("WORLD_MODEL_REQUEST_INVALID");
  return value;
}
function positive$2(value, fallback) {
  if (value === void 0) return fallback;
  if (!Number.isFinite(value) || value <= 0) throw new Error("WORLD_MODEL_REQUEST_INVALID");
  return value;
}
function quantize(point, tolerance) {
  return [Math.round(point[0] / tolerance) * tolerance, Math.round(point[1] / tolerance) * tolerance];
}
function cleanPoint(point) {
  return [Number(point[0].toFixed(12)), Number(point[1].toFixed(12))];
}
function distance$1(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
function cross(left, right) {
  return left[0] * right[1] - left[1] * right[0];
}
function portableDigest(value) {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 3266489917) >>> 0;
  }
  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}
function sampleGeometryRanges(node, input) {
  const curveSamples = Math.max(8, Math.min(512, Math.floor(input.curveSamples)));
  switch (node.type) {
    case "point":
      return [range("whole-node", [[node.x, node.y]])];
    case "line":
      return [range("parameter-range", [node.start, node.end], { parameterRange: [0, 1] })];
    case "ray":
    case "xline": {
      const length = Math.max(
        input.localBounds.maxX - input.localBounds.minX,
        input.localBounds.maxY - input.localBounds.minY,
        1
      ) * 2;
      const magnitude = Math.hypot(node.direction[0], node.direction[1]);
      if (magnitude === 0) return [range("whole-node", [node.origin])];
      const direction = [node.direction[0] / magnitude, node.direction[1] / magnitude];
      const first = node.type === "ray" ? 0 : -length;
      return [range("parameter-range", [
        pointAlong(node.origin, direction, first),
        pointAlong(node.origin, direction, length)
      ], { parameterRange: [first, length] })];
    }
    case "polyline":
      return polylineRanges(node, curveSamples);
    case "circle":
      return sampledParameterRanges(curveSamples, (parameter) => polar$1(
        node.center,
        node.radius,
        parameter * Math.PI * 2
      ));
    case "arc": {
      const sweep = arcSweepRadians(node.startAngle, node.endAngle, node.counterClockwise);
      const count = Math.max(2, Math.ceil(curveSamples * Math.abs(sweep) / (Math.PI * 2)));
      return sampledParameterRanges(count, (parameter) => polar$1(
        node.center,
        node.radius,
        degreesToRadians(node.startAngle) + sweep * parameter
      ));
    }
    case "ellipse": {
      const start = node.startParam ?? 0;
      const rawEnd = node.endParam ?? Math.PI * 2;
      const sweep = node.startParam === void 0 && node.endParam === void 0 ? Math.PI * 2 : positiveSweep(rawEnd - start);
      const count = Math.max(2, Math.ceil(curveSamples * sweep / (Math.PI * 2)));
      return sampledParameterRanges(count, (parameter) => ellipsePoint(
        node.center,
        node.majorAxis,
        node.ratio,
        start + sweep * parameter
      ));
    }
    case "spline": {
      const count = Math.max(2, curveSamples);
      return sampledParameterRanges(count, (parameter) => splinePoint(node, parameter));
    }
  }
}
function roughGeometryBounds(node) {
  switch (node.type) {
    case "point":
      return boundsOf([[node.x, node.y]]);
    case "line":
      return boundsOf([node.start, node.end]);
    case "ray":
    case "xline":
      return null;
    case "circle":
    case "arc":
      return {
        minX: node.center[0] - node.radius,
        minY: node.center[1] - node.radius,
        maxX: node.center[0] + node.radius,
        maxY: node.center[1] + node.radius
      };
    case "ellipse": {
      const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      return {
        minX: node.center[0] - major,
        minY: node.center[1] - major,
        maxX: node.center[0] + major,
        maxY: node.center[1] + major
      };
    }
    case "polyline": {
      if (node.vertices.length === 0) return null;
      const samples = polylineRanges(node, 64).flatMap((item) => item.samples);
      return boundsOf(samples);
    }
    case "spline":
      return node.controlPoints.length > 0 ? boundsOf(node.controlPoints) : null;
  }
}
function polylineRanges(node, curveSamples) {
  const count = node.closed ? node.vertices.length : Math.max(0, node.vertices.length - 1);
  return Array.from({ length: count }, (_, index) => {
    const next = (index + 1) % node.vertices.length;
    const start = node.vertices[index].point;
    const end = node.vertices[next].point;
    const bulge = node.vertices[index].bulge ?? 0;
    const samples = Math.abs(bulge) < 1e-12 ? [start, end] : sampleBulge(start, end, bulge, curveSamples);
    return range("vertex-range", samples, { vertexRange: [index, next] });
  });
}
function sampleBulge(start, end, bulge, curveSamples) {
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1]);
  if (chord === 0) return [start, end];
  const sweep = 4 * Math.atan(bulge);
  const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const left = [-(end[1] - start[1]) / chord, (end[0] - start[0]) / chord];
  const offset = chord * (1 - bulge ** 2) / (4 * bulge);
  const center2 = [midpoint[0] + left[0] * offset, midpoint[1] + left[1] * offset];
  const radius = Math.hypot(start[0] - center2[0], start[1] - center2[1]);
  const startAngle = Math.atan2(start[1] - center2[1], start[0] - center2[0]);
  const count = Math.max(2, Math.ceil(curveSamples * Math.abs(sweep) / (Math.PI * 2)));
  return Array.from({ length: count + 1 }, (_, index) => index === count ? end : polar$1(center2, radius, startAngle + sweep * index / count));
}
function sampledParameterRanges(count, evaluate) {
  return Array.from({ length: count }, (_, index) => {
    const start = index / count;
    const end = (index + 1) / count;
    return range("parameter-range", [evaluate(start), evaluate(end)], {
      parameterRange: [start, end]
    });
  });
}
function splinePoint(node, parameter) {
  var _a3;
  const points = node.controlPoints;
  if (points.length === 0) return [0, 0];
  if (points.length === 1) return points[0];
  const degree = Math.min(node.degree, points.length - 1);
  const expectedKnotCount = points.length + degree + 1;
  if (node.knots.length !== expectedKnotCount) return controlPolygonPoint(points, parameter);
  const minimum = node.knots[degree];
  const maximum = node.knots[points.length];
  const u = parameter >= 1 ? maximum : minimum + (maximum - minimum) * parameter;
  const weights = ((_a3 = node.weights) == null ? void 0 : _a3.length) === points.length ? node.weights : points.map(() => 1);
  let weightSum = 0;
  let x = 0;
  let y = 0;
  for (let index = 0; index < points.length; index += 1) {
    const basis = bsplineBasis(index, degree, u, node.knots, maximum) * weights[index];
    weightSum += basis;
    x += basis * points[index][0];
    y += basis * points[index][1];
  }
  return weightSum === 0 ? controlPolygonPoint(points, parameter) : [x / weightSum, y / weightSum];
}
function bsplineBasis(index, degree, parameter, knots, maximum) {
  if (degree === 0) {
    return knots[index] <= parameter && (parameter < knots[index + 1] || parameter === maximum && knots[index + 1] === maximum) ? 1 : 0;
  }
  const leftDenominator = knots[index + degree] - knots[index];
  const rightDenominator = knots[index + degree + 1] - knots[index + 1];
  const left = leftDenominator === 0 ? 0 : (parameter - knots[index]) / leftDenominator * bsplineBasis(index, degree - 1, parameter, knots, maximum);
  const right = rightDenominator === 0 ? 0 : (knots[index + degree + 1] - parameter) / rightDenominator * bsplineBasis(index + 1, degree - 1, parameter, knots, maximum);
  return left + right;
}
function controlPolygonPoint(points, parameter) {
  const scaled = Math.max(0, Math.min(1, parameter)) * (points.length - 1);
  const index = Math.min(points.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return [
    points[index][0] + (points[index + 1][0] - points[index][0]) * local,
    points[index][1] + (points[index + 1][1] - points[index][1]) * local
  ];
}
function ellipsePoint(center2, majorAxis, ratio, parameter) {
  const major = Math.hypot(majorAxis[0], majorAxis[1]);
  if (major === 0) return center2;
  const unit = [majorAxis[0] / major, majorAxis[1] / major];
  const perpendicular = [-unit[1], unit[0]];
  return [
    center2[0] + unit[0] * major * Math.cos(parameter) + perpendicular[0] * major * ratio * Math.sin(parameter),
    center2[1] + unit[1] * major * Math.cos(parameter) + perpendicular[1] * major * ratio * Math.sin(parameter)
  ];
}
function range(kind, samples, identity = {}) {
  return {
    kind,
    ...identity,
    samples,
    start: samples[0],
    end: samples.at(-1),
    bounds: boundsOf(samples)
  };
}
function boundsOf(points) {
  return {
    minX: Math.min(...points.map((point) => point[0])),
    minY: Math.min(...points.map((point) => point[1])),
    maxX: Math.max(...points.map((point) => point[0])),
    maxY: Math.max(...points.map((point) => point[1]))
  };
}
function arcSweepRadians(start, end, counterClockwise) {
  const raw = degreesToRadians(end - start);
  return counterClockwise ? positiveSweep(raw) : -positiveSweep(-raw);
}
function positiveSweep(value) {
  const full = Math.PI * 2;
  const normalized = (value % full + full) % full;
  return Math.abs(normalized) < 1e-12 ? full : normalized;
}
function degreesToRadians(value) {
  return value * Math.PI / 180;
}
function polar$1(center2, radius, angle) {
  return [center2[0] + radius * Math.cos(angle), center2[1] + radius * Math.sin(angle)];
}
function pointAlong(origin, direction, parameter) {
  return [origin[0] + direction[0] * parameter, origin[1] + direction[1] * parameter];
}
const graphCache = /* @__PURE__ */ new WeakMap();
class GeometryTopologyGraph {
  constructor(revision, segments, vertices, tolerance) {
    __publicField(this, "segments");
    __publicField(this, "vertices");
    __privateAdd(this, _byNode, /* @__PURE__ */ new Map());
    __privateAdd(this, _segmentById, /* @__PURE__ */ new Map());
    __privateAdd(this, _vertexById, /* @__PURE__ */ new Map());
    this.revision = revision;
    this.tolerance = tolerance;
    this.segments = segments;
    this.vertices = vertices;
    for (const segment of segments) {
      const existing = __privateGet(this, _byNode).get(segment.nodeId) ?? [];
      __privateGet(this, _byNode).set(segment.nodeId, [...existing, segment]);
      __privateGet(this, _segmentById).set(segment.id, segment);
    }
    vertices.forEach((vertex) => __privateGet(this, _vertexById).set(vertex.id, vertex));
  }
  segmentsFor(nodeId) {
    return __privateGet(this, _byNode).get(nodeId) ?? [];
  }
  segment(id) {
    return __privateGet(this, _segmentById).get(id);
  }
  vertex(id) {
    return __privateGet(this, _vertexById).get(id);
  }
}
_byNode = new WeakMap();
_segmentById = new WeakMap();
_vertexById = new WeakMap();
function buildGeometryTopologyGraph(input) {
  var _a3;
  const curveSamples = normalizedCurveSamples(input.curveSamples);
  const samplingBounds = documentSamplingBounds(input.document);
  const tolerance = normalizedTolerance(input.tolerance, samplingBounds);
  const cacheKey = JSON.stringify({
    revision: input.revision,
    curveSamples,
    tolerance
  });
  const cached2 = (_a3 = graphCache.get(input.document)) == null ? void 0 : _a3.get(cacheKey);
  if (cached2) return cached2;
  const unresolvedSegments = input.document.geometry.flatMap((node) => sampleGeometryRanges(node, { curveSamples, localBounds: samplingBounds }).map((sample) => ({
    id: atomicId(input.revision, node.id, sample),
    revision: input.revision,
    nodeId: node.id,
    kind: sample.kind,
    ...sample.vertexRange ? { vertexRange: sample.vertexRange } : {},
    ...sample.parameterRange ? { parameterRange: sample.parameterRange } : {},
    start: sample.start,
    end: sample.end,
    bounds: sample.bounds,
    adjacentSegmentIds: [],
    samples: sample.samples
  })));
  const { segments, vertices } = resolveEndpointTopology(
    unresolvedSegments,
    input.revision,
    tolerance
  );
  connectExplicitRelations(segments, input.document);
  normalizeAdjacency(segments);
  const graph = new GeometryTopologyGraph(input.revision, segments, vertices, tolerance);
  const documentCache = graphCache.get(input.document) ?? /* @__PURE__ */ new Map();
  documentCache.set(cacheKey, graph);
  while (documentCache.size > 16) documentCache.delete(documentCache.keys().next().value);
  graphCache.set(input.document, documentCache);
  return graph;
}
function resolveEndpointTopology(unresolved, revision, tolerance) {
  const endpoints = unresolved.flatMap((segment, segmentIndex) => [
    { segmentIndex, side: "start", point: segment.start, identity: `${segment.id}:start` },
    { segmentIndex, side: "end", point: segment.end, identity: `${segment.id}:end` }
  ]);
  const parent = endpoints.map((_, index) => index);
  const buckets = /* @__PURE__ */ new Map();
  endpoints.forEach((endpoint, index) => {
    const [cellX, cellY] = endpointCell(endpoint.point, tolerance);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (const candidateIndex of buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? []) {
          if (distance(endpoint.point, endpoints[candidateIndex].point) <= tolerance) {
            union$1(parent, index, candidateIndex);
          }
        }
      }
    }
    const key = `${cellX}:${cellY}`;
    buckets.set(key, [...buckets.get(key) ?? [], index]);
  });
  const components = /* @__PURE__ */ new Map();
  endpoints.forEach((_, index) => {
    const root = find(parent, index);
    components.set(root, [...components.get(root) ?? [], index]);
  });
  const endpointVertexIds = /* @__PURE__ */ new Map();
  const vertices = [...components.values()].map((component) => {
    const identities = component.map((index) => endpoints[index].identity).sort();
    const id = `vertex_${digest$1(JSON.stringify({ revision, identities })).slice(0, 24)}`;
    const point = [
      component.reduce((sum, index) => sum + endpoints[index].point[0], 0) / component.length,
      component.reduce((sum, index) => sum + endpoints[index].point[1], 0) / component.length
    ];
    const incidentSegmentIds = unique(component.map((index) => unresolved[endpoints[index].segmentIndex].id)).sort();
    component.forEach((index) => endpointVertexIds.set(index, id));
    return { id, point, incidentSegmentIds };
  }).sort((left, right) => left.id.localeCompare(right.id));
  const segments = unresolved.map((segment, index) => {
    var _a3, _b;
    const startVertexId = endpointVertexIds.get(index * 2);
    const endVertexId = endpointVertexIds.get(index * 2 + 1);
    const adjacentSegmentIds = unique([
      ...((_a3 = vertices.find((vertex) => vertex.id === startVertexId)) == null ? void 0 : _a3.incidentSegmentIds) ?? [],
      ...((_b = vertices.find((vertex) => vertex.id === endVertexId)) == null ? void 0 : _b.incidentSegmentIds) ?? []
    ]).filter((id) => id !== segment.id);
    return { ...segment, startVertexId, endVertexId, adjacentSegmentIds };
  });
  return { segments, vertices };
}
function connectExplicitRelations(segments, document) {
  const byNode = /* @__PURE__ */ new Map();
  segments.forEach((segment) => {
    byNode.set(segment.nodeId, [...byNode.get(segment.nodeId) ?? [], segment]);
  });
  for (const relation of document.relations) {
    if (relation.plane !== "topology" || relation.kind !== "connected") continue;
    relation.nodeIds.forEach((leftId, leftIndex) => {
      relation.nodeIds.slice(leftIndex + 1).forEach((rightId) => {
        const pair2 = closestEndpointPair(byNode.get(leftId) ?? [], byNode.get(rightId) ?? []);
        if (!pair2) return;
        pair2[0].adjacentSegmentIds.push(pair2[1].id);
        pair2[1].adjacentSegmentIds.push(pair2[0].id);
      });
    });
  }
}
function closestEndpointPair(left, right) {
  let best = null;
  for (const leftSegment of left) {
    for (const rightSegment of right) {
      const separation = Math.min(
        distance(leftSegment.start, rightSegment.start),
        distance(leftSegment.start, rightSegment.end),
        distance(leftSegment.end, rightSegment.start),
        distance(leftSegment.end, rightSegment.end)
      );
      if (!best || separation < best.distance) {
        best = { pair: [leftSegment, rightSegment], distance: separation };
      }
    }
  }
  return (best == null ? void 0 : best.pair) ?? null;
}
function normalizeAdjacency(segments) {
  segments.forEach((segment) => {
    segment.adjacentSegmentIds = unique(segment.adjacentSegmentIds).filter((id) => id !== segment.id).sort();
  });
}
function documentSamplingBounds(document) {
  const finite2 = document.geometry.flatMap((node) => {
    const bounds22 = roughGeometryBounds(node);
    if (bounds22) return [bounds22];
    if (node.type === "ray" || node.type === "xline") {
      return [{
        minX: node.origin[0],
        minY: node.origin[1],
        maxX: node.origin[0],
        maxY: node.origin[1]
      }];
    }
    return [];
  });
  if (finite2.length === 0) return { minX: -1, minY: -1, maxX: 1, maxY: 1 };
  const bounds2 = {
    minX: Math.min(...finite2.map((item) => item.minX)),
    minY: Math.min(...finite2.map((item) => item.minY)),
    maxX: Math.max(...finite2.map((item) => item.maxX)),
    maxY: Math.max(...finite2.map((item) => item.maxY))
  };
  const span = Math.max(bounds2.maxX - bounds2.minX, bounds2.maxY - bounds2.minY, 1);
  return {
    minX: bounds2.minX - span,
    minY: bounds2.minY - span,
    maxX: bounds2.maxX + span,
    maxY: bounds2.maxY + span
  };
}
function normalizedTolerance(value, bounds2) {
  if (value !== void 0) {
    if (!Number.isFinite(value) || value <= 0) throw new Error("TOPOLOGY_TOLERANCE_INVALID");
    return value;
  }
  const scale2 = Math.max(
    bounds2.maxX - bounds2.minX,
    bounds2.maxY - bounds2.minY,
    Math.abs(bounds2.minX),
    Math.abs(bounds2.minY),
    Math.abs(bounds2.maxX),
    Math.abs(bounds2.maxY),
    Number.MIN_VALUE
  );
  return Math.max(scale2 * 4e-4, scale2 * Number.EPSILON * 64);
}
function normalizedCurveSamples(value) {
  const samples = value ?? 64;
  if (!Number.isFinite(samples) || samples < 2) throw new Error("TOPOLOGY_CURVE_SAMPLES_INVALID");
  return Math.max(8, Math.min(512, Math.floor(samples)));
}
function atomicId(revision, nodeId, range2) {
  return `atomic_${digest$1(JSON.stringify({
    revision,
    nodeId,
    kind: range2.kind,
    vertexRange: range2.vertexRange,
    parameterRange: range2.parameterRange
  })).slice(0, 24)}`;
}
function endpointCell(point, tolerance) {
  return [Math.floor(point[0] / tolerance), Math.floor(point[1] / tolerance)];
}
function find(parent, index) {
  if (parent[index] !== index) parent[index] = find(parent, parent[index]);
  return parent[index];
}
function union$1(parent, left, right) {
  const leftRoot = find(parent, left);
  const rightRoot = find(parent, right);
  if (leftRoot === rightRoot) return;
  if (leftRoot < rightRoot) parent[rightRoot] = leftRoot;
  else parent[leftRoot] = rightRoot;
}
function distance(left, right) {
  return Math.hypot(right[0] - left[0], right[1] - left[1]);
}
function unique(values) {
  return [...new Set(values)];
}
function digest$1(value) {
  return portableDigest(value);
}
var _a$1;
function $constructor(name, initializer2, params) {
  function init(inst, def) {
    if (!inst._zod) {
      Object.defineProperty(inst, "_zod", {
        value: {
          def,
          constr: _,
          traits: /* @__PURE__ */ new Set()
        },
        enumerable: false
      });
    }
    if (inst._zod.traits.has(name)) {
      return;
    }
    inst._zod.traits.add(name);
    initializer2(inst, def);
    const proto = _.prototype;
    const keys = Object.keys(proto);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (!(k in inst)) {
        inst[k] = proto[k].bind(inst);
      }
    }
  }
  const Parent = (params == null ? void 0 : params.Parent) ?? Object;
  class Definition extends Parent {
  }
  Object.defineProperty(Definition, "name", { value: name });
  function _(def) {
    var _a3;
    const inst = (params == null ? void 0 : params.Parent) ? new Definition() : this;
    init(inst, def);
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    for (const fn of inst._zod.deferred) {
      fn();
    }
    return inst;
  }
  Object.defineProperty(_, "init", { value: init });
  Object.defineProperty(_, Symbol.hasInstance, {
    value: (inst) => {
      var _a3, _b;
      if ((params == null ? void 0 : params.Parent) && inst instanceof params.Parent)
        return true;
      return (_b = (_a3 = inst == null ? void 0 : inst._zod) == null ? void 0 : _a3.traits) == null ? void 0 : _b.has(name);
    }
  });
  Object.defineProperty(_, "name", { value: name });
  return _;
}
class $ZodAsyncError extends Error {
  constructor() {
    super(`Encountered Promise during synchronous parse. Use .parseAsync() instead.`);
  }
}
class $ZodEncodeError extends Error {
  constructor(name) {
    super(`Encountered unidirectional transform during encode: ${name}`);
    this.name = "ZodEncodeError";
  }
}
(_a$1 = globalThis).__zod_globalConfig ?? (_a$1.__zod_globalConfig = {});
const globalConfig = globalThis.__zod_globalConfig;
function config(newConfig) {
  return globalConfig;
}
function getEnumValues(entries) {
  const numericValues = Object.values(entries).filter((v) => typeof v === "number");
  const values = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values;
}
function jsonStringifyReplacer(_, value) {
  if (typeof value === "bigint")
    return value.toString();
  return value;
}
function cached(getter) {
  return {
    get value() {
      {
        const value = getter();
        Object.defineProperty(this, "value", { value });
        return value;
      }
    }
  };
}
function nullish(input) {
  return input === null || input === void 0;
}
function cleanRegex(source) {
  const start = source.startsWith("^") ? 1 : 0;
  const end = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start, end);
}
function floatSafeRemainder(val, step) {
  const ratio = val / step;
  const roundedRatio = Math.round(ratio);
  const tolerance = Number.EPSILON * Math.max(Math.abs(ratio), 1);
  if (Math.abs(ratio - roundedRatio) < tolerance)
    return 0;
  return ratio - roundedRatio;
}
const EVALUATING = /* @__PURE__ */ Symbol("evaluating");
function defineLazy(object2, key, getter) {
  let value = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value === EVALUATING) {
        return void 0;
      }
      if (value === void 0) {
        value = EVALUATING;
        value = getter();
      }
      return value;
    },
    set(v) {
      Object.defineProperty(object2, key, {
        value: v
        // configurable: true,
      });
    },
    configurable: true
  });
}
function assignProp(target, prop, value) {
  Object.defineProperty(target, prop, {
    value,
    writable: true,
    enumerable: true,
    configurable: true
  });
}
function mergeDefs(...defs) {
  const mergedDescriptors = {};
  for (const def of defs) {
    const descriptors = Object.getOwnPropertyDescriptors(def);
    Object.assign(mergedDescriptors, descriptors);
  }
  return Object.defineProperties({}, mergedDescriptors);
}
function esc(str) {
  return JSON.stringify(str);
}
function slugify(input) {
  return input.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");
}
const captureStackTrace = "captureStackTrace" in Error ? Error.captureStackTrace : (..._args) => {
};
function isObject(data) {
  return typeof data === "object" && data !== null && !Array.isArray(data);
}
const allowsEval = /* @__PURE__ */ cached(() => {
  var _a3;
  if (globalConfig.jitless) {
    return false;
  }
  if (typeof navigator !== "undefined" && ((_a3 = navigator == null ? void 0 : navigator.userAgent) == null ? void 0 : _a3.includes("Cloudflare"))) {
    return false;
  }
  try {
    const F = Function;
    new F("");
    return true;
  } catch (_) {
    return false;
  }
});
function isPlainObject(o) {
  if (isObject(o) === false)
    return false;
  const ctor = o.constructor;
  if (ctor === void 0)
    return true;
  if (typeof ctor !== "function")
    return true;
  const prot = ctor.prototype;
  if (isObject(prot) === false)
    return false;
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }
  return true;
}
function shallowClone(o) {
  if (isPlainObject(o))
    return { ...o };
  if (Array.isArray(o))
    return [...o];
  if (o instanceof Map)
    return new Map(o);
  if (o instanceof Set)
    return new Set(o);
  return o;
}
const propertyKeyTypes = /* @__PURE__ */ new Set(["string", "number", "symbol"]);
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function clone(inst, def, params) {
  const cl = new inst._zod.constr(def ?? inst._zod.def);
  if (!def || (params == null ? void 0 : params.parent))
    cl._zod.parent = inst;
  return cl;
}
function normalizeParams(_params) {
  const params = _params;
  if (!params)
    return {};
  if (typeof params === "string")
    return { error: () => params };
  if ((params == null ? void 0 : params.message) !== void 0) {
    if ((params == null ? void 0 : params.error) !== void 0)
      throw new Error("Cannot specify both `message` and `error` params");
    params.error = params.message;
  }
  delete params.message;
  if (typeof params.error === "string")
    return { ...params, error: () => params.error };
  return params;
}
function optionalKeys(shape) {
  return Object.keys(shape).filter((k) => {
    return shape[k]._zod.optin === "optional" && shape[k]._zod.optout === "optional";
  });
}
const NUMBER_FORMAT_RANGES = {
  safeint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER],
  int32: [-2147483648, 2147483647],
  uint32: [0, 4294967295],
  float32: [-34028234663852886e22, 34028234663852886e22],
  float64: [-Number.MAX_VALUE, Number.MAX_VALUE]
};
function pick(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".pick() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = {};
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        newShape[key] = currDef.shape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function omit(schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".omit() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const newShape = { ...schema._zod.def.shape };
      for (const key in mask) {
        if (!(key in currDef.shape)) {
          throw new Error(`Unrecognized key: "${key}"`);
        }
        if (!mask[key])
          continue;
        delete newShape[key];
      }
      assignProp(this, "shape", newShape);
      return newShape;
    },
    checks: []
  });
  return clone(schema, def);
}
function extend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to extend: expected a plain object");
  }
  const checks = schema._zod.def.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    const existingShape = schema._zod.def.shape;
    for (const key in shape) {
      if (Object.getOwnPropertyDescriptor(existingShape, key) !== void 0) {
        throw new Error("Cannot overwrite keys on object schemas containing refinements. Use `.safeExtend()` instead.");
      }
    }
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function safeExtend(schema, shape) {
  if (!isPlainObject(shape)) {
    throw new Error("Invalid input to safeExtend: expected a plain object");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const _shape = { ...schema._zod.def.shape, ...shape };
      assignProp(this, "shape", _shape);
      return _shape;
    }
  });
  return clone(schema, def);
}
function merge(a, b) {
  var _a3;
  if ((_a3 = a._zod.def.checks) == null ? void 0 : _a3.length) {
    throw new Error(".merge() cannot be used on object schemas containing refinements. Use .safeExtend() instead.");
  }
  const def = mergeDefs(a._zod.def, {
    get shape() {
      const _shape = { ...a._zod.def.shape, ...b._zod.def.shape };
      assignProp(this, "shape", _shape);
      return _shape;
    },
    get catchall() {
      return b._zod.def.catchall;
    },
    checks: b._zod.def.checks ?? []
  });
  return clone(a, def);
}
function partial(Class, schema, mask) {
  const currDef = schema._zod.def;
  const checks = currDef.checks;
  const hasChecks = checks && checks.length > 0;
  if (hasChecks) {
    throw new Error(".partial() cannot be used on object schemas containing refinements");
  }
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in oldShape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      } else {
        for (const key in oldShape) {
          shape[key] = Class ? new Class({
            type: "optional",
            innerType: oldShape[key]
          }) : oldShape[key];
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    },
    checks: []
  });
  return clone(schema, def);
}
function required(Class, schema, mask) {
  const def = mergeDefs(schema._zod.def, {
    get shape() {
      const oldShape = schema._zod.def.shape;
      const shape = { ...oldShape };
      if (mask) {
        for (const key in mask) {
          if (!(key in shape)) {
            throw new Error(`Unrecognized key: "${key}"`);
          }
          if (!mask[key])
            continue;
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      } else {
        for (const key in oldShape) {
          shape[key] = new Class({
            type: "nonoptional",
            innerType: oldShape[key]
          });
        }
      }
      assignProp(this, "shape", shape);
      return shape;
    }
  });
  return clone(schema, def);
}
function aborted(x, startIndex = 0) {
  var _a3;
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (((_a3 = x.issues[i]) == null ? void 0 : _a3.continue) !== true) {
      return true;
    }
  }
  return false;
}
function explicitlyAborted(x, startIndex = 0) {
  var _a3;
  if (x.aborted === true)
    return true;
  for (let i = startIndex; i < x.issues.length; i++) {
    if (((_a3 = x.issues[i]) == null ? void 0 : _a3.continue) === false) {
      return true;
    }
  }
  return false;
}
function prefixIssues(path, issues) {
  return issues.map((iss) => {
    var _a3;
    (_a3 = iss).path ?? (_a3.path = []);
    iss.path.unshift(path);
    return iss;
  });
}
function unwrapMessage(message) {
  return typeof message === "string" ? message : message == null ? void 0 : message.message;
}
function finalizeIssue(iss, ctx, config2) {
  var _a3, _b, _c, _d, _e, _f;
  const message = iss.message ? iss.message : unwrapMessage((_c = (_b = (_a3 = iss.inst) == null ? void 0 : _a3._zod.def) == null ? void 0 : _b.error) == null ? void 0 : _c.call(_b, iss)) ?? unwrapMessage((_d = ctx == null ? void 0 : ctx.error) == null ? void 0 : _d.call(ctx, iss)) ?? unwrapMessage((_e = config2.customError) == null ? void 0 : _e.call(config2, iss)) ?? unwrapMessage((_f = config2.localeError) == null ? void 0 : _f.call(config2, iss)) ?? "Invalid input";
  const { inst: _inst, continue: _continue, input: _input, ...rest } = iss;
  rest.path ?? (rest.path = []);
  rest.message = message;
  if (ctx == null ? void 0 : ctx.reportInput) {
    rest.input = _input;
  }
  return rest;
}
function getLengthableOrigin(input) {
  if (Array.isArray(input))
    return "array";
  if (typeof input === "string")
    return "string";
  return "unknown";
}
function issue(...args) {
  const [iss, input, inst] = args;
  if (typeof iss === "string") {
    return {
      message: iss,
      code: "custom",
      input,
      inst
    };
  }
  return { ...iss };
}
const initializer$1 = (inst, def) => {
  inst.name = "$ZodError";
  Object.defineProperty(inst, "_zod", {
    value: inst._zod,
    enumerable: false
  });
  Object.defineProperty(inst, "issues", {
    value: def,
    enumerable: false
  });
  inst.message = JSON.stringify(def, jsonStringifyReplacer, 2);
  Object.defineProperty(inst, "toString", {
    value: () => inst.message,
    enumerable: false
  });
};
const $ZodError = $constructor("$ZodError", initializer$1);
const $ZodRealError = $constructor("$ZodError", initializer$1, { Parent: Error });
function flattenError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = {};
  const formErrors = [];
  for (const sub of error.issues) {
    if (sub.path.length > 0) {
      fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
      fieldErrors[sub.path[0]].push(mapper(sub));
    } else {
      formErrors.push(mapper(sub));
    }
  }
  return { formErrors, fieldErrors };
}
function formatError(error, mapper = (issue2) => issue2.message) {
  const fieldErrors = { _errors: [] };
  const processError = (error2, path = []) => {
    for (const issue2 of error2.issues) {
      if (issue2.code === "invalid_union" && issue2.errors.length) {
        issue2.errors.map((issues) => processError({ issues }, [...path, ...issue2.path]));
      } else if (issue2.code === "invalid_key") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else if (issue2.code === "invalid_element") {
        processError({ issues: issue2.issues }, [...path, ...issue2.path]);
      } else {
        const fullpath = [...path, ...issue2.path];
        if (fullpath.length === 0) {
          fieldErrors._errors.push(mapper(issue2));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < fullpath.length) {
            const el = fullpath[i];
            const terminal = i === fullpath.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue2));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }
  };
  processError(error);
  return fieldErrors;
}
const _parse = (_Err) => (schema, value, _ctx, _params) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  if (result.issues.length) {
    const e = new ((_params == null ? void 0 : _params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, _params == null ? void 0 : _params.callee);
    throw e;
  }
  return result.value;
};
const _parseAsync = (_Err) => async (schema, value, _ctx, params) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new ((params == null ? void 0 : params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params == null ? void 0 : params.callee);
    throw e;
  }
  return result.value;
};
const _safeParse = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parse(_Err)(schema, value, ctx);
};
const _decode = (_Err) => (schema, value, _ctx) => {
  return _parse(_Err)(schema, value, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parseAsync(_Err)(schema, value, ctx);
};
const _decodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _parseAsync(_Err)(schema, value, _ctx);
};
const _safeEncode = (_Err) => (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value, ctx);
};
const _safeDecode = (_Err) => (schema, value, _ctx) => {
  return _safeParse(_Err)(schema, value, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value, _ctx) => {
  return _safeParseAsync(_Err)(schema, value, _ctx);
};
const cuid = /^[cC][0-9a-z]{6,}$/;
const cuid2 = /^[0-9a-z]+$/;
const ulid = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const xid = /^[0-9a-vA-V]{20}$/;
const ksuid = /^[A-Za-z0-9]{27}$/;
const nanoid = /^[a-zA-Z0-9_-]{21}$/;
const duration$1 = /^P(?:(\d+W)|(?!.*W)(?=\d|T\d)(\d+Y)?(\d+M)?(\d+D)?(T(?=\d)(\d+H)?(\d+M)?(\d+([.,]\d+)?S)?)?)$/;
const guid = /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/;
const uuid = (version2) => {
  if (!version2)
    return /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/;
  return new RegExp(`^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-${version2}[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12})$`);
};
const email = /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\-]*\.)+[A-Za-z]{2,}$/;
const _emoji$1 = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
function emoji() {
  return new RegExp(_emoji$1, "u");
}
const ipv4 = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
const ipv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:))$/;
const cidrv4 = /^((25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/([0-9]|[1-2][0-9]|3[0-2])$/;
const cidrv6 = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|::|([0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:?){0,6})\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
const base64 = /^$|^(?:[0-9a-zA-Z+/]{4})*(?:(?:[0-9a-zA-Z+/]{2}==)|(?:[0-9a-zA-Z+/]{3}=))?$/;
const base64url = /^[A-Za-z0-9_-]*$/;
const httpProtocol = /^https?$/;
const e164 = /^\+[1-9]\d{6,14}$/;
const dateSource = `(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))`;
const date$1 = /* @__PURE__ */ new RegExp(`^${dateSource}$`);
function timeSource(args) {
  const hhmm = `(?:[01]\\d|2[0-3]):[0-5]\\d`;
  const regex = typeof args.precision === "number" ? args.precision === -1 ? `${hhmm}` : args.precision === 0 ? `${hhmm}:[0-5]\\d` : `${hhmm}:[0-5]\\d\\.\\d{${args.precision}}` : `${hhmm}(?::[0-5]\\d(?:\\.\\d+)?)?`;
  return regex;
}
function time$1(args) {
  return new RegExp(`^${timeSource(args)}$`);
}
function datetime$1(args) {
  const time2 = timeSource({ precision: args.precision });
  const opts = ["Z"];
  if (args.local)
    opts.push("");
  if (args.offset)
    opts.push(`([+-](?:[01]\\d|2[0-3]):[0-5]\\d)`);
  const timeRegex = `${time2}(?:${opts.join("|")})`;
  return new RegExp(`^${dateSource}T(?:${timeRegex})$`);
}
const string$1 = (params) => {
  const regex = params ? `[\\s\\S]{${(params == null ? void 0 : params.minimum) ?? 0},${(params == null ? void 0 : params.maximum) ?? ""}}` : `[\\s\\S]*`;
  return new RegExp(`^${regex}$`);
};
const integer = /^-?\d+$/;
const number$1 = /^-?\d+(?:\.\d+)?$/;
const boolean$1 = /^(?:true|false)$/i;
const lowercase = /^[^A-Z]*$/;
const uppercase = /^[^a-z]*$/;
const $ZodCheck = /* @__PURE__ */ $constructor("$ZodCheck", (inst, def) => {
  var _a3;
  inst._zod ?? (inst._zod = {});
  inst._zod.def = def;
  (_a3 = inst._zod).onattach ?? (_a3.onattach = []);
});
const numericOriginMap = {
  number: "number",
  bigint: "bigint",
  object: "date"
};
const $ZodCheckLessThan = /* @__PURE__ */ $constructor("$ZodCheckLessThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.maximum : bag.exclusiveMaximum) ?? Number.POSITIVE_INFINITY;
    if (def.value < curr) {
      if (def.inclusive)
        bag.maximum = def.value;
      else
        bag.exclusiveMaximum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value <= def.value : payload.value < def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckGreaterThan = /* @__PURE__ */ $constructor("$ZodCheckGreaterThan", (inst, def) => {
  $ZodCheck.init(inst, def);
  const origin = numericOriginMap[typeof def.value];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    const curr = (def.inclusive ? bag.minimum : bag.exclusiveMinimum) ?? Number.NEGATIVE_INFINITY;
    if (def.value > curr) {
      if (def.inclusive)
        bag.minimum = def.value;
      else
        bag.exclusiveMinimum = def.value;
    }
  });
  inst._zod.check = (payload) => {
    if (def.inclusive ? payload.value >= def.value : payload.value > def.value) {
      return;
    }
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: typeof def.value === "object" ? def.value.getTime() : def.value,
      input: payload.value,
      inclusive: def.inclusive,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMultipleOf = /* @__PURE__ */ $constructor("$ZodCheckMultipleOf", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    var _a3;
    (_a3 = inst2._zod.bag).multipleOf ?? (_a3.multipleOf = def.value);
  });
  inst._zod.check = (payload) => {
    if (typeof payload.value !== typeof def.value)
      throw new Error("Cannot mix number and bigint in multiple_of check.");
    const isMultiple = typeof payload.value === "bigint" ? payload.value % def.value === BigInt(0) : floatSafeRemainder(payload.value, def.value) === 0;
    if (isMultiple)
      return;
    payload.issues.push({
      origin: typeof payload.value,
      code: "not_multiple_of",
      divisor: def.value,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckNumberFormat = /* @__PURE__ */ $constructor("$ZodCheckNumberFormat", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  def.format = def.format || "float64";
  const isInt = (_a3 = def.format) == null ? void 0 : _a3.includes("int");
  const origin = isInt ? "int" : "number";
  const [minimum, maximum] = NUMBER_FORMAT_RANGES[def.format];
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    bag.minimum = minimum;
    bag.maximum = maximum;
    if (isInt)
      bag.pattern = integer;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    if (isInt) {
      if (!Number.isInteger(input)) {
        payload.issues.push({
          expected: origin,
          format: def.format,
          code: "invalid_type",
          continue: false,
          input,
          inst
        });
        return;
      }
      if (!Number.isSafeInteger(input)) {
        if (input > 0) {
          payload.issues.push({
            input,
            code: "too_big",
            maximum: Number.MAX_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        } else {
          payload.issues.push({
            input,
            code: "too_small",
            minimum: Number.MIN_SAFE_INTEGER,
            note: "Integers must be within the safe integer range.",
            inst,
            origin,
            inclusive: true,
            continue: !def.abort
          });
        }
        return;
      }
    }
    if (input < minimum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_small",
        minimum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
    if (input > maximum) {
      payload.issues.push({
        origin: "number",
        input,
        code: "too_big",
        maximum,
        inclusive: true,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCheckMaxLength = /* @__PURE__ */ $constructor("$ZodCheckMaxLength", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.maximum ?? Number.POSITIVE_INFINITY;
    if (def.maximum < curr)
      inst2._zod.bag.maximum = def.maximum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length <= def.maximum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_big",
      maximum: def.maximum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckMinLength = /* @__PURE__ */ $constructor("$ZodCheckMinLength", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const curr = inst2._zod.bag.minimum ?? Number.NEGATIVE_INFINITY;
    if (def.minimum > curr)
      inst2._zod.bag.minimum = def.minimum;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length >= def.minimum)
      return;
    const origin = getLengthableOrigin(input);
    payload.issues.push({
      origin,
      code: "too_small",
      minimum: def.minimum,
      inclusive: true,
      input,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLengthEquals = /* @__PURE__ */ $constructor("$ZodCheckLengthEquals", (inst, def) => {
  var _a3;
  $ZodCheck.init(inst, def);
  (_a3 = inst._zod.def).when ?? (_a3.when = (payload) => {
    const val = payload.value;
    return !nullish(val) && val.length !== void 0;
  });
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.minimum = def.length;
    bag.maximum = def.length;
    bag.length = def.length;
  });
  inst._zod.check = (payload) => {
    const input = payload.value;
    const length = input.length;
    if (length === def.length)
      return;
    const origin = getLengthableOrigin(input);
    const tooBig = length > def.length;
    payload.issues.push({
      origin,
      ...tooBig ? { code: "too_big", maximum: def.length } : { code: "too_small", minimum: def.length },
      inclusive: true,
      exact: true,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStringFormat = /* @__PURE__ */ $constructor("$ZodCheckStringFormat", (inst, def) => {
  var _a3, _b;
  $ZodCheck.init(inst, def);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.format = def.format;
    if (def.pattern) {
      bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
      bag.patterns.add(def.pattern);
    }
  });
  if (def.pattern)
    (_a3 = inst._zod).check ?? (_a3.check = (payload) => {
      def.pattern.lastIndex = 0;
      if (def.pattern.test(payload.value))
        return;
      payload.issues.push({
        origin: "string",
        code: "invalid_format",
        format: def.format,
        input: payload.value,
        ...def.pattern ? { pattern: def.pattern.toString() } : {},
        inst,
        continue: !def.abort
      });
    });
  else
    (_b = inst._zod).check ?? (_b.check = () => {
    });
});
const $ZodCheckRegex = /* @__PURE__ */ $constructor("$ZodCheckRegex", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    def.pattern.lastIndex = 0;
    if (def.pattern.test(payload.value))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "regex",
      input: payload.value,
      pattern: def.pattern.toString(),
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckLowerCase = /* @__PURE__ */ $constructor("$ZodCheckLowerCase", (inst, def) => {
  def.pattern ?? (def.pattern = lowercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckUpperCase = /* @__PURE__ */ $constructor("$ZodCheckUpperCase", (inst, def) => {
  def.pattern ?? (def.pattern = uppercase);
  $ZodCheckStringFormat.init(inst, def);
});
const $ZodCheckIncludes = /* @__PURE__ */ $constructor("$ZodCheckIncludes", (inst, def) => {
  $ZodCheck.init(inst, def);
  const escapedRegex = escapeRegex(def.includes);
  const pattern = new RegExp(typeof def.position === "number" ? `^.{${def.position}}${escapedRegex}` : escapedRegex);
  def.pattern = pattern;
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.includes(def.includes, def.position))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "includes",
      includes: def.includes,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckStartsWith = /* @__PURE__ */ $constructor("$ZodCheckStartsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`^${escapeRegex(def.prefix)}.*`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.startsWith(def.prefix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "starts_with",
      prefix: def.prefix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckEndsWith = /* @__PURE__ */ $constructor("$ZodCheckEndsWith", (inst, def) => {
  $ZodCheck.init(inst, def);
  const pattern = new RegExp(`.*${escapeRegex(def.suffix)}$`);
  def.pattern ?? (def.pattern = pattern);
  inst._zod.onattach.push((inst2) => {
    const bag = inst2._zod.bag;
    bag.patterns ?? (bag.patterns = /* @__PURE__ */ new Set());
    bag.patterns.add(pattern);
  });
  inst._zod.check = (payload) => {
    if (payload.value.endsWith(def.suffix))
      return;
    payload.issues.push({
      origin: "string",
      code: "invalid_format",
      format: "ends_with",
      suffix: def.suffix,
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodCheckOverwrite = /* @__PURE__ */ $constructor("$ZodCheckOverwrite", (inst, def) => {
  $ZodCheck.init(inst, def);
  inst._zod.check = (payload) => {
    payload.value = def.tx(payload.value);
  };
});
class Doc {
  constructor(args = []) {
    this.content = [];
    this.indent = 0;
    if (this)
      this.args = args;
  }
  indented(fn) {
    this.indent += 1;
    fn(this);
    this.indent -= 1;
  }
  write(arg) {
    if (typeof arg === "function") {
      arg(this, { execution: "sync" });
      arg(this, { execution: "async" });
      return;
    }
    const content = arg;
    const lines = content.split("\n").filter((x) => x);
    const minIndent = Math.min(...lines.map((x) => x.length - x.trimStart().length));
    const dedented = lines.map((x) => x.slice(minIndent)).map((x) => " ".repeat(this.indent * 2) + x);
    for (const line of dedented) {
      this.content.push(line);
    }
  }
  compile() {
    const F = Function;
    const args = this == null ? void 0 : this.args;
    const content = (this == null ? void 0 : this.content) ?? [``];
    const lines = [...content.map((x) => `  ${x}`)];
    return new F(...args, lines.join("\n"));
  }
}
const version = {
  major: 4,
  minor: 4,
  patch: 3
};
const $ZodType = /* @__PURE__ */ $constructor("$ZodType", (inst, def) => {
  var _a4;
  var _a3;
  inst ?? (inst = {});
  inst._zod.def = def;
  inst._zod.bag = inst._zod.bag || {};
  inst._zod.version = version;
  const checks = [...inst._zod.def.checks ?? []];
  if (inst._zod.traits.has("$ZodCheck")) {
    checks.unshift(inst);
  }
  for (const ch of checks) {
    for (const fn of ch._zod.onattach) {
      fn(inst);
    }
  }
  if (checks.length === 0) {
    (_a3 = inst._zod).deferred ?? (_a3.deferred = []);
    (_a4 = inst._zod.deferred) == null ? void 0 : _a4.push(() => {
      inst._zod.run = inst._zod.parse;
    });
  } else {
    const runChecks = (payload, checks2, ctx) => {
      let isAborted = aborted(payload);
      let asyncResult;
      for (const ch of checks2) {
        if (ch._zod.def.when) {
          if (explicitlyAborted(payload))
            continue;
          const shouldRun = ch._zod.def.when(payload);
          if (!shouldRun)
            continue;
        } else if (isAborted) {
          continue;
        }
        const currLen = payload.issues.length;
        const _ = ch._zod.check(payload);
        if (_ instanceof Promise && (ctx == null ? void 0 : ctx.async) === false) {
          throw new $ZodAsyncError();
        }
        if (asyncResult || _ instanceof Promise) {
          asyncResult = (asyncResult ?? Promise.resolve()).then(async () => {
            await _;
            const nextLen = payload.issues.length;
            if (nextLen === currLen)
              return;
            if (!isAborted)
              isAborted = aborted(payload, currLen);
          });
        } else {
          const nextLen = payload.issues.length;
          if (nextLen === currLen)
            continue;
          if (!isAborted)
            isAborted = aborted(payload, currLen);
        }
      }
      if (asyncResult) {
        return asyncResult.then(() => {
          return payload;
        });
      }
      return payload;
    };
    const handleCanaryResult = (canary, payload, ctx) => {
      if (aborted(canary)) {
        canary.aborted = true;
        return canary;
      }
      const checkResult = runChecks(payload, checks, ctx);
      if (checkResult instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return checkResult.then((checkResult2) => inst._zod.parse(checkResult2, ctx));
      }
      return inst._zod.parse(checkResult, ctx);
    };
    inst._zod.run = (payload, ctx) => {
      if (ctx.skipChecks) {
        return inst._zod.parse(payload, ctx);
      }
      if (ctx.direction === "backward") {
        const canary = inst._zod.parse({ value: payload.value, issues: [] }, { ...ctx, skipChecks: true });
        if (canary instanceof Promise) {
          return canary.then((canary2) => {
            return handleCanaryResult(canary2, payload, ctx);
          });
        }
        return handleCanaryResult(canary, payload, ctx);
      }
      const result = inst._zod.parse(payload, ctx);
      if (result instanceof Promise) {
        if (ctx.async === false)
          throw new $ZodAsyncError();
        return result.then((result2) => runChecks(result2, checks, ctx));
      }
      return runChecks(result, checks, ctx);
    };
  }
  defineLazy(inst, "~standard", () => ({
    validate: (value) => {
      var _a5;
      try {
        const r = safeParse$1(inst, value);
        return r.success ? { value: r.data } : { issues: (_a5 = r.error) == null ? void 0 : _a5.issues };
      } catch (_) {
        return safeParseAsync$1(inst, value).then((r) => {
          var _a6;
          return r.success ? { value: r.data } : { issues: (_a6 = r.error) == null ? void 0 : _a6.issues };
        });
      }
    },
    vendor: "zod",
    version: 1
  }));
});
const $ZodString = /* @__PURE__ */ $constructor("$ZodString", (inst, def) => {
  var _a3;
  $ZodType.init(inst, def);
  inst._zod.pattern = [...((_a3 = inst == null ? void 0 : inst._zod.bag) == null ? void 0 : _a3.patterns) ?? []].pop() ?? string$1(inst._zod.bag);
  inst._zod.parse = (payload, _) => {
    if (def.coerce)
      try {
        payload.value = String(payload.value);
      } catch (_2) {
      }
    if (typeof payload.value === "string")
      return payload;
    payload.issues.push({
      expected: "string",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
const $ZodStringFormat = /* @__PURE__ */ $constructor("$ZodStringFormat", (inst, def) => {
  $ZodCheckStringFormat.init(inst, def);
  $ZodString.init(inst, def);
});
const $ZodGUID = /* @__PURE__ */ $constructor("$ZodGUID", (inst, def) => {
  def.pattern ?? (def.pattern = guid);
  $ZodStringFormat.init(inst, def);
});
const $ZodUUID = /* @__PURE__ */ $constructor("$ZodUUID", (inst, def) => {
  if (def.version) {
    const versionMap = {
      v1: 1,
      v2: 2,
      v3: 3,
      v4: 4,
      v5: 5,
      v6: 6,
      v7: 7,
      v8: 8
    };
    const v = versionMap[def.version];
    if (v === void 0)
      throw new Error(`Invalid UUID version: "${def.version}"`);
    def.pattern ?? (def.pattern = uuid(v));
  } else
    def.pattern ?? (def.pattern = uuid());
  $ZodStringFormat.init(inst, def);
});
const $ZodEmail = /* @__PURE__ */ $constructor("$ZodEmail", (inst, def) => {
  def.pattern ?? (def.pattern = email);
  $ZodStringFormat.init(inst, def);
});
const $ZodURL = /* @__PURE__ */ $constructor("$ZodURL", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    var _a3;
    try {
      const trimmed = payload.value.trim();
      if (!def.normalize && ((_a3 = def.protocol) == null ? void 0 : _a3.source) === httpProtocol.source) {
        if (!/^https?:\/\//i.test(trimmed)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid URL format",
            input: payload.value,
            inst,
            continue: !def.abort
          });
          return;
        }
      }
      const url = new URL(trimmed);
      if (def.hostname) {
        def.hostname.lastIndex = 0;
        if (!def.hostname.test(url.hostname)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid hostname",
            pattern: def.hostname.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.protocol) {
        def.protocol.lastIndex = 0;
        if (!def.protocol.test(url.protocol.endsWith(":") ? url.protocol.slice(0, -1) : url.protocol)) {
          payload.issues.push({
            code: "invalid_format",
            format: "url",
            note: "Invalid protocol",
            pattern: def.protocol.source,
            input: payload.value,
            inst,
            continue: !def.abort
          });
        }
      }
      if (def.normalize) {
        payload.value = url.href;
      } else {
        payload.value = trimmed;
      }
      return;
    } catch (_) {
      payload.issues.push({
        code: "invalid_format",
        format: "url",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodEmoji = /* @__PURE__ */ $constructor("$ZodEmoji", (inst, def) => {
  def.pattern ?? (def.pattern = emoji());
  $ZodStringFormat.init(inst, def);
});
const $ZodNanoID = /* @__PURE__ */ $constructor("$ZodNanoID", (inst, def) => {
  def.pattern ?? (def.pattern = nanoid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID = /* @__PURE__ */ $constructor("$ZodCUID", (inst, def) => {
  def.pattern ?? (def.pattern = cuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodCUID2 = /* @__PURE__ */ $constructor("$ZodCUID2", (inst, def) => {
  def.pattern ?? (def.pattern = cuid2);
  $ZodStringFormat.init(inst, def);
});
const $ZodULID = /* @__PURE__ */ $constructor("$ZodULID", (inst, def) => {
  def.pattern ?? (def.pattern = ulid);
  $ZodStringFormat.init(inst, def);
});
const $ZodXID = /* @__PURE__ */ $constructor("$ZodXID", (inst, def) => {
  def.pattern ?? (def.pattern = xid);
  $ZodStringFormat.init(inst, def);
});
const $ZodKSUID = /* @__PURE__ */ $constructor("$ZodKSUID", (inst, def) => {
  def.pattern ?? (def.pattern = ksuid);
  $ZodStringFormat.init(inst, def);
});
const $ZodISODateTime = /* @__PURE__ */ $constructor("$ZodISODateTime", (inst, def) => {
  def.pattern ?? (def.pattern = datetime$1(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODate = /* @__PURE__ */ $constructor("$ZodISODate", (inst, def) => {
  def.pattern ?? (def.pattern = date$1);
  $ZodStringFormat.init(inst, def);
});
const $ZodISOTime = /* @__PURE__ */ $constructor("$ZodISOTime", (inst, def) => {
  def.pattern ?? (def.pattern = time$1(def));
  $ZodStringFormat.init(inst, def);
});
const $ZodISODuration = /* @__PURE__ */ $constructor("$ZodISODuration", (inst, def) => {
  def.pattern ?? (def.pattern = duration$1);
  $ZodStringFormat.init(inst, def);
});
const $ZodIPv4 = /* @__PURE__ */ $constructor("$ZodIPv4", (inst, def) => {
  def.pattern ?? (def.pattern = ipv4);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv4`;
});
const $ZodIPv6 = /* @__PURE__ */ $constructor("$ZodIPv6", (inst, def) => {
  def.pattern ?? (def.pattern = ipv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.format = `ipv6`;
  inst._zod.check = (payload) => {
    try {
      new URL(`http://[${payload.value}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "ipv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
const $ZodCIDRv4 = /* @__PURE__ */ $constructor("$ZodCIDRv4", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv4);
  $ZodStringFormat.init(inst, def);
});
const $ZodCIDRv6 = /* @__PURE__ */ $constructor("$ZodCIDRv6", (inst, def) => {
  def.pattern ?? (def.pattern = cidrv6);
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    const parts = payload.value.split("/");
    try {
      if (parts.length !== 2)
        throw new Error();
      const [address, prefix] = parts;
      if (!prefix)
        throw new Error();
      const prefixNum = Number(prefix);
      if (`${prefixNum}` !== prefix)
        throw new Error();
      if (prefixNum < 0 || prefixNum > 128)
        throw new Error();
      new URL(`http://[${address}]`);
    } catch {
      payload.issues.push({
        code: "invalid_format",
        format: "cidrv6",
        input: payload.value,
        inst,
        continue: !def.abort
      });
    }
  };
});
function isValidBase64(data) {
  if (data === "")
    return true;
  if (/\s/.test(data))
    return false;
  if (data.length % 4 !== 0)
    return false;
  try {
    atob(data);
    return true;
  } catch {
    return false;
  }
}
const $ZodBase64 = /* @__PURE__ */ $constructor("$ZodBase64", (inst, def) => {
  def.pattern ?? (def.pattern = base64);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64";
  inst._zod.check = (payload) => {
    if (isValidBase64(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
function isValidBase64URL(data) {
  if (!base64url.test(data))
    return false;
  const base642 = data.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  const padded = base642.padEnd(Math.ceil(base642.length / 4) * 4, "=");
  return isValidBase64(padded);
}
const $ZodBase64URL = /* @__PURE__ */ $constructor("$ZodBase64URL", (inst, def) => {
  def.pattern ?? (def.pattern = base64url);
  $ZodStringFormat.init(inst, def);
  inst._zod.bag.contentEncoding = "base64url";
  inst._zod.check = (payload) => {
    if (isValidBase64URL(payload.value))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "base64url",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodE164 = /* @__PURE__ */ $constructor("$ZodE164", (inst, def) => {
  def.pattern ?? (def.pattern = e164);
  $ZodStringFormat.init(inst, def);
});
function isValidJWT(token, algorithm = null) {
  try {
    const tokensParts = token.split(".");
    if (tokensParts.length !== 3)
      return false;
    const [header] = tokensParts;
    if (!header)
      return false;
    const parsedHeader = JSON.parse(atob(header));
    if ("typ" in parsedHeader && (parsedHeader == null ? void 0 : parsedHeader.typ) !== "JWT")
      return false;
    if (!parsedHeader.alg)
      return false;
    if (algorithm && (!("alg" in parsedHeader) || parsedHeader.alg !== algorithm))
      return false;
    return true;
  } catch {
    return false;
  }
}
const $ZodJWT = /* @__PURE__ */ $constructor("$ZodJWT", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  inst._zod.check = (payload) => {
    if (isValidJWT(payload.value, def.alg))
      return;
    payload.issues.push({
      code: "invalid_format",
      format: "jwt",
      input: payload.value,
      inst,
      continue: !def.abort
    });
  };
});
const $ZodNumber = /* @__PURE__ */ $constructor("$ZodNumber", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = inst._zod.bag.pattern ?? number$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Number(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "number" && !Number.isNaN(input) && Number.isFinite(input)) {
      return payload;
    }
    const received = typeof input === "number" ? Number.isNaN(input) ? "NaN" : !Number.isFinite(input) ? "Infinity" : void 0 : void 0;
    payload.issues.push({
      expected: "number",
      code: "invalid_type",
      input,
      inst,
      ...received ? { received } : {}
    });
    return payload;
  };
});
const $ZodNumberFormat = /* @__PURE__ */ $constructor("$ZodNumberFormat", (inst, def) => {
  $ZodCheckNumberFormat.init(inst, def);
  $ZodNumber.init(inst, def);
});
const $ZodBoolean = /* @__PURE__ */ $constructor("$ZodBoolean", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.pattern = boolean$1;
  inst._zod.parse = (payload, _ctx) => {
    if (def.coerce)
      try {
        payload.value = Boolean(payload.value);
      } catch (_) {
      }
    const input = payload.value;
    if (typeof input === "boolean")
      return payload;
    payload.issues.push({
      expected: "boolean",
      code: "invalid_type",
      input,
      inst
    });
    return payload;
  };
});
const $ZodUnknown = /* @__PURE__ */ $constructor("$ZodUnknown", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload) => payload;
});
const $ZodNever = /* @__PURE__ */ $constructor("$ZodNever", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _ctx) => {
    payload.issues.push({
      expected: "never",
      code: "invalid_type",
      input: payload.value,
      inst
    });
    return payload;
  };
});
function handleArrayResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
const $ZodArray = /* @__PURE__ */ $constructor("$ZodArray", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        expected: "array",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = Array(input.length);
    const proms = [];
    for (let i = 0; i < input.length; i++) {
      const item = input[i];
      const result = def.element._zod.run({
        value: item,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        proms.push(result.then((result2) => handleArrayResult(result2, payload, i)));
      } else {
        handleArrayResult(result, payload, i);
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
function handlePropertyResult(result, final, key, input, isOptionalIn, isOptionalOut) {
  const isPresent = key in input;
  if (result.issues.length) {
    if (isOptionalIn && isOptionalOut && !isPresent) {
      return;
    }
    final.issues.push(...prefixIssues(key, result.issues));
  }
  if (!isPresent && !isOptionalIn) {
    if (!result.issues.length) {
      final.issues.push({
        code: "invalid_type",
        expected: "nonoptional",
        input: void 0,
        path: [key]
      });
    }
    return;
  }
  if (result.value === void 0) {
    if (isPresent) {
      final.value[key] = void 0;
    }
  } else {
    final.value[key] = result.value;
  }
}
function normalizeDef(def) {
  var _a3, _b, _c, _d;
  const keys = Object.keys(def.shape);
  for (const k of keys) {
    if (!((_d = (_c = (_b = (_a3 = def.shape) == null ? void 0 : _a3[k]) == null ? void 0 : _b._zod) == null ? void 0 : _c.traits) == null ? void 0 : _d.has("$ZodType"))) {
      throw new Error(`Invalid element at key "${k}": expected a Zod schema`);
    }
  }
  const okeys = optionalKeys(def.shape);
  return {
    ...def,
    keys,
    keySet: new Set(keys),
    numKeys: keys.length,
    optionalKeys: new Set(okeys)
  };
}
function handleCatchall(proms, input, payload, ctx, def, inst) {
  const unrecognized = [];
  const keySet = def.keySet;
  const _catchall = def.catchall._zod;
  const t = _catchall.def.type;
  const isOptionalIn = _catchall.optin === "optional";
  const isOptionalOut = _catchall.optout === "optional";
  for (const key in input) {
    if (key === "__proto__")
      continue;
    if (keySet.has(key))
      continue;
    if (t === "never") {
      unrecognized.push(key);
      continue;
    }
    const r = _catchall.run({ value: input[key], issues: [] }, ctx);
    if (r instanceof Promise) {
      proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
    } else {
      handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
    }
  }
  if (unrecognized.length) {
    payload.issues.push({
      code: "unrecognized_keys",
      keys: unrecognized,
      input,
      inst
    });
  }
  if (!proms.length)
    return payload;
  return Promise.all(proms).then(() => {
    return payload;
  });
}
const $ZodObject = /* @__PURE__ */ $constructor("$ZodObject", (inst, def) => {
  $ZodType.init(inst, def);
  const desc = Object.getOwnPropertyDescriptor(def, "shape");
  if (!(desc == null ? void 0 : desc.get)) {
    const sh = def.shape;
    Object.defineProperty(def, "shape", {
      get: () => {
        const newSh = { ...sh };
        Object.defineProperty(def, "shape", {
          value: newSh
        });
        return newSh;
      }
    });
  }
  const _normalized = cached(() => normalizeDef(def));
  defineLazy(inst._zod, "propValues", () => {
    const shape = def.shape;
    const propValues = {};
    for (const key in shape) {
      const field = shape[key]._zod;
      if (field.values) {
        propValues[key] ?? (propValues[key] = /* @__PURE__ */ new Set());
        for (const v of field.values)
          propValues[key].add(v);
      }
    }
    return propValues;
  });
  const isObject$1 = isObject;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    payload.value = {};
    const proms = [];
    const shape = value.shape;
    for (const key of value.keys) {
      const el = shape[key];
      const isOptionalIn = el._zod.optin === "optional";
      const isOptionalOut = el._zod.optout === "optional";
      const r = el._zod.run({ value: input[key], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((r2) => handlePropertyResult(r2, payload, key, input, isOptionalIn, isOptionalOut)));
      } else {
        handlePropertyResult(r, payload, key, input, isOptionalIn, isOptionalOut);
      }
    }
    if (!catchall) {
      return proms.length ? Promise.all(proms).then(() => payload) : payload;
    }
    return handleCatchall(proms, input, payload, ctx, _normalized.value, inst);
  };
});
const $ZodObjectJIT = /* @__PURE__ */ $constructor("$ZodObjectJIT", (inst, def) => {
  $ZodObject.init(inst, def);
  const superParse = inst._zod.parse;
  const _normalized = cached(() => normalizeDef(def));
  const generateFastpass = (shape) => {
    var _a3, _b;
    const doc = new Doc(["shape", "payload", "ctx"]);
    const normalized = _normalized.value;
    const parseStr = (key) => {
      const k = esc(key);
      return `shape[${k}]._zod.run({ value: input[${k}], issues: [] }, ctx)`;
    };
    doc.write(`const input = payload.value;`);
    const ids = /* @__PURE__ */ Object.create(null);
    let counter = 0;
    for (const key of normalized.keys) {
      ids[key] = `key_${counter++}`;
    }
    doc.write(`const newResult = {};`);
    for (const key of normalized.keys) {
      const id = ids[key];
      const k = esc(key);
      const schema = shape[key];
      const isOptionalIn = ((_a3 = schema == null ? void 0 : schema._zod) == null ? void 0 : _a3.optin) === "optional";
      const isOptionalOut = ((_b = schema == null ? void 0 : schema._zod) == null ? void 0 : _b.optout) === "optional";
      doc.write(`const ${id} = ${parseStr(key)};`);
      if (isOptionalIn && isOptionalOut) {
        doc.write(`
        if (${id}.issues.length) {
          if (${k} in input) {
            payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
              ...iss,
              path: iss.path ? [${k}, ...iss.path] : [${k}]
            })));
          }
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      } else if (!isOptionalIn) {
        doc.write(`
        const ${id}_present = ${k} in input;
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }
        if (!${id}_present && !${id}.issues.length) {
          payload.issues.push({
            code: "invalid_type",
            expected: "nonoptional",
            input: undefined,
            path: [${k}]
          });
        }

        if (${id}_present) {
          if (${id}.value === undefined) {
            newResult[${k}] = undefined;
          } else {
            newResult[${k}] = ${id}.value;
          }
        }

      `);
      } else {
        doc.write(`
        if (${id}.issues.length) {
          payload.issues = payload.issues.concat(${id}.issues.map(iss => ({
            ...iss,
            path: iss.path ? [${k}, ...iss.path] : [${k}]
          })));
        }

        if (${id}.value === undefined) {
          if (${k} in input) {
            newResult[${k}] = undefined;
          }
        } else {
          newResult[${k}] = ${id}.value;
        }

      `);
      }
    }
    doc.write(`payload.value = newResult;`);
    doc.write(`return payload;`);
    const fn = doc.compile();
    return (payload, ctx) => fn(shape, payload, ctx);
  };
  let fastpass;
  const isObject$1 = isObject;
  const jit = !globalConfig.jitless;
  const allowsEval$1 = allowsEval;
  const fastEnabled = jit && allowsEval$1.value;
  const catchall = def.catchall;
  let value;
  inst._zod.parse = (payload, ctx) => {
    value ?? (value = _normalized.value);
    const input = payload.value;
    if (!isObject$1(input)) {
      payload.issues.push({
        expected: "object",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    if (jit && fastEnabled && (ctx == null ? void 0 : ctx.async) === false && ctx.jitless !== true) {
      if (!fastpass)
        fastpass = generateFastpass(def.shape);
      payload = fastpass(payload, ctx);
      if (!catchall)
        return payload;
      return handleCatchall([], input, payload, ctx, value, inst);
    }
    return superParse(payload, ctx);
  };
});
function handleUnionResults(results, final, inst, ctx) {
  for (const result of results) {
    if (result.issues.length === 0) {
      final.value = result.value;
      return final;
    }
  }
  const nonaborted = results.filter((r) => !aborted(r));
  if (nonaborted.length === 1) {
    final.value = nonaborted[0].value;
    return nonaborted[0];
  }
  final.issues.push({
    code: "invalid_union",
    input: final.value,
    inst,
    errors: results.map((result) => result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  });
  return final;
}
const $ZodUnion = /* @__PURE__ */ $constructor("$ZodUnion", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.options.some((o) => o._zod.optin === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "optout", () => def.options.some((o) => o._zod.optout === "optional") ? "optional" : void 0);
  defineLazy(inst._zod, "values", () => {
    if (def.options.every((o) => o._zod.values)) {
      return new Set(def.options.flatMap((option) => Array.from(option._zod.values)));
    }
    return void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    if (def.options.every((o) => o._zod.pattern)) {
      const patterns = def.options.map((o) => o._zod.pattern);
      return new RegExp(`^(${patterns.map((p) => cleanRegex(p.source)).join("|")})$`);
    }
    return void 0;
  });
  const first = def.options.length === 1 ? def.options[0]._zod.run : null;
  inst._zod.parse = (payload, ctx) => {
    if (first) {
      return first(payload, ctx);
    }
    let async = false;
    const results = [];
    for (const option of def.options) {
      const result = option._zod.run({
        value: payload.value,
        issues: []
      }, ctx);
      if (result instanceof Promise) {
        results.push(result);
        async = true;
      } else {
        if (result.issues.length === 0)
          return result;
        results.push(result);
      }
    }
    if (!async)
      return handleUnionResults(results, payload, inst, ctx);
    return Promise.all(results).then((results2) => {
      return handleUnionResults(results2, payload, inst, ctx);
    });
  };
});
const $ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("$ZodDiscriminatedUnion", (inst, def) => {
  def.inclusive = false;
  $ZodUnion.init(inst, def);
  const _super = inst._zod.parse;
  defineLazy(inst._zod, "propValues", () => {
    const propValues = {};
    for (const option of def.options) {
      const pv = option._zod.propValues;
      if (!pv || Object.keys(pv).length === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(option)}"`);
      for (const [k, v] of Object.entries(pv)) {
        if (!propValues[k])
          propValues[k] = /* @__PURE__ */ new Set();
        for (const val of v) {
          propValues[k].add(val);
        }
      }
    }
    return propValues;
  });
  const disc = cached(() => {
    var _a3;
    const opts = def.options;
    const map = /* @__PURE__ */ new Map();
    for (const o of opts) {
      const values = (_a3 = o._zod.propValues) == null ? void 0 : _a3[def.discriminator];
      if (!values || values.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
      for (const v of values) {
        if (map.has(v)) {
          throw new Error(`Duplicate discriminator value "${String(v)}"`);
        }
        map.set(v, o);
      }
    }
    return map;
  });
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isObject(input)) {
      payload.issues.push({
        code: "invalid_type",
        expected: "object",
        input,
        inst
      });
      return payload;
    }
    const opt = disc.value.get(input == null ? void 0 : input[def.discriminator]);
    if (opt) {
      return opt._zod.run(payload, ctx);
    }
    if (def.unionFallback || ctx.direction === "backward") {
      return _super(payload, ctx);
    }
    payload.issues.push({
      code: "invalid_union",
      errors: [],
      note: "No matching discriminator",
      discriminator: def.discriminator,
      options: Array.from(disc.value.keys()),
      input,
      path: [def.discriminator],
      inst
    });
    return payload;
  };
});
const $ZodIntersection = /* @__PURE__ */ $constructor("$ZodIntersection", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    const left = def.left._zod.run({ value: input, issues: [] }, ctx);
    const right = def.right._zod.run({ value: input, issues: [] }, ctx);
    const async = left instanceof Promise || right instanceof Promise;
    if (async) {
      return Promise.all([left, right]).then(([left2, right2]) => {
        return handleIntersectionResults(payload, left2, right2);
      });
    }
    return handleIntersectionResults(payload, left, right);
  };
});
function mergeValues(a, b) {
  if (a === b) {
    return { valid: true, data: a };
  }
  if (a instanceof Date && b instanceof Date && +a === +b) {
    return { valid: true, data: a };
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const bKeys = Object.keys(b);
    const sharedKeys = Object.keys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [key, ...sharedValue.mergeErrorPath]
        };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return { valid: false, mergeErrorPath: [] };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return {
          valid: false,
          mergeErrorPath: [index, ...sharedValue.mergeErrorPath]
        };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  }
  return { valid: false, mergeErrorPath: [] };
}
function handleIntersectionResults(result, left, right) {
  const unrecKeys = /* @__PURE__ */ new Map();
  let unrecIssue;
  for (const iss of left.issues) {
    if (iss.code === "unrecognized_keys") {
      unrecIssue ?? (unrecIssue = iss);
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).l = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  for (const iss of right.issues) {
    if (iss.code === "unrecognized_keys") {
      for (const k of iss.keys) {
        if (!unrecKeys.has(k))
          unrecKeys.set(k, {});
        unrecKeys.get(k).r = true;
      }
    } else {
      result.issues.push(iss);
    }
  }
  const bothKeys = [...unrecKeys].filter(([, f]) => f.l && f.r).map(([k]) => k);
  if (bothKeys.length && unrecIssue) {
    result.issues.push({ ...unrecIssue, keys: bothKeys });
  }
  if (aborted(result))
    return result;
  const merged = mergeValues(left.value, right.value);
  if (!merged.valid) {
    throw new Error(`Unmergable intersection. Error path: ${JSON.stringify(merged.mergeErrorPath)}`);
  }
  result.value = merged.data;
  return result;
}
const $ZodTuple = /* @__PURE__ */ $constructor("$ZodTuple", (inst, def) => {
  $ZodType.init(inst, def);
  const items = def.items;
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!Array.isArray(input)) {
      payload.issues.push({
        input,
        inst,
        expected: "tuple",
        code: "invalid_type"
      });
      return payload;
    }
    payload.value = [];
    const proms = [];
    const optinStart = getTupleOptStart(items, "optin");
    const optoutStart = getTupleOptStart(items, "optout");
    if (!def.rest) {
      if (input.length < optinStart) {
        payload.issues.push({
          code: "too_small",
          minimum: optinStart,
          inclusive: true,
          input,
          inst,
          origin: "array"
        });
        return payload;
      }
      if (input.length > items.length) {
        payload.issues.push({
          code: "too_big",
          maximum: items.length,
          inclusive: true,
          input,
          inst,
          origin: "array"
        });
      }
    }
    const itemResults = new Array(items.length);
    for (let i = 0; i < items.length; i++) {
      const r = items[i]._zod.run({ value: input[i], issues: [] }, ctx);
      if (r instanceof Promise) {
        proms.push(r.then((rr) => {
          itemResults[i] = rr;
        }));
      } else {
        itemResults[i] = r;
      }
    }
    if (def.rest) {
      let i = items.length - 1;
      const rest = input.slice(items.length);
      for (const el of rest) {
        i++;
        const result = def.rest._zod.run({ value: el, issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((r) => handleTupleResult(r, payload, i)));
        } else {
          handleTupleResult(result, payload, i);
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => handleTupleResults(itemResults, payload, items, input, optoutStart));
    }
    return handleTupleResults(itemResults, payload, items, input, optoutStart);
  };
});
function getTupleOptStart(items, key) {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i]._zod[key] !== "optional")
      return i + 1;
  }
  return 0;
}
function handleTupleResult(result, final, index) {
  if (result.issues.length) {
    final.issues.push(...prefixIssues(index, result.issues));
  }
  final.value[index] = result.value;
}
function handleTupleResults(itemResults, final, items, input, optoutStart) {
  for (let i = 0; i < items.length; i++) {
    const r = itemResults[i];
    const isPresent = i < input.length;
    if (r.issues.length) {
      if (!isPresent && i >= optoutStart) {
        final.value.length = i;
        break;
      }
      final.issues.push(...prefixIssues(i, r.issues));
    }
    final.value[i] = r.value;
  }
  for (let i = final.value.length - 1; i >= input.length; i--) {
    if (items[i]._zod.optout === "optional" && final.value[i] === void 0) {
      final.value.length = i;
    } else {
      break;
    }
  }
  return final;
}
const $ZodRecord = /* @__PURE__ */ $constructor("$ZodRecord", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, ctx) => {
    const input = payload.value;
    if (!isPlainObject(input)) {
      payload.issues.push({
        expected: "record",
        code: "invalid_type",
        input,
        inst
      });
      return payload;
    }
    const proms = [];
    const values = def.keyType._zod.values;
    if (values) {
      payload.value = {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values) {
        if (typeof key === "string" || typeof key === "number" || typeof key === "symbol") {
          recordKeys.add(typeof key === "number" ? key.toString() : key);
          const keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
          if (keyResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (keyResult.issues.length) {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
            continue;
          }
          const outKey = keyResult.value;
          const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
          if (result instanceof Promise) {
            proms.push(result.then((result2) => {
              if (result2.issues.length) {
                payload.issues.push(...prefixIssues(key, result2.issues));
              }
              payload.value[outKey] = result2.value;
            }));
          } else {
            if (result.issues.length) {
              payload.issues.push(...prefixIssues(key, result.issues));
            }
            payload.value[outKey] = result.value;
          }
        }
      }
      let unrecognized;
      for (const key in input) {
        if (!recordKeys.has(key)) {
          unrecognized = unrecognized ?? [];
          unrecognized.push(key);
        }
      }
      if (unrecognized && unrecognized.length > 0) {
        payload.issues.push({
          code: "unrecognized_keys",
          input,
          inst,
          keys: unrecognized
        });
      }
    } else {
      payload.value = {};
      for (const key of Reflect.ownKeys(input)) {
        if (key === "__proto__")
          continue;
        if (!Object.prototype.propertyIsEnumerable.call(input, key))
          continue;
        let keyResult = def.keyType._zod.run({ value: key, issues: [] }, ctx);
        if (keyResult instanceof Promise) {
          throw new Error("Async schemas not supported in object keys currently");
        }
        const checkNumericKey = typeof key === "string" && number$1.test(key) && keyResult.issues.length;
        if (checkNumericKey) {
          const retryResult = def.keyType._zod.run({ value: Number(key), issues: [] }, ctx);
          if (retryResult instanceof Promise) {
            throw new Error("Async schemas not supported in object keys currently");
          }
          if (retryResult.issues.length === 0) {
            keyResult = retryResult;
          }
        }
        if (keyResult.issues.length) {
          if (def.mode === "loose") {
            payload.value[key] = input[key];
          } else {
            payload.issues.push({
              code: "invalid_key",
              origin: "record",
              issues: keyResult.issues.map((iss) => finalizeIssue(iss, ctx, config())),
              input: key,
              path: [key],
              inst
            });
          }
          continue;
        }
        const result = def.valueType._zod.run({ value: input[key], issues: [] }, ctx);
        if (result instanceof Promise) {
          proms.push(result.then((result2) => {
            if (result2.issues.length) {
              payload.issues.push(...prefixIssues(key, result2.issues));
            }
            payload.value[keyResult.value] = result2.value;
          }));
        } else {
          if (result.issues.length) {
            payload.issues.push(...prefixIssues(key, result.issues));
          }
          payload.value[keyResult.value] = result.value;
        }
      }
    }
    if (proms.length) {
      return Promise.all(proms).then(() => payload);
    }
    return payload;
  };
});
const $ZodEnum = /* @__PURE__ */ $constructor("$ZodEnum", (inst, def) => {
  $ZodType.init(inst, def);
  const values = getEnumValues(def.entries);
  const valuesSet = new Set(values);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodLiteral = /* @__PURE__ */ $constructor("$ZodLiteral", (inst, def) => {
  $ZodType.init(inst, def);
  if (def.values.length === 0) {
    throw new Error("Cannot create literal schema with no valid values");
  }
  const values = new Set(def.values);
  inst._zod.values = values;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: def.values,
      input,
      inst
    });
    return payload;
  };
});
const $ZodTransform = /* @__PURE__ */ $constructor("$ZodTransform", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    const _out = def.transform(payload.value, payload);
    if (ctx.async) {
      const output = _out instanceof Promise ? _out : Promise.resolve(_out);
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    if (_out instanceof Promise) {
      throw new $ZodAsyncError();
    }
    payload.value = _out;
    payload.fallback = true;
    return payload;
  };
});
function handleOptionalResult(result, input) {
  if (input === void 0 && (result.issues.length || result.fallback)) {
    return { issues: [], value: void 0 };
  }
  return result;
}
const $ZodOptional = /* @__PURE__ */ $constructor("$ZodOptional", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  inst._zod.optout = "optional";
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, void 0]) : void 0;
  });
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)})?$`) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (def.innerType._zod.optin === "optional") {
      const input = payload.value;
      const result = def.innerType._zod.run(payload, ctx);
      if (result instanceof Promise)
        return result.then((r) => handleOptionalResult(r, input));
      return handleOptionalResult(result, input);
    }
    if (payload.value === void 0) {
      return payload;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodExactOptional = /* @__PURE__ */ $constructor("$ZodExactOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "pattern", () => def.innerType._zod.pattern);
  inst._zod.parse = (payload, ctx) => {
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNullable = /* @__PURE__ */ $constructor("$ZodNullable", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "optin", () => def.innerType._zod.optin);
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "pattern", () => {
    const pattern = def.innerType._zod.pattern;
    return pattern ? new RegExp(`^(${cleanRegex(pattern.source)}|null)$`) : void 0;
  });
  defineLazy(inst._zod, "values", () => {
    return def.innerType._zod.values ? /* @__PURE__ */ new Set([...def.innerType._zod.values, null]) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    if (payload.value === null)
      return payload;
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodDefault = /* @__PURE__ */ $constructor("$ZodDefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
      return payload;
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleDefaultResult(result2, def));
    }
    return handleDefaultResult(result, def);
  };
});
function handleDefaultResult(payload, def) {
  if (payload.value === void 0) {
    payload.value = def.defaultValue;
  }
  return payload;
}
const $ZodPrefault = /* @__PURE__ */ $constructor("$ZodPrefault", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    if (payload.value === void 0) {
      payload.value = def.defaultValue;
    }
    return def.innerType._zod.run(payload, ctx);
  };
});
const $ZodNonOptional = /* @__PURE__ */ $constructor("$ZodNonOptional", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => {
    const v = def.innerType._zod.values;
    return v ? new Set([...v].filter((x) => x !== void 0)) : void 0;
  });
  inst._zod.parse = (payload, ctx) => {
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => handleNonOptionalResult(result2, inst));
    }
    return handleNonOptionalResult(result, inst);
  };
});
function handleNonOptionalResult(payload, inst) {
  if (!payload.issues.length && payload.value === void 0) {
    payload.issues.push({
      code: "invalid_type",
      expected: "nonoptional",
      input: payload.value,
      inst
    });
  }
  return payload;
}
const $ZodCatch = /* @__PURE__ */ $constructor("$ZodCatch", (inst, def) => {
  $ZodType.init(inst, def);
  inst._zod.optin = "optional";
  defineLazy(inst._zod, "optout", () => def.innerType._zod.optout);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then((result2) => {
        payload.value = result2.value;
        if (result2.issues.length) {
          payload.value = def.catchValue({
            ...payload,
            error: {
              issues: result2.issues.map((iss) => finalizeIssue(iss, ctx, config()))
            },
            input: payload.value
          });
          payload.issues = [];
          payload.fallback = true;
        }
        return payload;
      });
    }
    payload.value = result.value;
    if (result.issues.length) {
      payload.value = def.catchValue({
        ...payload,
        error: {
          issues: result.issues.map((iss) => finalizeIssue(iss, ctx, config()))
        },
        input: payload.value
      });
      payload.issues = [];
      payload.fallback = true;
    }
    return payload;
  };
});
const $ZodPipe = /* @__PURE__ */ $constructor("$ZodPipe", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "values", () => def.in._zod.values);
  defineLazy(inst._zod, "optin", () => def.in._zod.optin);
  defineLazy(inst._zod, "optout", () => def.out._zod.optout);
  defineLazy(inst._zod, "propValues", () => def.in._zod.propValues);
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      const right = def.out._zod.run(payload, ctx);
      if (right instanceof Promise) {
        return right.then((right2) => handlePipeResult(right2, def.in, ctx));
      }
      return handlePipeResult(right, def.in, ctx);
    }
    const left = def.in._zod.run(payload, ctx);
    if (left instanceof Promise) {
      return left.then((left2) => handlePipeResult(left2, def.out, ctx));
    }
    return handlePipeResult(left, def.out, ctx);
  };
});
function handlePipeResult(left, next, ctx) {
  if (left.issues.length) {
    left.aborted = true;
    return left;
  }
  return next._zod.run({ value: left.value, issues: left.issues, fallback: left.fallback }, ctx);
}
const $ZodReadonly = /* @__PURE__ */ $constructor("$ZodReadonly", (inst, def) => {
  $ZodType.init(inst, def);
  defineLazy(inst._zod, "propValues", () => def.innerType._zod.propValues);
  defineLazy(inst._zod, "values", () => def.innerType._zod.values);
  defineLazy(inst._zod, "optin", () => {
    var _a3, _b;
    return (_b = (_a3 = def.innerType) == null ? void 0 : _a3._zod) == null ? void 0 : _b.optin;
  });
  defineLazy(inst._zod, "optout", () => {
    var _a3, _b;
    return (_b = (_a3 = def.innerType) == null ? void 0 : _a3._zod) == null ? void 0 : _b.optout;
  });
  inst._zod.parse = (payload, ctx) => {
    if (ctx.direction === "backward") {
      return def.innerType._zod.run(payload, ctx);
    }
    const result = def.innerType._zod.run(payload, ctx);
    if (result instanceof Promise) {
      return result.then(handleReadonlyResult);
    }
    return handleReadonlyResult(result);
  };
});
function handleReadonlyResult(payload) {
  payload.value = Object.freeze(payload.value);
  return payload;
}
const $ZodCustom = /* @__PURE__ */ $constructor("$ZodCustom", (inst, def) => {
  $ZodCheck.init(inst, def);
  $ZodType.init(inst, def);
  inst._zod.parse = (payload, _) => {
    return payload;
  };
  inst._zod.check = (payload) => {
    const input = payload.value;
    const r = def.fn(input);
    if (r instanceof Promise) {
      return r.then((r2) => handleRefineResult(r2, payload, input, inst));
    }
    handleRefineResult(r, payload, input, inst);
    return;
  };
});
function handleRefineResult(result, payload, input, inst) {
  if (!result) {
    const _iss = {
      code: "custom",
      input,
      inst,
      // incorporates params.error into issue reporting
      path: [...inst._zod.def.path ?? []],
      // incorporates params.error into issue reporting
      continue: !inst._zod.def.abort
      // params: inst._zod.def.params,
    };
    if (inst._zod.def.params)
      _iss.params = inst._zod.def.params;
    payload.issues.push(issue(_iss));
  }
}
var _a;
class $ZodRegistry {
  constructor() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
  }
  add(schema, ..._meta) {
    const meta = _meta[0];
    this._map.set(schema, meta);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.set(meta.id, schema);
    }
    return this;
  }
  clear() {
    this._map = /* @__PURE__ */ new WeakMap();
    this._idmap = /* @__PURE__ */ new Map();
    return this;
  }
  remove(schema) {
    const meta = this._map.get(schema);
    if (meta && typeof meta === "object" && "id" in meta) {
      this._idmap.delete(meta.id);
    }
    this._map.delete(schema);
    return this;
  }
  get(schema) {
    const p = schema._zod.parent;
    if (p) {
      const pm = { ...this.get(p) ?? {} };
      delete pm.id;
      const f = { ...pm, ...this._map.get(schema) };
      return Object.keys(f).length ? f : void 0;
    }
    return this._map.get(schema);
  }
  has(schema) {
    return this._map.has(schema);
  }
}
function registry() {
  return new $ZodRegistry();
}
(_a = globalThis).__zod_globalRegistry ?? (_a.__zod_globalRegistry = registry());
const globalRegistry = globalThis.__zod_globalRegistry;
// @__NO_SIDE_EFFECTS__
function _string(Class, params) {
  return new Class({
    type: "string",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _email(Class, params) {
  return new Class({
    type: "string",
    format: "email",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _guid(Class, params) {
  return new Class({
    type: "string",
    format: "guid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuid(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv4(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v4",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv6(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v6",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uuidv7(Class, params) {
  return new Class({
    type: "string",
    format: "uuid",
    check: "string_format",
    abort: false,
    version: "v7",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _url(Class, params) {
  return new Class({
    type: "string",
    format: "url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _emoji(Class, params) {
  return new Class({
    type: "string",
    format: "emoji",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _nanoid(Class, params) {
  return new Class({
    type: "string",
    format: "nanoid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid(Class, params) {
  return new Class({
    type: "string",
    format: "cuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cuid2(Class, params) {
  return new Class({
    type: "string",
    format: "cuid2",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ulid(Class, params) {
  return new Class({
    type: "string",
    format: "ulid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _xid(Class, params) {
  return new Class({
    type: "string",
    format: "xid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ksuid(Class, params) {
  return new Class({
    type: "string",
    format: "ksuid",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv4(Class, params) {
  return new Class({
    type: "string",
    format: "ipv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _ipv6(Class, params) {
  return new Class({
    type: "string",
    format: "ipv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv4(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv4",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _cidrv6(Class, params) {
  return new Class({
    type: "string",
    format: "cidrv6",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64(Class, params) {
  return new Class({
    type: "string",
    format: "base64",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _base64url(Class, params) {
  return new Class({
    type: "string",
    format: "base64url",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _e164(Class, params) {
  return new Class({
    type: "string",
    format: "e164",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _jwt(Class, params) {
  return new Class({
    type: "string",
    format: "jwt",
    check: "string_format",
    abort: false,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDateTime(Class, params) {
  return new Class({
    type: "string",
    format: "datetime",
    check: "string_format",
    offset: false,
    local: false,
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDate(Class, params) {
  return new Class({
    type: "string",
    format: "date",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoTime(Class, params) {
  return new Class({
    type: "string",
    format: "time",
    check: "string_format",
    precision: null,
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _isoDuration(Class, params) {
  return new Class({
    type: "string",
    format: "duration",
    check: "string_format",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _number(Class, params) {
  return new Class({
    type: "number",
    checks: [],
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _int(Class, params) {
  return new Class({
    type: "number",
    check: "number_format",
    abort: false,
    format: "safeint",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _boolean(Class, params) {
  return new Class({
    type: "boolean",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _unknown(Class) {
  return new Class({
    type: "unknown"
  });
}
// @__NO_SIDE_EFFECTS__
function _never(Class, params) {
  return new Class({
    type: "never",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _lt(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value
  });
}
// @__NO_SIDE_EFFECTS__
function _maxLength(maximum, params) {
  const ch = new $ZodCheckMaxLength({
    check: "max_length",
    ...normalizeParams(params),
    maximum
  });
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _minLength(minimum, params) {
  return new $ZodCheckMinLength({
    check: "min_length",
    ...normalizeParams(params),
    minimum
  });
}
// @__NO_SIDE_EFFECTS__
function _length(length, params) {
  return new $ZodCheckLengthEquals({
    check: "length_equals",
    ...normalizeParams(params),
    length
  });
}
// @__NO_SIDE_EFFECTS__
function _regex(pattern, params) {
  return new $ZodCheckRegex({
    check: "string_format",
    format: "regex",
    ...normalizeParams(params),
    pattern
  });
}
// @__NO_SIDE_EFFECTS__
function _lowercase(params) {
  return new $ZodCheckLowerCase({
    check: "string_format",
    format: "lowercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _uppercase(params) {
  return new $ZodCheckUpperCase({
    check: "string_format",
    format: "uppercase",
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _includes(includes, params) {
  return new $ZodCheckIncludes({
    check: "string_format",
    format: "includes",
    ...normalizeParams(params),
    includes
  });
}
// @__NO_SIDE_EFFECTS__
function _startsWith(prefix, params) {
  return new $ZodCheckStartsWith({
    check: "string_format",
    format: "starts_with",
    ...normalizeParams(params),
    prefix
  });
}
// @__NO_SIDE_EFFECTS__
function _endsWith(suffix, params) {
  return new $ZodCheckEndsWith({
    check: "string_format",
    format: "ends_with",
    ...normalizeParams(params),
    suffix
  });
}
// @__NO_SIDE_EFFECTS__
function _overwrite(tx) {
  return new $ZodCheckOverwrite({
    check: "overwrite",
    tx
  });
}
// @__NO_SIDE_EFFECTS__
function _normalize(form) {
  return /* @__PURE__ */ _overwrite((input) => input.normalize(form));
}
// @__NO_SIDE_EFFECTS__
function _trim() {
  return /* @__PURE__ */ _overwrite((input) => input.trim());
}
// @__NO_SIDE_EFFECTS__
function _toLowerCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toLowerCase());
}
// @__NO_SIDE_EFFECTS__
function _toUpperCase() {
  return /* @__PURE__ */ _overwrite((input) => input.toUpperCase());
}
// @__NO_SIDE_EFFECTS__
function _slugify() {
  return /* @__PURE__ */ _overwrite((input) => slugify(input));
}
// @__NO_SIDE_EFFECTS__
function _array(Class, element, params) {
  return new Class({
    type: "array",
    element,
    // get element() {
    //   return element;
    // },
    ...normalizeParams(params)
  });
}
// @__NO_SIDE_EFFECTS__
function _refine(Class, fn, _params) {
  const schema = new Class({
    type: "custom",
    check: "custom",
    fn,
    ...normalizeParams(_params)
  });
  return schema;
}
// @__NO_SIDE_EFFECTS__
function _superRefine(fn, params) {
  const ch = /* @__PURE__ */ _check((payload) => {
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, ch._zod.def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = ch);
        _issue.continue ?? (_issue.continue = !ch._zod.def.abort);
        payload.issues.push(issue(_issue));
      }
    };
    return fn(payload.value, payload);
  }, params);
  return ch;
}
// @__NO_SIDE_EFFECTS__
function _check(fn, params) {
  const ch = new $ZodCheck({
    check: "custom",
    ...normalizeParams(params)
  });
  ch._zod.check = fn;
  return ch;
}
function initializeContext(params) {
  let target = (params == null ? void 0 : params.target) ?? "draft-2020-12";
  if (target === "draft-4")
    target = "draft-04";
  if (target === "draft-7")
    target = "draft-07";
  return {
    processors: params.processors ?? {},
    metadataRegistry: (params == null ? void 0 : params.metadata) ?? globalRegistry,
    target,
    unrepresentable: (params == null ? void 0 : params.unrepresentable) ?? "throw",
    override: (params == null ? void 0 : params.override) ?? (() => {
    }),
    io: (params == null ? void 0 : params.io) ?? "output",
    counter: 0,
    seen: /* @__PURE__ */ new Map(),
    cycles: (params == null ? void 0 : params.cycles) ?? "ref",
    reused: (params == null ? void 0 : params.reused) ?? "inline",
    external: (params == null ? void 0 : params.external) ?? void 0
  };
}
function process$1(schema, ctx, _params = { path: [], schemaPath: [] }) {
  var _a4, _b;
  var _a3;
  const def = schema._zod.def;
  const seen = ctx.seen.get(schema);
  if (seen) {
    seen.count++;
    const isCycle = _params.schemaPath.includes(schema);
    if (isCycle) {
      seen.cycle = _params.path;
    }
    return seen.schema;
  }
  const result = { schema: {}, count: 1, cycle: void 0, path: _params.path };
  ctx.seen.set(schema, result);
  const overrideSchema = (_b = (_a4 = schema._zod).toJSONSchema) == null ? void 0 : _b.call(_a4);
  if (overrideSchema) {
    result.schema = overrideSchema;
  } else {
    const params = {
      ..._params,
      schemaPath: [..._params.schemaPath, schema],
      path: _params.path
    };
    if (schema._zod.processJSONSchema) {
      schema._zod.processJSONSchema(ctx, result.schema, params);
    } else {
      const _json = result.schema;
      const processor = ctx.processors[def.type];
      if (!processor) {
        throw new Error(`[toJSONSchema]: Non-representable type encountered: ${def.type}`);
      }
      processor(schema, ctx, _json, params);
    }
    const parent = schema._zod.parent;
    if (parent) {
      if (!result.ref)
        result.ref = parent;
      process$1(parent, ctx, params);
      ctx.seen.get(parent).isParent = true;
    }
  }
  const meta = ctx.metadataRegistry.get(schema);
  if (meta)
    Object.assign(result.schema, meta);
  if (ctx.io === "input" && isTransforming(schema)) {
    delete result.schema.examples;
    delete result.schema.default;
  }
  if (ctx.io === "input" && "_prefault" in result.schema)
    (_a3 = result.schema).default ?? (_a3.default = result.schema._prefault);
  delete result.schema._prefault;
  const _result = ctx.seen.get(schema);
  return _result.schema;
}
function extractDefs(ctx, schema) {
  var _a3, _b, _c, _d;
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const idToSchema = /* @__PURE__ */ new Map();
  for (const entry of ctx.seen.entries()) {
    const id = (_a3 = ctx.metadataRegistry.get(entry[0])) == null ? void 0 : _a3.id;
    if (id) {
      const existing = idToSchema.get(id);
      if (existing && existing !== entry[0]) {
        throw new Error(`Duplicate schema id "${id}" detected during JSON Schema conversion. Two different schemas cannot share the same id when converted together.`);
      }
      idToSchema.set(id, entry[0]);
    }
  }
  const makeURI = (entry) => {
    var _a4;
    const defsSegment = ctx.target === "draft-2020-12" ? "$defs" : "definitions";
    if (ctx.external) {
      const externalId = (_a4 = ctx.external.registry.get(entry[0])) == null ? void 0 : _a4.id;
      const uriGenerator = ctx.external.uri ?? ((id2) => id2);
      if (externalId) {
        return { ref: uriGenerator(externalId) };
      }
      const id = entry[1].defId ?? entry[1].schema.id ?? `schema${ctx.counter++}`;
      entry[1].defId = id;
      return { defId: id, ref: `${uriGenerator("__shared")}#/${defsSegment}/${id}` };
    }
    if (entry[1] === root) {
      return { ref: "#" };
    }
    const uriPrefix = `#`;
    const defUriPrefix = `${uriPrefix}/${defsSegment}/`;
    const defId = entry[1].schema.id ?? `__schema${ctx.counter++}`;
    return { defId, ref: defUriPrefix + defId };
  };
  const extractToDef = (entry) => {
    if (entry[1].schema.$ref) {
      return;
    }
    const seen = entry[1];
    const { ref, defId } = makeURI(entry);
    seen.def = { ...seen.schema };
    if (defId)
      seen.defId = defId;
    const schema2 = seen.schema;
    for (const key in schema2) {
      delete schema2[key];
    }
    schema2.$ref = ref;
  };
  if (ctx.cycles === "throw") {
    for (const entry of ctx.seen.entries()) {
      const seen = entry[1];
      if (seen.cycle) {
        throw new Error(`Cycle detected: #/${(_b = seen.cycle) == null ? void 0 : _b.join("/")}/<root>

Set the \`cycles\` parameter to \`"ref"\` to resolve cyclical schemas with defs.`);
      }
    }
  }
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (schema === entry[0]) {
      extractToDef(entry);
      continue;
    }
    if (ctx.external) {
      const ext = (_c = ctx.external.registry.get(entry[0])) == null ? void 0 : _c.id;
      if (schema !== entry[0] && ext) {
        extractToDef(entry);
        continue;
      }
    }
    const id = (_d = ctx.metadataRegistry.get(entry[0])) == null ? void 0 : _d.id;
    if (id) {
      extractToDef(entry);
      continue;
    }
    if (seen.cycle) {
      extractToDef(entry);
      continue;
    }
    if (seen.count > 1) {
      if (ctx.reused === "ref") {
        extractToDef(entry);
        continue;
      }
    }
  }
}
function finalize(ctx, schema) {
  var _a3, _b, _c, _d;
  const root = ctx.seen.get(schema);
  if (!root)
    throw new Error("Unprocessed schema. This is a bug in Zod.");
  const flattenRef = (zodSchema) => {
    const seen = ctx.seen.get(zodSchema);
    if (seen.ref === null)
      return;
    const schema2 = seen.def ?? seen.schema;
    const _cached = { ...schema2 };
    const ref = seen.ref;
    seen.ref = null;
    if (ref) {
      flattenRef(ref);
      const refSeen = ctx.seen.get(ref);
      const refSchema = refSeen.schema;
      if (refSchema.$ref && (ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0")) {
        schema2.allOf = schema2.allOf ?? [];
        schema2.allOf.push(refSchema);
      } else {
        Object.assign(schema2, refSchema);
      }
      Object.assign(schema2, _cached);
      const isParentRef = zodSchema._zod.parent === ref;
      if (isParentRef) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (!(key in _cached)) {
            delete schema2[key];
          }
        }
      }
      if (refSchema.$ref && refSeen.def) {
        for (const key in schema2) {
          if (key === "$ref" || key === "allOf")
            continue;
          if (key in refSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(refSeen.def[key])) {
            delete schema2[key];
          }
        }
      }
    }
    const parent = zodSchema._zod.parent;
    if (parent && parent !== ref) {
      flattenRef(parent);
      const parentSeen = ctx.seen.get(parent);
      if (parentSeen == null ? void 0 : parentSeen.schema.$ref) {
        schema2.$ref = parentSeen.schema.$ref;
        if (parentSeen.def) {
          for (const key in schema2) {
            if (key === "$ref" || key === "allOf")
              continue;
            if (key in parentSeen.def && JSON.stringify(schema2[key]) === JSON.stringify(parentSeen.def[key])) {
              delete schema2[key];
            }
          }
        }
      }
    }
    ctx.override({
      zodSchema,
      jsonSchema: schema2,
      path: seen.path ?? []
    });
  };
  for (const entry of [...ctx.seen.entries()].reverse()) {
    flattenRef(entry[0]);
  }
  const result = {};
  if (ctx.target === "draft-2020-12") {
    result.$schema = "https://json-schema.org/draft/2020-12/schema";
  } else if (ctx.target === "draft-07") {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (ctx.target === "draft-04") {
    result.$schema = "http://json-schema.org/draft-04/schema#";
  } else if (ctx.target === "openapi-3.0") ;
  else ;
  if ((_a3 = ctx.external) == null ? void 0 : _a3.uri) {
    const id = (_b = ctx.external.registry.get(schema)) == null ? void 0 : _b.id;
    if (!id)
      throw new Error("Schema is missing an `id` property");
    result.$id = ctx.external.uri(id);
  }
  Object.assign(result, root.def ?? root.schema);
  const rootMetaId = (_c = ctx.metadataRegistry.get(schema)) == null ? void 0 : _c.id;
  if (rootMetaId !== void 0 && result.id === rootMetaId)
    delete result.id;
  const defs = ((_d = ctx.external) == null ? void 0 : _d.defs) ?? {};
  for (const entry of ctx.seen.entries()) {
    const seen = entry[1];
    if (seen.def && seen.defId) {
      if (seen.def.id === seen.defId)
        delete seen.def.id;
      defs[seen.defId] = seen.def;
    }
  }
  if (ctx.external) ;
  else {
    if (Object.keys(defs).length > 0) {
      if (ctx.target === "draft-2020-12") {
        result.$defs = defs;
      } else {
        result.definitions = defs;
      }
    }
  }
  try {
    const finalized = JSON.parse(JSON.stringify(result));
    Object.defineProperty(finalized, "~standard", {
      value: {
        ...schema["~standard"],
        jsonSchema: {
          input: createStandardJSONSchemaMethod(schema, "input", ctx.processors),
          output: createStandardJSONSchemaMethod(schema, "output", ctx.processors)
        }
      },
      enumerable: false,
      writable: false
    });
    return finalized;
  } catch (_err) {
    throw new Error("Error converting schema to JSON.");
  }
}
function isTransforming(_schema, _ctx) {
  const ctx = _ctx ?? { seen: /* @__PURE__ */ new Set() };
  if (ctx.seen.has(_schema))
    return false;
  ctx.seen.add(_schema);
  const def = _schema._zod.def;
  if (def.type === "transform")
    return true;
  if (def.type === "array")
    return isTransforming(def.element, ctx);
  if (def.type === "set")
    return isTransforming(def.valueType, ctx);
  if (def.type === "lazy")
    return isTransforming(def.getter(), ctx);
  if (def.type === "promise" || def.type === "optional" || def.type === "nonoptional" || def.type === "nullable" || def.type === "readonly" || def.type === "default" || def.type === "prefault") {
    return isTransforming(def.innerType, ctx);
  }
  if (def.type === "intersection") {
    return isTransforming(def.left, ctx) || isTransforming(def.right, ctx);
  }
  if (def.type === "record" || def.type === "map") {
    return isTransforming(def.keyType, ctx) || isTransforming(def.valueType, ctx);
  }
  if (def.type === "pipe") {
    if (_schema._zod.traits.has("$ZodCodec"))
      return true;
    return isTransforming(def.in, ctx) || isTransforming(def.out, ctx);
  }
  if (def.type === "object") {
    for (const key in def.shape) {
      if (isTransforming(def.shape[key], ctx))
        return true;
    }
    return false;
  }
  if (def.type === "union") {
    for (const option of def.options) {
      if (isTransforming(option, ctx))
        return true;
    }
    return false;
  }
  if (def.type === "tuple") {
    for (const item of def.items) {
      if (isTransforming(item, ctx))
        return true;
    }
    if (def.rest && isTransforming(def.rest, ctx))
      return true;
    return false;
  }
  return false;
}
const createToJSONSchemaMethod = (schema, processors = {}) => (params) => {
  const ctx = initializeContext({ ...params, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const createStandardJSONSchemaMethod = (schema, io, processors = {}) => (params) => {
  const { libraryOptions, target } = params ?? {};
  const ctx = initializeContext({ ...libraryOptions ?? {}, target, io, processors });
  process$1(schema, ctx);
  extractDefs(ctx, schema);
  return finalize(ctx, schema);
};
const formatMap = {
  guid: "uuid",
  url: "uri",
  datetime: "date-time",
  json_string: "json-string",
  regex: ""
  // do not set
};
const stringProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  json.type = "string";
  const { minimum, maximum, format, patterns, contentEncoding } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format) {
    json.format = formatMap[format] ?? format;
    if (json.format === "")
      delete json.format;
    if (format === "time") {
      delete json.format;
    }
  }
  if (contentEncoding)
    json.contentEncoding = contentEncoding;
  if (patterns && patterns.size > 0) {
    const regexes = [...patterns];
    if (regexes.length === 1)
      json.pattern = regexes[0].source;
    else if (regexes.length > 1) {
      json.allOf = [
        ...regexes.map((regex) => ({
          ...ctx.target === "draft-07" || ctx.target === "draft-04" || ctx.target === "openapi-3.0" ? { type: "string" } : {},
          pattern: regex.source
        }))
      ];
    }
  }
};
const numberProcessor = (schema, ctx, _json, _params) => {
  const json = _json;
  const { minimum, maximum, format, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format === "string" && format.includes("int"))
    json.type = "integer";
  else
    json.type = "number";
  const exMin = typeof exclusiveMinimum === "number" && exclusiveMinimum >= (minimum ?? Number.NEGATIVE_INFINITY);
  const exMax = typeof exclusiveMaximum === "number" && exclusiveMaximum <= (maximum ?? Number.POSITIVE_INFINITY);
  const legacy = ctx.target === "draft-04" || ctx.target === "openapi-3.0";
  if (exMin) {
    if (legacy) {
      json.minimum = exclusiveMinimum;
      json.exclusiveMinimum = true;
    } else {
      json.exclusiveMinimum = exclusiveMinimum;
    }
  } else if (typeof minimum === "number") {
    json.minimum = minimum;
  }
  if (exMax) {
    if (legacy) {
      json.maximum = exclusiveMaximum;
      json.exclusiveMaximum = true;
    } else {
      json.exclusiveMaximum = exclusiveMaximum;
    }
  } else if (typeof maximum === "number") {
    json.maximum = maximum;
  }
  if (typeof multipleOf === "number")
    json.multipleOf = multipleOf;
};
const booleanProcessor = (_schema, _ctx, json, _params) => {
  json.type = "boolean";
};
const neverProcessor = (_schema, _ctx, json, _params) => {
  json.not = {};
};
const unknownProcessor = (_schema, _ctx, _json, _params) => {
};
const enumProcessor = (schema, _ctx, json, _params) => {
  const def = schema._zod.def;
  const values = getEnumValues(def.entries);
  if (values.every((v) => typeof v === "number"))
    json.type = "number";
  if (values.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values;
};
const literalProcessor = (schema, ctx, json, _params) => {
  const def = schema._zod.def;
  const vals = [];
  for (const val of def.values) {
    if (val === void 0) {
      if (ctx.unrepresentable === "throw") {
        throw new Error("Literal `undefined` cannot be represented in JSON Schema");
      }
    } else if (typeof val === "bigint") {
      if (ctx.unrepresentable === "throw") {
        throw new Error("BigInt literals cannot be represented in JSON Schema");
      } else {
        vals.push(Number(val));
      }
    } else {
      vals.push(val);
    }
  }
  if (vals.length === 0) ;
  else if (vals.length === 1) {
    const val = vals[0];
    json.type = val === null ? "null" : typeof val;
    if (ctx.target === "draft-04" || ctx.target === "openapi-3.0") {
      json.enum = [val];
    } else {
      json.const = val;
    }
  } else {
    if (vals.every((v) => typeof v === "number"))
      json.type = "number";
    if (vals.every((v) => typeof v === "string"))
      json.type = "string";
    if (vals.every((v) => typeof v === "boolean"))
      json.type = "boolean";
    if (vals.every((v) => v === null))
      json.type = "null";
    json.enum = vals;
  }
};
const customProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Custom types cannot be represented in JSON Schema");
  }
};
const transformProcessor = (_schema, ctx, _json, _params) => {
  if (ctx.unrepresentable === "throw") {
    throw new Error("Transforms cannot be represented in JSON Schema");
  }
};
const arrayProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
  json.type = "array";
  json.items = process$1(def.element, ctx, {
    ...params,
    path: [...params.path, "items"]
  });
};
const objectProcessor = (schema, ctx, _json, params) => {
  var _a3;
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  json.properties = {};
  const shape = def.shape;
  for (const key in shape) {
    json.properties[key] = process$1(shape[key], ctx, {
      ...params,
      path: [...params.path, "properties", key]
    });
  }
  const allKeys = new Set(Object.keys(shape));
  const requiredKeys = new Set([...allKeys].filter((key) => {
    const v = def.shape[key]._zod;
    if (ctx.io === "input") {
      return v.optin === void 0;
    } else {
      return v.optout === void 0;
    }
  }));
  if (requiredKeys.size > 0) {
    json.required = Array.from(requiredKeys);
  }
  if (((_a3 = def.catchall) == null ? void 0 : _a3._zod.def.type) === "never") {
    json.additionalProperties = false;
  } else if (!def.catchall) {
    if (ctx.io === "output")
      json.additionalProperties = false;
  } else if (def.catchall) {
    json.additionalProperties = process$1(def.catchall, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
};
const unionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const isExclusive = def.inclusive === false;
  const options = def.options.map((x, i) => process$1(x, ctx, {
    ...params,
    path: [...params.path, isExclusive ? "oneOf" : "anyOf", i]
  }));
  if (isExclusive) {
    json.oneOf = options;
  } else {
    json.anyOf = options;
  }
};
const intersectionProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const a = process$1(def.left, ctx, {
    ...params,
    path: [...params.path, "allOf", 0]
  });
  const b = process$1(def.right, ctx, {
    ...params,
    path: [...params.path, "allOf", 1]
  });
  const isSimpleIntersection = (val) => "allOf" in val && Object.keys(val).length === 1;
  const allOf = [
    ...isSimpleIntersection(a) ? a.allOf : [a],
    ...isSimpleIntersection(b) ? b.allOf : [b]
  ];
  json.allOf = allOf;
};
const tupleProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "array";
  const prefixPath = ctx.target === "draft-2020-12" ? "prefixItems" : "items";
  const restPath = ctx.target === "draft-2020-12" ? "items" : ctx.target === "openapi-3.0" ? "items" : "additionalItems";
  const prefixItems = def.items.map((x, i) => process$1(x, ctx, {
    ...params,
    path: [...params.path, prefixPath, i]
  }));
  const rest = def.rest ? process$1(def.rest, ctx, {
    ...params,
    path: [...params.path, restPath, ...ctx.target === "openapi-3.0" ? [def.items.length] : []]
  }) : null;
  if (ctx.target === "draft-2020-12") {
    json.prefixItems = prefixItems;
    if (rest) {
      json.items = rest;
    }
  } else if (ctx.target === "openapi-3.0") {
    json.items = {
      anyOf: prefixItems
    };
    if (rest) {
      json.items.anyOf.push(rest);
    }
    json.minItems = prefixItems.length;
    if (!rest) {
      json.maxItems = prefixItems.length;
    }
  } else {
    json.items = prefixItems;
    if (rest) {
      json.additionalItems = rest;
    }
  }
  const { minimum, maximum } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minItems = minimum;
  if (typeof maximum === "number")
    json.maxItems = maximum;
};
const recordProcessor = (schema, ctx, _json, params) => {
  const json = _json;
  const def = schema._zod.def;
  json.type = "object";
  const keyType = def.keyType;
  const keyBag = keyType._zod.bag;
  const patterns = keyBag == null ? void 0 : keyBag.patterns;
  if (def.mode === "loose" && patterns && patterns.size > 0) {
    const valueSchema = process$1(def.valueType, ctx, {
      ...params,
      path: [...params.path, "patternProperties", "*"]
    });
    json.patternProperties = {};
    for (const pattern of patterns) {
      json.patternProperties[pattern.source] = valueSchema;
    }
  } else {
    if (ctx.target === "draft-07" || ctx.target === "draft-2020-12") {
      json.propertyNames = process$1(def.keyType, ctx, {
        ...params,
        path: [...params.path, "propertyNames"]
      });
    }
    json.additionalProperties = process$1(def.valueType, ctx, {
      ...params,
      path: [...params.path, "additionalProperties"]
    });
  }
  const keyValues = keyType._zod.values;
  if (keyValues) {
    const validKeyValues = [...keyValues].filter((v) => typeof v === "string" || typeof v === "number");
    if (validKeyValues.length > 0) {
      json.required = validKeyValues;
    }
  }
};
const nullableProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  const inner = process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  if (ctx.target === "openapi-3.0") {
    seen.ref = def.innerType;
    json.nullable = true;
  } else {
    json.anyOf = [inner, { type: "null" }];
  }
};
const nonoptionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const defaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.default = JSON.parse(JSON.stringify(def.defaultValue));
};
const prefaultProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  if (ctx.io === "input")
    json._prefault = JSON.parse(JSON.stringify(def.defaultValue));
};
const catchProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  let catchValue;
  try {
    catchValue = def.catchValue(void 0);
  } catch {
    throw new Error("Dynamic catch values are not supported in JSON Schema");
  }
  json.default = catchValue;
};
const pipeProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  const inIsTransform = def.in._zod.traits.has("$ZodTransform");
  const innerType = ctx.io === "input" ? inIsTransform ? def.out : def.in : def.out;
  process$1(innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = innerType;
};
const readonlyProcessor = (schema, ctx, json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
  json.readOnly = true;
};
const optionalProcessor = (schema, ctx, _json, params) => {
  const def = schema._zod.def;
  process$1(def.innerType, ctx, params);
  const seen = ctx.seen.get(schema);
  seen.ref = def.innerType;
};
const ZodISODateTime = /* @__PURE__ */ $constructor("ZodISODateTime", (inst, def) => {
  $ZodISODateTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function datetime(params) {
  return /* @__PURE__ */ _isoDateTime(ZodISODateTime, params);
}
const ZodISODate = /* @__PURE__ */ $constructor("ZodISODate", (inst, def) => {
  $ZodISODate.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function date(params) {
  return /* @__PURE__ */ _isoDate(ZodISODate, params);
}
const ZodISOTime = /* @__PURE__ */ $constructor("ZodISOTime", (inst, def) => {
  $ZodISOTime.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function time(params) {
  return /* @__PURE__ */ _isoTime(ZodISOTime, params);
}
const ZodISODuration = /* @__PURE__ */ $constructor("ZodISODuration", (inst, def) => {
  $ZodISODuration.init(inst, def);
  ZodStringFormat.init(inst, def);
});
function duration(params) {
  return /* @__PURE__ */ _isoDuration(ZodISODuration, params);
}
const initializer = (inst, issues) => {
  $ZodError.init(inst, issues);
  inst.name = "ZodError";
  Object.defineProperties(inst, {
    format: {
      value: (mapper) => formatError(inst, mapper)
      // enumerable: false,
    },
    flatten: {
      value: (mapper) => flattenError(inst, mapper)
      // enumerable: false,
    },
    addIssue: {
      value: (issue2) => {
        inst.issues.push(issue2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    addIssues: {
      value: (issues2) => {
        inst.issues.push(...issues2);
        inst.message = JSON.stringify(inst.issues, jsonStringifyReplacer, 2);
      }
      // enumerable: false,
    },
    isEmpty: {
      get() {
        return inst.issues.length === 0;
      }
      // enumerable: false,
    }
  });
};
const ZodRealError = /* @__PURE__ */ $constructor("ZodError", initializer, {
  Parent: Error
});
const parse = /* @__PURE__ */ _parse(ZodRealError);
const parseAsync = /* @__PURE__ */ _parseAsync(ZodRealError);
const safeParse = /* @__PURE__ */ _safeParse(ZodRealError);
const safeParseAsync = /* @__PURE__ */ _safeParseAsync(ZodRealError);
const encode = /* @__PURE__ */ _encode(ZodRealError);
const decode = /* @__PURE__ */ _decode(ZodRealError);
const encodeAsync = /* @__PURE__ */ _encodeAsync(ZodRealError);
const decodeAsync = /* @__PURE__ */ _decodeAsync(ZodRealError);
const safeEncode = /* @__PURE__ */ _safeEncode(ZodRealError);
const safeDecode = /* @__PURE__ */ _safeDecode(ZodRealError);
const safeEncodeAsync = /* @__PURE__ */ _safeEncodeAsync(ZodRealError);
const safeDecodeAsync = /* @__PURE__ */ _safeDecodeAsync(ZodRealError);
const _installedGroups = /* @__PURE__ */ new WeakMap();
function _installLazyMethods(inst, group, methods) {
  const proto = Object.getPrototypeOf(inst);
  let installed = _installedGroups.get(proto);
  if (!installed) {
    installed = /* @__PURE__ */ new Set();
    _installedGroups.set(proto, installed);
  }
  if (installed.has(group))
    return;
  installed.add(group);
  for (const key in methods) {
    const fn = methods[key];
    Object.defineProperty(proto, key, {
      configurable: true,
      enumerable: false,
      get() {
        const bound = fn.bind(this);
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: bound
        });
        return bound;
      },
      set(v) {
        Object.defineProperty(this, key, {
          configurable: true,
          writable: true,
          enumerable: true,
          value: v
        });
      }
    });
  }
}
const ZodType = /* @__PURE__ */ $constructor("ZodType", (inst, def) => {
  $ZodType.init(inst, def);
  Object.assign(inst["~standard"], {
    jsonSchema: {
      input: createStandardJSONSchemaMethod(inst, "input"),
      output: createStandardJSONSchemaMethod(inst, "output")
    }
  });
  inst.toJSONSchema = createToJSONSchemaMethod(inst, {});
  inst.def = def;
  inst.type = def.type;
  Object.defineProperty(inst, "_def", { value: def });
  inst.parse = (data, params) => parse(inst, data, params, { callee: inst.parse });
  inst.safeParse = (data, params) => safeParse(inst, data, params);
  inst.parseAsync = async (data, params) => parseAsync(inst, data, params, { callee: inst.parseAsync });
  inst.safeParseAsync = async (data, params) => safeParseAsync(inst, data, params);
  inst.spa = inst.safeParseAsync;
  inst.encode = (data, params) => encode(inst, data, params);
  inst.decode = (data, params) => decode(inst, data, params);
  inst.encodeAsync = async (data, params) => encodeAsync(inst, data, params);
  inst.decodeAsync = async (data, params) => decodeAsync(inst, data, params);
  inst.safeEncode = (data, params) => safeEncode(inst, data, params);
  inst.safeDecode = (data, params) => safeDecode(inst, data, params);
  inst.safeEncodeAsync = async (data, params) => safeEncodeAsync(inst, data, params);
  inst.safeDecodeAsync = async (data, params) => safeDecodeAsync(inst, data, params);
  _installLazyMethods(inst, "ZodType", {
    check(...chks) {
      const def2 = this.def;
      return this.clone(mergeDefs(def2, {
        checks: [
          ...def2.checks ?? [],
          ...chks.map((ch) => typeof ch === "function" ? { _zod: { check: ch, def: { check: "custom" }, onattach: [] } } : ch)
        ]
      }), { parent: true });
    },
    with(...chks) {
      return this.check(...chks);
    },
    clone(def2, params) {
      return clone(this, def2, params);
    },
    brand() {
      return this;
    },
    register(reg, meta) {
      reg.add(this, meta);
      return this;
    },
    refine(check, params) {
      return this.check(refine(check, params));
    },
    superRefine(refinement, params) {
      return this.check(superRefine(refinement, params));
    },
    overwrite(fn) {
      return this.check(/* @__PURE__ */ _overwrite(fn));
    },
    optional() {
      return optional(this);
    },
    exactOptional() {
      return exactOptional(this);
    },
    nullable() {
      return nullable(this);
    },
    nullish() {
      return optional(nullable(this));
    },
    nonoptional(params) {
      return nonoptional(this, params);
    },
    array() {
      return array(this);
    },
    or(arg) {
      return union([this, arg]);
    },
    and(arg) {
      return intersection(this, arg);
    },
    transform(tx) {
      return pipe(this, transform(tx));
    },
    default(d) {
      return _default(this, d);
    },
    prefault(d) {
      return prefault(this, d);
    },
    catch(params) {
      return _catch(this, params);
    },
    pipe(target) {
      return pipe(this, target);
    },
    readonly() {
      return readonly(this);
    },
    describe(description) {
      const cl = this.clone();
      globalRegistry.add(cl, { description });
      return cl;
    },
    meta(...args) {
      if (args.length === 0)
        return globalRegistry.get(this);
      const cl = this.clone();
      globalRegistry.add(cl, args[0]);
      return cl;
    },
    isOptional() {
      return this.safeParse(void 0).success;
    },
    isNullable() {
      return this.safeParse(null).success;
    },
    apply(fn) {
      return fn(this);
    }
  });
  Object.defineProperty(inst, "description", {
    get() {
      var _a3;
      return (_a3 = globalRegistry.get(inst)) == null ? void 0 : _a3.description;
    },
    configurable: true
  });
  return inst;
});
const _ZodString = /* @__PURE__ */ $constructor("_ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => stringProcessor(inst, ctx, json);
  const bag = inst._zod.bag;
  inst.format = bag.format ?? null;
  inst.minLength = bag.minimum ?? null;
  inst.maxLength = bag.maximum ?? null;
  _installLazyMethods(inst, "_ZodString", {
    regex(...args) {
      return this.check(/* @__PURE__ */ _regex(...args));
    },
    includes(...args) {
      return this.check(/* @__PURE__ */ _includes(...args));
    },
    startsWith(...args) {
      return this.check(/* @__PURE__ */ _startsWith(...args));
    },
    endsWith(...args) {
      return this.check(/* @__PURE__ */ _endsWith(...args));
    },
    min(...args) {
      return this.check(/* @__PURE__ */ _minLength(...args));
    },
    max(...args) {
      return this.check(/* @__PURE__ */ _maxLength(...args));
    },
    length(...args) {
      return this.check(/* @__PURE__ */ _length(...args));
    },
    nonempty(...args) {
      return this.check(/* @__PURE__ */ _minLength(1, ...args));
    },
    lowercase(params) {
      return this.check(/* @__PURE__ */ _lowercase(params));
    },
    uppercase(params) {
      return this.check(/* @__PURE__ */ _uppercase(params));
    },
    trim() {
      return this.check(/* @__PURE__ */ _trim());
    },
    normalize(...args) {
      return this.check(/* @__PURE__ */ _normalize(...args));
    },
    toLowerCase() {
      return this.check(/* @__PURE__ */ _toLowerCase());
    },
    toUpperCase() {
      return this.check(/* @__PURE__ */ _toUpperCase());
    },
    slugify() {
      return this.check(/* @__PURE__ */ _slugify());
    }
  });
});
const ZodString = /* @__PURE__ */ $constructor("ZodString", (inst, def) => {
  $ZodString.init(inst, def);
  _ZodString.init(inst, def);
  inst.email = (params) => inst.check(/* @__PURE__ */ _email(ZodEmail, params));
  inst.url = (params) => inst.check(/* @__PURE__ */ _url(ZodURL, params));
  inst.jwt = (params) => inst.check(/* @__PURE__ */ _jwt(ZodJWT, params));
  inst.emoji = (params) => inst.check(/* @__PURE__ */ _emoji(ZodEmoji, params));
  inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
  inst.uuid = (params) => inst.check(/* @__PURE__ */ _uuid(ZodUUID, params));
  inst.uuidv4 = (params) => inst.check(/* @__PURE__ */ _uuidv4(ZodUUID, params));
  inst.uuidv6 = (params) => inst.check(/* @__PURE__ */ _uuidv6(ZodUUID, params));
  inst.uuidv7 = (params) => inst.check(/* @__PURE__ */ _uuidv7(ZodUUID, params));
  inst.nanoid = (params) => inst.check(/* @__PURE__ */ _nanoid(ZodNanoID, params));
  inst.guid = (params) => inst.check(/* @__PURE__ */ _guid(ZodGUID, params));
  inst.cuid = (params) => inst.check(/* @__PURE__ */ _cuid(ZodCUID, params));
  inst.cuid2 = (params) => inst.check(/* @__PURE__ */ _cuid2(ZodCUID2, params));
  inst.ulid = (params) => inst.check(/* @__PURE__ */ _ulid(ZodULID, params));
  inst.base64 = (params) => inst.check(/* @__PURE__ */ _base64(ZodBase64, params));
  inst.base64url = (params) => inst.check(/* @__PURE__ */ _base64url(ZodBase64URL, params));
  inst.xid = (params) => inst.check(/* @__PURE__ */ _xid(ZodXID, params));
  inst.ksuid = (params) => inst.check(/* @__PURE__ */ _ksuid(ZodKSUID, params));
  inst.ipv4 = (params) => inst.check(/* @__PURE__ */ _ipv4(ZodIPv4, params));
  inst.ipv6 = (params) => inst.check(/* @__PURE__ */ _ipv6(ZodIPv6, params));
  inst.cidrv4 = (params) => inst.check(/* @__PURE__ */ _cidrv4(ZodCIDRv4, params));
  inst.cidrv6 = (params) => inst.check(/* @__PURE__ */ _cidrv6(ZodCIDRv6, params));
  inst.e164 = (params) => inst.check(/* @__PURE__ */ _e164(ZodE164, params));
  inst.datetime = (params) => inst.check(datetime(params));
  inst.date = (params) => inst.check(date(params));
  inst.time = (params) => inst.check(time(params));
  inst.duration = (params) => inst.check(duration(params));
});
function string(params) {
  return /* @__PURE__ */ _string(ZodString, params);
}
const ZodStringFormat = /* @__PURE__ */ $constructor("ZodStringFormat", (inst, def) => {
  $ZodStringFormat.init(inst, def);
  _ZodString.init(inst, def);
});
const ZodEmail = /* @__PURE__ */ $constructor("ZodEmail", (inst, def) => {
  $ZodEmail.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodGUID = /* @__PURE__ */ $constructor("ZodGUID", (inst, def) => {
  $ZodGUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodUUID = /* @__PURE__ */ $constructor("ZodUUID", (inst, def) => {
  $ZodUUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodURL = /* @__PURE__ */ $constructor("ZodURL", (inst, def) => {
  $ZodURL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodEmoji = /* @__PURE__ */ $constructor("ZodEmoji", (inst, def) => {
  $ZodEmoji.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNanoID = /* @__PURE__ */ $constructor("ZodNanoID", (inst, def) => {
  $ZodNanoID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID = /* @__PURE__ */ $constructor("ZodCUID", (inst, def) => {
  $ZodCUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCUID2 = /* @__PURE__ */ $constructor("ZodCUID2", (inst, def) => {
  $ZodCUID2.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodULID = /* @__PURE__ */ $constructor("ZodULID", (inst, def) => {
  $ZodULID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodXID = /* @__PURE__ */ $constructor("ZodXID", (inst, def) => {
  $ZodXID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodKSUID = /* @__PURE__ */ $constructor("ZodKSUID", (inst, def) => {
  $ZodKSUID.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv4 = /* @__PURE__ */ $constructor("ZodIPv4", (inst, def) => {
  $ZodIPv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodIPv6 = /* @__PURE__ */ $constructor("ZodIPv6", (inst, def) => {
  $ZodIPv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv4 = /* @__PURE__ */ $constructor("ZodCIDRv4", (inst, def) => {
  $ZodCIDRv4.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodCIDRv6 = /* @__PURE__ */ $constructor("ZodCIDRv6", (inst, def) => {
  $ZodCIDRv6.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64 = /* @__PURE__ */ $constructor("ZodBase64", (inst, def) => {
  $ZodBase64.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodBase64URL = /* @__PURE__ */ $constructor("ZodBase64URL", (inst, def) => {
  $ZodBase64URL.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodE164 = /* @__PURE__ */ $constructor("ZodE164", (inst, def) => {
  $ZodE164.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodJWT = /* @__PURE__ */ $constructor("ZodJWT", (inst, def) => {
  $ZodJWT.init(inst, def);
  ZodStringFormat.init(inst, def);
});
const ZodNumber = /* @__PURE__ */ $constructor("ZodNumber", (inst, def) => {
  $ZodNumber.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => numberProcessor(inst, ctx, json);
  _installLazyMethods(inst, "ZodNumber", {
    gt(value, params) {
      return this.check(/* @__PURE__ */ _gt(value, params));
    },
    gte(value, params) {
      return this.check(/* @__PURE__ */ _gte(value, params));
    },
    min(value, params) {
      return this.check(/* @__PURE__ */ _gte(value, params));
    },
    lt(value, params) {
      return this.check(/* @__PURE__ */ _lt(value, params));
    },
    lte(value, params) {
      return this.check(/* @__PURE__ */ _lte(value, params));
    },
    max(value, params) {
      return this.check(/* @__PURE__ */ _lte(value, params));
    },
    int(params) {
      return this.check(int(params));
    },
    safe(params) {
      return this.check(int(params));
    },
    positive(params) {
      return this.check(/* @__PURE__ */ _gt(0, params));
    },
    nonnegative(params) {
      return this.check(/* @__PURE__ */ _gte(0, params));
    },
    negative(params) {
      return this.check(/* @__PURE__ */ _lt(0, params));
    },
    nonpositive(params) {
      return this.check(/* @__PURE__ */ _lte(0, params));
    },
    multipleOf(value, params) {
      return this.check(/* @__PURE__ */ _multipleOf(value, params));
    },
    step(value, params) {
      return this.check(/* @__PURE__ */ _multipleOf(value, params));
    },
    finite() {
      return this;
    }
  });
  const bag = inst._zod.bag;
  inst.minValue = Math.max(bag.minimum ?? Number.NEGATIVE_INFINITY, bag.exclusiveMinimum ?? Number.NEGATIVE_INFINITY) ?? null;
  inst.maxValue = Math.min(bag.maximum ?? Number.POSITIVE_INFINITY, bag.exclusiveMaximum ?? Number.POSITIVE_INFINITY) ?? null;
  inst.isInt = (bag.format ?? "").includes("int") || Number.isSafeInteger(bag.multipleOf ?? 0.5);
  inst.isFinite = true;
  inst.format = bag.format ?? null;
});
function number(params) {
  return /* @__PURE__ */ _number(ZodNumber, params);
}
const ZodNumberFormat = /* @__PURE__ */ $constructor("ZodNumberFormat", (inst, def) => {
  $ZodNumberFormat.init(inst, def);
  ZodNumber.init(inst, def);
});
function int(params) {
  return /* @__PURE__ */ _int(ZodNumberFormat, params);
}
const ZodBoolean = /* @__PURE__ */ $constructor("ZodBoolean", (inst, def) => {
  $ZodBoolean.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => booleanProcessor(inst, ctx, json);
});
function boolean(params) {
  return /* @__PURE__ */ _boolean(ZodBoolean, params);
}
const ZodUnknown = /* @__PURE__ */ $constructor("ZodUnknown", (inst, def) => {
  $ZodUnknown.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unknownProcessor();
});
function unknown() {
  return /* @__PURE__ */ _unknown(ZodUnknown);
}
const ZodNever = /* @__PURE__ */ $constructor("ZodNever", (inst, def) => {
  $ZodNever.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => neverProcessor(inst, ctx, json);
});
function never(params) {
  return /* @__PURE__ */ _never(ZodNever, params);
}
const ZodArray = /* @__PURE__ */ $constructor("ZodArray", (inst, def) => {
  $ZodArray.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => arrayProcessor(inst, ctx, json, params);
  inst.element = def.element;
  _installLazyMethods(inst, "ZodArray", {
    min(n, params) {
      return this.check(/* @__PURE__ */ _minLength(n, params));
    },
    nonempty(params) {
      return this.check(/* @__PURE__ */ _minLength(1, params));
    },
    max(n, params) {
      return this.check(/* @__PURE__ */ _maxLength(n, params));
    },
    length(n, params) {
      return this.check(/* @__PURE__ */ _length(n, params));
    },
    unwrap() {
      return this.element;
    }
  });
});
function array(element, params) {
  return /* @__PURE__ */ _array(ZodArray, element, params);
}
const ZodObject = /* @__PURE__ */ $constructor("ZodObject", (inst, def) => {
  $ZodObjectJIT.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => objectProcessor(inst, ctx, json, params);
  defineLazy(inst, "shape", () => {
    return def.shape;
  });
  _installLazyMethods(inst, "ZodObject", {
    keyof() {
      return _enum(Object.keys(this._zod.def.shape));
    },
    catchall(catchall) {
      return this.clone({ ...this._zod.def, catchall });
    },
    passthrough() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    loose() {
      return this.clone({ ...this._zod.def, catchall: unknown() });
    },
    strict() {
      return this.clone({ ...this._zod.def, catchall: never() });
    },
    strip() {
      return this.clone({ ...this._zod.def, catchall: void 0 });
    },
    extend(incoming) {
      return extend(this, incoming);
    },
    safeExtend(incoming) {
      return safeExtend(this, incoming);
    },
    merge(other) {
      return merge(this, other);
    },
    pick(mask) {
      return pick(this, mask);
    },
    omit(mask) {
      return omit(this, mask);
    },
    partial(...args) {
      return partial(ZodOptional, this, args[0]);
    },
    required(...args) {
      return required(ZodNonOptional, this, args[0]);
    }
  });
});
function object(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject(def);
}
const ZodUnion = /* @__PURE__ */ $constructor("ZodUnion", (inst, def) => {
  $ZodUnion.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => unionProcessor(inst, ctx, json, params);
  inst.options = def.options;
});
function union(options, params) {
  return new ZodUnion({
    type: "union",
    options,
    ...normalizeParams(params)
  });
}
const ZodDiscriminatedUnion = /* @__PURE__ */ $constructor("ZodDiscriminatedUnion", (inst, def) => {
  ZodUnion.init(inst, def);
  $ZodDiscriminatedUnion.init(inst, def);
});
function discriminatedUnion(discriminator, options, params) {
  return new ZodDiscriminatedUnion({
    type: "union",
    options,
    discriminator,
    ...normalizeParams(params)
  });
}
const ZodIntersection = /* @__PURE__ */ $constructor("ZodIntersection", (inst, def) => {
  $ZodIntersection.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => intersectionProcessor(inst, ctx, json, params);
});
function intersection(left, right) {
  return new ZodIntersection({
    type: "intersection",
    left,
    right
  });
}
const ZodTuple = /* @__PURE__ */ $constructor("ZodTuple", (inst, def) => {
  $ZodTuple.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => tupleProcessor(inst, ctx, json, params);
  inst.rest = (rest) => inst.clone({
    ...inst._zod.def,
    rest
  });
});
function tuple(items, _paramsOrRest, _params) {
  const hasRest = _paramsOrRest instanceof $ZodType;
  const params = hasRest ? _params : _paramsOrRest;
  const rest = hasRest ? _paramsOrRest : null;
  return new ZodTuple({
    type: "tuple",
    items,
    rest,
    ...normalizeParams(params)
  });
}
const ZodRecord = /* @__PURE__ */ $constructor("ZodRecord", (inst, def) => {
  $ZodRecord.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => recordProcessor(inst, ctx, json, params);
  inst.keyType = def.keyType;
  inst.valueType = def.valueType;
});
function record(keyType, valueType, params) {
  if (!valueType || !valueType._zod) {
    return new ZodRecord({
      type: "record",
      keyType: string(),
      valueType: keyType,
      ...normalizeParams(valueType)
    });
  }
  return new ZodRecord({
    type: "record",
    keyType,
    valueType,
    ...normalizeParams(params)
  });
}
const ZodEnum = /* @__PURE__ */ $constructor("ZodEnum", (inst, def) => {
  $ZodEnum.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => enumProcessor(inst, ctx, json);
  inst.enum = def.entries;
  inst.options = Object.values(def.entries);
  const keys = new Set(Object.keys(def.entries));
  inst.extract = (values, params) => {
    const newEntries = {};
    for (const value of values) {
      if (keys.has(value)) {
        newEntries[value] = def.entries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values, params) => {
    const newEntries = { ...def.entries };
    for (const value of values) {
      if (keys.has(value)) {
        delete newEntries[value];
      } else
        throw new Error(`Key ${value} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values, params) {
  const entries = Array.isArray(values) ? Object.fromEntries(values.map((v) => [v, v])) : values;
  return new ZodEnum({
    type: "enum",
    entries,
    ...normalizeParams(params)
  });
}
const ZodLiteral = /* @__PURE__ */ $constructor("ZodLiteral", (inst, def) => {
  $ZodLiteral.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => literalProcessor(inst, ctx, json);
  inst.values = new Set(def.values);
  Object.defineProperty(inst, "value", {
    get() {
      if (def.values.length > 1) {
        throw new Error("This schema contains multiple valid literal values. Use `.values` instead.");
      }
      return def.values[0];
    }
  });
});
function literal(value, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value) ? value : [value],
    ...normalizeParams(params)
  });
}
const ZodTransform = /* @__PURE__ */ $constructor("ZodTransform", (inst, def) => {
  $ZodTransform.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => transformProcessor(inst, ctx);
  inst._zod.parse = (payload, _ctx) => {
    if (_ctx.direction === "backward") {
      throw new $ZodEncodeError(inst.constructor.name);
    }
    payload.addIssue = (issue$1) => {
      if (typeof issue$1 === "string") {
        payload.issues.push(issue(issue$1, payload.value, def));
      } else {
        const _issue = issue$1;
        if (_issue.fatal)
          _issue.continue = false;
        _issue.code ?? (_issue.code = "custom");
        _issue.input ?? (_issue.input = payload.value);
        _issue.inst ?? (_issue.inst = inst);
        payload.issues.push(issue(_issue));
      }
    };
    const output = def.transform(payload.value, payload);
    if (output instanceof Promise) {
      return output.then((output2) => {
        payload.value = output2;
        payload.fallback = true;
        return payload;
      });
    }
    payload.value = output;
    payload.fallback = true;
    return payload;
  };
});
function transform(fn) {
  return new ZodTransform({
    type: "transform",
    transform: fn
  });
}
const ZodOptional = /* @__PURE__ */ $constructor("ZodOptional", (inst, def) => {
  $ZodOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function optional(innerType) {
  return new ZodOptional({
    type: "optional",
    innerType
  });
}
const ZodExactOptional = /* @__PURE__ */ $constructor("ZodExactOptional", (inst, def) => {
  $ZodExactOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => optionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function exactOptional(innerType) {
  return new ZodExactOptional({
    type: "optional",
    innerType
  });
}
const ZodNullable = /* @__PURE__ */ $constructor("ZodNullable", (inst, def) => {
  $ZodNullable.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nullableProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nullable(innerType) {
  return new ZodNullable({
    type: "nullable",
    innerType
  });
}
const ZodDefault = /* @__PURE__ */ $constructor("ZodDefault", (inst, def) => {
  $ZodDefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => defaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeDefault = inst.unwrap;
});
function _default(innerType, defaultValue) {
  return new ZodDefault({
    type: "default",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodPrefault = /* @__PURE__ */ $constructor("ZodPrefault", (inst, def) => {
  $ZodPrefault.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => prefaultProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function prefault(innerType, defaultValue) {
  return new ZodPrefault({
    type: "prefault",
    innerType,
    get defaultValue() {
      return typeof defaultValue === "function" ? defaultValue() : shallowClone(defaultValue);
    }
  });
}
const ZodNonOptional = /* @__PURE__ */ $constructor("ZodNonOptional", (inst, def) => {
  $ZodNonOptional.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => nonoptionalProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function nonoptional(innerType, params) {
  return new ZodNonOptional({
    type: "nonoptional",
    innerType,
    ...normalizeParams(params)
  });
}
const ZodCatch = /* @__PURE__ */ $constructor("ZodCatch", (inst, def) => {
  $ZodCatch.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => catchProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
  inst.removeCatch = inst.unwrap;
});
function _catch(innerType, catchValue) {
  return new ZodCatch({
    type: "catch",
    innerType,
    catchValue: typeof catchValue === "function" ? catchValue : () => catchValue
  });
}
const ZodPipe = /* @__PURE__ */ $constructor("ZodPipe", (inst, def) => {
  $ZodPipe.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => pipeProcessor(inst, ctx, json, params);
  inst.in = def.in;
  inst.out = def.out;
});
function pipe(in_, out) {
  return new ZodPipe({
    type: "pipe",
    in: in_,
    out
    // ...util.normalizeParams(params),
  });
}
const ZodReadonly = /* @__PURE__ */ $constructor("ZodReadonly", (inst, def) => {
  $ZodReadonly.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => readonlyProcessor(inst, ctx, json, params);
  inst.unwrap = () => inst._zod.def.innerType;
});
function readonly(innerType) {
  return new ZodReadonly({
    type: "readonly",
    innerType
  });
}
const ZodCustom = /* @__PURE__ */ $constructor("ZodCustom", (inst, def) => {
  $ZodCustom.init(inst, def);
  ZodType.init(inst, def);
  inst._zod.processJSONSchema = (ctx, json, params) => customProcessor(inst, ctx);
});
function refine(fn, _params = {}) {
  return /* @__PURE__ */ _refine(ZodCustom, fn, _params);
}
function superRefine(fn, params) {
  return /* @__PURE__ */ _superRefine(fn, params);
}
const protocolIdSchema = string().trim().min(1).max(256);
const contentDigestSchema = string().trim().min(1).max(512);
const idSchema$3 = protocolIdSchema;
const digestSchema$1 = contentDigestSchema;
const drawingRefSchema$1 = object({
  drawingId: idSchema$3,
  revision: number().int().nonnegative()
}).strict();
const editBasisSchema = discriminatedUnion("kind", [
  object({
    kind: literal("canonical"),
    ref: drawingRefSchema$1
  }).strict(),
  object({
    kind: literal("preview"),
    baseRef: drawingRefSchema$1,
    previewHandle: idSchema$3,
    previewDigest: digestSchema$1
  }).strict(),
  object({
    kind: literal("carried-candidate"),
    handoffId: idSchema$3,
    taskId: idSchema$3,
    originTaskId: idSchema$3,
    baseRef: drawingRefSchema$1,
    candidateDigest: digestSchema$1
  }).strict()
]);
const observationArtifactRefSchema = object({
  id: idSchema$3,
  contentDigest: digestSchema$1,
  mimeType: _enum(["image/png", "image/webp"]),
  basis: editBasisSchema
}).strict();
object({
  taskId: idSchema$3,
  rootUserMessageDigest: digestSchema$1,
  authoritativeObjectiveDigest: digestSchema$1,
  baseRef: drawingRefSchema$1,
  policy: _enum(["review", "auto-safe"]),
  stateEpoch: number().int().nonnegative()
}).strict();
object({
  observationId: idSchema$3,
  taskId: idSchema$3,
  basis: editBasisSchema,
  artifactRefs: array(observationArtifactRefSchema).max(16),
  selectionProjectionId: idSchema$3.optional(),
  observationDigest: digestSchema$1
}).strict();
object({
  contextId: idSchema$3,
  taskId: idSchema$3,
  observationId: idSchema$3,
  contextDigest: digestSchema$1
}).strict();
object({
  groundingId: idSchema$3,
  taskId: idSchema$3,
  contextId: idSchema$3,
  targetHandle: idSchema$3,
  targetNodeIds: array(idSchema$3).min(1).max(256),
  interfaces: array(object({
    interfaceId: idSchema$3,
    nodeId: idSchema$3,
    endpoint: _enum(["start", "end"])
  }).strict()).max(256),
  targetScopeDigest: digestSchema$1,
  protectedScopeDigest: digestSchema$1,
  evidenceDigest: digestSchema$1
}).strict();
object({
  previewHandle: idSchema$3,
  taskId: idSchema$3,
  groundingId: idSchema$3,
  baseRef: drawingRefSchema$1,
  candidateDigest: digestSchema$1,
  effectDigest: digestSchema$1,
  finalizeOperationId: idSchema$3,
  finalizeOperationBindingDigest: digestSchema$1
}).strict();
object({
  evaluationId: idSchema$3,
  taskId: idSchema$3,
  previewHandle: idSchema$3,
  candidateDigest: digestSchema$1,
  evaluationDigest: digestSchema$1
}).strict();
const selectionProjectionRefSchema = object({
  selectionProjectionId: idSchema$3,
  drawingRef: drawingRefSchema$1,
  nodeIds: array(idSchema$3).min(1).max(256),
  projectionDigest: digestSchema$1,
  expiresAt: number().int().nonnegative()
}).strict();
const idSchema$2 = string().trim().min(1).max(256);
const digestSchema = string().trim().min(1).max(512);
const finalizePreviewRequestSchema = object({
  previewHandle: idSchema$2,
  previewDigest: digestSchema,
  finalizeOperationId: idSchema$2,
  finalizeOperationBindingDigest: digestSchema,
  evaluationId: idSchema$2
}).strict();
const finalizePreviewResultSchema = discriminatedUnion("status", [
  object({
    status: literal("committed"),
    mode: _enum(["auto-safe", "confirmed"]),
    commitId: idSchema$2,
    ref: drawingRefSchema$1,
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict(),
  object({
    status: literal("already-satisfied"),
    ref: drawingRefSchema$1,
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict(),
  object({
    status: literal("root-required"),
    message: string().trim().min(1).max(2e3)
  }).strict(),
  object({
    status: literal("needs-revision"),
    evaluationId: idSchema$2,
    reasons: array(string().trim().min(1).max(1e3)).min(1).max(64)
  }).strict(),
  object({
    status: literal("discarded"),
    ref: drawingRefSchema$1
  }).strict(),
  object({
    status: literal("rejected"),
    disposition: _enum(["blocked", "confirmation_required"]),
    code: idSchema$2,
    message: string().trim().min(1).max(2e3)
  }).strict(),
  object({
    status: literal("outcome-unknown"),
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict()
]);
const idSchema$1 = string().trim().min(1).max(256);
const boundedTextSchema = string().trim().min(1).max(2e3);
const finiteSchema = number().finite();
const vec2Schema$1 = tuple([finiteSchema, finiteSchema]);
const boundsSchema = object({
  minX: finiteSchema,
  minY: finiteSchema,
  maxX: finiteSchema,
  maxY: finiteSchema
}).strict().refine(
  ({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY,
  { message: "INVALID_BOUNDS" }
);
const effectScopeRefSchema = discriminatedUnion("kind", [
  object({
    kind: literal("node-field"),
    nodeId: idSchema$1,
    fields: array(idSchema$1).min(1).max(64)
  }).strict(),
  object({
    kind: literal("source-span"),
    nodeId: idSchema$1,
    start: number().int().nonnegative(),
    end: number().int().positive()
  }).strict().refine(({ start, end }) => start < end, { message: "INVALID_SOURCE_SPAN" }),
  object({
    kind: literal("half-edge"),
    nodeId: idSchema$1,
    halfEdgeId: idSchema$1
  }).strict(),
  object({
    kind: literal("interface"),
    interfaceId: idSchema$1
  }).strict(),
  object({
    kind: literal("endpoint-slot"),
    nodeId: idSchema$1,
    endpoint: _enum(["start", "end"])
  }).strict(),
  object({
    kind: literal("creation"),
    plane: _enum(["geometry", "annotation", "relation", "feature"]),
    nodeType: idSchema$1,
    containerId: idSchema$1.optional(),
    maxCount: number().int().min(1).max(256)
  }).strict(),
  object({
    kind: literal("deletion"),
    nodeIds: array(idSchema$1).min(1).max(256)
  }).strict()
]);
const spatialOperationSchema = discriminatedUnion("kind", [
  object({
    kind: literal("rigid_transform"),
    translation: vec2Schema$1,
    rotationRadians: finiteSchema,
    pivot: vec2Schema$1
  }).strict(),
  object({
    kind: literal("connected_transform"),
    translation: vec2Schema$1,
    rotationRadians: finiteSchema.optional(),
    pivot: vec2Schema$1.optional(),
    interfaceIds: array(idSchema$1).min(1).max(256)
  }).strict(),
  object({
    kind: literal("set_endpoint"),
    nodeId: idSchema$1,
    endpoint: _enum(["start", "end"]),
    point: vec2Schema$1
  }).strict(),
  object({
    kind: literal("create_path"),
    nodeId: idSchema$1,
    points: array(vec2Schema$1).min(2).max(4096),
    closed: boolean()
  }).strict(),
  object({
    kind: literal("delete_nodes"),
    nodeIds: array(idSchema$1).min(1).max(256)
  }).strict(),
  object({
    kind: literal("create_annotation_batch"),
    annotations: array(object({ id: idSchema$1, type: idSchema$1 }).catchall(unknown())).min(1).max(512),
    associations: array(object({ id: idSchema$1, type: literal("association") }).catchall(unknown())).max(512)
  }).strict()
]);
const spatialPostconditionSchema = discriminatedUnion("kind", [
  object({
    kind: literal("preserve_connectivity"),
    nodeIds: array(idSchema$1).min(1).max(256)
  }).strict(),
  object({
    kind: literal("within_bounds"),
    bounds: boundsSchema
  }).strict(),
  object({
    kind: literal("target_position"),
    targetHandle: idSchema$1,
    point: vec2Schema$1,
    tolerance: finiteSchema.positive()
  }).strict()
]);
const spatialEditProgramSchema = object({
  baseRef: drawingRefSchema$1,
  targetHandle: idSchema$1,
  summary: boundedTextSchema,
  objective: boundedTextSchema,
  operations: array(spatialOperationSchema).min(1).max(128),
  preserveScopes: array(effectScopeRefSchema).max(512),
  postconditions: array(spatialPostconditionSchema).max(128),
  evidenceRefs: array(idSchema$1).min(1).max(256)
}).strict();
const idSchema = string().min(1);
const vec2Schema = tuple([number(), number()]);
const qualitySchema = object({
  status: _enum(["confirmed", "candidate"]),
  confidence: number().optional(),
  evidenceRefs: array(idSchema)
}).strict();
const baseNodeShape = {
  id: idSchema,
  visible: boolean(),
  quality: qualitySchema
};
const geometrySchema = discriminatedUnion("type", [
  object({ ...baseNodeShape, type: literal("point"), x: number(), y: number() }).strict(),
  object({ ...baseNodeShape, type: literal("line"), start: vec2Schema, end: vec2Schema }).strict(),
  object({ ...baseNodeShape, type: literal("ray"), origin: vec2Schema, direction: vec2Schema }).strict(),
  object({ ...baseNodeShape, type: literal("xline"), origin: vec2Schema, direction: vec2Schema }).strict(),
  object({ ...baseNodeShape, type: literal("circle"), center: vec2Schema, radius: number() }).strict(),
  object({
    ...baseNodeShape,
    type: literal("arc"),
    center: vec2Schema,
    radius: number(),
    startAngle: number(),
    endAngle: number(),
    counterClockwise: boolean()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("ellipse"),
    center: vec2Schema,
    majorAxis: vec2Schema,
    ratio: number(),
    startParam: number().optional(),
    endParam: number().optional()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("polyline"),
    vertices: array(object({ point: vec2Schema, bulge: number().optional() }).strict()),
    closed: boolean()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("spline"),
    degree: number().int().nonnegative(),
    controlPoints: array(vec2Schema),
    knots: array(number()),
    weights: array(number()).optional(),
    closed: boolean(),
    periodic: boolean()
  }).strict()
]);
const entityAnchorSchema = discriminatedUnion("kind", [
  object({ kind: _enum(["start", "end", "center"]) }).strict(),
  object({ kind: literal("vertex"), index: number().int().nonnegative() }).strict(),
  object({ kind: literal("curve-parameter"), parameter: number() }).strict(),
  object({ kind: literal("nearest"), point: vec2Schema }).strict()
]);
const dimensionTargetSchema = object({
  geometryId: idSchema,
  anchor: entityAnchorSchema
}).strict();
const dimensionCandidateSchema = object({
  targets: array(dimensionTargetSchema),
  score: number(),
  reasons: array(string())
}).strict();
const annotationSchema = discriminatedUnion("type", [
  object({
    ...baseNodeShape,
    type: literal("text"),
    content: string(),
    position: vec2Schema,
    height: number(),
    rotation: number(),
    alignment: _enum(["left", "center", "right"]),
    verticalAlignment: _enum(["baseline", "bottom", "middle", "top"]),
    maxWidth: number().optional()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("dimension"),
    dimensionKind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
    associationStatus: _enum(["resolved", "ambiguous", "conflict"]),
    targets: array(dimensionTargetSchema),
    candidates: array(dimensionCandidateSchema).optional(),
    observedValue: number().optional(),
    computedValue: number().optional(),
    displayText: string().optional(),
    unit: _enum(["mm", "cm", "m", "deg"]).optional(),
    tolerance: object({ upper: number().optional(), lower: number().optional() }).strict().optional(),
    prefix: string().optional(),
    suffix: string().optional(),
    textPosition: vec2Schema,
    definitionPoints: array(vec2Schema)
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("leader"),
    target: dimensionTargetSchema,
    points: array(vec2Schema),
    content: string(),
    textHeight: number()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("centerline"),
    targets: array(idSchema),
    start: vec2Schema,
    end: vec2Schema,
    extension: number()
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("section-hatch"),
    pattern: string(),
    angle: number(),
    spacing: number(),
    segments: array(object({ start: vec2Schema, end: vec2Schema }).strict())
  }).strict()
]);
const relationSchema = discriminatedUnion("plane", [
  object({
    ...baseNodeShape,
    type: literal("topology"),
    plane: literal("topology"),
    kind: _enum(["connected", "closed", "contains", "intersects"]),
    nodeIds: array(idSchema)
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("constraint"),
    plane: literal("constraint"),
    kind: _enum(["horizontal", "vertical", "parallel", "perpendicular", "tangent", "concentric", "equal", "distance", "radius", "angle", "symmetry"]),
    geometryIds: array(idSchema),
    value: number().optional(),
    property: string().optional(),
    status: _enum(["defined", "satisfied", "violated", "unsolved"])
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("association"),
    plane: literal("association"),
    kind: literal("annotation-target"),
    annotationId: idSchema,
    geometryIds: array(idSchema)
  }).strict(),
  object({
    ...baseNodeShape,
    type: literal("semantic"),
    plane: literal("semantic"),
    kind: literal("feature-member"),
    featureId: idSchema,
    nodeIds: array(idSchema)
  }).strict()
]);
const featureSchema = object({
  ...baseNodeShape,
  type: literal("feature"),
  semanticType: string(),
  geometryIds: array(idSchema),
  annotationIds: array(idSchema),
  relationIds: array(idSchema),
  properties: record(string(), unknown())
}).strict();
const drawingDocumentSchema = object({
  protocol: literal("VectorAI-Drawing"),
  schemaVersion: literal("1.0"),
  id: idSchema,
  metadata: object({ createdAt: number(), updatedAt: number() }).strict(),
  unitSystem: object({ length: _enum(["mm", "cm", "m"]), angle: literal("deg") }).strict(),
  coordinateFrames: array(object({
    id: idSchema,
    kind: _enum(["document", "source", "page", "view", "provisional"]),
    transform: tuple([number(), number(), number(), number(), number(), number()]),
    parentId: idSchema.optional()
  }).strict()),
  geometry: array(geometrySchema),
  annotations: array(annotationSchema),
  relations: array(relationSchema),
  features: array(featureSchema)
}).strict();
const bounds2DSchema = object({
  minX: number(),
  minY: number(),
  maxX: number(),
  maxY: number()
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY, { message: "INVALID_QUERY_BOUNDS" });
const drawingPlaneSchema = _enum(["geometry", "annotation", "relation", "feature"]);
const drawingSpatialNodeSchema = discriminatedUnion("plane", [
  object({ plane: literal("geometry"), node: geometrySchema }).strict(),
  object({ plane: literal("annotation"), node: annotationSchema }).strict(),
  object({ plane: literal("relation"), node: relationSchema }).strict(),
  object({ plane: literal("feature"), node: featureSchema }).strict()
]);
const drawingQueryRequestSchema = discriminatedUnion("kind", [
  object({
    kind: literal("world-slice"),
    ref: drawingRefSchema$1,
    bounds: bounds2DSchema,
    planes: array(drawingPlaneSchema).min(1).optional(),
    limit: number().int().min(1).max(200).optional()
  }).strict(),
  object({
    kind: literal("node"),
    ref: drawingRefSchema$1,
    id: idSchema
  }).strict(),
  object({
    kind: literal("neighbors"),
    ref: drawingRefSchema$1,
    nodeId: idSchema,
    limit: number().int().min(1).max(200).optional()
  }).strict()
]);
discriminatedUnion("kind", [
  object({
    kind: literal("world-slice"),
    ref: drawingRefSchema$1,
    bounds: bounds2DSchema,
    nodes: array(drawingSpatialNodeSchema),
    totalByPlane: object({
      geometry: number().int().nonnegative(),
      annotation: number().int().nonnegative(),
      relation: number().int().nonnegative(),
      feature: number().int().nonnegative()
    }).strict(),
    truncated: boolean()
  }).strict(),
  object({
    kind: literal("node"),
    ref: drawingRefSchema$1,
    node: drawingSpatialNodeSchema.nullable()
  }).strict(),
  object({
    kind: literal("neighbors"),
    ref: drawingRefSchema$1,
    nodeId: idSchema,
    nodes: array(drawingSpatialNodeSchema),
    truncated: boolean()
  }).strict()
]);
const drawingSourceRefSchema = object({
  id: idSchema,
  mediaType: _enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
  bytes: number().int().nonnegative().optional(),
  width: number().positive(),
  height: number().positive(),
  name: string().optional()
}).strict();
const drawingWorkspaceSnapshotSchema = object({
  version: literal(1),
  ref: object({ drawingId: idSchema, revision: number().int().nonnegative() }).strict(),
  document: drawingDocumentSchema,
  source: drawingSourceRefSchema.optional(),
  capabilities: object({
    edit: boolean(),
    delete: boolean(),
    annotations: boolean(),
    sourceUnderlay: boolean()
  }).strict(),
  provisional: boolean().optional(),
  lastCommit: object({
    commitId: idSchema,
    mode: _enum(["auto-safe", "confirmed", "interactive", "undo"]),
    undoable: boolean()
  }).strict().optional()
}).strict().nullable();
const nodeCreateCommandSchema = object({
  type: literal("node.create"),
  plane: _enum(["geometry", "annotation", "relation", "feature"]),
  node: union([geometrySchema, annotationSchema, relationSchema, featureSchema])
}).strict().superRefine(({ plane, node }, context) => {
  const matches = plane === "geometry" ? geometrySchema.safeParse(node).success : plane === "annotation" ? annotationSchema.safeParse(node).success : plane === "relation" ? relationSchema.safeParse(node).success : featureSchema.safeParse(node).success;
  if (!matches) context.addIssue({ code: "custom", message: "NODE_PLANE_MISMATCH" });
});
const workspaceCommandSchema = union([
  nodeCreateCommandSchema,
  object({
    type: literal("node.update"),
    id: idSchema,
    changes: record(string(), unknown()),
    expected: record(string(), unknown())
  }).strict(),
  object({ type: literal("node.delete"), id: idSchema }).strict(),
  object({
    type: literal("annotation.move-text"),
    id: idSchema,
    position: vec2Schema,
    expectedPosition: vec2Schema
  }).strict()
]);
object({
  expectedRevision: number().int().nonnegative(),
  commands: array(workspaceCommandSchema).min(1)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("committed"), snapshot: drawingWorkspaceSnapshotSchema.unwrap() }).strict(),
  object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    intentId: idSchema,
    intentDigest: idSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-apply-intent ")
  }).strict(),
  object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
object({
  targetCommitId: idSchema,
  expectedCurrentRef: drawingRefSchema$1
}).strict();
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema$1,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-undo ")
  }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
object({
  expectedRef: drawingRefSchema$1,
  nodeIds: array(idSchema).max(256)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("projected"), projection: selectionProjectionRefSchema }).strict(),
  object({ status: literal("cleared") }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema$1 }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
object({
  ref: drawingRefSchema$1,
  commands: array(workspaceCommandSchema).min(1),
  summary: string().min(1).optional()
}).strict();
const drawingPreviewSchema = object({
  version: literal(1),
  handle: idSchema,
  baseRef: drawingRefSchema$1,
  commands: array(workspaceCommandSchema).min(1),
  candidate: drawingWorkspaceSnapshotSchema.unwrap(),
  diff: object({
    createdNodeIds: array(idSchema),
    updatedNodeIds: array(idSchema),
    deletedNodeIds: array(idSchema)
  }).strict(),
  createdAt: number(),
  summary: string().min(1).optional()
}).strict();
discriminatedUnion("status", [
  object({ status: literal("previewed"), preview: drawingPreviewSchema }).strict(),
  object({ status: literal("conflict"), message: string(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
const drawingPreviewControlRequestSchema = object({ handle: idSchema }).strict();
discriminatedUnion("status", [
  object({ status: literal("discarded"), ref: drawingRefSchema$1 }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
string().min(1);
class InMemoryDrawingRepository {
  constructor(input) {
    __privateAdd(this, _InMemoryDrawingRepository_instances);
    __privateAdd(this, _pending, /* @__PURE__ */ new Map());
    __privateAdd(this, _drawings, /* @__PURE__ */ new Map());
    __privateAdd(this, _durable, /* @__PURE__ */ new Map());
    __privateAdd(this, _previews, /* @__PURE__ */ new Map());
    __privateAdd(this, _vectorizer);
    __privateAdd(this, _drawingId);
    __privateAdd(this, _storage);
    __privateAdd(this, _previewHandle);
    __privateAdd(this, _now);
    __privateSet(this, _vectorizer, input.vectorizer);
    __privateSet(this, _drawingId, input.drawingId ?? ((_sessionId, attachment) => `drawing_${String(attachment.attachmentId)}`));
    __privateSet(this, _storage, input.storage);
    __privateSet(this, _previewHandle, input.previewHandle ?? (() => `preview_${globalThis.crypto.randomUUID()}`));
    __privateSet(this, _now, input.now ?? Date.now);
  }
  bindPending(sessionId, attachment) {
    __privateGet(this, _pending).set(sessionId, structuredClone(attachment));
  }
  getPending(sessionId) {
    const attachment = __privateGet(this, _pending).get(sessionId);
    return attachment === void 0 ? null : structuredClone(attachment);
  }
  async importPending(sessionId, input) {
    var _a3, _b;
    const attachment = __privateGet(this, _pending).get(sessionId);
    if (attachment === void 0) throw new Error("PENDING_DRAWING_SOURCE_REQUIRED");
    const attachmentId = String(attachment.attachmentId);
    const current = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if ((current == null ? void 0 : current.attachmentId) === attachmentId) {
      return {
        status: "already-imported",
        ref: { drawingId: current.drawingId, revision: current.revision },
        provisional: current.provisional
      };
    }
    input.signal.throwIfAborted();
    const drawingId = __privateGet(this, _drawingId).call(this, sessionId, attachment);
    const vectorized = await __privateGet(this, _vectorizer).vectorize({
      drawingId,
      attachment: structuredClone(attachment),
      data: input.data.slice(),
      signal: input.signal
    });
    input.signal.throwIfAborted();
    const entry = {
      attachmentId,
      document: structuredClone(vectorized.document),
      drawingId,
      bounds: structuredClone(vectorized.bounds),
      revision: 1,
      source: {
        id: attachmentId,
        mediaType: attachment.mediaType,
        bytes: attachment.bytes,
        width: attachment.width,
        height: attachment.height,
        ...attachment.name === void 0 ? {} : { name: attachment.name }
      },
      provisional: vectorized.provisional
    };
    if ((_a3 = __privateGet(this, _storage)) == null ? void 0 : _a3.saveDurable) {
      const state = {
        version: 2,
        entry: structuredClone(entry),
        commits: [],
        operations: []
      };
      __privateGet(this, _storage).saveDurable(sessionId, structuredClone(state));
      __privateGet(this, _durable).set(sessionId, state);
    } else {
      (_b = __privateGet(this, _storage)) == null ? void 0 : _b.save(sessionId, structuredClone(entry));
    }
    __privateGet(this, _drawings).set(sessionId, entry);
    __privateGet(this, _previews).delete(sessionId);
    return {
      status: "imported",
      ref: { drawingId, revision: 1 },
      provisional: vectorized.provisional
    };
  }
  getSnapshot(sessionId) {
    var _a3;
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null) return null;
    const lastCommit = (_a3 = __privateMethod(this, _InMemoryDrawingRepository_instances, durableState_fn).call(this, sessionId)) == null ? void 0 : _a3.commits.at(-1);
    return snapshotOf(entry, lastCommit);
  }
  commit(sessionId, request) {
    var _a3;
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null) {
      return { status: "rejected", message: "No drawing is loaded", code: "DRAWING_REQUIRED" };
    }
    if (request.expectedRevision !== entry.revision) {
      return {
        status: "conflict",
        message: `Expected revision ${request.expectedRevision}, current revision is ${entry.revision}`,
        snapshot: snapshotOf(entry)
      };
    }
    const document = structuredClone(entry.document);
    for (const command of request.commands) {
      const rejection = applyCommand(document, command);
      if (rejection !== null) return rejection;
    }
    const invalid = validateDocument(document);
    if (invalid !== null) return invalid;
    document.metadata.updatedAt = __privateGet(this, _now).call(this);
    const nextEntry = {
      ...entry,
      document,
      revision: entry.revision + 1
    };
    (_a3 = __privateGet(this, _storage)) == null ? void 0 : _a3.save(sessionId, structuredClone(nextEntry));
    __privateGet(this, _drawings).set(sessionId, nextEntry);
    __privateGet(this, _previews).delete(sessionId);
    return { status: "committed", snapshot: snapshotOf(nextEntry) };
  }
  commitSemantic(sessionId, request) {
    const state = __privateMethod(this, _InMemoryDrawingRepository_instances, requireDurable_fn).call(this, sessionId);
    const replay = findOperation(state, request.operationId);
    if (replay) {
      if (replay.operationBindingDigest !== request.operationBindingDigest) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      return structuredClone(replay);
    }
    const entry = state.entry;
    if (request.expectedRef.drawingId !== entry.drawingId || request.expectedRef.revision !== entry.revision) throw new Error("DRAWING_STALE");
    const operationMode = request.mode === "interactive" ? "interactive" : "semantic";
    const beforeSemantic = canonicalSemanticString(entry.document);
    const candidate = applyDrawingTransaction(entry.document, request.forward, __privateGet(this, _now).call(this));
    const semanticDigest = digest(canonicalSemanticString(candidate));
    if (canonicalSemanticString(candidate) === beforeSemantic) {
      const receipt2 = {
        status: "no-effect",
        mode: operationMode,
        operationId: request.operationId,
        operationBindingDigest: request.operationBindingDigest,
        sessionId,
        drawingId: entry.drawingId,
        ref: { drawingId: entry.drawingId, revision: entry.revision },
        semanticDigest
      };
      const next = { ...state, operations: [...state.operations, receipt2] };
      __privateMethod(this, _InMemoryDrawingRepository_instances, saveDurable_fn).call(this, sessionId, next);
      return structuredClone(receipt2);
    }
    const restored = applyDrawingTransaction(candidate, request.inverse, __privateGet(this, _now).call(this));
    if (canonicalSemanticString(restored) !== beforeSemantic) {
      throw new Error("INVERSE_VERIFICATION_FAILED");
    }
    const nextEntry = {
      ...entry,
      document: candidate,
      revision: entry.revision + 1
    };
    const commitId = `commit_${request.operationId}`;
    const snapshotIntegrityDigest = digest(JSON.stringify(nextEntry));
    const receipt = {
      status: "committed",
      mode: operationMode,
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      sessionId,
      drawingId: entry.drawingId,
      parentRef: { drawingId: entry.drawingId, revision: entry.revision },
      resultingRef: { drawingId: entry.drawingId, revision: nextEntry.revision },
      commitId,
      semanticDigest,
      snapshotIntegrityDigest
    };
    const record2 = {
      commitId,
      mode: request.mode,
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      parentRevision: entry.revision,
      resultingRevision: nextEntry.revision,
      forward: structuredClone(request.forward),
      inverse: structuredClone(request.inverse),
      candidateDigest: request.candidateDigest,
      semanticDigest,
      snapshotIntegrityDigest,
      ...request.assessment ? { assessment: structuredClone(request.assessment) } : {},
      ...request.reviewEvidence ? { reviewEvidence: structuredClone(request.reviewEvidence) } : {},
      committedAt: __privateGet(this, _now).call(this)
    };
    __privateMethod(this, _InMemoryDrawingRepository_instances, saveDurable_fn).call(this, sessionId, {
      version: 2,
      entry: nextEntry,
      commits: [...state.commits, record2],
      operations: [...state.operations, receipt]
    });
    __privateGet(this, _previews).delete(sessionId);
    return structuredClone(receipt);
  }
  getOperation(sessionId, operationId, operationBindingDigest) {
    const state = __privateMethod(this, _InMemoryDrawingRepository_instances, durableState_fn).call(this, sessionId);
    if (state === null) return { status: "absent" };
    const receipt = findOperation(state, operationId);
    if (!receipt) return { status: "absent" };
    if (receipt.operationBindingDigest !== operationBindingDigest) {
      return { status: "digest-mismatch", operationId };
    }
    return receipt.status === "no-effect" ? { status: "no-effect", receipt: structuredClone(receipt) } : { status: "committed", receipt: structuredClone(receipt) };
  }
  undoCommit(sessionId, request) {
    if (__privateGet(this, _previews).has(sessionId)) throw new Error("UNDO_PREVIEW_ACTIVE");
    const state = __privateMethod(this, _InMemoryDrawingRepository_instances, requireDurable_fn).call(this, sessionId);
    const replay = findOperation(state, request.operationId);
    if (replay) {
      if (replay.operationBindingDigest !== request.operationBindingDigest) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      return structuredClone(replay);
    }
    const currentRef = { drawingId: state.entry.drawingId, revision: state.entry.revision };
    if (!isDeepStrictEqual(currentRef, request.expectedCurrentRef)) throw new Error("UNDO_CONFLICT");
    const target = state.commits.find(({ commitId: commitId2 }) => commitId2 === request.targetCommitId);
    if (!target) throw new Error("UNDO_TARGET_NOT_FOUND");
    if (target.mode === "undo") throw new Error("UNDO_TARGET_IS_REVERT");
    if (target.resultingRevision !== state.entry.revision) throw new Error("UNDO_CONFLICT");
    const document = applyDrawingTransaction(state.entry.document, target.inverse, __privateGet(this, _now).call(this));
    const nextEntry = { ...state.entry, document, revision: state.entry.revision + 1 };
    const semanticDigest = digest(canonicalSemanticString(document));
    const snapshotIntegrityDigest = digest(JSON.stringify(nextEntry));
    const commitId = `commit_${request.operationId}`;
    const receipt = {
      status: "committed",
      mode: "undo",
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      sessionId,
      drawingId: state.entry.drawingId,
      parentRef: currentRef,
      resultingRef: { drawingId: state.entry.drawingId, revision: nextEntry.revision },
      commitId,
      targetCommitId: target.commitId,
      semanticDigest,
      snapshotIntegrityDigest
    };
    const record2 = {
      commitId,
      mode: "undo",
      operationId: request.operationId,
      operationBindingDigest: request.operationBindingDigest,
      parentRevision: state.entry.revision,
      resultingRevision: nextEntry.revision,
      forward: structuredClone(target.inverse),
      inverse: structuredClone(target.forward),
      targetCommitId: target.commitId,
      semanticDigest,
      snapshotIntegrityDigest,
      committedAt: __privateGet(this, _now).call(this)
    };
    __privateMethod(this, _InMemoryDrawingRepository_instances, saveDurable_fn).call(this, sessionId, {
      version: 2,
      entry: nextEntry,
      commits: [...state.commits, record2],
      operations: [...state.operations, receipt]
    });
    return structuredClone(receipt);
  }
  summarize(sessionId) {
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null) return null;
    const geometryByType = {};
    for (const node of entry.document.geometry) {
      geometryByType[node.type] = (geometryByType[node.type] ?? 0) + 1;
    }
    return {
      ref: { drawingId: entry.drawingId, revision: entry.revision },
      unit: entry.document.unitSystem.length,
      bounds: structuredClone(entry.bounds),
      geometryByType,
      provisional: entry.provisional
    };
  }
  query(sessionId, request) {
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null) throw new Error("DRAWING_REQUIRED");
    if (request.ref.drawingId !== entry.drawingId || request.ref.revision !== entry.revision) {
      throw new Error("DRAWING_STALE");
    }
    const result = queryDrawing(entry.document, spatialQueryOf(request));
    return structuredClone({ ...result, ref: request.ref });
  }
  createPreview(sessionId, request) {
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null) {
      return { status: "rejected", message: "No drawing is loaded", code: "DRAWING_REQUIRED" };
    }
    if (request.ref.drawingId !== entry.drawingId || request.ref.revision !== entry.revision) {
      return {
        status: "conflict",
        message: `Preview base ${request.ref.drawingId}@${request.ref.revision} is stale`,
        snapshot: snapshotOf(entry)
      };
    }
    const document = structuredClone(entry.document);
    for (const command of request.commands) {
      const rejection = applyCommand(document, command);
      if (rejection !== null) return rejection;
    }
    const invalid = validateDocument(document);
    if (invalid !== null) return invalid;
    const createdAt = __privateGet(this, _now).call(this);
    document.metadata.updatedAt = createdAt;
    const preview = {
      version: 1,
      handle: __privateGet(this, _previewHandle).call(this),
      baseRef: structuredClone(request.ref),
      commands: structuredClone(request.commands),
      candidate: snapshotOf({ ...entry, document }),
      diff: diffDocuments(entry.document, document),
      createdAt,
      ...request.summary === void 0 ? {} : { summary: request.summary }
    };
    __privateGet(this, _previews).set(sessionId, preview);
    return { status: "previewed", preview: structuredClone(preview) };
  }
  getPreview(sessionId) {
    const preview = __privateGet(this, _previews).get(sessionId);
    if (preview === void 0) return null;
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null || preview.baseRef.drawingId !== entry.drawingId || preview.baseRef.revision !== entry.revision) {
      __privateGet(this, _previews).delete(sessionId);
      return null;
    }
    return structuredClone(preview);
  }
  commitPreview(sessionId, request) {
    var _a3;
    const current = __privateGet(this, _previews).get(sessionId);
    if (current === void 0) {
      return { status: "rejected", message: "No current Preview exists", code: "PREVIEW_NOT_FOUND" };
    }
    if (current.handle !== request.handle) {
      return {
        status: "rejected",
        message: `Preview ${request.handle} is not current`,
        code: "PREVIEW_NOT_CURRENT"
      };
    }
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null || current.baseRef.drawingId !== entry.drawingId || current.baseRef.revision !== entry.revision) {
      __privateGet(this, _previews).delete(sessionId);
      return { status: "rejected", message: "Preview base revision is stale", code: "PREVIEW_STALE" };
    }
    const document = structuredClone(current.candidate.document);
    const invalid = validateDocument(document);
    if (invalid !== null) return invalid;
    document.metadata.updatedAt = __privateGet(this, _now).call(this);
    const nextEntry = {
      ...entry,
      document,
      revision: entry.revision + 1
    };
    (_a3 = __privateGet(this, _storage)) == null ? void 0 : _a3.save(sessionId, structuredClone(nextEntry));
    __privateGet(this, _drawings).set(sessionId, nextEntry);
    __privateGet(this, _previews).delete(sessionId);
    return { status: "committed", snapshot: snapshotOf(nextEntry) };
  }
  discardPreview(sessionId, request) {
    const current = __privateGet(this, _previews).get(sessionId);
    if (current === void 0) {
      return { status: "rejected", message: "No current Preview exists", code: "PREVIEW_NOT_FOUND" };
    }
    if (current.handle !== request.handle) {
      return {
        status: "rejected",
        message: `Preview ${request.handle} is not current`,
        code: "PREVIEW_NOT_CURRENT"
      };
    }
    __privateGet(this, _previews).delete(sessionId);
    return { status: "discarded", ref: structuredClone(current.baseRef) };
  }
  disposeSession(sessionId) {
    __privateGet(this, _pending).delete(sessionId);
    __privateGet(this, _drawings).delete(sessionId);
    __privateGet(this, _durable).delete(sessionId);
    __privateGet(this, _previews).delete(sessionId);
  }
}
_pending = new WeakMap();
_drawings = new WeakMap();
_durable = new WeakMap();
_previews = new WeakMap();
_vectorizer = new WeakMap();
_drawingId = new WeakMap();
_storage = new WeakMap();
_previewHandle = new WeakMap();
_now = new WeakMap();
_InMemoryDrawingRepository_instances = new WeakSet();
getDrawing_fn = function(sessionId) {
  var _a3;
  const current = __privateGet(this, _drawings).get(sessionId);
  if (current !== void 0) return current;
  const durable = __privateMethod(this, _InMemoryDrawingRepository_instances, durableState_fn).call(this, sessionId);
  const restored = (durable == null ? void 0 : durable.entry) ?? ((_a3 = __privateGet(this, _storage)) == null ? void 0 : _a3.load(sessionId)) ?? null;
  if (restored !== null) __privateGet(this, _drawings).set(sessionId, structuredClone(restored));
  return restored;
};
durableState_fn = function(sessionId) {
  var _a3, _b;
  const current = __privateGet(this, _durable).get(sessionId);
  if (current) return current;
  const restored = ((_b = (_a3 = __privateGet(this, _storage)) == null ? void 0 : _a3.loadDurable) == null ? void 0 : _b.call(_a3, sessionId)) ?? null;
  if (restored) {
    const clone2 = structuredClone(restored);
    __privateGet(this, _durable).set(sessionId, clone2);
    __privateGet(this, _drawings).set(sessionId, structuredClone(clone2.entry));
    return clone2;
  }
  return null;
};
requireDurable_fn = function(sessionId) {
  var _a3;
  if (!((_a3 = __privateGet(this, _storage)) == null ? void 0 : _a3.loadDurable) || !__privateGet(this, _storage).saveDurable) {
    throw new Error("AUTO_SAFE_UNAVAILABLE");
  }
  const state = __privateMethod(this, _InMemoryDrawingRepository_instances, durableState_fn).call(this, sessionId);
  if (state) return state;
  const legacy = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
  if (!legacy) throw new Error("DRAWING_REQUIRED");
  const promoted = {
    version: 2,
    entry: structuredClone(legacy),
    commits: [],
    operations: []
  };
  __privateMethod(this, _InMemoryDrawingRepository_instances, saveDurable_fn).call(this, sessionId, promoted);
  return promoted;
};
saveDurable_fn = function(sessionId, state) {
  const storage = __privateGet(this, _storage);
  storage.saveDurable(sessionId, structuredClone(state));
  __privateGet(this, _durable).set(sessionId, structuredClone(state));
  __privateGet(this, _drawings).set(sessionId, structuredClone(state.entry));
};
function findOperation(state, operationId) {
  return state.operations.find((receipt) => receipt.operationId === operationId);
}
function digest(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}
function spatialQueryOf(request) {
  if (request.kind === "node") return { kind: "node", id: request.id };
  if (request.kind === "neighbors") {
    return {
      kind: "neighbors",
      nodeId: request.nodeId,
      ...request.limit === void 0 ? {} : { limit: request.limit }
    };
  }
  return {
    kind: "world-slice",
    bounds: structuredClone(request.bounds),
    ...request.planes === void 0 ? {} : { planes: [...request.planes] },
    ...request.limit === void 0 ? {} : { limit: request.limit }
  };
}
function snapshotOf(entry, lastCommit) {
  return structuredClone({
    version: 1,
    ref: { drawingId: entry.drawingId, revision: entry.revision },
    document: entry.document,
    source: entry.source,
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: true
    },
    provisional: entry.provisional,
    ...lastCommit ? { lastCommit: {
      commitId: lastCommit.commitId,
      mode: lastCommit.mode,
      undoable: lastCommit.mode !== "undo"
    } } : {}
  });
}
function applyCommand(document, command) {
  if (command.type === "node.create") return createNode(document, command);
  if (command.type === "node.delete") return deleteNode(document, command.id);
  const node = findNode(document, command.id);
  if (node === void 0) {
    return { status: "rejected", message: `Node ${command.id} was not found`, code: "NODE_NOT_FOUND" };
  }
  if (command.type === "annotation.move-text") {
    const key = node.type === "text" ? "position" : node.type === "dimension" ? "textPosition" : null;
    if (key === null) {
      return { status: "rejected", message: `Node ${command.id} has no movable text`, code: "INVALID_COMMAND" };
    }
    if (!isDeepStrictEqual(node[key], command.expectedPosition)) {
      return {
        status: "rejected",
        message: `Precondition failed for node ${command.id} property ${key}`,
        code: "PRECONDITION_FAILED"
      };
    }
    node[key] = structuredClone(command.position);
    return null;
  }
  const mutable = node;
  for (const [key, expected] of Object.entries(command.expected)) {
    if (!isDeepStrictEqual(mutable[key], expected)) {
      return {
        status: "rejected",
        message: `Precondition failed for node ${command.id} property ${key}`,
        code: "PRECONDITION_FAILED"
      };
    }
  }
  for (const [key, value] of Object.entries(command.changes)) {
    if (key === "id" || key === "type" || key === "plane" || !(key in mutable)) {
      return {
        status: "rejected",
        message: `Property ${key} cannot be updated on node ${command.id}`,
        code: "INVALID_COMMAND"
      };
    }
    mutable[key] = structuredClone(value);
  }
  return null;
}
function createNode(document, command) {
  if (findNode(document, command.node.id) !== void 0) {
    return {
      status: "rejected",
      message: `Node ${command.node.id} already exists`,
      code: "NODE_ALREADY_EXISTS"
    };
  }
  if (command.plane === "geometry") document.geometry.push(structuredClone(command.node));
  else if (command.plane === "annotation") document.annotations.push(structuredClone(command.node));
  else if (command.plane === "relation") document.relations.push(structuredClone(command.node));
  else document.features.push(structuredClone(command.node));
  return null;
}
function findNode(document, id) {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features
  ].find((node) => node.id === id);
}
function deleteNode(document, id) {
  const node = findNode(document, id);
  if (node === void 0) {
    return { status: "rejected", message: `Node ${id} was not found`, code: "NODE_NOT_FOUND" };
  }
  document.geometry = document.geometry.filter((candidate) => candidate.id !== id);
  document.annotations = document.annotations.filter((candidate) => candidate.id !== id);
  document.relations = document.relations.filter((relation) => {
    if (relation.id === id) return false;
    if (relation.type === "topology" || relation.type === "semantic") return !relation.nodeIds.includes(id);
    if (relation.type === "constraint") return !relation.geometryIds.includes(id);
    return relation.annotationId !== id && !relation.geometryIds.includes(id);
  });
  document.features = document.features.filter((feature) => feature.id !== id && !feature.geometryIds.includes(id) && !feature.annotationIds.includes(id) && !feature.relationIds.includes(id));
  return null;
}
function diffDocuments(before, after) {
  const beforeNodes = new Map(allNodes$1(before).map((node) => [node.id, node]));
  const afterNodes = new Map(allNodes$1(after).map((node) => [node.id, node]));
  return {
    createdNodeIds: [...afterNodes.keys()].filter((id) => !beforeNodes.has(id)),
    updatedNodeIds: [...afterNodes.keys()].filter((id) => beforeNodes.has(id) && !isDeepStrictEqual(beforeNodes.get(id), afterNodes.get(id))),
    deletedNodeIds: [...beforeNodes.keys()].filter((id) => !afterNodes.has(id))
  };
}
function allNodes$1(document) {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features
  ];
}
function validateDocument(document) {
  if (!drawingDocumentSchema.safeParse(document).success) {
    return { status: "rejected", message: "Candidate Drawing is invalid", code: "INVALID_DOCUMENT" };
  }
  const ids = allNodes$1(document).map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    return { status: "rejected", message: "Drawing node ids must be unique", code: "NODE_ALREADY_EXISTS" };
  }
  const geometryIds = new Set(document.geometry.map(({ id }) => id));
  const annotationIds = new Set(document.annotations.map(({ id }) => id));
  const relationIds = new Set(document.relations.map(({ id }) => id));
  const featureIds = new Set(document.features.map(({ id }) => id));
  const nodeIds = new Set(ids);
  const missing = (id, expected) => !expected.has(id);
  for (const annotation of document.annotations) {
    const targets = annotation.type === "dimension" ? annotation.targets.map(({ geometryId }) => geometryId) : annotation.type === "leader" ? [annotation.target.geometryId] : annotation.type === "centerline" ? annotation.targets : [];
    if (targets.some((id) => missing(id, geometryIds))) return danglingReference(annotation.id);
  }
  for (const relation of document.relations) {
    const valid = relation.type === "topology" ? relation.nodeIds.every((id) => nodeIds.has(id)) : relation.type === "constraint" ? relation.geometryIds.every((id) => geometryIds.has(id)) : relation.type === "association" ? annotationIds.has(relation.annotationId) && relation.geometryIds.every((id) => geometryIds.has(id)) : featureIds.has(relation.featureId) && relation.nodeIds.every((id) => nodeIds.has(id));
    if (!valid) return danglingReference(relation.id);
  }
  for (const feature of document.features) {
    if (feature.geometryIds.some((id) => missing(id, geometryIds)) || feature.annotationIds.some((id) => missing(id, annotationIds)) || feature.relationIds.some((id) => missing(id, relationIds))) return danglingReference(feature.id);
  }
  return null;
}
function danglingReference(id) {
  return {
    status: "rejected",
    message: `Node ${id} contains a dangling reference`,
    code: "DANGLING_REFERENCE"
  };
}
class FileDrawingRepositoryStorage {
  constructor(directory) {
    __privateAdd(this, _FileDrawingRepositoryStorage_instances);
    __privateAdd(this, _directory);
    __privateSet(this, _directory, directory);
    mkdirSync(directory, { recursive: true, mode: 448 });
  }
  load(sessionId) {
    const durable = this.loadDurable(sessionId);
    if (durable) return durable.entry;
    const path = __privateMethod(this, _FileDrawingRepositoryStorage_instances, path_fn).call(this, sessionId);
    if (!existsSync(path)) return null;
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      if (value.version !== 1 || typeof value.attachmentId !== "string" || !bounds(value.bounds)) {
        return null;
      }
      const snapshot = drawingWorkspaceSnapshotSchema.parse(value.snapshot);
      if (snapshot === null || snapshot.source === void 0) return null;
      return {
        attachmentId: value.attachmentId,
        document: snapshot.document,
        drawingId: snapshot.ref.drawingId,
        bounds: value.bounds,
        revision: snapshot.ref.revision,
        source: snapshot.source,
        provisional: snapshot.provisional ?? false
      };
    } catch {
      return null;
    }
  }
  save(sessionId, entry) {
    const path = __privateMethod(this, _FileDrawingRepositoryStorage_instances, path_fn).call(this, sessionId);
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const value = {
      version: 1,
      attachmentId: entry.attachmentId,
      bounds: structuredClone(entry.bounds),
      snapshot: snapshotForStorage(entry)
    };
    try {
      __privateMethod(this, _FileDrawingRepositoryStorage_instances, atomicWrite_fn).call(this, path, temporary, value);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  loadDurable(sessionId) {
    const path = __privateMethod(this, _FileDrawingRepositoryStorage_instances, path_fn).call(this, sessionId);
    if (!existsSync(path)) return null;
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      if (value.version !== 2 || !value.entry || !Array.isArray(value.commits) || !Array.isArray(value.operations)) {
        return null;
      }
      const entry = entryFromStored(value.entry);
      if (!entry) return null;
      return {
        version: 2,
        entry,
        commits: structuredClone(value.commits),
        operations: structuredClone(value.operations)
      };
    } catch {
      return null;
    }
  }
  saveDurable(sessionId, state) {
    const path = __privateMethod(this, _FileDrawingRepositoryStorage_instances, path_fn).call(this, sessionId);
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const value = {
      version: 2,
      entry: {
        attachmentId: state.entry.attachmentId,
        bounds: structuredClone(state.entry.bounds),
        snapshot: snapshotForStorage(state.entry)
      },
      commits: structuredClone(state.commits),
      operations: structuredClone(state.operations)
    };
    try {
      __privateMethod(this, _FileDrawingRepositoryStorage_instances, atomicWrite_fn).call(this, path, temporary, value);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
}
_directory = new WeakMap();
_FileDrawingRepositoryStorage_instances = new WeakSet();
atomicWrite_fn = function(path, temporary, value) {
  writeFileSync(temporary, `${JSON.stringify(value)}
`, { encoding: "utf8", mode: 384 });
  const file = openSync(temporary, "r");
  try {
    fsyncSync(file);
  } finally {
    closeSync(file);
  }
  renameSync(temporary, path);
  const directory = openSync(__privateGet(this, _directory), "r");
  try {
    fsyncSync(directory);
  } finally {
    closeSync(directory);
  }
};
path_fn = function(sessionId) {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(__privateGet(this, _directory), `${key}.json`);
};
function entryFromStored(value) {
  if (typeof value.attachmentId !== "string" || !bounds(value.bounds)) return null;
  const snapshot = drawingWorkspaceSnapshotSchema.safeParse(value.snapshot);
  if (!snapshot.success || snapshot.data.source === void 0) return null;
  return {
    attachmentId: value.attachmentId,
    document: snapshot.data.document,
    drawingId: snapshot.data.ref.drawingId,
    bounds: value.bounds,
    revision: snapshot.data.ref.revision,
    source: snapshot.data.source,
    provisional: snapshot.data.provisional ?? false
  };
}
function snapshotForStorage(entry) {
  return {
    version: 1,
    ref: { drawingId: entry.drawingId, revision: entry.revision },
    document: structuredClone(entry.document),
    source: structuredClone(entry.source),
    capabilities: {
      edit: true,
      delete: true,
      annotations: true,
      sourceUnderlay: true
    },
    provisional: entry.provisional
  };
}
function bounds(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value;
  return ["minX", "minY", "maxX", "maxY"].every((key) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]));
}
function withDrawingWorkflow(result, state, nextTools, instruction) {
  return {
    ...result,
    drawingWorkflow: { state, nextTools, instruction }
  };
}
function createSemanticEditToolCatalog(semantic, questions) {
  return [
    createDrawingObserveTool(semantic),
    createDrawingBuildContextTool(semantic),
    createDrawingGroundTool(semantic),
    createDrawingPreviewGroundedTransformTool(semantic),
    createDrawingReviseGroundedTransformTool(semantic),
    createDrawingPreviewProgramTool(semantic),
    createDrawingRevisePreviewTool(semantic),
    createDrawingEvaluatePreviewTool(semantic),
    createDrawingFinalizeSemanticTool(semantic, questions),
    createDrawingDiscardSemanticTool(semantic),
    createDrawingGetOperationTool(semantic),
    createDrawingUndoTool(semantic, questions)
  ];
}
function createDrawingPreviewGroundedTransformTool(semantic) {
  return defineTool({
    name: "drawing_preview_grounded_transform",
    description: "Preview a pose transform for an exact grounded target. Pass only the intended displacement; the Host derives the minimum-deformation orientation from actual topology and interfaces. Positive Y moves visually up. Use the advanced program tool only when the user explicitly specifies an exact rotation.",
    parameters: {
      taskId: { type: "string", required: true },
      groundingId: { type: "string", required: true },
      translation: {
        type: "array",
        items: { type: "number" },
        required: true,
        description: "Exactly two numbers [dx, dy] in Drawing units. Positive dy moves the target visually up."
      },
      summary: { type: "string", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const input = args;
      const preview = semantic.previewGroundedTransform(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), {
        taskId: input.taskId,
        groundingId: input.groundingId,
        translation: input.translation,
        summary: input.summary
      });
      return withDrawingWorkflow(
        preview,
        "preview_ready",
        ["drawing_evaluate_preview"],
        "Evaluate this exact Preview before attempting to finalize it."
      );
    }
  });
}
function createDrawingReviseGroundedTransformTool(semantic) {
  return defineTool({
    name: "drawing_revise_grounded_transform",
    description: "Replace the current pose Preview after visual evaluation requests a revision. Keep the same task; optionally call drawing_ground again with the existing context to narrow the moving target. The Host derives orientation from topology. Never call drawing_observe twice in one user turn.",
    parameters: {
      taskId: { type: "string", required: true },
      currentPreviewHandle: { type: "string", required: true },
      currentCandidateDigest: { type: "string", required: true },
      groundingId: { type: "string", required: true },
      translation: {
        type: "array",
        items: { type: "number" },
        required: true,
        description: "Exactly two numbers [dx, dy]. Positive dy moves visually up."
      },
      summary: { type: "string", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const input = args;
      const preview = semantic.reviseGroundedTransform(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), {
        taskId: input.taskId,
        currentPreviewHandle: input.currentPreviewHandle,
        currentCandidateDigest: input.currentCandidateDigest,
        groundingId: input.groundingId,
        translation: input.translation,
        summary: input.summary
      });
      return withDrawingWorkflow(
        preview,
        "preview_ready",
        ["drawing_evaluate_preview"],
        "Evaluate the replacement Preview; the previous Preview handle is no longer current."
      );
    }
  });
}
function createDrawingObserveTool(semantic) {
  return defineTool({
    name: "drawing_observe",
    description: "Start a revision-bound semantic edit task from the current direct user instruction and create an observation of the active local Drawing. Call before grounding or editing.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderObservation },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const task = semantic.startBoundTask(sessionId);
      const observation = await semantic.observe(sessionId, { taskId: task.taskId });
      const imageAttachment = semantic.observationAttachment(observation.observationId);
      return {
        task,
        observation,
        ...imageAttachment ? { imageAttachment } : {},
        drawingWorkflow: {
          state: "observed",
          nextTools: ["drawing_build_context"],
          instruction: "Build bounded context with this taskId and observationId. Follow the next drawing tool descriptions; all returned handles are task- and revision-bound."
        }
      };
    }
  });
}
function createDrawingBuildContextTool(semantic) {
  return defineTool({
    name: "drawing_build_context",
    description: "Build bounded drawing context for an exact task and observation before selecting an edit target.",
    parameters: {
      taskId: { type: "string", required: true },
      observationId: { type: "string", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const context = semantic.buildContext(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), args);
      return withDrawingWorkflow(
        context,
        "context_ready",
        ["drawing_ground"],
        "Ground the exact semantic target against this bounded context before creating a Preview."
      );
    }
  });
}
function createDrawingGroundTool(semantic) {
  return defineTool({
    name: "drawing_ground",
    description: "Ground a semantic target to exact node ids and topology interfaces. Choose only the semantic carrier being transformed; pass empty interfaces so the Host derives true contacted endpoint slots. When the user refers to a Host selection, pass its selectionProjectionId with empty targetNodeIds.",
    parameters: {
      taskId: { type: "string", required: true },
      contextId: { type: "string", required: true },
      selectionProjectionId: {
        type: "string",
        description: "Optional Host selection handle. Omit this field entirely when drawing_observe did not return one; never send an empty string."
      },
      targetNodeIds: { type: "array", items: { type: "string" }, required: true },
      interfaces: { type: "array", items: { type: "json" }, required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const grounding = semantic.ground(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), args);
      return withDrawingWorkflow(
        grounding,
        "grounded",
        ["drawing_preview_grounded_transform", "drawing_preview_program"],
        "Use grounded transform for ordinary movement or posing; use the advanced program only for other explicit spatial operations."
      );
    }
  });
}
function createDrawingPreviewProgramTool(semantic) {
  return defineTool({
    name: "drawing_preview_program",
    description: "Advanced tool for non-pose spatial operations and exact numeric rotations explicitly requested by the user. For ordinary moving, raising, lowering, or posing, use drawing_preview_grounded_transform so the Host derives minimum-deformation orientation. Compiles a complete Spatial Edit Program against an exact grounding and never accepts raw Drawing transaction commands.",
    parameters: {
      taskId: { type: "string", required: true },
      groundingId: { type: "string", required: true },
      program: { type: "json", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const program = spatialEditProgramSchema.parse(args.program);
      const preview = semantic.previewProgram(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), {
        taskId: args.taskId,
        groundingId: args.groundingId,
        program
      });
      return withDrawingWorkflow(
        preview,
        "preview_ready",
        ["drawing_evaluate_preview"],
        "Evaluate this exact Preview before attempting to finalize it."
      );
    }
  });
}
function createDrawingEvaluatePreviewTool(semantic) {
  return defineTool({
    name: "drawing_evaluate_preview",
    description: "Run mandatory deterministic validation and the local reviewer over an exact Drawing Preview. The Host computes policy; caller-provided auto-safe claims are not accepted.",
    parameters: {
      taskId: { type: "string", required: true },
      previewHandle: { type: "string", required: true },
      candidateDigest: { type: "string", required: true }
    },
    output: { schema: { type: "json" }, render: renderObservation },
    async execute(args, exec) {
      var _a3;
      const result = await semantic.evaluatePreview(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), args);
      const revisionRequired = result.evaluation.review.outcome === "needs_revision" || result.assessment.disposition === "blocked";
      return withDrawingWorkflow(
        result,
        revisionRequired ? "revision_required" : "evaluated",
        revisionRequired ? ["drawing_revise_grounded_transform", "drawing_revise_preview", "drawing_discard_preview"] : ["drawing_finalize_preview"],
        revisionRequired ? "Do not finalize this candidate. Revise it from the reported evidence or discard it." : "Finalize this exact evaluated Preview; the Host will apply auto-safe or request the required user decision."
      );
    }
  });
}
function createDrawingRevisePreviewTool(semantic) {
  return defineTool({
    name: "drawing_revise_preview",
    description: "Replace the exact current Preview with another candidate in the same task. The former Preview remains current if compilation fails; a task allows at most three candidates.",
    parameters: {
      taskId: { type: "string", required: true },
      currentPreviewHandle: { type: "string", required: true },
      currentCandidateDigest: { type: "string", required: true },
      groundingId: { type: "string", required: true },
      program: { type: "json", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const program = spatialEditProgramSchema.parse(args.program);
      const preview = semantic.revisePreview(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), {
        taskId: args.taskId,
        currentPreviewHandle: args.currentPreviewHandle,
        currentCandidateDigest: args.currentCandidateDigest,
        groundingId: args.groundingId,
        program
      });
      return withDrawingWorkflow(
        preview,
        "preview_ready",
        ["drawing_evaluate_preview"],
        "Evaluate the replacement Preview; the previous Preview handle is no longer current."
      );
    }
  });
}
function createDrawingFinalizeSemanticTool(semantic, questions) {
  const pendingDecisions = /* @__PURE__ */ new Map();
  return defineTool({
    name: "drawing_finalize_preview",
    description: "Finalize an evaluated semantic Preview. Exact auto-safe candidates commit locally; risk-qualified candidates ask the runtime-root user; blocked candidates never commit.",
    parameters: {
      previewHandle: { type: "string", required: true },
      previewDigest: { type: "string", required: true },
      finalizeOperationId: { type: "string", required: true },
      finalizeOperationBindingDigest: { type: "string", required: true },
      evaluationId: { type: "string", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const request = finalizePreviewRequestSchema.parse(args);
      const result = semantic.finalizePreview(sessionId, request);
      if (result.status !== "rejected" || result.disposition !== "confirmation_required") {
        return result;
      }
      if (!questions || !exec.agent) return {
        status: "root-required",
        message: "This candidate requires a direct runtime-root user decision."
      };
      const decisionKey = `${sessionId}\0${request.finalizeOperationId}\0${request.finalizeOperationBindingDigest}`;
      const existing = pendingDecisions.get(decisionKey);
      if (existing) return await existing;
      const decision = (async () => {
        var _a4;
        const answer = await questions.ask({
          agent: exec.agent,
          signal: exec.signal,
          questions: [{
            id: `drawing-confirm-${request.finalizeOperationId}`,
            header: "图纸修改确认",
            question: "这个候选修改包含需要你确认的风险，是否应用？",
            options: [
              { label: "应用修改", description: "按当前预览提交一个可撤销的新版本。" },
              { label: "继续修改", description: "保留正式图纸不变并让 AI 重新生成候选。" },
              { label: "取消", description: "丢弃当前候选，不修改图纸。" }
            ]
          }]
        });
        const selected = answer.answers.find(({ id }) => id === `drawing-confirm-${request.finalizeOperationId}`);
        if ((selected == null ? void 0 : selected.selected.length) === 1 && selected.selected[0] === "应用修改" && !selected.custom) {
          return semantic.confirmFinalize(sessionId, request);
        }
        if ((selected == null ? void 0 : selected.selected.length) === 1 && selected.selected[0] === "取消" && !selected.custom) {
          return semantic.discardPreview(sessionId, request.previewHandle);
        }
        return {
          status: "needs-revision",
          evaluationId: request.evaluationId,
          reasons: [((_a4 = selected == null ? void 0 : selected.custom) == null ? void 0 : _a4.trim()) || "The user requested another candidate."]
        };
      })();
      pendingDecisions.set(decisionKey, decision);
      try {
        return await decision;
      } finally {
        if (pendingDecisions.get(decisionKey) === decision) pendingDecisions.delete(decisionKey);
      }
    }
  });
}
function createDrawingDiscardSemanticTool(semantic) {
  return defineTool({
    name: "drawing_discard_preview",
    description: "Discard the current semantic Preview without changing the formal Drawing.",
    parameters: { previewHandle: { type: "string", required: true } },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      return semantic.discardPreview(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id), args.previewHandle);
    }
  });
}
function createDrawingGetOperationTool(semantic) {
  return defineTool({
    name: "drawing_get_operation",
    description: "Resolve the durable outcome of a local Drawing write after a response, transport, cancellation, or fsync outcome was uncertain.",
    parameters: {
      operationId: { type: "string", required: true },
      operationBindingDigest: { type: "string", required: true }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      return semantic.getOperation(
        requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id),
        args.operationId,
        args.operationBindingDigest
      );
    }
  });
}
function createDrawingUndoTool(semantic, questions) {
  const pendingDecisions = /* @__PURE__ */ new Map();
  return defineTool({
    name: "drawing_undo_commit",
    description: "Request an explicit user-authorized Undo of the exact current Drawing commit. Undo creates a new compensating revision and never rewrites history.",
    parameters: {
      targetCommitId: { type: "string", required: true },
      expectedCurrentRef: {
        type: "object",
        properties: {
          drawingId: { type: "string", required: true },
          revision: { type: "integer", required: true }
        },
        additionalProperties: false,
        required: true
      }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      if (!questions || !exec.agent) return { status: "root-required", message: "Undo requires a direct runtime-root user decision." };
      const decisionKey = `${sessionId}\0${args.targetCommitId}\0${JSON.stringify(args.expectedCurrentRef)}`;
      const existing = pendingDecisions.get(decisionKey);
      if (existing) return await existing;
      const decision = (async () => {
        const answer = await questions.ask({
          agent: exec.agent,
          signal: exec.signal,
          questions: [{
            id: `drawing-undo-${args.targetCommitId}`,
            header: "撤销图纸修改",
            question: "撤销这个图纸版本并创建一个恢复版本？",
            options: [{ label: "撤销此提交" }, { label: "取消" }]
          }]
        });
        const selected = answer.answers.find(({ id }) => id === `drawing-undo-${args.targetCommitId}`);
        if ((selected == null ? void 0 : selected.selected.length) !== 1 || selected.selected[0] !== "撤销此提交" || selected.custom) {
          return { status: "discarded", ref: args.expectedCurrentRef };
        }
        return semantic.undoAuthorized(sessionId, args);
      })();
      pendingDecisions.set(decisionKey, decision);
      try {
        return await decision;
      } finally {
        if (pendingDecisions.get(decisionKey) === decision) pendingDecisions.delete(decisionKey);
      }
    }
  });
}
function requireSession(id) {
  if (id === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
  return String(id);
}
function renderJson(_args, value) {
  return [{ type: "text", text: JSON.stringify(value) }];
}
function renderObservation(_args, value) {
  const content = [{ type: "text", text: JSON.stringify(value) }];
  if (value && typeof value === "object" && "imageAttachment" in value) {
    const attachment = value.imageAttachment;
    if (attachment && typeof attachment === "object" && "attachmentId" in attachment) {
      content.push({
        type: "image",
        attachment
      });
    }
  }
  return content;
}
function createDrawingAgentToolCatalog(drawings, attachments, semantic, questions) {
  return [
    createDrawingImportTool(drawings, attachments),
    createDrawingSummarizeTool(drawings),
    createDrawingQueryTool(drawings),
    ...semantic ? createSemanticEditToolCatalog(semantic, questions) : [
      createDrawingFinalizePreviewTool(),
      createDrawingDiscardPreviewTool(drawings)
    ]
  ];
}
const drawingRefSchema = {
  type: "object",
  properties: {
    drawingId: { type: "string", required: true },
    revision: { type: "integer", required: true }
  },
  additionalProperties: false
};
function createDrawingImportTool(drawings, attachments) {
  return defineTool({
    name: "drawing_import",
    description: "Import the latest pending drawing image into the local VectorAI 2D Space. Call this before inspecting or editing a new drawing image.",
    parameters: {},
    output: {
      schema: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: ["imported", "already-imported"],
            required: true
          },
          ref: { ...drawingRefSchema, required: true },
          provisional: { type: "boolean", required: true }
        },
        additionalProperties: false
      },
      render: (_args, value) => [{
        type: "text",
        text: `Drawing ${value.ref.drawingId} revision ${value.ref.revision} ${value.status}. ${value.provisional ? "The current geometry is provisional." : "Local vectorization completed; geometry is ready for inspection and editing."}`
      }]
    },
    async execute(_args, exec) {
      var _a3;
      const sessionId = (_a3 = exec.agent) == null ? void 0 : _a3.id;
      if (sessionId === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
      const pending = drawings.getPending(String(sessionId));
      if (pending === null) throw new Error("PENDING_DRAWING_SOURCE_REQUIRED");
      const stored = await attachments.readImage(pending, exec.signal);
      return drawings.importPending(String(sessionId), {
        data: stored.data,
        signal: exec.signal
      });
    }
  });
}
function createDrawingSummarizeTool(drawings) {
  return defineTool({
    name: "drawing_summarize",
    description: "Summarize the active local VectorAI Drawing revision, bounds, units, and geometry counts.",
    parameters: {},
    output: {
      schema: {
        type: "object",
        properties: {
          ref: { ...drawingRefSchema, required: true },
          unit: { type: "string", enum: ["mm", "cm", "m"], required: true },
          bounds: {
            type: "object",
            properties: {
              minX: { type: "number", required: true },
              minY: { type: "number", required: true },
              maxX: { type: "number", required: true },
              maxY: { type: "number", required: true }
            },
            additionalProperties: false,
            required: true
          },
          geometryByType: {
            type: "object",
            additionalProperties: true,
            required: true
          },
          provisional: { type: "boolean", required: true }
        },
        additionalProperties: false
      },
      render: (_args, value) => [{
        type: "text",
        text: JSON.stringify(value)
      }]
    },
    async execute(_args, exec) {
      var _a3;
      const sessionId = (_a3 = exec.agent) == null ? void 0 : _a3.id;
      if (sessionId === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
      const summary = drawings.summarize(String(sessionId));
      if (summary === null) throw new Error("DRAWING_REQUIRED");
      return summary;
    }
  });
}
function createDrawingQueryTool(drawings) {
  return defineTool({
    name: "drawing_query",
    description: "Query the active local VectorAI Drawing at an exact drawingId and revision. Use world-slice for bounded spatial context, node for one object, or neighbors for directly related objects.",
    parameters: {
      kind: {
        type: "string",
        enum: ["world-slice", "node", "neighbors"],
        required: true
      },
      ref: {
        type: "object",
        properties: drawingRefSchema.properties,
        additionalProperties: false,
        required: true
      },
      bounds: {
        type: "object",
        properties: {
          minX: { type: "number", required: true },
          minY: { type: "number", required: true },
          maxX: { type: "number", required: true },
          maxY: { type: "number", required: true }
        },
        additionalProperties: false
      },
      planes: {
        type: "array",
        items: { type: "string", enum: ["geometry", "annotation", "relation", "feature"] }
      },
      limit: { type: "integer" },
      id: { type: "string" },
      nodeId: { type: "string" }
    },
    output: {
      schema: { type: "json" },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      var _a3;
      const sessionId = (_a3 = exec.agent) == null ? void 0 : _a3.id;
      if (sessionId === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
      const request = drawingQueryRequestSchema.parse(args);
      return drawings.query(String(sessionId), request);
    }
  });
}
function createDrawingFinalizePreviewTool(_drawings2) {
  return defineTool({
    name: "drawing_finalize_preview",
    description: "Finalize an evaluated semantic Drawing Preview. This remains fail-closed until durable local history, inverse transactions, idempotency, and Undo are available.",
    parameters: {
      previewHandle: { type: "string", required: true },
      previewDigest: { type: "string", required: true },
      finalizeOperationId: { type: "string", required: true },
      finalizeOperationBindingDigest: { type: "string", required: true },
      evaluationId: { type: "string", required: true }
    },
    output: {
      schema: { type: "json" },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      var _a3;
      const sessionId = (_a3 = exec.agent) == null ? void 0 : _a3.id;
      if (sessionId === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
      finalizePreviewRequestSchema.parse(args);
      return finalizePreviewResultSchema.parse({
        status: "rejected",
        disposition: "blocked",
        code: "AUTO_SAFE_UNAVAILABLE",
        message: "Durable history, inverse transactions, idempotency, and Undo are required before semantic finalize."
      });
    }
  });
}
function createDrawingDiscardPreviewTool(drawings) {
  return defineTool({
    name: "drawing_discard_preview",
    description: "Discard the current local Drawing Preview without changing the formal drawing revision.",
    parameters: { handle: { type: "string", required: true } },
    output: {
      schema: { type: "json" },
      render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }]
    },
    async execute(args, exec) {
      var _a3;
      const sessionId = (_a3 = exec.agent) == null ? void 0 : _a3.id;
      if (sessionId === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
      const request = drawingPreviewControlRequestSchema.parse(args);
      return drawings.discardPreview(String(sessionId), request);
    }
  });
}
const randomIdFactory = {
  next: (kind) => `${kind}_${globalThis.crypto.randomUUID()}`
};
function createEmptyDrawing(input = {}) {
  const idFactory = input.idFactory ?? randomIdFactory;
  const now = (input.now ?? Date.now)();
  return {
    protocol: "VectorAI-Drawing",
    schemaVersion: "1.0",
    id: idFactory.next("drawing"),
    metadata: { createdAt: now, updatedAt: now },
    unitSystem: { length: input.unit ?? "mm", angle: "deg" },
    coordinateFrames: [
      {
        id: "frame_document",
        kind: "document",
        transform: [1, 0, 0, 1, 0, 0]
      }
    ],
    geometry: [],
    annotations: [],
    relations: [],
    features: []
  };
}
const _LocalPythonVectorizerProcess = class _LocalPythonVectorizerProcess {
  constructor(child, timeoutMs) {
    __privateAdd(this, _LocalPythonVectorizerProcess_instances);
    __privateAdd(this, _pending2, /* @__PURE__ */ new Map());
    __privateAdd(this, _closed, false);
    __privateAdd(this, _stderr, "");
    this.child = child;
    this.timeoutMs = timeoutMs;
    createInterface({ input: child.stdout }).on("line", (line) => __privateMethod(this, _LocalPythonVectorizerProcess_instances, onLine_fn).call(this, line));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      __privateSet(this, _stderr, `${__privateGet(this, _stderr)}${chunk}`.slice(-4096));
    });
    child.on("error", () => __privateMethod(this, _LocalPythonVectorizerProcess_instances, failAll_fn).call(this, new Error("PYTHON_VECTORIZATION_PROCESS_ERROR")));
    child.on("exit", () => {
      if (!__privateGet(this, _closed)) __privateMethod(this, _LocalPythonVectorizerProcess_instances, failAll_fn).call(this, new Error(`PYTHON_VECTORIZATION_EXITED ${__privateGet(this, _stderr)}`.trim()));
    });
  }
  static async create(input) {
    var _a3;
    const child = spawn(input.pythonPath, ["-u", input.scriptPath], {
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const provider = new _LocalPythonVectorizerProcess(child, input.timeoutMs);
    try {
      await __privateMethod(_a3 = provider, _LocalPythonVectorizerProcess_instances, invoke_fn).call(_a3, { operation: "health" }, new AbortController().signal);
      return provider;
    } catch (error) {
      await provider.close();
      throw error;
    }
  }
  async vectorize(input) {
    if (input.bytes.byteLength === 0 || input.width < 1 || input.height < 1 || input.maxPixels < 1) {
      throw new Error("PYTHON_VECTORIZATION_SOURCE_INVALID");
    }
    const value = await __privateMethod(this, _LocalPythonVectorizerProcess_instances, invoke_fn).call(this, {
      operation: "vectorize",
      sourceId: input.sourceId,
      mimeType: input.mimeType,
      imageBase64: Buffer.from(input.bytes).toString("base64"),
      maxPixels: input.maxPixels
    }, input.signal);
    return parseResult(value, input.sourceId);
  }
  async close() {
    if (__privateGet(this, _closed)) return;
    __privateSet(this, _closed, true);
    __privateMethod(this, _LocalPythonVectorizerProcess_instances, failAll_fn).call(this, new Error("PYTHON_VECTORIZATION_CLOSED"));
    if (this.child.exitCode !== null || this.child.signalCode !== null) return;
    await new Promise((resolve2) => {
      const timer = setTimeout(() => {
        this.child.kill("SIGKILL");
        resolve2();
      }, 1e3);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve2();
      });
      this.child.kill("SIGTERM");
    });
  }
};
_pending2 = new WeakMap();
_closed = new WeakMap();
_stderr = new WeakMap();
_LocalPythonVectorizerProcess_instances = new WeakSet();
invoke_fn = function(payload, signal) {
  if (__privateGet(this, _closed)) return Promise.reject(new Error("PYTHON_VECTORIZATION_CLOSED"));
  signal.throwIfAborted();
  const id = randomUUID();
  return new Promise((resolve2, reject) => {
    const abort = () => __privateMethod(this, _LocalPythonVectorizerProcess_instances, reject_fn).call(this, id, signal.reason ?? new Error("PYTHON_VECTORIZATION_ABORTED"));
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => __privateMethod(this, _LocalPythonVectorizerProcess_instances, reject_fn).call(this, id, new Error("PYTHON_VECTORIZATION_TIMEOUT")), this.timeoutMs);
    __privateGet(this, _pending2).set(id, {
      resolve: resolve2,
      reject,
      timer,
      removeAbort: () => signal.removeEventListener("abort", abort)
    });
    this.child.stdin.write(`${JSON.stringify({ id, ...payload })}
`, (error) => {
      if (error) __privateMethod(this, _LocalPythonVectorizerProcess_instances, reject_fn).call(this, id, new Error("PYTHON_VECTORIZATION_WRITE_FAILED"));
    });
  });
};
onLine_fn = function(line) {
  let response;
  try {
    response = JSON.parse(line);
  } catch {
    __privateMethod(this, _LocalPythonVectorizerProcess_instances, failAll_fn).call(this, new Error("PYTHON_VECTORIZATION_PROTOCOL_INVALID"));
    return;
  }
  if (typeof response.id !== "string") return;
  const pending = __privateGet(this, _pending2).get(response.id);
  if (!pending) return;
  __privateGet(this, _pending2).delete(response.id);
  clearTimeout(pending.timer);
  pending.removeAbort();
  if (response.ok === true) pending.resolve(response.value);
  else pending.reject(new Error(typeof response.code === "string" ? response.code : "PYTHON_VECTORIZATION_FAILED"));
};
reject_fn = function(id, error) {
  const pending = __privateGet(this, _pending2).get(id);
  if (!pending) return;
  __privateGet(this, _pending2).delete(id);
  clearTimeout(pending.timer);
  pending.removeAbort();
  pending.reject(error);
};
failAll_fn = function(error) {
  for (const id of [...__privateGet(this, _pending2).keys()]) __privateMethod(this, _LocalPythonVectorizerProcess_instances, reject_fn).call(this, id, error);
};
let LocalPythonVectorizerProcess = _LocalPythonVectorizerProcess;
function parseResult(value, sourceId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PYTHON_VECTORIZATION_RESULT_INVALID");
  const result = value;
  if (result.sourceId !== sourceId || typeof result.pipelineVersion !== "string" || !positiveInteger(result.width) || !positiveInteger(result.height) || !positive$1(result.analysisScale) || !positive$1(result.medianLineWidthPx) || !Array.isArray(result.chains)) throw new Error("PYTHON_VECTORIZATION_RESULT_INVALID");
  for (const chain of result.chains) {
    if (!chain || typeof chain !== "object" || Array.isArray(chain)) throw new Error("PYTHON_VECTORIZATION_CHAIN_INVALID");
    const record2 = chain;
    if (typeof record2.id !== "string" || typeof record2.closed !== "boolean" || !Array.isArray(record2.simplified) || !Array.isArray(record2.pieces) || !record2.segmentation || typeof record2.segmentation !== "object") {
      throw new Error("PYTHON_VECTORIZATION_CHAIN_INVALID");
    }
  }
  return structuredClone(result);
}
function positive$1(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
function positiveInteger(value) {
  return positive$1(value) && Number.isInteger(value);
}
const PAGE_WIDTH = 500;
class LocalCleanLineVectorizer {
  constructor(options = {}) {
    __privateAdd(this, _timeoutMs);
    __privateSet(this, _timeoutMs, options.timeoutMs ?? 12e4);
  }
  async vectorize(input) {
    input.signal.throwIfAborted();
    const root = resolve(import.meta.dirname, "../../..");
    const localPython = resolve(root, ".local/vectorai/cv-venv/bin/python");
    const packagedScript = resolve(import.meta.dirname, "vectorai_vectorizer.py");
    const provider = await LocalPythonVectorizerProcess.create({
      pythonPath: await accessible(localPython) ? localPython : "python3",
      scriptPath: await accessible(packagedScript) ? packagedScript : resolve(root, "python/vectorai_vectorizer.py"),
      timeoutMs: __privateGet(this, _timeoutMs)
    });
    try {
      const result = await provider.vectorize({
        sourceId: String(input.attachment.attachmentId),
        mimeType: input.attachment.mediaType,
        bytes: input.data,
        width: input.attachment.width,
        height: input.attachment.height,
        maxPixels: Math.min(input.attachment.width * input.attachment.height, 4e6),
        signal: input.signal
      });
      input.signal.throwIfAborted();
      return vectorizedDocument(input.drawingId, result);
    } finally {
      await provider.close();
    }
  }
}
_timeoutMs = new WeakMap();
async function accessible(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
function vectorizedDocument(drawingId, result) {
  const now = Date.now();
  const document = createEmptyDrawing({
    idFactory: { next: () => drawingId },
    now: () => now
  });
  document.id = drawingId;
  const factor = PAGE_WIDTH / result.width;
  document.coordinateFrames.push({
    id: `frame_source_${safeId(result.sourceId)}`,
    kind: "source",
    parentId: "frame_document",
    transform: [factor, 0, 0, -factor, 0, result.height * factor]
  });
  const projections = result.chains.map((chain) => ({ chain, nodes: chainNodes(result, chain) }));
  document.geometry = projections.flatMap(({ nodes }) => nodes);
  document.relations = projections.flatMap(({ chain, nodes }) => compoundRelations(result, chain, nodes));
  document.features = projections.flatMap(({ chain, nodes }) => {
    const relations = document.relations.filter((relation) => relation.type === "topology" && relation.nodeIds.every((id) => nodes.some((node) => node.id === id)));
    return nodes.length > 1 ? [compoundFeature(result, chain, nodes, relations)] : [];
  });
  return {
    document,
    bounds: {
      minX: 0,
      minY: 0,
      maxX: PAGE_WIDTH,
      maxY: round(result.height * factor)
    },
    provisional: false
  };
}
function chainNodes(result, chain) {
  var _a3, _b;
  const candidates = chain.pieces.map((piece, index) => candidateNode(result, chain, piece, index));
  if (candidates.length > 0 && candidates.every((node) => node !== null)) {
    return candidates;
  }
  const vertices = chain.simplified.slice(0, 256).map((point) => ({ point: sourcePoint(result, point) }));
  if (vertices.length < (chain.closed ? 3 : 2)) return [];
  return [{
    ...commonNode(result, chain, [], ((_b = (_a3 = chain.pieces[0]) == null ? void 0 : _a3.candidate) == null ? void 0 : _b.confidence) ?? 0.8),
    type: "polyline",
    vertices,
    closed: chain.closed
  }];
}
function candidateNode(result, chain, piece, index) {
  const candidate = piece.candidate;
  if (!candidate || !candidateIsUsable(candidate, piece, chain.segmentation.fitTolerancePx)) return null;
  const common = commonNode(
    result,
    chain,
    chain.pieces.length === 1 ? [] : [piece.id, String(index)],
    candidate.confidence
  );
  const parameters = candidate.parameters;
  switch (candidate.type) {
    case "line":
      return {
        ...common,
        type: "line",
        start: sourcePoint(result, parameters.start),
        end: sourcePoint(result, parameters.end)
      };
    case "circle":
      return {
        ...common,
        type: "circle",
        center: sourcePoint(result, parameters.center),
        radius: round(parameters.radius * scale(result))
      };
    case "arc":
      return {
        ...common,
        type: "arc",
        center: sourcePoint(result, parameters.center),
        radius: round(parameters.radius * scale(result)),
        startAngle: normalizeDegrees(-parameters.startAngle),
        endAngle: normalizeDegrees(-parameters.endAngle),
        counterClockwise: typeof parameters.counterClockwise === "boolean" ? !parameters.counterClockwise : true
      };
    case "ellipse": {
      const axis = parameters.majorAxis;
      return {
        ...common,
        type: "ellipse",
        center: sourcePoint(result, parameters.center),
        majorAxis: [round(axis[0] * scale(result)), round(-axis[1] * scale(result))],
        ratio: parameters.ratio
      };
    }
  }
}
function candidateIsUsable(candidate, piece, tolerance) {
  if (!finite(candidate.fitErrorP95) || candidate.fitErrorP95 > tolerance) return false;
  const point = (value) => Array.isArray(value) && value.length === 2 && value.every(finite);
  switch (candidate.type) {
    case "line":
      return !piece.closed && point(candidate.parameters.start) && point(candidate.parameters.end);
    case "circle":
      return piece.closed && point(candidate.parameters.center) && positive(candidate.parameters.radius);
    case "arc":
      return !piece.closed && point(candidate.parameters.center) && positive(candidate.parameters.radius) && finite(candidate.parameters.startAngle) && finite(candidate.parameters.endAngle);
    case "ellipse":
      return piece.closed && point(candidate.parameters.center) && point(candidate.parameters.majorAxis) && positive(candidate.parameters.ratio);
  }
}
function commonNode(result, chain, member, confidence) {
  return {
    id: stableId("node_vec", result.sourceId, chain.id, ...member),
    visible: true,
    quality: {
      status: confidence < 0.6 ? "candidate" : "confirmed",
      confidence,
      evidenceRefs: []
    }
  };
}
function compoundRelations(result, chain, nodes) {
  if (nodes.length < 2) return [];
  const pairCount = chain.closed ? nodes.length : nodes.length - 1;
  return Array.from({ length: pairCount }, (_, index) => ({
    id: stableId("relation_vec", result.sourceId, chain.id, String(index)),
    type: "topology",
    plane: "topology",
    kind: "connected",
    nodeIds: [nodes[index].id, nodes[(index + 1) % nodes.length].id],
    visible: true,
    quality: {
      status: nodes[index].quality.status === "candidate" || nodes[(index + 1) % nodes.length].quality.status === "candidate" ? "candidate" : "confirmed",
      confidence: Math.min(
        nodes[index].quality.confidence ?? 1,
        nodes[(index + 1) % nodes.length].quality.confidence ?? 1
      ),
      evidenceRefs: []
    }
  }));
}
function compoundFeature(result, chain, nodes, relations) {
  const confidence = nodes.reduce((sum, node) => sum + (node.quality.confidence ?? 1), 0) / nodes.length;
  return {
    id: stableId("feature_vec", result.sourceId, chain.id),
    type: "feature",
    semanticType: "compound-path",
    geometryIds: nodes.map((node) => node.id),
    annotationIds: [],
    relationIds: relations.map((relation) => relation.id),
    properties: {
      sourceChainId: chain.id,
      ordered: true,
      closed: chain.closed,
      sampleRanges: chain.pieces.map((piece) => [...piece.sampleRange]),
      wraps: chain.pieces.map((piece) => piece.wraps),
      algorithmVersion: chain.segmentation.algorithmVersion
    },
    visible: true,
    quality: {
      status: nodes.some((node) => node.quality.status === "candidate") ? "candidate" : "confirmed",
      confidence,
      evidenceRefs: []
    }
  };
}
function stableId(prefix, ...parts) {
  return `${prefix}_${createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 20)}`;
}
function sourcePoint(result, point) {
  const factor = scale(result);
  return [round(point[0] * factor), round((result.height - point[1]) * factor)];
}
function scale(result) {
  return PAGE_WIDTH / result.width;
}
function safeId(value) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function positive(value) {
  return finite(value) && value > 0;
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function normalizeDegrees(value) {
  return round((value % 360 + 360) % 360);
}
function round(value) {
  return Math.round(value * 1e6) / 1e6;
}
class SemanticEditService {
  constructor(drawings, ports) {
    __privateAdd(this, _SemanticEditService_instances);
    __privateAdd(this, _pendingInstructions, /* @__PURE__ */ new Map());
    __privateAdd(this, _sessionPolicies, /* @__PURE__ */ new Map());
    __privateAdd(this, _tasks, /* @__PURE__ */ new Map());
    __privateAdd(this, _observations, /* @__PURE__ */ new Map());
    __privateAdd(this, _contexts, /* @__PURE__ */ new Map());
    __privateAdd(this, _groundings, /* @__PURE__ */ new Map());
    __privateAdd(this, _previews2, /* @__PURE__ */ new Map());
    __privateAdd(this, _evaluations, /* @__PURE__ */ new Map());
    __privateAdd(this, _reviewInflight, /* @__PURE__ */ new Map());
    __privateAdd(this, _stickyReviewDefects, /* @__PURE__ */ new Map());
    __privateAdd(this, _selectionProjections, /* @__PURE__ */ new Map());
    this.drawings = drawings;
    this.ports = ports;
  }
  bindUserInstruction(sessionId, instruction) {
    const objective = instruction.objective.trim();
    if (!objective) return;
    __privateGet(this, _pendingInstructions).set(sessionId, { ...instruction, objective });
  }
  startBoundTask(sessionId, policy) {
    const pending = __privateGet(this, _pendingInstructions).get(sessionId);
    if (!pending) throw new Error("EDIT_USER_INSTRUCTION_REQUIRED");
    __privateGet(this, _pendingInstructions).delete(sessionId);
    return this.startTask(sessionId, { ...pending, policy: policy ?? __privateGet(this, _sessionPolicies).get(sessionId) ?? "auto-safe" });
  }
  setSessionPolicy(sessionId, policy) {
    __privateGet(this, _sessionPolicies).set(sessionId, policy);
    const current = __privateGet(this, _tasks).get(sessionId);
    if (policy === "review" && (current == null ? void 0 : current.active) && current.ref.policy === "auto-safe") {
      current.ref = { ...current.ref, policy: "review", stateEpoch: current.ref.stateEpoch + 1 };
    }
  }
  projectSelection(sessionId, input) {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: "rejected", code: "DRAWING_REQUIRED", message: "No Drawing is loaded." };
    if (snapshot.ref.drawingId !== input.expectedRef.drawingId || snapshot.ref.revision !== input.expectedRef.revision) return { status: "stale", currentRef: structuredClone(snapshot.ref) };
    const ids = [...new Set(input.nodeIds)];
    if (ids.length === 0) {
      __privateGet(this, _selectionProjections).delete(sessionId);
      return { status: "cleared" };
    }
    if (ids.length > 256) {
      return { status: "rejected", code: "SELECTION_SIZE_INVALID", message: "Select between 1 and 256 Drawing nodes." };
    }
    const visible = new Map(allNodes(snapshot.document).map((node) => [String(node.id), node.visible]));
    if (ids.some((id) => visible.get(id) !== true)) {
      return { status: "rejected", code: "SELECTION_NODE_INVALID", message: "Selection contains a missing or hidden node." };
    }
    const projection = {
      selectionProjectionId: this.ports.id("selection"),
      drawingRef: structuredClone(snapshot.ref),
      nodeIds: ids,
      projectionDigest: this.ports.digest(canonicalString({ ref: snapshot.ref, nodeIds: [...ids].sort() })),
      expiresAt: this.ports.now() + 10 * 6e4
    };
    __privateGet(this, _selectionProjections).set(sessionId, projection);
    return { status: "projected", projection: structuredClone(projection) };
  }
  currentSelectionProjection(sessionId) {
    const projection = __privateGet(this, _selectionProjections).get(sessionId);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!projection || projection.expiresAt <= this.ports.now() || !snapshot || projection.drawingRef.drawingId !== snapshot.ref.drawingId || projection.drawingRef.revision !== snapshot.ref.revision) {
      if (projection) __privateGet(this, _selectionProjections).delete(sessionId);
      return null;
    }
    return structuredClone(projection);
  }
  startTask(sessionId, input) {
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshot_fn).call(this, sessionId);
    const former = __privateGet(this, _tasks).get(sessionId);
    if (former) former.active = false;
    const workspacePreview = this.drawings.getPreview(sessionId);
    if (workspacePreview) this.drawings.discardPreview(sessionId, { handle: workspacePreview.handle });
    __privateGet(this, _previews2).delete(sessionId);
    const objective = input.objective.trim();
    if (!objective) throw new Error("EDIT_OBJECTIVE_REQUIRED");
    const ref = {
      taskId: this.ports.id("task"),
      rootUserMessageDigest: input.rootUserMessageDigest,
      authoritativeObjectiveDigest: this.ports.digest(canonicalString({ text: objective })),
      baseRef: structuredClone(snapshot.ref),
      policy: input.policy,
      stateEpoch: ((former == null ? void 0 : former.ref.stateEpoch) ?? 0) + 1
    };
    __privateGet(this, _tasks).set(sessionId, { ref, objective, candidateCount: 0, active: true });
    return structuredClone(ref);
  }
  async observe(sessionId, input) {
    var _a3;
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const selection = this.currentSelectionProjection(sessionId);
    const viewport = ((_a3 = this.drawings.summarize(sessionId)) == null ? void 0 : _a3.bounds) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const rendered = this.ports.renderObservation ? await this.ports.renderObservation({
      document: snapshot.document,
      viewport,
      selectedNodeIds: (selection == null ? void 0 : selection.nodeIds) ?? []
    }) : void 0;
    const basis = { kind: "canonical", ref: structuredClone(snapshot.ref) };
    const semanticContentDigest = this.ports.digest(canonicalSemanticString(snapshot.document));
    const ref = {
      observationId: this.ports.id("observation"),
      taskId: task.ref.taskId,
      basis,
      artifactRefs: [{
        id: rendered ? String(rendered.attachment.attachmentId) : this.ports.id("observation-artifact"),
        contentDigest: (rendered == null ? void 0 : rendered.contentDigest) ?? semanticContentDigest,
        mimeType: "image/png",
        basis
      }],
      ...selection ? { selectionProjectionId: selection.selectionProjectionId } : {},
      observationDigest: this.ports.digest(canonicalString({
        taskId: task.ref.taskId,
        ref: snapshot.ref,
        semanticContentDigest,
        artifactContentDigest: (rendered == null ? void 0 : rendered.contentDigest) ?? semanticContentDigest,
        selectionProjectionDigest: selection == null ? void 0 : selection.projectionDigest
      }))
    };
    __privateGet(this, _observations).set(ref.observationId, {
      ref,
      ...rendered ? {
        attachment: rendered.attachment,
        view: {
          width: rendered.width,
          height: rendered.height,
          worldToImage: rendered.worldToImage
        }
      } : {}
    });
    return structuredClone(ref);
  }
  observationAttachment(observationId) {
    var _a3;
    const attachment = (_a3 = __privateGet(this, _observations).get(observationId)) == null ? void 0 : _a3.attachment;
    return attachment ? structuredClone(attachment) : null;
  }
  buildContext(sessionId, input) {
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    const observation = __privateGet(this, _observations).get(input.observationId);
    if (!observation || observation.ref.taskId !== task.ref.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const world = new WorldModelCompiler({ digest: this.ports.digest }).compile(
      snapshot.document,
      String(snapshot.ref.revision),
      { limit: 2e3 }
    );
    const geometryFacts = snapshot.document.geometry.slice(0, 512).map((node) => ({
      nodeId: String(node.id),
      type: node.type,
      quality: node.quality.status,
      center: geometryCenter(node),
      bounds: geometryNodeBounds(node)
    }));
    const connectedCarrierFacts = findConnectedCarrierCandidates(snapshot.document).map((candidate) => ({
      ...candidate,
      interfaces: findConnectedCarrierInterfaces(snapshot.document, candidate.carrierNodeId).map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint }))
    }));
    const topology = buildGeometryTopologyGraph({
      document: snapshot.document,
      revision: String(snapshot.ref.revision)
    });
    const topologyFacts = {
      segmentCount: topology.segments.length,
      vertexCount: topology.vertices.length,
      interfaceVertices: topology.vertices.flatMap((vertex) => {
        const nodeIds = [...new Set(vertex.incidentSegmentIds.flatMap((segmentId) => {
          const segment = topology.segment(segmentId);
          return segment ? [String(segment.nodeId)] : [];
        }))].sort();
        return nodeIds.length > 1 ? [{ vertexId: vertex.id, point: structuredClone(vertex.point), nodeIds }] : [];
      }).slice(0, 512)
    };
    const knowledgeStatus = world.knowledge.state === "resolved" ? "complete" : world.knowledge.state === "partial" ? "partial" : "unknown";
    const ref = {
      contextId: this.ports.id("context"),
      taskId: task.ref.taskId,
      observationId: observation.ref.observationId,
      geometryFacts,
      connectedCarrierFacts,
      topologyFacts,
      knowledge: {
        status: knowledgeStatus,
        worldModelVersion: world.compilerVersion,
        unresolvedBoundaryRefs: world.knowledge.unresolvedBoundaryRefs
      },
      contextDigest: this.ports.digest(canonicalString({
        observationDigest: observation.ref.observationDigest,
        geometryFacts,
        connectedCarrierFacts,
        topologyFacts,
        worldInputDigest: world.inputDigest,
        worldKnowledge: world.knowledge
      }))
    };
    __privateGet(this, _contexts).set(ref.contextId, ref);
    return structuredClone(ref);
  }
  ground(sessionId, input) {
    var _a3;
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    const context = __privateGet(this, _contexts).get(input.contextId);
    if (!context || context.taskId !== task.ref.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const nodes = new Map(allNodes(snapshot.document).map((node) => [String(node.id), node]));
    const selectionProjectionId = ((_a3 = input.selectionProjectionId) == null ? void 0 : _a3.trim()) || void 0;
    const projection = selectionProjectionId === void 0 ? null : this.currentSelectionProjection(sessionId);
    if (selectionProjectionId !== void 0 && (projection == null ? void 0 : projection.selectionProjectionId) !== selectionProjectionId) {
      throw new Error("EDIT_SELECTION_PROJECTION_STALE");
    }
    const targetNodeIds = projection ? [...projection.nodeIds] : [...new Set(input.targetNodeIds)];
    if (projection && input.targetNodeIds.length > 0 && canonicalString([...new Set(input.targetNodeIds)].sort()) !== canonicalString([...targetNodeIds].sort())) throw new Error("EDIT_SELECTION_SCOPE_MISMATCH");
    if (targetNodeIds.length === 0 || targetNodeIds.some((id) => !nodes.has(id))) {
      throw new Error("EDIT_TARGET_UNRESOLVED");
    }
    const discoveredInterfaces = inferSelectionInterfaces(
      snapshot.document,
      targetNodeIds,
      snapshot.ref.revision
    );
    const discoveredIds = new Set(discoveredInterfaces.map(({ interfaceId }) => interfaceId));
    const interfaces = input.interfaces.length > 0 ? structuredClone(input.interfaces) : discoveredInterfaces;
    for (const port of interfaces) {
      const node = nodes.get(port.nodeId);
      if (!node || node.type !== "line" || !port.endpoint) throw new Error("EDIT_INTERFACE_UNRESOLVED");
      if (discoveredInterfaces.length > 0 && !discoveredIds.has(port.interfaceId)) {
        throw new Error("EDIT_INTERFACE_NOT_CONTACTED");
      }
    }
    const sourceStatus = snapshot.provisional ? "provisional" : targetNodeIds.some((id) => {
      var _a4;
      return ((_a4 = nodes.get(id)) == null ? void 0 : _a4.quality.status) !== "confirmed";
    }) ? "candidate" : "confirmed";
    const targetHandle = this.ports.id("target");
    const target = {
      targetHandle,
      targetNodeIds,
      interfaces,
      sourceStatus
    };
    const ref = {
      groundingId: this.ports.id("grounding"),
      taskId: task.ref.taskId,
      contextId: context.contextId,
      targetHandle,
      targetNodeIds: [...target.targetNodeIds],
      interfaces: target.interfaces.map((port) => ({
        interfaceId: port.interfaceId,
        nodeId: port.nodeId,
        endpoint: port.endpoint
      })),
      targetScopeDigest: this.ports.digest(canonicalString([...target.targetNodeIds].sort())),
      protectedScopeDigest: this.ports.digest(canonicalString(
        allNodes(snapshot.document).map(({ id }) => String(id)).filter((id) => !target.targetNodeIds.includes(id) && !target.interfaces.some((port) => port.nodeId === id)).sort()
      )),
      evidenceDigest: this.ports.digest(canonicalString({
        context: context.contextDigest,
        sourceStatus,
        selectionProjectionDigest: projection == null ? void 0 : projection.projectionDigest
      }))
    };
    __privateGet(this, _groundings).set(ref.groundingId, { ref, target });
    return structuredClone(ref);
  }
  previewProgram(sessionId, input) {
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    if (task.candidateCount >= 3) throw new Error("EDIT_CANDIDATE_BUDGET_EXHAUSTED");
    const grounding = __privateGet(this, _groundings).get(input.groundingId);
    if (!grounding || grounding.ref.taskId !== task.ref.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    const program = spatialEditProgramSchema.parse(input.program);
    if (program.objective !== task.objective) throw new Error("EDIT_OBJECTIVE_MISMATCH");
    if (program.baseRef.drawingId !== task.ref.baseRef.drawingId || program.baseRef.revision !== task.ref.baseRef.revision) throw new Error("EDIT_BASE_MISMATCH");
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const compilation = compileSpatialEditProgram({
      document: snapshot.document,
      program,
      grounding: grounding.target,
      ports: this.ports
    });
    const workspace = this.drawings.createPreview(sessionId, {
      ref: snapshot.ref,
      commands: compilation.forward,
      summary: program.summary
    });
    if (workspace.status !== "previewed") {
      throw new Error(workspace.status === "rejected" ? workspace.code ?? "EDIT_PREVIEW_REJECTED" : "EDIT_BASE_STALE");
    }
    const finalizeOperationId = this.ports.id("finalize");
    const finalizeOperationBindingDigest = this.ports.digest(canonicalString({
      mode: "semantic",
      sessionId,
      drawingId: snapshot.ref.drawingId,
      operationId: finalizeOperationId,
      previewHandle: workspace.preview.handle,
      candidateDigest: compilation.candidateDigest
    }));
    const ref = {
      previewHandle: workspace.preview.handle,
      taskId: task.ref.taskId,
      groundingId: grounding.ref.groundingId,
      baseRef: structuredClone(snapshot.ref),
      candidateDigest: compilation.candidateDigest,
      effectDigest: compilation.effectDigest,
      finalizeOperationId,
      finalizeOperationBindingDigest
    };
    task.candidateCount += 1;
    __privateGet(this, _previews2).set(sessionId, { ref, task, grounding, program, compilation });
    return structuredClone(ref);
  }
  previewGroundedTransform(sessionId, input) {
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    const grounding = __privateGet(this, _groundings).get(input.groundingId);
    if (!grounding || grounding.ref.taskId !== task.ref.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    const translation = finiteVec2(input.translation, "EDIT_TRANSLATION_INVALID");
    const rotationDegrees = input.rotationDegrees;
    if (rotationDegrees !== void 0 && !Number.isFinite(rotationDegrees)) throw new Error("EDIT_ROTATION_INVALID");
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const interfaces = grounding.target.interfaces.map(({ interfaceId }) => interfaceId);
    const closedCarrier = grounding.target.targetNodeIds.length === 1 ? snapshot.document.geometry.find(({ id }) => String(id) === grounding.target.targetNodeIds[0]) : void 0;
    const operation = interfaces.length > 0 && ((closedCarrier == null ? void 0 : closedCarrier.type) === "circle" || (closedCarrier == null ? void 0 : closedCarrier.type) === "ellipse") ? {
      kind: "connected_transform",
      translation,
      ...rotationDegrees === void 0 ? {} : { rotationRadians: rotationDegrees * Math.PI / 180 },
      interfaceIds: interfaces
    } : {
      kind: "rigid_transform",
      translation,
      rotationRadians: (rotationDegrees ?? 0) * Math.PI / 180,
      pivot: input.pivot === void 0 ? groundedGeometryCenter(snapshot.document, grounding.target.targetNodeIds) : finiteVec2(input.pivot, "EDIT_PIVOT_INVALID")
    };
    return this.previewProgram(sessionId, {
      taskId: task.ref.taskId,
      groundingId: grounding.ref.groundingId,
      program: {
        baseRef: structuredClone(task.ref.baseRef),
        targetHandle: grounding.target.targetHandle,
        summary: input.summary,
        objective: task.objective,
        operations: [operation],
        preserveScopes: [],
        postconditions: [],
        evidenceRefs: [grounding.ref.evidenceDigest]
      }
    });
  }
  reviseGroundedTransform(sessionId, input) {
    const current = __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, input.currentPreviewHandle, input.currentCandidateDigest);
    if (current.ref.taskId !== input.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    return this.previewGroundedTransform(sessionId, input);
  }
  revisePreview(sessionId, input) {
    const current = __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, input.currentPreviewHandle, input.currentCandidateDigest);
    if (current.ref.taskId !== input.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    return this.previewProgram(sessionId, {
      taskId: input.taskId,
      groundingId: input.groundingId,
      program: input.program
    });
  }
  async evaluatePreview(sessionId, input) {
    var _a3, _b, _c, _d, _e, _f, _g, _h, _i;
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    const preview = __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, input.previewHandle, input.candidateDigest);
    if (preview.task !== task) throw new Error("EDIT_LINEAGE_MISMATCH");
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const beforeContentDigest = this.ports.digest(canonicalSemanticString(snapshot.document));
    const afterContentDigest = this.ports.digest(canonicalSemanticString(preview.compilation.candidate));
    const riskKey = this.ports.digest(canonicalString({
      taskObjective: task.ref.authoritativeObjectiveDigest,
      baseRef: task.ref.baseRef,
      afterContentDigest,
      effectDigest: preview.ref.effectDigest
    }));
    const sticky = __privateGet(this, _stickyReviewDefects).get(riskKey);
    let reviewPromise = __privateGet(this, _reviewInflight).get(riskKey);
    if (!reviewPromise && !sticky && this.ports.review) {
      const viewport = ((_a3 = this.drawings.summarize(sessionId)) == null ? void 0 : _a3.bounds) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
      reviewPromise = this.ports.review({
        sessionId,
        objective: task.objective,
        beforeSemanticDigest: beforeContentDigest,
        afterSemanticDigest: afterContentDigest,
        effectDigest: preview.ref.effectDigest,
        changedNodeIds: [
          ...preview.compilation.actualEffect.createdNodeIds,
          ...preview.compilation.actualEffect.updatedNodeIds,
          ...preview.compilation.actualEffect.deletedNodeIds
        ],
        diagnostics: preview.compilation.diagnostics,
        beforeDocument: snapshot.document,
        afterDocument: preview.compilation.candidate,
        viewport,
        signal: input.signal
      });
      __privateGet(this, _reviewInflight).set(riskKey, reviewPromise);
    }
    let reviewed;
    if (sticky) reviewed = sticky;
    else if (reviewPromise) {
      try {
        reviewed = await reviewPromise;
      } finally {
        if (__privateGet(this, _reviewInflight).get(riskKey) === reviewPromise) __privateGet(this, _reviewInflight).delete(riskKey);
      }
    } else reviewed = {
      outcome: preview.compilation.diagnostics.some(({ hard }) => hard) ? "needs_revision" : "satisfied",
      defects: preview.compilation.diagnostics.filter(({ hard }) => hard).map((diagnostic) => ({
        code: diagnostic.code,
        reason: diagnostic.message,
        scopeDigest: preview.ref.effectDigest
      }))
    };
    if (reviewed.outcome === "needs_revision") {
      const immutable = structuredClone(reviewed);
      __privateGet(this, _stickyReviewDefects).set(riskKey, immutable);
      reviewed = immutable;
    }
    __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, input.previewHandle, input.candidateDigest);
    const review = {
      kind: "reviewer",
      provider: this.ports.review ? "dsh-subagent" : "deterministic-local",
      providerVersion: "1",
      authoritativeObjective: { text: task.objective, attachmentContentDigests: [] },
      renderManifest: {
        rendererVersion: ((_b = reviewed.render) == null ? void 0 : _b.rendererVersion) ?? "semantic-digest-v1",
        beforeContentDigest,
        afterContentDigest,
        artifactContentDigest: ((_c = reviewed.render) == null ? void 0 : _c.contentDigest) ?? afterContentDigest,
        comparisonLayout: "before | after",
        worldToImage: ((_d = reviewed.render) == null ? void 0 : _d.worldToImage) ?? [1, 0, 0, -1, 0, 0],
        viewport: ((_e = this.drawings.summarize(sessionId)) == null ? void 0 : _e.bounds) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 },
        width: ((_f = reviewed.render) == null ? void 0 : _f.width) ?? 1,
        height: ((_g = reviewed.render) == null ? void 0 : _g.height) ?? 1,
        overlays: ((_h = reviewed.render) == null ? void 0 : _h.overlays) ?? ["changed-nodes"]
      },
      outcome: reviewed.outcome,
      defects: reviewed.defects.map((diagnostic) => ({
        defectId: this.ports.id("defect"),
        code: diagnostic.code,
        reason: diagnostic.reason,
        scopeDigest: diagnostic.scopeDigest
      })),
      resolvedDefects: []
    };
    const evaluationId = this.ports.id("evaluation");
    const evaluationDigest = this.ports.digest(canonicalString({
      preview: preview.ref,
      diagnostics: preview.compilation.diagnostics,
      review
    }));
    const evaluation = {
      evaluationId,
      taskId: task.ref.taskId,
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      diagnostics: structuredClone(preview.compilation.diagnostics),
      mandatoryEvaluatorVersions: ["source-quality-v1", "scope-v1", "postconditions-v1", "inverse-v1"],
      review,
      evaluationDigest
    };
    const assessment = __privateMethod(this, _SemanticEditService_instances, assess_fn).call(this, sessionId, preview, evaluation);
    const ref = {
      evaluationId,
      taskId: task.ref.taskId,
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      evaluationDigest
    };
    __privateGet(this, _evaluations).set(evaluationId, { ref, evaluation, assessment });
    return {
      evaluation: structuredClone(evaluation),
      assessment: structuredClone(assessment),
      ...((_i = reviewed.render) == null ? void 0 : _i.attachment) ? { imageAttachment: structuredClone(reviewed.render.attachment) } : {}
    };
  }
  finalizePreview(sessionId, raw) {
    const request = finalizePreviewRequestSchema.parse(raw);
    const currentTask = __privateGet(this, _tasks).get(sessionId);
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!(currentTask == null ? void 0 : currentTask.active) || !preview || preview.task !== currentTask) throw new Error("EDIT_TASK_STALE");
    __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, request.previewHandle, request.previewDigest);
    if (request.finalizeOperationId !== preview.ref.finalizeOperationId || request.finalizeOperationBindingDigest !== preview.ref.finalizeOperationBindingDigest) throw new Error("EDIT_OPERATION_BINDING_MISMATCH");
    const evaluated = __privateGet(this, _evaluations).get(request.evaluationId);
    if (!evaluated || evaluated.ref.previewHandle !== preview.ref.previewHandle || evaluated.ref.candidateDigest !== preview.ref.candidateDigest) throw new Error("EDIT_EVALUATION_STALE");
    if (evaluated.assessment.disposition !== "auto_safe") {
      return {
        status: "rejected",
        disposition: evaluated.assessment.disposition === "blocked" ? "blocked" : "confirmation_required",
        code: evaluated.assessment.reasons[0] ?? "EDIT_CONFIRMATION_REQUIRED",
        message: evaluated.assessment.disposition === "blocked" ? "The candidate is blocked by a non-overridable safety rule." : "The candidate requires an exact human confirmation before commit."
      };
    }
    return __privateMethod(this, _SemanticEditService_instances, commitPreview_fn).call(this, sessionId, preview, evaluated, "auto-safe");
  }
  confirmFinalize(sessionId, raw) {
    const request = finalizePreviewRequestSchema.parse(raw);
    const currentTask = __privateGet(this, _tasks).get(sessionId);
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!(currentTask == null ? void 0 : currentTask.active) || !preview || preview.task !== currentTask) throw new Error("EDIT_TASK_STALE");
    __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, request.previewHandle, request.previewDigest);
    if (request.finalizeOperationId !== preview.ref.finalizeOperationId || request.finalizeOperationBindingDigest !== preview.ref.finalizeOperationBindingDigest) throw new Error("EDIT_OPERATION_BINDING_MISMATCH");
    const evaluated = __privateGet(this, _evaluations).get(request.evaluationId);
    if (!evaluated || evaluated.ref.candidateDigest !== preview.ref.candidateDigest) {
      throw new Error("EDIT_EVALUATION_STALE");
    }
    if (evaluated.assessment.disposition === "blocked") {
      return { status: "rejected", disposition: "blocked", code: evaluated.assessment.reasons[0] ?? "EDIT_BLOCKED", message: "The candidate is blocked." };
    }
    return __privateMethod(this, _SemanticEditService_instances, commitPreview_fn).call(this, sessionId, preview, evaluated, "confirmed");
  }
  discardPreview(sessionId, previewHandle) {
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!preview || preview.ref.previewHandle !== previewHandle) throw new Error("EDIT_PREVIEW_STALE");
    const result = this.drawings.discardPreview(sessionId, { handle: previewHandle });
    if (result.status !== "discarded") throw new Error(result.code ?? "EDIT_DISCARD_REJECTED");
    __privateGet(this, _previews2).delete(sessionId);
    return result;
  }
  getOperation(sessionId, operationId, bindingDigest) {
    return this.drawings.getOperation(sessionId, operationId, bindingDigest);
  }
  undo(sessionId, request) {
    return this.drawings.undoCommit(sessionId, request);
  }
  undoAuthorized(sessionId, input) {
    const operationId = this.ports.id("undo");
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: "undo",
      operationId,
      sessionId,
      drawingId: input.expectedCurrentRef.drawingId,
      targetCommitId: input.targetCommitId,
      expectedCurrentRef: input.expectedCurrentRef
    }));
    return this.undo(sessionId, { ...input, operationId, operationBindingDigest });
  }
  stageUndo(sessionId, input) {
    var _a3;
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: "rejected", code: "DRAWING_REQUIRED", message: "No Drawing is loaded." };
    if (snapshot.ref.drawingId !== input.expectedCurrentRef.drawingId || snapshot.ref.revision !== input.expectedCurrentRef.revision) return { status: "rejected", code: "UNDO_CONFLICT", message: "The Drawing revision changed." };
    if (!((_a3 = snapshot.lastCommit) == null ? void 0 : _a3.undoable) || snapshot.lastCommit.commitId !== input.targetCommitId) {
      return { status: "rejected", code: "UNDO_TARGET_NOT_CURRENT", message: "The requested commit is not the current undo target." };
    }
    const operationId = this.ports.id("undo");
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: "undo",
      operationId,
      sessionId,
      drawingId: input.expectedCurrentRef.drawingId,
      targetCommitId: input.targetCommitId,
      expectedCurrentRef: input.expectedCurrentRef
    }));
    return {
      status: "staged",
      ...structuredClone(input),
      operationId,
      operationBindingDigest,
      commandLine: `/drawing-undo ${input.targetCommitId} ${input.expectedCurrentRef.drawingId}@${input.expectedCurrentRef.revision} ${operationId} ${operationBindingDigest}`
    };
  }
  async runExtensionProgram(sessionId, input, signal) {
    const task = this.startBoundTask(sessionId);
    const observation = await this.observe(sessionId, { taskId: task.taskId });
    const context = this.buildContext(sessionId, {
      taskId: task.taskId,
      observationId: observation.observationId
    });
    const grounding = this.ground(sessionId, {
      taskId: task.taskId,
      contextId: context.contextId,
      targetNodeIds: input.targetNodeIds,
      interfaces: input.interfaces ?? []
    });
    const taskState = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, task.taskId);
    const preview = this.previewProgram(sessionId, {
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      program: {
        ...structuredClone(input.program),
        baseRef: structuredClone(task.baseRef),
        targetHandle: grounding.targetHandle,
        objective: taskState.objective
      }
    });
    const evaluated = await this.evaluatePreview(sessionId, {
      taskId: task.taskId,
      previewHandle: preview.previewHandle,
      candidateDigest: preview.candidateDigest,
      signal
    });
    const result = this.finalizePreview(sessionId, {
      previewHandle: preview.previewHandle,
      previewDigest: preview.candidateDigest,
      finalizeOperationId: preview.finalizeOperationId,
      finalizeOperationBindingDigest: preview.finalizeOperationBindingDigest,
      evaluationId: evaluated.evaluation.evaluationId
    });
    return { task, observation, context, grounding, preview, ...evaluated, result };
  }
}
_pendingInstructions = new WeakMap();
_sessionPolicies = new WeakMap();
_tasks = new WeakMap();
_observations = new WeakMap();
_contexts = new WeakMap();
_groundings = new WeakMap();
_previews2 = new WeakMap();
_evaluations = new WeakMap();
_reviewInflight = new WeakMap();
_stickyReviewDefects = new WeakMap();
_selectionProjections = new WeakMap();
_SemanticEditService_instances = new WeakSet();
commitPreview_fn = function(sessionId, preview, evaluated, mode) {
  const receipt = this.drawings.commitSemantic(sessionId, {
    expectedRef: preview.ref.baseRef,
    operationId: preview.ref.finalizeOperationId,
    operationBindingDigest: preview.ref.finalizeOperationBindingDigest,
    candidateDigest: preview.ref.candidateDigest,
    forward: preview.compilation.forward,
    inverse: preview.compilation.inverse,
    mode,
    assessment: evaluated.assessment,
    reviewEvidence: evaluated.evaluation.review
  });
  if (receipt.status === "no-effect") return {
    status: "already-satisfied",
    ref: receipt.ref,
    operationId: receipt.operationId,
    operationBindingDigest: receipt.operationBindingDigest
  };
  if (receipt.status !== "committed" || receipt.mode !== "semantic") {
    throw new Error("EDIT_COMMIT_RECEIPT_INVALID");
  }
  __privateGet(this, _previews2).delete(sessionId);
  return {
    status: "committed",
    mode,
    commitId: receipt.commitId,
    ref: receipt.resultingRef,
    operationId: receipt.operationId,
    operationBindingDigest: receipt.operationBindingDigest
  };
};
assess_fn = function(sessionId, preview, evaluation) {
  const reasons = [];
  const hard = evaluation.diagnostics.some((diagnostic) => diagnostic.severity === "error" && diagnostic.hard);
  if (hard) reasons.push("HARD_VALIDATION_FAILED");
  if (preview.grounding.target.sourceStatus !== "confirmed") reasons.push("SOURCE_NOT_CONFIRMED");
  if (evaluation.diagnostics.some((diagnostic) => diagnostic.severity !== "info")) reasons.push("DIAGNOSTICS_PRESENT");
  if (evaluation.review.outcome !== "satisfied") reasons.push("REVIEW_NOT_SATISFIED");
  const safeAnnotationCreate = preview.program.operations.every((operation) => operation.kind === "create_annotation_batch" && operation.annotations.every((node) => annotationConfirmed(node)) && operation.associations.every((node) => associationResolved(node)));
  if (preview.compilation.actualEffect.deletedNodeIds.length > 0 || preview.compilation.actualEffect.createdNodeIds.length > 0 && !safeAnnotationCreate) {
    reasons.push("LIFECYCLE_CHANGE");
  }
  const allowed = /* @__PURE__ */ new Set([
    ...preview.grounding.target.targetNodeIds,
    ...preview.grounding.target.interfaces.map(({ nodeId }) => nodeId)
  ]);
  if (preview.compilation.actualEffect.updatedNodeIds.some((id) => !allowed.has(id))) {
    reasons.push("OUT_OF_SCOPE_EFFECT");
  }
  const base = {
    assessmentId: this.ports.id("assessment"),
    taskId: preview.task.ref.taskId,
    drawingId: preview.ref.baseRef.drawingId,
    baseRef: structuredClone(preview.ref.baseRef),
    previewHandle: preview.ref.previewHandle,
    candidateDigest: preview.ref.candidateDigest,
    evaluationDigest: evaluation.evaluationDigest,
    policyVersion: "auto-safe-v1",
    evaluatorVersions: [...evaluation.mandatoryEvaluatorVersions],
    effectDigest: preview.ref.effectDigest,
    reasons
  };
  if (hard || reasons.includes("OUT_OF_SCOPE_EFFECT")) return {
    ...base,
    disposition: "blocked",
    hardDeny: hard,
    nonOverridableProtected: reasons.includes("OUT_OF_SCOPE_EFFECT")
  };
  if (preview.task.ref.policy !== "auto-safe") reasons.push("TASK_REVIEW_POLICY");
  if (reasons.length > 0) return {
    ...base,
    disposition: "confirmation_required",
    requiredEffectDigest: preview.ref.effectDigest
  };
  return {
    ...base,
    disposition: "auto_safe",
    autoQualification: {
      exactScope: true,
      cleanDiagnostics: true,
      sourceConfirmed: true,
      reviewerSatisfied: true,
      inverseVerified: true
    }
  };
};
task_fn = function(sessionId, taskId) {
  const task = __privateGet(this, _tasks).get(sessionId);
  if (!(task == null ? void 0 : task.active) || task.ref.taskId !== taskId) throw new Error("EDIT_TASK_STALE");
  return task;
};
preview_fn = function(sessionId, handle, digest2) {
  const preview = __privateGet(this, _previews2).get(sessionId);
  if (!preview || preview.ref.previewHandle !== handle || preview.ref.candidateDigest !== digest2) {
    throw new Error("EDIT_PREVIEW_STALE");
  }
  return preview;
};
snapshot_fn = function(sessionId) {
  const snapshot = this.drawings.getSnapshot(sessionId);
  if (!snapshot) throw new Error("DRAWING_REQUIRED");
  return snapshot;
};
snapshotAtTask_fn = function(sessionId, task) {
  const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshot_fn).call(this, sessionId);
  if (snapshot.ref.drawingId !== task.ref.baseRef.drawingId || snapshot.ref.revision !== task.ref.baseRef.revision) throw new Error("EDIT_BASE_STALE");
  return snapshot;
};
function allNodes(document) {
  return [...document.geometry, ...document.annotations, ...document.relations, ...document.features];
}
function inferSelectionInterfaces(document, targetNodeIds, revision) {
  const selected = new Set(targetNodeIds);
  const targets = document.geometry.filter((node) => selected.has(String(node.id)));
  const exactCarrierInterfaces = targets.flatMap((target) => target.type === "circle" || target.type === "ellipse" ? findConnectedCarrierInterfaces(document, String(target.id)).map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint })) : []);
  if (exactCarrierInterfaces.length > 0) {
    return exactCarrierInterfaces.sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
  }
  const topology = buildGeometryTopologyGraph({
    document,
    revision: String(revision)
  });
  const graphInterfaces = topology.vertices.flatMap((vertex) => {
    const segments = vertex.incidentSegmentIds.flatMap((id) => {
      const segment = topology.segment(id);
      return segment ? [segment] : [];
    });
    if (!segments.some(({ nodeId }) => selected.has(String(nodeId)))) return [];
    return segments.flatMap((segment) => {
      if (selected.has(String(segment.nodeId))) return [];
      const node = document.geometry.find(({ id }) => id === segment.nodeId);
      if (!node || node.type !== "line") return [];
      const endpoint = segment.startVertexId === vertex.id ? "start" : segment.endVertexId === vertex.id ? "end" : null;
      return endpoint ? [{
        interfaceId: `${String(node.id)}:${endpoint}`,
        nodeId: String(node.id),
        endpoint
      }] : [];
    });
  });
  if (graphInterfaces.length > 0) {
    return [...new Map(graphInterfaces.map((port) => [port.interfaceId, port])).values()].sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
  }
  const tolerance = Math.max(geometryDiagonal(document) * 25e-4, 1e-6);
  const interfaces = [];
  for (const connector of document.geometry) {
    if (selected.has(String(connector.id)) || connector.type !== "line") continue;
    for (const endpoint of ["start", "end"]) {
      const point = connector[endpoint];
      if (!targets.some((target) => distanceToGeometryBoundary(target, point) <= tolerance)) continue;
      interfaces.push({
        interfaceId: `${String(connector.id)}:${endpoint}`,
        nodeId: String(connector.id),
        endpoint
      });
    }
  }
  return interfaces.sort((left, right) => left.interfaceId.localeCompare(right.interfaceId));
}
function distanceToGeometryBoundary(node, point) {
  if (node.type === "circle") {
    return Math.abs(Math.hypot(point[0] - node.center[0], point[1] - node.center[1]) - node.radius);
  }
  if (node.type === "ellipse") {
    const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (major <= 1e-9 || node.ratio <= 0) return Number.POSITIVE_INFINITY;
    const ux = node.majorAxis[0] / major;
    const uy = node.majorAxis[1] / major;
    const dx = point[0] - node.center[0];
    const dy = point[1] - node.center[1];
    const normalized = Math.hypot((dx * ux + dy * uy) / major, (-dx * uy + dy * ux) / (major * node.ratio));
    return Math.abs(normalized - 1) * major;
  }
  const anchors = geometryAnchors(node);
  return anchors.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...anchors.map((anchor) => Math.hypot(point[0] - anchor[0], point[1] - anchor[1])));
}
function geometryAnchors(node) {
  switch (node.type) {
    case "point":
      return [[node.x, node.y]];
    case "line":
      return [node.start, node.end];
    case "ray":
    case "xline":
      return [node.origin];
    case "circle":
    case "arc":
    case "ellipse":
      return [node.center];
    case "polyline":
      return node.vertices.map(({ point }) => point);
    case "spline":
      return node.controlPoints;
  }
}
function geometryCenter(node) {
  if (node.type === "point") return [node.x, node.y];
  if (node.type === "circle" || node.type === "arc" || node.type === "ellipse") return [...node.center];
  const anchors = geometryAnchors(node);
  if (anchors.length === 0) return null;
  return [
    anchors.reduce((sum, point) => sum + point[0], 0) / anchors.length,
    anchors.reduce((sum, point) => sum + point[1], 0) / anchors.length
  ];
}
function geometryNodeBounds(node) {
  if (node.type === "circle" || node.type === "arc") return {
    minX: node.center[0] - node.radius,
    minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius,
    maxY: node.center[1] + node.radius
  };
  if (node.type === "ellipse") {
    const major = Math.hypot(...node.majorAxis);
    return {
      minX: node.center[0] - major,
      minY: node.center[1] - major,
      maxX: node.center[0] + major,
      maxY: node.center[1] + major
    };
  }
  const anchors = geometryAnchors(node);
  if (anchors.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const xs = anchors.map(([x]) => x);
  const ys = anchors.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  };
}
function geometryDiagonal(document) {
  const points = document.geometry.flatMap(geometryAnchors);
  if (points.length === 0) return 1;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) || 1;
}
function finiteVec2(value, code) {
  if (!Array.isArray(value) || value.length !== 2 || value.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(code);
  }
  return [value[0], value[1]];
}
function groundedGeometryCenter(document, targetNodeIds) {
  const selected = new Set(targetNodeIds);
  const points = document.geometry.filter(({ id }) => selected.has(String(id))).flatMap(geometryAnchors);
  if (points.length === 0) throw new Error("EDIT_TRANSFORM_PIVOT_UNRESOLVED");
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2
  ];
}
function annotationConfirmed(node) {
  const quality = node.quality;
  return (quality == null ? void 0 : quality.status) === "confirmed" && (node.type !== "dimension" || node.associationStatus === "resolved");
}
function associationResolved(node) {
  return node.type === "association" && node.kind === "annotation-target" && Array.isArray(node.geometryIds) && node.geometryIds.length > 0;
}
class InteractiveEditService {
  constructor(drawings, ports) {
    __privateAdd(this, _intents, /* @__PURE__ */ new Map());
    this.drawings = drawings;
    this.ports = ports;
  }
  stage(sessionId, request) {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: "rejected", message: "No Drawing is loaded.", code: "DRAWING_REQUIRED" };
    if (request.expectedRevision !== snapshot.ref.revision) return {
      status: "conflict",
      message: `Expected revision ${request.expectedRevision}, current revision is ${snapshot.ref.revision}`,
      snapshot
    };
    if (request.commands.length === 0 || request.commands.length > 256) return {
      status: "rejected",
      message: "Interactive edit command count is invalid.",
      code: "INTERACTIVE_COMMAND_COUNT_INVALID"
    };
    for (const command of request.commands) {
      if (command.type === "node.create") return {
        status: "rejected",
        message: "Interactive creation is not supported by this gesture path.",
        code: "INTERACTIVE_CREATE_FORBIDDEN"
      };
      if (command.type === "node.update" && Object.keys(command.changes).some((field) => field === "id" || field === "type" || field === "plane" || field === "quality")) return {
        status: "rejected",
        message: "The gesture attempted to change an identity or protected field.",
        code: "INTERACTIVE_FIELD_FORBIDDEN"
      };
    }
    const commands = structuredClone(request.commands);
    let candidate;
    let inverse;
    try {
      candidate = applyDrawingTransaction(snapshot.document, commands, this.ports.now());
      inverse = invertDrawingTransaction(snapshot.document, commands);
      const restored = applyDrawingTransaction(candidate, inverse, this.ports.now());
      if (canonicalSemanticString(restored) !== canonicalSemanticString(snapshot.document)) {
        throw new Error("INVERSE_VERIFICATION_FAILED");
      }
    } catch (error) {
      return { status: "rejected", message: errorMessage(error), code: "INTERACTIVE_EDIT_REJECTED" };
    }
    const intentId = this.ports.id("intent");
    const operationId = this.ports.id("interactive");
    const candidateDigest = this.ports.digest(canonicalSemanticString(candidate));
    const intentDigest = this.ports.digest(canonicalString({
      sessionId,
      intentId,
      expectedRef: snapshot.ref,
      commands,
      candidateDigest
    }));
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: "interactive",
      operationId,
      sessionId,
      drawingId: snapshot.ref.drawingId,
      intentId,
      intentDigest,
      candidateDigest
    }));
    const staged = {
      status: "staged",
      sessionId,
      expectedRef: structuredClone(snapshot.ref),
      commands,
      inverse,
      candidateDigest,
      intentId,
      intentDigest,
      operationId,
      operationBindingDigest,
      commandLine: `/drawing-apply-intent ${intentId} ${intentDigest} ${operationId} ${operationBindingDigest}`
    };
    __privateGet(this, _intents).set(intentId, staged);
    return publicIntent(staged);
  }
  apply(sessionId, tokens) {
    const intent = __privateGet(this, _intents).get(tokens.intentId);
    if (!intent || intent.sessionId !== sessionId) throw new Error("INTERACTIVE_INTENT_NOT_FOUND");
    for (const key of ["intentDigest", "operationId", "operationBindingDigest"]) {
      if (tokens[key] !== intent[key]) throw new Error("INTERACTIVE_INTENT_BINDING_MISMATCH");
    }
    return this.drawings.commitSemantic(sessionId, {
      expectedRef: intent.expectedRef,
      operationId: intent.operationId,
      operationBindingDigest: intent.operationBindingDigest,
      candidateDigest: intent.candidateDigest,
      forward: intent.commands,
      inverse: intent.inverse,
      mode: "interactive"
    });
  }
  applyCommand(sessionId, rawInput) {
    const [intentId, intentDigest, operationId, operationBindingDigest, ...extra] = rawInput.trim().split(/\s+/);
    if (!intentId || !intentDigest || !operationId || !operationBindingDigest || extra.length > 0) {
      throw new Error("INTERACTIVE_COMMAND_INVALID");
    }
    return this.apply(sessionId, {
      status: "staged",
      intentId,
      intentDigest,
      operationId,
      operationBindingDigest,
      commandLine: `/drawing-apply-intent ${intentId} ${intentDigest} ${operationId} ${operationBindingDigest}`
    });
  }
}
_intents = new WeakMap();
function publicIntent(intent) {
  const { intentId, intentDigest, operationId, operationBindingDigest, commandLine } = intent;
  return { status: "staged", intentId, intentDigest, operationId, operationBindingDigest, commandLine };
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
function registerDrawingCommands(commands, interactive, semantic) {
  const disposeApply = commands.register({
    name: "drawing-apply-intent",
    description: "Apply one Host-staged Drawing gesture using exact opaque intent and operation tokens.",
    input: { hint: "<intentId> <intentDigest> <operationId> <operationBindingDigest>" },
    recordInput: false,
    async handler(invocation) {
      try {
        const receipt = interactive.applyCommand(String(invocation.agent.id), invocation.rawInput);
        return { kind: "success", text: JSON.stringify(receipt) };
      } catch (error) {
        return { kind: "error", text: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  const disposePolicy = commands.register({
    name: "drawing-policy",
    description: "Set Drawing edit policy: review immediately downgrades the current task; auto-safe applies to future tasks.",
    input: { hint: "review | auto-safe" },
    async handler(invocation) {
      const policy = invocation.rawInput.trim();
      if (policy !== "review" && policy !== "auto-safe") {
        return { kind: "error", text: "Usage: /drawing-policy review|auto-safe" };
      }
      semantic.setSessionPolicy(String(invocation.agent.id), policy);
      return { kind: "success", text: policy === "review" ? "当前图纸任务及后续任务已切换为先预览确认。" : "后续新图纸任务将使用 auto-safe；当前 review 任务不会被反向升级。" };
    }
  });
  const disposeUndo = commands.register({
    name: "drawing-undo",
    description: "Undo an exact current Drawing commit as a new compensating revision.",
    input: { hint: "<commitId> <drawingId>@<revision> [operationId operationBindingDigest]" },
    recordInput: false,
    async handler(invocation) {
      const [targetCommitId, encodedRef, operationId, operationBindingDigest, ...extra] = invocation.rawInput.trim().split(/\s+/);
      const match = encodedRef == null ? void 0 : encodedRef.match(/^(.+)@(\d+)$/);
      if (!targetCommitId || !match || extra.length > 0 || Boolean(operationId) !== Boolean(operationBindingDigest)) {
        return { kind: "error", text: "Usage: /drawing-undo <commitId> <drawingId>@<revision> [operationId operationBindingDigest]" };
      }
      try {
        const input = {
          targetCommitId,
          expectedCurrentRef: { drawingId: match[1], revision: Number(match[2]) }
        };
        const receipt = operationId && operationBindingDigest ? semantic.undo(String(invocation.agent.id), { ...input, operationId, operationBindingDigest }) : semantic.undoAuthorized(String(invocation.agent.id), input);
        return { kind: "success", text: JSON.stringify(receipt) };
      } catch (error) {
        return { kind: "error", text: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  return () => {
    disposeUndo();
    disposePolicy();
    disposeApply();
  };
}
async function renderDrawingObservation(input) {
  const width = 960;
  const height = 720;
  const padding = 36;
  const worldWidth = Math.max(input.viewport.maxX - input.viewport.minX, 1e-6);
  const worldHeight = Math.max(input.viewport.maxY - input.viewport.minY, 1e-6);
  const scale2 = Math.min((width - padding * 2) / worldWidth, (height - padding * 2) / worldHeight);
  const offsetX = padding + (width - padding * 2 - worldWidth * scale2) / 2 - input.viewport.minX * scale2;
  const offsetY = height - padding - (height - padding * 2 - worldHeight * scale2) / 2 + input.viewport.minY * scale2;
  const transform2 = [scale2, 0, 0, -scale2, offsetX, offsetY];
  const selected = new Set(input.selectedNodeIds ?? []);
  const normal = renderDocument(input.document, /* @__PURE__ */ new Set(), "#d7e0ea");
  const highlight = selected.size === 0 ? "" : renderDocument(input.document, selected, "#ffad42", true);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#101419"/>
    <g transform="matrix(${transform2.join(" ")})">${normal}${highlight}</g>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    contentDigest: `sha256:${createHash("sha256").update(png).digest("hex")}`,
    manifest: {
      rendererVersion: "vectorai-observation-svg-v1",
      width,
      height,
      worldToImage: transform2,
      viewport: structuredClone(input.viewport),
      overlays: ["selection"]
    }
  };
}
async function renderReviewComparison(input) {
  const width = 1280;
  const height = 720;
  const panelWidth = width / 2;
  const padding = 36;
  const worldWidth = Math.max(input.viewport.maxX - input.viewport.minX, 1e-6);
  const worldHeight = Math.max(input.viewport.maxY - input.viewport.minY, 1e-6);
  const scale2 = Math.min((panelWidth - padding * 2) / worldWidth, (height - padding * 2 - 28) / worldHeight);
  const offsetX = padding + (panelWidth - padding * 2 - worldWidth * scale2) / 2 - input.viewport.minX * scale2;
  const offsetY = height - padding - (height - padding * 2 - 28 - worldHeight * scale2) / 2 + input.viewport.minY * scale2;
  const transform2 = [scale2, 0, 0, -scale2, offsetX, offsetY];
  const changed = new Set(input.changedNodeIds);
  const before = renderDocument(input.before, changed, "#f5a65b");
  const after = renderDocument(input.after, changed, "#54b9ff");
  const motion = motionVectors(input.before, input.after, changed).map(({ id, from, to }) => `<line data-node="${escapeXml(id)}" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}" stroke="#54b9ff" stroke-width="2" vector-effect="non-scaling-stroke" marker-end="url(#arrow)"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#101419"/>
    <line x1="${panelWidth}" y1="0" x2="${panelWidth}" y2="${height}" stroke="#35404b"/>
    <text x="20" y="25" fill="#9aa8b5" font-family="sans-serif" font-size="14">BEFORE</text>
    <text x="${panelWidth + 20}" y="25" fill="#9aa8b5" font-family="sans-serif" font-size="14">AFTER</text>
    <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#54b9ff"/></marker></defs>
    <g transform="matrix(${transform2.join(" ")})">${before}</g>
    <g transform="translate(${panelWidth} 0) matrix(${transform2.join(" ")})">${after}${motion}</g>
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    contentDigest: `sha256:${createHash("sha256").update(png).digest("hex")}`,
    manifest: {
      rendererVersion: "vectorai-review-svg-v1",
      width,
      height,
      comparisonLayout: "before | after",
      worldToImage: transform2,
      overlays: ["changed-nodes", "motion-vectors"]
    }
  };
}
function renderDocument(document, changed, changedColor, selectedOnly = false) {
  return [...document.geometry, ...document.annotations].filter((node) => node.visible && (!selectedOnly || changed.has(String(node.id)))).map((node) => renderNode(node, changed.has(String(node.id)) ? changedColor : "#d7e0ea")).join("");
}
function renderNode(node, color) {
  const style = `fill="none" stroke="${color}" stroke-width="1.5" vector-effect="non-scaling-stroke"`;
  switch (node.type) {
    case "point":
      return `<circle cx="${node.x}" cy="${node.y}" r="2" ${style}/>`;
    case "line":
      return `<line x1="${node.start[0]}" y1="${node.start[1]}" x2="${node.end[0]}" y2="${node.end[1]}" ${style}/>`;
    case "ray":
    case "xline":
      return `<line x1="${node.origin[0]}" y1="${node.origin[1]}" x2="${node.origin[0] + node.direction[0] * 1e3}" y2="${node.origin[1] + node.direction[1] * 1e3}" ${style}/>`;
    case "circle":
      return `<circle cx="${node.center[0]}" cy="${node.center[1]}" r="${node.radius}" ${style}/>`;
    case "arc": {
      const start = polar(node.center, node.radius, node.startAngle);
      const end = polar(node.center, node.radius, node.endAngle);
      const span = Math.abs(node.endAngle - node.startAngle) % 360;
      return `<path d="M ${start[0]} ${start[1]} A ${node.radius} ${node.radius} 0 ${span > 180 ? 1 : 0} ${node.counterClockwise ? 1 : 0} ${end[0]} ${end[1]}" ${style}/>`;
    }
    case "ellipse": {
      const rx = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]) * 180 / Math.PI;
      return `<ellipse cx="${node.center[0]}" cy="${node.center[1]}" rx="${rx}" ry="${rx * node.ratio}" transform="rotate(${rotation} ${node.center[0]} ${node.center[1]})" ${style}/>`;
    }
    case "polyline":
      return `<polyline points="${node.vertices.map(({ point }) => point.join(",")).join(" ")}" ${node.closed ? 'data-closed="true"' : ""} ${style}/>`;
    case "spline":
      return `<polyline points="${node.controlPoints.map((point) => point.join(",")).join(" ")}" ${style}/>`;
    case "text":
      return textBox(node.position, node.height, node.content, color);
    case "dimension":
      return `${node.definitionPoints.length > 1 ? `<polyline points="${node.definitionPoints.map((point) => point.join(",")).join(" ")}" ${style}/>` : ""}${textBox(node.textPosition, 4, node.displayText ?? "DIM", color)}`;
    case "leader":
      return `<polyline points="${node.points.map((point) => point.join(",")).join(" ")}" ${style}/>${textBox(node.points.at(-1) ?? [0, 0], node.textHeight, node.content, color)}`;
    case "centerline":
      return `<line x1="${node.start[0]}" y1="${node.start[1]}" x2="${node.end[0]}" y2="${node.end[1]}" stroke-dasharray="8 4" ${style}/>`;
    case "section-hatch":
      return node.segments.map(({ start, end }) => `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" ${style}/>`).join("");
  }
}
function textBox(position, height, text, color) {
  return `<g transform="translate(${position[0]} ${position[1]}) scale(1 -1)"><text fill="${color}" font-size="${height}" font-family="sans-serif">${escapeXml(text)}</text></g>`;
}
function motionVectors(before, after, changed) {
  const first = new Map([...before.geometry, ...before.annotations].map((node) => [String(node.id), node]));
  const second = new Map([...after.geometry, ...after.annotations].map((node) => [String(node.id), node]));
  return [...changed].flatMap((id) => {
    const from = center(first.get(id));
    const to = center(second.get(id));
    return from && to && Math.hypot(from[0] - to[0], from[1] - to[1]) > 1e-9 ? [{ id, from, to }] : [];
  });
}
function center(node) {
  if (!node) return null;
  switch (node.type) {
    case "point":
      return [node.x, node.y];
    case "line":
      return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case "ray":
    case "xline":
      return [...node.origin];
    case "circle":
    case "arc":
    case "ellipse":
      return [...node.center];
    case "polyline":
      return average(node.vertices.map(({ point }) => point));
    case "spline":
      return average(node.controlPoints);
    case "text":
      return [...node.position];
    case "dimension":
      return [...node.textPosition];
    case "leader":
      return [...node.points.at(-1) ?? [0, 0]];
    case "centerline":
      return [(node.start[0] + node.end[0]) / 2, (node.start[1] + node.end[1]) / 2];
    case "section-hatch":
      return average(node.segments.flatMap(({ start, end }) => [start, end]));
  }
}
function average(points) {
  if (points.length === 0) return null;
  return [points.reduce((sum, [x]) => sum + x, 0) / points.length, points.reduce((sum, [, y]) => sum + y, 0) / points.length];
}
function polar(center2, radius, degrees2) {
  const radians = degrees2 * Math.PI / 180;
  return [center2[0] + radius * Math.cos(radians), center2[1] + radius * Math.sin(radians)];
}
function escapeXml(value) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}
function createDshReviewer(ctx) {
  return async (input) => {
    const parent = ctx.agents.get(input.sessionId);
    const providerName = ctx.subagents.list()[0];
    if (!parent || !providerName) {
      reportReviewerUnavailable("provider-resolution", !parent ? "parent agent unavailable" : "no provider");
      return { outcome: "unavailable", defects: [] };
    }
    const provider = ctx.subagents.getProvider(providerName);
    if (!(provider == null ? void 0 : provider.capabilities.outputSchema) || !provider.capabilities.toolFilter || !provider.capabilities.depthLimit) {
      reportReviewerUnavailable("provider-capabilities", `provider ${providerName} lacks required isolation`);
      return { outcome: "unavailable", defects: [] };
    }
    const signal = input.signal ?? new AbortController().signal;
    const rendered = await renderReviewComparison({
      before: input.beforeDocument,
      after: input.afterDocument,
      viewport: input.viewport,
      changedNodeIds: input.changedNodeIds
    });
    const attachment = await ctx.attachments.saveImage({
      data: rendered.png,
      mediaType: "image/png",
      name: "drawing-before-after.png"
    });
    const render = {
      ...rendered.manifest,
      contentDigest: rendered.contentDigest,
      attachment
    };
    let run;
    try {
      run = await ctx.subagents.start(providerName, {
        label: "drawing-reviewer",
        parent,
        signal,
        maxDepth: 1,
        // Global restrictions do not affect the output-schema tool registered
        // inside the child scope. An empty allow-list therefore gives the
        // reviewer no ambient capabilities while preserving structured output.
        toolFilter: { allow: [] },
        persona: provider.capabilities.persona ? "You are a read-only drawing edit reviewer. Evaluate only the supplied bounded semantic diff. Never request or execute tools." : void 0,
        prompt: [{ type: "text", text: JSON.stringify({
          instruction: "Return satisfied only when the changed nodes and diagnostics support the objective without a visible semantic defect.",
          objective: input.objective,
          beforeSemanticDigest: input.beforeSemanticDigest,
          afterSemanticDigest: input.afterSemanticDigest,
          effectDigest: input.effectDigest,
          changedNodeIds: input.changedNodeIds,
          diagnostics: input.diagnostics,
          comparisonLayout: rendered.manifest.comparisonLayout,
          rendererVersion: rendered.manifest.rendererVersion,
          comparisonContentDigest: rendered.contentDigest
        }) }, { type: "image", attachment }],
        outputSchema: {
          type: "object",
          properties: {
            outcome: { type: "string", enum: ["satisfied", "needs_revision"] },
            defects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  code: { type: "string" },
                  reason: { type: "string" },
                  scopeDigest: { type: "string" }
                },
                required: ["code", "reason", "scopeDigest"],
                additionalProperties: false
              }
            }
          },
          required: ["outcome", "defects"],
          additionalProperties: false
        }
      });
    } catch (error) {
      reportReviewerUnavailable("start", error);
      return { outcome: "unavailable", defects: [], render };
    }
    try {
      let result;
      try {
        result = await run.result;
      } catch (error) {
        reportReviewerUnavailable("result", error);
        return { outcome: "unavailable", defects: [], render };
      }
      const verdict = result.stopReason === "completed" ? reviewerVerdict(result.structured, result.output) : null;
      if (!verdict) {
        reportReviewerUnavailable("verdict", `stop reason ${result.stopReason}`);
        return { outcome: "unavailable", defects: [], render };
      }
      return {
        ...structuredClone(verdict),
        render
      };
    } finally {
      await run.dispose();
    }
  };
}
function reportReviewerUnavailable(stage, reason) {
  const message = reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
  console.warn(`[VectorAI drawing reviewer unavailable:${stage}] ${message}`);
}
function reviewerVerdict(structured, output) {
  if (validReview(structured)) return structured;
  if (!Array.isArray(output)) return null;
  const text = output.filter((block) => !!block && typeof block === "object" && block.type === "text" && typeof block.text === "string").map(({ text: text2 }) => text2).join("\n");
  if (text.length === 0 || text.length > 2e4) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return validReview(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
function validReview(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return (candidate.outcome === "satisfied" || candidate.outcome === "needs_revision") && Array.isArray(candidate.defects) && candidate.defects.length <= 32 && candidate.defects.every((defect) => {
    if (!defect || typeof defect !== "object") return false;
    const item = defect;
    return typeof item.code === "string" && typeof item.reason === "string" && typeof item.scopeDigest === "string";
  });
}
class DrawingSpaceHostService extends (_a2 = TypertRemoteService, _getSnapshot_dec = [Remote], _query_dec = [Remote], _projectSelection_dec = [Remote], _stageInteractiveEdit_dec = [Remote], _stageUndo_dec = [Remote], _getOperation_dec = [Remote], _getPreview_dec = [Remote], _a2) {
  constructor(ctx) {
    super(ctx, "drawingSpace");
    __runInitializers(_init, 5, this);
    __publicField(this, "drawings");
    __publicField(this, "semantic");
    __publicField(this, "interactive");
    this.drawings = new InMemoryDrawingRepository({
      vectorizer: new LocalCleanLineVectorizer(),
      storage: new FileDrawingRepositoryStorage(resolve(homedir(), ".dsh/vectorai/drawings"))
    });
    const editPorts = {
      id: (kind) => `${kind}_${randomUUID()}`,
      now: Date.now,
      digest: (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`,
      renderObservation: async (input) => {
        const rendered = await renderDrawingObservation(input);
        const attachment = await ctx.attachments.saveImage({
          data: rendered.png,
          mediaType: "image/png",
          name: "drawing-observation.png"
        });
        return {
          contentDigest: rendered.contentDigest,
          attachment,
          width: rendered.manifest.width,
          height: rendered.manifest.height,
          worldToImage: rendered.manifest.worldToImage
        };
      },
      review: createDshReviewer(ctx)
    };
    this.semantic = new SemanticEditService(this.drawings, editPorts);
    this.interactive = new InteractiveEditService(this.drawings, editPorts);
    ctx.effect(() => registerDrawingCommands(ctx.commands, this.interactive, this.semantic));
    for (const tool of createDrawingAgentToolCatalog(
      this.drawings,
      ctx.attachments,
      this.semantic,
      ctx.userQuestions
    )) {
      ctx.tools.register(tool);
    }
    ctx.on("agent/pre-step", createPreStepIntake(this.drawings, this.semantic, {
      isRuntimeRoot: (agent) => ctx.agents.roots().includes(agent)
    }));
    ctx.on("session/disposed", (session) => {
      this.drawings.disposeSession(String(session.id));
    });
  }
  getSnapshot(agent) {
    return this.drawings.getSnapshot(String(agent.id));
  }
  query(agent, request) {
    return this.drawings.query(String(agent.id), request);
  }
  projectSelection(agent, request) {
    return this.semantic.projectSelection(String(agent.id), request);
  }
  stageInteractiveEdit(agent, request) {
    return this.interactive.stage(String(agent.id), request);
  }
  stageUndo(agent, request) {
    return this.semantic.stageUndo(String(agent.id), request);
  }
  getOperation(agent, operationId, operationBindingDigest) {
    return this.semantic.getOperation(String(agent.id), operationId, operationBindingDigest);
  }
  async runExtensionProgram(agent, request, signal) {
    return await this.semantic.runExtensionProgram(String(agent.id), request, signal);
  }
  getPreview(agent) {
    return this.drawings.getPreview(String(agent.id));
  }
}
_init = __decoratorStart(_a2);
__decorateElement(_init, 1, "getSnapshot", _getSnapshot_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "query", _query_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "projectSelection", _projectSelection_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "stageInteractiveEdit", _stageInteractiveEdit_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "stageUndo", _stageUndo_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "getOperation", _getOperation_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "getPreview", _getPreview_dec, DrawingSpaceHostService);
__decoratorMetadata(_init, DrawingSpaceHostService);
__publicField(DrawingSpaceHostService, "inject", ["tools", "attachments", "userQuestions", "commands", "agents", "subagents"]);
export {
  DrawingSpaceHostService,
  FileDrawingRepositoryStorage,
  InMemoryDrawingRepository,
  InteractiveEditService,
  LocalCleanLineVectorizer,
  SemanticEditService,
  DrawingSpaceHostService as default
};
