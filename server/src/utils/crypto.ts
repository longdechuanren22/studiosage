import bcryptjs from 'bcryptjs';
import crypto from 'node:crypto';

const SALT_ROUNDS = 10;
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/** Hash a password with bcryptjs */
export async function hashPassword(password: string): Promise<string> {
  return bcryptjs.hash(password, SALT_ROUNDS);
}

/** Compare a plaintext password against a hash */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcryptjs.compare(password, hash);
}

/** Get the encryption key (32 bytes for AES-256). Requires ENCRYPTION_KEY env var. */
function getEncryptionKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey || envKey.length < 32) {
    throw new Error(
      'ENCRYPTION_KEY environment variable must be set and at least 32 characters long. ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(envKey.slice(0, 32), 'utf-8');
}

// Helper: work around Node v24 Buffer/Uint8Array type incompatibility
// @ts-ignore — Buffer works at runtime but @types/node v24 has strict Uint8Array
const cciv: any = crypto.createCipheriv;
const cdiv: any = crypto.createDecipheriv;

/** Encrypt a string with AES-256-GCM. Returns base64-encoded ciphertext. */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = cciv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()] as any);
  const tag: Buffer = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted] as any).toString('base64');
}

/** Decrypt a base64-encoded ciphertext back to plaintext */
export function decrypt(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = cdiv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()] as any).toString('utf-8');
}
