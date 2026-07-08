'use client';

import { useEffect, useState } from 'react';
import {
  Loader2,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

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
  // RV-1 slice: image zoom (PDFs zoom natively in the embed) + mobile collapse.
  const [zoom, setZoom] = useState(1);
  const [collapsed, setCollapsed] = useState(false);

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
      <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
        <span className="truncate text-xs text-gray-600" title={fileOriginalName}>
          {fileOriginalName}
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          {!isPdf && !collapsed && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                aria-label="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-[11px] tabular-nums text-gray-500">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                aria-label="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 px-0"
                onClick={() => setZoom(1)}
                aria-label="Reset zoom"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
          {/* RV-1 (mobile): the document pane collapses so the form gets the
              screen; desktop always shows it. */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 lg:hidden"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Show document' : 'Hide document'}
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-7 px-2">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1 h-3 w-3" />
              Open
            </a>
          </Button>
        </div>
      </div>
      <div className={cn('flex-1 overflow-hidden', collapsed && 'hidden lg:block')}>
        {isPdf ? (
          <embed
            src={url}
            type="application/pdf"
            className="h-full w-full min-h-[400px] lg:min-h-[600px]"
          />
        ) : (
          <div className="h-full max-h-[75vh] min-h-[300px] overflow-auto lg:max-h-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={fileOriginalName}
              style={{ width: `${zoom * 100}%` }}
              className={cn('max-w-none', zoom === 1 && 'h-full w-full object-contain')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
