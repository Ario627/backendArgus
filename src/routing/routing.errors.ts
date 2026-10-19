import {
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

export const routePlanNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'ROUTE_PLAN_NOT_FOUND',
    message: 'Rencana rute tidak ditemukan',
  });

export const routeStopNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'ROUTE_STOP_NOT_FOUND',
    message: 'Stop rute tidak ditemukan',
  });

export const routeNoBatchesError = (): UnprocessableEntityException =>
  new UnprocessableEntityException({
    code: 'ROUTE_NO_BATCHES',
    message: 'Tidak ada batch menunggu angkut untuk dijadwalkan',
  });

export const routePlanActiveError = (): ConflictException =>
  new ConflictException({
    code: 'ROUTE_PLAN_ACTIVE',
    message:
      'Sudah ada rencana rute untuk SPPG dan tanggal ini; susun ulang dari rencana tersebut',
  });

export const routePlanNotReplanableError = (): ConflictException =>
  new ConflictException({
    code: 'ROUTE_PLAN_NOT_REPLANABLE',
    message: 'Rencana rute ini tidak bisa dihitung ulang',
  });

export const routeStopClosedError = (): ConflictException =>
  new ConflictException({
    code: 'ROUTE_STOP_CLOSED',
    message: 'Stop sudah selesai atau gagal',
  });

export const routeStopTransitionError = (): ConflictException =>
  new ConflictException({
    code: 'ROUTE_STOP_TRANSITION_INVALID',
    message: 'Perubahan status stop tidak valid',
  });
