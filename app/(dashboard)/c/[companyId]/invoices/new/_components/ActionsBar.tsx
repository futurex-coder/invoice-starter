'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Save, FileText, CheckCircle } from 'lucide-react';

interface Props {
  saving: boolean;
  onSaveDraft: () => void;
  onPreview: () => void;
  onFinalize: () => void;
}

// NI-1: Preview and Finalize work from an unsaved form — Preview saves the
// draft implicitly, Finalize creates + issues in one server transaction — so
// neither is gated on a prior manual draft save anymore.
export function ActionsBar({
  saving,
  onSaveDraft,
  onPreview,
  onFinalize,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={onSaveDraft} disabled={saving}>
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Save draft
      </Button>
      <Button variant="outline" onClick={onPreview} disabled={saving}>
        <FileText className="mr-2 h-4 w-4" />
        Preview
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
