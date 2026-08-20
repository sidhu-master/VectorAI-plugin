import type {
  EvidenceId,
  GeometryId,
  Vec2,
} from '../../../src/drawing/index.js';

export type MeasurementFactKind =
  | 'centerline'
  | 'axial-length'
  | 'diameter'
  | 'radius'
  | 'angle'
  | 'chamfer';

interface MeasurementFactBase<TKind extends MeasurementFactKind> {
  key: string;
  kind: TKind;
  quality: 'confirmed';
  sourceIds: GeometryId[];
  evidenceRefs: EvidenceId[];
  method: string;
  error: number;
}

export interface CenterlineFact extends MeasurementFactBase<'centerline'> {
  start: Vec2;
  end: Vec2;
}

export interface AxialLengthFact extends MeasurementFactBase<'axial-length'> {
  value: number;
  first: Vec2;
  second: Vec2;
}

export interface DiameterFact extends MeasurementFactBase<'diameter'> {
  value: number;
  center: Vec2;
  first: Vec2;
  second: Vec2;
}

export interface RadiusFact extends MeasurementFactBase<'radius'> {
  value: number;
  center: Vec2;
  edge: Vec2;
}

export interface AngleFact extends MeasurementFactBase<'angle'> {
  value: number;
  vertex: Vec2;
  rays: readonly [Vec2, Vec2];
}

export interface ChamferFact extends MeasurementFactBase<'chamfer'> {
  value: number;
  angle: number;
  start: Vec2;
  end: Vec2;
}

export type MeasurementFact =
  | CenterlineFact
  | AxialLengthFact
  | DiameterFact
  | RadiusFact
  | AngleFact
  | ChamferFact;

export interface MeasurementAxis {
  origin: Vec2;
  direction: Vec2;
  status: 'confirmed' | 'conflict';
  sourceIds: GeometryId[];
  evidenceRefs: EvidenceId[];
  error: number;
}

export interface MeasurementConflict {
  code: string;
  message: string;
  sourceIds: GeometryId[];
}

export interface MeasurementResult {
  axis: MeasurementAxis;
  facts: MeasurementFact[];
  conflicts: MeasurementConflict[];
}
