'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  getReceivedInvoice,
  setReceivedInvoiceAccountingStatus,
  setReceivedInvoicePaymentStatus,
  setReceivedInvoiceArchived,
} from '@/src/features/received-invoices/actions';
import type {
  AccountingStatus,
  PaymentStatus,
} from '@/src/features/received-invoices/types';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { requireStringParam } from '@/lib/route-params';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { PreviewPane } from '@/components/received-invoices/PreviewPane';
import { DetailHeader } from './_components/DetailHeader';
import { SupplierCard } from './_components/SupplierCard';
import { DocumentCard } from './_components/DocumentCard';
import { LineItemsTable } from './_components/LineItemsTable';
import { StatusControlsCard } from './_components/StatusControlsCard';
import { NotesCard } from './_components/NotesCard';
import { PageShell } from '@/components/page-shell';

export default function ReceivedInvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');
  const id = Number(params.id);

  const {
    data,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR(['receivedInvoice', id], () => getReceivedInvoice(id));

  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) {
    return (
      <section className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  if (fetchError || !data) {
    return (
      <PageShell>
        <ErrorAlert
          message={fetchError ? fetchError.message : 'Не е намерено.'}
          className="mb-4"
        />
        <Button variant="outline" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>← Назад към списъка</Link>
        </Button>
      </PageShell>
    );
  }

  const { row, lines, fileSignedUrl } = data;

  // Drafts redirect to the review page; the detail page is for confirmed/discarded.
  if (row.status === 'draft') {
    router.replace(`/c/${companyId}/received-invoices/review/${id}`);
    return null;
  }

  const supplier = row.supplierSnapshot;
  const archived = row.archivedAt != null;

  const handleAccounting = async (value: AccountingStatus) => {
    setActionError(null);
    const res = await setReceivedInvoiceAccountingStatus(id, value);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    refetch();
  };
  const handlePayment = async (value: PaymentStatus) => {
    setActionError(null);
    const res = await setReceivedInvoicePaymentStatus(id, value);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    refetch();
  };
  const handleArchive = async () => {
    setActionError(null);
    const res = await setReceivedInvoiceArchived(id, !archived);
    if (res.error) {
      setActionError(res.error);
      return;
    }
    refetch();
  };
  const handleEdit = () =>
    router.push(`/c/${companyId}/received-invoices/review/${id}`);

  return (
    <section className="flex-1 p-4 lg:p-6">
      <DetailHeader
        row={row}
        supplierName={supplier.legalName}
        companyId={companyId}
        archived={archived}
        onArchive={handleArchive}
        onEdit={handleEdit}
      />

      <ErrorAlert message={actionError} className="mb-4" />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-8rem)]">
          <PreviewPane
            receivedInvoiceId={id}
            fileMimeType={row.fileMimeType}
            fileOriginalName={row.fileOriginalName}
            initialSignedUrl={fileSignedUrl}
          />
        </div>
        <div className="space-y-4">
          <SupplierCard supplier={supplier} />
          <DocumentCard row={row} />
          <LineItemsTable row={row} lines={lines} />
          {row.status === 'confirmed' && (
            <StatusControlsCard
              accountingStatus={row.accountingStatus}
              paymentStatus={row.paymentStatus}
              onAccountingChange={handleAccounting}
              onPaymentChange={handlePayment}
            />
          )}
          <NotesCard notes={row.notes} />
        </div>
      </div>
    </section>
  );
}
