import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { database as db } from '@/db';
import { endUsers, enduserEvents } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import type { ExtensionPlanValue } from '@/lib/extension-user-subscription';
import { fetchAllActiveFrequencyCountsForEndUser } from '@/lib/extension-live-init';
import { checkExtensionSyncRateLimit } from '@/lib/rate-limit';

const eventSchema = z.object({
  type: z.enum(['visit', 'ad', 'notification', 'popup', 'redirect']),
  domain: z.string().trim().max(255),
  campaignId: z.string().uuid().optional(),
  timestamp: z.string().optional(),
});

const bodySchema = z.object({
  events: z.array(eventSchema).min(1).max(500),
});

/** Geo from edge headers (same as ad-block). */
function getCountryFromHeaders(request: NextRequest): string | null {
  const vercel = request.headers.get('x-vercel-ip-country');
  if (vercel && /^[A-Z]{2}$/i.test(vercel)) return vercel.toUpperCase();
  const cf = request.headers.get('cf-ipcountry');
  if (cf && cf !== 'XX' && /^[A-Z]{2}$/i.test(cf)) return cf.toUpperCase();
  return null;
}

/**
 * POST /api/extension/sync
 * Batch report visits / impressions. Returns refreshed frequencyCounts for active campaigns.
 */
export async function POST(request: NextRequest) {
  const rate = await checkExtensionSyncRateLimit(request);
  if (rate) return rate;

  try {
    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          hint: 'Send Authorization: Bearer <token> from extension auth login or register',
        },
        { status: 401 }
      );
    }

    const authUser = resolved.endUser;
    if (authUser.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is not active', status: authUser.status },
        { status: 403 }
      );
    }

    const nowCheck = new Date();
    if (authUser.plan === 'trial' && authUser.endDate && nowCheck > new Date(authUser.endDate)) {
      return NextResponse.json(
        {
          error: 'trial_expired',
          hint: 'Log in or upgrade your plan to continue using the extension.',
        },
        { status: 403 }
      );
    }

    const endUserIdStr = String(authUser.id);
    const emailForDb = authUser.email ?? null;
    const planForDb: ExtensionPlanValue = authUser.plan === 'paid' ? 'paid' : 'trial';
    const country = getCountryFromHeaders(request);

    if (country && country !== authUser.country) {
      await db
        .update(endUsers)
        .set({ country, updatedAt: new Date() })
        .where(eq(endUsers.id, authUser.id));
    }

    const rawUa = request.headers.get('user-agent');
    const userAgentForDb = rawUa?.trim() ? rawUa.trim().slice(0, 2000) : null;

    const rows = parsed.data.events.map((e) => ({
      endUserId: endUserIdStr,
      email: emailForDb,
      plan: planForDb,
      campaignId: e.campaignId ?? null,
      domain: e.domain.slice(0, 255),
      country,
      type: e.type as 'visit' | 'ad' | 'notification' | 'popup' | 'redirect',
      statusCode: 200,
      userAgent: userAgentForDb,
    }));

    await db.insert(enduserEvents).values(rows);

    const frequencyCounts = await fetchAllActiveFrequencyCountsForEndUser(endUserIdStr);

    return NextResponse.json({ ok: true, frequencyCounts });
  } catch (error) {
    console.error('[extension/sync]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      { error: 'Sync failed', ...(isDev && { details: message }) },
      { status: 500 }
    );
  }
}
