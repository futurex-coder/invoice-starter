'use client';

import Link from 'next/link';
import { Archive, ArchiveRestore, ArrowLeft, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/received-invoices/StatusBadge';
import type { ReceivedInvoice } from '@/lib/db/schema';

interface Props {
  row: ReceivedInvoice;
  supplierName: string | null | undefined;
  companyId: string;
  archived: boolean;
  onArchive: () => void;
  onEdit: () => void;
}

export function DetailHeader({
  row,
  supplierName,
  companyId,
  archived,
  onArchive,
  onEdit,
}: Props) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Button variant="ghost" size="icon" asChild aria-label="Back to received invoices">
        <Link href={`/c/${companyId}/received-invoices`}>
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <h1 className="text-lg font-medium lg:text-xl">
        {supplierName ?? 'Received invoice'}
        {row.invoiceNumber && (
          <span className="ml-2 text-gray-500">№ {row.invoiceNumber}</span>
        )}
      </h1>
      <StatusBadge variant="lifecycle" value={row.status} />
      {archived && (
        <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase text-gray-700">
          Archived
        </span>
      )}
      <div className="ml-auto flex gap-2">
        {row.status === 'confirmed' && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onArchive}
              title={archived ? 'Unarchive' : 'Archive'}
            >
              {archived ? (
                <>
                  <ArchiveRestore className="mr-1 h-4 w-4" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="mr-1 h-4 w-4" />
                  Archive
                </>
              )}
            </Button>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
