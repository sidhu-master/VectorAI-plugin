export interface SourcePixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SourcePixelSize {
  width: number;
  height: number;
}

export interface CvToolBudget {
  maxPixels: number;
  maxResults: number;
  maxSamplesPerResult: number;
  timeoutMs: number;
}

export type CvEvidenceKind =
  | 'edge'
  | 'contour'
  | 'endpoint'
  | 'intersection'
  | 'primitive-candidate'
  | 'point-candidate'
  | 'line-candidate'
  | 'circle-candidate'
  | 'arc-candidate'
  | 'ellipse-candidate'
  | 'polyline-candidate'
  | 'spline-candidate';

export type SourcePixelPoint = readonly [x: number, y: number];

export interface CvEvidenceDraft {
  sourceId: string;
  regionId: string;
  kind: CvEvidenceKind;
  bounds: SourcePixelRect;
  confidence: number;
  touchesRegionEdge: boolean;
  samples: readonly SourcePixelPoint[];
}

export interface CvEvidenceSummary {
  handle: string;
  sourceId: string;
  regionId: string;
  kind: CvEvidenceKind;
  bounds: SourcePixelRect;
  confidence: number;
  touchesRegionEdge: boolean;
  sampleCount: number;
}

export interface CvEvidencePage {
  items: SourcePixelPoint[];
  nextOffset?: number;
  total: number;
}

export interface CvEvidenceStore {
  putEvidence(draft: CvEvidenceDraft): Promise<CvEvidenceSummary>;
  readSummary(handle: string): Promise<CvEvidenceSummary>;
  readSamples(handle: string, page: { offset: number; limit: number }): Promise<CvEvidencePage>;
}
