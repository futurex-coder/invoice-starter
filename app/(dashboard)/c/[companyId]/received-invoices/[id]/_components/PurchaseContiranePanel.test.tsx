/**
 * KONT-1 Slice 3 — DOM test for the purchase „Меню Контиране“ panel. The dev
 * preview is unusable here (RSC-prefetch flood, see REVIEW_QUEUE), so we verify
 * render + gating deterministically: the derived Дт/Кт shows, the Основание picker
 * and чл.70 toggle appear, „Осчетоводи“ is gated on hasVat + balance, clicking it
 * posts with the chosen classification, and a posted preview offers „Сторнирай“.
 */

import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SWRConfig } from 'swr';

import { PurchaseContiranePanel } from './PurchaseContiranePanel';
import type { ReceivedContraPreview } from '@/src/features/kontirovka/actions';
import {
  getReceivedInvoiceContraPreview,
  postReceivedInvoiceContra,
} from '@/src/features/kontirovka/actions';

vi.mock('@/src/features/kontirovka/actions', () => ({
  getReceivedInvoiceContraPreview: vi.fn(),
  postReceivedInvoiceContra: vi.fn(),
  reverseReceivedInvoiceContra: vi.fn(),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

// A confirmed EUR full-credit purchase — net 1000, ДДС 200, бруто 1200.
function purchasePreview(overrides: Partial<ReceivedContraPreview> = {}): ReceivedContraPreview {
  return {
    receivedInvoiceId: 42,
    documentType: 'Фактура (получена)',
    documentNumber: 'F-100',
    documentDate: '2026-02-10',
    partnerName: 'Доставчик ООД',
    partnerUic: '204111222',
    dealType: 'purchase',
    vatOperation: 'purchase_full_20',
    vatOperationLabel: 'Покупка с пълен данъчен кредит 20%',
    basis: 'services',
    basisOptions: ['services', 'goods', 'production', 'materials', 'fixed_asset', 'other'],
    noCredit: false,
    hasVat: true,
    vies: false,
    vatPeriod: '2026-02',
    currency: 'EUR',
    lines: [
      { side: 'debit', code: '602', name: 'Разходи за външни услуги', amount: 1000, account: '602' },
      { side: 'debit', code: '453/1', name: 'ДДС Покупки', amount: 200, account: '4531' },
      { side: 'credit', code: '401/2', name: 'Доставчици в евро', amount: 1200, account: '401' },
    ],
    totalDebit: 1200,
    totalCredit: 1200,
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
      <PurchaseContiranePanel companyId="5" receivedInvoiceId={42} currency="EUR" />
    </SWRConfig>
  );
}

describe('PurchaseContiranePanel', () => {
  it('renders the derived Дт/Кт, the Основание picker + чл.70 toggle, and enabled Осчетоводи', async () => {
    vi.mocked(getReceivedInvoiceContraPreview).mockResolvedValue({ data: purchasePreview() });
    renderPanel();

    expect(await screen.findByText('Меню Контиране')).toBeInTheDocument();
    expect(screen.getByText('Покупка с пълен данъчен кредит 20%')).toBeInTheDocument();
    expect(screen.getByText('Доставчик ООД')).toBeInTheDocument();
    // Microinvest header fields (purchase = Покупка)
    expect(screen.getByText('Покупка')).toBeInTheDocument(); // Тип на сделката
    expect(screen.getByText('02.2026')).toBeInTheDocument(); // Месец за експорт MM.YYYY
    expect(screen.getByText('Не участва в декларацията')).toBeInTheDocument(); // VIES
    // all three purchase lines + 3-column grid headers
    expect(screen.getByText('602')).toBeInTheDocument();
    expect(screen.getByText('453/1')).toBeInTheDocument();
    expect(screen.getByText('401/2')).toBeInTheDocument();
    expect(screen.getByText('Доставчици в евро')).toBeInTheDocument();
    expect(screen.getByText('Общо Дебит')).toBeInTheDocument();
    // purchase-only classification controls (Основание Select + чл.70 toggle)
    expect(screen.getByText('Основание')).toBeInTheDocument();
    expect(screen.getByText(/Без право на данъчен кредит/)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeEnabled();
    // balanced + enabled post
    expect(screen.getByText('Балансирана')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Осчетоводи/i })).toBeEnabled();
  });

  it('blocks posting and warns for a zero-VAT purchase', async () => {
    vi.mocked(getReceivedInvoiceContraPreview).mockResolvedValue({
      data: purchasePreview({ hasVat: false, lines: [], totalDebit: 0, totalCredit: 0, balanced: false }),
    });
    renderPanel();

    expect(await screen.findByText(/Покупка без ДДС/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Осчетоводи/i })).toBeDisabled();
  });

  it('posts with the chosen classification when Осчетоводи is clicked', async () => {
    vi.mocked(getReceivedInvoiceContraPreview).mockResolvedValue({ data: purchasePreview() });
    vi.mocked(postReceivedInvoiceContra).mockResolvedValue({
      data: { entryId: 1, postingNumber: 1 },
    });
    renderPanel();

    const post = await screen.findByRole('button', { name: /Осчетоводи/i });
    await userEvent.click(post);
    expect(postReceivedInvoiceContra).toHaveBeenCalledWith(42, {
      basis: 'services',
      noCredit: false,
    });
  });

  it('locks to a posted state and offers Сторнирай with disabled classification', async () => {
    vi.mocked(getReceivedInvoiceContraPreview).mockResolvedValue({
      data: purchasePreview({ alreadyPosted: true, postingNumber: 12, basis: 'goods' }),
    });
    renderPanel();

    expect(await screen.findByText(/Осчетоводена · Контировка № 12/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Сторнирай/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Осчетоводи/i })).not.toBeInTheDocument();
    // the Основание picker is locked once posted
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
