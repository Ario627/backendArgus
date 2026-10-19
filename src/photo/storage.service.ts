import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfiguration } from '../config/configuration.js';
import { CloudinaryStorageProvider } from './storage-cloudinary.provider.js';
import { FilesystemStorageProvider } from './storage-filesystem.provider.js';
import { S3StorageProvider } from './storage-s3.provider.js';
import type { StorageProvider, StoredObject } from './storage.types.js';

const storageUnavailable = (): ServiceUnavailableException =>
  new ServiceUnavailableException({
    code: 'SYS_UNAVAILABLE',
    message: 'Penyimpanan foto sedang tidak tersedia',
  });

const SIGNATURE_PATTERN = /^[0-9a-f]{32}$/;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly provider: StorageProvider;
  private readonly publicApiUrl: string;
  private readonly urlSecret: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    const storage = config.storage;
    this.publicApiUrl = storage.publicApiUrl.replace(/\/+$/, '');
    this.urlSecret = storage.urlSecret;
    this.signedUrlTtlSeconds = storage.signedUrlTtlSeconds;
    this.provider = this.buildProvider(storage);
    this.logger.log(`penyimpanan foto: ${this.provider.name}`);
  }

  private buildProvider(storage: AppConfiguration['storage']): StorageProvider {
    if (storage.driver === 'cloudinary') {
      try {
        return new CloudinaryStorageProvider(storage);
      } catch (error) {
        this.logger.error(
          `Cloudinary tidak siap (${error instanceof Error ? error.message : 'UNKNOWN'}), memakai filesystem`,
        );
        return new FilesystemStorageProvider(storage.dir);
      }
    }
    if (storage.driver === 's3') return new S3StorageProvider(storage);
    return new FilesystemStorageProvider(storage.dir);
  }

  get driverName(): string {
    return this.provider.name;
  }

  async has(key: string): Promise<boolean> {
    try {
      return await this.provider.has(key);
    } catch {
      throw storageUnavailable();
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.provider.put(key, body, contentType);
    } catch (error) {
      this.logger.error(
        `gagal menyimpan foto (${error instanceof Error ? error.message : 'UNKNOWN'})`,
      );
      throw storageUnavailable();
    }
  }

  async get(key: string): Promise<StoredObject | null> {
    try {
      return await this.provider.get(key);
    } catch {
      throw storageUnavailable();
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.provider.delete(key);
    } catch {
      throw storageUnavailable();
    }
  }

  private signatureOf(key: string, expiresAt: number): string {
    return createHmac('sha256', this.urlSecret)
      .update(`${key}.${expiresAt}`)
      .digest('hex')
      .slice(0, 32);
  }

  verifySignature(key: string, expiresAt: number, signature: string): boolean {
    if (!SIGNATURE_PATTERN.test(signature)) return false;
    if (!Number.isFinite(expiresAt) || expiresAt * 1000 < Date.now())
      return false;
    const expected = Buffer.from(this.signatureOf(key, expiresAt), 'utf8');
    const received = Buffer.from(signature, 'utf8');
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }

  signedGetUrl(key: string): string {
    const expiresAt = Math.floor(Date.now() / 1000) + this.signedUrlTtlSeconds;
    const signature = this.signatureOf(key, expiresAt);
    return `${this.publicApiUrl}/photos/file/${key}?exp=${expiresAt}&sig=${signature}`;
  }
}
