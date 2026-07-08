'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ListInvoicesFilters } from '@/src/features/bulgarian-invoicing/actions';

type InvoiceStatus = ListInvoicesFilters['status'];

function isInvoiceStatus(value: string): value is NonNullable<InvoiceStatus> {
  return value === 'draft' || value === 'finalized' || value === 'cancelled';
}

interface Props {
  filters: ListInvoicesFilters;
  onFiltersChange: (patch: Partial<ListInvoicesFilters>) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
}

export function InvoiceFilters({
  filters,
  onFiltersChange,
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
}: Props) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-4 items-end">
        <div className="w-full sm:w-48">
          <Label htmlFor="status">Status</Label>
          <Select
            value={filters.status ?? 'all'}
            onValueChange={(v) => {
              onFiltersChange({
                status:
                  v === 'all' ? undefined : isInvoiceStatus(v) ? v : undefined,
                page: 1,
              });
            }}
          >
            <SelectTrigger id="status" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="finalized">Finalized</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="paymentStatus">Payment</Label>
          <Select
            value={filters.paymentStatus ?? 'all'}
            onValueChange={(v) =>
              onFiltersChange({
                paymentStatus: v === 'all' ? undefined : v,
                page: 1,
              })
            }
          >
            <SelectTrigger id="paymentStatus" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="accountingStatus">Accounting</Label>
          <Select
            value={filters.accountingStatus ?? 'all'}
            onValueChange={(v) =>
              onFiltersChange({
                accountingStatus: v === 'all' ? undefined : v,
                page: 1,
              })
            }
          >
            <SelectTrigger id="accountingStatus" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accounted">Accounted</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* OI-5: accountants work by month — one month picker instead of a
            from/to range. */}
        <div className="w-full sm:w-44">
          <Label htmlFor="month">Month</Label>
          <Input
            id="month"
            type="month"
            className="mt-1"
            value={filters.month ?? ''}
            onChange={(e) =>
              onFiltersChange({ month: e.target.value || undefined, page: 1 })
            }
          />
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="search">Number / Client</Label>
          <div className="flex gap-2 mt-1">
            <Input
              id="search"
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
            />
            <Button variant="outline" onClick={onSearchSubmit}>
              Search
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
