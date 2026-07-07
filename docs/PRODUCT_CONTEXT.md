# Product Context — Invoicly

> **What we're building, for whom, and why.** The single source of product truth that every
> session (including Fable) reads before building. Fill the **A:** lines as decisions are made;
> anything still `TBD` is an open product question — mirror the important ones into
> `REVIEW_QUEUE.md`.

**Owner:** @yoan (solo founder) · **Last updated:** 2026-07-07 · **Status:** interview in progress

---

## 0. Known from the code + docs (established — correct me if wrong)
- **Product:** "Invoicly" — invoicing/accounting web app for Bulgarian businesses; tagline
  "Invoicing for Bulgarian businesses, simplified and compliant."
- **Stack:** Next.js 16 (App Router) · Drizzle ORM · Supabase Postgres · Stripe (per-user
  billing) · Anthropic SDK (AI invoice extraction) · Tailwind v4.
- **Model:** multi-company. A user can own many companies and be an accountant on others.
  Roles are company-scoped: `owner | accountant`. Company context via `/c/[companyId]/…`.
- **Core today:** issue invoices / credit-debit notes (10-digit sequential numbering, VAT
  breakdown, amount-in-words), upload received invoices → AI-extract → review → confirm,
  partners, articles, payments, activity log, dashboard.
- **Compliance posture:** Bulgaria / НАП; BG + EN UI mix. i18n deferred.

---

## 1. Vision & positioning
- One-sentence pitch: _(TBD)_
- The core problem we solve: _(TBD)_
- Why now / why us: _(TBD)_
- Differentiation vs inv.bg, Microinvest, fakturi.bg: _(TBD)_

## 2. Target users
- Primary user — accountant, business owner, or both? _(TBD)_
- Typical business size / industry: _(TBD)_
- How many companies does a typical accountant manage here? _(TBD)_
- BG-only, or expand to other markets later? _(TBD)_

## 3. Jobs to be done
- Top 3 things a user comes here to do: _(TBD)_
- The accountant's month-end workflow: _(TBD)_
- The "aha" moment that makes them stay: _(TBD)_

## 4. Must-haves vs. non-goals
- Non-negotiable features to be usable at all: _(TBD)_
- Explicitly out of scope / won't build: _(TBD)_

## 5. Business model
- Free / paid? Pricing tiers: _(TBD)_
- Who pays — accountant or the business? _(TBD)_
- Charged per user / per company / per invoice / flat? _(TBD)_

## 6. Compliance & legal (НАП)
- What does NAP.pdf actually require (invoice rules / SAF-T / e-invoicing mandate)? _(TBD — see nap-compliance.md)_
- Any hard deadline driving compliance work? _(TBD)_
- Is "compliance" a primary selling point or table stakes? _(TBD)_

## 7. Competitors & differentiation
- Who do we most compete with, and what do they do badly? _(TBD)_
- Our unfair advantage: _(TBD)_

## 8. AI & automation
- How central is the AI extraction to the value prop? _(TBD)_
- Future automation vision (auto-categorize, reminders, auto-accounting)? _(TBD)_

## 9. Integrations (priority order)
- Google (auth + email), bank feeds, accounting-software export, NAP e-submission, payment links — rank them: _(TBD)_

## 10. Design, brand & platform
- Brand tone / feel; default language (BG or EN)? _(TBD)_
- Desktop-first or mobile-first? _(TBD)_

## 11. Success, timeline & constraints
- What does success look like in 6 months (metric)? _(TBD)_
- Launch date / deadlines? _(TBD)_
- Constraints — team, budget, tech? _(TBD)_
- MVP definition — what must be true to launch? _(TBD)_
