# NAP (НАП) Compliance Requirements

> Requirements the app must meet per the Bulgarian National Revenue Agency (НАП).
> Supports **NAP-1** in `PRODUCT_ROADMAP.md`.

**Status:** ⛔ **STUB — source not yet extracted.** The owner attached `NAP.pdf`, but it's a
**scanned/image PDF with no text layer**, and the machine it was opened on had no OCR / PDF-to-
image tooling (no Python, tesseract, ghostscript, poppler renderer). It could not be read here.

**To fill this in (any of):**
- Owner pastes the requirements as text, or screenshots the key pages (images can be read).
- Re-open in an environment with OCR (tesseract / a PDF-to-image renderer + vision).
- Confirm which NAP document it is (invoice-content rules? SAF-T? mandatory e-invoicing notice?).

Once the content is here, do a **gap analysis** against the current invoice model
(`lib/db/schema.ts` invoices/receivedInvoices, the finalize/number logic, VAT handling) and
split the gaps into concrete roadmap items.

---

## Baseline (NOT the source — standard BG invoice rules, to verify against the PDF)
Bulgarian VAT-law (ЗДДС чл. 114) invoice essentials the app should already satisfy — use as a
sanity checklist, not as the NAP.pdf's actual content:
- Sequential 10-digit invoice number, unique per company/series *(app: yes — `getNextInvoiceNumber`)*
- Supplier + recipient: legal name, address, EIK/BULSTAT, VAT number *(app: yes)*
- Line items: description, quantity, unit, unit price *(app: yes)*
- Taxable base, VAT rate, VAT amount, gross total *(app: yes — `totals`)*
- Issue date + tax-event/supply date *(app: yes — issueDate / supplyDate)*
- Legal grounds when VAT is 0% / exempt *(app: partial — `noVatReason`/`vatMode`)*
- Original/copy marking *(verify)*
- Amount in words *(app: yes — `amountInWords`)*

**Unverified / possibly in the PDF:** SAF-T (Standard Audit File for Tax) export, mandatory
e-invoicing format/exchange, QR or control codes, specific electronic-submission requirements.
Do **not** assume these are or aren't required — the PDF decides.
