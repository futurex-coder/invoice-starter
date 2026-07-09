'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageShell } from '@/components/page-shell';
import { requireStringParam } from '@/lib/route-params';
import { logger } from '@/lib/logger';

/**
 * Company-scope error boundary. Catches errors within /c/[companyId]/*
 * routes while preserving the company-layout shell (nav, header, etc.).
 *
 * The most user-friendly recovery options here are:
 *   - Retry the segment (via `reset()`)
 *   - Bail back to the company dashboard
 *   - Bail back to the user dashboard (multi-company picker)
 */
export default function CompanyScopeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const companyId = requireStringParam(params, 'companyId');

  useEffect(() => {
    logger.error('company error boundary triggered', {
      err: error,
      digest: error.digest,
      companyId,
    });
  }, [error, companyId]);

  return (
    <PageShell>
      <Alert variant="error" className="mb-4">
        <AlertTitle>Страницата не можа да се зареди.</AlertTitle>
        <AlertDescription>
          {error.message ||
            'Възникна неочаквана грешка при зареждането на данните за тази фирма.'}
          {error.digest && (
            <span className="mt-2 block font-mono text-xs opacity-70">
              реф: {error.digest}
            </span>
          )}
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button onClick={reset}>Опитай отново</Button>
        <Button variant="outline" asChild>
          <Link href={`/c/${companyId}/dashboard`}>Табло на фирмата</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Смени фирмата</Link>
        </Button>
      </div>
    </PageShell>
  );
}
