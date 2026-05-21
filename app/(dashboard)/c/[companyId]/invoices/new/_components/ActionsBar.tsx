'use client';

import { Button } from '@/components/ui/button';
import { Loader2, Save, FileText, CheckCircle } from 'lucide-react';

interface Props {
  saving: boolean;
  hasDraft: boolean;
  onSaveDraft: () => void;
  onPreview: () => void;
  onFinalize: () => void;
}

export function ActionsBar({
  saving,
  hasDraft,
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
      <Button variant="outline" onClick={onPreview} disabled={saving || !hasDraft}>
        <FileText className="mr-2 h-4 w-4" />
        Preview
      </Button>
      <Button
        className="bg-green-600 hover:bg-green-700"
        onClick={onFinalize}
        disabled={saving || !hasDraft}
      >
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
        Finalize (issue)
      </Button>
    </div>
  );
}
