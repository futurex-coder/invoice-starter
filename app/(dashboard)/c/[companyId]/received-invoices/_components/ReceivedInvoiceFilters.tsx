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
import type { ListReceivedInvoicesFilters } from '@/src/features/received-invoices/actions';

type Status = NonNullable<ListReceivedInvoicesFilters['status']>;
type PaymentStatusFilter = NonNullable<ListReceivedInvoicesFilters['paymentStatus']>;

function isStatus(value: string): value is Status {
  return value === 'draft' || value === 'confirmed' || value === 'discarded';
}
function isPaymentStatusFilter(value: string): value is PaymentStatusFilter {
  return value === 'unpaid' || value === 'partial' || value === 'paid';
}

interface Props {
  filters: ListReceivedInvoicesFilters;
  onFiltersChange: (patch: Partial<ListReceivedInvoicesFilters>) => void;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
}

export function ReceivedInvoiceFilters({
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
      <CardContent className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-44">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filters.status ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onFiltersChange({
                status: v === '' ? undefined : isStatus(v) ? v : undefined,
                page: 1,
              });
            }}
          >
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="confirmed">Confirmed</option>
            <option value="discarded">Discarded</option>
          </select>
        </div>
        <div className="w-full sm:w-44">
          <Label htmlFor="paymentStatus">Payment</Label>
          <select
            id="paymentStatus"
            className="mt-1 block h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={filters.paymentStatus ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              onFiltersChange({
                paymentStatus:
                  v === '' ? undefined : isPaymentStatusFilter(v) ? v : undefined,
                page: 1,
              });
            }}
          >
            <option value="">All</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partial</option>
            <option value="paid">Paid</option>
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
        <div className="w-full sm:w-56">
          <Label htmlFor="search">Number / Supplier</Label>
          <div className="mt-1 flex gap-2">
            <Input
              id="search"
              placeholder="Search..."
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearchSubmit();
              }}
            />
            <Button variant="outline" onClick={onSearchSubmit}>
              Search
            </Button>
          </div>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={filters.includeArchived ?? false}
            onChange={(e) =>
              onFiltersChange({ includeArchived: e.target.checked, page: 1 })
            }
          />
          Include archived
        </label>
      </CardContent>
    </Card>
  );
}
