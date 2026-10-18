import { describe, expect, it } from '@jest/globals';
import {
  describeViolation,
  parseAkunFile,
  type AkunSeedRow,
} from './akun-seed.util.js';

const SPPG_ID = '01900000-0000-7000-8000-00000000d001';
const FAS_ID = '01900000-0000-7000-8000-00000000d201';

const berkas = (akun: readonly unknown[]): unknown => ({ akun });

const kode = (hasil: ReturnType<typeof parseAkunFile>): readonly string[] =>
  hasil.ok ? [] : hasil.violations.map((v) => v.code);

describe('parseAkunFile', () => {
  it('menerima berkas berisi akun lengkap dengan binding id', () => {
    const hasil = parseAkunFile(
      berkas([
        {
          username: 'Staf_Cibiru',
          nama: 'Staf SPPG Cibiru',
          role: 'sppg_staff',
          sppgId: SPPG_ID,
        },
        { username: 'audit2', nama: 'Auditor DLH', role: 'dlh_auditor' },
      ]),
      false,
    );
    expect(hasil.ok).toBe(true);
    const rows = (hasil as { rows: readonly AkunSeedRow[] }).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]?.username).toBe('staf_cibiru');
    expect(rows[0]?.sppgId).toBe(SPPG_ID);
    expect(rows[0]?.aktif).toBe(true);
    expect(rows[1]?.sppgId).toBeNull();
  });

  it('menerima binding lewat slug, nama fasilitas, dan kode armada', () => {
    const hasil = parseAkunFile(
      berkas([
        {
          username: 'staf_a',
          nama: 'Staf A',
          role: 'sppg_staff',
          sppgSlug: 'bugxw3yvlzkk',
        },
        {
          username: 'fas_a',
          nama: 'Fasilitas A',
          role: 'facility',
          fasilitasNama: 'Komposter Uji A',
        },
        {
          username: 'drv_a',
          nama: 'Driver A',
          role: 'driver',
          fleetKode: 'RT-01',
        },
      ]),
      false,
    );
    expect(hasil.ok).toBe(true);
    const rows = (hasil as { rows: readonly AkunSeedRow[] }).rows;
    expect(rows[0]?.sppgSlug).toBe('bugxw3yvlzkk');
    expect(rows[1]?.fasilitasNama).toBe('Komposter Uji A');
    expect(rows[2]?.fleetKode).toBe('RT-01');
  });

  it('menolak berkas tanpa daftar akun', () => {
    expect(kode(parseAkunFile({}, false))).toEqual(['daftarAkunWajib']);
    expect(kode(parseAkunFile({ akun: 'bukan-array' }, false))).toEqual([
      'daftarAkunWajib',
    ]);
    expect(kode(parseAkunFile(berkas([]), false))).toEqual(['daftarKosong']);
  });

  it('menolak username, nama, dan peran yang tidak sah', () => {
    const hasil = parseAkunFile(
      berkas([
        { username: 'AB', nama: 'Nama', role: 'admin' },
        { username: 'punya spasi', nama: 'Nama', role: 'admin' },
        { username: 'ok_1', nama: '', role: 'admin' },
        { username: 'ok_2', nama: 'Nama', role: 'superadmin' },
        { username: 'ok_3', nama: 'Nama\u0000rusak', role: 'admin' },
      ]),
      false,
    );
    const codes = kode(hasil);
    expect(codes).toContain('formatTidakSah');
    expect(codes).toContain('namaTidakSah');
    expect(codes).toContain('peranTidakSah');
  });

  it('menuntut sppg_staff punya tepat satu binding dapur', () => {
    expect(
      kode(
        parseAkunFile(
          berkas([{ username: 'staf_x', nama: 'X', role: 'sppg_staff' }]),
          false,
        ),
      ),
    ).toContain('wajibSatuSppg');
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'staf_y',
              nama: 'Y',
              role: 'sppg_staff',
              sppgId: SPPG_ID,
              sppgSlug: 'bugxw3yvlzkk',
            },
          ]),
          false,
        ),
      ),
    ).toContain('wajibSatuSppg');
  });

  it('menuntut facility punya tepat satu binding fasilitas', () => {
    expect(
      kode(
        parseAkunFile(
          berkas([{ username: 'fas_x', nama: 'X', role: 'facility' }]),
          false,
        ),
      ),
    ).toContain('wajibSatuFasilitas');
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'fas_y',
              nama: 'Y',
              role: 'facility',
              fasilitasId: FAS_ID,
              fasilitasNama: 'Komposter Uji A',
            },
          ]),
          false,
        ),
      ),
    ).toContain('wajibSatuFasilitas');
  });

  it('melarang binding pada peran yang tidak memakainya', () => {
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'audit_x',
              nama: 'X',
              role: 'dlh_auditor',
              sppgId: SPPG_ID,
            },
          ]),
          false,
        ),
      ),
    ).toContain('tidakBerlakuUntukPeran');
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'staf_z',
              nama: 'Z',
              role: 'sppg_staff',
              sppgId: SPPG_ID,
              fleetKode: 'RT-01',
            },
          ]),
          false,
        ),
      ),
    ).toContain('tidakBerlakuUntukPeran');
  });

  it('menolak id yang bukan UUID dan armada ganda', () => {
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'staf_q',
              nama: 'Q',
              role: 'sppg_staff',
              sppgId: 'bukan-uuid',
            },
          ]),
          false,
        ),
      ),
    ).toContain('bukanUuid');
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'drv_q',
              nama: 'Q',
              role: 'driver',
              fleetId: SPPG_ID,
              fleetKode: 'RT-01',
            },
          ]),
          false,
        ),
      ),
    ).toContain('pilihSatuArmada');
  });

  it('menegakkan panjang kata sandi sesuai lingkungan', () => {
    const terlaluPendek = berkas([
      {
        username: 'adm_x',
        nama: 'X',
        role: 'admin',
        password: 'pendek',
      },
    ]);
    expect(kode(parseAkunFile(terlaluPendek, false))).toEqual([
      'minimal8Karakter',
    ]);
    expect(kode(parseAkunFile(terlaluPendek, true))).toEqual([
      'minimal12Karakter',
    ]);
    const cukupDev = berkas([
      {
        username: 'adm_z',
        nama: 'Z',
        role: 'admin',
        password: 'sembilan9',
      },
    ]);
    expect(kode(parseAkunFile(cukupDev, false))).toEqual([]);
    expect(kode(parseAkunFile(cukupDev, true))).toEqual(['minimal12Karakter']);
    expect(
      kode(
        parseAkunFile(
          berkas([
            {
              username: 'adm_y',
              nama: 'Y',
              role: 'admin',
              password: 'dua-belas-ok',
            },
          ]),
          true,
        ),
      ),
    ).toEqual([]);
  });

  it('menolak username duplikat di dalam satu berkas', () => {
    const hasil = parseAkunFile(
      berkas([
        { username: 'sama', nama: 'Satu', role: 'admin' },
        { username: 'SAMA', nama: 'Dua', role: 'admin' },
      ]),
      false,
    );
    expect(kode(hasil)).toEqual(['duplikatDiBerkas']);
  });

  it('menghormati flag aktif false', () => {
    const hasil = parseAkunFile(
      berkas([
        { username: 'nonaktif', nama: 'N', role: 'admin', aktif: false },
      ]),
      false,
    );
    expect((hasil as { rows: readonly AkunSeedRow[] }).rows[0]?.aktif).toBe(
      false,
    );
  });
});

describe('describeViolation', () => {
  it('menyusun pesan yang menyebut baris dan medan', () => {
    expect(
      describeViolation({ baris: 3, field: 'sppgId', code: 'wajibSatuSppg' }),
    ).toBe('baris 3: sppgId (wajibSatuSppg)');
  });
});