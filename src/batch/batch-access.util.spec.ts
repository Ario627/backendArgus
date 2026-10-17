import type { AuthenticatedUser } from '../common/types.js';
import { canReadBatch, chosenFacilityIdOf } from './batch-access.util.js';
import { describe, expect, it } from '@jest/globals';

const actor = (overrides: Partial<AuthenticatedUser>): AuthenticatedUser => ({
  id: 'user-1',
  username: 'tester',
  role: 'sppg_staff',
  sppgId: null,
  facilityId: null,
  fleetId: null,
  ...overrides,
});

const batch = (overrides: { sppgId?: string; alasanPutusan?: Record<string, unknown> | null } = {}) => ({
  sppgId: overrides.sppgId ?? 'sppg-1',
  alasanPutusan: overrides.alasanPutusan ?? null,
});

describe('chosenFacilityIdOf', () => {
  it('mengambil id fasilitas hanya dari nilai string yang sah', () => {
    expect(chosenFacilityIdOf(null)).toBeNull();
    expect(chosenFacilityIdOf({})).toBeNull();
    expect(chosenFacilityIdOf({ chosenFacilityId: '' })).toBeNull();
    expect(chosenFacilityIdOf({ chosenFacilityId: 42 })).toBeNull();
    expect(chosenFacilityIdOf({ chosenFacilityId: 'fac-9' })).toBe('fac-9');
  });
});

describe('canReadBatch', () => {
  it('mengizinkan admin dan auditor membaca semua batch', () => {
    expect(canReadBatch(actor({ role: 'admin' }), batch())).toBe(true);
    expect(canReadBatch(actor({ role: 'dlh_auditor' }), batch())).toBe(true);
  });

  it('membatasi staf pada dapurnya sendiri', () => {
    expect(canReadBatch(actor({ role: 'sppg_staff', sppgId: 'sppg-1' }), batch({ sppgId: 'sppg-1' }))).toBe(true);
    expect(canReadBatch(actor({ role: 'sppg_staff', sppgId: 'sppg-2' }), batch({ sppgId: 'sppg-1' }))).toBe(false);
    expect(canReadBatch(actor({ role: 'sppg_staff', sppgId: null }), batch({ sppgId: 'sppg-1' }))).toBe(false);
  });

  it('membatasi fasilitas pada batch yang diputuskan ke fasilitasnya', () => {
    const ditolak = actor({ role: 'facility', facilityId: 'fac-1' });
    expect(canReadBatch(ditolak, batch())).toBe(false);
    expect(canReadBatch(ditolak, batch({ alasanPutusan: { chosenFacilityId: 'fac-1' } }))).toBe(true);
    expect(canReadBatch(ditolak, batch({ alasanPutusan: { chosenFacilityId: 'fac-2' } }))).toBe(false);
  });

  it('menolak pengemudi sampai modul rute menentukan scope-nya', () => {
    expect(canReadBatch(actor({ role: 'driver' }), batch({ alasanPutusan: { chosenFacilityId: 'fac-1' } }))).toBe(false);
  });
});