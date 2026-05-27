'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useActionSWR } from './use-action-swr';
import type { ActionResult } from '@/lib/actions/result';

const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_SEARCH_DEBOUNCE_MS = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Filters must be a string-keyed record. Use string-typed values everywhere
 * (the URL is the source of truth and only stores strings); cast on consume
 * if the underlying domain is enum-shaped.
 */
export type ListPageFilters = Record<string, string>;

export interface UseListPageStateOptions<
  TFilters extends ListPageFilters,
  TResult,
> {
  /**
   * SWR cache-key prefix. Combined with current filters + page for uniqueness.
   * Pass a stable string like `'partners'`, `'articles'`, etc.
   */
  swrKey: string;
  /** Default filter values. Filters that match these are omitted from the URL. */
  defaults: TFilters;
  /** Page size. Defaults to 20. */
  pageSize?: number;
  /** Debounce ms for the `search` filter (if present). Defaults to 300. */
  searchDebounceMs?: number;
  /** Sync filter + page state to the URL. Defaults to `true`. */
  urlSync?: boolean;
  /**
   * Action to call with the current filters + page + pageSize.
   * Should return an ActionResult — useActionSWR handles the throw conversion.
   */
  action: (
    params: TFilters & { page: number; pageSize: number }
  ) => Promise<ActionResult<TResult>>;
}

export interface ListPageState<
  TFilters extends ListPageFilters,
  TResult,
> {
  /** Currently-applied (debounced) filter values. */
  filters: TFilters;
  /**
   * Update one filter. Resets page to 1. Persists to URL unless `urlSync`
   * is false. For free-text `search`, prefer `setSearchInput` which
   * applies debounce.
   */
  setFilter<K extends keyof TFilters>(key: K, value: TFilters[K]): void;
  /** Reset all filters to defaults. Resets page to 1. */
  resetFilters(): void;

  /** Current page (1-based). */
  page: number;
  setPage(page: number): void;
  pageSize: number;

  /**
   * Uncommitted search input value — bound to the SearchBar input.
   * Mirrors `filters.search` after debounce.
   */
  searchInput: string;
  setSearchInput(value: string): void;
  /** Cancel any pending debounce and apply the current `searchInput` now. */
  commitSearch(): void;

  /** Whether SWR is currently loading. */
  loading: boolean;
  /** Loaded result (undefined while loading or on error). */
  result: TResult | undefined;
  /** Combined error (fetch error OR latest mutation error). */
  error: string | null;
  /** Force a refetch. */
  refetch(): Promise<TResult | undefined>;

  /** Mutation error — set by `runMutation` or directly. */
  actionError: string | null;
  setActionError(err: string | null): void;
  /**
   * Run a mutation. Sets `actionError` on failure (and re-throws so callers
   * inside ConfirmDialog can keep the dialog open). Refetches on success.
   */
  runMutation<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>>;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Read filter + page state from URL searchParams, falling back to defaults.
 */
function readStateFromUrl<TFilters extends ListPageFilters>(
  searchParams: URLSearchParams,
  defaults: TFilters
): { filters: TFilters; page: number } {
  const filters = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const v = searchParams.get(key);
    if (v !== null) {
      (filters as ListPageFilters)[key] = v;
    }
  }
  const pageRaw = searchParams.get('page');
  const page = pageRaw ? Math.max(1, Number(pageRaw) || 1) : 1;
  return { filters, page };
}

/**
 * Write filter + page state to URL searchParams. Filters at their default
 * value are omitted to keep URLs clean.
 */
function writeStateToUrl<TFilters extends ListPageFilters>(
  filters: TFilters,
  page: number,
  defaults: TFilters
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && value !== defaults[key]) {
      params.set(key, value);
    }
  }
  if (page > 1) params.set('page', String(page));
  return params.toString();
}

/**
 * Composite list-page hook. Owns filter + pagination + search-debounce +
 * data fetch + mutation-error state for a CRUD list page. Optionally syncs
 * state to URL searchParams so the filtered view is bookmarkable and
 * survives browser back/forward.
 *
 * @example
 *   const list = useListPageState({
 *     swrKey: 'partners',
 *     defaults: { search: '' },
 *     action: ({ search, page, pageSize }) =>
 *       listPartners({ search: search || undefined, page, pageSize }),
 *   });
 *   // list.filters, list.searchInput, list.setSearchInput, list.result,
 *   // list.loading, list.error, list.refetch, list.runMutation, etc.
 */
export function useListPageState<
  TFilters extends ListPageFilters,
  TResult,
>(
  options: UseListPageStateOptions<TFilters, TResult>
): ListPageState<TFilters, TResult> {
  const {
    swrKey,
    defaults,
    pageSize = DEFAULT_PAGE_SIZE,
    searchDebounceMs = DEFAULT_SEARCH_DEBOUNCE_MS,
    urlSync = true,
    action,
  } = options;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // -----------------------------------------------------------------------
  // Filter + page state
  // -----------------------------------------------------------------------

  const urlState = useMemo(
    () =>
      urlSync
        ? readStateFromUrl(new URLSearchParams(searchParams.toString()), defaults)
        : { filters: defaults, page: 1 },
    // We only want this to recompute when the URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams, urlSync]
  );

  // Local state mirrors the URL (when urlSync) or just lives alone.
  const [filters, setFiltersState] = useState<TFilters>(urlState.filters);
  const [page, setPageState] = useState<number>(urlState.page);

  // If urlSync, keep local state in sync when the URL changes externally
  // (e.g. browser back/forward, or another component changes the URL).
  // `set-state-in-effect` is intentional here — we're mirroring an external
  // source (the URL) into local state.
  useEffect(() => {
    if (!urlSync) return;
    const { filters: urlFilters, page: urlPage } = readStateFromUrl(
      new URLSearchParams(searchParams.toString()),
      defaults
    );
    /* eslint-disable react-hooks/set-state-in-effect */
    setFiltersState(urlFilters);
    setPageState(urlPage);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, urlSync]);

  const pushUrl = useCallback(
    (nextFilters: TFilters, nextPage: number) => {
      if (!urlSync) return;
      const qs = writeStateToUrl(nextFilters, nextPage, defaults);
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [urlSync, router, pathname, defaults]
  );

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      const next = { ...filters, [key]: value };
      setFiltersState(next);
      setPageState(1);
      pushUrl(next, 1);
    },
    [filters, pushUrl]
  );

  const resetFilters = useCallback(() => {
    setFiltersState(defaults);
    setPageState(1);
    pushUrl(defaults, 1);
  }, [defaults, pushUrl]);

  const setPage = useCallback(
    (next: number) => {
      setPageState(next);
      pushUrl(filters, next);
    },
    [filters, pushUrl]
  );

  // -----------------------------------------------------------------------
  // Search input + debounce
  // -----------------------------------------------------------------------

  const [searchInput, setSearchInputState] = useState<string>(
    () => filters.search ?? ''
  );
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep searchInput in sync if filters.search changes externally (URL).
  // `set-state-in-effect` is intentional — mirroring an external source.
  useEffect(() => {
    if (filters.search !== undefined && filters.search !== searchInput) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchInputState(filters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  const applySearch = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const next = { ...filters, search: trimmed } as TFilters;
      setFiltersState(next);
      setPageState(1);
      pushUrl(next, 1);
    },
    [filters, pushUrl]
  );

  const setSearchInput = useCallback(
    (value: string) => {
      setSearchInputState(value);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        applySearch(value);
      }, searchDebounceMs);
    },
    [applySearch, searchDebounceMs]
  );

  const commitSearch = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    applySearch(searchInput);
  }, [applySearch, searchInput]);

  // Clean up any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // -----------------------------------------------------------------------
  // Data fetch
  // -----------------------------------------------------------------------

  const swrCacheKey = useMemo(
    () => [swrKey, JSON.stringify(filters), page] as const,
    [swrKey, filters, page]
  );

  const {
    data: result,
    isLoading: loading,
    error: fetchError,
    mutate,
  } = useActionSWR<TResult>(swrCacheKey, () =>
    action({ ...filters, page, pageSize })
  );

  const refetch = useCallback(async () => {
    return mutate();
  }, [mutate]);

  // -----------------------------------------------------------------------
  // Mutation error + runMutation helper
  // -----------------------------------------------------------------------

  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (fetchError ? fetchError.message : null);

  const runMutation = useCallback(
    async <T,>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> => {
      setActionError(null);
      const res = await fn();
      if (res.error) {
        setActionError(res.error);
        // Re-throw so callers inside <ConfirmDialog onConfirm={...}> keep
        // the dialog open on failure.
        throw new Error(res.error);
      }
      await mutate();
      return res;
    },
    [mutate]
  );

  return {
    filters,
    setFilter,
    resetFilters,
    page,
    setPage,
    pageSize,
    searchInput,
    setSearchInput,
    commitSearch,
    loading,
    result,
    error,
    refetch,
    actionError,
    setActionError,
    runMutation,
  };
}
