'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { getCompanyMembersAction } from '@/src/features/invoicing/actions';
import {
  inviteCompanyMember,
  removeCompanyMember,
} from '@/app/(login)/actions';
import {
  canInviteMembers,
  canRemoveMembers,
} from '@/lib/auth/permissions';
import { useCompany } from '@/lib/context/company-context';
import type { CompanyWithMembers } from '@/lib/db/schema';
import {
  Loader2,
  UserPlus,
  Trash2,
  Mail,
  Clock,
  Crown,
  User,
} from 'lucide-react';

export default function MembersPage() {
  const { company, role } = useCompany();
  const [data, setData] = useState<CompanyWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'accountant'>(
    'accountant'
  );
  const [inviting, setInviting] = useState(false);

  const [removing, setRemoving] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await getCompanyMembersAction();
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.data) setData(res.data);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set('email', inviteEmail.trim());
    formData.set('role', inviteRole);

    const res = await inviteCompanyMember({}, formData);

    setInviting(false);
    if (res && 'error' in res && res.error) {
      setError(res.error as string);
      return;
    }
    setSuccess('Invitation sent successfully');
    setInviteEmail('');
    setShowInvite(false);
    loadData();
  };

  const handleRemove = async (memberId: number) => {
    if (!confirm('Remove this member from the company?')) return;
    setRemoving(memberId);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set('memberId', String(memberId));

    const res = await removeCompanyMember({}, formData);

    setRemoving(null);
    if (res && 'error' in res && res.error) {
      setError(res.error as string);
      return;
    }
    setSuccess('Member removed');
    loadData();
  };

  if (loading) {
    return (
      <section className="flex-1 p-4 lg:p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </section>
    );
  }

  const members = data?.members ?? [];
  const pendingInvitations = data?.invitations ?? [];
  const isOwner = role === 'owner';

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h1 className="text-lg lg:text-2xl font-medium">Members</h1>
        {canInviteMembers(role) && (
          <Button
            className="bg-orange-500 hover:bg-orange-600"
            onClick={() => setShowInvite(true)}
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Invite member
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-50 text-red-700 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-md bg-green-50 text-green-700 text-sm">
          {success}
        </div>
      )}

      {/* Invite form */}
      {showInvite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Invite a new member</CardTitle>
            <CardDescription>
              They will receive an email with a sign-up link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invEmail">Email address *</Label>
                  <Input
                    id="invEmail"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="invRole">Role</Label>
                  <select
                    id="invRole"
                    className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    value={inviteRole}
                    onChange={(e) =>
                      setInviteRole(
                        e.target.value as 'owner' | 'accountant'
                      )
                    }
                  >
                    <option value="accountant">Accountant</option>
                    {isOwner && <option value="owner">Owner</option>}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={inviting}>
                  {inviting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Send invitation
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInvite(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Members list */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>
            Company members{' '}
            <span className="text-sm font-normal text-muted-foreground">
              ({members.length})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {members.length === 0 ? (
            <p className="px-6 py-8 text-muted-foreground text-sm">
              No members found.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Member
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                    <tr
                      key={m.id}
                      className="border-b border-gray-200 hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                            <User className="h-4 w-4 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {m.user.name || m.user.email}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {m.user.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                            m.role === 'owner'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-blue-50 text-blue-700'
                          }`}
                        >
                          {m.role === 'owner' && (
                            <Crown className="h-3 w-3" />
                          )}
                          {m.role === 'owner' ? 'Owner' : 'Accountant'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {canRemoveMembers(role) &&
                          m.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={removing === m.id}
                              onClick={() => handleRemove(m.id)}
                            >
                              {removing === m.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                      </td>
                    </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {pendingInvitations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Pending invitations{' '}
              <span className="text-sm font-normal text-muted-foreground">
                ({pendingInvitations.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Invited
                  </th>
                </tr>
              </thead>
              <tbody>
                {pendingInvitations.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-gray-200 hover:bg-gray-50/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm">{inv.email}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 capitalize">
                        {inv.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(inv.invitedAt).toLocaleDateString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
