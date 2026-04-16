'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { IconDownload, IconLoader2 } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExportPaymentsCsvButtonProps {
  filterParams: Record<string, string>;
  className?: string;
}

export function ExportPaymentsCsvButton({ filterParams, className }: ExportPaymentsCsvButtonProps) {
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    const params = new URLSearchParams(filterParams);
    const qs = params.toString();
    const url = qs ? `/api/payments/export?${qs}` : '/api/payments/export';
    setLoading(true);
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        toast.error('Could not export payments. Try signing in again.');
        return;
      }
      const cd = res.headers.get('Content-Disposition');
      let filename = 'payments.csv';
      if (cd) {
        const m = /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"|filename=([^;\n]+)/i.exec(cd);
        const raw = m?.[1] ?? m?.[2] ?? m?.[3];
        if (raw) {
          filename = decodeURIComponent(raw.replace(/^"|"$/g, '').trim());
        }
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } finally {
      setLoading(false);
    }
  }, [filterParams]);

  const trigger = (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      disabled={loading}
      onClick={onClick}
      aria-label="Export payments as CSV"
      className={cn(
        'cursor-pointer h-8 w-8 motion-safe:transition-transform motion-safe:hover:scale-105 motion-safe:active:scale-95 motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
        className
      )}
    >
      {loading ? (
        <IconLoader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <IconDownload className="h-4 w-4" aria-hidden />
      )}
    </Button>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {loading ? <span className="inline-flex">{trigger}</span> : trigger}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        {loading ? 'Exporting…' : 'Download payments as CSV (current filters)'}
      </TooltipContent>
    </Tooltip>
  );
}
