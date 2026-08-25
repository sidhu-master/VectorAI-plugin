// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';

import { decodeDxfPairs } from './group-pairs';
import { indexDxfSections } from './sections';

describe('ASCII DXF group-pair decoding', () => {
  it('preserves UTF-8 values and one-based source line numbers across CRLF input', () => {
    const decoded = decodeDxfPairs(new TextEncoder().encode(
      '\uFEFF0\r\nSECTION\r\n2\r\nHEADER\r\n9\r\n$INSUNITS\r\n70\r\n4\r\n0\r\nENDSEC\r\n0\r\nEOF\r\n',
    ));

    expect(decoded.diagnostics).toEqual([]);
    expect(decoded.pairs[2]).toEqual({ code: 9, value: '$INSUNITS', line: 5 });
    expect(indexDxfSections(decoded.pairs).header?.pairs[0]).toEqual({
      code: 9,
      value: '$INSUNITS',
      line: 5,
    });
  });

  it('rejects malformed pair structure instead of shifting all later values', () => {
    const decoded = decodeDxfPairs(new TextEncoder().encode('0\nSECTION\nnot-a-code\nHEADER\n0\nEOF\n'));

    expect(decoded.pairs).toEqual([]);
    expect(decoded.diagnostics).toContainEqual(expect.objectContaining({
      severity: 'error',
      code: 'DXF_GROUP_CODE_INVALID',
      line: 3,
    }));
  });
});
