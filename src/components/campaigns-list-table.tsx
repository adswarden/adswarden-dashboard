'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';

export interface CampaignListRow {
  id: string;
  name: string;
  campaignType: string;
  targetAudience: string;
  frequencyType: string;
  platformIds: string[];
  countryCodes?: string[];
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
}

interface CampaignsListTableProps {
  campaigns: CampaignListRow[];
  isAdmin: boolean;
}

function isWithinInteractiveControl(target: EventTarget | null): boolean {
  const el =
    target instanceof Element
      ? target
      : target instanceof Text
        ? target.parentElement
        : null;
  if (!el) return false;
  return Boolean(
    el.closest('a[href], button, input, select, textarea, [role="button"], [role="link"]')
  );
}

export function CampaignsListTable({ campaigns, isAdmin }: CampaignsListTableProps) {
  const router = useRouter();

  const goToCampaign = React.useCallback(
    (id: string) => {
      router.push(`/campaigns/${id}`);
    },
    [router]
  );

  return (
    <div className="relative z-0 rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Frequency</TableHead>
            <TableHead>Targets</TableHead>
            {isAdmin && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={isAdmin ? 6 : 5}
                className="text-center py-8 text-muted-foreground"
              >
                No campaigns yet. {isAdmin && 'Create your first campaign.'}
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((c) => (
              <TableRow
                key={c.id}
                className="cursor-pointer"
                tabIndex={0}
                aria-label={`Open campaign ${c.name}`}
                onClick={(e) => {
                  if (isWithinInteractiveControl(e.target)) return;
                  goToCampaign(c.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToCampaign(c.id);
                  }
                }}
              >
                <TableCell className="font-medium">
                  <Link href={`/campaigns/${c.id}`} className="hover:underline underline-offset-4">
                    {c.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{c.campaignType}</Badge>
                </TableCell>
                <TableCell>{c.targetAudience === 'new_users' ? 'New users' : 'All users'}</TableCell>
                <TableCell>{c.frequencyType.replace(/_/g, ' ')}</TableCell>
                <TableCell>
                  <span className="text-muted-foreground text-sm">
                    {(c.campaignType === 'notification' || c.campaignType === 'redirect') &&
                    (c.platformIds?.length ?? 0) === 0
                      ? 'All platforms'
                      : `${c.platformIds?.length ?? 0} platforms`}
                    {(c.countryCodes?.length ?? 0) > 0
                      ? ` · ${c.countryCodes!.length} countries`
                      : ' · All countries'}
                    {(c.campaignType === 'ads' || c.campaignType === 'popup') && (c.adId ? ' · 1 ad' : '')}
                    {c.campaignType === 'notification' && (c.notificationId ? ' · 1 notification' : '')}
                    {c.campaignType === 'redirect' && (c.redirectId ? ' · 1 redirect' : '')}
                  </span>
                </TableCell>
                {isAdmin && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/campaigns/${c.id}/edit`}>
                          <IconPencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      <DeleteButton
                        name={c.name}
                        entityType="campaign"
                        apiPath={`/api/campaigns/${c.id}`}
                      />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
