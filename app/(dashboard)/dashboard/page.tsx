'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  getDashboardData,
  getDashboardActivityAction,
  getDeletedCompaniesAction,
  restoreCompanyAction,
} from '@/src/features/invoicing/actions';
import { Loader2, Plus, Inbox } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { SummaryGrid } from './_components/SummaryGrid';
import { CompaniesGrid } from './_components/CompaniesGrid';
import { ActivityFeed } from './_components/ActivityFeed';
import { DeletedCompaniesCard } from './_components/DeletedCompaniesCard';
import { ManageSubscription } from './_components/ManageSubscription';
import { EmptyDashboard } from './_components/EmptyDashboard';
import { PageShell } from '@/components/page-shell';

const EMPTY_TOTALS = {
  revenue: 0,
  outstanding: 0,
  invoiceCount: 0,
  overdueCount: 0,
  expensesPaid: 0,
  expensesOutstanding: 0,
  receivedCount: 0,
  pendingReviewCount: 0,
};

export default function DashboardPage() {
  const [onlyOwn, setOnlyOwn] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const { data: metrics, isLoading: metricsLoading, mutate: refetchMetrics } =
    useActionSWR('dashboardMetrics', getDashboardData);

  const {
    data: activity,
    isValidating: activityLoading,
    mutate: refetchActivity,
  } = useActionSWR(
    ['dashboardActivity', onlyOwn],
    () => getDashboardActivityAction(onlyOwn)
  );

  const { data: deletedCompanies, mutate: refetchDeleted } = useActionSWR(
    'deletedCompanies',
    getDeletedCompaniesAction
  );

  const loading = metricsLoading;
  const companies = metrics?.companies ?? [];
  const totals = metrics?.totals ?? EMPTY_TOTALS;

  // GEN-1: cross-company totals sum raw amounts, so a single currency label is
  // only honest when every company shares one base currency.
  const currencies = Array.from(new Set(companies.map((c) => c.currency)));
  const totalsCurrency = currencies.length === 1 ? currencies[0] ?? null : null;

  const toggleActivity = useCallback(() => {
    setOnlyOwn((v) => !v);
  }, []);

  const handleRestore = useCallback(
    async (companyId: number) => {
      setRestoringId(companyId);
      const res = await restoreCompanyAction(companyId);
      setRestoringId(null);
      if (res.error) return;
      await Promise.all([refetchMetrics(), refetchDeleted(), refetchActivity()]);
    },
    [refetchMetrics, refetchDeleted, refetchActivity]
  );

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </PageShell>
    );
  }

  const hasOwnerRole = companies.some((c) => c.role === 'owner');
  const pendingReviewTarget = companies.find((c) => c.pendingReviewCount > 0);

  if (companies.length === 0) {
    return (
      <PageShell>
        <h1 className="text-lg lg:text-2xl font-medium mb-6">Табло</h1>
        <EmptyDashboard />
        <DeletedCompaniesCard
          rows={deletedCompanies ?? []}
          restoringId={restoringId}
          onRestore={handleRestore}
          className="mt-6"
        />
        <div className="mt-6">
          <ManageSubscription />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Табло</h1>
        <Button
          asChild
          size="sm"
          className="bg-primary hover:bg-primary/90 text-white"
        >
          <Link href="/create-company">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Нова фирма
          </Link>
        </Button>
      </div>

      {totals.pendingReviewCount > 0 && (
        <Alert variant="warning" icon={Inbox} className="mb-6 items-center">
          <div className="flex items-center justify-between gap-3">
            <span>
              <strong>{totals.pendingReviewCount}</strong>{' '}
              {totals.pendingReviewCount === 1
                ? 'получена фактура очаква'
                : 'получени фактури очакват'}{' '}
              преглед във вашите фирми
            </span>
            {pendingReviewTarget && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/c/${pendingReviewTarget.companyId}/received-invoices`}>
                  Прегледай
                </Link>
              </Button>
            )}
          </div>
        </Alert>
      )}

      <SummaryGrid totals={totals} currency={totalsCurrency} />

      <CompaniesGrid companies={companies} />

      <ActivityFeed
        activity={activity ?? []}
        onlyOwn={onlyOwn}
        loading={activityLoading}
        showToggle={hasOwnerRole}
        onToggle={toggleActivity}
      />

      <DeletedCompaniesCard
        rows={deletedCompanies ?? []}
        restoringId={restoringId}
        onRestore={handleRestore}
        className="mb-8"
      />

      <ManageSubscription />
    </PageShell>
  );
}
