# UX audit — simplicity pass (run 2, 2026-07-09)

Goal (owner): **everything clear and easy to use, without many clicks.** Ranked backlog
from the run-2 market research (inv.bg / Dext / QuickBooks / Xero / FreshBooks) + repo-specific
findings. Each item tagged and marked with status as it ships this run.

## Shipping this run (high-impact, low-risk, buildable)

1. **[currency] Remove the manual FX-rate inputs** — new-invoice DocumentCard + received
   ReviewForm each had an "FX rate" field. GEN-1 now freezes the rate automatically at
   issue/confirm, so the manual field is obsolete + confusing. Remove both. ✅ **done**
2. **[dashboard] Three-tile money row** — top of the company dashboard: **Owed to me**
   (+ overdue), **I owe**, **VAT this month** (net), all in the company base currency (GEN-1),
   each a shortcut into its filtered list. Fixes the "what's my money picture" question in one
   glance. Builds on getCompanyMetrics/getCompanyExpenseMetrics/getMonthCloseStatus (all base now).
3. **[navigation] Status tabs on the invoice list** (All / Draft / Unpaid / Overdue / Paid) —
   removes filter-dropdown hunting; month filter already matches НАП reporting.
4. **[creation] Confirm + tighten smart defaults on new-invoice open** — dates=today,
   currency=company base, last-used payment method; number preview already shown.

## Backlog (bigger; log to roadmap, not this run)

- **[creation] Client autofill by ЕИК** (Commercial Register / VIES lookup) → name, address,
  VAT status. Biggest single data-entry cut; external API integration (own item).
- **[creation] Saved articles autocomplete** carrying price + unit + VAT (partial today).
- **[creation] Duplicate / "new from previous"** (Copy exists; surface it better) + one-click
  proforma→invoice (Convert exists from PROF-1).
- **[scanning] Review**: click-a-field-to-highlight-source region; remember per-supplier coding;
  flag only low-confidence (confidence hints already exist — tighten to "confirm, don't read").
- **[creation] Autosave drafts + keyboard line entry (Tab/Enter) + single "Create & send"**
  (needs EMAIL-1, deferred).
- **[recurring] Periodic invoice templates** (REC-1).

## Repo-specific loose ends found (minor)

- **Hardcoded `" EUR"` labels** now that GEN-1 converts to base: `SummaryGrid` (cross-company
  dashboard) and `PaymentKpiGrid` (payments) hardcode EUR. Correct today (all company bases are
  EUR) but should read the base currency. Low priority; log to REVIEW_QUEUE.
- **Cross-company dashboard** sums per-company base totals; if a user ever owns companies with
  *different* base currencies the cross-company total mixes bases. Edge (all EUR today).

Sources: run-2 research report (kik-info / BillBox / НАП / inv.bg / Dext / QBO / Xero).
See also `competitor-invoicing.md`, `euro-adoption-2026.md`.
