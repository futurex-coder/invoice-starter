# Product Context — Invoicly

> **What we're building, for whom, and why.** The single source of product truth that every
> session (including Fable) reads before building. Every roadmap item should serve something
> here. Anything still `TBD` is an open product question — the important ones are also in
> `REVIEW_QUEUE.md`.

**Owner:** @yoan (solo founder) · **Last updated:** 2026-07-07 · **Status:** v1 captured from founder interview
*(Brand shown in-app as "Invoicly"; founder also writes it "Invoicely".)*

---

## 0. Known from the code + docs
- **Stack:** Next.js 16 (App Router) · Drizzle ORM · Supabase Postgres · Stripe (billing, unused
  for now — product is free) · Anthropic SDK (AI invoice extraction) · Tailwind v4.
- **Model:** multi-company. A user can own many companies **and** be an accountant on others.
  Roles are company-scoped: `owner | accountant`. Company context via `/c/[companyId]/…`.
- **Core today:** issue invoices / credit-debit notes (10-digit sequential numbering, VAT
  breakdown, amount-in-words), upload received invoices → AI-extract → review → confirm,
  partners, articles, payments, activity log, dashboard.
- **Compliance posture:** Bulgaria / НАП; BG + EN UI. i18n deferred.

---

## 1. Vision & positioning
- **What it is:** An app to run a company's money end-to-end — create a company, track **expenses**
  (by adding received invoices) and **income/profit** (by creating invoices). A company owner can
  invite another user as **accountant**, giving transparency and frictionless document sharing
  between owner and accountant. Every user can be both an owner (of their companies) and an
  accountant (for others).
- **Core problem:**
  1. **Transparency** between accountant and owner — sharing documents without chat/email ping-pong.
  2. **Money visibility** — track every movement, especially **VAT paid vs VAT received**, so you
     know what tax you owe and how to optimize it.
- **Why now / why us:** Today it's painful to send each new invoice (income) or received invoice
  (expense) over chat/email; hard to know how much tax to pay; and there's no clear monthly view of
  the VAT owed to НАП, how much was optimized, and how much was actually paid.
- **Differentiation:** The incumbents (inv.bg, Microinvest, fakturi.bg) are **good but old and hard
  to use.** Invoicly's edge = modern, genuinely easy UX + AI-powered received-invoice capture + real
  owner↔accountant transparency. *(Founder-synthesized from 1d + 8a + 3c.)*

## 2. Target users
- **Optimize for both equally:** the **business owner** and the **accountant**.
- **Business profile:** freelancers, micro-companies, SMEs.
- **Accountant load:** many clients — roughly **~300 companies** per accountant (no hard number).
- **Geography:** long-term goal is **all countries**; **focused on Bulgaria now** (founder has BG
  clients ready to use it). → keep new code jurisdiction-aware but don't build multi-country yet.

## 3. Jobs to be done
1. **Owner ↔ accountant sync:** owner effortlessly shares all company invoices and sees what's going
   on; accountant sees every invoice and can **extract all the info they need to do their work**.
2. **Money clarity:** clearly see company **expenses, profits, VAT paid, VAT received**.
3. **Findability:** all documents are easy to find; and it's easy to **find an accountant**.
- **Accountant month-end (needs detail):** they must be able to consume everything from the company
  to **give НАП what's required**. *Exact flow TBD — good target for competitor research + talking
  to a real accountant.*
- **Aha moment:** creating a company (or joining as accountant) and immediately seeing how easy it is
  to understand the company's money, its invoices, and the owner↔accountant communication.

## 4. Must-haves vs. non-goals
- **Non-negotiable:** create invoices (income) · capture + store + analyze received invoices
  (expenses) · owner↔accountant transparency · all the company money numbers (expenses, profit, VAT
  paid/received).
- **Transparency, concretely** (the #1 pain): beyond invite + shared invoice list (already exists),
  it needs **notifications on new/changed documents** (both directions) + a **shared "what's left
  this month" status view** (done vs pending for НАП). → roadmap **TRANS-1, TRANS-2**.
- **Not-now / future:** accountant **directory/marketplace** ("find an accountant") — aspirational,
  **not MVP**; revisit post-launch. Multi-country / i18n — deferred. Pricing / paywall — deferred.

## 5. Business model
- **Free now.** Pricing / who-pays / per-what is **deferred** — Stripe is wired but unused. Decide later.

## 6. Compliance & legal (НАП) — **high priority, ASAP**
- **Scope:** invoice **content rules**, **SAF-T**, the **mandatory e-invoicing rollout**, and more.
  *(Exact requirements still needed — `NAP.pdf` couldn't be OCR'd; see NAP-DOC in REVIEW_QUEUE and
  `knowledge/nap-compliance.md`.)*
- **Urgency:** ASAP.
- **Positioning:** compliance is a **selling point** — "we keep you НАП-safe": correct numbers,
  correct invoices, easy to use.

## 7. Competitors & edge
- Direct: **inv.bg, Microinvest, fakturi.bg** — powerful but dated and hard to use.
- **Edge:** modern easy UX + AI received-invoice extraction + owner↔accountant transparency +
  НАП-safety. *(Founder said "not sure" — this is synthesized; confirm/refine.)*

## 8. AI & automation
- **AI extraction is very important** — "there is no other way to consume the information" (turning a
  received PDF into structured, usable data is core, not a nice-to-have).
- **Automation vision:** not yet defined. *(Open — candidates to explore: auto-categorize expenses,
  VAT-optimization suggestions, monthly НАП-prep, payment reminders, bank reconciliation.)*

## 9. Integrations — priority order
1. **Google login**
2. **Email send (Gmail)**
3. **Accounting-software export**
*(Bank feeds / НАП e-submission / payment links / email ingestion — later.)*

## 10. Design, brand & platform
- **Brand:** clean / minimal, **professional**.
- **Language:** **BG default**; EN acceptable for now.
- **Platform:** **desktop-first, but mobile is really important** — accountants work on **desktop**,
  owners are expected to be more on **mobile**. → every owner-facing surface must be excellent on
  mobile; accountant-heavy surfaces optimize for desktop.

## 11. Success, timeline & constraints
- **6-month success:** **≥ 1000 users** (owners + accountants combined).
- **Timeline:** no fixed launch date; **compliance is ASAP**.
- **Constraints:** solo founder; has **Claude Max** + some budget for the **Claude API** (keep AI
  usage cost-aware).
- **MVP:** everything in §4 (create invoices, capture/analyze received invoices, owner↔accountant
  transparency, full company money numbers) — working, easy, and НАП-correct.

---

## Still open (worth nailing down)
- **Accountant month-end flow** (§3) — the precise steps + what НАП needs. Research + ask a real accountant.
- **NAP.pdf specifics** (§6) — need the document content (NAP-DOC).
- **Automation vision** (§8) — pick the first automation to pursue after MVP.
- **Pricing** (§5) — revisit when moving off free.
- **Differentiation/edge wording** (§7) — founder to confirm the synthesized version.
