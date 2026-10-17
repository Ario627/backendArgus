import type { PhotoMimeType, PhotoRefType } from '../common/constant/domain.constant.js';
import type { Photo } from '../database/entities/photo.entity.js';

export interface PhotoDto {
  readonly sha256: string;
  readonly mime: PhotoMimeType;
  readonly bytes: number;
  readonly width: number | null;
  readonly height: number | null;
  readonly refType: PhotoRefType;
  readonly refId: string | null;
  readonly createdAt: string;
}

export interface PhotoUploadDto extends PhotoDto {
  readonly receivedSha256: string;
  readonly url: string;
}

export interface PhotoLinkDto extends PhotoDto {
  readonly url: string;
}

export const toPhotoDto = (photo: Photo): PhotoDto => ({
  sha256: photo.sha256,
  mime: photo.mime,
  bytes: photo.bytes,
  width: photo.lebar,
  height: photo.tinggi,
  refType: photo.refTipe,
  refId: photo.refId,
  createdAt: photo.createdAt.toISOString(),
});