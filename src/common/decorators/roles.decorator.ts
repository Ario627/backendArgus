import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../constant/domain.constant.js';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: readonly UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);