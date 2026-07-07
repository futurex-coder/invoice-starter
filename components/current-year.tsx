'use client';

/**
 * Renders the current year on the client. Server components can't read the
 * current time during static prerender (cacheComponents), so the footer
 * copyright year lives in this tiny client island instead.
 */
export function CurrentYear() {
  return <>{new Date().getFullYear()}</>;
}
