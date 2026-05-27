/**
 * Payment-page-specific utilities. Generic `formatDate` / `formatMoney`
 * live in `@/lib/format` — only payment-domain helpers belong here.
 */

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}

/** Default lower bound for the Paid view. */
export function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().slice(0, 10);
}
