import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthenticatedUser, UserRole, JwtPayload } from "../types"; 
import { IS_PUBLIC_KEY } from "../decorators/roles.decorator";
import type { Request } from "express";

const VALID_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'admin',
  'supervisor',
  'driver',
]);

@Injectable()
export class JwtAuthGuard implements CanActivate {
    private readonly logger = new Logger(JwtAuthGuard.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly reflector: Reflector
    ) {}

    canActivate(context: ExecutionContext): boolean {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        if(isPublic) return true;

        const request = context.switchToHttp().getRequest<Request & {user?: AuthenticatedUser}>();
        const token = this.extractToken(request);
        if(!token) throw new UnauthorizedException(
          'Missing or invalid Authorization header',
        );

        try {
            const payload = this.jwtService.verify<JwtPayload>(token);
            if(!this.isValidPayload(payload))  throw new UnauthorizedException('Invalid token payload');

            request.user = {
                id: payload.sub,
                username: payload.username,
                role: payload.role,
                fleetId: payload.fleetId,
            }
            return true;
        } catch(err) {
            if(err instanceof UnauthorizedException) throw err;

            this.logger.warn(
              `JWT verification failed: ${this.errMessage(err)}`,
            );
            throw new UnauthorizedException('Invalid or expired token');
        }
    }

    private extractToken(request: Request): string | null {
        const header = request.headers['authorization'];
        if(!header || typeof header !== 'string') return null;

        const [schema, token] = header.split(' ');
        if(schema !== 'Bearer' || !token) return null;

        return token;
    }


    private errMessage(err: unknown): string {
        return err instanceof Error ? err.message : 'non-Error throw';
    }

    private isValidPayload(payload: unknown): payload is JwtPayload {
        if(typeof payload !== 'object' || payload === null) return false;

        const p = payload as Record<string, unknown>;
        return (
            typeof p.sub === 'string' &&
            typeof p.username === 'string' &&
            typeof p.role === 'string' &&
            VALID_ROLES.has(p.role as UserRole) &&
            (p.fleetId === null || typeof p.fleetId === 'string')
        );
    }
}