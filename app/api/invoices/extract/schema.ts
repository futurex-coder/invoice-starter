import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const ExtractedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  vat_rate: z.union([z.literal(0), z.literal(9), z.literal(20)]),
  discount_percent: z.number().min(0).max(100),
});

export const ExtractedInvoiceSchema = z.object({
  issue_date: z.string().regex(ISO_DATE).nullable(),
  due_date: z.string().regex(ISO_DATE).nullable(),
  currency: z.enum(['BGN', 'EUR', 'USD']).nullable(),
  payment_method: z.enum(['bank', 'cash', 'barter']).nullable(),
  customer_note: z.string().nullable(),
  supplier_name: z.string().nullable(),
  supplier_eik: z.string().nullable(),
  line_items: z.array(ExtractedLineItemSchema),
  confidence: z.enum(['high', 'medium', 'low']),
});

export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

export const ExtractApiResponseSchema = z.union([
  z.object({ data: ExtractedInvoiceSchema }),
  z.object({ error: z.string() }),
]);
