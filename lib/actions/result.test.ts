import { describe, it, expect } from 'vitest';
import { z, ZodError } from 'zod';
import {
  ok,
  fail,
  failWith,
  action,
  zodToValidationIssues,
  type ActionResult,
} from './result';

describe('ok / fail / failWith', () => {
  it('ok() wraps the value as { data }', () => {
    expect(ok(42)).toEqual({ data: 42 });
    expect(ok(null)).toEqual({ data: null });
    expect(ok({ foo: 'bar' })).toEqual({ data: { foo: 'bar' } });
  });

  it('fail() returns { error }', () => {
    expect(fail('boom')).toEqual({ error: 'boom' });
  });

  it('failWith() defaults the error message to "Validation failed"', () => {
    const issues = [{ code: 'too_small', field: 'eik', message: 'too short' }];
    expect(failWith(issues)).toEqual({
      error: 'Validation failed',
      validationErrors: issues,
    });
  });

  it('failWith() accepts a custom error message', () => {
    const issues = [{ code: 'too_small', field: 'eik', message: 'too short' }];
    expect(failWith(issues, 'Custom')).toEqual({
      error: 'Custom',
      validationErrors: issues,
    });
  });
});

describe('zodToValidationIssues', () => {
  it('flattens nested Zod errors into ValidationIssue[]', () => {
    const schema = z.object({
      eik: z.string().min(9),
      contact: z.object({
        email: z.string().email(),
      }),
    });
    const result = schema.safeParse({ eik: '123', contact: { email: 'nope' } });
    if (result.success) throw new Error('expected parse failure');

    const issues = zodToValidationIssues(result.error);
    expect(issues).toHaveLength(2);

    const byField = Object.fromEntries(issues.map((i) => [i.field, i]));
    expect(byField['eik']).toBeDefined();
    expect(byField['contact.email']).toBeDefined();
    expect(byField['eik'].code).toBeTruthy();
    expect(byField['eik'].message).toBeTruthy();
  });

  it('reports root-level errors as field "(root)"', () => {
    const schema = z.string();
    const result = schema.safeParse(42);
    if (result.success) throw new Error('expected parse failure');

    const issues = zodToValidationIssues(result.error);
    expect(issues[0].field).toBe('(root)');
  });

  it('returns an empty array for an empty ZodError', () => {
    // Construct an empty ZodError directly — defensive coverage for the
    // map() path when issues.length === 0.
    const err = new ZodError([]);
    expect(zodToValidationIssues(err)).toEqual([]);
  });
});

describe('action() wrapper', () => {
  it('returns { data } on success', async () => {
    const r = await action(async () => 42);
    expect(r).toEqual({ data: 42 });
  });

  it('returns { data: null } when the body returns null', async () => {
    const r = await action(async () => null);
    expect(r).toEqual({ data: null });
  });

  it('converts Error throws to { error: e.message }', async () => {
    const r = await action(async () => {
      throw new Error('boom');
    });
    expect(r).toEqual({ error: 'boom' });
  });

  it('converts Error subclasses to { error: e.message }', async () => {
    class CustomError extends Error {
      constructor() {
        super('custom message');
        this.name = 'CustomError';
      }
    }
    const r = await action(async () => {
      throw new CustomError();
    });
    expect(r).toEqual({ error: 'custom message' });
  });

  it('converts ZodError throws to { error, validationErrors }', async () => {
    const schema = z.object({ x: z.number() });
    const r = await action(async () => {
      schema.parse({ x: 'not a number' });
      return null;
    });
    expect(r.error).toBe('Validation failed');
    expect(r.validationErrors).toBeDefined();
    expect(r.validationErrors).toHaveLength(1);
    expect(r.validationErrors?.[0].field).toBe('x');
  });

  it('handles non-Error throws as { error: "Unexpected error" }', async () => {
    const r = await action(async () => {
      throw 'string-throw';
    });
    expect(r).toEqual({ error: 'Unexpected error' });
  });

  it('preserves the returned type T at the call site', async () => {
    type Foo = { id: number; name: string };
    const r: ActionResult<Foo> = await action<Foo>(async () => ({
      id: 1,
      name: 'alice',
    }));
    expect(r.data?.id).toBe(1);
    expect(r.data?.name).toBe('alice');
  });
});
