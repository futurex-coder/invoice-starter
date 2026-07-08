'use client';

import { Fragment, useState } from 'react';
import Link from 'next/link';
import type { Invoice } from '@/lib/db/schema';
import { formatDocTypeLabel, formatInvoiceNumber, formatMoney, formatDateBg } from '@/src/features/bulgarian-invoicing/formatter';
import {
  parseInvoiceItems,
  parseInvoiceTotalsStrict,
  parsePartySnapshotStrict,
} from '@/src/features/bulgarian-invoicing/parsers';
import { DataTableHead, DATA_ROW_CLASS } from '@/components/list-page/DataTableHead';
import { RowActionsMenu, type RowAction } from '@/components/list-page/RowActionsMenu';
import {
  PaidTogglePill,
  AccountedTogglePill,
} from '@/components/list-page/StatusTogglePill';
import {
  Eye,
  Pencil,
  Printer,
  XCircle,
  Copy,
  FileDown,
  FileUp,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  finalized: 'Finalized',
  cancelled: 'Cancelled',
};
const DOC_TYPE_BADGES: Record<string, string> = {
  credit_note: 'КИ',
  debit_note: 'ДИ',
  proforma: 'ПФ',
};

interface RowProps {
  invoice: Invoice;
  companyId: string;
  pending: boolean;
  expanded: boolean;
  onToggleExpand: (id: number) => void;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onCancel: (invoice: Invoice) => void;
  onCopy: (id: number) => void;
  onCreditNote: (id: number) => void;
  onDebitNote: (id: number) => void;
  onMarkPayment: (id: number, status: 'paid' | 'unpaid') => void;
  onMarkAccounting: (id: number, status: 'accounted' | 'pending') => void;
}

/** OI-7: read-only line-item detail rendered from the row's frozen snapshot. */
function ExpandedDetail({ invoice }: { invoice: Invoice }) {
  const items = parseInvoiceItems(invoice.items);
  const totals = parseInvoiceTotalsStrict(invoice.totals);
  return (
    <tr className="border-b border-gray-200 bg-gray-50/60">
      <td colSpan={8} className="px-6 py-3">
        {items.length === 0 ? (
          <p className="text-sm text-gray-500">No line items.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full max-w-3xl text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="py-1 pr-4">Article / Description</th>
                  <th className="py-1 pr-4">Qty</th>
                  <th className="py-1 pr-4">Unit</th>
                  <th className="py-1 pr-4 text-right">Unit price</th>
                  <th className="py-1 pr-4 text-right">Disc.%</th>
                  <th className="py-1 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const line =
                    item.quantity * item.unitPrice *
                    (1 - (item.discountPercent ?? 0) / 100);
                  return (
                    <tr key={i} className="border-t border-gray-200/70">
                      <td className="py-1.5 pr-4">{item.description}</td>
                      <td className="py-1.5 pr-4">{item.quantity}</td>
                      <td className="py-1.5 pr-4">{item.unit}</td>
                      <td className="py-1.5 pr-4 text-right">
                        {formatMoney(item.unitPrice)}
                      </td>
                      <td className="py-1.5 pr-4 text-right">
                        {item.discountPercent ?? 0}
                      </td>
                      <td className="py-1.5 text-right">{formatMoney(line)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-300 font-medium">
                  <td colSpan={5} className="py-1.5 pr-4 text-right">
                    Net {formatMoney(totals.netAmount)} · VAT{' '}
                    {formatMoney(totals.vatAmount)} · Total
                  </td>
                  <td className="py-1.5 text-right">
                    {formatMoney(totals.grossAmount)} {invoice.currency}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </td>
    </tr>
  );
}

function InvoiceRow({
  invoice,
  companyId,
  pending,
  expanded,
  onToggleExpand,
  onView,
  onEdit,
  onPrint,
  onCancel,
  onCopy,
  onCreditNote,
  onDebitNote,
  onMarkPayment,
  onMarkAccounting,
}: RowProps) {
  const totals = parseInvoiceTotalsStrict(invoice.totals);
  const recipient = parsePartySnapshotStrict(invoice.recipientSnapshot);
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
          { icon: XCircle, label: 'Cancel', onClick: () => onCancel(invoice) },
          { icon: Copy, label: 'Copy', onClick: () => onCopy(invoice.id) },
          { icon: FileDown, label: 'Create credit note', onClick: () => onCreditNote(invoice.id) },
          { icon: FileUp, label: 'Create debit note', onClick: () => onDebitNote(invoice.id) },
        ]
      : []),
  ];

  return (
    <tr className={isOverdue ? 'border-b border-gray-200 bg-red-50 hover:bg-red-100/70' : DATA_ROW_CLASS}>
      <td className="px-4 py-3 text-sm">
        <button
          type="button"
          onClick={() => onToggleExpand(invoice.id)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse line items' : 'Expand line items'}
          className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <ChevronRight
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')}
          />
        </button>
        <Link
          href={`/c/${companyId}/invoices/${invoice.id}`}
          className="font-medium text-blue-700 hover:underline"
        >
          {invoice.number != null ? formatInvoiceNumber(invoice.number) : `#${invoice.id}`}
        </Link>
        {isNote && (
          <span
            className="ml-1.5 inline-flex rounded bg-violet-100 px-1 py-0.5 text-[10px] font-semibold text-violet-700"
            title={formatDocTypeLabel(invoice.docType)}
          >
            {DOC_TYPE_BADGES[invoice.docType] ?? invoice.docType}
          </span>
        )}
        {isNote && invoice.referencedInvoiceId && (
          <Link
            href={`/c/${companyId}/invoices/${invoice.referencedInvoiceId}`}
            className="ml-2 text-xs text-blue-600 hover:underline"
          >
            → parent
          </Link>
        )}
      </td>
      <td className="px-4 py-3 text-sm">
        {recipient.legalName ? (
          <Link
            href={`/c/${companyId}/partners?search=${encodeURIComponent(recipient.legalName)}`}
            className="hover:underline"
          >
            {recipient.legalName}
          </Link>
        ) : (
          '—'
        )}
      </td>
      <td className="px-4 py-3 text-sm">{formatDateBg(invoice.issueDate)}</td>
      <td className="px-4 py-3 text-sm font-medium">
        {formatMoney(totals.grossAmount)} {invoice.currency}
      </td>
      <td className="px-4 py-3">
        <PaidTogglePill
          value={invoice.paymentStatus ?? 'unpaid'}
          pending={pending}
          disabled={!isIssued}
          onChange={(next) => onMarkPayment(invoice.id, next)}
        />
        {isOverdue && (
          <span className="ml-1.5 inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
            Overdue
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <AccountedTogglePill
          value={invoice.accountingStatus ?? 'pending'}
          pending={pending}
          disabled={!isIssued}
          onChange={(next) => onMarkAccounting(invoice.id, next)}
        />
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
            isCancelled
              ? 'bg-gray-200 text-gray-700'
              : isDraft
              ? 'bg-amber-100 text-amber-800'
              : 'bg-green-100 text-green-800'
          )}
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
  pendingId: number | null;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
  onPrint: (id: number) => void;
  onCancel: (invoice: Invoice) => void;
  onCopy: (id: number) => void;
  onCreditNote: (id: number) => void;
  onDebitNote: (id: number) => void;
  onMarkPayment: (id: number, status: 'paid' | 'unpaid') => void;
  onMarkAccounting: (id: number, status: 'accounted' | 'pending') => void;
}

export function InvoicesTable(props: TableProps) {
  // OI-7: one expanded row at a time — the detail renders from the row's
  // already-loaded items snapshot, no extra fetch.
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <table className="w-full">
      <DataTableHead
        columns={[
          { label: 'Number' },
          { label: 'Client' },
          { label: 'Date' },
          { label: 'Total' },
          { label: 'Paid' },
          { label: 'Accounted' },
          { label: 'Status' },
          { label: 'Actions', align: 'right' },
        ]}
      />
      <tbody>
        {props.invoices.map((inv) => (
          <Fragment key={inv.id}>
            <InvoiceRow
              invoice={inv}
              companyId={props.companyId}
              pending={props.pendingId === inv.id}
              expanded={expandedId === inv.id}
              onToggleExpand={(id) =>
                setExpandedId((cur) => (cur === id ? null : id))
              }
              onView={props.onView}
              onEdit={props.onEdit}
              onPrint={props.onPrint}
              onCancel={props.onCancel}
              onCopy={props.onCopy}
              onCreditNote={props.onCreditNote}
              onDebitNote={props.onDebitNote}
              onMarkPayment={props.onMarkPayment}
              onMarkAccounting={props.onMarkAccounting}
            />
            {expandedId === inv.id && <ExpandedDetail invoice={inv} />}
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
