# Refactoring Plan: Teams → Multi-Company Architecture

## File Setup (do this first)

### 1. Place reference files

Create `docs/refactor/` in your project root and put these files inside:

```
docs/
  refactor/
    REFACTORING_PLAN.md    ← this file
    schema.ts              ← new Drizzle schema
    queries.ts             ← new query layer
    seed.ts                ← new seed script
    migration.sql          ← drop + triggers
```

### 2. Install Cursor rule (auto-context)

Place `refactoring-plan.mdc` in `.cursor/rules/`:

```
.cursor/
  rules/
    refactoring-plan.mdc   ← auto-injected into every Cursor chat
  settings.json
```

The `alwaysApply: true` frontmatter ensures Cursor always has the refactoring context — the renames, the architecture rules, and the permission matrix — without you needing to mention it.

### 3. How to use with Cursor

For each step below:
1. Open a **new** Cursor chat (Cmd+L or Ctrl+L)
2. Add reference files with `@file` — type `@docs/refactor/schema.ts` etc. The rule file loads automatically.
3. Paste the prompt from that step
4. After Cursor applies changes, run `npx tsc --noEmit` to check for errors
5. Fix any issues before moving to the next step

> **Tip**: For steps that touch many files (2.2, 4.1), use Cursor Composer (Cmd+I) instead of chat — it's better at multi-file edits.

---

## Overview

We are refactoring a Next.js + Drizzle ORM + Supabase application from a single-team-per-user SaaS starter into a multi-company accounting platform where:

- Users can own many companies and be assigned as accountant to many others
- Roles (`owner` | `accountant`) are company-scoped, not global
- Company impersonation via URL param `/c/:companyId/...` + `activeCompanyId` cookie
- Stripe billing is per-user (not per-company)
- Invoice numbering is strictly monotonic per company+series, enforced at DB level
- Credit/debit notes inherit their parent invoice's number
- Companies have globally unique EIK (partial unique, excluding soft-deleted)
- Partners can soft-link to existing companies in the system

### Key Renames

| Old | New |
|-----|-----|
| `teams` | `companies` |
| `team_members` | `company_members` |
| `team_company_profiles` | *(merged into `companies`)* |
| `teamId` (all FKs) | `companyId` |
| `users.role` | *(removed — roles live on `company_members` only)* |
| `getTeamForUser()` | `getCompaniesForUser()` |
| `getTeamByStripeCustomerId()` | `getUserByStripeCustomerId()` |

### Pre-Built Files (already written — DO NOT regenerate)

These 4 files are **complete and final**. They were designed and reviewed before this plan was created. Your job is NEVER to rewrite, modify, or generate alternatives to them — only to **use** them.

| File | What it is | What to do with it |
|---|---|---|
| `schema.ts` | Complete new Drizzle schema with all tables, relations, types, enums | Copy into `lib/db/schema.ts` (replacing the old one). Import types from it. Never edit. |
| `queries.ts` | All query functions (`getCompaniesForUser`, `verifyCompanyAccess`, `getDashboardMetrics`, etc.) | Copy into `lib/db/queries.ts` (replacing the old one). Call these functions. Never rewrite them or create duplicates. |
| `seed.ts` | Seed script with 2 users, 2 companies, cross-roles, invoices | Copy into `lib/db/seed.ts`. Run it once. Never edit. |
| `migration.sql` | Drops old tables + creates DB triggers for invoice numbering | Run against Supabase manually (Part 1 before drizzle push, Part 2 after). |

---

## Execution Steps

> **GOLDEN RULE FOR ALL STEPS**: The database layer (`schema.ts`, `queries.ts`, `seed.ts`, triggers) is DONE. Every Cursor prompt below is about the **application layer** — components, server actions, API routes, layouts, middleware, and context providers. If you find yourself wanting to modify `lib/db/schema.ts` or `lib/db/queries.ts`, STOP — you're going the wrong direction. Just import from them.

> **IMPORTANT**: Do each step as a separate Cursor chat/session. Do NOT try to do everything in one go. After each step, verify the app compiles and the relevant functionality works before moving to the next step.

---

## Phase 1: Database & Backend Foundation

### Step 1.1 — Drop old DB, apply new schema

**Do manually (not in Cursor):**

1. Run Part 1 of `migration.sql` against Supabase (drops all old tables)
2. Replace `lib/db/schema.ts` with the new `schema.ts`
3. Run `npx drizzle-kit push` (or `npx drizzle-kit generate` then `npx drizzle-kit migrate`)
4. Run Part 2 of `migration.sql` against Supabase (creates triggers)
5. Replace `lib/db/seed.ts` with the new `seed.ts`
6. Run the seed: `npx tsx lib/db/seed.ts`
7. Verify in Supabase dashboard that all tables exist, triggers are installed, and seed data is present

---

### Step 1.2 — Replace the query layer

**Do manually:**

1. Replace `lib/db/queries.ts` with the new `queries.ts`
2. This will cause TypeScript errors across the codebase — that's expected and intentional. The next steps fix those errors.

---

## Phase 2: Auth & Context Infrastructure

### Step 2.1 — Remove global user role, fix auth references

**Cursor context**: `@docs/refactor/schema.ts`

**Cursor prompt:**

```
We've refactored our database schema. The `users` table no longer has a `role` column — roles are now company-scoped and live on the `company_members` table (values: 'owner' | 'accountant').

Find every file in the codebase that references `user.role`, `users.role`, `role: 'member'`, `role: 'owner'` on the user object, or imports the old `User` type expecting a `role` field. Update them:

- Remove any logic that reads `user.role` for authorization decisions
- If the code was checking `user.role === 'owner'` to gate access, add a TODO comment: `// TODO: Replace with verifyCompanyRole() check after Step 2.3`
- If a component displays the user's role, add a TODO: `// TODO: Show role from company_members context`
- Do NOT delete authorization checks entirely — replace them with TODOs so we know where to come back

The new schema types are in `lib/db/schema.ts`. The `User` type no longer has `role`.
```

---

### Step 2.2 — Rename all team references to company

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts`

**Use Cursor Composer (Cmd+I)** — this step touches many files.

**Cursor prompt:**

```
We've renamed `teams` to `companies` and `team_members` to `company_members` across our entire database schema. The new schema is in `lib/db/schema.ts` and queries in `lib/db/queries.ts`.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. Only update the files that IMPORT from them.

Do a full codebase refactor:

1. **Imports**: Replace all imports of `teams`, `teamMembers`, `Team`, `NewTeam`, `TeamMember`, `NewTeamMember`, `TeamDataWithMembers`, `teamCompanyProfiles`, `TeamCompanyProfile` etc. with their new equivalents: `companies`, `companyMembers`, `Company`, `NewCompany`, `CompanyMember`, `NewCompanyMember`, `CompanyWithMembers`, etc.

2. **Variables and props**: Rename `teamId` → `companyId`, `team` → `company`, `teamName` → `companyName`, `teamMembers` → `companyMembers`, `teamData` → `companyData` in all components, hooks, server actions, API routes, and utility functions.

3. **Query calls**: Replace:
   - `getTeamForUser()` → `getCompaniesForUser(userId)` (note: now returns an array of all companies, not a single team)
   - `getUserWithTeam(userId)` → this function no longer exists. If code uses it, replace with `getCompaniesForUser(userId)` and pick the active company
   - `getTeamByStripeCustomerId()` → `getUserByStripeCustomerId()`
   - `updateTeamSubscription()` → `updateUserSubscription()`
   - Any query that was `eq(xxx.teamId, teamId)` should become `eq(xxx.companyId, companyId)`

4. **Types**: The old `TeamDataWithMembers` is now `CompanyWithMembers`. Update all usages.

5. **String literals**: Update any user-facing strings like "Team Settings" → "Company Settings", "Team Members" → "Members", "Create Team" → "Create Company", etc.

Do NOT change URL routes yet — we'll do that in a later step. Just update the internal code.
```

---

### Step 2.3 — Build the company context provider and middleware

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts` `@lib/middleware.ts`

**Cursor prompt:**

```
We need a company context system for our multi-company app. A user can belong to many companies and "impersonate" one at a time.

**URL pattern**: `/c/[companyId]/...` — the companyId is in the URL for all company-scoped pages.
**Cookie fallback**: `activeCompanyId` cookie stores the last-selected company for API routes that don't have companyId in the URL (like the dashboard).

Create the following:

### 1. `lib/context/company-context.tsx`
A React context provider that:
- Holds the current `company` object and `role` (owner/accountant) for the active company
- Holds the full list of `UserCompanyMembership[]` for the dropdown
- Provides a `switchCompany(companyId)` function that navigates to `/c/{companyId}/dashboard` and updates the cookie
- Is populated server-side and passed to the client

### 2. `lib/db/queries.ts` already exports:
- `getCompaniesForUser(userId)` — returns `UserCompanyMembership[]`
- `verifyCompanyAccess(userId, companyId)` — returns membership or null
- `verifyCompanyRole(userId, companyId, role)` — returns membership or null
- `getActiveCompanyId()` — reads from cookie

### 3. Middleware (`middleware.ts`)
Update the existing middleware to:
- For routes matching `/c/[companyId]/...`: extract companyId from the URL, verify the authenticated user has access via `verifyCompanyAccess()`. If no access, redirect to `/dashboard`. Also set the `activeCompanyId` cookie.
- For `/dashboard`: read `activeCompanyId` from cookie. If set, optionally use it for context. If not set and user has companies, redirect to `/c/{firstCompanyId}/dashboard`.
- For auth routes (`/sign-in`, `/sign-up`): no company context needed, pass through.
- For `/api/...` routes: read `activeCompanyId` from cookie for company context.

### 4. `lib/auth/permissions.ts`
A helper module with:
```typescript
export function canManageMembers(role: string): boolean {
  return role === 'owner';
}
export function canInviteMembers(role: string): boolean {
  return role === 'owner' || role === 'accountant';
}
export function canRemoveMembers(role: string): boolean {
  return role === 'owner';
}
export function canEditCompanySettings(role: string): boolean {
  return role === 'owner';
}
export function canDeleteCompany(role: string): boolean {
  return role === 'owner';
}
export function canManageInvoices(role: string): boolean {
  return true; // both owner and accountant
}
```

Use the types from `lib/db/schema.ts`: `CompanyRole`, `UserCompanyMembership`, `Company`, `CompanyMember`.

Note: the middleware needs to run server-side checks. For the `verifyCompanyAccess` call in middleware, you may need to adapt it since middleware runs on the edge — consider using a lightweight DB check or moving the heavy verification to a layout-level server component instead.
```

---

### Step 2.4 — Company switcher dropdown component

**Cursor context**: `@docs/refactor/schema.ts` `@components/ui/dropdown-menu.tsx`

**Cursor prompt:**

```
Create a company switcher dropdown component at `components/company-switcher.tsx`.

Requirements:
- Uses the company context from `lib/context/company-context.tsx`
- Shows the current company's `legalName` as the trigger button
- Dropdown lists all companies from `UserCompanyMembership[]`
- Each item shows: company `legalName` and a small badge indicating the user's role (`Owner` or `Accountant`)
- Clicking a company calls `switchCompany(companyId)` from context
- At the bottom of the dropdown, add a "Create Company" link that navigates to `/create-company`
- Style it to fit in a sidebar or top nav — keep it compact
- Use existing UI components from the project (shadcn/ui if available, otherwise match the current design system)

The types are:
```typescript
type UserCompanyMembership = {
  company: Company; // has id, legalName, eik, etc.
  role: string; // 'owner' | 'accountant'
};
```

Place the switcher in the main layout sidebar/nav where the old team name used to appear.
```

---

## Phase 3: Route Restructuring

### Step 3.1 — Create the `/c/[companyId]` route group

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts` `@app`

**Use Cursor Composer (Cmd+I)** — this step moves many files.

**Cursor prompt:**

```
We need to restructure our Next.js app routes to support multi-company context. Every company-scoped page should live under `/c/[companyId]/...`.

### Current route structure (approximate):
```
app/
  (dashboard)/
    page.tsx          → dashboard
    invoices/         → invoice list, create, edit
    partners/         → partner list
    articles/         → article catalog
    settings/         → team settings, members
```

### New route structure:
```
app/
  (dashboard)/
    dashboard/
      page.tsx                    → cross-company dashboard (metrics across all companies)
    c/
      [companyId]/
        layout.tsx                → company-scoped layout, loads company context
        dashboard/
          page.tsx                → single-company overview (optional, can redirect to invoices)
        invoices/
          page.tsx                → invoice list for this company
          new/
            page.tsx              → create invoice
          [invoiceId]/
            page.tsx              → invoice detail / edit
            preview/
              page.tsx            → invoice preview / PDF
        partners/
          page.tsx                → partner list
        articles/
          page.tsx                → article catalog
        settings/
          page.tsx                → company settings (legal info, bank, defaults)
          members/
            page.tsx              → member management
    create-company/
      page.tsx                    → create new company form
```

### Instructions:

1. Create the new directory structure under `app/(dashboard)/c/[companyId]/`
2. Create `app/(dashboard)/c/[companyId]/layout.tsx` that:
   - Reads `companyId` from params
   - Calls `getUser()` and `verifyCompanyAccess(userId, companyId)`
   - If no access, redirect to `/dashboard`
   - Loads the company data and passes it to the CompanyContextProvider
   - Renders children inside the provider
3. Move existing page components into the new structure. Do NOT rewrite them yet — just move the files and update their imports. They will have TypeScript errors from the old team references — that's fine, we fix those in Phase 4.
4. Update the main `(dashboard)/dashboard/page.tsx` to be the cross-company dashboard (we'll build it in Phase 5).
5. Update navigation links in sidebar/nav to use `/c/${companyId}/invoices` pattern instead of `/invoices`.
6. Add the company switcher component from Step 2.4 to the sidebar layout.

Keep the existing auth routes (`/sign-in`, `/sign-up`, etc.) untouched.
```

---

## Phase 4: Component Refactoring

### Step 4.1 — Fix server actions and API routes

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts` `@src/features`

**Use Cursor Composer (Cmd+I)** — this step touches many files.

**Cursor prompt:**

```
Our server actions and API routes still reference the old `teams` schema. We need to update them all to use the new company-scoped pattern.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify, rewrite, or duplicate any query functions. Only import and call the existing functions from `queries.ts`.

### Rules for every server action and API route:

1. **Get company context**: Instead of calling the old `getTeamForUser()` (which returned a single team), actions should receive `companyId` as a parameter and verify access:
```typescript
const user = await getUser();
if (!user) throw new Error('Not authenticated');
const membership = await verifyCompanyAccess(user.id, companyId);
if (!membership) throw new Error('No access to this company');
```

2. **Permission checks**: For actions that require owner role (company settings, member management, delete company), add:
```typescript
if (!canEditCompanySettings(membership.role)) {
  throw new Error('Insufficient permissions');
}
```
Import permission helpers from `lib/auth/permissions.ts`.

3. **Stripe actions**: Stripe webhook handlers should now look up users, not teams:
   - `getTeamByStripeCustomerId()` → `getUserByStripeCustomerId()`
   - `updateTeamSubscription()` → `updateUserSubscription()`
   - The subscription data is stored on the `users` table, not on a team/company

4. **Activity logging**: Every action that logs activity should use the `companyId` from the verified context:
```typescript
await db.insert(activityLogs).values({
  companyId: companyId,  // not teamId
  userId: user.id,
  action: ActivityType.CREATE_INVOICE,
  ipAddress: headers().get('x-forwarded-for') || '',
});
```

5. **Invoice creation**: When creating invoices, the `number` is now required (NOT NULL). The app should call `getNextInvoiceNumber(companyId, series)` to get the next number and pass it on insert. The DB trigger validates monotonic ordering and auto-advances the sequence.

Search the entire codebase for:
- `getTeamForUser`
- `getUserWithTeam`
- `getTeamByStripeCustomerId`
- `updateTeamSubscription`
- `teamId` in server actions
- `team.id` in server actions
- Any direct `db.insert` or `db.update` that references old table names

Fix them all according to the rules above. Use the query functions from `lib/db/queries.ts`.
```

---

### Step 4.2 — Refactor invoice components

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts` `@src/features/invoicing` `@src/features/bulgarian-invoicing`

**Cursor prompt:**

```
Refactor all invoice-related components to work with the new company-scoped architecture. The invoice pages now live under `/c/[companyId]/invoices/...`.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. Use the existing query functions: `getInvoicesForCompany()`, `getNextInvoiceNumber()`, `getPartnersForCompany()`, `getArticlesForCompany()`.

### What changed in the schema:

1. `invoices.teamId` → `invoices.companyId`
2. `invoices.number` is now NOT NULL (assigned at creation, not finalization)
3. `invoices.supplierProfileId` is removed — the company IS the supplier. Use `invoices.companyId` to look up company data for the supplier snapshot.
4. Credit/debit notes have `referencedInvoiceId` pointing to the parent invoice and inherit its `number`
5. `DocType` enum: `'invoice' | 'credit_note' | 'debit_note'`
6. `InvoiceStatus` enum: `'draft' | 'finalized' | 'cancelled'`

### Components to update:

**Invoice list page** (`invoices/page.tsx`):
- Get `companyId` from route params
- Call `getInvoicesForCompany(companyId, filters)` instead of the old team-scoped query
- Show `docType` column — invoices, credit notes, debit notes
- For CN/DN rows, show a link to the parent invoice
- Links should point to `/c/${companyId}/invoices/${invoiceId}`

**Invoice creation form** (`invoices/new/page.tsx`):
- Get `companyId` from route params
- Pre-fill the invoice number from `getNextInvoiceNumber(companyId, series)` — show it in the form, allow manual override
- The supplier section should load from the `companies` table directly (not from a separate `teamCompanyProfiles` table — it doesn't exist anymore)
- Partners dropdown loads from `getPartnersForCompany(companyId)`
- Articles dropdown loads from `getArticlesForCompany(companyId)`
- On submit, pass `companyId` and the chosen `number` to the server action

**Invoice detail/edit page** (`invoices/[invoiceId]/page.tsx`):
- Verify the invoice belongs to the current company
- If the invoice is finalized, show read-only view
- Show linked credit/debit notes if any exist

**Invoice preview/PDF** (`invoices/[invoiceId]/preview/page.tsx`):
- Update to read supplier data from `supplierSnapshot` (which now comes from the `companies` table, not `teamCompanyProfiles`)
- Everything else should work the same since snapshots are self-contained JSON

Update all `teamId` references to `companyId` in these components. Use the types from schema.ts.
```

---

### Step 4.3 — Refactor partner components

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts`

**Cursor prompt:**

```
Refactor the partner management components for the new company-scoped architecture.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. Use: `getPartnersForCompany()`, `findCompanyByEik()`.

### What changed:
1. `partners.teamId` → `partners.companyId`
2. New column: `partners.linkedCompanyId` (nullable FK to `companies`) — when a partner's EIK matches an existing company in the system, we store the link
3. Query: `getPartnersForCompany(companyId)` replaces any old team-scoped query

### Partner creation/edit form:
- When the user types an EIK, do a lookup: call `findCompanyByEik(eik)` on the server
- If a matching company exists in the system:
  - Pre-fill the form fields (name, address, VAT, MOL) from that company's data
  - Set `linkedCompanyId` to that company's ID
  - Show a subtle indicator: "This partner is a registered company in the system. Fields pre-filled from their profile."
  - Allow the user to override any field (the partner record is a local copy)
- If the EIK matches the current company's own EIK, show an error: "You cannot add yourself as a partner"
- If no match, proceed normally (linkedCompanyId stays null)

### Partner list:
- Add a small icon/badge on partners that have `linkedCompanyId` set — indicating they're linked to a real company in the system
- Links should use `/c/${companyId}/partners/...` pattern

All partner queries are now scoped to `companyId` from the URL params.
```

---

### Step 4.4 — Refactor settings and member management

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts`

**Cursor prompt:**

```
Refactor the company settings and member management pages.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. Use: `getCompanyWithMembers()`, `transferCompanyOwnership()`, `softDeleteCompany()`.

### Company settings (`/c/[companyId]/settings/page.tsx`):
- This replaces the old "Team Settings" page
- Shows and edits the company's legal info: legalName, EIK (read-only after creation), VAT number, address, MOL, bank details, default currency, default VAT rate, default payment method
- Only users with `owner` role can access this page. Use `canEditCompanySettings(role)` from `lib/auth/permissions.ts`. If the user is an accountant, redirect to the company dashboard or show "Access denied".
- At the bottom, add a danger zone section:
  - "Transfer Ownership" button — opens a modal to select another member to transfer to. Calls `transferCompanyOwnership()`. Show a confirmation dialog.
  - "Delete Company" button — soft-deletes the company. Calls `softDeleteCompany()`. Show a serious confirmation dialog ("This will remove access for all members. You can restore it later.").

### Member management (`/c/[companyId]/settings/members/page.tsx`):
- Shows all `company_members` with their user info and role
- Shows pending invitations
- **Invite form**: Both owners and accountants can invite. Accountants can only invite with role `accountant`. Owners can invite with any role. Use `canInviteMembers(role)`.
- **Remove member**: Only owners can remove members. Use `canRemoveMembers(role)`. An owner cannot remove themselves (they must transfer ownership first).
- Update the invitation server action to use `companyId` instead of `teamId`
- When accepting an invitation, create a `company_members` row instead of `team_members`

### Navigation:
- Settings link in sidebar should point to `/c/${companyId}/settings`
- Members sub-link to `/c/${companyId}/settings/members`

Import types and enums from `lib/db/schema.ts`: `CompanyRole`, `CompanyWithMembers`.
```

---

## Phase 5: Dashboard & New Features

### Step 5.1 — Cross-company dashboard

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts`

**Cursor prompt:**

```
Build the cross-company dashboard at `app/(dashboard)/dashboard/page.tsx`.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. The dashboard query is already written: `getDashboardMetrics(userId)` and `getActivityLogsForDashboard(userId, options)`. Just call them.

This is the user's home page — it shows aggregated metrics and activity across ALL companies they belong to.

### Data source:
Call `getDashboardMetrics(userId)` from `lib/db/queries.ts`. It returns:
```typescript
{
  companies: Array<{
    companyId: number;
    companyName: string;
    currency: string;
    revenue: number;      // paid invoices gross total
    outstanding: number;  // unpaid invoices gross total
    invoiceCountThisMonth: number;
    overdueCount: number;
    role: string;         // 'owner' | 'accountant'
  }>;
  totals: {
    revenue: number;
    outstanding: number;
    invoiceCount: number;
    overdueCount: number;
  };
}
```

### Layout:

**Top row — Summary cards (4 cards):**
- Total Revenue (all companies, paid invoices) — show sum, note "mixed currencies" if applicable
- Outstanding Amount (unpaid invoices)
- Invoices This Month (count)
- Overdue Invoices (count, highlight in red/warning if > 0)

**Middle section — Per-company breakdown:**
A card for each company showing:
- Company name + role badge (Owner / Accountant)
- Revenue | Outstanding | Overdue count for that specific company
- Currency label (BGN, EUR, etc.)
- Click on the card navigates to `/c/${companyId}/invoices`

**Bottom section — Recent activity:**
Call `getActivityLogsForDashboard(userId, { onlyOwnActions: true, limit: 10 })`.
Show a feed with:
- Action description (human-readable from ActivityType)
- Company name (since activity spans multiple companies)
- Timestamp (relative: "2 hours ago")
- Toggle: "Show only my actions" / "Show all activity" — the toggle only appears for companies where the user is an owner. When toggled, re-fetch with `onlyOwnActions: false`.

### If the user has no companies:
Show an empty state with a "Create your first company" CTA button linking to `/create-company`.

Use existing UI patterns from the project. Keep the design clean and card-based.
```

---

### Step 5.2 — Create company page

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts`

**Cursor prompt:**

```
Build the "Create Company" page at `app/(dashboard)/create-company/page.tsx`.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. Use `findCompanyByEik()` for the EIK check. For the insert, use `db.insert(companies)` and `db.insert(companyMembers)` directly — these are simple inserts, no custom query function needed.

This is a form that creates a new company and assigns the current user as owner.

### Form fields:
- Legal Name (required)
- EIK (required, 9 or 13 digits for Bulgarian companies)
- VAT Number (optional, format: BG + EIK)
- Is VAT Registered (checkbox, default true)
- Country (default 'BG')
- City (required)
- Street (required)
- Post Code (optional)
- MOL / Representative (optional)
- Bank Name (optional)
- IBAN (optional)
- BIC/SWIFT (optional)
- Default Currency (select: BGN, EUR, USD — default EUR)
- Default VAT Rate (number, default 20)
- Default Payment Method (select: bank, cash, card — default bank)

### EIK validation:
When the user types or pastes an EIK and the field loses focus (onBlur), make a server call to `findCompanyByEik(eik)`.
- If a match is found: show an error message below the field: "A company with this EIK already exists. Please ask the company owner to invite you instead." Disable the submit button.
- If no match: show a green checkmark. Enable submit.

### On submit:
1. Create the company in the `companies` table
2. Create a `company_members` row with `role: 'owner'` for the current user
3. Log `ActivityType.CREATE_COMPANY`
4. Redirect to `/c/${newCompanyId}/dashboard`

### Server action:
Create a server action `createCompany(formData)` that:
- Gets the authenticated user
- Checks EIK uniqueness (double-check server-side, the DB has a partial unique index too)
- Inserts the company
- Inserts the company_members row
- Returns the new company ID
```

---

### Step 5.3 — Restore deleted company flow

**Cursor context**: `@docs/refactor/queries.ts`

**Cursor prompt:**

```
Add a "Restore Company" section to the user's account settings or dashboard.

IMPORTANT: `lib/db/queries.ts` is already complete. Do NOT modify it. Use: `getDeletedCompaniesForUser()`, `restoreCompany()`.

### Query:
`getDeletedCompaniesForUser(userId)` returns soft-deleted companies where the user was the owner.

### UI:
- If the user has deleted companies, show a section (could be in account settings or as a banner on the dashboard): "You have {n} deleted companies that can be restored."
- Clicking shows a list of deleted companies with their legal name, EIK, and deletion date
- Each has a "Restore" button
- Restoring calls `restoreCompany(companyId)` and refreshes the page
- After restore, the company appears back in the company switcher dropdown

### Access control:
Only the original owner (whose company_members row still exists with role='owner') can restore. The `getDeletedCompaniesForUser` query already filters for this.
```

---

## Phase 6: Stripe Billing Refactor

### Step 6.1 — Update Stripe webhook handlers

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts` `@lib/payments`

**Cursor prompt:**

```
Stripe billing has moved from per-team to per-user. Update all Stripe-related code.

IMPORTANT: `lib/db/schema.ts` and `lib/db/queries.ts` are already complete and final. Do NOT modify them. The Stripe query functions are already in `queries.ts`: `getUserByStripeCustomerId()` and `updateUserSubscription()`. Just import and call them.

### What changed:
- Stripe fields (`stripeCustomerId`, `stripeSubscriptionId`, `stripeProductId`, `planName`, `subscriptionStatus`) are now on the `users` table, not on `teams`/`companies`
- The queries are now `getUserByStripeCustomerId()` and `updateUserSubscription()` from `lib/db/queries.ts`

### Files to update:

1. **Stripe webhook handler** (likely `app/api/stripe/webhook/route.ts` or similar):
   - `customer.subscription.created` / `updated` / `deleted` events: look up user by `getUserByStripeCustomerId(customerId)` instead of team
   - Call `updateUserSubscription(userId, data)` instead of `updateTeamSubscription(teamId, data)`
   - `checkout.session.completed`: associate `stripeCustomerId` with the user, not a team

2. **Checkout/billing page** (likely `app/(dashboard)/pricing/...` or `billing/...`):
   - When creating a Stripe checkout session, use the user's `stripeCustomerId`, not a team's
   - The subscription status check should read from `user.subscriptionStatus`, not `team.subscriptionStatus`
   - Any "Manage Subscription" portal link should use the user's Stripe customer ID

3. **Subscription guards** (middleware or layout checks):
   - If the app gates features behind a subscription, check `user.planName` / `user.subscriptionStatus` instead of the team's plan
   - A user's subscription covers ALL their companies — there's no per-company billing

4. **Seed script**: The old seed created Stripe products. The new seed does NOT create Stripe products — you'll need to create those manually or add them back to the seed if needed.

Search for all references to `stripeCustomerId`, `stripeSubscriptionId`, `planName`, `subscriptionStatus` and make sure they reference the `users` table/object, not teams/companies.
```

---

## Phase 7: Cleanup & Verification

### Step 7.1 — Full TypeScript error sweep

**Cursor context**: `@docs/refactor/schema.ts`

**Use Cursor Composer (Cmd+I)**.

**Cursor prompt:**

```
Run `npx tsc --noEmit` and fix every remaining TypeScript error in the project.

Common errors to expect:
1. References to old types: `Team`, `TeamMember`, `TeamDataWithMembers` → `Company`, `CompanyMember`, `CompanyWithMembers`
2. Property `teamId` doesn't exist → should be `companyId`
3. Property `role` doesn't exist on `User` → roles are on `CompanyMember`, access via context
4. Function `getTeamForUser` doesn't exist → `getCompaniesForUser`
5. Old imports from `schema.ts` that no longer exist
6. `invoices.number` is now `number` not `number | null`

Fix them all. For any error that requires a design decision, leave a `// FIXME:` comment explaining the issue.
```

---

### Step 7.2 — Test the full flow

**Cursor context**: `@docs/refactor/schema.ts` `@docs/refactor/queries.ts`

**Cursor prompt:**

```
Create a testing checklist component at `app/(dashboard)/debug/page.tsx` (development only) that verifies the refactoring works correctly.

This page should:
1. Show the current user info (id, email, name, subscription status)
2. List all companies the user belongs to, with role for each
3. Show the active company context (from URL or cookie)
4. For the active company, show:
   - Company details (legalName, EIK, etc.)
   - Number of partners
   - Number of articles
   - Number of invoices (by status: draft, finalized, cancelled)
   - Number of credit/debit notes
   - Next invoice number from the sequence
5. A button to test invoice creation (creates a draft invoice with the next number)
6. A button to test credit note creation (creates a CN on the first finalized invoice)
7. Activity log for this company (last 5 entries)

This is a debug/verification page — it can be ugly, just functional. Wrap it in a check that only renders in development: `if (process.env.NODE_ENV !== 'development') redirect('/');`
```

---

### Step 7.3 — Remove dead code

**Cursor context**: `@docs/refactor/schema.ts`

**Use Cursor Composer (Cmd+I)**.

**Cursor prompt:**

```
Search the entire codebase for any remaining dead code from the old team-based architecture:

1. Any file that still imports from tables that no longer exist: `teams`, `teamMembers`, `teamCompanyProfiles`
2. Any reference to `TeamCompanyProfile`, `NewTeamCompanyProfile`
3. Any function with "team" in the name that hasn't been updated
4. The old `docker-compose.yml` references in the setup script
5. Any TODO comments we added in earlier steps that still need resolution
6. Unused imports

List everything you find. For each item, either fix it or explain why it should be left as-is.
```

---

## Quick Reference: File Mapping

| Old File/Concept | New File/Concept |
|---|---|
| `lib/db/schema.ts` (teams, teamMembers, teamCompanyProfiles) | `lib/db/schema.ts` (companies, companyMembers, merged) |
| `lib/db/queries.ts` (getTeamForUser, etc.) | `lib/db/queries.ts` (getCompaniesForUser, verifyCompanyAccess, getDashboardMetrics, etc.) |
| `lib/db/seed.ts` (single user, single team) | `lib/db/seed.ts` (2 users, 2 companies, cross-roles) |
| Team settings page | `/c/[companyId]/settings` |
| Team members page | `/c/[companyId]/settings/members` |
| Invoice pages | `/c/[companyId]/invoices/...` |
| Single dashboard | Cross-company dashboard at `/dashboard` + per-company at `/c/[companyId]/dashboard` |
| No concept | Company switcher dropdown |
| No concept | `/create-company` page |
| No concept | `lib/auth/permissions.ts` |
| No concept | `lib/context/company-context.tsx` |

## Permission Matrix

| Action | Owner | Accountant |
|---|---|---|
| View company data (invoices, partners, articles) | ✅ | ✅ |
| Create/edit invoices | ✅ | ✅ |
| Create/edit partners | ✅ | ✅ |
| Create/edit articles | ✅ | ✅ |
| Edit company settings (legal info, bank) | ✅ | ❌ |
| Invite members | ✅ | ✅ (accountant role only) |
| Remove members | ✅ | ❌ |
| Transfer ownership | ✅ | ❌ |
| Delete company | ✅ | ❌ |
| Restore company | ✅ | ❌ |

## Invoice Numbering Rules

- Invoices: strictly monotonic per `(company_id, series)`, assigned at creation
- Credit/debit notes: inherit parent invoice's number
- DB trigger rejects `number <= MAX(existing)` for invoices
- DB trigger auto-advances `invoice_sequences.next_number`
- Manual override allowed but must be greater than current max
- Number, series, company_id, doc_type are immutable after creation (DB trigger blocks UPDATE)
- Cancelled invoice numbers are never reused
