'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { IconTrash, IconLoader2, IconBan, IconAlertTriangle } from '@tabler/icons-react';
import { toast } from 'sonner';

const entityLabels = {
  ad: {
    title: 'Delete Ad',
    successMessage: 'Ad deleted successfully',
    errorMessage: 'Failed to delete ad',
  },
  platform: {
    title: 'Delete Platform',
    successMessage: 'Platform deleted successfully',
    errorMessage: 'Failed to delete platform',
  },
  notification: {
    title: 'Delete Notification',
    successMessage: 'Notification deleted successfully',
    errorMessage: 'Failed to delete notification',
  },
  redirect: {
    title: 'Delete Redirect',
    successMessage: 'Redirect deleted successfully',
    errorMessage: 'Failed to delete redirect',
  },
  campaign: {
    title: 'Delete Campaign',
    successMessage: 'Campaign removed from delivery. History and logs are kept.',
    errorMessage: 'Failed to delete campaign',
  },
} as const;

const campaignDualDialogCopy = {
  title: 'Remove or permanently delete campaign?',
  permanentSuccess: 'Campaign and all related extension events were permanently removed.',
  permanentError: 'Failed to permanently delete campaign',
} as const;

type EntityType = keyof typeof entityLabels;

type DeleteButtonProps = {
  name: string;
  apiPath: string;
  /** When provided, redirects here after successful delete (e.g. when deleting from a detail page) */
  redirectTo?: string;
} & (
  | { entityType: 'campaign'; campaignStatus: string }
  | { entityType: Exclude<EntityType, 'campaign'> }
);

function deleteRequestUrl(apiPath: string, permanent: boolean): string {
  if (!permanent) return apiPath;
  return apiPath.includes('?') ? `${apiPath}&permanent=1` : `${apiPath}?permanent=1`;
}

function CampaignAdminDeleteButton({
  name,
  apiPath,
  redirectTo,
  campaignStatus,
}: {
  name: string;
  apiPath: string;
  redirectTo?: string;
  campaignStatus: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<'soft' | 'permanent' | null>(null);
  const [mounted, setMounted] = useState(false);
  const isAlreadySoftDeleted = campaignStatus === 'deleted';

  useEffect(() => setMounted(true), []);

  const finishSuccess = () => {
    setOpen(false);
    if (redirectTo) {
      router.replace(redirectTo);
    } else {
      router.refresh();
    }
  };

  const runDelete = async (permanent: boolean) => {
    setDeleting(permanent ? 'permanent' : 'soft');
    try {
      const response = await fetch(deleteRequestUrl(apiPath, permanent), { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          (typeof data.error === 'string' && data.error) ||
            (permanent ? campaignDualDialogCopy.permanentError : entityLabels.campaign.errorMessage)
        );
      }

      if (permanent) {
        toast.success(campaignDualDialogCopy.permanentSuccess);
      } else if (data.alreadySoftDeleted) {
        toast.message('This campaign was already removed from delivery.');
      } else {
        toast.success(entityLabels.campaign.successMessage);
      }

      finishSuccess();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : permanent
            ? campaignDualDialogCopy.permanentError
            : entityLabels.campaign.errorMessage
      );
    } finally {
      setDeleting(null);
    }
  };

  const triggerClassName =
    'min-h-10 min-w-10 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/25';

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={triggerClassName} disabled tabIndex={-1}>
        <IconTrash className="h-4 w-4" aria-hidden />
        <span className="sr-only">Delete campaign</span>
      </Button>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={triggerClassName}
          aria-label={`Delete campaign: ${name}`}
        >
          <IconTrash className="h-4 w-4" aria-hidden />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:rounded-lg">
        <div className="border-b bg-muted/40 px-6 py-5 sm:px-6">
          <AlertDialogHeader className="space-y-3 text-left">
            <AlertDialogTitle className="text-left text-base font-semibold leading-snug sm:text-lg">
              {campaignDualDialogCopy.title}
            </AlertDialogTitle>
            <p className="break-words text-sm font-medium leading-snug text-foreground">
              <span className="text-muted-foreground font-normal">Campaign </span>
              <span title={name}>&ldquo;{name}&rdquo;</span>
            </p>
            <AlertDialogDescription asChild>
              <p className="text-left text-sm leading-relaxed text-muted-foreground">
                Pick one option below. You can always return here later unless you permanently delete.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
        </div>

        <div className="space-y-3 px-6 py-5">
          {isAlreadySoftDeleted && (
            <div
              className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground dark:border-amber-500/35 dark:bg-amber-500/15"
              role="status"
            >
              <IconAlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden />
              <p className="min-w-0 leading-relaxed">
                <span className="font-medium text-foreground">Already removed from delivery.</span>{' '}
                Soft-remove is not available. Use permanent delete only if you want to erase this campaign and its
                extension events.
              </p>
            </div>
          )}

          <div className="grid gap-3">
            <section
              aria-labelledby="campaign-soft-delete-heading"
              className={cn(
                'rounded-lg border bg-card p-4 shadow-xs',
                isAlreadySoftDeleted && 'opacity-60'
              )}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                  aria-hidden
                >
                  <IconBan className="size-5" stroke={1.75} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <h3 id="campaign-soft-delete-heading" className="text-sm font-semibold text-foreground">
                      Remove from delivery
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Soft-delete stops the extension from serving this campaign. The record and event history stay in
                      the database for reporting.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={deleting !== null || isAlreadySoftDeleted}
                    className="h-10 w-full min-h-10 sm:w-auto"
                    onClick={() => void runDelete(false)}
                  >
                    {deleting === 'soft' ? (
                      <>
                        <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        Removing…
                      </>
                    ) : (
                      <>
                        <IconBan className="size-4" aria-hidden />
                        Remove from delivery
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>

            <section
              aria-labelledby="campaign-permanent-delete-heading"
              className="rounded-lg border border-destructive/35 bg-destructive/5 p-4 shadow-xs dark:border-destructive/40 dark:bg-destructive/10"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-destructive/15 text-destructive dark:bg-destructive/25"
                  aria-hidden
                >
                  <IconTrash className="size-5" stroke={1.75} />
                </div>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <h3 id="campaign-permanent-delete-heading" className="text-sm font-semibold text-foreground">
                      Permanently delete
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      Deletes the campaign row and{' '}
                      <span className="font-medium text-foreground">all extension events</span> linked to it. This
                      cannot be undone.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={deleting !== null}
                    className="h-10 w-full min-h-10 sm:w-auto"
                    onClick={() => void runDelete(true)}
                  >
                    {deleting === 'permanent' ? (
                      <>
                        <IconLoader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                        Deleting…
                      </>
                    ) : (
                      <>
                        <IconTrash className="size-4" aria-hidden />
                        Permanently delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>

        <AlertDialogFooter className="gap-3 border-t bg-muted/30 px-6 py-4 sm:justify-end">
          <AlertDialogCancel className="mt-0 h-10 min-h-10 w-full sm:w-auto">
            Cancel
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DeleteButton(props: DeleteButtonProps) {
  const { name, entityType, apiPath, redirectTo } = props;

  if (entityType === 'campaign') {
    return (
      <CampaignAdminDeleteButton
        name={name}
        apiPath={apiPath}
        redirectTo={redirectTo}
        campaignStatus={props.campaignStatus}
      />
    );
  }

  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const labels = useMemo(() => entityLabels[entityType], [entityType]);

  useEffect(() => setMounted(true), []);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(apiPath, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || labels.errorMessage);
      }

      toast.success(labels.successMessage);
      if (redirectTo) {
        router.replace(redirectTo);
      } else {
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : labels.errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled tabIndex={-1}>
        <IconTrash className="h-4 w-4" />
        <span className="sr-only">Delete {entityType}</span>
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
          <IconTrash className="h-4 w-4" />
          <span className="sr-only">Delete {entityType}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{labels.title}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{name}&quot;? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
