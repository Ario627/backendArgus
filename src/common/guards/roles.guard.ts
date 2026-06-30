import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedUser, UserRole } from '../types';

type AuthedRequest = {
  user?: AuthenticatedUser;
};

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger(RolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredRoles?.length) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) {
      this.logger.warn('RolesGuard: user not found in request context');
      return false;
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      this.logger.warn(
        `RolesGuard: user ${user.username} (role=${user.role}) denied — required: [${requiredRoles.join(',')}]`,
      );
    }
    return hasRole;
  }
}
