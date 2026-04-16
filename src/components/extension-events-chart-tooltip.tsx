"use client"

import { Pie, PieChart, Cell } from "recharts"
import { useTheme } from "next-themes"
import type { TooltipProps } from "recharts"
import { cn } from "@/lib/utils"
import type { ChartConfig } from "@/components/ui/chart"
import {
  extensionEventPieSegments,
  extensionEventLegendSegments,
  extensionEventRowTotal,
  extensionEventsChartConfig,
  formatExtensionChartTooltipDate,
  type ExtensionEventChartRow,
  resolveExtensionEventColor,
} from "@/lib/extension-events-chart"

const tooltipShell = "border-border/50 bg-background rounded-lg border px-3 py-2.5 text-xs shadow-xl"

export function ExtensionEventsChartTooltip({
  active,
  payload,
  label,
  config = extensionEventsChartConfig,
}: TooltipProps<number, string> & { config?: ChartConfig }) {
  const { resolvedTheme } = useTheme()

  if (!active || !payload?.length) {
    return null
  }

  const raw = payload[0]?.payload
  if (!raw || typeof (raw as ExtensionEventChartRow).date !== "string") {
    return null
  }
  const row = raw as ExtensionEventChartRow

  const total = extensionEventRowTotal(row)
  const dateHeading = formatExtensionChartTooltipDate(label, row.date)

  if (total <= 0) {
    return (
      <div className={cn(tooltipShell)}>
        <p className="font-medium text-foreground leading-tight">{dateHeading}</p>
        <p className="mt-1 text-muted-foreground">No events this day.</p>
      </div>
    )
  }

  const pieSegments = extensionEventPieSegments(row, config)
  const legendSegments = extensionEventLegendSegments(row, config)

  return (
    <div className={cn(tooltipShell, "grid max-w-[220px] gap-3")}>
      <div className="space-y-0.5">
        <p className="font-medium text-foreground leading-tight">{dateHeading}</p>
        <p className="tabular-nums text-muted-foreground">{total.toLocaleString()} events total</p>
      </div>

      <div className="flex justify-center">
        <PieChart width={112} height={112} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Pie
            data={pieSegments}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={48}
            strokeWidth={1}
            stroke="var(--background)"
            isAnimationActive={false}
          >
            {pieSegments.map((s) => (
              <Cell
                key={s.key}
                fill={resolveExtensionEventColor(s.key, resolvedTheme, config)}
              />
            ))}
          </Pie>
        </PieChart>
      </div>

      <ul className="grid gap-1.5 border-t border-border/50 pt-2" aria-label="Event counts by type">
        {legendSegments.map((s) => (
          <li
            key={s.key}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 text-[11px] leading-tight"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                backgroundColor: resolveExtensionEventColor(s.key, resolvedTheme, config),
              }}
              aria-hidden
            />
            <span className="min-w-0 truncate text-muted-foreground">{s.name}</span>
            <span className="shrink-0 tabular-nums font-medium text-foreground">
              {s.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
