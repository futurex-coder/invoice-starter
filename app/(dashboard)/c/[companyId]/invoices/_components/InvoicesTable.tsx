'use client';

import Link from 'next/link';
import type { Invoice } from '@/lib/db/schema';
import { formatDocTypeLabel, formatInvoiceNumber, formatMoney, formatDateBg } from '@/src/features/bulgarian-invoicing/formatter';
import { DataTableHead, DATA_ROW_CLASS } from '@/components/list-page/DataTableHead';
import { RowActionsMenu, type RowAction } from '@/components/list-page/RowActionsMenu';
import {
  Eye,
  Pencil,
  Printer,
  XCircle,
  Copy,
  FileDown,
  FileUp,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
  cancelled: 'Cancelled',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  partial: 'Partial',
};

interface RowProps {
  invoice: Invoice;
  companyId: string;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onCancel: (id: number) => void;
  onCopy: (id: number) => void;
  onCreditNote: (id: number) => void;
  onDebitNote: (id: number) => void;
}

function InvoiceRow({
  invoice,
  companyId,
  onView,
  onEdit,
  onPrint,
  onCancel,
  onCopy,
  onCreditNote,
  onDebitNote,
}: RowProps) {
  const totals = (invoice.totals ?? { grossAmount: 0 }) as { grossAmount: number };
  const recipient = (invoice.recipientSnapshot ?? {}) as { legalName?: string };
  const isDraft = invoice.status === 'draft';
  const isIssued = invoice.status === 'finalized';
  const isCancelled = invoice.status === 'cancelled';
  const isNote = invoice.docType === 'credit_note' || invoice.docType === 'debit_note';
  const isOverdue =
    invoice.status === 'finalized' &&
    invoice.paymentStatus === 'unpaid' &&
    invoice.dueDate != null &&
    new Date(invoice.dueDate) < new Date(new Date().toISOString().split('T')[0]);

  const actions: RowAction[] = [
    { icon: Eye, label: 'View', onClick: () => onView(invoice.id) },
    ...(isDraft
      ? [{ icon: Pencil, label: 'Edit draft', onClick: () => onEdit(invoice.id) }]
      : []),
    { icon: Printer, label: 'Print / Preview', onClick: () => onPrint(invoice.id) },
    ...(!isCancelled && isIssued
      ? [
          { icon: XCircle, label: 'Cancel', onClick: () => onCancel(invoice.id) },
          { icon: Copy, label: 'Copy', onClick: () => onCopy(invoice.id) },
          { icon: FileDown, label: 'Create credit note', onClick: () => onCreditNote(invoice.id) },
          { icon: FileUp, label: 'Create debit note', onClick: () => onDebitNote(invoice.id) },
        ]
      : []),
  ];

  return (
    <tr className={isOverdue ? 'border-b border-gray-200 bg-red-50 hover:bg-red-100/70' : DATA_ROW_CLASS}>
      <td className="px-4 py-3 text-sm">
        {invoice.number != null ? formatInvoiceNumber(invoice.number) : `#${invoice.id}`}
        {isNote && invoice.referencedInvoiceId && (
          <Link
            href={`/c/${companyId}/invoices/${invoice.referencedInvoiceId}`}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            → parent
          </Link>
        )}
      </td>
      <td className="px-4 py-3 text-sm">{formatDocTypeLabel(invoice.docType)}</td>
      <td className="px-4 py-3 text-sm">{recipient.legalName ?? '—'}</td>
      <td className="px-4 py-3 text-sm">{formatDateBg(invoice.issueDate)}</td>
      <td className="px-4 py-3 text-sm">
        {PAYMENT_STATUS_LABELS[invoice.paymentStatus ?? 'unpaid'] ?? invoice.paymentStatus}
        {isOverdue && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
            Overdue
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        {formatMoney(totals.grossAmount)} {invoice.currency}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            isCancelled
              ? 'bg-gray-200 text-gray-700'
              : isDraft
              ? 'bg-amber-100 text-amber-800'
              : 'bg-green-100 text-green-800'
          }`}
        >
          {STATUS_LABELS[invoice.status] ?? invoice.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        <RowActionsMenu actions={actions} />
      </td>
    </tr>
  );
}

interface TableProps {
  invoices: Invoice[];
  companyId: string;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onCancel: (id: number) => void;
  onCopy: (id: number) => void;
  onCreditNote: (id: number) => void;
  onDebitNote: (id: number) => void;
}

export function InvoicesTable(props: TableProps) {
  return (
    <table className="w-full">
      <DataTableHead
        columns={[
          { label: 'Number' },
          { label: 'Type' },
          { label: 'Client' },
          { label: 'Date' },
          { label: 'Payment' },
          { label: 'Total' },
          { label: 'Status' },
          { label: 'Actions', align: 'right' },
        ]}
      />
      <tbody>
        {props.invoices.map((inv) => (
          <InvoiceRow
            key={inv.id}
            invoice={inv}
            companyId={props.companyId}
            onView={props.onView}
            onEdit={props.onEdit}
            onPrint={props.onPrint}
            onCancel={props.onCancel}
            onCopy={props.onCopy}
            onCreditNote={props.onCreditNote}
            onDebitNote={props.onDebitNote}
          />
        ))}
      </tbody>
    </table>
  );
}
