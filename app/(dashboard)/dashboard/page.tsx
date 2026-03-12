'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { User, type UserCompanyMembership } from '@/lib/db/schema';
import useSWR from 'swr';
import { Suspense, useEffect, useState } from 'react';
import {
  Loader2,
  Building2,
  Plus,
  ArrowRight,
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function SubscriptionSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
    </Card>
  );
}

function ManageSubscription() {
  const { data: user } = useSWR<User>('/api/user', fetcher);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Subscription</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div className="mb-4 sm:mb-0">
              <p className="font-medium">
                Current Plan: {user?.planName || 'Free'}
              </p>
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
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyList() {
  const { data: memberships, isLoading } = useSWR<UserCompanyMembership[]>(
    '/api/team',
    async (url: string) => {
      const res = await fetch(url);
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (data?.company) return [data];
      return [];
    }
  );

  if (isLoading) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Your companies</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Your companies</CardTitle>
        <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
          <Link href="/create-company">
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New company
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!memberships?.length ? (
          <div className="text-center py-8">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">
              You don&apos;t belong to any companies yet.
            </p>
            <Button asChild className="bg-orange-500 hover:bg-orange-600 text-white">
              <Link href="/create-company">Create your first company</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {memberships.map((m) => (
              <li key={m.company.id}>
                <Link
                  href={`/c/${m.company.id}/dashboard`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-gray-400 group-hover:text-orange-500" />
                    <div>
                      <p className="font-medium text-sm">{m.company.legalName}</p>
                      <p className="text-xs text-muted-foreground">
                        EIK: {m.company.eik} · <span className="capitalize">{m.role}</span>
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-orange-500" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Dashboard</h1>
      <CompanyList />
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
    </section>
  );
}
