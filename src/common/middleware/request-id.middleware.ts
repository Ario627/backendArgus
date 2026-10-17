import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

export const requestIdMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
): void => {
  const requestId = randomUUID();
  request.requestId = requestId;
  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};
