import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined => {
    if (context.getType() !== 'http') return undefined;
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    return request.user;
  },
);