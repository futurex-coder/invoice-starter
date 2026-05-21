import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { DuplicateMatch } from '@/src/features/received-invoices/types';

interface Props {
  duplicates: DuplicateMatch[];
  companyId: string;
}

export function DuplicatesWarning({ duplicates, companyId }: Props) {
  if (duplicates.length === 0) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
      <div className="flex-1">
        <p className="font-medium text-amber-900">
          Possible duplicate of another received invoice{duplicates.length > 1 ? 's' : ''}:
        </p>
        <ul className="mt-1 list-disc pl-5 text-xs text-amber-800">
          {duplicates.map((d) => (
            <li key={d.id}>
              <Link
                href={`/c/${companyId}/received-invoices/${d.id}`}
                className="underline"
                target="_blank"
              >
                #{d.id}
              </Link>{' '}
              {d.invoiceNumber ? `(№ ${d.invoiceNumber})` : ''} {d.issueDate ?? ''}
              {' — '}
              <span className="text-amber-700">
                {d.matchType === 'checksum' ? 'same file' : 'same number + date'}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-amber-700">
          You can still continue if this is intentional.
        </p>
      </div>
    </div>
  );
}
