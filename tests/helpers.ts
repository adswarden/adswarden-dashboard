/**
 * Integration test helpers (expect a running Next.js server + DB).
 * Set TEST_BASE_URL (default http://localhost:3000).
 */

export const BASE_URL = process.env.TEST_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3000';

export function uniqueEmail(): string {
  return `ext-test-${Date.now()}-${Math.random().toString(36).slice(2, 10)}@example.test`;
}

export type RegisterResult = {
  token: string;
  user: {
    id: string;
    email: string | null;
    shortId: string;
    plan: string;
    status: string;
  };
};

export async function registerUser(email: string, password: string, name?: string): Promise<RegisterResult> {
  const res = await fetch(`${BASE_URL}/api/extension/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, ...(name ? { name } : {}) }),
  });
  const data = (await res.json()) as RegisterResult & { error?: string };
  if (!res.ok) {
    throw new Error(`register failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as RegisterResult;
}

export async function loginUser(email: string, password: string): Promise<RegisterResult> {
  const res = await fetch(`${BASE_URL}/api/extension/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json()) as RegisterResult & { error?: string };
  if (!res.ok) {
    throw new Error(`login failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data as RegisterResult;
}

export async function fetchMe(token: string): Promise<{ user: RegisterResult['user'] }> {
  const res = await fetch(`${BASE_URL}/api/extension/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { user: RegisterResult['user']; error?: string };
  if (!res.ok) {
    throw new Error(`me failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

export async function logoutUser(token: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/extension/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(`logout failed ${res.status}: ${JSON.stringify(data)}`);
  }
}

export type SSEvent = { event: string; data: string };

export async function* readSSEStream(response: Response): AsyncGenerator<SSEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const sep = buffer.indexOf('\n\n');
      if (sep < 0) break;
      const chunk = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let eventName = 'message';
      const dataLines: string[] = [];
      for (const line of chunk.split('\n')) {
        if (line.startsWith('event:')) eventName = line.slice(6).trim();
        if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
      }
      yield { event: eventName, data: dataLines.join('\n') };
    }
  }
}

export function connectLiveSSE(token: string | undefined, signal: AbortSignal): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE_URL}/api/extension/live`, { headers, signal });
}

export async function syncEvents(
  token: string,
  events: Array<{
    type: 'visit' | 'ad' | 'notification' | 'popup' | 'redirect';
    domain: string;
    campaignId?: string;
    timestamp?: string;
  }>
): Promise<{ ok: boolean; frequencyCounts: Record<string, number> }> {
  const res = await fetch(`${BASE_URL}/api/extension/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ events }),
  });
  const data = (await res.json()) as { ok?: boolean; frequencyCounts?: Record<string, number>; error?: string };
  if (!res.ok) {
    throw new Error(`sync failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return { ok: Boolean(data.ok), frequencyCounts: data.frequencyCounts ?? {} };
}

export async function fetchAdBlock(
  token: string,
  domain?: string,
  requestType?: 'ad' | 'notification'
): Promise<{ ads: unknown[]; notifications: unknown[]; redirects: unknown[] }> {
  const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...(domain !== undefined ? { domain } : {}),
      ...(requestType !== undefined ? { requestType } : {}),
    }),
  });
  const data = (await res.json()) as {
    ads?: unknown[];
    notifications?: unknown[];
    redirects?: unknown[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(`ad-block failed ${res.status}: ${JSON.stringify(data)}`);
  }
  return {
    ads: data.ads ?? [],
    notifications: data.notifications ?? [],
    redirects: data.redirects ?? [],
  };
}

export async function isServerReachable(): Promise<boolean> {
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 4000);
    const r = await fetch(`${BASE_URL}/api/extension/domains`, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

/** Better Auth: cookie jar + session for admin dashboard APIs */
export async function signInDashboardAdmin(
  email: string,
  password: string
): Promise<{ cookieHeader: string }> {
  const res = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(`dashboard sign-in failed ${res.status}: ${JSON.stringify(j)}`);
  }
  const raw = res.headers.getSetCookie?.() ?? [];
  const cookieHeader = raw.map((c) => c.split(';')[0]).join('; ');
  if (!cookieHeader) {
    throw new Error('dashboard sign-in: no Set-Cookie headers');
  }
  return { cookieHeader };
}

export async function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
