// SPDX-License-Identifier: Apache-2.0

import { copyFile, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'vite';
import { writeDshBuildFreshnessManifest } from './dsh-build-freshness.mjs';

const root = resolve(import.meta.dirname, '..');
const spaceHostDir = join(root, 'packages/plugin-dsh-space-host');
const spaceClientDir = join(root, 'packages/plugin-dsh-space-client');
const annotationHostDir = join(root, 'packages/plugin-dsh-annotation-host');
const annotationClientDir = join(root, 'packages/plugin-dsh-annotation-client');
const spaceBundleDir = join(root, 'packages/plugin-dsh-space');
const annotationBundleDir = join(root, 'packages/plugin-dsh-annotation');
const deepseekExternal = (id) => id.startsWith('@deepseek-ai/') || id === '@deepseek-ai/cordis';
const target = process.argv[2] ?? 'all';

if (!['space', 'annotation', 'all'].includes(target)) {
  throw new Error(`Unknown DSH build target: ${target}`);
}

if (target === 'space' || target === 'all') {
  await buildPluginPair({
    hostDir: spaceHostDir,
    clientDir: spaceClientDir,
    outputDir: spaceBundleDir,
    clientModuleId: '@newwe/vectorai-plugin-dsh-space',
    clientStyleKey: 'vectoraiDshSpace',
    clientLabel: 'DSH client',
    temporaryPrefix: 'vectorai-dsh-client-',
  });
  await copyFile(join(root, 'LICENSE'), join(spaceBundleDir, 'LICENSE'));
  await writeDshBuildFreshnessManifest({ root, target: 'space' });
}

if (target === 'annotation' || target === 'all') {
  await buildPluginPair({
    hostDir: annotationHostDir,
    clientDir: annotationClientDir,
    outputDir: annotationBundleDir,
    clientModuleId: '@newwe/vectorai-plugin-dsh-annotation',
    clientStyleKey: 'vectoraiDshAnnotation',
    clientLabel: 'Annotation client',
    temporaryPrefix: 'vectorai-dsh-annotation-client-',
  });
  await copyFile(join(root, 'LICENSE'), join(annotationBundleDir, 'LICENSE'));
  await writeDshBuildFreshnessManifest({ root, target: 'annotation' });
}

async function buildPluginPair({
  hostDir,
  clientDir,
  outputDir,
  clientModuleId,
  clientStyleKey,
  clientLabel,
  temporaryPrefix,
}) {
  await buildLibrary({
    entry: join(hostDir, 'src/index.ts'),
    outDir: join(outputDir, 'lib'),
    fileName: 'index.js',
    format: 'es',
    external: serverExternal,
  });
  await stripTrailingWhitespace(join(outputDir, 'lib/index.js'));
  await buildLibrary({
    entry: join(hostDir, 'src/typert.ts'),
    outDir: join(outputDir, 'lib'),
    fileName: 'typert.js',
    format: 'es',
    emptyOutDir: false,
    external: serverExternal,
  });
  await rewriteTypertOwner(join(outputDir, 'lib/typert.js'), clientModuleId);
  await stripTrailingWhitespace(join(outputDir, 'lib/typert.js'));
  await buildClient({
    sourceDirectory: clientDir,
    outputDirectory: outputDir,
    temporaryPrefix,
    moduleId: clientModuleId,
    styleKey: clientStyleKey,
    label: clientLabel,
  });
}

async function buildClient({ sourceDirectory, outputDirectory, temporaryPrefix, moduleId, styleKey, label }) {
  const temporary = await mkdtemp(join(tmpdir(), temporaryPrefix));
  try {
    await buildLibrary({
      entry: join(sourceDirectory, 'src/client.tsx'),
      outDir: temporary,
      fileName: 'client.cjs',
      format: 'cjs',
      external: browserExternal,
    });
    const commonJs = await readFile(join(temporary, 'client.cjs'), 'utf8');
    const outputFiles = await readdir(temporary);
    const cssFiles = outputFiles.filter((file) => file.endsWith('.css'));
    if (cssFiles.length !== 1) {
      throw new Error(`Expected one ${label} CSS asset, found: ${outputFiles.join(', ')}`);
    }
    const css = await readFile(join(temporary, cssFiles[0]), 'utf8');
    const wrapped = wrapClient(commonJs, css, moduleId, styleKey);
    if (/\b(?:import|require)\(["']node:/.test(wrapped)) {
      throw new Error(`${label} bundle contains a Node builtin import`);
    }
    if (!wrapped.startsWith('window.__ModuleLoader__.load({')) {
      throw new Error(`${label} bundle lacks the ModuleLoader wrapper`);
    }
    await writeFile(join(outputDirectory, 'lib/client.js'), wrapped);
    await stripTrailingWhitespace(join(outputDirectory, 'lib/client.js'));
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function serverExternal(id) {
  return deepseekExternal(id)
    || id.startsWith('node:')
    || id === 'sharp'
    || id === 'officeparser'
    || id === '@node-projects/acad-ts';
}

function browserExternal(id) {
  return deepseekExternal(id)
    || id === 'react'
    || id === 'react/jsx-runtime'
    || id === 'react-dom';
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

async function rewriteTypertOwner(path, packageName) {
  const source = await readFile(path, 'utf8');
  const ownerPattern = /package:\s*["'][^"']+["']/g;
  const owners = source.match(ownerPattern) ?? [];
  if (owners.length !== 1) {
    throw new Error(`Expected one TYPERT package owner in ${path}, found ${owners.length}`);
  }
  await writeFile(path, source.replace(ownerPattern, `package: ${JSON.stringify(packageName)}`));
}

function indent(text, spaces) {
  const prefix = ' '.repeat(spaces);
  return text.trimEnd().split('\n').map((line) => `${prefix}${line}`).join('\n');
}

function wrapClient(commonJs, css, moduleId, styleKey) {
  return `window.__ModuleLoader__.load({
  id: ${JSON.stringify(moduleId)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${indent(commonJs, 4)}
    var originalApply = module.exports.apply;
    module.exports.apply = async (ctx) => {
      var style = document.createElement("style");
      style.dataset[${JSON.stringify(styleKey)}] = "true";
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
