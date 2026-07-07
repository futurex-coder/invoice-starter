'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { PageShell } from '@/components/page-shell';
import { logger } from '@/lib/logger';

/**
 * Dashboard-scope error boundary. Catches errors within (dashboard)/*
 * while preserving the outer html/body layout. Keeps the user on the
 * dashboard shell instead of bouncing to the root error page.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('dashboard error boundary triggered', {
      err: error,
      digest: error.digest,
    });
  }, [error]);

  return (
    <PageShell>
      <Alert variant="error" className="mb-4">
        <AlertTitle>This page failed to load.</AlertTitle>
        <AlertDescription>
          Something went wrong while rendering the dashboard. Try again, or
          contact support if the problem persists.
          {error.digest && (
            <span className="mt-2 block font-mono text-xs opacity-70">
              ref: {error.digest}
            </span>
          )}
        </AlertDescription>
      </Alert>
      <Button onClick={reset}>Try again</Button>
    </PageShell>
  );
}
