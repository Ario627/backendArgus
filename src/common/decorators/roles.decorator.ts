import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../types';

export const ROLES_KEY = 'roles';
export const IS_PUBLIC_KEY = 'is_public';

export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);

export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);