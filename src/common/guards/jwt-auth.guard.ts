import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { AuthenticatedUser, UserRole, JwtPayload } from "../types";
import { Request } from "express";
import { IS_PUBLIC_KEY } from "../decorators/roles.decorator";

const VALID_ROLES: ReadonlySet<UserRole> = new Set([
    'admin',
    'supervisor',
    'driver'
]);

type AuthedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.isPublic(context)) return true;

    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Missing authentication token');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      if (!this.isValidPayload(payload)) {
        throw new UnauthorizedException('Invalid token payload');
      }
      request.user = this.toAuthenticatedUser(payload);
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.logger.warn(`JWT verification failed: ${(error as Error).message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private isPublic(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private extractToken(request: AuthedRequest): string | null {
    const header = request.headers['authorization'];
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice('Bearer '.length).trim();
  }

  private isValidPayload(payload: unknown): payload is JwtPayload {
    if (typeof payload !== 'object' || payload === null) return false;
    const p = payload as Record<string, unknown>;
    return (
      typeof p.sub === 'string' &&
      typeof p.username === 'string' &&
      typeof p.role === 'string' &&
      VALID_ROLES.has(p.role as UserRole) &&
      (p.fleetId === null || typeof p.fleetId === 'string')
    );
  }

  private toAuthenticatedUser(payload: JwtPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      username: payload.username,
      role: payload.role,
      fleetId: payload.fleetId,
    };
  }
}