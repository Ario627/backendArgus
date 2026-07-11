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

const AUTH_SENSITIVE_KEYS = new Set(['password', 'passwordHash']);

const PRODUCTION_SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'username',
  'email',
  'accessToken',
  'refreshToken',
  'token',
  'authorization',
  'secret',
  'apiKey',
  'jwt',
]);

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(
    context: ExecutionContext,
    next: CallHandler<any>,
  ): Observable<any> {
    if (context.getType() !== 'http') {
      const pattern = this.getRpcPattern(context);
      const startTime = Date.now();
      this.logger.log(`[RPC] ${pattern} — received`);
      return next.handle().pipe(
        tap({
          next: () => {
            const duration = Date.now() - startTime;
            this.logger.log(`[RPC] ${pattern} — OK ${duration}ms`);
          },
          error: (err: unknown) => {
            const duration = Date.now() - startTime;
            this.logger.error(
              `[RPC] ${pattern} — ERROR ${duration}ms ${this.extractErrorMessage(err)}`,
            );
          },
        }),
      );
    }

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

  private getRpcPattern(context: ExecutionContext): string {
    // NestJS MQTT microservice: args[0] = topic, args[1] = payload (Buffer)
    const args = (context as any).args ?? [];
    if (typeof args[0] === 'string') return args[0];
    // Fallback: check pattern in various locations
    const pattern = args[0] ?? (context as any).pattern;
    if (typeof pattern === 'string') return pattern;
    if (pattern && typeof pattern.topic === 'string') return pattern.topic;
    if (pattern && typeof pattern.pattern === 'string') return pattern.pattern;
    return 'unknown-rpc';
  }

  private truncateBody(body: unknown): string {
    if (body === undefined || body === null) return ``;

    const sanitized = this.sanitizeBody(body);

    const str =
      typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);

    if (str.length <= MAX_BODY_LOG_LENGTH) {
      return str;
    }

    return `${str.slice(0, MAX_BODY_LOG_LENGTH)}... [truncated]`;
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.message;
    }
    return 'non-Error throw';
  }

  private sanitizeBody(body: unknown): unknown {
    if (body === null || body === undefined) {
      return body;
    }

    if (Array.isArray(body)) {
      return body.map((item) => this.sanitizeBody(item));
    }

    if (typeof body !== 'object') {
      return body;
    }

    const sensitiveKeys = this.getSensitiveKeys();
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(
      body as Record<string, unknown>,
    )) {
      sanitized[key] = sensitiveKeys.has(key)
        ? '********'
        : this.sanitizeBody(value);
    }

    return sanitized;
  }

  private getSensitiveKeys(): Set<string> {
    return process.env.NODE_ENV === 'production'
      ? PRODUCTION_SENSITIVE_KEYS
      : AUTH_SENSITIVE_KEYS;
  }
}