import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Server } from 'node:http';

import app, { closeAppServices } from '../api/app.js';
import type { DrawingAgentAuditEvent } from '../api/services/drawing-agent/audit-types.js';
import { FileDrawingAgentAuditStore } from '../api/services/drawing-agent/file-audit-store.js';
import { evaluateSemanticEditBenchmark } from '../api/services/drawing-benchmark/semantic-edit.js';
import { materializeSpatialSplits, type SplitLineageEntry } from '../api/services/drawing-spatial/split-materializer.js';
import type { SpatialSelection } from '../src/contracts/drawing-spatial-region.js';
import type { DrawingWorkspaceSnapshot } from '../src/contracts/drawing-application.js';
import type {
  DrawingAgentProgressEvent,
  DrawingAgentRunView,
} from '../src/contracts/drawing-agent.js';
import {
  compileDrawingScene,
  type DrawingCommand,
  type DrawingDocument,
} from '../src/drawing/index.js';

const fixturePath = resolve(process.cwd(), process.argv[2] ?? 'test2.png');
const outputDirectory = resolve(process.cwd(), '.local/vectorai/baselines/test2-region-edit/e2e');
const auditRoot = resolve(process.cwd(), '.local/vectorai/runs');
const fixtureBytes = await readFile(fixturePath);
const server = await listen();
const address = server.address();
if (!address || typeof address === 'string') throw new Error('E2E_SERVER_ADDRESS_UNAVAILABLE');
const baseUrl = `http://127.0.0.1:${address.port}`;
const runContext: Record<string, unknown> = { fixturePath };

try {
  const created = await request<{ workspace: DrawingWorkspaceSnapshot }>('/api/drawings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unit: 'mm' }),
  });
  const drawingId = created.workspace.document.id;
  runContext.drawingId = drawingId;
  const reconstruction = await startRun({
    drawingId,
    baseRevision: created.workspace.revision,
    goal: '根据这张干净线稿创建完整、可编辑的 Drawing IR 图纸',
    attachment: { data: fixtureBytes.toString('base64'), mimeType: 'image/png', page: 1 },
  });
  runContext.reconstructionRunId = reconstruction.runId;
  const reconstructionEvents = await collectProgress(reconstruction.runId);
  const reconstructionState = await runState(reconstruction.runId);
  assertCompleted(reconstructionEvents, 'TEST2_RECONSTRUCTION_FAILED', reconstructionState.error);

  const before = (await request<{ workspace: DrawingWorkspaceSnapshot }>(
    `/api/drawings/${encodeURIComponent(drawingId)}`,
  )).workspace;
  if (before.document.geometry.length === 0) throw new Error('TEST2_RECONSTRUCTION_EMPTY');
  const viewport = viewportFor(before.document);
  const semantic = await startRun({
    drawingId,
    baseRevision: before.revision,
    goal: '把图中人物的右手抬起来打招呼，保持身体、头部、左手和其他图形不变，并保持手臂与身体连接',
    viewport,
  });
  runContext.semanticRunId = semantic.runId;
  const semanticEvents = await collectProgress(semantic.runId);
  const semanticState = await runState(semantic.runId);
  assertCompleted(semanticEvents, 'TEST2_SEMANTIC_EDIT_FAILED', semanticState.error);

  const final = (await request<{ workspace: DrawingWorkspaceSnapshot }>(
    `/api/drawings/${encodeURIComponent(drawingId)}`,
  )).workspace;
  const audit = await readSettledAudit(semantic.runId);
  const targetIds = [...new Set(audit.events.flatMap((event) => (
    event.type === 'intent'
      ? stringArray(event.payload.targetNodeIds, 'intent.targetNodeIds')
      : []
  )))];
  const commands = audit.commits.flatMap((commit) => commit.commands);
  const editedNodeIds = [...new Set([
    ...targetIds,
    ...commands.flatMap((command) => command.type === 'geometry.create' && command.value.id
      ? [command.value.id as string]
      : []),
  ])];
  const affectedBeforeIds = new Set([
    ...commandIds(commands, 'geometry.update'),
    ...commandIds(commands, 'geometry.delete'),
  ]);
  const preservedNodeIds = allNodeIds(before.document).filter((id) => !affectedBeforeIds.has(id));
  const selection = auditSelection(audit.events);
  const lineage = auditLineage(audit.events);
  const sharedPolylineNodeId = sharedSplitSource(lineage);
  const split = materializeSpatialSplits({ document: before.document, selection });
  const expectedProtectedFragments = Object.fromEntries(split.lineage
    .filter((entry) => entry.role === 'protected')
    .map((entry) => {
      const fragment = split.fragments.find((node) => node.id === entry.fragmentId);
      if (!fragment) throw new Error(`TEST2_EXPECTED_PROTECTED_FRAGMENT_MISSING:${entry.fragmentId}`);
      return [entry.fragmentId, fragment];
    }));
  const unexpectedDanglingEndpoints = deterministicDanglingEndpoints(audit.events);
  const report = evaluateSemanticEditBenchmark({
    initialDocument: before.document,
    finalDocument: final.document,
    commits: audit.commits,
    oldTargetNodeIds: [],
    editedNodeIds,
    preservedNodeIds,
    anchors: selection.boundaryAnchors.map((anchor) => ({
      nodeIds: editedNodeIds,
      point: anchor.point,
      tolerance: Math.max(1, 3 / viewport.scale),
    })),
    auditEvents: audit.events,
    progressEvents: semanticEvents,
    regionEvidence: {
      sharedPolylineNodeId,
      expectedProtectedFragments,
      lineage,
      unexpectedDanglingEndpoints,
      closureTolerance: Math.max(1, 3 / viewport.scale),
    },
  });
  const artifact = {
    fixturePath,
    drawingId,
    reconstructionRunId: reconstruction.runId,
    semanticRunId: semantic.runId,
    reconstructedGeometryCount: before.document.geometry.length,
    finalGeometryCount: final.document.geometry.length,
    reconstructionProgressEvents: reconstructionEvents.length,
    semanticProgressEvents: semanticEvents.length,
    sharedPolylineNodeId,
    lineage,
    ...report,
  };
  await mkdir(outputDirectory, { recursive: true });
  const reportPath = resolve(outputDirectory, 'report.json');
  await writeFile(reportPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ reportPath, ...artifact }, null, 2)}\n`);
  if (!report.passed) process.exitCode = 1;
} catch (error) {
  const failure = {
    ...runContext,
    passed: false,
    failure: {
      message: error instanceof Error ? error.message : String(error),
      recordedAt: new Date().toISOString(),
    },
  };
  await mkdir(outputDirectory, { recursive: true });
  const reportPath = resolve(outputDirectory, 'report.json');
  await writeFile(reportPath, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
  process.stderr.write(`${JSON.stringify({ reportPath, ...failure }, null, 2)}\n`);
  process.exitCode = 1;
} finally {
  await new Promise<void>((resolveClose, reject) => server.close((error) => (
    error ? reject(error) : resolveClose()
  )));
  await closeAppServices();
}

async function listen(): Promise<Server> {
  return new Promise((resolveListen, reject) => {
    const listening = app.listen(0, '127.0.0.1');
    listening.once('listening', () => resolveListen(listening));
    listening.once('error', reject);
  });
}

async function startRun(input: Record<string, unknown>): Promise<{ runId: string }> {
  return request('/api/agent/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

async function collectProgress(runId: string): Promise<DrawingAgentProgressEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('E2E_RUN_TIMEOUT')), 420_000);
  const response = await fetch(
    `${baseUrl}/api/agent/runs/${encodeURIComponent(runId)}/events`,
    { signal: controller.signal },
  );
  if (!response.ok || !response.body) {
    clearTimeout(timer);
    throw new Error(`E2E_PROGRESS_UNAVAILABLE:${response.status}`);
  }
  const events: DrawingAgentProgressEvent[] = [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const result = await reader.read();
      buffer += decoder.decode(result.value, { stream: !result.done });
      let boundary = buffer.indexOf('\n\n');
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = frame.split('\n').find((line) => line.startsWith('data: '));
        if (data) events.push(JSON.parse(data.slice(6)) as DrawingAgentProgressEvent);
        boundary = buffer.indexOf('\n\n');
      }
      if (result.done) break;
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  return events;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json().catch(() => ({})) as {
    success?: boolean;
    error?: string | { message?: string };
  } & T;
  if (!response.ok || body.success === false) {
    const message = typeof body.error === 'string' ? body.error : body.error?.message;
    throw new Error(message ?? `E2E_HTTP_${response.status}`);
  }
  return body;
}

function assertCompleted(
  events: DrawingAgentProgressEvent[],
  code: string,
  stateError: string | null,
): void {
  const terminal = events.at(-1);
  if (terminal?.type !== 'completed') {
    throw new Error(
      `${code}:${terminal?.type ?? 'NO_EVENTS'}:${stateError ?? terminal?.detail ?? terminal?.title ?? ''}`,
    );
  }
}

async function runState(runId: string): Promise<DrawingAgentRunView> {
  return (await request<{ run: DrawingAgentRunView }>(
    `/api/agent/runs/${encodeURIComponent(runId)}`,
  )).run;
}

async function readSettledAudit(runId: string) {
  const store = new FileDrawingAgentAuditStore({ rootDirectory: auditRoot });
  let latest: Awaited<ReturnType<FileDrawingAgentAuditStore['readRun']>> | undefined;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    latest = await store.readRun(runId);
    const hasTerminalState = latest.events.some((event) => (
      event.type === 'state' && ['COMPLETED', 'FAILED'].includes(String(event.payload.event))
    ));
    if (hasTerminalState && latest.commits.length > 0) return latest;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  if (!latest) throw new Error('TEST2_AUDIT_UNAVAILABLE');
  return latest;
}

function auditSelection(events: DrawingAgentAuditEvent[]): SpatialSelection {
  const payload = events.find((event) => event.type === 'selection')?.payload;
  if (!payload || typeof payload.selectionVersionId !== 'string'
    || typeof payload.regionId !== 'string' || typeof payload.revision !== 'string'
    || !Array.isArray(payload.wholeNodes) || !Array.isArray(payload.crossingNodes)
    || !Array.isArray(payload.boundaryAnchors) || !Array.isArray(payload.splitPlan)) {
    throw new Error('TEST2_SELECTION_AUDIT_MISSING');
  }
  return {
    regionId: payload.regionId,
    revision: payload.revision as SpatialSelection['revision'],
    wholeNodes: payload.wholeNodes as SpatialSelection['wholeNodes'],
    partialSegments: [],
    crossingNodes: payload.crossingNodes as SpatialSelection['crossingNodes'],
    protectedNodes: [],
    boundaryAnchors: payload.boundaryAnchors as SpatialSelection['boundaryAnchors'],
    classifications: [],
    uncertainParts: [],
    splitPlan: payload.splitPlan as SpatialSelection['splitPlan'],
  };
}

function auditLineage(events: DrawingAgentAuditEvent[]): SplitLineageEntry[] {
  const entries = events.find((event) => event.type === 'lineage')?.payload.entries;
  if (!Array.isArray(entries)) throw new Error('TEST2_LINEAGE_AUDIT_MISSING');
  return entries as SplitLineageEntry[];
}

function sharedSplitSource(lineage: SplitLineageEntry[]): string {
  const sources = [...new Set(lineage.map((entry) => entry.sourceNodeId))];
  const source = sources.find((id) => {
    const entries = lineage.filter((entry) => entry.sourceNodeId === id);
    return entries.some((entry) => entry.role === 'target')
      && entries.some((entry) => entry.role === 'protected');
  });
  if (!source) throw new Error('TEST2_SHARED_POLYLINE_SPLIT_MISSING');
  return source;
}

function deterministicDanglingEndpoints(events: DrawingAgentAuditEvent[]) {
  const value = events.find((event) => event.type === 'verification'
    && event.payload.phase === 'deterministic-spatial')?.payload.unexpectedDanglingEndpoints;
  if (!Array.isArray(value)) throw new Error('TEST2_DETERMINISTIC_VERIFICATION_MISSING');
  return value as Array<readonly [number, number]>;
}

function commandIds(commands: DrawingCommand[], type: DrawingCommand['type']): string[] {
  return commands.flatMap((command) => command.type === type && 'id' in command
    ? [command.id as string]
    : []);
}

function stringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`TEST2_AUDIT_INVALID:${path}`);
  }
  return value;
}

function allNodeIds(document: DrawingDocument): string[] {
  return [
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => node.id as string);
}

function viewportFor(document: DrawingDocument) {
  const scene = compileDrawingScene(document, { revision: 'benchmark_preview' as never });
  const bounds = scene.worldBounds;
  if (!bounds) return { scale: 1, offsetX: 80, offsetY: 720, width: 1200, height: 800 };
  const width = 1200;
  const height = 800;
  const padding = 60;
  const scale = Math.max(0.01, Math.min(
    (width - padding * 2) / Math.max(1, bounds.maxX - bounds.minX),
    (height - padding * 2) / Math.max(1, bounds.maxY - bounds.minY),
  ));
  return {
    scale,
    offsetX: padding - bounds.minX * scale,
    offsetY: padding + bounds.maxY * scale,
    width,
    height,
  };
}
