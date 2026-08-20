import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile, readdir } from 'node:fs/promises';

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

const clone = value => JSON.parse(JSON.stringify(value));

const applyGeometryPatch = (geometry, operations) => {
  const byId = new Map(geometry.map(item => [item.id, clone(item)]));
  for (const operation of operations) {
    if (operation.type === 'geometry.add') {
      byId.set(operation.value.id, clone(operation.value));
    } else if (operation.type === 'geometry.update') {
      const current = byId.get(operation.id);
      assert.ok(current, `history update references missing geometry ${operation.id}`);
      byId.set(operation.id, { ...current, ...clone(operation.changes) });
    } else if (operation.type === 'geometry.delete') {
      byId.delete(operation.id);
    }
  }
  return [...byId.values()];
};

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
const sourceEvents = (await readFile(eventsUrl, 'utf8'))
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));
const modelEvent = sourceEvents.find(event => event.type === 'model' && event.payload?.role === 'drawing-action');
assert.ok(modelEvent, 'drawing-action model event must exist');
const toolRequest = JSON.parse(modelEvent.payload.reply);

const targetIndex = commits.findIndex(commit => commit.id === sourceCommit.id);
assert.ok(targetIndex >= 0, 'source commit must exist in the drawing history');

let expectedBaseGeometry = clone(historyBase.initialDocument.geometry);
for (const commit of commits.slice(0, targetIndex)) {
  expectedBaseGeometry = applyGeometryPatch(expectedBaseGeometry, commit.patch.operations);
}
const expectedResultGeometry = applyGeometryPatch(expectedBaseGeometry, sourceCommit.patch.operations);

const html = await readFile(new URL('index.html', projectUrl), 'utf8');
const dataSource = await readFile(new URL('audit-replay-data.js', projectUrl), 'utf8');
const context = { window: {} };
vm.runInNewContext(dataSource, context);
const data = clone(context.window.VECTORAI_AUDIT_REPLAY);

assert.match(html, /audit-replay-data\.js/);
assert.equal(data.runId, 'run_660e24af-8d7f-4baa-9e14-9427956e63f6');
assert.equal(data.drawingId, sourceCommit.drawingId);
assert.equal(data.baseRevision, sourceCommit.parentRevision);
assert.equal(data.resultingRevision, sourceCommit.resultingRevision);
assert.equal(data.commitId, sourceCommit.id);
assert.equal(data.model.kind, 'connected-translate');
assert.equal(data.model.tool, 'preview_connected_transform');
assert.equal(data.model.carrierNodeRef, 'g8');
assert.equal(data.model.carrierNodeId, 'node_vec_2daddd0d927a0aabeff1');
assert.deepEqual(data.model.delta, [30, 150]);
assert.deepEqual(data.model.beforeCenter, [61.710477, 204.929327]);
assert.deepEqual(data.model.afterCenter, [91.710477, 354.929327]);
assert.equal(data.model.orientationMode, 'minimum-deformation');
assert.deepEqual(toolRequest.input.delta, data.model.delta);
assert.equal(toolRequest.input.carrierNodeId, data.model.carrierNodeRef);
assert.equal(data.baseGeometry.length, 58);
assert.equal(data.geometry.length, 58);
assert.deepEqual(data.baseGeometry, expectedBaseGeometry);
assert.deepEqual(data.geometry, expectedResultGeometry);
assert.deepEqual(data.targetIds, sourceCommit.commands.map(command => command.id));
assert.deepEqual(data.updates, sourceCommit.commands);
assert.equal(data.updates.length, 3);

const byId = list => new Map(list.map(item => [item.id, item]));
const before = byId(data.baseGeometry);
const after = byId(data.geometry);
const handId = 'node_vec_2daddd0d927a0aabeff1';
const connectorIds = [
  'node_vec_9751a4f110efdc1a1845',
  'node_vec_c4deca597c5f861f3f5d',
];

assert.deepEqual(before.get(handId).center, data.model.beforeCenter);
assert.deepEqual(after.get(handId).center, data.model.afterCenter);
for (const connectorId of connectorIds) {
  assert.deepEqual(after.get(connectorId).end, before.get(connectorId).end, `${connectorId} fixed anchor moved`);
  assert.notDeepEqual(after.get(connectorId).start, before.get(connectorId).start, `${connectorId} hand port did not reconnect`);
}

assert.equal(sourceCommit.validationReport.valid, true);
assert.equal(sourceCommit.outcomeReport.satisfied, true);
assert.doesNotMatch(html, /RUN_410C|旋转 72|rotate\(72|68 个图元|4 个待更新图元/);
process.stdout.write(
  `verified external-browser audit ${data.runId}: translated hand ${data.model.delta.join(', ')}, `
  + `${data.targetIds.length} exact updates across ${data.geometry.length} geometries\n`,
);
