export function isAllowedInAppNavigation(candidate: URL, readyUrl: URL): boolean {
  return candidate.protocol === 'http:' && candidate.origin === readyUrl.origin;
}

export function isExternalHttpUrl(candidate: URL): boolean {
  return candidate.protocol === 'https:' || candidate.protocol === 'http:';
}
