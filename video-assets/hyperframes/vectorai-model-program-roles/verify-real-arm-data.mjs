import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const fixtureSource = await readFile(
  new URL('../../../api/services/drawing-spatial/test2-fixture.ts', import.meta.url),
  'utf8',
);
const editSource = await readFile(
  new URL('../../../scripts/test2-self-semantic-edit.ts', import.meta.url),
  'utf8',
);

const match = html.match(
  /<script type="application\/json" id="real-arm-fixture-data">([\s\S]*?)<\/script>/,
);
assert.ok(match, 'index.html must embed #real-arm-fixture-data');

const data = JSON.parse(match[1]);
const sharedPoints = [
  [101.910828, 193.412466],
  [103.937462, 193.991562],
  [117.255351, 203.546338],
  [118.992468, 203.546338],
  [118.992468, 71.22675],
];
const handPoints = [
  [101.910828, 193.412466],
  [99, 197],
  [102, 199],
  [116, 210],
  [122, 207],
  [118.992468, 203.546338],
];
const anchor = [118.992468, 203.546338];

assert.deepEqual(data.sharedPoints, sharedPoints, 'shared polyline must match test2 fixture');
assert.deepEqual(data.handPoints, handPoints, 'hand outline must match test2 fixture');
assert.deepEqual(data.anchor, anchor, 'shoulder anchor must match test2 fixture');
assert.equal(data.angleDegrees, 35, 'rotation must match compileSpatialEdit input');
assert.equal(data.sharedPolylineId, 'node_vec_9b4cf19e18282a496e2d');
assert.equal(data.handOutlineId, 'node_test2_hand_outline');

for (const point of [...sharedPoints, ...handPoints, anchor]) {
  assert.ok(
    fixtureSource.includes(point.join(', ')),
    `fixture source must contain point [${point.join(', ')}]`,
  );
}
assert.match(editSource, /angleDegrees:\s*35/);

const rotate = ([x, y], [cx, cy], degrees) => {
  const radians = degrees * Math.PI / 180;
  const dx = x - cx;
  const dy = y - cy;
  return [
    cx + dx * Math.cos(radians) - dy * Math.sin(radians),
    cy + dx * Math.sin(radians) + dy * Math.cos(radians),
  ];
};
const rotatedAnchor = rotate(anchor, anchor, data.angleDegrees);
assert.ok(Math.abs(rotatedAnchor[0] - anchor[0]) < 1e-9);
assert.ok(Math.abs(rotatedAnchor[1] - anchor[1]) < 1e-9);

process.stdout.write(
  `verified ${sharedPoints.length} shared points, ${handPoints.length} hand points, `
  + `anchor (${anchor.join(', ')}), rotation ${data.angleDegrees}deg\n`,
);
