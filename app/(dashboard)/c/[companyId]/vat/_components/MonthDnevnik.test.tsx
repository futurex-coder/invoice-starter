/**
 * KONT-1 Slice 4 discoverability — a ДДС-дневник row opens its Меню Контиране in a
 * dialog. Verifies the wiring: клик on a sales row → the sales контировка panel
 * renders inside the dialog (fed the row's document id + currency).
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';

import { MonthDnevnik } from './MonthDnevnik';
import type { MonthDnevnik as MonthDnevnikData, ContraPreview } from '@/src/features/kontirovka/actions';
import {
  getDnevnikForMonth,
  getInvoiceContraPreview,
} from '@/src/features/kontirovka/actions';

vi.mock('@/src/features/kontirovka/actions', () => ({
  getDnevnikForMonth: vi.fn(),
  getInvoiceContraPreview: vi.fn(),
  postInvoiceContra: vi.fn(),
  reverseInvoiceContra: vi.fn(),
  getReceivedInvoiceContraPreview: vi.fn(),
  postReceivedInvoiceContra: vi.fn(),
  reverseReceivedInvoiceContra: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

const DNEVNIK: MonthDnevnikData = {
  month: '2026-01',
  sales: [
    {
      id: 11,
      docType: 'invoice',
      number: 1,
      issueDate: '2026-01-15',
      partnerName: 'Клиент ООД',
      partnerEik: '111222333',
      partnerVat: null,
      netBase: 1600,
      vatBase: 320,
      grossBase: 1920,
      vatRate: 20,
      vatOperation: 'sale_std_20',
      currency: 'BGN',
      fxRate: 1,
    },
  ],
  purchases: [],
  postedVat: {
    period: '2026-01',
    outputVat: 0,
    inputVat: 0,
    netVat: 0,
    salesCount: 0,
    purchasesCount: 0,
  },
};

const PREVIEW: ContraPreview = {
  invoiceId: 11,
  documentType: 'Фактура',
  documentNumber: '0000000001',
  documentDate: '2026-01-15',
  partnerName: 'Клиент ООД',
  partnerUic: '111222333',
  dealType: 'sale',
  vatOperation: 'sale_std_20',
  vatOperationLabel: 'Облагаеми доставки и др. с 20% ДДС',
  basis: 'services',
  vies: false,
  vatPeriod: '2026-01',
  currency: 'BGN',
  lines: [
    { side: 'debit', code: '411/1', name: 'Клиенти в лева', amount: 1920, account: '411' },
    { side: 'credit', code: '703', name: 'Приходи от продажба на услуги', amount: 1600, account: '703' },
    { side: 'credit', code: '453/2', name: 'ДДС Продажби', amount: 320, account: '4532' },
  ],
  totalDebit: 1920,
  totalCredit: 1920,
  balanced: true,
  alreadyPosted: false,
  postingNumber: null,
  postingDate: null,
  note: null,
};

describe('MonthDnevnik → Меню Контиране dialog', () => {
  it('opens the sales контировка panel when a дневник row is clicked', async () => {
    vi.mocked(getDnevnikForMonth).mockResolvedValue({ data: DNEVNIK });
    vi.mocked(getInvoiceContraPreview).mockResolvedValue({ data: PREVIEW });

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <MonthDnevnik companyId="5" month="2026-01" baseCurrency="EUR" />
      </SWRConfig>
    );

    // the sales row is present and actionable; no dialog yet
    const row = await screen.findByRole('button', { name: /Отвори контировка/ });
    expect(screen.queryByText('Меню Контиране')).not.toBeInTheDocument();

    await userEvent.click(row);

    // клик → the контировка dialog opens and the SALES панел mounts, fed invoice 11
    // (the panel's own render is covered by ContiranePanel.test.tsx; here we prove
    // the дневник→dialog wiring and that the right document id is threaded through).
    await waitFor(() => expect(getInvoiceContraPreview).toHaveBeenCalledWith(11));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});
