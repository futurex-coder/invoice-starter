'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * OI-9: the inline paid / accounted toggle — the two switches accountants
 * flip most, editable straight from the list row. Clicking flips to the
 * "done" state; clicking a done pill flips it back.
 */

const PAID_STYLES: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 hover:bg-green-200',
  partial: 'bg-amber-100 text-amber-800 hover:bg-amber-200',
  unpaid: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
};
const PAID_LABELS: Record<string, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export function PaidTogglePill({
  value,
  pending,
  disabled,
  onChange,
}: {
  value: string;
  pending?: boolean;
  /** Render as a static dash (e.g. drafts — nothing to pay yet). */
  disabled?: boolean;
  onChange: (next: 'paid' | 'unpaid') => void;
}) {
  if (disabled) return <span className="text-sm text-gray-400">—</span>;
  const next = value === 'paid' ? 'unpaid' : 'paid';
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      disabled={pending}
      title={`Mark as ${PAID_LABELS[next] ?? next}`}
      aria-label={`Payment status: ${PAID_LABELS[value] ?? value}. Click to mark ${next}.`}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        PAID_STYLES[value] ?? PAID_STYLES.unpaid,
        pending && 'opacity-60'
      )}
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      {PAID_LABELS[value] ?? value}
    </button>
  );
}

export function AccountedTogglePill({
  value,
  pending,
  disabled,
  onChange,
}: {
  value: string;
  pending?: boolean;
  disabled?: boolean;
  onChange: (next: 'accounted' | 'pending') => void;
}) {
  if (disabled) return <span className="text-sm text-gray-400">—</span>;
  const accounted = value === 'accounted';
  const next = accounted ? 'pending' : 'accounted';
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      disabled={pending}
      title={accounted ? 'Mark as pending' : 'Mark as accounted'}
      aria-label={`Accounting status: ${accounted ? 'accounted' : 'pending'}. Click to mark ${next}.`}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors',
        accounted
          ? 'bg-sky-100 text-sky-800 hover:bg-sky-200'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        pending && 'opacity-60'
      )}
    >
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      {accounted ? 'Accounted' : 'Pending'}
    </button>
  );
}
