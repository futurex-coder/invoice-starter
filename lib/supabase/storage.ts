import 'server-only';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client for Storage. Uses the service-role key
// because all storage access goes through our server actions / API routes
// (we authorize via session middleware, not RLS).

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const RECEIVED_INVOICES_BUCKET =
  process.env.SUPABASE_RECEIVED_INVOICES_BUCKET ?? 'received-invoices';

let cachedClient: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY environment variable is not set'
    );
  }
  cachedClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export async function uploadToBucket(input: {
  bucket: string;
  path: string;
  body: Uint8Array | Buffer;
  contentType: string;
}): Promise<void> {
  const { error } = await getClient()
    .storage.from(input.bucket)
    .upload(input.path, input.body, {
      contentType: input.contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

export async function downloadFromBucket(input: {
  bucket: string;
  path: string;
}): Promise<Buffer> {
  const { data, error } = await getClient()
    .storage.from(input.bucket)
    .download(input.path);
  if (error || !data) {
    throw new Error(
      `Storage download failed: ${error?.message ?? 'no data'}`
    );
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function createSignedUrl(input: {
  bucket: string;
  path: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const expiresIn = input.expiresInSeconds ?? 600; // 10 minutes default
  const { data, error } = await getClient()
    .storage.from(input.bucket)
    .createSignedUrl(input.path, expiresIn);
  if (error || !data) {
    throw new Error(`Failed to sign URL: ${error?.message ?? 'unknown'}`);
  }
  return data.signedUrl;
}

export async function deleteFromBucket(input: {
  bucket: string;
  path: string;
}): Promise<void> {
  const { error } = await getClient()
    .storage.from(input.bucket)
    .remove([input.path]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}

export function buildReceivedInvoiceObjectKey(input: {
  companyId: number;
  uuid: string;
  extension: string;
}): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = input.extension.startsWith('.')
    ? input.extension.slice(1)
    : input.extension;
  return `${input.companyId}/${yyyy}/${mm}/${input.uuid}.${ext}`;
}

export function extensionForMime(mime: string): string {
  switch (mime) {
    case 'application/pdf':
      return 'pdf';
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return 'bin';
  }
}
