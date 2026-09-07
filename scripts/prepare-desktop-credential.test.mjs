import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

import { prepareCredential } from './prepare-desktop-credential.mjs';

const roots = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('prepareCredential', () => {
  it('fails when the build key is empty', async () => {
    await assert.rejects(
      prepareCredential({ key: '  ', output: '/unused/key' }),
      /VECTORAI_TEST_API_KEY_REQUIRED/,
    );
  });

  it('writes only the normalized key with owner-only mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'vectorai-credential-'));
    roots.push(root);
    const output = join(root, 'secrets', 'vectorai-test-api-key');
    const result = await prepareCredential({ key: '  test-secret-value\n', output });
    assert.equal(await readFile(output, 'utf8'), 'test-secret-value');
    assert.equal((await stat(output)).mode & 0o777, 0o600);
    assert.deepEqual(result, { output, bytes: 17 });
    assert.doesNotMatch(JSON.stringify(result), /test-secret-value/);
  });
});
