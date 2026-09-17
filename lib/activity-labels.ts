/**
 * Activity-feed presentation mapping — labels + icons.
 *
 * Canonical home for `ActivityType` → user-facing string and icon. Used
 * by `<ActivityFeed>` and the dedicated `/activity` page. Previously
 * duplicated in three places with diverging wording — keep edits here so
 * the feed reads consistently everywhere.
 */

import {
  Archive,
  ArchiveRestore,
  CheckCircle,
  FileCheck,
  FileMinus2,
  FilePen,
  FilePlus2,
  FileText,
  FileX,
  Handshake,
  Inbox,
  Lock,
  LogOut,
  Mail,
  Package,
  Settings,
  Trash2,
  UserCog,
  UserMinus,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
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
  [ActivityType.SIGN_UP]: 'Регистрация',
  [ActivityType.SIGN_IN]: 'Вход',
  [ActivityType.SIGN_OUT]: 'Изход',
  [ActivityType.UPDATE_PASSWORD]: 'Смяна на парола',
  [ActivityType.DELETE_ACCOUNT]: 'Изтрит профил',
  [ActivityType.UPDATE_ACCOUNT]: 'Обновен профил',
  [ActivityType.CREATE_COMPANY]: 'Създадена фирма',
  [ActivityType.UPDATE_COMPANY]: 'Обновени настройки на фирмата',
  [ActivityType.DELETE_COMPANY]: 'Изтрита фирма',
  [ActivityType.RESTORE_COMPANY]: 'Възстановена фирма',
  [ActivityType.TRANSFER_OWNERSHIP]: 'Прехвърлена собственост',
  [ActivityType.INVITE_MEMBER]: 'Поканен потребител',
  [ActivityType.ACCEPT_INVITATION]: 'Приета покана',
  [ActivityType.REMOVE_MEMBER]: 'Премахнат потребител',
  [ActivityType.CREATE_PARTNER]: 'Добавен контрагент',
  [ActivityType.UPDATE_PARTNER]: 'Обновен контрагент',
  [ActivityType.DELETE_PARTNER]: 'Премахнат контрагент',
  [ActivityType.CREATE_ARTICLE]: 'Добавен артикул',
  [ActivityType.UPDATE_ARTICLE]: 'Обновен артикул',
  [ActivityType.DELETE_ARTICLE]: 'Премахнат артикул',
  [ActivityType.CREATE_INVOICE]: 'Създадена фактура',
  [ActivityType.UPDATE_INVOICE]: 'Обновена фактура',
  [ActivityType.FINALIZE_INVOICE]: 'Издадена фактура',
  [ActivityType.CANCEL_INVOICE]: 'Анулирана фактура',
  [ActivityType.UNCANCEL_INVOICE]: 'Възстановена фактура',
  [ActivityType.DELETE_INVOICE]: 'Изтрита фактура',
  [ActivityType.CREATE_CREDIT_NOTE]: 'Създадено кредитно известие',
  [ActivityType.CREATE_DEBIT_NOTE]: 'Създадено дебитно известие',
  [ActivityType.POST_JOURNAL_ENTRY]: 'Осчетоводена контировка',
  [ActivityType.REVERSE_JOURNAL_ENTRY]: 'Сторнирана контировка',
  [ActivityType.UPLOAD_RECEIVED_INVOICE]: 'Качена получена фактура',
  [ActivityType.UPDATE_RECEIVED_INVOICE]: 'Обновена получена фактура',
  [ActivityType.CONFIRM_RECEIVED_INVOICE]: 'Потвърдена получена фактура',
  [ActivityType.DISCARD_RECEIVED_INVOICE]: 'Отхвърлена получена фактура',
  [ActivityType.DELETE_RECEIVED_INVOICE]: 'Изтрита получена фактура',
  [ActivityType.ARCHIVE_RECEIVED_INVOICE]: 'Архивирана получена фактура',
  [ActivityType.UNARCHIVE_RECEIVED_INVOICE]: 'Разархивирана получена фактура',
};

/**
 * Look up the label for an action string from the activity log.
 * Returns "Unknown action" for unrecognized values (defensive — log rows
 * are written with current enum values, but older rows may reference
 * actions that no longer exist).
 */
export function formatActivityAction(action: string): string {
  if (!isActivityType(action)) return 'Неизвестно действие';
  return ACTIVITY_LABELS[action];
}

/**
 * `ActivityType` → Lucide icon component. Several activities deliberately
 * share an icon (e.g. CREATE/UPDATE_PARTNER both use `Handshake`) — the
 * label disambiguates them.
 */
export const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  [ActivityType.SIGN_UP]: UserPlus,
  [ActivityType.SIGN_IN]: UserCog,
  [ActivityType.SIGN_OUT]: LogOut,
  [ActivityType.UPDATE_PASSWORD]: Lock,
  [ActivityType.DELETE_ACCOUNT]: UserMinus,
  [ActivityType.UPDATE_ACCOUNT]: Settings,
  [ActivityType.CREATE_COMPANY]: UserPlus,
  [ActivityType.UPDATE_COMPANY]: Settings,
  [ActivityType.DELETE_COMPANY]: UserMinus,
  [ActivityType.RESTORE_COMPANY]: CheckCircle,
  [ActivityType.TRANSFER_OWNERSHIP]: UserCog,
  [ActivityType.REMOVE_MEMBER]: UserMinus,
  [ActivityType.INVITE_MEMBER]: Mail,
  [ActivityType.ACCEPT_INVITATION]: CheckCircle,
  [ActivityType.CREATE_PARTNER]: Handshake,
  [ActivityType.UPDATE_PARTNER]: Handshake,
  [ActivityType.DELETE_PARTNER]: Trash2,
  [ActivityType.CREATE_ARTICLE]: Package,
  [ActivityType.UPDATE_ARTICLE]: Package,
  [ActivityType.DELETE_ARTICLE]: Trash2,
  [ActivityType.CREATE_INVOICE]: FileText,
  [ActivityType.UPDATE_INVOICE]: FilePen,
  [ActivityType.FINALIZE_INVOICE]: FileCheck,
  [ActivityType.CANCEL_INVOICE]: FileX,
  [ActivityType.UNCANCEL_INVOICE]: ArchiveRestore,
  [ActivityType.DELETE_INVOICE]: Trash2,
  [ActivityType.CREATE_CREDIT_NOTE]: FileMinus2,
  [ActivityType.CREATE_DEBIT_NOTE]: FilePlus2,
  [ActivityType.POST_JOURNAL_ENTRY]: FileCheck,
  [ActivityType.REVERSE_JOURNAL_ENTRY]: FileMinus2,
  [ActivityType.UPLOAD_RECEIVED_INVOICE]: Inbox,
  [ActivityType.UPDATE_RECEIVED_INVOICE]: FilePen,
  [ActivityType.CONFIRM_RECEIVED_INVOICE]: FileCheck,
  [ActivityType.DISCARD_RECEIVED_INVOICE]: FileX,
  [ActivityType.DELETE_RECEIVED_INVOICE]: Trash2,
  [ActivityType.ARCHIVE_RECEIVED_INVOICE]: Archive,
  [ActivityType.UNARCHIVE_RECEIVED_INVOICE]: ArchiveRestore,
};
