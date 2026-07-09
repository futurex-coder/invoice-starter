import { redirect } from 'next/navigation';
import { requireUserOrRedirect } from '@/lib/auth/guards';
import { verifyCompanyAccess } from '@/lib/db/queries';
import { queryReceivedInvoicesList } from '@/src/features/received-invoices/queries';
import { ReceivedInvoicesPageClient } from './_components/ReceivedInvoicesPageClient';

// PERF (R2/T2): SSR-seed the default received-invoices working set (page 1,
// non-discarded, non-archived) so rows render on first paint instead of via a
// post-hydration server action. Must match the default action args in
// ReceivedInvoicesPageClient (status/payment 'all' → undefined, archived
// 'false' → includeArchived:false).
export default async function ReceivedInvoicesPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: companyIdStr } = await params;
  const companyId = Number(companyIdStr);
  if (!Number.isInteger(companyId)) redirect('/dashboard');

  const user = await requireUserOrRedirect();
  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) redirect('/dashboard');

  const fallbackData = await queryReceivedInvoicesList(companyId, {
    page: 1,
    pageSize: 20,
    includeArchived: false,
  });

  return <ReceivedInvoicesPageClient fallbackData={fallbackData} />;
}
