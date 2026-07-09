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
          <DialogTitle className="text-destructive">Изтриване на фирмата</DialogTitle>
          <DialogDescription>
            Това ще премахне достъпа на всички членове. Фирмата може да бъде възстановена по-късно чрез свързване с поддръжката.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm">
          Въведете <span className="font-mono font-medium">{companyName}</span> за потвърждение:
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
            Отказ
          </Button>
          <Button
            variant="destructive"
            disabled={confirmText !== companyName || loading}
            onClick={onConfirm}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Изтрий окончателно
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
