// SPDX-License-Identifier: Apache-2.0

import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';

const root = resolve(import.meta.dirname, '..');
const hostDir = join(root, 'packages/plugin-dsh-space-host');
const clientDir = join(root, 'packages/plugin-dsh-space-client');
const annotationDir = join(root, 'packages/plugin-dsh-annotation');
const deepseekExternal = (id) => id.startsWith('@deepseek-ai/') || id === '@deepseek-ai/cordis';

await Promise.all([
  buildLibrary({
    entry: join(hostDir, 'src/index.ts'),
    outDir: join(hostDir, 'lib'),
    fileName: 'index.js',
    format: 'es',
    external: (id) => deepseekExternal(id) || id.startsWith('node:') || id === 'sharp',
  }),
  buildLibrary({
    entry: join(clientDir, 'src/index.ts'),
    outDir: join(clientDir, 'lib'),
    fileName: 'index.js',
    format: 'es',
    external: deepseekExternal,
  }),
  buildLibrary({
    entry: join(annotationDir, 'src/index.ts'),
    outDir: join(annotationDir, 'lib'),
    fileName: 'index.js',
    format: 'es',
    external: (id) => deepseekExternal(id) || id.startsWith('node:') || id === 'sharp',
  }),
]);

await stripTrailingWhitespace(join(hostDir, 'lib/index.js'));
await copyFile(
  join(root, 'python/vectorai_vectorizer.py'),
  join(hostDir, 'lib/vectorai_vectorizer.py'),
);

await buildLibrary({
  entry: join(hostDir, 'src/typert.ts'),
  outDir: join(hostDir, 'lib'),
  fileName: 'typert.js',
  format: 'es',
  emptyOutDir: false,
  external: (id) => deepseekExternal(id) || id.startsWith('node:') || id === 'sharp',
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
  const outputFiles = await readdir(temporary);
  const cssFiles = outputFiles.filter((file) => file.endsWith('.css'));
  if (cssFiles.length !== 1) {
    throw new Error(`Expected one DSH client CSS asset, found: ${outputFiles.join(', ')}`);
  }
  const css = await readFile(join(temporary, cssFiles[0]), 'utf8');
  const wrapped = wrapClient(commonJs, css);
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

async function stripTrailingWhitespace(path) {
  const source = await readFile(path, 'utf8');
  await writeFile(path, source.replace(/[ \t]+$/gm, ''));
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text.trimEnd().split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function wrapClient(commonJs, css) {
  return `window.__ModuleLoader__.load({
  id: "@vectorai/plugin-dsh-space-client",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${indent(commonJs, 4)}
    var originalApply = module.exports.apply;
    module.exports.apply = async (ctx) => {
      var style = document.createElement("style");
      style.dataset.vectoraiDshSpace = "true";
      style.textContent = ${JSON.stringify(css)};
      document.head.append(style);
      var dispose;
      try {
        dispose = await originalApply(ctx);
      } catch (error) {
        style.remove();
        throw error;
      }
      return async () => {
        try {
          await dispose?.();
        } finally {
          style.remove();
        }
      };
    };
    return module.exports;
  }
});
`;
}
