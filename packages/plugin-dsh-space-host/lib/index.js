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
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
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
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name] = y;
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
var _pending, _drawings, _vectorizer, _drawingId, _getProjection_dec, _a, _init;
import { TypertRemoteService, Remote } from "@deepseek-ai/dsh-typert-protocol";
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";
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
        ref: structuredClone(current.projection.ref),
        provisional: current.projection.provisional
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
    const projection = {
      version: 1,
      ref: { drawingId, revision: 1 },
      source: structuredClone(vectorized.source),
      bounds: structuredClone(vectorized.bounds),
      geometry: structuredClone(vectorized.geometry),
      provisional: vectorized.provisional
    };
    __privateGet(this, _drawings).set(sessionId, {
      attachmentId,
      document: structuredClone(vectorized.document),
      projection
    });
    return {
      status: "imported",
      ref: structuredClone(projection.ref),
      provisional: projection.provisional
    };
  }
  getProjection(sessionId) {
    const entry = __privateGet(this, _drawings).get(sessionId);
    return entry === void 0 ? null : structuredClone(entry.projection);
  }
  summarize(sessionId) {
    const entry = __privateGet(this, _drawings).get(sessionId);
    if (entry === void 0) return null;
    const geometryByType = {};
    for (const node of entry.document.geometry) {
      geometryByType[node.type] = (geometryByType[node.type] ?? 0) + 1;
    }
    return {
      ref: structuredClone(entry.projection.ref),
      unit: entry.document.unitSystem.length,
      bounds: structuredClone(entry.projection.bounds),
      geometryByType,
      provisional: entry.projection.provisional
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
        text: `Drawing ${value.ref.drawingId} revision ${value.ref.revision} ${value.status}. The current geometry is provisional.`
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
class ProvisionalFootprintVectorizer {
  async vectorize(input) {
    input.signal.throwIfAborted();
    const { width, height } = input.attachment;
    const lines = footprintLines(width, height);
    const now = Date.now();
    const document = createEmptyDrawing({
      idFactory: { next: () => input.drawingId },
      now: () => now
    });
    document.id = input.drawingId;
    document.geometry = lines.map((line) => ({
      id: line.id,
      type: "line",
      start: line.start,
      end: line.end,
      visible: true,
      quality: {
        status: "candidate",
        confidence: line.confidence,
        evidenceRefs: []
      }
    }));
    return {
      document,
      source: {
        attachmentId: String(input.attachment.attachmentId),
        mediaType: input.attachment.mediaType,
        width,
        height,
        ...input.attachment.name === void 0 ? {} : { name: input.attachment.name },
        dataUrl: `data:${input.attachment.mediaType};base64,${Buffer.from(input.data).toString("base64")}`
      },
      bounds: { minX: 0, minY: 0, maxX: width, maxY: height },
      geometry: lines,
      provisional: true
    };
  }
}
function footprintLines(width, height) {
  const candidate = (id, start, end) => ({
    id,
    type: "line",
    start,
    end,
    status: "candidate",
    confidence: 0.25
  });
  return [
    candidate("source-boundary-top", [0, 0], [width, 0]),
    candidate("source-boundary-right", [width, 0], [width, height]),
    candidate("source-boundary-bottom", [width, height], [0, height]),
    candidate("source-boundary-left", [0, height], [0, 0])
  ];
}
class DrawingSpaceHostService extends (_a = TypertRemoteService, _getProjection_dec = [Remote], _a) {
  constructor(ctx) {
    super(ctx, "drawingSpace");
    __runInitializers(_init, 5, this);
    __publicField(this, "drawings");
    this.drawings = new InMemoryDrawingRepository({
      vectorizer: new ProvisionalFootprintVectorizer()
    });
    ctx.tools.register(createDrawingImportTool(this.drawings, ctx.attachments));
    ctx.tools.register(createDrawingSummarizeTool(this.drawings));
    ctx.on("agent/pre-step", createPreStepIntake(this.drawings));
    ctx.on("session/disposed", (session) => {
      this.drawings.disposeSession(String(session.id));
    });
  }
  getProjection(sessionId) {
    return this.drawings.getProjection(sessionId);
  }
}
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "getProjection", _getProjection_dec, DrawingSpaceHostService);
__decoratorMetadata(_init, DrawingSpaceHostService);
__publicField(DrawingSpaceHostService, "inject", ["tools", "attachments"]);
export {
  DrawingSpaceHostService,
  InMemoryDrawingRepository,
  ProvisionalFootprintVectorizer,
  DrawingSpaceHostService as default
};
