import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import YAML from 'yaml';

const configPath = resolve('apps/vectorai-desktop/electron-builder.yml');

describe('VectorAI desktop installer configuration', () => {
  it('packages a private native installer with the complete audited runtime', async () => {
    const config = YAML.parse(await readFile(configPath, 'utf8'));

    assert.equal(config.appId, 'ai.weigou.vectorai');
    assert.equal(config.productName, 'VectorAI');
    assert.equal(config.asar, true);
    assert.equal(config.directories.output, '../../dist/desktop-installers');

    const resourceNames = config.extraResources.map((entry) => entry.to);
    assert.deepEqual(resourceNames, [
      'runtime/runtime-manifest.json',
      'runtime/node',
      'runtime/dsh',
      'runtime/dsh/node_modules',
      'runtime/profile-seed',
      'runtime/default-settings.yaml',
      'runtime/secrets',
      'runtime/licenses',
    ]);

    assert.deepEqual(config.mac.target, [{ target: 'dmg', arch: ['arm64', 'x64'] }]);
    assert.equal(config.mac.minimumSystemVersion, '13.0.0');
    assert.equal(config.mac.hardenedRuntime, true);
    assert.equal(config.mac.identity, null);
    assert.equal(config.mac.entitlements, 'build/entitlements.mac.plist');
    assert.equal(config.mac.artifactName, 'VectorAI-${version}-mac-${arch}.${ext}');

    assert.deepEqual(config.win.target, [{ target: 'nsis', arch: ['x64'] }]);
    assert.equal(config.win.artifactName, 'VectorAI-${version}-win-${arch}-setup.${ext}');
    assert.equal(config.nsis.perMachine, false);
    assert.equal(config.nsis.allowElevation, false);
    assert.equal(config.nsis.oneClick, false);
  });
});
