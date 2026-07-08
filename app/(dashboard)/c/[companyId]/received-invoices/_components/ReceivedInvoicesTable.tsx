'use client';

import { ExternalLink, Loader2 } from 'lucide-react';
import type { ReceivedInvoiceListItem } from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';
import { ReceivedInvoiceRowActions } from './ReceivedInvoiceRowActions';
import {
  PaidTogglePill,
  AccountedTogglePill,
} from '@/components/list-page/StatusTogglePill';
import { STATUS_LABELS, supplierName, isOverdue } from './utils';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

interface RowProps {
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
  onRetry: (id: number) => void;
}

function Row(props: RowProps) {
  const { item } = props;
  const archived = item.archivedAt != null;
  const isAnalyzing = item.status === 'analyzing';
  const isFailed = item.status === 'failed';
  const isDraft = item.status === 'draft';
  const isConfirmed = item.status === 'confirmed';
  const isDiscarded = item.status === 'discarded';
  const overdue = isOverdue(item.dueDate, item.paymentStatus, item.status);
  const statusBadgeClass = isDiscarded
    ? 'bg-gray-200 text-gray-700'
    : isFailed
      ? 'bg-red-100 text-red-800'
      : isAnalyzing
        ? 'bg-blue-100 text-blue-800'
        : isDraft
          ? 'bg-amber-100 text-amber-800'
          : 'bg-green-100 text-green-800';

  return (
    <tr
      className={cn(
        'border-b border-gray-200',
        overdue
          ? 'bg-red-50 hover:bg-red-100/70'
          : archived
            ? 'opacity-60 hover:bg-gray-50/50'
            : 'hover:bg-gray-50/50'
      )}
    >
      <td className="w-8 px-2 py-3">
        <a
          href={`/api/received-invoices/${item.id}/file?redirect=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title={`Open original (${item.fileMimeType === 'application/pdf' ? 'PDF' : 'image'})`}
          aria-label="Open original file"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </td>
      <td className="px-4 py-3 text-sm">
        {isAnalyzing ? (
          <span className="inline-flex items-center gap-1.5 text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Analyzing…
          </span>
        ) : (
          (item.invoiceNumber ?? <span className="text-gray-400">—</span>)
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {isAnalyzing ? <span className="text-gray-400">—</span> : supplierName(item)}
      </td>
      <td className="px-4 py-3 text-sm">{formatDate(item.issueDate)}</td>
      <td className="px-4 py-3 text-sm font-medium">
        {Number(item.grossAmount).toFixed(2)} {item.currency}
      </td>
      <td className="px-4 py-3">
        <PaidTogglePill
          value={item.paymentStatus}
          pending={props.pending}
          disabled={!isConfirmed}
          onChange={(next) => props.onMarkPayment(item.id, next)}
        />
        {overdue && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
            Overdue
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <AccountedTogglePill
          value={item.accountingStatus}
          pending={props.pending}
          disabled={!isConfirmed}
          onChange={(next) => props.onMarkAccounting(item.id, next)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              statusBadgeClass
            )}
          >
            {isAnalyzing && <Loader2 className="h-3 w-3 animate-spin" />}
            {STATUS_LABELS[item.status] ?? item.status}
          </span>
          {isFailed && (
            <button
              type="button"
              onClick={() => props.onRetry(item.id)}
              disabled={props.pending}
              className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
            >
              Retry
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right">
        <ReceivedInvoiceRowActions {...props} />
      </td>
    </tr>
  );
}

interface TableProps {
  items: ReceivedInvoiceListItem[];
  companyId: string;
  pendingId: number | null;
  onView: (id: number) => void;
  onReview: (id: number) => void;
  onMarkPayment: (id: number, status: PaymentStatus) => void;
  onMarkAccounting: (id: number, status: AccountingStatus) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDiscard: (item: ReceivedInvoiceListItem) => void;
  onRestore: (id: number) => void;
  onHardDelete: (item: ReceivedInvoiceListItem) => void;
  onRetry: (id: number) => void;
}

const HEADER_CELL_CLASS =
  'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600';

export function ReceivedInvoicesTable(props: TableProps) {
  return (
    <table className="w-full">
      <thead>
        <tr className="border-b border-gray-200 bg-gray-50/80">
          <th className="w-8 px-2 py-3" />
          <th className={HEADER_CELL_CLASS}>Number</th>
          <th className={HEADER_CELL_CLASS}>Supplier</th>
          <th className={HEADER_CELL_CLASS}>Date</th>
          <th className={HEADER_CELL_CLASS}>Total</th>
          <th className={HEADER_CELL_CLASS}>Paid</th>
          <th className={HEADER_CELL_CLASS}>Accounted</th>
          <th className={HEADER_CELL_CLASS}>Status</th>
          <th className={cn(HEADER_CELL_CLASS, 'text-right')}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {props.items.map((item) => (
          <Row
            key={item.id}
            item={item}
            companyId={props.companyId}
            pending={props.pendingId === item.id}
            onView={props.onView}
            onReview={props.onReview}
            onMarkPayment={props.onMarkPayment}
            onMarkAccounting={props.onMarkAccounting}
            onArchive={props.onArchive}
            onDiscard={props.onDiscard}
            onRestore={props.onRestore}
            onHardDelete={props.onHardDelete}
            onRetry={props.onRetry}
          />
        ))}
      </tbody>
    </table>
  );
}
