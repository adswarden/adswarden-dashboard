import { NextRequest, NextResponse } from 'next/server';
import { database as db } from '@/db';
import { enduserEvents, platforms, ads, notifications, redirects } from '@/db/schema';
import { and, eq, gte, lte, desc, ne, sql, inArray } from 'drizzle-orm';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
import { getSessionWithRole } from '@/lib/dal';
import { getCampaignDashboardBounds, fillMissingDays } from '@/lib/date-range';
import { extractRootDomain, getCanonicalDisplayDomain } from '@/lib/domain-utils';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessible = await getAccessibleCampaignById(sessionWithRole, id);
    if (!accessible) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { start, end } = getCampaignDashboardBounds(accessible);

    const utcDay = sql`( ${enduserEvents.createdAt} AT TIME ZONE 'UTC' )::date`;

    const periodWindow = and(
      eq(enduserEvents.campaignId, id),
      gte(enduserEvents.createdAt, start),
      lte(enduserEvents.createdAt, end)
    );

    /** Served impressions only — excludes passive `visit` rows; chart still uses all event types. */
    const periodWindowServed = and(periodWindow, ne(enduserEvents.type, 'visit'));

    const [kpiCurRow, chartAggRows, topDomainsRaw, countryDistribution] = await Promise.all([
      db
        .select({
          impressions: sql<number>`count(*)::int`,
          uniqueUsers: sql<number>`count(distinct ${enduserEvents.userIdentifier})::int`,
        })
        .from(enduserEvents)
        .where(periodWindowServed),
      db
        .select({
          dateStr: sql<string>`${utcDay}::text`,
          impressions: sql<number>`count(*)::int`,
          users: sql<number>`count(distinct ${enduserEvents.userIdentifier})::int`,
        })
        .from(enduserEvents)
        .where(periodWindow)
        .groupBy(utcDay),
      db
        .select({ domain: enduserEvents.domain, count: sql<number>`count(*)` })
        .from(enduserEvents)
        .where(periodWindowServed)
        .groupBy(enduserEvents.domain)
        .orderBy(desc(sql`count(*)`))
        .limit(30),
      db
        .select({ country: enduserEvents.country, count: sql<number>`count(*)` })
        .from(enduserEvents)
        .where(periodWindowServed)
        .groupBy(enduserEvents.country)
        .orderBy(desc(sql`count(*)`))
        .limit(15),
    ]);

    const impressions = Number(kpiCurRow[0]?.impressions ?? 0);
    const uniqueEndUsers = Number(kpiCurRow[0]?.uniqueUsers ?? 0);

    const impressionsByDate = new Map<string, number>();
    const usersByDate = new Map<string, number>();
    for (const row of chartAggRows) {
      impressionsByDate.set(row.dateStr, Number(row.impressions));
      usersByDate.set(row.dateStr, Number(row.users));
    }
    const chartData = fillMissingDays(start, end, (dateStr) => ({
      impressions: impressionsByDate.get(dateStr) ?? 0,
      users: usersByDate.get(dateStr) ?? 0,
    }));

    /** Bucket for null / empty domain on events (e.g. some notification impressions). */
    const NO_DOMAIN_ROOT = '__no_domain__';
    const NO_DOMAIN_LABEL = 'No domain';

    // Merge domains by root (e.g. www.instagram.com + instagram.com → instagram.com)
    const mergedByRoot = new Map<string, { displayDomain: string; count: number }>();
    for (const row of topDomainsRaw) {
      const domain = (row.domain ?? '').trim();
      const count = Number(row.count);
      if (!domain) {
        const existing = mergedByRoot.get(NO_DOMAIN_ROOT);
        if (existing) existing.count += count;
        else mergedByRoot.set(NO_DOMAIN_ROOT, { displayDomain: NO_DOMAIN_LABEL, count });
        continue;
      }
      const root = extractRootDomain(domain);
      const display = getCanonicalDisplayDomain(domain);
      const existing = mergedByRoot.get(root);
      if (existing) {
        existing.count += count;
      } else {
        mergedByRoot.set(root, { displayDomain: display, count });
      }
    }
    const topDomains = Array.from(mergedByRoot.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ displayDomain, count }) => ({ domain: displayDomain, count }));

    const platformIds = accessible.platformIds?.length ? [...accessible.platformIds] : [];
    const platformDomains =
      platformIds.length > 0
        ? (
          await db
            .select({ domain: platforms.domain })
            .from(platforms)
            .where(inArray(platforms.id, platformIds))
        ).map((p) => p.domain)
        : [];

    let linkedContent:
      | { type: 'ad'; id: string; name: string; description: string | null; imageUrl: string | null; targetUrl: string | null }
      | { type: 'notification'; id: string; title: string; message: string; ctaLink: string | null }
      | {
        type: 'redirect';
        id: string;
        name: string;
        sourceDomain: string;
        includeSubdomains: boolean;
        destinationUrl: string;
      }
      | null = null;
    if (accessible.adId) {
      const [ad] = await db
        .select({ id: ads.id, name: ads.name, description: ads.description, imageUrl: ads.imageUrl, targetUrl: ads.targetUrl })
        .from(ads)
        .where(eq(ads.id, accessible.adId))
        .limit(1);
      if (ad) linkedContent = { type: 'ad', id: ad.id, name: ad.name, description: ad.description, imageUrl: ad.imageUrl, targetUrl: ad.targetUrl };
    } else if (accessible.notificationId) {
      const [n] = await db
        .select({ id: notifications.id, title: notifications.title, message: notifications.message, ctaLink: notifications.ctaLink })
        .from(notifications)
        .where(eq(notifications.id, accessible.notificationId))
        .limit(1);
      if (n) linkedContent = { type: 'notification', id: n.id, title: n.title, message: n.message, ctaLink: n.ctaLink };
    } else if (accessible.redirectId) {
      const [r] = await db
        .select({
          id: redirects.id,
          name: redirects.name,
          sourceDomain: redirects.sourceDomain,
          includeSubdomains: redirects.includeSubdomains,
          destinationUrl: redirects.destinationUrl,
        })
        .from(redirects)
        .where(eq(redirects.id, accessible.redirectId))
        .limit(1);
      if (r)
        linkedContent = {
          type: 'redirect',
          id: r.id,
          name: r.name,
          sourceDomain: r.sourceDomain,
          includeSubdomains: r.includeSubdomains,
          destinationUrl: r.destinationUrl,
        };
    }

    const analyticsPeriod = {
      from: start.toISOString().slice(0, 10),
      to: end.toISOString().slice(0, 10),
    };

    return NextResponse.json({
      kpis: {
        impressions,
        uniqueUsers: uniqueEndUsers,
      },
      analyticsPeriod,
      chartData,
      topDomains,
      countryDistribution: countryDistribution.map((c) => ({
        country: c.country,
        count: Number(c.count),
      })),
      meta: {
        platformDomains,
        countryCodes: accessible.countryCodes?.length ? [...accessible.countryCodes] : [],
        linkedContent,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching campaign dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch campaign dashboard', details: message },
      { status: 500 }
    );
  }
}
