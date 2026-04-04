'use client';

import { PlatformForm } from '@/app/(protected)/platforms/platform-form';
import type { Platform } from '@/db/schema';
import {
  CrudResourceDrawerRoot,
  CrudResourceDrawerHeader,
  CrudResourceDrawerBody,
} from '@/components/crud-resource-drawer';

interface PlatformAddDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (newPlatform: Platform) => void;
}

export function PlatformAddDrawer({ open, onOpenChange, onSuccess }: PlatformAddDrawerProps) {
  const handleSuccess = async (newPlatform?: Platform) => {
    onOpenChange(false);
    if (newPlatform) {
      onSuccess?.(newPlatform);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <CrudResourceDrawerRoot open={open} onOpenChange={onOpenChange} direction="right">
      <CrudResourceDrawerHeader
        title="Add platform"
        description="Create a domain for campaign targeting"
      />
      <CrudResourceDrawerBody>
        <PlatformForm mode="create" onSuccess={handleSuccess} onCancel={handleCancel} />
      </CrudResourceDrawerBody>
    </CrudResourceDrawerRoot>
  );
}
