import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const BUCKET_NAME = 'plan-files';

export async function uploadFile(file: File): Promise<{ fileId: string; fileUrl: string }> {
  const fileId = crypto.randomUUID();
  const fileName = `${fileId}.pdf`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      contentType: 'application/pdf',
      cacheControl: '3600',
    });

  if (error) {
    console.error('Supabase upload error:', error);
    throw new Error('Failed to upload file to storage');
  }

  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(fileName);

  return {
    fileId,
    fileUrl: urlData.publicUrl,
  };
}

export async function deleteFile(fileId: string): Promise<void> {
  const fileName = `${fileId}.pdf`;

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([fileName]);

  if (error) {
    console.error('Supabase delete error:', error);
    throw new Error('Failed to delete file');
  }
}
