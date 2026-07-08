'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Archive,
  ArchiveRestore,
  CheckCircle,
  CircleDot,
  CircleSlash2,
  ExternalLink,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { ReceivedInvoiceListItem } from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';

interface Props {
  item: ReceivedInvoiceListItem;
  companyId: string;
  pending: boolean;
  onView: (id: number) => void;
  onReview: (id: number) => void;
  onMarkPayment: (id: number, status: PaymentStatus) => void;
  onMarkAccounting: (id: number, status: AccountingStatus) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDiscard: (item: ReceivedInvoiceListItem) => void;
  onRestore: (id: number) => void;
  onHardDelete: (item: ReceivedInvoiceListItem) => void;
}

export function ReceivedInvoiceRowActions({
  item,
  companyId,
  pending,
  onView,
  onReview,
  onMarkPayment,
  onMarkAccounting,
  onArchive,
  onDiscard,
  onRestore,
  onHardDelete,
}: Props) {
  const archived = item.archivedAt != null;
  const isDraft = item.status === 'draft';
  const isConfirmed = item.status === 'confirmed';
  const isDiscarded = item.status === 'discarded';
  const fileHref = `/api/received-invoices/${item.id}/file?redirect=1`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MoreHorizontal className="h-4 w-4" />
          )}
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {isDraft && (
          <>
            <DropdownMenuItem onClick={() => onReview(item.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Review draft
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={fileHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open original file
              </a>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDiscard(item)}
              className="text-red-700 focus:text-red-700"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Discard draft
            </DropdownMenuItem>
          </>
        )}

        {isConfirmed && (
          <>
            <DropdownMenuItem onClick={() => onView(item.id)}>
              <Eye className="mr-2 h-4 w-4" />
              View
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={fileHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open original file
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReview(item.id)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {item.paymentStatus !== 'paid' && (
              <DropdownMenuItem onClick={() => onMarkPayment(item.id, 'paid')}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                Mark paid
              </DropdownMenuItem>
            )}
            {item.paymentStatus !== 'partial' && (
              <DropdownMenuItem onClick={() => onMarkPayment(item.id, 'partial')}>
                <CircleDot className="mr-2 h-4 w-4 text-yellow-600" />
                Mark partial
              </DropdownMenuItem>
            )}
            {item.paymentStatus !== 'unpaid' && (
              <DropdownMenuItem onClick={() => onMarkPayment(item.id, 'unpaid')}>
                <CircleSlash2 className="mr-2 h-4 w-4 text-red-600" />
                Mark unpaid
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            {item.accountingStatus === 'pending' ? (
              <DropdownMenuItem
                onClick={() => onMarkAccounting(item.id, 'accounted')}
              >
                <CheckCircle className="mr-2 h-4 w-4 text-blue-600" />
                Mark as accounted
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onClick={() => onMarkAccounting(item.id, 'pending')}
              >
                <CircleDot className="mr-2 h-4 w-4 text-amber-600" />
                Mark as pending accounting
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem onClick={() => onArchive(item.id, !archived)}>
              {archived ? (
                <>
                  <ArchiveRestore className="mr-2 h-4 w-4" />
                  Unarchive
                </>
              ) : (
                <>
                  <Archive className="mr-2 h-4 w-4" />
                  Archive
                </>
              )}
            </DropdownMenuItem>
          </>
        )}

        {isDiscarded && (
          <>
            <DropdownMenuItem asChild>
              <Link href={`/c/${companyId}/received-invoices/${item.id}`}>
                <Eye className="mr-2 h-4 w-4" />
                View
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={fileHref} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open original file
              </a>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRestore(item.id)}>
              <ArchiveRestore className="mr-2 h-4 w-4" />
              Restore to draft
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onHardDelete(item)}
              className="text-red-700 focus:text-red-700"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Permanently delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
