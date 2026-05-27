'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

export type InviteRole = 'owner' | 'accountant';

export function isInviteRole(value: string): value is InviteRole {
  return value === 'owner' || value === 'accountant';
}

interface Props {
  email: string;
  onEmailChange: (value: string) => void;
  role: InviteRole;
  onRoleChange: (value: InviteRole) => void;
  inviting: boolean;
  showOwnerOption: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export function InviteMemberForm({
  email,
  onEmailChange,
  role,
  onRoleChange,
  inviting,
  showOwnerOption,
  onSubmit,
  onCancel,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Invite a new member</CardTitle>
        <CardDescription>
          They will receive an email with a sign-up link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="invEmail">Email address *</Label>
              <Input
                id="invEmail"
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </div>
            <div>
              <Label htmlFor="invRole">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  if (isInviteRole(v)) onRoleChange(v);
                }}
              >
                <SelectTrigger id="invRole" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Accountant</SelectItem>
                  {showOwnerOption && <SelectItem value="owner">Owner</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={inviting}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send invitation
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
