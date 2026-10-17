import { NotFoundException, PayloadTooLargeException, UnprocessableEntityException } from '@nestjs/common';

export const photoRequiredError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PHOTO_REQUIRED',
    message: 'Berkas foto wajib dilampirkan pada field "file"',
  });

export const photoTooLargeError = (): PayloadTooLargeException =>
  new PayloadTooLargeException({
    code: 'PHOTO_TOO_LARGE',
    message: 'Foto terlalu besar (maks 1 MB)',
  });

export const photoHashMismatchError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PHOTO_HASH_MISMATCH',
    message: 'Unggahan rusak, coba lagi',
  });

export const photoFormatInvalidError = (detail: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PHOTO_FORMAT_INVALID',
    message: 'Format foto tidak didukung (hanya JPEG atau WebP)',
    details: [{ code: 'PHOTO_FORMAT', field: 'file' }, { code: detail.slice(0, 64) }],
  });

export const photoDimensionsInvalidError = (detail: string): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'PHOTO_DIMENSIONS_INVALID',
    message: 'Dimensi foto tidak wajar',
    details: [{ code: detail.slice(0, 64), field: 'file' }],
  });

export const photoNotFoundError = (): NotFoundException =>
  new NotFoundException({ code: 'PHOTO_NOT_FOUND', message: 'Foto tidak ditemukan' });