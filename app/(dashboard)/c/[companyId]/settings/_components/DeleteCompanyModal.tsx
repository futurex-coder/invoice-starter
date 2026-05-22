'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Props {
  companyName: string;
  confirmText: string;
  onConfirmTextChange: (value: string) => void;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteCompanyModal({
  companyName,
  confirmText,
  onConfirmTextChange,
  loading,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-red-700">Delete company</CardTitle>
          <CardDescription>
            This will remove access for all members. The company can be restored later by contacting support.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            Type <span className="font-mono font-medium">{companyName}</span> to confirm:
          </p>
          <Input
            value={confirmText}
            onChange={(e) => onConfirmTextChange(e.target.value)}
            placeholder={companyName}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onCancel}>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
