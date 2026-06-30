import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';

const MAX_BODY_LOG_LENGTH = 500;
const MQTT_INTERNAL_PATH_PREFIX = '/mqtt';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { method, url, body } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const isMqttInternal = url.startsWith(MQTT_INTERNAL_PATH_PREFIX);
          const bodyPreview = isMqttInternal
            ? '[mqtt-internal-skipped]'
            : this.truncateBody(body);
          this.logger.log(
            `${method} ${url} ${response.statusCode} ${duration}ms ${bodyPreview}`,
          );
        },
        error: (err: unknown) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            `${method} ${url} ERROR ${duration}ms ${this.extractErrorMessage(err)}`,
          );
        },
      }),
    );
  }

  private truncateBody(body: unknown): string {
    if (body === undefined || body === null) return ``;

    const str = typeof body === 'string' ? body : JSON.stringify(body);
    if (str.length <= MAX_BODY_LOG_LENGTH) return str;

    return `${str.slice(0, MAX_BODY_LOG_LENGTH)}... [truncated]`;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return 'non-Error throw';
  }
}