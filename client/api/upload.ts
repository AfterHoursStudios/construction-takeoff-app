import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { randomUUID } from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);
const BUCKET_NAME = 'plan-files';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function parseMultipartForm(req: VercelRequest): Promise<{ buffer: Buffer; originalname: string }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const contentType = req.headers['content-type'] || '';
      const boundary = contentType.split('boundary=')[1];

      if (!boundary) {
        reject(new Error('No boundary found in content-type'));
        return;
      }

      const boundaryBuffer = Buffer.from(`--${boundary}`);
      const parts = [];
      let start = 0;
      let idx = buffer.indexOf(boundaryBuffer, start);

      while (idx !== -1) {
        if (start > 0) {
          parts.push(buffer.slice(start, idx - 2)); // -2 for \r\n before boundary
        }
        start = idx + boundaryBuffer.length + 2; // +2 for \r\n after boundary
        idx = buffer.indexOf(boundaryBuffer, start);
      }

      for (const part of parts) {
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;

        const headerStr = part.slice(0, headerEnd).toString();
        const body = part.slice(headerEnd + 4);

        if (headerStr.includes('filename=')) {
          const filenameMatch = headerStr.match(/filename="([^"]+)"/);
          const originalname = filenameMatch ? filenameMatch[1] : 'unknown.pdf';
          resolve({ buffer: body, originalname });
          return;
        }
      }

      reject(new Error('No file found in form data'));
    });

    req.on('error', reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { buffer, originalname } = await parseMultipartForm(req);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (buffer.length > 100 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Maximum size is 100MB.' });
    }

    const fileId = randomUUID();
    const fileName = `${fileId}.pdf`;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        cacheControl: '3600',
      });

    if (error) {
      console.error('Supabase upload error:', error);
      return res.status(500).json({ error: 'Failed to upload file to storage' });
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    res.json({
      success: true,
      fileId,
      fileName: originalname,
      fileUrl: urlData.publicUrl,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
}
