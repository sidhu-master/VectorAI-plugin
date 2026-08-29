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
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
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
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
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
var _candidates, _evidence, _diagnostics, _stations, _CandidateAccumulator_instances, ordered_fn, _memory, _AnnotationSessionStateStore_instances, set_fn, _FileAnnotationSessionStorage_instances, path_fn, _states, _PartitionSessionStore_instances, push_fn, replace_fn, envelope_fn, _FilePartitionStorage_instances, path_fn2, _stagedDocuments, _PartitionWorkflowService_instances, analyze_fn, current_fn, _states2, _DimensionPlanStore_instances, push_fn2, replace_fn2, envelope_fn2, _FileDimensionPlanStorage_instances, path_fn3, _redoDimensionPlan_dec, _undoDimensionPlan_dec, _cancelDimensionPlan_dec, _confirmDimensionPlan_dec, _editDimensionScheme_dec, _getDimensionPlan_dec, _redoPartition_dec, _undoPartition_dec, _reopenPartition_dec, _cancelPartition_dec, _confirmPartition_dec, _editPartition_dec, _getPartitionState_dec, _supplementDocuments_dec, _importAndAnalyze_dec, _clearDocuments_dec, _stageDocuments_dec, _importDrawing_dec, _getSessionState_dec, _a2, _init;
import { defineTool } from "@deepseek-ai/dsh-tools";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync, mkdirSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { join, resolve } from "node:path";
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { homedir } from "node:os";
const ROLE_RANK = {
  datum: 0,
  overall: 1,
  functional: 2,
  assembly: 2,
  process: 3,
  inspection: 3,
  closure: 5,
  auxiliary: 6
};
function orderDimensionIntents(input) {
  const diagnostics = [];
  const intentsById = /* @__PURE__ */ new Map();
  const duplicateIds = /* @__PURE__ */ new Set();
  for (const intent of input.intents) {
    if (intentsById.has(intent.id)) duplicateIds.add(intent.id);
    else intentsById.set(intent.id, intent);
  }
  if (duplicateIds.size > 0) {
    diagnostics.push(issue$3(
      "DIMENSION_ID_DUPLICATE",
      "尺寸意图 ID 必须唯一，无法生成稳定顺序。",
      [...duplicateIds].sort()
    ));
  }
  const outgoing = /* @__PURE__ */ new Map();
  const indegree = /* @__PURE__ */ new Map();
  for (const id of intentsById.keys()) {
    outgoing.set(id, /* @__PURE__ */ new Set());
    indegree.set(id, 0);
  }
  const unknownIds = /* @__PURE__ */ new Set();
  for (const dependency of input.dependencies) {
    const beforeKnown = intentsById.has(dependency.beforeIntentId);
    const afterKnown = intentsById.has(dependency.afterIntentId);
    if (!beforeKnown) unknownIds.add(dependency.beforeIntentId);
    if (!afterKnown) unknownIds.add(dependency.afterIntentId);
    if (!beforeKnown || !afterKnown) continue;
    const targets = outgoing.get(dependency.beforeIntentId);
    if (targets.has(dependency.afterIntentId)) continue;
    targets.add(dependency.afterIntentId);
    indegree.set(dependency.afterIntentId, indegree.get(dependency.afterIntentId) + 1);
  }
  if (unknownIds.size > 0) {
    diagnostics.push(issue$3(
      "DIMENSION_DEPENDENCY_UNKNOWN",
      "尺寸依赖引用了不存在的尺寸意图。",
      [...unknownIds].sort()
    ));
  }
  const compare = (firstId, secondId) => {
    const first = intentsById.get(firstId);
    const second = intentsById.get(secondId);
    return ROLE_RANK[first.functionalRole] - ROLE_RANK[second.functionalRole] || compareText(targetKey(first), targetKey(second)) || compareText(first.id, second.id);
  };
  const ready = [...intentsById.keys()].filter((id) => indegree.get(id) === 0).sort(compare);
  const orderedIntentIds = [];
  while (ready.length > 0) {
    const current = ready.shift();
    orderedIntentIds.push(current);
    const nextIds = [...outgoing.get(current)].sort(compare);
    for (const nextId of nextIds) {
      const nextDegree = indegree.get(nextId) - 1;
      indegree.set(nextId, nextDegree);
      if (nextDegree === 0) {
        ready.push(nextId);
        ready.sort(compare);
      }
    }
  }
  if (orderedIntentIds.length !== intentsById.size) {
    const emitted = new Set(orderedIntentIds);
    const blockedIds = [...intentsById.keys()].filter((id) => !emitted.has(id)).sort();
    diagnostics.push(issue$3(
      "DIMENSION_DEPENDENCY_CYCLE",
      "尺寸依赖图存在环，不能静默打破依赖关系。",
      blockedIds
    ));
  }
  return { orderedIntentIds, diagnostics };
}
function targetKey(intent) {
  return intent.targets.map((target) => `${target.geometryId}:${anchorKey(target.anchor)}`).sort().join("|");
}
function anchorKey(anchor) {
  switch (anchor.kind) {
    case "start":
    case "end":
    case "center":
      return anchor.kind;
    case "vertex":
      return `vertex:${anchor.index}`;
    case "curve-parameter":
      return `curve-parameter:${anchor.parameter}`;
    case "nearest":
      return `nearest:${anchor.point[0]}:${anchor.point[1]}`;
  }
}
function issue$3(code, message, entityIds) {
  return {
    id: `dimension-order:${code}:${entityIds.join(",")}`,
    severity: "error",
    code,
    message,
    entityIds
  };
}
function compareText(first, second) {
  return first < second ? -1 : first > second ? 1 : 0;
}
function validateEngineeringDraft(draft) {
  const diagnostics = [];
  const intentIds = /* @__PURE__ */ new Set();
  for (const intent of draft.intents) {
    if (intentIds.has(intent.id)) diagnostics.push(problem$3("DIMENSION_ID_DUPLICATE", intent.id, "Duplicate dimension intent ID"));
    intentIds.add(intent.id);
  }
  const datumIds = new Set(draft.datums.map(({ id }) => id));
  for (const datum of draft.datums) {
    if (datum.status === "stale") diagnostics.push(problem$3("DIMENSION_DATUM_STALE", datum.id, "Datum references stale geometry"));
  }
  for (const intent of draft.intents) {
    if (intent.targets.length === 0) diagnostics.push(problem$3("DIMENSION_TARGET_REQUIRED", intent.id, "Dimension intent has no target"));
    if (!Number.isFinite(intent.nominalValue)) diagnostics.push(problem$3("DIMENSION_NOMINAL_INVALID", intent.id, "Nominal value must be finite"));
    for (const datumId of intent.datumIds) {
      if (!datumIds.has(datumId)) diagnostics.push(problem$3("DIMENSION_DATUM_UNKNOWN", intent.id, `Unknown datum ${datumId}`));
    }
  }
  for (const tolerance of draft.tolerances) {
    if (!intentIds.has(tolerance.dimensionIntentId)) diagnostics.push(problem$3("TOLERANCE_INTENT_UNKNOWN", tolerance.id, "Tolerance references an unknown intent"));
    if ((tolerance.status === "resolved" || tolerance.status === "confirmed") && tolerance.resolved === void 0) {
      diagnostics.push(problem$3("TOLERANCE_RESULT_REQUIRED", tolerance.id, "Confirmed tolerance requires a resolved result"));
    } else if (tolerance.resolved !== void 0 && !isResolvedToleranceValid(tolerance)) {
      diagnostics.push(problem$3("TOLERANCE_RESULT_INVALID", tolerance.id, "Resolved tolerance does not match its declared mode"));
    }
  }
  for (const chain of draft.chains) {
    for (const member of chain.members) {
      if (member.coefficient !== 1 && member.coefficient !== -1) {
        diagnostics.push(problem$3("DIMENSION_CHAIN_COEFFICIENT_INVALID", chain.id, "Chain coefficient must be 1 or -1"));
      }
      if (!intentIds.has(member.dimensionIntentId)) diagnostics.push(problem$3("DIMENSION_CHAIN_MEMBER_UNKNOWN", chain.id, `Unknown chain member ${member.dimensionIntentId}`));
    }
    if (!intentIds.has(chain.equation.closureIntentId) || !chain.members.some(({ dimensionIntentId }) => dimensionIntentId === chain.equation.closureIntentId)) {
      diagnostics.push(problem$3("DIMENSION_CHAIN_CLOSURE_UNKNOWN", chain.id, "Closure intent must be a known chain member"));
    }
  }
  for (const dependency of draft.dependencies) {
    if (!intentIds.has(dependency.beforeIntentId) || !intentIds.has(dependency.afterIntentId)) {
      diagnostics.push(problem$3("DIMENSION_DEPENDENCY_UNKNOWN", `${dependency.beforeIntentId}->${dependency.afterIntentId}`, "Dependency references an unknown intent"));
    }
  }
  return diagnostics;
}
function isResolvedToleranceValid(tolerance) {
  const resolved = tolerance.resolved;
  if (!resolved || !resolved.inputDigest || !Number.isFinite(resolved.evaluatedAt) || [resolved.upperDeviation, resolved.lowerDeviation, resolved.upperLimit, resolved.lowerLimit].some((value) => value !== void 0 && !Number.isFinite(value))) return false;
  switch (tolerance.mode) {
    case "bilateral":
      return finite(resolved.upperDeviation) && finite(resolved.lowerDeviation) && resolved.lowerDeviation <= resolved.upperDeviation;
    case "unilateral": {
      if (!finite(resolved.upperDeviation) && !finite(resolved.lowerDeviation)) return false;
      const upper = resolved.upperDeviation ?? 0;
      const lower = resolved.lowerDeviation ?? 0;
      return lower <= upper;
    }
    case "limits":
      return finite(resolved.upperLimit) && finite(resolved.lowerLimit) && resolved.lowerLimit <= resolved.upperLimit;
    case "fit":
      return typeof resolved.fitDesignation === "string" && resolved.fitDesignation.trim().length > 0 && resolved.fitDesignation.length <= 32;
    case "formula":
      return false;
  }
}
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function problem$3(code, id, message) {
  return { id: `diagnostic:${code}:${id}`, severity: "error", code, message, entityIds: [id] };
}
function projectEngineeringAnnotations(input) {
  const diagnostics = [];
  const annotations = [];
  const intentsById = new Map(input.draft.intents.map((intent) => [intent.id, intent]));
  const toleranceByIntentId = new Map(input.draft.tolerances.map((spec) => [spec.dimensionIntentId, spec]));
  const datumsById = new Map(input.draft.datums.map((datum) => [datum.id, datum]));
  const existingByIntentId = new Map(
    input.existingAnnotations.filter((node) => node.type === "dimension" && node.engineeringIntentId !== void 0).map((node) => [node.engineeringIntentId, node])
  );
  for (const [generationOrder, intentId2] of input.orderedIntentIds.entries()) {
    const intent = intentsById.get(intentId2);
    if (!intent) {
      diagnostics.push(issue$2("ANNOTATION_INTENT_UNKNOWN", "标注顺序引用了不存在的尺寸意图。", [intentId2]));
      continue;
    }
    const intentDiagnostics = [];
    if (intent.status !== "confirmed") {
      intentDiagnostics.push(issue$2("ANNOTATION_INTENT_NOT_CONFIRMED", "只有已确认的尺寸意图可以投影到第一层。", [intent.id]));
    }
    const tolerance = toleranceByIntentId.get(intent.id);
    const toleranceProjection = tolerance === void 0 ? void 0 : projectTolerance(tolerance, intent, intentDiagnostics);
    const datumReferences = intent.datumIds.flatMap((datumId) => {
      const datum = datumsById.get(datumId);
      if (!datum || datum.status !== "confirmed") {
        intentDiagnostics.push(issue$2("ANNOTATION_DATUM_NOT_CONFIRMED", "尺寸意图引用的基准不存在或尚未确认。", [intent.id, datumId]));
        return [];
      }
      return [{
        datumId: datum.id,
        role: datum.role,
        geometryId: datum.geometryId,
        anchor: structuredClone(datum.anchor)
      }];
    });
    diagnostics.push(...intentDiagnostics);
    if (intentDiagnostics.some(({ severity }) => severity === "error")) continue;
    const chainIds = input.draft.chains.filter((chain) => chain.members.some((member) => member.dimensionIntentId === intent.id)).map(({ id }) => id).sort();
    const evidenceRefs = unique$6([
      ...intent.evidenceIds,
      ...intent.datumIds.flatMap((datumId) => {
        var _a3;
        return ((_a3 = datumsById.get(datumId)) == null ? void 0 : _a3.evidenceIds) ?? [];
      }),
      ...(tolerance == null ? void 0 : tolerance.evidenceIds) ?? []
    ]);
    const existing = existingByIntentId.get(intent.id);
    const base = defaultAnnotation(intent);
    if (existing) {
      base.id = existing.id;
      base.visible = existing.visible;
      base.textPosition = structuredClone(existing.textPosition);
      base.definitionPoints = structuredClone(existing.definitionPoints);
      if (existing.sourceRef) base.sourceRef = structuredClone(existing.sourceRef);
    }
    annotations.push({
      ...base,
      dimensionKind: intent.kind,
      targets: structuredClone(intent.targets),
      associationStatus: "resolved",
      computedValue: intent.nominalValue,
      unit: intent.unit,
      quality: { status: "confirmed", confidence: 1, evidenceRefs },
      datumReferences,
      engineeringIntentId: intent.id,
      engineeringChainIds: chainIds,
      generationOrder,
      ...toleranceProjection === void 0 ? {} : { toleranceProjection }
    });
  }
  return { annotations, diagnostics };
}
function projectTolerance(spec, intent, diagnostics) {
  if (spec.source === "ai-candidate") {
    diagnostics.push(issue$2("TOLERANCE_AI_AUTHORITY_FORBIDDEN", "AI 候选公差不能投影为确认数据。", [spec.id, intent.id]));
    return void 0;
  }
  if (!["resolved", "confirmed"].includes(spec.status) || !spec.resolved) {
    diagnostics.push(issue$2("TOLERANCE_RESULT_REQUIRED", "公差投影需要已解析的确定性结果。", [spec.id, intent.id]));
    return void 0;
  }
  if (!isResolvedToleranceValid(spec)) {
    diagnostics.push(issue$2("TOLERANCE_RESULT_INVALID", "公差结果与声明模式不匹配。", [spec.id, intent.id]));
    return void 0;
  }
  if (spec.mode === "formula") {
    diagnostics.push(issue$2("TOLERANCE_RESULT_INVALID", "公式模式必须先解析为可移植公差模式。", [spec.id, intent.id]));
    return void 0;
  }
  const resolved = spec.resolved;
  return {
    mode: spec.mode,
    ...resolved.upperDeviation === void 0 ? {} : { upperDeviation: resolved.upperDeviation },
    ...resolved.lowerDeviation === void 0 ? {} : { lowerDeviation: resolved.lowerDeviation },
    ...resolved.upperLimit === void 0 ? {} : { upperLimit: resolved.upperLimit },
    ...resolved.lowerLimit === void 0 ? {} : { lowerLimit: resolved.lowerLimit },
    ...resolved.fitDesignation === void 0 ? {} : { fitDesignation: resolved.fitDesignation },
    unit: intent.unit,
    status: spec.status === "confirmed" ? "confirmed" : "resolved",
    source: spec.source,
    ...spec.ruleRef === void 0 ? {} : {
      ruleRef: { ...spec.ruleRef, inputDigest: resolved.inputDigest }
    },
    evidenceRefs: [...spec.evidenceIds]
  };
}
function defaultAnnotation(intent) {
  const prefix = intent.kind === "diameter" ? "Ø" : intent.kind === "radius" ? "R" : "";
  const suffix = intent.kind === "angular" ? "°" : "";
  return {
    id: `annotation_engineering_${stableKey$1(intent.id)}`,
    type: "dimension",
    visible: true,
    quality: { status: "confirmed", confidence: 1, evidenceRefs: [] },
    dimensionKind: intent.kind,
    associationStatus: "resolved",
    targets: structuredClone(intent.targets),
    computedValue: intent.nominalValue,
    displayText: `${prefix}${format$2(intent.nominalValue)}${suffix}`,
    unit: intent.unit,
    textPosition: [0, 0],
    definitionPoints: []
  };
}
function unique$6(values) {
  return [...new Set(values)].sort();
}
function issue$2(code, message, entityIds) {
  return {
    id: `annotation-projection:${code}:${entityIds.join(",")}`,
    severity: "error",
    code,
    message,
    entityIds
  };
}
function stableKey$1(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function format$2(value) {
  return Number(value.toFixed(6)).toString();
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
  const start2 = node.knots[node.degree];
  const end2 = node.knots[node.controlPoints.length];
  return node.knots.slice(node.degree, node.controlPoints.length + 1).map((value) => (value - start2) / (end2 - start2)).filter((value, index, values) => index === 0 || value > values[index - 1]);
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
  if (node.knots.some((value, index) => !Number.isFinite(value) || index > 0 && value < node.knots[index - 1])) {
    throw new TypeError("SPLINE_KNOT_SEQUENCE_INVALID");
  }
  const domainStart = node.knots[node.degree];
  const domainEnd = node.knots[node.controlPoints.length];
  if (!(domainEnd > domainStart)) throw new TypeError("SPLINE_KNOT_DOMAIN_INVALID");
  if (node.weights !== void 0 && (node.weights.length !== node.controlPoints.length || node.weights.some((weight) => !Number.isFinite(weight) || weight <= 0))) {
    throw new TypeError("SPLINE_WEIGHTS_INVALID");
  }
}
function findSpan(knots, degree, lastControlIndex, value) {
  let low = degree;
  let high = lastControlIndex + 1;
  let middle = Math.floor((low + high) / 2);
  while (value < knots[middle] || value >= knots[middle + 1]) {
    if (value < knots[middle]) high = middle;
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
  const start2 = points[0];
  const end2 = points.at(-1);
  const flatness = Math.max(0, ...points.slice(1, -1).map((point) => pointSegmentDistance(point, start2, end2)));
  if (depth >= maxDepth || flatness <= maxError) {
    output.push(end2);
    return;
  }
  const [left, right] = splitBezier(controls);
  subdivideBezier(left, depth + 1, maxDepth, maxError, output);
  subdivideBezier(right, depth + 1, maxDepth, maxError, output);
}
function extractBezierControls(node, start2, end2) {
  const degree = node.degree;
  if (degree === 1) return [evaluateHomogeneous(node, start2), evaluateHomogeneous(node, end2)];
  const samples = Array.from({ length: degree + 1 }, (_, row) => {
    const local2 = row / degree;
    return evaluateHomogeneous(node, start2 + (end2 - start2) * local2);
  });
  const matrix = Array.from({ length: degree + 1 }, (_, row) => {
    const parameter = row / degree;
    return Array.from({ length: degree + 1 }, (_2, column) => bernstein(degree, column, parameter));
  });
  return solve(matrix, samples);
}
function solve(matrix, values) {
  const size = matrix.length;
  const augmented = matrix.map((row, index) => [...row, ...values[index]]);
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
function pointSegmentDistance(point, start2, end2) {
  const dx = end2[0] - start2[0];
  const dy = end2[1] - start2[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(point[0] - start2[0], point[1] - start2[1]);
  const projection = Math.min(1, Math.max(0, ((point[0] - start2[0]) * dx + (point[1] - start2[1]) * dy) / lengthSquared));
  return Math.hypot(
    point[0] - (start2[0] + projection * dx),
    point[1] - (start2[1] + projection * dy)
  );
}
function samePoint(first, second) {
  return Math.abs(first[0] - second[0]) <= 1e-12 && Math.abs(first[1] - second[1]) <= 1e-12;
}
const MINIMUM_TOLERANCE = 1e-5;
function measureOpeningAngles(geometryInput) {
  const geometry = geometryInput.filter(({ visible, quality }) => visible && quality.status === "confirmed");
  const bounds2 = geometryBounds(geometry);
  if (!bounds2) return { axis: { start: [0, 0], end: [0, 0], status: "conflict" }, facts: [] };
  const diagonal = Math.hypot(bounds2.maxX - bounds2.minX, bounds2.maxY - bounds2.minY);
  const tolerance = Math.max(diagonal * 1e-6, MINIMUM_TOLERANCE);
  const segments = collectSegments(geometry);
  const axisY = explicitAxisY(geometry, tolerance) ?? reflectedAxisY(segments, bounds2, tolerance);
  const axis = axisY === null ? { start: [bounds2.minX, (bounds2.minY + bounds2.maxY) / 2], end: [bounds2.maxX, (bounds2.minY + bounds2.maxY) / 2], status: "conflict" } : { start: [clean$2(bounds2.minX), clean$2(axisY)], end: [clean$2(bounds2.maxX), clean$2(axisY)], status: "confirmed" };
  if (axis.status === "conflict") return { axis, facts: [] };
  return { axis, facts: openingAngleFacts(segments, axis.start[1], diagonal, tolerance) };
}
function collectSegments(geometry) {
  const segments = [];
  for (const node of geometry) {
    if (node.type === "line") {
      segments.push({ source: node, start: node.start, end: node.end });
      continue;
    }
    if (node.type !== "polyline" || node.vertices.length < 2) continue;
    const count = node.closed ? node.vertices.length : node.vertices.length - 1;
    for (let index = 0; index < count; index += 1) {
      const first = node.vertices[index];
      const second = node.vertices[(index + 1) % node.vertices.length];
      if (!first || !second || Math.abs(first.bulge ?? 0) > MINIMUM_TOLERANCE) continue;
      segments.push({ source: node, start: first.point, end: second.point });
    }
  }
  return segments;
}
function explicitAxisY(geometry, tolerance) {
  var _a3;
  const explicit = geometry.filter((node) => node.type === "xline" && Math.abs(node.direction[1]) <= tolerance && Math.abs(node.direction[0]) > tolerance);
  return explicit.length === 1 && ((_a3 = explicit[0]) == null ? void 0 : _a3.type) === "xline" ? explicit[0].origin[1] : null;
}
function reflectedAxisY(segments, bounds2, tolerance) {
  const axisY = (bounds2.minY + bounds2.maxY) / 2;
  const horizontal = segments.filter(({ start: start2, end: end2 }) => Math.abs(end2[1] - start2[1]) <= tolerance && Math.abs(end2[0] - start2[0]) > tolerance);
  for (let firstIndex = 0; firstIndex < horizontal.length; firstIndex += 1) {
    const first = horizontal[firstIndex];
    const firstRadius = first.start[1] - axisY;
    if (Math.abs(firstRadius) <= tolerance) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < horizontal.length; secondIndex += 1) {
      const second = horizontal[secondIndex];
      const secondRadius = second.start[1] - axisY;
      if (firstRadius * secondRadius >= 0) continue;
      if (Math.abs(firstRadius + secondRadius) > tolerance * 10) continue;
      if (Math.min(Math.max(first.start[0], first.end[0]), Math.max(second.start[0], second.end[0])) < Math.max(Math.min(first.start[0], first.end[0]), Math.min(second.start[0], second.end[0])) - tolerance) continue;
      return clean$2(axisY);
    }
  }
  return null;
}
function openingAngleFacts(segments, axisY, diagonal, tolerance) {
  const maximumLength = Math.max(diagonal * 0.12, tolerance * 100);
  const mirrorTolerance = Math.max(diagonal * 2e-3, tolerance * 10);
  const intersectionLimit = Math.max(diagonal * 0.15, tolerance * 100);
  const candidates = segments.map(normalizedSlopedSegment).filter((segment) => segment !== null && segment.length <= maximumLength && Math.abs(segment.midpoint[1] - axisY) > mirrorTolerance);
  const upper = candidates.filter(({ midpoint }) => midpoint[1] > axisY);
  const lower = candidates.filter(({ midpoint }) => midpoint[1] < axisY);
  const facts = [];
  for (const first of upper) {
    for (const second of lower) {
      const endpointError = Math.max(
        Math.abs(first.left[0] - second.left[0]),
        Math.abs(first.right[0] - second.right[0]),
        Math.abs(first.left[1] + second.left[1] - axisY * 2),
        Math.abs(first.right[1] + second.right[1] - axisY * 2)
      );
      if (endpointError > mirrorTolerance) continue;
      const vertex = lineIntersection(first.left, first.right, second.left, second.right, tolerance);
      if (!vertex || Math.abs(vertex[1] - axisY) > mirrorTolerance) continue;
      if (Math.max(
        distanceToSegmentRange(vertex[0], first.left[0], first.right[0]),
        distanceToSegmentRange(vertex[0], second.left[0], second.right[0])
      ) > intersectionLimit) continue;
      const paired = [
        { source: first.segment.source, ray: cleanPoint(first.midpoint) },
        { source: second.segment.source, ray: cleanPoint(second.midpoint) }
      ].sort((left, right) => String(left.source.id).localeCompare(String(right.source.id)));
      const value = normalizedAngleValue(includedAngle(vertex, paired[0].ray, paired[1].ray));
      if (value <= 0.5 || value >= 179.5) continue;
      const sourceIds = [paired[0].source.id, paired[1].source.id];
      facts.push({
        key: `opening-angle:${sourceIds.join(":")}:${numberKey(vertex[0])}:${numberKey(value)}`,
        value,
        vertex: [clean$2(vertex[0]), clean$2(axisY)],
        rays: [paired[0].ray, paired[1].ray],
        sourceIds,
        evidenceRefs: uniqueEvidence([paired[0].source, paired[1].source]),
        method: "mirrored-line-pair-opening",
        error: clean$2(Math.max(endpointError, Math.abs(vertex[1] - axisY)))
      });
    }
  }
  return [...new Map(facts.map((fact) => [fact.key, fact])).values()].sort((a, b) => a.key.localeCompare(b.key));
}
function normalizedSlopedSegment(segment) {
  const dx = segment.end[0] - segment.start[0];
  const dy = segment.end[1] - segment.start[1];
  const length = Math.hypot(dx, dy);
  if (length <= MINIMUM_TOLERANCE || Math.abs(dx) <= MINIMUM_TOLERANCE || Math.abs(dy) <= MINIMUM_TOLERANCE) return null;
  const [left, right] = segment.start[0] <= segment.end[0] ? [segment.start, segment.end] : [segment.end, segment.start];
  return { segment, left, right, midpoint: [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2], length };
}
function geometryBounds(geometry) {
  const points = geometry.flatMap(pointsOf);
  if (points.length === 0) return null;
  return {
    minX: Math.min(...points.map(([x]) => x)),
    minY: Math.min(...points.map(([, y]) => y)),
    maxX: Math.max(...points.map(([x]) => x)),
    maxY: Math.max(...points.map(([, y]) => y))
  };
}
function pointsOf(node) {
  if (node.type === "point") return [[node.x, node.y]];
  if (node.type === "line") return [node.start, node.end];
  if (node.type === "polyline") return node.vertices.map(({ point }) => point);
  if (node.type === "circle" || node.type === "arc") return [[node.center[0] - node.radius, node.center[1] - node.radius], [node.center[0] + node.radius, node.center[1] + node.radius]];
  if (node.type === "ellipse") {
    const radius = Math.hypot(...node.majorAxis);
    return [[node.center[0] - radius, node.center[1] - radius], [node.center[0] + radius, node.center[1] + radius]];
  }
  if (node.type === "spline") return sampleSpline(node, { maxError: 0.02, maxDepth: 14 });
  return [];
}
function lineIntersection(a, b, c, d, tolerance) {
  const first = [b[0] - a[0], b[1] - a[1]];
  const second = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross(first, second);
  if (Math.abs(denominator) <= tolerance) return null;
  const between = [c[0] - a[0], c[1] - a[1]];
  const scale = cross(between, second) / denominator;
  return [a[0] + first[0] * scale, a[1] + first[1] * scale];
}
function includedAngle(vertex, first, second) {
  const a = [first[0] - vertex[0], first[1] - vertex[1]];
  const b = [second[0] - vertex[0], second[1] - vertex[1]];
  const denominator = Math.hypot(...a) * Math.hypot(...b);
  if (denominator <= MINIMUM_TOLERANCE) return 0;
  return Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / denominator))) * 180 / Math.PI;
}
function uniqueEvidence(nodes) {
  return [...new Set(nodes.flatMap(({ quality }) => quality.evidenceRefs))].sort();
}
function distanceToSegmentRange(x, first, second) {
  const min = Math.min(first, second);
  const max = Math.max(first, second);
  return x < min ? min - x : x > max ? x - max : 0;
}
function normalizedAngleValue(value) {
  const integer2 = Math.round(value);
  return Math.abs(value - integer2) <= 0.01 ? integer2 : clean$2(value);
}
function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}
function cleanPoint(point) {
  return [clean$2(point[0]), clean$2(point[1])];
}
function numberKey(value) {
  return clean$2(value).toFixed(6);
}
function clean$2(value) {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
function selectAxialEndOpeningAngles(input) {
  const points = input.geometry.flatMap((node) => node.type === "line" ? [node.start, node.end] : node.type === "polyline" ? node.vertices.map(({ point }) => point) : []);
  const diagonal = points.length === 0 ? 1 : Math.hypot(
    Math.max(...points.map(([x]) => x)) - Math.min(...points.map(([x]) => x)),
    Math.max(...points.map(([, y]) => y)) - Math.min(...points.map(([, y]) => y))
  );
  const boundaryTolerance = Math.max(diagonal * 0.01, 0.05);
  const geometryById = new Map(input.geometry.map((node) => [node.id, node]));
  const selected = [];
  const suppressionReasons = {};
  for (const fact of input.facts) {
    const atAxialEnd = input.axis.status === "confirmed" && fact.sourceIds.some((id) => {
      const node = geometryById.get(id);
      if (!node) return false;
      const sourcePoints = node.type === "line" ? [node.start, node.end] : node.type === "polyline" ? node.vertices.map(({ point }) => point) : [];
      return sourcePoints.some(([x]) => Math.abs(x - input.axis.start[0]) <= boundaryTolerance || Math.abs(x - input.axis.end[0]) <= boundaryTolerance);
    });
    const orthogonal = Math.abs(fact.value - 90) <= 0.5;
    if (orthogonal || !atAxialEnd) {
      suppressionReasons[fact.key] = orthogonal ? "正交开角由轮廓关系直接表达，不重复生成 90° 角度标注" : "该局部线段方向不是已确认的轴端角度，不升级为正式角度标注";
    } else selected.push(fact);
  }
  return { selected, suppressionReasons };
}
function layoutOpeningAngles(input) {
  const points = input.geometry.flatMap((node) => node.type === "line" ? [node.start, node.end] : node.type === "polyline" ? node.vertices.map(({ point }) => point) : []);
  if (points.length === 0) return {};
  const bounds2 = { minX: Math.min(...points.map(([x]) => x)), maxX: Math.max(...points.map(([x]) => x)), minY: Math.min(...points.map(([, y]) => y)), maxY: Math.max(...points.map(([, y]) => y)) };
  const diagonal = Math.hypot(bounds2.maxX - bounds2.minX, bounds2.maxY - bounds2.minY);
  const gap = Math.max(diagonal * 0.035, 1);
  const result = {};
  const laneBySide = /* @__PURE__ */ new Map();
  const previousBySide = /* @__PURE__ */ new Map();
  const facts = [...input.facts].sort((left, right) => {
    const side = openingSide(left.vertex[0], bounds2) - openingSide(right.vertex[0], bounds2);
    if (side !== 0) return side;
    return (left.vertex[0] - right.vertex[0]) * openingSide(left.vertex[0], bounds2) || left.value - right.value || left.key.localeCompare(right.key);
  });
  for (const fact of facts) {
    const side = openingSide(fact.vertex[0], bounds2);
    const lane = laneBySide.get(side) ?? 0;
    laneBySide.set(side, lane + 1);
    const distToEdge = side === -1 ? fact.vertex[0] - bounds2.minX : bounds2.maxX - fact.vertex[0];
    const firstAngle = Math.atan2(fact.rays[0][1] - fact.vertex[1], fact.rays[0][0] - fact.vertex[0]);
    const secondAngle = Math.atan2(fact.rays[1][1] - fact.vertex[1], fact.rays[1][0] - fact.vertex[0]);
    const sweep = angularSweep(firstAngle, secondAngle, fact.value);
    const middleAngle = firstAngle + sweep / 2;
    const halfSweep = Math.abs(sweep) / 2;
    const clearance = halfSweep >= Math.PI / 2 - 1e-6 ? distToEdge + gap : distToEdge / Math.cos(halfSweep) + gap * 0.3;
    const halfTextWidth = (String(Math.round(Math.abs(fact.value))).length + 1) * 11 * 0.55 / 2;
    let radius = Math.max(gap * (2.3 + lane * 2.3), clearance, distToEdge + halfTextWidth);
    const bisector = [Math.cos(middleAngle), Math.sin(middleAngle)];
    const axisCoordinate = fact.vertex[0] * bisector[0] + fact.vertex[1] * bisector[1];
    const previous = previousBySide.get(side);
    if (previous) {
      const separation = previous.halfTextWidth + halfTextWidth + gap * 0.3 - (axisCoordinate - previous.axisCoordinate);
      if (separation > 0) radius = Math.max(radius, previous.textRadius + separation - gap * 0.5);
    }
    const firstExtensionRadius = Math.max(radius + gap * 0.15, distance(fact.vertex, fact.rays[0]) + gap * 0.08);
    const secondExtensionRadius = Math.max(radius + gap * 0.15, distance(fact.vertex, fact.rays[1]) + gap * 0.08);
    const textRadius = Math.max(radius, firstExtensionRadius, secondExtensionRadius) + gap * 0.35;
    previousBySide.set(side, { textRadius, halfTextWidth, axisCoordinate });
    result[fact.key] = {
      textPosition: polar$1(fact.vertex, textRadius, middleAngle),
      lane,
      definitionPoints: [fact.vertex, polar$1(fact.vertex, firstExtensionRadius, firstAngle), polar$1(fact.vertex, secondExtensionRadius, secondAngle), polar$1(fact.vertex, radius, firstAngle), polar$1(fact.vertex, radius, secondAngle)]
    };
  }
  return result;
}
function openingSide(x, bounds2) {
  return x <= (bounds2.minX + bounds2.maxX) / 2 ? -1 : 1;
}
function angularSweep(start2, end2, degrees) {
  const ccw = modulo(end2 - start2, Math.PI * 2);
  const cw = ccw - Math.PI * 2;
  const target = Math.abs(degrees) * Math.PI / 180;
  return Math.abs(Math.abs(ccw) - target) <= Math.abs(Math.abs(cw) - target) ? ccw : cw;
}
function polar$1(center, radius, angle) {
  return [clean$1(center[0] + Math.cos(angle) * radius), clean$1(center[1] + Math.sin(angle) * radius)];
}
function distance(first, second) {
  return Math.hypot(second[0] - first[0], second[1] - first[1]);
}
function modulo(value, divisor) {
  return (value % divisor + divisor) % divisor;
}
function clean$1(value) {
  const rounded = Math.round(value * 1e6) / 1e6;
  return Math.abs(rounded) <= 1e-12 ? 0 : rounded;
}
function planEngineeringAnnotations(input) {
  var _a3, _b, _c;
  const annotationTemplates = [];
  const associations = [];
  const pending = [];
  const suppressed = [];
  const geometry = input.document.geometry.filter(({ visible }) => visible);
  for (const node of geometry) {
    if (node.quality.status !== "confirmed") {
      pending.push({ nodeId: node.id, reason: "SOURCE_NOT_CONFIRMED" });
    }
  }
  const measuredOpenings = measureOpeningAngles(geometry);
  const openingSelection = selectAxialEndOpeningAngles({
    facts: measuredOpenings.facts,
    geometry,
    axis: measuredOpenings.axis
  });
  const openingLayouts = layoutOpeningAngles({ geometry, facts: openingSelection.selected });
  for (const fact of openingSelection.selected) {
    const layout = openingLayouts[fact.key];
    if (!layout) continue;
    const annotationId = `annotation_auto_${stableKey(fact.key)}`;
    const annotation = {
      id: annotationId,
      type: "dimension",
      visible: true,
      quality: {
        status: "confirmed",
        confidence: 1,
        evidenceRefs: fact.evidenceRefs.length > 0 ? [...fact.evidenceRefs] : [`evidence:engineering:${stableKey(fact.sourceIds.join(":"))}`]
      },
      dimensionKind: "angular",
      associationStatus: "resolved",
      targets: fact.sourceIds.map((geometryId, index) => ({
        geometryId,
        anchor: { kind: "nearest", point: fact.rays[index] ?? fact.vertex }
      })),
      computedValue: fact.value,
      displayText: `${format$1(fact.value)}°`,
      unit: "deg",
      textPosition: layout.textPosition,
      definitionPoints: [...layout.definitionPoints],
      engineeringIntentId: `intent_opening_${stableKey(fact.key)}`
    };
    annotationTemplates.push(annotation);
    associations.push({
      id: `relation_${stableKey(`${input.document.id}:${annotationId}`)}`,
      type: "association",
      plane: "association",
      kind: "annotation-target",
      annotationId,
      geometryIds: [...fact.sourceIds],
      visible: true,
      quality: { status: "confirmed", confidence: 1, evidenceRefs: [...annotation.quality.evidenceRefs] }
    });
  }
  for (const [key, reason] of Object.entries(openingSelection.suppressionReasons)) {
    suppressed.push({ nodeId: key, reason });
  }
  const dimensionTemplates = annotationTemplates.filter(
    (annotation) => annotation.type === "dimension"
  );
  const draft = {
    version: 1,
    drawingRef: structuredClone(input.ref),
    datums: [],
    intents: dimensionTemplates.map((annotation) => ({
      id: annotation.engineeringIntentId,
      drawingRef: structuredClone(input.ref),
      kind: annotation.dimensionKind,
      targets: structuredClone(annotation.targets),
      datumIds: [],
      nominalValue: annotation.computedValue ?? annotation.observedValue ?? 0,
      unit: annotation.unit ?? input.document.unitSystem.length,
      functionalRole: "inspection",
      source: "geometry",
      status: "confirmed",
      evidenceIds: annotation.quality.evidenceRefs.map(String)
    })),
    tolerances: [],
    chains: [],
    dependencies: [],
    diagnostics: []
  };
  const order = orderDimensionIntents({ intents: draft.intents, dependencies: draft.dependencies });
  const projection = projectEngineeringAnnotations({
    draft,
    orderedIntentIds: order.orderedIntentIds,
    existingAnnotations: annotationTemplates
  });
  const annotations = projection.annotations;
  const existingAnnotations = new Map(input.document.annotations.map((node) => [node.id, node]));
  const existingAssociations = new Map(input.document.relations.filter((relation) => relation.type === "association").map((relation) => [relation.id, relation]));
  const plannedOpeningIds = new Set(annotations.filter((node) => {
    var _a4;
    return node.type === "dimension" && ((_a4 = node.engineeringIntentId) == null ? void 0 : _a4.startsWith("intent_opening_"));
  }).map(({ id }) => id));
  const createAnnotations = [];
  const createAssociations = [];
  const deleteNodeIds = /* @__PURE__ */ new Set();
  const staleTargetNodeIds = /* @__PURE__ */ new Set();
  for (const annotation of annotations) {
    const existing = existingAnnotations.get(annotation.id);
    const opening = annotation.type === "dimension" && ((_a3 = annotation.engineeringIntentId) == null ? void 0 : _a3.startsWith("intent_opening_"));
    if (!existing) createAnnotations.push(annotation);
    else if (opening && !sameOpeningAnnotation(existing, annotation)) {
      deleteNodeIds.add(existing.id);
      if (existing.type === "dimension") existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
      createAnnotations.push(annotation);
      for (const relation of existingAssociations.values()) {
        if (relation.annotationId === existing.id) deleteNodeIds.add(relation.id);
      }
    }
  }
  for (const existing of input.document.annotations) {
    if (existing.type !== "dimension") continue;
    const legacyPrimitiveDimension = ((_b = existing.engineeringIntentId) == null ? void 0 : _b.startsWith("intent_auto_")) === true;
    const staleOpeningDimension = ((_c = existing.engineeringIntentId) == null ? void 0 : _c.startsWith("intent_opening_")) === true && !plannedOpeningIds.has(existing.id);
    if (!legacyPrimitiveDimension && !staleOpeningDimension) continue;
    deleteNodeIds.add(existing.id);
    existing.targets.forEach(({ geometryId }) => staleTargetNodeIds.add(geometryId));
    for (const relation of existingAssociations.values()) {
      if (relation.annotationId === existing.id) deleteNodeIds.add(relation.id);
    }
  }
  const createAnnotationIds = new Set(createAnnotations.map(({ id }) => id));
  for (const association of associations) {
    const existing = existingAssociations.get(association.id);
    if (createAnnotationIds.has(association.annotationId) || !existing) createAssociations.push(association);
    else if (association.annotationId.startsWith("annotation_auto_") && JSON.stringify(existing) !== JSON.stringify(association)) {
      deleteNodeIds.add(existing.id);
      createAssociations.push(association);
    }
  }
  const targetNodeIds = [.../* @__PURE__ */ new Set([
    ...associations.flatMap(({ geometryIds }) => geometryIds),
    ...staleTargetNodeIds
  ])].sort();
  const evidenceRefs = [...new Set(targetNodeIds.flatMap((id) => {
    const node = geometry.find((candidate) => candidate.id === id);
    return (node == null ? void 0 : node.quality.evidenceRefs) ?? [];
  }))];
  if (targetNodeIds.length > 0 && evidenceRefs.length === 0) {
    evidenceRefs.push(`evidence:engineering:${stableKey(targetNodeIds.join(":"))}`);
  }
  const operations = [];
  if (deleteNodeIds.size > 0) operations.push({ kind: "delete_nodes", nodeIds: [...deleteNodeIds].sort() });
  if (createAnnotations.length > 0) operations.push({
    kind: "create_annotation_batch",
    annotations: structuredClone(createAnnotations),
    associations: structuredClone(createAssociations)
  });
  const program = operations.length === 0 ? null : {
    baseRef: structuredClone(input.ref),
    targetHandle: "__GROUNDING_TARGET__",
    summary: `Create or refresh ${createAnnotations.length} deterministic engineering annotations`,
    objective: input.objective,
    operations,
    preserveScopes: geometry.map(({ id }) => ({ kind: "node-field", nodeId: id, fields: ["id", "type"] })),
    postconditions: [],
    evidenceRefs
  };
  return { annotations, associations, targetNodeIds, pending, suppressed, program };
}
function sameOpeningAnnotation(left, right) {
  if (left.type !== "dimension" || right.type !== "dimension") return false;
  return left.dimensionKind === right.dimensionKind && left.computedValue === right.computedValue && left.displayText === right.displayText && left.unit === right.unit && JSON.stringify(left.targets) === JSON.stringify(right.targets) && JSON.stringify(left.textPosition) === JSON.stringify(right.textPosition) && JSON.stringify(left.definitionPoints) === JSON.stringify(right.definitionPoints);
}
function stableKey(value) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
function clean(value) {
  return Number(value.toFixed(6));
}
function format$1(value) {
  return clean(value).toString();
}
function validatePartition(draft) {
  const diagnostics = [];
  const tolerance = Math.max(1e-8, Math.abs(draft.axis.zMax - draft.axis.zMin) * 1e-8);
  const ids = /* @__PURE__ */ new Set();
  const evidence = new Set(draft.evidence.map(({ id }) => id));
  for (const [index, segment] of draft.segments.entries()) {
    if (ids.has(segment.id)) diagnostics.push(problem$2("PARTITION_ID_DUPLICATE", `Duplicate segment ${segment.id}`, segment.id));
    ids.add(segment.id);
    if (![segment.zStart, segment.zEnd].every(Number.isFinite) || segment.zEnd - segment.zStart <= tolerance) {
      diagnostics.push(problem$2("PARTITION_SEGMENT_INVALID", `Invalid segment ${segment.id}`, segment.id));
    }
    if (index > 0) {
      const previous = draft.segments[index - 1];
      const delta = segment.zStart - previous.zEnd;
      if (delta > tolerance) diagnostics.push(problem$2("PARTITION_GAP", `Gap before ${segment.id}`, segment.id));
      if (delta < -tolerance) diagnostics.push(problem$2("PARTITION_OVERLAP", `Overlap before ${segment.id}`, segment.id));
    }
    for (const id of [...segment.boundaryEvidenceIds, ...segment.semanticEvidenceIds]) {
      if (!evidence.has(id)) diagnostics.push(problem$2("PARTITION_EVIDENCE_MISSING", `Missing evidence ${id}`, segment.id));
    }
  }
  if (draft.segments.length === 0 || Math.abs(draft.segments[0].zStart - draft.axis.zMin) > tolerance || Math.abs(draft.segments.at(-1).zEnd - draft.axis.zMax) > tolerance) {
    diagnostics.push({ id: "diagnostic:coverage", severity: "error", code: "PARTITION_COVERAGE", message: "Segments must cover the shaft extent exactly once" });
  }
  for (const group of draft.semanticGroups) {
    if (group.segmentIds.some((id) => !ids.has(id)) || group.evidenceIds.some((id) => !evidence.has(id))) {
      diagnostics.push({ id: `diagnostic:group:${group.id}`, severity: "error", code: "PARTITION_GROUP_REFERENCE_INVALID", message: `Invalid references in group ${group.id}` });
    }
    if (group.range !== void 0 && (!Number.isFinite(group.range.zStart) || !Number.isFinite(group.range.zEnd) || group.range.zEnd - group.range.zStart <= tolerance || group.range.zStart < draft.axis.zMin - tolerance || group.range.zEnd > draft.axis.zMax + tolerance)) {
      diagnostics.push({ id: `diagnostic:group-range:${group.id}`, severity: "error", code: "PARTITION_GROUP_RANGE_INVALID", message: `Invalid functional range in group ${group.id}` });
    }
  }
  return diagnostics;
}
function problem$2(code, message, segmentId) {
  return { id: `diagnostic:${code}:${segmentId}`, severity: "error", code, message, segmentIds: [segmentId] };
}
function moveBoundary(draft, input) {
  if (input.boundaryIndex <= 0 || input.boundaryIndex >= draft.segments.length) throw new Error("PARTITION_BOUNDARY_INDEX");
  const z = snap(input.requestedZ, input.snapCandidates, input.snapTolerance);
  const before = draft.segments[input.boundaryIndex - 1];
  const after = draft.segments[input.boundaryIndex];
  if (!(z > before.zStart && z < after.zEnd)) throw new Error("PARTITION_BOUNDARY_ORDER");
  const evidenceId = `manual:boundary:${input.boundaryIndex}:${canonical$4(z)}`;
  const profileSamples = uniqueSamples(draft.segments.flatMap((segment) => segment.profileSamples ?? []));
  const segments = draft.segments.map((segment, index) => index === input.boundaryIndex - 1 ? summarize({ ...segment, zEnd: z, profileSamples, boundaryEvidenceIds: unique$5([...segment.boundaryEvidenceIds, evidenceId]) }) : index === input.boundaryIndex ? summarize({ ...segment, zStart: z, profileSamples, boundaryEvidenceIds: unique$5([...segment.boundaryEvidenceIds, evidenceId]) }) : segment);
  return appendManual(draft, segments, evidenceId, `Boundary moved to ${z}`);
}
function moveSemanticRange(draft, input) {
  const group = draft.semanticGroups.find(({ id }) => id === input.groupId);
  if (!group) throw new Error("PARTITION_GROUP_UNKNOWN");
  const related = group.segmentIds.map((id) => draft.segments.find((segment) => segment.id === id)).filter((segment) => segment !== void 0);
  if (related.length === 0) throw new Error("PARTITION_GROUP_REFERENCE_INVALID");
  const current = group.range ?? {
    zStart: Math.min(...related.map(({ zStart }) => zStart)),
    zEnd: Math.max(...related.map(({ zEnd }) => zEnd))
  };
  const z = snap(input.requestedZ, input.snapCandidates, input.snapTolerance);
  const nextRange = input.edge === "start" ? { ...current, zStart: z } : { ...current, zEnd: z };
  const tolerance = Math.max(Math.abs(draft.axis.zMax - draft.axis.zMin) * 1e-9, 1e-9);
  if (nextRange.zStart < draft.axis.zMin - tolerance || nextRange.zEnd > draft.axis.zMax + tolerance || nextRange.zEnd - nextRange.zStart <= tolerance) throw new Error("PARTITION_GROUP_RANGE_ORDER");
  const evidenceId = `manual:semantic-range:${group.id}:${input.edge}:${canonical$4(z)}`;
  const semanticGroups = draft.semanticGroups.map((candidate) => candidate.id === group.id ? { ...candidate, range: nextRange, evidenceIds: unique$5([...candidate.evidenceIds, evidenceId]) } : candidate);
  return {
    ...structuredClone(draft),
    semanticGroups: structuredClone(semanticGroups),
    evidence: [...structuredClone(draft.evidence), { id: evidenceId, origin: "manual", label: `Functional range ${input.edge} moved to ${z}` }]
  };
}
function renameSemanticGroup(draft, input) {
  const group = draft.semanticGroups.find(({ id }) => id === input.groupId);
  if (!group) throw new Error("PARTITION_GROUP_UNKNOWN");
  const name = input.name.trim();
  if (name.length === 0 || name.length > 120) throw new Error("PARTITION_GROUP_NAME_INVALID");
  if (group.name === name) return structuredClone(draft);
  const evidenceId = `manual:semantic-name:${group.id}:${draft.evidence.length}`;
  return {
    ...structuredClone(draft),
    semanticGroups: draft.semanticGroups.map((candidate) => candidate.id === group.id ? { ...structuredClone(candidate), name, evidenceIds: unique$5([...candidate.evidenceIds, evidenceId]) } : structuredClone(candidate)),
    evidence: [...structuredClone(draft.evidence), {
      id: evidenceId,
      origin: "manual",
      label: `Functional region renamed to ${name}`
    }]
  };
}
function splitSegment(draft, input) {
  const index = draft.segments.findIndex(({ id }) => id === input.segmentId);
  if (index < 0) throw new Error("PARTITION_SEGMENT_UNKNOWN");
  const source = draft.segments[index];
  const z = snap(input.z, input.snapCandidates, input.snapTolerance);
  if (!(z > source.zStart && z < source.zEnd)) throw new Error("PARTITION_BOUNDARY_ORDER");
  const evidenceId = `manual:split:${source.id}:${canonical$4(z)}`;
  const make = (side, zStart, zEnd) => ({
    ...source,
    id: `${source.id}:${side}:${canonical$4(z)}`,
    zStart,
    zEnd,
    boundaryEvidenceIds: unique$5([...source.boundaryEvidenceIds, evidenceId])
  });
  const left = summarize(make("left", source.zStart, z));
  const right = summarize(make("right", z, source.zEnd));
  const segments = [...draft.segments.slice(0, index), left, right, ...draft.segments.slice(index + 1)];
  const semanticGroups = draft.semanticGroups.map((group) => ({
    ...group,
    segmentIds: group.segmentIds.flatMap((id) => id === source.id ? [left.id, right.id] : [id])
  }));
  return appendManual({ ...draft, semanticGroups }, segments, evidenceId, `Segment split at ${z}`);
}
function mergeBoundary(draft, input) {
  if (input.boundaryIndex <= 0 || input.boundaryIndex >= draft.segments.length) throw new Error("PARTITION_BOUNDARY_INDEX");
  const left = draft.segments[input.boundaryIndex - 1];
  const right = draft.segments[input.boundaryIndex];
  const evidenceId = `manual:merge:${left.id}:${right.id}`;
  const merged = {
    ...left,
    id: `segment:${canonical$4(left.zStart)}-${canonical$4(right.zEnd)}`,
    zEnd: right.zEnd,
    profile: {
      minRadius: Math.min(left.profile.minRadius, right.profile.minRadius),
      maxRadius: Math.max(left.profile.maxRadius, right.profile.maxRadius),
      sampleCount: left.profile.sampleCount + right.profile.sampleCount
    },
    geometryNodeIds: unique$5([...left.geometryNodeIds, ...right.geometryNodeIds]),
    boundaryEvidenceIds: unique$5([...left.boundaryEvidenceIds, ...right.boundaryEvidenceIds, evidenceId]),
    semanticEvidenceIds: unique$5([...left.semanticEvidenceIds, ...right.semanticEvidenceIds]),
    diagnosticIds: unique$5([...left.diagnosticIds, ...right.diagnosticIds]),
    profileSamples: [...left.profileSamples ?? [], ...right.profileSamples ?? []]
  };
  const segments = [...draft.segments.slice(0, input.boundaryIndex - 1), merged, ...draft.segments.slice(input.boundaryIndex + 1)];
  const removed = /* @__PURE__ */ new Set([left.id, right.id]);
  const semanticGroups = draft.semanticGroups.map((group) => ({
    ...group,
    segmentIds: unique$5(group.segmentIds.flatMap((id) => removed.has(id) ? [merged.id] : [id]))
  }));
  return appendManual({ ...draft, semanticGroups }, segments, evidenceId, "Boundary merged");
}
function updateSegmentMetadata(draft, input) {
  if (!draft.segments.some(({ id }) => id === input.segmentId)) throw new Error("PARTITION_SEGMENT_UNKNOWN");
  const evidenceId = `manual:metadata:${input.segmentId}:${draft.evidence.length}`;
  const segments = draft.segments.map((segment) => segment.id === input.segmentId ? {
    ...segment,
    ...input.name === void 0 ? {} : { name: input.name },
    ...input.semanticType === void 0 ? {} : { semanticType: input.semanticType },
    semanticEvidenceIds: unique$5([...segment.semanticEvidenceIds, evidenceId])
  } : segment);
  return appendManual(draft, segments, evidenceId, `Metadata updated for ${input.segmentId}`);
}
function snap(value, candidates, tolerance) {
  var _a3;
  if (!Number.isFinite(value) || !Number.isFinite(tolerance) || tolerance < 0) throw new Error("PARTITION_BOUNDARY_INVALID");
  const eligible = candidates.filter(({ z }) => Math.abs(z - value) <= tolerance).sort((a, b) => b.score - a.score || Math.abs(a.z - value) - Math.abs(b.z - value));
  return ((_a3 = eligible[0]) == null ? void 0 : _a3.z) ?? value;
}
function appendManual(draft, segments, id, label) {
  return { ...structuredClone(draft), segments: structuredClone(segments), evidence: [...structuredClone(draft.evidence), { id, origin: "manual", label }] };
}
function summarize(segment) {
  if (segment.profileSamples === void 0) return segment;
  const tolerance = Math.max((segment.zEnd - segment.zStart) * 1e-9, 1e-9);
  const samples = segment.profileSamples.filter(({ z }) => z >= segment.zStart - tolerance && z <= segment.zEnd + tolerance);
  const radii = samples.map(({ radius }) => radius);
  return {
    ...segment,
    profile: {
      minRadius: radii.length === 0 ? 0 : Math.min(...radii),
      maxRadius: radii.length === 0 ? 0 : Math.max(...radii),
      sampleCount: radii.length
    },
    geometryNodeIds: unique$5(samples.map(({ geometryNodeId }) => geometryNodeId))
  };
}
function uniqueSamples(samples) {
  return [...new Map(samples.map((sample) => [`${sample.geometryNodeId}:${canonical$4(sample.z)}:${canonical$4(sample.radius)}`, sample])).values()];
}
function unique$5(values) {
  return [...new Set(values)];
}
function canonical$4(value) {
  return Number(value.toFixed(9)).toString();
}
function parseEngineeringDocument(text) {
  const result = { drawing: {}, regions: [], unknown: [], diagnostics: [] };
  const ids = /* @__PURE__ */ new Set();
  let section = "";
  let region;
  for (const [offset, raw] of text.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    const line = offset + 1;
    const value = raw.trim();
    if (!value || value.startsWith("#") || value.startsWith(";")) continue;
    const heading = /^\[([^\]]+)]$/.exec(value);
    if (heading) {
      section = heading[1].trim();
      const match = /^region:([^:]+):([^:]+)$/.exec(section);
      region = void 0;
      if (match) {
        const id = match[2].trim();
        region = { id, type: match[1].trim(), sourceLines: [line] };
        if (ids.has(id)) diagnostic(result, "DOCUMENT_REGION_DUPLICATE", `Duplicate region ${id}`, line);
        ids.add(id);
        result.regions.push(region);
      }
      continue;
    }
    const separator = value.indexOf("=");
    if (separator < 0) {
      diagnostic(result, "DOCUMENT_LINE_INVALID", "Expected key=value", line);
      continue;
    }
    const key = value.slice(0, separator).trim();
    const field = value.slice(separator + 1).trim();
    if (section === "drawing") parseDrawing(result, key, field, line);
    else if (region) parseRegion(result, region, key, field, line);
    else result.unknown.push({ section, key, value: field, line });
  }
  for (const item of result.regions) {
    if (item.center !== void 0 && item.width !== void 0 && item.width > 0) {
      item.interval = { start: item.center - item.width / 2, end: item.center + item.width / 2 };
    }
    delete item.center;
    delete item.width;
  }
  return result;
}
function parseDrawing(result, key, value, line) {
  if (key === "drawing_name") {
    if (value) result.drawing.drawingName = value;
    return;
  }
  if (key === "drawing_id") {
    if (value) result.unknown.push({ section: "drawing", key, value, line });
    return;
  }
  if (key === "unit") {
    if (!value) return;
    if (value === "mm" || value === "cm" || value === "m") result.drawing.unit = value;
    else diagnostic(result, "DOCUMENT_UNIT_UNSUPPORTED", `Unsupported unit ${value}`, line);
    return;
  }
  if (key === "axis_origin") {
    if (!value) return;
    if (value === "left_end" || value === "right_end") result.drawing.axisOrigin = value;
    else diagnostic(result, "DOCUMENT_AXIS_ORIGIN_INVALID", `Invalid axis origin ${value}`, line);
    return;
  }
  if (key === "orientation") {
    if (!value) return;
    if (value === "auto" || value === "forward" || value === "reversed") result.drawing.orientation = value;
    else diagnostic(result, "DOCUMENT_ORIENTATION_INVALID", `Invalid orientation ${value}`, line);
    return;
  }
  result.unknown.push({ section: "drawing", key, value, line });
}
function parseRegion(result, region, key, value, line) {
  region.sourceLines.push(line);
  if (key === "name") {
    if (value) region.name = value;
    return;
  }
  if (key === "center_z") {
    region.center = numeric(result, key, value, line);
    return;
  }
  if (key === "width") {
    region.width = numeric(result, key, value, line);
    if (region.width !== void 0 && region.width <= 0) diagnostic(result, "DOCUMENT_WIDTH_INVALID", "Region width must be positive", line);
    return;
  }
  if (key === "outer_diameter") {
    region.outerDiameter = numeric(result, key, value, line);
    if (region.outerDiameter !== void 0 && region.outerDiameter <= 0) diagnostic(result, "DOCUMENT_DIAMETER_INVALID", "Outer diameter must be positive", line);
    return;
  }
  result.unknown.push({ section: `region:${region.type}:${region.id}`, key, value, line });
}
function numeric(result, key, value, line) {
  if (!value) return void 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    diagnostic(result, "DOCUMENT_NUMBER_INVALID", `Invalid number for ${key}`, line);
    return void 0;
  }
  return parsed;
}
function diagnostic(result, code, message, line) {
  result.diagnostics.push({ id: `document:${line}:${code}`, severity: "warning", code, message });
}
function resolveShaftAxis(document, hints) {
  const nodes = document.geometry.filter(({ visible, type }) => visible && type !== "ray" && type !== "xline").map((node) => {
    const points = sampleNode(node);
    return { id: String(node.id), points, bounds: bounds(points) };
  }).filter(({ points }) => points.length >= 2);
  if (nodes.length === 0) return null;
  const global = bounds(nodes.flatMap(({ points }) => points));
  const tolerance = Math.max(global[2] - global[0], global[3] - global[1], 1) * 1e-5;
  const candidates = connectedComponents(nodes, tolerance).map((component) => principalCandidate(component, hints)).filter((item) => item !== null).sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  if (!selected) return null;
  const useReverse = hints.orientation === "reversed" || hints.axisOrigin === "right_end";
  const direction = useReverse ? [-selected.direction[0], -selected.direction[1]] : selected.direction;
  const normal = [-direction[1], direction[0]];
  const axial = selected.points.map((point) => dot(point, direction));
  const radial = selected.points.map((point) => dot(point, normal));
  const zMinWorld = Math.min(...axial);
  const zMaxWorld = Math.max(...axial);
  const radialCenter = (Math.min(...radial) + Math.max(...radial)) / 2;
  const origin = [
    direction[0] * zMinWorld + normal[0] * radialCenter,
    direction[1] * zMinWorld + normal[1] * radialCenter
  ];
  return {
    origin,
    direction,
    normal,
    zMin: 0,
    zMax: zMaxWorld - zMinWorld,
    orientation: useReverse ? "reversed" : "forward",
    geometryNodeIds: selected.nodeIds
  };
}
function connectedComponents(nodes, tolerance) {
  const remaining = new Set(nodes.map((_, index) => index));
  const output = [];
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    remaining.delete(first);
    const queue = [first];
    const component = [];
    while (queue.length > 0) {
      const current = queue.pop();
      component.push(nodes[current]);
      for (const candidate of [...remaining]) {
        if (!overlaps(nodes[current].bounds, nodes[candidate].bounds, tolerance)) continue;
        remaining.delete(candidate);
        queue.push(candidate);
      }
    }
    output.push(component);
  }
  return output;
}
function principalCandidate(component, hints) {
  const points = component.flatMap(({ points: points2 }) => points2);
  if (points.length < 2) return null;
  const mean = [average$1(points.map(([x]) => x)), average$1(points.map(([, y]) => y))];
  const xx = average$1(points.map(([x]) => (x - mean[0]) ** 2));
  const yy = average$1(points.map(([, y]) => (y - mean[1]) ** 2));
  const xy = average$1(points.map(([x, y]) => (x - mean[0]) * (y - mean[1])));
  const angle = dominantEdgeAngle(component) ?? Math.atan2(2 * xy, xx - yy) / 2;
  let direction = [Math.cos(angle), Math.sin(angle)];
  if (Math.abs(direction[0]) >= Math.abs(direction[1]) ? direction[0] < 0 : direction[1] < 0) direction = [-direction[0], -direction[1]];
  const normal = [-direction[1], direction[0]];
  const axial = points.map((point) => dot(point, direction));
  const radial = points.map((point) => dot(point, normal));
  const length = Math.max(...axial) - Math.min(...axial);
  const diameter = Math.max(...radial) - Math.min(...radial);
  if (!(length > 0 && diameter > length * 1e-4)) return null;
  const elongation = length / Math.max(diameter, length * 1e-4);
  const expectedDiameters = hints.regions.flatMap(({ outerDiameter }) => outerDiameter === void 0 ? [] : [outerDiameter]);
  const diameterFit = expectedDiameters.length === 0 ? 1 : 1 / (1 + Math.min(...expectedDiameters.map((expected) => Math.abs(diameter - expected) / Math.max(expected, 1e-9))) * 12);
  const intervalEnds = hints.regions.flatMap(({ interval }) => interval === void 0 ? [] : [interval.end]);
  const lengthFit = intervalEnds.length === 0 ? 1 : 1 / (1 + Math.max(0, Math.max(...intervalEnds) - length) / Math.max(length, 1e-9) * 4);
  const score2 = Math.log1p(elongation) * Math.sqrt(component.length) * length * diameterFit * lengthFit;
  return { score: score2, direction, points, nodeIds: component.map(({ id }) => id) };
}
function dominantEdgeAngle(component) {
  const binCount = 1800;
  const bins = Array.from({ length: binCount }, () => 0);
  for (const { points } of component) {
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1];
      const second = points[index];
      const length = Math.hypot(second[0] - first[0], second[1] - first[1]);
      if (length <= 1e-9) continue;
      const angle = (Math.atan2(second[1] - first[1], second[0] - first[0]) % Math.PI + Math.PI) % Math.PI;
      bins[Math.min(binCount - 1, Math.floor(angle / Math.PI * binCount))] += length;
    }
  }
  const smoothed = bins.map((_, index) => [-2, -1, 0, 1, 2].reduce((sum, offset) => sum + bins[(index + offset + binCount) % binCount], 0));
  const best = smoothed.indexOf(Math.max(...smoothed));
  if (smoothed[best] === 0) return null;
  let x = 0;
  let y = 0;
  for (const { points } of component) {
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1];
      const second = points[index];
      const length = Math.hypot(second[0] - first[0], second[1] - first[1]);
      if (length <= 1e-9) continue;
      const angle = (Math.atan2(second[1] - first[1], second[0] - first[0]) % Math.PI + Math.PI) % Math.PI;
      const bin = Math.min(binCount - 1, Math.floor(angle / Math.PI * binCount));
      const distance2 = Math.min(Math.abs(bin - best), binCount - Math.abs(bin - best));
      if (distance2 > 2) continue;
      x += Math.cos(angle * 2) * length;
      y += Math.sin(angle * 2) * length;
    }
  }
  return Math.atan2(y, x) / 2;
}
function sampleNode(node) {
  switch (node.type) {
    case "point":
      return [[node.x, node.y]];
    case "line":
      return [node.start, node.end];
    case "polyline":
      return node.vertices.map(({ point }) => point);
    case "spline":
      return sampleSpline(node, { maxError: 0.02, maxDepth: 14 });
    case "circle":
      return sampleAngles(64).map((angle) => polar(node.center, node.radius, angle));
    case "arc": {
      const span = positiveSpan(node.startAngle, node.endAngle);
      return sampleCount(Math.max(8, Math.ceil(span / 4))).map((t) => polar(node.center, node.radius, node.startAngle + span * t));
    }
    case "ellipse": {
      const major = Math.hypot(node.majorAxis[0], node.majorAxis[1]);
      const rotation = Math.atan2(node.majorAxis[1], node.majorAxis[0]);
      return sampleCount(64).map((t) => {
        const angle = t * Math.PI * 2;
        const x = major * Math.cos(angle);
        const y = major * node.ratio * Math.sin(angle);
        return [node.center[0] + x * Math.cos(rotation) - y * Math.sin(rotation), node.center[1] + x * Math.sin(rotation) + y * Math.cos(rotation)];
      });
    }
    default:
      return [];
  }
}
function bounds(points) {
  return [Math.min(...points.map(([x]) => x)), Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([x]) => x)), Math.max(...points.map(([, y]) => y))];
}
function overlaps(a, b, t) {
  return a[0] <= b[2] + t && a[2] >= b[0] - t && a[1] <= b[3] + t && a[3] >= b[1] - t;
}
function dot(point, direction) {
  return point[0] * direction[0] + point[1] * direction[1];
}
function average$1(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function sampleAngles(count) {
  return sampleCount(count).map((t) => t * 360);
}
function sampleCount(count) {
  return Array.from({ length: count + 1 }, (_, index) => index / count);
}
function polar(center, radius, degrees) {
  const angle = degrees * Math.PI / 180;
  return [center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius];
}
function positiveSpan(start2, end2) {
  const span = ((end2 - start2) % 360 + 360) % 360;
  return span === 0 ? 360 : span;
}
function extractShaftProfile(document, axis) {
  const pieces = [];
  const selected = axis.geometryNodeIds === void 0 ? void 0 : new Set(axis.geometryNodeIds);
  for (const node of document.geometry) {
    if (!node.visible || node.type === "ray" || node.type === "xline" || selected !== void 0 && !selected.has(String(node.id))) continue;
    const points = sampleNode(node).map((point) => local(point, axis));
    for (let index = 1; index < points.length; index += 1) {
      const first = points[index - 1];
      const second = points[index];
      pieces.push({ z1: first[0], r1: first[1], z2: second[0], r2: second[1], geometryNodeId: String(node.id) });
    }
  }
  const maxRadius = Math.max(0, ...pieces.flatMap(({ r1, r2 }) => [Math.abs(r1), Math.abs(r2)]));
  const axialTolerance = Math.max(axis.zMax * 1e-5, 1e-6);
  const events = [];
  for (const piece of pieces) {
    if (Math.abs(piece.z2 - piece.z1) > axialTolerance) continue;
    const radialSpan = Math.abs(piece.r2 - piece.r1);
    if (radialSpan <= Math.max(maxRadius * 0.025, 0.05)) continue;
    if (piece.r1 * piece.r2 <= 0) continue;
    const z = (piece.z1 + piece.z2) / 2;
    events.push({ z, radialSpan, positive: (piece.r1 + piece.r2) / 2 > 0, geometryNodeId: piece.geometryNodeId });
  }
  const clusters = clusterShoulderEvents(events, axialTolerance);
  const minimumSideSpan = Math.max(maxRadius * 0.01, 0.05);
  const shoulders = clusters.filter(({ positiveSpan: positiveSpan2, negativeSpan }) => positiveSpan2 > minimumSideSpan && negativeSpan > minimumSideSpan).map(({ weightedZ, weight, positiveSpan: positiveSpan2, negativeSpan, geometryNodeIds }) => ({
    z: weightedZ / weight,
    radialSpan: positiveSpan2 + negativeSpan,
    geometryNodeIds
  })).sort((first, second) => first.z - second.z);
  return { axis, pieces, shoulders, maxRadius, sampleCount: pieces.length + 1 };
}
function clusterShoulderEvents(events, tolerance) {
  const clusters = [];
  for (const event of [...events].sort((first, second) => first.z - second.z)) {
    const current = clusters.at(-1);
    if (!current || event.z - current.minZ > tolerance) {
      clusters.push({
        minZ: event.z,
        weightedZ: event.z * event.radialSpan,
        weight: event.radialSpan,
        positiveSpan: event.positive ? event.radialSpan : 0,
        negativeSpan: event.positive ? 0 : event.radialSpan,
        geometryNodeIds: [event.geometryNodeId]
      });
      continue;
    }
    current.weightedZ += event.z * event.radialSpan;
    current.weight += event.radialSpan;
    if (event.positive) current.positiveSpan += event.radialSpan;
    else current.negativeSpan += event.radialSpan;
    if (!current.geometryNodeIds.includes(event.geometryNodeId)) current.geometryNodeIds.push(event.geometryNodeId);
  }
  return clusters;
}
function radiusSummary(profile, zStart, zEnd) {
  const radii = profile.pieces.flatMap((piece) => {
    const low = Math.min(piece.z1, piece.z2);
    const high = Math.max(piece.z1, piece.z2);
    if (high < zStart || low > zEnd) return [];
    return [Math.abs(piece.r1), Math.abs(piece.r2)];
  });
  return {
    minRadius: radii.length ? Math.min(...radii) : 0,
    maxRadius: radii.length ? Math.max(...radii) : 0,
    sampleCount: radii.length
  };
}
function local(point, axis) {
  const delta = [point[0] - axis.origin[0], point[1] - axis.origin[1]];
  return [delta[0] * axis.direction[0] + delta[1] * axis.direction[1], delta[0] * axis.normal[0] + delta[1] * axis.normal[1]];
}
function detectShaftSteps(profile) {
  const tolerance = Math.max(profile.axis.zMax * 1e-5, 1e-6);
  const candidates = [
    { z: profile.axis.zMin, score: 1, geometryNodeIds: [] },
    ...profile.shoulders.map(({ z, radialSpan, geometryNodeIds }) => ({
      z,
      score: Math.min(0.99, 0.35 + radialSpan / Math.max(profile.maxRadius, 1) * 0.65),
      geometryNodeIds
    })),
    { z: profile.axis.zMax, score: 1, geometryNodeIds: [] }
  ].sort((a, b) => a.z - b.z);
  const clustered = [];
  for (const candidate of candidates) {
    const previous = clustered.at(-1);
    if (previous && Math.abs(previous.z - candidate.z) <= tolerance) {
      if (candidate.score > previous.score) previous.score = candidate.score;
      previous.geometryNodeIds = [.../* @__PURE__ */ new Set([...previous.geometryNodeIds, ...candidate.geometryNodeIds])];
    } else clustered.push({ ...candidate });
  }
  return clustered.map(({ z, score: score2, geometryNodeIds }, index) => {
    const coordinate = index === 0 ? profile.axis.zMin : index === clustered.length - 1 ? profile.axis.zMax : z;
    return {
      id: `step:${canonical$3(coordinate)}`,
      z: Number(canonical$3(coordinate)),
      score: score2,
      evidenceIds: geometryNodeIds.map((id) => `geometry:${id}`),
      accepted: index === 0 || index === clustered.length - 1 || score2 >= 0.45
    };
  });
}
function canonical$3(value) {
  return Number(value.toFixed(6)).toString();
}
function fuseDocumentRegions(draft, regions) {
  const output = structuredClone(draft);
  for (const region of regions) {
    if (!region.interval) continue;
    const evidenceId = `document:region:${region.id}`;
    const evidence = {
      id: evidenceId,
      origin: "document",
      label: region.name ?? region.id,
      sourceLines: [...region.sourceLines]
    };
    output.evidence.push(evidence);
    const matches = contiguousMatches(output.segments, region);
    const best = matches[0];
    if (!best) continue;
    const matched = best.cost <= 0.4;
    const ambiguous = matches[1] !== void 0 && Math.abs(matches[1].cost - best.cost) < 0.01;
    if (!matched) {
      output.diagnostics.push({
        id: `diagnostic:document-unmatched:${region.id}`,
        severity: "warning",
        code: "DOCUMENT_REGION_UNMATCHED",
        message: `Document region ${region.id} could not be reconciled with geometric steps`,
        evidenceIds: [evidenceId]
      });
    }
    if (ambiguous) {
      output.diagnostics.push({
        id: `diagnostic:document-ambiguous:${region.id}`,
        severity: "warning",
        code: "DOCUMENT_REGION_AMBIGUOUS",
        message: `Document region ${region.id} has multiple similarly plausible geometric ranges`,
        evidenceIds: [evidenceId]
      });
    }
    const confidence = Math.max(0.5, Math.min(0.99, 1 - best.cost));
    const reliableMatch = matched && !ambiguous;
    const relatedSegments = reliableMatch ? best.segments : overlappingSegments(output.segments, region.interval, output.axis.zMax - output.axis.zMin);
    const matchedRange = {
      zStart: best.segments[0].zStart,
      zEnd: best.segments.at(-1).zEnd
    };
    const rangeTolerance = Math.max((output.axis.zMax - output.axis.zMin) * 1e-3, 1e-6);
    const sourceAligned = Math.abs(matchedRange.zStart - region.interval.start) <= rangeTolerance && Math.abs(matchedRange.zEnd - region.interval.end) <= rangeTolerance;
    const geometryReconciled = reliableMatch && !sourceAligned && best.widthError <= 0.03 && best.diameterError !== void 0 && best.diameterError <= 0.03;
    const range = geometryReconciled ? matchedRange : {
      zStart: region.interval.start,
      zEnd: region.interval.end
    };
    if (geometryReconciled) {
      output.diagnostics.push({
        id: `diagnostic:document-reconciled:${region.id}`,
        severity: "warning",
        code: "DOCUMENT_REGION_RECONCILED",
        message: `Document region ${region.id} was reconciled from ${formatRange(region.interval)} to geometric range ${formatRange(matchedRange)}`,
        segmentIds: relatedSegments.map(({ id }) => id),
        evidenceIds: [evidenceId]
      });
    }
    const group = {
      id: `group:${region.id}`,
      segmentIds: relatedSegments.map(({ id }) => id),
      range,
      semanticType: region.type,
      ...region.name === void 0 ? {} : { name: region.name },
      evidenceIds: [evidenceId]
    };
    output.semanticGroups.push(group);
    if (!reliableMatch) continue;
    for (const segment of relatedSegments) {
      if (segment.semanticType !== void 0 && segment.semanticType !== region.type) {
        output.diagnostics.push({
          id: `diagnostic:document-semantic-conflict:${region.id}:${segment.id}`,
          severity: "warning",
          code: "DOCUMENT_SEMANTIC_CONFLICT",
          message: `Document region ${region.id} conflicts with an existing segment classification`,
          segmentIds: [segment.id],
          evidenceIds: [evidenceId]
        });
        continue;
      }
      segment.semanticType = region.type;
      if (region.name !== void 0) segment.name = region.name;
      segment.semanticConfidence = confidence;
      segment.semanticEvidenceIds = [.../* @__PURE__ */ new Set([...segment.semanticEvidenceIds, evidenceId])];
      if (region.outerDiameter !== void 0 && segment.profile.sampleCount > 0) {
        const actual = segment.profile.maxRadius * 2;
        if (Math.abs(actual - region.outerDiameter) > Math.max(1, region.outerDiameter * 0.05)) {
          const diagnosticId = `diagnostic:diameter:${region.id}:${segment.id}`;
          output.diagnostics.push({
            id: diagnosticId,
            severity: "warning",
            code: "DOCUMENT_DIAMETER_CONFLICT",
            message: `Document diameter ${region.outerDiameter} differs from geometric envelope ${actual}`,
            segmentIds: [segment.id],
            evidenceIds: [evidenceId]
          });
          segment.diagnosticIds.push(diagnosticId);
        }
      }
    }
  }
  return output;
}
function contiguousMatches(segments, region) {
  const interval = region.interval;
  const axisSpan = Math.max(segments.at(-1).zEnd - segments[0].zStart, 1e-9);
  const targetWidth = Math.max(interval.end - interval.start, axisSpan * 1e-6);
  const targetCenter = (interval.start + interval.end) / 2;
  const output = [];
  for (let start2 = 0; start2 < segments.length; start2 += 1) {
    for (let end2 = start2; end2 < segments.length; end2 += 1) {
      const selected = segments.slice(start2, end2 + 1);
      const actualStart = selected[0].zStart;
      const actualEnd = selected.at(-1).zEnd;
      const actualWidth = actualEnd - actualStart;
      const endpointError = (Math.abs(actualStart - interval.start) + Math.abs(actualEnd - interval.end)) / axisSpan;
      const centerError = Math.abs((actualStart + actualEnd) / 2 - targetCenter) / axisSpan;
      const widthError = Math.abs(actualWidth - targetWidth) / Math.max(targetWidth, axisSpan * 0.05);
      let diameterError;
      if (region.outerDiameter !== void 0) {
        const profiled = selected.filter(({ profile }) => profile.sampleCount > 0);
        const profiledWidth = profiled.reduce((sum, segment) => sum + segment.zEnd - segment.zStart, 0);
        if (profiledWidth > 0) {
          const measuredError = profiled.reduce((sum, segment) => sum + (segment.zEnd - segment.zStart) * Math.abs(segment.profile.maxRadius * 2 - region.outerDiameter), 0) / Math.max(region.outerDiameter, 1);
          const unprofiledWidth = Math.max(0, actualWidth - profiledWidth);
          diameterError = Math.min(1, (measuredError + unprofiledWidth * 0.25) / Math.max(actualWidth, 1e-9));
        }
      }
      const diameterCost = diameterError ?? 0.25;
      output.push({
        segments: selected,
        widthError,
        ...diameterError === void 0 ? {} : { diameterError },
        cost: Math.min(widthError, 2) * 0.3 + diameterCost * 0.6 + centerError * 0.04 + endpointError * 0.06
      });
    }
  }
  return output.sort((a, b) => a.cost - b.cost || a.segments.length - b.segments.length);
}
function overlappingSegments(segments, interval, axisSpan) {
  const tolerance = Math.max(axisSpan * 1e-9, 1e-9);
  const overlapping = segments.filter(({ zStart, zEnd }) => zEnd > interval.start + tolerance && zStart < interval.end - tolerance);
  return overlapping.length > 0 ? overlapping : [nearestSegment(segments, (interval.start + interval.end) / 2)];
}
function nearestSegment(segments, z) {
  return [...segments].sort((left, right) => distanceToSegment(left, z) - distanceToSegment(right, z))[0];
}
function distanceToSegment(segment, z) {
  return z < segment.zStart ? segment.zStart - z : z > segment.zEnd ? z - segment.zEnd : 0;
}
function formatRange(range) {
  const start2 = range.start ?? range.zStart;
  const end2 = range.end ?? range.zEnd;
  return `${Number(start2 == null ? void 0 : start2.toFixed(6))}–${Number(end2 == null ? void 0 : end2.toFixed(6))}`;
}
function analyzeShaftPartition(request) {
  const parsed = request.engineeringText === void 0 ? void 0 : parseEngineeringDocument(request.engineeringText);
  const documentScale = (parsed == null ? void 0 : parsed.drawing.unit) === void 0 ? 1 : unitScale(parsed.drawing.unit) / unitScale(request.document.unitSystem.length);
  const documentRegions = ((parsed == null ? void 0 : parsed.regions) ?? []).map((region) => ({
    ...region,
    ...region.interval === void 0 ? {} : { interval: { start: region.interval.start * documentScale, end: region.interval.end * documentScale } },
    ...region.outerDiameter === void 0 ? {} : { outerDiameter: region.outerDiameter * documentScale }
  }));
  const axis = resolveShaftAxis(request.document, {
    axisOrigin: parsed == null ? void 0 : parsed.drawing.axisOrigin,
    orientation: parsed == null ? void 0 : parsed.drawing.orientation,
    regions: documentRegions
  });
  if (!axis) return { status: "rejected", diagnostics: [{ id: "diagnostic:axis", severity: "error", code: "SHAFT_AXIS_UNRESOLVED", message: "No viable shaft axis was found" }] };
  const profile = extractShaftProfile(request.document, axis);
  const stepCandidates = detectShaftSteps(profile);
  const geometryEvidence = /* @__PURE__ */ new Map();
  for (const step of stepCandidates) {
    for (const evidenceId of step.evidenceIds) {
      geometryEvidence.set(evidenceId, { id: evidenceId, origin: "geometry", label: `Geometric step at ${step.z}` });
    }
  }
  const boundaries = stepCandidates.filter(({ accepted }) => accepted).map(({ z }) => z);
  const tolerance = Math.max(axis.zMax * 1e-8, 1e-8);
  const sorted = [...boundaries].sort((a, b) => a - b).filter((value, index, values) => index === 0 || Math.abs(value - values[index - 1]) > tolerance);
  let draft = {
    version: 1,
    drawingRef: structuredClone(request.drawingRef),
    axis,
    segments: sorted.slice(0, -1).map((zStart, index) => {
      const zEnd = sorted[index + 1];
      const overlappingPieces = profile.pieces.filter(({ z1, z2 }) => Math.max(z1, z2) >= zStart && Math.min(z1, z2) <= zEnd);
      const left = stepCandidates.find(({ z }) => Math.abs(z - zStart) <= tolerance);
      const right = stepCandidates.find(({ z }) => Math.abs(z - zEnd) <= tolerance);
      return {
        id: `segment:${canonical$2(zStart)}-${canonical$2(zEnd)}`,
        zStart,
        zEnd,
        profile: radiusSummary(profile, zStart, zEnd),
        boundaryConfidence: Math.min((left == null ? void 0 : left.score) ?? 0.75, (right == null ? void 0 : right.score) ?? 0.75),
        geometryNodeIds: [...new Set(overlappingPieces.map(({ geometryNodeId }) => geometryNodeId))],
        profileSamples: overlappingPieces.flatMap(({ z1, r1, z2, r2, geometryNodeId }) => [
          { z: z1, radius: Math.abs(r1), geometryNodeId },
          { z: z2, radius: Math.abs(r2), geometryNodeId }
        ]),
        boundaryEvidenceIds: [.../* @__PURE__ */ new Set([...(left == null ? void 0 : left.evidenceIds) ?? [], ...(right == null ? void 0 : right.evidenceIds) ?? []])],
        semanticEvidenceIds: [],
        diagnosticIds: []
      };
    }),
    semanticGroups: [],
    stepCandidates,
    evidence: [...geometryEvidence.values()],
    diagnostics: [...(parsed == null ? void 0 : parsed.diagnostics) ?? []]
  };
  if ((parsed == null ? void 0 : parsed.drawing.drawingName) && request.drawingSourceName && parsed.drawing.drawingName !== request.drawingSourceName) {
    draft.diagnostics.push({
      id: "diagnostic:drawing-name-mismatch",
      severity: "warning",
      code: "DOCUMENT_DRAWING_NAME_MISMATCH",
      message: `Selected ${request.drawingSourceName}; document describes ${parsed.drawing.drawingName}`
    });
  }
  if (parsed) {
    draft = fuseDocumentRegions(draft, documentRegions);
  }
  const invalid = validatePartition(draft);
  if (invalid.length > 0) return { status: "rejected", diagnostics: [...draft.diagnostics, ...invalid] };
  return {
    status: "drafted",
    draft,
    unclassifiedSegmentIds: draft.segments.filter(({ semanticType }) => semanticType === void 0).map(({ id }) => id),
    semanticReviewSegmentIds: draft.segments.filter(({ semanticType }) => semanticType === void 0).map(({ id }) => id)
  };
}
function canonical$2(value) {
  return Number(value.toFixed(6)).toString();
}
function unitScale(unit) {
  return unit === "mm" ? 1e-3 : unit === "cm" ? 0.01 : 1;
}
function applySemanticProposals(draft, proposals, options = {}) {
  if (proposals.length > 64) throw new Error("AI_SEMANTIC_PROPOSAL_LIMIT");
  const output = structuredClone(draft);
  const known = new Map(output.segments.map((segment) => [segment.id, segment]));
  const allowed = options.allowedSegmentIds === void 0 ? void 0 : new Set(options.allowedSegmentIds);
  const allowedVisual = options.allowedVisualEvidenceIds === void 0 ? void 0 : new Set(options.allowedVisualEvidenceIds);
  const assigned = /* @__PURE__ */ new Set();
  let applied = 0;
  for (const [index, proposal] of proposals.entries()) {
    if (proposal.segmentIds.length === 0 || !proposal.semanticType.trim() || proposal.semanticType.length > 80 || proposal.name !== void 0 && proposal.name.length > 120 || !Number.isFinite(proposal.confidence) || proposal.confidence < 0 || proposal.confidence > 1 || !proposal.reason.trim() || proposal.reason.length > 500) throw new Error("AI_SEMANTIC_PROPOSAL_INVALID");
    if (/\b(?:x|y|z|radius|diameter|boundary)\s*[=:]\s*-?\d/i.test(proposal.reason)) throw new Error("AI_SEMANTIC_REASON_COORDINATES");
    const indices = proposal.segmentIds.map((id) => output.segments.findIndex((segment) => segment.id === id)).sort((a, b) => a - b);
    if (indices.some((value, index2) => index2 > 0 && value !== indices[index2 - 1] + 1)) throw new Error("AI_SEGMENT_RANGE_NONCONTIGUOUS");
    if (proposal.visualEvidenceIds.some((id) => allowedVisual !== void 0 && !allowedVisual.has(id))) throw new Error("AI_VISUAL_EVIDENCE_UNKNOWN");
    for (const id of proposal.segmentIds) {
      const segment = known.get(id);
      if (!segment) throw new Error("AI_SEGMENT_ID_UNKNOWN");
      if (allowed !== void 0 && !allowed.has(id)) throw new Error("AI_SEGMENT_NOT_ALLOWED");
    }
    const expectedVisual = new Set(proposal.segmentIds.map((id) => `observation:${id}`));
    const hasCompleteVisualEvidence = [...expectedVisual].every((id) => proposal.visualEvidenceIds.includes(id));
    if (proposal.confidence < 0.8 || !hasCompleteVisualEvidence || isGenericProposal(proposal)) continue;
    const proposedRange = {
      zStart: Math.min(...proposal.segmentIds.map((id) => known.get(id).zStart)),
      zEnd: Math.max(...proposal.segmentIds.map((id) => known.get(id).zEnd))
    };
    const range = singleUncoveredRange(output, proposedRange);
    if (range === void 0) continue;
    for (const id of proposal.segmentIds) {
      const segment = known.get(id);
      if (segment.semanticType !== void 0) throw new Error("AI_SEGMENT_ALREADY_CLASSIFIED");
      if (assigned.has(id)) throw new Error("AI_SEGMENT_DUPLICATE_ASSIGNMENT");
      assigned.add(id);
    }
    const evidenceId = `ai:semantic:${index}:${proposal.segmentIds.join("+")}`;
    const evidence = { id: evidenceId, origin: "ai", label: proposal.reason };
    output.evidence.push(evidence);
    const group = {
      id: `group:${evidenceId}`,
      segmentIds: [...proposal.segmentIds],
      semanticType: proposal.semanticType,
      range,
      ...proposal.name === void 0 ? {} : { name: proposal.name },
      evidenceIds: [evidenceId, ...proposal.visualEvidenceIds]
    };
    group.evidenceIds = [evidenceId];
    output.semanticGroups.push(group);
    for (const id of proposal.segmentIds) {
      const segment = known.get(id);
      segment.semanticType = proposal.semanticType;
      if (proposal.name !== void 0) segment.name = proposal.name;
      segment.semanticConfidence = proposal.confidence;
      segment.semanticEvidenceIds.push(evidenceId);
    }
    applied += 1;
  }
  return { draft: output, applied };
}
function isGenericProposal(proposal) {
  const value = `${proposal.semanticType} ${proposal.name ?? ""}`.toLowerCase();
  return !SUPPORTED_SEMANTIC_TYPES.has(proposal.semanticType.toLowerCase()) || /(?:work[-_ ]?area|working[-_ ]?area|工作区域|工作区|普通轴段|常规区域|shaft[-_ ]?region)/u.test(value);
}
const SUPPORTED_SEMANTIC_TYPES = /* @__PURE__ */ new Set([
  "gear",
  "spline",
  "bearing-seat",
  "shaft-seat",
  "seal-seat",
  "oil-seal-seat",
  "coupling-seat",
  "thread",
  "keyway",
  "shoulder"
]);
function singleUncoveredRange(draft, proposed) {
  const segmentById = new Map(draft.segments.map((segment) => [segment.id, segment]));
  const occupied = draft.semanticGroups.flatMap((group) => {
    if (group.range !== void 0) return [group.range];
    const related = group.segmentIds.map((id) => segmentById.get(id)).filter((segment) => segment !== void 0);
    return related.length === 0 ? [] : [{
      zStart: Math.min(...related.map(({ zStart }) => zStart)),
      zEnd: Math.max(...related.map(({ zEnd }) => zEnd))
    }];
  });
  const tolerance = Math.max((draft.axis.zMax - draft.axis.zMin) * 1e-9, 1e-9);
  let available = [proposed];
  for (const range of occupied) {
    available = available.flatMap((candidate) => {
      if (range.zEnd <= candidate.zStart + tolerance || range.zStart >= candidate.zEnd - tolerance) return [candidate];
      const pieces = [
        { zStart: candidate.zStart, zEnd: Math.min(candidate.zEnd, range.zStart) },
        { zStart: Math.max(candidate.zStart, range.zEnd), zEnd: candidate.zEnd }
      ];
      return pieces.filter(({ zStart, zEnd }) => zEnd - zStart > tolerance);
    });
  }
  return available.length === 1 ? available[0] : void 0;
}
function inferRegularShaftRegions(draft) {
  const output = structuredClone(draft);
  const minimumSpan = substantialSpan(output);
  for (const run of unclassifiedRuns(output)) {
    if (!isBoundedByTrustedDocumentRegions(output, run) || !hasAcceptedBoundarySteps(output, run) || runSpan(run) < minimumSpan) continue;
    const zStart = run.segments[0].zStart;
    const zEnd = run.segments.at(-1).zEnd;
    const evidenceId = `fused:regular:${canonical$1(zStart)}-${canonical$1(zEnd)}`;
    output.evidence.push({
      id: evidenceId,
      origin: "fused",
      label: `Post-review regular shaft span bounded by trusted document regions at ${canonical$1(zStart)}–${canonical$1(zEnd)}`,
      geometryNodeIds: [...new Set(run.segments.flatMap(({ geometryNodeIds }) => geometryNodeIds))]
    });
    output.semanticGroups.push({
      id: `group:${evidenceId}`,
      segmentIds: run.segments.map(({ id }) => id),
      range: { zStart, zEnd },
      semanticType: "regular-shaft",
      name: "常规区域",
      evidenceIds: [evidenceId]
    });
    for (const segment of run.segments) {
      segment.semanticType = "regular-shaft";
      segment.name = "常规区域";
      segment.semanticConfidence = Math.min(0.99, segment.boundaryConfidence);
      segment.semanticEvidenceIds.push(evidenceId);
    }
  }
  return output;
}
function unclassifiedRuns(draft) {
  const runs = [];
  for (const [index, segment] of draft.segments.entries()) {
    if (segment.semanticType !== void 0) continue;
    const previous = runs.at(-1);
    if (previous && previous.endIndex === index - 1) {
      previous.segments.push(segment);
      previous.endIndex = index;
    } else {
      runs.push({ segments: [segment], startIndex: index, endIndex: index });
    }
  }
  return runs;
}
function isBoundedByTrustedDocumentRegions(draft, run) {
  const left = draft.segments[run.startIndex - 1];
  const right = draft.segments[run.endIndex + 1];
  if (!left || !right) return false;
  const leftGroup = draft.semanticGroups.find(({ segmentIds }) => segmentIds.includes(left.id));
  const rightGroup = draft.semanticGroups.find(({ segmentIds }) => segmentIds.includes(right.id));
  const tolerance = Math.max((draft.axis.zMax - draft.axis.zMin) * 1e-6, 1e-6);
  return leftGroup !== void 0 && rightGroup !== void 0 && leftGroup.range !== void 0 && rightGroup.range !== void 0 && Math.abs(leftGroup.range.zEnd - run.segments[0].zStart) <= tolerance && Math.abs(rightGroup.range.zStart - run.segments.at(-1).zEnd) <= tolerance && trustedDocumentGroup(draft, leftGroup.evidenceIds) && trustedDocumentGroup(draft, rightGroup.evidenceIds);
}
function trustedDocumentGroup(draft, evidenceIds) {
  const hasDocumentEvidence = evidenceIds.some((id) => {
    var _a3;
    return ((_a3 = draft.evidence.find((item) => item.id === id)) == null ? void 0 : _a3.origin) === "document";
  });
  if (!hasDocumentEvidence) return false;
  return !draft.diagnostics.some((diagnostic2) => {
    var _a3;
    return (diagnostic2.code === "DOCUMENT_REGION_AMBIGUOUS" || diagnostic2.code === "DOCUMENT_REGION_UNMATCHED") && ((_a3 = diagnostic2.evidenceIds) == null ? void 0 : _a3.some((id) => evidenceIds.includes(id)));
  });
}
function hasAcceptedBoundarySteps(draft, run) {
  if (draft.stepCandidates.length === 0) return true;
  const tolerance = Math.max((draft.axis.zMax - draft.axis.zMin) * 1e-6, 1e-6);
  const accepted = (z) => draft.stepCandidates.some((candidate) => candidate.accepted && Math.abs(candidate.z - z) <= tolerance);
  return accepted(run.segments[0].zStart) && accepted(run.segments.at(-1).zEnd);
}
function runSpan(run) {
  return run.segments.at(-1).zEnd - run.segments[0].zStart;
}
function substantialSpan(draft) {
  return Math.max((draft.axis.zMax - draft.axis.zMin) * 0.05, 1e-6);
}
function canonical$1(value) {
  return Number(value.toFixed(6)).toString();
}
function analyzeDimensionChain(input) {
  const intentsById = new Map(input.intents.map((intent) => [intent.id, intent]));
  const tolerancesByIntentId = new Map(input.tolerances.map((tolerance) => [tolerance.dimensionIntentId, tolerance]));
  const diagnostics = [];
  let nominalClosure = 0;
  for (const member of input.chain.members) {
    const intent = intentsById.get(member.dimensionIntentId);
    if (!intent) {
      diagnostics.push(issue$1(input.chain, "DIMENSION_CHAIN_MEMBER_UNKNOWN", "尺寸链引用了不存在的尺寸意图。", member.dimensionIntentId));
      continue;
    }
    nominalClosure += member.coefficient * intent.nominalValue;
  }
  nominalClosure = precise(nominalClosure);
  for (const member of input.chain.members) {
    const intent = intentsById.get(member.dimensionIntentId);
    if (intent && (intent.status === "conflict" || intent.status === "stale")) {
      diagnostics.push(issue$1(input.chain, "DIMENSION_CHAIN_MEMBER_CONFLICT", "尺寸链成员处于冲突或过期状态。", intent.id));
    }
  }
  const base = {
    chainId: input.chain.id,
    analysisMode: input.chain.analysisMode,
    nominalClosure,
    diagnostics
  };
  if (input.chain.analysisMode === "reference-only") return base;
  if (input.chain.analysisMode === "statistical") {
    diagnostics.push(issue$1(
      input.chain,
      "DIMENSION_CHAIN_STATISTICAL_UNSUPPORTED",
      "当前里程碑不支持统计尺寸链分析。",
      input.chain.id
    ));
    return base;
  }
  let lowerDeviation = 0;
  let upperDeviation = 0;
  for (const member of input.chain.members) {
    const intent = intentsById.get(member.dimensionIntentId);
    if (!intent) continue;
    const tolerance = tolerancesByIntentId.get(intent.id);
    const range = toleranceRange(tolerance, intent.nominalValue);
    if (!range) {
      diagnostics.push(issue$1(
        input.chain,
        "DIMENSION_CHAIN_TOLERANCE_MISSING",
        "最坏情况尺寸链分析需要每个成员都有已解析的数值公差。",
        intent.id
      ));
      continue;
    }
    if (member.coefficient === 1) {
      lowerDeviation += range.lower;
      upperDeviation += range.upper;
    } else {
      lowerDeviation -= range.upper;
      upperDeviation -= range.lower;
    }
  }
  lowerDeviation = precise(lowerDeviation);
  upperDeviation = precise(upperDeviation);
  return {
    ...base,
    lowerDeviation,
    upperDeviation,
    lowerValue: precise(nominalClosure + lowerDeviation),
    upperValue: precise(nominalClosure + upperDeviation)
  };
}
function toleranceRange(tolerance, nominalValue) {
  if (!tolerance || !["resolved", "confirmed"].includes(tolerance.status) || !tolerance.resolved) return void 0;
  const resolved = tolerance.resolved;
  switch (tolerance.mode) {
    case "bilateral":
      return finiteRange(resolved.lowerDeviation, resolved.upperDeviation);
    case "unilateral":
      return finiteRange(resolved.lowerDeviation ?? 0, resolved.upperDeviation ?? 0);
    case "limits":
      return finiteRange(
        resolved.lowerLimit === void 0 ? void 0 : resolved.lowerLimit - nominalValue,
        resolved.upperLimit === void 0 ? void 0 : resolved.upperLimit - nominalValue
      );
    case "fit":
    case "formula":
      return void 0;
  }
}
function finiteRange(lower, upper) {
  if (lower === void 0 || upper === void 0 || !Number.isFinite(lower) || !Number.isFinite(upper) || lower > upper) return void 0;
  return { lower, upper };
}
function precise(value) {
  return Number(value.toPrecision(12));
}
function issue$1(chain, code, message, entityId) {
  return {
    id: `${chain.id}:${code}:${entityId}`,
    severity: "error",
    code,
    message,
    entityIds: [entityId],
    evidenceIds: [...chain.evidenceIds]
  };
}
function buildAxialTopology(input) {
  const { partition } = input;
  const length = partition.axis.zMax - partition.axis.zMin;
  const tolerance = input.coordinateTolerance ?? Math.max(Math.abs(length) * 1e-5, 1e-6);
  const boundaries = collectBoundaryEvidence(partition);
  if (boundaries.some(({ z }) => !Number.isFinite(z))) throw new Error("DIMENSION_STATION_UNRESOLVED");
  const stations = mergeBoundaries(boundaries, partition.axis.zMin, input.unit ?? "mm", tolerance);
  const elementarySpans = consecutiveSpans(stations, partition, tolerance);
  return {
    drawingRef: partition.drawingRef,
    axis: structuredClone(partition.axis),
    unit: input.unit ?? "mm",
    stations,
    elementarySpans
  };
}
function collectBoundaryEvidence(partition) {
  const output = [
    { z: partition.axis.zMin, kinds: ["drawing-end"], geometryNodeIds: [], evidenceIds: ["axis:start"] },
    { z: partition.axis.zMax, kinds: ["drawing-end"], geometryNodeIds: [], evidenceIds: ["axis:end"] }
  ];
  for (const segment of partition.segments) {
    output.push({
      z: segment.zStart,
      kinds: ["partition-boundary"],
      geometryNodeIds: segment.geometryNodeIds,
      evidenceIds: segment.boundaryEvidenceIds
    }, {
      z: segment.zEnd,
      kinds: ["partition-boundary"],
      geometryNodeIds: segment.geometryNodeIds,
      evidenceIds: segment.boundaryEvidenceIds
    });
  }
  for (const group of partition.semanticGroups) {
    if (!group.range) continue;
    for (const z of [group.range.zStart, group.range.zEnd]) {
      output.push({
        z,
        kinds: ["partition-boundary"],
        geometryNodeIds: partition.segments.filter(({ id }) => group.segmentIds.includes(id)).flatMap(({ geometryNodeIds }) => geometryNodeIds),
        evidenceIds: [group.id, ...group.evidenceIds]
      });
    }
  }
  if ("stepCandidates" in partition) {
    for (const step of partition.stepCandidates.filter(({ accepted }) => accepted)) {
      output.push({ z: step.z, kinds: ["shoulder"], geometryNodeIds: [], evidenceIds: [step.id, ...step.evidenceIds] });
    }
  }
  return output;
}
function mergeBoundaries(values, zMin, unit, tolerance) {
  const groups = [];
  for (const value of [...values].sort((left, right) => left.z - right.z)) {
    const group = groups.at(-1);
    if (group && Math.abs(value.z - average(group.map(({ z }) => z))) <= tolerance) group.push(value);
    else groups.push([value]);
  }
  return groups.map((group) => {
    const sourceCoordinate = average(group.map(({ z }) => z));
    const coordinate = canonicalEngineeringCoordinate(sourceCoordinate - zMin);
    return {
      id: `station:${formatCoordinate(coordinate)}`,
      coordinate,
      sourceCoordinate: canonicalSourceCoordinate(sourceCoordinate),
      unit,
      kinds: unique$4(group.flatMap(({ kinds }) => kinds)).sort(kindOrder),
      geometryNodeIds: unique$4(group.flatMap(({ geometryNodeIds }) => geometryNodeIds)).sort(),
      evidenceIds: unique$4(group.flatMap(({ evidenceIds }) => evidenceIds)).sort()
    };
  });
}
function consecutiveSpans(stations, partition, tolerance) {
  return stations.slice(0, -1).map((start2, index) => {
    const end2 = stations[index + 1];
    const nominalValue = canonicalEngineeringCoordinate(end2.coordinate - start2.coordinate);
    if (nominalValue <= tolerance) throw new Error("DIMENSION_STATION_CONFLICT");
    const midpoint = (start2.sourceCoordinate + end2.sourceCoordinate) / 2;
    const segments = partition.segments.filter(({ zStart, zEnd }) => midpoint >= Math.min(zStart, zEnd) - tolerance && midpoint <= Math.max(zStart, zEnd) + tolerance);
    return {
      id: `span:${start2.id}:${end2.id}`,
      startStationId: start2.id,
      endStationId: end2.id,
      nominalValue,
      segmentIds: segments.map(({ id }) => id).sort(),
      evidenceIds: unique$4([
        ...start2.evidenceIds,
        ...end2.evidenceIds,
        ...segments.flatMap(({ boundaryEvidenceIds }) => boundaryEvidenceIds)
      ]).sort()
    };
  });
}
function kindOrder(left, right) {
  const order = ["drawing-end", "shoulder", "partition-boundary", "datum"];
  return order.indexOf(left) - order.indexOf(right);
}
function unique$4(values) {
  return [...new Set(values)];
}
function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function canonicalSourceCoordinate(value) {
  return Number(value.toFixed(6));
}
function canonicalEngineeringCoordinate(value) {
  return Number(value.toFixed(3));
}
function formatCoordinate(value) {
  return canonicalEngineeringCoordinate(value).toString();
}
function generateAxialDimensionCandidates(input) {
  var _a3;
  const accumulator = new CandidateAccumulator(input.topology);
  for (const span of input.topology.elementarySpans) {
    accumulator.add(span.startStationId, span.endStationId, "local", elementaryEvidence(span));
  }
  for (const group of input.partition.semanticGroups) addFunctionalInterval(accumulator, group);
  for (const region of ((_a3 = input.document) == null ? void 0 : _a3.regions) ?? []) addDocumentInterval(accumulator, region, input.partition);
  const envelopes = deriveProcessEnvelopes(input.partition, input.topology);
  for (const envelope of envelopes) {
    accumulator.add(envelope.startStationId, envelope.endStationId, "process", envelope.evidence);
  }
  for (let index = 1; index < envelopes.length; index += 1) {
    const previous = envelopes[index - 1];
    const current = envelopes[index];
    if (previous.endStationId === current.endStationId) continue;
    accumulator.add(previous.endStationId, current.endStationId, "composite", {
      id: `partition:hierarchy:${previous.groupId}:${current.groupId}`,
      origin: "partition",
      kind: "process-envelope",
      label: "相邻关键功能包络",
      required: false,
      sourceIds: [previous.groupId, current.groupId]
    });
  }
  const first = input.topology.stations[0];
  const last = input.topology.stations.at(-1);
  if (first && last) {
    accumulator.add(first.id, last.id, "overall", {
      id: "geometry:drawing-overall",
      origin: "geometry",
      kind: "drawing-end",
      label: "零件轴向总长",
      required: true,
      sourceIds: [first.id, last.id]
    });
  }
  for (const [index, interval] of (input.manualIntervals ?? []).entries()) {
    const resolved = resolveCoordinates(input.topology, interval.start, interval.end);
    const evidenceId = `manual:interval:${index}`;
    if (!resolved) {
      accumulator.problem("DIMENSION_STATION_UNRESOLVED", evidenceId);
      continue;
    }
    accumulator.add(resolved.startStationId, resolved.endStationId, "reference", {
      id: evidenceId,
      origin: "manual",
      kind: "manual-requirement",
      label: interval.label,
      required: true,
      sourceIds: []
    });
  }
  return accumulator.result();
}
class CandidateAccumulator {
  constructor(topology) {
    __privateAdd(this, _CandidateAccumulator_instances);
    __privateAdd(this, _candidates, /* @__PURE__ */ new Map());
    __privateAdd(this, _evidence, /* @__PURE__ */ new Map());
    __privateAdd(this, _diagnostics, []);
    __privateAdd(this, _stations);
    this.topology = topology;
    __privateSet(this, _stations, new Map(topology.stations.map(({ id, coordinate }) => [id, coordinate])));
  }
  add(startStationId, endStationId, role, evidence) {
    const ordered = __privateMethod(this, _CandidateAccumulator_instances, ordered_fn).call(this, startStationId, endStationId);
    if (!ordered) {
      this.problem("DIMENSION_STATION_UNRESOLVED", evidence.id);
      return;
    }
    __privateGet(this, _evidence).set(evidence.id, structuredClone(evidence));
    const key = `${ordered.startStationId}:${ordered.endStationId}`;
    const existing = __privateGet(this, _candidates).get(key);
    if (existing) {
      existing.roles = unique$3([...existing.roles, role]).sort();
      existing.evidenceIds = unique$3([...existing.evidenceIds, evidence.id]).sort();
      existing.required || (existing.required = evidence.required);
      return;
    }
    __privateGet(this, _candidates).set(key, {
      id: `candidate:${key}`,
      ...ordered,
      nominalValue: canonical(__privateGet(this, _stations).get(ordered.endStationId) - __privateGet(this, _stations).get(ordered.startStationId)),
      roles: [role],
      evidenceIds: [evidence.id],
      required: evidence.required
    });
  }
  problem(code, evidenceId) {
    __privateGet(this, _diagnostics).push({
      id: `dimension-candidate:${code}:${evidenceId}`,
      severity: "warning",
      code,
      message: `Unable to resolve dimension evidence ${evidenceId}`,
      evidenceIds: [evidenceId]
    });
  }
  result() {
    return {
      candidates: [...__privateGet(this, _candidates).values()].sort(candidateOrder),
      evidence: [...__privateGet(this, _evidence).values()].sort((left, right) => left.id.localeCompare(right.id)),
      diagnostics: [...__privateGet(this, _diagnostics)].sort((left, right) => left.id.localeCompare(right.id))
    };
  }
}
_candidates = new WeakMap();
_evidence = new WeakMap();
_diagnostics = new WeakMap();
_stations = new WeakMap();
_CandidateAccumulator_instances = new WeakSet();
ordered_fn = function(startStationId, endStationId) {
  const start2 = __privateGet(this, _stations).get(startStationId);
  const end2 = __privateGet(this, _stations).get(endStationId);
  if (start2 === void 0 || end2 === void 0 || start2 === end2) return void 0;
  return start2 < end2 ? { startStationId, endStationId } : { startStationId: endStationId, endStationId: startStationId };
};
function addFunctionalInterval(accumulator, group) {
  if (!group.range) return;
  const resolved = resolveCoordinates(accumulator.topology, group.range.zStart, group.range.zEnd);
  const evidence = {
    id: `partition:group:${group.id}`,
    origin: "partition",
    kind: "functional-region",
    label: group.name ?? group.semanticType,
    required: false,
    sourceIds: [group.id, ...group.evidenceIds]
  };
  if (!resolved) {
    accumulator.problem("DIMENSION_STATION_UNRESOLVED", evidence.id);
    return;
  }
  accumulator.add(resolved.startStationId, resolved.endStationId, "functional", evidence);
}
function addDocumentInterval(accumulator, region, partition) {
  if (!region.interval) return;
  const evidence = {
    id: `document:region:${region.id}`,
    origin: "document",
    kind: "document-interval",
    label: region.name ?? region.type,
    required: true,
    sourceIds: region.sourceLines.map((line) => `document:line:${line}`)
  };
  const resolved = resolveCoordinates(accumulator.topology, region.interval.start, region.interval.end) ?? resolveFusedSemanticInterval(accumulator.topology, partition, region);
  if (!resolved) {
    accumulator.problem("DIMENSION_STATION_UNRESOLVED", evidence.id);
    return;
  }
  accumulator.add(resolved.startStationId, resolved.endStationId, "functional", evidence);
}
function resolveFusedSemanticInterval(topology, partition, region) {
  if (!region.interval) return void 0;
  const documentWidth = Math.abs(region.interval.end - region.interval.start);
  const match = partition.semanticGroups.find((group) => {
    if (!group.range || group.name !== region.name && group.semanticType !== region.type) return false;
    const groupWidth = Math.abs(group.range.zEnd - group.range.zStart);
    return Math.abs(groupWidth - documentWidth) <= Math.max(documentWidth * 1e-5, 1e-6);
  });
  return (match == null ? void 0 : match.range) ? resolveCoordinates(topology, match.range.zStart, match.range.zEnd) : void 0;
}
function deriveProcessEnvelopes(partition, topology) {
  const functionalSegmentIds = new Set(partition.semanticGroups.filter(({ semanticType }) => semanticType !== "regular-shaft").flatMap(({ segmentIds }) => segmentIds));
  const output = [];
  for (const group of partition.semanticGroups) {
    if (!group.range || group.semanticType === "bearing" || group.semanticType === "regular-shaft") continue;
    const width = Math.abs(group.range.zEnd - group.range.zStart);
    const next = partition.segments.find(({ zStart, id }) => Math.abs(zStart - group.range.zEnd) <= coordinateTolerance(topology) && !functionalSegmentIds.has(id));
    if (!next || Math.abs(next.zEnd - next.zStart) > width * 0.25) continue;
    const resolved = resolveCoordinates(topology, group.range.zStart, next.zEnd);
    if (!resolved) continue;
    output.push({
      ...resolved,
      groupId: group.id,
      evidence: {
        id: `partition:process-envelope:${group.id}`,
        origin: "partition",
        kind: "process-envelope",
        label: `${group.name ?? group.semanticType}工艺包络`,
        required: false,
        sourceIds: [group.id, next.id, ...next.boundaryEvidenceIds]
      }
    });
  }
  return output.sort((left, right) => stationCoordinate(topology, left.startStationId) - stationCoordinate(topology, right.startStationId));
}
function elementaryEvidence(span) {
  return {
    id: `geometry:${span.id}`,
    origin: "geometry",
    kind: "elementary-span",
    label: "相邻轴向台阶",
    required: false,
    sourceIds: [span.id, ...span.evidenceIds]
  };
}
function resolveCoordinates(topology, start2, end2) {
  const tolerance = coordinateTolerance(topology);
  const first = topology.stations.find(({ coordinate }) => Math.abs(coordinate - Math.min(start2, end2)) <= tolerance);
  const second = topology.stations.find(({ coordinate }) => Math.abs(coordinate - Math.max(start2, end2)) <= tolerance);
  return first && second && first.id !== second.id ? { startStationId: first.id, endStationId: second.id } : void 0;
}
function coordinateTolerance(topology) {
  var _a3;
  const length = ((_a3 = topology.stations.at(-1)) == null ? void 0 : _a3.coordinate) ?? 1;
  return Math.max(Math.abs(length) * 1e-5, 1e-6);
}
function stationCoordinate(topology, id) {
  var _a3;
  return ((_a3 = topology.stations.find((station) => station.id === id)) == null ? void 0 : _a3.coordinate) ?? Number.POSITIVE_INFINITY;
}
function candidateOrder(left, right) {
  return left.startStationId.localeCompare(right.startStationId) || left.endStationId.localeCompare(right.endStationId);
}
function unique$3(values) {
  return [...new Set(values)];
}
function canonical(value) {
  return Number(value.toFixed(6));
}
const COMMON_WEIGHTS = {
  "manual-required": 120,
  "document-exact": 100,
  "functional-region": 70,
  "process-envelope": 55,
  "composite-block": 60,
  "overall-root": 90,
  "elementary-span": 20,
  "ordinary-residual": 15,
  "terminal-residual": 5
};
const SHAFT_HIERARCHICAL_DIMENSIONING_V1 = {
  id: "shaft-hierarchical-dimensioning-v1",
  version: "1",
  weights: COMMON_WEIGHTS,
  ambiguityMargin: 12,
  preferTerminalRootClosure: false
};
const SHAFT_REFERENCE_TERMINAL_CLOSURE_V1 = {
  id: "shaft-reference-terminal-closure-v1",
  version: "1",
  weights: COMMON_WEIGHTS,
  ambiguityMargin: 0,
  preferTerminalRootClosure: true
};
function policyById(id) {
  return id === SHAFT_REFERENCE_TERMINAL_CLOSURE_V1.id ? SHAFT_REFERENCE_TERMINAL_CLOSURE_V1 : SHAFT_HIERARCHICAL_DIMENSIONING_V1;
}
function validateAxialDimensionScheme(scheme) {
  const diagnostics = [];
  const candidates = new Map(scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const displayed = new Set(scheme.displayedCandidateIds);
  const closures = new Set(scheme.closureCandidateIds);
  const selected = scheme.displayedCandidateIds.flatMap((id) => candidates.get(id) ?? []);
  for (const [index, left] of selected.entries()) {
    for (const right of selected.slice(index + 1)) {
      if (crosses(left, right, scheme)) diagnostics.push(problem$1("DIMENSION_CANDIDATE_CROSSES_SELECTED", [left.id, right.id]));
    }
  }
  for (const chain of scheme.chains) {
    const parent = candidates.get(chain.parentCandidateId);
    const closure = candidates.get(chain.closureCandidateId);
    const children = chain.childCandidateIds.map((id) => candidates.get(id));
    if (!parent || !closure || children.some((candidate) => !candidate)) {
      diagnostics.push(problem$1("DIMENSION_CLOSURE_MISSING", [chain.id]));
      continue;
    }
    if (!displayed.has(parent.id) || chain.childCandidateIds.some((id) => !displayed.has(id)) || displayed.has(closure.id) || !closures.has(closure.id)) {
      diagnostics.push(problem$1("DIMENSION_CHAIN_INCOMPLETE", [chain.id]));
    }
    const childTotal = children.reduce((sum, candidate) => sum + candidate.nominalValue, 0);
    const difference = Math.abs(parent.nominalValue - childTotal - closure.nominalValue);
    if (difference > Math.max(parent.nominalValue * 1e-8, 1e-6)) {
      diagnostics.push(problem$1("DIMENSION_CHAIN_ARITHMETIC_MISMATCH", [chain.id]));
    }
  }
  return dedupe$2(diagnostics);
}
function crosses(left, right, scheme) {
  const coordinate = new Map(scheme.topology.stations.map(({ id, coordinate: coordinate2 }) => [id, coordinate2]));
  const [a, b] = [coordinate.get(left.startStationId), coordinate.get(left.endStationId)];
  const [c, d] = [coordinate.get(right.startStationId), coordinate.get(right.endStationId)];
  return a < c && c < b && b < d || c < a && a < d && d < b;
}
function problem$1(code, entityIds) {
  return { id: `dimension-scheme:${code}:${entityIds.join(":")}`, severity: "error", code, message: code, entityIds };
}
function dedupe$2(diagnostics) {
  return [...new Map(diagnostics.map((item) => [item.id, item])).values()].sort((left, right) => left.id.localeCompare(right.id));
}
function inferAxialDimensionScheme(input) {
  const index = coordinateIndex(input);
  const root = requireOverall(input.candidateSet.candidates);
  const decisions = input.candidateSet.candidates.map((candidate) => scoreCandidate(candidate, input.candidateSet.evidence, input.policy.weights));
  const terminal = terminalCandidates(root, input.candidateSet.candidates, index);
  if (terminal.length === 0) throw new Error("DIMENSION_CLOSURE_MISSING");
  const rootClosure = terminal.at(-1);
  const leftChildren = solveCoverage(root.startStationId, rootClosure.startStationId, root, input.candidateSet.candidates, decisions, index);
  const rightChildren = solveCoverage(rootClosure.endStationId, root.endStationId, root, input.candidateSet.candidates, decisions, index);
  const rootChildren = [...leftChildren, ...rightChildren];
  const chains = [{
    id: `chain:${root.id}`,
    parentCandidateId: root.id,
    childCandidateIds: rootChildren.map(({ id }) => id),
    closureCandidateId: rootClosure.id,
    alternativeClosureCandidateIds: input.policy.preferTerminalRootClosure ? [] : viableRootClosureAlternatives(root, rootClosure, input.candidateSet.candidates, decisions, index).map(({ id }) => id),
    status: input.policy.preferTerminalRootClosure ? "resolved" : "needs-review"
  }];
  for (const parent of rootChildren.filter((candidate) => candidate.roles.some((role) => role === "process" || role === "composite"))) {
    const chain = materializeInnerChain(parent, input.candidateSet.candidates, input.candidateSet.evidence, index);
    if (chain) chains.push(chain);
  }
  const displayedCandidateIds = unique$2([
    root.id,
    ...chains.flatMap(({ childCandidateIds }) => childCandidateIds),
    ...chains.slice(1).map(({ parentCandidateId }) => parentCandidateId)
  ]);
  const closureCandidateIds = unique$2(chains.map(({ closureCandidateId }) => closureCandidateId));
  const diagnostics = [...input.candidateSet.diagnostics];
  if (!input.policy.preferTerminalRootClosure) {
    diagnostics.push({
      id: `dimension-scheme:DIMENSION_CLOSURE_AMBIGUOUS:${root.id}`,
      severity: "warning",
      code: "DIMENSION_CLOSURE_AMBIGUOUS",
      message: "The root closure follows a drafting convention that requires review.",
      entityIds: [root.id]
    });
  }
  for (const closureId of closureCandidateIds) {
    const closure = index.candidate.get(closureId);
    const documentEvidence = closure.evidenceIds.filter((id) => {
      var _a3;
      return ((_a3 = input.candidateSet.evidence.find((item) => item.id === id)) == null ? void 0 : _a3.origin) === "document";
    });
    if (documentEvidence.length > 0) diagnostics.push({
      id: `dimension-scheme:DIMENSION_DOCUMENT_DISPLAY_CONFLICT:${closure.id}`,
      severity: "warning",
      code: "DIMENSION_DOCUMENT_DISPLAY_CONFLICT",
      message: "A document-backed interval is used as an unmarked closure by the selected drafting policy.",
      entityIds: [closure.id],
      evidenceIds: documentEvidence
    });
  }
  const initial = {
    version: 1,
    drawingRef: input.topology.drawingRef,
    ...input.partitionRevisionId === void 0 ? {} : { partitionRevisionId: input.partitionRevisionId },
    policy: { id: input.policy.id, version: input.policy.version },
    inputDigest: digestInput(input),
    topology: structuredClone(input.topology),
    evidence: structuredClone(input.candidateSet.evidence),
    candidates: structuredClone(input.candidateSet.candidates),
    displayedCandidateIds,
    closureCandidateIds,
    chains,
    decisions: decisions.map((decision) => ({
      ...decision,
      decision: displayedCandidateIds.includes(decision.candidateId) ? "displayed" : closureCandidateIds.includes(decision.candidateId) ? "closure" : chains.some(({ alternativeClosureCandidateIds }) => alternativeClosureCandidateIds.includes(decision.candidateId)) ? "alternative" : "rejected"
    })),
    diagnostics: [],
    status: input.policy.preferTerminalRootClosure ? "resolved" : "needs-review"
  };
  const validation = validateAxialDimensionScheme(initial);
  return {
    ...initial,
    diagnostics: dedupe$1([...diagnostics, ...validation]),
    status: validation.length > 0 ? "conflict" : initial.status
  };
}
function materializeInnerChain(parent, candidates, evidence, index) {
  const inside = candidates.filter((candidate) => candidate.id !== parent.id && contains(parent, candidate, index));
  const protectedCandidates = inside.filter((candidate) => candidate.roles.includes("functional") || candidate.evidenceIds.some((id) => {
    var _a3;
    return ((_a3 = evidence.find((item) => item.id === id)) == null ? void 0 : _a3.origin) === "document";
  })).sort((left, right) => start(left, index) - start(right, index));
  const elementary = inside.filter((candidate) => candidate.roles.includes("local")).sort((left, right) => start(left, index) - start(right, index));
  const uncovered = elementary.filter((candidate) => !protectedCandidates.some((protectedCandidate) => contains(protectedCandidate, candidate, index)));
  if (uncovered.length === 0) return void 0;
  const closure = [...uncovered].sort((left, right) => right.nominalValue - left.nominalValue || start(left, index) - start(right, index))[0];
  const children = uniqueCandidates([
    ...protectedCandidates,
    ...uncovered.filter(({ id }) => id !== closure.id)
  ]).sort((left, right) => start(left, index) - start(right, index));
  if (!coversParent(parent, children, closure, index)) return void 0;
  return {
    id: `chain:${parent.id}`,
    parentCandidateId: parent.id,
    childCandidateIds: children.map(({ id }) => id),
    closureCandidateId: closure.id,
    alternativeClosureCandidateIds: [],
    status: "resolved"
  };
}
function solveCoverage(startStationId, endStationId, root, candidates, decisions, index) {
  if (startStationId === endStationId) return [];
  const targetEnd = index.station.get(endStationId);
  const score2 = new Map(decisions.map((decision) => [decision.candidateId, decision.score]));
  const memo = /* @__PURE__ */ new Map();
  const visit = (stationId) => {
    if (stationId === endStationId) return [];
    if (memo.has(stationId)) return memo.get(stationId);
    const options = candidates.filter((candidate) => candidate.id !== root.id && candidate.startStationId === stationId && index.station.get(candidate.endStationId) <= targetEnd);
    let best = null;
    for (const candidate of options) {
      const rest = visit(candidate.endStationId);
      if (!rest) continue;
      const proposal = [candidate, ...rest];
      if (!best || proposal.length < best.length || proposal.length === best.length && totalScore(proposal, score2) > totalScore(best, score2)) best = proposal;
    }
    memo.set(stationId, best);
    return best;
  };
  const result = visit(startStationId);
  if (!result) throw new Error("DIMENSION_CHAIN_INCOMPLETE");
  return result;
}
function viableRootClosureAlternatives(root, selected, candidates, decisions, index) {
  return candidates.filter((candidate) => {
    if (candidate.id === root.id || candidate.id === selected.id || !contains(root, candidate, index)) return false;
    try {
      solveCoverage(root.startStationId, candidate.startStationId, root, candidates, decisions, index);
      solveCoverage(candidate.endStationId, root.endStationId, root, candidates, decisions, index);
      return true;
    } catch {
      return false;
    }
  }).sort((left, right) => scoreOf(right, decisions) - scoreOf(left, decisions)).slice(0, 3);
}
function terminalCandidates(root, candidates, index) {
  return candidates.filter((candidate) => candidate.id !== root.id && candidate.endStationId === root.endStationId && contains(root, candidate, index)).sort((left, right) => start(left, index) - start(right, index));
}
function scoreCandidate(candidate, evidence, weights) {
  const features = candidate.evidenceIds.flatMap((id) => {
    const item = evidence.find((entry) => entry.id === id);
    if (!item) return [];
    const feature = featureFor(item, candidate);
    return [{ feature, contribution: weights[feature], evidenceIds: [id] }];
  });
  return {
    candidateId: candidate.id,
    decision: "rejected",
    score: features.reduce((sum, item) => sum + item.contribution, 0),
    features,
    reasonCodes: unique$2(features.map(({ feature }) => `DIMENSION_SCORE_${feature.toUpperCase().replace(/-/g, "_")}`))
  };
}
function featureFor(evidence, candidate) {
  if (evidence.origin === "manual") return "manual-required";
  if (evidence.origin === "document") return "document-exact";
  if (candidate.roles.includes("overall")) return "overall-root";
  if (candidate.roles.includes("composite")) return "composite-block";
  if (candidate.roles.includes("process")) return "process-envelope";
  if (candidate.roles.includes("functional")) return "functional-region";
  return "elementary-span";
}
function requireOverall(candidates) {
  const root = candidates.find(({ roles }) => roles.includes("overall"));
  if (!root) throw new Error("DIMENSION_CHAIN_INCOMPLETE");
  return root;
}
function coordinateIndex(input) {
  return {
    station: new Map(input.topology.stations.map(({ id, coordinate }) => [id, coordinate])),
    candidate: new Map(input.candidateSet.candidates.map((candidate) => [candidate.id, candidate]))
  };
}
function contains(parent, child, index) {
  return start(parent, index) <= start(child, index) && end(child, index) <= end(parent, index);
}
function coversParent(parent, children, closure, index) {
  var _a3, _b;
  const intervals = [...children, closure].sort((left, right) => start(left, index) - start(right, index));
  return ((_a3 = intervals[0]) == null ? void 0 : _a3.startStationId) === parent.startStationId && ((_b = intervals.at(-1)) == null ? void 0 : _b.endStationId) === parent.endStationId && intervals.every((item, itemIndex) => itemIndex === 0 || intervals[itemIndex - 1].endStationId === item.startStationId);
}
function start(candidate, index) {
  return index.station.get(candidate.startStationId);
}
function end(candidate, index) {
  return index.station.get(candidate.endStationId);
}
function totalScore(candidates, scores) {
  return candidates.reduce((sum, candidate) => sum + (scores.get(candidate.id) ?? 0), 0);
}
function scoreOf(candidate, decisions) {
  var _a3;
  return ((_a3 = decisions.find(({ candidateId }) => candidateId === candidate.id)) == null ? void 0 : _a3.score) ?? 0;
}
function unique$2(values) {
  return [...new Set(values)];
}
function uniqueCandidates(values) {
  return [...new Map(values.map((value) => [value.id, value])).values()];
}
function dedupe$1(values) {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort((left, right) => left.id.localeCompare(right.id));
}
function digestInput(input) {
  const value = JSON.stringify({
    drawingRef: input.topology.drawingRef,
    stations: input.topology.stations.map(({ id, coordinate }) => [id, coordinate]),
    candidates: input.candidateSet.candidates.map(({ id, evidenceIds }) => [id, evidenceIds]),
    policy: [input.policy.id, input.policy.version]
  });
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function projectAxialDimensionScheme(input) {
  const candidateIds = unique$1([
    ...input.scheme.displayedCandidateIds,
    ...input.scheme.closureCandidateIds,
    ...input.scheme.chains.flatMap(({ parentCandidateId, childCandidateIds, closureCandidateId }) => [parentCandidateId, ...childCandidateIds, closureCandidateId])
  ]);
  const candidates = new Map(input.scheme.candidates.map((candidate) => [candidate.id, candidate]));
  const intents = candidateIds.map((id) => projectIntent(requireCandidate$1(candidates, id), input.scheme));
  const intentByCandidate = new Map(candidateIds.map((id) => [id, intentId(id)]));
  const chains = input.scheme.chains.map((chain) => projectChain(chain, input.scheme, intentByCandidate));
  const dependencies = projectDependencies(input.scheme, intentByCandidate);
  return {
    version: 1,
    drawingRef: input.scheme.drawingRef,
    datums: [],
    intents,
    tolerances: [],
    chains,
    dependencies,
    diagnostics: structuredClone(input.scheme.diagnostics),
    axialScheme: structuredClone(input.scheme),
    ...input.baseRevisionId === void 0 ? {} : { baseRevisionId: input.baseRevisionId }
  };
}
function projectIntent(candidate, scheme) {
  var _a3;
  const start2 = scheme.topology.stations.find(({ id }) => id === candidate.startStationId);
  const end2 = scheme.topology.stations.find(({ id }) => id === candidate.endStationId);
  if (!start2 || !end2) throw new Error("DIMENSION_STATION_UNRESOLVED");
  const fallback = (_a3 = scheme.topology.axis.geometryNodeIds) == null ? void 0 : _a3[0];
  const startGeometryId = start2.geometryNodeIds[0] ?? fallback;
  const endGeometryId = end2.geometryNodeIds[0] ?? fallback;
  if (!startGeometryId || !endGeometryId) throw new Error("DIMENSION_TARGET_STALE");
  const closure = scheme.closureCandidateIds.includes(candidate.id);
  return {
    id: intentId(candidate.id),
    drawingRef: scheme.drawingRef,
    kind: "linear",
    targets: [
      { geometryId: startGeometryId, anchor: { kind: "nearest", point: worldPoint(scheme, start2.sourceCoordinate) } },
      { geometryId: endGeometryId, anchor: { kind: "nearest", point: worldPoint(scheme, end2.sourceCoordinate) } }
    ],
    datumIds: [],
    nominalValue: candidate.nominalValue,
    unit: scheme.topology.unit,
    functionalRole: closure ? "closure" : functionalRole(candidate),
    source: "geometry",
    status: scheme.status === "conflict" || scheme.status === "stale" ? scheme.status : "resolved",
    evidenceIds: [...candidate.evidenceIds]
  };
}
function projectChain(chain, scheme, intentByCandidate) {
  const parentIntentId = requireIntent(intentByCandidate, chain.parentCandidateId);
  const closureIntentId = requireIntent(intentByCandidate, chain.closureCandidateId);
  return {
    id: chain.id,
    drawingRef: scheme.drawingRef,
    name: axialChainName(chain, scheme),
    datumIds: [],
    members: [
      { dimensionIntentId: parentIntentId, coefficient: 1, role: "functional", sequenceHint: 0 },
      ...chain.childCandidateIds.map((candidateId, index) => ({
        dimensionIntentId: requireIntent(intentByCandidate, candidateId),
        coefficient: -1,
        role: "component",
        sequenceHint: index + 1
      })),
      { dimensionIntentId: closureIntentId, coefficient: -1, role: "closure", sequenceHint: chain.childCandidateIds.length + 1 }
    ],
    equation: { closureIntentId, targetValue: 0 },
    analysisMode: "reference-only",
    status: chain.status === "conflict" ? "conflict" : chain.status === "needs-review" ? "candidate" : "resolved",
    evidenceIds: unique$1([
      ...requireCandidate$1(new Map(scheme.candidates.map((candidate) => [candidate.id, candidate])), chain.parentCandidateId).evidenceIds,
      ...chain.childCandidateIds.flatMap((id) => requireCandidate$1(new Map(scheme.candidates.map((candidate) => [candidate.id, candidate])), id).evidenceIds)
    ]),
    diagnostics: scheme.diagnostics.filter(({ entityIds }) => entityIds == null ? void 0 : entityIds.includes(chain.id))
  };
}
function projectDependencies(scheme, intentByCandidate) {
  const dependencies = [];
  for (const chain of scheme.chains) {
    const parentIntentId = requireIntent(intentByCandidate, chain.parentCandidateId);
    const closureIntentId = requireIntent(intentByCandidate, chain.closureCandidateId);
    for (const childCandidateId of chain.childCandidateIds) {
      const childIntentId = requireIntent(intentByCandidate, childCandidateId);
      dependencies.push({
        beforeIntentId: parentIntentId,
        afterIntentId: childIntentId,
        reason: "functional-before-component",
        evidenceIds: [chain.id]
      }, {
        beforeIntentId: childIntentId,
        afterIntentId: closureIntentId,
        reason: "component-before-closure",
        evidenceIds: [chain.id]
      });
    }
  }
  return [...new Map(dependencies.map((item) => [`${item.beforeIntentId}:${item.afterIntentId}`, item])).values()];
}
function functionalRole(candidate) {
  if (candidate.roles.includes("overall")) return "overall";
  if (candidate.roles.includes("functional")) return "functional";
  if (candidate.roles.includes("composite")) return "assembly";
  return "process";
}
function worldPoint(scheme, sourceCoordinate) {
  const { origin, direction } = scheme.topology.axis;
  return [origin[0] + direction[0] * sourceCoordinate, origin[1] + direction[1] * sourceCoordinate];
}
function axialChainName(chain, scheme) {
  const parent = scheme.candidates.find(({ id }) => id === chain.parentCandidateId);
  return `轴向尺寸链 ${format(parent.nominalValue)} ${scheme.topology.unit}`;
}
function intentId(candidateId) {
  return `dimension-intent:${candidateId}`;
}
function requireIntent(values, candidateId) {
  const value = values.get(candidateId);
  if (!value) throw new Error("DIMENSION_CHAIN_MEMBER_UNKNOWN");
  return value;
}
function requireCandidate$1(values, id) {
  const value = values.get(id);
  if (!value) throw new Error("DIMENSION_CHAIN_MEMBER_UNKNOWN");
  return value;
}
function unique$1(values) {
  return [...new Set(values)].sort();
}
function format(value) {
  return Number(value.toFixed(6)).toString();
}
function applyDimensionSchemeEdit(scheme, command) {
  const candidate = scheme.candidates.find(({ id }) => id === command.candidateId);
  if (!candidate) throw new Error("DIMENSION_CANDIDATE_UNKNOWN");
  const edited = command.type === "candidate.display" ? setCandidateDisplayed(scheme, candidate.id, command.displayed) : command.type === "closure.choose" ? chooseChainClosure(scheme, command.chainId, candidate) : setCandidateNormalOffset(scheme, candidate.id, command.normalOffset);
  const validation = validateAxialDimensionScheme(edited);
  const diagnostics = dedupe([
    ...edited.diagnostics.filter(({ code }) => !isDerivedValidationCode(code)),
    ...validation
  ]);
  return {
    ...edited,
    diagnostics,
    status: validation.some(({ severity }) => severity === "error") ? "conflict" : edited.status
  };
}
function setCandidateNormalOffset(scheme, candidateId, normalOffset) {
  var _a3;
  if (!Number.isFinite(normalOffset)) throw new Error("DIMENSION_LAYOUT_OFFSET_INVALID");
  const current = ((_a3 = scheme.layout) == null ? void 0 : _a3.candidateNormalOffsets) ?? [];
  return {
    ...structuredClone(scheme),
    layout: {
      candidateNormalOffsets: [
        ...current.filter((item) => item.candidateId !== candidateId),
        { candidateId, normalOffset }
      ]
    }
  };
}
function setCandidateDisplayed(scheme, candidateId, displayed) {
  const displayedCandidateIds = displayed ? unique([...scheme.displayedCandidateIds, candidateId]) : scheme.displayedCandidateIds.filter((id) => id !== candidateId);
  return {
    ...structuredClone(scheme),
    displayedCandidateIds,
    decisions: updateDecisions(scheme.decisions, displayedCandidateIds, scheme.closureCandidateIds, scheme.chains)
  };
}
function chooseChainClosure(scheme, chainId, chosen) {
  const chainIndex = scheme.chains.findIndex(({ id }) => id === chainId);
  if (chainIndex < 0) throw new Error("DIMENSION_CHAIN_UNKNOWN");
  const chain = scheme.chains[chainIndex];
  if (chain.closureCandidateId !== chosen.id && !chain.alternativeClosureCandidateIds.includes(chosen.id)) {
    throw new Error("DIMENSION_CLOSURE_ALTERNATIVE_REQUIRED");
  }
  const parent = requireCandidate(scheme, chain.parentCandidateId);
  const leftChildren = coverRange(scheme, parent.startStationId, chosen.startStationId, parent.id, chosen.id);
  const rightChildren = coverRange(scheme, chosen.endStationId, parent.endStationId, parent.id, chosen.id);
  const childCandidateIds = [...leftChildren, ...rightChildren].map(({ id }) => id);
  const nextChain = {
    ...chain,
    childCandidateIds,
    closureCandidateId: chosen.id,
    alternativeClosureCandidateIds: unique([
      chain.closureCandidateId,
      ...chain.alternativeClosureCandidateIds.filter((id) => id !== chosen.id)
    ]),
    status: "resolved"
  };
  const chains = [...scheme.chains];
  chains[chainIndex] = nextChain;
  const displayedCandidateIds = unique([
    ...scheme.displayedCandidateIds.filter((id) => !chain.childCandidateIds.includes(id) && id !== chosen.id),
    ...childCandidateIds
  ]);
  const closureCandidateIds = unique([
    ...scheme.closureCandidateIds.filter((id) => id !== chain.closureCandidateId),
    chosen.id
  ]);
  const diagnostics = scheme.diagnostics.filter(({ code }) => code !== "DIMENSION_CLOSURE_AMBIGUOUS" && code !== "DIMENSION_DOCUMENT_DISPLAY_CONFLICT");
  const documentEvidence = chosen.evidenceIds.filter((id) => {
    var _a3;
    return ((_a3 = scheme.evidence.find((item) => item.id === id)) == null ? void 0 : _a3.origin) === "document";
  });
  if (documentEvidence.length > 0) diagnostics.push({
    id: `dimension-scheme:DIMENSION_DOCUMENT_DISPLAY_CONFLICT:${chosen.id}`,
    severity: "warning",
    code: "DIMENSION_DOCUMENT_DISPLAY_CONFLICT",
    message: "A document-backed interval is used as an unmarked closure by the selected drafting policy.",
    entityIds: [chosen.id],
    evidenceIds: documentEvidence
  });
  return {
    ...structuredClone(scheme),
    chains,
    displayedCandidateIds,
    closureCandidateIds,
    diagnostics,
    status: "resolved",
    decisions: updateDecisions(scheme.decisions, displayedCandidateIds, closureCandidateIds, chains)
  };
}
function coverRange(scheme, startStationId, endStationId, parentCandidateId, excludedCandidateId) {
  if (startStationId === endStationId) return [];
  const coordinates = new Map(scheme.topology.stations.map(({ id, coordinate }) => [id, coordinate]));
  const targetEnd = coordinates.get(endStationId);
  if (targetEnd === void 0) throw new Error("DIMENSION_STATION_UNRESOLVED");
  const scores = new Map(scheme.decisions.map(({ candidateId, score: score2 }) => [candidateId, score2]));
  const memo = /* @__PURE__ */ new Map();
  const visit = (stationId) => {
    if (stationId === endStationId) return [];
    if (memo.has(stationId)) return memo.get(stationId);
    const options = scheme.candidates.filter((candidate) => candidate.id !== parentCandidateId && candidate.id !== excludedCandidateId && candidate.startStationId === stationId && (coordinates.get(candidate.endStationId) ?? Number.POSITIVE_INFINITY) <= targetEnd);
    let best = null;
    for (const option of options) {
      const remainder = visit(option.endStationId);
      if (!remainder) continue;
      const proposal = [option, ...remainder];
      if (!best || proposal.length < best.length || proposal.length === best.length && score(proposal, scores) > score(best, scores)) best = proposal;
    }
    memo.set(stationId, best);
    return best;
  };
  const result = visit(startStationId);
  if (!result) throw new Error("DIMENSION_CHAIN_INCOMPLETE");
  return result;
}
function updateDecisions(decisions, displayed, closures, chains) {
  return decisions.map((decision) => ({
    ...decision,
    decision: displayed.includes(decision.candidateId) ? "displayed" : closures.includes(decision.candidateId) ? "closure" : chains.some(({ alternativeClosureCandidateIds }) => alternativeClosureCandidateIds.includes(decision.candidateId)) ? "alternative" : "rejected"
  }));
}
function requireCandidate(scheme, id) {
  const candidate = scheme.candidates.find((item) => item.id === id);
  if (!candidate) throw new Error("DIMENSION_CANDIDATE_UNKNOWN");
  return candidate;
}
function score(candidates, scores) {
  return candidates.reduce((sum, candidate) => sum + (scores.get(candidate.id) ?? 0), 0);
}
function isDerivedValidationCode(code) {
  return code === "DIMENSION_CHAIN_INCOMPLETE" || code === "DIMENSION_CLOSURE_MISSING" || code === "DIMENSION_CHAIN_ARITHMETIC_MISMATCH" || code === "DIMENSION_CANDIDATE_CROSSES_SELECTED";
}
function unique(values) {
  return [...new Set(values)];
}
function dedupe(values) {
  return [...new Map(values.map((value) => [value.id, value])).values()].sort((left, right) => left.id.localeCompare(right.id));
}
function createEngineeringAnnotationTool(host, sessions, partitions, dimensionPlans) {
  return defineTool({
    name: "drawing_auto_annotate",
    description: "Create only deterministic axial opening-angle dimensions. An editable shaft partition may remain unconfirmed and is preserved independently. This tool never creates diameter, radius, or other dimensions and never edits partition boundaries.",
    parameters: {},
    output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      var _a3, _b;
      const agent = exec.agent;
      if (!agent) throw new Error("DRAWING_SESSION_REQUIRED");
      const sessionId = String(agent.id);
      const partition = partitions == null ? void 0 : partitions.get(sessionId);
      if ((partition == null ? void 0 : partition.phase) === "analyzing") {
        throw new Error("PARTITION_ANALYSIS_ACTIVE: wait until the editable partition draft is ready before opening-angle annotation");
      }
      const snapshot = host.getSnapshot(agent);
      if (!snapshot) throw new Error("DRAWING_REQUIRED");
      const plan = planEngineeringAnnotations({
        document: snapshot.document,
        ref: snapshot.ref,
        objective: "工程图纸自动标注"
      });
      const workflowId = `annotation_${sessionId}_${Date.now()}`;
      sessions.start(sessionId, workflowId);
      if (!plan.program) {
        sessions.finish(sessionId, "completed");
        return {
          status: "no-effect",
          pending: plan.pending,
          suppressed: plan.suppressed
        };
      }
      try {
        const workflow = await host.runExtensionProgram(agent, {
          targetNodeIds: plan.targetNodeIds,
          program: plan.program
        }, exec.signal);
        if (workflow.result.status === "committed" && ((_a3 = partition == null ? void 0 : partition.drawingRef) == null ? void 0 : _a3.drawingId) === snapshot.ref.drawingId && partition.drawingRef.revision === snapshot.ref.revision) {
          partitions == null ? void 0 : partitions.advanceDrawingRevision(sessionId, snapshot.ref, workflow.result.ref);
          if ((_b = dimensionPlans == null ? void 0 : dimensionPlans.get(sessionId).draft) == null ? void 0 : _b.axialScheme) {
            dimensionPlans.markNeedsRebase(sessionId, workflow.result.ref);
          }
        }
        sessions.finish(sessionId, terminalStatus(workflow.result.status));
        return {
          status: workflow.result.status,
          annotations: plan.annotations.map(({ id }) => id),
          pending: plan.pending,
          suppressed: plan.suppressed,
          result: workflow.result
        };
      } catch (error) {
        sessions.finish(sessionId, "failed", error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  });
}
function createPartitionStatusTool(partitions) {
  return defineTool({
    name: "drawing_partition_status",
    description: "Inspect the dedicated smart shaft-partition workflow after an explicit engineering DXF import. Use this for requests about partitioning or axis segments; do not create partition lines with generic drawing edit tools. Partition boundaries are calculated locally and edited in the engineering workspace.",
    parameters: {},
    output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    async execute(_args, exec) {
      var _a3, _b, _c, _d;
      const agent = exec.agent;
      if (!agent) throw new Error("DRAWING_SESSION_REQUIRED");
      const snapshot = partitions.get(String(agent.id));
      return {
        phase: snapshot.phase,
        ...snapshot.drawingRef === void 0 ? {} : { drawingRef: snapshot.drawingRef },
        segmentCount: ((_a3 = snapshot.draft) == null ? void 0 : _a3.segments.length) ?? ((_b = snapshot.confirmed) == null ? void 0 : _b.segments.length) ?? 0,
        diagnostics: (((_c = snapshot.draft) == null ? void 0 : _c.diagnostics) ?? ((_d = snapshot.confirmed) == null ? void 0 : _d.diagnostics) ?? []).map(({ code }) => code),
        nextAction: snapshot.phase === "analyzing" ? "wait-for-analysis" : snapshot.phase === "editing" ? "review-or-edit-partition-and-continue-opening-angle-annotation-without-confirming" : snapshot.phase === "confirmed" ? "ready-for-opening-angle-annotation" : snapshot.drawingRef === void 0 ? "import-engineering-dxf" : "wait-for-explicit-partition-request"
      };
    }
  });
}
function createPartitionStartTool(workflow) {
  return defineTool({
    name: "drawing_partition_start",
    description: "Start or refresh smart shaft partitioning for the active DXF only when the user explicitly asks to partition, segment, or identify functional shaft regions. Uploading a document alone is never intent. Documents staged by the VectorAI file bridge are consumed automatically; engineeringContext is only for concise partition evidence stated directly in the user message. Local geometry computes and snaps every boundary.",
    parameters: {
      engineeringContext: { type: "string", description: "Optional concise, verbatim partition-related evidence from the user-provided document. Omit when none is relevant." }
    },
    output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    async execute(args, exec) {
      var _a3, _b, _c, _d, _e, _f;
      const agent = exec.agent;
      if (!agent) throw new Error("DRAWING_SESSION_REQUIRED");
      const engineeringContext = typeof args.engineeringContext === "string" ? args.engineeringContext.trim() : void 0;
      if (Buffer.byteLength(engineeringContext ?? "", "utf8") > 32 * 1024) throw new Error("PARTITION_CONTEXT_SIZE_LIMIT");
      const snapshot = await workflow.start(agent, engineeringContext || void 0, exec.signal);
      return {
        status: snapshot.phase,
        segmentCount: ((_a3 = snapshot.draft) == null ? void 0 : _a3.segments.length) ?? ((_b = snapshot.confirmed) == null ? void 0 : _b.segments.length) ?? 0,
        semanticGroupCount: ((_c = snapshot.draft) == null ? void 0 : _c.semanticGroups.length) ?? ((_d = snapshot.confirmed) == null ? void 0 : _d.semanticGroups.length) ?? 0,
        diagnostics: (((_e = snapshot.draft) == null ? void 0 : _e.diagnostics) ?? ((_f = snapshot.confirmed) == null ? void 0 : _f.diagnostics) ?? []).map(({ code }) => code),
        nextAction: snapshot.phase === "editing" ? "review-or-edit-partition-and-continue-opening-angle-annotation-without-confirming" : snapshot.phase
      };
    }
  });
}
function createDimensionChainStartTool(workflow) {
  return defineTool({
    name: "drawing_dimension_chain_start",
    description: "Start axial nominal dimension-chain inference only when the user explicitly asks for a dimension chain or a dimensioning workflow that requires one. Never call this merely because a DXF or engineering document was uploaded. Local geometry owns all coordinates, nominal values, and arithmetic.",
    parameters: {
      policy: {
        type: "string",
        enum: ["shaft-hierarchical-dimensioning-v1", "shaft-reference-terminal-closure-v1"],
        description: "Optional drafting policy. Omit it for the default reference terminal-closure convention; use the hierarchical policy only when the user explicitly requests it."
      }
    },
    output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: JSON.stringify(value) }] },
    async execute(args, exec) {
      var _a3, _b, _c, _d, _e, _f, _g, _h, _i, _j;
      if (!exec.agent) throw new Error("DRAWING_SESSION_REQUIRED");
      const policy = args.policy === "shaft-hierarchical-dimensioning-v1" ? args.policy : "shaft-reference-terminal-closure-v1";
      const snapshot = workflow.start(exec.agent, policy);
      return {
        status: snapshot.phase,
        schemeStatus: (_b = (_a3 = snapshot.draft) == null ? void 0 : _a3.axialScheme) == null ? void 0 : _b.status,
        displayedDimensionCount: ((_d = (_c = snapshot.draft) == null ? void 0 : _c.axialScheme) == null ? void 0 : _d.displayedCandidateIds.length) ?? 0,
        closureCount: ((_f = (_e = snapshot.draft) == null ? void 0 : _e.axialScheme) == null ? void 0 : _f.closureCandidateIds.length) ?? 0,
        diagnostics: ((_h = (_g = snapshot.draft) == null ? void 0 : _g.axialScheme) == null ? void 0 : _h.diagnostics.map(({ code }) => code)) ?? [],
        nextAction: ((_j = (_i = snapshot.draft) == null ? void 0 : _i.axialScheme) == null ? void 0 : _j.status) === "resolved" ? "preview-or-confirm" : "review-dimension-chain"
      };
    }
  });
}
function terminalStatus(status) {
  if (status === "committed" || status === "already-satisfied") return "completed";
  if (status === "discarded") return "canceled";
  if (status === "needs-rebase") return "needs-rebase";
  return "failed";
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
  const start2 = source.startsWith("^") ? 1 : 0;
  const end2 = source.endsWith("$") ? source.length - 1 : source.length;
  return source.slice(start2, end2);
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
    payload.addIssue = (issue$12) => {
      if (typeof issue$12 === "string") {
        payload.issues.push(issue(issue$12, payload.value, ch._zod.def));
      } else {
        const _issue = issue$12;
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
  const { minimum, maximum, format: format2, patterns, contentEncoding } = schema._zod.bag;
  if (typeof minimum === "number")
    json.minLength = minimum;
  if (typeof maximum === "number")
    json.maxLength = maximum;
  if (format2) {
    json.format = formatMap[format2] ?? format2;
    if (json.format === "")
      delete json.format;
    if (format2 === "time") {
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
  const { minimum, maximum, format: format2, multipleOf, exclusiveMaximum, exclusiveMinimum } = schema._zod.bag;
  if (typeof format2 === "string" && format2.includes("int"))
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
    payload.addIssue = (issue$12) => {
      if (typeof issue$12 === "string") {
        payload.issues.push(issue(issue$12, payload.value, def));
      } else {
        const _issue = issue$12;
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
const protocolIdSchema = string().trim().min(1).max(256);
const contentDigestSchema = string().trim().min(1).max(512);
const idSchema$3 = protocolIdSchema;
const digestSchema$1 = contentDigestSchema;
const drawingRefSchema = object({
  drawingId: idSchema$3,
  revision: number().int().nonnegative()
}).strict();
const editBasisSchema = discriminatedUnion("kind", [
  object({
    kind: literal("canonical"),
    ref: drawingRefSchema
  }).strict(),
  object({
    kind: literal("preview"),
    baseRef: drawingRefSchema,
    previewHandle: idSchema$3,
    previewDigest: digestSchema$1
  }).strict(),
  object({
    kind: literal("carried-candidate"),
    handoffId: idSchema$3,
    taskId: idSchema$3,
    originTaskId: idSchema$3,
    baseRef: drawingRefSchema,
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
  baseRef: drawingRefSchema,
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
  groundingIds: array(idSchema$3).min(2).max(16).optional(),
  baseRef: drawingRefSchema,
  candidateDigest: digestSchema$1,
  effectDigest: digestSchema$1,
  finalizeOperationId: idSchema$3,
  finalizeOperationBindingDigest: digestSchema$1
}).strict().superRefine(({ groundingId, groundingIds }, context) => {
  if (groundingIds === void 0) return;
  if (groundingIds[0] !== groundingId || new Set(groundingIds).size !== groundingIds.length) {
    context.addIssue({ code: "custom", path: ["groundingIds"], message: "EDIT_GROUNDING_SET_INVALID" });
  }
});
object({
  evaluationId: idSchema$3,
  taskId: idSchema$3,
  previewHandle: idSchema$3,
  candidateDigest: digestSchema$1,
  evaluationDigest: digestSchema$1
}).strict();
const selectionProjectionRefSchema = object({
  selectionProjectionId: idSchema$3,
  drawingRef: drawingRefSchema,
  nodeIds: array(idSchema$3).min(1).max(256),
  projectionDigest: digestSchema$1,
  expiresAt: number().int().nonnegative()
}).strict();
const boundedTextSchema$1 = string().trim().min(1).max(2e3);
const boundsSchema$1 = object({
  minX: number().finite(),
  minY: number().finite(),
  maxX: number().finite(),
  maxY: number().finite()
}).strict().refine(({ minX, minY, maxX, maxY }) => minX <= maxX && minY <= maxY);
const diagnosticSchema = object({
  code: protocolIdSchema,
  severity: _enum(["info", "candidate", "warning", "decision_required", "error"]),
  message: boundedTextSchema$1,
  nodeIds: array(protocolIdSchema).max(256).optional(),
  action: boundedTextSchema$1.optional(),
  facts: record(string(), unknown()).optional(),
  scopeDigest: contentDigestSchema.optional(),
  hard: boolean().optional()
}).strict();
const authoritativeObjectiveSchema = object({
  text: string().trim().min(1).max(8e3),
  attachmentContentDigests: array(contentDigestSchema).max(16)
}).strict();
const resolvedDefectSchema = object({
  defectId: protocolIdSchema,
  scopeDigest: contentDigestSchema,
  evidenceDigests: array(contentDigestSchema).min(1).max(32)
}).strict();
const reviewEvidenceSchema = object({
  kind: literal("reviewer"),
  provider: protocolIdSchema,
  providerVersion: protocolIdSchema,
  authoritativeObjective: authoritativeObjectiveSchema,
  renderManifest: object({
    rendererVersion: protocolIdSchema,
    beforeContentDigest: contentDigestSchema,
    afterContentDigest: contentDigestSchema,
    artifactContentDigest: contentDigestSchema,
    comparisonLayout: literal("before | after"),
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
    overlays: array(protocolIdSchema).max(32)
  }).strict(),
  outcome: _enum(["satisfied", "needs_revision", "unavailable"]),
  defects: array(object({
    defectId: protocolIdSchema,
    code: protocolIdSchema,
    reason: boundedTextSchema$1,
    scopeDigest: contentDigestSchema
  }).strict()).max(64),
  resolvedDefects: array(resolvedDefectSchema).max(64)
}).strict();
const assessmentBase = {
  assessmentId: protocolIdSchema,
  taskId: protocolIdSchema,
  drawingId: protocolIdSchema,
  baseRef: drawingRefSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  evaluationDigest: contentDigestSchema,
  policyVersion: protocolIdSchema,
  evaluatorVersions: array(protocolIdSchema).min(1).max(64),
  effectDigest: contentDigestSchema,
  reasons: array(protocolIdSchema).max(64)
};
const assessmentSchema = discriminatedUnion("disposition", [
  object({
    ...assessmentBase,
    disposition: literal("blocked"),
    hardDeny: boolean(),
    nonOverridableProtected: boolean()
  }).strict(),
  object({
    ...assessmentBase,
    disposition: literal("confirmation_required"),
    requiredEffectDigest: contentDigestSchema
  }).strict(),
  object({
    ...assessmentBase,
    disposition: literal("auto_safe"),
    autoQualification: object({
      exactScope: literal(true),
      cleanDiagnostics: literal(true),
      sourceConfirmed: literal(true),
      reviewerSatisfied: literal(true),
      inverseVerified: literal(true)
    }).strict()
  }).strict()
]);
object({
  evaluationId: protocolIdSchema,
  taskId: protocolIdSchema,
  previewHandle: protocolIdSchema,
  candidateDigest: contentDigestSchema,
  diagnostics: array(diagnosticSchema).max(256),
  mandatoryEvaluatorVersions: array(protocolIdSchema).min(1).max(64),
  review: reviewEvidenceSchema,
  evaluationDigest: contentDigestSchema
}).strict();
const idSchema$2 = string().trim().min(1).max(256);
const digestSchema = string().trim().min(1).max(512);
object({
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
    ref: drawingRefSchema,
    operationId: idSchema$2,
    operationBindingDigest: digestSchema
  }).strict(),
  object({
    status: literal("already-satisfied"),
    ref: drawingRefSchema,
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
    ref: drawingRefSchema
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
  }).strict().refine(({ start: start2, end: end2 }) => start2 < end2, { message: "INVALID_SOURCE_SPAN" }),
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
  baseRef: drawingRefSchema,
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
const drawingNodeSourceRefSchema = object({
  sourceId: idSchema,
  objectId: idSchema.optional(),
  objectType: idSchema.optional(),
  layer: string().min(1).optional()
}).strict();
const baseNodeShape = {
  id: idSchema,
  visible: boolean(),
  quality: qualitySchema,
  sourceRef: drawingNodeSourceRefSchema.optional()
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
const toleranceProjectionSchema = object({
  mode: _enum(["none", "bilateral", "unilateral", "limits", "fit"]),
  upperDeviation: number().finite().optional(),
  lowerDeviation: number().finite().optional(),
  upperLimit: number().finite().optional(),
  lowerLimit: number().finite().optional(),
  fitDesignation: string().min(1).max(32).optional(),
  unit: _enum(["mm", "cm", "m", "deg"]),
  status: _enum(["candidate", "resolved", "confirmed", "conflict"]),
  source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
  ruleRef: object({
    id: idSchema,
    version: idSchema,
    inputDigest: idSchema
  }).strict().optional(),
  evidenceRefs: array(idSchema)
}).strict().superRefine((value, context) => {
  if (value.mode === "limits" && (value.lowerLimit === void 0 || value.upperLimit === void 0 || value.lowerLimit > value.upperLimit)) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_LIMIT_ORDER" });
  }
  if (value.mode === "bilateral" && (value.upperDeviation === void 0 || value.lowerDeviation === void 0)) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATIONS_REQUIRED" });
  }
  if (value.mode === "unilateral" && value.upperDeviation === void 0 && value.lowerDeviation === void 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_DEVIATION_REQUIRED" });
  }
  if (value.mode === "fit" && value.fitDesignation === void 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_FIT_REQUIRED" });
  }
  if (value.status === "confirmed" && value.evidenceRefs.length === 0) {
    context.addIssue({ code: ZodIssueCode.custom, message: "TOLERANCE_EVIDENCE_REQUIRED" });
  }
});
const datumReferenceSchema = object({
  datumId: idSchema,
  role: _enum(["primary", "secondary", "tertiary", "origin"]),
  geometryId: idSchema,
  anchor: entityAnchorSchema
}).strict();
const hatchBoundaryEdgeSchema = discriminatedUnion("type", [
  object({ type: literal("line"), start: vec2Schema, end: vec2Schema }).strict(),
  object({
    type: literal("arc"),
    center: vec2Schema,
    radius: number().positive(),
    startAngle: number(),
    endAngle: number(),
    counterClockwise: boolean()
  }).strict(),
  object({
    type: literal("ellipse"),
    center: vec2Schema,
    majorAxis: vec2Schema,
    axisRatio: number().positive(),
    startParameter: number(),
    endParameter: number(),
    counterClockwise: boolean()
  }).strict(),
  object({
    type: literal("spline"),
    degree: number().int().positive(),
    rational: boolean(),
    periodic: boolean(),
    knots: array(number()),
    controlPoints: array(vec2Schema),
    weights: array(number()).optional(),
    fitPoints: array(vec2Schema).optional()
  }).strict()
]);
const parametricHatchSchema = object({
  version: literal(1),
  style: _enum(["normal", "outer", "ignore"]),
  elevation: number(),
  extrusion: tuple([number(), number(), number()]),
  boundaryPaths: array(object({
    flags: number().int().nonnegative(),
    closed: boolean(),
    edges: array(hatchBoundaryEdgeSchema).min(1)
  }).strict()).min(1),
  patternLines: array(object({
    angle: number(),
    base: vec2Schema,
    offset: vec2Schema,
    dashLengths: array(number())
  }).strict()),
  patternAngle: number(),
  patternScale: number().positive(),
  double: boolean()
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
    toleranceProjection: toleranceProjectionSchema.optional(),
    datumReferences: array(datumReferenceSchema).optional(),
    engineeringIntentId: idSchema.optional(),
    engineeringChainIds: array(idSchema).optional(),
    generationOrder: number().int().nonnegative().optional(),
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
    hatch: parametricHatchSchema.optional(),
    segments: array(object({ start: vec2Schema, end: vec2Schema }).strict()).optional()
  }).strict().refine((value) => value.hatch !== void 0 || value.segments !== void 0, {
    message: "SECTION_HATCH_REPRESENTATION_REQUIRED"
  })
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
  sources: array(object({
    id: idSchema,
    kind: _enum(["image", "dxf"]),
    mediaType: string().min(1),
    digest: idSchema,
    name: string().min(1).optional(),
    bytes: number().int().nonnegative().optional()
  }).strict()).optional(),
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
discriminatedUnion("kind", [
  object({
    kind: literal("world-slice"),
    ref: drawingRefSchema,
    bounds: bounds2DSchema,
    planes: array(drawingPlaneSchema).min(1).optional(),
    limit: number().int().min(1).max(200).optional()
  }).strict(),
  object({
    kind: literal("node"),
    ref: drawingRefSchema,
    id: idSchema
  }).strict(),
  object({
    kind: literal("neighbors"),
    ref: drawingRefSchema,
    nodeId: idSchema,
    limit: number().int().min(1).max(200).optional()
  }).strict()
]);
discriminatedUnion("kind", [
  object({
    kind: literal("world-slice"),
    ref: drawingRefSchema,
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
    ref: drawingRefSchema,
    node: drawingSpatialNodeSchema.nullable()
  }).strict(),
  object({
    kind: literal("neighbors"),
    ref: drawingRefSchema,
    nodeId: idSchema,
    nodes: array(drawingSpatialNodeSchema),
    truncated: boolean()
  }).strict()
]);
const drawingSourceRefSchema = union([
  object({
    id: idSchema,
    mediaType: _enum(["image/png", "image/jpeg", "image/webp", "image/gif"]),
    bytes: number().int().nonnegative().optional(),
    width: number().positive(),
    height: number().positive(),
    name: string().optional()
  }).strict(),
  object({
    id: idSchema,
    mediaType: literal("application/dxf"),
    bytes: number().int().nonnegative().optional(),
    name: string().optional()
  }).strict()
]);
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
    mode: _enum(["auto-safe", "confirmed", "interactive", "undo", "redo"]),
    undoable: boolean(),
    redoable: boolean().optional()
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
  expectedCurrentRef: drawingRefSchema
}).strict();
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-undo ")
  }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
discriminatedUnion("status", [
  object({
    status: literal("staged"),
    targetCommitId: idSchema,
    expectedCurrentRef: drawingRefSchema,
    operationId: idSchema,
    operationBindingDigest: idSchema,
    commandLine: string().startsWith("/drawing-redo ")
  }).strict(),
  object({ status: literal("rejected"), message: string(), code: idSchema }).strict()
]);
object({
  expectedRef: drawingRefSchema,
  nodeIds: array(idSchema).max(256)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("projected"), projection: selectionProjectionRefSchema }).strict(),
  object({ status: literal("cleared") }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
const drawingMotionRigConnectorSchema = object({
  nodeId: idSchema,
  movingEndpoint: _enum(["start", "end", "first", "last"]),
  fixedPoint: vec2Schema
}).strict();
const drawingMotionRigProjectionSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  state: _enum(["ready", "needs-correction"]),
  message: string().min(1).optional(),
  carrierNodeId: idSchema.optional(),
  controlBodyNodeIds: array(idSchema).min(1).max(256),
  connectors: array(drawingMotionRigConnectorSchema).min(1).max(256),
  anchor: vec2Schema,
  handle: vec2Schema,
  keepAnchorFixed: literal(true),
  keepControlBodyRigid: literal(true),
  preserveConnectivity: literal(true),
  allowControlRotation: literal(false)
}).strict();
object({
  ref: drawingRefSchema,
  nodeIds: array(idSchema).min(1).max(256)
}).strict();
discriminatedUnion("status", [
  object({ status: literal("ready"), projection: drawingMotionRigProjectionSchema }).strict(),
  object({
    status: literal("needs-correction"),
    projection: drawingMotionRigProjectionSchema.optional(),
    message: string().min(1)
  }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
object({ ref: drawingRefSchema }).strict();
discriminatedUnion("status", [
  object({ status: literal("discarded") }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
const drawingGroundingOverlayInterfaceSchema = object({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: _enum(["start", "end"])
}).strict();
const drawingGroundingOverlayGroupSchema = object({
  groundingId: idSchema,
  partKey: string().trim().min(1).max(64),
  label: string().trim().min(1).max(80),
  role: _enum(["target", "reference"]).optional(),
  colorIndex: number().int().nonnegative(),
  nodeIds: array(idSchema).min(1).max(256),
  interfaces: array(drawingGroundingOverlayInterfaceSchema).max(256)
}).strict();
object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  taskId: idSchema,
  stateEpoch: number().int().nonnegative(),
  disposition: _enum(["active", "committed", "discarded", "failed"]),
  groups: array(drawingGroundingOverlayGroupSchema).max(16)
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
object({
  ref: drawingRefSchema,
  commands: array(workspaceCommandSchema).min(1),
  summary: string().min(1).optional()
}).strict();
const drawingPreviewSchema = object({
  version: literal(1),
  handle: idSchema,
  baseRef: drawingRefSchema,
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
object({ handle: idSchema }).strict();
discriminatedUnion("status", [
  object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), message: string(), code: string().optional() }).strict()
]);
const extensionOwnershipShape = {
  extensionId: idSchema,
  workflowId: idSchema,
  ref: drawingRefSchema
};
const extensionInterfaceSchema = object({
  interfaceId: idSchema,
  nodeId: idSchema,
  endpoint: _enum(["start", "end"])
}).strict();
object({
  ...extensionOwnershipShape,
  targetNodeIds: array(idSchema).min(1).max(256),
  interfaces: array(extensionInterfaceSchema).max(256).optional(),
  program: spatialEditProgramSchema
}).strict();
object({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema
}).strict();
object({
  ...extensionOwnershipShape,
  previewToken: idSchema,
  candidateDigest: idSchema,
  program: spatialEditProgramSchema
}).strict();
const extensionNeedsRebaseResultSchema = object({
  status: literal("needs-rebase"),
  currentRef: drawingRefSchema
}).strict();
const extensionRejectedResultSchema = object({
  status: literal("rejected"),
  code: idSchema,
  message: string().min(1)
}).strict();
const extensionPreviewReadyResultSchema = object({
  status: literal("previewed"),
  previewToken: idSchema,
  candidateDigest: idSchema,
  ref: drawingRefSchema,
  expiresAt: number().int().nonnegative()
}).strict();
discriminatedUnion("status", [
  extensionPreviewReadyResultSchema,
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object({
    status: literal("assessed"),
    previewToken: idSchema,
    candidateDigest: idSchema,
    assessment: assessmentSchema
  }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object({ status: literal("finalized"), result: finalizePreviewResultSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
discriminatedUnion("status", [
  object({ status: literal("discarded"), ref: drawingRefSchema }).strict(),
  extensionNeedsRebaseResultSchema,
  extensionRejectedResultSchema
]);
const annotationSessionStateSchema = object({
  version: literal(1),
  workspaceClaimed: boolean(),
  activationEpoch: number().int().nonnegative(),
  workflow: object({
    status: _enum(["idle", "running", "reviewing", "completed", "canceled", "failed", "needs-rebase"]),
    workflowId: idSchema.optional(),
    message: string().min(1).optional()
  }).strict()
}).strict();
object({
  bytes: _instanceof(Uint8Array),
  digest: idSchema,
  name: string().trim().min(1).max(255).optional()
}).strict();
const drawingObservationOverlaySchema = object({
  id: idSchema,
  label: string().trim().min(1).max(80),
  polygon: array(vec2Schema).min(3).max(16)
}).strict();
object({
  ref: drawingRefSchema,
  overlays: array(drawingObservationOverlaySchema).max(128).optional()
}).strict();
discriminatedUnion("status", [
  object({
    status: literal("rendered"),
    png: _instanceof(Uint8Array),
    contentDigest: idSchema,
    width: number().int().positive(),
    height: number().int().positive()
  }).strict(),
  object({ status: literal("stale"), currentRef: drawingRefSchema }).strict(),
  object({ status: literal("rejected"), code: idSchema, message: string().min(1) }).strict()
]);
string().min(1);
const partitionEvidenceSchema = object({
  id: idSchema,
  origin: _enum(["document", "geometry", "fused", "ai", "manual"]),
  label: string(),
  sourceLines: array(number().int().positive()).optional(),
  geometryNodeIds: array(idSchema).optional()
}).strict();
const partitionDiagnosticSchema = object({
  id: idSchema,
  severity: _enum(["info", "warning", "error"]),
  code: idSchema,
  message: string(),
  segmentIds: array(idSchema).optional(),
  evidenceIds: array(idSchema).optional()
}).strict();
const shaftAxisSchema = object({
  origin: vec2Schema,
  direction: vec2Schema,
  normal: vec2Schema,
  zMin: number(),
  zMax: number(),
  orientation: _enum(["forward", "reversed"]),
  geometryNodeIds: array(idSchema).optional()
}).strict();
const stepCandidateSchema = object({
  id: idSchema,
  z: number(),
  score: number(),
  evidenceIds: array(idSchema),
  accepted: boolean()
}).strict();
const partitionSegmentSchema = object({
  id: idSchema,
  zStart: number(),
  zEnd: number(),
  profile: object({ minRadius: number(), maxRadius: number(), sampleCount: number().int().nonnegative() }).strict(),
  semanticType: string().optional(),
  name: string().optional(),
  boundaryConfidence: number(),
  semanticConfidence: number().optional(),
  geometryNodeIds: array(idSchema),
  boundaryEvidenceIds: array(idSchema),
  semanticEvidenceIds: array(idSchema),
  diagnosticIds: array(idSchema),
  profileSamples: array(object({ z: number(), radius: number().nonnegative(), geometryNodeId: idSchema }).strict()).optional()
}).strict();
const partitionGroupSchema = object({
  id: idSchema,
  segmentIds: array(idSchema),
  range: object({ zStart: number(), zEnd: number() }).strict().optional(),
  semanticType: string(),
  name: string().optional(),
  evidenceIds: array(idSchema)
}).strict();
const partitionDraftSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  axis: shaftAxisSchema,
  segments: array(partitionSegmentSchema),
  semanticGroups: array(partitionGroupSchema),
  stepCandidates: array(stepCandidateSchema),
  evidence: array(partitionEvidenceSchema),
  diagnostics: array(partitionDiagnosticSchema),
  basePartitionRevisionId: idSchema.optional()
}).strict();
const partitionRevisionSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  axis: shaftAxisSchema,
  segments: array(partitionSegmentSchema),
  semanticGroups: array(partitionGroupSchema),
  evidence: array(partitionEvidenceSchema),
  diagnostics: array(partitionDiagnosticSchema),
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  confirmedAt: number()
}).strict();
discriminatedUnion("type", [
  object({ type: literal("boundary.move"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive(), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
  object({ type: literal("semantic-range.move"), expectedDrawingRef: drawingRefSchema, groupId: idSchema, edge: _enum(["start", "end"]), requestedZ: number(), snapTolerance: number().nonnegative() }).strict(),
  object({ type: literal("semantic-group.rename"), expectedDrawingRef: drawingRefSchema, groupId: idSchema, name: string().trim().min(1).max(120) }).strict(),
  object({ type: literal("segment.split"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, z: number(), snapTolerance: number().nonnegative() }).strict(),
  object({ type: literal("boundary.merge"), expectedDrawingRef: drawingRefSchema, boundaryIndex: number().int().positive() }).strict(),
  object({ type: literal("segment.metadata"), expectedDrawingRef: drawingRefSchema, segmentId: idSchema, name: string().max(120).optional(), semanticType: string().max(80).optional() }).strict()
]);
const partitionSessionSnapshotSchema = object({
  version: literal(1),
  phase: _enum(["idle", "analyzing", "editing", "confirmed", "needs-rebase", "failed"]),
  drawingRef: drawingRefSchema.optional(),
  draft: partitionDraftSchema.optional(),
  confirmed: partitionRevisionSchema.optional(),
  canUndo: boolean(),
  canRedo: boolean(),
  message: string().optional(),
  updatedAt: number()
}).strict();
const sha256DigestSchema = string().regex(/^sha256:[a-f0-9]{64}$/u);
const engineeringDocumentInputSchema = object({
  name: string().trim().min(1).max(255),
  digest: sha256DigestSchema,
  mediaType: string().trim().min(1).max(127).optional(),
  base64: string().min(1).max(27962028)
}).strict();
object({
  dxf: object({ name: string().min(1).max(255), digest: idSchema, base64: string().min(1).max(27962028) }).strict(),
  engineeringDocuments: array(engineeringDocumentInputSchema).max(16).optional(),
  engineeringDocument: object({ name: string().min(1).max(255), text: string() }).strict().optional()
}).strict().superRefine((request, context) => {
  if (request.engineeringDocuments !== void 0 && request.engineeringDocument !== void 0) {
    context.addIssue({ code: "custom", path: ["engineeringDocuments"], message: "ENGINEERING_DOCUMENT_INPUT_AMBIGUOUS" });
  }
});
object({
  expectedDrawingRef: drawingRefSchema,
  engineeringDocuments: array(engineeringDocumentInputSchema).min(1).max(16)
}).strict();
object({
  engineeringDocuments: array(engineeringDocumentInputSchema).min(1).max(16)
}).strict();
const engineeringDiagnosticSchema = object({
  id: idSchema,
  severity: _enum(["info", "warning", "error"]),
  code: idSchema,
  message: string(),
  entityIds: array(idSchema).optional(),
  evidenceIds: array(idSchema).optional()
}).strict();
const engineeringStateSchema = _enum(["candidate", "resolved", "confirmed", "conflict", "stale"]);
const engineeringDatumSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  name: string().min(1).max(120),
  geometryId: idSchema,
  anchor: entityAnchorSchema,
  role: _enum(["primary", "secondary", "tertiary", "origin"]),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: _enum(["candidate", "confirmed", "conflict", "stale"]),
  evidenceIds: array(idSchema)
}).strict();
const dimensionIntentSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  kind: _enum(["linear", "aligned", "angular", "radius", "diameter", "ordinate", "arc-length"]),
  targets: array(dimensionTargetSchema),
  datumIds: array(idSchema),
  nominalValue: number().finite(),
  unit: _enum(["mm", "cm", "m", "deg"]),
  functionalRole: _enum(["datum", "overall", "functional", "assembly", "process", "inspection", "auxiliary", "closure"]),
  source: _enum(["document", "geometry", "manual", "ai-candidate"]),
  status: engineeringStateSchema,
  evidenceIds: array(idSchema)
}).strict();
const resolvedToleranceSchema = object({
  upperDeviation: number().finite().optional(),
  lowerDeviation: number().finite().optional(),
  upperLimit: number().finite().optional(),
  lowerLimit: number().finite().optional(),
  fitDesignation: string().min(1).max(32).optional(),
  inputDigest: idSchema,
  evaluatedAt: number().finite()
}).strict();
const toleranceSpecSchema = object({
  id: idSchema,
  dimensionIntentId: idSchema,
  mode: _enum(["bilateral", "unilateral", "limits", "fit", "formula"]),
  source: _enum(["document", "standard", "enterprise-rule", "manual", "ai-candidate"]),
  ruleRef: object({ id: idSchema, version: idSchema }).strict().optional(),
  inputs: record(string(), union([number().finite(), string(), boolean()])),
  resolved: resolvedToleranceSchema.optional(),
  status: engineeringStateSchema,
  evidenceIds: array(idSchema),
  diagnostics: array(engineeringDiagnosticSchema)
}).strict();
const dimensionChainSchema = object({
  id: idSchema,
  drawingRef: drawingRefSchema,
  name: string().max(120).optional(),
  datumIds: array(idSchema),
  members: array(object({
    dimensionIntentId: idSchema,
    coefficient: union([literal(1), literal(-1)]),
    role: _enum(["functional", "component", "closure"]),
    sequenceHint: number().int().optional()
  }).strict()),
  equation: object({
    closureIntentId: idSchema,
    targetValue: number().finite().optional()
  }).strict(),
  analysisMode: _enum(["worst-case", "statistical", "reference-only"]),
  status: engineeringStateSchema,
  evidenceIds: array(idSchema),
  diagnostics: array(engineeringDiagnosticSchema)
}).strict();
const annotationDependencySchema = object({
  beforeIntentId: idSchema,
  afterIntentId: idSchema,
  reason: _enum(["datum-before-dependent", "overall-before-functional", "functional-before-component", "component-before-closure", "explicit-document-order"]),
  evidenceIds: array(idSchema)
}).strict();
const axialStationSchema = object({
  id: idSchema,
  coordinate: number().finite(),
  sourceCoordinate: number().finite(),
  unit: _enum(["mm", "cm", "m"]),
  kinds: array(_enum(["drawing-end", "shoulder", "partition-boundary", "datum"])),
  geometryNodeIds: array(idSchema),
  evidenceIds: array(idSchema)
}).strict();
const axialElementarySpanSchema = object({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: number().finite().nonnegative(),
  segmentIds: array(idSchema),
  evidenceIds: array(idSchema)
}).strict();
const dimensionEvidenceSchema = object({
  id: idSchema,
  origin: _enum(["geometry", "partition", "document", "manual", "ai"]),
  kind: _enum(["drawing-end", "elementary-span", "functional-region", "document-interval", "process-envelope", "manual-requirement"]),
  label: string(),
  required: boolean(),
  sourceIds: array(idSchema)
}).strict();
const axialDimensionCandidateSchema = object({
  id: idSchema,
  startStationId: idSchema,
  endStationId: idSchema,
  nominalValue: number().finite().nonnegative(),
  roles: array(_enum(["overall", "composite", "functional", "process", "local", "reference", "closure"])),
  evidenceIds: array(idSchema),
  required: boolean()
}).strict();
const dimensionDecisionTraceSchema = object({
  candidateId: idSchema,
  decision: _enum(["displayed", "closure", "rejected", "alternative"]),
  score: number().finite(),
  features: array(object({
    feature: _enum(["manual-required", "document-exact", "functional-region", "process-envelope", "composite-block", "overall-root", "elementary-span", "ordinary-residual", "terminal-residual"]),
    contribution: number().finite(),
    evidenceIds: array(idSchema)
  }).strict()),
  reasonCodes: array(idSchema)
}).strict();
const axialChainNodeSchema = object({
  id: idSchema,
  parentCandidateId: idSchema,
  childCandidateIds: array(idSchema),
  closureCandidateId: idSchema,
  alternativeClosureCandidateIds: array(idSchema),
  status: _enum(["resolved", "needs-review", "conflict"])
}).strict();
const axialDimensionSchemeSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  partitionRevisionId: idSchema.optional(),
  policy: object({
    id: _enum(["shaft-hierarchical-dimensioning-v1", "shaft-reference-terminal-closure-v1"]),
    version: literal("1")
  }).strict(),
  inputDigest: idSchema,
  topology: object({
    drawingRef: drawingRefSchema,
    axis: shaftAxisSchema,
    unit: _enum(["mm", "cm", "m"]),
    stations: array(axialStationSchema),
    elementarySpans: array(axialElementarySpanSchema)
  }).strict(),
  evidence: array(dimensionEvidenceSchema),
  candidates: array(axialDimensionCandidateSchema),
  displayedCandidateIds: array(idSchema),
  closureCandidateIds: array(idSchema),
  chains: array(axialChainNodeSchema),
  layout: object({
    candidateNormalOffsets: array(object({
      candidateId: idSchema,
      normalOffset: number().finite()
    }).strict())
  }).strict().optional(),
  decisions: array(dimensionDecisionTraceSchema),
  diagnostics: array(engineeringDiagnosticSchema),
  status: _enum(["resolved", "needs-review", "conflict", "stale"])
}).strict();
discriminatedUnion("type", [
  object({
    type: literal("candidate.display"),
    candidateId: idSchema,
    displayed: boolean(),
    expectedDrawingRef: drawingRefSchema
  }).strict(),
  object({
    type: literal("closure.choose"),
    chainId: idSchema,
    candidateId: idSchema,
    expectedDrawingRef: drawingRefSchema
  }).strict(),
  object({
    type: literal("candidate.layout"),
    candidateId: idSchema,
    normalOffset: number().finite(),
    expectedDrawingRef: drawingRefSchema
  }).strict()
]);
const engineeringAnnotationDraftSchema = object({
  version: literal(1),
  drawingRef: drawingRefSchema,
  datums: array(engineeringDatumSchema),
  intents: array(dimensionIntentSchema),
  tolerances: array(toleranceSpecSchema),
  chains: array(dimensionChainSchema),
  dependencies: array(annotationDependencySchema),
  diagnostics: array(engineeringDiagnosticSchema),
  axialScheme: axialDimensionSchemeSchema.optional(),
  baseRevisionId: idSchema.optional()
}).strict();
const engineeringAnnotationRevisionSchema = engineeringAnnotationDraftSchema.omit({
  baseRevisionId: true
}).extend({
  id: idSchema,
  parentRevisionId: idSchema.optional(),
  generationOrder: array(idSchema),
  confirmedAt: number().finite()
}).strict();
const dimensionPlanSessionSnapshotSchema = object({
  version: literal(1),
  phase: _enum(["idle", "editing", "confirmed", "needs-rebase", "failed"]),
  drawingRef: drawingRefSchema.optional(),
  draft: engineeringAnnotationDraftSchema.optional(),
  confirmed: engineeringAnnotationRevisionSchema.optional(),
  canUndo: boolean(),
  canRedo: boolean(),
  message: string().optional(),
  updatedAt: number().finite()
}).strict();
class AnnotationSessionStateStore {
  constructor(storage, ports = { now: Date.now }) {
    __privateAdd(this, _AnnotationSessionStateStore_instances);
    __privateAdd(this, _memory, /* @__PURE__ */ new Map());
    this.storage = storage;
    this.ports = ports;
  }
  get(sessionId) {
    var _a3;
    const current = __privateGet(this, _memory).get(sessionId);
    if (current !== void 0) return structuredClone(current);
    const restored = parseState((_a3 = this.storage) == null ? void 0 : _a3.load(sessionId));
    const state = restored ?? emptyState();
    __privateGet(this, _memory).set(sessionId, state);
    return structuredClone(state);
  }
  start(sessionId, workflowId) {
    const previous = this.get(sessionId);
    return __privateMethod(this, _AnnotationSessionStateStore_instances, set_fn).call(this, sessionId, {
      version: 1,
      workspaceClaimed: true,
      activationEpoch: previous.workspaceClaimed ? previous.activationEpoch : this.ports.now(),
      workflow: { status: "running", workflowId }
    });
  }
  finish(sessionId, status, message) {
    const previous = this.get(sessionId);
    if (!previous.workspaceClaimed) throw new Error("ANNOTATION_WORKSPACE_NOT_CLAIMED");
    return __privateMethod(this, _AnnotationSessionStateStore_instances, set_fn).call(this, sessionId, {
      ...previous,
      workflow: {
        status,
        ...previous.workflow.workflowId === void 0 ? {} : { workflowId: previous.workflow.workflowId },
        ...message === void 0 ? {} : { message }
      }
    });
  }
  release(sessionId) {
    return __privateMethod(this, _AnnotationSessionStateStore_instances, set_fn).call(this, sessionId, emptyState());
  }
  disposeSession(sessionId) {
    var _a3;
    __privateGet(this, _memory).delete(sessionId);
    (_a3 = this.storage) == null ? void 0 : _a3.delete(sessionId);
  }
}
_memory = new WeakMap();
_AnnotationSessionStateStore_instances = new WeakSet();
set_fn = function(sessionId, state) {
  var _a3;
  const clone2 = structuredClone(state);
  __privateGet(this, _memory).set(sessionId, clone2);
  (_a3 = this.storage) == null ? void 0 : _a3.save(sessionId, clone2);
  return structuredClone(clone2);
};
class FileAnnotationSessionStorage {
  constructor(directory) {
    __privateAdd(this, _FileAnnotationSessionStorage_instances);
    this.directory = directory;
  }
  load(sessionId) {
    const path = __privateMethod(this, _FileAnnotationSessionStorage_instances, path_fn).call(this, sessionId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return null;
    }
  }
  save(sessionId, state) {
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(__privateMethod(this, _FileAnnotationSessionStorage_instances, path_fn).call(this, sessionId), `${JSON.stringify(state)}
`, "utf8");
  }
  delete(sessionId) {
    const path = __privateMethod(this, _FileAnnotationSessionStorage_instances, path_fn).call(this, sessionId);
    if (existsSync(path)) unlinkSync(path);
  }
}
_FileAnnotationSessionStorage_instances = new WeakSet();
path_fn = function(sessionId) {
  const key = createHash("sha256").update(sessionId).digest("hex");
  return join(this.directory, `${key}.json`);
};
function emptyState() {
  return {
    version: 1,
    workspaceClaimed: false,
    activationEpoch: 0,
    workflow: { status: "idle" }
  };
}
function parseState(value) {
  const parsed = annotationSessionStateSchema.safeParse(value);
  return parsed.success ? structuredClone(parsed.data) : null;
}
class PartitionSessionStore {
  constructor(storage, ports = { now: Date.now, id: () => `partition_${globalThis.crypto.randomUUID()}` }) {
    __privateAdd(this, _PartitionSessionStore_instances);
    __privateAdd(this, _states, /* @__PURE__ */ new Map());
    this.storage = storage;
    this.ports = ports;
  }
  get(sessionId) {
    return structuredClone(__privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId).snapshot);
  }
  bindDrawing(sessionId, drawingRef) {
    return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, {
      version: 1,
      phase: "idle",
      drawingRef,
      canUndo: false,
      canRedo: false,
      updatedAt: this.ports.now()
    }, [], []);
  }
  beginAnalysis(sessionId, drawingRef) {
    const confirmed = latestConfirmed$1(__privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId));
    return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, {
      version: 1,
      phase: "analyzing",
      drawingRef,
      ...confirmed === void 0 ? {} : { confirmed },
      canUndo: false,
      canRedo: false,
      updatedAt: this.ports.now()
    }, [], []);
  }
  setDraft(sessionId, draft) {
    const current = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(current.snapshot, draft.drawingRef);
    return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, {
      version: 1,
      phase: "editing",
      drawingRef: draft.drawingRef,
      draft,
      ...current.snapshot.confirmed === void 0 ? {} : { confirmed: current.snapshot.confirmed },
      canUndo: false,
      canRedo: false,
      updatedAt: this.ports.now()
    }, [], []);
  }
  edit(sessionId, command) {
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, command.expectedDrawingRef);
    if (state.snapshot.phase !== "editing" || !state.snapshot.draft) throw new Error("PARTITION_DRAFT_REQUIRED");
    const draft = structuredClone(state.snapshot.draft);
    const next = command.type === "boundary.move" ? moveBoundary(draft, { boundaryIndex: command.boundaryIndex, requestedZ: command.requestedZ, snapCandidates: draft.stepCandidates, snapTolerance: command.snapTolerance }) : command.type === "semantic-range.move" ? moveSemanticRange(draft, { groupId: command.groupId, edge: command.edge, requestedZ: command.requestedZ, snapCandidates: draft.stepCandidates, snapTolerance: command.snapTolerance }) : command.type === "semantic-group.rename" ? renameSemanticGroup(draft, { groupId: command.groupId, name: command.name }) : command.type === "segment.split" ? splitSegment(draft, { segmentId: command.segmentId, z: command.z, snapCandidates: draft.stepCandidates, snapTolerance: command.snapTolerance }) : command.type === "boundary.merge" ? mergeBoundary(draft, { boundaryIndex: command.boundaryIndex }) : updateSegmentMetadata(draft, { segmentId: command.segmentId, ...command.name === void 0 ? {} : { name: command.name }, ...command.semanticType === void 0 ? {} : { semanticType: command.semanticType } });
    return __privateMethod(this, _PartitionSessionStore_instances, push_fn).call(this, sessionId, { ...state.snapshot, draft: next, canUndo: true, canRedo: false, updatedAt: this.ports.now() });
  }
  confirm(sessionId, expected) {
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, expected);
    if (!state.snapshot.draft) throw new Error("PARTITION_DRAFT_REQUIRED");
    const draft = state.snapshot.draft;
    if (validatePartition(draft).length) throw new Error("PARTITION_INVALID");
    const previous = latestConfirmed$1(state);
    const revision = {
      version: 1,
      drawingRef: draft.drawingRef,
      axis: draft.axis,
      segments: draft.segments,
      semanticGroups: draft.semanticGroups,
      evidence: draft.evidence,
      diagnostics: draft.diagnostics,
      id: this.ports.id(),
      ...previous === void 0 ? {} : { parentRevisionId: previous.id },
      confirmedAt: this.ports.now()
    };
    return __privateMethod(this, _PartitionSessionStore_instances, push_fn).call(this, sessionId, { ...state.snapshot, phase: "confirmed", draft: void 0, confirmed: revision, canUndo: true, canRedo: false, updatedAt: this.ports.now() }, draft);
  }
  confirmPending(sessionId) {
    const snapshot = this.get(sessionId);
    if (snapshot.phase !== "editing" || snapshot.draft === void 0 || snapshot.drawingRef === void 0) return snapshot;
    return this.confirm(sessionId, snapshot.drawingRef);
  }
  reopen(sessionId, expected) {
    var _a3;
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, expected);
    const confirmed = latestConfirmed$1(state);
    if (confirmed === void 0) throw new Error("PARTITION_CONFIRMED_REQUIRED");
    if (state.snapshot.phase === "editing" && ((_a3 = state.snapshot.draft) == null ? void 0 : _a3.basePartitionRevisionId) === confirmed.id) {
      return structuredClone(state.snapshot);
    }
    const draft = state.lastConfirmedDraft === void 0 ? reconstructDraft(confirmed) : structuredClone(state.lastConfirmedDraft);
    draft.basePartitionRevisionId = confirmed.id;
    return __privateMethod(this, _PartitionSessionStore_instances, push_fn).call(this, sessionId, {
      version: 1,
      phase: "editing",
      drawingRef: expected,
      draft,
      confirmed,
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now()
    });
  }
  cancel(sessionId, expected) {
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, expected);
    const confirmed = latestConfirmed$1(state);
    return __privateMethod(this, _PartitionSessionStore_instances, push_fn).call(this, sessionId, confirmed === void 0 ? { version: 1, phase: "idle", drawingRef: expected, canUndo: true, canRedo: false, updatedAt: this.ports.now() } : { version: 1, phase: "confirmed", drawingRef: expected, confirmed, canUndo: true, canRedo: false, updatedAt: this.ports.now() });
  }
  undo(sessionId, expected) {
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, expected);
    const previous = state.undo.at(-1);
    if (!previous) throw new Error("PARTITION_UNDO_EMPTY");
    const restored = structuredClone(previous);
    return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, { ...restored, canUndo: state.undo.length > 1, canRedo: true, updatedAt: this.ports.now() }, state.undo.slice(0, -1), [...state.redo, state.snapshot]);
  }
  redo(sessionId, expected) {
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, expected);
    const next = state.redo.at(-1);
    if (!next) throw new Error("PARTITION_REDO_EMPTY");
    return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, { ...next, canUndo: true, canRedo: state.redo.length > 1, updatedAt: this.ports.now() }, [...state.undo, state.snapshot], state.redo.slice(0, -1));
  }
  markNeedsRebase(sessionId, currentRef) {
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, { ...state.snapshot, phase: "needs-rebase", drawingRef: currentRef, message: "Drawing revision changed", updatedAt: this.ports.now() }, state.undo, state.redo);
  }
  advanceDrawingRevision(sessionId, previousRef, currentRef) {
    var _a3;
    const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
    requireRef$1(state.snapshot, previousRef);
    if (previousRef.drawingId !== currentRef.drawingId || currentRef.revision < previousRef.revision) {
      throw new Error("PARTITION_DRAWING_STALE");
    }
    if (previousRef.revision === currentRef.revision) return structuredClone(state.snapshot);
    const rebase = (snapshot) => rebaseSnapshot(snapshot, currentRef);
    const envelope = {
      snapshot: partitionSessionSnapshotSchema.parse(compact$1(rebase(state.snapshot))),
      undo: state.undo.map(rebase).map(compact$1).map((item) => partitionSessionSnapshotSchema.parse(item)),
      redo: state.redo.map(rebase).map(compact$1).map((item) => partitionSessionSnapshotSchema.parse(item)),
      ...state.lastConfirmed === void 0 ? {} : {
        lastConfirmed: partitionSessionSnapshotSchema.shape.confirmed.parse({
          ...state.lastConfirmed,
          drawingRef: currentRef
        })
      },
      ...state.lastConfirmedDraft === void 0 ? {} : {
        lastConfirmedDraft: { ...structuredClone(state.lastConfirmedDraft), drawingRef: currentRef }
      }
    };
    (_a3 = this.storage) == null ? void 0 : _a3.save(sessionId, envelope);
    __privateGet(this, _states).set(sessionId, envelope);
    return structuredClone(envelope.snapshot);
  }
}
_states = new WeakMap();
_PartitionSessionStore_instances = new WeakSet();
push_fn = function(sessionId, snapshot, lastConfirmedDraft) {
  const state = __privateMethod(this, _PartitionSessionStore_instances, envelope_fn).call(this, sessionId);
  return __privateMethod(this, _PartitionSessionStore_instances, replace_fn).call(this, sessionId, snapshot, [...state.undo, state.snapshot], [], lastConfirmedDraft);
};
replace_fn = function(sessionId, snapshot, undo, redo, confirmedDraft) {
  var _a3;
  const previous = __privateGet(this, _states).get(sessionId);
  const previousConfirmed = previous == null ? void 0 : previous.lastConfirmed;
  const envelope = {
    snapshot: partitionSessionSnapshotSchema.parse(compact$1(snapshot)),
    undo: undo.map(compact$1).map((item) => partitionSessionSnapshotSchema.parse(item)),
    redo: redo.map(compact$1).map((item) => partitionSessionSnapshotSchema.parse(item)),
    ...snapshot.confirmed === void 0 && previousConfirmed === void 0 ? {} : { lastConfirmed: snapshot.confirmed ?? previousConfirmed },
    ...confirmedDraft === void 0 && (previous == null ? void 0 : previous.lastConfirmedDraft) === void 0 ? {} : { lastConfirmedDraft: structuredClone(confirmedDraft ?? previous.lastConfirmedDraft) }
  };
  (_a3 = this.storage) == null ? void 0 : _a3.save(sessionId, envelope);
  __privateGet(this, _states).set(sessionId, envelope);
  return structuredClone(envelope.snapshot);
};
envelope_fn = function(sessionId) {
  var _a3;
  const existing = __privateGet(this, _states).get(sessionId);
  if (existing) return existing;
  const loaded = parseEnvelope$1((_a3 = this.storage) == null ? void 0 : _a3.load(sessionId));
  const initial = loaded ?? { snapshot: { version: 1, phase: "idle", canUndo: false, canRedo: false, updatedAt: 0 }, undo: [], redo: [] };
  __privateGet(this, _states).set(sessionId, initial);
  return initial;
};
class FilePartitionStorage {
  constructor(directory) {
    __privateAdd(this, _FilePartitionStorage_instances);
    this.directory = directory;
  }
  load(sessionId) {
    const path = __privateMethod(this, _FilePartitionStorage_instances, path_fn2).call(this, sessionId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return null;
    }
  }
  save(sessionId, value) {
    mkdirSync(this.directory, { recursive: true });
    const path = __privateMethod(this, _FilePartitionStorage_instances, path_fn2).call(this, sessionId);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value)}
`, "utf8");
    renameSync(temporary, path);
  }
}
_FilePartitionStorage_instances = new WeakSet();
path_fn2 = function(sessionId) {
  return join(this.directory, `${createHash("sha256").update(sessionId).digest("hex")}.json`);
};
function requireRef$1(snapshot, expected) {
  if (!snapshot.drawingRef || snapshot.drawingRef.drawingId !== expected.drawingId || snapshot.drawingRef.revision !== expected.revision) throw new Error("PARTITION_DRAWING_STALE");
}
function compact$1(value) {
  return JSON.parse(JSON.stringify(value));
}
function latestConfirmed$1(envelope) {
  return envelope.lastConfirmed ?? [envelope.snapshot, ...envelope.undo, ...envelope.redo].flatMap((snapshot) => snapshot.confirmed === void 0 ? [] : [snapshot.confirmed]).sort((a, b) => b.confirmedAt - a.confirmedAt)[0];
}
function parseEnvelope$1(value) {
  if (!value || typeof value !== "object") return null;
  const item = value;
  const snapshot = partitionSessionSnapshotSchema.safeParse(item.snapshot);
  if (!snapshot.success || !Array.isArray(item.undo) || !Array.isArray(item.redo)) return null;
  const undo = item.undo.map((entry) => partitionSessionSnapshotSchema.safeParse(entry));
  const redo = item.redo.map((entry) => partitionSessionSnapshotSchema.safeParse(entry));
  if (undo.some(({ success }) => !success) || redo.some(({ success }) => !success)) return null;
  const confirmed = item.lastConfirmed === void 0 ? void 0 : partitionSessionSnapshotSchema.shape.confirmed.safeParse(item.lastConfirmed);
  if (confirmed !== void 0 && !confirmed.success) return null;
  const confirmedDraft = item.lastConfirmedDraft === void 0 ? void 0 : partitionDraftSchema.safeParse(item.lastConfirmedDraft);
  if (confirmedDraft !== void 0 && !confirmedDraft.success) return null;
  return {
    snapshot: snapshot.data,
    undo: undo.map((entry) => entry.data),
    redo: redo.map((entry) => entry.data),
    ...(confirmed == null ? void 0 : confirmed.data) === void 0 ? {} : { lastConfirmed: confirmed.data },
    ...(confirmedDraft == null ? void 0 : confirmedDraft.data) === void 0 ? {} : { lastConfirmedDraft: confirmedDraft.data }
  };
}
function reconstructDraft(revision) {
  const boundaries = revision.segments.slice(0, -1).map((segment) => segment.zEnd);
  return {
    version: 1,
    drawingRef: revision.drawingRef,
    axis: structuredClone(revision.axis),
    segments: structuredClone(revision.segments),
    semanticGroups: structuredClone(revision.semanticGroups),
    stepCandidates: boundaries.map((z, index) => ({
      id: `step:reopen:${index + 1}`,
      z,
      score: 1,
      evidenceIds: [],
      accepted: true
    })),
    evidence: structuredClone(revision.evidence),
    diagnostics: [
      ...structuredClone(revision.diagnostics),
      {
        id: `diagnostic:reopen:${revision.id}`,
        severity: "warning",
        code: "PARTITION_REOPEN_DRAFT_RECONSTRUCTED",
        message: "Editable partition state was reconstructed from a legacy confirmed revision."
      }
    ],
    basePartitionRevisionId: revision.id
  };
}
function rebaseSnapshot(snapshot, drawingRef) {
  return {
    ...structuredClone(snapshot),
    drawingRef,
    ...snapshot.draft === void 0 ? {} : { draft: { ...structuredClone(snapshot.draft), drawingRef } },
    ...snapshot.confirmed === void 0 ? {} : { confirmed: { ...structuredClone(snapshot.confirmed), drawingRef } }
  };
}
const PLAIN_FORMATS = /* @__PURE__ */ new Set([
  "txt",
  "md",
  "csv",
  "tsv",
  "json",
  "yaml",
  "yml",
  "ini",
  "xml",
  "html",
  "htm",
  "log"
]);
const STRUCTURED_FORMATS = /* @__PURE__ */ new Set([
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "epub"
]);
const LEGACY_FORMATS = /* @__PURE__ */ new Set(["doc", "xls", "ppt"]);
const ENGINEERING_DOCUMENT_LIMITS = Object.freeze({
  maxDocuments: 16,
  maxDocumentBytes: 20 * 1024 * 1024,
  maxTotalDocumentBytes: 50 * 1024 * 1024,
  maxDocumentTextBytes: 4 * 1024 * 1024,
  maxTotalTextBytes: 8 * 1024 * 1024
});
async function extractEngineeringDocuments(inputs, options = {}) {
  var _a3;
  if (inputs.length > ENGINEERING_DOCUMENT_LIMITS.maxDocuments) {
    throw new Error("ENGINEERING_DOCUMENT_COUNT_LIMIT");
  }
  const admitted = inputs.map((input) => {
    const format2 = formatOf(input.name);
    if (LEGACY_FORMATS.has(format2)) throw new Error(`DOCUMENT_LEGACY_FORMAT_UNSUPPORTED:${input.name}`);
    if (!PLAIN_FORMATS.has(format2) && !STRUCTURED_FORMATS.has(format2)) {
      throw new Error(`ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED:${input.name}`);
    }
    const bytes = decodeCanonicalBase64(input.base64, input.name);
    if (bytes.byteLength > ENGINEERING_DOCUMENT_LIMITS.maxDocumentBytes) {
      throw new Error(`ENGINEERING_DOCUMENT_SIZE_LIMIT:${input.name}`);
    }
    const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
    if (digest !== input.digest) throw new Error(`DOCUMENT_DIGEST_MISMATCH:${input.name}`);
    return { input, format: format2, bytes };
  });
  if (admitted.reduce((total, item) => total + item.bytes.byteLength, 0) > ENGINEERING_DOCUMENT_LIMITS.maxTotalDocumentBytes) {
    throw new Error("ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT");
  }
  const documents = [];
  let totalTextBytes = 0;
  for (const { input, format: format2, bytes } of admitted) {
    (_a3 = options.signal) == null ? void 0 : _a3.throwIfAborted();
    let extracted;
    try {
      extracted = PLAIN_FORMATS.has(format2) ? { text: decodePlainText(bytes), warnings: [] } : await parseWithDeadline(
        options.parseStructured ?? parseStructuredDocument,
        { name: input.name, format: format2, bytes },
        options.signal,
        options.parseTimeoutMs ?? 3e4
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (error instanceof Error && error.message.startsWith("DOCUMENT_PARSE_TIMEOUT:")) throw error;
      const failure = new Error(`DOCUMENT_PARSE_FAILED:${input.name}`);
      failure.cause = error;
      throw failure;
    }
    const normalized = normalizeText(extracted.text);
    if (normalized === "") throw new Error(`DOCUMENT_TEXT_EMPTY:${input.name}`);
    const textBytes = Buffer.byteLength(normalized, "utf8");
    if (textBytes > ENGINEERING_DOCUMENT_LIMITS.maxDocumentTextBytes) {
      throw new Error(`DOCUMENT_TEXT_SIZE_LIMIT:${input.name}`);
    }
    totalTextBytes += textBytes;
    if (totalTextBytes > ENGINEERING_DOCUMENT_LIMITS.maxTotalTextBytes) {
      throw new Error("DOCUMENT_TOTAL_TEXT_SIZE_LIMIT");
    }
    documents.push({
      name: input.name,
      format: format2,
      text: normalized,
      warnings: [...extracted.warnings]
    });
  }
  if (documents.length === 0) return { documents };
  return {
    documents,
    combinedText: documents.map((document) => [
      `===== ENGINEERING DOCUMENT: ${document.name} =====`,
      document.text,
      `===== END ENGINEERING DOCUMENT: ${document.name} =====`
    ].join("\n")).join("\n")
  };
}
async function parseWithDeadline(parser, input, parentSignal, timeoutMs) {
  parentSignal == null ? void 0 : parentSignal.throwIfAborted();
  const controller = new AbortController();
  let rejectControl;
  const control = new Promise((_resolve, reject) => {
    rejectControl = reject;
  });
  const onAbort = () => {
    controller.abort(parentSignal == null ? void 0 : parentSignal.reason);
    rejectControl == null ? void 0 : rejectControl((parentSignal == null ? void 0 : parentSignal.reason) ?? new DOMException("Aborted", "AbortError"));
  };
  parentSignal == null ? void 0 : parentSignal.addEventListener("abort", onAbort, { once: true });
  const timeout = setTimeout(() => {
    const failure = new Error(`DOCUMENT_PARSE_TIMEOUT:${input.name}`);
    controller.abort(failure);
    rejectControl == null ? void 0 : rejectControl(failure);
  }, Math.max(1, timeoutMs));
  try {
    return await Promise.race([parser({ ...input, signal: controller.signal }), control]);
  } finally {
    clearTimeout(timeout);
    parentSignal == null ? void 0 : parentSignal.removeEventListener("abort", onAbort);
  }
}
const parseStructuredDocument = async ({ format: format2, bytes, signal }) => {
  const { OfficeParser } = await import("officeparser");
  const ast = await OfficeParser.parseOffice(bytes, {
    fileType: format2,
    ocr: false,
    extractAttachments: false,
    includeRawContent: false,
    abortSignal: signal ?? null
  });
  return {
    text: ast.toText(),
    warnings: (ast.warnings ?? []).map((warning) => {
      if (typeof warning === "string") return warning;
      if (warning && typeof warning === "object" && "message" in warning) return String(warning.message);
      return JSON.stringify(warning);
    })
  };
};
function formatOf(name) {
  const dot2 = name.lastIndexOf(".");
  return dot2 < 0 ? "" : name.slice(dot2 + 1).toLowerCase();
}
function decodeCanonicalBase64(value, name) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error(`DOCUMENT_PARSE_FAILED:${name}`);
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) throw new Error(`DOCUMENT_PARSE_FAILED:${name}`);
  return new Uint8Array(bytes);
}
function decodePlainText(bytes) {
  let encoding = "utf-8";
  let offset = 0;
  if (bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191) offset = 3;
  else if (bytes[0] === 255 && bytes[1] === 254) {
    encoding = "utf-16le";
    offset = 2;
  } else if (bytes[0] === 254 && bytes[1] === 255) {
    encoding = "utf-16be";
    offset = 2;
  }
  const value = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset));
  if (value.includes("\0") || value.includes("�")) throw new Error("DOCUMENT_BINARY_TEXT");
  return value;
}
function normalizeText(value) {
  return value.replace(/\r\n?/gu, "\n").replace(/[ \t]+$/gmu, "").trim();
}
class PartitionWorkflowService {
  constructor(space, partitions, annotations, reviewer, extractDocuments = extractEngineeringDocuments) {
    __privateAdd(this, _PartitionWorkflowService_instances);
    __privateAdd(this, _stagedDocuments, /* @__PURE__ */ new Map());
    this.space = space;
    this.partitions = partitions;
    this.annotations = annotations;
    this.reviewer = reviewer;
    this.extractDocuments = extractDocuments;
  }
  async stageDocuments(agent, documents, signal) {
    var _a3;
    const sessionId = String(agent.id);
    const drawingRef = (_a3 = this.space.getSnapshot(agent)) == null ? void 0 : _a3.ref;
    const stored = __privateGet(this, _stagedDocuments).get(sessionId);
    const previous = (stored == null ? void 0 : stored.drawingRef) && drawingRef && !sameDrawing(stored.drawingRef, drawingRef) ? void 0 : stored;
    const names = /* @__PURE__ */ new Set();
    const duplicate = [...(previous == null ? void 0 : previous.entries) ?? [], ...documents].find(({ name }) => {
      const key = name.toLocaleLowerCase();
      if (names.has(key)) return true;
      names.add(key);
      return false;
    });
    if (duplicate) throw new Error(`ENGINEERING_DOCUMENT_DUPLICATE_NAME:${duplicate.name}`);
    const extracted = await this.extractDocuments(documents, { signal });
    signal == null ? void 0 : signal.throwIfAborted();
    if (!extracted.combinedText) throw new Error("ENGINEERING_DOCUMENT_REQUIRED");
    const additions = extracted.documents.map((document, index) => ({
      name: document.name,
      digest: documents[index].digest,
      sourceBytes: Buffer.from(documents[index].base64, "base64").byteLength,
      text: document.text,
      textBytes: Buffer.byteLength(document.text, "utf8")
    }));
    const entries = [...(previous == null ? void 0 : previous.entries) ?? [], ...additions];
    if (entries.length > ENGINEERING_DOCUMENT_LIMITS.maxDocuments) throw new Error("ENGINEERING_DOCUMENT_COUNT_LIMIT");
    if (entries.reduce((total, entry) => total + entry.sourceBytes, 0) > ENGINEERING_DOCUMENT_LIMITS.maxTotalDocumentBytes) throw new Error("ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT");
    if (entries.reduce((total, entry) => total + entry.textBytes, 0) > ENGINEERING_DOCUMENT_LIMITS.maxTotalTextBytes) throw new Error("DOCUMENT_TOTAL_TEXT_SIZE_LIMIT");
    __privateGet(this, _stagedDocuments).set(sessionId, {
      ...drawingRef ?? (previous == null ? void 0 : previous.drawingRef) ? { drawingRef: drawingRef ?? previous.drawingRef } : {},
      entries
    });
    return this.partitions.get(sessionId);
  }
  clearDocuments(agent) {
    const sessionId = String(agent.id);
    __privateGet(this, _stagedDocuments).delete(sessionId);
    return this.partitions.get(sessionId);
  }
  getStagedEngineeringText(agent) {
    const snapshot = this.space.getSnapshot(agent);
    const staged = __privateGet(this, _stagedDocuments).get(String(agent.id));
    if (!snapshot || !staged || staged.drawingRef && !sameDrawing(staged.drawingRef, snapshot.ref)) return void 0;
    return staged.entries.map(({ name, text }) => `===== ENGINEERING DOCUMENT: ${name} =====
${text}
===== END ENGINEERING DOCUMENT: ${name} =====`).join("\n");
  }
  disposeSession(sessionId) {
    __privateGet(this, _stagedDocuments).delete(sessionId);
  }
  async importDrawing(agent, dxf, signal) {
    const bytes = validateDxf(dxf);
    signal == null ? void 0 : signal.throwIfAborted();
    await this.space.importDxf(agent, { bytes, digest: dxf.digest, name: dxf.name }, signal);
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error("DRAWING_REQUIRED");
    const sessionId = String(agent.id);
    const staged = __privateGet(this, _stagedDocuments).get(sessionId);
    if ((staged == null ? void 0 : staged.drawingRef) && !sameDrawing(staged.drawingRef, snapshot.ref)) __privateGet(this, _stagedDocuments).delete(sessionId);
    else if (staged && !staged.drawingRef) __privateGet(this, _stagedDocuments).set(sessionId, { ...staged, drawingRef: snapshot.ref });
    this.annotations.release(sessionId);
    return this.partitions.bindDrawing(sessionId, snapshot.ref);
  }
  async importAndAnalyze(agent, request, signal) {
    var _a3, _b;
    const bytes = validateDxf(request.dxf);
    if (Buffer.byteLength(((_a3 = request.engineeringDocument) == null ? void 0 : _a3.text) ?? "", "utf8") > 8 * 1024 * 1024) throw new Error("DOCUMENT_TOTAL_TEXT_SIZE_LIMIT");
    signal == null ? void 0 : signal.throwIfAborted();
    const extracted = request.engineeringDocuments === void 0 ? void 0 : await this.extractDocuments(request.engineeringDocuments, { signal });
    const engineeringText = (extracted == null ? void 0 : extracted.combinedText) ?? ((_b = request.engineeringDocument) == null ? void 0 : _b.text);
    signal == null ? void 0 : signal.throwIfAborted();
    await this.space.importDxf(agent, { bytes, digest: request.dxf.digest, name: request.dxf.name }, signal);
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error("DRAWING_REQUIRED");
    return __privateMethod(this, _PartitionWorkflowService_instances, analyze_fn).call(this, agent, snapshot, engineeringText, request.dxf.name, signal);
  }
  async supplementDocuments(agent, request, signal) {
    var _a3, _b;
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error("DRAWING_REQUIRED");
    if (snapshot.ref.drawingId !== request.expectedDrawingRef.drawingId || snapshot.ref.revision !== request.expectedDrawingRef.revision) {
      this.partitions.markNeedsRebase(String(agent.id), snapshot.ref);
      throw new Error("PARTITION_DRAWING_STALE");
    }
    const extracted = await this.extractDocuments(request.engineeringDocuments, { signal });
    signal == null ? void 0 : signal.throwIfAborted();
    const drawingSourceName = ((_b = (_a3 = snapshot.document.sources) == null ? void 0 : _a3.find(({ kind }) => kind === "dxf")) == null ? void 0 : _b.name) ?? "drawing.dxf";
    return __privateMethod(this, _PartitionWorkflowService_instances, analyze_fn).call(this, agent, snapshot, extracted.combinedText, drawingSourceName, signal);
  }
  async analyzeCurrent(agent, engineeringContext, signal) {
    var _a3, _b;
    const snapshot = this.space.getSnapshot(agent);
    if (!snapshot) throw new Error("DRAWING_REQUIRED");
    if (Buffer.byteLength(engineeringContext ?? "", "utf8") > 32 * 1024) throw new Error("PARTITION_CONTEXT_SIZE_LIMIT");
    signal == null ? void 0 : signal.throwIfAborted();
    const drawingSourceName = (_b = (_a3 = snapshot.document.sources) == null ? void 0 : _a3.find(({ kind }) => kind === "dxf")) == null ? void 0 : _b.name;
    if (drawingSourceName === void 0) throw new Error("DXF_DRAWING_REQUIRED");
    const stagedText = this.getStagedEngineeringText(agent);
    const combinedContext = [stagedText, engineeringContext == null ? void 0 : engineeringContext.trim()].filter(Boolean).join("\n") || void 0;
    return __privateMethod(this, _PartitionWorkflowService_instances, analyze_fn).call(this, agent, snapshot, combinedContext, drawingSourceName, signal);
  }
  getState(agent) {
    return this.partitions.get(String(agent.id));
  }
  edit(agent, command) {
    if (!__privateMethod(this, _PartitionWorkflowService_instances, current_fn).call(this, agent, command.expectedDrawingRef)) return this.partitions.get(String(agent.id));
    return this.partitions.edit(String(agent.id), command);
  }
  confirm(agent, expected) {
    if (!__privateMethod(this, _PartitionWorkflowService_instances, current_fn).call(this, agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.confirm(sessionId, expected);
    this.annotations.finish(sessionId, "completed");
    return result;
  }
  cancel(agent, expected) {
    if (!__privateMethod(this, _PartitionWorkflowService_instances, current_fn).call(this, agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.cancel(sessionId, expected);
    this.annotations.finish(sessionId, "canceled");
    return result;
  }
  reopen(agent, expected) {
    if (!__privateMethod(this, _PartitionWorkflowService_instances, current_fn).call(this, agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.reopen(sessionId, expected);
    this.annotations.start(sessionId, `partition_${randomUUID()}`);
    return result;
  }
  undo(agent, expected) {
    if (!__privateMethod(this, _PartitionWorkflowService_instances, current_fn).call(this, agent, expected)) return this.partitions.get(String(agent.id));
    const sessionId = String(agent.id);
    const result = this.partitions.undo(sessionId, expected);
    if (result.phase === "editing") this.annotations.start(sessionId, `partition_${randomUUID()}`);
    return result;
  }
  redo(agent, expected) {
    if (!__privateMethod(this, _PartitionWorkflowService_instances, current_fn).call(this, agent, expected)) return this.partitions.get(String(agent.id));
    return this.partitions.redo(String(agent.id), expected);
  }
}
_stagedDocuments = new WeakMap();
_PartitionWorkflowService_instances = new WeakSet();
analyze_fn = async function(agent, snapshot, engineeringText, drawingSourceName, signal) {
  const sessionId = String(agent.id);
  this.annotations.start(sessionId, `partition_${randomUUID()}`);
  this.partitions.beginAnalysis(sessionId, snapshot.ref);
  const analyzed = analyzeShaftPartition({
    document: snapshot.document,
    drawingRef: snapshot.ref,
    ...engineeringText === void 0 ? {} : { engineeringText },
    drawingSourceName
  });
  if (analyzed.status === "rejected") {
    this.annotations.finish(sessionId, "failed", analyzed.diagnostics.map(({ code }) => code).join(", "));
    throw new Error(`PARTITION_ANALYSIS_REJECTED:${analyzed.diagnostics.map(({ code }) => code).join(",")}`);
  }
  let draft = analyzed.draft;
  let semanticReviewCompleted = analyzed.semanticReviewSegmentIds.length === 0;
  if (analyzed.semanticReviewSegmentIds.length > 0 && this.reviewer) {
    try {
      draft = (await this.reviewer({ agent, draft, segmentIds: analyzed.semanticReviewSegmentIds, signal })).draft;
      semanticReviewCompleted = true;
    } catch (error) {
      if (signal == null ? void 0 : signal.aborted) {
        this.partitions.cancel(sessionId, snapshot.ref);
        this.annotations.release(sessionId);
        throw signal.reason ?? error;
      }
      draft = structuredClone(draft);
      draft.diagnostics.push({
        id: "diagnostic:ai-semantic-unavailable",
        severity: "warning",
        code: "AI_SEMANTIC_REVIEW_UNAVAILABLE",
        message: error instanceof Error ? error.message : String(error),
        segmentIds: analyzed.semanticReviewSegmentIds
      });
    }
  }
  if (semanticReviewCompleted) draft = inferRegularShaftRegions(draft);
  if (signal == null ? void 0 : signal.aborted) {
    this.partitions.cancel(sessionId, snapshot.ref);
    this.annotations.release(sessionId);
    throw signal.reason ?? new Error("PARTITION_ANALYSIS_CANCELED");
  }
  return this.partitions.setDraft(sessionId, draft);
};
current_fn = function(agent, expected) {
  var _a3;
  const current = (_a3 = this.space.getSnapshot(agent)) == null ? void 0 : _a3.ref;
  if (current && current.drawingId === expected.drawingId && current.revision === expected.revision) return true;
  this.partitions.markNeedsRebase(String(agent.id), current ?? expected);
  return false;
};
function decodeBase64(value) {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw new Error("DXF_BASE64_INVALID");
  return new Uint8Array(Buffer.from(value, "base64"));
}
function validateDxf(dxf) {
  if (dxf.base64.length > 27962028) throw new Error("DXF_SIZE_LIMIT");
  const bytes = decodeBase64(dxf.base64);
  if (bytes.byteLength > 20 * 1024 * 1024) throw new Error("DXF_SIZE_LIMIT");
  const digest = `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
  if (digest !== dxf.digest) throw new Error("DXF_DIGEST_MISMATCH");
  return bytes;
}
function sameDrawing(left, right) {
  return left.drawingId === right.drawingId;
}
function createPartitionSemanticReviewer(ctx, space, options = {}) {
  const reviewBatch = async ({ agent, draft, segmentIds, signal }) => {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error("AI_SEMANTIC_REVIEW_TIMEOUT")), options.timeoutMs ?? 6e4);
    const reviewSignal = combineSignals(signal, timeout.signal);
    try {
      const targets = new Set(segmentIds);
      const segments = draft.segments.filter(({ id }) => targets.has(id));
      const segmentById = new Map(draft.segments.map((segment) => [segment.id, segment]));
      const contextGroups = draft.semanticGroups.slice(0, 64).flatMap((group, index) => {
        var _a3, _b;
        const related = group.segmentIds.map((id) => segmentById.get(id)).filter((segment) => segment !== void 0);
        if (related.length === 0) return [];
        const zStart = ((_a3 = group.range) == null ? void 0 : _a3.zStart) ?? Math.min(...related.map((segment) => segment.zStart));
        const zEnd = ((_b = group.range) == null ? void 0 : _b.zEnd) ?? Math.max(...related.map((segment) => segment.zEnd));
        const radius = Math.max(...related.map((segment) => segment.profile.maxRadius), 0.1) * 1.08;
        const origin = group.evidenceIds.map((id) => {
          var _a4;
          return (_a4 = draft.evidence.find((item) => item.id === id)) == null ? void 0 : _a4.origin;
        }).find(Boolean) ?? "geometry";
        return [{
          group,
          visualLabel: `C${index + 1}`,
          origin,
          overlay: {
            id: `context:${group.id}`,
            label: `C${index + 1} ${group.name ?? group.semanticType}`,
            polygon: segmentPolygon(draft.axis, zStart, zEnd, radius)
          }
        }];
      });
      const targetOverlays = segments.map((segment, index) => ({
        id: `observation:${segment.id}`,
        label: `S${index + 1}`,
        polygon: segmentPolygon(draft.axis, segment.zStart, segment.zEnd, Math.max(segment.profile.maxRadius, 0.1) * 1.08)
      }));
      const overlays = [...contextGroups.map(({ overlay }) => overlay), ...targetOverlays];
      const rendered = await abortable(space.renderObservation(agent, { ref: draft.drawingRef, overlays }, reviewSignal), reviewSignal);
      if (rendered.status !== "rendered") throw new Error(`AI_SEMANTIC_OBSERVATION_${rendered.status.toUpperCase()}`);
      const attachment = await abortable(ctx.attachments.saveImage({ data: rendered.png, mediaType: "image/png", name: "shaft-segment-observation.png" }), reviewSignal);
      const parent = ctx.agents.get(String(agent.id));
      const providerName = ctx.subagents.list()[0];
      if (!parent || !providerName) throw new Error("AI_SEMANTIC_REVIEW_UNAVAILABLE");
      const provider = ctx.subagents.getProvider(providerName);
      if (!(provider == null ? void 0 : provider.capabilities.outputSchema) || !provider.capabilities.toolFilter || !provider.capabilities.depthLimit) throw new Error("AI_SEMANTIC_REVIEW_ISOLATION_REQUIRED");
      const catalog = segments.map((segment, index) => ({
        id: segment.id,
        visualLabel: `S${index + 1}`,
        visualEvidenceId: `observation:${segment.id}`,
        ordinal: index + 1,
        width: segment.zEnd - segment.zStart,
        diameter: segment.profile.maxRadius * 2,
        boundaryConfidence: segment.boundaryConfidence
      }));
      const payload = JSON.stringify({
        instruction: "不要展示分析过程，立即返回要求的结构化结果。C 标签只作为已分类上下文，不得重新分类或放入 proposal；只判断 S 标签对应的候选轴段。结合已有区域避免把齿轮后的窄退刀槽、过渡段或工艺收尾段误认成新的花键或齿轮。只识别有明确视觉证据的主要功能区域。允许返回空 proposals，并允许不覆盖全部轴段：过渡段、退刀段、工艺收尾段、常规轴段或证据不足的轴段必须留空，不得为了连续覆盖而强行分类。可将构成同一功能区域的相邻轴段放入同一提案。semanticType 必须从 gear、spline、bearing-seat、shaft-seat、seal-seat、oil-seal-seat、coupling-seat、thread、keyway、shoulder 中选择；name 和 reason 使用简短中文。每个 segmentId 都必须提供对应的 observation:segmentId 视觉证据，confidence 低于 0.8 时不要提议。不要返回坐标、边界、尺寸或几何编辑命令。",
        segments: catalog,
        existingRegions: contextGroups.map(({ group, visualLabel, origin }) => ({
          visualLabel,
          name: group.name ?? group.semanticType,
          semanticType: group.semanticType,
          origin
        })),
        observationDigest: rendered.contentDigest
      });
      if (payload.length > 64 * 1024) throw new Error("AI_SEMANTIC_PROMPT_LIMIT");
      const run = await abortable(ctx.subagents.start(providerName, {
        label: "shaft-partition-semantic-reviewer",
        parent,
        signal: reviewSignal,
        maxDepth: 1,
        toolFilter: { allow: [] },
        persona: provider.capabilities.persona ? "You are a bounded shaft-region classifier. Do not narrate analysis. Immediately return the requested structured result from the supplied numbered image and segment catalog." : void 0,
        prompt: [{ type: "text", text: payload }, { type: "image", attachment }],
        outputSchema: proposalSchema
      }), reviewSignal);
      try {
        const result = await abortable(run.result, reviewSignal);
        const proposals = result.stopReason === "completed" ? validateOutput(result.structured) : null;
        if (!proposals) throw new Error("AI_SEMANTIC_REVIEW_INVALID");
        return proposals;
      } finally {
        await abortable(run.dispose(), reviewSignal).catch(() => void 0);
      }
    } finally {
      clearTimeout(timer);
    }
  };
  return async (input) => {
    const contextCount = countContextOverlays(input.draft);
    const capacity = Math.max(1, 128 - contextCount);
    const overlap = Math.min(8, capacity - 1);
    const proposals = [];
    let nextStart = 0;
    while (nextStart < input.segmentIds.length) {
      const batchStart = nextStart === 0 ? 0 : Math.max(0, nextStart - overlap);
      const batchIds = input.segmentIds.slice(batchStart, batchStart + capacity);
      proposals.push(...await reviewBatch({
        ...input,
        segmentIds: batchIds
      }));
      nextStart = batchStart + batchIds.length;
      if (nextStart >= input.segmentIds.length) break;
    }
    let reviewed = input.draft;
    const consolidated = consolidateProposals(reviewed, proposals);
    for (let offset = 0; offset < consolidated.length; offset += 64) {
      reviewed = applySemanticProposals(reviewed, consolidated.slice(offset, offset + 64), {
        allowedSegmentIds: input.segmentIds,
        allowedVisualEvidenceIds: input.segmentIds.map((id) => `observation:${id}`)
      }).draft;
    }
    return { draft: reviewed };
  };
}
function countContextOverlays(draft) {
  const segmentIds = new Set(draft.segments.map(({ id }) => id));
  return draft.semanticGroups.slice(0, 64).filter((group) => group.segmentIds.some((id) => segmentIds.has(id))).length;
}
function consolidateProposals(draft, proposals) {
  const index = new Map(draft.segments.map((segment, position) => [segment.id, position]));
  const merged = [];
  for (const proposal of proposals) {
    const matches = merged.filter((candidate) => candidate.semanticType === proposal.semanticType && candidate.segmentIds.some((id) => proposal.segmentIds.includes(id)));
    if (matches.length === 0) {
      merged.push(structuredClone(proposal));
      continue;
    }
    const match = matches[0];
    const candidates = [...matches, proposal];
    const stronger = candidates.reduce((best, candidate) => candidate.confidence > best.confidence ? candidate : best);
    match.segmentIds = [...new Set(candidates.flatMap(({ segmentIds }) => segmentIds))].sort((left, right) => (index.get(left) ?? 0) - (index.get(right) ?? 0));
    match.visualEvidenceIds = [...new Set(candidates.flatMap(({ visualEvidenceIds }) => visualEvidenceIds))];
    match.confidence = Math.min(...candidates.map(({ confidence }) => confidence));
    match.reason = stronger.reason;
    if (stronger.name === void 0) delete match.name;
    else match.name = stronger.name;
    for (const duplicate of matches.slice(1)) merged.splice(merged.indexOf(duplicate), 1);
  }
  const assigned = /* @__PURE__ */ new Set();
  return merged.sort((left, right) => right.confidence - left.confidence).filter((proposal) => {
    if (proposal.segmentIds.some((id) => assigned.has(id))) return false;
    proposal.segmentIds.forEach((id) => assigned.add(id));
    return true;
  });
}
const proposalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["proposals"],
  properties: { proposals: { type: "array", items: {
    type: "object",
    additionalProperties: false,
    required: ["segmentIds", "semanticType", "confidence", "reason", "visualEvidenceIds"],
    properties: {
      segmentIds: { type: "array", items: { type: "string" } },
      semanticType: { type: "string" },
      name: { type: "string" },
      confidence: { type: "number" },
      reason: { type: "string" },
      visualEvidenceIds: { type: "array", items: { type: "string" } }
    }
  } } }
};
function validateOutput(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.proposals)) return null;
  const proposals = value.proposals;
  if (proposals.length > 64 || !proposals.every(validProposal)) return null;
  return structuredClone(proposals);
}
function validProposal(value) {
  if (!value || typeof value !== "object") return false;
  const item = value;
  const keys = Object.keys(item);
  const allowed = /* @__PURE__ */ new Set(["segmentIds", "semanticType", "name", "confidence", "reason", "visualEvidenceIds"]);
  return keys.every((key) => allowed.has(key)) && ["segmentIds", "semanticType", "confidence", "reason", "visualEvidenceIds"].every((key) => keys.includes(key)) && Array.isArray(item.segmentIds) && item.segmentIds.length > 0 && item.segmentIds.every((id) => typeof id === "string") && typeof item.semanticType === "string" && (item.name === void 0 || typeof item.name === "string") && typeof item.confidence === "number" && typeof item.reason === "string" && Array.isArray(item.visualEvidenceIds) && item.visualEvidenceIds.every((id) => typeof id === "string");
}
function combineSignals(first, second) {
  if (first === void 0) return second;
  const controller = new AbortController();
  const abort = (source) => controller.abort(source.reason);
  if (first.aborted) abort(first);
  else first.addEventListener("abort", () => abort(first), { once: true });
  if (second.aborted) abort(second);
  else second.addEventListener("abort", () => abort(second), { once: true });
  return controller.signal;
}
function abortable(operation, signal) {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((resolve2, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve2, reject).finally(() => signal.removeEventListener("abort", abort)).catch(() => void 0);
  });
}
function segmentPolygon(axis, zStart, zEnd, radius) {
  const at = (z, r) => [axis.origin[0] + axis.direction[0] * z + axis.normal[0] * r, axis.origin[1] + axis.direction[1] * z + axis.normal[1] * r];
  return [at(zStart, -radius), at(zEnd, -radius), at(zEnd, radius), at(zStart, radius)];
}
class DimensionPlanStore {
  constructor(storage, ports = {
    now: Date.now,
    id: () => `dimension_plan_${globalThis.crypto.randomUUID()}`
  }) {
    __privateAdd(this, _DimensionPlanStore_instances);
    __privateAdd(this, _states2, /* @__PURE__ */ new Map());
    this.storage = storage;
    this.ports = ports;
  }
  get(sessionId) {
    return structuredClone(__privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId).snapshot);
  }
  begin(sessionId, drawingRef) {
    const confirmed = latestConfirmed(__privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId));
    return __privateMethod(this, _DimensionPlanStore_instances, replace_fn2).call(this, sessionId, {
      version: 1,
      phase: "editing",
      drawingRef,
      ...confirmed === void 0 ? {} : { confirmed },
      canUndo: false,
      canRedo: false,
      updatedAt: this.ports.now()
    }, [], []);
  }
  setDraft(sessionId, draft) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    requireRef(state.snapshot, draft.drawingRef);
    const parsedDraft = engineeringAnnotationDraftSchema.parse(compact(draft));
    return __privateMethod(this, _DimensionPlanStore_instances, push_fn2).call(this, sessionId, {
      version: 1,
      phase: "editing",
      drawingRef: parsedDraft.drawingRef,
      draft: parsedDraft,
      ...state.snapshot.confirmed === void 0 ? {} : { confirmed: state.snapshot.confirmed },
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now()
    });
  }
  editScheme(sessionId, command) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    requireRef(state.snapshot, command.expectedDrawingRef);
    const draft = state.snapshot.draft;
    if (!(draft == null ? void 0 : draft.axialScheme)) throw new Error("DIMENSION_SCHEME_DRAFT_REQUIRED");
    const edit = command.type === "candidate.display" ? { type: command.type, candidateId: command.candidateId, displayed: command.displayed } : command.type === "closure.choose" ? { type: command.type, chainId: command.chainId, candidateId: command.candidateId } : { type: command.type, candidateId: command.candidateId, normalOffset: command.normalOffset };
    const scheme = applyDimensionSchemeEdit(draft.axialScheme, edit);
    return this.setDraft(sessionId, projectAxialDimensionScheme({
      scheme,
      ...draft.baseRevisionId === void 0 ? {} : { baseRevisionId: draft.baseRevisionId }
    }));
  }
  confirm(sessionId, expected) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    requireRef(state.snapshot, expected);
    if (state.snapshot.phase === "needs-rebase") throw new Error("ANNOTATION_PLAN_DRAWING_STALE");
    if (!state.snapshot.draft) throw new Error("ANNOTATION_PLAN_DRAFT_REQUIRED");
    const draft = state.snapshot.draft;
    if (!sameRef(draft.drawingRef, expected)) throw new Error("ANNOTATION_PLAN_DRAWING_STALE");
    const previous = latestConfirmed(state);
    if (draft.baseRevisionId !== void 0 && draft.baseRevisionId !== (previous == null ? void 0 : previous.id)) {
      throw new Error("ANNOTATION_PLAN_BASE_STALE");
    }
    const order = orderDimensionIntents({ intents: draft.intents, dependencies: draft.dependencies });
    const diagnostics = confirmationDiagnostics(draft, order.diagnostics);
    if (diagnostics.some(({ severity }) => severity === "error")) throw new Error("ANNOTATION_PLAN_INVALID");
    const revision = engineeringAnnotationRevisionSchema.parse(compact({
      version: 1,
      drawingRef: draft.drawingRef,
      datums: draft.datums,
      intents: draft.intents,
      tolerances: draft.tolerances,
      chains: draft.chains,
      dependencies: draft.dependencies,
      diagnostics: [...draft.diagnostics, ...diagnostics],
      ...draft.axialScheme === void 0 ? {} : { axialScheme: draft.axialScheme },
      id: this.ports.id(),
      ...previous === void 0 ? {} : { parentRevisionId: previous.id },
      generationOrder: order.orderedIntentIds,
      confirmedAt: this.ports.now()
    }));
    return __privateMethod(this, _DimensionPlanStore_instances, push_fn2).call(this, sessionId, {
      version: 1,
      phase: "confirmed",
      drawingRef: revision.drawingRef,
      confirmed: revision,
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now()
    });
  }
  cancel(sessionId, expected) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    requireRef(state.snapshot, expected);
    const confirmed = latestConfirmed(state);
    return __privateMethod(this, _DimensionPlanStore_instances, push_fn2).call(this, sessionId, confirmed === void 0 ? {
      version: 1,
      phase: "idle",
      drawingRef: expected,
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now()
    } : {
      version: 1,
      phase: "confirmed",
      drawingRef: expected,
      confirmed,
      canUndo: true,
      canRedo: false,
      updatedAt: this.ports.now()
    });
  }
  undo(sessionId, expected) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    requireRef(state.snapshot, expected);
    const previous = state.undo.at(-1);
    if (!previous) throw new Error("ANNOTATION_PLAN_UNDO_EMPTY");
    return __privateMethod(this, _DimensionPlanStore_instances, replace_fn2).call(this, sessionId, {
      ...structuredClone(previous),
      canUndo: state.undo.length > 1,
      canRedo: true,
      updatedAt: this.ports.now()
    }, state.undo.slice(0, -1), [...state.redo, state.snapshot]);
  }
  redo(sessionId, expected) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    requireRef(state.snapshot, expected);
    const next = state.redo.at(-1);
    if (!next) throw new Error("ANNOTATION_PLAN_REDO_EMPTY");
    return __privateMethod(this, _DimensionPlanStore_instances, replace_fn2).call(this, sessionId, {
      ...structuredClone(next),
      canUndo: true,
      canRedo: state.redo.length > 1,
      updatedAt: this.ports.now()
    }, [...state.undo, state.snapshot], state.redo.slice(0, -1));
  }
  markNeedsRebase(sessionId, currentRef) {
    const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
    const draft = state.snapshot.draft === void 0 ? void 0 : {
      ...state.snapshot.draft,
      ...state.snapshot.draft.axialScheme === void 0 ? {} : {
        axialScheme: { ...state.snapshot.draft.axialScheme, status: "stale" }
      }
    };
    return __privateMethod(this, _DimensionPlanStore_instances, replace_fn2).call(this, sessionId, {
      ...state.snapshot,
      phase: "needs-rebase",
      drawingRef: currentRef,
      ...draft === void 0 ? {} : { draft },
      message: "Drawing revision changed",
      updatedAt: this.ports.now()
    }, state.undo, state.redo);
  }
}
_states2 = new WeakMap();
_DimensionPlanStore_instances = new WeakSet();
push_fn2 = function(sessionId, snapshot) {
  const state = __privateMethod(this, _DimensionPlanStore_instances, envelope_fn2).call(this, sessionId);
  return __privateMethod(this, _DimensionPlanStore_instances, replace_fn2).call(this, sessionId, snapshot, [...state.undo, state.snapshot], []);
};
replace_fn2 = function(sessionId, snapshot, undo, redo) {
  var _a3, _b;
  const previousConfirmed = (_a3 = __privateGet(this, _states2).get(sessionId)) == null ? void 0 : _a3.lastConfirmed;
  const parsedSnapshot = dimensionPlanSessionSnapshotSchema.parse(compact(snapshot));
  const envelope = {
    snapshot: parsedSnapshot,
    undo: undo.map(compact).map((item) => dimensionPlanSessionSnapshotSchema.parse(item)),
    redo: redo.map(compact).map((item) => dimensionPlanSessionSnapshotSchema.parse(item)),
    ...parsedSnapshot.confirmed === void 0 && previousConfirmed === void 0 ? {} : { lastConfirmed: parsedSnapshot.confirmed ?? previousConfirmed }
  };
  (_b = this.storage) == null ? void 0 : _b.save(sessionId, envelope);
  __privateGet(this, _states2).set(sessionId, envelope);
  return structuredClone(envelope.snapshot);
};
envelope_fn2 = function(sessionId) {
  var _a3;
  const existing = __privateGet(this, _states2).get(sessionId);
  if (existing) return existing;
  const loaded = parseEnvelope((_a3 = this.storage) == null ? void 0 : _a3.load(sessionId));
  const initial = loaded ?? {
    snapshot: { version: 1, phase: "idle", canUndo: false, canRedo: false, updatedAt: 0 },
    undo: [],
    redo: []
  };
  __privateGet(this, _states2).set(sessionId, initial);
  return initial;
};
class FileDimensionPlanStorage {
  constructor(directory) {
    __privateAdd(this, _FileDimensionPlanStorage_instances);
    this.directory = directory;
  }
  load(sessionId) {
    const path = __privateMethod(this, _FileDimensionPlanStorage_instances, path_fn3).call(this, sessionId);
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, "utf8"));
    } catch {
      return null;
    }
  }
  save(sessionId, value) {
    mkdirSync(this.directory, { recursive: true });
    const path = __privateMethod(this, _FileDimensionPlanStorage_instances, path_fn3).call(this, sessionId);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, `${JSON.stringify(value)}
`, "utf8");
    renameSync(temporary, path);
  }
}
_FileDimensionPlanStorage_instances = new WeakSet();
path_fn3 = function(sessionId) {
  return join(this.directory, `${createHash("sha256").update(sessionId).digest("hex")}.json`);
};
function confirmationDiagnostics(draft, orderDiagnostics) {
  const diagnostics = [...validateEngineeringDraft(draft), ...orderDiagnostics];
  if (draft.axialScheme && draft.axialScheme.status !== "resolved") {
    diagnostics.push(problem("DIMENSION_SCHEME_UNRESOLVED", draft.axialScheme.inputDigest));
  }
  diagnostics.push(...draft.diagnostics.filter(({ severity }) => severity === "error"));
  for (const datum of draft.datums) {
    if (datum.status === "conflict" || datum.status === "stale") {
      diagnostics.push(problem("DIMENSION_DATUM_CONFLICT", datum.id));
    }
  }
  for (const intent of draft.intents) {
    if (intent.status === "conflict" || intent.status === "stale") {
      diagnostics.push(problem("DIMENSION_INTENT_CONFLICT", intent.id));
    }
  }
  for (const tolerance of draft.tolerances) {
    if (!["resolved", "confirmed"].includes(tolerance.status) || !tolerance.resolved || tolerance.source === "ai-candidate") {
      diagnostics.push(problem("TOLERANCE_RESULT_REQUIRED", tolerance.id));
    }
  }
  for (const chain of draft.chains) {
    if (chain.status === "conflict" || chain.status === "stale") {
      diagnostics.push(problem("DIMENSION_CHAIN_CONFLICT", chain.id));
    }
    diagnostics.push(...analyzeDimensionChain({
      chain,
      intents: draft.intents,
      tolerances: draft.tolerances
    }).diagnostics);
  }
  return diagnostics.sort((first, second) => first.id < second.id ? -1 : first.id > second.id ? 1 : 0);
}
function requireRef(snapshot, expected) {
  if (!snapshot.drawingRef || !sameRef(snapshot.drawingRef, expected)) {
    throw new Error("ANNOTATION_PLAN_DRAWING_STALE");
  }
}
function sameRef(first, second) {
  return first.drawingId === second.drawingId && first.revision === second.revision;
}
function problem(code, entityId) {
  return {
    id: `dimension-plan:${code}:${entityId}`,
    severity: "error",
    code,
    message: code,
    entityIds: [entityId]
  };
}
function latestConfirmed(envelope) {
  return envelope.lastConfirmed ?? [envelope.snapshot, ...envelope.undo, ...envelope.redo].flatMap((snapshot) => snapshot.confirmed === void 0 ? [] : [snapshot.confirmed]).sort((first, second) => second.confirmedAt - first.confirmedAt)[0];
}
function parseEnvelope(value) {
  if (!value || typeof value !== "object") return null;
  const item = value;
  const snapshot = dimensionPlanSessionSnapshotSchema.safeParse(item.snapshot);
  if (!snapshot.success || !Array.isArray(item.undo) || !Array.isArray(item.redo)) return null;
  const undo = item.undo.map((entry) => dimensionPlanSessionSnapshotSchema.safeParse(entry));
  const redo = item.redo.map((entry) => dimensionPlanSessionSnapshotSchema.safeParse(entry));
  if (undo.some(({ success }) => !success) || redo.some(({ success }) => !success)) return null;
  const confirmed = item.lastConfirmed === void 0 ? void 0 : engineeringAnnotationRevisionSchema.safeParse(item.lastConfirmed);
  if (confirmed !== void 0 && !confirmed.success) return null;
  return {
    snapshot: snapshot.data,
    undo: undo.map((entry) => entry.data),
    redo: redo.map((entry) => entry.data),
    ...(confirmed == null ? void 0 : confirmed.data) === void 0 ? {} : { lastConfirmed: confirmed.data }
  };
}
function compact(value) {
  return JSON.parse(JSON.stringify(value));
}
class DimensionInferenceService {
  constructor(space, partitions, documents, plans) {
    this.space = space;
    this.partitions = partitions;
    this.documents = documents;
    this.plans = plans;
  }
  start(agent, policyId = "shaft-reference-terminal-closure-v1") {
    var _a3;
    const sessionId = String(agent.id);
    const drawing = this.space.getSnapshot(agent);
    if (!drawing) throw new Error("DRAWING_REQUIRED");
    const partition = this.partitions.get(sessionId);
    const partitionValue = partition.draft ?? partition.confirmed;
    if (!partitionValue) throw new Error("DIMENSION_PARTITION_REQUIRED");
    assertSameRef(drawing.ref, partitionValue.drawingRef);
    const document = parseEngineeringDocument(this.documents.getStagedEngineeringText(agent) ?? "");
    const domainPartition = partitionValue;
    const topology = buildAxialTopology({
      partition: domainPartition,
      unit: document.drawing.unit ?? drawing.document.unitSystem.length
    });
    const candidateSet = generateAxialDimensionCandidates({ topology, partition: domainPartition, document });
    const scheme = inferAxialDimensionScheme({
      topology,
      candidateSet,
      policy: policyById(policyId),
      ...((_a3 = partition.confirmed) == null ? void 0 : _a3.id) === void 0 ? {} : { partitionRevisionId: partition.confirmed.id }
    });
    this.plans.begin(sessionId, drawing.ref);
    return this.plans.setDraft(sessionId, projectAxialDimensionScheme({ scheme }));
  }
  getState(agent) {
    return this.plans.get(String(agent.id));
  }
  edit(agent, command) {
    return this.plans.editScheme(String(agent.id), command);
  }
  confirm(agent, expected) {
    return this.plans.confirm(String(agent.id), expected);
  }
  cancel(agent, expected) {
    return this.plans.cancel(String(agent.id), expected);
  }
  undo(agent, expected) {
    return this.plans.undo(String(agent.id), expected);
  }
  redo(agent, expected) {
    return this.plans.redo(String(agent.id), expected);
  }
  markStale(agent, currentRef) {
    return this.markStaleSession(String(agent.id), currentRef);
  }
  markStaleSession(sessionId, currentRef) {
    var _a3;
    const current = this.plans.get(sessionId);
    return ((_a3 = current.draft) == null ? void 0 : _a3.axialScheme) ? this.plans.markNeedsRebase(sessionId, currentRef) : current;
  }
}
function assertSameRef(left, right) {
  if (left.drawingId !== right.drawingId || left.revision !== right.revision) {
    throw new Error("DIMENSION_PARTITION_STALE");
  }
}
function acceptPendingPartitionForEvent(sessionId, event, partitions, sessions, onConfirmed) {
  if (event.type !== "user/message" || event.data.source.kind !== "user") return false;
  const before = partitions.get(sessionId);
  if (before.phase !== "editing" || before.draft === void 0) return false;
  const after = partitions.confirmPending(sessionId);
  if (after.phase !== "confirmed") return false;
  if (after.drawingRef !== void 0) onConfirmed == null ? void 0 : onConfirmed(after.drawingRef);
  const annotation = sessions.get(sessionId);
  if (annotation.workspaceClaimed && (annotation.workflow.status === "running" || annotation.workflow.status === "reviewing")) {
    sessions.finish(sessionId, "completed");
  }
  return true;
}
class DrawingAnnotationHostService extends (_a2 = TypertRemoteService, _getSessionState_dec = [Remote], _importDrawing_dec = [Remote], _stageDocuments_dec = [Remote], _clearDocuments_dec = [Remote], _importAndAnalyze_dec = [Remote], _supplementDocuments_dec = [Remote], _getPartitionState_dec = [Remote], _editPartition_dec = [Remote], _confirmPartition_dec = [Remote], _cancelPartition_dec = [Remote], _reopenPartition_dec = [Remote], _undoPartition_dec = [Remote], _redoPartition_dec = [Remote], _getDimensionPlan_dec = [Remote], _editDimensionScheme_dec = [Remote], _confirmDimensionPlan_dec = [Remote], _cancelDimensionPlan_dec = [Remote], _undoDimensionPlan_dec = [Remote], _redoDimensionPlan_dec = [Remote], _a2) {
  constructor(ctx) {
    super(ctx, "drawingAnnotation");
    __runInitializers(_init, 5, this);
    __publicField(this, "sessions");
    __publicField(this, "partitions");
    __publicField(this, "partitionWorkflow");
    __publicField(this, "dimensionPlans");
    __publicField(this, "dimensionInference");
    this.sessions = new AnnotationSessionStateStore(new FileAnnotationSessionStorage(
      resolve(homedir(), ".dsh/vectorai/annotation-sessions")
    ));
    this.partitions = new PartitionSessionStore(new FilePartitionStorage(
      resolve(homedir(), ".dsh/vectorai/annotation-partitions")
    ));
    this.dimensionPlans = new DimensionPlanStore(new FileDimensionPlanStorage(
      resolve(homedir(), ".dsh/vectorai/dimension-plans")
    ));
    this.partitionWorkflow = new PartitionWorkflowService(
      ctx.drawingSpace,
      this.partitions,
      this.sessions,
      createPartitionSemanticReviewer(ctx, ctx.drawingSpace)
    );
    this.dimensionInference = new DimensionInferenceService(
      ctx.drawingSpace,
      this.partitions,
      this.partitionWorkflow,
      this.dimensionPlans
    );
    ctx.effect(() => ctx.tools.register(createEngineeringAnnotationTool(
      ctx.drawingSpace,
      this.sessions,
      this.partitions,
      this.dimensionPlans
    )));
    ctx.effect(() => ctx.tools.register(createPartitionStartTool({
      start: (agent, engineeringContext, signal) => this.partitionWorkflow.analyzeCurrent(agent, engineeringContext, signal)
    })));
    ctx.effect(() => ctx.tools.register(createPartitionStatusTool(this.partitions)));
    ctx.effect(() => ctx.tools.register(createDimensionChainStartTool(this.dimensionInference)));
    ctx.on("session/event", (session, event) => {
      const sessionId = String(session.id);
      acceptPendingPartitionForEvent(sessionId, event, this.partitions, this.sessions, (drawingRef) => {
        this.dimensionInference.markStaleSession(sessionId, drawingRef);
      });
    });
    ctx.on("session/disposed", (session) => {
      const sessionId = String(session.id);
      this.partitionWorkflow.disposeSession(sessionId);
      this.sessions.disposeSession(sessionId);
    });
  }
  getSessionState(agent) {
    return this.sessions.get(String(agent.id));
  }
  importDrawing(agent, request) {
    return this.partitionWorkflow.importDrawing(agent, request);
  }
  stageDocuments(agent, request) {
    return this.partitionWorkflow.stageDocuments(agent, request.engineeringDocuments);
  }
  clearDocuments(agent) {
    return this.partitionWorkflow.clearDocuments(agent);
  }
  importAndAnalyze(agent, request) {
    return this.partitionWorkflow.importAndAnalyze(agent, request);
  }
  supplementDocuments(agent, request) {
    return this.partitionWorkflow.supplementDocuments(agent, request);
  }
  getPartitionState(agent) {
    return this.partitionWorkflow.getState(agent);
  }
  editPartition(agent, command) {
    const result = this.partitionWorkflow.edit(agent, command);
    this.dimensionInference.markStale(agent, result.drawingRef ?? command.expectedDrawingRef);
    return result;
  }
  confirmPartition(agent, expected) {
    const result = this.partitionWorkflow.confirm(agent, expected);
    this.dimensionInference.markStale(agent, result.drawingRef ?? expected);
    return result;
  }
  cancelPartition(agent, expected) {
    return this.partitionWorkflow.cancel(agent, expected);
  }
  reopenPartition(agent, expected) {
    return this.partitionWorkflow.reopen(agent, expected);
  }
  undoPartition(agent, expected) {
    return this.partitionWorkflow.undo(agent, expected);
  }
  redoPartition(agent, expected) {
    return this.partitionWorkflow.redo(agent, expected);
  }
  getDimensionPlan(agent) {
    return this.dimensionInference.getState(agent);
  }
  editDimensionScheme(agent, command) {
    return this.dimensionInference.edit(agent, command);
  }
  confirmDimensionPlan(agent, expected) {
    return this.dimensionInference.confirm(agent, expected);
  }
  cancelDimensionPlan(agent, expected) {
    return this.dimensionInference.cancel(agent, expected);
  }
  undoDimensionPlan(agent, expected) {
    return this.dimensionInference.undo(agent, expected);
  }
  redoDimensionPlan(agent, expected) {
    return this.dimensionInference.redo(agent, expected);
  }
}
_init = __decoratorStart(_a2);
__decorateElement(_init, 1, "getSessionState", _getSessionState_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "importDrawing", _importDrawing_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "stageDocuments", _stageDocuments_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "clearDocuments", _clearDocuments_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "importAndAnalyze", _importAndAnalyze_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "supplementDocuments", _supplementDocuments_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "getPartitionState", _getPartitionState_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "editPartition", _editPartition_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "confirmPartition", _confirmPartition_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "cancelPartition", _cancelPartition_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "reopenPartition", _reopenPartition_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "undoPartition", _undoPartition_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "redoPartition", _redoPartition_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "getDimensionPlan", _getDimensionPlan_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "editDimensionScheme", _editDimensionScheme_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "confirmDimensionPlan", _confirmDimensionPlan_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "cancelDimensionPlan", _cancelDimensionPlan_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "undoDimensionPlan", _undoDimensionPlan_dec, DrawingAnnotationHostService);
__decorateElement(_init, 1, "redoDimensionPlan", _redoDimensionPlan_dec, DrawingAnnotationHostService);
__decoratorMetadata(_init, DrawingAnnotationHostService);
__publicField(DrawingAnnotationHostService, "inject", ["tools", "drawingSpace", "attachments", "agents", "subagents"]);
export {
  AnnotationSessionStateStore,
  DimensionInferenceService,
  DimensionPlanStore,
  DrawingAnnotationHostService,
  FileAnnotationSessionStorage,
  FileDimensionPlanStorage,
  createDimensionChainStartTool,
  createEngineeringAnnotationTool,
  DrawingAnnotationHostService as default,
  planEngineeringAnnotations
};
