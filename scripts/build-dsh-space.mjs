// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const hostDir = join(root, 'packages/plugin-dsh-space-host');
const clientDir = join(root, 'packages/plugin-dsh-space-client');
const deepseekExternal = (id) => id.startsWith('@deepseek-ai/') || id === '@deepseek-ai/cordis';

await Promise.all([
  buildLibrary({
    entry: join(hostDir, 'src/index.ts'),
    outDir: join(hostDir, 'lib'),
    fileName: 'index.js',
    format: 'es',
    external: (id) => deepseekExternal(id) || id.startsWith('node:'),
  }),
  buildLibrary({
    entry: join(clientDir, 'src/index.ts'),
    outDir: join(clientDir, 'lib'),
    fileName: 'index.js',
    format: 'es',
    external: deepseekExternal,
  }),
]);

await buildLibrary({
  entry: join(hostDir, 'src/typert.ts'),
  outDir: join(hostDir, 'lib'),
  fileName: 'typert.js',
  format: 'es',
  emptyOutDir: false,
  external: (id) => deepseekExternal(id) || id.startsWith('node:'),
});

const temporary = await mkdtemp(join(tmpdir(), 'vectorai-dsh-client-'));
try {
  await buildLibrary({
    entry: join(clientDir, 'src/client.tsx'),
    outDir: temporary,
    fileName: 'client.cjs',
    format: 'cjs',
    external: (id) => (
      deepseekExternal(id)
      || id === 'react'
      || id === 'react/jsx-runtime'
      || id === 'react-dom'
    ),
  });
  const commonJs = await readFile(join(temporary, 'client.cjs'), 'utf8');
  const wrapped = `window.__ModuleLoader__.load({\n  id: "@vectorai/plugin-dsh-space-client",\n  factory: (require) => {\n    var module = { exports: {} };\n    var exports = module.exports;\n${indent(commonJs, 4)}\n    return module.exports;\n  }\n});\n`;
  if (/\b(?:import|require)\(["']node:/.test(wrapped)) {
    throw new Error('DSH client bundle contains a Node builtin import');
  }
  if (!wrapped.startsWith('window.__ModuleLoader__.load({')) {
    throw new Error('DSH client bundle lacks the ModuleLoader wrapper');
  }
  await writeFile(join(clientDir, 'lib/client.js'), wrapped);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function buildLibrary({ entry, outDir, fileName, format, external, emptyOutDir = true }) {
  await build({
    configFile: false,
    logLevel: 'warn',
    publicDir: false,
    build: {
      outDir,
      emptyOutDir,
      minify: false,
      sourcemap: false,
      lib: {
        entry,
        formats: [format],
        fileName: () => fileName,
      },
      rollupOptions: {
        external,
      },
    },
  });
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text.trimEnd().split('\n').map((line) => `${prefix}${line}`).join('\n');
}
