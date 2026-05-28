'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { Button } from '@/components/ui/button';
import {
  getCompanyMembersAction,
  inviteCompanyMember,
  removeCompanyMember,
} from '@/src/features/invoicing/actions';
import type { ValidationIssue } from '@/lib/actions/result';
import { canInviteMembers, canRemoveMembers } from '@/lib/auth/permissions';
import { useCompany } from '@/lib/context/company-context';
import { useActionSWR } from '@/lib/swr/use-action-swr';
import { ListPageHeader } from '@/components/list-page/ListPageHeader';
import { ErrorAlert } from '@/components/ui/ErrorAlert';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Loader2, UserPlus } from 'lucide-react';
import {
  InviteMemberForm,
  type InviteRole,
} from './_components/InviteMemberForm';
import { MembersTable } from './_components/MembersTable';
import { PendingInvitationsTable } from './_components/PendingInvitationsTable';
import { PageShell } from '@/components/page-shell';

export default function MembersPage() {
  const { role } = useCompany();

  const {
    data,
    isLoading: loading,
    error: fetchError,
    mutate: refetch,
  } = useActionSWR('companyMembers', getCompanyMembersAction);

  const [actionError, setActionError] = useState<string | null>(null);
  const [inviteValidationErrors, setInviteValidationErrors] = useState<
    ValidationIssue[] | null
  >(null);
  const error = actionError ?? (fetchError ? fetchError.message : null);

  // Invite form state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('accountant');
  const [inviting, setInviting] = useState(false);

  const [removingId, setRemovingId] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<{ id: number; name: string } | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setActionError(null);
    setInviteValidationErrors(null);

    const formData = new FormData();
    formData.set('email', inviteEmail.trim());
    formData.set('role', inviteRole);

    const res = await inviteCompanyMember({}, formData);

    setInviting(false);
    if (res && 'error' in res && res.error) {
      setActionError(res.error);
      if (
        'validationErrors' in res &&
        res.validationErrors &&
        res.validationErrors.length > 0
      ) {
        setInviteValidationErrors(res.validationErrors);
      }
      return;
    }
    toast.success('Invitation sent successfully');
    setInviteEmail('');
    setShowInvite(false);
    refetch();
  };

  const handleRemoveConfirmed = async () => {
    if (!confirmRemove) return;
    setRemovingId(confirmRemove.id);
    setActionError(null);

    const formData = new FormData();
    formData.set('memberId', String(confirmRemove.id));

    const res = await removeCompanyMember({}, formData);

    setRemovingId(null);
    if (res && 'error' in res && res.error) {
      setActionError(res.error);
      throw new Error(res.error);
    }
    toast.success('Member removed');
    refetch();
  };

  if (loading) {
    return (
      <PageShell className="flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </PageShell>
    );
  }

  const members = data?.members ?? [];
  const pendingInvitations = data?.invitations ?? [];
  const isOwner = role === 'owner';

  return (
    <PageShell>
      <ListPageHeader
        title="Members"
        action={
          canInviteMembers(role) && (
            <Button
              className="bg-primary hover:bg-primary/90"
              onClick={() => setShowInvite(true)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Invite member
            </Button>
          )
        }
      />

      <ErrorAlert message={error} className="mb-4" />

      {showInvite && (
        <InviteMemberForm
          email={inviteEmail}
          onEmailChange={setInviteEmail}
          role={inviteRole}
          onRoleChange={setInviteRole}
          inviting={inviting}
          showOwnerOption={isOwner}
          onSubmit={handleInvite}
          onCancel={() => {
            setShowInvite(false);
            setInviteValidationErrors(null);
          }}
          validationErrors={inviteValidationErrors}
        />
      )}

      <MembersTable
        members={members}
        canRemove={canRemoveMembers(role)}
        removingId={removingId}
        onRemove={(m) =>
          setConfirmRemove({ id: m.id, name: m.user.name || m.user.email })
        }
      />

      <PendingInvitationsTable invitations={pendingInvitations} />

      <ConfirmDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
        title="Remove member?"
        description={
          confirmRemove
            ? `${confirmRemove.name} will lose access to this company. You can invite them back later.`
            : undefined
        }
        confirmText="Remove member"
        variant="destructive"
        onConfirm={handleRemoveConfirmed}
      />
    </PageShell>
  );
}
