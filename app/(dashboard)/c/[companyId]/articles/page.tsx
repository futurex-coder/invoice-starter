import { redirect } from 'next/navigation';
import { requireUserOrRedirect } from '@/lib/auth/guards';
import { verifyCompanyAccess } from '@/lib/db/queries';
import { queryArticlesList } from '@/src/features/invoicing/queries';
import { ArticlesPageClient } from './_components/ArticlesPageClient';

// PERF (R2/T2): SSR-seed the default articles list (page 1, no search) so rows
// render on first paint instead of via a post-hydration server action.
export default async function ArticlesPage({
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

  const fallbackData = await queryArticlesList(companyId, {
    page: 1,
    pageSize: 20,
  });

  return <ArticlesPageClient fallbackData={fallbackData} />;
}
