'use client';

import Link from 'next/link';
import { Bell } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  getNotifications,
  markNotificationsSeen,
} from '@/src/features/invoicing/actions';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { useCurrentUser } from '@/lib/swr/use-current-user';
import { formatActivityAction, isActivityType } from '@/lib/activity-labels';
import { relativeTime } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * TRANS-1: the owner↔accountant transparency bell. Shows what OTHER
 * members did in your companies; opening it marks everything seen.
 */
export function NotificationsBell() {
  const { data: user } = useCurrentUser();
  const { data, mutate } = useActionSWR(
    user ? 'notifications' : null,
    getNotifications,
    { refreshInterval: 60_000 }
  );

  if (!user) return null;

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const handleOpenChange = async (open: boolean) => {
    if (!open || unreadCount === 0 || !data) return;
    // Optimistically clear the badge, then persist the high-water mark.
    void mutate(
      {
        ...data,
        unreadCount: 0,
        items: data.items.map((i) => ({ ...i, unread: false })),
      },
      { revalidate: false }
    );
    await markNotificationsSeen();
  };

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className="relative rounded-full p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        aria-label={
          unreadCount > 0
            ? `Известия — ${unreadCount} непрочетени`
            : 'Известия'
        }
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="border-b border-gray-100 px-3 py-2 text-sm font-medium">
          Активност във вашите фирми
        </div>
        {items.length === 0 ? (
          <p className="px-3 py-4 text-sm text-gray-500">
            Все още няма нищо — действията на другите членове ще се показват тук.
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} className="cursor-pointer" asChild>
              <Link
                href={`/c/${n.companyId}/activity`}
                className="flex w-full flex-col items-start gap-0.5 py-2"
              >
                <span
                  className={cn(
                    'text-sm',
                    n.unread ? 'font-semibold text-gray-900' : 'text-gray-700'
                  )}
                >
                  {n.actorName}{' '}
                  <span className="font-normal">
                    {isActivityType(n.action)
                      ? formatActivityAction(n.action).toLowerCase()
                      : n.action}
                  </span>
                </span>
                <span className="text-xs text-gray-500">
                  {n.companyName} · {relativeTime(new Date(n.timestamp))}
                </span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
