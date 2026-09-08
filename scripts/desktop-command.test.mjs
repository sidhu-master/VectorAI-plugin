// SPDX-License-Identifier: Apache-2.0

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { platformInvocation, portableTarEnvironment } from './desktop-command.mjs';

describe('desktop subprocess commands', () => {
  it('uses executable command shims for Node package managers on Windows', () => {
    assert.deepEqual(platformInvocation('pnpm', ['runtime:pack'], 'win32', 'cmd.exe'), {
      command: 'cmd.exe',
      args: ['/d', '/s', '/c', 'pnpm.cmd', 'runtime:pack'],
    });
    assert.equal(platformInvocation('corepack', [], 'win32').args[3], 'corepack.cmd');
    assert.equal(platformInvocation('npm', [], 'win32').args[3], 'npm.cmd');
  });

  it('leaves native executables and non-Windows commands unchanged', () => {
    assert.deepEqual(platformInvocation('git', ['status'], 'win32'), {
      command: 'git',
      args: ['status'],
    });
    assert.deepEqual(platformInvocation('pnpm', ['test'], 'darwin'), {
      command: 'pnpm',
      args: ['test'],
    });
  });

  it('forces Windows tar to treat drive-letter archives as local files', () => {
    assert.deepEqual(platformInvocation('tar', ['-tzf', 'D:\\bundle.tgz'], 'win32'), {
      command: 'tar',
      args: ['--force-local', '-tzf', 'D:\\bundle.tgz'],
    });
  });

  it('passes the same local-path rule to nested Windows tar subprocesses', () => {
    assert.deepEqual(portableTarEnvironment({ PATH: 'bin' }, 'win32'), {
      PATH: 'bin',
      TAR_OPTIONS: '--force-local',
    });
    assert.equal(
      portableTarEnvironment({ TAR_OPTIONS: '--warning=no-unknown-keyword' }, 'win32').TAR_OPTIONS,
      '--warning=no-unknown-keyword --force-local',
    );
    assert.deepEqual(portableTarEnvironment({ PATH: 'bin' }, 'darwin'), { PATH: 'bin' });
  });
});
