// SPDX-License-Identifier: Apache-2.0

import type { DrawingRef } from '@vectorai/drawing-edit-protocol';
import type { ShaftAxis } from '../partition/types';

export type DimensionEvidenceOrigin = 'geometry' | 'partition' | 'document' | 'manual' | 'ai';
export type AxialStationKind = 'drawing-end' | 'shoulder' | 'partition-boundary' | 'datum';

export interface AxialStation {
  id: string;
  coordinate: number;
  sourceCoordinate: number;
  unit: 'mm' | 'cm' | 'm';
  kinds: AxialStationKind[];
  geometryNodeIds: string[];
  evidenceIds: string[];
}

export interface AxialElementarySpan {
  id: string;
  startStationId: string;
  endStationId: string;
  nominalValue: number;
  segmentIds: string[];
  evidenceIds: string[];
}

export interface AxialTopology {
  drawingRef: DrawingRef;
  axis: ShaftAxis;
  unit: 'mm' | 'cm' | 'm';
  stations: AxialStation[];
  elementarySpans: AxialElementarySpan[];
}
