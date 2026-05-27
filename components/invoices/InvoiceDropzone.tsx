'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ExtractApiResponseSchema,
  type ExtractedInvoice,
} from '@/app/api/invoices/extract/schema';

const ACCEPT_LIST = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];
const ACCEPT_ATTR = ACCEPT_LIST.join(',');

type Confidence = 'high' | 'medium' | 'low';

interface InvoiceDropzoneProps {
  onExtracted: (data: ExtractedInvoice) => void;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function ConfidenceBadge({ value }: { value: Confidence }) {
  const styles: Record<Confidence, string> = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-red-100 text-red-700',
  };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none',
        styles[value]
      )}
    >
      {value}
    </span>
  );
}

export function InvoiceDropzone({
  onExtracted,
  className,
}: InvoiceDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<Confidence | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openPicker = () => {
    if (!analyzing) inputRef.current?.click();
  };

  const handleFile = async (selected: File) => {
    if (!ACCEPT_LIST.includes(selected.type)) {
      setFile(selected);
      setError(`Unsupported file type: ${selected.type || 'unknown'}`);
      setConfidence(null);
      return;
    }

    setFile(selected);
    setError(null);
    setConfidence(null);
    setAnalyzing(true);

    try {
      const formData = new FormData();
      formData.append('file', selected);
      const res = await fetch('/api/invoices/extract', {
        method: 'POST',
        body: formData,
      });
      const json: unknown = await res.json();
      const parsed = ExtractApiResponseSchema.safeParse(json);

      if (!parsed.success) {
        setError('Unexpected response from server');
        return;
      }
      if ('error' in parsed.data) {
        setError(parsed.data.error);
        return;
      }
      setConfidence(parsed.data.data.overall_confidence);
      onExtracted(parsed.data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setAnalyzing(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) void handleFile(f);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (analyzing) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  };

  const clear = () => {
    setFile(null);
    setError(null);
    setConfidence(null);
  };

  return (
    <div
      className={cn(
        'rounded-lg border border-dashed transition-colors',
        dragOver
          ? 'border-primary/40 bg-primary/5'
          : 'border-gray-300 bg-gray-50',
        className
      )}
      onDragOver={(e) => {
        e.preventDefault();
        if (!analyzing) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTR}
        onChange={onInputChange}
        className="hidden"
        disabled={analyzing}
      />

      {!file ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={analyzing}
          className="flex w-full flex-col items-center justify-center gap-2 p-6 text-center text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-50"
        >
          <Upload className="h-6 w-6 text-gray-400" />
          <div className="text-sm">
            <span className="font-medium text-gray-900">Click to upload</span>
            <span className="text-gray-500"> or drag and drop</span>
          </div>
          <p className="text-xs text-gray-500">
            PDF, JPG, PNG, WebP — invoice scan or photo
          </p>
        </button>
      ) : (
        <div className="flex items-center gap-3 p-4">
          <FileText className="h-5 w-5 shrink-0 text-gray-500" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{file.name}</span>
              {confidence && <ConfidenceBadge value={confidence} />}
            </div>
            <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
          </div>
          {analyzing ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing document...</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={clear}
              className="rounded p-1 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
