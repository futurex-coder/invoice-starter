import { cn } from '@/lib/utils';

type StatusVariant = 'lifecycle' | 'accounting' | 'payment' | 'confidence';

interface Props {
  variant: StatusVariant;
  value: string;
  className?: string;
}

const LIFECYCLE_STYLES: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-green-100 text-green-800',
  discarded: 'bg-gray-200 text-gray-600',
};

const ACCOUNTING_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accounted: 'bg-green-100 text-green-800',
};

const PAYMENT_STYLES: Record<string, string> = {
  unpaid: 'bg-red-100 text-red-700',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-green-100 text-green-700',
  medium: 'bg-yellow-100 text-yellow-800',
  low: 'bg-red-100 text-red-700',
};

const LIFECYCLE_LABELS: Record<string, string> = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  discarded: 'Discarded',
};

const ACCOUNTING_LABELS: Record<string, string> = {
  pending: 'Pending',
  accounted: 'Accounted',
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  partial: 'Partial',
  paid: 'Paid',
};

export function StatusBadge({ variant, value, className }: Props) {
  let style: string;
  let label: string;
  switch (variant) {
    case 'lifecycle':
      style = LIFECYCLE_STYLES[value] ?? 'bg-gray-100 text-gray-700';
      label = LIFECYCLE_LABELS[value] ?? value;
      break;
    case 'accounting':
      style = ACCOUNTING_STYLES[value] ?? 'bg-gray-100 text-gray-700';
      label = ACCOUNTING_LABELS[value] ?? value;
      break;
    case 'payment':
      style = PAYMENT_STYLES[value] ?? 'bg-gray-100 text-gray-700';
      label = PAYMENT_LABELS[value] ?? value;
      break;
    case 'confidence':
      style = CONFIDENCE_STYLES[value] ?? 'bg-gray-100 text-gray-700';
      label = value.toUpperCase();
      break;
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none',
        style,
        className
      )}
    >
      {label}
    </span>
  );
}
