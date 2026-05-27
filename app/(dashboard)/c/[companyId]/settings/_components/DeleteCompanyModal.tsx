'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  loading: boolean;
  onConfirm: () => void;
}

export function DeleteCompanyModal({
  open,
  onOpenChange,
  companyName,
  confirmText,
  onConfirmTextChange,
  loading,
  onConfirm,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete company</DialogTitle>
          <DialogDescription>
            This will remove access for all members. The company can be restored later by contacting support.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Type <span className="font-mono font-medium">{companyName}</span> to confirm:
        </p>
        <Input
          value={confirmText}
          onChange={(e) => onConfirmTextChange(e.target.value)}
          placeholder={companyName}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={confirmText !== companyName || loading}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Permanently delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
