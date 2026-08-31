// SPDX-License-Identifier: Apache-2.0

export interface CadContractSnapshot {
  version: string;
  layers: Record<string, { color: number; lineType: string; lineWeight: number }>;
  dimensionStyles: Record<string, {
    textHeight: number;
    arrowSize: number;
    extension: number;
    originOffset: number;
    gap: number;
    textColor: number;
    textStyle: string;
    suppressOutsideDimensionLines: number;
    forceDimensionLine: number;
    toleranceDecimalPlaces: number;
    angularZeroSuppression: number;
  }>;
  dimensionKinds: Record<'linear' | 'angular' | 'radial' | 'diametric' | 'other', number>;
  dimensionPictures: { hasMText: boolean; hasHatchArrowheads: boolean };
  sectionHatchAngles: number[];
  symbolPictureColors: { mtext: number[]; hatch: number[]; polyline: number[] };
}

interface Pair { code: number; value: string }

export function inspectCadContract(source: string): CadContractSnapshot {
  const pairs = parsePairs(source);
  const layers: CadContractSnapshot['layers'] = {};
  const dimensionStyles: CadContractSnapshot['dimensionStyles'] = {};
  const textStylesByHandle = new Map<string, string>();
  const dimensionKinds: CadContractSnapshot['dimensionKinds'] = {
    linear: 0, angular: 0, radial: 0, diametric: 0, other: 0,
  };
  const dimensionBlockNames = new Set<string>();
  let version = '';
  let section = '';
  let currentBlock = '';
  let hasMText = false;
  let hasHatchArrowheads = false;
  const sectionHatchAngles: number[] = [];
  const symbolColors = { mtext: new Set<number>(), hatch: new Set<number>(), polyline: new Set<number>() };

  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]!;
    if (pair.code === 9 && pair.value === '$ACADVER') version = pairs[index + 1]?.value ?? '';
    if (pair.code === 0 && pair.value === 'SECTION' && pairs[index + 1]?.code === 2) section = pairs[index + 1]!.value;
    if (pair.code === 0 && pair.value === 'ENDSEC') section = '';
    if (section === 'TABLES' && pair.code === 0 && pair.value === 'LAYER') {
      const record = recordUntilNextZero(pairs, index);
      const name = value(record, 2);
      if (name) layers[name] = {
        color: number(record, 62, 7),
        lineType: value(record, 6) || 'CONTINUOUS',
        lineWeight: number(record, 370, -3),
      };
    }
    if (section === 'TABLES' && pair.code === 0 && pair.value === 'STYLE') {
      const record = recordUntilNextZero(pairs, index);
      const handle = value(record, 5);
      const name = value(record, 2);
      if (handle && name) textStylesByHandle.set(handle, name);
    }
    if (section === 'TABLES' && pair.code === 0 && pair.value === 'DIMSTYLE') {
      const record = recordUntilNextZero(pairs, index);
      const name = value(record, 2);
      if (name) dimensionStyles[name] = {
        textHeight: number(record, 140, 0),
        arrowSize: number(record, 41, 0),
        extension: number(record, 44, 0),
        originOffset: number(record, 42, 0),
        gap: number(record, 147, 0),
        textColor: number(record, 178, 0),
        textStyle: textStylesByHandle.get(value(record, 340)) ?? '',
        suppressOutsideDimensionLines: number(record, 175, 1),
        forceDimensionLine: number(record, 172, 0),
        toleranceDecimalPlaces: number(record, 272, 0),
        angularZeroSuppression: number(record, 79, 0),
      };
    }
    if (section === 'ENTITIES' && pair.code === 0 && pair.value === 'DIMENSION') {
      const record = recordUntilNextZero(pairs, index);
      const type = number(record, 70, 0) & 7;
      if (type === 0 || type === 1) dimensionKinds.linear += 1;
      else if (type === 2 || type === 5) dimensionKinds.angular += 1;
      else if (type === 4) dimensionKinds.radial += 1;
      else if (type === 3) dimensionKinds.diametric += 1;
      else dimensionKinds.other += 1;
      const blockName = value(record, 2);
      if (blockName) dimensionBlockNames.add(blockName);
    }
    if (section === 'ENTITIES' && pair.code === 0 && pair.value === 'HATCH') {
      const record = recordUntilNextZero(pairs, index);
      if (value(record, 8) === '5剖面线层') {
        sectionHatchAngles.push(...record.filter(({ code }) => code === 53).map(({ value: raw }) => Number(raw)));
      }
    }
    if (section === 'BLOCKS' && pair.code === 0 && pair.value === 'BLOCK') {
      currentBlock = value(recordUntilNextZero(pairs, index), 2);
    } else if (section === 'BLOCKS' && pair.code === 0 && pair.value === 'ENDBLK') {
      currentBlock = '';
    } else if (section === 'BLOCKS' && dimensionBlockNames.has(currentBlock) && pair.code === 0) {
      if (pair.value === 'MTEXT') hasMText = true;
      if (pair.value === 'HATCH') hasHatchArrowheads = true;
    }
    if (section === 'BLOCKS' && pair.code === 0 && ['MTEXT', 'HATCH', 'LWPOLYLINE'].includes(pair.value)) {
      const record = recordUntilNextZero(pairs, index);
      if (value(record, 8) === '8符号标注层') {
        const color = number(record, 62, 256);
        if (pair.value === 'MTEXT') symbolColors.mtext.add(color);
        else if (pair.value === 'HATCH') symbolColors.hatch.add(color);
        else symbolColors.polyline.add(color);
      }
    }
  }

  currentBlock = '';
  section = '';
  for (let index = 0; index < pairs.length; index += 1) {
    const pair = pairs[index]!;
    if (pair.code === 0 && pair.value === 'SECTION' && pairs[index + 1]?.code === 2) section = pairs[index + 1]!.value;
    if (pair.code === 0 && pair.value === 'ENDSEC') section = '';
    if (section === 'BLOCKS' && pair.code === 0 && pair.value === 'BLOCK') {
      currentBlock = value(recordUntilNextZero(pairs, index), 2);
    } else if (section === 'BLOCKS' && pair.code === 0 && pair.value === 'ENDBLK') {
      currentBlock = '';
    } else if (section === 'BLOCKS' && dimensionBlockNames.has(currentBlock) && pair.code === 0) {
      if (pair.value === 'MTEXT') hasMText = true;
      if (pair.value === 'HATCH') hasHatchArrowheads = true;
    }
  }

  return {
    version, layers, dimensionStyles, dimensionKinds,
    dimensionPictures: { hasMText, hasHatchArrowheads },
    sectionHatchAngles,
    symbolPictureColors: {
      mtext: [...symbolColors.mtext].sort((a, b) => a - b),
      hatch: [...symbolColors.hatch].sort((a, b) => a - b),
      polyline: [...symbolColors.polyline].sort((a, b) => a - b),
    },
  };
}

function parsePairs(source: string): Pair[] {
  const lines = source.replace(/\r/g, '').split('\n');
  const pairs: Pair[] = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    pairs.push({ code: Number(lines[index]?.trim()), value: lines[index + 1]?.trim() ?? '' });
  }
  return pairs;
}

function recordUntilNextZero(pairs: readonly Pair[], start: number): Pair[] {
  const record: Pair[] = [];
  for (let index = start + 1; index < pairs.length && pairs[index]?.code !== 0; index += 1) record.push(pairs[index]!);
  return record;
}

function value(record: readonly Pair[], code: number): string {
  return record.find((pair) => pair.code === code)?.value ?? '';
}

function number(record: readonly Pair[], code: number, fallback: number): number {
  const raw = value(record, code);
  if (raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}
