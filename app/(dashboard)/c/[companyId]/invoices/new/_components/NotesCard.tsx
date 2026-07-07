'use client';

import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// NI-2: the customer-visible note field was removed from the form —
// `customerNote` stays in the schema/payload so historical drafts keep
// their note when re-saved, it just isn't surfaced or collected anymore.
interface Props {
  internalComment: string;
  onInternalCommentChange: (value: string) => void;
}

export function NotesCard({ internalComment, onInternalCommentChange }: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="internalComment">Internal comment (not on invoice)</Label>
          <textarea
            id="internalComment"
            className="mt-1 block w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={internalComment}
            onChange={(e) => onInternalCommentChange(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </CardContent>
    </Card>
  );
}
