import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../constant/domain.constant.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';
import { forbiddenActionError } from '../errors/http.errors.js';
import type { AuthenticatedUser } from '../types.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<readonly UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles === undefined || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (user === undefined || !requiredRoles.includes(user.role)) {
      throw forbiddenActionError();
    }
    return true;
  }
}
