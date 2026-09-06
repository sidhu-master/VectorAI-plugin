// SPDX-License-Identifier: Apache-2.0

import { CadReader, DxfWriter } from '@node-projects/acad-ts';

/**
 * Rebuild a generated DXF as a complete CAD document.
 *
 * The lightweight canonical writer deliberately focuses on entities. CAD
 * applications additionally require a consistent handle/owner graph, block
 * ownership, dictionaries, and $HANDSEED. acad-ts reconstructs that document
 * structure before the file leaves the annotation host.
 */
export function normalizeCadDxf(source: string): string {
  const reader = CadReader.createReader('vectorai-annotated.dxf', new TextEncoder().encode(source));
  try {
    const document = reader.read();
    // Keep the emitted bytes and declared code page aligned.  The plugin
    // download transport serializes DXF strings as UTF-8.
    document.header.codePage = 'UTF-8';
    document.restoreHandles();
    document.updateCollections(true, true);

    let output = '';
    const writer = new DxfWriter({ write: (value: string) => { output += value; } }, document, false);
    try {
      writer.write();
    } finally {
      writer.dispose();
    }
    return omitZeroDimensionRounding(restoreDimensionGeometry(
      source,
      restoreHatchPatternAngles(source, output.replace(/\r?\n/g, '\r\n')),
    ));
  } finally {
    reader.dispose();
  }
}

/** acad-ts materializes DIMRND=0. Omission has the same DXF no-rounding default
 * and avoids ezdxf's xround(value, 0) integer-rounding interpretation. */
function omitZeroDimensionRounding(source: string): string {
  const lines = source.split(/\r?\n/);
  const result: string[] = [];
  let entity = '';
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number(lines[index].trim());
    if (code === 0) entity = lines[index + 1].trim();
    if (entity === 'DIMSTYLE' && code === 45 && Number(lines[index + 1]) === 0) continue;
    result.push(lines[index], lines[index + 1]);
  }
  return `${result.join('\r\n')}\r\n`;
}

/** acad-ts duplicates AcDbAlignedDimension and writes group 50 into the empty
 * AcDbRotatedDimension subclass. Restore only the authoritative geometry
 * subclasses, retaining repaired handles, common fields and tolerance XDATA.
 * Its angular group 42 also needs its original degree value, not radians. */
function restoreDimensionGeometry(source: string, output: string): string {
  const sourceLines = source.split(/\r?\n/);
  const expected = new Map(dimensionRecords(sourceLines).map((record) => [record.block, record]));
  if (expected.size === 0) return output;
  const lines = output.split(/\r?\n/);
  for (const record of dimensionRecords(lines).reverse()) {
    const original = expected.get(record.block);
    if (original === undefined || original.type !== record.type) continue;
    if (record.type === 0 && original.start !== -1 && record.start !== -1) {
      lines.splice(record.start, record.end - record.start, ...sourceLines.slice(original.start, original.end));
    } else if (record.type === 2 && original.measurement !== -1 && record.measurement !== -1) {
      lines[record.measurement + 1] = sourceLines[original.measurement + 1]!;
    }
  }
  return lines.join('\r\n');
}

function dimensionRecords(lines: readonly string[]): { block: string; type: number; start: number; end: number; measurement: number }[] {
  const result: ReturnType<typeof dimensionRecords> = [];
  for (let index = 0; index + 1 < lines.length; index += 2) {
    if (lines[index]!.trim() !== '0' || lines[index + 1]!.trim() !== 'DIMENSION') continue;
    let block = '';
    let dimensionType = NaN;
    let start = -1;
    let measurement = -1;
    let end = index + 2;
    for (; end + 1 < lines.length; end += 2) {
      const code = Number.parseInt(lines[end]!.trim(), 10);
      const value = lines[end + 1]!.trim();
      if (code === 0 || code >= 1000) break;
      if (code === 2) block = value;
      if (code === 70) dimensionType = Number(value);
      if (code === 42) measurement = end;
      if (start === -1 && code === 100 && value === 'AcDbAlignedDimension') start = end;
    }
    if (block && Number.isInteger(dimensionType)) {
      result.push({ block, type: dimensionType & 7, start, end, measurement });
    }
  }
  return result;
}

/** acad-ts serializes HATCH pattern-line angles as radians although DXF group
 * 53 is defined in degrees. Preserve the authoritative angles from the input
 * entity stream after it has repaired handles and ownership. */
function restoreHatchPatternAngles(source: string, output: string): string {
  const expected = hatchPatternAngles(source);
  if (expected.length === 0) return output;
  const lines = output.split(/\r?\n/);
  let entity = '';
  let cursor = 0;
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index]!.trim(), 10);
    if (code === 0) entity = lines[index + 1]!.trim();
    if (entity === 'HATCH' && code === 53 && cursor < expected.length) {
      lines[index + 1] = String(expected[cursor++]);
    }
  }
  return lines.join('\r\n');
}

function hatchPatternAngles(dxf: string): number[] {
  const lines = dxf.split(/\r?\n/);
  const values: number[] = [];
  let entity = '';
  for (let index = 0; index + 1 < lines.length; index += 2) {
    const code = Number.parseInt(lines[index]!.trim(), 10);
    const value = lines[index + 1]!.trim();
    if (code === 0) entity = value;
    if (entity === 'HATCH' && code === 53) {
      const angle = Number(value);
      if (Number.isFinite(angle)) values.push(angle);
    }
  }
  return values;
}
