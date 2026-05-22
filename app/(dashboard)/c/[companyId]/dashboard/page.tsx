import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { companies } from '@/lib/db/schema';
import {
  getUser,
  verifyCompanyAccess,
  getPartnersForCompany,
  getArticlesForCompany,
  getActivityLogs,
  getNextInvoiceNumber,
} from '@/lib/db/queries';
import { FileText, Handshake, Inbox, Package, Settings } from 'lucide-react';
import { CompanyHeader } from './_components/CompanyHeader';
import { PendingReviewBanner } from './_components/PendingReviewBanner';
import { MetricsSummary } from './_components/MetricsSummary';
import { InvoiceBreakdownCard } from './_components/InvoiceBreakdownCard';
import { ReceivedBreakdownCard } from './_components/ReceivedBreakdownCard';
import { QuickLinksCard, type QuickLink } from './_components/QuickLinksCard';
import { ActivityFeed } from './_components/ActivityFeed';
import { getCompanyMetrics, getCompanyExpenseMetrics } from './_components/queries';

export const dynamic = 'force-dynamic';

export default async function CompanyDashboardPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: companyIdStr } = await params;
  const companyId = Number(companyIdStr);

  const user = await getUser();
  if (!user) redirect('/sign-in');

  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) redirect('/dashboard');

  const [companyRows] = await Promise.all([
    db.select().from(companies).where(eq(companies.id, companyId)).limit(1),
  ]);
  const company = companyRows[0];
  if (!company) redirect('/dashboard');

  const [
    metrics,
    expenseMetrics,
    partners,
    articlesList,
    activity,
    nextNumber,
  ] = await Promise.all([
    getCompanyMetrics(companyId),
    getCompanyExpenseMetrics(companyId),
    getPartnersForCompany(companyId),
    getArticlesForCompany(companyId),
    getActivityLogs(companyId, { limit: 5 }),
    getNextInvoiceNumber(companyId, 'INV'),
  ]);

  const base = `/c/${companyId}`;

  const quickLinks: QuickLink[] = [
    {
      href: `${base}/invoices`,
      icon: FileText,
      label: 'Invoices',
      count: metrics.totalInvoices,
    },
    {
      href: `${base}/invoices/new`,
      icon: FileText,
      label: 'New Invoice',
      sub: `Next #${String(nextNumber).padStart(10, '0')}`,
    },
    {
      href: `${base}/received-invoices`,
      icon: Inbox,
      label: 'Received invoices',
      count: expenseMetrics.receivedThisMonth + expenseMetrics.accountedCount,
      sub:
        expenseMetrics.pendingReviewCount > 0
          ? `${expenseMetrics.pendingReviewCount} pending`
          : undefined,
    },
    {
      href: `${base}/received-invoices/upload`,
      icon: Inbox,
      label: 'Upload invoice',
    },
    {
      href: `${base}/partners`,
      icon: Handshake,
      label: 'Partners',
      count: partners.length,
    },
    {
      href: `${base}/articles`,
      icon: Package,
      label: 'Articles',
      count: articlesList.length,
    },
    {
      href: `${base}/settings`,
      icon: Settings,
      label: 'Company Settings',
    },
  ];

  return (
    <section className="flex-1 p-4 lg:p-8">
      <CompanyHeader
        legalName={company.legalName}
        eik={company.eik}
        role={membership.role}
      />

      <PendingReviewBanner
        count={expenseMetrics.pendingReviewCount}
        reviewHref={`${base}/received-invoices`}
      />

      <MetricsSummary
        metrics={metrics}
        expenseMetrics={expenseMetrics}
        currency={company.defaultCurrency}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <InvoiceBreakdownCard
          metrics={metrics}
          partnerCount={partners.length}
          articleCount={articlesList.length}
        />
        <ReceivedBreakdownCard
          expenseMetrics={expenseMetrics}
          viewAllHref={`${base}/received-invoices`}
        />
        <QuickLinksCard links={quickLinks} />
      </div>

      <ActivityFeed activity={activity} />
    </section>
  );
}
