import { redirect } from 'next/navigation';
import { requireUserOrRedirect } from '@/lib/auth/guards';
import { verifyCompanyAccess } from '@/lib/db/queries';
import { queryPartnersList } from '@/src/features/invoicing/queries';
import { PartnersPageClient } from './_components/PartnersPageClient';

// PERF (R2/T2): SSR-seed the default partners list (page 1, no search) so rows
// render on first paint instead of via a post-hydration server action. Seeds by
// URL companyId; access enforced via the cache()-deduped guards (no extra
// round-trips vs. the layout).
export default async function PartnersPage({
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

  const fallbackData = await queryPartnersList(companyId, {
    page: 1,
    pageSize: 20,
  });

  return <PartnersPageClient fallbackData={fallbackData} />;
}
