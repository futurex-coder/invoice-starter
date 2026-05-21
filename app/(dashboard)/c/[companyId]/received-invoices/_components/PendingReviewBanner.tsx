'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number;
  onReviewNext: () => void;
}

export function PendingReviewBanner({ count, onReviewNext }: Props) {
  if (count <= 0) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertCircle className="h-4 w-4" />
        <span>
          <strong>{count}</strong> {count === 1 ? 'invoice' : 'invoices'} pending review
          <span className="ml-1 text-amber-700">
            — drafts aren&apos;t shown in the list below.
          </span>
        </span>
      </div>
      <Button size="sm" variant="outline" onClick={onReviewNext}>
        Review next
      </Button>
    </div>
  );
}
