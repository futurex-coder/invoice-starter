'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, Eye, EyeOff, Loader2 } from 'lucide-react';
import { formatActivityAction } from '@/lib/activity-labels';
import { relativeTime } from '@/lib/format';
import type { ActivityLog } from './types';

interface Props {
  activity: ActivityLog[];
  onlyOwn: boolean;
  loading: boolean;
  showToggle: boolean;
  onToggle: () => void;
}

export function ActivityFeed({ activity, onlyOwn, loading, showToggle, onToggle }: Props) {
  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Скорошна активност</CardTitle>
          <CardDescription>{onlyOwn ? 'Вашите действия' : 'Активност на всички'}</CardDescription>
        </div>
        {showToggle && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs gap-1.5"
            onClick={onToggle}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : onlyOwn ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
            {onlyOwn ? 'Покажи всички' : 'Само моите'}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mb-2 text-gray-300" />
            <p className="text-sm">Няма скорошна активност</p>
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
                    <span className="font-medium">{a.userName || 'Неизвестен'}</span>{' '}
                    <span className="text-muted-foreground">
                      {formatActivityAction(a.action)}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.companyName} · {relativeTime(a.timestamp)}
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
