import { describe, expect, it } from '@jest/globals';
import type { UserRole } from '../common/constant/domain.constant.js';
import {
  isUuid,
  resolveAuditTarget,
  scrubQueryForAudit,
  type AuditRequestShape,
} from './audit-target.util.js';

const BATCH_ID = '0199f5b0-1b0e-7a3c-9f2e-1c2d3e4f5a6b';

const shape = (
  overrides: Partial<AuditRequestShape> = {},
): AuditRequestShape => ({
  method: 'POST',
  baseUrl: '/api/v1/anomalies',
  routePath: '/:id/close',
  role: 'dlh_auditor',
  params: { id: BATCH_ID },
  ...overrides,
});

describe('resolveAuditTarget', () => {
  it('membentuk aksi, entitas, dan entitas_id dari rute bermutasi', () => {
    expect(resolveAuditTarget(shape())).toEqual({
      aksi: 'post /anomalies/:id/close',
      entitas: 'anomalies',
      entitasId: BATCH_ID,
    });
  });

  it('melewati peran operasional dan peran yang belum terautentikasi', () => {
    const roles: (UserRole | null)[] = ['sppg_staff', 'driver', 'facility'];
    for (const role of roles) {
      expect(resolveAuditTarget(shape({ role }))).toBeNull();
    }
    expect(resolveAuditTarget(shape({ role: null }))).toBeNull();
  });

  it('tidak mengaudit permintaan baca', () => {
    expect(resolveAuditTarget(shape({ method: 'GET' }))).toBeNull();
  });

  it('mengabaikan prefix global dan segmen parameter', () => {
    const target = resolveAuditTarget(
      shape({
        method: 'DELETE',
        baseUrl: '/api/v1/devices',
        routePath: '/:id/revoke',
        role: 'admin',
      }),
    );
    expect(target?.aksi).toBe('delete /devices/:id/revoke');
    expect(target?.entitas).toBe('devices');
  });

  it('mengembalikan entitas_id null saat tidak ada parameter UUID', () => {
    const target = resolveAuditTarget(shape({ params: { id: 'bukan-uuid' } }));
    expect(target?.entitasId).toBeNull();
    expect(resolveAuditTarget(shape({ params: {} }))?.entitasId).toBeNull();
  });
});

describe('scrubQueryForAudit', () => {
  it('hanya mempertahankan kunci daftar putih dengan nilai pendek', () => {
    const scrubbed = scrubQueryForAudit({
      from: '2026-10-01',
      limit: 20,
      terbuka: true,
      token: 'rahasia',
      sppgId: 'x'.repeat(65),
      aksi: 'harus-dibuang',
    });
    expect(scrubbed).toEqual({
      from: '2026-10-01',
      limit: 20,
      terbuka: true,
    });
  });
});

describe('isUuid', () => {
  it('menerima UUID v4 dan v7 serta menolak bentuk lain', () => {
    expect(isUuid(BATCH_ID)).toBe(true);
    expect(isUuid('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe(true);
    expect(isUuid('0199f5b0-1b0e-7a3c-9f2e')).toBe(false);
    expect(isUuid('not-a-uuid')).toBe(false);
  });
});