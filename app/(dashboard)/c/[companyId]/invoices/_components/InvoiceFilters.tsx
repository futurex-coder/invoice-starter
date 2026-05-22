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
          <select
            id="status"
            className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filters.status ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onFiltersChange({
                status: v === '' ? undefined : isInvoiceStatus(v) ? v : undefined,
                page: 1,
              });
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="finalized">Finalized</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div className="w-full sm:w-48">
          <Label htmlFor="paymentStatus">Payment</Label>
          <select
            id="paymentStatus"
            className="mt-1 block w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filters.paymentStatus ?? ''}
            onChange={(e) =>
              onFiltersChange({
                paymentStatus: e.target.value || undefined,
                page: 1,
              })
            }
          >
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
          </select>
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="dateFrom">From date</Label>
          <Input
            id="dateFrom"
            type="date"
            className="mt-1"
            value={filters.dateFrom ?? ''}
            onChange={(e) =>
              onFiltersChange({ dateFrom: e.target.value || undefined, page: 1 })
            }
          />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="dateTo">To date</Label>
          <Input
            id="dateTo"
            type="date"
            className="mt-1"
            value={filters.dateTo ?? ''}
            onChange={(e) =>
              onFiltersChange({ dateTo: e.target.value || undefined, page: 1 })
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
