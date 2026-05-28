'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Crown, Loader2, Trash2, User } from 'lucide-react';
import type { CompanyMember, User as UserRow } from '@/lib/db/schema';

type Member = CompanyMember & { user: Pick<UserRow, 'id' | 'name' | 'email'> };

interface Props {
  members: Member[];
  canRemove: boolean;
  removingId: number | null;
  onRemove: (member: Member) => void;
}

export function MembersTable({ members, canRemove, removingId, onRemove }: Props) {
  return (
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
                          ? 'bg-primary/10 text-primary'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {m.role === 'owner' && <Crown className="h-3 w-3" />}
                      {m.role === 'owner' ? 'Owner' : 'Accountant'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canRemove && m.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={removingId === m.id}
                        onClick={() => onRemove(m)}
                      >
                        {removingId === m.id ? (
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
  );
}
