import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const SupplierSnapshotSchema = z.object({
  legalName: z.string().nullable(),
  eik: z.string().nullable(),
  vatNumber: z.string().nullable(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  postCode: z.string().nullable().optional(),
});

export const ReceivedInvoiceLineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().nonnegative(),
  unit: z.string().min(1).max(20),
  unitPrice: z.number().nonnegative(),
  vatRate: z.union([z.literal(0), z.literal(9), z.literal(20)]),
  discountPercent: z.number().min(0).max(100),
});

export const ReceivedInvoiceReviewSchema = z.object({
  partnerId: z.number().int().positive().nullable().optional(),
  supplier: SupplierSnapshotSchema,
  createPartnerOnConfirm: z.boolean(),

  invoiceNumber: z.string().max(100).nullable(),
  issueDate: z.string().regex(ISO_DATE).nullable(),
  supplyDate: z.string().regex(ISO_DATE).nullable(),
  dueDate: z.string().regex(ISO_DATE).nullable(),

  currency: z.string().length(3),
  fxRate: z.number().positive(),

  paymentMethod: z.enum(['bank', 'cash', 'barter']),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']),
  accountingStatus: z.enum(['pending', 'accounted']),

  lineItems: z.array(ReceivedInvoiceLineSchema),

  notes: z.string().nullable(),
});

export type ReceivedInvoiceReviewInputParsed = z.infer<
  typeof ReceivedInvoiceReviewSchema
>;
