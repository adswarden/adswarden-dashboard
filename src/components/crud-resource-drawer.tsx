'use client';

import * as React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

/**
 * Right rail sized to match dashboard density — not full viewport width.
 * md+: inset from viewport edges (~same rhythm as SidebarInset inset `m-2`) + rounded corners like the main “paper” shell.
 */
export const crudResourceDrawerContentClassName = cn(
  'flex flex-col bg-background',
  'data-[vaul-drawer-direction=right]:shadow-md',
  // phones: slim rail, still below max width of typ. mobile column
  'data-[vaul-drawer-direction=right]:max-md:inset-y-0 data-[vaul-drawer-direction=right]:max-md:right-0 data-[vaul-drawer-direction=right]:max-md:left-auto',
  'data-[vaul-drawer-direction=right]:max-md:h-full data-[vaul-drawer-direction=right]:max-md:max-h-none',
  'data-[vaul-drawer-direction=right]:max-md:w-[min(100vw,28rem)] data-[vaul-drawer-direction=right]:max-md:border-l data-[vaul-drawer-direction=right]:max-md:border-border/80',
  // md+: float as a card on the blurred backdrop (aligns with inset layout rounding)
  'data-[vaul-drawer-direction=right]:md:inset-y-2 data-[vaul-drawer-direction=right]:md:right-2 data-[vaul-drawer-direction=right]:md:left-auto',
  'data-[vaul-drawer-direction=right]:md:h-[calc(100vh-1rem)] data-[vaul-drawer-direction=right]:md:max-h-[calc(100vh-1rem)]',
  'data-[vaul-drawer-direction=right]:md:w-full data-[vaul-drawer-direction=right]:md:max-w-2xl',
  'data-[vaul-drawer-direction=right]:md:rounded-l-xl data-[vaul-drawer-direction=right]:md:border data-[vaul-drawer-direction=right]:md:border-border/80'
);

type CrudResourceDrawerRootProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  direction?: 'right' | 'left';
  children: React.ReactNode;
};

export function CrudResourceDrawerRoot({
  open,
  onOpenChange,
  direction = 'right',
  children,
}: CrudResourceDrawerRootProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction={direction}>
      <DrawerContent className={crudResourceDrawerContentClassName}>{children}</DrawerContent>
    </Drawer>
  );
}

type CrudResourceDrawerHeaderProps = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function CrudResourceDrawerHeader({ title, description, actions, className }: CrudResourceDrawerHeaderProps) {
  return (
    <DrawerHeader
      className={cn(
        'shrink-0 space-y-0 border-b border-border/80 bg-muted/20 px-5 pb-4 pt-5 md:px-6',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <DrawerTitle className="text-lg font-semibold leading-tight tracking-tight">{title}</DrawerTitle>
          {description ? (
            <DrawerDescription className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </DrawerDescription>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>
    </DrawerHeader>
  );
}

type CrudResourceDrawerBodyProps = {
  children: React.ReactNode;
  className?: string;
};

export function CrudResourceDrawerBody({ children, className }: CrudResourceDrawerBodyProps) {
  return (
    <div className={cn('flex-1 overflow-y-auto px-5 py-4 md:px-6 md:py-5', className)}>{children}</div>
  );
}
