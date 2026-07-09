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
            // PERF (R2/T1): the SSR fallback below is authoritative for the
            // session, so stop SWR's default background revalidation from
            // firing a `GET /api/user` on every mount / window-focus /
            // reconnect (each was a needless DB round-trip carrying no new
            // info). Data that must refresh does so via explicit mutate()
            // (sign-out, profile update) or its own refreshInterval
            // (notifications). List mutations refetch via runMutation.
            revalidateOnFocus: false,
            revalidateOnReconnect: false,
            revalidateIfStale: false,
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
