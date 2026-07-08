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
        <Button variant="ghost" size="icon" asChild aria-label="Назад към получените фактури">
          <Link href={`/c/${companyId}/received-invoices`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-medium lg:text-2xl">Качване на получени фактури</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Пуснете файловете</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceivedInvoiceUploader onAllUploaded={handleUploaded} />
          <p className="mt-3 text-xs text-gray-500">
            Файловете се качват веднага, след което се анализират във фонов
            режим. Ще ги видите в списъка веднага и можете да прегледате всеки,
            щом е готов — нищо не се губи, всичко се запазва като чернова.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
