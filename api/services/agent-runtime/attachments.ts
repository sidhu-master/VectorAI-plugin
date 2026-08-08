import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  AgentAttachmentPreparer,
  PreparedAgentAttachment,
} from './types.js';

export class LocalAttachmentPreparer implements AgentAttachmentPreparer {
  constructor(private readonly pdfToPpmCommand = process.env.PDFTOPPM_PATH || 'pdftoppm') {}

  async prepare(
    input: PreparedAgentAttachment & { signal: AbortSignal },
  ): Promise<PreparedAgentAttachment> {
    throwIfAborted(input.signal);
    if (input.mimeType.startsWith('image/')) {
      return { image: input.image, mimeType: input.mimeType };
    }
    if (input.mimeType !== 'application/pdf') {
      throw new Error(`不支持的图纸类型: ${input.mimeType}`);
    }

    const directory = await mkdtemp(join(tmpdir(), 'vectorai-pdf-'));
    const pdfPath = join(directory, 'input.pdf');
    const outputPrefix = join(directory, 'page');
    const pngPath = `${outputPrefix}.png`;
    try {
      await writeFile(pdfPath, Buffer.from(input.image, 'base64'));
      await runCommand(this.pdfToPpmCommand, [
        '-f', '1', '-l', '1', '-singlefile', '-png', '-scale-to', '2048',
        pdfPath, outputPrefix,
      ], input.signal);
      const png = await readFile(pngPath);
      return { image: png.toString('base64'), mimeType: 'image/png' };
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new Error('Operation aborted');
}

function runCommand(command: string, args: string[], signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { signal, maxBuffer: 1024 * 1024 }, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
