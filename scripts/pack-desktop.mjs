// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseDesktopTarget } from './desktop-runtime-plan.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'apps', 'vectorai-desktop');
const appPackage = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
const requestedTarget = process.env.VECTORAI_DESKTOP_TARGET ?? `${process.platform}-${process.arch}`;
const target = parseDesktopTarget(requestedTarget);
const nativeTarget = `${process.platform}-${process.arch}`;

if (target.id !== nativeTarget) {
  throw new Error(`DESKTOP_INSTALLER_NATIVE_TARGET_REQUIRED:${target.id}:${nativeTarget}`);
}

const runtimeRoot = resolve(process.env.VECTORAI_DESKTOP_RUNTIME_DIR ?? join(root, 'dist', 'desktop-runtime', target.id));
const credentialPath = join(runtimeRoot, 'secrets', 'vectorai-test-api-key');
if (!existsSync(credentialPath) || !readFileSync(credentialPath, 'utf8').trim()) {
  throw new Error('VECTORAI_TEST_API_KEY_REQUIRED');
}

run('pnpm', ['build:desktop'], root);
run('node', ['scripts/verify-desktop-runtime.mjs', '--runtime', runtimeRoot], root);

const outputRoot = join(root, 'dist', 'desktop-installers');
mkdirSync(outputRoot, { recursive: true });
const expectedName = target.platform === 'darwin'
  ? `VectorAI-${appPackage.version}-mac-${target.arch}.dmg`
  : `VectorAI-${appPackage.version}-win-${target.arch}-setup.exe`;
rmSync(join(outputRoot, expectedName), { force: true });

const builderArgs = target.platform === 'darwin'
  ? ['exec', 'electron-builder', '--config', 'electron-builder.yml', '--mac', 'dmg', `--${target.arch}`, '--publish', 'never']
  : ['exec', 'electron-builder', '--config', 'electron-builder.yml', '--win', 'nsis', '--x64', '--publish', 'never'];
run('pnpm', builderArgs, appRoot, {
  ...process.env,
  VECTORAI_DESKTOP_RUNTIME_DIR: relative(appRoot, runtimeRoot),
});

const unpackedRuntime = target.platform === 'darwin'
  ? join(outputRoot, `mac-${target.arch}`, 'VectorAI.app', 'Contents', 'Resources', 'runtime')
  : join(outputRoot, 'win-unpacked', 'resources', 'runtime');
for (const required of [
  'runtime-manifest.json',
  'default-settings.yaml',
  'secrets/vectorai-test-api-key',
  'dsh/node_modules/@deepseek-ai/dsh/lib/bin.js',
  'profile-seed/profiles/web',
]) {
  if (!existsSync(join(unpackedRuntime, required))) {
    throw new Error(`DESKTOP_INSTALLER_RUNTIME_MISSING:${required}`);
  }
}
const packagedNode = target.platform === 'win32'
  ? join(unpackedRuntime, 'node', 'node.exe')
  : join(unpackedRuntime, 'node', 'bin', 'node');
run(packagedNode, ['--version'], root);
run(packagedNode, [join(unpackedRuntime, 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'), '--version'], root);

const matching = readdirSync(outputRoot).filter((name) => name === expectedName);
if (matching.length !== 1) throw new Error(`DESKTOP_INSTALLER_ARTIFACT_INVALID:${expectedName}:${matching.length}`);
process.stdout.write(`${join(outputRoot, expectedName)}\n`);

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    throw result.error ?? new Error(`DESKTOP_INSTALLER_COMMAND_FAILED:${command}:${result.status}`);
  }
}
