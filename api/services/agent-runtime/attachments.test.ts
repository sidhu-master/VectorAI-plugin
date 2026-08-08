import { describe, expect, it } from 'vitest';
import { LocalAttachmentPreparer } from './attachments';

describe('LocalAttachmentPreparer', () => {
  it('passes image attachments through without conversion', async () => {
    const preparer = new LocalAttachmentPreparer();

    await expect(preparer.prepare({
      image: 'cG5n', mimeType: 'image/png', signal: new AbortController().signal,
    })).resolves.toEqual({ image: 'cG5n', mimeType: 'image/png' });
  });

  it('rasterizes the first PDF page into a bounded PNG', async () => {
    const preparer = new LocalAttachmentPreparer();

    const result = await preparer.prepare({
      image: minimalPdf().toString('base64'),
      mimeType: 'application/pdf',
      signal: new AbortController().signal,
    });

    expect(result.mimeType).toBe('image/png');
    expect(Buffer.from(result.image, 'base64').subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  }, 15_000);
});

function minimalPdf(): Buffer {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R >>',
    '<< /Length 0 >>\nstream\n\nendstream',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
