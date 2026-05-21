import { createClient, SupabaseClient } from '@supabase/supabase-js';

const rawSupabaseUrl = process.env.SUPABASE_URL;
const supabaseUrl = rawSupabaseUrl
  ? rawSupabaseUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '')
  : undefined;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

function isValidUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const hasValidCredentials = isValidUrl(supabaseUrl) && !!supabaseKey;

if (!hasValidCredentials) {
  console.warn('Supabase credentials not found or invalid. File upload/download will be unavailable until SUPABASE_URL and SUPABASE_ANON_KEY are configured.');
}

let supabase: SupabaseClient | null = null;
if (hasValidCredentials) {
  try {
    supabase = createClient(supabaseUrl!, supabaseKey!);
  } catch (error) {
    console.error('Failed to create Supabase client:', error);
    supabase = null;
  }
}

export { supabase };

export const DOCUMENTS_BUCKET = 'documents';

export async function ensureBucketExists(): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === DOCUMENTS_BUCKET);
    
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(DOCUMENTS_BUCKET, {
        public: false,
        fileSizeLimit: 52428800, // 50MB
        allowedMimeTypes: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'text/plain',
          'text/csv',
          'application/zip',
          'application/x-rar-compressed',
        ],
      });
      
      if (error) {
        console.error('Error creating bucket:', error);
        return false;
      }
      console.log('Documents bucket created successfully');
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring bucket exists:', error);
    return false;
  }
}

export async function uploadToSupabase(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<{ path: string; storedPath: string } | null> {
  if (!supabase) {
    console.error('Supabase client not initialized - check SUPABASE_URL and SUPABASE_ANON_KEY');
    return null;
  }
  
  try {
    const crypto = await import('crypto');
    const timestamp = Date.now();
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const ext = filename.split('.').pop()?.toLowerCase() || 'bin';
    const baseName = filename.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\u0600-\u06FF._-]/g, '_').substring(0, 100);
    const uniqueFilename = `${baseName}_${timestamp}_${randomSuffix}.${ext}`;
    
    console.log('Uploading to Supabase:', { originalFilename: filename, uniqueFilename, mimeType, bufferSize: buffer.length });
    
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(uniqueFilename, buffer, {
        contentType: mimeType,
        upsert: false,
      });
    
    if (error) {
      console.error('Supabase upload error:', error.message, error);
      return null;
    }
    
    console.log('Supabase upload success:', data.path);
    
    return {
      path: uniqueFilename,
      storedPath: data.path,
    };
  } catch (error) {
    console.error('Error uploading to Supabase:', error);
    return null;
  }
}

export async function downloadFromSupabase(
  filename: string
): Promise<{ data: Blob; mimeType: string } | null> {
  if (!supabase) return null;
  
  try {
    console.log('Downloading from Supabase:', filename);
    
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(filename);
    
    if (error) {
      if (error.message?.includes('not found') || error.message?.includes('Object not found')) {
        console.log('File not found in Supabase:', filename);
        return null;
      }
      console.error('Supabase download error:', error);
      return null;
    }
    
    return {
      data,
      mimeType: data.type,
    };
  } catch (error) {
    console.error('Error downloading from Supabase:', error);
    return null;
  }
}

export async function deleteFromSupabase(filename: string): Promise<boolean> {
  if (!supabase) return false;
  
  try {
    console.log('Deleting from Supabase:', filename);
    
    const { error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .remove([filename]);
    
    if (error) {
      console.error('Supabase delete error:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    return false;
  }
}

export function isSupabaseAvailable(): boolean {
  return supabase !== null;
}
