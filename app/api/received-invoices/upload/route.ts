import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'crypto';
import { isAllowedExtractMimeType } from '@/lib/ai/extract-invoice';
import {
  uploadToBucket,
  buildReceivedInvoiceObjectKey,
  extensionForMime,
  RECEIVED_INVOICES_BUCKET,
  deleteFromBucket,
} from '@/lib/supabase/storage';
import { withApiCompanyAuth } from '@/lib/auth/guards';
import { createAnalyzingRow } from '@/src/features/received-invoices/actions';
import { logger } from '@/lib/logger';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ASYNC-SCAN: this route is now STORE-ONLY. It validates + uploads the file and
// inserts an 'analyzing' row, returning immediately (no AI call). The client
// then kicks off analysis via POST /api/received-invoices/[id]/analyze, so the
// upload never blocks on extraction.
export const POST = withApiCompanyAuth(async ({ companyId }, request) => {
  const log = logger.child({ route: '/api/received-invoices/upload', companyId });
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileType = file.type;
    if (!isAllowedExtractMimeType(fileType)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType || 'unknown'}` },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds 10 MB limit' },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const checksum = createHash('sha256').update(buffer).digest('hex');

    const objectKey = buildReceivedInvoiceObjectKey({
      companyId,
      uuid: randomUUID(),
      extension: extensionForMime(fileType),
    });

    await uploadToBucket({
      bucket: RECEIVED_INVOICES_BUCKET,
      path: objectKey,
      body: buffer,
      contentType: fileType,
    });

    const result = await createAnalyzingRow({
      fileBucket: RECEIVED_INVOICES_BUCKET,
      fileObjectKey: objectKey,
      fileMimeType: fileType,
      fileSizeBytes: buffer.length,
      fileOriginalName: file.name,
      fileChecksumSha256: checksum,
    });

    if (result.error || !result.data) {
      // Roll back the storage upload so we don't leave orphaned blobs.
      try {
        await deleteFromBucket({
          bucket: RECEIVED_INVOICES_BUCKET,
          path: objectKey,
        });
      } catch (cleanupError) {
        log.warn('cleanup after row-create failure', { err: cleanupError });
      }
      return NextResponse.json(
        { error: result.error ?? 'Failed to create row' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data });
  } catch (error) {
    log.error('received-invoices upload error', { err: error });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
});
