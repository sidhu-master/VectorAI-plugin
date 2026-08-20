import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { parseAsciiDxf } from './raw-parser';

describe('parseAsciiDxf', () => {
  it('parses header variables and preserves every model-space entity record', async () => {
    const source = await readFile(resolve(process.cwd(), '初始图.dxf'), 'utf8');

    const manifest = parseAsciiDxf(source);

    expect(manifest.header.$ACADVER?.[0]?.value).toBe('AC1027');
    expect(manifest.sections).toContain('HEADER');
    expect(manifest.sections).toContain('ENTITIES');
    expect(manifest.entities.filter((entity) => entity.type === 'LINE')).toHaveLength(89);
    expect(manifest.entities.filter((entity) => entity.type === 'SPLINE')).toHaveLength(33);
    expect(manifest.entities.filter((entity) => entity.type === 'ARC')).toHaveLength(12);
    expect(manifest.entities.filter((entity) => entity.type === 'HATCH')).toHaveLength(2);
    expect(manifest.entities[0]?.pairs[0]).toMatchObject({ code: 0 });
  });

  it('keeps anonymous blocks, nested inserts, handles, owners and CAXA XDATA queryable', async () => {
    const source = await readFile(resolve(process.cwd(), '样本图001.dxf'), 'utf8');

    const manifest = parseAsciiDxf(source);
    const modelInserts = manifest.entities.filter((entity) => entity.type === 'INSERT');
    const nestedInsert = manifest.blocks
      .flatMap((block) => block.entities)
      .find((entity) => entity.type === 'INSERT');
    const caxaRecord = [...manifest.entities, ...manifest.blocks.flatMap((block) => block.entities)]
      .find((entity) => entity.xdata.some((segment) => segment.application === 'CAXA_DRAFT_FORMATED_TXT'));

    expect(manifest.blocks.length).toBeGreaterThan(10);
    expect(modelInserts.length).toBeGreaterThan(10);
    expect(nestedInsert).toBeDefined();
    expect(modelInserts[0]).toMatchObject({
      handle: expect.any(String),
      ownerHandle: expect.any(String),
    });
    expect(caxaRecord?.xdata.find(
      (segment) => segment.application === 'CAXA_DRAFT_FORMATED_TXT',
    )?.pairs).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 1000 }),
      expect.objectContaining({ code: 1041 }),
    ]));
  });

  it('rejects malformed pair streams instead of silently dropping the tail', () => {
    expect(() => parseAsciiDxf('0\nSECTION\n2')).toThrowError('DXF_PAIR_TRUNCATED');
  });
});
