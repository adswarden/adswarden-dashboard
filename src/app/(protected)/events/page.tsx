import { CopyableIdCell } from '@/components/copyable-id-cell';
import { EventsFilters } from '@/components/events-filters';
import { EventsPageLayout } from '@/components/events-page-layout';
import { ExportEventsCsvButton } from '@/components/export-events-csv-button';
import { RefreshDataButton } from '@/components/refresh-data-button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import { getSessionWithRole } from '@/lib/dal';
import {
  aggregateEventStats,
  endEventsAccessWhere,
  eventsFilterParamsRecord,
  listEventsPage,
  parseEventsDashboardFilters,
  type EventStatsRow,
} from '@/lib/events-dashboard';
import { getCountryName } from '@/lib/countries';
import {
  IconAd2,
  IconBell,
  IconChartBar,
  IconRoute,
  IconWebhook,
  IconWindow,
  IconWorld,
} from '@tabler/icons-react';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 25;

const typeColors: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  ad: 'default',
  notification: 'secondary',
  popup: 'outline',
  request: 'secondary',
  redirect: 'outline',
  visit: 'secondary',
};

const typeKpiConfig: {
  key: keyof Pick<
    EventStatsRow,
    'ad' | 'popup' | 'notification' | 'redirect' | 'visit' | 'request'
  >;
  label: string;
  icon: typeof IconAd2;
}[] = [
  { key: 'ad', label: 'Ad', icon: IconAd2 },
  { key: 'popup', label: 'Popup', icon: IconWindow },
  { key: 'notification', label: 'Notification', icon: IconBell },
  { key: 'redirect', label: 'Redirect', icon: IconRoute },
  { key: 'visit', label: 'Visit', icon: IconWorld },
  { key: 'request', label: 'Request', icon: IconWebhook },
];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function EventsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await getSessionWithRole();
  if (!session) redirect('/login');

  const raw = await searchParams;
  const filters = parseEventsDashboardFilters(raw);
  const pageParam = raw.page;
  const pageStr =
    typeof pageParam === 'string' ? pageParam : Array.isArray(pageParam) ? pageParam[0] : '1';
  const page = Math.max(1, parseInt(pageStr ?? '1', 10));
  const offset = (page - 1) * PAGE_SIZE;

  const accessWhere = endEventsAccessWhere(session.role, session.user.id);
  const filterRecord = eventsFilterParamsRecord(filters);

  const [stats, pageRows] = await Promise.all([
    aggregateEventStats(accessWhere, filters),
    listEventsPage(accessWhere, filters, { limit: PAGE_SIZE, offset }),
  ]);

  const totalCount = Number(stats?.total ?? 0);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const paginationEl =
    totalCount > 0 ? (
      <TablePagination
        mode="link"
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={PAGE_SIZE}
        basePath="/events"
        filterParams={filterRecord}
      />
    ) : null;

  const statusSection = (
    <section aria-label="Event totals and counts by type" className="space-y-3 pt-2">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 rounded-md border bg-muted/20 px-4 py-3 text-sm">
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">{totalCount.toLocaleString()}</span>{' '}
          <span className="text-muted-foreground">total events (filtered)</span>
        </span>
        <span className="text-muted-foreground" aria-hidden>
          ·
        </span>
        <span className="tabular-nums">
          <span className="font-semibold text-foreground">
            {Number(stats?.uniqueUsers ?? 0).toLocaleString()}
          </span>{' '}
          <span className="text-muted-foreground">unique end users (filtered)</span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {typeKpiConfig.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            className="flex flex-col gap-0.5 rounded-md border bg-card px-3 py-2 shadow-sm"
          >
            <div className="flex items-center justify-between gap-1 text-muted-foreground">
              <span className="text-xs leading-tight">{label}</span>
              <Icon className="size-3.5 shrink-0 opacity-70" aria-hidden />
            </div>
            <p className="text-lg font-semibold tabular-nums leading-none text-foreground">
              {Number(stats?.[key] ?? 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <EventsPageLayout
      statusContent={statusSection}
      filterContent={
        <EventsFilters
          type={filters.type}
          from={filters.from}
          to={filters.to}
          domain={filters.domain}
          country={filters.country}
          endUserId={filters.endUserId}
          campaignId={filters.campaignId}
        />
      }
    >
      <section className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <IconChartBar className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">Event log ({totalCount.toLocaleString()})</span>
            </h2>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {paginationEl}
            <ExportEventsCsvButton filterParams={filterRecord} />
            <RefreshDataButton ariaLabel="Refresh events" />
          </div>
        </div>
        <div className="rounded-md border min-w-0">
          <div className="w-full overflow-x-auto">
            <Table className="w-full table-auto">
              <colgroup>
                <col style={{ width: 'auto' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: 'auto' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: 'minmax(120px, 1fr)' }} />
                <col style={{ width: '90px' }} />
                <col style={{ width: '80px' }} />
                <col style={{ width: '170px' }} />
              </colgroup>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    End-user ID
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    Campaign
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    Domain
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    Country
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    User agent
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    Type
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    Status
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-normal">
                    Timestamp
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No events match the current filters. Extension activity will appear here.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="py-2 overflow-hidden">
                        <CopyableIdCell
                          value={log.endUserId}
                          truncateLength={12}
                          copyLabel="End-user ID copied to clipboard"
                        />
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        {log.campaignId ? (
                          <CopyableIdCell
                            value={log.campaignId}
                            truncateLength={8}
                            copyLabel="Campaign ID copied to clipboard"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        <span className="truncate block" title={log.domain ?? ''}>
                          {log.domain}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        {log.country ? (
                          <span title={getCountryName(log.country)} className="uppercase text-sm">
                            {log.country}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden text-sm text-muted-foreground max-w-[220px]">
                        <span
                          className="line-clamp-2 font-mono text-xs"
                          title={log.userAgent ?? undefined}
                        >
                          {log.userAgent ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        <Badge variant={typeColors[log.type] || 'secondary'}>{log.type}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm tabular-nums">
                        {log.statusCode ?? '—'}
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground min-w-0">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>
    </EventsPageLayout>
  );
}
