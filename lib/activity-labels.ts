/**
 * Activity-feed label mapping.
 *
 * Canonical home for `ActivityType` → user-facing label strings used by
 * `<ActivityFeed>` and the dedicated `/activity` page. Previously
 * duplicated in three places with diverging wording — keep edits here so
 * the feed reads consistently everywhere.
 */

import { ActivityType } from '@/lib/db/schema';

const ACTIVITY_TYPE_VALUES: ReadonlySet<string> = new Set(
  Object.values(ActivityType)
);

/**
 * Type guard — narrow a DB-sourced action string into the `ActivityType` enum.
 * Returns `false` for unknown values; callers should fall back gracefully.
 */
export function isActivityType(value: string): value is ActivityType {
  return ACTIVITY_TYPE_VALUES.has(value);
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  [ActivityType.SIGN_UP]: 'Signed up',
  [ActivityType.SIGN_IN]: 'Signed in',
  [ActivityType.SIGN_OUT]: 'Signed out',
  [ActivityType.UPDATE_PASSWORD]: 'Updated password',
  [ActivityType.DELETE_ACCOUNT]: 'Deleted account',
  [ActivityType.UPDATE_ACCOUNT]: 'Updated account',
  [ActivityType.CREATE_COMPANY]: 'Created company',
  [ActivityType.UPDATE_COMPANY]: 'Updated company settings',
  [ActivityType.DELETE_COMPANY]: 'Deleted company',
  [ActivityType.RESTORE_COMPANY]: 'Restored company',
  [ActivityType.TRANSFER_OWNERSHIP]: 'Transferred ownership',
  [ActivityType.INVITE_MEMBER]: 'Invited a member',
  [ActivityType.ACCEPT_INVITATION]: 'Accepted invitation',
  [ActivityType.REMOVE_MEMBER]: 'Removed a member',
  [ActivityType.CREATE_INVOICE]: 'Created an invoice',
  [ActivityType.UPDATE_INVOICE]: 'Updated an invoice',
  [ActivityType.FINALIZE_INVOICE]: 'Finalized an invoice',
  [ActivityType.CANCEL_INVOICE]: 'Cancelled an invoice',
  [ActivityType.CREATE_CREDIT_NOTE]: 'Created a credit note',
  [ActivityType.CREATE_DEBIT_NOTE]: 'Created a debit note',
  [ActivityType.UPLOAD_RECEIVED_INVOICE]: 'Uploaded a received invoice',
  [ActivityType.UPDATE_RECEIVED_INVOICE]: 'Updated a received invoice',
  [ActivityType.CONFIRM_RECEIVED_INVOICE]: 'Confirmed a received invoice',
  [ActivityType.DISCARD_RECEIVED_INVOICE]: 'Discarded a received invoice',
  [ActivityType.ARCHIVE_RECEIVED_INVOICE]: 'Archived a received invoice',
  [ActivityType.UNARCHIVE_RECEIVED_INVOICE]: 'Unarchived a received invoice',
};

/**
 * Look up the label for an action string from the activity log.
 * Returns "Unknown action" for unrecognized values (defensive — log rows
 * are written with current enum values, but older rows may reference
 * actions that no longer exist).
 */
export function formatActivityAction(action: string): string {
  if (!isActivityType(action)) return 'Unknown action';
  return ACTIVITY_LABELS[action];
}
