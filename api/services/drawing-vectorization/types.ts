import type {
  CvEvidenceSummary,
  CvPrimitiveType,
  CvSourceImage,
  SourcePixelPoint,
  SourcePixelRect,
} from '../drawing-cv/types.js';

export type CleanLineCandidateType = Extract<
  CvPrimitiveType,
  'line' | 'circle' | 'arc' | 'ellipse'
>;

export interface CleanLinePrimitiveCandidate {
  type: CleanLineCandidateType;
  parameters: Record<string, unknown>;
  fitErrorMean: number;
  fitErrorP95: number;
  fitErrorMax: number;
  confidence: number;
}

export interface CleanLineStrokeChain {
  id: string;
  closed: boolean;
  samples: SourcePixelPoint[];
  simplified: SourcePixelPoint[];
  bounds: SourcePixelRect;
  candidate: CleanLinePrimitiveCandidate | null;
}

export interface CleanLineVectorizationResult {
  sourceId: string;
  pipelineVersion: string;
  width: number;
  height: number;
  analysisScale: number;
  medianLineWidthPx: number;
  chains: CleanLineStrokeChain[];
}

export interface PersistedCleanLineStrokeChain extends CleanLineStrokeChain {
  evidence: CvEvidenceSummary;
}

export interface PersistedCleanLineVectorizationResult
  extends Omit<CleanLineVectorizationResult, 'chains'> {
  chains: PersistedCleanLineStrokeChain[];
}

export interface CleanLineVectorizationProvider {
  vectorize(input: {
    source: CvSourceImage;
    maxPixels: number;
    signal: AbortSignal;
  }): Promise<CleanLineVectorizationResult>;
  close(): Promise<void>;
}
