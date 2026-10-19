import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/types.js';
import { forbiddenActionError } from '../common/errors/http.errors.js';
import { safeHashEquals, sha256HexOfBytes } from '../common/utils/hash.util.js';
import { Batch } from '../database/entities/batch.entity.js';
import { LedgerEvent } from '../database/entities/ledger-event.entity.js';
import { Photo } from '../database/entities/photo.entity.js';
import { Ticket } from '../database/entities/ticket.entity.js';
import type { UploadPhotoDto } from './dto/upload-photo.dto.js';
import {
  photoDimensionsInvalidError,
  photoFormatInvalidError,
  photoHashMismatchError,
  photoNotFoundError,
  photoRequiredError,
  photoTooLargeError,
} from './photo.errors.js';
import { sanitizePhoto } from './photo-image.util.js';
import {
  toPhotoDto,
  type PhotoLinkDto,
  type PhotoUploadDto,
} from './photo.mapper.js';
import { StorageService } from './storage.service.js';

const AUDIT_ROLES: ReadonlySet<string> = new Set(['admin', 'dlh_auditor']);

@Injectable()
export class PhotoService {
  constructor(
    @InjectRepository(Photo)
    private readonly photoRepository: Repository<Photo>,
    @InjectRepository(Batch)
    private readonly batchRepository: Repository<Batch>,
    @InjectRepository(LedgerEvent)
    private readonly ledgerEventRepository: Repository<LedgerEvent>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly storageService: StorageService,
  ) {}

  async upload(
    file: Express.Multer.File | undefined,
    dto: UploadPhotoDto,
    actor: AuthenticatedUser,
    maxBytes: number,
  ): Promise<PhotoUploadDto> {
    if (file === undefined || file.buffer.length === 0) {
      throw photoRequiredError();
    }
    if (file.buffer.length > maxBytes) {
      throw photoTooLargeError();
    }

    const receivedHash = sha256HexOfBytes(file.buffer);
    if (!safeHashEquals(receivedHash, dto.sha256)) {
      throw photoHashMismatchError();
    }

    const sanitized = await sanitizePhoto(file.buffer, maxBytes);
    if (!sanitized.ok) {
      if (sanitized.code === 'PHOTO_TOO_LARGE') throw photoTooLargeError();
      if (sanitized.code === 'PHOTO_DIMENSIONS_INVALID')
        throw photoDimensionsInvalidError(sanitized.detail);
      throw photoFormatInvalidError(sanitized.detail);
    }

    const storedHash = sha256HexOfBytes(sanitized.photo.buffer);
    if (!(await this.storageService.has(storedHash))) {
      await this.storageService.put(
        storedHash,
        sanitized.photo.buffer,
        sanitized.photo.mime,
      );
    }

    const refType = dto.refType ?? 'lainnya';
    const refId = dto.refType === undefined ? null : (dto.refId ?? null);
    await this.photoRepository.query(
      `INSERT INTO foto (sha256, mime, bytes, lebar, tinggi, diunggah_oleh, ref_tipe, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (sha256) DO NOTHING`,
      [
        storedHash,
        sanitized.photo.mime,
        sanitized.photo.buffer.length,
        sanitized.photo.width,
        sanitized.photo.height,
        actor.id,
        refType,
        refId,
      ],
    );

    const row = await this.photoRepository.findOne({
      where: { sha256: storedHash },
    });
    if (row === null) throw photoNotFoundError();

    return {
      ...toPhotoDto(row),
      receivedSha256: receivedHash,
      url: this.storageService.signedGetUrl(storedHash),
    };
  }

  async getSignedUrl(
    sha256: string,
    actor: AuthenticatedUser,
  ): Promise<PhotoLinkDto> {
    const photo = await this.photoRepository.findOne({ where: { sha256 } });
    if (photo === null) throw photoNotFoundError();
    await this.assertViewable(photo, actor);
    return {
      ...toPhotoDto(photo),
      url: this.storageService.signedGetUrl(photo.sha256),
    };
  }

  async readFile(
    sha256: string,
  ): Promise<{ body: Buffer; contentType: string }> {
    const stored = await this.storageService.get(sha256);
    if (stored === null) throw photoNotFoundError();
    return {
      body: stored.body,
      contentType: stored.contentType ?? 'application/octet-stream',
    };
  }

  private async assertViewable(
    photo: Photo,
    actor: AuthenticatedUser,
  ): Promise<void> {
    if (AUDIT_ROLES.has(actor.role)) return;

    if (photo.refTipe === 'batch' || photo.refTipe === 'ledger_event') {
      const batchId =
        photo.refTipe === 'batch'
          ? photo.refId
          : ((
              await this.ledgerEventRepository.findOne({
                where: { id: Number(photo.refId ?? 0) },
              })
            )?.batchId ?? null);
      if (batchId === null) throw forbiddenActionError();
      const batch = await this.batchRepository.findOne({
        where: { id: batchId },
      });
      if (batch === null) throw forbiddenActionError();
      if (actor.role === 'sppg_staff' && actor.sppgId === batch.sppgId) return;
      throw forbiddenActionError();
    }

    if (photo.refTipe === 'tiket') {
      if (photo.refId === null) throw forbiddenActionError();
      const ticket = await this.ticketRepository.findOne({
        where: { id: photo.refId },
      });
      if (ticket === null) throw forbiddenActionError();
      if (actor.role === 'sppg_staff' && actor.sppgId === ticket.sppgId) {
        return;
      }
      throw forbiddenActionError();
    }

    throw forbiddenActionError();
  }
}
