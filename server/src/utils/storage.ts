import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'node:path';

const R2_ENDPOINT = process.env.R2_ENDPOINT || '';
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || '';
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || '';
const R2_BUCKET = process.env.R2_BUCKET || 'studiosage';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || ''; // e.g. https://cdn.studiosa.ge

const r2 = R2_ENDPOINT ? new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY,
    secretAccessKey: R2_SECRET_KEY,
  },
  forcePathStyle: true,
}) : null;

export function isR2Enabled(): boolean {
  return !!r2;
}

export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // Fallback: use local /uploads path
  return `/uploads/${key}`;
}

/**
 * Upload a buffer to R2
 */
export async function uploadToR2(
  key: string,
  data: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const bytes = data instanceof Buffer
    ? new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength))
    : data;

  if (!r2) {
    const fs = await import('node:fs');
    const localPath = path.join(process.cwd(), 'data', 'uploads', key);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, bytes);
    return getPublicUrl(key);
  }

  // eslint-disable-next-line
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: bytes as unknown as Uint8Array,
    ContentType: contentType,
  });
  await r2.send(cmd);

  return getPublicUrl(key);
}

/**
 * Delete a file from R2
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!r2) {
    const fs = await import('node:fs');
    const localPath = path.join(process.cwd(), 'data', 'uploads', key);
    try { fs.unlinkSync(localPath); } catch {}
    return;
  }

  try {
    await r2.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }));
  } catch {}
}

/**
 * Generate a pre-signed upload URL (for direct browser upload — future use)
 */
export async function getPresignedUploadUrl(key: string, contentType: string): Promise<string> {
  if (!r2) return '';
  return getSignedUrl(r2, new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  }), { expiresIn: 3600 });
}
