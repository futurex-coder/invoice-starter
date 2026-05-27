'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface Props {
  count: number;
  onReviewNext: () => void;
}

export function PendingReviewBanner({ count, onReviewNext }: Props) {
  if (count <= 0) return null;
  return (
    <Alert variant="warning" icon={AlertCircle} className="mb-4 items-center">
      <div className="flex items-center justify-between gap-3">
        <span>
          <strong>{count}</strong> {count === 1 ? 'invoice' : 'invoices'} pending review
          <span className="ml-1 text-amber-700">
            — drafts aren&apos;t shown in the list below.
          </span>
        </span>
        <Button size="sm" variant="outline" onClick={onReviewNext}>
          Review next
        </Button>
      </div>
    </Alert>
  );
}
