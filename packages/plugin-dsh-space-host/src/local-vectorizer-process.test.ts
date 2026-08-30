// SPDX-License-Identifier: Apache-2.0

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { LocalVectorizerProcess } from './local-python-vectorizer';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('LocalVectorizerProcess', () => {
  it('launches a standalone executable and validates its health handshake', async () => {
    const worker = await workerScript({
      protocolVersion: 'vectorai-vectorizer-1',
      pipelineVersion: 'clean-line-v5',
    });
    const workerProcess = await LocalVectorizerProcess.create({
      executablePath: process.execPath,
      args: [worker],
      timeoutMs: 2_000,
      expected: { protocolVersion: 'vectorai-vectorizer-1', pipelineVersion: 'clean-line-v5' },
    });

    expect(workerProcess.health).toMatchObject({
      protocolVersion: 'vectorai-vectorizer-1',
      pipelineVersion: 'clean-line-v5',
      pythonVersion: '3.12.11',
    });
    await workerProcess.close();
  });

  it('rejects a worker with the wrong protocol before vectorization', async () => {
    const worker = await workerScript({
      protocolVersion: 'vectorai-vectorizer-0',
      pipelineVersion: 'clean-line-v5',
    });
    await expect(LocalVectorizerProcess.create({
      executablePath: process.execPath,
      args: [worker],
      timeoutMs: 2_000,
      expected: { protocolVersion: 'vectorai-vectorizer-1', pipelineVersion: 'clean-line-v5' },
    })).rejects.toThrow('VECTORAI_VECTORIZER_PROTOCOL_MISMATCH');
  });
});

async function workerScript(input: { protocolVersion: string; pipelineVersion: string }): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-worker-test-'));
  temporaryDirectories.push(root);
  const path = join(root, 'worker.cjs');
  await writeFile(path, `
    const readline = require('node:readline');
    readline.createInterface({ input: process.stdin }).on('line', (line) => {
      const request = JSON.parse(line);
      const value = request.operation === 'health' ? ${JSON.stringify({
        ...input,
        pythonVersion: '3.12.11',
        dependencies: {
          numpy: '2.3.3',
          'opencv-python-headless': '4.12.0.88',
          'scikit-image': '0.25.2',
        },
      })} : null;
      process.stdout.write(JSON.stringify({ id: request.id, ok: true, value }) + '\\n');
    });
  `);
  return path;
}
