import { Activity } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ACTIVITY_LABELS, relativeTime } from './utils';

interface ActivityLogRow {
  id: number;
  action: string;
  timestamp: Date;
  userName: string | null;
}

interface Props {
  activity: ActivityLogRow[];
}

export function ActivityFeed({ activity }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Last 5 actions in this company</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 text-gray-300" />
            <p className="text-sm">No activity yet</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100">
                  <Activity className="h-3.5 w-3.5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p>
                    <span className="font-medium">{a.userName || 'Unknown'}</span>{' '}
                    <span className="text-muted-foreground">
                      {ACTIVITY_LABELS[a.action] ?? a.action}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relativeTime(a.timestamp)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
