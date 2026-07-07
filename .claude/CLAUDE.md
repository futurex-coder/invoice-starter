# Coding Rules

## TypeScript — strictly forbidden
- NEVER use `any` type — use `unknown` and narrow it, or define a proper type
- NEVER use `as SomeType` type assertions — fix the type properly instead
- NEVER use `// @ts-ignore` or `// @ts-expect-error` without explicit approval
- NEVER use `as unknown as SomeType` double-cast workarounds
- If you don't know the type, ask — don't cast

## Allowed alternatives
- Use `unknown` + type guards (`if (typeof x === 'string')`)
- Use Zod for runtime validation of external data
- Use Drizzle's inferred types (`typeof table.$inferSelect`)
- Use generics instead of `any` for flexible functions

# Working Process

## Commit your own work — don't wait to be asked
- Work on a **feature branch off `main`**, never commit directly to `main`.
- After each self-contained item (a fix, a feature slice, a doc update) passes the
  **verify quad** — `npm run type-check`, `npm run lint` (0 warnings), `npm test`
  (baseline 214; needs POSTGRES_URL for the integration suite), and `npm run build`
  when routes/config/deps change — **commit it
  atomically** with a descriptive message. One logical change per commit; keep history
  bisectable. End commit messages with the `Co-Authored-By` trailer.
- **Committing is local.** Do NOT push or open a PR unless explicitly asked.
- If a change needs a product decision or is riskier/bigger than expected, do NOT block —
  see **Autonomous operation** below (log it to `docs/REVIEW_QUEUE.md` and keep moving).

## Verify by running — and self-correct until it's right
Type-check, lint, and tests are necessary but **not sufficient**. Before considering any
change done, **run the app and watch it actually work**:
- Start a preview — `.claude/launch.json` has a `dev` config. Use the `run` / `verify`
  skills or the `preview_*` tools (`preview_start`, then `preview_screenshot` /
  `preview_snapshot`, `preview_console_logs`, `preview_network`, `preview_click` / `preview_fill`).
- Exercise the exact thing you changed **and** the flow around it. Check real behavior:
  correct data, correct totals, **no console errors, no failed network requests**, layout
  intact at desktop and mobile widths.
- **If anything is wrong, broken, or even feels off / strange — do not commit.** Re-read your
  own code, find the **root cause** (not a band-aid), fix it, then run and observe again.
  Repeat the **build → run → observe → fix** loop until you are genuinely confident the
  behavior is correct across the happy path *and* the edge cases (empty, large, mixed
  currency, cancelled/credit-noted, concurrent).
- Only once it's verified-by-running do you run the full verify quad and commit.
- For non-visual logic (server actions, parsers, aggregations), "run it" means an actual
  execution path — a focused test, a throwaway script, or a DB round-trip — not just reading
  the code. Assert the output, don't eyeball it.

Treat "it compiles and tests pass" as the floor, never the finish line.

## Track everything
- Keep the living docs current **in the same commit as the work**:
  `docs/REFACTOR_BACKLOG.md` (refactor) and `docs/PRODUCT_ROADMAP.md` (features/fixes) —
  tick items, append to the "done" tables, and add any newly-found issue immediately so
  it isn't lost.
- Persist durable findings, decisions, research, and gotchas to **`docs/knowledge/`**
  (see its README). Session-scoped notes go in the harness Task list; anything worth
  keeping across sessions goes in `docs/knowledge/` or the living docs.
- Record answered decisions (e.g. the invoice-cancel behavior) to memory and to the
  relevant doc's decisions register.

## Autonomous operation ("god mode")
This project runs unattended. `.claude/settings.json` sets `bypassPermissions`, so tool
actions are auto-approved and **you must not stop to ask**. Concretely:
- **Never call `AskUserQuestion` and never wait on the user during a run.** Assume no one
  is watching.
- When you hit a question, product decision, ambiguity, or a blocker you cannot safely
  resolve: append a structured entry to **`docs/REVIEW_QUEUE.md`** (format in its header),
  then either (a) proceed with the most sensible **reversible** default and note in the
  entry that you did, or (b) if there is no safe default, skip that item and move to the
  next actionable one. Never let one blocked item stall the whole run.
- Always keep a next actionable item in flight. When you genuinely run out of safe work,
  write a short summary of what you did + what's queued for review, then stop.
- **Guardrails that hold even in god mode** — do NOT work around these:
  - Never commit to `main`, push to `main`, or open/merge a PR without an explicit ask.
  - Never force-push, rewrite shared history, or delete branches/worktrees you didn't create.
  - `git push --force` and filesystem-wipe commands are hard-denied in settings. If you
    think you need one, that's a signal to log it to `docs/REVIEW_QUEUE.md` — not to find
    a workaround.
  - Don't send anything to an external service (email, deploys, third-party APIs, publishing)
    without an explicit ask. Log the intent to the review queue instead.
  - Destructive or irreversible actions on data you didn't create → log, don't do.