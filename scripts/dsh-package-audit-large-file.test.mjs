// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

import { readTarOutput } from './dsh-package-audit.mjs';

test('reads a packed host entry larger than the spawnSync default buffer', () => {
  const root = mkdtempSync(join(tmpdir(), 'vectorai-large-tar-'));
  try {
    mkdirSync(join(root, 'package/lib'), { recursive: true });
    const source = 'x'.repeat(1_200_000);
    writeFileSync(join(root, 'package/lib/index.js'), source);
    const archive = join(root, 'bundle.tgz');
    const packed = spawnSync('/usr/bin/tar', ['-czf', archive, '-C', root, 'package']);
    assert.equal(packed.status, 0);
    assert.equal(readTarOutput(['-xOzf', archive, 'package/lib/index.js']).length, source.length);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
