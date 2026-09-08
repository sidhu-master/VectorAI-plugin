// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DESKTOP_NODE_VERSION, parseDesktopTarget } from './desktop-runtime-plan.mjs';
import { vectorizerProfileDirectory } from './desktop-profile-bootstrap.mjs';
import { isDevelopmentRuntimePath } from './desktop-runtime-audit.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const release = JSON.parse(readFileSync(resolve(root, 'release/dsh-plugins.json'), 'utf8'));
const runtimeIndex = process.argv.indexOf('--runtime');
const runtimeRoot = resolve(process.argv[runtimeIndex + 1] ?? `dist/desktop-runtime/${process.platform}-${process.arch}`);
const manifest = JSON.parse(readFileSync(join(runtimeRoot, 'runtime-manifest.json'), 'utf8'));
const target = parseDesktopTarget(`${manifest.platform}-${manifest.arch}`);

assert(manifest.schemaVersion === 1, 'DESKTOP_RUNTIME_SCHEMA_VERSION_INVALID');
assert(manifest.vectoraiVersion === release.version, 'DESKTOP_RUNTIME_VECTORAI_VERSION_INVALID');
assert(manifest.dsh?.version === release.dsh.version, 'DESKTOP_RUNTIME_DSH_VERSION_INVALID');
assert(manifest.dsh?.commit === release.dsh.commit, 'DESKTOP_RUNTIME_DSH_COMMIT_INVALID');
assert(manifest.nodeVersion === DESKTOP_NODE_VERSION, 'DESKTOP_RUNTIME_NODE_VERSION_INVALID');
assert(JSON.stringify(manifest.bundles) === JSON.stringify(release.bundles), 'DESKTOP_RUNTIME_BUNDLE_ORDER_INVALID');

const nodeExecutable = target.platform === 'win32'
  ? join(runtimeRoot, 'node', 'node.exe')
  : join(runtimeRoot, 'node', 'bin', 'node');
const dshEntry = join(runtimeRoot, ...manifest.entry.split('/'));
assert(capture(nodeExecutable, ['--version']).trim() === `v${DESKTOP_NODE_VERSION}`, 'DESKTOP_NODE_EXECUTABLE_INVALID');
assert(capture(nodeExecutable, [dshEntry, '--version']).trim() === release.dsh.version, 'DESKTOP_DSH_EXECUTABLE_INVALID');

const seedHome = join(runtimeRoot, 'profile-seed');
const environment = { ...process.env, DSH_HOME: seedHome, DSH_TELEMETRY_DISABLED: '1' };
const composition = capture(nodeExecutable, [dshEntry, '--profile', 'web', '--dump-config'], environment);
let previous = -1;
for (const bundle of release.bundles) {
  const index = composition.indexOf(bundle);
  assert(index > previous, `DESKTOP_PROFILE_BUNDLE_MISSING_OR_UNORDERED:${bundle}`);
  previous = index;
}

const runtimePackage = release.runtimes.find((candidate) =>
  candidate.platform === target.platform && candidate.arch === target.arch);
assert(runtimePackage, `DESKTOP_VECTORIZER_TARGET_MISSING:${target.id}`);
const vectorizerRoot = vectorizerProfileDirectory(seedHome, release.dsh.profile, runtimePackage.name);
const vectorizer = JSON.parse(readFileSync(join(vectorizerRoot, 'runtime.json'), 'utf8'));
assert(vectorizer.platform === target.platform && vectorizer.arch === target.arch, 'DESKTOP_VECTORIZER_METADATA_INVALID');
const health = spawnSync(resolve(vectorizerRoot, vectorizer.executable), [], {
  input: '{"id":"health","operation":"health"}\n',
  encoding: 'utf8',
  env: { PATH: target.platform === 'win32' ? 'C:\\Windows\\System32' : '/usr/bin:/bin' },
});
assert(health.status === 0 && JSON.parse(health.stdout.trim()).ok === true, 'DESKTOP_VECTORIZER_HEALTH_FAILED');

for (const required of [
  'default-settings.yaml',
  'secrets/vectorai-test-api-key',
  'licenses/VectorAI-LICENSE',
  'licenses/DSH-LICENSE',
  'licenses/Node.js-LICENSE',
]) readFileSync(join(runtimeRoot, required));
const settings = readFileSync(join(runtimeRoot, 'default-settings.yaml'), 'utf8');
for (const expected of ['name: 维构 AI', 'model: doubao-seed-2.0-lite', 'provider: deepseek-official']) {
  assert(settings.includes(expected), `DESKTOP_DEFAULT_MODEL_INVALID:${expected}`);
}

const credentialPath = join(runtimeRoot, 'secrets', 'vectorai-test-api-key');
const credential = readFileSync(credentialPath, 'utf8');
for (const manifestPath of [
  join(runtimeRoot, 'dsh', 'package.json'),
  join(seedHome, 'profiles', release.dsh.profile, 'package.json'),
]) {
  const content = readFileSync(manifestPath, 'utf8');
  assert(!content.includes('file:'), `DESKTOP_LOCAL_PACKAGE_REFERENCE:${manifestPath.slice(runtimeRoot.length + 1)}`);
}
let bytes = 0;
let files = 0;
for (const path of walk(runtimeRoot)) {
  const relative = path.slice(runtimeRoot.length + 1);
  assert(!isDevelopmentRuntimePath(relative), `DESKTOP_RUNTIME_DEVELOPMENT_FILE:${relative}`);
  const stat = statSync(path);
  bytes += stat.size;
  files += 1;
  if (path === credentialPath || stat.size > 5 * 1024 * 1024) continue;
  const content = readFileSync(path);
  if (content.includes(Buffer.from(credential))) throw new Error(`DESKTOP_CREDENTIAL_LEAK:${relative}`);
  if (content.includes(Buffer.from(root))) throw new Error(`DESKTOP_BUILDER_PATH_LEAK:${relative}`);
}

process.stdout.write(`${JSON.stringify({ target: target.id, files, bytes, dsh: release.dsh.version }, null, 2)}\n`);

function walk(directory) {
  const output = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

function capture(command, args, env = process.env) {
  const result = spawnSync(command, args, { encoding: 'utf8', env });
  if (result.error || result.status !== 0) throw result.error ?? new Error(result.stderr || 'DESKTOP_COMMAND_FAILED');
  return result.stdout;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
