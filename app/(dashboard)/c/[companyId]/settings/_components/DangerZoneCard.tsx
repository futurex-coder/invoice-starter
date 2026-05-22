'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ArrowRightLeft, Trash2 } from 'lucide-react';

interface Props {
  onTransferClick: () => void;
  onDeleteClick: () => void;
}

export function DangerZoneCard({ onTransferClick, onDeleteClick }: Props) {
  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-700">Danger zone</CardTitle>
        <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium">Transfer ownership</p>
            <p className="text-xs text-muted-foreground">
              Transfer this company to another member. You will become an accountant.
            </p>
          </div>
          <Button variant="outline" onClick={onTransferClick}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Transfer
          </Button>
        </div>
        <div className="flex items-center justify-between rounded-md border border-red-200 bg-red-50/50 p-4">
          <div>
            <p className="text-sm font-medium text-red-700">Delete company</p>
            <p className="text-xs text-muted-foreground">
              Soft-deletes this company. All members lose access. You can restore it later.
            </p>
          </div>
          <Button variant="destructive" onClick={onDeleteClick}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
