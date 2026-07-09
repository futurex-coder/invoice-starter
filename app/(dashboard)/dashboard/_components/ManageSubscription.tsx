'use client';

import { useCurrentUser } from '@/lib/swr/use-current-user';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';

export function ManageSubscription() {
  const { data: user } = useCurrentUser();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Абонамент</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div className="mb-4 sm:mb-0">
            <p className="font-medium">Текущ план: {user?.planName || 'Безплатен'}</p>
            <p className="text-sm text-muted-foreground">
              {user?.subscriptionStatus === 'active'
                ? 'Месечно таксуване'
                : user?.subscriptionStatus === 'trialing'
                  ? 'Пробен период'
                  : 'Няма активен абонамент'}
            </p>
          </div>
          <form action={customerPortalAction}>
            <Button type="submit" variant="outline">
              Управление на абонамента
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
