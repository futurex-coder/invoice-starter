import { db } from './drizzle';
import {
  users,
  companies,
  companyMembers,
  partners,
  articles,
  invoices,
  invoiceLines,
  activityLogs,
  ActivityType,
  CompanyRole,
  DocType,
  InvoiceStatus,
} from './schema';
import { hashPassword } from '@/lib/auth/session';
import { calculateInvoice } from '@/src/features/bulgarian-invoicing/calculator';
import { amountInWordsBg } from '@/src/features/bulgarian-invoicing/formatter';
import type { LineItemInput, PartySnapshot } from '@/src/features/bulgarian-invoicing/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().split('T')[0];
}

function makeAddress(street: string, postCode: string, city: string, country = 'BG'): string {
  return [street, [postCode, city].filter(Boolean).join(' '), country].filter(Boolean).join(', ');
}

function snap(company: {
  legalName: string;
  eik: string;
  vatNumber: string | null;
  street: string;
  postCode: string | null;
  city: string;
  country: string;
}): PartySnapshot {
  return {
    legalName: company.legalName,
    address: makeAddress(company.street, company.postCode ?? '', company.city, company.country),
    uic: company.eik,
    vatNumber: company.vatNumber,
  };
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('🌱 Seeding database...\n');

  // ─── USERS ─────────────────────────────────────────────────────────────────
  console.log('Creating users...');
  const passwordHash = await hashPassword('admin123');

  const [alice, bob] = await db
    .insert(users)
    .values([
      { name: 'Alice Ivanova', email: 'alice@test.com', passwordHash },
      { name: 'Bob Petrov', email: 'bob@test.com', passwordHash },
    ])
    .returning();

  console.log(`  ✓ ${alice.email}, ${bob.email}`);

  // ─── COMPANIES ─────────────────────────────────────────────────────────────
  console.log('Creating companies...');

  const [alpha, beta] = await db
    .insert(companies)
    .values([
      {
        legalName: 'Алфа Консулт ООД',
        eik: '123456789',
        vatNumber: 'BG123456789',
        isVatRegistered: true,
        country: 'BG',
        city: 'София',
        street: 'бул. Витоша 100',
        postCode: '1000',
        mol: 'Алис Иванова',
        bankName: 'UniCredit Bulbank',
        iban: 'BG80UNCR76301078123459',
        bicSwift: 'UNCRBGSF',
        defaultCurrency: 'BGN',
        defaultVatRate: 20,
        defaultPaymentMethod: 'bank',
      },
      {
        legalName: 'Бета Технолоджис ЕООД',
        eik: '987654321',
        vatNumber: 'BG987654321',
        isVatRegistered: true,
        country: 'BG',
        city: 'Пловдив',
        street: 'ул. Княз Борис I 15',
        postCode: '4000',
        mol: 'Борис Петров',
        bankName: 'DSK Bank',
        iban: 'BG18STSA93000012345678',
        bicSwift: 'STSABGSF',
        defaultCurrency: 'EUR',
        defaultVatRate: 20,
        defaultPaymentMethod: 'bank',
      },
    ])
    .returning();

  console.log(`  ✓ ${alpha.legalName}, ${beta.legalName}`);

  // ─── COMPANY MEMBERS ───────────────────────────────────────────────────────
  console.log('Assigning roles...');

  await db.insert(companyMembers).values([
    { userId: alice.id, companyId: alpha.id, role: CompanyRole.OWNER },
    { userId: alice.id, companyId: beta.id, role: CompanyRole.ACCOUNTANT },
    { userId: bob.id, companyId: beta.id, role: CompanyRole.OWNER },
  ]);

  console.log('  ✓ Alice → owner(Alpha), accountant(Beta)');
  console.log('  ✓ Bob   → owner(Beta)');

  // ─── PARTNERS ──────────────────────────────────────────────────────────────
  console.log('Creating partners...');

  const [partnerBetaForAlpha, partnerGamaForAlpha] = await db
    .insert(partners)
    .values([
      {
        companyId: alpha.id,
        linkedCompanyId: beta.id,
        name: 'Бета Технолоджис ЕООД',
        eik: '987654321',
        vatNumber: 'BG987654321',
        country: 'BG',
        city: 'Пловдив',
        street: 'ул. Княз Борис I 15',
        postCode: '4000',
        mol: 'Борис Петров',
      },
      {
        companyId: alpha.id,
        name: 'Гама Импорт ООД',
        eik: '111222333',
        vatNumber: 'BG111222333',
        country: 'BG',
        city: 'Варна',
        street: 'ул. Морска 42',
        postCode: '9000',
        mol: 'Георги Димитров',
      },
    ])
    .returning();

  const [partnerAlphaForBeta] = await db
    .insert(partners)
    .values({
      companyId: beta.id,
      linkedCompanyId: alpha.id,
      name: 'Алфа Консулт ООД',
      eik: '123456789',
      vatNumber: 'BG123456789',
      country: 'BG',
      city: 'София',
      street: 'бул. Витоша 100',
      postCode: '1000',
      mol: 'Алис Иванова',
    })
    .returning();

  console.log('  ✓ Alpha: 2 partners (Beta linked, Gama external)');
  console.log('  ✓ Beta:  1 partner (Alpha linked)');

  // ─── ARTICLES ──────────────────────────────────────────────────────────────
  console.log('Creating articles...');

  const [artConsulting, artAnnualClose, artWebDev, artServerMaint] = await db
    .insert(articles)
    .values([
      {
        companyId: alpha.id,
        name: 'Счетоводна консултация',
        unit: 'час',
        defaultUnitPrice: '80.0000',
        currency: 'BGN',
        type: 'service',
      },
      {
        companyId: alpha.id,
        name: 'Годишно приключване',
        unit: 'бр.',
        defaultUnitPrice: '500.0000',
        currency: 'BGN',
        type: 'service',
      },
      {
        companyId: beta.id,
        name: 'Уеб разработка',
        unit: 'час',
        defaultUnitPrice: '50.0000',
        currency: 'EUR',
        type: 'service',
      },
      {
        companyId: beta.id,
        name: 'Поддръжка на сървър',
        unit: 'месец',
        defaultUnitPrice: '200.0000',
        currency: 'EUR',
        type: 'service',
      },
    ])
    .returning();

  console.log('  ✓ Alpha: 2 articles, Beta: 2 articles');

  // ─── BUILD SNAPSHOTS ───────────────────────────────────────────────────────

  const alphaSnap = snap(alpha);
  const betaSnap = snap(beta);
  const gamaSnap: PartySnapshot = {
    legalName: 'Гама Импорт ООД',
    address: makeAddress('ул. Морска 42', '9000', 'Варна'),
    uic: '111222333',
    vatNumber: 'BG111222333',
  };

  // ─── INVOICES ──────────────────────────────────────────────────────────────
  console.log('Creating invoices...');

  const today = daysAgo(0);
  const lastMonth = daysAgo(30);
  const twoMonthsAgo = daysAgo(60);
  const twoWeeksAgo = daysAgo(14);

  // --- Alpha Invoice #1: finalized, paid (20h consulting) -------------------
  const alphaInv1Lines: LineItemInput[] = [
    { description: 'Счетоводна консултация — Ноември 2025', quantity: 20, unit: 'час', unitPrice: 80, vatRate: 20 },
  ];
  const alphaInv1Calc = calculateInvoice(alphaInv1Lines);

  const [alphaInv1] = await db
    .insert(invoices)
    .values({
      companyId: alpha.id,
      createdByUserId: alice.id,
      partnerId: partnerBetaForAlpha.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.FINALIZED,
      series: 'INV',
      number: 1,
      issueDate: twoMonthsAgo,
      supplyDate: twoMonthsAgo,
      currency: 'BGN',
      fxRate: '1',
      paymentMethod: 'bank',
      paymentStatus: 'paid',
      supplierSnapshot: alphaSnap,
      recipientSnapshot: betaSnap,
      items: alphaInv1Calc.items,
      totals: alphaInv1Calc.totals,
      amountInWords: amountInWordsBg(alphaInv1Calc.totals.grossAmount, 'BGN'),
    })
    .returning();

  await db.insert(invoiceLines).values(
    alphaInv1Calc.items.map((item, i) => ({
      invoiceId: alphaInv1.id,
      articleId: artConsulting.id,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );

  // --- Alpha Invoice #2: finalized, unpaid/overdue (annual close) -----------
  const alphaInv2Lines: LineItemInput[] = [
    { description: 'Годишно приключване 2025', quantity: 1, unit: 'бр.', unitPrice: 500, vatRate: 20 },
  ];
  const alphaInv2Calc = calculateInvoice(alphaInv2Lines);

  const [alphaInv2] = await db
    .insert(invoices)
    .values({
      companyId: alpha.id,
      createdByUserId: alice.id,
      partnerId: partnerBetaForAlpha.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.FINALIZED,
      series: 'INV',
      number: 2,
      issueDate: lastMonth,
      supplyDate: lastMonth,
      currency: 'BGN',
      fxRate: '1',
      paymentMethod: 'bank',
      paymentStatus: 'unpaid',
      dueDate: daysAgo(5),
      supplierSnapshot: alphaSnap,
      recipientSnapshot: betaSnap,
      items: alphaInv2Calc.items,
      totals: alphaInv2Calc.totals,
      amountInWords: amountInWordsBg(alphaInv2Calc.totals.grossAmount, 'BGN'),
    })
    .returning();

  await db.insert(invoiceLines).values(
    alphaInv2Calc.items.map((item) => ({
      invoiceId: alphaInv2.id,
      articleId: artAnnualClose.id,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );

  // --- Alpha Invoice #3: draft (consulting + 10% discount, to Gama) --------
  const alphaInv3Lines: LineItemInput[] = [
    { description: 'Счетоводна консултация — Януари 2026', quantity: 15, unit: 'час', unitPrice: 80, vatRate: 20 },
    { description: 'Данъчна декларация', quantity: 1, unit: 'бр.', unitPrice: 200, vatRate: 20, discountPercent: 10 },
  ];
  const alphaInv3Calc = calculateInvoice(alphaInv3Lines);

  const [alphaInv3] = await db
    .insert(invoices)
    .values({
      companyId: alpha.id,
      createdByUserId: alice.id,
      partnerId: partnerGamaForAlpha.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.DRAFT,
      series: 'INV',
      number: 3,
      issueDate: today,
      currency: 'BGN',
      fxRate: '1',
      paymentMethod: 'bank',
      paymentStatus: 'unpaid',
      supplierSnapshot: alphaSnap,
      recipientSnapshot: gamaSnap,
      items: alphaInv3Calc.items,
      totals: alphaInv3Calc.totals,
      amountInWords: amountInWordsBg(alphaInv3Calc.totals.grossAmount, 'BGN'),
    })
    .returning();

  await db.insert(invoiceLines).values(
    alphaInv3Calc.items.map((item, i) => ({
      invoiceId: alphaInv3.id,
      articleId: i === 0 ? artConsulting.id : null,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );

  // --- Credit note on Alpha Invoice #1 (partial refund) --------------------
  const alphaCNLines: LineItemInput[] = [
    { description: 'Корекция — Счетоводна консултация (5h)', quantity: 5, unit: 'час', unitPrice: 80, vatRate: 20 },
  ];
  const alphaCNCalc = calculateInvoice(alphaCNLines);

  const [alphaCN] = await db
    .insert(invoices)
    .values({
      companyId: alpha.id,
      createdByUserId: alice.id,
      partnerId: partnerBetaForAlpha.id,
      referencedInvoiceId: alphaInv1.id,
      docType: DocType.CREDIT_NOTE,
      status: InvoiceStatus.FINALIZED,
      series: 'INV',
      number: 1,
      issueDate: lastMonth,
      currency: 'BGN',
      fxRate: '1',
      paymentMethod: 'bank',
      paymentStatus: 'paid',
      supplierSnapshot: alphaSnap,
      recipientSnapshot: betaSnap,
      items: alphaCNCalc.items,
      totals: alphaCNCalc.totals,
      amountInWords: amountInWordsBg(alphaCNCalc.totals.grossAmount, 'BGN'),
    })
    .returning();

  await db.insert(invoiceLines).values(
    alphaCNCalc.items.map((item) => ({
      invoiceId: alphaCN.id,
      articleId: artConsulting.id,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );

  console.log('  ✓ Alpha: INV-1 (paid), INV-2 (overdue), INV-3 (draft), CN-1 (on INV-1)');

  // --- Beta Invoice #1: finalized, unpaid (web dev) -------------------------
  const betaInv1Lines: LineItemInput[] = [
    { description: 'Уеб разработка — Корпоративен сайт', quantity: 40, unit: 'час', unitPrice: 50, vatRate: 20 },
    { description: 'Поддръжка на сървър — Q1 2026', quantity: 3, unit: 'месец', unitPrice: 200, vatRate: 20 },
  ];
  const betaInv1Calc = calculateInvoice(betaInv1Lines);

  const [betaInv1] = await db
    .insert(invoices)
    .values({
      companyId: beta.id,
      createdByUserId: bob.id,
      partnerId: partnerAlphaForBeta.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.FINALIZED,
      series: 'INV',
      number: 1,
      issueDate: lastMonth,
      supplyDate: lastMonth,
      currency: 'EUR',
      fxRate: '1.9558',
      paymentMethod: 'bank',
      paymentStatus: 'unpaid',
      dueDate: today,
      supplierSnapshot: betaSnap,
      recipientSnapshot: alphaSnap,
      items: betaInv1Calc.items,
      totals: betaInv1Calc.totals,
      amountInWords: amountInWordsBg(betaInv1Calc.totals.grossAmount, 'EUR'),
    })
    .returning();

  await db.insert(invoiceLines).values(
    betaInv1Calc.items.map((item, i) => ({
      invoiceId: betaInv1.id,
      articleId: i === 0 ? artWebDev.id : artServerMaint.id,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );

  // --- Beta Invoice #2: draft (server maintenance only) ---------------------
  const betaInv2Lines: LineItemInput[] = [
    { description: 'Поддръжка на сървър — Април 2026', quantity: 1, unit: 'месец', unitPrice: 200, vatRate: 20 },
  ];
  const betaInv2Calc = calculateInvoice(betaInv2Lines);

  const [betaInv2] = await db
    .insert(invoices)
    .values({
      companyId: beta.id,
      createdByUserId: bob.id,
      partnerId: partnerAlphaForBeta.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.DRAFT,
      series: 'INV',
      number: 2,
      issueDate: today,
      currency: 'EUR',
      fxRate: '1.9558',
      paymentMethod: 'bank',
      paymentStatus: 'unpaid',
      supplierSnapshot: betaSnap,
      recipientSnapshot: alphaSnap,
      items: betaInv2Calc.items,
      totals: betaInv2Calc.totals,
      amountInWords: amountInWordsBg(betaInv2Calc.totals.grossAmount, 'EUR'),
    })
    .returning();

  await db.insert(invoiceLines).values(
    betaInv2Calc.items.map((item) => ({
      invoiceId: betaInv2.id,
      articleId: artServerMaint.id,
      sortOrder: item.sortOrder,
      description: item.description,
      quantity: String(item.quantity),
      unit: item.unit,
      unitPrice: String(item.unitPrice),
      vatRate: item.vatRate,
      discountPercent: String(item.discountPercent ?? 0),
      discountAmount: String(item.discountAmount),
      netAmount: String(item.netAmount),
      vatAmount: String(item.vatAmount),
      grossAmount: String(item.grossAmount),
    }))
  );

  console.log('  ✓ Beta: INV-1 (unpaid), INV-2 (draft)');

  // ─── ACTIVITY LOGS ─────────────────────────────────────────────────────────
  console.log('Creating activity logs...');

  await db.insert(activityLogs).values([
    { companyId: alpha.id, userId: alice.id, action: ActivityType.CREATE_COMPANY, ipAddress: '127.0.0.1' },
    { companyId: alpha.id, userId: alice.id, action: ActivityType.CREATE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: alpha.id, userId: alice.id, action: ActivityType.FINALIZE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: alpha.id, userId: alice.id, action: ActivityType.CREATE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: alpha.id, userId: alice.id, action: ActivityType.FINALIZE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: alpha.id, userId: alice.id, action: ActivityType.CREATE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: alpha.id, userId: alice.id, action: ActivityType.CREATE_CREDIT_NOTE, ipAddress: '127.0.0.1' },
    { companyId: beta.id, userId: bob.id, action: ActivityType.CREATE_COMPANY, ipAddress: '127.0.0.1' },
    { companyId: beta.id, userId: bob.id, action: ActivityType.INVITE_MEMBER, ipAddress: '127.0.0.1' },
    { companyId: beta.id, userId: alice.id, action: ActivityType.ACCEPT_INVITATION, ipAddress: '127.0.0.1' },
    { companyId: beta.id, userId: bob.id, action: ActivityType.CREATE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: beta.id, userId: bob.id, action: ActivityType.FINALIZE_INVOICE, ipAddress: '127.0.0.1' },
    { companyId: beta.id, userId: bob.id, action: ActivityType.CREATE_INVOICE, ipAddress: '127.0.0.1' },
  ]);

  console.log('  ✓ 13 activity log entries');

  // ─── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed completed!\n');
  console.log('Test accounts:');
  console.log('  alice@test.com / admin123 — owner(Alpha), accountant(Beta)');
  console.log('  bob@test.com   / admin123 — owner(Beta)\n');
  console.log('Alpha (BGN):');
  console.log(`  INV-1  ${alphaInv1Calc.totals.grossAmount} BGN  finalized/paid`);
  console.log(`  INV-2  ${alphaInv2Calc.totals.grossAmount} BGN  finalized/unpaid (overdue)`);
  console.log(`  INV-3  ${alphaInv3Calc.totals.grossAmount} BGN  draft (2 lines, 10% discount)`);
  console.log(`  CN-1   ${alphaCNCalc.totals.grossAmount} BGN  credit note on INV-1`);
  console.log('Beta (EUR):');
  console.log(`  INV-1  ${betaInv1Calc.totals.grossAmount} EUR  finalized/unpaid`);
  console.log(`  INV-2  ${betaInv2Calc.totals.grossAmount} EUR  draft`);
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
