import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Escape `%`, `_`, `\` for safe use inside SQL `ILIKE` patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")
}

/** RFC-style CSV field quoting when the value contains comma, quote, or newline. */
export function escapeCsvCell(val: string): string {
  if (/[",\n\r]/.test(val)) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

/**
 * Fixed locale + UTC so SSR and browser produce the same string (avoids hydration mismatch).
 * Use for timestamps shown in client components that render on the server.
 */
export function formatDateTimeUtcEnGb(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
}
