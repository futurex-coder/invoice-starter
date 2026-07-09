import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  ExtractedInvoiceSchema,
  CRITICAL_FIELD_KEYS,
  type ExtractedInvoice,
  type CriticalFieldKey,
} from '@/app/api/invoices/extract/schema';
import { logger } from '@/lib/logger';

export const ALLOWED_EXTRACT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedExtractMimeType = (typeof ALLOWED_EXTRACT_MIME_TYPES)[number];

// claude-sonnet-4-20250514 was retired (404 not_found on the API). Use the
// current Sonnet 4.x — vision-capable and cost-appropriate for high-volume
// invoice extraction.
export const EXTRACTION_MODEL_ID = 'claude-sonnet-4-6';

export function isAllowedExtractMimeType(
  t: string
): t is AllowedExtractMimeType {
  return (ALLOWED_EXTRACT_MIME_TYPES as readonly string[]).includes(t);
}

const SYSTEM_PROMPT = `You are an expert invoice parser specializing in Bulgarian and Eastern European invoices. You will be shown a single invoice document (image or PDF). Your job is to extract every requested field, scoring how confident you are in each one. Respond with STRICT JSON ONLY — no markdown, no code fences, no explanatory text, no preamble, no trailing prose. Start with { and end with }.

Each field is an object: { "value": <extracted value or null>, "confidence": "high" | "medium" | "low" | "missing", "reason": <optional string> }
- "high": clearly readable, you are sure.
- "medium": readable but partially obscured, ambiguous, or you had to interpret context.
- "low": you guessed or it was almost illegible.
- "missing": the field is genuinely not present on the document. Use a "reason" string explaining (e.g. "no supply date printed").

For numeric/array fields (line_items) use "line_items_confidence" at the top level instead of per-line confidence.

OUTPUT SCHEMA:
{
  "invoice_number": { "value": string | null, "confidence": "high"|"medium"|"low"|"missing", "reason": string|null },
  "issue_date": { "value": "YYYY-MM-DD" | null, "confidence": ..., "reason": ... },
  "supply_date": { "value": "YYYY-MM-DD" | null, "confidence": ..., "reason": ... },
  "currency": { "value": "BGN"|"EUR"|"USD"|null, "confidence": ..., "reason": ... },
  "payment_method": { "value": "bank"|"cash"|"barter"|null, "confidence": ..., "reason": ... },
  "supplier_name": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_eik": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_vat_number": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_address_street": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_address_city": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_address_post_code": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_address_country": { "value": string|null, "confidence": ..., "reason": ... },
  "supplier_mol": { "value": string|null, "confidence": ..., "reason": ... },
  "recipient_name": { "value": string|null, "confidence": ..., "reason": ... },
  "recipient_eik": { "value": string|null, "confidence": ..., "reason": ... },
  "customer_note": { "value": string|null, "confidence": "high"|"medium"|"low"|"missing" },
  "line_items": [{ "description": string, "quantity": number, "unit": string, "unit_price": number, "vat_rate": 0|9|20, "discount_percent": number }],
  "line_items_confidence": "high"|"medium"|"low"|"missing",
  "overall_confidence": "high"|"medium"|"low",
  "notes": [string]   // optional list of things you couldn't read clearly
}

EXTRACTION RULES:

Invoice number:
- Look for labels: "Фактура №", "Фактура No", "Invoice No", "Invoice #", "№", "Number", "Документ №".
- The value can be ANY string — pure digits ("0000000123"), alphanumeric ("INV-2026-001"), or partner-specific codes ("AB/2026/42"). Preserve leading zeros and punctuation exactly.
- If multiple numbers appear (e.g. an invoice number AND a reference to another invoice), pick the one labeled as the document's own number — usually the most prominent number near the top.

Dates:
- Convert ALL dates to ISO format YYYY-MM-DD. Bulgarian dates appear as DD.MM.YYYY (e.g. "12.03.2026" → "2026-03-12"). Slashes "12/03/2026" follow the same DD/MM/YYYY convention.
- "issue_date" = "Дата на издаване" / "Дата на фактура" / "Issue date" / just "Дата" near the header.
- "supply_date" = "Дата на данъчно събитие" / "Tax point" / "Date of supply". May equal issue date.
- If a date is genuinely not shown, set value=null with confidence="missing" and a reason. Do NOT fabricate.

Currency:
- "лв", "BGN", "лева" → BGN
- "€", "EUR", "евро" → EUR
- "$", "USD" → USD

Payment method:
- "по банков път", "банков превод", "bank transfer" → "bank"
- "в брой", "cash" → "cash"
- "бартер", "barter" → "barter"

Supplier (Доставчик / Издател):
- supplier_name: legal name as printed.
- supplier_eik: 9 or 10 digits. Strip any "ЕИК:" prefix and whitespace.
- supplier_vat_number: VAT/ДДС number, e.g. "BG123456789". Bulgarian VAT numbers are the EIK with a "BG" prefix.
- supplier_address_street: street + house number ("ул. Витоша 5", "бул. Цар Освободител 12А").
- supplier_address_city: city / town. Bulgarian cities: София, Пловдив, Варна, Бургас, etc.
- supplier_address_post_code: 4-digit postal code in BG.
- supplier_address_country: ISO-2 ("BG", "RO", "DE"). Default to "BG" only if the address looks Bulgarian.
- supplier_mol: МОЛ (representative person, "Управител").

Recipient (Получател / Купувач):
- recipient_name and recipient_eik — extract from the "Получател" / "Купувач" / "Bill to" block. This helps verify the document was actually issued TO our user's company.

Line items:
- Each row of the items table. Skip subtotals, VAT, totals, and amount-in-words rows.
- "vat_rate" must be exactly 0, 9, or 20 (Bulgarian rates). Pick the closest if uncertain.
- "discount_percent" = 0 if no discount column.
- If the table is unreadable or there are no clear line items, return an empty array and set "line_items_confidence" to "missing" or "low" with a reason in "notes".

CRITICAL — DO NOT GIVE UP EARLY:
- Scan the entire document for each field before declaring "missing". Bulgarian invoices often have these fields in non-obvious places (right header, footer, side panel).
- If text is rotated or in a stamp, still try to read it.
- For supplier_eik specifically, look near the supplier_name AND in the footer — Bulgarian invoices often print full company details in both places.
- "missing" should only be used when you've checked the whole document. Otherwise use "low" + reason.

QUALITY:
- Output JSON only. Start with {. End with }. No markdown fences. No prose.
- Every key in the schema MUST appear in your output, even when value is null.`;

const RETRY_PROMPT = `Some critical fields were not extracted on the first pass. Please re-examine the document carefully — look at headers, footers, sidebars, stamps, and any rotated text. Focus specifically on these missing or uncertain fields: {{MISSING_FIELDS}}.

Return the SAME JSON object structure as before, but with a fresh attempt. If after this second pass a field is genuinely not on the document, set confidence to "missing" with a clear reason explaining what you looked for.`;

function buildFileBlock(fileType: AllowedExtractMimeType, data: string) {
  if (fileType === 'application/pdf') {
    return {
      type: 'document' as const,
      source: {
        type: 'base64' as const,
        media_type: 'application/pdf' as const,
        data,
      },
    };
  }
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: fileType,
      data,
    },
  };
}

function extractJsonText(text: string): string {
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenceMatch && fenceMatch[1]) return fenceMatch[1].trim();
  return trimmed;
}

export class InvoiceExtractionError extends Error {
  constructor(
    message: string,
    readonly statusCode: number = 502
  ) {
    super(message);
    this.name = 'InvoiceExtractionError';
  }
}

export interface ExtractInvoiceResult {
  data: ExtractedInvoice;
  modelId: string;
  passes: number;
}

interface CallModelResult {
  raw: string;
  parsed: ExtractedInvoice;
}

async function callModel(input: {
  client: Anthropic;
  bytes: Uint8Array | Buffer;
  mimeType: AllowedExtractMimeType;
  userText: string;
  previousAssistantText?: string;
}): Promise<CallModelResult> {
  const base64Data = Buffer.from(input.bytes).toString('base64');

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: 'user',
      content: [
        buildFileBlock(input.mimeType, base64Data),
        { type: 'text' as const, text: input.userText },
      ],
    },
  ];

  // Carry the prior attempt forward so the model can refine its own output.
  if (input.previousAssistantText) {
    messages.push({
      role: 'assistant',
      content: [{ type: 'text' as const, text: input.previousAssistantText }],
    });
    messages.push({
      role: 'user',
      content: [
        buildFileBlock(input.mimeType, base64Data),
        { type: 'text' as const, text: input.userText },
      ],
    });
  }

  let message: Anthropic.Messages.Message;
  try {
    message = await input.client.messages.create({
      model: EXTRACTION_MODEL_ID,
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages,
    });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      throw new InvoiceExtractionError(
        `Anthropic API error: ${error.message}`,
        502
      );
    }
    throw new InvoiceExtractionError(
      error instanceof Error ? error.message : 'Unexpected error',
      500
    );
  }

  const textBlock = message.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new InvoiceExtractionError('Model returned no text content');
  }

  const jsonText = extractJsonText(textBlock.text);
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(jsonText);
  } catch {
    throw new InvoiceExtractionError('Model did not return valid JSON');
  }

  const result = ExtractedInvoiceSchema.safeParse(parsedRaw);
  if (!result.success) {
    throw new InvoiceExtractionError(
      `Extracted JSON did not match expected schema: ${result.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`
    );
  }

  return { raw: textBlock.text, parsed: result.data };
}

// Identify critical fields that are missing or low-confidence enough to
// warrant a second look.
function findFieldsToRetry(extraction: ExtractedInvoice): CriticalFieldKey[] {
  const out: CriticalFieldKey[] = [];
  for (const key of CRITICAL_FIELD_KEYS) {
    const f = extraction[key];
    if (!f) continue;
    if (
      f.confidence === 'missing' ||
      (f.value === null && f.confidence !== 'high')
    ) {
      out.push(key);
    }
  }
  return out;
}

/**
 * Extract invoice fields with up to one re-prompt if critical fields are
 * missing on the first pass. Throws InvoiceExtractionError on failure.
 */
export async function extractInvoiceFromBytes(input: {
  bytes: Uint8Array | Buffer;
  mimeType: AllowedExtractMimeType;
}): Promise<ExtractInvoiceResult> {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new InvoiceExtractionError(
      'Server is missing CLAUDE_API_KEY',
      500
    );
  }

  const client = new Anthropic({ apiKey });

  // First pass.
  const first = await callModel({
    client,
    bytes: input.bytes,
    mimeType: input.mimeType,
    userText:
      'Extract invoice fields as JSON per the system prompt. Score every field with a per-field confidence.',
  });

  const missing = findFieldsToRetry(first.parsed);
  if (missing.length === 0) {
    return { data: first.parsed, modelId: EXTRACTION_MODEL_ID, passes: 1 };
  }

  // Re-prompt to look again at the missing critical fields.
  const retryUserText = RETRY_PROMPT.replace(
    '{{MISSING_FIELDS}}',
    missing.join(', ')
  );

  let second: CallModelResult;
  try {
    second = await callModel({
      client,
      bytes: input.bytes,
      mimeType: input.mimeType,
      userText: retryUserText,
      previousAssistantText: first.raw,
    });
  } catch (error) {
    // Re-prompt failed — fall back to the first-pass result rather than
    // 500-ing the whole upload. The user can still review and fill in.
    logger.warn('extract retry failed, using first-pass result', { err: error });
    return { data: first.parsed, modelId: EXTRACTION_MODEL_ID, passes: 1 };
  }

  // Merge: prefer the retry value when it has higher confidence on a
  // critical field; otherwise keep first pass.
  const merged = mergeExtractions(first.parsed, second.parsed, missing);
  return { data: merged, modelId: EXTRACTION_MODEL_ID, passes: 2 };
}

const CONFIDENCE_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
  missing: 0,
};

function mergeExtractions(
  first: ExtractedInvoice,
  second: ExtractedInvoice,
  fieldsToConsider: CriticalFieldKey[]
): ExtractedInvoice {
  const out: ExtractedInvoice = { ...second };

  // Generic helper — binds K on both sides so TS can prove `src[key]` is
  // assignable to `dest[key]`. Replaces a former double-cast workaround.
  function copyField<K extends CriticalFieldKey>(
    dest: ExtractedInvoice,
    src: ExtractedInvoice,
    key: K
  ): void {
    dest[key] = src[key];
  }

  for (const key of fieldsToConsider) {
    const a = first[key];
    const b = second[key];
    if (!a || !b) continue;
    const rankA = CONFIDENCE_RANK[a.confidence] ?? 0;
    const rankB = CONFIDENCE_RANK[b.confidence] ?? 0;
    if (rankA > rankB) {
      // Keep first pass for this field.
      copyField(out, first, key);
    }
  }

  return out;
}
