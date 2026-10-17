import { UnauthorizedException } from '@nestjs/common';

export const invalidCredentialsError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: 'AUTH_INVALID',
    message: 'Nama pengguna atau kata sandi salah',
  });

export const expiredSessionError = (): UnauthorizedException =>
  new UnauthorizedException({
    code: 'AUTH_EXPIRED',
    message: 'Sesi berakhir, silakan masuk kembali',
  });
