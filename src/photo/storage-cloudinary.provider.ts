import { createHash } from 'node:crypto';
import type { AppConfiguration } from '../config/configuration.js';
import type { StorageProvider, StoredObject } from './storage.types.js';

const EXTENSION_OF: Readonly<Record<string, string>> = Object.freeze({
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
});

const sha1Hex = (value: string): string =>
  createHash('sha1').update(value).digest('hex');

const signParams = (
  params: Readonly<Record<string, string>>,
  apiSecret: string,
): string => {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key] ?? ''}`)
    .join('&');
  return sha1Hex(`${payload}${apiSecret}`);
};

const deliverySignature = (publicId: string, apiSecret: string): string =>
  createHash('sha1')
    .update(`${publicId}${apiSecret}`)
    .digest('base64url')
    .slice(0, 8);

interface CloudinaryUploadResponse {
  readonly public_id?: unknown;
  readonly secure_url?: unknown;
}

export class CloudinaryStorageProvider implements StorageProvider {
  readonly name = 'cloudinary' as const;
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly folder: string;

  constructor(config: AppConfiguration['storage']) {
    const { cloudName, apiKey, apiSecret, folder } = config.cloudinary;
    if (cloudName === null || apiKey === null || apiSecret === null) {
      throw new Error('STORAGE_CLOUDINARY_CONFIG_MISSING');
    }
    this.cloudName = cloudName;
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.folder = folder.replace(/^\/+|\/+$/g, '');
  }

  private publicIdOf(key: string): string {
    return this.folder.length === 0 ? key : `${this.folder}/${key}`;
  }

  private deliveryUrl(key: string, contentType: string | null): string {
    const publicId = this.publicIdOf(key);
    const signature = deliverySignature(publicId, this.apiSecret);
    const extension = valueOr(EXTENSION_OF[contentType ?? ''], 'webp');
    return `https://res.cloudinary.com/${this.cloudName}/image/authenticated/s--${signature}--/${publicId}.${extension}`;
  }

  async has(key: string): Promise<boolean> {
    const response = await fetch(this.deliveryUrl(key, null), {
      method: 'HEAD',
    });
    return response.ok;
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      public_id: this.publicIdOf(key),
      timestamp,
      type: 'authenticated',
    };
    const signature = signParams(params, this.apiSecret);

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(body)], { type: contentType }),
      `${key}.${valueOr(EXTENSION_OF[contentType], 'bin')}`,
    );
    form.append('api_key', this.apiKey);
    form.append('public_id', params['public_id'] ?? '');
    form.append('timestamp', timestamp);
    form.append('type', 'authenticated');
    form.append('signature', signature);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      { method: 'POST', body: form },
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `CLOUDINARY_UPLOAD_FAILED ${response.status} ${detail.slice(0, 180)}`,
      );
    }
    const payload = (await response.json()) as CloudinaryUploadResponse;
    if (typeof payload.public_id !== 'string') {
      throw new Error('CLOUDINARY_UPLOAD_INVALID');
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    for (const contentType of ['image/webp', 'image/jpeg'] as const) {
      const response = await fetch(this.deliveryUrl(key, contentType));
      if (!response.ok) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      return {
        body: buffer,
        contentType: response.headers.get('content-type') ?? contentType,
      };
    }
    return null;
  }

  async delete(key: string): Promise<void> {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const params: Record<string, string> = {
      public_id: this.publicIdOf(key),
      timestamp,
      type: 'authenticated',
      invalidate: 'true',
    };
    const signature = signParams(params, this.apiSecret);
    const form = new FormData();
    for (const [name, value] of Object.entries(params))
      form.append(name, value);
    form.append('api_key', this.apiKey);
    form.append('signature', signature);
    await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/image/destroy`,
      {
        method: 'POST',
        body: form,
      },
    ).catch(() => undefined);
  }
}

const valueOr = <T>(value: T | undefined, fallback: T): T =>
  value === undefined ? fallback : value;
