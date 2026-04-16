"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CopyableIdCell } from "@/components/copyable-id-cell"
import { DateDisplayToggleButton } from "@/components/date-display-toggle-button"
import { ExportEventsCsvButton } from "@/components/export-events-csv-button"
import { HumanReadableDate } from "@/components/human-readable-date"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { TablePagination } from "@/components/ui/table-pagination"
import { getCountryName } from "@/lib/countries"
import { IconChartBar } from "@tabler/icons-react"

const PAGE_SIZE = 25

type EventRow = {
  id: string
  userIdentifier: string
  endUserUuid: string | null
  email: string | null
  plan: "trial" | "paid" | null
  campaignId: string | null
  domain: string | null
  type: string
  country: string | null
  userAgent: string | null
  createdAt: string
}

type ApiResponse = {
  data: EventRow[]
  total: number
  page: number
  pageSize: number
}

const typeColors: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  ad: "default",
  notification: "secondary",
  popup: "outline",
  request: "secondary",
  redirect: "outline",
  visit: "secondary",
}

function eventsDeepLink(endUserUuid: string): string {
  const q = new URLSearchParams({ endUserIdExact: endUserUuid })
  return `/events?${q.toString()}`
}

export type EndUserEventsTimelineProps = {
  endUserId: string
  className?: string
}

export function EndUserEventsTimeline({ endUserId, className }: EndUserEventsTimelineProps) {
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<ApiResponse | null>(null)

  const csvFilterParams = useMemo(() => ({ endUserIdExact: endUserId }), [endUserId])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = `/api/end-users/${encodeURIComponent(endUserId)}/events?page=${page}&pageSize=${PAGE_SIZE}`
      const res = await fetch(u, { credentials: "include" })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? "Could not load events")
      }
      setPayload((await res.json()) as ApiResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load events")
      setPayload(null)
    } finally {
      setLoading(false)
    }
  }, [endUserId, page])

  useEffect(() => {
    void load()
  }, [load])

  const totalPages =
    payload && payload.total > 0 ? Math.ceil(payload.total / payload.pageSize) : 0
  const rows = payload?.data ?? []
  const totalCount = payload?.total ?? 0

  const paginationEl =
    !loading && totalCount > 0 ? (
      <TablePagination
        mode="button"
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        pageSize={payload?.pageSize ?? PAGE_SIZE}
        onPageChange={setPage}
      />
    ) : null

  return (
    <section aria-label="Extension events for this user" className={className}>
      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <IconChartBar className="h-5 w-5 shrink-0" aria-hidden />
              <span className="truncate">
                Event log ({loading ? "…" : totalCount.toLocaleString()})
              </span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Newest first.{" "}
              <Link
                href={eventsDeepLink(endUserId)}
                className="text-primary underline-offset-4 hover:underline"
              >
                Open full Events log
              </Link>{" "}
              for filters and cross-user views.
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            {paginationEl}
            <ExportEventsCsvButton filterParams={csvFilterParams} />
            <DateDisplayToggleButton />
          </div>
        </div>

        {loading && (
          <div className="space-y-2 rounded-lg bg-muted/10 p-4">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-40 w-full rounded-md" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive flex flex-col gap-2">
            <p>{error}</p>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && payload && totalCount === 0 && (
          <div className="rounded-lg bg-muted/10 px-4 py-8 text-center text-sm text-muted-foreground">
            No events recorded for this user yet.
          </div>
        )}

        {!loading && !error && payload && totalCount > 0 && (
          <div className="min-w-0">
            <div className="w-full overflow-x-auto">
              <Table className="w-full table-auto">
                <colgroup>
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "auto" }} />
                  <col style={{ width: "80px" }} />
                  <col style={{ width: "minmax(120px, 1fr)" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "170px" }} />
                </colgroup>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-muted-foreground text-xs font-normal">
                      User identifier
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Email</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Plan</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Campaign</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Domain</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Country</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">User agent</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Type</TableHead>
                    <TableHead className="text-muted-foreground text-xs font-normal">Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="py-2 overflow-hidden">
                        <CopyableIdCell
                          value={log.userIdentifier}
                          truncateLength={12}
                          copyLabel="User identifier copied to clipboard"
                          href={log.endUserUuid ? `/users/${log.endUserUuid}` : undefined}
                        />
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden text-sm">
                        {log.email ? (
                          <span className="truncate block max-w-[180px]" title={log.email}>
                            {log.email}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden text-sm">
                        {log.plan ? (
                          <Badge variant="outline" className="font-normal capitalize">
                            {log.plan}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        {log.campaignId ? (
                          <CopyableIdCell
                            value={log.campaignId}
                            href={`/campaigns/${log.campaignId}`}
                            truncateLength={8}
                            copyLabel="Campaign ID copied to clipboard"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        <span className="truncate block" title={log.domain ?? ""}>
                          {log.domain ?? "—"}
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
                          {log.userAgent ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 overflow-hidden">
                        <Badge variant={typeColors[log.type] ?? "secondary"}>{log.type}</Badge>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-muted-foreground min-w-0">
                        <HumanReadableDate date={new Date(log.createdAt)} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
