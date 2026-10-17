import type { UserRole } from '../common/constant/domain.constant.js';

export interface AuditTarget {
  readonly aksi: string;
  readonly entitas: string;
  readonly entitasId: string | null;
}

export interface AuditRequestShape {
  readonly method: string;
  readonly baseUrl: string;
  readonly routePath: string;
  readonly role: UserRole | null;
  readonly params: Readonly<
    Record<string, string | readonly string[] | undefined>
  >;
}

const API_PREFIX = '/api/v1';

const AUDITED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'admin',
  'dlh_auditor',
]);

const MUTATING_METHODS: ReadonlySet<string> = new Set([
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const AUDIT_QUERY_ALLOWLIST: ReadonlySet<string> = new Set([
  'from',
  'to',
  'sppgId',
  'batchId',
  'jenis',
  'tingkat',
  'status',
  'aktif',
  'terbuka',
  'tanggal',
  'tier',
  'aliran',
  'minutes',
  'page',
  'limit',
]);

const MAX_QUERY_VALUE_LENGTH = 64;

export const isUuid = (value: string): boolean => UUID_PATTERN.test(value);

export const resolveAuditTarget = (
  request: AuditRequestShape,
): AuditTarget | null => {
  if (request.role === null || !AUDITED_ROLES.has(request.role)) {
    return null;
  }
  const method = request.method.toUpperCase();
  if (!MUTATING_METHODS.has(method)) {
    return null;
  }
  const fullPath = `${request.baseUrl}${request.routePath}`;
  const stripped = fullPath.startsWith(API_PREFIX)
    ? fullPath.slice(API_PREFIX.length)
    : fullPath;
  const path = stripped.length === 0 ? '/' : stripped;
  const segments = path
    .split('/')
    .filter((segment) => segment.length > 0 && !segment.startsWith(':'));
  return Object.freeze({
    aksi: `${method.toLowerCase()} ${path}`,
    entitas: segments[0] ?? 'unknown',
    entitasId:
      Object.values(request.params).find(
        (value): value is string => typeof value === 'string' && isUuid(value),
      ) ?? null,
  });
};

export const scrubQueryForAudit = (
  query: Readonly<Record<string, unknown>>,
): Record<string, string | number | boolean> => {
  const result: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(query)) {
    if (!AUDIT_QUERY_ALLOWLIST.has(key)) continue;
    if (typeof value === 'string') {
      if (value.length > 0 && value.length <= MAX_QUERY_VALUE_LENGTH) {
        result[key] = value;
      }
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
};