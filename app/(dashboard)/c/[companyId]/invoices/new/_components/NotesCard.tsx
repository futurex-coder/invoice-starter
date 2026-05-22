'use client';

import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  customerNote: string;
  onCustomerNoteChange: (value: string) => void;
  internalComment: string;
  onInternalCommentChange: (value: string) => void;
}

export function NotesCard({
  customerNote,
  onCustomerNoteChange,
  internalComment,
  onInternalCommentChange,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="customerNote">Customer-visible note</Label>
          <textarea
            id="customerNote"
            className="mt-1 block w-full min-h-[80px] rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            value={customerNote}
            onChange={(e) => onCustomerNoteChange(e.target.value)}
            placeholder="Optional"
          />
        </div>
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
