"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { ExtensionEventsChartTooltip } from "@/components/extension-events-chart-tooltip"
import {
  extensionEventChartAllZeros,
  extensionEventsChartConfig,
  type ExtensionEventChartRow,
} from "@/lib/extension-events-chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

function formatYAxisTick(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return "0"
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (abs >= 10_000) return `${Math.round(n / 1_000)}k`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(Math.round(n))
}

/** Even integer ticks that hug the data closely (~3% headroom, 4-5 ticks). */
function niceYAxisTicks(stackMax: number): number[] {
  if (!Number.isFinite(stackMax) || stackMax <= 0) return [0]
  const ceil = Math.ceil(stackMax * 1.03)
  const candidates = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000]
  let step = 1
  for (const c of candidates) {
    if (Math.ceil(ceil / c) <= 5) { step = c; break }
  }
  if (step === 1 && ceil > 50000) step = Math.ceil(ceil / 5 / 1000) * 1000
  const top = Math.ceil(ceil / step) * step
  const ticks: number[] = []
  for (let v = 0; v <= top; v += step) ticks.push(v)
  return ticks
}

const rangeLabels: Record<string, string> = {
  "90d": "Last 3 months",
  "30d": "Last 30 days",
  "7d": "Last 7 days",
}

export interface ChartAreaInteractiveProps {
  className?: string
}

export function ChartAreaInteractive({ className }: ChartAreaInteractiveProps) {
  const [mounted, setMounted] = React.useState(false)
  const [timeRange, setTimeRange] = React.useState("7d")

  const [chartData, setChartData] = React.useState<ExtensionEventChartRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [retryKey, setRetryKey] = React.useState(0)

  React.useEffect(() => setMounted(true), [])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/events/chart?range=${timeRange}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch chart data")
        return res.json()
      })
      .then((data: ExtensionEventChartRow[]) => {
        if (!cancelled) {
          setChartData(data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load chart data")
          setChartData([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [timeRange, retryKey])

  const descriptionText = rangeLabels[timeRange] ?? "Last 7 days"

  const singleSeriesMax = React.useMemo(() => {
    if (!chartData.length) return 0
    let max = 0
    for (const row of chartData) {
      for (const v of [row.visit, row.popup, row.notification, row.ad, row.redirect]) {
        if (v > max) max = v
      }
    }
    return max
  }, [chartData])

  const yAxisTicks = React.useMemo(
    () => niceYAxisTicks(singleSeriesMax),
    [singleSeriesMax]
  )
  const yAxisTop = yAxisTicks[yAxisTicks.length - 1] ?? 100

  return (
    <Card
      className={cn(
        "@container/card relative z-0 border-border bg-card/40 py-4 shadow-none",
        className
      )}
    >
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">Extension events</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            <span className="hidden @[540px]/card:block">
              {descriptionText}. Hover for daily totals. Visits have no campaign; other types do.
            </span>
            <span className="@[540px]/card:hidden">{descriptionText} — hover for detail</span>
          </CardDescription>
        </div>
        <div className="flex items-center justify-start sm:justify-end">
          {mounted ? (
            <>
              <ToggleGroup
                type="single"
                value={timeRange}
                onValueChange={(v) => v && setTimeRange(v)}
                variant="outline"
                className="hidden *:data-[slot=toggle-group-item]:!px-4 @[767px]/card:flex"
              >
                <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
                <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
                <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
              </ToggleGroup>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger
                  className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
                  size="sm"
                  aria-label="Select time range"
                >
                  <SelectValue placeholder="Last 7 days" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="90d" className="rounded-lg">
                    Last 3 months
                  </SelectItem>
                  <SelectItem value="30d" className="rounded-lg">
                    Last 30 days
                  </SelectItem>
                  <SelectItem value="7d" className="rounded-lg">
                    Last 7 days
                  </SelectItem>
                </SelectContent>
              </Select>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">
              {rangeLabels[timeRange] ?? "Last 7 days"}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-2 sm:px-6">
        {loading ? (
          <Skeleton className="h-[320px] w-full rounded-lg" />
        ) : error ? (
          <div
            className="flex h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-4 text-center"
            role="alert"
          >
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              Retry
            </Button>
          </div>
        ) : chartData.length === 0 ? (
          <div
            className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            role="status"
          >
            No event data for this period
          </div>
        ) : extensionEventChartAllZeros(chartData) ? (
          <div
            className="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
            role="status"
          >
            No event data for this period
          </div>
        ) : (
          <ChartContainer
            config={extensionEventsChartConfig}
            className="aspect-auto h-[320px] w-full min-h-[280px]"
          >
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillAd" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-ad)" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="var(--color-ad)" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="fillPopup" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-popup)" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="var(--color-popup)" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="fillNotification" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-notification)" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="var(--color-notification)" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="fillRedirect" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-redirect)" stopOpacity={0.85} />
                  <stop offset="95%" stopColor="var(--color-redirect)" stopOpacity={0.08} />
                </linearGradient>
                <linearGradient id="fillVisit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-visit)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--color-visit)" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/60" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                minTickGap={28}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <YAxis
                width={48}
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={formatYAxisTick}
                domain={[0, yAxisTop]}
                ticks={yAxisTicks}
              />
              <ChartTooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1, strokeDasharray: "4 4" }}
                content={<ExtensionEventsChartTooltip />}
              />
              <Area
                dataKey="visit"
                type="monotone"
                strokeWidth={1.5}
                fill="url(#fillVisit)"
                fillOpacity={0.35}
                stroke="var(--color-visit)"
              />
              <Area
                dataKey="popup"
                type="monotone"
                strokeWidth={1.5}
                fill="url(#fillPopup)"
                fillOpacity={0.35}
                stroke="var(--color-popup)"
              />
              <Area
                dataKey="notification"
                type="monotone"
                strokeWidth={1.5}
                fill="url(#fillNotification)"
                fillOpacity={0.35}
                stroke="var(--color-notification)"
              />
              <Area
                dataKey="ad"
                type="monotone"
                strokeWidth={1.5}
                fill="url(#fillAd)"
                fillOpacity={0.35}
                stroke="var(--color-ad)"
              />
              <Area
                dataKey="redirect"
                type="monotone"
                strokeWidth={1.5}
                fill="url(#fillRedirect)"
                fillOpacity={0.35}
                stroke="var(--color-redirect)"
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
