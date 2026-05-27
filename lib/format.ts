/**
 * Display formatters for the UI layer.
 *
 * Use these in dashboards, tables, cards, and other "show data to the user"
 * surfaces. They follow the viewer's browser conventions where reasonable
 * (e.g. `toLocaleString` for money grouping) but pin the locale where
 * consistency matters (`'en-GB'` for dates).
 *
 * For **document** (invoice / credit note / PDF) rendering — which must
 * look identical regardless of the viewer's locale — use the deterministic
 * BG-formatted helpers from `src/features/bulgarian-invoicing/formatter.ts`:
 *
 *   - `formatDateBg(iso)` → "DD.MM.YYYY" (e.g. "27.05.2026")
 *   - `formatMoney(n)`    → "1 234.56" (space-grouped, dot-decimal)
 *
 * The two sets are intentional — UI vs. document — and should not be merged.
 */

/**
 * Format a date for display. Accepts a Date, an ISO string, or null.
 * Returns "—" for null/empty and the original string for unparseable input.
 */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    return typeof value === 'string' ? value : '—';
  }
  return d.toLocaleDateString('en-GB');
}

/**
 * Format a monetary amount with thousand-separator grouping and exactly
 * 2 decimal places, using the viewer's browser locale.
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Short relative-time label: "just now", "5m ago", "3h ago", "2d ago",
 * or fallback to {@link formatDate} for dates older than ~30 days.
 *
 * Accepts a Date, ISO string, or null/undefined (returns empty string).
 */
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(d);
}
