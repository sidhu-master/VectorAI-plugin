# Multi-format Engineering Import Design

## Goal

Allow a user to drag one DXF drawing and zero or more engineering reference documents into the active DSH conversation, then run the existing second-layer smart-partition workflow entirely on the local computer. The same file set must also be selectable from the annotation workspace import panel.

This is an explicit engineering import route. It must not broaden ordinary DSH image attachments, auto-vectorize ordinary images, or open a drawing workspace for unrelated files.

## User-visible behavior

- A drop containing exactly one `.dxf` and any number of supported engineering documents starts `importAndAnalyze` for the active session.
- A drop containing supported documents but no DXF stores them as pending engineering context for that session. It does not create or claim a drawing workspace. The next explicit DXF import consumes the pending documents.
- A drop containing only ordinary images or unrelated files remains owned by DSH and is not intercepted by VectorAI.
- A drop containing more than one DXF, an unsupported document, an encrypted document, a corrupt document, or an over-limit file is rejected with a visible, file-specific error. No partial import is started.
- During local extraction the composer shows the current file and phase. After the DXF is imported, the annotation workspace claim becomes active and the existing partition review UI opens.
- The annotation import panel accepts the same file matrix, supports multiple reference documents, and shows the same validation and extraction errors.

## Supported formats

### Drawing

- DXF: `.dxf`

### Plain-text engineering context

- `.txt`, `.md`, `.csv`, `.tsv`, `.json`, `.yaml`, `.yml`, `.ini`, `.xml`, `.html`, `.htm`, `.log`

These formats are decoded locally as UTF-8, with UTF-8 and UTF-16 byte-order marks honored. Invalid binary content is rejected instead of silently replacing large portions with replacement characters.

### Structured documents

- `.pdf`, `.docx`, `.xlsx`, `.pptx`, `.odt`, `.ods`, `.odp`, `.rtf`, `.epub`

These formats are parsed by a bundled, local-only document parser in the DSH Host process. OCR is disabled in this iteration: a scanned PDF with no extractable text is reported as `DOCUMENT_TEXT_EMPTY` and is not presented as successfully parsed.

### Explicitly unsupported legacy formats

- `.doc`, `.xls`, `.ppt`

These formats are rejected with `DOCUMENT_LEGACY_FORMAT_UNSUPPORTED` and a message asking the user to save them as DOCX, XLSX, PPTX, PDF, or plain text. The plugin does not depend on a machine-wide Office or LibreOffice installation, so installing the plugin gives every user the same behavior.

## Architecture

### 1. Conversation drop bridge

`@vectorai/plugin-dsh-annotation-client` contributes an invisible, session-scoped entry to `conversation.input.dock`. The entry installs capture-phase drag/drop listeners while that session is active.

The bridge classifies files by normalized extension and only calls `preventDefault()` plus `stopImmediatePropagation()` when the complete drop is an engineering import set. This prevents DSH's image-only attachment handler from displaying “unsupported format” for VectorAI-owned files while preserving DSH behavior for images and unrelated files.

The bridge does not call DSH's image attachment APIs. It invokes the annotation remote directly.

### 2. Pending document context

Supported documents dropped without a DXF are held as browser-owned pending files for the active session. They are not persisted into conversation history and are cleared when:

- they are consumed by an explicit DXF import;
- the user removes or replaces them;
- the session-scoped bridge unmounts;
- validation or extraction fails.

The composer dock shows a compact pending-document row with filenames and a clear action. This makes the otherwise transient state visible.

### 3. Wire contract

`PartitionImportRequest` changes from one optional text document to an array of immutable binary document inputs:

```ts
interface EngineeringDocumentInput {
  name: string;
  digest: `sha256:${string}`;
  mediaType?: string;
  base64: string;
}

interface PartitionImportRequest {
  dxf: {
    name: string;
    digest: `sha256:${string}`;
    base64: string;
  };
  engineeringDocuments: EngineeringDocumentInput[];
}
```

The host recomputes every digest before parsing. Compatibility parsing accepts the old `engineeringDocument: { name, text }` shape during this migration so persisted tests and older clients fail gracefully, but all new clients emit `engineeringDocuments`.

### 4. Local document extraction

The annotation Host owns a `EngineeringDocumentExtractor` boundary:

```ts
interface ExtractedEngineeringDocument {
  name: string;
  format: string;
  text: string;
  warnings: string[];
}

interface EngineeringDocumentExtractor {
  extract(input: EngineeringDocumentInput, signal?: AbortSignal):
    Promise<ExtractedEngineeringDocument>;
}
```

Plain-text formats use a small owned decoder. Structured formats use the bundled `officeparser` package without OCR or remote worker/CDN dependencies. Parsing occurs in the local Host rather than in React, keeping the client bundle smaller and making parsing behavior reusable by future command/tool routes.

The extracted documents are normalized into one deterministic context string:

```text
===== ENGINEERING DOCUMENT: filename.ext =====
<normalized extracted text>
===== END ENGINEERING DOCUMENT: filename.ext =====
```

Files remain in drop order. Line endings become `\n`; trailing whitespace is removed; empty documents fail. This combined context enters the existing `analyzeShaftPartition` document-evidence path, preserving provenance through the source filename already attached to document-derived partition boundaries.

### 5. Limits and admission

- DXF: 20 MiB maximum, unchanged.
- Each engineering document: 20 MiB encoded-file maximum.
- All engineering documents combined: 50 MiB maximum.
- Extracted text per document: 4 MiB maximum.
- Combined extracted text: 8 MiB maximum.
- Maximum document count: 16.

All limits are checked before starting DXF import where possible. The Host repeats authoritative checks so a modified client cannot bypass them. No accepted document bytes are sent to an external service.

## Failure model

Stable error codes are used at both the remote boundary and UI:

- `ENGINEERING_DROP_MULTIPLE_DXF`
- `ENGINEERING_DOCUMENT_COUNT_LIMIT`
- `ENGINEERING_DOCUMENT_SIZE_LIMIT`
- `ENGINEERING_DOCUMENT_TOTAL_SIZE_LIMIT`
- `ENGINEERING_DOCUMENT_FORMAT_UNSUPPORTED`
- `DOCUMENT_LEGACY_FORMAT_UNSUPPORTED`
- `DOCUMENT_DIGEST_MISMATCH`
- `DOCUMENT_PARSE_FAILED`
- `DOCUMENT_TEXT_EMPTY`
- `DOCUMENT_TEXT_SIZE_LIMIT`
- `DOCUMENT_TOTAL_TEXT_SIZE_LIMIT`

The UI displays the filename and a Chinese remediation message. Errors never claim the second-layer workspace unless the DXF import had already succeeded; if document admission fails first, no drawing mutation occurs.

## Testing

- Client classification tests cover upper/lowercase extensions, empty MIME values, one DXF plus multiple documents, document-only pending state, multiple DXFs, unsupported companions, and preservation of ordinary image drops.
- Drop-bridge tests prove capture-phase interception for owned drops and non-interference for DSH-owned drops.
- Contract tests validate the new array shape, limits, and legacy compatibility input.
- Extractor tests use small real fixtures for PDF, DOCX, XLSX, PPTX, ODT, ODS, ODP, RTF, and EPUB, plus representative plain-text encodings.
- Host workflow tests prove digest verification, deterministic document concatenation, no partial DXF import after document admission failure, and provenance propagation.
- Workspace tests prove multi-file selection, pending-state visibility, progress, and file-specific errors.
- The existing `e2e:dxf-smart-partition` path is extended to import `初始图.dxf` together with `样本图001# DXF工程数据文档.txt` through the same shared admission path.

## Non-goals

- General-purpose DSH file attachments.
- Sending arbitrary documents to the language model as conversation attachments.
- OCR for scanned documents or images.
- Installing or invoking machine-wide Office, LibreOffice, or cloud conversion services.
- Supporting legacy DOC/XLS/PPT before a deterministic, bundled parser is selected and fixture-tested.
