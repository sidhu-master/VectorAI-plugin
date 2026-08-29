var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name, symbol) => (symbol = Symbol[name]) ? symbol : Symbol.for("Symbol." + name);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value2) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value: value2 }) : obj[key] = value2;
var __name = (target, value2) => __defProp(target, "name", { value: value2, configurable: true });
var __decoratorStart = (base2) => [, , , __create((base2 == null ? void 0 : base2[__knownSymbol("metadata")]) ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array2, target) => __defNormalProp(target, __knownSymbol("metadata"), array2[3]);
var __runInitializers = (array2, flags, self, value2) => {
  for (var i = 0, fns = array2[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value2 = fns[i].call(self, value2);
  return value2;
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
var __publicField = (obj, key, value2) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value2);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value2) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value2);
var __privateSet = (obj, member, value2, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value2) : member.set(obj, value2), value2);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _ports, _episodeId, _drawingId, _revision, _events, _eventIds, _current, _GroundingLedger_instances, apply_fn, assertScope_fn, validateEvent_fn, _byNode, _segmentById, _vertexById, _pending, _drawings, _durable, _previews, _vectorizer, _drawingId2, _storage, _previewHandle, _now, _InMemoryDrawingRepository_instances, getDrawing_fn, durableState_fn, requireDurable_fn, saveDurable_fn, _directory, _FileDrawingRepositoryStorage_instances, atomicWrite_fn, path_fn, _pending2, _closed, _stderr, _LocalPythonVectorizerProcess_instances, invoke_fn, onLine_fn, reject_fn, failAll_fn, _timeoutMs, _instructions, _episodes, _epochs, _SemanticEditEpisodeStore_instances, nextEpoch_fn, _pendingInstructions, _sessionPolicies, _tasks, _observations, _contexts, _groundings, _previews2, _evaluations, _reviewInflight, _stickyReviewDefects, _selectionProjections, _groundingOverlays, _episodes2, _episodeSelections, _currentOperations, _terminalFinalizeResults, _SemanticEditService_instances, currentObservationResult_fn, initialSelectionCandidates_fn, resolvePartCandidates_fn, currentSelectionProjectionForRef_fn, appendGroundingEvidence_fn, commitPreview_fn, assess_fn, task_fn, preview_fn, storeCompilation_fn, updateGroundingOverlay_fn, snapshot_fn, snapshotAtTask_fn, _intents, _rigs, _states, _ttlMs, _ExtensionPreviewService_instances, validate_fn, ownedState_fn, currentRefResult_fn, expired_fn, expire_fn, _getPreview_dec, _discardExtensionPreview_dec, _finalizeExtensionPreview_dec, _assessExtensionPreview_dec, _replaceExtensionPreview_dec, _createExtensionPreview_dec, _getOperation_dec, _stageRedo_dec, _stageUndo_dec, _stageInteractiveEdit_dec, _discardMotionRig_dec, _rebuildMotionRig_dec, _getMotionRig_dec, _getGroundingOverlay_dec, _projectSelection_dec, _query_dec, _getSnapshot_dec, _a2, _init;
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
const NUMBER_SOURCE = String.raw`[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][-+]?\d+)?`;
const UNIT_SOURCE = [
  "millimeters?",
  "centimeters?",
  "millimetres?",
  "centimetres?",
  "毫米",
  "厘米",
  "英寸",
  "弧度",
  "degrees?",
  "radians?",
  "deg",
  "rad",
  "mm",
  "cm",
  "inch(?:es)?",
  "in",
  "°",
  "米",
  "m"
].join("|");
const DISTANCE_CONTEXT = /(?:移动|平移|抬高|降低|升高|向上|向下|向左|向右|move|translate|raise|lower|shift)\s*$/iu;
const ANGLE_CONTEXT = /(?:旋转|转动|rotate|turn)\s*$/iu;
function normalizeUnit(unit, fallback) {
  if (!unit) return null;
  const normalized = unit.trim().toLowerCase();
  if (["毫米", "mm", "millimeter", "millimeters", "millimetre", "millimetres"].includes(normalized)) {
    return { kind: "distance", unit: "mm" };
  }
  if (["厘米", "cm", "centimeter", "centimeters", "centimetre", "centimetres"].includes(normalized)) {
    return { kind: "distance", unit: "cm" };
  }
  if (["米", "m"].includes(normalized)) return { kind: "distance", unit: "m" };
  if (["英寸", "in", "inch", "inches"].includes(normalized)) return { kind: "distance", unit: "in" };
  if (["度", "°", "deg", "degree", "degrees"].includes(normalized)) return { kind: "angle", unit: "deg" };
  if (["弧度", "rad", "radian", "radians"].includes(normalized)) return { kind: "angle", unit: "rad" };
  return { kind: "distance", unit: fallback };
}
function parseFinite(value2) {
  const parsed = Number(value2);
  if (!Number.isFinite(parsed)) throw new Error("EDIT_NUMERIC_VALUE_INVALID");
  return parsed;
}
function overlaps(start, end, ranges) {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}
function extractNumericConstraints(instruction, drawingUnit) {
  const located = [];
  const coordinateRanges = [];
  const coordinatePattern = new RegExp(
    String.raw`(?:坐标|coordinate)\s*(\(\s*(${NUMBER_SOURCE})\s*[,，]\s*(${NUMBER_SOURCE})\s*\))\s*(${UNIT_SOURCE})?`,
    "giu"
  );
  for (const match of instruction.matchAll(coordinatePattern)) {
    const whole = match[0];
    const pair2 = match[1];
    const unitText = match[4];
    if (match.index === void 0 || !pair2) continue;
    const pairOffset = whole.indexOf(pair2);
    const start = match.index + pairOffset;
    const end = match.index + whole.length;
    const unit = normalizeUnit(unitText, drawingUnit);
    if ((unit == null ? void 0 : unit.kind) === "angle") continue;
    const value2 = [parseFinite(match[2] ?? ""), parseFinite(match[3] ?? "")];
    coordinateRanges.push([match.index, end]);
    located.push({
      start,
      end,
      constraint: {
        kind: "coordinate",
        value: value2,
        unit: (unit == null ? void 0 : unit.unit) ?? drawingUnit,
        userEvidenceSpan: { start, end, text: instruction.slice(start, end) }
      }
    });
  }
  const scalarPattern = new RegExp(String.raw`(${NUMBER_SOURCE})(?:\s*(${UNIT_SOURCE}))?`, "giu");
  for (const match of instruction.matchAll(scalarPattern)) {
    if (match.index === void 0) continue;
    const start = match.index;
    const end = start + match[0].length;
    if (overlaps(start, end, coordinateRanges)) continue;
    const explicitUnit = normalizeUnit(match[2], drawingUnit);
    const context = instruction.slice(Math.max(0, start - 24), start);
    const inferred = explicitUnit ?? (ANGLE_CONTEXT.test(context) ? { kind: "angle", unit: "deg" } : DISTANCE_CONTEXT.test(context) ? { kind: "distance", unit: drawingUnit } : null);
    if (!inferred) continue;
    located.push({
      start,
      end,
      constraint: {
        kind: inferred.kind,
        value: parseFinite(match[1] ?? ""),
        unit: inferred.unit,
        userEvidenceSpan: { start, end, text: instruction.slice(start, end) }
      }
    });
  }
  return located.sort((left, right) => left.start - right.start || left.end - right.end).slice(0, 16).map(({ constraint }, index) => ({ ...constraint, numericKey: `n${index + 1}` }));
}
const PLUGIN_NAME = "@vectorai/plugin-dsh-space-host";
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
    var _a3, _b, _c;
    const decision = await next();
    if (decision.kind === "reject" || payload.signal.aborted) return decision;
    if (!scope.isRuntimeRoot(payload.agent)) return decision;
    const directUser = [...decision.messages].reverse().find((message) => message.source.kind === "user");
    const sessionId = String(payload.agent.id);
    const snapshot = ((_a3 = repository.getSnapshot) == null ? void 0 : _a3.call(repository, sessionId)) ?? null;
    let numericConstraints = [];
    if (directUser && semantic) {
      const objective = directUser.content.filter((block) => block.type === "text").map(({ text }) => text).join("\n").trim();
      numericConstraints = extractNumericConstraints(
        objective,
        ((_b = snapshot == null ? void 0 : snapshot.document) == null ? void 0 : _b.unitSystem.length) ?? "mm"
      );
      if (objective) semantic.bindUserInstruction(sessionId, {
        rootUserMessageId: String(directUser.id),
        objective,
        rootUserMessageDigest: `sha256:${createHash("sha256").update(JSON.stringify({
          id: String(directUser.id),
          objective,
          images: directUser.content.filter((block) => block.type === "image").map((block) => ({
            attachmentId: String(block.attachment.attachmentId),
            mediaType: block.attachment.mediaType,
            bytes: block.attachment.bytes
          }))
        })).digest("hex")}`,
        numericConstraints
      });
    }
    const messages = [...decision.messages];
    const attachment = directUser ? findLatestImage([directUser]) : null;
    const selection = ((_c = semantic == null ? void 0 : semantic.currentSelectionProjection) == null ? void 0 : _c.call(semantic, sessionId)) ?? null;
    const drawingRef = (selection == null ? void 0 : selection.drawingRef) ?? (snapshot == null ? void 0 : snapshot.ref);
    if (directUser && drawingRef) {
      const capability = [
        `VectorAI drawing capability is available for ${drawingRef.drawingId}@${drawingRef.revision}.`,
        "To activate it, call drawing_observe only if the current user intent is to inspect or modify this drawing; otherwise ignore this capability and continue with other plugins.",
        "drawing_observe returns short selection candidates such as cN; use those keys with drawing_select_parts, and do not use drawing_query node ids or guessed coordinates for semantic selection.",
        "In drawing_select_parts, mark movable or editable geometry as role=target and fixed context as role=reference. For a motion rig, select only the movable assembly when possible; the Host infers the fixed connection locally, and fixed references are never highlighted.",
        ...selection ? [
          `A Host-verified canvas selection exists and covers ${selection.nodeIds.length} visible Drawing nodes.`,
          'When the user asks to edit that selection, drawing_select_parts can reference it with { kind: "current_selection" }; the Host keeps its exact node ids and revision private.',
          "The selection is grounding evidence only and does not grant write authority."
        ] : [],
        ...numericConstraints.length > 0 ? [
          `Verified numeric evidence: ${JSON.stringify(numericConstraints.map(({ numericKey, kind, value: value2, unit }) => ({ numericKey, kind, value: value2, unit })))}.`,
          "A Drawing spatial intent may reference these values only by numericKey."
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
    if (attachment !== null) repository.bindPending(sessionId, attachment);
    return { kind: "enter", messages };
  };
}
function canonicalString(value2) {
  return JSON.stringify(normalize(value2));
}
function canonicalSemanticString(document) {
  const semantic = Object.fromEntries(
    Object.entries(document).filter(([key]) => key !== "metadata")
  );
  return canonicalString(semantic);
}
function normalize(value2) {
  if (Array.isArray(value2)) return value2.map(normalize);
  if (value2 !== null && typeof value2 === "object") {
    return Object.fromEntries(Object.entries(value2).filter(([, item]) => item !== void 0).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, normalize(item)]));
  }
  if (typeof value2 === "number" && Object.is(value2, -0)) return 0;
  return value2;
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
  if (distance$3(carrier.center, input.targetCenter) <= Math.max(extent * 1e-9, 1e-9) && Math.abs(explicitRotation ?? 0) <= 1e-9) throw new Error("CONNECTED_TRANSFORM_NO_EFFECT");
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
    const beforeLength = distance$3(projected, endpoint.fixedAnchor);
    const afterLength = distance$3(after, endpoint.fixedAnchor);
    return {
      connectorNodeId: String(node.id),
      endpointRole: endpoint.role,
      before: structuredClone(projected),
      after,
      fixedAnchor: structuredClone(endpoint.fixedAnchor),
      originalAngle: clean$3(angleOf(carrier.center, projected) * 180 / Math.PI),
      transportedAngle: clean$3(angleOf(input.targetCenter, after) * 180 / Math.PI),
      beforeConnectorLength: clean$3(beforeLength),
      afterConnectorLength: clean$3(afterLength),
      stretchRatio: clean$3(safeRatio(afterLength, beforeLength)),
      lengthChange: clean$3(afterLength - beforeLength)
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
      rotationDegrees: clean$3(rotationDegrees),
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
      return projected && distance$3(projected, endpoint.point) <= tolerance ? [{ node, endpoint, projected }] : [];
    });
  });
}
function closestPointOnCarrier(carrier, point) {
  if (carrier.type === "circle") {
    const delta2 = [point[0] - carrier.center[0], point[1] - carrier.center[1]];
    const length = Math.hypot(...delta2);
    if (length <= 1e-12) return null;
    return cleanPoint$3([
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
    dot$2(delta, minor) / (majorLength * carrier.ratio),
    dot$2(delta, major) / majorLength
  );
  const minorAxis = [-carrier.majorAxis[1] * carrier.ratio, carrier.majorAxis[0] * carrier.ratio];
  return cleanPoint$3([
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
    dotSum += dot$2(local, target);
    crossSum += local[0] * target[1] - local[1] * target[0];
  }
  return Math.hypot(dotSum, crossSum) <= 1e-12 ? 0 : clean$3(Math.atan2(crossSum, dotSum) * 180 / Math.PI);
}
function interfaceMetrics(input) {
  const drawingDiagonal2 = drawingExtent(input.document);
  const maximumStretchRatio = Math.max(...input.ports.map(({ stretchRatio }) => stretchRatio));
  const maximumLengthIncrease = Math.max(0, ...input.ports.map(({ lengthChange }) => lengthChange));
  const selectedDeformationCost = input.ports.reduce((sum, port) => sum + port.afterConnectorLength ** 2, 0);
  const referenceRadians = input.minimumDeformationRotationDegrees * Math.PI / 180;
  const minimumDeformationCost = input.ports.reduce((sum, port) => {
    const reference = transportCarrierPoint(input.carrier, port.before, input.targetCenter, referenceRadians);
    return sum + distance$3(reference, port.fixedAnchor) ** 2;
  }, 0);
  const result = {
    drawingDiagonal: clean$3(drawingDiagonal2),
    portCount: input.ports.length,
    maximumStretchRatio: clean$3(maximumStretchRatio),
    maximumLengthIncrease: clean$3(maximumLengthIncrease),
    normalizedMaximumLengthIncrease: clean$3(maximumLengthIncrease / Math.max(drawingDiagonal2, 1e-12)),
    selectedDeformationCost: clean$3(selectedDeformationCost),
    minimumDeformationCost: clean$3(minimumDeformationCost),
    deformationCostRatio: clean$3(safeRatio(selectedDeformationCost, minimumDeformationCost)),
    selectedRotationDegrees: clean$3(input.selectedRotationDegrees),
    minimumDeformationRotationDegrees: clean$3(input.minimumDeformationRotationDegrees)
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
    if (Math.abs(before) > Math.max(drawingDiagonal2 ** 2 * 1e-8, 1e-12)) {
      result.beforeSignedArea = clean$3(before);
      result.afterSignedArea = clean$3(after);
      result.areaRetentionRatio = clean$3(Math.abs(after / before));
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
  return cleanPoint$3([center2[0] + rotated[0], center2[1] + rotated[1]]);
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
function normalizedRotationDegrees(value2) {
  if (!Number.isFinite(value2)) throw new Error("CONNECTED_TRANSFORM_ROTATION_INVALID");
  const normalized = (value2 % 360 + 540) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}
function rotateVector(vector, radians) {
  return cleanPoint$3([
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
function distance$3(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
function dot$2(left, right) {
  return left[0] * right[0] + left[1] * right[1];
}
function cleanPoint$3(point) {
  return [clean$3(point[0]), clean$3(point[1])];
}
function clean$3(value2) {
  const rounded = Number(value2.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}
function assertPoint(point, code) {
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite)) throw new Error(code);
}
const TAU = Math.PI * 2;
function flattenHatchEdge(edge, tolerance) {
  if (edge.type === "line") return [edge.start, edge.end];
  if (edge.type === "arc") {
    const orientation = edge.counterClockwise ? 1 : -1;
    return sampleAngularCurve(
      degrees$1(edge.startAngle),
      degrees$1(edge.endAngle),
      Math.abs(edge.radius),
      tolerance,
      (angle) => [
        edge.center[0] + Math.cos(angle) * edge.radius,
        edge.center[1] + Math.sin(angle) * edge.radius * orientation
      ]
    );
  }
  if (edge.type === "ellipse") {
    const majorLength = Math.hypot(...edge.majorAxis);
    const minorLength = majorLength * edge.axisRatio;
    const orientation = edge.counterClockwise ? 1 : -1;
    const ux = majorLength > 0 ? edge.majorAxis[0] / majorLength : 1;
    const uy = majorLength > 0 ? edge.majorAxis[1] / majorLength : 0;
    return sampleAngularCurve(
      edge.startParameter,
      edge.endParameter,
      Math.max(majorLength, minorLength),
      tolerance,
      (parameter) => [
        edge.center[0] + ux * majorLength * Math.cos(parameter) - uy * minorLength * Math.sin(parameter) * orientation,
        edge.center[1] + uy * majorLength * Math.cos(parameter) + ux * minorLength * Math.sin(parameter) * orientation
      ]
    );
  }
  return flattenSpline(edge, tolerance);
}
function sampleAngularCurve(start, end, radius, tolerance, pointAt2) {
  const rawSweep = end - start;
  const sweep = (rawSweep % TAU + TAU) % TAU || TAU;
  const safeRadius = Math.max(radius, tolerance);
  const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / safeRadius)));
  const count = Math.max(2, Math.ceil(Math.abs(sweep) / Math.max(maxStep, Math.PI / 90)));
  return Array.from({ length: count + 1 }, (_, index) => pointAt2(start + sweep * index / count));
}
function flattenSpline(edge, tolerance) {
  const domainStart = edge.knots[edge.degree] ?? 0;
  const domainEnd = edge.knots[edge.controlPoints.length] ?? 1;
  const first = splinePoint(edge, domainStart);
  const last = splinePoint(edge, domainEnd);
  const output = [first];
  subdivideSpline(edge, domainStart, domainEnd, first, last, tolerance, 0, output);
  return output;
}
function subdivideSpline(edge, start, end, a, b, tolerance, depth, output) {
  const middleParameter = (start + end) / 2;
  const middle = splinePoint(edge, middleParameter);
  const chordMiddle = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  if (depth >= 16 || Math.hypot(middle[0] - chordMiddle[0], middle[1] - chordMiddle[1]) <= tolerance) {
    output.push(b);
    return;
  }
  subdivideSpline(edge, start, middleParameter, a, middle, tolerance, depth + 1, output);
  subdivideSpline(edge, middleParameter, end, middle, b, tolerance, depth + 1, output);
}
function splinePoint(edge, parameter) {
  var _a3, _b, _c;
  const degree = edge.degree;
  const count = edge.controlPoints.length;
  const basis = Array.from({ length: count }, (_, index) => basisValue(index, degree, parameter, edge.knots, parameter === edge.knots[count]));
  let x = 0;
  let y = 0;
  let denominator = 0;
  for (let index = 0; index < count; index += 1) {
    const weight = ((_a3 = edge.weights) == null ? void 0 : _a3[index]) ?? 1;
    const weightedBasis = (basis[index] ?? 0) * weight;
    x += (((_b = edge.controlPoints[index]) == null ? void 0 : _b[0]) ?? 0) * weightedBasis;
    y += (((_c = edge.controlPoints[index]) == null ? void 0 : _c[1]) ?? 0) * weightedBasis;
    denominator += weightedBasis;
  }
  return denominator === 0 ? edge.controlPoints[0] ?? [0, 0] : [x / denominator, y / denominator];
}
function basisValue(index, degree, parameter, knots, atEnd) {
  if (degree === 0) {
    if (atEnd && parameter === knots[index + 1] && parameter === knots[knots.length - 1]) return 1;
    return knots[index] <= parameter && parameter < knots[index + 1] ? 1 : 0;
  }
  const leftDenominator = knots[index + degree] - knots[index];
  const rightDenominator = knots[index + degree + 1] - knots[index + 1];
  const left = leftDenominator === 0 ? 0 : (parameter - knots[index]) / leftDenominator * basisValue(index, degree - 1, parameter, knots, atEnd);
  const right = rightDenominator === 0 ? 0 : (knots[index + degree + 1] - parameter) / rightDenominator * basisValue(index + 1, degree - 1, parameter, knots, atEnd);
  return left + right;
}
function degrees$1(value2) {
  return value2 * Math.PI / 180;
}
var ClipType;
(function(ClipType2) {
  ClipType2[ClipType2["NoClip"] = 0] = "NoClip";
  ClipType2[ClipType2["Intersection"] = 1] = "Intersection";
  ClipType2[ClipType2["Union"] = 2] = "Union";
  ClipType2[ClipType2["Difference"] = 3] = "Difference";
  ClipType2[ClipType2["Xor"] = 4] = "Xor";
})(ClipType || (ClipType = {}));
var PathType;
(function(PathType2) {
  PathType2[PathType2["Subject"] = 0] = "Subject";
  PathType2[PathType2["Clip"] = 1] = "Clip";
})(PathType || (PathType = {}));
var FillRule;
(function(FillRule2) {
  FillRule2[FillRule2["EvenOdd"] = 0] = "EvenOdd";
  FillRule2[FillRule2["NonZero"] = 1] = "NonZero";
  FillRule2[FillRule2["Positive"] = 2] = "Positive";
  FillRule2[FillRule2["Negative"] = 3] = "Negative";
})(FillRule || (FillRule = {}));
var PointInPolygonResult;
(function(PointInPolygonResult2) {
  PointInPolygonResult2[PointInPolygonResult2["IsOn"] = 0] = "IsOn";
  PointInPolygonResult2[PointInPolygonResult2["IsInside"] = 1] = "IsInside";
  PointInPolygonResult2[PointInPolygonResult2["IsOutside"] = 2] = "IsOutside";
})(PointInPolygonResult || (PointInPolygonResult = {}));
const maxSafeInteger = Number.MAX_SAFE_INTEGER;
const maxDeltaForSafeProduct = Math.floor(Math.sqrt(maxSafeInteger));
function isSafeProduct(a, b) {
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b))
    return false;
  if (a === 0 || b === 0)
    return true;
  return Math.abs(a) <= maxSafeInteger / Math.abs(b);
}
function isSafeSum(a, b) {
  return Math.abs(a) + Math.abs(b) <= maxSafeInteger;
}
function safeMultiplyDifference(a, b, c, d) {
  if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    if (isSafeSum(prod1, prod2)) {
      return prod1 - prod2;
    }
  }
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
    return Number(BigInt(a) * BigInt(b) - BigInt(c) * BigInt(d));
  }
  return a * b - c * d;
}
function safeMultiplySum(a, b, c, d) {
  if (isSafeProduct(a, b) && isSafeProduct(c, d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    if (isSafeSum(prod1, prod2)) {
      return prod1 + prod2;
    }
  }
  if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
    return Number(BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d));
  }
  return a * b + c * d;
}
const B0$1 = BigInt(0);
const B2$1 = BigInt(2);
const B4$1 = BigInt(4);
const B64 = BigInt(64);
const UINT64_MASK = BigInt("0xFFFFFFFFFFFFFFFF");
const IC_MaxInt64 = BigInt("9223372036854775807");
const IC_MaxCoord = Number(IC_MaxInt64 / B4$1);
const IC_Invalid64 = Number(IC_MaxInt64);
const IC_floatingPointTolerance = 1e-12;
const IC_defaultMinimumEdgeLength = 0.1;
const IC_maxCoordForSafeAreaProduct = Math.floor(maxDeltaForSafeProduct / 2);
const IC_maxCoordForSafeCrossSq = Math.floor(Math.sqrt(Math.sqrt(maxSafeInteger / 4)));
function maxSafeCoordinateForScale(scale2) {
  if (!Number.isFinite(scale2)) {
    throw new RangeError("Scale must be a finite number");
  }
  const absScale = Math.abs(scale2);
  if (absScale === 0)
    return Number.POSITIVE_INFINITY;
  return maxSafeInteger / absScale;
}
function checkSafeScaleValue(value2, maxAbs, context) {
  if (!Number.isFinite(value2) || Math.abs(value2) > maxAbs) {
    throw new RangeError(`Scaled coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
  }
}
function ensureSafeInteger(value2, context) {
  if (!Number.isFinite(value2) || Math.abs(value2) > maxSafeInteger) {
    throw new RangeError(`Coordinate exceeds Number.MAX_SAFE_INTEGER in ${context}`);
  }
}
function crossProduct(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.y - pt2.y;
  const c = pt2.y - pt1.y;
  const d = pt3.x - pt2.x;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    return a * b - c * d;
  }
  return safeMultiplyDifference(a, b, c, d);
}
function crossProductSign(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.y - pt2.y;
  const c = pt2.y - pt1.y;
  const d = pt3.x - pt2.x;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    const prod1 = a * b;
    const prod2 = c * d;
    return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
    const prod1 = a * b;
    const prod2 = c * d;
    return prod1 > prod2 ? 1 : prod1 < prod2 ? -1 : 0;
  }
  const bigProd1 = BigInt(a) * BigInt(b);
  const bigProd2 = BigInt(c) * BigInt(d);
  if (bigProd1 === bigProd2)
    return 0;
  return bigProd1 > bigProd2 ? 1 : -1;
}
function checkPrecision(precision) {
  if (precision < -8 || precision > 8) {
    throw new Error("Error: Precision is out of range.");
  }
}
function isAlmostZero(value2) {
  return Math.abs(value2) <= IC_floatingPointTolerance;
}
function triSign(x) {
  return x < 0 ? -1 : x > 0 ? 1 : 0;
}
function multiplyUInt64(a, b) {
  const aBig = BigInt(a);
  const bBig = BigInt(b);
  const res = aBig * bBig;
  return {
    lo64: res & UINT64_MASK,
    hi64: res >> B64
  };
}
function productsAreEqual(a, b, c, d) {
  const absA = Math.abs(a);
  const absB = Math.abs(b);
  const absC = Math.abs(c);
  const absD = Math.abs(d);
  if (absA < maxDeltaForSafeProduct && absB < maxDeltaForSafeProduct && absC < maxDeltaForSafeProduct && absD < maxDeltaForSafeProduct) {
    return a * b === c * d;
  }
  const signAb = (a < 0 ? -1 : a > 0 ? 1 : 0) * (b < 0 ? -1 : b > 0 ? 1 : 0);
  const signCd = (c < 0 ? -1 : c > 0 ? 1 : 0) * (d < 0 ? -1 : d > 0 ? 1 : 0);
  if (signAb !== signCd)
    return false;
  if (signAb === 0)
    return true;
  if (!Number.isSafeInteger(absA) || !Number.isSafeInteger(absB) || !Number.isSafeInteger(absC) || !Number.isSafeInteger(absD)) {
    return a * b === c * d;
  }
  const bigA = BigInt(absA);
  const bigB = BigInt(absB);
  const bigC = BigInt(absC);
  const bigD = BigInt(absD);
  return bigA * bigB === bigC * bigD;
}
function isCollinear(pt1, sharedPt, pt2) {
  const a = sharedPt.x - pt1.x;
  const b = pt2.y - sharedPt.y;
  const c = sharedPt.y - pt1.y;
  const d = pt2.x - sharedPt.x;
  return productsAreEqual(a, b, c, d);
}
function dotProduct(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.x - pt2.x;
  const c = pt2.y - pt1.y;
  const d = pt3.y - pt2.y;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    return a * b + c * d;
  }
  return safeMultiplySum(a, b, c, d);
}
function dotProductSign(pt1, pt2, pt3) {
  const a = pt2.x - pt1.x;
  const b = pt3.x - pt2.x;
  const c = pt2.y - pt1.y;
  const d = pt3.y - pt2.y;
  if (Math.abs(a) < maxDeltaForSafeProduct && Math.abs(b) < maxDeltaForSafeProduct && Math.abs(c) < maxDeltaForSafeProduct && Math.abs(d) < maxDeltaForSafeProduct) {
    const sum = a * b + c * d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }
  if (!Number.isSafeInteger(a) || !Number.isSafeInteger(b) || !Number.isSafeInteger(c) || !Number.isSafeInteger(d)) {
    const sum = a * b + c * d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }
  const bigSum = BigInt(a) * BigInt(b) + BigInt(c) * BigInt(d);
  if (bigSum === B0$1)
    return 0;
  return bigSum > B0$1 ? 1 : -1;
}
function icArea(path) {
  const cnt = path.length;
  if (cnt < 3)
    return 0;
  let allSmall = true;
  for (let i = 0; i < cnt && allSmall; i++) {
    const pt = path[i];
    if (Math.abs(pt.x) >= IC_maxCoordForSafeAreaProduct || Math.abs(pt.y) >= IC_maxCoordForSafeAreaProduct) {
      allSmall = false;
    }
  }
  let prevPt = path[cnt - 1];
  if (allSmall) {
    let total = 0;
    for (const pt of path) {
      total += (prevPt.y + pt.y) * (prevPt.x - pt.x);
      prevPt = pt;
    }
    return total * 0.5;
  }
  let totalBig = B0$1;
  for (const pt of path) {
    const sum = prevPt.y + pt.y;
    const diff = prevPt.x - pt.x;
    if (Number.isSafeInteger(sum) && Number.isSafeInteger(diff)) {
      totalBig += BigInt(sum) * BigInt(diff);
    } else if (Number.isSafeInteger(prevPt.y) && Number.isSafeInteger(pt.y) && Number.isSafeInteger(prevPt.x) && Number.isSafeInteger(pt.x)) {
      const sumBig = BigInt(prevPt.y) + BigInt(pt.y);
      const diffBig = BigInt(prevPt.x) - BigInt(pt.x);
      totalBig += sumBig * diffBig;
    } else {
      totalBig += BigInt(Math.round(sum * diff));
    }
    prevPt = pt;
  }
  return Number(totalBig) * 0.5;
}
function crossProductD(vec1, vec2) {
  return vec1.y * vec2.x - vec2.y * vec1.x;
}
function dotProductD(vec1, vec2) {
  return vec1.x * vec2.x + vec1.y * vec2.y;
}
function roundToEven(value2) {
  const r = Math.round(value2);
  if (value2 === r - 0.5 && (r & 1) !== 0)
    return r - 1;
  return r;
}
function checkCastInt64(val) {
  if (val >= IC_MaxCoord || val <= -IC_MaxCoord)
    return IC_Invalid64;
  return Math.round(val);
}
function getLineIntersectPt(ln1a, ln1b, ln2a, ln2b) {
  const dy1 = ln1b.y - ln1a.y;
  const dx1 = ln1b.x - ln1a.x;
  const dy2 = ln2b.y - ln2a.y;
  const dx2 = ln2b.x - ln2a.x;
  const det = safeMultiplyDifference(dy1, dx2, dy2, dx1);
  if (det === 0) {
    return null;
  }
  const t = safeMultiplyDifference(ln1a.x - ln2a.x, dy2, ln1a.y - ln2a.y, dx2) / det;
  if (t <= 0) {
    return { x: ln1a.x, y: ln1a.y, z: ln1a.z || 0 };
  } else if (t >= 1) {
    return { x: ln1b.x, y: ln1b.y, z: ln1b.z || 0 };
  } else {
    return {
      x: Math.trunc(ln1a.x + t * dx1),
      y: Math.trunc(ln1a.y + t * dy1),
      z: 0
    };
  }
}
function getLineIntersectPtD(ln1a, ln1b, ln2a, ln2b) {
  const dy1 = ln1b.y - ln1a.y;
  const dx1 = ln1b.x - ln1a.x;
  const dy2 = ln2b.y - ln2a.y;
  const dx2 = ln2b.x - ln2a.x;
  const det = dy1 * dx2 - dy2 * dx1;
  if (det === 0) {
    return { success: false, ip: { x: 0, y: 0, z: 0 } };
  }
  const t = ((ln1a.x - ln2a.x) * dy2 - (ln1a.y - ln2a.y) * dx2) / det;
  let ip;
  if (t <= 0) {
    ip = { ...ln1a, z: 0 };
  } else if (t >= 1) {
    ip = { ...ln1b, z: 0 };
  } else {
    ip = {
      x: ln1a.x + t * dx1,
      y: ln1a.y + t * dy1,
      z: 0
    };
  }
  return { success: true, ip };
}
function segsIntersect(seg1a, seg1b, seg2a, seg2b, inclusive = false) {
  if (!inclusive) {
    const s1 = crossProductSign(seg1a, seg2a, seg2b);
    const s2 = crossProductSign(seg1b, seg2a, seg2b);
    const s3 = crossProductSign(seg2a, seg1a, seg1b);
    const s4 = crossProductSign(seg2b, seg1a, seg1b);
    return s1 !== 0 && s2 !== 0 && s1 !== s2 && (s3 !== 0 && s4 !== 0 && s3 !== s4);
  }
  const res1 = crossProductSign(seg1a, seg2a, seg2b);
  const res2 = crossProductSign(seg1b, seg2a, seg2b);
  if (res1 !== 0 && res1 === res2)
    return false;
  const res3 = crossProductSign(seg2a, seg1a, seg1b);
  const res4 = crossProductSign(seg2b, seg1a, seg1b);
  if (res3 !== 0 && res3 === res4)
    return false;
  return res1 !== 0 || res2 !== 0 || res3 !== 0 || res4 !== 0;
}
function icGetBounds(path) {
  if (path.length === 0)
    return { left: 0, top: 0, right: 0, bottom: 0 };
  const result = {
    left: Number.MAX_SAFE_INTEGER,
    top: Number.MAX_SAFE_INTEGER,
    right: Number.MIN_SAFE_INTEGER,
    bottom: Number.MIN_SAFE_INTEGER
  };
  for (const pt of path) {
    if (pt.x < result.left)
      result.left = pt.x;
    if (pt.x > result.right)
      result.right = pt.x;
    if (pt.y < result.top)
      result.top = pt.y;
    if (pt.y > result.bottom)
      result.bottom = pt.y;
  }
  return result.left === Number.MAX_SAFE_INTEGER ? { left: 0, top: 0, right: 0, bottom: 0 } : result;
}
function getClosestPtOnSegment(offPt, seg1, seg2) {
  if (seg1.x === seg2.x && seg1.y === seg2.y)
    return { x: seg1.x, y: seg1.y, z: 0 };
  const dx = seg2.x - seg1.x;
  const dy = seg2.y - seg1.y;
  const q = safeMultiplySum(offPt.x - seg1.x, dx, offPt.y - seg1.y, dy) / safeMultiplySum(dx, dx, dy, dy);
  const qClamped = q < 0 ? 0 : q > 1 ? 1 : q;
  return {
    // use Math.round to match the C# MidpointRounding.ToEven behavior
    x: Math.round(seg1.x + qClamped * dx),
    y: Math.round(seg1.y + qClamped * dy),
    z: 0
  };
}
function icPointInPolygon(pt, polygon) {
  const len = polygon.length;
  let start = 0;
  if (len < 3)
    return PointInPolygonResult.IsOutside;
  while (start < len && polygon[start].y === pt.y)
    start++;
  if (start === len)
    return PointInPolygonResult.IsOutside;
  let isAbove = polygon[start].y < pt.y;
  const startingAbove = isAbove;
  let val = 0;
  let i = start + 1;
  let end = len;
  while (true) {
    if (i === end) {
      if (end === 0 || start === 0)
        break;
      end = start;
      i = 0;
    }
    if (isAbove) {
      while (i < end && polygon[i].y < pt.y)
        i++;
    } else {
      while (i < end && polygon[i].y > pt.y)
        i++;
    }
    if (i === end)
      continue;
    const curr = polygon[i];
    const prev = i > 0 ? polygon[i - 1] : polygon[len - 1];
    if (curr.y === pt.y) {
      if (curr.x === pt.x || curr.y === prev.y && pt.x < prev.x !== pt.x < curr.x) {
        return PointInPolygonResult.IsOn;
      }
      i++;
      if (i === start)
        break;
      continue;
    }
    if (pt.x < curr.x && pt.x < prev.x) ;
    else if (pt.x > prev.x && pt.x > curr.x) {
      val = 1 - val;
    } else {
      const cps2 = crossProductSign(prev, curr, pt);
      if (cps2 === 0)
        return PointInPolygonResult.IsOn;
      if (cps2 < 0 === isAbove)
        val = 1 - val;
    }
    isAbove = !isAbove;
    i++;
  }
  if (isAbove === startingAbove) {
    return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
  }
  if (i === len)
    i = 0;
  const cps = i === 0 ? crossProductSign(polygon[len - 1], polygon[0], pt) : crossProductSign(polygon[i - 1], polygon[i], pt);
  if (cps === 0)
    return PointInPolygonResult.IsOn;
  if (cps < 0 === isAbove)
    val = 1 - val;
  return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
}
function path2ContainsPath1(path1, path2) {
  let pip = PointInPolygonResult.IsOn;
  for (const pt of path1) {
    switch (icPointInPolygon(pt, path2)) {
      case PointInPolygonResult.IsOutside:
        if (pip === PointInPolygonResult.IsOutside)
          return false;
        pip = PointInPolygonResult.IsOutside;
        break;
      case PointInPolygonResult.IsInside:
        if (pip === PointInPolygonResult.IsInside)
          return true;
        pip = PointInPolygonResult.IsInside;
        break;
    }
  }
  const mp = icGetBounds(path1);
  let midX, midY;
  if (Number.isSafeInteger(mp.left) && Number.isSafeInteger(mp.right) && Math.abs(mp.left) + Math.abs(mp.right) > Number.MAX_SAFE_INTEGER) {
    midX = Number((BigInt(mp.left) + BigInt(mp.right)) / B2$1);
    midY = Number((BigInt(mp.top) + BigInt(mp.bottom)) / B2$1);
  } else {
    midX = Math.round((mp.left + mp.right) / 2);
    midY = Math.round((mp.top + mp.bottom) / 2);
  }
  const midPt = { x: midX, y: midY };
  return icPointInPolygon(midPt, path2) !== PointInPolygonResult.IsOutside;
}
const InternalClipper = {
  MaxInt64: IC_MaxInt64,
  MaxCoord: IC_MaxCoord,
  max_coord: IC_MaxCoord,
  min_coord: -IC_MaxCoord,
  Invalid64: IC_Invalid64,
  floatingPointTolerance: IC_floatingPointTolerance,
  defaultMinimumEdgeLength: IC_defaultMinimumEdgeLength,
  maxCoordForSafeAreaProduct: IC_maxCoordForSafeAreaProduct,
  maxCoordForSafeCrossSq: IC_maxCoordForSafeCrossSq,
  maxSafeCoordinateForScale,
  checkSafeScaleValue,
  ensureSafeInteger,
  crossProduct,
  crossProductSign,
  checkPrecision,
  isAlmostZero,
  triSign,
  multiplyUInt64,
  productsAreEqual,
  isCollinear,
  dotProduct,
  dotProductSign,
  area: icArea,
  crossProductD,
  dotProductD,
  roundToEven,
  checkCastInt64,
  getLineIntersectPt,
  getLineIntersectPtD,
  segsIntersect,
  getBounds: icGetBounds,
  getClosestPtOnSegment,
  pointInPolygon: icPointInPolygon,
  path2ContainsPath1
};
const Rect64Utils = {
  create(l = 0, t = 0, r = 0, b = 0) {
    return { left: l, top: t, right: r, bottom: b };
  },
  createInvalid() {
    return {
      left: Number.MAX_SAFE_INTEGER,
      top: Number.MAX_SAFE_INTEGER,
      right: Number.MIN_SAFE_INTEGER,
      bottom: Number.MIN_SAFE_INTEGER
    };
  },
  width(rect) {
    return rect.right - rect.left;
  },
  height(rect) {
    return rect.bottom - rect.top;
  },
  isEmpty(rect) {
    return rect.bottom <= rect.top || rect.right <= rect.left;
  },
  isValid(rect) {
    return rect.left < Number.MAX_SAFE_INTEGER;
  },
  midPoint(rect) {
    if (Number.isSafeInteger(rect.left) && Number.isSafeInteger(rect.right) && Math.abs(rect.left) + Math.abs(rect.right) > Number.MAX_SAFE_INTEGER) {
      const midX = Number((BigInt(rect.left) + BigInt(rect.right)) / B2$1);
      const midY = Number((BigInt(rect.top) + BigInt(rect.bottom)) / B2$1);
      return { x: midX, y: midY };
    }
    return {
      x: Math.round((rect.left + rect.right) / 2),
      y: Math.round((rect.top + rect.bottom) / 2)
    };
  },
  contains(rect, pt) {
    return pt.x > rect.left && pt.x < rect.right && pt.y > rect.top && pt.y < rect.bottom;
  },
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  },
  intersects(rect, rec) {
    return Math.max(rect.left, rec.left) <= Math.min(rect.right, rec.right) && Math.max(rect.top, rec.top) <= Math.min(rect.bottom, rec.bottom);
  },
  asPath(rect) {
    return [
      { x: rect.left, y: rect.top, z: 0 },
      { x: rect.right, y: rect.top, z: 0 },
      { x: rect.right, y: rect.bottom, z: 0 },
      { x: rect.left, y: rect.bottom, z: 0 }
    ];
  }
};
const B0 = BigInt(0);
const B2 = BigInt(2);
const B4 = BigInt(4);
var VertexFlags;
(function(VertexFlags2) {
  VertexFlags2[VertexFlags2["None"] = 0] = "None";
  VertexFlags2[VertexFlags2["OpenStart"] = 1] = "OpenStart";
  VertexFlags2[VertexFlags2["OpenEnd"] = 2] = "OpenEnd";
  VertexFlags2[VertexFlags2["LocalMax"] = 4] = "LocalMax";
  VertexFlags2[VertexFlags2["LocalMin"] = 8] = "LocalMin";
})(VertexFlags || (VertexFlags = {}));
class ScanlineHeap {
  constructor() {
    __publicField(this, "data", []);
  }
  push(value2) {
    this.data.push(value2);
    this.siftUp(this.data.length - 1);
  }
  pop() {
    if (this.data.length === 0)
      return null;
    const max = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this.siftDown(0);
    }
    return max;
  }
  clear() {
    this.data.length = 0;
  }
  // Hole-sift: lift the value once, shift parents/children, then place.
  // Avoids temporary array allocation from destructuring swap on every step.
  siftUp(index) {
    const val = this.data[index];
    while (index > 0) {
      const parent = index - 1 >> 1;
      if (this.data[parent] >= val)
        break;
      this.data[index] = this.data[parent];
      index = parent;
    }
    this.data[index] = val;
  }
  siftDown(index) {
    const length = this.data.length;
    const val = this.data[index];
    while (true) {
      const left = (index << 1) + 1;
      if (left >= length)
        break;
      const right = left + 1;
      let child = left;
      if (right < length && this.data[right] > this.data[left])
        child = right;
      if (this.data[child] <= val)
        break;
      this.data[index] = this.data[child];
      index = child;
    }
    this.data[index] = val;
  }
}
class Vertex {
  constructor(pt, flags, prev) {
    __publicField(this, "pt");
    __publicField(this, "next", null);
    __publicField(this, "prev", null);
    __publicField(this, "flags");
    this.pt = pt;
    this.flags = flags;
    this.prev = prev;
  }
}
class LocalMinima {
  constructor(vertex, polytype, isOpen = false) {
    __publicField(this, "vertex");
    __publicField(this, "polytype");
    __publicField(this, "isOpen");
    this.vertex = vertex;
    this.polytype = polytype;
    this.isOpen = isOpen;
  }
  equals(other) {
    return other !== null && this.vertex === other.vertex;
  }
}
function createIntersectNode(pt, edge1, edge2) {
  return { pt, edge1, edge2 };
}
class OutPt {
  constructor(pt, outrec) {
    __publicField(this, "pt");
    __publicField(this, "next");
    __publicField(this, "prev");
    __publicField(this, "outrec");
    __publicField(this, "horz");
    this.pt = pt;
    this.outrec = outrec;
    this.next = this;
    this.prev = this;
    this.horz = null;
  }
}
var JoinWith;
(function(JoinWith2) {
  JoinWith2[JoinWith2["None"] = 0] = "None";
  JoinWith2[JoinWith2["Left"] = 1] = "Left";
  JoinWith2[JoinWith2["Right"] = 2] = "Right";
})(JoinWith || (JoinWith = {}));
var HorzPosition;
(function(HorzPosition2) {
  HorzPosition2[HorzPosition2["Bottom"] = 0] = "Bottom";
  HorzPosition2[HorzPosition2["Middle"] = 1] = "Middle";
  HorzPosition2[HorzPosition2["Top"] = 2] = "Top";
})(HorzPosition || (HorzPosition = {}));
class OutRec {
  constructor() {
    __publicField(this, "idx", 0);
    __publicField(this, "owner", null);
    __publicField(this, "frontEdge", null);
    __publicField(this, "backEdge", null);
    __publicField(this, "pts", null);
    __publicField(this, "polypath", null);
    __publicField(this, "bounds", { left: 0, top: 0, right: 0, bottom: 0 });
    __publicField(this, "path", []);
    __publicField(this, "isOpen", false);
    __publicField(this, "splits", null);
    __publicField(this, "recursiveSplit", null);
  }
}
class HorzSegment {
  constructor(op) {
    __publicField(this, "leftOp");
    __publicField(this, "rightOp");
    __publicField(this, "leftToRight");
    this.leftOp = op;
    this.rightOp = null;
    this.leftToRight = true;
  }
}
class HorzJoin {
  constructor(ltor, rtol) {
    __publicField(this, "op1");
    __publicField(this, "op2");
    this.op1 = ltor;
    this.op2 = rtol;
  }
}
function compareHorzSegments(hs1, hs2) {
  if (hs1.rightOp === null) {
    return hs2.rightOp === null ? 0 : 1;
  }
  if (hs2.rightOp === null)
    return -1;
  return hs1.leftOp.pt.x - hs2.leftOp.pt.x;
}
function compareIntersectNodes(a, b) {
  if (a.pt.y !== b.pt.y)
    return a.pt.y > b.pt.y ? -1 : 1;
  if (a.pt.x !== b.pt.x)
    return a.pt.x < b.pt.x ? -1 : 1;
  if (a.edge1.curX !== b.edge1.curX)
    return a.edge1.curX < b.edge1.curX ? -1 : 1;
  return a.edge2.curX < b.edge2.curX ? -1 : a.edge2.curX > b.edge2.curX ? 1 : 0;
}
class Active {
  constructor() {
    __publicField(this, "bot", { x: 0, y: 0 });
    __publicField(this, "top", { x: 0, y: 0 });
    __publicField(this, "curX", 0);
    // current (updated at every new scanline) - keep as number but ensure integer precision
    __publicField(this, "dx", 0);
    __publicField(this, "windDx", 0);
    // 1 or -1 depending on winding direction
    __publicField(this, "windCount", 0);
    __publicField(this, "windCount2", 0);
    // winding count of the opposite polytype
    __publicField(this, "outrec", null);
    // AEL: 'active edge list' (Vatti's AET - active edge table)
    //     a linked list of all edges (from left to right) that are present
    //     (or 'active') within the current scanbeam (a horizontal 'beam' that
    //     sweeps from bottom to top over the paths in the clipping operation).
    __publicField(this, "prevInAEL", null);
    __publicField(this, "nextInAEL", null);
    // SEL: 'sorted edge list' (Vatti's ST - sorted table)
    //     linked list used when sorting edges into their new positions at the
    //     top of scanbeams, but also (re)used to process horizontals.
    __publicField(this, "prevInSEL", null);
    __publicField(this, "nextInSEL", null);
    __publicField(this, "jump", null);
    __publicField(this, "vertexTop", null);
    __publicField(this, "localMin", null);
    // the bottom of an edge 'bound' (also Vatti)
    __publicField(this, "isLeftBound", false);
    __publicField(this, "joinWith", JoinWith.None);
  }
}
const ClipperEngine = {
  addLocMin(vert, polytype, isOpen, minimaList) {
    if ((vert.flags & VertexFlags.LocalMin) !== VertexFlags.None)
      return;
    vert.flags |= VertexFlags.LocalMin;
    const lm = new LocalMinima(vert, polytype, isOpen);
    minimaList.push(lm);
  },
  addPathsToVertexList(paths, polytype, isOpen, minimaList, vertexList) {
    for (let i = 0, len = paths.length; i < len; i++) {
      const path = paths[i];
      let v0 = null;
      let prevV = null;
      let prevPt = null;
      for (let j = 0, len2 = path.length; j < len2; j++) {
        const pt = path[j];
        if (v0 === null) {
          v0 = new Vertex(pt, VertexFlags.None, null);
          vertexList.push(v0);
          prevV = v0;
          prevPt = pt;
        } else if (!(prevPt.x === pt.x && prevPt.y === pt.y)) {
          const currV2 = new Vertex(pt, VertexFlags.None, prevV);
          prevV.next = currV2;
          prevV = currV2;
          prevPt = pt;
        }
      }
      if ((prevV == null ? void 0 : prevV.prev) == null)
        continue;
      if (!isOpen && prevV.pt.x === v0.pt.x && prevV.pt.y === v0.pt.y)
        prevV = prevV.prev;
      prevV.next = v0;
      v0.prev = prevV;
      if (!isOpen && prevV.next === prevV)
        continue;
      let goingUp;
      if (isOpen) {
        let currV2 = v0.next;
        while (currV2 !== v0 && currV2.pt.y === v0.pt.y)
          currV2 = currV2.next;
        goingUp = currV2.pt.y <= v0.pt.y;
        if (goingUp) {
          v0.flags = VertexFlags.OpenStart;
          ClipperEngine.addLocMin(v0, polytype, true, minimaList);
        } else {
          v0.flags = VertexFlags.OpenStart | VertexFlags.LocalMax;
        }
      } else {
        prevV = v0.prev;
        while (prevV !== v0 && prevV.pt.y === v0.pt.y)
          prevV = prevV.prev;
        if (prevV === v0)
          continue;
        goingUp = prevV.pt.y > v0.pt.y;
      }
      const goingUp0 = goingUp;
      prevV = v0;
      let currV = v0.next;
      while (currV !== v0) {
        if (currV.pt.y > prevV.pt.y && goingUp) {
          prevV.flags |= VertexFlags.LocalMax;
          goingUp = false;
        } else if (currV.pt.y < prevV.pt.y && !goingUp) {
          goingUp = true;
          ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
        }
        prevV = currV;
        currV = currV.next;
      }
      if (isOpen) {
        prevV.flags |= VertexFlags.OpenEnd;
        if (goingUp)
          prevV.flags |= VertexFlags.LocalMax;
        else
          ClipperEngine.addLocMin(prevV, polytype, isOpen, minimaList);
      } else if (goingUp !== goingUp0) {
        if (goingUp0)
          ClipperEngine.addLocMin(prevV, polytype, false, minimaList);
        else
          prevV.flags |= VertexFlags.LocalMax;
      }
    }
  }
};
const _ClipperBase = class _ClipperBase {
  constructor() {
    __publicField(this, "cliptype", ClipType.NoClip);
    __publicField(this, "fillrule", FillRule.EvenOdd);
    __publicField(this, "actives", null);
    __publicField(this, "sel", null);
    __publicField(this, "minimaList", []);
    __publicField(this, "intersectList", []);
    __publicField(this, "vertexList", []);
    __publicField(this, "outrecList", []);
    __publicField(this, "scanlineHeap", new ScanlineHeap());
    __publicField(this, "scanlineSet", /* @__PURE__ */ new Set());
    // For very small inputs, a heap + set can cost more than it saves.
    // Use an array-based scanline mode initially, and upgrade to heap+set
    // automatically if the scanline list grows beyond a threshold.
    __publicField(this, "scanlineArr", []);
    __publicField(this, "useScanlineArray", false);
    __publicField(this, "horzSegList", []);
    __publicField(this, "horzJoinList", []);
    __publicField(this, "currentLocMin", 0);
    __publicField(this, "currentBotY", 0);
    // True when every active edge's curX already equals topX(edge, topY) for the
    // scanbeam top being processed (set by buildIntersectList when the SEL scan
    // finds no inversions, i.e. no intersections; consumed by doTopOfScanbeam).
    __publicField(this, "curXValidAtTop", false);
    __publicField(this, "isSortedMinimaList", false);
    __publicField(this, "hasOpenPaths", false);
    __publicField(this, "usingPolytree", false);
    __publicField(this, "succeeded", false);
    // Cache Z callback for the duration of an execute to avoid repeated virtual calls
    // to getZCallback() in hot paths.
    __publicField(this, "zCallbackInternal");
    __publicField(this, "preserveCollinear", true);
    __publicField(this, "reverseSolution", false);
  }
  // Z-coordinate callback support
  // Override in subclasses (Clipper64/ClipperD) to provide callback
  getZCallback() {
    return void 0;
  }
  xyEqual(pt1, pt2) {
    return pt1.x === pt2.x && pt1.y === pt2.y;
  }
  setZ(ae1, ae2, intersectPt) {
    const zCallback = this.zCallbackInternal;
    if (!zCallback)
      return;
    if (_ClipperBase.getPolyType(ae1) === PathType.Subject) {
      if (this.xyEqual(intersectPt, ae1.bot)) {
        intersectPt.z = ae1.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.top)) {
        intersectPt.z = ae1.top.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.bot)) {
        intersectPt.z = ae2.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.top)) {
        intersectPt.z = ae2.top.z ?? 0;
      } else {
        intersectPt.z = 0;
      }
      zCallback(ae1.bot, ae1.top, ae2.bot, ae2.top, intersectPt);
    } else {
      if (this.xyEqual(intersectPt, ae2.bot)) {
        intersectPt.z = ae2.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae2.top)) {
        intersectPt.z = ae2.top.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.bot)) {
        intersectPt.z = ae1.bot.z ?? 0;
      } else if (this.xyEqual(intersectPt, ae1.top)) {
        intersectPt.z = ae1.top.z ?? 0;
      } else {
        intersectPt.z = 0;
      }
      zCallback(ae2.bot, ae2.top, ae1.bot, ae1.top, intersectPt);
    }
  }
  // Helper functions
  static isOdd(val) {
    return (val & 1) !== 0;
  }
  static isHotEdge(ae) {
    return ae.outrec != null;
  }
  static isOpen(ae) {
    return _ClipperBase.openPathsEnabled && ae.localMin.isOpen;
  }
  static isOpenEnd(ae) {
    return _ClipperBase.openPathsEnabled && ae.localMin.isOpen && _ClipperBase.isOpenEndVertex(ae.vertexTop);
  }
  static isOpenEndVertex(v) {
    return (v.flags & (VertexFlags.OpenStart | VertexFlags.OpenEnd)) !== VertexFlags.None;
  }
  static getPrevHotEdge(ae) {
    let prev = ae.prevInAEL;
    if (!_ClipperBase.openPathsEnabled) {
      while (prev !== null && !_ClipperBase.isHotEdge(prev)) {
        prev = prev.prevInAEL;
      }
      return prev;
    }
    while (prev !== null && (prev.localMin.isOpen || !_ClipperBase.isHotEdge(prev))) {
      prev = prev.prevInAEL;
    }
    return prev;
  }
  static isFront(ae) {
    return ae === ae.outrec.frontEdge;
  }
  /*******************************************************************************
  *  Dx:                             0(90deg)                                    *
  *                                  |                                           *
  *               +inf (180deg) <--- o ---> -inf (0deg)                          *
  *******************************************************************************/
  static getDx(pt1, pt2) {
    const dy = pt2.y - pt1.y;
    if (dy !== 0) {
      return (pt2.x - pt1.x) / dy;
    }
    return pt2.x > pt1.x ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }
  static topX(ae, currentY) {
    if (currentY === ae.top.y || ae.top.x === ae.bot.x)
      return ae.top.x;
    if (currentY === ae.bot.y)
      return ae.bot.x;
    return InternalClipper.roundToEven(ae.bot.x + ae.dx * (currentY - ae.bot.y));
  }
  static isHorizontal(ae) {
    return ae.dx === Number.NEGATIVE_INFINITY || ae.dx === Number.POSITIVE_INFINITY;
  }
  static isHeadingRightHorz(ae) {
    return ae.dx === Number.NEGATIVE_INFINITY;
  }
  static isHeadingLeftHorz(ae) {
    return ae.dx === Number.POSITIVE_INFINITY;
  }
  static getPolyType(ae) {
    return ae.localMin.polytype;
  }
  static isSamePolyType(ae1, ae2) {
    return ae1.localMin.polytype === ae2.localMin.polytype;
  }
  static setDx(ae) {
    ae.dx = _ClipperBase.getDx(ae.bot, ae.top);
  }
  static nextVertex(ae) {
    return ae.windDx > 0 ? ae.vertexTop.next : ae.vertexTop.prev;
  }
  static prevPrevVertex(ae) {
    return ae.windDx > 0 ? ae.vertexTop.prev.prev : ae.vertexTop.next.next;
  }
  static isMaximaVertex(v) {
    return (v.flags & VertexFlags.LocalMax) !== VertexFlags.None;
  }
  static isMaximaEdge(ae) {
    return (ae.vertexTop.flags & VertexFlags.LocalMax) !== VertexFlags.None;
  }
  static getMaximaPair(ae) {
    let ae2 = ae.nextInAEL;
    while (ae2 !== null) {
      if (ae2.vertexTop === ae.vertexTop)
        return ae2;
      ae2 = ae2.nextInAEL;
    }
    return null;
  }
  // optimization (not in C# reference): fast bounding box overlap check for segment intersection
  boundingBoxesOverlap(p1, p2, p3, p4) {
    const min1x = p1.x < p2.x ? p1.x : p2.x;
    const max2x = p3.x > p4.x ? p3.x : p4.x;
    if (max2x < min1x)
      return false;
    const max1x = p1.x > p2.x ? p1.x : p2.x;
    const min2x = p3.x < p4.x ? p3.x : p4.x;
    if (max1x < min2x)
      return false;
    const min1y = p1.y < p2.y ? p1.y : p2.y;
    const max2y = p3.y > p4.y ? p3.y : p4.y;
    if (max2y < min1y)
      return false;
    const max1y = p1.y > p2.y ? p1.y : p2.y;
    const min2y = p3.y < p4.y ? p3.y : p4.y;
    return max1y >= min2y;
  }
  clearSolutionOnly() {
    while (this.actives !== null)
      this.deleteFromAEL(this.actives);
    this.scanlineHeap.clear();
    this.scanlineSet.clear();
    this.scanlineArr.length = 0;
    this.disposeIntersectNodes();
    this.outrecList.length = 0;
    this.horzSegList.length = 0;
    this.horzJoinList.length = 0;
  }
  clear() {
    this.clearSolutionOnly();
    this.minimaList.length = 0;
    this.vertexList.length = 0;
    this.currentLocMin = 0;
    this.isSortedMinimaList = false;
    this.hasOpenPaths = false;
  }
  reset() {
    if (!this.isSortedMinimaList) {
      this.minimaList.sort((a, b) => b.vertex.pt.y - a.vertex.pt.y);
      this.isSortedMinimaList = true;
    }
    this.scanlineHeap.clear();
    this.scanlineSet.clear();
    this.scanlineArr.length = 0;
    this.useScanlineArray = this.minimaList.length <= 16;
    for (let i = this.minimaList.length - 1; i >= 0; i--) {
      this.insertScanline(this.minimaList[i].vertex.pt.y);
    }
    this.currentBotY = 0;
    this.currentLocMin = 0;
    this.actives = null;
    this.sel = null;
    this.curXValidAtTop = false;
    this.succeeded = true;
  }
  upgradeScanlineStructureFromArray() {
    const arr = this.scanlineArr;
    for (let i = 0, len = arr.length; i < len; i++) {
      const y = arr[i];
      this.scanlineSet.add(y);
      this.scanlineHeap.push(y);
    }
    arr.length = 0;
    this.useScanlineArray = false;
  }
  insertScanline(y) {
    if (this.useScanlineArray) {
      const arr = this.scanlineArr;
      for (let i = 0, len = arr.length; i < len; i++) {
        if (arr[i] === y)
          return;
      }
      arr.push(y);
      if (arr.length > 64)
        this.upgradeScanlineStructureFromArray();
      return;
    }
    if (this.scanlineSet.has(y))
      return;
    this.scanlineSet.add(y);
    this.scanlineHeap.push(y);
  }
  // Returns the next scanline Y value, or null if empty.
  // Avoids allocating a wrapper object on every call in the main sweep loop.
  popScanline() {
    if (this.useScanlineArray) {
      const arr = this.scanlineArr;
      const len = arr.length;
      if (len === 0)
        return null;
      let bestIdx = 0;
      let bestY = arr[0];
      for (let i = 1; i < len; i++) {
        const v = arr[i];
        if (v > bestY) {
          bestY = v;
          bestIdx = i;
        }
      }
      arr[bestIdx] = arr[len - 1];
      arr.pop();
      return bestY;
    }
    const y = this.scanlineHeap.pop();
    if (y === null)
      return null;
    this.scanlineSet.delete(y);
    return y;
  }
  hasLocMinAtY(y) {
    return this.currentLocMin < this.minimaList.length && this.minimaList[this.currentLocMin].vertex.pt.y === y;
  }
  popLocalMinima() {
    return this.minimaList[this.currentLocMin++];
  }
  addPath(path, polytype, isOpen = false) {
    const tmp = [path];
    this.addPaths(tmp, polytype, isOpen);
  }
  addPaths(paths, polytype, isOpen = false) {
    if (isOpen)
      this.hasOpenPaths = true;
    this.isSortedMinimaList = false;
    ClipperEngine.addPathsToVertexList(paths, polytype, isOpen, this.minimaList, this.vertexList);
  }
  addReuseableData(reuseableData) {
    if (reuseableData["minimaList"].length === 0)
      return;
    this.isSortedMinimaList = false;
    for (const lm of reuseableData["minimaList"]) {
      this.minimaList.push(new LocalMinima(lm.vertex, lm.polytype, lm.isOpen));
      if (lm.isOpen)
        this.hasOpenPaths = true;
    }
  }
  deleteFromAEL(ae) {
    const prev = ae.prevInAEL;
    const next = ae.nextInAEL;
    if (prev === null && next === null && ae !== this.actives)
      return;
    if (prev !== null) {
      prev.nextInAEL = next;
    } else {
      this.actives = next;
    }
    if (next !== null)
      next.prevInAEL = prev;
  }
  getBounds() {
    const bounds2 = {
      left: Number.MAX_SAFE_INTEGER,
      top: Number.MAX_SAFE_INTEGER,
      right: Number.MIN_SAFE_INTEGER,
      bottom: Number.MIN_SAFE_INTEGER
    };
    for (const t of this.vertexList) {
      let v = t;
      do {
        if (v.pt.x < bounds2.left)
          bounds2.left = v.pt.x;
        if (v.pt.x > bounds2.right)
          bounds2.right = v.pt.x;
        if (v.pt.y < bounds2.top)
          bounds2.top = v.pt.y;
        if (v.pt.y > bounds2.bottom)
          bounds2.bottom = v.pt.y;
        v = v.next;
      } while (v !== t);
    }
    return Rect64Utils.isEmpty(bounds2) ? { left: 0, top: 0, right: 0, bottom: 0 } : bounds2;
  }
  executeInternal(ct, fillRule) {
    if (ct === ClipType.NoClip)
      return;
    _ClipperBase.openPathsEnabled = this.hasOpenPaths;
    this.zCallbackInternal = this.getZCallback();
    this.fillrule = fillRule;
    this.cliptype = ct;
    this.reset();
    let y = this.popScanline();
    if (y === null)
      return;
    while (this.succeeded) {
      this.insertLocalMinimaIntoAEL(y);
      let ae;
      while ((ae = this.popHorz()) !== null)
        this.doHorizontal(ae);
      if (this.horzSegList.length > 0) {
        this.convertHorzSegsToJoins();
        this.horzSegList.length = 0;
      }
      this.currentBotY = y;
      const nextY = this.popScanline();
      if (nextY === null)
        break;
      y = nextY;
      this.doIntersections(y);
      this.doTopOfScanbeam(y);
      while ((ae = this.popHorz()) !== null)
        this.doHorizontal(ae);
    }
    if (this.succeeded)
      this.processHorzJoins();
  }
  insertLocalMinimaIntoAEL(botY) {
    while (this.hasLocMinAtY(botY)) {
      const localMinima = this.popLocalMinima();
      let leftBound;
      if ((localMinima.vertex.flags & VertexFlags.OpenStart) !== VertexFlags.None) {
        leftBound = null;
      } else {
        leftBound = new Active();
        leftBound.bot = localMinima.vertex.pt;
        leftBound.curX = localMinima.vertex.pt.x;
        leftBound.windDx = -1;
        leftBound.vertexTop = localMinima.vertex.prev;
        leftBound.top = localMinima.vertex.prev.pt;
        leftBound.outrec = null;
        leftBound.localMin = localMinima;
        _ClipperBase.setDx(leftBound);
      }
      let rightBound;
      if ((localMinima.vertex.flags & VertexFlags.OpenEnd) !== VertexFlags.None) {
        rightBound = null;
      } else {
        rightBound = new Active();
        rightBound.bot = localMinima.vertex.pt;
        rightBound.curX = localMinima.vertex.pt.x;
        rightBound.windDx = 1;
        rightBound.vertexTop = localMinima.vertex.next;
        rightBound.top = localMinima.vertex.next.pt;
        rightBound.outrec = null;
        rightBound.localMin = localMinima;
        _ClipperBase.setDx(rightBound);
      }
      if (leftBound !== null && rightBound !== null) {
        if (_ClipperBase.isHorizontal(leftBound)) {
          if (_ClipperBase.isHeadingRightHorz(leftBound)) {
            const tmp = leftBound;
            leftBound = rightBound;
            rightBound = tmp;
          }
        } else if (_ClipperBase.isHorizontal(rightBound)) {
          if (_ClipperBase.isHeadingLeftHorz(rightBound)) {
            const tmp = leftBound;
            leftBound = rightBound;
            rightBound = tmp;
          }
        } else if (leftBound.dx < rightBound.dx) {
          const tmp = leftBound;
          leftBound = rightBound;
          rightBound = tmp;
        }
      } else if (leftBound === null) {
        leftBound = rightBound;
        rightBound = null;
      }
      let contributing;
      leftBound.isLeftBound = true;
      this.insertLeftEdge(leftBound);
      if (!_ClipperBase.openPathsEnabled) {
        this.setWindCountForClosedPathEdge(leftBound);
        contributing = this.isContributingClosed(leftBound);
      } else if (_ClipperBase.isOpen(leftBound)) {
        this.setWindCountForOpenPathEdge(leftBound);
        contributing = this.isContributingOpen(leftBound);
      } else {
        this.setWindCountForClosedPathEdge(leftBound);
        contributing = this.isContributingClosed(leftBound);
      }
      if (rightBound !== null) {
        rightBound.windCount = leftBound.windCount;
        rightBound.windCount2 = leftBound.windCount2;
        this.insertRightEdge(leftBound, rightBound);
        if (contributing) {
          this.addLocalMinPoly(leftBound, rightBound, leftBound.bot, true);
          if (!_ClipperBase.isHorizontal(leftBound)) {
            this.checkJoinLeft(leftBound, leftBound.bot);
          }
        }
        while (rightBound.nextInAEL !== null && this.isValidAelOrder(rightBound.nextInAEL, rightBound)) {
          this.intersectEdges(rightBound, rightBound.nextInAEL, rightBound.bot);
          this.swapPositionsInAEL(rightBound, rightBound.nextInAEL);
        }
        if (_ClipperBase.isHorizontal(rightBound)) {
          this.pushHorz(rightBound);
        } else {
          this.checkJoinRight(rightBound, rightBound.bot);
          this.insertScanline(rightBound.top.y);
        }
      } else if (contributing && _ClipperBase.openPathsEnabled) {
        this.startOpenPath(leftBound, leftBound.bot);
      }
      if (_ClipperBase.isHorizontal(leftBound)) {
        this.pushHorz(leftBound);
      } else {
        this.insertScanline(leftBound.top.y);
      }
    }
  }
  pushHorz(ae) {
    ae.nextInSEL = this.sel;
    this.sel = ae;
  }
  popHorz() {
    const ae = this.sel;
    if (ae === null)
      return null;
    this.sel = this.sel.nextInSEL;
    return ae;
  }
  doHorizontal(horz) {
    if (!_ClipperBase.openPathsEnabled) {
      this.doHorizontalClosed(horz);
      return;
    }
    const horzIsOpen = _ClipperBase.isOpen(horz);
    const y = horz.bot.y;
    const vertexMax = horzIsOpen ? this.getCurrYMaximaVertexOpen(horz) : this.getCurrYMaximaVertex(horz);
    const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
    let leftX2 = leftX;
    let rightX2 = rightX;
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, { x: horz.curX, y });
      this.addToHorzSegList(op);
    }
    while (true) {
      let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
      while (ae !== null) {
        if (ae.vertexTop === vertexMax) {
          if (_ClipperBase.isHotEdge(horz) && this.isJoined(ae))
            this.split(ae, ae.top);
          if (_ClipperBase.isHotEdge(horz)) {
            while (horz.vertexTop !== vertexMax) {
              this.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight) {
              this.addLocalMaxPoly(horz, ae, horz.top);
            } else {
              this.addLocalMaxPoly(ae, horz, horz.top);
            }
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }
        if (vertexMax !== horz.vertexTop || _ClipperBase.isOpenEnd(horz)) {
          if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
            break;
          if (ae.curX === horz.top.x && !_ClipperBase.isHorizontal(ae)) {
            const pt2 = _ClipperBase.nextVertex(horz).pt;
            if (_ClipperBase.isOpen(ae) && !_ClipperBase.isSamePolyType(ae, horz) && !_ClipperBase.isHotEdge(ae)) {
              if (isLeftToRight && _ClipperBase.topX(ae, pt2.y) > pt2.x || !isLeftToRight && _ClipperBase.topX(ae, pt2.y) < pt2.x)
                break;
            } else if (isLeftToRight && _ClipperBase.topX(ae, pt2.y) >= pt2.x || !isLeftToRight && _ClipperBase.topX(ae, pt2.y) <= pt2.x)
              break;
          }
        }
        const pt = { x: ae.curX, y };
        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          this.checkJoinLeft(ae, pt);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          this.checkJoinRight(ae, pt);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }
        if (_ClipperBase.isHotEdge(horz)) {
          this.addToHorzSegList(this.getLastOp(horz));
        }
      }
      if (horzIsOpen && _ClipperBase.isOpenEnd(horz)) {
        if (_ClipperBase.isHotEdge(horz)) {
          this.addOutPt(horz, horz.top);
          if (_ClipperBase.isFront(horz)) {
            horz.outrec.frontEdge = null;
          } else {
            horz.outrec.backEdge = null;
          }
          horz.outrec = null;
        }
        this.deleteFromAEL(horz);
        return;
      }
      if (_ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
        break;
      }
      if (_ClipperBase.isHotEdge(horz)) {
        this.addOutPt(horz, horz.top);
      }
      this.updateEdgeIntoAEL(horz);
      const resetResult = this.resetHorzDirection(horz, vertexMax);
      leftX2 = resetResult.leftX;
      rightX2 = resetResult.rightX;
    }
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }
    this.updateEdgeIntoAEL(horz);
  }
  // Closed-path-only horizontal processing (no open-path branching).
  doHorizontalClosed(horz) {
    const y = horz.bot.y;
    const vertexMax = this.getCurrYMaximaVertex(horz);
    const { isLeftToRight, leftX, rightX } = this.resetHorzDirection(horz, vertexMax);
    let leftX2 = leftX;
    let rightX2 = rightX;
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, { x: horz.curX, y });
      this.addToHorzSegList(op);
    }
    while (true) {
      let ae = isLeftToRight ? horz.nextInAEL : horz.prevInAEL;
      while (ae !== null) {
        if (ae.vertexTop === vertexMax) {
          if (_ClipperBase.isHotEdge(horz) && this.isJoined(ae))
            this.split(ae, ae.top);
          if (_ClipperBase.isHotEdge(horz)) {
            while (horz.vertexTop !== vertexMax) {
              this.addOutPt(horz, horz.top);
              this.updateEdgeIntoAEL(horz);
            }
            if (isLeftToRight) {
              this.addLocalMaxPoly(horz, ae, horz.top);
            } else {
              this.addLocalMaxPoly(ae, horz, horz.top);
            }
          }
          this.deleteFromAEL(ae);
          this.deleteFromAEL(horz);
          return;
        }
        if (vertexMax !== horz.vertexTop) {
          if (isLeftToRight && ae.curX > rightX2 || !isLeftToRight && ae.curX < leftX2)
            break;
          if (ae.curX === horz.top.x && !_ClipperBase.isHorizontal(ae)) {
            const nextPt = _ClipperBase.nextVertex(horz).pt;
            const tx = _ClipperBase.topX(ae, nextPt.y);
            if (isLeftToRight && tx >= nextPt.x || !isLeftToRight && tx <= nextPt.x)
              break;
          }
        }
        const pt = { x: ae.curX, y };
        if (isLeftToRight) {
          this.intersectEdges(horz, ae, pt);
          this.swapPositionsInAEL(horz, ae);
          this.checkJoinLeft(ae, pt);
          horz.curX = ae.curX;
          ae = horz.nextInAEL;
        } else {
          this.intersectEdges(ae, horz, pt);
          this.swapPositionsInAEL(ae, horz);
          this.checkJoinRight(ae, pt);
          horz.curX = ae.curX;
          ae = horz.prevInAEL;
        }
        if (_ClipperBase.isHotEdge(horz)) {
          this.addToHorzSegList(this.getLastOp(horz));
        }
      }
      if (_ClipperBase.nextVertex(horz).pt.y !== horz.top.y) {
        break;
      }
      if (_ClipperBase.isHotEdge(horz)) {
        this.addOutPt(horz, horz.top);
      }
      this.updateEdgeIntoAEL(horz);
      const resetResult = this.resetHorzDirection(horz, vertexMax);
      leftX2 = resetResult.leftX;
      rightX2 = resetResult.rightX;
    }
    if (_ClipperBase.isHotEdge(horz)) {
      const op = this.addOutPt(horz, horz.top);
      this.addToHorzSegList(op);
    }
    this.updateEdgeIntoAEL(horz);
  }
  convertHorzSegsToJoins() {
    const list = this.horzSegList;
    let k = 0;
    for (let i = 0, len = list.length; i < len; i++) {
      const hs = list[i];
      if (this.updateHorzSegment(hs))
        list[k++] = hs;
    }
    if (k < 2)
      return;
    list.length = k;
    this.horzSegList.sort(compareHorzSegments);
    for (let i = 0; i < k - 1; i++) {
      const hs1 = this.horzSegList[i];
      for (let j = i + 1; j < k; j++) {
        const hs2 = this.horzSegList[j];
        if (hs2.leftOp.pt.x >= hs1.rightOp.pt.x || hs2.leftToRight === hs1.leftToRight || hs2.rightOp.pt.x <= hs1.leftOp.pt.x)
          continue;
        const currY = hs1.leftOp.pt.y;
        if (hs1.leftToRight) {
          while (hs1.leftOp.next.pt.y === currY && hs1.leftOp.next.pt.x <= hs2.leftOp.pt.x)
            hs1.leftOp = hs1.leftOp.next;
          while (hs2.leftOp.prev.pt.y === currY && hs2.leftOp.prev.pt.x <= hs1.leftOp.pt.x)
            hs2.leftOp = hs2.leftOp.prev;
          const join2 = new HorzJoin(this.duplicateOp(hs1.leftOp, true), this.duplicateOp(hs2.leftOp, false));
          this.horzJoinList.push(join2);
        } else {
          while (hs1.leftOp.prev.pt.y === currY && hs1.leftOp.prev.pt.x <= hs2.leftOp.pt.x)
            hs1.leftOp = hs1.leftOp.prev;
          while (hs2.leftOp.next.pt.y === currY && hs2.leftOp.next.pt.x <= hs1.leftOp.pt.x)
            hs2.leftOp = hs2.leftOp.next;
          const join2 = new HorzJoin(this.duplicateOp(hs2.leftOp, true), this.duplicateOp(hs1.leftOp, false));
          this.horzJoinList.push(join2);
        }
      }
    }
  }
  updateHorzSegment(hs) {
    const op = hs.leftOp;
    const outrec = this.getRealOutRec(op.outrec);
    const outrecHasEdges = outrec.frontEdge !== null;
    const currY = op.pt.y;
    let opP = op;
    let opN = op;
    if (outrecHasEdges) {
      const opA = outrec.pts;
      const opZ = opA.next;
      while (opP !== opZ && opP.prev.pt.y === currY)
        opP = opP.prev;
      while (opN !== opA && opN.next.pt.y === currY)
        opN = opN.next;
    } else {
      while (opP.prev !== opN && opP.prev.pt.y === currY)
        opP = opP.prev;
      while (opN.next !== opP && opN.next.pt.y === currY)
        opN = opN.next;
    }
    const result = this.setHorzSegHeadingForward(hs, opP, opN) && hs.leftOp.horz === null;
    if (result) {
      hs.leftOp.horz = hs;
    } else {
      hs.rightOp = null;
    }
    return result;
  }
  setHorzSegHeadingForward(hs, opP, opN) {
    if (opP.pt.x === opN.pt.x)
      return false;
    if (opP.pt.x < opN.pt.x) {
      hs.leftOp = opP;
      hs.rightOp = opN;
      hs.leftToRight = true;
    } else {
      hs.leftOp = opN;
      hs.rightOp = opP;
      hs.leftToRight = false;
    }
    return true;
  }
  duplicateOp(op, insertAfter) {
    const result = new OutPt(op.pt, op.outrec);
    if (insertAfter) {
      result.next = op.next;
      result.next.prev = result;
      result.prev = op;
      op.next = result;
    } else {
      result.prev = op.prev;
      result.prev.next = result;
      result.next = op;
      op.prev = result;
    }
    return result;
  }
  getRealOutRec(outRec) {
    while (outRec !== null && outRec.pts === null) {
      outRec = outRec.owner;
    }
    return outRec;
  }
  doIntersections(y) {
    if (this.buildIntersectList(y)) {
      this.processIntersectList();
      this.disposeIntersectNodes();
    }
  }
  doTopOfScanbeam(y) {
    const curXValid = this.curXValidAtTop;
    this.curXValidAtTop = false;
    this.sel = null;
    let ae = this.actives;
    while (ae !== null) {
      if (ae.top.y === y) {
        ae.curX = ae.top.x;
        if (_ClipperBase.isMaximaEdge(ae)) {
          ae = this.doMaxima(ae);
          continue;
        } else {
          if (_ClipperBase.isHotEdge(ae))
            this.addOutPt(ae, ae.top);
          this.updateEdgeIntoAEL(ae);
          if (_ClipperBase.isHorizontal(ae)) {
            this.pushHorz(ae);
          }
        }
      } else if (!curXValid) {
        ae.curX = _ClipperBase.topX(ae, y);
      }
      ae = ae.nextInAEL;
    }
  }
  processHorzJoins() {
    for (const j of this.horzJoinList) {
      const or1 = this.getRealOutRec(j.op1.outrec);
      const or2 = this.getRealOutRec(j.op2.outrec);
      const op1b = j.op1.next;
      const op2b = j.op2.prev;
      j.op1.next = j.op2;
      j.op2.prev = j.op1;
      op1b.prev = op2b;
      op2b.next = op1b;
      if (or1 === or2) {
        const or2New = this.newOutRec();
        or2New.pts = op1b;
        this.fixOutRecPts(or2New);
        if (or1.pts.outrec === or2New) {
          or1.pts = j.op1;
          or1.pts.outrec = or1;
        }
        if (this.usingPolytree) {
          if (this.path1InsidePath2(or1.pts, or2New.pts)) {
            [or2New.pts, or1.pts] = [or1.pts, or2New.pts];
            this.fixOutRecPts(or1);
            this.fixOutRecPts(or2New);
            or2New.owner = or1;
          } else if (this.path1InsidePath2(or2New.pts, or1.pts)) {
            or2New.owner = or1;
          } else {
            or2New.owner = or1.owner;
          }
          if (or1.splits === null)
            or1.splits = [];
          or1.splits.push(or2New.idx);
        } else {
          or2New.owner = or1;
        }
      } else {
        or2.pts = null;
        if (this.usingPolytree) {
          this.setOwner(or2, or1);
          this.moveSplits(or2, or1);
        } else {
          or2.owner = or1;
        }
      }
    }
  }
  fixOutRecPts(outrec) {
    let op = outrec.pts;
    do {
      op.outrec = outrec;
      op = op.next;
    } while (op !== outrec.pts);
  }
  path1InsidePath2(op1, op2) {
    let pip = PointInPolygonResult.IsOn;
    let op = op1;
    do {
      switch (this.pointInOpPolygon(op.pt, op2)) {
        case PointInPolygonResult.IsOutside:
          if (pip === PointInPolygonResult.IsOutside)
            return false;
          pip = PointInPolygonResult.IsOutside;
          break;
        case PointInPolygonResult.IsInside:
          if (pip === PointInPolygonResult.IsInside)
            return true;
          pip = PointInPolygonResult.IsInside;
          break;
      }
      op = op.next;
    } while (op !== op1);
    return InternalClipper.path2ContainsPath1(this.getCleanPath(op1), this.getCleanPath(op2));
  }
  pointInOpPolygon(pt, op) {
    if (op === op.next || op.prev === op.next) {
      return PointInPolygonResult.IsOutside;
    }
    let op2 = op;
    do {
      if (op.pt.y !== pt.y)
        break;
      op = op.next;
    } while (op !== op2);
    if (op.pt.y === pt.y)
      return PointInPolygonResult.IsOutside;
    let isAbove = op.pt.y < pt.y;
    const startingAbove = isAbove;
    let val = 0;
    op2 = op.next;
    while (op2 !== op) {
      if (isAbove) {
        while (op2 !== op && op2.pt.y < pt.y)
          op2 = op2.next;
      } else {
        while (op2 !== op && op2.pt.y > pt.y)
          op2 = op2.next;
      }
      if (op2 === op)
        break;
      if (op2.pt.y === pt.y) {
        if (op2.pt.x === pt.x || op2.pt.y === op2.prev.pt.y && pt.x < op2.prev.pt.x !== pt.x < op2.pt.x)
          return PointInPolygonResult.IsOn;
        op2 = op2.next;
        if (op2 === op)
          break;
        continue;
      }
      if (op2.pt.x <= pt.x || op2.prev.pt.x <= pt.x) {
        if (op2.prev.pt.x < pt.x && op2.pt.x < pt.x) {
          val = 1 - val;
        } else {
          const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
          if (d === 0)
            return PointInPolygonResult.IsOn;
          if (d < 0 === isAbove)
            val = 1 - val;
        }
      }
      isAbove = !isAbove;
      op2 = op2.next;
    }
    if (isAbove === startingAbove)
      return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
    {
      const d = InternalClipper.crossProductSign(op2.prev.pt, op2.pt, pt);
      if (d === 0)
        return PointInPolygonResult.IsOn;
      if (d < 0 === isAbove)
        val = 1 - val;
    }
    return val === 0 ? PointInPolygonResult.IsOutside : PointInPolygonResult.IsInside;
  }
  getCleanPath(op) {
    const result = [];
    let op2 = op;
    while (op2.next !== op && (op2.pt.x === op2.next.pt.x && op2.pt.x === op2.prev.pt.x || op2.pt.y === op2.next.pt.y && op2.pt.y === op2.prev.pt.y))
      op2 = op2.next;
    result.push(op2.pt);
    let prevOp = op2;
    op2 = op2.next;
    while (op2 !== op) {
      if ((op2.pt.x !== op2.next.pt.x || op2.pt.x !== prevOp.pt.x) && (op2.pt.y !== op2.next.pt.y || op2.pt.y !== prevOp.pt.y)) {
        result.push(op2.pt);
        prevOp = op2;
      }
      op2 = op2.next;
    }
    return result;
  }
  moveSplits(fromOr, toOr) {
    if (fromOr.splits === null)
      return;
    if (toOr.splits === null)
      toOr.splits = [];
    for (const i of fromOr.splits) {
      if (i !== toOr.idx) {
        toOr.splits.push(i);
      }
    }
    fromOr.splits = null;
  }
  buildIntersectList(topY) {
    var _a3;
    if (((_a3 = this.actives) == null ? void 0 : _a3.nextInAEL) === null)
      return false;
    if (!this.adjustCurrXAndCopyToSEL(topY)) {
      this.curXValidAtTop = true;
      return false;
    }
    let left = this.sel;
    while (left !== null && left.jump !== null) {
      let prevBase = null;
      while (left !== null && left.jump !== null) {
        let currBase = left;
        let right = left.jump;
        let lEnd = right;
        const rEnd = (right == null ? void 0 : right.jump) || null;
        left.jump = rEnd;
        while (left !== lEnd && right !== rEnd) {
          if (right.curX < left.curX) {
            let tmp = right.prevInSEL;
            while (true) {
              this.addNewIntersectNode(tmp, right, topY);
              if (tmp === left)
                break;
              tmp = tmp.prevInSEL;
            }
            tmp = right;
            right = this.extractFromSEL(tmp);
            lEnd = right;
            if (left !== null)
              this.insert1Before2InSEL(tmp, left);
            if (left !== currBase)
              continue;
            currBase = tmp;
            currBase.jump = rEnd;
            if (prevBase === null) {
              this.sel = currBase;
            } else {
              prevBase.jump = currBase;
            }
          } else {
            left = left.nextInSEL;
          }
        }
        prevBase = currBase;
        left = rEnd;
      }
      left = this.sel;
    }
    return this.intersectList.length > 0;
  }
  processIntersectList() {
    this.intersectList.sort(compareIntersectNodes);
    for (let i = 0; i < this.intersectList.length; ++i) {
      if (!this.edgesAdjacentInAEL(this.intersectList[i])) {
        let j = i + 1;
        while (!this.edgesAdjacentInAEL(this.intersectList[j]))
          j++;
        [this.intersectList[j], this.intersectList[i]] = [this.intersectList[i], this.intersectList[j]];
      }
      const node = this.intersectList[i];
      this.intersectEdges(node.edge1, node.edge2, node.pt);
      this.swapPositionsInAEL(node.edge1, node.edge2);
      node.edge1.curX = node.pt.x;
      node.edge2.curX = node.pt.x;
      this.checkJoinLeft(node.edge2, node.pt, true);
      this.checkJoinRight(node.edge1, node.pt, true);
    }
  }
  edgesAdjacentInAEL(inode) {
    return inode.edge1.nextInAEL === inode.edge2 || inode.edge1.prevInAEL === inode.edge2;
  }
  // Returns true if any adjacent pair is inverted at topY (i.e. at least one
  // intersection exists within this scanbeam).
  adjustCurrXAndCopyToSEL(topY) {
    let ae = this.actives;
    this.sel = ae;
    let prevX = Number.NEGATIVE_INFINITY;
    let inverted = false;
    while (ae !== null) {
      ae.prevInSEL = ae.prevInAEL;
      ae.nextInSEL = ae.nextInAEL;
      ae.jump = ae.nextInSEL;
      const x = _ClipperBase.topX(ae, topY);
      ae.curX = x;
      if (x < prevX)
        inverted = true;
      prevX = x;
      ae = ae.nextInAEL;
    }
    return inverted;
  }
  doMaxima(ae) {
    const prevE = ae.prevInAEL;
    let nextE = ae.nextInAEL;
    if (_ClipperBase.isOpenEnd(ae)) {
      if (_ClipperBase.isHotEdge(ae))
        this.addOutPt(ae, ae.top);
      if (_ClipperBase.isHorizontal(ae))
        return nextE;
      if (_ClipperBase.isHotEdge(ae)) {
        if (_ClipperBase.isFront(ae)) {
          ae.outrec.frontEdge = null;
        } else {
          ae.outrec.backEdge = null;
        }
        ae.outrec = null;
      }
      this.deleteFromAEL(ae);
      return nextE;
    }
    const maxPair = _ClipperBase.getMaximaPair(ae);
    if (maxPair === null)
      return nextE;
    if (this.isJoined(ae))
      this.split(ae, ae.top);
    if (this.isJoined(maxPair))
      this.split(maxPair, maxPair.top);
    while (nextE !== maxPair) {
      this.intersectEdges(ae, nextE, ae.top);
      this.swapPositionsInAEL(ae, nextE);
      nextE = ae.nextInAEL;
    }
    if (_ClipperBase.isOpen(ae)) {
      if (_ClipperBase.isHotEdge(ae)) {
        this.addLocalMaxPoly(ae, maxPair, ae.top);
      }
      this.deleteFromAEL(maxPair);
      this.deleteFromAEL(ae);
      return prevE !== null ? prevE.nextInAEL : this.actives;
    }
    if (_ClipperBase.isHotEdge(ae)) {
      this.addLocalMaxPoly(ae, maxPair, ae.top);
    }
    this.deleteFromAEL(ae);
    this.deleteFromAEL(maxPair);
    return prevE !== null ? prevE.nextInAEL : this.actives;
  }
  updateEdgeIntoAEL(ae) {
    ae.bot = ae.top;
    ae.vertexTop = _ClipperBase.nextVertex(ae);
    ae.top = ae.vertexTop.pt;
    ae.curX = ae.bot.x;
    _ClipperBase.setDx(ae);
    if (this.isJoined(ae))
      this.split(ae, ae.bot);
    if (_ClipperBase.isHorizontal(ae)) {
      if (!_ClipperBase.openPathsEnabled) {
        this.trimHorz(ae, this.preserveCollinear);
      } else if (!_ClipperBase.isOpen(ae)) {
        this.trimHorz(ae, this.preserveCollinear);
      }
      return;
    }
    this.insertScanline(ae.top.y);
    this.checkJoinLeft(ae, ae.bot);
    this.checkJoinRight(ae, ae.bot, true);
  }
  trimHorz(horzEdge, preserveCollinear) {
    let wasTrimmed = false;
    let pt = _ClipperBase.nextVertex(horzEdge).pt;
    while (pt.y === horzEdge.top.y) {
      if (preserveCollinear && pt.x < horzEdge.top.x !== horzEdge.bot.x < horzEdge.top.x) {
        break;
      }
      horzEdge.vertexTop = _ClipperBase.nextVertex(horzEdge);
      horzEdge.top = pt;
      wasTrimmed = true;
      if (_ClipperBase.isMaximaVertex(horzEdge.vertexTop))
        break;
      pt = _ClipperBase.nextVertex(horzEdge).pt;
    }
    if (wasTrimmed)
      _ClipperBase.setDx(horzEdge);
  }
  addToHorzSegList(op) {
    if (op.outrec.isOpen)
      return;
    this.horzSegList.push(new HorzSegment(op));
  }
  addNewIntersectNode(ae1, ae2, topY) {
    let ip = InternalClipper.getLineIntersectPt(ae1.bot, ae1.top, ae2.bot, ae2.top);
    if (ip === null) {
      ip = { x: ae1.curX, y: topY };
    }
    if (ip.y > this.currentBotY || ip.y < topY) {
      const absDx1 = Math.abs(ae1.dx);
      const absDx2 = Math.abs(ae2.dx);
      if (absDx1 > 100 && absDx2 > 100) {
        if (absDx1 > absDx2) {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
        } else {
          ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
        }
      } else if (absDx1 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae1.bot, ae1.top);
      } else if (absDx2 > 100) {
        ip = InternalClipper.getClosestPtOnSegment(ip, ae2.bot, ae2.top);
      } else {
        if (ip.y < topY)
          ip.y = topY;
        else
          ip.y = this.currentBotY;
        if (absDx1 < absDx2)
          ip.x = _ClipperBase.topX(ae1, ip.y);
        else
          ip.x = _ClipperBase.topX(ae2, ip.y);
      }
    }
    const node = createIntersectNode(ip, ae1, ae2);
    this.intersectList.push(node);
  }
  extractFromSEL(ae) {
    const res = ae.nextInSEL;
    if (res !== null) {
      res.prevInSEL = ae.prevInSEL;
    }
    ae.prevInSEL.nextInSEL = res;
    return res;
  }
  insert1Before2InSEL(ae1, ae2) {
    ae1.prevInSEL = ae2.prevInSEL;
    if (ae1.prevInSEL !== null) {
      ae1.prevInSEL.nextInSEL = ae1;
    }
    ae1.nextInSEL = ae2;
    ae2.prevInSEL = ae1;
  }
  getCurrYMaximaVertexOpen(ae) {
    let result = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result.next.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
        result = result.next;
    } else {
      while (result.prev.pt.y === result.pt.y && (result.flags & (VertexFlags.OpenEnd | VertexFlags.LocalMax)) === VertexFlags.None)
        result = result.prev;
    }
    if (!_ClipperBase.isMaximaVertex(result))
      result = null;
    return result;
  }
  getCurrYMaximaVertex(ae) {
    let result = ae.vertexTop;
    if (ae.windDx > 0) {
      while (result.next.pt.y === result.pt.y)
        result = result.next;
    } else {
      while (result.prev.pt.y === result.pt.y)
        result = result.prev;
    }
    if (!_ClipperBase.isMaximaVertex(result))
      result = null;
    return result;
  }
  resetHorzDirection(horz, vertexMax) {
    if (horz.bot.x === horz.top.x) {
      const leftX = horz.curX;
      const rightX = horz.curX;
      let ae = horz.nextInAEL;
      while (ae !== null && ae.vertexTop !== vertexMax)
        ae = ae.nextInAEL;
      return { isLeftToRight: ae !== null, leftX, rightX };
    }
    if (horz.curX < horz.top.x) {
      return { isLeftToRight: true, leftX: horz.curX, rightX: horz.top.x };
    } else {
      return { isLeftToRight: false, leftX: horz.top.x, rightX: horz.curX };
    }
  }
  getLastOp(hotEdge) {
    const outrec = hotEdge.outrec;
    return hotEdge === outrec.frontEdge ? outrec.pts : outrec.pts.next;
  }
  insertLeftEdge(ae) {
    if (this.actives === null) {
      ae.prevInAEL = null;
      ae.nextInAEL = null;
      this.actives = ae;
    } else if (!this.isValidAelOrder(this.actives, ae)) {
      ae.prevInAEL = null;
      ae.nextInAEL = this.actives;
      this.actives.prevInAEL = ae;
      this.actives = ae;
    } else {
      let ae2 = this.actives;
      while (ae2.nextInAEL !== null && this.isValidAelOrder(ae2.nextInAEL, ae)) {
        ae2 = ae2.nextInAEL;
      }
      if (ae2.joinWith === JoinWith.Right)
        ae2 = ae2.nextInAEL;
      ae.nextInAEL = ae2.nextInAEL;
      if (ae2.nextInAEL !== null)
        ae2.nextInAEL.prevInAEL = ae;
      ae.prevInAEL = ae2;
      ae2.nextInAEL = ae;
    }
  }
  insertRightEdge(ae1, ae2) {
    ae2.nextInAEL = ae1.nextInAEL;
    if (ae1.nextInAEL !== null)
      ae1.nextInAEL.prevInAEL = ae2;
    ae2.prevInAEL = ae1;
    ae1.nextInAEL = ae2;
  }
  setWindCountForOpenPathEdge(ae) {
    let ae2 = this.actives;
    if (this.fillrule === FillRule.EvenOdd) {
      let cnt1 = 0, cnt2 = 0;
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) === PathType.Clip) {
          cnt2++;
        } else if (!_ClipperBase.isOpen(ae2)) {
          cnt1++;
        }
        ae2 = ae2.nextInAEL;
      }
      ae.windCount = _ClipperBase.isOdd(cnt1) ? 1 : 0;
      ae.windCount2 = _ClipperBase.isOdd(cnt2) ? 1 : 0;
    } else {
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) === PathType.Clip) {
          ae.windCount2 += ae2.windDx;
        } else if (!_ClipperBase.isOpen(ae2)) {
          ae.windCount += ae2.windDx;
        }
        ae2 = ae2.nextInAEL;
      }
    }
  }
  setWindCountForClosedPathEdge(ae) {
    let ae2 = ae.prevInAEL;
    const pt = _ClipperBase.getPolyType(ae);
    if (!_ClipperBase.openPathsEnabled) {
      while (ae2 !== null && _ClipperBase.getPolyType(ae2) !== pt)
        ae2 = ae2.prevInAEL;
      if (ae2 === null) {
        ae.windCount = ae.windDx;
        ae2 = this.actives;
      } else if (this.fillrule === FillRule.EvenOdd) {
        ae.windCount = ae.windDx;
        ae.windCount2 = ae2.windCount2;
        ae2 = ae2.nextInAEL;
      } else {
        if (ae2.windCount * ae2.windDx < 0) {
          if (Math.abs(ae2.windCount) > 1) {
            if (ae2.windDx * ae.windDx < 0) {
              ae.windCount = ae2.windCount;
            } else {
              ae.windCount = ae2.windCount + ae.windDx;
            }
          } else {
            ae.windCount = ae.windDx;
          }
        } else {
          if (ae2.windDx * ae.windDx < 0) {
            ae.windCount = ae2.windCount;
          } else {
            ae.windCount = ae2.windCount + ae.windDx;
          }
        }
        ae.windCount2 = ae2.windCount2;
        ae2 = ae2.nextInAEL;
      }
      if (this.fillrule === FillRule.EvenOdd) {
        while (ae2 !== ae) {
          if (_ClipperBase.getPolyType(ae2) !== pt) {
            ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
          }
          ae2 = ae2.nextInAEL;
        }
      } else {
        while (ae2 !== ae) {
          if (_ClipperBase.getPolyType(ae2) !== pt) {
            ae.windCount2 += ae2.windDx;
          }
          ae2 = ae2.nextInAEL;
        }
      }
      return;
    }
    while (ae2 !== null && (_ClipperBase.getPolyType(ae2) !== pt || _ClipperBase.isOpen(ae2)))
      ae2 = ae2.prevInAEL;
    if (ae2 === null) {
      ae.windCount = ae.windDx;
      ae2 = this.actives;
    } else if (this.fillrule === FillRule.EvenOdd) {
      ae.windCount = ae.windDx;
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    } else {
      if (ae2.windCount * ae2.windDx < 0) {
        if (Math.abs(ae2.windCount) > 1) {
          if (ae2.windDx * ae.windDx < 0) {
            ae.windCount = ae2.windCount;
          } else {
            ae.windCount = ae2.windCount + ae.windDx;
          }
        } else {
          ae.windCount = _ClipperBase.isOpen(ae) ? 1 : ae.windDx;
        }
      } else {
        if (ae2.windDx * ae.windDx < 0) {
          ae.windCount = ae2.windCount;
        } else {
          ae.windCount = ae2.windCount + ae.windDx;
        }
      }
      ae.windCount2 = ae2.windCount2;
      ae2 = ae2.nextInAEL;
    }
    if (this.fillrule === FillRule.EvenOdd) {
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) !== pt && !_ClipperBase.isOpen(ae2)) {
          ae.windCount2 = ae.windCount2 === 0 ? 1 : 0;
        }
        ae2 = ae2.nextInAEL;
      }
    } else {
      while (ae2 !== ae) {
        if (_ClipperBase.getPolyType(ae2) !== pt && !_ClipperBase.isOpen(ae2)) {
          ae.windCount2 += ae2.windDx;
        }
        ae2 = ae2.nextInAEL;
      }
    }
  }
  isContributingOpen(ae) {
    let isInClip, isInSubj;
    switch (this.fillrule) {
      case FillRule.Positive:
        isInSubj = ae.windCount > 0;
        isInClip = ae.windCount2 > 0;
        break;
      case FillRule.Negative:
        isInSubj = ae.windCount < 0;
        isInClip = ae.windCount2 < 0;
        break;
      default:
        isInSubj = ae.windCount !== 0;
        isInClip = ae.windCount2 !== 0;
        break;
    }
    switch (this.cliptype) {
      case ClipType.Intersection:
        return isInClip;
      case ClipType.Union:
        return !isInSubj && !isInClip;
      default:
        return !isInClip;
    }
  }
  isContributingClosed(ae) {
    switch (this.fillrule) {
      case FillRule.Positive:
        if (ae.windCount !== 1)
          return false;
        break;
      case FillRule.Negative:
        if (ae.windCount !== -1)
          return false;
        break;
      case FillRule.NonZero:
        if (Math.abs(ae.windCount) !== 1)
          return false;
        break;
    }
    switch (this.cliptype) {
      case ClipType.Intersection:
        return this.fillrule === FillRule.Positive ? ae.windCount2 > 0 : this.fillrule === FillRule.Negative ? ae.windCount2 < 0 : ae.windCount2 !== 0;
      case ClipType.Union:
        return this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
      case ClipType.Difference: {
        const result = this.fillrule === FillRule.Positive ? ae.windCount2 <= 0 : this.fillrule === FillRule.Negative ? ae.windCount2 >= 0 : ae.windCount2 === 0;
        return _ClipperBase.getPolyType(ae) === PathType.Subject ? result : !result;
      }
      case ClipType.Xor:
        return true;
      // XOr is always contributing unless open
      default:
        return false;
    }
  }
  addLocalMinPoly(ae1, ae2, pt, isNew = false) {
    const outrec = this.newOutRec();
    ae1.outrec = outrec;
    ae2.outrec = outrec;
    if (_ClipperBase.isOpen(ae1)) {
      outrec.owner = null;
      outrec.isOpen = true;
      if (ae1.windDx > 0) {
        this.setSides(outrec, ae1, ae2);
      } else {
        this.setSides(outrec, ae2, ae1);
      }
    } else {
      outrec.isOpen = false;
      const prevHotEdge = _ClipperBase.getPrevHotEdge(ae1);
      if (prevHotEdge !== null) {
        if (this.usingPolytree) {
          this.setOwner(outrec, prevHotEdge.outrec);
        }
        outrec.owner = prevHotEdge.outrec;
        if (this.outrecIsAscending(prevHotEdge) === isNew) {
          this.setSides(outrec, ae2, ae1);
        } else {
          this.setSides(outrec, ae1, ae2);
        }
      } else {
        outrec.owner = null;
        if (isNew) {
          this.setSides(outrec, ae1, ae2);
        } else {
          this.setSides(outrec, ae2, ae1);
        }
      }
    }
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }
  outrecIsAscending(hotEdge) {
    return hotEdge === hotEdge.outrec.frontEdge;
  }
  newOutRec() {
    const result = new OutRec();
    result.idx = this.outrecList.length;
    this.outrecList.push(result);
    return result;
  }
  startOpenPath(ae, pt) {
    const outrec = this.newOutRec();
    outrec.isOpen = true;
    if (ae.windDx > 0) {
      outrec.frontEdge = ae;
      outrec.backEdge = null;
    } else {
      outrec.frontEdge = null;
      outrec.backEdge = ae;
    }
    ae.outrec = outrec;
    const op = new OutPt(pt, outrec);
    outrec.pts = op;
    return op;
  }
  checkJoinLeft(ae, pt, checkCurrX = false) {
    const prev = ae.prevInAEL;
    if (prev === null)
      return;
    if (!checkCurrX && ae.curX !== prev.curX)
      return;
    if (!_ClipperBase.isHotEdge(ae) || !_ClipperBase.isHotEdge(prev) || _ClipperBase.isHorizontal(ae) || _ClipperBase.isHorizontal(prev) || _ClipperBase.isOpen(ae) || _ClipperBase.isOpen(prev))
      return;
    if ((pt.y < ae.top.y + 2 || pt.y < prev.top.y + 2) && // avoid trivial joins
    (ae.bot.y > pt.y || prev.bot.y > pt.y))
      return;
    if (checkCurrX) {
      if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, prev.bot, prev.top))
        return;
    }
    if (!InternalClipper.isCollinear(ae.top, pt, prev.top))
      return;
    if (ae.outrec.idx === prev.outrec.idx) {
      this.addLocalMaxPoly(prev, ae, pt);
    } else if (ae.outrec.idx < prev.outrec.idx) {
      this.joinOutrecPaths(ae, prev);
    } else {
      this.joinOutrecPaths(prev, ae);
    }
    prev.joinWith = JoinWith.Right;
    ae.joinWith = JoinWith.Left;
  }
  checkJoinRight(ae, pt, checkCurrX = false) {
    const next = ae.nextInAEL;
    if (next === null)
      return;
    if (!checkCurrX && ae.curX !== next.curX)
      return;
    if (!_ClipperBase.isHotEdge(ae) || !_ClipperBase.isHotEdge(next) || _ClipperBase.isHorizontal(ae) || _ClipperBase.isHorizontal(next) || _ClipperBase.isOpen(ae) || _ClipperBase.isOpen(next))
      return;
    if ((pt.y < ae.top.y + 2 || pt.y < next.top.y + 2) && // avoid trivial joins
    (ae.bot.y > pt.y || next.bot.y > pt.y))
      return;
    if (checkCurrX) {
      if (this.perpendicDistFromLineSqrdGreaterThanQuarter(pt, next.bot, next.top))
        return;
    }
    if (!InternalClipper.isCollinear(ae.top, pt, next.top))
      return;
    if (ae.outrec.idx === next.outrec.idx) {
      this.addLocalMaxPoly(ae, next, pt);
    } else if (ae.outrec.idx < next.outrec.idx) {
      this.joinOutrecPaths(ae, next);
    } else {
      this.joinOutrecPaths(next, ae);
    }
    ae.joinWith = JoinWith.Right;
    next.joinWith = JoinWith.Left;
  }
  perpendicDistFromLineSqrdGreaterThanQuarter(pt, line1, line2) {
    const a = pt.x - line1.x;
    const b = pt.y - line1.y;
    const c = line2.x - line1.x;
    const d = line2.y - line1.y;
    if (c === 0 && d === 0)
      return false;
    const maxCoord = InternalClipper.maxCoordForSafeCrossSq;
    if (Math.abs(a) < maxCoord && Math.abs(b) < maxCoord && Math.abs(c) < maxCoord && Math.abs(d) < maxCoord) {
      const cross3 = a * d - c * b;
      return cross3 * cross3 / (c * c + d * d) > 0.25;
    }
    if (Number.isSafeInteger(a) && Number.isSafeInteger(b) && Number.isSafeInteger(c) && Number.isSafeInteger(d)) {
      const cross3 = BigInt(a) * BigInt(d) - BigInt(c) * BigInt(b);
      const crossSq = cross3 * cross3;
      const denom = BigInt(c) * BigInt(c) + BigInt(d) * BigInt(d);
      return B4 * crossSq > denom;
    }
    const cross2 = a * d - c * b;
    return cross2 * cross2 / (c * c + d * d) > 0.25;
  }
  intersectEdges(ae1, ae2, pt) {
    let resultOp;
    if (this.hasOpenPaths && (_ClipperBase.isOpen(ae1) || _ClipperBase.isOpen(ae2))) {
      if (_ClipperBase.isOpen(ae1) && _ClipperBase.isOpen(ae2))
        return;
      if (_ClipperBase.isOpen(ae2)) {
        const tmp = ae1;
        ae1 = ae2;
        ae2 = tmp;
      }
      if (this.isJoined(ae2))
        this.split(ae2, pt);
      if (this.cliptype === ClipType.Union) {
        if (!_ClipperBase.isHotEdge(ae2))
          return;
      } else if (ae2.localMin.polytype === PathType.Subject)
        return;
      switch (this.fillrule) {
        case FillRule.Positive:
          if (ae2.windCount !== 1)
            return;
          break;
        case FillRule.Negative:
          if (ae2.windCount !== -1)
            return;
          break;
        default:
          if (Math.abs(ae2.windCount) !== 1)
            return;
          break;
      }
      if (_ClipperBase.isHotEdge(ae1)) {
        resultOp = this.addOutPt(ae1, pt);
        this.setZ(ae1, ae2, resultOp.pt);
        if (_ClipperBase.isFront(ae1)) {
          ae1.outrec.frontEdge = null;
        } else {
          ae1.outrec.backEdge = null;
        }
        ae1.outrec = null;
      } else if (pt.x === ae1.localMin.vertex.pt.x && pt.y === ae1.localMin.vertex.pt.y && !_ClipperBase.isOpenEndVertex(ae1.localMin.vertex)) {
        const ae3 = this.findEdgeWithMatchingLocMin(ae1);
        if (ae3 !== null && _ClipperBase.isHotEdge(ae3)) {
          ae1.outrec = ae3.outrec;
          if (ae1.windDx > 0) {
            this.setSides(ae3.outrec, ae1, ae3);
          } else {
            this.setSides(ae3.outrec, ae3, ae1);
          }
          return;
        }
        resultOp = this.startOpenPath(ae1, pt);
      } else {
        resultOp = this.startOpenPath(ae1, pt);
      }
      this.setZ(ae1, ae2, resultOp.pt);
      return;
    }
    if (this.isJoined(ae1))
      this.split(ae1, pt);
    if (this.isJoined(ae2))
      this.split(ae2, pt);
    let oldE1WindCount, oldE2WindCount;
    if (ae1.localMin.polytype === ae2.localMin.polytype) {
      if (this.fillrule === FillRule.EvenOdd) {
        oldE1WindCount = ae1.windCount;
        ae1.windCount = ae2.windCount;
        ae2.windCount = oldE1WindCount;
      } else {
        if (ae1.windCount + ae2.windDx === 0) {
          ae1.windCount = -ae1.windCount;
        } else {
          ae1.windCount += ae2.windDx;
        }
        if (ae2.windCount - ae1.windDx === 0) {
          ae2.windCount = -ae2.windCount;
        } else {
          ae2.windCount -= ae1.windDx;
        }
      }
    } else {
      if (this.fillrule !== FillRule.EvenOdd) {
        ae1.windCount2 += ae2.windDx;
      } else {
        ae1.windCount2 = ae1.windCount2 === 0 ? 1 : 0;
      }
      if (this.fillrule !== FillRule.EvenOdd) {
        ae2.windCount2 -= ae1.windDx;
      } else {
        ae2.windCount2 = ae2.windCount2 === 0 ? 1 : 0;
      }
    }
    switch (this.fillrule) {
      case FillRule.Positive:
        oldE1WindCount = ae1.windCount;
        oldE2WindCount = ae2.windCount;
        break;
      case FillRule.Negative:
        oldE1WindCount = -ae1.windCount;
        oldE2WindCount = -ae2.windCount;
        break;
      default:
        oldE1WindCount = Math.abs(ae1.windCount);
        oldE2WindCount = Math.abs(ae2.windCount);
        break;
    }
    const e1WindCountIs0or1 = oldE1WindCount === 0 || oldE1WindCount === 1;
    const e2WindCountIs0or1 = oldE2WindCount === 0 || oldE2WindCount === 1;
    if (!_ClipperBase.isHotEdge(ae1) && !e1WindCountIs0or1 || !_ClipperBase.isHotEdge(ae2) && !e2WindCountIs0or1)
      return;
    if (_ClipperBase.isHotEdge(ae1) && _ClipperBase.isHotEdge(ae2)) {
      if (oldE1WindCount !== 0 && oldE1WindCount !== 1 || oldE2WindCount !== 0 && oldE2WindCount !== 1 || ae1.localMin.polytype !== ae2.localMin.polytype && this.cliptype !== ClipType.Xor) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
      } else if (_ClipperBase.isFront(ae1) || ae1.outrec === ae2.outrec) {
        resultOp = this.addLocalMaxPoly(ae1, ae2, pt);
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
        const op2 = this.addLocalMinPoly(ae1, ae2, pt);
        this.setZ(ae1, ae2, op2.pt);
      } else {
        resultOp = this.addOutPt(ae1, pt);
        this.setZ(ae1, ae2, resultOp.pt);
        const op2 = this.addOutPt(ae2, pt);
        this.setZ(ae1, ae2, op2.pt);
        this.swapOutrecs(ae1, ae2);
      }
    } else if (_ClipperBase.isHotEdge(ae1)) {
      resultOp = this.addOutPt(ae1, pt);
      this.setZ(ae1, ae2, resultOp.pt);
      this.swapOutrecs(ae1, ae2);
    } else if (_ClipperBase.isHotEdge(ae2)) {
      resultOp = this.addOutPt(ae2, pt);
      this.setZ(ae1, ae2, resultOp.pt);
      this.swapOutrecs(ae1, ae2);
    } else {
      let e1Wc2, e2Wc2;
      switch (this.fillrule) {
        case FillRule.Positive:
          e1Wc2 = ae1.windCount2;
          e2Wc2 = ae2.windCount2;
          break;
        case FillRule.Negative:
          e1Wc2 = -ae1.windCount2;
          e2Wc2 = -ae2.windCount2;
          break;
        default:
          e1Wc2 = Math.abs(ae1.windCount2);
          e2Wc2 = Math.abs(ae2.windCount2);
          break;
      }
      if (!_ClipperBase.isSamePolyType(ae1, ae2)) {
        resultOp = this.addLocalMinPoly(ae1, ae2, pt);
        this.setZ(ae1, ae2, resultOp.pt);
      } else if (oldE1WindCount === 1 && oldE2WindCount === 1) {
        resultOp = null;
        switch (this.cliptype) {
          case ClipType.Union:
            if (e1Wc2 > 0 && e2Wc2 > 0)
              return;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
          case ClipType.Difference:
            if (_ClipperBase.getPolyType(ae1) === PathType.Clip && e1Wc2 > 0 && e2Wc2 > 0 || _ClipperBase.getPolyType(ae1) === PathType.Subject && e1Wc2 <= 0 && e2Wc2 <= 0) {
              resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            }
            break;
          case ClipType.Xor:
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
          default:
            if (e1Wc2 <= 0 || e2Wc2 <= 0)
              return;
            resultOp = this.addLocalMinPoly(ae1, ae2, pt);
            break;
        }
        if (resultOp)
          this.setZ(ae1, ae2, resultOp.pt);
      }
    }
  }
  swapPositionsInAEL(ae1, ae2) {
    const next = ae2.nextInAEL;
    if (next !== null)
      next.prevInAEL = ae1;
    const prev = ae1.prevInAEL;
    if (prev !== null)
      prev.nextInAEL = ae2;
    ae2.prevInAEL = prev;
    ae2.nextInAEL = ae1;
    ae1.prevInAEL = ae2;
    ae1.nextInAEL = next;
    if (ae2.prevInAEL === null)
      this.actives = ae2;
  }
  isValidAelOrder(resident, newcomer) {
    if (newcomer.curX !== resident.curX) {
      return newcomer.curX > resident.curX;
    }
    const d = InternalClipper.crossProductSign(resident.top, newcomer.bot, newcomer.top);
    if (d !== 0)
      return d < 0;
    if (!_ClipperBase.isMaximaEdge(resident) && resident.top.y > newcomer.top.y) {
      return InternalClipper.crossProductSign(newcomer.bot, resident.top, _ClipperBase.nextVertex(resident).pt) <= 0;
    }
    if (!_ClipperBase.isMaximaEdge(newcomer) && newcomer.top.y > resident.top.y) {
      return InternalClipper.crossProductSign(newcomer.bot, newcomer.top, _ClipperBase.nextVertex(newcomer).pt) >= 0;
    }
    const y = newcomer.bot.y;
    const newcomerIsLeft = newcomer.isLeftBound;
    if (resident.bot.y !== y || resident.localMin.vertex.pt.y !== y) {
      return newcomer.isLeftBound;
    }
    if (resident.isLeftBound !== newcomerIsLeft) {
      return newcomerIsLeft;
    }
    if (InternalClipper.isCollinear(_ClipperBase.prevPrevVertex(resident).pt, resident.bot, resident.top))
      return true;
    return InternalClipper.crossProductSign(_ClipperBase.prevPrevVertex(resident).pt, newcomer.bot, _ClipperBase.prevPrevVertex(newcomer).pt) > 0 === newcomerIsLeft;
  }
  isJoined(e) {
    return e.joinWith !== JoinWith.None;
  }
  split(e, currPt) {
    if (e.joinWith === JoinWith.Right) {
      e.joinWith = JoinWith.None;
      e.nextInAEL.joinWith = JoinWith.None;
      this.addLocalMinPoly(e, e.nextInAEL, currPt, true);
    } else {
      e.joinWith = JoinWith.None;
      e.prevInAEL.joinWith = JoinWith.None;
      this.addLocalMinPoly(e.prevInAEL, e, currPt, true);
    }
  }
  setSides(outrec, startEdge, endEdge) {
    outrec.frontEdge = startEdge;
    outrec.backEdge = endEdge;
  }
  findEdgeWithMatchingLocMin(e) {
    var _a3, _b;
    let result = e.nextInAEL;
    while (result !== null) {
      if ((_a3 = result.localMin) == null ? void 0 : _a3.equals(e.localMin))
        return result;
      if (!_ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
        result = null;
      else
        result = result.nextInAEL;
    }
    result = e.prevInAEL;
    while (result !== null) {
      if ((_b = result.localMin) == null ? void 0 : _b.equals(e.localMin))
        return result;
      if (!_ClipperBase.isHorizontal(result) && !(e.bot.x === result.bot.x && e.bot.y === result.bot.y))
        return null;
      result = result.prevInAEL;
    }
    return result;
  }
  addOutPt(ae, pt) {
    const outrec = ae.outrec;
    const toFront = _ClipperBase.isFront(ae);
    const opFront = outrec.pts;
    const opBack = opFront.next;
    if (toFront && pt.x === opFront.pt.x && pt.y === opFront.pt.y) {
      return opFront;
    } else if (!toFront && pt.x === opBack.pt.x && pt.y === opBack.pt.y) {
      return opBack;
    }
    const newOp = new OutPt(pt, outrec);
    opBack.prev = newOp;
    newOp.prev = opFront;
    newOp.next = opBack;
    opFront.next = newOp;
    if (toFront)
      outrec.pts = newOp;
    return newOp;
  }
  addLocalMaxPoly(ae1, ae2, pt) {
    if (this.isJoined(ae1))
      this.split(ae1, pt);
    if (this.isJoined(ae2))
      this.split(ae2, pt);
    if (_ClipperBase.isFront(ae1) === _ClipperBase.isFront(ae2)) {
      if (_ClipperBase.isOpenEnd(ae1)) {
        this.swapFrontBackSides(ae1.outrec);
      } else if (_ClipperBase.isOpenEnd(ae2)) {
        this.swapFrontBackSides(ae2.outrec);
      } else {
        this.succeeded = false;
        return null;
      }
    }
    const result = this.addOutPt(ae1, pt);
    if (ae1.outrec === ae2.outrec) {
      const outrec = ae1.outrec;
      outrec.pts = result;
      if (this.usingPolytree) {
        const e = _ClipperBase.getPrevHotEdge(ae1);
        if (e === null) {
          outrec.owner = null;
        } else {
          this.setOwner(outrec, e.outrec);
        }
      }
      this.uncoupleOutRec(ae1);
    } else if (_ClipperBase.isOpen(ae1)) {
      if (ae1.windDx < 0) {
        this.joinOutrecPaths(ae1, ae2);
      } else {
        this.joinOutrecPaths(ae2, ae1);
      }
    } else if (ae1.outrec.idx < ae2.outrec.idx) {
      this.joinOutrecPaths(ae1, ae2);
    } else {
      this.joinOutrecPaths(ae2, ae1);
    }
    return result;
  }
  swapFrontBackSides(outrec) {
    const ae2 = outrec.frontEdge;
    outrec.frontEdge = outrec.backEdge;
    outrec.backEdge = ae2;
    outrec.pts = outrec.pts.next;
  }
  setOwner(outrec, newOwner) {
    while (newOwner.owner !== null && newOwner.owner.pts === null) {
      newOwner.owner = newOwner.owner.owner;
    }
    let tmp = newOwner;
    while (tmp !== null && tmp !== outrec) {
      tmp = tmp.owner;
    }
    if (tmp !== null) {
      newOwner.owner = outrec.owner;
    }
    outrec.owner = newOwner;
  }
  uncoupleOutRec(ae) {
    const outrec = ae.outrec;
    if (outrec === null)
      return;
    outrec.frontEdge.outrec = null;
    outrec.backEdge.outrec = null;
    outrec.frontEdge = null;
    outrec.backEdge = null;
  }
  joinOutrecPaths(ae1, ae2) {
    const p1Start = ae1.outrec.pts;
    const p2Start = ae2.outrec.pts;
    const p1End = p1Start.next;
    const p2End = p2Start.next;
    if (_ClipperBase.isFront(ae1)) {
      p2End.prev = p1Start;
      p1Start.next = p2End;
      p2Start.next = p1End;
      p1End.prev = p2Start;
      ae1.outrec.pts = p2Start;
      ae1.outrec.frontEdge = ae2.outrec.frontEdge;
      if (ae1.outrec.frontEdge !== null) {
        ae1.outrec.frontEdge.outrec = ae1.outrec;
      }
    } else {
      p1End.prev = p2Start;
      p2Start.next = p1End;
      p1Start.next = p2End;
      p2End.prev = p1Start;
      ae1.outrec.backEdge = ae2.outrec.backEdge;
      if (ae1.outrec.backEdge !== null) {
        ae1.outrec.backEdge.outrec = ae1.outrec;
      }
    }
    ae2.outrec.frontEdge = null;
    ae2.outrec.backEdge = null;
    ae2.outrec.pts = null;
    this.setOwner(ae2.outrec, ae1.outrec);
    if (_ClipperBase.isOpenEnd(ae1)) {
      ae2.outrec.pts = ae1.outrec.pts;
      ae1.outrec.pts = null;
    }
    ae1.outrec = null;
    ae2.outrec = null;
  }
  swapOutrecs(ae1, ae2) {
    const or1 = ae1.outrec;
    const or2 = ae2.outrec;
    if (or1 === or2) {
      const ae = or1.frontEdge;
      or1.frontEdge = or1.backEdge;
      or1.backEdge = ae;
      return;
    }
    if (or1 !== null) {
      if (ae1 === or1.frontEdge) {
        or1.frontEdge = ae2;
      } else {
        or1.backEdge = ae2;
      }
    }
    if (or2 !== null) {
      if (ae2 === or2.frontEdge) {
        or2.frontEdge = ae1;
      } else {
        or2.backEdge = ae1;
      }
    }
    ae1.outrec = or2;
    ae2.outrec = or1;
  }
  disposeIntersectNodes() {
    this.intersectList.length = 0;
  }
  static ptsReallyClose(pt1, pt2) {
    return Math.abs(pt1.x - pt2.x) < 2 && Math.abs(pt1.y - pt2.y) < 2;
  }
  static isVerySmallTriangle(op) {
    return op.next.next === op.prev && (_ClipperBase.ptsReallyClose(op.prev.pt, op.next.pt) || _ClipperBase.ptsReallyClose(op.pt, op.next.pt) || _ClipperBase.ptsReallyClose(op.pt, op.prev.pt));
  }
  static buildPath(op, reverse, isOpen, path) {
    if (op === null || op.next === op || !isOpen && op.next === op.prev)
      return false;
    path.length = 0;
    let lastPt;
    let op2;
    if (reverse) {
      lastPt = op.pt;
      op2 = op.prev;
    } else {
      op = op.next;
      lastPt = op.pt;
      op2 = op.next;
    }
    path.push(lastPt);
    while (op2 !== op) {
      if (!(op2.pt.x === lastPt.x && op2.pt.y === lastPt.y)) {
        lastPt = op2.pt;
        path.push(lastPt);
      }
      if (reverse) {
        op2 = op2.prev;
      } else {
        op2 = op2.next;
      }
    }
    return path.length !== 3 || isOpen || !_ClipperBase.isVerySmallTriangle(op2);
  }
  buildPaths(solutionClosed, solutionOpen) {
    solutionClosed.length = 0;
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      const path = [];
      if (outrec.isOpen) {
        if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, path)) {
          solutionOpen.push(path);
        }
      } else {
        this.cleanCollinear(outrec);
        if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, path)) {
          solutionClosed.push(path);
        }
      }
    }
    return true;
  }
  buildTree(polytree, solutionOpen) {
    polytree.clear();
    solutionOpen.length = 0;
    let i = 0;
    while (i < this.outrecList.length) {
      const outrec = this.outrecList[i++];
      if (outrec.pts === null)
        continue;
      if (outrec.isOpen) {
        const openPath = [];
        if (_ClipperBase.buildPath(outrec.pts, this.reverseSolution, true, openPath)) {
          solutionOpen.push(openPath);
        }
        continue;
      }
      if (this.checkBounds(outrec)) {
        this.recursiveCheckOwners(outrec, polytree);
      }
    }
  }
  checkBounds(outrec) {
    if (outrec.pts === null)
      return false;
    if (!Rect64Utils.isEmpty(outrec.bounds))
      return true;
    this.cleanCollinear(outrec);
    if (outrec.pts === null || !_ClipperBase.buildPath(outrec.pts, this.reverseSolution, false, outrec.path)) {
      return false;
    }
    outrec.bounds = InternalClipper.getBounds(outrec.path);
    return true;
  }
  recursiveCheckOwners(outrec, polypath) {
    if (outrec.polypath !== null || Rect64Utils.isEmpty(outrec.bounds))
      return;
    while (outrec.owner !== null) {
      if (outrec.owner.splits !== null && this.checkSplitOwner(outrec, outrec.owner.splits))
        break;
      if (outrec.owner.pts !== null && this.checkBounds(outrec.owner) && // Fast reject: a container must contain the child's bounds.
      this.containsRect(outrec.owner.bounds, outrec.bounds) && this.path1InsidePath2(outrec.pts, outrec.owner.pts))
        break;
      outrec.owner = outrec.owner.owner;
    }
    if (outrec.owner !== null) {
      if (outrec.owner.polypath === null) {
        this.recursiveCheckOwners(outrec.owner, polypath);
      }
      outrec.polypath = outrec.owner.polypath.addChild(outrec.path);
    } else {
      outrec.polypath = polypath.addChild(outrec.path);
    }
  }
  cleanCollinear(outrec) {
    outrec = this.getRealOutRec(outrec);
    if (outrec === null || outrec.isOpen)
      return;
    if (!this.isValidClosedPath(outrec.pts)) {
      outrec.pts = null;
      return;
    }
    let startOp = outrec.pts;
    let op2 = startOp;
    while (true) {
      if (op2 !== null && InternalClipper.isCollinear(op2.prev.pt, op2.pt, op2.next.pt) && (op2.pt.x === op2.prev.pt.x && op2.pt.y === op2.prev.pt.y || op2.pt.x === op2.next.pt.x && op2.pt.y === op2.next.pt.y || !this.preserveCollinear || InternalClipper.dotProductSign(op2.prev.pt, op2.pt, op2.next.pt) < 0)) {
        if (op2 === outrec.pts) {
          outrec.pts = op2.prev;
        }
        op2 = this.disposeOutPt(op2);
        if (!this.isValidClosedPath(op2)) {
          outrec.pts = null;
          return;
        }
        startOp = op2;
        continue;
      }
      if (op2 === null)
        break;
      op2 = op2.next;
      if (op2 === startOp)
        break;
    }
    this.fixSelfIntersects(outrec);
  }
  isValidClosedPath(op) {
    return op !== null && op.next !== op && (op.next !== op.prev || !_ClipperBase.isVerySmallTriangle(op));
  }
  disposeOutPt(op) {
    const result = op.next === op ? null : op.next;
    op.prev.next = op.next;
    op.next.prev = op.prev;
    return result;
  }
  fixSelfIntersects(outrec) {
    let op2 = outrec.pts;
    if (op2.prev === op2.next.next) {
      return;
    }
    while (true) {
      if (op2.next && op2.next.next && this.boundingBoxesOverlap(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt) && InternalClipper.segsIntersect(op2.prev.pt, op2.pt, op2.next.pt, op2.next.next.pt)) {
        if (op2 === outrec.pts || op2.next === outrec.pts) {
          outrec.pts = outrec.pts.prev;
        }
        this.doSplitOp(outrec, op2);
        if (outrec.pts === null)
          return;
        op2 = outrec.pts;
        if (op2.prev === op2.next.next)
          break;
        continue;
      }
      op2 = op2.next;
      if (op2 === outrec.pts)
        break;
    }
  }
  doSplitOp(outrec, splitOp) {
    const prevOp = splitOp.prev;
    const nextNextOp = splitOp.next.next;
    outrec.pts = prevOp;
    const ip = InternalClipper.getLineIntersectPt(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt);
    if (this.zCallbackInternal) {
      this.zCallbackInternal(prevOp.pt, splitOp.pt, splitOp.next.pt, nextNextOp.pt, ip);
    }
    const doubleArea1 = _ClipperBase.areaOutPt(prevOp);
    const absDoubleArea1 = doubleArea1 < B0 ? -doubleArea1 : doubleArea1;
    if (absDoubleArea1 < B4) {
      outrec.pts = null;
      return;
    }
    const doubleArea2 = this.areaTriangle(ip, splitOp.pt, splitOp.next.pt);
    const absDoubleArea2 = doubleArea2 < B0 ? -doubleArea2 : doubleArea2;
    if (ip.x === prevOp.pt.x && ip.y === prevOp.pt.y || ip.x === nextNextOp.pt.x && ip.y === nextNextOp.pt.y) {
      nextNextOp.prev = prevOp;
      prevOp.next = nextNextOp;
    } else {
      const newOp2 = new OutPt(ip, outrec);
      newOp2.prev = prevOp;
      newOp2.next = nextNextOp;
      nextNextOp.prev = newOp2;
      prevOp.next = newOp2;
    }
    if (!(absDoubleArea2 > B2) || // area > 1
    !(absDoubleArea2 > absDoubleArea1) && doubleArea2 > B0 !== doubleArea1 > B0)
      return;
    const newOutRec = this.newOutRec();
    newOutRec.owner = outrec.owner;
    splitOp.outrec = newOutRec;
    splitOp.next.outrec = newOutRec;
    const newOp = new OutPt(ip, newOutRec);
    newOp.prev = splitOp.next;
    newOp.next = splitOp;
    newOutRec.pts = newOp;
    splitOp.prev = newOp;
    splitOp.next.next = newOp;
    if (!this.usingPolytree)
      return;
    if (this.path1InsidePath2(prevOp, newOp)) {
      if (newOutRec.splits === null)
        newOutRec.splits = [];
      newOutRec.splits.push(outrec.idx);
    } else {
      if (outrec.splits === null)
        outrec.splits = [];
      outrec.splits.push(newOutRec.idx);
    }
  }
  static areaOutPt(op) {
    const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
    let area = 0;
    let allSmall = true;
    let op2 = op;
    do {
      const prev = op2.prev;
      const pt = op2.pt;
      if (Math.abs(prev.pt.x) >= maxCoord || Math.abs(prev.pt.y) >= maxCoord || Math.abs(pt.x) >= maxCoord || Math.abs(pt.y) >= maxCoord) {
        allSmall = false;
        break;
      }
      area += (prev.pt.y + pt.y) * (prev.pt.x - pt.x);
      op2 = op2.next;
    } while (op2 !== op);
    if (allSmall) {
      return BigInt(Math.round(area));
    }
    let areaBig = B0;
    op2 = op;
    do {
      const prev = op2.prev;
      if (Number.isSafeInteger(prev.pt.y) && Number.isSafeInteger(op2.pt.y) && Number.isSafeInteger(prev.pt.x) && Number.isSafeInteger(op2.pt.x)) {
        const sumBig = BigInt(prev.pt.y) + BigInt(op2.pt.y);
        const diffBig = BigInt(prev.pt.x) - BigInt(op2.pt.x);
        areaBig += sumBig * diffBig;
      } else {
        const sum = prev.pt.y + op2.pt.y;
        const diff = prev.pt.x - op2.pt.x;
        areaBig += BigInt(Math.round(sum * diff));
      }
      op2 = op2.next;
    } while (op2 !== op);
    return areaBig;
  }
  areaTriangle(pt1, pt2, pt3) {
    const maxCoord = InternalClipper.maxCoordForSafeAreaProduct;
    if (Math.abs(pt1.x) < maxCoord && Math.abs(pt1.y) < maxCoord && Math.abs(pt2.x) < maxCoord && Math.abs(pt2.y) < maxCoord && Math.abs(pt3.x) < maxCoord && Math.abs(pt3.y) < maxCoord) {
      const area2 = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
      return BigInt(Math.round(area2));
    }
    if (Number.isSafeInteger(pt1.x) && Number.isSafeInteger(pt1.y) && Number.isSafeInteger(pt2.x) && Number.isSafeInteger(pt2.y) && Number.isSafeInteger(pt3.x) && Number.isSafeInteger(pt3.y)) {
      const term1 = (BigInt(pt3.y) + BigInt(pt1.y)) * (BigInt(pt3.x) - BigInt(pt1.x));
      const term2 = (BigInt(pt1.y) + BigInt(pt2.y)) * (BigInt(pt1.x) - BigInt(pt2.x));
      const term3 = (BigInt(pt2.y) + BigInt(pt3.y)) * (BigInt(pt2.x) - BigInt(pt3.x));
      return term1 + term2 + term3;
    }
    const area = (pt3.y + pt1.y) * (pt3.x - pt1.x) + (pt1.y + pt2.y) * (pt1.x - pt2.x) + (pt2.y + pt3.y) * (pt2.x - pt3.x);
    return BigInt(Math.round(area));
  }
  isValidOwner(outRec, testOwner) {
    while (testOwner !== null && testOwner !== outRec) {
      testOwner = testOwner.owner;
    }
    return testOwner === null;
  }
  containsRect(rect, rec) {
    return rec.left >= rect.left && rec.right <= rect.right && rec.top >= rect.top && rec.bottom <= rect.bottom;
  }
  checkSplitOwner(outrec, splits) {
    for (let i = 0; i < splits.length; i++) {
      let split = this.outrecList[splits[i]];
      if (split.pts === null && split.splits !== null && this.checkSplitOwner(outrec, split.splits))
        return true;
      split = this.getRealOutRec(split);
      if (split === null || split === outrec || split.recursiveSplit === outrec)
        continue;
      split.recursiveSplit = outrec;
      if (split.splits !== null && this.checkSplitOwner(outrec, split.splits))
        return true;
      if (!this.checkBounds(split) || !this.containsRect(split.bounds, outrec.bounds) || !this.path1InsidePath2(outrec.pts, split.pts))
        continue;
      if (!this.isValidOwner(outrec, split)) {
        split.owner = outrec.owner;
      }
      outrec.owner = split;
      return true;
    }
    return false;
  }
};
// When there are no open paths, a lot of open-path branching becomes dead code.
// We set this per execute to allow fast short-circuiting in hot helpers.
__publicField(_ClipperBase, "openPathsEnabled", true);
let ClipperBase = _ClipperBase;
class Clipper64 extends ClipperBase {
  constructor() {
    super(...arguments);
    __publicField(this, "zCallback");
  }
  getZCallback() {
    return this.zCallback;
  }
  addPath(path, polytype, isOpen = false) {
    super.addPath(path, polytype, isOpen);
  }
  addReuseableData(reuseableData) {
    super.addReuseableData(reuseableData);
  }
  addPaths(paths, polytype, isOpen = false) {
    super.addPaths(paths, polytype, isOpen);
  }
  addSubject(paths) {
    this.addPaths(paths, PathType.Subject);
  }
  addOpenSubject(paths) {
    this.addPaths(paths, PathType.Subject, true);
  }
  addClip(paths) {
    this.addPaths(paths, PathType.Clip);
  }
  execute(clipType, fillRule, solutionOrTree, openPathsOrSolutionOpen) {
    if (Array.isArray(solutionOrTree)) {
      const solutionClosed = solutionOrTree;
      const solutionOpen = openPathsOrSolutionOpen;
      solutionClosed.length = 0;
      if (solutionOpen)
        solutionOpen.length = 0;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildPaths(solutionClosed, solutionOpen || []);
      } catch {
        this.succeeded = false;
      }
      this.clearSolutionOnly();
      return this.succeeded;
    } else {
      const polytree = solutionOrTree;
      const openPaths = openPathsOrSolutionOpen;
      polytree.clear();
      if (openPaths)
        openPaths.length = 0;
      this.usingPolytree = true;
      try {
        this.executeInternal(clipType, fillRule);
        this.buildTree(polytree, openPaths || []);
      } catch {
        this.succeeded = false;
      }
      this.clearSolutionOnly();
      return this.succeeded;
    }
  }
}
BigInt(2);
function union$2(subject, clipOrFillRule, fillRule) {
  if (typeof clipOrFillRule === "number") {
    return booleanOp(ClipType.Union, subject, null, clipOrFillRule);
  } else {
    return booleanOp(ClipType.Union, subject, clipOrFillRule, fillRule);
  }
}
function booleanOp(clipType, subject, clip, fillRule) {
  const solution = [];
  if (subject === null)
    return solution;
  const c = new Clipper64();
  c.addPaths(subject, PathType.Subject);
  if (clip !== null) {
    c.addPaths(clip, PathType.Clip);
  }
  c.execute(clipType, fillRule, solution);
  return solution;
}
function normalizeHatchRegion(hatch, tolerance) {
  const safeTolerance = Math.max(1e-9, tolerance);
  const contours = [];
  for (const path of hatch.boundaryPaths) {
    const segments = [];
    for (const edge of path.edges) {
      const points = flattenHatchEdge(edge, safeTolerance);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        if (Math.hypot(end[0] - start[0], end[1] - start[1]) > safeTolerance) segments.push({ start, end });
      }
    }
    const assembled = assembleContours(segments, safeTolerance);
    if (!assembled) return { status: "invalid", code: "HATCH_BOUNDARY_OPEN" };
    contours.push(...assembled);
  }
  if (contours.length === 0) return { status: "invalid", code: "HATCH_BOUNDARY_EMPTY" };
  const largest = Math.max(...contours.flatMap((contour) => contour.flatMap(([x, y]) => [Math.abs(x), Math.abs(y)])), 1);
  const requestedScale = Math.max(1, Math.ceil(1 / safeTolerance));
  const maxScale = Math.floor(Number.MAX_SAFE_INTEGER / 1024 / largest);
  const scale2 = Math.min(requestedScale, maxScale);
  if (!(scale2 >= 1)) return { status: "invalid", code: "HATCH_COORDINATE_OVERFLOW" };
  try {
    const paths = contours.map((contour) => contour.map(([x, y]) => ({ x: Math.round(x * scale2), y: Math.round(y * scale2) })));
    const normalized = union$2(paths, FillRule.EvenOdd).map((path) => path.map(({ x, y }) => [x / scale2, y / scale2])).filter((path) => path.length >= 3);
    if (normalized.length === 0) return { status: "invalid", code: "HATCH_BOUNDARY_EMPTY" };
    const selected = selectByStyle(normalized, hatch.style);
    return {
      status: "ok",
      region: { contours: selected, fillRule: hatch.style === "normal" ? "evenodd" : "nonzero", bounds: boundsOf$1(selected) }
    };
  } catch {
    return { status: "invalid", code: "HATCH_COORDINATE_OVERFLOW" };
  }
}
function assembleContours(segments, tolerance) {
  if (segments.length < 3) return null;
  const key = ([x, y]) => `${Math.round(x / tolerance)},${Math.round(y / tolerance)}`;
  const incidence = /* @__PURE__ */ new Map();
  segments.forEach((segment, index) => {
    for (const point of [segment.start, segment.end]) {
      const bucket = incidence.get(key(point)) ?? [];
      bucket.push(index);
      incidence.set(key(point), bucket);
    }
  });
  if ([...incidence.values()].some((indices) => indices.length !== 2)) return null;
  const unused = new Set(segments.map((_, index) => index));
  const contours = [];
  while (unused.size > 0) {
    const firstIndex = unused.values().next().value;
    const first = segments[firstIndex];
    unused.delete(firstIndex);
    const contour = [first.start, first.end];
    const startKey = key(first.start);
    let currentKey = key(first.end);
    while (currentKey !== startKey) {
      const nextIndex = (incidence.get(currentKey) ?? []).find((index) => unused.has(index));
      if (nextIndex === void 0) return null;
      const next = segments[nextIndex];
      unused.delete(nextIndex);
      const nextPoint = key(next.start) === currentKey ? next.end : next.start;
      contour.push(nextPoint);
      currentKey = key(nextPoint);
      if (contour.length > segments.length + 1) return null;
    }
    contour.pop();
    if (contour.length < 3) return null;
    contours.push(contour);
  }
  return contours;
}
function selectByStyle(contours, style) {
  if (style === "normal") return contours;
  const depths = contours.map((contour, index) => contours.reduce((depth, candidate, candidateIndex) => candidateIndex !== index && pointInPolygon$1(contour[0], candidate) ? depth + 1 : depth, 0));
  if (style === "outer") return contours.filter((_, index) => (depths[index] ?? 0) <= 1);
  return contours.filter((_, index) => (depths[index] ?? 0) === 0);
}
function pointInPolygon$1(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[index];
    const b = polygon[previous];
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function boundsOf$1(contours) {
  const points = contours.flat();
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
const MAX_HATCH_RENDER_LINES = 2e4;
function createHatchRenderPlan(hatch, tolerance) {
  const normalized = normalizeHatchRegion(hatch, tolerance);
  if (normalized.status !== "ok") return normalized;
  const lines = [];
  for (const family of hatch.patternLines) {
    const generated = generateFamily(transformPatternFamily(family, hatch.patternAngle, hatch.patternScale), normalized.region);
    if (lines.length + generated.length > MAX_HATCH_RENDER_LINES) {
      return { status: "invalid", code: "HATCH_PATTERN_DENSITY_LIMIT" };
    }
    lines.push(...generated);
  }
  return { status: "ok", plan: { region: normalized.region, lines } };
}
function transformPatternFamily(family, angleDegrees, scale2) {
  const angle = angleDegrees * Math.PI / 180;
  const rotateScale = ([x, y]) => [
    scale2 * (x * Math.cos(angle) - y * Math.sin(angle)),
    scale2 * (x * Math.sin(angle) + y * Math.cos(angle))
  ];
  return {
    angle: family.angle + angleDegrees,
    base: rotateScale(family.base),
    offset: rotateScale(family.offset),
    dashLengths: family.dashLengths.map((value2) => value2 * scale2)
  };
}
function generateFamily(family, region) {
  const angle = family.angle * Math.PI / 180;
  const direction = [Math.cos(angle), Math.sin(angle)];
  const normal = [-direction[1], direction[0]];
  const spacing = dot$1(family.offset, normal);
  if (Math.abs(spacing) <= 1e-12) return [];
  const corners = [
    [region.bounds.minX, region.bounds.minY],
    [region.bounds.maxX, region.bounds.minY],
    [region.bounds.maxX, region.bounds.maxY],
    [region.bounds.minX, region.bounds.maxY]
  ];
  const cornerProjections = corners.map((point) => dot$1(point, normal));
  const baseProjection = dot$1(family.base, normal);
  const minIndex = Math.floor((Math.min(...cornerProjections) - baseProjection) / spacing) - 1;
  const maxIndex = Math.ceil((Math.max(...cornerProjections) - baseProjection) / spacing) + 1;
  const first = Math.min(minIndex, maxIndex);
  const last = Math.max(minIndex, maxIndex);
  const diagonal = Math.hypot(region.bounds.maxX - region.bounds.minX, region.bounds.maxY - region.bounds.minY);
  const alongProjections = corners.map((point) => dot$1(point, direction));
  const minimumAlong = Math.min(...alongProjections) - Math.max(1, diagonal * 0.01);
  const maximumAlong = Math.max(...alongProjections) + Math.max(1, diagonal * 0.01);
  const result = [];
  for (let index = first; index <= last; index += 1) {
    const origin = [family.base[0] + family.offset[0] * index, family.base[1] + family.offset[1] * index];
    const originAlong = dot$1(origin, direction);
    const startDistance = minimumAlong - originAlong;
    const endDistance = maximumAlong - originAlong;
    result.push({
      start: [origin[0] + direction[0] * startDistance, origin[1] + direction[1] * startDistance],
      end: [origin[0] + direction[0] * endDistance, origin[1] + direction[1] * endDistance],
      dashArray: family.dashLengths.map(Math.abs),
      dashOffset: startDistance
    });
  }
  return result;
}
function dot$1(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
function transformParametricHatch(hatch, transform2) {
  const vector = (point2) => rotate$1(point2, transform2.rotationRadians);
  const point = (value2) => {
    const relative = [value2[0] - transform2.pivot[0], value2[1] - transform2.pivot[1]];
    const rotated = vector(relative);
    return [rotated[0] + transform2.pivot[0] + transform2.translation[0], rotated[1] + transform2.pivot[1] + transform2.translation[1]];
  };
  const edge = (value2) => {
    var _a3;
    if (value2.type === "line") return { ...value2, start: point(value2.start), end: point(value2.end) };
    if (value2.type === "arc") return {
      ...value2,
      center: point(value2.center),
      startAngle: value2.startAngle + radiansToDegrees(transform2.rotationRadians),
      endAngle: value2.endAngle + radiansToDegrees(transform2.rotationRadians)
    };
    if (value2.type === "ellipse") return { ...value2, center: point(value2.center), majorAxis: vector(value2.majorAxis) };
    return { ...value2, controlPoints: value2.controlPoints.map(point), fitPoints: (_a3 = value2.fitPoints) == null ? void 0 : _a3.map(point) };
  };
  return {
    ...hatch,
    boundaryPaths: hatch.boundaryPaths.map((path) => ({ ...path, edges: path.edges.map(edge) })),
    patternLines: hatch.patternLines.map((line2) => ({
      ...line2,
      angle: line2.angle + radiansToDegrees(transform2.rotationRadians),
      base: point(line2.base),
      offset: vector(line2.offset)
    })),
    patternAngle: hatch.patternAngle + radiansToDegrees(transform2.rotationRadians)
  };
}
function rotate$1([x, y], radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine];
}
function radiansToDegrees(value2) {
  return value2 * 180 / Math.PI;
}
function applyDrawingTransaction(source, commands, now) {
  const document = structuredClone(source);
  for (const command of commands) applyCommand$1(document, command);
  validateDocument$2(document);
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
  for (const [key, value2] of Object.entries(command.changes)) node[key] = structuredClone(value2);
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
function validateDocument$2(document) {
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
function finitePoint(value2, code) {
  const point = [Number(value2[0]), Number(value2[1])];
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
  const before = {};
  const after = {};
  if (node.hatch !== void 0) {
    before.hatch = node.hatch;
    after.hatch = transformParametricHatch(node.hatch, transform2);
  }
  if (node.segments !== void 0) {
    before.segments = node.segments;
    after.segments = node.segments.map((segment) => ({
      start: transformPoint(segment.start, transform2),
      end: transformPoint(segment.end, transform2)
    }));
  }
  return pair(before, after);
}
function pair(before, after) {
  return { before: structuredClone(before), after };
}
function transformPoint(point, transform2) {
  const relative = [point[0] - transform2.pivot[0], point[1] - transform2.pivot[1]];
  const rotated = rotate(relative, transform2.rotationRadians);
  return cleanPoint$2([
    rotated[0] + transform2.pivot[0] + transform2.translation[0],
    rotated[1] + transform2.pivot[1] + transform2.translation[1]
  ]);
}
function rotate(vector, radians) {
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return cleanPoint$2([vector[0] * cosine - vector[1] * sine, vector[0] * sine + vector[1] * cosine]);
}
function cleanPoint$2(point) {
  return [clean$2(point[0]), clean$2(point[1])];
}
function clean$2(value2) {
  const result = Math.abs(value2) < 1e-12 ? 0 : Number(value2.toFixed(12));
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
function compileMultiPartTransform(input) {
  if (input.baseRef.drawingId !== input.document.id) throw new Error("EDIT_DRAWING_MISMATCH");
  if (input.parts.length < 2 || input.parts.length > 16) throw new Error("EDIT_PART_COUNT_INVALID");
  assertPartScopes(input.document, input.parts);
  const initial = structuredClone(input.document);
  let working = structuredClone(input.document);
  const forward = [];
  const diagnostics = [];
  const effects = [];
  for (const part of input.parts) {
    const compiled = compileSpatialEditProgram({
      document: working,
      program: programForPart(input, part),
      grounding: part.grounding,
      ports: input.ports
    });
    working = compiled.candidate;
    forward.push(...compiled.forward);
    diagnostics.push(...compiled.diagnostics);
    effects.push(compiled.actualEffect);
  }
  const inverse = invertDrawingTransaction(initial, forward);
  const restored = applyDrawingTransaction(working, inverse, input.ports.now());
  if (canonicalSemanticString(restored) !== canonicalSemanticString(initial)) {
    throw new Error("EDIT_INVERSE_VERIFICATION_FAILED");
  }
  const actualEffect = mergeEffects(effects);
  const effectDigest = input.ports.digest(canonicalString(actualEffect));
  const semanticParts = input.parts.map((part) => ({
    translation: structuredClone(part.translation),
    ...part.rotationRadians === void 0 ? {} : {
      rotationRadians: part.rotationRadians,
      pivot: structuredClone(part.pivot)
    },
    targetScope: [...part.grounding.targetNodeIds].sort(),
    interfaceScopes: part.grounding.interfaces.map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint })).sort((left, right) => left.interfaceId.localeCompare(right.interfaceId))
  }));
  const candidateDigest = input.ports.digest(canonicalString({
    baseRef: input.baseRef,
    resultingSemanticDocument: JSON.parse(canonicalSemanticString(working)),
    effectDigest,
    forward,
    inverse,
    parts: semanticParts
  }));
  const semanticRiskKey = input.ports.digest(canonicalString({
    baseRef: input.baseRef,
    resultingSemanticDigest: input.ports.digest(canonicalSemanticString(working)),
    effectDigest,
    authoritativeObjective: input.objective,
    partScopes: semanticParts.map(({ targetScope, interfaceScopes }) => ({ targetScope, interfaceScopes }))
  }));
  return {
    forward,
    inverse,
    candidate: working,
    actualEffect,
    diagnostics,
    candidateDigest,
    effectDigest,
    semanticRiskKey
  };
}
function assertPartScopes(document, parts) {
  const groundingIds = /* @__PURE__ */ new Set();
  const targetNodeIds = /* @__PURE__ */ new Set();
  const endpointSlots = /* @__PURE__ */ new Set();
  for (const part of parts) {
    if (groundingIds.has(part.groundingId)) throw new Error("EDIT_GROUNDING_DUPLICATE");
    groundingIds.add(part.groundingId);
    if (part.rotationRadians === void 0 !== (part.pivot === void 0)) {
      throw new Error("EDIT_ROTATION_PIVOT_PAIR_REQUIRED");
    }
    if (![...part.translation, ...part.pivot ?? [], part.rotationRadians ?? 0].every(Number.isFinite)) {
      throw new Error("EDIT_TRANSFORM_INVALID");
    }
    for (const nodeId of part.grounding.targetNodeIds) {
      if (!findDrawingNode(document, nodeId)) throw new Error("EDIT_TARGET_UNRESOLVED");
      if (targetNodeIds.has(nodeId)) throw new Error("EDIT_PART_TARGET_OVERLAP");
      targetNodeIds.add(nodeId);
    }
    for (const port of part.grounding.interfaces) {
      if (!port.endpoint || !findDrawingNode(document, port.nodeId)) {
        throw new Error("EDIT_INTERFACE_UNRESOLVED");
      }
      const slot = `${port.nodeId}:${port.endpoint}`;
      if (endpointSlots.has(slot)) throw new Error("EDIT_PART_INTERFACE_CONFLICT");
      endpointSlots.add(slot);
    }
  }
}
function programForPart(input, part) {
  const target = part.grounding.targetNodeIds.length === 1 ? findDrawingNode(input.document, part.grounding.targetNodeIds[0]) : null;
  const connectedCarrier = (target == null ? void 0 : target.plane) === "geometry" && (target.node.type === "circle" || target.node.type === "ellipse");
  const connected = connectedCarrier || part.grounding.interfaces.length > 0;
  const operation = connected ? {
    kind: "connected_transform",
    translation: [...part.translation],
    ...part.rotationRadians === void 0 && connectedCarrier ? {} : {
      rotationRadians: part.rotationRadians ?? 0,
      pivot: [...part.pivot ?? [0, 0]]
    },
    interfaceIds: part.grounding.interfaces.map(({ interfaceId }) => interfaceId)
  } : {
    kind: "rigid_transform",
    translation: [...part.translation],
    rotationRadians: part.rotationRadians ?? 0,
    pivot: [...part.pivot ?? [0, 0]]
  };
  return {
    baseRef: structuredClone(input.baseRef),
    targetHandle: part.grounding.targetHandle,
    summary: input.summary,
    objective: input.objective,
    operations: [operation],
    preserveScopes: [],
    postconditions: [],
    evidenceRefs: [`grounding:${part.groundingId}`]
  };
}
function mergeEffects(effects) {
  const createdNodeIds = /* @__PURE__ */ new Set();
  const updatedNodeIds = /* @__PURE__ */ new Set();
  const deletedNodeIds = /* @__PURE__ */ new Set();
  const changedFields = /* @__PURE__ */ new Map();
  for (const effect of effects) {
    effect.createdNodeIds.forEach((id) => createdNodeIds.add(id));
    effect.updatedNodeIds.forEach((id) => updatedNodeIds.add(id));
    effect.deletedNodeIds.forEach((id) => deletedNodeIds.add(id));
    for (const [id, fields] of Object.entries(effect.changedFields)) {
      const aggregate = changedFields.get(id) ?? /* @__PURE__ */ new Set();
      fields.forEach((field) => aggregate.add(field));
      changedFields.set(id, aggregate);
    }
  }
  return {
    createdNodeIds: [...createdNodeIds].sort(),
    updatedNodeIds: [...updatedNodeIds].sort(),
    deletedNodeIds: [...deletedNodeIds].sort(),
    changedFields: Object.fromEntries([...changedFields.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([id, fields]) => [id, [...fields].sort()]))
  };
}
function resolveTranslationMotionRig(document, selectedNodeIds) {
  var _a3;
  const selected = [...new Set(selectedNodeIds)];
  if (selected.length === 0) throw new Error("MOTION_RIG_SELECTION_REQUIRED");
  const visibleGeometry = new Map(document.geometry.filter(({ visible }) => visible).map((node) => [String(node.id), node]));
  if (selected.some((id) => !visibleGeometry.has(id))) throw new Error("MOTION_RIG_SELECTION_INVALID");
  const tolerance = drawingTolerance(document);
  const candidates = selected.flatMap((id) => {
    const node = visibleGeometry.get(id);
    if (!node || node.type !== "circle" && node.type !== "ellipse") return [];
    const contacts2 = connectorContacts(document, node, tolerance);
    return contacts2.length === 0 ? [] : [{ carrier: node, contacts: contacts2 }];
  }).sort((left, right) => right.contacts.length - left.contacts.length || String(left.carrier.id).localeCompare(String(right.carrier.id)));
  if (candidates.length === 0) throw new Error("MOTION_RIG_INVALID");
  if (((_a3 = candidates[1]) == null ? void 0 : _a3.contacts.length) === candidates[0].contacts.length) {
    throw new Error("MOTION_RIG_AMBIGUOUS");
  }
  const { carrier, contacts } = candidates[0];
  const unsupported = contacts.find(({ node }) => node.type === "arc");
  if (unsupported) throw new Error("MOTION_RIG_GEOMETRY_UNSUPPORTED");
  const connectorIds = new Set(contacts.map(({ node }) => String(node.id)));
  const controlBodyNodeIds = selected.filter((id) => !connectorIds.has(id)).sort();
  if (!controlBodyNodeIds.includes(String(carrier.id))) controlBodyNodeIds.push(String(carrier.id));
  controlBodyNodeIds.sort();
  const connectors = contacts.map(({ node, movingEndpoint: movingEndpoint2, fixedPoint }) => ({
    nodeId: String(node.id),
    movingEndpoint: movingEndpoint2,
    fixedPoint: cleanPoint$1(fixedPoint)
  })).sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  const anchor = cleanPoint$1([
    connectors.reduce((sum, connector) => sum + connector.fixedPoint[0], 0) / connectors.length,
    connectors.reduce((sum, connector) => sum + connector.fixedPoint[1], 0) / connectors.length
  ]);
  return {
    carrierNodeId: String(carrier.id),
    controlBodyNodeIds,
    connectors,
    anchor,
    handle: cleanPoint$1(carrier.center),
    keepAnchorFixed: true,
    keepControlBodyRigid: true,
    preserveConnectivity: true,
    allowControlRotation: false
  };
}
function connectorContacts(document, carrier, tolerance) {
  return document.geometry.flatMap((node) => {
    if (node.id === carrier.id || !node.visible) return [];
    const endpoints = connectorEndpoints(node);
    if (!endpoints) return [];
    const startContact = onCarrier(carrier, endpoints.start, tolerance);
    const endContact = onCarrier(carrier, endpoints.end, tolerance);
    if (startContact === endContact) return [];
    return [startContact ? { node, movingEndpoint: endpoints.startRole, movingPoint: endpoints.start, fixedPoint: endpoints.end } : { node, movingEndpoint: endpoints.endRole, movingPoint: endpoints.end, fixedPoint: endpoints.start }];
  });
}
function connectorEndpoints(node) {
  if (node.type === "line") return { start: node.start, end: node.end, startRole: "start", endRole: "end" };
  if (node.type === "polyline" && !node.closed && node.vertices.length >= 2) return {
    start: node.vertices[0].point,
    end: node.vertices[node.vertices.length - 1].point,
    startRole: "first",
    endRole: "last"
  };
  if (node.type === "spline" && !node.closed && node.controlPoints.length >= 2) return {
    start: node.controlPoints[0],
    end: node.controlPoints[node.controlPoints.length - 1],
    startRole: "first",
    endRole: "last"
  };
  if (node.type === "arc") return {
    start: arcPoint(node, node.startAngle),
    end: arcPoint(node, node.endAngle),
    startRole: "start",
    endRole: "end"
  };
  return null;
}
function onCarrier(carrier, point, tolerance) {
  if (carrier.type === "circle") return Math.abs(distance$2(carrier.center, point) - carrier.radius) <= tolerance;
  const majorLength = Math.hypot(...carrier.majorAxis);
  if (!(majorLength > 1e-12) || !(carrier.ratio > 0)) return false;
  const ux = carrier.majorAxis[0] / majorLength;
  const uy = carrier.majorAxis[1] / majorLength;
  const dx = point[0] - carrier.center[0];
  const dy = point[1] - carrier.center[1];
  const normalized = Math.hypot((dx * ux + dy * uy) / majorLength, (-dx * uy + dy * ux) / (majorLength * carrier.ratio));
  return Math.abs(normalized - 1) * majorLength <= tolerance;
}
function drawingTolerance(document) {
  const points = document.geometry.flatMap((node) => geometryPoints(node));
  if (points.length === 0) return 1e-6;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return Math.max(
    Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * 25e-4,
    1e-6
  );
}
function geometryPoints(node) {
  if (node.type === "point") return [[node.x, node.y]];
  if (node.type === "line") return [node.start, node.end];
  if (node.type === "ray" || node.type === "xline") return [node.origin];
  if (node.type === "circle" || node.type === "arc" || node.type === "ellipse") return [node.center];
  if (node.type === "polyline") return node.vertices.map(({ point }) => point);
  return [...node.controlPoints];
}
function arcPoint(node, degrees2) {
  const radians = degrees2 * Math.PI / 180;
  return cleanPoint$1([node.center[0] + Math.cos(radians) * node.radius, node.center[1] + Math.sin(radians) * node.radius]);
}
function distance$2(left, right) {
  return Math.hypot(left[0] - right[0], left[1] - right[1]);
}
function cleanPoint$1(point) {
  return [clean$1(point[0]), clean$1(point[1])];
}
function clean$1(value2) {
  const rounded = Number(value2.toFixed(9));
  return Object.is(rounded, -0) ? 0 : rounded;
}
const MAGNITUDE_RATIO = {
  minimum: 0.02,
  slight: 0.05,
  moderate: 0.12,
  strong: 0.22
};
const SOLVER_VERSION = "spatial-intent-solver-0.1.0";
const MAX_CANDIDATES = 256;
const EPSILON$1 = 1e-7;
class SpatialIntentValidationError extends Error {
  constructor(code, details) {
    super(code);
    __publicField(this, "name", "SpatialIntentValidationError");
    this.code = code;
    Object.assign(this, structuredClone(details));
  }
}
function solveSpatialIntent(input) {
  validateInput(input);
  if (input.intent.goals.every(({ kind }) => kind === "topology") && topologyPenaltyFor(input, input.document) === 0) {
    throw new Error("EDIT_SPATIAL_ALREADY_SATISFIED");
  }
  const scale2 = drawingDiagonal(input.document);
  const primary = solvePrimaryTransforms(input, scale2);
  const candidates = generateCandidateTransforms(input, primary, scale2).slice(0, MAX_CANDIDATES);
  const viable = [];
  for (const transforms of candidates) {
    try {
      const compilation = compileTransforms(input, transforms);
      const topologyPenalty = topologyPenaltyFor(input, compilation.candidate);
      const collisionPenalty = collisionPenaltyFor(input, compilation.candidate);
      if (topologyPenalty > EPSILON$1) continue;
      assertProtectedScope(input, compilation.candidate);
      const assessedCompilation = collisionPenalty > EPSILON$1 ? {
        ...compilation,
        diagnostics: [...compilation.diagnostics, {
          code: "SPATIAL_COLLISION_CANDIDATE",
          severity: "warning",
          message: "The solved spatial intent introduces new geometric overlap and requires review.",
          facts: { collisionCount: collisionPenalty },
          hard: false
        }]
      } : compilation;
      viable.push({
        compilation: assessedCompilation,
        transforms,
        goalResidual: goalResidualFor(input, compilation.candidate, transforms, scale2),
        movementCost: movementCostFor(transforms, scale2),
        deformationCost: deformationCostFor(transforms),
        collisionPenalty,
        topologyPenalty,
        key: canonicalString(canonicalTransforms(transforms))
      });
    } catch {
    }
  }
  viable.sort((left, right) => left.goalResidual - right.goalResidual || left.collisionPenalty - right.collisionPenalty || left.topologyPenalty - right.topologyPenalty || left.movementCost - right.movementCost || left.deformationCost - right.deformationCost || left.key.localeCompare(right.key));
  const selected = viable[0];
  if (!selected || selected.goalResidual > 1e-5) throw new Error("EDIT_SPATIAL_NO_SOLUTION");
  return {
    ...selected.compilation,
    solver: {
      version: SOLVER_VERSION,
      candidateCount: candidates.length,
      selectedRank: 0,
      goalResidual: selected.goalResidual,
      movementCost: selected.movementCost,
      deformationCost: selected.deformationCost,
      collisionPenalty: selected.collisionPenalty,
      topologyPenalty: selected.topologyPenalty,
      solvedTransforms: canonicalTransforms(selected.transforms),
      inputsContainModelCoordinates: false
    }
  };
}
function validateInput(input) {
  if (input.baseRef.drawingId !== input.document.id) throw new Error("EDIT_DRAWING_MISMATCH");
  const partKeys = Object.keys(input.parts);
  if (partKeys.length < 1 || partKeys.length > 16) throw new Error("EDIT_PART_COUNT_INVALID");
  const fragmented = findFragmentedArticulatedSelection(input.document, input.parts);
  if (fragmented) {
    throw new SpatialIntentValidationError("EDIT_ARTICULATED_SELECTION_FRAGMENTED", fragmented);
  }
  const usedPartKeys = new Set(input.intent.goals.flatMap((goal) => [
    goal.subject,
    ..."reference" in goal && goal.reference.kind === "part" ? [goal.reference.partKey] : []
  ]));
  for (const preserve of input.intent.preserve) {
    if (preserve.kind === "anchor" && preserve.reference.kind === "part") {
      usedPartKeys.add(preserve.reference.partKey);
    }
  }
  const unusedPartKeys = [...new Set(input.intent.preserve.flatMap((preserve) => "partKey" in preserve && preserve.partKey !== void 0 && input.parts[preserve.partKey] !== void 0 && !usedPartKeys.has(preserve.partKey) ? [preserve.partKey] : []))].sort();
  if (unusedPartKeys.length > 0) {
    throw new SpatialIntentValidationError("EDIT_SELECTED_PART_UNUSED", { unusedPartKeys });
  }
  const articulationByPart = Object.fromEntries(Object.entries(input.parts).map(([partKey, target]) => [partKey, analyzeArticulatedGrounding(input.document, target)]));
  if (Object.values(articulationByPart).some(({ kind }) => kind === "resolved")) {
    const unexpectedPartKeys = Object.entries(articulationByPart).filter(([partKey, analysis]) => analysis.kind !== "resolved" && !input.document.geometry.some((node) => input.parts[partKey].targetNodeIds.includes(String(node.id)) && (node.type === "circle" || node.type === "ellipse"))).map(([partKey]) => partKey).sort();
    if (unexpectedPartKeys.length > 0) {
      throw new SpatialIntentValidationError("EDIT_ARTICULATED_COMPANION_PART_INVALID", {
        unexpectedPartKeys,
        unexpectedNodeIds: unexpectedPartKeys.flatMap((partKey) => input.parts[partKey].targetNodeIds).sort()
      });
    }
  }
  for (const goal of input.intent.goals) {
    if (!input.parts[goal.subject]) throw new Error("EDIT_PART_UNRESOLVED");
    if ("reference" in goal && goal.reference.kind === "part" && !input.parts[goal.reference.partKey]) {
      throw new Error("EDIT_REFERENCE_UNRESOLVED");
    }
    if (goal.kind === "explicit_numeric" && !input.numericConstraints.some(({ numericKey }) => numericKey === goal.numericKey)) {
      throw new Error("EDIT_NUMERIC_EVIDENCE_MISSING");
    }
  }
  for (const [partKey, target] of Object.entries(input.parts)) {
    if (target.targetNodeIds.length === 0) throw new Error("EDIT_TARGET_UNRESOLVED");
    for (const nodeId of target.targetNodeIds) {
      if (!input.document.geometry.some(({ id }) => String(id) === nodeId)) throw new Error("EDIT_TARGET_UNRESOLVED");
    }
    const articulation = analyzeArticulatedGrounding(input.document, target);
    if (articulation.kind === "invalid") {
      throw new SpatialIntentValidationError("EDIT_ARTICULATED_SELECTION_INVALID", {
        partKey,
        unexpectedNodeIds: articulation.unexpectedNodeIds
      });
    }
  }
}
function findFragmentedArticulatedSelection(document, parts) {
  const nodePartKeys = /* @__PURE__ */ new Map();
  for (const [partKey, target] of Object.entries(parts)) {
    for (const nodeId of target.targetNodeIds) {
      nodePartKeys.set(nodeId, [...nodePartKeys.get(nodeId) ?? [], partKey]);
    }
  }
  const carrierPartKeys = /* @__PURE__ */ new Set();
  const fragmented = [];
  for (const [partKey, target] of Object.entries(parts).sort(([left], [right]) => left.localeCompare(right))) {
    const carriers = document.geometry.filter((node) => target.targetNodeIds.includes(String(node.id)) && (node.type === "circle" || node.type === "ellipse"));
    if (carriers.length > 0) carrierPartKeys.add(partKey);
    for (const carrier of carriers) {
      const connectorIds = new Set(findConnectedCarrierInterfaces(document, String(carrier.id)).map(({ nodeId }) => nodeId));
      const splitEntries = [...connectorIds].flatMap((nodeId) => (nodePartKeys.get(nodeId) ?? []).filter((ownerPartKey) => ownerPartKey !== partKey).map((ownerPartKey) => ({ ownerPartKey, nodeId })));
      if (splitEntries.length === 0) continue;
      fragmented.push({
        partKey,
        mergePartKeys: [...new Set(splitEntries.map(({ ownerPartKey }) => ownerPartKey))].sort(),
        mergeNodeIds: [...new Set(splitEntries.map(({ nodeId }) => nodeId))].sort()
      });
    }
  }
  const first = fragmented[0];
  if (!first) return null;
  const groupedPartKeys = /* @__PURE__ */ new Set([first.partKey, ...first.mergePartKeys]);
  const unexpectedPartKeys = carrierPartKeys.size === 1 ? Object.keys(parts).filter((partKey) => !groupedPartKeys.has(partKey)).sort() : [];
  return {
    ...first,
    unexpectedPartKeys,
    unexpectedNodeIds: unexpectedPartKeys.flatMap((partKey) => parts[partKey].targetNodeIds).sort()
  };
}
function solvePrimaryTransforms(input, scale2) {
  const transforms = Object.fromEntries(Object.keys(input.parts).sort().map((partKey) => [
    partKey,
    { translation: [0, 0] }
  ]));
  for (let pass = 0; pass < 3; pass += 1) {
    for (const goal of input.intent.goals) applyGoal(input, transforms, goal, scale2);
  }
  for (const transform2 of Object.values(transforms)) {
    if (![...transform2.translation, transform2.rotationRadians ?? 0].every(Number.isFinite)) {
      throw new Error("EDIT_SPATIAL_MATH_INVALID");
    }
  }
  return transforms;
}
function applyGoal(input, transforms, goal, scale2) {
  const transform2 = transforms[goal.subject];
  const subject = transformedPartGeometry(input, goal.subject, transforms);
  if (goal.kind === "direction") {
    const amount = scale2 * MAGNITUDE_RATIO[goal.magnitude];
    if (goal.direction === "up") transform2.translation[1] = amount;
    if (goal.direction === "down") transform2.translation[1] = -amount;
    if (goal.direction === "left") transform2.translation[0] = -amount;
    if (goal.direction === "right") transform2.translation[0] = amount;
    return;
  }
  if (goal.kind === "explicit_numeric") {
    applyNumericGoal(input, transforms, goal);
    return;
  }
  const reference = referenceGeometry(input, goal.reference, transforms);
  if (goal.kind === "alignment") {
    let coupledX = false;
    let coupledY = false;
    if (goal.reference.kind === "part") {
      const referencePartKey = goal.reference.partKey;
      const referenceTransform = transforms[referencePartKey];
      const referenceOriginal = originalPartGeometry(input, referencePartKey);
      const sharedYDirection = ["down", "up"].find((direction) => hasDirectionalGoal(input, goal.subject, direction) && hasDirectionalGoal(input, referencePartKey, direction));
      if ((goal.axis === "y" || goal.axis === "both") && sharedYDirection) {
        const targetY = sharedYDirection === "down" ? Math.min(subject.center[1], reference.center[1]) : Math.max(subject.center[1], reference.center[1]);
        transform2.translation[1] = targetY - originalPartGeometry(input, goal.subject).center[1];
        referenceTransform.translation[1] = targetY - referenceOriginal.center[1];
        coupledY = true;
      }
      const sharedXDirection = ["left", "right"].find((direction) => hasDirectionalGoal(input, goal.subject, direction) && hasDirectionalGoal(input, referencePartKey, direction));
      if ((goal.axis === "x" || goal.axis === "both") && sharedXDirection) {
        const targetX = sharedXDirection === "left" ? Math.min(subject.center[0], reference.center[0]) : Math.max(subject.center[0], reference.center[0]);
        transform2.translation[0] = targetX - originalPartGeometry(input, goal.subject).center[0];
        referenceTransform.translation[0] = targetX - referenceOriginal.center[0];
        coupledX = true;
      }
    }
    if (!coupledX && (goal.axis === "x" || goal.axis === "both")) {
      transform2.translation[0] += reference.center[0] - subject.center[0];
    }
    if (!coupledY && (goal.axis === "y" || goal.axis === "both")) {
      transform2.translation[1] += reference.center[1] - subject.center[1];
    }
    return;
  }
  if (goal.kind === "relative_position") {
    const gap = scale2 * MAGNITUDE_RATIO[goal.magnitude];
    if (goal.relation === "above") transform2.translation[1] += reference.bounds.maxY + gap - subject.bounds.minY;
    if (goal.relation === "below") transform2.translation[1] += reference.bounds.minY - gap - subject.bounds.maxY;
    if (goal.relation === "left_of") transform2.translation[0] += reference.bounds.minX - gap - subject.bounds.maxX;
    if (goal.relation === "right_of") transform2.translation[0] += reference.bounds.maxX + gap - subject.bounds.minX;
    if (goal.relation === "centered") {
      transform2.translation[0] += reference.center[0] - subject.center[0];
      transform2.translation[1] += reference.center[1] - subject.center[1];
    }
    if (goal.relation === "near" || goal.relation === "far") {
      const dx = subject.center[0] - reference.center[0];
      const dy = subject.center[1] - reference.center[1];
      const distance2 = Math.hypot(dx, dy) || 1;
      const targetDistance = goal.relation === "near" ? gap : gap + scale2 * 0.5;
      transform2.translation[0] += dx / distance2 * targetDistance - dx;
      transform2.translation[1] += dy / distance2 * targetDistance - dy;
    }
    return;
  }
  applyTopologySeed(input, transforms, goal, scale2);
}
function hasDirectionalGoal(input, partKey, direction) {
  return input.intent.goals.some((goal) => goal.kind === "direction" && goal.subject === partKey && goal.direction === direction);
}
function applyNumericGoal(input, transforms, goal) {
  const constraint = input.numericConstraints.find(({ numericKey }) => numericKey === goal.numericKey);
  if (!constraint) throw new Error("EDIT_NUMERIC_EVIDENCE_MISSING");
  const transform2 = transforms[goal.subject];
  if (goal.quantity === "angle") {
    if (constraint.kind !== "angle" || Array.isArray(constraint.value)) throw new Error("EDIT_NUMERIC_KIND_MISMATCH");
    transform2.rotationRadians = angleRadians(constraint.value, constraint.unit);
    return;
  }
  if (constraint.kind === "coordinate" || Array.isArray(constraint.value)) throw new Error("EDIT_NUMERIC_KIND_MISMATCH");
  const value2 = distanceInDrawingUnits(constraint.value, constraint.unit, input.document.unitSystem.length);
  const original = originalPartGeometry(input, goal.subject);
  if (goal.quantity === "delta_x") transform2.translation[0] = value2;
  if (goal.quantity === "delta_y") transform2.translation[1] = value2;
  if (goal.quantity === "target_x") transform2.translation[0] = value2 - original.center[0];
  if (goal.quantity === "target_y") transform2.translation[1] = value2 - original.center[1];
  if (goal.quantity === "distance") {
    const direction = input.intent.goals.find((candidate) => candidate.kind === "direction" && candidate.subject === goal.subject);
    if (!direction) throw new Error("EDIT_NUMERIC_DIRECTION_REQUIRED");
    transform2.translation = direction.direction === "up" ? [0, value2] : direction.direction === "down" ? [0, -value2] : direction.direction === "left" ? [-value2, 0] : [value2, 0];
  }
}
function applyTopologySeed(input, transforms, goal, scale2) {
  const transform2 = transforms[goal.subject];
  const subject = transformedPartGeometry(input, goal.subject, transforms);
  const reference = referenceGeometry(input, goal.reference, transforms);
  if (goal.relation === "touches") {
    transform2.translation[0] += reference.bounds.minX - subject.bounds.maxX;
    transform2.translation[1] += reference.center[1] - subject.center[1];
  }
  if (goal.relation === "crosses") {
    transform2.translation[0] += reference.center[0] - subject.center[0];
    transform2.translation[1] += reference.center[1] - subject.center[1];
  }
  if (goal.relation === "does_not_cross" && topologyRelation(input.document, input.parts[goal.subject], goal.reference, input.parts, "crosses")) {
    transform2.translation[1] += reference.bounds.maxY - subject.bounds.minY + scale2 * MAGNITUDE_RATIO.minimum;
  }
  if (goal.relation === "inside") {
    transform2.translation[0] += reference.center[0] - subject.center[0];
    transform2.translation[1] += reference.center[1] - subject.center[1];
  }
  if (goal.relation === "outside") {
    transform2.translation[0] += reference.bounds.maxX - subject.bounds.minX + scale2 * MAGNITUDE_RATIO.minimum;
  }
}
function generateCandidateTransforms(input, primary, scale2) {
  const candidates = /* @__PURE__ */ new Map();
  const add = (candidate) => {
    const cloned = structuredClone(candidate);
    candidates.set(canonicalString(canonicalTransforms(cloned)), cloned);
  };
  add(primary);
  const neighborhood = scale2 * MAGNITUDE_RATIO.minimum;
  for (const partKey of Object.keys(primary).sort()) {
    const exactX = hasExactAxis(input, partKey, "x");
    const exactY = hasExactAxis(input, partKey, "y");
    for (const [dx, dy] of [[-neighborhood, 0], [neighborhood, 0], [0, -neighborhood], [0, neighborhood]]) {
      if (dx !== 0 && exactX || dy !== 0 && exactY) continue;
      const candidate = structuredClone(primary);
      candidate[partKey].translation[0] += dx;
      candidate[partKey].translation[1] += dy;
      add(candidate);
    }
  }
  for (const goal of input.intent.goals) {
    if (goal.kind !== "topology" || goal.relation !== "touches") continue;
    const reference = referenceGeometry(input, goal.reference, primary);
    const subject = transformedPartGeometry(input, goal.subject, primary);
    const original = originalPartGeometry(input, goal.subject);
    const placements = [
      [reference.bounds.maxX + subject.width / 2, reference.center[1]],
      [reference.center[0], reference.bounds.minY - subject.height / 2],
      [reference.center[0], reference.bounds.maxY + subject.height / 2]
    ];
    for (const center2 of placements) {
      const candidate = structuredClone(primary);
      candidate[goal.subject].translation = [center2[0] - original.center[0], center2[1] - original.center[1]];
      add(candidate);
    }
  }
  return [...candidates.values()].sort((left, right) => canonicalString(canonicalTransforms(left)).localeCompare(canonicalString(canonicalTransforms(right)))).slice(0, MAX_CANDIDATES);
}
function hasExactAxis(input, partKey, axis) {
  return input.intent.goals.some((goal) => goal.kind === "explicit_numeric" && goal.subject === partKey && (axis === "x" ? goal.quantity === "delta_x" || goal.quantity === "target_x" || goal.quantity === "distance" : goal.quantity === "delta_y" || goal.quantity === "target_y" || goal.quantity === "distance"));
}
function compileTransforms(input, transforms) {
  const changed = Object.keys(transforms).sort().filter((partKey) => {
    const transform2 = transforms[partKey];
    return Math.hypot(...transform2.translation) > EPSILON$1 || Math.abs(transform2.rotationRadians ?? 0) > EPSILON$1;
  });
  if (changed.length === 0) throw new Error("EDIT_NO_EFFECT");
  if (changed.length === 1) {
    const partKey = changed[0];
    const transform2 = transforms[partKey];
    const grounding = articulatedGrounding(input.document, input.parts[partKey]);
    const pivot = partGeometry(input.document, grounding).center;
    const soleTarget = grounding.targetNodeIds.length === 1 ? input.document.geometry.find(({ id }) => String(id) === grounding.targetNodeIds[0]) : void 0;
    const connectedCarrier = (soleTarget == null ? void 0 : soleTarget.type) === "circle" || (soleTarget == null ? void 0 : soleTarget.type) === "ellipse";
    const connected = grounding.interfaces.length > 0 || connectedCarrier;
    return compileSpatialEditProgram({
      document: input.document,
      grounding,
      ports: input.ports,
      program: {
        baseRef: input.baseRef,
        targetHandle: grounding.targetHandle,
        summary: input.intent.summary,
        objective: input.intent.summary,
        operations: [connected ? {
          kind: "connected_transform",
          translation: transform2.translation,
          ...transform2.rotationRadians === void 0 && connectedCarrier ? {} : {
            rotationRadians: transform2.rotationRadians ?? 0,
            pivot: [pivot[0], pivot[1]]
          },
          interfaceIds: grounding.interfaces.map(({ interfaceId }) => interfaceId)
        } : {
          kind: "rigid_transform",
          translation: transform2.translation,
          rotationRadians: transform2.rotationRadians ?? 0,
          pivot: [pivot[0], pivot[1]]
        }],
        preserveScopes: [],
        postconditions: [],
        evidenceRefs: [`semantic-part:${partKey}`]
      }
    });
  }
  return compileMultiPartTransform({
    document: input.document,
    baseRef: input.baseRef,
    objective: input.intent.summary,
    summary: input.intent.summary,
    parts: changed.map((partKey) => {
      const transform2 = transforms[partKey];
      const grounding = articulatedGrounding(input.document, input.parts[partKey]);
      return {
        groundingId: `semantic-part:${partKey}`,
        grounding,
        translation: transform2.translation,
        ...transform2.rotationRadians === void 0 ? {} : {
          rotationRadians: transform2.rotationRadians,
          pivot: partGeometry(input.document, grounding).center
        }
      };
    }),
    ports: input.ports
  });
}
function articulatedGrounding(document, grounding) {
  const analysis = analyzeArticulatedGrounding(document, grounding);
  return analysis.kind === "resolved" ? analysis.grounding : grounding;
}
function analyzeArticulatedGrounding(document, grounding) {
  if (grounding.targetNodeIds.length < 1) return { kind: "not_applicable" };
  const selected = new Set(grounding.targetNodeIds);
  const carriers = document.geometry.filter((node) => selected.has(String(node.id)) && (node.type === "circle" || node.type === "ellipse"));
  let mixedCarrierAndConnector = false;
  const unexpectedNodeIds = /* @__PURE__ */ new Set();
  const candidates = carriers.flatMap((carrier) => {
    const interfaces = findConnectedCarrierInterfaces(document, String(carrier.id));
    if (interfaces.length === 0) return [];
    const connectorNodeIds = new Set(interfaces.map(({ nodeId }) => nodeId));
    const selectedNonCarrierIds = grounding.targetNodeIds.filter((nodeId) => nodeId !== String(carrier.id));
    const selectedConnectorCount = selectedNonCarrierIds.filter((nodeId) => connectorNodeIds.has(nodeId)).length;
    if (selectedConnectorCount > 0 && selectedConnectorCount < selectedNonCarrierIds.length) {
      mixedCarrierAndConnector = true;
      for (const nodeId of selectedNonCarrierIds) {
        if (!connectorNodeIds.has(nodeId)) unexpectedNodeIds.add(nodeId);
      }
    }
    return selectedNonCarrierIds.every((nodeId) => connectorNodeIds.has(nodeId)) ? [{ carrierNodeId: String(carrier.id), interfaces }] : [];
  });
  if (mixedCarrierAndConnector || candidates.length > 1) {
    return { kind: "invalid", unexpectedNodeIds: [...unexpectedNodeIds].sort() };
  }
  if (candidates.length !== 1) return { kind: "not_applicable" };
  const candidate = candidates[0];
  const authorizedConnectorNodeIds = /* @__PURE__ */ new Set([
    ...grounding.targetNodeIds,
    ...grounding.interfaces.map(({ nodeId }) => nodeId)
  ]);
  return {
    kind: "resolved",
    grounding: {
      ...grounding,
      targetNodeIds: [candidate.carrierNodeId],
      interfaces: candidate.interfaces.filter(({ nodeId }) => authorizedConnectorNodeIds.has(nodeId)).map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint }))
    }
  };
}
function goalResidualFor(input, candidate, transforms, scale2) {
  let residual = 0;
  for (const goal of input.intent.goals) {
    const subject = partGeometry(candidate, input.parts[goal.subject]);
    if (goal.kind === "direction") {
      const desired = scale2 * MAGNITUDE_RATIO[goal.magnitude];
      const transform2 = transforms[goal.subject];
      const actual = goal.direction === "up" ? transform2.translation[1] : goal.direction === "down" ? -transform2.translation[1] : goal.direction === "left" ? -transform2.translation[0] : transform2.translation[0];
      residual += Math.max(0, desired - actual) / scale2 + (actual < 0 ? 1 : 0);
      continue;
    }
    if (goal.kind === "explicit_numeric") {
      const expected = input.numericConstraints.find(({ numericKey }) => numericKey === goal.numericKey);
      const original = originalPartGeometry(input, goal.subject);
      if (goal.quantity === "angle") {
        const value2 = Array.isArray(expected.value) ? Number.NaN : angleRadians(expected.value, expected.unit);
        residual += Math.abs((transforms[goal.subject].rotationRadians ?? 0) - value2);
      } else if (!Array.isArray(expected.value)) {
        const value2 = distanceInDrawingUnits(expected.value, expected.unit, input.document.unitSystem.length);
        const actual = goal.quantity === "delta_x" ? subject.center[0] - original.center[0] : goal.quantity === "delta_y" ? subject.center[1] - original.center[1] : goal.quantity === "target_x" ? subject.center[0] : goal.quantity === "target_y" ? subject.center[1] : Math.hypot(subject.center[0] - original.center[0], subject.center[1] - original.center[1]);
        residual += Math.abs(actual - value2) / scale2;
      }
      continue;
    }
    const reference = referenceGeometryInCandidate(input, candidate, goal.reference);
    if (goal.kind === "alignment") {
      if (goal.axis === "x" || goal.axis === "both") residual += Math.abs(subject.center[0] - reference.center[0]) / scale2;
      if (goal.axis === "y" || goal.axis === "both") residual += Math.abs(subject.center[1] - reference.center[1]) / scale2;
    } else if (goal.kind === "relative_position") {
      if (goal.relation === "above") residual += Math.max(0, reference.bounds.maxY - subject.bounds.minY) / scale2;
      if (goal.relation === "below") residual += Math.max(0, subject.bounds.maxY - reference.bounds.minY) / scale2;
      if (goal.relation === "left_of") residual += Math.max(0, subject.bounds.maxX - reference.bounds.minX) / scale2;
      if (goal.relation === "right_of") residual += Math.max(0, reference.bounds.maxX - subject.bounds.minX) / scale2;
      if (goal.relation === "centered") residual += Math.hypot(subject.center[0] - reference.center[0], subject.center[1] - reference.center[1]) / scale2;
      if (goal.relation === "near") residual += Math.max(0, Math.hypot(subject.center[0] - reference.center[0], subject.center[1] - reference.center[1]) - scale2 * 0.25) / scale2;
      if (goal.relation === "far") residual += Math.max(0, scale2 * 0.35 - Math.hypot(subject.center[0] - reference.center[0], subject.center[1] - reference.center[1])) / scale2;
    }
  }
  return residual + topologyPenaltyFor(input, candidate);
}
function topologyPenaltyFor(input, candidate) {
  let penalty = 0;
  for (const goal of input.intent.goals) {
    if (goal.kind !== "topology") continue;
    const relation = topologyRelation(candidate, input.parts[goal.subject], goal.reference, input.parts, goal.relation);
    if (!relation) penalty += 1;
  }
  return penalty;
}
function topologyRelation(document, subject, reference, parts, relation) {
  if (reference.kind !== "part") return false;
  const referencePart = parts[reference.partKey];
  if (!referencePart) return false;
  const subjectNodes = subject.targetNodeIds.flatMap((id) => document.geometry.filter((node) => String(node.id) === id));
  const referenceNodes = referencePart.targetNodeIds.flatMap((id) => document.geometry.filter((node) => String(node.id) === id));
  if (subjectNodes.length === 0 || referenceNodes.length === 0) return false;
  if (relation === "crosses") return subjectNodes.some((left) => referenceNodes.some((right) => geometriesCross(left, right)));
  if (relation === "does_not_cross") return !subjectNodes.some((left) => referenceNodes.some((right) => geometriesCross(left, right)));
  if (relation === "touches") return subjectNodes.some((left) => referenceNodes.some((right) => geometriesTouch(left, right)));
  const subjectBounds = unionBounds(subjectNodes.map(boundsOfGeometry));
  const referenceBounds = unionBounds(referenceNodes.map(boundsOfGeometry));
  const inside = containsBounds(referenceBounds, subjectBounds);
  return relation === "inside" ? inside : !inside;
}
function collisionPenaltyFor(input, candidate) {
  const partNodeIds = new Set(Object.values(input.parts).flatMap(({ targetNodeIds }) => targetNodeIds));
  const interfaceNodeIds = new Set(Object.values(input.parts).flatMap(({ interfaces }) => interfaces.map(({ nodeId }) => nodeId)));
  let penalty = 0;
  for (const [partKey, target] of Object.entries(input.parts)) {
    for (const targetId of target.targetNodeIds) {
      const beforeTarget = geometryById(input.document, targetId);
      const afterTarget = geometryById(candidate, targetId);
      if (!beforeTarget || !afterTarget) continue;
      for (const afterOther of candidate.geometry) {
        const otherId = String(afterOther.id);
        if (partNodeIds.has(otherId) || interfaceNodeIds.has(otherId) || otherId === targetId) continue;
        const beforeOther = geometryById(input.document, otherId);
        if (!beforeOther) continue;
        if (geometriesIntersect(afterTarget, afterOther) && !geometriesIntersect(beforeTarget, beforeOther)) penalty += 1;
      }
    }
    for (const [otherPartKey, other] of Object.entries(input.parts)) {
      if (partKey >= otherPartKey || topologyAllowsContact(input.intent.goals, partKey, otherPartKey)) continue;
      for (const leftId of target.targetNodeIds) for (const rightId of other.targetNodeIds) {
        const leftBefore = geometryById(input.document, leftId);
        const rightBefore = geometryById(input.document, rightId);
        const leftAfter = geometryById(candidate, leftId);
        const rightAfter = geometryById(candidate, rightId);
        if (leftBefore && rightBefore && leftAfter && rightAfter && geometriesIntersect(leftAfter, rightAfter) && !geometriesIntersect(leftBefore, rightBefore)) penalty += 1;
      }
    }
  }
  return penalty;
}
function topologyAllowsContact(goals, left, right) {
  return goals.some((goal) => goal.kind === "topology" && goal.reference.kind === "part" && (goal.subject === left && goal.reference.partKey === right || goal.subject === right && goal.reference.partKey === left) && ["touches", "crosses", "inside"].includes(goal.relation));
}
function assertProtectedScope(input, candidate) {
  if (!input.intent.preserve.some(({ kind }) => kind === "protected_scope")) return;
  const editable = /* @__PURE__ */ new Set([
    ...Object.values(input.parts).flatMap(({ targetNodeIds }) => targetNodeIds),
    ...Object.values(input.parts).flatMap(({ interfaces }) => interfaces.map(({ nodeId }) => nodeId))
  ]);
  for (const before of input.document.geometry) {
    if (editable.has(String(before.id))) continue;
    const after = candidate.geometry.find(({ id }) => id === before.id);
    if (!after || canonicalString(after) !== canonicalString(before)) throw new Error("EDIT_PROTECTED_SCOPE_CHANGED");
  }
}
function movementCostFor(transforms, scale2) {
  return Object.values(transforms).reduce((sum, transform2) => sum + Math.hypot(...transform2.translation) / scale2 + Math.abs(transform2.rotationRadians ?? 0), 0);
}
function deformationCostFor(transforms) {
  return Object.values(transforms).reduce((sum, transform2) => sum + Math.abs(transform2.rotationRadians ?? 0), 0);
}
function canonicalTransforms(transforms) {
  return Object.keys(transforms).sort().map((partKey) => ({
    partKey,
    translation: [...transforms[partKey].translation],
    ...transforms[partKey].rotationRadians === void 0 ? {} : {
      rotationRadians: transforms[partKey].rotationRadians
    }
  }));
}
function originalPartGeometry(input, partKey) {
  return partGeometry(input.document, input.parts[partKey]);
}
function transformedPartGeometry(input, partKey, transforms) {
  const original = originalPartGeometry(input, partKey);
  const [dx, dy] = transforms[partKey].translation;
  return {
    center: [original.center[0] + dx, original.center[1] + dy],
    bounds: shiftBounds(original.bounds, dx, dy),
    width: original.width,
    height: original.height
  };
}
function partGeometry(document, target) {
  const nodes = target.targetNodeIds.map((nodeId) => geometryById(document, nodeId)).filter((node) => Boolean(node));
  if (nodes.length === 0) throw new Error("EDIT_TARGET_UNRESOLVED");
  const bounds2 = unionBounds(nodes.map(boundsOfGeometry));
  return {
    bounds: bounds2,
    center: [(bounds2.minX + bounds2.maxX) / 2, (bounds2.minY + bounds2.maxY) / 2],
    width: bounds2.maxX - bounds2.minX,
    height: bounds2.maxY - bounds2.minY
  };
}
function referenceGeometry(input, reference, transforms) {
  if (reference.kind === "part") return transformedPartGeometry(input, reference.partKey, transforms);
  const point = referencePoint(input, reference);
  return { center: point, bounds: pointBounds(point), width: 0, height: 0 };
}
function referenceGeometryInCandidate(input, candidate, reference) {
  if (reference.kind === "part") return partGeometry(candidate, input.parts[reference.partKey]);
  const point = referencePoint(input, reference);
  return { center: point, bounds: pointBounds(point), width: 0, height: 0 };
}
function referencePoint(input, reference) {
  var _a3;
  const bounds2 = drawingBounds(input.document);
  if (reference.kind === "drawing_anchor") {
    const center2 = [(bounds2.minX + bounds2.maxX) / 2, (bounds2.minY + bounds2.maxY) / 2];
    if (reference.anchor === "center") return center2;
    if (reference.anchor === "top") return [center2[0], bounds2.maxY];
    if (reference.anchor === "bottom") return [center2[0], bounds2.minY];
    if (reference.anchor === "left") return [bounds2.minX, center2[1]];
    return [bounds2.maxX, center2[1]];
  }
  if (reference.kind === "part") throw new Error("EDIT_REFERENCE_UNRESOLVED");
  const key = reference.kind === "semantic_anchor" ? `semantic:${reference.query}` : `observation:${reference.normalized[0]},${reference.normalized[1]}`;
  const point = (_a3 = input.resolvedReferences) == null ? void 0 : _a3[key];
  if (!point || !point.every(Number.isFinite)) throw new Error("EDIT_REFERENCE_UNRESOLVED");
  return [...point];
}
function geometryById(document, nodeId) {
  return document.geometry.find(({ id }) => String(id) === nodeId);
}
function drawingBounds(document) {
  return unionBounds(document.geometry.filter(({ visible }) => visible).map(boundsOfGeometry));
}
function drawingDiagonal(document) {
  const bounds2 = drawingBounds(document);
  const diagonal = Math.hypot(bounds2.maxX - bounds2.minX, bounds2.maxY - bounds2.minY);
  if (!Number.isFinite(diagonal) || diagonal <= EPSILON$1) return 1;
  return diagonal;
}
function boundsOfGeometry(node) {
  if (node.type === "point") return pointBounds([node.x, node.y]);
  if (node.type === "circle" || node.type === "arc") return {
    minX: node.center[0] - node.radius,
    minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius,
    maxY: node.center[1] + node.radius
  };
  if (node.type === "ellipse") {
    const major = Math.hypot(...node.majorAxis);
    return { minX: node.center[0] - major, minY: node.center[1] - major, maxX: node.center[0] + major, maxY: node.center[1] + major };
  }
  const points = node.type === "line" ? [node.start, node.end] : node.type === "ray" || node.type === "xline" ? [node.origin] : node.type === "polyline" ? node.vertices.map(({ point }) => point) : node.controlPoints;
  return boundsOfPoints(points);
}
function boundsOfPoints(points) {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function unionBounds(bounds2) {
  if (bounds2.length === 0) throw new Error("EDIT_DRAWING_EMPTY");
  return {
    minX: Math.min(...bounds2.map(({ minX }) => minX)),
    minY: Math.min(...bounds2.map(({ minY }) => minY)),
    maxX: Math.max(...bounds2.map(({ maxX }) => maxX)),
    maxY: Math.max(...bounds2.map(({ maxY }) => maxY))
  };
}
function pointBounds([x, y]) {
  return { minX: x, minY: y, maxX: x, maxY: y };
}
function shiftBounds(bounds2, dx, dy) {
  return { minX: bounds2.minX + dx, minY: bounds2.minY + dy, maxX: bounds2.maxX + dx, maxY: bounds2.maxY + dy };
}
function containsBounds(outer, inner) {
  return inner.minX >= outer.minX - EPSILON$1 && inner.maxX <= outer.maxX + EPSILON$1 && inner.minY >= outer.minY - EPSILON$1 && inner.maxY <= outer.maxY + EPSILON$1;
}
function geometriesCross(left, right) {
  if (left.type === "line" && right.type === "line") return segmentsIntersect(left.start, left.end, right.start, right.end, true);
  return geometriesIntersect(left, right);
}
function geometriesTouch(left, right) {
  if (left.type === "circle" && right.type === "circle") {
    return Math.abs(Math.hypot(left.center[0] - right.center[0], left.center[1] - right.center[1]) - left.radius - right.radius) <= 1e-5;
  }
  return geometriesIntersect(left, right);
}
function geometriesIntersect(left, right) {
  if (left.type === "circle" && right.type === "circle") {
    return Math.hypot(left.center[0] - right.center[0], left.center[1] - right.center[1]) <= left.radius + right.radius + EPSILON$1;
  }
  if (left.type === "line" && right.type === "line") return segmentsIntersect(left.start, left.end, right.start, right.end, false);
  if (left.type === "circle" && right.type === "line") return distanceToSegment$1(left.center, right.start, right.end) <= left.radius + EPSILON$1;
  if (left.type === "line" && right.type === "circle") return distanceToSegment$1(right.center, left.start, left.end) <= right.radius + EPSILON$1;
  const a = boundsOfGeometry(left);
  const b = boundsOfGeometry(right);
  return a.minX <= b.maxX + EPSILON$1 && a.maxX + EPSILON$1 >= b.minX && a.minY <= b.maxY + EPSILON$1 && a.maxY + EPSILON$1 >= b.minY;
}
function segmentsIntersect(a, b, c, d, proper) {
  const cross2 = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross2(a, b, c);
  const abD = cross2(a, b, d);
  const cdA = cross2(c, d, a);
  const cdB = cross2(c, d, b);
  return proper ? abC * abD < -EPSILON$1 && cdA * cdB < -EPSILON$1 : abC * abD <= EPSILON$1 && cdA * cdB <= EPSILON$1 && Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) + EPSILON$1 && Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) + EPSILON$1;
}
function distanceToSegment$1(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON$1) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
}
function distanceInDrawingUnits(value2, unit, drawingUnit) {
  const millimeters = unit === "mm" ? value2 : unit === "cm" ? value2 * 10 : unit === "m" ? value2 * 1e3 : unit === "in" ? value2 * 25.4 : Number.NaN;
  if (!Number.isFinite(millimeters)) throw new Error("EDIT_NUMERIC_UNIT_UNSUPPORTED");
  return drawingUnit === "mm" ? millimeters : drawingUnit === "cm" ? millimeters / 10 : millimeters / 1e3;
}
function angleRadians(value2, unit) {
  if (unit === "deg") return value2 * Math.PI / 180;
  if (unit === "rad") return value2;
  throw new Error("EDIT_NUMERIC_UNIT_UNSUPPORTED");
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
    sources: [],
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
function evaluateSpline(node, parameter) {
  validateSpline(node);
  if (!Number.isFinite(parameter)) throw new TypeError("SPLINE_PARAMETER_INVALID");
  return project(evaluateHomogeneous(node, Math.min(1, Math.max(0, parameter))));
}
function evaluateHomogeneous(node, normalized) {
  const pointCount = node.controlPoints.length;
  const lastControlIndex = pointCount - 1;
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[lastControlIndex + 1];
  const knotParameter = normalized === 1 ? domainEnd : domainStart + normalized * (domainEnd - domainStart);
  const span = normalized === 1 ? lastControlIndex : findSpan(node.knots, node.degree, lastControlIndex, knotParameter);
  const weights = node.weights ?? Array.from({ length: pointCount }, () => 1);
  const work = [];
  for (let index = 0; index <= node.degree; index += 1) {
    const sourceIndex = span - node.degree + index;
    const weight = weights[sourceIndex];
    const point = node.controlPoints[sourceIndex];
    work.push([point[0] * weight, point[1] * weight, weight]);
  }
  for (let level = 1; level <= node.degree; level += 1) {
    for (let index = node.degree; index >= level; index -= 1) {
      const knotIndex = span - node.degree + index;
      const denominator = node.knots[knotIndex + node.degree - level + 1] - node.knots[knotIndex];
      const alpha = denominator === 0 ? 0 : (knotParameter - node.knots[knotIndex]) / denominator;
      work[index] = mixHomogeneous(work[index - 1], work[index], alpha);
    }
  }
  return work[node.degree];
}
function sampleSpline(node, { maxError, maxDepth = 12 }) {
  if (!(Number.isFinite(maxError) && maxError > 0)) {
    throw new TypeError("SPLINE_MAX_ERROR_INVALID");
  }
  if (!Number.isInteger(maxDepth) || maxDepth < 1 || maxDepth > 24) {
    throw new TypeError("SPLINE_MAX_DEPTH_INVALID");
  }
  validateSpline(node);
  const first = project(evaluateHomogeneous(node, 0));
  const output = [first];
  const spans = normalizedKnotSpans(node);
  for (let index = 1; index < spans.length; index += 1) {
    const controls = extractBezierControls(node, spans[index - 1], spans[index]);
    subdivideBezier(controls, 0, maxDepth, maxError, output);
  }
  if (node.closed && !samePoint(output[0], output.at(-1))) output.push(output[0]);
  return output;
}
function normalizedKnotSpans(node) {
  const start = node.knots[node.degree];
  const end = node.knots[node.controlPoints.length];
  return node.knots.slice(node.degree, node.controlPoints.length + 1).map((value2) => (value2 - start) / (end - start)).filter((value2, index, values2) => index === 0 || value2 > values2[index - 1]);
}
function splineBounds(node) {
  validateSpline(node);
  const controlMinX = Math.min(...node.controlPoints.map(([x]) => x));
  const controlMaxX = Math.max(...node.controlPoints.map(([x]) => x));
  const controlMinY = Math.min(...node.controlPoints.map(([, y]) => y));
  const controlMaxY = Math.max(...node.controlPoints.map(([, y]) => y));
  const span = Math.max(controlMaxX - controlMinX, controlMaxY - controlMinY, 1);
  const points = sampleSpline(node, { maxError: Math.max(span * 1e-6, 1e-8), maxDepth: 18 });
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function validateSpline(node) {
  if (!Number.isInteger(node.degree) || node.degree < 1) {
    throw new TypeError("SPLINE_DEGREE_INVALID");
  }
  if (node.controlPoints.length <= node.degree) {
    throw new TypeError("SPLINE_CONTROL_POINT_COUNT_INVALID");
  }
  if (node.controlPoints.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    throw new TypeError("SPLINE_CONTROL_POINT_INVALID");
  }
  const expectedKnots = node.controlPoints.length + node.degree + 1;
  if (node.knots.length !== expectedKnots) {
    throw new TypeError("SPLINE_KNOT_COUNT_INVALID");
  }
  if (node.knots.some((value2, index) => !Number.isFinite(value2) || index > 0 && value2 < node.knots[index - 1])) {
    throw new TypeError("SPLINE_KNOT_SEQUENCE_INVALID");
  }
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[node.controlPoints.length];
  if (!(domainEnd > domainStart)) throw new TypeError("SPLINE_KNOT_DOMAIN_INVALID");
  if (node.weights !== void 0 && (node.weights.length !== node.controlPoints.length || node.weights.some((weight) => !Number.isFinite(weight) || weight <= 0))) {
    throw new TypeError("SPLINE_WEIGHTS_INVALID");
  }
}
function findSpan(knots, degree, lastControlIndex, value2) {
  let low = degree;
  let high = lastControlIndex + 1;
  let middle = Math.floor((low + high) / 2);
  while (value2 < knots[middle] || value2 >= knots[middle + 1]) {
    if (value2 < knots[middle]) high = middle;
    else low = middle;
    middle = Math.floor((low + high) / 2);
  }
  return middle;
}
function mixHomogeneous(first, second, alpha) {
  return [
    first[0] * (1 - alpha) + second[0] * alpha,
    first[1] * (1 - alpha) + second[1] * alpha,
    first[2] * (1 - alpha) + second[2] * alpha
  ];
}
function subdivideBezier(controls, depth, maxDepth, maxError, output) {
  const points = controls.map(project);
  const start = points[0];
  const end = points.at(-1);
  const flatness = Math.max(0, ...points.slice(1, -1).map((point) => pointSegmentDistance(point, start, end)));
  if (depth >= maxDepth || flatness <= maxError) {
    output.push(end);
    return;
  }
  const [left, right] = splitBezier(controls);
  subdivideBezier(left, depth + 1, maxDepth, maxError, output);
  subdivideBezier(right, depth + 1, maxDepth, maxError, output);
}
function extractBezierControls(node, start, end) {
  const degree = node.degree;
  if (degree === 1) return [evaluateHomogeneous(node, start), evaluateHomogeneous(node, end)];
  const samples = Array.from({ length: degree + 1 }, (_, row) => {
    const local = row / degree;
    return evaluateHomogeneous(node, start + (end - start) * local);
  });
  const matrix = Array.from({ length: degree + 1 }, (_, row) => {
    const parameter = row / degree;
    return Array.from({ length: degree + 1 }, (_2, column) => bernstein(degree, column, parameter));
  });
  return solve(matrix, samples);
}
function solve(matrix, values2) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...values2[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) <= 1e-14) throw new TypeError("SPLINE_BEZIER_EXTRACTION_FAILED");
    for (let index = column; index < size + 3; index += 1) augmented[column][index] = augmented[column][index] / divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index < size + 3; index += 1) augmented[row][index] = augmented[row][index] - factor * augmented[column][index];
    }
  }
  return augmented.map((row) => [row[size], row[size + 1], row[size + 2]]);
}
function splitBezier(controls) {
  const levels = [controls.map((point) => [...point])];
  while (levels.at(-1).length > 1) {
    const previous = levels.at(-1);
    levels.push(previous.slice(1).map((point, index) => mixHomogeneous(previous[index], point, 0.5)));
  }
  return [levels.map((level) => level[0]), levels.map((level) => level.at(-1)).reverse()];
}
function project(point) {
  if (!(Math.abs(point[2]) > Number.EPSILON)) throw new TypeError("SPLINE_WEIGHT_SUM_INVALID");
  return [point[0] / point[2], point[1] / point[2]];
}
function bernstein(degree, index, parameter) {
  return binomial(degree, index) * parameter ** index * (1 - parameter) ** (degree - index);
}
function binomial(n, k) {
  let result = 1;
  for (let index = 1; index <= Math.min(k, n - k); index += 1) result = result * (n - index + 1) / index;
  return result;
}
function pointSegmentDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const projection = Math.min(1, Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(
    point[0] - (start[0] + projection * dx),
    point[1] - (start[1] + projection * dy)
  );
}
function samePoint(first, second) {
  return Math.abs(first[0] - second[0]) <= 1e-12 && Math.abs(first[1] - second[1]) <= 1e-12;
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
  const values2 = [bounds2.minX, bounds2.minY, bounds2.maxX, bounds2.maxY];
  if (!values2.every(Number.isFinite) || bounds2.minX > bounds2.maxX || bounds2.minY > bounds2.maxY) {
    throw new Error("INVALID_QUERY_BOUNDS");
  }
}
function validateLimit(limit) {
  const value2 = limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(value2) || value2 < 1) throw new Error("INVALID_QUERY_LIMIT");
  if (value2 > MAX_LIMIT) throw new Error("QUERY_LIMIT_EXCEEDED");
  return value2;
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
      return arcBounds$1(node.center, node.radius, node.startAngle, node.endAngle, node.counterClockwise);
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
      return splineBounds(node);
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
    case "section-hatch": {
      if (node.hatch !== void 0) {
        const normalized = normalizeHatchRegion(node.hatch, 1e-3);
        return normalized.status === "ok" ? normalized.region.bounds : null;
      }
      return fromPoints((node.segments ?? []).flatMap(({ start, end }) => [start, end]));
    }
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
function arcBounds$1(center2, radius, startAngle, endAngle, counterClockwise) {
  const angles = [startAngle, endAngle];
  for (const angle of [0, 90, 180, 270]) {
    if (angleOnArc$1(angle, startAngle, endAngle, counterClockwise)) angles.push(angle);
  }
  return fromPoints(angles.map((angle) => {
    const radians = angle * Math.PI / 180;
    return [center2[0] + radius * Math.cos(radians), center2[1] + radius * Math.sin(radians)];
  }));
}
function angleOnArc$1(angle, start, end, counterClockwise) {
  const normalize2 = (value2) => (value2 % 360 + 360) % 360;
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
    const curveSamples = integer$2(request.curveSamples, 8, 512, 64);
    const limit = integer$2(request.limit, 1, 2e3, 2e3);
    const requested = request.nodeIds ? new Set(request.nodeIds) : null;
    const allCandidates = document.geometry.filter((node) => (!requested || requested.has(String(node.id))) && (!request.bounds || boundsIntersect(geometryBounds$1(node), request.bounds)));
    const effectiveScopeBounds = request.bounds ? structuredClone(request.bounds) : unionSpatialBounds(allCandidates.map(geometryBounds$1));
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
        bounds: pointsBounds$1(draft.samples),
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
  if (node.type === "spline") return sampleSpline(node, { maxError: 0.02, maxDepth: 16 });
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
function geometryBounds$1(node) {
  if (node.type === "point") return pointsBounds$1([[node.x, node.y]]);
  if (node.type === "line") return pointsBounds$1([node.start, node.end]);
  if (node.type === "ray" || node.type === "xline") return pointsBounds$1([node.origin]);
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
  if (node.type === "polyline") return pointsBounds$1(node.vertices.map(({ point }) => point));
  return splineBounds(node);
}
function pointsBounds$1(points) {
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
function stableId$1(ports, kind, value2) {
  return `${kind}_${ports.digest(stableStringify(value2)).replace(/^sha256:/, "").slice(0, 24)}`;
}
function portableDigest$1(value2) {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value2.length; index += 1) {
    const code = value2.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619) >>> 0;
    second = Math.imul(second ^ code, 3266489917) >>> 0;
  }
  return `sha256:${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
}
function stableStringify(value2) {
  return JSON.stringify(canonicalize$1(value2));
}
function canonicalize$1(value2) {
  if (Array.isArray(value2)) return value2.map(canonicalize$1);
  if (!value2 || typeof value2 !== "object") return value2;
  return Object.fromEntries(Object.entries(value2).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, canonicalize$1(child)]));
}
function integer$2(value2, minimum, maximum, fallback) {
  if (value2 === void 0) return fallback;
  if (!Number.isInteger(value2) || value2 < minimum || value2 > maximum) throw new Error("WORLD_MODEL_REQUEST_INVALID");
  return value2;
}
function positive$2(value2, fallback) {
  if (value2 === void 0) return fallback;
  if (!Number.isFinite(value2) || value2 <= 0) throw new Error("WORLD_MODEL_REQUEST_INVALID");
  return value2;
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
class SpatialResolutionError extends Error {
  constructor(code, message) {
    super(message);
    __publicField(this, "code");
    this.name = "SpatialResolutionError";
    this.code = code;
  }
}
function resolveSpatialPoint(reference, context, createError = (code, message) => new SpatialResolutionError(code, message)) {
  const fail = (code, message) => {
    throw createError(code, message);
  };
  const stored = context.readObservationView(reference.observationId);
  if (!stored) return fail("SPATIAL_OBSERVATION_EXPIRED", `Observation ${reference.observationId} is unavailable`);
  if (stored.drawingId !== context.drawingId) {
    return fail(
      "SPATIAL_OBSERVATION_DRAWING_MISMATCH",
      `Observation ${reference.observationId} belongs to another drawing`
    );
  }
  if (stored.revision !== context.revision) {
    return fail(
      "SPATIAL_OBSERVATION_REVISION_MISMATCH",
      `Observation ${reference.observationId} belongs to another revision`
    );
  }
  const [a, b, c, d, e, f] = stored.view.worldToImage;
  const imageX = reference.normalized[0] * stored.view.width;
  const imageY = reference.normalized[1] * stored.view.height;
  const determinant = a * d - b * c;
  if (Math.abs(determinant) < 1e-12) {
    return fail(
      "SPATIAL_REFERENCE_UNRESOLVED",
      `Observation ${reference.observationId} has a singular coordinate transform`
    );
  }
  const translatedX = imageX - e;
  const translatedY = imageY - f;
  return [
    (d * translatedX - c * translatedY) / determinant,
    (-b * translatedX + a * translatedY) / determinant
  ];
}
class GroundingLedger {
  constructor(input) {
    __privateAdd(this, _GroundingLedger_instances);
    __privateAdd(this, _episodeId);
    __privateAdd(this, _drawingId);
    __privateAdd(this, _revision);
    __privateAdd(this, _events, []);
    __privateAdd(this, _eventIds, /* @__PURE__ */ new Set());
    __privateAdd(this, _current, /* @__PURE__ */ new Map());
    __privateSet(this, _episodeId, input.episodeId);
    __privateSet(this, _drawingId, input.drawingId);
    __privateSet(this, _revision, input.revision);
  }
  append(event) {
    __privateMethod(this, _GroundingLedger_instances, assertScope_fn).call(this, event);
    if (__privateGet(this, _eventIds).has(event.id)) throw new Error(`GROUNDING_EVENT_DUPLICATE: ${event.id}`);
    const safeEvent = structuredClone(event);
    __privateMethod(this, _GroundingLedger_instances, validateEvent_fn).call(this, safeEvent);
    const cursor = __privateGet(this, _events).length + 1;
    __privateGet(this, _events).push(safeEvent);
    __privateGet(this, _eventIds).add(safeEvent.id);
    __privateMethod(this, _GroundingLedger_instances, apply_fn).call(this, safeEvent, cursor);
    return { cursor, event: structuredClone(safeEvent) };
  }
  current(hypothesisId) {
    const state = __privateGet(this, _current).get(hypothesisId);
    return state ? structuredClone(state) : void 0;
  }
  currentStates(input = {}) {
    return [...__privateGet(this, _current).values()].filter((state) => input.includeInactive || state.status === "active" || state.status === "selected").sort((first, second) => first.lastEventCursor - second.lastEventCursor).map((state) => structuredClone(state));
  }
  events() {
    return structuredClone(__privateGet(this, _events));
  }
  deltaSince(cursor) {
    const safeCursor = Math.max(0, Math.min(__privateGet(this, _events).length, Math.floor(cursor)));
    const events = __privateGet(this, _events).slice(safeCursor);
    const changedIds = new Set(events.flatMap((event) => {
      var _a3;
      return [event.hypothesisId, ...((_a3 = event.hypothesis) == null ? void 0 : _a3.supersedes) ?? []];
    }));
    return {
      fromCursor: safeCursor,
      nextCursor: __privateGet(this, _events).length,
      events: structuredClone(events),
      current: [...changedIds].map((id) => __privateGet(this, _current).get(id)).filter((state) => Boolean(state)).sort((first, second) => first.lastEventCursor - second.lastEventCursor).map((state) => structuredClone(state))
    };
  }
}
_episodeId = new WeakMap();
_drawingId = new WeakMap();
_revision = new WeakMap();
_events = new WeakMap();
_eventIds = new WeakMap();
_current = new WeakMap();
_GroundingLedger_instances = new WeakSet();
apply_fn = function(event, cursor) {
  var _a3;
  const prior = __privateGet(this, _current).get(event.hypothesisId);
  const hypothesis = event.hypothesis ? structuredClone(event.hypothesis) : prior ? structuredClone(prior.hypothesis) : void 0;
  if (!hypothesis) throw new Error(`GROUNDING_HYPOTHESIS_MISSING: ${event.hypothesisId}`);
  if (event.supportDelta) hypothesis.supports = applySupportDelta(hypothesis.supports, event.supportDelta);
  if (event.confidence !== void 0) hypothesis.confidence = event.confidence;
  const status = event.kind === "selected" ? "selected" : event.kind === "rejected" ? "rejected" : event.kind === "superseded" ? "superseded" : event.kind === "promoted" ? "promoted" : (prior == null ? void 0 : prior.status) === "selected" ? "selected" : "active";
  __privateGet(this, _current).set(event.hypothesisId, {
    hypothesisId: event.hypothesisId,
    status,
    hypothesis,
    lastEventId: event.id,
    lastEventCursor: cursor
  });
  for (const supersededId of ((_a3 = event.hypothesis) == null ? void 0 : _a3.supersedes) ?? []) {
    const superseded = __privateGet(this, _current).get(supersededId);
    if (superseded) __privateGet(this, _current).set(supersededId, {
      ...superseded,
      status: "superseded",
      lastEventId: event.id,
      lastEventCursor: cursor
    });
  }
};
assertScope_fn = function(event) {
  if (event.episodeId !== __privateGet(this, _episodeId) || event.drawingId !== __privateGet(this, _drawingId) || event.revision !== __privateGet(this, _revision) || event.hypothesis && (event.hypothesis.drawingId !== __privateGet(this, _drawingId) || event.hypothesis.revision !== __privateGet(this, _revision))) throw new Error("GROUNDING_SCOPE_MISMATCH");
};
validateEvent_fn = function(event) {
  if (!event.id || !event.hypothesisId || !event.reasonCode) throw new Error("GROUNDING_EVENT_INVALID");
  if (event.hypothesis && event.hypothesis.id !== event.hypothesisId) {
    throw new Error("GROUNDING_HYPOTHESIS_ID_MISMATCH");
  }
  if (event.confidence !== void 0 && (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1)) {
    throw new Error("GROUNDING_CONFIDENCE_INVALID");
  }
  if (event.kind === "proposed" && !event.hypothesis) throw new Error("GROUNDING_PROPOSAL_MISSING_HYPOTHESIS");
  if (!event.hypothesis && !__privateGet(this, _current).has(event.hypothesisId)) {
    throw new Error(`GROUNDING_HYPOTHESIS_MISSING: ${event.hypothesisId}`);
  }
};
function applySupportDelta(current, delta) {
  const removed = new Set(delta.removed);
  const result = new Map(current.filter((support) => !removed.has(support.ref)).map((support) => [supportKey(support), structuredClone(support)]));
  for (const support of delta.added) result.set(supportKey(support), structuredClone(support));
  return [...result.values()];
}
function supportKey(support) {
  return `${support.kind}\0${support.ref}\0${support.role}`;
}
function portableDigest(value2) {
  let first = 2166136261;
  let second = 2246822519;
  for (let index = 0; index < value2.length; index += 1) {
    const code = value2.charCodeAt(index);
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
      const magnitude2 = Math.hypot(node.direction[0], node.direction[1]);
      if (magnitude2 === 0) return [range("whole-node", [node.origin])];
      const direction = [node.direction[0] / magnitude2, node.direction[1] / magnitude2];
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
      return sampledParameterRanges(count, (parameter) => evaluateSpline(node, parameter));
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
      return splineBounds(node);
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
function positiveSweep(value2) {
  const full = Math.PI * 2;
  const normalized = (value2 % full + full) % full;
  return Math.abs(normalized) < 1e-12 ? full : normalized;
}
function degreesToRadians(value2) {
  return value2 * Math.PI / 180;
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
function normalizedTolerance(value2, bounds2) {
  if (value2 !== void 0) {
    if (!Number.isFinite(value2) || value2 <= 0) throw new Error("TOPOLOGY_TOLERANCE_INVALID");
    return value2;
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
function normalizedCurveSamples(value2) {
  const samples = value2 ?? 64;
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
function unique(values2) {
  return [...new Set(values2)];
}
function digest$1(value2) {
  return portableDigest(value2);
}
function decodeDxfPairs(bytes) {
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^\uFEFF/, "");
  if (text.includes("\0")) {
    return rejected$2("DXF_NUL_BYTE", "DXF input contains a NUL byte");
  }
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length % 2 !== 0) {
    return rejected$2("DXF_GROUP_PAIR_INCOMPLETE", "DXF input ends without a value line", lines.length);
  }
  const pairs = [];
  for (let index = 0; index < lines.length; index += 2) {
    const codeText = lines[index].trim();
    if (!/^[+-]?\d+$/.test(codeText)) {
      return rejected$2("DXF_GROUP_CODE_INVALID", `Invalid DXF group code: ${codeText}`, index + 1);
    }
    const code = Number(codeText);
    if (!Number.isSafeInteger(code)) {
      return rejected$2("DXF_GROUP_CODE_INVALID", `Invalid DXF group code: ${codeText}`, index + 1);
    }
    pairs.push({ code, value: lines[index + 1].trim(), line: index + 1 });
  }
  const eof = pairs.at(-1);
  if ((eof == null ? void 0 : eof.code) !== 0 || eof.value !== "EOF") {
    return rejected$2("DXF_EOF_REQUIRED", "DXF input does not end with EOF", lines.length || 1);
  }
  return { pairs, diagnostics: [] };
}
function rejected$2(code, message, line2) {
  return {
    pairs: [],
    diagnostics: [{ severity: "error", code, message, ...line2 === void 0 ? {} : { line: line2 } }]
  };
}
const EPSILON = 1e-8;
function projectHatchPattern(pairs) {
  var _a3, _b;
  const subclassIndex = pairs.findIndex((pair2) => pair2.code === 100 && pair2.value.trim() === "AcDbHatch");
  if (subclassIndex < 0) return null;
  const header = pairs.slice(subclassIndex + 1);
  const boundaryCountIndex = header.findIndex((pair2) => pair2.code === 91);
  if (boundaryCountIndex < 0 || integerValue(header.slice(0, boundaryCountIndex), 70, 0) !== 0) return null;
  const pattern = ((_a3 = value$1(header.slice(0, boundaryCountIndex), 2)) == null ? void 0 : _a3.trim()) || "USER";
  const cursor = new PairCursor(header, boundaryCountIndex + 1);
  const boundaryCount = integer$1((_b = header[boundaryCountIndex]) == null ? void 0 : _b.value, 0);
  const boundaryPaths = [];
  for (let index = 0; index < boundaryCount; index += 1) {
    const flagsValue = cursor.number(92);
    if (flagsValue === void 0) return null;
    const flags = Math.trunc(flagsValue);
    const parsed = (flags & 2) === 2 ? parsePolylineBoundary(cursor) : parseEdgeBoundary(cursor);
    if (parsed === null) return null;
    boundaryPaths.push({ flags, closed: parsed.closed, edges: parsed.edges.map(toHatchBoundaryEdge) });
    if (!skipBoundaryReferences(cursor)) return null;
  }
  if (boundaryPaths.length === 0) return null;
  const remaining = header.slice(cursor.index);
  const patternAngle = numberValue(remaining, 52, 0);
  const patternScale = numberValue(remaining, 41, 1);
  if (!(patternScale > 0)) return null;
  const patternLineCountOffset = remaining.findIndex((pair2) => pair2.code === 78);
  if (patternLineCountOffset < 0) return null;
  cursor.index += patternLineCountOffset;
  const patternLineCount = Math.max(0, Math.trunc(cursor.number(78) ?? 0));
  const patternLines = [];
  for (let index = 0; index < patternLineCount; index += 1) {
    const angle = cursor.number(53);
    const base2 = cursor.point(43, 44, false);
    const offset = cursor.point(45, 46, false);
    const dashCount = Math.max(0, Math.trunc(cursor.number(79) ?? 0));
    if (angle === void 0 || base2 === void 0 || offset === void 0) return null;
    const dashLengths = [];
    for (let dashIndex = 0; dashIndex < dashCount; dashIndex += 1) {
      const dash = cursor.number(49);
      if (dash === void 0) return null;
      dashLengths.push(dash);
    }
    patternLines.push({ angle, base: base2, offset, dashLengths });
  }
  if (patternLines.length === 0) return null;
  const hatch = {
    version: 1,
    style: hatchStyle(integerValue(remaining, 75, 0)),
    elevation: numberValue(header.slice(0, boundaryCountIndex), 30, 0),
    extrusion: [
      numberValue(header.slice(0, boundaryCountIndex), 210, 0),
      numberValue(header.slice(0, boundaryCountIndex), 220, 0),
      numberValue(header.slice(0, boundaryCountIndex), 230, 1)
    ],
    boundaryPaths,
    patternLines,
    patternAngle,
    patternScale,
    double: integerValue(remaining, 77, 0) !== 0
  };
  const representative = transformPatternLine(patternLines[0], patternAngle, patternScale);
  const radians = representative.angle * Math.PI / 180;
  const spacing = Math.abs(dot(representative.offset, [-Math.sin(radians), Math.cos(radians)]));
  if (!(spacing > EPSILON)) return null;
  return { pattern, angle: clean(normalizeDegrees$1(representative.angle)), spacing: clean(spacing), hatch };
}
function parsePolylineBoundary(cursor) {
  const hasBulge = Math.trunc(cursor.number(72) ?? 0) !== 0;
  const closed = Math.trunc(cursor.number(73) ?? 0) !== 0;
  const vertexCount = Math.max(0, Math.trunc(cursor.number(93) ?? 0));
  const vertices = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const point = cursor.point(10, 20);
    const bulge = hasBulge && cursor.peekCode() === 42 ? cursor.number(42) ?? 0 : 0;
    if (point === void 0) return null;
    vertices.push({ point, bulge });
  }
  if (vertices.length < (closed ? 3 : 2)) return null;
  const edges = [];
  const edgeCount = closed ? vertices.length : vertices.length - 1;
  for (let index = 0; index < edgeCount; index += 1) {
    const current = vertices[index];
    const next = vertices[(index + 1) % vertices.length];
    edges.push(Math.abs(current.bulge) <= EPSILON ? { kind: "line", start: current.point, end: next.point } : bulgeArc(current.point, next.point, current.bulge));
  }
  return { edges, closed };
}
function parseEdgeBoundary(cursor) {
  const edgeCount = Math.max(0, Math.trunc(cursor.number(93) ?? 0));
  const edges = [];
  for (let index = 0; index < edgeCount; index += 1) {
    const type = Math.trunc(cursor.number(72) ?? 0);
    if (type === 1) {
      const start = cursor.point(10, 20);
      const end = cursor.point(11, 21);
      if (start === void 0 || end === void 0) return null;
      edges.push({ kind: "line", start, end });
    } else if (type === 2) {
      const center2 = cursor.point(10, 20);
      const radius = cursor.number(40);
      const startAngle = cursor.number(50);
      const endAngle = cursor.number(51);
      const counterClockwise = Math.trunc(cursor.number(73) ?? 0) !== 0;
      if (center2 === void 0 || !(radius && radius > 0) || startAngle === void 0 || endAngle === void 0) return null;
      edges.push({ kind: "arc", center: center2, radius, startAngle, endAngle, counterClockwise });
    } else if (type === 3) {
      const center2 = cursor.point(10, 20);
      const majorAxis = cursor.point(11, 21);
      const ratio = cursor.number(40);
      const startParam = cursor.number(50);
      const endParam = cursor.number(51);
      const counterClockwise = Math.trunc(cursor.number(73) ?? 0) !== 0;
      if (center2 === void 0 || majorAxis === void 0 || !(ratio && ratio > 0) || startParam === void 0 || endParam === void 0) return null;
      edges.push({ kind: "ellipse", center: center2, majorAxis, ratio, startParam, endParam, counterClockwise });
    } else if (type === 4) {
      const spline2 = parseSplineEdge(cursor);
      if (spline2 === null) return null;
      edges.push(spline2);
    } else return null;
  }
  return edges.length === 0 ? null : { edges, closed: true };
}
function parseSplineEdge(cursor) {
  const degree = Math.max(1, Math.trunc(cursor.number(94) ?? 0));
  const rational = Math.trunc(cursor.number(73) ?? 0) !== 0;
  const periodic = Math.trunc(cursor.number(74) ?? 0) !== 0;
  const knotCount = Math.max(0, Math.trunc(cursor.number(95) ?? 0));
  const controlCount = Math.max(0, Math.trunc(cursor.number(96) ?? 0));
  const knots = [];
  for (let index = 0; index < knotCount; index += 1) {
    const knot = cursor.number(40);
    if (knot === void 0) return null;
    knots.push(knot);
  }
  const controlPoints = [];
  const weights = [];
  for (let index = 0; index < controlCount; index += 1) {
    const point = cursor.point(10, 20);
    if (point === void 0) return null;
    controlPoints.push(point);
    if (rational) {
      const weight = cursor.number(42);
      if (!(weight && weight > 0)) return null;
      weights.push(weight);
    } else if (cursor.peekCode() === 42) cursor.number(42);
  }
  const fitPoints = [];
  if (cursor.peekCode() === 97) {
    const count = Math.max(0, Math.trunc(cursor.number(97) ?? 0));
    for (let index = 0; index < count; index += 1) {
      const point = cursor.point(11, 21);
      if (point === void 0) return null;
      fitPoints.push(point);
    }
  }
  if (controlPoints.length <= degree || knots.length !== controlPoints.length + degree + 1) return null;
  return {
    kind: "spline",
    degree,
    rational,
    periodic,
    controlPoints,
    knots,
    ...weights.length === controlPoints.length ? { weights } : {},
    ...fitPoints.length > 0 ? { fitPoints } : {}
  };
}
function toHatchBoundaryEdge(edge) {
  if (edge.kind === "line") return { type: "line", start: edge.start, end: edge.end };
  if (edge.kind === "arc") return { type: "arc", center: edge.center, radius: edge.radius, startAngle: edge.startAngle, endAngle: edge.endAngle, counterClockwise: edge.counterClockwise };
  if (edge.kind === "ellipse") return { type: "ellipse", center: edge.center, majorAxis: edge.majorAxis, axisRatio: edge.ratio, startParameter: edge.startParam, endParameter: edge.endParam, counterClockwise: edge.counterClockwise };
  return {
    type: "spline",
    degree: edge.degree,
    rational: edge.rational,
    periodic: edge.periodic,
    knots: edge.knots,
    controlPoints: edge.controlPoints,
    ...edge.weights === void 0 ? {} : { weights: edge.weights },
    ...edge.fitPoints === void 0 ? {} : { fitPoints: edge.fitPoints }
  };
}
function skipBoundaryReferences(cursor) {
  if (cursor.peekCode() !== 97) return true;
  const count = Math.max(0, Math.trunc(cursor.number(97) ?? 0));
  for (let index = 0; index < count; index += 1) if (cursor.number(330) === void 0) return false;
  return true;
}
function transformPatternLine(line2, angle, scale2) {
  const radians = angle * Math.PI / 180;
  const rotateScale = ([x, y]) => [
    scale2 * (x * Math.cos(radians) - y * Math.sin(radians)),
    scale2 * (x * Math.sin(radians) + y * Math.cos(radians))
  ];
  return {
    angle: line2.angle + angle,
    base: rotateScale(line2.base),
    offset: rotateScale(line2.offset),
    dashLengths: line2.dashLengths.map((value2) => value2 * scale2)
  };
}
function bulgeArc(start, end, bulge) {
  const chord = Math.hypot(end[0] - start[0], end[1] - start[1]);
  const sweep = 4 * Math.atan(bulge);
  const radius = Math.abs(chord / (2 * Math.sin(sweep / 2)));
  const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  const chordAngle = Math.atan2(end[1] - start[1], end[0] - start[0]);
  const offset = chord / (2 * Math.tan(sweep / 2));
  const center2 = [midpoint[0] - Math.sin(chordAngle) * offset, midpoint[1] + Math.cos(chordAngle) * offset];
  return {
    kind: "arc",
    center: center2,
    radius,
    startAngle: Math.atan2(start[1] - center2[1], start[0] - center2[0]) * 180 / Math.PI,
    endAngle: Math.atan2(end[1] - center2[1], end[0] - center2[0]) * 180 / Math.PI,
    counterClockwise: bulge > 0
  };
}
class PairCursor {
  constructor(pairs, index) {
    this.pairs = pairs;
    this.index = index;
  }
  peekCode() {
    var _a3;
    return (_a3 = this.pairs[this.index]) == null ? void 0 : _a3.code;
  }
  number(code) {
    const pair2 = this.pairs[this.index];
    if ((pair2 == null ? void 0 : pair2.code) !== code) return void 0;
    this.index += 1;
    const parsed = Number.parseFloat(pair2.value.trim());
    return Number.isFinite(parsed) ? parsed : void 0;
  }
  point(xCode, yCode, consumeZ = true) {
    const x = this.number(xCode);
    const y = this.number(yCode);
    if (x === void 0 || y === void 0) return void 0;
    if (consumeZ && this.peekCode() === xCode + 20) this.number(xCode + 20);
    return [x, y];
  }
}
function hatchStyle(value2) {
  return value2 === 1 ? "outer" : value2 === 2 ? "ignore" : "normal";
}
function value$1(pairs, code) {
  var _a3;
  return (_a3 = pairs.find((pair2) => pair2.code === code)) == null ? void 0 : _a3.value;
}
function numberValue(pairs, code, fallback) {
  var _a3;
  const parsed = Number.parseFloat(((_a3 = value$1(pairs, code)) == null ? void 0 : _a3.trim()) ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}
function integerValue(pairs, code, fallback) {
  return Math.trunc(numberValue(pairs, code, fallback));
}
function integer$1(input, fallback) {
  const parsed = Number.parseInt((input == null ? void 0 : input.trim()) ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function dot(first, second) {
  return first[0] * second[0] + first[1] * second[1];
}
function clean(input) {
  const rounded = Math.round(input * 1e9) / 1e9;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
function normalizeDegrees$1(input) {
  return (input % 360 + 360) % 360;
}
function projectHatch(record2, context) {
  const projected = projectHatchPattern(record2.pairs);
  if (projected === null) {
    context.diagnostics.push({
      severity: "warning",
      code: "DXF_HATCH_UNSUPPORTED",
      message: "HATCH semantics could not be parsed safely",
      ...record2.pairs[0] === void 0 ? {} : { line: record2.pairs[0].line }
    });
    return void 0;
  }
  const validation = normalizeHatchRegion(projected.hatch, hatchTolerance(projected.hatch));
  if (validation.status !== "ok") {
    context.diagnostics.push({
      severity: "warning",
      code: validation.code === "HATCH_BOUNDARY_OPEN" ? "DXF_HATCH_BOUNDARY_OPEN" : `DXF_${validation.code}`,
      message: `HATCH semantics retained but its boundary cannot be rendered: ${validation.code}`,
      ...record2.pairs[0] === void 0 ? {} : { line: record2.pairs[0].line }
    });
  }
  return {
    id: context.nodeId(record2, "annotation"),
    type: "section-hatch",
    visible: true,
    quality: { status: "confirmed", evidenceRefs: [] },
    sourceRef: sourceRef(record2, context.sourceId),
    pattern: projected.pattern,
    angle: projected.angle,
    spacing: projected.spacing,
    hatch: projected.hatch
  };
}
function hatchTolerance(hatch) {
  const coordinates2 = hatch.boundaryPaths.flatMap(({ edges }) => edges.flatMap((edge) => {
    if (edge.type === "line") return [...edge.start, ...edge.end];
    if (edge.type === "arc") return [...edge.center, edge.radius];
    if (edge.type === "ellipse") return [...edge.center, ...edge.majorAxis];
    return edge.controlPoints.flat();
  }));
  const extent = Math.max(...coordinates2.map(Math.abs), 1);
  return Math.min(0.05, Math.max(1e-6, extent * 1e-6));
}
function readEntityRecords(pairs) {
  const records = [];
  let current = null;
  for (const pair2 of pairs) {
    if (pair2.code === 0) {
      if (current !== null) records.push(current);
      current = { type: pair2.value.toUpperCase(), pairs: [], index: records.length };
    } else if (current !== null) {
      current.pairs.push(pair2);
    }
  }
  if (current !== null) records.push(current);
  return records;
}
function projectEntity(record2, context) {
  if (number$2(record2, 67, 0) === 1) {
    context.diagnostics.push(diagnostic(record2, "info", "DXF_PAPER_SPACE_ENTITY_IGNORED", "Paper-space entity ignored"));
    return null;
  }
  try {
    if (record2.type === "LINE") return { geometry: line(record2, context) };
    if (record2.type === "ARC") return { geometry: arc(record2, context) };
    if (record2.type === "SPLINE") return { geometry: spline(record2, context) };
    if (record2.type === "HATCH") return { annotation: projectHatch(record2, context) };
    if (record2.type === "VIEWPORT") {
      context.diagnostics.push(diagnostic(record2, "info", "DXF_VIEWPORT_IGNORED", "DXF VIEWPORT is presentation metadata, not drawing geometry"));
      return null;
    }
    context.diagnostics.push(diagnostic(record2, "warning", "DXF_ENTITY_UNSUPPORTED", `Unsupported DXF entity ${record2.type}`));
    return null;
  } catch (error) {
    context.diagnostics.push(diagnostic(
      record2,
      "error",
      "DXF_ENTITY_INVALID",
      error instanceof Error ? error.message : String(error)
    ));
    return null;
  }
}
function value(record2, code) {
  var _a3;
  return (_a3 = record2.pairs.find((pair2) => pair2.code === code)) == null ? void 0 : _a3.value;
}
function values(record2, code) {
  return record2.pairs.filter((pair2) => pair2.code === code).map((pair2) => pair2.value);
}
function number$2(record2, code, fallback) {
  const raw = value(record2, code);
  if (raw === void 0) {
    if (fallback !== void 0) return fallback;
    throw new TypeError(`DXF_${record2.type}_${code}_REQUIRED`);
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) throw new TypeError(`DXF_${record2.type}_${code}_INVALID`);
  return parsed;
}
function numbers(record2, code) {
  return values(record2, code).map((raw) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) throw new TypeError(`DXF_${record2.type}_${code}_INVALID`);
    return parsed;
  });
}
function coordinates(record2, xCode = 10, yCode = 20) {
  const output = [];
  let pendingX;
  for (const pair2 of record2.pairs) {
    if (pair2.code === xCode) {
      const x = Number(pair2.value);
      if (!Number.isFinite(x)) throw new TypeError(`DXF_${record2.type}_${xCode}_INVALID`);
      pendingX = x;
    } else if (pair2.code === yCode && pendingX !== void 0) {
      const y = Number(pair2.value);
      if (!Number.isFinite(y)) throw new TypeError(`DXF_${record2.type}_${yCode}_INVALID`);
      output.push([pendingX, y]);
      pendingX = void 0;
    }
  }
  return output;
}
function sourceRef(record2, sourceId) {
  return {
    sourceId,
    ...value(record2, 5) === void 0 ? {} : { objectId: value(record2, 5) },
    objectType: record2.type,
    layer: value(record2, 8) ?? "0"
  };
}
function line(record2, context) {
  return {
    ...base(record2, context, "geometry"),
    type: "line",
    start: [number$2(record2, 10), number$2(record2, 20)],
    end: [number$2(record2, 11), number$2(record2, 21)]
  };
}
function arc(record2, context) {
  const radius = number$2(record2, 40);
  if (!(radius > 0)) throw new TypeError("DXF_ARC_RADIUS_INVALID");
  return {
    ...base(record2, context, "geometry"),
    type: "arc",
    center: [number$2(record2, 10), number$2(record2, 20)],
    radius,
    startAngle: number$2(record2, 50),
    endAngle: number$2(record2, 51),
    counterClockwise: true
  };
}
function spline(record2, context) {
  const flags = number$2(record2, 70, 0);
  const controlPoints = coordinates(record2);
  const degree = number$2(record2, 71);
  const declaredControlPoints = number$2(record2, 73, controlPoints.length);
  if (controlPoints.length !== declaredControlPoints) throw new TypeError("DXF_SPLINE_CONTROL_POINT_COUNT_MISMATCH");
  return {
    ...base(record2, context, "geometry"),
    type: "spline",
    degree,
    controlPoints,
    knots: numbers(record2, 40),
    ...values(record2, 41).length === 0 ? {} : { weights: numbers(record2, 41) },
    closed: (flags & 1) !== 0,
    periodic: (flags & 2) !== 0
  };
}
function base(record2, context, plane) {
  return {
    id: context.nodeId(record2, plane),
    visible: true,
    quality: { status: "confirmed", evidenceRefs: [] },
    sourceRef: sourceRef(record2, context.sourceId)
  };
}
function diagnostic(record2, severity, code, message) {
  return {
    severity,
    code,
    message,
    ...record2.pairs[0] === void 0 ? {} : { line: record2.pairs[0].line },
    ...value(record2, 5) === void 0 ? {} : { sourceHandle: value(record2, 5) }
  };
}
function indexDxfSections(pairs) {
  const sections = {};
  for (let index = 0; index < pairs.length - 1; index += 1) {
    if (pairs[index].code !== 0 || pairs[index].value !== "SECTION") continue;
    const namePair = pairs[index + 1];
    if (namePair.code !== 2) continue;
    let end = index + 2;
    while (end < pairs.length && !(pairs[end].code === 0 && pairs[end].value === "ENDSEC")) end += 1;
    const section = { name: namePair.value, pairs: pairs.slice(index + 2, end) };
    if (namePair.value === "HEADER") sections.header = section;
    else if (namePair.value === "TABLES") sections.tables = section;
    else if (namePair.value === "BLOCKS") sections.blocks = section;
    else if (namePair.value === "ENTITIES") sections.entities = section;
    index = end;
  }
  return sections;
}
function importDxf(request) {
  const decoded = decodeDxfPairs(request.bytes);
  if (decoded.diagnostics.some(({ severity }) => severity === "error")) {
    return { status: "rejected", diagnostics: decoded.diagnostics };
  }
  const diagnostics = [...decoded.diagnostics];
  const structureError = validateSectionStructure(decoded.pairs);
  if (structureError !== null) return rejected$1(diagnostics, "DXF_SECTION_STRUCTURE_INVALID", structureError);
  const sections = indexDxfSections(decoded.pairs);
  if (sections.header === void 0 || sections.entities === void 0) {
    return rejected$1(diagnostics, "DXF_REQUIRED_SECTION_MISSING", "DXF HEADER and ENTITIES sections are required");
  }
  const unit = readUnit(sections.header.pairs);
  if (unit === null) return rejected$1(diagnostics, "DXF_UNITS_REQUIRED", "DXF $INSUNITS must be mm, cm, or m");
  const records = readEntityRecords(sections.entities.pairs);
  const counts = {};
  for (const record2 of records) counts[record2.type] = (counts[record2.type] ?? 0) + 1;
  const sourceId = `source:${request.source.digest}`;
  const document = createEmptyDrawing({
    unit,
    idFactory: { next: () => request.drawingId },
    now: request.now
  });
  document.id = request.drawingId;
  document.sources = [{
    id: sourceId,
    kind: "dxf",
    mediaType: "application/dxf",
    digest: request.source.digest,
    bytes: request.bytes.byteLength,
    ...request.source.name === void 0 ? {} : { name: request.source.name }
  }];
  for (const record2 of records) {
    const projected = projectEntity(record2, {
      sourceId,
      diagnostics,
      nodeId: stableNodeId(request.source.digest, record2)
    });
    if ((projected == null ? void 0 : projected.geometry) !== void 0) document.geometry.push(projected.geometry);
    if ((projected == null ? void 0 : projected.annotation) !== void 0) document.annotations.push(projected.annotation);
  }
  if (diagnostics.some(({ severity }) => severity === "error")) return { status: "rejected", diagnostics };
  const validationError = validateDocument$1(document);
  if (validationError !== null) return rejected$1(diagnostics, "DXF_DOCUMENT_INVALID", validationError);
  const bounds2 = drawingGeometryBounds(document);
  if (bounds2 === null) return rejected$1(diagnostics, "DXF_DRAWABLE_GEOMETRY_REQUIRED", "DXF contains no supported drawable geometry");
  return { status: "imported", document, bounds: bounds2, diagnostics, counts };
}
function validateSectionStructure(pairs) {
  var _a3;
  let open = false;
  for (let index = 0; index < pairs.length; index += 1) {
    const pair2 = pairs[index];
    if (pair2.code === 0 && pair2.value === "SECTION") {
      if (open) return "Nested DXF SECTION is not allowed";
      if (((_a3 = pairs[index + 1]) == null ? void 0 : _a3.code) !== 2) return "DXF SECTION name is missing";
      open = true;
    } else if (pair2.code === 0 && pair2.value === "ENDSEC") {
      if (!open) return "DXF ENDSEC has no matching SECTION";
      open = false;
    }
  }
  return open ? "DXF SECTION is missing ENDSEC" : null;
}
function validateDocument$1(document) {
  const ids = [...document.geometry.map(({ id }) => String(id)), ...document.annotations.map(({ id }) => String(id))];
  if (new Set(ids).size !== ids.length) return "Projected entity IDs are not unique";
  const walk = (value2) => {
    if (typeof value2 === "number") return Number.isFinite(value2);
    if (Array.isArray(value2)) return value2.every(walk);
    if (value2 !== null && typeof value2 === "object") return Object.values(value2).every(walk);
    return true;
  };
  return walk(document) ? null : "Projected document contains non-finite values";
}
function readUnit(pairs) {
  const variable = pairs.findIndex((pair2) => pair2.code === 9 && pair2.value === "$INSUNITS");
  if (variable < 0) return null;
  const code = pairs.slice(variable + 1).find((pair2) => pair2.code === 70);
  if ((code == null ? void 0 : code.value) === "4") return "mm";
  if ((code == null ? void 0 : code.value) === "5") return "cm";
  if ((code == null ? void 0 : code.value) === "6") return "m";
  return null;
}
function stableNodeId(digest2, record2) {
  var _a3, _b;
  const digestPart = digest2.replace(/[^a-zA-Z0-9_-]/g, "_").slice(-24) || "source";
  const handle = ((_b = (_a3 = record2.pairs.find((pair2) => pair2.code === 5)) == null ? void 0 : _a3.value) == null ? void 0 : _b.replace(/[^a-zA-Z0-9_-]/g, "_")) ?? String(record2.index);
  return (_record, plane) => `${plane}:${digestPart}:${handle}:${record2.index}`;
}
function drawingGeometryBounds(document) {
  const bounds2 = document.geometry.map(geometryBounds).filter((item) => item !== null);
  if (bounds2.length === 0) return null;
  return bounds2.reduce((combined, current) => ({
    minX: Math.min(combined.minX, current.minX),
    minY: Math.min(combined.minY, current.minY),
    maxX: Math.max(combined.maxX, current.maxX),
    maxY: Math.max(combined.maxY, current.maxY)
  }));
}
function geometryBounds(node) {
  if (node.type === "line") return pointsBounds([node.start, node.end]);
  if (node.type === "arc") return arcBounds(node);
  if (node.type === "spline") return splineBounds(node);
  if (node.type === "point") return pointsBounds([[node.x, node.y]]);
  if (node.type === "circle") return {
    minX: node.center[0] - node.radius,
    minY: node.center[1] - node.radius,
    maxX: node.center[0] + node.radius,
    maxY: node.center[1] + node.radius
  };
  if (node.type === "polyline") return pointsBounds(node.vertices.map(({ point }) => point));
  if (node.type === "ellipse") {
    const major = Math.hypot(...node.majorAxis);
    return {
      minX: node.center[0] - major,
      minY: node.center[1] - major,
      maxX: node.center[0] + major,
      maxY: node.center[1] + major
    };
  }
  return null;
}
function arcBounds(node) {
  const angles = [node.startAngle, node.endAngle, ...[0, 90, 180, 270].filter((angle) => angleOnArc(
    angle,
    node.startAngle,
    node.endAngle
  ))];
  return pointsBounds(angles.map((angle) => {
    const radians = angle * Math.PI / 180;
    return [node.center[0] + node.radius * Math.cos(radians), node.center[1] + node.radius * Math.sin(radians)];
  }));
}
function angleOnArc(angle, start, end) {
  return modulo(angle - start, 360) <= modulo(end - start, 360);
}
function modulo(value2, divisor) {
  return (value2 % divisor + divisor) % divisor;
}
function pointsBounds(points) {
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function rejected$1(diagnostics, code, message) {
  return { status: "rejected", diagnostics: [...diagnostics, { severity: "error", code, message }] };
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
  const values2 = Object.entries(entries).filter(([k, _]) => numericValues.indexOf(+k) === -1).map(([_, v]) => v);
  return values2;
}
function jsonStringifyReplacer(_, value2) {
  if (typeof value2 === "bigint")
    return value2.toString();
  return value2;
}
function cached(getter) {
  return {
    get value() {
      {
        const value2 = getter();
        Object.defineProperty(this, "value", { value: value2 });
        return value2;
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
  let value2 = void 0;
  Object.defineProperty(object2, key, {
    get() {
      if (value2 === EVALUATING) {
        return void 0;
      }
      if (value2 === void 0) {
        value2 = EVALUATING;
        value2 = getter();
      }
      return value2;
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
function assignProp(target, prop, value2) {
  Object.defineProperty(target, prop, {
    value: value2,
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
const _parse = (_Err) => (schema, value2, _ctx, _params) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value: value2, issues: [] }, ctx);
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
const _parseAsync = (_Err) => async (schema, value2, _ctx, params) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value: value2, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  if (result.issues.length) {
    const e = new ((params == null ? void 0 : params.Err) ?? _Err)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())));
    captureStackTrace(e, params == null ? void 0 : params.callee);
    throw e;
  }
  return result.value;
};
const _safeParse = (_Err) => (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: false } : { async: false };
  const result = schema._zod.run({ value: value2, issues: [] }, ctx);
  if (result instanceof Promise) {
    throw new $ZodAsyncError();
  }
  return result.issues.length ? {
    success: false,
    error: new (_Err ?? $ZodError)(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParse$1 = /* @__PURE__ */ _safeParse($ZodRealError);
const _safeParseAsync = (_Err) => async (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, async: true } : { async: true };
  let result = schema._zod.run({ value: value2, issues: [] }, ctx);
  if (result instanceof Promise)
    result = await result;
  return result.issues.length ? {
    success: false,
    error: new _Err(result.issues.map((iss) => finalizeIssue(iss, ctx, config())))
  } : { success: true, data: result.value };
};
const safeParseAsync$1 = /* @__PURE__ */ _safeParseAsync($ZodRealError);
const _encode = (_Err) => (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parse(_Err)(schema, value2, ctx);
};
const _decode = (_Err) => (schema, value2, _ctx) => {
  return _parse(_Err)(schema, value2, _ctx);
};
const _encodeAsync = (_Err) => async (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _parseAsync(_Err)(schema, value2, ctx);
};
const _decodeAsync = (_Err) => async (schema, value2, _ctx) => {
  return _parseAsync(_Err)(schema, value2, _ctx);
};
const _safeEncode = (_Err) => (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParse(_Err)(schema, value2, ctx);
};
const _safeDecode = (_Err) => (schema, value2, _ctx) => {
  return _safeParse(_Err)(schema, value2, _ctx);
};
const _safeEncodeAsync = (_Err) => async (schema, value2, _ctx) => {
  const ctx = _ctx ? { ..._ctx, direction: "backward" } : { direction: "backward" };
  return _safeParseAsync(_Err)(schema, value2, ctx);
};
const _safeDecodeAsync = (_Err) => async (schema, value2, _ctx) => {
  return _safeParseAsync(_Err)(schema, value2, _ctx);
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
const string$2 = (params) => {
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
    for (const line2 of dedented) {
      this.content.push(line2);
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
    validate: (value2) => {
      var _a5;
      try {
        const r = safeParse$1(inst, value2);
        return r.success ? { value: r.data } : { issues: (_a5 = r.error) == null ? void 0 : _a5.issues };
      } catch (_) {
        return safeParseAsync$1(inst, value2).then((r) => {
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
  inst._zod.pattern = [...((_a3 = inst == null ? void 0 : inst._zod.bag) == null ? void 0 : _a3.patterns) ?? []].pop() ?? string$2(inst._zod.bag);
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
  let value2;
  inst._zod.parse = (payload, ctx) => {
    value2 ?? (value2 = _normalized.value);
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
    const shape = value2.shape;
    for (const key of value2.keys) {
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
  let value2;
  inst._zod.parse = (payload, ctx) => {
    value2 ?? (value2 = _normalized.value);
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
      return handleCatchall([], input, payload, ctx, value2, inst);
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
      const values2 = (_a3 = o._zod.propValues) == null ? void 0 : _a3[def.discriminator];
      if (!values2 || values2.size === 0)
        throw new Error(`Invalid discriminated union option at index "${def.options.indexOf(o)}"`);
      for (const v of values2) {
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
    const values2 = def.keyType._zod.values;
    if (values2) {
      payload.value = {};
      const recordKeys = /* @__PURE__ */ new Set();
      for (const key of values2) {
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
  const values2 = getEnumValues(def.entries);
  const valuesSet = new Set(values2);
  inst._zod.values = valuesSet;
  inst._zod.pattern = new RegExp(`^(${values2.filter((k) => propertyKeyTypes.has(typeof k)).map((o) => typeof o === "string" ? escapeRegex(o) : o.toString()).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (valuesSet.has(input)) {
      return payload;
    }
    payload.issues.push({
      code: "invalid_value",
      values: values2,
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
  const values2 = new Set(def.values);
  inst._zod.values = values2;
  inst._zod.pattern = new RegExp(`^(${def.values.map((o) => typeof o === "string" ? escapeRegex(o) : o ? escapeRegex(o.toString()) : String(o)).join("|")})$`);
  inst._zod.parse = (payload, _ctx) => {
    const input = payload.value;
    if (values2.has(input)) {
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
function _lt(value2, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _lte(value2, params) {
  return new $ZodCheckLessThan({
    check: "less_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _gt(value2, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: false
  });
}
// @__NO_SIDE_EFFECTS__
function _gte(value2, params) {
  return new $ZodCheckGreaterThan({
    check: "greater_than",
    ...normalizeParams(params),
    value: value2,
    inclusive: true
  });
}
// @__NO_SIDE_EFFECTS__
function _multipleOf(value2, params) {
  return new $ZodCheckMultipleOf({
    check: "multiple_of",
    ...normalizeParams(params),
    value: value2
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
  const values2 = getEnumValues(def.entries);
  if (values2.every((v) => typeof v === "number"))
    json.type = "number";
  if (values2.every((v) => typeof v === "string"))
    json.type = "string";
  json.enum = values2;
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
      return array$1(this);
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
function string$1(params) {
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
    gt(value2, params) {
      return this.check(/* @__PURE__ */ _gt(value2, params));
    },
    gte(value2, params) {
      return this.check(/* @__PURE__ */ _gte(value2, params));
    },
    min(value2, params) {
      return this.check(/* @__PURE__ */ _gte(value2, params));
    },
    lt(value2, params) {
      return this.check(/* @__PURE__ */ _lt(value2, params));
    },
    lte(value2, params) {
      return this.check(/* @__PURE__ */ _lte(value2, params));
    },
    max(value2, params) {
      return this.check(/* @__PURE__ */ _lte(value2, params));
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
    multipleOf(value2, params) {
      return this.check(/* @__PURE__ */ _multipleOf(value2, params));
    },
    step(value2, params) {
      return this.check(/* @__PURE__ */ _multipleOf(value2, params));
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
function array$1(element, params) {
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
function object$1(shape, params) {
  const def = {
    type: "object",
    shape: shape ?? {},
    ...normalizeParams(params)
  };
  return new ZodObject(def);
}
function strictObject(shape, params) {
  return new ZodObject({
    type: "object",
    shape,
    catchall: never(),
    ...normalizeParams(params)
  });
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
      keyType: string$1(),
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
  inst.extract = (values2, params) => {
    const newEntries = {};
    for (const value2 of values2) {
      if (keys.has(value2)) {
        newEntries[value2] = def.entries[value2];
      } else
        throw new Error(`Key ${value2} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
  inst.exclude = (values2, params) => {
    const newEntries = { ...def.entries };
    for (const value2 of values2) {
      if (keys.has(value2)) {
        delete newEntries[value2];
      } else
        throw new Error(`Key ${value2} not found in enum`);
    }
    return new ZodEnum({
      ...def,
      checks: [],
      ...normalizeParams(params),
      entries: newEntries
    });
  };
});
function _enum(values2, params) {
  const entries = Array.isArray(values2) ? Object.fromEntries(values2.map((v) => [v, v])) : values2;
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
function literal$1(value2, params) {
  return new ZodLiteral({
    type: "literal",
    values: Array.isArray(value2) ? value2 : [value2],
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
function _instanceof(cls, params = {}) {
  const inst = new ZodCustom({
    type: "custom",
    check: "custom",
    fn: (data) => data instanceof cls,
    abort: true,
    ...normalizeParams(params)
  });
  inst._zod.bag.Class = cls;
  inst._zod.check = (payload) => {
    if (!(payload.value instanceof cls)) {
      payload.issues.push({
        code: "invalid_type",
        expected: cls.name,
        input: payload.value,
        inst,
        path: [...inst._zod.def.path ?? []]
      });
    }
  };
  return inst;
}
const ZodIssueCode = {
  custom: "custom"
};
const protocolIdSchema = string$1().trim().min(1).max(256);
const contentDigestSchema = string$1().trim().min(1).max(512);
const idSchema$4 = protocolIdSchema;
const digestSchema$1 = contentDigestSchema;
const drawingRefSchema$1 = object$1({
  drawingId: idSchema$4,
  revision: number().int().nonnegative()
}).strict();
const editBasisSchema = discriminatedUnion("kind", [
  object$1({
    kind: literal$1("canonical"),
    ref: drawingRefSchema$1
  }).strict(),
  object$1({
    kind: literal$1("preview"),
    baseRef: drawingRefSchema$1,
    previewHandle: idSchema$4,
    previewDigest: digestSchema$1
  }).strict(),
  object$1({
    kind: literal$1("carried-candidate"),
    handoffId: idSchema$4,
    taskId: idSchema$4,
    originTaskId: idSchema$4,
    baseRef: drawingRefSchema$1,
    candidateDigest: digestSchema$1
  }).strict()
]);
const observationArtifactRefSchema = object$1({
  id: idSchema$4,
  contentDigest: digestSchema$1,
  mimeType: _enum(["image/png", "image/webp"]),
  basis: editBasisSchema
}).strict();
object$1({
  taskId: idSchema$4,
  rootUserMessageDigest: digestSchema$1,
  authoritativeObjectiveDigest: digestSchema$1,
  baseRef: drawingRefSchema$1,
  policy: _enum(["review", "auto-safe"]),
  stateEpoch: number().int().nonnegative()
}).strict();
object$1({
  observationId: idSchema$4,
  taskId: idSchema$4,
  basis: editBasisSchema,
  artifactRefs: array$1(observationArtifactRefSchema).max(16),
  selectionProjectionId: idSchema$4.optional(),
  observationDigest: digestSchema$1
}).strict();
object$1({
  contextId: idSchema$4,
  taskId: idSchema$4,
  observationId: idSchema$4,
  contextDigest: digestSchema$1
}).strict();
object$1({
  groundingId: idSchema$4,
  taskId: idSchema$4,
  contextId: idSchema$4,
  targetHandle: idSchema$4,
  targetNodeIds: array$1(idSchema$4).min(1).max(256),
  interfaces: array$1(object$1({
    interfaceId: idSchema$4,
    nodeId: idSchema$4,
    endpoint: _enum(["start", "end"])
  }).strict()).max(256),
  targetScopeDigest: digestSchema$1,
  protectedScopeDigest: digestSchema$1,
  evidenceDigest: digestSchema$1
}).strict();
object$1({
  previewHandle: idSchema$4,
  taskId: idSchema$4,
  groundingId: idSchema$4,
  groundingIds: array$1(idSchema$4).min(2).max(16).optional(),
  baseRef: drawingRefSchema$1,
  candidateDigest: digestSchema$1,
  effectDigest: digestSchema$1,
  finalizeOperationId: idSchema$4,
  finalizeOperationBindingDigest: digestSchema$1
}).strict().superRefine(({ groundingId, groundingIds }, context) => {
  if (groundingIds === void 0) return;
  if (groundingIds[0] !== groundingId || new Set(groundingIds).size !== groundingIds.length) {
    context.addIssue({ code: "custom", path: ["groundingIds"], message: "EDIT_GROUNDING_SET_INVALID" });
  }
});
object$1({
  evaluationId: idSchema$4,
  taskId: idSchema$4,
  previewHandle: idSchema$4,
  candidateDigest: digestSchema$1,
  evaluationDigest: digestSchema$1
}).strict();
const selectionProjectionRefSchema = object$1({
  selectionProjectionId: idSchema$4,
  drawingRef: drawingRefSchema$1,
  nodeIds: array$1(idSchema$4).min(1).max(256),
  projectionDigest: digestSchema$1,
  expiresAt: number().int().nonnegative()
}).strict();
const boundedTextSchema$2 = string$1().trim().min(1).max(2e3);
const boundsSchema$1 = object$1({
  minX: number().finite(),
  minY: number().finite(),
  maxX: number().finite(),
  maxY: number().finite()
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY);
const diagnosticSchema = object$1({
  code: protocolIdSchema,
  severity: _enum(["info", "candidate", "warning", "decision_required", "error"]),
  message: boundedTextSchema$2,
  nodeIds: array$1(protocolIdSchema).max(256).optional(),
  action: boundedTextSchema$2.optional(),
  facts: record(string$1(), unknown()).optional(),
  scopeDigest: contentDigestSchema.optional(),
  hard: boolean().optional()
}).strict();
const authoritativeObjectiveSchema = object$1({
  text: string$1().trim().min(1).max(8e3),
  attachmentContentDigests: array$1(contentDigestSchema).max(16)
}).strict();
const resolvedDefectSchema = object$1({
  defectId: protocolIdSchema,
  scopeDigest: contentDigestSchema,
  evidenceDigests: array$1(contentDigestSchema).min(1).max(32)
}).strict();
const reviewEvidenceSchema = object$1({
  kind: literal$1("reviewer"),
  provider: protocolIdSchema,
  providerVersion: protocolIdSchema,
  authoritativeObjective: authoritativeObjectiveSchema,
  renderManifest: object$1({
    rendererVersion: protocolIdSchema,
    beforeContentDigest: contentDigestSchema,
    afterContentDigest: contentDigestSchema,
    artifactContentDigest: contentDigestSchema,
    comparisonLayout: literal$1("before | after"),
    worldToImage: tuple([
      number().finite(),
      number().finite(),
      number().finite(),
      number().finite(),
      number().finite(),
      number().finite()
    ]),
    viewport: boundsSchema$1,
    width: number().int().positive().max(8192),
    height: number().int().positive().max(8192),
    overlays: array$1(protocolIdSchema).max(32)
  }).strict(),
  outcome: _enum(["satisfied", "needs_revision", "unavailable"]),
  defects: array$1(object$1({
    defectId: protocolIdSchema,
    code: protocolIdSchema,
    reason: boundedTextSchema$2,
    scopeDigest: contentDigestSchema
  }).strict()).max(64),
  resolvedDefects: array$1(resolvedDefectSchema).max(64)
}).strict();
const assessmentBase = {
  assessmentId: protocolIdSchema,
  taskId: protocolIdSchema,
  drawingId: protocolIdSchema,
  baseRef: drawingRefSchema$1,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  evaluationDigest: contentDigestSchema,
  policyVersion: protocolIdSchema,
  evaluatorVersions: array$1(protocolIdSchema).min(1).max(64),
  effectDigest: contentDigestSchema,
  reasons: array$1(protocolIdSchema).max(64)
};
const assessmentSchema = discriminatedUnion("disposition", [
  object$1({
    ...assessmentBase,
    disposition: literal$1("blocked"),
    hardDeny: boolean(),
    nonOverridableProtected: boolean()
  }).strict(),
  object$1({
    ...assessmentBase,
    disposition: literal$1("confirmation_required"),
    requiredEffectDigest: contentDigestSchema
  }).strict(),
  object$1({
    ...assessmentBase,
    disposition: literal$1("auto_safe"),
    autoQualification: object$1({
      exactScope: literal$1(true),
      cleanDiagnostics: literal$1(true),
      sourceConfirmed: literal$1(true),
      reviewerSatisfied: literal$1(true),
      inverseVerified: literal$1(true)
    }).strict()
  }).strict()
]);
object$1({
  evaluationId: protocolIdSchema,
  taskId: protocolIdSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  diagnostics: array$1(diagnosticSchema).max(256),
  mandatoryEvaluatorVersions: array$1(protocolIdSchema).min(1).max(64),
  review: reviewEvidenceSchema,
  evaluationDigest: contentDigestSchema
}).strict();
const idSchema$3 = string$1().trim().min(1).max(256);
const digestSchema = string$1().trim().min(1).max(512);
const finalizePreviewRequestSchema = object$1({
  previewHandle: idSchema$3,
  previewDigest: digestSchema,
  finalizeOperationId: idSchema$3,
  finalizeOperationBindingDigest: digestSchema,
  evaluationId: idSchema$3
}).strict();
const finalizePreviewResultSchema = discriminatedUnion("status", [
  object$1({
    status: literal$1("committed"),
    mode: _enum(["auto-safe", "confirmed"]),
    commitId: idSchema$3,
    ref: drawingRefSchema$1,
    operationId: idSchema$3,
    operationBindingDigest: digestSchema
  }).strict(),
  object$1({
    status: literal$1("already-satisfied"),
    ref: drawingRefSchema$1,
    operationId: idSchema$3,
    operationBindingDigest: digestSchema
  }).strict(),
  object$1({
    status: literal$1("root-required"),
    message: string$1().trim().min(1).max(2e3)
  }).strict(),
  object$1({
    status: literal$1("needs-revision"),
    evaluationId: idSchema$3,
    reasons: array$1(string$1().trim().min(1).max(1e3)).min(1).max(64)
  }).strict(),
  object$1({
    status: literal$1("discarded"),
    ref: drawingRefSchema$1
  }).strict(),
  object$1({
    status: literal$1("rejected"),
    disposition: _enum(["blocked", "confirmation_required"]),
    code: idSchema$3,
    message: string$1().trim().min(1).max(2e3)
  }).strict(),
  object$1({
    status: literal$1("outcome-unknown"),
    operationId: idSchema$3,
    operationBindingDigest: digestSchema
  }).strict()
]);
const idSchema$2 = string$1().trim().min(1).max(256);
const boundedTextSchema$1 = string$1().trim().min(1).max(2e3);
const finiteSchema$1 = number().finite();
const vec2Schema$2 = tuple([finiteSchema$1, finiteSchema$1]);
const multiPartTransformPartSchema = object$1({
  groundingId: idSchema$2,
  translation: vec2Schema$2,
  rotationRadians: finiteSchema$1.optional(),
  pivot: vec2Schema$2.optional()
}).strict().superRefine(({ rotationRadians, pivot }, context) => {
  if (rotationRadians === void 0 !== (pivot === void 0)) {
    context.addIssue({
      code: "custom",
      message: "EDIT_ROTATION_PIVOT_PAIR_REQUIRED"
    });
  }
});
const multiPartTransformRequestShape = {
  taskId: idSchema$2,
  parts: array$1(multiPartTransformPartSchema).min(2).max(16),
  summary: boundedTextSchema$1
};
function validateUniqueGroundings({ parts }, context) {
  const groundingIds = /* @__PURE__ */ new Set();
  for (const [index, part] of parts.entries()) {
    if (groundingIds.has(part.groundingId)) {
      context.addIssue({
        code: "custom",
        path: ["parts", index, "groundingId"],
        message: "EDIT_GROUNDING_DUPLICATE"
      });
    }
    groundingIds.add(part.groundingId);
  }
}
const multiPartTransformRequestSchema = object$1({
  ...multiPartTransformRequestShape
}).strict().superRefine(validateUniqueGroundings);
const multiPartTransformRevisionRequestSchema = object$1({
  ...multiPartTransformRequestShape,
  currentPreviewHandle: idSchema$2,
  currentCandidateDigest: idSchema$2
}).strict().superRefine(validateUniqueGroundings);
const idSchema$1 = string$1().trim().min(1).max(256);
const boundedTextSchema = string$1().trim().min(1).max(2e3);
const finiteSchema = number().finite();
const vec2Schema$1 = tuple([finiteSchema, finiteSchema]);
const boundsSchema = object$1({
  minX: finiteSchema,
  minY: finiteSchema,
  maxX: finiteSchema,
  maxY: finiteSchema
}).strict().refine(
  ({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY,
  { message: "INVALID_BOUNDS" }
);
const effectScopeRefSchema = discriminatedUnion("kind", [
  object$1({
    kind: literal$1("node-field"),
    nodeId: idSchema$1,
    fields: array$1(idSchema$1).min(1).max(64)
  }).strict(),
  object$1({
    kind: literal$1("source-span"),
    nodeId: idSchema$1,
    start: number().int().nonnegative(),
    end: number().int().positive()
  }).strict().refine(({ start, end }) => start < end, { message: "INVALID_SOURCE_SPAN" }),
  object$1({
    kind: literal$1("half-edge"),
    nodeId: idSchema$1,
    halfEdgeId: idSchema$1
  }).strict(),
  object$1({
    kind: literal$1("interface"),
    interfaceId: idSchema$1
  }).strict(),
  object$1({
    kind: literal$1("endpoint-slot"),
    nodeId: idSchema$1,
    endpoint: _enum(["start", "end"])
  }).strict(),
  object$1({
    kind: literal$1("creation"),
    plane: _enum(["geometry", "annotation", "relation", "feature"]),
    nodeType: idSchema$1,
    containerId: idSchema$1.optional(),
    maxCount: number().int().min(1).max(256)
  }).strict(),
  object$1({
    kind: literal$1("deletion"),
    nodeIds: array$1(idSchema$1).min(1).max(256)
  }).strict()
]);
const spatialOperationSchema = discriminatedUnion("kind", [
  object$1({
    kind: literal$1("rigid_transform"),
    translation: vec2Schema$1,
    rotationRadians: finiteSchema,
    pivot: vec2Schema$1
  }).strict(),
  object$1({
    kind: literal$1("connected_transform"),
    translation: vec2Schema$1,
    rotationRadians: finiteSchema.optional(),
    pivot: vec2Schema$1.optional(),
    interfaceIds: array$1(idSchema$1).min(1).max(256)
  }).strict(),
  object$1({
    kind: literal$1("set_endpoint"),
    nodeId: idSchema$1,
    endpoint: _enum(["start", "end"]),
    point: vec2Schema$1
  }).strict(),
  object$1({
    kind: literal$1("create_path"),
    nodeId: idSchema$1,
    points: array$1(vec2Schema$1).min(2).max(4096),
    closed: boolean()
  }).strict(),
  object$1({
    kind: literal$1("delete_nodes"),
    nodeIds: array$1(idSchema$1).min(1).max(256)
  }).strict(),
  object$1({
    kind: literal$1("create_annotation_batch"),
    annotations: array$1(object$1({ id: idSchema$1, type: idSchema$1 }).catchall(unknown())).min(1).max(512),
    associations: array$1(object$1({ id: idSchema$1, type: literal$1("association") }).catchall(unknown())).max(512)
  }).strict()
]);
const spatialPostconditionSchema = discriminatedUnion("kind", [
  object$1({
    kind: literal$1("preserve_connectivity"),
    nodeIds: array$1(idSchema$1).min(1).max(256)
  }).strict(),
  object$1({
    kind: literal$1("within_bounds"),
    bounds: boundsSchema
  }).strict(),
  object$1({
    kind: literal$1("target_position"),
    targetHandle: idSchema$1,
    point: vec2Schema$1,
    tolerance: finiteSchema.positive()
  }).strict()
]);
const spatialEditProgramSchema = object$1({
  baseRef: drawingRefSchema$1,
  targetHandle: idSchema$1,
  summary: boundedTextSchema,
  objective: boundedTextSchema,
  operations: array$1(spatialOperationSchema).min(1).max(128),
  preserveScopes: array$1(effectScopeRefSchema).max(512),
  postconditions: array$1(spatialPostconditionSchema).max(128),
  evidenceRefs: array$1(idSchema$1).min(1).max(256)
}).strict();
const partKeySchema = string$1().trim().min(1).max(64);
const boundedLabelSchema = string$1().trim().min(1).max(160);
const boundedSummarySchema = string$1().trim().min(1).max(500);
const normalizedCoordinateSchema = number().finite().min(0).max(1);
const normalizedPointSchema = tuple([normalizedCoordinateSchema, normalizedCoordinateSchema]);
const numericKeySchema = string$1().regex(/^n[1-9]\d*$/).max(16);
const partSelectionReferenceSchema = discriminatedUnion("kind", [
  strictObject({ kind: literal$1("current_selection") }),
  strictObject({
    kind: literal$1("observation_point"),
    normalized: normalizedPointSchema
  }),
  strictObject({
    kind: literal$1("observation_region"),
    polygon: array$1(normalizedPointSchema).min(3).max(64)
  }),
  strictObject({
    kind: literal$1("candidate"),
    key: string$1().trim().min(1).max(64)
  }),
  strictObject({
    kind: literal$1("semantic_query"),
    text: string$1().trim().min(1).max(160)
  })
]);
const partSelectionExclusionSchema = discriminatedUnion("kind", [
  strictObject({
    kind: literal$1("candidate"),
    value: string$1().trim().min(1).max(64)
  }),
  strictObject({
    kind: literal$1("semantic_query"),
    value: string$1().trim().min(1).max(160)
  })
]);
const semanticPartSelectionSchema = strictObject({
  partKey: partKeySchema,
  label: boundedLabelSchema,
  role: _enum(["target", "reference"]).default("target"),
  references: array$1(partSelectionReferenceSchema).min(1).max(8),
  exclude: array$1(partSelectionExclusionSchema).max(16).optional()
}).superRefine(({ exclude }, context) => {
  if (exclude === void 0) return;
  const seen = /* @__PURE__ */ new Set();
  for (const [index, item] of exclude.entries()) {
    const key = `${item.kind}:${item.value}`;
    if (seen.has(key)) {
      context.addIssue({
        code: "custom",
        path: ["exclude", index],
        message: "EDIT_SELECTION_EXCLUSION_DUPLICATE"
      });
    }
    seen.add(key);
  }
});
const drawingSelectPartsRequestSchema = strictObject({
  parts: array$1(semanticPartSelectionSchema).min(1).max(16)
}).superRefine(({ parts }, context) => {
  const partKeys = /* @__PURE__ */ new Set();
  for (const [index, part] of parts.entries()) {
    if (partKeys.has(part.partKey)) {
      context.addIssue({
        code: "custom",
        path: ["parts", index, "partKey"],
        message: "EDIT_PART_KEY_DUPLICATE"
      });
    }
    partKeys.add(part.partKey);
  }
});
const spatialReferenceSchema = discriminatedUnion("kind", [
  strictObject({ kind: literal$1("part"), partKey: partKeySchema }),
  strictObject({
    kind: literal$1("drawing_anchor"),
    anchor: _enum(["center", "top", "bottom", "left", "right"])
  }),
  strictObject({
    kind: literal$1("observation_point"),
    normalized: normalizedPointSchema
  }),
  strictObject({
    kind: literal$1("semantic_anchor"),
    query: string$1().trim().min(1).max(160)
  })
]);
const qualitativeMagnitudeSchema = _enum(["minimum", "slight", "moderate", "strong"]);
const spatialGoalSchema = discriminatedUnion("kind", [
  strictObject({
    kind: literal$1("direction"),
    subject: partKeySchema,
    direction: _enum(["up", "down", "left", "right"]),
    magnitude: qualitativeMagnitudeSchema
  }),
  strictObject({
    kind: literal$1("relative_position"),
    subject: partKeySchema,
    reference: spatialReferenceSchema,
    relation: _enum(["above", "below", "left_of", "right_of", "near", "far", "centered"]),
    magnitude: qualitativeMagnitudeSchema
  }),
  strictObject({
    kind: literal$1("alignment"),
    subject: partKeySchema,
    reference: spatialReferenceSchema,
    axis: _enum(["x", "y", "both"])
  }),
  strictObject({
    kind: literal$1("topology"),
    subject: partKeySchema,
    reference: spatialReferenceSchema,
    relation: _enum(["touches", "crosses", "does_not_cross", "inside", "outside"])
  }),
  strictObject({
    kind: literal$1("explicit_numeric"),
    subject: partKeySchema,
    quantity: _enum(["delta_x", "delta_y", "distance", "angle", "target_x", "target_y"]),
    numericKey: numericKeySchema
  })
]);
const preservationGoalSchema = discriminatedUnion("kind", [
  strictObject({ kind: literal$1("part_shape"), partKey: partKeySchema }),
  strictObject({ kind: literal$1("connectivity"), partKey: partKeySchema }),
  strictObject({ kind: literal$1("anchor"), reference: spatialReferenceSchema }),
  strictObject({ kind: literal$1("topology"), partKey: partKeySchema.optional() }),
  strictObject({ kind: literal$1("protected_scope") }),
  strictObject({ kind: literal$1("minimum_deformation") })
]);
const spatialIntentRequestSchema = strictObject({
  summary: boundedSummarySchema,
  goals: array$1(spatialGoalSchema).min(1).max(32),
  preserve: array$1(preservationGoalSchema).max(32)
});
const spatialIntentRevisionSchema = strictObject({
  goalDelta: array$1(spatialGoalSchema).min(1).max(32),
  preserveDelta: array$1(preservationGoalSchema).max(32).optional()
});
const userEvidenceSpanSchema = strictObject({
  start: number().int().nonnegative().max(1e6),
  end: number().int().positive().max(1e6),
  text: string$1().min(1).max(160)
}).superRefine(({ start, end }, context) => {
  if (end <= start) {
    context.addIssue({
      code: "custom",
      path: ["end"],
      message: "EDIT_NUMERIC_EVIDENCE_SPAN_INVALID"
    });
  }
});
const numericConstraintCommon = {
  numericKey: numericKeySchema,
  unit: string$1().trim().min(1).max(32),
  userEvidenceSpan: userEvidenceSpanSchema
};
discriminatedUnion("kind", [
  strictObject({
    ...numericConstraintCommon,
    kind: literal$1("distance"),
    value: number().finite()
  }),
  strictObject({
    ...numericConstraintCommon,
    kind: literal$1("angle"),
    value: number().finite()
  }),
  strictObject({
    ...numericConstraintCommon,
    kind: literal$1("coordinate"),
    value: tuple([number().finite(), number().finite()])
  })
]);
_enum([
  "observed",
  "selected",
  "preview_ready",
  "needs_revision",
  "committed",
  "blocked",
  "discarded",
  "invalid_state",
  "reobserve_required",
  "drawing_not_active",
  "selection_ambiguous",
  "no_solution"
]);
const idSchema = string$1().min(1);
const vec2Schema = tuple([number(), number()]);
const qualitySchema = object$1({
  status: _enum(["confirmed", "candidate"]),
  confidence: number().optional(),
  evidenceRefs: array$1(idSchema)
}).strict();
const drawingNodeSourceRefSchema = object$1({
  sourceId: idSchema,
  objectId: idSchema.optional(),
  objectType: idSchema.optional(),
  layer: string$1().min(1).optional()
}).strict();
const baseNodeShape = {
  id: idSchema,
  visible: boolean(),
  quality: qualitySchema,
  sourceRef: drawingNodeSourceRefSchema.optional()
};
const geometrySchema = discriminatedUnion("type", [
  object$1({ ...baseNodeShape, type: literal$1("point"), x: number(), y: number() }).strict(),
  object$1({ ...baseNodeShape, type: literal$1("line"), start: vec2Schema, end: vec2Schema }).strict(),
  object$1({ ...baseNodeShape, type: literal$1("ray"), origin: vec2Schema, direction: vec2Schema }).strict(),
  object$1({ ...baseNodeShape, type: literal$1("xline"), origin: vec2Schema, direction: vec2Schema }).strict(),
  object$1({ ...baseNodeShape, type: literal$1("circle"), center: vec2Schema, radius: number() }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("arc"),
    center: vec2Schema,
    radius: number(),
    startAngle: number(),
    endAngle: number(),
    counterClockwise: boolean()
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("ellipse"),
    center: vec2Schema,
    majorAxis: vec2Schema,
    ratio: number(),
    startParam: number().optional(),
    endParam: number().optional()
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("polyline"),
    vertices: array$1(object$1({ point: vec2Schema, bulge: number().optional() }).strict()),
    closed: boolean()
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("spline"),
    degree: number().int().nonnegative(),
    controlPoints: array$1(vec2Schema),
    knots: array$1(number()),
    weights: array$1(number()).optional(),
    closed: boolean(),
    periodic: boolean()
  }).strict()
]);
const entityAnchorSchema = discriminatedUnion("kind", [
  object$1({ kind: _enum(["start", "end", "center"]) }).strict(),
  object$1({ kind: literal$1("vertex"), index: number().int().nonnegative() }).strict(),
  object$1({ kind: literal$1("curve-parameter"), parameter: number() }).strict(),
  object$1({ kind: literal$1("nearest"), point: vec2Schema }).strict()
]);
const dimensionTargetSchema = object$1({
  geometryId: idSchema,
  anchor: entityAnchorSchema
}).strict();
const dimensionCandidateSchema = object$1({
  targets: array$1(dimensionTargetSchema),
  score: number(),
  reasons: array$1(string$1())
}).strict();
const toleranceProjectionSchema = object$1({
  mode: _enum(["none", "bilateral", "unilateral", "limits", "fit"]),
  upperDeviation: number().finite().optional(),
  lowerDeviation: number().finite().optional(),
  upperLimit: number().finite().optional(),
  lowerLimit: number().finite().optional(),
  fitDesignation: string$1().min(1).max(32).optional(),
  unit: _enum(["mm", "cm", "m", "deg"]),
  status: _enum(["candidate", "resolved", "confirmed", "conflict"]),
  source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
  ruleRef: object$1({
    id: idSchema,
    version: idSchema,
    inputDigest: idSchema
  }).strict().optional(),
  evidenceRefs: array$1(idSchema)
}).strict().superRefine((value2, context) => {
  if (value2.mode === "limits" && (value2.lowerLimit === void 0 || value2.upperLimit === void 0 || value2.lowerLimit > value2.upperLimit)) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_LIMIT_ORDER" });
  }
  if (value2.mode === "bilateral" && (value2.upperDeviation === void 0 || value2.lowerDeviation === void 0)) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATIONS_REQUIRED" });
  }
  if (value2.mode === "unilateral" && value2.upperDeviation === void 0 && value2.lowerDeviation === void 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATION_REQUIRED" });
  }
  if (value2.mode === "fit" && value2.fitDesignation === void 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_FIT_REQUIRED" });
  }
  if (value2.status === "confirmed" && value2.evidenceRefs.length === 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_EVIDENCE_REQUIRED" });
  }
});
const datumReferenceSchema = object$1({
  datumId: idSchema,
  role: _enum(["primary", "secondary", "tertiary", "origin"]),
  geometryId: idSchema,
  anchor: entityAnchorSchema
}).strict();
const hatchBoundaryEdgeSchema = discriminatedUnion("type", [
  object$1({ type: literal$1("line"), start: vec2Schema, end: vec2Schema }).strict(),
  object$1({
    type: literal$1("arc"),
    center: vec2Schema,
    radius: number().positive(),
    startAngle: number(),
    endAngle: number(),
    counterClockwise: boolean()
  }).strict(),
  object$1({
    type: literal$1("ellipse"),
    center: vec2Schema,
    majorAxis: vec2Schema,
    axisRatio: number().positive(),
    startParameter: number(),
    endParameter: number(),
    counterClockwise: boolean()
  }).strict(),
  object$1({
    type: literal$1("spline"),
    degree: number().int().positive(),
    rational: boolean(),
    periodic: boolean(),
    knots: array$1(number()),
    controlPoints: array$1(vec2Schema),
    weights: array$1(number()).optional(),
    fitPoints: array$1(vec2Schema).optional()
  }).strict()
]);
const parametricHatchSchema = object$1({
  version: literal$1(1),
  style: _enum(["normal", "outer", "ignore"]),
  elevation: number(),
  extrusion: tuple([number(), number(), number()]),
  boundaryPaths: array$1(object$1({
    flags: number().int().nonnegative(),
    closed: boolean(),
    edges: array$1(hatchBoundaryEdgeSchema).min(1)
  }).strict()).min(1),
  patternLines: array$1(object$1({
    angle: number(),
    base: vec2Schema,
    offset: vec2Schema,
    dashLengths: array$1(number())
  }).strict()),
  patternAngle: number(),
  patternScale: number().positive(),
  double: boolean()
}).strict();
const annotationSchema = discriminatedUnion("type", [
  object$1({
    ...baseNodeShape,
    type: literal$1("text"),
    content: string$1(),
    position: vec2Schema,
    height: number(),
    rotation: number(),
    alignment: _enum(["left", "center", "right"]),
    verticalAlignment: _enum(["baseline", "bottom", "middle", "top"]),
    maxWidth: number().optional()
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("dimension"),
    dimensionKind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
    associationStatus: _enum(["resolved", "ambiguous", "conflict"]),
    targets: array$1(dimensionTargetSchema),
    candidates: array$1(dimensionCandidateSchema).optional(),
    observedValue: number().optional(),
    computedValue: number().optional(),
    displayText: string$1().optional(),
    unit: _enum(["mm", "cm", "m", "deg"]).optional(),
    tolerance: object$1({ upper: number().optional(), lower: number().optional() }).strict().optional(),
    toleranceProjection: toleranceProjectionSchema.optional(),
    datumReferences: array$1(datumReferenceSchema).optional(),
    engineeringIntentId: idSchema.optional(),
    engineeringChainIds: array$1(idSchema).optional(),
    generationOrder: number().int().nonnegative().optional(),
    prefix: string$1().optional(),
    suffix: string$1().optional(),
    textPosition: vec2Schema,
    definitionPoints: array$1(vec2Schema)
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("leader"),
    target: dimensionTargetSchema,
    points: array$1(vec2Schema),
    content: string$1(),
    textHeight: number()
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("centerline"),
    targets: array$1(idSchema),
    start: vec2Schema,
    end: vec2Schema,
    extension: number()
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("section-hatch"),
    pattern: string$1(),
    angle: number(),
    spacing: number(),
    hatch: parametricHatchSchema.optional(),
    segments: array$1(object$1({ start: vec2Schema, end: vec2Schema }).strict()).optional()
  }).strict().refine((value2) => value2.hatch !== void 0 || value2.segments !== void 0, {
    message: "SECTION_HATCH_REPRESENTATION_REQUIRED"
  })
]);
const relationSchema = discriminatedUnion("plane", [
  object$1({
    ...baseNodeShape,
    type: literal$1("topology"),
    plane: literal$1("topology"),
    kind: _enum(["connected", "closed", "contains", "intersects"]),
    nodeIds: array$1(idSchema)
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("constraint"),
    plane: literal$1("constraint"),
    kind: _enum(["horizontal", "vertical", "parallel", "perpendicular", "tangent", "concentric", "equal", "distance", "radius", "angle", "symmetry"]),
    geometryIds: array$1(idSchema),
    value: number().optional(),
    property: string$1().optional(),
    status: _enum(["defined", "satisfied", "violated", "unsolved"])
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("association"),
    plane: literal$1("association"),
    kind: literal$1("annotation-target"),
    annotationId: idSchema,
    geometryIds: array$1(idSchema)
  }).strict(),
  object$1({
    ...baseNodeShape,
    type: literal$1("semantic"),
    plane: literal$1("semantic"),
    kind: literal$1("feature-member"),
    featureId: idSchema,
    nodeIds: array$1(idSchema)
  }).strict()
]);
const featureSchema = object$1({
  ...baseNodeShape,
  type: literal$1("feature"),
  semanticType: string$1(),
  geometryIds: array$1(idSchema),
  annotationIds: array$1(idSchema),
  relationIds: array$1(idSchema),
  properties: record(string$1(), unknown())
}).strict();
const drawingDocumentSchema = object$1({
  protocol: literal$1("VectorAI-Drawing"),
  schemaVersion: literal$1("1.0"),
  id: idSchema,
  metadata: object$1({ createdAt: number(), updatedAt: number() }).strict(),
  unitSystem: object$1({ length: _enum(["mm", "cm", "m"]), angle: literal$1("deg") }).strict(),
  sources: array$1(object$1({
    id: idSchema,
    kind: _enum(["image", "dxf"]),
    mediaType: string$1().min(1),
    digest: idSchema,
    name: string$1().min(1).optional(),
    bytes: number().int().nonnegative().optional()
  }).strict()).optional(),
  coordinateFrames: array$1(object$1({
    id: idSchema,
    kind: _enum(["document", "source", "page", "view", "provisional"]),
    transform: tuple([number(), number(), number(), number(), number(), number()]),
    parentId: idSchema.optional()
  }).strict()),
  geometry: array$1(geometrySchema),
  annotations: array$1(annotationSchema),
  relations: array$1(relationSchema),
  features: array$1(featureSchema)
}).strict();
const bounds2DSchema = object$1({
  minX: number(),
  minY: number(),
  maxX: number(),
  maxY: number()
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY, { message: "INVALID_QUERY_BOUNDS" });
const drawingPlaneSchema = _enum(["geometry", "annotation", "relation", "feature"]);
const drawingSpatialNodeSchema = discriminatedUnion("plane", [
  object$1({ plane: literal$1("geometry"), node: geometrySchema }).strict(),
  object$1({ plane: literal$1("annotation"), node: annotationSchema }).strict(),
  object$1({ plane: literal$1("relation"), node: relationSchema }).strict(),
  object$1({ plane: literal$1("feature"), node: featureSchema }).strict()
]);
const drawingQueryRequestSchema = discriminatedUnion("kind", [
  object$1({
    kind: literal$1("world-slice"),
    ref: drawingRefSchema$1,
    bounds: bounds2DSchema,
    planes: array$1(drawingPlaneSchema).min(1).optional(),
    limit: number().int().min(1).max(200).optional()
  }).strict(),
  object$1({
    kind: literal$1("node"),
    ref: drawingRefSchema$1,
    id: idSchema
  }).strict(),
  object$1({
    kind: literal$1("neighbors"),
    ref: drawingRefSchema$1,
    nodeId: idSchema,
    limit: number().int().min(1).max(200).optional()
  }).strict()
]);
discriminatedUnion("kind", [
  object$1({
    kind: literal$1("world-slice"),
    ref: drawingRefSchema$1,
    bounds: bounds2DSchema,
    nodes: array$1(drawingSpatialNodeSchema),
    totalByPlane: object$1({
      geometry: number().int().nonnegative(),
      annotation: number().int().nonnegative(),
      relation: number().int().nonnegative(),
      feature: number().int().nonnegative()
    }).strict(),
    truncated: boolean()
  }).strict(),
  object$1({
    kind: literal$1("node"),
    ref: drawingRefSchema$1,
    node: drawingSpatialNodeSchema.nullable()
  }).strict(),
  object$1({
    kind: literal$1("neighbors"),
    ref: drawingRefSchema$1,
    nodeId: idSchema,
    nodes: array$1(drawingSpatialNodeSchema),
    truncated: boolean()
  }).strict()
]);
const drawingSourceRefSchema = union([
  object$1({
    id: idSchema,
    mediaType: _enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    bytes: number().int().nonnegative().optional(),
    width: number().positive(),
    height: number().positive(),
    name: string$1().optional()
  }).strict(),
  object$1({
    id: idSchema,
    mediaType: literal$1("application/dxf"),
    bytes: number().int().nonnegative().optional(),
    name: string$1().optional()
  }).strict()
]);
const drawingWorkspaceSnapshotSchema = object$1({
  version: literal$1(1),
  ref: object$1({ drawingId: idSchema, revision: number().int().nonnegative() }).strict(),
  document: drawingDocumentSchema,
  source: drawingSourceRefSchema.optional(),
  capabilities: object$1({
    edit: boolean(),
    delete: boolean(),
    annotations: boolean(),
    sourceUnderlay: boolean()
  }).strict(),
  provisional: boolean().optional(),
  lastCommit: object$1({
    commitId: idSchema,
    mode: _enum(["auto-safe", "confirmed", "interactive", "undo", "redo"]),
    undoable: boolean(),
    redoable: boolean().optional()
  }).strict().optional()
}).strict().nullable();
const nodeCreateCommandSchema = object$1({
  type: literal$1("node.create"),
  plane: _enum(["geometry", "annotation", "relation", "feature"]),
  node: union([geometrySchema, annotationSchema, relationSchema, featureSchema])
}).strict().superRefine(({ plane, node }, context) => {
  const matches = plane === "geometry" ? geometrySchema.safeParse(node).success : plane === "annotation" ? annotationSchema.safeParse(node).success : plane === "relation" ? relationSchema.safeParse(node).success : featureSchema.safeParse(node).success;
  if (!matches) context.addIssue({ code: "custom", message: "NODE_PLANE_MISMATCH" });
});
const workspaceCommandSchema = union([
  nodeCreateCommandSchema,
  object$1({
    type: literal$1("node.update"),
    id: idSchema,
    changes: record(string$1(), unknown()),
    expected: record(string$1(), unknown())
  }).strict(),
  object$1({ type: literal$1("node.delete"), id: idSchema }).strict(),
  object$1({
    type: literal$1("annotation.move-text"),
    id: idSchema,
    position: vec2Schema,
    expectedPosition: vec2Schema
  }).strict()
]);
object$1({
  expectedRevision: number().int().nonnegative(),
  commands: array$1(workspaceCommandSchema).min(1)
}).strict();
discriminatedUnion("status", [
  object$1({ status: literal$1("committed"), snapshot: drawingWorkspaceSnapshotSchema.unwrap() }).strict(),
  object$1({ status: literal$1("conflict"), message: string$1(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object$1({ status: literal$1("rejected"), message: string$1(), code: string$1().optional() }).strict()
]);
discriminatedUnion("status", [
  object$1({
    status: literal$1("staged"),
    intentId: idSchema,
    intentDigest: idSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string$1().startsWith("/drawing-apply-intent ")
  }).strict(),
  object$1({ status: literal$1("conflict"), message: string$1(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object$1({ status: literal$1("rejected"), message: string$1(), code: idSchema }).strict()
]);
object$1({
  targetCommitId: idSchema,
  expectedCurrentRef: drawingRefSchema$1
}).strict();
discriminatedUnion("status", [
  object$1({
    status: literal$1("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema$1,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string$1().startsWith("/drawing-undo ")
  }).strict(),
  object$1({ status: literal$1("rejected"), message: string$1(), code: idSchema }).strict()
]);
discriminatedUnion("status", [
  object$1({
    status: literal$1("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema$1,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string$1().startsWith("/drawing-redo ")
  }).strict(),
  object$1({ status: literal$1("rejected"), message: string$1(), code: idSchema }).strict()
]);
object$1({
  expectedRef: drawingRefSchema$1,
  nodeIds: array$1(idSchema).max(256)
}).strict();
discriminatedUnion("status", [
  object$1({ status: literal$1("projected"), projection: selectionProjectionRefSchema }).strict(),
  object$1({ status: literal$1("cleared") }).strict(),
  object$1({ status: literal$1("stale"), currentRef: drawingRefSchema$1 }).strict(),
  object$1({ status: literal$1("rejected"), code: idSchema, message: string$1().min(1) }).strict()
]);
const drawingMotionRigConnectorSchema = object$1({
  nodeId: idSchema,
  movingEndpoint: _enum(["start", "end", "first", "last"]),
  fixedPoint: vec2Schema
}).strict();
const drawingMotionRigProjectionSchema = object$1({
  version: literal$1(1),
  drawingRef: drawingRefSchema$1,
  state: _enum(["ready", "needs-correction"]),
  message: string$1().min(1).optional(),
  carrierNodeId: idSchema.optional(),
  controlBodyNodeIds: array$1(idSchema).min(1).max(256),
  connectors: array$1(drawingMotionRigConnectorSchema).min(1).max(256),
  anchor: vec2Schema,
  handle: vec2Schema,
  keepAnchorFixed: literal$1(true),
  keepControlBodyRigid: literal$1(true),
  preserveConnectivity: literal$1(true),
  allowControlRotation: literal$1(false)
}).strict();
object$1({
  ref: drawingRefSchema$1,
  nodeIds: array$1(idSchema).min(1).max(256)
}).strict();
discriminatedUnion("status", [
  object$1({ status: literal$1("ready"), projection: drawingMotionRigProjectionSchema }).strict(),
  object$1({
    status: literal$1("needs-correction"),
    projection: drawingMotionRigProjectionSchema.optional(),
    message: string$1().min(1)
  }).strict(),
  object$1({ status: literal$1("stale"), currentRef: drawingRefSchema$1 }).strict(),
  object$1({ status: literal$1("rejected"), code: idSchema, message: string$1().min(1) }).strict()
]);
object$1({ ref: drawingRefSchema$1 }).strict();
discriminatedUnion("status", [
  object$1({ status: literal$1("discarded") }).strict(),
  object$1({ status: literal$1("stale"), currentRef: drawingRefSchema$1 }).strict(),
  object$1({ status: literal$1("rejected"), code: idSchema, message: string$1().min(1) }).strict()
]);
const drawingGroundingOverlayInterfaceSchema = object$1({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: _enum(["start", "end"])
}).strict();
const drawingGroundingOverlayGroupSchema = object$1({
  groundingId: idSchema,
  partKey: string$1().trim().min(1).max(64),
  label: string$1().trim().min(1).max(80),
  role: _enum(["target", "reference"]).optional(),
  colorIndex: number().int().nonnegative(),
  nodeIds: array$1(idSchema).min(1).max(256),
  interfaces: array$1(drawingGroundingOverlayInterfaceSchema).max(256)
}).strict();
object$1({
  version: literal$1(1),
  drawingRef: drawingRefSchema$1,
  taskId: idSchema,
  stateEpoch: number().int().nonnegative(),
  disposition: _enum(["active", "committed", "discarded", "failed"]),
  groups: array$1(drawingGroundingOverlayGroupSchema).max(16)
}).strict().superRefine(({ disposition, groups }, context) => {
  if (disposition === "active" && groups.length === 0) {
    context.addIssue({ code: "custom", path: ["groups"], message: "GROUNDING_ACTIVE_GROUP_REQUIRED" });
  }
  if (disposition !== "active" && groups.length > 0) {
    context.addIssue({ code: "custom", path: ["groups"], message: "GROUNDING_TERMINAL_GROUP_FORBIDDEN" });
  }
  const groundingIds = /* @__PURE__ */ new Set();
  const partKeys = /* @__PURE__ */ new Set();
  for (const [index, group] of groups.entries()) {
    if (groundingIds.has(group.groundingId)) {
      context.addIssue({
        code: "custom",
        path: ["groups", index, "groundingId"],
        message: "GROUNDING_ID_DUPLICATE"
      });
    }
    if (partKeys.has(group.partKey)) {
      context.addIssue({
        code: "custom",
        path: ["groups", index, "partKey"],
        message: "GROUNDING_PART_KEY_DUPLICATE"
      });
    }
    groundingIds.add(group.groundingId);
    partKeys.add(group.partKey);
  }
});
object$1({
  ref: drawingRefSchema$1,
  commands: array$1(workspaceCommandSchema).min(1),
  summary: string$1().min(1).optional()
}).strict();
const drawingPreviewSchema = object$1({
  version: literal$1(1),
  handle: idSchema,
  baseRef: drawingRefSchema$1,
  commands: array$1(workspaceCommandSchema).min(1),
  candidate: drawingWorkspaceSnapshotSchema.unwrap(),
  diff: object$1({
    createdNodeIds: array$1(idSchema),
    updatedNodeIds: array$1(idSchema),
    deletedNodeIds: array$1(idSchema)
  }).strict(),
  createdAt: number(),
  summary: string$1().min(1).optional()
}).strict();
discriminatedUnion("status", [
  object$1({ status: literal$1("previewed"), preview: drawingPreviewSchema }).strict(),
  object$1({ status: literal$1("conflict"), message: string$1(), snapshot: drawingWorkspaceSnapshotSchema.unwrap().optional() }).strict(),
  object$1({ status: literal$1("rejected"), message: string$1(), code: string$1().optional() }).strict()
]);
const drawingPreviewControlRequestSchema = object$1({ handle: idSchema }).strict();
discriminatedUnion("status", [
  object$1({ status: literal$1("discarded"), ref: drawingRefSchema$1 }).strict(),
  object$1({ status: literal$1("rejected"), message: string$1(), code: string$1().optional() }).strict()
]);
const extensionOwnershipShape = {
  extensionId: idSchema,
  workflowId: idSchema,
  ref: drawingRefSchema$1
};
const extensionInterfaceSchema = object$1({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: _enum(["start", "end"])
}).strict();
const extensionPreviewCreateRequestSchema = object$1({
  ...extensionOwnershipShape,
  targetNodeIds: array$1(idSchema).min(1).max(256),
  interfaces: array$1(extensionInterfaceSchema).max(256).optional(),
  program: spatialEditProgramSchema
}).strict();
const extensionPreviewControlRequestSchema = object$1({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema
}).strict();
const extensionPreviewReplaceRequestSchema = object$1({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema,
  program: spatialEditProgramSchema
}).strict();
const extensionNeedsRebaseResultSchema = object$1({
  status: literal$1("needs-rebase"),
  currentRef: drawingRefSchema$1
}).strict();
const extensionRejectedResultSchema = object$1({
  status: literal$1("rejected"),
  code: idSchema,
  message: string$1().min(1)
}).strict();
const extensionPreviewReadyResultSchema = object$1({
  status: literal$1("previewed"),
  previewToken: idSchema,
  candidateDigest: idSchema,
  ref: drawingRefSchema$1,
  expiresAt: number().int().nonnegative()
}).strict();
discriminatedUnion("status", [
  extensionPreviewReadyResultSchema,
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object$1({
    status: literal$1("assessed"),
    previewToken: idSchema,
    candidateDigest: idSchema,
    assessment: assessmentSchema
  }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object$1({ status: literal$1("finalized"), result: finalizePreviewResultSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object$1({ status: literal$1("discarded"), ref: drawingRefSchema$1 }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
object$1({
  version: literal$1(1),
  workspaceClaimed: boolean(),
  activationEpoch: number().int().nonnegative(),
  workflow: object$1({
    status: _enum(["idle", "running", "reviewing", "completed", "canceled", "failed", "needs-rebase"]),
    workflowId: idSchema.optional(),
    message: string$1().min(1).optional()
  }).strict()
}).strict();
object$1({
  bytes: _instanceof(Uint8Array),
  digest: idSchema,
  name: string$1().trim().min(1).max(255).optional()
}).strict();
const drawingObservationOverlaySchema = object$1({
  id: idSchema,
  label: string$1().trim().min(1).max(80),
  polygon: array$1(vec2Schema).min(3).max(16)
}).strict();
object$1({
  ref: drawingRefSchema$1,
  overlays: array$1(drawingObservationOverlaySchema).max(128).optional()
}).strict();
discriminatedUnion("status", [
  object$1({
    status: literal$1("rendered"),
    png: _instanceof(Uint8Array),
    contentDigest: idSchema,
    width: number().int().positive(),
    height: number().int().positive()
  }).strict(),
  object$1({ status: literal$1("stale"), currentRef: drawingRefSchema$1 }).strict(),
  object$1({ status: literal$1("rejected"), code: idSchema, message: string$1().min(1) }).strict()
]);
string$1().min(1);
const partitionEvidenceSchema = object$1({
  id: idSchema,
  origin: _enum(["document", "geometry", "fused", "ai", "manual"]),
  label: string$1(),
  sourceLines: array$1(number().int().positive()).optional(),
  geometryNodeIds: array$1(idSchema).optional()
}).strict();
const partitionDiagnosticSchema = object$1({
  id: idSchema,
  severity: _enum(["info", "warning", "error"]),
  code: idSchema,
  message: string$1(),
  segmentIds: array$1(idSchema).optional(),
  evidenceIds: array$1(idSchema).optional()
}).strict();
const shaftAxisSchema = object$1({
  origin: vec2Schema,
  direction: vec2Schema,
  normal: vec2Schema,
  zMin: number(),
  zMax: number(),
  orientation: _enum(["forward", "reversed"]),
  geometryNodeIds: array$1(idSchema).optional()
}).strict();
const stepCandidateSchema = object$1({
  id: idSchema,
  z: number(),
  score: number(),
  evidenceIds: array$1(idSchema),
  accepted: boolean()
}).strict();
const partitionSegmentSchema = object$1({
  id: idSchema,
  zStart: number(),
  zEnd: number(),
  profile: object$1({ minRadius: number(), maxRadius: number(), sampleCount: number().int().nonnegative() }).strict(),
  semanticType: string$1().optional(),
  name: string$1().optional(),
  boundaryConfidence: number(),
  semanticConfidence: number().optional(),
  geometryNodeIds: array$1(idSchema),
  boundaryEvidenceIds: array$1(idSchema),
  semanticEvidenceIds: array$1(idSchema),
  diagnosticIds: array$1(idSchema),
  profileSamples: array$1(object$1({ z: number(), radius: number().nonnegative(), geometryNodeId: idSchema }).strict()).optional()
}).strict();
const partitionGroupSchema = object$1({
  id: idSchema,
  segmentIds: array$1(idSchema),
  range: object$1({ zStart: number(), zEnd: number() }).strict().optional(),
  semanticType: string$1(),
  name: string$1().optional(),
  evidenceIds: array$1(idSchema)
}).strict();
const partitionDraftSchema = object$1({
  version: literal$1(1),
  drawingRef: drawingRefSchema$1,
  axis: shaftAxisSchema,
  segments: array$1(partitionSegmentSchema),
  semanticGroups: array$1(partitionGroupSchema),
  stepCandidates: array$1(stepCandidateSchema),
  evidence: array$1(partitionEvidenceSchema),
  diagnostics: array$1(partitionDiagnosticSchema),
  basePartitionRevisionId: idSchema.optional()
}).strict();
const partitionRevisionSchema = object$1({
  version: literal$1(1),
  drawingRef: drawingRefSchema$1,
  axis: shaftAxisSchema,
  segments: array$1(partitionSegmentSchema),
  semanticGroups: array$1(partitionGroupSchema),
  evidence: array$1(partitionEvidenceSchema),
  diagnostics: array$1(partitionDiagnosticSchema),
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  confirmedAt: number()
}).strict();
discriminatedUnion("type", [
  object$1({ type: literal$1("boundary.move"), expectedDrawingRef: drawingRefSchema$1, boundaryIndex: number().int().positive(), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
  object$1({ type: literal$1("semantic-range.move"), expectedDrawingRef: drawingRefSchema$1, groupId: idSchema, edge: _enum(["start", "end"]), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
  object$1({ type: literal$1("semantic-group.rename"), expectedDrawingRef: drawingRefSchema$1, groupId: idSchema, name: string$1().trim().min(1).max(120) }).strict(),
  object$1({ type: literal$1("segment.split"), expectedDrawingRef: drawingRefSchema$1, segmentId: idSchema, z: number(), snapTolerance: number().nonnegative() }).strict(),
  object$1({ type: literal$1("boundary.merge"), expectedDrawingRef: drawingRefSchema$1, boundaryIndex: number().int().positive() }).strict(),
  object$1({ type: literal$1("segment.metadata"), expectedDrawingRef: drawingRefSchema$1, segmentId: idSchema, name: string$1().max(120).optional(), semanticType: string$1().max(80).optional() }).strict()
]);
object$1({
  version: literal$1(1),
  phase: _enum(["idle", "analyzing", "editing", "confirmed", "needs-rebase", "failed"]),
  drawingRef: drawingRefSchema$1.optional(),
  draft: partitionDraftSchema.optional(),
  confirmed: partitionRevisionSchema.optional(),
  canUndo: boolean(),
  canRedo: boolean(),
  message: string$1().optional(),
  updatedAt: number()
}).strict();
const sha256DigestSchema = string$1().regex(/^sha256:[a-f0-9]{64}$/u);
const engineeringDocumentInputSchema = object$1({
  name: string$1().trim().min(1).max(255),
  digest: sha256DigestSchema,
  mediaType: string$1().trim().min(1).max(127).optional(),
  base64: string$1().min(1).max(27962028)
}).strict();
object$1({
  dxf: object$1({ name: string$1().min(1).max(255), digest: idSchema, base64: string$1().min(1).max(27962028) }).strict(),
  engineeringDocuments: array$1(engineeringDocumentInputSchema).max(16).optional(),
  engineeringDocument: object$1({ name: string$1().min(1).max(255), text: string$1() }).strict().optional()
}).strict().superRefine((request, context) => {
  if (request.engineeringDocuments !== void 0 && request.engineeringDocument !== void 0) {
    context.addIssue({ code: "custom", path: ["engineeringDocuments"], message: "ENGINEERING_DOCUMENT_INPUT_AMBIGUOUS" });
  }
});
object$1({
  expectedDrawingRef: drawingRefSchema$1,
  engineeringDocuments: array$1(engineeringDocumentInputSchema).min(1).max(16)
}).strict();
object$1({
  engineeringDocuments: array$1(engineeringDocumentInputSchema).min(1).max(16)
}).strict();
const engineeringDiagnosticSchema = object$1({
  id: idSchema,
  severity: _enum(["info", "warning", "error"]),
  code: idSchema,
  message: string$1(),
  entityIds: array$1(idSchema).optional(),
  evidenceIds: array$1(idSchema).optional()
}).strict();
const engineeringStateSchema = _enum(["candidate", "resolved", "confirmed", "conflict", "stale"]);
const engineeringDatumSchema = object$1({
  id: idSchema,
  drawingRef: drawingRefSchema$1,
  name: string$1().min(1).max(120),
  geometryId: idSchema,
  anchor: entityAnchorSchema,
  role: _enum(["primary", "secondary", "tertiary", "origin"]),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: _enum(["candidate", "confirmed", "conflict", "stale"]),
  evidenceIds: array$1(idSchema)
}).strict();
const dimensionIntentSchema = object$1({
  id: idSchema,
  drawingRef: drawingRefSchema$1,
  kind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
  targets: array$1(dimensionTargetSchema),
  datumIds: array$1(idSchema),
  nominalValue: number().finite(),
  unit: _enum(["mm", "cm", "m", "deg"]),
  functionalRole: _enum(["datum", "overall", "functional", "assembly", "process", "inspection", "auxiliary", "closure"]),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: engineeringStateSchema,
  evidenceIds: array$1(idSchema)
}).strict();
const resolvedToleranceSchema = object$1({
  upperDeviation: number().finite().optional(),
  lowerDeviation: number().finite().optional(),
  upperLimit: number().finite().optional(),
  lowerLimit: number().finite().optional(),
  fitDesignation: string$1().min(1).max(32).optional(),
  inputDigest: idSchema,
  evaluatedAt: number().finite()
}).strict();
const toleranceSpecSchema = object$1({
  id: idSchema,
  dimensionIntentId: idSchema,
  mode: _enum(["bilateral", "unilateral", "limits", "fit", "formula"]),
  source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
  ruleRef: object$1({ id: idSchema, version: idSchema }).strict().optional(),
  inputs: record(string$1(), union([number().finite(), string$1(), boolean()])),
  resolved: resolvedToleranceSchema.optional(),
  status: engineeringStateSchema,
  evidenceIds: array$1(idSchema),
  diagnostics: array$1(engineeringDiagnosticSchema)
}).strict();
const dimensionChainSchema = object$1({
  id: idSchema,
  drawingRef: drawingRefSchema$1,
  name: string$1().max(120).optional(),
  datumIds: array$1(idSchema),
  members: array$1(object$1({
    dimensionIntentId: idSchema,
    coefficient: union([literal$1(1), literal$1(-1)]),
    role: _enum(["functional", "component", "closure"]),
    sequenceHint: number().int().optional()
  }).strict()),
  equation: object$1({
    closureIntentId: idSchema,
    targetValue: number().finite().optional()
  }).strict(),
  analysisMode: _enum(["worst-case", "statistical", "reference-only"]),
  status: engineeringStateSchema,
  evidenceIds: array$1(idSchema),
  diagnostics: array$1(engineeringDiagnosticSchema)
}).strict();
const annotationDependencySchema = object$1({
  beforeIntentId: idSchema,
  afterIntentId: idSchema,
  reason: _enum(["datum-before-dependent", "overall-before-functional", "functional-before-component", "component-before-closure", "explicit-document-order"]),
  evidenceIds: array$1(idSchema)
}).strict();
const axialStationSchema = object$1({
  id: idSchema,
  coordinate: number().finite(),
  sourceCoordinate: number().finite(),
  unit: _enum(["mm", "cm", "m"]),
  kinds: array$1(_enum(["drawing-end", "shoulder", "partition-boundary", "datum"])),
  geometryNodeIds: array$1(idSchema),
  evidenceIds: array$1(idSchema)
}).strict();
const axialElementarySpanSchema = object$1({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: number().finite().nonnegative(),
  segmentIds: array$1(idSchema),
  evidenceIds: array$1(idSchema)
}).strict();
const dimensionEvidenceSchema = object$1({
  id: idSchema,
  origin: _enum(["geometry", "partition", "document", "manual", "ai"]),
  kind: _enum(["drawing-end", "elementary-span", "functional-region", "document-interval", "process-envelope", "manual-requirement"]),
  label: string$1(),
  required: boolean(),
  sourceIds: array$1(idSchema)
}).strict();
const axialDimensionCandidateSchema = object$1({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: number().finite().nonnegative(),
  roles: array$1(_enum(["overall", "composite", "functional", "process", "local", "reference", "closure"])),
  evidenceIds: array$1(idSchema),
  required: boolean()
}).strict();
const dimensionDecisionTraceSchema = object$1({
  candidateId: idSchema,
  decision: _enum(["displayed", "closure", "rejected", "alternative"]),
  score: number().finite(),
  features: array$1(object$1({
    feature: _enum(["manual-required", "document-exact", "functional-region", "process-envelope", "composite-block", "overall-root", "elementary-span", "ordinary-residual", "terminal-residual"]),
    contribution: number().finite(),
    evidenceIds: array$1(idSchema)
  }).strict()),
  reasonCodes: array$1(idSchema)
}).strict();
const axialChainNodeSchema = object$1({
  id: idSchema,
  parentCandidateId: idSchema,
  childCandidateIds: array$1(idSchema),
  closureCandidateId: idSchema,
  alternativeClosureCandidateIds: array$1(idSchema),
  status: _enum(["resolved", "needs-review", "conflict"])
}).strict();
const axialDimensionSchemeSchema = object$1({
  version: literal$1(1),
  drawingRef: drawingRefSchema$1,
  partitionRevisionId: idSchema.optional(),
  policy: object$1({
    id: _enum(["shaft-hierarchical-dimensioning-v1", "shaft-reference-terminal-closure-v1"]),
    version: literal$1("1")
  }).strict(),
  inputDigest: idSchema,
  topology: object$1({
    drawingRef: drawingRefSchema$1,
    axis: shaftAxisSchema,
    unit: _enum(["mm", "cm", "m"]),
    stations: array$1(axialStationSchema),
    elementarySpans: array$1(axialElementarySpanSchema)
  }).strict(),
  evidence: array$1(dimensionEvidenceSchema),
  candidates: array$1(axialDimensionCandidateSchema),
  displayedCandidateIds: array$1(idSchema),
  closureCandidateIds: array$1(idSchema),
  chains: array$1(axialChainNodeSchema),
  layout: object$1({
    chainNormalOffsets: array$1(object$1({
      chainId: idSchema,
      normalOffset: number().finite()
    }).strict()).default([]),
    candidateNormalOffsets: array$1(object$1({
      candidateId: idSchema,
      normalOffset: number().finite()
    }).strict())
  }).strict().optional(),
  decisions: array$1(dimensionDecisionTraceSchema),
  diagnostics: array$1(engineeringDiagnosticSchema),
  status: _enum(["resolved", "needs-review", "conflict", "stale"])
}).strict();
discriminatedUnion("type", [
  object$1({
    type: literal$1("candidate.display"),
    candidateId: idSchema,
    displayed: boolean(),
    expectedDrawingRef: drawingRefSchema$1
  }).strict(),
  object$1({
    type: literal$1("closure.choose"),
    chainId: idSchema,
    candidateId: idSchema,
    expectedDrawingRef: drawingRefSchema$1
  }).strict(),
  object$1({
    type: literal$1("candidate.layout"),
    candidateId: idSchema,
    normalOffset: number().finite(),
    expectedDrawingRef: drawingRefSchema$1
  }).strict(),
  object$1({
    type: literal$1("chain.layout"),
    chainId: idSchema,
    normalOffset: number().finite(),
    expectedDrawingRef: drawingRefSchema$1
  }).strict()
]);
const engineeringAnnotationDraftSchema = object$1({
  version: literal$1(1),
  drawingRef: drawingRefSchema$1,
  datums: array$1(engineeringDatumSchema),
  intents: array$1(dimensionIntentSchema),
  tolerances: array$1(toleranceSpecSchema),
  chains: array$1(dimensionChainSchema),
  dependencies: array$1(annotationDependencySchema),
  diagnostics: array$1(engineeringDiagnosticSchema),
  axialScheme: axialDimensionSchemeSchema.optional(),
  baseRevisionId: idSchema.optional()
}).strict();
const engineeringAnnotationRevisionSchema = engineeringAnnotationDraftSchema.omit({
  baseRevisionId: true
}).extend({
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  generationOrder: array$1(idSchema),
  confirmedAt: number().finite()
}).strict();
object$1({
  version: literal$1(1),
  phase: _enum(["idle", "editing", "confirmed", "needs-rebase", "failed"]),
  drawingRef: drawingRefSchema$1.optional(),
  draft: engineeringAnnotationDraftSchema.optional(),
  confirmed: engineeringAnnotationRevisionSchema.optional(),
  canUndo: boolean(),
  canRedo: boolean(),
  message: string$1().optional(),
  updatedAt: number().finite()
}).strict();
const CURRENT_DXF_PROJECTION_VERSION = 2;
class InMemoryDrawingRepository {
  constructor(input) {
    __privateAdd(this, _InMemoryDrawingRepository_instances);
    __privateAdd(this, _pending, /* @__PURE__ */ new Map());
    __privateAdd(this, _drawings, /* @__PURE__ */ new Map());
    __privateAdd(this, _durable, /* @__PURE__ */ new Map());
    __privateAdd(this, _previews, /* @__PURE__ */ new Map());
    __privateAdd(this, _vectorizer);
    __privateAdd(this, _drawingId2);
    __privateAdd(this, _storage);
    __privateAdd(this, _previewHandle);
    __privateAdd(this, _now);
    __privateSet(this, _vectorizer, input.vectorizer);
    __privateSet(this, _drawingId2, input.drawingId ?? ((_sessionId, attachment) => `drawing_${String(attachment.attachmentId)}`));
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
    const drawingId = __privateGet(this, _drawingId2).call(this, sessionId, attachment);
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
  async importDxf(sessionId, input) {
    var _a3, _b, _c, _d;
    const current = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if ((current == null ? void 0 : current.attachmentId) === input.digest && current.dxfProjectionVersion === CURRENT_DXF_PROJECTION_VERSION) {
      return {
        status: "already-imported",
        ref: { drawingId: current.drawingId, revision: current.revision },
        provisional: current.provisional
      };
    }
    (_a3 = input.signal) == null ? void 0 : _a3.throwIfAborted();
    const actualDigest = `sha256:${createHash("sha256").update(input.bytes).digest("hex")}`;
    if (actualDigest !== input.digest) {
      throw new Error("DXF_IMPORT_REJECTED:DXF_DIGEST_MISMATCH");
    }
    const drawingId = `drawing_dxf_${actualDigest.slice("sha256:".length, "sha256:".length + 24)}`;
    const imported = importDxf({
      bytes: input.bytes.slice(),
      source: {
        digest: actualDigest,
        ...input.name === void 0 ? {} : { name: input.name }
      },
      drawingId,
      now: __privateGet(this, _now)
    });
    if (imported.status === "rejected") {
      const codes = imported.diagnostics.filter(({ severity }) => severity === "error").map(({ code }) => code).join(",");
      throw new Error(`DXF_IMPORT_REJECTED:${codes || "UNKNOWN"}`);
    }
    (_b = input.signal) == null ? void 0 : _b.throwIfAborted();
    const provisional = imported.diagnostics.some(({ severity }) => severity === "warning");
    const entry = {
      attachmentId: actualDigest,
      dxfProjectionVersion: CURRENT_DXF_PROJECTION_VERSION,
      document: structuredClone(imported.document),
      drawingId,
      bounds: structuredClone(imported.bounds),
      revision: 1,
      source: {
        id: actualDigest,
        mediaType: "application/dxf",
        bytes: input.bytes.byteLength,
        ...input.name === void 0 ? {} : { name: input.name }
      },
      provisional
    };
    if ((_c = __privateGet(this, _storage)) == null ? void 0 : _c.saveDurable) {
      const state = {
        version: 2,
        entry: structuredClone(entry),
        commits: [],
        operations: []
      };
      __privateGet(this, _storage).saveDurable(sessionId, structuredClone(state));
      __privateGet(this, _durable).set(sessionId, state);
    } else {
      (_d = __privateGet(this, _storage)) == null ? void 0 : _d.save(sessionId, structuredClone(entry));
    }
    __privateGet(this, _drawings).set(sessionId, entry);
    __privateGet(this, _previews).delete(sessionId);
    return {
      status: "imported",
      ref: { drawingId, revision: 1 },
      provisional
    };
  }
  getSnapshot(sessionId) {
    var _a3;
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    if (entry === null) return null;
    const lastCommit = (_a3 = __privateMethod(this, _InMemoryDrawingRepository_instances, durableState_fn).call(this, sessionId)) == null ? void 0 : _a3.commits.at(-1);
    return snapshotOf(entry, lastCommit);
  }
  getBounds(sessionId) {
    const entry = __privateMethod(this, _InMemoryDrawingRepository_instances, getDrawing_fn).call(this, sessionId);
    return entry === null ? null : structuredClone(entry.bounds);
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
      ...request.solverProvenance ? { solverProvenance: structuredClone(request.solverProvenance) } : {},
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
  redoCommit(sessionId, request) {
    if (__privateGet(this, _previews).has(sessionId)) throw new Error("REDO_PREVIEW_ACTIVE");
    const state = __privateMethod(this, _InMemoryDrawingRepository_instances, requireDurable_fn).call(this, sessionId);
    const replay = findOperation(state, request.operationId);
    if (replay) {
      if (replay.operationBindingDigest !== request.operationBindingDigest) {
        throw new Error("IDEMPOTENCY_KEY_REUSED");
      }
      return structuredClone(replay);
    }
    const currentRef = { drawingId: state.entry.drawingId, revision: state.entry.revision };
    if (!isDeepStrictEqual(currentRef, request.expectedCurrentRef)) throw new Error("REDO_CONFLICT");
    const target = state.commits.find(({ commitId: commitId2 }) => commitId2 === request.targetCommitId);
    if (!target) throw new Error("REDO_TARGET_NOT_FOUND");
    if (target.mode !== "undo") throw new Error("REDO_TARGET_NOT_UNDO");
    if (target.resultingRevision !== state.entry.revision) throw new Error("REDO_CONFLICT");
    const document = applyDrawingTransaction(state.entry.document, target.inverse, __privateGet(this, _now).call(this));
    const nextEntry = { ...state.entry, document, revision: state.entry.revision + 1 };
    const semanticDigest = digest(canonicalSemanticString(document));
    const snapshotIntegrityDigest = digest(JSON.stringify(nextEntry));
    const commitId = `commit_${request.operationId}`;
    const receipt = {
      status: "committed",
      mode: "redo",
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
      mode: "redo",
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
_drawingId2 = new WeakMap();
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
function digest(value2) {
  return `sha256:${createHash("sha256").update(value2).digest("hex")}`;
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
      undoable: lastCommit.mode !== "undo",
      redoable: lastCommit.mode === "undo"
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
  for (const [key, value2] of Object.entries(command.changes)) {
    if (key === "id" || key === "type" || key === "plane" || !(key in mutable)) {
      return {
        status: "rejected",
        message: `Property ${key} cannot be updated on node ${command.id}`,
        code: "INVALID_COMMAND"
      };
    }
    mutable[key] = structuredClone(value2);
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
      const value2 = JSON.parse(readFileSync(path, "utf8"));
      if (value2.version !== 1 || typeof value2.attachmentId !== "string" || !bounds(value2.bounds)) {
        return null;
      }
      const snapshot = drawingWorkspaceSnapshotSchema.parse(value2.snapshot);
      if (snapshot === null || snapshot.source === void 0) return null;
      return {
        attachmentId: value2.attachmentId,
        ...typeof value2.dxfProjectionVersion === "number" ? { dxfProjectionVersion: value2.dxfProjectionVersion } : {},
        document: snapshot.document,
        drawingId: snapshot.ref.drawingId,
        bounds: value2.bounds,
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
    const value2 = {
      version: 1,
      attachmentId: entry.attachmentId,
      ...entry.dxfProjectionVersion === void 0 ? {} : { dxfProjectionVersion: entry.dxfProjectionVersion },
      bounds: structuredClone(entry.bounds),
      snapshot: snapshotForStorage(entry)
    };
    try {
      __privateMethod(this, _FileDrawingRepositoryStorage_instances, atomicWrite_fn).call(this, path, temporary, value2);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  loadDurable(sessionId) {
    const path = __privateMethod(this, _FileDrawingRepositoryStorage_instances, path_fn).call(this, sessionId);
    if (!existsSync(path)) return null;
    try {
      const value2 = JSON.parse(readFileSync(path, "utf8"));
      if (value2.version !== 2 || !value2.entry || !Array.isArray(value2.commits) || !Array.isArray(value2.operations)) {
        return null;
      }
      const entry = entryFromStored(value2.entry);
      if (!entry) return null;
      return {
        version: 2,
        entry,
        commits: structuredClone(value2.commits),
        operations: structuredClone(value2.operations)
      };
    } catch {
      return null;
    }
  }
  saveDurable(sessionId, state) {
    const path = __privateMethod(this, _FileDrawingRepositoryStorage_instances, path_fn).call(this, sessionId);
    const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
    const value2 = {
      version: 2,
      entry: {
        attachmentId: state.entry.attachmentId,
        ...state.entry.dxfProjectionVersion === void 0 ? {} : { dxfProjectionVersion: state.entry.dxfProjectionVersion },
        bounds: structuredClone(state.entry.bounds),
        snapshot: snapshotForStorage(state.entry)
      },
      commits: structuredClone(state.commits),
      operations: structuredClone(state.operations)
    };
    try {
      __privateMethod(this, _FileDrawingRepositoryStorage_instances, atomicWrite_fn).call(this, path, temporary, value2);
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
}
_directory = new WeakMap();
_FileDrawingRepositoryStorage_instances = new WeakSet();
atomicWrite_fn = function(path, temporary, value2) {
  writeFileSync(temporary, `${JSON.stringify(value2)}
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
function entryFromStored(value2) {
  if (typeof value2.attachmentId !== "string" || !bounds(value2.bounds)) return null;
  const snapshot = drawingWorkspaceSnapshotSchema.safeParse(value2.snapshot);
  if (!snapshot.success || snapshot.data.source === void 0) return null;
  return {
    attachmentId: value2.attachmentId,
    ...typeof value2.dxfProjectionVersion === "number" ? { dxfProjectionVersion: value2.dxfProjectionVersion } : {},
    document: snapshot.data.document,
    drawingId: snapshot.data.ref.drawingId,
    bounds: value2.bounds,
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
function bounds(value2) {
  if (value2 === null || typeof value2 !== "object" || Array.isArray(value2)) return false;
  const candidate = value2;
  return ["minX", "minY", "maxX", "maxY"].every((key) => typeof candidate[key] === "number" && Number.isFinite(candidate[key]));
}
const string = (description) => ({
  type: "string",
  required: true,
  ...description ? { description } : {}
});
const optionalString = () => ({ type: "string" });
const literal = (value2) => ({ type: "string", const: value2, required: true });
const enumeration = (values2) => ({ type: "string", enum: values2, required: true });
const array = (items, required2 = true) => ({
  type: "array",
  items,
  ...required2 ? { required: true } : {}
});
const object = (properties) => ({
  type: "object",
  properties,
  additionalProperties: false
});
const normalizedPoint = {
  type: "array",
  items: { type: "number" },
  description: "Exactly two normalized observation coordinates in [0, 1]."
};
const selectionReference = {
  oneOf: [
    object({ kind: literal("current_selection") }),
    object({ kind: literal("observation_point"), normalized: { ...normalizedPoint, required: true } }),
    object({ kind: literal("observation_region"), polygon: array(normalizedPoint) }),
    object({ kind: literal("candidate"), key: string() }),
    object({ kind: literal("semantic_query"), text: string() })
  ]
};
const selectionExclusion = {
  oneOf: [
    object({ kind: literal("candidate"), value: string() }),
    object({ kind: literal("semantic_query"), value: string() })
  ]
};
const spatialReference = {
  oneOf: [
    object({ kind: literal("part"), partKey: string() }),
    object({ kind: literal("drawing_anchor"), anchor: enumeration(["center", "top", "bottom", "left", "right"]) }),
    object({ kind: literal("observation_point"), normalized: { ...normalizedPoint, required: true } }),
    object({ kind: literal("semantic_anchor"), query: string() })
  ]
};
const magnitude = enumeration(["minimum", "slight", "moderate", "strong"]);
const spatialGoal = {
  oneOf: [
    object({
      kind: literal("direction"),
      subject: string(),
      direction: enumeration(["up", "down", "left", "right"]),
      magnitude
    }),
    object({
      kind: literal("relative_position"),
      subject: string(),
      reference: { ...spatialReference, required: true },
      relation: enumeration(["above", "below", "left_of", "right_of", "near", "far", "centered"]),
      magnitude
    }),
    object({
      kind: literal("alignment"),
      subject: string(),
      reference: { ...spatialReference, required: true },
      axis: enumeration(["x", "y", "both"])
    }),
    object({
      kind: literal("topology"),
      subject: string(),
      reference: { ...spatialReference, required: true },
      relation: enumeration(["touches", "crosses", "does_not_cross", "inside", "outside"])
    }),
    object({
      kind: literal("explicit_numeric"),
      subject: string(),
      quantity: enumeration(["delta_x", "delta_y", "distance", "angle", "target_x", "target_y"]),
      numericKey: string("Reference a Host-extracted numericKey; never copy a coordinate value.")
    })
  ]
};
const preservationGoal = {
  oneOf: [
    object({ kind: literal("part_shape"), partKey: string() }),
    object({ kind: literal("connectivity"), partKey: string() }),
    object({ kind: literal("anchor"), reference: { ...spatialReference, required: true } }),
    object({ kind: literal("topology"), partKey: optionalString() }),
    object({ kind: literal("protected_scope") }),
    object({ kind: literal("minimum_deformation") })
  ]
};
const intentParameters = {
  summary: string("A short semantic description of the desired result."),
  goals: array(spatialGoal),
  preserve: array(preservationGoal)
};
function createSemanticEditToolCatalog(semantic, questions, motionRigs) {
  return [
    createDrawingObserveTool(semantic),
    createDrawingSelectPartsTool(semantic),
    createDrawingApplySelectionCorrectionTool(semantic),
    createDrawingConfirmSelectionTool(semantic),
    createDrawingPreviewSpatialIntentTool(semantic),
    createDrawingReviseSpatialIntentTool(semantic),
    createDrawingEvaluatePreviewTool(semantic),
    createDrawingFinalizeSemanticTool(semantic, questions),
    createDrawingDiscardSemanticTool(semantic),
    createDrawingGetOperationTool(semantic),
    createDrawingUndoTool(semantic, questions),
    ...motionRigs ? [createDrawingCreateMotionRigTool(semantic, motionRigs)] : []
  ];
}
function createDrawingCreateMotionRigTool(semantic, motionRigs) {
  return defineTool({
    name: "drawing_create_motion_rig",
    description: "Create a temporary local movement constraint only after the user explicitly asks to hinge, drag, articulate, or interactively pose part of the active vector Drawing. First identify the intended semantic geometry with drawing_select_parts. This tool never chooses final coordinates and must not be used for ordinary image uploads or image questions.",
    parameters: {
      target: string("Semantic name of the movable assembly requested by the user."),
      controlRole: optionalString(),
      fixedRole: optionalString(),
      motion: literal("translate")
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3, _b;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const selectedParts = semantic.currentSelectedParts(sessionId);
      const semanticNodeIds = motionRigControlNodeIds(selectedParts, {
        target: requiredStringArgument(args.target, "target"),
        ...typeof args.controlRole === "string" ? { controlRole: args.controlRole } : {},
        ...typeof args.fixedRole === "string" ? { fixedRole: args.fixedRole } : {}
      });
      const projected = semanticNodeIds.length === 0 ? ((_b = semantic.currentSelectionProjection(sessionId)) == null ? void 0 : _b.nodeIds) ?? [] : semanticNodeIds;
      const result = motionRigs.create(sessionId, projected);
      if (result.state === "ready") semantic.clearCurrentGroundingOverlay(sessionId);
      const nextTools = result.state === "needs_correction" ? ["drawing_observe", "drawing_select_parts"] : [];
      return {
        ...result,
        drawingWorkflow: workflow(
          result.state === "ready" ? "motion_rig_ready" : result.state,
          nextTools
        )
      };
    }
  });
}
function motionRigControlNodeIds(selectedParts, args) {
  const entries = Object.entries(selectedParts);
  for (const role of [args.controlRole, args.target]) {
    if (!role) continue;
    const matched = entries.find(([partKey]) => normalizedRole(partKey) === normalizedRole(role));
    if (matched) return [...new Set(matched[1].targetNodeIds)];
  }
  const fixedRole = args.fixedRole ? normalizedRole(args.fixedRole) : "";
  const movable = fixedRole ? entries.filter(([partKey]) => normalizedRole(partKey) !== fixedRole) : entries;
  return [...new Set(movable.flatMap(([, { targetNodeIds }]) => targetNodeIds))];
}
function normalizedRole(value2) {
  return value2.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}
function requiredStringArgument(value2, name) {
  if (typeof value2 !== "string") throw new Error(`Invalid ${name}`);
  return value2;
}
function createDrawingApplySelectionCorrectionTool(semantic) {
  return defineTool({
    name: "drawing_apply_selection_correction",
    description: "Apply the Host-computed correction after a selection validation error. This takes no candidate ids: the Host removes or regroups only the geometry identified by deterministic validation. Inspect the returned highlighted image, then confirm it if exact.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderObservation },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const result = semantic.applyCurrentSelectionCorrection(sessionId);
      const imageAttachment = result.state === "selected" ? await semantic.renderCurrentSelectionObservation(sessionId) : null;
      return {
        ...result,
        ...imageAttachment ? {
          imageAttachment,
          selectionReview: "Inspect the corrected highlighted geometry. If it is exact, call drawing_confirm_selection; otherwise call drawing_select_parts."
        } : {},
        drawingWorkflow: workflow(result.state, result.nextTools)
      };
    }
  });
}
function createDrawingObserveTool(semantic) {
  return defineTool({
    name: "drawing_observe",
    description: "Observe the active Drawing only after the user asks to inspect or edit it. The Host owns task, revision, viewport, and observation lineage, and returns short cN selection candidates alongside the image.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderObservation },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      return recover(["drawing_observe"], async () => {
        const result = await semantic.observeCurrent(sessionId);
        const imageAttachment = semantic.currentObservationAttachment(sessionId);
        return {
          ...result,
          ...imageAttachment ? { imageAttachment } : {},
          drawingWorkflow: workflow(result.state, result.nextTools)
        };
      });
    }
  });
}
function createDrawingSelectPartsTool(semantic) {
  return defineTool({
    name: "drawing_select_parts",
    description: "Name semantic parts with an explicit role. Use role=target only for geometry the user will move or edit; use role=reference for fixed context and anchors. Fixed references remain available to the Host but are intentionally not highlighted. For a motion rig, normally select only the movable assembly because the Host infers its fixed connection locally. Prefer candidate cN labels shown directly on the drawing_observe image; multiple exact candidate references inside one part are merged even when their contours are disconnected. Never use drawing_query node ids. Inspect the returned highlighted target geometry. If it is wrong, call drawing_select_parts again; if it is exact, call drawing_confirm_selection.",
    parameters: {
      parts: array(object({
        partKey: string("Stable semantic name used by later goals."),
        label: string(),
        role: enumeration(["target", "reference"]),
        references: array(selectionReference),
        exclude: array(selectionExclusion, false)
      }))
    },
    output: { schema: { type: "json" }, render: renderObservation },
    async execute(args, exec) {
      var _a3;
      const input = drawingSelectPartsRequestSchema.parse(args);
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const result = semantic.selectCurrentParts(sessionId, input);
      const imageAttachment = result.state === "selected" ? await semantic.renderCurrentSelectionObservation(sessionId) : null;
      return {
        ...result,
        ...imageAttachment ? {
          imageAttachment,
          selectionReview: "Inspect the highlighted target geometry now. Fixed reference parts are intentionally not highlighted. If any unrelated target geometry is highlighted or any intended movable/editable geometry is missing, call drawing_select_parts again with corrected cN references. Only when it is exact, call drawing_confirm_selection."
        } : {},
        drawingWorkflow: workflow(result.state, result.nextTools)
      };
    }
  });
}
function createDrawingConfirmSelectionTool(semantic) {
  return defineTool({
    name: "drawing_confirm_selection",
    description: "Confirm that the most recent highlighted selection image exactly matches the requested semantic parts. Call this only after inspecting that image. If the highlight is wrong or incomplete, call drawing_select_parts again instead.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderJson },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      return recover(["drawing_select_parts"], () => {
        const result = semantic.confirmCurrentSelection(sessionId);
        const nextTools = [.../* @__PURE__ */ new Set([...result.nextTools, "drawing_create_motion_rig"])];
        return {
          ...result,
          nextTools,
          drawingWorkflow: workflow(result.state, nextTools)
        };
      });
    }
  });
}
function createDrawingPreviewSpatialIntentTool(semantic) {
  return defineTool({
    name: "drawing_preview_spatial_intent",
    description: "Describe the desired spatial relationship qualitatively. Do not calculate coordinates, rotations, pivots, or transforms; the deterministic Host solver does that.",
    parameters: intentParameters,
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const input = spatialIntentRequestSchema.parse(args);
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      return recover(["drawing_apply_selection_correction", "drawing_select_parts", "drawing_confirm_selection"], () => {
        semantic.previewCurrentIntent(sessionId, input);
        return semantic.currentPreviewPresentation(sessionId);
      });
    }
  });
}
function createDrawingReviseSpatialIntentTool(semantic) {
  return defineTool({
    name: "drawing_revise_spatial_intent",
    description: "Replace the current candidate by revising semantic goals or preservation requirements. The Host recomputes all coordinates.",
    parameters: {
      goalDelta: array(spatialGoal),
      preserveDelta: array(preservationGoal, false)
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const input = spatialIntentRevisionSchema.parse(args);
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      return recover(["drawing_observe"], () => {
        semantic.reviseCurrentIntent(sessionId, input);
        return semantic.currentPreviewPresentation(sessionId);
      });
    }
  });
}
function createDrawingEvaluatePreviewTool(semantic) {
  return defineTool({
    name: "drawing_evaluate_preview",
    description: "Run deterministic validators and visual review on the current Host-owned Preview.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderObservation },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      return recover(["drawing_observe"], async () => {
        const { evaluation, assessment, imageAttachment } = await semantic.evaluateCurrentPreview(sessionId, exec.signal);
        const revisionRequired = evaluation.review.outcome !== "satisfied" || assessment.disposition === "blocked";
        const nextTools = assessment.disposition === "blocked" ? ["drawing_revise_spatial_intent", "drawing_discard_preview"] : revisionRequired ? ["drawing_revise_spatial_intent", "drawing_finalize_preview", "drawing_discard_preview"] : ["drawing_finalize_preview"];
        return {
          review: {
            outcome: evaluation.review.outcome,
            defects: evaluation.review.defects.map(({ code, reason }) => ({ code, reason }))
          },
          diagnostics: evaluation.diagnostics.map(({ code, severity, message, hard }) => ({
            code,
            severity,
            message,
            ...hard === void 0 ? {} : { hard }
          })),
          assessment: { disposition: assessment.disposition, reasons: assessment.reasons },
          ...imageAttachment ? { imageAttachment } : {},
          drawingWorkflow: workflow(revisionRequired ? "needs_revision" : "evaluated", nextTools)
        };
      });
    }
  });
}
function createDrawingFinalizeSemanticTool(semantic, questions) {
  const pending = /* @__PURE__ */ new Map();
  return defineTool({
    name: "drawing_finalize_preview",
    description: "Finalize the current evaluated Preview. The Host resolves all hidden lineage, commits auto-safe edits, and asks for exact human confirmation when required.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderJson },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const inFlight = pending.get(sessionId);
      if (inFlight) return await inFlight;
      const decision = (async () => recover(["drawing_observe"], async () => {
        var _a4;
        const initial = semantic.finalizeCurrentPreview(sessionId);
        if (initial.status !== "rejected" || initial.disposition !== "confirmation_required") {
          return presentFinalize(initial);
        }
        if (!questions || !exec.agent) return {
          status: "rejected",
          code: "FINALIZE_HUMAN_AUTHORITY_REQUIRED",
          message: "This Preview requires a direct user decision.",
          drawingWorkflow: workflow("confirmation_required", ["drawing_finalize_preview", "drawing_discard_preview"])
        };
        const questionId = "drawing-confirm-current";
        const answer = await questions.ask({
          agent: exec.agent,
          signal: exec.signal,
          questions: [{
            id: questionId,
            header: "图纸修改确认",
            question: "是否应用当前预览中的图纸修改？",
            options: [
              { label: "应用修改", description: "提交一个可撤销的新版本。" },
              { label: "继续修改", description: "保留预览并继续调整。" },
              { label: "取消", description: "丢弃预览，不修改图纸。" }
            ]
          }]
        });
        const selected = answer.answers.find(({ id }) => id === questionId);
        if ((selected == null ? void 0 : selected.selected.length) === 1 && selected.selected[0] === "应用修改" && !selected.custom) {
          return presentFinalize(semantic.finalizeCurrentPreview(sessionId, true));
        }
        if ((selected == null ? void 0 : selected.selected.length) === 1 && selected.selected[0] === "取消" && !selected.custom) {
          return presentDiscard(semantic.discardCurrentPreview(sessionId));
        }
        return {
          status: "needs-revision",
          reason: ((_a4 = selected == null ? void 0 : selected.custom) == null ? void 0 : _a4.trim()) || "User requested another candidate.",
          drawingWorkflow: workflow("needs_revision", ["drawing_revise_spatial_intent", "drawing_discard_preview"])
        };
      }))();
      pending.set(sessionId, decision);
      try {
        return await decision;
      } finally {
        if (pending.get(sessionId) === decision) pending.delete(sessionId);
      }
    }
  });
}
function createDrawingDiscardSemanticTool(semantic) {
  return defineTool({
    name: "drawing_discard_preview",
    description: "Discard the current Host-owned Preview without changing the formal Drawing.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderJson },
    async execute(_args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      return recover(["drawing_observe"], () => presentDiscard(semantic.discardCurrentPreview(sessionId)));
    }
  });
}
function createDrawingGetOperationTool(semantic) {
  return defineTool({
    name: "drawing_get_operation",
    description: "Resolve the current Drawing write outcome after a transport, cancellation, or persistence result was uncertain.",
    parameters: {},
    output: { schema: { type: "json" }, render: renderJson },
    async execute(_args, exec) {
      var _a3;
      const result = semantic.getCurrentOperation(requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id));
      if (result.status === "committed" || result.status === "no-effect") {
        const receipt = result.receipt;
        const ref = receipt.status === "no-effect" ? receipt.ref : receipt.resultingRef;
        return { status: result.status, revision: ref.revision };
      }
      return { status: result.status };
    }
  });
}
function createDrawingUndoTool(semantic, questions) {
  const pending = /* @__PURE__ */ new Map();
  return defineTool({
    name: "drawing_undo_commit",
    description: "Request an explicit user-authorized Undo of the exact current Drawing commit.",
    parameters: {
      targetCommitId: string(),
      expectedCurrentRef: {
        ...object({ drawingId: string(), revision: { type: "integer", required: true } }),
        required: true
      }
    },
    output: { schema: { type: "json" }, render: renderJson },
    async execute(args, exec) {
      var _a3;
      const sessionId = requireSession((_a3 = exec.agent) == null ? void 0 : _a3.id);
      const input = args;
      if (!questions || !exec.agent) return {
        status: "rejected",
        code: "UNDO_HUMAN_AUTHORITY_REQUIRED",
        message: "Undo requires a direct user decision."
      };
      const key = `${sessionId}\0${input.targetCommitId}\0${JSON.stringify(input.expectedCurrentRef)}`;
      const inFlight = pending.get(key);
      if (inFlight) return await inFlight;
      const decision = (async () => {
        const questionId = `drawing-undo-${input.targetCommitId}`;
        const answer = await questions.ask({
          agent: exec.agent,
          signal: exec.signal,
          questions: [{
            id: questionId,
            header: "撤销图纸修改",
            question: "撤销这个图纸版本并创建恢复版本？",
            options: [{ label: "撤销此提交" }, { label: "取消" }]
          }]
        });
        const selected = answer.answers.find(({ id }) => id === questionId);
        if ((selected == null ? void 0 : selected.selected.length) !== 1 || selected.selected[0] !== "撤销此提交" || selected.custom) {
          return { status: "discarded", revision: input.expectedCurrentRef.revision };
        }
        const result = semantic.undoAuthorized(sessionId, input);
        return {
          status: result.status,
          ..."resultingRef" in result ? { revision: result.resultingRef.revision } : {}
        };
      })();
      pending.set(key, decision);
      try {
        return await decision;
      } finally {
        if (pending.get(key) === decision) pending.delete(key);
      }
    }
  });
}
function requireSession(id) {
  if (id === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
  return String(id);
}
function workflow(state, nextTools) {
  return { state, nextTools };
}
async function recover(nextTools, operation) {
  try {
    return await operation();
  } catch (error) {
    const code = error instanceof Error ? error.message : "EDIT_INVALID_STATE";
    const correction = error && typeof error === "object" && "correction" in error ? error.correction : void 0;
    const message = code === "EDIT_ARTICULATED_COMPANION_PART_INVALID" ? "The articulated moving part includes separate non-articulated companion parts. Call drawing_apply_selection_correction to remove them without rewriting candidate ids, then inspect and confirm the corrected highlight." : code === "EDIT_ARTICULATED_SELECTION_FRAGMENTED" ? "The articulated selection was split into primitive-sized parts. Call drawing_apply_selection_correction to regroup it without rewriting candidate ids, then inspect and confirm the corrected highlight." : code === "EDIT_ARTICULATED_SELECTION_INVALID" ? "The articulated selection contains unrelated geometry. Call drawing_apply_selection_correction to remove it without rewriting candidate ids, then inspect and confirm the corrected highlight." : code === "EDIT_SELECTED_PART_UNUSED" ? "One or more selected parts are not used by any goal or spatial reference. Call drawing_apply_selection_correction to remove them, then inspect and confirm the corrected highlight." : void 0;
    return {
      ...message ? { message } : {},
      ...correction ? { correction } : {},
      drawingWorkflow: { state: "invalid_state", code, nextTools }
    };
  }
}
function presentFinalize(result) {
  if (result.status === "committed") return {
    status: "committed",
    mode: result.mode,
    revision: result.ref.revision,
    drawingWorkflow: workflow("committed", [])
  };
  if (result.status === "already-satisfied") return {
    status: "already-satisfied",
    revision: result.ref.revision,
    drawingWorkflow: workflow("committed", [])
  };
  if (result.status === "rejected" && "disposition" in result) return {
    status: "rejected",
    disposition: result.disposition,
    code: result.code,
    message: result.message,
    drawingWorkflow: workflow(
      result.disposition === "blocked" ? "blocked" : "confirmation_required",
      result.disposition === "blocked" ? ["drawing_revise_spatial_intent", "drawing_discard_preview"] : ["drawing_finalize_preview", "drawing_discard_preview"]
    )
  };
  return {
    status: result.status,
    ..."message" in result ? { message: result.message } : {},
    drawingWorkflow: workflow("invalid_state", ["drawing_get_operation", "drawing_observe"])
  };
}
function presentDiscard(result) {
  return {
    status: result.status,
    ..."ref" in result ? { revision: result.ref.revision } : {},
    drawingWorkflow: workflow("discarded", ["drawing_observe"])
  };
}
function renderJson(_args, value2) {
  return [{ type: "text", text: JSON.stringify(value2) }];
}
function renderObservation(_args, value2) {
  const content = [
    { type: "text", text: JSON.stringify(value2) }
  ];
  if (value2 && typeof value2 === "object" && "imageAttachment" in value2) {
    const attachment = value2.imageAttachment;
    if (attachment && typeof attachment === "object" && "attachmentId" in attachment) {
      content.push({ type: "image", attachment });
    }
  }
  return content;
}
function createDrawingAgentToolCatalog(drawings, attachments, semantic, questions, motionRigs) {
  return [
    createDrawingImportTool(drawings, attachments),
    createDrawingSummarizeTool(drawings),
    createDrawingQueryTool(drawings),
    ...semantic ? createSemanticEditToolCatalog(semantic, questions, motionRigs) : [
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
    description: "Import and vectorize the latest pending image as an editable local VectorAI Drawing. Only call this when the user explicitly asks to import, convert, or vectorize that image as a drawing. Never call it merely because a reference or supplemental image was uploaded.",
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
      render: (_args, value2) => [{
        type: "text",
        text: `Drawing ${value2.ref.drawingId} revision ${value2.ref.revision} ${value2.status}. ${value2.provisional ? "The current geometry is provisional." : "Local vectorization completed; geometry is ready for inspection and editing."}`
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
      render: (_args, value2) => [{
        type: "text",
        text: JSON.stringify(value2)
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
    description: "Read-only inspection of the active Drawing. This is not a semantic selection tool: never pass query node ids to drawing_select_parts. Use drawing_observe candidate keys or observation points/regions for edits.",
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
      render: renderDrawingQuery
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
function renderDrawingQuery(_args, value2) {
  var _a3;
  if (value2 && typeof value2 === "object" && "kind" in value2 && value2.kind === "world-slice") {
    const slice = value2;
    const counts = {};
    for (const item of slice.nodes ?? []) {
      const key = `${String(item.plane ?? "unknown")}:${String(((_a3 = item.node) == null ? void 0 : _a3.type) ?? "unknown")}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return [{
      type: "text",
      text: JSON.stringify({
        kind: "world-slice-summary",
        mode: "read_only",
        bounds: slice.bounds,
        visibleCounts: counts,
        totalByPlane: slice.totalByPlane,
        truncated: slice.truncated,
        semanticSelection: "Use drawing_observe selectionCandidates and drawing_select_parts; query ids are not candidate keys."
      })
    }];
  }
  return [{ type: "text", text: JSON.stringify(value2) }];
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
      render: (_args, value2) => [{ type: "text", text: JSON.stringify(value2) }]
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
      render: (_args, value2) => [{ type: "text", text: JSON.stringify(value2) }]
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
const _LocalPythonVectorizerProcess = class _LocalPythonVectorizerProcess {
  constructor(child, timeoutMs) {
    __privateAdd(this, _LocalPythonVectorizerProcess_instances);
    __privateAdd(this, _pending2, /* @__PURE__ */ new Map());
    __privateAdd(this, _closed, false);
    __privateAdd(this, _stderr, "");
    this.child = child;
    this.timeoutMs = timeoutMs;
    createInterface({ input: child.stdout }).on("line", (line2) => __privateMethod(this, _LocalPythonVectorizerProcess_instances, onLine_fn).call(this, line2));
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
    const value2 = await __privateMethod(this, _LocalPythonVectorizerProcess_instances, invoke_fn).call(this, {
      operation: "vectorize",
      sourceId: input.sourceId,
      mimeType: input.mimeType,
      imageBase64: Buffer.from(input.bytes).toString("base64"),
      maxPixels: input.maxPixels
    }, input.signal);
    return parseResult(value2, input.sourceId);
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
onLine_fn = function(line2) {
  let response;
  try {
    response = JSON.parse(line2);
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
function parseResult(value2, sourceId) {
  if (!value2 || typeof value2 !== "object" || Array.isArray(value2)) throw new Error("PYTHON_VECTORIZATION_RESULT_INVALID");
  const result = value2;
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
function positive$1(value2) {
  return typeof value2 === "number" && Number.isFinite(value2) && value2 > 0;
}
function positiveInteger(value2) {
  return positive$1(value2) && Number.isInteger(value2);
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
  const point = (value2) => Array.isArray(value2) && value2.length === 2 && value2.every(finite);
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
function safeId(value2) {
  return value2.replace(/[^a-zA-Z0-9_-]/g, "_");
}
function positive(value2) {
  return finite(value2) && value2 > 0;
}
function finite(value2) {
  return typeof value2 === "number" && Number.isFinite(value2);
}
function normalizeDegrees(value2) {
  return round((value2 % 360 + 360) % 360);
}
function round(value2) {
  return Math.round(value2 * 1e6) / 1e6;
}
function canonicalize(value2) {
  if (Array.isArray(value2)) return `[${value2.map(canonicalize).join(",")}]`;
  if (value2 !== null && typeof value2 === "object") {
    return `{${Object.entries(value2).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`).join(",")}}`;
  }
  return JSON.stringify(value2);
}
function sameInstruction(left, right) {
  return left.rootUserMessageId === right.rootUserMessageId && left.rootUserMessageDigest === right.rootUserMessageDigest;
}
function sameDrawingRef(left, right) {
  return left.drawingId === right.drawingId && left.revision === right.revision;
}
function publicClone(episode) {
  const visible = structuredClone(episode);
  delete visible.lastTransitionDigest;
  return visible;
}
class SemanticEditEpisodeStore {
  constructor(ports) {
    __privateAdd(this, _SemanticEditEpisodeStore_instances);
    __privateAdd(this, _instructions, /* @__PURE__ */ new Map());
    __privateAdd(this, _episodes, /* @__PURE__ */ new Map());
    __privateAdd(this, _epochs, /* @__PURE__ */ new Map());
    this.ports = ports;
  }
  bindInstruction(sessionId, instruction) {
    const normalized = structuredClone({ ...instruction, objective: instruction.objective.trim() });
    if (!normalized.rootUserMessageId || !normalized.rootUserMessageDigest || !normalized.objective) {
      throw new Error("EDIT_USER_INSTRUCTION_INVALID");
    }
    const current = __privateGet(this, _instructions).get(sessionId);
    if (current && sameInstruction(current, normalized)) return structuredClone(current);
    if (current) this.invalidate(sessionId, "root-user-message-changed");
    __privateGet(this, _instructions).set(sessionId, normalized);
    return structuredClone(normalized);
  }
  boundInstruction(sessionId) {
    const instruction = __privateGet(this, _instructions).get(sessionId);
    return instruction ? structuredClone(instruction) : null;
  }
  start(sessionId, instruction, drawingRef) {
    const bound = this.bindInstruction(sessionId, instruction);
    const current = __privateGet(this, _episodes).get(sessionId);
    if (current && sameInstruction(current.instruction, bound) && sameDrawingRef(current.drawingRef, drawingRef)) {
      return publicClone(current);
    }
    if (current) this.invalidate(sessionId, "episode-replaced");
    const stateEpoch = __privateMethod(this, _SemanticEditEpisodeStore_instances, nextEpoch_fn).call(this, sessionId);
    const episode = {
      episodeId: this.ports.id("episode"),
      sessionId,
      instruction: structuredClone(bound),
      drawingRef: structuredClone(drawingRef),
      stateEpoch,
      stage: "canonical",
      candidateCount: 0
    };
    __privateGet(this, _episodes).set(sessionId, episode);
    return publicClone(episode);
  }
  current(sessionId, expectedDrawingRef) {
    const current = __privateGet(this, _episodes).get(sessionId);
    if (!current) return null;
    if (expectedDrawingRef && !sameDrawingRef(current.drawingRef, expectedDrawingRef)) {
      this.invalidate(sessionId, "drawing-revision-changed");
      return null;
    }
    return publicClone(current);
  }
  transition(sessionId, expectedStateEpoch, transition) {
    const current = __privateGet(this, _episodes).get(sessionId);
    if (!current) throw new Error("EDIT_EPISODE_REQUIRED");
    const transitionDigest = this.ports.digest(canonicalize(transition));
    if (current.lastTransitionDigest === transitionDigest) return publicClone(current);
    if (current.stateEpoch !== expectedStateEpoch) throw new Error("EDIT_EPISODE_STALE");
    const next = {
      ...current,
      stateEpoch: __privateMethod(this, _SemanticEditEpisodeStore_instances, nextEpoch_fn).call(this, sessionId),
      stage: transition.kind,
      lastTransitionDigest: transitionDigest
    };
    if (transition.kind === "observed") next.observation = structuredClone(transition.observation);
    if (transition.kind === "selected") next.selection = structuredClone(transition.selection);
    if (transition.kind === "preview_ready") {
      next.currentPreview = structuredClone(transition.preview);
      next.currentEvaluation = void 0;
      next.candidateCount += 1;
    }
    if (transition.kind === "needs_revision") next.currentEvaluation = structuredClone(transition.evaluation);
    if (transition.kind === "committed") next.commitReceipt = structuredClone(transition.receipt);
    __privateGet(this, _episodes).set(sessionId, next);
    return publicClone(next);
  }
  invalidate(sessionId, reason) {
    if (!__privateGet(this, _episodes).has(sessionId)) return;
    __privateGet(this, _episodes).delete(sessionId);
    __privateMethod(this, _SemanticEditEpisodeStore_instances, nextEpoch_fn).call(this, sessionId);
  }
  dispose(sessionId) {
    __privateGet(this, _episodes).delete(sessionId);
    __privateGet(this, _instructions).delete(sessionId);
    __privateGet(this, _epochs).delete(sessionId);
  }
}
_instructions = new WeakMap();
_episodes = new WeakMap();
_epochs = new WeakMap();
_SemanticEditEpisodeStore_instances = new WeakSet();
nextEpoch_fn = function(sessionId) {
  const next = (__privateGet(this, _epochs).get(sessionId) ?? 0) + 1;
  __privateGet(this, _epochs).set(sessionId, next);
  return next;
};
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
    __privateAdd(this, _groundingOverlays, /* @__PURE__ */ new Map());
    __privateAdd(this, _episodes2);
    __privateAdd(this, _episodeSelections, /* @__PURE__ */ new Map());
    __privateAdd(this, _currentOperations, /* @__PURE__ */ new Map());
    __privateAdd(this, _terminalFinalizeResults, /* @__PURE__ */ new Map());
    this.drawings = drawings;
    this.ports = ports;
    __privateSet(this, _episodes2, new SemanticEditEpisodeStore({ id: ports.id, digest: ports.digest }));
  }
  bindUserInstruction(sessionId, instruction) {
    const objective = instruction.objective.trim();
    if (!objective) return;
    const bound = { ...instruction, objective };
    const former = __privateGet(this, _episodes2).current(sessionId);
    __privateGet(this, _episodes2).bindInstruction(sessionId, bound);
    if (former && !__privateGet(this, _episodes2).current(sessionId)) {
      __privateGet(this, _episodeSelections).delete(sessionId);
      __privateGet(this, _groundingOverlays).delete(sessionId);
      __privateGet(this, _currentOperations).delete(sessionId);
      __privateGet(this, _terminalFinalizeResults).delete(sessionId);
    }
    __privateGet(this, _pendingInstructions).set(sessionId, bound);
  }
  startBoundTask(sessionId, policy) {
    const pending = __privateGet(this, _pendingInstructions).get(sessionId) ?? __privateGet(this, _episodes2).boundInstruction(sessionId);
    if (!pending) throw new Error("EDIT_USER_INSTRUCTION_REQUIRED");
    __privateGet(this, _pendingInstructions).delete(sessionId);
    const task = this.startTask(sessionId, {
      ...pending,
      policy: policy ?? __privateGet(this, _sessionPolicies).get(sessionId) ?? "auto-safe"
    });
    __privateGet(this, _episodes2).start(sessionId, pending, task.baseRef);
    return task;
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
    __privateGet(this, _episodes2).invalidate(sessionId, "task-replaced");
    __privateGet(this, _episodeSelections).delete(sessionId);
    __privateGet(this, _currentOperations).delete(sessionId);
    __privateGet(this, _terminalFinalizeResults).delete(sessionId);
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshot_fn).call(this, sessionId);
    const former = __privateGet(this, _tasks).get(sessionId);
    if (former) former.active = false;
    const workspacePreview = this.drawings.getPreview(sessionId);
    if (workspacePreview) this.drawings.discardPreview(sessionId, { handle: workspacePreview.handle });
    __privateGet(this, _previews2).delete(sessionId);
    __privateGet(this, _groundingOverlays).delete(sessionId);
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
  async observeCurrent(sessionId) {
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshot_fn).call(this, sessionId);
    let episode = __privateGet(this, _episodes2).current(sessionId, snapshot.ref);
    if (!episode) {
      this.startBoundTask(sessionId);
      episode = __privateGet(this, _episodes2).current(sessionId, snapshot.ref);
    }
    if (!episode) throw new Error("EDIT_EPISODE_REQUIRED");
    const task = __privateGet(this, _tasks).get(sessionId);
    if (!(task == null ? void 0 : task.active)) throw new Error("EDIT_TASK_REQUIRED");
    const existing = __privateGet(this, _episodeSelections).get(sessionId);
    if ((existing == null ? void 0 : existing.episodeId) === episode.episodeId) {
      return __privateMethod(this, _SemanticEditService_instances, currentObservationResult_fn).call(this, sessionId, episode.instruction, snapshot.ref);
    }
    const initialCandidates = __privateMethod(this, _SemanticEditService_instances, initialSelectionCandidates_fn).call(this, snapshot.document, episode.stateEpoch);
    const observation = await this.observe(sessionId, {
      taskId: task.ref.taskId,
      candidateMarkers: initialCandidates.map(({ key, nodeIds }) => ({ key, nodeIds }))
    });
    const context = this.buildContext(sessionId, {
      taskId: task.ref.taskId,
      observationId: observation.observationId
    });
    const transitioned = __privateGet(this, _episodes2).transition(sessionId, episode.stateEpoch, {
      kind: "observed",
      observation: { observationId: observation.observationId, contextId: context.contextId }
    });
    __privateGet(this, _episodeSelections).set(sessionId, {
      episodeId: transitioned.episodeId,
      taskId: task.ref.taskId,
      observationId: observation.observationId,
      contextId: context.contextId,
      ledger: new GroundingLedger({
        episodeId: transitioned.episodeId,
        drawingId: snapshot.ref.drawingId,
        revision: String(snapshot.ref.revision)
      }),
      selectedParts: {},
      selectionRoles: {},
      groundings: {},
      candidates: new Map(initialCandidates.map((candidate) => [candidate.key, {
        ...candidate,
        stateEpoch: transitioned.stateEpoch
      }])),
      nextCandidate: initialCandidates.length,
      selectionConfirmed: false
    });
    return __privateMethod(this, _SemanticEditService_instances, currentObservationResult_fn).call(this, sessionId, transitioned.instruction, snapshot.ref);
  }
  selectCurrentParts(sessionId, rawRequest) {
    const existingEpisode = __privateGet(this, _episodes2).current(sessionId);
    if (!existingEpisode) {
      return { state: "invalid_state", code: "EDIT_EPISODE_REQUIRED", nextTools: ["drawing_observe"] };
    }
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot || !__privateGet(this, _episodes2).current(sessionId, snapshot.ref)) {
      __privateGet(this, _episodeSelections).delete(sessionId);
      __privateGet(this, _groundingOverlays).delete(sessionId);
      return { state: "reobserve_required", code: "EDIT_BASE_STALE", nextTools: ["drawing_observe"] };
    }
    const episode = __privateGet(this, _episodes2).current(sessionId);
    const state = __privateGet(this, _episodeSelections).get(sessionId);
    const task = __privateGet(this, _tasks).get(sessionId);
    if (!state || state.episodeId !== episode.episodeId || !(task == null ? void 0 : task.active)) {
      return { state: "invalid_state", code: "EDIT_OBSERVATION_REQUIRED", nextTools: ["drawing_observe"] };
    }
    const request = drawingSelectPartsRequestSchema.parse(rawRequest);
    const resolved = [];
    for (const part of request.parts) {
      let candidates;
      try {
        candidates = __privateMethod(this, _SemanticEditService_instances, resolvePartCandidates_fn).call(this, sessionId, snapshot.document, snapshot.ref, state, episode.stateEpoch, part);
      } catch (error) {
        const code = error instanceof Error ? error.message : "EDIT_SELECTION_UNRESOLVED";
        return { state: "invalid_state", code, nextTools: ["drawing_select_parts"] };
      }
      if (candidates.length === 0) {
        return { state: "invalid_state", code: "EDIT_SELECTION_UNRESOLVED", nextTools: ["drawing_select_parts"] };
      }
      if (candidates.length > 1) {
        const safeCandidates = candidates.slice(0, 8).map((candidate) => {
          const key = `c${++state.nextCandidate}`;
          state.candidates.set(key, { ...candidate, key, stateEpoch: episode.stateEpoch });
          return { key, summary: candidate.summary };
        });
        return {
          state: "selection_ambiguous",
          partKey: part.partKey,
          candidates: safeCandidates,
          nextTools: ["drawing_select_parts"]
        };
      }
      resolved.push({
        partKey: part.partKey,
        label: part.label,
        role: part.role,
        nodeIds: candidates[0].nodeIds
      });
    }
    if (state.correctionAllowedNodeIds) {
      const allowed = new Set(state.correctionAllowedNodeIds);
      const addsGeometry = resolved.some(({ nodeIds }) => nodeIds.some((nodeId) => !allowed.has(nodeId)));
      if (addsGeometry) {
        return {
          state: "invalid_state",
          code: "EDIT_SELECTION_CORRECTION_ADDED_GEOMETRY",
          nextTools: ["drawing_select_parts", "drawing_confirm_selection"]
        };
      }
    }
    state.selectedParts = {};
    state.selectionRoles = {};
    state.groundings = {};
    state.selectionConfirmed = false;
    __privateGet(this, _groundingOverlays).delete(sessionId);
    const selectedResult = [];
    for (const part of resolved) {
      const grounding = this.ground(sessionId, {
        taskId: state.taskId,
        contextId: state.contextId,
        targetNodeIds: part.nodeIds,
        interfaces: inferSelectionInterfaces(snapshot.document, part.nodeIds, snapshot.ref.revision),
        partKey: part.partKey,
        label: part.label,
        overlayRole: part.role
      });
      const internal = __privateGet(this, _groundings).get(grounding.groundingId);
      if (!internal) throw new Error("EDIT_GROUNDING_REQUIRED");
      state.selectedParts[part.partKey] = structuredClone(internal.target);
      state.selectionRoles[part.partKey] = part.role;
      state.groundings[part.partKey] = internal;
      __privateMethod(this, _SemanticEditService_instances, appendGroundingEvidence_fn).call(this, state, episode, snapshot.ref, part, grounding);
      selectedResult.push({
        partKey: part.partKey,
        label: part.label,
        role: part.role,
        sourceStatus: internal.target.sourceStatus,
        nodeCount: internal.target.targetNodeIds.length,
        interfaceCount: internal.target.interfaces.length
      });
    }
    const transitioned = __privateGet(this, _episodes2).transition(sessionId, episode.stateEpoch, {
      kind: "selected",
      semanticRequest: request,
      selection: { partKeys: resolved.map(({ partKey }) => partKey) }
    });
    const overlay = __privateGet(this, _groundingOverlays).get(sessionId);
    if (overlay) __privateGet(this, _groundingOverlays).set(sessionId, {
      ...overlay,
      stateEpoch: transitioned.stateEpoch,
      disposition: "active"
    });
    for (const candidate of state.candidates.values()) candidate.stateEpoch = transitioned.stateEpoch;
    return { state: "selected", parts: selectedResult, nextTools: ["drawing_confirm_selection"] };
  }
  applyCurrentSelectionCorrection(sessionId) {
    const state = __privateGet(this, _episodeSelections).get(sessionId);
    if (!(state == null ? void 0 : state.pendingCorrectionRequest)) {
      return {
        state: "invalid_state",
        code: "EDIT_SELECTION_CORRECTION_REQUIRED",
        nextTools: ["drawing_select_parts"]
      };
    }
    const request = structuredClone(state.pendingCorrectionRequest);
    const result = this.selectCurrentParts(sessionId, request);
    if (result.state === "selected") state.pendingCorrectionRequest = void 0;
    return result;
  }
  async renderCurrentSelectionObservation(sessionId) {
    var _a3;
    const snapshot = this.drawings.getSnapshot(sessionId);
    const episode = snapshot ? __privateGet(this, _episodes2).current(sessionId, snapshot.ref) : null;
    const state = __privateGet(this, _episodeSelections).get(sessionId);
    if (!snapshot || !episode || !state || state.episodeId !== episode.episodeId || !this.ports.renderObservation) {
      return null;
    }
    const viewport = ((_a3 = this.drawings.summarize(sessionId)) == null ? void 0 : _a3.bounds) ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 };
    const selectedNodeIds = [...new Set(Object.entries(state.selectedParts).filter(([partKey]) => state.selectionRoles[partKey] !== "reference").flatMap(([, { targetNodeIds }]) => targetNodeIds))];
    const selectedNodeSet = new Set(selectedNodeIds);
    const rendered = await this.ports.renderObservation({
      document: snapshot.document,
      viewport,
      selectedNodeIds,
      candidateMarkers: [...state.candidates.values()].filter(({ nodeIds }) => nodeIds.length > 0 && nodeIds.every((nodeId) => selectedNodeSet.has(nodeId))).map(({ key, nodeIds }) => ({ key, nodeIds }))
    });
    const observation = __privateGet(this, _observations).get(state.observationId);
    if (observation) {
      observation.attachment = rendered.attachment;
      observation.view = {
        width: rendered.width,
        height: rendered.height,
        worldToImage: rendered.worldToImage
      };
    }
    return structuredClone(rendered.attachment);
  }
  confirmCurrentSelection(sessionId) {
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshot_fn).call(this, sessionId);
    const episode = __privateGet(this, _episodes2).current(sessionId, snapshot.ref);
    const state = __privateGet(this, _episodeSelections).get(sessionId);
    const task = __privateGet(this, _tasks).get(sessionId);
    if (!episode || !state || state.episodeId !== episode.episodeId || !(task == null ? void 0 : task.active)) {
      throw new Error("EDIT_SELECTION_REQUIRED");
    }
    const parts = Object.keys(state.selectedParts).sort().map((partKey) => ({
      partKey,
      role: state.selectionRoles[partKey] ?? "target",
      nodeCount: state.selectedParts[partKey].targetNodeIds.length
    }));
    if (parts.length === 0) throw new Error("EDIT_SELECTION_REQUIRED");
    state.selectionConfirmed = true;
    return { state: "selection_confirmed", parts, nextTools: ["drawing_preview_spatial_intent"] };
  }
  currentSelectedParts(sessionId) {
    const episode = __privateGet(this, _episodes2).current(sessionId);
    const state = __privateGet(this, _episodeSelections).get(sessionId);
    if (!episode || !state || state.episodeId !== episode.episodeId) return {};
    return structuredClone(state.selectedParts);
  }
  currentGroundingLedger(sessionId) {
    const episode = __privateGet(this, _episodes2).current(sessionId);
    const state = __privateGet(this, _episodeSelections).get(sessionId);
    return episode && (state == null ? void 0 : state.episodeId) === episode.episodeId ? state.ledger.events() : [];
  }
  previewCurrentIntent(sessionId, rawIntent) {
    const intent = spatialIntentRequestSchema.parse(rawIntent);
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshot_fn).call(this, sessionId);
    const episode = __privateGet(this, _episodes2).current(sessionId, snapshot.ref);
    const selection = __privateGet(this, _episodeSelections).get(sessionId);
    const task = __privateGet(this, _tasks).get(sessionId);
    if (!episode || !selection || selection.episodeId !== episode.episodeId || !(task == null ? void 0 : task.active)) {
      throw new Error("EDIT_SELECTION_REQUIRED");
    }
    if (Object.keys(selection.selectedParts).length === 0) throw new Error("EDIT_SELECTION_REQUIRED");
    if (!selection.selectionConfirmed) throw new Error("EDIT_SELECTION_REVIEW_REQUIRED");
    const intentDigest = this.ports.digest(canonicalString(intent));
    const currentPreview = __privateGet(this, _previews2).get(sessionId);
    if ((currentPreview == null ? void 0 : currentPreview.intentDigest) === intentDigest && currentPreview.task === task) {
      return structuredClone(currentPreview.ref);
    }
    if (task.candidateCount >= 3) throw new Error("EDIT_CANDIDATE_BUDGET_EXHAUSTED");
    let compilation;
    try {
      compilation = solveSpatialIntent({
        document: snapshot.document,
        baseRef: snapshot.ref,
        parts: selection.selectedParts,
        intent,
        numericConstraints: episode.instruction.numericConstraints,
        ports: this.ports
      });
    } catch (error) {
      selection.correctionAllowedNodeIds = spatialCorrectionAllowedNodeIds(error, selection);
      selection.pendingCorrectionRequest = spatialCorrectionRequest(error, selection);
      throw projectSpatialSelectionCorrection(error, selection);
    }
    selection.correctionAllowedNodeIds = void 0;
    selection.pendingCorrectionRequest = void 0;
    const selectedPartScopeDigests = Object.fromEntries(Object.keys(selection.selectedParts).sort().map((partKey) => {
      const part = selection.selectedParts[partKey];
      return [partKey, this.ports.digest(canonicalString({
        targetNodeIds: [...part.targetNodeIds].sort(),
        interfaces: part.interfaces.map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint })).sort((left, right) => left.interfaceId.localeCompare(right.interfaceId))
      }))];
    }));
    const referencedNumericKeys = new Set(intent.goals.flatMap((goal) => goal.kind === "explicit_numeric" ? [goal.numericKey] : []));
    const numericEvidenceDigests = episode.instruction.numericConstraints.filter(({ numericKey }) => referencedNumericKeys.has(numericKey)).map((constraint) => this.ports.digest(canonicalString(constraint)));
    const solverProvenance = {
      solverVersion: compilation.solver.version,
      canonicalIntentDigest: intentDigest,
      selectedPartScopeDigests,
      numericEvidenceDigests,
      receipt: structuredClone(compilation.solver)
    };
    const groundings = Object.keys(selection.groundings).sort().map((partKey) => selection.groundings[partKey]);
    const ref = __privateMethod(this, _SemanticEditService_instances, storeCompilation_fn).call(this, sessionId, task, snapshot.ref, groundings, compilation, intent.summary);
    const stored = __privateGet(this, _previews2).get(sessionId);
    if (!stored) throw new Error("EDIT_PREVIEW_STALE");
    stored.intent = structuredClone(intent);
    stored.intentDigest = intentDigest;
    stored.solverProvenance = solverProvenance;
    const transitioned = __privateGet(this, _episodes2).transition(sessionId, episode.stateEpoch, {
      kind: "preview_ready",
      semanticRequest: intent,
      preview: { candidateDigest: ref.candidateDigest, effectDigest: ref.effectDigest }
    });
    __privateGet(this, _currentOperations).set(sessionId, {
      operationId: ref.finalizeOperationId,
      operationBindingDigest: ref.finalizeOperationBindingDigest
    });
    __privateGet(this, _terminalFinalizeResults).delete(sessionId);
    if (transitioned.candidateCount > 3) throw new Error("EDIT_CANDIDATE_BUDGET_EXHAUSTED");
    return structuredClone(ref);
  }
  reviseCurrentIntent(sessionId, rawRevision) {
    const revision = spatialIntentRevisionSchema.parse(rawRevision);
    const current = __privateGet(this, _previews2).get(sessionId);
    if (!(current == null ? void 0 : current.intent)) throw new Error("EDIT_PREVIEW_REQUIRED");
    return this.previewCurrentIntent(sessionId, {
      summary: current.intent.summary,
      goals: revision.goalDelta,
      preserve: revision.preserveDelta ?? current.intent.preserve
    });
  }
  evaluateCurrentPreview(sessionId, signal) {
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!preview) throw new Error("EDIT_PREVIEW_REQUIRED");
    return this.evaluatePreview(sessionId, {
      taskId: preview.ref.taskId,
      previewHandle: preview.ref.previewHandle,
      candidateDigest: preview.ref.candidateDigest,
      signal
    });
  }
  finalizeCurrentPreview(sessionId, confirmed = false) {
    const replay = __privateGet(this, _terminalFinalizeResults).get(sessionId);
    if (replay) return structuredClone(replay);
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!preview) throw new Error("EDIT_PREVIEW_REQUIRED");
    const evaluated = [...__privateGet(this, _evaluations).values()].reverse().find(({ ref }) => ref.previewHandle === preview.ref.previewHandle && ref.candidateDigest === preview.ref.candidateDigest);
    if (!evaluated) throw new Error("EDIT_EVALUATION_REQUIRED");
    const request = {
      previewHandle: preview.ref.previewHandle,
      previewDigest: preview.ref.candidateDigest,
      finalizeOperationId: preview.ref.finalizeOperationId,
      finalizeOperationBindingDigest: preview.ref.finalizeOperationBindingDigest,
      evaluationId: evaluated.ref.evaluationId
    };
    const result = confirmed ? this.confirmFinalize(sessionId, request) : this.finalizePreview(sessionId, request);
    if (result.status === "committed" || result.status === "already-satisfied") {
      const episode = __privateGet(this, _episodes2).current(sessionId);
      if (episode) __privateGet(this, _episodes2).transition(sessionId, episode.stateEpoch, {
        kind: "committed",
        receipt: result
      });
      const task = __privateGet(this, _tasks).get(sessionId);
      if (task) task.active = false;
      __privateGet(this, _episodeSelections).delete(sessionId);
      __privateGet(this, _groundingOverlays).delete(sessionId);
      __privateGet(this, _terminalFinalizeResults).set(sessionId, structuredClone(result));
    }
    return result;
  }
  discardCurrentPreview(sessionId) {
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!preview) throw new Error("EDIT_PREVIEW_REQUIRED");
    const result = this.discardPreview(sessionId, preview.ref.previewHandle);
    const episode = __privateGet(this, _episodes2).current(sessionId);
    if (episode) __privateGet(this, _episodes2).transition(sessionId, episode.stateEpoch, { kind: "discarded" });
    __privateGet(this, _episodeSelections).delete(sessionId);
    __privateGet(this, _currentOperations).delete(sessionId);
    __privateGet(this, _terminalFinalizeResults).delete(sessionId);
    return result;
  }
  getCurrentOperation(sessionId) {
    const operation = __privateGet(this, _currentOperations).get(sessionId);
    return operation ? this.drawings.getOperation(sessionId, operation.operationId, operation.operationBindingDigest) : { status: "absent" };
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
      selectedNodeIds: (selection == null ? void 0 : selection.nodeIds) ?? [],
      ...input.candidateMarkers ? { candidateMarkers: input.candidateMarkers } : {}
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
  currentObservationAttachment(sessionId) {
    const episode = __privateGet(this, _episodes2).current(sessionId);
    const selection = __privateGet(this, _episodeSelections).get(sessionId);
    if (!episode || !selection || selection.episodeId !== episode.episodeId) return null;
    return this.observationAttachment(selection.observationId);
  }
  currentPreviewPresentation(sessionId) {
    var _a3, _b, _c;
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!preview) throw new Error("EDIT_PREVIEW_REQUIRED");
    const effect = preview.compilation.actualEffect;
    const receipt = (_a3 = preview.solverProvenance) == null ? void 0 : _a3.receipt;
    return {
      state: "preview_ready",
      summary: ((_b = preview.intent) == null ? void 0 : _b.summary) ?? ((_c = preview.program) == null ? void 0 : _c.summary) ?? "",
      changedNodeCount: effect.createdNodeIds.length + effect.updatedNodeIds.length + effect.deletedNodeIds.length,
      ...receipt ? {
        solver: {
          candidateCount: receipt.candidateCount,
          goalResidual: receipt.goalResidual,
          movementCost: receipt.movementCost,
          deformationCost: receipt.deformationCost,
          collisionPenalty: receipt.collisionPenalty,
          topologyPenalty: receipt.topologyPenalty
        }
      } : {},
      nextTools: ["drawing_evaluate_preview"]
    };
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
    const coordinateSystem = {
      space: "world",
      positiveX: "right",
      positiveY: "up",
      negativeX: "left",
      negativeY: "down",
      positiveRotation: "counterclockwise",
      modelRotationUnit: "degrees"
    };
    const ref = {
      contextId: this.ports.id("context"),
      taskId: task.ref.taskId,
      observationId: observation.ref.observationId,
      coordinateSystem,
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
        coordinateSystem,
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
    __privateMethod(this, _SemanticEditService_instances, updateGroundingOverlay_fn).call(this, sessionId, task, snapshot.ref, ref, input.partKey, input.label, input.overlayRole ?? "target");
    return structuredClone(ref);
  }
  currentGroundingOverlay(sessionId) {
    const overlay = __privateGet(this, _groundingOverlays).get(sessionId);
    const task = __privateGet(this, _tasks).get(sessionId);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!overlay || !(task == null ? void 0 : task.active) || overlay.taskId !== task.ref.taskId || !snapshot || overlay.drawingRef.drawingId !== snapshot.ref.drawingId || overlay.drawingRef.revision !== snapshot.ref.revision) {
      if (overlay) __privateGet(this, _groundingOverlays).delete(sessionId);
      return null;
    }
    return structuredClone(overlay);
  }
  clearCurrentGroundingOverlay(sessionId) {
    __privateGet(this, _groundingOverlays).delete(sessionId);
  }
  resolveCurrentPreview(sessionId, previewHandle) {
    const preview = __privateGet(this, _previews2).get(sessionId);
    if (!preview || preview.ref.previewHandle !== previewHandle) throw new Error("EDIT_PREVIEW_STALE");
    return structuredClone(preview.ref);
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
    return __privateMethod(this, _SemanticEditService_instances, storeCompilation_fn).call(this, sessionId, task, snapshot.ref, [grounding], compilation, program.summary, program);
  }
  previewMultiPartTransform(sessionId, raw) {
    var _a3;
    const input = multiPartTransformRequestSchema.parse(raw);
    const task = __privateMethod(this, _SemanticEditService_instances, task_fn).call(this, sessionId, input.taskId);
    if (task.candidateCount >= 3) throw new Error("EDIT_CANDIDATE_BUDGET_EXHAUSTED");
    const groundings = input.parts.map(({ groundingId }) => {
      const grounding = __privateGet(this, _groundings).get(groundingId);
      if (!grounding || grounding.ref.taskId !== task.ref.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
      return grounding;
    });
    const contextId = (_a3 = groundings[0]) == null ? void 0 : _a3.ref.contextId;
    if (!contextId || groundings.some(({ ref }) => ref.contextId !== contextId)) {
      throw new Error("EDIT_CONTEXT_MISMATCH");
    }
    const snapshot = __privateMethod(this, _SemanticEditService_instances, snapshotAtTask_fn).call(this, sessionId, task);
    const compilation = compileMultiPartTransform({
      document: snapshot.document,
      baseRef: task.ref.baseRef,
      objective: task.objective,
      summary: input.summary,
      parts: input.parts.map((part, index) => ({
        groundingId: part.groundingId,
        grounding: groundings[index].target,
        translation: [part.translation[0], part.translation[1]],
        ...part.rotationRadians === void 0 ? {} : {
          rotationRadians: part.rotationRadians,
          pivot: [part.pivot[0], part.pivot[1]]
        }
      })),
      ports: this.ports
    });
    return __privateMethod(this, _SemanticEditService_instances, storeCompilation_fn).call(this, sessionId, task, snapshot.ref, groundings, compilation, input.summary);
  }
  reviseMultiPartTransform(sessionId, raw) {
    const input = multiPartTransformRevisionRequestSchema.parse(raw);
    const current = __privateMethod(this, _SemanticEditService_instances, preview_fn).call(this, sessionId, input.currentPreviewHandle, input.currentCandidateDigest);
    if (current.ref.taskId !== input.taskId) throw new Error("EDIT_LINEAGE_MISMATCH");
    return this.previewMultiPartTransform(sessionId, {
      taskId: input.taskId,
      parts: input.parts,
      summary: input.summary
    });
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
      defects: preview.compilation.diagnostics.filter(({ hard }) => hard).map((diagnostic2) => ({
        code: diagnostic2.code,
        reason: diagnostic2.message,
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
      defects: reviewed.defects.map((diagnostic2) => ({
        defectId: this.ports.id("defect"),
        code: diagnostic2.code,
        reason: diagnostic2.reason,
        scopeDigest: diagnostic2.scopeDigest
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
    __privateGet(this, _groundingOverlays).delete(sessionId);
    return result;
  }
  getOperation(sessionId, operationId, bindingDigest) {
    return this.drawings.getOperation(sessionId, operationId, bindingDigest);
  }
  undo(sessionId, request) {
    return this.drawings.undoCommit(sessionId, request);
  }
  redo(sessionId, request) {
    return this.drawings.redoCommit(sessionId, request);
  }
  disposeSession(sessionId) {
    const task = __privateGet(this, _tasks).get(sessionId);
    if (task) task.active = false;
    __privateGet(this, _pendingInstructions).delete(sessionId);
    __privateGet(this, _sessionPolicies).delete(sessionId);
    __privateGet(this, _tasks).delete(sessionId);
    __privateGet(this, _previews2).delete(sessionId);
    __privateGet(this, _selectionProjections).delete(sessionId);
    __privateGet(this, _groundingOverlays).delete(sessionId);
    __privateGet(this, _episodeSelections).delete(sessionId);
    __privateGet(this, _currentOperations).delete(sessionId);
    __privateGet(this, _terminalFinalizeResults).delete(sessionId);
    __privateGet(this, _episodes2).dispose(sessionId);
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
  stageRedo(sessionId, input) {
    var _a3;
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: "rejected", code: "DRAWING_REQUIRED", message: "No Drawing is loaded." };
    if (snapshot.ref.drawingId !== input.expectedCurrentRef.drawingId || snapshot.ref.revision !== input.expectedCurrentRef.revision) return { status: "rejected", code: "REDO_CONFLICT", message: "The Drawing revision changed." };
    if (!((_a3 = snapshot.lastCommit) == null ? void 0 : _a3.redoable) || snapshot.lastCommit.commitId !== input.targetCommitId) {
      return { status: "rejected", code: "REDO_TARGET_NOT_CURRENT", message: "The requested Undo is not the current Redo target." };
    }
    const operationId = this.ports.id("redo");
    const operationBindingDigest = this.ports.digest(canonicalString({
      mode: "redo",
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
      commandLine: `/drawing-redo ${input.targetCommitId} ${input.expectedCurrentRef.drawingId}@${input.expectedCurrentRef.revision} ${operationId} ${operationBindingDigest}`
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
_groundingOverlays = new WeakMap();
_episodes2 = new WeakMap();
_episodeSelections = new WeakMap();
_currentOperations = new WeakMap();
_terminalFinalizeResults = new WeakMap();
_SemanticEditService_instances = new WeakSet();
currentObservationResult_fn = function(sessionId, instruction, drawingRef) {
  const state = __privateGet(this, _episodeSelections).get(sessionId);
  const episode = __privateGet(this, _episodes2).current(sessionId, drawingRef);
  const snapshot = this.drawings.getSnapshot(sessionId);
  if (state && episode && snapshot && state.candidates.size === 0) {
    const candidates = __privateMethod(this, _SemanticEditService_instances, initialSelectionCandidates_fn).call(this, snapshot.document, episode.stateEpoch);
    state.candidates = new Map(candidates.map((candidate) => [candidate.key, candidate]));
    state.nextCandidate = candidates.length;
  }
  return {
    state: "observed",
    drawing: structuredClone(drawingRef),
    selectionAvailable: this.currentSelectionProjection(sessionId) !== null,
    selectionCandidates: state ? [...state.candidates.values()].map(({ key, summary }) => ({ key, summary })) : [],
    numericConstraints: instruction.numericConstraints.map(({ numericKey, kind, value: value2, unit }) => ({
      numericKey,
      kind,
      value: Array.isArray(value2) ? [value2[0], value2[1]] : value2,
      unit
    })),
    nextTools: ["drawing_select_parts"]
  };
};
initialSelectionCandidates_fn = function(document, stateEpoch) {
  return document.geometry.filter(({ visible }) => visible).map((node) => ({ node, size: geometryNodeSize(node) })).sort((left, right) => right.size - left.size || String(left.node.id).localeCompare(String(right.node.id))).slice(0, 64).map(({ node }, index) => ({
    ...selectionCandidate(document, [String(node.id)], 0, stateEpoch),
    key: `c${index + 1}`
  }));
};
resolvePartCandidates_fn = function(sessionId, document, drawingRef, state, stateEpoch, part) {
  const perReference = part.references.map((reference) => {
    if (reference.kind === "current_selection") {
      const projection = __privateMethod(this, _SemanticEditService_instances, currentSelectionProjectionForRef_fn).call(this, sessionId, drawingRef);
      return projection ? [selectionCandidate(document, projection.nodeIds, 0, stateEpoch)] : [];
    }
    if (reference.kind === "candidate") {
      const candidate = state.candidates.get(reference.key);
      if (!candidate || candidate.stateEpoch !== stateEpoch) throw new Error("EDIT_CANDIDATE_EXPIRED");
      return [structuredClone(candidate)];
    }
    if (reference.kind === "semantic_query") {
      const exact = semanticCandidates(document, reference.text, stateEpoch);
      return exact.length > 0 ? exact : visualFallbackCandidates(state.candidates.values(), reference.text, stateEpoch);
    }
    const observation = __privateGet(this, _observations).get(state.observationId);
    if (!(observation == null ? void 0 : observation.view)) throw new Error("EDIT_OBSERVATION_VIEW_REQUIRED");
    const resolvePoint = (normalized) => resolveSpatialPoint({
      observationId: state.observationId,
      normalized
    }, {
      document,
      drawingId: drawingRef.drawingId,
      revision: String(drawingRef.revision),
      readObservationView: (observationId) => observationId === state.observationId ? {
        drawingId: drawingRef.drawingId,
        revision: String(drawingRef.revision),
        view: observation.view
      } : null
    });
    if (reference.kind === "observation_point") {
      return pointCandidates(document, resolvePoint([reference.normalized[0], reference.normalized[1]]), stateEpoch);
    }
    return regionCandidates(document, reference.polygon.map((point) => resolvePoint([point[0], point[1]])), stateEpoch);
  });
  const resolvedReferences = perReference.filter((candidates2) => candidates2.length > 0);
  const combinations = resolvedReferences.reduce((current, alternatives) => current.flatMap((combination) => alternatives.map((candidate) => [...combination, candidate])).slice(0, 64), [[]]);
  const combined = resolvedReferences.length > 1 ? combinations.map((combination) => selectionCandidate(
    document,
    [...new Set(combination.flatMap(({ nodeIds }) => nodeIds))],
    combination.reduce((score, candidate) => score + candidate.score, 0),
    stateEpoch
  )) : resolvedReferences.flat();
  const candidates = /* @__PURE__ */ new Map();
  for (const candidate of combined) {
    const identity = [...candidate.nodeIds].sort().join("\0");
    const current = candidates.get(identity);
    if (!current || candidate.score < current.score) candidates.set(identity, candidate);
  }
  for (const exclusion of part.exclude ?? []) {
    if (exclusion.kind === "candidate") {
      const excluded = state.candidates.get(exclusion.value);
      if (excluded) candidates.delete([...excluded.nodeIds].sort().join("\0"));
      continue;
    }
    for (const [identity, candidate] of candidates) {
      if (candidate.nodeIds.some((nodeId) => semanticNodeMatches(document, nodeId, exclusion.value))) {
        candidates.delete(identity);
      }
    }
  }
  return [...candidates.values()].sort((left, right) => left.score - right.score || left.nodeIds.join("\0").localeCompare(right.nodeIds.join("\0"))).slice(0, 8);
};
currentSelectionProjectionForRef_fn = function(sessionId, drawingRef) {
  const projection = __privateGet(this, _selectionProjections).get(sessionId);
  return projection && projection.drawingRef.drawingId === drawingRef.drawingId && projection.drawingRef.revision === drawingRef.revision && projection.expiresAt > this.ports.now() ? structuredClone(projection) : null;
};
appendGroundingEvidence_fn = function(state, episode, drawingRef, part, grounding) {
  const hypothesisId = this.ports.id("hypothesis");
  const evidenceRefs = [state.observationId];
  const hypothesis = {
    id: hypothesisId,
    drawingId: drawingRef.drawingId,
    revision: String(drawingRef.revision),
    label: part.label,
    referringExpression: part.partKey,
    observationRefs: [state.observationId],
    regionRefs: [],
    supports: [
      ...part.nodeIds.map((nodeId) => ({
        kind: "node",
        ref: nodeId,
        weight: 1,
        role: "interior"
      })),
      ...grounding.interfaces.map(({ interfaceId }) => ({
        kind: "half-edge",
        ref: interfaceId,
        weight: 1,
        role: "interface"
      }))
    ],
    excludedSupports: [],
    interfaceRefs: grounding.interfaces.map(({ interfaceId }) => interfaceId),
    confidence: 1,
    provenance: { provider: "vectorai-host", evidenceRefs, createdAt: this.ports.now() }
  };
  state.ledger.append({
    id: this.ports.id("grounding-event"),
    episodeId: episode.episodeId,
    drawingId: drawingRef.drawingId,
    revision: String(drawingRef.revision),
    hypothesisId,
    kind: "proposed",
    hypothesis,
    evidenceRefs,
    reasonCode: "MODEL_SEMANTIC_SELECTION",
    createdAt: this.ports.now()
  });
  state.ledger.append({
    id: this.ports.id("grounding-event"),
    episodeId: episode.episodeId,
    drawingId: drawingRef.drawingId,
    revision: String(drawingRef.revision),
    hypothesisId,
    kind: "selected",
    evidenceRefs,
    reasonCode: "HOST_SELECTION_RESOLVED",
    createdAt: this.ports.now()
  });
};
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
    reviewEvidence: evaluated.evaluation.review,
    ...preview.solverProvenance ? { solverProvenance: preview.solverProvenance } : {}
  });
  if (receipt.status === "no-effect") {
    __privateGet(this, _previews2).delete(sessionId);
    __privateGet(this, _groundingOverlays).delete(sessionId);
    return {
      status: "already-satisfied",
      ref: receipt.ref,
      operationId: receipt.operationId,
      operationBindingDigest: receipt.operationBindingDigest
    };
  }
  if (receipt.status !== "committed" || receipt.mode !== "semantic") {
    throw new Error("EDIT_COMMIT_RECEIPT_INVALID");
  }
  __privateGet(this, _previews2).delete(sessionId);
  __privateGet(this, _groundingOverlays).delete(sessionId);
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
  var _a3;
  const reasons = [];
  const hard = evaluation.diagnostics.some((diagnostic2) => diagnostic2.severity === "error" && diagnostic2.hard);
  if (hard) reasons.push("HARD_VALIDATION_FAILED");
  if (preview.groundings.some(({ target }) => target.sourceStatus !== "confirmed")) reasons.push("SOURCE_NOT_CONFIRMED");
  if (evaluation.diagnostics.some((diagnostic2) => diagnostic2.severity !== "info")) reasons.push("DIAGNOSTICS_PRESENT");
  if (evaluation.review.outcome !== "satisfied") reasons.push("REVIEW_NOT_SATISFIED");
  const safeAnnotationCreate = ((_a3 = preview.program) == null ? void 0 : _a3.operations.every((operation) => operation.kind === "create_annotation_batch" && operation.annotations.every((node) => annotationConfirmed(node)) && operation.associations.every((node) => associationResolved(node)))) ?? false;
  if (preview.compilation.actualEffect.deletedNodeIds.length > 0 || preview.compilation.actualEffect.createdNodeIds.length > 0 && !safeAnnotationCreate) {
    reasons.push("LIFECYCLE_CHANGE");
  }
  const allowed = /* @__PURE__ */ new Set([
    ...preview.groundings.flatMap(({ target }) => target.targetNodeIds),
    ...preview.groundings.flatMap(({ target }) => target.interfaces.map(({ nodeId }) => nodeId))
  ]);
  if (preview.compilation.actualEffect.updatedNodeIds.some((id) => !allowed.has(id))) {
    reasons.push("OUT_OF_SCOPE_EFFECT");
  }
  const base2 = {
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
    ...base2,
    disposition: "blocked",
    hardDeny: hard,
    nonOverridableProtected: reasons.includes("OUT_OF_SCOPE_EFFECT")
  };
  if (preview.task.ref.policy !== "auto-safe") reasons.push("TASK_REVIEW_POLICY");
  if (reasons.length > 0) return {
    ...base2,
    disposition: "confirmation_required",
    requiredEffectDigest: preview.ref.effectDigest
  };
  return {
    ...base2,
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
storeCompilation_fn = function(sessionId, task, baseRef, groundings, compilation, summary, program) {
  const workspace = this.drawings.createPreview(sessionId, {
    ref: baseRef,
    commands: compilation.forward,
    summary
  });
  if (workspace.status !== "previewed") {
    throw new Error(workspace.status === "rejected" ? workspace.code ?? "EDIT_PREVIEW_REJECTED" : "EDIT_BASE_STALE");
  }
  const finalizeOperationId = this.ports.id("finalize");
  const finalizeOperationBindingDigest = this.ports.digest(canonicalString({
    mode: "semantic",
    sessionId,
    drawingId: baseRef.drawingId,
    operationId: finalizeOperationId,
    previewHandle: workspace.preview.handle,
    candidateDigest: compilation.candidateDigest
  }));
  const groundingIds = groundings.map(({ ref: ref2 }) => ref2.groundingId);
  const ref = {
    previewHandle: workspace.preview.handle,
    taskId: task.ref.taskId,
    groundingId: groundingIds[0],
    ...groundingIds.length > 1 ? { groundingIds } : {},
    baseRef: structuredClone(baseRef),
    candidateDigest: compilation.candidateDigest,
    effectDigest: compilation.effectDigest,
    finalizeOperationId,
    finalizeOperationBindingDigest
  };
  task.candidateCount += 1;
  __privateGet(this, _previews2).set(sessionId, {
    ref,
    task,
    groundings: [...groundings],
    ...program ? { program } : {},
    compilation
  });
  __privateGet(this, _groundingOverlays).delete(sessionId);
  return structuredClone(ref);
};
updateGroundingOverlay_fn = function(sessionId, task, drawingRef, grounding, rawPartKey, rawLabel, role = "target") {
  const partKey = rawPartKey == null ? void 0 : rawPartKey.trim();
  const label = rawLabel == null ? void 0 : rawLabel.trim();
  if (partKey !== void 0 && (partKey.length === 0 || partKey.length > 64)) {
    throw new Error("EDIT_PART_KEY_INVALID");
  }
  if (label !== void 0 && (label.length === 0 || label.length > 80)) {
    throw new Error("EDIT_PART_LABEL_INVALID");
  }
  if (partKey === void 0 !== (label === void 0)) throw new Error("EDIT_PART_DISPLAY_PAIR_REQUIRED");
  const current = __privateGet(this, _groundingOverlays).get(sessionId);
  const existingGroups = partKey && (current == null ? void 0 : current.taskId) === task.ref.taskId ? [...current.groups] : [];
  const existingIndex = partKey ? existingGroups.findIndex((group2) => group2.partKey === partKey) : -1;
  const colorIndex = existingIndex >= 0 ? existingGroups[existingIndex].colorIndex : existingGroups.length;
  const group = {
    groundingId: grounding.groundingId,
    partKey: partKey ?? `grounding:${grounding.groundingId}`,
    label: label ?? "Grounded target",
    role,
    colorIndex,
    nodeIds: [...grounding.targetNodeIds].sort(),
    interfaces: grounding.interfaces.map((port) => structuredClone(port)).sort((left, right) => left.interfaceId.localeCompare(right.interfaceId))
  };
  if (existingIndex >= 0) existingGroups.splice(existingIndex, 1, group);
  else existingGroups.push(group);
  __privateGet(this, _groundingOverlays).set(sessionId, {
    version: 1,
    drawingRef: structuredClone(drawingRef),
    taskId: task.ref.taskId,
    stateEpoch: task.ref.stateEpoch,
    disposition: "active",
    groups: existingGroups
  });
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
function projectSpatialSelectionCorrection(error, state) {
  if (!error || typeof error !== "object") return error;
  const failure = error;
  const candidateKeysFor = (nodeIds) => {
    const selected = new Set(nodeIds);
    return [...state.candidates.entries()].filter(([, candidate]) => candidate.nodeIds.length === 1 && selected.has(candidate.nodeIds[0])).map(([key]) => key).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
  };
  if (failure.code === "EDIT_ARTICULATED_COMPANION_PART_INVALID" && Array.isArray(failure.unexpectedPartKeys) && failure.unexpectedPartKeys.every((partKey) => typeof partKey === "string")) {
    const removeParts = failure.unexpectedPartKeys.flatMap((partKey) => {
      const target = state.selectedParts[partKey];
      if (!target) return [];
      return [{ partKey, candidates: candidateKeysFor(target.targetNodeIds) }];
    });
    if (removeParts.length > 0) return Object.assign(
      new Error("EDIT_ARTICULATED_COMPANION_PART_INVALID"),
      { correction: { removeParts } }
    );
  }
  if (failure.code === "EDIT_ARTICULATED_SELECTION_FRAGMENTED" && typeof failure.partKey === "string" && Array.isArray(failure.mergePartKeys) && failure.mergePartKeys.every((partKey) => typeof partKey === "string") && Array.isArray(failure.mergeNodeIds) && failure.mergeNodeIds.every((nodeId) => typeof nodeId === "string") && Array.isArray(failure.unexpectedPartKeys) && failure.unexpectedPartKeys.every((partKey) => typeof partKey === "string")) {
    const mergeCandidates = candidateKeysFor(failure.mergeNodeIds);
    const removeParts = failure.unexpectedPartKeys.flatMap((partKey) => {
      const target = state.selectedParts[partKey];
      if (!target) return [];
      return [{ partKey, candidates: candidateKeysFor(target.targetNodeIds) }];
    });
    if (mergeCandidates.length > 0) return Object.assign(
      new Error("EDIT_ARTICULATED_SELECTION_FRAGMENTED"),
      { correction: { mergeIntoPart: { partKey: failure.partKey, candidates: mergeCandidates }, removeParts } }
    );
  }
  if (failure.code === "EDIT_ARTICULATED_SELECTION_INVALID" && typeof failure.partKey === "string" && Array.isArray(failure.unexpectedNodeIds) && failure.unexpectedNodeIds.every((nodeId) => typeof nodeId === "string")) {
    const removeCandidates = candidateKeysFor(failure.unexpectedNodeIds);
    if (removeCandidates.length > 0) return Object.assign(
      new Error("EDIT_ARTICULATED_SELECTION_INVALID"),
      { correction: { parts: [{ partKey: failure.partKey, removeCandidates }] } }
    );
  }
  if (failure.code === "EDIT_SELECTED_PART_UNUSED" && Array.isArray(failure.unusedPartKeys) && failure.unusedPartKeys.every((partKey) => typeof partKey === "string")) {
    const removeParts = failure.unusedPartKeys.flatMap((partKey) => {
      const target = state.selectedParts[partKey];
      if (!target) return [];
      return [{ partKey, candidates: candidateKeysFor(target.targetNodeIds) }];
    });
    if (removeParts.length > 0) return Object.assign(
      new Error("EDIT_SELECTED_PART_UNUSED"),
      { correction: { removeParts } }
    );
  }
  return error;
}
function spatialCorrectionAllowedNodeIds(error, state) {
  var _a3;
  if (!error || typeof error !== "object") return void 0;
  const failure = error;
  const excluded = /* @__PURE__ */ new Set();
  if (failure.code === "EDIT_ARTICULATED_COMPANION_PART_INVALID" && Array.isArray(failure.unexpectedNodeIds) && failure.unexpectedNodeIds.every((nodeId) => typeof nodeId === "string")) {
    for (const nodeId of failure.unexpectedNodeIds) excluded.add(nodeId);
  }
  if (failure.code === "EDIT_ARTICULATED_SELECTION_FRAGMENTED" && Array.isArray(failure.unexpectedNodeIds) && failure.unexpectedNodeIds.every((nodeId) => typeof nodeId === "string")) {
    for (const nodeId of failure.unexpectedNodeIds) excluded.add(nodeId);
  }
  if (failure.code === "EDIT_ARTICULATED_SELECTION_INVALID" && Array.isArray(failure.unexpectedNodeIds) && failure.unexpectedNodeIds.every((nodeId) => typeof nodeId === "string")) {
    for (const nodeId of failure.unexpectedNodeIds) excluded.add(nodeId);
  }
  if (failure.code === "EDIT_SELECTED_PART_UNUSED" && Array.isArray(failure.unusedPartKeys) && failure.unusedPartKeys.every((partKey) => typeof partKey === "string")) {
    for (const partKey of failure.unusedPartKeys) {
      for (const nodeId of ((_a3 = state.selectedParts[partKey]) == null ? void 0 : _a3.targetNodeIds) ?? []) excluded.add(nodeId);
    }
  }
  if (excluded.size === 0) return void 0;
  return [...new Set(Object.values(state.selectedParts).flatMap(({ targetNodeIds }) => targetNodeIds))].filter((nodeId) => !excluded.has(nodeId)).sort();
}
function spatialCorrectionRequest(error, state) {
  if (!error || typeof error !== "object") return void 0;
  const failure = error;
  const nodesByPart = new Map(Object.entries(state.selectedParts).map(([partKey, target]) => [partKey, new Set(target.targetNodeIds)]));
  if (failure.code === "EDIT_ARTICULATED_SELECTION_FRAGMENTED" && typeof failure.partKey === "string" && Array.isArray(failure.mergePartKeys) && failure.mergePartKeys.every((partKey) => typeof partKey === "string") && Array.isArray(failure.unexpectedPartKeys) && failure.unexpectedPartKeys.every((partKey) => typeof partKey === "string")) {
    const destination = nodesByPart.get(failure.partKey);
    if (!destination) return void 0;
    for (const partKey of failure.mergePartKeys) {
      for (const nodeId of nodesByPart.get(partKey) ?? []) destination.add(nodeId);
      nodesByPart.delete(partKey);
    }
    for (const partKey of failure.unexpectedPartKeys) nodesByPart.delete(partKey);
  } else if (failure.code === "EDIT_ARTICULATED_SELECTION_INVALID" && typeof failure.partKey === "string" && Array.isArray(failure.unexpectedNodeIds) && failure.unexpectedNodeIds.every((nodeId) => typeof nodeId === "string")) {
    const target = nodesByPart.get(failure.partKey);
    if (!target) return void 0;
    for (const nodeId of failure.unexpectedNodeIds) target.delete(nodeId);
  } else if (failure.code === "EDIT_SELECTED_PART_UNUSED" && Array.isArray(failure.unusedPartKeys) && failure.unusedPartKeys.every((partKey) => typeof partKey === "string") || failure.code === "EDIT_ARTICULATED_COMPANION_PART_INVALID" && Array.isArray(failure.unexpectedPartKeys) && failure.unexpectedPartKeys.every((partKey) => typeof partKey === "string")) {
    const removePartKeys = failure.code === "EDIT_SELECTED_PART_UNUSED" ? failure.unusedPartKeys : failure.unexpectedPartKeys;
    for (const partKey of removePartKeys) nodesByPart.delete(partKey);
  } else {
    return void 0;
  }
  const candidateKeyFor = (nodeId) => {
    var _a3;
    return (_a3 = [...state.candidates.entries()].find(([, candidate]) => candidate.nodeIds.length === 1 && candidate.nodeIds[0] === nodeId)) == null ? void 0 : _a3[0];
  };
  const parts = [...nodesByPart.entries()].sort(([left], [right]) => left.localeCompare(right)).flatMap(([
    partKey,
    nodeIds
  ]) => {
    const keys = [...nodeIds].map(candidateKeyFor).filter((key) => key !== void 0).sort((left, right) => Number(left.slice(1)) - Number(right.slice(1)));
    if (keys.length !== nodeIds.size || keys.length === 0) return [];
    return [{
      partKey,
      label: partKey,
      role: state.selectionRoles[partKey] ?? "target",
      references: keys.map((key) => ({ kind: "candidate", key })),
      exclude: []
    }];
  });
  return parts.length > 0 ? { parts } : void 0;
}
function inferSelectionInterfaces(document, targetNodeIds, revision) {
  const selected = new Set(targetNodeIds);
  const targets = document.geometry.filter((node) => selected.has(String(node.id)));
  const exactCarrierInterfaces = targets.flatMap((target) => target.type === "circle" || target.type === "ellipse" ? findConnectedCarrierInterfaces(document, String(target.id)).filter(({ nodeId }) => !selected.has(nodeId)).map(({ interfaceId, nodeId, endpoint }) => ({ interfaceId, nodeId, endpoint })) : []);
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
  const bounds2 = document.geometry.filter(({ visible }) => visible).map(geometryNodeBounds);
  if (bounds2.length === 0) return 1;
  return Math.hypot(
    Math.max(...bounds2.map(({ maxX }) => maxX)) - Math.min(...bounds2.map(({ minX }) => minX)),
    Math.max(...bounds2.map(({ maxY }) => maxY)) - Math.min(...bounds2.map(({ minY }) => minY))
  ) || 1;
}
function selectionCandidate(document, nodeIds, score, stateEpoch) {
  const unique2 = [...new Set(nodeIds)].sort();
  return {
    key: "",
    nodeIds: unique2,
    score,
    summary: candidateSummary(document, unique2),
    stateEpoch
  };
}
function pointCandidates(document, point, stateEpoch) {
  var _a3;
  const ranked = document.geometry.filter(({ visible }) => visible).map((node) => ({ node, distance: distanceToSelectableGeometry(node, point) })).sort((left, right) => left.distance - right.distance || String(left.node.id).localeCompare(String(right.node.id)));
  const minimum = ((_a3 = ranked[0]) == null ? void 0 : _a3.distance) ?? Number.POSITIVE_INFINITY;
  const tolerance = Math.max(geometryDiagonal(document) * 0.03, 1e-6);
  if (minimum > tolerance) return [];
  return ranked.filter(({ distance: distance2 }) => distance2 <= minimum + tolerance * 0.1).slice(0, 8).map(({ node, distance: distance2 }) => selectionCandidate(document, [String(node.id)], distance2, stateEpoch));
}
function regionCandidates(document, polygon, stateEpoch) {
  if (polygon.length < 3) return [];
  const nodeIds = document.geometry.filter(({ visible }) => visible).filter((node) => {
    const center2 = geometryCenter(node);
    return center2 !== null && pointInPolygon(center2, polygon);
  }).map(({ id }) => String(id)).sort();
  return nodeIds.length === 0 ? [] : [selectionCandidate(document, nodeIds, 0, stateEpoch)];
}
function geometryNodeSize(node) {
  const bounds2 = geometryNodeBounds(node);
  return Math.hypot(bounds2.maxX - bounds2.minX, bounds2.maxY - bounds2.minY);
}
function semanticCandidates(document, query, stateEpoch) {
  return document.geometry.filter(({ visible, id }) => visible && semanticNodeMatches(document, String(id), query)).map((node) => selectionCandidate(document, [String(node.id)], semanticMatchScore(node, query), stateEpoch)).sort((left, right) => left.score - right.score || left.nodeIds[0].localeCompare(right.nodeIds[0])).slice(0, 8);
}
function visualFallbackCandidates(candidates, query, stateEpoch) {
  const normalized = normalizeSemanticText(query);
  const hints = [
    { present: /(?:^| )left(?: |$)/.test(normalized) || query.includes("左"), match: "left" },
    { present: /(?:^| )right(?: |$)/.test(normalized) || query.includes("右"), match: "right" },
    { present: /(?:^| )(?:top|upper)(?: |$)/.test(normalized) || query.includes("上"), match: "upper" },
    { present: /(?:^| )(?:bottom|lower)(?: |$)/.test(normalized) || query.includes("下"), match: "lower" },
    { present: /(?:^| )(?:circle|round)(?: |$)/.test(normalized) || query.includes("圆"), match: "circle" },
    { present: /(?:^| )line(?: |$)/.test(normalized) || query.includes("线"), match: "line" }
  ].filter(({ present }) => present).map(({ match }) => match);
  const all = [...candidates].filter((candidate) => candidate.stateEpoch === stateEpoch);
  const filtered = hints.length === 0 ? all : all.filter(({ summary }) => hints.every((hint) => summary.includes(hint)));
  return (filtered.length > 0 ? filtered : all).slice(0, 16).map((candidate) => structuredClone(candidate));
}
function semanticNodeMatches(document, nodeId, query) {
  const node = document.geometry.find(({ id }) => String(id) === nodeId);
  if (!node) return false;
  const normalizedQuery = normalizeSemanticText(query);
  if (!normalizedQuery) return false;
  const searchable = `${normalizeSemanticText(nodeId)} ${normalizeSemanticText(node.type)}`;
  const tokens = normalizedQuery.split(" ").filter(Boolean);
  return tokens.every((token) => searchable.includes(token));
}
function semanticMatchScore(node, query) {
  const normalizedQuery = normalizeSemanticText(query);
  const normalizedId = normalizeSemanticText(String(node.id));
  return normalizedId === normalizedQuery ? 0 : normalizedId.includes(normalizedQuery) ? 1 : 2;
}
function normalizeSemanticText(value2) {
  return value2.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}
function candidateSummary(document, nodeIds) {
  const nodes = document.geometry.filter(({ id }) => nodeIds.includes(String(id)));
  const typeSummary = [...new Set(nodes.map(({ type }) => type))].sort().join("+") || "geometry";
  const centers = nodes.flatMap((node) => {
    const center2 = geometryCenter(node);
    return center2 ? [center2] : [];
  });
  if (centers.length === 0) return `${nodeIds.length} ${typeSummary} element`;
  const centerX = centers.reduce((sum, [x]) => sum + x, 0) / centers.length;
  const centerY = centers.reduce((sum, [, y]) => sum + y, 0) / centers.length;
  const bounds2 = document.geometry.map(geometryNodeBounds);
  const minX = Math.min(...bounds2.map(({ minX: value2 }) => value2));
  const maxX = Math.max(...bounds2.map(({ maxX: value2 }) => value2));
  const minY = Math.min(...bounds2.map(({ minY: value2 }) => value2));
  const maxY = Math.max(...bounds2.map(({ maxY: value2 }) => value2));
  const horizontal = centerX < minX + (maxX - minX) / 3 ? "left" : centerX > minX + (maxX - minX) * 2 / 3 ? "right" : "center";
  const vertical = centerY < minY + (maxY - minY) / 3 ? "lower" : centerY > minY + (maxY - minY) * 2 / 3 ? "upper" : "middle";
  return `${nodeIds.length} ${typeSummary} element in ${vertical}-${horizontal} area`;
}
function pointInPolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index];
    const [x2, y2] = polygon[previous];
    if (y1 > point[1] !== y2 > point[1] && point[0] < (x2 - x1) * (point[1] - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}
function distanceToSelectableGeometry(node, point) {
  if (node.type === "point") return Math.hypot(point[0] - node.x, point[1] - node.y);
  if (node.type === "circle" || node.type === "arc") {
    const radial = Math.hypot(point[0] - node.center[0], point[1] - node.center[1]);
    return node.type === "circle" && radial <= node.radius ? 0 : Math.abs(radial - node.radius);
  }
  if (node.type === "ellipse") {
    const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
    if (major <= 1e-9 || node.ratio <= 0) return Number.POSITIVE_INFINITY;
    const ux = node.majorAxis[0] / major;
    const uy = node.majorAxis[1] / major;
    const dx = point[0] - node.center[0];
    const dy = point[1] - node.center[1];
    const normalized = Math.hypot((dx * ux + dy * uy) / major, (-dx * uy + dy * ux) / (major * node.ratio));
    return normalized <= 1 ? 0 : (normalized - 1) * major;
  }
  const segments = node.type === "line" ? [[node.start, node.end]] : node.type === "polyline" ? node.vertices.slice(1).map((vertex, index) => [node.vertices[index].point, vertex.point]) : node.type === "spline" ? node.controlPoints.slice(1).map((vertex, index) => [node.controlPoints[index], vertex]) : [];
  if (segments.length > 0) return Math.min(...segments.map(([start, end]) => distanceToSegment(point, start, end)));
  const center2 = geometryCenter(node);
  return center2 ? Math.hypot(point[0] - center2[0], point[1] - center2[1]) : Number.POSITIVE_INFINITY;
}
function distanceToSegment(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= 1e-18) return Math.hypot(point[0] - start[0], point[1] - start[1]);
  const ratio = Math.max(0, Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (start[0] + ratio * dx), point[1] - (start[1] + ratio * dy));
}
function finiteVec2(value2, code) {
  if (!Array.isArray(value2) || value2.length !== 2 || value2.some((coordinate) => !Number.isFinite(coordinate))) {
    throw new Error(code);
  }
  return [value2[0], value2[1]];
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
      return { status: "rejected", message: errorMessage$1(error), code: "INTERACTIVE_EDIT_REJECTED" };
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
function errorMessage$1(error) {
  return error instanceof Error ? error.message : String(error);
}
class MotionRigService {
  constructor(drawings) {
    __privateAdd(this, _rigs, /* @__PURE__ */ new Map());
    this.drawings = drawings;
  }
  create(sessionId, semanticNodeIds) {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return {
      state: "blocked",
      code: "drawing_required",
      message: "No editable vector Drawing is loaded."
    };
    try {
      const definition = resolveTranslationMotionRig(snapshot.document, semanticNodeIds);
      const projection = {
        version: 1,
        drawingRef: structuredClone(snapshot.ref),
        state: "ready",
        ...definition
      };
      __privateGet(this, _rigs).set(sessionId, projection);
      return {
        state: "ready",
        summary: "Temporary movement constraint is ready.",
        controlNodeCount: projection.controlBodyNodeIds.length,
        connectorNodeCount: projection.connectors.length
      };
    } catch (error) {
      return createFailure(error);
    }
  }
  current(sessionId) {
    const rig = __privateGet(this, _rigs).get(sessionId);
    if (!rig) return null;
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot || !sameRef$1(snapshot.ref, rig.drawingRef)) {
      __privateGet(this, _rigs).delete(sessionId);
      return null;
    }
    return structuredClone(rig);
  }
  rebuild(sessionId, expectedRef, nodeIds) {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) return { status: "rejected", code: "DRAWING_REQUIRED", message: "No Drawing is loaded." };
    if (!sameRef$1(snapshot.ref, expectedRef)) return {
      status: "stale",
      currentRef: structuredClone(snapshot.ref)
    };
    try {
      const definition = resolveTranslationMotionRig(snapshot.document, nodeIds);
      const projection = {
        version: 1,
        drawingRef: structuredClone(snapshot.ref),
        state: "ready",
        ...definition
      };
      __privateGet(this, _rigs).set(sessionId, projection);
      return { status: "ready", projection: structuredClone(projection) };
    } catch (error) {
      const previous = this.current(sessionId);
      return {
        status: "needs-correction",
        ...previous ? { projection: previous } : {},
        message: errorMessage(error)
      };
    }
  }
  discard(sessionId, expectedRef) {
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (!snapshot) {
      __privateGet(this, _rigs).delete(sessionId);
      return { status: "rejected", code: "DRAWING_REQUIRED", message: "No Drawing is loaded." };
    }
    if (expectedRef && !sameRef$1(snapshot.ref, expectedRef)) return {
      status: "stale",
      currentRef: structuredClone(snapshot.ref)
    };
    __privateGet(this, _rigs).delete(sessionId);
    return { status: "discarded" };
  }
  disposeSession(sessionId) {
    __privateGet(this, _rigs).delete(sessionId);
  }
}
_rigs = new WeakMap();
function createFailure(error) {
  const reason = errorMessage(error);
  if (reason === "MOTION_RIG_AMBIGUOUS") return {
    state: "blocked",
    code: "ambiguous_topology",
    message: "Multiple movement anchors are equally plausible."
  };
  if (reason === "MOTION_RIG_GEOMETRY_UNSUPPORTED") return {
    state: "blocked",
    code: "unsupported_geometry",
    message: "The selected connector geometry is not safely deformable."
  };
  return { state: "needs_correction", summary: "The movement constraint needs selection correction.", reason };
}
function sameRef$1(left, right) {
  return left.drawingId === right.drawingId && left.revision === right.revision;
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
  const disposeRedo = commands.register({
    name: "drawing-redo",
    description: "Redo the exact current Drawing Undo as a new durable revision.",
    input: { hint: "<undoCommitId> <drawingId>@<revision> <operationId> <operationBindingDigest>" },
    recordInput: false,
    async handler(invocation) {
      const [targetCommitId, encodedRef, operationId, operationBindingDigest, ...extra] = invocation.rawInput.trim().split(/\s+/);
      const match = encodedRef == null ? void 0 : encodedRef.match(/^(.+)@(\d+)$/);
      if (!targetCommitId || !match || !operationId || !operationBindingDigest || extra.length > 0) {
        return { kind: "error", text: "Usage: /drawing-redo <undoCommitId> <drawingId>@<revision> <operationId> <operationBindingDigest>" };
      }
      try {
        const receipt = semantic.redo(String(invocation.agent.id), {
          targetCommitId,
          expectedCurrentRef: { drawingId: match[1], revision: Number(match[2]) },
          operationId,
          operationBindingDigest
        });
        return { kind: "success", text: JSON.stringify(receipt) };
      } catch (error) {
        return { kind: "error", text: error instanceof Error ? error.message : String(error) };
      }
    }
  });
  return () => {
    disposeRedo();
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
  const candidateLayout = layoutCandidateMarkers(input.document, input.candidateMarkers ?? [], transform2, width, height);
  const worldOverlays = validateWorldOverlays(input.worldOverlays ?? []);
  const worldOverlayShapes = worldOverlays.map(({ id, polygon }) => `<polygon data-world-overlay="${escapeXml(id)}" points="${polygon.map((point) => point.join(",")).join(" ")}" fill="#35bdf455" stroke="#35bdf4" stroke-width="2" vector-effect="non-scaling-stroke"/>`).join("");
  const worldOverlayLabels = worldOverlays.map(({ id, label, polygon }) => {
    const anchor = worldToImage(average(polygon), transform2);
    return `<g data-world-overlay-label="${escapeXml(id)}"><rect x="${anchor[0] - 14}" y="${anchor[1] - 11}" width="28" height="22" rx="5" fill="#08384d" stroke="#35bdf4"/><text x="${anchor[0]}" y="${anchor[1] + 4}" text-anchor="middle" fill="#ecfbff" font-family="ui-monospace, monospace" font-size="12" font-weight="700">${escapeXml(label)}</text></g>`;
  }).join("");
  const candidateLabels = candidateLayout.map(({ key, anchor, labelPosition, boxWidth }) => {
    const [anchorX, anchorY] = anchor;
    const [labelX, labelY] = labelPosition;
    return `<g data-candidate="${escapeXml(key)}">
      <line x1="${anchorX}" y1="${anchorY}" x2="${labelX + 2}" y2="${labelY + 9}" stroke="#50b7ff" stroke-width="1" opacity="0.72"/>
      <circle cx="${anchorX}" cy="${anchorY}" r="2.4" fill="#50b7ff"/>
      <rect x="${labelX}" y="${labelY}" width="${boxWidth}" height="18" rx="4" fill="#0a3650" stroke="#50b7ff" stroke-width="1"/>
      <text x="${labelX + 4}" y="${labelY + 12.5}" fill="#f4fbff" font-family="ui-monospace, monospace" font-size="11" font-weight="700">${escapeXml(key)}</text>
    </g>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#101419"/>
    <g transform="matrix(${transform2.join(" ")})">${worldOverlayShapes}${normal}${highlight}</g>
    ${candidateLabels}${worldOverlayLabels}
  </svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return {
    png,
    contentDigest: `sha256:${createHash("sha256").update(png).digest("hex")}`,
    manifest: {
      rendererVersion: "vectorai-observation-svg-v2",
      width,
      height,
      worldToImage: transform2,
      viewport: structuredClone(input.viewport),
      overlays: ["selection", "candidate-labels"],
      selectedNodeCount: selected.size,
      candidateMarkers: candidateLayout.map(({ key, nodeCount, anchor, labelPosition }) => ({
        key,
        nodeCount,
        anchor,
        labelPosition
      })),
      worldOverlays: structuredClone(worldOverlays)
    }
  };
}
function layoutCandidateMarkers(document, candidates, transform2, width, height) {
  const nodes = new Map([...document.geometry, ...document.annotations].map((node) => [String(node.id), node]));
  const occupied = [];
  return candidates.flatMap(({ key, nodeIds }) => {
    const centers = nodeIds.flatMap((nodeId) => {
      const value2 = center(nodes.get(nodeId));
      return value2 ? [value2] : [];
    });
    const world = average(centers);
    if (!world) return [];
    const anchor = [
      transform2[0] * world[0] + transform2[2] * world[1] + transform2[4],
      transform2[1] * world[0] + transform2[3] * world[1] + transform2[5]
    ];
    const boxWidth = Math.max(24, 8 + key.length * 7);
    const labelPosition = placeCandidateLabel(anchor, boxWidth, width, height, occupied);
    occupied.push({
      minX: labelPosition[0],
      minY: labelPosition[1],
      maxX: labelPosition[0] + boxWidth,
      maxY: labelPosition[1] + 18
    });
    return [{ key, nodeCount: nodeIds.length, anchor, labelPosition, boxWidth }];
  });
}
function placeCandidateLabel(anchor, boxWidth, width, height, occupied) {
  const offsets = [[7, -22], [7, 5], [-boxWidth - 7, -22], [-boxWidth - 7, 5]];
  for (let radius = 24; radius <= 120; radius += 16) {
    for (let step = 0; step < 16; step += 1) {
      const angle = step * Math.PI / 8;
      offsets.push([Math.cos(angle) * radius - boxWidth / 2, Math.sin(angle) * radius - 9]);
    }
  }
  for (const [dx, dy] of offsets) {
    const x = Math.max(2, Math.min(width - boxWidth - 2, anchor[0] + dx));
    const y = Math.max(2, Math.min(height - 20, anchor[1] + dy));
    const box = { minX: x - 2, minY: y - 2, maxX: x + boxWidth + 2, maxY: y + 20 };
    if (occupied.every((other) => box.maxX < other.minX || box.minX > other.maxX || box.maxY < other.minY || box.minY > other.maxY)) return [x, y];
  }
  return [
    Math.max(2, Math.min(width - boxWidth - 2, anchor[0] + 7)),
    Math.max(2, Math.min(height - 20, anchor[1] - 22))
  ];
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
      return `<polyline points="${sampleSpline(node, { maxError: 0.1 }).map((point) => point.join(",")).join(" ")}" ${style}/>`;
    case "text":
      return textBox(node.position, node.height, node.content, color);
    case "dimension":
      return `${node.definitionPoints.length > 1 ? `<polyline points="${node.definitionPoints.map((point) => point.join(",")).join(" ")}" ${style}/>` : ""}${textBox(node.textPosition, 4, node.displayText ?? "DIM", color)}`;
    case "leader":
      return `<polyline points="${node.points.map((point) => point.join(",")).join(" ")}" ${style}/>${textBox(node.points.at(-1) ?? [0, 0], node.textHeight, node.content, color)}`;
    case "centerline":
      return `<line x1="${node.start[0]}" y1="${node.start[1]}" x2="${node.end[0]}" y2="${node.end[1]}" stroke-dasharray="8 4" ${style}/>`;
    case "section-hatch": {
      if (node.hatch === void 0) return (node.segments ?? []).map(({ start, end }) => `<line x1="${start[0]}" y1="${start[1]}" x2="${end[0]}" y2="${end[1]}" ${style}/>`).join("");
      const result = createHatchRenderPlan(node.hatch, 0.01);
      if (result.status !== "ok") return "";
      const clipId = `hatch-${String(node.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
      const path = result.plan.region.contours.map((contour) => contour.length === 0 ? "" : `M ${contour[0][0]} ${contour[0][1]} ${contour.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ")} Z`).join(" ");
      return `<defs><clipPath id="${clipId}"><path d="${path}" fill-rule="${result.plan.region.fillRule}" clip-rule="${result.plan.region.fillRule}"/></clipPath></defs>${result.plan.lines.map((line2) => `<line x1="${line2.start[0]}" y1="${line2.start[1]}" x2="${line2.end[0]}" y2="${line2.end[1]}" clip-path="url(#${clipId})" ${style}/>`).join("")}`;
    }
  }
}
function validateWorldOverlays(overlays) {
  if (overlays.length > 128) throw new Error("DRAWING_OBSERVATION_OVERLAY_INVALID");
  for (const overlay of overlays) {
    if (!overlay.id || !overlay.label || overlay.label.length > 80 || overlay.polygon.length < 3 || overlay.polygon.length > 16 || overlay.polygon.some((point) => point.length !== 2 || point.some((value2) => !Number.isFinite(value2)))) {
      throw new Error("DRAWING_OBSERVATION_OVERLAY_INVALID");
    }
  }
  return structuredClone(overlays);
}
function worldToImage(point, transform2) {
  return [
    transform2[0] * point[0] + transform2[2] * point[1] + transform2[4],
    transform2[1] * point[0] + transform2[3] * point[1] + transform2[5]
  ];
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
    case "section-hatch": {
      if (node.hatch !== void 0) {
        const normalized = normalizeHatchRegion(node.hatch, 0.01);
        if (normalized.status === "ok") return [
          (normalized.region.bounds.minX + normalized.region.bounds.maxX) / 2,
          (normalized.region.bounds.minY + normalized.region.bounds.maxY) / 2
        ];
      }
      return average((node.segments ?? []).flatMap(({ start, end }) => [start, end]));
    }
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
function escapeXml(value2) {
  return value2.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
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
function validReview(value2) {
  if (!value2 || typeof value2 !== "object") return false;
  const candidate = value2;
  return (candidate.outcome === "satisfied" || candidate.outcome === "needs_revision") && Array.isArray(candidate.defects) && candidate.defects.length <= 32 && candidate.defects.every((defect) => {
    if (!defect || typeof defect !== "object") return false;
    const item = defect;
    return typeof item.code === "string" && typeof item.reason === "string" && typeof item.scopeDigest === "string";
  });
}
class ExtensionPreviewService {
  constructor(drawings, semantic, ports) {
    __privateAdd(this, _ExtensionPreviewService_instances);
    __privateAdd(this, _states, /* @__PURE__ */ new Map());
    __privateAdd(this, _ttlMs);
    this.drawings = drawings;
    this.semantic = semantic;
    this.ports = ports;
    __privateSet(this, _ttlMs, ports.ttlMs ?? 15 * 6e4);
  }
  async create(sessionId, raw, signal) {
    const request = extensionPreviewCreateRequestSchema.parse(raw);
    const stale = __privateMethod(this, _ExtensionPreviewService_instances, currentRefResult_fn).call(this, sessionId, request.ref);
    if (stale !== null) return stale;
    if (!sameRef(request.program.baseRef, request.ref)) {
      return rejected("EXTENSION_BASE_MISMATCH", "The extension program base does not match the requested Drawing revision.");
    }
    const existing = __privateGet(this, _states).get(sessionId);
    if (existing !== void 0) {
      if (__privateMethod(this, _ExtensionPreviewService_instances, expired_fn).call(this, existing)) __privateMethod(this, _ExtensionPreviewService_instances, expire_fn).call(this, sessionId, existing);
      else return rejected("EXTENSION_PREVIEW_BUSY", "Another extension Preview is active for this session.");
    }
    signal == null ? void 0 : signal.throwIfAborted();
    const task = this.semantic.startTask(sessionId, {
      objective: request.program.objective,
      rootUserMessageDigest: this.ports.digest(JSON.stringify({
        extensionId: request.extensionId,
        workflowId: request.workflowId,
        ref: request.ref,
        objective: request.program.objective
      })),
      policy: "auto-safe"
    });
    const observation = await this.semantic.observe(sessionId, { taskId: task.taskId });
    signal == null ? void 0 : signal.throwIfAborted();
    const context = this.semantic.buildContext(sessionId, {
      taskId: task.taskId,
      observationId: observation.observationId
    });
    const grounding = this.semantic.ground(sessionId, {
      taskId: task.taskId,
      contextId: context.contextId,
      targetNodeIds: request.targetNodeIds,
      interfaces: (request.interfaces ?? []).map(({ interfaceId, nodeId, endpoint }) => ({
        interfaceId,
        nodeId,
        endpoint
      }))
    });
    const preview = this.semantic.previewProgram(sessionId, {
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      program: {
        ...structuredClone(request.program),
        baseRef: structuredClone(task.baseRef),
        targetHandle: grounding.targetHandle,
        objective: request.program.objective
      }
    });
    const state = {
      extensionId: request.extensionId,
      workflowId: request.workflowId,
      baseRef: structuredClone(request.ref),
      previewToken: this.ports.id("extension-preview"),
      expiresAt: this.ports.now() + __privateGet(this, _ttlMs),
      taskId: task.taskId,
      groundingId: grounding.groundingId,
      targetHandle: grounding.targetHandle,
      objective: request.program.objective,
      preview: structuredClone(preview)
    };
    __privateGet(this, _states).set(sessionId, state);
    return ready(state);
  }
  async replace(sessionId, raw, signal) {
    const request = extensionPreviewReplaceRequestSchema.parse(raw);
    const checked = __privateMethod(this, _ExtensionPreviewService_instances, validate_fn).call(this, sessionId, request);
    if ("status" in checked) return checked;
    if (!sameRef(request.program.baseRef, checked.baseRef)) {
      return rejected("EXTENSION_BASE_MISMATCH", "The replacement program base does not match the active Preview.");
    }
    signal == null ? void 0 : signal.throwIfAborted();
    const replacement = this.semantic.previewProgram(sessionId, {
      taskId: checked.taskId,
      groundingId: checked.groundingId,
      program: {
        ...structuredClone(request.program),
        baseRef: structuredClone(checked.baseRef),
        targetHandle: checked.targetHandle,
        objective: checked.objective
      }
    });
    checked.preview = structuredClone(replacement);
    checked.expiresAt = this.ports.now() + __privateGet(this, _ttlMs);
    checked.evaluationId = void 0;
    checked.finalized = void 0;
    return ready(checked);
  }
  async assess(sessionId, raw, signal) {
    const request = extensionPreviewControlRequestSchema.parse(raw);
    const checked = __privateMethod(this, _ExtensionPreviewService_instances, validate_fn).call(this, sessionId, request);
    if ("status" in checked) return checked;
    signal == null ? void 0 : signal.throwIfAborted();
    const evaluated = await this.semantic.evaluatePreview(sessionId, {
      taskId: checked.taskId,
      previewHandle: checked.preview.previewHandle,
      candidateDigest: checked.preview.candidateDigest,
      signal
    });
    checked.evaluationId = evaluated.evaluation.evaluationId;
    return {
      status: "assessed",
      previewToken: checked.previewToken,
      candidateDigest: checked.preview.candidateDigest,
      assessment: structuredClone(evaluated.assessment)
    };
  }
  async finalize(sessionId, raw) {
    const request = extensionPreviewControlRequestSchema.parse(raw);
    const replay = __privateMethod(this, _ExtensionPreviewService_instances, ownedState_fn).call(this, sessionId, request);
    if (replay !== null && replay.finalized !== void 0) return structuredClone(replay.finalized);
    const checked = __privateMethod(this, _ExtensionPreviewService_instances, validate_fn).call(this, sessionId, request);
    if ("status" in checked) return checked;
    if (checked.evaluationId === void 0) {
      return rejected("EXTENSION_ASSESSMENT_REQUIRED", "The current extension Preview must be assessed before finalization.");
    }
    const result = this.semantic.finalizePreview(sessionId, {
      previewHandle: checked.preview.previewHandle,
      previewDigest: checked.preview.candidateDigest,
      finalizeOperationId: checked.preview.finalizeOperationId,
      finalizeOperationBindingDigest: checked.preview.finalizeOperationBindingDigest,
      evaluationId: checked.evaluationId
    });
    const response = { status: "finalized", result };
    checked.finalized = structuredClone(response);
    return response;
  }
  async discard(sessionId, raw) {
    const request = extensionPreviewControlRequestSchema.parse(raw);
    const checked = __privateMethod(this, _ExtensionPreviewService_instances, validate_fn).call(this, sessionId, request);
    if ("status" in checked) return checked;
    const result = this.semantic.discardPreview(sessionId, checked.preview.previewHandle);
    __privateGet(this, _states).delete(sessionId);
    return result.status === "discarded" ? { status: "discarded", ref: structuredClone(checked.baseRef) } : rejected("EXTENSION_DISCARD_REJECTED", "The first-layer Preview could not be discarded.");
  }
  disposeSession(sessionId) {
    const state = __privateGet(this, _states).get(sessionId);
    if (state === void 0) return;
    if (state.finalized === void 0) {
      try {
        this.semantic.discardPreview(sessionId, state.preview.previewHandle);
      } catch {
      }
    }
    __privateGet(this, _states).delete(sessionId);
  }
}
_states = new WeakMap();
_ttlMs = new WeakMap();
_ExtensionPreviewService_instances = new WeakSet();
validate_fn = function(sessionId, request) {
  const state = __privateMethod(this, _ExtensionPreviewService_instances, ownedState_fn).call(this, sessionId, request);
  if (state === null) return rejected("EXTENSION_PREVIEW_NOT_FOUND", "No Preview belongs to this extension workflow.");
  if (state.previewToken !== request.previewToken || state.preview.candidateDigest !== request.candidateDigest) return rejected("EXTENSION_PREVIEW_MISMATCH", "The Preview token or candidate digest is no longer current.");
  if (__privateMethod(this, _ExtensionPreviewService_instances, expired_fn).call(this, state)) {
    __privateMethod(this, _ExtensionPreviewService_instances, expire_fn).call(this, sessionId, state);
    return rejected("EXTENSION_PREVIEW_EXPIRED", "The extension Preview token expired.");
  }
  if (!sameRef(request.ref, state.baseRef)) {
    return rejected("EXTENSION_PREVIEW_BINDING_MISMATCH", "The request is not bound to the active Preview revision.");
  }
  const stale = __privateMethod(this, _ExtensionPreviewService_instances, currentRefResult_fn).call(this, sessionId, state.baseRef);
  return stale ?? state;
};
ownedState_fn = function(sessionId, request) {
  const state = __privateGet(this, _states).get(sessionId);
  return state !== void 0 && state.extensionId === request.extensionId && state.workflowId === request.workflowId ? state : null;
};
currentRefResult_fn = function(sessionId, ref) {
  const snapshot = this.drawings.getSnapshot(sessionId);
  if (snapshot === null) {
    return rejected("DRAWING_REQUIRED", "No Drawing is loaded for this session.");
  }
  return sameRef(snapshot.ref, ref) ? null : { status: "needs-rebase", currentRef: structuredClone(snapshot.ref) };
};
expired_fn = function(state) {
  return this.ports.now() > state.expiresAt;
};
expire_fn = function(sessionId, state) {
  try {
    this.semantic.discardPreview(sessionId, state.preview.previewHandle);
  } catch {
  }
  if (__privateGet(this, _states).get(sessionId) === state) __privateGet(this, _states).delete(sessionId);
};
function ready(state) {
  return {
    status: "previewed",
    previewToken: state.previewToken,
    candidateDigest: state.preview.candidateDigest,
    ref: structuredClone(state.baseRef),
    expiresAt: state.expiresAt
  };
}
function rejected(code, message) {
  return { status: "rejected", code, message };
}
function sameRef(left, right) {
  return left.drawingId === right.drawingId && left.revision === right.revision;
}
class DrawingSpaceHostService extends (_a2 = TypertRemoteService, _getSnapshot_dec = [Remote], _query_dec = [Remote], _projectSelection_dec = [Remote], _getGroundingOverlay_dec = [Remote], _getMotionRig_dec = [Remote], _rebuildMotionRig_dec = [Remote], _discardMotionRig_dec = [Remote], _stageInteractiveEdit_dec = [Remote], _stageUndo_dec = [Remote], _stageRedo_dec = [Remote], _getOperation_dec = [Remote], _createExtensionPreview_dec = [Remote], _replaceExtensionPreview_dec = [Remote], _assessExtensionPreview_dec = [Remote], _finalizeExtensionPreview_dec = [Remote], _discardExtensionPreview_dec = [Remote], _getPreview_dec = [Remote], _a2) {
  constructor(ctx) {
    super(ctx, "drawingSpace");
    __runInitializers(_init, 5, this);
    __publicField(this, "drawings");
    __publicField(this, "semantic");
    __publicField(this, "interactive");
    __publicField(this, "motionRigs");
    __publicField(this, "extensionPreviews");
    this.drawings = new InMemoryDrawingRepository({
      vectorizer: new LocalCleanLineVectorizer(),
      storage: new FileDrawingRepositoryStorage(resolve(homedir(), ".dsh/vectorai/drawings"))
    });
    const editPorts = {
      id: (kind) => `${kind}_${randomUUID()}`,
      now: Date.now,
      digest: (value2) => `sha256:${createHash("sha256").update(value2).digest("hex")}`,
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
    this.extensionPreviews = new ExtensionPreviewService(this.drawings, this.semantic, editPorts);
    this.interactive = new InteractiveEditService(this.drawings, editPorts);
    this.motionRigs = new MotionRigService(this.drawings);
    ctx.effect(() => registerDrawingCommands(ctx.commands, this.interactive, this.semantic));
    for (const tool of createDrawingAgentToolCatalog(
      this.drawings,
      ctx.attachments,
      this.semantic,
      ctx.userQuestions,
      this.motionRigs
    )) {
      ctx.tools.register(tool);
    }
    ctx.on("agent/pre-step", createPreStepIntake(this.drawings, this.semantic, {
      isRuntimeRoot: (agent) => ctx.agents.roots().includes(agent)
    }));
    ctx.on("session/disposed", (session) => {
      this.semantic.disposeSession(String(session.id));
      this.motionRigs.disposeSession(String(session.id));
      this.extensionPreviews.disposeSession(String(session.id));
      this.drawings.disposeSession(String(session.id));
    });
  }
  getSnapshot(agent) {
    return this.drawings.getSnapshot(String(agent.id));
  }
  async importDxf(agent, request, signal) {
    return this.drawings.importDxf(String(agent.id), { ...request, signal });
  }
  async renderObservation(agent, request, signal) {
    signal == null ? void 0 : signal.throwIfAborted();
    const sessionId = String(agent.id);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (snapshot === null) {
      return { status: "rejected", code: "DRAWING_REQUIRED", message: "No drawing is loaded" };
    }
    if (snapshot.ref.drawingId !== request.ref.drawingId || snapshot.ref.revision !== request.ref.revision) {
      return { status: "stale", currentRef: snapshot.ref };
    }
    const viewport = this.drawings.getBounds(sessionId);
    if (viewport === null) {
      return { status: "rejected", code: "DRAWING_BOUNDS_REQUIRED", message: "Drawing bounds are unavailable" };
    }
    const rendered = await renderDrawingObservation({
      document: snapshot.document,
      viewport,
      ...request.overlays === void 0 ? {} : {
        worldOverlays: request.overlays.map((overlay) => ({
          ...overlay,
          polygon: overlay.polygon.map((point) => [point[0], point[1]])
        }))
      }
    });
    signal == null ? void 0 : signal.throwIfAborted();
    return {
      status: "rendered",
      png: rendered.png,
      contentDigest: rendered.contentDigest,
      width: rendered.manifest.width,
      height: rendered.manifest.height
    };
  }
  query(agent, request) {
    return this.drawings.query(String(agent.id), request);
  }
  projectSelection(agent, request) {
    return this.semantic.projectSelection(String(agent.id), request);
  }
  getGroundingOverlay(agent) {
    return this.semantic.currentGroundingOverlay(String(agent.id));
  }
  getMotionRig(agent) {
    return this.motionRigs.current(String(agent.id));
  }
  rebuildMotionRig(agent, request) {
    return this.motionRigs.rebuild(String(agent.id), request.ref, request.nodeIds);
  }
  discardMotionRig(agent, request) {
    return this.motionRigs.discard(String(agent.id), request.ref);
  }
  stageInteractiveEdit(agent, request) {
    return this.interactive.stage(String(agent.id), request);
  }
  stageUndo(agent, request) {
    return this.semantic.stageUndo(String(agent.id), request);
  }
  stageRedo(agent, request) {
    return this.semantic.stageRedo(String(agent.id), request);
  }
  getOperation(agent, operationId, operationBindingDigest) {
    return this.semantic.getOperation(String(agent.id), operationId, operationBindingDigest);
  }
  createExtensionPreview(agent, request) {
    return this.extensionPreviews.create(String(agent.id), request);
  }
  replaceExtensionPreview(agent, request) {
    return this.extensionPreviews.replace(String(agent.id), request);
  }
  assessExtensionPreview(agent, request) {
    return this.extensionPreviews.assess(String(agent.id), request);
  }
  finalizeExtensionPreview(agent, request) {
    return this.extensionPreviews.finalize(String(agent.id), request);
  }
  discardExtensionPreview(agent, request) {
    return this.extensionPreviews.discard(String(agent.id), request);
  }
  async runExtensionProgram(agent, request, signal) {
    const sessionId = String(agent.id);
    const snapshot = this.drawings.getSnapshot(sessionId);
    if (snapshot === null) throw new Error("DRAWING_REQUIRED");
    const extensionId = "vectorai.one-shot-extension";
    const workflowId = `workflow_${randomUUID()}`;
    const preview = await this.extensionPreviews.create(sessionId, {
      extensionId,
      workflowId,
      ref: snapshot.ref,
      targetNodeIds: request.targetNodeIds,
      ...request.interfaces === void 0 ? {} : { interfaces: request.interfaces.map((binding) => ({
        interfaceId: binding.interfaceId,
        nodeId: binding.nodeId,
        endpoint: binding.endpoint
      })) },
      program: request.program
    }, signal);
    if (preview.status !== "previewed") return { preview, result: preview };
    const control = {
      extensionId,
      workflowId,
      ref: preview.ref,
      previewToken: preview.previewToken,
      candidateDigest: preview.candidateDigest
    };
    const assessed = await this.extensionPreviews.assess(sessionId, control, signal);
    if (assessed.status !== "assessed") return { preview, assessed, result: assessed };
    const finalized = await this.extensionPreviews.finalize(sessionId, control);
    return {
      preview,
      assessment: assessed.assessment,
      result: finalized.status === "finalized" ? finalized.result : finalized
    };
  }
  getPreview(agent) {
    return this.drawings.getPreview(String(agent.id));
  }
}
_init = __decoratorStart(_a2);
__decorateElement(_init, 1, "getSnapshot", _getSnapshot_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "query", _query_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "projectSelection", _projectSelection_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "getGroundingOverlay", _getGroundingOverlay_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "getMotionRig", _getMotionRig_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "rebuildMotionRig", _rebuildMotionRig_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "discardMotionRig", _discardMotionRig_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "stageInteractiveEdit", _stageInteractiveEdit_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "stageUndo", _stageUndo_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "stageRedo", _stageRedo_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "getOperation", _getOperation_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "createExtensionPreview", _createExtensionPreview_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "replaceExtensionPreview", _replaceExtensionPreview_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "assessExtensionPreview", _assessExtensionPreview_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "finalizeExtensionPreview", _finalizeExtensionPreview_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "discardExtensionPreview", _discardExtensionPreview_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "getPreview", _getPreview_dec, DrawingSpaceHostService);
__decoratorMetadata(_init, DrawingSpaceHostService);
__publicField(DrawingSpaceHostService, "inject", ["tools", "attachments", "userQuestions", "commands", "agents", "subagents"]);
export {
  DrawingSpaceHostService,
  ExtensionPreviewService,
  FileDrawingRepositoryStorage,
  InMemoryDrawingRepository,
  InteractiveEditService,
  LocalCleanLineVectorizer,
  SemanticEditEpisodeStore,
  SemanticEditService,
  DrawingSpaceHostService as default,
  extractNumericConstraints
};
