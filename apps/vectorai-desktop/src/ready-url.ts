const READY_PREFIX = 'dsh web: ';

export function findReadyUrl(output: string, expectedPort: number): URL | undefined {
  const lines = output.split(/\r?\n/u);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]?.trim();
    if (!line?.startsWith(READY_PREFIX)) continue;
    const candidate = line.slice(READY_PREFIX.length).split(/\s/u, 1)[0];
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      const query = [...url.searchParams.entries()];
      if (url.protocol === 'http:'
        && url.hostname === '127.0.0.1'
        && Number(url.port) === expectedPort
        && url.pathname === '/'
        && query.length === 1
        && query[0]?.[0] === 'token'
        && Boolean(query[0]?.[1])) {
        return url;
      }
    } catch {
      // Ignore unrelated output that merely shares the prefix.
    }
  }
  return undefined;
}
