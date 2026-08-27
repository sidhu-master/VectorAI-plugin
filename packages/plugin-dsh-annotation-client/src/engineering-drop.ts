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
  | { kind: 'documents'; documents: File[] }
  | { kind: 'import'; dxf: File; documents: File[] }
  | { kind: 'reject'; code: EngineeringImportErrorCode; filenames: string[] };

const supported = new Set<string>(SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS);
const legacy = new Set<string>(LEGACY_ENGINEERING_DOCUMENT_EXTENSIONS);

export function classifyEngineeringDrop(files: readonly File[]): EngineeringDropDecision {
  const dxfs = files.filter((file) => extensionOf(file.name) === 'dxf');
  if (dxfs.length === 0) {
    if (files.length === 0 || files.some((file) => !supported.has(extensionOf(file.name)) && !legacy.has(extensionOf(file.name)))) return { kind: 'pass' };
    const rejected = validateDocuments(files);
    return rejected ?? { kind: 'documents', documents: [...files] };
  }
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
  const rejected = validateDocuments(supportedDocuments);
  if (rejected) return rejected;
  return { kind: 'import', dxf: dxfs[0]!, documents: supportedDocuments };
}

function validateDocuments(documents: readonly File[]): Extract<EngineeringDropDecision, { kind: 'reject' }> | null {
  const legacyDocuments = documents.filter((file) => legacy.has(extensionOf(file.name)));
  if (legacyDocuments.length > 0) return { kind: 'reject', code: 'DOCUMENT_LEGACY_FORMAT_UNSUPPORTED', filenames: legacyDocuments.map(({ name }) => name) };
  if (documents.length > ENGINEERING_IMPORT_LIMITS.maxDocuments) return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_COUNT_LIMIT', filenames: documents.map(({ name }) => name) };
  const oversized = documents.filter((file) => file.size > ENGINEERING_IMPORT_LIMITS.maxDocumentBytes);
  if (oversized.length > 0) return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_SIZE_LIMIT', filenames: oversized.map(({ name }) => name) };
  if (documents.reduce((total, file) => total + file.size, 0) > ENGINEERING_IMPORT_LIMITS.maxDocumentTotalBytes) return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT', filenames: documents.map(({ name }) => name) };
  const byName = new Map<string, File[]>();
  for (const file of documents) {
    const key = file.name.toLocaleLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), file]);
  }
  const duplicates = [...byName.values()].filter((group) => group.length > 1).flat();
  if (duplicates.length > 0) return { kind: 'reject', code: 'ENGINEERING_DOCUMENT_DUPLICATE_NAME', filenames: duplicates.map(({ name }) => name) };
  return null;
}
