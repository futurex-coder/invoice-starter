import * as React from 'react';
import { cn } from '@/lib/utils';

const MAX_WIDTH_CLASS = {
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
} as const;

type MaxWidth = keyof typeof MAX_WIDTH_CLASS;

interface PageShellProps {
  children: React.ReactNode;
  /**
   * Constrain the section to a max width. Most list pages want no
   * constraint (full width of the layout column). Form pages often
   * want `3xl` or `4xl` to keep line lengths readable.
   */
  maxWidth?: MaxWidth;
  /** Extra classes appended to the root. */
  className?: string;
}

/**
 * Canonical page wrapper.
 *
 * Use this on every page-level component instead of inline
 * `<section className="flex-1 p-4 lg:p-8">`. Centralizes the
 * page padding + flex-grow contract so layout changes happen
 * in one place.
 */
export function PageShell({
  children,
  maxWidth,
  className,
}: PageShellProps) {
  return (
    <section
      className={cn(
        'flex-1 p-4 lg:p-8',
        maxWidth && MAX_WIDTH_CLASS[maxWidth],
        className
      )}
    >
      {children}
    </section>
  );
}
