// SPDX-License-Identifier: Apache-2.0

import type { DxfImportDiagnostic, DxfPair } from './types';

export interface DxfPairDecodeResult {
  pairs: DxfPair[];
  diagnostics: DxfImportDiagnostic[];
}

export function decodeDxfPairs(bytes: Uint8Array): DxfPairDecodeResult {
  const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  if (text.includes('\0')) {
    return rejected('DXF_NUL_BYTE', 'DXF input contains a NUL byte');
  }
  const lines = text.split(/\r?\n/);
  if (lines.at(-1) === '') lines.pop();
  if (lines.length % 2 !== 0) {
    return rejected('DXF_GROUP_PAIR_INCOMPLETE', 'DXF input ends without a value line', lines.length);
  }
  const pairs: DxfPair[] = [];
  for (let index = 0; index < lines.length; index += 2) {
    const codeText = lines[index].trim();
    if (!/^[+-]?\d+$/.test(codeText)) {
      return rejected('DXF_GROUP_CODE_INVALID', `Invalid DXF group code: ${codeText}`, index + 1);
    }
    const code = Number(codeText);
    if (!Number.isSafeInteger(code)) {
      return rejected('DXF_GROUP_CODE_INVALID', `Invalid DXF group code: ${codeText}`, index + 1);
    }
    pairs.push({ code, value: lines[index + 1].trim(), line: index + 1 });
  }
  const eof = pairs.at(-1);
  if (eof?.code !== 0 || eof.value !== 'EOF') {
    return rejected('DXF_EOF_REQUIRED', 'DXF input does not end with EOF', lines.length || 1);
  }
  return { pairs, diagnostics: [] };
}

function rejected(code: string, message: string, line?: number): DxfPairDecodeResult {
  return {
    pairs: [],
    diagnostics: [{ severity: 'error', code, message, ...(line === undefined ? {} : { line }) }],
  };
}
