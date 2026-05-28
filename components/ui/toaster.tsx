'use client';

import * as React from 'react';
import { Toast as ToastPrimitive } from 'radix-ui';
import {
  CheckCircle2,
  Info,
  TriangleAlert,
  XCircle,
  XIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  dismissToast,
  subscribeToToasts,
  type ToastItem,
  type ToastVariant,
} from '@/lib/toast';

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-green-200 bg-green-50 text-green-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
};

const VARIANT_ICON: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: XCircle,
  warning: TriangleAlert,
  info: Info,
};

const VARIANT_ICON_TONE: Record<ToastVariant, string> = {
  success: 'text-green-600',
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-blue-600',
};

/**
 * Renders the toast queue. Mount once near the root of the app.
 *
 * Toasts are fired from anywhere via `toast.success(...)`, `toast.error(...)`
 * etc. (from `@/lib/toast`). The store is a module-level singleton, so no
 * provider or context is needed in callers.
 */
export function Toaster() {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  React.useEffect(() => subscribeToToasts(setToasts), []);

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => {
        const Icon = VARIANT_ICON[t.variant];
        return (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.duration}
            onOpenChange={(open) => {
              if (!open) dismissToast(t.id);
            }}
            className={cn(
              'group pointer-events-auto relative flex w-full items-start gap-3 overflow-hidden rounded-md border p-3 pr-8 shadow-lg',
              'data-[state=open]:animate-in data-[state=open]:slide-in-from-right-full',
              'data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right-full data-[state=closed]:fade-out-80',
              'data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]',
              'data-[swipe=cancel]:translate-x-0',
              'data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-right-full',
              VARIANT_CLASSES[t.variant]
            )}
          >
            <Icon
              className={cn('mt-0.5 h-4 w-4 shrink-0', VARIANT_ICON_TONE[t.variant])}
              aria-hidden="true"
            />
            <ToastPrimitive.Description className="flex-1 text-sm">
              {t.message}
            </ToastPrimitive.Description>
            <ToastPrimitive.Close
              className="absolute right-2 top-2 rounded-md p-1 opacity-60 hover:opacity-100 focus:outline-none focus:ring-1 focus:ring-current"
              aria-label="Dismiss"
            >
              <XIcon className="h-3.5 w-3.5" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        className={cn(
          'fixed bottom-0 right-0 z-50 flex max-h-screen w-full max-w-sm flex-col-reverse gap-2 p-4',
          'sm:bottom-4 sm:right-4'
        )}
      />
    </ToastPrimitive.Provider>
  );
}
