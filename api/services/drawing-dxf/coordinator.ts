import type {
  DrawingCommand,
  DrawingId,
  DrawingTransaction,
  EvidenceId,
} from '../../../src/drawing/index.js';
import type { DrawingWorkspaceSnapshot } from '../../../src/contracts/drawing-application.js';
import type { DrawingApplication } from '../drawing-application/application.js';
import type {
  SourceArtifactReference,
  SourceArtifactStore,
} from '../source-artifacts/types.js';
import type {
  AnnotationCoverageReport,
} from '../drawing-annotation/coverage.js';
import { parseEngineeringDocument } from './engineering-document.js';
import type { DxfManifestStore } from './manifest-store.js';
import { projectDxfToDrawing, type DxfProjectionDiagnostic } from './projector.js';
import { parseAsciiDxf } from './raw-parser.js';
import { recognizeDxfFacts, type DxfRecognition } from './recognizer.js';
import type { DxfManifest } from './types.js';

/**
 * 分区标注流程下，DXF 导入不再生成确定性标注（仅保留源标注投影），
 * 自动标注统一延后到「分区确认」之后按分区生成，覆盖率报告以空值占位。
 */
const EMPTY_ANNOTATION_COVERAGE: AnnotationCoverageReport = {
  valid: true,
  expectedFactKeys: [],
  consumedFactKeys: [],
  missingFactKeys: [],
  duplicateFactKeys: [],
  suppressedFactKeys: [],
  invalidSuppressedFactKeys: [],
  invalidAnnotationIds: [],
  pendingAnnotations: [],
  conflicts: [],
};

export class DxfImportError extends Error {
  readonly code:
    | 'DXF_PARSE_FAILED'
    | 'DXF_UNIT_MISMATCH'
    | 'DXF_ENGINEERING_DOCUMENT_INVALID'
    | 'DXF_IMPORT_REJECTED';

  constructor(code: DxfImportError['code'], message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'DxfImportError';
    this.code = code;
    if (options && 'cause' in options) {
      Object.defineProperty(this, 'cause', { value: options.cause, enumerable: false });
    }
  }
}

export interface DxfImportReceipt {
  source: SourceArtifactReference & { fileName: string };
  engineeringDocument?: SourceArtifactReference & { fileName: string };
  manifest: {
    pairCount: number;
    blockCount: number;
    modelSpaceEntityCount: number;
    nestedInsertCount: number;
    xdataApplications: string[];
  };
  projection: {
    sourceEntityCount: number;
    projectedGeometryCount: number;
    projectedAnnotationCount: number;
    expandedInsertCount: number;
    unsupportedEntityCount: number;
  };
  recognition: Omit<DxfRecognition, 'geometry' | 'features'>;
  annotation: {
    generatedCount: number;
    pendingCount: number;
    conflictCount: number;
    coverage: AnnotationCoverageReport;
  };
  diagnostics: DxfProjectionDiagnostic[];
}

export interface DxfImportResult {
  workspace: DrawingWorkspaceSnapshot;
  receipt: DxfImportReceipt;
}

export class DxfImportCoordinator {
  readonly #application: DrawingApplication;
  readonly #sources: SourceArtifactStore;
  readonly #manifests: DxfManifestStore;

  constructor(input: {
    application: DrawingApplication;
    sources: SourceArtifactStore;
    manifests: DxfManifestStore;
  }) {
    this.#application = input.application;
    this.#sources = input.sources;
    this.#manifests = input.manifests;
  }

  async import(input: {
    drawingId: DrawingId;
    fileName: string;
    data: string;
    mimeType: string;
    engineeringDocument?: { fileName: string; data: string; mimeType: string };
  }): Promise<DxfImportResult> {
    const source = await this.#sources.put({
      data: input.data,
      mimeType: normalizeDxfMime(input.mimeType),
    });
    const stored = await this.#sources.read(source.sourceId);
    let manifest: DxfManifest;
    try {
      manifest = parseAsciiDxf(decodeDxf(stored.bytes));
      if (!manifest.sections.includes('ENTITIES')) throw new Error('DXF_ENTITIES_SECTION_MISSING');
    } catch (error) {
      throw new DxfImportError(
        'DXF_PARSE_FAILED',
        `DXF 解析失败: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }

    let engineeringReference: SourceArtifactReference | undefined;
    let engineeringDocument: ReturnType<typeof parseEngineeringDocument> | undefined;
    if (input.engineeringDocument) {
      try {
        engineeringReference = await this.#sources.put({
          data: input.engineeringDocument.data,
          mimeType: 'text/plain',
        });
        const documentSource = await this.#sources.read(engineeringReference.sourceId);
        engineeringDocument = parseEngineeringDocument(
          new TextDecoder('utf-8', { fatal: true }).decode(documentSource.bytes),
        );
      } catch (error) {
        throw new DxfImportError(
          'DXF_ENGINEERING_DOCUMENT_INVALID',
          `工程数据文档无效: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
    }

    const projection = projectDxfToDrawing(manifest, { sourceId: source.sourceId });
    let recognition: DxfRecognition;
    try {
      recognition = recognizeDxfFacts({
        sourceId: source.sourceId,
        manifest,
        projection,
        ...(engineeringDocument ? { engineeringDocument } : {}),
        ...(engineeringReference ? { engineeringSourceId: engineeringReference.sourceId } : {}),
      });
    } catch (error) {
      throw new DxfImportError(
        'DXF_PARSE_FAILED',
        `DXF 几何投影失败: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
    const current = await this.#application.readCurrent(input.drawingId);
    if (current.document.unitSystem.length !== recognition.unit) {
      throw new DxfImportError(
        'DXF_UNIT_MISMATCH',
        `当前图纸单位为 ${current.document.unitSystem.length}，DXF 单位为 ${recognition.unit}`,
      );
    }
    if (engineeringDocument && engineeringDocument.drawing.unit !== recognition.unit) {
      throw new DxfImportError(
        'DXF_UNIT_MISMATCH',
        `工程文档单位为 ${engineeringDocument.drawing.unit}，DXF 单位为 ${recognition.unit}`,
      );
    }

    const importedGeometry = [...projection.geometry, ...recognition.geometry];

    await this.#manifests.write({ sourceId: source.sourceId, manifest });
    const evidence = `dxf:${source.sourceId}:manifest` as EvidenceId;
    const commands = replacementCommands(current.document, {
      geometry: importedGeometry,
      annotations: projection.annotations,
      features: recognition.features,
    });
    const transaction: DrawingTransaction = {
      id: `tx_dxf_import_${source.sha256.slice(0, 20)}`,
      baseRevision: current.revision,
      actor: { type: 'system', id: 'dxf-importer' },
      commands,
      preconditions: [],
      postconditions: [{ type: 'document.valid' }],
      evidenceRefs: [
        evidence,
        ...(engineeringReference
          ? [`engineering-document:${engineeringReference.sourceId}` as EvidenceId]
          : []),
      ],
      metadata: {
        episodeId: `dxf-import:${source.sourceId}`,
        summary: `导入 ${safeFileName(input.fileName)}，投影 ${projection.geometry.length} 个图元和 ${projection.annotations.length} 个源标注；自动标注将在分区确认后生成`,
        confidence: 1,
      },
    };
    const committed = await this.#application.execute({
      drawingId: input.drawingId,
      transaction,
    });
    if (committed.status !== 'committed') {
      const detail = committed.status === 'rejected'
        ? committed.errors.map((error) => `${error.code}: ${error.message}`).join('; ')
        : '导入事务未产生变更';
      throw new DxfImportError('DXF_IMPORT_REJECTED', detail);
    }
    const workspace = await this.#application.open(input.drawingId);
    const { geometry: _geometry, features: _features, ...recognitionReceipt } = recognition;
    void _geometry;
    void _features;
    return {
      workspace,
      receipt: {
        source: { ...source, fileName: safeFileName(input.fileName) },
        ...(engineeringReference && input.engineeringDocument
          ? { engineeringDocument: {
            ...engineeringReference,
            fileName: safeFileName(input.engineeringDocument.fileName),
          } }
          : {}),
        manifest: manifestSummary(manifest),
        projection: projection.summary,
        recognition: recognitionReceipt,
        annotation: {
          generatedCount: projection.annotations.length,
          pendingCount: 0,
          conflictCount: 0,
          coverage: EMPTY_ANNOTATION_COVERAGE,
        },
        diagnostics: projection.diagnostics,
      },
    };
  }
}

function replacementCommands(
  current: DrawingWorkspaceSnapshot['document'],
  imported: {
    geometry: DrawingWorkspaceSnapshot['document']['geometry'];
    annotations: DrawingWorkspaceSnapshot['document']['annotations'];
    features: DrawingWorkspaceSnapshot['document']['features'];
  },
): DrawingCommand[] {
  return [
    ...current.relations.map((node) => ({ type: 'relation.delete' as const, id: node.id })),
    ...current.features.map((node) => ({ type: 'feature.delete' as const, id: node.id })),
    ...current.annotations.map((node) => ({ type: 'annotation.delete' as const, id: node.id })),
    ...current.geometry.map((node) => ({ type: 'geometry.delete' as const, id: node.id })),
    ...imported.geometry.map((node) => ({ type: 'geometry.create' as const, value: node })),
    ...imported.annotations.map((node) => ({ type: 'annotation.create' as const, value: node })),
    ...imported.features.map((node) => ({ type: 'feature.create' as const, value: node })),
  ];
}

function manifestSummary(manifest: DxfManifest): DxfImportReceipt['manifest'] {
  const all = [...manifest.entities, ...manifest.blocks.flatMap((block) => block.entities)];
  return {
    pairCount: manifest.pairCount,
    blockCount: manifest.blocks.length,
    modelSpaceEntityCount: manifest.entities.length,
    nestedInsertCount: manifest.blocks.flatMap((block) => block.entities)
      .filter((entity) => entity.type === 'INSERT').length,
    xdataApplications: [...new Set(all.flatMap(
      (entity) => entity.xdata.map((segment) => segment.application),
    ))].sort(),
  };
}

function normalizeDxfMime(mimeType: string): 'application/dxf' | 'application/x-dxf' | 'image/vnd.dxf' {
  if (mimeType === 'application/x-dxf' || mimeType === 'image/vnd.dxf') return mimeType;
  return 'application/dxf';
}

function decodeDxf(bytes: Buffer): string {
  const binarySignature = bytes.subarray(0, 22).toString('latin1');
  if (binarySignature.startsWith('AutoCAD Binary DXF')) {
    throw new Error('DXF_BINARY_UNSUPPORTED');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    const latin = bytes.toString('latin1');
    const encoding = /\$DWGCODEPAGE[\s\S]{0,80}?ANSI_936/i.test(latin) ? 'gb18030' : 'windows-1252';
    return new TextDecoder(encoding).decode(bytes);
  }
}

function safeFileName(fileName: string): string {
  const cleaned = Array.from(fileName)
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 31 && codePoint !== 127;
    })
    .join('')
    .trim()
    .slice(0, 255);
  return cleaned || 'drawing.dxf';
}
