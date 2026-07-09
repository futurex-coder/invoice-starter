import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Manrope } from 'next/font/google';
import { getSafeUser } from '@/lib/db/queries';
import { SWRConfig } from 'swr';
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Invoicly',
  description: 'Multi-company invoicing platform for Bulgarian businesses.'
};

export const viewport: Viewport = {
  maximumScale: 1
};

const manrope = Manrope({ subsets: ['latin'] });

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={cn('bg-white dark:bg-gray-950 text-black dark:text-white', manrope.className)}
    >
      <Analytics />
      <body className="min-h-[100dvh] bg-gray-50">
        <SWRConfig
          value={{
            // UX: stale-while-revalidate everywhere. `keepPreviousData` keeps
            // the last data on screen while a new key loads (so changing a
            // filter/page shows the old rows instead of a spinner), and
            // `revalidateIfStale` refreshes cached data in the background on
            // mount — old data instantly, silent update when it arrives.
            // Focus revalidation stays OFF to avoid alt-tab request storms;
            // reconnect is ON so coming back online refreshes.
            keepPreviousData: true,
            revalidateIfStale: true,
            revalidateOnReconnect: true,
            revalidateOnFocus: false,
            dedupingInterval: 5000,
            fallback: {
              // SECURITY: seed with the *safe* user (no passwordHash). The
              // SWRConfig fallback is serialized to the client, so seeding
              // with the full row would leak the bcrypt hash into the page.
              // Matches the /api/user route, which returns getSafeUser().
              '/api/user': getSafeUser(),
            }
          }}
        >
          {children}
        </SWRConfig>
        <Toaster />
      </body>
    </html>
  );
}
