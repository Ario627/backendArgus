import { type CallHandler, type ExecutionContext, Injectable, Logger, type NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { finalize, type Observable } from 'rxjs';

const MAX_PATH_LENGTH = 240;

const trimPath = (value: string): string =>
  value.length <= MAX_PATH_LENGTH ? value : value.slice(0, MAX_PATH_LENGTH);

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const startedAt = performance.now();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Math.round(performance.now() - startedAt);
        const requestId = request.requestId ?? '-';
        this.logger.log(
          `${request.method} ${trimPath(request.path)} ${response.statusCode} ${durationMs}ms req=${requestId}`,
        );
      }),
    );
  }
}