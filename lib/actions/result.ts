/**
 * Canonical server-action result type and helpers.
 *
 * See ADR-0001 (docs/adr/0001-unified-action-and-auth-contract.md).
 *
 * All SWR-called server actions return {@link ActionResult}. Use {@link action}
 * to wrap an async body — it converts thrown errors (including ZodError) into
 * the canonical failure shape, eliminating per-action try/catch.
 */

import { ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidationIssue = {
  /** Zod issue code (or a custom code from the action). */
  code: string;
  /** Dot-joined field path; "(root)" for top-level errors. */
  field: string;
  /** Human-readable message — safe to render in the UI. */
  message: string;
};

export type ActionResult<T = void> = {
  /** Present on success. Absent on failure. */
  data?: T;
  /** Present on failure. A short human-readable summary. */
  error?: string;
  /** Present when failure is a validation error with per-field details. */
  validationErrors?: ValidationIssue[];
};

// ---------------------------------------------------------------------------
// Constructors — prefer these over building the object literal at call sites.
// ---------------------------------------------------------------------------

/** Successful result. */
export function ok<T>(data: T): ActionResult<T> {
  return { data };
}

/** Failure with a single error message and no validation details. */
export function fail(error: string): ActionResult<never> {
  return { error };
}

/**
 * Failure with per-field validation issues.
 * Defaults the top-level `error` to `"Validation failed"` if no message is given.
 */
export function failWith(
  validationErrors: ValidationIssue[],
  error: string = 'Validation failed'
): ActionResult<never> {
  return { error, validationErrors };
}

// ---------------------------------------------------------------------------
// Zod adapter
// ---------------------------------------------------------------------------

/**
 * Flatten a {@link ZodError} into the canonical {@link ValidationIssue}[] shape.
 * Top-level issues (empty `path`) are reported with `field: "(root)"`.
 */
export function zodToValidationIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    code: issue.code,
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

/**
 * Wrap a server-action body. Any throw inside `fn` is caught and converted:
 *   - `ZodError`            → `{ error: 'Validation failed', validationErrors: [...] }`
 *   - `Error` (any subclass) → `{ error: error.message }`
 *   - anything else          → `{ error: 'Unexpected error' }`
 *
 * The success path returns `{ data }`. Use with {@link requireUser} /
 * {@link requireCompanyAccess} from `@/lib/auth/guards`:
 *
 * @example
 *   export async function getCompanyProfile() {
 *     return action(async () => {
 *       const { companyId } = await requireCompanyAccess();
 *       const [row] = await db.select().from(companies).where(eq(companies.id, companyId));
 *       return row ? parseCompanyRow(row) : null;
 *     });
 *   }
 */
export async function action<T>(
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { data };
  } catch (e) {
    if (e instanceof ZodError) {
      return failWith(zodToValidationIssues(e));
    }
    if (e instanceof Error) {
      return { error: e.message };
    }
    return { error: 'Unexpected error' };
  }
}
