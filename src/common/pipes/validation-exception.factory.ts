import { HttpException, HttpStatus } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import type { ApiErrorDetail } from '../types.js';

const MAX_DETAILS = 20;
const MAX_FIELD_LENGTH = 64;

const normalizeFieldPath = (path: string): string =>
  path.replace(/[^A-Za-z0-9_.-]/g, '').slice(0, MAX_FIELD_LENGTH);

const collectDetails = (
  errors: readonly ValidationError[],
  parentPath: string,
  accumulated: ApiErrorDetail[],
): readonly ApiErrorDetail[] => {
  for (const error of errors) {
    if (accumulated.length >= MAX_DETAILS) break;
    const path = normalizeFieldPath(
      parentPath.length > 0 ? `${parentPath}.${error.property}` : error.property,
    );
    const constraintCodes = error.constraints === undefined ? [] : Object.keys(error.constraints);
    for (const code of constraintCodes) {
      if (accumulated.length >= MAX_DETAILS) break;
      accumulated.push({ code, field: path });
    }
    if (error.children !== undefined && error.children.length > 0) {
      collectDetails(error.children, path, accumulated);
    }
  }
  return accumulated;
};

export const validationExceptionFactory = (errors: ValidationError[]): HttpException => {
  const details = collectDetails(errors, '', []);
  return new HttpException(
    {
      code: 'SYS_VALIDATION',
      message: 'Data yang dikirim tidak valid',
      details,
    },
    HttpStatus.UNPROCESSABLE_ENTITY,
  );
};