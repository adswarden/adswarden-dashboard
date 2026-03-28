'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { IconPlus, IconPencil } from '@tabler/icons-react';
import { DeleteButton } from '@/components/delete-button';
import { NotificationEditDrawer } from '@/components/notification-edit-drawer';
import { formatDateTimeUtcEnGb } from '@/lib/utils';
import type { Notification } from '@/db/schema';

export type NotificationListRow = Notification & { linkedCampaignCount: number };

interface NotificationsTableWithDrawerProps {
  notifications: NotificationListRow[];
  initialEditId?: string | null;
}

export function NotificationsTableWithDrawer({
  notifications,
  initialEditId,
}: NotificationsTableWithDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit'>('view');
  const [selectedNotification, setSelectedNotification] = useState<NotificationListRow | null>(null);
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);

  useEffect(() => {
    if (initialEditId) {
      const notification = notifications.find((n) => n.id === initialEditId);
      queueMicrotask(() => {
        if (notification) {
          setSelectedNotification(notification);
          setSelectedNotificationId(null);
        } else {
          setSelectedNotification(null);
          setSelectedNotificationId(initialEditId);
        }
        setDrawerMode('edit');
        setDrawerOpen(true);
      });
    }
  }, [initialEditId, notifications]);

  const openDrawer = (notification: NotificationListRow, mode: 'view' | 'edit') => {
    setSelectedNotification(notification);
    setSelectedNotificationId(null);
    setDrawerMode(mode);
    setDrawerOpen(true);
  };

  const openRow = (notification: NotificationListRow) => openDrawer(notification, 'view');

  return (
    <>
      <div className="flex flex-col gap-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
            <p className="text-sm text-muted-foreground">Manage global system notifications</p>
          </div>
          <Button asChild className="shrink-0 self-start sm:self-auto">
            <Link href="/notifications/new">
              <IconPlus className="mr-2 h-4 w-4" />
              Add Notification
            </Link>
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/80 bg-card/30 shadow-sm">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Title</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Message</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">CTA Link</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 text-center font-medium tabular-nums">
                  Campaigns
                </TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 font-medium">Created</TableHead>
                <TableHead className="h-12 min-w-0 px-4 py-3 text-right font-medium">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No notifications found. Create your first notification.
                  </TableCell>
                </TableRow>
              ) : (
                notifications.map((notification) => (
                  <TableRow
                    key={notification.id}
                    className="min-h-[52px] cursor-pointer transition-colors hover:bg-muted/40"
                    tabIndex={0}
                    onClick={() => openRow(notification)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openRow(notification);
                      }
                    }}
                  >
                    <TableCell className="min-w-0 px-4 py-3 align-middle font-medium">
                      {notification.title}
                    </TableCell>
                    <TableCell className="max-w-xs min-w-0 px-4 py-3 align-middle truncate">
                      {notification.message}
                    </TableCell>
                    <TableCell className="max-w-[200px] min-w-0 px-4 py-3 align-middle">
                      {notification.ctaLink ? (
                        <a
                          href={notification.ctaLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate text-primary underline-offset-4 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {notification.ctaLink}
                        </a>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="min-w-0 px-4 py-3 align-middle tabular-nums">
                      <div className="flex justify-center">
                        {notification.linkedCampaignCount > 0 ? (
                          <Badge
                            variant="secondary"
                            className="min-w-7 justify-center px-2.5 py-0.5 tabular-nums font-medium"
                          >
                            {notification.linkedCampaignCount}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell
                      className="min-w-0 px-4 py-3 align-middle text-sm tabular-nums text-muted-foreground"
                      title="UTC"
                    >
                      {formatDateTimeUtcEnGb(notification.createdAt)}
                    </TableCell>
                    <TableCell
                      className="min-w-0 px-4 py-3 text-right align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9"
                          aria-label={`Edit ${notification.title}`}
                          onClick={() => openDrawer(notification, 'edit')}
                        >
                          <IconPencil className="h-4 w-4" />
                        </Button>
                        <DeleteButton
                          name={notification.title}
                          entityType="notification"
                          apiPath={`/api/notifications/${notification.id}`}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <NotificationEditDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        notification={selectedNotification}
        notificationId={selectedNotificationId ?? undefined}
        initialMode={drawerMode}
      />
    </>
  );
}
