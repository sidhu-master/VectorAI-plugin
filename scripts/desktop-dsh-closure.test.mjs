// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { selectPackedRuntimeClosure } from './desktop-dsh-closure.mjs';

describe('desktop DSH packed closure', () => {
  it('includes runtime dependencies and internal peers without unrelated packages', () => {
    const packed = [
      entry('@deepseek-ai/dsh', { dependencies: { '@deepseek-ai/runtime': '1.0.0' } }),
      entry('@deepseek-ai/runtime', { peerDependencies: { '@deepseek-ai/cordis': '^4.0.0' } }),
      entry('@deepseek-ai/cordis'),
      entry('@deepseek-ai/test-only', { peerDependencies: { vitest: '*' } }),
    ];
    assert.deepEqual(
      selectPackedRuntimeClosure(packed).map((item) => item.manifest.name),
      ['@deepseek-ai/cordis', '@deepseek-ai/dsh', '@deepseek-ai/runtime'],
    );
  });

  it('fails when the executable package is absent', () => {
    assert.throws(() => selectPackedRuntimeClosure([]), /DESKTOP_DSH_PACKED_DEPENDENCY_MISSING/);
  });
});

function entry(name, fields = {}) {
  return { manifest: { name, ...fields }, tarball: `/tmp/${name}.tgz` };
}
