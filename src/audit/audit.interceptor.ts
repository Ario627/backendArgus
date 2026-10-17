import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { catchError, tap, throwError, type Observable } from 'rxjs';
import type { AuthenticatedUser } from '../common/types.js';
import {
  resolveAuditTarget,
  scrubQueryForAudit,
  type AuditTarget,
} from './audit-target.util.js';
import { AuditService } from './audit.service.js';

const INTERNAL_ERROR_STATUS = 500;

interface AuditedRequest extends Request {
  user?: AuthenticatedUser;
}

const statusOfError = (error: unknown): number =>
  error instanceof HttpException ? error.getStatus() : INTERNAL_ERROR_STATUS;

const codeOfError = (error: unknown): string | null => {
  if (!(error instanceof HttpException)) return null;
  const response = error.getResponse();
  if (response === null || typeof response !== 'object') return null;
  const code = (response as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest<AuditedRequest>();
    const route = request.route as { path?: unknown } | undefined;
    const target = resolveAuditTarget({
      method: request.method,
      baseUrl: request.baseUrl,
      routePath: typeof route?.path === 'string' ? route.path : '',
      role: request.user?.role ?? null,
      params: request.params ?? {},
    });
    if (target === null) {
      return next.handle();
    }
    return next.handle().pipe(
      tap(() => {
        this.write(
          target,
          request,
          context.switchToHttp().getResponse<Response>().statusCode,
          'OK',
          null,
        );
      }),
      catchError((error: unknown) => {
        this.write(
          target,
          request,
          statusOfError(error),
          'ERROR',
          codeOfError(error),
        );
        return throwError(() => error);
      }),
    );
  }

  private write(
    target: AuditTarget,
    request: AuditedRequest,
    status: number,
    outcome: 'OK' | 'ERROR',
    code: string | null,
  ): void {
    void this.auditService.record({
      aktor: request.user?.id ?? null,
      aktorPeran: request.user?.role ?? null,
      aksi: target.aksi,
      entitas: target.entitas,
      entitasId: target.entitasId,
      detail: {
        status,
        outcome,
        code,
        query: scrubQueryForAudit(request.query),
      },
      requestId: request.requestId ?? null,
    });
  }
}