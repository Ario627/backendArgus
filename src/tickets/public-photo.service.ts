import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { sha256HexOfBytes } from '../common/utils/hash.util.js';
import type { AppConfiguration } from '../config/configuration.js';
import { Photo } from '../database/entities/photo.entity.js';
import {
  photoDimensionsInvalidError,
  photoFormatInvalidError,
  photoRequiredError,
  photoTooLargeError,
} from '../photo/photo.errors.js';
import { sanitizePhoto } from '../photo/photo-image.util.js';
import { StorageService } from '../photo/storage.service.js';

export interface PublicPhotoResult {
  readonly fotoHash: string;
  readonly duplicate: boolean;
}

@Injectable()
export class PublicPhotoService {
  private readonly logger = new Logger(PublicPhotoService.name);
  private readonly maxBytes: number;

  constructor(
    configService: ConfigService,
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    private readonly storageService: StorageService,
  ) {
    const config = configService.getOrThrow<AppConfiguration>('app');
    this.maxBytes = config.storage.photoMaxBytes;
  }

  async upload(
    file: Express.Multer.File | undefined,
  ): Promise<PublicPhotoResult> {
    if (file === undefined || file.buffer.length === 0) {
      throw photoRequiredError();
    }
    if (file.buffer.length > this.maxBytes) {
      throw photoTooLargeError();
    }
    const sanitized = await sanitizePhoto(file.buffer, this.maxBytes);
    if (!sanitized.ok) {
      if (sanitized.code === 'PHOTO_TOO_LARGE') throw photoTooLargeError();
      if (sanitized.code === 'PHOTO_DIMENSIONS_INVALID') {
        throw photoDimensionsInvalidError(sanitized.detail);
      }
      throw photoFormatInvalidError(sanitized.detail);
    }

    const storedHash = sha256HexOfBytes(sanitized.photo.buffer);
    const existing = await this.photoRepository.findOne({
      where: { sha256: storedHash },
    });
    if (!(await this.storageService.has(storedHash))) {
      await this.storageService.put(
        storedHash,
        sanitized.photo.buffer,
        sanitized.photo.mime,
      );
    }
    await this.photoRepository.query(
      `INSERT INTO foto (sha256, mime, bytes, lebar, tinggi, diunggah_oleh, ref_tipe, ref_id)
       VALUES ($1, $2, $3, $4, $5, NULL, 'tiket', NULL)
       ON CONFLICT (sha256) DO NOTHING`,
      [
        storedHash,
        sanitized.photo.mime,
        sanitized.photo.buffer.length,
        sanitized.photo.width,
        sanitized.photo.height,
      ],
    );
    this.logger.log(
      `foto publik tersimpan sha256=${storedHash.slice(0, 12)} duplikat=${existing !== null}`,
    );
    return { fotoHash: storedHash, duplicate: existing !== null };
  }
}