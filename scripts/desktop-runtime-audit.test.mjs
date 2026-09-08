// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDevelopmentRuntimePath } from './desktop-runtime-audit.mjs';

describe('desktop runtime path audit', () => {
  it('rejects repository metadata and first-party test directories', () => {
    assert.equal(isDevelopmentRuntimePath('profile-seed/tests/fixture.js'), true);
    assert.equal(isDevelopmentRuntimePath('dsh/.git/config'), true);
  });

  it('allows files that package publishers include inside node_modules', () => {
    assert.equal(isDevelopmentRuntimePath('dsh/node_modules/@protobufjs/aspromise/tests/index.js'), false);
  });
});
