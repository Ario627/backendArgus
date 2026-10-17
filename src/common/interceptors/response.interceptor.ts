import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import { map, type Observable } from 'rxjs';
import { RAW_RESPONSE_KEY } from '../decorators/raw-response.decorator.js';
import type { ApiSuccessEnvelope } from '../types.js';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  T | ApiSuccessEnvelope<T | null>
> {
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiSuccessEnvelope<T | null>> {
    if (context.getType() !== 'http') return next.handle();

    const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isRaw) return next.handle();

    const response = context.switchToHttp().getResponse<Response>();
    response.setHeader('Cache-Control', 'no-store');

    return next.handle().pipe(
      map((data): T | ApiSuccessEnvelope<T | null> => ({
        data: data ?? null,
        timestamp: new Date().toISOString(),
        success: true,
      })),
    );
  }
}
