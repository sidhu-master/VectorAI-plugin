export interface DxfPair {
  code: number;
  value: string;
}

export interface DxfXDataSegment {
  application: string;
  pairs: DxfPair[];
}

export interface DxfEntityRecord {
  type: string;
  pairs: DxfPair[];
  handle?: string;
  ownerHandle?: string;
  xdata: DxfXDataSegment[];
}

export interface DxfBlockRecord {
  name: string;
  handle?: string;
  ownerHandle?: string;
  headerPairs: DxfPair[];
  endPairs: DxfPair[];
  entities: DxfEntityRecord[];
}

export interface DxfManifest {
  format: 'ascii-dxf';
  sections: string[];
  header: Record<string, DxfPair[]>;
  entities: DxfEntityRecord[];
  blocks: DxfBlockRecord[];
  unknownSections: Record<string, DxfPair[]>;
  pairCount: number;
}
