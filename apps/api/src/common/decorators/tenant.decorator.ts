import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extracts the tenant ID from the request.
 * Set by TenantResolverMiddleware.
 * Usage: @TenantId() tenantId: string
 */
export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  },
);
