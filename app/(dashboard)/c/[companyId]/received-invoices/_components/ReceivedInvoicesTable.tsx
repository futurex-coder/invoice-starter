'use client';

import { ExternalLink } from 'lucide-react';
import type { ReceivedInvoiceListItem } from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';
import { ReceivedInvoiceRowActions } from './ReceivedInvoiceRowActions';
import {
  STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  supplierName,
  isOverdue,
} from './utils';
import { formatDate } from '@/lib/format';

interface RowProps {
  item: ReceivedInvoiceListItem;
  companyId: string;
  pending: boolean;
  onView: (id: number) => void;
  onReview: (id: number) => void;
  onMarkPayment: (id: number, status: PaymentStatus) => void;
  onMarkAccounting: (id: number, status: AccountingStatus) => void;
  onArchive: (id: number, archived: boolean) => void;
  onDiscard: (id: number) => void;
  onHardDelete: (id: number) => void;
}

function Row(props: RowProps) {
  const { item } = props;
  const archived = item.archivedAt != null;
  const isDraft = item.status === 'draft';
  const isConfirmed = item.status === 'confirmed';
  const isDiscarded = item.status === 'discarded';
  const overdue = isOverdue(item.dueDate, item.paymentStatus, item.status);

  return (
    <tr
      className={`border-b border-gray-200 ${
        overdue
          ? 'bg-red-50 hover:bg-red-100/70'
          : archived
            ? 'opacity-60 hover:bg-gray-50/50'
            : 'hover:bg-gray-50/50'
      }`}
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
        {item.invoiceNumber ?? <span className="text-gray-400">—</span>}
      </td>
      <td className="px-4 py-3 text-sm">{supplierName(item)}</td>
      <td className="px-4 py-3 text-sm">{formatDate(item.issueDate)}</td>
      <td className="px-4 py-3 text-sm">
        {isConfirmed ? (
          <>
            {PAYMENT_STATUS_LABELS[item.paymentStatus] ?? item.paymentStatus}
            {overdue && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                Overdue
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {Number(item.grossAmount).toFixed(2)} {item.currency}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            isDiscarded
              ? 'bg-gray-200 text-gray-700'
              : isDraft
                ? 'bg-amber-100 text-amber-800'
                : 'bg-green-100 text-green-800'
          }`}
        >
          {STATUS_LABELS[item.status] ?? item.status}
        </span>
        {isConfirmed && item.accountingStatus === 'accounted' && (
          <span className="ml-1.5 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
            Accounted
          </span>
        )}
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
  onDiscard: (id: number) => void;
  onHardDelete: (id: number) => void;
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
          <th className={HEADER_CELL_CLASS}>Payment</th>
          <th className={HEADER_CELL_CLASS}>Total</th>
          <th className={HEADER_CELL_CLASS}>Status</th>
          <th className={`${HEADER_CELL_CLASS} text-right`}>Actions</th>
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
            onHardDelete={props.onHardDelete}
          />
        ))}
      </tbody>
    </table>
  );
}
