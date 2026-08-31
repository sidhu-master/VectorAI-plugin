// SPDX-License-Identifier: Apache-2.0

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

interface PackageManifest {
  name: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  exports?: Record<string, unknown>;
  dsh?: { bundle?: { patch?: string } };
}

const root = resolve(import.meta.dirname, '..');

describe('DSH plugin bundle boundaries', () => {
  it('keeps the first-layer install bundle independent from professional plugins', () => {
    const bundle = readManifest('packages/plugin-dsh-space/package.json');

    expect(bundle.name).toBe('@newwe/vectorai-plugin-dsh-space');
    expect(bundle.dependencies).toEqual({ sharp: '^0.35.3', zod: '4.4.3' });
    expect(bundle.optionalDependencies).toBeUndefined();
    expect(readPatchServices('packages/plugin-dsh-space/cordis.patch.yml')).toEqual([
      '@newwe/vectorai-plugin-dsh-space',
    ]);
  });

  it('ships annotation as a symmetric install bundle over the first layer', () => {
    const bundle = readManifest('packages/plugin-dsh-annotation/package.json');
    const host = readManifest('packages/plugin-dsh-annotation-host/package.json');
    const client = readManifest('packages/plugin-dsh-annotation-client/package.json');

    expect(bundle).toMatchObject({
      name: '@newwe/vectorai-plugin-dsh-annotation',
      dsh: { bundle: { patch: './cordis.patch.yml' } },
    });
    expect(bundle.dependencies).toEqual({
      '@node-projects/acad-ts': '3.0.2',
      officeparser: '7.8.0',
    });
    expect(host.name).toBe('@vectorai/plugin-dsh-annotation-host');
    expect(client.name).toBe('@vectorai/plugin-dsh-annotation-client');
    expect(host.exports?.['./package.json']).toBe('./package.json');
    expect(client.exports?.['./package.json']).toBe('./package.json');
    expect(readPatchServices('packages/plugin-dsh-annotation/cordis.patch.yml')).toEqual([
      '@newwe/vectorai-plugin-dsh-annotation',
    ]);
  });

  it('lets both Host packages augment the same Cordis context without a type conflict', () => {
    const result = spawnSync(process.execPath, [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '-p',
      resolve(root, 'packages/plugin-dsh-space-host/type-tests/tsconfig.json'),
    ], { cwd: root, encoding: 'utf8' });

    expect(`${result.stdout}${result.stderr}`).toBe('');
    expect(result.status).toBe(0);
  }, 30_000);

  it('keeps the local Office parser on the Host dependency path instead of bundling its browser CDN defaults', () => {
    const buildScript = readFileSync(resolve(root, 'scripts/build-dsh-space.mjs'), 'utf8');

    expect(buildScript).toContain("id === 'officeparser'");
    expect(readManifest('packages/plugin-dsh-annotation-host/package.json').dependencies)
      .toMatchObject({ officeparser: '7.8.0' });
  });

  it.each([
    ['space', '@newwe/vectorai-plugin-dsh-space'],
    ['annotation', '@newwe/vectorai-plugin-dsh-annotation'],
  ])('owns the %s bundle TYPERT manifest under its published package name', (bundle, packageName) => {
    const typert = readFileSync(resolve(root, `packages/plugin-dsh-${bundle}/lib/typert.js`), 'utf8');

    expect(typert).toContain(`package: ${JSON.stringify(packageName)}`);
  });
});

function readManifest(relativePath: string): PackageManifest {
  try {
    return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8')) as PackageManifest;
  } catch {
    return { name: '__missing__' };
  }
}

function readPatchServices(relativePath: string): string[] {
  try {
    return Array.from(
      readFileSync(resolve(root, relativePath), 'utf8').matchAll(/^\s+name:\s+['"]?([^'"\s]+)['"]?\s*$/gm),
      (match) => match[1],
    );
  } catch {
    return [];
  }
}
