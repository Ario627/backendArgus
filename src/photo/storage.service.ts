import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AppConfiguration } from '../config/configuration.js';

const PHOTO_CACHE_CONTROL = 'private, max-age=3600';

const isNotFound = (error: unknown): boolean => {
  if (error === null || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  if (record.name === 'NotFound' || record.name === 'NoSuchKey') return true;
  const metadata = record.$metadata;
  if (metadata !== null && typeof metadata === 'object') {
    return (metadata as Record<string, unknown>).httpStatusCode === 404;
  }
  return false;
};

const storageUnavailable = (): ServiceUnavailableException =>
  new ServiceUnavailableException({
    code: 'SYS_UNAVAILABLE',
    message: 'Penyimpanan foto sedang tidak tersedia',
  });

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(configService: ConfigService) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.bucket = config.storage.bucket;
    this.signedUrlTtlSeconds = config.storage.signedUrlTtlSeconds;
    this.client = new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
      forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  async has(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw storageUnavailable();
    }
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          CacheControl: PHOTO_CACHE_CONTROL,
        }),
      );
    } catch {
      throw storageUnavailable();
    }
  }

  async signedGetUrl(key: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        { expiresIn: this.signedUrlTtlSeconds },
      );
    } catch {
      throw storageUnavailable();
    }
  }
}