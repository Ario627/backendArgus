import { computeMassBalance } from './mass-balance.util.js';
import { describe, expect, it } from '@jest/globals';


const BASE = { handedOverKg: 12.35, receivedKg: 12.2, susutWajar: 0.02, toleransi: 0.05 };

describe('computeMassBalance', () => {
  it('menghitung rentang harapan dari susut wajar dan toleransi', () => {
    const result = computeMassBalance(BASE);
    expect(result.expectedMinKg).toBe(11.49);
    expect(result.expectedMaxKg).toBe(12.72);
    expect(result.ok).toBe(true);
    expect(result.deltaPercent).toBe(-1.2);
    expect(result.severity).toBeNull();
  });

  it('menerima berat tepat di batas rentang', () => {
    expect(computeMassBalance({ ...BASE, receivedKg: 11.49 }).ok).toBe(true);
    expect(computeMassBalance({ ...BASE, receivedKg: 12.72 }).ok).toBe(true);
  });

  it('menandai PERHATIAN untuk selisih di luar rentang tetapi belum melewati dua kali toleransi', () => {
    const result = computeMassBalance({ ...BASE, receivedKg: 11.4 });
    expect(result.ok).toBe(false);
    expect(result.severity).toBe('PERHATIAN');
  });

  it('menandai KRITIS ketika selisih melewati dua kali toleransi', () => {
    const result = computeMassBalance({ ...BASE, receivedKg: 10.3 });
    expect(result.ok).toBe(false);
    expect(result.severity).toBe('KRITIS');
  });

  it('menangani berat terima di atas rentang harapan', () => {
    const ringan = computeMassBalance({ ...BASE, receivedKg: 12.9 });
    expect(ringan.ok).toBe(false);
    expect(ringan.severity).toBe('PERHATIAN');
    expect(ringan.deltaPercent).toBe(4.5);
  });

  it('tidak pernah menghasilkan batas bawah negatif', () => {
    const result = computeMassBalance({ ...BASE, handedOverKg: 1, susutWajar: 0.5, toleransi: 0.6 });
    expect(result.expectedMinKg).toBe(0);
  });

  it('menolak berat serah nol atau negatif', () => {
    expect(() => computeMassBalance({ ...BASE, handedOverKg: 0 })).toThrow(RangeError);
    expect(() => computeMassBalance({ ...BASE, handedOverKg: -1 })).toThrow(RangeError);
  });
});