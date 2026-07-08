import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'plan-files';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { fileId } = req.query;

  if (typeof fileId !== 'string') {
    return res.status(400).json({ error: 'Invalid file ID' });
  }

  const fileName = `${fileId}.pdf`;

  if (req.method === 'GET') {
    const { data } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    return res.redirect(302, data.publicUrl);
  }

  if (req.method === 'DELETE') {
    try {
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([fileName]);

      if (error) {
        console.error('Supabase delete error:', error);
        return res.status(500).json({ error: 'Failed to delete file' });
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Delete error:', error);
      return res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
