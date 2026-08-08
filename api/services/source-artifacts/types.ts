export const SOURCE_MIME_TYPES = [
  'image/png', 'image/jpeg', 'image/webp', 'application/pdf',
] as const;

export type SourceArtifactMimeType = typeof SOURCE_MIME_TYPES[number];

export interface SourceArtifactReference {
  sourceId: string;
  sha256: string;
  mimeType: SourceArtifactMimeType;
  byteLength: number;
  page: number;
}

export interface StoredSourceArtifact {
  metadata: SourceArtifactReference;
  bytes: Buffer;
}

export interface SourceArtifactStore {
  put(input: { data: string; mimeType: string; page?: number }): Promise<SourceArtifactReference>;
  read(sourceId: string): Promise<StoredSourceArtifact>;
}
