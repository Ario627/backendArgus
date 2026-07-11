import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { Reflector } from "@nestjs/core";
import { RAW_RESPONSE_KEY } from "../decorators/raw-response.decorator";

interface WrappedResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, WrappedResponse<T> | T>  {
    constructor(private readonly reflector: Reflector) {}

    intercept(context: ExecutionContext, next: CallHandler<T>): Observable<WrappedResponse<T> | T> {
        if (context.getType() !== 'http') return next.handle();

        const isRaw = this.reflector.getAllAndOverride<boolean>(RAW_RESPONSE_KEY, [
            context.getHandler(),
            context.getClass()
        ]);

        if (isRaw) return next.handle();

        return next.handle().pipe(
            map((data) => ({
                success: true as const,
                data,
                timestamp: new Date().toISOString()
            }))
        )
    }
}