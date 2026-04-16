/**
 * Probe the extension API before integration tests. A healthy app returns **401** on
 * `GET /api/extension/live` without a token. **502** / HTML usually means a bad proxy,
 * Cloudflare origin error, or `BETTER_AUTH_BASE_URL` pointing at a dead host.
 */
export type ExtensionIntegrationPreflightResult =
  | { ok: true }
  | { ok: false; reason: string };

export async function extensionIntegrationPreflight(
  baseUrl: string,
  timeoutMs = 20_000
): Promise<ExtensionIntegrationPreflightResult> {
  const origin = baseUrl.replace(/\/+$/, '');
  const url = `${origin}/api/extension/live`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: ctrl.signal,
    });

    if (res.status === 401) {
      return { ok: true };
    }

    if (res.status >= 500) {
      const text = await res.text();
      const html = /<!DOCTYPE\s+html/i.test(text);
      const hint = html
        ? ' Response is HTML (often Cloudflare or a reverse proxy), not your Next.js API.'
        : '';
      return {
        ok: false,
        reason: [
          `GET ${url} returned HTTP ${res.status} (expected 401 without a bearer token when the app is up).${hint}`,
          'Fix: run `pnpm dev` (or deploy) and set `EXTENSION_INTEGRATION_BASE_URL` or `BETTER_AUTH_BASE_URL` to that origin, e.g. http://127.0.0.1:3000.',
          `First bytes: ${text.slice(0, 160).replace(/\s+/g, ' ')}`,
        ].join(' '),
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        reason: `GET ${url} returned 404 — base URL may be wrong (got origin ${origin}).`,
      };
    }

    const ct = res.headers.get('content-type') ?? '';
    if (res.ok) {
      return {
        ok: false,
        reason: `GET ${url} returned ${res.status} without auth (unexpected). content-type=${ct}`,
      };
    }

    return {
      ok: false,
      reason: `GET ${url} returned HTTP ${res.status} — expected 401 for unauthenticated extension live.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const aborted = msg.includes('abort') || (e instanceof Error && e.name === 'AbortError');
    return {
      ok: false,
      reason: aborted
        ? `Timed out reaching ${url} after ${timeoutMs}ms. Is the server running?`
        : `Cannot reach ${url}: ${msg}`,
    };
  } finally {
    clearTimeout(t);
  }
}
