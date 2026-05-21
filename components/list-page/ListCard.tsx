'use client';

import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Pagination } from './Pagination';

interface Props {
  title: string;
  count?: number;
  loading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  children: ReactNode;
}

export function ListCard({
  title,
  count,
  loading,
  isEmpty,
  emptyMessage,
  page,
  pageSize,
  total,
  onPageChange,
  children,
}: Props) {
  const showPagination =
    page !== undefined &&
    pageSize !== undefined &&
    total !== undefined &&
    onPageChange !== undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title}
          {!loading && count !== undefined && (
            <span className="text-sm font-normal text-muted-foreground">
              {' '}({count})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : isEmpty ? (
          <p className="px-6 py-8 text-muted-foreground text-sm">{emptyMessage}</p>
        ) : (
          children
        )}
        {showPagination && (
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
          />
        )}
      </CardContent>
    </Card>
  );
}
