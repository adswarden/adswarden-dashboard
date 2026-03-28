"use client"

import { cn } from "@/lib/utils"
import { pad2 } from "@/lib/datetime-local-format"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

function parseHm(value: string): { hour: number; minute: number } | null {
  if (!value || !value.includes(":")) return null
  const [a, b] = value.split(":").map((x) => parseInt(x, 10))
  const hour = Number.isFinite(a) ? Math.min(23, Math.max(0, a)) : 0
  const minute = Number.isFinite(b) ? Math.min(59, Math.max(0, b)) : 0
  return { hour, minute }
}

function formatHm(hour: number, minute: number): string {
  return `${pad2(hour)}:${pad2(minute)}`
}

const triggerTimeClass =
  "h-9 w-[4.5rem] font-mono tabular-nums data-[placeholder]:text-foreground/60 dark:data-[placeholder]:text-foreground/65"

export interface TimeSelectProps {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
}

export function TimeSelect({ id, value, onChange, disabled, className }: TimeSelectProps) {
  const parsed = parseHm(value)
  const hour = parsed?.hour ?? null
  const minute = parsed?.minute ?? null

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <Select
        value={hour === null ? undefined : String(hour)}
        onValueChange={(v) => {
          const h = parseInt(v, 10)
          const m = minute ?? 0
          onChange(formatHm(h, m))
        }}
        disabled={disabled}
      >
        <SelectTrigger id={id} className={triggerTimeClass} aria-label="Hour">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent className="max-h-60 border-input">
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {pad2(h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-foreground/60">:</span>
      <Select
        value={minute === null ? undefined : String(minute)}
        onValueChange={(v) => {
          const m = parseInt(v, 10)
          const h = hour ?? 0
          onChange(formatHm(h, m))
        }}
        disabled={disabled}
      >
        <SelectTrigger className={triggerTimeClass} aria-label="Minute">
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent className="max-h-60 border-input">
          {MINUTES.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {pad2(m)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
