/**
 * Helpers for working with `useParams()` route parameters in Next.js
 * client components, where each value is typed as `string | string[]
 * | undefined`.
 */

export type RouteParams = Record<string, string | string[] | undefined>;

/**
 * Extract a route parameter that the route shape guarantees is a single
 * string (e.g. `[companyId]`). Throws synchronously if the param is
 * missing or appears as an array — both of those would indicate the
 * caller is on the wrong route, which is a developer error worth
 * surfacing rather than masking with a cast.
 */
export function requireStringParam(
  params: RouteParams,
  key: string
): string {
  const value = params[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(
      `Route parameter "${key}" is missing or not a string. ` +
        `Got: ${JSON.stringify(value)}`
    );
  }
  return value;
}
