import 'server-only';

import { database as db } from '@/db';
import { campaigns, enduserEvents } from '@/db/schema';
import { and, desc, eq, gte, ilike, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import { getQueryParam } from '@/lib/url-search-params';
import { escapeCsvCell, escapeIlikePattern } from '@/lib/utils';

export type EventsDashboardFilters = {
  type?: (typeof enduserEvents.$inferSelect)['type'];
  from?: string;
  to?: string;
  domain?: string;
  country?: string;
  endUserId?: string;
  campaignId?: string;
};

const EVENT_TYPES = new Set<string>([
  'ad',
  'notification',
  'popup',
  'request',
  'redirect',
  'visit',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEventsDashboardFilters(
  sp: URLSearchParams | Record<string, string | string[] | undefined>
): EventsDashboardFilters {
  const typeRaw = getQueryParam(sp, 'type')?.toLowerCase();
  const type =
    typeRaw && EVENT_TYPES.has(typeRaw)
      ? (typeRaw as EventsDashboardFilters['type'])
      : undefined;
  const country = getQueryParam(sp, 'country')?.trim().toUpperCase();
  return {
    type,
    from: getQueryParam(sp, 'from'),
    to: getQueryParam(sp, 'to'),
    domain: getQueryParam(sp, 'domain'),
    country: country && country.length === 2 ? country : undefined,
    endUserId: getQueryParam(sp, 'endUserId'),
    campaignId: getQueryParam(sp, 'campaignId'),
  };
}

/** Non-admins only see events tied to campaigns they created. */
export function endEventsAccessWhere(role: 'user' | 'admin', userId: string): SQL | undefined {
  if (role === 'admin') return undefined;
  return and(
    isNotNull(enduserEvents.campaignId),
    sql`exists (
      select 1 from ${campaigns} c
      where c.id = ${enduserEvents.campaignId}
      and c.created_by = ${userId}
    )`
  );
}

function buildFilterConditions(filters: EventsDashboardFilters): SQL[] {
  const conditions: SQL[] = [];
  if (filters.type) {
    conditions.push(eq(enduserEvents.type, filters.type));
  }
  if (filters.from) {
    conditions.push(gte(enduserEvents.createdAt, new Date(filters.from)));
  }
  if (filters.to) {
    const end = new Date(filters.to);
    if (!filters.to.includes('T')) end.setHours(23, 59, 59, 999);
    conditions.push(lte(enduserEvents.createdAt, end));
  }
  /** Domain / end-user substring search (same family as other dashboards). */
  if (filters.domain?.trim()) {
    const esc = escapeIlikePattern(filters.domain.trim());
    conditions.push(ilike(enduserEvents.domain, `%${esc}%`));
  }
  if (filters.country) {
    const cc = filters.country.toLowerCase();
    conditions.push(sql`lower(coalesce(${enduserEvents.country}, '')) = ${cc}`);
  }
  if (filters.endUserId?.trim()) {
    const esc = escapeIlikePattern(filters.endUserId.trim());
    conditions.push(ilike(enduserEvents.endUserId, `%${esc}%`));
  }
  const cid = filters.campaignId?.trim();
  if (cid && UUID_RE.test(cid)) {
    conditions.push(eq(enduserEvents.campaignId, cid));
  }
  return conditions;
}

function combineWhere(access: SQL | undefined, filters: SQL[]): SQL | undefined {
  const filterSql = filters.length ? and(...filters) : undefined;
  if (access && filterSql) return and(access, filterSql);
  return access ?? filterSql;
}

export function eventsFiltersWhere(
  access: SQL | undefined,
  filters: EventsDashboardFilters
): SQL | undefined {
  return combineWhere(access, buildFilterConditions(filters));
}

export type EventStatsRow = {
  total: number;
  uniqueUsers: number;
  ad: number;
  popup: number;
  notification: number;
  redirect: number;
  visit: number;
  request: number;
};

export async function aggregateEventStats(
  accessWhere: SQL | undefined,
  filters: EventsDashboardFilters
): Promise<EventStatsRow | undefined> {
  const where = eventsFiltersWhere(accessWhere, filters);
  const q = db
    .select({
      total: sql<number>`count(*)::int`,
      uniqueUsers: sql<number>`count(distinct ${enduserEvents.endUserId})::int`,
      ad: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'ad' then 1 else 0 end), 0)::int`,
      popup: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'popup' then 1 else 0 end), 0)::int`,
      notification: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'notification' then 1 else 0 end), 0)::int`,
      redirect: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'redirect' then 1 else 0 end), 0)::int`,
      visit: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'visit' then 1 else 0 end), 0)::int`,
      request: sql<number>`coalesce(sum(case when ${enduserEvents.type} = 'request' then 1 else 0 end), 0)::int`,
    })
    .from(enduserEvents);
  const rows = where ? await q.where(where) : await q;
  return rows[0] as EventStatsRow | undefined;
}

export async function countEvents(
  accessWhere: SQL | undefined,
  filters: EventsDashboardFilters
): Promise<number> {
  const where = eventsFiltersWhere(accessWhere, filters);
  const q = db.select({ count: sql<number>`count(*)::int` }).from(enduserEvents);
  const rows = where ? await q.where(where) : await q;
  return Number(rows[0]?.count ?? 0);
}

export type EventLogRow = {
  id: string;
  endUserId: string;
  campaignId: string | null;
  domain: string | null;
  type: string;
  country: string | null;
  userAgent: string | null;
  statusCode: number | null;
  createdAt: Date;
};

export async function listEventsPage(
  accessWhere: SQL | undefined,
  filters: EventsDashboardFilters,
  opts: { limit: number; offset: number }
): Promise<EventLogRow[]> {
  const where = eventsFiltersWhere(accessWhere, filters);
  const base = db
    .select({
      id: enduserEvents.id,
      endUserId: enduserEvents.endUserId,
      campaignId: enduserEvents.campaignId,
      domain: enduserEvents.domain,
      type: enduserEvents.type,
      country: enduserEvents.country,
      userAgent: enduserEvents.userAgent,
      statusCode: enduserEvents.statusCode,
      createdAt: enduserEvents.createdAt,
    })
    .from(enduserEvents);
  const filtered = where ? base.where(where) : base;
  return (await filtered
    .orderBy(desc(enduserEvents.createdAt))
    .limit(opts.limit)
    .offset(opts.offset)) as EventLogRow[];
}

export async function listEventsForExport(
  accessWhere: SQL | undefined,
  filters: EventsDashboardFilters
): Promise<EventLogRow[]> {
  const where = eventsFiltersWhere(accessWhere, filters);
  const base = db
    .select({
      id: enduserEvents.id,
      endUserId: enduserEvents.endUserId,
      campaignId: enduserEvents.campaignId,
      domain: enduserEvents.domain,
      type: enduserEvents.type,
      country: enduserEvents.country,
      userAgent: enduserEvents.userAgent,
      statusCode: enduserEvents.statusCode,
      createdAt: enduserEvents.createdAt,
    })
    .from(enduserEvents);
  const filtered = where ? base.where(where) : base;
  return (await filtered.orderBy(desc(enduserEvents.createdAt))) as EventLogRow[];
}

/** URL params for pagination / export. */
export function eventsFilterParamsRecord(filters: EventsDashboardFilters): Record<string, string> {
  const o: Record<string, string> = {};
  if (filters.type) o.type = filters.type;
  if (filters.from) o.from = filters.from;
  if (filters.to) o.to = filters.to;
  if (filters.domain) o.domain = filters.domain;
  if (filters.country) o.country = filters.country;
  if (filters.endUserId) o.endUserId = filters.endUserId;
  if (filters.campaignId) o.campaignId = filters.campaignId;
  return o;
}

export function eventsToCsvLines(rows: EventLogRow[]): string[] {
  const header = [
    'id',
    'endUserId',
    'campaignId',
    'domain',
    'type',
    'country',
    'userAgent',
    'statusCode',
    'createdAt',
  ];
  const lines = [header.map(escapeCsvCell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.endUserId,
        r.campaignId ?? '',
        r.domain ?? '',
        r.type,
        r.country ?? '',
        r.userAgent ?? '',
        r.statusCode != null ? String(r.statusCode) : '',
        r.createdAt.toISOString(),
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  return lines;
}
