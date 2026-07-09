'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { FormField } from '@/components/forms/form-field';
import type { ValidationIssue } from '@/lib/actions/result';

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
  validationErrors?: ValidationIssue[] | null;
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
  validationErrors,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Покани нов член</CardTitle>
        <CardDescription>
          Те ще получат имейл с връзка за регистрация.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              name="email"
              label="Имейл адрес"
              required
              errors={validationErrors}
            >
              <Input
                type="email"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="kolega@example.com"
                required
              />
            </FormField>
            <FormField name="role" label="Роля" errors={validationErrors}>
              <Select
                value={role}
                onValueChange={(v) => {
                  if (isInviteRole(v)) onRoleChange(v);
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="accountant">Счетоводител</SelectItem>
                  {showOwnerOption && <SelectItem value="owner">Собственик</SelectItem>}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={inviting}>
              {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Изпрати покана
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Отказ
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
