import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { FileSourceArtifactStore } from './file-source-artifact-store';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('FileSourceArtifactStore', () => {
  it('deduplicates identical bytes and exposes byte-free metadata', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-sources-'));
    roots.push(rootDirectory);
    const store = new FileSourceArtifactStore({ rootDirectory });
    const input = { data: Buffer.from('drawing').toString('base64'), mimeType: 'image/png', page: 1 };

    const first = await store.put(input);
    const second = await store.put(input);

    expect(second).toEqual(first);
    expect(first).toMatchObject({
      sourceId: expect.stringMatching(/^source_/), mimeType: 'image/png',
      byteLength: 7, page: 1, sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(JSON.stringify(first)).not.toContain(input.data);
    expect(await store.read(first.sourceId)).toEqual({
      metadata: first, bytes: Buffer.from('drawing'),
    });
  });

  it('stores DXF and companion engineering text as immutable source artifacts', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-sources-'));
    roots.push(rootDirectory);
    const store = new FileSourceArtifactStore({ rootDirectory });

    const [dxf, document] = await Promise.all([
      store.put({ data: Buffer.from('0\nEOF').toString('base64'), mimeType: 'application/dxf' }),
      store.put({ data: Buffer.from('[drawing]\nunit=mm').toString('base64'), mimeType: 'text/plain' }),
    ]);

    expect(dxf.mimeType).toBe('application/dxf');
    expect(document.mimeType).toBe('text/plain');
  });

  it('rejects unsupported media and decoded payloads over the configured limit', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-sources-'));
    roots.push(rootDirectory);
    const store = new FileSourceArtifactStore({ rootDirectory, maxBytes: 4 });

    await expect(store.put({ data: 'dGV4dA==', mimeType: 'application/zip' }))
      .rejects.toThrow('SOURCE_MIME_UNSUPPORTED');
    await expect(store.put({ data: 'MTIzNDU=', mimeType: 'image/png' }))
      .rejects.toThrow('SOURCE_TOO_LARGE');
  });
});
