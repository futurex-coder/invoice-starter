import { redirect } from 'next/navigation';
import { requireUserOrRedirect } from '@/lib/auth/guards';
import { verifyCompanyAccess } from '@/lib/db/queries';
import { queryInvoicesList } from '@/src/features/bulgarian-invoicing/queries';
import { InvoicesPageClient } from './_components/InvoicesPageClient';

// PERF (R2/T2): server component that SSR-fetches the default invoice list
// (page 1, no filters) and hands it to the client body as `fallbackData`, so
// the table renders from server data on first paint instead of firing a
// server-action fetch after hydration. Seeds by the URL companyId — never the
// active-company cookie — so a direct link to another company can't seed the
// wrong rows. Access is enforced here exactly as the layout does (both use the
// `cache()`-deduped guards, so this adds no extra round-trips).
export default async function InvoicesPage({
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

  // Must match the default SWR key's action args in InvoicesPageClient:
  // buildActionFilters(INVOICES_DEFAULTS, page=1, pageSize=20) → all filters
  // undefined. Keep in sync if the client defaults change.
  const fallbackData = await queryInvoicesList(companyId, {
    page: 1,
    pageSize: 20,
  });

  return <InvoicesPageClient fallbackData={fallbackData} />;
}
