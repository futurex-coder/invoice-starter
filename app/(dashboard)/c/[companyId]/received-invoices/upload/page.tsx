'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ReceivedInvoiceUploader } from '@/components/received-invoices/ReceivedInvoiceUploader';

interface Uploaded {
  receivedInvoiceId: number;
  originalName: string;
}

export default function ReceivedInvoicesUploadPage() {
  const router = useRouter();
  const params = useParams();
  const companyId = params.companyId as string;

  const [uploaded, setUploaded] = useState<Uploaded[]>([]);

  const startReview = () => {
    if (uploaded.length === 0) return;
    router.push(
      `/c/${companyId}/received-invoices/review/${uploaded[0].receivedInvoiceId}`
    );
  };

  return (
    <section className="mx-auto max-w-3xl flex-1 p-4 lg:p-8">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/c/${companyId}/received-invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-medium lg:text-2xl">Upload received invoices</h1>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">1. Drop the files</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceivedInvoiceUploader
            onAllUploaded={(items) =>
              setUploaded((prev) => {
                const seen = new Set(prev.map((p) => p.receivedInvoiceId));
                const fresh = items.filter(
                  (i) => !seen.has(i.receivedInvoiceId)
                );
                return [...prev, ...fresh];
              })
            }
          />
        </CardContent>
      </Card>

      {uploaded.length > 0 && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              2. Review extracted data
            </CardTitle>
            <Button
              onClick={startReview}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Start review
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {uploaded.map((u) => (
                <li
                  key={u.receivedInvoiceId}
                  className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="flex-1 truncate">{u.originalName}</span>
                  <Link
                    href={`/c/${companyId}/received-invoices/review/${u.receivedInvoiceId}`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Review →
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              You can review them now or come back later — drafts wait in the
              queue and aren&apos;t counted in any totals until confirmed.
            </p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
