export interface DrawingBenchmarkTolerance {
  sourcePixelDistance: number;
  angleDegrees: number;
  edgeF1: number;
}

export interface DrawingEntityTypeMismatch {
  expectedId: string;
  actualId: string;
  expectedType: string;
  actualType: string;
}

export interface DrawingEntityParameterMismatch {
  expectedId: string;
  actualId: string;
  maxPixelError: number;
}

export interface DrawingBenchmarkReport {
  passed: boolean;
  entity: {
    precision: number;
    recall: number;
    missingIds: string[];
    extraIds: string[];
    typeMismatches: DrawingEntityTypeMismatch[];
    parameterMismatches: DrawingEntityParameterMismatch[];
  };
  topology: {
    passed: boolean;
    missing: string[];
    extra: string[];
  };
  associations: {
    passed: boolean;
    missing: string[];
    extra: string[];
  };
  residual: {
    edgeF1: number;
    unresolvedRegionCount: number;
  };
}
