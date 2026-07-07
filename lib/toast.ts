/**
 * Tiny toast queue + typed `toast.*` API.
 *
 * The state lives in a module-level singleton so any client component
 * can call `toast.success('Saved')` without prop-drilling or context.
 * Rendering happens in `<Toaster />` (components/ui/toaster.tsx), which
 * subscribes to this queue and renders Radix Toast primitives for
 * accessibility (ARIA live region, swipe-to-dismiss, focus management).
 */

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  /** Time in ms before auto-dismiss. Defaults to 4_000. */
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

const DEFAULT_DURATION = 4_000;

let listeners: Listener[] = [];
let queue: ToastItem[] = [];
let nextId = 1;

function emit(): void {
  for (const l of listeners) l(queue);
}

function show(
  variant: ToastVariant,
  message: string,
  duration?: number
): number {
  const item: ToastItem = {
    id: nextId++,
    message,
    variant,
    duration: duration ?? DEFAULT_DURATION,
  };
  queue = [...queue, item];
  emit();
  return item.id;
}

export function dismissToast(id: number): void {
  queue = queue.filter((t) => t.id !== id);
  emit();
}

export function subscribeToToasts(listener: Listener): () => void {
  listeners.push(listener);
  listener(queue);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

interface ToastOptions {
  /** Time in ms before auto-dismiss. Defaults to 4_000. */
  duration?: number;
}

export const toast = {
  success: (message: string, opts?: ToastOptions): number =>
    show('success', message, opts?.duration),
  error: (message: string, opts?: ToastOptions): number =>
    show('error', message, opts?.duration),
  info: (message: string, opts?: ToastOptions): number =>
    show('info', message, opts?.duration),
  warning: (message: string, opts?: ToastOptions): number =>
    show('warning', message, opts?.duration),
} as const;

/**
 * React-hook ergonomic alias for the `toast` singleton.
 *
 * The underlying queue is module-level so a hook isn't strictly necessary,
 * but `useToast()` reads more naturally in callers that follow the
 * `useFoo()` convention for everything else (useCurrentUser, useActionSWR,
 * useListPageState, …).
 *
 * @example
 *   const toast = useToast();
 *   const onSave = async () => {
 *     const res = await save();
 *     if (res.error) toast.error(res.error);
 *     else toast.success('Saved');
 *   };
 */
export function useToast(): typeof toast {
  return toast;
}
