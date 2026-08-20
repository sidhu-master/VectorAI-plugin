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
  pieces: CleanLineStrokePiece[];
  segmentation: CleanLineSegmentationAudit;
}

export interface CleanLineStrokePiece {
  id: string;
  sampleRange: [number, number];
  wraps: boolean;
  closed: boolean;
  simplified: SourcePixelPoint[];
  bounds: SourcePixelRect;
  candidate: CleanLinePrimitiveCandidate | null;
}

export interface CleanLineSegmentationDecision {
  sampleIndex: number;
  nearAngleDegrees: number;
  farAngleDegrees: number;
  stability: number;
  cornerScore: number;
  combinedFitErrorP95: number | null;
  childFitErrorP95: number[];
  splitGain: number | null;
  acceptScore: number | null;
  accepted: boolean;
  reason: string;
}

export interface CleanLineSegmentationAudit {
  algorithmVersion: string;
  drawingDiagonalPx: number;
  chainLengthPx: number;
  fitTolerancePx: number;
  nearWindowPx: number;
  farWindowPx: number;
  minimumSpanPx: number;
  splitPenalty: number;
  decisions: CleanLineSegmentationDecision[];
  cycleAssembly?: {
    sourceChainCount: number;
    endpointTolerancePx: number;
    fitTolerancePx: number;
    fitErrorP95: number;
    reason: 'shared-endpoints-circle-fit';
  };
  continuationAssembly?: {
    sourceChainCount: number;
    endpointTolerancePx: number;
    fitTolerancePx: number;
    fitErrorP95: number;
    tangentCosine: number;
    modelType: 'line' | 'arc';
    reason: 'shared-endpoint-smooth-analytic-fit';
  };
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
