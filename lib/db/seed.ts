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

async function seed() {
  console.log('Seeding database...\n');

  // ─── USERS ───
  console.log('Creating users...');
  const passwordHash = await hashPassword('admin123');

  const [alice, bob] = await db
    .insert(users)
    .values([
      {
        name: 'Alice Ivanova',
        email: 'alice@test.com',
        passwordHash,
      },
      {
        name: 'Bob Petrov',
        email: 'bob@test.com',
        passwordHash,
      },
    ])
    .returning();

  console.log(`  Created: ${alice.email}, ${bob.email}`);

  // ─── COMPANIES ───
  console.log('Creating companies...');

  const [alphaOOD, betaEOOD] = await db
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

  console.log(`  Created: ${alphaOOD.legalName}, ${betaEOOD.legalName}`);

  // ─── COMPANY MEMBERS ───
  // Alice: owner of Alpha, accountant of Beta
  // Bob: owner of Beta
  console.log('Assigning roles...');

  await db.insert(companyMembers).values([
    {
      userId: alice.id,
      companyId: alphaOOD.id,
      role: CompanyRole.OWNER,
    },
    {
      userId: alice.id,
      companyId: betaEOOD.id,
      role: CompanyRole.ACCOUNTANT,
    },
    {
      userId: bob.id,
      companyId: betaEOOD.id,
      role: CompanyRole.OWNER,
    },
  ]);

  console.log('  Alice → owner of Alpha, accountant of Beta');
  console.log('  Bob   → owner of Beta');

  // ─── PARTNERS ───
  console.log('Creating partners...');

  // Alpha's partner: Beta (linked to the actual company record)
  const [partnerBetaForAlpha] = await db
    .insert(partners)
    .values([
      {
        companyId: alphaOOD.id,
        linkedCompanyId: betaEOOD.id,
        name: 'Бета Технолоджис ЕООД',
        eik: '987654321',
        vatNumber: 'BG987654321',
        country: 'BG',
        city: 'Пловдив',
        street: 'ул. Княз Борис I 15',
        postCode: '4000',
        mol: 'Борис Петров',
      },
      // Alpha's second partner: an external company (not in the system)
      {
        companyId: alphaOOD.id,
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

  // Beta's partner: Alpha (linked)
  await db.insert(partners).values({
    companyId: betaEOOD.id,
    linkedCompanyId: alphaOOD.id,
    name: 'Алфа Консулт ООД',
    eik: '123456789',
    vatNumber: 'BG123456789',
    country: 'BG',
    city: 'София',
    street: 'бул. Витоша 100',
    postCode: '1000',
    mol: 'Алис Иванова',
  });

  console.log('  Alpha has 2 partners (Beta linked, Gama external)');
  console.log('  Beta has 1 partner (Alpha linked)');

  // ─── ARTICLES ───
  console.log('Creating articles...');

  const [consultingArticle, annualCloseArticle] = await db
    .insert(articles)
    .values([
      {
        companyId: alphaOOD.id,
        name: 'Счетоводна консултация',
        unit: 'час',
        defaultUnitPrice: '80.0000',
        currency: 'BGN',
        type: 'service',
      },
      {
        companyId: alphaOOD.id,
        name: 'Годишно приключване',
        unit: 'бр.',
        defaultUnitPrice: '500.0000',
        currency: 'BGN',
        type: 'service',
      },
      {
        companyId: betaEOOD.id,
        name: 'Уеб разработка',
        unit: 'час',
        defaultUnitPrice: '50.0000',
        currency: 'EUR',
        type: 'service',
      },
      {
        companyId: betaEOOD.id,
        name: 'Поддръжка на сървър',
        unit: 'месец',
        defaultUnitPrice: '200.0000',
        currency: 'EUR',
        type: 'service',
      },
    ])
    .returning();

  console.log('  Alpha: 2 articles, Beta: 2 articles');

  // ─── INVOICES ───
  // The DB trigger auto-creates invoice_sequences rows and enforces monotonic numbering.
  console.log('Creating invoices...');

  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .split('T')[0];
  const twoMonthsAgo = new Date(Date.now() - 60 * 86400000)
    .toISOString()
    .split('T')[0];

  // Alpha invoice #1 — finalized, paid
  const [alphaInv1] = await db
    .insert(invoices)
    .values({
      companyId: alphaOOD.id,
      createdByUserId: alice.id,
      partnerId: partnerBetaForAlpha.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.FINALIZED,
      series: 'INV',
      number: 1,
      issueDate: twoMonthsAgo,
      supplyDate: twoMonthsAgo,
      currency: 'BGN',
      paymentMethod: 'bank',
      paymentStatus: 'paid',
      supplierSnapshot: {
        legalName: alphaOOD.legalName,
        eik: alphaOOD.eik,
        vatNumber: alphaOOD.vatNumber,
        city: alphaOOD.city,
        street: alphaOOD.street,
      },
      recipientSnapshot: {
        name: 'Бета Технолоджис ЕООД',
        eik: '987654321',
        vatNumber: 'BG987654321',
        city: 'Пловдив',
        street: 'ул. Княз Борис I 15',
      },
      totals: {
        netAmount: '1600.00',
        vatAmount: '320.00',
        grossAmount: '1920.00',
      },
    })
    .returning();

  // Alpha invoice #2 — finalized, unpaid (overdue)
  const [alphaInv2] = await db
    .insert(invoices)
    .values({
      companyId: alphaOOD.id,
      createdByUserId: alice.id,
      partnerId: partnerBetaForAlpha.id,
      docType: DocType.INVOICE,
      status: InvoiceStatus.FINALIZED,
      series: 'INV',
      number: 2,
      issueDate: lastMonth,
      supplyDate: lastMonth,
      currency: 'BGN',
      paymentMethod: 'bank',
      paymentStatus: 'unpaid',
      dueDate: today,
      supplierSnapshot: {
        legalName: alphaOOD.legalName,
        eik: alphaOOD.eik,
        vatNumber: alphaOOD.vatNumber,
        city: alphaOOD.city,
        street: alphaOOD.street,
      },
      recipientSnapshot: {
        name: 'Бета Технолоджис ЕООД',
        eik: '987654321',
        vatNumber: 'BG987654321',
        city: 'Пловдив',
        street: 'ул. Княз Борис I 15',
      },
      totals: {
        netAmount: '500.00',
        vatAmount: '100.00',
        grossAmount: '600.00',
      },
    })
    .returning();

  // Alpha invoice #3 — draft
  await db.insert(invoices).values({
    companyId: alphaOOD.id,
    createdByUserId: alice.id,
    partnerId: partnerBetaForAlpha.id,
    docType: DocType.INVOICE,
    status: InvoiceStatus.DRAFT,
    series: 'INV',
    number: 3,
    issueDate: today,
    currency: 'BGN',
    paymentMethod: 'bank',
    paymentStatus: 'unpaid',
    totals: {
      netAmount: '240.00',
      vatAmount: '48.00',
      grossAmount: '288.00',
    },
  });

  // Credit note on Alpha invoice #1 (partial correction)
  await db.insert(invoices).values({
    companyId: alphaOOD.id,
    createdByUserId: alice.id,
    partnerId: partnerBetaForAlpha.id,
    referencedInvoiceId: alphaInv1.id,
    docType: DocType.CREDIT_NOTE,
    status: InvoiceStatus.FINALIZED,
    series: 'INV',
    number: 1,
    issueDate: lastMonth,
    currency: 'BGN',
    paymentMethod: 'bank',
    paymentStatus: 'paid',
    supplierSnapshot: {
      legalName: alphaOOD.legalName,
      eik: alphaOOD.eik,
      vatNumber: alphaOOD.vatNumber,
      city: alphaOOD.city,
      street: alphaOOD.street,
    },
    recipientSnapshot: {
      name: 'Бета Технолоджис ЕООД',
      eik: '987654321',
      vatNumber: 'BG987654321',
      city: 'Пловдив',
      street: 'ул. Княз Борис I 15',
    },
    totals: {
      netAmount: '-400.00',
      vatAmount: '-80.00',
      grossAmount: '-480.00',
    },
  });

  console.log(
    '  Alpha: 3 invoices (INV-1 paid, INV-2 unpaid, INV-3 draft) + 1 credit note on INV-1'
  );

  // Beta invoice #1 — finalized, unpaid
  await db.insert(invoices).values({
    companyId: betaEOOD.id,
    createdByUserId: bob.id,
    docType: DocType.INVOICE,
    status: InvoiceStatus.FINALIZED,
    series: 'INV',
    number: 1,
    issueDate: lastMonth,
    supplyDate: lastMonth,
    currency: 'EUR',
    paymentMethod: 'bank',
    paymentStatus: 'unpaid',
    dueDate: today,
    totals: {
      netAmount: '2400.00',
      vatAmount: '480.00',
      grossAmount: '2880.00',
    },
  });

  console.log('  Beta: 1 invoice (INV-1 unpaid)');

  // ─── INVOICE LINES ───
  console.log('Creating invoice lines...');

  await db.insert(invoiceLines).values([
    {
      invoiceId: alphaInv1.id,
      articleId: consultingArticle.id,
      sortOrder: 1,
      description: 'Счетоводна консултация — Ноември 2025',
      quantity: '20.0000',
      unit: 'час',
      unitPrice: '80.0000',
      vatRate: 20,
      netAmount: '1600.0000',
      vatAmount: '320.0000',
      grossAmount: '1920.0000',
    },
    {
      invoiceId: alphaInv2.id,
      articleId: annualCloseArticle.id,
      sortOrder: 1,
      description: 'Годишно приключване 2025',
      quantity: '1.0000',
      unit: 'бр.',
      unitPrice: '500.0000',
      vatRate: 20,
      netAmount: '500.0000',
      vatAmount: '100.0000',
      grossAmount: '600.0000',
    },
  ]);

  console.log('  Created lines for Alpha invoices 1 & 2');

  // ─── ACTIVITY LOGS ───
  console.log('Creating activity logs...');

  await db.insert(activityLogs).values([
    {
      companyId: alphaOOD.id,
      userId: alice.id,
      action: ActivityType.CREATE_COMPANY,
      ipAddress: '127.0.0.1',
    },
    {
      companyId: alphaOOD.id,
      userId: alice.id,
      action: ActivityType.CREATE_INVOICE,
      ipAddress: '127.0.0.1',
    },
    {
      companyId: betaEOOD.id,
      userId: bob.id,
      action: ActivityType.CREATE_COMPANY,
      ipAddress: '127.0.0.1',
    },
    {
      companyId: betaEOOD.id,
      userId: bob.id,
      action: ActivityType.INVITE_MEMBER,
      ipAddress: '127.0.0.1',
    },
    {
      companyId: betaEOOD.id,
      userId: alice.id,
      action: ActivityType.ACCEPT_INVITATION,
      ipAddress: '127.0.0.1',
    },
  ]);

  console.log('  Created 5 activity log entries');

  // ─── DONE ───
  console.log('\n✅ Seed completed!');
  console.log('\nTest accounts:');
  console.log('  alice@test.com / admin123 — owner of Alpha, accountant of Beta');
  console.log('  bob@test.com   / admin123 — owner of Beta');
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('\nSeed process finished. Exiting...');
    process.exit(0);
  });
