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
  (baseline 201), and `npm run build` when routes/config/deps change — **commit it
  atomically** with a descriptive message. One logical change per commit; keep history
  bisectable. End commit messages with the `Co-Authored-By` trailer.
- **Committing is local.** Do NOT push or open a PR unless explicitly asked.
- If a change is bigger than expected or needs a product decision, stop and ask
  (`AskUserQuestion`) rather than guessing.

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