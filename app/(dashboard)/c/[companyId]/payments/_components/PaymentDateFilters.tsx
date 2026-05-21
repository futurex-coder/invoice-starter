'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  fromDate: string;
  onFromDateChange: (value: string) => void;
  toDate: string;
  onToDateChange: (value: string) => void;
  onClear: () => void;
}

export function PaymentDateFilters({
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  onClear,
}: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <Label htmlFor="paidFrom" className="text-xs">
          From
        </Label>
        <Input
          id="paidFrom"
          type="date"
          className="mt-1 h-8"
          value={fromDate}
          onChange={(e) => onFromDateChange(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="paidTo" className="text-xs">
          To
        </Label>
        <Input
          id="paidTo"
          type="date"
          className="mt-1 h-8"
          value={toDate}
          onChange={(e) => onToDateChange(e.target.value)}
        />
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Clear
      </Button>
    </div>
  );
}
