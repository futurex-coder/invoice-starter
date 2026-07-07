'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { logger } from '@/lib/logger';

/**
 * Root error boundary. Catches errors anywhere in the app that aren't
 * caught by a more specific boundary (e.g. dashboard/c/[companyId]/error.tsx).
 *
 * Next.js calls this with the thrown error + a `reset()` function that
 * re-renders the affected segment. We log to console in dev so the user
 * can see what happened; production should hook this into Sentry.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('root error boundary triggered', {
      err: error,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Alert variant="error">
          <AlertTitle>Something went wrong.</AlertTitle>
          <AlertDescription>
            An unexpected error occurred. You can try the page again or go back
            home.
            {error.digest && (
              <span className="mt-2 block font-mono text-xs opacity-70">
                ref: {error.digest}
              </span>
            )}
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
