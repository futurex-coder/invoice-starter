'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import type { MemberSummary } from './types';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  otherMembers: MemberSummary[];
  selectedMemberId: number | null;
  onSelectMember: (id: number) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function TransferOwnershipModal({
  open,
  onOpenChange,
  otherMembers,
  selectedMemberId,
  onSelectMember,
  loading,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>Прехвърляне на собствеността</DialogTitle>
          <DialogDescription>
            Изберете член, който да стане новият собственик. Вие ще бъдете понижени до счетоводител.
          </DialogDescription>
        </DialogHeader>
        {otherMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Няма други членове, на които да прехвърлите. Първо поканете някого.
          </p>
        ) : (
          <div className="space-y-2">
            {otherMembers.map((m) => (
              <label
                key={m.userId}
                className={cn(
                  'flex items-center gap-3 rounded-md border p-3 cursor-pointer',
                  selectedMemberId === m.userId
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-gray-200 hover:bg-gray-50'
                )}
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
                    {m.userEmail} · {m.role === 'owner' ? 'Собственик' : 'Счетоводител'}
                  </p>
                </div>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Отказ
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            disabled={!selectedMemberId || loading}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Потвърди прехвърлянето
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
