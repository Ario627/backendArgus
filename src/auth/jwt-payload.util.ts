import {
  USER_ROLES,
  type UserRole,
} from '../common/constant/domain.constant.js';
import type { JwtPayload } from '../common/types.js';

const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' &&
  (USER_ROLES as readonly string[]).includes(value);

const readNullableId = (value: unknown): string | null | undefined => {
  if (value === null) return null;
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
};

export const parseJwtPayload = (value: unknown): JwtPayload | null => {
  if (value === null || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (typeof record.sub !== 'string' || record.sub.length === 0) return null;
  if (typeof record.username !== 'string' || record.username.length === 0)
    return null;
  if (!isUserRole(record.role)) return null;
  const sppgId = readNullableId(record.sppgId);
  if (sppgId === undefined) return null;
  const facilityId = readNullableId(record.facilityId);
  if (facilityId === undefined) return null;
  return {
    sub: record.sub,
    username: record.username,
    role: record.role,
    sppgId,
    facilityId,
  };
};
