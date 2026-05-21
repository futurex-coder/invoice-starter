'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { MemberSummary } from './types';

interface Props {
  otherMembers: MemberSummary[];
  selectedMemberId: number | null;
  onSelectMember: (id: number) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function TransferOwnershipModal({
  otherMembers,
  selectedMemberId,
  onSelectMember,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle>Transfer ownership</CardTitle>
          <CardDescription>
            Select a member to become the new owner. You will be demoted to accountant.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {otherMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No other members to transfer to. Invite someone first.
            </p>
          ) : (
            <div className="space-y-2">
              {otherMembers.map((m) => (
                <label
                  key={m.userId}
                  className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer ${
                    selectedMemberId === m.userId
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="transferTarget"
                    checked={selectedMemberId === m.userId}
                    onChange={() => onSelectMember(m.userId)}
                    className="h-4 w-4"
                  />
                  <div>
                    <p className="text-sm font-medium">{m.userName || m.userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.userEmail} · {m.role}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              className="bg-orange-500 hover:bg-orange-600"
              disabled={!selectedMemberId || loading}
              onClick={onConfirm}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm transfer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
