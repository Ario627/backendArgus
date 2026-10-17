import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorDetail } from '../types.js';

const MAX_DETAILS = 20;
const MAX_CODE_LENGTH = 64;
const MAX_MESSAGE_LENGTH = 240;
const MAX_PATH_LENGTH = 240;
const MAX_FIELD_LENGTH = 64;

const STATUS_CODES: Readonly<Record<number, string>> = Object.freeze({
  400: 'SYS_BAD_REQUEST',
  401: 'AUTH_EXPIRED',
  403: 'RBAC_FORBIDDEN',
  404: 'SYS_NOT_FOUND',
  409: 'SYS_CONFLICT',
  413: 'PHOTO_TOO_LARGE',
  422: 'SYS_VALIDATION',
  429: 'RATE_LIMITED',
  500: 'SYS_INTERNAL',
  503: 'SYS_UNAVAILABLE',
});

const STATUS_MESSAGES: Readonly<Record<number, string>> = Object.freeze({
  400: 'Permintaan tidak valid',
  401: 'Sesi berakhir, silakan masuk kembali',
  403: 'Anda tidak punya akses untuk tindakan ini',
  404: 'Data tidak ditemukan',
  409: 'Permintaan bertentangan dengan kondisi data saat ini',
  413: 'Foto terlalu besar (maks 1 MB)',
  422: 'Data yang dikirim tidak valid',
  429: 'Terlalu banyak permintaan',
  500: 'Terjadi kesalahan internal',
  503: 'Layanan sedang tidak tersedia',
});

interface NormalizedError {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  readonly details?: readonly ApiErrorDetail[];
}

const clamp = (value: string, maxLength: number): string =>
  value.length <= maxLength ? value : value.slice(0, maxLength);

const normalizeStatus = (status: number): number =>
  Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;

const fallbackCode = (status: number): string =>
  STATUS_CODES[status] ?? (status >= 500 ? STATUS_CODES[500] : STATUS_CODES[400]);

const fallbackMessage = (status: number): string =>
  STATUS_MESSAGES[status] ?? (status >= 500 ? STATUS_MESSAGES[500] : STATUS_MESSAGES[400]);

const NEST_ROUTE_MESSAGE = /^Cannot (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS) /;
const EXCEPTION_CLASS_PREFIX = /^[A-Za-z]+Exception: /;

const FRAMEWORK_DEFAULT_MESSAGES: ReadonlySet<string> = new Set([
  'Unauthorized',
  'Forbidden resource',
  'Forbidden',
  'File too large',
  'Unexpected file field',
  'Multipart: Boundary not found',
  'Too many parts',
  'Too many files',
  'Too many fields',
  'Field name too long',
  'Field value too long',
  'Field name missing',
  'Field name nesting too deep',
  'Field name array index too large',
  'Invalid field name',
]);

const baseFrameworkMessage = (value: string): string => {
  const separator = value.indexOf(' - ');
  return separator === -1 ? value : value.slice(0, separator);
};

const resolveMessage = (status: number, raw: string): string => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return fallbackMessage(status);
  if (FRAMEWORK_DEFAULT_MESSAGES.has(trimmed)) return fallbackMessage(status);
  if (FRAMEWORK_DEFAULT_MESSAGES.has(baseFrameworkMessage(trimmed))) return fallbackMessage(status);
  if (NEST_ROUTE_MESSAGE.test(trimmed)) return fallbackMessage(status);
  if (EXCEPTION_CLASS_PREFIX.test(trimmed)) return fallbackMessage(status);
  return clamp(trimmed, MAX_MESSAGE_LENGTH);
};

const normalizeFieldName = (value: string): string =>
  value.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, MAX_FIELD_LENGTH);

const sanitizeDetails = (value: unknown): readonly ApiErrorDetail[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const details: ApiErrorDetail[] = [];
  for (const entry of value) {
    if (details.length >= MAX_DETAILS) break;
    if (entry === null || typeof entry !== 'object') continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.code !== 'string') continue;
    const code = clamp(record.code, MAX_CODE_LENGTH);
    const field = typeof record.field === 'string' ? normalizeFieldName(record.field) : '';
    const key = `${code}|${field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    details.push(field.length > 0 ? { code, field } : { code });
  }
  return details.length > 0 ? Object.freeze(details) : undefined;
};

const normalizeHttpException = (exception: HttpException): NormalizedError => {
  const status = normalizeStatus(exception.getStatus());
  const payload = exception.getResponse();
  if (typeof payload === 'string') {
    return { status, code: fallbackCode(status), message: resolveMessage(status, payload) };
  }
  if (payload !== null && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const code =
      typeof record.code === 'string' ? clamp(record.code, MAX_CODE_LENGTH) : fallbackCode(status);
    const message =
      typeof record.message === 'string'
        ? resolveMessage(status, record.message)
        : fallbackMessage(status);
    const details = sanitizeDetails(record.details);
    return details === undefined ? { status, code, message } : { status, code, message, details };
  }
  return { status, code: fallbackCode(status), message: fallbackMessage(status) };
};

const normalizeException = (exception: unknown): NormalizedError => {
  if (exception instanceof HttpException) return normalizeHttpException(exception);
  return { status: 500, code: STATUS_CODES[500], message: STATUS_MESSAGES[500] };
};

const describeForLog = (exception: unknown): string =>
  exception instanceof Error ? clamp(exception.message, MAX_MESSAGE_LENGTH) : 'non-error thrown';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      this.logger.error(describeForLog(exception), exception instanceof Error ? exception.stack : undefined);
      throw exception;
    }

    const http = host.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    if (response.headersSent) return;

    const normalized = normalizeException(exception);
    this.logIfNeeded(request, normalized, exception);

    response.status(normalized.status).json({
      success: false as const,
      error:
        normalized.details === undefined
          ? { code: normalized.code, message: normalized.message }
          : { code: normalized.code, message: normalized.message, details: normalized.details },
      timestamp: new Date().toISOString(),
      path: clamp(request.originalUrl.split('?')[0], MAX_PATH_LENGTH),
    });
  }

  private logIfNeeded(request: Request, normalized: NormalizedError, exception: unknown): void {
    const line = `${request.method} ${request.path} ${normalized.status} ${normalized.code}`;
    if (normalized.status >= 500) {
      this.logger.error(line, exception instanceof Error ? exception.stack : undefined);
      return;
    }
    if (normalized.status === 429 || normalized.status === 413) {
      this.logger.warn(line);
    }
  }
}
