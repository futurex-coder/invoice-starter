'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RotateCcw, Trash2 } from 'lucide-react';
import type { DeletedCompanyRow } from './types';
import { cn } from '@/lib/utils';

interface Props {
  rows: DeletedCompanyRow[];
  restoringId: number | null;
  onRestore: (companyId: number) => void;
  className?: string;
}

export function DeletedCompaniesCard({ rows, restoringId, onRestore, className }: Props) {
  if (rows.length === 0) return null;
  return (
    <Card className={cn('border-amber-200', className)}>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-amber-600" />
          <CardTitle className="text-amber-800">Изтрити фирми</CardTitle>
        </div>
        <CardDescription>
          {rows.length === 1
            ? 'Имате 1 изтрита фирма, която може да бъде възстановена.'
            : `Имате ${rows.length} изтрити фирми, които могат да бъдат възстановени.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Фирма
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                ЕИК
              </th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Изтрита на
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                Действие
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.company.id} className="border-b border-gray-200 last:border-0">
                <td className="px-4 py-3 text-sm font-medium">{d.company.legalName}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                  {d.company.eik}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {d.company.deletedAt
                    ? new Date(d.company.deletedAt).toLocaleDateString()
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-700 border-amber-300 hover:bg-amber-50"
                    disabled={restoringId === d.company.id}
                    onClick={() => onRestore(d.company.id)}
                  >
                    {restoringId === d.company.id ? (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    )}
                    Възстанови
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
