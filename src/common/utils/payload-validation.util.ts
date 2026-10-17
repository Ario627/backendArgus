import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { validationExceptionFactory } from '../pipes/validation-exception.factory.js';

export const validatePayload = async <T extends object>(
  cls: new () => T,
  payload: object,
): Promise<T> => {
  const instance = plainToInstance(cls, payload);
  const errors = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  if (errors.length > 0) throw validationExceptionFactory(errors);
  return instance;
};
export const validationCodesOf = (error: unknown): readonly string[] => {
  if (!(error instanceof HttpException)) return ['SYSTEM'];
  const response = error.getResponse();
  if (response === null || typeof response !== 'object') return ['INVALID'];
  const details = (response as { details?: unknown }).details;
  if (!Array.isArray(details)) return ['INVALID'];
  const codes = new Set<string>();
  for (const entry of details) {
    if (entry === null || typeof entry !== 'object') continue;
    const code = (entry as { code?: unknown }).code;
    if (typeof code === 'string') codes.add(code);
  }
  return codes.size > 0 ? Object.freeze([...codes]) : ['INVALID'];
};
