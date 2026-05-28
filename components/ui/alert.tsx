import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'relative rounded-md border p-3 text-sm flex items-start gap-3',
  {
    variants: {
      variant: {
        info: 'border-blue-200 bg-blue-50 text-blue-800 [&>svg]:text-blue-600',
        success:
          'border-green-200 bg-green-50 text-green-700 [&>svg]:text-green-600',
        warning:
          'border-amber-200 bg-amber-50 text-amber-800 [&>svg]:text-amber-600',
        error: 'border-red-200 bg-red-50 text-red-700 [&>svg]:text-red-600',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  }
);

export type AlertVariant = NonNullable<
  VariantProps<typeof alertVariants>['variant']
>;

const DEFAULT_ICON: Record<AlertVariant, LucideIcon> = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
};

interface AlertProps
  extends React.ComponentProps<'div'>,
    VariantProps<typeof alertVariants> {
  /** Override the default variant icon. Pass `null` to hide entirely. */
  icon?: LucideIcon | null;
}

/**
 * Inline notification banner. Use at the top of a page or section to
 * surface success/warning/error/info messages.
 *
 * For destructive-action confirmation prompts use {@link ConfirmDialog}
 * instead; for ephemeral feedback use the toast primitive.
 *
 * @example
 *   <Alert variant="success">Profile saved.</Alert>
 *
 *   <Alert variant="warning">
 *     <AlertTitle>2 invoices awaiting review</AlertTitle>
 *     <AlertDescription>
 *       Confirm them to keep your books in sync.
 *     </AlertDescription>
 *   </Alert>
 */
export function Alert({
  variant,
  icon,
  className,
  children,
  ...props
}: AlertProps) {
  const resolvedVariant: AlertVariant = variant ?? 'info';
  const ResolvedIcon =
    icon === undefined ? DEFAULT_ICON[resolvedVariant] : icon;

  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    >
      {ResolvedIcon && (
        <ResolvedIcon
          className="h-4 w-4 mt-0.5 shrink-0"
          aria-hidden="true"
        />
      )}
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function AlertTitle({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('font-medium leading-tight', className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('text-sm opacity-90 [&_p]:leading-relaxed', className)}
      {...props}
    />
  );
}

// Re-export the convenience icon set for callers that want to override
// the default icon explicitly.
export { AlertCircle, CheckCircle2, Info, TriangleAlert, XCircle };
