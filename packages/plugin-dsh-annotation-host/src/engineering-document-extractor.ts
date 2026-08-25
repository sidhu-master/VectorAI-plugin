// SPDX-License-Identifier: Apache-2.0

import type { EngineeringDocumentInput } from '@vectorai/plugin-space-contracts';
import { createHash } from 'node:crypto';

const PLAIN_FORMATS = new Set([
  'txt', 'md', 'csv', 'tsv', 'json', 'yaml', 'yml', 'ini', 'xml', 'html', 'htm', 'log',
]);
const STRUCTURED_FORMATS = new Set([
  'pdf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub',
]);
const LEGACY_FORMATS = new Set(['doc', 'xls', 'ppt']);

export const ENGINEERING_DOCUMENT_LIMITS = Object.freeze({
  maxDocuments: 16,
  maxDocumentBytes: 20 * 1024 * 1024,
  maxTotalDocumentBytes: 50 * 1024 * 1024,
  maxDocumentTextBytes: 4 * 1024 * 1024,
  maxTotalTextBytes: 8 * 1024 * 1024,
});

export interface ExtractedEngineeringDocument {
  name: string;
  format: string;
  text: string;
  warnings: string[];
}

export interface StructuredDocumentParserInput {
  name: string;
  format: string;
  bytes: Uint8Array;
  signal?: AbortSignal;
}

export type StructuredDocumentParser = (
  input: StructuredDocumentParserInput,
) => Promise<{ text: string; warnings: string[] }>;

export async function extractEngineeringDocuments(
  inputs: readonly EngineeringDocumentInput[],
  options: { signal?: AbortSignal; parseStructured?: StructuredDocumentParser; parseTimeoutMs?: number } = {},
): Promise<{ documents: ExtractedEngineeringDocument[]; combinedText?: string }> {
  if (inputs.length > ENGINEERING_DOCUMENT_LIMITS.maxDocuments) {
    throw new Error('ENGINEERING_DOCUMENT_COUNT_LIMIT');
  }

  const admitted = inputs.map((input) => {
    const format = formatOf(input.name);
    if (LEGACY_FORMATS.has(format)) throw new Error(`DOCUMENT_LEGACY_FORMAT_UNSUPPORTED:${input.name}`);
    if (!PLAIN_FORMATS.has(format) && !STRUCTURED_FORMATS.has(format)) {
      throw new Error(`ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED:${input.name}`);
    }
    const bytes = decodeCanonicalBase64(input.base64, input.name);
    if (bytes.byteLength > ENGINEERING_DOCUMENT_LIMITS.maxDocumentBytes) {
      throw new Error(`ENGINEERING_DOCUMENT_SIZE_LIMIT:${input.name}`);
    }
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (digest !== input.digest) throw new Error(`DOCUMENT_DIGEST_MISMATCH:${input.name}`);
    return { input, format, bytes };
  });
  if (admitted.reduce((total, item) => total + item.bytes.byteLength, 0) > ENGINEERING_DOCUMENT_LIMITS.maxTotalDocumentBytes) {
    throw new Error('ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT');
  }

  const documents: ExtractedEngineeringDocument[] = [];
  let totalTextBytes = 0;
  for (const { input, format, bytes } of admitted) {
    options.signal?.throwIfAborted();
    let extracted: { text: string; warnings: string[] };
    try {
      extracted = PLAIN_FORMATS.has(format)
        ? { text: decodePlainText(bytes), warnings: [] }
        : await parseWithDeadline(
          options.parseStructured ?? parseStructuredDocument,
          { name: input.name, format, bytes },
          options.signal,
          options.parseTimeoutMs ?? 30_000,
        );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error;
      if (error instanceof Error && error.message.startsWith('DOCUMENT_PARSE_TIMEOUT:')) throw error;
      const failure = new Error(`DOCUMENT_PARSE_FAILED:${input.name}`) as Error & { cause?: unknown };
      failure.cause = error;
      throw failure;
    }
    const normalized = normalizeText(extracted.text);
    if (normalized === '') throw new Error(`DOCUMENT_TEXT_EMPTY:${input.name}`);
    const textBytes = Buffer.byteLength(normalized, 'utf8');
    if (textBytes > ENGINEERING_DOCUMENT_LIMITS.maxDocumentTextBytes) {
      throw new Error(`DOCUMENT_TEXT_SIZE_LIMIT:${input.name}`);
    }
    totalTextBytes += textBytes;
    if (totalTextBytes > ENGINEERING_DOCUMENT_LIMITS.maxTotalTextBytes) {
      throw new Error('DOCUMENT_TOTAL_TEXT_SIZE_LIMIT');
    }
    documents.push({
      name: input.name,
      format,
      text: normalized,
      warnings: [...extracted.warnings],
    });
  }

  if (documents.length === 0) return { documents };
  return {
    documents,
    combinedText: documents.map((document) => [
      `===== ENGINEERING DOCUMENT: ${document.name} =====`,
      document.text,
      `===== END ENGINEERING DOCUMENT: ${document.name} =====`,
    ].join('\n')).join('\n'),
  };
}

async function parseWithDeadline(
  parser: StructuredDocumentParser,
  input: Omit<StructuredDocumentParserInput, 'signal'>,
  parentSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<{ text: string; warnings: string[] }> {
  parentSignal?.throwIfAborted();
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let rejectControl: ((reason: unknown) => void) | undefined;
  const control = new Promise<never>((_resolve, reject) => { rejectControl = reject; });
  const onAbort = () => {
    controller.abort(parentSignal?.reason);
    rejectControl?.(parentSignal?.reason ?? new DOMException('Aborted', 'AbortError'));
  };
  parentSignal?.addEventListener('abort', onAbort, { once: true });
  timeout = setTimeout(() => {
    const failure = new Error(`DOCUMENT_PARSE_TIMEOUT:${input.name}`);
    controller.abort(failure);
    rejectControl?.(failure);
  }, Math.max(1, timeoutMs));
  try {
    return await Promise.race([parser({ ...input, signal: controller.signal }), control]);
  } finally {
    clearTimeout(timeout);
    parentSignal?.removeEventListener('abort', onAbort);
  }
}

const parseStructuredDocument: StructuredDocumentParser = async ({ format, bytes, signal }) => {
  const { OfficeParser } = await import('officeparser');
  const ast = await OfficeParser.parseOffice(bytes, {
    fileType: format as never,
    ocr: false,
    extractAttachments: false,
    includeRawContent: false,
    abortSignal: signal ?? null,
  });
  return {
    text: ast.toText(),
    warnings: (ast.warnings ?? []).map((warning) => {
      if (typeof warning === 'string') return warning;
      if (warning && typeof warning === 'object' && 'message' in warning) return String(warning.message);
      return JSON.stringify(warning);
    }),
  };
};

function formatOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

function decodeCanonicalBase64(value: string, name: string): Uint8Array {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error(`DOCUMENT_PARSE_FAILED:${name}`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error(`DOCUMENT_PARSE_FAILED:${name}`);
  return new Uint8Array(bytes);
}

function decodePlainText(bytes: Uint8Array): string {
  let encoding = 'utf-8';
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = 'utf-16le'; offset = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = 'utf-16be'; offset = 2; }
  const value = new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset));
  if (value.includes('\0') || value.includes('\ufffd')) throw new Error('DOCUMENT_BINARY_TEXT');
  return value;
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/gu, '\n').replace(/[ \t]+$/gmu, '').trim();
}
