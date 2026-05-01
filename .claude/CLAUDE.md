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