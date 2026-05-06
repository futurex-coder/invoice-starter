import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import {
  ExtractedInvoiceSchema,
  type ExtractedInvoice,
} from '@/app/api/invoices/extract/schema';

export const ALLOWED_EXTRACT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export type AllowedExtractMimeType = (typeof ALLOWED_EXTRACT_MIME_TYPES)[number];

export const EXTRACTION_MODEL_ID = 'claude-sonnet-4-20250514';

export function isAllowedExtractMimeType(
  t: string
): t is AllowedExtractMimeType {
  return (ALLOWED_EXTRACT_MIME_TYPES as readonly string[]).includes(t);
}

const SYSTEM_PROMPT = `You are an expert Bulgarian invoice parser. You will be shown a single invoice document (image or PDF). Extract the fields below and respond with STRICT JSON ONLY — no markdown, no code fences, no explanatory text, no preamble, no trailing prose.

Output schema (every key required, use null when not visible):
{
  "issue_date": string | null,           // ISO YYYY-MM-DD
  "due_date": string | null,             // ISO YYYY-MM-DD
  "currency": "BGN" | "EUR" | "USD" | null,
  "payment_method": "bank" | "cash" | "barter" | null,
  "customer_note": string | null,
  "supplier_name": string | null,
  "supplier_eik": string | null,         // 9 or 10 digits, digits only
  "line_items": [
    {
      "description": string,
      "quantity": number,
      "unit": string,                    // e.g. "бр.", "кг", "ч"
      "unit_price": number,              // pre-VAT, per unit
      "vat_rate": 0 | 9 | 20,
      "discount_percent": number         // 0–100
    }
  ],
  "confidence": "high" | "medium" | "low"
}

Rules:
- Dates MUST be ISO format YYYY-MM-DD. Bulgarian dates often appear as DD.MM.YYYY — convert them.
- Currency: detect from the document. "лв"/"BGN" → "BGN"; "€"/"EUR" → "EUR"; "$"/"USD" → "USD". Otherwise null.
- Payment method: "банков път"/"по банков път"/"банка"/"bank transfer" → "bank"; "в брой"/"cash" → "cash"; "бартер"/"barter" → "barter". Otherwise null.
- VAT rate must be exactly 0, 9, or 20 (Bulgarian rates). Pick the closest if uncertain.
- supplier_eik: digits only (strip any prefix or whitespace). 9 or 10 digits.
- discount_percent: 0 if not shown.
- confidence: "high" when document is clear and key fields readable; "medium" when some fields uncertain or partially obscured; "low" when document is blurry, partial, or many fields missing.
- Output JSON only. No markdown fences. No prose. Start with { and end with }.`;

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
}

/**
 * Run invoice extraction on raw bytes. Throws InvoiceExtractionError on failure.
 * Caller is responsible for HTTP status mapping.
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

  const base64Data = Buffer.from(input.bytes).toString('base64');
  const client = new Anthropic({ apiKey });

  let message: Anthropic.Messages.Message;
  try {
    message = await client.messages.create({
      model: EXTRACTION_MODEL_ID,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            buildFileBlock(input.mimeType, base64Data),
            {
              type: 'text',
              text: 'Extract invoice fields as JSON per the system prompt.',
            },
          ],
        },
      ],
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new InvoiceExtractionError('Model did not return valid JSON');
  }

  const result = ExtractedInvoiceSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvoiceExtractionError(
      'Extracted JSON did not match expected schema'
    );
  }

  return { data: result.data, modelId: EXTRACTION_MODEL_ID };
}
