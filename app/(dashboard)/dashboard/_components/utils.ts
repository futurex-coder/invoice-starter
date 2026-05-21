import { ActivityType } from '@/lib/db/schema';

export const ACTIVITY_LABELS: Record<string, string> = {
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

export function formatCurrency(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function relativeTime(date: Date | null): string {
  if (!date) return '';
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}
