import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import type { DrawingId } from '../src/drawing/index.js';
import { DrawingApplication } from '../api/services/drawing-application/application.js';
import { FileDrawingRepository } from '../api/services/drawing-application/file-drawing-repository.js';
import { RevisionContextLedger } from '../api/services/drawing-agent/context-ledger.js';
import { buildModelWorldContext } from '../api/services/drawing-agent/world-model-context.js';
import { selectModelToolCatalog } from '../api/services/drawing-agent/tool-catalog-policy.js';
import {
  ModelLoopActionAdapter,
  type ModelLoopObservation,
} from '../api/services/drawing-agent/model-loop-adapter.js';
import { DrawingSpatialContextIndex } from '../api/services/drawing-spatial/context-index.js';
import { createModelDrawingToolGateway } from '../api/services/drawing-tools/index.js';
import type { DrawingModelCallTelemetry } from '../api/services/ai-gateway.js';

const rootDirectory = resolve(process.cwd(), process.argv[2] ?? '.local/vectorai/drawings');
const targetPath = await mostPopulatedSnapshot(rootDirectory);
const rawSnapshot = JSON.parse(await readFile(targetPath, 'utf8')) as {
  document: { id: DrawingId };
  commits?: unknown[];
  history?: { commitCount?: number };
};
const repository = new FileDrawingRepository({ rootDirectory });
const application = new DrawingApplication({ repository });

const checkpointStartedAt = performance.now();
const current = await application.readCurrent(rawSnapshot.document.id);
const checkpointMs = performance.now() - checkpointStartedAt;

const indexStartedAt = performance.now();
const spatial = new DrawingSpatialContextIndex(current.document);
const ledger = new RevisionContextLedger(current.revision);
const allNodeIds = [
  ...current.document.geometry.map((node) => node.id),
  ...current.document.annotations.map((node) => node.id),
  ...current.document.relations.map((node) => node.id),
  ...current.document.features.map((node) => node.id),
];
ledger.registerNodeIds(allNodeIds);
const targetId = current.document.geometry[Math.floor(current.document.geometry.length / 2)]?.id;
if (targetId) ledger.markActive([targetId]);
const workingSet = spatial.workingSet(targetId ? [targetId] : [], { limit: 48 });
const globalMap = spatial.globalMap();
const indexMs = performance.now() - indexStartedAt;

const worldStartedAt = performance.now();
const worldContext = buildModelWorldContext({
  document: current.document,
  revision: current.revision,
  localGeometryNodeIds: workingSet.nodes
    .filter((node) => node.plane === 'geometry')
    .map((node) => node.id),
  targetGeometryNodeIds: targetId ? [targetId] : [],
  alias: (nodeId) => ledger.alias(nodeId),
});
const projectedWorkingSet = ledger.projectValue({
  ...workingSet,
  nodes: workingSet.nodes.map((item) => ({
    alias: ledger.alias(item.id),
    plane: item.plane,
    type: item.type,
    relevance: item.relevance,
    ...(item.bounds ? { bounds: item.bounds } : {}),
  })),
});
const worldModelMs = performance.now() - worldStartedAt;

const observationStartedAt = performance.now();
const observed = await application.observeForAgent({
  drawingId: current.document.id,
  includeAnnotations: false,
  selectedIds: targetId ? [targetId] : [],
  selectionIsTarget: false,
});
const observations = observed.views.flatMap((view): ModelLoopObservation[] => {
  const imageDataUrl = application.readObservationImage(view.image.handle);
  return imageDataUrl ? [{
    id: view.id,
    purpose: view.purpose,
    imageDataUrl,
    width: view.width,
    height: view.height,
    worldBounds: view.worldBounds,
    worldToImage: view.worldToImage,
    grounding: view.grounding,
  }] : [];
});
const observationMs = performance.now() - observationStartedAt;

const unavailable = async () => { throw new Error('BENCHMARK_TOOL_NOT_EXECUTED'); };
const gateway = createModelDrawingToolGateway({
  application,
  redraw: { redraw: unavailable as never },
  vectorization: { vectorizeSource: unavailable as never },
  cvTools: { invoke: unavailable as never },
});
const summary = await application.summarize({ drawingId: current.document.id, limit: 12 });
const toolCatalog = selectModelToolCatalog(gateway.registry.catalog(), {
  hasSource: false,
  currentPreview: false,
  knowledgeState: worldContext.worldModelSlice.knowledge.state,
  hasDiagnostics: false,
  decisionSequence: 1,
  completedTools: [],
});

let capturedBody = '';
let telemetry: DrawingModelCallTelemetry | undefined;
const originalFetch = globalThis.fetch;
const previousGateway = process.env.COMPANY_AI_GATEWAY_URL;
const previousToken = process.env.COMPANY_INTERNAL_TOKEN;
process.env.COMPANY_AI_GATEWAY_URL = 'http://context-benchmark.invalid';
process.env.COMPANY_INTERNAL_TOKEN = 'benchmark-token';
globalThis.fetch = async (_url, init) => {
  capturedBody = String(init?.body ?? '');
  return new Response(JSON.stringify({
    ok: true,
    reply: JSON.stringify({ type: 'finish', summary: 'context benchmark' }),
    id: 'benchmark-completion',
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'x-request-id': 'benchmark-request' },
  });
};

try {
  await new ModelLoopActionAdapter().next({
    objective: '基于当前图纸完成局部空间修改，保持非目标区域不变',
    drawingId: current.document.id,
    revision: current.revision,
    episodeId: 'episode_context_benchmark',
    drawingSummary: summary.summary,
    spatialContext: {
      globalMap,
      workingSet: projectedWorkingSet,
      evidenceLedger: ledger.project({
        excludeNodeIds: workingSet.nodes.map((node) => node.id),
      }),
      worldModelSlice: worldContext.worldModelSlice,
      actionFacts: worldContext.actionFacts,
    },
    nodeAliases: ledger.aliasesByNode(),
    toolCatalog,
    recentToolResults: [],
    recentDiagnostics: [],
    decisions: [],
    appendedInstructions: [],
    observations,
    modelName: 'context-benchmark-model',
    attempt: 1,
    signal: new AbortController().signal,
    deadlineAt: Date.now() + 60_000,
    onModelTelemetry: (value) => { telemetry = value; },
  });
} finally {
  globalThis.fetch = originalFetch;
  restoreEnv('COMPANY_AI_GATEWAY_URL', previousGateway);
  restoreEnv('COMPANY_INTERNAL_TOKEN', previousToken);
}

const body = JSON.parse(capturedBody) as {
  messages: Array<{ content: Array<{ type: string; text?: string }> }>;
  response_format: unknown;
};
const userPrompt = body.messages[0]?.content.find((item) => item.type === 'text')?.text ?? '';
const publicContext = JSON.parse(userPrompt) as {
  drawing: {
    workingSet?: { nodes?: unknown[] };
    globalMap?: unknown;
    worldModelSlice?: unknown;
    actionFacts?: unknown;
  };
  evidenceLedger?: unknown;
  observationIndex?: unknown[];
  coordinateContract?: unknown;
  editBaseOptions?: unknown;
  toolCatalog?: unknown[];
};

process.stdout.write(`${JSON.stringify({
  drawingId: current.document.id,
  snapshotBytes: (await stat(targetPath)).size,
  commitCount: rawSnapshot.history?.commitCount ?? rawSnapshot.commits?.length ?? 0,
  nodeCounts: {
    geometry: current.document.geometry.length,
    annotation: current.document.annotations.length,
    relation: current.document.relations.length,
    feature: current.document.features.length,
  },
  timingsMs: {
    coldCheckpointRead: round(checkpointMs),
    spatialIndex: round(indexMs),
    worldModel: round(worldModelMs),
    observationRender: round(observationMs),
  },
  context: {
    requestBytes: telemetry?.requestBytes,
    userPromptBytes: Buffer.byteLength(userPrompt),
    responseSchemaBytes: Buffer.byteLength(JSON.stringify(body.response_format)),
    globalMapBytes: Buffer.byteLength(JSON.stringify(publicContext.drawing.globalMap)),
    workingSetBytes: Buffer.byteLength(JSON.stringify(publicContext.drawing.workingSet)),
    evidenceLedgerBytes: Buffer.byteLength(JSON.stringify(publicContext.evidenceLedger)),
    worldModelBytes: Buffer.byteLength(JSON.stringify(publicContext.drawing.worldModelSlice)),
    actionFactsBytes: Buffer.byteLength(JSON.stringify(publicContext.drawing.actionFacts)),
    observationIndexBytes: Buffer.byteLength(JSON.stringify(publicContext.observationIndex)),
    coordinateContractBytes: Buffer.byteLength(JSON.stringify(publicContext.coordinateContract)),
    editBaseOptionsBytes: Buffer.byteLength(JSON.stringify(publicContext.editBaseOptions)),
    toolCatalogBytes: Buffer.byteLength(JSON.stringify(publicContext.toolCatalog)),
    workingSetNodes: publicContext.drawing.workingSet?.nodes?.length ?? 0,
    observationCount: publicContext.observationIndex?.length ?? 0,
    toolCount: toolCatalog.length,
    registeredToolCount: gateway.registry.catalog().length,
  },
  visual: {
    imageCount: telemetry?.imageCount,
    imageBytes: telemetry?.imageBytes,
    imagePixels: telemetry?.imagePixels,
  },
}, null, 2)}\n`);

async function mostPopulatedSnapshot(directory: string): Promise<string> {
  const paths = (await readdir(directory))
    .filter((name) => name.endsWith('.json'))
    .map((name) => join(directory, name));
  const snapshots = await Promise.all(paths.map(async (path) => {
    const raw = JSON.parse(await readFile(path, 'utf8')) as {
      document?: {
        geometry?: unknown[]; annotations?: unknown[]; relations?: unknown[]; features?: unknown[];
      };
    };
    const document = raw.document;
    const nodeCount = (document?.geometry?.length ?? 0)
      + (document?.annotations?.length ?? 0)
      + (document?.relations?.length ?? 0)
      + (document?.features?.length ?? 0);
    return { path, nodeCount, size: (await stat(path)).size };
  }));
  const representative = snapshots.sort((left, right) => (
    right.nodeCount - left.nodeCount || right.size - left.size
  ))[0];
  if (!representative) throw new Error(`NO_DRAWING_SNAPSHOTS:${directory}`);
  return representative.path;
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
