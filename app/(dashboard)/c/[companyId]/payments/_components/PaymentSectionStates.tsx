import { CheckCircle2, FileText, Loader2 } from 'lucide-react';

export function PaymentLoadingRow() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  );
}

interface EmptyRowProps {
  text: string;
  accent: 'green' | 'gray';
}

export function PaymentEmptyRow({ text, accent }: EmptyRowProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-sm text-gray-500">
      {accent === 'green' ? (
        <CheckCircle2 className="h-7 w-7 text-green-300" />
      ) : (
        <FileText className="h-7 w-7 text-gray-300" />
      )}
      <p>{text}</p>
    </div>
  );
}
