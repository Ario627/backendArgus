import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { v7 as uuidv7 } from 'uuid';
import { generatePublicSlug } from '../common/utils/id.util.js';
import { buildConfiguration } from '../config/configuration.js';
import { createPgClient } from './pg-client.js';

const DEFAULT_ADMIN_USERNAME = 'admin';
const MIN_PASSWORD_LENGTH = 8;
const MIN_PASSWORD_LENGTH_PRODUCTION = 12;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

const DEMO_SPPG = {
  id: '01900000-0000-7000-8000-00000000d001',
  nama: 'SPPG Demo Sukamaju',
  alamat: 'Jl. Contoh Raya No. 1, Bandung',
  lat: -6.9147,
  lng: 107.6098,
  porsiPerHari: 3000,
  mitra: 'Yayasan Contoh',
  kapasitasOlahKg: '40.00',
} as const;

const DEMO_POINTS = [
  {
    id: '01900000-0000-7000-8000-00000000d101',
    nama: 'SD Demo Sukamaju 1',
    jenis: 'sekolah',
    lat: -6.9201,
    lng: 107.6132,
  },
  {
    id: '01900000-0000-7000-8000-00000000d102',
    nama: 'Posyandu Demo Melati',
    jenis: 'posyandu',
    lat: -6.9083,
    lng: 107.6044,
  },
] as const;

const DEMO_FACILITIES = [
  {
    id: '01900000-0000-7000-8000-00000000d201',
    nama: 'Komposter Demo SPPG',
    tingkat: 'T1',
    jenis: 'komposter',
    lat: -6.9147,
    lng: 107.6098,
    kapasitasKgHari: '40.00',
  },
  {
    id: '01900000-0000-7000-8000-00000000d202',
    nama: 'Hub BSF Demo Cibiru',
    tingkat: 'T2',
    jenis: 'bsf',
    lat: -6.9301,
    lng: 107.7204,
    kapasitasKgHari: '500.00',
  },
] as const;

const generatePassword = (): string => randomBytes(12).toString('base64url');

const resolveAdminPassword = (
  passwordEnv: string | null,
  isProduction: boolean,
): { password: string; generated: boolean } => {
  const minLength = isProduction
    ? MIN_PASSWORD_LENGTH_PRODUCTION
    : MIN_PASSWORD_LENGTH;
  if (passwordEnv !== null) {
    if (passwordEnv.length < minLength) {
      throw new Error(`SEED_ADMIN_PASSWORD minimal ${minLength} karakter`);
    }
    return { password: passwordEnv, generated: false };
  }
  if (isProduction) {
    throw new Error('SEED_ADMIN_PASSWORD wajib diisi saat NODE_ENV=production');
  }
  return { password: generatePassword(), generated: true };
};

const upsertAdmin = async (
  client: pg.Client,
  username: string,
  password: string,
  bcryptRounds: number,
): Promise<'dibuat' | 'sudah-ada'> => {
  const existing = await client.query(
    'SELECT id FROM "user" WHERE username = $1',
    [username],
  );
  if ((existing.rowCount ?? 0) > 0) return 'sudah-ada';
  const passwordHash = await bcrypt.hash(password, bcryptRounds);
  await client.query(
    'INSERT INTO "user" (id, username, password_hash, nama, role) VALUES ($1, $2, $3, $4, $5)',
    [uuidv7(), username, passwordHash, 'Administrator ARGUS', 'admin'],
  );
  return 'dibuat';
};

const seedDemoSppg = async (
  client: pg.Client,
): Promise<'dibuat' | 'sudah-ada'> => {
  const result = await client.query(
    `INSERT INTO sppg (id, public_slug, nama, alamat, lat, lng, porsi_per_hari, mitra, kapasitas_olah_kg, is_demo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [
      DEMO_SPPG.id,
      generatePublicSlug(),
      DEMO_SPPG.nama,
      DEMO_SPPG.alamat,
      DEMO_SPPG.lat,
      DEMO_SPPG.lng,
      DEMO_SPPG.porsiPerHari,
      DEMO_SPPG.mitra,
      DEMO_SPPG.kapasitasOlahKg,
    ],
  );
  for (const point of DEMO_POINTS) {
    await client.query(
      'INSERT INTO titik_distribusi (id, sppg_id, nama, jenis, lat, lng) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
      [point.id, DEMO_SPPG.id, point.nama, point.jenis, point.lat, point.lng],
    );
  }
  return (result.rowCount ?? 0) > 0 ? 'dibuat' : 'sudah-ada';
};

const seedDemoFacilities = async (client: pg.Client): Promise<number> => {
  let inserted = 0;
  for (const facility of DEMO_FACILITIES) {
    const result = await client.query(
      `INSERT INTO fasilitas (id, nama, tingkat, jenis, lat, lng, kapasitas_kg_hari, mitra, is_demo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [
        facility.id,
        facility.nama,
        facility.tingkat,
        facility.jenis,
        facility.lat,
        facility.lng,
        facility.kapasitasKgHari,
      ],
    );
    inserted += result.rowCount ?? 0;
  }
  return inserted;
};

const main = async (): Promise<number> => {
  const config = buildConfiguration(process.env);
  const adminUsername = (
    process.env.SEED_ADMIN_USERNAME ?? DEFAULT_ADMIN_USERNAME
  )
    .trim()
    .toLowerCase();
  if (!USERNAME_PATTERN.test(adminUsername)) {
    throw new Error(
      'SEED_ADMIN_USERNAME harus 3-32 karakter huruf kecil, angka, titik, garis bawah, atau strip',
    );
  }

  const passwordEnv = process.env.SEED_ADMIN_PASSWORD?.trim() ?? null;
  const seedDemo = (process.env.SEED_DEMO ?? 'false') === 'true';
  const { password, generated } = resolveAdminPassword(
    passwordEnv,
    config.isProduction,
  );

  const client = createPgClient(config.database, 'argus-seed');
  await client.connect();
  try {
    const adminStatus = await upsertAdmin(
      client,
      adminUsername,
      password,
      config.auth.bcryptRounds,
    );
    console.log(`admin ${adminStatus}: ${adminUsername}`);
    if (generated && adminStatus === 'dibuat') {
      console.log(
        `kata sandi admin (ditampilkan sekali, simpan sekarang): ${password}`,
      );
    }

    if (seedDemo) {
      const sppgStatus = await seedDemoSppg(client);
      const facilityCount = await seedDemoFacilities(client);
      console.log(`sppg demo ${sppgStatus}: ${DEMO_SPPG.nama} (is_demo=true)`);
      console.log(`fasilitas demo baru: ${facilityCount} (is_demo=true)`);
    } else {
      console.log('data demo dilewati (set SEED_DEMO=true untuk data contoh)');
    }
    return 0;
  } finally {
    await client.end();
  }
};

main()
  .then((kode) => {
    process.exitCode = kode;
  })
  .catch((galat: unknown) => {
    console.error(galat instanceof Error ? galat.message : String(galat));
    process.exitCode = 1;
  });
