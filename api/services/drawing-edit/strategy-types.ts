import type { EditIntent } from '../../../src/contracts/drawing-spatial-agent.js';
import type {
  Bounds2D,
  DrawingCommand,
  DrawingDocument,
  GeometryNode,
} from '../../../src/drawing/index.js';

export interface CompileEditIntentContext {
  document: DrawingDocument;
  candidateGeometry?: GeometryNode[];
  anchorTolerance?: number;
}

export interface CompiledEditCandidate {
  intent: EditIntent;
  commands: DrawingCommand[];
  targetNodeIds: string[];
  preserveNodeIds: string[];
  allowedBounds: Bounds2D;
  strategy: 'exact-transform' | 'bounded-deform' | 'local-replacement';
}
