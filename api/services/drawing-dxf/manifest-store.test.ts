import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { FileDxfManifestStore } from './manifest-store';
import { parseAsciiDxf } from './raw-parser';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(
  (root) => rm(root, { recursive: true, force: true }),
)));

describe('FileDxfManifestStore', () => {
  it('round-trips a queryable manifest without source bytes', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-dxf-manifests-'));
    roots.push(rootDirectory);
    const store = new FileDxfManifestStore({ rootDirectory, now: () => 42 });
    const manifest = parseAsciiDxf([
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LINE', '5', 'A1', '10', '0', '20', '0', '11', '5', '21', '0',
      '1001', 'CAXA_TEST', '1000', 'opaque-value',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n'));

    await store.write({ sourceId: 'source_0123456789abcdef01234567', manifest });

    const stored = await store.read('source_0123456789abcdef01234567');
    expect(stored).toEqual({
      schemaVersion: '1.0',
      sourceId: 'source_0123456789abcdef01234567',
      createdAt: 42,
      manifest,
    });
    expect(JSON.stringify(stored)).not.toContain(Buffer.from('source bytes').toString('base64'));
  });

  it('rejects unsafe source IDs before resolving paths', async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), 'vectorai-dxf-manifests-'));
    roots.push(rootDirectory);
    const store = new FileDxfManifestStore({ rootDirectory });

    await expect(store.read('../escape')).rejects.toThrow('DXF_SOURCE_ID_INVALID');
  });
});
