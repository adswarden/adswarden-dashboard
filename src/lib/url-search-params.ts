/**
 * Reads a single query value from URLSearchParams or a props-like record (e.g. page searchParams).
 */
export function getQueryParam(
  sp: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string
): string | undefined {
  if (sp instanceof URLSearchParams) {
    const v = sp.get(key);
    return v?.trim() || undefined;
  }
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return typeof s === 'string' ? s.trim() || undefined : undefined;
}
