import type { UserRole } from './constant/domain.constant.js';

export interface JwtPayload {
  readonly sub: string;
  readonly username: string;
  readonly role: UserRole;
  readonly sppgId: string | null;
  readonly facilityId: string | null;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly username: string;
  readonly role: UserRole;
  readonly sppgId: string | null;
  readonly facilityId: string | null;
}

export interface PaginationQuery {
  readonly limit?: number;
  readonly cursor?: string;
  readonly page?: number;
}

export interface PaginatedItems<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly total: number;
}

export interface ApiErrorDetail {
  readonly code: string;
  readonly field?: string;
}

export interface ApiSuccessEnvelope<T> {
  readonly data: T;
  readonly timestamp: string;
  readonly success: true;
}

export interface ApiErrorEnvelope {
  readonly success: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly details?: readonly ApiErrorDetail[];
  };
  readonly timestamp: string;
  readonly path: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}