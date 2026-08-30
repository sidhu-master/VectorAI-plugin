// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function waitForNpmPackage(name, version, options = {}) {
  const attempts = options.attempts ?? 30;
  const delay = options.delay ?? (() => sleep(10_000));
  const lookup = options.lookup ?? npmLookup;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const metadata = await lookup(name, version);
      if (metadata?.dist?.integrity) return metadata;
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await delay();
  }
  throw new Error(`npm package scan timed out for ${name}@${version}: ${lastError?.message ?? 'not visible'}`);
}

function npmLookup(name, version) {
  const result = spawnSync('npm', ['view', `${name}@${version}`, '--json'], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || 'npm view failed');
  return JSON.parse(result.stdout);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [name, version] = process.argv.slice(2);
  waitForNpmPackage(name, version)
    .then((metadata) => console.log(JSON.stringify(metadata.dist)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
