import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { PHOTO_REF_TYPES, type PhotoRefType } from '../../common/constant/domain.constant.js';

const SHA256_HEX = /^[0-9a-f]{64}$/;

export class UploadPhotoDto {
  @Matches(SHA256_HEX, { message: 'sha256 harus 64 karakter heksadesimal' })
  readonly sha256!: string;

  @IsOptional()
  @IsIn(PHOTO_REF_TYPES)
  readonly refType?: PhotoRefType;

  @IsOptional()
  @IsUUID()
  readonly refId?: string;
}