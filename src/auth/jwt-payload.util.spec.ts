import { describe, expect, it } from '@jest/globals';

import { parseJwtPayload } from './jwt-payload.util.js';

const payloadValid = {
  sub: '01900000-0000-7000-8000-000000000001',
  username: 'admin',
  role: 'admin',
  sppgId: null,
  facilityId: null,
} as const;

describe('parseJwtPayload', () => {
  it('menerima payload lengkap dan peran final', () => {
    expect(parseJwtPayload(payloadValid)).toEqual(payloadValid);
    expect(
      parseJwtPayload({
        ...payloadValid,
        role: 'sppg_staff',
        sppgId: 'sppg-1',
      }),
    ).toEqual({
      ...payloadValid,
      role: 'sppg_staff',
      sppgId: 'sppg-1',
    });
  });

  it('menolak bentuk yang tidak sesuai kontrak', () => {
    expect(parseJwtPayload(null)).toBeNull();
    expect(parseJwtPayload('token')).toBeNull();
    expect(parseJwtPayload({})).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, sub: '' })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, sub: 123 })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, username: '' })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, username: null })).toBeNull();
  });

  it('menolak peran di luar daftar final', () => {
    expect(parseJwtPayload({ ...payloadValid, role: 'supervisor' })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, role: 'ADMIN' })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, role: 7 })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, role: undefined })).toBeNull();
  });

  it('membedakan id kosong dari null', () => {
    expect(parseJwtPayload({ ...payloadValid, sppgId: undefined })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, sppgId: '' })).toBeNull();
    expect(parseJwtPayload({ ...payloadValid, sppgId: 'sppg-1' })?.sppgId).toBe(
      'sppg-1',
    );
    expect(parseJwtPayload({ ...payloadValid, facilityId: 42 })).toBeNull();
  });
});
