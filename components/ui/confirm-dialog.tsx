'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Confirm-button label. Defaults to "Confirm". */
  confirmText?: string;
  /** Cancel-button label. Defaults to "Cancel". */
  cancelText?: string;
  /** Confirm-button variant. Defaults to "default"; use "destructive"
   * for delete/remove flows. */
  variant?: 'default' | 'destructive';
  /** Called when the user clicks confirm. May be async — the dialog
   * disables the button and shows a spinner while the promise resolves,
   * then closes on success. If it throws, the dialog stays open and
   * the error surfaces to the caller (catch it there). */
  onConfirm: () => void | Promise<void>;
}

/**
 * Accessible replacement for `window.confirm()`.
 *
 * @example
 * const [open, setOpen] = useState(false);
 * return (
 *   <>
 *     <Button onClick={() => setOpen(true)}>Delete</Button>
 *     <ConfirmDialog
 *       open={open}
 *       onOpenChange={setOpen}
 *       title="Delete partner?"
 *       description="This cannot be undone."
 *       confirmText="Delete"
 *       variant="destructive"
 *       onConfirm={async () => { await deletePartner(id); }}
 *     />
 *   </>
 * );
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = 'Потвърди',
  cancelText = 'Отказ',
  variant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={!loading}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
