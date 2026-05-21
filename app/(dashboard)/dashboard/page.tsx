'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  getDashboardData,
  getDashboardActivityAction,
  getDeletedCompaniesAction,
  restoreCompanyAction,
} from '@/src/features/invoicing/actions';
import { Loader2, Plus } from 'lucide-react';
import { SummaryGrid } from './_components/SummaryGrid';
import { CompaniesGrid } from './_components/CompaniesGrid';
import { ActivityFeed } from './_components/ActivityFeed';
import { DeletedCompaniesCard } from './_components/DeletedCompaniesCard';
import { ManageSubscription } from './_components/ManageSubscription';
import { EmptyDashboard } from './_components/EmptyDashboard';
import type {
  CompanyMetric,
  Totals,
  ActivityLog,
  DeletedCompanyRow,
} from './_components/types';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyMetric[]>([]);
  const [totals, setTotals] = useState<Totals>({
    revenue: 0,
    outstanding: 0,
    invoiceCount: 0,
    overdueCount: 0,
  });
  const [activity, setActivity] = useState<ActivityLog[]>([]);
  const [onlyOwn, setOnlyOwn] = useState(true);
  const [activityLoading, setActivityLoading] = useState(false);
  const [deletedCompanies, setDeletedCompanies] = useState<DeletedCompanyRow[]>([]);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const loadDeletedCompanies = useCallback(async () => {
    const res = await getDeletedCompaniesAction();
    if (res.data) setDeletedCompanies(res.data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [metricsRes, activityRes] = await Promise.all([
        getDashboardData(),
        getDashboardActivityAction(true),
        loadDeletedCompanies(),
      ]);
      setLoading(false);
      if (metricsRes.data) {
        setCompanies(metricsRes.data.companies);
        setTotals(metricsRes.data.totals);
      }
      if (activityRes.data) {
        setActivity(activityRes.data);
      }
    })();
  }, [loadDeletedCompanies]);

  const toggleActivity = useCallback(async () => {
    const next = !onlyOwn;
    setOnlyOwn(next);
    setActivityLoading(true);
    const res = await getDashboardActivityAction(next);
    setActivityLoading(false);
    if (res.data) setActivity(res.data);
  }, [onlyOwn]);

  const handleRestore = useCallback(async (companyId: number) => {
    setRestoringId(companyId);
    const res = await restoreCompanyAction(companyId);
    setRestoringId(null);
    if (res.error) return;
    setDeletedCompanies((prev) => prev.filter((d) => d.company.id !== companyId));
    const metricsRes = await getDashboardData();
    if (metricsRes.data) {
      setCompanies(metricsRes.data.companies);
      setTotals(metricsRes.data.totals);
    }
  }, []);

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  const hasMultipleCurrencies = new Set(companies.map((c) => c.currency)).size > 1;
  const hasOwnerRole = companies.some((c) => c.role === 'owner');

  if (companies.length === 0) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium mb-6">Dashboard</h1>
        <EmptyDashboard />
        <DeletedCompaniesCard
          rows={deletedCompanies}
          restoringId={restoringId}
          onRestore={handleRestore}
          className="mt-6"
        />
        <div className="mt-6">
          <ManageSubscription />
        </div>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Dashboard</h1>
        <Button
          asChild
          size="sm"
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Link href="/create-company">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New company
          </Link>
        </Button>
      </div>

      <SummaryGrid totals={totals} hasMultipleCurrencies={hasMultipleCurrencies} />

      <CompaniesGrid companies={companies} />

      <ActivityFeed
        activity={activity}
        onlyOwn={onlyOwn}
        loading={activityLoading}
        showToggle={hasOwnerRole}
        onToggle={toggleActivity}
      />

      <DeletedCompaniesCard
        rows={deletedCompanies}
        restoringId={restoringId}
        onRestore={handleRestore}
        className="mb-8"
      />

      <ManageSubscription />
    </section>
  );
}
