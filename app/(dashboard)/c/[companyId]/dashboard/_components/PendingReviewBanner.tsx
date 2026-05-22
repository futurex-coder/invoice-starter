import Link from 'next/link';
import { Inbox } from 'lucide-react';

interface Props {
  count: number;
  reviewHref: string;
}

export function PendingReviewBanner({ count, reviewHref }: Props) {
  if (count <= 0) return null;
  return (
    <div className="mb-6 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex items-center gap-2 text-amber-900">
        <Inbox className="h-4 w-4" />
        <span>
          <strong>{count}</strong> received{' '}
          {count === 1 ? 'invoice' : 'invoices'} awaiting review
        </span>
      </div>
      <Link
        href={reviewHref}
        className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
      >
        Review →
      </Link>
    </div>
  );
}
