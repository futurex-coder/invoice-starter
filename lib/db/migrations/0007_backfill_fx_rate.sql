-- GEN-1 A2 backfill: stamp fxRate (doc→company-base) on EXISTING documents so
-- the aggregation layer (A3) converts them correctly. Going forward, finalize /
-- note-creation / received-confirm freeze this automatically.
--
-- Canonical: amount_base = amount_doc × fx_rate. BGN↔EUR uses the FIXED
-- euro-adoption rate 1.95583 (never ECB). Idempotent (re-running is a no-op).
-- NOTE: this repurposes fx_rate — it previously held a EUR→BGN print multiplier
-- (the print now uses the fixed constant directly, so no print regression).

-- Same currency as the company base → 1.
UPDATE invoices i SET fx_rate = 1
  FROM companies c
 WHERE c.id = i.company_id AND i.currency = c.default_currency;
UPDATE received_invoices r SET fx_rate = 1
  FROM companies c
 WHERE c.id = r.company_id AND r.currency = c.default_currency;

-- BGN document, EUR base → 1 / 1.95583.
UPDATE invoices i SET fx_rate = round(1.0 / 1.95583, 6)
  FROM companies c
 WHERE c.id = i.company_id AND i.currency = 'BGN' AND c.default_currency = 'EUR';
UPDATE received_invoices r SET fx_rate = round(1.0 / 1.95583, 6)
  FROM companies c
 WHERE c.id = r.company_id AND r.currency = 'BGN' AND c.default_currency = 'EUR';

-- EUR document, BGN base → 1.95583 (kept for completeness; no such rows today).
UPDATE invoices i SET fx_rate = 1.95583
  FROM companies c
 WHERE c.id = i.company_id AND i.currency = 'EUR' AND c.default_currency = 'BGN';
UPDATE received_invoices r SET fx_rate = 1.95583
  FROM companies c
 WHERE c.id = r.company_id AND r.currency = 'EUR' AND c.default_currency = 'BGN';

-- USD document, EUR base → approximate historical snapshot for the handful of
-- existing dev docs (frozen). Going forward this is frozen from ECB at confirm.
-- 1 USD ≈ 0.92 EUR (mid-2026 ballpark).
UPDATE received_invoices r SET fx_rate = 0.92
  FROM companies c
 WHERE c.id = r.company_id AND r.currency = 'USD' AND c.default_currency = 'EUR';
