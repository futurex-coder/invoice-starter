# Knowledge Base

Persistent, cross-session knowledge for this project. Anything a future session would
be glad someone wrote down goes here — so we never re-learn the same thing twice.

## What belongs here
- **Research** — competitor analysis, library/API evaluations, "how does X work" write-ups.
- **Findings** — non-obvious facts discovered while working (a schema quirk, a gotcha in
  a dependency, why a thing is done a certain way).
- **Audits** — e.g. the money-aggregation-rules map (DASH-1), inventories of where a
  pattern is used.
- **Decision context** — the reasoning behind a decision, longer than fits in a doc's
  decisions register. (The decision *itself* also goes in the relevant living doc's
  register + memory.)

## What does NOT belong here
- Architecture Decision Records → `docs/adr/`.
- The living plans → `docs/REFACTOR_BACKLOG.md`, `docs/PRODUCT_ROADMAP.md`.
- Session-scoped todos → the harness Task list (they die with the session).
- Secrets, tokens, credentials → never commit these anywhere.

## Conventions
- One topic per file, kebab-case: `competitor-invoicing.md`, `money-aggregation-audit.md`,
  `fx-rate-sources.md`.
- Start each file with a one-line summary + the date it was written (dates get stale —
  say when a finding was true).
- Link back to the roadmap/backlog item it supports (e.g. "supports RESEARCH-1 / OI-7").
- Update or delete a file when its finding is superseded — stale knowledge is worse than none.

## Index
_(add a line per file as you create them)_
- _(none yet)_
