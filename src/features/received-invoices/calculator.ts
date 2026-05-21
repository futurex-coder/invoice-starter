import type { ReceivedInvoiceLineInput } from './types';

export interface CalculatedLine extends ReceivedInvoiceLineInput {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

export interface CalculatedTotals {
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function calculateReceivedInvoice(
  lines: ReceivedInvoiceLineInput[]
): { items: CalculatedLine[]; totals: CalculatedTotals } {
  const items: CalculatedLine[] = lines.map((line) => {
    const subtotal = line.quantity * line.unitPrice;
    const discount = subtotal * (line.discountPercent / 100);
    const net = round2(subtotal - discount);
    const vat = round2(net * (line.vatRate / 100));
    const gross = round2(net + vat);
    return {
      ...line,
      netAmount: net,
      vatAmount: vat,
      grossAmount: gross,
    };
  });

  const totals = items.reduce<CalculatedTotals>(
    (acc, l) => ({
      netAmount: round2(acc.netAmount + l.netAmount),
      vatAmount: round2(acc.vatAmount + l.vatAmount),
      grossAmount: round2(acc.grossAmount + l.grossAmount),
    }),
    { netAmount: 0, vatAmount: 0, grossAmount: 0 }
  );

  return { items, totals };
}

export function linesFromExtraction(extraction: {
  line_items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    vat_rate: 0 | 9 | 20;
    discount_percent: number;
  }>;
}): ReceivedInvoiceLineInput[] {
  return extraction.line_items.map((l) => ({
    description: l.description,
    quantity: l.quantity,
    unit: l.unit,
    unitPrice: l.unit_price,
    vatRate: l.vat_rate,
    discountPercent: l.discount_percent,
  }));
}
