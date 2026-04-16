import type { ChartConfig } from '@/components/ui/chart';

/**
 * Draw order: largest series first (drawn behind), smallest last (drawn on top).
 * Each area starts from 0 (non-stacked) so the Y-axis reflects actual per-type counts.
 */
export const EXTENSION_EVENT_SERIES_KEYS = [
  'visit',
  'popup',
  'notification',
  'ad',
  'redirect',
] as const;

export type ExtensionEventSeriesKey = (typeof EXTENSION_EVENT_SERIES_KEYS)[number];

export type ExtensionEventChartRow = Record<ExtensionEventSeriesKey, number> & {
  date: string;
};

export const extensionEventsChartConfig = {
  visit: {
    label: 'Visit',
    theme: {
      light: 'oklch(0.52 0.06 265)',
      dark: 'oklch(0.78 0.07 265)',
    },
  },
  notification: {
    label: 'Notification',
    theme: {
      light: 'oklch(0.5 0.22 303)',
      dark: 'oklch(0.74 0.2 303)',
    },
  },
  ad: {
    label: 'Ad',
    theme: {
      light: 'oklch(0.48 0.14 210)',
      dark: 'oklch(0.76 0.14 210)',
    },
  },
  popup: {
    label: 'Popup',
    theme: {
      light: 'oklch(0.55 0.17 55)',
      dark: 'oklch(0.82 0.16 55)',
    },
  },
  redirect: {
    label: 'Redirect',
    theme: {
      light: 'oklch(0.48 0.14 155)',
      dark: 'oklch(0.74 0.14 155)',
    },
  },
} satisfies ChartConfig;

export function resolveExtensionEventColor(
  key: ExtensionEventSeriesKey,
  resolvedTheme: string | undefined,
  config: ChartConfig = extensionEventsChartConfig
): string {
  const entry = config[key];
  if (!entry) return 'var(--muted-foreground)';
  if ('theme' in entry && entry.theme) {
    return resolvedTheme === 'dark' ? entry.theme.dark : entry.theme.light;
  }
  if ('color' in entry && entry.color) return entry.color;
  return 'var(--muted-foreground)';
}

export type ExtensionEventSegment = { key: ExtensionEventSeriesKey; name: string; value: number };

/**
 * Pie segments for a single day. Returned in **descending count** for the pie
 * (largest slice first). Use `extensionEventLegendSegments` for the tooltip
 * legend which keeps area-chart stack order instead.
 */
export function extensionEventPieSegments(
  row: ExtensionEventChartRow,
  config: ChartConfig = extensionEventsChartConfig
): ExtensionEventSegment[] {
  return EXTENSION_EVENT_SERIES_KEYS.map((key) => ({
    key,
    name: String(config[key]?.label ?? key),
    value: Number(row[key]) || 0,
  }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

/** Segments sorted by descending count (highest at top) for the tooltip legend. */
export function extensionEventLegendSegments(
  row: ExtensionEventChartRow,
  config: ChartConfig = extensionEventsChartConfig
): ExtensionEventSegment[] {
  return EXTENSION_EVENT_SERIES_KEYS.map((key) => ({
    key,
    name: String(config[key]?.label ?? key),
    value: Number(row[key]) || 0,
  }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);
}

export function extensionEventRowTotal(row: ExtensionEventChartRow): number {
  return EXTENSION_EVENT_SERIES_KEYS.reduce((sum, key) => sum + (Number(row[key]) || 0), 0);
}

export function extensionEventChartAllZeros(rows: ExtensionEventChartRow[]): boolean {
  if (rows.length === 0) return false;
  return rows.every((d) => extensionEventRowTotal(d) === 0);
}

export function formatExtensionChartTooltipDate(label: unknown, fallbackIsoDate: string): string {
  if (label == null) return fallbackIsoDate;
  const d = new Date(String(label));
  if (Number.isNaN(d.getTime())) return String(label);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
