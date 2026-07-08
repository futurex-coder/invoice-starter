import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, AlertCircle } from 'lucide-react';
import { verifyCompanyAccess, getActivityLogs } from '@/lib/db/queries';
import { requireUserOrRedirect } from '@/lib/auth/guards';
import {
  ACTIVITY_LABELS,
  ACTIVITY_ICONS,
  isActivityType,
} from '@/lib/activity-labels';
import { relativeTime } from '@/lib/format';
import { PageShell } from '@/components/page-shell';

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
        Дневник на активността
      </h1>
      <Card>
        <CardHeader>
          <CardTitle>Скорошна активност</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <ul className="space-y-4">
              {logs.map((log) => {
                const action = isActivityType(log.action) ? log.action : null;
                const Icon = action ? ACTIVITY_ICONS[action] : Settings;
                const formattedAction = action ? ACTIVITY_LABELS[action] : log.action;

                return (
                  <li key={log.id} className="flex items-center space-x-4">
                    <div className="bg-primary/10 rounded-full p-2">
                      <Icon className="w-5 h-5 text-primary/90" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="text-gray-600">
                          {log.userName || 'Неизвестен'}
                        </span>{' '}
                        {formattedAction}
                        {log.ipAddress && (
                          <span className="text-gray-400">
                            {' '}
                            от {log.ipAddress}
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
                Все още няма активност
              </h3>
              <p className="text-sm text-gray-500 max-w-sm">
                Когато в тази фирма се извършват действия, те ще се показват
                тук.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
