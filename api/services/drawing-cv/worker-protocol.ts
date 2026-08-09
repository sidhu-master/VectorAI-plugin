import type {
  CvEvidenceKind,
  CvOverview,
  CvPrimitiveFit,
  CvPrimitiveType,
  CvToolBudget,
  SourcePixelPoint,
  SourcePixelRect,
} from './types.js';

export type CvWorkerRequest =
  | {
      id: string;
      operation: 'overview';
      rgba: ArrayBuffer;
      width: number;
      height: number;
      origin: SourcePixelPoint;
      budget: CvToolBudget;
    }
  | {
      id: string;
      operation: 'extract';
      rgba: ArrayBuffer;
      width: number;
      height: number;
      origin: SourcePixelPoint;
      budget: CvToolBudget;
    }
  | {
      id: string;
      operation: 'fit';
      samples: ArrayBuffer;
      primitiveType: CvPrimitiveType;
      budget: CvToolBudget;
    };

export interface CvWorkerEvidence {
  kind: CvEvidenceKind;
  bounds: SourcePixelRect;
  confidence: number;
  touchesRegionEdge: boolean;
  samples: SourcePixelPoint[];
}

export type CvWorkerValue = CvOverview | CvWorkerEvidence[] | CvPrimitiveFit;

export type CvWorkerMessage =
  | { type: 'ready' }
  | { type: 'response'; id: string; ok: true; value: CvWorkerValue }
  | { type: 'response'; id: string; ok: false; code: string; message: string };
