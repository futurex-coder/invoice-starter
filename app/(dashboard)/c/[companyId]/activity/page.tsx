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
  type LucideIcon,
} from 'lucide-react';
import { ActivityType } from '@/lib/db/schema';
import { getUser, verifyCompanyAccess, getActivityLogs } from '@/lib/db/queries';

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
  [ActivityType.CREATE_INVOICE]: FileText,
  [ActivityType.UPDATE_INVOICE]: FilePen,
  [ActivityType.FINALIZE_INVOICE]: FileCheck,
  [ActivityType.CANCEL_INVOICE]: FileX,
  [ActivityType.CREATE_CREDIT_NOTE]: FileMinus2,
  [ActivityType.CREATE_DEBIT_NOTE]: FilePlus2,
};

function getRelativeTime(date: Date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600)
    return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400)
    return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  return date.toLocaleDateString();
}

function formatAction(action: ActivityType): string {
  switch (action) {
    case ActivityType.SIGN_UP:
      return 'Signed up';
    case ActivityType.SIGN_IN:
      return 'Signed in';
    case ActivityType.SIGN_OUT:
      return 'Signed out';
    case ActivityType.UPDATE_PASSWORD:
      return 'Changed password';
    case ActivityType.DELETE_ACCOUNT:
      return 'Deleted account';
    case ActivityType.UPDATE_ACCOUNT:
      return 'Updated account';
    case ActivityType.CREATE_COMPANY:
      return 'Created company';
    case ActivityType.UPDATE_COMPANY:
      return 'Updated company settings';
    case ActivityType.DELETE_COMPANY:
      return 'Deleted company';
    case ActivityType.RESTORE_COMPANY:
      return 'Restored company';
    case ActivityType.TRANSFER_OWNERSHIP:
      return 'Transferred ownership';
    case ActivityType.REMOVE_MEMBER:
      return 'Removed a member';
    case ActivityType.INVITE_MEMBER:
      return 'Invited a member';
    case ActivityType.ACCEPT_INVITATION:
      return 'Accepted an invitation';
    case ActivityType.CREATE_INVOICE:
      return 'Created an invoice';
    case ActivityType.UPDATE_INVOICE:
      return 'Updated an invoice';
    case ActivityType.FINALIZE_INVOICE:
      return 'Finalized an invoice';
    case ActivityType.CANCEL_INVOICE:
      return 'Cancelled an invoice';
    case ActivityType.CREATE_CREDIT_NOTE:
      return 'Created a credit note';
    case ActivityType.CREATE_DEBIT_NOTE:
      return 'Created a debit note';
    default:
      return 'Unknown action';
  }
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId: companyIdStr } = await params;
  const companyId = Number(companyIdStr);

  const user = await getUser();
  if (!user) redirect('/sign-in');

  const membership = await verifyCompanyAccess(user.id, companyId);
  if (!membership) redirect('/dashboard');

  const logs = await getActivityLogs(companyId, { limit: 50 });

  return (
    <section className="flex-1 p-4 lg:p-8">
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
                const Icon = iconMap[log.action as ActivityType] || Settings;
                const formattedAction = formatAction(
                  log.action as ActivityType
                );

                return (
                  <li key={log.id} className="flex items-center space-x-4">
                    <div className="bg-orange-100 rounded-full p-2">
                      <Icon className="w-5 h-5 text-orange-600" />
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
                        {getRelativeTime(new Date(log.timestamp))}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <AlertCircle className="h-12 w-12 text-orange-500 mb-4" />
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
    </section>
  );
}
