'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { IconLoader2, IconX, IconInfoCircle, IconPlus } from '@tabler/icons-react';
import { toast } from 'sonner';
import { COUNTRIES } from '@/lib/countries';
import { PlatformAddDrawer } from '@/components/platform-add-drawer';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { TimeSelect } from '@/components/ui/time-select';
import { isoOrDateToLocalDatetimeValue } from '@/lib/datetime-local-format';
import type { CampaignFormInitial, CampaignFormOptionLists } from './campaign-form-types';

type CampaignType = 'ads' | 'popup' | 'notification' | 'redirect';
type FrequencyType = 'full_day' | 'time_based' | 'only_once' | 'always' | 'specific_count';
type TargetAudience = 'new_users' | 'all_users';

type CampaignStatus = 'active' | 'inactive' | 'scheduled' | 'expired';

interface CampaignFormProps extends CampaignFormOptionLists {
  campaign?: CampaignFormInitial;
  mode: 'create' | 'edit';
}

/** Groups fields under a labelled region (matches drawer “Details” / resource panels). */
function FormSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3" aria-labelledby={id}>
      <h2
        id={id}
        className="text-xs font-semibold uppercase tracking-wide text-muted-foreground leading-snug"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-md border border-l-4 border-l-primary/50 bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <IconInfoCircle className="h-4 w-4 shrink-0 opacity-70" />
      <span>{children}</span>
    </div>
  );
}

function MultiSelectContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-lg border border-input/80 bg-muted/20 p-3 min-h-12">
      {children}
    </div>
  );
}

export function CampaignForm({
  campaign,
  platforms,
  adsList,
  notificationsList,
  redirectsList,
  mode,
}: CampaignFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(campaign?.name ?? '');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>((campaign?.targetAudience as TargetAudience) ?? 'all_users');
  const [campaignType, setCampaignType] = useState<CampaignType>((campaign?.campaignType as CampaignType) ?? 'ads');
  const handleCampaignTypeChange = (v: CampaignType) => {
    setCampaignType(v);
    if (v === 'notification' || v === 'redirect') setPlatformIds([]);
  };
  const [frequencyType, setFrequencyType] = useState<FrequencyType>((campaign?.frequencyType as FrequencyType) ?? 'always');
  const [frequencyCount, setFrequencyCount] = useState(campaign?.frequencyCount?.toString() ?? '');
  const [timeStart, setTimeStart] = useState(campaign?.timeStart ?? '');
  const [timeEnd, setTimeEnd] = useState(campaign?.timeEnd ?? '');
  const [platformIds, setPlatformIds] = useState<string[]>(campaign?.platformIds ?? []);
  const [countryCodes, setCountryCodes] = useState<string[]>(campaign?.countryCodes ?? []);
  const [adId, setAdId] = useState<string>(campaign?.adId ?? '');
  const [notificationId, setNotificationId] = useState<string>(campaign?.notificationId ?? '');
  const [redirectId, setRedirectId] = useState<string>(campaign?.redirectId ?? '');
  const [status, setStatus] = useState<CampaignStatus>((campaign?.status as CampaignStatus) ?? 'inactive');
  const [startDate, setStartDate] = useState(
    campaign?.startDate ? isoOrDateToLocalDatetimeValue(campaign.startDate) : ''
  );
  const [endDate, setEndDate] = useState(
    campaign?.endDate ? isoOrDateToLocalDatetimeValue(campaign.endDate) : ''
  );
  const [addPlatformDrawerOpen, setAddPlatformDrawerOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation: at least one domain (platform) - not required for notifications

    if (campaignType !== 'notification' && campaignType !== 'redirect' && !platformIds.length) {
      toast.error('Select at least one domain (platform)');
      return;
    }

    // Validation: at least one content item based on campaign type
    if (campaignType === 'ads' || campaignType === 'popup') {
      if (!adId?.trim()) {
        toast.error(`Select an ${campaignType === 'popup' ? 'pop up' : 'ad'}`);
        return;
      }
    } else if (campaignType === 'notification') {
      if (!notificationId?.trim()) {
        toast.error('Select a notification');
        return;
      }
    } else if (campaignType === 'redirect') {
      if (!redirectId?.trim()) {
        toast.error('Select a redirect');
        return;
      }
    }

    setIsLoading(true);
    try {
      const url = mode === 'create' ? '/api/campaigns' : `/api/campaigns/${campaign?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const body = {
        name,
        targetAudience,
        campaignType,
        frequencyType,
        frequencyCount: frequencyCount ? parseInt(frequencyCount, 10) : null,
        timeStart: timeStart || null,
        timeEnd: timeEnd || null,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        platformIds: campaignType === 'notification' || campaignType === 'redirect' ? [] : platformIds,
        countryCodes,
        adId: (campaignType === 'ads' || campaignType === 'popup') ? adId || null : null,
        notificationId: campaignType === 'notification' ? notificationId || null : null,
        redirectId: campaignType === 'redirect' ? redirectId || null : null,
      };
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save campaign');
      toast.success(mode === 'create' ? 'Campaign created' : 'Campaign updated');
      const targetId = mode === 'create' ? data.id : campaign?.id;
      router.push(targetId ? `/campaigns/${targetId}` : '/campaigns');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPlatformCreated = (newPlatform: { id: string; name: string; domain: string }) => {
    setPlatformIds((prev) => [...prev, newPlatform.id]);
    router.refresh();
  };

  return (
    <>
      <Card>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <FormSection id="campaign-form-basic-heading" title="Basic info">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isLoading} />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Target audience</Label>
                    <Select value={targetAudience} onValueChange={(v) => setTargetAudience(v as TargetAudience)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_users">All users</SelectItem>
                        <SelectItem value="new_users">New users (within 7 days)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Campaign type</Label>
                    <Select value={campaignType} onValueChange={(v) => handleCampaignTypeChange(v as CampaignType)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ads">Ads</SelectItem>
                        <SelectItem value="popup">Popup</SelectItem>
                        <SelectItem value="notification">Notification</SelectItem>
                        <SelectItem value="redirect">Redirect</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as CampaignStatus)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </FormSection>

            <Separator />

            <FormSection id="campaign-form-schedule-heading" title="Schedule & frequency">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={frequencyType} onValueChange={(v) => setFrequencyType(v as FrequencyType)}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Always</SelectItem>
                        <SelectItem value="full_day">Full day</SelectItem>
                        <SelectItem value="time_based">Time based</SelectItem>
                        <SelectItem value="only_once">Only once</SelectItem>
                        <SelectItem value="specific_count">Specific count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {frequencyType === 'specific_count' && (
                  <div className="space-y-2 max-w-xs">
                    <Label htmlFor="frequencyCount">Max views per visitor</Label>
                    <Input
                      id="frequencyCount"
                      type="number"
                      min={1}
                      value={frequencyCount}
                      onChange={(e) => setFrequencyCount(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                )}

                {frequencyType === 'time_based' && (
                  <div className="grid grid-cols-2 gap-4 max-w-md">
                    <div className="space-y-2">
                      <Label htmlFor="timeStart">Start time</Label>
                      <TimeSelect
                        id="timeStart"
                        value={timeStart}
                        onChange={setTimeStart}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeEnd">End time</Label>
                      <TimeSelect
                        id="timeEnd"
                        value={timeEnd}
                        onChange={setTimeEnd}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start date & time</Label>
                    <DateTimePicker
                      id="startDate"
                      value={startDate}
                      onChange={setStartDate}
                      disabled={isLoading}
                      placeholder="Pick start date & time"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End date & time</Label>
                    <DateTimePicker
                      id="endDate"
                      value={endDate}
                      onChange={setEndDate}
                      disabled={isLoading}
                      allowClear
                      placeholder="Pick end date & time"
                    />
                  </div>
                </div>
              </div>
            </FormSection>

            <Separator />

            <FormSection id="campaign-form-targeting-heading" title="Targeting">
              <div className="space-y-4">
                {campaignType !== 'notification' && campaignType !== 'redirect' && (
                <div className="space-y-2">
                  <Label>Targeted websites (platforms) *</Label>
                  <MultiSelectContainer>
                    {platformIds.map((id) => {
                      const p = platforms.find((x) => x.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1 py-1.5">
                          {p?.name ?? id}
                          <button type="button" onClick={() => setPlatformIds((prev) => prev.filter((x) => x !== id))} className="rounded-full p-0.5 hover:bg-muted transition-colors" aria-label="Remove">
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    <Select
                      value=""
                      onValueChange={(v) => {
                        if (!v) return;
                        if (v === '__add_new__') {
                          setAddPlatformDrawerOpen(true);
                          return;
                        }
                        if (!platformIds.includes(v)) setPlatformIds((prev) => [...prev, v]);
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-8 border-dashed"><SelectValue placeholder="Add platform" /></SelectTrigger>
                      <SelectContent>
                        {platforms.filter((p) => !platformIds.includes(p.id)).map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                        <SelectItem value="__add_new__" className="text-primary font-medium">
                          <span className="flex items-center gap-2">
                            <IconPlus className="h-4 w-4" />
                            Add new
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </MultiSelectContainer>
                </div>
                )}
                {campaignType === 'notification' && (
                  <InfoHint>Notifications are served everywhere — no domain restriction.</InfoHint>
                )}
                {campaignType === 'redirect' && (
                  <InfoHint>
                    Redirect targeting uses the source domain defined on each redirect — no platform
                    selection here.
                  </InfoHint>
                )}
                <div className="space-y-2">
                  <Label>Countries to serve</Label>
                  <InfoHint>Leave empty to serve in all countries</InfoHint>
                  <MultiSelectContainer>
                    {countryCodes.map((code) => {
                      const country = COUNTRIES.find((c) => c.code === code);
                      return (
                        <Badge key={code} variant="secondary" className="gap-1 pr-1 py-1.5">
                          {country ? `${country.name} (${code})` : code}
                          <button type="button" onClick={() => setCountryCodes((prev) => prev.filter((c) => c !== code))} className="rounded-full p-0.5 hover:bg-muted transition-colors" aria-label="Remove">
                            <IconX className="h-3 w-3" />
                          </button>
                        </Badge>
                      );
                    })}
                    <Select
                      value=""
                      onValueChange={(v) => { if (v && !countryCodes.includes(v)) setCountryCodes((prev) => [...prev, v]); }}
                    >
                      <SelectTrigger className="w-[200px] h-8 border-dashed"><SelectValue placeholder="Add country" /></SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.filter((c) => !countryCodes.includes(c.code)).map((c) => (
                          <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </MultiSelectContainer>
                </div>
              </div>
            </FormSection>

            {(campaignType === 'ads' ||
              campaignType === 'popup' ||
              campaignType === 'notification' ||
              campaignType === 'redirect') && (
              <>
                <Separator />
                <FormSection id="campaign-form-content-heading" title="Content">
                  <div className="space-y-4">
                  {(campaignType === 'ads' || campaignType === 'popup') && (
                    <div className="space-y-2">
                      <Label>{campaignType === 'popup' ? 'Pop up' : 'Ad'} *</Label>
                      <Select value={adId} onValueChange={setAdId}>
                        <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Select ad" /></SelectTrigger>
                        <SelectContent>
                          {adsList.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.name}
                              {a.linkedCampaignCount > 0
                                ? ` (${a.linkedCampaignCount} campaign${a.linkedCampaignCount === 1 ? '' : 's'})`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {campaignType === 'notification' && (
                    <div className="space-y-2">
                      <Label>Notification *</Label>
                      <Select value={notificationId} onValueChange={setNotificationId}>
                        <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Select notification" /></SelectTrigger>
                        <SelectContent>
                          {notificationsList.map((n) => (
                            <SelectItem key={n.id} value={n.id}>
                              {n.title}
                              {n.linkedCampaignCount > 0
                                ? ` (${n.linkedCampaignCount} campaign${n.linkedCampaignCount === 1 ? '' : 's'})`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {campaignType === 'redirect' && (
                    <div className="space-y-2">
                      <Label>Redirect *</Label>
                      <Select value={redirectId} onValueChange={setRedirectId}>
                        <SelectTrigger className="w-full max-w-md"><SelectValue placeholder="Select redirect" /></SelectTrigger>
                        <SelectContent>
                          {redirectsList.map((r) => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.name}
                              {r.linkedCampaignCount > 0
                                ? ` (${r.linkedCampaignCount} campaign${r.linkedCampaignCount === 1 ? '' : 's'})`
                                : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  </div>
                </FormSection>
              </>
            )}

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                {isLoading && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === 'create' ? 'Create campaign' : 'Save changes'}
              </Button>
              <Link
                href={mode === 'edit' && campaign?.id ? `/campaigns/${campaign.id}` : '/campaigns'}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground sm:text-right"
              >
                {mode === 'edit' ? 'Back to campaign' : 'Cancel'}
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
      <PlatformAddDrawer
        open={addPlatformDrawerOpen}
        onOpenChange={setAddPlatformDrawerOpen}
        onSuccess={handleNewPlatformCreated}
      />
    </>
  );
}
