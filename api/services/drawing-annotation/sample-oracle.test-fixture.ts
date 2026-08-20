export type SampleNominalDimensionKind = 'linear' | 'angular' | 'radius';

export interface SampleNominalDimension {
  kind: SampleNominalDimensionKind;
  value: number;
}

export const SAMPLE_NOMINAL_DIMENSIONS: SampleNominalDimension[] = [
  { kind: 'linear', value: 57.03 },
  { kind: 'linear', value: 35 },
  { kind: 'linear', value: 40 },
  { kind: 'linear', value: 51 },
  { kind: 'linear', value: 38 },
  { kind: 'linear', value: 35 },
  { kind: 'linear', value: 44.59 },
  { kind: 'linear', value: 173 },
  { kind: 'linear', value: 55 },
  { kind: 'linear', value: 105 },
  { kind: 'linear', value: 24.5 },
  { kind: 'linear', value: 28 },
  { kind: 'linear', value: 8 },
  { kind: 'linear', value: 17 },
  { kind: 'linear', value: 42.21 },
  { kind: 'linear', value: 1 },
  { kind: 'linear', value: 3 },
  { kind: 'angular', value: 60 },
  { kind: 'angular', value: 120 },
  { kind: 'angular', value: 60 },
  { kind: 'linear', value: 1 },
  { kind: 'linear', value: 3 },
  { kind: 'linear', value: 20 },
  { kind: 'angular', value: 120 },
  { kind: 'radius', value: 3 },
  { kind: 'radius', value: 2 },
  { kind: 'linear', value: 3 },
  { kind: 'linear', value: 47.93 },
];

export const SAMPLE_DEFERRED_CATEGORIES = [
  'tolerance',
  'roughness',
  'datum',
  'geometric-tolerance',
  'section-marker',
  'arbitrary-note',
] as const;

export interface SampleAnnotationOracleInspection {
  nominalDimensions: SampleNominalDimension[];
  deferredCategories: Array<(typeof SAMPLE_DEFERRED_CATEGORIES)[number]>;
  unreadableNominalHandles: string[];
}

export function inspectSampleAnnotationOracle(filePath: string): SampleAnnotationOracleInspection {
  const manifest = parseAsciiDxf(fs.readFileSync(filePath, 'utf8'));
  const projection = projectDxfToDrawing(manifest, { sourceId: 'sample-oracle' });
  const dimensions = manifest.entities.filter((entity) => entity.type === 'DIMENSION');
  const projectedDimensions = projection.annotations.filter((annotation) => annotation.type === 'dimension');
  const blocks = new Map(manifest.blocks.map((block) => [block.name, block]));
  const unreadableNominalHandles: string[] = [];
  const nominalDimensions = dimensions.flatMap((entity, index): SampleNominalDimension[] => {
    const projected = projectedDimensions[index];
    const rawKind = integerValue(entity.pairs, 70, 0) & 7;
    const kind: SampleNominalDimensionKind = rawKind === 2 || rawKind === 5
      ? 'angular'
      : rawKind === 4 ? 'radius' : 'linear';
    const fromGeometry = projected?.computedValue;
    const fromBlock = firstNumericBlockText(blocks.get(value(entity.pairs, 2)?.trim() ?? ''));
    const nominal = fromGeometry ?? fromBlock;
    if (nominal === undefined) {
      unreadableNominalHandles.push(entity.handle ?? `DIMENSION_${index}`);
      return [];
    }
    return [{ kind, value: round(nominal) }];
  });

  const insertedText = manifest.entities
    .filter((entity) => entity.type === 'INSERT')
    .flatMap((entity) => reachableText(blocks, value(entity.pairs, 2)?.trim() ?? ''));
  const modelText = manifest.entities
    .filter((entity) => entity.type === 'TEXT' || entity.type === 'MTEXT')
    .map(entityText);
  const allText = [...insertedText, ...modelText];
  const hasTolerance = dimensions.some((entity) => /\\S|%%P/i.test(value(entity.pairs, 1) ?? ''));
  const hasRoughness = allText.some((text) => /^(?:0\.8|1\.6)$/.test(plainText(text)));
  const hasDatum = ['A', 'B'].every((datum) => allText.some((text) => plainText(text) === datum));
  const hasGeometricTolerance = allText.some((text) => /A-B/.test(plainText(text)))
    && allText.some((text) => /0\.00[135]/.test(plainText(text)));
  const hasSection = ['Ⅰ', 'Ⅱ'].every((mark) => allText.some((text) => plainText(text) === mark));
  const hasArbitraryNote = modelText.some((text) => /^\[B]\d+$/.test(plainText(text)));
  const detected = new Set<string>([
    ...(hasTolerance ? ['tolerance'] : []),
    ...(hasRoughness ? ['roughness'] : []),
    ...(hasDatum ? ['datum'] : []),
    ...(hasGeometricTolerance ? ['geometric-tolerance'] : []),
    ...(hasSection ? ['section-marker'] : []),
    ...(hasArbitraryNote ? ['arbitrary-note'] : []),
  ]);

  return {
    nominalDimensions,
    deferredCategories: SAMPLE_DEFERRED_CATEGORIES.filter((category) => detected.has(category)),
    unreadableNominalHandles,
  };
}

function reachableText(
  blocks: Map<string, DxfBlockRecord>,
  blockName: string,
  stack: string[] = [],
): string[] {
  if (!blockName || stack.includes(blockName)) return [];
  const block = blocks.get(blockName);
  if (!block) return [];
  return block.entities.flatMap((entity) => entity.type === 'INSERT'
    ? reachableText(blocks, value(entity.pairs, 2)?.trim() ?? '', [...stack, blockName])
    : entity.type === 'TEXT' || entity.type === 'MTEXT' ? [entityText(entity)] : []);
}

function firstNumericBlockText(block: DxfBlockRecord | undefined): number | undefined {
  if (!block) return undefined;
  for (const entity of block.entities) {
    if (entity.type !== 'TEXT' && entity.type !== 'MTEXT') continue;
    const match = /[-+]?\d+(?:\.\d+)?/.exec(plainText(entityText(entity)));
    if (!match) continue;
    const parsed = Number(match[0]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function entityText(entity: DxfEntityRecord): string {
  return entity.pairs
    .filter((pair) => pair.code === 1 || pair.code === 3)
    .map((pair) => pair.value)
    .join('');
}

function plainText(input: string): string {
  return input
    .replace(/%%C/gi, '⌀')
    .replace(/%%P/gi, '±')
    .replace(/%%D/gi, '°')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function value(pairs: DxfPair[], code: number): string | undefined {
  return pairs.find((pair) => pair.code === code)?.value;
}

function integerValue(pairs: DxfPair[], code: number, fallback: number): number {
  const raw = value(pairs, code);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round(input: number): number {
  return Math.round(input * 100) / 100;
}
import fs from 'node:fs';

import { projectDxfToDrawing } from '../drawing-dxf/projector.js';
import { parseAsciiDxf } from '../drawing-dxf/raw-parser.js';
import type { DxfBlockRecord, DxfEntityRecord, DxfPair } from '../drawing-dxf/types.js';
