'use client';

import Link from 'next/link';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/received-invoices/StatusBadge';

interface Props {
  companyId: string;
  status: string;
  extractionConfidence: string | null;
  pendingPosition: { index: number; total: number } | null;
  nextPendingId: number | null;
  onSkip: () => void;
}

export function ReviewHeader({
  companyId,
  status,
  extractionConfidence,
  pendingPosition,
  nextPendingId,
  onSkip,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/c/${companyId}/received-invoices`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <h1 className="text-lg font-medium lg:text-xl">Review received invoice</h1>
      <StatusBadge variant="lifecycle" value={status} />
      {extractionConfidence && (
        <StatusBadge variant="confidence" value={extractionConfidence} />
      )}
      {pendingPosition && (
        <span className="ml-auto text-sm text-gray-500">
          {pendingPosition.index} of {pendingPosition.total} pending
          {nextPendingId && (
            <Button size="sm" variant="ghost" className="ml-2" onClick={onSkip}>
              Skip
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </span>
      )}
    </div>
  );
}
