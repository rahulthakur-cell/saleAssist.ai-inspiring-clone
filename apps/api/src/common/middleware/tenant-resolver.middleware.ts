import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Resolves the tenant context from the request.
 * Resolution order:
 * 1. X-Tenant-ID header
 * 2. JWT token (tenantId claim)
 * 3. Subdomain (e.g., demo.saleassist.local)
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    let tenantId: string | undefined;

    // 1. Check X-Tenant-ID header or query parameter
    const headerOrQueryTenant = (req.headers['x-tenant-id'] as string) || (req.query.tenantId as string);
    if (headerOrQueryTenant && headerOrQueryTenant !== 'undefined' && headerOrQueryTenant !== 'null') {
      tenantId = headerOrQueryTenant;
    }

    // 2. Check JWT token
    if (!tenantId) {
      const token = this.extractTokenFromHeader(req);
      if (token) {
        try {
          const payload = this.jwtService.decode(token) as any;
          tenantId = payload?.tenantId;
        } catch {
          // Token decode failed — continue without tenant
        }
      }
    }

    // 3. Check subdomain
    if (!tenantId) {
      const host = req.hostname;
      const appDomain = this.configService.get('APP_DOMAIN', 'localhost');
      if (host !== appDomain && host.endsWith(`.${appDomain}`)) {
        const subdomain = host.replace(`.${appDomain}`, '');
        // Note: We'd look up tenant by slug here, but for now just set it
        (req as any).tenantSlug = subdomain;
      }
    }

    (req as any).tenantId = tenantId;
    next();
  }

  private extractTokenFromHeader(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
