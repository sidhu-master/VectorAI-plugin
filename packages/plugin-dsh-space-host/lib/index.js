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
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name, decorators, target, extra) => {
  var fn, it, done, ctx, access2, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name]() {
    return __privateGet(this, extra);
  }, set [name](x) {
    return __privateSet(this, extra, x);
  } }, name));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name) : __name(target, name);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name, done = {}, array[3], extraInitializers);
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
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _pending, _drawings, _vectorizer, _drawingId, _process, _timeoutMs, _pending2, _closed, _stderr, _PythonVectorizationProvider_instances, invoke_fn, onLine_fn, reject_fn, failAll_fn, _timeoutMs2, _commit_dec, _getSnapshot_dec, _a, _init;
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { isDeepStrictEqual } from "node:util";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { randomUUID, createHash } from "node:crypto";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
const PLUGIN_NAME = "@vectorai/plugin-dsh-space-host";
const INSTRUCTION = [
  "A new drawing image is pending in the local VectorAI Space plugin.",
  "Call drawing_import before describing, inspecting, or modifying the drawing.",
  "Do not claim that the drawing was inspected until drawing_import succeeds."
].join(" ");
function findLatestImage(messages) {
  var _a2;
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const content = ((_a2 = messages[messageIndex]) == null ? void 0 : _a2.content) ?? [];
    for (let blockIndex = content.length - 1; blockIndex >= 0; blockIndex -= 1) {
      const block = content[blockIndex];
      if ((block == null ? void 0 : block.type) === "image") return structuredClone(block.attachment);
    }
  }
  return null;
}
function createPreStepIntake(repository) {
  return async (payload, next) => {
    const decision = await next();
    if (decision.kind === "reject" || payload.signal.aborted) return decision;
    const attachment = findLatestImage(decision.messages);
    if (attachment === null) return decision;
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
    return { kind: "enter", messages: [...decision.messages, context] };
  };
}
class InMemoryDrawingRepository {
  constructor(input) {
    __privateAdd(this, _pending, /* @__PURE__ */ new Map());
    __privateAdd(this, _drawings, /* @__PURE__ */ new Map());
    __privateAdd(this, _vectorizer);
    __privateAdd(this, _drawingId);
    __privateSet(this, _vectorizer, input.vectorizer);
    __privateSet(this, _drawingId, input.drawingId ?? ((_sessionId, attachment) => `drawing_${String(attachment.attachmentId)}`));
  }
  bindPending(sessionId, attachment) {
    __privateGet(this, _pending).set(sessionId, structuredClone(attachment));
  }
  getPending(sessionId) {
    const attachment = __privateGet(this, _pending).get(sessionId);
    return attachment === void 0 ? null : structuredClone(attachment);
  }
  async importPending(sessionId, input) {
    const attachment = __privateGet(this, _pending).get(sessionId);
    if (attachment === void 0) throw new Error("PENDING_DRAWING_SOURCE_REQUIRED");
    const attachmentId = String(attachment.attachmentId);
    const current = __privateGet(this, _drawings).get(sessionId);
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
    __privateGet(this, _drawings).set(sessionId, {
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
    });
    return {
      status: "imported",
      ref: { drawingId, revision: 1 },
      provisional: vectorized.provisional
    };
  }
  getSnapshot(sessionId) {
    const entry = __privateGet(this, _drawings).get(sessionId);
    if (entry === void 0) return null;
    return snapshotOf(entry);
  }
  commit(sessionId, request) {
    const entry = __privateGet(this, _drawings).get(sessionId);
    if (entry === void 0) {
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
    document.metadata.updatedAt = Date.now();
    entry.document = document;
    entry.revision += 1;
    return { status: "committed", snapshot: snapshotOf(entry) };
  }
  summarize(sessionId) {
    const entry = __privateGet(this, _drawings).get(sessionId);
    if (entry === void 0) return null;
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
  disposeSession(sessionId) {
    __privateGet(this, _pending).delete(sessionId);
    __privateGet(this, _drawings).delete(sessionId);
  }
}
_pending = new WeakMap();
_drawings = new WeakMap();
_vectorizer = new WeakMap();
_drawingId = new WeakMap();
function snapshotOf(entry) {
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
    provisional: entry.provisional
  });
}
function applyCommand(document, command) {
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
      var _a2;
      const sessionId = (_a2 = exec.agent) == null ? void 0 : _a2.id;
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
      var _a2;
      const sessionId = (_a2 = exec.agent) == null ? void 0 : _a2.id;
      if (sessionId === void 0) throw new Error("DRAWING_SESSION_REQUIRED");
      const summary = drawings.summarize(String(sessionId));
      if (summary === null) throw new Error("DRAWING_REQUIRED");
      return summary;
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
const DEFAULT_VECTORIZATION_TIMEOUT_MS = 12e4;
class PythonVectorizationError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
    this.name = "PythonVectorizationError";
  }
}
const _PythonVectorizationProvider = class _PythonVectorizationProvider {
  constructor(process2, timeoutMs) {
    __privateAdd(this, _PythonVectorizationProvider_instances);
    __privateAdd(this, _process);
    __privateAdd(this, _timeoutMs);
    __privateAdd(this, _pending2, /* @__PURE__ */ new Map());
    __privateAdd(this, _closed, false);
    __privateAdd(this, _stderr, "");
    __privateSet(this, _process, process2);
    __privateSet(this, _timeoutMs, timeoutMs);
    createInterface({ input: process2.stdout }).on("line", (line) => __privateMethod(this, _PythonVectorizationProvider_instances, onLine_fn).call(this, line));
    process2.stderr.setEncoding("utf8");
    process2.stderr.on("data", (chunk) => {
      __privateSet(this, _stderr, `${__privateGet(this, _stderr)}${chunk}`.slice(-4096));
    });
    process2.on("error", () => __privateMethod(this, _PythonVectorizationProvider_instances, failAll_fn).call(this, new PythonVectorizationError("PYTHON_VECTORIZATION_PROCESS_ERROR")));
    process2.on("exit", () => {
      if (!__privateGet(this, _closed)) {
        __privateMethod(this, _PythonVectorizationProvider_instances, failAll_fn).call(this, new PythonVectorizationError("PYTHON_VECTORIZATION_EXITED"));
      }
    });
  }
  static async create(options = {}) {
    var _a2;
    const pythonPath = options.pythonPath ?? await defaultPythonPath();
    const scriptPath = options.scriptPath ?? resolve(process.cwd(), "python/vectorai_vectorizer.py");
    const timeoutMs = options.timeoutMs ?? DEFAULT_VECTORIZATION_TIMEOUT_MS;
    const startupTimeoutMs = options.startupTimeoutMs ?? Math.max(1e3, timeoutMs);
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
      throw new PythonVectorizationError("PYTHON_VECTORIZATION_TIMEOUT_INVALID");
    }
    if (!Number.isInteger(startupTimeoutMs) || startupTimeoutMs < 1) {
      throw new PythonVectorizationError("PYTHON_VECTORIZATION_STARTUP_TIMEOUT_INVALID");
    }
    const child = spawn(pythonPath, ["-u", scriptPath], {
      cwd: process.cwd(),
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
      stdio: ["pipe", "pipe", "pipe"]
    });
    const provider = new _PythonVectorizationProvider(child, timeoutMs);
    try {
      await __privateMethod(_a2 = provider, _PythonVectorizationProvider_instances, invoke_fn).call(_a2, { operation: "health" }, new AbortController().signal, startupTimeoutMs);
      return provider;
    } catch (error) {
      await provider.close();
      throw error;
    }
  }
  async vectorize(input) {
    if (!Number.isInteger(input.maxPixels) || input.maxPixels < 1) {
      throw new PythonVectorizationError("PYTHON_VECTORIZATION_BUDGET_INVALID");
    }
    if (input.source.bytes.byteLength === 0 || input.source.width < 1 || input.source.height < 1) {
      throw new PythonVectorizationError("PYTHON_VECTORIZATION_SOURCE_INVALID");
    }
    const value = await __privateMethod(this, _PythonVectorizationProvider_instances, invoke_fn).call(this, {
      operation: "vectorize",
      sourceId: input.source.sourceId,
      mimeType: input.source.mimeType,
      imageBase64: Buffer.from(input.source.bytes).toString("base64"),
      maxPixels: input.maxPixels
    }, input.signal);
    return parseVectorizationResult(value, input.source.sourceId);
  }
  async close() {
    if (__privateGet(this, _closed)) return;
    __privateSet(this, _closed, true);
    __privateMethod(this, _PythonVectorizationProvider_instances, failAll_fn).call(this, new PythonVectorizationError("PYTHON_VECTORIZATION_CLOSED"));
    if (__privateGet(this, _process).exitCode !== null || __privateGet(this, _process).signalCode !== null) return;
    await new Promise((resolveClose) => {
      const timer = setTimeout(() => {
        __privateGet(this, _process).kill("SIGKILL");
        resolveClose();
      }, 1e3);
      __privateGet(this, _process).once("exit", () => {
        clearTimeout(timer);
        resolveClose();
      });
      __privateGet(this, _process).kill("SIGTERM");
    });
  }
};
_process = new WeakMap();
_timeoutMs = new WeakMap();
_pending2 = new WeakMap();
_closed = new WeakMap();
_stderr = new WeakMap();
_PythonVectorizationProvider_instances = new WeakSet();
invoke_fn = function(payload, signal, timeoutMs = __privateGet(this, _timeoutMs)) {
  if (__privateGet(this, _closed)) return Promise.reject(new PythonVectorizationError("PYTHON_VECTORIZATION_CLOSED"));
  if (signal.aborted) return Promise.reject(signal.reason ?? new PythonVectorizationError("PYTHON_VECTORIZATION_ABORTED"));
  const id = randomUUID();
  return new Promise((resolveValue, reject) => {
    const abort = () => __privateMethod(this, _PythonVectorizationProvider_instances, reject_fn).call(this, id, signal.reason ?? new PythonVectorizationError("PYTHON_VECTORIZATION_ABORTED"));
    signal.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => {
      __privateMethod(this, _PythonVectorizationProvider_instances, reject_fn).call(this, id, new PythonVectorizationError("PYTHON_VECTORIZATION_TIMEOUT"));
    }, timeoutMs);
    __privateGet(this, _pending2).set(id, {
      resolve: resolveValue,
      reject,
      timer,
      removeAbortListener: () => signal.removeEventListener("abort", abort)
    });
    __privateGet(this, _process).stdin.write(`${JSON.stringify({ id, ...payload })}
`, (error) => {
      if (error) __privateMethod(this, _PythonVectorizationProvider_instances, reject_fn).call(this, id, new PythonVectorizationError("PYTHON_VECTORIZATION_WRITE_FAILED"));
    });
  });
};
onLine_fn = function(line) {
  let response;
  try {
    response = JSON.parse(line);
  } catch {
    __privateMethod(this, _PythonVectorizationProvider_instances, failAll_fn).call(this, new PythonVectorizationError("PYTHON_VECTORIZATION_PROTOCOL_INVALID"));
    return;
  }
  if (typeof response.id !== "string") return;
  const pending = __privateGet(this, _pending2).get(response.id);
  if (!pending) return;
  __privateGet(this, _pending2).delete(response.id);
  clearTimeout(pending.timer);
  pending.removeAbortListener();
  if (response.ok === true) pending.resolve(response.value);
  else pending.reject(new PythonVectorizationError(response.code || "PYTHON_VECTORIZATION_FAILED"));
};
reject_fn = function(id, error) {
  const pending = __privateGet(this, _pending2).get(id);
  if (!pending) return;
  __privateGet(this, _pending2).delete(id);
  clearTimeout(pending.timer);
  pending.removeAbortListener();
  pending.reject(error);
};
failAll_fn = function(error) {
  for (const id of [...__privateGet(this, _pending2).keys()]) __privateMethod(this, _PythonVectorizationProvider_instances, reject_fn).call(this, id, error);
};
let PythonVectorizationProvider = _PythonVectorizationProvider;
async function defaultPythonPath() {
  if (process.env.VECTORAI_CV_PYTHON) return process.env.VECTORAI_CV_PYTHON;
  const local = resolve(process.cwd(), ".local/vectorai/cv-venv/bin/python");
  try {
    await access(local);
    return local;
  } catch {
    return "python3";
  }
}
function parseVectorizationResult(value, expectedSourceId) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PythonVectorizationError("PYTHON_VECTORIZATION_RESULT_INVALID");
  }
  const result = value;
  if (result.sourceId !== expectedSourceId || typeof result.pipelineVersion !== "string" || !positiveInteger(result.width) || !positiveInteger(result.height) || !positive$1(result.analysisScale) || !positive$1(result.medianLineWidthPx) || !Array.isArray(result.chains)) {
    throw new PythonVectorizationError("PYTHON_VECTORIZATION_RESULT_INVALID");
  }
  for (const chain of result.chains) validateChain(chain, result.width, result.height);
  return {
    sourceId: result.sourceId,
    pipelineVersion: result.pipelineVersion,
    width: result.width,
    height: result.height,
    analysisScale: result.analysisScale,
    medianLineWidthPx: result.medianLineWidthPx,
    chains: result.chains.map((value2) => {
      const chain = value2;
      const bounds = chain.bounds;
      return {
        id: chain.id,
        closed: chain.closed,
        samples: structuredClone(chain.samples),
        simplified: structuredClone(chain.simplified),
        bounds: { x: bounds[0], y: bounds[1], width: bounds[2], height: bounds[3] },
        pieces: chain.pieces.map((piece) => {
          const pieceBounds = piece.bounds;
          return {
            id: piece.id,
            sampleRange: structuredClone(piece.sampleRange),
            wraps: piece.wraps,
            closed: piece.closed,
            simplified: structuredClone(piece.simplified),
            bounds: {
              x: pieceBounds[0],
              y: pieceBounds[1],
              width: pieceBounds[2],
              height: pieceBounds[3]
            },
            candidate: structuredClone(piece.candidate)
          };
        }),
        segmentation: structuredClone(chain.segmentation)
      };
    })
  };
}
function validateChain(value, width, height) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PythonVectorizationError("PYTHON_VECTORIZATION_CHAIN_INVALID");
  }
  const chain = value;
  if (typeof chain.id !== "string" || !/^chain_[a-f0-9]{20}$/.test(chain.id) || typeof chain.closed !== "boolean" || !points(chain.samples, width, height) || !points(chain.simplified, width, height) || !rect(chain.bounds, width, height) || !validPieces(chain.pieces, chain.closed, chain.samples.length, width, height) || !validSegmentation(chain.segmentation, chain.samples.length)) {
    throw new PythonVectorizationError("PYTHON_VECTORIZATION_CHAIN_INVALID");
  }
}
function validPieces(value, chainClosed, sampleCount, width, height) {
  if (!Array.isArray(value) || value.length === 0) return false;
  const pieces = value;
  if (!pieces.every((piece) => piece && typeof piece === "object" && !Array.isArray(piece) && typeof piece.id === "string" && /^piece_[a-f0-9]{20}$/.test(piece.id) && Array.isArray(piece.sampleRange) && piece.sampleRange.length === 2 && piece.sampleRange.every((item) => Number.isInteger(item) && item >= 0 && item < sampleCount) && typeof piece.wraps === "boolean" && typeof piece.closed === "boolean" && points(piece.simplified, width, height) && rect(piece.bounds, width, height) && (piece.candidate === null || validCandidate(piece.candidate)))) return false;
  const ids = new Set(pieces.map((piece) => piece.id));
  if (ids.size !== pieces.length) return false;
  const ranges = pieces.map((piece) => piece.sampleRange);
  if (chainClosed === false) {
    return pieces.every((piece) => piece.closed === false && piece.wraps === false) && ranges[0][0] === 0 && ranges.at(-1)[1] === sampleCount - 1 && ranges.every(([start, end], index) => end > start && (index === 0 || ranges[index - 1][1] === start));
  }
  if (pieces.length === 1) {
    return pieces[0].closed === true && pieces[0].wraps === true && ranges[0][0] === 0 && ranges[0][1] === sampleCount - 1;
  }
  return pieces.every((piece) => piece.closed === false) && pieces.filter((piece) => piece.wraps).length === 1 && pieces.at(-1).wraps === true && ranges.every(([start, end], index) => start !== end && (index === pieces.length - 1 ? end === ranges[0][0] : !pieces[index].wraps && end === ranges[index + 1][0] && end > start));
}
function validSegmentation(value, sampleCount) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const audit = value;
  const positiveFields = [
    "drawingDiagonalPx",
    "chainLengthPx",
    "fitTolerancePx",
    "nearWindowPx",
    "farWindowPx",
    "minimumSpanPx",
    "splitPenalty"
  ];
  if (typeof audit.algorithmVersion !== "string" || !audit.algorithmVersion || !positiveFields.every((field) => positive$1(audit[field])) || !Array.isArray(audit.decisions)) return false;
  if (audit.cycleAssembly !== void 0 && !validCycleAssembly(audit.cycleAssembly)) return false;
  if (audit.continuationAssembly !== void 0 && !validContinuationAssembly(audit.continuationAssembly)) return false;
  return audit.decisions.every((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const decision = item;
    return Number.isInteger(decision.sampleIndex) && decision.sampleIndex >= 0 && decision.sampleIndex < sampleCount && finite$1(decision.nearAngleDegrees) && finite$1(decision.farAngleDegrees) && finite$1(decision.stability) && finite$1(decision.cornerScore) && nullableFinite(decision.combinedFitErrorP95) && Array.isArray(decision.childFitErrorP95) && decision.childFitErrorP95.every(finite$1) && nullableFinite(decision.splitGain) && nullableFinite(decision.acceptScore) && typeof decision.accepted === "boolean" && typeof decision.reason === "string" && decision.reason.length > 0;
  });
}
function validCycleAssembly(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const audit = value;
  return audit.sourceChainCount === 2 && positive$1(audit.endpointTolerancePx) && positive$1(audit.fitTolerancePx) && finite$1(audit.fitErrorP95) && audit.fitErrorP95 >= 0 && audit.fitErrorP95 <= audit.fitTolerancePx && audit.reason === "shared-endpoints-circle-fit";
}
function validContinuationAssembly(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const audit = value;
  return Number.isInteger(audit.sourceChainCount) && audit.sourceChainCount >= 2 && positive$1(audit.endpointTolerancePx) && positive$1(audit.fitTolerancePx) && finite$1(audit.fitErrorP95) && audit.fitErrorP95 >= 0 && audit.fitErrorP95 <= audit.fitTolerancePx && finite$1(audit.tangentCosine) && audit.tangentCosine >= -1 && audit.tangentCosine <= 1 && (audit.modelType === "line" || audit.modelType === "arc") && audit.reason === "shared-endpoint-smooth-analytic-fit";
}
function validCandidate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value;
  return ["line", "circle", "arc", "ellipse"].includes(String(candidate.type)) && candidate.parameters !== null && typeof candidate.parameters === "object" && finite$1(candidate.fitErrorMean) && finite$1(candidate.fitErrorP95) && finite$1(candidate.fitErrorMax) && finite$1(candidate.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1;
}
function points(value, width, height) {
  return Array.isArray(value) && value.length >= 2 && value.every((point) => Array.isArray(point) && point.length === 2 && finite$1(point[0]) && finite$1(point[1]) && point[0] >= 0 && point[1] >= 0 && point[0] <= width && point[1] <= height);
}
function rect(value, width, height) {
  return Array.isArray(value) && value.length === 4 && value.every(finite$1) && value[0] >= 0 && value[1] >= 0 && value[2] > 0 && value[3] > 0 && value[0] + value[2] <= width + 1e-3 && value[1] + value[3] <= height + 1e-3;
}
function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
function positive$1(value) {
  return finite$1(value) && value > 0;
}
function nullableFinite(value) {
  return value === null || finite$1(value);
}
function finite$1(value) {
  return typeof value === "number" && Number.isFinite(value);
}
const PAGE_WIDTH = 500;
class LocalCleanLineVectorizer {
  constructor(options = {}) {
    __privateAdd(this, _timeoutMs2);
    __privateSet(this, _timeoutMs2, options.timeoutMs ?? 12e4);
  }
  async vectorize(input) {
    input.signal.throwIfAborted();
    const root = resolve(import.meta.dirname, "../../..");
    const localPython = resolve(root, ".local/vectorai/cv-venv/bin/python");
    const packagedScript = resolve(import.meta.dirname, "vectorai_vectorizer.py");
    const provider = await PythonVectorizationProvider.create({
      pythonPath: await accessible(localPython) ? localPython : void 0,
      scriptPath: await accessible(packagedScript) ? packagedScript : resolve(root, "python/vectorai_vectorizer.py"),
      timeoutMs: __privateGet(this, _timeoutMs2)
    });
    try {
      const result = await provider.vectorize({
        source: {
          sourceId: String(input.attachment.attachmentId),
          mimeType: input.attachment.mediaType,
          bytes: input.data,
          width: input.attachment.width,
          height: input.attachment.height
        },
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
_timeoutMs2 = new WeakMap();
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
  var _a2, _b;
  const candidates = chain.pieces.map((piece, index) => candidateNode(result, chain, piece, index));
  if (candidates.length > 0 && candidates.every((node) => node !== null)) {
    return candidates;
  }
  const vertices = chain.simplified.slice(0, 256).map((point) => ({ point: sourcePoint(result, point) }));
  if (vertices.length < (chain.closed ? 3 : 2)) return [];
  return [{
    ...commonNode(result, chain, [], ((_b = (_a2 = chain.pieces[0]) == null ? void 0 : _a2.candidate) == null ? void 0 : _b.confidence) ?? 0.8),
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
class DrawingSpaceHostService extends (_a = TypertRemoteService, _getSnapshot_dec = [Remote], _commit_dec = [Remote], _a) {
  constructor(ctx) {
    super(ctx, "drawingSpace");
    __runInitializers(_init, 5, this);
    __publicField(this, "drawings");
    this.drawings = new InMemoryDrawingRepository({
      vectorizer: new LocalCleanLineVectorizer()
    });
    ctx.tools.register(createDrawingImportTool(this.drawings, ctx.attachments));
    ctx.tools.register(createDrawingSummarizeTool(this.drawings));
    ctx.on("agent/pre-step", createPreStepIntake(this.drawings));
    ctx.on("session/disposed", (session) => {
      this.drawings.disposeSession(String(session.id));
    });
  }
  getSnapshot(agent) {
    return this.drawings.getSnapshot(String(agent.id));
  }
  commit(agent, request) {
    return this.drawings.commit(String(agent.id), request);
  }
}
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "getSnapshot", _getSnapshot_dec, DrawingSpaceHostService);
__decorateElement(_init, 1, "commit", _commit_dec, DrawingSpaceHostService);
__decoratorMetadata(_init, DrawingSpaceHostService);
__publicField(DrawingSpaceHostService, "inject", ["tools", "attachments"]);
export {
  DrawingSpaceHostService,
  InMemoryDrawingRepository,
  LocalCleanLineVectorizer,
  DrawingSpaceHostService as default
};
