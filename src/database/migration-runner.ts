import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

export interface DiscoveredMigration {
  readonly id: number;
  readonly nama: string;
  readonly sql: string;
  readonly checksum: string;
}

export interface MigrationReport {
  readonly diterapkan: readonly string[];
  readonly tertunda: readonly string[];
  readonly sudahTerdaftar: number;
}

const NAMA_MIGRASI = /^(\d{1,4})-([a-z0-9]+(?:-[a-z0-9]+)*)\.sql$/;
const LOCK_KEY_MIGRASI = 1095907155;

const SQL_TABEL_SKEMA = `
CREATE TABLE IF NOT EXISTS skema_migrasi (
  nama TEXT PRIMARY KEY,
  checksum TEXT NOT NULL CHECK (checksum ~ '^[0-9a-f]{64}$'),
  diterapkan_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  durasi_ms INTEGER NOT NULL CHECK (durasi_ms >= 0)
)`;

const checksumDari = (konten: string): string =>
  createHash('sha256').update(konten, 'utf8').digest('hex');

const idDariNama = (nama: string): number | null => {
  const hasil = NAMA_MIGRASI.exec(nama);
  return hasil === null ? null : Number.parseInt(hasil[1], 10);
};

export const discoverMigrations = async (
  dir: string,
): Promise<readonly DiscoveredMigration[]> => {
  const entri = await readdir(dir, { withFileTypes: true });
  const namaBerkas = entri
    .filter(
      (entriItem) => entriItem.isFile() && entriItem.name.endsWith('.sql'),
    )
    .map((entriItem) => entriItem.name);

  const terurut: DiscoveredMigration[] = [];
  const namaPerId = new Map<number, string>();

  for (const nama of namaBerkas) {
    const id = idDariNama(nama);
    if (id === null) throw new Error(`MIGRASI_NAMA_TIDAK_VALID: ${nama}`);
    const pemakaiSebelumnya = namaPerId.get(id);
    if (pemakaiSebelumnya !== undefined) {
      throw new Error(
        `MIGRASI_ID_GANDA: ${id} dipakai oleh ${pemakaiSebelumnya} dan ${nama}`,
      );
    }
    namaPerId.set(id, nama);
    const sql = await readFile(join(dir, nama), 'utf8');
    terurut.push({ id, nama, sql, checksum: checksumDari(sql) });
  }

  return terurut.sort((kiri, kanan) => kiri.id - kanan.id);
};

const pastikanTabelSkema = async (client: pg.Client): Promise<void> => {
  await client.query(SQL_TABEL_SKEMA);
};

const bacaTerdaftar = async (
  client: pg.Client,
): Promise<ReadonlyMap<string, string>> => {
  const hasil = await client.query<{ nama: string; checksum: string }>(
    'SELECT nama, checksum FROM skema_migrasi ORDER BY nama',
  );
  return new Map(hasil.rows.map((baris) => [baris.nama, baris.checksum]));
};

const verifikasiRiwayat = (
  terdaftar: ReadonlyMap<string, string>,
  diDisk: readonly DiscoveredMigration[],
): void => {
  const petaDisk = new Map(diDisk.map((migrasi) => [migrasi.nama, migrasi]));
  let idTerbesarTerdaftar = 0;

  for (const [nama, checksum] of terdaftar) {
    const berkas = petaDisk.get(nama);
    if (berkas === undefined) {
      throw new Error(
        `MIGRASI_HILANG: ${nama} sudah diterapkan tetapi berkasnya tidak ada di disk`,
      );
    }
    if (berkas.checksum !== checksum) {
      throw new Error(
        `MIGRASI_BERUBAH: ${nama} berubah setelah diterapkan; buat migrasi baru, jangan ubah yang lama`,
      );
    }
    const id = idDariNama(nama);
    if (id !== null && id > idTerbesarTerdaftar) idTerbesarTerdaftar = id;
  }

  for (const migrasi of diDisk) {
    if (terdaftar.has(migrasi.nama)) continue;
    if (migrasi.id <= idTerbesarTerdaftar) {
      throw new Error(
        `MIGRASI_TIDAK_BERURUT: ${migrasi.nama} bernomor lebih kecil dari migrasi yang sudah diterapkan`,
      );
    }
  }
};

const terapkanSatu = async (
  client: pg.Client,
  migrasi: DiscoveredMigration,
): Promise<void> => {
  const mulaiMs = Date.now();
  await client.query('BEGIN');
  try {
    await client.query(migrasi.sql);
    await client.query(
      'INSERT INTO skema_migrasi (nama, checksum, durasi_ms) VALUES ($1, $2, $3)',
      [migrasi.nama, migrasi.checksum, Date.now() - mulaiMs],
    );
    await client.query('COMMIT');
  } catch (galat) {
    await client.query('ROLLBACK');
    const pesan = galat instanceof Error ? galat.message : String(galat);
    throw new Error(`MIGRASI_GAGAL: ${migrasi.nama}: ${pesan}`);
  }
};

export const runMigrations = async (
  client: pg.Client,
  dir: string,
  mode: 'run' | 'status',
): Promise<MigrationReport> => {
  const hasilLock = await client.query<{ terkunci: boolean }>(
    'SELECT pg_try_advisory_lock($1) AS terkunci',
    [LOCK_KEY_MIGRASI],
  );
  if (hasilLock.rows[0]?.terkunci !== true) {
    throw new Error(
      'MIGRASI_SEDANG_BERJALAN: proses migrasi lain sedang memegang kunci',
    );
  }

  try {
    await pastikanTabelSkema(client);
    const diDisk = await discoverMigrations(dir);
    const terdaftar = await bacaTerdaftar(client);
    verifikasiRiwayat(terdaftar, diDisk);

    const tertunda = diDisk.filter((migrasi) => !terdaftar.has(migrasi.nama));
    const diterapkan: string[] = [];

    if (mode === 'run') {
      for (const migrasi of tertunda) {
        await terapkanSatu(client, migrasi);
        diterapkan.push(migrasi.nama);
      }
    }

    return {
      diterapkan,
      tertunda: tertunda.map((migrasi) => migrasi.nama),
      sudahTerdaftar: terdaftar.size,
    };
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_KEY_MIGRASI]);
  }
};
