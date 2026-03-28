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

const ALL_TYPES = '__all_types__';

export type EventsFiltersProps = {
  type?: string;
  from?: string;
  to?: string;
  domain?: string;
  country?: string;
  endUserId?: string;
  campaignId?: string;
};

export function EventsFilters({
  type,
  from,
  to,
  domain,
  country,
  endUserId,
  campaignId,
}: EventsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [typeValue, setTypeValue] = useState(type ?? ALL_TYPES);
  const [fromValue, setFromValue] = useState(from ?? '');
  const [toValue, setToValue] = useState(to ?? '');
  const [domainValue, setDomainValue] = useState(domain ?? '');
  const [countryValue, setCountryValue] = useState(country ?? '');
  const [endUserIdValue, setEndUserIdValue] = useState(endUserId ?? '');
  const [campaignIdValue, setCampaignIdValue] = useState(campaignId ?? '');

  useEffect(() => {
    queueMicrotask(() => setTypeValue(type ?? ALL_TYPES));
  }, [type]);

  useEffect(() => {
    queueMicrotask(() => {
      setFromValue(from ?? '');
      setToValue(to ?? '');
      setDomainValue(domain ?? '');
      setCountryValue(country ?? '');
      setEndUserIdValue(endUserId ?? '');
      setCampaignIdValue(campaignId ?? '');
    });
  }, [from, to, domain, country, endUserId, campaignId]);

  const updateFilters = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value) params.set(key, value);
        else params.delete(key);
      });
      params.delete('page');
      router.push(`/events?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const t =
      typeValue === 'ad' ||
      typeValue === 'notification' ||
      typeValue === 'popup' ||
      typeValue === 'request' ||
      typeValue === 'redirect' ||
      typeValue === 'visit'
        ? typeValue
        : undefined;
    updateFilters({
      type: t,
      from: fromValue.trim() || undefined,
      to: toValue.trim() || undefined,
      domain: domainValue.trim() || undefined,
      country: countryValue.trim().toUpperCase().slice(0, 2) || undefined,
      endUserId: endUserIdValue.trim() || undefined,
      campaignId: campaignIdValue.trim() || undefined,
    });
  };

  const handleClear = () => {
    setTypeValue(ALL_TYPES);
    setFromValue('');
    setToValue('');
    setDomainValue('');
    setCountryValue('');
    setEndUserIdValue('');
    setCampaignIdValue('');
    router.push('/events');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <IconFilter className="h-4 w-4" aria-hidden />
          Filters
        </CardTitle>
        <CardDescription>
          Narrow the event log and exported CSV. Stats (when loaded) use the same filters. Clearing
          filters resets the URL.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="events-type">Event type</Label>
              <Select value={typeValue} onValueChange={setTypeValue}>
                <SelectTrigger id="events-type" className="w-full">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_TYPES}>All types</SelectItem>
                  <SelectItem value="ad">Ad</SelectItem>
                  <SelectItem value="popup">Popup</SelectItem>
                  <SelectItem value="notification">Notification</SelectItem>
                  <SelectItem value="redirect">Redirect</SelectItem>
                  <SelectItem value="visit">Visit</SelectItem>
                  <SelectItem value="request">Request</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="events-from">Created from (ISO or datetime-local)</Label>
              <Input
                id="events-from"
                name="from"
                type="text"
                placeholder="e.g. 2025-01-01 or 2025-01-01T00:00"
                value={fromValue}
                onChange={(e) => setFromValue(e.target.value)}
                className="w-full text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="events-to">Created to</Label>
              <Input
                id="events-to"
                name="to"
                type="text"
                placeholder="e.g. 2025-12-31"
                value={toValue}
                onChange={(e) => setToValue(e.target.value)}
                className="w-full text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="events-domain">Domain contains</Label>
              <Input
                id="events-domain"
                name="domain"
                type="text"
                placeholder="example.com"
                value={domainValue}
                onChange={(e) => setDomainValue(e.target.value)}
                className="w-full text-sm"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="events-country">Country (ISO-2)</Label>
              <Input
                id="events-country"
                name="country"
                type="text"
                maxLength={2}
                placeholder="US"
                value={countryValue}
                onChange={(e) => setCountryValue(e.target.value.toUpperCase())}
                className="w-full text-sm uppercase"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="events-enduser">End-user ID contains</Label>
              <Input
                id="events-enduser"
                name="endUserId"
                type="text"
                placeholder="Partial installation id"
                value={endUserIdValue}
                onChange={(e) => setEndUserIdValue(e.target.value)}
                className="w-full text-sm font-mono"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="events-campaign">Campaign ID (UUID)</Label>
              <Input
                id="events-campaign"
                name="campaignId"
                type="text"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={campaignIdValue}
                onChange={(e) => setCampaignIdValue(e.target.value)}
                className="w-full text-sm font-mono"
                autoComplete="off"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="outline" onClick={handleClear}>
              Clear all
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
