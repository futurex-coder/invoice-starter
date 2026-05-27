import { NextRequest, NextResponse } from 'next/server';
import {
  extractInvoiceFromBytes,
  isAllowedExtractMimeType,
  InvoiceExtractionError,
} from '@/lib/ai/extract-invoice';
import { getUser } from '@/lib/db/queries';

export async function POST(request: NextRequest) {
  // Auth gate — this endpoint calls Anthropic and burns credits per request.
  // Unauthenticated callers must be rejected before any work is done.
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileType = file.type;
    if (!isAllowedExtractMimeType(fileType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType || 'unknown'}` },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const result = await extractInvoiceFromBytes({
      bytes: Buffer.from(buffer),
      mimeType: fileType,
    });

    return NextResponse.json({ data: result.data });
  } catch (error) {
    if (error instanceof InvoiceExtractionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }
    console.error('extract invoice error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
