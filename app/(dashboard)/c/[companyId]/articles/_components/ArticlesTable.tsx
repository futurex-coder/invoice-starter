'use client';

import type { Article } from '@/lib/db/schema';
import { DataTableHead, DATA_ROW_CLASS } from '@/components/list-page/DataTableHead';
import { RowActionsMenu } from '@/components/list-page/RowActionsMenu';
import { Pencil, Trash2 } from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  service: 'Service',
  goods: 'Goods',
};

interface Props {
  articles: Article[];
  onEdit: (article: Article) => void;
  onDelete: (id: number) => void;
}

export function ArticlesTable({ articles, onEdit, onDelete }: Props) {
  return (
    <table className="w-full">
      <DataTableHead
        columns={[
          { label: 'Name' },
          { label: 'Unit' },
          { label: 'Default Price' },
          { label: 'Currency' },
          { label: 'Type' },
          { label: 'Actions', align: 'right' },
        ]}
      />
      <tbody>
        {articles.map((a) => (
          <tr key={a.id} className={DATA_ROW_CLASS}>
            <td className="px-4 py-3 text-sm font-medium">
              {a.name}
              {a.tags && (
                <span className="ml-2 text-xs text-muted-foreground">{a.tags}</span>
              )}
            </td>
            <td className="px-4 py-3 text-sm">{a.unit}</td>
            <td className="px-4 py-3 text-sm">{Number(a.defaultUnitPrice).toFixed(2)}</td>
            <td className="px-4 py-3 text-sm">{a.currency}</td>
            <td className="px-4 py-3 text-sm">
              <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                {TYPE_LABELS[a.type ?? 'service'] ?? a.type}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <RowActionsMenu
                actions={[
                  { icon: Pencil, label: 'Edit', onClick: () => onEdit(a) },
                  { icon: Trash2, label: 'Delete', onClick: () => onDelete(a.id), destructive: true },
                ]}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
