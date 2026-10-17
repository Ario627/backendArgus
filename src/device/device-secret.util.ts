import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ENVELOPE_VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const DEVICE_SECRET_BYTES = 32;
const HEX_PATTERN = /^[0-9a-f]+$/;

export const generateDeviceSecret = (): string =>
  randomBytes(DEVICE_SECRET_BYTES).toString('hex');

export const parseDeviceEncKey = (hexKey: string): Buffer => {
  if (!HEX_PATTERN.test(hexKey))
    throw new Error('DEVICE_SECRET_ENC_KEY_INVALID');
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new Error('DEVICE_SECRET_ENC_KEY_INVALID');
  }
  return key;
};

export const encryptDeviceSecret = (secret: string, key: Buffer): string => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secret, 'utf8'),
    cipher.final(),
  ]);
  return [
    ENVELOPE_VERSION,
    iv.toString('hex'),
    cipher.getAuthTag().toString('hex'),
    ciphertext.toString('hex'),
  ].join('.');
};

export const decryptDeviceSecret = (
  envelope: string,
  key: Buffer,
): string | null => {
  const parts = envelope.split('.');
  if (parts.length !== 4 || parts[0] !== ENVELOPE_VERSION) return null;
  const iv = Buffer.from(parts[1] ?? '', 'hex');
  const tag = Buffer.from(parts[2] ?? '', 'hex');
  const ciphertext = Buffer.from(parts[3] ?? '', 'hex');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) return null;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
};