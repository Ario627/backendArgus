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