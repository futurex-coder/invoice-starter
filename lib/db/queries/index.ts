// ─────────────────────────────────────────────
// QUERIES — BARREL RE-EXPORT
// ─────────────────────────────────────────────
//
// This file is an organizational split of what used to be a single
// `lib/db/queries.ts`. Consumers continue to import from
// `@/lib/db/queries` (TypeScript resolves to this `index.ts`), so this
// is NOT a public-API change — only a per-feature file layout for
// easier navigation.

export * from './auth';
export * from './companies';
export * from './subscriptions';
export * from './activity';
export * from './invoices';
export * from './partners';
export * from './articles';
export * from './dashboard';
