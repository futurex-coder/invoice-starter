import { redirect } from 'next/navigation';
import { db } from '@/lib/db/drizzle';
import { invoices, companies, ActivityType } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import {
  getUser,
  getCompaniesForUser,
  getActiveCompanyId,
  verifyCompanyAccess,
  getPartnersForCompany,
  getArticlesForCompany,
  getInvoicesForCompany,
  getNextInvoiceNumber,
  getActivityLogs,
} from '@/lib/db/queries';

export const dynamic = 'force-dynamic';

async function getInvoiceCountsByStatus(companyId: number) {
  const rows = await db
    .select({
      status: invoices.status,
      docType: invoices.docType,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(eq(invoices.companyId, companyId))
    .groupBy(invoices.status, invoices.docType);
  return rows;
}

async function createTestDraft(companyId: number, userId: number) {
  'use server';

  const nextNum = await getNextInvoiceNumber(companyId, 'INV');
  const company = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (!company[0]) return { error: 'Company not found' };

  const c = company[0];

  const [inv] = await db
    .insert(invoices)
    .values({
      companyId,
      createdByUserId: userId,
      docType: 'invoice',
      status: 'draft',
      series: 'INV',
      number: nextNum,
      issueDate: new Date().toISOString().slice(0, 10),
      currency: c.defaultCurrency,
      paymentMethod: c.defaultPaymentMethod,
      supplierSnapshot: {
        legalName: c.legalName,
        address: [c.street, [c.postCode, c.city].filter(Boolean).join(' '), c.country].filter(Boolean).join(', '),
        uic: c.eik,
        vatNumber: c.vatNumber,
      },
      items: [],
      totals: { netAmount: 0, vatAmount: 0, grossAmount: 0, vatBreakdown: [] },
    })
    .returning({ id: invoices.id, number: invoices.number });

  return { data: inv };
}

async function createTestCreditNote(
  companyId: number,
  userId: number,
  parentInvoiceId: number,
  parentNumber: number
) {
  'use server';

  const [cn] = await db
    .insert(invoices)
    .values({
      companyId,
      createdByUserId: userId,
      referencedInvoiceId: parentInvoiceId,
      docType: 'credit_note',
      status: 'draft',
      series: 'INV',
      number: parentNumber,
      issueDate: new Date().toISOString().slice(0, 10),
      currency: 'EUR',
      paymentMethod: 'bank',
      items: [],
      totals: { netAmount: 0, vatAmount: 0, grossAmount: 0, vatBreakdown: [] },
    })
    .returning({ id: invoices.id, number: invoices.number });

  return { data: cn };
}

export default async function DebugPage() {
  if (process.env.NODE_ENV !== 'development') redirect('/');

  const user = await getUser();
  if (!user) redirect('/sign-in');

  const memberships = await getCompaniesForUser(user.id);
  const activeCompanyId = await getActiveCompanyId();

  let activeCompanyData = null;
  let partnerCount = 0;
  let articleCount = 0;
  let invoiceCounts: Awaited<ReturnType<typeof getInvoiceCountsByStatus>> = [];
  let nextNumber = 1;
  let recentActivity: Awaited<ReturnType<typeof getActivityLogs>> = [];
  let firstFinalizedInvoice: { id: number; number: number } | null = null;

  if (activeCompanyId) {
    const membership = await verifyCompanyAccess(user.id, activeCompanyId);
    if (membership) {
      const companyRows = await db
        .select()
        .from(companies)
        .where(eq(companies.id, activeCompanyId))
        .limit(1);
      activeCompanyData = companyRows[0] ?? null;

      const partners = await getPartnersForCompany(activeCompanyId);
      partnerCount = partners.length;

      const arts = await getArticlesForCompany(activeCompanyId);
      articleCount = arts.length;

      invoiceCounts = await getInvoiceCountsByStatus(activeCompanyId);
      nextNumber = await getNextInvoiceNumber(activeCompanyId, 'INV');
      recentActivity = await getActivityLogs(activeCompanyId, { limit: 5 });

      const finalized = await getInvoicesForCompany(activeCompanyId, {
        status: 'finalized',
        docType: 'invoice',
        limit: 1,
      });
      if (finalized.length > 0) {
        firstFinalizedInvoice = {
          id: finalized[0].id,
          number: finalized[0].number,
        };
      }
    }
  }

  const createDraftAction = async () => {
    'use server';
    if (!activeCompanyId) return;
    await createTestDraft(activeCompanyId, user.id);
  };

  const createCNAction = async () => {
    'use server';
    if (!activeCompanyId || !firstFinalizedInvoice) return;
    await createTestCreditNote(
      activeCompanyId,
      user.id,
      firstFinalizedInvoice.id,
      firstFinalizedInvoice.number
    );
  };

  return (
    <section className="flex-1 p-4 lg:p-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Debug / Refactoring Checklist</h1>
      <p className="text-xs text-gray-400 mb-6">
        Development only — verifies the teams→companies refactoring.
      </p>

      {/* 1. Current User */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50">
        <h2 className="font-semibold mb-2">1. Current User</h2>
        <Table
          rows={[
            ['ID', String(user.id)],
            ['Email', user.email],
            ['Name', user.name ?? '—'],
            ['Plan', user.planName ?? 'Free'],
            ['Subscription', user.subscriptionStatus ?? 'none'],
            ['Stripe Customer', user.stripeCustomerId ?? '—'],
          ]}
        />
      </div>

      {/* 2. Company Memberships */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50">
        <h2 className="font-semibold mb-2">
          2. Company Memberships ({memberships.length})
        </h2>
        {memberships.length === 0 ? (
          <p className="text-sm text-red-600">
            No memberships found — user belongs to no companies.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="py-1 pr-4">ID</th>
                <th className="py-1 pr-4">Legal Name</th>
                <th className="py-1 pr-4">EIK</th>
                <th className="py-1 pr-4">Role</th>
                <th className="py-1">Deleted?</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.company.id} className="border-t border-gray-200">
                  <td className="py-1.5 pr-4 font-mono">{m.company.id}</td>
                  <td className="py-1.5 pr-4">{m.company.legalName}</td>
                  <td className="py-1.5 pr-4 font-mono">{m.company.eik}</td>
                  <td className="py-1.5 pr-4">
                    <span
                      className={
                        m.role === 'owner'
                          ? 'text-orange-700 font-medium'
                          : 'text-blue-700'
                      }
                    >
                      {m.role}
                    </span>
                  </td>
                  <td className="py-1.5">
                    {m.company.deletedAt ? (
                      <span className="text-red-600">Yes</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. Active Company Context */}
      <div className="mb-6 border rounded-lg p-4 bg-gray-50">
        <h2 className="font-semibold mb-2">3. Active Company Context</h2>
        <Table
          rows={[
            [
              'activeCompanyId (cookie)',
              activeCompanyId ? String(activeCompanyId) : 'NOT SET',
            ],
            [
              'Status',
              activeCompanyData
                ? '✅ Loaded'
                : activeCompanyId
                  ? '❌ No access or not found'
                  : '⚠️ No active company',
            ],
          ]}
        />
      </div>

      {/* 4. Active Company Details */}
      {activeCompanyData && (
        <div className="mb-6 border rounded-lg p-4 bg-gray-50">
          <h2 className="font-semibold mb-2">
            4. Company: {activeCompanyData.legalName}
          </h2>
          <Table
            rows={[
              ['ID', String(activeCompanyData.id)],
              ['Legal Name', activeCompanyData.legalName],
              ['EIK', activeCompanyData.eik],
              ['VAT Number', activeCompanyData.vatNumber ?? '—'],
              ['VAT Registered', activeCompanyData.isVatRegistered ? 'Yes' : 'No'],
              ['Address', `${activeCompanyData.street}, ${activeCompanyData.city} ${activeCompanyData.postCode ?? ''} ${activeCompanyData.country}`],
              ['MOL', activeCompanyData.mol ?? '—'],
              ['Default Currency', activeCompanyData.defaultCurrency],
              ['Default VAT Rate', `${activeCompanyData.defaultVatRate}%`],
              ['Default Payment', activeCompanyData.defaultPaymentMethod],
              ['Bank', activeCompanyData.bankName ?? '—'],
              ['IBAN', activeCompanyData.iban ?? '—'],
            ]}
          />

          <h3 className="font-semibold mt-4 mb-2">Counts</h3>
          <Table
            rows={[
              ['Partners', String(partnerCount)],
              ['Articles', String(articleCount)],
              ['Next Invoice #', String(nextNumber).padStart(10, '0')],
              ...invoiceCounts.map(
                (r): [string, string] => [
                  `${r.docType} / ${r.status}`,
                  String(r.count),
                ]
              ),
            ]}
          />

          {/* Test buttons */}
          <h3 className="font-semibold mt-4 mb-2">Test Actions</h3>
          <div className="flex gap-3 flex-wrap">
            <form action={createDraftAction}>
              <button
                type="submit"
                className="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600"
              >
                Create test draft invoice (#{String(nextNumber).padStart(10, '0')})
              </button>
            </form>
            {firstFinalizedInvoice ? (
              <form action={createCNAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                >
                  Create credit note on invoice #{firstFinalizedInvoice.number}
                </button>
              </form>
            ) : (
              <span className="text-xs text-gray-400 self-center">
                No finalized invoices — cannot create credit note
              </span>
            )}
          </div>

          {/* Activity */}
          <h3 className="font-semibold mt-4 mb-2">Recent Activity (last 5)</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-400">No activity logs.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="py-1 pr-4">Action</th>
                  <th className="py-1 pr-4">User</th>
                  <th className="py-1 pr-4">IP</th>
                  <th className="py-1">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((log) => (
                  <tr key={log.id} className="border-t border-gray-200">
                    <td className="py-1.5 pr-4 font-mono text-xs">
                      {log.action}
                    </td>
                    <td className="py-1.5 pr-4">
                      {log.userName ?? `uid:${log.userId}`}
                    </td>
                    <td className="py-1.5 pr-4 font-mono text-xs">
                      {log.ipAddress ?? '—'}
                    </td>
                    <td className="py-1.5 text-xs text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}

function Table({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={i} className="border-t border-gray-200 first:border-0">
            <td className="py-1.5 pr-4 text-gray-500 whitespace-nowrap w-48">
              {label}
            </td>
            <td className="py-1.5 font-mono">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
