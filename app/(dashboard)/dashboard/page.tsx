'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { ActivityType, type User } from '@/lib/db/schema';
import useSWR from 'swr';
import {
  getDashboardData,
  getDashboardActivityAction,
} from '@/src/features/invoicing/actions';
import {
  Loader2,
  Building2,
  Plus,
  ArrowRight,
  DollarSign,
  Clock,
  FileText,
  AlertTriangle,
  Crown,
  Activity,
  Eye,
  EyeOff,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type CompanyMetric = {
  companyId: number;
  companyName: string;
  currency: string;
  revenue: number;
  outstanding: number;
  invoiceCountThisMonth: number;
  overdueCount: number;
  role: string;
};

type Totals = {
  revenue: number;
  outstanding: number;
  invoiceCount: number;
  overdueCount: number;
};

type ActivityLog = {
  id: number;
  action: string;
  timestamp: Date | null;
  ipAddress: string | null;
  userName: string | null;
  userId: number | null;
  companyId: number;
  companyName: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  [ActivityType.SIGN_UP]: 'Signed up',
  [ActivityType.SIGN_IN]: 'Signed in',
  [ActivityType.SIGN_OUT]: 'Signed out',
  [ActivityType.UPDATE_PASSWORD]: 'Updated password',
  [ActivityType.DELETE_ACCOUNT]: 'Deleted account',
  [ActivityType.UPDATE_ACCOUNT]: 'Updated account',
  [ActivityType.CREATE_COMPANY]: 'Created company',
  [ActivityType.UPDATE_COMPANY]: 'Updated company settings',
  [ActivityType.DELETE_COMPANY]: 'Deleted company',
  [ActivityType.RESTORE_COMPANY]: 'Restored company',
  [ActivityType.TRANSFER_OWNERSHIP]: 'Transferred ownership',
  [ActivityType.INVITE_MEMBER]: 'Invited a member',
  [ActivityType.ACCEPT_INVITATION]: 'Accepted invitation',
  [ActivityType.REMOVE_MEMBER]: 'Removed a member',
  [ActivityType.CREATE_INVOICE]: 'Created an invoice',
  [ActivityType.UPDATE_INVOICE]: 'Updated an invoice',
  [ActivityType.FINALIZE_INVOICE]: 'Finalized an invoice',
  [ActivityType.CANCEL_INVOICE]: 'Cancelled an invoice',
  [ActivityType.CREATE_CREDIT_NOTE]: 'Created a credit note',
  [ActivityType.CREATE_DEBIT_NOTE]: 'Created a debit note',
};

function formatCurrency(amount: number) {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function relativeTime(date: Date | null): string {
  if (!date) return '';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// ─── Subscription Section ───────────────────────────────────────────────────

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function ManageSubscription() {
  const { data: user } = useSWR<User>('/api/user', fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="mb-4 sm:mb-0">
            <p className="font-medium">
              Current Plan: {user?.planName || 'Free'}
            </p>
            <p className="text-sm text-muted-foreground">
              {user?.subscriptionStatus === 'active'
                ? 'Billed monthly'
                : user?.subscriptionStatus === 'trialing'
                  ? 'Trial period'
                  : 'No active subscription'}
            </p>
          </div>
          <form action={customerPortalAction}>
            <Button type="submit" variant="outline">
              Manage Subscription
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [metricsRes, activityRes] = await Promise.all([
        getDashboardData(),
        getDashboardActivityAction(true),
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
  }, []);

  const toggleActivity = useCallback(async () => {
    const next = !onlyOwn;
    setOnlyOwn(next);
    setActivityLoading(true);
    const res = await getDashboardActivityAction(next);
    setActivityLoading(false);
    if (res.data) setActivity(res.data);
  }, [onlyOwn]);

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  const hasMultipleCurrencies =
    new Set(companies.map((c) => c.currency)).size > 1;
  const hasOwnerRole = companies.some((c) => c.role === 'owner');

  // ─── Empty state ────────────────────────────────────────────────────────
  if (companies.length === 0) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium mb-6">Dashboard</h1>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="h-14 w-14 text-gray-300 mb-4" />
            <h2 className="text-lg font-medium mb-2">No companies yet</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Create your first company to start issuing invoices and tracking
              revenue.
            </p>
            <Button
              asChild
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <Link href="/create-company">
                <Plus className="mr-2 h-4 w-4" />
                Create your first company
              </Link>
            </Button>
          </CardContent>
        </Card>
        <div className="mt-6">
          <ManageSubscription />
        </div>
      </section>
    );
  }

  // ─── Main dashboard ─────────────────────────────────────────────────────
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

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Total Revenue"
          value={formatCurrency(totals.revenue)}
          sub={hasMultipleCurrencies ? 'mixed currencies' : undefined}
          color="green"
        />
        <SummaryCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Outstanding"
          value={formatCurrency(totals.outstanding)}
          sub={hasMultipleCurrencies ? 'mixed currencies' : undefined}
          color="amber"
        />
        <SummaryCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Invoices This Month"
          value={String(totals.invoiceCount)}
          color="blue"
        />
        <SummaryCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Overdue"
          value={String(totals.overdueCount)}
          color={totals.overdueCount > 0 ? 'red' : 'gray'}
          highlight={totals.overdueCount > 0}
        />
      </div>

      {/* Per-company breakdown */}
      <h2 className="text-base font-medium mb-3">Your companies</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {companies.map((c) => (
          <Link
            key={c.companyId}
            href={`/c/${c.companyId}/invoices`}
            className="group"
          >
            <Card className="h-full border-gray-200 hover:border-orange-300 hover:shadow-sm transition-all">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium group-hover:text-orange-600 transition-colors">
                    {c.companyName}
                  </CardTitle>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      c.role === 'owner'
                        ? 'bg-orange-100 text-orange-800'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {c.role === 'owner' && <Crown className="h-3 w-3" />}
                    {c.role === 'owner' ? 'Owner' : 'Accountant'}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {c.currency}
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-sm font-semibold text-green-700">
                      {formatCurrency(c.revenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Outstanding
                    </p>
                    <p className="text-sm font-semibold text-amber-700">
                      {formatCurrency(c.outstanding)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                    <p
                      className={`text-sm font-semibold ${
                        c.overdueCount > 0 ? 'text-red-600' : 'text-gray-500'
                      }`}
                    >
                      {c.overdueCount}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-end text-xs text-muted-foreground group-hover:text-orange-500 transition-colors">
                  View invoices
                  <ArrowRight className="ml-1 h-3 w-3" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent activity */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              {onlyOwn ? 'Your actions' : 'All member activity'}
            </CardDescription>
          </div>
          {hasOwnerRole && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1.5"
              onClick={toggleActivity}
              disabled={activityLoading}
            >
              {activityLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : onlyOwn ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
              {onlyOwn ? 'Show all activity' : 'Only my actions'}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm">No recent activity</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    <Activity className="h-3.5 w-3.5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p>
                      <span className="font-medium">
                        {a.userName || 'Unknown'}
                      </span>{' '}
                      <span className="text-muted-foreground">
                        {ACTIVITY_LABELS[a.action] ?? a.action}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.companyName} · {relativeTime(a.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Subscription */}
      <ManageSubscription />
    </section>
  );
}

// ─── Summary Card ───────────────────────────────────────────────────────────

function SummaryCard({
  icon,
  label,
  value,
  sub,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color: string;
  highlight?: boolean;
}) {
  const bgMap: Record<string, string> = {
    green: 'bg-green-50',
    amber: 'bg-amber-50',
    blue: 'bg-blue-50',
    red: 'bg-red-50',
    gray: 'bg-gray-50',
  };
  return (
    <Card
      className={`${highlight ? 'border-red-300 bg-red-50/30' : ''}`}
    >
      <CardContent className="pt-5">
        <div className="flex items-center gap-3 mb-2">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${bgMap[color] ?? 'bg-gray-50'}`}
          >
            {icon}
          </div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </p>
        </div>
        <p className="text-2xl font-bold">{value}</p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-muted-foreground italic">
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
