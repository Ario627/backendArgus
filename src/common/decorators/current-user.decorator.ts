import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "../types";

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
        if (ctx.getType() !== 'http') return undefined;

        const request = ctx.switchToHttp().getRequest<{user?: AuthenticatedUser}>();
        return request.user;
    }
)