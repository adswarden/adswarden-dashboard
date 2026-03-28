import { describe, it, expect, beforeAll } from 'vitest';
import {
  BASE_URL,
  connectLiveSSE,
  fetchAdBlock,
  fetchMe,
  isServerReachable,
  loginUser,
  logoutUser,
  readSSEStream,
  registerUser,
  signInDashboardAdmin,
  syncEvents,
  uniqueEmail,
  wait,
} from './helpers';

/** Set SKIP_EXTENSION_INTEGRATION=1 to skip (e.g. CI without a running app). */
const skipExtensionIntegration = process.env.SKIP_EXTENSION_INTEGRATION === '1';

let serverUp = false;
let liveSseInitOk = false;

function requireServer(): void {
  if (!serverUp) {
    throw new Error(
      `Integration tests require a running app at ${BASE_URL}. Start the server (e.g. pnpm dev).`
    );
  }
}

function requireLiveSse(): void {
  requireServer();
  if (!liveSseInitOk) {
    throw new Error(
      'SSE did not emit an init event. For live tests, configure REDIS_URL so /api/extension/live can subscribe.'
    );
  }
}

describe.skipIf(skipExtensionIntegration)('Extension integration', () => {
  beforeAll(async () => {
    serverUp = await isServerReachable();
    if (!serverUp) return;

    const abort = new AbortController();
    const t = setTimeout(() => abort.abort(), 8000);
    try {
      const res = await connectLiveSSE(undefined, abort.signal);
      if (!res.ok) {
        liveSseInitOk = false;
        return;
      }
      for await (const ev of readSSEStream(res)) {
        if (ev.event === 'init') {
          liveSseInitOk = true;
          break;
        }
        if (ev.event === 'connection_count') continue;
      }
    } catch {
      liveSseInitOk = false;
    } finally {
      clearTimeout(t);
      abort.abort();
    }
  });

  describe('Extension API — Auth flow', () => {
    it('register → login → me → logout → me 401', async () => {
      requireServer();
      const email = uniqueEmail();
      const password = 'test-pass-99';

      const reg = await registerUser(email, password, 'Vitest User');
      expect(reg.token).toBeTruthy();
      expect(reg.user.email).toBe(email.toLowerCase());

      const again = await loginUser(email, password);
      expect(again.token).toBeTruthy();

      const me = await fetchMe(again.token);
      expect(me.user.shortId).toBeTruthy();

      await logoutUser(again.token);

      const bad = await fetch(`${BASE_URL}/api/extension/auth/me`, {
        headers: { Authorization: `Bearer ${again.token}` },
      });
      expect(bad.status).toBe(401);
    });
  });

  describe('Extension API — SSE init payload', () => {
  it('authenticated connection includes user, domains, campaigns, frequencyCounts', async () => {
    requireLiveSse();
    const email = uniqueEmail();
    const { token } = await registerUser(email, 'long-pass-12');

    const abort = new AbortController();
    const res = await connectLiveSSE(token, abort.signal);
    expect(res.ok).toBe(true);

    let init: { user?: unknown; domains?: unknown; campaigns?: unknown; frequencyCounts?: unknown } | null =
      null;
    for await (const ev of readSSEStream(res)) {
      if (ev.event === 'init') {
        init = JSON.parse(ev.data) as typeof init;
        break;
      }
    }
    abort.abort();

    expect(init).not.toBeNull();
    expect(init!.user).toBeTruthy();
    expect(Array.isArray(init!.domains)).toBe(true);
    expect(Array.isArray(init!.campaigns)).toBe(true);
    expect(init!.frequencyCounts).toBeTruthy();
    expect(typeof init!.frequencyCounts).toBe('object');
  });

  it('anonymous connection includes domains only (no user/campaigns)', async () => {
    requireLiveSse();
    const abort = new AbortController();
    const res = await connectLiveSSE(undefined, abort.signal);
    expect(res.ok).toBe(true);

    let init: { user: unknown; campaigns: unknown } | null = null;
    for await (const ev of readSSEStream(res)) {
      if (ev.event === 'init') {
        init = JSON.parse(ev.data) as { user: unknown; campaigns: unknown };
        break;
      }
    }
    abort.abort();

    expect(init).not.toBeNull();
    expect(init!.user).toBeNull();
    expect(init!.campaigns).toEqual([]);
  });
  });

  describe('Extension API — SSE campaign_updated', () => {
    it.skipIf(!process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)(
      'emits update after admin changes a campaign',
      async () => {
        requireLiveSse();
        const adminEmail = process.env.TEST_ADMIN_EMAIL!;
        const adminPassword = process.env.TEST_ADMIN_PASSWORD!;

        const { cookieHeader } = await signInDashboardAdmin(adminEmail, adminPassword);

        const listRes = await fetch(`${BASE_URL}/api/campaigns?page=1&pageSize=1`, {
          headers: { Cookie: cookieHeader },
        });
        expect(listRes.ok).toBe(true);
        const listJson = (await listRes.json()) as { data?: Array<{ id: string; name: string }> };
        const first = listJson.data?.[0];
        if (!first) {
          throw new Error('At least one campaign must exist in the database for this test.');
        }

        const getRes = await fetch(`${BASE_URL}/api/campaigns/${first.id}`, {
          headers: { Cookie: cookieHeader },
        });
        expect(getRes.ok).toBe(true);
        const campaign = (await getRes.json()) as Record<string, unknown>;
        const nextName = `${String(campaign.name)} (rt-${Date.now()})`;

        const email = uniqueEmail();
        const { token } = await registerUser(email, 'long-pass-12');

        const abort = new AbortController();
        const res = await connectLiveSSE(token, abort.signal);
        expect(res.ok).toBe(true);

        const updatePromise = (async () => {
          for await (const ev of readSSEStream(res)) {
            if (ev.event !== 'update') continue;
            try {
              const parsed = JSON.parse(ev.data) as { campaignId?: string; campaign?: unknown };
              if (parsed.campaignId === first.id) return parsed;
            } catch {
              /* ignore */
            }
          }
          return null;
        })();

        await wait(1500);

        const putRes = await fetch(`${BASE_URL}/api/campaigns/${first.id}`, {
          method: 'PUT',
          headers: { Cookie: cookieHeader, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...campaign, name: nextName }),
        });
        expect(putRes.ok).toBe(true);

        const updatePayload = await Promise.race([
          updatePromise,
          wait(15_000).then(() => null),
        ]);
        abort.abort();

        expect(updatePayload).not.toBeNull();
        expect(updatePayload!.campaignId).toBe(first.id);
        expect(updatePayload!.campaign).toBeTruthy();
      }
    );
  });

  describe('Extension API — Batch sync', () => {
  it('accepts visit events and returns frequencyCounts', async () => {
    requireServer();
    const email = uniqueEmail();
    const { token } = await registerUser(email, 'long-pass-12');

    const out = await syncEvents(token, [
      { type: 'visit', domain: 'example.com' },
      { type: 'visit', domain: 'example.org' },
    ]);
    expect(out.ok).toBe(true);
    expect(typeof out.frequencyCounts).toBe('object');
  });

  it('returns 401 without Bearer token', async () => {
    requireServer();
    const res = await fetch(`${BASE_URL}/api/extension/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [{ type: 'visit', domain: 'x.com' }] }),
    });
    expect(res.status).toBe(401);
  });
  });

  describe('Extension API — Ad-block fallback', () => {
  it('returns ads, notifications, and redirects arrays', async () => {
    requireServer();
    const email = uniqueEmail();
    const { token } = await registerUser(email, 'long-pass-12');

    const withDomain = await fetchAdBlock(token, 'nonexistent-domain-xyz123.example');
    expect(Array.isArray(withDomain.ads)).toBe(true);
    expect(Array.isArray(withDomain.notifications)).toBe(true);
    expect(Array.isArray(withDomain.redirects)).toBe(true);
  });

  it('notification-only request accepts empty domain', async () => {
    requireServer();
    const email = uniqueEmail();
    const { token } = await registerUser(email, 'long-pass-12');

    const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestType: 'notification' }),
    });
    expect(res.ok).toBe(true);
    const data = (await res.json()) as { redirects?: unknown[]; ads?: unknown[] };
    expect(Array.isArray(data.redirects)).toBe(true);
    expect(data.redirects!.length).toBe(0);
  });
  });

  describe('Extension API — Full lifecycle', () => {
  it('register → SSE init → sync → ad-block → logout', async () => {
    requireLiveSse();
    const email = uniqueEmail();
    const password = 'long-pass-12';
    const { token } = await registerUser(email, password);

    const abort = new AbortController();
    const res = await connectLiveSSE(token, abort.signal);
    let sawInit = false;
    for await (const ev of readSSEStream(res)) {
      if (ev.event === 'init') {
        sawInit = true;
        break;
      }
    }
    expect(sawInit).toBe(true);
    abort.abort();

    await syncEvents(token, [{ type: 'visit', domain: 'lifecycle.test' }]);

    const ab = await fetchAdBlock(token, 'another-non-platform-99.invalid');
    expect(ab.redirects.length).toBeGreaterThanOrEqual(0);

    await logoutUser(token);
    const me = await fetch(`${BASE_URL}/api/extension/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(401);
  });
  });
});

