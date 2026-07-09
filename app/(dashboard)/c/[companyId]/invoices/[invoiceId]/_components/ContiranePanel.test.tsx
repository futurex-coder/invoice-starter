/**
 * KONT-1 Slice 2 — DOM test for the „Меню Контиране“ panel. The dev preview is
 * unusable here (a pre-existing RSC-prefetch flood starves the HDD dev server),
 * so we verify the render + button gating deterministically: the derived Дт/Кт
 * shows, the balance badge reflects state, and „Осчетоводи“ is enabled only when
 * balanced and unposted; a posted preview instead offers „Сторнирай“.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';

import { ContiranePanel } from './ContiranePanel';
import type { ContraPreview } from '@/src/features/kontirovka/actions';
import {
  getInvoiceContraPreview,
  postInvoiceContra,
} from '@/src/features/kontirovka/actions';

vi.mock('@/src/features/kontirovka/actions', () => ({
  getInvoiceContraPreview: vi.fn(),
  postInvoiceContra: vi.fn(),
  reverseInvoiceContra: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

// A finalized BGN 20% invoice — net 1600, ДДС 320, бруто 1920 (mirrors inv #11).
function bgnPreview(overrides: Partial<ContraPreview> = {}): ContraPreview {
  return {
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
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ContiranePanel companyId="5" invoiceId={11} currency="BGN" />
    </SWRConfig>
  );
}

describe('ContiranePanel', () => {
  it('renders the derived Дт/Кт, the balance badge, and an enabled Осчетоводи', async () => {
    vi.mocked(getInvoiceContraPreview).mockResolvedValue({ data: bgnPreview() });
    renderPanel();

    expect(await screen.findByText('Меню Контиране')).toBeInTheDocument();
    // Microinvest header fields
    expect(screen.getByText('Облагаеми доставки и др. с 20% ДДС')).toBeInTheDocument();
    expect(screen.getByText('01.2026')).toBeInTheDocument(); // Месец за експорт MM.YYYY
    expect(screen.getByText('Продажба')).toBeInTheDocument(); // Тип на сделката
    expect(screen.getByText('Не участва в декларацията')).toBeInTheDocument(); // VIES
    expect(screen.getByText('(нова)')).toBeInTheDocument(); // Контировка N pre-post
    // 3-column grids with headers
    expect(screen.getAllByText('Сметка').length).toBe(2);
    expect(screen.getByText('Общо Дебит')).toBeInTheDocument();
    expect(screen.getByText('Общо Кредит')).toBeInTheDocument();
    // all three lines rendered with their Microinvest analytic codes
    expect(screen.getByText('411/1')).toBeInTheDocument();
    expect(screen.getByText('Клиенти в лева')).toBeInTheDocument();
    expect(screen.getByText('703')).toBeInTheDocument();
    expect(screen.getByText('453/2')).toBeInTheDocument();
    // balanced badge + enabled post button
    expect(screen.getByText('Балансирана')).toBeInTheDocument();
    const post = screen.getByRole('button', { name: /Осчетоводи/i });
    expect(post).toBeEnabled();
  });

  it('gates Осчетоводи when the entry is not balanced', async () => {
    vi.mocked(getInvoiceContraPreview).mockResolvedValue({
      data: bgnPreview({ totalCredit: 1900, balanced: false }),
    });
    renderPanel();

    expect(await screen.findByText('Небалансирана')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Осчетоводи/i })).toBeDisabled();
  });

  it('posts via postInvoiceContra when Осчетоводи is clicked', async () => {
    vi.mocked(getInvoiceContraPreview).mockResolvedValue({ data: bgnPreview() });
    vi.mocked(postInvoiceContra).mockResolvedValue({
      data: { entryId: 1, postingNumber: 1 },
    });
    renderPanel();

    const post = await screen.findByRole('button', { name: /Осчетоводи/i });
    await userEvent.click(post);
    expect(postInvoiceContra).toHaveBeenCalledWith(11);
  });

  it('locks to a posted state and offers Сторнирай', async () => {
    vi.mocked(getInvoiceContraPreview).mockResolvedValue({
      data: bgnPreview({ alreadyPosted: true, postingNumber: 7, postingDate: '2026-01-20' }),
    });
    renderPanel();

    expect(await screen.findByText(/Осчетоводена · Контировка № 7/)).toBeInTheDocument();
    // posted → Контировка N padded to 10 digits, Дата на осчетоводяване shown
    expect(screen.getByText('0000000007')).toBeInTheDocument();
    expect(screen.getByText('20.01.2026')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сторнирай/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Осчетоводи/i })).not.toBeInTheDocument();
  });

  it('shows the totals footer for each ledger column', async () => {
    vi.mocked(getInvoiceContraPreview).mockResolvedValue({ data: bgnPreview() });
    renderPanel();

    await screen.findByText('Меню Контиране');
    // both Общо footers show 1 920.00 (Дебит == Кредит)
    const totals = screen.getAllByText(/1\s920\.00\s+BGN/);
    expect(totals.length).toBeGreaterThanOrEqual(2);
    // reverse action is not offered before posting
    expect(screen.queryByRole('button', { name: /Сторнирай/i })).not.toBeInTheDocument();
  });
});
