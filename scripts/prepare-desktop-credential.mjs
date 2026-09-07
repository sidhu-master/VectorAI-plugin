// SPDX-License-Identifier: Apache-2.0

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function prepareCredential({ key, output }) {
  const normalized = String(key ?? '').trim();
  if (!normalized) throw new Error('VECTORAI_TEST_API_KEY_REQUIRED');
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, normalized, { mode: 0o600 });
  return { output, bytes: Buffer.byteLength(normalized) };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const outputIndex = process.argv.indexOf('--output');
  const output = resolve(process.argv[outputIndex + 1] ?? 'dist/desktop-runtime/secrets/vectorai-test-api-key');
  try {
    const result = await prepareCredential({
      key: process.env.VECTORAI_TEST_API_KEY,
      output,
    });
    process.stdout.write(`Desktop credential prepared: ${result.output} (${result.bytes} bytes)\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
