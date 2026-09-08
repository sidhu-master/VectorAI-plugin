import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import YAML from 'yaml';

import { auditDesktopArtifactDirectory, verifyDesktopArtifacts } from './verify-desktop-artifact-set.mjs';

const version = '0.1.0-alpha.1';
const commit = 'a'.repeat(40);
const records = [
  record('darwin-arm64', `VectorAI-${version}-mac-arm64.dmg`),
  record('darwin-x64', `VectorAI-${version}-mac-x64.dmg`),
  record('win32-x64', `VectorAI-${version}-win-x64-setup.exe`),
];

describe('desktop installer artifact inventory', () => {
  it('requires exactly the three native installers from one version and commit', () => {
    assert.deepEqual(
      verifyDesktopArtifacts(records, { version, commit }).map((entry) => entry.target),
      ['darwin-arm64', 'darwin-x64', 'win32-x64'],
    );
    assert.throws(
      () => verifyDesktopArtifacts(records.slice(1), { version, commit }),
      /DESKTOP_ARTIFACT_MISSING:darwin-arm64/u,
    );
  });

  it('rejects wrong names, digests, versions, commits, sizes, and extra targets', () => {
    for (const mutation of [
      { ...records[0], file: 'VectorAI-wrong.dmg' },
      { ...records[0], sha256: 'bad' },
      { ...records[0], version: '9.9.9' },
      { ...records[0], commit: 'b'.repeat(40) },
      { ...records[0], size: 0 },
      { ...records[0], target: 'linux-x64' },
    ]) {
      assert.throws(() => verifyDesktopArtifacts([mutation, ...records.slice(1)], { version, commit }));
    }
  });

  it('hashes the exact files in the aggregate directory and rejects extras', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'vectorai-artifacts-'));
    try {
      for (const entry of records) {
        const body = Buffer.from(entry.target);
        const actual = { ...entry, size: body.length, sha256: createHash('sha256').update(body).digest('hex') };
        await writeFile(join(directory, entry.file), body);
        await writeFile(join(directory, `${entry.target}.artifact.json`), JSON.stringify(actual));
      }
      assert.equal((await auditDesktopArtifactDirectory(directory, { version, commit })).length, 3);
      await writeFile(join(directory, 'unexpected.txt'), 'x');
      await assert.rejects(
        auditDesktopArtifactDirectory(directory, { version, commit }),
        /DESKTOP_ARTIFACT_UNEXPECTED_FILE:unexpected.txt/u,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('defines a manual three-runner build with no publication step', async () => {
    const source = await readFile(resolve('.github/workflows/vectorai-desktop-test-build.yml'), 'utf8');
    const workflow = YAML.parse(source);
    const matrix = workflow.jobs.build.strategy.matrix.include;
    assert.deepEqual(matrix.map(({ runner, target }) => [runner, target]), [
      ['macos-14', 'darwin-arm64'],
      ['macos-15-intel', 'darwin-x64'],
      ['windows-2025', 'win32-x64'],
    ]);
    assert.equal(workflow.on.workflow_dispatch.inputs.version.required, true);
    assert.match(source, /@pnpm\/exe@11\.7\.0/u);
    assert.match(source, /GITHUB_PATH/u);
    assert.doesNotMatch(source, /npm publish|release:dsh-plugins/u);
  });
});

function record(target, file) {
  return { target, version, commit, file, sha256: 'f'.repeat(64), size: 123 };
}
