// SPDX-License-Identifier: Apache-2.0

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import { defaultRepositoryRoot, readDshRuntimeManifest } from './dsh-runtime-manifest.mjs';

const execFileAsync = promisify(execFile);
const PACKAGE_PATHS = {
  '@deepseek-ai/dsh-agent': 'packages/core/agent/package.json',
  '@deepseek-ai/dsh-llm': 'packages/llm/llm/package.json',
  '@deepseek-ai/dsh-session': 'packages/core/session/package.json',
  '@deepseek-ai/dsh-subagent': 'packages/subagent/subagent/package.json',
};

export function validateDshSourceRuntimeFacts(baseline, facts) {
  if (facts.rootVersion !== baseline.version) {
    throw new Error(`DSH_SOURCE_ROOT_VERSION_MISMATCH:${facts.rootVersion}`);
  }
  if (facts.commit !== baseline.commit) {
    throw new Error(`DSH_SOURCE_COMMIT_MISMATCH:${facts.commit}`);
  }
  for (const [name, version] of Object.entries(facts.packageVersions)) {
    if (version !== baseline.version) {
      throw new Error(`DSH_SOURCE_PACKAGE_VERSION_MISMATCH:${name}:${version}`);
    }
  }
  for (const capability of ['createDrafts', 'addAttachments']) {
    if (facts.capabilities[capability] !== true) {
      throw new Error(`DSH_SOURCE_CAPABILITY_MISSING:${capability}`);
    }
  }
  return facts;
}

export async function checkDshSourceRuntime({
  root = defaultRepositoryRoot(),
  sourceDirectory,
} = {}) {
  const baseline = readDshRuntimeManifest(root);
  const directory = resolve(sourceDirectory ?? join(
    homedir(),
    'Library/Application Support/VectorAI/dsh-runtime',
    baseline.version,
  ));
  const rootManifest = await readJson(join(directory, 'package.json'));
  const packageVersions = {};
  for (const [name, relativePath] of Object.entries(PACKAGE_PATHS)) {
    const manifest = await readJson(join(directory, relativePath));
    if (manifest.name !== name) throw new Error(`DSH_SOURCE_PACKAGE_NAME_MISMATCH:${name}`);
    packageVersions[name] = manifest.version;
  }
  const [{ stdout }, conversationSource, inputSource] = await Promise.all([
    execFileAsync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }),
    readFile(join(directory, 'packages/client/ui-conversation/src/client/service.ts'), 'utf8'),
    readFile(join(directory, 'packages/client/ui-conversation/src/client/contract/input.ts'), 'utf8'),
  ]);
  const facts = {
    rootVersion: rootManifest.version,
    commit: stdout.trim(),
    packageVersions,
    capabilities: {
      createDrafts: /\bcreateDrafts\s*\(\s*sessionId\s*:/u.test(conversationSource),
      addAttachments: /\baddAttachments\s*\(\s*ids\s*:/u.test(inputSource),
    },
  };
  return validateDshSourceRuntimeFacts(baseline, facts);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

const invokedPath = process.argv[1] === undefined ? undefined : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  checkDshSourceRuntime({ sourceDirectory: process.argv[2] })
    .then((facts) => process.stdout.write(`${JSON.stringify(facts, undefined, 2)}\n`))
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
