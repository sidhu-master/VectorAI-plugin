// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import {
  assertCleanWorktree, installCommands, parseReleaseArgs, pendingPublications,
  publicationOrder, runRelease,
} from './release-dsh-plugins.mjs';
import { waitForNpmPackage } from './wait-for-npm-package.mjs';

const manifest = {
  version: '1.2.3-alpha.1',
  runtimes: [{ name: 'runtime-a' }, { name: 'runtime-b' }],
  bundles: ['space', 'annotation'],
  dsh: {
    profile: 'web',
    installArgs: { annotation: ['--allow-build=tesseract.js'] },
  },
};

describe('guarded DSH release workflow', () => {
  it('validates semver and npm tag arguments', () => {
    expect(parseReleaseArgs(['--version', '1.2.3-alpha.1', '--tag', 'alpha']))
      .toEqual({ version: '1.2.3-alpha.1', tag: 'alpha' });
    expect(() => parseReleaseArgs(['--version', 'next', '--tag', 'alpha'])).toThrow(/semver/i);
  });

  it('requires a clean worktree', () => {
    expect(() => assertCleanWorktree('')).not.toThrow();
    expect(() => assertCleanWorktree(' M package.json')).toThrow(/clean worktree/i);
  });

  it('publishes runtimes, then space, then annotation', () => {
    expect(publicationOrder(manifest)).toEqual(['runtime-a', 'runtime-b', 'space', 'annotation']);
  });

  it('resumes after packages already recorded in the receipt', () => {
    expect(pendingPublications(['a', 'b', 'c'], { published: [
      { name: 'a', integrity: 'sha512-a' },
      { name: 'b', publishedAt: 'awaiting scan' },
    ] })).toEqual(['b', 'c']);
  });

  it('installs the two bundles in separate ordered DSH commands', () => {
    expect(installCommands(manifest)).toEqual([
      ['plugin', '--profile', 'web', 'add', 'space@1.2.3-alpha.1'],
      ['plugin', '--profile', 'web', 'add', '--allow-build=tesseract.js', 'annotation@1.2.3-alpha.1'],
    ]);
  });

  it('polls npm scanning and times out deterministically', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('not ready'));
    await expect(waitForNpmPackage('pkg', '1.0.0', {
      lookup, delay: async () => {}, attempts: 2,
    })).rejects.toThrow(/timed out/i);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('checks exact DSH registry readiness before release mutation or publication', async () => {
    const events: string[] = [];
    await runRelease({
      args: ['--version', '1.2.3-alpha.1', '--tag', 'alpha'],
      effects: {
        status: () => '',
        readConfiguredManifest: () => manifest,
        checkRegistry: async () => { events.push('registry-check'); },
        prepare: () => { events.push('prepare'); },
        pack: () => { events.push('pack'); },
        readPreparedManifest: () => manifest,
        loadReceipt: () => ({ version: manifest.version, tag: 'alpha', published: [] }),
        artifacts: () => Object.fromEntries(publicationOrder(manifest).map((name) => [name, `${name}.tgz`])),
        artifactExists: () => true,
        authenticate: () => {},
        publish: (name: string) => { events.push(`publish:${name}`); },
        waitForPackage: async () => ({ dist: { integrity: 'sha512-ready' } }),
        saveReceipt: () => {},
        verifyPublic: () => {},
        commit: () => 'abc123',
        now: () => '2026-09-05T00:00:00.000Z',
      },
    });

    expect(events[0]).toBe('registry-check');
    expect(events.indexOf('registry-check')).toBeLessThan(events.indexOf('prepare'));
    expect(events.indexOf('registry-check')).toBeLessThan(events.findIndex((event) => event.startsWith('publish:')));
  });
});
