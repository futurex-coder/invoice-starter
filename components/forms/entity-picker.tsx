'use client';

import * as React from 'react';
import { Popover as PopoverPrimitive } from 'radix-ui';
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

interface EntityPickerProps<TItem, TKey extends string | number> {
  /** Items to pick from. */
  items: readonly TItem[];
  /** Currently-selected key, or `null` for none. */
  value: TKey | null;
  /** Called with the new key, or `null` if the user picks the manual/none option. */
  onChange: (value: TKey | null) => void;

  /** Return a unique key for an item. */
  getKey: (item: TItem) => TKey;
  /** Display label for an item — shown in the trigger and the dropdown row. */
  getLabel: (item: TItem) => string;
  /** Optional secondary text shown muted under the label. */
  getSecondary?: (item: TItem) => string | undefined;
  /**
   * Text matched against the user's search query. Defaults to
   * `getLabel(item)` if not provided. Use this to make extra fields
   * (EIK, SKU, etc.) searchable.
   */
  getSearchText?: (item: TItem) => string;

  /** Label shown in the trigger when no value is selected. */
  placeholder?: string;
  /** Text shown when the filter returns no matches. */
  emptyMessage?: string;
  /**
   * Label for the "no selection" / "manual entry" option at the top
   * of the list. Selecting it calls `onChange(null)`. Pass `null`
   * to hide the option entirely.
   */
  clearLabel?: string | null;

  /** Disable the trigger. */
  disabled?: boolean;
  /** Extra classes appended to the trigger. */
  className?: string;
  /** Trigger id (for `<Label htmlFor>` association). */
  id?: string;
}

/**
 * Combobox-style entity picker with type-ahead filtering.
 *
 * For small static option lists, prefer the basic `<Select>` primitive —
 * EntityPicker is the right tool when:
 *   - the list is large enough that visual scrolling is awkward, OR
 *   - users want to search by a secondary field (e.g. partner EIK)
 *
 * @example
 *   <EntityPicker
 *     items={partners}
 *     value={selectedPartnerId}
 *     onChange={(v) => setSelectedPartnerId(v)}
 *     getKey={(p) => p.id}
 *     getLabel={(p) => p.name}
 *     getSecondary={(p) => p.eik}
 *     getSearchText={(p) => `${p.name} ${p.eik}`}
 *     clearLabel="— Manual entry —"
 *   />
 */
export function EntityPicker<TItem, TKey extends string | number>({
  items,
  value,
  onChange,
  getKey,
  getLabel,
  getSecondary,
  getSearchText,
  placeholder = 'Изберете…',
  emptyMessage = 'Няма съвпадения.',
  clearLabel = null,
  disabled = false,
  className,
  id,
}: EntityPickerProps<TItem, TKey>) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selected = React.useMemo(
    () => items.find((item) => getKey(item) === value) ?? null,
    [items, value, getKey]
  );

  const filtered = React.useMemo(() => {
    if (!query.trim()) return items;
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      const haystack = (getSearchText ?? getLabel)(item).toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, query, getSearchText, getLabel]);

  const handleSelect = (next: TKey | null) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            !selected && 'text-muted-foreground',
            className
          )}
        >
          <span className="line-clamp-1 text-left">
            {selected ? getLabel(selected) : placeholder}
          </span>
          <ChevronDownIcon className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={cn(
            'relative z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md',
            'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95'
          )}
        >
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Търсене…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto p-1">
            {clearLabel !== null && (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === null}
                  onClick={() => handleSelect(null)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm text-muted-foreground',
                    'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none'
                  )}
                >
                  <span>{clearLabel}</span>
                  {value === null && <CheckIcon className="h-4 w-4" />}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">
                {emptyMessage}
              </li>
            ) : (
              filtered.map((item) => {
                const key = getKey(item);
                const isSelected = key === value;
                const secondary = getSecondary?.(item);
                return (
                  <li key={String(key)}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleSelect(key)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm',
                        'hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none'
                      )}
                    >
                      <span className="flex min-w-0 flex-col items-start">
                        <span className="line-clamp-1">{getLabel(item)}</span>
                        {secondary && (
                          <span className="text-xs text-muted-foreground">
                            {secondary}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <CheckIcon className="h-4 w-4 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
