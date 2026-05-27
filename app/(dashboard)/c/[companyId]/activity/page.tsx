import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Settings,
  LogOut,
  UserPlus,
  Lock,
  UserCog,
  AlertCircle,
  UserMinus,
  Mail,
  CheckCircle,
  FileText,
  FilePen,
  FileCheck,
  FileX,
  FileMinus2,
  FilePlus2,
  Inbox,
  Archive,
  ArchiveRestore,
  Handshake,
  Package,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@/lib/db/schema';
import { verifyCompanyAccess, getActivityLogs } from '@/lib/db/queries';
import { requireUserOrRedirect } from '@/lib/auth/guards';
import {
  ACTIVITY_LABELS,
  isActivityType,
} from '@/lib/activity-labels';
import { relativeTime } from '@/lib/format';
import { PageShell } from '@/components/page-shell';

const iconMap: Record<ActivityType, LucideIcon> = {
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
  [ActivityType.CREATE_CREDIT_NOTE]: FileMinus2,
  [ActivityType.CREATE_DEBIT_NOTE]: FilePlus2,
  [ActivityType.UPLOAD_RECEIVED_INVOICE]: Inbox,
  [ActivityType.UPDATE_RECEIVED_INVOICE]: FilePen,
  [ActivityType.CONFIRM_RECEIVED_INVOICE]: FileCheck,
  [ActivityType.DISCARD_RECEIVED_INVOICE]: FileX,
  [ActivityType.ARCHIVE_RECEIVED_INVOICE]: Archive,
  [ActivityType.UNARCHIVE_RECEIVED_INVOICE]: ArchiveRestore,
};


export default async function ActivityPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: companyIdStr } = await params;
  const companyId = Number(companyIdStr);

  const user = await requireUserOrRedirect();

  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) redirect('/dashboard');

  const logs = await getActivityLogs(companyId, { limit: 50 });

  return (
    <PageShell>
      <h1 className="text-lg lg:text-2xl font-medium text-gray-900 mb-6">
        Activity Log
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ul className="space-y-4">
              {logs.map((log) => {
                const action = isActivityType(log.action) ? log.action : null;
                const Icon = action ? iconMap[action] : Settings;
                const formattedAction = action ? ACTIVITY_LABELS[action] : log.action;

                return (
                  <li key={log.id} className="flex items-center space-x-4">
                    <div className="bg-primary/10 rounded-full p-2">
                      <Icon className="w-5 h-5 text-primary/90" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-gray-600">
                          {log.userName || 'Unknown'}
                        </span>{' '}
                        {formattedAction}
                        {log.ipAddress && (
                          <span className="text-gray-400">
                            {' '}
                            from {log.ipAddress}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {relativeTime(new Date(log.timestamp))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <AlertCircle className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No activity yet
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                When actions are performed in this company, they&apos;ll
                appear here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
