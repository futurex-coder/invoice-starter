import * as React from 'react';
import { Inbox } from 'lucide-react';
import { Alert } from '@/components/ui/alert';

interface Props {
  count: number;
  /**
   * Right-aligned action. The caller decides whether it's a `<Link>`
   * (navigate to the review list) or a `<Button onClick=...>` (advance
   * to the next pending invoice in-place). Empty -> no action.
   */
  action?: React.ReactNode;
  /**
   * Optional inline note appended to the count message — e.g.
   * "— drafts aren't shown in the list below." for the list page.
   */
  description?: string;
  /** Extra classes appended to the Alert. Default: `mb-6 items-center`. */
  className?: string;
}

/**
 * Single source for "you have N received invoices awaiting review."
 * Replaces two near-duplicate `PendingReviewBanner` components that
 * lived at different paths and accepted different action shapes.
 *
 * Renders nothing when `count <= 0`.
 */
export function PendingReviewBanner({
  count,
  action,
  description,
  className = 'mb-6 items-center',
}: Props) {
  if (count <= 0) return null;
  return (
    <Alert variant="warning" icon={Inbox} className={className}>
      <div className="flex items-center justify-between gap-3">
        <span>
          <strong>{count}</strong>{' '}
          {count === 1
            ? 'получена фактура за преглед'
            : 'получени фактури за преглед'}
          {description && (
            <span className="ml-1 text-amber-700">{description}</span>
          )}
        </span>
        {action}
      </div>
    </Alert>
  );
}
