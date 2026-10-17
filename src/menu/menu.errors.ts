import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ApiErrorDetail } from '../common/types.js';

export const menuItemNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'MENU_ITEM_NOT_FOUND',
    message: 'Item menu tidak ditemukan',
  });

export const menuItemInactiveError = (): ConflictException =>
  new ConflictException({
    code: 'MENU_ITEM_INACTIVE',
    message: 'Item menu sudah tidak aktif',
  });

export const menuServingNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'MENU_SERVING_NOT_FOUND',
    message: 'Catatan menu harian tidak ditemukan',
  });

export const menuObsInvalidError = (
  details: readonly ApiErrorDetail[],
): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'MENU_OBS_INVALID',
    message: 'Skala sisa 0-4, jumlah porsi > 0',
    details,
  });

export const menuSppgRequiredError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'MENU_SPPG_REQUIRED',
    message: 'Sertakan sppgId untuk tindakan ini',
    details: [{ code: 'isRequired', field: 'sppgId' }],
  });

export const menuDateInFutureError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'MENU_DATE_IN_FUTURE',
    message: 'Tanggal tidak boleh di masa depan',
  });

export const menuRangeInvalidError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'MENU_RANGE_INVALID',
    message: 'Rentang tanggal tidak valid',
    details: [{ code: 'rangeOrder', field: 'from' }],
  });