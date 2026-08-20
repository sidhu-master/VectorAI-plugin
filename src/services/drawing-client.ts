import type { DrawingWorkspaceSnapshot } from '@/contracts/drawing-application';
import type {
  Actor,
  CommitId,
  DrawingId,
  DrawingTransaction,
  RepositoryCommitResult,
} from '@/drawing';

type Fetcher = typeof fetch;

export interface DxfUploadFile {
  fileName: string;
  data: string;
  mimeType: string;
}

export interface DxfImportReceipt {
  source: {
    sourceId: string;
    fileName: string;
    sha256?: string;
    byteLength?: number;
  };
  engineeringDocument?: { sourceId: string; fileName: string };
  manifest?: {
    pairCount: number;
    blockCount: number;
    modelSpaceEntityCount: number;
    nestedInsertCount: number;
    xdataApplications: string[];
  };
  projection: {
    projectedGeometryCount: number;
    projectedAnnotationCount: number;
    [key: string]: unknown;
  };
  recognition: {
    regions: Array<{ id: string; status: 'confirmed' | 'candidate' | 'conflict' }>;
    [key: string]: unknown;
  };
  annotation: {
    generatedCount: number;
    pendingCount: number;
    conflictCount: number;
    coverage: { valid: boolean; [key: string]: unknown };
  };
  diagnostics?: Array<{ code: string; message: string }>;
}

export class DrawingClientError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DrawingClientError';
  }
}

export class DrawingClient {
  readonly #fetcher: Fetcher;

  constructor(options: { fetcher?: Fetcher } = {}) {
    this.#fetcher = options.fetcher ?? fetch.bind(globalThis);
  }

  async create(unit?: 'mm' | 'cm' | 'm'): Promise<DrawingWorkspaceSnapshot> {
    const data = await this.request<{ success: true; workspace: DrawingWorkspaceSnapshot }>(
      '/api/drawings',
      jsonRequest(unit === undefined ? {} : { unit }),
    );
    return data.workspace;
  }

  async open(drawingId: DrawingId): Promise<DrawingWorkspaceSnapshot> {
    const data = await this.request<{ success: true; workspace: DrawingWorkspaceSnapshot }>(
      `/api/drawings/${encodeURIComponent(drawingId)}`,
    );
    return data.workspace;
  }

  async execute(
    drawingId: DrawingId,
    transaction: DrawingTransaction,
  ): Promise<RepositoryCommitResult> {
    const data = await this.request<{ success: true; result: RepositoryCommitResult }>(
      `/api/drawings/${encodeURIComponent(drawingId)}/transactions`,
      jsonRequest({ transaction }),
    );
    return data.result;
  }

  async revert(
    drawingId: DrawingId,
    commitId: CommitId,
    actor: Actor,
  ): Promise<RepositoryCommitResult> {
    const data = await this.request<{ success: true; result: RepositoryCommitResult }>(
      `/api/drawings/${encodeURIComponent(drawingId)}/reverts`,
      jsonRequest({ commitId, actor }),
    );
    return data.result;
  }

  async clear(drawingId: DrawingId): Promise<DrawingWorkspaceSnapshot> {
    const data = await this.request<{
      success: true;
      workspace: DrawingWorkspaceSnapshot;
      stoppedRunIds: string[];
    }>(
      `/api/drawings/${encodeURIComponent(drawingId)}/clear`,
      jsonRequest({ actor: { type: 'user', id: 'local-user' } }),
    );
    return data.workspace;
  }

  async importDxf(
    drawingId: DrawingId,
    file: DxfUploadFile,
    engineeringDocument?: DxfUploadFile,
  ): Promise<{ workspace: DrawingWorkspaceSnapshot; receipt: DxfImportReceipt }> {
    const data = await this.request<{
      success: true;
      workspace: DrawingWorkspaceSnapshot;
      receipt: DxfImportReceipt;
    }>(
      `/api/drawings/${encodeURIComponent(drawingId)}/imports/dxf`,
      jsonRequest({ file, ...(engineeringDocument ? { engineeringDocument } : {}) }),
    );
    return { workspace: data.workspace, receipt: data.receipt };
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await this.#fetcher(url, init);
    const data = await response.json().catch(() => ({})) as unknown;
    if (!response.ok) {
      const message = isRecord(data)
        && isRecord(data.error)
        && typeof data.error.message === 'string'
        ? data.error.message
        : `Drawing API 请求失败 (${response.status})`;
      const code = isRecord(data)
        && isRecord(data.error)
        && typeof data.error.code === 'string'
        ? data.error.code
        : undefined;
      throw new DrawingClientError(message, code, response.status);
    }
    if (!isRecord(data) || data.success !== true) {
      throw new Error('Drawing API 响应结构无效');
    }
    return data as T;
  }
}

function jsonRequest(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export const drawingClient = new DrawingClient();
