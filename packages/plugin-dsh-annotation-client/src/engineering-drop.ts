// SPDX-License-Identifier: Apache-2.0

import {
  ENGINEERING_IMPORT_LIMITS,
  LEGACY_ENGINEERING_DOCUMENT_EXTENSIONS,
  SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS,
  extensionOf,
} from './engineering-file-policy';

export type EngineeringImportErrorCode =
  | 'DXF_SIZE_LIMIT'
  | 'ENGINEERING_DROP_MULTIPLE_DXF'
  | 'ENGINEERING_DOCUMENT_COUNT_LIMIT'
  | 'ENGINEERING_DOCUMENT_SIZE_LIMIT'
  | 'ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT'
  | 'ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED'
  | 'ENGINEERING_DOCUMENT_DUPLICATE_NAME'
  | 'DOCUMENT_LEGACY_FORMAT_UNSUPPORTED';

export type EngineeringDropDecision =
  | { kind: 'pass' }
  | { kind: 'import'; dxf: File; documents: File[] }
  | { kind: 'reject'; code: EngineeringImportErrorCode; filenames: string[] };

const supported = new Set<string>(SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS);
const legacy = new Set<string>(LEGACY_ENGINEERING_DOCUMENT_EXTENSIONS);

export function classifyEngineeringDrop(files: readonly File[]): EngineeringDropDecision {
  const dxfs = files.filter((file) => extensionOf(file.name) === 'dxf');
  // A document by itself is ordinary DSH conversation context. The annotation
  // plugin may only claim it when the same explicit drop also contains a DXF.
  if (dxfs.length === 0) return { kind: 'pass' };
  if (dxfs.length > 1) {
    return { kind: 'reject', code: 'ENGINEERING_DROP_MULTIPLE_DXF', filenames: dxfs.map(({ name }) => name) };
  }
  const rest = files.filter((file) => extensionOf(file.name) !== 'dxf');
  const supportedDocuments = rest.filter((file) => supported.has(extensionOf(file.name)));
  const legacyDocuments = rest.filter((file) => legacy.has(extensionOf(file.name)));
  if (legacyDocuments.length > 0) {
    return { kind: 'reject', code: 'DOCUMENT_LEGACY_FORMAT_UNSUPPORTED', filenames: legacyDocuments.map(({ name }) => name) };
  }
  const unsupported = rest.filter((file) => !supported.has(extensionOf(file.name)));
  if (unsupported.length > 0) {
    return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED', filenames: unsupported.map(({ name }) => name) };
  }
  if (dxfs[0] && dxfs[0].size > ENGINEERING_IMPORT_LIMITS.maxDxfBytes) {
    return { kind: 'reject', code: 'DXF_SIZE_LIMIT', filenames: [dxfs[0].name] };
  }
  if (supportedDocuments.length > ENGINEERING_IMPORT_LIMITS.maxDocuments) {
    return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_COUNT_LIMIT', filenames: supportedDocuments.map(({ name }) => name) };
  }
  const oversized = supportedDocuments.filter((file) => file.size > ENGINEERING_IMPORT_LIMITS.maxDocumentBytes);
  if (oversized.length > 0) {
    return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_SIZE_LIMIT', filenames: oversized.map(({ name }) => name) };
  }
  if (supportedDocuments.reduce((total, file) => total + file.size, 0) > ENGINEERING_IMPORT_LIMITS.maxDocumentTotalBytes) {
    return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT', filenames: supportedDocuments.map(({ name }) => name) };
  }
  const byName = new Map<string, File[]>();
  for (const file of supportedDocuments) {
    const key = file.name.toLocaleLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), file]);
  }
  const duplicates = [...byName.values()].filter((group) => group.length > 1).flat();
  if (duplicates.length > 0) {
    return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_DUPLICATE_NAME', filenames: duplicates.map(({ name }) => name) };
  }
  return { kind: 'import', dxf: dxfs[0]!, documents: supportedDocuments };
}
