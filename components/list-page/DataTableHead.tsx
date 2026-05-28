import { cn } from '@/lib/utils';

export interface Column {
  label: string;
  align?: 'left' | 'right';
}

interface Props {
  columns: Column[];
}

export function DataTableHead({ columns }: Props) {
  return (
    <thead>
      <tr className="border-b border-gray-200 bg-gray-50/80">
        {columns.map((col) => (
          <th
            key={col.label}
            className={cn(
              'px-4 py-3 text-xs font-medium text-gray-600 uppercase tracking-wider',
              col.align === 'right' ? 'text-right' : 'text-left'
            )}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export const DATA_ROW_CLASS = 'border-b border-gray-200 hover:bg-gray-50/50';
