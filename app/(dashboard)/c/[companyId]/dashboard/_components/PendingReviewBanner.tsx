import Link from 'next/link';
import { Inbox } from 'lucide-react';
import { Alert } from '@/components/ui/alert';

interface Props {
  count: number;
  reviewHref: string;
}

export function PendingReviewBanner({ count, reviewHref }: Props) {
  if (count <= 0) return null;
  return (
    <Alert variant="warning" icon={Inbox} className="mb-6 items-center">
      <div className="flex items-center justify-between gap-3">
        <span>
          <strong>{count}</strong> received{' '}
          {count === 1 ? 'invoice' : 'invoices'} awaiting review
        </span>
        <Link
          href={reviewHref}
          className="rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50"
        >
          Review →
        </Link>
      </div>
    </Alert>
  );
}
