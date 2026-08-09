import type { CvEvidenceKind, CvEvidenceStore, CvSourceImage } from '../drawing-cv/types.js';
import type {
  CleanLineVectorizationProvider,
  PersistedCleanLineVectorizationResult,
} from './types.js';

interface CleanLineSourceGateway {
  read(sourceId: string): Promise<CvSourceImage>;
}

export class CleanLineVectorizationService {
  readonly #provider: CleanLineVectorizationProvider;
  readonly #sources: CleanLineSourceGateway;
  readonly #evidence: CvEvidenceStore;

  constructor(input: {
    provider: CleanLineVectorizationProvider;
    sources: CleanLineSourceGateway;
    evidence: CvEvidenceStore;
  }) {
    this.#provider = input.provider;
    this.#sources = input.sources;
    this.#evidence = input.evidence;
  }

  async vectorizeSource(input: {
    sourceId: string;
    maxPixels: number;
    signal: AbortSignal;
  }): Promise<PersistedCleanLineVectorizationResult> {
    const source = await this.#sources.read(input.sourceId);
    if (source.sourceId !== input.sourceId) throw new Error('VECTORIZATION_SOURCE_ID_MISMATCH');
    const result = await this.#provider.vectorize({
      source,
      maxPixels: input.maxPixels,
      signal: input.signal,
    });
    if (result.sourceId !== input.sourceId
      || result.width !== source.width || result.height !== source.height) {
      throw new Error('VECTORIZATION_SOURCE_SCOPE_MISMATCH');
    }
    const chains = await Promise.all(result.chains.map(async (chain) => {
      const evidence = await this.#evidence.putEvidence({
        sourceId: input.sourceId,
        regionId: `vector_${chain.id}`,
        kind: evidenceKind(chain.candidate?.type),
        bounds: { ...chain.bounds },
        confidence: chain.candidate?.confidence ?? 0.8,
        touchesRegionEdge: touchesSourceEdge(chain.bounds, result.width, result.height),
        samples: chain.samples,
      });
      return { ...structuredClone(chain), evidence };
    }));
    return { ...structuredClone(result), chains };
  }
}

function evidenceKind(type: string | undefined): CvEvidenceKind {
  switch (type) {
    case 'line': return 'line-candidate';
    case 'circle': return 'circle-candidate';
    case 'arc': return 'arc-candidate';
    case 'ellipse': return 'ellipse-candidate';
    default: return 'polyline-candidate';
  }
}

function touchesSourceEdge(
  bounds: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): boolean {
  const tolerance = 1;
  return bounds.x <= tolerance || bounds.y <= tolerance
    || bounds.x + bounds.width >= width - tolerance
    || bounds.y + bounds.height >= height - tolerance;
}
