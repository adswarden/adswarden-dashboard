"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { inputFieldSurfaceClassName } from "@/lib/input-field-surface"
import {
  formatDatetimeLocalValue,
  parseDatetimeLocalValue,
  pad2,
} from "@/lib/datetime-local-format"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const MINUTES = Array.from({ length: 60 }, (_, i) => i)

export interface DateTimePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  className?: string
  allowClear?: boolean
}

export function DateTimePicker({
  id,
  value,
  onChange,
  disabled,
  placeholder = "Pick date & time",
  className,
  allowClear = false,
}: DateTimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [timeZone, setTimeZone] = React.useState<string | undefined>(undefined)

  React.useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
  }, [])

  const { date, hour, minute } = parseDatetimeLocalValue(value)

  const displayLabel = React.useMemo(() => {
    if (!value.trim()) return null
    const full = new Date(value)
    if (Number.isNaN(full.getTime())) return null
    try {
      return format(full, "MMM d, yyyy h:mm a")
    } catch {
      return value
    }
  }, [value])

  const setParts = React.useCallback(
    (nextDate: Date | undefined, nextHour: number, nextMinute: number) => {
      if (!nextDate) {
        onChange("")
        return
      }
      onChange(formatDatetimeLocalValue(nextDate, nextHour, nextMinute))
    },
    [onChange]
  )

  const ensureDate = React.useCallback(() => {
    if (date) return date
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), today.getDate())
  }, [date])

  const hasValue = Boolean(displayLabel)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          className={inputFieldSurfaceClassName(
            cn(
              "inline-flex cursor-pointer items-center gap-2 text-left font-normal",
              hasValue ? "text-foreground" : "text-muted-foreground",
              className
            )
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate">{displayLabel ?? placeholder}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 pb-0">
          <Calendar
            mode="single"
            selected={date}
            timeZone={timeZone}
            defaultMonth={date ?? new Date()}
            onSelect={(d) => {
              if (!d) return
              setParts(d, hour, minute)
            }}
            initialFocus
          />
        </div>

        <div className="border-t bg-card px-4 py-3">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Time</label>
            <div className="flex flex-1 items-center gap-1.5">
              <Select
                value={String(hour)}
                onValueChange={(v) => {
                  const h = parseInt(v, 10)
                  setParts(ensureDate(), h, minute)
                }}
                disabled={disabled}
              >
                <SelectTrigger
                  className="h-9 w-[4.5rem] font-mono tabular-nums"
                  aria-label="Hour"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {pad2(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">:</span>
              <Select
                value={String(minute)}
                onValueChange={(v) => {
                  const m = parseInt(v, 10)
                  setParts(ensureDate(), hour, m)
                }}
                disabled={disabled}
              >
                <SelectTrigger
                  className="h-9 w-[4.5rem] font-mono tabular-nums"
                  aria-label="Minute"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {pad2(m)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Clock2Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </div>
          {allowClear && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
                disabled={disabled}
                onClick={() => {
                  onChange("")
                  setOpen(false)
                }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
