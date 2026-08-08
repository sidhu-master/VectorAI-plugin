const SENSITIVE_PARTS = ['apikey', 'authorization', 'token', 'base64', 'pdfbody'];

export function redactAuditPayload<T>(value: T): T {
  return redact(value, '') as T;
}

function redact(value: unknown, key: string): unknown {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  const isReference = normalized.includes('hash') || normalized.includes('sha256') || normalized.includes('reference');
  const isMediaBounds = normalized.endsWith('imagebounds')
    || normalized.endsWith('screenshotbounds')
    || normalized.endsWith('pdfbounds');
  const isMediaBody = (normalized.includes('image') || normalized.includes('screenshot') || normalized.includes('pdf'))
    && !isReference && !isMediaBounds;
  if (!isReference && (isMediaBody || SENSITIVE_PARTS.some((part) => normalized.includes(part)))) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, key));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
      childKey, redact(childValue, childKey),
    ]));
  }
  return value;
}
