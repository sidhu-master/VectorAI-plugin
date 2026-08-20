import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { Server } from 'node:http';

import app, { closeAppServices } from '../api/app.js';
import type { DrawingAgentAuditEvent } from '../api/services/drawing-agent/audit-types.js';
import { FileDrawingAgentAuditStore } from '../api/services/drawing-agent/file-audit-store.js';
import { DrawingApplication } from '../api/services/drawing-application/application.js';
import type { DrawingWorkspaceSnapshot } from '../src/contracts/drawing-application.js';
import type {
  DrawingAgentProgressEvent,
  DrawingAgentRunView,
} from '../src/contracts/drawing-agent.js';
import {
  compileDrawingScene,
  MemoryDrawingRepository,
  type DrawingCommand,
  type DrawingDocument,
  type GeometryId,
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
    // Match the real image-only UI path: reconstruction is an internal interpretation,
    // not a synthetic user message and does not require a model routing turn.
    goal: '',
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
    goal: '把图中人物的右手抬起来打招呼',
    stableRules: [
      '除非用户明确要求，否则保持非目标内容、已有连接关系、轮廓连续性与原图样式不变',
      '不得产生新的悬空端点；标注是次要派生信息，不能阻止几何编辑',
    ],
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
  const commands = audit.commits.flatMap((commit) => commit.commands);
  const assessment = assessSemanticEdit({
    before: before.document,
    after: final.document,
    commands,
    auditEvents: audit.events,
    progressEvents: semanticEvents,
  });
  const imagePath = resolve(outputDirectory, 'final-preview.png');
  await mkdir(outputDirectory, { recursive: true });
  await renderGeometry(final.document, assessment.affectedNodeIds, imagePath);
  const artifact = {
    fixturePath,
    drawingId,
    reconstructionRunId: reconstruction.runId,
    semanticRunId: semantic.runId,
    reconstructedGeometryCount: before.document.geometry.length,
    finalGeometryCount: final.document.geometry.length,
    reconstructionProgressEvents: reconstructionEvents.length,
    semanticProgressEvents: semanticEvents.length,
    imagePath,
    ...assessment,
  };
  const reportPath = resolve(outputDirectory, 'report.json');
  await writeFile(reportPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify({ reportPath, ...artifact }, null, 2)}\n`);
  if (!assessment.passed) process.exitCode = 1;
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

function assessSemanticEdit(input: {
  before: DrawingDocument;
  after: DrawingDocument;
  commands: DrawingCommand[];
  auditEvents: DrawingAgentAuditEvent[];
  progressEvents: DrawingAgentProgressEvent[];
}) {
  const affectedNodeIds = [...new Set(input.commands.flatMap(commandNodeIds))];
  const updatedNodeIds = [...new Set(input.commands.flatMap((command) => (
    command.type === 'geometry.update' ? [command.id as string] : []
  )))];
  const beforeGeometry = new Map(input.before.geometry.map((node) => [node.id as string, node]));
  const afterGeometry = new Map(input.after.geometry.map((node) => [node.id as string, node]));
  const movedCircles = updatedNodeIds.flatMap((id) => {
    const before = beforeGeometry.get(id);
    const after = afterGeometry.get(id);
    return before?.type === 'circle' && after?.type === 'circle'
      ? [{ id, before, after }]
      : [];
  });
  const carrier = movedCircles[0];
  const sceneBounds = compileDrawingScene(input.before, {
    revision: 'benchmark_before' as never,
  }).worldBounds;
  const drawingCenterX = sceneBounds ? (sceneBounds.minX + sceneBounds.maxX) / 2 : 0;
  const worldDelta = carrier
    ? [
        carrier.after.center[0] - carrier.before.center[0],
        carrier.after.center[1] - carrier.before.center[1],
      ] as const
    : null;
  const interfaceDeviations = carrier
    ? input.commands.flatMap((command) => endpointBoundaryDeviations(
        command,
        afterGeometry,
        carrier.after.center,
        carrier.after.radius,
      ))
    : [];
  const beforeNodes = nodeSnapshotMap(input.before);
  const afterNodes = nodeSnapshotMap(input.after);
  const affected = new Set(affectedNodeIds);
  const changedProtectedIds = [...beforeNodes].flatMap(([id, value]) => (
    affected.has(id) || afterNodes.get(id) === value ? [] : [id]
  ));

  const commitActionIndex = lastIndexMatching(input.auditEvents, (event) => (
    event.type === 'model_action' && event.payload.type === 'commit'
  ));
  const commitAction = commitActionIndex >= 0 ? input.auditEvents[commitActionIndex] : undefined;
  const committedPreviewHandle = typeof commitAction?.payload.previewHandle === 'string'
    ? commitAction.payload.previewHandle
    : null;
  const visualVerificationIndex = lastIndexMatching(input.auditEvents, (event) => (
    event.type === 'verification'
    && event.payload.phase === 'preview-final'
    && event.payload.satisfied === true
    && (!committedPreviewHandle || event.payload.previewHandle === committedPreviewHandle)
  ));
  const reviewResultIndex = lastIndexMatching(input.auditEvents, (event) => (
    event.type === 'verification'
    && event.payload.phase === 'preview-review-result'
    && (!committedPreviewHandle || event.payload.previewHandle === committedPreviewHandle)
  ));
  const commitIndex = lastIndexMatching(input.auditEvents, (event) => event.type === 'commit');
  const visualVerification = visualVerificationIndex >= 0
    ? input.auditEvents[visualVerificationIndex]
    : undefined;
  const reviewResult = reviewResultIndex >= 0
    ? input.auditEvents[reviewResultIndex]
    : undefined;
  const reviewResultHandle = typeof reviewResult?.payload.previewHandle === 'string'
    ? reviewResult.payload.previewHandle
    : null;

  const previewProgressIndex = input.progressEvents.findIndex((event) => (
    event.type === 'previewing' && Boolean(event.perceptionDelta)
  ));
  const verifyProgressIndex = input.progressEvents.findIndex((event, index) => (
    index > previewProgressIndex && event.type === 'verifying'
  ));
  const committedProgressIndex = input.progressEvents.findIndex((event) => event.type === 'committed');
  const tolerance = carrier ? Math.max(0.5, carrier.after.radius * 0.02) : 0.5;

  const checks = [
    {
      id: 'single-analytic-carrier-selected',
      passed: movedCircles.length === 1,
      detail: `movedCircles=${movedCircles.map((item) => item.id).join(',') || 'none'}`,
    },
    {
      id: 'world-direction-is-visual-up',
      passed: Boolean(worldDelta && worldDelta[1] > 0),
      detail: `worldDelta=${JSON.stringify(worldDelta)}`,
    },
    {
      id: 'anatomical-right-hand-was-grounded-on-viewer-left',
      passed: Boolean(carrier && carrier.before.center[0] < drawingCenterX),
      detail: `carrierX=${carrier?.before.center[0] ?? 'none'}, drawingCenterX=${drawingCenterX}`,
    },
    {
      id: 'moved-arm-interfaces-remain-on-hand-boundary',
      passed: interfaceDeviations.length >= 2
        && interfaceDeviations.every((value) => value <= tolerance),
      detail: `deviations=${JSON.stringify(interfaceDeviations)}, tolerance=${tolerance}`,
    },
    {
      id: 'non-target-drawing-nodes-unchanged',
      passed: changedProtectedIds.length === 0,
      detail: `unexpectedChanges=${changedProtectedIds.join(',') || 'none'}`,
    },
    {
      id: 'semantic-write-is-bounded-to-updates',
      passed: input.commands.length >= 2
        && input.commands.length <= 6
        && input.commands.every((command) => command.type === 'geometry.update'),
      detail: `commands=${input.commands.map((command) => command.type).join(',')}`,
    },
    {
      id: 'visual-verification-precedes-commit',
      passed: visualVerificationIndex >= 0
        && reviewResultIndex > visualVerificationIndex
        && commitActionIndex > reviewResultIndex
        && commitIndex > commitActionIndex,
      detail: `auditIndices=${visualVerificationIndex}/${reviewResultIndex}/${commitActionIndex}/${commitIndex}`,
    },
    {
      id: 'review-result-is-bound-to-committed-preview',
      passed: Boolean(
        reviewResultHandle
        && reviewResultHandle === visualVerification?.payload.previewHandle
        && reviewResultHandle === committedPreviewHandle
        && typeof reviewResult?.payload.transactionDigest === 'string'
        && reviewResult?.payload.revision === input.auditEvents[visualVerificationIndex]?.payload.beforeRevision,
      ),
      detail: `reviewed=${reviewResultHandle ?? 'none'}, committed=${committedPreviewHandle ?? 'none'}`,
    },
    {
      id: 'canvas-streams-preview-before-verification-and-commit',
      passed: previewProgressIndex >= 0
        && verifyProgressIndex > previewProgressIndex
        && committedProgressIndex > verifyProgressIndex,
      detail: `progressIndices=${previewProgressIndex}/${verifyProgressIndex}/${committedProgressIndex}`,
    },
  ];
  return {
    passed: checks.every((check) => check.passed),
    score: checks.filter((check) => check.passed).length / checks.length,
    affectedNodeIds,
    carrierNodeId: carrier?.id ?? null,
    worldDelta,
    verificationModel: typeof reviewResult?.payload.modelName === 'string'
      ? reviewResult.payload.modelName
      : null,
    checks,
  };
}

function commandNodeIds(command: DrawingCommand): string[] {
  if (command.type === 'geometry.create') return [command.value.id as string];
  return 'id' in command ? [command.id as string] : [];
}

function endpointBoundaryDeviations(
  command: DrawingCommand,
  geometry: ReadonlyMap<string, DrawingDocument['geometry'][number]>,
  center: readonly [number, number],
  radius: number,
): number[] {
  if (command.type !== 'geometry.update') return [];
  const line = geometry.get(command.id as string);
  if (line?.type !== 'line') return [];
  const changes = asRecord(command.changes);
  return [
    ...(changes && 'start' in changes ? [line.start] : []),
    ...(changes && 'end' in changes ? [line.end] : []),
  ].map((point) => Math.abs(Math.hypot(point[0] - center[0], point[1] - center[1]) - radius));
}

function nodeSnapshotMap(document: DrawingDocument): Map<string, string> {
  return new Map([
    ...document.geometry,
    ...document.annotations,
    ...document.relations,
    ...document.features,
  ].map((node) => [node.id as string, JSON.stringify(node)]));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function lastIndexMatching<T>(items: T[], predicate: (item: T) => boolean): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (predicate(items[index])) return index;
  }
  return -1;
}

async function renderGeometry(
  document: DrawingDocument,
  selectedIds: string[],
  outputPath: string,
): Promise<void> {
  const repository = new MemoryDrawingRepository();
  await repository.create({ ...document, annotations: [] });
  const application = new DrawingApplication({ repository });
  const observation = await application.observeForAgent({
    drawingId: document.id,
    includeAnnotations: false,
    selectedIds: selectedIds as GeometryId[],
  });
  const overview = observation.views.find((view) => view.purpose === 'overview')
    ?? observation.views[0];
  const image = application.readObservationImage(overview.image.handle);
  if (!image) throw new Error('TEST2_FINAL_RENDER_MISSING');
  await writeFile(outputPath, Buffer.from(image.slice(image.indexOf(',') + 1), 'base64'));
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
