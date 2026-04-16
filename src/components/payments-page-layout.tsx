'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { IconFilter } from '@tabler/icons-react';

interface PaymentsPageLayoutProps {
  filterContent: React.ReactNode;
  children: React.ReactNode;
}

export function PaymentsPageLayout({ filterContent, children }: PaymentsPageLayoutProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-row items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight min-w-0">Payments</h1>
          <Button
            type="button"
            variant={showFilters ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="shrink-0 motion-reduce:transition-none"
            aria-expanded={showFilters}
            aria-controls="payments-filters-panel"
          >
            <IconFilter className="h-4 w-4 mr-2" aria-hidden="true" />
            {showFilters ? 'Hide filters' : 'Filters'}
          </Button>
        </div>
        <p className="text-sm text-muted-foreground leading-snug">Revenue and payment history.</p>
      </header>

      <div
        id="payments-filters-panel"
        className="grid motion-safe:transition-[grid-template-rows] motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: showFilters ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden min-h-0">
          <div
            className="motion-safe:transition-opacity motion-safe:duration-300 motion-safe:ease-out motion-reduce:transition-none"
            style={{ opacity: showFilters ? 1 : 0 }}
            aria-hidden={!showFilters}
            inert={!showFilters ? true : undefined}
          >
            {filterContent}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
