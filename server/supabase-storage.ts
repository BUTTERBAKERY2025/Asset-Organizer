import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.SUPABASE_URL;
const supabaseUrl = rawSupabaseUrl
  ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
  : undefined;
// Never use the anon key for server-side attachment operations. A private
// bucket alone does not prevent broad storage.objects policies from granting
// anon access; production must also remove those policies (see staged SQL).
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password
      && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

const hasValidCredentials = isValidUrl(supabaseUrl) && !!supabaseKey;

if (!hasValidCredentials) {
  console.warn('Supabase attachment storage unavailable: configure SUPABASE_URL and server-only SUPABASE_SERVICE_ROLE_KEY. Anon credentials are not accepted.');
}

let supabase: SupabaseClient | null = null;
if (hasValidCredentials) {
  try {
    supabase = createClient(supabaseUrl!, supabaseKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } catch {
    console.error('Failed to create Supabase attachment client (invalid configuration).');
    supabase = null;
  }
}

export { supabase };

export const DOCUMENTS_BUCKET = 'documents';

export async function ensureBucketExists(): Promise<boolean> {
  // Provisioning is an explicit deployment step, not a side effect of startup.
  return isDocumentsBucketPrivate();
}

export async function uploadToSupabase(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ path: string; storedPath: string } | null> {
  if (!supabase) {
    console.error('Supabase upload unavailable: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    return null;
  }
  if (!await isDocumentsBucketPrivate()) {
    console.error('Supabase upload refused: documents bucket is missing, public, or its privacy cannot be verified.');
    return null;
  }
  
  try {
    const crypto = await import('crypto');
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, '_').substring(0, 100);
    const uniqueFilename = `${baseName}_${timestamp}_${randomSuffix}.${ext}`;
    
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(uniqueFilename, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase upload failed: storage rejected the write (check service role, bucket configuration, and allowed file type).');
      return null;
    }
    
    return {
      path: uniqueFilename,
      storedPath: data.path,
    };
  } catch {
    console.error('Supabase upload failed: storage request could not complete.');
    return null;
  }
}

export async function downloadFromSupabase(
  filename: string
): Promise<{ data: Blob; mimeType: string } | null> {
  if (!supabase || !await isDocumentsBucketPrivate()) return null;
  
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(filename);
    
    if (error) {
      if (error.message?.includes('not found') || error.message?.includes('Object not found')) {
        return null;
      }
      console.error('Supabase download failed.');
      return null;
    }
    
    return {
      data,
      mimeType: data.type,
    };
  } catch {
    console.error('Supabase download request failed.');
    return null;
  }
}

export async function deleteFromSupabase(filename: string): Promise<boolean> {
  if (!supabase || !await isDocumentsBucketPrivate()) return false;
  
  try {
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([filename]);
    
    if (error) {
      console.error('Supabase delete failed.');
      return false;
    }
    
    return true;
  } catch {
    console.error('Supabase delete request failed.');
    return false;
  }
}

/**
 * Recovery helper for legacy `journal_attachments.file_path` values that were
 * saved before the storedPath fix. Those rows hold a path like
 * `cashier-journals/4/123-456.jpg` but the actual object in the bucket was
 * uploaded as `cashier-journals_4_123-456_<TS>_<RAND>.jpg` (slashes replaced
 * with underscores + uniqueness suffix). This finds the most recent object
 * whose name starts with the given sanitized prefix so the proxy endpoint
 * can still serve the original image without a manual backfill.
 */
export async function findLegacyMatch(
  sanitizedBase: string,
  ext: string,
): Promise<string | null> {
  if (!supabase || !sanitizedBase || !ext || !await isDocumentsBucketPrivate()) return null;
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .list('', {
        limit: 100,
        search: sanitizedBase,
        sortBy: { column: 'created_at', order: 'desc' },
      });
    if (error) {
      console.warn('Supabase legacy attachment lookup failed.');
      return null;
    }
    if (!data || data.length === 0) return null;
    // Strict suffix contract of uploadToSupabase: `${base}_${13-digit-ts}_${8-hex}.${ext}`.
    // Anchored regex avoids cross-record collisions (`abc` matching `abcd_…`)
    // so the proxy never serves a different journal's file by accident.
    const escapedBase = sanitizedBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escapedExt = ext.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`^${escapedBase}_\\d{13}_[a-f0-9]{8}\\.${escapedExt}$`, 'i');
    const match = data.find((f) => typeof f.name === 'string' && re.test(f.name));
    return match?.name ?? null;
  } catch {
    console.warn('Supabase legacy attachment lookup request failed.');
    return null;
  }
}

export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}

// Security-sensitive callers can fail closed when the shared documents bucket
// cannot be proven private. This never creates or changes bucket policy.
export async function isDocumentsBucketPrivate(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { data, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Supabase documents bucket privacy check failed: bucket metadata unavailable.');
      return false;
    }
    const bucket = data?.find((candidate) => candidate.id === DOCUMENTS_BUCKET && candidate.name === DOCUMENTS_BUCKET);
    if (!bucket || bucket.public !== false) {
      console.error('Supabase documents bucket privacy check failed: expected an existing private documents bucket.');
      return false;
    }
    return true;
  } catch {
    console.error('Supabase documents bucket privacy check failed: bucket metadata request failed.');
    return false;
  }
}
