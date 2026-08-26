// SPDX-License-Identifier: Apache-2.0

export const ENGINEERING_IMPORT_LIMITS = Object.freeze({
  maxDxfBytes: 20 * 1024 * 1024,
  maxDocumentBytes: 20 * 1024 * 1024,
  maxDocumentTotalBytes: 50 * 1024 * 1024,
  maxDocuments: 16,
});

export const SUPPORTED_ENGINEERING_DOCUMENT_EXTENSIONS = Object.freeze([
  'txt', 'md', 'csv', 'tsv', 'json', 'yaml', 'yml', 'ini', 'xml', 'html', 'htm', 'log',
  'pdf', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'epub',
]);

export const LEGACY_ENGINEERING_DOCUMENT_EXTENSIONS = Object.freeze(['doc', 'xls', 'ppt']);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
}

export function validateEngineeringDocumentFiles(files: readonly Pick<File, 'size'>[]): void {
  if (files.length > ENGINEERING_IMPORT_LIMITS.maxDocuments) {
    throw new Error('ENGINEERING_DOCUMENT_COUNT_LIMIT');
  }
  if (files.some((file) => file.size > ENGINEERING_IMPORT_LIMITS.maxDocumentBytes)) {
    throw new Error('ENGINEERING_DOCUMENT_SIZE_LIMIT');
  }
  if (files.reduce((total, file) => total + file.size, 0) > ENGINEERING_IMPORT_LIMITS.maxDocumentTotalBytes) {
    throw new Error('ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT');
  }
}
