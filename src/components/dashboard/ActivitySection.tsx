'use client';

import { ActivityChart } from './ActivityChart';
import { cn } from '@/lib/utils';

interface ActivitySectionProps {
  chartData: { date: string; impressions: number; users: number }[];
  loading?: boolean;
  showTitle?: boolean;
  titleClassName?: string;
  showChartOnly?: boolean;
  analyticsPeriod?: { from: string; to: string } | null;
}

function formatPeriodCaption(period: { from: string; to: string }): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const from = new Date(`${period.from}T00:00:00.000Z`);
  const to = new Date(`${period.to}T00:00:00.000Z`);
  return `${from.toLocaleDateString('en-US', opts)} – ${to.toLocaleDateString('en-US', opts)}`;
}

export function ActivitySection({
  chartData,
  loading = false,
  showTitle = true,
  titleClassName,
  showChartOnly = false,
  analyticsPeriod = null,
}: ActivitySectionProps) {
  if (showChartOnly) {
    return <ActivityChart data={chartData} loading={loading} error={null} />;
  }

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-3"
      aria-labelledby={showTitle ? 'campaign-activity-heading' : undefined}
      aria-label={showTitle ? undefined : 'Campaign activity'}
    >
      <div className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex flex-col gap-0.5">
          {showTitle && (
            <h2
              id="campaign-activity-heading"
              className={cn('text-sm font-medium text-muted-foreground', titleClassName)}
            >
              Activity
            </h2>
          )}
          <p className="text-xs text-muted-foreground/50">
            Events &amp; unique users per day
          </p>
        </div>
        {analyticsPeriod ? (
          <p className="text-xs tabular-nums text-muted-foreground/70 sm:text-right">
            {formatPeriodCaption(analyticsPeriod)}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ActivityChart data={chartData} loading={loading} error={null} fillHeight />
      </div>
    </section>
  );
}
