'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter
} from '@/components/ui/card';
import { customerPortalAction } from '@/lib/payments/actions';
import { useActionState } from 'react';
import { CompanyWithMembers, User } from '@/lib/db/schema';
import { removeCompanyMember, inviteCompanyMember } from '@/app/(login)/actions';
import { useDashboardStatus } from './dashboard-context';
import useSWR from 'swr';
import { Suspense } from 'react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Loader2,
  PlusCircle,
  CheckCircle2,
  Circle,
  FileText,
  Handshake,
  Package,
  Building2,
  Landmark,
  ArrowRight,
} from 'lucide-react';

type ActionState = {
  error?: string;
  success?: string;
  inviteLink?: string;
};

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

function MembersSkeleton() {
  return (
    <Card className="mb-8 h-[140px]">
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="animate-pulse space-y-4 mt-1">
          <div className="flex items-center space-x-4">
            <div className="size-8 rounded-full bg-gray-200"></div>
            <div className="space-y-2">
              <div className="h-4 w-32 bg-gray-200 rounded"></div>
              <div className="h-3 w-14 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Members() {
  // TODO: Replace /api/team with proper company-scoped API after route restructuring
  const { data: companyData } = useSWR<CompanyWithMembers>('/api/team', fetcher);
  const [removeState, removeAction, isRemovePending] = useActionState<
    ActionState,
    FormData
  >(removeCompanyMember, {});

  const getUserDisplayName = (user: Pick<User, 'id' | 'name' | 'email'>) => {
    return user.name || user.email || 'Unknown User';
  };

  if (!companyData?.members?.length) {
    return (
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Members</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No members yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Members</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {companyData.members.map((member, index) => (
            <li key={member.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Avatar>
                  <AvatarFallback>
                    {getUserDisplayName(member.user)
                      .split(' ')
                      .map((n) => n[0])
                      .join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {getUserDisplayName(member.user)}
                  </p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {member.role}
                  </p>
                </div>
              </div>
              {index > 1 ? (
                <form action={removeAction}>
                  <input type="hidden" name="memberId" value={member.id} />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={isRemovePending}
                  >
                    {isRemovePending ? 'Removing...' : 'Remove'}
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {removeState?.error && (
          <p className="text-red-500 mt-4">{removeState.error}</p>
        )}
      </CardContent>
    </Card>
  );
}

function PendingInvitations() {
  // TODO: Replace /api/team with proper company-scoped API after route restructuring
  const { data: companyData } = useSWR<CompanyWithMembers>('/api/team', fetcher);

  // TODO: Replace with verifyCompanyRole() check after Step 2.3
  if (!companyData?.invitations?.length) {
    return null;
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>Pending Invitations</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {companyData.invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between">
              <div>
                <p className="font-medium">{invitation.email}</p>
                <p className="text-sm text-muted-foreground capitalize">
                  {invitation.role}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const inviteLink = `${window.location.origin}/sign-up?inviteId=${invitation.id}&email=${encodeURIComponent(invitation.email)}`;
                    navigator.clipboard.writeText(inviteLink);
                  }}
                >
                  Copy Link
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function InviteMemberSkeleton() {
  return (
    <Card className="h-[260px]">
      <CardHeader>
        <CardTitle>Invite Member</CardTitle>
      </CardHeader>
    </Card>
  );
}

function InviteMember() {
  // TODO: Replace with verifyCompanyRole() check after Step 2.3
  const isOwner = true;
  const [inviteState, inviteAction, isInvitePending] = useActionState<
    ActionState,
    FormData
  >(inviteCompanyMember, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite Member</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={inviteAction} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-2">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="Enter email"
              required
              disabled={!isOwner}
            />
          </div>
          <div>
            <Label>Role</Label>
            {/* TODO: Show role from company_members context */}
            <RadioGroup
              defaultValue="accountant"
              name="role"
              className="flex space-x-4"
              disabled={!isOwner}
            >
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="accountant" id="accountant" />
                <Label htmlFor="accountant">Accountant</Label>
              </div>
              <div className="flex items-center space-x-2 mt-2">
                <RadioGroupItem value="owner" id="owner" />
                <Label htmlFor="owner">Owner</Label>
              </div>
            </RadioGroup>
          </div>
          {inviteState?.error && (
            <p className="text-red-500">{inviteState.error}</p>
          )}
          {inviteState?.success && (
            <p className="text-green-500">{inviteState.success}</p>
          )}
          {inviteState?.inviteLink && (
            <div className="flex flex-col space-y-2 mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <Label className="text-sm font-medium text-gray-700">Invite Link (Manually Share):</Label>
              <div className="flex items-center space-x-2">
                <Input
                  readOnly
                  value={inviteState.inviteLink}
                  className="bg-white"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteState.inviteLink!);
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>
          )}
          <Button
            type="submit"
            className="bg-orange-500 hover:bg-orange-600 text-white"
            disabled={isInvitePending || !isOwner}
          >
            {isInvitePending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Inviting...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Invite Member
              </>
            )}
          </Button>
        </form>
      </CardContent>
      {!isOwner && (
        <CardFooter>
          <p className="text-sm text-muted-foreground">
            You must be a company owner to invite new members.
          </p>
        </CardFooter>
      )}
    </Card>
  );
}

function OnboardingChecklist() {
  const data = useDashboardStatus();

  if (!data) return null;

  const items = [
    {
      done: data.hasCompanyProfile,
      label: 'Company profile set up',
      href: '/dashboard/company',
      icon: Building2,
    },
    {
      done: data.hasBankDetails,
      label: 'Add bank details',
      href: '/dashboard/company',
      icon: Landmark,
    },
    {
      done: data.articleCount > 0,
      label: 'Add your first article',
      href: '/dashboard/articles',
      icon: Package,
    },
    {
      done: data.partnerCount > 0,
      label: 'Add your first partner / client',
      href: '/dashboard/partners',
      icon: Handshake,
    },
    {
      done: data.invoiceCount > 0,
      label: 'Create your first invoice',
      href: '/dashboard/invoices/new',
      icon: FileText,
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const allDone = completedCount === items.length;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>
          Welcome, {data.companyName}!
        </CardTitle>
        {!allDone && (
          <p className="text-sm text-muted-foreground">
            Complete these steps to get the most out of your account.
          </p>
        )}
      </CardHeader>
      <CardContent>
        {allDone ? (
          <p className="text-sm text-green-600 font-medium">
            You&apos;re all set! All onboarding steps are complete.
          </p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 group"
                >
                  {item.done ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-gray-300 shrink-0" />
                  )}
                  <item.icon className="h-4 w-4 text-gray-400 shrink-0" />
                  <span
                    className={`text-sm ${
                      item.done
                        ? 'text-gray-400 line-through'
                        : 'text-gray-700 group-hover:text-orange-600'
                    }`}
                  >
                    {item.label}
                  </span>
                  {!item.done && (
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-orange-500 ml-auto" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t border-gray-100">
          <Link href="/dashboard/invoices/new">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              New Invoice
            </Button>
          </Link>
          <Link href="/dashboard/partners">
            <Button size="sm" variant="outline">
              <Handshake className="mr-1.5 h-3.5 w-3.5" />
              Add Partner
            </Button>
          </Link>
          <Link href="/dashboard/articles">
            <Button size="sm" variant="outline">
              <Package className="mr-1.5 h-3.5 w-3.5" />
              Add Article
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Dashboard</h1>
      <OnboardingChecklist />
      <Suspense fallback={<SubscriptionSkeleton />}>
        <ManageSubscription />
      </Suspense>
      <Suspense fallback={<MembersSkeleton />}>
        <Members />
      </Suspense>
      <Suspense>
        <PendingInvitations />
      </Suspense>
      <Suspense fallback={<InviteMemberSkeleton />}>
        <InviteMember />
      </Suspense>
    </section>
  );
}
