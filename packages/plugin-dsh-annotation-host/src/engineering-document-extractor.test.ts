// SPDX-License-Identifier: Apache-2.0

import type { EngineeringDocumentInput } from '@vectorai/plugin-space-contracts';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  extractEngineeringDocuments,
  type StructuredDocumentParser,
} from './engineering-document-extractor';

function encoded(name: string, bytes: Uint8Array, mediaType?: string): EngineeringDocumentInput {
  return {
    name,
    digest: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
    ...(mediaType === undefined ? {} : { mediaType }),
    base64: Buffer.from(bytes).toString('base64'),
  };
}

function text(name: string, value: string, mediaType?: string): EngineeringDocumentInput {
  return encoded(name, new TextEncoder().encode(value), mediaType);
}

describe('engineering document extractor', () => {
  it('decodes plain formats and preserves deterministic file boundaries in drop order', async () => {
    const result = await extractEngineeringDocuments([
      text('a.txt', '第一轴段  \r\n直径 20\r\n'),
      text('b.csv', 'name,value\n直径,20\n', 'text/csv'),
    ]);

    expect(result.combinedText).toBe([
      '===== ENGINEERING DOCUMENT: a.txt =====',
      '第一轴段\n直径 20',
      '===== END ENGINEERING DOCUMENT: a.txt =====',
      '===== ENGINEERING DOCUMENT: b.csv =====',
      'name,value\n直径,20',
      '===== END ENGINEERING DOCUMENT: b.csv =====',
    ].join('\n'));
    expect(result.documents.map(({ name, format }) => ({ name, format }))).toEqual([
      { name: 'a.txt', format: 'txt' },
      { name: 'b.csv', format: 'csv' },
    ]);
  });

  it('honors UTF-16 byte-order marks', async () => {
    const value = '轴段 A';
    const utf16 = new Uint8Array(2 + value.length * 2);
    utf16.set([0xff, 0xfe]);
    const view = new DataView(utf16.buffer);
    for (let index = 0; index < value.length; index += 1) view.setUint16(2 + index * 2, value.charCodeAt(index), true);

    const result = await extractEngineeringDocuments([encoded('utf16.txt', utf16)]);

    expect(result.documents[0]?.text).toBe(value);
  });

  it('routes every structured extension through the local structured parser', async () => {
    const parseStructured = vi.fn<StructuredDocumentParser>(async ({ format }) => ({
      text: `parsed ${format}`,
      warnings: [],
    }));
    const formats = ['pdf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub'];

    const result = await extractEngineeringDocuments(
      formats.map((format) => text(`sample.${format}`, `binary-${format}`)),
      { parseStructured },
    );

    expect(parseStructured.mock.calls.map(([input]) => input.format)).toEqual(formats);
    expect(result.documents.map(({ text: value }) => value)).toEqual(formats.map((format) => `parsed ${format}`));
  });

  it('extracts a real RTF document through the production local parser', async () => {
    const rtf = String.raw`{\rtf1\ansi Engineering shaft \b diameter 20\b0}`;

    const result = await extractEngineeringDocuments([text('shaft.rtf', rtf)]);

    expect(result.documents[0]?.text).toContain('Engineering shaft');
    expect(result.documents[0]?.text).toContain('diameter 20');
  });

  it('rejects tampered, legacy, empty, and binary-looking text inputs with stable codes', async () => {
    const tampered = text('notes.txt', 'valid');
    tampered.digest = `sha256:${'0'.repeat(64)}`;
    await expect(extractEngineeringDocuments([tampered])).rejects.toThrow('DOCUMENT_DIGEST_MISMATCH:notes.txt');
    await expect(extractEngineeringDocuments([text('legacy.doc', 'old')])).rejects.toThrow('DOCUMENT_LEGACY_FORMAT_UNSUPPORTED:legacy.doc');
    await expect(extractEngineeringDocuments([text('empty.txt', ' \n\t')])).rejects.toThrow('DOCUMENT_TEXT_EMPTY:empty.txt');
    await expect(extractEngineeringDocuments([encoded('binary.txt', new Uint8Array([0, 1, 2, 3]))]))
      .rejects.toThrow('DOCUMENT_PARSE_FAILED:binary.txt');
  });

  it('enforces per-file and combined extracted UTF-8 byte limits', async () => {
    const parseStructured = vi.fn<StructuredDocumentParser>(async ({ name }) => ({
      text: name === 'large.pdf' ? 'x'.repeat(4 * 1024 * 1024 + 1) : 'x'.repeat(3 * 1024 * 1024),
      warnings: [],
    }));
    await expect(extractEngineeringDocuments([text('large.pdf', 'pdf')], { parseStructured }))
      .rejects.toThrow('DOCUMENT_TEXT_SIZE_LIMIT:large.pdf');
    await expect(extractEngineeringDocuments([
      text('a.pdf', 'a'), text('b.pdf', 'b'), text('c.pdf', 'c'),
    ], { parseStructured })).rejects.toThrow('DOCUMENT_TOTAL_TEXT_SIZE_LIMIT');
  });
});
