'use client';

import * as React from 'react';
import { Slot as SlotPrimitive } from 'radix-ui';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { ValidationIssue } from '@/lib/actions/result';

interface FormFieldContextValue {
  id: string;
  errorId: string | undefined;
  invalid: boolean;
}

const FormFieldContext = React.createContext<FormFieldContextValue | null>(
  null
);

/**
 * Hook for low-level field-aware inputs. Returns the auto-generated id plus
 * the `aria-invalid` / `aria-describedby` values that should be applied to
 * the input element. Returns `null` if not inside a {@link FormField}.
 */
export function useFormField(): FormFieldContextValue | null {
  return React.useContext(FormFieldContext);
}

interface FormFieldProps {
  /**
   * Dot-joined field path matching the Zod schema. Used to filter
   * `validationErrors` and to anchor the rendered error message.
   */
  name: string;
  /** Optional visible label rendered above the input. */
  label?: React.ReactNode;
  /** Optional hint shown beneath the input when the field has no error. */
  hint?: React.ReactNode;
  /** If true, appends a star to the label. Purely visual. */
  required?: boolean;
  /**
   * Full validation issue list from an {@link ActionResult}. The field
   * filters down to its own issues by `name`.
   */
  errors?: ValidationIssue[] | null;
  /** Extra classes on the wrapper div. */
  className?: string;
  /**
   * The input element. Receives `id`, `aria-invalid`, and `aria-describedby`
   * via a Radix Slot, so the input can be any component that forwards
   * standard `<input>` props.
   */
  children: React.ReactElement;
}

/**
 * Wraps a single form input with a label, accessibility wiring, and inline
 * error rendering driven by an {@link ActionResult.validationErrors} array.
 *
 * The child receives `id`, `aria-invalid`, and `aria-describedby` via
 * a Radix Slot — pass any input-like component that forwards standard props.
 *
 * @example
 *   <FormField name="legalName" label="Legal name" required errors={validationErrors}>
 *     <Input value={form.legalName} onChange={...} placeholder="..." />
 *   </FormField>
 */
export function FormField({
  name,
  label,
  hint,
  required,
  errors,
  className,
  children,
}: FormFieldProps) {
  const generatedId = React.useId();
  const id = generatedId;
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const fieldErrors = React.useMemo(
    () => (errors ?? []).filter((e) => e.field === name),
    [errors, name]
  );
  const invalid = fieldErrors.length > 0;
  const messages = fieldErrors.map((e) => e.message);

  const describedBy = invalid ? errorId : hint ? hintId : undefined;

  return (
    <FormFieldContext.Provider
      value={{ id, errorId: invalid ? errorId : undefined, invalid }}
    >
      <div className={cn('space-y-1', className)}>
        {label !== undefined && (
          <Label htmlFor={id} className={invalid ? 'text-red-700' : undefined}>
            {label}
            {required ? ' *' : null}
          </Label>
        )}
        <SlotPrimitive.Slot
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        >
          {children}
        </SlotPrimitive.Slot>
        {invalid ? (
          <p id={errorId} role="alert" className="text-xs text-red-600">
            {messages.join('. ')}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
    </FormFieldContext.Provider>
  );
}

/**
 * Convenience selector that returns the first error message for a given
 * field, or `undefined`. Useful when an input needs custom rendering and
 * can't be wrapped in a {@link FormField}.
 */
export function getFieldError(
  errors: ValidationIssue[] | null | undefined,
  field: string
): string | undefined {
  return errors?.find((e) => e.field === field)?.message;
}
