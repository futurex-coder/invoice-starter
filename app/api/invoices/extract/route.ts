import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { ExtractedInvoiceSchema } from './schema';

// ---------------------------------------------------------------------------
// Allowed input types
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(t: string): t is AllowedType {
  return (ALLOWED_TYPES as readonly string[]).includes(t);
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildFileBlock(fileType: AllowedType, data: string) {
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

// ---------------------------------------------------------------------------
// POST /api/invoices/extract
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Server is missing CLAUDE_API_KEY' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileType = file.type;
    if (!isAllowedType(fileType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType || 'unknown'}` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            buildFileBlock(fileType, base64Data),
            {
              type: 'text',
              text: 'Extract invoice fields as JSON per the system prompt.',
            },
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'Model returned no text content' },
        { status: 502 }
      );
    }

    const jsonText = extractJsonText(textBlock.text);
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        { error: 'Model did not return valid JSON' },
        { status: 502 }
      );
    }

    const result = ExtractedInvoiceSchema.safeParse(parsed);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Extracted JSON did not match expected schema' },
        { status: 502 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    console.error('extract invoice error:', error);
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API error: ${error.message}` },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
