// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { DRAWING_SPACE_REMOTE } from '../packages/plugin-dsh-space-client/src/remote';
import { TYPERT } from '../packages/plugin-dsh-space-host/src/typert';

describe('DSH Drawing Space Remote contract', () => {
  it('publishes the same invocation IDs and methods on the Host and Client', () => {
    const hostRoutes = TYPERT.invocations
      .map(({ id, method }) => ({ id, method }))
      .sort((left, right) => left.id.localeCompare(right.id));
    const clientRoutes = DRAWING_SPACE_REMOTE.descriptors
      .map(({ id, method }) => ({ id, method }))
      .sort((left, right) => left.id.localeCompare(right.id));

    expect(hostRoutes).toEqual(clientRoutes);
  });
});
