import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { FormField, getFieldError } from './form-field';
import { Input } from '@/components/ui/input';
import type { ValidationIssue } from '@/lib/actions/result';

afterEach(cleanup);

const issue = (field: string, message: string): ValidationIssue => ({
  code: 'custom',
  field,
  message,
});

describe('FormField', () => {
  it('renders a Label that points to the input id', () => {
    render(
      <FormField name="name" label="Name">
        <Input defaultValue="" />
      </FormField>
    );
    const label = screen.getByText('Name');
    const forAttr = label.getAttribute('for');
    expect(forAttr).toBeTruthy();
    const input = document.querySelector(`#${forAttr}`);
    expect(input).not.toBeNull();
  });

  it('does not mark the input as invalid when there are no matching errors', () => {
    render(
      <FormField name="name" label="Name" errors={[issue('other', 'wrong')]}>
        <Input defaultValue="" />
      </FormField>
    );
    expect(screen.getByLabelText('Name')).not.toHaveAttribute('aria-invalid');
  });

  it('renders aria-invalid + the message when the field has an error', () => {
    render(
      <FormField
        name="legalName"
        label="Legal name"
        errors={[issue('legalName', 'Required')]}
      >
        <Input defaultValue="" />
      </FormField>
    );
    const input = screen.getByLabelText('Legal name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const error = screen.getByRole('alert');
    expect(error).toHaveTextContent('Required');
    expect(input.getAttribute('aria-describedby')).toBe(error.id);
  });

  it('joins multiple messages for the same field', () => {
    render(
      <FormField
        name="eik"
        label="EIK"
        errors={[issue('eik', 'Must be 9-10 digits'), issue('eik', 'Required')]}
      >
        <Input defaultValue="" />
      </FormField>
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Must be 9-10 digits. Required'
    );
  });

  it('renders the hint when there is no error', () => {
    render(
      <FormField name="vatNumber" label="VAT" hint="Format: BG…">
        <Input defaultValue="" />
      </FormField>
    );
    expect(screen.getByText('Format: BG…')).toBeInTheDocument();
  });

  it('replaces the hint with the error when both are present', () => {
    render(
      <FormField
        name="vatNumber"
        label="VAT"
        hint="Format: BG…"
        errors={[issue('vatNumber', 'Invalid format')]}
      >
        <Input defaultValue="" />
      </FormField>
    );
    expect(screen.queryByText('Format: BG…')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid format');
  });

  it('appends a star to the label when required', () => {
    render(
      <FormField name="name" label="Name" required>
        <Input defaultValue="" />
      </FormField>
    );
    expect(screen.getByText(/Name\s*\*/)).toBeInTheDocument();
  });
});

describe('getFieldError', () => {
  it('returns the first matching message', () => {
    const errors = [issue('a', 'a-1'), issue('a', 'a-2'), issue('b', 'b-1')];
    expect(getFieldError(errors, 'a')).toBe('a-1');
    expect(getFieldError(errors, 'b')).toBe('b-1');
  });

  it('returns undefined for no match', () => {
    expect(getFieldError([issue('a', 'a-1')], 'b')).toBeUndefined();
    expect(getFieldError(null, 'a')).toBeUndefined();
    expect(getFieldError(undefined, 'a')).toBeUndefined();
  });
});
