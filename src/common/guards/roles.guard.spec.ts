import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { USER_ROLES, type UserRole } from '../constant/domain.constant.js';
import type { AuthenticatedUser } from '../types.js';
import { RolesGuard } from './roles.guard.js';
import { describe, expect, it } from '@jest/globals';

const buildUser = (role: UserRole): AuthenticatedUser => ({
  id: 'user-uji-1',
  username: 'tester',
  role,
  sppgId: null,
  facilityId: null,
  fleetId: null,
});

const buildContext = (user?: AuthenticatedUser): ExecutionContext =>
  ({
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

const buildGuard = (
  requiredRoles: readonly UserRole[] | undefined,
): RolesGuard => {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
};

const attemptGuard = (
  guard: RolesGuard,
  context: ExecutionContext,
): unknown => {
  try {
    guard.canActivate(context);
    return null;
  } catch (error) {
    return error;
  }
};

describe('RolesGuard', () => {
  it('mengizinkan akses bila endpoint tidak meminta peran tertentu', () => {
    const guard = buildGuard(undefined);
    for (const role of USER_ROLES) {
      expect(guard.canActivate(buildContext(buildUser(role)))).toBe(true);
    }
  });

  it('mengizinkan tepat peran yang diminta dan menolak seluruh sisanya', () => {
    const required: readonly UserRole[] = ['admin', 'dlh_auditor'];
    const guard = buildGuard(required);
    for (const role of USER_ROLES) {
      const context = buildContext(buildUser(role));
      if (required.includes(role)) {
        expect(guard.canActivate(context)).toBe(true);
      } else {
        expect(attemptGuard(guard, context)).toBeInstanceOf(ForbiddenException);
      }
    }
  });

  it('menolak request tanpa pengguna terautentikasi', () => {
    const guard = buildGuard(['admin']);
    const error = attemptGuard(guard, buildContext(undefined));
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getResponse()).toMatchObject({
      code: 'RBAC_FORBIDDEN',
    });
  });
});
