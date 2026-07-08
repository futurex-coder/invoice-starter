'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ReceivedInvoiceUploader } from '@/components/received-invoices/ReceivedInvoiceUploader';
import { requireStringParam } from '@/lib/route-params';

export default function ReceivedInvoicesUploadPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  // ASYNC-SCAN: uploads are store-only and fast. As soon as the files are in,
  // send the user to the list — it shows the fresh 'analyzing' rows and drives
  // the parallel analysis + polling. No blocking, no separate review step here.
  const handleUploaded = () => {
    // The list's default view now shows the working set (analyzing / failed /
    // draft / confirmed) and drives analysis, so the base path is enough.
    router.push(`/c/${companyId}/received-invoices`);
  };

  return (
    <section className="mx-auto max-w-3xl flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild aria-label="Back to received invoices">
          <Link href={`/c/${companyId}/received-invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-medium lg:text-2xl">Upload received invoices</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drop the files</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceivedInvoiceUploader onAllUploaded={handleUploaded} />
          <p className="mt-3 text-xs text-gray-500">
            Files upload instantly, then analyze in the background. You&apos;ll
            see them in the list right away and can review each one as soon as
            it&apos;s ready — nothing is lost, everything is saved as a draft.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
