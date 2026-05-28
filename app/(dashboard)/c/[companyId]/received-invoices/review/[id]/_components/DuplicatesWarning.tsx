import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import type { DuplicateMatch } from '@/src/features/received-invoices/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface Props {
  duplicates: DuplicateMatch[];
  companyId: string;
}

export function DuplicatesWarning({ duplicates, companyId }: Props) {
  if (duplicates.length === 0) return null;
  return (
    <Alert variant="warning" icon={AlertTriangle} className="mb-4">
      <AlertTitle>
        Possible duplicate of another received invoice{duplicates.length > 1 ? 's' : ''}:
      </AlertTitle>
      <AlertDescription>
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
      </AlertDescription>
    </Alert>
  );
}
