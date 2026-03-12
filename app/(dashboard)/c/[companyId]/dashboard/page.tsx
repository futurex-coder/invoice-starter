import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { ActivityType } from '@/lib/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { invoices, companies } from '@/lib/db/schema';
import {
  getUser,
  verifyCompanyAccess,
  getPartnersForCompany,
  getArticlesForCompany,
  getActivityLogs,
  getNextInvoiceNumber,
} from '@/lib/db/queries';
import {
  DollarSign,
  Clock,
  FileText,
  AlertTriangle,
  Handshake,
  Package,
  Activity,
  ArrowRight,
  Building2,
  Crown,
  Settings,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const ACTIVITY_LABELS: Record<string, string> = {
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

function relativeTime(date: Date): string {
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

function formatCurrency(amount: number) {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

async function getCompanyMetrics(companyId: number) {
  const [row] = await db
    .select({
      revenue: sql<string>`coalesce(sum(
        case when ${invoices.docType} = 'invoice'
             and ${invoices.status} = 'finalized'
             and ${invoices.paymentStatus} = 'paid'
        then (${invoices.totals}->>'grossAmount')::numeric else 0 end
      ), 0)`,
      outstanding: sql<string>`coalesce(sum(
        case when ${invoices.docType} = 'invoice'
             and ${invoices.status} = 'finalized'
             and ${invoices.paymentStatus} = 'unpaid'
        then (${invoices.totals}->>'grossAmount')::numeric else 0 end
      ), 0)`,
      invoiceCountThisMonth: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice'
          and date_trunc('month', ${invoices.issueDate}::timestamp) = date_trunc('month', now())
      )`,
      overdueCount: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice'
          and ${invoices.status} = 'finalized'
          and ${invoices.paymentStatus} = 'unpaid'
          and ${invoices.dueDate}::date < current_date
      )`,
      totalInvoices: sql<number>`count(*) filter (where ${invoices.docType} = 'invoice')`,
      draftCount: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice' and ${invoices.status} = 'draft'
      )`,
      finalizedCount: sql<number>`count(*) filter (
        where ${invoices.docType} = 'invoice' and ${invoices.status} = 'finalized'
      )`,
      creditNotes: sql<number>`count(*) filter (where ${invoices.docType} = 'credit_note')`,
      debitNotes: sql<number>`count(*) filter (where ${invoices.docType} = 'debit_note')`,
    })
    .from(invoices)
    .where(eq(invoices.companyId, companyId));

  return {
    revenue: parseFloat(row.revenue),
    outstanding: parseFloat(row.outstanding),
    invoiceCountThisMonth: row.invoiceCountThisMonth,
    overdueCount: row.overdueCount,
    totalInvoices: row.totalInvoices,
    draftCount: row.draftCount,
    finalizedCount: row.finalizedCount,
    creditNotes: row.creditNotes,
    debitNotes: row.debitNotes,
  };
}

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

  const [metrics, partners, articlesList, activity, nextNumber] =
    await Promise.all([
      getCompanyMetrics(companyId),
      getPartnersForCompany(companyId),
      getArticlesForCompany(companyId),
      getActivityLogs(companyId, { limit: 5 }),
      getNextInvoiceNumber(companyId, 'INV'),
    ]);

  const base = `/c/${companyId}`;

  const quickLinks = [
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
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-orange-500" />
        <div>
          <h1 className="text-lg lg:text-2xl font-medium">
            {company.legalName}
          </h1>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground font-mono">
              EIK: {company.eik}
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                membership.role === 'owner'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {membership.role === 'owner' && <Crown className="h-3 w-3" />}
              {membership.role === 'owner' ? 'Owner' : 'Accountant'}
            </span>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          icon={<DollarSign className="h-5 w-5 text-green-600" />}
          label="Revenue"
          value={`${formatCurrency(metrics.revenue)} ${company.defaultCurrency}`}
          color="green"
        />
        <MetricCard
          icon={<Clock className="h-5 w-5 text-amber-600" />}
          label="Outstanding"
          value={`${formatCurrency(metrics.outstanding)} ${company.defaultCurrency}`}
          color="amber"
        />
        <MetricCard
          icon={<FileText className="h-5 w-5 text-blue-600" />}
          label="Invoices This Month"
          value={String(metrics.invoiceCountThisMonth)}
          color="blue"
        />
        <MetricCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Overdue"
          value={String(metrics.overdueCount)}
          color={metrics.overdueCount > 0 ? 'red' : 'gray'}
          highlight={metrics.overdueCount > 0}
        />
      </div>

      {/* Breakdown + Quick links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Invoice breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Invoice Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <Row label="Total invoices" value={metrics.totalInvoices} />
              <Row label="Drafts" value={metrics.draftCount} />
              <Row label="Finalized" value={metrics.finalizedCount} />
              <Row label="Credit notes" value={metrics.creditNotes} />
              <Row label="Debit notes" value={metrics.debitNotes} />
              <div className="border-t pt-2 mt-2">
                <Row label="Partners" value={partners.length} />
                <Row label="Articles" value={articlesList.length} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {quickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <link.icon className="h-4 w-4 text-gray-400 group-hover:text-orange-500" />
                  <span className="text-sm font-medium">{link.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  {link.count !== undefined && (
                    <span className="text-xs text-muted-foreground">
                      {link.count}
                    </span>
                  )}
                  {link.sub && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {link.sub}
                    </span>
                  )}
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-orange-500" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Last 5 actions in this company</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 text-gray-300" />
              <p className="text-sm">No activity yet</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {activity.map((a) => (
                <li key={a.id} className="flex items-start gap-3 text-sm">
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
                      {relativeTime(a.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
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
    <Card className={highlight ? 'border-red-300 bg-red-50/30' : ''}>
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
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
