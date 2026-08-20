import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  MemoryDrawingRepository,
  type CommitId,
  type IdFactory,
} from '../../../src/drawing';
import { DrawingApplication } from '../drawing-application/application';
import { FileSourceArtifactStore } from '../source-artifacts/file-source-artifact-store';
import { DxfImportCoordinator } from './coordinator';
import { FileDxfManifestStore } from './manifest-store';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(
  (root) => rm(root, { recursive: true, force: true }),
)));

describe('DxfImportCoordinator', () => {
  it('stores source data and atomically replaces the drawing with projected and recognized facts', async () => {
    const setup = await createSetup();
    const workspace = await setup.application.create({ unit: 'mm' });
    const dxf = await readFile(resolve(process.cwd(), '初始图.dxf'));
    const companion = await readFile(resolve(
      process.cwd(), '样本图001# DXF工程数据文档.txt',
    ));

    const result = await setup.coordinator.import({
      drawingId: workspace.document.id,
      fileName: '初始图.dxf',
      data: dxf.toString('base64'),
      mimeType: 'application/dxf',
      engineeringDocument: {
        fileName: '样本图001# DXF工程数据文档.txt',
        data: companion.toString('base64'),
        mimeType: 'text/plain',
      },
    });

    expect(result.workspace.document.geometry).toHaveLength(135);
    expect(result.workspace.document.annotations).toHaveLength(result.receipt.annotation.generatedCount);
    expect(result.workspace.document.annotations.every((annotation) => (
      ['dimension', 'centerline', 'leader', 'text', 'section-hatch'].includes(annotation.type)
    ))).toBe(true);
    // 分区标注流程：导入仅保留源标注投影，自动标注延后到分区确认之后
    expect(result.receipt.annotation).toMatchObject({
      generatedCount: expect.any(Number),
      pendingCount: 0,
      conflictCount: 0,
      coverage: { valid: true, missingFactKeys: [], duplicateFactKeys: [], pendingAnnotations: [], conflicts: [] },
    });
    expect(result.receipt.annotation.generatedCount).toBeGreaterThan(0);
    expect(result.workspace.document.features.some(
      (feature) => feature.semanticType === 'dxf-import',
    )).toBe(true);
    expect(result.workspace.commits).toHaveLength(1);
    expect(result.receipt.source.fileName).toBe('初始图.dxf');
    expect(result.receipt.projection.projectedGeometryCount).toBe(134);
    expect((await setup.sources.read(result.receipt.source.sourceId)).bytes).toEqual(dxf);
    expect((await setup.manifests.read(result.receipt.source.sourceId)).manifest.pairCount)
      .toBeGreaterThan(10_000);

    const reverted = await setup.application.revert({
      drawingId: workspace.document.id,
      commitId: result.workspace.commits[0].id as CommitId,
      actor: { type: 'user', id: 'fixture-user' },
    });
    expect(reverted.status).toBe('committed');
    expect((await setup.application.open(workspace.document.id)).document).toMatchObject({
      geometry: [], annotations: [], features: [], relations: [],
    });
  });

  it('reports real sample conflicts while keeping CAXA data in the persisted manifest', async () => {
    const setup = await createSetup();
    const workspace = await setup.application.create({ unit: 'mm' });
    const [dxf, companion] = await Promise.all([
      readFile(resolve(process.cwd(), '样本图001.dxf')),
      readFile(resolve(process.cwd(), '样本图001# DXF工程数据文档.txt')),
    ]);

    const result = await setup.coordinator.import({
      drawingId: workspace.document.id,
      fileName: '样本图001.dxf',
      data: dxf.toString('base64'),
      mimeType: 'application/dxf',
      engineeringDocument: {
        fileName: '工程数据.txt', data: companion.toString('base64'), mimeType: 'text/plain',
      },
    });
    const stored = await setup.manifests.read(result.receipt.source.sourceId);

    expect(result.receipt.recognition.regions.map((region) => [region.id, region.status]))
      .toEqual([
        ['G01', 'conflict'], ['S01', 'conflict'], ['B01', 'confirmed'], ['B02', 'candidate'],
      ]);
    expect(result.receipt.manifest.xdataApplications).toContain('CAXA_DRAFT_FORMATED_TXT');
    expect(stored.manifest.blocks.some((block) => block.entities.some(
      (entity) => entity.type === 'INSERT',
    ))).toBe(true);
  });

  it('does not change the drawing revision when parsing fails', async () => {
    const setup = await createSetup();
    const workspace = await setup.application.create({ unit: 'mm' });

    await expect(setup.coordinator.import({
      drawingId: workspace.document.id,
      fileName: 'broken.dxf',
      data: Buffer.from('0\nSECTION\n2').toString('base64'),
      mimeType: 'application/dxf',
    })).rejects.toMatchObject({ code: 'DXF_PARSE_FAILED' });

    expect(await setup.application.open(workspace.document.id)).toEqual(workspace);
  });
});

async function createSetup() {
  const root = await mkdtemp(join(tmpdir(), 'vectorai-dxf-import-'));
  roots.push(root);
  const idFactory = ids();
  const application = new DrawingApplication({
    repository: new MemoryDrawingRepository({ idFactory, now: () => 100 }),
    idFactory,
    now: () => 100,
  });
  const sources = new FileSourceArtifactStore({ rootDirectory: join(root, 'sources') });
  const manifests = new FileDxfManifestStore({ rootDirectory: join(root, 'manifests'), now: () => 100 });
  const coordinator = new DxfImportCoordinator({ application, sources, manifests });
  return { application, sources, manifests, coordinator };
}

function ids(): IdFactory {
  const counts = new Map<string, number>();
  return { next: (kind) => {
    const next = (counts.get(kind) ?? 0) + 1;
    counts.set(kind, next);
    return `${kind}_${next}`;
  } };
}
