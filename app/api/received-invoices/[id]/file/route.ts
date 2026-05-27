import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { receivedInvoices } from '@/lib/db/schema';
import { createSignedUrl } from '@/lib/supabase/storage';
import { withApiCompanyAuth } from '@/lib/auth/guards';

export const GET = withApiCompanyAuth(async (
  { companyId },
  request,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: idParam } = await params;
    const id = Number(idParam);
    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }
    const wantRedirect = request.nextUrl.searchParams.get('redirect') === '1';

    const [row] = await db
      .select({
        fileBucket: receivedInvoices.fileBucket,
        fileObjectKey: receivedInvoices.fileObjectKey,
      })
      .from(receivedInvoices)
      .where(
        and(
          eq(receivedInvoices.id, id),
          eq(receivedInvoices.companyId, companyId)
        )
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const url = await createSignedUrl({
      bucket: row.fileBucket,
      path: row.fileObjectKey,
      expiresInSeconds: 600,
    });

    if (wantRedirect) {
      return NextResponse.redirect(url, { status: 302 });
    }

    return NextResponse.json({ url, expiresIn: 600 });
  } catch (error) {
    console.error('received-invoices file route error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unexpected error',
      },
      { status: 500 }
    );
  }
});
