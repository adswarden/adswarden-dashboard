'use client';

import { formatRelative } from 'date-fns';

type HumanReadableDateProps = {
  date: Date;
  className?: string;
};

/**
 * Calendar-relative wording (e.g. “yesterday at 4:30 PM”, “tomorrow at …”) via date-fns.
 * `suppressHydrationWarning`: base time differs between server and client clocks.
 */
export function HumanReadableDate({ date, className }: HumanReadableDateProps) {
  const title = date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <span className={className} title={title} suppressHydrationWarning>
      {formatRelative(date, new Date())}
    </span>
  );
}
