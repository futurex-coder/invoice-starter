import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// Confidence per field. A field with `value: null` AND `confidence: 'low'` +
// a `reason` typically means the value is genuinely not visible on the doc.
// `confidence: 'low'` with a non-null value means the AI guessed.
const FieldConfidenceSchema = z.enum(['high', 'medium', 'low', 'missing']);
export type FieldConfidence = z.infer<typeof FieldConfidenceSchema>;

const StringFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: FieldConfidenceSchema,
  reason: z.string().nullable().optional(),
});
const DateFieldSchema = z.object({
  value: z.string().regex(ISO_DATE).nullable(),
  confidence: FieldConfidenceSchema,
  reason: z.string().nullable().optional(),
});

export const ExtractedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number(),
  unit: z.string(),
  unit_price: z.number(),
  vat_rate: z.union([z.literal(0), z.literal(9), z.literal(20)]),
  discount_percent: z.number().min(0).max(100),
});

export const ExtractedInvoiceSchema = z.object({
  // Document identity
  invoice_number: StringFieldSchema,

  // Dates
  // (due_date was removed per RV-2 — it confused users during review. Old
  // stored extractions still parse: Zod strips unknown keys.)
  issue_date: DateFieldSchema,
  supply_date: DateFieldSchema.optional(),

  // Money
  currency: z.object({
    value: z.enum(['BGN', 'EUR', 'USD']).nullable(),
    confidence: FieldConfidenceSchema,
    reason: z.string().nullable().optional(),
  }),
  payment_method: z.object({
    value: z.enum(['bank', 'cash', 'barter']).nullable(),
    confidence: FieldConfidenceSchema,
    reason: z.string().nullable().optional(),
  }),

  // Supplier (the company that issued the invoice)
  supplier_name: StringFieldSchema,
  supplier_eik: StringFieldSchema, // 9 or 10 digits
  supplier_vat_number: StringFieldSchema, // e.g. BG123456789
  supplier_address_street: StringFieldSchema,
  supplier_address_city: StringFieldSchema,
  supplier_address_post_code: StringFieldSchema,
  supplier_address_country: StringFieldSchema, // ISO-2 if known
  supplier_mol: StringFieldSchema, // representative

  // Recipient (the user's company — used to verify it's actually for them)
  recipient_name: StringFieldSchema,
  recipient_eik: StringFieldSchema,

  // Free text
  customer_note: z.object({
    value: z.string().nullable(),
    confidence: FieldConfidenceSchema,
  }),

  // Lines
  line_items: z.array(ExtractedLineItemSchema),
  line_items_confidence: FieldConfidenceSchema,

  // Whole-document signal
  overall_confidence: z.enum(['high', 'medium', 'low']),
  // Free-form list of things the model could not read or is unsure about
  notes: z.array(z.string()).optional(),
});

export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;
export type ExtractedInvoice = z.infer<typeof ExtractedInvoiceSchema>;

export const ExtractApiResponseSchema = z.union([
  z.object({ data: ExtractedInvoiceSchema }),
  z.object({ error: z.string() }),
]);

// Helpers for downstream code that just wants the raw value.
export function fieldValue<T>(
  field: { value: T | null; confidence: FieldConfidence } | undefined
): T | null {
  return field?.value ?? null;
}

export function fieldConfidence(
  field: { confidence: FieldConfidence } | undefined
): FieldConfidence {
  return field?.confidence ?? 'missing';
}

// Critical fields whose absence justifies a re-prompt to Claude.
export const CRITICAL_FIELD_KEYS = [
  'invoice_number',
  'issue_date',
  'supplier_name',
  'supplier_eik',
] as const;

export type CriticalFieldKey = (typeof CRITICAL_FIELD_KEYS)[number];
