import assert from 'node:assert/strict';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { compileConnectedTransform } from '../../../api/services/drawing-spatial-actions/connected-transform.ts';
import { replayDrawingCommits } from '../../../src/drawing/repository/replay.ts';

const projectUrl = new URL('./', import.meta.url);
const historyUrl = new URL(
  '../../../.local/vectorai/drawings/05e65088fbf972ac53939ab7d54193e88a4b8c68bb0a7806908142124359068a.history/',
  projectUrl,
);
const commitUrl = new URL(
  '../../../.local/vectorai/runs/run_660e24af-8d7f-4baa-9e14-9427956e63f6/commits/commit_4c3140b7-9b85-4eb5-befd-9f10e9397c42.json',
  projectUrl,
);
const eventsUrl = new URL(
  '../../../.local/vectorai/runs/run_660e24af-8d7f-4baa-9e14-9427956e63f6/events.jsonl',
  projectUrl,
);

const historyBase = JSON.parse(await readFile(new URL('base.json', historyUrl), 'utf8'));
const segmentFiles = (await readdir(historyUrl))
  .filter(name => /^\d{12}\.json$/.test(name))
  .sort();
const commits = [];
for (const segmentFile of segmentFiles) {
  const segment = JSON.parse(await readFile(new URL(segmentFile, historyUrl), 'utf8'));
  commits.push(...segment.commits);
}

const sourceCommit = JSON.parse(await readFile(commitUrl, 'utf8'));
const targetIndex = commits.findIndex(commit => commit.id === sourceCommit.id);
assert.ok(targetIndex >= 0, 'target audit commit not found in drawing history');

const beforeReplay = replayDrawingCommits(historyBase.initialDocument, commits.slice(0, targetIndex));
assert.equal(beforeReplay.success, true, 'failed to replay the source drawing before the target commit');
const afterReplay = replayDrawingCommits(historyBase.initialDocument, commits.slice(0, targetIndex + 1));
assert.equal(afterReplay.success, true, 'failed to replay the source drawing through the target commit');
if (!beforeReplay.success || !afterReplay.success) process.exit(1);

const events = (await readFile(eventsUrl, 'utf8'))
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));
const modelEvent = events.find(event => event.type === 'model' && event.payload?.role === 'drawing-action');
assert.ok(modelEvent, 'drawing-action model event missing');
const toolRequest = JSON.parse(modelEvent.payload.reply);
assert.equal(toolRequest.tool, 'preview_connected_transform');

const carrierNodeId = sourceCommit.commands[0]?.id;
const carrier = beforeReplay.document.geometry.find(node => node.id === carrierNodeId);
assert.ok(carrier && (carrier.type === 'circle' || carrier.type === 'ellipse'), 'carrier node is not a closed analytic geometry');
const delta = toolRequest.input.delta;
const targetCenter = [carrier.center[0] + delta[0], carrier.center[1] + delta[1]];
const compiled = compileConnectedTransform({
  document: beforeReplay.document,
  carrierNodeId,
  targetCenter,
});
assert.deepEqual(compiled.commands, sourceCommit.commands, 'recompiled transform differs from committed commands');

const data = {
  source: 'external-browser-last-successful-use',
  runId: 'run_660e24af-8d7f-4baa-9e14-9427956e63f6',
  drawingId: sourceCommit.drawingId,
  baseRevision: sourceCommit.parentRevision,
  resultingRevision: sourceCommit.resultingRevision,
  commitId: sourceCommit.id,
  summary: sourceCommit.metadata.summary,
  confidence: sourceCommit.metadata.confidence,
  model: {
    kind: 'connected-translate',
    tool: toolRequest.tool,
    carrierNodeRef: toolRequest.input.carrierNodeId,
    carrierNodeId,
    delta,
    beforeCenter: compiled.audit.beforeCenter,
    afterCenter: compiled.audit.targetCenter,
    orientationMode: compiled.audit.orientationMode,
    portRotationDegrees: compiled.audit.rotationDegrees,
    contactTolerance: compiled.audit.contactTolerance,
  },
  targetIds: sourceCommit.commands.map(command => command.id),
  updates: sourceCommit.commands,
  ports: compiled.audit.ports,
  diagnostics: compiled.diagnostics,
  validationReport: sourceCommit.validationReport,
  outcomeReport: sourceCommit.outcomeReport,
  baseGeometry: beforeReplay.document.geometry,
  geometry: afterReplay.document.geometry,
};

await writeFile(
  new URL('audit-replay-data.js', projectUrl),
  `window.VECTORAI_AUDIT_REPLAY=${JSON.stringify(data)};\n`,
  'utf8',
);
process.stdout.write(
  `generated ${data.runId}: ${data.geometry.length} geometries, ${data.updates.length} updates\n`,
);
