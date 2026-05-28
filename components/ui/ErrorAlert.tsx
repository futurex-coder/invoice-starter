/**
 * Compatibility shim — the original simple ErrorAlert API.
 *
 * Many callers use `<ErrorAlert message={error} />` where `error` may
 * be null. This thin wrapper keeps that ergonomic for the common
 * "show the action error or render nothing" pattern.
 *
 * For new code, prefer `<Alert variant="error">...</Alert>` directly
 * — it supports rich content (title + description), icons, and the
 * full variant family (info / success / warning / error).
 */
import { Alert } from './alert';

interface Props {
  message: string | null;
  className?: string;
}

export function ErrorAlert({ message, className }: Props) {
  if (!message) return null;
  return (
    <Alert variant="error" className={className}>
      {message}
    </Alert>
  );
}
