import { cn } from "@/lib/utils"

/**
 * Shared visual shell for controls that should match {@link @/components/ui/input}.
 * Keeps date/time triggers aligned with text inputs (border, bg, focus ring).
 */
export const INPUT_FIELD_SURFACE =
  "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm dark:bg-input/30 dark:border-white/18"

export const INPUT_FIELD_FOCUS =
  "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"

export const INPUT_FIELD_DISABLED =
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"

export function inputFieldSurfaceClassName(extra?: string) {
  return cn(INPUT_FIELD_SURFACE, INPUT_FIELD_FOCUS, INPUT_FIELD_DISABLED, extra)
}
