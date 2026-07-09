import type { ReceivedInvoiceListItem } from '@/src/features/received-invoices/actions';

export const STATUS_LABELS: Record<string, string> = {
  analyzing: 'Анализира се…',
  failed: 'Неуспешно',
  draft: 'Чернова',
  confirmed: 'Потвърдена',
  discarded: 'Отхвърлена',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: 'Неплатена',
  partial: 'Частично',
  paid: 'Платена',
};

export function supplierName(item: ReceivedInvoiceListItem): string {
  if (item.partnerName) return item.partnerName;
  return item.supplierSnapshot.legalName ?? '—';
}

export function isOverdue(
  dueDate: string | null,
  paymentStatus: string,
  status: string
): boolean {
  if (status !== 'confirmed') return false;
  if (paymentStatus === 'paid') return false;
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

export interface ListData {
  items: ReceivedInvoiceListItem[];
  total: number;
  page: number;
  pageSize: number;
  pendingCount: number;
}
