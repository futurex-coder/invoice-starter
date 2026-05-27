'use client';

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface Props {
  receivedInvoiceId: number;
  fileMimeType: string;
  fileOriginalName: string;
  initialSignedUrl?: string;
}

export function PreviewPane({
  receivedInvoiceId,
  fileMimeType,
  fileOriginalName,
  initialSignedUrl,
}: Props) {
  const [url, setUrl] = useState<string | null>(initialSignedUrl ?? null);
  const [loading, setLoading] = useState(!initialSignedUrl);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialSignedUrl) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/received-invoices/${receivedInvoiceId}/file`,
          { cache: 'no-store' }
        );
        const json: unknown = await res.json();
        if (cancelled) return;
        if (typeof json === 'object' && json !== null && 'url' in json) {
          const value = json.url;
          if (typeof value === 'string') {
            setUrl(value);
            return;
          }
        }
        if (typeof json === 'object' && json !== null && 'error' in json) {
          const value = json.error;
          if (typeof value === 'string') {
            setError(value);
            return;
          }
        }
        setError('Could not load preview');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Network error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [receivedInvoiceId, initialSignedUrl]);

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] w-full items-center justify-center rounded-md border border-gray-200 bg-gray-50">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !url) {
    return (
      <Alert
        variant="error"
        className="flex h-full min-h-[400px] w-full items-center justify-center"
      >
        {error ?? 'Preview unavailable'}
      </Alert>
    );
  }

  const isPdf = fileMimeType === 'application/pdf';

  return (
    <div className="flex h-full flex-col rounded-md border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="truncate text-xs text-gray-600" title={fileOriginalName}>
          {fileOriginalName}
        </span>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1 h-3 w-3" />
            Open
          </a>
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {isPdf ? (
          <embed
            src={url}
            type="application/pdf"
            className="h-full w-full min-h-[600px]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={fileOriginalName}
            className="h-full w-full object-contain"
          />
        )}
      </div>
    </div>
  );
}
