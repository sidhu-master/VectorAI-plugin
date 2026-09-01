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
    return restoreDimensionToleranceStacks(
      source,
      restoreHatchPatternAngles(source, output.replace(/\r?\n/g, '\r\n')),
    );
  } finally {
    reader.dispose();
  }
}

/** acad-ts inserts a presentation-only space after the MText stack separator.
 * Same-sign tolerance fallbacks require the exact explicit sign sequence, so
 * restore the authoritative stack tokens emitted by drawing-core. */
function restoreDimensionToleranceStacks(source: string, output: string): string {
  const expected = source.match(/\\S[^;^\r\n]+\^[^;\r\n]+;/g) ?? [];
  if (expected.length === 0) return output;
  let cursor = 0;
  return output.replace(/\\S[^;^\r\n]+\^[^;\r\n]+;/g, (actual) => expected[cursor++] ?? actual);
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
