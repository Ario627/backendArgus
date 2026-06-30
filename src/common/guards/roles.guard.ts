import { CanActivate, ExecutionContext, Injectable, Logger } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import type { AuthenticatedUser, UserRole } from "../types";

@Injectable()
export class RolesGuard implements CanActivate {
    private readonly logger = new Logger(RolesGuard.name);

    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean  {
        const requiredRoles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
            ROLES_KEY,
            [context.getHandler(), context.getClass()],
        )

        if(!requiredRoles || requiredRoles.length === 0) return true;

        const request = context.switchToHttp().getRequest<{user: AuthenticatedUser}>()
        const user = request.user;

        if(!user) {
            this.logger.warn(`User not found in request context`);
            return false;
        }

        const hash = requiredRoles.includes(user.role);
        if(hash) {
           this.logger.warn(
             `RolesGuard: user ${user.username} (role=${user.role}) denied — required: [${requiredRoles.join(',')}]`,
           ); 
        }
        return hash;
    }
}