'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { IconFilter } from '@tabler/icons-react';
import type { PaymentStatusFilter } from '@/lib/payments-types';

const ALL_STATUS_VALUE = '__all_status__';

interface PaymentsFiltersProps {
  q?: string;
  status?: PaymentStatusFilter;
}

export function PaymentsFilters({ q, status }: PaymentsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [qValue, setQValue] = useState(q ?? '');
  const [statusValue, setStatusValue] = useState(status ?? ALL_STATUS_VALUE);

  useEffect(() => {
    queueMicrotask(() => setQValue(q ?? ''));
  }, [q]);

  useEffect(() => {
    queueMicrotask(() => setStatusValue(status ?? ALL_STATUS_VALUE));
  }, [status]);

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      });
      params.delete('page');
      router.push(`/payments?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const st =
      statusValue === 'pending' ||
      statusValue === 'completed' ||
      statusValue === 'failed' ||
      statusValue === 'refunded'
        ? statusValue
        : undefined;
    updateFilters({
      q: qValue.trim() || undefined,
      status: st,
    });
  };

  const handleClear = () => {
    setQValue('');
    setStatusValue(ALL_STATUS_VALUE);
    router.push('/payments');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFilter className="h-4 w-4" />
          Filters
        </CardTitle>
        <CardDescription>Search by user email, name, or payment ID; filter by payment status.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="payments-q">Search</Label>
              <Input
                id="payments-q"
                name="q"
                type="text"
                placeholder="Email, name, or payment ID"
                value={qValue}
                onChange={(e) => setQValue(e.target.value)}
                className="w-full text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payments-filter-status">Status</Label>
              <Select value={statusValue} onValueChange={setStatusValue}>
                <SelectTrigger id="payments-filter-status" className="w-full">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_STATUS_VALUE}>All statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Apply</Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
