import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { receivedInvoices } from '@/lib/db/schema';
import { downloadFromBucket } from '@/lib/supabase/storage';
import {
  extractInvoiceFromBytes,
  isAllowedExtractMimeType,
  InvoiceExtractionError,
} from '@/lib/ai/extract-invoice';
import { withApiCompanyAuth } from '@/lib/auth/guards';
import {
  applyExtractionToRow,
  markAnalysisFailed,
} from '@/src/features/received-invoices/actions';
import { logger } from '@/lib/logger';

// ASYNC-SCAN: runs the AI extraction for a stored 'analyzing' (or 'failed',
// i.e. retry) row, fills it, and flips it to 'draft'. Fired by the client in
// parallel after upload — this is where the (slow) Claude call lives now.
export const POST = withApiCompanyAuth(async (
  { companyId },
  request,
  { params }: { params: Promise<{ id: string }> }
) => {
  const log = logger.child({ route: '/api/received-invoices/[id]/analyze', companyId });
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  const [row] = await db
    .select({
      fileBucket: receivedInvoices.fileBucket,
      fileObjectKey: receivedInvoices.fileObjectKey,
      fileMimeType: receivedInvoices.fileMimeType,
      status: receivedInvoices.status,
    })
    .from(receivedInvoices)
    .where(
      and(eq(receivedInvoices.id, id), eq(receivedInvoices.companyId, companyId))
    )
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Idempotent: if it's already been analyzed/reviewed, don't re-run.
  if (row.status !== 'analyzing' && row.status !== 'failed') {
    return NextResponse.json({ data: { id, status: row.status } });
  }

  if (!isAllowedExtractMimeType(row.fileMimeType)) {
    await markAnalysisFailed(id, `Unsupported file type: ${row.fileMimeType}`);
    return NextResponse.json(
      { error: 'Unsupported file type' },
      { status: 400 }
    );
  }

  try {
    const bytes = await downloadFromBucket({
      bucket: row.fileBucket,
      path: row.fileObjectKey,
    });

    const extraction = await extractInvoiceFromBytes({
      bytes,
      mimeType: row.fileMimeType,
    });

    const result = await applyExtractionToRow(
      id,
      extraction.data,
      extraction.modelId
    );

    if (result.error || !result.data) {
      await markAnalysisFailed(id, result.error ?? 'Failed to save extraction');
      return NextResponse.json(
        { error: result.error ?? 'Failed to save extraction' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Analysis failed';
    log.error('analyze error', { err: error, id });
    await markAnalysisFailed(id, message);
    const status =
      error instanceof InvoiceExtractionError ? error.statusCode : 500;
    return NextResponse.json({ error: message }, { status });
  }
});
