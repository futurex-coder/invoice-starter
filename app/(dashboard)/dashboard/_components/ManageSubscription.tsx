'use client';

import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import type { User } from '@/lib/db/schema';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function ManageSubscription() {
  const { data: user } = useSWR<User>('/api/user', fetcher);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="mb-4 sm:mb-0">
            <p className="font-medium">Current Plan: {user?.planName || 'Free'}</p>
            <p className="text-sm text-muted-foreground">
              {user?.subscriptionStatus === 'active'
                ? 'Billed monthly'
                : user?.subscriptionStatus === 'trialing'
                  ? 'Trial period'
                  : 'No active subscription'}
            </p>
          </div>
          <form action={customerPortalAction}>
            <Button type="submit" variant="outline">
              Manage Subscription
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
