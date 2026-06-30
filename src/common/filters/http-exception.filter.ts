import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

const ERROR_CODES: ReadonlyMap<number, string> = new Map([
  [400, 'BAD_REQUEST'],
  [401, 'UNAUTHORIZED'],
  [403, 'FORBIDDEN'],
  [404, 'NOT_FOUND'],
  [409, 'CONFLICT'],
  [429, 'RATE_LIMITED'],
  [500, 'INTERNAL_ERROR'],
  [503, 'SERVICE_UNAVAILABLE'],
]);

interface ErrorBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
  timestamp: string;
  path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);
  private readonly isProduction: boolean;

  constructor(configService: ConfigService) {
    this.isProduction =
      configService.get<string>('app.nodeEnv') === 'production';
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, code, message, details } = this.resolve(exception);

    const body: ErrorBody = {
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (!this.isProduction && details !== undefined) {
      body.error.details = details;
    }

    if (status >= 500) this.logServerError(exception, request, status);

    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }
    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: this.isProduction
          ? 'Internal server error'
          : exception.message,
      };
    }
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: 'INTERNAL_ERROR',
      message: 'Unknown error (non-Error throw)',
    };
  }

  private fromHttpException(exception: HttpException): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    const status = exception.getStatus();
    const res = exception.getResponse();

    if (typeof res === 'string') {
      return { status, code: this.codeOf(status), message: res };
    }

    if (res && typeof res === 'object') {
      const obj = res as Record<string, unknown>;
      const rawMsg = obj.message;
      const message =
        typeof rawMsg === 'string'
          ? rawMsg
          : Array.isArray(rawMsg)
            ? (rawMsg as string[]).join(', ')
            : exception.message;
      return {
        status,
        code: typeof obj.code === 'string' ? obj.code : this.codeOf(status),
        message,
        details: obj.details,
      };
    }

    return {
      status,
      code: this.codeOf(status),
      message: exception.message,
    };
  }

  private codeOf(status: number): string {
    return ERROR_CODES.get(status) ?? 'ERROR';
  }

  private logServerError(
    exception: unknown,
    request: Request,
    status: number,
  ): void {
    const meta =
      `${request.method} ${request.url} ${status} ` +
      (exception instanceof Error ? exception.message : 'non-Error throw');
    if (exception instanceof Error) {
      this.logger.error(meta, exception.stack);
    } else {
      this.logger.error(meta);
    }
  }
}
