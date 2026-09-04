// SPDX-License-Identifier: Apache-2.0

import {
  checkDshBuildFreshness,
  defaultRepositoryRoot,
} from './dsh-build-freshness.mjs';

const target = process.argv[2] ?? 'all';
const targets = target === 'all' ? ['space', 'annotation'] : [target];
let failed = false;

for (const name of targets) {
  const result = await checkDshBuildFreshness({ root: defaultRepositoryRoot(), target: name });
  if (result.fresh) {
    process.stdout.write(`${name}: fresh\n`);
  } else {
    failed = true;
    process.stderr.write(`${name}: DSH_BUILD_STALE (${result.reason})\n`);
  }
}

if (failed) process.exitCode = 1;
