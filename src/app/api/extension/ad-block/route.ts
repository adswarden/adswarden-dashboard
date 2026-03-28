import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import {
  ads,
  campaigns,
  endUsers,
  enduserEvents,
  notifications,
  platforms,
  redirects,
} from '@/db/schema';
import { eq, and, inArray, sql, arrayContains } from 'drizzle-orm';
import { domainsMatch, redirectSourceMatchesVisit } from '@/lib/domain-utils';
import type { ExtensionPlanValue } from '@/lib/extension-user-subscription';
import { resolveEndUserFromRequest } from '@/lib/enduser-auth';
import {
  getCachedPlatformList,
  setCachedPlatformList,
} from '@/lib/redis';
import { logger } from '@/lib/logger';
import { checkAdBlockRateLimit } from '@/lib/rate-limit';

function isNewUser(createdAt: Date, withinDays = 7): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - withinDays);
  return new Date(createdAt) >= cutoff;
}

function currentTimeInMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function parseTimeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const parts = t.split(':').map(Number);
  if (parts.length >= 2) return parts[0] * 60 + parts[1];
  return null;
}

function isCampaignActive(
  status: string,
  startDate: Date | null,
  endDate: Date | null,
  now: Date
): boolean {
  if (status !== 'active') return false;
  if (startDate && now < startDate) return false;
  if (endDate && now > endDate) return false;
  return true;
}

/** Get 2-letter country code from request headers (e.g. Vercel `x-vercel-ip-country`) */
function getCountryFromHeaders(request: NextRequest): string | null {
  const vercel = request.headers.get('x-vercel-ip-country');
  if (vercel && /^[A-Z]{2}$/i.test(vercel)) return vercel.toUpperCase();
  const cf = request.headers.get('cf-ipcountry');
  if (cf && cf !== 'XX' && /^[A-Z]{2}$/i.test(cf)) return cf.toUpperCase();
  return null;
}

type CampaignRow = {
  id: string;
  targetAudience: string;
  campaignType: string;
  frequencyType: string;
  frequencyCount: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
  platformIds: string[] | null;
  countryCodes: string[] | null;
};

/**
 * POST /api/extension/ad-block
 * Returns ads and/or notifications per campaign rules.
 * Header: Authorization: Bearer <token> (from POST /api/extension/auth/login or register)
 * Body: { domain?, requestType?, userAgent? }
 * - domain is required when requesting ads; optional when requestType is "notification" only.
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await checkAdBlockRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const contentType = request.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 400 }
      );
    }

    let body: {
      domain?: string;
      requestType?: 'ad' | 'notification';
      userAgent?: string;
    };
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        },
        { status: 400 }
      );
    }

    const { domain, requestType } = body;

    const resolved = await resolveEndUserFromRequest(request);
    if (!resolved) {
      return NextResponse.json(
        {
          error: 'Unauthorized',
          hint: 'Send Authorization: Bearer <token> from POST /api/extension/auth/provision, login, or register',
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
    if (
      authUser.plan === 'trial' &&
      authUser.endDate &&
      nowCheck > new Date(authUser.endDate)
    ) {
      return NextResponse.json(
        {
          error: 'trial_expired',
          hint: 'Log in or upgrade your plan to continue using the extension.',
        },
        { status: 403 }
      );
    }

    const endUserId = authUser.id;
    const emailForDb = authUser.email ?? null;
    const planForDb: ExtensionPlanValue = authUser.plan === 'paid' ? 'paid' : 'trial';

    const rawUserAgent =
      typeof body.userAgent === 'string' && body.userAgent.trim() !== ''
        ? body.userAgent
        : request.headers.get('user-agent');
    const userAgentForDb = rawUserAgent?.trim() ? rawUserAgent.trim().slice(0, 2000) : null;

    const country = getCountryFromHeaders(request);
    if (country && country !== authUser.country) {
      await db
        .update(endUsers)
        .set({ country, updatedAt: new Date() })
        .where(eq(endUsers.id, authUser.id));
    }
    // console.log('[ad-block] req', { endUserId, domain: domain ?? null, country, requestType: requestType ?? null });

    // Domain is required for ads only; optional for notifications (served everywhere when not specified)
    const isNotificationOnly = requestType === 'notification';
    if (!domain && !isNotificationOnly) {
      return NextResponse.json(
        { error: 'domain is required when requesting ads' },
        { status: 400 }
      );
    }

    if (requestType !== undefined && requestType !== 'ad' && requestType !== 'notification') {
      return NextResponse.json(
        { error: 'requestType must be either "ad" or "notification"' },
        { status: 400 }
      );
    }

    const shouldFetchAds = requestType === undefined || requestType === 'ad';
    const shouldFetchNotifications = requestType === undefined || requestType === 'notification';
    const shouldFetchRedirects = Boolean(domain);

    const now = new Date();

    let allPlatformsList = await getCachedPlatformList();
    if (!allPlatformsList) {
      allPlatformsList = await db
        .select({ id: platforms.id, domain: platforms.domain })
        .from(platforms);
      await setCachedPlatformList(allPlatformsList);
    }

    const platform = domain ? allPlatformsList.find((p) => domainsMatch(p.domain, domain)) : null;

    // No early return: when platform is null we still serve global notification campaigns (no domain restriction)

    type AdOut = { title: string; image: string | null; description: string | null; redirectUrl: string | null; htmlCode?: string | null; displayAs?: 'inline' | 'popup' };
    type NotifOut = { title: string; message: string; ctaLink?: string | null };
    type RedirectOut = {
      sourceDomain: string;
      includeSubdomains: boolean;
      destinationUrl: string;
      campaignId: string;
    };
    let publicAds: AdOut[] = [];
    let publicNotifications: NotifOut[] = [];
    const publicRedirects: RedirectOut[] = [];

    const campaignSelect = {
      id: campaigns.id,
      targetAudience: campaigns.targetAudience,
      campaignType: campaigns.campaignType,
      frequencyType: campaigns.frequencyType,
      frequencyCount: campaigns.frequencyCount,
      timeStart: campaigns.timeStart,
      timeEnd: campaigns.timeEnd,
      status: campaigns.status,
      startDate: campaigns.startDate,
      endDate: campaigns.endDate,
      adId: campaigns.adId,
      notificationId: campaigns.notificationId,
      redirectId: campaigns.redirectId,
      platformIds: campaigns.platformIds,
      countryCodes: campaigns.countryCodes,
    } as const;

    // Resolve campaigns:
    // - When platform exists: campaigns linked to that platform (ads, notifications, redirects)
    // - Global notification: no platforms
    // - Global redirect: no platforms
    const [platformCampaigns, globalNotifCampaigns, globalRedirectCampaigns] = await Promise.all([
      platform
        ? db.select(campaignSelect).from(campaigns).where(arrayContains(campaigns.platformIds, [platform.id]))
        : [],
      db
        .select(campaignSelect)
        .from(campaigns)
        .where(
          and(eq(campaigns.campaignType, 'notification'), sql`cardinality(${campaigns.platformIds}) = 0`)
        ),
      db
        .select(campaignSelect)
        .from(campaigns)
        .where(
          and(eq(campaigns.campaignType, 'redirect'), sql`cardinality(${campaigns.platformIds}) = 0`)
        ),
    ]);

    const platformRows = platformCampaigns;
    const seenIds = new Set<string>();
    const campaignsForPlatform: CampaignRow[] = [];
    for (const c of platformRows) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        campaignsForPlatform.push(c as CampaignRow);
      }
    }
    for (const c of globalNotifCampaigns) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        campaignsForPlatform.push(c as CampaignRow);
      }
    }
    for (const c of globalRedirectCampaigns) {
      if (!seenIds.has(c.id)) {
        seenIds.add(c.id);
        campaignsForPlatform.push(c as CampaignRow);
      }
    }
    const campaignIds = campaignsForPlatform.map((c) => c.id);

    const endUserIdStr = String(endUserId);

    const [endUserFirstSeen, viewCountRows] = await Promise.all([
      db
        .select({ createdAt: sql<Date>`MIN(${enduserEvents.createdAt})`.as('created_at') })
        .from(enduserEvents)
        .where(eq(enduserEvents.endUserId, endUserIdStr)),
      campaignIds.length > 0
        ? db
          .select({
            campaignId: enduserEvents.campaignId,
            viewCount: sql<number>`COUNT(*)`.as('view_count'),
          })
          .from(enduserEvents)
          .where(
            and(
              eq(enduserEvents.endUserId, endUserIdStr),
              inArray(enduserEvents.campaignId, campaignIds)
            )
          )
          .groupBy(enduserEvents.campaignId)
        : [],
    ]);

    const endUserCreatedAt = endUserFirstSeen[0]?.createdAt ?? authUser.startDate;
    const endUserGeoCountry = country;
    const isNew = isNewUser(endUserCreatedAt);
    const currentMinutes = currentTimeInMinutes();

    const campaignCountryMap = new Map<string, Set<string>>();
    for (const c of campaignsForPlatform) {
      const codes = c.countryCodes;
      if (codes && codes.length > 0) {
        campaignCountryMap.set(
          c.id,
          new Set(codes.map((code) => String(code).toUpperCase()))
        );
      }
    }

    const viewCountMap = new Map<string, number>();
    for (const row of viewCountRows) {
      if (row.campaignId) viewCountMap.set(row.campaignId, Number(row.viewCount));
    }

    const qualifyingCampaigns: CampaignRow[] = [];
    for (const c of campaignsForPlatform) {
      if (!isCampaignActive(c.status, c.startDate, c.endDate, now)) continue;
      if (c.targetAudience === 'new_users' && !isNew) continue;

      if (c.frequencyType === 'time_based') {
        const start = parseTimeToMinutes(c.timeStart);
        const end = parseTimeToMinutes(c.timeEnd);
        if (start !== null && end !== null) {
          if (start <= end) {
            if (currentMinutes < start || currentMinutes > end) continue;
          } else {
            if (currentMinutes > end && currentMinutes < start) continue;
          }
        }
      }

      if (c.frequencyType === 'only_once' || c.frequencyType === 'specific_count') {
        const viewCount = viewCountMap.get(c.id) ?? 0;
        if (c.frequencyType === 'only_once' && viewCount >= 1) continue;
        if (c.frequencyType === 'specific_count' && c.frequencyCount !== null && viewCount >= c.frequencyCount) continue;
      }

      const campaignCountriesSet = campaignCountryMap.get(c.id);
      if (campaignCountriesSet && campaignCountriesSet.size > 0) {
        if (!endUserGeoCountry) continue;
        if (!campaignCountriesSet.has(endUserGeoCountry)) continue;
      }

      qualifyingCampaigns.push(c);
    }

    const adIds = new Map<string, 'inline' | 'popup'>();
    const notificationIds = new Set<string>();

    for (const c of qualifyingCampaigns) {
      if (c.campaignType === 'ads' || c.campaignType === 'popup') {
        const adId = c.adId;
        if (adId) {
          adIds.set(adId, c.campaignType === 'popup' ? 'popup' : 'inline');
        }
      }
      if (c.campaignType === 'notification') {
        const notifId = c.notificationId;
        if (notifId) notificationIds.add(notifId);
      }
    }

    const servedAdIds = new Set<string>();
    if (shouldFetchAds && adIds.size > 0) {
      const adList = await db
        .select({
          id: ads.id,
          name: ads.name,
          description: ads.description,
          imageUrl: ads.imageUrl,
          targetUrl: ads.targetUrl,
          htmlCode: ads.htmlCode,
        })
        .from(ads)
        .where(inArray(ads.id, [...adIds.keys()]))
        .orderBy(ads.createdAt);

      publicAds = adList.map((ad) => ({
        title: ad.name,
        image: ad.imageUrl,
        description: ad.description ?? null,
        redirectUrl: ad.targetUrl ?? null,
        htmlCode: ad.htmlCode ?? null,
        displayAs: adIds.get(ad.id) ?? 'inline',
      }));
      for (const a of adList) servedAdIds.add(a.id);
    }

    const servedNotificationIds = new Set<string>();
    if (shouldFetchNotifications && notificationIds.size > 0) {
      // Notifications come from qualifying campaigns only. Campaign filters (frequency, country, time, etc.)
      // and viewCount from extension user events determine if we should serve.
      const notifList = await db
        .select({
          id: notifications.id,
          title: notifications.title,
          message: notifications.message,
          ctaLink: notifications.ctaLink,
        })
        .from(notifications)
        .where(inArray(notifications.id, [...notificationIds]))
        .orderBy(notifications.createdAt);

      publicNotifications = notifList.map((n) => ({
        title: n.title,
        message: n.message,
        ctaLink: n.ctaLink ?? null,
      }));

      for (const n of notifList) servedNotificationIds.add(n.id);
    }

    const servedRedirectCampaignIds = new Set<string>();
    if (shouldFetchRedirects && domain) {
      const redirectCampaigns = qualifyingCampaigns.filter(
        (c) => c.campaignType === 'redirect' && c.redirectId
      );
      const redirectIdList = [...new Set(redirectCampaigns.map((c) => c.redirectId!))];
      if (redirectIdList.length > 0) {
        const redirectRows = await db
          .select({
            id: redirects.id,
            sourceDomain: redirects.sourceDomain,
            includeSubdomains: redirects.includeSubdomains,
            destinationUrl: redirects.destinationUrl,
          })
          .from(redirects)
          .where(inArray(redirects.id, redirectIdList));

        const redirectById = new Map(redirectRows.map((r) => [r.id, r]));

        for (const c of redirectCampaigns) {
          const r = c.redirectId ? redirectById.get(c.redirectId) : undefined;
          if (!r) continue;
          if (!redirectSourceMatchesVisit(domain, r.sourceDomain, r.includeSubdomains)) continue;
          publicRedirects.push({
            sourceDomain: r.sourceDomain,
            includeSubdomains: r.includeSubdomains,
            destinationUrl: r.destinationUrl,
            campaignId: c.id,
          });
          servedRedirectCampaignIds.add(c.id);
        }
      }
    }

    // Insert end-user events: one row per campaign served, or one 'request' row when nothing served
    const logDomain = domain ?? 'extension';
    const serveEventRows: {
      endUserId: string;
      email: string | null;
      plan: ExtensionPlanValue;
      campaignId: string;
      domain: string;
      country: string | null;
      type: 'ad' | 'notification' | 'popup' | 'redirect';
      statusCode: number;
      userAgent: string | null;
    }[] = [];
    for (const c of qualifyingCampaigns) {
      const adId = c.adId;
      const notifId = c.notificationId;
      if (c.campaignType === 'ads' && shouldFetchAds && adId && servedAdIds.has(adId)) {
        serveEventRows.push({
          endUserId: endUserIdStr,
          email: emailForDb,
          plan: planForDb,
          campaignId: c.id,
          domain: logDomain,
          country: country,
          type: 'ad',
          statusCode: 200,
          userAgent: userAgentForDb,
        });
      }
      if (c.campaignType === 'popup' && shouldFetchAds && adId && servedAdIds.has(adId)) {
        serveEventRows.push({
          endUserId: endUserIdStr,
          email: emailForDb,
          plan: planForDb,
          campaignId: c.id,
          domain: logDomain,
          country: country,
          type: 'popup',
          statusCode: 200,
          userAgent: userAgentForDb,
        });
      }
      if (c.campaignType === 'notification' && shouldFetchNotifications && notifId && servedNotificationIds.has(notifId)) {
        serveEventRows.push({
          endUserId: endUserIdStr,
          email: emailForDb,
          plan: planForDb,
          campaignId: c.id,
          domain: logDomain,
          country: country,
          type: 'notification',
          statusCode: 200,
          userAgent: userAgentForDb,
        });
      }
      if (
        c.campaignType === 'redirect' &&
        shouldFetchRedirects &&
        c.redirectId &&
        servedRedirectCampaignIds.has(c.id)
      ) {
        serveEventRows.push({
          endUserId: endUserIdStr,
          email: emailForDb,
          plan: planForDb,
          campaignId: c.id,
          domain: logDomain,
          country: country,
          type: 'redirect',
          statusCode: 200,
          userAgent: userAgentForDb,
        });
      }
    }
    if (serveEventRows.length > 0) {
      await db.insert(enduserEvents).values(serveEventRows);
    } else {
      // Log every request, even when nothing served
      await db.insert(enduserEvents).values({
        endUserId: endUserIdStr,
        email: emailForDb,
        plan: planForDb,
        campaignId: null,
        domain: logDomain,
        country: country,
        type: 'request',
        statusCode: 200,
        userAgent: userAgentForDb,
      });
    }

    const res = { ads: publicAds, notifications: publicNotifications, redirects: publicRedirects };
    logger.debug('[ad-block] res', {
      domain: domain ?? 'extension',
      ads: publicAds.length,
      notifications: publicNotifications.length,
      redirects: publicRedirects.length,
    });
    return NextResponse.json(res);
  } catch (error) {
    logger.error('extension/ad-block failed', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isDev = process.env.NODE_ENV !== 'production';
    return NextResponse.json(
      { error: 'Failed to fetch ad block', ...(isDev && { details: message }) },
      { status: 500 }
    );
  }
}
