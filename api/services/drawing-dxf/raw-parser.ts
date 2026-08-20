import type {
  DxfBlockRecord,
  DxfEntityRecord,
  DxfManifest,
  DxfPair,
  DxfXDataSegment,
} from './types.js';

const STRUCTURAL_RECORDS = new Set(['SECTION', 'ENDSEC', 'EOF']);

export function parseAsciiDxf(source: string): DxfManifest {
  const pairs = readPairs(source);
  const sectionRanges = findSections(pairs);
  const sections = sectionRanges.map((section) => section.name);
  const headerPairs = sectionRanges.find((section) => section.name === 'HEADER')?.pairs ?? [];
  const entityPairs = sectionRanges.find((section) => section.name === 'ENTITIES')?.pairs ?? [];
  const blockPairs = sectionRanges.find((section) => section.name === 'BLOCKS')?.pairs ?? [];
  const known = new Set(['HEADER', 'ENTITIES', 'BLOCKS']);

  return {
    format: 'ascii-dxf',
    sections,
    header: parseHeader(headerPairs),
    entities: parseEntityRecords(entityPairs),
    blocks: parseBlocks(blockPairs),
    unknownSections: Object.fromEntries(sectionRanges
      .filter((section) => !known.has(section.name))
      .map((section) => [section.name, section.pairs])),
    pairCount: pairs.length,
  };
}

function readPairs(source: string): DxfPair[] {
  const lines = source.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length % 2 !== 0) throw new Error('DXF_PAIR_TRUNCATED');
  const pairs: DxfPair[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const rawCode = lines[index] ?? '';
    const code = Number.parseInt(rawCode.trim(), 10);
    if (!Number.isInteger(code)) throw new Error(`DXF_GROUP_CODE_INVALID: ${rawCode}`);
    pairs.push({ code, value: lines[index + 1] ?? '' });
  }
  return pairs;
}

function findSections(pairs: DxfPair[]): Array<{ name: string; pairs: DxfPair[] }> {
  const sections: Array<{ name: string; pairs: DxfPair[] }> = [];
  let index = 0;
  while (index < pairs.length) {
    const pair = pairs[index];
    if (pair?.code !== 0 || pair.value.trim().toUpperCase() !== 'SECTION') {
      index += 1;
      continue;
    }
    const namePair = pairs[index + 1];
    if (namePair?.code !== 2) throw new Error('DXF_SECTION_NAME_MISSING');
    const name = namePair.value.trim().toUpperCase();
    const start = index + 2;
    let end = start;
    while (end < pairs.length) {
      const candidate = pairs[end];
      if (candidate?.code === 0 && candidate.value.trim().toUpperCase() === 'ENDSEC') break;
      end += 1;
    }
    if (end >= pairs.length) throw new Error(`DXF_SECTION_UNTERMINATED: ${name}`);
    sections.push({ name, pairs: pairs.slice(start, end) });
    index = end + 1;
  }
  return sections;
}

function parseHeader(pairs: DxfPair[]): Record<string, DxfPair[]> {
  const result: Record<string, DxfPair[]> = {};
  let key: string | undefined;
  for (const pair of pairs) {
    if (pair.code === 9) {
      key = pair.value.trim();
      result[key] = [];
      continue;
    }
    if (key) result[key]?.push(pair);
  }
  return result;
}

function splitRecords(pairs: DxfPair[]): DxfPair[][] {
  const records: DxfPair[][] = [];
  let current: DxfPair[] | undefined;
  for (const pair of pairs) {
    if (pair.code === 0) {
      if (current) records.push(current);
      current = [pair];
    } else if (current) {
      current.push(pair);
    }
  }
  if (current) records.push(current);
  return records;
}

function parseEntityRecords(pairs: DxfPair[]): DxfEntityRecord[] {
  return splitRecords(pairs)
    .filter((record) => !STRUCTURAL_RECORDS.has(recordType(record)))
    .map(toEntityRecord);
}

function parseBlocks(pairs: DxfPair[]): DxfBlockRecord[] {
  const blocks: DxfBlockRecord[] = [];
  let current: DxfBlockRecord | undefined;
  for (const record of splitRecords(pairs)) {
    const type = recordType(record);
    if (type === 'BLOCK') {
      if (current) throw new Error(`DXF_BLOCK_UNTERMINATED: ${current.name}`);
      current = {
        name: firstValue(record, 2)?.trim() || firstValue(record, 3)?.trim() || '',
        ...(firstValue(record, 5) ? { handle: firstValue(record, 5)?.trim() } : {}),
        ...(firstValue(record, 330) ? { ownerHandle: firstValue(record, 330)?.trim() } : {}),
        headerPairs: record,
        endPairs: [],
        entities: [],
      };
      continue;
    }
    if (type === 'ENDBLK') {
      if (!current) continue;
      current.endPairs = record;
      blocks.push(current);
      current = undefined;
      continue;
    }
    if (current && !STRUCTURAL_RECORDS.has(type)) current.entities.push(toEntityRecord(record));
  }
  if (current) throw new Error(`DXF_BLOCK_UNTERMINATED: ${current.name}`);
  return blocks;
}

function toEntityRecord(pairs: DxfPair[]): DxfEntityRecord {
  const handle = firstValue(pairs, 5)?.trim();
  const ownerHandle = firstValue(pairs, 330)?.trim();
  return {
    type: recordType(pairs),
    pairs,
    ...(handle ? { handle } : {}),
    ...(ownerHandle ? { ownerHandle } : {}),
    xdata: extractXData(pairs),
  };
}

function extractXData(pairs: DxfPair[]): DxfXDataSegment[] {
  const segments: DxfXDataSegment[] = [];
  let current: DxfXDataSegment | undefined;
  for (const pair of pairs) {
    if (pair.code === 1001) {
      current = { application: pair.value.trim(), pairs: [] };
      segments.push(current);
      continue;
    }
    if (current && pair.code >= 1000 && pair.code <= 1071) {
      current.pairs.push(pair);
      continue;
    }
    if (current && pair.code < 1000) current = undefined;
  }
  return segments;
}

function recordType(record: DxfPair[]): string {
  return (record[0]?.value ?? '').trim().toUpperCase();
}

function firstValue(pairs: DxfPair[], code: number): string | undefined {
  return pairs.find((pair) => pair.code === code)?.value;
}
