'use client';

import { useCallback, useRef, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const ACCEPTED = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;
const ACCEPT_ATTR = ACCEPTED.join(',');

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const COMPRESS_LONG_EDGE = 2400;
const COMPRESS_QUALITY = 0.75;

type FileState =
  | { phase: 'queued' }
  | { phase: 'compressing' }
  | { phase: 'uploading' }
  | { phase: 'done'; receivedInvoiceId: number }
  | { phase: 'error'; message: string };

interface QueuedFile {
  id: string;
  file: File; // Possibly compressed.
  originalName: string;
  state: FileState;
}

interface UploadedItem {
  receivedInvoiceId: number;
  originalName: string;
}

interface Props {
  className?: string;
  onAllUploaded?: (uploaded: UploadedItem[]) => void;
}

function isImage(type: string): boolean {
  return type.startsWith('image/') && type !== 'image/svg+xml';
}

async function compressImage(file: File): Promise<File> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Failed to decode image'));
    el.src = dataUrl;
  });

  const longEdge = Math.max(img.width, img.height);
  const scale = longEdge > COMPRESS_LONG_EDGE ? COMPRESS_LONG_EDGE / longEdge : 1;
  const targetW = Math.round(img.width * scale);
  const targetH = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');
  ctx.drawImage(img, 0, 0, targetW, targetH);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', COMPRESS_QUALITY);
  });
  if (!blob) throw new Error('Compression failed');

  // If compression somehow makes it bigger, keep the original.
  if (blob.size >= file.size) return file;

  const baseName = file.name.replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.webp`, {
    type: 'image/webp',
    lastModified: Date.now(),
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

interface UploadResponseShape {
  data?: { id: number; duplicates: unknown[] };
  error?: string;
}

function isUploadResponse(v: unknown): v is UploadResponseShape {
  return typeof v === 'object' && v !== null;
}

export function ReceivedInvoiceUploader({ className, onAllUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<QueuedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const updateItem = useCallback(
    (id: string, patch: Partial<QueuedFile>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it))
      );
    },
    []
  );

  const processOne = useCallback(
    async (queued: QueuedFile): Promise<UploadedItem | null> => {
      try {
        let file = queued.file;
        if (isImage(file.type)) {
          updateItem(queued.id, { state: { phase: 'compressing' } });
          file = await compressImage(file);
        }

        if (file.size > MAX_BYTES) {
          updateItem(queued.id, {
            state: {
              phase: 'error',
              message: 'File still exceeds 10 MB after compression',
            },
          });
          return null;
        }

        updateItem(queued.id, { state: { phase: 'uploading' }, file });

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/received-invoices/upload', {
          method: 'POST',
          body: formData,
        });
        const json: unknown = await res.json();

        if (!res.ok) {
          const err =
            isUploadResponse(json) && typeof json.error === 'string'
              ? json.error
              : `Upload failed (${res.status})`;
          updateItem(queued.id, { state: { phase: 'error', message: err } });
          return null;
        }

        if (
          !isUploadResponse(json) ||
          !json.data ||
          typeof json.data.id !== 'number'
        ) {
          updateItem(queued.id, {
            state: { phase: 'error', message: 'Unexpected server response' },
          });
          return null;
        }

        updateItem(queued.id, {
          state: { phase: 'done', receivedInvoiceId: json.data.id },
        });
        return {
          receivedInvoiceId: json.data.id,
          originalName: queued.originalName,
        };
      } catch (e) {
        updateItem(queued.id, {
          state: {
            phase: 'error',
            message: e instanceof Error ? e.message : 'Network error',
          },
        });
        return null;
      }
    },
    [updateItem]
  );

  const handleFiles = useCallback(
    async (selected: File[]) => {
      const accepted = selected.filter((f) =>
        (ACCEPTED as readonly string[]).includes(f.type)
      );

      if (accepted.length === 0) return;

      const queued: QueuedFile[] = accepted.map((f) => ({
        id: `${f.name}-${f.size}-${Date.now()}-${Math.random()}`,
        file: f,
        originalName: f.name,
        state: { phase: 'queued' },
      }));

      setItems((prev) => [...prev, ...queued]);
      setBusy(true);

      // ASYNC-SCAN: uploads are store-only + fast now (no AI call here), so run
      // them in parallel. Analysis is kicked off later, from the list page.
      const results = await Promise.all(queued.map((q) => processOne(q)));
      const uploaded = results.filter((r): r is UploadedItem => r !== null);

      setBusy(false);
      if (uploaded.length > 0) onAllUploaded?.(uploaded);
    },
    [onAllUploaded, processOne]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length > 0) void handleFiles(files);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length > 0) void handleFiles(files);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div
        className={cn(
          'rounded-lg border border-dashed transition-colors',
          dragOver
            ? 'border-primary/40 bg-primary/5'
            : 'border-gray-300 bg-gray-50'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          onChange={onInputChange}
          className="hidden"
          disabled={busy}
        />
        <button
          type="button"
          onClick={() => !busy && inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-2 p-8 text-center text-gray-600 transition-colors hover:text-gray-900 disabled:opacity-50"
        >
          <Upload className="h-7 w-7 text-gray-400" />
          <div className="text-sm">
            <span className="font-medium text-gray-900">Click to upload</span>
            <span className="text-gray-500"> or drag and drop</span>
          </div>
          <p className="text-xs text-gray-500">
            PDF, JPG, PNG, WebP — up to 10 MB each. Multiple files supported.
          </p>
        </button>
      </div>

      {items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <UploaderRow
              key={it.id}
              item={it}
              onRemove={() => removeItem(it.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function UploaderRow({
  item,
  onRemove,
}: {
  item: QueuedFile;
  onRemove: () => void;
}) {
  const phase = item.state.phase;
  return (
    <li className="flex items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2">
      <FileText className="h-4 w-4 shrink-0 text-gray-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={item.originalName}>
          {item.originalName}
        </p>
        <p className="text-xs text-gray-500">{formatBytes(item.file.size)}</p>
      </div>
      <div className="text-xs">
        {phase === 'queued' && <span className="text-gray-500">Queued</span>}
        {phase === 'compressing' && (
          <span className="inline-flex items-center gap-1 text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Compressing
          </span>
        )}
        {phase === 'uploading' && (
          <span className="inline-flex items-center gap-1 text-gray-600">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading
          </span>
        )}
        {phase === 'done' && (
          <span className="inline-flex items-center gap-1 text-green-700">
            <CheckCircle2 className="h-3 w-3" />
            Uploaded
          </span>
        )}
        {phase === 'error' && (
          <span className="text-red-700" title={item.state.message}>
            {item.state.message}
          </span>
        )}
      </div>
      {(phase === 'queued' || phase === 'error' || phase === 'done') && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Remove"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}
