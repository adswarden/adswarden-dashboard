/** `YYYY-MM-DDTHH:mm` in local time (same shape as `datetime-local`). */

export function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export function isoOrDateToLocalDatetimeValue(iso: string | Date | null | undefined): string {
  if (!iso) return ""
  const d = typeof iso === "string" ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ""
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export function parseDatetimeLocalValue(value: string): {
  date: Date | undefined
  hour: number
  minute: number
} {
  if (!value.trim()) return { date: undefined, hour: 0, minute: 0 }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: undefined, hour: 0, minute: 0 }
  return {
    date: new Date(d.getFullYear(), d.getMonth(), d.getDate()),
    hour: d.getHours(),
    minute: d.getMinutes(),
  }
}

export function formatDatetimeLocalValue(date: Date, hour: number, minute: number): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(hour)}:${pad2(minute)}`
}

export function localDatetimeToIso(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}
