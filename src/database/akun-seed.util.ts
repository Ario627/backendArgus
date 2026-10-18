import {
  USER_ROLES,
  type UserRole,
} from '../common/constant/domain.constant.js';

export const AKUN_USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;
export const AKUN_MIN_PASSWORD_LENGTH = 8;
export const AKUN_MIN_PASSWORD_LENGTH_PRODUCTION = 12;
export const AKUN_MAX_NAMA_LENGTH = 120;
export const AKUN_TEXT_SAFE_PATTERN = /^[\P{Cc}\n\t]+$/u;

export type AkunBindingField =
  | 'sppgId'
  | 'sppgSlug'
  | 'fasilitasId'
  | 'fasilitasNama'
  | 'fleetId'
  | 'fleetKode';

export interface AkunSeedRow {
  readonly baris: number;
  readonly username: string;
  readonly nama: string;
  readonly role: UserRole;
  readonly sppgId: string | null;
  readonly sppgSlug: string | null;
  readonly fasilitasId: string | null;
  readonly fasilitasNama: string | null;
  readonly fleetId: string | null;
  readonly fleetKode: string | null;
  readonly password: string | null;
  readonly aktif: boolean;
}

export interface AkunSeedViolation {
  readonly baris: number;
  readonly field: string;
  readonly code: string;
}

export type AkunSeedParse =
  | { readonly ok: true; readonly rows: readonly AkunSeedRow[] }
  | { readonly ok: false; readonly violations: readonly AkunSeedViolation[] };

const BINDING_FIELDS: readonly AkunBindingField[] = Object.freeze([
  'sppgId',
  'sppgSlug',
  'fasilitasId',
  'fasilitasNama',
  'fleetId',
  'fleetKode',
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const isUserRole = (value: string): value is UserRole =>
  (USER_ROLES as readonly string[]).includes(value);

const bindingOf = (row: AkunSeedRow): readonly AkunBindingField[] =>
  BINDING_FIELDS.filter((field) => row[field] !== null);

const validateRow = (
  raw: unknown,
  baris: number,
  isProduction: boolean,
): {
  readonly row: AkunSeedRow | null;
  readonly violations: AkunSeedViolation[];
} => {
  const violations: AkunSeedViolation[] = [];
  if (!isRecord(raw)) {
    return {
      row: null,
      violations: [{ baris, field: '-', code: 'bukanObjek' }],
    };
  }
  const username = (readText(raw.username) ?? '').toLowerCase();
  if (!AKUN_USERNAME_PATTERN.test(username)) {
    violations.push({ baris, field: 'username', code: 'formatTidakSah' });
  }
  const nama = readText(raw.nama);
  if (
    nama === null ||
    nama.length > AKUN_MAX_NAMA_LENGTH ||
    !AKUN_TEXT_SAFE_PATTERN.test(nama)
  ) {
    violations.push({ baris, field: 'nama', code: 'namaTidakSah' });
  }
  const roleText = readText(raw.role);
  if (roleText === null || !isUserRole(roleText)) {
    violations.push({ baris, field: 'role', code: 'peranTidakSah' });
    return { row: null, violations };
  }
  const password = readText(raw.password);
  if (password !== null) {
    const minLength = isProduction
      ? AKUN_MIN_PASSWORD_LENGTH_PRODUCTION
      : AKUN_MIN_PASSWORD_LENGTH;
    if (password.length < minLength) {
      violations.push({
        baris,
        field: 'password',
        code: `minimal${minLength}Karakter`,
      });
    }
  }
  const row: AkunSeedRow = {
    baris,
    username,
    nama: nama ?? '',
    role: roleText,
    sppgId: readText(raw.sppgId),
    sppgSlug: readText(raw.sppgSlug),
    fasilitasId: readText(raw.fasilitasId),
    fasilitasNama: readText(raw.fasilitasNama),
    fleetId: readText(raw.fleetId),
    fleetKode: readText(raw.fleetKode),
    password,
    aktif: raw.aktif === false ? false : true,
  };
  if (row.sppgId !== null && !UUID_PATTERN.test(row.sppgId)) {
    violations.push({ baris, field: 'sppgId', code: 'bukanUuid' });
  }
  if (row.fasilitasId !== null && !UUID_PATTERN.test(row.fasilitasId)) {
    violations.push({ baris, field: 'fasilitasId', code: 'bukanUuid' });
  }
  if (row.fleetId !== null && !UUID_PATTERN.test(row.fleetId)) {
    violations.push({ baris, field: 'fleetId', code: 'bukanUuid' });
  }
  const bindings = bindingOf(row);
  if (row.role === 'sppg_staff') {
    const sppgBindings = bindings.filter(
      (field) => field === 'sppgId' || field === 'sppgSlug',
    );
    if (sppgBindings.length !== 1) {
      violations.push({ baris, field: 'sppgId', code: 'wajibSatuSppg' });
    }
    for (const field of bindings) {
      if (field !== 'sppgId' && field !== 'sppgSlug') {
        violations.push({ baris, field, code: 'tidakBerlakuUntukPeran' });
      }
    }
  } else if (row.role === 'facility') {
    const fasilitasBindings = bindings.filter(
      (field) => field === 'fasilitasId' || field === 'fasilitasNama',
    );
    if (fasilitasBindings.length !== 1) {
      violations.push({
        baris,
        field: 'fasilitasId',
        code: 'wajibSatuFasilitas',
      });
    }
    for (const field of bindings) {
      if (field !== 'fasilitasId' && field !== 'fasilitasNama') {
        violations.push({ baris, field, code: 'tidakBerlakuUntukPeran' });
      }
    }
  } else if (row.role === 'driver') {
    const fleetBindings = bindings.filter(
      (field) => field === 'fleetId' || field === 'fleetKode',
    );
    if (fleetBindings.length > 1) {
      violations.push({ baris, field: 'fleetId', code: 'pilihSatuArmada' });
    }
    for (const field of bindings) {
      if (field !== 'fleetId' && field !== 'fleetKode') {
        violations.push({ baris, field, code: 'tidakBerlakuUntukPeran' });
      }
    }
  } else {
    for (const field of bindings) {
      violations.push({ baris, field, code: 'tidakBerlakuUntukPeran' });
    }
  }
  if (violations.length > 0) {
    return { row: null, violations };
  }
  return { row, violations };
};

export const parseAkunFile = (
  raw: unknown,
  isProduction: boolean,
): AkunSeedParse => {
  if (!isRecord(raw) || !Array.isArray(raw.akun)) {
    return {
      ok: false,
      violations: [{ baris: 0, field: 'akun', code: 'daftarAkunWajib' }],
    };
  }
  const rows: AkunSeedRow[] = [];
  const violations: AkunSeedViolation[] = [];
  const seen = new Set<string>();
  raw.akun.forEach((entry, index) => {
    const baris = index + 1;
    const hasil = validateRow(entry, baris, isProduction);
    violations.push(...hasil.violations);
    if (hasil.row === null) return;
    if (seen.has(hasil.row.username)) {
      violations.push({ baris, field: 'username', code: 'duplikatDiBerkas' });
      return;
    }
    seen.add(hasil.row.username);
    rows.push(hasil.row);
  });
  if (violations.length > 0) {
    return { ok: false, violations: Object.freeze(violations) };
  }
  if (rows.length === 0) {
    return {
      ok: false,
      violations: [{ baris: 0, field: 'akun', code: 'daftarKosong' }],
    };
  }
  return { ok: true, rows: Object.freeze(rows) };
};

export const describeViolation = (violation: AkunSeedViolation): string =>
  `baris ${violation.baris}: ${violation.field} (${violation.code})`;