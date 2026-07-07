# Review Queue

> **The single place the autonomous agent logs anything that needs your attention.**
> It runs unattended (god mode) and never stops to ask — instead it appends here and
> keeps working. Skim this when you come back; resolve items, then delete or strike them.

## How the agent uses this file
When it hits a question, product decision, ambiguity, or a blocker it can't safely resolve,
it appends an entry using the template below and then either:
- proceeds with a sensible **reversible** default (noted in the entry), or
- skips that item and moves to the next actionable one.

## How you use this file
- Read top-to-bottom. **OPEN** = needs your input. **PROCEEDED** = it made a reversible
  choice you should sanity-check. **BLOCKED** = it skipped the item; your answer unblocks it.
- Answer inline under the entry, then change status to **RESOLVED** (or delete it). Durable
  decisions should also be copied to the relevant doc's decisions register + memory.

## Entry template
```
### [ID] <short title> — <OPEN | PROCEEDED | BLOCKED>
- **When:** <what work was in flight>
- **Context:** <what it hit, file:line if relevant>
- **Options:** <the choices, if it's a decision>
- **What I did:** <the reversible default it took, or "skipped — waiting on you">
- **Needs from you:** <the specific question/decision>
```

---

## Open items

_(The agent appends below. Seeded with the known-open product decisions from
`PRODUCT_ROADMAP.md` §2 so they live in one place.)_

### D-CANCEL — Invoice "Cancel" behavior — OPEN
- **Needs from you:** Ask Koceto how Cancel should work. Today it marks the invoice
  `cancelled` (immutable) and you reverse via a credit note. Confirm what's wrong / desired.
- **Blocks:** OI-3.

### D-FX — FX rate source for currency conversion — OPEN
- **Needs from you:** Approve the source. Recommendation: ECB daily reference rates, cached
  daily, with the rate frozen onto each document at finalize. Base = `companies.defaultCurrency`.
- **Blocks:** GEN-1 (currency correctness), DASH-1.

### D-AUTH — Google login: library vs. hand-rolled — OPEN
- **Needs from you:** Decide after the agent drafts an ADR (Auth.js vs. `arctic` + existing
  `users` table). Security-review required before merge.
- **Blocks:** AUTH-1.

### D-EMAIL — Email transport + ingestion scope — OPEN
- **Needs from you:** (1) SMTP/deliverability provider for sending. (2) Scope of "look over
  all emails" — recommend limiting to invoice-relevant emails auto-matched to partners.
- **Blocks:** EMAIL-1, EMAIL-2.
