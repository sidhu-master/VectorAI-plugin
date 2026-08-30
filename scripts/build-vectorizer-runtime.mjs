// SPDX-License-Identifier: Apache-2.0

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync, cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  readdirSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditRuntimePackage } from './vectorizer-runtime-audit.mjs';
import {
  PIPELINE_VERSION, PROTOCOL_VERSION, PYTHON_VERSION, RUNTIME_VERSION,
  runtimeExecutable, targetFor,
} from './vectorizer-runtime-config.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = targetFor();
const buildPython = process.env.VECTORAI_BUILD_PYTHON || 'python3';
const outputRoot = join(root, 'dist/vectorizer-runtime', target.id);
const packageRoot = join(outputRoot, 'package');
const temporary = mkdtempSync(join(tmpdir(), `vectorai-vectorizer-${target.id}-`));
const venv = join(temporary, 'venv');
const venvPython = process.platform === 'win32'
  ? join(venv, 'Scripts/python.exe')
  : join(venv, 'bin/python');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    stdio: options.capture ? 'pipe' : 'inherit',
    env: options.env ?? process.env,
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message || result.stderr || `${command} exited ${result.status}`);
  }
  return result.stdout ?? '';
}

function filesBelow(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return statSync(path).isDirectory() ? filesBelow(path) : [path];
    })
    .sort();
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function materializeSymlinks(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (lstatSync(path).isSymbolicLink()) {
      const target = realpathSync(path);
      const isDirectory = statSync(target).isDirectory();
      rmSync(path, { recursive: true, force: true });
      cpSync(target, path, { recursive: isDirectory, dereference: true });
    }
    if (statSync(path).isDirectory()) materializeSymlinks(path);
  }
}

function smoke(executable, imagePath) {
  const requests = [
    { id: 'health', operation: 'health' },
    {
      id: 'vectorize', operation: 'vectorize', sourceId: 'runtime-smoke',
      imageBase64: readFileSync(imagePath).toString('base64'),
    },
  ];
  const result = spawnSync(executable, [], {
    input: `${requests.map((request) => JSON.stringify(request)).join('\n')}\n`,
    encoding: 'utf8',
    env: { ...process.env, PATH: '/usr/bin:/bin' },
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr);
  const responses = result.stdout.trim().split('\n').map((line) => JSON.parse(line));
  if (responses.length !== 2 || responses.some((response) => !response.ok)) {
    throw new Error(`Packaged vectorizer smoke failed: ${result.stdout}`);
  }
  if (responses[0].value?.protocolVersion !== PROTOCOL_VERSION ||
      responses[0].value?.pipelineVersion !== PIPELINE_VERSION) {
    throw new Error('Packaged vectorizer health metadata mismatch');
  }
}

function writeManifest(sourceCommit) {
  const template = JSON.parse(readFileSync(join(root, 'packages/vectorizer-runtime-template/package.json'), 'utf8'));
  const manifest = {
    ...template,
    name: target.packageName,
    version: RUNTIME_VERSION,
    os: [target.platform],
    cpu: [target.arch],
  };
  writeFileSync(join(packageRoot, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  cpSync(join(root, 'LICENSE'), join(packageRoot, 'LICENSE'));

  const runtimeFiles = Object.fromEntries(filesBelow(join(packageRoot, 'bin')).map((path) => [
    relative(packageRoot, path).split('\\').join('/'), digest(path),
  ]));
  writeFileSync(join(packageRoot, 'runtime.json'), `${JSON.stringify({
    protocolVersion: PROTOCOL_VERSION,
    pipelineVersion: PIPELINE_VERSION,
    runtimeVersion: RUNTIME_VERSION,
    platform: target.platform,
    arch: target.arch,
    sourceCommit,
    executable: runtimeExecutable(target),
    files: runtimeFiles,
  }, null, 2)}\n`);
}

async function main() {
  const version = run(buildPython, ['--version'], { capture: true }).trim().replace(/^Python\s+/, '');
  if (version !== PYTHON_VERSION) {
    throw new Error(`Vectorizer build requires Python ${PYTHON_VERSION}; got ${version || 'unknown'}`);
  }
  rmSync(outputRoot, { recursive: true, force: true });
  mkdirSync(packageRoot, { recursive: true });
  run(buildPython, ['-m', 'venv', venv]);
  run(venvPython, ['-m', 'pip', 'install', '--require-hashes', '-r', join(root, 'python/requirements-vectorization.lock')]);
  run(venvPython, ['-m', 'unittest', 'python.tests.test_vectorai_vectorizer']);

  const pyinstallerDist = join(temporary, 'pyinstaller-dist');
  run(venvPython, [
    '-m', 'PyInstaller', '--clean', '--noconfirm',
    '--distpath', pyinstallerDist,
    '--workpath', join(temporary, 'pyinstaller-work'),
    join(root, 'python/vectorai_vectorizer.spec'),
  ], { env: { ...process.env, PYTHONPATH: root } });

  const builtDirectory = join(pyinstallerDist, 'vectorai-vectorizer');
  if (!existsSync(builtDirectory)) throw new Error('PyInstaller runtime directory is missing');
  const destination = join(packageRoot, 'bin/vectorai-vectorizer');
  mkdirSync(dirname(destination), { recursive: true });
  cpSync(builtDirectory, destination, { recursive: true, dereference: true });
  materializeSymlinks(destination);
  const executable = join(packageRoot, runtimeExecutable(target));
  if (target.platform !== 'win32') chmodSync(executable, 0o755);

  const fixture = join(temporary, 'smoke.png');
  run(venvPython, ['-c', [
    'import cv2, numpy as np, sys',
    'image=np.full((32,32,3),255,dtype=np.uint8)',
    'cv2.line(image,(4,16),(28,16),(0,0,0),2)',
    'assert cv2.imwrite(sys.argv[1],image)',
  ].join(';'), fixture]);
  smoke(executable, fixture);
  writeManifest(run('git', ['rev-parse', 'HEAD'], { capture: true }).trim());
  auditRuntimePackage(packageRoot, { ...target, version: RUNTIME_VERSION });

  mkdirSync(join(outputRoot, 'tarballs'), { recursive: true });
  run('npm', ['pack', '--pack-destination', join(outputRoot, 'tarballs')], {
    cwd: packageRoot,
    env: { ...process.env, npm_config_ignore_scripts: 'true' },
  });
  console.log(`Vectorizer runtime ready: ${packageRoot}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
}).finally(() => {
  if (process.env.VECTORAI_KEEP_BUILD_TEMP !== '1') rmSync(temporary, { recursive: true, force: true });
});
