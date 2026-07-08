'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Save, CheckCircle } from 'lucide-react';

interface Props {
  saving: boolean;
  onSaveDraft: () => void;
  onFinalize: () => void;
}

// NEWINV-1: only Save draft + Finalize. Preview was removed (it just saved a
// draft and opened the print view — reachable from a saved invoice instead).
// Finalize works from an unsaved form (createInvoiceDraft + finalizeImmediately).
export function ActionsBar({
  saving,
  onSaveDraft,
  onFinalize,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onSaveDraft} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save draft
      </Button>
      <Button
        className="bg-green-600 hover:bg-green-700"
        onClick={onFinalize}
        disabled={saving}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
        Finalize (issue)
      </Button>
    </div>
  );
}
